#!/usr/bin/env node
/* obs3.mjs — 2.0 观测集第三版（千问 · 10-29 夜）
 *
 * 目标（用户 10-28 23:4x 原话落成判据）：**用尽量正交的多维覆盖游戏里可知的信息，并且不要有读不到信息的死维度。**
 * 三条纪律（每条都有对应的机器尺，见 tools/proto2/dimgate.mjs）：
 *   ① 只编码**决策时刻读得到**的字段 —— 逐字段生命周期在 `js/core/state.js` 的 `freshPlayer` 与
 *      `js/core/resolve.js` 的 `startTurn`(:145-181)/`endTurn` 两侧核对过；只在结算中途存在、回合开始就被兑掉或清空的
 *      字段（`beadNew` `guardNext` `copiedGuard` `fireWeakNext` `tauntPending` `tauntByPending` `reviveNext`）**一律不进**；
 *      `tauntFrom`/`tauntTo` **全仓没有写入点** ⇒ 更不进。
 *   ② 公开性：对手**蓄珠种类不可知**（`resolve.js:746-749`）⇒ 对手席只给"持不持珠"；自己那份才给电/爆枚数（放在 self-only 块，
 *      不污染共享席位编码器）。
 *   ③ 正交：同一事实只写一处。比例/分箱/聚合不并存；`mean` 与 `sum` 只对"按人头累加"的量同时保留（线性尺造不出 mean×count）。
 *
 * 与 obs2（DS 第一版）的差别都在注释里逐条标了 ⚑ —— obs2 的 L0 有 3 维读的是不存在的字段（`state.mode.name==='long'`
 * 实际是 `state.modeKey`；`mode.shrinkStart`/`mode.soulHpMin` 在 `state.mode` 上根本没有 ⇒ 恒走默认值 ⇒ 常量维），
 * 第 8 维直接写成 `1/3`，L2 的 `mirrored` 自己注释成"占位"恒 0；另外它给对手席编码了 `elec`/`boom` ⇒ **泄漏私有信息**。
 *
 * 布局（`MANIFEST` 与 `encode` 的 push 顺序逐位对应；`dims()` 给总长）：
 *   G 5 ‖ 席位(共享) 22×自己 1 ‖ self-only 2 ‖ 池化 mean 22 + max 22 + 按人头 2 ‖ 关系 5
 *   ‖ 自己事件序列 K=4 × 12 ‖ 候选 46(+技能身份 one-hot K_SK)
 */

const SKILL_CLASS = ['energy', 'attack', 'defense', 'special'];

/* 结果类（对齐引擎实际出口；`by`/`reason`/`via` 是自由中文串 ⇒ **不可**当枚举用，只按 `type` 判） */
export const OUTCOME = ['landed', 'blocked', 'reflected', 'redirected', 'nullified', 'immune', 'prevented', 'whiffed'];
/* ⚑ `whiffed`（空放 / 打已死者）引擎**什么都不记**（`resolve.js:842 :882 :953 :997 :1195 :1229`、`:456`），
 *   只能由"递交回执 ok 且该卡家族里没有任何结果事件"反推 ⇒ 派生维，`dimgate` 会给它单列一条自证。 */

let _MAN = null, _SK = null;

