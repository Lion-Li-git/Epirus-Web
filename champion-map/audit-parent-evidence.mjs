/* audit-parent-evidence.mjs —— **路径级实线的证据链审计**（只读；用户 10-12 问「这些点到底是什么情况」）
 *
 * 为什么要有这台：`lineage.mjs` 把父边分了几级，而"哪几级算实线"这件事**只能靠证据链说话**。
 * 用户 10-12 盯着图问：E51 同族那些**原本虚线**的点，怎么变成实线了？—— 这台尺就是把每一条
 * "路径级实线"的证据逐枚摆出来，谁都能复算，不靠提交信息里的形容词。
 *
 * 对每一条核**三件事**（缺一不可；注意**不同级别第三件事不一样** —— 第一版把"段 wid"套到
 * `seedpack-wid` 上，结果误报 151 条：那一级的父是**子包点名的那一枚**，不必是当时的槽主）：
 *   ① `recipe.env.EPIRUS_HOTSTART === '1'` —— **热启动的开关**（`tools/train-3p.mjs:1050`）。
 *      ⚠ 这一条不能省：`EFFECTIVE_ENV`（同文件 `:170`）记的是"工具**读到过**且环境里存在的键"，
 *      所以**光有 `EPIRUS_SEEDPACK` 不等于真的热启动了** —— 冷启动 + 环境里恰好有这个变量，
 *      同样会把它写进 meta。没有①的边是假边（这条尺就是为它做的）。
 *   ② `EPIRUS_SEEDPACK` 存在（这一级的父就是由它来的）。
 *   ③ **身份核对**（按级别）：
 *      · `slot-wid`  —— 子包自己记的种子是**活槽路径** ∧ 子包 `ts` 落在 `slot-timeline.tsv` 的那一段的
 *        `wid` == 父节点在册 `wid`（两份表互核："这份路径在当时指的是这一枚"）。
 *      · `seedpack-wid` —— 那份路径**今天**指向的文件的权重指纹 == 父节点在册 `wid`（§E555 那把尺；
 *        读不到文件时按登记表 `pack-aliases.tsv` / `dupes-manifest.tsv` 解，与 `lineage.mjs` 同一口径）。
 *      · `slot-infer` —— 无记录路径时，子包 `ts` 那一段的 `wid` == 父节点在册 `wid`（同一把尺的弱版）。
 *
 * 用法：node champion-map/audit-parent-evidence.mjs [级别，默认 slot-wid]
 * 口径：只读（不写任何表、不碰包）；一条不合格就 `exit 1` 并把那条点名。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { widOf } from './wid.mjs';   /* 与 lineage.mjs / ship-scan.mjs 同一台指纹（不做第二份实现） */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const SLOT_REL = 'js/bundled-champion-3p.js';
const LVL = (process.argv[2] || 'slot-wid').trim();

const lin = rd(join(HERE, 'lineage.tsv')).trim().split('\n');
const H = lin[0].split('\t');
const iId = H.indexOf('id'), iTs = H.indexOf('ts'), iPsrc = H.indexOf('parentSrc'),
  iPof = H.indexOf('parentOf'), iName = H.indexOf('parentName'), iWid = H.indexOf('wid');
const ROWS = lin.slice(1).map(l => l.split('\t'));
const WIDOF = {}; for (const r of ROWS) WIDOF[r[iId]] = r[iWid];

/* 找包：**先按 `coords.tsv` 的 `path` 列**（与 `lineage.mjs` 同一个真源 —— 名字≠文件名的那几枚
 * 只有它认得，实测 `T8-s120` 的真包叫 `docs/artifacts/e521-out/T-s120.js`），再退到臂表与文件名。 */
const PATHOF = {};
{ const f = join(HERE, 'coords.tsv');
  if (existsSync(f)) { const L = rd(f).trim().split('\n'), ch = L[0].split('\t');
    const iI = ch.indexOf('id'), iP = ch.indexOf('path');
    for (const l of L.slice(1)) { const c = l.split('\t'); if (iI >= 0 && iP >= 0 && c[iI] && c[iP]) PATHOF[c[iI]] = c[iP]; } } }
