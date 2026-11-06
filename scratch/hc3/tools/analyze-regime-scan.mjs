#!/usr/bin/env node
/* ============================================================================
 * analyze-regime-scan.mjs —— 吃 probe-regime-fitness 的 `--json` 分片，出"档案级"的四个判词
 *
 *   D1 地板：档案里到底有没有一粒**打得动**那几个把所有已知粒都踩在 2~8% 的原型？
 *   D2 聚合：把 8 粒面板上的 τ 换成 800+ 粒的 τ（今天最重要的那条结论的**功效**版本）。
 *   D3 上界：oracle headroom 与"格子噪声底"并排印 —— 差距小于一个噪声单位就不许当结论。
 *   D4 短名单：给第二阶段（换种子流复量）用的候选，按 **held-out 地板** 与 **held-out 均值** 各出一列。
 *
 * 反"假读数"三条（09-26 一天栽过的坑，都写死在这里）：
 *   · 缺片 / 分片之间标签重复 / 粒数不等于期望 ⇒ **响亮失败并非零退出**，不许静默少样本；
 *   · 地板**不用裸 min**（min over 噪声格 = 把噪声当信号）⇒ 用 bottom-3 均值，并同时印裸 min 供对照；
 *   · 任何"最好/最低"都必须带它的样本量与噪声底。只读，不写仓库。
 * ==========================================================================*/
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';
/* 池内判定的真源 = 量具写进每格的 inpool（函数引用判定）；名字只当回退用 */

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };
rejectUnknownFlags(process.argv.slice(2), ['dir', 'expect', 'short', 'held-min', 'pool-min', 'list-out'], 'analyze-regime-scan');
const DIR = arg('dir', '');
const EXPECT = Number(arg('expect', 0));                 // 期望的粒数（0 = 不检查）
const SHORT = Number(arg('short', 30));                  // 短名单每列几粒
const HELDBOT = Number(arg('held-min', 3));              // 地板 = held-out 里最差的 K 格均值
const POOLBOT = Number(arg('pool-min', 3));

if (!DIR) { console.error('⛔ 必须给 --dir=<probe --json 分片所在目录>'); process.exit(64); }
const files = readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
if (!files.length) { console.error('⛔ ' + DIR + ' 里没有 .json 分片'); process.exit(2); }

const rows = []; const meta = []; const dup = [];
const seen = new Set();
for (const f of files) {
  let j;
  try { j = JSON.parse(readFileSync(DIR + '/' + f, 'utf8')); } catch (e) { console.error('⛔ 分片读不动 ' + f + '：' + e.message); process.exit(2); }
  if (!j.rows || !j.meta) { console.error('⛔ 分片 ' + f + ' 缺 rows/meta（量具半路被杀？这条分片不算数）'); process.exit(2); }
  meta.push(j.meta);
  for (const r of j.rows) {
    if (seen.has(r.label)) { dup.push(r.label + '∈' + f); continue; }
    seen.add(r.label); rows.push(r);
  }
}
if (dup.length) console.error('  ⚠ 跨分片重复标签 ' + dup.length + ' 个（保留第一份）：' + dup.slice(0, 5).join(', '));
if (EXPECT && rows.length !== EXPECT) {
  console.error('⛔ 粒数对不上：读到 ' + rows.length + ' / 期望 ' + EXPECT + ' ⇒ 有分片没跑完，下面的任何计数都不成立');
  process.exit(3);
}
const regimes = Object.keys(rows[0].per);
/* "在不在训练池里"优先信**量具当场算出来的 `inpool` 标记**（函数引用判定）；
 * 老分片没这个标记才回退到 OPP_SPECS 的名字集合，并且**必须声明回退的代价**：
 * 同一个脚本挂两个名字（`promis` vs 池里的 `protomine`，都是 pickProtoMine）会被名字判成池外。 */
