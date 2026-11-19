#!/usr/bin/env node
/* map-audit.mjs —— 图管线的结构体检（只读，不写盘）
 * 用法：node tools/map-audit.mjs [--data=champion-map/data] [--strict]
 * 检查（结构性 = 红，数据缺口 = 黄）：
 *   ① current 尺每个轴至多一条（A/B/C；X 可选）
 *   ② display.tsv 与 build/coords-view.tsv 表头逐字一致
 *   ③ readings 的 (pack,ruler,cell,horizon) 无重复
 *   ④ registry / display / coords-view / page/coords 的 id 集合一致
 *   ⑤ 当前 B 尺的读数必须能在 display 的 P?R 列逐格对上（抽全部有读数的行）
 *   ⑥ C?R = (P? + P?R)/2（有值的格子）
 *   ⑦ page/coords 里 5 个新包的 MxC/MxCL 为空 ⇒ 黄（旧 mx1116 批没测过它们）
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const DATA = resolve(arg('data', 'champion-map/data'));
const STRICT = process.argv.includes('--strict');
const tsv = (p) => {
  if (!existsSync(p)) return null;
  const L = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const h = L[0].split('\t');
  const ix = Object.fromEntries(h.map((c, i) => [c, i]));
  return { h, ix, rows: L.slice(1).map((l) => l.split('\t')) };
};
const red = [], yellow = [];
const need = (c, msg) => { if (!c) red.push(msg); };

const rulers = tsv(join(DATA, 'rulers.tsv'));
need(!!rulers, '缺 rulers.tsv');
if (rulers) {
  const cur = rulers.rows.filter((r) => r[rulers.ix.status] === 'current');
  const byAxis = {};
  for (const r of cur) (byAxis[r[rulers.ix.axis]] ||= []).push(r[rulers.ix.ruler_id]);
  for (const axis of ['A', 'B', 'C']) need((byAxis[axis] || []).length === 1, 'current ' + axis + ' 尺数量=' + ((byAxis[axis] || []).length));
  need(!byAxis.X || byAxis.X.length === 0, 'X 轴已退役但仍存在 current X');
}

const disp = tsv(join(DATA, 'display.tsv'));
const cv = tsv(join(DATA, 'build/coords-view.tsv'));
need(!!disp, '缺 display.tsv');
need(!!cv, '缺 build/coords-view.tsv（先跑 rebuild-map）');
if (disp && cv) need(disp.h.join('|') === cv.h.join('|'), 'display 与 coords-view 表头不一致');

const reg = tsv(join(DATA, 'registry.tsv'));
const pc = tsv(join(DATA, 'page/coords.tsv'));
const rd = tsv(join(DATA, 'readings/current.tsv'));
need(!!reg, '缺 registry.tsv'); need(!!pc, '缺 page/coords.tsv'); need(!!rd, '缺 readings/current.tsv');
if (reg && disp && cv && pc) {
  const ids = (t) => new Set(t.rows.map((r) => r[0]));
  const R = ids(reg), D = ids(disp), C = ids(cv), P = ids(pc);
  const diff = (a, b) => [...a].filter((x) => !b.has(x));
  need(diff(R, D).length === 0 && diff(D, R).length === 0, 'registry ↔ display id 不一致：' + diff(R, D).length + '/' + diff(D, R).length);
  need(diff(R, C).length === 0 && diff(C, R).length === 0, 'registry ↔ coords-view id 不一致：' + diff(R, C).length + '/' + diff(C, R).length);
  need(diff(R, P).length === 0 && diff(P, R).length === 0, 'registry ↔ page/coords id 不一致：' + diff(R, P).length + '/' + diff(P, R).length);
}
if (rd) {
  const seen = new Set(); let dup = 0;
  for (const r of rd.rows) {
    const k = [r[rd.ix.pack_id], r[rd.ix.ruler_id], r[rd.ix.cell], r[rd.ix.horizon]].join('|');
    if (seen.has(k)) dup++; seen.add(k);
  }
  need(dup === 0, 'readings 重复键 ' + dup);
}
/* ⑤⑥：B/C 对账（只查有值的格子） */
if (rulers && disp && rd && cv) {
  const bId = (rulers.rows.find((r) => r[rulers.ix.axis] === 'B' && r[rulers.ix.status] === 'current') || [])[rulers.ix.ruler_id];
  const bVal = new Map();
  for (const r of rd.rows) if (r[rd.ix.ruler_id] === bId) bVal.set([r[rd.ix.pack_id], r[rd.ix.cell], r[rd.ix.horizon]].join('|'), r[rd.ix.value]);
  const CV = new Map(cv.rows.map((r) => [r[0], r]));
  let miss = 0, bad = 0, cbad = 0;
  for (const [k, v] of bVal) {
    const [id, cell, hor] = k.split('|');
    const row = CV.get(id); if (!row) { miss++; continue; }
    const col = 'P' + cell + 'R' + (hor === 'long' ? 'L' : '');
    const got = row[cv.ix[col]];
    if (got === undefined || got === '') { miss++; continue; }
    if (Math.abs(Number(got) - Number(v)) > 1e-4) bad++;
    const a = row[cv.ix['P' + cell + (hor === 'long' ? 'L' : '')]];
    const c = row[cv.ix['C' + cell + 'R' + (hor === 'long' ? 'L' : '')]];
    if (a !== undefined && a !== '' && c !== '' && Math.abs(Number(c) - (Number(a) + Number(got)) / 2) > 1e-4) cbad++;
  }
  need(miss === 0, 'B 读数在 coords-view 缺格 ' + miss);
  need(bad === 0, 'B 读数与 P?R 不一致 ' + bad);
  need(cbad === 0, 'C?R ≠ (P?+P?R)/2 ' + cbad);
}
/* ⑦ 注册表路径缺失（黄） */
if (reg) {
  const miss = reg.rows.filter((r) => r[reg.ix.path] && !existsSync(join(DATA, '..', '..', r[reg.ix.path]))).map((r) => r[0]);
  if (miss.length) yellow.push('registry 路径不在盘：' + miss.length + ' 枚（11-19 清理，见 docs/ARTIFACT-LOSS-1119.md；池成员 0 枚）');
}
/* ⑦ 新包 C̄ 缺口（黄） */
if (pc) {
  const newIds = ['DIV-V3-PRESSURE-S2', 'DIV-V3-ANTIDEF', 'DIV-LH6-HEAVY-S2', 'RING-MINIT-CONT', 'P9-CN-MINI-CONT'];
  const empty = pc.rows.filter((r) => newIds.includes(r[0]) && (!r[pc.ix.MxC] || !r[pc.ix.MxCL])).map((r) => r[0]);
  if (empty.length) yellow.push('page/coords 的 MxC/MxCL 空：' + empty.join(',') + '（旧 mx1116 批未覆盖）');
}
for (const y of yellow) console.log('⚠ ' + y);
if (red.length) { for (const m of red) console.error('⛔ ' + m); console.error('map-audit: ' + red.length + ' 项结构错误'); process.exit(1); }
console.log('map-audit: 结构检查全过' + (yellow.length ? '（' + yellow.length + ' 项数据缺口，见上）' : ''));