const AP = {};
{ const f = join(HERE, '_e330-armparent.tsv');
  if (existsSync(f)) { const A = rd(f).trim().split('\n'), ah = A[0].split('\t');
    const ia = ah.indexOf('arm'), ir = ah.indexOf('productRel');
    for (const l of A.slice(1)) { const c = l.split('\t'); if (ia >= 0 && ir >= 0 && c[ia] && c[ir]) AP[c[ia]] = c[ir]; } } }
const BYBASE = {};
(function walk(dir, depth) { let e; try { e = readdirSync(dir, { withFileTypes: true }); } catch (x) { return; }
  for (const en of e) { const p = join(dir, en.name);
    if (en.isDirectory()) { if (depth < 2) walk(p, depth + 1); continue; }
    if (!/\.(js|bak)$/.test(en.name)) continue;
    const b = en.name.replace(/\.(js|bak)$/, '');
    if (!BYBASE[b]) BYBASE[b] = p; const t = b.replace(/^.*__/, ''); if (!BYBASE[t]) BYBASE[t] = p; } })(join(ROOT, 'docs', 'artifacts'), 0);
function findPkg(id) { const c = [PATHOF[id], AP[id], BYBASE[id], 'docs/artifacts/' + id + '.js', 'docs/artifacts/' + id + '.bak'].filter(Boolean);
  for (const x of c) { const p = String(x).startsWith('docs/') ? join(ROOT, x) : x; if (existsSync(p)) return p; } return null; }
