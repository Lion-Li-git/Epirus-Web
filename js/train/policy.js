/* Epirus — 策略网络 v7：**状态-动作值网络**（零依赖）。
 * 旧版是“每个动作一个 logit、共享同一状态向量”，学不到“按局面选招”。
 * 现在：s = 状态特征，a = **候选**特征；对每个**候选**拼 [s,a] → 小 MLP → 标量，softmax 选候选。
 *
 * v7（v1.5.19，"一次性加全"）三件事，互相配套（见 docs/PARAMS-PLAN.md 与 HANDOFF §3）：
 *  ① **候选 = (技能, 目标, 珠类型)**，不再只是技能 key —— 于是"打谁"和"蓄哪种珠"进了网络
 *     （此前目标是 evo.js 的固定启发式、珠类型是 play.js 写死的 `elec>boom?'boom':'elec'`）。
 *  ② **动作特征 +8**：珠类型 2 + 目标相对 6 ⇒ 同一技能的不同候选才可区分（否则输入逐位相同 ⇒ 永远同分）。
 *  ③ **状态特征 +75**：
 *     · T 关系块（15）：每个玩家的"上一手指向自己/我/别人" —— 让 (actor, skill, target) 三元组可见；
 *     · B 效果快照块（60）：每个玩家 × **12 个"能产生持续效果的技能"各一维**，值=强度/剩余、
 *       符号表示**自己施加(+)/他人施加(−)**（镜面反射复制来的架势、全息套的盾自动落在这里）。
 *     ⇒ "谁身上挂着什么 buff、谁给的"由**一张通用表**生成，不是每加一个 buff 手写一维；
 *       **含义**（反弹架势意味着枪会被弹回）仍然交给网络学。见 docs/METHODOLOGY.md 第 23 条。
 *  · 所有新维度**一律追加在末尾** ⇒ 旧包（v5/v6）用 `shapeOf` 反推形状后按前缀裁剪仍可评测；
 *    游戏侧 `checkPack` 依旧严格（线上包必须重训重发）。
 *  · **实验掩码** `setFeatMask('bead,target,effects,rel')`：形状不变（同一 PACK_VERSION/paramCount），
 *    所以"去掉某几块再加训一版"不必再动版本与包格式。
 */
