
import { readFileSync, existsSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const H = co[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
const byId = {}; for (const r of co.slice(1)) byId[r[h.id]] = r;
for (const id of ['V7M-s13','V7M-s41','V7L-s13','V7L-s41','V7C-s13','V7C-s41','T8-s114']) {
  const r = byId[id]; if (!r) { console.log(id + ' 未在表'); continue; }
  const p = r[h.path], fp = p ? 'docs/artifacts/' + p : '';
  let meta = {}, w = '';
  if (fp && existsSync(fp)) {
    const s = readFileSync(fp, 'utf8');
    w = widOf(s);
    const m = s.match(/"arch":"([^"]*)"/); const v = s.match(/"v":(\d+)/);
    const hs = (s.match(/"hotstartFrom":"([^"]*)"/) || [])[1];
    const te = (s.match(/"teacher":"([^"]*)"/) || [])[1];
    meta = { v: v && v[1], arch: m && m[1], hs, te };
  }
  console.log(id.padEnd(10) + ' ver=' + r[h.ver] + ' path=' + p + '\n           wid=' + w + ' v=' + meta.v + ' arch=' + meta.arch + ' hotstart=' + meta.hs + ' teacher=' + meta.te);
}
