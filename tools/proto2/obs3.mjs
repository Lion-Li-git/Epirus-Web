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
 *   G 5（n ‖ alive ‖ modeHp ‖ round ‖ shrink，人数族统一 /10、/5）
 *   ‖ 席位(共享编码器) 22 ‖ self-only 珠 2 ‖ 池化 mean 22 + max 22（**只算对手**）+ 全场符咒合计 1
 *   ‖ 关系 5 ‖ 自己事件序列 K=4 × 12（=Q.seq 32 + Q.out 16）
 *   ‖ 候选 51（基础 30 + 目标一 10 + 目标二 11）+ 技能身份 one-hot 30 ⇒ **合计 208**
 *
 * ⚑ **代 2（10-30 下午，接线换代同批）**改的四处，都是"文档口径 ≠ 真写出来的东西"：
 *   ① `round` 分母从写死 60 改成 `state.mode.maxRounds`（long=140）——旧值在 long 局读到 1.72（量程出界）；
 *   ② `endgame` 旧写法是 `round>=60-4`，实测 long 局 46.5% 的决策被判终局、multi 局真收缩时反而 0%（原件
 *      `scratch/qoder-1030-endgame.mjs`）；现按"只剩两人 / 逼近本模式上限 / 已进入收缩"三条判，并新增 `G.shrink`；
 *   ③ 删 `epRegen`（产品与 arena2 都没有任何路径写 regen ⇒ 构造性恒零；`createState(...,{regen})` 才置位，
 *      全仓 grep 无调用点）与 `tgt.none`（30 张牌 `target` 全非空：self 13 / enemy 16 / other 1 ⇒ 恒零）；
 *   ④ 头数族以前有四种写法三种分母（`n/6`、`alive/6`、`pool.count=seats/6` 含自己、`aoeCount=opp/5` 不含自己），
 *      现统一到 `/10`（2.0 的目标人数上限）并删掉与 `alive` 重复的 `pool.count`；
 *      `pierceVsVisible`/`t1stance` 里混进的 `tauntActive`（义务，不是盾）与 `fireWeakNow`（各维已单列）删掉，
 *      `t1stance`→`t1guard`（只读 `baguaExtra`：决策时刻唯一真存在的架势力，见 `resolve.js:172`）。
 */

const SKILL_CLASS = ['energy', 'attack', 'defense', 'special'];

/* 观测面版本（ZCode · 10-31 凌晨，用户裁定"信息都给到 + 重构期直接做到位"）：
 *   'obs3'  = 在册 208 维（**逐字不变**，所有旧包/旧读数走它）；
 *   'obs3b' = 505 维 —— 补"过去几回合的实际使用技能与目标"（用户 10-31 03:0x 原话）：
 *     ① 席位 lastSkill：类别 5 位 → **键身份 one-hot 30 + lsNone**（v7 的 policy.js:233 给过
 *        `idxOf(op.lastSkill)`，obs3 把它降成了类别 ⇒ 这里恢复并按正交纪律替换类别位）；
 *     ② 席位加 **最近 K=4 回合键 bag 30**（2^-age 衰减、/1.875 归一）——池化 mean/max 后直接回答
 *        "对手群里最近谁用过 bigT/railgun"＝miniT/laserEye/railgun 桶语义判据的共同信号源；
 *     ③ 席位加 **最近 K=4 回合目标方向 bag 3**（同衰减）；
 *     ④ 自己的 Q.seq 每回合加 **键身份 one-hot 30**（新块 Q.id）。
 *   双面并存：容器 `dims.input` 是版本字段，arch2/policy2 按它分派 ⇒ 旧包照读，新臂选 obs3b。 */
export const OBS_VERSIONS = ['obs3', 'obs3b'];
const BAG_K = 4, BAG_NORM = 1.875;   /* 1 + 1/2 + 1/4 + 1/8 */

/* 结果类（对齐引擎实际出口；`by`/`reason`/`via` 是自由中文串 ⇒ **不可**当枚举用，只按 `type` 判） */
export const OUTCOME = ['landed', 'blocked', 'reflected', 'redirected', 'nullified', 'immune', 'prevented', 'whiffed'];
/* ⚑ `whiffed`（空放 / 打已死者）引擎**什么都不记**（`resolve.js:842 :882 :953 :997 :1195 :1229`、`:456`），
 *   只能由"递交回执 ok 且该卡家族里没有任何结果事件"反推 ⇒ 派生维，`dimgate` 会给它单列一条自证。 */

