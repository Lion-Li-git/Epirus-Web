#!/usr/bin/env node
/* ============================================================================
 * probe-policy-diversity.mjs —— **"多策略 + 长经济"能不能同时要**（§E182）
 *
 * 头号目标是"训练出可以在不同环境下使用不同策略的 AI"。本班已经量到：
 *   §E179 加"对手信念维度"不值一次换代；§E180 现役包是**按形状变**的局面驱动（装配形状会翻转结论）；
 *   §E156~§E172 四剂药（深度 / 定价对象 / 平票规则 / 跨回合资源价）在**胜率**上全否。
 * 但那些药全都在回答"赢多少"，**没有一剂回答过两件事**：
 *   ① **多策略性**：它的手是否真的**随环境变**（而不是"一套手法打遍 33 种原型"）；
 *   ② **长经济**：跨回合的那套资源（聚能环链、珠的得-花闭环、局长）有没有活着。
 * ⇒ 这台仪器一次测两问：同一批臂、两套桌，把"多样性"与"经济"并排印出来，
 *   再和胜率放在一起 ⇒ 直接回答"新机制能不能做出更好的多策略且有长经济的 AI"。
 *
 * 三个口径全部**跑前定死**：
 *   多样性 `Div` = 12 个环境各自"我这一席出招分布"的**平均成对 JS 散度**（开方 → 与 KL 同量纲更好读）；
 *     ‖ 附带**胜率极差**（跨环境的 max−min）与**胜率标准差**：极差是"会看菜下饭"的另一面（也包含"在某些环境很烂"）。
 *   长经济 = `环链最长`（每局 max ringStreak 的均值）· `珠闭环率`（花掉的珠 / 得到的珠）· `珠过期/局` · `局长` · `峰值ep`。
 *     ⚠ 珠闭环率必须**双向**看（§E169 的教训：把"得珠"删光也能让"浪费率"变好 ⇒ 绿得没意义）。
 *   胜率 = 产品口径（`multi`，N=3 时我坐 0 席对 2 个环境席；N=5 时 4 个 AI 席对 1 个人类形状席 ⇒ 记"AI 平均名次"与"人类夺冠"）。
 *
 * ⚠ 三条防假读的设计（本仓反复踩过的形状）：
 *   1. **配对**：所有臂跑**同一批**（seed、环境、牌序）⇒ 只引配对差，不引跨臂点估计相减；
 *   2. **两批独立 seed 带**（§87）⇒ 任何一句"效应量"必须两批都站住才许写；
 *   3. **心跳**：出手分布不退化（每臂 ≥6 张不同卡）、信念表被问次数 > 0、`珠得 > 0` ⇒ 心跳不过 ⇒ 那一行的"多样性/经济"不算读数。
 *
 * 用法：node tools/probe-policy-diversity.mjs [--games=30] [--band=1|2|all] [--arms=a,b,c] [--n=3] [--json=…]
 * ==========================================================================*/
import { writeFileSync } from 'node:fs';
import { sandbox, rejectUnknownFlags, mulberry32, loadChamp } from './audit-lib.mjs';
import { poolFromSpecs } from './regime-panel.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { loadPool, makeMimic } from './human-pool.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };
rejectUnknownFlags(process.argv.slice(2), ['games', 'band', 'arms', 'n', 'json', 'quiet', 'perenv']);
const GAMES = Math.max(6, Number(arg('games', 30)) || 30);
const N3 = 3, N5 = 5;
const BANDS = arg('band', 'all') === 'all' ? [1, 2] : [Number(arg('band', 1))];
const SEED = { 1: 4100, 2: 21000 };                          // 两批独立 seed 带（§87）
const QUIET = process.argv.indexOf('--quiet') >= 0;

const W = sandbox(), R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
const params = (function () { const p = loadChamp(W, 'js/bundled-champion-3p.js'); return p && p.params ? p.params : p; })();
const { pool: POOL } = poolFromSpecs(B, OPP_SPECS);
const HB = loadPool(W, 'human');
/* 12 个环境：**点名**取（不随机、不模糊匹配 ⇒ 两批用同一组环境，配对才成立；缺一个就硬失败） */
const ENV_PICK = ['random', 'balanced', 'aggro', 'defend', 'wall', 'antidef', 'breakdef', 'mix', 'farmer', 'tankline', 'heavyfire', 'ringspam'];
const ENVS = ENV_PICK.map(n => { const p = POOL.find(q => q.name === n); if (!p) { console.error('⛔ 原型池里没有环境 `' + n + '`（可用：' + POOL.map(q => q.name).join(' ') + '）'); process.exit(2); } return p; });

