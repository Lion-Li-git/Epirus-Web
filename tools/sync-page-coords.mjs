#!/usr/bin/env node
/* sync-page-coords.mjs —— 把 page/coords.tsv 测量名册同步到 registry 全集（2026-11-17 · 批1 管线打通）
 *
 * 为什么要有：page/coords.tsv 是全库重测的面板名单（exam-4n-full 缺省面板 + D234 ship-pool 门读它），
 *   但它的写入者只剩历史一次性工具——data 模型 A 之后新包走 display/features/projections，
 *   page/coords.tsv 停在 825 行，registry 已 971 ⇒ 146 枚注册包不在重测名单上（EQ/US/V3S2 全家漏）。
 * 修法：旧 825 行**逐位不动**；对 registry 有而 coords 无的 id，取 display.tsv 同名行按 coords 表头投影追加
 *   （display 表头 ⊇ coords 表头，11-16 实测）；display 没有的列留空 = 未测（viewer 纪律）。
 * 守卫（switch-gear ④ 同款）：任一追加行宽度 ≠ 表头 ⇒ 拒写；重复 id ⇒ 拒写；行尾风格保持文件原样。
 * 用法：node tools/sync-page-coords.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DRY = process.argv.includes('--dry');
const CO = join(ROOT, 'champion-map/data/page/coords.tsv');
const REG = join(ROOT, 'champion-map/data/registry.tsv');
const DISP = join(ROOT, 'champion-map/data/display.tsv');

const raw = readFileSync(CO, 'utf8');
const CRLF = raw.includes('\r\n');
const splitLines = (t) => t.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const co = splitLines(raw).map((l) => l.split('\t'));
const reg = splitLines(readFileSync(REG, 'utf8')).map((l) => l.split('\t'));
const disp = splitLines(readFileSync(DISP, 'utf8')).map((l) => l.split('\t'));

const ch = co[0], rh = reg[0], dh = disp[0];
const cix = Object.fromEntries(ch.map((c, i) => [c, i]));
const rix = Object.fromEntries(rh.map((c, i) => [c, i]));
const dix = Object.fromEntries(dh.map((c, i) => [c, i]));
const coIds = new Set(co.slice(1).map((r) => r[cix.id]).filter(Boolean));
const dispById = new Map(disp.slice(1).map((r) => [r[dix.id], r]));

const regIds = reg.slice(1).map((r) => r[rix.pack_id]).filter(Boolean);
const missing = regIds.filter((id) => !coIds.has(id));
console.log('registry ' + regIds.length + ' ‖ coords 已有 ' + (coIds.size) + ' ‖ 缺 ' + missing.length);

const addRows = [];
const skips = [];
for (const id of missing) {
  const d = dispById.get(id);
  if (!d) { skips.push(id + '（display 无行）'); continue; }
  const row = ch.map((c) => (dix[c] !== undefined ? (d[dix[c]] ?? '') : ''));
  if (row.length !== ch.length) { skips.push(id + '（宽度 ' + row.length + ' ≠ ' + ch.length + '）'); continue; }
  if (!row[cix.id] || !row[cix.path]) { skips.push(id + '（id/path 空）'); continue; }
  addRows.push(row);
}
if (skips.length) { console.error('⛔ 守卫拦截 ' + skips.length + ' 枚：\n' + skips.join('\n')); process.exit(2); }

/* 幂等自证：追加行内不重复、不与已有重复 */
const seen = new Set();
for (const r of addRows) { const id = r[cix.id]; if (seen.has(id)) { console.error('⛔ 追加集内重复 ' + id); process.exit(2); } seen.add(id); }

console.log('将追加 ' + addRows.length + ' 行' + (addRows.length ? '（fam 抽样：' + addRows.slice(0, 3).map((r) => r[cix.id]).join(', ') + ' … ' + addRows.slice(-1)[0][cix.id] + '）' : '（名册已齐）'));
if (DRY) { console.log('--dry：未写'); process.exit(0); }
const nl = CRLF ? '\r\n' : '\n';
const out = raw.replace(/\r?\n$/, '') + nl + addRows.map((r) => r.join('\t')).join(nl) + nl;
writeFileSync(CO, out, 'utf8');
console.log('✅ page/coords.tsv → ' + (co.length - 1 + addRows.length) + ' 行（行尾 ' + (CRLF ? 'CRLF' : 'LF') + ' 保持原样）');
