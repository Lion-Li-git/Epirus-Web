
import { readFileSync, writeFileSync } from 'node:fs';
const t = readFileSync('champion-map/pool-members.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const H = t[0].split('\t'); const iId = H.indexOf('id'), iP = H.indexOf('path');
const lines = ['id\tpath'];
for (const l of t.slice(1)) { const c = l.split('\t'); if (c[iId] && c[iP]) lines.push(c[iId] + '\t' + c[iP]); }
writeFileSync('scratch/ds-1108/pool-roster.tsv', lines.join('\n') + '\n');
console.log('pool roster: ' + (lines.length - 1) + ' 枚');
