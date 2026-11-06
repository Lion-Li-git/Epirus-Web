import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = 'champion-map';
const all = readdirSync(dir, { withFileTypes: true }).filter(x => x.isFile()).map(x => x.name);
const nameSet = new Set(all);
const SKIP = /(^|[\\/])(node_modules|\.git|docs|scratch)([\\/]|$)/;
function walk(d, out) { let e = []; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) { const p = join(d, x.name); if (SKIP.test(p)) continue;
    if (x.isDirectory()) walk(p, out); else if (/\.(mjs|js|md|html)$/i.test(x.name)) out.push(p); } }
const code = []; for (const d of ['js','tools','server','tests']) walk(d, code); code.push('README.md');
const rooted = new Set();
for (const f of code) { let t=''; try { t = readFileSync(f,'utf8'); } catch { continue; } for (const g of all) if (t.includes(g)) rooted.add(g); }
for (const r of ['viewer.mjs','rebuild-coords.mjs','shot.mjs','lint-viewer.mjs','pack-guard.mjs','point-data.mjs','README.md','index.html']) if (nameSet.has(r)) rooted.add(r);
const edges = new Map();
for (const f of all) { let t=''; try { t = readFileSync(join(dir,f),'utf8'); } catch { edges.set(f,[]); continue; }
  const out=[]; for (const g of all) if (g!==f && t.includes(g)) out.push(g); edges.set(f,out); }
const seen = new Set(); const stack=[...rooted];
while (stack.length) { const x=stack.pop(); if (seen.has(x)) continue; seen.add(x); for (const y of (edges.get(x)||[])) if(!seen.has(y)) stack.push(y); }
const EXCEPT = new Set(['coords.tsv.pre-e600.bak','attach-hshort.mjs']);
const drop = all.filter(x => !seen.has(x) && !EXCEPT.has(x)).sort();
writeFileSync('scratch/ds-1106-review/archive-list.txt', drop.join('\n') + '\n');
console.log('待归档 ' + drop.length + ' 个');