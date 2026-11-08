
import { readFileSync } from 'node:fs';
for (const f of ['champion-map/coords-projcols.tsv']) {
  const raw = readFileSync(f, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const H = lines[0].split('\t');
  console.log(f, 'cols=' + H.length, 'rows=' + (lines.length - 1));
  console.log('列：', H.join(' / '));
  const x = H.filter(h => /^X|^n[2358]$|L$/.test(h));
  console.log('X/长程列：', x.join(' '));
  const first = lines[1].split('\t');
  console.log('首行样例：', H.map((h, i) => h + '=' + (first[i] || '')).slice(0, 8).join(' '));
}
