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
    mk(SK.FIRESTORM, '天火', CAT.SPECIAL, 2, 3, 'self', { desc: '引爆自己贴出且停留≤3回合的符咒（**全场所有目标**，不需要选目标），每个目标每枚 1 火伤（可被原型制御挡）；符咒仍存', gesture: '一手竖直敲击掌心' }),
    mk(SK.MINE, '地雷', CAT.SPECIAL, 3, 0, 'self', { desc: '被非狙击枪攻击时，**除自己外全场其他角色**各受 1 点火伤；被打中的持雷者会间接触发（所有间接触发合并为一波，且不伤害间接触发者）；地雷伤害无来源', gesture: '握拳+左手托底' }),
    mk(SK.TAUNT, '挑衅', CAT.SPECIAL, 2, 3, 'enemy', { desc: '目标下回合必须使用攻击类技能，否则 -1 血', gesture: '手背朝下回勾' }),
    mk(SK.CANNON, '过载炮', CAT.SPECIAL, null, 3, 'enemy', { desc: '按使用次数循环：1 次 1伤；2 次 1伤+失ジ；3 次 1伤+失ジ+自损 1 血。**新规：可打穿防御与反弹，但会被任何攻击类技能抵消**', gesture: '握拳手背朝下' }),
    mk(SK.PURIFY, '净化', CAT.SPECIAL, 3, 1, 'self', { desc: '清除自身**全部持续状态**（符咒/梦魇/挑衅/藤甲火弱/地雷/避雷针/大雷禁用），每枚符咒回复 1 血（n-1规则）', gesture: '双手正立相扣' }),
    // ---- 多人专用（2人局置灰）----
    mk(SK.DUAL_GUN, '双枪射手', CAT.ATTACK, 3, 3, 'enemy', { desc: '（多人）对两个角色同时使用“枪”', dmg: { amt: 1, type: DMG.NORMAL }, extra: { target2: 'enemy' } }),
    mk(SK.MIRROR, '镜面反射', CAT.SPECIAL, 3, 3, 'enemy', { desc: '（多人）复制目标 1 本回合的伤害技能，对目标 2 施加；复制双枪只算一枪', extra: { target2: 'enemy' } })
  ];

  const byKey = {};
  skills.forEach(function (s) { byKey[s.key] = s; });

  // 分类表（2 人局可用清单 / 攻击判定集 / 挑衅满足集 / 雷系集 / 防御类集）
  /* v1.5.7（用户裁定）：`全息屏障` 也归入**多人专用** ⇒ 2P 模式不再提供它。
   * 理由：v1.5.4 依原始规则把它改成"给**被作用者**（别人）施加原型制御"，而 2P 里唯一的"别人"就是对手
   * ⇒ 出这张卡 = 给对手套盾，是一张**纯陷阱卡**（连 AI 都从不选：400 局 0 次）。
   * 而 2P 的自保**本来就有原型制御**、效果完全相同（用户原话："自保有原型制御可以实现完全相同的效果"）
   * ⇒ 灰掉它零损失。（另一个选项"让 2P 继承新语义、留着这张死卡"被用户否掉。） */
  const MULTI_ONLY = [SK.DUAL_GUN, SK.MIRROR, SK.HOLO];
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
  /* N14 镜面反射（v1.5.16 用户裁定）：**没有"无可复制"** —— 所有技能都能复制。
   * 非伤害类技能的效果落在**使用者自己身上**（相当于自己也摆了那个架势 / 也蓄了能 / 也架了雷）；
   * 这张表 = 有"自效果"可复制的技能，其余非伤害技能复制后只有"空指"（指向保留、本身无效果）。
   * 结算实现见 `resolve.js` 的 `applyMirrorSelf`；`np-test D23` 用它做**穷举守门**：
   * 技能表里任何一个 key 都必须"要么可复制伤害（copyEffect 非空）、要么在这张表里"。 */
  const MIRROR_SELF = [SK.JI, SK.CHARGE, SK.RING, SK.MINE, SK.ROD, SK.PURIFY].concat(GUARD_FAMILY);
  // 反弹可反射的攻击（README 仅 枪/坦克）
  const REFLECTABLE = [SK.GUN, SK.TANK];

  // 连续使用计数族（聚能环）；激光眼连续由 lastSkill 判断

  // N9/N14：3-5 人启用全部技能（含多人专用 双枪射手 / 镜面反射）
  const AVAILABLE_MULTI = skills;

  const MODES = {
    standard: { name: '标准模式', hp: 3, skills: AVAILABLE_2P, rule: '' },
    multi: { name: '多人模式(3-5人)', hp: 3, skills: AVAILABLE_MULTI, rule: '', minPlayers: 3, maxPlayers: 5, drainHpMax: 1, suddenDeath: 45 },   // v1.5.65：见下
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
     * 不是"谁把谁打死"。v1.5.10（用户裁定）起它**不再是长程模式专属**，而是**全局规则**
     * （见下面的 SUDDEN_DEATH）；maxRounds=140 只作安全网（正常情况在 ~105 回合就清完）。 */
    /* v1.5.174（用户裁定）：**长程的摄魂窗口从 ≤3 收到 ≤2** —— 关掉一份挂了很久的自相矛盾。
     * 档案问题：v1.4.0 在**同一次提交**里既写下"裁定 drainHpMax=3"（本行），又写下实测表
     *   `5血 ≤1 → 34.4%(+1.8pt) / ≤2 → 32.3%(−0.3pt) / ≤3 → 29.5%(−3.1pt)` 与结论"门槛对平衡是负向的"（`RULES-NP.md` N24），
     *   两段话谁也没关掉谁，而门 D2 还把 3 钉成了断言 ⇒ 仓里查不到任何撤销记录（用户记的"所以就没改"没有落到配置上）。
     * 今天的重跑（`RESEARCH-LOG-2026-09-23` §N42，全部实测）：
     *   ① 官方考卷 `eval-5p` 49000 局/档，≤1/≤2/≤3 **三档读数逐位相同**；逐事件数摄魂出手 = **0/2400 局**
     *      （镜像场里每局有 14.5 次"合法且买得起"的机会，现役冠军一次都不打）⇒ 这条规则现在**只作用于人类玩家，对 AI 惰性**；
     *   ② 唯一有信号的口径是"强制使用"（假想会用这张卡的 AI，同种子配对 n=400）：镜像 `≤2−≤1 = +4.8±1.3pt`（超 2SE）而 `≤3−≤2 = +1.8±1.1`（噪声内）；
     *      脚本池 `≤2−≤1 = −1.5±1.2`（噪声内）而 **`≤3−≤1 = −3.5±1.7`（超 2SE）** ⇒ **两个场都指向 ≤2 是拐点**：上行几乎全在 HP2 拿到，HP3 那一步反而翻负。
     *   ⚠️ 同时记下我这次自抓的假效应：在 `temp=0.15` 随机场里三档"自然态"差到 −3.8pt 且"超 2SE"，但主体出手 = 0
     *      ⇒ 那只能是 `legal` 集合变长扰动 softmax 分母的抽样噪声，**不许当强度证据**（官方考卷逐位相同正好反证）。
     * ⇒ 用户裁定取 ≤2。行为变化范围见 CHANGELOG v1.5.174（新旧引擎同种子配对复现，不是估计）。 */
    long: { name: '长程模式(5血·3-5人)', hp: 5, skills: AVAILABLE_MULTI, rule: '', minPlayers: 3, maxPlayers: 5, drainHpMax: 2, maxRounds: 140 }
    /* v1.5.65（第五轮复核 §4-2，第四轮就提过）：**multi 的终局收缩必须落进回合上限内**。
     * 病：multi 不设 `suddenDeath` ⇒ 走全局 `SUDDEN_DEATH = 100`，而回合上限是 `MAX_ROUNDS = 60`
     * ⇒ **收缩在多人局永不触发** ⇒ "不打"零代价（守到哨声就行），场 B 的严格胜率上限恒为 0（实测 60 回合 100% 平局）。
     * 修：给 multi 设 `suddenDeath: 45`（正常局平均 22~30 回合 ⇒ 几乎不影响常规对局；
     * 只惩罚"拖到 45 回合还不清场"）。收缩后血多者活得更久 ⇒ **任何伤害都会转化为胜负**（而非平局）。
     * 反证：本版守门 D57 会在"4 席全被动"场里要求出现分出胜负的局（修前必然 0/红）。 */
    /* v1.5.18（用户裁定）：**删除** `fast`（快速模式）与 `lucky`（欧皇模式）。
     * 起因（第三方复核 §3-2）：这两个模式**没有入口**（`index.html` 的 `#sel-mode` 只有 standard/multi/long）、
     * 没有工具/服务端引用，但 `MODES` 里还留着 `fast`、连带 `guardLimit: 2` 这个**纯死字段**
     * （全库零消费者）与 `state.js`/`play.js` 里两条 `state.modeKey === 'fast'` 分支，
     * 而 `tests/spec.js` 的 R52 用例**还在跑** ⇒ 守的是一条不可达的路径。
     * 现状"有实现、有测试、无入口"是最容易骗过自己的形态（作者本人都以为删了）——
     * 用户裁定"快速和欧皇模式去掉"，所以这里删干净（连 `guardStreak` 一起）。
     * 原始规则里的这两个模式（含**吸血鬼模式**）登记为"本程序不做"，见 `docs/RULES-2P.md` 的模式表。
     * 守卫：`np-test D28`（MODES 的每个 key 都必须能在页面选到）。 */
  };

  const MODE_DEFAULT = 'standard';
  const MAX_ROUNDS = 60; // R1 防死锁
  /* v1.5.10（用户裁定）：**终局收缩（100 回合后每回合末全员 −1 血）是全局规则**，不再是 long 专属。
   * 用户原话："可以把 100 回合之后扣血的机制直接做到正常对战规则里面，反正一般也打不了那么久"。
   * 效果范围：standard(60)/multi(60) 的上限都在 100 以下 ⇒ **实际上只在 long(上限 140) 生效**，
   * 但作为规则它现在是统一的（将来任何模式把上限调过 100 都会自动接上）。
   * 模式仍可用自己的 `suddenDeath` 覆盖（写 0 = 该模式关掉）。 */
  const SUDDEN_DEATH = 100;
  /* v1.5.11（用户裁定"按你的意思做"）：**每回合扣多少血**也做成可调（原写死 1）。
   * 模式可用 `suddenDeathDmg` 覆盖；页面在对局控制区有入口（`#inp-sd` / `#inp-sd-dmg`），
   * 经 `S.createState(..., { suddenDeath, suddenDeathDmg })` 传入（内部浅拷贝，不污染共享的 MODES 对象）。 */
  const SUDDEN_DEATH_DMG = 1;

  global.EpirusRules = {
    SK, CAT, DMG, skills, byKey, MULTI_ONLY, AVAILABLE_2P, AVAILABLE_MULTI,
    ATK_EFFECT, TAUNT_SATISFY, LIGHTNING, GUARD_FAMILY, MINI_T_IMMUNE, MIRROR_SELF,
    REFLECTABLE, MODES, MODE_DEFAULT, MAX_ROUNDS, SUDDEN_DEATH, SUDDEN_DEATH_DMG
  };
})(typeof window !== 'undefined' ? window : globalThis);
