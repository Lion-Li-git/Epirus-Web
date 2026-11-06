import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
const dir = 'champion-map';
const all = readdirSync(dir, { withFileTypes: true }).filter(x => x.isFile()).map(x => x.name);
const nameSet = new Set(all);
// 谁提到谁：扫所有代码 + 页面文件，找出现有文件名（按 basename 精确命中）
const edges = new Map();
for (const f of all) {
  const p = join(dir, f);
  let t = '';
  try { t = readFileSync(p, 'utf8'); } catch { continue; }
  const out = [];
  for (const g of all) { if (g === f) continue; if (t.includes(g)) out.push(g); }
  edges.set(f, out);
}
// 活入口：烘页 / 重算面板 / 自检 / 门读的表 / 产品读的表
const ROOTS = ['viewer.mjs', 'rebuild-coords.mjs', 'shot.mjs', 'lint-viewer.mjs', 'pack-guard.mjs', 'point-data.mjs', 'point-data.tsv',
  'pool-members.tsv', 'pool-members-2p.tsv', 'pack-aliases.tsv', 'pool-sync.mjs', 'pool-arrange.mjs', 'pool-screen.mjs',
  'coords-projcols.tsv', 'lineage.tsv', 'lineage-g3.tsv', 'bake-flags.txt', 'dupes-manifest.tsv', 'index.html'];
const seen = new Set(); const stack = ROOTS.filter(r => nameSet.has(r));
while (stack.length) { const x = stack.pop(); if (seen.has(x)) continue; seen.add(x); for (const y of (edges.get(x) || [])) if (!seen.has(y)) stack.push(y); }
const keep = all.filter(x => seen.has(x));
const drop = all.filter(x => !seen.has(x));
const sizeOf = x => statSync(join(dir, x)).size;
const dropData = drop.filter(x => /\.(tsv|json|txt|bak)$/i.test(x));
const dropHtml = drop.filter(x => /\.html$/i.test(x));
const dropCode = drop.filter(x => /\.(mjs|js)$/i.test(x));
const sum = arr => arr.reduce((s, x) => s + sizeOf(x), 0) / 1024 / 1024;
console.log('总 ' + all.length + ' 个文件 / ' + (all.reduce((s, x) => s + sizeOf(x), 0) / 1024 / 1024).toFixed(1) + ' MB');
console.log('可保留（从活入口可达）' + keep.length + ' 个');
console.log('可归档 ' + drop.length + ' 个：数据 ' + dropData.length + ' (' + sum(dropData).toFixed(2) + ' MB) ‖ 页面 ' + dropHtml.length + ' (' + sum(dropHtml).toFixed(2) + ' MB) ‖ 代码 ' + dropCode.length + ' (' + sum(dropCode).toFixed(2) + ' MB)');
console.log('');
console.log('--- 归档清单（数据/页面）---');
for (const x of drop.filter(y => !/\.(mjs|js)$/i.test(y)).sort((a, b) => a.localeCompare(b))) console.log('  ' + x.padEnd(38) + (sizeOf(x) / 1024).toFixed(0).padStart(6) + 'K');
console.log('');
console.log('--- 归档清单（代码）---');
for (const x of dropCode.sort((a, b) => a.localeCompare(b))) console.log('  ' + x);
[...seen].sort().forEach(x => {});