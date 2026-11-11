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
  const comparePath = resolve(opts.compare || 'champion-map/coords-gen3-1105.tsv');
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
    if (mism || missView || missCmp) {
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

const IS_MAIN = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  try {
    const r = buildView({ data: arg('data', 'champion-map/data'), compare: arg('compare', 'champion-map/coords-gen3-1105.tsv'), noWrite: process.argv.includes('--no-write') });
    console.log('exam-view: ' + r.rows.length + ' 行 × ' + r.header.length + ' 列 ⇒ ' + r.viewPath);
    if (r.report.compare) console.log('对照 ' + r.report.compare.path + '：matched ' + r.report.compare.matched + ' ‖ max_abs_diff ' + r.report.compare.max_abs_diff + ' ‖ mismatch ' + r.report.compare.mismatches);
    console.log('current A/B = ' + r.report.current_rulers.A + ' / ' + r.report.current_rulers.B + ' ‖ projections 未参与换尺');
  } catch (e) {
    console.error('⛔ ' + e.message);
    process.exit(2);
  }
}
