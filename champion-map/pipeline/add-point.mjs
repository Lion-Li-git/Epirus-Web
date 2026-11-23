#!/usr/bin/env node
/* add-point.mjs —— 新点进图的唯一数据入口（2026-11-11 · 数据模型 A）
 * 输入：
 *   --pack=<权重路径> --id=<id> --ver=<1.8|2.0> [--fam=] [--fam-label=] [--lineage=]
 *   --readings=<长表：ruler_id,cell,horizon,value,n>  （A/B 当前读数）
 *   --display=<一行 display 表，表头必须等于 data/display.tsv>  （--bake 时必给）
 *   [--batch=] [--fixture=] [--source=] [--parent=<id>] [--bake] [--dry]
 * 行为：登记 registry → 追加 batch/readings/display（+ features/projections）→ build-view
 *       →（--bake）rebuild-map → shot 98/0。
 * 注：本脚本不跑测量；读数/display 由 ruler-measure / 门禁产出后喂进来。
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join, basename, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readTable, writeTable } from '../map-table.mjs';
import { loadRulers } from './rulers.mjs';
import { buildView, buildCoordsView } from './build-view.mjs';
import { parseMeta, widOf } from '../pack-id.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const DRY = process.argv.includes('--dry');
const BAKE = process.argv.includes('--bake');
const DATA = resolve(arg('data', 'champion-map/data'));
const PACK = resolve(arg('pack', ''));
const ID = String(arg('id', '')).trim();
const VER = String(arg('ver', '2.0')).trim();
let FAM = String(arg('fam', '')).trim();
let FAMLAB = String(arg('fam-label', '')).trim();
let LINEAGE = String(arg('lineage', 'new')).trim();
const RD = arg('readings', '') ? resolve(arg('readings', '')) : '';
const DISP = arg('display', '') ? resolve(arg('display', '')) : '';
const PJ = arg('projections', '') ? resolve(arg('projections', '')) : '';
const BATCH = String(arg('batch', '')).trim();
const FIXTURE = String(arg('fixture', '-')).trim();
const SOURCE = String(arg('source', 'manual')).trim();
const PARENT_ARG = String(arg('parent', '')).trim();
const G2_ARG = String(arg('g2', '')).trim();
if (G2_ARG !== '' && !Number.isFinite(Number(G2_ARG))) { console.error('⛔ --g2 非数值：' + G2_ARG); process.exit(2); }
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

/* 自动谱系行（11-12 用户：新点不能只进地图；id/fam/ts/wid/seed/parent 一次写全）。
 *   fam 未给：沿用同名 --lineage 标签，找不到就新开一个号（max+1）；父边优先取 --parent=，
 *   否则先按 meta.hotstartFrom 直接查图，查不到时再沿局部包目录多跳回溯至图上最近祖先（每一跳
 *   都按 widOf === hotstartFrom 逐包核过权重指纹 ⇒ 升为 `seedpack-wid` 实线；仅靠手填 --parent=
 *   且无权重链可证时才落 `seedpack` 虚线），仍找不到才保留 unknown-wid。 */
/** Walk verified up/widOf/hotstartFrom links through local unplotted packs to find an ancestor on map. */
function findAncestorOnMap(startWid, startUp, dirs, resolveOnMap, rootDir, targetId = '') {
  const widParent = new Map();
  const widUp = new Map();
  const seenDirs = new Set();
  for (const dir of dirs) {
    if (!dir || seenDirs.has(dir) || !existsSync(dir)) continue;
    seenDirs.add(dir);
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.bak') && !name.endsWith('.js')) continue;
      const txt = readFileSync(join(dir, name), 'utf8');
      const w = widOf(txt), m = w && parseMeta(txt);
      if (w && m && m.hotstartFrom && !widParent.has(w)) {
        widParent.set(w, String(m.hotstartFrom).trim());
        widUp.set(w, m.up ? String(m.up).trim() : '');
      }
    }
  }
  const visited = new Set();
  let curWid = startWid;
  let curUp = String(startUp || '').trim();
  for (let hop = 0; hop < 16 && curWid && !visited.has(curWid); hop++) {
    visited.add(curWid);
    const id = resolveOnMap(curUp, curWid, targetId);
    if (id) return id;
    let nextWid = '', nextUp = '';
    if (curUp) {
      const upAbs = isAbsolute(curUp) ? curUp : join(rootDir, curUp);
      if (existsSync(upAbs)) {
        const txt = readFileSync(upAbs, 'utf8');
        const m = parseMeta(txt);
        if (m && m.hotstartFrom) {
          nextWid = String(m.hotstartFrom).trim();
          nextUp = m.up ? String(m.up).trim() : '';
        }
      }
    }
    if (!nextWid) {
      nextWid = widParent.get(curWid) || '';
      nextUp = widUp.get(curWid) || '';
    }
    curWid = nextWid;
    curUp = nextUp;
  }
  return '';
}