import { OPP_SPECS } from '../server/opp-pool.mjs';
const poolNames = new Set((OPP_SPECS || []).map(o => o.name));
const flagged = rows.every(r => regimes.every(n => r.per[n] && typeof r.per[n].inpool === 'boolean'));
const isPool = n => (flagged ? rows[0].per[n].inpool === true : poolNames.has(n));
const held = regimes.filter(n => !isPool(n));
const pool = regimes.filter(n => isPool(n));
if (!held.length || !pool.length) { console.error('⛔ 池内/池外划分不出来（' + (flagged ? 'inpool 标记全同' : '名字集合与量具对不上') + '）'); process.exit(2); }
if (!flagged) console.error('  ⚠ 这批分片不带 inpool 标记 ⇒ 用 OPP_SPECS **名字**回退判池内；换名同脚本的那格会被错判成池外');
let flagMismatch = 0;
for (const r of rows) for (const n of regimes) {
  const f = r.per[n] && r.per[n].inpool, h = r.per[n] && r.per[n].heldout;
  if (typeof f === 'boolean' && h !== undefined && !!f === !!h) flagMismatch++;      // 两个字段自相矛盾
  if (typeof f === 'boolean' && poolNames.has(n) !== f) flagMismatch++;              // 函数判定 vs 名字判定不一致（预期内，只报不算错）
}
if (flagMismatch) console.error('  ℹ inpool(函数) 与名字判定有 ' + flagMismatch + ' 处出入 ⇒ 以 inpool 为准（这正是 promis/protomine 那一类换名同脚本）');
/* 缺格的粒**不许参与判词**：少一个环境的粒在 min / bottom-k 上天然占便宜（同一族"假读数"）。 */
let dropped = 0;
for (let i = rows.length - 1; i >= 0; i--) {
  const miss = regimes.filter(n => !rows[i].per || !rows[i].per[n]);
  if (miss.length) {
    if (dropped < 5) console.error('  ⚠ 剔掉缺格粒 ' + rows[i].label + '（缺 ' + miss.length + ' 格：' + miss.slice(0, 3).join(',') + '…）');
    rows.splice(i, 1); dropped++;
  }
}
if (dropped) console.error('  ⚠ 共剔 ' + dropped + ' 粒（分片来自不同版本量具 / 子进程被掐？）');
if (rows.length < 2) { console.error('⛔ 剔完没有样本了'); process.exit(5); }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sortAsc = a => a.slice().sort((x, y) => x - y);
const bottomMean = (a, k) => mean(sortAsc(a).slice(0, Math.min(k, a.length)));
console.log('# 档案 regime 分析 · ' + rows.length + ' 粒 × ' + regimes.length + ' 环境（池内 ' + pool.length + ' / 池外 ' + held.length +
  '）· 每格 ' + meta[0].seeds + ' 种子 × ' + meta[0].games + ' 局（种子流偏移 ' + (meta[0].seed0 == null ? 0 : meta[0].seed0) + '）');
const sdAll = [];
for (const r of rows) for (const n of regimes) if (r.per[n].sd != null) sdAll.push(r.per[n].sd);
const noise = sdAll.length ? sortAsc(sdAll)[Math.floor(sdAll.length / 2)] : NaN;
/* 噪声底拿不到（种子数 <2 ⇒ 每格 sd 是 NaN）⇒ **不许继续往下判**：headroom 除以 0 会印成 Infinity，
 * 除以错的噪声会印成"值/不值"，两种都是假读数（METHODOLOGY 78：量具的回退值不许静默换判据）。 */
if (!Number.isFinite(noise) || noise <= 0) {
  console.error('⛔ 格子噪声底量不到（noise=' + noise + '，每格种子数=' + meta[0].seeds + '）⇒ D3 的"值不值得条件性"这一判不成立。请用 --seeds>=2 重跑分片。');
  process.exit(7);
}
console.log('# 格子噪声底：全体 ' + sdAll.length + ' 格的种子间 fit-sd 中位 = ' + noise.toFixed(3) + '（fit 量纲 ≈0~1.8）');

/* ---------- D1 地板 ---------- */
for (const r of rows) {
  r.pMean = mean(pool.map(n => r.per[n].fit));
  r.hMean = mean(held.map(n => r.per[n].fit));
  r.hFloor = bottomMean(held.map(n => r.per[n].fit), HELDBOT);
  r.hMin = Math.min(...held.map(n => r.per[n].fit));
  r.hWinMean = mean(held.map(n => r.per[n].win));
  r.hWinFloor = bottomMean(held.map(n => r.per[n].win), HELDBOT);
  r.hWinMin = Math.min(...held.map(n => r.per[n].win));
  r.pWinMean = mean(pool.map(n => r.per[n].win));
  r.spread = Math.max(...regimes.map(n => r.per[n].win)) - Math.min(...regimes.map(n => r.per[n].win));
}
console.log('\n## D1 地板：档案 ' + rows.length + ' 粒在「所有已知粒都被踩」的那几类原型上到底能赢多少');
const heldByHard = held.slice().sort((a, b) =>
  sortAsc(rows.map(r => r.per[a].win))[Math.floor(rows.length / 2)] - sortAsc(rows.map(r => r.per[b].win))[Math.floor(rows.length / 2)]);
