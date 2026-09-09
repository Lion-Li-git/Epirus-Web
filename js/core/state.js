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
      elec: 0, boom: 0,             // 能量珠 R9'（只供下一回合，回合末未用即清空）
      beadNew: null,                // 本回合蓄能新得的珠类型（endTurn 据此决定谁过期）
      ringStreak: 0,                // 聚能环连击 R10
      cannonCount: 0,               // 过载炮次数 R42
      guardStreak: 0,               // 防御连击（快速模式上限 2）R52
      cooldown: {},                 // 大雷禁用 R29
      rodGuard: 0,                  // 避雷针情形B（剩余免雷次数）R31
      mineArmed: false,             // R38
      guardNext: false, baguaExtra: false,  // 无极变速第二回合 R21
      fireWeakNext: false, fireWeakNow: false, // 藤甲 R22
      tauntPending: false, tauntActive: false, // 挑衅 R41/R54
      nightmare: false,             // R50
      chainLink: false,             // R45
      vampire: false, vampHeal: 0,  // R47
      reviveNext: false, infiniteEnergy: false, // 回魂 R48
      stickers: []                  // 贴在自己身上的符咒 [{owner,age}] R34/R44
    };
  }

  function createState(modeKey, rng) {
    const mode = R.MODES[modeKey] || R.MODES[R.MODE_DEFAULT];
    return {
      modeKey, mode,
      round: 0,
      rng: rng || { next: function () { return Math.random(); } },
      p: [freshPlayer(0, '你', mode.hp), freshPlayer(1, '电脑', mode.hp)],
      actions: [null, null],
      events: [],
      over: false, winner: null
    };
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
    if (key === R.SK.DRAIN && p.hp > 1) return { ok: false, reason: '摄魂指法仅限 HP≤1' }; // R25
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

    function fail(outcome, reason) {
      state.actions[pid] = { key, voided: true, outcome };
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
    // 快速模式：防御不能连续 3 次（最多连续 2 次）R52
    if (state.modeKey === 'fast' && key === R.SK.GUARD && p.guardStreak >= 2) {
      return fail('invalid', '防御已连续2次');
    }
    if (p.infiniteEnergy) {
      state.actions[pid] = { key, voided: false, outcome: 'ok', opt: opt || null };
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
      key, voided: false, outcome: 'ok', opt: opt || null,
      phase: cost.cannonPhase || null
    };
    ev2({ type: 'action', pid, key, outcome: 'ok' });
    return { skill: key, outcome: 'ok' };
  }

  // 注意：JSON 序列化会丢掉 rng（函数），clone 后必须还原 rng，否则 P.choose 采样崩溃
  function cloneState(s) { const c = JSON.parse(JSON.stringify(s)); c.rng = s.rng; return c; }

  global.EpirusState = {
    createState, freshPlayer, attemptAction, computeCost, canUseSkillInMode, cloneState
  };
})(typeof window !== 'undefined' ? window : globalThis);
