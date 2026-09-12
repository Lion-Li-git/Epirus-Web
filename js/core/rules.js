/* Epirus 拍手游戏 — 技能/规则数据定义层（纯数据 + 分类表，无状态）
 * 语义裁定见 docs/RULES-2P.md（裁决 R1..R54）。本文档与代码一一对应。
 */
(function (global) {
  'use strict';

  const SK = {
    JI: 'ji', CHARGE: 'charge', RING: 'ring',
    GUN: 'gun', SWORD: 'sword', TANK: 'tank', SNIPE: 'snipe',
    GUARD: 'guard', REFLECT: 'reflect', BAGUA: 'bagua', SHIFT: 'shift',
    JINSHIELD: 'jinshield', ARMOR: 'armor', PROTO: 'proto', HOLO: 'holo',
    DRAIN: 'drain', RAILGUN: 'railgun', MINI_T: 'miniT', BIG_T: 'bigT',
    ROD: 'rod', LASER_EYE: 'laserEye', TRANSFER: 'transfer', CURSE: 'curse',
    FIRESTORM: 'firestorm', MINE: 'mine', TAUNT: 'taunt', CANNON: 'cannon',
    PURIFY: 'purify',
    // 多人专用（2人局不开放，UI 置灰）
    DUAL_GUN: 'dualGun', MIRROR: 'mirror'
  };

  const CAT = { ENERGY: 'energy', ATTACK: 'attack', DEFENSE: 'defense', SPECIAL: 'special' };
  const DMG = { NORMAL: 'normal', LIGHT: 'light', FIRE: 'fire', ELECTRIC: 'electric', FIRELIGHT: 'firelight' };  // N18 光&火复合

  // cost 描述：number = 固定ジ；函数在 state 上下文求值（聚能环/过载炮/激光眼）
  function mk(key, name, cat, cost, pri, target, opts) {
    opts = opts || {};
    return Object.assign({
      key, name, cat, cost, pri, target,
      desc: opts.desc || '',
      gesture: opts.gesture || '',
      dmg: opts.dmg || null,          // {amt, type}
      pierce: opts.pierce || {},      // {defense, reflect, transfer}
      continuous: !!opts.continuous,  // 触发“连续使用”计数族
      energyNeeds: opts.energyNeeds || null // {elec, boom}
    }, opts.extra || {});
  }

  const skills = [
    // ---- 能量类 ----
    mk(SK.JI, 'ジ', CAT.ENERGY, 0, 3, 'self', { desc: '获得 1 个ジ', gesture: '双手握拳分开' }),
    /* v1.4.7 修正 desc：原文写"可累加"与 R9' 实现矛盾（resolve.js:790-796 是
     * `keep = p.beadNew || null` ⇒ 同类珠上限 1、只保留到下一回合、回合末清空），
     * 而 ui.js:131 把这个 desc 原样放进技能按钮的悬停提示 ⇒ 是**玩家可见的错误规则**。
     * 第十轮复核 §6-1 报的这条，读码与事件流双向确认。 */
    mk(SK.CHARGE, '蓄能', CAT.ENERGY, 1, 3, 'self', { desc: '获得 1 枚能量珠（电/爆自选）；只保留到下一回合，同类珠最多 1 枚', gesture: '双手握拳相并' }),
    mk(SK.RING, '聚能环', CAT.ENERGY, null, 3, 'self', {
      desc: '首次 +1ジ(花费3)，连续第2次 +2ジ，第3次起 +3ジ', gesture: '双手握拳上下相叠', continuous: true
    }),
    // ---- 攻击类 ----
    mk(SK.GUN, '枪', CAT.ATTACK, 1, 2, 'enemy', { desc: '1 点普通伤害', gesture: '双手枪型手势', dmg: { amt: 1, type: DMG.NORMAL } }),
    mk(SK.SWORD, '激光剑', CAT.ATTACK, 2, 3, 'enemy', { desc: '1 点光伤害，可攻破反弹', gesture: '双手相扣枪型手势', dmg: { amt: 1, type: DMG.LIGHT }, pierce: { reflect: true } }),
    mk(SK.TANK, '坦克', CAT.ATTACK, 2, 3, 'enemy', { desc: '1 点火焰伤害，可攻破防御和转移伤害', gesture: '右手枪型+左手托底', dmg: { amt: 1, type: DMG.FIRE }, pierce: { defense: true, transfer: true } }),
    mk(SK.SNIPE, '狙击枪', CAT.ATTACK, 2, 1, 'enemy', { desc: '1 点伤害，攻破反弹与防御；带攻击效果技能可使狙击无效；无影响时判定爆头', gesture: '双手枪型前后相接', dmg: { amt: 1, type: DMG.NORMAL }, pierce: { defense: true, reflect: true } }),
    // ---- 防御类 ----
    mk(SK.GUARD, '防御', CAT.DEFENSE, 0, 3, 'self', { desc: '阻止部分技能伤害', gesture: '双臂交叉于胸前' }),
    mk(SK.REFLECT, '反弹', CAT.DEFENSE, 0, 3, 'self', { desc: '阻挡并把 枪/坦克 伤害反弹给作用者', gesture: '手心朝内指尖相对于面前' }),
    mk(SK.BAGUA, '八卦阵', CAT.DEFENSE, 0, 3, 'self', { desc: '判定胜则阻止部分技能伤害', gesture: '双手抱球状于面前' }),
    mk(SK.SHIFT, '无极变速', CAT.DEFENSE, 1, 3, 'self', { desc: '同两个回合的八卦阵', gesture: '一手伸平一手叉指于掌' }),
    mk(SK.JINSHIELD, '金刚盾', CAT.DEFENSE, 1, 3, 'self', { desc: '同防御；判定胜则攻击者受 1 点伤害', gesture: '双手握拳交叉于胸前' }),
    mk(SK.ARMOR, '藤甲', CAT.DEFENSE, 1, 3, 'enemy', { desc: '同反弹；贴在对手身上，使其下回合受火焰伤害+1', gesture: '手指交叉掌心向外' }),
    mk(SK.PROTO, '原型制御', CAT.DEFENSE, 1, 3, 'self', { desc: '阻挡除地雷、转移伤害外的技能伤害', gesture: '双手握拳竖立于胸前' }),
    /* v1.5.4 规则修正（回到原始规则集 `D:\code\Epirus\README.md` 的「全息屏障」条目）：
     * 原文 = 「作用效果：给**被作用者**施加一个"原型制御"」+ 手势「双臂伸出挡住**被作用者**胸前」
     * ⇒ 它是**一张对别人用的盾**，不是自保卡。此前 `target: 'self'`（R18）把两张卡做成了同效果
     * （写两个一样的技能没有意义）。目标 = 任一**其他**玩家（`opponentsOf`，不可能是自己）。 */
    mk(SK.HOLO, '全息屏障', CAT.DEFENSE, 1, 3, 'other', { desc: '给目标施加一回合“原型制御”', gesture: '双臂伸出挡住被作用者胸前' }),
    // ---- 特殊类 ----
    mk(SK.DRAIN, '摄魂指法', CAT.SPECIAL, 3, 3, 'enemy', { desc: '1 点伤害；命中则自愈 1 血；仅限 HP≤1；可与攻击抵消', gesture: '食指回勾握拳', dmg: { amt: 1, type: DMG.NORMAL } }),
    mk(SK.RAILGUN, '电磁炮', CAT.SPECIAL, 2, 3, 'enemy', { desc: '2 点电伤害，攻破反弹与防御；需 1 电珠', gesture: '拇指按食指弹出', dmg: { amt: 2, type: DMG.ELECTRIC }, pierce: { defense: true, reflect: true }, energyNeeds: { elec: 1 } }),
    mk(SK.MINI_T, '雷击之枪', CAT.SPECIAL, 2, 5, 'enemy', { desc: '使目标技能无效（防御/反弹/原型制御豁免）；互雷成环无效', gesture: '单手由上而下' }),
    mk(SK.BIG_T, '真正的落雷', CAT.SPECIAL, 5, 4, 'enemy', { desc: '2 点电伤害；目标非防御类技能无效；3 回合禁用（防御/反弹/金刚盾/ジ 豁免）', gesture: '双手由上而下', dmg: { amt: 2, type: DMG.ELECTRIC } }),
    mk(SK.ROD, '避雷针', CAT.SPECIAL, 4, 3, 'self', { desc: '当回合雷系技能全部无效，雷系使用者受 1 电伤并回馈ジ；否则 3 回合内免雷', gesture: '双手食指相握' }),
    mk(SK.LASER_EYE, '激光眼', CAT.SPECIAL, null, 3, 'enemy', {
      desc: '无效化目标任意防御类(含原型制御/全息)/转移伤害；否则 1 点光伤害。首次 1ジ+1爆珠，连续使用 2ジ', gesture: '双指相对',
      energyNeeds: { boom: 1 }
    }),
    mk(SK.TRANSFER, '转移伤害', CAT.SPECIAL, 2, 1, 'enemy', { desc: '本回合所受可转移伤害转给目标（坦克不可转移）', gesture: '双手相扣' }),
    mk(SK.CURSE, '贴贴', CAT.SPECIAL, 1, 3, 'enemy', { desc: '给目标贴 1 枚符咒（可被防御类阻挡）', gesture: '掌心相贴划出' }),
    mk(SK.FIRESTORM, '天火', CAT.SPECIAL, 2, 3, 'enemy', { desc: '引爆自己贴出且停留≤3回合的符咒，每枚 1 火伤（可被原型制御挡）；符咒仍存', gesture: '一手竖直敲击掌心' }),
    mk(SK.MINE, '地雷', CAT.SPECIAL, 3, 0, 'self', { desc: '被非狙击枪攻击时，**除自己外全场其他角色**各受 1 点火伤；被打中的持雷者会间接触发（所有间接触发合并为一波，且不伤害间接触发者）；地雷伤害无来源', gesture: '握拳+左手托底' }),
    mk(SK.TAUNT, '挑衅', CAT.SPECIAL, 2, 3, 'enemy', { desc: '目标下回合必须使用攻击类技能，否则 -1 血', gesture: '手背朝下回勾' }),
    mk(SK.CANNON, '过载炮', CAT.SPECIAL, null, 3, 'enemy', { desc: '按使用次数循环：1 次 1伤；2 次 1伤+失ジ；3 次 1伤+失ジ+自损 1 血。**新规：可打穿防御与反弹，但会被任何攻击类技能抵消**', gesture: '握拳手背朝下' }),
    mk(SK.PURIFY, '净化', CAT.SPECIAL, 3, 1, 'self', { desc: '清除自身持续负面状态并移除身上符咒，每枚回复 1 血（n-1规则）', gesture: '双手正立相扣' }),
    // ---- 多人专用（2人局置灰）----
    mk(SK.DUAL_GUN, '双枪射手', CAT.ATTACK, 3, 3, 'enemy', { desc: '（多人）对两个角色同时使用“枪”', dmg: { amt: 1, type: DMG.NORMAL } }),
    mk(SK.MIRROR, '镜面反射', CAT.SPECIAL, 3, 3, 'enemy', { desc: '（多人）复制目标 1 本回合的伤害技能，对目标 2 施加；复制双枪只算一枪' })
  ];

  const byKey = {};
  skills.forEach(function (s) { byKey[s.key] = s; });

  // 分类表（2 人局可用清单 / 攻击判定集 / 挑衅满足集 / 雷系集 / 防御类集）
  const MULTI_ONLY = [SK.DUAL_GUN, SK.MIRROR];
  const AVAILABLE_2P = skills.filter(function (s) { return MULTI_ONLY.indexOf(s.key) < 0; });

  // “带攻击效果”技能（狙击易受影响 / 可抵消攻击同层相抵也用它判定）
  const ATK_EFFECT = [SK.GUN, SK.SWORD, SK.TANK, SK.SNIPE, SK.DRAIN, SK.RAILGUN, SK.LASER_EYE, SK.CANNON];
  // 挑衅合规 = 对敌方造成伤害的攻击向技能（含特殊类攻击性技能）— R41
  const TAUNT_SATISFY = [SK.GUN, SK.SWORD, SK.TANK, SK.SNIPE, SK.DRAIN, SK.RAILGUN, SK.CANNON, SK.LASER_EYE, SK.DUAL_GUN];
  const LIGHTNING = [SK.RAILGUN, SK.MINI_T, SK.BIG_T];
  // 防御类家族（大雷效果2豁免 / 贴贴阻挡判断用）
  const GUARD_FAMILY = [SK.GUARD, SK.REFLECT, SK.BAGUA, SK.SHIFT, SK.JINSHIELD, SK.ARMOR, SK.PROTO, SK.HOLO];
  // 小雷豁免：仅防御/反弹/原型制御
  const MINI_T_IMMUNE = [SK.GUARD, SK.REFLECT, SK.PROTO];
  // 反弹可反射的攻击（README 仅 枪/坦克）
  const REFLECTABLE = [SK.GUN, SK.TANK];

  // 连续使用计数族（聚能环）；激光眼连续由 lastSkill 判断

  // N9/N14：3-5 人启用全部技能（含多人专用 双枪射手 / 镜面反射）
  const AVAILABLE_MULTI = skills;

  const MODES = {
    standard: { name: '标准模式', hp: 3, skills: AVAILABLE_2P, rule: '' },
    multi: { name: '多人模式(3-5人)', hp: 3, skills: AVAILABLE_MULTI, rule: '', minPlayers: 3, maxPlayers: 5, drainHpMax: 1 },
    /* v1.4.0 长程模式（5 血）—— 用户 2026-09-12 提出：线下靠多人混乱达成平衡，
     * 程序里 3 血让最优线"太明显"。算术上确实如此：v1.3.60 实测 ep 收入只有 +1/回合
     * （resolve.js:501 只有 ジ 给），所以任何 ≥2 ジ 的卡都要 2+ 回合攒钱，而任何多回合轨迹
     * 都在跟 ~3 回合的存活期望赛跑 —— 转移伤害的前置条件命中率只有 0.2%、贴贴叠不到 2 张、
     * 地雷攒 3 ジ 的时间 > 存活时间。5 血把存活期望翻倍，正好用来检验"轨迹类策略是否解冻"。
     * drainHpMax：摄魂指法原为写死的 HP≤1（R25）；5 血下那扇窗太窄，提到 3。
     * 实测（v1.4.0，1400 局/臂）：3 血平均 **43.3 回合**、5 血只到 **49.8 回合**（+15% 而非 +67%），
     * 且 5 血时主体场均承伤只有 **4.28 < 5** ⇒ 全局 MAX_ROUNDS=60 把 5 血局**截断了**
     * （不是被打死，是到上限按"血最多者胜"结束）。故长程模式配 maxRounds:100。 */
    /* v1.4.8 终局收缩（用户 2026-09-12 方案）：硬截断改成"到点后每轮全员 −1 血"。
     * 动机（第十轮复核 §5.1 实测）：100 回合上限在防守型考卷上仍有 90% 的局是哨声判掉的，
     * 而且 5 血比 3 血更容易拖到点（E 卷 36.9%→49.2%）⇒ 有一半样本测的是"到时谁血多"，
     * 不是"谁把谁打死"。suddenDeath=100 起每回合末全员 −1（不可格挡、不触发地雷），
     * maxRounds=140 只作安全网（正常情况在 ~105 回合就清完）。 */
    long: { name: '长程模式(5血·3-5人)', hp: 5, skills: AVAILABLE_MULTI, rule: '', minPlayers: 3, maxPlayers: 5, drainHpMax: 3, suddenDeath: 100, maxRounds: 140 },
    fast: { name: '快速模式', hp: 1, skills: [SK.JI, SK.GUN, SK.GUARD], rule: '防御不能连续使用 3 次', guardLimit: 2 },
    lucky: { name: '欧皇模式', hp: 3, skills: [SK.JI, SK.JINSHIELD, SK.BAGUA, SK.GUN], rule: '' }
  };

  const MODE_DEFAULT = 'standard';
  const MAX_ROUNDS = 60; // R1 防死锁

  global.EpirusRules = {
    SK, CAT, DMG, skills, byKey, MULTI_ONLY, AVAILABLE_2P, AVAILABLE_MULTI,
    ATK_EFFECT, TAUNT_SATISFY, LIGHTNING, GUARD_FAMILY, MINI_T_IMMUNE,
    REFLECTABLE, MODES, MODE_DEFAULT, MAX_ROUNDS
  };
})(typeof window !== 'undefined' ? window : globalThis);
