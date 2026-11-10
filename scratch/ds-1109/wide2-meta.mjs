
import { readFileSync } from 'node:fs';
const s = readFileSync('scratch/ds-1108/WIDE2-Q-s13.js', 'utf8');
const i = s.indexOf('EPIRUS_CHAMPION_3P_META');
console.log(s.slice(i, i + 1200).split('\n')[0]);
