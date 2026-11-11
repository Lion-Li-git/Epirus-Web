#!/usr/bin/env node
/* add-point.mjs —— 新点进图的唯一数据入口（2026-11-11 · 数据模型 A）
 * 输入：
 *   --pack=<权重路径> --id=<id> --ver=<1.8|2.0> [--fam=] [--fam-label=] [--lineage=]
 *   --readings=<长表：ruler_id,cell,horizon,value,n>  （A/B 当前读数）
 *   --display=<一行 display 表，表头必须等于 data/display.tsv>  （--bake 时必给）
 *   [--batch=] [--fixture=] [--source=] [--bake] [--dry]
 * 行为：登记 registry → 追加 batch/readings/display（+ features/projections）→ build-view
 *       →（--bake）rebuild-map → shot 98/0。
 * 注：本脚本不跑测量；读数/display 由 ruler-measure / 门禁产出后喂进来。
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readTable, writeTable } from '../map-table.mjs';
import { loadRulers } from './rulers.mjs';
import { buildView, buildCoordsView } from './build-view.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const DRY = process.argv.includes('--dry');
const BAKE = process.argv.includes('--bake');
const DATA = resolve(arg('data', 'champion-map/data'));
const PACK = resolve(arg('pack', ''));
const ID = String(arg('id', '')).trim();
const VER = String(arg('ver', '2.0')).trim();
const FAM = String(arg('fam', '')).trim();
const FAMLAB = String(arg('fam-label', '')).trim();
const LINEAGE = String(arg('lineage', 'new')).trim();
const RD = arg('readings', '') ? resolve(arg('readings', '')) : '';
const DISP = arg('display', '') ? resolve(arg('display', '')) : '';
const PJ = arg('projections', '') ? resolve(arg('projections', '')) : '';
const BATCH = String(arg('batch', '')).trim();
const FIXTURE = String(arg('fixture', '-')).trim();
const SOURCE = String(arg('source', 'manual')).trim();
if (!PACK || !ID) { console.error('⛔ 需要 --pack= 和 --id='); process.exit(2); }
if (!existsSync(PACK)) { console.error('⛔ pack 不在：' + PACK); process.exit(2); }
if (!RD) { console.error('⛔ 需要 --readings=<长表>'); process.exit(2); }
if (!existsSync(RD)) { console.error('⛔ readings 不在：' + RD); process.exit(2); }
if (BAKE && !DISP) { console.error('⛔ --bake 需要 --display=<一行 display 表>（否则页面缺展示列）'); process.exit(2); }

const reg = readTable(join(DATA, 'registry.tsv'));
const rulers = loadRulers(join(DATA, 'rulers.tsv'));
const batches = readTable(join(DATA, 'batches.tsv'));
if (BATCH && batches.rows.some((r) => r[batches.ix.batch_id] === BATCH)) { console.error('⛔ batch 已存在：' + BATCH); process.exit(2); }
const rd = readTable(join(DATA, 'readings/current.tsv'));
const display = readTable(join(DATA, 'display.tsv'));
if (reg.rows.some((r) => r[reg.ix.pack_id] === ID)) { console.error('⛔ registry 已有 ' + ID); process.exit(2); }
for (const c of ['ruler_id', 'cell', 'horizon', 'value', 'n']) if (readTable(RD).ix[c] === undefined) { console.error('⛔ readings 缺列 ' + c); process.exit(2); }
const RT = readTable(RD);
const rulerById = new Map(rulers.rows.map((r) => [r[rulers.ix.ruler_id], r]));
const newReadings = [];
for (const r of RT.rows) {
  const rid = r[RT.ix.ruler_id], cell = r[RT.ix.cell], hor = r[RT.ix.horizon], v = Number(r[RT.ix.value]);
  if (!rulerById.has(rid)) { console.error('⛔ readings 指向不存在的尺 ' + rid); process.exit(2); }
  if (!['2', '3', '5', '8'].includes(cell) || !['short', 'long'].includes(hor) || !isFinite(v)) {
    console.error('⛔ readings 非法行 ' + JSON.stringify([rid, cell, hor, r[RT.ix.value]])); process.exit(2);
  }
  if (rulerById.get(rid)[rulers.ix.status] === 'frozen') { console.error('⛔ frozen 尺不许写：' + rid); process.exit(2); }
  newReadings.push([ID, rid, cell, hor, String(v), String(r[RT.ix.n] || ''), BATCH || ('add-' + ID + '-' + new Date().toISOString().slice(0, 10).replace(/-/g, '')), '']);
}
let dispRow = null;
if (DISP) {
  const D = readTable(DISP);
  if (D.header.join('\t') !== display.header.join('\t')) { console.error('⛔ display 表头与 data/display.tsv 不一致'); process.exit(2); }
  if (D.rows.length !== 1) { console.error('⛔ display 必须恰好 1 行'); process.exit(2); }
  if (D.rows[0][D.ix.id] !== ID) { console.error('⛔ display.id=' + D.rows[0][D.ix.id] + ' ≠ --id=' + ID); process.exit(2); }
  dispRow = D.rows[0].slice();
}
const sha = createHash('sha256').update(readFileSync(PACK)).digest('hex');
const now = new Date().toISOString();
const newReg = [ID, PACK, VER, FAM, FAMLAB, LINEAGE, now, sha, 'active'];
const bid = BATCH || ('add-' + ID + '-' + now.slice(0, 10).replace(/-/g, ''));
const newBatch = [bid, rd.rows.length ? rd.rows[0][rd.ix.ruler_id] : 'a-v2-page-1109', 'A', FIXTURE, '-', bid, basename(RD), String(RT.rows.length), now, 'add-point'];
console.log('add-point: ' + ID + ' ‖ pack ' + basename(PACK) + ' ‖ readings ' + newReadings.length + ' ‖ display ' + (dispRow ? '有' : '无') + ' ‖ batch ' + bid);
if (DRY) { console.log('--dry：未写文件'); process.exit(0); }

const wt = (file, table, rows) => writeTable(join(DATA, file), { header: table.header, rows }, { backup: false });
wt('registry.tsv', reg, reg.rows.concat([newReg]));
wt('batches.tsv', batches, batches.rows.concat([newBatch]));
wt('readings/current.tsv', rd, rd.rows.concat(newReadings));
if (dispRow) wt('display.tsv', display, display.rows.concat([dispRow]));
/* 从 display 同步 features/projections（新点 canonical 列不能只留在 display） */
if (dispRow) {
  const ft = readTable(join(DATA, 'features.tsv'));
  const frow = [ID].concat(['rounds', 'dmg', 'heavy', 'holo', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk', 'rwDmg', 'S', 'Geff'].map((c) => display.ix[c] !== undefined ? dispRow[display.ix[c]] : ''));
  wt('features.tsv', ft, ft.rows.concat([frow]));
}
if (PJ) {
  const pt = readTable(join(DATA, 'projections.tsv')), pj = readTable(PJ);
  if (pj.header.join('\t') !== pt.header.join('\t')) { console.error('⛔ projections 表头不一致'); process.exit(2); }
  if (pj.rows.length !== reg.rows.length + 1) { console.error('⛔ projections 行数 ' + pj.rows.length + ' ≠ registry+1 ' + (reg.rows.length + 1)); process.exit(2); }
  wt('projections.tsv', pt, pj.rows);
} else if (dispRow) {
  const pt = readTable(join(DATA, 'projections.tsv'));
  const prow = [ID].concat(['xt', 'yt', 'xt3', 'yt3', 'zt3', 'xt18', 'yt18', 'xt20', 'yt20'].map((c) => display.ix[c] !== undefined ? dispRow[display.ix[c]] : ''));
  wt('projections.tsv', pt, pt.rows.concat([prow]));
}
try {
  const v = buildView({ data: DATA, compare: join(DATA, '.no-compare') });
  const cv = buildCoordsView({ data: DATA });
  console.log('build: exam-view ' + v.rows.length + ' 行 ‖ coords-view ' + cv.rows.length + ' 行，无 display ' + cv.missingDisplay.length);
  if (BAKE) {
    const out = execFileSync('node', [join(DATA, '..', 'rebuild-map.mjs'), '--data=' + DATA], { cwd: resolve(DATA, '..', '..'), encoding: 'utf8', maxBuffer: 1 << 26 });
    console.log(out.trim().split('\n').slice(-4).join('\n'));
  }
} catch (e) {
  console.error('⛔ add-point 写入后构建失败：' + e.message);
  process.exit(2);
}
console.log('✅ add-point 完成：' + ID);
