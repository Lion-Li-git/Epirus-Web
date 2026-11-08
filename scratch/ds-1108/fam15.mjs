
import { readFileSync, writeFileSync } from 'node:fs';
const P = 'champion-map/lineage-g3.tsv';
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ll = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const LH = ll[0].split('\t'), h = Object.fromEntries(LH.map((x, i) => [x, i]));
const NEWLAB = 'gen-3 实验臂（11-01 era）∪ v7 面 GA 对照臂（11-03 · 自 T8-s114 热启动 · v:7 架构）';
const SIX = ['V7C-s13','V7C-s41','V7M-s13','V7M-s41','V7L-s13','V7L-s41'];
let n = 0;
for (let i = 1; i < ll.length; i++) {
  const c = ll[i].split('\t');
  if (SIX.includes(c[h.id])) { c[h.fam] = '15'; c[h.famLabel] = NEWLAB; n++; }
  else if (c[h.fam] === '15') c[h.famLabel] = NEWLAB;
  ll[i] = c.join('\t');
}
writeFileSync(P, ll.join(EOL) + EOL);
console.log('6 枚归回 fam 15，fam 15 标签改为：' + NEWLAB);
