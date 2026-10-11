/* §E587 否决线研究：`任一格 ≥T pt 且两批同号` 这条线（§E531）到底钉在哪、几档、档怎么选
 *
 * 为什么要单独做（用户 10-11 裁"研究一下这个"）：§E583 把一个硬事实摆出来了 ——
 *   `v7beadseed-93` 在「重火力+反弹」上的五个独立档读数是 multi +17/+20/+19/+20/+20、long +15/+14/+19/+15/+12，
 *   **十个读数没有一个越过 20**，可"取 90211+90310 这一对就触发否决、取 90210+90211 就不触发"。
 *   ⇒ 同枚包同把尺，**换个档对就换判词**。这不是"要不要为它松绑"，是**这条线没有把自己声明成一个统计检验**。
 *
 * 本工具做三件事，全部只读已入库的人席表（不重跑任何仿真）：
 *   A 档对翻转率：一枚包有 K 个档时，C(K,2) 对里有多少对会触发否决 ⇒ 现状规则的不稳定性是**实测**的，不是猜的
 *   B 候选规则同台比：现状 / 单批 / 两批平均 / 多数表决 / 平均+下限 / 统计检验（族=12 格校正）
 *     每个规则报四个数：杀已知该杀的、放过现役（正对照）、总触发率、档对翻转率
 *   C 功效曲线（二项模型）：给定真差 d，各规则的触发概率 ⇒ 回答"线钉在哪、几档"该付多少代价
 *
 * 用法：node champion-map/vetoline.mjs [--games=200] [--alpha=0.05]
 * ⚠ 本工具**不改任何在册判据**（§E531 的 20pt 线由用户裁），它只把候选口径的代价量清楚。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildResolver, incumbentAt, resolveId } from './pack-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 200));
const CELLS = ['全程刷反弹', '全程只防御', '只攒不打(农民)', '只枪压制', '攒钱+反弹(会玩)', '重火力+反弹'];
const BASE = 'bundled-champion-3p';
const LINE = 20;                                   // §E531 在册线

function loadTables(files) {
  const g = new Map();                              // id|mode|cell -> {seed: value}
  for (const f of files) {
    if (!existsSync(join(HERE, f))) { console.error('⛔ 表不在：' + f); process.exit(2); }
    const L = readFileSync(join(HERE, f), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/).filter(l => l[0] !== '#');
    const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
    for (const l of L.slice(1)) {
      const r = l.split('\t');
      const id = r[h.id], mode = r[h.mode], seed = r[h.seed0];
      if (!id || !mode || !seed) continue;
      for (let i = 0; i < 6; i++) {
        const k = id + '|' + mode + '|' + CELLS[i];
        if (!g.has(k)) g.set(k, {});
        const v = Number(r[h[CELLS[i]]]);
        if (g.get(k)[seed] !== undefined && g.get(k)[seed] !== v) { console.error('⛔ 同键不同值 ' + k + ' seed ' + seed); process.exit(2); }
        g.get(k)[seed] = v;
      }
    }
  }
  return g;
}
const seedsOf = (g, id) => { const k = id + '|multi|' + CELLS[0]; return g.has(k) ? Object.keys(g.get(k)).sort() : []; };
const cellOf = (g, id, mode, cell) => g.get(id + '|' + mode + '|' + cell) || {};

/* 差值网格：候选 − 现役，按共同档对齐 */
function diffs(g, ids) {
  const out = [];
  for (const id of ids) {
    if (id === BASE) continue;
    for (const mode of ['multi', 'long']) for (const cell of CELLS) {
      const a = cellOf(g, id, mode, cell), b = cellOf(g, BASE, mode, cell);
      const seeds = Object.keys(a).filter(s => b[s] !== undefined).sort();
      if (!seeds.length) continue;
      out.push({ id, mode, cell, seeds, d: seeds.map(s => a[s] - b[s]), a, b });
    }
  }
  return out;
}

