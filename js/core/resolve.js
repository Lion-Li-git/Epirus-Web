/* Epirus — 回合结算引擎（修正版）
 * 语义裁定见 docs/RULES-2P.md（R1..R55 + 子证 R23'/R34'/R19'），与本文件逐条对应。
 * 回合驱动（UI/AI）：
 *   startTurn(state) → 双方 attemptAction() → resolveActions(state) → endTurn(state)
 * resolveActions 内部顺序（文档 §1.3 管线）：
 *   避雷针 → 小雷(pri5) → 大雷(pri4) → 攻击相抵/默认(pri3) → 枪(pri2) → 狙击/净化(pri1) → 地雷联动已内联
 */
(function (global) {
  'use strict';
  const R = global.EpirusRules;
  const SK = R.SK;

  const ev = function (state, e) { state.events.push(e); };

  function actionOf(state, pid) {
    const a = state.actions[pid];
    return a && !a.voided ? a : null;
  }
  function setVoid(state, pid, by) {
    if (state.actions[pid] && !state.actions[pid].voided) {
      state.actions[pid].voided = true;
      ev(state, { type: 'voided', pid, by });
    }
  }

  /* ---------- N 人通用：人数/目标 ---------- */
  function playerCount(state) { return state.p.length; }
  function aliveOpps(state, pid) {
    const out = [];
    for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) out.push(i);
    return out;
  }
  /* 该玩家本回合行动的目标（self 类技能=null） */
  function targetOf(state, pid) {
    const a = state.actions[pid];
    if (!a) return null;
    const t = a.target;
    if (t != null && t !== pid && state.p[t]) return t;
    return null;
  }
  /* 对手目标：优先行动目标，否则第一个存活对手（self 类技能用于"贴在对手身上"的效果） */
  function oppOf(state, pid) {
    const t = targetOf(state, pid);
    if (t != null) return t;
    const o = aliveOpps(state, pid);
    return o.length ? o[0] : null;
  }

  /* ---------- 判定 ---------- */
  function judge(state) { return state.rng.next() < 0.5; }
  function judge3(state) { return judge(state) && judge(state) && judge(state); } // p=1/8 爆头

  /* ---------- 回合启动副作用 ---------- */
  function startTurn(state) {
    state.round += 1;
    for (let i = 0; i < state.p.length; i++) state.actions[i] = null;   // N12：每回合重置行动槽
    if (checkOver(state)) return;
    for (let i = 0; i < playerCount(state); i++) {
      const p = state.p[i];
      if (p.nightmare && p.hp > 0) {          // R50
        p.hp -= 0.5;
        ev(state, { type: 'damage', to: i, amt: 0.5, reason: '梦魇', via: 'dream' });
      }
      if (p.reviveNext) {                      // R48 回魂复活
        p.reviveNext = false;
        p.hp = 1;
        p.infiniteEnergy = true;
        ev(state, { type: 'revive', pid: i });
      }
      p.baguaExtra = !!p.guardNext; p.guardNext = false; // R21
      p.fireWeakNow = !!p.fireWeakNext; p.fireWeakNext = false; // R22
    }
    checkOver(state);
  }

  /* 当前生效防御架势 */
  function guardOf(state, pid) {
    const a = actionOf(state, pid);
    if (a) {
      switch (a.key) {
        case SK.GUARD: return { kind: 'guard' };
        case SK.REFLECT: return { kind: 'reflect' };
        case SK.ARMOR: return { kind: 'armor' };
        case SK.JINSHIELD: return { kind: 'jinshield' };
        case SK.BAGUA: case SK.SHIFT: return { kind: 'bagua' };
        case SK.PROTO: case SK.HOLO: return { kind: 'proto' }; // 全息屏障=原型制御 R18
        default: break;
      }
    }
    // 无极变速第二回合：本回合自己若没有"防御类"行动，则无极变速的八卦阵仍应生效（R21/R7）
    if (state.p[pid].baguaExtra) {
      const ownGuard = a && R.GUARD_FAMILY.indexOf(a.key) >= 0;
      if (!ownGuard) return { kind: 'bagua', extra: true };
    }
    return null;
  }

  /* 直扣血（绕过架势：贷款/禁用/过载血债/净化/天火等）；铁索共享 R45 */
  function rawDamage(state, to, amt, reason, via, opts) {
    opts = opts || {};
    const p = state.p[to];
    if (p.hp <= 0) return false;
    let hit = amt;
    // 藤甲火弱：一切火焰伤害+1（坦克/天火/地雷等，R22）
    if ((opts.type === R.DMG.FIRE || opts.type === R.DMG.FIRELIGHT) && p.fireWeakNow) hit += 1;  // N18 藤甲
    if ((opts.type === R.DMG.LIGHT || opts.type === R.DMG.FIRELIGHT) && p.vampire) hit += 1;      // R47/N18 吸血鬼
    p.hp -= hit;
    ev(state, { type: 'damage', to, amt: hit, reason, via: via || reason });
    if (opts.chain !== false && p.chains && p.chains.length && !opts.fromChain) {
      for (const other of p.chains) {          // N8：铁索图不递归
        const op = state.p[other];
        if (op && op.hp > 0) {
          op.hp -= hit;
          ev(state, { type: 'damage', to: other, amt: hit, reason: '铁索连环', via: 'chain', fromChain: true });
        }
      }
    }
    return true;
  }

  /* 大雷禁用（直击与连带共用）：只禁“当前使用的那个技能”（R29） */
  const BIG_T_EXEMPT = [SK.GUARD, SK.REFLECT, SK.JINSHIELD, SK.JI];
  function bigTBan(state, pid, usedKey) {
    if (usedKey && R.MULTI_ONLY.indexOf(usedKey) < 0 && BIG_T_EXEMPT.indexOf(usedKey) < 0) {
      state.p[pid].cooldown[usedKey] = Math.max(state.p[pid].cooldown[usedKey] || 0, 4);
    }
    ev(state, { type: 'ban', pid: pid, by: SK.BIG_T, turns: 3, skill: usedKey });
  }

  /* 可触发地雷的伤害来源；狙击豁免 R38 */
  const MINE_TRIGGER = [SK.GUN, SK.SWORD, SK.TANK, SK.DRAIN, SK.RAILGUN, SK.BIG_T, SK.LASER_EYE, SK.CANNON];

  /* 地雷连锁（至多2次）R38/R39 —— 反击绕过一切架势 */
  function mineChain(state, attacker, victim, depth) {
    const atkP = state.p[attacker];
    const vicP = state.p[victim];
    ev(state, { type: 'mine', from: victim, to: attacker, depth });
    if (atkP.hp > 0) {
      let mAmt = 1;
      if (atkP.fireWeakNow) mAmt += 1;   // 藤甲火弱：地雷火伤+1（R22）
      atkP.hp -= mAmt;
      ev(state, { type: 'damage', to: attacker, amt: mAmt, reason: '地雷反击', via: 'mine' });
    }
    vicP.mineArmed = false;
    if (depth < 2 && atkP.mineArmed && atkP.hp > 0) {
      atkP.mineArmed = false;
      mineChain(state, victim, attacker, depth + 1);
    }
  }

  /* 完整伤害结算：转移 → 架势矩阵 → 落点（火弱点/吸血鬼光伤/地雷）R15 */
  function deliverDamage(state, dmg, to, ctx) {
    ctx = ctx || {};
    const target = state.p[to];
    if (target.hp <= 0) return { result: 'miss' };
    const pierce = dmg.pierce || {};
    const via = dmg.via;

    // ---- 转移伤害拦截（坦克不可转移）----
    const tAct = actionOf(state, to);
    if (!dmg.bypassGuards && !pierce.transfer && tAct && tAct.key === SK.TRANSFER) {
      const src = dmg.source;
      if (src != null && src !== to && state.p[src].hp > 0) {
        ev(state, { type: 'transfer', to, from: src, amt: dmg.amt, via });
        const redir = Object.assign({}, dmg, { source: src, redirected: true, noMine: true });
        deliverDamage(state, redir, src, { reason: ctx.reason });
        return { result: 'redirected', to: src };
      }
    }

    // ---- 防御架势矩阵 ----
    const guard = dmg.bypassGuards ? null : guardOf(state, to);
    if (guard) {
      const g = guard.kind;
      if (g === 'proto') {
        // 原型制御：阻挡除 地雷/转移 外一切技能伤害（含坦克/狙击/大雷）R23/R24
        if (via === 'mine' || dmg.redirected) { /* 不挡 */ }
        else { ev(state, { type: 'blocked', to, by: '原型制御', amt: dmg.amt, via }); return { result: 'blocked' }; }
      } else if (g === 'guard') {
        if (!pierce.defense) { ev(state, { type: 'blocked', to, by: '防御', amt: dmg.amt, via }); return { result: 'blocked' }; }
      } else if (g === 'reflect' || g === 'armor') {
        if (!pierce.reflect) {
          if (R.REFLECTABLE.indexOf(via) >= 0 && dmg.source != null && dmg.source !== to && !dmg.reflected) {
            ev(state, { type: 'reflect', to, from: dmg.source, amt: dmg.amt, via, by: g });
            deliverDamage(state, Object.assign({}, dmg, { source: to, reflected: true, noMine: true }), dmg.source, { reason: ctx.reason });
            return { result: 'reflected' };
          }
          ev(state, { type: 'blocked', to, by: g === 'armor' ? '藤甲' : '反弹', amt: dmg.amt, via });
          return { result: 'blocked' };
        }
      } else if (g === 'bagua') {
        if (judge(state)) { ev(state, { type: 'blocked', to, by: '八卦阵', amt: dmg.amt, via, judge: true }); return { result: 'blocked' }; }
      } else if (g === 'jinshield') {
        if (!pierce.defense) {
          if (judge(state)) {
            const src = dmg.source;
            if (src != null && src !== to && state.p[src].hp > 0) {
              state.p[src].hp -= 1;
              ev(state, { type: 'damage', to: src, amt: 1, reason: '金刚盾反击', via: 'counter' });
            }
          }
          ev(state, { type: 'blocked', to, by: '金刚盾', amt: dmg.amt, via });
          return { result: 'blocked' };
        }
      }
    }

    // ---- 落点 ----
    // R47/N18：吸血鬼光伤 +1 与藤甲火伤 +1 统一在 rawDamage 处理
    const amt = dmg.amt;
    rawDamage(state, to, dmg.amt, ctx.reason || via || '', via, { fromChain: dmg.fromChain, type: dmg.type });
    // 地雷联动（直接攻击动作伤害落地才触发；反弹/转移/天火等不触发）
    if (!dmg.noMine && !dmg.fromChain && !dmg.reflected && dmg.source != null && dmg.source !== to) {
      if (via !== SK.SNIPE && MINE_TRIGGER.indexOf(via) >= 0 && target.mineArmed) {
        mineChain(state, dmg.source, to, 1);
      }
    }
    return { result: 'land', amt };
  }

  /* 攻击相抵/阻止（优先级原则 R3）：同优先级攻击抵消，高优先级攻击阻止低优先级攻击 */
  function clashPass(state) {
    const atkIdx = [];
    for (let i = 0; i < playerCount(state); i++) {
      const a = actionOf(state, i);
      if (a && R.ATK_EFFECT.indexOf(a.key) >= 0) atkIdx.push(i);
    }
    if (atkIdx.length < 2) return;
    // N 人：两两结算（同优先级相抵、高优先级阻止低优先级）
    for (let x = 0; x < atkIdx.length; x++) {
      for (let y = x + 1; y < atkIdx.length; y++) {
        const ia = atkIdx[x], ib = atkIdx[y];
        const a = actionOf(state, ia), b = actionOf(state, ib);
        if (!a || !b) continue;
        if (a.key === SK.DRAIN && b.key === SK.DRAIN) continue; // 互勾触发铁索，不抵消
        // N4：**只有互为目标**的攻击才会交锋（2 人时天然成立）。
        // 两家同时打第三人 ≠ 互为目标，不应相抵/阻止。
        if (targetOf(state, ia) !== ib || targetOf(state, ib) !== ia) continue;
        const pa = R.byKey[a.key].pri || 3, pb = R.byKey[b.key].pri || 3;
        if (pa === pb) {
          ev(state, { type: 'cancel', pids: [ia, ib], round: state.round });
          setVoid(state, ia, '相抵'); setVoid(state, ib, '相抵');
        } else if (pa > pb) {
          ev(state, { type: 'clash', winner: ia, loser: ib });
          setVoid(state, ib, '被高优先级攻击阻止');
        } else {
          ev(state, { type: 'clash', winner: ib, loser: ia });
          setVoid(state, ia, '被高优先级攻击阻止');
        }
      }
    }
  }

  /* ---------- N14 镜面反射 / N15 反复横跳 / N16 聚光炮 ---------- */
  /* 可被复制的“伤害效果”：架势/自增益/能量类/状态类返回 null */
  function copyEffect(key) {
    const def = R.byKey[key];
    if (!def) return null;
    if (key === SK.DUAL_GUN) return { amt: 1, type: R.DMG.NORMAL, pierce: {}, via: SK.GUN };  // 原文：只算一枪
    if (key === SK.LASER_EYE) return { amt: 1, type: R.DMG.LIGHT, pierce: {}, via: SK.LASER_EYE };
    if (key === SK.CANNON) return { amt: 1, type: R.DMG.NORMAL, pierce: {}, via: SK.CANNON };
    if (def.dmg && def.dmg.amt) return { amt: def.dmg.amt, type: def.dmg.type, pierce: def.pierce || {}, via: key };
    return null;
  }

  /* 有向图是否存在环（反复横跳触发判定） */
  function hasCycle(edges) {
    const adj = {};
    for (const e of edges) (adj[e[0]] = adj[e[0]] || []).push(e[1]);
    const color = {};
    let found = false;
    function dfs(u) {
      color[u] = 1;
      const nxt = adj[u] || [];
      for (const v of nxt) {
        if (color[v] === 1) { found = true; return; }
        if (!color[v]) { dfs(v); if (found) return; }
      }
      color[u] = 2;
    }
    for (const k in adj) { if (!color[k]) { dfs(+k); if (found) break; } }
    return found;
  }

  function mirrorPass(state) {
    const mirrors = [];
    for (let i = 0; i < playerCount(state); i++) {
      const a = actionOf(state, i);
      if (a && a.key === SK.MIRROR) mirrors.push(i);
    }
    if (!mirrors.length) return;
    const info = {};
    for (const m of mirrors) {
      const a = actionOf(state, m);
      const opps = aliveOpps(state, m);
      let t1 = a.target, t2 = a.target2;
      if (t1 == null || t1 === m || !state.p[t1] || state.p[t1].hp <= 0) t1 = opps.length ? opps[0] : null;
      if (t2 == null || t2 === m || t2 === t1 || !state.p[t2] || state.p[t2].hp <= 0) {
        t2 = null;
        for (const o of opps) { if (o !== t1) { t2 = o; break; } }
      }
      info[m] = { t1, t2 };
      if (t1 == null || t2 == null) setVoid(state, m, '镜面反射无目标');
    }
    // ---- N16 聚光炮 ----
    const usedEdge = {};
    for (let x = 0; x < mirrors.length; x++) {
      for (let y = x + 1; y < mirrors.length; y++) {
        const A = mirrors[x], B = mirrors[y];
        const iA = info[A], iB = info[B];
        if (!iA || !iB || iA.t1 == null || iB.t1 == null || iA.t2 == null) continue;
        if (iA.t1 === B && iB.t1 === A && iA.t2 === iB.t2) {
          ev(state, { type: 'hidden', name: '聚光炮', pid: A, to: iA.t2 });
          rawDamage(state, iA.t2, 1, '聚光炮', 'focusCannon', { type: R.DMG.FIRELIGHT });
          usedEdge[A] = true; usedEdge[B] = true;
        }
      }
    }
    // ---- N15 反复横跳 ----
    const edges = [];
    const freeUsers = [];
    for (const m of mirrors) {
      if (usedEdge[m]) continue;
      const it = info[m];
      if (it && it.t1 != null && it.t2 != null) { edges.push([it.t1, it.t2]); freeUsers.push(m); }
    }
    if (edges.length >= 2 && hasCycle(edges)) {
      ev(state, { type: 'hidden', name: '反复横跳', pids: freeUsers.slice() });
      for (const u of freeUsers) rawDamage(state, u, 1, '反复横跳', 'hop', { type: R.DMG.FIRELIGHT });
    }
    // ---- N14 复制伤害 ----
    for (const m of mirrors) {
      const a = actionOf(state, m);
      if (!a) continue;
      const it = info[m];
      if (!it || it.t1 == null || it.t2 == null) continue;
      const ta = actionOf(state, it.t1);
      if (!ta) { ev(state, { type: 'mirrorNoEffect', pid: m, from: it.t1 }); continue; }
      const eff = copyEffect(ta.key);
      if (!eff) { ev(state, { type: 'mirrorNoEffect', pid: m, from: it.t1, key: ta.key }); continue; }
      ev(state, { type: 'mirror', pid: m, from: it.t1, to: it.t2, key: ta.key });
      deliverDamage(state, {
        amt: eff.amt, type: eff.type, source: m, via: eff.via, pierce: eff.pierce || {}
      }, it.t2, { reason: '镜面反射·' + R.byKey[ta.key].name });
    }
  }

  /* ---------- 回合中结算 ---------- */
  const roundTaunts = [];

  function resolveActions(state) {
    roundTaunts.length = 0;
    // ====== ① 避雷针 R31 ======
    const rodUsers = [];
    for (let i = 0; i < playerCount(state); i++) { const a = actionOf(state, i); if (a && a.key === SK.ROD) rodUsers.push(i); }
    if (rodUsers.length) {
      const lightning = [];
      for (let i = 0; i < playerCount(state); i++) { const a = actionOf(state, i); if (a && R.LIGHTNING.indexOf(a.key) >= 0) lightning.push(i); }
      if (lightning.length) {
        ev(state, { type: 'rod', pids: rodUsers, mode: 'A', voided: lightning });
        for (const l of lightning) {
          setVoid(state, l, '避雷针');
          rawDamage(state, l, 1, '避雷针反噬', 'rod', { chain: false, noMine: true });
          const cost = R.byKey[state.actions[l].key].cost || 0;
          for (const r of rodUsers) state.p[r].ep += cost;
        }
      } else {
        ev(state, { type: 'rod', pids: rodUsers, mode: 'B' });
        for (const r of rodUsers) state.p[r].rodGuard = 4; // 命中回合 endTurn 会递减，基4=窗口3回合
      }
    }

    // ====== ② 小雷 pri5 R27 ======
    const mini = [];
    for (let i = 0; i < playerCount(state); i++) { const a = actionOf(state, i); if (a && a.key === SK.MINI_T) mini.push(i); }
    for (const c of mini) {
      if (!actionOf(state, c)) continue;                 // 已被更早规则作废
      const t = targetOf(state, c);
      if (t == null) continue;
      const ta = actionOf(state, t);
      // 互雷成环（N3：逐边判定）
      if (ta && ta.key === SK.MINI_T && targetOf(state, t) === c) {
        if (c < t) ev(state, { type: 'thunderRing' });
        setVoid(state, c, '互雷成环'); setVoid(state, t, '互雷成环');
        continue;
      }
      if (state.p[t].rodGuard > 0) {
        state.p[t].rodGuard = 0; // 一次免雷后守卫结束 R31
        setVoid(state, c, '避雷针');
        ev(state, { type: 'rodBlock', pid: t, by: SK.MINI_T });
      } else if (ta && R.MINI_T_IMMUNE.indexOf(ta.key) >= 0) {
        ev(state, { type: 'voidImmune', pid: t, by: SK.MINI_T, key: ta.key });
      } else {
        setVoid(state, t, SK.MINI_T);
        ev(state, { type: 'voidedBy', pid: t, by: SK.MINI_T });
      }
    }
    // N17 合二为一：>=2 人同时对同一目标用小雷 → 目标额外 1 点电伤
    const miniByTarget = {};
    for (const c of mini) {
      if (!actionOf(state, c)) continue;
      const t = targetOf(state, c);
      if (t != null) (miniByTarget[t] = miniByTarget[t] || []).push(c);
    }
    for (const tk in miniByTarget) {
      if (miniByTarget[tk].length >= 2) {
        ev(state, { type: 'hidden', name: '合二为一', pids: miniByTarget[tk].slice(), to: +tk });
        rawDamage(state, +tk, 1, '合二为一', 'unite', { type: R.DMG.ELECTRIC });
      }
    }

    // ====== ③ 大雷 pri4 R28/R29 ======
    const bigs = [];
    for (let i = 0; i < playerCount(state); i++) { const a = actionOf(state, i); if (a && a.key === SK.BIG_T) bigs.push(i); }
    for (const c of bigs) {
      if (!actionOf(state, c)) continue;
      const t = targetOf(state, c);
      if (t == null) continue;
      const tb0 = actionOf(state, t);
      const bothBig = !!(tb0 && tb0.key === SK.BIG_T && targetOf(state, t) === c); // 互轰
      if (state.p[t].rodGuard > 0) {
        state.p[t].rodGuard = 0;
        setVoid(state, c, '避雷针');
        ev(state, { type: 'rodBlock', pid: t, by: SK.BIG_T });
        continue;
      }
      const ta = actionOf(state, t);
      // 效果2：非防御类技能一律无效化；双大雷互轰时各自保留
      if (!bothBig && ta && R.GUARD_FAMILY.indexOf(ta.key) < 0) {
        setVoid(state, t, SK.BIG_T);
      }
      // 记录目标当面架势（用于 R23'：原型制御挡电但不免疫禁用）
      const guardKind = (guardOf(state, t) || {}).kind;
      // 2电伤害（反弹/藤甲架势对雷无效——pierce.reflect；防御/金刚盾/原型制御可挡）
      const res = deliverDamage(state, {
        amt: 2, type: R.DMG.ELECTRIC, source: c, via: SK.BIG_T, pierce: { reflect: true }
      }, t, { reason: '真正的落雷' });
      // N6 连带伤害（原文效果3）：与目标 T 产生交互的第三方 各受 1 点电伤；
      //   其中「对 T 使用技能」者额外被无效化（对 T 的那个技能）；施法者自身不参与。
      //   2 人时第三方不存在 → 行为不变（回归安全）。
      const tTgt = targetOf(state, t);
      for (let q = 0; q < playerCount(state); q++) {
        if (q === c || q === t || state.p[q].hp <= 0) continue;
        const qa = actionOf(state, q);
        const qTargetsT = !!qa && targetOf(state, q) === t;
        const tTargetsQ = !!ta && tTgt === q;
        if (!qTargetsT && !tTargetsQ) continue;
        // 连带口径：同样 2 点电伤 + 行动作废 + 该技能禁用 3 回合（与直击同口径）
        const qUsed = qa ? qa.key : null;
        setVoid(state, q, '真正的落雷连带');
        ev(state, { type: 'bigTChain', from: c, to: q, kind: qTargetsT ? 'attack' : 'targeted' });
        const qres = deliverDamage(state, {
          amt: 2, type: R.DMG.ELECTRIC, source: c, via: SK.BIG_T, pierce: { reflect: true }
        }, q, { reason: '真正的落雷·连带' });
        if (qres.result === 'land' || qres.result === 'blocked') {
          const qGuard = (guardOf(state, q) || {}).kind;
          if (qres.result === 'land' || qGuard === 'proto') bigTBan(state, q, qUsed);
        }
      }
      // R23'：只要大雷成功结算（命中 或 目标用原型制御抵挡），3 回合禁用即生效
      const banApplies = res.result === 'land' || guardKind === 'proto' || guardKind === 'hologram';
      if (banApplies) {
        // R29 修正：只禁用"目标本回合正在使用的那个技能"（不是全部技能）
        const used = ta ? ta.key : null;
        bigTBan(state, t, used);
      }
    }

    // ====== 攻击相抵/阻止（跨层统一）======
    clashPass(state);

    // ====== ④ 默认优先级 3 ======
    for (let i = 0; i < playerCount(state); i++) {
      const a = actionOf(state, i);
      if (!a || (R.byKey[a.key].pri || 3) !== 3) continue;
      const t = oppOf(state, i);
      if (t == null) continue;
      const me = state.p[i], you = state.p[t];
      switch (a.key) {
        case SK.JI: me.ep += 1; ev(state, { type: 'ep', pid: i, delta: 1 }); break;
        case SK.CHARGE: {
          const kind = (a.opt && a.opt.bead) || 'elec';
          me[kind] = 1; me.beadNew = kind;   // R9'：同回合重复蓄能只刷新不叠加
          ev(state, { type: 'bead', pid: i, kind, delta: 1 }); break;
        }
        case SK.RING: {
          const g = me.ringStreak >= 3 ? 3 : me.ringStreak; // attempt 时已 +1
          me.ep += g; ev(state, { type: 'ep', pid: i, delta: g }); break;
        }
        case SK.MINE: me.mineArmed = true; ev(state, { type: 'mineArm', pid: i }); break;
        case SK.DRAIN: {
          const res = deliverDamage(state, { amt: 1, type: R.DMG.NORMAL, source: i, via: SK.DRAIN }, t, { reason: '摄魂指法' });
          if (res.result === 'land') {
            const heal = me.vampire ? 2 : 1;                 // R47
            me.hp += heal; me.vampHeal += heal;
            if (!me.vampire && me.vampHeal >= 3) { me.vampire = true; ev(state, { type: 'vampire', pid: i }); }
            ev(state, { type: 'heal', pid: i, amt: heal, reason: '摄魂' });
          }
          break;
        }
        case SK.DUAL_GUN: {                    // N3 双枪射手：对两个目标各 1 点（按枪口径，可被反弹/地雷）
          const t2 = (a.target2 != null && state.p[a.target2] && state.p[a.target2].hp > 0) ? a.target2 : null;
          deliverDamage(state, { amt: 1, type: R.DMG.NORMAL, source: i, via: SK.GUN }, t, { reason: '双枪射手' });
          if (t2 != null && t2 !== t) {
            deliverDamage(state, { amt: 1, type: R.DMG.NORMAL, source: i, via: SK.GUN }, t2, { reason: '双枪射手' });
          }
          break;
        }
        case SK.SWORD:
        case SK.TANK: {
          const def = R.byKey[a.key];
          deliverDamage(state, {
            amt: def.dmg.amt, type: def.dmg.type, source: i, via: a.key, pierce: def.pierce
          }, t, { reason: def.name });
          break;
        }
        case SK.RAILGUN: {
          deliverDamage(state, { amt: 2, type: R.DMG.ELECTRIC, source: i, via: SK.RAILGUN, pierce: R.byKey[SK.RAILGUN].pierce }, t, { reason: '电磁炮' });
          break;
        }
        case SK.LASER_EYE: {
          const ta = actionOf(state, t);
          if (ta && ta.key === SK.TRANSFER) {
            setVoid(state, t, SK.LASER_EYE); // 无效化转移伤害
          } else if (ta && R.GUARD_FAMILY.indexOf(ta.key) >= 0 && ta.key !== SK.PROTO && ta.key !== SK.HOLO) {
            setVoid(state, t, SK.LASER_EYE); // 无效化防御类（原型制御除外）
          } else if (ta && (ta.key === SK.PROTO || ta.key === SK.HOLO)) {
            ev(state, { type: 'laserNoEffect', pid: i }); // 需两激光眼，2人不触发
          } else {
            deliverDamage(state, { amt: 1, type: R.DMG.LIGHT, source: i, via: SK.LASER_EYE }, t, { reason: '激光眼' });
          }
          break;
        }
        case SK.CANNON: {
          const phase = a.phase || 1;
          deliverDamage(state, { amt: 1, type: R.DMG.NORMAL, source: i, via: SK.CANNON }, t, { reason: '过载炮(第' + phase + '次)' });
          if (phase >= 3) { const lost = you.ep; you.ep = 0; ev(state, { type: 'ep', pid: t, delta: -lost, reason: '过载炮' }); }
          break;
        }
        case SK.CURSE: {
          const g = guardOf(state, t);
          const blockKinds = ['guard', 'reflect', 'proto', 'jinshield', 'armor'];
          if (g && blockKinds.indexOf(g.kind) >= 0) {
            ev(state, { type: 'curseBlock', pid: t, by: g.kind });
          } else {
            you.stickers.push({ owner: i, age: 0 });
            ev(state, { type: 'curse', pid: t, owner: i });
          }
          break;
        }
        case SK.FIRESTORM: {
          const pg = guardOf(state, t);
          const protoBlock = pg && pg.kind === 'proto'; // 只有原型制御可挡 R36
          let n = 0;
          for (const st of you.stickers.slice()) {
            if (st.owner === i && st.age <= 3) {
              n++;
              if (!protoBlock) rawDamage(state, t, 1, '天火', 'firestorm', { type: R.DMG.FIRE });   // R45：铁索共享火焰（文档口径）
              else ev(state, { type: 'blocked', to: t, by: '原型制御', amt: 1, via: 'firestorm' });
            }
          }
          ev(state, { type: 'firestorm', pid: i, n });
          break;
        }
        case SK.TAUNT: {
          you.tauntPending = true;
          roundTaunts.push({ caster: i, target: t });
          ev(state, { type: 'taunt', pid: i, target: t });
          break;
        }
        case SK.SHIFT: me.guardNext = true; /* fallthrough 记录架势 */
        case SK.GUARD: case SK.REFLECT: case SK.BAGUA:
        case SK.JINSHIELD: case SK.ARMOR: case SK.PROTO: case SK.HOLO:
          if (a.key === SK.ARMOR) you.fireWeakNext = true; // R22 藤甲贴在对手身上，使对手下回合火伤+1
          ev(state, { type: 'guardSet', pid: i, key: a.key });
          break;
        default: break;
      }
    }

    // ====== ④b 镜面反射 / 反复横跳 / 聚光炮（N14/N15/N16）======
    mirrorPass(state);

    // 互勾 → 铁索连环（在抵消检查中被豁免，双方均已结算）
    for (let i = 0; i < playerCount(state); i++) {
      const a = actionOf(state, i);
      if (!a || a.key !== SK.DRAIN) continue;
      const t = targetOf(state, i);
      if (t == null) continue;
      const tb = actionOf(state, t);
      if (tb && tb.key === SK.DRAIN && targetOf(state, t) === i) {
        state.p[i].chains = [t]; state.p[t].chains = [i];
        if (i < t) ev(state, { type: 'hidden', name: '铁索连环' });
      }
    }

    // ====== ⑤ 枪 pri2（相抵已由 clashPass 处理）======
    for (let i = 0; i < playerCount(state); i++) {
      const a = actionOf(state, i);
      if (a && a.key === SK.GUN) {
        const tg = targetOf(state, i);
        if (tg != null) deliverDamage(state, { amt: 1, type: R.DMG.NORMAL, source: i, via: SK.GUN }, tg, { reason: '枪' });
      }
    }

    // ====== ⑥ 狙击 pri1（干扰则无效，否则爆头判定）======
    for (let i = 0; i < playerCount(state); i++) {
      const a = actionOf(state, i);
      if (!a || a.key !== SK.SNIPE) continue;
      const t = targetOf(state, i);
      if (t == null) continue;
      const ta = actionOf(state, t);
      if (ta && (R.ATK_EFFECT.indexOf(ta.key) >= 0 || ta.key === SK.TRANSFER)) {
        setVoid(state, i, '狙击被干扰'); // README 特殊1 R13
        continue;
      }
      const res = deliverDamage(state, {
        amt: 1, type: R.DMG.NORMAL, source: i, via: SK.SNIPE, pierce: R.byKey[SK.SNIPE].pierce
      }, t, { reason: '狙击枪' });
      if (res.result === 'land') {
        // 爆头：目标技能对狙击手无影响才可判定
        const affect = ta && (R.ATK_EFFECT.indexOf(ta.key) >= 0 || ta.key === SK.TRANSFER);
        if (!affect && judge3(state)) {
          rawDamage(state, t, 1, '爆头', 'headshot', {});   // R45：铁索共享爆头（文档口径）
          ev(state, { type: 'headshot', pid: i, to: t });
        }
      }
    }

    // ====== ⑥b 净化 pri1（清除自身状态与符咒）======
    for (let i = 0; i < playerCount(state); i++) {
      const a = actionOf(state, i);
      if (!a || a.key !== SK.PURIFY) continue;
      const me = state.p[i];
      const n = me.stickers.length;
      me.stickers = [];
      me.nightmare = false;
      me.tauntPending = false;
      if (n >= 1) { me.hp += n - 1; ev(state, { type: 'heal', pid: i, amt: n - 1, reason: '净化' }); }
      ev(state, { type: 'purify', pid: i, curses: n });
    }
  }

  /* ---------- 回合结束 ---------- */
  function endTurn(state) {
    const acts = state.actions;
    // 连击计数
    for (let i = 0; i < playerCount(state); i++) {
      const p = state.p[i];
      const a = acts[i];
      if (!(a && a.outcome === 'ok' && a.key === SK.RING)) p.ringStreak = 0;
      if (a && a.outcome === 'ok' && a.key === SK.GUARD) p.guardStreak = (p.guardStreak || 0) + 1;
      else p.guardStreak = 0;
      p.lastSkill = (a && a.outcome === 'ok') ? a.key : null;
    }
    // 蓄能珠时效 R9'：只供下一回合——回合结束时，非"本回合新蓄"的珠一律清空
    for (let i = 0; i < playerCount(state); i++) {
      const p = state.p[i];
      const keep = p.beadNew || null;
      const beforeE = p.elec, beforeB = p.boom;
      p.elec = keep === 'elec' ? 1 : 0;
      p.boom = keep === 'boom' ? 1 : 0;
      p.beadNew = null;
      if (beforeE !== p.elec) ev(state, { type: 'beadExpire', pid: i, kind: 'elec', n: beforeE - p.elec });
      if (beforeB !== p.boom) ev(state, { type: 'beadExpire', pid: i, kind: 'boom', n: beforeB - p.boom });
    }
    // 挑衅合规检查（本回合义务；净化不能免除已生效义务 R54）
    for (let i = 0; i < playerCount(state); i++) {
      const p = state.p[i];
      if (p.tauntActive) {
        const a = acts[i];
        const ok = !!(a && a.outcome === 'ok' && R.TAUNT_SATISFY.indexOf(a.key) >= 0);
        if (!ok) { p.hp -= 1; ev(state, { type: 'damage', to: i, amt: 1, reason: '挑衅违约', via: 'taunt' }); }
        p.tauntActive = false;
        ev(state, { type: 'tauntCheck', pid: i, ok });
      }
    }
    // 新挑衅 → 下回合义务
    for (let i = 0; i < playerCount(state); i++) {
      if (state.p[i].tauntPending) { state.p[i].tauntActive = true; state.p[i].tauntPending = false; }
    }
    // 符咒 age++；停留 >3 回合后自动消失（R37 引爆窗口到期，buff 不再显示在状态栏）
    for (let i = 0; i < playerCount(state); i++) {
      const p = state.p[i];
      const before = p.stickers.length;
      for (const st of p.stickers) st.age += 1;
      p.stickers = p.stickers.filter(function (st) { return st.age <= 3; });
      const expired = before - p.stickers.length;
      if (expired > 0) ev(state, { type: 'curseExpire', pid: i, n: expired });
    }
    // 隐藏技能触发（回魂/梦魇，以回合末死亡为准）R48/R50
    for (const tc of roundTaunts) {
      const c = state.p[tc.caster], t = state.p[tc.target];
      if (c.hp <= 0 && !c.reviveNext && !c.infiniteEnergy) { c.reviveNext = true; ev(state, { type: 'hidden', name: '回魂', pid: tc.caster }); }
      if (t.hp <= 0 && !t.infiniteEnergy) { t.reviveNext = false; c.nightmare = true; ev(state, { type: 'hidden', name: '梦魇', pid: tc.caster }); }
    }
    // 铁索解除（一方确认死亡且无回魂）R46
    for (let i = 0; i < playerCount(state); i++) {
      const p = state.p[i];
      if (p.hp <= 0 && !p.reviveNext && !p.infiniteEnergy) {
        for (const q of state.p) q.chains = (q.chains || []).filter(function (x) { return x !== i; });
      }
    }
    // 禁用/避雷针守卫递减
    for (let i = 0; i < playerCount(state); i++) {
      const p = state.p[i];
      for (const k of Object.keys(p.cooldown)) if (p.cooldown[k] > 0) p.cooldown[k] -= 1;
      if (p.rodGuard > 0) p.rodGuard -= 1;
      p.fireWeakNow = false; p.baguaExtra = false;
    }
    // 回魂复活回合：回合结束立即死亡 R48
    for (let i = 0; i < playerCount(state); i++) {
      if (state.p[i].infiniteEnergy) { state.p[i].infiniteEnergy = false; state.p[i].hp = 0; ev(state, { type: 'death', pid: i, reason: '回魂回合结束' }); }
    }
    // N12：死亡事件（只报一次；复活后重置）
    for (let i = 0; i < playerCount(state); i++) {
      const p = state.p[i];
      const dead = p.hp <= 0 && !p.reviveNext && !p.infiniteEnergy;
      if (dead && !p.deadLogged) { p.deadLogged = true; ev(state, { type: 'death', pid: i, reason: 'HP 归零' }); }
      else if (!dead) p.deadLogged = false;
    }
    checkOver(state);
  }

  /* 胜负判定 R1 */
  function checkOver(state) {
    if (state.over) return true;
    const N = playerCount(state);
    const alive = [];
    for (let i = 0; i < N; i++) {
      const p = state.p[i];
      if (!(p.hp <= 0 && !p.reviveNext && !p.infiniteEnergy)) alive.push(i);
    }
    if (alive.length === 0) { state.over = true; state.winner = 'draw'; return true; }   // N10 全灭
    if (alive.length === 1) { state.over = true; state.winner = alive[0]; return true; } // N10 最后存活
    if (state.round >= R.MAX_ROUNDS) {
      state.over = true;
      let best = -Infinity, bestPid = null, tie = false;                                 // N10 回合上限：血最多者胜
      for (const i of alive) {
        const h = state.p[i].hp;
        if (h > best) { best = h; bestPid = i; tie = false; }
        else if (h === best) tie = true;
      }
      state.winner = tie ? 'draw' : bestPid;
      return true;
    }
    return false;
  }

  global.EpirusResolve = {
    startTurn, resolveActions, endTurn, checkOver,
    rawDamage, deliverDamage, guardOf, judge, judge3, actionOf, setVoid
  };
})(typeof window !== 'undefined' ? window : globalThis);
