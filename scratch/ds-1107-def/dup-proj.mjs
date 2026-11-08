
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
const m = new Map();
for (const d of DATA) { const k = (+d.x2).toFixed(4) + ',' + (+d.y2).toFixed(4); if (!m.has(k)) m.set(k, []); m.get(k).push(d.id); }
const dup = [...m.values()].filter(a => a.length > 1);
console.log('坐标完全重合的组数:', dup.length);
for (const a of dup.slice(0, 6)) console.log('  ' + a.join(' = '));
const a = DATA.find(d => d.id === 'CTRL2-Q-s7');
console.log('\nCTRL2-Q-s7 坐标', a.x2, a.y2);
