#!/usr/bin/env node
/* supfit-full.mjs — 全模型监督蒸馏（DS · 11-04 晚）：教师给键，梯度落到**所有段**（不是只 policyHead）
 * 用法：node tools/proto2/supfit-full.mjs --up=scratch/arms/KD-V7.bak --out=scratch/arms/KDFULL.bak --steps=2000 --groups=1200
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { sandbox, loadChamp, rejectUnknownFlags } from '../audit-lib.mjs';
import { widOf } from '../../champion-map/pack-id.mjs';   /* 与 D191 / pack-identity / lineage 同一个 wid 权威，不另发明一套哈希 */
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';
import { layoutOf, tailOf, tapeForward, tapeBackward, dLogKeyP } from './pg-lib.mjs';
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['up', 'out', 'steps', 'groups', 'lr', 'batch', 'seed', 'temp', 'games', 'n', 'mode', 'teacher', 'balance', 'collect', 'wKey'], 'supfit-full');
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const UP = arg('up', 'scratch/arms/KD-V7.bak');
const OUT = arg('out', 'scratch/arms/KDFULL.bak');
/* （ZCode · 11-08 晨 · METHODOLOGY 145）标签教师可指：任意 v7 包（EpirusPolicy.value 的 argmax 当标签源）。
 *   缺省 = 现役（原行为逐字不变）。桌面参照 refParams（createArena2 的关档席）**保持现役不动**——
 *   换的是"谁给标签"，不是"在什么环境里采"；两件事混着改，克隆读数就没法归因。 */
const TEACHER = arg('teacher', 'js/bundled-champion-3p.js');
/* （11-08 晨补）--balance=0 = 按教师自然分布采样（缺省 1 = 键级均衡）。KD-Q 实测：均衡采样把 guard 类
 *   过度放大成 57% 守癖畸变（教师 28.6%）⇒ 教师本身多样时（8 键类）自然分布更保真；均衡档留着复现旧口径。 */
const BALANCE = String(arg('balance', '1')) !== '0';
/* （11-08 晨补）--collect=teacher = **教师开车**采状态（seat0 用教师自己的生产口径 chooser），学生离线学
 *   教师分布上的标签。缺省 'student'（学生自访 + 教师给键）——KD-Q/KD-U 实测自访档会守癖螺旋
 *   （学生 27% 防御的状态里教师 value 选 guard ⇒ 学生更守 ⇒ 状态更守 ⇒ 57~65% guard 畸变）。
 *   整策略转移要的是教师分布上的行为克隆，不是自访分布上的 value 蒸馏；自访档留给 chain 那类"要执行"的用例。 */
const COLLECT = arg('collect', 'student');
/* （ZCode · 11-08 晚）--wKey=<键>:<权重>（可重复）= **键过采样**：采集自然分布里稀缺但战斗关键的键
 *   （KD 谱系实测 gun 同键保真 ~15% ⇒ 农民盲/场B 缺失顺着克隆链传给每一代）按权重放大它在训练抽样里
 *   的被抽概率（自然计数 × 权重）。只改"抽谁"，不改"抽到之后怎么学"（梯度式/lr/步数全不动）⇒ 归因单变量。
 *   只在 --balance=0（自然分布档）生效；均衡档本就按键均匀，过采样无意义（给了就打警告）。 */
