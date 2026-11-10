/* def-gate.mjs — "适度防御"逻辑门（DS · 2026-11-02 晚）
 * 形态：基础策略 + 一个只读公开特征的小 softmax 门；P(该防) ≥ 阈值且防牌合法才出，否则交回基础策略。
 * 特征（11 维，全部决策前公开）：我的 hp/ep/有无珠、回合、存活对手数、对手 ep 和/珠 和/上一手攻击数/上一手防御数/残血数。
 * 训练：scratch/oracle-learn.mjs（事后标签，见 docs/research/ORACLE-TEACHER-2026-11-02-ds.md）。
 * 模型 JSON：{ v, nf, thresh, classes, w[5][11] }。
 */
export const DEF_GATE_CLASSES = ['none', 'reflect', 'guard', 'gun', 'transfer'];
const ATTACKS = new Set(['gun', 'tank', 'sword', 'snipe', 'railgun', 'dualGun']);
const DEFSET = new Set(['guard', 'reflect', 'bagua', 'shift', 'jinshield', 'armor', 'proto', 'holo']);
export const DEF_GATE_REPLY = ['', 'reflect', 'guard', 'gun', 'transfer'];

export function gateFeatures(state, pid) {
  const me = state.p[pid] || {};
  let oppEp = 0, oppBead = 0, oppAtk = 0, oppDef = 0, oppLow = 0, alive = 0;
  for (let i = 0; i < state.p.length; i++) {
    if (i === pid) continue;
    const o = state.p[i]; if (!o || o.hp <= 0) continue;
    alive++; oppEp += (o.ep | 0); oppBead += ((o.elec | 0) + (o.boom | 0)); oppLow += (o.hp <= 1 ? 1 : 0);
    if (ATTACKS.has(o.lastSkill)) oppAtk++; if (DEFSET.has(o.lastSkill)) oppDef++;
  }
  return [1, (me.hp | 0) / 5, (me.ep | 0) / 5, ((me.elec | 0) + (me.boom | 0)) > 0 ? 1 : 0,
    (state.round | 0) / 20, alive / 4, oppEp / 10, oppBead / 4, oppAtk / 4, oppDef / 4, oppLow / 4];
}

export function gateProbs(model, x) {
  const p = new Array(model.classes.length).fill(0);
  for (let c = 0; c < p.length; c++) { let s = 0; for (let j = 0; j < model.nf; j++) s += model.w[c][j] * x[j]; p[c] = Math.exp(Math.max(-30, Math.min(30, s))); }
  const z = p.reduce((a, b) => a + b, 0) || 1; return p.map((v) => v / z);
}

/* 返回门选的防御（{key, target}）或 null（交回基础策略） */
export function gatePick(model, state, pid, legal) {
  const me = state.p[pid]; if (!me || me.hp <= 0) return null;
  const x = gateFeatures(state, pid), p = gateProbs(model, x);
  let best = 0, bp = -1; for (let c = 1; c < p.length; c++) if (p[c] > bp) { bp = p[c]; best = c; }
  if (best === 0 || bp < model.thresh) return null;
  const want = DEF_GATE_REPLY[best];
  const lg = (legal || []).find((c) => c.key === want && c.affordable);
  if (!lg) return null;
  let target = null;
  if (want === 'gun') {
    /* 反打枪要选一个对手：优先"上一手打我"的，其次 ep 最高的活人 */
    let t1 = -1, t2 = -1, e2 = -1;
    for (let i = 0; i < state.p.length; i++) {
      if (i === pid) continue; const o = state.p[i]; if (!o || o.hp <= 0) continue;
      if (o.lastTarget === pid) t1 = i;
      if ((o.ep | 0) > e2) { e2 = o.ep | 0; t2 = i; }
    }
    target = t1 >= 0 ? t1 : (t2 >= 0 ? t2 : null);
  }
  return { key: want, target: target, target2: null, bead: null };
}

/* 把基础 chooser 包一层门：门命中就出防，否则交回基础 */
export function wrapWithGate(model, baseChooser) {
  return function (state, pid, legal) {
    const g = gatePick(model, state, pid, legal);
    if (g) return g;
    return baseChooser(state, pid, legal);
  };
}
