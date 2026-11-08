
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
for (const id of ['GD3ALL-POPP-s41','GD3ALL-G5-8p-s41','GD3ALL-POPP-s17','GD3ALL-PUSHON-s41','L5-1200-s13','EFFG-s5','EFFG-s41','DEF-s13','DEF-s16','LE-s13','G5DEF-s41']) {
  const d = DATA.find(x => x.id === id);
  console.log(id.padEnd(20) + (d ? (' lin=' + JSON.stringify(d.lin) + ' kin=' + JSON.stringify(d.kin) + ' pt=' + (d.pt||'-') + ' sh=' + (d.sh||'-') + ' fam=' + (d.fam===undefined?'-':d.fam)) : ' 不在'));
}
