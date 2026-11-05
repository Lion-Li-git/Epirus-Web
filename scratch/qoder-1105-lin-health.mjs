/* 新 lineage-g3.tsv 的图健康检查（Qoder · 11-05）
 * 症状：换上这张表之后，2.0 子集页的页内自检在 shot.mjs 的虚拟时间下**不再落 #selftest**
 *   （同预算下旧表 74/3/22 正常）。怀疑补出来的 4 条 `hash` 级父边里有**环**或**指向子集外**的父
 *   ⇒ 追溯链/父边那条链上的遍历转不出来，虚拟时间烧光，自检就永远写不进去。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = join(import.meta.dirname, '..');
const tsv = (f) => { const L = readFileSync(join(ROOT, f), 'utf8').replace(/\r/g, '').trim().split('\n'); const h = L[0].split('\t');
  return L.slice(1).map(l => { const c = l.split('\t'); const o = {}; h.forEach((k, i) => o[k] = c[i]); return o; }); };
const lin = tsv('champion-map/lineage-g3.tsv');
const sub = new Set(tsv('champion-map/coords-view-20.tsv').map(r => r.id));
const P = {}; for (const r of lin) if (r.parentOf) P[r.id] = r.parentOf;

console.log('== 新表 parentOf 边 ' + Object.keys(P).length + ' 条 ==');
/* 1) 指向子集外的父（子集页的 DATA 里没有它） */
const outside = Object.entries(P).filter(([, p]) => !sub.has(p));
console.log('   父不在 39 枚子集里：' + outside.length + (outside.length ? ' ⇒ ' + outside.slice(0, 8).map(([a, b]) => a + '←' + b).join(' ‖ ') : ''));
/* 2) 二元环（A←B 且 B←A） */
const cyc2 = Object.entries(P).filter(([a, b]) => P[b] === a);
console.log('   二元环（A←B 且 B←A）：' + cyc2.length + (cyc2.length ? ' ⇒ ' + cyc2.map(([a, b]) => a + '⇄' + b).join(' ‖ ') : ''));
/* 3) 任意长度的环：从每个点沿父链走，步数上限 = 节点数 */
const loops = [];
for (const start of Object.keys(P)) {
  const seen = new Set(); let cur = start, steps = 0;
  while (P[cur] && steps++ <= Object.keys(P).length + 2) {
    if (seen.has(cur)) { break; }
    seen.add(cur); cur = P[cur];
    if (cur === start) { loops.push(start); break; }
  }
}
console.log('   回到自己的起点（含自环/长环）：' + loops.length + (loops.length ? ' ⇒ ' + loops.slice(0, 8).join(' ‖ ') : ''));
/* 4) parentSrc 分布与新增的 hash 级边明细 */
const src = {}; for (const r of lin) src[r.parentSrc || '(空)'] = (src[r.parentSrc || '(空)'] || 0) + 1;
console.log('   parentSrc 分布：' + Object.entries(src).map(([k, v]) => k + ' ' + v).join(' ‖ '));
console.log('   新补的 hash 级边：' + lin.filter(r => r.parentSrc === 'hash').map(r => r.id + '←' + r.parentOf).join(' ‖ '));
console.log('   升到 seedpack-wid 的：' + lin.filter(r => r.parentSrc === 'seedpack-wid').length + ' 条');
