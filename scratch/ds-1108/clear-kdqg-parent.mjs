
import { readFileSync, writeFileSync } from 'node:fs';
const P = 'champion-map/lineage-g3.tsv';
const lw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = lw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ll = lw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const LH = ll[0].split('\t'), h = Object.fromEntries(LH.map((x, i) => [x, i]));
for (let i = 1; i < ll.length; i++) {
  const c = ll[i].split('\t');
  if (c[h.id] !== 'KD-Qg') continue;
  /* 它的 hotstartFrom = 472e50814709da66 不图上 ⇒ 不画父边（空），不拿教师项冒充血统 */
  c[h.parent] = ''; c[h.parentOf] = ''; c[h.parentName] = ''; c[h.parentSrc] = '';
  ll[i] = c.join('\t');
  console.log('KD-Qg 父边清空（hotstart 源不在图上）');
}
writeFileSync(P, ll.join(EOL) + EOL);
