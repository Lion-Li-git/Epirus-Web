
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-gen3-1105.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const rows = t.slice(1).map(r => ({ id: r[h.id], lin: r[h.lineage], ver: r[h.ver], kin: r[h.kin], pt: r[h.pt] }));
const by = {};
for (const r of rows) { const k = (r.lin || '(空)') + ' | ver=' + (r.ver || '?'); by[k] = (by[k] || 0) + 1; }
for (const k of Object.keys(by).sort()) console.log(k.padEnd(34) + by[k]);
console.log('\n代3臂产物（前 12）：');
for (const r of rows.filter(x => x.lin === '代3臂产物').slice(0, 12)) console.log('  ' + r.id.padEnd(22) + ' ver=' + (r.ver||'?') + ' kin=' + JSON.stringify(r.kin));
const kinOf = {}; for (const r of rows.filter(x => x.lin === '代3臂产物')) kinOf[r.kin] = (kinOf[r.kin]||0)+1;
console.log('\n它们的 kin：', JSON.stringify(kinOf));
