/* §E649 · Hp/Hplong 开档口径重跑的配对读数器
 * 输入 = `champion-map/epsfull-prior2-2026-10-18.tsv`（multi）与 `epsfull-long-prior2-2026-10-18.tsv`（long），
 *   每行由 `eps-full.mjs --pageOnly=1 --support=2` 产出：`exam`/`d` 从裸包表**原样搬**，`page` = 开档页面新测，`pageBare` = 裸包页面旧值。
 * 于是 **Δ = page − pageBare 就是"先验把这枚包的线上读数挪了多少"**（同一枚、同 seed、同剂量档 ⇒ 是配对差，不是两把尺之差）。
 * 输出按 mode 分层（multi/long 是两张桌，跨桌平均就是把桌形混进效应）：Δ 的中位/P10/P90 + 均值 ±SE + 符号计数 ‖
 *   Δ=0 的枚数（= 先验对它完全不起作用，这是**下一轮筛选条件的实测版本**，比拿 `holo.tsv` 的 ε=0 列猜可靠）‖
 *   现役池成员（hard/soft）单独一层 —— 用户在乎的是那 29 枚。
 * ⚠ 三条规矩：① 分母为 0 的层写"读不出"不写"无影响"；② Δ 的 SE 是"跨枚"的单样本 SE（一枚一个值），
 *   不是"重复测量"⇒ 枚数才是分母；③ 引用本表任何数必须带 `support=2`（产品档 = weighted+skipP0.6）。
 * 用法：node docs/research/archive/2026-10-18-night2-prior-caliber/analyze-hp-prior.mjs [--pool=champion-map/pool-members.tsv]
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const { pairedStats, fmtPaired } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const POOL = arg('pool', 'champion-map/pool-members.tsv');

const FILES = ['champion-map/epsfull-prior2-2026-10-18.tsv', 'champion-map/epsfull-long-prior2-2026-10-18.tsv']
  .map(f => path.join(ROOT, f)).filter(existsSync);
if (!FILES.length) { console.error('⛔ 两张重跑表都不在盘上 ⇒ 读不出（别把"还没跑完"写成"没影响"）'); process.exit(2); }

/* 池成员名单（现役 hard/soft）——按表头查列，不按位置取 */
const inPool = {};
const pf = path.join(ROOT, POOL);
if (existsSync(pf)) {
  const P = readFileSync(pf, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(Boolean).filter(l => l[0] !== '#');
  const h = Object.fromEntries(P[0].split('\t').map((x, i) => [x.trim(), i]));
  const idCol = h.id !== undefined ? h.id : h.arm !== undefined ? h.arm : 0;
  const tierCol = h.tier !== undefined ? h.tier : 1;
  for (const l of P.slice(1)) { const c = l.split('\t'); if (c[idCol]) inPool[c[idCol].trim()] = (c[tierCol] || '?').trim(); }
  console.log('池成员名单读入 ' + Object.keys(inPool).length + ' 枚（列 id@' + idCol + ' ‖ tier@' + tierCol + '）');
} else console.log('⚠ 池名单读不到：' + POOL + ' ⇒ 现役那一层只能写"读不出"');

const rows = [], seen = {};
for (const f of FILES) {
  const L = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(l => l.indexOf('#') !== 0 && l.trim());
  const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x.trim(), i]));
  for (const col of ['id', 'page', 'pageBare', 'support', 'mode']) {
    if (h[col] === undefined) { console.error('⛔ ' + path.basename(f) + ' 缺列 `' + col + '`（表头：' + L[0] + '）⇒ 这台读数器要的是带 `--support=` 的那批'); process.exit(2); }
  }
  for (const l of L.slice(1)) {
    const c = l.split('\t');
    const id = c[h.id], page = Number(c[h.page]), bare = Number(c[h.pageBare]);
    if (!id || !isFinite(page) || !isFinite(bare)) { console.error('⛔ 不合法的一行（不许静默丢分母）：' + l); process.exit(3); }
    if (c[h.support] !== '2') { console.error('⛔ ' + id + ' 的 support=' + c[h.support] + ' ⇒ 这批混档了'); process.exit(3); }
    const key = id + '|' + c[h.mode];
    const d = +(page - bare).toFixed(2);
    if (seen[key] !== undefined && seen[key] !== d) { console.error('⛔ 同一个键两个不同 Δ：' + key + ' ⇒ ' + seen[key] + ' ↔ ' + d); process.exit(4); }
    seen[key] = d;
    rows.push({ id, mode: c[h.mode], page, bare, d });
  }
}
const dup = rows.length - Object.keys(seen).length;
console.log('读入 ' + rows.length + ' 行 → ' + Object.keys(seen).length + ' 个唯一 (id,mode) 键' + (dup ? ' ‖ 重复 ' + dup + ' 行且逐值相同（并发追加的痕迹，去重后继续）' : ''));

