
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
for (const f of ['champion-map/coords-gen3-1105.tsv', 'champion-map/coords-projcols.tsv']) {
  const t = rd(f), h = Object.fromEntries(t[0].map((x, i) => [x, i]));
  console.log('=== ' + f);
  for (const id of ['CTRL2-Q-s7','Q-s47']) {
    const r = t.slice(1).find(x => x[h.id] === id);
    console.log('  ' + id.padEnd(12) + ' xt=' + r[h.xt] + ' yt=' + r[h.yt] + ' x2=' + r[h.x2] + ' y2=' + r[h.y2]);
  }
}