function manifest(R) {
  if (_MAN && _SK === R.skills.length) return _MAN;
  _SK = R.skills.length;
  const m = [];
  const add = (name, block, note) => m.push({ i: m.length, name, block, note: note || '' });

  ['n', 'alive', 'modeHp', 'round', 'epRegen'].forEach((n) => add(n, 'G'));
  const SEAT = ['hp', 'ep', 'ringStreak', 'cannonCount', 'rodGuard', 'mineTurns', 'baguaExtra', 'fireWeakNow',
    'tauntActive', 'nightmare', 'vampire', 'infiniteEnergy', 'stickers', 'stickerMaxAge',
    'lsEnergy', 'lsAttack', 'lsDefense', 'lsSpecial', 'lsNone',
    'lastTgtSelf', 'lastTgtMe', 'lastTgtOther'];
  SEAT.forEach((n) => add('self.' + n, 'S.self'));
  ['ownElec', 'ownBoom'].forEach((n) => add(n, 'S.private'));     /* ⚑ 只有自己可见的两枚 ⇒ 独立块，不进共享编码器 */
  SEAT.forEach((n) => add('pool.mean.' + n, 'P.opp'));
  SEAT.forEach((n) => add('pool.max.' + n, 'P.opp'));
  ['pool.sumStickers', 'pool.count'].forEach((n) => add(n, 'P.add'));
  ['rel.mustHit', 'rel.tauntsMe', 'rel.chained', 'rel.mirroredMe', 'rel.targetedMe'].forEach((n) => add(n, 'R2'));
  for (let k = 0; k < 4; k++) {
    add('seq' + k + '.cat.energy', 'Q.seq'); add('seq' + k + '.cat.attack', 'Q.seq'); add('seq' + k + '.cat.defense', 'Q.seq'); add('seq' + k + '.cat.special', 'Q.seq');
    add('seq' + k + '.fam.atk', 'Q.seq'); add('seq' + k + '.fam.guard', 'Q.seq'); add('seq' + k + '.fam.thunder', 'Q.seq'); add('seq' + k + '.fam.reflectable', 'Q.seq');
    add('seq' + k + '.out.landed', 'Q.out'); add('seq' + k + '.out.blocked', 'Q.out'); add('seq' + k + '.out.nullified', 'Q.out'); add('seq' + k + '.out.none', 'Q.out');
  }
  ['cost', 'pri', 'cat.energy', 'cat.attack', 'cat.defense', 'cat.special', 'tgt.none', 'tgt.self', 'tgt.one', 'tgt.two', 'tgt.all',
    'dmg', 'pierceDef', 'pierceRef', 'pierceTrans', 'continuous', 'needBead', 'beadIsElec', 'beadIsBoom',
    'affordOk', 'epMargin', 'beadAfford', 'killsTarget', 'reducesTarget', 'pierceVsVisible', 'aoeCount', 'aoeSumStickers',
    'endgame', 'hiddenReady', 'role1Source', 'role2Source',
    't1present', 't1hp', 't1ep', 't1bead', 't1stickers', 't1stance', 't1fireWeak', 't1obligation', 't1lowest', 't1targetedMe',
    't2present', 't2hp', 't2ep', 't2bead', 't2stickers', 't2stance', 't2fireWeak', 't2obligation', 't2lowest', 't2targetedMe', 't2hpDiff'].forEach((n) => add(n, 'C.cand'));
  R.skills.forEach((s) => add('skill.' + s.key, 'C.id'));       /* 动作身份：one-hot 在**本模式卡表全集**上 ⇒ 恒有一枚为 1，不与其他维重复 */
  _MAN = m;
  return m;
}
export function dims(R) { return manifest(R || { skills: [] }).length; }
export function blocks(R) { return manifest(R || { skills: [] }); }

/* ---- 席位 22 维（**公开可读**；mePid<0 ⇒ lastTgtMe 自然全 0）---- */
function seatVec(p, mePid, modeHp, R) {
  const cat = p.lastSkill && R.byKey[p.lastSkill] ? R.byKey[p.lastSkill].cat : null;
  const ci = SKILL_CLASS.indexOf(cat);
  const st = (p.stickers || []);
  return [
    Math.max(0, p.hp) / modeHp, Math.min(p.ep, 12) / 12,
    Math.min(p.ringStreak || 0, 3) / 3, Math.min(p.cannonCount || 0, 9) / 9,
    Math.min(p.rodGuard || 0, 3) / 3, Math.min(p.mineTurns || 0, 3) / 3,
    p.baguaExtra ? 1 : 0, p.fireWeakNow ? 1 : 0,
    p.tauntActive ? 1 : 0, p.nightmare ? 1 : 0, p.vampire ? 1 : 0, p.infiniteEnergy ? 1 : 0,
    Math.min(st.length, 4) / 4, Math.min(st.reduce((a, s) => Math.max(a, (s && s.age) || 0), 0), 4) / 4,
    ci === 0 ? 1 : 0, ci === 1 ? 1 : 0, ci === 2 ? 1 : 0, ci === 3 ? 1 : 0, p.lastSkill ? 0 : 1,
    p.lastTarget === p.id ? 1 : 0, (mePid >= 0 && p.lastTarget === mePid) ? 1 : 0,
    (p.lastTarget != null && p.lastTarget !== p.id && p.lastTarget !== mePid) ? 1 : 0,
  ];
}
const SEAT_N = 22;

