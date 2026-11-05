#!/usr/bin/env node
/* proj20-probe.mjs —— 39 枚那张小表：哪种二维布局真的分得开（11-05 中午 · 千问）
 * 背景：逐视图重投影之后，t-SNE 在 N=39 上给 kNN@7=0.15~0.29，而**瞎猜就有 0.184** ⇒ 等于没分。
 * 这里不改任何落盘，只把三种布局放在同一把尺（同一份 12 维秩-正态分距离）上对拍：
 *   ① t-SNE（现役，perp 扫一遍）
 *   ② 经典 MDS（双中心化 + 特征分解，小 N 良态）
 *   ③ PCA-2
 * 判据：kNN@k 保住率（k=min(10,N/5)）+ 对瞎猜基线 k/(N−1) 的倍数 + Spearman(HD,2D)。
 * 用法：node scratch/evofix-1105/proj20-probe.mjs [--in=champion-map/coords-view-20.tsv]
 */
import { readFileSync } from 'node:fs';

const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const FEAT = ['dmg', 'heavy', 'holo', 'rounds', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys',
  'charges', 'waste', 'noThreatStance', 'fieldAAtk'];

const L = readFileSync(arg('in', 'champion-map/coords-view-20.tsv'), 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const H = L[0].split('\t');
const rows = L.slice(1).map(l => { const c = l.split('\t'); const o = {}; H.forEach((k, i) => o[k] = c[i]); return o; });
const N = rows.length;
const K = Math.max(3, Math.min(10, Math.floor(N / 5)));
const chance = K / (N - 1);

/* 秩 → 正态分（与 proj-tsne 逐字同族：中位秩，抗并列） */
function erfinv(x) {
  const a = [0.886226899, -1.645349621, 0.914624893, -0.140543331];
  const b = [-2.118377725, 1.442710462, -0.329097515, 0.012229801];
  const c = [-1.970840454, -1.624906493, 3.429567803, 1.641345312];
  const d = [1.011173315, 0.223801166, 0.037200478];
  const s = x < 0 ? -1 : 1, ax = Math.abs(x), t = 1 - ax;
  if (ax > 1 - 1e-12) return s * 6;
  const u = t * (b[0] + t * (b[1] + t * (b[2] + t * b[3]))) / (1 + t * (a[1] + t * (a[2] + t * a[3])));
  const r = t * (d[0] + t * (d[1] + t * (d[2]))) / (1 + t * (c[1] + t * (c[2] + t * c[3])));
  return s * (u + r);
}
function normalScores(col) {
  const n = col.length, out = new Array(n);
  const o = col.map((v, i) => [v, i]).sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  let t = 0;
  while (t < n) {
    let u = t; while (u + 1 < n && o[u + 1][0] === o[t][0]) u++;
    const p = ((t + u) / 2 + 0.5) / n, v = Math.SQRT2 * erfinv(2 * p - 1);
    for (let q = t; q <= u; q++) out[o[q][1]] = v;
    t = u + 1;
  }
  return out;
}
const Z = FEAT.map(k => normalScores(rows.map(r => +r[k])));
const Zc = Z.map(c => { const m = c.reduce((s, v) => s + v, 0) / N; return c.map(v => v - m); });
const D2 = new Float64Array(N * N);
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
  let s = 0; for (let d = 0; d < Zc.length; d++) { const q = Zc[d][i] - Zc[d][j]; s += q * q; }
  D2[i * N + j] = D2[j * N + i] = s;
}
const HD = rows.map((_, i) => rows.map((_, j) => Math.sqrt(D2[i * N + j])));

