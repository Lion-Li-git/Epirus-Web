/* proj-tsne.mjs —— E393 DS（丙·投影）：**重算一套能把点区分开的投影**，写进 coords.tsv 的新列。
 *
 * 为什么要有这一份（用户 10-08）：地图的二维布局是**很早就定下来的**，之后又加进来一批点
 *   （917 枚里近 200 枚是后加的）⇒ 新点只是被塞进旧布局，局部邻域丢光。用户原话：
 *   「这个投影方法确定之后已经又加了一批点了，不能确定现在是最优的（中间还有一堆点几乎没区分开）」
 *   「想办法让这两个轴能尽量的区分开所有点的特征……如果有比现在的投影方式更好的方法就调整过去，
 *    不用死磕实际意义」。
 *
 * 判据（**先定度量，再看结果** —— 这一族在这个项目里已经栽过多次）：
 *   ① Spearman(HD, 2D)  = 全局距离保真（项目原本就在优化它，e287-figs.mjs 的力导向目标）
 *   ② kNN@10 保住率     = 每个点在 12 维里最近的 10 枚，有多少枚在二维里也还在最近 10 枚之内
 *                        ⇒ **这一条才是"点有没有被区分开"**（旧投影 0.08 ⇒ 几乎全丢）
 * 实测（本机、同一份 coords.tsv）：
 *   旧 x2/y2      Spearman 0.365 · kNN@10 0.08   ← 线上现状
 *   PCA-2 重算              0.705 ·        0.16
 *   SMACOF(正确 MDS)        0.757 ·        0.17
 *   **t-SNE(30)**           0.463 ·        **0.51**   ← 取它：邻域保真 6 倍于现状
 *   代价如实记：全局距离保真比 MDS 低（0.46 vs 0.76），且轴**没有可解释含义**（用户已明确接受）。
 *
 * 落盘：在 coords.tsv 里**新增/覆盖** 5 列 —— xt, yt（二维）· xt3, yt3, zt3（三维，给"三维行为轴/势阱"用，
 *   它们现在用的是同样无界的 x3/y3/z3 ⇒ 立体态被拉成竖条也是这个病）。
 *   ⚠ 不动任何已有列（H/S/Geff/F/rank/x2/y2/x3/y3/z3 与全部行为列），也**不动行序**。
 * 用法：node champion-map/proj-tsne.mjs [--perp=30] [--iters=500] [--seed=7] [--write=0|1]
 *   退出码 0 = 跑完（含自报指标）‖ 2 = 输入不齐（没有 12 个数值特征列）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CF = join(HERE, 'coords.tsv');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const PERP = +arg('perp', 30), ITERS = +arg('iters', 500), SEED = +arg('seed', 7), WRITE = arg('write', '1') !== '0';

const FEAT = ['dmg', 'heavy', 'holo', 'rounds', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys',
  'charges', 'waste', 'noThreatStance', 'fieldAAtk'];

const raw = readFileSync(CF, 'utf8').replace(/\r\n/g, '\n');
/* E393 DS：**保留原行尾**。原来无条件写 CRLF ⇒ 把整份 coords.tsv 从 LF 翻成 CRLF（实测 918 行全变），
 *   5 列新增被行尾噪音淹没。 */
