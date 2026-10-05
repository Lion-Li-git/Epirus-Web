/* §E316 · 量"当选键本身"的种子噪声
 *
 * 用法:
 *   node champion-map/evaln-noise.mjs <a.bak> [b.bak ...] [--n=5] [--games=20]
 *                                     [--bases=987654,987655,987656,987657,987658]
 *                                     [--sbseed=1] [--expect=<1st%>,<top2%>]
 *
 * 为什么要这一台仪器（§E315 ⑧ 的后续）：
 * 终局当选键不是 `trainFit`，而是 `tools/train-3p.mjs:1154` 的
 *   `sc = evalN(params, ALL_PAIRS, 20, N, 987654).firstRate + 0.5 * top2Rate`
 * —— **36** 个脚本对手对（C(9,2)，`POOL` 9 枚）× 每对 20 局、**seedBase 只有这一粒**。
 * §E314 量过"同枚包只换评估种子"的噪声（eval-5p 口径，p50 1.50 ‖ p90 3.70pt），
 * 但那是**另一台仪器**（5 人混席、每档更多局）。当选键的样本量只有 560 局，
 * 它的噪声必须**在它自己的口径上**量 —— 这正是 §E312 那条坑（离线扫描器 ≠ 页面）的反面教材用法。
 *
 * 于是本脚本只问两件事：
 *   ① 同一枚包、只换 seedBase，`sc` 摆多大？（"这把尺能不能分辨 0.03 的同分带"）
 *   ② 同一批候选、只换 seedBase，**当选者换人的频率**有多高？
 *
 * 口径纪律（跑前写死，不是事后挑读数）：
 *   - 沙箱启动**逐字照 `tools/train-3p.mjs`**：同一份 7 文件加载顺序、`sb.window = sb`、
 *     `__seedSandbox(sb, sbseed)`、`P.setRng(mulberry32(sbseed*7919+13))`；
 *     `ALL_PAIRS` 也是 train-3p:368 那 9 个 bot 的两两组合（**36 对** —— 不是我初稿写的 28，见下面 POOL 处的更正）。
 *   - ⚑ **对应性守卫**：`--expect=<1st>,<top2>` 给定真臂日志里的名人堂读数，
 *     只有**第一个包在 seedBase 987654 上的两个百分数与之逐字相等**才继续。
 *     对不上 ⇒ 这台脚本不是同一把尺，所有读数作废（§E312）。
 *   - 只读：不改 `tools/`、不改 `js/`、不 promote、不落盘任何 .bak。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const argv = process.argv.slice(2);
const FLAG = {};
const POS = [];
for (const a of argv) {
  if (a.startsWith('--')) { const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a); if (m) FLAG[m[1]] = m[2] === '' ? '1' : m[2]; }
  else POS.push(a);
}
const FILES = POS;
if (!FILES.length) { console.error('用法: node champion-map/evaln-noise.mjs <a.bak> [b.bak ...] [--n=5] [--bases=...]'); process.exit(2); }

const N = Number(FLAG.n || 5);
const GAMES = Number(FLAG.games || 20);
const SBSEED = Number(FLAG.sbseed || 1);
const BASES = String(FLAG.bases || '987654,987655,987656,987657,987658').split(',').map(Number);
if (BASES.length < 3) { console.error('⛔ --bases 至少要 3 粒，否则"种子噪声"无从谈起（只有一粒就是现状本身）'); process.exit(2); }

/* ===== 沙箱：逐字照 tools/train-3p.mjs 的启动（见文件头的口径纪律） ===== */
const sb = {
  console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN,
  parseInt, parseFloat, Float64Array, Date
};
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const P = sb.window.EpirusPolicy, T = sb.window.EpirusTrainer, Bots = sb.window.EpirusBots;

/* train-3p:291 的 `__seedSandbox` **逐字搬过来**（不是"等价重写"）：
 * 它用 `Object.create(Math)` 保留 `imul` 等等，而我第一版自己列了一张名单 ⇒ 立刻在
 * `evo.js:63 slotSaltFor` 的 `Math.imul` 上抛 TypeError —— 又一次 §E312：复刻仪器要搬代码，别照记忆重写。 */
