
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const rows = t.slice(1).map(r => Object.fromEntries(Object.keys(h).map(k => [k, r[h[k]]])));
console.log('列里有 fam 吗:', h.fam !== undefined, ' famTop:', h.famTop !== undefined);
const v20 = rows.filter(r => r.ver === '2.0');
const fams = {};
for (const r of v20) fams[r.fam] = (fams[r.fam] || 0) + 1;
console.log('2.0 行的 fam 分布:', JSON.stringify(fams));
for (const r of v20.slice(0, 6)) console.log('  ' + r.id.padEnd(18) + ' fam=' + r.fam + ' famTop=' + (r.famTop || '-') + ' path=' + (r.path || '').slice(-40));
console.log('\n新 3 枚：');
for (const id of ['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7']) { const r = rows.find(x => x.id === id); console.log('  ' + id.padEnd(13) + ' fam=' + r.fam + ' xt=' + (r.xt || '空') + ' yt=' + (r.yt || '空') + ' path=' + r.path); }