/* ---- 臂：`ply:tgt:tie:bead:ring`，`seat` = 开几席（1 席走实例级工厂，不动模块档 ⇒ 与 §E157 难度表同形） ---- */
const ARMS = {
  A0: { name: '关档（现役出厂形状）', seats: 0, ply: 1, tgt: 0, tie: 0, bead: 0, ring: 0 },
  B1: { name: '开 1 席 · ply1 · tie0', seats: 1, ply: 1, tgt: 0, tie: 0, bead: 0, ring: 0 },
  B2: { name: '开 1 席 · ply2 · tie0', seats: 1, ply: 2, tgt: 0, tie: 0, bead: 0, ring: 0 },
  C1: { name: '开 1 席 · ply1 · tgt1（改目标：减均值→减最强）', seats: 1, ply: 1, tgt: 1, tie: 0, bead: 0, ring: 0 },
  D1: { name: '开 1 席 · ply1 · 环价 1（给"链条活着"定价）', seats: 1, ply: 1, tgt: 0, tie: 0, bead: 0, ring: 1 },
  E1: { name: '开 1 席 · ply1 · 珠价 1（给"带进下回合的珠"定价）', seats: 1, ply: 1, tgt: 0, tie: 0, bead: 1, ring: 0 },
  F1: { name: '开 1 席 · ply1 · tgt1 + 环价 1（两样一起）', seats: 1, ply: 1, tgt: 1, tie: 0, bead: 0, ring: 1 },
  G1: { name: '开 4 席 · ply1 · tie0（对照：难度表说不可玩的那一档）', seats: 4, ply: 1, tgt: 0, tie: 0, bead: 0, ring: 0 },
};
const ARMWANT = (arg('arms', '') || Object.keys(ARMS).join(',')).split(',').filter(k => ARMS[k]);

function setArm(a) {
  T.setBeliefPly(a.ply); T.setBeliefTarget(a.tgt); T.setBeliefTie(a.tie);
  T.setBeliefBead(a.bead); T.setBeliefRingPrice(a.ring);
  /* ⛔ 第一版这里写的是 `setBeliefSearch(a.seats > 0 ? 1 : 0)` ⇒ **模块档一开，`policyChooserN` 在构造时
   *    自己读到 BELIEF_SEARCH===1（`evo.js:548` 的 `bsMine`），于是"开 1 席"实际上把四个 AI 席全开了**
   *    —— 5 人桌那一整列读数（局长 14.3、珠环全 0）量的根本不是我想问的那一臂。
   *  正解：模块档**恒关**，要"这一席开"就走实例级工厂 `policyChooserBelief`（`evo.js:869` 的设计用途）。*/
  T.setBeliefSearch(0);
}
/** 一席的决策者：`open` ⇒ **实例级**开档；否则现役关档形状（模块档已被 setArm 钉成 0） */
function chooserFor(a, open) {
  return open ? T.policyChooserBelief(params, 0.15) : T.policyChooserN(params, 0.15);
}