function score(P) {
  const d = rows.map((_, i) => rows.map((_, j) => Math.hypot(P[0][i] - P[0][j], P[1][i] - P[1][j])));
  const nbr = (M) => M.map((row, i) => row.map((v, j) => [v, j]).filter(t => t[1] !== i)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, K).map(t => t[1]));
  const nA = nbr(d), nB = nbr(HD);
  let rec = 0; for (let i = 0; i < N; i++) { const s = new Set(nA[i]); let c = 0; for (const j of nB[i]) if (s.has(j)) c++; rec += c / K; }
  rec /= N;
  /* Spearman on all ordered pairs (N 小 ⇒ 全对全，不用抽样) */
  const aa = [], bb = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { aa.push(HD[i][j]); bb.push(d[i][j]); }
  const rk = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const o = new Array(a.length); idx.forEach((t, r) => o[t[1]] = r); return o; };
  const ra = rk(aa), rb = rk(bb), n = aa.length;
  const ma = ra.reduce((s, v) => s + v, 0) / n, mb = rb.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const x = ra[i] - ma, y = rb[i] - mb; sxy += x * y; sxx += x * x; syy += y * y; }
  return { knn: rec, sp: sxy / Math.sqrt(sxx * syy), ratio: rec / chance };
}
const norm = (a) => { const mn = Math.min(...a), mx = Math.max(...a), sp = mx - mn || 1; return a.map(v => (v - mn) / sp * 2 - 1); };

/* ② 经典 MDS：双中心化 + 特征分解（取最大两维） */
function mds() {
  const D = D2, mRow = new Array(N).fill(0), mCol = new Array(N).fill(0);
  let g = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { mRow[i] += D[i * N + j]; mCol[j] += D[i * N + j]; g += D[i * N + j]; }
  const B = new Float64Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) B[i * N + j] = D[i * N + j] - mRow[i] / N - mCol[j] / N + g / (N * N);
  /* 幂迭代取前两维（N=39 ⇒ Jacobi 没必要，两次正交化足够） */
  const V = [];
  let W = [];
  for (let d = 0; d < 2; d++) {
    let v = new Array(N).fill(0).map((_, i) => Math.sin(i * (d + 1) * 0.7) + 0.1);
    for (let it = 0; it < 400; it++) {
      const u = new Array(N).fill(0);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) u[i] += B[i * N + j] * v[j];
      for (const w of V) { let dot = 0; for (let i = 0; i < N; i++) dot += u[i] * w[i]; for (let i = 0; i < N; i++) u[i] -= dot * w[i]; }
      const nn = Math.hypot(...u); v = u.map(x => x / nn);
    }
    V.push(v);
  }
  return V.map(v => norm(v));
}
/* ③ PCA-2：对 Zc 做协方差幂迭代 */
function pca() {
  const C = new Float64Array(Zc.length * Zc.length);
  for (let a = 0; a < Zc.length; a++) for (let b = 0; b < Zc.length; b++) { let s = 0; for (let i = 0; i < N; i++) s += Zc[a][i] * Zc[b][i]; C[a * Zc.length + b] = s / N; }
  const out = [];
  for (let d = 0; d < 2; d++) {
    let v = new Array(Zc.length).fill(0).map((_, i) => (i === d ? 1 : 0.2));
    for (let it = 0; it < 300; it++) {
      const u = new Array(Zc.length).fill(0);
      for (let a = 0; a < Zc.length; a++) for (let b = 0; b < Zc.length; b++) u[a] += C[a * Zc.length + b] * v[b];
      for (const w of out) { let dot = 0; for (let i = 0; i < w.length; i++) dot += u[i] * w[i]; for (let i = 0; i < u.length; i++) u[i] -= dot * w[i]; }
      const nn = Math.hypot(...u) || 1; v = u.map(x => x / nn);
    }
    out.push(v);
  }
  return out.map(v => norm(Zc.map((_, i) => Zc.reduce((s, c, a) => s + c[i] * v[a], 0))));
}

console.log('N=' + N + ' ‖ k=' + K + ' ‖ 瞎猜基线 k/(N−1)=' + chance.toFixed(3));
const ms = mds(), sM = score(ms);
const ps = pca(), sP = score(ps);
console.log('  MDS-2      kNN@' + K + '=' + sM.knn.toFixed(3) + ' ⇒ ' + sM.ratio.toFixed(1) + '× ‖ Spearman=' + sM.sp.toFixed(3));
console.log('  PCA-2      kNN@' + K + '=' + sP.knn.toFixed(3) + ' ⇒ ' + sP.ratio.toFixed(1) + '× ‖ Spearman=' + sP.sp.toFixed(3));