let _MAN = null, _SK = null;

function manifest(R, ver) {
  if (ver == null) ver = 'obs3';
  const key = ver + ':' + R.skills.length;
  if (_MAN && _SK === key) return _MAN;
  _SK = key;
  const b = ver === 'obs3b';
  const m = [];
  const add = (name, block, note) => m.push({ i: m.length, name, block, note: note || '' });

  ['n', 'alive', 'modeHp', 'round', 'shrink'].forEach((n) => add(n, 'G'));
  const SEAT = ['hp', 'ep', 'ringStreak', 'cannonCount', 'rodGuard', 'mineTurns', 'baguaExtra', 'fireWeakNow',
    'tauntActive', 'nightmare', 'vampire', 'infiniteEnergy', 'stickers', 'stickerMaxAge'];
  const SEAT_OLD_LS = ['lsEnergy', 'lsAttack', 'lsDefense', 'lsSpecial', 'lsNone'];
  const SEAT_TGT = ['lastTgtSelf', 'lastTgtMe', 'lastTgtOther'];
  SEAT.forEach((n) => add('self.' + n, 'S.self'));
  if (b) {
    R.skills.forEach((s) => add('self.lsKey.' + s.key, 'S.self'));   /* ⚑ obs3b：lastSkill 键身份（替代类别位） */
    add('self.lsNone', 'S.self');
  } else {
    SEAT_OLD_LS.forEach((n) => add('self.' + n, 'S.self'));
  }
  SEAT_TGT.forEach((n) => add('self.' + n, 'S.self'));
  if (b) {
    R.skills.forEach((s) => add('self.bag.' + s.key, 'S.self'));     /* ⚑ obs3b：最近 K=4 回合键 bag（2^-age 衰减） */
    ['tbag.tgtSelf', 'tbag.tgtMe', 'tbag.tgtOther'].forEach((n) => add('self.' + n, 'S.self'));
  }
  ['ownElec', 'ownBoom'].forEach((n) => add(n, 'S.private'));     /* ⚑ 只有自己可见的两枚 ⇒ 独立块，不进共享席位编码器 */
  const SEAT_ALL = b
    ? SEAT.concat(R.skills.map((s) => 'lsKey.' + s.key), ['lsNone'], SEAT_TGT, R.skills.map((s) => 'bag.' + s.key), ['tbag.tgtSelf', 'tbag.tgtMe', 'tbag.tgtOther'])
    : SEAT.concat(SEAT_OLD_LS, SEAT_TGT);
  SEAT_ALL.forEach((n) => add('pool.mean.' + n, 'P.opp'));
  SEAT_ALL.forEach((n) => add('pool.max.' + n, 'P.opp'));
  ['pool.sumStickers'].forEach((n) => add(n, 'P.add'));
  ['rel.mustHit', 'rel.tauntsMe', 'rel.chained', 'rel.mirroredMe', 'rel.targetedMe'].forEach((n) => add(n, 'R2'));
  for (let k = 0; k < 4; k++) {
    add('seq' + k + '.cat.energy', 'Q.seq'); add('seq' + k + '.cat.attack', 'Q.seq'); add('seq' + k + '.cat.defense', 'Q.seq'); add('seq' + k + '.cat.special', 'Q.seq');
    add('seq' + k + '.fam.atk', 'Q.seq'); add('seq' + k + '.fam.guard', 'Q.seq'); add('seq' + k + '.fam.thunder', 'Q.seq'); add('seq' + k + '.fam.reflectable', 'Q.seq');
    if (b) R.skills.forEach((s) => add('seq' + k + '.key.' + s.key, 'Q.id'));   /* ⚑ obs3b：自己序列的键身份 */
    add('seq' + k + '.out.landed', 'Q.out'); add('seq' + k + '.out.blocked', 'Q.out'); add('seq' + k + '.out.nullified', 'Q.out'); add('seq' + k + '.out.none', 'Q.out');
  }
  ['cost', 'pri', 'cat.energy', 'cat.attack', 'cat.defense', 'cat.special', 'tgt.self', 'tgt.one', 'tgt.two', 'tgt.all',
    'dmg', 'pierceDef', 'pierceRef', 'pierceTrans', 'continuous', 'needBead', 'beadIsElec', 'beadIsBoom',
    'affordOk', 'epMargin', 'beadAfford', 'killsTarget', 'reducesTarget', 'pierceVsVisible', 'aoeCount', 'aoeSumStickers',
    'endgame', 'hiddenReady', 'role1Source', 'role2Source',
    't1present', 't1hp', 't1ep', 't1bead', 't1stickers', 't1guard', 't1fireWeak', 't1obligation', 't1lowest', 't1targetedMe',
    't2present', 't2hp', 't2ep', 't2bead', 't2stickers', 't2guard', 't2fireWeak', 't2obligation', 't2lowest', 't2targetedMe', 't2hpDiff'].forEach((n) => add(n, 'C.cand'));
  R.skills.forEach((s) => add('skill.' + s.key, 'C.id'));       /* 动作身份：one-hot 在**本模式卡表全集**上 ⇒ 恒有一枚为 1，不与其他维重复 */
  _MAN = m;
  return m;
}
export function dims(R, ver) { return manifest(R || { skills: [] }, ver).length; }
export function blocks(R, ver) { return manifest(R || { skills: [] }, ver); }

