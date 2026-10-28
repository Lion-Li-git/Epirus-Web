#!/usr/bin/env node
/* obs2.mjs — 2.0 观测集编码器（第一版 · 2026-10-28 夜 DS）
 *
 * 与 v7 的区别不是"加维"，是换编码：事实只写一次；派生量单独一层；只记公开信息（对手珠类型不可知）；
 * 每个历史事件带**结果类**（命中 / 被挡或被弹 / 被无效 / 空放），因为藤甲/无极变速可能被激光眼、小雷大雷打掉。
 *
 * 布局 76 维（`MANIFEST` 可机读；顺序与 `encode` 的 push 顺序逐位对应）：
 *   L0 8 ‖ 自己 13（资源4+状态8+冷却1）‖ 自己历史 8 ‖ 威胁对手 12（资源4+状态8）‖ 对手历史 8
 *   ‖ L2 关系 4 ‖ L3 动作事实 16 ‖ L4 派生 7
 */

const SKILL_CLASS = ['energy', 'attack', 'defense', 'special'];

export const MANIFEST = (() => {
  const m = [];
  const add = (n, b) => m.push({ i: m.length, name: n, block: b });
  ["N", "alive", "maxHp", "round", "shrinkStart", "soulMin", "long", "epPerTurn"].forEach((n) => add(n, "L0"));
  ["hp", "ep", "elec", "boom"].forEach((n) => add(n, "S1.res"));
  ["mineTurns", "rodGuard", "ringStreak", "cannonPhase", "stickers", "revive", "vampire", "nightmare"].forEach((n) => add(n, "S1.st"));
  add("cooldown", "S1.st");
  ["lastSkill", "tgtSelf", "tgtMe", "tgtOther", "outHit", "outBlocked", "outNull", "outNone"].forEach((n) => add(n, "S1.hist"));
  ["hp", "ep", "elec", "boom"].forEach((n) => add(n, "S2.res"));
  ["mineTurns", "rodGuard", "ringStreak", "cannonPhase", "stickers", "revive", "vampire", "nightmare"].forEach((n) => add(n, "S2.st"));
  ["lastSkill", "tgtSelf", "tgtMe", "tgtOther", "outHit", "outBlocked", "outNull", "outNone"].forEach((n) => add(n, "S2.hist"));
  ["tauntBy", "chained", "targetedMe", "mirrored"].forEach((n) => add(n, "L2"));
  ["cost", "cat", "atk", "guard", "light", "dmg", "pierceDef", "pierceRef", "pierceTrans", "tgtEnemy", "tgtSelf", "continuous", "beadElec", "beadBoom", "costOk", "epMargin"].forEach((n) => add(n, "L3"));
  ["afford", "beadAfford", "kills", "pierceVsVisible", "aoe", "endgame", "hiddenTrig"].forEach((n) => add(n, "L4"));
  return m;
})();
export function dims() { return MANIFEST.length; }

/* 最近一次动作的结果类：0 命中 / 1 被挡或被弹 / 2 被无效 / 3 空放或未定 */
export function lastOutcome(state, pid) {
  const p = state.p[pid];
  const key = p.lastSkill;
  if (!key) return 3;
  const ev = state.events || [];
  let hit = false, blocked = false, nulled = false;
  for (let i = ev.length - 1, n = 0; i >= 0 && n < 80; i--, n++) {
    const e = ev[i];
    if (e.type === 'blocked' || e.type === 'cancel' || e.type === 'curseBlock') blocked = true;
    else if (e.type === 'reflect') blocked = true;
    else if (e.type === 'damage' && e.via === key) hit = true;
    else if (e.type === 'hidden' || e.type === 'mirrorNoEffect' || e.type === 'rod' || e.type === 'ban') nulled = true;
  }
  if (hit) return 0;
  if (nulled) return 2;
  if (blocked) return 1;
  return 3;
}

