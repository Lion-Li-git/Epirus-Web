
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const h = Object.fromEntries(co[0].map((x, i) => [x, i]));
const rows = co.slice(1).map(r => ({ id: r[h.id], p: [2,3,5,8].map(n => r[h['P' + n]] === '' ? NaN : +r[h['P' + n]]), x: [2,3,5,8].map(n => r[h['X' + n]] === '' ? NaN : +r[h['X' + n]]) }));
const W = [0.15, 0.25, 0.45, 0.15];
const score = (a) => { let s = 0, w = 0; for (let i = 0; i < 4; i++) if (isFinite(a[i])) { s += W[i] * a[i]; w += W[i]; } return w ? s / w : NaN; };
for (const r of rows) { r.P = score(r.p); r.X = score(r.x); }
const byP = rows.slice().sort((a, b) => b.P - a.P);
const byX = rows.slice().sort((a, b) => b.X - a.X);
console.log('P 侧 top8：'); for (const r of byP.slice(0, 8)) console.log('  ' + r.id.padEnd(24) + ' P=' + r.P.toFixed(3) + '  X=' + r.X.toFixed(3));
console.log('X 侧 top8：'); for (const r of byX.slice(0, 8)) console.log('  ' + r.id.padEnd(24) + ' X=' + r.X.toFixed(3) + '  P=' + r.P.toFixed(3));
/* 两尺的排名相关（Spearman 粗略：按名次差的秩相关） */
const rkP = new Map(byP.map((r, i) => [r.id, i])), rkX = new Map(byX.map((r, i) => [r.id, i]));
let d2 = 0; for (const r of rows) { const a = rkP.get(r.id), b = rkX.get(r.id); d2 += (a - b) ** 2; }
const n = rows.length, rho = 1 - (6 * d2) / (n * (n * n - 1));
console.log('\nSpearman(P 排名, X 排名) = ' + rho.toFixed(3) + '（1 = 完全同序）');
