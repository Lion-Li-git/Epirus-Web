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
import vm from 'node:vm';

const arg = function (k, d) { const h = process.argv.find(function (a) { return a.indexOf('--' + k + '=') === 0; }); return h ? h.split('=')[1] : d; };
const GAMES = Number(arg('games', 200));
const N = Number(arg('n', 5));
const MODE = arg('mode', 'multi');
const FIELDS = String(arg('fields', 'pool,guardwall,mirror')).split(',');
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const SEED0 = Number(arg('seed', 20260924));
const ASJSON = process.argv.indexOf('--json') >= 0;

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

function runField(field, games, costOverride) {
  const d = { field: field, games: games, decisions: 0, epSum: 0, epHist: {}, reach: {}, near: {}, affordNoBuy: {}, holds: 0, holdWithGunAfford: 0, spendByCard: {}, spendTot: 0, incomeByReason: {}, incomeTot: 0, rounds: 0, first: 0 };
  const prevCost = {};
  if (costOverride != null) { prevCost[R.SK.BIG_T] = R.byKey[R.SK.BIG_T].cost; R.byKey[R.SK.BIG_T].cost = costOverride; }
  try {
    for (let g = 0; g < games; g++) {
      const seat = g % N, seed = SEED0 + g * 7919;
      const bs = T.policyChooserN(params, 0.15);
      const rec = function (st, pid, legal, act) {
        if (pid !== seat || !act || !act.key) return;
        const ep = st.p[pid].ep || 0;
        d.decisions++; d.epSum += ep;
        const band = ep >= 5 ? '5+' : (ep >= 3 ? '3-4' : (ep >= 2 ? '2' : '0-1'));
        d.epHist[band] = (d.epHist[band] || 0) + 1;
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
      const r = T.oneGameN(ch, seed, N, { mode: MODE });
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
  const top = Object.keys(d.spendByCard).sort(function (a, b2) { return d.spendByCard[b2] - d.spendByCard[a]; }).slice(0, 6);
  console.log('  ep 支出结构（合计 ' + d.spendTot.toFixed(0) + ' ep，占收入 ' + pct(d.spendTot, Math.max(1, d.incomeTot)) + '）：' +
    top.map(function (k) { return ((R.byKey[k] || {}).name || k) + ' ' + pct(d.spendByCard[k], Math.max(1, d.spendTot)); }).join(' · '));
  console.log('  ep 收入（合计 ' + d.incomeTot.toFixed(0) + '）：' +
    Object.keys(d.incomeByReason).sort(function (a, b2) { return d.incomeByReason[b2] - d.incomeByReason[a]; }).slice(0, 4)
      .map(function (k) { return k + ' ' + pct(d.incomeByReason[k], Math.max(1, d.incomeTot)); }).join(' · ') +
    '   受评席 1st ' + pct(d.first, GAMES) + ' · 局长 ' + (d.rounds / GAMES).toFixed(1));
  out.push({ field: f, decisions: d.decisions, epMean: d.epSum / d.decisions, epHist: d.epHist, reach: d.reach, near: d.near, affordNoBuy: d.affordNoBuy, holds: d.holds, holdWithGunAfford: d.holdWithGunAfford, spendTot: d.spendTot, incomeTot: d.incomeTot, first: d.first / GAMES, rounds: d.rounds / GAMES });
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
    const rr = d.reach['大雷'] || { n: 0, ok: 0, bought: 0, boughtWhenOk: 0 };
    line.push(f + ' 买得起 ' + pct(rr.ok, rr.n) + ' · **真放出去** ' + pct(rr.bought, rr.n) +
      ' · 可达时成交率 ' + pct(rr.boughtWhenOk, Math.max(1, rr.ok)) +
      '（ep≥' + cost + ' 的决策 = ' + pct(atLeast(d.epHist, cost), d.decisions) + '）');
    sweep.push({ cost: cost, field: f, decisions: d.decisions, epHist: d.epHist, reach: d.reach });
  }
  console.log('  大雷 cost=' + cost + '   ' + line.join('   '));
}
console.log('# 预注册（跑前写死，见日志 §E1）：`cost=3` 时"翻过门槛"的决策占比仍 **<5%** ⇒ 要动的是收入/支出结构（习惯），不是大雷单价。');
if (ASJSON) console.log(JSON.stringify({ games: GAMES, mode: MODE, n: N, pack: PACK, fields: out, sweep: sweep }));
