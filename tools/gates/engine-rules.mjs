/*#np-part-header
{"file":"tools/gates/engine-rules.mjs","part":"engine-rules","group":"engine","ranges":[[206,271],[285,514],[539,660],[705,796],[2289,2295],[2343,2362],[2626,2719],[3122,3170],[3194,3436],[4045,4200],[4228,4238],[4291,4323],[4412,4453],[5357,5425],[5549,5679],[5860,5887],[6077,6108],[7306,7434]],"gates":[206,216,225,234,246,258,265,285,314,327,341,355,369,383,396,404,415,427,438,450,458,471,485,497,505,539,552,573,591,606,620,642,705,730,749,762,781,2289,2343,2626,2653,2682,3122,3194,3218,3292,4045,4107,4149,4228,4291,4412,5357,5376,5549,5563,5585,5598,5661,5860,6077,7306],"patched":[]}
#np-part-header-end*/
import { makeCtx, NP_GATE_FILES, npSourceAll } from './_ctx.mjs';
/* 前导里的全部具名绑定原样接回（自由变量照原样解析 ⇒ 门体零改动）。 */
const {
  existsSync, readFileSync, readdirSync, statSync, mkdtempSync,
  mkdirSync, writeFileSync, rmSync, copyFileSync, tmpdir,
  join, createHash, _spawnSync, T3P_ENTRY, spawnSync,
  parsePairTable, makeGuardCost, resolveOutPath, loadSlotId, sigOf,
  LADDER_CLAIM, pushTarget, hardwiredLine, widOfArr, seatRd,
  seatKillIndex, pairHasBase, classifyDefenseWindow, defenseQuality, formatQuality,
  parseQuality, formatQualityRecord, AUDIT, PS, PF_FRONT,
  spawnCached, inputHash, cacheStats, cacheDir, spawnNC,
  spawnBatch, RGAIN, OPP_SPECS, ECON_REWARD_KEYS, readEconEnv,
  conc, fieldProfile, tallyPick, WIN, loadPool,
  selfTest, vm, isChampOpp, loadChampParams, makeChampOppResolver,
  makeShapeScorer, rulesFingerprint, fingerprintOfBundle, pickBestByExam, regressionsOf,
  fixesOf, INCUMBENT_TAG, rejectDegenerateWinners, vetoBy3p, bandPickByLand,
  bandPickByUsage, rejectNarrowWinners, COLLAPSE_LINE, SEL_BASE0, SEL_STRIDE,
  SEL_SEEDS_DEFAULT, parseSelSeeds, selBase, selBases, scoreRuns,
  selNote, selGapNote, readTrainEnv, hasTrainOverride, TEK,
  measureAll, KR_LIB, detectDarkKnobs, readKeysOf, wallCapExceeded,
  wallCapOf, sb, sandbox, stanceProfile, aggressionProfile,
  feasibilityOf, attackAttribution, feasPlan, FEAS_N_DEFAULTS, nullSpreadQuantile,
  g4ExceptionOk, G4FROZEN, unrunDisposition, UNRUN_KINDS, R,
  S, X, Play, T, Bots,
  Pol, mulberry32, Skip, needArtifacts, FIXTURE_PACK,
  ok, eq, SEL_PIN, randChooser, CLI_ARM_BASELINE,
  fnBody,
} = makeCtx();
/* 每个门单元的**原始行号**（与下面 register() 里 t() 的调用次序一一对应）⇒ runner 按它排序执行。 */
export const ords = [206, 216, 225, 234, 246, 258, 265, 285, 314, 327, 341, 355, 369, 383, 396, 404, 415, 427, 438, 450, 458, 471, 485, 497, 505, 539, 552, 573, 591, 606, 620, 642, 705, 730, 749, 762, 781, 2289, 2343, 2626, 2653, 2682, 3122, 3194, 3218, 3292, 4045, 4107, 4149, 4228, 4291, 4412, 5357, 5376, 5549, 5563, 5585, 5598, 5661, 5860, 6077, 7306];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('N1 人数：createState 默认 2 人；multi 模式可 3/4/5 人', function () {
  eq(S.createState('standard').p.length, 2, '默认 2 人');
  for (const n of [3, 4, 5]) {
    const st = S.createState('multi', { next: mulberry32(n) }, n);
    eq(st.p.length, n, n + ' 人');
    eq(st.actions.length, n, n + ' 行动槽');
    eq(st.n, n, 'n 字段');
  }
});

t('N2 多人模式含全部多人专用技能（双枪 + 镜面）', function () {
  const st = S.createState('multi', { next: mulberry32(1) }, 3);
  ok(S.canUseSkillInMode(st, R.SK.DUAL_GUN), '双枪可用');
  ok(S.canUseSkillInMode(st, R.SK.MIRROR), '镜面可用');
  const st2 = S.createState('standard', { next: mulberry32(1) }, 2);
  ok(!S.canUseSkillInMode(st2, R.SK.DUAL_GUN), '标准模式双枪不可用');
  ok(!S.canUseSkillInMode(st2, R.SK.MIRROR), '标准模式镜面不可用');
});

t('目标：attemptAction 记录 action.target，resolveTarget 兜底第一个存活对手', function () {
  const st = S.createState('multi', { next: mulberry32(7) }, 3);
  st.p[0].ep = 5;
  S.attemptAction(st, 0, R.SK.GUN, { target: 2 });
  eq(st.actions[0].target, 2, '显式目标');
  S.attemptAction(st, 1, R.SK.GUN, {});
  ok(st.actions[1].target !== null && st.actions[1].target !== 1, '兜底目标≠自己');
});

t('N3 小雷逐边：A→B 使 B 作废（B 未反击 A）', function () {
  const st = S.createState('multi', { next: mulberry32(11) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINI_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(st.actions[1].voided, 'B 的枪被小雷作废');
  ok(!st.actions[0].voided, 'A 的小雷成立');
});

t('N3b 小雷互雷成环（2 人边）：双方作废', function () {
  const st = S.createState('multi', { next: mulberry32(12) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINI_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.MINI_T, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(st.actions[0].voided && st.actions[1].voided, '互雷成环双方作废');
  ok(st.events.some(function (e) { return e.type === 'thunderRing'; }), 'thunderRing 事件');
});

t('N10 胜负：最后存活者胜', function () {
  const st = S.createState('multi', { next: mulberry32(13) }, 3);
  st.p[1].hp = 0; st.p[2].hp = 0;
  X.checkOver(st);
  eq(st.winner, 0, '仅 P0 存活 → 胜');
});

t('N10b 胜负：同回合全灭 = 平局', function () {
  const st = S.createState('multi', { next: mulberry32(14) }, 4);
  for (const p of st.p) p.hp = 0;
  X.checkOver(st);
  eq(st.winner, 'draw', '全灭平局');
});

t('N8 铁索：边共享伤害、不递归，且**一次性**（v1.5.18 用户裁定按原文修正）', function () {
  /* 原文：「**下一次**当其中一个角色受到伤害时，另一个也受到相同伤害」⇒ 共享过一次连边即解除。
   * 本用例第一版（v1.5.18 之前）直接假定连边**持久**、拿同一个局连续打两次 —— 那正是实现与原文不符的地方。 */
  const st = S.createState('multi', { next: mulberry32(17) }, 3);
  st.p[0].chains = [1]; st.p[1].chains = [0, 2]; st.p[2].chains = [1];
  st.p[0].hp = st.p[1].hp = st.p[2].hp = 3;
  X.rawDamage(st, 0, 1, '测试', 'test', {});
  eq(st.p[0].hp, 2, 'A 自身');
  eq(st.p[1].hp, 2, 'B 通过 A 的边共享');
  eq(st.p[2].hp, 3, 'C 不共享（铁索图不递归 N8）');
  /* v1.5.18：共享过一次 ⇒ A-B 这条边**两侧一起**解除（单向解除 = 半截铁索，也要查）。
   * 反证：删掉 `p.chains = []` 与那个 filter ⇒ 下面三条立刻红。 */
  eq((st.p[0].chains || []).length, 0, 'A 侧的边已解除');
  eq((st.p[1].chains || []).indexOf(0), -1, 'B 侧到 A 的边也已解除（对称解除）');
  const hpB = st.p[1].hp;
  X.rawDamage(st, 0, 1, '测试', 'test', {});
  eq(st.p[1].hp, hpB, '一次性：同一条边不再共享第二次');
  // 另一局：打 B（它同时连着 A 与 C）⇒ 两条边都共享，且两条边都断
  const st2 = S.createState('multi', { next: mulberry32(19) }, 3);
  st2.p[0].chains = [1]; st2.p[1].chains = [0, 2]; st2.p[2].chains = [1];
  X.rawDamage(st2, 1, 1, '测试', 'test', {});
  eq(st2.p[1].hp, 2, 'B 自身');
  eq(st2.p[0].hp, 2, 'A 共享（B 的边之一）');
  eq(st2.p[2].hp, 2, 'C 共享（B 的边之二）');
  eq((st2.p[1].chains || []).length, 0, 'B 侧两条边都断');
  eq((st2.p[0].chains || []).length, 0, 'A 的边断');
  eq((st2.p[2].chains || []).length, 0, 'C 的边断');
});

t('N3 双枪射手：对两个目标各 1 点', function () {
  const st = S.createState('multi', { next: mulberry32(18) }, 3);
  st.p[0].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.DUAL_GUN, { target: 1, target2: 2 });
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[1].hp, 2, '目标1 受伤');
  eq(st.p[2].hp, 2, '目标2 受伤');
  eq(st.p[0].hp, 3, '自身不受伤');
});

t('N14 镜面反射：复制目标的伤害技能打输出对象', function () {
  const st = S.createState('multi', { next: mulberry32(31) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });   // 复制 P1 → 打 P2
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });                 // P1 用枪打 P0
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 2, 'P2 被复制来的枪打中');
  eq(st.p[0].hp, 2, 'P1 的枪打中 P0');
  eq(st.p[1].hp, 3, 'P1 未受伤');
  ok(st.events.some(function (e) { return e.type === 'mirror'; }), 'mirror 事件');
});

t('N14b 镜面反射：复制双枪只算一枪；镜面本身不可复制', function () {
  const st = S.createState('multi', { next: mulberry32(32) }, 4);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 1, R.SK.DUAL_GUN, { target: 0, target2: 3 });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 2, '复制双枪只算 1 伤');
  eq(st.p[0].hp, 2, '双枪打 P0');
  eq(st.p[3].hp, 2, '双枪打 P3');
});

t('N15 反复横跳：镜面边成环 → 所有使用者受 1 点光&火', function () {
  const st = S.createState('multi', { next: mulberry32(33) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });   // 1->2
  S.attemptAction(st, 1, R.SK.MIRROR, { target: 2, target2: 0 });   // 2->0
  S.attemptAction(st, 2, R.SK.MIRROR, { target: 0, target2: 1 });   // 0->1
  X.resolveActions(st);
  eq(st.p[0].hp, 2, 'P0 受 1 点光&火');
  eq(st.p[1].hp, 2, 'P1 受 1 点光&火');
  eq(st.p[2].hp, 2, 'P2 受 1 点光&火');
  ok(st.events.some(function (e) { return e.type === 'hidden' && e.name === '反复横跳'; }), '反复横跳事件');
});

