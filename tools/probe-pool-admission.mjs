#!/usr/bin/env node
/* 新桌进池**体检**（只读，不动 `js/**` ‖ 10-02 午班，接 §E224 的 C1 前置 + DS 交接件 §10.2 的 C1）
 *
 * 这台仪器回答的是**考场**那一侧的问题，不是"AI 变强了没有"：
 *   「把一张新的环境原型桌加进对手池，到底**多考了东西**，还是只是把同一张考卷复印了一遍？」
 * 为什么现在要做（§E224/§E225 之后的走向）：学习侧六条便宜路全部实测关闭，而**剩下的那一格需要一个能区分
 * "随环境换策略"的考场**——现在的桌太像，任何一张桌的胜负都能被别的桌预测（这是我今天要量的东西之一）。
 *
 * 三条读数（每桌各一列）：
 *  ① **电平**：出厂包（贪心 ‖ temp=0.15 两臂）在这张桌上的夺冠率 ⇒ 有没有可用的区分区间（贴着 0 或 100 都没信息）。
 *  ② **抗确定性**：`Δ = 电平(p=0.8) − 电平(p=0)`（只打乱 2/3 号席、**独立随机流**，§E191 那条不许抽 `state.rng`）。
 *     ⇒ §E224 实测：四张桌 12 格里 0 格显著为负 ⇒ **level 不吃确定性**；但 **gap 吃**（§E191）⇒ 这一档只排除"桌本身是脚本送分题"。
 *  ③ **区分度 + 冗余度（本班的新东西）**：拿一组**参照策略**（贪心包 ‖ 采样包 ‖ 只会攒钱的 ‖ 只会花光的 ‖
 *     只会防的 ‖ 只会打的）在每张桌上各跑一遍。
 *     · `spread = max − min`（这桌**考不考得出差别**：≈0 ⇒ 谁上来都一样 ⇒ 加它没信息）；
 *     · 桌与桌之间比**参照策略的名次**（Spearman ρ）⇒ `ρ 高 = 同一张考卷复印一遍`，`ρ 低 = 考的东西不同`。
 *
 * 判据（**跑之前写死**，`--verdict` 印）：一张桌值得进池 =
 *   **A. `spread ≥ 15pt`**（考得出差别）**且** **B. 与任意一张现有桌的 ρ ≤ 0.6**（不冗余）**且**
 *   **C. `Δ(p=0.8)` 不显著为负**（不是吃脚本确定性的送分桌）。
 *   ⚠ 三条是**合取**；任何一条不过就只能写"这张桌可以当**训练对手**，但当不了**考场**"。
 *   ⚠ B 里的"现有桌"= 本次一起跑的那些桌（默认 = 整个 `OPP_SPECS` 原型池）⇒ 不对外宣称谁在池里。
 *
 * 用法：node tools/probe-pool-admission.mjs [--envs=all|逗号名单] [--refs=packG,packT,saver,spender,defSpam,atkSpam]
 *        [--games=100] [--seeds=3100] [--p=0,0.8] [--temp=0.15] [--quiet] [--verdict]
 */
import { sandbox, mulberry32, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
import { poolFromSpecs } from './regime-panel.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { loadPool, makeMimic } from './human-pool.mjs';
import { loadCardTable } from './log-reading.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['envs', 'refs', 'games', 'seeds', 'p', 'temp', 'quiet', 'verdict', 'oppTrace', 'econ', 'econB'], 'probe-pool-admission');
const arg = (k, d) => { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); };
const GAMES = Math.max(1, Number(arg('games', 100)) || 100);
const SEEDS = String(arg('seeds', '3100')).split(',').map(Number).filter(Boolean);
const PS = String(arg('p', '0,0.8')).split(',').map(Number).filter(x => !isNaN(x) && x >= 0 && x <= 1);
const TEMP = Number(arg('temp', 0.15));
const REFS = String(arg('refs', 'packG,packT,saver,spender,defSpam,atkSpam')).split(',').filter(Boolean);
const QUIET = argv.indexOf('--quiet') >= 0;
const VERDICT = argv.indexOf('--verdict') >= 0;
const OPPTRACE = argv.indexOf('--oppTrace') >= 0;      /* 默认关：关着时这台仪器的读数与不打开**逐字相同**（只观察，不消耗随机流、不改返回值） */
/* 10-02（DS 交接件 §14 的三条跑前修正 · 用户裁定批）：`--econ` 默认关 ⇒ 关着时整台仪器与上一版**逐字相同**。
 *   · 主判据按 **<GAMES> 局/格**跑（预注册要求 800：200 局时配对 Δ ±10pt 正好等于"≥10pt"这条判据，是 1σ 位置）；
 *   · `--econB=` 给预注册里那条"**若判 (a) 才补 B∈{4,9} 敏感性**"用（默认走锚点 6，不改代码）；
 *   · §⑤ 另外印 **`packT` 自己的花费响应**（冠军在不在用这根轴）与**前置**（死线脚本活到 B 了没有、
 *     它有没有真的兑现过）—— 这两条不满足时**不许把结论写成 (a)**。 */
