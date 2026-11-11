#!/usr/bin/env node
/* 给 coords 加 exam 批次戳（2026-11-11 · 考卷/ map 重构阶段 1）
 * 目的：把每一行的 A/B/C 读数标到**来源批次 + 夹具 + run id**，让“B 轴下行是能力还是夹具漂移”可判。
 * 口径：
 *   A 短/长 = exam4-page-1109(.tsv|-6par) ；obs5 那 13 枚 A 值来自 triplet-ledger（cells_S/L[2]）
 *   B 短   = exam4-F2-page-1111(.tsv|-6par|-86|-msb1314)，夹具 F2
 *   B 长   = exam4-F2-page-long-1111(.tsv|-6par|-86)，夹具 F2
 *   C      = (A+B)/2（attach-cmean-r.mjs 的单一来源；本脚本只戳，不算 C）
 * 写列：examA / examAL / examBs / examBl / examFix / examC（追加在表尾，可重复跑）
 * 守卫：--check 时 unknown / 旧 B 夹具 / fixture 不一致 / C 与 (A+B)/2 不符 ⇒ exit 2
 * 用法：node champion-map/attach-exam-stamp.mjs [--in=champion-map/coords-gen3-1105.tsv] [--check]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readTable, writeTable } from './map-table.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const IN = arg('in', 'champion-map/coords-gen3-1105.tsv');
const CHECK = process.argv.indexOf('--check') >= 0;
const ALLOW = process.argv.indexOf('--allow-unknown') >= 0;
const ROOT = 'champion-map/';
const baseId = (s) => String(s || '').replace(/\\/g, '/').split('/').pop().replace(/\.(js|bak|tsv)$/, '');
function loose(f) {
  const lines = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  return { h: lines[0].split('\t'), rows: lines.slice(1).map((l) => l.split('\t')) };
}
function addMap(map, f, tag, fixture) {
  if (!existsSync(f)) { console.log('  （缺，跳过）' + f); return 0; }
  const t = loose(f); const idI = t.h.indexOf('id'), chI = t.h.indexOf('champ');
  let n = 0;
  for (const r of t.rows) {
    const id = baseId(r[idI]); if (!id) continue;
    if (!map.has(id)) { map.set(id, { tag: tag, src: basename(f), fixture: chI >= 0 ? (r[chI] || '') : '' }); n++; }
  }
  console.log('  ' + f + ' ⇒ ' + n + ' 枚（' + tag + '）');
  return n;
}
const A = new Map(), AL = new Map(), BS = new Map(), BL = new Map();
console.log('A 短：');
addMap(A, ROOT + 'exam4-page-1109.tsv', 'A-1109/main');
addMap(A, ROOT + 'exam4-page-1109-6par.tsv', 'A-1109/6par');
console.log('A 长：');
addMap(AL, ROOT + 'exam4-page-long-1109.tsv', 'A-1109L/main');
addMap(AL, ROOT + 'exam4-page-long-1109-6par.tsv', 'A-1109L/6par');
/* obs5 13 枚的 A 值住在 triplet-ledger（cells_S/L[2]） */
const LED = 'scratch/night-adapt2/triplet-ledger.tsv';
if (existsSync(LED)) {
  let n = 0;
  for (const line of readFileSync(LED, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let j; try { j = JSON.parse(line); } catch (e) { continue; }
    const id = baseId(j.pack); if (!id) continue;
    if (!A.has(id)) { A.set(id, { tag: 'A-ledger/night-adapt2', src: basename(LED), fixture: '' }); n++; }
    if (!AL.has(id)) AL.set(id, { tag: 'A-ledger/night-adapt2', src: basename(LED), fixture: '' });
  }
  console.log('  ' + LED + ' ⇒ ' + n + ' 枚（A-ledger/night-adapt2）');
}
console.log('B 短：');
addMap(BS, ROOT + 'exam4-F2-page-1111.tsv', 'F2s-1111/main');
addMap(BS, ROOT + 'exam4-F2-page-1111-msb1314.tsv', 'F2s-1111/msb1314');
addMap(BS, ROOT + 'exam4-F2-page-1111-86.tsv', 'F2s-1111/86');
addMap(BS, ROOT + 'exam4-F2-page-1111-6par.tsv', 'F2s-1111/6par');
console.log('B 长：');
addMap(BL, ROOT + 'exam4-F2-page-long-1111.tsv', 'F2l-1111/main');
addMap(BL, ROOT + 'exam4-F2-page-long-1111-86.tsv', 'F2l-1111/86');
addMap(BL, ROOT + 'exam4-F2-page-long-1111-6par.tsv', 'F2l-1111/6par');

const fixtures = new Set();
for (const m of [BS, BL]) for (const v of m.values()) if (v.fixture) fixtures.add(v.fixture);
const FIX = [...fixtures];
if (FIX.length !== 1) { console.error('⛔ B 夹具不唯一（' + FIX.length + ' 种）：' + FIX.join(' ‖ ')); process.exit(2); }
console.log('B 夹具 = ' + FIX[0]);

const T = readTable(IN);
const add = (name) => { let i = T.header.indexOf(name); if (i < 0) { T.header.push(name); i = T.header.length - 1; } return i; };
const xA = add('examA'), xAL = add('examAL'), xBs = add('examBs'), xBl = add('examBl'), xFix = add('examFix'), xC = add('examC');
for (const r of T.rows) while (r.length < T.header.length) r.push('');
const idI = T.ix.id, p5 = T.ix.P5, p5l = T.ix.P5L, p5r = T.ix.P5R, p5rl = T.ix.P5RL, c5 = T.ix.C5R, c5l = T.ix.C5RL;
let unknown = 0, mixedOld = 0, cmis = 0, nA = 0, nBs = 0, nBl = 0;
const unknownIds = [];
for (const r of T.rows) {
  const id = baseId(r[idI]);
  const a = A.get(id), al = AL.get(id), bs = BS.get(id), bl = BL.get(id);
  /* 源表可能已归档/删除；已有戳的行走“保留旧戳”，不因源表缺失把历史读成 unknown。 */
  r[xA] = a ? a.tag : (r[xA] || ''); r[xAL] = al ? al.tag : (r[xAL] || '');
  r[xBs] = bs ? bs.tag : (r[xBs] || ''); r[xBl] = bl ? bl.tag : (r[xBl] || '');
  r[xFix] = FIX[0];
  r[xC] = 'A+B/2';
  if (a) nA++;
  if (bs) nBs++;
  if (bl) nBl++;
  const need = (r[p5] !== '' && r[p5] !== undefined) || (r[p5l] !== '' && r[p5l] !== undefined);
  if (need && (!r[xA] || !r[xAL])) { unknown++; unknownIds.push(id + ' A'); }
  if (r[p5r] !== '' && r[p5r] !== undefined && !r[xBs]) { unknown++; unknownIds.push(id + ' Bs'); }
  if (r[p5rl] !== '' && r[p5rl] !== undefined && !r[xBl]) { unknown++; unknownIds.push(id + ' Bl'); }
  for (const src of [r[xBs], r[xBl]]) if (/-obs5/.test(src)) mixedOld++;
  if (r[p5] !== '' && r[p5r] !== '' && r[c5] !== '') {
    const d = Math.abs(((+r[p5]) + (+r[p5r])) / 2 - (+r[c5]));
    if (d > 1e-9) { cmis++; if (cmis <= 3) console.log('  C 不符：' + id + ' C5R=' + r[c5] + ' (P5+P5R)/2=' + (((+r[p5]) + (+r[p5r])) / 2)); }
  }
}
console.log('覆盖：A ' + nA + '/' + T.rowsN + ' ‖ Bs ' + nBs + '/' + T.rowsN + ' ‖ Bl ' + nBl + '/' + T.rowsN + ' ‖ unknown ' + unknown + ' ‖ 旧B夹具 ' + mixedOld + ' ‖ C不符 ' + cmis);
if (unknownIds.length) console.log('  unknown 前 10：' + unknownIds.slice(0, 10).join(' | '));
if (CHECK) {
  let bad = 0;
  if (unknown && !ALLOW) { console.error('⛔ unknown ' + unknown + ' 处（要放行加 --allow-unknown）'); bad++; }
  if (mixedOld) { console.error('⛔ 有行来自旧 B 夹具（-obs5）'); bad++; }
  if (cmis) { console.error('⛔ C 与 (A+B)/2 不符 ' + cmis + ' 行'); bad++; }
  if (bad) process.exit(2);
  console.log('✅ exam 批次戳检查通过（只读，不写盘）'); process.exit(0);
}
if (unknown && !ALLOW) { console.error('⛔ 有 ' + unknown + ' 处没有来源（要写 unknown 请显式 --allow-unknown）'); process.exit(2); }
const w = writeTable(IN, T, { backupTool: 'exam-stamp' });
const stamp = [
  'axis\tfamily\tsource\trun\tfixture\trows\tnote',
  'A\tP5/P5L\texam4-page-1109(.tsv|-6par)\t1109\tv2-scripts(28 seats)\t913\tA 短/长; obs5 13 枚走 triplet-ledger',
  'A\tP5/P5L\ttriplet-ledger.tsv\tnight-adapt2\tv2-scripts(28 seats)\t13\tcells_S/L[2]',
  'B\tshort(P5R)\texam4-F2-page-1111(.tsv|-6par|-86|-msb1314)\t1111\t' + FIX[0] + '\t926\tF2 固定夹具',
  'B\tlong(P5RL)\texam4-F2-page-long-1111(.tsv|-6par|-86)\t1111\t' + FIX[0] + '\t926\tF2 固定夹具',
  'C\tC5R/C5RL\t(A+B)/2\t-\t-\t926\tattach-cmean-r.mjs 计算；本脚本只戳'
].join('\n') + '\n';
writeFileSync(ROOT + 'EXAM-BATCHES.tsv', stamp, 'utf8');
console.log('已写 ' + IN + '（' + w.rowsN + ' 行；备份 ' + (w.backup ? basename(w.backup) : '无') + '）');
console.log('已写 ' + ROOT + 'EXAM-BATCHES.tsv');
