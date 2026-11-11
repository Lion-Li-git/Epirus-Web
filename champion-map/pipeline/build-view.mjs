#!/usr/bin/env node
/* build-view.mjs —— 从长表编译页面用的“考卷视图”（数据模型 A）
 * 输入：data/registry.tsv + data/readings/current.tsv + data/rulers.tsv（current A/B）
 * 输出：data/build/exam-view.tsv（P 与 C 列）+ data/build/report.json
 * 关键：这里只读 readings；projections.tsv 只进报告、不参与换尺 —— 换尺只动数值，不动坐标。
 * 用法：node champion-map/pipeline/build-view.mjs [--data=champion-map/data] [--compare=champion-map/coords-gen3-1105.tsv] [--no-write]
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTable, writeTable, tableStamp } from '../map-table.mjs';
import { loadRulers, currentRuler } from './rulers.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const CELLS = [2, 3, 5, 8];
const HORIZONS = [['short', ''], ['long', 'L']];
const PCOLS = [];
for (const h of HORIZONS) for (const c of CELLS) PCOLS.push(h[0] === 'short' ? 'P' + c : 'P' + c + 'L');
const BCOLS = [];
for (const h of HORIZONS) for (const c of CELLS) BCOLS.push(h[0] === 'short' ? 'P' + c + 'R' : 'P' + c + 'RL');
const CCOLS = [];
for (const h of HORIZONS) for (const c of CELLS) CCOLS.push(h[0] === 'short' ? 'C' + c + 'R' : 'C' + c + 'RL');
const HEAD = ['id'].concat(PCOLS, BCOLS, CCOLS);

function toNum(v) { if (v === '' || v === undefined || v === null) return null; const n = Number(v); return isFinite(n) ? n : null; }
function put(row, ix, v) { if (v === null) return; row[ix] = String(v); }

export function buildView(opts) {
  opts = opts || {};
  const data = resolve(opts.data || 'champion-map/data');
  const comparePath = resolve(opts.compare || 'champion-map/archive/2026-11-11-legacy-data/coords-gen3-1105.tsv');
  const reg = readTable(join(data, 'registry.tsv'));
  const rd = readTable(join(data, 'readings/current.tsv'));
  const rulers = loadRulers(join(data, 'rulers.tsv'));
  const A = currentRuler(rulers, 'A')[rulers.ix.ruler_id];
  const B = currentRuler(rulers, 'B')[rulers.ix.ruler_id];
  for (const c of ['pack_id', 'ruler_id', 'cell', 'horizon', 'value']) if (rd.ix[c] === undefined) throw new Error('readings 缺列 ' + c);
  const vals = new Map();
  for (const r of rd.rows) {
    const pid = r[rd.ix.pack_id], rid = r[rd.ix.ruler_id];
    const k = rid + '|' + r[rd.ix.cell] + '|' + r[rd.ix.horizon];
    if (!vals.has(pid)) vals.set(pid, {});
    if (vals.get(pid)[k] !== undefined) throw new Error('readings 重复键 ' + pid + ' ' + k);
    vals.get(pid)[k] = toNum(r[rd.ix.value]);
  }
  const out = [];
  const missing = [];
  for (const r of reg.rows) {
    const pid = r[reg.ix.pack_id];
    const v = vals.get(pid) || {};
    const row = new Array(HEAD.length).fill('');
    row[0] = pid;
    let any = false, all = 0;
    for (const h of HORIZONS) for (const c of CELLS) {
      const suf = h[1];
      const av = v[A + '|' + c + '|' + h[0]];
      const bv = v[B + '|' + c + '|' + h[0]];
      const ai = HEAD.indexOf('P' + c + suf), bi = HEAD.indexOf('P' + c + 'R' + suf), ci = HEAD.indexOf('C' + c + 'R' + suf);
      if (av !== null && av !== undefined) { row[ai] = String(av); any = true; }
      if (bv !== null && bv !== undefined) { row[bi] = String(bv); any = true; }
      if (av !== null && av !== undefined && bv !== null && bv !== undefined) { row[ci] = String((av + bv) / 2); all++; }
    }
    if (!any) missing.push(pid);
    out.push(row);
  }
  const viewPath = join(data, 'build/exam-view.tsv');
  if (!opts.noWrite) {
    mkdirSync(join(data, 'build'), { recursive: true });
    writeTable(viewPath, { header: HEAD, rows: out }, { backup: false });
  }
  let cmp = null;
  if (existsSync(comparePath)) {
    const ct = readTable(comparePath);
    const cid = ct.ix.id;
    let maxD = 0, mism = 0, missView = 0, missCmp = 0;
    const byId = new Map(ct.rows.map((r) => [r[cid], r]));
    const seen = new Set();
    for (const r of out) {
      const pid = r[0], cr = byId.get(pid);
      if (!cr) { missCmp++; continue; }
      seen.add(pid);
      for (let i = 1; i < HEAD.length; i++) {
        const a = toNum(r[i]), b = toNum(cr[ct.ix[HEAD[i]]]);
        if (a === null && b === null) continue;
        if (a === null || b === null) { mism++; continue; }
        const d = Math.abs(a - b);
        if (d > maxD) maxD = d;
        if (d > 1e-9) mism++;
      }
    }
    for (const r of ct.rows) if (!out.some((x) => x[0] === r[cid])) missView++;
    cmp = { path: comparePath, max_abs_diff: maxD, mismatches: mism, missing_in_view: missView, missing_in_compare: missCmp, matched: seen.size };
    if (mism || missView) {
      const e = new Error('exam-view 与 ' + comparePath + ' 不一致：mismatch=' + mism + ' max=' + maxD + ' missing_view=' + missView + ' missing_compare=' + missCmp);
      e.report = cmp;
      throw e;
    }
  }
  const projPath = join(data, 'projections.tsv');
  const report = {
    generated_at: new Date().toISOString(),
    data,
    rows: out.length,
    readings_rows: rd.rows.length,
    current_rulers: { A, B },
    missing_packs: missing.length,
    compare: cmp,
    files: {
      registry: tableStamp(reg),
      readings: tableStamp(rd),
      projections: existsSync(projPath) ? tableStamp(readTable(projPath)) : '（无）',
    },
  };
  if (!opts.noWrite) writeFileSync(join(data, 'build/report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  return { report, viewPath, header: HEAD, rows: out };
}

/* 完整页面视图：以 data/ 为源，模板只提供 viewer 还需的纯展示列（rank/F/x2/Sc/kin/ok 等）。
 * 新点没有模板行时，行从空开始，只填 canonical 列；缺 display 列由 add-point/门禁负责。 */
