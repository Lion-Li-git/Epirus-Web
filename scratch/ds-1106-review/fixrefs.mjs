import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const moved = readFileSync('scratch/ds-1106-review/research-sweep.txt', 'utf8').split('\n').filter(Boolean).map(s => s.trim());
const SKIP = /(^|[\\/])(node_modules|\.git|docs|scratch)([\\/]|$)/;
function walk(d, out) { let e=[]; try { e = readdirSync(d,{withFileTypes:true}); } catch { return; }
  for (const x of e) { const p = join(d,x.name); if (SKIP.test(p)) continue;
    if (x.isDirectory()) walk(p,out); else if (/\.(mjs|js|md|html)$/i.test(x.name)) out.push(p); } }
const files = []; for (const d of ['js','tools','server','tests','.github']) walk(d, files);
files.push('README.md');
let hits = 0, touched = [];
for (const f of files) {
  let t; try { t = readFileSync(f, 'utf8'); } catch { continue; }
  let orig = t;
  for (const n of moved) {
    const from = 'docs/research/' + n;
    const to = 'docs/research/archive/2026-11-06-october-sweep/' + n;
    if (t.includes(from)) { t = t.split(from).join(to); hits++; }
  }
  if (t !== orig) { writeFileSync(f, t); touched.push(f); }
}
console.log('替换 ' + hits + ' 处，涉及 ' + touched.length + ' 个文件');
console.log(touched.join('\n'));