/* ---- 规则定义：输入一格的多档差值数组（按档序），返回该格是否"过线" ---- */
const RULES = {
  'R0 两档同号 ≥20（=现状，取前两档）': d => d.length >= 2 && d[0] >= LINE && d[1] >= LINE,
  'R1 单档 ≥20': d => d[0] >= LINE,
  'R2 两档平均 ≥20': d => d.length >= 2 && (d[0] + d[1]) / 2 >= LINE,
  'R3 三档里 ≥2 档 ≥20': d => d.slice(0, 3).filter(x => x >= LINE).length >= 2,
  'R4 两档平均 ≥15 且每档 ≥12': d => d.length >= 2 && (d[0] + d[1]) / 2 >= 15 && Math.min(d[0], d[1]) >= 12,
  'R5 两档同号 ≥15': d => d.length >= 2 && Math.min(...d.slice(0, 2)) >= 15,
};
/* R6/R7 是"把这条线声明成一个统计检验"的两种写法：
 *   对每一格做**单侧两比例 z 检验**（合池计数），族 = 6 格 × 2 口径 = **24 个检验** ⇒ Bonferroni α' = α/24
 *   R6 = 只看显著性；R7 = 显著性 **且** 合池差 ≥ FLOOR pt（效应量地板：显著但只有 3pt 的差不该杀包）
 * 这两个规则要的是"档数增加 ⇒ 检验变强"这种正确行为，而不是"挑哪一对档"决定判词。 */
const FLOOR = Number(arg('floor', 10));
function zTest(aCnt, bCnt, nA, nB) {                 // a=候选，b=现役；单侧 a>b
  const p1 = aCnt / nA, p0 = bCnt / nB, p = (aCnt + bCnt) / (nA + nB);
  const s = Math.sqrt(p * (1 - p) * (1 / nA + 1 / nB));
  return s === 0 ? 0 : (p1 - p0) / s;
}
const ZCRIT = { 0.05: 2.866, 0.01: 3.346 };         // 单侧 Bonferroni α/24
const RULES2 = { 'R6 每格单侧检验(α=.05/24)': 'R6', ['R7 检验显著 且 合池差≥' + FLOOR + 'pt']: 'R7' };
const RULE_TEST = Object.keys(RULES);

/* ---- A 档对翻转率（只算有 ≥4 档的格）---- */
function pairFlip(rows) {
  const perPack = {};
  for (const r of rows) {
    if (r.seeds.length < 4) continue;
    const n = r.seeds.length, pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push(r.d[i] >= LINE && r.d[j] >= LINE);
    const fire = pairs.filter(Boolean).length;
    const pack = r.id; (perPack[pack] = perPack[pack] || []).push({ 格: r.mode + '·' + r.cell, 档数: n, 对数: pairs.length, 触发对: fire, 全触发: fire === pairs.length, 零触发: fire === 0 });
  }
  return perPack;
}

