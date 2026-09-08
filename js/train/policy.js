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

  const ACT_KEYS = R.AVAILABLE_2P.map(function (s) { return s.key; });
  const A = ACT_KEYS.length;
  const HID = 24;
  const CAT3 = { energy: 0, attack: 1, defense: 2, special: 3 };

  function catOf(key) { return key ? (CAT3[R.byKey[key].cat] + 1) / 4 : 0; }
  function priOf(key) { return key ? (R.byKey[key].pri || 3) / 5 : 0; }
  function idxOf(key) { return key ? R.skills.findIndex(function (s) { return s.key === key; }) / R.skills.length : 0; }
  function cdCount(p) { return Object.keys(p.cooldown).filter(function (k) { return p.cooldown[k] > 0; }).length; }

  /* ---- 状态特征（pid 视角，全部公开信息） ---- */
  function features(state, pid) {
    const me = state.p[pid], op = state.p[1 - pid];
    const hp = state.mode.hp;
    const curseOnMe = me.stickers.length;
    const curseByMe = op.stickers.filter(function (st) { return st.owner === pid; }).length;
    return [
      me.hp / hp, op.hp / hp,
      Math.min(me.ep, 12) / 12, Math.min(op.ep, 12) / 12,
      Math.min(me.elec, 1), Math.min(me.boom, 1), Math.min(op.elec, 1), Math.min(op.boom, 1),
      idxOf(me.lastSkill), catOf(me.lastSkill), priOf(me.lastSkill),
      idxOf(op.lastSkill), catOf(op.lastSkill), priOf(op.lastSkill),
      // 「上一招无效」显式编码：lastSkill=null 时 idxOf/catOf/priOf 全部塌成 0，与"上一招是ジ"同码
      // （删掉贷款后，对手空放 → 招式作废 → endTurn 置 null，值网络会掉进未训练区）。这里单独给两位。
      me.lastSkill ? 0 : 1, op.lastSkill ? 0 : 1,
      me.ringStreak / 3, op.ringStreak / 3,
      (me.cannonCount % 3) / 3, (op.cannonCount % 3) / 3,
      Math.min(cdCount(me), 6) / 6, Math.min(cdCount(op), 6) / 6,
      me.mineArmed ? 1 : 0, op.mineArmed ? 1 : 0,
      me.tauntActive ? 1 : 0, op.tauntActive ? 1 : 0,
      me.tauntPending ? 1 : 0, op.tauntPending ? 1 : 0,
      Math.min(curseOnMe, 4) / 4, Math.min(curseByMe, 4) / 4,
      me.guardNext ? 1 : 0, op.guardNext ? 1 : 0,
      me.baguaExtra ? 1 : 0, op.baguaExtra ? 1 : 0,
      me.fireWeakNext ? 1 : 0, me.fireWeakNow ? 1 : 0,
      op.fireWeakNext ? 1 : 0, op.fireWeakNow ? 1 : 0,
      me.chainLink ? 1 : 0, op.chainLink ? 1 : 0,
      me.nightmare ? 1 : 0, op.nightmare ? 1 : 0,
      me.vampire ? 1 : 0, op.vampire ? 1 : 0,
      me.vampHeal > 0 ? 1 : 0, op.vampHeal > 0 ? 1 : 0,
      me.reviveNext ? 1 : 0, op.reviveNext ? 1 : 0,
      me.infiniteEnergy ? 1 : 0, op.infiniteEnergy ? 1 : 0,
      Math.min(me.rodGuard, 3) / 3, Math.min(op.rodGuard, 3) / 3,
      state.round / R.MAX_ROUNDS,
      Math.max(-1, Math.min(1, (me.ep - op.ep) / 12)),
      // ---- 前摇威胁（对手蓄势/条件，帮助学会"该防"而不是一味进攻/龟缩）----
      (op.elec > 0 && op.ep >= 2) ? 1 : 0,   // 电磁炮前摇：对手有电珠且 ≥2 ジ
      op.ep >= 5 ? 1 : 0,                    // 大雷前摇：对手 ≥5 ジ
      ((op.boom > 0 && op.ep >= 1) || (op.lastSkill === SK.LASER_EYE && op.ep >= 2)) ? 1 : 0, // 激光眼前摇
      (op.ep >= 3 && op.ringStreak === 0) ? 1 : 0, // 聚能环前摇（可起手）
      op.ep >= 2 ? 1 : 0,                    // 穿透攻击前摇（坦克/狙击/激光剑）
      op.lastSkill === SK.CHARGE ? 1 : 0,    // 对手刚蓄能（下回合珠类技能威胁）
      me.hp <= 1 ? 1 : 0,                    // 自己濒死（防摄魂/爆头风险）
      op.hp <= 1 ? 1 : 0                     // 对手濒死（摄魂指法可用）
    ];
  }
  const FEAT_S = features(S.createState('standard', { next: Math.random }), 0).length;

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
  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function paramCount() { return HID * FEAT_N + HID + HID + 1; } // W1(H*N)+b1(H)+W2(H)+b2(1)
  function makePolicy(scale) {
    const p = new Float64Array(paramCount());
    for (let i = 0; i < p.length; i++) p[i] = randn() * (scale || 0.25);
    return p;
  }
  function mutatePolicy(p, sigma) { const q = p.slice(); for (let i = 0; i < q.length; i++) q[i] += randn() * sigma; return q; }
  function crossover(a, b) { const c = new Float64Array(a.length); for (let i = 0; i < c.length; i++) c[i] = Math.random() < 0.5 ? a[i] : b[i]; return c; }

  /* ---- (s,a) 值网络：value(state,pid,key,params) ---- */
  function value(state, pid, key, params) {
    const x = features(state, pid);
    const af = actionFeatures(state, pid, key);
    const N = FEAT_N;
    const W1 = 0, B1 = HID * N, W2 = B1 + HID, B2 = W2 + HID;
    let v = params[B2];
    const h = new Float64Array(HID);
    for (let j = 0; j < HID; j++) {
      let s = 0;
      const base = W1 + j * N;
      for (let i = 0; i < FEAT_S; i++) s += params[base + i] * x[i];
      for (let i = 0; i < FEAT_A; i++) s += params[base + FEAT_S + i] * af[i];
      s += params[B1 + j];
      h[j] = s > 0 ? s : 0; // ReLU
      v += params[W2 + j] * h[j];
    }
    return v;
  }

  /* 对合法动作集合打分 → softmax → 返回 {probs(按 ACT_KEYS 索引), argmaxKey} */
  function forward(state, pid, legal, params, opts) {
    opts = opts || {};
    const mask = new Array(A).fill(false);
    for (const l of legal) { const i = ACT_KEYS.indexOf(l.key); if (i >= 0) mask[i] = true; }
    const logits = new Float64Array(A);
    let maxL = -1e9;
    for (const l of legal) {
      const i = ACT_KEYS.indexOf(l.key);
      if (i < 0) continue;
      const v = value(state, pid, l.key, params);
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

  const PACK_VERSION = 4;   // v3：状态特征 +4 前摇威胁 → FEAT_S 变化，旧冠军(v2/f52)不兼容

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
  function unpack(o) {
    if (!checkPack(o).ok) return null;   // 一律拒绝不兼容包（旧冠军/错维度/缺版本）
    const p = new Float64Array(paramCount());
    for (let i = 0; i < p.length; i++) p[i] = o.a[i];
    return p;
  }

  global.EpirusPolicy = {
    ACT_KEYS, FEAT_N, FEAT_S, FEAT_A, HID, PACK_VERSION,
    features, actionFeatures, value, forward, choose,
    paramCount, makePolicy, mutatePolicy, crossover, pack, unpack, checkPack
  };
})(typeof window !== 'undefined' ? window : globalThis);
