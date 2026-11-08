
import { readFileSync, existsSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const H = co[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
const byId = {}; for (const r of co.slice(1)) byId[r[h.id]] = r;
for (const id of ['V7M-s13','V7M-s41','V7L-s13','V7L-s41','V7C-s13','V7C-s41','T8-s114']) {
  const r = byId[id]; const p = r ? r[h.path] : '';
  const exists = p && existsSync(p);
  let w = '', v = '', arch = '', hs = '', te = '';
  if (exists) { const s = readFileSync(p, 'utf8'); w = widOf(s);
    v = (s.match(/"v":(\d+)/) || [])[1] || ''; arch = (s.match(/"arch":"([^"]*)"/) || [])[1] || '';
    hs = (s.match(/"hotstartFrom":"([^"]*)"/) || [])[1] || ''; te = (s.match(/"teacher":"([^"]*)"/) || [])[1] || ''; }
  console.log(id.padEnd(9) + ' ver=' + (r ? r[h.ver] : '?') + ' 在盘=' + !!exists + ' path=' + p);
  console.log('         wid=' + (w || '-') + ' v=' + v + ' arch=' + arch + ' hotstart=' + hs + ' teacher=' + te);
}