/* ---- 席位向量（obs3=22 维 / obs3b=81 维；**公开可读**；mePid<0 ⇒ lastTgtMe 自然全 0）---- */
const NMAX = 10;              /* 2.0 的目标上限（用户 2.0 目标里写死 2–10 人）⇒ 人数族一律 /10，值域 ⊆ [0,1] */
function seatVec(p, mePid, modeHp, R, ver, recent) {
  const b = ver === 'obs3b';
  const st = (p.stickers || []);
  const head = [
    Math.max(0, p.hp) / modeHp, Math.min(p.ep, 12) / 12,
    Math.min(p.ringStreak || 0, 3) / 3, Math.min(p.cannonCount || 0, 9) / 9,
    Math.min(p.rodGuard || 0, 3) / 3, Math.min(p.mineTurns || 0, 3) / 3,
    p.baguaExtra ? 1 : 0, p.fireWeakNow ? 1 : 0,
    p.tauntActive ? 1 : 0, p.nightmare ? 1 : 0, p.vampire ? 1 : 0, p.infiniteEnergy ? 1 : 0,
    Math.min(st.length, 4) / 4, Math.min(st.reduce((a, s) => Math.max(a, (s && s.age) || 0), 0), 4) / 4,
  ];
  const tail = [
    p.lastTarget === p.id ? 1 : 0, (mePid >= 0 && p.lastTarget === mePid) ? 1 : 0,
    (p.lastTarget != null && p.lastTarget !== p.id && p.lastTarget !== mePid) ? 1 : 0,
  ];
  if (!b) {
    const cat = p.lastSkill && R.byKey[p.lastSkill] ? R.byKey[p.lastSkill].cat : null;
    const ci = SKILL_CLASS.indexOf(cat);
    return head.concat([
      ci === 0 ? 1 : 0, ci === 1 ? 1 : 0, ci === 2 ? 1 : 0, ci === 3 ? 1 : 0, p.lastSkill ? 0 : 1,
    ], tail);
  }
  /* ⚑ obs3b：lastSkill 键身份 one-hot（替代 5 个类别位——身份蕴含类别）+ lsNone；
   *  最近 K=4 回合键 bag（2^-age 衰减）与目标方向 bag，来自 recentAll 的一次反扫。 */
  const lsKey = new Array(R.skills.length).fill(0);
  const at = p.lastSkill ? R.skills.findIndex((s) => s.key === p.lastSkill) : -1;
  if (at >= 0) lsKey[at] = 1;
  const bag = new Array(R.skills.length).fill(0);
  const tbag = [0, 0, 0];
  const rec = recent && recent.get(p.id);
  if (rec) {
    for (const k in rec.bag) { const i = R.skills.findIndex((s) => s.key === k); if (i >= 0) bag[i] = rec.bag[k]; }
    tbag[0] = rec.tgt[0]; tbag[1] = rec.tgt[1]; tbag[2] = rec.tgt[2];
  }
  return head.concat(lsKey, [p.lastSkill ? 0 : 1], tail, bag, tbag);
}
const SEAT_N = 22;           /* obs3 的席位宽（旧读数指着它；obs3b 用 SEAT_NB，scene/encode 按版本取） */
const SEAT_NB = 81;          /* obs3b：14 状态 + 31 lastSkill(30 身份+1 none) + 3 目标 + 30 键 bag + 3 目标 bag */
/** 最近 K 回合的**全体**出手键 bag 与目标方向（一次反扫共用给所有活席；2^-age 衰减、/BAG_NORM 归一到 [0,1]）。
 *  ⚑ 依赖 state.js action 事件带 `target`（10-31 凌晨补的字段；旧对局记录没有 ⇒ 目标 bag 全 0，不炸）。 */
