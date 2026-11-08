
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('scratch/ds-1108/card-usage.tsv');
const H = t[0]; const cards = H.slice(5);
const rows = t.slice(1).filter(r => r[0]);
console.log('全表出现过的卡（' + cards.length + '）：' + cards.join(' '));
/* 每张卡：用它的枚数 / 最高使用率 */
for (const k of cards) {
  const i = H.indexOf(k);
  const vals = rows.map(r => +r[i] || 0);
  const n = vals.filter(v => v >= 0.5).length;
  console.log('  ' + k.padEnd(10) + ' 用它的枚数 ' + String(n).padStart(2) + '/' + rows.length + '  最高 ' + Math.max(...vals).toFixed(1) + '%');
}
