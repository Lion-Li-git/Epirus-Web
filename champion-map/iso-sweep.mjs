#!/usr/bin/env node
/* §E312 壳的"阈值该定在哪"离线扫描
 *
 * 为什么要离线跑：查看器里那个壳的默认阈值 / 收缩强度，本来是我截图一张一张试出来的（慢且看不见全貌）。
 * 而场的算法只需要 coords.tsv 的三列显示坐标 + feas 的 ok ⇒ 可以完全离线复算，
 * 于是"默认值"这件事从"看着顺眼"变成"有一张表"。
 *
 * 与查看器逐字同口径的地方（改了这边要改那边）：
 *   ax = x3 ‖ by = y3 ‖ cz = (z3 − zmin)/(zmax − zmin) × zBase，**三处 min/max 都是 0.5%/99.5% 截尾分位**，
 *   zBase = 0.26 × span（span = 截尾后的 max(x 跨, y 跨)）—— 见 viewer.mjs:880~903
 *   **F = Hp/100 + T·S（§E314 起是线上口径）**；σ = 第 6 近邻距离的中位（按显示度量）；核 = 高斯，支撑 R = 2.6σ
 *   场 = (ESS·p̂ + M0·p0)/(ESS + M0)，ESS = (Σw)²/Σw²，p0 = 全库过线率
 *
 * 用法：node champion-map/iso-sweep.mjs [--zfrac=0.26] [--T=0.10]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const rd = (f) => readFileSync(join(HERE, f), 'utf8').trim().split('\n').map((l) => l.split('\t'));

const CO = rd('coords.tsv'); const ch = Object.fromEntries(CO[0].map((h, i) => [h, i]));
const OK = {};
for (const f of ['feas-s1.tsv', 'feas-s2.tsv', 'feas-s3.tsv']) {
  const L = rd(f); const hd = Object.fromEntries(L[0].map((h, i) => [h, i]));
  for (const r of L.slice(1)) if (r[hd.id]) OK[r[hd.id]] = r[hd.ok] === '1' ? 1 : (r[hd.ok] === '0' ? 0 : null);
}
const rows = CO.slice(1).filter((r) => r[ch.id] && isFinite(+r[ch.x3]));
const N = rows.length;
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
/* 显示度量必须与查看器**逐字同式**（viewer.mjs:880~903）。这里曾经错过一次：
 *   旧写法用全 min/max + zBase = 0.62×max(spanX,spanY)，而页面用的是 **0.5%/99.5% 截尾** 的 span、
 *   zBase = 0.26×span ⇒ 两边走的是不同的第三轴比例，σ 和整张阈值表都不是同一台仪器量出来的
 *   （症状：页面报"留一 27 枚里 3 枚"，表上却是 37 枚里 9 枚）。改完这一处才对得上。*/
const z3 = rows.map((r) => +r[ch.z3]);
const x3 = rows.map((r) => +r[ch.x3]), y3 = rows.map((r) => +r[ch.y3]);
const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.max(0, Math.min(s.length - 1, Math.floor(s.length * p)))]; };
const span = Math.max(q(x3, .995) - q(x3, .005), q(y3, .995) - q(y3, .005)) || 1;
const zmin0 = q(z3, .005), zspan = (q(z3, .995) - zmin0) || 1;
const zBase = Number(arg('zfrac', 0.26)) * span;
const A = x3, B = y3, C = z3.map((z) => (z - zmin0) / zspan * zBase);
const V = rows.map((r) => OK[r[ch.id]]);
const nHas = V.filter((v) => v === 0 || v === 1).length, nOk = V.filter((v) => v === 1).length;
const p0 = nOk / nHas;

/* σ：第 6 近邻（显示度量）的中位 */
const nn = [];
for (let i = 0; i < N; i++) {
  const h = [];
  for (let j = 0; j < N; j++) { if (j === i) continue;
    const dx = A[i] - A[j], dy = B[i] - B[j], dz = C[i] - C[j], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (h.length < 6) { h.push(d); h.sort((a2, b2) => a2 - b2); } else if (d < h[5]) { h[5] = d; h.sort((a2, b2) => a2 - b2); } }
  nn.push(h[5]);
}
nn.sort((a, b) => a - b);
const sig = nn[Math.floor(nn.length * .5)];
const R = 2.6 * sig, s2 = 2 * sig * sig;
console.log('样本 ' + N + ' 枚（有判定 ' + nHas + ' ‖ 过线 ' + nOk + ' ⇒ 底率 ' + (100 * p0).toFixed(1) + '%）');
console.log('σ = 第 6 近邻中位 = ' + sig.toFixed(1) + ' 显示单位 ‖ 支撑 R = ' + R.toFixed(1));