const ECON = argv.indexOf('--econ') >= 0;
const ECONB = Number(arg('econB', 6)) || 6;
if (PS.indexOf(0) < 0) { console.error('⛔ `--p` 必须含 0 档（Δ 的参照）'); process.exit(4); }
const N = 5, FOCUS = 1;
const T0 = Date.now();

const W = sandbox(), S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
if (ECON && typeof B.setEconB === 'function') B.setEconB(ECONB);
const params = (function () { const p = loadChamp(W, 'js/bundled-champion-3p.js'); return p && p.params ? p.params : p; })();
const { pool: POOL } = poolFromSpecs(B, OPP_SPECS);
const ENV_PICK = String(arg('envs', 'all'));
const ENVS = ENV_PICK === 'all' ? POOL.slice() : ENV_PICK.split(',').filter(Boolean).map(n => {
  const q = POOL.find(z => z.name === n); if (!q) { console.error('⛔ 环境 `' + n + '` 不在原型池（可用：' + POOL.map(z => z.name).join(',') + '）'); process.exit(2); } return q;
});
const HB = loadPool(W, 'human');
const CT = loadCardTable();
const COST = {}; for (const k in CT.RUL.skills) { const s = CT.RUL.skills[k]; if (s && s.key) COST[s.key] = s.cost || 0; }
const mean = x => x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN;
const sd = x => { if (x.length < 2) return NaN; const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) * (b - m), 0) / (x.length - 1)); };
const ci = x => (x.length > 1 ? 1.96 * sd(x) / Math.sqrt(x.length) * 100 : NaN);   /* 0/1 数组 ⇒ 直接就是百分点 */

/* ---------- 参照策略（全部只用 `legal` 里现成的字段 ⇒ 不碰 `js/**`，也不碰任何打分器） ----------
 *   攒钱/花光/只防/只打 这四枚是**故意笨**的探针：它们存在的目的不是赢，而是"把这张桌考什么**显出来**"。
 *   ⇒ 若某张桌上这四枚分数一样，那这张桌**考不出经济/攻防取向**，加它对考场没增益。 */
