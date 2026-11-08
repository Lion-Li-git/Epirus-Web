
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
for (const id of ['CTRL2-Q-s7','DEF-s13','Q-s47']) {
  const d = DATA.find(x => x.id === id);
  console.log(id, JSON.stringify({ ts: d.ts, fam: d.fam, famTop: d.famTop, ver: d.ver, x2: d.x2, y2: d.y2, x3: d.x3, z3: d.z3, pt: d.pt, sh: d.sh, lin: d.lin }));
}
