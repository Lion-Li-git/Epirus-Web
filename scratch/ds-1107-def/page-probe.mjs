
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
console.log('DATA 行数', DATA.length);
for (const id of ['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7']) {
  const d = DATA.find(x => x.id === id);
  if (!d) { console.log(id + '：**不在页面 DATA 里**'); continue; }
  console.log(id + '：在。 xt=' + d.xt + ' yt=' + d.yt + ' x2=' + d.x2 + ' y2=' + d.y2 + ' fam=' + d.fam + ' famTop=' + d.famTop + ' ver=' + d.ver + ' sh=' + d.sh + ' pt=' + d.pt);
}
