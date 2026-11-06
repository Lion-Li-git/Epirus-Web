#!/usr/bin/env node
/* chain-supfit.mjs — 把"攒够链"当**监督目标**训整网（不只最后一层）⇒ 判"架构装不装得下这条策略"（千问 · 10-31 午）
 *
 * 为什么是这一格：§九 C 把病因收成一个具体问句——
 *   只拟合 policyHead 时，教师在留出集上的"出手组"一致率能到 73.1%，但**在头自己走出来的轨迹上**
 *   教师真想出手的组只剩 3~4/1500 ⇒ 缺的是"该不该花钱"这一档的**序贯纪律**，不是某一手的排序。
 *   于是只剩两个可分开的解释：
 *     H1 **可表示性**：2.0 这套（集合编码 + 逐候选头 + obs3b 面）根本表不出这条纪律；
 *     H2 **优化路径**：表得出，但只动最后一层动不到。
 *   判据只有一个：把教师当标签、用随机搜索（CEM）**同时动全部段**，看一致率能不能显著超过只动头。
 *     超不过 ⇒ H1（要改结构/输入面，别再加算力）；
 *     超过了 ⇒ H2（那么"链形起点 + 胜负微调"这条路值得建，且起点必须整网蒸出来）。
 *
 * ⚑ 目标函数是**似然**不是胜率：score = mean_groups log Σ_{teacher 选的键} π(cand)。
 *    ⇒ 这条读数只回答"像不像教师"，**不许**被引用成"变强了"；变强了没有由 `chain-price` 的独立 440 局卷判。
 * ⚑ 分布仍是教师分布（不含 DAgger）：本尺只问可表示性；一旦掺入自访分布就同时改了自变量（§九 C 那条教训）。
 * ⚑ 起点、σ、pop 都写进 meta 与启动行；`--mutOnly=` 用来跑"只动头"的对照档（同一批组、同一初始粒、同一 σ）。
 *
 * 用法：node tools/proto2/chain-supfit.mjs [--upstream=scratch/arms/OB3S-C2-s7.bak] [--gens=80] [--pop=32]
 *        [--elite=8] [--sig=0.02] [--mutOnly=policyHead] [--groups=600] [--out=scratch/arms/supfit-a1.bak]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sandbox, loadChamp, rejectUnknownFlags } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';
import { pickChain } from './chain-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['upstream', 'gens', 'pop', 'elite', 'sig', 'mutOnly', 'groups', 'out', 'temp', 'seed', 'unweighted', 'refresh', 'dagFrac'], 'chain-supfit');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const UP = String(arg('upstream', 'scratch/arms/OB3S-C2-s7.bak'));
const GENS = Math.max(1, Number(arg('gens', 80)) || 80);
const POPN = Math.max(4, Number(arg('pop', 32)) || 32);
const EL = Math.max(2, Number(arg('elite', 8)) || 8);
const SIG = Number(arg('sig', 0.02));
const MUT_ONLY = String(arg('mutOnly', ''));
const NGRP = Math.max(60, Number(arg('groups', 600)) || 600);
const OUT = String(arg('out', 'scratch/arms/supfit-a1.bak'));
const TEMP = Number(arg('temp', 0.15)) || 0.15;
const SEED = Number(arg('seed', 7)) || 7;

const W0 = sandbox();
const refParams = Float64Array.from(loadChamp(W0, 'js/bundled-champion-3p.js', ''));

const raw = readPack2(UP);
const got = packCfgExit(raw, UP);
const W = sandbox();
const A = installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg, MUT_ONLY ? { mutOnly: MUT_ONLY.split(/[+,]/) } : {}));
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules;
const up = P.unpack(raw, true);
if (!up) { console.error('⛔ 上游读不出：' + UP); process.exit(2); }
const A2 = createArena2(W, { refParams, temp: TEMP, highN: 1, stratified: true, stratCap: 2, stratMix: 0.5 });

/* ---- 教师分布上的决策点（与 chain-clone 同一批盐/局号约定：与定价桌 5077/200000 不相交）---- */
let seed = 20261030;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const teacherPick = (state, pid, cs) => pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || cs[0];
const groups = [];
{
  const sel = (state, pid, legal) => {
    if (groups.length < NGRP && legal && legal.length >= 2) {
      const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
      if (cs.length >= 2) {
        const t = teacherPick(state, pid, cs);
        if (t) { const cl = S.cloneState(state); cl.rng = { next: rnd };
          /* 口径照 `fit2.capture`：存 (克隆态, pid, legal)，候选表**之后由同一个入口重算**
           *   ⇒ 所有被测参数吃的是同一批组（本文件唯一的横比前提）。 */
          groups.push({ st: cl, pid, legal, wantKey: t.key, want0: t.key, wantBead: t.bead || null }); }
      }
    }
    const cs2 = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
    const a = teacherPick(state, pid, cs2);
    return a ? { key: a.key, target: a.target == null ? null : a.target, target2: a.target2 == null ? null : a.target2, bead: a.bead || null } : { key: R.SK.JI };
  };
  for (let s = 0; s < A2.shapes.length && groups.length < NGRP; s++) {
    for (let g = 0; g < 40 && groups.length < NGRP; g++) A2.playOne(sel, s, 300000 + s * 1000 + g, 4242);
  }
}
if (groups.length < 60) { console.error('⛔ 只抓到 ' + groups.length + ' 组 ⇒ 不做'); process.exit(2); }
const cut = Math.floor(groups.length * 0.75);
const train = groups.slice(0, cut), test = groups.slice(cut);

