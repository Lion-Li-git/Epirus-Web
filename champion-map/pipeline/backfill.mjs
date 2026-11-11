#!/usr/bin/env node
/* backfill.mjs —— 一次性把现行 926 行迁到数据模型 A（2026-11-11）
 * 产出 champion-map/data/：
 *   registry.tsv / rulers.tsv / batches.tsv
 *   readings/current.tsv（A/B 长表） / readings/h5-frozen.tsv（只读参考）
 *   features.tsv / projections.tsv
 *   build/exam-view.tsv + build/report.json（与 coords-gen3 逐值对照）
 * 用法：node champion-map/pipeline/backfill.mjs [--force] [--no-sha] [--dry]
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { readTable, writeTable } from '../map-table.mjs';
import { buildView, buildCoordsView } from './build-view.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry');
const NO_SHA = process.argv.includes('--no-sha');
const CO = resolve(arg('coords', 'champion-map/coords-gen3-1105.tsv'));
const PROJ = resolve(arg('proj', 'champion-map/archive/2026-11-11-legacy-data/coords-projcols.tsv'));
const HERE = resolve('champion-map');
const DATA = resolve(arg('out', 'champion-map/data'));
const CELLS = [2, 3, 5, 8];
const HOR = [['short', ''], ['long', 'L']];
const clean = (s) => String(s === undefined || s === null ? '' : s).replace(/[\t\n]/g, ' ');

const co = readTable(CO);
const pj = readTable(PROJ);
if (co.rowsN !== pj.rowsN) throw new Error('coords/proj 行数不同：' + co.rowsN + ' vs ' + pj.rowsN);
const lin = new Map();
for (const f of ['champion-map/lineage.tsv', 'champion-map/lineage-g3.tsv']) {
  if (!existsSync(f)) continue;
  const t = readTable(f);
  for (const r of t.rows) {
    const id = r[t.ix.id]; if (!id) continue;
    const cur = lin.get(id) || {};
    if (!cur.ts && r[t.ix.ts]) cur.ts = r[t.ix.ts];
    if (!cur.fam && r[t.ix.fam]) cur.fam = r[t.ix.fam];
    if (!cur.famLabel && r[t.ix.famLabel]) cur.famLabel = r[t.ix.famLabel];
    lin.set(id, cur);
  }
}
const pjById = new Map(pj.rows.map((r) => [r[pj.ix.id], r]));
const f2 = (() => {
  try {
    const b = readTable('champion-map/EXAM-BATCHES.tsv');
    const r = b.rows.find((x) => x[b.ix.axis] === 'B' && /short/.test(x[b.ix.family]));
    return r ? r[b.ix.fixture] : '';
  } catch (e) { return ''; }
})();
if (!f2) throw new Error('EXAM-BATCHES.tsv 没有 B 短夹具');

const registry = [['pack_id', 'path', 'ver', 'fam', 'fam_label', 'lineage', 'ts', 'sha256', 'status']];
const feats = [['pack_id', 'rounds', 'dmg', 'heavy', 'holo', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk', 'rwDmg', 'S', 'Geff']];
const projs = [['pack_id', 'xt', 'yt', 'xt3', 'yt3', 'zt3', 'xt18', 'yt18', 'xt20', 'yt20']];
const h5 = [['pack_id', 'H5', 'Hp5', 'Hlong5', 'Hplong5', 'Flong5']];
const rd = [['pack_id', 'ruler_id', 'cell', 'horizon', 'value', 'n', 'batch_id', 'note']];
let shaN = 0;
for (const r of co.rows) {
  const id = r[co.ix.id]; if (!id) continue;
  const l = lin.get(id) || {};
  const path = r[co.ix.path] || '';
  let sha = '';
  if (!NO_SHA && path && existsSync(path)) { sha = createHash('sha256').update(readFileSync(path)).digest('hex'); shaN++; }
  registry.push([id, path, clean(r[co.ix.ver]), clean(l.fam), clean(l.famLabel), clean(r[co.ix.lineage]), clean(l.ts), sha, 'active']);
  feats.push([id].concat(['rounds', 'dmg', 'heavy', 'holo', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk', 'rwDmg', 'S', 'Geff'].map((c) => clean(r[co.ix[c]]))));
  const pr = pjById.get(id) || {};
  projs.push([id].concat(['xt', 'yt', 'xt3', 'yt3', 'zt3', 'xt18', 'yt18', 'xt20', 'yt20'].map((c) => clean(pr[pj.ix[c]]))));
  h5.push([id].concat(['H5', 'Hp5', 'Hlong5', 'Hplong5', 'Flong5'].map((c) => clean(r[co.ix[c]]))));
  for (const h of HOR) for (const cell of CELLS) {
    const suf = h[1];
    const av = r[co.ix['P' + cell + suf]], an = r[co.ix['n' + cell + suf]];
    if (av !== '' && av !== undefined) rd.push([id, 'a-v2-page-1109', String(cell), h[0], av, clean(an), 'a-1109', '']);
    const bv = r[co.ix['P' + cell + 'R' + suf]], bn = r[co.ix['m' + cell + 'R' + suf]];
    if (bv !== '' && bv !== undefined) rd.push([id, 'b-f2-page-1111', String(cell), h[0], bv, clean(bn), 'b-f2-1111', '']);
  }
}
/* 过线：旧 feas-s*.tsv 的混合桌 ok 一次性迁进 data/feasibility.tsv；之后 viewer 不再读 feas/panel。 */
const OKM = new Map();
for (const f of ['feas-s1.tsv', 'feas-s2.tsv', 'feas-s3.tsv', 'feas-s4.tsv', 'feas.tsv', 'feas-mixed-g3-1105.tsv']) {
  const fp = [join(HERE, f), join(HERE, 'archive/2026-11-11-legacy-data', f)].find((x) => existsSync(x));
  if (!fp) continue;
  /* 旧 feas.tsv 有 17 列的行（fails 里混了 tab），不能用严格 readTable；只取前几列。 */
  const lines = readFileSync(fp, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const hd = lines[0].split('\t');
  const iId = hd.indexOf('id'), iOk = hd.indexOf('ok'), iF = hd.indexOf('fails'), iG = hd.indexOf('G2'), iT = hd.indexOf('tag');
  if (iId < 0 || iOk < 0) continue;
  for (const line of lines.slice(1)) {
    const c = line.split('\t'); const id = c[iId]; if (!id) continue;
    if (c[iOk] === '0' || c[iOk] === '1') {
      OKM.set(id, { ok: c[iOk], fails: c[iF] || '', g2: iG >= 0 ? (c[iG] || '') : '', tag: iT >= 0 ? (c[iT] || '') : '' });
    }
  }
}
const feas = [['pack_id', 'ok', 'fails', 'g2', 'tag', 'okLong', 'failsLong', 'okShort', 'failsShort', 'source']];
for (const r of co.rows) {
  const id = r[co.ix.id]; if (!id) continue;
  const pr = pjById.get(id) || {};
  const o = OKM.get(id);
  feas.push([id, o ? o.ok : '', o ? o.fails : '', o ? o.g2 : '', o ? o.tag : '',
    clean(pr[pj.ix.okLong]), clean(pr[pj.ix.failsLong]), clean(pr[pj.ix.okShort]), clean(pr[pj.ix.failsShort]), o ? 'feas-legacy' : '']);
}

const rulers = [
  ['ruler_id', 'axis', 'label', 'status', 'unit', 'fixture', 'batch_id', 'formula', 'note'],
  ['a-v2-page-1109', 'A', 'v2 脚本桌（page dose）', 'current', 'excess', 'v2-scripts(28 seats)', 'a-1109', '', 'A 轴现行'],
  ['b-f2-page-1111', 'B', 'F2 冠军夹具（page dose）', 'current', 'excess', f2, 'b-f2-1111', '', 'B 轴现行；固定 F2 夹具'],
  ['c-cr', 'C', 'C=(A+B)/2', 'current', 'excess', '-', '-', '(A+B)/2', '派生，不存 readings'],
  ['h5-page-1109', 'H5', '旧 H5 页面卷', 'frozen', 'percent', 'legacy', 'h5-1109', '', 'frozen reference；流水线不写'],
];
const batches = [
  ['batch_id', 'ruler_id', 'axis', 'fixture', 'champ', 'run', 'source', 'rows', 'created', 'note'],
  ['a-1109', 'a-v2-page-1109', 'A', 'v2-scripts(28 seats)', '-', '1109', 'exam4-page-1109.tsv', String(co.rowsN), '2026-11-11', 'backfill'],
  ['b-f2-1111', 'b-f2-page-1111', 'B', f2, f2, '1111', 'exam4-F2-page-1111.tsv', String(co.rowsN), '2026-11-11', 'backfill'],
  ['h5-1109', 'h5-page-1109', 'H5', 'legacy', '-', '1109', 'coords.tsv(frozen)', String(co.rowsN), '2026-11-11', 'frozen reference'],
];
console.log('backfill: packs ' + (registry.length - 1) + ' ‖ readings ' + (rd.length - 1) + ' ‖ sha ' + shaN + ' ‖ f2=' + f2);
if (DRY) process.exit(0);
if (existsSync(DATA) && !FORCE) { console.error('⛔ ' + DATA + ' 已存在；确认重跑请 --force'); process.exit(2); }
if (existsSync(DATA) && FORCE) {
  const bak = join(dirname(DATA), 'data.bak-' + new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, ''));
  renameSync(DATA, bak);
  console.log('⚠ --force：旧 data 已移到 ' + bak);
}
mkdirSync(join(DATA, 'readings'), { recursive: true });
mkdirSync(join(DATA, 'build'), { recursive: true });
const wt = (rel, rows) => writeTable(join(DATA, rel), { header: rows[0], rows: rows.slice(1) }, { backup: false });
wt('registry.tsv', registry);
wt('features.tsv', feats);
wt('projections.tsv', projs);
wt('readings/h5-frozen.tsv', h5);
wt('readings/current.tsv', rd);
wt('feasibility.tsv', feas);
wt('display.tsv', [pj.header].concat(pj.rows));  // 旧 926 行的展示列也进 data/，页面不再依赖 coords-projcols
wt('rulers.tsv', rulers);
wt('batches.tsv', batches);
const README = `# data/ · champion-map 统一数据模型（2026-11-11）

> 源头：registry/rulers/batches/readings/features/projections/display/feasibility。
> 页面：build-view 编译 build/coords-view.tsv；viewer 不再读旧 coords-projcols/feas/panel/duel。
> 换尺：在 rulers.tsv 加一行 + 追加 readings；同轴旧尺标 reference；projections.tsv 不动。

| 文件 | 说明 |
|---|---|
| registry.tsv | id/path/ver/fam/... |
| rulers.tsv | 尺；current/reference/frozen |
| batches.tsv | 考试批次 |
| readings/current.tsv | 长表 A/B 读数 |
| readings/h5-frozen.tsv | 旧 H5 参考，冻结 |
| feasibility.tsv | ok/okLong/okShort |
| display.tsv | 146 列展示表（旧 926 + 新点） |
| features.tsv / projections.tsv | 行为 / 投影 |
| fit.tsv | 页面 fit 说明 |
| build/coords-view.tsv | 页面视图（gitignore） |

新点：node champion-map/pipeline/measure-point.mjs --pack=... --id=... --ver=2.0 [--bake]
`;
writeFileSync(join(DATA, 'README.md'), README, 'utf8');
const r = buildView({ data: DATA, compare: CO });
const cv = buildCoordsView({ data: DATA });
console.log('✅ backfill 完成：' + r.viewPath);
console.log('coords-view：' + cv.rows.length + ' 行 × ' + cv.header.length + ' 列 ⇒ ' + cv.path + ' ‖ 无 display 模板 ' + cv.missingDisplay.length);
console.log('对照 max_abs_diff=' + (r.report.compare ? r.report.compare.max_abs_diff : 'n/a') + ' mismatches=' + (r.report.compare ? r.report.compare.mismatches : 'n/a'));
