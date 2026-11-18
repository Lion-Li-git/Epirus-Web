/* strength-lib.mjs —— 强度对照实验的**共享核心**（2026-11-19 凌夜，PLAN-2026-11-18-late 批 1a）
 *
 * 为什么要有它：`skill-report.mjs`（强度尺）与 `pool-skill-report.mjs`（合并尺 Stage 2）都需要
 * 「富裕经济 A/B + 消融 + 配对 SE」这一套算术。原先它只住在 skill-report.mjs 里，合并尺要抄第二份
 * ⇒ 触犯「同一规则只许一份实现」（AGENTS §4）。本文件把核心抽出来，两把尺共用。
 *
 * 抽取纪律：**主体逐字搬运** skill-report.mjs 的 `makeSel` / `runCondition` / `pairedDiff` /
 *   `needGamesPerPair` / `costOf`，只把文件级常量（N/MODE/PAIRS/GAMES/RICH/TEMP/TARGET_PT）参数化；
 *   语义一字不改。parity 验证 = 同种子、同参数下两把尺输出逐位一致（见 pool-skill-report.mjs --parity）。
 *
 * 每个函数头上的注释请读 tools/skill-report.mjs 原文件——那里有完整的裁定史（v1.3.59 强制命中率、
 * v1.4.10 消融、v1.5.190 配对 SE/Q-9 噪声纪律）。本文件不重复叙述，只做参数化搬运。
 */

/* 冠军 chooser，可附带「每回合补 ep」与「强制某技能」（逐字自 skill-report.mjs:121-175，N/TEMP/RICH 参数化） */
function makeSelCore(ctx, forceKey, rich, seat, acc, banKey) {
  const { W, champ, n, temp, richConst } = ctx;
  const R = W.EpirusRules, S = W.EpirusState, T = W.EpirusTrainer;
  const inner = n > 2 ? T.policyChooserN(champ, temp) : null;
  const fn = function (state, pid, legal) {
    if (rich && pid === seat) {
      const pl = state.p[seat];
      pl.ep = Math.max(pl.ep, richConst);
      const d = forceKey ? R.byKey[forceKey] : null;      // 珠类技能要同时补珠，否则强制也没用
      if (d && d.energyNeeds) {
        if (d.energyNeeds.elec) pl.elec = Math.max(pl.elec, 1);
        if (d.energyNeeds.boom) pl.boom = Math.max(pl.boom, 1);
      }
    }
    if (pid !== seat) {
      if (inner) return inner(state, pid, legal);
      const aff2 = legal.filter(function (l) { return l.affordable; });
      const base2 = aff2.length ? aff2 : [{ key: R.SK.JI, affordable: true }];
      return T.pickChampion(state, pid, base2, champ, temp);
    }
    const aff = legal.filter(function (l) { return l.affordable; });
    let base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    if (banKey) {
      const keep = base.filter(function (l) { return l.key !== banKey; });
      base = keep.length ? keep : [{ key: R.SK.JI, affordable: true }];
    }
    if (forceKey) {
      if (acc) acc.tries++;
      const can = base.filter(function (l) { return l.key === forceKey; });
      if (can.length) base = can;
    }
    const pickC = T.pickChampion(state, pid, base, champ, temp);
    const k = pickC.key;
    if (forceKey && acc && k === forceKey) acc.hit++;
    if (inner) {
      const t1 = (pickC.target != null) ? pickC.target : T.pickTargetN(state, pid, k);
      let t2 = null;
      if (k === R.SK.DUAL_GUN || k === R.SK.MIRROR) {
        const rest = S.opponentsOf(state, pid).filter(function (o) { return o !== t1; });
        t2 = rest.length ? rest[0] : null;
      }
      return { key: k, target: t1, target2: t2, bead: pickC.bead || null };
    }
    return pickC;
  };
  return fn;
}

/* 一条条件的整卷：PAIRS × GAMES 局，冠军席轮换；逐场胜负向量供配对（逐字自 skill-report.mjs:177-196） */
function runConditionCore(ctx, forceKey, rich, seedBase, acc, banKey) {
  const { n, mode, pairs, games } = ctx;
  const T = W_T(ctx);
  let first = 0, total = 0;
  const wins = [];
  for (const pair of pairs) {
    for (let g = 0; g < games; g++) {
      const seat = g % n;
      const choosers = [];
      let oi = 0;
      for (let pid = 0; pid < n; pid++) {
        if (pid === seat) choosers.push(makeSelCore(ctx, forceKey, rich, seat, acc, banKey));
        else { choosers.push(T.wrapBotN(ctx.B[pair[oi % pair.length]])); oi++; }
      }
      const r = T.oneGameN(choosers, seedBase + g * 977 + total, n, { mode });
      const w = T.rankOf(r.state, seat, seedBase + g * 977 + total) === 1 ? 1 : 0;
      first += w; wins.push(w);
      total++;
    }
  }
  return { firstRate: first / total, games: total, wins: wins };
}

function W_T(ctx) { return ctx.W.EpirusTrainer; }

/* 同 seedBase 两条件的配对差与 SE（逐字自 skill-report.mjs:200-209） */
function pairedDiffCore(base, arm) {
  const n = Math.min(base.wins.length, arm.wins.length);
  if (!n) return { d: 0, se: NaN, n: 0 };
  let s = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const dd = arm.wins[i] - base.wins[i]; s += dd; s2 += dd * dd; }
  const mean = s / n;
  if (n < 2) return { d: mean, se: NaN, n: n };
  const varr = Math.max(0, (s2 - n * mean * mean) / (n - 1));
  return { d: mean, se: Math.sqrt(varr / n), n: n };
}

/* 要把 1.96·SE 压到 targetPt 需要的局/组（逐字自 skill-report.mjs:211-215） */
function needGamesPerPairCore(ctx, se) {
  if (!(se > 0)) return null;
  const k = Math.pow(1.96 * se / (ctx.targetPt / 100), 2);
  return Math.max(1, Math.ceil(ctx.games * k));
}

/* 该技能在此配置下的显示费用（逐字自 skill-report.mjs:248-253） */
function costOfCore(ctx, key) {
  const { W, n } = ctx;
  const S = W.EpirusState;
  const st = S.createState(ctx.mode, { next: W.EpirusTrainer.mulberry32(1) }, n);
  for (let i = 0; i < n; i++) { st.p[i].ep = 99; st.p[i].elec = 3; st.p[i].boom = 3; }
  const c = S.computeCost(st, 0, key);
  return (c && c.ok) ? c.ep : null;
}

/* 工厂：ctx = { W, champ, n, mode, pairs, games, temp=0.15, richConst=10, targetPt=2, B } */
export function createStrengthCore(ctx) {
  if (!ctx.W || !ctx.champ || !ctx.n || !ctx.mode || !ctx.pairs || !ctx.games) {
    throw new Error('strength-lib: ctx 缺必填（W/champ/n/mode/pairs/games）');
  }
  if (ctx.temp == null) ctx.temp = 0.15;
  if (ctx.richConst == null) ctx.richConst = 10;
  if (ctx.targetPt == null) ctx.targetPt = 2;
  if (!ctx.B) ctx.B = ctx.W.EpirusBots;
  return {
    makeSel: (fk, rich, seat, acc, ban) => makeSelCore(ctx, fk, rich, seat, acc, ban),
    runCondition: (fk, rich, seed, acc, ban) => runConditionCore(ctx, fk, rich, seed, acc, ban),
    pairedDiff: pairedDiffCore,
    needGamesPerPair: (se) => needGamesPerPairCore(ctx, se),
    costOf: (key) => costOfCore(ctx, key),
    ctx,
  };
}
