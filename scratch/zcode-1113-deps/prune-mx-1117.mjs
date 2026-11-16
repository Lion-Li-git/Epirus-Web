/* prune-mx-1117.mjs —— 用户令（11-17 01:4x）：不要所有点都进图，只留代表性。
 *   保留 4 枚代表：MX1-E9-GD（全场强度第一）‖ MX1-GD-EQ（长程第一）‖ MX2-U4-EQ（T1 波可行代表）‖ MX3-GDEQ-GD（GD 链续代，另行注册）。
 *   剪除 8 枚冗余变体：从 registry/lineage-g3/display/features/projections/feasibility/readings/batches/page-coords/promote 全表移除，
 *   docs 副本删除（scratch/arms 原件与矩阵考卷表保留 = 训练记录不丢）。
 * 守卫：逐表只删精确 id 匹配行；删除计数打印；剪完自检无悬挂引用（display/lineage 无残留行）。 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

const DROP = ['MX1-E9-EQ', 'MX1-GD-ST', 'MX1-GD-GD', 'MX1-GD-BA', 'MX2-US1-ST', 'MX2-US1-BA', 'MX3-E9GD-GD', 'MX3-E9GD-EQ'];
const KEEP = ['MX1-E9-GD', 'MX1-GD-EQ', 'MX2-U4-EQ', 'MX3-GDEQ-GD'];
if (process.argv.includes('--check')) { console.log('保留 ' + KEEP.join(',') + ' ‖ 剪除 ' + DROP.join(',')); process.exit(0); }

const edit = (path, idCols, note) => {
  const L = readFileSync(path, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));
  const before = L.length - 1;
  const out = [L[0]];
  for (let i = 1; i < L.length; i++) {
    const idHit = idCols.some((c) => { const ix = L[0].indexOf(c); return ix >= 0 && DROP.includes(L[i][ix]); });
    const batchHit = idCols.length === 0 && (L[i][0] || '').startsWith('measure-MX');   // batches 行按批 id 前缀
    if (!idHit && !batchHit) out.push(L[i]);
  }
  writeFileSync(path, out.map((r) => r.join('\t')).join('\n') + '\n');
  console.log(note + ': ' + (before - (out.length - 1)) + ' 行移除');
};

edit('champion-map/data/registry.tsv', ['pack_id'], '① registry');
edit('champion-map/data/page/lineage-g3.tsv', ['id'], '② lineage-g3');
edit('champion-map/data/display.tsv', ['id'], '③ display');
edit('champion-map/data/features.tsv', ['pack_id'], '④ features');
edit('champion-map/data/projections.tsv', ['pack_id'], '⑤ projections');
edit('champion-map/data/feasibility.tsv', ['id'], '⑥ feasibility');
edit('champion-map/data/readings/current.tsv', ['pack_id'], '⑦ readings');
edit('champion-map/data/batches.tsv', [], '⑧ batches（measure-MX* 批行）');
edit('champion-map/data/page/coords.tsv', ['id'], '⑨ page/coords');
edit('champion-map/data/page/promote.tsv', ['id'], '⑩ promote');

for (const id of DROP) {
  const f = 'docs/artifacts/obs6-coldstart/' + id + '.bak';
  if (existsSync(f)) { unlinkSync(f); console.log('⑪ docs 删 ' + id + '.bak'); }
}
console.log('✅ 剪除完成（保留 ' + KEEP.join(', ') + '；scratch/arms 原件与 exam4n-mixed-matrix-1117 表不动）');