function __seedSandbox(sbox, seed) {
  if (!seed) return;
  const M = Object.create(Math);
  let s = (seed >>> 0) || 1;
  M.random = function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  sbox.Math = M;
}
__seedSandbox(sb, SBSEED);
if (P.setRng && T.mulberry32) P.setRng(T.mulberry32(SBSEED * 7919 + 13));

/* train-3p:368 的 POOL（9 个 bot，顺序也必须一致：pair 索引决定谁坐哪席） */
const POOL = [Bots.pickRandom, Bots.pickAggro, Bots.pickDefend, Bots.pickBalanced,
              Bots.pickAntiDef, Bots.pickBreakDef, Bots.pickWall, Bots.pickMix, Bots.pickFarmer];
const ALL_PAIRS = [];
for (let a = 0; a < POOL.length; a++) for (let b = a + 1; b < POOL.length; b++) ALL_PAIRS.push([POOL[a], POOL[b]]);
/* ⚠ 9 个 bot ⇒ C(9,2) = **36** 对，而 `tools/train-3p.mjs:1130` 的注释与 `:1505` 的 banner 都写着"28 对"
 * （`:1505` 那个是**硬写进字符串的字面量**，不是从数组取的 ⇒ 它在给自己印一个错分母）。
 * 真臂日志印的是 `=== 名人堂验证（36 对 x 20 局）===`（2026-10-05 14:0x 实测 anchor.log），以**代码算出来的 36** 为准。 */
const WANT_PAIRS = Number(FLAG.pairs || 36);
if (ALL_PAIRS.length !== WANT_PAIRS) {
  console.error('⛔ 对手对数 = ' + ALL_PAIRS.length + '，与 --pairs=' + WANT_PAIRS + ' 不符 ⇒ 池子或组合方式变了，台子搭错');
  process.exit(2);
}

function loadParams(file) {
  const src = readFileSync(file, 'utf8');
  const mm = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!mm) { console.error('未找到 EPIRUS_CHAMPION_3P: ' + file); process.exit(1); }
  const metaM = src.match(/window\.EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/);
  const params = P.unpack(JSON.parse(mm[1]), true);
  if (!params) { console.error('unpack 拿到 null（维度/版本不兼容）: ' + file); process.exit(1); }
  return { params, meta: metaM ? JSON.parse(metaM[1]) : null };
}

const packs = FILES.map(function (f) {
  const L = loadParams(f);
  return { name: f.split(/[\\/]/).pop().replace(/\.bak$/, ''), params: L.params, meta: L.meta, sc: [] };
});
/* 榜是按名字建的 ⇒ 同名（不同目录下的同名 .bak）会静默并成一条。宁可拒跑。 */
(function () {
  const seen = {}, dup = [];
  for (const pk of packs) { if (seen[pk.name]) dup.push(pk.name); seen[pk.name] = 1; }
  if (dup.length) { console.error('⛔ 有同名候选（' + dup.join(', ') + '）⇒ 榜会静默合流，把路径改名或只传一份'); process.exit(2); }
})();

console.log('# 当选键种子噪声 · evalN(' + ALL_PAIRS.length + ' 对 × ' + GAMES + ' 局 × n=' + N + ') · seedBase ×' + BASES.length +
  ' ‖ 包 ×' + packs.length + ' ‖ 沙箱种子=' + SBSEED + ' ‖ 共 ' + (ALL_PAIRS.length * GAMES * BASES.length * packs.length) + ' 局');

const t0 = Date.now();
for (const pk of packs) {
  for (const base of BASES) {
    const v = T.evalN(pk.params, ALL_PAIRS, GAMES, N, base);
    pk.sc.push({ base, first: v.firstRate, top2: v.top2Rate, s: v.firstRate + 0.5 * v.top2Rate });
  }
}

/* ⚑ 对应性守卫：与真臂日志里的名人堂那一行比。
 * 日志那两个数是 `toFixed(1)` 印出来的 ⇒ 判据取"四舍五入到同一位后相等"（±0.05pt），
 * 不是假装精：720 局的仪器若不同，摆的是 1~6pt 这个量级，0.05pt 的窗口它逃不进。 */