/* ---- 结果类：按**事件 type** 判（自由中文 `by`/`reason` 不参与判定）---- */
const BLOCK_TYPES = ['blocked', 'curseBlock', 'cancel', 'clash'];
const NULL_TYPES = ['voided', 'voidedBy', 'rodBlock', 'cannonCountered', 'thunderRing', 'bigTChain'];
const EFFECT_TYPES = ['damage', 'heal', 'ep', 'bead', 'curse', 'mineArm', 'guardSet', 'holoSet', 'taunt', 'revive', 'vampire', 'headshot', 'hidden', 'purify', 'transfer', 'reflect'];
function outcomeBits(state, pid, key) {
  const ev = state.events || [];
  let actAt = -1;
  for (let i = ev.length - 1; i >= 0; i--) { const e = ev[i]; if (e.type === 'action' && e.pid === pid && e.key === key) { actAt = i; break; } }
  const b = [0, 0, 0, 0, 0, 0];        /* landed blocked reflected redirected nullified prevented */
  if (actAt < 0) return null;
  const a = ev[actAt];
  if (a.outcome && a.outcome !== 'ok') { b[5] = 1; return b; }
  for (let i = actAt + 1; i < ev.length; i++) {
    const e = ev[i];
    const mine = (e.pid === pid || e.to === pid || e.from === pid || e.source === pid || e.byPid === pid || e.dest === pid);
    if (!mine && e.type !== 'action') continue;
    if (e.type === 'reflect') { b[2] = 1; b[0] = 1; }
    else if (e.type === 'transfer') b[3] = 1;
    else if (BLOCK_TYPES.indexOf(e.type) >= 0) b[1] = 1;
    else if (NULL_TYPES.indexOf(e.type) >= 0) b[4] = 1;
    else if (EFFECT_TYPES.indexOf(e.type) >= 0) b[0] = 1;
  }
  return b;
}

/** 自己最近 K=4 次出手：类别 + 语义家族 + 结果类（身份不进序列 ⇒ 家族位是规则声明的集合，不是手写序号） */
function selfSeq(state, pid, R) {
  const ev = state.events || [];
  const acts = [];
  for (let i = ev.length - 1; i >= 0 && acts.length < 4; i--) { const e = ev[i]; if (e.type === 'action' && e.pid === pid && e.key) acts.push(e); }
  const out = [];
  for (let k = 0; k < 4; k++) {
    const a = acts[k];
    if (!a) { out.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1); continue; }
    const def = R.byKey[a.key] || {};
    const ci = SKILL_CLASS.indexOf(def.cat);
    const ob = outcomeBits(state, pid, a.key);
    const landed = ob ? ob[0] : 0, blocked = ob ? (ob[1] || ob[2] || ob[3] || ob[4]) : 0;
    out.push(ci === 0 ? 1 : 0, ci === 1 ? 1 : 0, ci === 2 ? 1 : 0, ci === 3 ? 1 : 0,
      R.ATK_EFFECT.indexOf(a.key) >= 0 ? 1 : 0, R.GUARD_FAMILY.indexOf(a.key) >= 0 ? 1 : 0,
      R.LIGHTNING.indexOf(a.key) >= 0 ? 1 : 0, R.REFLECTABLE.indexOf(a.key) >= 0 ? 1 : 0,
      landed, blocked, ob && ob[4] ? 1 : 0, (!landed && !blocked) ? 1 : 0);
  }
  return out;
}