function recentAll(state, R, ids, mePid, K) {
  const ev = state.events || [];
  const need = new Map(); for (const id of ids) need.set(id, K);
  const bag = new Map(), tgt = new Map(), age = new Map();
  for (const id of ids) { bag.set(id, {}); tgt.set(id, [0, 0, 0]); age.set(id, 0); }
  for (let i = ev.length - 1; i >= 0; i--) {
    let left = 0; for (const id of ids) left += need.get(id) || 0;
    if (!left) break;
    const e = ev[i];
    if (e.type !== 'action' || e.pid == null || !need.has(e.pid) || !(need.get(e.pid) > 0)) continue;
    const a = age.get(e.pid), w = Math.pow(2, -a) / BAG_NORM;
    const bb = bag.get(e.pid); if (e.key) bb[e.key] = (bb[e.key] || 0) + w;
    const tg = tgt.get(e.pid);
    if (e.target === e.pid) tg[0] += w;                          /* 指向自己 */
    else if (e.target === mePid) tg[1] += w;                     /* 指向决策者 */
    else if (e.target != null && e.target !== e.pid) tg[2] += w; /* 指向第三者 */
    need.set(e.pid, need.get(e.pid) - 1);
    age.set(e.pid, a + 1);
  }
  const out = new Map();
  for (const id of ids) out.set(id, { bag: bag.get(id), tgt: tgt.get(id) });
  return out;
}

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

/** 自己最近 K=4 次出手。obs3：按回合交错发射 [cat4 fam4 out4]×4（**旧路逐字不动**——尽管它与 manifest 的
 *   Q.seq|Q.out 连续块声明不对齐，那是在册消融读数的语义，动它 = 破坏可比性，账记在 10-31 回执）。
 *  obs3b：**块连续**发射 [cat4 fam4]×4 ‖ [key30]×4 ‖ [out4]×4 ⇒ 与 manifest 的 Q.seq|Q.id|Q.out 严格对齐
 *   （消融/dimgate 按 block 清零时清的才是语义上那一块）。 */
function selfSeq(state, pid, R, ver) {
  const b = ver === 'obs3b';
  const ev = state.events || [];
  const acts = [];
  for (let i = ev.length - 1; i >= 0 && acts.length < 4; i--) { const e = ev[i]; if (e.type === 'action' && e.pid === pid && e.key) acts.push(e); }
  const per = [];   /* 每回合的三段 */
  for (let k = 0; k < 4; k++) {
    const a = acts[k];
    if (!a) { per.push([[0, 0, 0, 0, 0, 0, 0, 0], b ? new Array(R.skills.length).fill(0) : null, [0, 0, 0, 1]]); continue; }
    const def = R.byKey[a.key] || {};
    const ci = SKILL_CLASS.indexOf(def.cat);
    const ob = outcomeBits(state, pid, a.key);
    const landed = ob ? ob[0] : 0, blocked = ob ? (ob[1] || ob[2] || ob[3] || ob[4]) : 0;
    const catFam = [ci === 0 ? 1 : 0, ci === 1 ? 1 : 0, ci === 2 ? 1 : 0, ci === 3 ? 1 : 0,
      R.ATK_EFFECT.indexOf(a.key) >= 0 ? 1 : 0, R.GUARD_FAMILY.indexOf(a.key) >= 0 ? 1 : 0,
      R.LIGHTNING.indexOf(a.key) >= 0 ? 1 : 0, R.REFLECTABLE.indexOf(a.key) >= 0 ? 1 : 0];
    const keyOne = b ? (() => { const v = new Array(R.skills.length).fill(0); const at = R.skills.findIndex((s) => s.key === a.key); if (at >= 0) v[at] = 1; return v; })() : null;
    per.push([catFam, keyOne, [landed, blocked, ob && ob[4] ? 1 : 0, (!landed && !blocked) ? 1 : 0]]);
  }
  if (!b) {
    const out = [];
    for (const [cf, , o] of per) out.push(...cf, ...o);
    return out;
  }
  const s1 = [], s2 = [], s3 = [];
  for (const [cf, ki, o] of per) { s1.push(...cf); s2.push(...ki); s3.push(...o); }
  return [...s1, ...s2, ...s3];
}

