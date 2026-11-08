
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const W = { 2: 0.15, 3: 0.25, 5: 0.45, 8: 0.15 };
const rows = t.slice(1).map(r => {
  const g = (k) => r[h[k]] === '' || r[h[k]] === undefined ? NaN : +r[h[k]];
  let a = 0, w = 0; for (const n of [2,3,5,8]) { const v = g('P' + n); if (isFinite(v)) { a += W[n] * v; w += W[n]; } }
  return { id: r[h.id], x4: w ? a / w : NaN };
}).filter(r => isFinite(r.x4)).sort((a, b) => b.x4 - a.x4);
console.log('X̄₄(P) top6：');
for (const r of rows.slice(0, 6)) console.log('  ' + r.id.padEnd(16) + r.x4.toFixed(3));
for (const id of ['CTRL2-Q-s7','Q-s47','ADAPT2-Q-s7','U-s205']) console.log(id.padEnd(14) + '第 ' + (rows.findIndex(r => r.id === id) + 1));