function metaOf(p) { const txt = rd(p); const mi = txt.indexOf('EPIRUS_CHAMPION_3P_META');
  const seg = mi >= 0 ? txt.slice(mi, mi + 12000) : txt;
  const g = re => { const m = re.exec(seg); return m ? m[1] : '(键不存在)'; };
  return { ts: g(/"ts"\s*:\s*"([^"]+)"/), hot: g(/"EPIRUS_HOTSTART"\s*:\s*"([^"]*)"/),
    sp: g(/"EPIRUS_SEEDPACK"\s*:\s*"([^"]*)"/) }; }

/* 完整时间轴（槽文件侧） */
const tl = rd(join(HERE, 'slot-timeline.tsv')).trim().split('\n'), th = tl[0].split('\t');
const iU = th.indexOf('fromUTC'), iW = th.indexOf('wid'), iP = th.indexOf('panelId');
const SEG = tl.slice(1).map(l => { const c = l.split('\t'); return { t: Date.parse(c[iU]), wid: (c[iW] || '').trim(), pid: (c[iP] || '').trim() }; })
  .filter(s => isFinite(s.t)).sort((a, b) => a.t - b.t);
function eraAt(ts) { const t = Date.parse(ts); if (!isFinite(t)) return null; let hit = null;
  for (const s of SEG) { if (s.t <= t) hit = s; else break; } return hit; }

/* 登记表（被去重搬走的父）：与 `lineage.mjs` 的 ALIAS 同一口径 */
const ALIAS = (function () { const m = {};
  for (const spec of [['pack-aliases.tsv', 'wantedPath'], ['dupes-manifest.tsv', 'path']]) {
    const f = join(HERE, spec[0]); if (!existsSync(f)) continue;
    const L = rd(f).trim().split('\n'), hh = L[0].split('\t');
    const iK = hh.indexOf(spec[1]), iW = hh.indexOf('wid'); if (iK < 0 || iW < 0) continue;
    for (const l of L.slice(1)) { const c = l.split('\t'); if (c[iK] && c[iW] && !m[c[iK]]) m[c[iK]] = c[iW]; } }
  return m; })();
function widOfRecordedPath(rel) {   /* 那份路径指的是哪一粒（文件内容优先；读不到按登记表） */
  if (!rel) return '';
  /* ⚠ 归一化必须先做：实测 100 枚的 meta 写的是**绝对路径**（`D:/code/Epirus-Web/docs/artifacts/eval-out/win-Ldemo.bak`）
   *   —— 与 `lineage.mjs` 的 `seedCandidates` 同一口径：落在仓根内的绝对路径折成仓内相对形式再当候选。 */
  let r2 = String(rel).replace(/\\/g, '/');
  const rootN = ROOT.replace(/\\/g, '/');
  if (r2.toLowerCase().indexOf(rootN.toLowerCase() + '/') === 0) r2 = r2.slice(rootN.length + 1);
  const base = r2.replace(/^.*[\\/]/, '');
  const cands = [r2, 'docs/artifacts/kept/' + base,
    /^docs\//.test(r2) ? 'docs/artifacts/kept/' + r2.replace(/^docs\//, '').replace(/\//g, '__') : '',
    'docs/artifacts/kept/' + r2.replace(/^docs\/artifacts\//, '').replace(/\//g, '__')].filter(Boolean);
  for (const c of cands) { const p = join(ROOT, c); if (!existsSync(p)) continue;
    try { const w = widOf(rd(p)); if (w) return w; } catch (e) { /* 换下一个候选 */ } }
  return ALIAS[r2] || ''; }

const sel = ROWS.filter(r => r[iPsrc] === LVL);
if (!sel.length) { console.error('⛔ lineage.tsv 里没有 `' + LVL + '` 这一级（先跑 node champion-map/lineage.mjs）'); process.exit(2); }
let ok = 0; const bad = [];
for (const r of sel) {
  const id = r[iId], p = findPkg(id);
  if (!p) { bad.push(id + '（读不到包）'); continue; }
  const m = metaOf(p), e = eraAt(r[iTs]), wNode = WIDOF[r[iPof]] || '';
  const why = [];
  if (m.hot !== '1') why.push('EPIRUS_HOTSTART=' + m.hot + '（**没有热启动证据** ⇒ 这条边是假的）');
  if (LVL === 'slot-wid') {
    if (m.sp !== SLOT_REL) why.push('SEEDPACK=' + m.sp + '（不是活槽路径）');
    if (!e) why.push('ts 落不进任何时间轴段');
    else if (e.wid !== wNode) why.push('段wid ' + e.wid.slice(0, 8) + ' ≠ 父节点wid ' + wNode.slice(0, 8));
  } else if (LVL === 'seedpack-wid') {
    if (m.sp === '(键不存在)' || !m.sp) why.push('meta 里没有 EPIRUS_SEEDPACK（这一级的父就是由它来的）');
    else {
      const wFile = widOfRecordedPath(m.sp);
      if (!wFile) why.push('那份路径解不出权重（' + m.sp + '）');
      else if (wFile !== wNode) why.push('路径指向的权重 ' + wFile.slice(0, 8) + ' ≠ 父节点wid ' + wNode.slice(0, 8));
    }
  } else if (LVL === 'slot-infer') {
    /* 这一级**按定义就没有记录路径**（或记的正是活槽路径）⇒ 不许要求它存在 */
    if (m.sp !== '(键不存在)' && m.sp !== SLOT_REL) why.push('这一级要求"没记路径 / 记的是活槽路径"，实记 ' + m.sp);
    if (!e) why.push('ts 落不进任何时间轴段');
    else if (e.wid !== wNode) why.push('段wid ' + e.wid.slice(0, 8) + ' ≠ 父节点wid ' + wNode.slice(0, 8));
  }
  if (why.length) bad.push(id + '：' + why.join('；')); else ok++;
}
console.log('级别 `' + LVL + '`：' + sel.length + ' 条 ‖ 证据齐全 ' + ok
  + ' ‖ 有问题的 ' + bad.length);
for (const b of bad.slice(0, 20)) console.log('  ⛔ ' + b);
if (bad.length) { console.error('\n⛔ 有 ' + bad.length + ' 条证据不齐 ⇒ 不许当实线（点名在上面）'); process.exit(1); }
console.log('✔ 每条都同时有：热启动开关 `EPIRUS_HOTSTART=1`'
  + (LVL === 'slot-wid' ? ' ∧ 子包自己记的 `EPIRUS_SEEDPACK` = 活槽路径' : '')
  + ' ∧ 子包 ts 那一段的 wid == 父节点在册 wid');