/* ---- 一局（N=3：我坐 0 席对两个环境席；N=5：AI 占 1..4 席、0 席人类形状） ---- */
function playOne(armKey, env, n, g, seedBase, rec) {
  const a = ARMS[armKey];
  setArm(a);
  const rnd = mulberry32(seedBase + g * 7919);
  const st = S.createState(n === N5 ? 'multi' : 'multi', { next: rnd }, n);
  st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
  const chs = [];
  if (n === N5) {
    chs.push(function (state, pid, legal) { return makeMimic(W, HB, 'rand', function () { return state.rng.next(); })(state, pid, legal); });
    for (let i = 1; i < n; i++) chs.push(chooserFor(a, a.seats >= i));      // 前 `seats` 个 AI 席开档
  } else {
    chs.push(chooserFor(a, a.seats >= 1));                                   // N=3：0 席 = 被测的那一手（开档时开 1 席）
    for (let i = 1; i < n; i++) chs.push(env.sel);
  }
  let ringMax = 0, epMax = 0;
  const focus = n === N5 ? 1 : 0;                       // 被测席：N=5 是第一个开档 AI 席，N=3 就是 0 席
  Play.autoGameN(st, chs, undefined, function () {
    const q = st.p[focus]; if (q) { ringMax = Math.max(ringMax, q.ringStreak || 0); epMax = Math.max(epMax, q.ep); }
    /* ⚠ 这里**不许**用 `T.beliefSearchOn()` 当"搜索有没有生效"的心跳：那是**模块档**，
     *    而正确的装配要求模块档恒关（开档走实例级工厂）⇒ 用它当心跳会把真的开档臂判成"没被问"
     *    （我第一版就是这么红的）。liveness 改到**行为层**验：见下面心跳里的"与关档臂的分布 JS"。 */
  });
  /* 归因给"被测的那一席"：N=3 = 0 席；N=5 = 1..seats 里的第一席（开档）或 1 席 */
  const evs = st.events, dist = rec.dist, eco = rec.eco;
  let gCharge = 0, gSpend = 0;                            // **本局**的珠账（不许用累加值算本局的过期）
  for (const e of evs) {
    if (e.type === 'action' && e.outcome === 'ok' && e.pid === focus) {
      dist[e.key] = (dist[e.key] || 0) + 1; rec.acts++;
      if (e.key === R.SK.CHARGE) { eco.charges++; gCharge++; }
      if (e.key === R.SK.RAILGUN || e.key === R.SK.LASER_EYE) { eco.beadSpend++; gSpend++; }   // 唯二会花珠的卡
      if (e.key === R.SK.RING) eco.rings++;
    }
    if (e.type === 'ep' && e.pid === focus && typeof e.delta === 'number' && e.delta > 0) eco.epGain += e.delta;
  }
  const p0 = st.p[focus];
  /* 珠账（**按出手计**，与 §E169"按珠子计"的 `chargeProfile` 不同尺 ⇒ 只并排、不互校）：
   *   得 = 落地的`蓄能`次数（每次给一枚）‖ 花 = 落地的`电磁炮`/`激光眼`次数（唯二花珠的卡）
   *   ‖ 剩 = 终局该席还握着的珠 ‖ **过期 = 得 − 花 − 剩**（账恒等式，不是另一个观测）*/
  const beadLeft = Math.max(0, p0 ? (p0.elec || 0) + (p0.boom || 0) : 0);
  eco.beadGain += gCharge; eco.beadLeft += beadLeft;
  eco.beadExpire += Math.max(0, gCharge - gSpend - beadLeft);
  eco.ringMax += ringMax; eco.epMax += epMax;
  eco.rounds += st.round;
  /* 胜负：焦点席活着且血量最高（两口径一致：N=3 的"我夺冠"与 N=5 的"人类席夺冠"同判据）*/
  const topHp = (q) => q && q.hp > 0 && st.p.every((r, i) => i === focus || r.hp <= q.hp);
  if (n === N3) { rec.win += topHp(p0) ? 1 : 0; rec.games++; }
  else {
    rec.rankSum += 1 + st.p.filter((q, i) => i !== focus && q.hp > (p0 ? p0.hp : -1)).length;
    rec.aiTop += topHp(p0) ? 1 : 0;   // 单席夺冠（4 个镜像分票 ⇒ 只当诊断，不进表）
    rec.humanWin += topHp(st.p[0]) ? 1 : 0;
    rec.games++;
  }
  return st;
}
function newRec() {
  return { dist: {}, acts: 0, win: 0, games: 0, rankSum: 0, aiTop: 0, humanWin: 0,
    eco: { charges: 0, beadGain: 0, beadSpend: 0, beadLeft: 0, beadExpire: 0, rings: 0, ringMax: 0, epMax: 0, epGain: 0, rounds: 0 } };
}
/** 把若干个 per-env 记录**汇成一路**（3 人桌的经济面就这么来，免得只统计最后一个环境）*/
function mergeRecs(list) {
  const out = newRec();
  for (const r of list) {
    out.acts += r.acts; out.win += r.win; out.games += r.games;
    out.rankSum += r.rankSum; out.aiTop += r.aiTop; out.humanWin += r.humanWin;
    for (const k in r.eco) out.eco[k] += r.eco[k];
  }
  return out;
}
/* ---- JS 散度（开方）：平均成对距离 = "我的手在不同环境差多远" ---- */
function jsD(p, q) {
  const keys = {}; for (const k in p) keys[k] = 1; for (const k in q) keys[k] = 1;
  const tp = Object.values(p).reduce((a, b) => a + b, 0) || 1, tq = Object.values(q).reduce((a, b) => a + b, 0) || 1;
  let m = 0;
  for (const k in keys) {
    const a = (p[k] || 0) / tp, b = (q[k] || 0) / tq, h = (a + b) / 2;
    const d = a > 0 ? a * Math.log2(a / h) : 0, e = b > 0 ? b * Math.log2(b / h) : 0;
    m += 0.5 * d + 0.5 * e;
  }
  return Math.sqrt(m);
}
function ent(d) { const t = Object.values(d).reduce((a, b) => a + b, 0) || 1; let h = 0; for (const k in d) { const p = d[k] / t; if (p > 0) h -= p * Math.log2(p); } return h; }

