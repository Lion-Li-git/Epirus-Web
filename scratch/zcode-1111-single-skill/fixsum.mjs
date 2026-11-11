import { readFileSync } from 'node:fs';
const ids = ['V111','v7densE-81','v7role5-81','v13-103','v14-116','v17-142','v7b-42','v9-42','e1-teach-77003','v7blk1-93','v7ctrlE-31','v7expo-34','v7seat24-31','DSTR4-s13','MSB13-R1S791820660','MSB11-R2S306293884','MSB14-railgun-R1S175656469','Q-s47','G5J-50','KDG-B-Q-s13'];
const mean = (f) => { const rows = readFileSync(f, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t')); const by = {}; for (const r of rows) { by[r[0]] = by[r[0]] || []; by[r[0]].push(+r[5]); } return ids.map((id) => (by[id] || [0]).reduce((a, b) => a + b, 0) / ((by[id] || []).length || 1)); };
const sp = (a, b) => { const n = a.length; const r1 = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]).map((x, k) => x[1]); const r2 = b.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]).map((x, k) => x[1]); const d = r1.map((v, k) => v - r2[k]); return 1 - 6 * d.reduce((s, x) => s + x * x, 0) / (n * (n * n - 1)); };
const F2 = mean('scratch/zcode-1111-single-skill/fixture-F2ref.tsv');
const cv = readFileSync('champion-map/data/build/coords-view.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const ix = Object.fromEntries(cv[0].map((x, i) => [x, i]));
const A = ids.map((id) => +((cv.slice(1).find((r) => r[0] === id) || [])[ix.P5]));
const mu = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const sd = (v) => Math.sqrt(v.reduce((s, x) => s + (x - mu(v)) ** 2, 0) / v.length);
console.log('夹具    σ       Spearman(A)');
console.log('F2ref  ' + sd(F2).toFixed(3) + '   ' + sp(F2, A).toFixed(2));
for (const f of ['F3a', 'F3b', 'F3c', 'F3d', 'F3e']) { const v = mean('scratch/zcode-1111-single-skill/fixture-' + f + '.tsv'); console.log(f + '    ' + sd(v).toFixed(3) + '   ' + sp(v, A).toFixed(2)); }