/* 粗哈希（与查看器同形）*/
const lo = [Math.min(...A) - R, Math.min(...B) - R, Math.min(...C) - R];
const buckets = {};
for (let i = 0; i < N; i++) {
  const key = Math.floor((A[i] - lo[0]) / R) + ',' + Math.floor((B[i] - lo[1]) / R) + ',' + Math.floor((C[i] - lo[2]) / R);
  (buckets[key] || (buckets[key] = [])).push(i);
}
function at(X, Y, Z, self) {
  const bi = Math.floor((X - lo[0]) / R), bj = Math.floor((Y - lo[1]) / R), bk = Math.floor((Z - lo[2]) / R);
  let num = 0, den = 0, den2 = 0;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
    const arr = buckets[(bi + di) + ',' + (bj + dj) + ',' + (bk + dk)]; if (!arr) continue;
    for (const m of arr) { if (m === self) continue; const v = V[m]; if (v !== 0 && v !== 1) continue;
      const ex = X - A[m], ey = Y - B[m], ez = Z - C[m], dd = ex * ex + ey * ey + ez * ez;
      if (dd > R * R) continue; const gv = Math.exp(-dd / s2); den += gv; den2 += gv * gv; num += gv * v; } }
  return { den, num, den2 };
}
function shrink(o, M0) { if (o.den <= 1e-6) return p0; const ess = o.den * o.den / (o.den2 || 1e-9); return (ess * (o.num / o.den) + M0 * p0) / (ess + M0); }

/* 每枚的"含自己"与"留一"场值先算一次（阈值扫描只是在同一批值上换比较线）*/
const withSelf = [], loo = [];
for (let i = 0; i < N; i++) { const o = at(A[i], B[i], C[i], -1), o2 = at(A[i], B[i], C[i], i);
  withSelf.push(o); loo.push(o2); }

for (const M0 of [2, 3, 5, 8]) {
  const ws = withSelf.map((o) => shrink(o, M0)), ls = loo.map((o) => shrink(o, M0));
  const peak = Math.max(...ws);
  let line = 'M0=' + String(M0).padEnd(2) + ' 峰值(含自己) ' + (100 * peak).toFixed(0) + '%  留一峰值 ' +
    (100 * Math.max(...ls)).toFixed(0) + '%   ';
  for (const t of [0.25, 0.3, 0.35, 0.4, 0.5]) {
    let ins = 0, cov = 0, insL = 0, covL = 0;
    for (let i = 0; i < N; i++) { if (V[i] !== 0 && V[i] !== 1) continue;
      if (ws[i] >= t) { ins++; if (V[i] === 1) cov++; }
      if (ls[i] >= t) { insL++; if (V[i] === 1) covL++; } }
    line += ' @' + (100 * t).toFixed(0) + '%: 壳内 ' + ins + '/' + cov + ' ‖留一 ' + insL + '/' + covL;
  }
  console.log(line);
}
console.log('\n读法：壳内 K/N = "被这层壳圈进 N 枚、其中 K 枚真过线"。');
console.log('含自己是循环的（一枚会把自己那格抬上去），留一才是"它不是靠自己被圈进来"的读数 ⇒');
console.log('默认阈值要挑在**留一那一列还有东西**的最高档，否则壳只是把点自己照亮。');

/* ===== 第二个场：势（F）归一化 =====
 * 为什么要单独扫：查看器里 isoT 是**两个场共用的一根线**，而这两个场的量纲完全不同 ——
 *   'ok' 场：值 ∈ {0,1}，先验 p0 = 全库过线率 15.7%，收缩后峰值 ~49% ⇒ 30% 是个有意义的刻度；
 *   'pot' 场：值 = (F−Fmin)/span ∈ [0,1]，先验 p0 = 全库均值 ≈ 0.59，峰值 ≈ 0.69
 *            ⇒ 阈值 45% **低于均值**，于是"壳内 712/718 枚、纯度 = 底率"= 圈了个寂寞（截图里就是这个）。
 * 所以 pot 场的默认线必须落在 [均值, 峰值] 这一段里，而这一段只有 0.59~0.69 这么窄 ⇒ 拿表定，别拿眼睛定。
 * 副产物：圈进多少枚 = 这层壳的作用面；纯度 = 它比底率(15.7%)富集了多少倍。*/