(function (global) {
  'use strict';
  const R = global.EpirusRules;
  const S = global.EpirusState;
  const X = global.EpirusResolve;      // v7：架势/"技能→效果"的唯一真源在 resolve 侧
  const SK = R.SK;

  // 动作集 = 全部技能（含多人专用 双枪/镜面）；2 人局它们不在 legal 里，不会被选中。
  // 参数维度由 FEAT_N 决定（与 A 无关），故不影响旧冠军包。
  const ACT_KEYS = R.skills.map(function (s) { return s.key; });
  const A = ACT_KEYS.length;
  const HID = 24;
  const OPP_SLOTS = 4;   // v5：最多 5 人局的对手槽位数
  const HIST_K = 3;      // v5：最近 K 步技能历史
  const CAT3 = { energy: 0, attack: 1, defense: 2, special: 3 };
  const PLAYER_SLOTS = OPP_SLOTS + 1;   // v7：自己 + 4 个对手位（T/B 两块按这个数铺开）
  const FEAT_S_V6 = 123;                // v6 的状态维数（历史常量）：v5/v6 包裁剪时的**前缀长度**

  /* ===== v7 · B 块「持续效果快照」的**唯一真源**（14 条）=====
   * 每条 = 一个"能产生持续效果"的东西 + 「怎么从玩家对象读出强度」+「是否他人施加」。
   * **加一个新 buff = 这里加一行**（引擎侧字段本来就存在于 `js/core/state.js` 的 freshPlayer）。
   * 值域约定：0 = 没有；**正 = 自己施加 / 负 = 他人施加** —— 符号本身是信息
   * （"我自己摆的反弹" 与 "镜面反射复制来的反弹" 在真人局里是两回事）。
   * ⚠️ 这里**只报事实**（挂了什么、还剩多少、谁给的），**不判断好坏** —— 含义是网络要学的东西。
   * ⚠️ 与 `js/ui/ui.js` 的状态徽章清单是同一批事实；UI 侧将来应改为消费此表（避免"两处各写一遍"）。 */
  const EFFECTS = [
    ['guardCarry',  false, function (p) { return p.baguaExtra ? 1 : 0; }],                              // 无极变速/架势延续 R21
    ['guardPrev',   false, function (p) { return p.guardNext ? 1 : 0; }],                               // 上回合摆过防御架势
    ['copiedGuard', true,  function (p) { return p.copiedGuard ? 1 : 0; }],                             // N14 复制来的架势（他人技能）
    ['rodGuard',    false, function (p) { return Math.min(p.rodGuard || 0, 3) / 3; }],                  // R31 避雷针免雷窗口（剩余）
    ['fireWeak',    false, function (p) { return (p.fireWeakNow || p.fireWeakNext) ? 1 : 0; }],         // R22 藤甲火弱
    ['mine',        false, function (p) { return p.mineArmed ? 1 : 0; }],                               // R38 地雷已布
    ['tauntActive', false, function (p) { return p.tauntActive ? 1 : 0; }],                             // R41/R54 被挑衅
    ['tauntPend',   false, function (p) { return p.tauntPending ? 1 : 0; }],                            // 已宣告、待结算
    ['nightmare',   false, function (p) { return p.nightmare ? 1 : 0; }],                               // R50 梦魇
    ['vampire',     false, function (p) { return p.vampire ? 1 : 0; }],                                 // R47 吸血鬼公爵
    ['revive',      false, function (p) { return p.reviveNext ? 1 : 0; }],                              // R48 回魂
    ['infinite',    false, function (p) { return p.infiniteEnergy ? 1 : 0; }],                          // 回魂·无限能量
    ['stickers',    true,  function (p) { return Math.min(p.stickers ? p.stickers.length : 0, 4) / 4; }], // R34/R44 符咒（他人贴的）
    ['chains',      true,  function (p) { return Math.min(p.chains ? p.chains.length : 0, 3) / 3; }]     // R45 铁索（他人连的）
  ];

  /* ===== v7 · 实验掩码（**只改特征取值，不改形状**）=====
   * `setFeatMask('bead,target')` = 只开这两块、其余恒 0（等价于"没有这些特征"），
   * 但 `PACK_VERSION` / `paramCount` / 包格式**一字不变** ⇒ 对照臂不必再升版本、不必重发包格式。
   * 传 null/undefined/'all' = 全开（默认）。 */
  let MASK = { bead: true, target: true, effects: true, rel: true };
  const MASK_KEYS = ['bead', 'target', 'effects', 'rel'];
  function setFeatMask(spec) {
    if (spec == null || String(spec).trim() === '' || String(spec).trim() === 'all') {
      MASK = { bead: true, target: true, effects: true, rel: true };
      return Object.assign({}, MASK);
    }
    const want = {};
    String(spec).split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      .forEach(function (s) { if (MASK_KEYS.indexOf(s) >= 0) want[s] = true; });
    const next = {};
    MASK_KEYS.forEach(function (k) { next[k] = !!want[k]; });
    MASK = next;
    return Object.assign({}, MASK);
  }
  function featMask() { return Object.assign({}, MASK); }

  function catOf(key) { return key ? (CAT3[R.byKey[key].cat] + 1) / 4 : 0; }
  function priOf(key) { return key ? (R.byKey[key].pri || 3) / 5 : 0; }
  function idxOf(key) { return key ? R.skills.findIndex(function (s) { return s.key === key; }) / R.skills.length : 0; }
  function cdCount(p) { return Object.keys(p.cooldown).filter(function (k) { return p.cooldown[k] > 0; }).length; }

  /* ---- N 人：对手聚合（N=2 时退化为唯一对手，保证 2 人冠军特征不变） ----
   * minHp = 最脆对手血量；maxEp = 最大能量；threat = 能量最高的对手（用它的 lastSkill 类特征）；
   * any(f) = 任一对手满足（威胁信号）；sum(f) = 对手求和。 */
  function oppAgg(state, pid) {
    const opps = [];
    for (let i = 0; i < state.p.length; i++) {
      if (i !== pid && state.p[i].hp > 0) opps.push(state.p[i]);
    }
    if (!opps.length) {
      for (let i = 0; i < state.p.length; i++) { if (i !== pid) { opps.push(state.p[i]); break; } }
    }
    let minHp = Infinity, maxEp = -1, threat = opps[0];
    for (const o of opps) {
      if (o.hp < minHp) minHp = o.hp;
      if (o.ep > maxEp) { maxEp = o.ep; threat = o; }
    }
    if (minHp === Infinity) minHp = 0;
    if (maxEp < 0) maxEp = 0;
    return {
      n: opps.length,
      minHp: minHp,
      maxEp: maxEp,
      threat: threat,
      any: function (f) { let m = 0; for (const o of opps) { const v = f(o); if (v > m) m = v; } return m; },
      sum: function (f) { let t = 0; for (const o of opps) t += f(o); return t; }
    };
  }

  /* ---- v5：对手槽位（存活 → 血量升序 → pid，稳定排序：槽 0 = 最可能被杀的）---- */
  /* v1.5.51：**每次决策内一次**的随机键（用于并列排序），按 state+round 缓存。
   * 同一决策内所有调用（featuresV7/actionFeatures/多候选打分）拿到同一组键 ⇒ 特征一致；
   * 跨决策重新洗牌 ⇒ 与 pid、回合都不可预测 ⇒ 学不出"打槽位 0"的习惯。 */
  let SLOT_RAND = { state: null, round: -1, keys: null };
  function slotRand(i) {
    if (!SLOT_RAND.keys) { SLOT_RAND.keys = {}; for (let k = 0; k < 8; k++) SLOT_RAND.keys[k] = __rng(); }
    return SLOT_RAND.keys[i] != null ? SLOT_RAND.keys[i] : (SLOT_RAND.keys[i] = __rng());
  }

  function oppSlots(state, pid) {
    if (SLOT_RAND.state !== state || SLOT_RAND.round !== state.round) {
      SLOT_RAND = { state: state, round: state.round, keys: null };
    }
    const a = [];
    for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) a.push(i);
    /* v1.5.51（复核 §3 + 本会话实测）：并列**不得有任何确定性的身份映射**。
     * 历史与实测：
     *   · 旧版 `x - y`（pid 升序）⇒ 开局同血时"槽位 0"永远是 0 号座 ⇒ 上线冠军 **0 号座夺冠 81%**；
     *   · v1.5.46 改成"按回合起点轮转" ⇒ **仍不对**：每回合"回合起点玩家"占所有人的槽位 0，
     *     策略学出"打槽位 0"⇒ **回合起点被集火**；而第 1 回合的起点就是 0 号座 ⇒
     *     实测 0 号座**死亡次数 45~48/50（其他座 34~42）、夺冠率 3~9%**（提高温度也不消失 ⇒ 非协调假象）。
     * 正解（L7 教训的完整含义）：**槽位顺序必须不可预测** —— 并列用**每次决策内一次的随机洗牌**
     * （同一次决策内一致：按 state+round+pid 缓存；跨座位/回合不可预测：与 pid、回合都无关）。
     * 这样"打槽位 0"不再是可利用的习惯，各座对称。 */
    a.sort(function (x, y) { const d = state.p[x].hp - state.p[y].hp; return d !== 0 ? d : slotRand(x) - slotRand(y); });
    return a;
  }

  /* ---- v5：行动历史（从 events 反查，带决策级缓存）---- */
  const HIST_SCAN = 240;
  let histCache = { state: null, round: -1, evLen: -1, map: null };
  function skillHistory(state, pid, k) {
    const out = [];
    const from = Math.max(0, state.events.length - HIST_SCAN);
    for (let i = state.events.length - 1; i >= from && out.length < k; i--) {
      const e = state.events[i];
      if (e.type === 'action' && e.pid === pid && e.outcome === 'ok') out.push(e.key);
    }
    while (out.length < k) out.push(null);
    return out;   // out[0] = 最近一步
  }
  /* 连续同招：开头连续相同的比例 0..1 */
  function streakOf(h) {
    if (!h || !h.length || !h[0]) return 0;
    let n = 1;
    for (let i = 1; i < h.length; i++) { if (h[i] === h[0]) n++; else break; }
    return n / h.length;
  }
  function historiesFor(state, pid) {
    if (histCache.state !== state || histCache.round !== state.round || histCache.evLen !== state.events.length) {
      histCache = { state: state, round: state.round, evLen: state.events.length, map: {} };
    }
    if (!histCache.map[pid]) {
      const slots = oppSlots(state, pid);
      const opp = [];
      for (let i = 0; i < OPP_SLOTS; i++) opp.push(slots[i] != null ? skillHistory(state, slots[i], HIST_K) : []);
      histCache.map[pid] = { me: skillHistory(state, pid, HIST_K), opp: opp };
    }
    return histCache.map[pid];
  }

  /* ---- 状态特征（pid 视角，全部公开信息） ---- */
  function featuresV7(state, pid) {
    const me = state.p[pid];
    const agg = oppAgg(state, pid);
    const op = agg.threat;                 // 威胁最大的对手（N=2 时 = 唯一对手）
    const anyOp = agg.any;
    const hp = state.mode.hp;
    const curseOnMe = me.stickers.length;
    const curseByMe = agg.sum(function (o) {
      return o.stickers.filter(function (st) { return st.owner === pid; }).length;
    });
    const base = [
      me.hp / hp, agg.minHp / hp,
      Math.min(me.ep, 12) / 12, Math.min(agg.maxEp, 12) / 12,
      Math.min(me.elec, 1), Math.min(me.boom, 1),
      /* v1.5.15 修**信息泄漏**（用户报的 bug）：`蓄能` 选电珠还是爆珠**只有本人知道**，
       * 别人只知道"有人蓄能了" ⇒ 对手的珠**类型**绝不能进特征（原来这里是
       * `anyOp(o.elec) / anyOp(o.boom)`，等于把类型直接告诉 AI）。两个槽位保留、语义换成**公开信息**：
       * ①"有对手持珠（类型未知）" ②"有对手刚蓄能"。槽位数不变 ⇒ 老权重仍可加载（但行为会变，必须重测）。 */
      anyOp(function (o) { return (o.elec || o.boom) ? 1 : 0; }), anyOp(function (o) { return o.lastSkill === SK.CHARGE ? 1 : 0; }),
      idxOf(me.lastSkill), catOf(me.lastSkill), priOf(me.lastSkill),
      idxOf(op.lastSkill), catOf(op.lastSkill), priOf(op.lastSkill),
      // 「上一招无效」显式编码
      me.lastSkill ? 0 : 1, op.lastSkill ? 0 : 1,
      me.ringStreak / 3, anyOp(function (o) { return o.ringStreak; }) / 3,
      /* (a) 千问方案：**自己**是否正好跨得过聚能环启动线（费用 3）。
       * 价值不是"告诉它能攒"，而是让"跨过 3"成为可被 value 区分的**离散事件**——
       * 否则 ep 是连续输入，网络只能学出单调的"钱越多越好"，学不到"3 是质变点"。 */
      (me.ep >= 3 && me.ringStreak === 0) ? 1 : 0,
      (me.cannonCount % 3) / 3, anyOp(function (o) { return o.cannonCount % 3; }) / 3,
      Math.min(cdCount(me), 6) / 6, Math.min(anyOp(cdCount), 6) / 6,
      me.mineArmed ? 1 : 0, anyOp(function (o) { return o.mineArmed ? 1 : 0; }),
      me.tauntActive ? 1 : 0, anyOp(function (o) { return o.tauntActive ? 1 : 0; }),
      me.tauntPending ? 1 : 0, anyOp(function (o) { return o.tauntPending ? 1 : 0; }),
      Math.min(curseOnMe, 4) / 4, Math.min(curseByMe, 4) / 4,
      me.guardNext ? 1 : 0, anyOp(function (o) { return o.guardNext ? 1 : 0; }),
      me.baguaExtra ? 1 : 0, anyOp(function (o) { return o.baguaExtra ? 1 : 0; }),
      me.fireWeakNext ? 1 : 0, me.fireWeakNow ? 1 : 0,
      anyOp(function (o) { return o.fireWeakNext ? 1 : 0; }), anyOp(function (o) { return o.fireWeakNow ? 1 : 0; }),
      (me.chains && me.chains.length) ? 1 : 0, anyOp(function (o) { return (o.chains && o.chains.length) ? 1 : 0; }),
      me.nightmare ? 1 : 0, anyOp(function (o) { return o.nightmare ? 1 : 0; }),
      me.vampire ? 1 : 0, anyOp(function (o) { return o.vampire ? 1 : 0; }),
      me.vampHeal > 0 ? 1 : 0, anyOp(function (o) { return o.vampHeal > 0 ? 1 : 0; }),
      me.reviveNext ? 1 : 0, anyOp(function (o) { return o.reviveNext ? 1 : 0; }),
      me.infiniteEnergy ? 1 : 0, anyOp(function (o) { return o.infiniteEnergy ? 1 : 0; }),
      Math.min(me.rodGuard, 3) / 3, Math.min(anyOp(function (o) { return o.rodGuard; }), 3) / 3,
      /* v1.4.0：分母跟本局实际上限走 —— 5 血模式下 round/60 会超出 [0,1] 的训练分布。
       * multi 模式没有 maxRounds ⇒ 仍是 /60，已有冠军包的读数逐位不变。 */
      state.round / ((state.mode && state.mode.maxRounds) || R.MAX_ROUNDS),
      Math.max(-1, Math.min(1, (me.ep - agg.maxEp) / 12)),
      // ---- 前摇威胁（任一对手）----
      anyOp(function (o) { return (o.elec > 0 && o.ep >= 2) ? 1 : 0; }),   // 电磁炮前摇
      agg.maxEp >= 5 ? 1 : 0,                                              // 大雷前摇
      anyOp(function (o) { return ((o.boom > 0 && o.ep >= 1) || (o.lastSkill === SK.LASER_EYE && o.ep >= 2)) ? 1 : 0; }),
      anyOp(function (o) { return (o.ep >= 3 && o.ringStreak === 0) ? 1 : 0; }),
      agg.maxEp >= 2 ? 1 : 0,                                              // 穿透攻击前摇
      anyOp(function (o) { return o.lastSkill === SK.CHARGE ? 1 : 0; }),
      me.hp <= 1 ? 1 : 0,
      agg.minHp <= 1 ? 1 : 0
    ];
    // ---- v5 ①：每个对手一个槽位（10 维/槽 × 4）----
    const slotPids = oppSlots(state, pid);
    for (let si = 0; si < OPP_SLOTS; si++) {
      const opid = slotPids[si];
      const op = (opid != null) ? state.p[opid] : null;
      if (!op) { for (let z = 0; z < 10; z++) base.push(0); continue; }
      base.push(
        1,                                  // 存活
        op.hp / hp,                         // 各自血量（不再只有 min）
        Math.min(op.ep, 12) / 12,           // 各自ジ
        (op.elec || op.boom) ? 1 : 0, (op.lastSkill === SK.CHARGE) ? 1 : 0,   // v1.5.15：持珠（类型未知）/ 刚蓄能 —— 不再泄漏类型
        idxOf(op.lastSkill), catOf(op.lastSkill), op.lastSkill ? 0 : 1,
        op.ep >= 2 ? 1 : 0, op.ep >= 5 ? 1 : 0         // 穿透 / 大雷 前摇
      );
    }
    // ---- v5 ②：最近 K 步技能历史（自己 + 各槽位）+ 连续同招 ----
    const hist = historiesFor(state, pid);
    for (let t = 0; t < HIST_K; t++) base.push(idxOf(hist.me[t]));
    base.push(streakOf(hist.me));
    for (let si = 0; si < OPP_SLOTS; si++) {
      const h = hist.opp[si] || [];
      for (let t = 0; t < HIST_K; t++) base.push(idxOf(h[t] || null));
      base.push(streakOf(h));
    }
    /* ===== v7 新增：**一律追加在末尾**（旧包按前缀裁剪；插在中间会让 v6 前缀错位）=====
     * slotOf(i)：i=0 是自己，1..OPP_SLOTS 是 v5 那套"血量升序"的对手槽。空位填 0 ⇒ 长度恒定。 */
    const slotOf = function (i) { return i === 0 ? pid : slotPids[i - 1]; };
    // ---- T 关系块：上一手"谁对谁"——(actor, skill, target) 三元组里缺的 target 侧 ----
    for (let i = 0; i < PLAYER_SLOTS; i++) {
      const q = (slotOf(i) != null) ? state.p[slotOf(i)] : null;
      if (!q || !MASK.rel) { base.push(0, 0, 0, 0); continue; }
      const lt = (q.lastTarget != null) ? q.lastTarget : null;
      base.push(
        (lt === q.id) ? 1 : 0,                                // 指向自己 ⇒"自己给自己上架势/buff"
        (lt === pid) ? 1 : 0,                                 // 指向我
        (lt != null && lt !== q.id && lt !== pid) ? 1 : 0,    // 指向别人（多人局"他们互相在打"）
        idxOf(q.copiedGuard)                                  // ② 他这一手镜面反射复制到了哪张卡（0=没有）
      );
    }
    // ---- B 块：持续效果快照（值 = 强度/剩余；**符号 = 自施(+) / 他施(−)**）----
    for (let i = 0; i < PLAYER_SLOTS; i++) {
      const q = (slotOf(i) != null) ? state.p[slotOf(i)] : null;
      for (let e = 0; e < EFFECTS.length; e++) {
        if (!q || !MASK.effects) { base.push(0); continue; }
        const mag = EFFECTS[e][2](q);
        base.push(mag === 0 ? 0 : (EFFECTS[e][1] ? -mag : mag));
      }
    }
    return base;
  }
  /* ===== P0：旧版存档兼容 =====
   * 问题：FEAT_S/PACK_VERSION 是模块全局，一个进程只能有一种网络形状 →
   * 升 v6 后 7 个 v5 实验存档全变砖，A/B 工具链（econ-eval ③）直接失效，
   * 五次失败结论无法复现对照。
   * 解法（千问方案）：形状从 **params.length 反推**——
   *   paramCount = HID*FEAT_N + HID + HID + 1  ⇒  FEAT_N = (len - 2*HID - 1)/HID
   * v7 起**必须按表查**：v7 连 FEAT_A 也变了，只反推出 featN **无法决定"状态段/动作段"的切分点**
   * （切错 = 静默错位 —— 正是这套机制存在的理由）。表里列出每个历史版本的 (featS, featA)。
   * 于是同一进程可同时评测多代形状；**游戏侧 checkPack 仍严格拒绝**（只放宽工具侧 unpack）。 */
  const VER_SHAPES = [
    { v: 6, featS: FEAT_S_V6, featA: 14 },
    { v: 5, featS: FEAT_S_V6 - 1, featA: 14 }
  ];
  function paramsOf(featS, featA) { return HID * (featS + featA) + HID + HID + 1; }
  function shapeOf(params) {
    const n = params.length;
    if (n === paramCount()) return { v: PACK_VERSION, featS: FEAT_S, featA: FEAT_A, featN: FEAT_N, legacy: false };
    for (let i = 0; i < VER_SHAPES.length; i++) {
      const s = VER_SHAPES[i];
      if (n === paramsOf(s.featS, s.featA))
        return { v: s.v, featS: s.featS, featA: s.featA, featN: s.featS + s.featA, legacy: true };
    }
    const featN = (n - HID - HID - 1) / HID;
    if (featN > 0 && Number.isInteger(featN) && featN > FEAT_A)
      return { v: 0, featS: featN - FEAT_A, featA: FEAT_A, featN: featN, legacy: true };
    return null;
  }

  /* v5 特征向量 = v6 去掉"自己跨得过环启动线"那一维。
   * 下标用**运行时探测**而非硬编码：把 me.ringStreak 从 0 改到 3，
   * 唯一"由 1 变 0"的那一维就是它。 */
  let RING_SELF_IDX = -2;
  function ringSelfIdx() {
    if (RING_SELF_IDX !== -2) return RING_SELF_IDX;
    RING_SELF_IDX = -1;
    const mk = function (rs) {
      const st = S.createState('standard', { next: function () { return 0.5; } }, 2);
      st.p[0].ep = 3; st.p[0].ringStreak = rs;
      return featuresV7(st, 0);
    };
    const a = mk(0), b = mk(3);
    for (let i = 0; i < a.length; i++) if (a[i] - b[i] > 0.5) { RING_SELF_IDX = i; break; }
    return RING_SELF_IDX;
  }
  /* v7 的新维度全部追加在 123 之后 ⇒ 前缀 123 就是当年的 v6 向量（逐位相同）。 */
  function features(state, pid, featS) {
    const x = featuresV7(state, pid);
    if (featS == null || featS >= x.length) return x;
    if (featS === FEAT_S_V6) return x.slice(0, FEAT_S_V6);          // v6 包：砍掉全部 v7 新维度
    if (featS === FEAT_S_V6 - 1) {                                   // v5 包：再砍掉"跨得过环启动线"那一维
      const i = ringSelfIdx();
      const y = x.slice(0, FEAT_S_V6);
      if (i >= 0 && i < y.length) y.splice(i, 1);
      return y;
    }
    return x.slice(0, featS);
  }
  /* 一次决策里 `features()` 会被每个候选各调一次（旧代码就是这样）⇒ 加**决策级缓存**：
   * 候选数从 v6 的 ~10 涨到 v7 的 ~40-80，不缓存的话状态向量会被重算几十遍（v7 的 B 块还不便宜）。 */
  let MASK_STAMP = 0;
  let FV_CACHE = { state: null, round: -1, evLen: -1, key: '', stamp: -1, vec: null };
  function stateVec(state, pid, featS) {
    const k = pid + ':' + featS;
    if (FV_CACHE.state === state && FV_CACHE.round === state.round && FV_CACHE.evLen === state.events.length
      && FV_CACHE.key === k && FV_CACHE.stamp === MASK_STAMP) return FV_CACHE.vec;
    const v = features(state, pid, featS);
    FV_CACHE = { state: state, round: state.round, evLen: state.events.length, key: k, stamp: MASK_STAMP, vec: v };
    return v;
  }

  const FEAT_S = featuresV7(S.createState('standard', { next: Math.random }), 0).length;

  /* ---- 动作特征（**候选**视角）：该候选在"当前局面"下的属性/代价/克制/目标关系 ----
   * `cand` = {key, target, target2, bead}（v7）。只传 key 时两个新块恒 0 ⇒ 旧口径（2P/工具）逐位不变。 */
  function actionFeatures(state, pid, key, cand) {
    const p = state.p[pid];
    const def = R.byKey[key];
    const cost = S.computeCost(state, pid, key);
    const c = cost.ok && typeof cost.ep === 'number' ? cost.ep : (def.cost || 0);
    const base = [
      p.infiniteEnergy ? 0 : Math.max(-1, Math.min(1, (p.ep - c) / 12)),  // 可负担余量
      cost.ok ? 1 : 0,                 // 当前是否可正常施展
      Math.min(c, 6) / 6,              // 相对费用
      R.ATK_EFFECT.indexOf(key) >= 0 ? 1 : 0,   // 攻击向
      R.GUARD_FAMILY.indexOf(key) >= 0 ? 1 : 0, // 防御向
      R.LIGHTNING.indexOf(key) >= 0 ? 1 : 0,    // 雷系
      (def.dmg ? def.dmg.amt : 0) / 3,          // 期望伤害
      def.pierce.defense ? 1 : 0, def.pierce.reflect ? 1 : 0, def.pierce.transfer ? 1 : 0,
      catOf(key),
      def.target === 'enemy' ? 1 : 0,
      def.target === 'self' ? 1 : 0,
      def.continuous ? 1 : 0
    ];
    /* ===== v7：**候选特有**维度（同样追加在末尾）===== */
    const bead = (cand && cand.bead) ? cand.bead : null;
    if (MASK.bead) base.push(bead === 'elec' ? 1 : 0, bead === 'boom' ? 1 : 0);
    else base.push(0, 0);
    const tid = (cand && cand.target != null && state.p[cand.target]) ? cand.target : null;
    if (!tid || !MASK.target) { for (let z = 0; z < 6; z++) base.push(0); return base; }
    const t = state.p[tid], hpm = state.mode.hp;
    let minHp = Infinity;
    for (let i = 0; i < state.p.length; i++) {
      if (i !== pid && state.p[i].hp > 0 && state.p[i].hp < minHp) minHp = state.p[i].hp;
    }
    base.push(
      t.hp / hpm,                                   // 目标血量
      Math.min(t.ep, 12) / 12,                      // 目标ジ
      (t.hp <= 1) ? 1 : 0,                          // 收割窗口（0.5 血也算）
      (t.ep >= 2) ? 1 : 0,                          // 目标有前摇 ⇒ 该压他
      (X && X.guardOf(state, tid)) ? 1 : 0,         // 目标身上有架势 ⇒ 打他会被挡/被弹
      (t.hp <= minHp + 1e-9) ? 1 : 0                // 目标是最脆的那个（集中火力）
    );
    return base;
  }
  const FEAT_A = actionFeatures(S.createState('standard', { next: Math.random }), 0, SK.GUN, null).length;
  const FEAT_N = FEAT_S + FEAT_A;

  /* ---- 参数（Flat64）与遗传算子 ---- */
  /* 可播种 RNG（**工具链修复**）：原先 randn 直接用 Math.random()，
   * 而训练里 `it.seed` 只影响**评估**种子 ⇒ 初始化/变异完全不可复现，A/B 两轮无法配对。
   * 默认仍是 Math.random（浏览器与游戏路径一字不变）；训练侧可 setRng(mulberry32(...))。 */
  let __rng = Math.random;
  function setRng(f) { __rng = (typeof f === 'function') ? f : Math.random; }
  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = __rng();
    while (v === 0) v = __rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function paramCount() { return HID * FEAT_N + HID + HID + 1; } // W1(H*N)+b1(H)+W2(H)+b2(1)
  function makePolicy(scale) {
    const p = new Float64Array(paramCount());
    for (let i = 0; i < p.length; i++) p[i] = randn() * (scale || 0.25);
    return p;
  }
  function mutatePolicy(p, sigma) { const q = p.slice(); for (let i = 0; i < q.length; i++) q[i] += randn() * sigma; return q; }
  function crossover(a, b) { const c = new Float64Array(a.length); for (let i = 0; i < c.length; i++) c[i] = __rng() < 0.5 ? a[i] : b[i]; return c; }

  /* ---- (s,a) 值网络：value(state,pid,key,params[,sh][,cand]) ----
   * v7：`sh.featA` 决定动作段宽度（v5/v6 = 14、v7 = 22）；`cand` 提供目标/珠类型。
   * 不传 `cand` 时新维度恒 0 ⇒ 旧口径（2P 路径 / 老工具）读数逐位不变。 */
  function value(state, pid, key, params, sh, cand) {
    const S_ = sh ? sh.featS : FEAT_S;
    const N = sh ? sh.featN : FEAT_N;
    const A_ = sh ? sh.featA : FEAT_A;
    const x = stateVec(state, pid, S_);
    const af = actionFeatures(state, pid, key, cand);
    const W1 = 0, B1 = HID * N, W2 = B1 + HID, B2 = W2 + HID;
    let v = params[B2];
    const h = new Float64Array(HID);
    for (let j = 0; j < HID; j++) {
      let s = 0;
      const base = W1 + j * N;
      for (let i = 0; i < S_; i++) s += params[base + i] * x[i];
      for (let i = 0; i < A_; i++) s += params[base + S_ + i] * (i < af.length ? af[i] : 0);
      s += params[B1 + j];
      h[j] = s > 0 ? s : 0; // ReLU
      v += params[W2 + j] * h[j];
    }
    return v;
  }

  /* ===== v7 性能：候选打分要"状态段预计算" =====
   * 候选数从 v6 的 ~10（技能）涨到 v7 的 ~56（技能×目标 + 蓄能×2）⇒ 每个候选都重算
   * `W1·[x | a]` 会让训练慢近 10×。状态段 `W1·x` 与候选无关 ⇒ 每个决策只算一次，
   * 每个候选只补动作段那 `A_` 项。**加法顺序保持"先状态、后动作、最后 b1"**，
   * 与 `value()` 逐位一致（否则同一策略在训练/评测两条路径上会有 1e-16 级差异，A/B 不可复现）。 */
  let PRE_CACHE = { state: null, round: -1, evLen: -1, pid: -1, stamp: -1, sh: null, params: null, h0: null };
  function statePre(state, pid, params, sh) {
    const N = sh ? sh.featN : FEAT_N, S_ = sh ? sh.featS : FEAT_S;
    const c = PRE_CACHE;
    if (c.state === state && c.round === state.round && c.evLen === state.events.length
      && c.pid === pid && c.stamp === MASK_STAMP && c.sh === sh && c.params === params) return c.h0;
    const x = stateVec(state, pid, S_);
    const h0 = new Float64Array(HID);
    for (let j = 0; j < HID; j++) {
      let s = 0;
      const base = j * N;
      for (let i = 0; i < S_; i++) s += params[base + i] * x[i];
      h0[j] = s;
    }
    PRE_CACHE = { state: state, round: state.round, evLen: state.events.length, pid: pid, stamp: MASK_STAMP, sh: sh, params: params, h0: h0 };
    return h0;
  }
  function valueFromPre(state, pid, key, params, sh, cand, h0) {
    const N = sh ? sh.featN : FEAT_N, S_ = sh ? sh.featS : FEAT_S, A_ = sh ? sh.featA : FEAT_A;
    const af = actionFeatures(state, pid, key, cand);
    const B1 = HID * N, W2 = B1 + HID;
    let v = params[params.length - 1];
    for (let j = 0; j < HID; j++) {
      let s = h0[j];
      const base = j * N + S_;
      for (let i = 0; i < A_; i++) s += params[base + i] * (i < af.length ? af[i] : 0);
      s += params[B1 + j];
      if (s > 0) v += params[W2 + j] * s;
    }
    return v;
  }

  /* 对合法动作集合打分 → softmax → 返回 {probs(按 ACT_KEYS 索引), argmaxKey} */
  function forward(state, pid, legal, params, opts) {
    opts = opts || {};
    const sh = shapeOf(params);   // P0：形状自适应（v5/v6 存档共存）
    const mask = new Array(A).fill(false);
    for (const l of legal) { const i = ACT_KEYS.indexOf(l.key); if (i >= 0) mask[i] = true; }
    const logits = new Float64Array(A);
    let maxL = -1e9;
    for (const l of legal) {
      const i = ACT_KEYS.indexOf(l.key);
      if (i < 0) continue;
      const v = value(state, pid, l.key, params, sh);
      logits[i] = v;
      if (v > maxL) maxL = v;
    }
    const probs = new Float64Array(A);
    let sum = 0;
    for (let a = 0; a < A; a++) {
      if (!mask[a] || logits[a] <= -1e8) { probs[a] = 0; continue; }
      probs[a] = Math.exp((logits[a] - maxL) / (opts.temp || 0.6));
      sum += probs[a];
    }
    for (let a = 0; a < A; a++) probs[a] = sum > 0 ? probs[a] / sum : 0;
    let argmax = 0, best = -1;
    for (let a = 0; a < A; a++) if (probs[a] > best) { best = probs[a]; argmax = a; }
    return { probs, argmaxKey: ACT_KEYS[argmax] };
  }

  function choose(state, pid, legal, params, opts) {
    opts = opts || {};
    if (!legal.length) return SK.JI;
    const fwd = forward(state, pid, legal, params, { temp: opts.temp == null ? 0.5 : opts.temp });
    if (opts.greedy) return fwd.argmaxKey;
    const r = state.rng.next();
    let acc = 0;
    for (let a = 0; a < A; a++) { acc += fwd.probs[a]; if (r < acc) return ACT_KEYS[a]; }
    return fwd.argmaxKey;
  }

  /* ===== v7：候选（技能, 目标, 珠类型）=====
   * 为什么需要：`forward()/choose()` 只返回**技能 key** ⇒ "同一技能打谁"和"蓄能选哪种珠"
   * 在网络眼里完全一样（旧代码：目标由 evo.js 的固定启发式定、珠类型由 play.js 的 `elec>boom` 猜）。
   * 枚举规则：
   *   · `def.target === 'enemy'` ⇒ **每个存活对手一个候选**（可选 lockTarget 排除被锁目标）；
   *   · 「蓄能」⇒ 电珠/爆珠**两个候选**（珠类型是本人选择、不是公开信息 ⇒ 只有自己的候选带 bead）；
   *   · 其余（self / 无目标）⇒ 单候选；
   *   · 第二目标（双枪/镜面 t2）仍走 evo.js 的启发式 —— 枚举 t2 会让候选数再 ×(N-1)，先不做。 */
  function candidatesFor(state, pid, legal, opts) {
    opts = opts || {};
    const out = [];
    const beadOn = opts.bead !== false;
    for (let i = 0; i < legal.length; i++) {
      const l = legal[i];
      const def = R.byKey[l.key];
      if (!def) continue;
      if (def.target === 'enemy') {
        let pool = S.opponentsOf(state, pid);
        if (opts.lockTarget != null) {
          const alt = pool.filter(function (o) { return o !== opts.lockTarget; });
          if (alt.length) pool = alt;
        }
        if (!pool.length) out.push({ key: l.key, target: null, target2: null, bead: null });
        for (let j = 0; j < pool.length; j++) out.push({ key: l.key, target: pool[j], target2: null, bead: null });
      } else if (def.target === 'other') {
        /* v1.5.34（用户质疑根因修复）：`holo` 是 `target:'other'`，此前落进 else 分支 ⇒ **只有 1 个候选且 target=null**，
         * 而引擎把 null 解释成"第一个存活对手"（`oppOf`）⇒ **系统性把盾送给别人**（记录里 100% 送人）。
         * 现在把目标还给决策：**自己（null）+ 每个存活对手**，让网络自己学该给谁。 */
        /* v1.5.37（第三方复核 §2-1，用户裁定）：`全息屏障` **本来就不能给自己**（自保用原型制御）——
         * `resolve.js` 的 `holoShieldFrom` 明写"自己给自己套不算"，且 `targetOf()` 会把 null/自己
         * 在**声明阶段**回退成"第一个存活对手" ⇒ 此前我加的 `target:null`（自己）是**幻影选项**：
         * 实测被选中 35/330 次，每一次都是"策略以为在做 A、引擎执行的是送盾给 1 号"，
         * 并把**错误归因**喂回训练。⇒ 这里只给真实对手。 */
        const poolOther = S.opponentsOf(state, pid);
        for (let j = 0; j < poolOther.length; j++) {
          out.push({ key: l.key, target: poolOther[j], target2: null, bead: null });
        }
      } else if (beadOn && l.key === SK.CHARGE) {
        out.push({ key: l.key, target: null, target2: null, bead: 'elec' });
        out.push({ key: l.key, target: null, target2: null, bead: 'boom' });
      } else {
        out.push({ key: l.key, target: null, target2: null, bead: null });
      }
    }
    return out;
  }

  /* 候选打分 → softmax → 返回 {probs, argmax, cand} */
  function forwardCands(state, pid, cands, params, opts) {
    opts = opts || {};
    const sh = shapeOf(params);
    const h0 = statePre(state, pid, params, sh);      // 状态段只算一次（v7 候选多了 5 倍）
    const n = cands.length;
    const logits = new Float64Array(n);
    let maxL = -1e9;
    for (let i = 0; i < n; i++) {
      const v = valueFromPre(state, pid, cands[i].key, params, sh, cands[i], h0);
      logits[i] = v;
      if (v > maxL) maxL = v;
    }
    const probs = new Float64Array(n);
    let sum = 0;
    for (let i = 0; i < n; i++) { probs[i] = Math.exp((logits[i] - maxL) / (opts.temp || 0.6)); sum += probs[i]; }
    for (let i = 0; i < n; i++) probs[i] = sum > 0 ? probs[i] / sum : 0;
    let arg = 0, best = -1;
    for (let i = 0; i < n; i++) if (probs[i] > best) { best = probs[i]; arg = i; }
    return { probs: probs, argmax: arg, cand: cands[arg] || null };
  }
  /* 选**候选**（训练/评测/UI 都用这条）：返回 {key,target,target2,bead} */
  function chooseCandidates(state, pid, cands, params, opts) {
    opts = opts || {};
    if (!cands || !cands.length) return { key: SK.JI, target: null, target2: null, bead: null };
    const f = forwardCands(state, pid, cands, params, { temp: opts.temp == null ? 0.5 : opts.temp });
    if (opts.greedy) return f.cand;
    const r = state.rng.next();
    let acc = 0;
    for (let i = 0; i < cands.length; i++) { acc += f.probs[i]; if (r < acc) return cands[i]; }
    return f.cand;
  }

  const PACK_VERSION = 7;   // v7：候选(技能,目标,珠类型) + 关系块 T(15) + 效果快照块 B(70) + 动作侧 +8
                            //     ⇒ FEAT_S 123→213 / FEAT_A 14→22 / paramCount 3337→5689，旧包一律不兼容

  /* 冠军包版本/维度校验：防止旧架构(33维特征→1177参数)被静默错位加载到新网络(52维→1633参数)。
   * 返回 {ok:true} 或 {ok:false, reason, got, want}。reason 取值：
   *   missing / no-version / version / length / feature / hidden */
  function checkPack(o) {
    if (!o || !Array.isArray(o.a)) return { ok: false, reason: 'missing' };
    if (typeof o.v !== 'number') return { ok: false, reason: 'no-version', got: o.v, want: PACK_VERSION };
    if (o.v !== PACK_VERSION) return { ok: false, reason: 'version', got: o.v, want: PACK_VERSION };
    const n = paramCount();
    if (o.a.length !== n) return { ok: false, reason: 'length', got: o.a.length, want: n };
    if (typeof o.f === 'number' && o.f !== FEAT_S) return { ok: false, reason: 'feature', got: o.f, want: FEAT_S };
    /* v7：动作段宽度也进包（旧包没有这个键 ⇒ 视为 14，见 VER_SHAPES） */
    if (typeof o.fa === 'number' && o.fa !== FEAT_A) return { ok: false, reason: 'action-feature', got: o.fa, want: FEAT_A };
    if (typeof o.h === 'number' && o.h !== HID) return { ok: false, reason: 'hidden', got: o.h, want: HID };
    return { ok: true };
  }
  function pack(p) { return { v: PACK_VERSION, a: Array.from(p), f: FEAT_S, fa: FEAT_A, h: HID }; }
  /* allowLegacy=true 仅工具/评测用：按包内长度反推形状重建，**游戏侧绝不使用**。
   * 这样五次失败实验的存档重新可读，A/B 证据链不再是一次性的。 */
  function unpack(o, allowLegacy) {
    if (allowLegacy) {
      if (!o || !Array.isArray(o.a)) return null;
      const featN = (o.a.length - HID - HID - 1) / HID;
      if (!(featN > 0 && Number.isInteger(featN))) return null;
      const q = new Float64Array(o.a.length);
      for (let i = 0; i < q.length; i++) q[i] = o.a[i];
      return q;
    }
    if (!checkPack(o).ok) return null;   // 游戏侧一律拒绝不兼容包（旧冠军/错维度/缺版本）
    const p = new Float64Array(paramCount());
    for (let i = 0; i < p.length; i++) p[i] = o.a[i];
    return p;
  }

  /* ===== v7：把旧形状的权重**逐位等价**地嵌进新形状 =====
   * 为什么需要：训练是**热启动**的（从 `champion-5p-v1.3.58.bak` 这类旧包长出来），
   * 而 `train-server` 用的是**严格** `unpack`（v7 会拒收 v6 包）⇒ 不嵌入就只能从随机重开，
   * 热启动谱系（产物 meta 的 `hotstartFrom`）与"A/B 同起点"的实验口径一起报废。
   * 原理：新维度**全部追加在末尾** ⇒ 旧包的第 j 行
   *   [旧状态段 featS | 旧动作段 featA]  可以原样放进  [新状态段 FEAT_S | 新动作段 FEAT_A] 的**前段**，
   *   新增列置 0。于是新网络的输出与旧网络**逐位相同**（新维度乘 0），只是形状变大了。
   * 反证（np-test D34）：把动作段的偏移写成 sh.featS 而不是 FEAT_S，D34 立刻红。 */
  function embedLegacy(params) {
    const sh = shapeOf(params);
    if (!sh) return null;
    if (!sh.legacy) return params.slice();
    const q = new Float64Array(paramCount());
    for (let j = 0; j < HID; j++) {
      const o = j * sh.featN, n = j * FEAT_N;
      for (let i = 0; i < sh.featS; i++) q[n + i] = params[o + i];
      for (let i = 0; i < sh.featA; i++) q[n + FEAT_S + i] = params[o + sh.featS + i];
    }
    const oB1 = HID * sh.featN, nB1 = HID * FEAT_N;
    for (let i = 0; i < HID; i++) q[nB1 + i] = params[oB1 + i];                 // b1
    for (let i = 0; i < HID; i++) q[nB1 + HID + i] = params[oB1 + HID + i];     // W2
    q[q.length - 1] = params[params.length - 1];                                // b2
    return q;
  }

  /* 工具/训练入口统一用这个读包：先严格（当前版本），失败再按长度嵌入（历史版本）。
   * 返回 { params, legacy, from } 或 null。 */
  function loadAny(o) {
    const strict = unpack(o, false);
    if (strict) return { params: strict, legacy: false, from: o && o.v };
    const raw = unpack(o, true);
    if (!raw) return null;
    const emb = embedLegacy(raw);
    if (!emb) return null;
    return { params: emb, legacy: true, from: o && o.v };
  }


  global.EpirusPolicy = {
    ACT_KEYS, FEAT_N, FEAT_S, FEAT_A, HID, PACK_VERSION, FEAT_S_V6,
    features, featuresV7, actionFeatures, value, forward, choose, shapeOf, setRng, oppAgg, oppSlots, skillHistory, OPP_SLOTS, HIST_K,
    /* v7 新增对外面：候选体系 + 实验掩码 + 形状表 + 旧包等价嵌入（守门/训练/工具用） */
    candidatesFor, forwardCands, chooseCandidates, setFeatMask, featMask,
    EFFECTS, PLAYER_SLOTS, VER_SHAPES, paramsOf, embedLegacy, loadAny,
    paramCount, makePolicy, mutatePolicy, crossover, pack, unpack, checkPack
  };
})(typeof window !== 'undefined' ? window : globalThis);
