/* Epirus — 对抗自对战训练器（轻量进化锦标赛）。
 * 候选策略每代与「当前冠军 + 脚本基准」对战打分；精英保留 + 变异/交叉；
 * 最强挑战者与冠军加赛，胜率 ≥55% 才换冠军（对抗门控）。同步计算，UI 分帧调用。
 */
(function (global) {
  'use strict';
  const R = global.EpirusRules;
  const S = global.EpirusState;
  const Play = global.EpirusPlay;
  const P = global.EpirusPolicy;
  const Bots = global.EpirusBots;
  /* v7：这个包是"旧形状"吗（v5/v6 的动作段只有 14 维 ⇒ 候选新增维度会被忽略）。
   * 旧包一律走**旧口径**（键 + pickTargetN 目标），否则历史基线（eco-34 的 41.4%）不可比。 */
  function LEGACY(params) {
    /* v1.5.19：`params` 可能为 null —— 健康门槛拒绝首次提升时 `t.champion` 会短暂为 null，
     * 而 champVsBaseline 会拿它去建 chooser ⇒ 旧写法直接 TypeError（实测 train-best 崩在这里）。
     * 防御性判空：null 一律按"旧口径"处理（宁可用错口径，也不要整条训练线崩掉）。 */
    if (!params) return true;
    /* v1.5.64：**容器显式标记优先**（嵌入 v7 的旧冠军仍必须走旧口径，否则目标退化）。 */
    if (P.isLegacyChooser && P.isLegacyChooser(params)) return true;
    const sh = P.shapeOf(params);
    return !sh || sh.legacy === true;
  }

  /* ===== 训练模式（v1.5.0）=====
   * `oneGameN` 从 v1.4.0 起就支持 `opts.mode`，但**训练路径没有一处传它**（19 个调用点里
   * 唯一传过的是评测工具 eval-5p.mjs）⇒ 历次训练（hA9 / hB12 / wall2 / ms2 / ring2…）
   * 全部按 'multi'（3 血）建局，"5 血冠军"从来没被训过；产物 meta 里连模式字段都没有，
   * 因为那个值是永远不变的默认值。
   * 这里由**调用方**显式设置 —— 沿用 setWrTol 的模式：引擎内不读 process.env
   * （np-test L3 守护这条），默认 'multi' ⇒ 既有路径逐位不变。
   * 反证（np-test D10）：把下面任意一处 mode 传参删掉，D10 立刻红。 */
  let TRAIN_MODE = 'multi';
  function setTrainMode(m) { if (m && R.MODES && R.MODES[m]) TRAIN_MODE = m; return TRAIN_MODE; }
  function trainMode() { return TRAIN_MODE; }

  /* ===== 风格表现切片：复合适应度（v1.5.2）=====
   * 动机：两次"改对手池"的干预都落空（ring2 加 1 个脚本对手、mix 加 4 个真实风格冠军），
   * 而且后者还**摊薄**了每个对手的练习量。所以这里**不改池子**：在每个个体身上**追加** k 局
   * 对风格冠军的局（在池子预算之外 ⇒ 不摊薄），把 1st 率作为**有界加分**并进 fit。
   * 为什么不是替换 fit：这些局走**原生规则**（regen=0、无补贴），量的是真实强度 ⇒
   * 是诚实的复合目标，不会把人推向"只在特殊口径下成立"的策略（§5.2 的教训）。
   * 由**调用方**显式设置（与 setWrTol/setTrainMode 同一模式），默认关闭 ⇒ 既有路径逐位不变。
   * 反证（np-test D13）：把 scoreMemberN 里的 styleGames 记账删掉，D13 立刻红。 */
  let STYLE_OPPS = null, STYLE_W = 0, STYLE_GAMES = 0;
  function setStyleSlice(opps, w, games) {
    STYLE_OPPS = (opps && opps.length) ? opps : null;
    STYLE_W = (typeof w === 'number' && w > 0) ? w : 0;
    STYLE_GAMES = (typeof games === 'number' && games > 0) ? (games | 0) : 0;
    if (!STYLE_OPPS) { STYLE_W = 0; STYLE_GAMES = 0; }   // 没有对手就整体关闭（避免"权重在、对手没了"的半开状态）
    return styleSlice();
  }
  function styleSlice() {
    return { w: STYLE_W, games: STYLE_GAMES, n: STYLE_OPPS ? STYLE_OPPS.length : 0 };
  }

  /* v1.5.52: per-game slot salt. The tie-break order of opponent slots must be
   * UNPREDICTABLE across games in training, otherwise the net can learn "slot 0 = seat X"
   * (L7: no deterministic identity mapping in ties). Salt is a pure function of the
   * seed/game index => the same experiment stays reproducible, and no random stream is
   * consumed (so sampling and game behaviour are untouched). */
  function slotSaltFor(seed) {
    let h = (Math.imul((seed | 0) + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13;
    return h >>> 0;
  }

  /* v1.5.65（第五轮复核 §4 的决定性发现）：**训练暴露度为零**。
   * 旧采样 `opps[oi % opps.length]` 连续取**不同**项，而池里被动攒钱型只有 farmer/deepsaver 两项
   * ⇒ "4 席全被动"这个局面在训练分布里概率是 **0（不是少，是不可能）** ⇒ 过去所有"惩罚攒钱"类奖励
   * （惩罚被动/先手激励/密集分/EPIRUS_DIV_W）都在**样本量为 0 的分布**上优化 ⇒ 场 B 从 v1.5.17 到
   * v1.5.63 一次都没练好。修法：按 `EPIRUS_PASSIVE_FIELD`（默认 1/8 局）把该局面**注入评估分布**。
   * 只改"评估哪些局面"，不动参数量、不升 PACK_VERSION。 */
  const PASSIVE_FIELD = (function () {
    const v = (typeof process !== 'undefined' && process.env && process.env.EPIRUS_PASSIVE_FIELD != null)
      ? Number(process.env.EPIRUS_PASSIVE_FIELD) : 0.125;
    return (isFinite(v) && v > 0) ? Math.min(1, v) : 0;
  })();
  const PASSIVE_EVERY = PASSIVE_FIELD > 0 ? Math.max(1, Math.round(1 / PASSIVE_FIELD)) : 0;
  function passiveFieldAt(g) { return PASSIVE_EVERY > 0 && (g % PASSIVE_EVERY === 0); }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function policyChooser(params, temp) {
    return function (state, pid, legal) {
      // 只在"可负担"技能里选：AI 绝不主动贷款自爆
      const aff = legal.filter(function (l) { return l.affordable; });
      const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
      /* v7：**旧包走旧口径、新包走候选**。
       * 旧包（v5/v6）的动作段只有 14 维 ⇒ 候选新增的 8 维会被完全忽略，但"目标怎么选"会变；
       * 为了让历史基线（如 eco-34 的 41.4%）保持逐位可比，旧包必须继续用 pickTargetN 那套启发式。 */
      if (LEGACY(params)) return P.choose(state, pid, base, params, { temp: temp });
      const cands = P.candidatesFor(state, pid, base, { lockTarget: lastCancelOther(state, pid) });
      return P.chooseCandidates(state, pid, cands, params, { temp: temp });
    };
  }
  const BOT_PICKS = {
    aggro: Bots.pickAggro, defend: Bots.pickDefend,
    balanced: Bots.pickBalanced, random: Bots.pickRandom,
    breakdef: Bots.pickBreakDef,
    mix: Bots.pickMix, wall: Bots.pickWall,
    reflectspam: Bots.pickReflectSpam, guardspam: Bots.pickGuardSpam, baguaspam: Bots.pickBaguaSpam, combocounter: Bots.pickComboCounter,
    tankline: Bots.pickTankLine, heavyfire: Bots.pickHeavyFire, guardgun: Bots.pickGuardGun,
    protowall: Bots.pickProtoWall, whiff: Bots.pickWhiff,
    reflectmix: Bots.pickReflectMix, reflecttank: Bots.pickReflectTank, defreflectgun: Bots.pickDefReflectGun,
    /* ===== v1.5.130：**珠爆发线**（ジ→蓄电珠→电磁炮，残血摄魂）—— 进**默认池**是有意的例外 =====
     * 它把当时的线上 2P 冠军打到 **100% 胜**（探针 `tools/probe-beadburst.mjs`：100.0% / 均 9.2 回合）。
     * `np-test` 的判词里写着"不许往默认池加键"，那条纪律针对的是 `ringspam` 这类**专精**
     * （加进来会改变所有后续训练的分布，而它并非"打穿线上包"的线）。这里的理由**相反**：
     *   ① 它是**实测打穿线上包**的线 —— 不进来就等于"训练永远看不见自己最大的洞"；
     *   ② v7 特征**本来就有**"对手持珠 / 对手刚蓄能"的输入（`policy.js:208-212` / `:242` / `:259`），
     *      缺的只是"对手池里从没人这么干过"这条梯度。
     * ⚠️ **代价要说清**：池子分布变了 ⇒ 之后所有 2P 训练臂的数字与本版之前**不可直接比**
     *    （先例 v1.5.119：动了对手池，代价落在场B 清场）。 */
    beadburst: Bots.pickBeadBurst
  };
  // 硬门槛：任何一条基准 <50% 的候选一律不许当冠军（否则"对某类打法更脆"会被 avg 平均掉）。
  // 起初只挡人类式三条，实测仍放过"永久防御 50% / 永久反弹 27%"这类洞，故扩到全部基准。
  const GATE_ALL = true;

  function oneGame(aSel, bSel, seed, mode) {
    const st = S.createState(mode || 'standard', { next: mulberry32(seed) });
    st.slotSalt = slotSaltFor(seed);
    Play.autoGame(st, aSel, bSel);
    const dmg = [0, 0];
    for (const e of st.events) if (e.type === 'damage') dmg[e.to] = (dmg[e.to] || 0) + e.amt;
    return { winner: st.winner, rounds: st.round, dmg };
  }

  /* a 相对 b 的胜率（含换边公平化）。games 建议偶数。 */
  function correctedWinRate(aSel, bSel, games, seedBase) {
    let w = 0, d = 0, l = 0;
    for (let i = 0; i < games; i++) {
      const aIsP0 = i % 2 === 0;
      const r = aIsP0 ? oneGame(aSel, bSel, seedBase + i) : oneGame(bSel, aSel, seedBase + i);
      if (r.winner === 'draw') d++;
      else if (aIsP0) { if (r.winner === 0) w++; else l++; }
      else { if (r.winner === 1) w++; else l++; }
    }
    return { w, d, l, wr: games ? (w + d * 0.5) / games : 0 };
  }

  function makeTrainer(opts) {
    opts = opts || {};
    const t = {
      popSize: opts.popSize || 14,
      gamesPerOpp: opts.gamesPerOpp || 5,
      playoffGames: opts.playoffGames || 30,
      elite: opts.elite || 4,
      sigma: opts.sigma || 0.18,
      mode: opts.mode || 'standard',
      gen: 0,
      champion: opts.champion || P.makePolicy(0.2),
      championAge: 0,
      bestParams: null,
      bestChamp: null, bestChampScore: -1, bestChampAttack: 0,
      pop: [],
      history: [],
      baselineEvery: opts.baselineEvery || 5,
      lastTop: [],          // 最近一代按 shaped 分排序的前3个个体 params（用于末尾真实胜率择优）
      running: false
    };
    for (let i = 0; i < t.popSize; i++) {
      t.pop.push({ params: P.makePolicy(0.25), score: 0, attackGames: 0, attackRate: 0 });
    }
    return t;
  }

  function seedOf(t, i, tag) {
    let h = 17;
    const s = String(t.gen * 7919 + i * 104729 + tag.length * 31);
    for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0;
    return h;
  }

  /* 构建每代的对手池（champion + 脚本基准），含权重。 */
  function buildOpps(championParams, temp) {
    return [
      { name: 'champion', w: 1.5, sel: policyChooser(championParams, temp || 0.05) },
      { name: 'breakdef', w: 1.5, sel: BOT_PICKS.breakdef },
      { name: 'wall', w: 1.5, sel: BOT_PICKS.wall },       // 防御/反弹墙：逼迫学会破架势
      { name: 'tankline', w: 2.0, sel: BOT_PICKS.tankline },   // 人类式：坦克线（优先级3作废枪/狙击）
      { name: 'heavyfire', w: 1.8, sel: BOT_PICKS.heavyfire },  // 人类式：重火力压制
      { name: 'guardgun', w: 1.8, sel: BOT_PICKS.guardgun },    // 人类式：防御+枪三拍
      { name: 'protowall', w: 1.6, sel: BOT_PICKS.protowall },  // 原型制御墙：只有地雷/转移能绕
      { name: 'whiff', w: 1.2, sel: BOT_PICKS.whiff },          // 空放型：训练 lastSkill=null 状态
      { name: 'reflectmix', w: 1.8, sel: BOT_PICKS.reflectmix }, // 反弹与攻击交替：克「枪/狙击吃反弹」
      { name: 'reflecttank', w: 1.8, sel: BOT_PICKS.reflecttank },   // 反弹→反弹→坦克（实测打穿旧冠军）
      { name: 'defreflectgun', w: 1.8, sel: BOT_PICKS.defreflectgun }, // 防御→反弹→枪（实测打穿旧冠军）
      { name: 'reflectspam', w: 1.6, sel: BOT_PICKS.reflectspam }, // 永久反弹：修"一键反弹打死冠军"
      { name: 'mix', w: 1.3, sel: BOT_PICKS.mix },
      { name: 'aggro', w: 1.2, sel: BOT_PICKS.aggro },
      { name: 'combocounter', w: 1.8, sel: BOT_PICKS.combocounter },   // 连招反制：逼 AI 别被看穿
      { name: 'guardspam', w: 1.6, sel: BOT_PICKS.guardspam },
      { name: 'baguaspam', w: 1.0, sel: BOT_PICKS.baguaspam },
      { name: 'balanced', w: 1.0, sel: BOT_PICKS.balanced },
      /* v1.5.130：**唯一"蓄珠 → 放电"的对手线**，权重给到 2.0（与 tankline 同档；它 100% 打穿越线包）。
       * ≈ 6% 的对局（池子总权重 30 → 32）—— 与 guardspam(5%) 同量级，不动整个分布的重心。 */
      { name: 'beadburst', w: 2.0, sel: BOT_PICKS.beadburst },
      { name: 'defend', w: 2.2, sel: BOT_PICKS.defend }
    ];
  }
  function seedOfGen(gen, idx, tag) {
    let h = 17;
    const s = String(gen * 7919 + idx * 104729 + tag.length * 31);
    for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0;
    return h;
  }
  /* 计算单个个体（params）对 opps 的 shaped fitness + 攻防统计。纯函数：可被并行 worker 调用。
   * 与旧 evaluatePopulation 的单个体逻辑完全一致（sel 只在循环外建一次，行为不变）。 */
  function scoreMember(params, opps, gamesPerOpp, gen, idx) {
    let score = 0, n = 0, attackGames = 0, attackChoices = 0, totalChoices = 0;
    const skillUse = {};   // 该个体全部对局里的出招分布（用于多样性奖励）
    const sel = policyChooser(params, 0.05);
    for (const opp of opps) {
      let acc = 0;
      for (let g = 0; g < gamesPerOpp; g++) {
        const aOn0 = (g % 2 === 0);
        const rec = { offensive: false, choices: 0, attackChoices: 0, prevKey: null, curRun: 0, maxRun: 0 };
        const selWrapped = function (state, pid, legal) {
          const k = sel(state, pid, legal);   // 与实战一致的贪心
          if ((aOn0 && pid === 0) || (!aOn0 && pid === 1)) {
            rec.choices++;
            if (R.ATK_EFFECT.indexOf(k) >= 0) { rec.offensive = true; rec.attackChoices++; }
            rec.curRun = (k === rec.prevKey) ? rec.curRun + 1 : 1;
            if (rec.curRun > rec.maxRun) rec.maxRun = rec.curRun;
            rec.prevKey = k;
            skillUse[k] = (skillUse[k] || 0) + 1;
          }
          return k;
        };
        const r = aOn0 ? oneGame(selWrapped, opp.sel, seedOfGen(gen, idx, opp.name) + g)
                        : oneGame(opp.sel, selWrapped, seedOfGen(gen, idx, opp.name) + g);
        if (rec.offensive) attackGames++;
        attackChoices += rec.attackChoices;
        totalChoices += rec.choices;
        let base = r.winner === 'draw' ? 0.1 : (aOn0 ? (r.winner === 0 ? 1 : 0) : (r.winner === 1 ? 1 : 0));
        const dmgDealt = aOn0 ? r.dmg[1] : r.dmg[0];   // 我造成的伤害（含反弹）
        const dmgTaken = aOn0 ? r.dmg[0] : r.dmg[1];
        const diff = dmgDealt - dmgTaken;
        // 换血正向 = 进攻奖励；反向 = 挨打惩罚（修正原 sign 乘积负负得正的 bug）
        // 出手/进攻类奖励整体收敛：原先 offensive±0.04 + deal + slow 把"永远不摆架势"变成最优解
        const proact = 0.03 * Math.max(-1, Math.min(1, diff / 6));
        const deal = 0.015 * Math.min(1, dmgDealt / 4);
        const slow = 0.015 * Math.min(1, r.rounds / 60);
        let gs = Math.max(-0.3, Math.min(1.3, base + proact + deal - slow + (rec.offensive ? 0.015 : -0.015)));
        // 单调循环惩罚：同一招连放 >5 次 → 每多一次扣 0.03（抑制"永久反弹/ジ枪循环"退化）
        if (rec.maxRun > 5) gs -= 0.03 * (rec.maxRun - 5);
        acc += gs;
      }
      score += (acc / gamesPerOpp) * opp.w;
      n += opp.w;
    }
    const attackRate = attackGames / (opps.length * gamesPerOpp);
    const attackShare = totalChoices ? attackChoices / totalChoices : 0;
    // 多样性奖励：出招分布的香农熵（3 bit 封顶，权重 0.05）——直接把"覆盖率/熵"从 7/28、1.5bit 往上推，
    // 否则"ジ+枪"两招循环在适应度上照样是最优解（玩家手感里 AI 会显得死板）。
    let ent = 0; const totUse = Object.keys(skillUse).reduce(function (a, k) { return a + skillUse[k]; }, 0) || 1;
    for (const k in skillUse) { const p = skillUse[k] / totUse; ent -= p * Math.log2(p); }
    const div = 0.05 * Math.min(1, ent / 3);
    return { score: (n ? score / n : 0) + div, div: div, distinct: Object.keys(skillUse).length, entropy: ent, attackGames: attackGames, attackChoices: attackChoices, totalChoices: totalChoices, attackRate: attackRate, attackShare: attackShare };
  }
  /* 串行评估整代（浏览器 / 自测用）。行为与旧版逐成员完全一致。 */
  /* ================= N 人（N19）================= */
  /* 目标启发（N 人）：优先血量最低的存活对手 */
  /* 上回合与我互为目标、结果双方被相抵的对手（用于反锁） */
  function lastCancelOther(state, pid) {
    for (let i = state.events.length - 1; i >= 0; i--) {
      const e = state.events[i];
      if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) {
        return e.pids[0] === pid ? e.pids[1] : e.pids[0];
      }
    }
    return null;
  }

  /* N 人目标选择 v2：
   *   1) 反锁：上回合与某对手互为目标而相抵 → 本回合不再打他（否则就是无意义的互相消耗死循环）
   *   2) 能一击必杀 → 打能杀的（取血最低）
   *   3) 否则 → 打血量最高的（领先者），避免放任任一家坐大
   *   并列时随机（去 pid 偏差）。 */
  function pickTargetN(state, pid, key) {
    const def = R.byKey[key];
    if (!def || def.target === 'self') return null;
    const opps = S.opponentsOf(state, pid);
    if (!opps.length) return null;
    let pool = opps;
    const locked = lastCancelOther(state, pid);
    if (locked != null) {
      const alt = opps.filter(function (o) { return o !== locked; });
      if (alt.length) pool = alt;
    }
    const dmg = (def.dmg && def.dmg.amt) ? def.dmg.amt : 0;
    const killable = dmg > 0 ? pool.filter(function (o) { return state.p[o].hp <= dmg; }) : [];
    let best = [], bestHp = killable.length ? Infinity : -Infinity;
    for (const o of (killable.length ? killable : pool)) {
      const h = state.p[o].hp;
      if (killable.length ? (h < bestHp - 1e-9) : (h > bestHp + 1e-9)) { bestHp = h; best = [o]; }
      else if (Math.abs(h - bestHp) < 1e-9) best.push(o);
    }
    if (!best.length) best = pool.slice();
    if (best.length === 1) return best[0];
    return best[Math.floor(state.rng.next() * best.length)];
  }
  function pickTarget2N(state, pid, key, t1) {
    if (key !== R.SK.DUAL_GUN && key !== R.SK.MIRROR) return null;
    const opps = S.opponentsOf(state, pid).filter(function (o) { return o !== t1; });
    return opps.length ? opps[0] : null;
  }

  /* N 人版策略 chooser（v7：**候选**= (技能, 目标, 珠类型)，目标由网络自己选，不再走 pickTargetN）。
   * eps = ε-探索：以概率 eps 在**候选**里均匀抽一个（v6 是"在可负担技能里抽"）。
   * 为什么必须有：策略在 ep≥1 时 99.8% 选枪，"不花钱攒钱"这个动作
   * 几乎不可能被 softmax 采样到 → 奖励再大也没有梯度（经验：
   * save/conv/hold 三项都加了，max ep 仍然死守 1）。
   * 训练用 eps>0；评测/UI 不传 eps → 行为不变。
   * `lockTarget`：上回合与本玩家"相抵"的对手不进候选（沿用 v6 pickTargetN 的反锁策略，
   * 避免无意义的互相消耗死循环）。第二目标 t2 仍由 pickTarget2N 兜底 —— 枚举 t2 会让候选数再 ×(N−1)。 */
  /* ===== v1.5.82（用户裁定，v1.5.83 抽成单一真源）：**蓄能的经济门槛** =====
   * 用户原话："ep=1 的时候本来就不应该蓄能……至少要让他 ep>=2 才开始用，不然就是浪费。"
   * 规则依据（已核）：蓄能 cost=1，能量珠"只保留到下一回合"；珠子消费卡有两张 ——
   *   · 电磁炮 railgun：2 ジ + 1 **电珠**（攻破反弹/防御）
   *   · 激光眼 laserEye：首次 **1 ジ + 1 爆珠**、连续使用 2 ジ（无效化防御类/转移伤害；偏结盟用）
   * 收入约 1 ジ/回合 ⇒ ep=1 蓄能后下回合刚好够激光眼、却完全不够电磁炮，且一旦被打断就白扔 ⇒ 取保守门槛 ep>=2。
   * ⚠ 启发式不是定律：收入 >1/回合（聚能环第 3 次起 +3、避雷针 +4）时 ep=1 蓄能也可能成立。
   * ⚠ 只作用于 v7 口径：legacy（v5/v6）保持旧口径，历史基线才可比。
   * 抽成函数的动机：探针（tools/probe-beadloop.mjs）必须与线上**同一份**门槛，否则又会量错（对比 v1.5.83 的教训）。 */
  function econBase(state, pid, legal) {
    /* 菜单级"严格必废"闸门（v1.5.139 扩第二项，用户实机报"空爆"）：
     * ① ep<2 不蓄能（v1.5.82 原裁定，注释见 policyChooserN 上方）；
     * ② 全场无人带符咒 ⇒ 天火必然 0 引爆（花 2 ジ 放空气）——从菜单摘掉。
     * 与①同性质：这是"恒亏动作"的门禁，不是新的规则语义（README 天火的作用对象就是符咒）；
     * 键级探索（下面 epsK）因此永远不会把天火采进 top-K。训练/浏览器同享此菜单。 */
    // v1.5.139：天火引爆的是**施法者自己贴出、age≤3** 的符咒（resolve `case SK.FIRESTORM` 的
    // owner/age 判定）——闸门必须与它同判据：数"pid 拥有的存活符咒"，不是"场上任何符咒"。
    let myLiveStickers = 0;
    for (let i = 0; i < state.p.length; i++) {
      const tk = state.p[i].stickers || [];
      for (let j = 0; j < tk.length; j++) if (tk[j].owner === pid && tk[j].age <= 3) myLiveStickers++;
    }
    const gated = legal.filter(function (l) {
      if (l.key === R.SK.FIRESTORM) return myLiveStickers > 0;
      if (l.key !== R.SK.CHARGE) return true;
      const pp = state.p[pid];
      return !!pp && (pp.ep || 0) >= 2;
    });
    return gated.length ? gated : legal;
  }

  function policyChooserN(params, temp, eps, epsK, epsMode) {
    const legacy = LEGACY(params);
    return function (state, pid, legal) {
      const aff = legal.filter(function (l) { return l.affordable; });
      const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
      if (legacy) {
        /* 旧包（v5/v6）：**完全按旧口径**（键 + ε + pickTargetN 目标）—— 否则历史基线不可比。 */
        const key = (eps && state.rng.next() < eps)
          ? base[Math.floor(state.rng.next() * base.length)].key
          : P.choose(state, pid, base, params, { temp: temp });
        const t1 = pickTargetN(state, pid, key);
        return { key: key, target: t1, target2: pickTarget2N(state, pid, key, t1), bead: null };
      }
      /* ===== v1.5.82（用户裁定）：**ep < 2 不蓄能**（只作用于 v7 口径；legacy 保持旧口径 => 历史基线可比）=====
       * 用户原话："ep=1 的时候本来就不应该蓄能，因为用到蓄能花费最低的激光眼也要额外一个 ep，
       * 至少要让他 ep>=2 才开始用，不然就是浪费。"
       * 规则依据（已核）：蓄能 cost=1，描述是"获得 1 枚能量珠……**只保留到下一回合**"；
       *   唯一的珠子消费卡是**电磁炮**（2 ジ + 1 电珠）；天火是引爆**符咒**，与珠子无关。
       * => 收入约 1 ジ/回合时，ep=1 蓄能**必然过期**。
       * 实测佐证（改前）：线上包 24/24 次蓄能决策都落在 ep=1；chargeProfile 得珠 23 颗、过期 23、**花掉 0**。
       * ⚠ 启发式而非定律：收入 >1/回合（聚能环第 3 次起 +3、避雷针 +4）时 ep=1 蓄能也可能成立。 */
      const v7base = econBase(state, pid, base);
      const cands = P.candidatesFor(state, pid, v7base, { lockTarget: lastCancelOther(state, pid) });
      /* ===== v1.5.139（用户 09-21 晨裁定：ε=0.25 全候选太糙，出现"贴贴不引爆/空爆"昏手，要"均匀但随机性小"）=====
       * 探索不再在**全体候选**上均匀采（那样会采到天火空爆、无意义贴贴这类网络几乎不给分的废着），
       * 而是：取网络打分前 K 的**不同技能键**（按各键最好候选的概率排序），在其中均匀采一个键、
       * 再取该键概率最高的候选。→ 既保证"多个不同技能"的对称破（2 席长程镜像从 ε=0 的 104 回合零决胜
       *   降到 ~30 回合、100% 决胜），又把昏手率压到近零（5 席空爆/局：全候选 0.77 → top5 键 0.07）。
       * `epsK` 默认 5；只在**浏览器运行时**（ui 传 eps>0）生效，训练/评测/门禁 eps=0 ⇒ 读数逐字不变。 */
      let pick;
      const greedyOf = function () { return P.chooseCandidates(state, pid, cands, params, { temp: temp }); };
      if (eps && state.rng.next() < eps && cands.length) {
        /* v1.5.141（#26 · 用户实机"防御偏多、丢了集火和滚环"）：`epsMode='soft'` 时探索**不得覆盖**
         * 贪心已经选定的"防御类型 / 聚能环"两型出手。理由不是审美，是算术：同一包同一装配下，均匀抽 top-K
         * 把防御出现率从贪心的 4.0% 抬到 26.4%，聚能环从 1.2% 抬到 **0.0%** —— 环是**连段**机制（第 3 次起 +3 ジ），
         * 40% 的随机打断等于把它从经济里删掉（量具：`tools/behavior-profile.mjs`）。
         * 默认不传 `epsMode` = v1.5.139 的原口径逐字不变 ⇒ 训练/评测/门禁读数不动。 */
        if (epsMode === 'soft') {
          const g = greedyOf();
          const gcat = R.byKey[g.key] && R.byKey[g.key].cat;
          if (g.key === R.SK.RING || gcat === R.CAT.DEFENSE) pick = g;
        }
        if (!pick) {
          const f = P.forwardCands(state, pid, cands, params, { temp: 1 });
          const bestOf = {}, keys = [], keyIdx = {};
          for (let i = 0; i < cands.length; i++) {
            const k = cands[i].key;
            if (!(k in bestOf)) { bestOf[k] = f.probs[i]; keyIdx[k] = i; keys.push(k); }
            else if (f.probs[i] > bestOf[k]) { bestOf[k] = f.probs[i]; keyIdx[k] = i; }
          }
          /* `soft` 的第二半：探索集里**不放防御键** ⇒ 噪声只能"换一种打法"，不能"凭空摆一个架势"。
           * （只有防御键可选时不过滤 —— 否则退化成一个确定性的ジ。） */
          let pool = keys;
          if (epsMode === 'soft') {
            const nonDef = keys.filter(function (k) {
              const d = R.byKey[k];
              return !(d && d.cat === R.CAT.DEFENSE);
            });
            if (nonDef.length >= 2) pool = nonDef;
          }
          const top = pool.sort(function (a, b) { return bestOf[b] - bestOf[a]; }).slice(0, Math.max(2, epsK || 5));
          pick = cands[keyIdx[top[Math.floor(state.rng.next() * top.length)]]];
        }
      } else {
        pick = greedyOf();
      }
      return { key: pick.key, target: pick.target, target2: pickTarget2N(state, pid, pick.key, pick.target), bead: pick.bead };
    };
  }
  /* v7：页面/工具的统一入口（候选感知 + 旧包自动回退）。
   * 返回 {key,target,target2,bead} —— 调用方**整个交给引擎**（play.js 的 normPick 认这个形状）。 */
  function pickChampion(state, pid, legal, params, temp, eps, epsK, epsMode) {
    return policyChooserN(params, temp, eps, epsK, epsMode)(state, pid, legal);
  }

  /* 脚本 chooser 包一层（补目标），供 N 人局使用 */
  function wrapBotN(sel) {
    return function (state, pid, legal) {
      const k = sel(state, pid, legal);
      const key = (typeof k === 'string') ? k : (k && k.key);
      if (key == null) return { key: R.SK.JI, target: null, target2: null };
      /* ⚠️ v1.3.55：脚本**自己选的目标必须保留**。
       * 此前这里无条件用 pickTargetN 重算，把返回 `{key,target}` 的脚本
       * （pickProtoMine / pickProtoTransfer / pickFocusFire / pickDeepSaver）的目标
       * 整个丢掉 —— 也就是"会还手"的脚本在 N 人局里被剥掉了瞄准。
       * 对现有训练口径零影响：OPP_NAMES 那 9 个脚本都只返回技能名。 */
      const obj = (typeof k === 'object' && k) ? k : null;
      const t1 = (obj && obj.target != null) ? obj.target : pickTargetN(state, pid, key);
      const t2 = (obj && obj.target2 != null) ? obj.target2 : pickTarget2N(state, pid, key, t1);
      return { key: key, target: t1, target2: t2 };
    };
  }

  /* N 人一局：chooser[pid] 逐座位 */
  /* ===== Q3 深经济探针（千问方案）=====
   * 为什么需要：冠军一直在**原生经济**下被选出（终局 evalN 跑无补贴局）
   * → 深经济能力在选择那一刻完全不可见。只靠回放切片让它"被看到"不够，
   * 必须让它**进选择**。
   * 口径（本人定义，已写入文档）：把冠军喂到 ep=5 并补珠，**只打分"是否用出贵技能"，不打分胜负**：
   *   0.6 * min(1, 落地的高费技能数 / 2) + 0.4 * min(1, 出手的高费技能数 / 3)
   * 其中"高费" = 费用 >= 3 ジ。 */
  function evalEconProbe(params, games, n, seedBase) {
    const N = (typeof n === 'number' && n > 2) ? n : 3;
    let casts = 0, landed = 0, gamesRun = 0;
    for (let g = 0; g < games; g++) {
      const seat = g % N;
      const inner = policyChooserN(params, 0.15, 0);
      const ch = [];
      const mk = function (pid) {
        return function (state, id, legal) {
          if (id === seat) {                       // 只给冠军补资源（不改规则，仅评测用）
            const pl = state.p[seat];
            pl.ep = Math.max(pl.ep, 5);
            pl.elec = Math.max(pl.elec, 1);
            pl.boom = Math.max(pl.boom, 1);
          }
          return inner(state, id, legal);
        };
      };
      for (let pid = 0; pid < N; pid++) ch.push(mk(pid));
      // 记录出手：包一层在 seat 的 chooser 上
      const rec = { keys: [] };
      const seatSel = ch[seat];
      ch[seat] = function (state, id, legal) {
        const a = seatSel(state, id, legal);
        const k = (typeof a === 'string') ? a : a.key;
        const c = S.computeCost(state, id, k);
        rec.keys.push((c && c.ok && c.ep >= 3) ? k : null);
        return a;
      };
      const r = oneGameN(ch, seedBase + g * 977, N, { mode: TRAIN_MODE });
      for (let i = 0; i < rec.keys.length; i++) if (rec.keys[i]) casts++;
      const heavyKeys = {};
      for (const k of rec.keys) if (k) heavyKeys[k] = 1;
      for (const e of r.state.events) {
        if (e.type !== 'damage' || e.via == null) continue;
        if (!heavyKeys[e.via]) continue;
        const c2 = costOfKey(e.via, N);
        if (c2 != null && c2 >= 3) landed++;
      }
      gamesRun++;
    }
    const castRate = gamesRun ? casts / gamesRun : 0;
    const landRate = gamesRun ? landed / gamesRun : 0;
    /* 修正 1（v1.3.18）：**只奖励"落地"**。上一版 `0.4*casts/3` 奖励的是"出手"本身，
     * 于是它靠狂放高费技能刷分——即使全被挡下（实测 castPerGame≥3 但 landPerGame=0），
     * 与历史上 deal/proact"奖励打伤害却打不赢"是同类过拟合。出手不再给分。 */
    const score = Math.min(1, landRate / 2);
    return { score: score, casts: casts, landed: landed, games: gamesRun, castPerGame: castRate, landPerGame: landRate };
  }

  /* ===== (c) 补贴局探针：门槛绑**胜负**，不绑"贵技能落地次数" =====
   * 千问的警告：双枪已真正读取 def.dmg，于是 >=3 ジ 层里出现了可落地的伤害技能——
   * 但强制出双枪是**净负**（实测 -27pt）。任何"奖励贵技能落地"的探针都会选出
   * "乱挥双枪"的冠军。故判据改为**补贴局里的夺 1 率**。
   * 与 evalEconProbe 的三点不同：
   *   1) 打分对象是名次（夺1率/前二率），不是出手或落地次数；
   *   2) 冠军被强制在承诺视界 h 下行动 → 深经济分支不再依赖"恰好被抽到"；
   *   3) 补贴是**开局一次性给资源**（startEp），不是每次决策补满 → 必须把资源
   *      **转换**成胜利才算数，"有钱"本身不给分。
   * 对手口径与 evalEconProbe 一致：同权重自对弈（确定性、无脚本表依赖）。 */
  function evalSubsidyProbe(params, games, n, seedBase, opts) {
    const N = (typeof n === 'number' && n > 2) ? n : 3;
    const O = opts || {};
    const H = (typeof O.h === 'number' && O.h > 0) ? (O.h | 0) : 3;
    const START_EP = (typeof O.startEp === 'number' && O.startEp > 0) ? O.startEp : 4;
    const REGEN = (typeof O.regen === 'number') ? O.regen : 0;
    let first = 0, top2 = 0, played = 0, deepCast = 0;
    const keys = {};
    for (let g = 0; g < games; g++) {
      const seat = g % N;
      const inner = policyChooserN(params, 0.15, 0);
      const seatSel = makeCommitChooser(params, 0.15, H);
      let granted = false;
      const ch = [];
      for (let pid = 0; pid < N; pid++) {
        if (pid === seat) {
          ch.push(function (state, id, legal) {
            if (!granted) {                     // 开局一次性补贴（不改规则，仅评测用）
              granted = true;
              const pl = state.p[seat];
              pl.ep = Math.max(pl.ep, START_EP);
              pl.elec = Math.max(pl.elec, 1);
              pl.boom = Math.max(pl.boom, 1);
              /* ⚠ 这一步不能省：play.js:50-53 在**调用 chooser 之前**就算好了
               * legal[i].affordable，并在 chooser 返回后用**那个**值把买不起的选择
               * 强制改回 ジ。所以只改 pl.ep 时，贵技能在本回合进不了采样集。
               * 实测口径见 tools/grant-mech-diag.mjs（affordable 序列 = 前 3 次 false、
               * 之后 true：**只对每局第 1 回合无效**，因为改的是真实 state，会留到下一回合）。
               * 也就是说 evalEconProbe 的历史结论**只有首回合是盲的，其余仍然有效**——
               * 不要把它当成"纯测量假象"（我一度这么以为，实测否定了）。
               * 这里重算 affordable 是为了消掉那一个回合的盲区，让"白给资源"当回合就成立。 */
              if (legal) {
                for (let i = 0; i < legal.length; i++) {
                  const cc = S.computeCost(state, id, legal[i].key);
                  legal[i].affordable = !!(cc && cc.ok && cc.ep <= pl.ep);
                }
              }
            }
            const a = seatSel(state, id, legal);
            const k = (typeof a === 'string') ? a : a.key;
            const c = S.computeCost(state, id, k);
            if (c && c.ok && c.ep >= 3) { deepCast++; keys[k] = 1; }
            return a;
          });
        } else {
          ch.push(function (state, id, legal) { return inner(state, id, legal); });
        }
      }
      const r = oneGameN(ch, seedBase + g * 977, N, { regen: REGEN, mode: TRAIN_MODE });
      const rank = rankOf(r.state, seat, seedBase + g * 977);
      if (rank === 1) first++;
      if (rank <= 2) top2++;
      played++;
    }
    const firstRate = played ? first / played : 0;
    const top2Rate = played ? top2 / played : 0;
    return {
      score: firstRate,                     // 门槛用的就是它：补贴局夺 1 率
      firstRate: firstRate,
      top2Rate: top2Rate,
      games: played,
      deepCastPerGame: played ? deepCast / played : 0,
      deepKinds: Object.keys(keys).length
    };
  }

  /* 某技能的真实费用（评测用） */
  function costOfKey(key, n) {
    const st = S.createState('multi', { next: mulberry32(7) }, (n > 2 ? n : 3));
    st.slotSalt = slotSaltFor(7);
    for (let i = 0; i < st.p.length; i++) { st.p[i].ep = 99; st.p[i].elec = 3; st.p[i].boom = 3; }
    const c = S.computeCost(st, 0, key);
    return (c && c.ok) ? c.ep : null;
  }

  function oneGameN(choosers, seed, n, opts) {
    /* v1.4.0：模式可传（默认 'multi'）—— 5 血长程模式的评测要在这里换考卷 */
    const st = S.createState((opts && opts.mode) || 'multi', { next: mulberry32(seed) }, n, opts);
    st.slotSalt = slotSaltFor(seed);
    Play.autoGameN(st, choosers, undefined, (opts && opts.onRoundStart) || undefined);
    const dmg = [];
    for (let i = 0; i < n; i++) dmg.push(0);
    for (const e of st.events) if (e.type === 'damage' && e.to != null) dmg[e.to] += e.amt;
    return { winner: st.winner, rounds: st.round, dmg: dmg, state: st };
  }

  /* 名次（1 = 第一）：按（存活/血量）降序 */
  /* Q2(i) 完整名次（千问方案，纯训练/评测侧，不动 checkOver）：
   * 原来并列最高 HP 就判"平局"，但实测镜像平局里 89~93.5% 的三家 HP 向量本身可分
   * → 等于白扔一半训练样本。这里改成完整排序打破平局：
   *   存活优先 → HP 降序 → 累计承伤升序。
   * ⚠️ 只在**原来判平的地方**分出 1/2/3 名，胜/平/负的分值一律不变——
   *    历史上 deal/proact"奖励打伤害"养出过"打伤害不赢"的过拟合，次级键绝不能拿来加分。 */
  /* 名次（v1.3.57 修座位效应与平局问题）
   *
   * 旧实现：`alive → hp 降 → taken 升`，**没有 pid** ⇒ 完全并列时落到 Array.prototype.sort
   * 的稳定性 = 插入顺序 = **pid 升序**。实测（tools/rank-diag.mjs, 800 局 5 人对称场）：
   *   89.9% 的玩家处在并列组里，各座位 1st 率 P0=61.9% … P4=7.5%（极差 54.4pt）；
   *   把末位平局换成种子随机后 → 18.0/21.5/20.8/19.6/20.1%（极差 3.5pt）。
   * ⇒ 那个梯度**完全是名次规则的产物**，不是引擎的。
   *
   * 修法两条：
   *   1) 加第 4 键 **dealt（累计造成伤害）降序**——`damage` 事件现已带 `source`
   *      （地雷伤害 source=null，按规则不归属任何人）。它比"挨打少"更接近"打得好"，
   *      且与 pid 无关（实测可拆开 13% 对称场 / 55% 真实场的并列组）。
   *   2) 仍完全并列者 → **用本局 rng 洗牌后再稳定排序**：给定对局种子是确定性的，
   *      但在座位上**无偏**。这样名次仍是严格排列（所有调用方与历史指标口径不变），
   *      而"低 pid 白拿并列第一"这个 artifact 消失。
   * ⚠️ 不要退回"并列按 pid 升序"：那等于给座位 0 送分。 */
  function rankOf(st, seat, seed) {
    const n = st.p.length;
    const taken = [], dealt = [];
    for (let i = 0; i < n; i++) { taken.push(0); dealt.push(0); }
    for (const e of st.events) {
      if (e.type !== 'damage') continue;
      if (e.to != null) taken[e.to] += (e.amt || 0);
      if (e.source != null) dealt[e.source] += (e.amt || 0);
    }
    const order = [];
    for (let i = 0; i < n; i++) {
      const hp = Math.max(0, st.p[i].hp);
      order.push({ i: i, alive: hp > 0 ? 1 : 0, hp: hp, taken: taken[i], dealt: dealt[i] });
    }
    /* 洗牌种子：**由调用方传入"本局种子"**（每个调用方手里都有）。
     * 三个都不能用：
     *   ✗ 消耗 st.rng —— 不幂等，同一局问多个座位会得到互相矛盾的名次；
     *   ✗ 用 (round, events.length) 派生 —— 对称场里大量对局取值相同 ⇒ 少数几个排列被
     *     反复使用，pid 偏置重新出现（实测极差 18.7pt，而每局种子只有 3.5pt）；
     *   ✗ 退回"并列按 pid 升序" —— 等于给座位 0 送分（实测极差 54.4pt）。
     * 未传 seed 时退化为"事件流哈希"（只取与 pid 无关的量），保证有熵、且仍确定。 */
    let sd;
    if (typeof seed === 'number' && isFinite(seed)) sd = (seed >>> 0) || 1;
    else {
      let h = (0x9e3779b9 ^ Math.imul(n, 2654435761) ^ Math.imul(st.round || 0, 40503)) >>> 0;
      for (let k = 0; k < st.events.length; k++) {
        const e = st.events[k];
        h = (Math.imul(h ^ ((e.type || '').length + 1), 16777619) ^ Math.imul(((e.amt || 0) + 1), 2246822519)) >>> 0;
      }
      sd = h || 1;
    }
    const prnd = mulberry32(sd);
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(prnd() * (k + 1));
      const t = order[k]; order[k] = order[j]; order[j] = t;
    }
    order.sort(function (a, b) {
      if (a.alive !== b.alive) return b.alive - a.alive;
      if (Math.abs(b.hp - a.hp) > 1e-9) return b.hp - a.hp;
      if (a.taken !== b.taken) return a.taken - b.taken;
      return b.dealt - a.dealt;
    });
    for (let k = 0; k < order.length; k++) if (order[k].i === seat) return k + 1;
    return n;
  }

  /* 经济统计：本局"达到过的最高 ep"与"贵技能（ep ≥ 2）出手次数"。
   * 经济锁死的病根：AI 永远停在 ep≤1 的 ジ→枪 循环，2 ジ 以上技能永久不可负担。
   * 旧 fitness 的 proact/deal 奖励"立刻打伤害"，而攒钱必须先连出ジ（0 伤害）→
   * 旧口径实际上在惩罚攒钱，故加 save/conv 两项把梯度补上。 */
  function makeEconChooser(inner, agg, teacherFn, imitB, onlyKey, subFlag) {
    const rec = { maxEp: 0, heavy: 0, hold: 0, heavy4: 0 };
    const fn = function (state, pid, legal) {
      const p = state.p[pid];
      if (p && p.ep > rec.maxEp) rec.maxEp = p.ep;
      /* ===== v1.5.96：**真示范**（override），而不是只奖励"与教师一致" =====
       * 现状（v1.5.31 起的 C 方案）：教师只用于 `_mt/_mm` 一致性计数，进 fit 的是 `imitB × 一致率`
       * ⇒ 策略**从来没有真的走过教师那条线**："环先付 3 ジ、之后每回合 +3"这种**跨回合后果**从未被体验
       * ⇒ 学不到"它值多少"（第九轮复核 §5-2 的**价值估计病**：可负担 59~98% / 候选表 100% / 转化 0.00%）。
       * 打开 `IMIT_OVERRIDE`：以 `imitB` 的概率**直接执行教师的动作**（退火期后自动失效，与一致性奖励同一条退火管道）；
       * 只在教师给的动作**确实可负担**时才覆盖（否则会白扔一回合，把示范教成"浪费"）。
       * **默认关 ⇒ 行为一字不变**（旧产物、旧读数仍可比）。 */
      /* v1.5.99：`IMIT_SUB_ONLY` —— "只教目标卡"的示范**只在补贴局里发生**。
       * 理由（v1.5.98 §3 的机制结论）：原生经济里示范"开环"≡ 对"攒"征税（逼它把攒的 ep 花掉）；
       * 补贴局里花的是**白来的 ep**（`regenForGame`/承诺局）⇒ 不构成对"攒"的惩罚。
       * 只对**设了 `onlyKey`** 的示范生效 ⇒ 段1（教攒、不设 only）**不受影响**。 */
      const subOK = (!IMIT_SUB_ONLY || !onlyKey || !!subFlag);
      if (IMIT_OVERRIDE && teacherFn && imitB > 0 && subOK && state.rng && typeof state.rng.next === 'function') {
        if (state.rng.next() < imitB) {
          const ta = teacherFull(teacherFn, state, pid, legal);
          const okL = ta && ta.key && legal.some(function (l) { return l.key === ta.key && l.affordable; });
          /* v1.5.98：`onlyKey` 未设 ⇒ 与旧版一致；设了 ⇒ **只覆盖教师真要教的那张卡**。 */
          if (okL && (!onlyKey || ta.key === onlyKey)) {
            if (agg) { agg.use[ta.key] = (agg.use[ta.key] || 0) + 1; }
            return ta;
          }
        }
      }
      const a = inner(state, pid, legal);
      // 真实费用必须走 computeCost（R.byKey[key].cost 是数字，不是对象）
      if (a) {
        if (agg) {
          agg.use[a.key] = (agg.use[a.key] || 0) + 1;
          if (!agg.aff) agg.aff = {};
          for (let ai = 0; ai < legal.length; ai++) if (legal[ai].affordable) agg.aff[legal[ai].key] = 1;
        }
        // C 方案：与脚本教师比对（只在退火期内计数）
        if (teacherFn && imitB > 0 && agg) {
          const tk = teacherAction(teacherFn, state, pid, legal);
          /* v1.5.98：`onlyKey` 过滤**也适用奖励计数** —— 只对"教师真要教的那张卡"计一致性；
           * 否则"与教师的 fallback（蓄能/ジ）一致"会白拿奖励，正是抹掉"攒"的那股力。
           * v1.5.99：`IMIT_SUB_ONLY` 同理也适用计数（否则奖励侧仍在原生局里推它花掉攒的 ep）。 */
          if (tk != null && (!onlyKey || tk === onlyKey) && subOK) {
            agg._mt = (agg._mt || 0) + 1; if (a.key === tk) agg._mm = (agg._mm || 0) + 1;
          }
        }
        const c = S.computeCost(state, pid, a.key);
        if (c && c.ok) {
          if (c.ep >= 2) rec.heavy++;
          /* v1.5.116：花在"会造成伤害"的卡上的 ep（`R.ATK_EFFECT` 是规则里声明的攻击向卡表）⇒
           * `CONV_OFFENSE` 用它做分子，专治"把兑现奖励刷成乱摁防御"这条 captured 路径。 */
          if (R.ATK_EFFECT.indexOf(a.key) >= 0) rec.offSpend = (rec.offSpend || 0) + (c.ep || 0);
          if (c.ep >= 4) rec.heavy4++;
          // 攒钱动作：手里有 ep 却选择不花钱。
          // 这是每一步都可得的稠密信号——否则 ep=1 时 99.8% 选枪，
          // "攒到 ep>=2" 这个事件几乎采样不到，奖励再大也拿不到梯度。
          if (c.ep === 0 && p && p.ep >= 1) rec.hold++;
        }
      }
      return a;
    };
    fn.rec = rec;
    return fn;
  }

  const DIV_BETA = 0.60;   // 技能覆盖熵权重
  /* 攒钱奖励上限（到 target 点满额）。v1.5.116：改成 let 并接入 econ-env 的覆盖通道
   * （env 名见 `server/econ-env.mjs` —— **这里不要写字面的 env 名**：D77 是全文扫描，
   * 注释里出现一个 `EPIRUS_*` 就会被判成"第二个读取点"而打红）。默认 0.05 ⇒ 出厂行为不变。 */
  let STOCK_BONUS = 0.05;
  const HOARD_PEN = 0.12;    // 囤积惩罚上限（到 cap×HOARD_CAP_MULT 满额）
  /* ===== v1.5.116（第十二轮复核 L2′）：把经济 shaping 的"阶梯"换回"斜率"，**默认全关 ⇒ 出厂行为一字不变** =====
   * 复核实测（docs/OPTIMIZATION-ep-cliff.md §3/§5）：
   *   · 惩罚挂在 `maxEp` ⇒ 对照（峰 ep 39.9·胜 8.3%）与环×8（峰 21.3·胜 27.1%）**同为 −0.070**，分不开好坏；
   *   · 2C 处 `min(1,·)` 夹住 ⇒ 环线的目标区间（ep 20~100）**整个在夹住之后**，攒 43 与攒 99 同一个分；
   *   · `conv` 只数到 2 次 cost≥2 ⇒ 实测各臂"累计出手"1.2 → 5.5 横跨 4 倍，奖励只体现在前 2 次。
   * 修法不是把权重调大（用户"奖惩不用给太多"的裁定继续成立），而是**换成不会被夹住的分母**。 */
  let HOARD_LEFTOVER = false;   // true ⇒ 惩罚自变量 maxEp → **终局余款**（攒钱奖励那一段不动）
  let CONV_RATIO = false;       // true ⇒ conv 第一改数从"次数/2 封顶" → **已花 ep / 已获得 ep**
  let CONV_OFFENSE = false;     // true ⇒ 上面那个"已花"**只算花在会造成伤害的卡上**（防"龟壳 captured"，见日志 00:41）
  let HOARD_CAP_MULT = 2;       // 饱和点 = C×mult；默认 2 ⇒ 与现状逐位相同

  /* ===== 经济 shaping 的门槛：按 (人数, 模式) 定（v1.5.6，用户裁定）=====
   * 用户回忆的"ep 奖励/惩罚"就是这个 stock 项；此前门槛**写死 4/10**、与人数和模式无关，于是
   * 5 血里 11 ep 就被当囤积。用户给的锚点：
   *   · 3 人局       → 奖励到 **3 ep**、惩罚 **>10 ep**
   *   · 5 人 · 5 血   → 奖励到 **5 ep**、惩罚 **>20 ep**
   * 取：奖励点 T = 3（≤3 人）/ 4（4 人）/ 5（5 人）；惩罚点 C = 10（3 血）/ 20（长程 5 血）。
   * 其余组合落在两端之间且单调 ⇒ 不再出现"5 血里 11 ep 就被罚"的错配。 */
  function economyTargets(n, mode) {
    return { target: (n <= 3 ? 3 : (n >= 5 ? 5 : 4)), cap: (mode === 'long' ? 20 : 10) };
  }
  let ECO_T = null, ECO_C = null;     // 显式覆盖（默认 null ⇒ 走 (n, mode) 推导）
  let DIV_W = 0.06;
  /* v1.5.124（复核 §28a）：**广度收益项**的权重与阈值（默认关 ⇒ 出厂行为一字不变）。
   * 形状：G 从 `WIDTH_FLOOR` 到 `WIDTH_TARGET` 线性给钱 ⇒ 与 `DIV_W` 那个"归一化熵"不同，**刷不动**。 */
  let WIDTH_W = 0, WIDTH_FLOOR = 3, WIDTH_TARGET = 7;
  /* v1.5.126（用户洞察）：**贵卡**（cost≥3 或需珠）出手的奖励权重（默认关）。 */
  let BIGCARD_W = 0;
  /* ===== P2（qoder-research 0920 · RESEARCH-QUEUE P2 / RESEARCH-LOG §11-附-3）：**形状适应度**权重（默认关）=====
   * 三角跷跷板：{主动清场}↔{按住只枪}↔{防珠线}，教师课程怎么排都只能占两边（段与段互相覆盖）。
   * 这一项不示范动作，而是把"4 席家族压在外部压迫席身上的伤害"这一**后果**直接进 fit。
   * 评分器由宿主注入（`server/shape-scorer.mjs` 复用 `tools/v2v4-lib.mjs` 的 `duelAssembly` ⇒ D107 单一来源不破），
   * evo 只认 `global.__shapeScorer(params) → 0..1`。默认 0 ⇒ **严格不加项**（0*NaN 的教训：关着就一个字节都不碰）。 */
  let S4_W = 0;
  /* v1.5.86（附录 D6）：分母必须是**固定目标**，不能用"当时可负担的技能数" ——
   * 否则"把菜单变穷"就能把 divNorm 刷高（臂 A 实测：DIV_W×5 后产物 G=1.24/1.90，
   * 比默认臂被拒的 2.3~2.8 更低，全被健康门禁拦下、零产物）。
   * 现在固定成 K：只有把直方图铺开到 ~K 种非ジ技能才能拿满。可用 EPIRUS_DIV_K 调。 */
  let DIV_K = 6;
  /* ===== v1.5.93（用户裁定）：把"类间"那一层从 4 个 `cat` 换成**功能角色表** =====
   * 历史（v1.5.92）：`混 = (1−W)·S_flat_norm + W·S_cat_norm`，`S_cat_norm = H(cat 分布)/ln(K_CAT)`。
   * **实测否掉了它**（CHANGELOG v1.5.92 §4/§5）：`W=1` 时类间熵**没升**（0.181 vs 对照 0.194），
   * 2/3 产物塌成纯 attack；`W=0.5` 抬起来的 `S_cat` 只来自**个别 token 行为** ——
   * skill report 显示处理臂与对照臂的**逐卡分布几乎相同**（激光剑 25.0% vs 24.0%、狙击 6.1% vs 6.4%）。
   * 根因：`cat` 只有 4 类，而 `attack` 里混着三种**不同功能**（枪=廉价压制 / 激光剑=穿透反射 / 狙击=穿透防御）
   * ⇒ **几次出手就能把 4 类熵拉满**，它量到的不是能力。
   * ⇒ 换成 `roleOf(k)` 的 **8 个功能角色**，类间熵分母相应变成 `ln(K_ROLE)`。
   * 公式形状不变（只换那一层的分区）：`混 = (1−DIV_ROLE_W)·S_flat_norm + DIV_ROLE_W·S_role_norm`
   *   `S_flat_norm` = 现口径 `spH/ln(DIV_K)`（角色间 + 角色内）；`S_role_norm` = `H(role 分布)/ln(K_ROLE)`。
   * ⇒ `DIV_ROLE_W = 0`（默认）时**逐位等于旧行为** ⇒ 旧产物、旧读数仍可比（"默认不设即不变"的规矩）。
   * 命名：v1.5.92 的 env `EPIRUS_DIV_CATW` **仍可用**（旧名兜底、新名 `EPIRUS_DIV_ROLEW` 优先）。
   * 真源：本函数与 `tools/audit-lib.mjs` 的 `breadthProfile` **共用同一个**（tools 侧调 `T.roleOf`）。 */
  function roleOf(k) {
    /* 推导**只用 `rules.js` 已声明的字段**（`cat` / `pierce.{defense,reflect}` / `dmg.amt`），
     * **不写任何卡名清单** —— 手搓白名单是本仓库踩过三次的坑（D81 钉住"不得枚举卡名"）。
     * ⚠️ 与"按落地伤害加权"（用户 v1.5.91 否掉的）不是一回事：这里用 `dmg.amt` 只做**分类**、
     *    不做**权重**；每个角色内部对卡仍是**对称的熵**，没有给任何一张卡专属梯度。
     * ⚠️ 诚实的局限：`utility` 一个人吞了 11 张（规则没给更细的声明字段）⇒ 这一层对"控制类"仍不敏感；
     *    要再细就得动 `rules.js`（=指纹集，用户裁定"别动规则"）或手搓白名单（更糟）⇒ 到此为止并记录。 */
    if (k === R.SK.JI) return 'ji';
    const c = R.byKey[k];
    if (!c) return 'unknown';
    if (c.cat === 'energy') return 'economy';                 // 蓄能 / 聚能环
    if (c.cat === 'defense') return 'defense';                // 防御/反弹/八卦阵/无极变速/金刚盾/藤甲/原型制御/全息屏障
    const pi = c.pierce || {};
    if (pi.defense && pi.reflect) return 'pierceBoth';        // 狙击枪 / 电磁炮（同时穿防 + 穿反）
    if (pi.reflect) return 'pierceReflect';                   // 激光剑
    if (pi.defense) return 'pierceDefense';                   // 坦克
    if (c.dmg && Number(c.dmg.amt) >= 2) return 'burst';      // 真正的落雷
    if (c.dmg) return 'damage';                               // 枪 / 摄魂指法 / 双枪射手
    return 'utility';                                         // 11 张：地雷/挑衅/净化/镜面反射/天火…
  }
  const K_ROLE = (function () {
    const m = {};
    for (const k in R.byKey) { if (k !== R.SK.JI) m[roleOf(k)] = 1; }
    return Math.max(1, Object.keys(m).length);
  })();
  let DIV_ROLE_W = 0;
/* v1.5.88（用户裁定 甲）：退火强迫多样性的窗口代数（0=关）与破墙硬过滤开关。 */
let DIV_FORCE_GENS = 0;
let WALL_FILTER_ON = false;
let WALL_GAMES = 3;
  /* 单局"攒钱/囤积"分：0→T 线性升到满额 ⇒ T..C 不奖不罚 ⇒ 超过 C 按超出比例罚（2C 满额）。
   * 提成纯函数是为了能**直接单测门槛语义**（np-test D15），不必靠跑一遍训练去看数字。 */
  function economyStock(mEp, n, mode, leftEp) {
    const d = economyTargets(n, mode);
    const T = Math.max(1, ECO_T != null ? ECO_T : d.target);
    const C = Math.max(T, ECO_C != null ? ECO_C : d.cap);
    const M = Math.max(1, HOARD_CAP_MULT);
    /* L2′-①：把**罚分**的自变量从"本局最高"换成"终局余款" ⇒ "攒到 40 花光赢下来"不再和
     * "攥着 40 点被打死"同分。**奖励那一支不动**（`maxEp` 问的是"能不能跨过 T 这个门槛"，与余款无关；
     * 若让它也跟着余款走，就变成"结束时留点钱有奖"，那是反向激励）。 */
    if (HOARD_LEFTOVER && leftEp != null) {
      const bonus = mEp <= T ? STOCK_BONUS * (mEp / T) : STOCK_BONUS;
      return bonus - HOARD_PEN * Math.min(1, Math.max(0, leftEp - C) / (C * (M - 1)));
    }
    if (mEp <= T) return STOCK_BONUS * (mEp / T);
    if (mEp <= C) return STOCK_BONUS;
    return STOCK_BONUS - HOARD_PEN * Math.min(1, (mEp - C) / (C * (M - 1)));   // M=2 ⇒ 与旧式逐位相同
  }
  /* 技能覆盖熵奖励（v1.5.6：**用户要求恢复**；Q3 曾把它移出目标函数）。
   * Q3 的理由仍成立（熵与"见过那个状态"是两回事、光加熵会推向乱打），所以权重**给得很小**（DIV_W），
   * 只当"别把自己塔成一招"的弱先验 —— 与"奖惩不用给太多"的要求一致。 */
  /* v1.5.116 新增五个旋钮（L2′ 去阶梯化 + 攒/花两侧的斜率），全部**默认关闭/默认旧值** ⇒ 不设 env 时
   * 出厂行为逐位不变。三个提案的语义、实测依据与判据见 docs/OPTIMIZATION-ep-cliff.md §5 L2′。
   * ⚠ 这五个 `if (o.X != null)` 必须留在 setter 的**开头 1200 字符内** —— 门禁 D77 是用
   *   `setter.slice(i0, i0+1200).indexOf('o.'+key+' != null')` 查"econ-env 返回的键有没有被认"，
   *   写在后面会被判"未接受"（我第一版就栽在这里，注释把长度顶出了窗口）。
   * 不要再加别名键 —— setter 开头 1200 字符是硬预算，多一个键就挤掉 wallGames。
   * ⚠ 这五个 handler 写成**两条紧凑行**也是门禁逼的：D77 用 `slice(0,1200).indexOf('o.'+key+' != null')`
   *   查"econ-env 返回的键有没有被认"，而文件是 **CRLF** ⇒ 每个换行算 2 个字符，窗口比看起来小得多
   *   （实测：一行一个键时 `wallGames` 落在 1202 ⇒ 红；注释写进函数体里也会把窗口吃掉）。 */
  function setEconomyReward(o) {
    o = o || {};
    /* qoder-research 0920（RESEARCH-LOG §5b）：环奖励权重接进 econ-env 单一来源（默认不设 ⇒ RING_W 原样 0.10）。
     * setRingReward 自带 `isFinite && >=0` 校验；调用发生在模块求值之后 ⇒ 无 TDZ 问题（RING_W 声明在 :1955）。 */
    if (o.ringW != null) setRingReward(o.ringW);
    /* v1.5.141（DS 研究）：**珠奖励标度**走同一条 econ-env 单一来源（默认不设 ⇒ BEAD_W 原样 0.05）。
     * setBeadReward 自带 `isFinite && >=0` 校验（同 setRingReward）；用途见 RESEARCH-LOG-2026-09-21-ds.md §7。 */
    if (o.beadW != null) setBeadReward(o.beadW);
    /* P2（qoder-research 0920）：形状适应度权重走 econ-env 单一来源（默认不设 ⇒ 0 ⇒ 严格不加项）。 */
    if (o.s4W != null) S4_W = Math.max(0, Number(o.s4W) || 0);
    if (o.divRoleW != null) DIV_ROLE_W = Number(o.divRoleW) || 0;
    else if (o.divCatW != null) DIV_ROLE_W = Number(o.divCatW) || 0;
    if (o.divForceGens != null) DIV_FORCE_GENS = Math.max(0, Number(o.divForceGens));
    if (o.bigcardW != null) BIGCARD_W = Math.max(0, Number(o.bigcardW)); if (o.widthW != null) WIDTH_W = Math.max(0, Number(o.widthW)); if (o.blockW != null) BLOCK_W = Math.max(0, Number(o.blockW));
    if (o.hoardOnLeftover != null) HOARD_LEFTOVER = !!o.hoardOnLeftover; if (o.convRatio != null) CONV_RATIO = !!o.convRatio; if (o.convOffense != null) CONV_OFFENSE = !!o.convOffense;
    if (o.hoardCapMult != null) HOARD_CAP_MULT = Number(o.hoardCapMult) || 1; if (o.stockBonus != null) STOCK_BONUS = Number(o.stockBonus) || 0;
    if (o.target != null) ECO_T = Math.max(1, Number(o.target));
    if (o.cap != null) ECO_C = Math.max(1, Number(o.cap));
    if (o.divW != null) DIV_W = Math.max(0, Number(o.divW));
    if (o.divK != null) DIV_K = Math.max(2, Number(o.divK));
    if (o.wallFilter != null) WALL_FILTER_ON = !!o.wallFilter;
    if (o.wallGames != null) WALL_GAMES = Math.max(1, Number(o.wallGames));
    if (o.reset) {
      ECO_T = null; ECO_C = null;
      HOARD_LEFTOVER = false; CONV_RATIO = false; CONV_OFFENSE = false; HOARD_CAP_MULT = 2; STOCK_BONUS = 0.05; BLOCK_W = 0; WIDTH_W = 0; BIGCARD_W = 0;
      /* qoder-research 0920：D77 的运行时往返会喂**每个键**的哨兵再 reset —— ringW/s4W 是后加的键，
       * 漏在这里会把 0.5 的哨兵泄漏给后续门（s4W 泄漏 = 后续 scoreMemberN 直接抛错）。
       * ⚠️ D109 第一次跑红还顺带抓出一个**既存泄漏**：`wallFilter` 的哨兵 true 从没被 reset 抹掉
       *   （D77 的 finally 只补了 divRoleW）⇒ 后续任何 scoreMemberN 都活在"破墙硬过滤开着"的假世界里。
       *   一并收进 reset。 */
      S4_W = 0; setRingReward(0.10); setBeadReward(0.05); WALL_FILTER_ON = false; WALL_GAMES = 3;
    }
    return economyReward();
  }
  function economyReward() {
    return { targetOverride: ECO_T, capOverride: ECO_C, divW: DIV_W, divK: DIV_K, divRoleW: DIV_ROLE_W, divCatW: DIV_ROLE_W, K_role: K_ROLE,
      divForceGens: DIV_FORCE_GENS, wallFilter: WALL_FILTER_ON,
      stockBonus: STOCK_BONUS, hoardPen: HOARD_PEN,
      hoardOnLeftover: HOARD_LEFTOVER, convRatio: CONV_RATIO, convOffense: CONV_OFFENSE, hoardCapMult: HOARD_CAP_MULT,
      blockW: BLOCK_W, widthW: WIDTH_W, bigcardW: BIGCARD_W, wallGames: WALL_GAMES, ringW: RING_W, s4W: S4_W,
      /* v1.5.141（DS）：`beadW` 必须能从读回接口看到 —— D77 的运行时往返要求 `ECON_REWARD_KEYS` 的
       * 每个键都"设得进、读得回"（np-test.mjs:3289 的 `f in back`）；只接 setter 不接读回 ⇒ 门红。 */
      beadW: BEAD_W,
      at3: economyTargets(3, 'multi'), at5long: economyTargets(5, 'long') };
  }

  /* ===== 反摆烂：哨声惩罚 + 出手权重（v1.5.8）=====
   * 为什么必须加：多人局的胜利条件允许"**熬到回合上限比血量**"，而考卷（1st 率）**看不出**
   * "熬"与"打"的区别。实测（`tools/champ-audit.mjs`，5 座全是同一个冠军的自对局）：
   *   long-33（v1.5.7 我曾换上线）→ 考卷 **45.3%**，但自对局 **20/20 局零伤害、60 回合全平局**；
   *   long-34                        → 考卷 32.9%，自对局 **19.7 伤害/局**（全是 cost≥3 重击）、28.7 回合。
   * ⇒ 光看考卷会把"摆烂"当成强度（千问体检 §5-4 早就点过："能量出'赢'还是'熬'"）。
   * 这里给"熬出来的胜利"打折：终局时**还有 ≥2 人活着**（没人被淘汰）⇒ 判为哨声局。
   * 反证（np-test D18）：把 rankCredit 里的哨声判断删掉，D18 立刻红。 */
  let WHISTLE_PEN = 0;      // 0 = 关（默认）；数字 = 显式覆盖（v1.5.12 起不再有"长程自动 0.5"）
  let DEAL_W = 0.01;        // 出手奖励权重（原值写死 0.01）
  /* v1.5.14（用户裁定 **选项 A**：训练侧加"先手/首次伤害"激励）：**默认关**，靠
   * `EPIRUS_FIGHT_DEAL` / `EPIRUS_FIGHT_FIRST` 打开 —— 沿用 v1.5.12 的教训：不猜默认值，
   * 先用对照臂证明它有效，再由用户决定是否改成默认。
   * 动机（REVIEW §12）：多人局里 `防御/反弹/八卦阵` **费用都是 0** ⇒ 摆架势是免费的免伤，
   * 而进攻要花 1~2 ep 还把自己变成靶子 ⇒ 学出"互戒均衡"（人类不出手时 AI 架势率 75~96%）。
   * 适应度现有两项都不足以破局：`deal` 只有 0.01；`proact` 是**相对全场均值**的，
   * 全场 0 伤害时它恒等于 0 ⇒ 对称局面下没有梯度去当先出手的人。
   * 关键区别：**首伤奖励是"区分名次"的项**（每局只有一个席位拿到），而统一加在所有人身上的项
   * （如哨声惩罚）在对称局面里不改变排序 ⇒ 这是它可能有效的原因。 */
  let FIRST_W = 0;          // 0 = 关；>0 = 本局第一个造成伤害的席位拿这么多
  /* v1.5.12 回滚 v1.5.11 的"长程默认 0.5"——**实测证明它在长程是空操作**。
   * 证据（`lngC` = 长程·自动 0.5 vs `lngD` = 长程·显式 0，其余全同，6 seed；见 REVIEW §11.8）：
   * 两份产物**逐字节相同**，而 meta 分别正确记着 `whistlePen:0.5/override:null` 与 `0/override:0`
   * ⇒ 接线没问题，是**这条规则在长程从不触发**：终局收缩 + 5 血 ⇒ 长程局几乎总以"有人被淘汰"结束，
   * `aliveEnd >= 2` 的哨兵局 ≈ 0%。
   * 惩罚真正有用的是**多人 3 血**（上限 60、收缩不触发 ⇒ 哨兵局常见，v1.5.9 实测有效）——
   * 那个场景用 `EPIRUS_FIGHT_WHISTLE` 显式开即可，不要用"按模式猜"的默认值。 */
  function whistlePenNow() { return WHISTLE_PEN; }
  function rankCredit(rank, aliveEnd) {
    const base = rank === 1 ? 1.0 : (rank === 2 ? 0.3 : 0.0);
    const pen = whistlePenNow();
    return (pen > 0 && aliveEnd >= 2) ? base * (1 - pen) : base;
  }
  function setFightReward(o) {
    o = o || {};
    if (o.whistlePen != null) WHISTLE_PEN = Math.max(0, Math.min(1, Number(o.whistlePen)));
    if (o.dealW != null) DEAL_W = Math.max(0, Number(o.dealW));
    if (o.firstW != null) FIRST_W = Math.max(0, Number(o.firstW));
    if (o.reset) { WHISTLE_PEN = 0; DEAL_W = 0.01; FIRST_W = 0; }
    return fightReward();
  }
  function fightReward() { return { whistlePen: whistlePenNow(), override: WHISTLE_PEN, dealW: DEAL_W, firstW: FIRST_W }; }
  /* v1.5.14：本局**第一个造成伤害**的席位（= 先手方）。只看带 source 的 damage 事件 ——
   * 终局收缩的伤害是 source:null（场地效果），不算任何人的先手。抽成纯函数是为了能钉语义（np-test D21）。 */
  function firstBloodSeat(evs) {
    if (!evs) return null;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.type === 'damage' && e.source != null) return e.source;
    }
    return null;
  }

  /* ===== 技能覆盖熵（v1.5.8：**只统计非ジ动作**，用户裁定）=====
   * 为什么要排除ジ：熵是按**动作分布**算的，而"攒钱/等待"就是反复出ジ ⇒ 攒钱会把熵压到极低
   * ⇒ 熵奖励其实在**惩罚攒钱**，与 ep 攒钱奖励（stock 项）互相打架。
   * 实测（v1.5.7 的奖励 A/B，同一引擎、只差奖励设置）把熵奖励从 0 提到 0.06：
   *   **最高 ep 44.8→12.8、ep≥3 决策占比 34.3%→5.8%**（出手种类 13.7→14.8 确实变广）。
   * ジ 是"这一回合不做事"的基线动作，把它算进"广度"是在量错东西。
   * 归一化分母也要**排除ジ**（否则分母里那个ジ会让熵永远到不了 1）。
   * 反证（np-test D17）：把 `k === R.SK.JI` 的排除去掉，D17 立刻红。 */
  function coverageEntropy(use, affKeys, capDiv) {
    let tot = 0, ji = 0, distinct = 0;
    for (const k in use) {
      if (k === R.SK.JI) { ji += use[k]; continue; }
      if (use[k] > 0) distinct++;
      tot += use[k];
    }
    if (tot <= 0) return { divNorm: 0, H: 0, nonJi: 0, ji: ji, distinct: 0 };
    let H = 0;
    for (const k in use) {
      if (k === R.SK.JI) continue;
      const pr = use[k] / tot;
      H -= pr * Math.log(pr);
    }
    let div;
    if (capDiv != null) div = Math.max(2, capDiv);
    else { let aff = 0; for (const k in (affKeys || {})) if (k !== R.SK.JI) aff++; div = Math.max(2, aff); }
    return { divNorm: H / Math.log(div), H: H, nonJi: tot, ji: ji, distinct: distinct };
  }

  /* N 人适应度（N19）：名次基础分（1/0.6/0.2）+ 轻量 shaped 项 */
  /* 从一局的事件流里数"我打断开环者"的次数（**纯函数**，便于守门单测）：
   *   ① 对手在开环的判据 = 他有一次 `ep` 事件 `delta ≥ 2`（环第 2 次起 +2/+3；ジ 只 +1）；
   *   ② 记一次打断 = 同一局里**我**（source===seat）对他造成了伤害，
   *      或我这一局用了小雷（miniT）而他被作废（`voided`）。
   * 只报事实、不判断"该不该打" —— 那是网络要学的。 */
  function countRingBreaks(events, seat) {
    let breaks = 0;
    let ringers = {};
    let miniT = 0, anyRinger = false;
    const pending = [];
    for (const e of events) {
      if (e.type === 'action' && e.pid === seat && e.outcome === 'ok' && e.key === R.SK.MINI_T) miniT++;
      /* v1.5.37（复核 §5-3/反例 E）：判据改成**"该座真的施放了聚能环"这条动作事件** ——
       * 旧判据 `ep delta >= 2` 有两处错：① 漏掉环的**第一次**（delta 是 1 然后 2）⇒ 越早打断越没分；
       * ② 会把"被避雷针回馈 +4 ジ"这种非环的大额 ep 当开环。动作事件判据同时治好这两处。 */
      if (e.type === 'action' && e.pid !== seat && e.outcome === 'ok' && e.key === R.SK.RING) { ringers[e.pid] = true; anyRinger = true; }
      if (e.type === 'damage' && e.source === seat && ringers[e.to]) { breaks++; ringers[e.to] = false; }
      /* v1.5.37（复核 §5-1）：作废必须**由我造成**（byPid === 我）才算我打断的 ——
       * 此前只要求"我出过小雷"，于是"别人作废、我恰好放过小雷"会与我真打断**同分**（反例 A vs B）。 */
      if (e.type === 'voided' && ringers[e.pid] && e.byPid === seat) pending.push(e.pid);
    }
    /* v1.5.29（用户实测逼出来的关键修正）：**先把信号做密**。
     * 实测：所有历史冠军的小雷次数都是 **0** ⇒ "小雷作废开环者"这条奖励**永远触发不了**，
     * 而"不能 bootstrap 一个从未发生的动作"是奖励设计的经典死穴（环墙 85.5% 其实靠熬赢，不是打断）。
     * 于是分层给分：
     *   ① 有人开环（对手 ep 单次 ≥2）时我出了小雷 —— **0.5/次**（这个动作本身先被奖出来）；
     *   ② 小雷真的让开环者被作废 —— 每次 **+1**；
     *   ③ 我打中开环者 —— 每次 **+1**（原有）。
     * 上层小项（环惩罚/破墙/惩罚被动）仍各自 min(1, x/2) 封顶，不会让任何一项压倒胜负。 */
    /* v1.5.30（用户选 A）：密集分**每局至多一次**（原来是每次 +0.5）。
     * 起因（实测）：每次都给 ⇒ **刷小雷成了得分最高的策略**，而刷小雷的个体过不了健康门槛
     * ⇒ 每一次提升都被拒 ⇒ 6 个 seed 全部冻结在热启动种子上（v7both 臂零提升）。
     * 现在只保留"让这个动作被发现"的最小推力，不给刷分空间。 */
    if (anyRinger && miniT > 0) breaks += 0.5;
    /* 归因：作废加分必须由**我出小雷**引起（否则"别人作废了开环者"会记到我头上）。 */
    if (miniT > 0) breaks += pending.length;
    return breaks;
  }
  function scoreMemberN(params, opps, games, n, gen, idx, hGeneIn) {
    let fit = 0, first = 0, second = 0, dealt = 0, rounds = 0, played = 0, ringBreaks = 0, pressRounds = 0, pierceHits = 0, beadSpent = 0, threatHits = 0, clears = 0, blocks = 0, varietyMax = 0, bigUses = 0;
    let maxEpSum = 0, heavySum = 0, holdSum = 0, deepSum = 0, econGames = 0, epGain = 0, ringCasts = 0, stockSum = 0;
    let leftEpSum = 0, spentEpSum = 0, gainEpSum = 0;   // v1.5.116 L2′：余款/已花/已获得（每局）
    let imitSum = 0, imitGames = 0;
    /* (c) 承诺级储蓄视界 h 是**个体基因**。
     * 此前它是每局随机抽的噪声（30% 的局抽 h∈1..4）：个体不携带它 ⇒ 选择压力
     * 作用不到它 ⇒ "走通连续攒钱长轨迹"的能力没有任何机制被保留下来。
     * 现在：h=k 的个体每 3 局有 1 局跑承诺口径（ep < 1+k 只准出 ジ）+ 补贴经济。
     * 这些**承诺局一分都不进 fit**——fit 必须仍代表线上原生强度，否则又要把冠军
     * 推向"只在补贴下成立"的策略（历史上 min(pairSc, probeSc) 跨量纲就是这么塌的）。 */
    const hGene = (typeof hGeneIn === 'number' && hGeneIn > 0) ? (hGeneIn | 0) : 0;
    let fitGames = 0, commitFirst = 0, commitTop2 = 0, commitGames = 0, commitMaxEp = 0;
    const agg = { use: {}, aff: {} };
    /* v1.5.87（用户裁定 A）：自对局里**成功**的非ジ动作直方图 —— 与门禁同口径。 */
    const spUse = {};   // 该个体的动作直方图（跨局汇总：脚本对手局 + **自对局**）
    let mirrorRan = 0;                  // v1.5.19：本个体实际跑了多少局自对局（可观测）
    for (let g = 0; g < games; g++) {
      const seat = g % n;                                   // 座位轮换
      const seed = seedOfGen(gen, idx, 'n') + g * 7919;
      const choosers = [];
      /* v1.4.1 修正（我 v1.3.60 改错了）：轮换**必须与个体下标无关**。
       * v1.3.60 我用 `(g*5 + idx) % opps.length` 去解决"池子大于窗口时尾部对手轮不到"，
       * 但那个改法把**同代所有个体面对同一批对手**这个配对评估（common random numbers）拆了
       * ⇒ 个体之间的适值不可比、选择噪声变大。实测代价：同 seed 同预算下两臂（9/12 对手）
       * 考卷只到 **21.8% / 23.1%**，而按旧口径训出的 v1.3.58 是 **38.4%**。
       * 正确做法：轮换只跟**代数**走 —— 同代内所有个体仍面对同一批对手（保持配对），
       * 跨代旋转即可覆盖任意大的池子（池子 > games+3 时尾部队手也不会被漏掉）。 */
      let oi = (gen * 3 + g) % opps.length;
      const imitB = imitBetaForGen(gen);   // C 方案：脚本教师模仿奖励（退火，后期为 0）
      const commitGame = hGene > 0 && (g % 3 === 0);   // (c) 承诺局：每 3 局 1 局，h 来自基因
      const passiveField = passiveFieldAt(g);   // v1.5.65：本局是否为'4 席全被动'暴露局
      /* v1.5.99：本局是否"补贴局"（补贴 = 白来的 ep）—— 给"只教目标卡"的示范当门槛（见 makeEconChooser）。 */
      const regenThisGame = commitGame ? 2 : regenForGame(g, games);
      const subThisGame = regenThisGame > 0;
      let econ = null;
      for (let pid = 0; pid < n; pid++) {
        if (pid === seat) {
          // (c) 承诺级 ε：h 取自**个体基因**，不再是每局随机抽的噪声
          const h = commitGame ? hGene : 0;
          let baseSel = h > 0 ? makeCommitChooser(params, 0.35, h) : policyChooserN(params, 0.35, 0.15);
          /* v1.5.88（甲）：退火窗内**计分对局**也走强迫（这样被强迫的行为才会被真实评分、进而被选择）。 */
          if (DIV_FORCE_GENS > 0 && gen < DIV_FORCE_GENS) baseSel = makeDiversityForce(baseSel, gen);
          econ = makeEconChooser(baseSel, agg, imitB > 0 ? (imitTeacherForGen(gen) || BOT_PICKS['heavyfire']) : null, imitB, imitOnlyForGen(gen), subThisGame);
          /* v1.5.39：定向 ε-强迫（只影响"有滚环者且我付得起小雷"这一格；其余原样返回学习到的动作）。 */
          choosers.push(function (state, pid2, legal) {
            const _fe = ringForceEpsAt(gen);
            IN_EXPLORE = _fe > 0;   // 探索期（强迫窗口内）
            if (_fe > 0 && Math.random() < _fe) {
              const tg = ringForceTarget(state, pid2, legal);
              if (tg >= 0) return { key: R.SK.MINI_T, target: tg };
            }
            return econ(state, pid2, legal);
          });
        }
        else if (passiveField && BOT_PICKS[(g % 2 === 0) ? 'farmer' : 'deepsaver']) {
          /* 暴露度注入：这一局的 4 个对手席**全部**是被动攒钱型（轮换 farmer/deepsaver）。 */
          choosers.push(wrapBotN(BOT_PICKS[(g % 2 === 0) ? 'farmer' : 'deepsaver']));
        } else { choosers.push(wrapBotN(opps[oi % opps.length].sel)); oi++; }
      }
      // 每回合回 ep 的对局权重（可选设施，默认 0 = 与线上规则一致）。
      // 实测结论：regen=1 不能解锁聚能环（+1/回合只够每回合放一个 1 ジ技能，
      // 锁死在另一个不动点）；regen=2 确实能让 AI 学会聚能环（连用到 16），
      // 但环是严格支配策略（免费 +3/回合永续）→ 学会后反而更窄。
      // 故默认关闭，等规则/平衡决策后再开。
      /* 承诺局的"主场"是补贴经济：原生经济下 ep 根本涨不起来，"连攒 3 回合"只是一条
       * 更慢的输法，学不到任何东西。原生局仍走 Q1(d) 的永久回放切片（每 12 局 1 局带补贴），
       * 两条通道互不干扰，故 fit 的口径不被污染。 */
      const regen = regenThisGame;   // v1.5.99：上面已算好（同一口径，避免两处各算一遍）
      /* v1.5.141（DS）：补贴局里给**受评席**每回合补一颗珠 ⇒ "电磁炮"随时可负担（见 setSubBead 处的长注释）。
       * 只补受评席（`seat`）；`regen=0` 的原生局完全不走这条 ⇒ 真实强度读数量不到差别。 */
      const subBeadHook = (SUB_BEAD && regen > 0) ? function (state) {
        const me = state.p[seat];
        if (me && me.hp > 0 && !me.elec && !me.boom) me.elec = 1;
      } : undefined;
      const r = oneGameN(choosers, seed, n, { regen: regen, mode: TRAIN_MODE, onRoundStart: subBeadHook });
      const rank = rankOf(r.state, seat, seed);
      /* v1.5.8：终局还活着的人数 ⇒ 判断"这局是打出来的还是熬出来的"（≥2 人活着 = 哨声局） */
      const aliveEnd = r.state.p.filter(function (q) { return q.hp > 0; }).length;
      const base = rankCredit(rank, aliveEnd);   // N19：3 人局里第二名也算输；v1.5.8 起哨声局打折
      const others = r.dmg.reduce(function (a, b) { return a + b; }, 0) - r.dmg[seat];
      const diff = r.dmg[seat] - others / Math.max(1, n - 1);
      // "立刻出手"的权重下调（原来在惩罚攒钱）；腾出的权重给经济两项
      const proact = 0.02 * Math.max(-1, Math.min(1, diff / 6));
      const deal = DEAL_W * Math.min(1, r.dmg[seat] / 4);
      /* v1.5.14：**先手激励** —— 本局第一个造成伤害的席位拿 FIRST_W（默认 0 = 关）。 */
      const firstBonus = (FIRST_W > 0 && firstBloodSeat(r.state.events) === seat) ? FIRST_W : 0;
      const slow = 0.03 * Math.min(1, r.rounds / R.MAX_ROUNDS);
      // 攒得住：本局达到过的最高 ep（0/1/2/3 → 0/0.33/0.67/1）
      /* 分段 shaping（用户设计）：
       *   0~4 ep  → 攒钱奖励（鼓励手上有货，才能放 2~5 ジ 技能）
       *   5~10 ep → 不奖不罚（中间区交给它自己权衡）
       *   11+ ep  → 囤积惩罚（资源积着不转化成胜势 = 浪费）
       * 旧的 engine（按“获得的 ep 量”发钱）已撤：聚能环 +3/回合 vs ジ +1 →
       * 等于给刷环发三倍工资，" 永动刷环" 是奖励被 hack 的产物。
       * 标准经济下 ep 最高只有 1~2 → stock 项很小，不影响已有冠军口径。 */
      // C：模仿率（与脚本教师 heavyfire 的一致程度）
      const imit = (imitB > 0 && agg._mt) ? (agg._mm || 0) / agg._mt : 0;
      if (imitB > 0) { imitSum += imit; imitGames++; }
      const mEp = econ ? econ.rec.maxEp : 0;
      /* ===== v1.5.116（L2′）：本局这一席的 ep 账本恒等式：已获得 = 已花 + 被抢 + 终局余款 =====
       * 用恒等式而不是新加事件类型：`computeCost` 的扣费本来就**不发事件**（state.js:180 只有掉血/掉珠发），
       * 所以"已花"只能这么回收；三条都在同一份 events + 终局 p.ep 里，不引入第二口径。 */
      let gGain = 0, gLost = 0;
      for (let ei = 0; ei < r.state.events.length; ei++) {
        const e = r.state.events[ei];
        if (e.type !== 'ep' || e.pid !== seat) continue;
        if (e.delta > 0) gGain += e.delta; else gLost += -e.delta;
      }
      const gLeft = r.state && r.state.p && r.state.p[seat] ? (r.state.p[seat].ep || 0) : 0;
      const gSpent = Math.max(0, gGain - gLost - gLeft);
      leftEpSum += gLeft; spentEpSum += gSpent; gainEpSum += gGain;
      const stock = economyStock(mEp, n, TRAIN_MODE, gLeft);   // 门槛按 (人数, 模式)：3 人→3/10、5 人 5 血→5/20
      stockSum += stock;
      deepSum += econ ? econ.rec.heavy4 : 0;

      // 花得出：把攒的 ep 换成贵技能（2 次封顶）——只有 save 没有 conv 就是 farmer，故两项并重
      // 经济分档：贵的技能更值钱（不再指向某个特定循环）
      /* L2′-②：`CONV_RATIO` ⇒ 第一改数换成**比率**（0~1 天然有界、任何规模都有梯度、不奖励刷次数）；
       * 第二改数（cost≥4 的"大件至少来一次"）**保持封顶** —— 它问的是"到没到过那一档"，本来就该是台阶。 */
      /* `CONV_OFFENSE` 把分子从"花掉的钱"收窄成"花在进攻卡上的钱"（默认关 ⇒ 逐位不变） */
      const spentTerm = CONV_OFFENSE ? ((econ && econ.rec.offSpend) || 0) : gSpent;
      const conv = (CONV_RATIO ? 0.08 * Math.min(1, spentTerm / Math.max(1, gGain))
                               : 0.08 * Math.min(1, (econ ? econ.rec.heavy : 0) / 2))
                 + 0.08 * Math.min(1, (econ ? econ.rec.heavy4 : 0) / 1);
      /* 打断开环者：窄条件（真的有人开环）+ 可归因（是我打中的）⇒ 小额加分，两次封顶。 */
      const ringBonus = ringWeightAt(gen) * Math.min(1, ringBreaks / 2);
      /* v1.5.25：惩罚被动 —— 只奖"打中了且这一回合没挨打"的回合（三次封顶）。 */
      const pressBonus = PRESS_W * Math.min(1, pressRounds / 3);
      /* v1.5.29：破墙奖励 —— 只有用能穿反弹/穿防御的卡打中才记分（两次封顶）。 */
      const pierceBonus = PIERCE_W * Math.min(1, pierceHits / 2);
      /* v1.5.76（P1）：珠子闭环 —— 只奖**花掉**（囤着/过期一律不计，两次封顶）。
       * 动机：用户实测线上包 `chargeProfile` 浪费率 100%（得珠 0.30/局、花掉 0.00），
       * 而珠子消费卡（电磁炮/天火）都要 2 ジ ⇒ 蓄能常发生在 ep=1 ⇒ 下回合必然凑不出。
       * 既没有信号、也没有经济余量 ⇒ 闭环学不出来。这里补**信号**那半边。 */
      const beadBonus = BEAD_W * Math.min(1, beadSpent / 2);
      /* v1.5.79（第七轮复核 §15-1）：**优先打威胁**（反狙击/反环）。两次封顶，与其它窄奖励同尺度。 */
      const tgtBonus = TGT_W * Math.min(1, threatHits / 1);
      /* v1.5.103（v1.5.100 §20）：**清场计数**奖励 —— 补上第二个"门禁在量、选择看不见"的量。
       * 门禁要 `场B 清场 ≥ 0.3/局`（**收缩开始前真把对手打死**，不是胜率），而训练侧 `fit` 里
       * **一项都没有** ⇒ 新规则下"打 1 点就能在全灭判胜里赢"⇒ 演化没有理由去长这个能力
       * （实测：`DIV_W=0.3` + 真示范那批 6 个里 4 个场B 清场 = 0.00，在位包 0.63）。
       * 封顶 /1，与 `tgtBonus` 同尺度（标度按 v1.5.79 的教训取"0 次得 0、1 次吃满"）。 */
      const clearBonus = CLEAR_W * Math.min(1, clears / 1);
      /* v1.5.121（E4）：**挡下一次伤害** —— 与"清场"互补的那把尺子（清场 = 打死人；这个是扛住）。
       * 封顶 /1（**量出来的标度**：线上包自对局实测每席每局只有 **0.10** 次挡下、最大 0.40 ⇒
       * 用 /2 会几乎恒为 0、奖励退化成常数微扰；改用 v1.5.79 那条"0 次得 0、1 次即吃满"的规矩）。 */
      const blockBonus = BLOCK_W * Math.min(1, blocks / 1);
      /* ===== v1.5.124（复核 §28a 的处方 (ii)）：**把"广度"从门槛升格为收益项** =====
       * 病：出厂 `DIV_W=0.06` 在胜率项（量级 ~1.0）前**没有梯度**；而 `G≥3` 只是**事后砍窄包**
       * （无筛选种群 G 中位 **2.4**、12 个 seed 只有 2 个过门槛）⇒ 门槛不生产宽包。
       * ⚠️ 为什么不直接给 `divBonus` 加权：它是**归一化**熵（可行集合越穷越高 ⇒ 可被"把菜单变穷"刷高，
       * 见 v1.5.92 的注释）；这里改用**绝对**的"用过的招数种类数"（`countVariety` 去重计数），
       * 并挂在阈值之上：`≤ WIDTH_FLOOR(3)` 不给钱 · `≥ WIDTH_TARGET(7)` 给满 ⇒ 刷不动、有 0→1 梯度。
       * ⚠️ 关掉时必须是**严格 0**（`0 * NaN = NaN` 会把整个 fit 打成 NaN —— 我第一版就这么踩的）。 */
      const widthBonus = WIDTH_W > 0
        ? (WIDTH_W * Math.min(1, Math.max(0, varietyMax - WIDTH_FLOOR) / Math.max(1, WIDTH_TARGET - WIDTH_FLOOR)))
        : 0;
      /* v1.5.126（用户洞察）：**贵卡出手**奖励 —— "贵卡"由**声明字段推导**（`cost ≥ 3` 或 `energyNeeds`），
       * 不写卡名清单（D81/D72 的规矩）。这一族正是"用不上就没必要攒 ep"的那几张（大雷/地雷/净化/电磁炮/摄魂/激光眼）。
       * 标度同 v1.5.79 的规矩：**0 次得 0、1 次即吃满**（现状是 0% ⇒ 先给"从不会到会"这一步的梯度）。 */
      const bigBonus = BIGCARD_W > 0 ? (BIGCARD_W * Math.min(1, bigUses / 1)) : 0;
      /* ⚠ 标度是**量出来的**（v1.5.79 修正）：威胁命中的真实频率只有 0.30 次/局（线上包实测），
       * 用 /2 封顶时几乎每局都落在 0~0.15 ⇒ 奖励退化成常数级微扰、没有梯度。
       * 改成 /1：0 次得 0、1 次即吃满 ⇒ 约三成的局吃满，**方差大 = 真的有梯度**。 */
      const gFit = Math.max(-0.3, Math.min(1.8, base + proact + deal + firstBonus + stock + conv - slow + imitB * imit + ringBonus + pressBonus + pierceBonus + beadBonus + tgtBonus + clearBonus + blockBonus + widthBonus + bigBonus));
      if (commitGame) {
        /* 承诺局只记账，不进 fit：它们是 h 基因的存活依据 + 终局门槛的输入。 */
        if (rank === 1) commitFirst++;
        if (rank <= 2) commitTop2++;
        commitGames++;
        if (mEp > commitMaxEp) commitMaxEp = mEp;
      } else {
        fit += gFit; fitGames++;
        if (econ) { maxEpSum += econ.rec.maxEp; heavySum += econ.rec.heavy; holdSum += econ.rec.hold; econGames++; }
        // 经济引擎质量：本局获得的 ep 总量。聚能环第 3 次起每回合 +3（ジ 只 +1），
        // 直接在这个量上体现 → 不用为“环”单独写奖励，避免又指向特定循环。
        // v1.5.116（L2′）：同一件事在上面已经随 `gGain` 扫过一遍 ⇒ 这里只做累计，不再重扫 events。
        epGain += gGain;
        if (rank === 1) first++;
        else if (rank === 2) second++;
        dealt += r.dmg[seat];
        rounds += r.rounds;
        played++;
        /* v1.5.23/24：打断开环者（只用事件重建，不动引擎）；权重按**退火曲线**（前期 0）。 */
        if (ringWeightAt(gen) > 0) ringBreaks += countRingBreaks(r.state.events, seat);
        if (PRESS_W > 0) pressRounds += countPressRounds(r.state.events, seat);
        if (PIERCE_W > 0) pierceHits += countPierceHits(r.state.events, seat);
        /* v1.5.76（P1，用户实测"蓄能 100% 浪费"逼出来的）：**珠子闭环**奖励。 */
        if (BEAD_W > 0) beadSpent += countBeadSpent(r.state.events, seat);
        /* v1.5.79（复核 §15-1）：把"优先打威胁者"当能力奖（默认关，实验臂用 EPIRUS_TGT_W 打开）。 */
        if (TGT_W > 0) threatHits += countThreatHits(r.state.events, seat);
        /* v1.5.103（v1.5.100 §20）：**清场**（收缩开始前把对手打死）—— 与门禁 `场B 清场` 同口径。 */
        if (CLEAR_W > 0) clears += countClears(r.state.events, seat);
        /* v1.5.121（第十三轮复核 §23 的 **E4**）：**挡下伤害**（真的挡掉/弹走，**不认摆架势**）。
         * 论点：防御族**费用 0 ep** ⇒ 与"ep 深度"不同，它不需要多回合计划 ⇒
         * 是"shaping 只在 0.0X 尺度、买不动多回合计划"这条限制**唯一**还可能绕过的方向。 */
        if (BLOCK_W > 0) blocks += countBlocks(r.state.events, seat);
        /* v1.5.124（§28a）：**广度**的绝对量 —— 该快照里"用过的招数种类数"（去重）。
         * 取 `max` 而不是累加：要的是"这个策略的招式面有多宽"，不是"出手多少次"。 */
        if (WIDTH_W > 0) varietyMax = Math.max(varietyMax, countVariety(r.state.events, seat));
        /* v1.5.126：**贵卡**（声明费用 ≥3 或需珠）的出手 —— 用户指出"这个包不会用电磁炮/大雷、也丢了地雷/净化
         * ⇒ 它当然没必要攒 ep" ⇒ 直接给这一族付钱（它们不可刷：真的用出来才给钱）。 */
        if (BIGCARD_W > 0) bigUses += countBigCards(r.state.events, seat, R);
      }
    }
    /* ===== v1.5.19（方向 A）：自对局折进多样性 =====
     * 每局都是"n 座同一策略"⇒ 动作直方图并进 agg（只并直方图；first/played/dealt 一概不动）。 */
    /* ===== v1.5.69：**独立座位探针**（供下面的阈值式座位惩罚）=====
     * 5 席同一策略 × SEAT_GAMES 局 ⇒ 各座胜场 ⇒ 极差。独立取样（不蹭 MIRROR_GAMES=2 的局），
     * 否则样本不足 ⇒ 惩罚静默失效（v1.5.68 的实际教训）。 */
    const seatWinsProbe = new Array(n).fill(0);
    let seatDec = 0;
    if (SEAT_GAMES > 0) {
      for (let g = 0; g < SEAT_GAMES; g++) {
        const st = S.createState(TRAIN_MODE === 'long' ? 'long' : 'multi', { next: mulberry32(31000 + gen * 131 + idx * 17 + g) }, n);
        st.slotSalt = slotSaltFor(31000 + gen * 131 + idx * 17 + g);
        const chs2 = [];
        for (let pid = 0; pid < n; pid++) chs2.push(makeEconChooser(policyChooserN(params, 0.35, 0.15), agg, null, 0));
        Play.autoGameN(st, chs2);
        if (st.winner !== 'draw' && st.winner != null) { seatWinsProbe[st.winner]++; seatDec++; }
        /* v1.5.87：累计"成功非ジ动作"，与 mirrorHealth 的 keyCount **同口径** ——
         * 老的 agg.use 收的是 chooser 返回的每一个动作（含探索 ε、econ 覆盖、作废/失败）⇒
         * 加大熵权重优化的是那个量，门禁的 G 不涨甚至下降（这就是用户问到的现象）。 */
        for (const e of (st.events || [])) {
          if (e.type === 'action' && e.outcome === 'ok' && e.key && e.key !== R.SK.JI) spUse[e.key] = (spUse[e.key] || 0) + 1;
        }
      }
    }
    const mirSeatWins = seatWinsProbe;
    const mirDec = seatDec;
    if (MIRROR_GAMES > 0) {
      for (let g = 0; g < MIRROR_GAMES; g++) {
        const seed = seedOfGen(gen, idx, 'mir') + g * 6151;
        const chs = [];
        for (let pid = 0; pid < n; pid++) chs.push(makeEconChooser(policyChooserN(params, 0.35, 0.15), agg, null, 0));
        const rm = oneGameN(chs, seed, n, { regen: 0, mode: TRAIN_MODE });
        void rm;   // v1.5.69：座位统计已改走独立探针，这里不再重复计数
        mirrorRan++;
      }
    }
    /* 技能覆盖熵：目标函数里唯一不指向某个循环的广度信号。
     * 策略是"动作价值 softmax + 低温"的贪心取值，而目标里只有胜负时必然塔到一招；
     * 实测给到无限经济也只从激光剑换成狙击枪（有效技能数 1.88→2.06）。
     * 归一化用 ln(28) 作为上限：6 种均匀 → H/ln28 ≈ 0.54。 */
    let H = 0, uTot = 0;
    for (const k in agg.use) uTot += agg.use[k];
    if (uTot > 0) {
      for (const k in agg.use) { const pr = agg.use[k] / uTot; H -= pr * Math.log(pr); }
    }
    // 归一化只按"当时可负担的动作数"（千问：拿 28 归一化是在量一个恒为 0 的量）
    const affN = Math.max(2, Object.keys(agg.aff || {}).length || (R.skills || []).length);
    /* v1.5.8：改走 coverageEntropy —— **只统计非ジ动作**（用户裁定），否则攒钱会把熵压到极低、
     * 反过来惩罚攒钱。旧的 H/uTot/affN 三行保留只为下方日志口径连续（H 已不参与 fit）。 */
    const cov = coverageEntropy(agg.use, agg.aff, DIV_K);   // 保留：仅作历史口径的对照量（不再进 fit）
    const divNorm = cov.divNorm;
    /* v1.5.87（用户裁定 A）：进 fit 的熵改用**自对局·成功非ジ动作**（与门禁 G 同源），固定分母 ln(DIV_K)。 */
    let spTot = 0;
    for (const k in spUse) spTot += spUse[k];
    let spH = 0;
    if (spTot > 0) for (const k in spUse) { const pr = spUse[k] / spTot; spH -= pr * Math.log(pr); }
    const spDivNorm = spTot > 0 ? (spH / Math.log(DIV_K)) : 0;
    /* v1.5.93（用户裁定）：类间广度 —— 同一份 `spUse`，只按 `roleOf` 再聚合一层（8 个功能角色）。
     * 分层熵恒等式 `S = S_role + S_within` ⇒ 这里只需单独算 `S_role`，角色内由减法得到，不必重算。 */
    const roleUse = {};
    for (const k in spUse) {
      const r2 = roleOf(k);
      roleUse[r2] = (roleUse[r2] || 0) + spUse[k];
    }
    let spRoleH = 0;
    if (spTot > 0) for (const r2 in roleUse) { const pr = roleUse[r2] / spTot; spRoleH -= pr * Math.log(pr); }
    const spRoleNorm = spTot > 0 ? (spRoleH / Math.log(K_ROLE)) : 0;
    const spMixNorm = (1 - DIV_ROLE_W) * spDivNorm + DIV_ROLE_W * spRoleNorm;
    /* v1.5.6：按用户裁定**恢复**技能熵奖励（Q3 曾把它移出目标函数）。
     * 权重给得小（DIV_W=0.06，满额 +0.06），与 stock（+0.05 / −0.12）同量级 ⇒ 两项加起来仍远小于
     * 胜负项（base 1.0/0.3），符合"奖惩也不用给太多"。 */
    const divBonus = DIV_W * spMixNorm;   // v1.5.92：DIV_CAT_W=0 时**逐位等于** v1.5.87 的口径（自对局·成功非ジ动作）
    /* v1.5.124（§28a）：广度收益项在 `gFit` 之前算（用 `agg.use`）—— 见那一处的说明。 */
    /* v1.5.88（甲·步 2）：破墙硬过滤（默认关，EPIRUS_WALL_FILTER=1 打开）。 */
    const wallDmg = WALL_FILTER_ON ? wallProbe(params, WALL_GAMES, n) : null;
    const wallReject = (wallDmg != null && wallDmg < 0.5);
    /* ===== v1.5.68（第五轮复核 §4 的 ④ 落地）：**阈值式座位惩罚**（约束处理，不是奖励权重）=====
     * 病：训练从不评估"5 席同策略"这一配置 ⇒ 固定目标偏好的策略在机器人池上能赢、在 5 席测量里却某座通吃，
     * 演化永远惩罚不到它（v9~v15 五批 30+ 候选全是这个形状）。
     * 做法：用**已经在打的 mirror 局**（零额外成本）统计各座胜场；极差**超过阈值才扣分**，
     * 低于阈值一分不扣 ⇒ 不改变"好个体之间的相对次序"，只在偏置真的大时把它压下去。
     * 为什么不加奖励：先手激励 -14pt、破墙奖励让混合场 40%→17% —— 加权奖励已被两次实验证伪。 */
    /* v1.5.69 标定：6 局样本下"极差"的**噪声地板**就有 40~60pt（对称假设下 multinomial(6,1/5) 的
     * 期望极差 ≈50pt）⇒ 用"极差 > 35pt"当触发条件等于**按噪声随机扣分** ✗。
     * 改成只在**明显通吃**时触发：某座占 ≥70% 的分胜负局（对称假设下概率约 0.2%，不是噪声）。
     * 权重量级：100% 通吃 ⇒ 扣 0.30（相对成员 fit 0.2~0.5 是重罚），70% ⇒ 一分不扣。 */
    const SEAT_PEN_MAXPCT = 70, SEAT_PEN_W = 1.0;
    let seatPen = 0, seatSpreadMir = null, seatMaxPct = null;
    if (mirDec >= 4) {
      const pcts = mirSeatWins.map(function (w) { return 100 * w / mirDec; });
      seatSpreadMir = Math.max.apply(null, pcts) - Math.min.apply(null, pcts);
      seatMaxPct = Math.max.apply(null, pcts);
      if (seatMaxPct >= SEAT_PEN_MAXPCT) seatPen = SEAT_PEN_W * ((seatMaxPct - SEAT_PEN_MAXPCT) / 100);
    }
    /* ===== 风格表现切片（v1.5.2，见模块头部 setStyleSlice 的说明）=====
     * 追加在池子预算之外 ⇒ 不摊薄原有练习量；原生规则（regen=0）⇒ 量的是真实强度。 */
    let styleGames = 0, styleFirst = 0;
    if (STYLE_OPPS && STYLE_OPPS.length && STYLE_GAMES > 0 && STYLE_W > 0) {
      for (let g = 0; g < STYLE_GAMES; g++) {
        const seat = g % n;
        const choosers = [];
        let oi = (gen * 3 + g) % STYLE_OPPS.length;
        for (let pid = 0; pid < n; pid++) {
          if (pid === seat) choosers.push(policyChooserN(params, 0.15));
          else { choosers.push(wrapBotN(STYLE_OPPS[oi % STYLE_OPPS.length].sel)); oi++; }
        }
        const sd = seedOfGen(gen, idx, 'style') + g * 7919;
        const r = oneGameN(choosers, sd, n, { regen: 0, mode: TRAIN_MODE });
        styleGames++;
        if (rankOf(r.state, seat, sd) === 1) styleFirst++;
      }
    }
    const styleRate = styleGames ? styleFirst / styleGames : 0;
    const fitAvg = fitGames ? fit / fitGames : 0;
    /* P2（qoder-research 0920）：形状项 = S4_W × 宿主评分器(0..1)。评分器抛错**不吞**（与教师计划同规矩：
     * 静默退回默认 = 又一次 A/A 事故的形状）。`S4_W=0` 时连评分器都不调用 ⇒ 出厂行为逐字不变。 */
    const shapeBonus = (S4_W > 0 && !wallReject)
      ? (typeof global.__shapeScorer === 'function' ? S4_W * Math.max(0, Math.min(1, global.__shapeScorer(params)))
        : (() => { throw new Error('[shape] S4_W>0 但宿主未注入 __shapeScorer（worker/server 接线断了 ⇒ 不许静默跑）'); })())
      : 0;
    return {
      fit: (wallReject ? (-5.0) : (fitAvg + divBonus + STYLE_W * styleRate - seatPen + shapeBonus)),
      wallDmg: wallDmg,
      wallReject: wallReject,
      fitNoDiv: fitAvg,
      styleGames: styleGames, styleFirst: styleFirst, styleRate: styleRate, styleWeight: STYLE_W,
      divNorm: divNorm,
      spDivNorm: spDivNorm,
      spRoleNorm: spRoleNorm, spRoleH: spRoleH, spMixNorm: spMixNorm, divRoleW: DIV_ROLE_W,
      spH: spH,
      divBonus: divBonus,
      seatPen: seatPen, seatSpreadMirror: seatSpreadMir, seatMaxPct: seatMaxPct, mirrorDecisive: mirDec,
      divW: DIV_W,
      mirrorGames: mirrorRan,
      avgStock: econGames ? stockSum / econGames : 0,
      distinct: Object.keys(agg.use).length,
      distinctNonJi: cov.distinct, nonJiShare: uTot ? cov.nonJi / uTot : 0,
      first: first, second: second, games: played,
      firstRate: played ? first / played : 0,
      top2Rate: played ? (first + second) / played : 0,
      avgDealt: played ? dealt / played : 0,
      avgRounds: played ? rounds / played : 0,
      avgMaxEp: econGames ? maxEpSum / econGames : 0,
      avgLeftEp: econGames ? leftEpSum / econGames : 0, avgSpentEp: econGames ? spentEpSum / econGames : 0,
      avgGainEp: econGames ? gainEpSum / econGames : 0,
      avgHeavy: econGames ? heavySum / econGames : 0,
      avgHold: econGames ? holdSum / econGames : 0,
      avgDeep: econGames ? deepSum / econGames : 0,
      avgImit: imitGames ? imitSum / imitGames : 0,
      /* (c) 承诺局记账 */
      hGene: hGene,
      fitGames: fitGames,
      commitGames: commitGames,
      commitFirstRate: commitGames ? commitFirst / commitGames : 0,
      commitTop2Rate: commitGames ? commitTop2 / commitGames : 0,
      commitMaxEp: commitMaxEp
    };
  }

  /* 多人实战评测：冠军在每个座位都打一遍，报 1st/2nd/3rd 率 */
  function evalN(params, oppPairs, gamesPerPair, n, seedBase) {
    let first = 0, second = 0, third = 0, total = 0;
    for (const pair of oppPairs) {
      for (let g = 0; g < gamesPerPair; g++) {
        const seat = g % n;
        const choosers = [];
        let oi = 0;
        for (let pid = 0; pid < n; pid++) {
          if (pid === seat) choosers.push(policyChooserN(params, 0.15));
          else { choosers.push(wrapBotN(pair[oi % pair.length])); oi++; }
        }
        const r = oneGameN(choosers, seedBase + g * 977 + total, n, { mode: TRAIN_MODE });
        const rank = rankOf(r.state, seat, seedBase + g * 977 + total);
        if (rank === 1) first++; else if (rank === 2) second++; else third++;
        total++;
      }
    }
    return {
      first: first, second: second, third: third, games: total,
      firstRate: total ? first / total : 0,
      top2Rate: total ? (first + second) / total : 0
    };
  }

  function evaluatePopulation(t, championSnap) {
    const opps = buildOpps(championSnap, 0.05);
    for (let i = 0; i < t.pop.length; i++) {
      const m = t.pop[i];
      const r = scoreMember(m.params, opps, t.gamesPerOpp, t.gen, i);
      m.attackGames = r.attackGames;
      m.attackChoices = r.attackChoices;
      m.totalChoices = r.totalChoices;
      m.attackRate = r.attackRate;
      m.attackShare = r.attackShare;
      m.score = r.score;
    }
  }

  function breed(t) {
    const sorted = t.pop.slice().sort(function (a, b) { return b.score - a.score; });
    const next = [];
    for (let i = 0; i < t.elite; i++) {
      next.push({ params: P.mutatePolicy(sorted[i].params, t.sigma * 0.5), score: 0, attackGames: 0, attackRate: 0 });
    }
    while (next.length < t.popSize) {
      const a = sorted[Math.floor(Math.random() * Math.min(6, sorted.length))].params;
      const b = sorted[Math.floor(Math.random() * Math.min(6, sorted.length))].params;
      const base = Math.random() < 0.7 ? P.crossover(a, b) : a;
      next.push({ params: P.mutatePolicy(base, t.sigma), score: 0, attackGames: 0, attackRate: 0 });
    }
    t.pop = next;
  }

  /* 冠军 vs 固定脚本基线（报告/图表用） */
  function champVsBaseline(t, games, seedBase) {
    /* v1.5.19：冠军位可能为空（健康门槛拒掉第一次提升）⇒ 依次退到 bestChamp / 种群首个体；
     * 三个都没有才返回 null（旧写法直接把 null 喂给 policyChooser ⇒ TypeError）。 */
    const cp = t.champion || t.bestChamp || (t.pop && t.pop[0] && t.pop[0].params);
    if (!cp) return null;
    const champ = policyChooser(cp, 0.05);
    let total = 0, n = 0;
    for (const nm of Object.keys(BOT_PICKS)) {
      const r = correctedWinRate(champ, BOT_PICKS[nm], games, seedBase + n * 131);
      total += r.wr; n++;
    }
    return n ? total / n : 0;
  }

  /* 一代评估完成后：排序、更新冠军、变异衰减、繁殖。返回摘要记录。 */
  function finishStep(t) {
    const sorted = t.pop.slice().sort(function (a, b) { return b.score - a.score; });
    const bestScore = sorted[0].score;
    // 冠军 = 真实胜分最高的个体（先求强）。"让人看到它进攻"由困难难度的 45% 进攻覆盖层负责。
    const cand = sorted[0];
    // 跨代保留全局最佳（并带进攻率门槛），避免最后一代抽样随机决定冠军性格。
    const better = !t.bestChamp || cand.score > t.bestChampScore + 0.001;
    /* v7（v1.5.19）：**提升冠军前先过自对局体检**。
     * 为什么必须在这里而不是只放在收尾择优：产物的冠军是**这条**语句决定的（t.champion = t.bestChamp），
     * `pickChampionByWinRate` 只管跨 seed 收尾 —— 第一版只加了后者，12 个 seed 的数字与没加时**逐个相同**，
     * 等于门槛是空操作（教训：门槛要加在"决定产物的那一行"上，见 docs/METHODOLOGY.md 第 21 条）。
     * 成本：只在真的出现"更高分候选"时才跑 promoteGames 局（默认 8），不是每代都跑。 */
    let healthReject = null;
    /* v1.5.42：**探索期内不惩罚探索** —— 被强迫的个体暂时不健康，但它们承载着"动作被采样过"的信息；
     * 若在窗口内就用健康门槛拒掉，整条提升链会被堵死（实测逃逸率 1/6）。窗口外照旧。 */
    if (better && HEALTH.on && !IN_EXPLORE) {
      const mh = mirrorHealth(cand.params, HEALTH.promoteGames, HEALTH.n, TRAIN_MODE);
      const hf = healthFails(mh);
      if (hf.length) healthReject = hf;
    }
    if (better && !healthReject) {
      t.bestChamp = cand.params;
      t.bestChampScore = cand.score;
      t.bestChampAttack = cand.attackShare || cand.attackRate;
    }
    if (healthReject) t.healthRejects = (t.healthRejects || 0) + 1;
    /* 兜底：门槛把第一次提升也拒了 ⇒ 冠军位仍是空的。用**热启动种子**顶上（而不是被拒的候选），
     * 否则 champVsBaseline 会拿到 null 崩掉整条训练线。只在"确实没有冠军"时做一次。 */
    if (!t.bestChamp) {
      /* 依次退：热启动种子 → 当前种群最高分个体。没有这层兜底，`t.champion` 会一直是 null，
       * 调用方（champVsBaseline / evalChamp / 落盘）全线崩（实测 train-best 崩在 t.champion.slice）。
       * 兜底进来的冠军会被打上 `healthFallback` 标记 ⇒ 产物侧的门槛（train-server 落盘处）仍会拦它。 */
      const fb = t.seedParams || ((t.pop && t.pop.length) ? t.pop.slice().sort(function (a, b) { return b.score - a.score; })[0].params : null);
      if (fb) { t.bestChamp = fb; t.bestChampScore = -1e9; t.healthFallback = true; }
    }
    const champPrev = t.champion;
    const champChanged = t.bestChamp !== champPrev;
    if (champChanged) { t.champion = t.bestChamp; t.championAge = 0; }
    else t.championAge++;
    t.bestParams = t.bestChamp;
    // 记录最近一代强候选 params，供收尾按真实胜率择优（避免 shaped fitness 过拟合到"打伤害不赢"的激进型）
    t.lastTop = sorted.slice(0, 3).map(function (m) { return m.params; });
    const rec = { gen: t.gen, best: bestScore, champChanged: champChanged, champAge: t.championAge, sigma: t.sigma, healthRejects: t.healthRejects || 0 };
    if (t.gen % t.baselineEvery === 0) rec.baseline = champVsBaseline(t, 6, t.gen * 99991);
    t.history.push(rec);
    t.gen++;
    // 慢速衰减变异幅度（避免过早平台期）；并每隔40代注入2个随机新个体保持多样性
    t.sigma = Math.max(0.10, t.sigma * 0.999);   // 较高sigma地板+缓衰减：种群别坍缩，才能持续探索、突破退化盆地（否则冠军蝉联且续训退化）
    if (t.gen % 40 === 0) {
      for (let j = 0; j < 2 && t.pop.length; j++) {
        const idx = Math.floor(Math.random() * t.pop.length);
        t.pop[idx] = { params: P.makePolicy(0.3), score: 0, attackGames: 0, attackRate: 0, attackChoices: 0, totalChoices: 0, attackShare: 0 };
      }
    }
    breed(t);
    return rec;
  }

  /* 同步执行一代：串行评估 + finishStep。浏览器 / 自测使用。 */
  function step(t) {
    const championSnap = t.champion.slice();
    evaluatePopulation(t, championSnap);
    return finishStep(t);
  }

  /* 从已有冠军热启动种群（持续训练：围绕冠军变异，而不是全部随机重开） */
  function seedChampion(t, params) {
    if (!params) return;
    t.seedParams = params.slice();   // v1.5.19：兜底用（健康门槛可能拒掉第一次提升 ⇒ champion 会短暂为空）
    const mk = function (p, sigma) {
      return { params: p, score: 0, attackGames: 0, attackRate: 0, attackChoices: 0, totalChoices: 0, attackShare: 0 };
    };
    t.pop[0] = mk(params.slice(), 0);
    for (let i = 1; i < t.popSize; i++) {
      const sig = i < t.elite ? t.sigma * 0.6 : t.sigma;
      t.pop[i] = mk(P.mutatePolicy(params, sig), sig);
    }
  }

  /* 收尾择优：从 [当前冠军 + 最近一代强候选] 中，按 vs 全部脚本基准的真实平均胜率挑选最强的作冠军。
   * 解决"shaped fitness 把打伤害但不赢的激进型捧成冠军"的过拟合。 */
  /* 覆盖熵：候选冠军动作分布的多样性 H/ln(#技能)。
   * 为什么必须有：择优若只做 argmax(胜率)，必然挑中最强也最窄的个体。
   * 实测同一份 fitness 下，按胜率择优得有效技能 2.52、按适应度分选得 3.25。 */
  function champEntropy(params, temp, games, seedBase, n) {
    const N = (typeof n === 'number' && n > 2) ? n : 2;
    const use = {}; let dec = 0;
    const inner = (N > 2) ? policyChooserN(params, temp) : policyChooser(params, temp);
    const sel = function (state, pid, legal) {
      const raw = inner(state, pid, legal);
      const k = (typeof raw === 'string') ? raw : raw.key;
      if (pid === 0) { use[k] = (use[k] || 0) + 1; dec++; }
      return raw;
    };
    for (let g = 0; g < games; g++) {
      if (N > 2) { const ch = []; for (let i = 0; i < N; i++) ch.push(sel); oneGameN(ch, seedBase + g * 977, N, { mode: TRAIN_MODE }); }
      else oneGame(sel, sel, seedBase + g * 977);
    }
    let H = 0;
    for (const k in use) { const pr = use[k] / dec; H -= pr * Math.log(pr); }
    /* v1.5.8：与 fit 里那条同源 —— **只统计非ジ动作**（否则"多出ジ"会被当成"打法更广"） */
    const cov = coverageEntropy(use, null, Math.max(2, (R.skills || []).length - 1));
    return { divNorm: dec ? cov.divNorm : 0, distinct: cov.distinct };
  }

  /* 多目标择优：在「胜率分不低于最高分 - WR_TOL」的候选里，取覆盖熵最高者。
   * 这样胜率损失有界（容差内），但不再被 argmax 逼向窄解。 */
  /* ===== 课程式经济补贴（千问方案，纯训练侧，不动 shipped 规则）=====
   * 洞见：2P 能攒钱而 3P 不能，不是规则更严，而是 3P 没人替它把"攒到 3"这条路走通过一次。
   * 用法：训练前段开富经济让它**看见** ep=3/5 与聚能环/大雷的回报，再退火到线上口径。 */
  /* Q1(d) 永久回放切片（千问方案）——比"课程退火"更根本：
   * 实测：只加变异不加选择时，深经济能力在 **15~20 代**内掉 26~40pt（σ=0.06 的噪声自由游走就抹掉了）。
   * 我上一版"前 30% 补贴 + 后 50% 退火"的退火窗口有 150 代 ≫ 衰减尺度 20 代 → 必然失败。
   * 正确做法不是靠时间安排躲漂移，而是**给这条分支一条永久的评价通道**。
   * 这里用最便宜的形式：每代评估里固定留 REGEN_SLICE 比例的局带补贴，永不退火。 */
  /* ===== C 方案：脚本教师模仿（千问/用户方向）=====
   * 动机：全随机初始化 + 纯胜负奖励时，网络探索不到"连续攒钱"这类**长轨迹**行为。
   * 做法：训练早期让个体额外模仿一个**有逻辑的脚本教师**（默认 heavyfire = 贵技能专精，
   *   正是"会攒钱"的脚本化身），模仿率给一个**退火到 0** 的奖励；后期完全交给真实胜负。
   * 与"改规则"无关，纯训练侧；也不会固化——退火后教师影响消失，个体必须靠真实胜负站住。 */
  let IMIT_BETA = 0.12;              // 初始模仿奖励权重
  /* ===== v1.5.31（用户选"课程/示范"）：**可配置教师 + 反环教师** =====
   * 实测教训：环奖励三版（常开/退火/密集）要么把训练冻死、要么不触发 —— 根因是
   * "小雷作废开环者"这个动作**历史上从未被出过**（探针实测所有冠军小雷次数 = 0），
   * 而**奖励无法 bootstrap 一个从未发生的动作**。课程法：前 N 代让种群**模仿一个会出小雷的教师**，
   * 把动作先"示范"出来，再交给奖励强化。复用现成的 setImitUntil/imitBetaForGen 退火管道。 */
  /* ===== v1.5.39（用户选 ①）：**定向强制探索** =====
   * 前五次实测（奖励/池子/示范/暴露度/可归因信号）都拿不到"自然小雷" ⇒ 该动作从未被采样到。
   * 这里只在**唯一那一格**做 ε-强迫：**有对手在滚环（ringStreak ≥ 1）且我付得起小雷** ⇒ 强制砸他。
   * 关键：其余任何情形都返回 null（交回**学习到的**策略）—— 不能用教师槽做常开 ε，
   * 那会顺带用 heavyfire 扰动全局（教师退化的默认动作）。
   * **验收必须在关掉强迫后量自然行为**（复核 §5-5：否则 `miniTCasts ≥ 5` 是恒真式）。 */
  let RING_FORCE_EPS = 0;
  /* v1.5.39 修订：**上限提到 1.0**。理由（实测）：目标格（有人真在滚环）只占决策的 **0.15%**
   * ⇒ 在格子里再乘 ε=5% 等于"整跑几乎不强制"（0.0075%），第一臂的 0 是**算术问题**不是证据。
   * 格子本身极罕见 ⇒ **格内 ε=1.0（每次都强制）**才是正确的类比，且不会扰动非目标格。 */
  function setRingForceEps(v) { const x = Number(v); RING_FORCE_EPS = (isFinite(x) && x > 0) ? Math.min(1, x) : 0; return RING_FORCE_EPS; }
  function ringForceEps() { return RING_FORCE_EPS; }
  /* v1.5.40（用户选"继续"）：**强迫必须退火**。
   * 实测（v1.5.39）：格内常开 ε=1.0 会把训练**整体冻死**（6/6 零提升，产物退回种子）；
   * 而 ε=5% 又因目标格极罕见（0.15%）等于没做 ⇒ 正确形态是"**早期强制示范、之后关掉**"，
   * 让最终产物来自**无强迫的后段**，验收才有意义。 */
  /* v1.5.42（用户选 ②）：**探索期标志** —— 由 scoreMemberN 按当前代更新（= 是否在强迫窗口内）。
   * 用途：提升闸门与选择过滤在探索期内**不惩罚**被强迫出来的个体（否则它们全被拒 ⇒ 整臂冻回种子，
   * 实测窗口 20/40/80 的逃逸率只有 0/1/1 个 seed）。窗口外一切照旧。 */
  let IN_EXPLORE = false;

  let RING_FORCE_UNTIL = 0;
  function setRingForceUntil(n) { const x = Number(n); RING_FORCE_UNTIL = (isFinite(x) && x > 0) ? Math.floor(x) : 0; return RING_FORCE_UNTIL; }
  function ringForceUntil() { return RING_FORCE_UNTIL; }
  /* 第 gen 代实际生效的强迫概率（纯函数，便于守门）：只在 < until 的代里生效。 */
  function ringForceEpsAt(gen) {
    if (RING_FORCE_EPS <= 0) return 0;
    if (!RING_FORCE_UNTIL) return RING_FORCE_EPS;      // 未设 until ⇒ 全程（旧行为，仅用于对照）
    return ((gen || 0) < RING_FORCE_UNTIL) ? RING_FORCE_EPS : 0;
  }
  /* 目标格的"该出手"判定：返回要打的环流者 pid，或 -1（不该出手）。纯函数，便于守门。 */
  function ringForceTarget(state, pid, legal) {
    const mt = (legal || []).filter(function (x) { return x.key === R.SK.MINI_T && x.affordable; })[0];
    if (!mt) return -1;
    let best = -1;
    for (let q = 0; q < state.p.length; q++) {
      if (q === pid) continue;
      const pq = state.p[q];
      if (!pq || pq.hp <= 0) continue;
      if ((pq.ringStreak || 0) >= 1 && (best < 0 || pq.ringStreak > state.p[best].ringStreak)) best = q;
    }
    return best;
  }

  let IMIT_TEACHER = null;           // null = 沿用老的 heavyfire 教师
  function setImitTeacher(fn) { IMIT_TEACHER = (typeof fn === 'function') ? fn : null; return !!IMIT_TEACHER; }
  function imitTeacher() { return IMIT_TEACHER; }
  /* v1.5.96：**完整动作**的教师调用 —— `teacherAction` 只回 key，而覆盖时必须带 target。 */
  function teacherFull(botFn, state, pid, legal) {
    try {
      const r = botFn(state, pid, legal);
      if (typeof r === 'string') return { key: r, target: null };
      return r || null;
    } catch (e) { return null; }
  }
  /* v1.5.96：**真示范**开关（默认关 ⇒ 行为一字不变）。用法与理由见 `makeEconChooser` 里的长注释。 */
  let IMIT_OVERRIDE = false;
  function setImitOverride(on) { IMIT_OVERRIDE = !!on; return IMIT_OVERRIDE; }
  /* v1.5.96：按**名字**选教师（`EPIRUS_IMIT_TEACHER=ringspam` 之类）。
   * 名字→函数的映射**留在这个文件里**，免得 server / worker 各写一份清单（本仓库为这种"两处各写一遍"栽过四次）。 */
  function setImitTeacherByName(name) {
    if (!name) return false;
    const n = String(name).trim();
    if (n === 'antiring') return setAntiRingTeacher();
    if (BOT_PICKS && typeof BOT_PICKS === 'object' && typeof BOT_PICKS[n] === 'function') {
      IMIT_TEACHER = BOT_PICKS[n];
      return true;
    }
    /* v1.5.96：也接受**全局 bot 注册表的函数名**（`pickRingSpam` 之类）。
     * 为什么必须留这条路：环专精 **不在 `BOT_PICKS` 里** —— 那张表是"对手池"的注册表
     * （`buildOpps` 与若干诊断循环都 `Object.keys(BOT_PICKS)`），往里加键会**改默认训练**
     * ⇒ 拿环当教师只能走全局注册表，且**默认池一字不动**。 */
    const G = (typeof global !== 'undefined' && global && global.EpirusBots) || null;
    if (G && typeof G[n] === 'function') { IMIT_TEACHER = G[n]; return true; }
    return false;
  }

  /* 反环教师：有对手 ep ≥ 2（正在攒环/够小雷）且我付得起小雷 ⇒ 打他一记小雷；否则交给基础策略。 */
  function makeAntiRingTeacher(baseFn) {
    return function (state, pid, legal) {
      const mt = (legal || []).filter(function (x) { return x.key === R.SK.MINI_T && x.affordable; })[0];
      if (mt) {
        let best = -1;
        for (let q = 0; q < state.p.length; q++) {
          if (q === pid) continue;
          const pq = state.p[q];
          if (!pq || pq.hp <= 0) continue;
          /* v1.5.37（复核 §5-2）：条件是 `ep >= 2` 时在真实自对局里 **45%** 的决策都成立，
           * 而"有人真在滚环"只有 **0.15%** ⇒ 教师实际在教"见人兜里有 2 ジ就砸小雷"。
           * 改成 `ringStreak >= 1`（该座真的在连开聚能环）⇒ 示范的动作才与"开环"这个状态相关。 */
          if ((pq.ringStreak || 0) >= 1 && (best < 0 || pq.ringStreak > state.p[best].ringStreak)) best = q;
        }
        if (best >= 0) return { key: R.SK.MINI_T, target: best };
      }
      return baseFn(state, pid, legal);
    };
  }
  /* 装成"反环教师"（基础策略用 heavyfire，与老的模仿教师一致） */
  function setAntiRingTeacher() { return setImitTeacher(makeAntiRingTeacher(BOT_PICKS['heavyfire'])); }

  let IMIT_UNTIL = 0;                // 退火代数（由 setImitUntil 设置；0=关闭）
  function setImitUntil(n) { IMIT_UNTIL = Math.max(0, Math.floor(n) || 0); }
  /* ===== v1.5.97：**分段教师计划**（两段课程）=====
   * 动因（v1.5.96 §7 的机制结论）：一次性用"开环教师"无效 —— 环**恒不可负担**、教师够不着；
   * 先用"攒钱教师"把 ep 攒起来（已证可行：`ep≥3` 从 0.0% → 12.6 / 9.5 / 40.1%），
   * **第二段**再换"开环教师"，此时环才可负担 ⇒ 示范才落在环上。
   * 口径：`EPIRUS_IMIT_PLAN="教师名:占比,教师名:占比"`（占比之和≈1），在 `[0, IMIT_UNTIL)` 内切段；
   * **每段各自线性退火**（β 从 IMIT_BETA 降到 0）⇒ 第二段会**重新**施加示范压力。
   * 不设 plan ⇒ 行为与旧版**逐位相同**（单教师 + 单一退火窗）。
   * 解析**只写这一份**：`setImitPlanByName(spec, totalGens)` 供 server 与 worker **共用**（今晚的教训）。 */
  let IMIT_PLAN = null;              // [{start, until, teacher, name}]
  function setImitPlan(segs) {
    IMIT_PLAN = (Object.prototype.toString.call(segs) === '[object Array]' && segs.length) ? segs : null;
    return IMIT_PLAN ? IMIT_PLAN.length : 0;
  }
  function imitPlanSegment(gen) {
    if (!IMIT_PLAN) return null;
    for (let i = 0; i < IMIT_PLAN.length; i++) {
      const s = IMIT_PLAN[i];
      if (gen >= s.start && gen < s.until) return s;
    }
    return null;
  }
  function imitTeacherForGen(gen) {
    const s = imitPlanSegment(gen);
    return s ? s.teacher : IMIT_TEACHER;
  }
  /* ===== v1.5.98：**只示范目标卡**（`onlyKey`）=====
   * 动因（v1.5.97 §4 的机制结论）：两段课程里第二段把第一段教出来的"攒"抹掉了。
   * 机制：override 在**环不可负担时**也会拿教师的动作覆盖 —— 而教师的 fallback（蓄能/ジ）是短视的，
   * 于是每次覆盖都在把策略往"不攒、随手出牌"推。
   * ⇒ 让示范**只在教师真要教那张卡时**才生效（覆盖与奖励计数**都**过滤）：
   *   只对"环"计一致性/做覆盖 ⇒ fallback 不再覆盖策略自己的好动作 ⇒ 第一段的成果不被回冲。
   * 默认 `null` = 不过滤（行为与旧版逐位相同）。可全局设（`EPIRUS_IMIT_ONLY`），
   * 也可**按段**设在计划里：`EPIRUS_IMIT_PLAN="pickDeepSaver:0.5,pickRingSpam:0.5:ring"`。 */
  let IMIT_ONLY = null;
  function setImitOnly(k) {
    if (k == null || k === '') { IMIT_ONLY = null; return null; }
    const key = String(k).trim();
    if (!R.byKey[key]) throw new Error('[imit] EPIRUS_IMIT_ONLY 不是一张合法的卡：' + key);
    IMIT_ONLY = key;
    return IMIT_ONLY;
  }
  function imitOnlyForGen(gen) {
    const s = imitPlanSegment(gen);
    if (s && s.only) return s.only;
    return IMIT_ONLY;
  }
  /* v1.5.99：`IMIT_SUB_ONLY` —— 见 `makeEconChooser` 里的长注释（只对设了 only 的示范生效）。 */
  let IMIT_SUB_ONLY = false;
  function setImitSubOnly(on) { IMIT_SUB_ONLY = !!on; return IMIT_SUB_ONLY; }
  /* ===== v1.5.141（DS 研究 · `docs/RESEARCH-LOG-2026-09-21-ds.md` §5）：**补贴局里连"珠"一起补**（默认关）=====
   * 病（本日实测，臂 `v7bead1`）：v1.5.99 的补贴局补贴的是 **ep**（白来的 ep），而"电磁炮"还需要 `elec:1`
   * ⇒ 它在补贴局里**仍然不可负担** ⇒ v1.5.96 那条"只在教师动作**确实可负担**时才覆盖"的示范
   * **永远示范不到"放炮"** —— 93 粒的读数（蓄能 5 次、得珠 5 颗、全过期、放炮 **0**）正是这条机制的形状。
   * 打开它 = 在补贴局里给**受评席**每回合补一颗珠 ⇒ "放炮"随时可示范（配 `IMIT_SUB_ONLY` + `only=railgun`
   * 就能只教这一张卡）。⚠️ **只补受评席**（不动对手席 ⇒ 不改变补贴局的对手行为）；
   * **只影响 `regen>0` 的补贴局** ⇒ 原生考卷/体检/五道门读数不受影响。
   * `evo.js` **不在** `FINGERPRINT_FILES` ⇒ 零重记成本（这是选在这里做的主要原因）。 */
  let SUB_BEAD = false;
  function setSubBead(on) { SUB_BEAD = !!on; return SUB_BEAD; }
  function subBeadOn() { return SUB_BEAD; }
  function imitBetaForGen(gen) {
    if (IMIT_PLAN) {
      const s = imitPlanSegment(gen);
      if (!s) return 0;
      const span = Math.max(1, s.until - s.start);
      return IMIT_BETA * Math.max(0, 1 - (gen - s.start) / span);   // **每段各自**线性退火
    }
    if (!IMIT_UNTIL || gen >= IMIT_UNTIL) return 0;
    return IMIT_BETA * (1 - gen / IMIT_UNTIL);      // 线性退火（旧口径，不设 plan 时逐位不变）
  }
  /* 按名字建计划（唯一一份解析；server 与 worker 都调它）。
   * `spec` = "name:frac,name:frac"；`totalGens` = 示范窗总代数（= IMIT_UNTIL）。
   * 片段无法解析 / 名字解析不出来 ⇒ **抛错**（不许静默退回默认教师 —— `v7stock1` 的教训）。 */
  function setImitPlanByName(spec, totalGens) {
    const txt = String(spec == null ? '' : spec).trim();
    if (!txt) return setImitPlan(null);
    const parts = txt.split(',').map(function (p) { return p.trim(); })
      .filter(function (p) { return p.length > 0; });
    const total = Math.max(1, Math.floor(Number(totalGens) || 0));
    const segs = [];
    let at = 0, acc = 0;
    for (let i = 0; i < parts.length; i++) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([0-9]*\.?[0-9]+)(?:\s*:\s*([A-Za-z_][A-Za-z0-9_]*|\*))?$/.exec(parts[i]);
      if (!m) throw new Error('[imit] 计划片段无法解析：' + JSON.stringify(parts[i]) +
        '（应形如 pickDeepSaver:0.5 或 pickRingSpam:0.5:ring；第三段 = 只示范哪张卡，`*` = 不过滤）');
      const name = m[1], frac = Number(m[2]);
      const only = (!m[3] || m[3] === '*') ? null : m[3];
      if (only && !R.byKey[only]) throw new Error('[imit] 计划里的 only 不是一张合法的卡：' + only);
      if (!(frac > 0)) throw new Error('[imit] 计划片段占比必须 > 0：' + parts[i]);
      const until = (i === parts.length - 1) ? total
        : Math.min(total, Math.max(at + 1, Math.round(total * (acc + frac))));
      let teacher = (name === 'antiring') ? makeAntiRingTeacher(BOT_PICKS['heavyfire']) : null;
      if (!teacher && BOT_PICKS && typeof BOT_PICKS[name] === 'function') teacher = BOT_PICKS[name];
      if (!teacher) {
        const G = (typeof global !== 'undefined' && global && global.EpirusBots) || null;
        if (G && typeof G[name] === 'function') teacher = G[name];
      }
      if (!teacher) {
        throw new Error('[imit] 计划里的教师名字解析失败：' + name +
          '（可用：antiring / BOT_PICKS 的键 / 全局注册表函数名，如 pickRingSpam、pickDeepSaver）');
      }
      segs.push({ start: at, until: until, teacher: teacher, name: name, only: only });
      at = until; acc += frac;
    }
    if (segs.length && segs[segs.length - 1].until < total) segs[segs.length - 1].until = total;
    return setImitPlan(segs);
  }
  /* 脚本教师的一句话决策（供模仿比对用） */
  function teacherAction(botFn, state, pid, legal) {
    try {
      const r = botFn(state, pid, legal);
      return (typeof r === 'string') ? r : (r && r.key) || null;
    } catch (e) { return null; }
  }

  const REGEN_SLICE = 0.08;   // 每 12 局留 1 局（约 8%）带补贴
  function regenForGen(gen) { return 0; }   // 兼容旧入口；回放切片按局索引走
  function setRegenTotal(n) { /* 保留兼容：回放切片不再依赖总代数 */ }
  function regenForGame(g, games) {
    const step = Math.max(2, Math.round(1 / REGEN_SLICE));
    return (g % step === 0) ? 2 : 0;
  }

  /* ===== 承诺级 ε（千问方案）=====
   * 动作级 ε 靠多次独立抽样撞运气才能走完 3~5 回合的连续攒钱轨迹；
   * 承诺级 ε 每局抽一个"储蓄视界 h"，规定 ep < 1+h 时只准出 ジ —— 轨迹被**真正走到**。 */
  function makeCommitChooser(params, temp, h) {
    const inner = policyChooserN(params, temp, 0);
    return function (state, pid, legal) {
      if (h > 0 && state.p[pid] && state.p[pid].ep < 1 + h) {
        for (let i = 0; i < legal.length; i++) {
          if (legal[i].key === R.SK.JI && legal[i].affordable) return { key: R.SK.JI, target: null, target2: null };
        }
      }
      return inner(state, pid, legal);
    };
  }

  /* Tolerance band (multi-objective selection). 0.01 = tightened for the 3P head-to-head
   * issue; 0.03 = the div555-era value (wider band -> more diverse pick).
   * Qianwen's review: this used to be read from an environment variable INSIDE
   * the sandbox (naming it here would trip the L3 lint).
   * That is wrong on two counts: (a) the CLI sandboxes have no `process`, so they ALWAYS got
   * the default 0.03; (b) the server sandbox may or may not expose `process`, so the SAME
   * constant could differ between the two paths. It is now an explicit parameter set by the
   * caller (server / CLI), never a hidden env read inside the engine. */
  let WR_TOL = 0.03;
  function setWrTol(v) { const n = Number(v); if (isFinite(n) && n >= 0) WR_TOL = n; }

  /* ===== v7（v1.5.19）：**自对局健康**（单一真源）=====
   * 为什么需要：单一 1st 率能被"熬"骗（REVIEW §11：long-33 靠 20/20 局零伤害平局拿到 45.3%）。
   * v7 加完特征后这件事变严重了 —— 实测 12 个 seed 里分最高的几个（48.4% / 45.3%）在**自对局**里
   * 只剩 1~2 张卡、打到 54~60 回合（G=1.00~1.66），而 `champ-audit` 的 G 列正是这么量出来的。
   * ⇒ 把"自对局行为形状"做成**换冠军的硬门槛**，并且**与 tools/audit-lib.mjs 的 G 列共用这一份实现**
   * （两处各写一遍必出事：docs/METHODOLOGY.md 第 13 条）。
   * 指标：effSkills = exp(非ジ出手分布的熵)（"有效技能数"）、drawRate（全员存活率）、rounds。
   * 反证（np-test D35）：把门槛关掉（setHealthGate({on:false})）或用不可能阈值，D35 必须红。 */
  let HEALTH = { on: true, games: 20, promoteGames: 8, n: 5, minG: 3, maxDraw: 0.2, maxRounds: 40 };
  /* ===== v1.5.19（方向 A）：把**自对局**折进适应度 =====
   * 为什么需要：健康门槛只"筛"不"教" —— 实测只筛时 6/7 个 seed 被拦回"健康但弱"的角落（考卷 15.8%），
   * 因为训练器优化的始终是"对脚本的 1st 率"，而退化（G≈1、50~60 回合）在**自对局**里才显形。
   * 做法：每个个体额外打 MIRROR_GAMES 局"n 座同一策略"，把这几局的**非ジ动作直方图并进同一个
   * `agg.use`** ⇒ 已有的覆盖熵项（divNorm，权重 DIV_W）自然把"自对局里只剩两三张卡"的个体压低。
   * **胜负名次一项都不折**（镜像局的第 1 名是轮盘，没有信息），也不动伤害/回合口径。
   * 反证（np-test D36）：MIRROR_GAMES=0 与 =2 的 divNorm 必须不同，而 first/games **必须逐位相同**。 */
  /* ===== v1.5.23（用户裁定）：**教它惩罚开环的人** =====
   * 起因：用户实测"对手连开 9 回合聚能环把ジ刷到 +3/回合，四个冠军座位零反应"；
   * 而项目两次把 `ringspam` 放进池子的实验都判定"池子是弱杠杆"（第三次同型结论见 CHANGELOG v1.5.20）⇒
   * 真正缺的是**信用分配**：把"对手在开环时我打断了他"变成一条**窄条件、可归因**的奖励。
   * 怎么在不改引擎的前提下侦测"对手在开环"：环每回合多发 **+2/+3 ジ**（R10）⇒ 一次 `ep` 事件
   * 的 `delta ≥ 2` 且不是我 ⇒ 这个对手正在开环。同一回合里**我**打中他、或用小雷作废了他的招 ⇒ 记一次打断。
   * 权重刻意取小（默认 0.04，两次打断满额）⇒ 不改变主目标（胜负），只做方向性引导。
   * 反证（np-test D39）：把 ringBreaks 记账删掉 / 权重设 0 ⇒ D39 立刻红。 */
  /* ===== v1.5.25（用户选 ①）：**惩罚被动**的窄奖励 =====
   * 起因：v7anneal-34 在"被动场"里 E=100%（对手只出ジ时，它也只会堆架势）⇒ 体检被判"集体防御"。
   * 判据（纯事件层，不动引擎）：把一局按回合分组（**每回合每玩家最多一条 `action` 事件**，
   * 于是"又看到某个 pid 的 action"就是新回合），记"我这个回合打中了、且这一回合一点没挨打"的回合数。
   * 奖励 `PRESS_W × min(1, 主动回合数/3)`（默认 0.03）——只奖"对手没威胁时我还在推进"，不奖乱打。 */
  /* ===== v1.5.29（第三方复核 §5-1，用户选 b）：**破墙奖励** =====
   * 起因（实测）：v1.5.27 的冠军在自对局里 G 6.55 很漂亮，但在 4 面反弹墙前**一枪未发**
   * （穿透卡命中 0），长程反弹墙 85% -> 0% —— 它把唯一能穿反弹的激光剑这条线整个丢了。
   * 做法：窄条件（**只认能穿反弹/穿防御的卡**，清单从 R.skills 推导）+ 可归因（damage.source === seat）
   * => PIERCE_W x min(1, 命中数/2)，默认 0.04（两次封顶）。清单不硬编码 => 规则改了自动跟着变。 */
  let PIERCE_W = 0.04;
  function setPierceReward(w) { const v = Number(w); if (isFinite(v) && v >= 0) PIERCE_W = v; return PIERCE_W; }
  function pierceReward() { return { w: PIERCE_W, keys: pierceKeyList() }; }
  /* 能穿反弹/穿防御的卡（从规则数据推导：激光剑/坦克/狙击枪/电磁炮） */
  function pierceKeyList() {
    return (R.skills || []).filter(function (sd) {
      const pp = sd.pierce || {};
      return !!(pp.reflect || pp.defense);
    }).map(function (sd) { return sd.key; });
  }
  /* 纯函数：数我用穿透卡**落地命中**的次数（便于守门做行为断言） */
  function countPierceHits(events, seat) {
    const pk = pierceKeyList();
    let n = 0;
    for (const e of events) {
      if (e.type === 'damage' && e.source === seat && e.via && pk.indexOf(e.via) >= 0) n++;
    }
    return n;
  }

  /* 纯函数：数我**花掉**蓄能珠的次数（v1.5.76 P1）。
   * 真源 = `{type:'bead', pid, kind:'elec'|'boom', delta}`：得珠 `delta:+1`、花掉 `delta:-1`
   * （state.js 的扣珠处与蓄能得珠处各发一条）。**只认花掉** —— 攒着不用、让它过期，都不记分。 */
  function countBeadSpent(events, seat) {
    let n = 0;
    for (const e of (events || [])) {
      if (e.type === 'bead' && e.pid === seat && (e.delta || 0) < 0) n++;
    }
    return n;
  }
  /* ===== v1.5.79（第七轮复核 §15-1）：把"**优先打威胁**"当能力奖 =====
   * 复核的机制发现：池子里**没人会瞄人**（脚本走 `pickTargetN`：能打死→血最多；v7 冠军能瞄但没被奖励过）
   * ⇒ 所谓"狙击专精"其实是**池子漏洞**：给 4 席加一条"谁放冷枪就打谁"的一行规则，v17-146 的 A 考卷 30% → **0%**。
   * 这与环课题的关键区别（也是它这次**有戏**的理由）：环的出手率是 **0**（奖励再大也 bootstrap 不到），
   * 而"打威胁者"**已经在发生**（复核实测靶向率 22.5% ≈ 随机 25%）⇒ 窄奖励能给**已有的偶然行为**定向加压。
   * 判据全部来自事件（不猜字段）：威胁 = 上一回合 q 出过 `pierce.*` 类或 `ring`，或上一回合 q 造成 ≥2 伤害；
   * 计分 = 我这一回合**打在威胁者身上**的**不同受击者数**（`e.source === seat`，两次封顶 ⇒ 奖励广度而非堆叠）。 */
  let TGT_W = 0;                       // 默认关：实验臂用 EPIRUS_TGT_W 打开
  function setTargetReward(w) { const v = Number(w); if (isFinite(v) && v >= 0) TGT_W = v; return TGT_W; }
  /* ===== v1.5.103（v1.5.100 §20）：**清场计数**奖励（默认关，实验臂用 `EPIRUS_CLEAR_W` 打开）=====
   * 口径**必须与门禁同源**（`tools/audit-lib.mjs` 场B 那一段）：
   *   ① 分界是**收缩开始** —— 收缩的伤 `source == null`（不可格挡），它之后的死者**不算**清场；
   *   ② 新规则下"打 1 点就能在全灭判胜里赢" ⇒ **胜率不作判据**（第五轮复核 §2-1）。
   * ⚠️ `death` 事件**不带凶手**（只有 `pid`/`reason`）⇒ 只能自己维护"最后一次伤害来源"来归因；
   *    不归因就等于奖励"别人把场子清了"（在 5 席同策略自对局里那是白送分）。 */
  let CLEAR_W = 0;
  function setClearReward(w) { const v = Number(w); if (isFinite(v) && v >= 0) CLEAR_W = v; return CLEAR_W; }
  function clearReward() { return { w: CLEAR_W }; }
  /* ===== v1.5.121（第十三轮复核 §23 的 **E4**）：**挡下伤害**计数奖励（默认关；实验臂用 `EPIRUS_BLOCK_W` 打开）
   * 事件口径（只认"真的挡掉/弹走"，**不认摆架势**）：
   *   · `{type:'blocked', to: seat}` —— 防御 / 反弹 / 原型制御 / 金刚盾 / 八卦阵 / 藤甲 / 全息 挡下；
   *   · `{type:'reflect', to: seat}` —— 反弹与原型制御把伤害**弹回**给施法者（也算"我挡住了"）。
   * ⚠️ 接线坑（我实测踩过）：`setEconomyReward` 里的 `if (o.<键> != null)` 必须落在**函数开头 1200 字符内**
   * —— D77 就是按这个 slice 查的；新旋钮的注释写太长会把 `divForceGens/wallFilter/wallGames` 顶出窗口 ⇒ 门当场红。
   * 实测：`divForceGens` 落在 1244 时红；把我那条 218 字符的前置注释压到 60 字符后就回到窗口内 ✓。
   * ⚠️ 只数**发生在我身上**的那一次（`e.to === seat`），与"攻击方打空"无关。 */
  let BLOCK_W = 0;
  function countBlocks(events, seat) {
    let n = 0;
    for (const e of (events || [])) {
      if ((e.type === 'blocked' || e.type === 'reflect') && e.to === seat) n++;
    }
    return n;
  }
  /* v1.5.124（§28a）：**用过的招数种类数**（去重、排除 ジ）—— 广度收益项的绝对量。
   * 只认"成功结算"的出手（`outcome === 'ok'`），被无效化的不算（否则刷被废的假动作也能赚钱）。 */
  function countVariety(events, seat) {
    const seen = {};
    for (const e of (events || [])) {
      if (e.type === 'action' && e.pid === seat && e.outcome === 'ok' && e.key && e.key !== R.SK.JI) seen[e.key] = 1;
    }
    return Object.keys(seen).length;
  }
  /* v1.5.126（用户洞察）：**贵卡**的判定与计数 —— 从**声明字段**推导，不写卡名清单（D81/D72 的规矩）：
   *   `cost >= 3`（大雷 5 · 地雷/净化/摄魂 3）**或** `energyNeeds` 非空（电磁炮需 1 电珠 · 激光眼需爆珠）。
   * 只认 `outcome === 'ok'` 的出手（被无效化的不算 ⇒ 不可刷）。 */
  function isBigCard(def) {
    if (!def) return false;
    if (typeof def.cost === 'number' && def.cost >= 3) return true;
    if (def.energyNeeds && Object.keys(def.energyNeeds).length) return true;
    return false;
  }
  function countBigCards(events, seat, RR) {
    const rules = RR || R;
    let n = 0;
    for (const e of (events || [])) {
      if (e.type !== 'action' || e.pid !== seat || e.outcome !== 'ok' || !e.key) continue;
      if (isBigCard(rules.byKey[e.key])) n++;
    }
    return n;
  }
  function bigCardReward() { return { w: BIGCARD_W }; }
  function blockReward() { return { w: BLOCK_W }; }
  /* v1.5.124（§28a）：广度收益项的只读回执（权重 + 阈值；判据用**无筛选种群**的 G 中位，见 CHANGELOG）。 */
  function widthReward() { return { w: WIDTH_W, floor: WIDTH_FLOOR, target: WIDTH_TARGET }; }
  function countClears(events, seat) {
    let shrink = false, n = 0;
    const lastBy = {};                 // 谁最后伤了谁（死亡事件无凶手字段 ⇒ 用伤害事件回溯）
    for (const e of (events || [])) {
      if (e.type === 'damage') {
        /* v1.5.113（与 `audit-lib` 同步修）：哨兵用收缩**自己的标记**，不能用 `source == null`
         * （地雷/天火按规则就是无来源伤害 ⇒ 旧口径会提前停止计数、**少算清场**）。 */
        if (e.reason === '终局收缩') shrink = true;
        else if (e.to != null) lastBy[e.to] = e.source;       // 覆盖式：最后一次伤害者才可能算凶手
      } else if (e.type === 'death') {
        if (!shrink && e.pid !== seat && lastBy[e.pid] === seat) n++;
      }
    }
    return n;
  }
  function threatKeyList() { return pierceKeyList().concat([R.SK.RING]); }
  function targetReward() { return { w: TGT_W, threatKeys: threatKeyList() }; }
  function countThreatHits(events, seat) {
    const tk = threatKeyList();
    const rounds = [];                 // rounds[r] = { cast:{pid:[key]}, dmg:{pid:amt}, myTo:{pid:hits} }
    let seen = {}, cur = -1;
    for (const e of (events || [])) {
      if (e.type === 'action') {
        /* ⚠ 回合边界：**一个 pid 重复出现**就是新回合的开始，且必须把 seen 清空
         * （漏了清空 => 所有 pid 都出现过之后，每个动作都被判成新回合 => 回合重建变垃圾 =>
         *  countThreatHits 恒 0。这正是 v1.5.79 第一版奖励**静默空操作**的原因，D68 已加硬到 ≥4 回合守住）。 */
        if (cur < 0) cur = 0;
        else if (seen[e.pid] !== undefined) { seen = {}; cur++; }
        seen[e.pid] = true;
        const rr = rounds[cur] || (rounds[cur] = { cast: {}, dmg: {}, myTo: {} });
        (rr.cast[e.pid] = rr.cast[e.pid] || []).push(e.key);
      } else if (e.type === 'damage') {
        if (cur < 0) continue;
        const rr = rounds[cur] || (rounds[cur] = { cast: {}, dmg: {}, myTo: {} });
        if (e.source != null) rr.dmg[e.source] = (rr.dmg[e.source] || 0) + (e.amt || 0);
        if (e.source === seat && e.to != null) rr.myTo[e.to] = (rr.myTo[e.to] || 0) + 1;
      }
    }
    const isThreat = function (q, r) {          // q 在上回合是否构成威胁（第 1 回合没有上回合）
      if (r < 1) return false;
      const pv = rounds[r - 1]; if (!pv) return false;
      const ks = pv.cast[q] || [];
      for (let i = 0; i < ks.length; i++) if (tk.indexOf(ks[i]) >= 0) return true;
      return (pv.dmg[q] || 0) >= 2;
    };
    let hits = 0;
    for (let r = 0; r < rounds.length; r++) {
      const rr = rounds[r]; if (!rr) continue;
      for (const q in rr.myTo) if (isThreat(Number(q), r)) hits++;
    }
    return hits;
  }

  /* v1.5.76（P1）：珠子闭环奖励权重（默认 0.05，两次封顶）。窄条件 + 可归因 + 事件派生。 */
  let BEAD_W = 0.05;
  function setBeadReward(w) { const v = Number(w); if (isFinite(v) && v >= 0) BEAD_W = v; return BEAD_W; }
  function beadReward() { return { w: BEAD_W }; }

  let PRESS_W = 0.03;
  function setPressReward(w) { const v = Number(w); if (isFinite(v) && v >= 0) PRESS_W = v; return PRESS_W; }
  function pressReward() { return { w: PRESS_W }; }

  /* 重建回合分组并数"主动回合"（纯函数，便于守门单测）。
   * 分组依据：一局里每回合每个玩家最多一条 action 事件 ⇒ 见到已出现过的 pid 的 action 即新回合。 */
  function countPressRounds(events, seat) {
    const rounds = [];
    let seen = {}, cur = -1;
    for (const e of events) {
      if (e.type === 'action') {
        if (seen[e.pid] !== undefined) { seen = {}; cur++; }
        else if (cur < 0) cur = 0;
        seen[e.pid] = true;
      }
      if (e.type === 'damage') {
        if (cur < 0) continue;
        if (!rounds[cur]) rounds[cur] = { my: 0, taken: 0 };
        if (e.source === seat) rounds[cur].my += e.amt || 0;
        if (e.to === seat) rounds[cur].taken += e.amt || 0;
      }
    }
    let n = 0;
    for (const r of rounds) if (r && r.my > 0 && r.taken === 0) n++;
    return n;
  }

  /* v1.5.31（方案 A）：示范期拉长到 0.8 + 接力调粗到 0.10。
   * 依据：v7teach 臂第一次让"小雷打环"可达（ringWallProbe 小雷次数 1>0），但 20 局才 1 次 ⇒ 接力太弱。 */
  let RING_W = 0.10;
  /* v1.5.24（用户选方案 A）：**退火** —— 前期权重 0（先把标准分练出来），中段线性升，后期满额。
   * 为什么：v1.5.23 的常开奖励练出了"会打环但标准分掉 14pt"的偏科生（环墙 68.5% / 标准 30.5%）；
   * 退火让种群先在主目标上站住，再叠加"惩罚开环者"的方向性压力。 */
  /* v1.5.29（用户实测 + 方案 b）：**退火默认关闭**（全程满额）。
   * 依据：① 退火那一轮（v1.5.24）与常开那轮（v1.5.23）的配对差异不显著，没换来任何好处；
   * ② 用户实测"我用聚能环时 v7press-36 也没做任何动作打断我" ⇒ 环奖励的**行为效果**本来就没建立起来，
   *    再叠一层退火只会让它更弱。需要回退成退火的实验可以显式调 setRingRamp。 */
  /* v1.5.31（课程臂专用窗口）：示范期（前 125 代，占 250 代的一半）里**环奖励不开**——
   * 实测：环奖励从第 0 代就开会让训练冻死（v7both/v7soft 两臂 6/6 seed 零提升）。
   * 现在改成"先示范、后强化"：模仿教师把动作示范出来，之后奖励接手。 */
  let RING_G0 = 125, RING_G1 = 200;
  function setRingReward(w) { const v = Number(w); if (isFinite(v) && v >= 0) RING_W = v; return RING_W; }
  function setRingRamp(g0, g1) {
    const a = Number(g0), b = Number(g1);
    if (isFinite(a) && a >= 0) RING_G0 = a | 0;
    if (isFinite(b) && b > RING_G0) RING_G1 = b | 0;
    return { g0: RING_G0, g1: RING_G1 };
  }
  /* 第 gen 代实际生效的环奖励权重（退火曲线）。纯函数，便于守门单测。 */
  function ringWeightAt(gen) {
    if (RING_W <= 0) return 0;
    const g = (typeof gen === 'number' && gen > 0) ? gen : 0;
    if (g <= RING_G0) return 0;
    if (g >= RING_G1) return RING_W;
    return RING_W * (g - RING_G0) / Math.max(1, RING_G1 - RING_G0);
  }
  function ringReward() { return { w: RING_W, g0: RING_G0, g1: RING_G1, at0: ringWeightAt(0), atEnd: ringWeightAt(1e9) }; }

  let MIRROR_GAMES = 2;
  /* v1.5.69：**独立的座位探针局数** —— 阈值式座位惩罚的样本来源。
   * 教训（v1.5.68）：最初想蹭 MIRROR_GAMES（=2）的局，但守卫 `seatDec >= 3` 永不满足
   * ⇒ 惩罚**从未触发**、v16 那 6 个 seed 是在"惩罚关闭"下跑的（又是静默空操作）。
   * 故独立取样：默认 6 局（`EPIRUS_SEAT_GAMES` 可调），守卫放宽到 `>= 4`。 */
  let SEAT_GAMES = 6;
  function setSeatGames(v) { if (isFinite(v) && v >= 0) SEAT_GAMES = v | 0; return SEAT_GAMES; }   // 模块级（内层那个同名定义不可见）
  function setMirrorGames(k) {
    const v = Number(k);
    if (isFinite(v) && v >= 0) MIRROR_GAMES = v | 0;
  function setSeatGames(v) { if (isFinite(v) && v >= 0) SEAT_GAMES = v | 0; return SEAT_GAMES; }
    return MIRROR_GAMES;
  }
  function mirrorGames() { return MIRROR_GAMES; }
  function seatGames() { return SEAT_GAMES; }
  function setHealthGate(o) {
    o = o || {};
    if (o.on != null) HEALTH.on = !!o.on;
    if (o.games != null && o.games > 0) HEALTH.games = o.games | 0;
    if (o.promoteGames != null && o.promoteGames > 0) HEALTH.promoteGames = o.promoteGames | 0;
    if (o.n != null && o.n >= 2) HEALTH.n = o.n | 0;
    if (o.minG != null) HEALTH.minG = Number(o.minG);
    if (o.maxDraw != null) HEALTH.maxDraw = Number(o.maxDraw);
    if (o.maxRounds != null) HEALTH.maxRounds = Number(o.maxRounds);
    return healthGate();
  }
  function healthGate() { return { on: HEALTH.on, games: HEALTH.games, promoteGames: HEALTH.promoteGames, n: HEALTH.n, minG: HEALTH.minG, maxDraw: HEALTH.maxDraw, maxRounds: HEALTH.maxRounds }; }

  /* 自对局体检：5 座都是**同一个策略**（与 champ-audit 的 A/B/C/D 列同一口径）。 */
  /* v1.5.35（用户裁定）：**终局平局的正确口径**。
   * 规则里写的是"到上限按血最多者胜"（`rules.js:134`）⇒ 游戏本身已按血量排名次；
   * 此前体检把"全员存活"一律记成平局 ⇒ 血量高的胜局被误记成"和"（农夫场 0% 胜 / 100% 和的假象）。
   * 现在只有**全员存活且血量完全相同**才算平局；血量有差 ⇒ 那是**按血量的胜局**。
   * （用户补充：若血量也相同，则判负/不分胜负——本项目按"不计胜"处理。） */
  function allAliveTied(p) {
    if (!p || !p.length) return false;
    for (let i = 0; i < p.length; i++) if ((p[i].hp || 0) <= 0) return false;
    for (let i = 1; i < p.length; i++) if (p[i].hp !== p[0].hp) return false;
    return true;
  }

  /* v1.5.88（甲·步 1）：**退火强迫多样性** —— 前 DIV_FORCE_GENS 代里，在被测成员的**计分对局**中
   * 以 eps=1 在"可负担的非ジ候选"里**轮转**选招（逼出宽直方图）。产物必须取自窗口之后（与环那次同一配方：
   * 强迫只负责"把状态走出来"，退火后由网络自己保住）。每代错开起点，避免所有成员同步。 */
  function makeDiversityForce(inner, gen) {
    let rr = (gen * 7) % 97;
    return function (state, pid, legal) {
      const aff = [];
      for (let i = 0; i < legal.length; i++) if (legal[i].affordable && legal[i].key !== R.SK.JI) aff.push(legal[i].key);
      if (aff.length > 1) { rr++; return { key: aff[rr % aff.length], target: null, target2: null, bead: null }; }
      return inner(state, pid, legal);
    };
  }
  /* v1.5.88（甲·步 2）：**破墙硬过滤** —— 成员在"4 席 reflectspam"里对我方造成的伤害 < 0.5/局就直接压到底。
   * 起因：v7divK-82 多样性最好（G 4.42）却对 4 面反弹墙**零伤害**（0.00/局、100% 零伤害局），
   * 换包时才被拦。而它在自对局里的穿透卡用量看起来正常（激光剑 28/坦克 16/狙击枪 44）⇒
   * **"自对局用了穿透卡"不能预测"反弹墙里打不打得动"** ⇒ 必须在**真的反弹墙**里量（3 局就够抓 0 伤害）。 */
  function wallProbe(params, games, n) {
    const foe = BOT_PICKS['reflectspam'];
    if (!foe) return null;
    const G = Math.max(1, games | 0);
    let dmg = 0;
    for (let g = 0; g < G; g++) {
      const st = S.createState(TRAIN_MODE === 'long' ? 'long' : 'multi', { next: mulberry32(91000 + g * 13) }, n);
      const ch = [];
      for (let pid = 0; pid < n; pid++) ch.push(pid === 0 ? policyChooserN(params, 0.15) : wrapBotN(foe));
      Play.autoGameN(st, ch);
      for (const e of (st.events || [])) if (e.type === 'damage' && e.source === 0) dmg += (e.amt || 0);
    }
    return dmg / G;
  }

  function mirrorHealth(params, games, n, mode) {
    const G = (games && games > 0) ? (games | 0) : 20;
    const N = (n && n >= 2) ? (n | 0) : 5;
    const mk = (mode === 'long') ? 'long' : 'multi';
    let dmg = 0, heavyDmg = 0, holo = 0, holoOther = 0, draws = 0, rounds = 0, zero = 0;

    /* v1.5.79：威胁靶向奖励的 **支付诊断**（只读，不改变行为）。
     * 封顶式奖励的天然风险是「每局都封顶」 => 奖励退化成**常量** => 梯度约等于 0
     * （同型事故：v1.5.68 的 seatPen 恒 0，整臂在"惩罚关闭"下白跑）。
     * threatCapRate = 有多少局真的吃满封顶，这是"奖惩有没有梯度"的直接读数。 */
    let threatHitsSum = 0, threatCapGames = 0;
    /* 同型体检：**已上线**的 press/pierce 奖励是不是也在空发？（它们同样依赖 e.source === seat） */
    let pressSum = 0, pierceSum = 0;
    const seatWins = new Array(N).fill(0);   // v1.5.68：5 席同策略的各座胜场（座位偏置的直接读数）
    let seatDec = 0;
    const keyCount = {};
    /* v1.5.28（第三方复核 §4-2b）：**落地命中按卡统计** —— G（出手分布的熵）会被"变宽但丢关键卡"骗：
     * v1.5.27 实测 G 4.15→6.55 的同时，把唯一能穿反弹的**激光剑**用到 0 命中（长程反弹墙 85%→0%）。
     * 这里直接统计 `damage` 事件的 `via`，并**从规则数据推导**出"能穿反弹/穿防御"的卡（不硬编码）。 */
    const landByKey = {};
    for (let g = 0; g < G; g++) {
      const st = S.createState(mk, { next: mulberry32(9000 + g) }, N);
      st.slotSalt = slotSaltFor(9000 + g);
      const ch = [];
      for (let i = 0; i < N; i++) ch.push(policyChooserN(params, 0.15));
      Play.autoGameN(st, ch);
      if (st.winner !== 'draw' && st.winner != null) { seatWins[st.winner]++; seatDec++; }   // v1.5.68
      let gd = 0;
      for (const e of st.events) {
        /* v1.5.32：**把盾套给别人**要单独计数（用户实测：v7wall-33 每局 18.7 次全息、100% 送人）*/
        if (e.type === 'holoSet') { holo++; if (e.target !== e.pid) holoOther++; }
        if (e.type === 'damage') {
          dmg += e.amt; gd += e.amt;
          const def = e.via ? R.byKey[e.via] : null;
          if (e.via) landByKey[e.via] = (landByKey[e.via] || 0) + 1;
          if (def && def.cost != null && def.cost >= 3) heavyDmg += e.amt;
        }
        /* G：只统计**非ジ**的成功出手（ジ 占比 ~60% 是算术必然，算进去会把覆盖度量成常数）。 */
        if (e.type === 'action' && e.outcome === 'ok' && e.key && e.key !== R.SK.JI) {
          keyCount[e.key] = (keyCount[e.key] || 0) + 1;
        }
      }
      rounds += st.round;
      if (gd === 0) zero++;
      if (allAliveTied(st.p)) draws++;   // v1.5.35：只有血量也相同才算平局

      /* v1.5.79：统计"威胁命中"的真实分布（诊断奖励是否退化成常量） */
      /* 与奖励的封顶同步：tgtBonus = TGT_W * min(1, hits/1) ⇒ hits>=1 即满额。 */
      { const _seatD = g % N; const _th = countThreatHits(st.events, _seatD); threatHitsSum += _th; if (_th >= 1) threatCapGames++; pressSum += countPressRounds(st.events, _seatD); pierceSum += countPierceHits(st.events, _seatD); }
    }
    const ks = Object.keys(keyCount);
    const tot = ks.reduce(function (a, k) { return a + keyCount[k]; }, 0);
    /* 从 R.skills 推导"能穿反弹/穿防御"的卡（激光剑/坦克/狙击枪/电磁炮）—— 规则改了它自动跟着变。 */
    const pierceKeys = (R.skills || []).filter(function (sd) {
      const pp = sd.pierce || {};
      return !!(pp.reflect || pp.defense);
    }).map(function (sd) { return sd.key; });
    let H = 0;
    for (const k of ks) { const pr = keyCount[k] / tot; H -= pr * Math.log(pr); }
    return {
      games: G, dmgPerGame: dmg / G, heavyPerGame: heavyDmg / G, holoPerGame: holo / G,
      zeroRate: zero / G, drawRate: draws / G, rounds: rounds / G,
      holoOtherPerGame: holoOther / G,
      effSkills: tot ? Math.exp(H) : 0, distinctKeys: ks.length, nonJi: tot,
      landByKey: landByKey, pierceKeys: pierceKeys,
      /* 零落地的"穿透卡"（能穿反弹/穿防御）—— 为 0 就说明**破墙的那条线丢了** */
      pierceMissing: pierceKeys.filter(function (k) { return !landByKey[k]; }),
      seatWins: seatWins, seatDecisive: seatDec,
      threatHitsPerGame: threatHitsSum / Math.max(1, G), threatCapRate: threatCapGames / Math.max(1, G),
      pressRoundsPerGame: pressSum / Math.max(1, G), pierceHitsPerGame2: pierceSum / Math.max(1, G),
      seatSpread: (function () { if (seatDec < 3) return null; const p = seatWins.map(function (w) { return 100 * w / seatDec; }); return Math.max.apply(null, p) - Math.min.apply(null, p); })()
    };
  }
  function healthFails(mh) {
    if (!mh) return [];
    const f = [];
    if (mh.effSkills < HEALTH.minG) f.push('G 有效技能数 ' + mh.effSkills.toFixed(2) + ' < ' + HEALTH.minG);
    if (mh.drawRate > HEALTH.maxDraw) f.push('平局率 ' + (mh.drawRate * 100).toFixed(0) + '% > ' + (HEALTH.maxDraw * 100) + '%');
    if (mh.rounds > HEALTH.maxRounds) f.push('自对局回合 ' + mh.rounds.toFixed(1) + ' > ' + HEALTH.maxRounds);
    return f;
  }

  function pickChampionByWinRate(t, games, seedBase) {
    const cands = [t.champion].concat(t.lastTop || []);
    const pool = [];
    const seen = new Set();
    for (const params of cands) {
      if (!params || seen.has(params)) continue;
      seen.add(params);
      const sel = policyChooser(params, 0.05);
      let tot = 0, n = 0, minWr = 1;
      const detail = [];
      for (const nm of Object.keys(BOT_PICKS)) {
        const r = correctedWinRate(sel, BOT_PICKS[nm], games, seedBase + n * 131);
        tot += r.wr; n++;
        if (r.wr < minWr) minWr = r.wr;
        detail.push({ name: nm, wr: r.wr });
      }
      const wr = n ? tot / n : 0;
      // 硬门槛：任一基准 <50% → 直接失去冠军资格（GATE_ALL 时覆盖全部基准）
      let gateOk = true, gateMin = 1;
      for (const d of detail) if (GATE_ALL || GATE_NAMES.indexOf(d.name) >= 0) { gateOk = gateOk && d.wr > 0.5; if (d.wr < gateMin) gateMin = d.wr; }
      // min 主导：过了门槛按 0.5·平均 + 0.5·最差基准；没过门槛则压到所有合格候选之下
      const base = gateOk ? (0.5 * wr + 0.5 * (n ? minWr : 0)) : (gateMin * 0.4 - 1);
      /* v7：**自对局健康门槛**（见 mirrorHealth 的说明）。不过门槛的候选被压到所有健康候选之下，
       * 且不许进容差带 ⇒ 训练器不能再靠"熬"拿分。 */
      const mh = (HEALTH.on && !IN_EXPLORE) ? mirrorHealth(params, HEALTH.games, HEALTH.n, TRAIN_MODE) : null;   // v1.5.42：探索期不评估健康
      const hFails = healthFails(mh);
      const healthOk = hFails.length === 0;
      const score = healthOk ? base : base - 1;
      pool.push({ params: params, score: score, wr: wr, minWr: minWr, detail: detail, health: mh, healthOk: healthOk, healthFails: hFails });
    }
    // 多目标：先按胜率分选出容差带，再在其中取覆盖熵最高者
    let best = null, bestScore = -1, bestWr = -1, bestMin = -1, bestDetail = null;
    let topScore = -1e9;
    for (const c of pool) if (c.score > topScore) topScore = c.score;
    const band = pool.filter(function (c) { return c.healthOk && c.score >= topScore - WR_TOL; });
    let bestDiv = -1, bestDivNorm = 0, bestDistinct = 0;
    /* 头对头验收（2/3 人实测都需要的保险）：
     * 1st+0.5*top2 这类名次指标**不能完整代表头对头强度**——3 人侧实测容差带内的
     * 最发散候选虽然指标够格，却被 2 倍数量的强候选打成 17:62。
     * 故：带内候选必须与「最高分候选」对拼 >= H2H_MIN 才允许被选中，否则顺延到下一个。 */
    const H2H_MIN = 0.5;
    const topCand = pool.reduce(function (a, b) { return b.score > a.score ? b : a; });
    const topSel = policyChooser(topCand.params, 0.15);
    const ranked = band.slice().sort(function (a, b) {
      return champEntropy(b.params, 0.15, 60, seedBase + 7777).divNorm - champEntropy(a.params, 0.15, 60, seedBase + 7777).divNorm;
    });
    let h2hNote = null;
    for (const c of ranked) {
      const e = champEntropy(c.params, 0.15, 60, seedBase + 7777);
      let ok = true, h2h = null;
      if (c !== topCand && c.params !== topCand.params) {
        const r = correctedWinRate(topSel, policyChooser(c.params, 0.15), 60, seedBase + 4242);
        h2h = r.wr;
        ok = r.wr >= H2H_MIN;
      }
      if (!ok) { h2hNote = (h2hNote || '') + ' [跳过 divNorm=' + e.divNorm.toFixed(3) + ' 把头对头仅 ' + (h2h * 100).toFixed(0) + '%]'; continue; }
      best = c.params; bestScore = c.score; bestWr = c.wr; bestMin = c.minWr; bestDetail = c.detail;
      bestDivNorm = e.divNorm; bestDistinct = e.distinct; bestDiv = e.divNorm; break;
    }
    if (!best) { best = topCand.params; bestScore = topCand.score; bestWr = topCand.wr; bestMin = topCand.minWr; bestDetail = topCand.detail; bestDivNorm = 0; bestDistinct = 0; }
    if (h2hNote) console.log('[多目标] 头对头验收拦截:' + h2hNote);
    if (best) { t.divNorm = bestDivNorm; t.distinct = bestDistinct; t.bandSize = band.length; }
    if (best) { t.champion = best.slice(); t.bestChamp = best.slice(); t.bestChampScore = bestScore; }
    return { champion: best, wr: bestWr, minWr: bestMin, score: bestScore, detail: bestDetail };
  }

  global.EpirusTrainer = {
    makeTrainer, step, finishStep, scoreMember, buildOpps, oneGame, correctedWinRate, champVsBaseline, mulberry32, seedChampion, pickChampionByWinRate, champEntropy, setRegenTotal, regenForGen, makeCommitChooser, evalEconProbe, evalSubsidyProbe, costOfKey, setImitUntil, imitBetaForGen, setImitTeacher, imitTeacher, makeAntiRingTeacher, setAntiRingTeacher, setImitTeacherByName, setImitOverride, teacherFull, setImitPlan, setImitPlanByName, imitTeacherForGen, setImitOnly, imitOnlyForGen, setImitSubOnly, setSubBead, subBeadOn, setWrTol, setTrainMode, trainMode, setStyleSlice, styleSlice, passiveFieldAt, PASSIVE_FIELD, PASSIVE_EVERY, seatGames, setSeatGames,
  setEconomyReward, economyReward, economyTargets, economyStock, coverageEntropy, setFightReward, fightReward, rankCredit, firstBloodSeat, roleOf,
    mirrorHealth, setHealthGate, healthGate, healthFails, setMirrorGames, mirrorGames,
    setRingReward, ringReward, countRingBreaks, setRingRamp, ringWeightAt,
    setPressReward, pressReward, countPressRounds,
    setPierceReward, pierceReward, countPierceHits, pierceKeyList,
    setBeadReward, beadReward, countBeadSpent,
    setTargetReward, targetReward, countThreatHits, threatKeyList,
    setClearReward, clearReward, countClears,
    blockReward, countBlocks,   // v1.5.121 E4：挡下伤害计数（奖励权重走 econ-env 的 blockW）
    widthReward,                // v1.5.124 §28a：广度收益项（权重走 econ-env 的 widthW）
    bigCardReward, countBigCards,   // v1.5.126：贵卡出手奖励（权重走 econ-env 的 bigcardW）
    allAliveTied, setRingForceEps, ringForceEps, ringForceTarget, setRingForceUntil, ringForceUntil, ringForceEpsAt,
    scoreMemberN, oneGameN, evalN, policyChooserN, policyChooser, pickChampion, econBase, wrapBotN, pickTargetN, pickTarget2N, rankOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
