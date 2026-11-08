
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('scratch/ds-1108/card-usage.tsv');
const H = t[0]; const idx = Object.fromEntries(H.map((x, i) => [x, i]));
const rows = t.slice(1).filter(r => r[0]);
const V7 = new Set(['Q-s47','T8-s114','U-s205']);
const g = (r, k) => +r[idx[k]] || 0;
console.log('包 | 防御三件(guard/reflect/bagua) | 用了几件 | 狙击 | 全息');
for (const r of rows) {
  const trio = ['guard','reflect','bagua'].map(k => k + ' ' + g(r,k).toFixed(0)).join('/');
  const n = ['guard','reflect','bagua'].filter(k => g(r,k) >= 0.5).length;
  console.log((V7.has(r[0]) ? '*' + r[0] : r[0]).padEnd(18) + trio.padEnd(26) + n + '/3   snipe ' + g(r,'snipe').toFixed(1) + '  holo ' + g(r,'holo').toFixed(1));
}
