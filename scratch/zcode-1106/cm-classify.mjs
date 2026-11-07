/* champion-map 文件分类器（11-07 午 · 整理前盘点）
 * 对每个文件查"活引用"：在活脚本/tools/gates/CI/README 里按文件名 grep（排除烘焙产物自身与 docs 历史）。
 * 输出四类：LIVE（活管线读它）｜SCRIPT(活)｜MERGED(只见于 docs/历史)｜ORPHAN(零引用)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = 'D:/code/Epirus-Web';
const CM = ROOT + '/champion-map';
const files = readdirSync(CM).filter(f => {
  try { return statSync(join(CM, f)).isFile(); } catch (e) { return false; }
});

/* 活引用的搜索面：活脚本（champion-map 的 mjs + tools + server + js + CI + README/方法论文档）。
 * 排除：index.html（烘焙产物，会内联数据但不是"读文件"）、.bak、champion-map 里其他待分类文件互相引用不算活。 */
const LIVE_SEARCHRoots = [
  'champion-map/viewer.mjs', 'champion-map/pool-sync.mjs', 'champion-map/rebuild-coords.mjs',
  'champion-map/fold-coords.mjs', 'champion-map/relabel-lineage.mjs', 'champion-map/lineage.mjs',
  'champion-map/lineage-g3-build.mjs', 'champion-map/proj-tsne.mjs', 'champion-map/eps-full.mjs',
  'champion-map/ruler-measure.mjs', 'champion-map/ruler-figs.mjs', 'champion-map/switch-gear.mjs',
  'champion-map/shot.mjs', 'champion-map/lint-viewer.mjs', 'champion-map/reproj-check.mjs',
  'champion-map/eps04-check.mjs', 'champion-map/seat-rule.mjs', 'champion-map/slot-identity.mjs',
  'champion-map/slot-timeline.mjs', 'champion-map/pack-guard.mjs', 'champion-map/pack-id.mjs',
  'champion-map/pack-resolve.mjs', 'champion-map/pool-sync.mjs', 'champion-map/README.md',
  'champion-map/dups.mjs', 'champion-map/repair-coords.mjs', 'champion-map/table-census.mjs',
  'champion-map/eps-scan.mjs', 'champion-map/audit-parent-evidence.mjs',
];
const LIVE_STR = LIVE_SEARCHRoots.map(r => { try { return readFileSync(ROOT + '/' + r, 'utf8'); } catch (e) { return ''; } }).join('\n');
let TOOLS = '';
try { TOOLS = execFileSync('grep', ['-rl', '--include=*.mjs', '--include=*.yml', '--include=*.md', '-e', '.', 'tools', 'server', 'js', '.github'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) {}
const toolFiles = TOOLS.trim().split('\n').filter(Boolean);
let TOOLS_STR = '';
for (const f of toolFiles) { try { TOOLS_STR += readFileSync(ROOT + '/' + f, 'utf8'); } catch (e) {} }
let DOCS_STR = '';
try { DOCS_STR = execFileSync('grep', ['-rl', '-e', '.', 'docs/METHODOLOGY.md', 'docs/GATE-SHIFTS.md'], { cwd: ROOT, encoding: 'utf8' }) ? readFileSync(ROOT + '/docs/METHODOLOGY.md', 'utf8') + readFileSync(ROOT + '/docs/GATE-SHIFTS.md', 'utf8') : ''; } catch (e) {}

const liveScriptSet = new Set(['viewer.mjs','pool-sync.mjs','rebuild-coords.mjs','fold-coords.mjs','relabel-lineage.mjs','lineage.mjs','lineage-g3-build.mjs','proj-tsne.mjs','eps-full.mjs','ruler-measure.mjs','ruler-figs.mjs','switch-gear.mjs','shot.mjs','lint-viewer.mjs','reproj-check.mjs','eps04-check.mjs','seat-rule.mjs','slot-identity.mjs','slot-timeline.mjs','pack-guard.mjs','pack-id.mjs','pack-resolve.mjs','dups.mjs','repair-coords.mjs','table-census.mjs','eps-scan.mjs','audit-parent-evidence.mjs','pool-sync.mjs']);

const rows = [];
for (const f of files) {
  const isLiveScript = liveScriptSet.has(f) || /attach-|proj-tsne|fold-coords|relabel|switch-gear|ruler-figs|ruler-measure/.test(f);
  const citedLive = (LIVE_STR + TOOLS_STR).split(f).length > 1 && f.length > 4;
  const citedDocs = DOCS_STR.split(f).length > 1;
  let cls;
  if (isLiveScript) cls = 'SCRIPT-LIVE';
  else if (citedLive) cls = 'DATA-LIVE';
  else if (citedDocs) cls = 'DOC-ONLY';
  else cls = 'ORPHAN';
  rows.push([cls, f]);
}
const order = { 'SCRIPT-LIVE': 0, 'DATA-LIVE': 1, 'DOC-ONLY': 2, 'ORPHAN': 3 };
rows.sort((a, b) => order[a[0]] - order[b[0]] || a[1].localeCompare(b[1]));
let cur = '';
for (const [c, f] of rows) {
  if (c !== cur) { console.log('\n== ' + c + ' =='); cur = c; }
  console.log('  ' + f);
}
console.log('\n计：' + rows.map(r => r[0]).reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {}));
console.log(Object.entries({}).length);
console.log('SCRIPT-LIVE=' + rows.filter(r => r[0] === 'SCRIPT-LIVE').length);
console.log('DATA-LIVE=' + rows.filter(r => r[0] === 'DATA-LIVE').length);
console.log('DOC-ONLY=' + rows.filter(r => r[0] === 'DOC-ONLY').length);
console.log('ORPHAN=' + rows.filter(r => r[0] === 'ORPHAN').length);
