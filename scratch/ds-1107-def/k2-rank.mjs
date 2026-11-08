
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const W = { 2: 0.15, 3: 0.25, 5: 0.45, 8: 0.15 };
const rows = t.slice(1).map(r => { const g = (k) => r[h[k]] === '' || r[h[k]] === undefined ? NaN : +r[h[k]]; let a = 0, w = 0; for (const n of [2,3,5,8]) { const v = g('P' + n); if (isFinite(v)) { a += W[n] * v; w += W[n]; } } return { id: r[h.id], x4: w ? a / w : NaN }; }).filter(r => isFinite(r.x4)).sort((a, b) => b.x4 - a.x4);
const where = (v) => rows.filter(r => r.x4 > v).length + 1;
console.log('K2 克隆若进图：短 X̄₄ 0.292 → 第 ' + where(0.292) + '/' + rows.length + '（教师 K2 0.266 → 第 ' + where(0.266) + '）');
console.log('参照：CTRL2-Q-s7 0.427 第 1 ‖ ADAPT2-Q-s7 0.360 第 2 ‖ Q-s47 0.349 第 3 ‖ CTRL2-Q-s13 0.310 第 ' + where(0.310));
