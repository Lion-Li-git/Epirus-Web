
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
console.log('lin 非空的行（全部）：');
for (const d of DATA.filter(x => x.lin)) console.log('  ' + String(d.id).padEnd(24) + ' ver=' + (d.ver||'?') + ' lin=' + d.lin + ' pt=' + (d.pt||'-') + ' sh=' + (d.sh||'-'));