const aff = legal => (legal || []).filter(l => l.affordable);
const REF = {
  packG: () => T.policyChooserN(params, 0),
  packT: () => T.policyChooserN(params, TEMP),
  saver: () => (state, pid, legal) => { const a = aff(legal); if (!a.length) return null;
    let b = a[0]; for (let i = 1; i < a.length; i++) if (COST[a[i].key] < COST[b.key]) b = a[i]; return b; },
  spender: () => (state, pid, legal) => { const a = aff(legal); if (!a.length) return null;
    let b = a[0]; for (let i = 1; i < a.length; i++) if (COST[a[i].key] > COST[b.key]) b = a[i]; return b; },
  defSpam: () => (state, pid, legal) => { const a = aff(legal); if (!a.length) return null;
    const d = a.filter(x => CT.catByKey[x.key] === 'defense'); return d.length ? d[0] : a[0]; },
  atkSpam: () => (state, pid, legal) => { const a = aff(legal); if (!a.length) return null;
    const k = a.filter(x => CT.catByKey[x.key] === 'attack'); return k.length ? k[0] : a[0]; },
  /* 10-02（DS）：**"攒够就去买解"** —— `saver`/`spender` 这一对在这根轴上是**结构性瞎的**：
   * `saver` 只攒、从不买任何东西；`spender` 只花、从不留珠 ⇒ "**先攒后买解**"这条策略
   * **在两枚探针里都不存在**，于是 `saver − spender` 测不出经济轴，哪怕它真的存在。
   * 而"解"里**确实有一件贵货**：`避雷针`（`SK.ROD`，**4 珠**，`CAT.SPECIAL` 但功能是防御 ——
   * "当回合**雷系技能全部无效**，雷系使用者受 1 电伤并**回馈ジ**；否则 3 回合内免雷"），
   * 而规则表里有**结构化的雷系族** `LIGHTNING = [RAILGUN, MINI_T, BIG_T]`（`js/core/rules.js:104`），
   * `deadlineburst` 的爆发正是其中的 `BIG_T`（2 点 `DMG.ELECTRIC`）⇒ **"攒到 4 珠再买硬解"是可测的**。
   * ⚠️ 它**不在默认 `--refs` 里** ⇒ 默认输出与上一版仍然逐字相同（要用请显式 `--refs=` 带上它）。 */
  rodHold: () => (state, pid, legal) => { const a = aff(legal); if (!a.length) return null;
    const rod = a.filter(x => x.key === CT.RUL.SK.ROD);
    if (rod.length) return rod[0];                                   /* 攒够就买"对雷系硬解" */
    const ji = a.filter(x => x.key === CT.RUL.SK.JI);
    return ji.length ? ji[0] : null; }                               /* 否则攒钱 */
};
for (const r of REFS) if (!REF[r]) { console.error('⛔ 参照策略 `' + r + '` 不存在（可用：' + Object.keys(REF).join(',') + '）'); process.exit(3); }

/** 对手打乱包装（与 `probe-env-baseline` 同一口径：**独立随机流**，不许抽 `state.rng`，§E191）。
 *  `--oppTrace` 打开时顺手记 2/3 号席自己的花费轨迹（**默认关** ⇒ 关着时上面所有读数一字不动）：
 *  要回答的是"这张桌上那个'攒够才还手'的脚本，在 n=5 的产品装配里到底有没有活到它攒够那一天"
 *  ——门 L6 只断言**单决策**行为（`ep=5 ⇒ 打大雷`），那不等于**桌层级**真的存在经济压力。 */
function traceChoice(state, pid, r, agg) {
  if (!r) return;
  agg.oppSeen++;
  const ep = (state.p[pid] && state.p[pid].ep) || 0;
  agg.oppEpMax = Math.max(agg.oppEpMax || 0, ep);
  agg.oppEpSum += ep;
  const c = COST[r.key] || 0;
  if (c >= 4) { agg.oppBig++; if (agg.bigRound == null) agg.bigRound = state.round; }
}
function randomize(sel, p, agg, ornd, tr) {
  if (p <= 0) return function (state, pid, legal) { agg.oppActs++; const r = sel(state, pid, legal); if (tr) traceChoice(state, pid, r, agg); return r; };
  return function (state, pid, legal) {
    agg.oppActs++;
    if (ornd() < p) { const a = aff(legal); if (a.length) { agg.overrode++; const r = a[Math.floor(ornd() * a.length)]; if (tr) traceChoice(state, pid, r, agg); return r; } }
    const r = sel(state, pid, legal); if (tr) traceChoice(state, pid, r, agg); return r;
  };
}

const AGG = {};
const aggOf = k => (AGG[k] = AGG[k] || { env: '', ref: '', p: 0, games: 0, win: 0, rounds: 0, acts: 0, oppActs: 0, overrode: 0, noChoice: 0, epSum: 0, epN: 0, spendSum: 0, spendN: 0, perGame: [],
  oppSeen: 0, oppBig: 0, oppEpMax: 0, oppEpSum: 0, bigRound: null });
