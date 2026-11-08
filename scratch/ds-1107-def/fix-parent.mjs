
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const P = 'champion-map/lineage-g3.tsv';
copyFileSync(P, P + '.bak-parent');
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = lines[0].split('\t');
const h = Object.fromEntries(H.map((x, i) => [x, i]));
let n = 0;
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split('\t');
  if (!['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7'].includes(c[h.id])) continue;
  /* 父边不许指向图上没有的枚（页内自检）⇒ 直接挂教师 Q-s47（蒸馏的知识源） */
  c[h.parent] = 'Q-s47'; c[h.parentOf] = 'Q-s47'; c[h.parentName] = 'Q-s47'; c[h.parentSrc] = 'teacher';
  lines[i] = c.join('\t'); n++;
}
writeFileSync(P, lines.join(EOL) + EOL);
console.log('改父边 ' + n + ' 行 → Q-s47');
