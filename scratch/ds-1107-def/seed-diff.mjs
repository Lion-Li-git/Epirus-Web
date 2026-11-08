
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const a = rd('champion-map/coords-gen3-1105.tsv'), b = rd('scratch/ds-1107-def/proj-test.tsv');
const h = Object.fromEntries(a[0].map((x, i) => [x, i]));
const bm = new Map(b.slice(1).map(r => [r[h.id], r]));
let same = 0, diff = 0;
for (const r of a.slice(1)) { const o = bm.get(r[h.id]); if (!o) continue; if (r[h.xt] === o[h.xt] && r[h.yt] === o[h.yt]) same++; else diff++; }
console.log('seed=7 vs seed=99：坐标同 ' + same + ' ‖ 不同 ' + diff);
for (const id of ['Q-s47','DEF-s13']) { const r = a.slice(1).find(x => x[h.id] === id); const o = bm.get(id); console.log('  ' + id + ' seed7=' + r[h.xt] + ',' + r[h.yt] + '  seed99=' + o[h.xt] + ',' + o[h.yt]); }