const WKEY = new Map();
for (const a of argv.filter((x) => x.indexOf('--wKey=') === 0)) {
  const m2 = a.slice(7).match(/^(\S+):([\d.]+)$/);
  if (!m2) { console.error('⛔ --wKey 格式 = <键>:<权重>（如 --wKey=gun:5），收到 ' + a); process.exit(2); }
  WKEY.set(m2[1], Number(m2[2]));
}
const STEPS = Math.max(50, Number(arg('steps', 2000)) || 2000);
const NGRP = Math.max(200, Number(arg('groups', 1200)) || 1200);
const LR = Number(arg('lr', 3e-4)) || 3e-4;
const BATCH = Math.max(4, Number(arg('batch', 24)) || 24);
const SEED = Number(arg('seed', 13)) || 13;
const TEMP = Number(arg('temp', 0.5)) || 0.5;
const GAMES = Math.max(20, Number(arg('games', 400)) || 400);
const N = Math.max(2, Number(arg('n', 5)) || 5), MODE = arg('mode', 'long');
let s0 = SEED >>> 0;
const rnd = () => { s0 = (s0 + 0x6D2B79F5) >>> 0; let t = s0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* 先读 v7 参照（createArena2 的硬条款：必须在 installArch2 之前） */
const Wv = sandbox();
const refParams = Float64Array.from(loadChamp(Wv, 'js/bundled-champion-3p.js', ''));
const tchParams = Float64Array.from(loadChamp(Wv, TEACHER, ''));   /* 标签教师（可与参照不同包） */
console.log('[supfit-full] 教师 = ' + TEACHER + (TEACHER === 'js/bundled-champion-3p.js' ? '（=现役，历史行为）' : '（参数化教师）'));
const W = sandbox();
const raw = readPack2(UP);
if (!raw) { console.error('⛔ 读不出上游 ' + UP); process.exit(5); }
const got = packCfgExit(raw, UP);
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules, S = W.EpirusState;
const ly = layoutOf(P);
const pv = new Float64Array(P.paramCount());
const up0 = P.unpack(raw, true);
if (!up0 || up0.length !== pv.length) { console.error('⛔ 上游参数数不符'); process.exit(5); }
pv.set(up0);
const A = createArena2(W, { refParams, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
const shapes = A.shapes.filter((s) => s.mode === MODE && (s.n === N || s.n === 3));
const teacherIdx = (state, pid, cs) => {
  let best = -1e9, bi = 0;
  for (let i = 0; i < cs.length; i++) {
    let v = 0;
    try { v = Wv.EpirusPolicy.value(state, pid, cs[i].key, tchParams, null, cs[i]); } catch (e) { v = 0; }
    if (v > best) { best = v; bi = i; }
  }
  return bi;
};
const chooser = (p, temp) => T.policyChooserN(p, temp, 0, 1, 'soft');
/* 采集：学生自访（seat0 用当前权重），教师给标签 */
const groups = [];
const tchChooser = T.policyChooserN(tchParams, 0.15);   /* 教师的生产口径（--collect=teacher 时开车用） */
for (let g = 0; g < GAMES && groups.length < NGRP; g++) {
  const sh = shapes[g % shapes.length];
  const ch = chooser(pv, TEMP);
  const seat0 = (state, pid, legal) => {
    if (groups.length < NGRP) {
      const cl = S.cloneState(state);
      const cs = P.candidatesFor(cl, pid, T.econBase(cl, pid, legal), { lockTarget: false }) || [];
      if (cs.length >= 2) {
        const wi = teacherIdx(cl, pid, cs);
        const fr = P.forwardCands(cl, pid, cs, pv, { temp: 1, wantTape: 1 });
        if (fr && fr.tape && fr.tape.keys && fr.tape.keys[wi]) groups.push({ tape: fr.tape, keys: fr.tape.keys, wantKey: fr.tape.keys[wi] });
      }
    }
    return (COLLECT === 'teacher') ? tchChooser(state, pid, legal) : ch(state, pid, legal);
  };
  const subs = [seat0];
  for (let pid = 1; pid < sh.n; pid++) { const ri = (90000 * 7 + pid * 11 + g * 17 + 101) % A.roster.length; let e = A.roster[ri]; if (e.kind === 'random') e = A.roster[(ri + 1) % A.roster.length]; subs.push(e.sel); }
  T.oneGameN(subs, 81000 + g * 977, sh.n, { mode: sh.mode });
}
console.log('采集 ' + groups.length + ' 组 ‖ 键类 ' + new Set(groups.map((x) => x.wantKey)).size);
const cut = Math.floor(groups.length * 0.75);
const train = groups.slice(0, cut), hold = groups.slice(cut);
/* 类平衡采样：键级目标在 ji 占多数时会塌成"永远 ji"（2000 步实测 41.7% = ji 频率）⇒ 每批按键均匀抽。
 *   --balance=0 = 按教师自然分布抽（教师多样时不塌，且不放大稀有键 ⇒ 保真优先，见 KD-Q 57% 守癖教训）。 */
const byKey = new Map();
for (const g of train) { if (!byKey.has(g.wantKey)) byKey.set(g.wantKey, []); byKey.get(g.wantKey).push(g); }
const keyList = Array.from(byKey.keys());
/* 键过采样的加权抽样表（自然计数 × wKey 权重；不给 wKey 时保持 train 均匀这条历史路径逐字节不动） */
let wSample = null;
if (WKEY.size && !BALANCE) {
  const cnt = new Map();
  for (const g of train) cnt.set(g.wantKey, (cnt.get(g.wantKey) || 0) + 1);
  const cum = []; let tot = 0;
  for (const [k, c] of cnt) { tot += c * (WKEY.get(k) || 1); cum.push([tot, k]); }
  wSample = { cum, tot };
  console.log('[supfit-full] 键过采样（balance=natural）：' + [...WKEY].map(([k, w]) => k + '×' + w + '（train ' + (cnt.get(k) || 0) + '/' + train.length + ' 组，占 ' + (100 * (cnt.get(k) || 0) / Math.max(1, train.length)).toFixed(1) + '%）').join(' ‖ '));
} else if (WKEY.size && BALANCE) {
  console.log('[supfit-full] ⚠ --wKey 在 --balance=1（键均衡）档不生效：均衡档每键已等概率。要过采样请配 --balance=0');
}
function pickTrain() {
  if (!wSample) return train[Math.floor(rnd() * train.length)];
  const r = rnd() * wSample.tot;
  let k = wSample.cum[wSample.cum.length - 1][1];
  for (const [c, kk] of wSample.cum) { if (r <= c) { k = kk; break; } }
  const poolK = byKey.get(k);
  return poolK && poolK.length ? poolK[Math.floor(rnd() * poolK.length)] : train[0];
}
const dim = pv.length;
const adam = { m: new Float64Array(dim), v: new Float64Array(dim), t: 0 };
const grad = new Float64Array(dim);
function acc(g, p) {
  const a = tapeForward(g.tape, p, ly);
  const t = tailOf(a.logits, g.keys, TEMP);
  return { a, t };
}
function step() {
  grad.fill(0);
  let used = 0, skipped = 0;
  for (let b = 0; b < BATCH; b++) {
    const g2 = BALANCE
      ? (() => { const k = keyList[Math.floor(rnd() * keyList.length)]; const poolK = byKey.get(k); return poolK[Math.floor(rnd() * poolK.length)] || train[0]; })()
      : pickTrain();
    const { a, t } = acc(g2, pv);
    if (t.kProb[g2.wantKey] == null) { skipped++; continue;   /* 11-10：静默跳过必须留痕——全跳 = 训练空转（lr 都不敏感） */ }
    const u = dLogKeyP(g2.wantKey, a.logits, g2.keys, TEMP, t);
    for (let j = 0; j < u.length; j++) u[j] = -u[j];   /* 最小化 −log P ⇒ 传负导数（与 pg-train 的梯度约定对齐） */
    tapeBackward(g2.tape, pv, ly, a, u, grad);
    used++;
  }
  if (!used) { if (!step.skips) step.skips = 0; step.skips += skipped; return; }
  if (skipped > 0) console.log('  [skip] 本批 ' + skipped + '/' + BATCH + ' 组键不匹配（teacher 键不在学生候选键表）');
  adam.t++;
  for (let d = 0; d < dim; d++) {
    const gg = grad[d] / used;
    adam.m[d] = 0.9 * adam.m[d] + 0.1 * gg;
    adam.v[d] = 0.999 * adam.v[d] + 0.001 * gg * gg;
    const mh = adam.m[d] / (1 - Math.pow(0.9, adam.t)), vh = adam.v[d] / (1 - Math.pow(0.999, adam.t));
    pv[d] -= LR * mh / (Math.sqrt(vh) + 1e-8);
  }
}
function evalSet(set) {
  let hit = 0, n = 0; const by = {};
  for (const g of set) {
    const { a, t } = acc(g, pv);
    let bestK = null, bestP = -1;
    for (const k in t.kProb) if (t.kProb[k] > bestP) { bestP = t.kProb[k]; bestK = k; }
    n++; if (bestK === g.wantKey) { hit++; } by[g.wantKey] = by[g.wantKey] || [0, 0]; by[g.wantKey][1]++; if (bestK === g.wantKey) by[g.wantKey][0]++;
  }
  return { acc: hit / Math.max(1, n), by };
}
for (let s = 1; s <= STEPS; s++) {
  step();
  if (s % 200 === 0 || s === STEPS) {
    const tr = evalSet(train), ho = evalSet(hold);
    console.log('步 ' + s + ' ‖ 训练同键 ' + (100 * tr.acc).toFixed(1) + '% ‖ 留出同键 ' + (100 * ho.acc).toFixed(1) + '%');
  }
}
const ho = evalSet(hold);
const parts = Object.entries(ho.by).filter(([, v]) => v[1] >= 8).map(([k, v]) => k + ' ' + Math.round(100 * v[0] / v[1]) + '%(' + v[1] + ')');
console.log('逐键（留出）：' + parts.join(' ‖ '));
const packed = P.pack(pv);
/* 起点身份入档（用户 11-05：「训练侧也修一下，这些本来都早就搞好的问题」）
 *   病：这一路以前**整条 META 都不写** ⇒ KD-V7 / GD3-SWORD / GD3-ALL / GD3-RATION / KDFULL2 这 5 枚
 *   蒸馏根的起点是谁只剩"按名字猜"，谱系图上只能画虚线（`lineage-g3-build.mjs` 的哈希核对对它们无米下锅）。
 *   契约与 `tools/train-3p.mjs:2006` 同一式：`hotstartFrom` 记**权重 id（wid）**，不记路径；
 *   算不出才退回路径（并在终端点名），因为路径会因去重/改名失效 —— 那是 10-12 记进账的同一场病。 */
let hf = '';
try { hf = widOf(readFileSync(UP, 'utf8')) || ''; } catch (e) { hf = ''; }
if (!hf) console.log('⚠ 起点 wid 算不出（外壳不认/文件读不到）⇒ hotstartFrom 退回路径 ' + UP + '，谱系这一级仍按名字推');
const meta = { ts: new Date().toISOString(), arm: OUT.split(/[\\/]/).pop().replace(/\.(bak|js)$/, ''),
  up: UP, hotstartFrom: hf || UP, seed: SEED, steps: STEPS, groups: NGRP, lr: LR, batch: BATCH, temp: TEMP, games: GAMES, n: N, mode: MODE,
  teacher: TEACHER, balance: BALANCE ? 'key' : 'natural', collect: COLLECT,   /* METHODOLOGY 145：克隆的"知识来自谁 + 怎么采"必须入档（保真闸要拿它对师徒三件套） */
  wkey: WKEY.size ? Object.fromEntries(WKEY) : undefined };   /* 键过采样剂量入档（11-08 晚；无旗标时不写此键 ⇒ 历史 meta 逐字不变） */
writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\n' +
  'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(packed) + ';\n', 'utf8');
console.log('产物 → ' + OUT + ' ‖ meta.hotstartFrom=' + (hf ? hf + '（wid）' : UP + '（路径，wid 算不出）'));
