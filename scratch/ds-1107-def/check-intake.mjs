
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
for (const f of ['champion-map/coords-gen3-1105.tsv', 'champion-map/coords.tsv']) {
  const t = rd(f);
  const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
  console.log('=== ' + f + '（' + (t.length - 1) + ' 行）===');
  for (const id of ['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7']) {
    const r = t.slice(1).find(x => x[h.id] === id);
    if (!r) { console.log('  ' + id + ' 不在'); continue; }
    console.log('  ' + id.padEnd(13) + ' P2=' + (r[h.P2]||'空') + ' P3=' + (r[h.P3]||'空') + ' P5=' + (r[h.P5]||'空') + ' P8=' + (r[h.P8]||'空') + ' P2L=' + (r[h.P2L]||'空') + ' P3L=' + (r[h.P3L]||'空'));
  }
}