for (const n of heldByHard) {
  const w = rows.map(r => r.per[n].win);
  const q = sortAsc(w);
  console.log('   ' + n.padEnd(12) + ' 中位 ' + (100 * q[Math.floor(q.length / 2)]).toFixed(0) + '% · p90 ' +
    (100 * q[Math.floor(q.length * 0.9)]).toFixed(0) + '% · **档案最高 ' + (100 * Math.max(...w)).toFixed(0) +
    '%**（' + rows[w.indexOf(Math.max(...w))].label + '）· ≥20% 的粒数 ' + w.filter(x => x >= 0.2).length +
    ' · ≥35% ' + w.filter(x => x >= 0.35).length);
}
console.log('   （池内对照）');
for (const n of pool) {
  const w = rows.map(r => r.per[n].win); const q = sortAsc(w);
  console.log('   ' + n.padEnd(12) + ' 中位 ' + (100 * q[Math.floor(q.length / 2)]).toFixed(0) + '% · 档案最高 ' +
    (100 * Math.max(...w)).toFixed(0) + '% · ≥35% ' + w.filter(x => x >= 0.35).length);
}

/* ---------- D2 聚合 ---------- */
function kendall(a, b) {
  let num = 0, den = 0;
  const n = a.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const x = a[i] - a[j], y = b[i] - b[j];
    if (x === 0 || y === 0) continue;
    den++; num += Math.sign(x) === Math.sign(y) ? 1 : -1;
  }
  return den ? num / den : NaN;
}
const R = f => rows.map(f);
const fitsOf = r => regimes.map(n => r.per[n].fit);
const pctl = (a, q) => sortAsc(a)[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))];
const sdPop = v => { const mu = mean(v); return Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length); };
const AGG = {
  'mean（现状·全环境）': R(r => mean(fitsOf(r))),
  'mean（仅池内=训练能看见的）': R(r => r.pMean),
  'min': R(r => Math.min(...fitsOf(r))),
  ['bottom-' + POOLBOT + '（池内）']: R(r => bottomMean(pool.map(n => r.per[n].fit), POOLBOT)),
  ['bottom-' + POOLBOT + '（全环境）']: R(r => bottomMean(fitsOf(r), POOLBOT)),
  'p25（全环境）': R(r => pctl(fitsOf(r), 0.25)),
  'mean − 1·sd（全环境）': R(r => mean(fitsOf(r)) - sdPop(fitsOf(r))),
};
const poolMean = AGG['mean（仅池内=训练能看见的）'];
console.log('\n## D2 换聚合会不会换人（n=' + rows.length + ' 粒' + (rows.length < 100 ? ' ⇒ 功效不足，τ 只读方向不读绝对值' : ' ⇒ 这才叫有功效') + '）');
for (const [k, v] of Object.entries(AGG)) {
  const pick = rows[v.indexOf(Math.max(...v))].label;
  console.log('   ' + k.padEnd(24) + ' τ(它, 池内mean) = ' + kendall(poolMean, v).toFixed(3) +
    ' · τ(它, 池外地板) = ' + kendall(R(r => r.hFloor), v).toFixed(3) +
    ' · τ(它, 池外mean) = ' + kendall(R(r => r.hMean), v).toFixed(3) + ' ⇒ 首选 ' + pick);
}
console.log('   参照：池内mean 自己 ⇒ 首选 ' + rows[poolMean.indexOf(Math.max(...poolMean))].label +
  '（池外地板 ' + (100 * rows[poolMean.indexOf(Math.max(...poolMean))].hWinFloor).toFixed(0) + '%）');

