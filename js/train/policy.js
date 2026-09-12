/* Epirus — 策略网络 v2：**状态-动作值网络**（零依赖）。
 * 旧版是“每个动作一个 logit、共享同一状态向量”，学不到“按局面选招”。
 * 新版：s = 状态特征(33)，a = 该动作特征(约14)；
 * 对每个合法动作拼 [s,a] → 小 MLP → 一个标量“该招在当前局面的价值”，softmax 选招。
 * 训练仍用变异进化锦标赛（见 js/train/evo.js）。所有对外 API 保持不变。
 */
(function (global) {
  'use strict';
  const R = global.EpirusRules;
  const S = global.EpirusState;
  const SK = R.SK;

  // 动作集 = 全部技能（含多人专用 双枪/镜面）；2 人局它们不在 legal 里，不会被选中。
  // 参数维度由 FEAT_N 决定（与 A 无关），故不影响旧冠军包。
  const ACT_KEYS = R.skills.map(function (s) { return s.key; });
  const A = ACT_KEYS.length;
  const HID = 24;
  const OPP_SLOTS = 4;   // v5：最多 5 人局的对手槽位数
  const HIST_K = 3;      // v5：最近 K 步技能历史
  const CAT3 = { energy: 0, attack: 1, defense: 2, special: 3 };

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
  function oppSlots(state, pid) {
    const a = [];
    for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) a.push(i);
    a.sort(function (x, y) { const d = state.p[x].hp - state.p[y].hp; return d !== 0 ? d : x - y; });
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
  function featuresV6(state, pid) {
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
      Math.min(me.elec, 1), Math.min(me.boom, 1), anyOp(function (o) { return Math.min(o.elec, 1); }), anyOp(function (o) { return Math.min(o.boom, 1); }),
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
        Math.min(op.elec, 1), Math.min(op.boom, 1),   // 各自珠
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
    return base;
  }
  /* ===== P0：旧版存档兼容 =====
   * 问题：FEAT_S/PACK_VERSION 是模块全局，一个进程只能有一种网络形状 →
   * 升 v6 后 7 个 v5 实验存档全变砖，A/B 工具链（econ-eval ③）直接失效，
   * 五次失败结论无法复现对照。
   * 解法（千问方案）：形状从 **params.length 反推**——
   *   paramCount = HID*FEAT_N + HID + HID + 1  ⇒  FEAT_N = (len - 2*HID - 1)/HID
   *   v5: (3313-49)/24 = 136  ⇒ FEAT_S = 136 - FEAT_A = 122
   *   v6: (3337-49)/24 = 137  ⇒ FEAT_S = 123
   * 于是同一进程可同时评测两种形状；**游戏侧 checkPack 仍严格拒绝**（只放宽工具侧 unpack）。 */
  function shapeOf(params) {
    const n = params.length;
    if (n === HID * FEAT_N + HID + HID + 1) return { featS: FEAT_S, featA: FEAT_A, featN: FEAT_N, legacy: false };
    const featN = (n - HID - HID - 1) / HID;
    if (featN > 0 && Number.isInteger(featN) && featN > FEAT_A)
      return { featS: featN - FEAT_A, featA: FEAT_A, featN: featN, legacy: true };
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
      return featuresV6(st, 0);
    };
    const a = mk(0), b = mk(3);
    for (let i = 0; i < a.length; i++) if (a[i] - b[i] > 0.5) { RING_SELF_IDX = i; break; }
    return RING_SELF_IDX;
  }
  function features(state, pid, featS) {
    const x = featuresV6(state, pid);
    if (featS == null || featS >= x.length) return x;
    const i = ringSelfIdx();
    if (i < 0) return x.slice(0, featS);
    const y = x.slice(); y.splice(i, 1); return y;
  }

  const FEAT_S = featuresV6(S.createState('standard', { next: Math.random }), 0).length;

  /* ---- 动作特征（该招在“当前局面”下的属性/代价/克制关系） ---- */
  function actionFeatures(state, pid, key) {
    const p = state.p[pid];
    const def = R.byKey[key];
    const cost = S.computeCost(state, pid, key);
    const c = cost.ok && typeof cost.ep === 'number' ? cost.ep : (def.cost || 0);
    return [
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
  }
  const FEAT_A = actionFeatures(S.createState('standard', { next: Math.random }), 0, SK.GUN).length;
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

  /* ---- (s,a) 值网络：value(state,pid,key,params) ---- */
  function value(state, pid, key, params, sh) {
    const S_ = sh ? sh.featS : FEAT_S;
    const N = sh ? sh.featN : FEAT_N;
    const x = features(state, pid, S_);
    const af = actionFeatures(state, pid, key);
    const W1 = 0, B1 = HID * N, W2 = B1 + HID, B2 = W2 + HID;
    let v = params[B2];
    const h = new Float64Array(HID);
    for (let j = 0; j < HID; j++) {
      let s = 0;
      const base = W1 + j * N;
      for (let i = 0; i < S_; i++) s += params[base + i] * x[i];
      for (let i = 0; i < FEAT_A; i++) s += params[base + S_ + i] * af[i];
      s += params[B1 + j];
      h[j] = s > 0 ? s : 0; // ReLU
      v += params[W2 + j] * h[j];
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

  const PACK_VERSION = 6;   // v6：加"自己跨得过环启动线"离散特征（千问 (a)）→ FEAT_S 变化，旧 v5 冠军不兼容

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
    if (typeof o.h === 'number' && o.h !== HID) return { ok: false, reason: 'hidden', got: o.h, want: HID };
    return { ok: true };
  }
  function pack(p) { return { v: PACK_VERSION, a: Array.from(p), f: FEAT_S, h: HID }; }
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

  global.EpirusPolicy = {
    ACT_KEYS, FEAT_N, FEAT_S, FEAT_A, HID, PACK_VERSION,
    features, featuresV6, actionFeatures, value, forward, choose, shapeOf, setRng, oppAgg, oppSlots, skillHistory, OPP_SLOTS, HIST_K,
    paramCount, makePolicy, mutatePolicy, crossover, pack, unpack, checkPack
  };
})(typeof window !== 'undefined' ? window : globalThis);