export function buildCoordsView(opts) {
  opts = opts || {};
  const data = resolve(opts.data || 'champion-map/data');
  const templatePath = resolve(opts.template || join(data, 'display.tsv'));
  const tpl = readTable(templatePath);
  const displayPath = resolve(opts.display || join(data, 'display.tsv'));
  const disp = existsSync(displayPath) ? readTable(displayPath) : null;
  if (disp && disp.header.join('\t') !== tpl.header.join('\t')) throw new Error('display.tsv 表头与模板不一致');
  const reg = readTable(join(data, 'registry.tsv'));
  const feats = readTable(join(data, 'features.tsv'));
  const projs = readTable(join(data, 'projections.tsv'));
  const h5 = readTable(join(data, 'readings/h5-frozen.tsv'));
  const rd = readTable(join(data, 'readings/current.tsv'));
  const rulers = loadRulers(join(data, 'rulers.tsv'));
  const A = currentRuler(rulers, 'A')[rulers.ix.ruler_id];
  const B = currentRuler(rulers, 'B')[rulers.ix.ruler_id];
  const head = tpl.header.slice();
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  const by = (t, idCol) => new Map(t.rows.map((r) => [r[t.ix[idCol]], r]));
  const fm = by(feats, 'pack_id'), pm = by(projs, 'pack_id'), hm = by(h5, 'pack_id');
  const vals = new Map(), nvals = new Map();
  for (const r of rd.rows) {
    const k = r[rd.ix.pack_id] + '|' + r[rd.ix.ruler_id] + '|' + r[rd.ix.cell] + '|' + r[rd.ix.horizon];
    vals.set(k, r[rd.ix.value]); nvals.set(k, r[rd.ix.n]);
  }
  const tplById = new Map(tpl.rows.map((r) => [r[tpl.ix.id], r]));
  const dispById = new Map((disp ? disp.rows : []).map((r) => [r[disp.ix.id], r]));
  const rows = [], missingDisplay = [];
  const get = (pid, rid, c, h) => vals.get(pid + '|' + rid + '|' + c + '|' + h);
  const getN = (pid, rid, c, h) => nvals.get(pid + '|' + rid + '|' + c + '|' + h);
  const set = (row, col, v) => { if (v !== undefined && v !== null && ix[col] !== undefined) row[ix[col]] = String(v); };
  for (const r of reg.rows) {
    const pid = r[reg.ix.pack_id];
    const tr = dispById.get(pid) || tplById.get(pid);
    const row = tr ? tr.slice() : new Array(head.length).fill('');
    if (!tr) missingDisplay.push(pid);
    set(row, 'id', pid);
    set(row, 'path', r[reg.ix.path]);
    set(row, 'ver', r[reg.ix.ver]);
    set(row, 'lineage', r[reg.ix.lineage]);
    const f = fm.get(pid), p = pm.get(pid), h = hm.get(pid);
    for (const c of ['S', 'Geff', 'rounds', 'dmg', 'heavy', 'holo', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk', 'rwDmg']) {
      if (f) set(row, c, f[feats.ix[c]]);
    }
    for (const c of ['xt', 'yt', 'xt3', 'yt3', 'zt3', 'xt18', 'yt18', 'xt20', 'yt20']) {
      if (p) set(row, c, p[projs.ix[c]]);
    }
    if (h) for (const c of ['H5', 'Hp5', 'Hlong5', 'Hplong5', 'Flong5']) set(row, c, h[h5.ix[c]]);
    for (const hz of HORIZONS) for (const cell of CELLS) {
      const suf = hz[1], hor = hz[0];
      const av = get(pid, A, cell, hor), bv = get(pid, B, cell, hor);
      if (av !== undefined) { set(row, 'P' + cell + suf, av); set(row, 'n' + cell + suf, getN(pid, A, cell, hor)); }
      if (bv !== undefined) { set(row, 'P' + cell + 'R' + suf, bv); set(row, 'm' + cell + 'R' + suf, getN(pid, B, cell, hor)); }
      if (av !== undefined && bv !== undefined) set(row, 'C' + cell + 'R' + suf, (Number(av) + Number(bv)) / 2);
    }
    rows.push(row);
  }
  let maxD = 0, mism = 0;
  const PROJ = new Set(['xt', 'yt', 'xt3', 'yt3', 'zt3', 'xt18', 'yt18', 'xt20', 'yt20']);
  for (let i = 0; i < rows.length; i++) {
    if (dispById.has(rows[i][0])) continue;
    const tr = tplById.get(rows[i][0]);
    if (!tr) continue;
    for (let c = 0; c < head.length; c++) {
      if (PROJ.has(head[c])) continue;
      const a = rows[i][c], b = tr[c];
      if (a === b) continue;
      const na = Number(a), nb = Number(b);
      if (isFinite(na) && isFinite(nb)) {
        const d = Math.abs(na - nb); if (d > maxD) maxD = d; if (d > 1e-9) mism++;
      } else mism++;
    }
  }
  if (mism) throw new Error('coords-view 与模板不一致：mismatch=' + mism + ' max_abs_diff=' + maxD);
  const outPath = join(data, 'build/coords-view.tsv');
  if (!opts.noWrite) {
    mkdirSync(join(data, 'build'), { recursive: true });
    writeTable(outPath, { header: head, rows }, { backup: false });
  }
  return { path: outPath, header: head, rows, missingDisplay };
}

const IS_MAIN = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  try {
    const r = buildView({ data: arg('data', 'champion-map/data'), compare: arg('compare', 'champion-map/archive/2026-11-11-legacy-data/coords-gen3-1105.tsv'), noWrite: process.argv.includes('--no-write') });
    const cv = buildCoordsView({ data: arg('data', 'champion-map/data'), noWrite: process.argv.includes('--no-write') });
    console.log('exam-view: ' + r.rows.length + ' 行 × ' + r.header.length + ' 列 ⇒ ' + r.viewPath);
    console.log('coords-view: ' + cv.rows.length + ' 行 × ' + cv.header.length + ' 列 ⇒ ' + cv.path + ' ‖ 无 display 模板 ' + cv.missingDisplay.length);
    if (r.report.compare) console.log('对照 ' + r.report.compare.path + '：matched ' + r.report.compare.matched + ' ‖ max_abs_diff ' + r.report.compare.max_abs_diff + ' ‖ mismatch ' + r.report.compare.mismatches);
    console.log('current A/B = ' + r.report.current_rulers.A + ' / ' + r.report.current_rulers.B + ' ‖ projections 未参与换尺');
  } catch (e) {
    console.error('⛔ ' + e.message);
    process.exit(2);
  }
}
