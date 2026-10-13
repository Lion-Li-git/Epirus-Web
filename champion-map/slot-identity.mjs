/* slot-identity.mjs —— 「谁上过活槽」的**唯一解析处**（§E600-A · 用户 10-12 裁定③④）
 *
 * 病（用户原话）：「重点在于如今没有『当前现役』这个东西了，顶多只有当前困难席平均水平」
 *   ‖「你看一下怎么调整成实时更新而不是定死」。
 * 实测到的定死写法有两处，都是"换包之后不会响、只会静默把新权重记在旧名字下"：
 *   ① `ruler-measure.mjs:65` 把 `js/bundled-champion-3p.js` 登记成 `{id:'SHIPPED-Ldemo', lineage:'当前线上'}`
 *      —— 10-11 17:30 换包（`2f88f09` v1.6.62，槽里从此是 T8-s114）之后，任何一次 `--set=champ` 重跑
 *      都会**用 T8-s114 的权重出 SHIPPED-Ldemo 的读数**（S0 取证：图上那一列还没被污染，见
 *      `docs/research/logs/2026-10-12-incumbent-realtime-soup-qoder.md`，但雷还在）。
 *   ② `viewer.mjs` 里 12 处 `id === 'SHIPPED-Ldemo'` 的字面（★ / `cur` / `yInc` / `hidInc`）。
 * 而 `METHODOLOGY.md` 第 134 条早就写过同一句纪律：**活槽身份只能声明，不能按 path 猜**。
 * `eps-full.mjs:107-114` 在 §E597 已按这条拆过一次雷（加"没在册路径才造"的前提），这台把那条纪律落成
 * **一处可复用实现**，让量具侧、烘焙侧、门禁侧读同一份。
 *
 * 三个输入（都是现成的，不新增手工表）：
 *   · `slot-timeline.tsv` —— `slot-timeline.mjs` 从**槽文件那一侧**逐提交算权重指纹建出来的，覆盖全部段 ⇒ 换包自动多一段
 *   · `slot-history.tsv`  —— 换包那一笔必须加的**声明行**（那张表的头注自己写了这条规矩；表头前有 # 注释行）
 *   · `coords.tsv` + `lineage.tsv` —— 图上的行；**wid 在 `lineage.tsv` 第 10 列**（`coords.tsv` 没有 wid 列，实测踩过）
 *
 * 用法：
 *   node champion-map/slot-identity.mjs            # 印名单（人读）
 *   node champion-map/slot-identity.mjs --json     # 机器可读
 *   退出码：0 = 活槽解得出且落在图上的某一行 ‖ 2 = 解不出（**下次换包没同步就是这里红**）
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { widOf } from './wid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');
/** 认表头：跳过开头的 `#` 注释行（`slot-history.tsv` 头上有六行说明，第一版把它当表头 ⇒ 整列全空）*/
function rows(f) {
  if (!existsSync(f)) return [];
  const L = rd(f).split('\n');
  let h0 = 0; while (h0 < L.length && L[h0].charAt(0) === '#') h0++;
  if (h0 >= L.length) return [];
  const h = L[h0].split('\t'), out = [];
  for (let i = h0 + 1; i < L.length; i++) { const s = L[i];
    if (!s.trim().length || s.charAt(0) === '#') continue;
    const c = s.split('\t'), o = {}; h.forEach((k, j) => o[k] = c[j] === undefined ? '' : c[j]); out.push(o); }
  return out;
}

/** 从提交标题里认版本号（**只有这一份**；`viewer.mjs` 原来自己抄了一份手扫版）。
 *  不用正则：模板转义那台自证会连累别处（§E463 原话），且 \d 在模板里要转义。 */
export function verOf(sub) { const t = String(sub || '');
  for (let k = 0; k + 4 < t.length; k++) { if (t.charAt(k) !== 'v') continue;
    let e = k + 1, dig = 0, dot = 0; const SET = '0123456789.';
    while (e < t.length && SET.indexOf(t.charAt(e)) >= 0) { if (t.charAt(e) === '.') dot++; else dig++; e++; }
    if (dig >= 2 && dot >= 1) return t.slice(k, e); }
  return ''; }

