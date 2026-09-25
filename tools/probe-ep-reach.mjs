/* E1 + E2 的只读量具（09-24 夜 · 按 `docs/HANDOFF-FOR-QWEN-2026-09-24.md` §4）
 *
 * 为什么要有它：DS 已量到"决策时刻 `ep≥5` 占 0.0%"（METHODOLOGY 第 48 条），但那只是**门槛够不够**这一半。
 * 本工具补另外两半，并且把它们放在**同一批决策点**上，免得又是"两把尺子"：
 *   §A 决策时刻 ep 分布 + 三个贵卡门槛的可达性（大雷 5ep / 电磁炮 2ep+电珠 / 激光眼 首次 1ep+爆珠）
 *   §B 改价反事实：**只在内存里**把大雷单价改成 5/3/2，看"翻过门槛"的决策占比怎么动
 *      （⚠️ 不许动 `js/core/rules.js` —— 那是指纹五件套，改它 = 规则换代、全部历史基线作废）
 *   §C "买得起但没买" vs "想买但差 ≤2ep" ⇒ 分辨**不想去**还是**够不着**（E1 的关键分岔）
 *   §D ep 收支结构：每张卡吃掉多少 ep、收入从哪来（E2）
 *
 * 口径纪律（交接 §5/§6）：
 *   · 可负担判定一律走 `S.computeCost` + `Play.legalActions`（与线上同一道菜单，含 v1.5.199 的净化闸）；
 *   · 场地装配与 `tools/probe-kill-reward.mjs` 同形（受评席轮换座位、其余席按场装配）⇒ 数字可横向比；
 *   · **决策点为 0 就非零退出**（交接 §5-4：静默跳过 = 把测量关掉而汇总仍全绿）；
 *   · 每个比例都带 n。
 *
 * 用法：node tools/probe-ep-reach.mjs [--games=200] [--fields=pool,guardwall,mirror] [--pack=<包>] [--json]
 */
import { readFileSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';   // v1.5.234 参数守卫
import vm from 'node:vm';

const arg = function (k, d) { const h = process.argv.find(function (a) { return a.indexOf('--' + k + '=') === 0; }); return h ? h.split('=')[1] : d; };
const GAMES = Number(arg('games', 200));
const N = Number(arg('n', 5));
const MODE = arg('mode', 'multi');
const FIELDS = String(arg('fields', 'pool,guardwall,mirror')).split(',');
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const SEED0 = Number(arg('seed', 20260924));
const ASJSON = process.argv.indexOf('--json') >= 0;
const NOJI = process.argv.indexOf('--noji') >= 0;   // v1.5.228：禁ジ反事实（压缩ジ的极端版）
/* v1.5.228：**水源旋钮**（`js/core/state.js:48` 的 `opts.regen`，2P v1.0 口径 = 0 = 关）。
 * 这是一等规则参数（不是补丁）⇒ 用它做"多给多少 ep 才够开大招"的扫描；默认 0 ⇒ 现有输出逐字不变。 */
const REGEN = (function () { const h = process.argv.find(function (a) { return a.indexOf('--regen=') === 0; }); return h ? Number(h.split('=')[1]) : 0; })();

/* v1.5.234：参数守卫 —— 我曾给它传 `--cost=3` 而它**没有这个参数**，读数照旧出来，我据此写错了结论。 */
rejectUnknownFlags(process.argv.slice(2), ['games','n','mode','fields','pack','seed','json','breadth-games','noji','regen'], 'probe-ep-reach');
const sb = {
  console: { log: function () { }, warn: function () { }, error: console.error },
  Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Float64Array, Date
};
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, B = sb.window.EpirusBots;
const packTxt = readFileSync(PACK, 'utf8');
vm.runInNewContext(packTxt, sb, { filename: PACK });
const packObj = /window\.EPIRUS_CHAMPION_3P\s*=/.test(packTxt) ? sb.window.EPIRUS_CHAMPION_3P : sb.window.EPIRUS_CHAMPION;
const params = P.unpack(packObj, true);
if (!params) { console.error('⛔ 包解不开：' + PACK); process.exit(2); }
const POOL = [B.pickAggro, B.pickBalanced, B.pickMix, B.pickBeadBurst, B.pickComboCounter];

/* 三个"贵/慢"动作的门槛（ep 部分；珠子另说）—— 一律问引擎要，不在这里抄一份数字 */
const TARGETS = [
  { key: R.SK.BIG_T, name: '大雷', bead: null },
  { key: R.SK.RAILGUN, name: '电磁炮', bead: 'elec' },
  { key: R.SK.LASER_EYE, name: '激光眼', bead: 'boom' }
];
const epOf = function (st, pid, key) { const c = S.computeCost(st, pid, key); return c && c.ok !== false ? (c.ep || 0) : null; };
/* v1.5.227（新 G 用）：**高价层**（基础价 ≥3 ep 的卡）的可达性与选择率。
 * 为什么不手抄名单：这个仓栽过太多次"两处各写一份名单"（METHODOLOGY 13）——
 *   所以逐决策按 **live menu + 定价** 现算：价格取 `byKey[key].cost`（数字），函数费用（聚能环/过载炮/激光眼）
 *   取 `computeCost` 算出的 `ep`；而"能不能现在打出去"一律以 `computeCost.ok` 为准（含珠子前置，与线上同一道闸）。 */
const priceOf = function (st, pid, key) {
  const def = R.byKey[key]; if (!def) return null;
  if (typeof def.cost === 'number') return def.cost;
  const c = S.computeCost(st, pid, key);
  return (c && typeof c.ep === 'number') ? c.ep : null;
};
/* ⚠️ `computeCost().ok` 判的是**前置**（例如"电磁炮需 1 枚电珠"），**不是买得起** ——
 * 我第一版拿它当"现在打得出去"，于是印出"高价层 100% 可达"这种荒谬值（decisions 的 ep 均值才 0.76）。
 * 买得起一律用**菜单自带**的 `l.affordable`（`randChooser` 用的就是它，单一来源）；缺这个字段时才退回 `ep >= 价格`。 */
const affordableNow = function (l, ep, price) {
  if (l && l.affordable !== undefined) return !!l.affordable;
  return ep >= price;
};
const COSTLY_MIN = 3;

function runField(field, games, costOverride) {
  const d = { field: field, games: games, decisions: 0, epSum: 0, epHist: {}, reach: {}, near: {}, affordNoBuy: {}, holds: 0, holdWithGunAfford: 0, spendByCard: {}, spendTot: 0, incomeByReason: {}, incomeTot: 0, rounds: 0, first: 0,
    /* v1.5.228：出招**类别构成**（同一批决策点）—— 回答"把ジ压下去，牌桌会不会只剩防御"这类**水床**问题。 */
    mix: { all: 0, ji: 0, energy: 0, attack: 0, defense: 0, special: 0 },
    costly: { min: COSTLY_MIN, n: 0, ok: 0, bought: 0, affordNoBuy: 0, byKey: {}, priceMax: 0 } };
  const prevCost = {};
  if (costOverride != null) { prevCost[R.SK.BIG_T] = R.byKey[R.SK.BIG_T].cost; R.byKey[R.SK.BIG_T].cost = costOverride; }
  try {
    for (let g = 0; g < games; g++) {
      const seat = g % N, seed = SEED0 + g * 7919;
      const __bsRaw = T.policyChooserN(params, 0.15);
      /* v1.5.228 `--noji`：**压缩ジ**的极端版（在菜单里直接去掉ジ）。这是**策略**干预，不改规则 ⇒ 指纹不变。
       * 用途：回答"把ジ压下去之后，高费卡还用不用得起 / 牌桌会不会只剩防御"这个**水床**问题。 */
      const bs = NOJI ? function (s2, p2, lg) {
        const f = (lg || []).filter(function (l) { return l.key !== R.SK.JI; });
        return __bsRaw(s2, p2, f.length ? f : lg);
      } : __bsRaw;
      const rec = function (st, pid, legal, act) {
        if (pid !== seat || !act || !act.key) return;
        const ep = st.p[pid].ep || 0;
        d.decisions++; d.epSum += ep;
        const band = ep >= 5 ? '5+' : (ep >= 3 ? '3-4' : (ep >= 2 ? '2' : '0-1'));
        d.epHist[band] = (d.epHist[band] || 0) + 1;
        /* v1.5.227：高价层（≥3ep）逐决策判定 —— 与上面那些门槛读数**同一批决策点**（免得又是两把尺子）。 */
        {
          let anyCostly = false, anyOk = false;
          for (const l of legal) {
            if (!l || !l.key) continue;
            const pr = priceOf(st, pid, l.key);
            if (pr == null || pr < COSTLY_MIN) continue;
            anyCostly = true;
            if (pr > d.costly.priceMax) d.costly.priceMax = pr;
            if (affordableNow(l, ep, pr)) anyOk = true;
          }
          if (anyCostly) {
            d.costly.n++;
            if (anyOk) d.costly.ok++;
            const ap = priceOf(st, pid, act.key);
            if (ap != null && ap >= COSTLY_MIN) {
              d.costly.bought++;
              d.costly.byKey[act.key] = (d.costly.byKey[act.key] || 0) + 1;
            } else if (anyOk) d.costly.affordNoBuy++;
          }
        }
        for (const t of TARGETS) {
          if (!legal.some(function (x) { return x.key === t.key; })) continue;
          const c = epOf(st, pid, t.key);
          if (c == null) continue;
          const need = c + (t.bead ? 1 : 0);            // 交接 §3.1：蓄能等价于多花 1ep
          const rk = t.name;
          d.reach[rk] = d.reach[rk] || { n: 0, ok: 0, need: need, bought: 0, boughtWhenOk: 0 };
          d.reach[rk].n++;
          const canNow = ep >= need && (!t.bead || (t.bead === 'elec' ? st.p[pid].elec > 0 : st.p[pid].boom > 0));
          if (act.key === t.key) { d.reach[rk].bought++; if (canNow) d.reach[rk].boughtWhenOk++; }
          if (canNow) { d.reach[rk].ok++; if (act.key !== t.key) d.affordNoBuy[rk] = (d.affordNoBuy[rk] || 0) + 1; }
          else if (need - ep <= 2) { d.near[rk] = (d.near[rk] || 0) + 1; }
        }
        /* v1.5.228：类别构成（ジ / 能量 / 攻击 / 防御 / 特殊）—— 与上面所有读数**同一批决策点**。 */
        d.mix.all++;
        if (act.key === R.SK.JI) d.mix.ji++;
        else { const __c = R.byKey[act.key] && R.byKey[act.key].cat; if (__c) d.mix[__c] = (d.mix[__c] || 0) + 1; }
        if (act.key === R.SK.JI) {
          d.holds++;
          const gc = epOf(st, pid, R.SK.GUN);
          if (gc != null && ep >= gc) d.holdWithGunAfford++;
        }
        const sc = act.key === R.SK.JI ? 0 : (epOf(st, pid, act.key) || 0);
        d.spendByCard[act.key] = (d.spendByCard[act.key] || 0) + sc;
        d.spendTot += sc;
      };
      const ch = [];
      for (let pid = 0; pid < N; pid++) {
        ch.push(function (s2, p2, lg) {
          const a = p2 === seat ? bs(s2, p2, lg) : (field === 'mirror' ? bs(s2, p2, lg)
            : field === 'guardwall' ? B.pickGuardSpam(s2, p2, lg) : POOL[(g * 3 + p2) % POOL.length](s2, p2, lg));
          if (p2 === seat) rec(s2, p2, lg, a);
          return a;
        });
      }
      const r = T.oneGameN(ch, seed, N, { mode: MODE, regen: REGEN });
      d.rounds += r.state.round;
      if (r.state.winner === seat) d.first++;
      /* 收入侧：只认 `ep` 事件里 delta>0 的（按 reason 分，缺 reason = 技能/ジ 给的钱） */
      for (const e of r.state.events) {
        if (e.type !== 'ep' || !(e.delta > 0) || e.pid !== seat) continue;
        const k = e.reason || 'ジ/技能';
        d.incomeByReason[k] = (d.incomeByReason[k] || 0) + e.delta;
        d.incomeTot += e.delta;
      }
    }
  } finally {
    if (costOverride != null) R.byKey[R.SK.BIG_T].cost = prevCost[R.SK.BIG_T];
  }
  return d;
}

const pct = function (n, d) { return d ? (100 * n / d).toFixed(1) + '%' : '  —  '; };
console.log('# E1/E2 决策时刻 ep 可达性与收支 · 包=' + PACK.replace(/^.*\//, '') + ' · ' + MODE + ' · ' + N + ' 人 · 种子 ' + SEED0);
const out = [];
for (const f of FIELDS) {
  const d = runField(f, GAMES, null);
  if (!d.decisions) { console.error('⛔ [' + f + '] 决策点计数为 0 ⇒ 本行没有信息（拒绝把"没量到"印成"量到了 0%"）'); process.exit(5); }
  console.log('\n=== 场：' + f + '（受评席 ' + GAMES + ' 局 · 决策点 n=' + d.decisions + '）===');
  console.log('  决策时刻 ep：均值 ' + (d.epSum / d.decisions).toFixed(2) + '   分布 ' +
    ['0-1', '2', '3-4', '5+'].map(function (k) { return k + ' ' + pct(d.epHist[k] || 0, d.decisions); }).join(' · '));
  for (const t of TARGETS) {
    const rk = t.name, rr = d.reach[rk];
    if (!rr) { console.log('  ' + rk + '：这张卡在这些决策点**根本不在合法表里**（不算可达性，也别说它是 0%）'); continue; }
    console.log('  ' + (rk + '    ').slice(0, 5) + '门槛≈' + String(rr.need).padStart(2) + ' ⇒ 当场买得起 ' + pct(rr.ok, rr.n) +
      ' · **真买了** ' + pct(rr.bought, rr.n) + '（买得起那批里的成交率 ' + pct(rr.boughtWhenOk, Math.max(1, rr.ok)) + '）' +
      ' · 只差≤2ep ' + pct(d.near[rk] || 0, rr.n) + '   (n=' + rr.n + ')');
  }
  console.log('  选 ジ 的决策 = ' + pct(d.holds, d.decisions) + '  其中"枪本来买得起"占 ' + pct(d.holdWithGunAfford, Math.max(1, d.holds)) + '（= holding 率，E4 的自变量）');
  /* v1.5.228：**出招类别构成** —— 与上面同一批决策点。用来回答"压ジ会不会把牌桌压成防御"这类**水床**问题：
   * ジ 是唯一水源 ⇒ 压它 = 压整张预算，高费卡先消失、剩下的回合只能靠**免费防御**填。 */
  console.log('  出招构成（受评席 ' + d.mix.all + ' 次决策）：ジ ' + pct(d.mix.ji, d.mix.all) + ' · 攻击 ' + pct(d.mix.attack, d.mix.all) +
    ' · **防御 ' + pct(d.mix.defense, d.mix.all) + '** · 能量 ' + pct(d.mix.energy, d.mix.all) + ' · 特殊 ' + pct(d.mix.special, d.mix.all) +
    (NOJI ? '   ⚠️ 本次是 `--noji` **禁ジ反事实**（策略干预，规则未动）' : ''));
  const top = Object.keys(d.spendByCard).sort(function (a, b2) { return d.spendByCard[b2] - d.spendByCard[a]; }).slice(0, 6);
  console.log('  ep 支出结构（合计 ' + d.spendTot.toFixed(0) + ' ep，占收入 ' + pct(d.spendTot, Math.max(1, d.incomeTot)) + '）：' +
    top.map(function (k) { return ((R.byKey[k] || {}).name || k) + ' ' + pct(d.spendByCard[k], Math.max(1, d.spendTot)); }).join(' · '));
  console.log('  ep 收入（合计 ' + d.incomeTot.toFixed(0) + '）：' +
    Object.keys(d.incomeByReason).sort(function (a, b2) { return d.incomeByReason[b2] - d.incomeByReason[a]; }).slice(0, 4)
      .map(function (k) { return k + ' ' + pct(d.incomeByReason[k], Math.max(1, d.incomeTot)); }).join(' · ') +
    '   受评席 1st ' + pct(d.first, GAMES) + ' · 局长 ' + (d.rounds / GAMES).toFixed(1));
  out.push({ field: f, decisions: d.decisions, epMean: d.epSum / d.decisions, epHist: d.epHist, reach: d.reach, near: d.near, affordNoBuy: d.affordNoBuy, holds: d.holds, holdWithGunAfford: d.holdWithGunAfford, spendTot: d.spendTot, incomeTot: d.incomeTot, first: d.first / GAMES, rounds: d.rounds / GAMES, costly: d.costly, mix: d.mix, noji: NOJI });
}
/* §B 改价反事实：只改内存里的大雷单价，量"翻过门槛"的决策占比怎么动（预注册：cost=3 时 ep≥3 仍 <5%） */
console.log('\n=== §B 改价反事实（只改内存里的 `R.byKey[大雷].cost`，仓库文件一字不动 ⇒ 指纹不变）===');
const atLeast = function (hist, cost) {
  let n = 0;
  if (cost <= 1) n += (hist['0-1'] || 0);
  if (cost <= 2) n += (hist['2'] || 0);
  if (cost <= 3) n += (hist['3-4'] || 0);
  n += (hist['5+'] || 0);
  return n;
};
const sweep = [];
for (const cost of [5, 3, 2]) {
  const line = [];
  for (const f of FIELDS) {
    const d = runField(f, Math.min(GAMES, 120), cost);
    /* v1.5.227：高价层（≥3ep）的**可达性 vs 选择率** —— 把"够不着"和"够得着但不去"分开印。 */
    const cy = d.costly;
    line.push('  [高价层 ≥' + cy.min + 'ep] 菜单里出现过 ' + pct(cy.n, d.decisions) + ' 的决策（n=' + cy.n + '）· ' +
      '**当时真能打出** ' + pct(cy.ok, Math.max(1, cy.n)) + ' · **真打出去了** ' + pct(cy.bought, Math.max(1, cy.n)) +
      ' · 可达却没选 ' + pct(cy.affordNoBuy, Math.max(1, cy.ok)) + (Object.keys(cy.byKey).length ? ' · 选过：' + JSON.stringify(cy.byKey) : ''));
    const rr = d.reach['大雷'] || { n: 0, ok: 0, bought: 0, boughtWhenOk: 0 };
    line.push(f + ' 买得起 ' + pct(rr.ok, rr.n) + ' · **真放出去** ' + pct(rr.bought, rr.n) +
      ' · 可达时成交率 ' + pct(rr.boughtWhenOk, Math.max(1, rr.ok)) +
      '（ep≥' + cost + ' 的决策 = ' + pct(atLeast(d.epHist, cost), d.decisions) + '）');
    sweep.push({ cost: cost, field: f, decisions: d.decisions, epHist: d.epHist, reach: d.reach });
  }
  console.log('  大雷 cost=' + cost + '   ' + line.join('   '));
}
/* ===== §E 广度的"含空转"审计（METHODOLOGY 第 51 条留的半成品）=====
 * 为什么要：`G 有效技能数`/`净兑现` 数的是**非ジ出手**的种类与熵 ⇒ 一次"清除 0 枚"的空净化、一次没人被烧的空天火、
 *   一次蓄完就过期的空蓄能，**都算一张有效卡**。v1.5.199 挡掉空净化后 `cbs1s2-band2` 的 G 从 3.83 掉到 2.95（跨过广度门），
 *   说明"广度里含多少空转"不是小数 —— 但总效应不等于归因，这里**按事件逐条剔掉空转**再算一遍，才能分清
 *   "计数上少一张卡"与"行为真的变窄"。
 * 空转的判据一律**来自事件**（不写卡名清单）：净化看 `purify.curses===0`、天火看该回合有没有 `reason==='天火'` 的伤害、
 *   蓄能看 `beadExpire`（珠只活到下一回合，过期即从未被用）。 */
function breadthAudit(games) {
  const bs = T.policyChooserN(params, 0.15);
  const casts = {}, wasted = { 净化: 0, 天火: 0, 蓄能: 0 };
  let rounds = 0, seatCasts = {};
  for (let g = 0; g < games; g++) {
    const seed = SEED0 + g * 7919;
    const ch = [];
    for (let pid = 0; pid < N; pid++) ch.push(function (s2, p2, lg) { return bs(s2, p2, lg); });
    const r = T.oneGameN(ch, seed, N, { mode: MODE });
    rounds += r.state.round;
    const fireRounds = {};
    for (const e of r.state.events) if (e.type === 'damage' && e.reason === '天火') fireRounds[e.round] = (fireRounds[e.round] || 0) + 1;
    for (const e of r.state.events) {
      if (e.type === 'action' && e.outcome === 'ok' && e.key !== R.SK.JI) {
        casts[e.key] = (casts[e.key] || 0) + 1;
        (seatCasts[e.pid] = seatCasts[e.pid] || {})[e.key] = ((seatCasts[e.pid] || {})[e.key] || 0) + 1;
      } else if (e.type === 'purify' && !e.curses) wasted.净化++;
      else if (e.type === 'beadExpire') wasted.蓄能 += (e.n || 1);
    }
    /* 天火：出手了但那回合没有任何"天火"伤害 ⇒ 空爆（v1.5.139 的菜单闸应当已挡住 ⇒ 这里也是那道闸的回归哨） */
    for (const e of r.state.events) {
      if (e.type === 'action' && e.outcome === 'ok' && e.key === R.SK.FIRESTORM && !fireRounds[e.round]) wasted.天火++;
    }
  }
  const G = function (obj) {
    const vals = Object.keys(obj).map(function (k) { return obj[k]; });
    const tot = vals.reduce(function (a, b2) { return a + b2; }, 0);
    if (!tot) return { g: 0, kinds: 0, n: 0 };
    let H = 0;
    for (const c of vals) { const p = c / tot; H -= p * Math.log(p); }
    return { g: Math.exp(H), kinds: vals.length, n: tot };
  };
  /* "扣空转"的口径：把三类恒亏出手按次数从对应卡里减掉（不够减就整张清零）*/
  const ded = JSON.parse(JSON.stringify(casts));
  ded[R.SK.PURIFY] = Math.max(0, (ded[R.SK.PURIFY] || 0) - wasted.净化);
  ded[R.SK.FIRESTORM] = Math.max(0, (ded[R.SK.FIRESTORM] || 0) - wasted.天火);
  ded[R.SK.CHARGE] = Math.max(0, (ded[R.SK.CHARGE] || 0) - wasted.蓄能);
  for (const k of Object.keys(ded)) if (!ded[k]) delete ded[k];
  return { raw: G(casts), clean: G(ded), wasted: wasted, rounds: rounds / games, games: games };
}
{
  const BG = Math.min(Number(arg('breadth-games', 24)), 60);
  const b = breadthAudit(BG);
  console.log('\n=== §E 广度里含多少空转（镜像 ' + BG + ' 局 · ' + MODE + ' · 判据全部来自事件）===');
  console.log('  空转出手：净化 ' + b.wasted['净化'] + ' 次 · 天火 ' + b.wasted['天火'] + ' 次（v1.5.139 的菜单闸应挡到 0）· 蓄能珠过期 ' + b.wasted['蓄能'] + ' 颗');
  console.log('  G 有效技能数：原始 ' + b.raw.g.toFixed(2) + '（' + b.raw.kinds + ' 种 / ' + b.raw.n + ' 次非ジ出手）' +
    ' → 扣空转 ' + b.clean.g.toFixed(2) + '（' + b.clean.kinds + ' 种）  ⇒ 虚高 ' +
    (b.raw.g - b.clean.g).toFixed(2) + '（' + pct(b.raw.g - b.clean.g, Math.max(0.0001, b.raw.g)) + '）· 门线 3.0');
  console.log('  ⚠️ 门用的是 selfPlay 的 G；这里同一装配两次计数只演示"空转算一张卡"这件事，不改任何门（判据要用户裁定）。');
  out.push({ breadth: b });
}
console.log('# 预注册（跑前写死，见日志 §E1）：`cost=3` 时"翻过门槛"的决策占比仍 **<5%** ⇒ 要动的是收入/支出结构（习惯），不是大雷单价。');
if (ASJSON) console.log(JSON.stringify({ games: GAMES, mode: MODE, n: N, pack: PACK, fields: out, sweep: sweep }));
