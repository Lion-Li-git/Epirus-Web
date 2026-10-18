/* 选拔带宽 vs 噪声：规则 (b)「N 粒 seedBase 配对多数票」的离线试验台
 * 输入 = `evaln-noise --dump` 的矩阵（pack, base, first, top2, sc），全部是**已跑过的格**，一局都不重跑。
 * 现状 R1：一粒 seedBase ⇒ sc 取最大 ⇒ 同分带（sc ≥ top − 3.0pt）⇒ 带内多枚时再按发散度/兑现广度仲裁
 *          （`tools/pick-best.mjs` 里那条带内仲裁本轮**不建模**，只统计"带内不止一枚"= 抽签风险格）
 * 规则 R2(b)：每粒 base 各出一个第一名 ⇒ 多数票（得票 > k/2）⇒ 无多数则退回"k 粒均值 + 同分带"
 * 报：每个 k 的 ①能否唯一裁决 ②与"全部 12 粒"结论的一致率 ③成本倍数 ④现状带内多枚率
 *     ‖ 以及带宽该设多大才盖得住噪声（逐枚 sc 种子极差的 p50/p90）
 * ⚠ 这台不吃 `--expect` 对应性守卫 ⇒ 读的是**这台尺上的相对量**，不许当现网当选键的绝对读数。 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
/* 归仓版（2026-10-18）：默认输入改成**仓内那份矩阵**（旧默认指向某台机器的会话临时目录）。
 *   数据行与当时落的 scratch/selband/matrix.tsv 逐字节相同（diff 过），只差进仓文件头的 5 行注释 ⇒ 不再另存一份副本。 */
const FILE = process.argv[2] || path.resolve(fileURLToPath(import.meta.url), '../../../../../../champion-map/selband-2026-10-18.tsv');
const TOL = Number(process.argv[3] || 3.0);
const L = readFileSync(FILE, 'utf8').split(/\r?\n/).filter(x => x && x[0] !== '#');   /* 进仓那份 TSV 头部有 5 行 `#` 注释（工具/候选/粒数/耗时/守卫缺失），当时喂的是没注释的原始 dump ⇒ 归仓时这里要跳过 `#`，否则表头找不到 pack 列、静默算出"0 枚候选" */
const h = L[0].split('\t');
const iPk = h.indexOf('pack'), iB = h.indexOf('base'), iS = h.indexOf('sc');
const M = {}, BASES = new Set();
for (const row of L.slice(1)) {
  const c = row.split('\t');
  const p = c[iPk], b = Number(c[iB]);
  BASES.add(b);
  (M[p] = M[p] || {})[b] = Number(c[iS]);
}
const BASE = [...BASES].sort((a, b) => a - b);
const PACKS = Object.keys(M).filter(p => BASE.every(b => Number.isFinite(M[p][b])));
console.log('## 输入：' + PACKS.length + ' 枚候选 × ' + BASE.length + ' 粒 seedBase（' + BASE[0] + '…' + BASE[BASE.length - 1] + '）‖ 同分带容差 ' + TOL + 'pt');
if (!PACKS.length || BASE.length < 2) { console.error('⛔ 读不出：候选 ' + PACKS.length + ' 枚 ‖ seedBase ' + BASE.length + ' 粒 ⇒ 分母不足，不许把空表当结果'); process.exit(3); }

/* 逐枚的种子极差（现状噪声水平） */
const ranges = PACKS.map(p => { const v = BASE.map(b => M[p][b]); return Math.max(...v) - Math.min(...v); });
const q = (a, x) => { const s = a.slice().sort((m, n) => m - n); return s[Math.min(s.length - 1, Math.floor(x * (s.length - 1)))]; };
console.log('   单枚 sc 的种子极差：p50 ' + q(ranges, .5).toFixed(2) + ' ‖ p90 ' + q(ranges, .9).toFixed(2) + ' ‖ max ' + Math.max(...ranges).toFixed(2) +
  ' pt ⇒ **带宽要 ≥ p90 才盖得住噪声**（现带宽 ' + TOL + 'pt ⇒ 比值 ' + (q(ranges, .9) / TOL).toFixed(2) + '×）');

