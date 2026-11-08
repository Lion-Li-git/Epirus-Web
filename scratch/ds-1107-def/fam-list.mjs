
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/lineage-g3.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const by = {};
for (const r of t.slice(1)) { const f = r[h.fam]; by[f] = by[f] || { n: 0, label: r[h.famLabel] }; by[f].n++; }
for (const f of Object.keys(by).sort((a,b)=>+a-+b)) console.log('fam ' + f + '  ×' + by[f].n + '  ' + (by[f].label || ''));
console.log('\n最后 5 行：');
for (const r of t.slice(-5)) console.log('  ' + r[h.id].padEnd(16) + ' fam=' + r[h.fam] + ' ts=' + r[h.ts] + ' parent=' + r[h.parent]);
