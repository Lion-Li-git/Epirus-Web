#!/usr/bin/env node
/* C1 的前置测量 · **出厂包在各"环境原型桌"上的基线，以及这份基线里有多少是在吃对手的确定性**（只读，不动 `js/**`）
 *
 * 为什么要单独一台（10-02 上午，接 DS 交接件 §10.2 把"对手池补环流桌"提为 C 档第一件）：
 *   DS 给的理由是"环流桌把跨回合经济变成胜负关键"——**这是断言，不是测量**（`ringspam` 从未进过池）。
 *   而本仓对"加一张新桌"有一个**已量过的反向风险**：§E191 的对手随机化剂量曲线上，把对手打乱到 p=0.8 时
 *   **+29~35pt 的搜索优势清零** ⇒ 桌面上看到的"强"，可能只是**吃脚本的确定性**。
 *   ⇒ 所以加桌之前必须先量两件事：**①出厂包在这张桌上到底赢多少；②把对手的确定性打乱之后还剩多少。**
 *
 * 判据（**跑之前写死**）：
 *   对每张桌印 `Δ = 夺冠率(p) − 夺冠率(p=0)`（同一批局种子 ⇒ 逐局配对），三向分开判：
 *   · Δ **明显为负**（`|Δ| > 3pt` 且 ±1.96σ 区间不含 0）⇒ 这张桌的"分数"**大半是脚本确定性**，
 *     直接进进化池会训出"吃环流脚本"的专家 ⇒ 必须**同时**把随机化包装进池（`randomize` 那层，随机流**不许抽 `state.rng`**，§E191 踩过）；
 *   · Δ **明显为正** ⇒ 原型脚本对手比随机对手**更难**，这张桌的分数不是靠吃确定性来的（对"跨回合经济"是好消息）；
 *   · 区间含 0 且最大 ±σ 粗于 3pt ⇒ **判不出**，本仓纪律不许把点估计写成方向（要加局：每格 ≥100 局才够判 3pt 这一档）。
 *   ⚠ 这一台量的是**基线**，不是"能力"；也**不是**"不同环境用不同策略"的证据（那要 §E184 那把尺）。
 *
 * 用法：node tools/probe-env-baseline.mjs [--envs=ringspam,mix,wall,antidef] [--p=0,0.4,0.8] [--games=200]
 *        [--seeds=3100,9200] [--temp=0.15] [--quiet]
 *   产品桌装配与 §E191/§E195/§E223 同一张：0 席人类形状 ‖ 1 席被测（出厂包）‖ 2/3 席该环境原型（可打乱）‖ 4 席关档冠军。
 */
import { sandbox, mulberry32, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
import { poolFromSpecs } from './regime-panel.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { loadPool, makeMimic } from './human-pool.mjs';
import { loadCardTable, breadth, defShare } from './log-reading.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['envs', 'p', 'games', 'seeds', 'temp', 'quiet'], 'probe-env-baseline');
const arg = (k, d) => { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); };
const SEEDS = String(arg('seeds', '3100,9200')).split(',').map(Number).filter(Boolean);
const GAMES = Math.max(1, Number(arg('games', 200)) || 200);
const PS = String(arg('p', '0,0.4,0.8')).split(',').map(Number).filter(x => !isNaN(x) && x >= 0 && x <= 1);
const TEMP = Number(arg('temp', 0.15));
const ENV_PICK = String(arg('envs', 'ringspam,mix,wall,antidef')).split(',').filter(Boolean);
if (!PS.length || PS.indexOf(0) < 0) { console.error('⛔ `--p` 必须含 0 档（它是所有 Δ 的参照）'); process.exit(4); }
const QUIET = argv.indexOf('--quiet') >= 0;
const N = 5, FOCUS = 1;

const W = sandbox(), S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
const params = (function () { const p = loadChamp(W, 'js/bundled-champion-3p.js'); return p && p.params ? p.params : p; })();
const { pool: POOL } = poolFromSpecs(B, OPP_SPECS);
const ENVS = ENV_PICK.map(n => { const q = POOL.find(z => z.name === n); if (!q) { console.error('⛔ 环境 `' + n + '` 不在原型池（可用：' + POOL.map(z => z.name).join(',') + '）'); process.exit(2); } return q; });
const HB = loadPool(W, 'human');
const CT = loadCardTable();
const mean = x => x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN;
const sd = x => { if (x.length < 2) return NaN; const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) * (b - m), 0) / (x.length - 1)); };
const ci = x => (x.length > 1 ? 1.96 * sd(x) / Math.sqrt(x.length) : NaN);