/* 单席位 21 维：资源 4 + 状态 8 + 冷却 1 + 历史 8（自己用 mePid=-1 ⇒ tgtMe 恒 0） */
function seatVec(state, pid, maxHp, R, mePid) {
  const p = state.p[pid];
  const res = [p.hp / maxHp, Math.min(p.ep, 12) / 12, Math.min(p.elec || 0, 1), Math.min(p.boom || 0, 1)];
  const st = [
    (p.mineTurns || 0) / 3,
    Math.min(p.rodGuard || 0, 3) / 3,
    Math.min(p.ringStreak || 0, 3) / 3,
    ((p.cannonCount || 0) % 3) / 3,
    Math.min((p.stickers || []).length, 4) / 4,
    (p.reviveNext || p.infiniteEnergy) ? 1 : 0,
    p.vampire ? 1 : 0,
    p.nightmare ? 1 : 0,
  ];
  const cd = Object.keys(p.cooldown || {}).reduce((s, k) => s + ((p.cooldown[k] || 0) > 0 ? 1 : 0), 0);
  const ls = (p.lastSkill && R.skills) ? (R.skills.findIndex((s) => s.key === p.lastSkill) + 1) / (R.skills.length + 1) : 0;
  const lt = p.lastTarget;
  const oc = lastOutcome(state, pid);
  const hist = [ls,
    lt === p.id ? 1 : 0,
    (mePid >= 0 && lt === mePid) ? 1 : 0,
    (lt != null && lt !== p.id && lt !== mePid) ? 1 : 0,
    oc === 0 ? 1 : 0, oc === 1 ? 1 : 0, oc === 2 ? 1 : 0, oc === 3 ? 1 : 0];
  return { res, st, cd: Math.min(cd, 6) / 6, hist };
}

export function encode(W, state, pid, cand) {
  const R = W.EpirusRules, S = W.EpirusState;
  const me = state.p[pid];
  const maxHp = (state.mode && state.mode.hp) || 3;
  const n = state.p.length;
  const alive = state.p.filter((q) => q.hp > 0).length;
  const maxRounds = (state.mode && state.mode.maxRounds) || 60;
  const out = [];
  /* L0 */
  out.push(n / 5, alive / 5, maxHp / 5, state.round / maxRounds,
    Math.min((state.mode && state.mode.shrinkStart) || maxRounds, maxRounds) / maxRounds,
    Math.min((state.mode && state.mode.soulHpMin) || 1, 5) / 5,
    (state.mode && state.mode.name === 'long') ? 1 : 0, 1 / 3);
  /* 自己 */
  const a = seatVec(state, pid, maxHp, R, -1);
  out.push(...a.res, ...a.st, a.cd, ...a.hist);
  /* 威胁席 = 存活且 hp 最低的对手（v7 的 threat 定义见 policy.oppAgg；这里先取最脆的那个） */
  let opp = null;
  for (const q of state.p) if (q.id !== pid && q.hp > 0 && (!opp || q.hp < opp.hp)) opp = q;
  if (opp) {
    const b = seatVec(state, opp.id, maxHp, R, pid);
    out.push(...b.res, ...b.st, ...b.hist);
  } else out.push(...new Array(20).fill(0));
  /* L2 关系 */
  out.push((me.tauntBy || []).length ? 1 : 0, (me.chains || []).length ? 1 : 0,
    (opp && opp.lastTarget === pid) ? 1 : 0,
    0);  /* mirrored：等事件流接入（现在恒 0，标注为占位） */
  /* L3 动作事实 */
  const cost = S.computeCost(state, pid, cand.key);
  const def = R.byKey[cand.key] || {};
  const c = cost.ok && typeof cost.ep === 'number' ? cost.ep : (def.cost || 0);
  const dmg = (def.dmg && def.dmg.amt) || 0;
  out.push(Math.min(c, 6) / 6, (SKILL_CLASS.indexOf(def.cat) + 1) / 4,
    R.ATK_EFFECT.indexOf(cand.key) >= 0 ? 1 : 0, R.GUARD_FAMILY.indexOf(cand.key) >= 0 ? 1 : 0,
    R.LIGHTNING.indexOf(cand.key) >= 0 ? 1 : 0, Math.min(dmg, 3) / 3,
    def.pierce && def.pierce.defense ? 1 : 0, def.pierce && def.pierce.reflect ? 1 : 0, def.pierce && def.pierce.transfer ? 1 : 0,
    def.target === 'enemy' ? 1 : 0, def.target === 'self' ? 1 : 0, def.continuous ? 1 : 0,
    cand.bead === 'elec' ? 1 : 0, cand.bead === 'boom' ? 1 : 0, cost.ok ? 1 : 0,
    Math.max(-1, Math.min(1, (me.ep - c) / 12)));
  /* L4 派生 */
  const target = (cand.target != null && state.p[cand.target]) ? state.p[cand.target] : null;
  const kills = (target && dmg > 0 && dmg >= target.hp) ? 1 : 0;
  const pierceVs = (target && target.baguaExtra && def.pierce && def.pierce.defense) ? 1 : 0;
  const beadAfford = cand.bead === 'elec' ? Math.min(me.elec, 1) : cand.bead === 'boom' ? Math.min(me.boom, 1) : 1;
  out.push(Math.max(-1, Math.min(1, (me.ep - c) / 12)), beadAfford, kills, pierceVs, alive / 5,
    (alive <= 2 || state.round >= maxRounds - 2) ? 1 : 0,
    ((me.chains || []).length && cand.key === R.SK.DRAIN) ? 1 : 0);
  return out;
}
