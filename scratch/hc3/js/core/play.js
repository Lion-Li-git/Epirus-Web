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
    for (const e of state.mode.skills) {
      const s = (typeof e === 'string') ? R.byKey[e] : e;
      if (!s) continue;
      if (!S.canUseSkillInMode(state, s.key)) continue;
      if ((p.cooldown[s.key] || 0) > 0) continue;                 // 禁用中（AI 不会硬闯）
      /* v1.5.166（R48 第三处短路）：这里原先 `if (p.infiniteEnergy) push(affordable:true)` 直接跳过
       * `computeCost` ⇒ 免费回合把"条件不满足"的技能也列进合法表（页面按钮因此可点、AI 因此看得见它）。
       * 现在交给 `computeCost` 判条件（它已改成"只免花费、不免条件"），这里不再短路。 */
      const cost = S.computeCost(state, pid, s.key);
      if (!cost.ok) continue;                                     // 条件不满足
      const loan = Math.max(0, cost.ep - p.ep);
      out.push({ key: s.key, affordable: loan === 0, loan, free: !!cost.free });
    }
    return out;
  }

  /* chooser 返回值规范化：'GUN' 或 {key, target, target2, bead} */
  function normPick(res) {
    if (typeof res === 'string') return { key: res, target: null, target2: null, bead: null };
    if (res && res.key) return {
      key: res.key,
      target: (res.target != null ? res.target : null),
      target2: (res.target2 != null ? res.target2 : null),
      /* v7：`bead` = 蓄能要蓄哪种珠（'elec'|'boom'）。由策略候选给出（见 policy.js 的 candidatesFor）；
       * 脚本/UI 不传 ⇒ 走下面的启发式兜底，行为与旧版一字不变。 */
      bead: (res.bead === 'elec' || res.bead === 'boom') ? res.bead : null
    };
    return { key: null, target: null, target2: null, bead: null };
  }

  /* N 人自动对局：choosers[pid](state, pid, legal, events) → key | {key,target} */
  function autoGameN(state, choosers, onTurn, onRoundStart) {
    const N = state.p.length;
    let guardN = 0;
    while (!state.over) {
      X.startTurn(state);
      if (state.over) break;
      /* v1.4.5：回合开始钩子 —— 必须在 legalActions **之前**。
       * 珠类技能的门（电磁炮需电珠 / 激光眼需爆珠）在 computeCost 里判，而 legal 是下面
       * 第 50 行算出来的 ⇒ 任何"在 chooser 里补珠"的做法都太晚（实测强制命中 0%）。
       * 要公平测量这类技能，只能在 legal 之前开珠。默认 undefined，对线上/训练零影响。 */
      if (onRoundStart) onRoundStart(state);
      const beadOf = function (p) { return p.elec > p.boom ? 'boom' : 'elec'; };   // 相等时取电珠，与页面同口径
      const picks = [];
      for (let pid = 0; pid < N; pid++) {
        if (state.p[pid].hp <= 0) { picks.push(null); continue; }   // N12：死者不行动
        const ch = choosers[pid];
        const legal = legalActions(state, pid);
        const raw = normPick(ch ? ch(state, pid, legal, state.events) : null);
        const l = legal.find(function (x) { return x.key === raw.key; });
        const k = (ch && ch.whiffOk) ? raw.key : ((l && l.affordable) ? raw.key : R.SK.JI);
        picks.push({ key: k, target: raw.target, target2: raw.target2, bead: raw.bead });
      }
      for (let pid = 0; pid < N; pid++) {
        if (!picks[pid]) continue;
        /* v7：候选给了 bead 就用它（"为放电而蓄电珠"要能学会）；没给才走启发式兜底。 */
        S.attemptAction(state, pid, picks[pid].key, {
          bead: picks[pid].bead || beadOf(state.p[pid]),
          target: picks[pid].target, target2: picks[pid].target2
        });
      }
      X.resolveActions(state);
      X.endTurn(state);
      if (onTurn) onTurn(state);
      if (++guardN > 5000) throw new Error('autoGame loop guard');
    }
    return state.winner;
  }

  /* 2 人兼容入口：autoGame(state, c0, c1, onTurn) 或 autoGame(state, [c0..cN], onTurn) */
  function autoGame(state, chooser0, chooser1, onTurn) {
    if (Array.isArray(chooser0)) return autoGameN(state, chooser0, chooser1);
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
      /* v7：2P 也接受 chooser 返回对象（{key,bead}）—— 否则 2P 永远学不会"为放电而蓄电珠"。
       * 返回字符串时行为与旧版一字不变（bead 走启发式、target 为 null）。 */
      const r0 = normPick(chooser0(state, 0, l0, state.events));
      const r1 = normPick(chooser1(state, 1, l1, state.events));
      const k0 = sanitize(r0.key, l0, chooser0);
      const k1 = sanitize(r1.key, l1, chooser1);
      for (let pid = 0; pid < 2; pid++) {
        const raw = pid === 0 ? r0 : r1;
        S.attemptAction(state, pid, pid === 0 ? k0 : k1, {
          bead: raw.bead || beadOf(state.p[pid]), target: raw.target, target2: raw.target2
        });
      }
      X.resolveActions(state);
      X.endTurn(state);
      if (onTurn) onTurn(state);
      if (++guardN > 5000) throw new Error('autoGame loop guard');
    }
    return state.winner;
  }

  global.EpirusPlay = { autoGame, autoGameN, legalActions, normPick };
})(typeof window !== 'undefined' ? window : globalThis);
