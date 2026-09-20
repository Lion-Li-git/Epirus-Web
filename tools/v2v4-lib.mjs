/* Epirus —— V1/V2/V4「整局」三装配的**单一来源**（v1.5.132）
 *
 * 为什么要有它：这三个装配原先**只写在** `probe-ring-ablate.mjs` 里，而 `np-test` 想守"V2/V4 有没有退化"
 * 就只能再抄一份（或钉文本）—— 本仓"同一规则两处维护必然漂移"栽过四次（见 `server/opp-pool.mjs` 文件头）。
 * 现在**探针与门共用这一份**。`tools/crowding.mjs` 量的是**另一个轴**（对手固定、只改同族席位份数 k=1/2/4），
 * 它的读数在文档里被引用过 ⇒ **暂不合并**（合并就得重测那批数）。
 *
 * ⚠️ 口径（改这里 = 改所有 V1/V2/V4 读数，先想清楚再动）：
 *   · 5 席、模式 `multi`；被测席用 `T.policyChooserN(params, 0.15)`（与页面"冠军"档同口径）；
 *   · 轮座：`off = g % 5`，被测占 `(off+i)%5`（k 席连续）；
 *   · 同 seed 序列：`S.createState('multi', {next: mb(seed + g*991)}, 5)` + `slotSalt = h32(seed + g*2246822519)`；
 *   · 判定：**被测席里任意一席夺冠**记 1（k=4 时即"我这个家族夺冠"），和棋另计 ⇒ k=1 时就是"我的胜率"，
 *     k=4 时要用 `rates()` 除以 k 得到**每席位**胜率（不除会随 k 上升，没信息量）。
 *   · `countKey`：统计"被测席的策略输出该卡的次数"（消融/阳性对照要的两条读数之一）；
 *     `ablate=true` 时把该卡的输出**换成ジ**（`R.SK.JI`，且只在 `legal` 里确实有ジ时替换）。
 */

/* 三个装配 = 文档里 V1/V2/V4 的定义。**顺序也是口径**（`probe-ring-ablate.mjs` 按它打印）。 */
export const ASSEMBLIES = [
  { key: 'V1', name: '打乱局（对手 random）', opp: 'pickRandom', k: 1 },
  { key: 'V2', name: '打整局（对手 balanced）', opp: 'pickBalanced', k: 1 },
  { key: 'V4', name: '成群（4 席自家族 vs 1 balanced）', opp: 'pickBalanced', k: 4 }
];