const packText = readFileSync(PACK, 'utf8');
const now = new Date().toISOString();
const meta = parseMeta(packText) || {};
/* 11-16：自动进图必须认架构，不许把 obs6.5/modeBias 包默认塞进 fam23（v7 蒸馏）。
 *   11-17：统一单包不再做收容所；V3 与 MX1-8 分代归族。族标签是稳定键，按标签找已存在的族号，找不到才开新号。 */
function packDims(txt) {
  const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\});/.exec(txt);
  if (!m) return null;
  try { const o = JSON.parse(m[1]); return o && o.dims ? o.dims : null; } catch { return null; }
}
const PACK_DIMS = packDims(packText) || {};
/* 11-17：按 id 前缀与观测面分代归族；仅 obs6 包允许进 obs6/obs6.5 家族，防 obs3b/obs5 混入。 */
function autoFamLabel(id, dims, m) {
  if (dims.input === 'obs6') {
    if (/^OBS6-SHAPEDIST-V3|^OBS6B2/.test(id)) return '2.0 obs6 V3 融合/路由（11-16）';
    if (/^(OBS6-UNIFIED-|EQ-|BASE-)/.test(id)) return '2.0 obs6.5 统一单包（11-16）';
    if ((m && (m.tool === 'pg-train' || (m.games && !m.teacher))) || /-(pg|kl|klcand|kw\d+|s\d+k)$/i.test(id)) {
      return '2.0 obs6.5 PG / KL 强化续训';
    }
    if (/^(MX[1-8]-|RING|TZ|R-GD|AR-TK|nov2\d-(?:armor|rod|c4|tzt2d))/.test(id) || (m && (m.rareOnly || m.teacher2keys))) {
      return '2.0 obs6.5 键道/覆盖与协同蒸馏';
    }
    if (/^(night2-|nov2\d-.*dsp0)/.test(id) || dims.modeBias === 1) {
      return '2.0 obs6.5 DS-P0 强锚补盲与融合重馏';
    }
  }
  return '';
}
const AUTO_FAM_LABEL = autoFamLabel(ID, PACK_DIMS, meta);
function famRows() {
  /* 11-17 家族号单源化：唯一真源是 `data/registry.tsv`（sidecar 的 fam/famLabel 两列已删）。
   *   lineage.tsv 一并扫只为本它的 1.8 老行兜底（它是 registry+sidecar 的生成物，正常两处一致）。 */
  const out = [];
  { const fi = reg.ix.fam, li = reg.ix.fam_label, ii = reg.ix.pack_id;
    if (fi === undefined || li === undefined || ii === undefined) { console.error('⛔ registry 缺 fam/fam_label/pack_id 列'); process.exit(2); }
    for (const r of reg.rows) if (r[fi] && r[li]) out.push({ fam: String(r[fi]), label: String(r[li]), id: String(r[ii]) }); }
  { const fi = linMain.ix.fam, li = linMain.ix.famLabel, ii = linMain.ix.id;
    if (fi !== undefined && li !== undefined) for (const r of linMain.rows) if (r[fi] && r[li]) out.push({ fam: String(r[fi]), label: String(r[li]), id: String(r[ii]) }); }
  return out;
}
function findFamByLabel(label) { return famRows().find((x) => x.label === label) || null; }
function findFamByNum(fam) { return famRows().find((x) => x.fam === String(fam)) || null; }
const linMain = readTable(join(DATA, 'page/lineage.tsv'));
const rootDir = resolve(DATA, '../..');
const normRel = (p) => {
  const s = String(p || '').trim().replace(/\\/g, '/');
  if (!s) return '';
  const r = isAbsolute(s) ? relative(rootDir, s).replace(/\\/g, '/') : s;
  return r.replace(/^\.\//, '');
};
const wid2id = new Map();
const id2wid = new Map();
for (const t of [linMain]) {
  const iw = t.ix.wid, ii = t.ix.id;
  if (iw === undefined) continue;
  for (const r of t.rows) {
    if (r[iw] && r[ii]) {
      if (!wid2id.has(r[iw])) wid2id.set(r[iw], r[ii]);
      if (!id2wid.has(r[ii])) id2wid.set(r[ii], r[iw]);
    }
  }
}
for (const r of reg.rows) {
  const iw = reg.ix.wid, ii = reg.ix.pack_id;
  if (iw === undefined) continue;
  if (r[iw] && r[ii]) {
    if (!wid2id.has(r[iw])) wid2id.set(r[iw], r[ii]);
    if (!id2wid.has(r[ii])) id2wid.set(r[ii], r[iw]);
  }
}
const rel2id = new Map();
const base2id = new Map();
for (const r of reg.rows) {
  const id = r[reg.ix.pack_id], p = normRel(r[reg.ix.path]);
  if (id && p) {
    if (!rel2id.has(p)) rel2id.set(p, id);
    const b = basename(p).replace(/\.(bak|js)$/, '');
    if (b && !base2id.has(b)) base2id.set(b, id);
  }
}
let FAM_MAX = 0;
for (const [t, fk] of [[reg, 'fam'], [linMain, 'fam']]) { const fi = t.ix[fk]; if (fi === undefined) continue;
  for (const r of t.rows) { const n = Number(r[fi]); if (Number.isFinite(n) && n > FAM_MAX) FAM_MAX = n; } }
if (!FAM) {
  if (AUTO_FAM_LABEL) {
    const hit = findFamByLabel(AUTO_FAM_LABEL);
    if (hit) { FAM = hit.fam; FAMLAB = AUTO_FAM_LABEL; }
    else { FAM = String(FAM_MAX + 1); FAMLAB = AUTO_FAM_LABEL; }
    console.log('自动家族：' + ID + ' ⇒ ' + FAM + ' / ' + FAMLAB);
  } else if (FAMLAB) {
    const hit = findFamByLabel(FAMLAB);
    if (!hit) { console.error('⛔ --fam-label=' + FAMLAB + ' 未在册；请显式传 --fam=<id>'); process.exit(2); }
    FAM = hit.fam;
  } else {
    console.error('⛔ 无法自动归类家族，请显式传 --fam=<id> --fam-label=<label>');
    process.exit(2);
  }
} else {
  const ex = findFamByNum(FAM);
  if (ex) {
    if (FAMLAB && ex.label !== FAMLAB) {
      console.error('⛔ --fam=' + FAM + ' 在册标签为「' + ex.label + '」，与传入 --fam-label=「' + FAMLAB + '」冲突'); process.exit(2);
    }
    FAMLAB = ex.label;
  } else if (!FAMLAB) {
    if (AUTO_FAM_LABEL) FAMLAB = AUTO_FAM_LABEL;
    else { console.error('⛔ --fam=' + FAM + ' 未在册且未传 --fam-label=<label>；拒绝静默新建'); process.exit(2); }
  }
}
if (VER === '2.0' && PACK_DIMS.input) {
  const fn = Number(FAM);
  if (PACK_DIMS.input === 'obs6' && fn > 0 && fn < 21) {
    console.error('⛔ 观测架构校验失败：obs6 包 ' + ID + ' 不许放进非 obs6 家族 FAM' + FAM + '（' + FAMLAB + '）');
    process.exit(2);
  }
  if (PACK_DIMS.input !== 'obs6' && (fn >= 21 || /obs6/i.test(FAMLAB))) {
    console.error('⛔ 观测架构校验失败：' + PACK_DIMS.input + ' 包 ' + ID + ' 不许放进 obs6 家族 FAM' + FAM + '（' + FAMLAB + '）');
    process.exit(2);
  }
}
/* 11-15 深夜（ZCode）：lineage 列**不再收族名**——11-07 裁定"血统列不再兼记产物来源"，但这里的缺省把
 *   FAMLAB 写进 lineage ⇒ 11-12/11-14 的进图全部带族名入列，页面 keep 式 `!!d.lin` 钉住把 19 枚 2.0 新点
 *   漏进「1.8 及以前」旧图（用户令"老版本图应冻结"）。族名只住 fam_label（registry 第 5 列）与
 *   registry 的血统列；lineage 列只收显式 --lineage= 的真血统声明，缺省留空。 */
if (LINEAGE === 'new') LINEAGE = '';
const parentWid = String(meta.hotstartFrom || '').trim();
const startUp = normRel(meta.up || (meta.recipe && meta.recipe.env && meta.recipe.env.EPIRUS_SEEDPACK) || '');
const dispIds = new Set(display.rows.map((r) => r[display.ix.id]));
const ancDirs = [dirname(PACK), join(rootDir, 'scratch/arms'), join(rootDir, 'docs/artifacts/obs6-coldstart')];
const widMatch = (a, b) => Boolean(a && b && (a === b || (a.length >= 12 && b.startsWith(a)) || (b.length >= 12 && a.startsWith(b))));
const resolveOnMap = (upPath, wid, targetId = '') => {
  const rel = normRel(upPath);
  const byRel = rel ? rel2id.get(rel) : '';
  if (byRel && dispIds.has(byRel) && (!targetId || byRel === targetId) && (!wid || !id2wid.get(byRel) || widMatch(id2wid.get(byRel), wid))) return byRel;
  const b = rel ? basename(rel).replace(/\.(bak|js)$/, '') : '';
  const byBase = b ? base2id.get(b) : '';
  if (byBase && dispIds.has(byBase) && (!targetId || byBase === targetId) && (!wid || !id2wid.get(byBase) || widMatch(id2wid.get(byBase), wid))) return byBase;
  if (targetId && dispIds.has(targetId) && wid && widMatch(id2wid.get(targetId), wid)) return targetId;
  const byWid = wid ? wid2id.get(wid) : '';
  if (byWid && dispIds.has(byWid) && (!targetId || byWid === targetId)) return byWid;
  return '';
};
let parentId = '', parentSrc = 'root';
if (PARENT_ARG) {
  if (!dispIds.has(PARENT_ARG)) { console.error('⛔ --parent 指向不在图上的节点：' + PARENT_ARG); process.exit(2); }
  parentId = PARENT_ARG;
  const directOk = Boolean(parentWid && resolveOnMap(startUp, parentWid, PARENT_ARG) === PARENT_ARG);
  const chainOk = !directOk && Boolean(parentWid && findAncestorOnMap(parentWid, startUp, ancDirs, resolveOnMap, rootDir, PARENT_ARG) === PARENT_ARG);
  parentSrc = (directOk || chainOk) ? 'seedpack-wid' : 'seedpack';
} else if (parentWid) {
  const direct = resolveOnMap(startUp, parentWid);
  if (direct && dispIds.has(direct)) { parentId = direct; parentSrc = 'seedpack-wid'; }
  else {
    const anc = findAncestorOnMap(parentWid, startUp, ancDirs, resolveOnMap, rootDir);
    if (anc) { parentId = anc; parentSrc = 'seedpack-wid'; }
    else parentSrc = 'unknown-wid';
  }
}
const metaSeed = String((meta.recipe && meta.recipe.seed) || meta.seed || 'unknown');
const pointWid = widOf(packText);
const lrow = { id: ID, fam: FAM, famLabel: FAMLAB, ts: String(meta.ts || statSync(PACK).mtime.toISOString()), metaSeed, nameSeed: '',
  parent: parentId, parentOf: parentId, parentName: parentId, wid: pointWid, parentSrc, tsSrc: 'product' };
const ltab = linMain;
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
/* C 列不是独立测量：C<n>R=(P<n>+P<n>R)/2，C<n>RL=(P<n>L+P<n>RL)/2。
 *   C 轴就是 A/B 平均 ⇒ 自动进图时**直接合成**这 8 列（不是静默 fallback）：
 *   - 两侧齐：缺则写平均值，已写则逐位校验（不一致报错，绝不覆盖已有错值）；
 *   - 单侧缺：C 留空 = 未测（不许单侧冒充综合；若已有 C 则报错）；
 *   - C 列本身不在 display 表头：报错，不许悄悄跳过。 */
function fillDisplayC(row, id) {
  const val = (c) => row[display.ix[c]];
  const has = (c) => display.ix[c] !== undefined && val(c) !== undefined && val(c) !== '';
  const filled = [], oneSided = [];
  for (const n of [2, 3, 5, 8]) {
    const pairs = [
      ['P' + n, 'P' + n + 'R', 'C' + n + 'R', 'short'],
      ['P' + n + 'L', 'P' + n + 'RL', 'C' + n + 'RL', 'long'],
    ];
    for (const [a, b, c, hz] of pairs) {
      if (display.ix[c] === undefined) { console.error('⛔ display 表头缺 C 列 ' + c + '（自动进图不能跳过 C 合成）'); process.exit(2); }
      const aok = has(a), bok = has(b), cok = has(c);
      if (aok && bok) {
        const want = String((+val(a) + +val(b)) / 2);
        if (!cok) { row[display.ix[c]] = want; filled.push(c); }
        else if (Math.abs(+want - +val(c)) > 1e-9) {
          console.error('⛔ ' + id + ' ' + c + '=' + val(c) + ' ≠ (' + a + '+' + b + ')/2=' + want + '（' + hz + '）；拒绝覆盖已有 C'); process.exit(2);
        }
      } else if (cok) {
        console.error('⛔ ' + id + ' 有 ' + c + ' 但 ' + a + '/' + b + ' 单侧缺（单侧不许冒充综合）'); process.exit(2);
      } else if (aok !== bok) {
        oneSided.push(c);
      }
    }
  }
  if (filled.length) console.log('  C 自动合成（' + id + '）：' + filled.join(',') + ' = (P + P·R)/2');
  if (oneSided.length) console.log('  C 未合成（' + id + '）：单侧缺，留空=未测：' + oneSided.join(','));
}
let dispRow = null;
if (DISP) {
  const D = readTable(DISP);
  if (D.header.join('\t') !== display.header.join('\t')) { console.error('⛔ display 表头与 data/display.tsv 不一致'); process.exit(2); }
  if (D.rows.length !== 1) { console.error('⛔ display 必须恰好 1 行'); process.exit(2); }
  if (D.rows[0][D.ix.id] !== ID) { console.error('⛔ display.id=' + D.rows[0][D.ix.id] + ' ≠ --id=' + ID); process.exit(2); }
  dispRow = D.rows[0].slice();
  fillDisplayC(dispRow, ID);
  /* 新点不继承旧 H5/F/rank：H5 是冻结旧尺，F/rank 是旧尺出厂账，页面按 C·R 重算。 */
  for (const c of ['H5', 'Hp5', 'Hlong5', 'Hplong5', 'Flong5', 'F', 'rank']) if (display.ix[c] !== undefined) dispRow[display.ix[c]] = '';
}
const sha = createHash('sha256').update(readFileSync(PACK)).digest('hex');
const relPack = relative(resolve(DATA, '../..'), PACK).replace(/\\/g, '/');
/* registry 16 列训练配置（d78ef34f 契约，列序与 lineage.tsv c12-27 同构）：1.8 从 lineage.tsv 同名/wid 行回填
 *   （单一来源=lineage，与白班批量回填同法）；2.0/G3 留空——在册 83 枚 2.0 行全空，META 配置提取未接 2.0。 */
const REG_CFG_COLS = ['divW', 'divK', 'divRoleW', 'divCatW', 'oppsN', 'stockBonus', 'hoardPen', 'dealW', 'firstW', 'whistlePen', 'styleW', 'eTarget', 'eCap', 'gens', 'mode', 'seedEmb'];
let regCfg = new Array(REG_CFG_COLS.length).fill('');
if (VER !== '2.0') {
  const linSelf = linMain.rows.find((r) => r[linMain.ix.id] === ID || (pointWid && r[linMain.ix.wid] === pointWid));
  if (linSelf) regCfg = REG_CFG_COLS.map((c) => linMain.ix[c] !== undefined ? String(linSelf[linMain.ix[c]] ?? '') : '');
}
/* registry 2026-11-23 起承接 2.0 血统列；lineage-g3 退役。 */
const REG_LIN_COLS = ['wid', 'metaSeed', 'nameSeed', 'parent', 'parentOf', 'parentName', 'parentSrc', 'tsSrc',
  'parentOf2', 'parentName2', 'parentSrc2', 'parentOf3', 'parentName3', 'parentSrc3'];
const regLin = REG_LIN_COLS.map((k) => VER === '2.0' ? String(lrow[k] ?? '') : '');
const newReg = [ID, relPack, VER, FAM, FAMLAB, LINEAGE, now, sha, 'active'].concat(regCfg, regLin);
const bid = BATCH || ('add-' + ID + '-' + now.slice(0, 10).replace(/-/g, ''));
const newBatch = [bid, rd.rows.length ? rd.rows[0][rd.ix.ruler_id] : 'a-v2-page-1109', 'A', FIXTURE, '-', bid, basename(RD), String(RT.rows.length), now, 'add-point'];
console.log('add-point: ' + ID + ' ‖ pack ' + basename(PACK) + ' ‖ readings ' + newReadings.length + ' ‖ display ' + (dispRow ? '有' : '无') + ' ‖ batch ' + bid);
if (dispRow && display.ix.lineage !== undefined && (!dispRow[display.ix.lineage] || dispRow[display.ix.lineage] === 'new')) dispRow[display.ix.lineage] = LINEAGE;
if (DRY) { console.log('--dry：未写文件'); process.exit(0); }
if (ltab && !ltab.rows.some((r) => r[ltab.ix.id] === ID)) {
  const row = new Array(ltab.header.length).fill('');
  for (const [k, v] of Object.entries(lrow)) if (ltab.ix[k] !== undefined) row[ltab.ix[k]] = v;
  writeTable(join(DATA, 'page/lineage.tsv'), { header: ltab.header, rows: ltab.rows.concat([row]), backup: false });
}

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
/* 过线：新点从 display 的 okLong/okShort 建一行 feasibility（混合桌 ok 暂空；绿环读纯桌 ok）。 */
if (dispRow) {
  const ft = readTable(join(DATA, 'feasibility.tsv'));
  const row = [ID, '', '', G2_ARG, '', display.ix.okLong !== undefined ? dispRow[display.ix.okLong] : '',
    display.ix.failsLong !== undefined ? dispRow[display.ix.failsLong] : '',
    display.ix.okShort !== undefined ? dispRow[display.ix.okShort] : '',
    display.ix.failsShort !== undefined ? dispRow[display.ix.failsShort] : '', 'add-point'];
  wt('feasibility.tsv', ft, ft.rows.concat([row]));
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
  if (DATA === resolve(DATA, '..', 'data') && resolve(DATA, '..') === resolve(fileURLToPath(import.meta.url), '..', '..')) {
    execFileSync('node', [resolve(DATA, '..', '..', 'tools/sync-page-coords.mjs')], { cwd: resolve(DATA, '..', '..'), encoding: 'utf8', maxBuffer: 1 << 26 });
  }
  if (BAKE) {
    const out = execFileSync('node', [join(DATA, '..', 'rebuild-map.mjs'), '--data=' + DATA], { cwd: resolve(DATA, '..', '..'), encoding: 'utf8', maxBuffer: 1 << 26 });
    console.log(out.trim().split('\n').slice(-4).join('\n'));
  }
} catch (e) {
  console.error('⛔ add-point 写入后构建失败：' + e.message);
  process.exit(2);
}
console.log('✅ add-point 完成：' + ID);