/* §E314：势的定义换了尺 ⇒ 这里必须跟着换（用户裁定把整张图换成线上口径 ⇒ 查看器 Fv 从 H/100 改成 Hp/100）。
 *   不跟着改就又是 §E312 那条病的第二次：表与页面不是同一台仪器，挑出来的默认值白挑。
 *   实测换尺后 pot 场先验 59% → 63%、峰值 68% → 70% ⇒ 旧默认 64% 离均值只剩 1pt，壳圈进 338 枚、纯度 31%→23%。
 *   与查看器同式：F = Hp/100 + T·S，T = 出厂默认（= 查看器 st.T 的初值，这里不另存常数副本）。*/
const Tv = Number(arg('T', 0.10));
const FP = rows.map((r) => (+r[ch.Hp]) / 100 + Tv * (+r[ch.S]));
const fmin = Math.min(...FP), fmax = Math.max(...FP), fspan = fmax - fmin;
const V2 = FP.map((f) => (f - fmin) / fspan);
const p0b = V2.reduce((s, v) => s + v, 0) / N;
/* 核的分子换成 V2（势）而不是 V（过线 0/1），先验换成均值 ⇒ 与查看器 field='pot' 同形*/
function atV(X, Y, Z, self) {
  const bi = Math.floor((X - lo[0]) / R), bj = Math.floor((Y - lo[1]) / R), bk = Math.floor((Z - lo[2]) / R);
  let num = 0, den = 0, den2 = 0;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
    const arr = buckets[(bi + di) + ',' + (bj + dj) + ',' + (bk + dk)]; if (!arr) continue;
    for (const m of arr) { if (m === self) continue; const v = V[m]; if (v !== 0 && v !== 1) continue;
      const ex = X - A[m], ey = Y - B[m], ez = Z - C[m], dd = ex * ex + ey * ey + ez * ez;
      if (dd > R * R) continue; const gv = Math.exp(-dd / s2); den += gv; den2 += gv * gv; num += gv * V2[m]; } }
  return { den, num, den2 };
}
function shrink2(o, M0) { if (o.den <= 1e-6) return p0b; const ess = o.den * o.den / (o.den2 || 1e-9); return (ess * (o.num / o.den) + M0 * p0b) / (ess + M0); }
const w2 = [], l2 = [];
/* M0 与查看器同步（改一边必须改另一边）：5 = 让"孤点过线"抬不过 30% 的那一档 */
for (let i = 0; i < N; i++) { w2.push(shrink2(atV(A[i], B[i], C[i], -1), 5)); l2.push(shrink2(atV(A[i], B[i], C[i], i), 5)); }
console.log('\npot 场（M0=5）：均值(=先验) ' + (100 * p0b).toFixed(0) + '% ‖ 峰值(含自己) ' + (100 * Math.max(...w2)).toFixed(0) +
  '% ‖ 留一峰值 ' + (100 * Math.max(...l2)).toFixed(0) + '%');
for (const t of [0.63, 0.64, 0.65, 0.655, 0.66, 0.67, 0.68]) {
  let ins = 0, cov = 0, insL = 0, covL = 0;
  for (let i = 0; i < N; i++) { if (V[i] !== 0 && V[i] !== 1) continue;
    if (w2[i] >= t) { ins++; if (V[i] === 1) cov++; }
    if (l2[i] >= t) { insL++; if (V[i] === 1) covL++; } }
  console.log(' @' + (100 * t).toFixed(0) + '%: 壳内 ' + cov + '/' + ins + ' 过线 = ' + (100 * cov / (ins || 1)).toFixed(0) +
    '% ‖留一 ' + covL + '/' + insL + ' = ' + (100 * covL / (insL || 1)).toFixed(0) + '%（底率 ' + (100 * p0).toFixed(1) + '%）');
}

