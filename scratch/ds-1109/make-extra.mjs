
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const miss = 'CTRL2-Q-s7 CTRL2-Q-s13 ADAPT2-Q-s7 KD-K2 KD-Qg KD-K2-l PASS2-Q-s13 STR-B-Q-s13 STR-B-Q-s41 KDG-B-Q-s13 KD-Qg-l KD-G2 FOCUS-Q-s13 CLEAR-Q-s13 WIDE-Q-s13 WIDE2-Q-s13 WIDE2-200 WIDE2-300 WSEL9-200 G5C-100 G5I-50 G5G-50 G5J-50'.split(' ');
const cands = (id) => [
  'docs/artifacts/night-adapt/' + id + '.js',
  'docs/artifacts/night-adapt/' + id + '.bak',
  'scratch/ds-1109/' + id + '.js',
  'scratch/ds-1108/' + id + '.js',
  'scratch/ga-arms/' + id + '.js',
  'scratch/night-adapt2/' + id + '.bak',
  'scratch/night-adapt2/' + id + '.js',
];
const lines = ['arm\tproductRel'];
const bad = [];
for (const id of miss) {
  const hit = cands(id).find(p => existsSync(p));
  if (hit) lines.push(id + '\t' + hit); else bad.push(id);
}
writeFileSync('champion-map/extra-all-1109.tsv', lines.join('\n') + '\n');
console.log('写 ' + (lines.length - 1) + ' 行；找不到：' + (bad.join(' ') || '无'));