/* ---- B 规则同台（在 2 档数据上评，与现状可比）+ 枚级翻转率 ---- */
function cellFires(r, name) {
  if (RULES[name]) return RULES[name](r.d);
  const nA = r.seeds.length * GAMES, nB = r.seeds.length * GAMES;
  const aCnt = r.seeds.reduce((s, k) => s + r.a[k] / 100 * GAMES, 0);
  const bCnt = r.seeds.reduce((s, k) => s + r.b[k] / 100 * GAMES, 0);
  const z = zTest(aCnt, bCnt, nA, nB);
  const pooled = (aCnt - bCnt) / nA * 100;
  if (name.startsWith('R6')) return z >= ZCRIT[0.05];
  if (name.startsWith('R7')) return z >= ZCRIT[0.05] && pooled >= FLOOR;
  return false;
}
function compare(g, ids, label, files, bandMin) {
  const rows = diffs(g, ids).filter(r => r.seeds.length >= 2);
  let byPack = {};
  for (const r of rows) (byPack[r.id] = byPack[r.id] || []).push(r);
  /* 带内限定：**候选级的人群**（Hp ≥ bandMin）才是要裁的对象；整框杀率高不等于刀快（§E579 那条：框是按行为最远点铺的，本来含弱包） */
  if (bandMin) { const keep = Object.keys(byPack).filter(id => (hpOf(id, files) || 0) >= bandMin); byPack = Object.fromEntries(keep.map(k => [k, byPack[k]])); }
  const names = Object.keys(RULES).concat(Object.keys(RULES2));
  console.log('\n===== B 规则同台 · ' + label + '（' + Object.keys(byPack).length + ' 枚 × 有 ≥2 档的格 ' + rows.length + ' 个）=====');
  console.log('规则'.padEnd(34) + '杀率(枚/总) | 触发格数 | 已知该杀');
  const knownBad = ['contX-201', 'G-s72'].filter(x => byPack[x]);
  /* 枚级翻转率 = **现状规则**的性质（任一格两档都 ≥20），与规则无关 ⇒ 只算一次，印在表头 */
  let flips = 0, pairsTot = 0; const flipWho = [];
  for (const id of Object.keys(byPack)) {
    const rs = byPack[id].filter(r => r.seeds.length >= 4);
    if (!rs.length) continue;
    const seeds = rs[0].seeds; const dec = [];
    for (let i = 0; i < seeds.length; i++) for (let j = i + 1; j < seeds.length; j++) {
      let any = false;
      for (const r of rs) if (r.d[r.seeds.indexOf(seeds[i])] >= LINE && r.d[r.seeds.indexOf(seeds[j])] >= LINE) any = true;
      dec.push(any);
    }
    pairsTot++; const f = dec.some(Boolean) && !dec.every(Boolean);
    if (f) { flips++; flipWho.push(id + ' ' + dec.filter(Boolean).length + '/' + dec.length + ' 对触发'); }
  }
  console.log('  现状规则的**枚级档对翻转率**：' + (pairsTot ? flips + '/' + pairsTot + ' 枚（' + (100 * flips / pairsTot).toFixed(0) + '%）会因挑哪一对档而改判词' + (flipWho.length ? ' ⇒ ' + flipWho.join(' ‖ ') : '') : '不足 4 档，算不了'));
  const out = {};
  for (const name of names) {
    const killed = new Set(); let cells = 0;
    for (const id of Object.keys(byPack)) {
      let veto = false;
      for (const r of byPack[id]) if (cellFires(r, name)) { veto = true; cells++; }
      if (veto) killed.add(id);
    }
    const badOK = knownBad.length ? knownBad.map(x => (killed.has(x) ? '✅' : '⛔')).join('') : '—';
    out[name] = { killed: killed.size, total: Object.keys(byPack).length, cells };
    console.log(name.padEnd(34) + String(killed.size + '/' + Object.keys(byPack).length).padEnd(13) + '| ' + String(cells).padStart(4) + '      | ' + badOK);
  }
  return out;
}

/* ---- C 功效曲线（二项模型 + 正态近似）----
 * 一档的差值 = 两个 200 局比例之差 ⇒ sd = sqrt(p1(1-p1)+p0(1-p0))·100/√GAMES
 * 「k 档里 ≥m 档过线」的概率 = 二项尾 Σ C(k,i) q^i (1−q)^(k−i)，q = 单档过线概率
 * ⚠ R4 的"平均过线 且 每档过下限"写成两者相乘是**近似**（两项正相关 ⇒ 真实值略高于乘积），曲线只用来比大小，不当精确 α 用。 */
