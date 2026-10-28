#!/usr/bin/env node
/* rank-signal.mjs — 「组内排序到底学不学得出来」的**直接实验**（DS · 2026-10-28 晚）
 *
 * 为什么做它：千问 §E817/§E819b/§E820 三把尺给出的都是「分不开 / 读不出」，其中没有一个回答**这个**问题：
 *   给同一个 235 维特征、同一批组内标签，**换一个线性头去拟合**，能不能比现役网络 / 随机挑一手更好？
 *   这三者回答的是不同的东西：§E819b 问「现役打分器有没有判别力」，本条问「这份输入里有没有可学的组内信号」。
 *
 * 做法：读 §E197 那台尺的 dump（`probe-myopia-regret --dump=`，每行 = 一个候选：x(235) + 模拟赢率 win）：
 *   ① 按 (seed,env,g,n,round,pk) 分组；组内中心化 y = win − mean(win)（消掉「这一局整体好不好」）；
 *   ② 在 train 组上拟合**岭回归**（特征 z-score 用 train 的均值/方差）⇒ w；
 *   ③ 在 test 组上用 w 挑一手，记 regret = max(win) − win[pick]；同一批组上并排印 **现役 net** 与 **随机挑**；
 *   ④ 配对 bootstrap（按组重采样）给三者差的 SE ⇒ 只有「头 vs 随机」显著才算「有信号」。
 *
 * 三条款（引用必带）：
 *   · 这是**线性头**的上限，不是「任何模型都学不出」的证明；
 *   · 标签是「一手偏离 + 现有策略延续」的模拟赢率（继承 §E195 的限制）；
 *   · 组数 < 30 或平均候选 < 2 ⇒ 判「读不出」（exit 2），不印"0 改善"。
 *
 * 用法：node tools/proto2/rank-signal.mjs --train=scratch/e820-train.jsonl --test=scratch/e820-test.jsonl [--arm=A0] [--label=win] [--l2=1.0] [--json]
 */
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
function arg(k, d) { const f = argv.find((a) => a.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; }
const TRAIN = arg('train', ''), TEST = arg('test', '');
const ARM = arg('arm', ''), LABEL = arg('label', 'win');
const L2 = Number(arg('l2', 1.0));
const MINGAP = Number(arg('minGap', 0));
const JSONOUT = argv.includes('--json');
if (!TRAIN || !TEST) { console.error('⛔ 需要 --train= 与 --test=（JSONL，来自 probe-myopia-regret --dump=）'); process.exit(2); }

function loadRows(p) {
  return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const GKEY = (r) => [r.seed, r.env, r.g, r.n, r.round, r.pk].join('|');

function groupsOf(rows) {
  const g = new Map();
  for (const r of rows) {
    const k = GKEY(r);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(r);
  }
  /* 组内不足 2 个候选、或标签无差（全并列）⇒ 这一组学不到也判不出，剔除并计数 */
  let drop = 0;
  for (const [k, arr] of g) {
    const us = arr.map((r) => Number(r[LABEL]));
    if (arr.length < 2 || Math.max(...us) - Math.min(...us) < (MINGAP || 1e-9)) { g.delete(k); drop++; }
  }
  return { g, drop };
}

let tr = loadRows(TRAIN), te = loadRows(TEST);
if (ARM) { tr = tr.filter((r) => r.arm === ARM); te = te.filter((r) => r.arm === ARM); }
if (!tr.length || !te.length) { console.error('⛔ 过滤后没有行（检查 --arm=' + ARM + ' 是否存在）'); process.exit(2); }
const F = tr[0].x.length;
const T = groupsOf(tr), E = groupsOf(te);
if (E.g.size < 30) { console.error('⛔ test 组数 ' + E.g.size + ' < 30 ⇒ 判「读不出」（不印 0 改善）'); process.exit(2); }

/* ===== 拟合：组内中心化的岭回归（z-score 用 train 统计） ===== */
const X = [], Y = [];
for (const arr of T.g.values()) {
  const us = arr.map((r) => Number(r[LABEL]));
  const mu = us.reduce((a, b) => a + b, 0) / us.length;
  arr.forEach((r, i) => { X.push(r.x.slice()); Y.push(us[i] - mu); });
}
const n = X.length;
const mean = new Float64Array(F), sd = new Float64Array(F);
for (const x of X) for (let j = 0; j < F; j++) mean[j] += x[j] / n;
for (const x of X) for (let j = 0; j < F; j++) { const d = x[j] - mean[j]; sd[j] += (d * d) / n; }
for (let j = 0; j < F; j++) sd[j] = Math.sqrt(sd[j]) || 1;
const Z = X.map((x) => { const z = new Float64Array(F); for (let j = 0; j < F; j++) z[j] = (x[j] - mean[j]) / sd[j]; return z; });
/* 法方程（F=235 ⇒ 235² 矩阵，闭式解即可） */
const A = Array.from({ length: F }, () => new Float64Array(F));
const b = new Float64Array(F);
for (let i = 0; i < n; i++) { const z = Z[i], y = Y[i]; for (let p = 0; p < F; p++) { b[p] += z[p] * y; const zp = z[p]; const row = A[p]; for (let q = 0; q < F; q++) row[q] += zp * z[q]; } }
for (let p = 0; p < F; p++) A[p][p] += L2;
function solve(M, rhs) {
  const N = rhs.length;
  const aug = M.map((row, i) => { const r = new Float64Array(N + 1); r.set(row); r[N] = rhs[i]; return r; });
  for (let c = 0; c < N; c++) {
    let piv = c;
    for (let r = c + 1; r < N; r++) if (Math.abs(aug[r][c]) > Math.abs(aug[piv][c])) piv = r;
    if (Math.abs(aug[piv][c]) < 1e-12) continue;
    const tmp = aug[c]; aug[c] = aug[piv]; aug[piv] = tmp;
    const d = aug[c][c];
    for (let k = c; k <= N; k++) aug[c][k] /= d;
    for (let r = 0; r < N; r++) { if (r === c) continue; const f = aug[r][c]; if (!f) continue; for (let k = c; k <= N; k++) aug[r][k] -= f * aug[c][k]; }
  }
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) out[i] = aug[i][N];
  return out;
}
const w = solve(A, b);

/* ===== 评测：同一批 test 组上三个打分器并排 ===== */
function pickBy(arr, score) { let best = -Infinity, at = 0; arr.forEach((r, i) => { const s = score(r); if (s > best) { best = s; at = i; } }); return at; }
const headScore = (r) => { let s = 0; for (let j = 0; j < F; j++) s += w[j] * ((r.x[j] - mean[j]) / sd[j]); return s; };
const netScore = (r) => Number(r.net);
const regretOf = (arr, at) => { const us = arr.map((r) => Number(r[LABEL])); return Math.max(...us) - us[at]; };
const randomRegret = (arr) => { const us = arr.map((r) => Number(r[LABEL])); const mu = us.reduce((a, b) => a + b, 0) / us.length; return Math.max(...us) - mu; };
const gs = [...E.g.values()];
const headR = gs.map((arr) => regretOf(arr, pickBy(arr, headScore)));
const netR = gs.map((arr) => regretOf(arr, pickBy(arr, netScore)));
const randR = gs.map((arr) => randomRegret(arr));
const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const meanOf = { head: m(headR), net: m(netR), rand: m(randR) };
/* 配对 bootstrap（按组重采样；同一批组上三个打分器各取自己的 regret） */
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function boot(diff) {
  const B = [];
  for (let t = 0; t < 2000; t++) {
    let s = 0;
    for (let i = 0; i < diff.length; i++) s += diff[(rnd() * diff.length) | 0];
    B.push(s / diff.length);
  }
  B.sort((a, b) => a - b);
  return { mean: m(diff), lo: B[50], hi: B[1950] };
}
const dHead = headR.map((v, i) => v - randR[i]);
const dNet = netR.map((v, i) => v - randR[i]);
const bHead = boot(dHead), bNet = boot(dNet);

const out = {
  F, trainGroups: T.g.size, testGroups: E.g.size, dropped: { train: T.drop, test: E.drop },
  meanRegret: meanOf, headVsRand: bHead, netVsRand: bNet,
  headEveryGroupBetter: headR.filter((v) => v < 0).length,
  uniqueMax: gs.filter((arr) => { const u = arr.map((r) => Number(r[LABEL])).sort((a, b) => b - a); return u.length > 1 && u[0] - u[1] > 1e-9; }).length,
};
if (JSONOUT) { console.log(JSON.stringify(out)); process.exit(0); }
console.log('特征 ' + F + ' 维 ‖ train 组 ' + T.g.size + '（剔 ' + T.drop + '）‖ test 组 ' + E.g.size + '（剔 ' + E.drop + '）');
console.log('test 组上的平均 regret（越小越好，0 = 每手都挑到 oracle）：');
console.log('  线性头 = ' + meanOf.head.toFixed(3) + 'pt ‖ 现役 net = ' + meanOf.net.toFixed(3) + 'pt ‖ 随机 = ' + meanOf.rand.toFixed(3) + 'pt');
console.log('  线性头 − 随机 = ' + bHead.mean.toFixed(3) + 'pt  [95% ' + bHead.lo.toFixed(3) + ', ' + bHead.hi.toFixed(3) + ']');
console.log('  现役net − 随机 = ' + bNet.mean.toFixed(3) + 'pt  [95% ' + bNet.lo.toFixed(3) + ', ' + bNet.hi.toFixed(3) + ']');
console.log(bHead.hi < 0 ? '  ⇒ 线性头**显著好于随机**：这份输入里存在可学的组内信号（下一格看它离 oracle 多远）' : '  ⇒ 线性头与随机**分不开**：要么输入里没有这份信号，要么 235 维线性头学不动（组数 ' + T.g.size + ' 太少）');