if (FLAG.expect) {
  const e = String(FLAG.expect).split(',').map(Number);
  const g = packs[0].sc[0];
  const okFirst = Math.abs(g.first * 100 - e[0]) <= 0.05, okTop2 = Math.abs(g.top2 * 100 - e[1]) <= 0.05;
  console.log('# 守卫: ' + packs[0].name + ' @' + BASES[0] + ' ⇒ 1st=' + (g.first * 100).toFixed(4) + '% top2=' + (g.top2 * 100).toFixed(4) +
    '% ‖ 真臂日志 ' + e[0] + '/' + e[1] + ' ⇒ ' + (okFirst && okTop2 ? '✅ 同一把尺（落在打印位的同一格里）' : '⛔ 不是同一台仪器，读数作废'));
  if (!(okFirst && okTop2)) process.exit(3);
}

function pct(arr, p) { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; }

/* 原始读数落盘（`--dump=<路径>`）：docs/artifacts 被 gitignore ⇒ 建议直接写 champion-map/ 里，
 * 否则明天的复核只能重跑一遍这台仪器（§E313 那批就是这么栽过一次，才补了 `_e315-*.txt`）。 */
if (FLAG.dump) {
  const lines = ['pack\tbase\tfirst\ttop2\tsc'];
  for (const pk of packs) for (const o of pk.sc) {
    lines.push([pk.name, o.base, (o.first * 100).toFixed(4), (o.top2 * 100).toFixed(4), (o.s * 100).toFixed(4)].join('\t'));
  }
  writeFileSync(FLAG.dump, lines.join('\n') + '\n');
  console.log('# 原始读数已落盘: ' + FLAG.dump + '（' + (lines.length - 1) + ' 行）');
}

console.log('\n包'.padEnd(22) + BASES.map(function (b) { return String(b).slice(-4).padStart(7); }).join('') + '   极差(pt)  sc均值');
for (const pk of packs) {
  const ss = pk.sc.map(function (o) { return o.s; });
  const rg = (Math.max.apply(null, ss) - Math.min.apply(null, ss)) * 100;
  console.log(pk.name.padEnd(22) + pk.sc.map(function (o) { return (o.s * 100).toFixed(1).padStart(7); }).join('') +
    '   ' + rg.toFixed(2).padStart(6) + '  ' + (ss.reduce(function (a, b) { return a + b; }, 0) / ss.length * 100).toFixed(2));
}
const ranges = packs.map(function (pk) {
  const ss = pk.sc.map(function (o) { return o.s; });
  return (Math.max.apply(null, ss) - Math.min.apply(null, ss)) * 100;
});
console.log('\n⭐ sc 的种子极差（' + packs.length + ' 枚 · 每枚每粒 ' + (ALL_PAIRS.length * GAMES) + ' 局）: p50 ' + pct(ranges, 0.5).toFixed(2) +
  ' ‖ p90 ' + pct(ranges, 0.9).toFixed(2) + ' ‖ max ' + Math.max.apply(null, ranges).toFixed(2) + 'pt');
const medGap = (function () {
  const means = packs.map(function (pk) { return pk.sc.reduce(function (a, b) { return a + b.s; }, 0) / pk.sc.length; }).sort(function (a, b) { return b - a; });
  return (means[0] - means[1]) * 100;
})();
console.log('   参照：当选面的同分带容差 WR_TOL = 3.0pt（`pick-best.mjs` 带 = sc ≥ top − 0.03）‖ 这批里第 1 与第 2 名差 ' + medGap.toFixed(2) + 'pt');

/* ② 只换 seedBase，当选者换人的频率 */
const winners = packs.map(function (pk, i) { return i; });
const picks = BASES.map(function (b, bi) {
  let best = 0;
  for (const i of winners) if (packs[i].sc[bi].s > packs[best].sc[bi].s) best = i;
  return packs[best].name;
});
const distinct = picks.filter(function (v, i) { return picks.indexOf(v) === i; });
console.log('\n② 同批 ' + packs.length + ' 枚候选，只换 seedBase ⇒ 当选者: ' + picks.join(' ‖ '));
console.log('   ⇒ ' + BASES.length + ' 粒种子里出现 ' + distinct.length + ' 个不同的当选者' +
  (distinct.length === 1 ? '（这批上键是稳的）' : ' ⇒ **当选身份有 ' + ((distinct.length - 1) / BASES.length * 100).toFixed(0) + '% 是抽签**'));

