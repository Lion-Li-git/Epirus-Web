/* 四格卷长程批挂列（11-07 傍晚）：exam4-all-long-1107.tsv → 两张 coords 表的 X2L/X3L/X5L/X8L + n2L..n8L
 * 列名 L 后缀（与 viewer 的 X4(d) 桌形选择对应）；批表键仍小写 x2..n8（KEYOF 映射）。
 * 幂等守卫 + 表头补名（短程那回的表头漏名病，这里第一次就做对）+ 覆盖守卫。
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const ALLOW_MISSING = process.argv.includes('--allow-missing');

const bt = rd('champion-map/exam4-all-long-1107.tsv'), bh = Object.fromEntries(bt[0].map((x, i) => [x, i]));
const seeds = new Set(), rounds = new Set(), modes = new Set();
const B = {};
for (const r of bt.slice(1)) {
  if (!r[bh.id]) continue;
  if (B[r[bh.id]]) { console.error('⛔ 批表 id 重复：' + r[bh.id]); process.exit(2); }
  B[r[bh.id]] = r; seeds.add(r[bh.seed]); rounds.add(r[bh.rounds]); if (r[bh.mode]) modes.add(r[bh.mode]);
}
if (seeds.size !== 1 || rounds.size !== 1) { console.error('⛔ 批表 seed/rounds 不齐：' + [...seeds] + ' / ' + [...rounds]); process.exit(2); }
console.log('长程批表：' + (bt.length - 1) + ' 枚 ‖ seed=' + [...seeds][0] + ' rounds=' + [...rounds][0] + ' mode=' + [...modes].join('/'));

const NEWC = ['X2L', 'X3L', 'X5L', 'X8L', 'n2L', 'n3L', 'n5L', 'n8L'];
const KEYOF = { X2L: 'x2', X3L: 'x3', X5L: 'x5', X8L: 'x8', n2L: 'n2', n3L: 'n3', n5L: 'n5', n8L: 'n8' };
for (const F of ['champion-map/coords-gen3-1105.tsv', 'champion-map/coords.tsv']) {
  copyFileSync(F, F + '.bak-exam4L');
  const co = rd(F), h = Object.fromEntries(co[0].map((x, i) => [x, i]));
  for (const c of NEWC) if (h[c] !== undefined) { console.error('⛔ ' + F + ' 已有 ' + c + ' 列 ⇒ 幂等守卫'); process.exit(2); }
  const miss = [];
  for (let r = 1; r < co.length; r++) {
    const id = co[r][h.id];
    const b = B[id];
    if (!b) { miss.push(id); for (const c of NEWC) co[r].push(''); continue; }
    for (const c of NEWC) co[r].push(b[bh[KEYOF[c]]] ?? '');
  }
  if (miss.length && !ALLOW_MISSING) {
    console.error('⛔ ' + F + ' 有 ' + miss.length + ' 行缺测：' + miss.slice(0, 8).join(' ') + ' ⇒ 先补测或 --allow-missing');
    process.exit(2);
  }
  co[0] = co[0].concat(NEWC);   // 表头补名（短程那回的教训，第一次就做对）
  writeFileSync(F, co.map(r => r.join('\t')).join('\n') + '\n');
  console.log((miss.length ? '⚠ ' + miss.length + ' 行缺测占位 ‖ ' : '') + '已写 ' + F + '（+' + NEWC.join('/') + '）');
}
console.log('长程挂列完成 ⇒ attach-projcols + 重烘');
