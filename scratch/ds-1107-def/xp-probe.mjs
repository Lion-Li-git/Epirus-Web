
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
for (const key of ["XP:", "XCOL"]) {
  let idx = -1, n = 0;
  while ((idx = s.indexOf(key, idx + 1)) >= 0 && n < 3) { n++; console.log(key + ' @' + idx + ': …' + s.slice(Math.max(0, idx - 60), idx + 40).replace(/\n/g, ' ') + '…'); }
  console.log('---');
}
