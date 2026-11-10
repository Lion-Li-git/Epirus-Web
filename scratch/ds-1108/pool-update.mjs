
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
/* 1) 把三枚包搬进 docs/artifacts（池成员必须入库；scratch 会被清） */
const mv = [
  ['scratch/night-adapt2/KD-G2.bak', 'docs/artifacts/night-adapt/KD-G2.bak'],
  ['scratch/ds-1108/FOCUS-Q-s13.js', 'docs/artifacts/night-adapt/FOCUS-Q-s13.js'],
  ['scratch/ds-1108/CLEAR-Q-s13.js', 'docs/artifacts/night-adapt/CLEAR-Q-s13.js'],
  ['scratch/ds-1108/WIDE-Q-s13.js', 'docs/artifacts/night-adapt/WIDE-Q-s13.js'],
];
for (const [a, b] of mv) if (!existsSync(b)) { copyFileSync(a, b); console.log('复制 ' + b); }
/* 2) 改池表 */
const P = 'champion-map/pool-members.tsv';
copyFileSync(P, P + '.bak-ds-pool');
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ll = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = ll[0].split('\t'); const h = Object.fromEntries(H.map((x, i) => [x, i]));
const demote = ['EFFG-s5', 'EFFG-s7', 'DEF-s15', 'DEF-s16', 'STR-B-Q-s41'];
let n = 0;
for (let i = 1; i < ll.length; i++) {
  const c = ll[i].split('\t');
  if (demote.includes(c[h.id])) { c[h.tier] = 'soft'; c[h.note] = (c[h.note] || '') + ' ‖ 11-08 夜降软（硬带改口径：强且宽/干净）'; ll[i] = c.join('\t'); n++; }
}
console.log('降软 ' + n + ' 枚');
const add = [
  ['KD-G2', 'docs/artifacts/night-adapt/KD-G2.bak', '9 张卡/防御三件全开/场A 26.3/场B 0（缺 1 型门）· X̄₄ 0.246/0.338'],
  ['FOCUS-Q-s13', 'docs/artifacts/night-adapt/FOCUS-Q-s13.js', '集火奖励臂（KD-G2 种子）8 张卡/三件全开/场A 25.5/场B 0 · X̄₄ 0.314/0.352'],
  ['CLEAR-Q-s13', 'docs/artifacts/night-adapt/CLEAR-Q-s13.js', '清场奖励臂（KD-G2 种子）7 张卡/场A 33.4（全池最高）/场B 0 · X̄₄ 0.334/0.333'],
];
const now = new Date().toUTCString();
for (const [id, path, note] of add) {
  if (ll.some(l => l.split('\t')[0] === id)) { console.log(id + ' 已在池'); continue; }
  const wid = widOf(readFileSync(path, 'utf8'));
  const r = H.map(() => '');
  const set = (k, v) => { r[h[k]] = String(v); };
  set('id', id); set('wid', wid); set('path', path); set('tier', 'hard'); set('invited', '0');
  set('promoteVerdict', ''); set('seatKill', '-1'); set('addedAt', now); set('note', '11-08 夜进硬带（用户令：代表性点进图、好包入池）：' + note);
  ll.push(r.join('\t'));
  console.log('入池 ' + id + ' wid=' + wid);
}
writeFileSync(P, ll.join(EOL) + EOL);
console.log('池表 → ' + (ll.length - 1) + ' 枚');
