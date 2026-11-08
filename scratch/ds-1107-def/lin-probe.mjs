
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
const by = {};
for (const d of DATA) { const k = (d.ver || '?') + ' | ' + (d.lin || '(空)'); by[k] = (by[k] || 0) + 1; }
console.log('ver | lin 分布：');
for (const k of Object.keys(by).sort()) console.log('  ' + k + '  ' + by[k]);
console.log('\n2.0 行的 lin 取值样例：');
const v20 = DATA.filter(d => d.ver === '2.0');
for (const d of v20.slice(0, 12)) console.log('  ' + String(d.id).padEnd(24) + ' lin=' + JSON.stringify(d.lin) + ' pt=' + (d.pt || '-') + ' kin=' + JSON.stringify(d.kin) + ' sh=' + (d.sh || '-'));
console.log('\n2.0 里有 lin 非空的：' + v20.filter(d => d.lin).length + '/' + v20.length);