const RES = {};                                       // RES[band][armKey] = { perEnv:{env:rec}, n3:rec, n5:rec }
for (const band of BANDS) {
  RES[band] = {};
  for (const k of ARMWANT) RES[band][k] = { perEnv: {}, n3: newRec(), n5: newRec() };
}
for (const band of BANDS) {
  for (const k of ARMWANT) {
    for (const env of ENVS) {
      const rec = newRec(); RES[band][k].perEnv[env.name] = rec;
      for (let g = 0; g < GAMES; g++) playOne(k, env, N3, g, SEED[band], rec);
    }
    /* 3 人桌经济/胜率面 = 12 个环境**汇总**（第一版只把最后一个环境的计数搬进去 ⇒ 经济列会看着"臂间无差"）*/
    RES[band][k].n3 = mergeRecs(ENVS.map(x => RES[band][k].perEnv[x.name]));
    /* N=5 产品形状：同一批 seed、4 个 AI 席 vs 人类形状席，环境 = 轮转取 ENVS */
    const rec5 = RES[band][k].n5;
    for (let g = 0; g < GAMES; g++) playOne(k, ENVS[g % ENVS.length], N5, g, SEED[band] + 500000, rec5);
    if (!QUIET) process.stdout.write('|');
  }
}
if (!QUIET) process.stdout.write('\n');