/** 局面侧部件（与候选无关 ⇒ 一次决策只算一遍；arch2 的逐席集合编码与池化都从这里取） */
export function scene(W, state, pid) {
  const R = W.EpirusRules;
  const me = state.p[pid];
  const modeHp = (state.mode && state.mode.hp) || 3;
  const maxR = R.MAX_ROUNDS || 60;
  const alive = state.p.filter((q) => q.hp > 0);
  const g = [state.n / 6, alive.length / 6, modeHp / 6, state.round / maxR, Math.min(state.epRegen || 0, 4) / 4];
  const priv = [Math.min(me.elec || 0, 2) / 2, Math.min(me.boom || 0, 2) / 2];
  const seats = [];
  let sumSt = 0;
  for (const q of alive) {
    const rel = [0, 0, 0, 0, 0];
    if (q.id !== pid) {
      if ((me.tauntBy || []).indexOf(q.id) >= 0) rel[0] = 1;
      if ((q.tauntBy || []).indexOf(pid) >= 0) rel[1] = 1;
      if ((me.chains || []).indexOf(q.id) >= 0) rel[2] = 1;
      if (q.lastSkill === R.SK.MIRROR && q.lastTarget === pid) rel[3] = 1;
      if (q.lastTarget === pid) rel[4] = 1;
      sumSt += (q.stickers || []).length;
    }
    seats.push({ id: q.id, public: seatVec(q, pid, modeHp, R), rel, isSelf: q.id === pid ? 1 : 0, p: q });
  }
  const sums = [Math.min(sumSt, 12) / 12, seats.length / 6];
  return { W, R, state, pid, me, modeHp, maxR, alive, g, priv, seats, sums, seq: selfSeq(state, pid, R), SEAT_W: SEAT_N + 6 };
}
/** 由 scene 派生一个候选的部件（目标走 h_t ⇒ 这里**不再**给目标标量，除非装配平面向量） */
export function candOf(sc, cand) {
  const S = sc.W.EpirusState, R = sc.R, me = sc.me;
  const def = R.byKey[cand.key] || {};
  const cost = S.computeCost(sc.state, sc.pid, cand.key);
  const c = typeof cost.ep === 'number' ? cost.ep : (def.cost || 0);
  const ci = SKILL_CLASS.indexOf(def.cat);
  const isAoe = def.target === 'all' || cand.key === R.SK.FIRESTORM || cand.key === R.SK.MINE || cand.key === R.SK.BIG_T;
  const twoTgt = !!(cand.target2 != null || def.target2 === 'enemy');
  const dmg = (def.dmg && def.dmg.amt) || 0;
  const t1 = cand.target != null ? sc.state.p[cand.target] : null;
  const t2 = cand.target2 != null ? sc.state.p[cand.target2] : null;
  const beadAfford = cand.bead === 'elec' ? Math.min(me.elec || 0, 1) : cand.bead === 'boom' ? Math.min(me.boom || 0, 1) : (def.energyNeeds ? 0 : 1);
  const hiddenReady = ((me.chains || []).length > 0 && cand.key === R.SK.DRAIN) || (me.hp <= 1 && (me.vampire || me.nightmare));
  const oppN = sc.seats.length - 1;
  const base = [Math.min(c, 6) / 6, (def.pri || 0) / 5,
    ci === 0 ? 1 : 0, ci === 1 ? 1 : 0, ci === 2 ? 1 : 0, ci === 3 ? 1 : 0,
    (!def.target && !isAoe) ? 1 : 0, def.target === 'self' ? 1 : 0, (!isAoe && !twoTgt && def.target) ? 1 : 0, (twoTgt && !isAoe) ? 1 : 0, isAoe ? 1 : 0,
    Math.min(dmg, 3) / 3, def.pierce && def.pierce.defense ? 1 : 0, def.pierce && def.pierce.reflect ? 1 : 0, def.pierce && def.pierce.transfer ? 1 : 0,
    def.continuous ? 1 : 0, def.energyNeeds ? 1 : 0, cand.bead === 'elec' ? 1 : 0, cand.bead === 'boom' ? 1 : 0,
    cost.ok ? 1 : 0, Math.max(-1, Math.min(1, (me.ep - c) / 4)), beadAfford,
    !!(t1 && dmg > 0 && dmg >= t1.hp) ? 1 : 0, dmg > 0 ? 1 : 0,
    !!(t1 && def.pierce && (t1.baguaExtra || t1.tauntActive) && def.pierce.defense) ? 1 : 0,
    isAoe ? oppN / 5 : 0, isAoe ? Math.min(sc.sums[0] * 12, 12) / 12 : 0,
    (sc.alive.length <= 2 || sc.state.round >= sc.maxR - 4) ? 1 : 0, hiddenReady ? 1 : 0,
    (twoTgt && cand.key === R.SK.MIRROR) ? 1 : 0, (twoTgt && cand.key !== R.SK.MIRROR) ? 1 : 0];
  const idOne = new Array(R.skills.length).fill(0);
  const at = R.skills.findIndex((s) => s.key === cand.key);
  if (at >= 0) idOne[at] = 1; else idOne[idOne.length - 1] = 1;
  return { def, c, dmg, t1, t2, base, idOne, isAoe, twoTgt, BASE_W: base.length, ID_W: idOne.length };
}
/** 目标槽标量（只给**平面向量**用；arch2 走 h_t，不吃这些） */
function targetScalars(sc, q) {
  return q ? [
    Math.max(0, q.hp) / sc.modeHp, Math.min(q.ep, 12) / 12, (q.elec || q.boom) ? 1 : 0,
    Math.min((q.stickers || []).length, 4) / 4, (q.baguaExtra || q.fireWeakNow || q.tauntActive) ? 1 : 0,
    q.fireWeakNow ? 1 : 0, q.tauntActive ? 1 : 0,
    (sc.alive.length > 1 && q.hp === Math.min(...sc.alive.map((x) => x.hp))) ? 1 : 0, (q.lastTarget === sc.pid) ? 1 : 0,
  ] : new Array(9).fill(0);
}

