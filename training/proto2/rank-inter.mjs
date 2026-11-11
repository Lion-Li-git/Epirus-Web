#!/usr/bin/env node
/* rank-inter.mjs — 一把**能读 state×action** 的组内排序尺（千问 · 2026-10-29 夜）
 *
 * 为什么不用隐层头量交互（`rank-signal --hidden`）：10-29 00:2x 实测那台是**凸性不够 + 抖动太大**——
 *   同一个配置换 `--seed` 读数差 0.010pt，两次的隐层头都**输给**线性头，而我关心的效应本身就是 0.01~0.03pt
 *   ⇒ 拿它判"state 值多少钱"会把优化器的不稳定读成结论。
 * 这把尺是**闭式岭回归**，没有训练过程 ⇒ 无 seed 抖动、逐位可复现。原理一句话：
 *   同一决策内 state 段逐字相同 ⇒ 组内中心化后线性项对它恒给 0 贡献；而
 *   `center(x_s · x_a) = x_s · center(x_a)` ⇒ 把"state 标量 × 动作特征"当设计矩阵，
 *   解出来的等价形式是**随局面改变系数的动作读出** w(a) = w₀ + Σ_s v_s·x_s —— 这正是 2.0 集合编码要做的事，
 *   但现在它是线性可解的。
 *
 * 三条款（引用必带）：
 *   · 交互项选哪几列 state 是在**训练折**上选的（不看测试折的标签）；
 *   · 这是"一阶 state×action"的下限尺，不是任意模型的上限；
 *   · 标签 = 一手偏离 + 现有策略延续的模拟赢率（继承 §E195 限制 1）。
 *
 * 有牙自检：`--selfcheck=inter` 把标签换成"某枚 state 标量 × 某枚动作标量 + 噪声"——
 *   线性头必须**读不出**（分不开），交互头必须**读得出**（显著）。两头只要有一条不成立 ⇒ exit 3 判尺是摆设。
 *
 * 用法：node tools/proto2/rank-inter.mjs --dump=a.jsonl[,b.jsonl] [--arm=A0] [--k=8] [--l2=1] [--folds=5] [--selfcheck=lin|inter]
 */
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const DUMPS = String(arg('dump', '')).split(',').filter(Boolean);
const ARM = arg('arm', '');
const K = Math.max(1, Number(arg('k', 8)) || 8);
const L2 = Number(arg('l2', 1)) || 1;
const FOLDS = Math.max(2, Number(arg('folds', 5)) || 5);
const SC = arg('selfcheck', '');
if (!DUMPS.length) { console.error('⛔ 需要 --dump=a.jsonl[,b.jsonl]'); process.exit(2); }