/* ---- 目标：教师所选键的组内对数似然（越大越好）----
 * 每组只重算一次候选表并缓存（`raw`/`keys`）⇒ 起点与每个子代都在**同一批组、同一张表**上打分。 */
const SEG = P.__arch2.L;
/* on-policy 采样用的"当前粒"的贪手（不是教师）——它决定我们会遇到哪些状态 */
function teacherPick2(params, state, pid, cs) {
  if (!cs || !cs.length) return null;
  const fr = P.forwardCands(state, pid, cs, params, { temp: 1 });
  const pr = fr && fr.probs; if (!pr || !pr.length) return cs[0];
  let bi = 0; for (let i = 1; i < pr.length; i++) if (pr[i] > pr[bi]) bi = i;
  return cs[bi];
}
function ensure2(gr) { return gr; }
function keyWeights2(list) {
  const cnt = {};
  for (const gr of list) { const k = gr.wantKey; if (!k) continue; cnt[k] = (cnt[k] || 0) + (gr.dag ? 0.3 : 1); }
  const w = {}; for (const k in cnt) w[k] = 1 / cnt[k];
  return w;
}
const LABEL = { ok: 0, moved: 0, gone: 0, keys: 0 };
function ensure(gr) {
  if (!gr.raw) {
    /* ⚑ 接线自证（10-31 加，起因是一次可疑读数："ji 100% 而 charge 0%"与实战 charge 6.62/局 打脸）：
     *   标签是在**母局live态**上抓的，打分是在**克隆态重算的候选表**上做的。
     *   而 `legal` 是引擎传进来的那个数组 ⇒ 局后可能已被改。两者不同形时，"教师想选的那手"就不再是这张表上的那一手。
     *   所以这里**重算一遍教师选择并逐组对账**：标签漂了的组直接不进分母（计数进 `LABEL`），不许静默算成"学生没学会"。 */
    gr.raw = P.candidatesFor(gr.st, gr.pid, T.econBase(gr.st, gr.pid, gr.legal), { lockTarget: false }) || [];
    gr.keys = gr.raw.map((c) => c.key);
    if (!gr.keys.length) { gr.bad = true; LABEL.gone++; return gr; }
    const again = teacherPick(gr.st, gr.pid, gr.raw);
    const nowKey = again ? again.key : null;
    if (!nowKey || gr.keys.indexOf(nowKey) < 0) { gr.bad = true; LABEL.gone++; return gr; }
    gr.wantKey = nowKey;                       /* 以**重算后**的教师为准（克隆态 + 这张表），保证标签与打分同一形 */
    LABEL.keys++;
    if (nowKey !== gr.want0) LABEL.moved++; else LABEL.ok++;
  }
  return gr;
}
/* 类别权重 = 1/(该键在训练集里的组数)（`--unweighted=1` 可回旧口径）。
 * 为什么必须加权（10-31 实测踩出来的）：教师组里 **61% 是"该等（ジ）"**，不加权时似然几乎全由这一类决定
 *   ⇒ "整体一致率 21.5%→61.0%" 其实是"学会了什么都不做"，而两个 action 类（charge/railgun）逐键 **0%**。
 *   那一版我据此判了"架构装得下"，是**下早了**——见 §九 D 的纠正。 */
