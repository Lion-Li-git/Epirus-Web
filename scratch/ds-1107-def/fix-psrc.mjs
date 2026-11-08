
import { readFileSync, writeFileSync } from 'node:fs';
const P = 'champion-map/lineage-g3.tsv';
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = lines[0].split('\t'), h = Object.fromEntries(H.map((x, i) => [x, i]));
let n = 0;
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split('\t');
  if (!['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7'].includes(c[h.id])) continue;
  c[h.parentSrc] = 'arm'; lines[i] = c.join('\t'); n++;
}
writeFileSync(P, lines.join(EOL) + EOL);
console.log('parentSrc→arm ' + n);