const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
function report(label, set) {
  const ds = set.map(r => r.d);
  if (!ds.length) { console.log('\n## ' + label + ' ‖ **读不出（分母 0，不是"没影响"**）'); return; }
  const zeros = ds.filter(d => d === 0).length;
  const pos = ds.filter(d => d > 0).length, neg = ds.filter(d => d < 0).length;
  const st = pairedStats(ds);
  console.log('\n## ' + label + ' ‖ n=' + ds.length + ' 枚（一枚一个 Δ，分母是**枚数**，不是批数）');
  console.log('   Δ = 开档 − 裸包：中位 ' + q(ds, 0.5).toFixed(2) + 'pt ‖ P10 ' + q(ds, 0.10).toFixed(2) + ' ‖ P90 ' + q(ds, 0.90).toFixed(2)
    + ' ‖ 最小 ' + Math.min.apply(null, ds).toFixed(2) + ' ‖ 最大 ' + Math.max.apply(null, ds).toFixed(2));
  console.log('   ' + fmtPaired(label + ' Δ', ds) + ' ‖ 符号 ' + pos + '+ / ' + neg + '− / ' + zeros + ' 零');
  console.log('   ⚑ Δ=0 的 ' + zeros + '/' + ds.length + ' 枚 = 先验在这张桌上对它们**完全不起作用**（下一轮筛选条件的实测版本，'
    + '比拿 `holo.tsv` 的 ε=0 列猜可靠：本班 12 枚"零送盾"控制组里有 6 枚开档后仍变）');
  if (pos + neg > 0) {
    const nz = ds.filter(d => d !== 0);
    console.log('   只看会变的那 ' + nz.length + ' 枚：中位 ' + q(nz, 0.5).toFixed(2) + 'pt ‖ P10 ' + q(nz, 0.10).toFixed(2) + ' ‖ P90 ' + q(nz, 0.90).toFixed(2)
      + ' ‖ 均值 ' + fmtPaired('非零层', nz).replace(/^.*?\]/, '').trim());
    const big = nz.filter(d => Math.abs(d) >= 2).sort((a, b) => b - a);
    console.log('   |Δ| ≥ 2pt 的 ' + big.length + ' 枚（这些才是"重跑改变了图上位置"的）');
  }
}
const byMode = {};
for (const r of rows) (byMode[r.mode] = byMode[r.mode] || []).push(r);
for (const m of Object.keys(byMode).sort()) report('全库 · ' + m, byMode[m]);
for (const m of Object.keys(byMode).sort()) {
  const pool = byMode[m].filter(r => inPool[r.id]);
  report('现役池成员 · ' + m + '（' + POOL + '）', pool);
  const hard = pool.filter(r => inPool[r.id] === 'hard');
  report('  其中 hard 档 · ' + m, hard);
}
console.log('\n—— 边界：Δ 是**同 seed 同剂量档**的两口径之差（配对成立）；`exam`/`d` 两列是从裸包表搬的，本表不动它们的语义。');
console.log('   缺基线的枚（旧表里没有行 ⇒ 本轮不写行）在 runner 日志里点名；引用本表必须带 `support=2`（产品档 weighted+skipP0.6）。');