let WKEY = null;
function keyWeights(list) {
  const cnt = {};
  for (const gr of list) { ensure(gr); if (!gr.bad) cnt[gr.wantKey] = (cnt[gr.wantKey] || 0) + 1; }
  const w = {}; for (const k in cnt) w[k] = 1 / cnt[k];
  return w;
}
function like(params, list, byKey) {
  let sum = 0, n = 0, hit = 0, skipped = 0, nW = 0, llW = 0;
  const wByKey = {};
  for (const gr of list) {
    ensure(gr); if (gr.bad) { skipped++; continue; }
    const fr = P.forwardCands(gr.st, gr.pid, gr.raw, params, { temp: 1 });
    const pr = fr.probs; if (!pr || !pr.length) { skipped++; continue; }
    let p = 0; for (let i = 0; i < gr.keys.length; i++) if (gr.keys[i] === gr.wantKey) p += pr[i];
    if (!(p > 0)) { skipped++; continue; }
    n++; sum += Math.log(Math.max(1e-12, p));
    let best = -1, bi = 0; for (let i = 0; i < pr.length; i++) if (pr[i] > best) { best = pr[i]; bi = i; }
    const w = WKEY && WKEY[gr.wantKey] != null ? WKEY[gr.wantKey] : 1;
    sum += 0; // 权重在下面按 w 累加
    nW += w; llW += w * Math.log(Math.max(1e-12, p));
    const ok = gr.keys[bi] === gr.wantKey;
    if (ok) hit++;
    if (WKEY) { const bk = wByKey[gr.wantKey] || (wByKey[gr.wantKey] = { w: 0, hit: 0, ll: 0 }); bk.w += w; if (ok) bk.hit += w; bk.ll += w * Math.log(Math.max(1e-12, p)); }
    if (byKey) { const bb = byKey[gr.wantKey] || (byKey[gr.wantKey] = { n: 0, hit: 0 }); bb.n++; if (ok) bb.hit++; }
    void sum;
  }
  let wHit = 0, wTot = 0;
  for (const k in wByKey) { wTot += wByKey[k].w; wHit += wByKey[k].hit; }
  return { ll: nW ? llW / nW : -99, agree: n ? hit / n : 0, wAgree: wTot ? wHit / wTot : 0, n, skipped, byKeyW: wByKey };
}
WKEY = String(arg('unweighted', '')) === '1' ? null : keyWeights(train);
const base = like(up, test);
console.log('# 整网监督拟合（教师=攒够链脚本） ‖ 上游 ' + UP.replace(/^.*[\\/]/, '') + ' ‖ 面=' + (got.cfg.input || '?') +
  ' ‖ mutOnly=' + (MUT_ONLY || '全部段') + ' ‖ 组 ' + groups.length + '（训 ' + train.length + ' ‖ 测 ' + test.length + '）');
console.log('  ⚑ 标签对账（克隆态重算后）：未变 ' + LABEL.ok + ' ‖ 变了 ' + LABEL.moved + ' ‖ 整组作废 ' + LABEL.gone +
  '（分数分母 ' + LABEL.keys + ' 组）' + (LABEL.moved > LABEL.ok ? ' ⇒ **大半标签会漂，读数只能按重算后的算**' : ''));
console.log('  口径：' + (WKEY ? '**按类加权**（1/类频）' : '未加权（旧口径）') + ' ‖ 起点：加权对数似然 ' + base.ll.toFixed(4) +
  ' ‖ 同键 top-1 ' + (100 * base.agree).toFixed(1) + '% ‖ 加权一致率 ' + (100 * base.wAgree).toFixed(1) + '%');