/** 结构化部件（= scene + candOf 的合并视图；离线尺与回归测试用它比对 flatten 一致性） */
export function parts(W, state, pid, cand) {
  const sc = scene(W, state, pid), cp = candOf(sc, cand);
  return { g: sc.g, priv: sc.priv, seats: sc.seats, sums: sc.sums, seq: sc.seq, base: cp.base, idOne: cp.idOne, t1: cp.t1, t2: cp.t2, oneOf: (q) => targetScalars(sc, q), SEAT_W: sc.SEAT_W, BASE_W: cp.BASE_W, ID_W: cp.ID_W };
}

/** 编码一个候选：返回长度 = dims(R) 的数组（离线尺用；arch2 走 scene/candOf） */
export function encode(W, state, pid, cand) {
  const R = W.EpirusRules;
  const M = manifest(R);
  const sc = scene(W, state, pid), cp = candOf(sc, cand);
  const out = [];
  const push = (...v) => { for (const x of v) out.push(Number.isFinite(x) ? x : 0); };
  push(...sc.g);
  const selfSeat = sc.seats.find((s) => s.isSelf) || sc.seats[0];
  push(...selfSeat.public, ...sc.priv);
  const opps = sc.seats.filter((s) => !s.isSelf);
  const mean = new Array(SEAT_N).fill(0), max = new Array(SEAT_N).fill(0);
  for (const s of opps) { for (let j = 0; j < SEAT_N; j++) { mean[j] += s.public[j] / Math.max(1, opps.length); if (s.public[j] > max[j]) max[j] = s.public[j]; } }
  push(...mean, ...max, ...sc.sums);
  const relAny = [0, 0, 0, 0, 0];
  for (const s of opps) for (let j = 0; j < 5; j++) if (s.rel[j]) relAny[j] = 1;
  push(...relAny);
  push(...sc.seq);
  push(...cp.base);
  push(cp.t1 ? 1 : 0, ...targetScalars(sc, cp.t1));
  push(cp.t2 ? 1 : 0, ...targetScalars(sc, cp.t2), (cp.t1 && cp.t2) ? Math.abs(cp.t1.hp - cp.t2.hp) / sc.modeHp : 0);
  push(...cp.idOne);
  if (out.length !== M.length) throw new Error('obs3 布局不自洽：拼出 ' + out.length + ' 列 ‖ MANIFEST 声明 ' + M.length + ' 列 ⇒ 差 ' + (out.length - M.length) + '（这条就是 1584 死权重那次的守卫）');
  return out;
}
export { SEAT_N };
