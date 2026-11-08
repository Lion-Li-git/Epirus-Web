
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const P = 'champion-map/lineage-g3.tsv';
copyFileSync(P, P + '.bak-fam17');
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ll = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const LH = ll[0].split('\t'), h = Object.fromEntries(LH.map((x, i) => [x, i]));
const LAB = 'v7 面 GA 对照臂（11-03 · 自 T8-s114 热启动克隆 · v:7 架构，不是 2.0 线）';
let n = 0;
for (let i = 1; i < ll.length; i++) {
  const c = ll[i].split('\t');
  if (!['V7C-s13','V7C-s41','V7M-s13','V7M-s41','V7L-s13','V7L-s41'].includes(c[h.id])) continue;
  c[h.fam] = '17'; c[h.famLabel] = LAB;
  ll[i] = c.join('\t'); n++;
}
writeFileSync(P, ll.join(EOL) + EOL);
console.log('改家族 ' + n + ' 枚 → fam 17「' + LAB + '」');