/** 局面侧部件（与候选无关 ⇒ 一次决策只算一遍；arch2 的逐席集合编码与池化都从这里取）
 *  ver：'obs3'（缺省，逐字旧路）| 'obs3b'（席位 81 + 序列 168 + 键/目标 bag） */
export function scene(W, state, pid, ver) {
  const R = W.EpirusRules;
  const me = state.p[pid];
  const modeHp = (state.mode && state.mode.hp) || 3;
  /* ⚑ 分母必须走**本模式**的回合上限（引擎在 `resolve.js:1421` 读的就是 `state.mode.maxRounds`）：
   *   写死 `R.MAX_ROUNDS`=60 时，long 局里 `round` 这一维能读到 1.72（量程出界），
   *   而 `shrink` 这一维根本没有——10-30 实测 long 局 46.5% 的决策被旧 `endgame` 判成终局、真收缩只占 3.7%。 */
  const maxR = (state.mode && state.mode.maxRounds) || R.MAX_ROUNDS || 60;
  const sd = (state.mode && state.mode.suddenDeath != null) ? state.mode.suddenDeath : (R.SUDDEN_DEATH || 0);
  const alive = state.p.filter((q) => q.hp > 0);
  const g = [state.n / NMAX, alive.length / NMAX, modeHp / 5, Math.min(1, state.round / maxR),
    sd > 0 ? Math.min(1, state.round / sd) : 0];
  const priv = [Math.min(me.elec || 0, 2) / 2, Math.min(me.boom || 0, 2) / 2];
  const b = ver === 'obs3b';
  /* ⚑ obs3b：最近 K=4 回合的键/目标 bag——一次反扫共用给所有活席（含自己：自己的 bag 也是"我最近打谁"） */
  const recentMap = b ? recentAll(state, R, alive.map((q) => q.id), pid, BAG_K) : null;
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
    seats.push({ id: q.id, public: seatVec(q, pid, modeHp, R, ver, recentMap), rel, isSelf: q.id === pid ? 1 : 0, p: q });
  }
  const sums = [Math.min(sumSt, 12) / 12];
  const seatN = b ? SEAT_NB : SEAT_N;
  return { W, R, state, pid, me, modeHp, maxR, sd, alive, g, priv, seats, sums, seq: selfSeq(state, pid, R, ver), SEAT_W: seatN + 6, seatN, ver };
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
    def.target === 'self' ? 1 : 0, (!isAoe && !twoTgt && def.target) ? 1 : 0, (twoTgt && !isAoe) ? 1 : 0, isAoe ? 1 : 0,
    Math.min(dmg, 3) / 3, def.pierce && def.pierce.defense ? 1 : 0, def.pierce && def.pierce.reflect ? 1 : 0, def.pierce && def.pierce.transfer ? 1 : 0,
    def.continuous ? 1 : 0, def.energyNeeds ? 1 : 0, cand.bead === 'elec' ? 1 : 0, cand.bead === 'boom' ? 1 : 0,
    cost.ok ? 1 : 0, Math.max(-1, Math.min(1, (me.ep - c) / 4)), beadAfford,
    !!(t1 && dmg > 0 && dmg >= t1.hp) ? 1 : 0, dmg > 0 ? 1 : 0,
    /* ⚑ `pierceVsVisible` 只该看**决策时刻真存在的盾**：`baguaExtra` 是上回合架势过到本回合的唯一一位
     *   （`resolve.js:172` 的 `p.baguaExtra = !!p.guardNext`，而 `guardNext` 只由无极变速写）。
     *   旧写法把 `tauntActive`（挑衅义务）也算进"可见盾"——那不是盾，且它在 `t?obligation` 里已经各写一遍。 */
    !!(t1 && def.pierce && def.pierce.defense && t1.baguaExtra) ? 1 : 0,
    isAoe ? Math.max(0, oppN) / NMAX : 0, isAoe ? Math.min(sc.sums[0] * 12, 12) / 12 : 0,
    /* `endgame` = 本局真的进终局了：只剩两人 / 逼近**本模式**回合上限 / 已进入收缩掉血段 */
    (sc.alive.length <= 2 || sc.state.round >= sc.maxR - 4 || (sc.sd > 0 && sc.state.round >= sc.sd)) ? 1 : 0, hiddenReady ? 1 : 0,
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
    Math.min((q.stickers || []).length, 4) / 4, q.baguaExtra ? 1 : 0,
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
/* ===== 消融开关（第二十一段"哪几块承重"的账用的；**默认关** ⇒ 在册读数逐字不变）=====
 * 语义：把 MANIFEST 里属于这些**块**的维全写成 0（宽度不变 ⇒ 布局/死维闸/接线自证全不用改）。
 * 三条形状纪律：① 只许在装档之前设，且必须能关回去（`setAblate(null)` ⇒ 与从头到尾没开过逐字相同，selftest2 的 T17 钉这条）；
 *   ② 认不出来的块名**当场抛**（不许静默吞 ⇒ "我以为在消融、其实什么也没关"是⑩–⑯那一族病）；
 *   ③ 打印义务：任何开了它的读数都要把块名一起落盘（fit2 的 meta 里有 `ablock`）。 */
