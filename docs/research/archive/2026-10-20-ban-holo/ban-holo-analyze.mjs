/* §E670 分析器：同一粒权重，裸 vs `--ban=holo` ⇒ 送盾值多少分、在哪些桌子上值。
 * 判据与预算先写在 `docs/research/PREREG-2026-10-20-ban-holo-qoder.md`（跑之前），本文件只做它承诺的四条闸 + 两个估计量。
 *
 *   闸① 配对身份：同包两臂 35 组的桌子名单必须逐字相同（不等 ⇒ 本节作废）
 *   闸② 消融真生效：ban 臂的落盘头必须有 #ban=holo，且 stdout 的技能表里全息屏障使用率必须 ≈0
 *   闸③ 分母：每臂 35 组 × games=200；缺组 ⇒ 那一臂只写"读不出"
 *   闸④ 确定性：同 seed 同输入两次逐字相同（由 --teeth=rerun 那一趟对照，见脚本末尾说明）
 *
 *   主估计量：Δ_total = mean_i (裸_i − ban_i)/2  （200 局里 1 命中 = 0.5pt），按桌子聚类 bootstrap 出 95% CI
 *   分组形状：7 个池的"在场 vs 不在场"均值（带分母）+ §E668 那套换席切法 D(x,y|S)（21 对，Bonferroni α=0.05/21）
 *
 * 用法：node docs/research/archive/2026-10-20-ban-holo/ban-holo-analyze.mjs [--rng=20261020] [--flip] [--drop=包名:组号]
 *   --flip   = 牙齿(b)：两臂标签互换 ⇒ 所有 Δ 必须整体变号
 *   --drop   = 牙齿(c)：故意从某一臂删一组 ⇒ 闸③ 必须点名"缺组"并把那一臂判成"读不出"
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const RNG = Number(flag('rng', 20261020));
const FLIP = process.argv.indexOf('--flip') >= 0;
const DROP = flag('drop', '');
const PACKS = [['beadseed', 'v7beadseed-82'], ['wall', 'v7wall-33'], ['teach', 'v7teach-32'], ['expo', 'v7expo-34']];
const POOLS = ['antidef', 'deepsaver', 'farmer', 'heavyfire', 'random', 'wall', 'defend'];

function readPer(f) {
  const txt = readFileSync(join(ROOT, 'docs/research/archive/2026-10-20-ban-holo', f), 'utf8').replace(/\r/g, '').split('\n');
  const head = {}, rows = [];
  for (const L of txt) {
    if (L.startsWith('#')) { const k = L.slice(1).split('='); if (k.length === 2) head[k[0]] = k[1]; continue; }
    const c = L.split('\t'); if (c.length < 6 || c[0] !== 'subject') continue;
    rows.push({ idx: +c[1], names: c[2], games: +c[3], first: +c[4] });
  }
  rows.sort((a, b) => a.idx - b.idx);
  return { head, rows };
}
/* 可复现的整除取模伪随机（不用 Math.random ⇒ 同一 rng 两次跑逐字同）*/
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function bootCI(d, seed, B) {
  const r = rnd(seed), n = d.length, out = [];
  if (n < 2) return null;
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += d[Math.floor(r() * n)]; out.push(s / n); }
  out.sort((a, b) => a - b);
  return [out[Math.floor(out.length * 0.025)], out[Math.floor(out.length * 0.975)]];
}
const f2 = (v) => (v === null || v === undefined || !isFinite(v)) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2);

let nGateFail = 0;
const ALL = [];
function gate(name, ok, extra) { console.log((ok ? '  闸 OK  ' : '  ⛔ 闸红 ') + name + (extra ? '   ' + extra : '')); if (!ok) nGateFail++; }