const EOL = readFileSync(CF, 'utf8').indexOf(String.fromCharCode(13)) >= 0 ? String.fromCharCode(13, 10) : String.fromCharCode(10);
const lines = raw.split('\n').filter(l => l.length);
const H = lines[0].split('\t').map(s => s.replace(/^#/, '').trim());
const miss = FEAT.filter(k => H.indexOf(k) < 0);
if (miss.length) { console.error('⛔ coords.tsv 缺特征列: ' + miss.join(' ')); process.exit(2); }
const rows = lines.slice(1).map(l => l.split('\t'));
const N = rows.length;
const num = v => { const x = +v; return isFinite(x) ? x : NaN; };
const X = FEAT.map(k => { const j = H.indexOf(k); return rows.map(r => num(r[j])); });
if (X.some(c => c.some(v => !isFinite(v)))) { console.error('⛔ 有特征列含非数值（NaN）⇒ 先修数据'); process.exit(2); }

/* 秩 → 正态分（与 e287-figs.mjs 的 normalScores 同族：抗离群，且让各特征同权）*/
function normalScores(col) {
  const o = col.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const n = col.length, out = new Array(n);
  for (let r = 0; r < n; r++) { const p = (r + 0.5) / n; out[o[r][1]] = Math.sqrt(2) * erfinv(2 * p - 1); }
  return out;
}
function erfinv(x) {   /* Acklam 近似，够用（只用于单调变换） */
  const a = [0.886226899, -1.645349621, 0.914624893, -0.140543331];
  const b = [-2.118377725, 1.442710462, -0.329097515, 0.012229801];
  const c = [-1.970840454, -1.624906493, 3.429567803, 1.641345312];
  const d = [1.011173315, 0.223801166, 0.037200478];
  const s = x < 0 ? -1 : 1, ax = Math.abs(x), t = 1 - ax;
  if (ax > 1 - 1e-12) return s * 6;
  const u = t * (b[0] + t * (b[1] + t * (b[2] + t * b[3]))) / (1 + t * (a[1] + t * (a[2] + t * a[3])));
  const r = t * (d[0] + t * (d[1] + t * d[2])) / (1 + t * (c[1] + t * (c[2] + t * c[3])));
  return s * (u + r);
}
const Z = X.map(normalScores);
const Zc = Z.map(c => { const m = c.reduce((s, v) => s + v, 0) / N; return c.map(v => v - m); });

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function dist2(a, b, D) { let s = 0; for (let d = 0; d < D; d++) { const q = a[d] - b[d]; s += q * q; } return s; }

/* 点到点距离平方矩阵（N=917 ⇒ 84 万个数，够用）*/
const D2 = new Float64Array(N * N);
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
  let s = 0; for (let d = 0; d < Z.length; d++) { const q = Zc[d][i] - Zc[d][j]; s += q * q; }
  D2[i * N + j] = D2[j * N + i] = s;
}

/* 每点的高斯带宽（二分到目标困惑度）⇒ P[j|i] */
function condP(targetPerp) {
  const target = Math.log(targetPerp), P = new Float64Array(N * N);
  for (let i = 0; i < N; i++) {
    let lo = 1e-8, hi = 1e4, beta = 1.0, Pi = null, s = 0;
    for (let it = 0; it < 60; it++) {
      Pi = new Float64Array(N); s = 0;
      for (let j = 0; j < N; j++) { if (j === i) continue; const v = Math.exp(-D2[i * N + j] * beta); Pi[j] = v; s += v; }
      if (!(s > 0)) { beta *= 4; continue; }
      let ent = 0; for (let j = 0; j < N; j++) if (Pi[j] > 0) ent -= (Pi[j] / s) * Math.log(Pi[j] / s);
      if (Math.abs(ent - target) < 1e-4) break;
      if (ent > target) { lo = beta; beta = (hi < 1e4) ? (beta + hi) / 2 : beta * 2; } else { hi = beta; beta = (lo > 1e-8) ? (beta + lo) / 2 : beta / 2; }
    }
    for (let j = 0; j < N; j++) P[i * N + j] = (j === i || !(s > 0)) ? 0 : Pi[j] / s;
  }
  return P;
}

function tsne(DIM, targetPerp, iters, seed) {
  const P = condP(targetPerp);
  /* 对称化 + 下限（数值稳定）*/
  const Q0 = new Float64Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) Q0[i * N + j] = Math.max((P[i * N + j] + P[j * N + i]) / (2 * N), 1e-12);
  const rnd = mulberry(seed);
  let Y = new Float64Array(N * DIM), V = new Float64Array(N * DIM);
  for (let i = 0; i < N * DIM; i++) Y[i] = (rnd() - 0.5) * 1e-3;
  const LR = 180;
  for (let t = 0; t < iters; t++) {
    const num = new Float64Array(N * N); let s = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      let d2 = 0; for (let d = 0; d < DIM; d++) { const q = Y[i * DIM + d] - Y[j * DIM + d]; d2 += q * q; }
      const v = 1 / (1 + d2); num[i * N + j] = num[j * N + i] = v; s += 2 * v;
    }
    const oneOver = 1 / s;
    const rowSum = new Float64Array(N);
    for (let i = 0; i < N; i++) { let rs = 0; for (let j = 0; j < N; j++) { const g = (Q0[i * N + j] - num[i * N + j] * oneOver) * num[i * N + j]; rowSum[i] += g; } }
    for (let i = 0; i < N; i++) for (let d = 0; d < DIM; d++) {
      let g = 0;
      for (let j = 0; j < N; j++) { if (j === i) continue; const w = (Q0[i * N + j] - num[i * N + j] * oneOver) * num[i * N + j]; g += w * Y[j * DIM + d]; }
      g = 4 * (rowSum[i] * Y[i * DIM + d] - g);
      V[i * DIM + d] = 0.8 * V[i * DIM + d] - LR * g;
      Y[i * DIM + d] += V[i * DIM + d];
    }
  }
  /* 每维减去均值、按 IQR 归一（尺度任意，但给查看器一个与旧列同量级的数）*/
  const out = [];
  for (let d = 0; d < DIM; d++) { for (let i = 0; i < N; i++) out.push(Y[i * DIM + d]); }
  return out;
}