/* 拆半稳定性：奇数位种子建的榜 vs 偶数位 */
const oddIdx = [], evenIdx = [];
BASES.forEach(function (b, i) { if (i % 2 === 0) oddIdx.push(i); else evenIdx.push(i); });
function meanSc(i, idxs) { return idxs.reduce(function (a, k) { return a + packs[i].sc[k].s; }, 0) / idxs.length; }
function rankOf(idxs) {
  const arr = packs.map(function (pk, i) { return { name: pk.name, v: meanSc(i, idxs) }; }).sort(function (a, b) { return b.v - a.v; });
  const r = {}; arr.forEach(function (o, k) { r[o.name] = k + 1; }); return r;
}
const ro = rankOf(oddIdx), re = rankOf(evenIdx);
const diffs = packs.map(function (pk) { return Math.abs(ro[pk.name] - re[pk.name]); });
/* 两半各自的榜要能并排看见，否则"0.00 位"这种结果无法复核（口径陷阱：多列表格取数必须带列名） */
function orderOf(idxs) {
  return packs.map(function (pk, i) { return { n: pk.name, v: meanSc(i, idxs) }; })
    .sort(function (a, b) { return b.v - a.v; })
    .map(function (o) { return o.n.replace(/^(e316anchor|eps[XPU]?)-?/, '') + '(' + o.v.toFixed(1) + ')'; }).join(' > ');
}
console.log('   奇数粒榜: ' + orderOf(oddIdx));
console.log('   偶数粒榜: ' + orderOf(evenIdx));
console.log('\n③ 拆半（' + oddIdx.length + ' 粒 vs ' + evenIdx.length + ' 粒）名次平均差 = ' +
  (diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length).toFixed(2) + ' 位（满榜 ' + packs.length + ' 位 ⇒ 随机水平约 ' + (packs.length / 3).toFixed(1) + ' 位）');

/* ④ 现状（只 987654 那一粒）vs 多种子取均值：名次相关 + 相邻对换次数 */
function rankFrom(vals) {
  const arr = packs.map(function (pk, i) { return { name: pk.name, v: vals[i] }; }).sort(function (a, b) { return b.v - a.v; });
  const r = {}; arr.forEach(function (o, k) { r[o.name] = k; }); return r;
}
const one = packs.map(function (pk) { return pk.sc[0].s; });
const mean = packs.map(function (pk) { return pk.sc.reduce(function (a, b) { return a + b.s; }, 0) / pk.sc.length; });
const rOne = rankFrom(one), rMean = rankFrom(mean);
const dd = packs.map(function (pk) { const d = rOne[pk.name] - rMean[pk.name]; return d * d; });
const rhoNum = 1 - (6 * dd.reduce(function (a, b) { return a + b; }, 0)) / (packs.length * (packs.length * packs.length - 1));
console.log('\n④ 现状那一粒 seedBase 的榜 vs ' + BASES.length + ' 粒取均值的榜：Spearman ρ = ' + rhoNum.toFixed(3) +
  ' ‖ 名次挪动 ≥1 位的候选 ' + packs.filter(function (pk) { return rOne[pk.name] !== rMean[pk.name]; }).length + '/' + packs.length);
const swaps = (function () {
  const o = packs.map(function (pk, i) { return { i: i, v: one[i] }; }).sort(function (a, b) { return b.v - a.v; });
  const posM = {};
  packs.map(function (pk, i) { return { i: i, v: mean[i] }; }).sort(function (a, b) { return b.v - a.v; })
    .forEach(function (x, k) { posM[x.i] = k; });
  let s = 0;
  for (let a = 0; a < o.length; a++) for (let b = a + 1; b < o.length; b++) if (posM[o[a].i] > posM[o[b].i]) s++;
  return s;
})();
console.log('   相邻序对翻转 ' + swaps + ' / ' + (packs.length * (packs.length - 1) / 2) + ' 对（这是"换种子会不会换榜"的直接计数）');
console.log('\n耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
