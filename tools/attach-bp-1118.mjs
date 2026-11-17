#!/usr/bin/env node
/* attach-bp-1118.mjs —— 把 5 墙 B 轴全图面板挂上 coords/display（夜班 · 2026-11-18，bp1118 列族 §E597）。
 * 输入：champion-map/data/exam4n-bp-1118.tsv（[id, wall, seed, x2, x3, x5, x8, xb]，run-bp-fullmap-1118.mjs 产物）
 * 输出列：bpA/bpB/bpC/bpD/bpE（各墙 X̄₄ 种子均值）+ bpM（5 墙均值=混合尺）。
 * 纪律：旧列一字不动；新列只追加；幂等（重跑覆盖同名列）；display/coords 同笔（coords-view 模板=display 表头）。
 * 用法：node tools/attach-bp-1118.mjs [--dry] */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DRY = process.argv.includes('--dry');
const SRC = join(ROOT, 'champion-map/data/exam4n-bp-1118.tsv');
const CO = join(ROOT, 'champion-map/data/page/coords.tsv');
const DISP = join(ROOT, 'champion-map/data/display.tsv');

const WALLS = ['EXTA', 'EXTB', 'EXTC', 'EXTD', 'EXTE'];
const COLS = ['bpA', 'bpB', 'bpC', 'bpD', 'bpE', 'bpM'];

/* 汇总：per-pack per-wall 均值（跨种子） */
const packs = {};
for (const l of readFileSync(SRC, 'utf8').trim().split(/\r?\n/).slice(1)) {
  const c = l.split('\t');
  if (!packs[c[0]]) packs[c[0]] = {};
  if (!packs[c[0]][c[1]]) packs[c[0]][c[1]] = [];
  packs[c[0]][c[1]].push(+c[7]);
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const valOf = (id) => {
  const p = packs[id];
  if (!p) return null;
  const walls = WALLS.filter((w) => p[w] && p[w].length);
  if (!walls.length) return null;
  const out = {};
  for (const w of walls) out['bp' + w.slice(3)] = mean(p[w]).toFixed(4);
  out.bpM = mean(walls.map((w) => mean(p[w]))).toFixed(4);
  return out;
};

function attach(file) {
  const raw = readFileSync(file, 'utf8');
  const CRLF = raw.includes('\r\n');
  const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const head = lines[0].split('\t');
  const ix = Object.fromEntries(head.map((c, i) => [c, i]));
  const idIx = ix.id;
  if (idIx == null) { console.error('⛔ ' + file + ' 无 id 列'); process.exit(2); }
  const newCols = COLS.filter((c) => ix[c] == null);
  let added = 0, filled = 0, blank = 0;
  const rows = lines.slice(1).map((l) => {
    const c = l.split('\t');
    if (newCols.length) { for (const col of newCols) c.push(''); }
    const h2 = head.concat(newCols);
    const i2 = Object.fromEntries(h2.map((n, i) => [n, i]));
    const v2 = valOf(c[idIx]);
    if (v2) { for (const [k, val] of Object.entries(v2)) c[i2[k]] = val; filled++; } else blank++;
    return c.join('\t');
  });
  const head2 = head.concat(newCols);
  const w = head2.length;
  const body = rows.map((l) => { const c = l.split('\t'); while (c.length < w) c.push(''); return c.slice(0, w).join('\t'); });
  added = newCols.length;
  const nl = CRLF ? '\r\n' : '\n';
  const out = head2.join('\t') + nl + body.join(nl) + nl;
  return { out, added, filled, blank, w };
}

for (const [name, file] of [['coords', CO], ['display', DISP]]) {
  const r = attach(file);
  console.log(name + '：新列 ' + r.added + '（' + COLS.join('/') + '）‖ 有值行 ' + r.filled + ' ‖ 无面板行 ' + r.blank + ' ‖ 宽 ' + r.w);
  if (!DRY) writeFileSync(file, r.out, 'utf8');
}
console.log(DRY ? '--dry：未写' : '✅ bp1118 列族已挂（coords+display 同笔）——重烘 rebuild-map 后生效');
