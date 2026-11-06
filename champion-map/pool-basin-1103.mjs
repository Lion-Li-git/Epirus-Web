#!/usr/bin/env node
/* _pool-basin.mjs —— 旧池自己有几个盆？（11-03 用户观察的定量检验，一次性分析件）
 * 用户读旧图的原话：「旧的演化图其实并没有很明显的两个盆，强簇就是 K2 集中且比较远，ldemo 附近强的比较多，
 *   中间有一团比较弱，而不是很极端分布」⇒ 把这句话变成可判的数：
 *   ① 旧池 825 行在 12 维行为特征上做 k-means(k=2..4) 的**轮廓系数**（>0.5 才叫分得开）；
 *   ② 按头号尺 Hp 分"最强 10% vs 最弱 10%"两群，量它们**心距**与**两群之间谷里的旧池点数**
 *      （谷里点很多 ⇒ 强弱之间是连续坡，不是两个盆）；
 *   ③ 顺手报 K2 / Ldemo 在 Hp 排序里的位置（用户点名的两个锚）。
 * 用法：node champion-map/_pool-basin.mjs [--coords=champion-map/coords-published-1103.tsv]
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const FEAT = ['dmg', 'heavy', 'holo', 'rounds', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk'];
const num = (v) => { const n = Number(v); return isFinite(n) && v !== '' && v != null ? n : NaN; };
const t = readFileSync(join(HERE, arg('coords', '../champion-map/coords.tsv')), 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const h = t[0].split('\t');
const rows = t.slice(1).map((l) => { const c = l.split('\t'); const o = {}; h.forEach((k, i) => { o[k] = c[i]; }); return o; })
  .filter((r) => FEAT.every((f) => isFinite(num(r[f]))));
console.log('面板 ' + rows.length + ' 行（12 维行为列全齐的）');
const mu = {}, sd = {};
for (const f of FEAT) { const v = rows.map((r) => num(r[f])); mu[f] = v.reduce((a, b) => a + b, 0) / v.length;
  sd[f] = Math.sqrt(v.reduce((a, b) => a + (b - mu[f]) ** 2, 0) / v.length) || 1; }
const V = rows.map((r) => FEAT.map((f) => (num(r[f]) - mu[f]) / sd[f]));
const D = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));
function kmeans(V, k, seed) {
  let C = []; const rng = (() => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 6) >>> 0; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; })();
  const used = new Set();
  while (C.length < k) { const i = Math.floor(rng() * V.length); if (used.has(i)) continue; used.add(i); C.push(V[i].slice()); }
  let assign = new Array(V.length).fill(0);
  for (let it = 0; it < 80; it++) {
    assign = V.map((v) => { let bi = 0, bd = 1e18; C.forEach((c, i) => { const d = D(v, c); if (d < bd) { bd = d; bi = i; } }); return bi; });
    for (let i = 0; i < k; i++) { const g = V.filter((_, j) => assign[j] === i); if (g.length) C[i] = V[0].map((_, j) => g.reduce((s, v) => s + v[j], 0) / g.length); }
  }
  return { assign, C };
}
function silh(V, assign, k) {
  const g = []; for (let i = 0; i < k; i++) g.push(V.filter((_, j) => assign[j] === i));
  let s = 0, n = 0;
  V.forEach((v, i) => {
    const own = g[assign[i]].filter((w) => w !== v);
    let b = 1e18, bk = -1;
    for (let j = 0; j < k; j++) { if (j === assign[i] || !g[j].length) continue; const m = g[j].reduce((t2, w) => t2 + D(v, w), 0) / g[j].length; if (m < b) { b = m; bk = j; } }
    if (!own.length || bk < 0) return;
    const a = own.reduce((t2, w) => t2 + D(v, w), 0) / own.length;
    s += (b - a) / Math.max(a, b); n++;
  });
  return n ? s / n : null;
}
for (const k of [2, 3, 4]) {
  const r = kmeans(V, k, 7);
  console.log('k-means k=' + k + ' ‖ 轮廓系数 = ' + silh(V, r.assign, k).toFixed(3) + ' ‖ 群大小 = ' +
    Array.from({ length: k }, (_, i) => r.assign.filter((a) => a === i).length).join('/'));
}
/* 强弱两群（按 Hp 十分位）+ 谷 census */
const withHp = rows.map((r, i) => ({ r, v: V[i], Hp: num(r.Hp) })).filter((x) => isFinite(x.Hp));
withHp.sort((a, b) => b.Hp - a.Hp);
const N = withHp.length, top = withHp.slice(0, Math.round(N * 0.1)), bot = withHp.slice(-Math.round(N * 0.1));
const cen = (g) => g[0].v.map((_, j) => g.reduce((s, x) => s + x.v[j], 0) / g.length);
const c0 = cen(top), c1 = cen(bot), CD = D(c0, c1);
const px = c1.map((v, j) => v - c0[j]), len2 = px.reduce((s, v) => s + v * v, 0) || 1;
let inGap = 0, gapNames = [];
withHp.forEach((x) => {
  const w = x.v.map((v, j) => v - c0[j]);
  const tt = w.reduce((s, v, j) => s + v * px[j], 0) / len2;
  if (tt <= 0.08 || tt >= 0.92) return;
  const perp = Math.sqrt(Math.max(0, w.reduce((s, v) => s + v * v, 0) - tt * tt * len2));
  if (perp < 0.25 * CD) { inGap++; gapNames.push(x.r.id); }
});
console.log('强 10%（n=' + top.length + ' ‖ Hp 中位 ' + top[Math.floor(top.length / 2)].Hp.toFixed(1) + '）vs 弱 10%（n=' + bot.length + ' ‖ Hp 中位 ' + bot[Math.floor(bot.length / 2)].Hp.toFixed(1) + '）');
console.log('  两群心距 = ' + CD.toFixed(3) + ' ‖ 谷里（心连线中段 ±0.25 心距）坐着 **旧池自己 ' + inGap + '/' + N + '** 枚（' + (100 * inGap / N).toFixed(1) + '%）');
console.log('  ⚠ 这个"细管"数**不能当盆的证据**：12 维里垂直于一条线 0.25×心距的管道体积本来就趋零（825 枚全落在管外是几何必然，不是结构）⇒ 下面换成一维投影断档检验。');
/* 一维投影断档检验：把每枚投到 c0→c1 轴上，看中段有没有真的"断" */
const ts = withHp.map((x) => { const w = x.v.map((v, j) => v - c0[j]); return w.reduce((s, v, j) => s + v * px[j], 0) / len2; }).sort((a, b) => a - b);
const band = (lo, hi) => ts.filter((v) => v >= lo && v <= hi).length;
console.log('  沿强弱轴的分布（t=0 弱端 ‖ t=1 强端）：t<0 的 ' + ts.filter((v) => v < 0).length + ' ‖ [0,0.35] ' + band(0, 0.35) + ' ‖ **中段 [0.35,0.65] ' + band(0.35, 0.65) + '** ‖ [0.65,1] ' + band(0.65, 1) + ' ‖ >1 的 ' + ts.filter((v) => v > 1).length);
const dec = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => ts[Math.min(N - 1, Math.round(i * (N - 1) / 10))].toFixed(2));
console.log('  t 的十分位：' + dec.join(' '));
console.log('  ⇒ 中段非空且十分位连续 = 强弱之间是**连续坡**（用户读的那句成立）；中段接近 0 = 才叫两个盆');
const rank = new Map(withHp.map((x, i) => [x.r.id, i + 1]));
for (const id of ['K2', 'Ldemo', 'SHIPPED-Ldemo', 'T8-s114', 'D4a', 'U-s216', 'B5-10-31', 'N5L-30']) {
  const hit = withHp.find((x) => x.r.id === id);
  if (hit) console.log('  锚点 ' + id.padEnd(12) + ' Hp=' + hit.Hp.toFixed(1) + ' ‖ Hp 名次 ' + rank.get(hit.r.id) + '/' + N);
}