function playOne(env, refName, p, g, seed, agg) {
  const rnd = mulberry32(seed + g * 7919 + env.name.length * 131);
  const ornd = mulberry32(((seed ^ 0x5f3759df) >>> 0) + g * 104729 + env.name.length * 131);
  const st = S.createState('multi', { next: rnd }, N);
  st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3779b9) >>> 0;
  const mimic = makeMimic(W, HB, 'rand', function () { return st.rng.next(); });
  const own = REF[refName]();
  const focus = function (state, pid, legal) {
    const r = own(state, pid, legal);
    if (!r) { agg.noChoice++; return null; }
    agg.acts++; agg.epSum += (state.p[pid].ep || 0); agg.epN++;
    agg.spendSum += (COST[r.key] || 0); agg.spendN++;      /* §⑤ 的"冠军花费响应"：这一手按**卡面费用**花了几珠 */
    return r;
  };
  const wrapped = randomize(env.sel, p, agg, ornd, OPPTRACE ? traceChoice : null);
  Play.autoGameN(st, [mimic, focus, wrapped, wrapped, T.policyChooserN(params, TEMP)]);
  const me = st.p[FOCUS];
  const won = (me && me.hp > 0 && st.p.every((q, i) => i === FOCUS || q.hp <= me.hp)) ? 1 : 0;
  agg.games++; if (won) agg.win++;
  agg.rounds += st.round; agg.perGame.push(won);
}

if (!QUIET) {
  console.log('# 新桌进池体检（只读 ‖ 产品桌 n=5 ‖ 焦点席 1 号 ‖ 参照策略 ' + REFS.join('/') + ' ‖ p = ' + PS.join('/') + ' ‖ ' + GAMES + ' 局/格 × ' + SEEDS.length + ' 带 ‖ ' + ENVS.length + ' 桌）');
  console.log('# 判据（跑前写死，合取）：A `spread ≥ 15pt`（考得出差别）‖ B 与任意现有桌的参照名次 Spearman `ρ ≤ 0.6`（不冗余）‖ C `Δ(p=0.8)` 不显著为负（不吃脚本确定性）');
  console.log('#   任何一条不过 ⇒ 只许写"能当训练对手，当不了考场"。⚠ 这一台量的是**考卷性质**，不是 AI 的能力。');
}
for (const env of ENVS) for (const p of PS) for (const ref of REFS) for (const seed of SEEDS) {
  /* 只有 `packT` 需要跑 p>0（Δ 那一列）⇒ 其余参照策略只跑 p=0，整台仪器的局数从 `桌×指×p` 降到 `桌×指 + 桌×p` */
  if (p > 0 && ref !== 'packT') continue;
  const a = aggOf(env.name + '|' + ref + '|' + p); a.env = env.name; a.ref = ref; a.p = p;
  for (let g = 0; g < GAMES; g++) playOne(env, ref, p, g, seed, a);
  process.stdout.write('.');
}
process.stdout.write('\n');

const A = (e, r, p) => AGG[e + '|' + r + '|' + p];
const wr = a => 100 * a.win / Math.max(1, a.games);
const rank = (arr) => arr.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).map(x => x[1]);   /* 名次：0 = 最强 */
const spearman = (x, y) => {
  const n = x.length, rx = rank(x), ry = rank(y), mx = mean(rx), my = mean(ry);
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { a += (rx[i] - mx) * (ry[i] - my); b += (rx[i] - mx) ** 2; c += (ry[i] - my) ** 2; }
  return b && c ? a / Math.sqrt(b * c) : NaN;
};

console.log('\n## ① 逐桌体检（参照策略夺冠 %，p=0 ‖ 每格 ' + (GAMES * SEEDS.length) + ' 局）');
console.log('| 桌 | ' + REFS.join(' | ') + ' | `spread` | `Δ@0.8`（packT） | 与最不像的桌相距 ρ | `dev-ρ`† | 这张桌偏袒谁 | 体检 |');
console.log('|---|' + Array.from({ length: REFS.length + 6 }, () => '---').join('|') + '|');
const rows = [];
for (const env of ENVS) {
  const v = REFS.map(r => wr(A(env.name, r, 0)));
  const spread = Math.max.apply(null, v) - Math.min.apply(null, v);
  const a0 = A(env.name, 'packT', 0), a8 = A(env.name, 'packT', 0.8);
  const d = a0.perGame.map((x, i) => a8.perGame[i] - x);
  const dm = mean(d) * 100, dci = ci(d);
  /* ⚠ **判据 C 的实现纠偏（不是改阈值）**：跑前写死的是"Δ **不显著为负**"，显著 = 区间不含 0 ⇒ 应为 `dm + dci < 0`。
     我第一版写成 `dm − dci < 0 && dm < 0` —— 那会把 `-3.0 ±8.7`（区间含 0）也标成"显著为负"，
     是"永不反向的假守卫"那一族（口径陷阱第 34 条①：区间含 0 时符号不可引）。修完后重跑了一遍，局数/种子/桌一字未动。 */
  const sigNeg = (dm + dci) < 0;
  rows.push({ env: env.name, v: v, spread: spread, dm: dm, dci: dci, det: !sigNeg, sigNeg: sigNeg, vec: v });
}
/* 冗余度：桌与桌之间比**参照策略名次**（不比电平 ⇒ 一张整体更难但取向相同的桌，ρ 仍然高 = 复印卷） */
const rho = {};
for (const r of rows) { let best = -2, bestWith = '';
  for (const q of rows) { if (q === r) continue; const rr = spearman(r.vec, q.vec);
    if (rr > best) { best = rr; bestWith = q.env; } }
  rho[r.env] = { max: best, with: bestWith }; }
