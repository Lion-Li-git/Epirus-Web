/* 「有多少候选是被**口径**挡在广度门下的」—— 档案批量筛（09-25 凌晨 · Qoder · 只读）
 *
 * 动因（§H-12）：`G<3` 这条线判在 ε=0 上，而 ε=0 下的"非ジ出手种类/熵"**天然少一截**（探索本身就是种类来源）
 *   ⇒ 4 粒候选的 `ΔG(multi)` 全为正。小样本不足以立论，所以把档案里的一把包都过一遍，数**跨界方向**。
 * 预注册（跑之前写死）：
 *   ① 若"ε=0 挡 / 产品过"的粒数 ≫ 反向 ⇒ 这条线在评测口径下**系统性偏严**，重标定时必须按列做（不是整体挪）；
 *   ② 若两个方向数量相当 ⇒ "口径只改噪声不改判定"，第 54 条那条"系统性偏低"要降级为小样本假象。
 * 搬运手法**复用 `probe-layer-caliber.mjs` 的 `build()`**（同一套两路：内存替换 evo 写死处 + 包一层沙箱属性），
 *   不另起第二份实现；`mirrorHealth` 是确定性的（老账：8 个种子读数一字不差）⇒ 每格一次就够。
 *
 * 用法：node tools/probe-breadth-flip.mjs [--every=12] [--limit=140] [--games=60] [--line=3]
 */
import { readdirSync } from 'node:fs';
import { build } from './probe-layer-caliber.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
const EVERY = Number(arg('every', 12));
const LIMIT = Number(arg('limit', 140));
const GAMES = Number(arg('games', 60));
const LINE = Number(arg('line', 3));
const TEMP = Number(arg('temp', 0.15)), EPS = Number(arg('eps', 0.2)), EPSK = Number(arg('epsk', 5)), EPSMODE = arg('epsmode', 'soft');

