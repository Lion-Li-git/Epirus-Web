
import { execSync } from 'node:child_process';
const rd = (txt) => txt.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const oldT = rd(execSync('git show c7a3656c:champion-map/coords-gen3-1105.tsv', { encoding: 'utf8' }));
const newT = rd(execSync('git show HEAD:champion-map/coords-gen3-1105.tsv', { encoding: 'utf8' }));
const h = Object.fromEntries(oldT[0].map((x, i) => [x, i]));
const om = new Map(oldT.slice(1).map(r => [r[h.id], r]));
let changed = 0, same = 0, maxd = 0;
for (const r of newT.slice(1)) {
  const o = om.get(r[h.id]); if (!o) continue;
  const dx = Math.abs(+r[h.xt] - +o[h.xt]), dy = Math.abs(+r[h.yt] - +o[h.yt]);
  if (dx < 1e-9 && dy < 1e-9) same++; else { changed++; maxd = Math.max(maxd, dx, dy); }
}
console.log('旧点里 xt/yt 完全不变的: ' + same + '  变了的: ' + changed + '  最大位移: ' + maxd.toFixed(4));
