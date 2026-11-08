
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
console.log('行数', t.length - 1, '列数', t[0].length);
for (const id of ['CTRL2-Q-s7', 'CTRL2-Q-s13', 'ADAPT2-Q-s7', 'ADAPT-B-s13']) {
  const r = t.slice(1).find(x => x[h.id] === id);
  if (!r) { console.log(id + '：不在图上'); continue; }
  const g = (k) => r[h[k]] === undefined ? '-' : r[h[k]];
  console.log(id.padEnd(14) + ' ver=' + g('ver') + ' P2=' + g('P2') + ' P3=' + g('P3') + ' P5=' + g('P5') + ' P8=' + g('P8')
    + ' P2L=' + g('P2L') + ' P3L=' + g('P3L') + ' P5L=' + g('P5L') + ' P8L=' + g('P8L') + ' pt=' + (g('pt') || '-') + ' path=' + g('path'));
}
