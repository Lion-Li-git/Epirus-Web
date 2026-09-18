/* 第三方面板（不新增判据，只是把已有三份读数联表）：
 *   哪一张考卷追踪"头对头打线上包"？—— 这是 §13 的收尾：
 *   如果 A 卷与头对头也反相关，那"用 A 卷当晋升门槛"就是**在系统性地选出打不过强对手的包**。
 * 用法：node tools/l2-h2h-join.mjs [h2h 日志] [考卷矩阵 tsv]
 */
import { readFileSync } from 'node:fs';
const H2H = process.argv[2] || 'docs/artifacts/h2h-sweep.log';
const MAT = process.argv[3] || 'docs/l2-eval-matrix-120.tsv';
const h = {};
for (const l of readFileSync(H2H, 'utf8').split(/\r?\n/)) {
  const m = /^\s+(\S+)\s+\[(multi|long)\]\s+被测1席 ([\d.]+)%.*被测4席\(线上包1席打它\) ([\d.]+)%/.exec(l);
  if (!m) continue;
  const o = (h[m[1]] = h[m[1]] || {});
  o[m[2] + '_f'] = Number(m[3]); o[m[2] + '_r'] = Number(m[4]);
}
const w = {};
for (const l of readFileSync(MAT, 'utf8').split(/\r?\n/).filter(x => x.includes('\t'))) {
  const p = l.split('\t'), nm = p[0].replace('.bak', '');
  const o = (w[nm] = w[nm] || {});
  o[p[1]] = Number((/1st=([\d.]+)%/.exec(p[2]) || [0, 0])[1]) - Number((/([\d.]+)%/.exec(p[4]) || [0, 0])[1]);
}
function corr(xs, ys) {
  const n = xs.length; if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { const p = xs[i] - mx, q = ys[i] - my; a += p * q; b += p * p; c += q * q; }
  return a / Math.sqrt(b * c || 1);
}
const keys = Object.keys(w).filter(k => h[k] && h[k].multi_f != null && k !== 'bundled-champion-3p');
console.log(`=== 联表：头对头(${H2H}) × 考卷矩阵(${MAT})  n=${keys.length} 个包 ===`);
const fwd = keys.map(k => h[k].multi_f), rev = keys.map(k => h[k].multi_r);
console.log(`两个 h2h 方向自身的一致性：r(正向, 反向) = ${corr(fwd, rev).toFixed(2)}   （应当为负：反向是线上包 1 席打 4 席被测，越低说明被测越强）`);
const A = keys.map(k => w[k]['A卷']), T = keys.map(k => w[k].TN), RW = keys.map(k => w[k].RW);
const negRev = rev.map(x => -x);
console.log('\n考卷 vs 头对头（正向 = 被测 1 席打线上包 4 席，基线 20%）');
for (const [nm, ys] of [['A卷', A], ['TN(targeter)', T], ['RW(ringwall)', RW]]) {
  console.log(`  r(${nm.padEnd(14)}, 正向) = ${corr(ys, fwd).toFixed(2)}    r(${nm.padEnd(14)}, −反向) = ${corr(ys, negRev).toFixed(2)}`);
}
console.log('\n明细（按正向从高到低）');
console.log('  包                正向   反向    A卷     TN');
keys.sort((x, y) => h[y].multi_f - h[x].multi_f).forEach(k => {
  console.log(`  ${k.padEnd(16)}${String(h[k].multi_f).padStart(5)} ${String(h[k].multi_r).padStart(6)} ${(w[k]['A卷'] == null ? '--' : w[k]['A卷'].toFixed(1)).padStart(7)} ${(w[k].TN == null ? '--' : w[k].TN.toFixed(1)).padStart(7)}`);
});