t('N16 聚光炮：互镜且输出同一人 → 该人受 1 点光&火', function () {
  const st = S.createState('multi', { next: mulberry32(34) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 1, R.SK.MIRROR, { target: 0, target2: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 2, 'P2 受 1 点光&火');
  eq(st.p[0].hp, 3, 'P0 不受伤');
  eq(st.p[1].hp, 3, 'P1 不受伤');
  ok(st.events.some(function (e) { return e.type === 'hidden' && e.name === '聚光炮'; }), '聚光炮事件');
});

t('N17 合二为一：两人同时小雷打同一人 → 额外 1 电伤', function () {
  const st = S.createState('multi', { next: mulberry32(35) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINI_T, { target: 2 });
  S.attemptAction(st, 1, R.SK.MINI_T, { target: 2 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  ok(st.actions[2].voided, 'P2 行动被小雷作废');
  eq(st.p[2].hp, 2, 'P2 额外受 1 电伤');
  ok(st.events.some(function (e) { return e.type === 'hidden' && e.name === '合二为一'; }), '合二为一事件');
});

t('N18 光&火复合伤害：藤甲火弱 +1、吸血鬼光弱 +1 可叠加', function () {
  const st = S.createState('multi', { next: mulberry32(36) }, 3);
  for (const p of st.p) p.ep = 5;
  st.p[2].fireWeakNow = true; st.p[2].vampire = true;
  X.rawDamage(st, 2, 1, '聚光炮', 'focusCannon', { type: R.DMG.FIRELIGHT });
  eq(st.p[2].hp, 0, '1 + 藤甲 1 + 光弱 1 = 3 伤');
});

t('N19 多人冠军包：可加载且维度兼容', function () {
  const P = sb.window.EpirusPolicy;
  const pack = sb.window.EPIRUS_CHAMPION_3P;
  ok(!!pack, '存在 EPIRUS_CHAMPION_3P');
  const chk = P.checkPack(pack);
  ok(chk.ok, 'checkPack: ' + JSON.stringify(chk));
  const params = P.unpack(pack);
  ok(!!params && params.length === P.paramCount(), 'unpack 长度=' + (params ? params.length : 'null'));
  ok(pack.f === P.FEAT_S && pack.h === P.HID, 'f/h 一致');
});

t('N4 相抵必须“互为目标”：两家同打第三人 → 各中一枪', function () {
  const st = S.createState('multi', { next: mulberry32(41) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 0, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].hp, 1, 'P0 中两枪');
  ok(!st.actions[1].voided && !st.actions[2].voided, '两枪都没被相抵');
});

t('N4b 互为目标仍相抵（2 人回归）', function () {
  const st = S.createState('standard', { next: mulberry32(42) }, 2);
  st.p[0].ep = st.p[1].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.GUN, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  ok(st.actions[0].voided && st.actions[1].voided, '互枪相抵');
  eq(st.p[0].hp, 3, '无人受伤');
});

t('N4c 高优先级打第三人，不作废别人对同一目标的攻击', function () {
  const st = S.createState('multi', { next: mulberry32(43) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.SWORD, { target: 2 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(!st.actions[1].voided, 'P1 的枪不被 P0 的剑作废');
  eq(st.p[2].hp, 1, 'P2 各中 1 点');
});

t('N12 已淘汰玩家不能行动', function () {
  const st = S.createState('multi', { next: mulberry32(44) }, 3);
  st.p[1].hp = 0; st.p[1].ep = 5;
  const r = S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  eq(r.outcome, 'invalid', '被拒绝');
  ok(st.actions[1].voided, '行动作废');
});

t('N12b 每回合重置行动槽：死人不会沿用上回合行动', function () {
  const st = S.createState('multi', { next: mulberry32(45) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 0, R.SK.JI, {});
  X.resolveActions(st); X.endTurn(st);
  st.p[1].hp = 0;
  X.startTurn(st);
  ok(st.actions[1] === null, '行动槽已清空');
});

t('N6 大雷连带：攻击被雷劈中者 → 攻击者受 1 电伤且攻击作废', function () {
  const st = S.createState('multi', { next: mulberry32(46) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 1 });
  S.attemptAction(st, 1, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[1].hp, 1, 'P1 中 2 电');
  eq(st.p[2].hp, 1, 'P2 受 2 点连带伤');
  ok(st.actions[2].voided, 'P2 的攻击被连带无效化');
  eq(st.p[2].cooldown[R.SK.GUN], 4, '连带者的技能（枪）被禁用 3 回合');
});

t('N6b 大雷连带：被雷劈者攻击第三人 → 第三人受连带', function () {
  const st = S.createState('multi', { next: mulberry32(47) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 1, 'P2 受 2 点连带电伤');
  ok(st.actions[2].voided, 'P2 的行动同样被作废');
});

t('目标反锁：上回合与某对手互为目标而相抵 → 本回合不再打他', function () {
  const T = sb.window.EpirusTrainer;
  const st = S.createState('multi', { next: mulberry32(51) }, 3);
  st.round = 5; st.p[1].hp = 2; st.p[2].hp = 2;
  st.events.push({ type: 'cancel', pids: [0, 2], round: 4 });
  ok(T.pickTargetN(st, 0, R.SK.GUN) !== 2, '不再打 P2（反锁）');
});

t('目标选择：能一击必杀先杀；否则打血量最高的领先者', function () {
  const T = sb.window.EpirusTrainer;
  const a = S.createState('multi', { next: mulberry32(52) }, 3);
  a.round = 5; a.p[1].hp = 1; a.p[2].hp = 3;
  eq(T.pickTargetN(a, 0, R.SK.GUN), 1, '能杀 P1 就杀');
  const b = S.createState('multi', { next: mulberry32(53) }, 3);
  b.round = 5; b.p[1].hp = 2; b.p[2].hp = 3;
  eq(T.pickTargetN(b, 0, R.SK.GUN), 2, '打领先者 P2');
});

t('N2 同优先级同时结算：三方互放大雷 → 人人挨打（低 pid 不再免伤）', function () {
  const st = S.createState('multi', { next: mulberry32(42) }, 3);
  for (let i = 0; i < 3; i++) { st.p[i].ep = 5; st.p[i].elec = 1; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.BIG_T, { target: 2 });
  S.attemptAction(st, 2, R.SK.BIG_T, { target: 0 });
  X.resolveActions(st);
  const hp = st.p.map(function (p) { return p.hp; });
  ok(hp[0] < 3 && hp[1] < 3 && hp[2] < 3,
    '三人应各受伤害（快照结算），实际 HP=' + hp.join('/'));
});

t('N2 座位偏置：3x 同一策略各座位 1st 率接近均等', function () {
  const B = sb.window.EpirusBots, T = sb.window.EpirusTrainer;
  const sel = T.wrapBotN(B.pickBreakDef);
  const GAMES = 80, first = [0, 0, 0];
  let drawn = 0;
  for (let g = 0; g < GAMES; g++) {
    const r = T.oneGameN([sel, sel, sel], 31337 + g * 977, 3);
    if (typeof r.winner !== 'number') drawn++; else first[r.winner]++;
  }
  const decided = GAMES - drawn;
  ok(decided >= 30, '有效样本不足 decided=' + decided);
  const pct = first.map(function (c) { return c / decided * 100; });
  const spread = Math.max.apply(null, pct) - Math.min.apply(null, pct);
  ok(spread <= 32,
    '座位偏置过大 ' + pct.map(function (v) { return v.toFixed(1); }).join('/') + '% 极差=' + spread.toFixed(1) + 'pt（修复前为 73.5pt）');
});


/* ===== N20 地雷 AoE（用户裁定 2026-09-11）=====
 * 旧实现是 2 人口径"只让攻击者受 1 火伤"；而 2 人局里「全场其他角色」与「攻击者」**恰好同一人**
 * ⇒ 两种读法在 2 人下无法区分，multi 加入时未回头核对。以下用例必须 N≥3 才测得出。 */
t('N20a 地雷直接触发：4 人 a/b/c 装雷、d 打 a → 除 a 外各 1；b/c 间接触发合并一波打 a/d', function () {
  const st = S.createState('multi', { next: mulberry32(7) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 1, R.SK.MINE, {});
  S.attemptAction(st, 2, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  eq(st.p[0].mineArmed, false, 'a 的雷被直接触发后消耗');
  eq(st.p[1].mineArmed, false, 'b 的雷被间接触发后消耗');
  eq(st.p[2].mineArmed, false, 'c 的雷被间接触发后消耗');
  eq(st.p[0].hp, 3, 'a：d 的枪 1 + 间接触发波 1');
  eq(st.p[1].hp, 4, 'b：只挨 a 的直接波 1');
  eq(st.p[2].hp, 4, 'c：只挨 a 的直接波 1');
  eq(st.p[3].hp, 3, 'd：a 的直接波 1 + 间接触发波 1');
});

t('N20b 直接触发无上限：d 双枪打 a,b → a/b 各一波 + c 间接触发合并一波 = 共 3 波', function () {
  const st = S.createState('multi', { next: mulberry32(11) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 1, R.SK.MINE, {});
  S.attemptAction(st, 2, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.DUAL_GUN, { target: 0, target2: 1 });
  X.resolveActions(st);
  eq(st.p[0].hp, 2, 'a：双枪 1 + b 直接波 1 + c 间接触发波 1');
  eq(st.p[1].hp, 2, 'b：双枪 1 + a 直接波 1 + c 间接触发波 1');
  eq(st.p[2].hp, 3, 'c：a 直接波 1 + b 直接波 1（间接触发者豁免自己那波）');
  eq(st.p[3].hp, 2, 'd：a 直接波 1 + b 直接波 1 + c 间接触发波 1');
});

t('N20c 地雷伤害无来源：事件 source=null → 不被铁索共享', function () {
  const st = S.createState('multi', { next: mulberry32(13) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  st.p[0].chains = [1]; st.p[1].chains = [0];
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  const md = st.events.filter(function (e) { return e.type === 'damage' && e.via === 'mine'; });
  ok(md.length > 0, '应有地雷伤害事件');
  ok(md.every(function (e) { return e.source == null; }), '地雷伤害事件 source 必须为 null');
  eq(st.p[1].hp, 3, 'b：铁索共享 d 的枪 1 + a 的直接波 1；雷伤不共享故不再掉');
});

t('N20d 火弱逐目标：地雷 AoE 只对挂了藤甲 debuff 的那一个 +1', function () {
  const st = S.createState('multi', { next: mulberry32(17) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  st.p[1].fireWeakNow = true;            // 只给 b 挂火弱（模拟此前被藤甲贴过）
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 1, R.SK.MINE, {});
  S.attemptAction(st, 2, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  const md = st.events.filter(function (e) { return e.type === 'damage' && e.via === 'mine'; });
  const toB = md.filter(function (e) { return e.to === 1; });
  ok(toB.length > 0, 'b 应吃到地雷伤害');
  eq(toB[0].amt, 2, 'b 挂了火弱 → 这一发 2 点');
  ok(md.filter(function (e) { return e.to !== 1; }).every(function (e) { return e.amt === 1; }),
    '其他没挂火弱的人只吃 1 点');
  eq(st.p[0].hp, 3, 'a：d 的枪 1 + 间接触发波 1');
  eq(st.p[1].hp, 3, 'b：直接波 2（含火弱 +1），间接触发者豁免自己那波');
  eq(st.p[2].hp, 4, 'c：直接波 1');
  eq(st.p[3].hp, 3, 'd：直接波 1 + 间接触发波 1');
});

t('N20e 狙击枪豁免只针对那一次攻击：狙击打持雷者不触发，雷仍装着', function () {
  const st = S.createState('multi', { next: mulberry32(19) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.SNIPE, { target: 0 });
  X.resolveActions(st);
  ok(st.p[0].hp < 5, 'a 应挨到狙击伤害（点数随爆头判定变化，本用例只锁豁免不变量）');
  eq(st.p[0].mineArmed, true, '狙击枪攻击不触发地雷 → 雷仍然装着');
  eq(st.events.filter(function (e) { return e.type === 'damage' && e.via === 'mine'; }).length, 0,
    '不应产生任何地雷伤害事件');
  eq(st.p[1].hp, 5, 'b 未被波及');
  eq(st.p[3].hp, 5, 'd 未被波及');
});

/* 千问建议的硬规矩：训练路径禁止裸 Math.random / Date.now —— 随机只能来自
 * state.rng 或 P.setRng 注入的流。这次不可复现的根因就是 server 里两处 Node 作用域的裸调用
 * （__seedSandbox 只管 vm 沙箱，管不到 Node 全局）。加自动检查防止再犯。
 * 白名单：明确的兜底分支 / 超时与时间戳（不参与决策）。 */
t('N21 大雷不失效/不禁用小雷（非空版）：小雷打第三方时大雷正常结算，此时才看得出豁免', function () {
  /* 空用例的教训：若被大雷打的人**自己**用了小雷，小雷(pri5)会先作废大雷本身，
   * 大雷压根不结算 -> 禁用与否都是 0，用例恒过。
   * 必须让小雷**打第三方**，大雷才不会被作废、才会真的走到"要不要禁用目标技能"这一步。 */
  const st = S.createState('multi', { next: mulberry32(23) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });      // 大雷 pri4 -> P1
  S.attemptAction(st, 1, R.SK.MINI_T, { target: 2 });     // 小雷 pri5 -> **P2**（不干扰 P0 的大雷）
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(st.events.some(function (e) { return e.type === 'ban'; }), '大雷应已结算并发出 ban 事件（否则用例又是空的）');
  eq(st.p[1].cooldown[R.SK.MINI_T] || 0, 0, '小雷不应被大雷禁用');

  // 对照组：目标用普通技能（激光剑）时**应当**被禁用
  const st2 = S.createState('multi', { next: mulberry32(29) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st2.p[i2].hp = 8; st2.p[i2].ep = 9; }
  X.startTurn(st2);
  S.attemptAction(st2, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st2, 1, R.SK.SWORD, { target: 0 });
  S.attemptAction(st2, 2, R.SK.JI, {});
  X.resolveActions(st2);
  ok((st2.p[1].cooldown[R.SK.SWORD] || 0) > 0, '非防御类技能(激光剑)应被大雷禁用');
});

t('N22 大雷效果传导（用户 a,b,c,d 例子）：b/c/d 各受 2 点；c 的ジ失效不给 ep；b 的转移与 d 的枪禁用 3 回合', function () {
  const st = S.createState('multi', { next: mulberry32(41) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });         // a 大雷 -> b
  S.attemptAction(st, 1, R.SK.TRANSFER, { target: 2 });      // b 转移伤害 -> c
  S.attemptAction(st, 2, R.SK.JI, {});                       // c 只出ジ
  S.attemptAction(st, 3, R.SK.GUN, { target: 1 });           // d 枪 -> b
  X.resolveActions(st);
  eq(st.p[0].hp, 8, 'a（施法者）不受影响');
  eq(st.p[1].hp, 6, 'b（大雷目标）受 2 点');
  eq(st.p[2].hp, 6, 'c（b 的转移对象）受 2 点');
  eq(st.p[3].hp, 6, 'd（攻击 b 的人）受 2 点');
  eq(st.p[2].ep, 9, 'c 的ジ被失效 -> 不 +ep');
  ok((st.p[1].cooldown[R.SK.TRANSFER] || 0) > 0, 'b 的转移伤害应被禁用 3 回合');
  ok((st.p[3].cooldown[R.SK.GUN] || 0) > 0, 'd 的枪应被禁用 3 回合');
  eq(st.p[2].cooldown[R.SK.JI] || 0, 0, 'ジ 不进 3 回合禁用');
});

t('N22b 防御族可格挡大雷；藤甲（有作用目标）本人免伤、伤害落到其目标', function () {
  // 直接命中：b 用反弹 -> 应挡住那 2 点（且不触发反弹反击）
  const st = S.createState('multi', { next: mulberry32(43) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.REFLECT, {});
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[1].hp, 8, '反弹应格挡大雷（反弹可格挡）');
  eq(st.p[0].hp, 8, '大雷不被反弹反击（反弹不触发）');
  ok((st.p[1].cooldown[R.SK.REFLECT] || 0) === 0, '防御族不进 3 回合禁用');
});
t('N22c 【覆盖传导链中的防御】链上成员用藤甲：本人免伤、2 点落到其作用目标', function () {
  /* 为什么需要这条：N22 的链条里没有防御者，N22b 测的是**直接目标**的防御（走另一分支），
   * 两者都测不到"传导链成员用防御"这段新代码（反证已证：关掉豁免它们仍通过）。 */
  const st = S.createState('multi', { next: mulberry32(47) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });        // a 大雷 -> b
  S.attemptAction(st, 1, R.SK.TRANSFER, { target: 2 });     // b 转移 -> c   => c 进链
  S.attemptAction(st, 2, R.SK.ARMOR, { target: 3 });        // c 藤甲 -> d  （防御族 + 有作用目标）
  S.attemptAction(st, 3, R.SK.JI, {});                      // d 只出ジ（不是链成员，只作为藤甲目标）
  X.resolveActions(st);
  eq(st.p[1].hp, 6, 'b（大雷目标）受 2 点');
  eq(st.p[2].hp, 8, 'c（链上成员，用防御）本人免伤');
  eq(st.p[3].hp, 6, 'd 作为藤甲的作用目标，吃到那 2 点传导伤害');
  /* 注意：**不**断言"防御族不进 3 回合禁用"——用户说的"防住大雷"指格挡那 2 点伤害，
   * 而 R23' 明确"2 电被挡但禁用目标用的原型制御仍生效" ⇒ 防御族**仍会被禁用**。
   * 我曾在此写错断言，直接把 R23' 撞成 spec 36/37。 */
  ok((st.p[2].cooldown[R.SK.ARMOR] || 0) > 0, '防御族仍会被禁用 3 回合（与 R23 注释同口径）');
});
t('N23 单个激光眼即失效原型制御（用户裁定：单发破全防御族）', function () {
  const st = S.createState('multi', { next: mulberry32(53) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; st.p[i2].boom = 2; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.LASER_EYE, { target: 1 });   // 单个激光眼 -> 目标在出原型制御
  S.attemptAction(st, 1, R.SK.PROTO, {});
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  /* 关键判据：不再出现 laserNoEffect（那是"需两发才破原型制御/全息"的旧路径）。
   * （本用例第一版还写了 `some(e => e.type==='laserNoEffect' ? false : true)` 和 `ok(true,'')`
   *   —— 前者近乎恒真、后者是空断言，已删除；判据只保留下面这条可被反证的。） */
  eq(st.events.filter(function (e) { return e.type === 'laserNoEffect'; }).length, 0,
     '单发不应再走 laserNoEffect（需两发）路径');
  /* 不写"应产生失效事件"——`setVoid` 并不发 type:'void' 的事件（我一度这么断言，直接失败）。
   * 判据只保留下面那条**可被反证**的 laserNoEffect 计数。 */
});
t('D1 drain gate in multi stays HP<=1 (R25 unchanged)', function () {
  eq(R.MODES.multi.drainHpMax, 1, 'multi.drainHpMax');
  const st = S.createState('multi', { next: mulberry32(71) }, 5);
  st.p[0].hp = 1; ok(S.computeCost(st, 0, R.SK.DRAIN).ok, 'multi HP=1 usable');
  st.p[0].hp = 2; ok(!S.computeCost(st, 0, R.SK.DRAIN).ok, 'multi HP=2 must be banned');
});

t('D4 opponent rotation must not depend on individual index (pairing)', function () {
  const src = readFileSync('js/train/evo.js', 'utf8');
  const all = [];
  const re = /let oi = ([^;]+);/g;
  let m;
  while ((m = re.exec(src))) all.push(m[1]);
  /* v1.5.280（§E124）：轮换公式搬进了纯函数 `oppSeatIndex`（整桌同原型要的就是"局内不推进"）
   * ⇒ 只扫 `let oi` 会只剩 `evalN` 里那个 `let oi = 0`（那是量具游标，不是轮换）⇒ **这条老门失去判据**。
   * 现在两种形状都认：老式 `let oi = <式>` 与新式 `function oppSeatIndex(...) { return <式>; }`。
   * ⚠ 这条本身是 v1.3.60 那次"把同代同对手批拆掉 ⇒ 适值不可比"的事故换来的，不许再退化。 */
  const fn = /function oppSeatIndex\([^)]*\)\s*\{\s*return ([^;]+);/.exec(src);
  if (fn) all.push(fn[1]);
  ok(all.length >= 1, 'no opponent rotation expression found');
  ok(fn || all.some(function (e) { return e.indexOf('gen') >= 0; }),
    '轮换必须在 `let oi` 或 `oppSeatIndex` 里有一处真身（两处都扫不到 = 这条门已被重构架空，判红）');
  for (const e of all) ok(e.indexOf('idx') < 0, 'rotation must not use idx (breaks same-gen pairing): ' + e);
  ok(all.some(function (e) { return e.indexOf('gen') >= 0; }),
    'rotation should advance with gen so a large pool still gets covered: ' + all.join(' | '));
});

t('D51 双目标技能必须**有序成对**进入决策（镜面反射 t1→t2 / 双枪射手两个角色）', function () {
  /* v1.5.52（用户指出）：镜面反射的两个目标**不可调换**（t1=复制对象、t2=输出对象），双枪射手同理。
   * 此前 `candidatesFor` 每次 push 的 `target2` 都硬编码 null ⇒ 第二个目标由引擎兜底（"索引最小的对手"）
   * ⇒ ① 角色不可表达；② 系统性把 0 号座当第二个目标（实测 0 号座每局必死 60/60 的一部分来源）。 */
  ok(R.byKey[R.SK.MIRROR].target2 === 'enemy', '规则数据必须声明镜面反射有第二目标（target2=enemy）');
  ok(R.byKey[R.SK.DUAL_GUN].target2 === 'enemy', '规则数据必须声明双枪射手有第二目标（target2=enemy）');
  const pol = readFileSync('js/train/policy.js', 'utf8');
  /* v1.7.126（门禁 ② 分诊，批 2）：这条源码 pin 与下面 591/592 的**行为腿重复** ——
   *   那两条真跑 `candidatesFor` 并断言 (1→2) 与 (2→1) 各恰好一个候选（顺序不可交换）。
   *   实现分支换成什么写法都行，只要这两个候选还在 ⇒ 摘源码 pin 不减少覆盖。 */
  const stz = S.createState('multi', { next: function () { return 0.5; } }, 5);
  const nopps = S.opponentsOf(stz, 0).length;
  for (const k of [R.SK.MIRROR, R.SK.DUAL_GUN]) {
    const c = Pol.candidatesFor(stz, 0, [{ key: k }]);
    const pairs = c.filter(function (x) { return x.target != null && x.target2 != null; });
    const selfPair = pairs.filter(function (x) { return x.target === x.target2; });
    eq(pairs.length, nopps * (nopps - 1), k + '：必须枚举**全部有序**组合 n×(n-1)（实测 ' + pairs.length + '）');
    eq(selfPair.length, 0, k + '：两个目标不得相同');
    const fwd = c.filter(function (x) { return x.target === 1 && x.target2 === 2; }).length;
    const bwd = c.filter(function (x) { return x.target === 2 && x.target2 === 1; }).length;
    eq(fwd, 1, k + '：必须存在 (1→2) 这一个候选');
    eq(bwd, 1, k + '：必须存在 (2→1) 这一个候选（**顺序不可交换** ⇒ 是两个不同候选）');
  }
  /* 对照：单目标技能不得被这条分支改变口径 */
  const cg = Pol.candidatesFor(stz, 0, [{ key: R.SK.GUN }]);
  eq(cg.length, nopps, '单目标技能（枪）候选数必须仍等于存活对手数（口径不变）');
  eq(cg.filter(function (x) { return x.target2 != null; }).length, 0, '单目标技能的 target2 必须恒为 null');
});

t('D52 结算起点必须每局随机（不得有确定性身份映射）；盐 0 保持旧口径', function () {
  /* v1.5.53：`turnOrder` 原为 `start = (round-1) % n` —— **确定性映射** ⇒ 第 1 回合永远从 0 号座开始。
   * 强策略下对局前几回合就定局 ⇒ 0 号座白拿首发优势。实测（5 个同一冠军坐满 5 座）：
   * 修掉槽位焦点后反而变成"0 号座夺冠 37~54%、死亡最少"，方向与修前相反 ⇒ 同族的第二条身份映射。
   * 修法：相位取每局的盐（纯函数、可复现、不消耗随机流）。 */
  ok(typeof X.turnOrder === 'function', 'X.turnOrder 必须导出（守门要能直接测）');
  const st = S.createState('multi', { next: function () { return 0.5; } }, 5);
  const firsts = {};
  for (let s = 0; s < 25; s++) {
    st.slotSalt = ((s * 0x9e3779b9) >>> 0);
    st.round = 1;
    const o = X.turnOrder(st);
    eq(o.length, 5, '5 人局的结算顺序必须含 5 个座位');
    firsts[o[0]] = (firsts[o[0]] || 0) + 1;
  }
  eq(Object.keys(firsts).length, 5, '25 个不同盐下第 1 回合起点必须覆盖全部 5 座（实测 ' + JSON.stringify(firsts) + '）');
  const vals = [0, 1, 2, 3, 4].map(function (i) { return firsts[i] || 0; });
  ok(Math.min.apply(null, vals) >= 2, '各座作为起点的次数必须大致均匀（实测 ' + JSON.stringify(firsts) + '）');
  st.slotSalt = 0; st.round = 1;
  eq(X.turnOrder(st)[0], 0, '盐 0 必须保持旧口径（第 1 回合从 0 号座开始）⇒ 页面与既有对比基线不变');
  st.slotSalt = 0; st.round = 3;
  eq(X.turnOrder(st)[0], 2, '盐 0 时盐=0 的轮转必须与旧口径一致（第 3 回合起点 = 2）');
  const st2 = S.createState('multi', { next: function () { return 0.5; } }, 2);
  eq(X.turnOrder(st2).join(','), '0,1', '2 人局必须恒等顺序（v1.0 冻结）');
  const rj = readFileSync('js/core/resolve.js', 'utf8');
  /* v1.7.126（门禁 ② 分诊，批 2）：上面 605–623 已经把 `turnOrder` **真跑**过 —— 5 座在 25 个盐下起点覆盖全 5 座、
   *   各座次数 ≥2、盐 0 保持旧口径、2 人恒等。⇒ 下面这两条**源码 pin 与行为腿重复**：
   *     ① `rj.indexOf('state.slotSalt') >= 0`（盐被用了）—— 615/617 用不同盐得到不同顺序，已经证明；
   *     ② `rj.indexOf('const start = ((state.round || 1) - 1) % n;') < 0`（旧确定性相位已移除）—— 若它回来，615/617 当场红。
   *   摘掉它们**不减少覆盖**（这是「两条腿测同一件事，留行为那条」）。 */
});

t('D53 无显式目标时的默认作用者不得恒定取最小索引（L7 第四次）', function () {
  /* v1.5.54：`oppOf` / `mirrorRefs` 的兜底原本一律 `aliveOpps(...)[0]` = 索引最小的存活对手
   * ⇒ 0 号座是"所有人的默认靶子"（实测 0 号座每局必死 60/60 的一部分来源）。
   * 修法：按每局的盐轮换（纯函数、可复现、不消耗随机流）；**盐 0 保持旧口径**。 */
  ok(typeof X.saltPick === 'function', 'X.saltPick 必须导出（守门要能直测）');
  eq(X.saltPick({ slotSalt: 0, round: 1 }, [3, 1, 4], 0), 3, '盐 0 必须保持旧口径（取 [0]）');
  eq(X.saltPick({}, [3, 1, 4], 0), 3, '没有 slotSalt 时也必须保持旧口径（页面默认）');
  const seen = {};
  for (let sd = 1; sd <= 40; sd++) {
    for (let r = 1; r <= 5; r++) {
      const v = X.saltPick({ slotSalt: sd * 2654435761 >>> 0, round: r }, [1, 2, 3, 4], 0);
      seen[v] = (seen[v] || 0) + 1;
    }
  }
  eq(Object.keys(seen).length, 4, '有盐时默认作用者必须覆盖所有候选（实测 ' + JSON.stringify(seen) + '）');
  const vals = [1, 2, 3, 4].map(function (i) { return seen[i] || 0; });
  ok(Math.max.apply(null, vals) - Math.min.apply(null, vals) <= 40,
    '分布必须大致均匀（实测 ' + JSON.stringify(seen) + '）');
  /* oppOf：无目标时按盐轮换 */
  const st = S.createState('multi', { next: function () { return 0.5; } }, 5);
  X.startTurn(st);
  st.actions[0] = { key: R.SK.ARMOR, target: null };
  st.slotSalt = 0; st.round = 1;
  eq(X.oppOf(st, 0), 1, '盐 0：无目标 ⇒ 旧口径（最小索引的存活对手）');
  const oppSeen = {};
  for (let sd = 1; sd <= 30; sd++) {
    st.slotSalt = sd * 2654435761 >>> 0; st.round = 1;
    const t = X.oppOf(st, 0);
    oppSeen[t] = (oppSeen[t] || 0) + 1;
  }
  eq(Object.keys(oppSeen).length, 4, '有盐时 oppOf 必须覆盖 1..4 号对手（实测 ' + JSON.stringify(oppSeen) + '）');
  /* §改（2026-10-22 千问）：这里原来四条全是钉文本 —— 三条"旧写法（`o[0]` / `opps[0]` / `t2 = o; break;`）
   *   不许回来"+ 一条"`function saltPick(` 必须存在"。存在性那条本就多余（上面每条腿都在**调** `X.saltPick`，
   *   导不出来早炸了）；三条兜底写法钉在 `oppOf` 上确实与 `oppSeen` 那条重复，但 **mirrorRefs 的 t1/t2
   *   全仓没有任何行为面判过**（`grep -rn saltPick tools/gates/` 只命中本门与 ship-feas 的一句注释，
   *   `tests/spec.js` 里没有镜像双目标的散布用例）⇒ 直接删 = 真丢覆盖。所以先补一条跑得出来的：
   *   盐换了 ⇒ 被复制的招打到的人也得换（不恒定），且不能打到自己/复制来源。 */
  const mirSeen = {};
  for (let sd = 1; sd <= 40; sd++) {
    const stM = S.createState('multi', { next: function () { return 0.5; } }, 5);
    for (const p of stM.p) { p.ep = 99; p.hp = 8; }
    X.startTurn(stM);
    stM.slotSalt = sd * 2654435761 >>> 0; stM.round = (sd % 7) + 1;
    S.attemptAction(stM, 0, R.SK.MIRROR, { target: 1 });          // 只给 t1，t2 留给兜底
    S.attemptAction(stM, 1, R.SK.GUN, { target: 0 });
    for (let i = 2; i < 5; i++) S.attemptAction(stM, i, R.SK.JI, {});
    X.resolveActions(stM);
    /* 谁是"被复制那招"的挨打者：2/3/4 号里血量掉了一点的（0 号那 1 点是 1 号的枪，2 号是复制来源） */
    for (let i = 2; i <= 4; i++) if (stM.p[i].hp < 8) mirSeen[i] = (mirSeen[i] || 0) + 1;
  }
  ok(Object.keys(mirSeen).length >= 2, '镜面复制的第二目标必须**随盐变**（实测只打到 ' + JSON.stringify(mirSeen) +
    '）—— 兜底若恒取最小索引，这里只会看到 2 号');
  eq(Object.keys(mirSeen).length, 3, '第二目标要覆盖 2/3/4 三个候选（实测 ' + JSON.stringify(mirSeen) +
    '）‖ 少一个就说明某一支被写死');
});

t('D20 狙击"被干扰"只认"狙击手本人被攻击"（多人局；v1.5.13 修用户报的 bug）', function () {
  /* 用户对局记录（results/epirus-battle-22回合.txt）第 16 回合：玩家5 用枪打**玩家3**，
   * 却把玩家1 打玩家5 的狙击枪判成"狙击被干扰"。
   * 原始 README 特殊 2：「若被作用者或其余玩家对**该玩家**（狙击手）使用其它带攻击效果技能则狙击无效」；
   * 特殊 3 的爆头条件：「若**被作用者**使用的技能对**攻击者**没有影响」⇒ 两者都要求"指向狙击手"。
   * 旧实现只看"目标这回合用了什么技能"、不看打谁 ⇒ 2 人局恰好等价（所以 spec R13/57 一直绿），多人局才错。 */
  const disturbed = function (st) { return st.events.some(function (e) { return e.type === 'voided' && e.by === '狙击被干扰'; }); };
  const mk = function (seed) {
    const st = S.createState('multi', { next: T.mulberry32(seed || 11) }, 3);
    st.p[0].ep = st.p[1].ep = st.p[2].ep = 9;
    return st;
  };
  /* ① 目标打**第三方** ⇒ 狙击必须命中（旧实现在这里会误判） */
  let st = mk();
  S.attemptAction(st, 0, R.SK.SNIPE, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(!disturbed(st), '目标打第三方时不得判"狙击被干扰"');
  ok(st.p[1].hp < 3, '目标打第三方时狙击必须命中（实测目标 hp=' + st.p[1].hp + '）');
  /* ② 第三个人打**狙击手** ⇒ 无效（"其余玩家对该玩家使用"这一支） */
  st = mk();
  S.attemptAction(st, 0, R.SK.SNIPE, { target: 1 });
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  ok(disturbed(st), '狙击手被别人打 ⇒ 必须判"狙击被干扰"');
  eq(st.p[1].hp, 3, '被干扰时目标不掉血');
  /* ③ 目标自己打狙击手 ⇒ 无效（2 人局的老口径，多人局同样成立）
   *    注意：多人局这条通常走**优先级规则**（枪 pri2 > 狙击 pri1 ⇒ "被高优先级攻击阻止"），
   *    所以断言"狙击被废 + 目标不掉血"，不锁具体 by（v1.5.13 实测两者的 by 不同）。 */
  st = mk();
  S.attemptAction(st, 0, R.SK.SNIPE, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(st.events.some(function (e) { return e.type === 'voided' && e.pid === 0; }),
    '目标自己打狙击手 ⇒ 狙击必须被废（by=' + JSON.stringify(st.events.filter(function (e) { return e.type === 'voided'; }).map(function (e) { return e.by; })) + '）');
  eq(st.p[1].hp, 3, '被干扰时目标不掉血');
  /* ④ 2 人局口径不许变（spec R13/57 的等价场景） */
  st = S.createState('standard', { next: T.mulberry32(3) }, 2);
  st.p[0].ep = st.p[1].ep = 9;
  S.attemptAction(st, 0, R.SK.SNIPE, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  ok(st.events.some(function (e) { return e.type === 'voided' && e.pid === 0; }), '2 人局：被枪反打 ⇒ 狙击必须被废（不许回退）');
  eq(st.p[1].hp, 3, '2 人局被干扰时目标不掉血');
});

t('D22 蓄能的珠类型不得泄漏给对手（v1.5.15 修用户报的信息泄漏）', function () {
  /* 规则：`蓄能` 选电珠还是爆珠**只有本人知道**，其他角色只知道"有人蓄能了"。
   * 旧实现把类型直接喂给了 AI（特征里 `.elec/.boom` 的对手项，以及逐对手的 elec/boom 两项）。
   * 判据：构造两个**只差"2 号位的珠类型"**的状态 ⇒ **0 号位看到的特征向量必须逐位相同**。 */
  const mk = function (elec, boom) {
    const st = S.createState('multi', { next: T.mulberry32(9) }, 3);
    st.p[1].elec = elec; st.p[1].boom = boom;
    return st;
  };
  const diffIdx = function (a, b) {
    const out = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) out.push(i);
    return out;
  };
  const fA = Pol.features(mk(1, 0), 0), fB = Pol.features(mk(0, 1), 0), fC = Pol.features(mk(0, 0), 0);
  eq(fA.length, fB.length, '特征长度必须一致');
  eq(diffIdx(fA, fB).length, 0, '对手持电珠 vs 持爆珠 ⇒ 特征必须**完全相同**（泄漏下标=' + JSON.stringify(diffIdx(fA, fB)) + '）');
  /* 但两条**公开**信息必须保留（否则是把公开信息也一起砍了） */
  ok(diffIdx(fA, fC).length > 0, '必须仍能感知"有对手持珠（类型未知）"');
  const st3 = S.createState('multi', { next: T.mulberry32(9) }, 3);
  st3.p[1].lastSkill = R.SK.CHARGE;
  ok(diffIdx(Pol.features(st3, 0), fC).length > 0, '必须仍能感知"有对手刚蓄能"');
});

t('D14 全息屏障必须给**目标**套盾（原始规则），不是给施放者自己', function () {
  /* v1.5.4 规则修正：原始规则集（`D:\code\Epirus\README.md`「全息屏障」）写明
   *   「作用效果：给**被作用者**施加一个“原型制御”」+ 手势「双臂伸出挡住**被作用者**胸前」
   * ⇒ 它是**一张对别人用的盾**。此前 `target:'self'`（R18）把它做成了原型制御的重复品
   * （用户裁定：写两个一模一样的技能没有意义）。
   * 反证：把 rules.js 的 target 改回 'self'、或删掉 resolve.js 里的 holoShieldFrom，本用例立刻红。 */
  ok(R.byKey[R.SK.HOLO].target !== 'self', '全息屏障的目标必须是别人（实测 target=' + R.byKey[R.SK.HOLO].target + '）');
  function mk3() {
    const st = S.createState('multi', { next: mulberry32(7) }, 3);
    st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
    X.startTurn(st);
    return st;
  }
  /* ① 盾套在 P1 身上 ⇒ P1 被打不掉血（盾真的生效） */
  let st = mk3();
  S.attemptAction(st, 0, R.SK.HOLO, { target: 1 });
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.GUN, { target: 1 });
  X.resolveActions(st);
  eq(st.p[1].hp, 3, '被套盾者应被挡住（枪 1 伤）');
  /* ② 盾在 P1 身上，不是施放者身上 ⇒ 打**施放者 P0** 必须照常掉血（旧实现会把他护住） */
  st = mk3();
  S.attemptAction(st, 0, R.SK.HOLO, { target: 1 });
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  eq(st.p[0].hp, 2, '施放者不该被自己的屏障护住（这正是修正前的老行为）');
  eq(st.p[1].hp, 3, '被套盾者本回合没挨打');
  /* ③ 回归：原型制御仍是自保 */
  st = mk3();
  S.attemptAction(st, 0, R.SK.PROTO, {});
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  eq(st.p[0].hp, 3, '原型制御仍是自保（回归）');
  /* ④ 试图把盾套给自己 ⇒ 兜底到别人（规则里目标是"被作用者"） */
  st = mk3();
  S.attemptAction(st, 0, R.SK.HOLO, { target: 0 });
  ok(st.actions[0].target !== 0 && st.actions[0].target != null, '套不到自己（实测 target=' + st.actions[0].target + '）');
  /* ④b v1.5.7（用户裁定）：全息屏障是**多人专用卡** ⇒ 2P 模式不再提供它
   *     （2P 里唯一能套的就是对手 ⇒ 纯陷阱；而自保已有原型制御、效果相同 ⇒ 灰掉零损失） */
  const k2p = R.MODES.standard.skills.map(function (x) { return (typeof x === 'string' ? x : x.key); });
  ok(k2p.indexOf(R.SK.HOLO) < 0, '2P 技能表不得含全息屏障（实测 ' + k2p.length + ' 个技能）');
  ok(k2p.indexOf(R.SK.PROTO) >= 0, '2P 必须保留原型制御（自保的正规手段）');
  const kMulti = R.MODES.multi.skills.map(function (x) { return (typeof x === 'string' ? x : x.key); });
  ok(kMulti.indexOf(R.SK.HOLO) >= 0, '多人模式必须保留全息屏障');
  /* ⑤ 小雷（pri5）在屏障（pri3）之前结算：打**施放者** ⇒ 这次施法被无效化，屏障不该出现。
   * ⚠️ 这是 v1.5.4 的第二个坑：盾若从 `state.actions` 直读（不看 `voided`）就会漏掉无效化，
   * 症状是"小雷明明打了施放者，被套盾的人还是被护住"。（原始规则：雷击之枪需要对**使用者**作用才能使其无效） */
  function mk4() {
    const s4 = S.createState('multi', { next: mulberry32(7) }, 4);
    for (const q of s4.p) q.ep = 5;
    X.startTurn(s4);
    return s4;
  }
  st = mk4();
  S.attemptAction(st, 0, R.SK.HOLO, { target: 1 });
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.GUN, { target: 1 });
  S.attemptAction(st, 3, R.SK.MINI_T, { target: 0 });
  X.resolveActions(st);
  eq(st.p[1].hp, 2, '小雷打施放者 ⇒ 屏障被无效化（被套盾者照样挨枪）');
  eq(st.events.filter(function (e) { return e.type === 'holoSet'; }).length, 0, '被无效化的屏障不该留下 holoSet 事件');
  /* ⑥ 反过来：小雷打**被套盾者** ⇒ 盾仍在（要打施放者才能拆盾），只是那个人自己的技能被无效化 */
  st = mk4();
  S.attemptAction(st, 0, R.SK.HOLO, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 3, R.SK.MINI_T, { target: 1 });
  X.resolveActions(st);
  eq(st.p[1].hp, 3, '小雷打被套盾者 ⇒ 盾仍在');
  eq(st.p[2].hp, 3, '被套盾者自己的技能被无效化（枪没打出去）');
});

t('D23 镜面反射：没有"无可复制" + 优先级裁定（大雷 pri4 先于镜面 pri3）（v1.5.16/v1.5.17 用户裁定）', function () {
  /* v1.5.16（用户裁定）：「没有"无可复制"这回事 —— 所有技能都能复制」：架势 / 自增益 / 能量类复制到
   * **使用者自己**身上（相当于自己也摆了那个架势 / 也蓄了能）；t1 行动被作废时才是"无可复制"。
   * v1.5.17（用户**二次 + 三次**裁定，推翻上一版）：**大雷(pri4) 优先于镜面反射(pri3)** ⇒ 目标若用镜面反射
   * 会先被大雷**无效化**，"反弹并没有被复制成功"；而**同优先级时防御类先出现** ⇒ 复制来的防御架势
   * 挡得住同优先级(pri3)的激光剑 / 坦克（按原本的伤害矩阵），也挡得住随后结算的 ⑤ 枪 / ⑥ 狙击。
   * 反证（三条都会让本用例立刻红）：① 自效果表失效（复制ジ不给 ep）② `guardOf` 改回"从声明派生"
   * （不看 `copiedGuard` 状态）③ 把镜面反射也豁免大雷的"非防御类无效化"。
   * 另有 ④ 去掉 `mirrorGuardPass`（防御架势不在 ④ 之前落位）⇒ D23②c 红。 */
  function mk4() {
    const s = S.createState('multi', { next: mulberry32(11) }, 4);
    for (const q of s.p) q.ep = 6;
    X.startTurn(s);
    return s;
  }
  const cnt = function (st, type) {
    return st.events.filter(function (e) { return e.type === type; }).length;
  };

  /* ① 复制【反弹】⇒ 自己真的获得反弹架势（空指 → t2），且不再发"无可复制"。
   *    对手的枪是 pri2 ⇒ 在镜面反射（pri3）之后结算 ⇒ 这一条正是"复制从结算那一刻起生效"的正例。 */
  let st = mk4();
  S.attemptAction(st, 1, R.SK.REFLECT, {});
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(cnt(st, 'mirrorNoEffect'), 0, '不该出现"无可复制"（t1 有行动）');
  eq(cnt(st, 'mirrorCopySelf'), 1, '应有一条"复制到自己身上"');
  const g0 = X.guardOf(st, 0);
  ok(g0 && g0.kind === 'reflect', '复制到的反弹必须是**真架势**（实测 ' + JSON.stringify(g0) + '）');
  eq(st.p[0].hp, 3, '复制来的反弹挡住 P2 的枪');
  eq(st.p[2].hp, 2, '反弹把枪弹回 P2（R20：枪可被反弹）');

  /* ② **优先级裁定**：a 复制 b 的【反弹】并指向 c，d 用大雷打 a
   *    ⇒ 大雷(pri4) 先结算、把 a 的镜面反射无效化 ⇒ 复制根本没发生 ⇒ a 挨那 2 点电伤；
   *      b 仍有自己的反弹（连带打不动它）；c 只是被声明的 t2，而施法已废 ⇒ 不产生指向、不受影响。 */
  st = mk4();
  S.attemptAction(st, 1, R.SK.REFLECT, {});                       // b：自己的反弹
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 }); // a：想复制 b、指向 c
  S.attemptAction(st, 2, R.SK.JI, {});                            // c
  S.attemptAction(st, 3, R.SK.BIG_T, { target: 0 });              // d：大雷打 a
  X.resolveActions(st);
  ok(st.actions[0].voided, 'a 的镜面反射必须被大雷无效化（镜面反射不是防御族）');
  eq(cnt(st, 'mirrorCopySelf'), 0, '被作废的镜面反射不该产生任何复制');
  eq(st.p[0].hp, 1, '复制没发生 ⇒ a 实打实挨 2 点电伤（v1.5.16 那版会错误地护住他）');
  eq(st.p[1].hp, 3, 'b 有自己的反弹 ⇒ 连带动不了它');
  eq(st.p[2].hp, 3, 'c 只是被声明的 t2 而施法已废 ⇒ 不产生指向、不受连带');

  /* ②c 同优先级（v1.5.17 用户三次澄清「同优先级的时候防御类先出现」）：复制来的防御架势要挡得住
   *     **同优先级(pri3)** 的攻击 —— 坦克能穿防御但穿不了反弹 ⇒ 反弹挡得住并弹回。 */
  st = mk4();
  S.attemptAction(st, 1, R.SK.REFLECT, {});
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 2, R.SK.TANK, { target: 0 });              // 坦克 pri3，与镜面反射同优先级
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].hp, 3, '复制来的反弹应挡住同优先级的坦克（同优先级防御类先出现）');
  eq(st.p[2].hp, 2, '并把坦克弹回 P2（坦克在 REFLECTABLE 里）');

  /* ②d 但"本来挡不住的"仍挡不住：激光剑可攻破反弹（pierce.reflect）⇒ 复制来的反弹也挡不住它
   *     （否则就是把这个澄清改成了"复制来的防御无敌"，伤害矩阵被改坏）。 */
  st = mk4();
  S.attemptAction(st, 1, R.SK.REFLECT, {});
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 2, R.SK.SWORD, { target: 0 });
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].hp, 2, '激光剑穿反弹 ⇒ 复制来的反弹挡不住（伤害矩阵保持原样）');

  /* ③ 自增益/能量类也复制到自己身上：复制【ジ】⇒ 自己 +1 ep（镜面反射 3 ⇒ 6-3+1=4） */
  st = mk4();
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].ep, 4, '复制【ジ】应给使用者自己 +1 ep');

  /* ④ 复制【蓄能】的珠类型取**使用者自己**的选择，不读 t1 的（t1 蓄哪种珠是隐藏信息，见 D22） */
  st = mk4();
  S.attemptAction(st, 1, R.SK.CHARGE, { bead: 'elec' });
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2, bead: 'boom' });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].boom, 1, '复制蓄能应得使用者自己选的爆珠');
  eq(st.p[0].elec, 0, '不得因为 t1 蓄了电珠就白拿电珠（那等于泄漏隐藏信息）');

  /* ⑤ 唯一的合法"无可复制"：t1 本回合行动已被作废 */
  st = mk4();
  S.attemptAction(st, 1, R.SK.GUN, { target: 3 });        // t1 用枪
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });        // 用它验证"确实没拿到任何架势"
  S.attemptAction(st, 3, R.SK.MINI_T, { target: 1 });     // 小雷作废 t1 的枪
  X.resolveActions(st);
  eq(cnt(st, 'mirrorNoEffect'), 1, 't1 被作废 ⇒ 唯一合法的"无可复制"');
  eq(cnt(st, 'mirrorCopySelf'), 0, 't1 被作废时不该复制任何东西');
  eq(st.p[0].hp, 2, '没拿到架势 ⇒ 枪照常命中');

  /* ⑥ 穷举守门：技能表里**每一个**技能都必须被显式归类（新增技能必须决定它怎么被复制，
   *    否则会出现"复制了等于没复制"这种静默漏洞 —— 本项目的第四次同类事故就是这个形状）。 */
  const DMG_COPY = [R.SK.GUN, R.SK.SWORD, R.SK.TANK, R.SK.SNIPE, R.SK.DRAIN, R.SK.RAILGUN,
    R.SK.BIG_T, R.SK.CANNON, R.SK.LASER_EYE, R.SK.DUAL_GUN];
  const AIR_ONLY = [R.SK.MINI_T, R.SK.TRANSFER, R.SK.CURSE, R.SK.FIRESTORM, R.SK.TAUNT, R.SK.MIRROR];
  const cls = {};
  for (const k of DMG_COPY) { ok(!cls[k], '分类重复：' + k); cls[k] = 'dmg'; }
  for (const k of R.MIRROR_SELF) { ok(!cls[k], '分类重复：' + k); cls[k] = 'self'; }
  for (const k of AIR_ONLY) { ok(!cls[k], '分类重复：' + k); cls[k] = 'air'; }
  const all = R.skills.map(function (s) { return s.key; });
  const unclassified = all.filter(function (k) { return !cls[k]; });
  eq(unclassified.length, 0, '有技能没归类（新增技能必须决定怎么复制）：' + JSON.stringify(unclassified));
  eq(Object.keys(cls).length, all.length, '分类表必须与技能表一一对应（技能数 ' + all.length + '）');

  /* ⑦ "归类了但没实现"也要红：把每个自效果技能真的复制一遍，看架势/资源是否到位 */
  const EXPECT = {};
  EXPECT[R.SK.GUARD] = 'guard'; EXPECT[R.SK.REFLECT] = 'reflect'; EXPECT[R.SK.BAGUA] = 'bagua';
  EXPECT[R.SK.SHIFT] = 'bagua'; EXPECT[R.SK.JINSHIELD] = 'jinshield'; EXPECT[R.SK.ARMOR] = 'armor';
  EXPECT[R.SK.PROTO] = 'proto'; EXPECT[R.SK.HOLO] = 'proto';   // 复制全息屏障 = 原型制御式自保（v1.5.7 两者等价）
  for (const k of R.MIRROR_SELF) {
    const s2 = S.createState('multi', { next: mulberry32(3) }, 3);
    for (const q of s2.p) q.ep = 9;
    X.startTurn(s2);
    ok(S.canUseSkillInMode(s2, k), '多人模式应可用：' + k);
    S.attemptAction(s2, 1, k, {});
    eq(s2.actions[1].outcome, 'ok', 't1 用 ' + k + ' 应成功（' + s2.actions[1].reason + '）');
    S.attemptAction(s2, 0, R.SK.MIRROR, { target: 1, target2: 2 });
    S.attemptAction(s2, 2, R.SK.JI, {});
    X.resolveActions(s2);
    ok(s2.events.some(function (e) { return e.type === 'mirrorCopySelf' && e.key === k; }),
      '复制【' + k + '】必须走"复制到自己身上"分支');
    if (EXPECT[k]) {
      const gg = X.guardOf(s2, 0);
      ok(gg && gg.kind === EXPECT[k], '复制【' + k + '】后架势应为 ' + EXPECT[k] + '（实测 ' + JSON.stringify(gg) + '）');
    }
    if (k === R.SK.MINE) ok(s2.p[0].mineArmed, '复制地雷应让自己也架上雷');
    if (k === R.SK.ROD) ok(s2.p[0].rodGuard > 0, '复制避雷针应得到免雷窗口（R31 情形B）');
  }

  /* ⑧ 页面必须真的会渲染这条新事件：事件渲染是纯映射、**没有默认分支** ⇒ 漏了就是静默不显示。 */
  const uiSrc = readFileSync('js/ui/ui.js', 'utf8');
  ok(/case 'mirrorCopySelf'/.test(uiSrc), 'ui.js 必须渲染 mirrorCopySelf 事件');
  ok(/case 'mirrorNoEffect'/.test(uiSrc), 'ui.js 必须仍渲染 mirrorNoEffect（t1 被作废那条）');
});

t('D29 "只有指纹在响"的规则数据必须有**行为**断言（判定 p / 爆头 3 轮 / 小雷豁免名单 / 费用 / 雷系集合）', function () {
  /* 第三方复核 §2-2 做了 17 个变异注入，结论是：**用户报过 bug 的路径与刚裁定的路径守门是真的，
   * 但"早就定稿、没人再质疑"的规则数据表没有任何行为断言在守** —— 改坏了只有 D16 指纹会响
   * （那只说明"东西变了"，不说明"哪个行为错了"）。最典型的一条：`tests/spec.js` 里那条名叫
   * 「三判定全胜=爆头」的测试，把 `judge3` 改成 `judge`（只判一次）**照样绿**。
   * 下面每条都对应那 7 条注入之一，且都必须能反证（改坏 → 红）。 */
  const seqRngN = function (vals) { let i = 0; return { next: function () { return i < vals.length ? vals[i++] : 0.9; } }; };
  const mkst = function (rng) { return S.createState('standard', rng, 2); };

  /* ① 判定 = 公平随机、阈值严格 0.5（原文"判定：双方进行猜拳"）。
   * 反证：把 `resolve.js:63` 的 0.5 改成 0.65 ⇒ 第一、三条立刻红。 */
  ok(X.judge(mkst(seqRngN([0.49]))) === true, '判定：0.49 < 0.5 ⇒ 胜');
  ok(X.judge(mkst(seqRngN([0.5]))) === false, '判定：0.5 不算胜（严格小于）');
  ok(X.judge(mkst(seqRngN([0.51]))) === false, '判定：0.51 ⇒ 负');

  /* ② 爆头必须**三轮全胜**（原文「进行 3 轮判定，若攻击者均获胜」）。
   * 反证：把 `judge3` 改成 `judge` ⇒ 第二条立刻红。 */
  ok(X.judge3(mkst(seqRngN([0.1, 0.1, 0.1]))) === true, '三次全胜 ⇒ 爆头');
  ok(X.judge3(mkst(seqRngN([0.1, 0.1, 0.6]))) === false, '2 胜 1 负 ⇒ **不**爆头（这一条才钉住那个"3"）');
  ok(X.judge3(mkst(seqRngN([0.6, 0.1, 0.1]))) === false, '首轮即负 ⇒ 不爆头');

  /* ③ 小雷豁免名单 = 防御 / 反弹 / 原型制御（原文"使除防御、反弹、原型制御外技能无效"）。 */
  eq(R.MINI_T_IMMUNE.slice().sort().join(','), [R.SK.GUARD, R.SK.REFLECT, R.SK.PROTO].sort().join(','),
    '小雷豁免名单必须恰好是 防御/反弹/原型制御（多一个少一个都是规则漂移；反证：把八卦阵加进去 ⇒ 红）');
  /* 穷举表态（审计 R1 的建议）：防御族里每张卡都必须被显式判为"豁免 / 不豁免"。
   * 这样以后新增一张防御卡，就必须先回答"小雷能不能无效它"，而不是静默漂移。 */
  const GUARD_NON_IMMUNE = [R.SK.BAGUA, R.SK.SHIFT, R.SK.JINSHIELD, R.SK.ARMOR, R.SK.HOLO];
  const cls = {};
  for (const k of R.MINI_T_IMMUNE) { ok(!cls[k], '小雷豁免名单重复：' + k); cls[k] = 'immune'; }
  for (const k of GUARD_NON_IMMUNE) { ok(!cls[k], '分类重复：' + k); cls[k] = 'not'; }
  const unclassified = R.GUARD_FAMILY.filter(function (k) { return !cls[k]; });
  eq(unclassified.length, 0, '防御族里有卡没表态"小雷是否豁免"（新增防御卡必须显式归类）：' + JSON.stringify(unclassified));

  /* ④ 费用走**行为**口径（不是只比常量）：大雷 5 ジ、全息屏障 1 ジ。
   * 反证：大雷改 3 / 全息改 3 ⇒ 下面各有一条红。 */
  const stB = S.createState('multi', { next: mulberry32(77) }, 3);
  stB.p[0].ep = 4; X.startTurn(stB);
  eq(S.attemptAction(stB, 0, R.SK.BIG_T, { target: 1 }).outcome, 'insufficient', '大雷 4 ジ 必须不够（花费 5）');
  stB.p[0].ep = 5;
  eq(S.attemptAction(stB, 0, R.SK.BIG_T, { target: 1 }).outcome, 'ok', '大雷 5 ジ 必须够');
  const stH = S.createState('multi', { next: mulberry32(79) }, 3);
  stH.p[0].ep = 0; X.startTurn(stH);
  eq(S.attemptAction(stH, 0, R.SK.HOLO, { target: 1 }).outcome, 'insufficient', '全息屏障 0 ジ 必须不够（花费 1）');
  stH.p[0].ep = 1;
  eq(S.attemptAction(stH, 0, R.SK.HOLO, { target: 1 }).outcome, 'ok', '全息屏障 1 ジ 必须够');

  /* ⑤ 雷系集合（避雷针回馈 / 大雷传导都读它）必须含电磁炮 —— 并且看**行为**：
   * 避雷针在场（情形 A）时电磁炮必须被无效化。反证：把 RAILGUN 从 LIGHTNING 删掉 ⇒ 这条红。 */
  for (const k of [R.SK.RAILGUN, R.SK.MINI_T, R.SK.BIG_T]) ok(R.LIGHTNING.indexOf(k) >= 0, '雷系集合必须含 ' + k);
  const stR = S.createState('multi', { next: mulberry32(83) }, 3);
  for (const q of stR.p) { q.ep = 9; q.hp = 8; }
  stR.p[1].elec = 1;                      // 电磁炮需要 1 电珠
  X.startTurn(stR);
  S.attemptAction(stR, 0, R.SK.ROD, {});
  S.attemptAction(stR, 1, R.SK.RAILGUN, { target: 0 });
  S.attemptAction(stR, 2, R.SK.JI, {});
  X.resolveActions(stR);
  ok(stR.actions[1].voided, '避雷针在场（情形 A）必须无效化本回合的电磁炮');
  eq(stR.p[0].hp, 8, '避雷针使用者不该被那个电磁炮打到');
  ok(stR.events.some(function (e) { return e.type === 'rod' && e.mode === 'A'; }), '必须走情形 A（当回合有雷系）');
});

t('D30 铁索连环一次性（真实摄魂路径）+ 合二为一 >=2（3 人同轰也只额外 +1）', function () {
  /* 第三方复核 §3-1 指出两处实现与原文不符，用户 2026-09-13 裁定：
   *   ① 铁索连环原文「**下一次**当其中一个角色受到伤害时，另一个也受到相同伤害」⇒ **一次性**；
   *   ② 合二为一原文「**两个**角色同时对同一角色使用雷击之枪」⇒ **保持** `>=2`（3 人同轰同样只触发一次）。 */

  /* ① 走真实路径建立连边：双方互勾【摄魂指法】（需目标 HP ≤ drainHpMax，multi 下 =1）。
   * 按 RULES-2P 的顺序口径：先各自治愈到 2、再互相扣到 1 ⇒ 无人死亡 ⇒ 连环成立。 */
  const st = S.createState('multi', { next: mulberry32(97) }, 3);
  for (const q of st.p) { q.ep = 9; q.hp = 1; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.DRAIN, { target: 1 });
  S.attemptAction(st, 1, R.SK.DRAIN, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].hp, 1, '互勾摄魂后 A 仍活着（先治愈后扣血）');
  eq(st.p[1].hp, 1, '互勾摄魂后 B 仍活着');
  eq((st.p[0].chains || []).join(','), '1', '互勾摄魂必须建立连边 A↔B');
  eq((st.p[1].chains || []).join(','), '0', '连边必须是对称的');
  st.p[0].hp = 5; st.p[1].hp = 5;                     // 抬高血量，便于观察共享
  X.rawDamage(st, 0, 2, '测试', 'test', {});
  eq(st.p[0].hp, 3, 'A 自身');
  eq(st.p[1].hp, 3, 'B 共享同量伤害');
  eq((st.p[0].chains || []).length, 0, '共享一次后 A 侧连边解除（一次性）');
  eq((st.p[1].chains || []).length, 0, '共享一次后 B 侧连边解除');
  X.rawDamage(st, 0, 2, '测试', 'test', {});
  eq(st.p[1].hp, 3, '第二次不再共享 —— 要再连必须重新互勾摄魂');

  /* ② 合二为一：**3 人**同时对同一目标用小雷 ⇒ 仍然只额外 +1（用户裁定保持 `>=2`）。
   * 反证：把 `>= 2` 改成 `=== 2` ⇒ 本用例立刻红。 */
  const st3 = S.createState('multi', { next: mulberry32(99) }, 4);
  for (const q of st3.p) { q.ep = 9; q.hp = 9; }
  X.startTurn(st3);
  S.attemptAction(st3, 0, R.SK.MINI_T, { target: 3 });
  S.attemptAction(st3, 1, R.SK.MINI_T, { target: 3 });
  S.attemptAction(st3, 2, R.SK.MINI_T, { target: 3 });
  S.attemptAction(st3, 3, R.SK.JI, {});
  X.resolveActions(st3);
  const unite = st3.events.filter(function (e) { return e.type === 'hidden' && e.name === '合二为一'; });
  eq(unite.length, 1, '3 人同轰同一目标 ⇒ 合二为一只触发**一次**（保持 >=2 口径）');
  eq(st3.p[3].hp, 8, '被作用者只额外吃 1 点电伤（不是 2 点）');
});

t('D31 复制避雷针的"挡本回合的雷"与免雷窗口的真实口径（v1.5.18 用户裁定 / 第三方复核 §6 R2）', function () {
  /* 背景：R2 提议把"复制到避雷针"那一支从 ④b **提前到 ② 之前**，好让它挡本回合在飞的雷。
   * **实现时的实测结论：那是空操作** —— ① 层的避雷针语义是"**当回合有任何雷系技能 ⇒ 它们全部无效**"
   * （全场，见 `resolveActions` ① 段），而"镜面反射能复制到避雷针"的**前提**就是 t1 本回合真的用了避雷针
   * ⇒ ① 必然已经把那一回合的雷清空了 ⇒ 复制来的窗口本回合无物可挡。
   * 也就是说用户要的**结果**（a 不该吃到那个大雷）本来就成立，只是机制来自 t1 的真避雷针。
   * 因此那段提前落位没有落进代码（"有实现、有测试、无入口"正是审计 §3-2 点名的最危险形态）；
   * 改为把事实**钉成守门**：若将来有人把 ① 收窄成"只无效化指向避雷针使用者的雷"，下面第一条立刻红。 */

  /* 场景一：a 用镜面反射复制 b 的【避雷针】，c 用【大雷】打 a ⇒ a 安全，且原因是 ① 的全场无效化。 */
  const st = S.createState('multi', { next: mulberry32(131) }, 3);
  for (const q of st.p) { q.ep = 9; q.hp = 5; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 1, R.SK.ROD, {});
  S.attemptAction(st, 2, R.SK.BIG_T, { target: 0 });
  X.resolveActions(st);
  eq(st.p[0].hp, 5, 'a 不该吃到大雷的 2 点（这就是用户要的结果）');
  ok(st.actions[2].voided, '那个大雷必须被无效化 —— 由 t1 的**真**避雷针在 ① 层全场无效化（不是复制体）');
  ok(st.events.some(function (e) { return e.type === 'rod' && e.mode === 'A'; }), '必须走 ① 的情形 A（当回合有雷系 ⇒ 全部无效）');
  ok(st.p[0].rodGuard > 0, '复制避雷针仍应给出免雷窗口（供后续回合用）');
  ok(st.events.some(function (e) { return e.type === 'mirrorCopySelf' && e.key === R.SK.ROD; }), '复制本身照常发生');

  /* 场景二：免雷窗口（R31 情形B）必须能挡【电磁炮】—— v1.5.18 修的**真实偏差**
   *（电磁炮在 `R.LIGHTNING` 里，但它的投递原先从不查 `rodGuard`）。反证：删掉 ④ 的 `case SK.RAILGUN`
   * 里那段 rodGuard 检查 ⇒ 本场景两条立刻红。 */
  const st2 = S.createState('multi', { next: mulberry32(137) }, 3);
  for (const q of st2.p) { q.ep = 9; q.hp = 5; }
  st2.p[2].elec = 1;                    // 电磁炮需要 1 电珠
  X.startTurn(st2);
  st2.p[0].rodGuard = 4;                // 上一回合避雷针留下的窗口（本回合没人用避雷针 ⇒ ① 不介入）
  S.attemptAction(st2, 2, R.SK.RAILGUN, { target: 0 });
  S.attemptAction(st2, 0, R.SK.JI, {});
  S.attemptAction(st2, 1, R.SK.JI, {});
  X.resolveActions(st2);
  eq(st2.p[0].hp, 5, '电磁炮必须被避雷针的免雷窗口挡下（v1.5.18 之前这里是坏的）');
  ok(st2.actions[2].voided, '电磁炮那次行动必须被无效化');
  ok(st2.events.some(function (e) { return e.type === 'rodBlock' && e.by === R.SK.RAILGUN; }), '应当出现 rodBlock(电磁炮)');

  /* 场景三（**回归 v1.5.17**）：复制的是**防御架势**时，大雷照旧把镜面反射废掉 ⇒ 证明本节的结论
   * 没有影响"大雷 pri4 先于镜面反射 pri3"这条裁定。 */
  const st3 = S.createState('multi', { next: mulberry32(139) }, 3);
  for (const q of st3.p) { q.ep = 9; q.hp = 5; }
  X.startTurn(st3);
  S.attemptAction(st3, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st3, 1, R.SK.REFLECT, {});
  S.attemptAction(st3, 2, R.SK.BIG_T, { target: 0 });
  X.resolveActions(st3);
  ok(st3.actions[0].voided, 'v1.5.17 裁定仍成立：复制防御架势时大雷(pri4)先作废镜面反射');
  eq(st3.p[0].hp, 3, 'a 必须实打实挨那 2 点（复制的反弹挡不住先前结算的大雷）');
});

t('D46 终局平局口径：全活但血量有差 = 按血量的胜局（只有血量也相同才算平局）', function () {
  /* 规则原文（rules.js:134）：到上限"按血最多者胜" ⇒ 游戏本身按血量排名次。
   * 此前体检把"全员存活"一律当平局 ⇒ 农夫场出现"0% 胜 / 100% 和"的假象（复核两轮都提到）。 */
  eq(T.allAliveTied([{ hp: 2 }, { hp: 2 }]), true, '全活且血量相同 ⇒ 真平局');
  eq(T.allAliveTied([{ hp: 3 }, { hp: 2 }]), false, '全活但血量不同 ⇒ 不是平局（按血量分胜负）');
  eq(T.allAliveTied([{ hp: 1 }, { hp: 1 }, { hp: 0 }]), false, '有人死了 ⇒ 不是平局');
  eq(T.allAliveTied([{ hp: 0 }, { hp: 0 }]), false, '全死 ⇒ 不是平局');
  eq(T.allAliveTied([]), false, '空数组 ⇒ 不是平局（防御性）');
});


t('D50 对手槽位并列不得按 pid 升序（座位身份泄漏 ⇒ 0 号座夺冠 81%）', function () {
  /* 复核 §3 实测：5 席同策略自对局 **0 号座夺冠 81%（long）/ 59%（multi）**，其余 3~7%（期望 20%）。
   * 机制：开局全员同血时并列按 pid 升序 ⇒ 1~4 号座看别人时"槽位 0"永远是 0 号座 ⇒ 特征里出现
   * 与实力无关的座位身份泄漏 ⇒ 网络学"槽位 0 该怎么对待"。这是 L7 教训（并列不许按 pid 升序）的另一处复现。 */
  const firsts = [];
  for (let sd = 0; sd < 5; sd++) {
    const st = S.createState('multi', { next: mulberry32(1000 + sd) }, 5);
    st.round = 1 + sd;
    firsts.push(Pol.oppSlots(st, 1)[0]);
  }
  ok(new Set(firsts).size > 1, '不同回合下"槽位 0"不得恒为同一人（修前对 pid=1 恒为 0 号座）');
  const pol = readFileSync('js/train/policy.js', 'utf8');
  ok(pol.indexOf('slotRand(x, state) - slotRand(y, state)') >= 0, '并列排序必须用**不可预测的键**（slotRand(x,state)）');
  {
    /* v1.5.52 反证型守门：槽位键**绝不能借用采样/游戏随机流** ——
     * v1.5.51 借了策略的 __rng() ⇒ ① 消耗采样流；② 任何"特征调用时机/次数"变化都扰动它 ⇒
     * 实测把 D22（蓄能珠类型不得泄漏）踩红。旧实现还曾从 state.rng 抽盐 ⇒ 改变对局行为（D26 红）。 */
    const i0 = pol.indexOf('function slotRand(');
    const i1 = pol.indexOf('function oppSlots(');
    const seg = (i0 >= 0 && i1 > i0) ? pol.slice(i0, i1) : '';
    ok(seg.length > 0, '必须能定位 slotRand 的实现段');
    ok(seg.indexOf('__rng') < 0, '槽位键不得使用策略采样随机流 __rng');
    ok(seg.indexOf('state.rng') < 0 && seg.indexOf('rng.next') < 0, '槽位键不得消耗对局随机流 state.rng');
    ok(seg.indexOf('__slotHash') >= 0, '槽位键必须是纯函数哈希（决策内一致、可复现）');
  }
  ok(pol.indexOf('_rot(x) - _rot(y)') < 0, '旧的"按回合起点轮转"必须已移除（它让回合起点占槽位 0 ⇒ 被集火）');
  ok(pol.indexOf('SLOT_RAND') < 0, '不得再用"缓存随机键"的旧实现（v1.5.52 改为纯函数哈希 ⇒ 决策内天然一致）');
  ok(pol.indexOf('return d !== 0 ? d : x - y;') < 0, '旧的"并列按 pid 升序"必须已移除');
});


/* ===== v1.5.71（第五轮复核 §2-1/§2-2/§2-3/§4-6）：门槛的**单一真源**与**样本量守卫** =====
 * 三条更正各自的反证都做成用例：不能只在"病在的时候"绿，必须在**机制死掉时变红**。 */
t('D63 会瞄人的对手（targeter）：指威胁 + 目标不被引擎剥掉（复核 §4-1）', function () {
  ok(typeof Bots.pickTargeter === 'function', 'Bots.pickTargeter 必须存在');
  const poolSrc = readFileSync('server/opp-pool.mjs', 'utf8');
  ok(/\{\s*name:\s*'targeter'/.test(poolSrc), 'targeter 必须登记进 server/opp-pool.mjs 的 OPP_SPECS（单一来源；漏登记 = 服务端拿到 undefined）');
  ok(poolSrc.indexOf("fn: 'pickTargeter'") >= 0, 'OPP_SPECS 里的 fn 必须是 pickTargeter');
  const st = S.createState('multi', { next: mulberry32(63) }, 5);
  /* 场景：1 号座是**领先者**（血最多 ⇒ pickTargetN 会选他），真正在滚环的是 2 号座，3 号座攒满 5 ジ。 */
  st.p[0].ep = 2;                       // 自己攒够一枪的钱（否则"指谁"这件事无从表达）
  /* 血量故意造成"**没有可击杀目标**（无人 ≤ 枪的 1 点伤害）+ 领先者唯一"的确定性局面：
   * 这样默认口径 pickTargetN 必然选 1 号座（血最多），而 targeter 必然选 2 号座（在滚环）——
   * 两者不同 ⇒ 本用例才真的分得出"自己瞄"与"默认口径"（否则测试没有判别力）。 */
  st.p[1].hp = 3; st.p[2].hp = 2; st.p[3].hp = 2; st.p[4].hp = 2;
  st.p[2].ringStreak = 2; st.p[3].ep = 5;
  const legal = Play.legalActions(st, 0);
  eq(T.pickTargetN(st, 0, R.SK.GUN), 1, '对照：默认口径必须选领先者 1 号座（否则本用例分不出自己瞄与默认口径）');
  const raw = Bots.pickTargeter(st, 0, legal);
  eq(raw.target, 2, 'targeter 必须掐**在滚环**的那位（实测 target=' + raw.target + '）');
  /* ① 关键：目标必须活着穿过 wrapBotN（v1.3.55 的"保留脚本自选目标"） */
  const wrapped = T.wrapBotN(Bots.pickTargeter)(st, 0, legal);
  eq(wrapped.target, 2, 'wrapBotN 必须保留脚本自选目标，实测 ' + wrapped.target + '（被剥掉 ⇒ 本对手退化成 pickTargetN）');
  ok(wrapped.target !== 1, '不得退化成"打血最多的领先者"（那是 pickTargetN 的口径，= 病根本身）');
  /* ② 只读状态真源：滚环者消失后必须转向"刚放冷枪的"，而不是永远指 2 号 */
  st.p[2].ringStreak = 0; st.p[3].lastSkill = R.SK.SNIPE;
  eq(T.wrapBotN(Bots.pickTargeter)(st, 0, legal).target, 3, '滚环者消失后必须转向刚放冷枪的');
  /* ③ 无威胁 ⇒ **压领先者**，不许攒钱躺平
   * （实测反噬：第一版"无威胁就攒钱"让 `--field=targeter` 随机基线都有 78.3%，
   *   而且会给训练送一条"别成为威胁就不挨打"的反向梯度 = 喂大低压力场瘫） */
  st.p[3].lastSkill = null; st.p[3].ep = 0;
  const w3 = T.wrapBotN(Bots.pickTargeter)(st, 0, legal);
  eq(w3.key, R.SK.GUN, '无威胁时也必须出手（实测 ' + w3.key + '）');
  eq(w3.target, 1, '无威胁时必须压领先者 1 号座（实测 ' + w3.target + '）');
  /* ④ 濒死保命优先于补刀（别让它变成送人头机器） */
  st.p[2].ringStreak = 1; st.p[0].hp = 1; st.p[0].ep = 3;
  const w4 = T.wrapBotN(Bots.pickTargeter)(st, 0, Play.legalActions(st, 0));
  eq(w4.key, R.SK.GUARD, '1 血且买得起盾时必须先保命（实测 ' + w4.key + '）');
});


/* ===== v1.5.71（第五轮复核 §4-2）：狙击场探针 =====
 * 复核把"狙击无解"证伪了（任何攻击效果技能指过来就能让狙击无效，1 ジ 的枪就够）；池里之所以显得无解，
 * 是因为**没人会瞄人**。这条用例盯两件事：① 归因口径是纯函数且双向可证（`source` 而非 `from`）；
 * ② 混合场才带靶向判别力（4 席全狙击时比例恒 ~1 ⇒ 无判别力，那是我 `ringWallProbe` 犯过的错）。 */
t('D91 被无效化的聚能环不得续计（v1.5.105：出招即计次 + 复位漏 voided ⇒ 打断者反而送 +3）', function () {
  /* 用户实盘 bug（`results/epirus-battle-26回合.txt:52-64`）：第 9 回合环被雷击之枪无效化（无ジ进账），
   * 第 10 回合却直接吃 **+3**。根因：`state.js:190` 出招即 `ringStreak++`，`endTurn` 的复位只看
   * `outcome === 'ok'`，而 `setVoid` 只置 `voided` ⇒ 被废的那次照样算"续"。
   * ⚠️ 注意性质：这不是"没文档的事故" —— 旧行为被 `docs/RULES-2P.md:73` 的 R10 条款**文档化**过
   * （且那句话自相矛盾："计数已+1"与"不再连续"互斥）。用户 2026-09-18 裁定按"打断必须断链"改。
   * 这条门是**结构反证**；行为证据在 `tests/spec.js` 的 R10 新用例（旧实现读到 ep=5/streak=2）。 */
  /* §改（2026-10-22 千问，用户指令「大胆删掉没用的门禁 · 改掉钉文本的」）：原来三条全是钉源码 ——
   *   ① `!a.voided && a.key === SK.RING` 在不在，② 旧写法字符串不许出现，③ `state.js` 里炮的计次那行不许动。
   *   ①② 做过"摘腿后变异"：**摘掉 `!a.voided` 跑 `node tools/spec-run.mjs` ⇒ 54/55，点名的正是
   *   `R10 被小雷无效化的聚能环不续计`** ⇒ 覆盖在 spec 里有一条会红的行为用例，门里那两条只是把写法钉死
   *   （等价改写就红、真改坏由 spec 抓 ⇒ 属搬家不属丢覆盖，按 R6 记在这里）。
   *   ③ 没有对应的行为用例 ⇒ **不删，换成跑对局**：环与炮这两条明文方向相反（废一手必须断环的续计，
   *   但炮的"出招即计次"照旧），所以一次跑局就能同时判两边 —— 谁把炮也顺手"修"成按可决性计次，这条立刻红。 */
  const mk = function (key, voided, seed) {
    const st = S.createState('standard', { next: mulberry32(seed) }, 2);
    st.p[0].ep = 9; st.p[0].boom = 1; st.p[0].cannonCount = 0; st.p[0].ringStreak = 2;
    X.startTurn(st);
    const opt = key === R.SK.CANNON ? { target: 1, bead: 'boom' } : {};
    S.attemptAction(st, 0, key, opt);
    if (voided) X.setVoid(st, 0, 1);
    X.resolveActions(st);
    X.endTurn(st);
    return st;
  };
  const cKeep = mk(R.SK.CANNON, false, 4242), cVoid = mk(R.SK.CANNON, true, 4242);
  eq(cKeep.p[0].cannonCount, 1, '前提：过载炮出招即计次（不废一手时实测 ' + cKeep.p[0].cannonCount + '）⇒ 读不出 1 说明夹具没打出去');
  eq(cVoid.p[0].cannonCount, 1, 'R43：过载炮**被无效化也照样计次**（实测 ' + cVoid.p[0].cannonCount +
    '）—— 这是明文裁定，不许被 R10 那次修复顺手改掉（方向与环相反：环要断，炮要留）');
  const rKeep = mk(R.SK.RING, false, 4242), rVoid = mk(R.SK.RING, true, 4242);
  ok(rKeep.p[0].ringStreak > rVoid.p[0].ringStreak,
    'R10 同一把夹具的另一半：环被废就必须**断链**（实测 不废=' + rKeep.p[0].ringStreak + ' ‖ 被废=' + rVoid.p[0].ringStreak +
    '）⇒ 两个读数一样说明 `voided` 那条复位又不生效了（就是本门标题里那个 bug）');
});

t('D102 R61 被无效化的一手不写 lastSkill（第三方复核 §2-1：与 R10 同族 · 打断不再白送激光眼连用）', function () {
  /* 病（`docs/research/reviews/REVIEW-QODER-2026-09-19.md` §2-1）：`setVoid` 只置 `voided`、**不动** `outcome`，
   * 而 `endTurn` 的 `p.lastSkill = ...` 只看 `outcome === 'ok'`（`js/core/resolve.js:1179`）
   * ⇒ "被雷击之枪废掉的那一手"照样成为 `lastSkill`，喂给两个真实下游：
   *   ① **R32 激光眼连用**（`state.js:118-123`：连用只收 2 ジ**且免爆珠**）⇒ 打断方反而送出一次免珠连用；
   *   ② 特征块（`policy.js:209-212` / `:259-260`）⇒ 读到一手**根本没发生**的动作。
   * 它是 R10（被无效化的**聚能环**不续计，D91）的**另一半** —— D91 只钉了环。
   * 本条按 v1.5.128 的规矩写成**运行时行为门**（不是源码文本钉），并且**带对照组**：
   * 只有"被无效化 ⇒ null"与"没被无效化 ⇒ 照旧"**两个方向都能失败**，才排除"恒 null"这种假修法。 */
  const mkEye = function (seed) {
    const st = S.createState('standard', { next: mulberry32(seed) }, 2);
    st.p[0].ep = 5; st.p[0].boom = 1;
    eq(S.computeCost(st, 0, R.SK.LASER_EYE).ep, 1, '前提：**首次**激光眼收 1 ジ（R32 的另一半是连用收 2 ジ）');
    S.attemptAction(st, 0, R.SK.LASER_EYE, { bead: 'boom' }, null);
    return st;
  };
  /* ① 被无效化的一手 */
  const a = mkEye(9101);
  X.setVoid(a, 0, 1);                                  // 模拟"被雷击之枪废掉这一手"
  const act = a.actions[0];
  ok(act && act.outcome === 'ok' && act.voided === true,
    '前提：`setVoid` 只置 `voided`、**不动** `outcome` —— 这正是本 bug 的成因（前提若不成立，本门要重写）');
  X.endTurn(a);
  eq(a.p[0].lastSkill, null, 'R61：被无效化的一手**不得**写进 `lastSkill`');
  a.p[0].boom = 1;                                     // 补一枚爆珠，专门看"连用价"有没有被白送
  const c1 = S.computeCost(a, 0, R.SK.LASER_EYE);
  eq(c1.ep, 1, '被无效化 ⇒ **拿不到连用价**（仍按首次 1 ジ）');
  eq(!!(c1.beads && c1.beads.boom), true, '被无效化 ⇒ 也**不得免掉爆珠**要求');
  /* ② 对照组：没被无效化的一手必须照旧写 —— 否则本门会被"恒 null"的假修法骗过 */
  const b = mkEye(9102);
  X.endTurn(b);
  eq(b.p[0].lastSkill, R.SK.LASER_EYE, '对照组：**没被无效化**的一手照旧写 `lastSkill`（R32 连用仍成立）');
  b.p[0].boom = 1;
  eq(S.computeCost(b, 0, R.SK.LASER_EYE).ep, 2, '对照组：连用价 2 ジ（R32 不得被这次修复一起改掉）');
  /* ③ 边界（**这段能失败**）：**过载炮** R43"被无效化**仍**计入次数"是**另一条用户裁定明文**
   *    （`state.js:190` 出招即计次）⇒ 被无效化之后，下一发必须还是"第 **2** 次"（花光现有多数ジ、且需 ≥1 ジ），
   *    而**不是**退回第 1 次的固定 2 ジ。若有人把 R61 的 `!voided` 顺手套到计次上（"被废就当没出"），
   *    这里会读回 `ep=2 / phase=1` ⇒ 红。（它与环/`lastSkill` 是两条不同的明文，D91 也守着同一件事。） */
  const st3 = S.createState('standard', { next: mulberry32(9103) }, 2);
  st3.p[0].ep = 9;
  eq(S.computeCost(st3, 0, R.SK.CANNON).ep, 2, '前提：过载炮第 1 次固定 2 ジ（`state.js:111`）');
  S.attemptAction(st3, 0, R.SK.CANNON, { target: 1 }, null);
  X.setVoid(st3, 0, 1);
  X.endTurn(st3);
  st3.p[0].ep = 5;
  const c3 = S.computeCost(st3, 0, R.SK.CANNON);
  eq(c3.ep, 5, 'R43：被无效化**仍计入次数** ⇒ 下一发是第 2 次（花光现有ジ = 5），不是第 1 次的 2 ジ');
  eq(c3.cannonPhase, 2, '  且相位必须仍是 2（把 `!voided` 套到计次上会读回相位 1）');
});

t('D92 R56 同层内资源型先结算（用户裁定：过载炮的清除须含目标本回合收入）', function () {
  /* 病（第十一轮复核 §10-4 实测）：同层原先按座位轮换序结算 ⇒ 同一发炮效果差 3 ジ ⇒ 座位红利。
   * 用户 2026-09-18 裁定：资源型（ENERGY 类）先结算。
   * §改（2026-10-21 夜·千问，用户指令「改掉钉文本和函数名的门禁」）：原来三条钉的是 `resolve.js` 的**写法**
   *   （`const ord3 = (function ()` ‖ `return inc.concat(oth);` ‖ `for (const i of ord3) {`）⇒ 换一种等价实现（行为一模一样）
   *   照样红，而"同层先后又变成座位红利"这件真事它并不判。现在跑对局：
   *   ① 目标本回合的收入必须被清除**一起吃掉**（终 ep 落 0）；② 这个结果不许随炮手座位变；
   *   ③ 资源型按**声明**枚举（`cat === CAT.ENERGY`）⇒ 谁把卡名写死成ジ，环/蓄能那两行就会露出来。
   * 牙（实测）：把顺序倒过来（`oth.concat(inc)`）⇒ ジ 的清除从 -6 变 -5、聚能环从 -3 变 -2，**目标终 ep 留下 1** ⇒ ①当场红。 */
  const EN = [];
  for (const k in R.skills) { const s2 = R.skills[k]; if (s2 && s2.cat === R.CAT.ENERGY) EN.push(s2.key); }
  ok(EN.length >= 2, '③ 前置：按声明必须能数出资源型卡（实测 ' + EN.length + ' 枚：' + EN.join(',') + '）⇒ 数出 0 枚说明 cat 改了口径，下面两条是空跑');
  const PRE = 5;
  const shot = function (shooter, victim, ekey, phase3) {
    const st = S.createState('multi', { next: mulberry32(5) }, 3);
    for (const p of st.p) { p.ep = PRE; p.hp = 5; }
    st.p[shooter].cannonCount = phase3 ? 2 : 0;
    X.startTurn(st);
    S.attemptAction(st, shooter, R.SK.CANNON, { target: victim });
    S.attemptAction(st, victim, ekey, {});
    const third = [0, 1, 2].filter(function (i) { return i !== shooter && i !== victim; })[0];
    S.attemptAction(st, third, R.SK.JI, {});
    X.resolveActions(st);
    const clears = st.events.filter(function (e) { return e.reason === '过载炮' && e.pid === victim; });
    return { ep: st.p.map(function (p) { return p.ep; }), cleared: clears.length ? clears[0].delta : null };
  };
  const ARR = [[0, 1], [1, 0], [2, 0]];
  for (const ekey of EN) {
    const keep = [];
    for (const pair of ARR) {
      const r = shot(pair[0], pair[1], ekey, true);
      if (r.ep[pair[1]] !== 0) keep.push('炮手' + pair[0] + '/目标' + pair[1] + ' 终 ep=' + r.ep[pair[1]] + ' 清除=' + r.cleared);
    }
    eq(keep.join(' ‖ '), '', '① ' + ekey + '：目标本回合的收入必须被过载炮第 3 相的清除吃掉（三种座位安排下目标终 ep 都得落 0）—— ' +
      '留下收入 = 同层先后又变成了座位红利（R56 的动因）。实测不合的：' + (keep.join(' ‖ ') || '(无)'));
  }
  /* ② 座位不变性单独判一次：把三种安排的"目标终 ep + 清除量"抄下来比对（不同 = 座位红利回来了） */
  for (const ekey of EN) {
    const sig = ARR.map(function (pair) { const r = shot(pair[0], pair[1], ekey, true); return r.ep[pair[1]] + '/' + r.cleared; });
    eq(new Set(sig).size, 1, '② ' + ekey + '：三种座位安排必须给同一个结果（实测 ' + sig.join(' vs ') + '）⇒ 结果随座位变就是 R56 要防的那个红利');
  }
  /* 正对照：第 1 相的炮**不清除** ⇒ 目标必须留得住收入。这条挂了说明"终 ep=0"是因为整台机器不发 ep，而不是顺序对 */
  const ctl = shot(0, 1, R.SK.JI, false);
  ok(ctl.ep[1] > PRE - 2, '正对照：不清除时目标必须拿到本回合收入（实测 ep=' + ctl.ep.join(',') + ' ‖ 清除=' + ctl.cleared + '）' +
    ' ⇒ 读不出收入说明这套夹具是死的，①② 两条等式都是空枪');
  });
  /* §删（2026-10-08，用户转 Claude 复核 + METHODOLOGY 第 89 条）：这里原来钉的是「文档必须出现 R56」——
   *   那正是第 89 条禁止的**正向**钉法：删掉文档里那行字游戏照常跑，门却会红 ⇒ 门测的是记事本措辞，不是行为。
  /* §删（2026-10-09 DS 空转审计）：正向钉文档措辞（删掉那行字游戏照跑、门却会红）⇒ 违反 METHODOLOGY 第 89 条。¶ 原断言：*   教训仍然保留在 docs/METHODOLOGY.md 与 CHANGELOG 里（记忆归记忆、门归行为）。¶  */

t('D93 R57 天火不需要目标（卡面声明 + 引擎全场 + 文档三条必须一致）', function () {
  /* 用户报的 UI bug：用天火时会弹目标选择 —— 根因是**卡面声明成 `target: 'enemy'`**
   * （UI 与 AI 都从声明推导），而引擎也只在选中的那一个目标上引爆。
   * 权威口径：README「你贴出的符咒引爆」·`RULES-2P:240`「**每个目标**每枚符咒受 1 火伤害」·
   * `RULES-NP:322` 列它进「仅空指」。 */
  /* §改（2026-10-22 千问，用户指令「门禁目标是功能实现而不是判文本」）：原来五条全在钉源码 ——
   *   `mk(SK.FIRESTORM, '天火', CAT.SPECIAL, 2, 3, 'self',` 这串字面量在不在、`'enemy'` 那串不许出现、
   *   `for (let v = 0; v < playerCount(state); v++)` 在不在、`rawDamage(state, v, 1, …)` 那行在不在、
   *   `{ type: R.DMG.FIRE, source: i }` 不许出现 ⇒ **卡面把 cost/名字/顺序挪一个字符它就红，
   *   而"天火又只能打到一个人身上了"这件真事它判不到**（判不到是因为它没打过一局）。
   *   现在摆状态跑一局，直接判 R57 那三句可观测的话：①不需要目标就能出 ②我贴给谁的各按枚数吃到火伤
   *   （**全场遍历**）③伤害事件不许带 `source`（⇒ 不参与大雷连带传导）。
   *   "符咒引爆后仍在""原型制御可挡"那两件事 `tests/spec.js` 的 R36/37 用例已经在判（2 人桌），不在这儿重做。 */
  const mkFire = function (seed) {
    const st = S.createState('multi', { next: mulberry32(seed) }, 3);
    for (const p of st.p) { p.ep = 99; p.hp = 8; }
    st.p[1].stickers.push({ owner: 0, age: 0 });
    st.p[1].stickers.push({ owner: 0, age: 1 });      // 我给 1 号贴了两枚 ⇒ 该吃 2 点
    st.p[2].stickers.push({ owner: 0, age: 0 });      // 给 2 号贴一枚 ⇒ 该吃 1 点
    st.p[0].stickers.push({ owner: 2, age: 0 });      // 别人贴我的 ⇒ 我的天火不许引爆它
    X.startTurn(st);
    return st;
  };
  const st = mkFire(11);
  /* ① 页面的"要不要弹目标选择"读的是**卡面声明的 `target` 字段**（`js/ui/ui.js:676` 的 `def.target === 'self'`
   *   与 `:877` 的 `def.target !== 'self' && opps.length > 1` 是同一条判据）⇒ 这里照那条判据算一遍，
   *   而不是去 grep 源码。实测教训：先版这里只判"不带 target 也出得来"，把卡面改回 `'enemy'` **门照样绿**
   *   （state.js 有兜底目标），所以判据必须落在页面真正消费的那个值上。 */
  const oppsAlive = st.p.filter(function (p, i) { return i !== 0 && p.hp > 0; }).length;
  const wouldPickTarget = function (key) { const d = R.byKey[key]; return !!d && d.target !== 'self' && oppsAlive > 1; };
  const defF = R.byKey[R.SK.FIRESTORM];
  ok(!wouldPickTarget(R.SK.FIRESTORM), '① R57：按页面的判据，天火必须算出**不弹目标选择**（实测声明 target=' +
    JSON.stringify(defF && defF.target) + ' ‖ 存活对手 ' + oppsAlive + ' 个）—— 用户报的 bug 就是弹了选择框');
  ok(wouldPickTarget(R.SK.GUN), '① 正对照：同一把判据必须判出"枪要弹目标"（实测 ' + wouldPickTarget(R.SK.GUN) +
    '）⇒ 判不出说明上面那条是恒真，没有判别力');
  const legal = Play.legalActions(st, 0).filter(function (l) { return l.key === R.SK.FIRESTORM; })[0] || null;
  ok(!!legal, '①b 前置：这一回合天火必须出得来（实测 legal 里' + (legal ? '有' : '**没有**') + '）');
  const av = S.attemptAction(st, 0, R.SK.FIRESTORM, {});          /* 故意**不给** target */
  ok(av && av.outcome === 'ok', '①b 引擎侧：天火不带 target 也必须出得来（实测 ' + JSON.stringify(av) + '）');
  S.attemptAction(st, 1, R.SK.JI, {}); S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  const fire = st.events.filter(function (e) { return e.type === 'damage' && e.via === 'firestorm'; });
  const hurt = {};
  for (const e of fire) { hurt[e.pid == null ? e.to : e.pid] = (hurt[e.pid == null ? e.to : e.pid] || 0) + e.amt; }
  eq((hurt[1] || 0) + '/' + (hurt[2] || 0) + '/' + (hurt[0] || 0), '2/1/0',
    '② R57 全场遍历：我贴 1 号两枚、2 号一枚 ⇒ 只许 1 号吃 2 点、2 号吃 1 点、我自己 0 点' +
    '（实测 ' + (hurt[1] || 0) + '/' + (hurt[2] || 0) + '/' + (hurt[0] || 0) + ' ‖ 全部火焰事件 ' + fire.length + ' 条）');
  eq(fire.filter(function (e) { return e.source != null; }).length, 0,
    '③ R57 的天火伤害不许带 `source` ⇒ 不参与大雷连带传导（用户裁定：无目标伤害没有"出手者"可传）‖ 实测带 source 的 ' +
    fire.filter(function (e) { return e.source != null; }).length + ' 条');
  ok(st.p[1].stickers.length > 0 || st.p[2].stickers.length > 0,
    '④ 前置自证：引爆后符咒**仍在**（在册口径）⇒ 若这里读到 0 枚，说明上面 ② 的火伤是从别的路径来的，等式就不是 R57 的证据');
  });
  /* §删（2026-10-08，用户转 Claude 复核 + METHODOLOGY 第 89 条）：这里原来钉的是「文档必须出现 R57」——
   *   那正是第 89 条禁止的**正向**钉法：删掉文档里那行字游戏照常跑，门却会红 ⇒ 门测的是记事本措辞，不是行为。
  /* §删（2026-10-09 DS 空转审计）：正向钉文档措辞（删掉那行字游戏照跑、门却会红）⇒ 违反 METHODOLOGY 第 89 条。¶ 原断言：*   教训仍然保留在 docs/METHODOLOGY.md 与 CHANGELOG 里（记忆归记忆、门归行为）。¶  */

t('D94 R58 藤甲火弱覆盖当回合（用户裁定：贴上即生效、到下回合结束）', function () {
  /* 旧文 R22「仅在下回合内有效」= 纯预置 debuff；用户 2026-09-18 要求多覆盖一回合。 */
  /* 旧文 R22「仅在下回合内有效」= 纯预置 debuff；用户 2026-09-18 要求多覆盖一回合。
   * v1.7.66 改判（用户 2026-10-16 裁定「藤甲被作废时火弱应该是挂不上的」）：本条原来钉的是 `resolve.js` 里
   *   **那一整行源码字面量**（`if (a.key === SK.ARMOR) { you.fireWeakNext = true; you.fireWeakNow = true; }`）
   *   ⇒ 任何人**合法地**在那一行旁边加一句快照就红，而它声称要判的是「贴上即生效」这个**行为**。
   *   与本文件 :1301-1303 那两处 §删 同族（METHODOLOGY 第 89 条：门只许测行为）⇒ 改成真跑一局判状态。
   * ⚠ 藤甲是 `target` 为 enemy（rules.js:59「贴在对手身上」）⇒ 火弱落在**被贴的那个人**身上，判据也判他。 */
  const st = S.createState('standard', { next: function () { return 0.9; } });
  st.p[0].ep = 9; st.p[1].ep = 9;
  st.events = []; X.startTurn(st);
  S.attemptAction(st, 0, R.SK.ARMOR, null);      // 贴对手
  S.attemptAction(st, 1, R.SK.JI, null);
  X.resolveActions(st);
  ok(!st.p[0].fireWeakNow && !st.p[0].fireWeakNext, '火弱**不在施放者**身上（藤甲是贴对手的）');
  eq(st.p[1].fireWeakNow, true, '贴上**当回合**就生效：被贴的人 Now 必须亮（只挂 Next = 旧的 R22 口径，当回合白贴）');
  eq(st.p[1].fireWeakNext, true, '并且下回合继续：Next 也要亮（R58 覆盖到下回合结束）');
  X.endTurn(st);
  eq(st.p[1].fireWeakNow, false, '回合末清 Now（到期由既有机制完成）');
  eq(st.p[1].fireWeakNext, true, 'Next 要留到下一回合开始被提升为 Now ⇒ 第三回合起失效');
  /* §删（2026-10-16 · v1.7.69 · gate-sentinel 分诊）：这里原有三条**钉文本**的腿 ——
   *   ① `resolve.js` 里不许出现「只挂 Next」那一行**字面量**；② `docs/RULES-2P.md` 必须出现 `R58`；
   *   ③ 旧文「仅在下回合内有效」必须被标注成已被取代。三条都属 METHODOLOGY 第 89 条禁的
   *   「删掉那行字/那句话，游戏照跑、门却会红」⇒ 测的是记事本措辞，不是行为（本文件 :1301-1303 两处 §删 同族）。
   *   ⚠ 上面那三条**行为**断言已经把「只挂 Next」与「挂到施放者」两种错法都咬住了（两种改法实测都红）
   *   ⇒ 这三条一条牙口都没少。 */
  });

t('D95 R59 地雷 3 回合时效（用户裁定，取代 R38「持续直到被触发」）—— 数第几回合卸下，不数代码行', function () {
  /* 旧 R38 = 永久 ⇒ 实测"身上有雷还再敲"占 68%(多)/81%(长)（≈21/50 ジ每局纯浪费）；
   * 严格单回合又把牌打废（引爆 1.90→0.08 次/局）⇒ 用户裁定 3 回合。 */
  /* §改（2026-10-22 千问）：原来 8 条钉的是 `resolve.js`/`state.js` 的行（`function armMine` 存不存在、
   *   `me.mineTurns = 3;` 那行、两个 `case SK.MINE` 都走 armMine、`me.mineArmed = true` 只许出现一次…）。
   *   裁定那句话是**可数的**："本回合 + 后两个回合"⇒ 直接数第几回合卸下，比数代码行既准又不怕改写。
   *   实测（固定 seed 的夹具）：埋雷当回合末 turns=2 → 再 1 回合 turns=1 → 再 1 回合 armed=false + mineExpire
   *   ⇒ 存活正好 3 个回合（含埋雷那一回合）。被打那一路：armed 与 mineTurns **同时**归零。
   *   ⚠ 覆盖边界：原来那条"`mineArmed = true` 只许写一处"防的是**第二个写入点漂移**（R10 那族），
   *   本腿判不到"多写一处"这件事本身，判得到的是**玩家看得见的时效**（第二处若改了时效，这里就红；
   *   若时效一致只多了份重复代码，那是可读性问题，不该由门付账 —— 按 R1 的问法：产品事实是哪一句？）。 */
  const mkMine = function (seed) {
    const st = S.createState('multi', { next: mulberry32(seed) }, 3);
    for (const p of st.p) { p.ep = 99; p.hp = 8; }
    X.startTurn(st);
    return st;
  };
  const stM = mkMine(4242);
  S.attemptAction(stM, 0, R.SK.MINE, {});
  S.attemptAction(stM, 1, R.SK.JI, {}); S.attemptAction(stM, 2, R.SK.JI, {});
  X.resolveActions(stM); X.endTurn(stM);
  ok(stM.p[0].mineArmed === true, '前置：埋雷这一回合结束时必须是"带着雷"的（实测 armed=' + stM.p[0].mineArmed +
    '）⇒ 挂不上说明下面的时效全是在数空气');
  const seq = [{ t: 0, armed: stM.p[0].mineArmed, turns: stM.p[0].mineTurns }];
  for (let t = 1; t <= 4; t++) {
    X.startTurn(stM);
    for (let i = 0; i < 3; i++) S.attemptAction(stM, i, R.SK.JI, {});
    X.resolveActions(stM); X.endTurn(stM);
    seq.push({ t: t, armed: stM.p[0].mineArmed, turns: stM.p[0].mineTurns });
  }
  const goneAt = seq.filter(function (r) { return r.armed === false; })[0];
  eq(goneAt && goneAt.t, 2, '① R59：雷必须在"埋雷回合 + 后两个回合"之后的那一次回合末卸下（实测卸下于埋雷后再第 ' +
    (goneAt ? goneAt.t : 'never') + ' 回合 ‖ 逐回合 ' + seq.map(function (r) { return r.t + ':' + r.armed + '/' + r.turns; }).join(' ') + '）');
  ok(stM.events.some(function (e) { return e.type === 'mineExpire'; }),
    '② 卸下必须留 `mineExpire` 事件（量具与页面都靠它核对时效；实测事件类型 ' +
    Array.from(new Set(stM.events.map(function (e) { return e.type; }))).join(',') + '）');
  /* ③ 触发那一路：被打之后 armed 与计时**同时**清零（原来钉的是两条 case 的文本，这里判可观测的那件事） */
  const stT = mkMine(4243);
  S.attemptAction(stT, 0, R.SK.MINE, {});
  S.attemptAction(stT, 1, R.SK.JI, {}); S.attemptAction(stT, 2, R.SK.JI, {});
  X.resolveActions(stT); X.endTurn(stT);
  X.startTurn(stT);
  S.attemptAction(stT, 1, R.SK.GUN, { target: 0 });
  S.attemptAction(stT, 0, R.SK.JI, {}); S.attemptAction(stT, 2, R.SK.JI, {});
  X.resolveActions(stT);
  ok(stT.p[0].mineArmed === false && stT.p[0].mineTurns === 0,
    '③ 雷被触发后必须**同时**清掉 armed 与计时（实测 armed=' + stT.p[0].mineArmed + ' ‖ mineTurns=' + stT.p[0].mineTurns +
    '）—— 只清一个就是"下一回合凭空又有一颗带计时的雷"那一族');
  ok(stT.events.some(function (e) { return e.type === 'mine'; }), '③ 前置：这一路必须真的触发了雷（实测没有 mine 事件）');
  /* ===== v1.5.143 门禁审计：一条**运行时**断言，替掉原先 9 条"钉 spec 用例标题 / 钉 CHANGELOG 短语"的断言 =====
   * 阳性对照（0921 实测）：把 spec 里 `R59 地雷时效` 改成 `R59 时效X` —— 行为逐字节没变、spec 仍 52/52，
   * 而 np-test 当场红一条 ⇒ 那类断言测的是**字符串**不是**行为**（还会误伤正常的用例改名：
   * 本仓今天就把一条 R61 改成 R62 避让重号）。它想防的"整条用例被静默删除"（v1.5.37 那族事故）
   * 用**跑一遍**来防更准 —— 顺带把 spec 套件的失败也变成 np-test 的阻断（此前两边完全独立、没人连着跑）。 */
  const specRes = (function () {
    /* ===== v1.5.146（去 spawn 化，RESEARCH-LOG §22 NEXT 的收尾）=====
     * 旧实现 spawnSync 跑 tools/spec-run.mjs 拿 stdout。Windows 上 spawn 偶发**空 stdout**
     * （0921 夜班自报 + 0921 审计复现：并发负载下 np-test 五次里红一次 158/159），
     * 两次重试 + "退回源码用例计数"只把假红概率压低、没有归零，还给门塞了第二口径。
     * spec-run 本身就是"vm 沙箱装 5 个文件、读 innerHTML"，同口径在进程内直接做 ⇒
     * **没有子进程就没有抖动**；读不到结果从此是**真红**（加载抛异常 / 用例没全绿 / 条数被人删少），不再降级。 */
    const ssb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
    ssb.window = ssb; ssb.globalThis = ssb;
    let OUT = '';
    ssb.document = {
      getElementById: function () {
        return { set innerHTML(v) { OUT = v; }, get innerHTML() { return OUT; }, textContent: '' };
      },
      createElement: function () { return { style: {}, appendChild() {} }; }
    };
    try {
      for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'tests/spec.js'])
        vm.runInNewContext(readFileSync(f, 'utf8'), ssb, { filename: f });
    } catch (e) { return { err: String((e && e.message) || e), out: OUT }; }
    return { out: OUT };
  })();
  ok(!specRes.err, 'spec 套件必须能在进程内无异常跑完（真实错误：' + (specRes.err || '') + '）');
  const specM = /通过 (\d+) \/ (\d+)/.exec(String(specRes.out));
  ok(!!specM && Number(specM[1]) === Number(specM[2]) && Number(specM[2]) >= 52,
    'spec 引擎用例必须**全绿**且条数 ≥52（实测 ' + (specM ? specM[0] : String(specRes.out).slice(0, 200)) + '）');
  const specFails = [...String(specRes.out).matchAll(/<li class="fail">✘ ([^<]+)/g)].map(function (x) { return x[1]; });
  ok(specFails.length === 0, 'spec 失败用例不许有：' + specFails.slice(0, 3).join(' | '));
  /* 夜班（0922 00:1x）：去 spawn 化当场把潜伏的 1/8 flake 钉出来（R23c 场景用例用裸 Math.random，
   * 爆头判定把 hp=2 打成 1 ⇒ 同一 spec 连跑五次能红一次）。修法是场景用例改判定恒败常量 `noJudge()`
   * （需要判定胜的本来就显式喂 seqRng）；这条防回归钉保证裸随机不再回流场景用例。 */
  ok(readFileSync('tests/spec.js', 'utf8').indexOf('next: Math.random') < 0,
    'tests/spec.js 场景用例不许再用裸 Math.random 当 rng（1/8 抖动会红门禁；判定敏感的用例显式喂 seqRng）');
  /* §删（2026-10-08，用户转 Claude 复核 + METHODOLOGY 第 89 条）：这里原来钉的是「文档必须出现 R59」——
   *   那正是第 89 条禁止的**正向**钉法：删掉文档里那行字游戏照常跑，门却会红 ⇒ 门测的是记事本措辞，不是行为。
  /* §删（2026-10-09 DS 空转审计）：正向钉文档措辞（删掉那行字游戏照跑、门却会红）⇒ 违反 METHODOLOGY 第 89 条。¶ 原断言：*   教训仍然保留在 docs/METHODOLOGY.md 与 CHANGELOG 里（记忆归记忆、门归行为）。¶  */
  /* §删（2026-10-16 · v1.7.69 · gate-sentinel 分诊）：上面那句 2026-10-09 已经摘成 `… < 0 || true` ——
   *   那是个**恒真表达式**（`A || 字符串`），但 `readFileSync('docs/RULES-2P.md')` **还在执行** ⇒
   *   白白让这条门被判成「读 .md 的门」（gate-sentinel ①）。死代码连同那次读一起摘掉，注释留着。 */
  });

t('D96 R60 净化清除"自身全部持续状态"（含增益）—— 正式与镜面两条路径都要清干净', function () {
  /* 用户裁定："藤甲与地雷既然成了 buff，就一并会被净化掉（还有避雷针、符咒、大雷禁用、梦魇）"。
   * 旧实现只清 stickers/nightmare/tauntPending，且**两个 case 各写一遍**（环/地雷同族隐患）。 */
  /* §改（2026-10-22 千问，用户指令「门禁目标是功能实现而不是判文本」）：原来 7 条全在钉 `resolve.js` 的行
   *   （purgeSelf 的定义、五条赋值语句、两个调用点、旧写法不许回来）⇒ 判的是代码长什么样，
   *   而裁定说的是**净化之后这个人身上不该再有持续状态**。现在两条路径各跑一局：
   *   ① 正式路径（自己出净化）‖ ② 镜面复制路径（别人镜面复制我的净化）——
   *   后者正是原来那句结构钉要防的东西：两份实现一漂移，两条路径的残留清单就不一样，跑出来当场红。
   *   ⚠ 覆盖边界（写清不藏）：残留是按下面这张字段表数的 ⇒ 新增的持续状态字段没进表就判不到
   *   （旧的文字钉同样判不到新字段，而且它还判不到漂移）。 */
  const FIELDS = ['fireWeakNow', 'fireWeakNext', 'mineArmed', 'mineTurns', 'rodGuard', 'nightmare', 'tauntPending'];
  const arm = function (p) {
    p.fireWeakNow = true; p.fireWeakNext = true; p.mineArmed = true; p.mineTurns = 3;
    p.rodGuard = 2; p.nightmare = true; p.tauntPending = true; p.cooldown = { anyKey: 1 };
    p.stickers.push({ owner: 2, age: 0 });
  };
  const leftover = function (p) {
    const out = [];
    for (const k of FIELDS) { const v = p[k]; if (v === true || (typeof v === 'number' && v !== 0)) out.push(k + '=' + JSON.stringify(v)); }
    if (p.cooldown && Object.keys(p.cooldown).length) out.push('cooldown=' + Object.keys(p.cooldown).length);
    if (p.stickers && p.stickers.length) out.push('stickers=' + p.stickers.length);
    return out;
  };
  /* ① 正式路径 */
  const stA = S.createState('multi', { next: mulberry32(9001) }, 3);
  for (const p of stA.p) { p.ep = 99; p.hp = 8; }
  X.startTurn(stA);
  arm(stA.p[0]);
  const armedA = leftover(stA.p[0]);
  ok(armedA.length >= FIELDS.length + 2, '① 前置：夹具必须真的把持续状态挂上（实测挂上 ' + armedA.length + ' 条 ‖ ' + armedA.join(' ') +
    '）⇒ 挂不满说明引擎改了字段名，这条门要看的新字段就得同步进 FIELDS');
  S.attemptAction(stA, 0, R.SK.PURIFY, {});
  S.attemptAction(stA, 1, R.SK.JI, {}); S.attemptAction(stA, 2, R.SK.JI, {});
  X.resolveActions(stA);
  eq(leftover(stA.p[0]).join(' '), '', '① R60：自己出净化之后，' + FIELDS.join('/') + ' 加 cooldown/stickers 必须**全部回到默认**' +
    '（实测残留：' + (leftover(stA.p[0]).join(' ') || '(无)') + '）');
  /* ② 镜面复制路径（0 号净化、1 号镜面复制 0 号 ⇒ 1 号也该被清干净） */
  const stB = S.createState('multi', { next: mulberry32(555) }, 3);
  for (const p of stB.p) { p.ep = 99; p.hp = 8; }
  X.startTurn(stB);
  arm(stB.p[0]); arm(stB.p[1]);
  S.attemptAction(stB, 0, R.SK.PURIFY, {});
  S.attemptAction(stB, 1, R.SK.MIRROR, { target: 0 });
  S.attemptAction(stB, 2, R.SK.JI, {});
  X.resolveActions(stB);
  ok(stB.events.some(function (e) { return e.type === 'mirrorCopySelf'; }),
    '② 前置：镜面复制这条路径必须真的触发（实测事件里' + (stB.events.some(function (e) { return e.type === 'mirrorCopySelf'; }) ? '有' : '**没有**') +
    ' mirrorCopySelf）⇒ 没触发就说明下面那条等式压根没走到复制路径');
  eq(leftover(stB.p[1]).join(' '), '', '② 镜面复制路径也必须清全部（实测 1 号残留：' + (leftover(stB.p[1]).join(' ') || '(无)') +
    '）—— 两份实现漂移时红的就是这里（原来靠钉"两个 case 都调 purgeSelf"判，但改写法就红、真漂移却不一定红）');
  ok(leftover(stB.p[0]).length === 0 && leftover(stB.p[1]).length === 0,
    '③ 两条路径必须**同为干净**（0 号残留 ' + (leftover(stB.p[0]).join(' ') || '无') + ' ‖ 1 号残留 ' + (leftover(stB.p[1]).join(' ') || '无') + '）');
  /* §删（2026-10-08 起）：正向钉文档措辞已摘（违反 METHODOLOGY 第 89 条）；教训留在 METHODOLOGY/CHANGELOG。 */
  /* （原来还钉"rules.js 的卡面描述必须写着『清除自身全部持续状态』"那句整话 —— v1.6.12 删除：
   *   那是**措辞在册**，改一次文案就红，而真正防得住的是上面那条"两处各写一遍不得回来"的结构钉。） */
  });

t('D71 蓄能经济门槛：ep<2 不许蓄能（v7 口径），legacy 保持旧口径（用户裁定 v1.5.82）', function () {
  const src = readFileSync('js/train/evo.js', 'utf8');
  const i0 = src.indexOf('function policyChooserN(');
  const i1 = src.indexOf('function pickChampion(');   // 用顶层兄弟函数定界（不能用'下一个 function'：内部有回调）
  const seg = src.slice(i0, i1);
  ok(seg.indexOf('econBase(state, pid, base)') >= 0, 'policyChooserN 必须调用 econBase（单一真源）');
  ok(src.indexOf('function econBase(state, pid, legal)') >= 0, 'econBase 必须存在');
  ok(src.indexOf('return gated.length ? gated : legal;') >= 0, 'econBase 必须在滤空时回退（不改变"必须有招可选"）');
  /* v1.5.143：这一条原本是 `segAll.indexOf('(pp.ep || 0) >= 2') >= 0`（**钉源码字符**）——
   * 门槛变成可调旋钮（`EPIRUS_CHARGE_MIN_EP`，默认仍是 2）之后，钉字符串既挡不住改错方向、
   * 又会误伤合法改动（我加旋钮的当下它就红了）。换成**跑一遍 econBase**：默认口径 + 抬到 3 的口径都验。 */
  const EB = sb.window.EpirusTrainer.econBase, SKc = R.SK.CHARGE;
  const mk = function (ep) {
    const s2 = S.createState('multi', { next: function () { return 0.5; } }, 3);
    s2.p[0].ep = ep;
    const lg = [{ key: SKc, affordable: ep >= 1 }, { key: R.SK.JI, affordable: true }];
    return EB(s2, 0, lg).some(function (l) { return l.key === SKc; });
  };
  ok(mk(1) === false && mk(2) === true, '默认口径：ep=1 不许蓄能、ep=2 许（v1.5.82 裁定，跑出来而不是钉字符串）');
  const T7 = sb.window.EpirusTrainer;
  T7.setChargeMinEp(3);
  const raised = mk(2) === false && mk(3) === true;
  T7.setChargeMinEp(2);          // **必须复位**：沙箱是共享的，漏出去会污染后面每一条门
  ok(raised && mk(2) === true, '门槛可调且能复位：抬到 3 ⇒ ep=2 被摘、ep=3 可蓄，设回 2 后逐字恢复');
  ok(seg.indexOf('candidatesFor(state, pid, v7base') >= 0, 'v7 分支必须用过滤后的 base');
  ok(seg.indexOf('P.choose(state, pid, base,') >= 0, 'legacy 分支必须仍用未过滤的 base（历史基线可比）');
});

t('D117 口径工具（v1.5.151）：防御类必须**从 rules.js 取表**（手写正则漏过"金刚盾"）+ 行为剖面必须能一次报多个装配', function () {
  /* 病（用户 09-22 追问"ε=0 下防御 0% 也不是很对吧"时查出两件事）：
   * ① `tools/log-behavior.mjs`（真机栏）的防御类是**手写正则** `/防御|反弹|八卦阵|原型制御|金钟|镜面/`：
   *    匹配不上真卡名「**金刚盾**」（不是"金钟"）、漏了「无极变速/藤甲/全息屏障」、还列了不存在的「镜面」
   *    ⇒ 真机栏的防御占比长期是**漏数**的结果（修后 23.0% → **24.8%**）。
   * ② **装配是比 ε 更大的口径因素**：同一包同一 ε=0，镜像（5 席同包）电磁炮 **4.30/局**，
   *    真桌（1 冠 + 4 脚本）只有 **0.10/局**（43 倍）⇒ 一个口径点必须同时报**装配**，否则读数会被当成"包的能力"。 */
  const lb = readFileSync('tools/log-behavior.mjs', 'utf8');
  /* v1.5.312：读取实现挪进 `tools/log-reading.mjs`（真机栏与 `log-census.mjs` 共用一份）⇒ 这两枚静态钉跟着挪，
   *   并且**加严**：`log-behavior` 里不许再留自己的手写能力项表。行为级复验在 **D216**（静态钉会被重构架空，光改钉词不算修好）。 */
  const lr = readFileSync('tools/log-reading.mjs', 'utf8');
  ok(lr.indexOf('js/core/rules.js') >= 0 && lr.indexOf('RUL.CAT.DEFENSE') >= 0,
    '防御类必须从规则表取（手写正则漏过真卡名 —— 本仓"同一份名单抄两遍"栽过三次，这是第四个同类隐患）');
  ok(lr.indexOf('取不到防御类卡') >= 0, '取不到必须响（不许静默退化成"数 0 个"）');
  ok(lb.indexOf('./log-reading.mjs') >= 0 && lb.indexOf('const CAP = {') < 0,
    '真机栏必须走那一份读取实现，**不许留自己的手写能力项表**（旧 9 项 `CAP` 漏掉了真机第 3、第 4 名激光剑/聚能环 ⇒ D216 行为级复验）');
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  ok(bp.indexOf('FIELDS') >= 0 && bp.indexOf('for (const fld of FIELDS)') >= 0,
    '行为剖面必须能一次报多个装配（`--field=self,pool`）⇒ 否则"装配口径"永远缺一栏、读数继续被误读');
  ok(bp.indexOf("flag('field', 'mixed')") >= 0, '默认口径不许被改（历史读数靠它可比）');
  /* ⑧ §E279（10-03 夜）：这一栏的分母**随装配换**（`self` 数 5 席、其它只数冠军席）⇒ 差 5 倍，
   *   而 D117 上面那条注释说的"装配差 43 倍"本来就叠在它上面。今晚我差点把 `mixed` 的 0.01/局 读成
   *   "上线档在实机里不存在"（同一枚剂量在 5 席合计那一列是 0.40/局）⇒ 把范围**印进标签**，并钉住它不许掉。 */
  ok(/const scope = fld === 'self' \? '5席合计' : '仅冠军席';/.test(bp),
    '⑧a 行为剖面必须**自己算出计数范围**（`self` ⇒ 5 席合计 ‖ 其它 ⇒ 仅冠军席）⇒ 缺这一句，两列 `/局` 的分母差 5 倍而输出上看不出来');
  ok(bp.indexOf("'[' + fld + '/' + GAMEMODE + '·' + scope + '] '") >= 0,
    '⑧b 范围必须进**打印**（不是只写在注释里）⇒ 读数是抄进文档/交接件的，注释不会跟着走');
  const bpNoScope = bp.replace(/'·' \+ scope \+/, '');
  ok(bp.indexOf("'[' + fld + '/' + GAMEMODE + '·' + scope + '] '") >= 0 && !/GAMEMODE \+ '·' \+ scope/.test(bpNoScope),
    '⑧c 合成正对照：把标签里的范围抹掉之后 ⑧b 那条抽取式必须失配（不失配 ⇒ 它什么都没钉）');
});

t('D142 空净化闸门（v1.5.199 · 用户实机报）必须与引擎 `purgeSelf` 逐字段对账，且「攒哪种珠」必须单一来源', function () {
  /* ===== (a) 净化：与天火空爆（v1.5.139）/ 蓄能 ep<2（v1.5.82）同族的第三个"恒亏动作" =====
   * 用户实盘（`results/band2/*.txt`）里 5 次净化全是「清除 **0** 枚符咒与负面状态」，而同装配下现役包 0 次净化
   * ⇒ 说明这不是"某只包爱用"，而是**菜单从来允许出空转的一张牌**。 */
  ok(typeof T.hasPurgeable === 'function', '判据必须导出（门喂构造态，不钉文本）');
  eq(T.hasPurgeable({}), false, '全空 ⇒ 不可清（这正是"空净化"）');
  eq(T.hasPurgeable(null), false, '席位不存在也不许抛');
  /* 引擎 R60（v1.5.110）`purgeSelf` 清的字段清单 —— 这里逐字段挂上，两边必须同判** */
  const FIELDS = [
    ['stickers', [{ owner: 0, age: 1 }]], ['nightmare', true], ['tauntPending', true],
    ['tauntByPending', [2]], ['fireWeakNow', true], ['fireWeakNext', true],
    ['mineArmed', true], ['mineTurns', 2], ['rodGuard', 1], ['cooldown', { bigT: 1 }]
  ];
  for (const f of FIELDS) {
    const p = {}; p[f[0]] = f[1];
    eq(T.hasPurgeable(p), true, '挂了 ' + f[0] + ' 必须算"有东西可清"（漏一个字段 = 把有用的净化也摘掉）');
  }
  /* ② 与**引擎本身**逐字段对账：只挂这一个状态 ⇒ 出一次净化 ⇒ 判据必须"事前 true / 事后 false"，
   *    且引擎得真把它清掉（清单漂了 —— 比如以后新增一类持续状态 —— 当场红）。 */
  {
    const st0 = S.createState('multi', { next: mulberry32(909) }, 3);
    ok(Play.legalActions(st0, 0).some(function (x) { return x.key === R.SK.PURIFY; }),
      '前置事实：净化在 multi 合法表里（否则下面的对账全是空判）');
  }
  for (const f of FIELDS.concat([['（全空）', null]])) {
    const st = S.createState('multi', { next: mulberry32(909) }, 3);
    X.startTurn(st);
    st.p[0].ep = 9;
    if (f[1] !== null) st.p[0][f[0]] = f[1];
    const before = T.hasPurgeable(st.p[0]);
    eq(before, f[1] !== null, f[0] + '：判据事前判定（挂了才该说有东西可清）');
    S.attemptAction(st, 0, R.SK.PURIFY, {});
    for (let i = 1; i < 3; i++) S.attemptAction(st, i, R.SK.JI, {});
    X.resolveActions(st);
    const acted = st.events.filter(function (e) { return e.type === 'purify'; })[0];
    ok(acted, f[0] + '：净化必须真落地（被合法表/费用挡下 ⇒ 这条对账是假的）');
    eq(T.hasPurgeable(st.p[0]), false, f[0] + '：净化之后判据必须认为"已无可清"（引擎没清干净 = 清单漂了）');
    if (f[1] === null) {
      eq(acted.curses, 0, '空净化在引擎侧的读数必须就是 curses===0（用户看到的那行字）');
      eq(st.p[0].hp, (R.MODES.multi || {}).hp || 3, '空净化不许顺带回血（n-1 规则里 n=0 ⇒ 不该有 heal）');
      ok(!st.events.some(function (e) { return e.type === 'heal' && e.pid === 0; }), '空净化那一手不得产生 heal 事件');
    }
  }
  /* ③ 作用点必须活着：`econBase` 在"干净 + 买得起"时把 PURIFY 摘掉，挂上符咒就必须留着 */
  {
    const st = S.createState('multi', { next: mulberry32(11) }, 3);
    st.p[0].ep = 9;
    const legal = Play.legalActions(st, 0).map(function (x) { return { key: x.key, affordable: true }; });
    ok(legal.some(function (x) { return x.key === R.SK.PURIFY; }), '前置事实：净化本来就在合法表里（否则 ③ 是空判）');
    eq(T.econBase(st, 0, legal).some(function (x) { return x.key === R.SK.PURIFY; }), false,
      '身上干净 ⇒ 菜单里必须没有净化（摘掉，不是"降权"）');
    st.p[0].stickers = [{ owner: 0, age: 1, key: R.SK.CURSE }];
    eq(T.econBase(st, 0, legal).some(function (x) { return x.key === R.SK.PURIFY; }), true,
      '有东西可清 ⇒ 必须还在（不许把好牌一起摘掉）');
  }
  /* ④ 症状级双对照（正反各一）：**强制**每回合尽量出净化，走 `econBase` 后真实对局里"空净化"必须归零；
   *    而绕过 `econBase` 的对照组必须**测得出非零** —— 否则 ④ 只是"它本来就没出"的假绿（seam 2 那一族）。 */
  {
    const runForced = function (useGate, games) {
      let emptyPurify = 0, purify = 0;
      for (let g = 0; g < games; g++) {
        const seed = 5150 + g * 977;
        const ch = [];
        for (let pid = 0; pid < 3; pid++) ch.push(function (s2, p2, lg) {
          /* ⚠️ chooser 只许**返回**动作（下注由 `oneGameN` 去 attempt）—— 自己再 attempt 一次会 double 掉，
           *    第一版我就这么写出了"对照组 0 次净化"的假绿。 */
          const pool = useGate ? T.econBase(s2, p2, lg) : lg;
          const aff = pool.filter(function (x) { return x.affordable; });
          const pu = aff.find(function (x) { return x.key === R.SK.PURIFY; });
          return pu ? { key: R.SK.PURIFY, target: null } : { key: R.SK.JI, target: null };
        });
        const r = T.oneGameN(ch, seed, 3, { mode: 'multi' });
        for (const e of r.state.events) if (e.type === 'purify') { purify++; if (!e.curses) emptyPurify++; }
      }
      return { purify: purify, empty: emptyPurify };
    };
    const noGate = runForced(false, 12);
    ok(noGate.empty > 0, '对照组（绕过闸门）必须测得出空净化，否则整条 ④ 无判别力；实测 ' + JSON.stringify(noGate));
    const gated = runForced(true, 12);
    eq(gated.empty, 0, '走了 `econBase` 之后真实对局里的"清除 0 枚"必须为 0（对照组 ' + noGate.empty + ' 次）');
    ok(gated.purify > 0 || noGate.purify > 0, '至少一边要真出过净化（两边都没出 ⇒ 装配不成立）');
  }
  /* ===== (b) 「这一手蓄能攒哪种珠」：三处各自写过的三元式必须收成一处 =====
   * 事实（读代码得出来，非推断）：冠军策略返回的动作里 `bead` 基本恒为 null ⇒ **珠类型是 UI 层替 AI 决定的**，
   * 原本在 `ui.js` 里有三份同样的 `p.elec > p.boom ? 'boom' : 'elec'`（2P 主循环 / 多人主循环 / 观战循环）
   * ⇒ 漂了就是"你活着时和死后，同一个包打法不同"。这一步**只收拢、不改行为**。 */
  {
    const box = { console: console, Math: Math, JSON: JSON, Object: Object, Array: Array, Number: Number, String: String, Error: Error, isNaN: isNaN };
    box.window = box; box.globalThis = box;
    vm.runInNewContext(readFileSync('js/ui/bead-choice.js', 'utf8'), box, { filename: 'js/ui/bead-choice.js' });
    const BC = box.EpirusBeadChoice;
    ok(BC && typeof BC.prefer === 'function' && typeof BC.of === 'function', '必须导出 EpirusBeadChoice.{prefer,of}');
    eq(BC.prefer({ elec: 1, boom: 0 }), 'boom', '电珠多于爆珠 ⇒ 攒爆珠（原口径）');
    eq(BC.prefer({ elec: 0, boom: 1 }), 'elec', '爆珠多于电珠 ⇒ 攒电珠（原口径）');
    eq(BC.prefer({ elec: 1, boom: 1 }), 'elec', '相等 ⇒ 电珠（原口径，不许改成随机）');
    eq(BC.prefer({}), 'elec', '全新 ⇒ 电珠');
    eq(BC.of({ elec: 2, boom: 0 }, 'boom'), 'boom', '策略自己给了珠型 ⇒ 必须听策略的');
    eq(BC.of({ elec: 2, boom: 0 }, null), 'boom', '策略没给 ⇒ 回落到单一口径（这里 elec>boom ⇒ boom）');
    eq(BC.of({ elec: 0, boom: 0 }, 'nonsense'), 'elec', '非法值 ⇒ 走回落，不许原样透传');
    const html = readFileSync('index.html', 'utf8');
    const iBead = html.indexOf('js/ui/bead-choice.js'), iUI = html.indexOf('js/ui/ui.js');
    ok(iBead >= 0, 'index.html 必须加载 bead-choice.js');
    ok(iBead < iUI, '必须在 ui.js **之前**加载（ui.js 顶层就取 window.EpirusBeadChoice）');
    const ui = readFileSync('js/ui/ui.js', 'utf8');
    /* ===== v1.6.6 改计数（旧文案"三处"）=====
     * 第三个调用点在**被删掉的那条 2 人专属 AI 路径**里（`doPick`/`chooseAI`，随难度阶梯合并一起没了）。
     * 现在页面只有两条出手循环：主循环 `doPickMulti`（2~5 人全走它）‖ 观战循环 `autoRunRest` ⇒ 判据跟着改成"两条都在、且各自都接电"。
     * ⚠ 不是"少接了一处"：这条腿真正的不变量是**每个出手点都走单一来源**，所以改成按函数体数，而不是只看总数
     *   （只看总数会被"两条都在同一个函数里、第三条循环根本没接"这种形状蒙过去）。 */
    const fnBody = function (name) {
      const i = ui.indexOf('function ' + name + '(');
      if (i < 0) return null;
      const j = ui.indexOf('\n  function ', i + 10);
      return ui.slice(i, j < 0 ? ui.length : j);
    };
    const inMain = String(fnBody('doPickMulti') || '').match(/BeadChoice\.of\(/g);
    const inSpect = String(fnBody('autoRunRest') || '').match(/BeadChoice\.of\(/g);
    ok(!!fnBody('doPickMulti') && !!fnBody('autoRunRest'), 'D142 前置：两条出手循环都得在（`doPickMulti` ‖ `autoRunRest`），少一条 = 下面两个计数是空的');
    ok(!!inMain && inMain.length >= 1, '主循环 `doPickMulti` 必须走 `BeadChoice.of`（实测 ' + (inMain ? inMain.length : 0) + ' 处）⇒ 2 人桌现在也走这条，它没接就等于 2 人没有单一口径');
    ok(!!inSpect && inSpect.length >= 1, '观战循环 `autoRunRest` 必须走 `BeadChoice.of`（实测 ' + (inSpect ? inSpect.length : 0) + ' 处）');
    const calls = (ui.match(/BeadChoice\.of\(/g) || []).length;
    eq(calls, 2, '页面里 `BeadChoice.of` 的调用点必须**恰好 2 处**（v1.6.6 起 2 人不再有自己的第三条路）；实测 ' + calls + ' 处' +
      '⇒ 多出来一处 = 有人又写了一条出手循环而没并进来；少一处 = 某条循环改回手抄口径了');
    ok(ui.indexOf('function chooseAI(') < 0, 'D142 附带：旧的 2 人专属 `chooseAI` 不许复活（复活就是第三条出手点，本条上面的 2 处判据会立刻红）');
    ok(!/elec\s*>\s*[\w.\[\]]*\.?boom\s*\?\s*'boom'\s*:\s*'elec'/.test(ui),
      'ui.js 里不许再留内联的 elec>boom 三元式（"同一规则写两遍"的第七例就在这条线上）');
  }
});

}

