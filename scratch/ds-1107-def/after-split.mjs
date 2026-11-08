
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-gen3-1105.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const rows = t.slice(1).map(r => ({ lin: r[h.lineage], kin: r[h.kin], sh: r[h.sh] }));
const c = {};
for (const r of rows) { const k = 'lin=' + (r.lin || '(空)') + ' / kin=' + (r.kin || '(空)'); c[k] = (c[k] || 0) + 1; }
for (const k of Object.keys(c).sort()) console.log('  ' + k.padEnd(42) + c[k]);
console.log('\nsh 有值 ' + rows.filter(r => r.sh).length + ' 枚；isShipped 口径（sh 或 lin=历代上槽）' + rows.filter(r => r.sh || r.lin === '历代上槽').length + ' 枚');
