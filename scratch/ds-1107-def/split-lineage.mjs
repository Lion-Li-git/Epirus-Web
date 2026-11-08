
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const P = 'champion-map/coords-gen3-1105.tsv';
copyFileSync(P, P + '.bak-kind');
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = lines[0].split('\t');
const iId = H.indexOf('id'), iLin = H.indexOf('lineage'), iKin = H.indexOf('kin');
let n = 0, moved = 0;
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split('\t');
  if (c[iLin] !== '代3臂产物') continue;
  n++;
  c[iLin] = '';
  if (!c[iKin]) { c[iKin] = '代3臂产物'; moved++; }
  lines[i] = c.join('\t');
}
writeFileSync(P, lines.join(EOL) + EOL);
console.log('清掉 lineage 代3臂产物 ' + n + ' 行（其中 ' + moved + ' 行把来源写进 kin）');
