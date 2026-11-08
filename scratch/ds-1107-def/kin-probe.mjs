
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-gen3-1105.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const rows = t.slice(1).map(r => ({ id: r[h.id], lin: r[h.lineage], kin: r[h.kin] }));
const byKin = {};
for (const r of rows) byKin[(r.kin || '(空)')] = (byKin[(r.kin || '(空)')] || 0) + 1;
console.log('kin 取值分布：');
for (const k of Object.keys(byKin).sort()) console.log('  ' + k.padEnd(14) + byKin[k]);
console.log('\nkin 非空的例子：');
for (const r of rows.filter(x => x.kin).slice(0, 8)) console.log('  ' + r.id.padEnd(22) + ' lin=' + JSON.stringify(r.lin) + ' kin=' + JSON.stringify(r.kin));
