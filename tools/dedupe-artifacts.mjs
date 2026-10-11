#!/usr/bin/env node
/* dedupe-artifacts.mjs —— 同一枚权重的多份拷贝：**普查 → 定主名 → 移到仓外隔离 → 回滚/查断链**（§E589 · 千问 10-11）
 *
 * 为什么要有这一台（§E589 普查实测）：`docs/artifacts/**` + `d180-bands/**` 里 1443 个包文件只有 **1130 粒不同权重**，
 *   179 组重复涉及 480 个文件 ⇒ **301 份是多余的**；而其中只有 35 个在 git 里，**445 个只存在于本机盘上**。
 *   拷贝的五个来源都写在 §E589 日志里（命名按实验系列 / 每批一个 eNNN-out / kept/ 是故意的第二份 / 活槽与夹具各一份 / 旧的 win-*）。
 *
 * 三条硬规矩（都是本仓踩过的）：
 *   ① **身份只按权重**（`pack-id.mjs` 的 `widOf` = sha1(权重数组) 前 16 位，与 `server/train-server.mjs` 的 `weightsId()` 同式），
 *      不按文件名、不按整文件哈希（META 的 ts/arm/目录每次都不同 ⇒ 整文件哈希会漏报，见 `probe-pack-identity.mjs` 头注①）。
 *   ② **只移不删**：目标目录在**仓库外面**（默认 `<repo>-artifacts-quarantine/`），并保留原相对路径 ⇒ `--restore` 能一字不差搬回来。
 *      账本 `champion-map/dupes-manifest.tsv` 进仓 —— 它是"当时动了谁"的唯一凭证，也是回滚依据。
 *   ③ **`js/**` 永远不碰**（活槽是产品，不是产物）；解不出权重的文件一律跳过并点名（缺行 ≠ 相等）。
 *
 * 主名规则（用户 10-11 裁定）：**最早 META.ts 的那份**为主名；**同一时间戳**则按**被引用次数**多的那份。
 *   引用数 = 这个路径在"下游表 + 门体"里出现的次数（`coords.tsv` 的 path 列、`lineage.tsv`、ruler/feas/oldpacks 各表、`np-test.mjs`）。
 *
 * 用法：node tools/dedupe-artifacts.mjs [--plan] [--write-manifest] [--quarantine [--to=<目录>]] [--restore] [--check]
 *        [--scope=docs/artifacts,d180-bands] [--include-tracked]
 *   缺省 = `--plan`（只读，什么都不动）。`--write-manifest` 才落账本；`--quarantine` 才移文件；`--check` 查断链。
 *   ⚠ 默认**不动 tracked 的那 35 份**（动了会改 git 状态，要单独批）；加 `--include-tracked` 才把它们算进要移的名单。
 * 退出码：0 = 跑完 ‖ 2 = 输入/前置不齐（宁可红也不许假绿）
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { widOf, parseMeta } from '../champion-map/pack-id.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const has = k => process.argv.includes('--' + k);
const bad = process.argv.slice(2).filter(a => a.startsWith('--') && !['plan', 'write-manifest', 'quarantine', 'restore', 'check', 'include-tracked']
  .some(f => a === '--' + f || a.startsWith('--' + f.split('=')[0] + '=')));
if (bad.length) { console.error('⛔ 不认识的参数：' + bad.join(' ') + '（只认 plan/write-manifest/quarantine/restore/check/include-tracked/scope/to）'); process.exit(2); }
const SCOPE = String(arg('scope', 'docs/artifacts,d180-bands')).split(',').map(s => s.trim()).filter(Boolean);
const QDIR = arg('to', '');
const MAN = join(ROOT, 'champion-map', 'dupes-manifest.tsv');
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

/* ---------- 1. 名单：scope 下所有能解出权重的包文件 ---------- */
function walk(d, out) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { if (e.name === '_quarantine' || e.name === 'node_modules' || /^chrome-profile/.test(e.name)) continue; walk(p, out); }
    else if (/\.(bak|js)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = [];
for (const s of SCOPE) { const d = join(ROOT, s); if (!existsSync(d)) { console.error('⛔ scope 里这个目录不在：' + s); process.exit(2); } walk(d, files); }
const tracked = new Set(execSync('git ls-files ' + SCOPE.map(s => JSON.stringify(s)).join(' '), { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n').filter(Boolean));

/* ---------- 2. 引用数：下游表 + 门体里出现这个相对路径的次数 ---------- */
const REF_FILES = ['champion-map/coords.tsv', 'champion-map/lineage.tsv', 'champion-map/ruler-all.tsv',
  'champion-map/e328-ruler-s1.tsv', 'champion-map/e328-ruler-s2.tsv', 'champion-map/e328-ruler-s3.tsv',
  'champion-map/feas.tsv', 'champion-map/feas-s1.tsv', 'champion-map/feas-s2.tsv', 'champion-map/feas-s3.tsv', 'champion-map/feas-s4.tsv',
  'champion-map/oldpacks.tsv', 'tools/np-test.mjs'];
/* ⚠ 账本 `dupes-manifest.tsv` **不在**这张名单里：它是"谁被移走了"的记录，
 *   把它当引用源会让每个被移走的路径都"看起来被引用"，既虚增 refs 又让 `--check` 自己报自己的钉子。 */
const REFC = {};
/* ⚠ 不能"对每个路径去大文件里 indexOf 一遍"（1443 个路径 × np-test 1.2 MB = 扫十几 GB，本机要等好几分钟）
 *   ⇒ 反过来：每个引用源**只切一遍**，把长得像包路径的 token 计数。 */
const COUNTED = new Map();
for (const f of REF_FILES) {
  const p = join(ROOT, f); if (!existsSync(p)) continue;
  const t = rd(p);
  for (const tok of t.split(/[^\w./\-]+/)) {
    if (!/\.(bak|js)$/.test(tok) || tok.indexOf('/') < 0) continue;
    COUNTED.set(tok, (COUNTED.get(tok) || 0) + 1);
  }
}
for (const abs of files) {
  const rel = relative(ROOT, abs).split(sep).join('/');
  const n = COUNTED.get(rel) || 0; if (n) REFC[rel] = n;
}

/* ---------- 3. 分组 + 定主名 ---------- */
const G = {}; const unreadable = [];
for (const abs of files) {
  const rel = relative(ROOT, abs).split(sep).join('/');
  let txt; try { txt = rd(abs); } catch (e) { unreadable.push(rel); continue; }
  const w = widOf(txt); if (!w) { unreadable.push(rel); continue; }
  const m = parseMeta(txt) || {};
  (G[w] = G[w] || []).push({ rel, ts: m.ts || '', refs: REFC[rel] || 0, tracked: tracked.has(rel) });
}
const groups = Object.entries(G).filter(([, v]) => v.length > 1);
/* 主名：最早 ts ‖ 同 ts 按引用多 ‖ 再按路径字典序（保证可复算，不依赖 readdir 顺序） */
const rank = v => v.slice().sort((a, b) => (a.ts || '9999').localeCompare(b.ts || '9999')
  || (b.refs - a.refs) || a.rel.localeCompare(b.rel));
const plan = [];
for (const [w, v] of groups) {
  const s = rank(v);
  s.forEach((e, i) => plan.push({ wid: w, role: i === 0 ? 'canonical' : 'move', keep: s[0].rel, ...e }));
}
const movable = plan.filter(p => p.role === 'move' && (has('include-tracked') || !p.tracked));
const nRefsMove = movable.filter(p => p.refs > 0).length;
console.log('扫到 ' + files.length + ' 个包文件 ‖ 解出权重 ' + Object.keys(G).length + ' 组 ‖ 重复组 ' + groups.length +
  ' ‖ 多余拷贝 ' + plan.filter(p => p.role === 'move').length + ' 份（tracked ' + plan.filter(p => p.role === 'move' && p.tracked).length + '）');
console.log('本次要移：' + movable.length + ' 个（其中 **' + nRefsMove + ' 个正被下游表/门引用** ⇒ 移走就会断链，这是要试的那一半）' +
  (has('include-tracked') ? ' ‖ 含 tracked' : ' ‖ 不含 tracked（要含请加 --include-tracked）'));
console.log('解不出权重/读不到而跳过：' + unreadable.length + (unreadable.length ? '（前 6：' + unreadable.slice(0, 6).join(' ') + '）' : ''));
const byRef = movable.filter(p => p.refs > 0).sort((a, b) => b.refs - a.refs).slice(0, 12);
if (byRef.length) { console.log('\n被引用最多的"要移走"的那几个（断链热点）：'); for (const e of byRef) console.log('  refs=' + String(e.refs).padStart(3) + '  ' + e.rel + '   → 主名 ' + e.keep); }

/* ---------- 4. 落账本 / 移 / 回滚 / 查断链 ---------- */
const COLS = ['wid', 'role', 'path', 'canonical', 'metaTs', 'refs', 'tracked', 'quarantineTo'];
function writeManifest() {
  const rows = [COLS.join('\t')].concat(plan.map(p => [p.wid, p.role, p.rel, p.keep, p.ts || '-', p.refs, p.tracked ? 'git' : 'disk',
    p.role === 'move' ? join(QDIR || defaultQ(), p.rel).split(sep).join('/') : ''].join('\t')));
  writeFileSync(MAN, rows.join('\r\n') + '\r\n');
  console.log('账本 ⇒ ' + relative(ROOT, MAN).split(sep).join('/') + '（' + plan.length + ' 行）');
}
function defaultQ() { return join(dirname(ROOT), ROOT.split(/[\\/]/).pop() + '-artifacts-quarantine'); }
if (has('quarantine')) {
  writeManifest();                     /* ★ 先落账再动文件：中途断了也知道"当时打算动谁" */
  const Q = QDIR || defaultQ();
  if (!relative(ROOT, Q).startsWith('..')) { console.error('⛔ 隔离目录必须在仓库外面（收到 ' + Q + '）'); process.exit(2); }
  let n = 0;
  for (const p of movable) {
    const src = join(ROOT, p.rel), dst = join(Q, p.rel);
    if (!existsSync(src)) { console.log('  ⚠ 不在盘上，跳过：' + p.rel); continue; }
    mkdirSync(dirname(dst), { recursive: true });
    if (existsSync(dst)) { console.error('⛔ 隔离目录里已经有同名文件：' + dst + ' ⇒ 停（不许覆盖）'); process.exit(2); }
    renameSync(src, dst); n++;
  }
  console.log('✔ 已移到仓外：' + n + ' 个 ⇒ ' + Q + '（保留原相对路径，--restore 可一字不差搬回）');
}
if (has('restore')) {
  /* §E589 血案（本机实测）：第一版 `--restore` 在**读账本之前**先把账本按"移走之后"的状态重写了一遍
   *   ⇒ 文件只剩 49 行、`role=move` 那批全没了 ⇒ "搬回 0 个"，**回滚依据自己把回滚依据覆盖了**。
   *   修法不是"记得先读"，而是**不以账本为准**：隔离目录本身就是自描述的清单（相对路径 = 原路径），
   *   账本降级成"核对用"。搬完再重算一份现状账本。 */
  const Q = QDIR || defaultQ();
  if (!existsSync(Q)) { console.error('⛔ 隔离目录不在：' + Q); process.exit(2); }
  const walkQ = (d, o) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walkQ(p, o); else o.push(p); } return o; };
  const qf = walkQ(Q, []); let n = 0, clash = [];
  for (const f of qf) {
    const rel = relative(Q, f).split(sep).join('/'), dst = join(ROOT, rel);
    if (existsSync(dst)) { clash.push(rel); continue; }
    mkdirSync(dirname(dst), { recursive: true }); renameSync(f, dst); n++;
  }
  console.log('✔ 搬回 ' + n + ' 个' + (clash.length ? ' ‖  原位已经有文件、没敢覆盖 ' + clash.length + ' 个（前 5：' + clash.slice(0, 5).join(' ') + '）⇒ 手工核' : '') +
    ' ‖ 隔离目录里剩下的：' + clash.length);
  writeManifest();
}
if (has('write-manifest') && !has('quarantine') && !has('restore')) writeManifest();
if (has('check')) {
  /* `__d177_missing__` 这类是**门自己造的"文件不存在"夹具**（np-test 里喂给守卫用例的假路径），不算断链。 */
  const synthetic = c => /__/.test(c.replace(/^.*[\\/]/, ''));
  const broken = [];
  for (const f of REF_FILES) {
    const p = join(ROOT, f); if (!existsSync(p)) continue;
    for (const line of rd(p).split('\n')) {
      for (const cell of line.split('\t')) {
        const c = cell.trim();
        if (/^(docs|js|champion-map|server)\//.test(c) && /\.(bak|js)$/.test(c) && !synthetic(c) && !existsSync(join(ROOT, c))) broken.push(f + ' → ' + c);
      }
      const m = /'(docs\/[^']+\.bak|docs\/[^']+\.js|d180-bands\/[^']+\.bak)'/.exec(line);
      if (m && !synthetic(m[1]) && !existsSync(join(ROOT, m[1]))) broken.push(f + ' → ' + m[1] + '（源码里的字面路径）');
    }
  }
  const uniq = [...new Set(broken)];
  console.log('\n断链检查：' + uniq.length + ' 条' + (uniq.length ? '' : '（下游表与门体里所有指到的包文件都在盘上 ✓）'));
  for (const b of uniq.slice(0, 40)) console.log('  ✘ ' + b);
  if (uniq.length > 40) console.log('  … 其余 ' + (uniq.length - 40) + ' 条略');
  process.exitCode = uniq.length ? 1 : 0;
}
