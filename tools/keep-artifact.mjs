#!/usr/bin/env node
/* keep-artifact.mjs —— 把"结论所依赖的对照包"从 gitignore 的 .bak 里救出来入库。
 *
 * 为什么要这把尺：`docs/artifacts/` 磁盘上有 2100+ 个臂产物，`git ls-files '*.bak'` 是 0
 * （.gitignore 第 3 行全局忽略）。于是交接件里反复声称"可复跑"的逐位对账结论**只在代码层成立**，
 * 包本身随时可以消失 —— §E120 结案所需的 SQ2-30-* 实测已经不在盘上了。
 *
 * 做法：复制到 `docs/artifacts/kept/`（该目录被 .gitignore 用 `!` 显式放行），
 * 扩展名**保持 `.bak`** —— 因为按 `*.bak` glob 找包的工具（gate-drafts / probe-*）
 * 若不认这个扩展名就会静默跳过（本仓同款缺陷见 HANDOFF §5-3）。
 * 账本 `MANIFEST.tsv` 记 sha256，`--verify` 复算：缺文件/哈希不符一律点名 + exit 7。
 *
 * 用法：
 *   node tools/keep-artifact.mjs --add=<name|glob> [--note="支撑 §E120"] [--all]
 *   node tools/keep-artifact.mjs --list
 *   node tools/keep-artifact.mjs --verify
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC_DIRS = [path.join(ROOT, 'docs', 'artifacts'), path.join(ROOT, 'js')];
const KEEP_DIR = path.join(ROOT, 'docs', 'artifacts', 'kept');
const MANIFEST = path.join(KEEP_DIR, 'MANIFEST.tsv');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function find(name) {
  const hits = [];
  for (const d of SRC_DIRS) {
    if (!fs.existsSync(d)) continue;
    const walk = (dir, depth) => {
      if (depth > 3) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'kept') walk(p, depth + 1); }
        else if (e.name === name || e.name === name + '.bak') hits.push(p);
      }
    };
    walk(d, 0);
  }
  return hits;
}
function localStamp() {
  /* 取本机时钟并写明偏移：本仓已四次把 UTC/推测时刻当实测时刻。 */
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) +
    '(UTC' + (off >= 0 ? '+' : '-') + Math.abs(off / 60) + ')';
}
function readManifest() {
  if (!fs.existsSync(MANIFEST)) return [];
  return fs.readFileSync(MANIFEST, 'utf8').split('\n').filter(l => l && !l.startsWith('#') && !l.startsWith('file\tsha256'))
    .map(l => { const c = l.split('\t'); return { file: c[0], sha: c[1], bytes: c[2], src: c[3], at: c[4], note: c[5] || '' }; });
}
function writeManifest(rows) {
  const head = 'file\tsha256\tbytes\tsource\tkeptAt\tnote\n';
  fs.writeFileSync(MANIFEST, head + rows.map(r =>
    [r.file, r.sha, r.bytes, r.src, r.at, r.note].join('\t')).join('\n') + '\n');
}

const argv = process.argv.slice(2);
const opt = (k, d) => { const m = argv.find(a => a.startsWith('--' + k + '=')); return m ? m.split('=').slice(1).join('=') : d; };
const flat = (p) => path.basename(path.dirname(p)) + '__' + path.basename(p);
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

if (argv.includes('--verify')) {
  const rows = readManifest();
  if (!rows.length) { console.error('⛔ MANIFEST 为空 —— 没有可校验的入库包。'); process.exit(7); }
  const bad = [];
  for (const r of rows) {
    const p = path.join(KEEP_DIR, r.file);
    if (!fs.existsSync(p)) { bad.push(r.file + ' 缺文件'); continue; }
    const h = sha256(p);
    if (h !== r.sha) bad.push(r.file + ' 哈希不符（账 ' + r.sha.slice(0, 12) + ' ≠ 实 ' + h.slice(0, 12) + '）');
  }
  if (bad.length) { bad.forEach(b => console.error('⛔ ' + b)); process.exit(7); }
  console.log('✔ kept/ 校验通过：' + rows.length + ' 个包，逐一体积/哈希相符（账本 ' + rel(MANIFEST) + '）');
  process.exit(0);
}
if (argv.includes('--list')) {
  const rows = readManifest();
  console.log('docs/artifacts/kept/ 入库 ' + rows.length + ' 个包：');
  rows.forEach(r => console.log('  ' + r.file + '  ' + r.note + '  (' + r.at + ')'));
  process.exit(0);
}

const add = opt('add', null);
if (!add) {
  console.error('用法：--add=<包名>[ --note="支撑哪条结论"] | --list | --verify');
  process.exit(2);
}
const names = add.split(',').map(s => s.trim()).filter(Boolean);
fs.mkdirSync(KEEP_DIR, { recursive: true });
const rows = readManifest();
let added = 0, failed = [];
for (const n of names) {
  const want = n.endsWith('.bak') ? n : n + '.bak';
  const p = path.resolve(ROOT, n);
  const direct = n.includes('/') || n.includes('\\');
  const hits = direct ? (fs.existsSync(p) ? [p] : []) : find(want);
  if (!hits.length) { failed.push(n + (direct ? '（路径不存在：' + n + '）' : '（全盘 docs/artifacts 与 js/ 都没有）')); continue; }
  if (hits.length > 1) { failed.push(n + ' 名字有歧义 ⇒ ' + hits.map(rel).join(' | ')); continue; }
  const src = hits[0];
  const file = flat(src);
  const dest = path.join(KEEP_DIR, file);
  fs.copyFileSync(src, dest);
  const rec = { file, sha: sha256(dest), bytes: String(fs.statSync(dest).size),
    src: rel(src), at: localStamp(),
    note: opt('note', '') };
  const i = rows.findIndex(r => r.file === file);
  if (i >= 0) rows[i] = rec; else rows.push(rec);
  added++;
  console.log('✔ 入库 ' + file + '  ' + rec.bytes + 'B  sha=' + rec.sha.slice(0, 12) + '  ← ' + rec.src);
}
if (added) writeManifest(rows);
if (failed.length) {
  failed.forEach(f => console.error('⛔ ' + f));
  console.error('⇒ 已入库 ' + added + '/' + names.length + '；缺包按 D177 的规矩必须点名，不许静默跳过。');
  process.exit(7);
}
console.log('账本：' + rel(MANIFEST) + '（共 ' + rows.length + ' 行）。记得 git add docs/artifacts/kept/');
