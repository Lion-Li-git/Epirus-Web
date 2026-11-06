import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
const SKIP = /(^|[\\/])(node_modules|\.git|docs[\\/]artifacts|docs[\\/]research|scratch)([\\/]|$)/;
function walk(dir, out) { let e = []; try { e = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const x of e) { const p = join(dir, x.name); if (SKIP.test(p)) continue;
    if (x.isDirectory()) walk(p, out); else if (/\.(mjs|js|md|html|tsv|json|yml|cmd|sh)$/i.test(x.name)) out.push(p); } }
const codeFiles = []; for (const d of ['js','tools','server','tests']) walk(d, codeFiles);
const cmFiles = []; for (const x of readdirSync('champion-map', { withFileTypes: true })) if (x.isFile() && /\.(mjs|js|html)$/.test(x.name)) cmFiles.push(join('champion-map', x.name));
const txt = {};
for (const f of codeFiles.concat(cmFiles)) { try { txt[f] = readFileSync(f, 'utf8'); } catch {} }
const readme = (() => { try { return readFileSync('README.md', 'utf8'); } catch { return ''; } })();
function codeRefs(name) {
  const out = [];
  for (const [f, t] of Object.entries(txt)) { if (basename(f) === name) continue; if (t.includes(name)) out.push(f.replace(/\\/g, '/')); }
  return out;
}
const rows = [];
for (const x of readdirSync('champion-map', { withFileTypes: true }).filter(y => y.isFile())) {
  const r = codeRefs(x.name);
  const inReadme = readme.includes('champion-map/' + x.name) || readme.includes(x.name);
  rows.push({ name: x.name, refs: r, inReadme, size: statSync(join('champion-map', x.name)).size });
}
const keep = rows.filter(r => r.refs.length > 0 || r.inReadme).sort((a, b) => a.name.localeCompare(b.name));
const arch = rows.filter(r => r.refs.length === 0 && !r.inReadme).sort((a, b) => a.name.localeCompare(b.name));
console.log('=== KEEP ' + keep.length + ' ===');
for (const r of keep) console.log('  ' + r.name.padEnd(36) + (Math.round(r.size / 1024) + 'K').padStart(6) + '  ← ' + (r.refs.slice(0, 2).map(z => z.split('/').pop()).join(', ') || 'README'));
console.log('');
console.log('=== ARCHIVE ' + arch.length + '（源码零点名、README 不点名）===');
let tot = 0;
for (const r of arch) { tot += r.size; console.log('  ' + r.name.padEnd(36) + (Math.round(r.size / 1024) + 'K').padStart(6)); }
console.log('合计 ' + (tot / 1024 / 1024).toFixed(2) + ' MB');