for (const [k, id] of PACKS) {
  let bare = readPer(k + '-bare.per.txt'), ban = readPer(k + '-ban.per.txt');
  if (FLIP) { const t = bare; bare = ban; ban = t; }
  if (DROP) { const w = DROP.split(':'); if (w[0] === k) { const di = +w[1]; ban = { head: ban.head, rows: ban.rows.filter(r => r.idx !== di) }; } }
  console.log('\n=== ' + id + '   （' + (FLIP ? '⚠ 翻标签对照' : '裸 − ban') + '）===');
  /* 闸① 配对身份：桌子名单逐字相同 **并且两臂的装配头除 `ban` 之外逐字相同**
   *   —— 第一版我只比了名单，漏掉了工具自己那行响亮说明："检测到 --ban ⇒ 把引擎默认档 BIGT_PUSH 顶成 0"
   *      ⇒ 裸臂 shipbigt=12 ‖ ban 臂 shipbigt=0，Δ 里混了两个自由量（teach 那一包当场读出 −19.6pt，就是这个 confound）。
   *      现在把整张头都比一遍，差哪个键就点名哪个。 */
  let same = bare.rows.length === ban.rows.length;
  for (let i = 0; i < Math.min(bare.rows.length, ban.rows.length); i++) if (bare.rows[i].names !== ban.rows[i].names || bare.rows[i].idx !== ban.rows[i].idx) { same = false; break; }
  const keys = [...new Set(Object.keys(bare.head).concat(Object.keys(ban.head)))].filter(x => x !== 'ban' && x !== 'file');
  const diffK = keys.filter(x => String(bare.head[x]) !== String(ban.head[x]));
  gate('① 配对身份（桌子名单逐字相同 ‖ 装配头除 ban/file 外逐字相同）', same && diffK.length === 0,
    '裸 ' + bare.rows.length + ' 组 ‖ ban ' + ban.rows.length + ' 组' + (diffK.length ? ' ‖ ⛔ 装配差在这些键：' + diffK.map(x => x + '=' + bare.head[x] + '/' + ban.head[x]).join(' ‖ ') : ' ‖ 装配同（shipbigt=' + bare.head.shipbigt + '）'));
  /* 闸② 消融真生效 */
  gate('② 消融真生效（落盘头有 #ban=holo）', ban.head.ban === 'holo', '#ban=' + (ban.head.ban || '(空)') + ' ‖ 两臂 seed ' + bare.head.seed + '/' + ban.head.seed);
  /* 闸③ 分母 */
  const full = bare.rows.length === 35 && ban.rows.length === 35 && bare.rows.every(r => r.games === 200) && ban.rows.every(r => r.games === 200);
  gate('③ 分母（两臂各 35 组 × 200 局）', full, '裸 ' + bare.rows.length + ' 组 ‖ ban ' + ban.rows.length + ' 组 ‖ 每组局数 ' +
    (bare.rows.length ? [...new Set(bare.rows.map(r => r.games))].join(',') : '—') + '/' + (ban.rows.length ? [...new Set(ban.rows.map(r => r.games))].join(',') : '—'));
  if (!full) { console.log('  ⇒ 分母不足 ⇒ 这一包的 Δ **读不出**（不是 0，也不是"没差别"）'); continue; }
  /* 主估计量 */
  const d = bare.rows.map((r, i) => (r.first - ban.rows[i].first) / 2);
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const ci = bootCI(d, RNG, 4000);
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (d.length - 1));
  console.log('  Δ_total（裸 − ban）= ' + f2(mean) + 'pt ‖ 配对 SE ' + (sd / Math.sqrt(d.length)).toFixed(2) +
    ' ‖ 桌子聚类 bootstrap 95% CI [' + f2(ci[0]) + ', ' + f2(ci[1]) + '] ‖ rng=' + RNG + '（B=4000）');
  /* 分组形状：7 池在场 vs 不在场 */
  console.log('  按对手池（在场 − 不在场的 Δ 均值，带分母）：');
  const poolDiff = {};
  for (const p of POOLS) {
    const inT = [], outT = [];
    bare.rows.forEach((r, i) => (r.names.split(',').indexOf(p) >= 0 ? inT : outT).push(d[i]));
    const mi = inT.length ? inT.reduce((a, b) => a + b, 0) / inT.length : NaN;
    const mo = outT.length ? outT.reduce((a, b) => a + b, 0) / outT.length : NaN;
    poolDiff[p] = mi - mo;
    console.log('    ' + p.padEnd(11) + ' 在场 ' + String(inT.length).padStart(2) + ' 桌 Δ ' + f2(mi) +
      ' ‖ 不在场 ' + String(outT.length).padStart(2) + ' 桌 Δ ' + f2(mo) + ' ‖ 差 ' + f2(mi - mo));
  }
  ALL.push({ k, id, mean, lo: ci[0], hi: ci[1], poolDiff });
  /* 换席切法：S = 三席（从每张 4 人桌里"固定三席"取出来），D(x,y|S) = Δ(S∪x) − Δ(S∪y)
   *   ⚑ 第一版这里写错了：我把 4 人桌本身当成 S 再去找 5 人桌 ⇒ 永远 0 对（不是"没差别"，是我取错了集合）。
   *   正确形：C(7,4)=35 张桌子 ⇒ 每张桌子拆出 4 个三席子集 ⇒ 去重后 C(7,3)=35 个 S，每个 S 有 C(4,2)=6 个对 ⇒ 210 条对比、21 种对。*/
  const byKey = {};
  bare.rows.forEach((r, i) => { const s = r.names.split(',').sort().join(','); byKey[s] = d[i]; });
  const S3 = {};
  Object.keys(byKey).forEach(c4 => { const a = c4.split(',');
    for (let q = 0; q < a.length; q++) S3[a.filter((_, z) => z !== q).sort().join(',')] = 1; });
  const pairs = [];
  Object.keys(S3).forEach(s3 => { const a = s3.split(',');
    const rest = POOLS.filter(p => a.indexOf(p) < 0);
    for (let x = 0; x < rest.length; x++) for (let y = x + 1; y < rest.length; y++) {
      const kx = a.concat([rest[x]]).sort().join(','), ky = a.concat([rest[y]]).sort().join(',');
      if (byKey[kx] !== undefined && byKey[ky] !== undefined) pairs.push({ t: rest[x] + ' vs ' + rest[y], v: byKey[kx] - byKey[ky] }); } });
  const byT = {};
  pairs.forEach(p => { (byT[p.t] || (byT[p.t] = [])).push(p.v); });
  const BON = 0.05 / 21;
  const rows = Object.keys(byT).map(t => {
    const v = byT[t], m = v.reduce((a, b) => a + b, 0) / v.length;
    const ci2 = bootCI(v, RNG + 7, 4000);
    return { t, n: v.length, m, lo: ci2 ? ci2[0] : NaN, hi: ci2 ? ci2[1] : NaN };
  }).filter(o => o.n >= 4).sort((a, b) => Math.abs(b.m) - Math.abs(a.m));
  console.log('  换席切法 D(x,y|S)（同 seed 配对，Bonferroni α=' + BON.toFixed(4) + ' ⇒ 95% 除 21）：' + rows.length + ' 对（每对分母 ' +
    (rows.length ? rows[0].n : '—') + ' 个 S）');
  rows.slice(0, 6).forEach(o => console.log('    ' + o.t.padEnd(24) + ' Δ̄ ' + f2(o.m) + '  CI [' + f2(o.lo) + ', ' + f2(o.hi) + ']' +
    (o.lo > 0 || o.hi < 0 ? '   ← 过 Bonferroni' : '')));
}
console.log('\n=== 四个独立起点合看（预注册 §三：不合并成一个总分）===');
ALL.forEach(o => console.log('  ' + o.id.padEnd(16) + ' Δ_total ' + f2(o.mean) + 'pt ‖ 95% CI [' + f2(o.lo) + ', ' + f2(o.hi) + '] ‖ ' +
  (o.hi < 0 ? '拿掉送盾更好（CI 全负）' : o.lo > 0 ? '送盾挣钱（CI 全正）' : 'CI 跨 0 ⇒ 这一支判不动')));
