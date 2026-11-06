/* 11-06 晨 · D-18 的那张 A/B：把 10 枚新池名从常驻名单里摘掉，量同一套页内自检的「被名字压住的点」。
 * 只造页面副本（scratch/qoder-1106-label-ab.html，不提交那份 1.4MB 副本），不动在册产物。
 * 跑法：node scratch/qoder-1106-label-ab-build.mjs && node champion-map/shot.mjs --html=scratch/qoder-1106-label-ab.html '--hash=mode=map&check=1&detail=1' --dump
 * 实测：摘掉 ⇒ 盖住的点 131 ‖ 标签 29；装回（在册页）⇒ 172 ‖ 标签 39 ⇒ 每条常驻池名压 4.1 枚，与存量 29 条（131/29≈4.5）同级。
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NEW = ['DSTR4-s13', 'EFFG-s5', 'EFFG-s7', 'GD3ALL-POPP-s41', 'GD3ALL-PUSHON-s13',
  'D-b-hpseed-s13', 'DDEF-s13', 'DSTR-s13', 'LE-s13', 'GD3ALL-G5-s13'];
const P = 'champion-map/index.html';
const s = readFileSync(P, 'utf8');
const i = s.indexOf('var DATA ='), j = s.indexOf(';', i);
const arr = JSON.parse(s.slice(i + 'var DATA ='.length, j).trim());
let n = 0;
for (const x of arr) if (NEW.indexOf(x.id) >= 0 && x.pt) { x.pt = ''; n++; }   /* pt = 池档，页内 isLabOn 靠它给常驻名 */
writeFileSync('scratch/qoder-1106-label-ab.html', s.slice(0, i + 'var DATA ='.length) + JSON.stringify(arr) + s.slice(j));
console.log('摘掉常驻池名 ' + n + ' 条（预期 10）⇒ scratch/qoder-1106-label-ab.html');
if (n !== 10) process.exit(3);
