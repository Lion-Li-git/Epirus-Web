#!/usr/bin/env node
/* validate.mjs —— 数据模型 A 的门（2026-11-11）
 * 不跑测量；只查 registry/rulers/batches/readings/features/projections 的一致性。
 * 用法：node champion-map/pipeline/validate.mjs [--data=champion-map/data] [--strict]
 *   --strict：每枚都必须有 current A/B 的 4 格 × 2 桌读数（发布前用；新点局部进图可不加）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readTable } from '../map-table.mjs';
import { loadRulers, currentRuler } from './rulers.mjs';
import { buildView } from './build-view.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const DATA = resolve(arg('data', 'champion-map/data'));
const STRICT = process.argv.includes('--strict');
const errs = [], warns = [];
const read = (rel) => {
  const p = join(DATA, rel);
  if (!existsSync(p)) { errs.push('缺文件 ' + rel); return null; }
  try { return readTable(p); } catch (e) { errs.push(rel + ': ' + e.message); return null; }
};
const reg = read('registry.tsv');
const rulers = read('rulers.tsv');
const batches = read('batches.tsv');
const rd = read('readings/current.tsv');
const feat = read('features.tsv');
const proj = read('projections.tsv');
const h5 = read('readings/h5-frozen.tsv');
const disp = read('display.tsv');
if (errs.length) { console.error('⛔ ' + errs.join('\n⛔ ')); process.exit(2); }

const regIds = new Set();
for (const r of reg.rows) { const id = r[reg.ix.pack_id]; if (!id) errs.push('registry 空 pack_id'); else if (regIds.has(id)) errs.push('registry 重复 ' + id); else regIds.add(id); }
const rulerIds = new Set();
for (const r of rulers.rows) {
  const id = r[rulers.ix.ruler_id];
  if (!id) errs.push('rulers 空 ruler_id');
  else if (rulerIds.has(id)) errs.push('rulers 重复 ' + id); else rulerIds.add(id);
}
let A, B;
try { A = currentRuler(rulers, 'A')[rulers.ix.ruler_id]; B = currentRuler(rulers, 'B')[rulers.ix.ruler_id]; }
catch (e) { errs.push(e.message); }
const batchIds = new Set();
for (const r of batches.rows) {
  const id = r[batches.ix.batch_id];
  if (!id) errs.push('batches 空 batch_id'); else if (batchIds.has(id)) errs.push('batches 重复 ' + id); else batchIds.add(id);
  if (!rulerIds.has(r[batches.ix.ruler_id])) errs.push('batch ' + id + ' 指向不存在的尺 ' + r[batches.ix.ruler_id]);
}
const seen = new Set(), cover = new Map(), perRuler = {};
for (const r of rd.rows) {
  const pid = r[rd.ix.pack_id], rid = r[rd.ix.ruler_id];
  const cell = r[rd.ix.cell], hor = r[rd.ix.horizon];
  if (!regIds.has(pid)) errs.push('readings 指向未登记 pack ' + pid);
  if (!rulerIds.has(rid)) errs.push('readings 指向不存在的尺 ' + rid);
  if (!batchIds.has(r[rd.ix.batch_id])) errs.push('readings 指向不存在的批 ' + r[rd.ix.batch_id]);
  if (['2', '3', '5', '8'].indexOf(cell) < 0) errs.push('readings cell 非法 ' + cell);
  if (['short', 'long'].indexOf(hor) < 0) errs.push('readings horizon 非法 ' + hor);
  const v = Number(r[rd.ix.value]);
  if (!isFinite(v)) errs.push('readings 非数 ' + pid + ' ' + rid + ' ' + cell + ' ' + hor);
  const k = pid + '|' + rid + '|' + cell + '|' + hor;
  if (seen.has(k)) errs.push('readings 重复键 ' + k); else seen.add(k);
  perRuler[rid] = (perRuler[rid] || 0) + 1;
  if (rid === A || rid === B) {
    const m = cover.get(pid) || { n: 0 };
    m.n++; cover.set(pid, m);
  }
}
for (const p of ['features.tsv', 'projections.tsv', 'readings/h5-frozen.tsv', 'display.tsv']) {
  const t = p === 'features.tsv' ? feat : p === 'projections.tsv' ? proj : p === 'display.tsv' ? disp : h5;
  if (!t) continue;
  const idCol = t.ix.pack_id !== undefined ? t.ix.pack_id : t.ix.id;
  const s = new Set();
  for (const r of t.rows) { const id = r[idCol]; if (!regIds.has(id)) errs.push(p + ' 指向未登记 ' + id); if (s.has(id)) errs.push(p + ' 重复 ' + id); s.add(id); }
}
const missing = [...regIds].filter((id) => !cover.has(id) || cover.get(id).n < 16);
if (missing.length) {
  const msg = '有 ' + missing.length + ' 枚缺 current A/B 16 格（前 8：' + missing.slice(0, 8).join(' ') + '）';
  if (STRICT) errs.push(msg); else warns.push(msg);
}
let cmp = null;
try { cmp = buildView({ data: DATA, compare: join(DATA, '..', 'coords-gen3-1105.tsv'), noWrite: true }).report.compare; }
catch (e) { errs.push('build-view 对照失败：' + e.message); }
console.log('registry ' + regIds.size + ' ‖ rulers A=' + A + ' B=' + B + ' ‖ batches ' + batchIds.size + ' ‖ readings ' + rd.rows.length);
console.log('readings 按尺 ' + Object.entries(perRuler).map(([k, v]) => k + '=' + v).join(' ‖ '));
if (cmp) console.log('对照 coords-gen3：matched ' + cmp.matched + ' max ' + cmp.max_abs_diff + ' mismatch ' + cmp.mismatches);
if (warns.length) console.log('⚠ ' + warns.join(' ‖ '));
if (errs.length) { console.error('⛔ ' + errs.length + ' 条：\n  ' + errs.slice(0, 20).join('\n  ')); process.exit(2); }
console.log('✅ data 模型校验通过' + (STRICT ? '（strict）' : ''));