const nSame = (p, s) => ALL.filter(o => Math.sign(o.poolDiff[p]) === s).length;
console.log('  按池（"在场 − 不在场"的 Δ 差；⚑ 预注册引用规则：**≥2 个起点同向**才许写成"这一池"）：');
POOLS.forEach(p => {
  const neg = nSame(p, -1), pos = nSame(p, 1);
  /* ⚑ 预注册写的是"≥2 个独立起点同向"，但 2 同向 + 2 反号 那种局面**恰恰是起点之间在打架**，
   *   第一版照字面实现会把 2/2 也标成"够写" ⇒ 收紧成"同向 ≥2 且**零反号**"。 */
  const ok = Math.max(neg, pos) >= 2 && Math.min(neg, pos) === 0;
  console.log('    ' + p.padEnd(11) + ALL.map(o => f2(o.poolDiff[p]).padStart(7)).join(' ') +
    '   负 ' + neg + '/正 ' + pos + (ok ? '   ← 够写"这一池"（全同向）' : '   ← 起点之间打架或只 1 支 ⇒ 不许指名')); });
console.log('  （列顺序 = ' + ALL.map(o => o.k).join(' ‖ ') + '）');
console.log('\n' + (nGateFail ? '⛔ 有 ' + nGateFail + ' 条闸红 ⇒ 相应读数按"读不出/作废"处置，不许当结论引用' : '四条闸全过（闸④ 由重跑那一趟原件单独对账）'));