/* 选举函数 */
function elect(subsetBases, mode) {
  const scores = PACKS.map(p => ({ p, v: subsetBases.reduce((a, b) => a + M[p][b], 0) / subsetBases.length }));
  if (mode === 'R1') {                                     // 单粒：该粒的 sc + 带
    const top = Math.max(...scores.map(s => s.v));
    return { band: scores.filter(s => s.v >= top - TOL).map(s => s.p), winner: scores.sort((a, b) => b.v - a.v)[0].p };
  }
  /* R2：每粒各出一个第一名 ⇒ 多数票；无多数 ⇒ 均值榜 + 带 */
  const votes = {};
  for (const b of subsetBases) { const r = electSingle(b); votes[r] = (votes[r] || 0) + 1; }
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  const need = subsetBases.length / 2;
  if (best && best[1] > need) return { band: [best[0]], winner: best[0], votes: best[1], maj: true };
  const top = Math.max(...scores.map(s => s.v));
  const band = scores.filter(s => s.v >= top - TOL).map(s => s.p);
  return { band: band, winner: scores.sort((a, b) => b.v - a.v)[0].p, maj: false };
}
function electSingle(b) {
  const arr = PACKS.map(p => ({ p, v: M[p][b] })).sort((x, y) => y.v - x.v);
  return arr[0].p;
}

/* k 子集抽样评估 */
const combosOf = function (n, k) { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
const full = elect(BASE, 'R2');
console.log('\n   全部 ' + BASE.length + ' 粒的 R2 结论：' + (full.maj ? '多数票直接选定 ' + full.winner + '（得票 ' + full.votes + '/' + BASE.length + '）' : '无多数 ⇒ 退到均值榜，带内 ' + full.band.length + ' 枚') + ' ‖ 均值榜第一名 = ' + full.winner);
console.log('\n   k   子集数   R2 多数票成立率   与全体结论一致率   带内多枚率(R1)   均值榜噪声极差 p50   p90（=带宽下限）  成本倍数');
for (const k of [1, 2, 3, 4, 6, 8, BASE.length].filter(x => x <= BASE.length)) {
  const total = combosOf(BASE.length, k);
  let majOk = 0, agree = 0, bandMulti = 0, n = 0;
  /* 枚举**递增下标组合**（标准算法）—— 早先用" shrinking pool + mod"的写法会产出重复组合、漏掉别的组合 */
  const combos = (function () {
    /* 归仓复算（2026-10-18）：旧写法在 total>500 时退化成 **500 次无种子随机抽样** ⇒ k=6（C(12,6)=924）这两格每次跑都不一样
     *   （实测今昔差：一致率 87.8% → 85.6%、多数票成立率 12.2% → 9.8%），而这里最多 924 个子集 × 28 枚 = 全枚举只是几万次加法。
     *   ⇒ 抽样没有任何收益、却把结论变成不可复算 ⇒ 一律精确枚举。要改回抽样必须先给 RNG 定种子并写明。 */
    const out = []; const c = Array.from({ length: k }, (_, i) => i);
    while (true) { out.push(c.map(i => BASE[i])); let i = k - 1; while (i >= 0 && c[i] === BASE.length - k + i) i--; if (i < 0) break; c[i]++; for (let j = i + 1; j < k; j++) c[j] = c[j - 1] + 1; }
    return out;
  })();
  for (const sb of combos) {
    const r2 = elect(sb, 'R2'), r1 = elect(sb, 'R1');
    n++;
    if (r2.maj) majOk++;
    if (r2.winner === full.winner) agree++;
    if (r1.band.length > 1) bandMulti++;
  }
  /* 均值榜噪声（精确）：每枚在该 k 的**全部**子集上的均值取 max−min ⇒ 再对候选取 p50/p90。
   *   旧文档这一列是无种子 400 次 MC 的内联脚本算的、脚本没落盘 ⇒ 这里用可复算的算法顶掉它（k=N 只有一个子集，极差恒 0，是方法假象不是"没噪声"）。 */
  const spread = PACKS.map(function (p) { let lo = Infinity, hi = -Infinity;
    for (const sb of combos) { let s = 0; for (const b of sb) s += M[p][b]; const m = s / sb.length; if (m < lo) lo = m; if (m > hi) hi = m; }
    return hi - lo; });
  console.log('  ' + String(k).padStart(3) + String(total).padStart(9) + '        ' +
    (100 * majOk / n).toFixed(1).padStart(6) + '%            ' + (100 * agree / n).toFixed(1).padStart(6) + '%            ' +
    (100 * bandMulti / n).toFixed(1).padStart(6) + '%          ' +
    q(spread, .5).toFixed(2).padStart(6) + 'pt   ' + q(spread, .9).toFixed(2).padStart(6) + 'pt        ' + k + '×');
}
console.log('\n   R1 的抽签面（只换 seedBase，' + BASE.length + ' 粒各出一个第一名）：' + BASE.map(electSingle).join(' ‖ '));
const distinct = [...new Set(BASE.map(electSingle))];
console.log('   ⇒ ' + BASE.length + ' 粒里出现 ' + distinct.length + ' 个不同当选者' + (distinct.length > 1 ? ' ⇒ **现状确实是抽签**（最多数的得票 ' + Math.max(...distinct.map(d => BASE.map(electSingle).filter(x => x === d).length)) + '/' + BASE.length + '）' : ' ⇒ 这一批不换人'));
