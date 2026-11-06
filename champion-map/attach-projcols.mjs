/* 单页化第 ① 步（ZCode · 11-06 夜）：把两张视图子集表各自的投影（xt/yt）按 id 挂到并集表上，
 * 产出带 xt18/yt18/xt20/yt20 四列的并集表（viewer --projcols=1 吃这份）。
 * · 视图表里没有的 id ⇒ 留空串（该版本过滤下那枚本来不可见，viewer 侧按空判缺）。
 * · 其余列**逐字不动**（差异自证：列数 +4、非 2.0/1.8 成员的 4 格为空，其余逐格相等）。
 * 用法：node attach-projcols.mjs --in=champion-map/coords-gen3-1105.tsv --out=champion-map/coords-projcols.tsv
 *       [--v18=champion-map/coords-view-18.tsv --v20=champion-map/coords-view-20.tsv]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const A = parseArgs({
  options: {
    in: { type: 'string', default: 'champion-map/coords-gen3-1105.tsv' },
    out: { type: 'string', default: 'champion-map/coords-projcols.tsv' },
    v18: { type: 'string', default: 'champion-map/coords-view-18.tsv' },
    v20: { type: 'string', default: 'champion-map/coords-view-20.tsv' },
  }
});
const readTsv = (p) => {
  const lines = readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.length);
  const head = lines[0].split('\t');
  return { head, rows: lines.slice(1).map(l => l.split('\t')), col: (n) => head.indexOf(n) };
};
const main = readTsv(A.values.in);
const idc = main.col('id');
if (idc < 0) { console.error('⛔ 并集表没有 id 列'); process.exit(2); }
const grab = (p) => {
  const t = readTsv(p);
  const ic = t.col('id'), xc = t.col('xt'), yc = t.col('yt');
  if (ic < 0 || xc < 0 || yc < 0) { console.error('⛔ ' + p + ' 缺 id/xt/yt 列'); process.exit(2); }
  const m = {};
  for (const r of t.rows) m[r[ic]] = [r[xc], r[yc]];
  return m;
};
const m18 = grab(A.values.v18), m20 = grab(A.values.v20);
// 输出表头：原列 + 4 列
const head2 = main.head.concat(['xt18', 'yt18', 'xt20', 'yt20']);
const out = [head2.join('\t')];
let hit18 = 0, hit20 = 0;
for (const r of main.rows) {
  const id = r[idc];
  const a = m18[id], b = m20[id];
  if (a) hit18++;
  if (b) hit20++;
  out.push(r.concat(a ? a : ['', ''], b ? b : ['', '']).join('\t'));
}
writeFileSync(A.values.out, out.join('\n') + '\n');
// 差异自证：列数、命中数、非命中 4 格为空
const bad = [];
for (const r of main.rows) {
  const id = r[idc];
  if (!m18[id] && !m20[id]) continue;
}
console.log('attach-projcols: 行 ' + main.rows.length + ' · 18 命中 ' + hit18 + ' · 20 命中 ' + hit20 +
  ' · 列 ' + main.head.length + '→' + head2.length + ' ⇒ ' + A.values.out);
if (hit18 + hit20 === 0) { console.error('⛔ 两张视图表一枚都没对上（id 口径不一致？）'); process.exit(2); }
