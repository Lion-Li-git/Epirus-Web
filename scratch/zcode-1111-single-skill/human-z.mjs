/* pickHumanZ —— ZCode 的规则理解·类人席 v1（2026-11-12 凌晨）
 * 设计目标（PLAN §2.2）：按规则对局、无固定风格面；与 pickAdaptive 的差异点：
 *   ① N 人桌感知（pickAdaptive 是 oppOf 单对手语义）：威胁 = 所有 ep≥5 的对手（大雷位）；
 *   ② 伤害面轮换（gun/sword/tank/snipe 按回合轮换起步，不偏一面 ⇒ 压低对行为特征的伪相关）；
 *   ③ 经济链完整（ji→charge 电珠→次回合电磁炮；ring 连用续环）；
 *   ④ 架势应答穿透优先（坦克穿防御、剑穿反弹、狙击可被打断放后面）。
 * 返回卡 key（引擎选目标）；纯函数（除 state 外无记忆，可复现）。
 * 用法：被 botseat-eval.mjs / 夹具 --champbot= 以模块导入：import { pickHumanZ } from '.../human-z.mjs' */
const SK = { JI: 'ji', CHARGE: 'charge', RING: 'ring', GUN: 'gun', SWORD: 'sword', TANK: 'tank', SNIPE: 'snipe',
  GUARD: 'guard', REFLECT: 'reflect', BAGUA: 'bagua', SHIFT: 'shift', JINSHIELD: 'jinshield', ARMOR: 'armor',
  PROTO: 'proto', HOLO: 'holo', DRAIN: 'drain', RAILGUN: 'railgun', MINI_T: 'miniT', BIG_T: 'bigT',
  ROD: 'rod', LASER_EYE: 'laserEye', TRANSFER: 'transfer', CURSE: 'curse', FIRESTORM: 'firestorm',
  MINE: 'mine', TAUNT: 'taunt', CANNON: 'cannon', PURIFY: 'purify', DUAL_GUN: 'dualGun', MIRROR: 'mirror' };
const OFFENSE_ROT = [SK.GUN, SK.SWORD, SK.TANK, SK.SNIPE];   // 伤害面轮换（回合+座位步进）
export function pickHumanZ(state, pid, legal) {
  const me = state.p[pid];
  const byKey = {}; legal.forEach((l) => { byKey[l.key] = l; });
  const aff = (k) => !!byKey[k] && byKey[k].affordable;
  const foes = state.p.map((p, i) => ({ p, i })).filter((x) => x.i !== pid && x.p.hp > 0);
  if (!foes.length) return aff(SK.JI) ? SK.JI : (legal.find((l) => l.affordable) || {}).key || SK.JI;
  const stanceOf = (p) => { const s = p.lastSkill;
    if (s === SK.GUARD || s === SK.SHIFT) return 'guard';
    if (s === SK.REFLECT || s === SK.PROTO || s === SK.JINSHIELD || s === SK.ARMOR || s === SK.BAGUA) return 'reflect';
    return 'none'; };
  const threats = foes.filter((x) => x.p.ep >= 5);
  const rich = foes.filter((x) => x.p.ep >= 3);
  const reflecters = foes.filter((x) => stanceOf(x.p) === 'reflect');
  const defenders = foes.filter((x) => stanceOf(x.p) !== 'none');
  const weakest = foes.slice().sort((a, b) => a.p.hp - b.p.hp)[0];
  const rot = (n) => OFFENSE_ROT[(state.round + pid + n) % OFFENSE_ROT.length];

  /* 1) 保命与窗口 */
  if (me.hp <= 1 && aff(SK.DRAIN)) return SK.DRAIN;                       // 摄魂：自愈 1（HP≤1 才可用）
  if (me.stickers && me.stickers.length >= 2 && aff(SK.PURIFY)) return SK.PURIFY;
  if (me.hp <= 2 && threats.length && aff(SK.PROTO)) return SK.PROTO;     // 大雷威胁位在桌 → 原型制御
  if (me.hp <= 2 && threats.length && aff(SK.GUARD)) return SK.GUARD;
  /* 2) 挑衅应答：穿透优先（挑衅要"造成伤害"才算合规） */
  if (me.tauntActive) { for (const k of [SK.TANK, SK.SWORD, SK.GUN, SK.SNIPE, SK.CANNON, SK.RAILGUN]) if (aff(k)) return k; }
  /* 3) 对手架势：坦克穿防御 / 剑穿反弹；狙击会被攻击打断，放最后 */
  if (defenders.length) {
    if (reflecters.length && aff(SK.SWORD)) return SK.SWORD;
    if (aff(SK.TANK)) return SK.TANK;
    if (reflecters.length && aff(SK.SNIPE)) return SK.SNIPE;
  }
  /* 4) 斩杀：最弱目标 hp≤1.5 → 最大伤害面（电磁炮 2 点带头）；v2：弱敌在桌就不闭眼攒钱（治被农夫+狙击放血） */
  if (weakest && weakest.p.hp <= 1.5) {
    if (me.elec > 0 && aff(SK.RAILGUN)) return SK.RAILGUN;
    for (const k of [SK.TANK, SK.SWORD, SK.CANNON, SK.GUN, SK.SNIPE]) if (aff(k)) return k;
  }
  if (weakest && weakest.p.hp <= 2.5) {
    const k = rot(1); if (aff(k)) return k;
    for (const k of OFFENSE_ROT) if (aff(k)) return k;
  }
  /* 5) 经济链：ji→charge 电珠→次回合电磁炮；环连用续环。
   *    v2：蓄能只在"桌上有 ≥2 个威胁位或自己血量健康"时做（治 v1 被农夫拖进慢局） */
  if (me.ep < 3 && aff(SK.JI)) return SK.JI;
  if ((me.ringStreak || 0) > 0 && aff(SK.RING)) return SK.RING;
  if (me.ep >= 2 && me.elec === 0 && me.hp >= 3 && aff(SK.CHARGE)) return SK.CHARGE;
  if (me.elec > 0 && aff(SK.RAILGUN)) return SK.RAILGUN;
  /* 6) 大雷：ep≥5 且桌上有富敌（至少一个 ep≥3）才劈 */
  if (me.ep >= 5 && rich.length && aff(SK.BIG_T)) return SK.BIG_T;
  /* 7) 地雷：≥2 富敌且自己安全 */
  if (rich.length >= 2 && me.hp > 2 && aff(SK.MINE)) return SK.MINE;
  /* 8) 一般进攻：轮换伤害面起步（不偏一面），再顺延其余 */
  { const k = rot(0); if (aff(k)) return k; }
  for (const k of OFFENSE_ROT) if (aff(k)) return k;
  /* 9) 低血防御 */
  if (me.hp <= 2 && aff(SK.GUARD)) return SK.GUARD;
  if (aff(SK.JI)) return SK.JI;
  const a = legal.find((l) => l.affordable);
  return a ? a.key : SK.JI;
}
