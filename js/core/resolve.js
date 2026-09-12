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
  /* N2 修正（座位偏置）：同优先级内若一律按座位号升序结算，先结算者会把后者作废，
   * 低 pid 在“同归于尽”局面里系统性占便宜（实测 3x 同一策略可达 73.5/14.5/0.0）。
   * 故按回合轮换结算起点，把系统性优势摊平到各座位。
   * 2 人局保持恒等顺序（成对相抵本质对称，且 v1.0 已冻结）。 */
  function turnOrder(state) {
    const n = playerCount(state);
    const out = [];
    if (n <= 2) { for (let i = 0; i < n; i++) out.push(i); return out; }
    const start = ((state.round || 1) - 1) % n;
    for (let k = 0; k < n; k++) out.push((start + k) % n);
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
    /* 每回合自动回 ep（多人可选规则，默认 0 不生效）。
     * 动机：原来 `case SK.JI: me.ep += 1` 是**唯一** ep 收入，导致ジ 占比恒为
     * c/(c+1)（每出手一次花 c 个ジ，就得先出 c 次ジ）。给一部分对局加上自动回能
     * 后，ジ 占比下降，腾出的回合才可能分给其他技能；同时让聚能环的 3 点启动
     * 成本变得可负担。 */
    if (state.epRegen) {
      for (let r = 0; r < playerCount(state); r++) {
        const pl = state.p[r];
        if (pl.hp > 0) { pl.ep += state.epRegen; ev(state, { type: 'ep', pid: r, delta: state.epRegen, reason: '每回合回能' }); }
      }
    }
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
      /* 火弱持续性（**训练侧实验开关**，默认关 → shipped 规则一字不改）：
       * 现状：Next 在 startTurn 被消费成 Now 并清空，Now 在 endTurn 清空 ⇒ 只活一个回合。
       * 打开 EPIRUS_FIREWEAK_PERSIST=1：Next **不清除**（每回合重新武装），
       * 直到被火焰伤害真正兑现时才清除（见 rawDamage 里的消费点）。 */
      p.fireWeakNow = !!p.fireWeakNext; if (!FIREWEAK_PERSIST) p.fireWeakNext = false; // R22
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
  /* 训练侧实验开关（浏览器里 process 不存在 → 恒为 false，shipped 行为不变） */
  const FIREWEAK_PERSIST = (typeof process !== 'undefined' && process.env && process.env.EPIRUS_FIREWEAK_PERSIST === '1');

  function rawDamage(state, to, amt, reason, via, opts) {
    opts = opts || {};
    const p = state.p[to];
    if (p.hp <= 0) return false;
    let hit = amt;
    // 藤甲火弱：一切火焰伤害+1（坦克/天火/地雷等，R22）
    if ((opts.type === R.DMG.FIRE || opts.type === R.DMG.FIRELIGHT) && p.fireWeakNow) {
      hit += 1;  // N18 藤甲
      if (FIREWEAK_PERSIST) { p.fireWeakNext = false; p.fireWeakNow = false; }   // 兑现即消费
    }
    if ((opts.type === R.DMG.LIGHT || opts.type === R.DMG.FIRELIGHT) && p.vampire) hit += 1;      // R47/N18 吸血鬼
    p.hp -= hit;
    ev(state, { type: 'damage', to, amt: hit, reason, via: via || reason, source: (opts.source != null ? opts.source : null) });
    if (opts.chain !== false && p.chains && p.chains.length && !opts.fromChain) {
      for (const other of p.chains) {          // N8：铁索图不递归
        const op = state.p[other];
        if (op && op.hp > 0) {
          op.hp -= hit;
          ev(state, { type: 'damage', to: other, amt: hit, reason: '铁索连环', via: 'chain', fromChain: true, source: (opts.source != null ? opts.source : null) });
        }
      }
    }
    return true;
  }

  /* 大雷禁用（直击与连带共用）：只禁“当前使用的那个技能”（R29） */
  /* BIG_T ban exemptions. MINI_T (lesser lightning, pri5) MUST be here: it resolves
   * BEFORE bigT (pri4), so banning it afterwards would be a retroactive error (user ruling). */
  /* 禁用豁免表。**注意与 R23' 的关系**：用户裁定"防御族可以**防住**大雷"指的是
   * **格挡那 2 点伤害**，并**不**表示豁免 3 回合禁用——R23' 明确"2 电被挡但禁用目标用的
   * 原型制御仍生效"。故此处**不扩到整个防御族**（我一度扩了，直接把 R23' 打破 → spec 36/37）。
   * 只保留：防御/反弹/金刚盾（原表）+ ジ（本回合失效不给 ep，但不进禁用）
   * + 小雷 MINI_T（pri5 已先结算，追溯禁用是错的）。 */
  const BIG_T_EXEMPT = [SK.GUARD, SK.REFLECT, SK.JINSHIELD, SK.JI, SK.MINI_T];
  function bigTBan(state, pid, usedKey) {
    if (usedKey && R.MULTI_ONLY.indexOf(usedKey) < 0 && BIG_T_EXEMPT.indexOf(usedKey) < 0) {
      state.p[pid].cooldown[usedKey] = Math.max(state.p[pid].cooldown[usedKey] || 0, 4);
    }
    ev(state, { type: 'ban', pid: pid, by: SK.BIG_T, turns: 3, skill: usedKey });
  }

  /* 可触发地雷的伤害来源；狙击豁免 R38 */
  const MINE_TRIGGER = [SK.GUN, SK.SWORD, SK.TANK, SK.DRAIN, SK.RAILGUN, SK.BIG_T, SK.LASER_EYE, SK.CANNON];

  /* 地雷连锁（至多2次）R38/R39 —— 反击绕过一切架势 */
  /* ===== N20 地雷 AoE（用户裁定 2026-09-11）=====
   * 旧实现是 2 人时代口径（只让"攻击者"受 1 火伤），而 2 人局里「全场其他角色」
   * 与「攻击者」**恰好同一人** ⇒ 两种读法在 2 人下无法区分，multi 加入时未回头核对。
   * 正确口径：
   *   直接触发（X 被非狙击攻击）→ 除 X 外**所有存活角色**各受 1 火伤，**无次数上限**；
   *   间接触发（挨了地雷伤害且自己装着雷）→ 所有间接触发者**合并成一波**，
   *     打**除这些间接触发者之外**的所有存活角色；间接触发只发生一次。
   *   火弱逐目标计算（藤甲挂在被攻击者身上）；地雷伤害**无来源**（source=null）
   *     ⇒ 不被铁索共享 / 不被转移 / 不被大雷传导，但事件里带 mineFrom 以便归因。
   * 用例核对（a,b,c 装雷，4 人）：
   *   d 打 a → a 直接: b,c,d 各 1；b,c 间接合并: a,d 各 1
   *   d 双枪打 a,b → a 直接: b,c,d；b 直接: a,c,d；c 间接合并: a,b,d
   */
  function mineHit(state, to, mineFrom) {
    const p = state.p[to];
    if (p.hp <= 0) return;
    let amt = 1;
    if (p.fireWeakNow) amt += 1;                       // 火弱：只加到挂了 debuff 的那个人
    rawDamage(state, to, amt, '地雷', 'mine', { source: null, mineFrom: mineFrom });
  }
  /* N20 mine resolution (called after the damage phase in resolveActions).
   * DIRECT-FIRST: a mine triggered by being attacked counts as direct, even if it also
   * took another mine wave in the same round. Otherwise, when d dual-guns a and b,
   * a's wave would consume b's mine as "indirect" and b's direct trigger would never fire
   * (measured: b lost 2 HP instead of 3).
   * Phase 1: every direct trigger fires its own wave (all alive except owner), no cap.
   * Phase 2: mines that took a wave and are NOT in the direct set merge into ONE wave
   *          hitting everyone except those indirect triggerers. */
  function mineResolveAll(state) {
    const N = playerCount(state);
    const direct = [];
    for (let i = 0; i < N; i++) {
      if (!state.p[i]._minePending) continue;
      state.p[i]._minePending = false;
      if (state.p[i].hp > 0 && state.p[i].mineArmed) direct.push(i);
    }
    if (!direct.length) return;
    const indirect = [];
    for (const v of direct) {
      state.p[v].mineArmed = false;
      ev(state, { type: 'mine', from: v, kind: 'direct' });
      for (let i = 0; i < N; i++) {
        if (i === v || state.p[i].hp <= 0) continue;
        mineHit(state, i, v);
        if (state.p[i].hp > 0 && state.p[i].mineArmed && direct.indexOf(i) < 0 && indirect.indexOf(i) < 0)
          indirect.push(i);
      }
    }
    if (!indirect.length) return;
    for (const i of indirect) state.p[i].mineArmed = false;
    ev(state, { type: 'mine', from: indirect.slice(), kind: 'indirect' });
    for (let i = 0; i < N; i++) {
      if (indirect.indexOf(i) >= 0 || state.p[i].hp <= 0) continue;
      mineHit(state, i, indirect[0]);
    }
  }

  function mineTrigger(state, victim) {   // kept for direct unit-test calls
    state.p[victim]._minePending = true;
    mineResolveAll(state);
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
    rawDamage(state, to, dmg.amt, ctx.reason || via || '', via, { fromChain: dmg.fromChain, type: dmg.type, source: (dmg.source != null ? dmg.source : null) });
    // 地雷联动（直接攻击动作伤害落地才触发；反弹/转移/天火等不触发）
    if (!dmg.noMine && !dmg.fromChain && !dmg.reflected && dmg.source != null && dmg.source !== to) {
      if (via !== SK.SNIPE && MINE_TRIGGER.indexOf(via) >= 0 && target.mineArmed) {
        state.p[to]._minePending = true;   // N20: defer; resolved after all damage, direct-first
      }
    }
    return { result: 'land', amt };
  }

  /* 攻击相抵/阻止（优先级原则 R3）：同优先级攻击抵消，高优先级攻击阻止低优先级攻击 */
  function clashPass(state) {
    /* N2 修正：快照结算，避免“先判定的对子把后判定的行动作废”带来的顺序依赖 */
    const snapK = [], snapT = [];
    for (const i of turnOrder(state)) { const a = actionOf(state, i); snapK[i] = a ? a.key : null; snapT[i] = a ? targetOf(state, i) : null; }
    const atkIdx = [];
    for (const i of turnOrder(state)) {
      if (snapK[i] && R.ATK_EFFECT.indexOf(snapK[i]) >= 0) atkIdx.push(i);
    }
    if (atkIdx.length < 2) return;
    const pending = [];
    // N 人：两两结算（同优先级相抵、高优先级阻止低优先级）
    for (let x = 0; x < atkIdx.length; x++) {
      for (let y = x + 1; y < atkIdx.length; y++) {
        const ia = atkIdx[x], ib = atkIdx[y];
        const a = snapK[ia], b = snapK[ib];
        if (!a || !b) continue;
        if (a === SK.DRAIN && b === SK.DRAIN) continue; // 互勾触发铁索，不抵消
        // N4：**只有互为目标**的攻击才会交锋（2 人时天然成立）。
        // 两家同时打第三人 ≠ 互为目标，不应相抵/阻止。
        if (snapT[ia] !== ib || snapT[ib] !== ia) continue;
        const pa = R.byKey[a].pri || 3, pb = R.byKey[b].pri || 3;
        if (pa === pb) {
          ev(state, { type: 'cancel', pids: [ia, ib], round: state.round });
          pending.push([ia, '相抵'], [ib, '相抵']);
        } else if (pa > pb) {
          ev(state, { type: 'clash', winner: ia, loser: ib });
          pending.push([ib, '被高优先级攻击阻止']);
        } else {
          ev(state, { type: 'clash', winner: ib, loser: ia });
          pending.push([ia, '被高优先级攻击阻止']);
        }
      }
    }
    for (const pd of pending) if (actionOf(state, pd[0])) setVoid(state, pd[0], pd[1]);
  }

  /* ---------- N14 镜面反射 / N15 反复横跳 / N16 聚光炮 ---------- */
  /* 可被复制的“伤害效果”：架势/自增益/能量类/状态类返回 null */
  function copyEffect(key) {
    const def = R.byKey[key];
    if (!def) return null;
    // 双枪走数据表（以前硬编码 amt:1，使 rules.js 的 dmg 字段失效 →
    // 调它的平衡会静默无效）。via 仍按枪口径（可被反弹/地雷）。
    if (key === SK.DUAL_GUN) return {
      amt: (def.dmg && def.dmg.amt) || 1, type: (def.dmg && def.dmg.type) || R.DMG.NORMAL,
      pierce: def.pierce || {}, via: SK.GUN   // ⚠️ via 必须是 SK.GUN：MINE_TRIGGER/REFLECTABLE 都按枪口径查表，
      //    v1.3.19 误写成 SK.DUAL_GUN -> 双枪第一枪不触发地雷、也不被反弹（真 bug，N20b 抓出来）
    };
    if (key === SK.LASER_EYE) return { amt: 1, type: R.DMG.LIGHT, pierce: {}, via: SK.LASER_EYE };
    if (key === SK.CANNON) return { amt: 1, type: R.DMG.NORMAL, pierce: { defense: true, reflect: true }, via: SK.CANNON };
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
    for (const i of turnOrder(state)) { const a = actionOf(state, i); if (a && a.key === SK.ROD) rodUsers.push(i); }
    if (rodUsers.length) {
      const lightning = [];
      for (const i of turnOrder(state)) { const a = actionOf(state, i); if (a && R.LIGHTNING.indexOf(a.key) >= 0) lightning.push(i); }
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
    for (const i of turnOrder(state)) { const a = actionOf(state, i); if (a && a.key === SK.MINI_T) mini.push(i); }
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
    for (const i of turnOrder(state)) { const a = actionOf(state, i); if (a && a.key === SK.BIG_T) bigs.push(i); }
    /* N2 修正（同优先级同时结算）：层入口对全场行动拍快照，层内一律按快照判断。
     * 否则先结算的大雷会把后者作废 → 低 pid 在三方同时放大雷时系统性免伤
     * （实测 P0→P1/P1→P2/P2→P0 结果 HP 3/1/1）。落地仍按实际结算。 */
    const snapK = [], snapT = [];
    for (const i of turnOrder(state)) { const a = actionOf(state, i); snapK[i] = a ? a.key : null; snapT[i] = a ? targetOf(state, i) : null; }
    for (const c of bigs) {
      if (!snapK[c]) continue;
      const t = snapT[c];
      if (t == null) continue;
      const bothBig = !!(snapK[t] === SK.BIG_T && snapT[t] === c); // 互轰
      if (state.p[t].rodGuard > 0) {
        state.p[t].rodGuard = 0;
        setVoid(state, c, '避雷针');
        ev(state, { type: 'rodBlock', pid: t, by: SK.BIG_T });
        continue;
      }
      const ta = snapK[t] ? { key: snapK[t] } : null;
      // 效果2：非防御类技能一律无效化；双大雷互轰时各自保留
      // void non-defense-family skills; MINI_T also exempt (pri5 already resolved)
      if (!bothBig && ta && R.GUARD_FAMILY.indexOf(ta.key) < 0 && ta.key !== SK.MINI_T) {
        setVoid(state, t, SK.BIG_T);
      }
      // 记录目标当面架势（用于 R23'：原型制御挡电但不免疫禁用）
      const guardKind = (guardOf(state, t) || {}).kind;
      /* N22（用户裁定）：**所有防御类都能格挡大雷**；而大雷属"反弹可格挡但不触发反弹"——
       * 实现方式：去掉 pierce.reflect（那是"反弹整个失效"），靠 BIG_T 不在 REFLECTABLE 里
       * 使反弹只格挡、不反击。pierce.transfer 表示大雷伤害不可被转移。 */
      const res = deliverDamage(state, {
        amt: 2, type: R.DMG.ELECTRIC, source: c, via: SK.BIG_T, pierce: { transfer: true }
      }, t, { reason: '真正的落雷' });
      // N6 连带伤害（原文效果3）：与目标 T 产生交互的第三方 各受 1 点电伤；
      //   其中「对 T 使用技能」者额外被无效化（对 T 的那个技能）；施法者自身不参与。
      //   2 人时第三方不存在 → 行为不变（回归安全）。
      const tTgt = snapT[t];
      for (const q of turnOrder(state)) {
        if (q === c || q === t || state.p[q].hp <= 0) continue;
        const qa = snapK[q] ? { key: snapK[q] } : null;
        const qTargetsT = snapK[q] != null && snapT[q] === t;
        const tTargetsQ = !!ta && tTgt === q;
        if (!qTargetsT && !tTargetsQ) continue;
        /* N22：防御族不失效（它们能格挡大雷）；小雷 pri5 已先结算也不失效。 */
        const qUsed = snapK[q];
        const qIsDef = !!(qa && R.GUARD_FAMILY.indexOf(qa.key) >= 0);
        if (!qIsDef && qa && qa.key !== SK.MINI_T) setVoid(state, q, '真正的落雷连带');
        ev(state, { type: 'bigTChain', from: c, to: q, kind: qTargetsT ? 'attack' : 'targeted' });
        /* N22：防御者本人不吃伤害；但其防御技能**有作用目标**时（金刚盾/藤甲），
         * 传导伤害落到那个作用目标身上。无目标的自守防御则完全挡住。 */
        let qHit = q;
        if (qIsDef) {
          const qTgt = snapT[q];
          if (qTgt == null || qTgt === q || state.p[qTgt].hp <= 0) continue;
          qHit = qTgt;
        }
        const qres = deliverDamage(state, {
          amt: 2, type: R.DMG.ELECTRIC, source: c, via: SK.BIG_T, pierce: { transfer: true }
        }, qHit, { reason: '真正的落雷·连带' });
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

    // ====== N20 过载炮反制（必须在 clashPass 之前）======
    /* 过载炮 pri=3 高于 枪 pri=2，若先走 clashPass，炮会把枪作废，
     * 反制就永远轮不到。用户设计：**任何攻击类技能都能抵消过载炮**，
     * 所以反制必须提到相抵之前。 */
    for (const i of turnOrder(state)) {
      const a = actionOf(state, i);
      if (!a || a.key !== SK.CANNON) continue;
      const t = targetOf(state, i);
      if (t == null) continue;
      const tb = actionOf(state, t);
      if (tb && R.ATK_EFFECT.indexOf(tb.key) >= 0) {
        setVoid(state, i, '过载炮被攻击抵消');
        ev(state, { type: 'cannonCountered', pid: i, by: t, key: tb.key });
      }
    }

    // ====== 攻击相抵/阻止（跨层统一）======
    clashPass(state);

    // ====== ④ 默认优先级 3 ======
    for (const i of turnOrder(state)) {
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
        case SK.DUAL_GUN: {                    // N3 双枪射手：对两个目标各一枪（走数据表，可被反弹/地雷）
          const t2 = (a.target2 != null && state.p[a.target2] && state.p[a.target2].hp > 0) ? a.target2 : null;
          const dgDef = R.byKey[SK.DUAL_GUN];
          const dgDmg = { amt: (dgDef.dmg && dgDef.dmg.amt) || 1, type: (dgDef.dmg && dgDef.dmg.type) || R.DMG.NORMAL, source: i, via: SK.GUN, pierce: dgDef.pierce || {} };
          deliverDamage(state, Object.assign({}, dgDmg), t, { reason: '双枪射手' });
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
          } else if (ta && R.GUARD_FAMILY.indexOf(ta.key) >= 0) {
            /* N23（用户裁定 2026-09-11）：原实现要求**两个**激光眼才能破原型制御/全息，
             * 用户认为"单个激光眼还打不破原型制御有点拉了" ⇒ 改为**单发即失效整个防御族**。
             * 防御类专用反制因此回到与其它防御技**同费(2 ジ)**、单发生效。 */
            setVoid(state, t, SK.LASER_EYE);
          } else {
            deliverDamage(state, { amt: 1, type: R.DMG.LIGHT, source: i, via: SK.LASER_EYE }, t, { reason: '激光眼' });
          }
          break;
        }
        case SK.CANNON: {
          const phase = a.phase || 1;
          // 反制已在 clashPass 之前处理；到这里说明对手没回击 → 打穿防御/反弹落 1 伤
          deliverDamage(state, { amt: 1, type: R.DMG.NORMAL, source: i, via: SK.CANNON, pierce: { defense: true, reflect: true } }, t, { reason: '过载炮(第' + phase + '次)' });
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
    for (const i of turnOrder(state)) {
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
    for (const i of turnOrder(state)) {
      const a = actionOf(state, i);
      if (a && a.key === SK.GUN) {
        const tg = targetOf(state, i);
        if (tg != null) deliverDamage(state, { amt: 1, type: R.DMG.NORMAL, source: i, via: SK.GUN }, tg, { reason: '枪' });
      }
    }

    // ====== ⑥ 狙击 pri1（干扰则无效，否则爆头判定）======
    for (const i of turnOrder(state)) {
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
    for (const i of turnOrder(state)) {
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
  
    mineResolveAll(state);   // N20：所有伤害结算完，统一按「直接优先」结地雷
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
    if (state.round >= ((state.mode && state.mode.maxRounds) || R.MAX_ROUNDS)) {   // v1.4.0：按模式配回合上限
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
