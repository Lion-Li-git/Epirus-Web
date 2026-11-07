/* 摘 GD3-ALL（第二遍，这次摘在进表源）：11-07 晨复盘
 * 0dbe01e1 只摘了四张输出表（1105/projcols/view-20/extra-g3-1105）+ 重烘，
 * 没动 scratch/night6/ruler-g3.tsv —— night6-join 的 ③ 号进表源（join 脚本 129 行）。
 * 深夜班 59aebfaa 重跑整合链 ⇒ 从 ruler-g3.tsv 复活 ⇒ 图上 GD3-ALL 又回来了。
 * 本次：输出三表 + 进表源一起摘；measure 类表（epsfull/feas/lineage/strength）保留不动——
 *   它们是测量记录，join 只拿它们填已存在行的 Hp，不产新行，不是复活向量。
 */
import { readFileSync, writeFileSync } from 'node:fs';
const TARGETS = [
  'scratch/night6/ruler-g3.tsv',            // ← 上次漏掉的进表源（复活向量本体）
  'champion-map/coords-gen3-1105.tsv',
  'champion-map/coords-projcols.tsv',
  'champion-map/coords-view-20.tsv',
];
let total = 0;
for (const f of TARGETS) {
  const raw = readFileSync(f, 'utf8');
  const crlf = raw.indexOf('\r\n') >= 0;
  const eol = crlf ? '\r\n' : '\n';
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const head = lines[0].split('\t').indexOf('id');
  if (head < 0) throw new Error(f + ' 表头无 id 列');
  const before = lines.length;
  const kept = [lines[0]].concat(lines.slice(1).filter(l => l.split('\t')[head] !== 'GD3-ALL'));
  const dropped = before - kept.length;
  if (dropped) writeFileSync(f, kept.join(eol));
  console.log((dropped ? '摘 ' + dropped + ' 行' : '无 GD3-ALL（跳过）') + ' ← ' + f);
  total += dropped;
}
console.log('共摘 ' + total + ' 行');
