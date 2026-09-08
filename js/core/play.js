/* Epirus — 对局驱动：自动对局循环 + 合法出招查询（供 AI/训练/自测共用） */
(function (global) {
  'use strict';
  const R = global.EpirusRules;
  const S = global.EpirusState;
  const X = global.EpirusResolve;

  /* 合法出招（对 AI 可见）：排除模式白名单外/禁用中/条件不满足者；标注是否可负担 */
  function legalActions(state, pid) {
    const p = state.p[pid];
    const out = [];
    for (const s of R.AVAILABLE_2P) {
      if (!S.canUseSkillInMode(state, s.key)) continue;
      if ((p.cooldown[s.key] || 0) > 0) continue;                 // 禁用中（AI 不会硬闯）
      if (state.modeKey === 'fast' && s.key === R.SK.GUARD && p.guardStreak >= 2) continue;
      if (p.infiniteEnergy) { out.push({ key: s.key, affordable: true, loan: 0 }); continue; }
      const cost = S.computeCost(state, pid, s.key);
      if (!cost.ok) continue;                                     // 条件不满足
      const loan = Math.max(0, cost.ep - p.ep);
      out.push({ key: s.key, affordable: loan === 0, loan });
    }
    return out;
  }

  /* 自动对局：chooser[pid](state, pid, legal) → key。onTurn 可选回调。 */
  function autoGame(state, chooser0, chooser1, onTurn) {
    let guardN = 0;
    while (!state.over) {
      X.startTurn(state);
      if (state.over) break;
      // 与页面同口径：双方都基于"行动前状态"决策（先手落子不影响后手看到的信息），再一起提交。
      // 旧实现是"先手已落子再问后手"，会让训练/评测数字与实战产生系统性偏差。
      // 兜底：任何脚本/AI 返回了买不起或不合法（条件不满足/禁用）的招 → 一律改按ジ。
      // 否则会"空放"→ outcome!=ok → endTurn 把 lastSkill 置 null，把对手打进未训练区。
      const sanitize = function (k, legal, chooser) {
        if (chooser && chooser.whiffOk) return k;    // 空放型训练对手：故意空放，用来训练 lastSkill=null 这一状态
        const l = legal.find(function (x) { return x.key === k; });
        return (l && l.affordable) ? k : R.SK.JI;
      };
      const beadOf = function (p) { return p.elec > p.boom ? 'boom' : 'elec'; };   // 相等时取电珠，与页面同口径
      const l0 = legalActions(state, 0), l1 = legalActions(state, 1);
      const k0 = sanitize(chooser0(state, 0, l0, state.events), l0, chooser0);
      const k1 = sanitize(chooser1(state, 1, l1, state.events), l1, chooser1);
      for (let pid = 0; pid < 2; pid++) {
        S.attemptAction(state, pid, pid === 0 ? k0 : k1, { bead: beadOf(state.p[pid]) });
      }
      X.resolveActions(state);
      X.endTurn(state);
      if (onTurn) onTurn(state);
      if (++guardN > 5000) throw new Error('autoGame loop guard');
    }
    return state.winner;
  }

  global.EpirusPlay = { autoGame, legalActions };
})(typeof window !== 'undefined' ? window : globalThis);