function divOf(band, k) {
  const pe = RES[band][k].perEnv, names = Object.keys(pe).filter(n => pe[n].acts > 0);
  let s = 0, n = 0;
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { s += jsD(pe[names[i]].dist, pe[names[j]].dist); n++; }
  const wr = names.map(x => 100 * pe[x].win / Math.max(1, pe[x].games));
  const mu = wr.reduce((a, b) => a + b, 0) / Math.max(1, wr.length);
  const sd = Math.sqrt(wr.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, wr.length));
  return { div: n ? Math.sqrt(s / n) : NaN, envN: names.length, wrMean: mu, wrSd: sd, wrMin: Math.min.apply(null, wr), wrMax: Math.max.apply(null, wr),
    entMean: names.reduce((a, x) => a + ent(pe[x].dist), 0) / Math.max(1, names.length),
    nEnv: names.length };
}
function ecoOf(rec) {
  const g = Math.max(1, rec.games);
  return { perGame: rec.acts / g, charges: rec.eco.charges / g, spend: rec.eco.beadSpend / g, gain: rec.eco.beadGain / g,
    expire: rec.eco.beadExpire / g, closed: rec.eco.beadGain ? rec.eco.beadSpend / rec.eco.beadGain : NaN,
    rounds: rec.eco.rounds / g, ringMax: rec.eco.ringMax / g, epMax: rec.eco.epMax / g, rings: rec.eco.rings / g };
}
console.log('# §E183 多策略 × 长经济：新机制到底买到什么（臂 = ' + ARMWANT.join('/') + ' · ' + GAMES + ' 局/环境 · 环境 ' + ENVS.length + ' 个：' + ENVS.map(e => e.name).join(' ') + '）');
console.log('两批独立 seed 带：' + BANDS.map(b => '带' + b + '=' + SEED[b]).join(' ‖ ') + ' ‖ 全部**同批配对**（同种子同牌序）');
console.log('（原"信念表被问"列已删：全仓没有任何查表计数器可挂 ⇒ 它是装饰，liveness 只认心跳的行为层 JS。）');
for (const band of BANDS) {
  console.log('\n## 带 ' + band + '（seed ' + SEED[band] + '）· 3 人桌：被测席 0 号，2 席 = 该环境原型');
  console.log('| 臂 | 出手多样性 `Div`（成对 JS 开方，越大=越看菜下饭） | 每环境出手熵 | 胜率均值 | 胜率极差 | 胜率σ | 最差环境 | 最好环境 |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const k of ARMWANT) {
    const d = divOf(band, k);
    console.log('| `' + k + '` ' + ARMS[k].name + ' | **' + d.div.toFixed(4) + '** | ' + d.entMean.toFixed(3) + ' | ' + d.wrMean.toFixed(1) + '% | '
      + (d.wrMax - d.wrMin).toFixed(1) + 'pt | ' + d.wrSd.toFixed(1) + ' | ' + d.wrMin.toFixed(1) + '% | ' + d.wrMax.toFixed(1) + '% |');
  }
  const base = divOf(band, ARMWANT[0]);
  console.log('> 相对关档（`' + ARMWANT[0] + '` Div=' + base.div.toFixed(4) + ' · 胜率 ' + base.wrMean.toFixed(1) + '%）：'
    + ARMWANT.slice(1).map(k => { const d = divOf(band, k); return '`' + k + '` 多样性 ' + (100 * (d.div / base.div - 1)).toFixed(0) + '% 变化 ‖ 胜率 ' + (d.wrMean - base.wrMean >= 0 ? '+' : '') + (d.wrMean - base.wrMean).toFixed(1) + 'pt'; }).join(' ‖ '));
  console.log('\n| 臂（5 人桌产品形状：AI 占 1..4 席，0 席=人类形状代表） | 每局出手 | 蓄能/局 | 珠得/局 | 珠花/局 | **珠闭环率** | 聚能环/局 | **环链最长** | 峰值ep | 局长 | **焦点席夺冠** | 人类夺冠 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ARMWANT) {
    const rec = RES[band][k].n5, e = ecoOf(rec);
    console.log('| `' + k + '` | ' + e.perGame.toFixed(1) + ' | ' + e.charges.toFixed(2) + ' | ' + e.gain.toFixed(2) + ' | ' + e.spend.toFixed(2) + ' | **'
      + (isFinite(e.closed) ? (100 * e.closed).toFixed(0) + '%' : '—') + '** | ' + e.rings.toFixed(2) + ' | ' + e.ringMax.toFixed(2) + ' | ' + e.epMax.toFixed(1) + ' | '
      + e.rounds.toFixed(1) + ' | ' + (100 * rec.aiTop / Math.max(1, rec.games)).toFixed(0) + '% | ' + (100 * rec.humanWin / Math.max(1, rec.games)).toFixed(0) + '% |');
  }
  /* ---- 长经济面（3 人桌 = 被测席汇总 12 个环境；5 人桌 = 产品形状）---- */
  const b0 = ARMWANT[0];
  console.log('\n| 臂 | **长经济（3 人桌 · 被测席）** 环/局 | 环链最长 | 珠得/局 | 珠花/局 | **珠过期/局** | 峰值ep | 局长 | 同一列（**5 人桌产品形状**） 环/局 | 环链最长 | 珠得/局 | 珠花/局 | 珠过期/局 | 局长 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ARMWANT) {
    const e3 = ecoOf(RES[band][k].n3), e5 = ecoOf(RES[band][k].n5);
    console.log('| `' + k + '` | ' + e3.rings.toFixed(2) + ' | ' + e3.ringMax.toFixed(2) + ' | ' + e3.gain.toFixed(2) + ' | ' + e3.spend.toFixed(2) + ' | **' + e3.expire.toFixed(2) + '** | '
      + e3.epMax.toFixed(1) + ' | ' + e3.rounds.toFixed(1) + ' | ' + e5.rings.toFixed(2) + ' | ' + e5.ringMax.toFixed(2) + ' | ' + e5.gain.toFixed(2) + ' | ' + e5.spend.toFixed(2) + ' | ' + e5.expire.toFixed(2) + ' | ' + e5.rounds.toFixed(1) + ' |');
  }
  const g3 = ecoOf(RES[band][b0].n3), g5 = ecoOf(RES[band][b0].n5);
  console.log('> 相对关档的**配对差**（3 人桌：环/局 ‖ 环链 ‖ 珠花/局 ‖ 过期/局；5 人桌同四列）：');
  for (const k of ARMWANT.slice(1)) {
    const a3 = ecoOf(RES[band][k].n3), a5 = ecoOf(RES[band][k].n5);
    const s = (x, y) => (x - y >= 0 ? '+' : '') + (x - y).toFixed(2);
    console.log('> · `' + k + '` 3P ' + s(a3.rings, g3.rings) + ' ‖ ' + s(a3.ringMax, g3.ringMax) + ' ‖ ' + s(a3.spend, g3.spend) + ' ‖ ' + s(a3.expire, g3.expire)
      + '  5P ' + s(a5.rings, g5.rings) + ' ‖ ' + s(a5.ringMax, g5.ringMax) + ' ‖ ' + s(a5.spend, g5.spend) + ' ‖ ' + s(a5.expire, g5.expire));
  }
}
console.log('\n## 心跳（不过则该臂读数作废）');
console.log('| 臂 | 带 | 3人桌不同卡张数 | 每局出手 | **与关档臂出手分布的 JS**（开档臂必须 > 0，否则那一臂根本没生效） | 判定 |');
console.log('|---|---|---|---|---|---|');
for (const band of BANDS) for (const k of ARMWANT) {
  const pe = RES[band][k].perEnv; const d = {}; let acts = 0;
  /* ⚠ 累加必须**按环境一次**：写成"每个 distinct key 都加一次 acts"会把每局出手数放大到环境卡数倍
   *   （第一版印出"每局 102.7 手 / 局长 35.7 回合"这种荒谬数，就是这里，不是桌子的锅）*/
  for (const n in pe) { acts += pe[n].acts; for (const key in pe[n].dist) d[key] = 1; }
  const rec = RES[band][k].n3;
  /* 合并 12 个环境的出手分布，与关档臂比一次 JS ⇒ **开档臂如果和关档一模一样，说明那一臂没生效**
   *   （实例级开关没挂上 / 模块档被覆盖），这比读 `beliefSearchOn()` 可靠得多。*/
  const merged = {}; for (const n in pe) for (const key in pe[n].dist) merged[key] = (merged[key] || 0) + pe[n].dist[key];
  const baseM = {}; for (const n in RES[band][ARMWANT[0]].perEnv) for (const key in RES[band][ARMWANT[0]].perEnv[n].dist) baseM[key] = (baseM[key] || 0) + RES[band][ARMWANT[0]].perEnv[n].dist[key];
  const jsv = k === ARMWANT[0] ? 0 : jsD(merged, baseM);
  const okk = Object.keys(d).length >= 6 && acts / Math.max(1, rec.games) >= 6 && (k === ARMWANT[0] || jsv > 1e-4);
  console.log('| `' + k + '` | ' + band + ' | ' + Object.keys(d).length + ' | ' + (acts / Math.max(1, rec.games)).toFixed(1) + ' | '
    + (k === ARMWANT[0] ? '（参照）' : jsv.toFixed(4)) + ' | ' + (okk ? '✔' : '⛔ 退化（' + (Object.keys(d).length < 6 ? '卡太少' : '') + (acts / Math.max(1, rec.games) < 6 ? ' 出手太稀' : '') + (k !== ARMWANT[0] && jsv <= 1e-4 ? ' 与关档一字不差 ⇒ 该臂没生效' : '') + '）') + ' |');
}
/* ---- 逐环境拆解（`--perenv`）：JS 是"分布差多远"，不等于"换了策略" ----
 *   众数卡（该环境里出手最多的那张）跨环境换几种 ⇒ 朴素可读的"多策略"尺。
 *   ⚠ 为什么要这一列：成对 JS 只看归一化后的占比 ⇒ "短局里只出得起 3 张卡"这种**濒死形状**
 *     也会把 JS 抬高（§E169 那族"绿得没意义"的变体：读数动了 ≠ 策略动了）。 */
