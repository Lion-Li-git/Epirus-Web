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
  /* v1.5.37（第三方复核 §5-1）：`by` 是**原因字符串**（'miniT'/'避雷针'/…）**不是施法者 pid**，
   * 于是"我打断了开环者"与"别人打断、我恰好也放过小雷"在事件层**无法区分** ⇒ 奖励结构上无法归因。
   * 加第 4 参 `byPid`（施法者 pid；不传时保持旧形状，兼容历史事件流）。 */
  function setVoid(state, pid, by, byPid) {
    if (state.actions[pid] && !state.actions[pid].voided) {
      state.actions[pid].voided = true;
      const e = { type: 'voided', pid, by };
      if (byPid != null) e.byPid = byPid;
      ev(state, e);
    }
  }

  /* ===== v1.5.109（**用户裁定 2026-09-18** = R59）：地雷改成"**当前回合 + 其后两个回合**"的自身 buff =====
   * 旧文 R38「持续**直到被触发**」= 永久（实测：一局内不触发就挂到死，平均挂 33.4 回合(多)/74.2 回合(长)；
   * 且"身上还有雷还再敲"占 68%(多)/81%(长)，纯浪费 ≈21 ジ/局(多)、50 ジ/局(长)）。
   * 千问实测**严格单回合**又把这张牌打成废牌（引爆 1.90→0.08 次/局）⇒ 用户裁定取 **3 回合**。
   * · 触发即失效（N20 原文"地雷随后失效" ✓ 不动）；
   * · **已武装时再埋 = 刷新计时**（保留 R40"重新埋雷 = 刷新为新雷，同源不叠加"）；
   * ⚠️ **写入只有这一处**（下面两个 `case SK.MINE` 都调它）—— 环的"两处写入"就是 R10 bug 的温床。 */
  function armMine(state, me, pid) {
    me.mineArmed = true;
    me.mineTurns = 3;                     // 本回合 + 后两个回合（回合末递减，减到 0 卸下）
    ev(state, { type: 'mineArm', pid: pid });
  }

  /* ===== v1.5.110（**用户裁定 2026-09-18** = R60）：净化的清除清单 = **自身全部持续状态** =====
   * 用户口径："藤甲与地雷既然做成了 buff，就一并会被净化掉（同样会被净化掉的还有
   * **避雷针、符咒、大雷禁用效果**以及几乎不会出现的**梦魇**）"。
   * ⇒ 清单**从状态字段推导**（不写卡名清单）：`stickers`（符咒）/`nightmare`（梦魇 R50）/
   *    `tauntPending`（挑衅）/`fireWeakNow + fireWeakNext`（藤甲 R58）/`mineArmed + mineTurns`（地雷 R59）/
   *    `rodGuard`（避雷针 R31）/`cooldown`（大雷禁用 R29）。
   * ⚠️ **写入只有这一处**（下面两个 `case SK.PURIFY` —— 正式路径与镜面复制路径 —— 都只调它）。
   *    环（R10）与地雷（R59）都是"两处各自写一遍"埋出来的雷，这条不再犯。
   * ⚠️ 副作用（用户口径的自然结果，记录在案）：**增益也一起被清** ⇒ 净化会对"自己挂着地雷/避雷针"
   *    的局面造成自损 ⇒ 它不再是"纯赚"的牌。这是裁定的一部分，不是 bug。 */
  function purgeSelf(state, me, pid) {
    const n = me.stickers.length;
    me.stickers = [];
    me.nightmare = false;
    me.tauntPending = false;
    me.fireWeakNow = false; me.fireWeakNext = false;       // 藤甲（R58）
    me.mineArmed = false; me.mineTurns = 0;                // 地雷（R59）
    me.rodGuard = 0;                                       // 避雷针（R31）
    me.cooldown = {};                                      // 大雷禁用（R29）
    if (n >= 1) { me.hp += n - 1; ev(state, { type: 'heal', pid: pid, amt: n - 1, reason: '净化' }); }
    ev(state, { type: 'purify', pid: pid, curses: n });
  }

  /* ---------- N 人通用：人数/目标 ---------- */
  function playerCount(state) { return state.p.length; }
  function aliveOpps(state, pid) {
    const out = [];
    for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) out.push(i);
    return out;
  }
  /* v1.5.54（L7 第四次）：**无显式目标时的默认作用者不许是固定索引**。
   * 病：`oppOf` 与 `mirrorRefs` 的兜底一律取 `aliveOpps(...)[0]` = 索引最小的存活对手
   *     ⇒ 0 号座是"所有人的默认靶子"（实测 0 号座每局必死 60/60 的一部分来源）。
   * 修：按**每局的盐**轮换（纯函数、可复现、**不消耗任何随机流** —— 借流的三个坑 v1.5.51 已踩过）。
   * **盐 0 保持旧口径**（页面与既有对比基线不变；训练侧每局都有盐）。 */
  function saltPick(state, arr, seq) {
    if (!arr || !arr.length) return null;
    const salt = (state && state.slotSalt != null) ? (state.slotSalt >>> 0) : 0;
    if (!salt) return arr[0];
    const base = (salt ^ Math.imul(((state.round || 1) + 1) | 0, 0x9e3779b9)) >>> 0;
    return arr[(base + (seq | 0)) % arr.length];
  }
  /* N2 修正（座位偏置）：同优先级内若一律按座位号升序结算，先结算者会把后者作废，
   * 低 pid 在“同归于尽”局面里系统性占便宜（实测 3x 同一策略可达 73.5/14.5/0.0）。
   * 故按回合轮换结算起点，把系统性优势摊平到各座位。
   * 2 人局保持恒等顺序（成对相抵本质对称，且 v1.0 已冻结）。 */
  function turnOrder(state) {
    const n = playerCount(state);
    const out = [];
    if (n <= 2) { for (let i = 0; i < n; i++) out.push(i); return out; }
    /* v1.5.53：**每局随机相位**。原实现 `start = (round-1) % n` 是一个**确定性映射**
     * ⇒ 第 1 回合**永远**从 0 号座开始；而强策略下对局往往前几回合就定局 ⇒ 0 号座白拿"首发优势"。
     * 实测（5 个同一冠军坐满 5 座，60 局/候选）：修掉槽位焦点后变成 **0 号座夺冠 37~54%、死亡最少（31~40/60）**
     * （其余座位 7~20%、死亡 43~52）—— 与修前的"0 号座被杀最多 45~48/50、夺冠 3~9%"**方向相反**，
     * 说明这是**同族**的第二条确定性身份映射（L7：结算顺序也不许有确定性身份映射）。
     * 修法：相位来自**每局的盐**（`state.slotSalt`，训练侧每局不同、页面缺省 0）——
     * 纯函数、可复现、**不消耗任何随机流**（借流会扰动采样：v1.5.51 已踩过 D22/D26/D13）。
     * 2 人局仍恒等顺序（成对相抵本质对称，v1.0 冻结）。 */
    const start = ((((state.slotSalt || 0) >>> 0) % n) + ((state.round || 1) - 1)) % n;
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
    return saltPick(state, o, 0);        // v1.5.54: 不再恒定取最小索引
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
      p.copiedGuard = null;                              // N14 v1.5.17：复制来的架势只活本回合
      /* 火弱持续性（**训练侧实验开关**，默认关 → shipped 规则一字不改）：
       * 现状：Next 在 startTurn 被消费成 Now 并清空，Now 在 endTurn 清空 ⇒ 只活一个回合。
       * 打开 EPIRUS_FIREWEAK_PERSIST=1：Next **不清除**（每回合重新武装），
       * 直到被火焰伤害真正兑现时才清除（见 rawDamage 里的消费点）。 */
      p.fireWeakNow = !!p.fireWeakNext; if (!FIREWEAK_PERSIST) p.fireWeakNext = false; // R22
    }
    checkOver(state);
  }

  /* 当前生效防御架势 */
  /* 技能 key → 架势种类（**唯一真源**）：`guardOf` 的分支与 N14「复制来的架势」共用一份，
   * 免得两处各写一个 switch（"改一处漏一处"在本项目已栽过四次）。 */
  function guardKindOfKey(key) {
    switch (key) {
      case SK.GUARD: return 'guard';
      case SK.REFLECT: return 'reflect';
      case SK.ARMOR: return 'armor';
      case SK.JINSHIELD: return 'jinshield';
      case SK.BAGUA: case SK.SHIFT: return 'bagua';
      case SK.PROTO: return 'proto';
      /* v1.5.4：`SK.HOLO` **不是施放者自己的架势** —— 它是给别人套的盾（见 holoShieldFrom）。
       * 它只作为"被复制的内容"出现在这里：见 copiedGuardKind。 */
      default: return null;
    }
  }
  /* N14：复制来的架势（多一个全息屏障 = 原型制御的特例，v1.5.7 已确认两者防御效果完全相同） */
  function copiedGuardKind(key) {
    if (key === SK.HOLO) return 'proto';
    return guardKindOfKey(key);
  }

  /* N14 镜面反射的两个被作用者（t1=复制对象 / t2=输出对象），带兜底钳制。
   * **单点真源**：结算（mirrorPass）的 ④b 与 N15/N16 判定都走这里 ——
   * 否则"t1 阵亡/目标非法后改指向"这类兜底很容易只改一处。 */
  function mirrorRefs(state, m) {
    const a = actionOf(state, m);
    if (!a || a.key !== SK.MIRROR) return null;
    const opps = aliveOpps(state, m);
    let t1 = a.target, t2 = a.target2;
    if (t1 == null || t1 === m || !state.p[t1] || state.p[t1].hp <= 0) t1 = saltPick(state, opps, 1);   // v1.5.54: 同 oppOf
    if (t2 == null || t2 === m || t2 === t1 || !state.p[t2] || state.p[t2].hp <= 0) {
      t2 = null;
      const rest = [];
      for (const o of opps) if (o !== t1) rest.push(o);
      t2 = saltPick(state, rest, 2);     // v1.5.54: 不再恒定取最小索引
    }
    return { t1, t2 };
  }

  /* 镜面反射"复制到使用者自己身上"的那个技能 key = t1 本回合的技能。
   * t1 没有行动 / 已被作废 → null（这是**唯一**合法的"无可复制"）。 */
  function mirrorSelfKey(state, m) {
    const refs = mirrorRefs(state, m);
    if (!refs || refs.t1 == null) return null;
    const ta = actionOf(state, refs.t1);
    return ta ? ta.key : null;
  }

  function guardOf(state, pid) {
    const a = actionOf(state, pid);
    if (a) {
      const gk = guardKindOfKey(a.key);
      if (gk) return { kind: gk };
    }
    /* N14 **v1.5.17（用户二次裁定，推翻 v1.5.16 的"声明即生效"）**：复制来的架势
     * **只从镜面反射真正结算那一刻起生效**。理由（用户原话）：大雷(pri4) 优先于镜面反射(pri3)
     * ⇒ 目标若用镜面反射，会先被大雷**无效化**，"反弹并没有被复制成功"
     * ⇒ 用户例子里 a 就该挨那 2 点电伤。所以这里读的是 `applyMirrorSelf` 在 ④b
     * 真结算时写下的 `copiedGuard`（它保护得到随后结算的 ⑤ 枪 / ⑥ 狙击，但保护不到先前的大雷）。 */
    const cg = state.p[pid].copiedGuard;
    if (cg) {
      const gk2 = copiedGuardKind(cg);
      if (gk2) return { kind: gk2, copied: true };
    }
    // 无极变速第二回合：本回合自己若没有"防御类"行动，则无极变速的八卦阵仍应生效（R21/R7）
    if (state.p[pid].baguaExtra) {
      const ownGuard = a && R.GUARD_FAMILY.indexOf(a.key) >= 0;
      if (!ownGuard) return { kind: 'bagua', extra: true };
    }
    /* v1.5.4（原始规则修正）：全息屏障是**对别人**用的盾 —— 谁本回合把盾套在我身上，我就有"原型制御"式架势。
     * 这样"格挡 / ≥3 伤害转移给作用者 / 小雷豁免 / 大雷禁用（R23'）"等**所有既有 `kind==='proto'` 的判定
     * 都自动复用**，不必去改别处（改判定是这类修正最容易漏一半的地方）。 */
    const holoFrom = holoShieldFrom(state, pid);
    if (holoFrom != null) return { kind: 'proto', viaHolo: true, from: holoFrom };
    return null;
  }

  /* ===== v1.5.117：原型制御的"待反清单"与决算 =====
   * 用户口径："伤害总数" = **可以生效、且会被原型制御挡住的伤害之和**，按持有者、在同一次结算内累加；
   * 总 ≥3 ⇒ **有来源的那几份各自反给它的施法者**（三个人各用枪打 ⇒ 三人各被反 1 滴），
   * **无来源的那几份（天火等）计入总数但不反**。
   * ⇒ 因为要"看到全部才算"，`deliverDamage` 只负责**照旧挡住 + 记账**，裁决放到伤害阶段末尾。 */
  function protoNote(state, to, source, amt, type, via) {
    state._proto = state._proto || {};
    (state._proto[to] = state._proto[to] || []).push({
      source: (source != null ? source : null), amt: amt, type: type || R.DMG.NORMAL, via: via || null
    });
  }
  function protoReflectAll(state) {
    const bag = state._proto || {};
    for (const k of Object.keys(bag)) {
      const to = Number(k), list = bag[to] || [];
      let total = 0;
      for (const it of list) total += (it.amt || 0);
      if (total >= 3) {
        for (const it of list) {
          if (it.source == null || it.source === to) continue;        // 无来源（天火…）⇒ 只计入总数、不反
          const src = it.source;
          if (!state.p[src] || state.p[src].hp <= 0) continue;
          ev(state, { type: 'reflect', to: to, from: src, amt: it.amt, via: it.via, by: 'proto' });
          deliverDamage(state, { amt: it.amt, type: it.type, source: to, reflected: true, noMine: true },
            src, { reason: '原型制御·转移' });
        }
      }
      delete bag[to];
    }
    state._proto = {};
  }

  /* 本回合是否有人用「全息屏障」把盾套在 `pid` 身上 —— 返回施放者 pid，没有则 null */
  function holoShieldFrom(state, pid) {
    for (let i = 0; i < state.actions.length; i++) {
      if (i === pid) continue;                      // 自己给自己套不算（规则：目标是"被作用者"= 别人）
      /* ⚠ 必须走 `actionOf`（它会跳过 `voided`），**不能直读 `state.actions[i]`**：
       * 小雷（pri5）在屏障（pri3）之前结算，打中**施放者**就把这次施法无效化 ⇒ 屏障不该出现
       * （原始规则：「雷击之枪需要对使用者作用才能使其无效」）。
       * 用 actionOf 还让这条判定**与结算顺序无关** —— 以后万一调 pri 也不会漏掉"被无效化"。 */
      const a = actionOf(state, i);
      if (a && a.key === SK.HOLO && a.target === pid) return i;
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
      /* v1.5.18（用户裁定；第三方复核 §3-1 指出实现与原文不符）：
       * 原文是「**下一次**当其中一个角色受到伤害时，另一个也受到相同伤害」⇒ **一次性**：
       * 共享过一次之后连边**立刻解除**（此前实现成"持续状态、只有死亡才解除"，
       * 那等于把一次性触发做成了持久光环）。要再连，双方得重新互勾一次【摄魂指法】。
       * 先断边再结算：这样本次共享不会因为连边还在而被下一跳重复触发（N8 不递归的另一层保障）。 */
      const once = p.chains.slice();
      p.chains = [];
      for (const other of once) {
        const op = state.p[other];
        if (op && op.chains) op.chains = op.chains.filter(function (x) { return x !== to; });
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
      state.p[v].mineArmed = false; state.p[v].mineTurns = 0;   // v1.5.109 R59：触发即失效（含计时清零）
      ev(state, { type: 'mine', from: v, kind: 'direct' });
      for (let i = 0; i < N; i++) {
        if (i === v || state.p[i].hp <= 0) continue;
        mineHit(state, i, v);
        if (state.p[i].hp > 0 && state.p[i].mineArmed && direct.indexOf(i) < 0 && indirect.indexOf(i) < 0)
          indirect.push(i);
      }
    }
    if (!indirect.length) return;
    for (const i of indirect) { state.p[i].mineArmed = false; state.p[i].mineTurns = 0; }   // v1.5.109 R59
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
        /* 原型制御：阻挡除 地雷/转移 外一切技能伤害（含坦克/狙击/大雷）R23/R24
         * ===== v1.5.116（**用户实盘报的 bug**）：原版规则还有后半句，而实现里只有"阻挡" =====
         * 原版 `D:\code\Epirus\README.md:257` 原文：
         *   「阻止除地雷、转移伤害以外的技能伤害，**若伤害总数大于等于3则将伤害各自转移给作用者**」
         * 本仓 `docs/RULES-2P.md:169`（R24）也写着这条，并注明"2 人对局不触发（单技能伤害≤2）"。
         * ⇒ 触发条件是**这次攻击的伤害总数 ≥3**（`dmg.totalAmt`，缺省 = 本次交付量）：
         *    · 多人局的"总数 ≥3"主要来自**多目标**技能（大雷连带 2×N、铁索共享、双目标技能…）；
         *    · 2 人局单技能 ≤2 ⇒ 永不触发 —— 与 R24 的注记一致 ✓。
         * ⇒ 不是"挡下"，而是把**这一份**伤害**弹回给施法者**（"各自转移给作用者"＝每个受害者各自
         *    把自己那份转给造成它的人）。⚠️ 边界：地雷（`via==='mine'`）与转移伤害（`dmg.redirected`）
         *    本来就不阻挡 ⇒ 也不转移；天火自己另有一处判定（见 `case SK.FIRESTORM` 的注释）。
         * ⚠️ 反弹出去的那一份**不再触发本分支**（`totalAmt: null` ⇒ 按自身 amt 判，通常 <3）。 */
        if (via === 'mine' || dmg.redirected) { /* 不挡 */ }
        else {
          /* ===== v1.5.117（**用户口径**）：判定要看**本回合全部可挡伤害之后**才做 =====
           * 原版 `README.md:257`：「…若伤害总数大于等于3则将伤害各自转移给作用者」。
           * 用户给出的精确解释：**"伤害总数" = 可以生效、且会被原型制御挡住的伤害之和**，
           * 按**持有者**在**同一次结算内**累加 —— 例：
           *   · **三个人各用枪打**同一个持有者 ⇒ 总 3 ⇒ **三人各被反 1 滴**（持有者不掉血）；
           *   · **大雷(2，有来源) + 天火(1，无来源)** ⇒ 总 3 ⇒ **大雷被反 2**，
           *     而天火**计入总数但不反**（它伤害无来源，没得可反）；
           *   · 只挨一发枪（总 1）⇒ 照旧只挡。
           * ⇒ 所以这里**先照旧挡住**（持有者不掉血；返回值仍是 `'blocked'` ⇒ 大雷禁用(R23')、
           *   镜面复制等既有判定**一字不变**），同时把这一份**记进待反清单**；
           *   伤害阶段末尾由 `protoReflectAll` 统一裁决"反给谁、反多少"。
           * ⚠️ 豁免（既不挡也不计入）：地雷（`via==='mine'`）· 转移伤害（`dmg.redirected`）·
           *   **铁索连环的传导**（它在 `rawDamage` 里直接改血、根本不经过本函数 ⇒ 天然不被挡，
           *   见 `rawDamage` 的 `p.chains` 段，用户第 4 条）。 */
          protoNote(state, to, dmg.source, dmg.amt, dmg.type, via);
          ev(state, { type: 'blocked', to, by: '原型制御', amt: dmg.amt, via });
          return { result: 'blocked' };
        }
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
  /* 镜面反射可复制的"伤害效果"：返回 null = **非伤害类** ⇒ 效果落在使用者自己身上 + 对 t2 空指
   * （v1.5.16 用户裁定：没有"无可复制"这件事，见 applyMirrorSelf 与 docs/RULES-NP.md N14）。 */
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

  /* N14 **v1.5.17 用户三次澄清**：「复制来的防御 / 反弹之类**可以**挡得住同优先级里它本来就能挡的
   * 激光剑或坦克 —— **同优先级的时候防御类先出现**。」
   * ⇒ 复制来的**防御架势**必须在 ④（默认优先级 3 的攻击）之前落位；其余自效果（ep / 珠 / 雷 / 净化）
   *   仍留在 ④b 的 `applyMirrorSelf` 里结算。
   * 与"大雷 pri4 先结算"不冲突：大雷（③）与小雷（②）都早于这里，目标若已被它们作废，
   * `actionOf(state, m)` 就是 null ⇒ 这里直接跳过 ⇒ 复制不会发生（那正是用户二次裁定的意思）。 */
  function mirrorGuardPass(state) {
    for (let m = 0; m < playerCount(state); m++) {
      const a = actionOf(state, m);
      if (!a || a.key !== SK.MIRROR) continue;          // 已被 ② 小雷 / ③ 大雷 作废的就不算
      const refs = mirrorRefs(state, m);
      if (!refs || refs.t1 == null || refs.t2 == null) continue;
      const ta = actionOf(state, refs.t1);
      if (!ta) continue;
      const gk = copiedGuardKind(ta.key);
      if (!gk) continue;                                 // 复制的不是防御族 ⇒ 没有"防御类先出现"这回事
      const me = state.p[m];
      me.copiedGuard = ta.key;
      if (ta.key === SK.SHIFT) me.guardNext = true;      // R21：无极变速第二回合
      ev(state, { type: 'guardSet', pid: m, key: ta.key, copied: true, early: true });
    }
  }

  /* N14 **v1.5.18（用户裁定采纳第三方复核 §6 的 R2；实现结论是"无需改代码"）** ——
   * 原提议：把"复制到避雷针"那一支从 ④b **提前到 ② 之前**，好让复制的避雷针能挡本回合在飞的雷。
   *
   * **实测结论：这个改动是空操作**，因为 ① 层的语义是"**当回合有任何雷系技能 ⇒ 它们全部无效**"
   * （见上面 `resolveActions` 的 ① 段，`R.LIGHTNING` 全场扫描 + `setVoid`）——
   * 而"镜面反射能复制到避雷针"的**前提**就是 t1 本回合确实用了避雷针 ⇒ ① **必然**已经把那回合
   * 所有雷系技能废掉了 ⇒ 复制来的窗口在本回合没有东西可挡。
   * 也就是说：用户要的**结果**（"a 不该吃到那个大雷"）本来就成立，只是机制来自 t1 的真避雷针，
   * 而不是复制体自己的窗口。
   *
   * 因此**不留这段提前落位**：它是可证明的死代码，而"有实现、有测试、无入口"正是审计 §3-2 点名的
   * 最危险形态；本项目 §14.7 的教训也是"为了让某个例子成立去改结算语义是危险动作"。
   * 改成把事实**钉成守门**（`np-test D31`）：① 的全局无效化必须仍然覆盖"复制避雷针"这一局；
   * 若将来有人把 ① 收窄成"只无效化指向避雷针使用者的雷"，D31 会立刻红、逼他重新回答这个问题。
   *
   * 顺带修掉的**真实**偏差：免雷窗口（R31 情形B）原先挡不住【电磁炮】—— 见 ④ 的 `case SK.RAILGUN`
   * 与 `np-test D31` 场景二。 */

  function mirrorPass(state) {
    const mirrors = [];
    for (let i = 0; i < playerCount(state); i++) {
      const a = actionOf(state, i);
      if (a && a.key === SK.MIRROR) mirrors.push(i);
    }
    if (!mirrors.length) return;
    const info = {};
    for (const m of mirrors) {
      const rf = mirrorRefs(state, m);              // 单点真源（含 t1/t2 兜底钳制）
      info[m] = rf || { t1: null, t2: null };
      if (!rf || rf.t1 == null || rf.t2 == null) setVoid(state, m, '镜面反射无目标');
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
    // ---- N14 复制 ----
    for (const m of mirrors) {
      const a = actionOf(state, m);
      if (!a) continue;
      const it = info[m];
      if (!it || it.t1 == null || it.t2 == null) continue;
      const ta = actionOf(state, it.t1);
      if (!ta) { ev(state, { type: 'mirrorNoEffect', pid: m, from: it.t1 }); continue; }
      const eff = copyEffect(ta.key);
      if (eff) {
        ev(state, { type: 'mirror', pid: m, from: it.t1, to: it.t2, key: ta.key });
        deliverDamage(state, {
          amt: eff.amt, type: eff.type, source: m, via: eff.via, pierce: eff.pierce || {}
        }, it.t2, { reason: '镜面反射·' + R.byKey[ta.key].name });
      } else {
        /* v1.5.16（用户裁定）：**没有"无可复制"** —— 所有技能都能复制。非伤害类技能的效果
         * 落在**使用者自己身上**（"相当于自己也摆了那个架势 / 也蓄了能 / 也架了雷"），
         * 同时对 t2 只留一个**空指**：指向保留、本身不产生效果，但它**参与大雷连带判定**
         * （已在 ③ 的快照里用 snapT2 接上）。 */
        ev(state, { type: 'mirrorCopySelf', pid: m, from: it.t1, to: it.t2, key: ta.key });
        applyMirrorSelf(state, m, ta);
      }
    }
  }

  /* N14：把复制到的"非伤害类"技能的自效果施加到镜面反射使用者自己身上。
   * ⚠ 这张 switch 必须与 `resolveActions` ④ 的自效果保持同步 —— 技能表里新增一个"有自效果"的
   *   技能时，要么它可复制伤害（`copyEffect` 非空），要么在这里补一行。`np-test D23` 用
   *   `R.MIRROR_SELF` 对全部技能做**穷举守门**（漏一个就红，不留静默的"复制了等于没复制"）。 */
  function applyMirrorSelf(state, m, ta) {
    const me = state.p[m];
    switch (ta.key) {
      case SK.JI: me.ep += 1; ev(state, { type: 'ep', pid: m, delta: 1 }); break;
      case SK.CHARGE: {
        /* 珠类型取**使用者自己**的选择（镜面反射那张卡的 opt.bead），**不读 t1 的 opt**：
         * t1 蓄的哪种珠是隐藏信息（v1.5.15 刚修掉的信息泄漏）⇒ 读它等于给复制者开天眼。 */
        const ma = actionOf(state, m);
        const kind = (ma && ma.opt && ma.opt.bead) || 'elec';
        me[kind] = 1; me.beadNew = kind;
        ev(state, { type: 'bead', pid: m, kind, delta: 1 });
        break;
      }
      case SK.RING: {
        me.ringStreak += 1;                                   // 与 attemptAction 同口径：出招即计次
        const g = me.ringStreak >= 3 ? 3 : me.ringStreak;      // R10：第1次+1 / 第2次+2 / 第3次起+3
        me.ep += g; ev(state, { type: 'ep', pid: m, delta: g });
        break;
      }
      case SK.MINE: armMine(state, me, m); break;
      /* 避雷针：得到免雷窗口（同 R31 情形B，一次性：免掉一次雷后窗口结束）。
       * ⚠️ v1.5.18：**不需要**把它提前到 ② 之前 —— 复制成立的**前提**是 t1 本回合真的用了避雷针，
       * 而 ① 层"当回合有雷系 ⇒ 全部无效"已经把本回合的雷清空了 ⇒ 复制来的窗口本回合无物可挡。
       * 论证与守门见 `mirrorPass` 上方的长注释与 `np-test D31`。 */
      case SK.ROD: me.rodGuard = 4; ev(state, { type: 'rod', pids: [m], mode: 'B' }); break;
      case SK.PURIFY: purgeSelf(state, me, m); break;
      default: {
        /* 防御族（含复制全息屏障 = 原型制御式自保架势）。
         * 架势**不在这里才生效**：`guardOf` 通过 effectiveKeyOf() 直接读"复制内容"，
         * 所以它在声明的那一刻就已生效（这正是用户例子里 a 能靠复制来的反弹挡住同回合大雷的原因）。
         * 这里的 ev 只用于日志/页面；`guardNext` 那行是 R21 无极变速的第二回合八卦阵。
         * 藤甲的"贴在对手身上使其火弱"属对外效果 ⇒ 按 N14 不复制（空指不产生效果）。 */
        const gk = copiedGuardKind(ta.key);
        if (gk && !me.copiedGuard) {
          /* 防御族通常已经在 ④ 之前的 `mirrorGuardPass` 落位（"同优先级防御类先出现"）；
           * 这里只兜底（t1 的行动后来才成立的边角情形），也避免重复发 guardSet 事件。
           * v1.5.17：架势**在结算时落到状态上**（`guardOf` 读 `copiedGuard`），所以它挡得住
           * 随后结算的 ⑤ 枪 / ⑥ 狙击 与同优先级的 ④ 攻击，挡不住先前结算的小雷 / 大雷。 */
          me.copiedGuard = ta.key;
          if (ta.key === SK.SHIFT) me.guardNext = true;
          ev(state, { type: 'guardSet', pid: m, key: ta.key, copied: true });
        }
        break;
      }
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
        setVoid(state, t, SK.MINI_T, c);   // v1.5.37：带施法者 pid（奖励可归因）
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
     * （实测 P0→P1/P1→P2/P2→P0 结果 HP 3/1/1）。落地仍按实际结算。
     * v1.5.17 撤回 v1.5.16 在这里加的 snapT2（"空指参与连带"）：按用户二次裁定，
     * 大雷先结算 ⇒ 目标若用镜面反射会被无效化 ⇒ 那个"空指"根本不会产生 ⇒ 不该参与连带。 */
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
      /* 效果2：非防御类技能一律无效化；双大雷互轰时各自保留。
       * v1.5.17（用户二次裁定）：镜面反射**不算防御族** ⇒ 被大雷打中时和别的非防御技能一样被废掉，
       * 复制随之不会发生（v1.5.16 曾按"有效技能"豁免它，那是错的）。 */
      if (!bothBig && ta && R.GUARD_FAMILY.indexOf(ta.key) < 0 && ta.key !== SK.MINI_T) {
        setVoid(state, t, SK.BIG_T, c);   // v1.5.37：同上
      }
      // 记录目标当面架势（用于 R23'：原型制御挡电但不免疫禁用）
      const guardKind = (guardOf(state, t) || {}).kind;
      /* N22（用户裁定）：**所有防御类都能格挡大雷**；而大雷属"反弹可格挡但不触发反弹"——
       * 实现方式：去掉 pierce.reflect（那是"反弹整个失效"），靠 BIG_T 不在 REFLECTABLE 里
       * 使反弹只格挡、不反击。pierce.transfer 表示大雷伤害不可被转移。 */
      const res = deliverDamage(state, {
        amt: 2, type: R.DMG.ELECTRIC, source: c, via: SK.BIG_T, pierce: { transfer: true }
      }, t, { reason: '真正的落雷' });
      // N6 连带伤害（**用户裁定 N22：各受 2 点**）：与目标 T 产生交互的第三方各受 2 点电伤；
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

    // ====== ④ 之前：镜面反射复制来的**防御架势**（v1.5.17 用户三次澄清：同优先级里防御类先出现）======
    mirrorGuardPass(state);

    // ====== ④ 默认优先级 3 ======
    /* v1.5.106（**用户裁定** 2026-09-18）：**资源型（`cat === ENERGY` ⇒ ジ / 蓄能 / 聚能环）在本层内先结算**，
     * 过载炮随后 ⇒ 过载炮第 3 次的「清空目标ジ」能吃到目标**本回合刚生的收入**。
     * 病（第十一轮复核 §10-4 实测）：本层原先一律按 `turnOrder` 的座位轮换序 ⇒ **同一发炮效果差 3 ジ**
     * （炮手 0 号先手 ⇒ 只吃到 6；炮手 3 号后手 ⇒ 目标 9 ジ 全没）⇒ "谁先手"成了**座位红利**。
     * 口径**从声明推导**（`R.byKey[key].cat`）—— 不许写卡名清单（D81/D72 的教训）。
     * ⚠️ 两组**各自**仍按 `turnOrder`（座位轮换）⇒ 反座位偏置的随机化只在**跨组**顺序上被固定、
     * 组内仍然轮换（两个资源型同时出手时仍会换先后）。 */
    const ord3 = (function () {
      const inc = [], oth = [];
      for (const i of turnOrder(state)) {
        const a0 = actionOf(state, i);
        const isEnergy = !!(a0 && R.byKey[a0.key] && R.byKey[a0.key].cat === R.CAT.ENERGY);
        (isEnergy ? inc : oth).push(i);
      }
      return inc.concat(oth);
    })();
    for (const i of ord3) {
      const a = actionOf(state, i);
      if (!a || (R.byKey[a.key].pri || 3) !== 3) continue;
      /* v1.5.37：**撤销 v1.5.34 的 holo 特例**。复核 §2-1 证明它与引擎语义冲突：
       * `holoShieldFrom` 明写"自己给自己套不算"（这张卡本来就只能给别人），
       * 而我那版"无目标=自己"在声明阶段就被 `targetOf()` 退成"第一个存活对手"，
       * 且候选集里的"自己"成了幻影选项（被选中 35/330 次，喂错归因）。
       * ⇒ 恢复引擎原语义（`oppOf`；无目标本次不出），改为在**候选枚举**侧删掉幻影。 */
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
        case SK.MINE: armMine(state, me, i); break;
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
            /* v1.4.7 修正：第二发原写死 amt:1 / NORMAL / 不带 pierce，与上面"走数据表"的注释矛盾 ——
             * 改 byKey.dualGun.dmg.amt 只会影响第一发（第十轮复核 §6-2 用内存改表验证：
             * 事件从 1:1/2:1 变成 1:2/2:1）。调平衡"半静默无效"正是 v1.3.19 那一类。
             * 双枪 = "对两个角色同时使用枪" ⇒ 两发必须完全同源，故直接复用 dgDmg。 */
            deliverDamage(state, Object.assign({}, dgDmg), t2, { reason: '双枪射手' });
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
          /* v1.5.18 修（第三方复核 R2 顺带查出的真实偏差）：电磁炮在 `R.LIGHTNING` 里
           * （避雷针回馈 / 大雷传导口径都读那个集合），但它的投递**从来不查 `rodGuard`**
           * ⇒ 避雷针的"三回合免雷窗口"对电磁炮无效（只有"当回合情形 A 的全场无效"能挡它）。
           * 与 ② 小雷 / ③ 大雷 同口径：有窗口 ⇒ 消耗掉、无效化攻击者、打不中。 */
          if (state.p[t] && state.p[t].rodGuard > 0) {
            state.p[t].rodGuard = 0;
            setVoid(state, i, '避雷针');
            ev(state, { type: 'rodBlock', pid: t, by: SK.RAILGUN });
            break;
          }
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
          /* v1.5.107（**用户报的 UI bug 的真正根因**）：天火**不需要选目标** ——
           * README「使三回合内你贴出的符咒引爆，每个符咒造成 1 点火焰伤害」；
           * `RULES-2P.md:240`「引爆你贴出且停留≤3 个你的回合的**所有**符咒：**每个目标**每枚符咒受 1 火伤害」；
           * `RULES-NP.md:322` 把天火列进「**仅空指**（效果本身都是状态附加）」。
           * 原实现只打 `you = state.p[t]`（**那一个选中的目标**），而卡面又声明 `target: 'enemy'`
           * ⇒ UI 会弹目标选择、AI 会对每个对手各造一个候选 ⇒ 三处同错。
           * 改法：**全场遍历**，对每个存活角色身上 `owner === i && age <= 3` 的符咒各造成 1 火伤；
           * **原型制御按每个受害者各自判定**（R36：只有原型制御挡天火）；符咒引爆后仍存在（不删）。
           * ⚠️ **不要**给它加 `source`（v1.5.107 首版我加过，被用户当场纠正）：天火是**无目标**技能 ⇒
           * 它的引爆伤害是**无目标伤害**，**不参与大雷连带传导**（连带判定的输入是"这回合对 T 产生了交互的人"，
           * 见本文件 :748-773 的 N6/N22）。`source:null` 是**规则语义**，不是遗漏。
           * （副作用记录在案：`source==null` 同时是"终局收缩"的哨兵口径 —— 那是 `tools/audit-lib.mjs`
           * 的量具问题，**要在量具侧收紧**，不许反过来改规则。） */
          let n = 0;
          for (let v = 0; v < playerCount(state); v++) {
            if (v === i) continue;
            const holder = state.p[v];
            if (!holder || holder.hp <= 0) continue;
            const pg = guardOf(state, v);
            const protoBlock = pg && pg.kind === 'proto';
            for (const st of holder.stickers.slice()) {
              if (st.owner === i && st.age <= 3) {
                n++;
                if (!protoBlock) rawDamage(state, v, 1, '天火', 'firestorm', { type: R.DMG.FIRE });
                else {
                  /* v1.5.117：天火的伤害**无来源**（R57/用户裁定）⇒ 按用户口径它**计入原型制御的"伤害总数"**
                   * （"可以生效且会被挡住的伤害"），但**决算时不会被反**（没得可反）。 */
                  protoNote(state, v, null, 1, R.DMG.FIRE, 'firestorm');
                  ev(state, { type: 'blocked', to: v, by: '原型制御', amt: 1, via: 'firestorm' });
                }
              }
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
        case SK.JINSHIELD: case SK.ARMOR: case SK.PROTO:
          /* v1.5.108（**用户裁定 2026-09-18** = R58）：藤甲改成"**本回合贴上 → 下回合结束才消失**"的 buff
           * ⇒ **同时点亮 Now 与 Next**：
           *   · `fireWeakNow`  ⇒ **本回合**就吃火伤 +1（原实现只给 Next ⇒ 当回合白贴）；
           *   · `fireWeakNext` ⇒ 回合开始被提升为 Now（本文件 :125）⇒ **下回合**继续 +1；
           *   · 到期由既有机制自然完成：回合末清 `fireWeakNow`（:1151），而 Next 在回合开始就已消费
           *     ⇒ **第三回合起失效**。
           * 依据（旧文）：`RULES-2P.md:159` R22"仅在下回合内有效" —— 那是把藤甲当纯预置 debuff 的写法，
           * 用户认为它应当**多覆盖一回合**（贴上就被利用）。
           * ⚠️ 诚实边界：本层是**顺序结算**，同回合内**先于**藤甲结算的火伤吃不到这次 +1（R56 同款边界）。 */
          if (a.key === SK.ARMOR) { you.fireWeakNext = true; you.fireWeakNow = true; }
          ev(state, { type: 'guardSet', pid: i, key: a.key });
          break;
        case SK.HOLO:
          /* v1.5.4：屏障是套在**目标**身上的（不是施放者自己的架势）⇒ 记一条独立事件，
           * 免得日志/页面把它读成"施放者摆了个架势"（那正是修正前的语义）。 */
          ev(state, { type: 'holoSet', pid: i, target: t });
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
    /* v1.5.13 修 bug（用户对局记录第 16 回合发现）：**"狙击被干扰"的判定口径错了**。
     * 旧实现只看"**目标**这回合用了什么技能"：
     *     const ta = actionOf(state, t);
     *     if (ta && (ATK_EFFECT.indexOf(ta.key)>=0 || ta.key===SK.TRANSFER)) 无效;
     * 它**不看那技能打谁** ⇒ 多人局里目标用枪打第三个人，也会把狙击手的枪废掉。
     * 原始 README 特殊 2 的原话是「若被作用者或其余玩家对**该玩家**使用其它带攻击效果技能则狙击无效」
     * （"该玩家" = 狙击手本人），特殊 3 的爆头条件同样写"被作用者的技能对**攻击者**没有影响"。
     * 2 人局看不出差别：只有两个人 ⇒ 目标的枪必然指向狙击手，旧实现恰好等价（所以 spec R13/57 一直绿）。
     * 现在改成与规则一致：**只有当狙击手本人被别人的攻击类技能指向时才无效**。 */
    const aimedAt = function (st, who) {           // 谁这一回合用攻击类技能指向了 who？
      for (const j of turnOrder(st)) {
        if (j === who) continue;
        const ja = actionOf(st, j);
        if (!ja) continue;
        if (ja.key !== SK.TRANSFER && R.ATK_EFFECT.indexOf(ja.key) < 0) continue;
        if (targetOf(st, j) === who) return j;
      }
      return null;
    };
    for (const i of turnOrder(state)) {
      const a = actionOf(state, i);
      if (!a || a.key !== SK.SNIPE) continue;
      const t = targetOf(state, i);
      if (t == null) continue;
      if (aimedAt(state, i) != null) { setVoid(state, i, '狙击被干扰'); continue; }
      const res = deliverDamage(state, {
        amt: 1, type: R.DMG.NORMAL, source: i, via: SK.SNIPE, pierce: R.byKey[SK.SNIPE].pierce
      }, t, { reason: '狙击枪' });
      if (res.result === 'land') {
        /* 爆头：**被击方**的技能对狙击手没有影响才可判定（原始特殊 3）—— 注意这里只看被击方本人，
         * 与上面的"被干扰"（任何人都能干扰）是两个不同口径。 */
        const ta = actionOf(state, t);
        const affect = !!ta && (ta.key === SK.TRANSFER || R.ATK_EFFECT.indexOf(ta.key) >= 0) && targetOf(state, t) === i;
        if (!affect && judge3(state)) {
          rawDamage(state, t, 1, '爆头', 'headshot', {});   // R45：铁索共享爆头（文档口径）
          ev(state, { type: 'headshot', pid: i, to: t });
        }
      }
    }

    // ====== ⑥b 净化 pri1（清除自身状态与符咒；v1.5.110 R60：清单扩到**全部持续状态**）======
    for (const i of turnOrder(state)) {
      const a = actionOf(state, i);
      if (!a || a.key !== SK.PURIFY) continue;
      purgeSelf(state, state.p[i], i);   // 唯一写入点（见 purgeSelf 的注释）
    }

    mineResolveAll(state);   // N20：所有伤害结算完，统一按「直接优先」结地雷
    protoReflectAll(state);  // v1.5.117：然后裁决原型制御的"≥3 各自转移"（要看完全部可挡伤害才算）
  }

  /* ---------- 回合结束 ---------- */
  function endTurn(state) {
    const acts = state.actions;
    // 连击计数
    for (let i = 0; i < playerCount(state); i++) {
      const p = state.p[i];
      const a = acts[i];
      /* v1.5.105（用户实盘 bug，`results/epirus-battle-26回合.txt:52-64`）：**被无效化的聚能环不算"续"**。
       * 病：`state.js:191` 是"**出招即计次**"（`p.ringStreak++`），而这里原先只看 `outcome === 'ok'`；
       * `setVoid`（本文件 :22-29）**只置 `voided`、不动 `outcome`** ⇒ 被小雷废掉的那次环
       * 既没复位、又已经进过位 ⇒ **打断方每回合花 2 ジ，反把受害方的连击推到 +3 档**
       * （而且第 2 次起环费为 0）⇒ 现行规则下"打断环"对打断者是严格亏损动作。
       * 修：与 `actionOf`（:15-18）**同口径**加 `!a.voided`。
       * ⚠️ 注意区别：**过载炮**有明文 R43"被无效化仍计入次数"（`state.js:190` 的 `p.cannonCount++`，用户裁定）⇒ 那条**不动**；
       * 聚能环**没有**对应明文，按原版"连续使用"的语义，被废的那次不该算"用成了"。 */
      if (!(a && a.outcome === 'ok' && !a.voided && a.key === SK.RING)) p.ringStreak = 0;
      /* v1.5.129（**R61**，用户裁定：与 R10 同族）：**被无效化的一手不算"最后用过的招"**。
       * 病（第三方复核 `docs/REVIEW-QODER-2026-09-19.md` §2-1）：`setVoid`（本文件 :22-29）只置
       * `voided`、**不动** `outcome` ⇒ 这一行原来看不出差别，于是"被雷击之枪废掉的那一手"照样写进
       * `lastSkill`，喂给两个真实下游：
       *   ① **R32 激光眼连续使用**（`state.js:118-123` 读 `p.lastSkill === SK.LASER_EYE` ⇒ 只收 2 ジ、
       *      且不再需要爆破珠）—— 等于"**被打断反而白送一次连用**"；
       *   ② 特征块（`policy.js:209-212` / `:259-260` 的 `idxOf/catOf/priOf(me.lastSkill)` 与
       *      "本回合出过招"那一位）—— 会读到一手**根本没发生**的动作。
       * 这与 R10 那条（被无效化的**聚能环不续计**，D91 只钉了环那一半）是同一个病的另一半。
       * 修：与 `actionOf`（本文件 :15-18）**同口径**加 `!a.voided`。
       * ⚠️ 边界：**过载炮**有明文 R43"被无效化**仍**计入次数"（`state.js:190`，用户裁定）⇒ 那条**不动**；
       *    失败/买不起的一手本来就带 `outcome!=='ok'`（`state.js:156` 的 `fail()`）⇒ 行为不变。 */
      p.lastSkill = (a && a.outcome === 'ok' && !a.voided) ? a.key : null;
      /* v1.5.109（R59，用户裁定）：地雷计时 —— 回合末递减，减到 0 就卸下。
       * 语义：埋下的那一回合记 3，回合末 → 2（仍在，本回合有效）；后两回合末 → 1 → 0（卸下）
       * ⇒ **武装覆盖"当前回合 + 其后两个回合"共 3 个回合**，第三回合结束后失效。 */
      if (p.mineTurns > 0) {
        p.mineTurns -= 1;
        if (p.mineTurns <= 0) { p.mineTurns = 0; p.mineArmed = false; ev(state, { type: 'mineExpire', pid: i }); }
      }
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
    /* N25 终局收缩（突然死亡）：到 `suddenDeath` 回合后，每回合末**全员** −1 血。
     * · bypassGuards ⇒ 不被 防御/反弹/原型/金刚盾/全息 挡（这是"场地收缩"，不是攻击）；
     * · noMine ⇒ 不触发地雷；source=null ⇒ 不计入任何人的"造成伤害"（但计入各自承伤）。
     * 这样终局由"谁活到最后"决定，而不是"哨声时谁血多"（第十轮复核 §5.1）。 */
    /* v1.5.10（用户裁定）：阈值走**全局规则** `R.SUDDEN_DEATH`，模式可用自己的 `suddenDeath` 覆盖
     * （写 0 = 该模式关掉）。此前只有 long 模式带这个字段 ⇒ standard/multi 完全没有终局收缩。 */
    const sdOn = (state.mode && state.mode.suddenDeath != null) ? state.mode.suddenDeath : (R.SUDDEN_DEATH || 0);
    /* v1.5.11：每回合扣多少血也可调（模式 `suddenDeathDmg` → 全局 `SUDDEN_DEATH_DMG`） */
    const sdDmg = (state.mode && state.mode.suddenDeathDmg != null) ? state.mode.suddenDeathDmg : (R.SUDDEN_DEATH_DMG || 1);
    if (sdOn > 0 && state.round >= sdOn) {
      for (let i = 0; i < playerCount(state); i++) {
        const p = state.p[i];
        if (p.hp <= 0) continue;
        if (state.round === sdOn && i === 0) ev(state, { type: 'hidden', name: '终局收缩' });
        deliverDamage(state, { amt: sdDmg, type: R.DMG.NORMAL, source: null, bypassGuards: true, noMine: true }, i, { reason: '终局收缩' });
      }
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
    if (alive.length === 0) {
      /* v1.5.65：**全灭改按"累计造成伤害"判胜**（并列才平局）。
       * 病：multi 的终局收缩（本版起 `suddenDeath = 45`）在"没人互相打"的场里会**同时**清场
       * ⇒ 旧口径一律平局 ⇒ 实测"4 席只ジ vs 1 席冠军" 40 局 **0 胜 / 40 平**、回合恒 47
       * ⇒ "不打"零代价、场 B（惩罚纯攒钱）的严格胜率上限恒为 0。
       * 修：全灭时取**累计造成伤害最多者**（`damage` 事件的 `source`，与 `evo.rankOf` 的第 4 键同源），
       * 并列仍平局。于是"打了人"才可能被判胜 ⇒ 攻击有回报、拖时间不再免费。 */
      state.over = true;
      const dealtSum = new Array(N).fill(0);
      for (const e of (state.events || [])) {
        if (e.type === 'damage' && e.source != null && dealtSum[e.source] != null) dealtSum[e.source] += e.amt;
      }
      let bv = 0, bp = null, tie = false;
      for (let i = 0; i < N; i++) {
        if (dealtSum[i] > bv) { bv = dealtSum[i]; bp = i; tie = false; }
        else if (dealtSum[i] === bv) tie = true;
      }
      state.winner = (bp != null && !tie) ? bp : 'draw';
      return true;
    }
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
    startTurn, resolveActions, endTurn, checkOver, turnOrder,   // v1.5.53: 导出供守门直接测（纯函数）
    oppOf, saltPick,                                            // v1.5.54: 同上（默认作用者的可测入口）
    rawDamage, deliverDamage, guardOf, judge, judge3, actionOf, setVoid,
    protoNote, protoReflectAll,   // v1.5.117：原型制御"≥3 各自转移"的记账与决算（供 spec 直测）
    /* v1.5.19：把"技能→架势种类"的两个真源也导出 —— 特征侧（js/train/policy.js）要看
     * "自己身上是什么架势 / 对手镜面反射复制到了什么"。**不许在 policy.js 里重写一遍 switch**：
     * 本项目"两处各写一遍"已栽过四次（见 docs/METHODOLOGY.md 第 13 条）。 */
    guardKindOfKey, copiedGuardKind, mirrorRefs, mirrorSelfKey
  };
})(typeof window !== 'undefined' ? window : globalThis);
