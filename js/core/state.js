/* Epirus — 状态结构与“出招”（费用/禁用/条件）层
 * 裁定见 docs/RULES-2P.md §2.2（R10/R25/R29/R32/R42/R43/R48/R52/R55）。资源不足=无法发动（无贷款）。
 */
(function (global) {
  'use strict';
  const R = global.EpirusRules;

  function freshPlayer(id, name, hp) {
    return {
      id, name, hp, ep: 0,
      lastSkill: null,
      lastTarget: null, lastTarget2: null,   // v1.5.19：上一手指向谁（公共信息；供特征 T 块与 UI）
      elec: 0, boom: 0,             // 能量珠 R9'（只供下一回合，回合末未用即清空）
      beadNew: null,                // 本回合蓄能新得的珠类型（endTurn 据此决定谁过期）
      ringStreak: 0,                // 聚能环连击 R10
      cannonCount: 0,               // 过载炮次数 R42
      cooldown: {},                 // 大雷禁用 R29
      rodGuard: 0,                  // 避雷针情形B（剩余免雷次数）R31
      mineArmed: false,             // R38（v1.5.109 R59：不再是"直到被触发"，而是 3 回合计时）
      mineTurns: 0,                 // v1.5.109 R59：剩余回合数（3 = 本回合 + 后两个回合）
      mineRound: -1,                // v1.5.136 N6：埋雷所在回合（判"当回合埋当回合炸⇒不可转移"用；-1=无雷）
      guardNext: false, baguaExtra: false,  // 无极变速第二回合 R21
      copiedGuard: null,             // N14 v1.5.17：镜面反射复制来的架势（只在结算它的那个回合有效）
      fireWeakNext: false, fireWeakNow: false, // 藤甲 R22
      tauntPending: false, tauntActive: false, // 挑衅 R41/R54
      tauntBy: [], tauntByPending: [],          // v1.5.138（指向盲审计）：义务期"必须攻击谁"的挑衅者名单（N 人可多人、pending/active 与布尔同步）
      tauntFrom: null, tauntTo: null,          // N人：挑衅指向（2人时等价于布尔）
      nightmare: false,             // R50
      chains: [],                   // R45 铁索：我连着的对手 pid 列表（2人=1个）
      vampire: false, vampHeal: 0,  // R47
      reviveNext: false, infiniteEnergy: false, // 回魂 R48
      stickers: [],                 // 贴在自己身上的符咒 [{owner,age}] R34/R44
      deadLogged: false             // N12 死亡事件只报一次
    };
  }

  /* 玩家名：2人沿用「你/电脑」（页面既有口径），N人用「玩家1..N」。 */
  function defaultNames(n) {
    if (n === 2) return ['你', '电脑'];
    const a = [];
    for (let i = 0; i < n; i++) a.push('玩家' + (i + 1));
    return a;
  }

  /* createState(modeKey, rng, n) — n 省略/非法时=2（完全保留 1.0 行为）。
   * N人：p/actions 长度=n；技能目标写在 action.target（resolve 层据此结算）。 */
  function createState(modeKey, rng, n, opts) {
    const epRegen = (opts && opts.regen) ? Math.max(0, Math.floor(opts.regen)) : 0;
    const baseMode = R.MODES[modeKey] || R.MODES[R.MODE_DEFAULT];
    /* v1.5.11：允许调用方（页面控制区 / 实验工具）覆盖终局收缩参数。
     * ⚠️ 必须**浅拷贝** —— `R.MODES[key]` 是全局共享对象，直接改会污染之后所有对局。 */
    const mode = (opts && (opts.suddenDeath != null || opts.suddenDeathDmg != null))
      ? Object.assign({}, baseMode, {
        suddenDeath: (opts.suddenDeath != null ? opts.suddenDeath : baseMode.suddenDeath),
        suddenDeathDmg: (opts.suddenDeathDmg != null ? opts.suddenDeathDmg : baseMode.suddenDeathDmg)
      })
      : baseMode;
    const N = (typeof n === 'number' && n >= 2) ? Math.floor(n) : 2;
    const names = defaultNames(N);
    const p = [];
    for (let i = 0; i < N; i++) p.push(freshPlayer(i, names[i], mode.hp));
    const actions = [];
    for (let i = 0; i < N; i++) actions.push(null);
    return {
      modeKey, mode, n: N,
      round: 0,
      epRegen: epRegen,          // 每回合自动回 ep（0 = 关闭，保持 2 人 v1.0 口径）
      rng: rng || { next: function () { return Math.random(); } },
      p, actions,
      events: [],
      over: false, winner: null
    };
  }

  /* 存活对手列表（N人通用；2人=1个）。 */
  function opponentsOf(state, pid) {
    const out = [];
    for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) out.push(i);
    return out;
  }

  /* 技能默认目标：2人=另一个；N人=指定 target（非法则取第一个存活对手）。 */
  function resolveTarget(state, pid, key, opt) {
    const def = R.byKey[key];
    if (!def || def.target === 'self') return pid;
    const opp = opponentsOf(state, pid);
    if (!opp.length) return null;
    if (state.p.length === 2) return opp[0];
    const t = opt && opt.target;
    if (typeof t === 'number' && t !== pid && state.p[t] && state.p[t].hp > 0) return t;
    /* v1.5.138：兜底从 `opp[0]`（最小索引）改 saltPick —— v1.5.54 已在 oppOf/wrapBotN 等处
     * 明令禁止"恒定取最小对手"的座位偏置（D108 同族），这里是漏网的一处。
     * `saltPick` 单一真源在 resolve（避免两处公式漂移）；resolveTarget 只在**对局运行期**被调，
     * 那时 `EpirusResolve` 早已挂好（load 期不触达）。 */
    return global.EpirusResolve.saltPick(state, opp, 0);
  }

  function canUseSkillInMode(state, key) {
    return state.mode.skills.some(function (s) {
      return (typeof s === 'string' ? s : s.key) === key;
    });
  }

  /* 费用计算。ok=false = 条件不满足的“无效出招”（不贷款、不惩罚）。
   * 无限能量（回魂复活回合）：能量类花费全免。 */
  function computeCost(state, pid, key) {
    const p = state.p[pid];
    const def = R.byKey[key];
    if (!def) return { ok: false, reason: '未知技能' };
    if (!canUseSkillInMode(state, key)) return { ok: false, reason: '该模式不可用' };
    if (p.infiniteEnergy) return { ok: true, ep: 0, hp: 0, beads: null }; // R48
    if (key === R.SK.RING) {
      return { ok: true, ep: p.ringStreak === 0 ? 3 : 0, hp: 0, beads: null };
    }
    if (key === R.SK.CANNON) {
      const phase = (p.cannonCount % 3) + 1;
      if (phase === 1) return { ok: true, ep: 2, hp: 0, beads: null, cannonPhase: 1 };
      if (phase === 2) {
        if (p.ep < 1) return { ok: false, reason: '过载炮第2次需至少1ジ' }; // R55
        return { ok: true, ep: p.ep, hp: 0, beads: null, cannonPhase: 2 };
      }
      return { ok: true, ep: p.ep, hp: 1, beads: null, cannonPhase: 3 }; // R42 自损1血
    }
    if (key === R.SK.LASER_EYE) {
      const cont = p.lastSkill === R.SK.LASER_EYE; // R32
      if (cont) return { ok: true, ep: 2, hp: 0, beads: null };
      if (p.boom < 1) return { ok: false, reason: '首次激光眼需 1 枚爆破珠' };
      return { ok: true, ep: 1, hp: 0, beads: { boom: 1 } };
    }
    if (key === R.SK.RAILGUN) {
      if (p.elec < 1) return { ok: false, reason: '电磁炮需 1 枚电珠' };
      return { ok: true, ep: 2, hp: 0, beads: { elec: 1 } };
    }
    if (key === R.SK.DRAIN) {   // R25 + v1.4.0：门槛按模式可配（默认仍是 HP≤1）
      const dmax = (state.mode && state.mode.drainHpMax) || 1;
      if (p.hp > dmax) return { ok: false, reason: '摄魂指法仅限 HP≤' + dmax };
    }
    return { ok: true, ep: def.cost, hp: 0, beads: null };
  }

  /* 出招：扣费（血债），记录本回合行动。
   * opt: {bead:'elec'|'boom'}（蓄能时选择）
   * 返回 {skill, outcome:'ok'|'invalid'|'banned'|'insufficient'} */
  function attemptAction(state, pid, key, opt, emit) {
    const p = state.p[pid];
    const events = [];
    const ev2 = function (e) { events.push(e); if (state.events) state.events.push(e); if (emit) emit(e); };
    const def = R.byKey[key];
    const tg = def ? resolveTarget(state, pid, key, opt) : null;
    const tg2 = (opt && opt.target2 != null && opt.target2 !== pid && state.p[opt.target2]) ? opt.target2 : null;
    /* v1.5.19：把"这一手指向谁"留在**玩家对象上**（`state.actions` 每回合会被清空 ⇒ 决策时刻
     * 完全看不到上一回合谁打过谁，见 docs/PARAMS-PLAN.md §0 与 v7 的关系特征 T 块）。
     * 这是**公共信息**（真人局里手势指向谁大家都看得见），存进去不产生信息泄漏。
     * `lastSkill` 同理已经在玩家对象上；两者配对才是"(actor, skill, target)"三元组。 */
    p.lastTarget = tg;
    p.lastTarget2 = tg2;

    // N12：已淘汰玩家不能行动（防止死人出招 / 回能量）
    if (p.hp <= 0) return fail('invalid', '已淘汰（无法行动）');

    function fail(outcome, reason) {
      state.actions[pid] = { key, voided: true, outcome, target: tg, target2: tg2 };
      ev2({ type: 'action', pid, key, outcome, reason });
      return { skill: key, outcome, reason };
    }

    if (!def) return fail('invalid', '未知技能');
    if (!canUseSkillInMode(state, key)) return fail('invalid', '该模式不可用');
    // 禁用倒计时：强行使用 -1HP 且无效（§2.2-1 / R29）
    if ((p.cooldown[key] || 0) > 0) {
      p.hp -= 1;
      ev2({ type: 'damage', to: pid, amt: 1, reason: '禁用期间强行使用(' + def.name + ')', via: 'ban' });
      return fail('banned', '禁用中(-1HP)');
    }
    if (p.infiniteEnergy) {
      state.actions[pid] = { key, voided: false, outcome: 'ok', opt: opt || null, target: tg, target2: tg2 };
      ev2({ type: 'action', pid, key, outcome: 'ok', free: true });
      return { skill: key, outcome: 'ok' };
    }
    const cost = computeCost(state, pid, key);
    if (!cost.ok) return fail('invalid', cost.reason);
    // 资源不足 → 无法发动（电脑游戏口径：不再贷款、不扣血；技能直接作废）
    if (cost.ep > p.ep) {
      return fail('insufficient', 'ジ不足（需' + cost.ep + '，有' + p.ep + '）');
    }
    // 正常扣费
    p.ep -= cost.ep;
    if (cost.hp) {
      p.hp -= cost.hp;
      ev2({ type: 'damage', to: pid, amt: cost.hp, reason: '过载炮血债', via: 'cost' });
    }
    if (cost.beads) {
      if (cost.beads.elec) { p.elec -= 1; ev2({ type: 'bead', pid, kind: 'elec', delta: -1 }); }
      if (cost.beads.boom) { p.boom -= 1; ev2({ type: 'bead', pid, kind: 'boom', delta: -1 }); }
    }
    if (key === R.SK.CANNON) p.cannonCount++;            // R43 出招即计次
    if (key === R.SK.RING) p.ringStreak++;               // 连击计数（resolve 里 +1/+2/+3）
    state.actions[pid] = {
      key, voided: false, outcome: 'ok', opt: opt || null, target: tg, target2: tg2,
      phase: cost.cannonPhase || null
    };
    ev2({ type: 'action', pid, key, outcome: 'ok' });
    return { skill: key, outcome: 'ok' };
  }

  // 注意：JSON 序列化会丢掉 rng（函数），clone 后必须还原 rng，否则 P.choose 采样崩溃
  function cloneState(s) { const c = JSON.parse(JSON.stringify(s)); c.rng = s.rng; return c; }

  global.EpirusState = {
    createState, freshPlayer, attemptAction, computeCost, canUseSkillInMode, cloneState,
    opponentsOf, resolveTarget, defaultNames
  };
})(typeof window !== 'undefined' ? window : globalThis);