const AGG = {};
const aggOf = k => (AGG[k] = AGG[k] || { env: k.split('|')[0], p: Number(k.split('|')[1]), games: 0, win: 0, rounds: 0, acts: 0, oppActs: 0, overrode: 0, byCard: {}, hands: 0, perGame: [] });

/** 对手打乱包装：`p` = 以该概率改出一张**随机可负担卡**。
 *  ⚠ 必须走**独立随机流**：策略自己的温度采样也抽 `state.rng`（`policy.js` 那条），
 *    若这里也抽它，抬 p 会顺带挪动两臂自己的抽样位置 ⇒ 桌与桌之间不再同流（§E191 实测踩过）。 */
function randomize(sel, p, agg, ornd) {
  if (p <= 0) return function (state, pid, legal) { agg.oppActs++; return sel(state, pid, legal); };
  return function (state, pid, legal) {
    agg.oppActs++;
    if (ornd() < p) {
      const aff = (legal || []).filter(l => l.affordable);
      if (aff.length) { agg.overrode++; return aff[Math.floor(ornd() * aff.length)]; }
    }
    return sel(state, pid, legal);
  };
}

function playOne(env, p, g, seed, agg) {
  const rnd = mulberry32(seed + g * 7919 + env.name.length * 131);         /* 与 §E195/§E223 同一套局种子 */
  const ornd = mulberry32(((seed ^ 0x5f3759df) >>> 0) + g * 104729 + env.name.length * 131);
  const st = S.createState('multi', { next: rnd }, N);
  st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
  const mimic = makeMimic(W, HB, 'rand', function () { return st.rng.next(); });
  const focus = function (state, pid, legal) {
    const r = T.policyChooserN(params, TEMP)(state, pid, legal);
    if (r) { agg.acts++; const nm = CT.byKey[r.key]; if (!nm) { console.error('⛔ 技能键 `' + r.key + '` 不在规则表 `.key` 里 ⇒ 广度会静默漏数'); process.exit(3); } agg.byCard[nm] = (agg.byCard[nm] || 0) + 1; agg.hands++; }
    return r;
  };
  const wrapped = randomize(env.sel, p, agg, ornd);
  const champ = T.policyChooserN(params, TEMP);
  Play.autoGameN(st, [mimic, focus, wrapped, wrapped, champ]);
  const me = st.p[FOCUS];
  agg.games++;
  const won = (me && me.hp > 0 && st.p.every((q, i) => i === FOCUS || q.hp <= me.hp)) ? 1 : 0;
  if (won) agg.win++;
  agg.rounds += st.round;
  agg.perGame.push({ env: env.name, g: g, won: won });
}

if (!QUIET) {
  console.log('# C1 前置 · 出厂包在各原型桌上的基线，以及打乱对手确定性之后剩多少');
  console.log('# ' + ENVS.map(e => e.name).join(' ‖ ') + ' ‖ p = ' + PS.join('/') + ' ‖ ' + GAMES + ' 局/格 × ' + SEEDS.length + ' 带（同一批局种子 ⇒ 与 p=0 逐局配对）‖ 被测席 = `policyChooserN(现役包, ' + TEMP + ')`');
  console.log('# 判据（跑前写死）：|Δ(p) − Δ(0)| ≤ 3pt ⇒ 这张桌不靠确定性；Δ 明显为负 ⇒ 分数大半是脚本确定性，进池必须同带随机化。');
}
for (const env of ENVS) for (const p of PS) for (const seed of SEEDS) {
  const agg = aggOf(env.name + '|' + p);
  for (let g = 0; g < GAMES; g++) playOne(env, p, g, seed, agg);
  process.stdout.write('|');
}
process.stdout.write('\n');