/* ---------- D3 oracle 上界 vs 噪声 ---------- */
const orMean = regimes.reduce((a, rg) => a + Math.max(...rows.map(r => r.per[rg].fit)), 0) / regimes.length;
const bestSingle = Math.max(...R(r => mean(fitsOf(r))));
const orHeld = held.reduce((a, rg) => a + Math.max(...rows.map(r => r.per[rg].fit)), 0) / held.length;
const bestHeldSingle = Math.max(...R(r => r.hMean));
console.log('\n## D3 条件性值多少钱（oracle = 每个环境各挑档案里最好的那粒）');
console.log('   全环境：best_single ' + bestSingle.toFixed(3) + ' · oracle ' + orMean.toFixed(3) +
  ' ⇒ headroom ' + (orMean - bestSingle).toFixed(3) + ' ＝ **噪声底(' + noise.toFixed(3) + ') 的 ' +
  ((orMean - bestSingle) / noise).toFixed(1) + ' 倍**（<1 倍不许当结论）');
console.log('   仅池外：best_single ' + bestHeldSingle.toFixed(3) + ' · oracle ' + orHeld.toFixed(3) +
  ' ⇒ headroom ' + (orHeld - bestHeldSingle).toFixed(3) + ' ＝ 噪声底的 ' + ((orHeld - bestHeldSingle) / noise).toFixed(1) + ' 倍');

/* ---------- D4 短名单 ---------- */
const byFloor = rows.slice().sort((a, b) => b.hFloor - a.hFloor);
const byHMean = rows.slice().sort((a, b) => b.hMean - a.hMean);
console.log('\n## D4 短名单（第二阶段换种子复量用；这一列本身被 winner\'s curse 污染，**不许直接当结论**）');
console.log('   按池外地板 top ' + SHORT + '：');
for (const r of byFloor.slice(0, SHORT)) {
  console.log('     ' + r.label.padEnd(22) + ' 池外地板(最差' + HELDBOT + '格均值) ' + r.hFloor.toFixed(3) +
    ' · 裸min ' + r.hMin.toFixed(3) + ' · 池外mean ' + r.hMean.toFixed(3) + ' · 池外平均胜率 ' + (100 * r.hWinMean).toFixed(0) +
    '% · 池外最差胜率 ' + (100 * r.hWinMin).toFixed(0) + '% · 池内mean ' + r.pMean.toFixed(3));
}
console.log('   按池外 mean top ' + SHORT + '：');
for (const r of byHMean.slice(0, SHORT)) {
  console.log('     ' + r.label.padEnd(22) + ' 池外mean ' + r.hMean.toFixed(3) + ' · 池外地板 ' + r.hFloor.toFixed(3) +
    ' · 池内mean ' + r.pMean.toFixed(3) + ' · 池外平均胜率 ' + (100 * r.hWinMean).toFixed(0) + '%');
}
const byFile = new Map(rows.map(r => [r.label, r.file || r.label]));
const un = [...new Set(byFloor.slice(0, SHORT).map(r => r.label).concat(byHMean.slice(0, SHORT).map(r => r.label)))];
const listTxt = un.map(l => byFile.get(l)).join(',');
console.log('   ⇒ 第二阶段复量清单（' + un.length + ' 粒，两列并集；含现役那粒如果面板里有）：\n     ' + listTxt);
if (arg('list-out', '')) {
  try { writeFileSync(arg('list-out'), listTxt); console.log('   # list → ' + arg('list-out')); }
  catch (e) { console.error('⛔ 写 --list-out 失败：' + e.message); process.exitCode = 6; }
}
const incumbent = rows.find(r => /bundled-champion/.test(r.label));
if (incumbent) {
  const rf = byFloor.findIndex(r => r.label === incumbent.label) + 1;
  const rh = byHMean.findIndex(r => r.label === incumbent.label) + 1;
  console.log('\n## 现役在档案里的位置（同尺）：池外地板第 ' + rf + '/' + rows.length + ' 名（' + incumbent.hFloor.toFixed(3) +
    '）· 池外mean 第 ' + rh + '/' + rows.length + ' 名（' + incumbent.hMean.toFixed(3) +
    '）· 池内mean 第 ' + (rows.slice().sort((a, b) => b.pMean - a.pMean).findIndex(r => r.label === incumbent.label) + 1) +
    '/' + rows.length + ' 名 · 极差 ' + (100 * incumbent.spread).toFixed(0) + 'pt');
} else {
  console.log('\n⚠ 面板里没有现役（第二阶段的 --packs 里没带 js/bundled-champion-3p.js ⇒ "不劣于现役"这一维无法判）');
}
console.log('\n# 分布对照（池外地板十分位，fit）：' + sortAsc(rows.map(r => r.hFloor)).filter((_, i) => i % Math.max(1, Math.floor(rows.length / 10)) === 0).map(x => x.toFixed(2)).join(' / '));
