/* pack-resolve.mjs —— "探针打印的路径 → 图上的那一行" 这一跳的**唯一实现**（§E589 · 千问 10-11）
 *
 * 为什么要有这一份（病是 §E588 自己暴露的）：那次把 `SHIPPED-Ldemo` 行的 path 从"活槽文件"改成"钉住的快照"，
 *   于是 `coords.tsv` 里**再没有任何一行的 path 等于 `js/bundled-champion-3p.js`** ⇒
 *   三把按 path 反查身份的尺（`seatassoc` ‖ `holefeatures` ‖ `vetoline`）一起丢锚点，
 *   `seatassoc` 直接报「⛔ (a) 红：这一批里没有现役 ⇒ 没锚点，判读作废」。
 *   而**活槽必须有一个身份**——只是它不能按路径认（路径会被下一次换包悄悄改掉，这正是 §E588 修的那件事），
 *   要按**权重**认：拿活槽的 `widOf` 去图上找同一粒权重的那一行。
 *
 * 三条规矩：
 *   ① **id 优先**：座表里的 id 本身就在 `coords.tsv` 里就直接用它（去重之后"一个文件被多行共享"是常态：986 行 → 794 个文件，
 *      按 path 反查会撞名 ⇒ 拿别人的读数当自己的，就是 §E330 那一族"凭空造身份"）；
 *   ② path 反查只当兜底，且**撞上共享文件要点名**（`sharedPaths`）；
 *   ③ 活槽那一支按 wid 认，认不出来就**响亮说"图上没有这一粒权重"**，不许悄悄拿最近的名字顶上。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { widOf } from './pack-id.mjs';

/** 一行的 path 是否可读且与给定 wid 同权重（读不到/解不出都算 false，不抛） */
function sameWeights(root, rel, wid) {
  if (!rel || !wid) return false;
  try { return widOf(readFileSync(join(root, rel), 'utf8')) === wid; } catch (e) { return false; }
}

/** 读 `champion-map/slot-history.tsv`（活槽住过谁）；缺文件返回 []，由调用方决定要不要红 */
export function slotHistory(root) {
  let t;
  try { t = readFileSync(join(root, 'champion-map', 'slot-history.tsv'), 'utf8').replace(/\r\n/g, '\n'); } catch (e) { return []; }
  const L = t.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
  if (L.length < 2) return [];
  const h = Object.fromEntries(L[0].split('\t').map((c, i) => [c, i]));
  return L.slice(1).map(l => { const c = l.split('\t'); return { since: c[h.sinceLocal], id: c[h.coordsId], commit: c[h.commit] || '' }; })
    .filter(e => e.since && e.id).sort((a, b) => String(a.since).localeCompare(String(b.since)));
}
/** 现役身份**按声明**认：拿表自己的日期（文件名里的 `YYYY-MM-DD`）落到 slot-history 的哪一条。
 *  ⚠ 表日期正好等于换包那天 ⇒ **拒绝自选**，要人显式 `--incumbent=`（一天之内两个主人，机器不替你选）。 */
export function incumbentAt(root, tableNames) {
  const H = slotHistory(root);
  if (!H.length) return { id: null, why: '`champion-map/slot-history.tsv` 不在或为空 ⇒ 没法按声明认现役（换包那一笔要在这里加一行）' };
  const dates = [...new Set((tableNames || []).map(n => (String(n).match(/(20\d\d-\d\d-\d\d)/) || [])[0]).filter(Boolean))].sort();
  if (!dates.length) return { id: H[H.length - 1].id, why: '表名里没有日期 ⇒ 按最新一条 ' + H[H.length - 1].since.slice(0, 10) + ' 认 ' + H[H.length - 1].id };
  const d = dates[dates.length - 1];
  const sameDay = H.filter(e => String(e.since).slice(0, 10) === d);
  if (sameDay.length) return { id: null, why: '表日期 ' + d + ' 正好是换包那天（' + sameDay.map(e => e.id + '@' + String(e.since).slice(11, 19)).join('/') +
    '）⇒ 一天之内两个主人，机器不替你选，请显式传 `--incumbent=<图上的行名>`' };
  const hit = H.filter(e => String(e.since).slice(0, 10) < d);
  if (!hit.length) return { id: null, why: '表日期 ' + d + ' 早于 slot-history 第一条 ' + H[0].since.slice(0, 10) + ' ⇒ 认不出，请显式 `--incumbent=`' };
  return { id: hit[hit.length - 1].id, why: '按 slot-history：' + d + ' 落在 ' + hit[hit.length - 1].since.slice(0, 10) + ' 那条之后 ⇒ 现役 = `' + hit[hit.length - 1].id + '`' };
}

