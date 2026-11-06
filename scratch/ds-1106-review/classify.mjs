import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
const SKIP = /(^|[\\/])(node_modules|\.git|docs[\\/]artifacts|docs[\\/]research[\\/]archive|scratch)([\\/]|$)/;
function walk(dir, out) {
  let e = []; try { e = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const x of e) { const p = join(dir, x.name); if (SKIP.test(p)) continue;
    if (x.isDirectory()) walk(p, out); else if (/\.(mjs|js|md|html|tsv|json|yml|cmd|sh)$/i.test(x.name)) out.push(p); }
}
const code = []; for (const d of ['js','tools','server','tests','.github','champion-map']) walk(d, code);
const docsRs = []; walk('docs/research', docsRs);
const docsTop = []; walk('docs', docsTop);
const root = ['index.html','README.md','CHANGELOG.md'];
const rd = {};
function load(list, tag) { for (const f of list) { if (rd[f]) continue; try { rd[f] = { tag, t: readFileSync(f, 'utf8') }; } catch {} } }
load(code, 'code'); load(root, 'root'); load(docsRs, 'research'); load(docsTop.filter(f => !/docs[\\/]research/.test(f)), 'docs');
function cat(name) {
  const where = { code: [], root: [], docs: [], research: [], changelog: [] };
  for (const [f, o] of Object.entries(rd)) {
    if (basename(f) === name) continue;
    if (!o.t.includes(name)) continue;
    if (f === 'CHANGELOG.md') where.changelog.push(f);
    else where[o.tag].push(f);
  }
  return where;
}
const target = process.argv[2] || 'champion-map';
const rows = [];
for (const e of readdirSync(target, { withFileTypes: true }).filter(x => x.isFile())) {
  const w = cat(e.name);
  const hard = w.code.length + w.root.length + w.docs.length;
  const soft = w.research.length + w.changelog.length;
  rows.push({ name: e.name, hard, soft, code: w.code.slice(0, 2).map(x => basename(x)), docs: w.docs.concat(w.root).slice(0, 2).map(x => basename(x)), size: Math.round(statSync(join(target, e.name)).size / 1024) });
}
const keep = rows.filter(r => r.hard > 0).sort((a, b) => a.name.localeCompare(b.name));
const arch = rows.filter(r => r.hard === 0).sort((a, b) => a.name.localeCompare(b.name));
console.log('KEEP(' + keep.length + '):');
for (const r of keep) console.log('  ' + r.name.padEnd(38) + (r.size + 'K').padStart(6) + '  ← ' + r.code.concat(r.docs).join(', '));
console.log('');
console.log('ARCHIVE(' + arch.length + '):');
for (const r of arch) console.log('  ' + r.name.padEnd(38) + (r.size + 'K').padStart(6) + (r.soft ? '  [仅在研究账/CHANGELOG 里被提到]' : '  [零引用]'));