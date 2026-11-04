#!/usr/bin/env node
/* supfit-full.mjs — 全模型监督蒸馏（DS · 11-04 晚）：教师给键，梯度落到**所有段**（不是只 policyHead）
 * 用法：node tools/proto2/supfit-full.mjs --up=scratch/arms/KD-V7.bak --out=scratch/arms/KDFULL.bak --steps=2000 --groups=1200
 */
import { writeFileSync } from 'node:fs';
import { sandbox, loadChamp, rejectUnknownFlags } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';
import { layoutOf, tailOf, tapeForward, tapeBackward, dLogKeyP } from './pg-lib.mjs';
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['up', 'out', 'steps', 'groups', 'lr', 'batch', 'seed', 'temp', 'games', 'n', 'mode'], 'supfit-full');
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const UP = arg('up', 'scratch/arms/KD-V7.bak');
const OUT = arg('out', 'scratch/arms/KDFULL.bak');
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
    try { v = Wv.EpirusPolicy.value(state, pid, cs[i].key, refParams, null, cs[i]); } catch (e) { v = 0; }
    if (v > best) { best = v; bi = i; }
  }
  return bi;
};
const chooser = (p, temp) => T.policyChooserN(p, temp, 0, 1, 'soft');
/* 采集：学生自访（seat0 用当前权重），教师给标签 */
const groups = [];
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
    return ch(state, pid, legal);
  };
  const subs = [seat0];
  for (let pid = 1; pid < sh.n; pid++) { const ri = (90000 * 7 + pid * 11 + g * 17 + 101) % A.roster.length; let e = A.roster[ri]; if (e.kind === 'random') e = A.roster[(ri + 1) % A.roster.length]; subs.push(e.sel); }
  T.oneGameN(subs, 81000 + g * 977, sh.n, { mode: sh.mode });
}
console.log('采集 ' + groups.length + ' 组 ‖ 键类 ' + new Set(groups.map((x) => x.wantKey)).size);
const cut = Math.floor(groups.length * 0.75);
const train = groups.slice(0, cut), hold = groups.slice(cut);
/* 类平衡采样：键级目标在 ji 占多数时会塌成"永远 ji"（2000 步实测 41.7% = ji 频率）⇒ 每批按键均匀抽。 */
const byKey = new Map();
for (const g of train) { if (!byKey.has(g.wantKey)) byKey.set(g.wantKey, []); byKey.get(g.wantKey).push(g); }
const keyList = Array.from(byKey.keys());
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
  let used = 0;
  for (let b = 0; b < BATCH; b++) {
    const g = byKey.get(keyList[Math.floor(rnd() * keyList.length)])[0] || train[0];
    const poolK = byKey.get(g.wantKey); const g2 = poolK[Math.floor(rnd() * poolK.length)];
    const { a, t } = acc(g2, pv);
    if (t.kProb[g2.wantKey] == null) continue;
    const u = dLogKeyP(g2.wantKey, a.logits, g2.keys, TEMP, t);
    for (let j = 0; j < u.length; j++) u[j] = -u[j];   /* 最小化 −log P ⇒ 传负导数（与 pg-train 的梯度约定对齐） */
    tapeBackward(g2.tape, pv, ly, a, u, grad);
    used++;
  }
  if (!used) return;
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
writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(packed) + ';\n', 'utf8');
console.log('产物 → ' + OUT);