if (process.argv.includes('--perenv')) {
  const modeOf = (d) => { let b = null, bv = -1, t = 0; for (const k in d) { t += d[k]; if (d[k] > bv) { bv = d[k]; b = k; } } return { card: b || '-', share: t ? 100 * bv / t : 0, kinds: Object.keys(d).length, tot: t }; };
  for (const band of BANDS) {
    console.log('\n## 带 ' + band + ' 逐环境拆解（每格 = 众数卡 占比% ‖ 胜率% ‖ 局长 ‖ 用过的卡种数）');
    console.log('| 环境 | ' + ARMWANT.map(k => '`' + k + '`').join(' | ') + ' |');
    console.log('|---|' + ARMWANT.map(() => '---|').join(''));
    for (const env of ENVS) {
      const cells = ARMWANT.map(k => {
        const pe = RES[band][k].perEnv[env.name], m = modeOf(pe.dist);
        const wr = 100 * pe.win / Math.max(1, pe.games), rd = pe.eco.rounds / Math.max(1, pe.games);
        return m.card + ' ' + m.share.toFixed(0) + '% ‖ ' + wr.toFixed(0) + ' ‖ ' + rd.toFixed(1) + ' ‖ ' + m.kinds;
      });
      console.log('| ' + env.name + ' | ' + cells.join(' | ') + ' |');
    }
    console.log('\n| 臂 | 12 个环境里**众数卡**换了几种 | 众数卡占比均值 | 用过的卡种数均值 | 判读 |');
    console.log('|---|---|---|---|---|');
    for (const k of ARMWANT) {
      const ms = ENVS.map(e => modeOf(RES[band][k].perEnv[e.name].dist));
      const kinds = new Set(ms.map(m => m.card)).size;
      const sh = ms.reduce((a, m) => a + m.share, 0) / ms.length;
      const kk = ms.reduce((a, m) => a + m.kinds, 0) / ms.length;
      console.log('| `' + k + '` | **' + kinds + ' / ' + ENVS.length + '** | ' + sh.toFixed(0) + '% | ' + kk.toFixed(1) + ' | '
        + (kinds <= 2 ? '⚠ 众数几乎不换 ⇒ JS 涨的是占比不是战术' : kinds >= 5 ? '✔ 战术面随环境换卡' : '介于两端') + ' |');
    }
  }
}
if (arg('json', '')) {
  const dump = {};
  const perEnvDump = process.argv.includes('--perenv');
  for (const band of BANDS) { dump[band] = {}; for (const k of ARMWANT) dump[band][k] = { div: divOf(band, k), eco3: ecoOf(RES[band][k].n3), eco5: ecoOf(RES[band][k].n5), n5: { games: RES[band][k].n5.games, aiTop: RES[band][k].n5.aiTop, humanWin: RES[band][k].n5.humanWin },
    ...(perEnvDump ? { perEnv: Object.fromEntries(ENVS.map(e => { const pe = RES[band][k].perEnv[e.name]; const m = (() => { let b = null, bv = -1, t = 0; for (const x in pe.dist) { t += pe.dist[x]; if (pe.dist[x] > bv) { bv = pe.dist[x]; b = x; } } return { card: b || '-', share: t ? 100 * bv / t : 0 }; })(); return [e.name, { win: pe.win, games: pe.games, rounds: pe.eco.rounds, acts: pe.acts, mode: m, dist: pe.dist }]; })) } : {}) }; }
  writeFileSync(arg('json'), JSON.stringify({ meta: { games: GAMES, envs: ENVS.map(e => e.name), arms: ARMWANT, seed: SEED, bands: BANDS, arms_def: ARMS }, res: dump }, null, 1));
  console.log('  json → ' + arg('json'));
}