function binomSd(p) { return Math.sqrt(p * (1 - p) / GAMES); }
function tail(mean, sd, x) { return 1 - 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2))); }   // P(X ≥ x)
function binomTail(m, k, q) { let s = 0; for (let i = m; i <= k; i++) { let c = 1; for (let j = 0; j < i; j++) c = c * (k - j) / (j + 1); s += c * Math.pow(q, i) * Math.pow(1 - q, k - i); } return s; }
function pFire(dTrue, p0, rule) {
  const p1 = Math.min(0.95, Math.max(0.005, p0 + dTrue / 100));
  const sd = Math.sqrt(binomSd(p1) ** 2 + binomSd(p0) ** 2) * 100;
  if (rule === 'R0') return Math.pow(tail(dTrue, sd, LINE), 2);
  if (rule === 'R1') return tail(dTrue, sd, LINE);
  if (rule === 'R2') return tail(dTrue, sd * Math.SQRT2, LINE);
  if (rule === 'R3') return binomTail(2, 3, tail(dTrue, sd, LINE));
  if (rule === 'R4') return tail(dTrue, sd * Math.SQRT2, 15) * Math.pow(tail(dTrue, sd, 12), 2);
  if (rule === 'R5') return Math.pow(tail(dTrue, sd, 15), 2);
  return NaN;
}
function erf(x) {   // Abramowitz-Stegun 7.1.26
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

/* ================= 跑 ================= */
const FRAME_A = ['seat-e584-90210.tsv', 'seat-e584-90211.tsv', 'seat-e585-90212.tsv', 'seat-e585-90213.tsv', 'seat-e585-90214.tsv', 'seat-e585-90215.tsv'];
const FRAME_B = ['seat-2026-10-11-90210.tsv', 'seat-2026-10-11-90211.tsv'];
const FRAME_C = ['seat-e586-90216.tsv', 'seat-e586-90217.tsv'];
/* FRAME_D = 争议那枚（`v7beadseed-93`）实际拥有的五个档散在四张表里：§E576 的两批 + §E583 的 90212 + §E560 的 90310/90420
 *   ⇒ 只有把它拼起来才能算"枚级档对翻转率"，而这正是裁②要的那个数 */
const FRAME_D = ['seat-2026-10-11-90210.tsv', 'seat-2026-10-11-90211.tsv', 'seat-2026-10-11-90212.tsv', 'seat-2026-10-09-90310.tsv', 'seat-2026-10-09-90420.tsv'];
/* Hp（页面分数）只用来划"候选级人群"，不参与任何规则的判定
 * ⚑ 键必须是 **coords 的 id**，而人席表打的是探针 id（basename 或路径派生）⇒ 必须走 path 列接回去（§E330 那条同一个洞） */
const HP = {};
const CROWS = [];
{
  const L = readFileSync(join(HERE, 'coords.tsv'), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
  const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
  for (const l of L.slice(1)) { const c = l.split('\t'); const id = c[h.id]; if (!id) continue; HP[id] = Number(c[h.Hp]); CROWS.push({ id, path: c[h.path] }); }
}
/* §E589：现役身份**按声明**认（`--incumbent=` 或 `slot-history.tsv`），不许按 path 猜——
 *   去重之后一个文件可被多行共享，而活槽自己会换主人（`seatassoc` 同一条）。 */
const ROOTD = join(HERE, '..');
const INCV = arg('incumbent', '') || incumbentAt(ROOTD, FRAME_A.concat(FRAME_B, FRAME_C, FRAME_D)).id;
if (!INCV) { const r = incumbentAt(ROOTD, FRAME_A.concat(FRAME_B, FRAME_C, FRAME_D)); console.error('⛔ ' + r.why); process.exit(2); }
const RS = buildResolver(ROOTD, CROWS, { incumbent: INCV });
function hpOf(probeId, files) {
  for (const f of files) {
    const L = readFileSync(join(HERE, f), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/).filter(l => l[0] !== '#');
    const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
    for (const l of L.slice(1)) { const c = l.split('\t'); if (c[h.id] === probeId) return HP[resolveId(RS, probeId, c[h.path]).id]; }
  }
  return HP[probeId];
}
const gA = loadTables(FRAME_A), gB = loadTables(FRAME_B), gC = loadTables(FRAME_C);
const idsOf = g => [...new Set([...g.keys()].map(k => k.split('|')[0]))];
const idsA = idsOf(gA), idsB = idsOf(gB), idsC = idsOf(gC);

console.log('===== A 档对翻转率（' + FRAME_A.length + ' 档 · 只算 ≥4 档的格）=====');
const rowsA = diffs(gA, idsA);
const flip = pairFlip(rowsA);
let unstablePacks = 0, totalPackCells = 0, mid = 0;
for (const [pack, list] of Object.entries(flip)) {
  const any = list.filter(x => !x.全触发 && !x.零触发);
  totalPackCells += list.length; mid += any.length;
  const 任一 = any.length > 0;
  if (任一) unstablePacks++;
  console.log('  ' + pack.padEnd(16) + ' 格 ' + String(list.length).padStart(2) + ' 个 ‖ 半开半闭的格 ' + any.length +
    (any.length ? ' ⇒ ' + any.map(x => x.格 + ' ' + x.触发对 + '/' + x.对数).join(' ‖ ') : '（全部一致）'));
}
console.log('  ⇒ 枚级：' + Object.keys(flip).length + ' 枚里有 ' + unstablePacks + ' 枚**至少一格会因换档对改判词** ‖ 格级 ' + mid + '/' + totalPackCells + ' 个格是"半开半闭"');

/* zTest 的手算自查（规矩 130）：基线取现役在该格的 6%（12/200），三个手推边界点
   候选 14% ⇒ p̂=26/400=0.10? 不，p̂=(28+12)/400=0.10，s=√(0.10·0.90·0.01)=0.03 ⇒ z=0.08/0.03=2.667 **低于**临界 2.866 ⇒ 不该触发
   候选 15% ⇒ p̂=(30+12)/400=0.105，s=√(0.105·0.895·0.01)=0.030651 ⇒ z=0.09/0.030651=2.936 **高于**临界 ⇒ 该触发
   候选 20% ⇒ p̂=0.13，s=0.033630 ⇒ z=4.163（明显该触发）
   ⇒ 自查必须是"一高一低"才有效：它顺带给出这条 α 定线在该基线下等于**约 9pt**，而不是 20pt */
console.log('\n# zTest 自查（基线 6% / 各 200 局 · 临界 ' + ZCRIT[0.05] + '）：' +
  [['14%', 28], ['15%', 30], ['20%', 40]].map(x => x[0] + '→z=' + zTest(x[1], 12, 200, 200).toFixed(3)).join(' ‖ ') +
  '（手算 2.667 / 2.936 / 4.163）');
const bB = compare(gB, idsB, '现状实际用的那批（25 枚框 · 2 档）', FRAME_B);
compare(gA, idsA, '新框（17 枚 · 取前两档 = 与现状同条件）', FRAME_A);
compare(gA, idsA, '新框 17 枚 · 只算 Hp≥40（候选级人群）', FRAME_A, 40);
compare(gC, idsC, '全新框（17 枚 · 新档 90216/90217）', FRAME_C);
compare(gC, idsC, '全新框 · 只算 Hp≥40', FRAME_C, 40);
const gD = loadTables(FRAME_D);
compare(gD, idsOf(gD), '争议那枚所在的框（5 档 · 90210/90211/90212/90310/90420）', FRAME_D);
compare(gD, idsOf(gD), '同上 · 只算 Hp≥40（候选级人群）', FRAME_D, 40);

console.log('\n===== C 功效曲线（二项模型 · ' + GAMES + ' 局/格 · 基线取该格现役实测水平）=====');
const p0 = {};
for (const mode of ['multi', 'long']) for (const cell of CELLS) {
  const v = cellOf(gA, BASE, mode, cell); const seeds = Object.keys(v);
  p0[mode + '·' + cell] = seeds.reduce((s, k) => s + v[k], 0) / seeds.length / 100;
}
console.log('真差 d(pt)'.padEnd(14) + ['R0 两档≥20', 'R1 单档≥20', 'R2 平均≥20', 'R3 三档≥2', 'R4 平均≥15+下限', 'R5 两档≥15'].map(x => x.padEnd(16)).join(''));
for (const d of [0, 5, 10, 15, 20, 25, 30]) {
  const p = p0['multi·重火力+反弹'];
  const line = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'].map(r => (100 * pFire(d, p, r)).toFixed(1) + '%').map(x => x.padEnd(16)).join('');
  console.log(('' + d).padEnd(14) + line + '   （基线该格 ' + (100 * p).toFixed(1) + '%）');
}
console.log('# 读法：d=0 那行就是**假杀率**（α 的实际大小），d=20 那行是"真差恰好等于线"时的检出概率 —— 现状规则两行都要看');

/* ---- (C 的自查 · 规矩 130) 正态近似 vs 蒙特卡洛：答案已知的那种对照才有资格画曲线 ---- */
{
  const N = Number(arg('mc', 400000));
  const seed = 20261011 >>> 0; let s = seed;
  const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const bin = (n, p) => { let k = 0; for (let i = 0; i < n; i++) if (rnd() < p) k++; return k; };
  const p = p0['multi·重火力+反弹'];
  for (const d of [0, 20]) {
    const p1 = Math.min(0.95, Math.max(0.005, p + d / 100));
    let one = 0, two = 0;
    for (let i = 0; i < N / 2; i++) {
      const a = (bin(GAMES, p1) - bin(GAMES, p)) * 100 / GAMES;
      const b = (bin(GAMES, p1) - bin(GAMES, p)) * 100 / GAMES;
      if (a >= LINE) one++;
      if (a >= LINE && b >= LINE) two++;
    }
    const half = N / 2;
    console.log('# 自查 d=' + d + '：单档 ≥20 蒙特卡洛 ' + (100 * one / half).toFixed(2) + '% vs 模型 ' + (100 * pFire(d, p, 'R1')).toFixed(2) + '%' +
      ' ‖ 两档都 ≥20 蒙卡 ' + (100 * two / half).toFixed(2) + '% vs 模型 ' + (100 * pFire(d, p, 'R0')).toFixed(2) + '%');
  }
}