/* "这张桌偏袒谁"：把每个参照策略**跨桌平均**当基线，印在这张桌上超出自己平均最多的那一枚 ⇒
   绝对电平跨桌不可比（有的桌整体就是难），**偏离自己平均**才可跨桌比（§E187 那条"分母要同尺寸"的同一课）。 */
const refAvg = REFS.map((_, j) => mean(rows.map(r => r.v[j])));
const favors = rows.map(r => { let b = 0, bv = -1e9;
  for (let j = 0; j < REFS.length; j++) { const d = r.v[j] - refAvg[j]; if (d > bv) { bv = d; b = j; } }
  return { ref: REFS[b], dev: bv }; });
/* ⚠ **下面这一块是"探索性"的，不参与判据**（写在这里是因为判据 B 的原始形式有个我知道的缺陷：
   名次向量里有两枚探针（`saver` ‖ `spender`）在**所有桌上都≈0** ⇒ 头两名与末两名被常量钉死 ⇒ Spearman 被常量项抬高，
   于是"ρ 高"可能只是"常量位置一样"而不是"取向一样"。修法是比**偏离自己跨桌平均**的名次（把常量项减掉）。
   ⇒ 这一列印出来只为给下一轮提供原料；**要当判据必须先重新预注册**，本轮结论仍按跑前写死的 A/B/C 三条读。 */
const devV = rows.map(r => r.v.map((x, j) => x - refAvg[j]));
const devRho = rows.map((r, i) => { let best = -2, bw = '';
  for (let k = 0; k < rows.length; k++) { if (k === i) continue; const rr = spearman(devV[i], devV[k]); if (rr > best) { best = rr; bw = rows[k].env; } }
  return { max: best, with: bw }; });
