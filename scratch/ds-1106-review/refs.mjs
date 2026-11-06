import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const SCAN_DIRS = ['js', 'tools', 'server', 'tests', '.github', 'champion-map'];
const SCAN_FILES = ['index.html', 'README.md', 'CHANGELOG.md'];
const SKIP = /(^|[\\/])(node_modules|\.git|docs[\\/]artifacts|docs[\\/]research[\\/]archive|scratch)([\\/]|$)/;

function walk(dir, out) {
  let ents = [];
  try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = join(dir, e.name);
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(mjs|js|md|html|tsv|json|yml|yaml|cmd|sh)$/i.test(e.name)) out.push(p);
  }
}
const files = [];
for (const d of SCAN_DIRS) walk(d, files);
for (const f of SCAN_FILES) { try { if (statSync(f)) files.push(f); } catch {} }
const texts = new Map();
for (const f of files) { try { texts.set(f, readFileSync(f, 'utf8')); } catch {} }

function refsOf(name) {
  const out = [];
  for (const [f, t] of texts) {
    if (basename(f) === name) continue;
    if (t.includes(name)) out.push(f);
  }
  return out;
}

const target = process.argv[2] || 'champion-map';
const ents = readdirSync(target, { withFileTypes: true }).filter(e => e.isFile()).map(e => {
  const p = join(target, e.name);
  const st = statSync(p);
  return { name: e.name, size: st.size, mtime: st.mtime.toISOString().slice(0, 10) };
});
ents.sort((a, b) => a.name.localeCompare(b.name));
for (const e of ents) {
  const r = refsOf(e.name);
  const tag = r.length === 0 ? 'ORPHAN' : (r.length <= 2 ? 'rare' : 'used');
  console.log([e.mtime, String(Math.round(e.size / 1024)).padStart(5) + 'K', tag.padEnd(6), e.name, '§' + r.length, r.slice(0, 2).map(x => x.replace(/\\/g, '/')).join(' | ')].join('  '));
}