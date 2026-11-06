import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
const dir = 'champion-map';
const all = readdirSync(dir, { withFileTypes: true }).filter(x => x.isFile()).map(x => x.name);
const nameSet = new Set(all);
const SKIP = /(^|[\\/])(node_modules|\.git|docs|scratch)([\\/]|$)/;
function walk(d, out) { let e = []; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) { const p = join(d, x.name); if (SKIP.test(p)) continue;
    if (x.isDirectory()) walk(p, out); else if (/\.(mjs|js|md|html)$/i.test(x.name)) out.push(p); } }
const code = []; for (const d of ['js','tools','server','tests']) walk(d, code);
code.push('README.md');
// 活入口：源码里按文件名点名的 champion-map 文件（含 tools/js 与 CM 自己的 .mjs/.html）
const rooted = new Set();
for (const f of code) {
  let t = ''; try { t = readFileSync(f, 'utf8'); } catch { continue; }
  for (const g of all) if (t.includes(g)) rooted.add(g);
}
for (const r of ['viewer.mjs','rebuild-coords.mjs','shot.mjs','lint-viewer.mjs','pack-guard.mjs','point-data.mjs','README.md','index.html']) if (nameSet.has(r)) rooted.add(r);
// champion-map 内部边（谁提谁），从 rooted 求闭包
const edges = new Map();
for (const f of all) { let t = ''; try { t = readFileSync(join(dir, f), 'utf8'); } catch { edges.set(f, []); continue; }
  const out = []; for (const g of all) { if (g !== f && t.includes(g)) out.push(g); } edges.set(f, out); }
const seen = new Set(); const stack = [...rooted];
while (stack.length) { const x = stack.pop(); if (seen.has(x)) continue; seen.add(x); for (const y of (edges.get(x) || [])) if (!seen.has(y)) stack.push(y); }
const keep = all.filter(x => seen.has(x));
const drop = all.filter(x => !seen.has(x)).sort((a, b) => a.localeCompare(b));
const sizeOf = x => statSync(join(dir, x)).size;
const sum = arr => arr.reduce((s, x) => s + sizeOf(x), 0) / 1024 / 1024;
const pages = drop.filter(x => /\.html$/i.test(x));
const rest = drop.filter(x => !/\.html$/i.test(x));
console.log('总 ' + all.length + ' / ' + (all.reduce((s, x) => s + sizeOf(x), 0) / 1024 / 1024).toFixed(1) + ' MB ‖ 留 ' + keep.length + ' ‖ 丢 ' + drop.length);
console.log('删除（作废页面）' + pages.length + ' 个 ' + sum(pages).toFixed(2) + ' MB: ' + pages.join(', '));
console.log('归档 ' + rest.length + ' 个 ' + sum(rest).toFixed(2) + ' MB');
console.log(rest.join('\n'));