const all = readdirSync('docs/artifacts').filter(function (f) { return /\.bak$/.test(f); }).sort();
const EXTRA = String(arg('extra', '')).split(',').filter(Boolean);
const picked = all.filter(function (f, i) { return i % EVERY === 0; }).slice(0, LIMIT)
  /* 锚点包必须**显式进表**：不然"这条线能不能分开已知好/已知坏"根本没法判（本仓规矩：阈值先要能分开两端） */
  .concat(EXTRA.map(function (x) { return x.replace(/^docs\/artifacts\//, ''); }));
console.log('# 档案广度口径筛（`docs/artifacts/*.bak` 共 ' + all.length + ' 粒，按每 ' + EVERY + ' 取 1 得 ' + picked.length + ' 粒 · 门线 G≥' + LINE + ' · mirrorHealth ' + GAMES + ' 局 × 5 席 · 确定性）\n');

const rows = [];
const SKIP = [];
function pct(x) { return x.toFixed(0) + '%'; }
let i = 0;
for (const f of picked) {
  i++;
  const path = 'docs/artifacts/' + f;
  if (readFileSync(path, 'utf8').slice(0, 4000).indexOf('window.EPIRUS_CHAMPION') < 0) { SKIP.push(f); continue; }   // .bak 里混着非包备份
  let g0, g1;
  try {
    const A = build({ on: false, pack: path });
    const B = build({ on: true, pack: path, temp: TEMP, eps: EPS, epsK: EPSK, epsMode: EPSMODE });
    const P = A.sb.EpirusPolicy, T = A.sb.EpirusTrainer;
    const pa = P.unpack(A.sb.EPIRUS_CHAMPION_3P, true) || P.unpack(A.sb.EPIRUS_CHAMPION, true);
    const pb = B.sb.EpirusPolicy.unpack(B.sb.EPIRUS_CHAMPION_3P, true) || B.sb.EpirusPolicy.unpack(B.sb.EPIRUS_CHAMPION, true);
    if (!pa || !pb) { console.log('  ⚠️ ' + f + ' 解不出参数，跳过'); continue; }
    g0 = { m: T.mirrorHealth(pa, GAMES, 5, 'multi'), l: A.sb.EpirusTrainer.mirrorHealth(pa, GAMES, 5, 'long') };
    g1 = { m: B.sb.EpirusTrainer.mirrorHealth(pb, GAMES, 5, 'multi'), l: B.sb.EpirusTrainer.mirrorHealth(pb, GAMES, 5, 'long') };
    if (B.patched !== B.hardwired) { console.log('  ⚠️ 搬运自检：替换 ' + B.patched + ' 处 ≠ 源码实测 ' + B.hardwired + ' 处 ⇒ 作废退出'); process.exit(9); }
  } catch (e) { console.log('  ⚠️ ' + f + ' 跑不动：' + e.message); continue; }
  rows.push({
    pack: f.replace(/\.bak$/, ''), anchor: EXTRA.indexOf(f) >= 0,
    gA: g0.m.effSkills, gB: g1.m.effSkills,
    lA: g0.l.effSkills, lB: g1.l.effSkills,
    landA: g0.m.effSkillsLand || 0, landB: g1.m.effSkillsLand || 0,
    keysA: g0.m.distinctKeys, keysB: g1.m.distinctKeys
  });
  if (i % 20 === 0) console.log('  …已量 ' + i + '/' + picked.length);
}
if (!rows.length) { console.log('⛔ 一粒都没量到 ⇒ 非零退出'); process.exit(6); }

const blockA = rows.filter(function (r) { return r.gA < LINE; });
const blockB = rows.filter(function (r) { return r.gB < LINE; });
const freed = rows.filter(function (r) { return r.gA < LINE && r.gB >= LINE; });
const blocked = rows.filter(function (r) { return r.gA >= LINE && r.gB < LINE; });
const bothBlock = rows.filter(function (r) { return r.gA < LINE && r.gB < LINE; });
const dG = rows.map(function (r) { return r.gB - r.gA; }).sort(function (a, b) { return a - b; });
const med = dG[dG.length >> 1];
const pos = dG.filter(function (x) { return x > 0.001; }).length, neg = dG.filter(function (x) { return x < -0.001; }).length;

console.log('\n## 结论（n=' + rows.length + ' 粒）');
console.log('   被 `G(multi)<' + LINE + '` 挡：评测口径 **' + blockA.length + ' 粒**（' + pct(100 * blockA.length / rows.length) + '） vs 产品口径 **' + blockB.length + ' 粒**（' + pct(100 * blockB.length / rows.length) + '）');
console.log('   其中"ε=0 挡 → 产品过"（=被口径挡掉的）=' + freed.length + ' 粒；反向"ε=0 过 → 产品挡"=' + blocked.length + ' 粒；两边都挡=' + bothBlock.length + ' 粒');
console.log('   ΔG 中位数 ' + (med >= 0 ? '+' : '') + med.toFixed(2) + ' · 正 ' + pos + ' 粒 / 负 ' + neg + ' 粒 / 其余 0');
console.log('   long 同判：挡 ' + rows.filter(function (r) { return r.lA < LINE; }).length + ' → ' + rows.filter(function (r) { return r.lB < LINE; }).length + ' 粒');
console.log('   净兑现：<3 的粒数 ' + rows.filter(function (r) { return r.landA < LINE; }).length + ' → ' + rows.filter(function (r) { return r.landB < LINE; }).length + '（同一条线，只列不改判）');
/* 分布 + 两端锚点：一条线值不值得立，先看它**分不分得开**已知好与已知坏（附录 B2-6 / C-4） */
const q = function (arr, x) { const a = arr.slice().sort(function (m, n) { return m - n; }); return a[Math.min(a.length - 1, Math.floor(x * a.length))]; };
const lA = rows.map(function (r) { return r.landA; }), lB = rows.map(function (r) { return r.landB; });
const gA = rows.map(function (r) { return r.gA; }), gB = rows.map(function (r) { return r.gB; });
const line = function (nm, arr) { return nm.padEnd(16) + ['p10', 'p25', 'p50', 'p75', 'p90'].map(function (t, i) { return t + ' ' + q(arr, [0.1, 0.25, 0.5, 0.75, 0.9][i]).toFixed(2); }).join('  '); };
console.log('   分布（同一条线要落在两端的哪一侧，先看分位数）：');
console.log('     ' + line('G ε=0', gA)); console.log('     ' + line('G 产品', gB));
console.log('     ' + line('净兑现 ε=0', lA)); console.log('     ' + line('净兑现 产品', lB));
const anch = rows.filter(function (r) { return r.anchor; });
if (anch.length) {
  console.log('   两端锚点（显式进表 ' + anch.length + ' 粒）：');
  for (const r of anch) console.log('     ' + r.pack.slice(0, 22).padEnd(23) + ' G ' + r.gA.toFixed(2) + '→' + r.gB.toFixed(2) +
    '   净兑现 ' + r.landA.toFixed(2) + '→' + r.landB.toFixed(2) + '   出手种类 ' + r.keysA + '→' + r.keysB);
}
const nBlock = Math.max(blockA.length, blockB.length);
console.log('\n   预注册判据落点：' + (rows.length < 30 || nBlock < 10
  ? '⚠️ **样本不足**（n=' + rows.length + ' · 被挡最多的一栏只有 ' + nBlock + ' 粒）⇒ 两向计数都不足以定方向，只能当"要不要跑全量"的前置检查'
  : (freed.length >= 3 * Math.max(1, blocked.length)
    ? '①成立 —— 这条线在评测口径下**系统性偏严**（被挡 ' + freed.length + ' 粒 : 反向 ' + blocked.length + ' 粒）'
    : '②成立（或介于中间）—— 正向 ' + freed.length + ' : 反向 ' + blocked.length + '，不到 3:1 ⇒ "系统性偏严"不能只靠这个比例立论')));
console.log('   ⚠️ 本表**不换槽、不改门**：它只回答"如果要重标定，被影响的是多少粒"。');
