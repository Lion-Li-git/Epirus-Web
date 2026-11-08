
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
const i = s.indexOf('var DATA = ');
const j = s.indexOf('; var OKSRCJ', i);
const seg = s.slice(i, j);
console.log('DATA 段长度', seg.length);
console.log('P2 出现:', (seg.match(/P2/g) || []).length, ' P5:', (seg.match(/P5/g) || []).length, ' X5L:', (seg.match(/X5L/g) || []).length);
const k = seg.indexOf('{"id"');
console.log('首行:', seg.slice(k, k + 260));