export function load(root) {
  const R = root || ROOT;
  const CM = f => join(R, 'champion-map', f);

  /* ---- 图上的行 + 同权重组（`dupOf` 存的是**空格隔开的组内 id**，代表取第一个）---- */
  const CO = rows(CM('coords.tsv'));
  const ROW = {}, GROUP = {};
  for (const r of CO) { if (!r.id) continue; ROW[r.id] = r;
    const g = String(r.dupOf || '').trim().split(/\s+/).filter(Boolean);
    if (g.length) GROUP[r.id] = g; }
  const canon = id => { const g = GROUP[id]; return (g && g.length) ? g[0] : id; };

  /* ---- wid 只住在 `lineage.tsv`（第 10 列）⇒ 用它做"同一份权重"那一跳 ---- */
  const WIDOF = {}, ID_OF_WID = {};
  for (const l of rows(CM('lineage.tsv'))) { if (!l.id || !l.wid) continue;
    WIDOF[l.id] = l.wid; const c = canon(l.id); if (c && !ID_OF_WID[l.wid]) ID_OF_WID[l.wid] = c; }

  /* ---- 时间轴：每一段 = 槽文件里某份权重住过的那段时间 ---- */
  const segs = [];
  for (const t of rows(CM('slot-timeline.tsv'))) { if (!t.wid) continue;
    let cid = null, via = 'unresolved';
    if (t.panelId && ROW[t.panelId]) { cid = canon(t.panelId); via = 'panelId'; }
    if (!cid) { const guess = 'SLOT-' + String(t.wid).slice(0, 8);          /* 面板上没名字的段 ⇒ 图上的合成行名 */
      if (ROW[guess]) { cid = guess; via = 'wid8'; } }
    if (!cid && t.metaArm && ROW[t.metaArm]) { cid = canon(t.metaArm); via = 'metaArm'; }
    if (!cid && ID_OF_WID[t.wid]) { cid = ID_OF_WID[t.wid]; via = 'wid'; }
    segs.push({ wid: t.wid, from: t.fromUTC || '', sha: t.sha || '', ver: verOf(t.subject || ''),
      panelId: t.panelId || '', metaArm: t.metaArm || '', coordsId: cid, via: via, metaTs: t.metaTs || '' });
  }

  /* ---- 首次上槽 = 最早那一段（§E378：同一枚回槽多次，"上线"这件事的第一次才是它）---- */
  const byId = {};
  for (const s of segs) { if (!s.coordsId) continue;
    /* 第一版这里写的是 `if (s.from && (!b.first || s.from < b.first))` ⇒ **首段永远进不了这个分支**
     *   （b.first 初始化就是它自己），结果 `ver` 全空、版本号一条都没认回来。改成显式记"还没有首段"。 */
    const b = byId[s.coordsId] || (byId[s.coordsId] = { id: s.coordsId, first: '', last: '', wids: [], segs: 0, ver: '', sha: '', via: s.via });
    if (!b.first || (s.from && s.from < b.first)) { b.first = s.from; b.ver = s.ver; b.sha = s.sha; b.via = s.via; }
    if (s.from && s.from > b.last) b.last = s.from;
    if (s.wid && b.wids.indexOf(s.wid) < 0) b.wids.push(s.wid);
    b.segs++; }

  /* ---- 声明表（换包必须加一行）---- */
  const decl = rows(CM('slot-history.tsv')).filter(h => h.coordsId)
    .sort((a, b) => String(a.sinceLocal) < String(b.sinceLocal) ? -1 : 1);
  const lastDecl = decl.length ? decl[decl.length - 1] : null;
  const declId = lastDecl ? (ROW[lastDecl.coordsId] ? canon(lastDecl.coordsId) : null) : null;

  /* ---- 活槽现主：wid 现算 → ① 图上同权重的行（最硬）② 声明末行 ③ 时间轴最后一段 ---- */
  const SLOT = join(R, 'js/bundled-champion-3p.js');
  const liveWid = existsSync(SLOT) ? widOf(rd(SLOT)) : null;
  const byWidRow = liveWid ? (ID_OF_WID[liveWid] || null) : null;
  const lastSeg = segs.length ? segs[segs.length - 1] : null;
  const live = {
    wid: liveWid, byWidRow: byWidRow, declared: declId, declaredRaw: lastDecl ? lastDecl.coordsId : null,
    commit: lastDecl ? (lastDecl.commit || '') : '', since: lastDecl ? (lastDecl.sinceLocal || '') : '',
    lastSegId: lastSeg ? lastSeg.coordsId : null,
    coordsId: byWidRow || declId || (lastSeg && lastSeg.coordsId) || null,
    conflict: !!(byWidRow && declId && byWidRow !== declId),
    ok: !!(liveWid && (byWidRow || declId))
  };

  return { coordsCount: Object.keys(ROW).length, hasCoords: CO.length > 0,
    segs, byId, onSlot: Object.keys(byId), decl, live, ROW, GROUP,
    isOnSlot: id => !!byId[canon(id)], classOf: id => (byId[canon(id)] ? '历代上槽' : ''),
    canon: canon, widOfId: id => WIDOF[id] || '', verOf: verOf };
}

/* ===== CLI ===== */
if (process.argv[1] && /slot-identity\.mjs$/.test(process.argv[1])) {
  const g = load(), L = g.live;
  const bad = g.segs.filter(s => !s.coordsId);
  console.log('coords 行 ' + g.coordsCount + ' ‖ 时间轴段 ' + g.segs.length + ' ‖ 解到行 ' + g.onSlot.length + ' 枚 ‖ 声明 ' + g.decl.length + ' 行');
  if (bad.length) console.log('⚠ 解不出图上行名的段 ' + bad.length + ' 个：' + bad.map(s => String(s.wid).slice(0, 8) + '@' + String(s.from).slice(0, 10)).join(' ‖ '));
  const withVer = g.onSlot.filter(id => g.byId[id].ver);
  console.log('按声明/面板认到的：' + g.onSlot.length + ' 枚（带版本号 ' + withVer.length + ' ‖ 走 panelId ' +
    g.onSlot.filter(id => g.byId[id].via === 'panelId').length + ' ‖ 走 wid8 合成行 ' + g.onSlot.filter(id => g.byId[id].via === 'wid8').length + '）');
  console.log('活槽 wid = ' + (L.wid || '取不到') + ' ⇒ 图上同权重的行 = ' + (L.byWidRow || '无') +
    ' ‖ 声明末行 = ' + (L.declaredRaw || '无') + (L.commit ? '（' + L.commit + '）' : '') + ' ‖ 时间轴末段 = ' + (L.lastSegId || '无'));
  console.log('⇒ 活槽现主认作 **' + (L.coordsId || '⛔ 认不出') + '**' +
    (L.conflict ? ' ‖ ⚠ 与声明不一致（同权重行 ' + L.byWidRow + ' vs 声明 ' + L.declaredRaw + '）' : ''));
  if (process.argv.includes('--json')) console.log(JSON.stringify({ live: L, onSlot: g.onSlot, byId: g.byId }));
  if (!L.ok) { console.log('⛔ 活槽解不到图上任何一行 ⇒ 换包那一笔没同步（补 `slot-history.tsv` 一行并重跑 `slot-timeline.mjs`）'); process.exit(2); }
}
