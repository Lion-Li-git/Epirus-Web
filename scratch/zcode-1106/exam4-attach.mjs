/* 四格卷读数挂列（11-07 午）：把 exam4-all-1107.tsv 的 X 系列写进两张 coords 表
 * 新列：X2/X3/X5/X8（excess = (p−1/N)/(1−1/N)，§10.1/§10.6——大写 X 避开既有几何列 x2/y2/x3/y3/z3）+ n2/n3/n5/n8（每格局数，读数的诚实度随行）
 * 覆盖守卫：coords 每一行都必须在批表里有行（缺了就点名，除非 --allow-missing）
 * 备份：写前各自落 .bak-exam4
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const ALLOW_MISSING = process.argv.includes('--allow-missing');

const bt = rd('champion-map/exam4-all-1107.tsv'), bh = Object.fromEntries(bt[0].map((x, i) => [x, i]));
const seeds = new Set(), rounds = new Set();
const B = {};
for (const r of bt.slice(1)) {
  if (!r[bh.id]) continue;
  if (B[r[bh.id]]) { console.error('⛔ 批表里 id 重复：' + r[bh.id]); process.exit(2); }
  B[r[bh.id]] = r;
  seeds.add(r[bh.seed]); rounds.add(r[bh.rounds]);
}
if (seeds.size !== 1 || rounds.size !== 1) { console.error('⛔ 批表 seed/rounds 不齐：' + [...seeds] + ' / ' + [...rounds] + ' ⇒ 混批不许挂'); process.exit(2); }
console.log('批表：' + (bt.length - 1) + ' 枚 ‖ seed=' + [...seeds][0] + ' rounds=' + [...rounds][0]);

const NEWC = ['X2', 'X3', 'X5', 'X8', 'n2', 'n3', 'n5', 'n8'];
for (const F of ['champion-map/coords-gen3-1105.tsv', 'champion-map/coords.tsv']) {
  copyFileSync(F, F + '.bak-exam4');
  const co = rd(F), h = Object.fromEntries(co[0].map((x, i) => [x, i]));
  for (const c of NEWC) if (h[c] !== undefined) { console.error('⛔ ' + F + ' 已有 ' + c + ' 列 ⇒ 幂等守卫（重挂先删旧列）'); process.exit(2); }
  const miss = [];
  const KEYOF = { X2: 'x2', X3: 'x3', X5: 'x5', X8: 'x8', n2: 'n2', n3: 'n3', n5: 'n5', n8: 'n8' };   // 挂列名大写 X（§10.6，避几何列），批表键小写
  for (let r = 1; r < co.length; r++) {
    const id = co[r][h.id];
    const b = B[id];
    if (!b) { miss.push(id); for (const c of NEWC) co[r].push(''); continue; }   // 缺测占位空串
    for (const c of NEWC) co[r].push(b[bh[KEYOF[c]]] ?? '');
  }
  if (miss.length && !ALLOW_MISSING) {
    console.error('⛔ ' + F + ' 有 ' + miss.length + ' 行在批表里没有：' + miss.slice(0, 8).join(' ') + (miss.length > 8 ? ' …' : '') + ' ⇒ 先补测或 --allow-missing');
    process.exit(2);
  }
  co[0] = co[0].concat(NEWC);   // 表头补列名（首版漏了 ⇒ 数据行多 8 格而表头没名）
  writeFileSync(F, co.map(r => r.join('\t')).join('\n') + '\n');
  console.log((miss.length ? '⚠ ' + miss.length + ' 行缺测（占位空串） ‖ ' : '') + '已写 ' + F + '（+' + NEWC.join('/') + ' 列）');
}
console.log('挂列完成 ⇒ 下一步 attach-projcols + 重烘');