const A = (env, p) => AGG[env + '|' + p];
const w = a => 100 * a.win / Math.max(1, a.games);
const PERCELL = GAMES * SEEDS.length;
console.log('\n## 逐桌基线（夺冠 %，逐局同种子 ‖ 括号 = 实际打乱率 ‖ 广度走 `log-reading.breadth()` 那份唯一实现）');
console.log('| 桌 | ' + PS.map(p => 'p=' + p).join(' | ') + ' | 局长(p=0) | 种数 | `G` | 防御 % |');
console.log('|---|' + Array.from({ length: PS.length + 4 }, () => '---').join('|') + '|');
for (const env of ENVS) {
  const a0 = A(env.name, 0), B0 = breadth(a0.byCard, a0.hands), D = defShare(a0, CT);
  const eff = p => 100 * A(env.name, p).overrode / Math.max(1, A(env.name, p).oppActs);
  const cells = PS.map(p => { const a = A(env.name, p); return '**' + w(a).toFixed(1) + '%**（±' + (100 * ci(a.perGame.map(x => x.won))).toFixed(1) + 'pt ‖ 打乱 ' + eff(p).toFixed(0) + '%）'; });
  console.log('| `' + env.name + '` | ' + cells.join(' | ') + ' | ' + (a0.rounds / Math.max(1, a0.games)).toFixed(1) + ' | ' + B0.kinds + ' | ' + B0.G.toFixed(2) + ' | ' + D.share.toFixed(1) + '% |');
}
console.log('\n## 配对差 Δ = 夺冠率(p) − 夺冠率(p=0)（pt ‖ 逐局配对，两带合并）');
console.log('分辨率：每格 ' + PERCELL + ' 局 ‖ 判据要用的是 3pt ⇒ ' + (PERCELL < 100 ? '**⛔ 每格不足 100 局，下面的"结论"一律按"判不出"读，不许引**' : '够判 3pt 这一档（每格 Δ 的 ±1.96σ 约 ' + (1.96 * 50 / Math.sqrt(PERCELL)).toFixed(1) + 'pt @p≈0.5）') + '；符号只在区间不含 0 时才可引（本仓纪律）。');
console.log('| 桌 | ' + PS.slice(1).map(x => 'Δ@p=' + x).join(' | ') + ' | 结论 |');
console.log('|---|' + Array.from({ length: PS.length }, () => '---').join('|') + '|');
for (const env of ENVS) {
  const a0 = A(env.name, 0);
  const cells = [], ds = [];
  for (const p of PS.slice(1)) {
    const a = A(env.name, p);
    const d = a0.perGame.map((x, i) => a.perGame[i].won - x.won);
    ds.push({ p: p, m: 100 * mean(d), ci: 100 * ci(d) });
    cells.push((100 * mean(d) >= 0 ? '+' : '') + (100 * mean(d)).toFixed(1) + ' ±' + (100 * ci(d)).toFixed(1));
  }
  /* 三个方向分开判：只有"为负且区间不含 0"才是"吃确定性"；为正说明脚本对手比随机对手更难；
     区间含 0 时**不许**按点估计定符号，先看分辨率够不够 3pt 这一档。 */
  const negL = ds.filter(x => x.m + x.ci < 0 && x.m < -3);
  const posL = ds.filter(x => x.m - x.ci > 0);
  const neg = negL.length ? negL.reduce((x, y) => (y.m < x.m ? y : x)) : null;
  const pos = posL.length ? posL.reduce((x, y) => (y.m > x.m ? y : x)) : null;
  const fine = Math.max.apply(null, ds.map(x => x.ci));
  let verdict;
  if (neg) verdict = '**⚠ 吃确定性**：打乱到 p=' + neg.p + ' 掉 ' + Math.abs(neg.m).toFixed(1) + ' ±' + neg.ci.toFixed(1) + 'pt（区间不含 0 且超过 3pt）⇒ 进池必须同带随机化';
  else if (pos && pos.m - pos.ci > 0) verdict = '打乱反而**抬**夺冠率 +' + pos.m.toFixed(1) + ' ±' + pos.ci.toFixed(1) + 'pt @p=' + pos.p + ' ⇒ 环流/原型脚本对手比随机对手更难，这张桌的分数**不是**靠确定性';
  else if (fine > 3) verdict = '判不出：Δ 的最大区间 ±' + fine.toFixed(1) + 'pt 粗于 3pt 阈值 ⇒ 要加局，不许写成"靠/不靠确定性"';
  else verdict = '不靠确定性（各档 |Δ| ≤ 3pt 且区间含 0）';
  console.log('| `' + env.name + '` | ' + cells.join(' | ') + ' | ' + verdict + ' |');
}
let leak = [];
for (const env of ENVS) { if (A(env.name, 0).overrode !== 0) leak.push(env.name + '：p=0 档发生了 ' + A(env.name, 0).overrode + ' 次打乱 ⇒ 包装漏了，端点不可比'); }
console.log('\n## 自检');
console.log(leak.length ? '⛔ ' + leak.join('\n⛔ ') : '✔ p=0 端点未被扰动（所有 Δ 的参照是干净的）');
for (const env of ENVS) { const a = A(env.name, 0); if (a.acts / Math.max(1, a.games) < 6) console.log('⛔ `' + env.name + '` 每局出手 ' + (a.acts / a.games).toFixed(1) + ' < 6 ⇒ 桌没跑起来'); }
console.log('  ‖ 每格局数 ' + (GAMES * SEEDS.length) + ' ‖ 被打乱的席 = 2/3 号（环境原型），0 席人类形状与 4 席关档冠军不动');
console.log('\n## 复跑命令\n  node tools/probe-env-baseline.mjs --envs=' + ENV_PICK.join(',') + ' --p=' + PS.join(',') + ' --games=' + GAMES + ' --seeds=' + SEEDS.join(','));
console.log('rc=0');
