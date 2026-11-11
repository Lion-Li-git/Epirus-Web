
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const P = 'champion-map/pool-members.tsv';
copyFileSync(P, P + '.bak-swap');
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ll = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = ll[0].split('\t'); const h = Object.fromEntries(H.map((x, i) => [x, i]));
let moved = 0;
for (let i = 1; i < ll.length; i++) {
  const c = ll[i].split('\t');
  if (c[h.id] === 'WIDE2-200') { c[h.tier] = 'hard'; c[h.note] = (c[h.note] || '') + ' ‖ 11-09 午用户裁：强度够硬带（长桌 0.352 / 9 卡 / 防御 26%）'; ll[i] = c.join('\t'); moved++; }
  if (c[h.id] === 'DEF-s13') { c[h.tier] = 'soft'; c[h.note] = (c[h.note] || '') + ' ‖ 11-09 午降软（换 WIDE2-200 进硬带）：全池分数最低 0.159、防御三件只 1 件'; ll[i] = c.join('\t'); moved++; }
}
writeFileSync(P, ll.join(EOL) + EOL);
console.log('换带 ' + moved + ' 条');
const t = ll.slice(1).map(l => l.split('\t'));
console.log('硬带：' + t.filter(r => r[h.tier] === 'hard').map(r => r[h.id]).join(' '));
console.log('软带：' + t.filter(r => r[h.tier] === 'soft').map(r => r[h.id]).join(' '));