/**
 * 造反查表。rows = [{id, path}]（coords.tsv 的 id/path 两列）。
 *   `opt.incumbent` = **声明**的现役行名（来自 slot-history 或调用方 `--incumbent=`）；给了就把活槽路径接到它身上，
 *   并用 wid 核一道（不同只说明"这张表是换包之前产的"，是正常情形，报出来不拦）。
 *   没给 incumbent 才退回"按 wid 找活槽那一行"（只对**当下**的表成立）。
 * 返回 { byId, byPath, sharedPaths, livePath, liveWid, liveId, liveNote }
 */
export function buildResolver(root, rows, opt) {
  const o = opt || {};
  const livePath = o.livePath || 'js/bundled-champion-3p.js';
  const byId = new Set(), byPath = {}, seen = {}, sharedPaths = new Set();
  for (const r of rows) {
    if (!r.id) continue;
    byId.add(r.id);
    const p = r.path && String(r.path).replace(/\\/g, '/');
    if (!p) continue;
    if (seen[p] !== undefined && seen[p] !== r.id) sharedPaths.add(p);
    seen[p] = r.id;
    byPath[p] = r.id;
  }
  let liveWid = null, liveId = null, liveNote = '';
  try { liveWid = widOf(readFileSync(join(root, livePath), 'utf8')); }
  catch (e) { liveNote = '读不到活槽 ' + livePath + '（' + String(e.message || e).split('\n')[0] + '）'; }
  if (o.incumbent) {
    liveId = byId.has(o.incumbent) ? o.incumbent : null;
    if (!liveId) liveNote = '声明的现役 `' + o.incumbent + '` 不在 coords 里 ⇒ 认不出';
    else {
      byPath[livePath] = liveId;
      const row = rows.filter(r => r.id === liveId)[0];
      const same = row && sameWeights(root, String(row.path || '').replace(/\\/g, '/'), liveWid);
      liveNote = '现役按声明认：' + livePath + ' → `' + liveId + '`（活槽 wid=' + String(liveWid).slice(0, 8) +
        (same ? ' ‖ 与该行文件同权重 ✓ 这是换包之后产的表' : ' ‖ 与该行文件**不同权重** ⇒ 这张表是换包之前产的，当时槽里住的是别枚') + '）';
    }
  } else if (liveWid) {
    const hit = rows.filter(r => r.path).find(r => sameWeights(root, String(r.path).replace(/\\/g, '/'), liveWid));
    if (hit) { liveId = hit.id; byPath[livePath] = hit.id; liveNote = '没给 `--incumbent` ⇒ 按 wid 认当下活槽：→ `' + hit.id + '`（只对换包之后产的表成立）'; }
    else liveNote = '活槽 wid=' + String(liveWid).slice(0, 8) + ' 在图上找不到同一粒权重的那一行 ⇒ 按 path 反查现役会失败，别拿最近的名字顶上';
  }
  return { byId, byPath, sharedPaths, livePath, liveWid, liveId, liveNote };
}

/** 单次解析：座表里的 id + 它打印的 path ⇒ 图上的行 id（认不出来就原样返回座表 id） */
export function resolveId(R, seatId, seatPath) {
  const p = seatPath ? String(seatPath).replace(/\\/g, '/') : '';
  if (R.byId.has(seatId)) return { id: seatId, how: 'id' };
  const byPath = p && R.byPath[p];
  return { id: byPath || seatId, how: byPath ? (R.sharedPaths.has(p) ? 'path-共享(撞名)' : 'path') : '原样(不认识)' };
}
