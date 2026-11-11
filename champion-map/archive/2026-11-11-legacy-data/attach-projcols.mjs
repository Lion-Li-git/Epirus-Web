/* 单页化第 ① 步（ZCode · 11-06 夜）：把两张视图子集表各自的投影（xt/yt）按 id 挂到并集表上，
 * 产出带 xt18/yt18/xt20/yt20 四列的并集表（viewer --projcols=1 吃这份）。
 * 11-11 阶段 3：走 map-table 单一入口；已有四列时原位覆盖（幂等），不重复追加。
 * 用法：node attach-projcols.mjs --in=champion-map/coords-gen3-1105.tsv --out=champion-map/coords-projcols.tsv
 *       [--v18=champion-map/coords-view-18.tsv --v20=champion-map/coords-view-20.tsv]
 */
import { parseArgs } from 'node:util';
import { readTable, writeTable, tableStamp } from './map-table.mjs';

const A = parseArgs({
  options: {
    in: { type: 'string', default: 'champion-map/coords-gen3-1105.tsv' },
    out: { type: 'string', default: 'champion-map/coords-projcols.tsv' },
    v18: { type: 'string', default: 'champion-map/coords-view-18.tsv' },
    v20: { type: 'string', default: 'champion-map/coords-view-20.tsv' },
  }
});
const main = readTable(A.values.in);
const idc = main.ix.id;
if (idc === undefined) { console.error('⛔ 并集表没有 id 列'); process.exit(2); }
const grab = (p) => {
  const t = readTable(p);
  if (t.ix.id === undefined || t.ix.xt === undefined || t.ix.yt === undefined) {
    console.error('⛔ ' + p + ' 缺 id/xt/yt 列'); process.exit(2);
  }
  const m = {};
  for (const r of t.rows) m[r[t.ix.id]] = [r[t.ix.xt], r[t.ix.yt]];
  return m;
};
const m18 = grab(A.values.v18), m20 = grab(A.values.v20);
const COLS = ['xt18', 'yt18', 'xt20', 'yt20'];
const head = main.header.slice();
const idx = COLS.map((c) => { let i = head.indexOf(c); if (i < 0) { head.push(c); i = head.length - 1; } return i; });
const rows = [];
let hit18 = 0, hit20 = 0;
for (const r of main.rows) {
  const id = r[idc], a = m18[id], b = m20[id];
  if (a) hit18++;
  if (b) hit20++;
  const row = r.slice();
  while (row.length < head.length) row.push('');
  row[idx[0]] = a ? a[0] : ''; row[idx[1]] = a ? a[1] : '';
  row[idx[2]] = b ? b[0] : ''; row[idx[3]] = b ? b[1] : '';
  rows.push(row);
}
console.log('[map-table] in ' + tableStamp(main));
const w = writeTable(A.values.out, { header: head, rows: rows }, { backupTool: 'attach-projcols' });
console.log('attach-projcols: 行 ' + rows.length + ' · 18 命中 ' + hit18 + ' · 20 命中 ' + hit20 +
  ' · 列 ' + main.header.length + '→' + head.length + ' ⇒ ' + A.values.out + '（备份 ' + (w.backup ? '有' : '无') + '）');
if (hit18 + hit20 === 0) { console.error('⛔ 两张视图表一枚都没对上（id 口径不一致？）'); process.exit(2); }
if (COLS.some((c) => main.ix[c] !== undefined) && head.length === main.header.length) {
  console.log('⚠ 输入表已带四列：原位覆盖（幂等）');
}
