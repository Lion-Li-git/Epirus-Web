
import { readFileSync, writeFileSync } from 'node:fs';
const t = readFileSync('champion-map/pool-members.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const H = t[0].split('\t'); const iP = H.indexOf('path');
const paths = t.slice(1).map(l => l.split('\t')[iP]).filter(Boolean);
paths.push('docs/artifacts/e507-out/Q-s47.js', 'docs/artifacts/e528-out/T8-s114.js', 'docs/artifacts/e539-out/U-s205.js');
writeFileSync('scratch/ds-1108/usage-paths.txt', paths.join('\n') + '\n');
console.log(paths.length + ' 枚');
console.log(paths.slice(0,3).join('\n'));
