
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
for (const id of ['GD3ALL-G5-s13','D-b-hpseed-s13','COMBO-s13','DDEF-s13','DEF-s13','EFFG-s5']) {
  const r = t.slice(1).find(x => x[h.id] === id);
  if (!r) continue;
  console.log(id.padEnd(20) + ' P2=' + r[h.P2] + ' P5=' + r[h.P5] + ' P8=' + r[h.P8] + ' P2L=' + r[h.P2L] + ' dmg=' + r[h.dmg] + ' heavy=' + r[h.heavy] + ' rounds=' + r[h.rounds] + ' path=' + r[h.path]);
}
