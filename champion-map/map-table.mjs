#!/usr/bin/env node
/* champion-map 输入表单一入口（阶段 1 · 2026-11-11）
 * 只做四件事：解析表路径、读表、原子写表、身份/完整性守卫。
 * 不搬测量逻辑、不改阈值；默认 gen3，旧表只显式。
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve, basename, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_TABLE = 'archive/2026-11-11-legacy-data/coords-gen3-1105.tsv';
export const LEGACY_TABLE = 'coords.tsv';

function unique(a) { const o = []; for (const x of a) if (o.indexOf(x) < 0) o.push(x); return o; }

export function resolveTable(argv, opts) {
  opts = opts || {};
  const aliases = opts.aliases || ['table', 'coords', 'fit'];
  const def = opts.defaultTable || DEFAULT_TABLE;
  const baseDir = opts.baseDir || HERE;
  let raw = null;
  for (const a of (argv || process.argv)) {
    for (const al of aliases) {
      if (String(a).indexOf('--' + al + '=') === 0) raw = String(a).slice(('--' + al + '=').length);
    }
  }
  const chosen = raw || def;
  let cands;
  if (isAbsolute(chosen)) cands = [chosen];
  else cands = [resolve(chosen), join(baseDir, chosen), join(baseDir, basename(chosen))];
  cands = unique(cands);
  const found = cands.find(function (p) { return existsSync(p); });
  if (!found) {
    const e = new Error('找不到输入表 ' + chosen + '（试过：' + cands.join(' ‖ ') + '）');
    e.candidates = cands;
    throw e;
  }
  return resolve(found);
}

export function readTable(path) {
  let raw = readFileSync(path, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split('\n');
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (!lines.length) throw new Error('空表：' + path);
  const header = lines[0].split('\t');
  const ix = {};
  for (let i = 0; i < header.length; i++) {
    if (ix[header[i]] !== undefined) throw new Error('重复列名 ' + header[i] + '：' + path);
    ix[header[i]] = i;
  }
  const rows = [];
  const bad = [];
  for (let i = 1; i < lines.length; i++) {
    const r = lines[i].split('\t');
    if (r.length !== header.length) { bad.push({ line: i + 1, width: r.length, want: header.length }); continue; }
    rows.push(r);
  }
  if (bad.length) {
    const e = new Error('行列宽不符：' + path + '（首例第 ' + bad[0].line + ' 行 ' + bad[0].width + ' 列，表头 ' + bad[0].want + ' 列；共 ' + bad.length + ' 行）');
    e.badRows = bad;
    throw e;
  }
  const sha = createHash('sha1').update(header.join('\t') + '\n' + rows.map(function (r) { return r.join('\t'); }).join('\n')).digest('hex').slice(0, 12);
  return { path: resolve(path), name: basename(path), header: header, rows: rows, ix: ix, rowsN: rows.length, sha: sha };
}

export function assertColumns(table, required) {
  const miss = (required || []).filter(function (c) { return table.ix[c] === undefined; });
  if (miss.length) throw new Error('表 ' + table.name + ' 缺列：' + miss.join(', '));
  return true;
}

export function assertFullTable(table, opts) {
  opts = opts || {};
  const minRows = opts.minRows === undefined ? 700 : opts.minRows;
  if (table.rowsN < minRows && !opts.allowPartial) {
    throw new Error('表 ' + table.name + ' 只有 ' + table.rowsN + ' 行（< ' + minRows + '）⇒ 疑似半成品，拒绝使用（要局部跑请显式 allowPartial）');
  }
  for (let i = 0; i < table.rows.length; i++) {
    if (table.rows[i].length !== table.header.length) throw new Error('表 ' + table.name + ' 第 ' + (i + 2) + ' 行列宽不符');
  }
  return true;
}

export function tableStamp(table) {
  return table.name + ' rows=' + table.rowsN + ' cols=' + table.header.length + ' sha=' + table.sha;
}

export function logTable(table, prefix) {
  console.log((prefix || '[map-table]') + ' ' + tableStamp(table) + ' path=' + table.path);
}

export function writeTable(path, table, opts) {
  opts = opts || {};
  const target = resolve(path);
  if (!table || !table.header || !table.rows) throw new Error('writeTable：表对象不完整');
  for (let i = 0; i < table.rows.length; i++) {
    if (table.rows[i].length !== table.header.length) throw new Error('writeTable：第 ' + (i + 2) + ' 行 ' + table.rows[i].length + ' 列，表头 ' + table.header.length + ' 列');
  }
  const tmp = target + '.tmp-' + process.pid;
  const body = table.header.join('\t') + '\n' + table.rows.map(function (r) { return r.join('\t'); }).join('\n') + '\n';
  writeFileSync(tmp, body, 'utf8');
  let backup = null;
  if (opts.backup !== false && existsSync(target)) {
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
    backup = target + '.bak-' + (opts.backupTool || 'map-table') + '-' + ts;
    copyFileSync(target, backup);
  }
  try { renameSync(tmp, target); }
  catch (e) { try { unlinkSync(tmp); } catch (x) {} throw e; }
  return { path: target, backup: backup, rowsN: table.rows.length };
}