let ABLATE = null;
export function setAblate(names) {
  if (!names || !names.length) { ABLATE = null; return null; }
  ABLATE = new Set(names);
  return [...ABLATE];
}
export function ablateOn() { return ABLATE ? [...ABLATE] : null; }
export function isAblated(b) { return !!ABLATE && ABLATE.has(b); }
export function ablatableBlocks(R) { return [...new Set(manifest(R).map((r) => r.block))]; }

export function encode(W, state, pid, cand, ver) {
  if (ver == null) ver = 'obs3';
  const R = W.EpirusRules;
  const M = manifest(R, ver);
  const sc = scene(W, state, pid, ver), cp = candOf(sc, cand);
  const SN = sc.seatN;
  const out = [];
  const push = (...v) => { for (const x of v) out.push(Number.isFinite(x) ? x : 0); };
  push(...sc.g);
  const selfSeat = sc.seats.find((s) => s.isSelf) || sc.seats[0];
  push(...selfSeat.public, ...sc.priv);
  const opps = sc.seats.filter((s) => !s.isSelf);
  const mean = new Array(SN).fill(0), max = new Array(SN).fill(0);
  for (const s of opps) { for (let j = 0; j < SN; j++) { mean[j] += s.public[j] / Math.max(1, opps.length); if (s.public[j] > max[j]) max[j] = s.public[j]; } }
  push(...mean, ...max, ...sc.sums);
  const relAny = [0, 0, 0, 0, 0];
  for (const s of opps) for (let j = 0; j < 5; j++) if (s.rel[j]) relAny[j] = 1;
  push(...relAny);
  push(...sc.seq);
  push(...cp.base);
  push(cp.t1 ? 1 : 0, ...targetScalars(sc, cp.t1));
  push(cp.t2 ? 1 : 0, ...targetScalars(sc, cp.t2), (cp.t1 && cp.t2) ? Math.abs(cp.t1.hp - cp.t2.hp) / sc.modeHp : 0);
  push(...cp.idOne);
  if (out.length !== M.length) throw new Error('obs3 布局不自洽（' + ver + '）：拼出 ' + out.length + ' 列 ‖ MANIFEST 声明 ' + M.length + ' 列 ⇒ 差 ' + (out.length - M.length) + ' 列（这条就是 1584 死权重那次的守卫）');
  if (ABLATE) {
    const seen = {};
    for (let i = 0; i < out.length; i++) { const b = M[i].block; if (ABLATE.has(b)) { out[i] = 0; seen[b] = (seen[b] || 0) + 1; } }
    for (const b of ABLATE) if (!seen[b]) throw new Error('消融的块名 `' + b + '` 在 MANIFEST 里不存在 ⇒ 这一路根本没关任何东西（别拿"关掉后没变化"当结论）');
  }
  return out;
}
export { SEAT_N };
