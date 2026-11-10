
/* 把读数和 ruler 拆成 intake-rows3 要的单包形态，再逐个进图 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const IDS = [
  ['KD-G2', 'scratch/night-adapt2/KD-G2.bak'],
  ['FOCUS-Q-s13', 'scratch/ds-1108/FOCUS-Q-s13.js'],
  ['CLEAR-Q-s13', 'scratch/ds-1108/CLEAR-Q-s13.js'],
  ['WIDE-Q-s13', 'scratch/ds-1108/WIDE-Q-s13.js'],
];
const ruler = readFileSync('scratch/ds-1108/ruler-new.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const head = ruler[0];
for (const [id, pack] of IDS) {
  const row = ruler.slice(1).find(l => l.split('\t')[0] === id);
  if (!row) { console.error('ruler 缺 ' + id); process.exit(2); }
  writeFileSync('scratch/ds-1108/ruler-' + id + '.tsv', head + '\n' + row + '\n');
}
console.log('ruler per-pack 就绪');
