
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
for (const id of ['GD3ALL-PLAIN-s13','L5-1200-s13','DEF-s13','DEF-s16','D1200-s13','EFFG-s5','EFFG-s7','EFFG-s41','G5DEF-s41','GD3ALL-G5-8p-s41','GD3ALL-POPP-s41']) {
  const d = DATA.find(x => x.id === id);
  if (!d) { console.log(id.padEnd(22) + ' 不在图上'); continue; }
  console.log(id.padEnd(22) + ' ver=' + (d.ver||'?') + ' lin=' + JSON.stringify(d.lin) + ' pt=' + (d.pt||'-') + ' sh=' + (d.sh||'-'));
}
