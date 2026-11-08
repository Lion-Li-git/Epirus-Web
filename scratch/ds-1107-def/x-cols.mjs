
import { readFileSync } from 'node:fs';
const raw = readFileSync('champion-map/coords-projcols.tsv', 'utf8').replace(/^\uFEFF/, '');
const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = lines[0].split('\t');
const h = Object.fromEntries(H.map((x, i) => [x, i]));
const rows = lines.slice(1).map(l => l.split('\t'));
const q = (a, p) => { const s = a.filter(v => isFinite(v)).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) * p)] : NaN; };
for (const k of ['X2', 'X3', 'X5', 'X8', 'X2L', 'X3L', 'X5L', 'X8L']) {
  const a = rows.map(r => (r[h[k]] === '' || r[h[k]] == null) ? NaN : +r[h[k]]);
  const ok = a.filter(isFinite).length;
  console.log(k.padEnd(4) + ' 有数 ' + String(ok).padStart(3) + '/' + rows.length
    + '  min=' + q(a, 0).toFixed(3) + ' med=' + q(a, .5).toFixed(3) + ' max=' + q(a, 1).toFixed(3));
}
for (const k of ['n2', 'n3', 'n5', 'n8']) {
  const a = rows.map(r => +r[h[k]] || 0);
  const zero = a.filter(v => v === 0).length;
  console.log(k.padEnd(3) + ' 零格 ' + String(zero).padStart(3) + '/' + rows.length + '  中位局数 ' + q(a, .5));
}
/* 加权 score 用默认权重 0.15/0.25/0.45/0.15 复算一行，看是否合理 */
const W = { X2: 0.15, X3: 0.25, X5: 0.45, X8: 0.15 };
const sc = rows.map(r => { let s = 0, w = 0; for (const k in W) { const v = r[h[k]] === '' ? NaN : +r[h[k]]; if (isFinite(v)) { s += W[k] * v; w += W[k]; } } return w ? s / w : NaN; });
console.log('\n默认权重加权分（短程）：有数 ' + sc.filter(isFinite).length + '  min=' + q(sc,0).toFixed(3) + ' med=' + q(sc,.5).toFixed(3) + ' max=' + q(sc,1).toFixed(3));
