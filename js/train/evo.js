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
      return P.choose(state, pid, base, params, { temp: temp });
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
    reflectmix: Bots.pickReflectMix, reflecttank: Bots.pickReflectTank, defreflectgun: Bots.pickDefReflectGun
  };
  // 硬门槛：任何一条基准 <50% 的候选一律不许当冠军（否则"对某类打法更脆"会被 avg 平均掉）。
  // 起初只挡人类式三条，实测仍放过"永久防御 50% / 永久反弹 27%"这类洞，故扩到全部基准。
  const GATE_ALL = true;

  function oneGame(aSel, bSel, seed, mode) {
    const st = S.createState(mode || 'standard', { next: mulberry32(seed) });
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

  /* N 人版策略 chooser（带目标选择）。
   * eps = ε-探索：以概率 eps 在可负担技能里均匀抽一个。
   * 为什么必须有：策略在 ep≥1 时 99.8% 选枪，"不花钱攒钱"这个动作
   * 几乎不可能被 softmax 采样到 → 奖励再大也没有梯度（经验：
   * save/conv/hold 三项都加了，max ep 仍然死守 1）。
   * 训练用 eps>0；评测/UI 不传 eps → 行为不变。 */
  function policyChooserN(params, temp, eps) {
    return function (state, pid, legal) {
      const aff = legal.filter(function (l) { return l.affordable; });
      const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
      const key = (eps && state.rng.next() < eps)
        ? base[Math.floor(state.rng.next() * base.length)].key
        : P.choose(state, pid, base, params, { temp: temp });
      return { key: key, target: pickTargetN(state, pid, key), target2: pickTarget2N(state, pid, key, pickTargetN(state, pid, key)) };
    };
  }

  /* 脚本 chooser 包一层（补目标），供 N 人局使用 */
  function wrapBotN(sel) {
    return function (state, pid, legal) {
      const k = sel(state, pid, legal);
      const key = (typeof k === 'string') ? k : (k && k.key);
      const t1 = pickTargetN(state, pid, key);
      return { key: key, target: t1, target2: pickTarget2N(state, pid, key, t1) };
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
      const r = oneGameN(ch, seedBase + g * 977, N);
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

  /* 某技能的真实费用（评测用） */
  function costOfKey(key, n) {
    const st = S.createState('multi', { next: mulberry32(7) }, (n > 2 ? n : 3));
    for (let i = 0; i < st.p.length; i++) { st.p[i].ep = 99; st.p[i].elec = 3; st.p[i].boom = 3; }
    const c = S.computeCost(st, 0, key);
    return (c && c.ok) ? c.ep : null;
  }

  function oneGameN(choosers, seed, n, opts) {
    const st = S.createState('multi', { next: mulberry32(seed) }, n, opts);
    Play.autoGameN(st, choosers);
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
  function rankOf(st, seat) {
    const n = st.p.length;
    const taken = [];
    for (let i = 0; i < n; i++) taken.push(0);
    for (const e of st.events) if (e.type === 'damage' && e.to != null) taken[e.to] += (e.amt || 0);
    const order = [];
    for (let i = 0; i < n; i++) {
      const hp = Math.max(0, st.p[i].hp);
      order.push({ i: i, alive: hp > 0 ? 1 : 0, hp: hp, taken: taken[i] });
    }
    order.sort(function (a, b) {
      if (a.alive !== b.alive) return b.alive - a.alive;
      if (Math.abs(b.hp - a.hp) > 1e-9) return b.hp - a.hp;
      return a.taken - b.taken;
    });
    for (let k = 0; k < order.length; k++) if (order[k].i === seat) return k + 1;
    return n;
  }

  /* 经济统计：本局"达到过的最高 ep"与"贵技能（ep ≥ 2）出手次数"。
   * 经济锁死的病根：AI 永远停在 ep≤1 的 ジ→枪 循环，2 ジ 以上技能永久不可负担。
   * 旧 fitness 的 proact/deal 奖励"立刻打伤害"，而攒钱必须先连出ジ（0 伤害）→
   * 旧口径实际上在惩罚攒钱，故加 save/conv 两项把梯度补上。 */
  function makeEconChooser(inner, agg, teacherFn, imitB) {
    const rec = { maxEp: 0, heavy: 0, hold: 0, heavy4: 0 };
    const fn = function (state, pid, legal) {
      const p = state.p[pid];
      if (p && p.ep > rec.maxEp) rec.maxEp = p.ep;
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
          if (tk != null) { agg._mt = (agg._mt || 0) + 1; if (a.key === tk) agg._mm = (agg._mm || 0) + 1; }
        }
        const c = S.computeCost(state, pid, a.key);
        if (c && c.ok) {
          if (c.ep >= 2) rec.heavy++;
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
  const STOCK_BONUS = 0.05;  // 0~4 ep 区间的攒钱奖励上限
  const HOARD_PEN = 0.12;    // 11+ ep 的囤积惩罚上限

  /* N 人适应度（N19）：名次基础分（1/0.6/0.2）+ 轻量 shaped 项 */
  function scoreMemberN(params, opps, games, n, gen, idx) {
    let fit = 0, first = 0, second = 0, dealt = 0, rounds = 0, played = 0;
    let maxEpSum = 0, heavySum = 0, holdSum = 0, deepSum = 0, econGames = 0, epGain = 0, ringCasts = 0;
    let imitSum = 0, imitGames = 0;
    const agg = { use: {}, aff: {} };   // 该个体的动作直方图（跨局汇总）
    for (let g = 0; g < games; g++) {
      const seat = g % n;                                   // 座位轮换
      const seed = seedOfGen(gen, idx, 'n') + g * 7919;
      const choosers = [];
      let oi = g % opps.length;
      const imitB = imitBetaForGen(gen);   // C 方案：脚本教师模仿奖励（退火，后期为 0）
      let econ = null;
      for (let pid = 0; pid < n; pid++) {
        if (pid === seat) {
          // 承诺级 ε：30% 的局抽一个储蓄视界 h∈1..4，本局 ep<1+h 时只准出 ジ
          const hr = mulberry32(seed + 991)();
          const h = hr < 0.30 ? (1 + Math.floor(mulberry32(seed + 992)() * 4)) : 0;
          const baseSel = h > 0 ? makeCommitChooser(params, 0.35, h) : policyChooserN(params, 0.35, 0.15);
          econ = makeEconChooser(baseSel, agg, imitB > 0 ? BOT_PICKS['heavyfire'] : null, imitB); choosers.push(econ);
        }
        else { choosers.push(wrapBotN(opps[oi % opps.length].sel)); oi++; }
      }
      // 每回合回 ep 的对局权重（可选设施，默认 0 = 与线上规则一致）。
      // 实测结论：regen=1 不能解锁聚能环（+1/回合只够每回合放一个 1 ジ技能，
      // 锁死在另一个不动点）；regen=2 确实能让 AI 学会聚能环（连用到 16），
      // 但环是严格支配策略（免费 +3/回合永续）→ 学会后反而更窄。
      // 故默认关闭，等规则/平衡决策后再开。
      const regen = regenForGame(g, games);   // Q1(d) 永久回放切片：每代固定 ~8% 的局带补贴，永不退火
      const r = oneGameN(choosers, seed, n, { regen: regen });
      const rank = rankOf(r.state, seat);
      const base = rank === 1 ? 1.0 : rank === 2 ? 0.3 : 0.0;   // N19 修正：3 人局里第二名也算输，降低苟活奖励
      const others = r.dmg.reduce(function (a, b) { return a + b; }, 0) - r.dmg[seat];
      const diff = r.dmg[seat] - others / Math.max(1, n - 1);
      // "立刻出手"的权重下调（原来在惩罚攒钱）；腾出的权重给经济两项
      const proact = 0.02 * Math.max(-1, Math.min(1, diff / 6));
      const deal = 0.01 * Math.min(1, r.dmg[seat] / 4);
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
      let stock;
      if (mEp <= 4) stock = STOCK_BONUS * (mEp / 4);
      else if (mEp <= 10) stock = STOCK_BONUS;
      else stock = STOCK_BONUS - HOARD_PEN * Math.min(1, (mEp - 10) / 10);
      deepSum += econ ? econ.rec.heavy4 : 0;

      // 花得出：把攒的 ep 换成贵技能（2 次封顶）——只有 save 没有 conv 就是 farmer，故两项并重
      // 经济分档：贵的技能更值钱（不再指向某个特定循环）
      const conv = 0.08 * Math.min(1, (econ ? econ.rec.heavy : 0) / 2)
                 + 0.08 * Math.min(1, (econ ? econ.rec.heavy4 : 0) / 1);
      fit += Math.max(-0.3, Math.min(1.8, base + proact + deal + stock + conv - slow + imitB * imit));
      if (econ) { maxEpSum += econ.rec.maxEp; heavySum += econ.rec.heavy; holdSum += econ.rec.hold; econGames++; }
      // 经济引擎质量：本局获得的 ep 总量。聚能环第 3 次起每回合 +3（ジ 只 +1），
      // 直接在这个量上体现 → 不用为“环”单独写奖励，避免又指向特定循环。
      for (let ei = 0; ei < r.state.events.length; ei++) {
        const e = r.state.events[ei];
        if (e.type === 'ep' && e.pid === seat && e.delta > 0) epGain += e.delta;
      }
      if (rank === 1) first++;
      else if (rank === 2) second++;
      dealt += r.dmg[seat];
      rounds += r.rounds;
      played++;
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
    const divNorm = uTot > 0 ? H / Math.log(affN) : 0;
    const divBonus = 0;   // Q3：覆盖熵移出目标函数，只作诊断（它和"见过那个状态"是两回事）
    const fitAvg = played ? fit / played : 0;
    return {
      fit: fitAvg + divBonus,
      fitNoDiv: fitAvg,
      divNorm: divNorm,
      divBonus: divBonus,
      distinct: Object.keys(agg.use).length,
      first: first, second: second, games: played,
      firstRate: played ? first / played : 0,
      top2Rate: played ? (first + second) / played : 0,
      avgDealt: played ? dealt / played : 0,
      avgRounds: played ? rounds / played : 0,
      avgMaxEp: econGames ? maxEpSum / econGames : 0,
      avgHeavy: econGames ? heavySum / econGames : 0,
      avgHold: econGames ? holdSum / econGames : 0,
      avgDeep: econGames ? deepSum / econGames : 0,
      avgImit: imitGames ? imitSum / imitGames : 0
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
        const r = oneGameN(choosers, seedBase + g * 977 + total, n);
        const rank = rankOf(r.state, seat);
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
    const champ = policyChooser(t.champion, 0.05);
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
    if (better) {
      t.bestChamp = cand.params;
      t.bestChampScore = cand.score;
      t.bestChampAttack = cand.attackShare || cand.attackRate;
    }
    const champPrev = t.champion;
    const champChanged = t.bestChamp !== champPrev;
    if (champChanged) { t.champion = t.bestChamp; t.championAge = 0; }
    else t.championAge++;
    t.bestParams = t.bestChamp;
    // 记录最近一代强候选 params，供收尾按真实胜率择优（避免 shaped fitness 过拟合到"打伤害不赢"的激进型）
    t.lastTop = sorted.slice(0, 3).map(function (m) { return m.params; });
    const rec = { gen: t.gen, best: bestScore, champChanged: champChanged, champAge: t.championAge, sigma: t.sigma };
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
      if (N > 2) { const ch = []; for (let i = 0; i < N; i++) ch.push(sel); oneGameN(ch, seedBase + g * 977, N); }
      else oneGame(sel, sel, seedBase + g * 977);
    }
    let H = 0;
    for (const k in use) { const pr = use[k] / dec; H -= pr * Math.log(pr); }
    return { divNorm: dec ? H / Math.log(Math.max(2, (R.skills || []).length)) : 0, distinct: Object.keys(use).length };
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
  let IMIT_UNTIL = 0;                // 退火代数（由 setImitUntil 设置；0=关闭）
  function setImitUntil(n) { IMIT_UNTIL = Math.max(0, Math.floor(n) || 0); }
  function imitBetaForGen(gen) {
    if (!IMIT_UNTIL || gen >= IMIT_UNTIL) return 0;
    return IMIT_BETA * (1 - gen / IMIT_UNTIL);      // 线性退火
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

  /* 容差带：可用 EPIRUS_WR_TOL 覆盖（单变量对照用）。
   * 0.01 = 为修 3P 头对头而收紧；0.03 = div555 当年的值（容差宽 → 选出更发散的候选）。 */
  const WR_TOL = (typeof process !== 'undefined' && process.env && process.env.EPIRUS_WR_TOL)
    ? Number(process.env.EPIRUS_WR_TOL) : 0.01;

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
      const score = gateOk ? (0.5 * wr + 0.5 * (n ? minWr : 0)) : (gateMin * 0.4 - 1);
      pool.push({ params: params, score: score, wr: wr, minWr: minWr, detail: detail });
    }
    // 多目标：先按胜率分选出容差带，再在其中取覆盖熵最高者
    let best = null, bestScore = -1, bestWr = -1, bestMin = -1, bestDetail = null;
    let topScore = -1e9;
    for (const c of pool) if (c.score > topScore) topScore = c.score;
    const band = pool.filter(function (c) { return c.score >= topScore - WR_TOL; });
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
    makeTrainer, step, finishStep, scoreMember, buildOpps, oneGame, correctedWinRate, champVsBaseline, mulberry32, seedChampion, pickChampionByWinRate, champEntropy, setRegenTotal, regenForGen, makeCommitChooser, evalEconProbe, costOfKey, setImitUntil, imitBetaForGen,
    scoreMemberN, oneGameN, evalN, policyChooserN, wrapBotN, pickTargetN, rankOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