/* 与全仓其它量具同族的播种（同 seed ⇒ 可复现；也便于与历史读数对照） */
export function mb(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function h32(n) {
  let x = (n + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/* 一臂：k 席被测。`deps = {S, Play, T, R}`（沙箱对象；由调用方装好，本模块自己不读文件）。
 * 返回 { w: 逐局 1/0, draw: 和棋数, keyUses: 被测席输出 `countKey` 的次数 } */
export function playAssembly(deps, params, opts) {
  const S = deps.S, Play = deps.Play, T = deps.T, R = deps.R;
  const o = opts || {};
  const k = o.k || 1, N = o.games, seed = o.seed;
  const opp = o.opp;
  const countKey = o.countKey || null;
  if (typeof opp !== 'function') throw new Error('[v2v4] opp 必须是 chooser 函数');
  const me = T.policyChooserN(params, 0.15);
  const JI = R.SK.JI;
  let keyUses = 0, draw = 0;
  const w = [];
  for (let g = 0; g < N; g++) {
    const off = g % 5;
    const mine = []; for (let i = 0; i < k; i++) mine.push((off + i) % 5);
    const st = S.createState('multi', { next: mb(seed + g * 991) }, 5);
    st.slotSalt = h32(seed + g * 2246822519);
    const chooser = function (s2, pid, lg) {
      const r = me(s2, pid, lg);
      if (countKey && r && r.key === countKey) {
        keyUses++;
        if (o.ablate) { const ji = lg.find(function (x) { return x.key === JI; }); if (ji) return { key: JI }; }
      }
      return r;
    };
    const cs = []; for (let i = 0; i < 5; i++) cs.push(mine.indexOf(i) >= 0 ? chooser : opp);
    Play.autoGameN(st, cs);
    if (st.winner === 'draw') draw++;
    w.push(mine.indexOf(st.winner) >= 0 ? 1 : 0);
  }
  return { w: w, draw: draw, keyUses: keyUses };
}

/* 每席位胜率（%）。**不除以 k 会随 k 上升**，那是没信息量的读法（见 `crowding.mjs` 的口径说明）。 */
export function rates(w, k) {
  let s = 0; for (let i = 0; i < w.length; i++) s += w[i];
  return 100 * s / w.length / (k || 1);
}

/* ===== 「1 席脚本 vs 4 席同包」= G4 克制表的装配（`gate-drafts.mjs` 的 `duel()`）=====
 * 口径必须与 `gate-drafts.mjs:256-268` **逐字一致**（seed0=90210、`seat = g % 5`、
 * `slotSalt = h32(seed0 + g*2246822519)`、被测席 `T.policyChooserN(params, 0.15)`），
 * 否则复现不出已记录的读数。**自检在 `tools/probe-g4-anatomy.mjs` §A**：只枪那格必须复现
 * 线上包的 75%(long) / 62%(multi)。
 *
 * 为什么需要它：G4 是**唯一**用这个装配的量具，而它的实现原先只存在于 gate-drafts 内部（不可复用）
 * ⇒ 任何"想解剖 G4 到底输在哪"的探针都只能抄一份（本仓栽过四次的老病）。抽出来后两边口径同源。
 *
 * `opts`：
 *   · `scripted`：脚本席的 chooser（或字符串 `'champ'` = 5 席同包 = G4 的基线格）；
 *   · `mode`：`'long'` | `'multi'`（G4 两档都量）；`games`、`seed0`（默认 90210）；
 *   · `countKeys`：要统计出手次数的卡键数组（**被测席**的最终输出）；
 *   · `forceAttack`：**反事实钩子** —— 被测席若选「ジ」且当回合**枪买得起**，改判成枪（目标按
 *     `T.pickTargetN`，与 `gate-drafts` 的 `pT` 同口径）。这测的就是"**它本来买得起却没进攻**"那些回合；
 *   · `forceTurtle`：反方向 —— 被测席任何非ジ输出都改判成ジ（只测"完全不还手"会怎样）。
 *   两个钩子都记 `forced` 次数（**空枪检测**：为 0 ⇒ 本行无信息，不得读成"改了没用"）。
 * 返回：{ winPct, drawPct, champWinPct, avgRounds, champDecisions, jiShare, counts, forced,
 *        aliveChampEnd, aliveScriptedEnd, hpScriptedEnd } */
export function duelAssembly(deps, params, opts) {
  const S = deps.S, Play = deps.Play, T = deps.T, R = deps.R;
  const o = opts || {};
  const G = o.games, mode = o.mode || 'multi';
  const seed0 = o.seed0 != null ? o.seed0 : 90210;
  const scripted = o.scripted;
  if (typeof scripted !== 'function' && scripted !== 'champ') throw new Error('[v2v4] scripted 必须是 chooser 函数或 \'champ\'');
  const ch = T.policyChooserN(params, 0.15);
  const JI = R.SK.JI, GUN = R.SK.GUN;
  const keys = o.countKeys || null;
  const counts = {}; if (keys) keys.forEach(function (k) { counts[k] = 0; });
  let win = 0, draw = 0, rounds = 0, dec = 0, ji = 0, forced = 0, clears = 0;
  let aliveChampEnd = 0, aliveScriptedEnd = 0, hpScriptedEnd = 0;
  let dmgToScripted = 0, dmgByScripted = 0, champDmg = 0;
  for (let g = 0; g < G; g++) {
    const seat = g % 5;
    const st = S.createState(mode, { next: mb(seed0 + g * 991) }, 5);
    st.slotSalt = h32(seed0 + g * 2246822519);
    const mine = function (s2, pid, lg) {
      let r = ch(s2, pid, lg);
      dec++;
      if (r && r.key === JI) {
        ji++;
        if (o.forceAttack) {
          const gun = lg.find(function (x) { return x.key === GUN && x.affordable; });
          if (gun) { forced++; r = { key: GUN, target: T.pickTargetN(s2, pid, GUN) }; }
        }
      } else if (r && o.forceTurtle && r.key !== JI) {
        const j = lg.find(function (x) { return x.key === JI; });
        if (j) { forced++; r = { key: JI, target: null }; }
      }
      /* v1.5.133：**「瞄准」单杠杆**（与"攒不攒钱"拆开）—— 只把**伤害卡**的目标改成脚本席（枪手），
       * 不动它的出卡选择（所以不额外花钱、不改密度）。动机：跨包读数是「打在枪手身上的伤害」
       * 与这一格的相关 −0.82（"攒钱比例"只有 +0.23）⇒ 得知道到底是"花不花"还是"往哪打"在载重。
       * 只对伤害卡改目标：`lg` 的项不带目标（`{key,affordable,loan}`），自目标卡（防御/蓄能/环）
       * 强行塞目标会变成空挥 ⇒ 用 `R.byKey[key].dmg.amt` 判定（与体检 `isDmg` 同口径）。 */
      if (o.aimGunner && r && r.key !== JI) {
        const d = R.byKey[r.key];
        if (d && d.dmg && d.dmg.amt && s2.p[seat] && s2.p[seat].hp > 0) { forced++; r = { key: r.key, target: seat }; }
      }
      if (keys && r && keys.indexOf(r.key) >= 0) counts[r.key]++;
      return r;
    };
    const cs = []; for (let i = 0; i < 5; i++) cs.push(i === seat ? (scripted === 'champ' ? mine : scripted) : mine);
    Play.autoGameN(st, cs);
    /* qoder-research 0920（P2 第三行）：**收缩前击杀数** —— 与场B 门禁同口径（`countClears` 单一真源，
     * 只认"收缩开始前打死"，按伤害归属记在击杀者头上）。V4 形状里脚本席只有 1 个 ⇒ 每局合计 ∈ {0,1}。 */
    if (typeof T.countClears === 'function') {
      for (let i = 0; i < 5; i++) if (i !== seat) clears += T.countClears(st.events, i);
    }
    rounds += st.round;
    if (st.winner === seat) win++; else if (st.winner === 'draw') draw++;
    let ac = 0;
    for (let i = 0; i < 5; i++) if (i !== seat && st.p[i].hp > 0) ac++;
    aliveChampEnd += ac;
    if (st.p[seat].hp > 0) aliveScriptedEnd++;
    hpScriptedEnd += st.p[seat].hp;
    /* v1.5.133：**伤害归属**（v1.5.133 的跨包读数发现"攒钱比例"解释不了一半的方差，
     * 而"往不往枪手身上打"看得出来 —— 6 个臂包的脚本席余血 2.37~4.60 vs 线上包 1.73）
     * ⇒ 直接按事件统计：谁打的、打给谁（口径与 `audit-lib.aggressionProfile` 同字段名）。 */
    if (st.events) for (const e of st.events) {
      if (e.type !== 'damage') continue;
      if (e.source === seat) dmgByScripted += e.amt;
      else if (e.source != null) champDmg += e.amt;
      if (e.to === seat) dmgToScripted += e.amt;
    }
  }
  return {
    winPct: Math.round(100 * win / G), drawPct: Math.round(100 * draw / G),
    champWinPct: Math.round(100 * (G - win - draw) / G),
    avgRounds: rounds / G, champDecisions: dec,
    jiShare: dec ? ji / dec : 0, counts: counts, forced: forced,
    aliveChampEnd: aliveChampEnd / G, aliveScriptedEnd: aliveScriptedEnd / G,
    hpScriptedEnd: hpScriptedEnd / G,
    dmgToScriptedPerGame: dmgToScripted / G, dmgByScriptedPerGame: dmgByScripted / G,
    clearsPerGame: clears / G,
    champDmgPerGame: champDmg / G
  };
}

/* 三个装配一次量完：返回 { V1, V2, V4 } 的每席位胜率（%）+ 逐局原始数组（配对检验要它）。 */
export function measureAll(deps, params, opts) {
  const Bots = deps.B;
  const games = opts.games, seed = opts.seed;
  const out = {};
  for (const a of ASSEMBLIES) {
    const opp = Bots[a.opp];
    if (typeof opp !== 'function') throw new Error('[v2v4] EpirusBots 里没有 ' + a.opp);
    const r = playAssembly(deps, params, { k: a.k, opp: opp, games: games, seed: seed, countKey: opts.countKey, ablate: opts.ablate });
    out[a.key] = { rate: rates(r.w, a.k), w: r.w, draw: r.draw, keyUses: r.keyUses, k: a.k, name: a.name };
  }
  return out;
}