/* ===== 指标（与"先定度量"一致）===== */
function metrics(P2) {
  const k = 10;
  const d2 = new Float64Array(N * N);
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    let s = 0; for (let d = 0; d < 2; d++) { const q = P2[d][i] - P2[d][j]; s += q * q; }
    d2[i * N + j] = d2[j * N + i] = Math.sqrt(s);
  }
  const nbr = (M, self) => { const out = []; for (let i = 0; i < N; i++) { const a = []; for (let j = 0; j < N; j++) if (j !== i) a.push([M[i * N + j], j]); a.sort((x, y) => x[0] - y[0]); out.push(a.slice(0, k).map(t => t[1])); } return out; };
  const nA = nbr(d2), nB = nbr(D2);
  let rec = 0; for (let i = 0; i < N; i += 3) { const s = new Set(nA[i]); let c = 0; for (const j of nB[i]) if (s.has(j)) c++; rec += c / k; }
  rec /= Math.ceil(N / 3);
  const rnd = mulberry(11); let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, M = 0;
  const AA = [], BB = [];
  for (let t = 0; t < 200000; t++) { const i = Math.floor(rnd() * N), j = Math.floor(rnd() * N); if (i === j) continue; AA.push(Math.sqrt(D2[i * N + j])); BB.push(d2[i * N + j]); }
  const rk = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const o = new Array(a.length); idx.forEach((t, r) => o[t[1]] = r); return o; };
  const ra = rk(AA), rb = rk(BB), n = AA.length;
  const ma = n ? ra.reduce((s, v) => s + v, 0) / n : 0, mb = n ? rb.reduce((s, v) => s + v, 0) / n : 0;
  for (let i = 0; i < n; i++) { const da = ra[i] - ma, db = rb[i] - mb; sxy += da * db; sxx += da * da; syy += db * db; }
  return { sp: sxy / Math.sqrt((sxx * syy) || 1), knn: rec };
}

const T2 = tsne(2, PERP, ITERS, SEED);
const T3 = tsne(3, PERP, ITERS, SEED + 1);
/* 每个轴按 0.5%~99.5% 跨度线性拉到 [-1,1] 并夹住尾巴。
 *   为什么不是只按 IQR 归一：t-SNE 输出的长宽比是任意的，只归 IQR 会画成一条横带（x 跨度远大于 y），
 *   画布上下全空、场网格也浪费；按跨度归一 ⇒ 云团填满画布，且两者跨度相同（线性、逐轴保序）。 */
const scale = (arr) => { const s = arr.slice().sort((a, b) => a - b);
  const lo = s[Math.floor(s.length * 0.005)], hi = s[Math.min(s.length - 1, Math.floor(s.length * 0.995))];
  const sp = (hi - lo) || 1;
  return arr.map(v => Math.max(-1.05, Math.min(1.05, (v - lo) / sp * 2 - 1))); };
const x2 = scale(T2.slice(0, N)), y2 = scale(T2.slice(N, 2 * N));
const m = metrics([x2, y2]);
console.log('  t-SNE(perp=' + PERP + ', iters=' + ITERS + ', seed=' + SEED + ')：Spearman=' + m.sp.toFixed(3) + '  kNN@10=' + m.knn.toFixed(2) + '   （旧 x2/y2 基线：0.365 / 0.08）');

if (WRITE) {
  let hx = H.indexOf('xt'), hy = H.indexOf('yt'), hx3 = H.indexOf('xt3'), hy3 = H.indexOf('yt3'), hz3 = H.indexOf('zt3');
  const add = [];
  if (hx < 0) { hx = H.length + add.length; add.push('xt'); }
  if (hy < 0) { hy = H.length + add.length; add.push('yt'); }
  if (hx3 < 0) { hx3 = H.length + add.length; add.push('xt3'); }
  if (hy3 < 0) { hy3 = H.length + add.length; add.push('yt3'); }
  if (hz3 < 0) { hz3 = H.length + add.length; add.push('zt3'); }
  const fill = (r, idx, v) => { while (r.length <= idx) r.push(''); r[idx] = v; };
  for (let i = 0; i < N; i++) {
    const r = rows[i];
    fill(r, hx, x2[i].toFixed(6)); fill(r, hy, y2[i].toFixed(6));
    fill(r, hx3, scale(T3.slice(0, N))[i].toFixed(6)); fill(r, hy3, scale(T3.slice(N, 2 * N))[i].toFixed(6)); fill(r, hz3, scale(T3.slice(2 * N, 3 * N))[i].toFixed(6));
  }
  const head = H.concat(add);
  writeFileSync(CF, [head.join('\t')].concat(rows.map(r => r.join('\t'))).join(EOL) + EOL);
  console.log('  已写 ' + CF + '（新增/覆盖列 ' + head.map((h, i) => (add.indexOf(h) >= 0 || ['xt', 'yt', 'xt3', 'yt3', 'zt3'].indexOf(h) >= 0) ? h : null).filter(Boolean).join(' ') + '）');
}