for (let i = 0; i < rows.length; i++) {
  const r = rows[i], B_ = rho[r.env].max <= 0.6, A_ = r.spread >= 15, C_ = r.det;
  console.log('| `' + r.env + '` | ' + r.v.map(x => x.toFixed(1)).join(' | ') + ' | **' + r.spread.toFixed(1) + 'pt** | ' +
    (r.dm >= 0 ? '+' : '') + r.dm.toFixed(1) + ' ±' + r.dci.toFixed(1) + (r.sigNeg ? ' **（区间不含 0）**' : '（含 0）') + ' | ρ=' + rho[r.env].max.toFixed(2) + '（最像 `' + rho[r.env].with + '`） | ' +
    '`dev-ρ`=' + devRho[i].max.toFixed(2) + '（`' + devRho[i].with + '`）† | `' + favors[i].ref + '` +' + favors[i].dev.toFixed(1) + 'pt | ' +
    (A_ && B_ && C_ ? '**✔ 可进池（三条全过）**' : '✘ ' + [!A_ && 'A:区分度不足', !B_ && 'B:与 `' + rho[r.env].with + '` 冗余', !C_ && 'C:Δ 显著为负'].filter(Boolean).join(' ‖ ')) + ' |');
}
console.log('  ‖ † `dev-ρ` 是**探索列、不进判据**（比的是"偏离自己跨桌平均"的名次，剥掉两枚常量探针造成的假一致）');
console.log('  ‖ 参照策略的跨桌平均（"偏袒"那一列的基线）：' + REFS.map((n, j) => n + ' ' + refAvg[j].toFixed(1) + '%').join(' ‖ '));
if (VERDICT) {
  const ok = rows.filter(r => r.spread >= 15 && rho[r.env].max <= 0.6 && r.det);
  console.log('\n## ② 判据结论（合取三条，跑前写死）');
  console.log('  ‖ 过了的桌：' + (ok.length ? ok.map(r => '`' + r.env + '`').join(' ') : '**一张都没有**'));
  console.log('  ‖ 区分度不足（spread < 15pt）：' + rows.filter(r => r.spread < 15).map(r => '`' + r.env + '` ' + r.spread.toFixed(0)).join(' ‖ '));
  console.log('  ‖ 冗余（ρ > 0.6）：' + rows.filter(r => rho[r.env].max > 0.6).map(r => '`' + r.env + '`↔`' + rho[r.env].with + '` ' + rho[r.env].max.toFixed(2)).join(' ‖ '));
  console.log('  ‖ 抗确定性不过（Δ 显著为负）：' + rows.filter(r => !r.det).map(r => '`' + r.env + '` ' + r.dm.toFixed(1)).join(' ‖ '));
}
console.log('\n## ③ 自检');
/* 局数与耗时印出来（今天上午我自己就是因为不知道"这桌到底跑了多久"而起了一次假警报：
   拿"约 50ms/局"的印象去对 6ms/局的实测 ⇒ 怀疑仪器空转。心跳列对了，但**耗时本身也该是可审计的读数**。） */
{ let g = 0, act = 0; for (const k in AGG) { g += AGG[k].games; act += AGG[k].acts; }
  console.log('  ‖ 合计 **' + g + ' 局**（' + (g * (Date.now() - T0) / 1000).toFixed(0) + ' ms 总时长 ‖ 实测 ' + ((Date.now() - T0) / 1000).toFixed(1) + 's ‖ ' + (g / Math.max(1, (Date.now() - T0) / 1000)).toFixed(0) + ' 局/秒 ‖ 每局出手 ' + (act / Math.max(1, g)).toFixed(1) + '）'); }
let bad = [];
for (const env of ENVS) if (A(env.name, 'packT', 0).overrode !== 0) bad.push(env.name + '：p=0 档发生了 ' + A(env.name, 'packT', 0).overrode + ' 次打乱 ⇒ 参照不可比');
console.log(bad.length ? '⛔ ' + bad.join('\n⛔ ') : '✔ p=0 端点未被扰动');
for (const env of ENVS) for (const r of REFS) { const a = A(env.name, r, 0);
  if (100 * a.noChoice / Math.max(1, a.acts + a.noChoice) > 30) console.log('⚠ `' + env.name + '` × `' + r + '` 有 ' + (100 * a.noChoice / (a.acts + a.noChoice)).toFixed(0) + '% 的决策**没得选** ⇒ 这张桌对它近乎无解（区分度读数要按这个折）'); }
console.log('  ‖ 决策时 ep 均值（p=0）：' + REFS.map(r => r + ' ' + mean(ENVS.map(e => A(e.name, r, 0).epSum / Math.max(1, A(e.name, r, 0).epN))).toFixed(1)).join(' ‖ '));
/* ⚠ **这一列是这台仪器的"心跳"**：参照策略如果压根不出手 / 局如果一两回合就结束，上面整张表（区分度、ρ、偏袒）全是废数。
   出厂参照有已知的产品桌读数可以对照：§E223 四带 `packT` 局长 **26.0**、每局出手 **16.9** ⇒ 这两列对不上就说明装配错了。 */
console.log('  ‖ 心跳（局长 ‖ 每局出手，p=0，跨桌平均 ‖ 已知参照：§E223 的 `packT` = 26.0 ‖ 16.9）：' +
  REFS.map(r => { const a = { rounds: 0, games: 0, acts: 0 };
    for (const e of ENVS) { const x = A(e.name, r, 0); a.rounds += x.rounds; a.games += x.games; a.acts += x.acts; }
    return r + ' ' + (a.rounds / Math.max(1, a.games)).toFixed(1) + ' ‖ ' + (a.acts / Math.max(1, a.games)).toFixed(1); }).join(' ‖ '));
for (const r of REFS) { let g = 0, act = 0; for (const e of ENVS) { const x = A(e.name, r, 0); g += x.games; act += x.acts; }
  if (act / Math.max(1, g) < 4) console.log('⛔ 参照 `' + r + '` 每局出手 ' + (act / Math.max(1, g)).toFixed(1) + ' < 4 ⇒ 桌没跑起来，整张表作废（不许引区分度/ρ/偏袒任何一列）'); }