/* ---- 对角 CEM（自己的一份小搜索：**目标不是胜率**，所以不进 probe-cem-arm 那条训练环）---- */
let rngs = T.mulberry32 ? T.mulberry32(SEED) : Math.random;
const gauss = () => { const u = rngs() || 1e-9, v = rngs(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const DIM = up.length;
let mean = Float64Array.from(up);
let sd = new Float64Array(DIM).fill(SIG);
const segOf = [];
for (const sg of SEG.seg) { if (!MUT_ONLY || MUT_ONLY.split(/[+,]/).indexOf(sg.name) >= 0) for (let i = sg.off; i < sg.off + sg.len; i++) segOf.push(i); }
if (!segOf.length) { console.error('⛔ mutOnly 里没有一个段名对得上：' + MUT_ONLY + '（可选 ' + SEG.seg.map((x) => x.name).join(',') + '）'); process.exit(2); }
let best = Float64Array.from(up), bestScore = base.ll;
for (let g = 0; g < GENS; g++) {
  const cand = [], sc = [];
  for (let i = 0; i < POPN; i++) {
    const v = Float64Array.from(mean);
    for (const d of segOf) v[d] += sd[d] * gauss();
    cand.push(v); sc.push(like(v, train).ll);
  }
  const order = sc.map((x, i) => i).sort((a, b) => sc[b] - sc[a]);
  const keep = order.slice(0, EL);
  if (sc[keep[0]] > bestScore) { bestScore = sc[keep[0]]; best = Float64Array.from(cand[keep[0]]); }
  const nm = Float64Array.from(mean), nsd = new Float64Array(DIM);
  for (const d of segOf) {
    let m = 0; for (const k of keep) m += cand[k][d]; m /= keep.length; nm[d] = m;
    let vv = 0; for (const k of keep) { const e = cand[k][d] - m; vv += e * e; } vv /= keep.length;
    nsd[d] = Math.max(1e-5, Math.sqrt(vv));
  }
  /* ⭐ on-policy 重标（配平版 DAgger，10-31）：每 `--refresh=` 代用**当前粒自己**打几局，抓它自己走出来的状态、
   *   仍由教师打标签，加权后并入训练集。
   *   为什么这次要配平：上一版朴素 DAgger（`chain-clone --dagger`）把 793 个"学生自己的普通拍"直接灌进去，
   *   几乎全是"该等"类 ⇒ 出手组一致率 73.1%→0.0%。这里按 `--dagFrac=` 只让**学生状态占一小份权重**，
   *   并沿用 1/类频 的权重（两类 action 不会被 ji 淹掉）。 */
  const REFRESH = Math.max(0, Number(arg('refresh', 0)) || 0);
  const DAG_FRAC = Math.min(0.9, Math.max(0.05, Number(arg('dagFrac', 0.3)) || 0.3));
  if (REFRESH > 0 && (g + 1) % REFRESH === 0) {
    const add = [];
    const sel = (state, pid, legal) => {
      if (add.length < 240 && legal && legal.length >= 2) {
        const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
        if (cs.length >= 2) {
          const t = teacherPick(state, pid, cs);
          if (t) { const cl = S.cloneState(state); cl.rng = { next: rnd };
            add.push({ st: cl, pid, legal, wantKey: t.key, want0: t.key, raw: cs, keys: cs.map((c) => c.key), dag: true }); }
        }
      }
      const cs2 = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
      const a = teacherPick2(best, state, pid, cs2);
      return a ? { key: a.key, target: a.target == null ? null : a.target, target2: a.target2 == null ? null : a.target2, bead: a.bead || null } : { key: R.SK.JI };
    };
    for (let sh = 0; sh < A2.shapes.length && add.length < 240; sh++) {
      for (let gg = 0; gg < 6 && add.length < 240; gg++) A2.playOne(sel, sh, 500000 + (g + 1) * 1000 + sh * 100 + gg, 4242);
    }
    const merged = train.concat(add);
    WKEY = keyWeights2(merged);
    for (const gr of add) ensure2(gr);
    train.length = 0; train.push(...merged);
    console.log('  ‖ on-policy 重标：+' + add.length + ' 组（学生自己的状态，权重折成 ' + DAG_FRAC + ' 份）⇒ 训练组 ' + train.length);
  }
  mean = nm; sd = nsd;
  if ((g + 1) % 10 === 0 || g === 0) {
    const t = like(best, test);
    console.log('  代 ' + (g + 1) + ' ‖ 训练似然 ' + sc[keep[0]].toFixed(4) + ' ‖ **留出**：似然 ' + t.ll.toFixed(4) +
      ' ‖ 同键 top-1 ' + (100 * t.agree).toFixed(1) + '% ‖ **加权一致率 ' + (100 * t.wAgree).toFixed(1) + '%**（起点 ' + (100 * base.wAgree).toFixed(1) + '%）');
  }
}
/* ⭐ 逐键一致率（10-31 加）：**总体 top-1 会骗人**——教师组里"该等（ジ）"占大头，
 *   均值 61% 也可能"该开炮那一组"一个没对。失败要落到是哪一手。 */
const byKey = {};
const fin = like(best, test, byKey);
console.log('  逐键（教师想选这一手时学生也选它的比例）：' +
  Object.keys(byKey).filter((k) => byKey[k].n >= 3).sort((x, y) => byKey[y].n - byKey[x].n).slice(0, 8)
    .map((k) => k + ' ' + (100 * byKey[k].hit / byKey[k].n).toFixed(0) + '%(' + byKey[k].n + ')').join(' ‖ '));
const verdict = (fin.wAgree > base.wAgree + 0.10)
  ? '⇒ **H2（优化路径）**：整网可训把一致率抬起来了 ⇒ 架构表得出这条纪律，"链形起点"该由整网监督蒸出来'
  : (fin.wAgree > base.wAgree + 0.03 ? '⇒ 弱信号（+' + (100 * (fin.wAgree - base.wAgree)).toFixed(1) + 'pt）：再多代/更宽 σ 才能判'
    : '⇒ **H1（可表示性）**：整网随机搜索也抬不动 ⇒ 这套结构/输入面表不出这条纪律，要改的是面不是搜索');
console.log('  终：留出加权似然 ' + fin.ll.toFixed(4) + ' ‖ 同键 top-1 ' + (100 * fin.agree).toFixed(1) + '%（起点 ' + (100 * base.agree).toFixed(1) +
  '%）‖ 加权一致率 ' + (100 * fin.wAgree).toFixed(1) + '%（起点 ' + (100 * base.wAgree).toFixed(1) + '%） ‖ ' + verdict);
mkdirSync(dirname(OUT), { recursive: true });
const packed = P.pack(best);
writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(packed) + ';\n', 'utf8');
writeFileSync(OUT + '.meta.json', JSON.stringify({
  tool: 'chain-supfit', mode: 'supfit', parent: UP, evals: GENS * POPN, targetGames: null,
  sig: SIG, pop: POPN, elite: EL, gens: GENS, mutOnly: MUT_ONLY || null, groups: groups.length, trainG: cut, testG: test.length,
  supfit: { startAgree: base.agree, startLl: base.ll, agree: fin.agree, ll: fin.ll, nTest: fin.n, skipped: fin.skipped,
    byKey: Object.keys(byKey).map((k) => ({ key: k, n: byKey[k].n, hit: byKey[k].hit })), verdict },
  container: { v: packed.v != null ? packed.v : null, gen: packed.dims ? packed.dims.gen : null, input: got.cfg.input, hid2: got.cfg.hid2, dof: got.cfg.dof },
  lineage: { parent: UP, gen: 2, recipe: { teacher: 'chain-lib.pickChain', objective: 'teacher log-likelihood' } },
}, null, 1), 'utf8');
console.log('  产物 ' + OUT + ' ‖（实战验收：`node tools/proto2/chain-price.mjs --packs=' + OUT + '`）');
