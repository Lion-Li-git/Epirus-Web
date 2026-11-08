
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const P = 'champion-map/coords-gen3-1105.tsv';
copyFileSync(P, P + '.bak-v7new6');
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = lines[0].split('\t');
const iId = H.indexOf('id'), iLin = H.indexOf('lineage');
const TARGET = ['v7new6-94', 'v7new6-96'];
let n = 0;
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split('\t');
  if (TARGET.indexOf(c[iId]) < 0) continue;
  if (c[iLin] === '历代上槽') { c[iLin] = ''; n++; lines[i] = c.join('\t'); }
}
writeFileSync(P, lines.join(EOL) + EOL);
console.log('降级成空：' + n + ' 行（' + TARGET.join(' / ') + '）');
