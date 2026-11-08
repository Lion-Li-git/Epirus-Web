
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
let i = -1, n = 0;
while ((i = s.indexOf('历代上槽', i + 1)) >= 0 && n < 6) { n++; console.log('@' + i + ' …' + s.slice(Math.max(0, i - 90), i + 60).replace(/\n/g, ' ') + '…\n'); }
