#!/usr/bin/env node
/* 尺注册表接口（2026-11-11 · 数据模型 A）
 * 目标：换尺只追加 readings + 改 rulers.tsv 的 current 指针，**不碰 projections.tsv / features.tsv**。
 * 用法：
 *   node champion-map/pipeline/rulers.mjs --list
 *   node champion-map/pipeline/rulers.mjs --set-current=<ruler_id> [--data=champion-map/data]
 */
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readTable, writeTable, tableStamp } from '../map-table.mjs';

export function loadRulers(file) {
  const t = readTable(file);
  for (const c of ['ruler_id', 'axis', 'status']) if (t.ix[c] === undefined) throw new Error('rulers 缺列 ' + c);
  return t;
}

export function currentRuler(table, axis) {
  const rows = table.rows.filter((r) => r[table.ix.axis] === axis && r[table.ix.status] === 'current');
  if (rows.length !== 1) throw new Error('axis ' + axis + ' 的 current 尺有 ' + rows.length + ' 条（必须恰好 1 条）');
  return rows[0];
}

export function assertWritable(table, rulerId) {
  const row = table.rows.find((r) => r[table.ix.ruler_id] === rulerId);
  if (!row) throw new Error('没有尺 ' + rulerId);
  if (row[table.ix.status] === 'frozen') throw new Error('尺 ' + rulerId + ' 是 frozen（H5 参考），不许写');
  return row;
}

export function setCurrentRuler(file, rulerId) {
  const t = readTable(file);
  const target = t.rows.find((r) => r[t.ix.ruler_id] === rulerId);
  if (!target) throw new Error('没有尺 ' + rulerId);
  const axis = target[t.ix.axis];
  if (target[t.ix.status] === 'frozen') throw new Error('frozen 尺不能设为 current：' + rulerId);
  for (const r of t.rows) {
    if (r[t.ix.axis] !== axis) continue;
    if (r[t.ix.ruler_id] === rulerId) r[t.ix.status] = 'current';
    else if (r[t.ix.status] === 'current') r[t.ix.status] = 'reference';
  }
  const w = writeTable(file, t, { backupTool: 'switch-ruler' });
  return { axis, rulerId, backup: w.backup };
}

const IS_MAIN = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
  const data = resolve(arg('data', 'champion-map/data'));
  const file = join(data, 'rulers.tsv');
  if (!existsSync(file)) { console.error('⛔ 没有 ' + file + '（先跑 pipeline/backfill.mjs）'); process.exit(2); }
  const t = loadRulers(file);
  if (process.argv.includes('--list')) {
    console.log(tableStamp(t));
    for (const r of t.rows) console.log(r[t.ix.ruler_id] + '\t' + r[t.ix.axis] + '\t' + r[t.ix.status] + '\t' + r[t.ix.label]);
    process.exit(0);
  }
  const id = arg('set-current', '');
  if (!id) { console.error('用法：--list 或 --set-current=<ruler_id>'); process.exit(2); }
  try {
    const out = setCurrentRuler(file, id);
    console.log('current 尺已切：' + out.axis + ' = ' + out.rulerId +
      ' ‖ projections.tsv / features.tsv 未动（换尺只动数值，不动投影）' +
      (out.backup ? ' ‖ 备份 ' + out.backup : ''));
  } catch (e) { console.error('⛔ ' + e.message); process.exit(2); }
}
