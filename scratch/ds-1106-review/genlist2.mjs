import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
const dir = 'champion-map';
const tracked = new Set(execSync('git ls-files champion-map', { encoding: 'utf8' }).split('\n').filter(Boolean).map(x => x.replace('champion-map/', '')));
const all = readdirSync(dir, { withFileTypes: true }).filter(x => x.isFile()).map(x => x.name);
const nameSet = new Set(all);
const SKIP = /(^|[\\/])(node_modules|\.git|docs|scratch)([\\/]|$)/;
function walk(d, out) { let e=[]; try { e = readdirSync(d,{withFileTypes:true}); } catch { return; }
  for (const x of e) { const p = join(d,x.name); if (SKIP.test(p)) continue;
    if (x.isDirectory()) walk(p,out); else if (/\.(mjs|js|md|html|tsv|json|txt)$/i.test(x.name)) out.push(p); } }
const code = []; for (const d of ['js','tools','server','tests']) walk(d, code); code.push('README.md');
const rooted = new Set();
for (const f of code) { let t=''; try { t = readFileSync(f,'utf8'); } catch { continue; } for (const g of all) if (t.includes(g)) rooted.add(g); }
for (const r of ['viewer.mjs','rebuild-coords.mjs','shot.mjs','lint-viewer.mjs','pack-guard.mjs','point-data.mjs','README.md','index.html']) if (nameSet.has(r)) rooted.add(r);
const edges = new Map();
for (const f of all) { let t=''; try { t = readFileSync(join(dir,f),'utf8'); } catch { edges.set(f,[]); continue; }
  const out=[]; for (const g of all) if (g!==f && t.includes(g)) out.push(g); edges.set(f,out); }
const seen = new Set(); const st=[...rooted];
while (st.length) { const x=st.pop(); if (seen.has(x)) continue; seen.add(x); for (const y of (edges.get(x)||[])) if(!seen.has(y)) st.push(y); }
// 只碰 tracked、只碰数据回执、排除通配/文档约定名
const CONV = /^(feas-|epsfull-|ruler-|coords|point-data|lineage|pool-members|pool-seat|pack-|panel\.tsv|bake-flags|holo\.tsv|duel\.tsv|dupes-manifest|pool-traits|usage-buckets|bead-|e588-usage|promote\.tsv|g3-|extra-g3|gen3-|gl-mesh)/;
const cand = all.filter(x => !seen.has(x) && tracked.has(x) && /\.(tsv|json|txt)$/i.test(x) && !CONV.test(x)).sort();
writeFileSync('scratch/ds-1106-review/archive-list2.txt', cand.join('\n') + '\n');
const sum = cand.reduce((s,x)=>s+statSync(join(dir,x)).size,0)/1024;
console.log('候选 ' + cand.length + ' 个 / ' + sum.toFixed(0) + ' KB');
console.log(cand.join('\n'));