let rows = [];
for (const p of DUMPS) for (const l of readFileSync(p, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); if (!ARM || r.arm === ARM) rows.push(r); }
if (!rows.length) { console.error('⛔ 过滤后没有行'); process.exit(2); }
const F = rows[0].x.length;
const GKEY = (r) => [r.seed, r.env, r.g, r.n, r.round, r.pk].join('|');
const groups = new Map();
for (const r of rows) { const k = GKEY(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
const gs = [...groups.values()].filter((a) => a.length >= 2);
if (gs.length < 60) { console.error('⛔ 组数 ' + gs.length + ' < 60 ⇒ 读不出（不印判语）'); process.exit(2); }

/* 列集合：A = 在任何组内会变的列（候选侧）；S = 组内恒定但跨组变化的列（局面侧） */
const inA = new Array(F).fill(false), inS = new Array(F).fill(false);
for (const arr of gs) {
  for (let j = 0; j < F; j++) {
    const v0 = arr[0].x[j];
    let differs = false;
    for (const r of arr) if (Math.abs(r.x[j] - v0) > 1e-9) { differs = true; break; }
    if (differs) inA[j] = true; else inS[j] = true;
  }
}
const A = []; for (let j = 0; j < F; j++) if (inA[j]) A.push(j);
const Sall = []; for (let j = 0; j < F; j++) if (inS[j]) Sall.push(j);

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const lab = (r) => Number(r.win);
function center(arr) {                       /* 组内中心化后的动作设计行 + 组均值 state */
  const us = arr.map(lab), mu = mean(us);
  const am = A.map((j) => mean(arr.map((r) => r.x[j])));
  const Ac = arr.map((r, i) => ({ y: us[i] - mu, a: A.map((j, q) => r.x[j] - am[q]), s: arr[0].x }));
  return Ac;
}
function solve(trainDesign, selS, withInter) {
  /* 设计行：无交互 = a；有交互 = a ⊕ (s_sel ⊗ a_centered) */
  const rowsX = [], ys = [];
  for (const des of trainDesign) for (const d of des) {
    let v = d.a.slice();
    if (withInter) { for (const sj of selS) { const xv = d.s[sj]; for (let q = 0; q < d.a.length; q++) v.push(xv * d.a[q]); } }
    rowsX.push(v); ys.push(d.y);
  }
  const P = rowsX[0].length, n = rowsX.length;
  const gmean = new Float64Array(P), gsd = new Float64Array(P);
  for (const v of rowsX) for (let j = 0; j < P; j++) gmean[j] += v[j] / n;
  for (const v of rowsX) for (let j = 0; j < P; j++) { const d = v[j] - gmean[j]; gsd[j] += d * d / n; }
  for (let j = 0; j < P; j++) gsd[j] = Math.sqrt(gsd[j]) || 1;
  const M = Array.from({ length: P }, () => new Float64Array(P + 1));
  for (let i = 0; i < n; i++) {
    const z = new Float64Array(P); for (let j = 0; j < P; j++) z[j] = (rowsX[i][j] - gmean[j]) / gsd[j];
    for (let p = 0; p < P; p++) { M[p][P] += z[p] * ys[i]; for (let q = 0; q < P; q++) M[p][q] += z[p] * z[q]; }
  }
  for (let p = 0; p < P; p++) M[p][p] += L2;
  for (let c = 0; c < P; c++) {
    let piv = c; for (let r = c + 1; r < P; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) continue;
    const t = M[c]; M[c] = M[piv]; M[piv] = t;
    const d = M[c][c]; for (let k2 = c; k2 <= P; k2++) M[c][k2] /= d;
    for (let r = 0; r < P; r++) { if (r === c) continue; const f = M[r][c]; if (!f) continue; for (let k2 = c; k2 <= P; k2++) M[r][k2] -= f * M[c][k2]; }
  }
  const w = new Float64Array(P); for (let i = 0; i < P; i++) w[i] = M[i][P];
  return { w, gmean, gsd, P, withInter, selS };
}
function modelScore(m, d) {                   /* d = {a: 中心化动作, s: 原始 state} */
  let v = d.a.slice();
  if (m.withInter) for (const sj of m.selS) { const xv = d.s[sj]; for (let q = 0; q < d.a.length; q++) v.push(xv * d.a[q]); }
  let s = 0; for (let j = 0; j < m.P; j++) s += m.w[j] * ((v[j] - m.gmean[j]) / m.gsd[j]);
  return s;
}
/* 并列最大者取平均 regret（期望，不抽样）——dump 的池是按现役 net 降序排的，
 * 取下标最小会系统性挑到 net 的第一名 ⇒ 所有打分器的破号都必须按期望算。 */
function regretOf(sv, u) {
  const top = Math.max(...sv);
  const tied = sv.map((v, i) => (Math.abs(v - top) < 1e-12 ? i : -1)).filter((i) => i >= 0);
  const mx = Math.max(...u);
  return tied.reduce((a, i) => a + (mx - u[i]), 0) / tied.length;
}
function selectStateCols(trainDesign, linModel) {
  /* ⚑ 上一版按 resid·x_s·(a·w) 筛 ⇒ **线性头失明时 a·w ≈ 0，全体得分塌成 0**，注入列根本选不出来
   *   （10-29 00:5x 实测：筛出的 6 列里没有注入列 ⇒ 牙不成立）。改成直接把残差与交互特征做相关：
   *   对每枚 state 列 s 与每枚动作列 q 累计 Σ_i resid_i·x_s(i)·a_iq，再按 s 取范数 ⇒ 失明时 resid≈y，照样筛得出。 */
  const na = A.length, ns = Sall.length;
  const acc = new Float64Array(ns * na);
  let nrows = 0;
  for (const des of trainDesign) {
    if (des.length < 3) continue;
    const t = des.map((d) => { let s = 0; for (let j = 0; j < na; j++) s += linModel.w[j] * ((d.a[j] - linModel.gmean[j]) / linModel.gsd[j]); return s; });
    for (let i = 0; i < des.length; i++) {
      const v = des[i].y - t[i], d = des[i];
      nrows++;
      for (let p = 0; p < ns; p++) {
        const xs = d.s[Sall[p]];
        if (xs === 0) continue;
        const base = p * na;
        for (let q = 0; q < na; q++) acc[base + q] += v * xs * d.a[q];
      }
    }
  }
  const score = [];
  for (let p = 0; p < ns; p++) {
    let n2 = 0; for (let q = 0; q < na; q++) { const v = acc[p * na + q] / Math.max(1, nrows); n2 += v * v; }
    score.push({ j: Sall[p], v: Math.sqrt(n2) });
  }
  score.sort((x, y) => y.v - x.v);
  const sel = score.slice(0, K).filter((o) => o.v > 0).map((o) => o.j);
  return sel.length ? sel : [score[0].j];
}

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const buckets = Array.from({ length: FOLDS }, () => []);
for (const [k, arr] of groups) if (arr.length >= 2) buckets[hash(k) % FOLDS].push(arr);

/* 合成信号自检用的两列（state 列 × 动作列各取方差最大的一枚） */
let sJ = Sall[0], aJ = A[0];
if (SC) {
  const spread = (cols) => cols.map((j) => { const v = gs.map((arr) => arr[0].x[j]); return { j, sd: Math.sqrt(mean(v.map((x) => x * x)) - mean(v) ** 2) }; }).sort((p, q) => q.sd - p.sd);
  if (Sall.length) sJ = spread(Sall)[0].j;
  if (A.length) aJ = spread(A)[0].j;
}
/* ===== 有牙自检：`--selfcheck=injected`（10-29 00:4x 重做）=====
 * 前一版拿真实 dump 里的 state 列构造 `sign(x_s)·x_a` ⇒ **不成立**：状态列与候选集合的形状本来就相关
 *   （费用、可负担性都由局面决定），线性头顺着这条相关就读出来了，于是"线性读不出"这个前提被污染。
 * 这一版注入一枚**与任何特征都无关**的 group 级列 c_g（独立 LCG 抽 ±1），标签 y = c_g·a_J + 噪声：
 *   线性头只能学 E[c_g]·(动作方向) = 0 ⇒ 该与随机分不开；交互头把 c_g 选进交互列 ⇒ 该显著读出。
 *   另外要求它真的把注入列选进 selS（否则"读出"是靠别的相关维蒙的）。 */
let INJ = -1;
if (SC === 'injected') {
  let s2 = 20261029 >>> 0;
  const rr = () => { s2 = (s2 * 1664525 + 1013904223) >>> 0; return s2 / 4294967296; };
  /* 挑一枚组内方差最大的动作列当 a_J */
  let bestJ = A[0], bestV = -1;
  for (const j of A) {
    let v = 0; for (const arr of gs) { const m = mean(arr.map((r) => r.x[j])); v += mean(arr.map((r) => (r.x[j] - m) * (r.x[j] - m))); }
    if (v > bestV) { bestV = v; bestJ = j; }
  }
  aJ = bestJ;
  const cg = new Map();
  for (const [k, arr] of groups) cg.set(k, rr() < 0.5 ? -1 : 1);
  for (const r of rows) r.x.push(cg.get(GKEY(r)));
  INJ = F;                                    /* 注入列的下标 */
  const sv = gs.map((arr) => arr[0].x[INJ]);
  for (const arr of gs) {
    const c = arr[0].x[INJ];
    const vals = arr.map((r) => c * r.x[aJ] + 0.3 * (Math.random() - 0.5));
    const mu = mean(vals); arr.forEach((r, i) => { r.win = vals[i] - mu; });
  }
  console.log('⚑ 注入自检：新列 x[' + INJ + '] = 每组的独立 ±1（与所有特征无关）‖ 标签 y = c_g × x[' + aJ + '] + 噪声（x[' + aJ + '] 是组内方差最大的动作列）');
  console.log('  ⇒ 线性头**该与随机分不开**（它只能学 E[c_g]=0 的方向），交互头**该显著读出**，且必须把注入列选进交互列');
  /* 重算列集合（多了一枚 S 列） */
  inA.length = F + 1; inS.length = F + 1; inA[INJ] = false; inS[INJ] = true;
  Sall.push(INJ);
} else if (SC === 'inter' || SC === 'lin') {
  console.error('⛔ `--selfcheck=inter|lin` 已被取代（那两版的前提不成立，见文件头）——请用 --selfcheck=injected');
  process.exit(2);
}

const st = { lin: [], inter: [], net: [], rand: [] };
let selLog = [];
for (let f = 0; f < FOLDS; f++) {
  const testG = buckets[f], trainG = buckets.filter((_, i) => i !== f).flat();
  if (!testG.length || !trainG.length) continue;
  const td = trainG.map(center);
  const mLin = solve(td, [], false);
  const sd = selectStateCols(td, mLin);
  if (f === 0) selLog = sd;
  const mInt = solve(td, sd, true);
  for (const arr of testG) {
    const des = center(arr), u = des.map((d) => d.y);
    st.lin.push(regretOf(des.map((d) => modelScore(mLin, d)), u));
    st.inter.push(regretOf(des.map((d) => modelScore(mInt, d)), u));
    st.net.push(regretOf(arr.map((r) => Number(r.net)), u));
    const mx = Math.max(...u), mn = mean(u);
    st.rand.push(mx - mn);
  }
}
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function boot(diff) { const B = []; for (let t = 0; t < 2000; t++) { let s = 0; for (let i = 0; i < diff.length; i++) s += diff[(rnd() * diff.length) | 0]; B.push(s / diff.length); } B.sort((a, b) => a - b); return { mean: mean(diff), lo: B[50], hi: B[1950] }; }
const dInter = st.inter.map((v, i) => v - st.rand[i]), dLin = st.lin.map((v, i) => v - st.rand[i]);
const dIaL = st.inter.map((v, i) => v - st.lin[i]);
const bInt = boot(dInter), bLin = boot(dLin), bIaL = boot(dIaL);
const f3 = (x) => x.toFixed(3);

console.log('# rank-inter ‖ dump ' + DUMPS.join(' + ') + (ARM ? ' ‖ arm=' + ARM : '') + ' ‖ 行 ' + rows.length + ' ‖ 组 ' + gs.length + (SC ? ' ‖ **合成自检=' + SC + '**' : ''));
console.log('列集合：随候选变 |A|=' + A.length + ' ‖ 组内恒定的局面列 |S|=' + Sall.length + ' ‖ 选来交互的 state 列 K=' + selLog.length + '（列号 ' + selLog.slice(0, 10).join(',') + '）');
console.log('test 组平均 regret（越小越好）：线性头 ' + f3(mean(st.lin)) + 'pt ‖ 交互头 ' + f3(mean(st.inter)) + 'pt ‖ 现役 net ' + f3(mean(st.net)) + 'pt ‖ 随机 ' + f3(mean(st.rand)) + 'pt');
console.log('  线性头 − 随机 = ' + f3(bLin.mean) + ' [' + f3(bLin.lo) + ', ' + f3(bLin.hi) + ']');
console.log('  交互头 − 随机 = ' + f3(bInt.mean) + ' [' + f3(bInt.lo) + ', ' + f3(bInt.hi) + ']');
console.log('  ⭐ 交互头 − 线性头 = ' + f3(bIaL.mean) + ' [' + f3(bIaL.lo) + ', ' + f3(bIaL.hi) + ']（负 = 把 state 乘进动作里确实买到了东西）');
if (SC === 'injected') {
  const linBlind = bLin.hi >= 0, interSees = bInt.hi < 0, picked = selLog.indexOf(INJ) >= 0;
  console.log('  筛出来的交互列是否包含注入列：' + (picked ? '✔ 是' : '⛔ 否') + ' ‖ 线性头' + (linBlind ? '如期读不出' : '**竟然读出了**') + ' ‖ 交互头' + (interSees ? '如期读出' : '**读不出**'));
  if (!linBlind || !interSees || !picked) { console.log('  ⛔ 牙不成立 ⇒ 这把尺判不了"state×action 值多少钱"，别拿它的 null 下判语'); process.exit(3); }
  console.log('  ✔ 牙成立：只活在交互里的信号被读出（交互−随机 ' + f3(bInt.mean) + ' CI 不含 0 ‖ 线性−随机 ' + f3(bLin.mean) + ' [' + f3(bLin.lo) + ', ' + f3(bLin.hi) + '] 分不开）');
}
console.log('⚑ 三条引用条款：一阶交互的下限尺（不是任意模型的上限）‖ 选 state 列只用训练折 ‖ 标签是"一手偏离 + 现有策略延续"的模拟赢率');
process.exit(0);