console.log('  ‖ ⚠ 参照策略是**故意笨**的探针，分数本身不是能力读数；看的是**同一组探针在不同桌上的名次差**');
if (OPPTRACE) {
  console.log('\n## ④ `--oppTrace`：2/3 号席（该桌原型）**自己**的经济轨迹（要回答"这张桌到底存不存在经济压力"，而不是猜）');
  console.log('| 桌 | 对手决策数 | 打出 `费用 ≥ 4` 的比例 | 首次 ≥4 的回合（中位） | 对手 ep 峰值均值 | 对手 ep 均值 |');
  console.log('|---|---|---|---|---|---|');
  for (const env of ENVS) {
    let seen = 0, big = 0, epMax = 0, epSum = 0, epN = 0; const rounds = [];
    for (const r of REFS) for (const p of PS) { const a = A(env.name, r, p); if (!a) continue;
      seen += a.oppSeen || 0; big += a.oppBig || 0; epMax = Math.max(epMax, a.oppEpMax || 0); epSum += a.oppEpSum || 0; epN += a.oppSeen || 0;
      if (a.bigRound != null) rounds.push(a.bigRound); }
    rounds.sort((x, y) => x - y);
    console.log('| `' + env.name + '` | ' + seen + ' | **' + (100 * big / Math.max(1, seen)).toFixed(1) + '%** | ' +
      (rounds.length ? rounds[Math.floor(rounds.length / 2)] : '（从没打过）') + ' | ' + epMax.toFixed(0) + ' 珠 | ' + (epSum / Math.max(1, epN)).toFixed(2) + ' 珠 |');
  }
  console.log('  ‖ ⚠ `首次 ≥4 的回合` 取的是**每（桌×探针×p）格第一次**出现的那一手，不是每局第一次 ⇒ 只用来横向比"这张桌的脚本多久才舍得花"');
  console.log('  ‖ 这一节改变不了上面任何判据：它只观察，不消耗 `state.rng`、不改返回值（关掉时整台仪器与不打开**逐字相同**）');
}
if (ECON) {
  const PAIR = ['deadlineburst', 'earlypressure'];
  const ECON_BV = (typeof B.getEconB === 'function') ? B.getEconB() : 6;
  console.log('\n## ⑤ 经济轴裁决（`--econ` ‖ 判据**跑前写死**：主判据 = `|saver − spender| ≥ 10pt` **且两桌符号相反**；' +
    '次判据 = `Δ(p=0.8)` 不显著为负；另有 §① 的 `dev-ρ ≤ 0.6` 与 `packT` 电平 10~40%）');
  console.log('  ‖ 死线爆发回合 `ECON_B` = **' + ECON_BV + '**（`--econB=` 只给"若判 (a) 才补 B∈{4,9} 敏感性"用；默认走实测锚点 6）');
  console.log('  ‖ ⚠ 分辨率：每桌 `saver`/`spender` 各 ' + (GAMES * SEEDS.length) + ' 局 ⇒ 配对 Δ ≈ ±' +
    (98 / Math.sqrt(Math.max(1, GAMES * SEEDS.length))).toFixed(1) + 'pt（配对口径 ≈ `98/√n` pt；**这就是判据 ≥10pt 的分辨率**：'
    + (GAMES * SEEDS.length < 600 ? '⛔ 不足 600 局 ⇒ 判据正好落在 1σ，**不许据此写结论**（预注册要求 800 局/格）' : '✔ 够') + '）');
  const sep = {};
  for (const n of PAIR) {
    if (!ENVS.some(function (e) { return e.name === n; })) {
      console.log('  ⛔ `' + n + '` 不在本次 `--envs` 里 ⇒ 该桌无读数（用 `--envs=' + PAIR.join(',') + ',<其它桌>` 带上它）'); continue;
    }
    const As = A(n, 'saver', 0), Bs = A(n, 'spender', 0), a0 = A(n, 'packT', 0);
    const d = As.perGame.map(function (x, i) { return x - Bs.perGame[i]; });
    const dm = mean(d) * 100, dci = ci(d);
    sep[n] = { dm: dm, dci: dci, lvl: wr(a0), spend: a0.spendSum / Math.max(1, a0.spendN),
      rounds: a0.rounds / Math.max(1, a0.games), big: (a0.oppBig || 0) / Math.max(1, a0.oppSeen || 0) };
    console.log('  · `' + n + '`：`saver` ' + wr(As).toFixed(1) + '% ‖ `spender` ' + wr(Bs).toFixed(1) + '% ⇒ **' +
      (dm >= 0 ? '+' : '') + dm.toFixed(1) + ' ±' + dci.toFixed(1) + 'pt**（逐局配对 ' + d.length + ' 局）' +
      ' ‖ `packT` 电平 **' + sep[n].lvl.toFixed(1) + '%**' + (sep[n].lvl >= 10 && sep[n].lvl <= 40 ? ' ✔（10~40%）' : ' ⛔（要 10~40%，否则"考不了"或"没威胁"）'));
  }
  const sA = sep[PAIR[0]], sB = sep[PAIR[1]];
  if (sA && sB) {
    const big = Math.abs(sA.dm) >= 10 && Math.abs(sB.dm) >= 10;
    const opp = (sA.dm > 0) !== (sB.dm > 0);
    console.log('  ⇒ **主判据**：两桌都 ≥10pt（' + (big ? '✔' : '✘') + '）且符号相反（' + (opp ? '✔' : '✘') + '）⇒ ' +
      (big && opp ? '**轴造出来了**（可进评估池；要不要进进化池另裁）'
        : (big ? '**分离了但同向 ⇒ 半成品**（按 §3 判伪轴/半成品，只留分离的那张当经济探针桌）'
          : '**两桌都不分离 ⇒ 结局 (a) 的形状**（⚠️ 但 (a) 是强结论，必须先过下面两条前置 + 预注册里的 B∈{4,9} 敏感性检查）')));
  }
  console.log('  ‖ **前置（任一不过 ⇒ 不许写 (a)）**：');
  for (const n of PAIR) { const s = sep[n]; if (!s) continue;
    console.log('    · `' + n + '` 平均局长 **' + s.rounds.toFixed(1) + '** 回合 ⇒ ' +
      (n === 'deadlineburst' ? (s.rounds >= ECON_BV ? '✔ 到得了死线' : '⛔ **到不了死线（<' + ECON_BV + '）⇒ 这根轴在这张桌上"未定义"，不是"不存在"**')
        : '（早压不需要死线）') +
      (OPPTRACE ? ' ‖ 该桌原型打出 ≥4 费的比例 **' + (100 * s.big).toFixed(1) + '%** ⇒ ' + (s.big > 0 ? '✔ 兑现源存在' : '⛔ **从未兑现 ⇒ 惩罚源不存在**')
        : '（要看"兑现源真的存在吗"请加 `--oppTrace`）'));
  }
  if (sA && sB) {
    console.log('  ‖ 冠军自己的**花费响应**（`packT` 每手按卡面花几珠 ‖ 判读也跑前写死：**死线上该省、早压上该花**）：');
    console.log('    · `deadlineburst` **' + sA.spend.toFixed(2) + '** 珠/手 ‖ `earlypressure` **' + sB.spend.toFixed(2) +
      '** 珠/手 ⇒ 差 **' + (sB.spend - sA.spend >= 0 ? '+' : '') + (sB.spend - sA.spend).toFixed(2) + '**（正 = 它在死线上确实省了）');
    console.log('    ⚠ 这一列**不是判据**（判据只有跑前写死的那几条合取）：它把"轴建立了"升级成"**我们现在的冠军在不在用这根轴**"' +
      ' —— 若两桌花费不随桌变，即使轴造出来，头号目标在这一格上仍然是空的（那就是下一班的第一条读数）。');
  }
}
console.log('\n## 复跑命令\n  node tools/probe-pool-admission.mjs --envs=' + (ENV_PICK === 'all' ? 'all' : ENV_PICK) + ' --refs=' + REFS.join(',') + ' --games=' + GAMES + ' --seeds=' + SEEDS.join(',') + ' --p=' + PS.join(',') + (VERDICT ? ' --verdict' : '') + (OPPTRACE ? ' --oppTrace' : '') + (ECON ? ' --econ --econB=' + ECONB : ''));
console.log('rc=0');
