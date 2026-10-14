/*#np-part-header
{"file":"tools/gates/engine-fuzz.mjs","part":"engine-fuzz","group":"engine","ranges":[[272,284],[515,538],[2296,2342],[2382,2403],[2720,2749],[2822,2853],[3030,3121],[3171,3193],[5695,5714],[6414,6455]],"gates":[272,515,530,2296,2316,2382,2720,2822,3030,3055,3171,5695,6414],"patched":[]}
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
export const ords = [272, 515, 530, 2296, 2316, 2382, 2720, 2822, 3030, 3055, 3171, 5695, 6414];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('N10c 回合上限：血量最高者胜；并列平局', function () {
  const st = S.createState('multi', { next: mulberry32(15) }, 3);
  st.round = R.MAX_ROUNDS;
  st.p[0].hp = 2; st.p[1].hp = 1.5; st.p[2].hp = 0;
  X.checkOver(st);
  eq(st.winner, 0, '血最高者胜');
  const st2 = S.createState('multi', { next: mulberry32(16) }, 3);
  st2.round = R.MAX_ROUNDS;
  st2.p[0].hp = 2; st2.p[1].hp = 2; st2.p[2].hp = 1;
  X.checkOver(st2);
  eq(st2.winner, 'draw', '并列最高平局');
});

t('fuzz：3/4/5 人随机对局无异常，且必然收敛', function () {
  for (const n of [3, 4, 5]) {
    for (let g = 0; g < 120; g++) {
      const st = S.createState('multi', { next: mulberry32(1000 + g * 31 + n) }, n);
      const ch = [];
      for (let i = 0; i < n; i++) ch.push(randChooser);
      const w = Play.autoGameN(st, ch);
      ok(st.over, '必须结束');
      ok(w === 'draw' || (typeof w === 'number' && w >= 0 && w < n), '合法胜者: ' + w);
      ok(st.round <= R.MAX_ROUNDS, '回合上限内: ' + st.round);
      for (const p of st.p) ok(isFinite(p.hp), 'HP 有限');
    }
  }
});

t('autoGame 2 人入口仍可用（数组/位置参数两种）', function () {
  const st = S.createState('standard', { next: mulberry32(21) }, 2);
  const w1 = Play.autoGame(st, randChooser, randChooser);
  ok(st.over, '位置参数入口收敛');
  const st2 = S.createState('standard', { next: mulberry32(22) }, 2);
  const w2 = Play.autoGame(st2, [randChooser, randChooser]);
  ok(st2.over, '数组入口收敛');
});

t('D2 long mode hp=5 / drainHpMax=2（v1.5.174 用户裁定 3 → 2；0 必须能真关掉）', function () {
  const m = R.MODES.long;
  ok(!!m, 'MODES.long must exist');
  eq(m.hp, 5, 'long.hp'); eq(m.drainHpMax, 2, 'long.drainHpMax');
  eq(S.createState('long', { next: mulberry32(72) }, 5).p[0].hp, 5, 'long initial hp');
  const st = S.createState('long', { next: mulberry32(73) }, 5);
  st.p[0].hp = 2; ok(S.computeCost(st, 0, R.SK.DRAIN).ok, 'long HP=2 usable（新窗口的上沿）');
  st.p[0].hp = 3; ok(!S.computeCost(st, 0, R.SK.DRAIN).ok, 'long HP=3 must be banned（v1.5.174 起窗口是 2，不再是 3）');
  st.p[0].hp = 4; ok(!S.computeCost(st, 0, R.SK.DRAIN).ok, 'long HP=4 must be banned (gate is 2)');
  /* v1.5.174 顺手修的那条语义：`state.js` 原来写 `(mode.drainHpMax) || 1` ⇒ **0 会静默变成 1**，"关掉这张卡"这个选项根本不存在。
   * （我做"永不可用"对照组时被它骗过一次：`drainHpMax:0` 跑出来与 `≤1` 逐位相同才发现。） */
  const keep = m.drainHpMax;
  try {
    m.drainHpMax = 0; st.p[0].hp = 1;
    ok(!S.computeCost(st, 0, R.SK.DRAIN).ok, 'drainHpMax=0 必须真的永不可用（HP1 也不行）');
    m.drainHpMax = 1; st.p[0].hp = 1;
    ok(S.computeCost(st, 0, R.SK.DRAIN).ok, '未设/设 1 仍走 R25 原口径（HP1 可用）');
  } finally { m.drainHpMax = keep; }
});

t('D3 round cap follows the mode (long safety net=140 + sudden death at 100)', function () {
  eq(R.MODES.long.maxRounds, 140, 'long.maxRounds（安全网，不是硬截断）');
  /* v1.5.10：收缩起点改为**全局规则** `R.SUDDEN_DEATH`（用户裁定），模式字段只用于覆盖 ⇒
   * 这里断言"该模式实际生效的阈值"，而不是"模式自带字段"（后者现在可以是 undefined）。 */
  eq(R.MODES.long.suddenDeath != null ? R.MODES.long.suddenDeath : R.SUDDEN_DEATH, 100, 'long 实际生效的收缩起点');
  /* v1.5.65：multi 此前走全局 100 而上限 60 ⇒ **实际永不触发**（"不打"零代价，实测 40/40 平局、回合打满）；
   * 现给它显式阈值（必须落进上限内）。 */
  eq(R.MODES.multi.suddenDeath, 45, 'multi 实际生效的收缩起点');
  ok(R.MODES.multi.suddenDeath < R.MAX_ROUNDS, 'multi 的收缩必须落进回合上限内（否则永不触发）');
  eq(R.MAX_ROUNDS, 60, 'default cap unchanged');
  const mk = function (mode, round) {
    const st = S.createState(mode, { next: mulberry32(74) }, 3);
    st.round = round;
    st.p[0].hp = 3; st.p[1].hp = 2; st.p[2].hp = 1;
    X.checkOver(st);
    return st;
  };
  ok(!mk('long', 60).over, 'long round 60 must not end (60 is only multi cap)');
  ok(!mk('long', 99).over, 'long round 99 must not end');
  /* v1.4.8：100 回合不再是终局（那是收缩起点），终局只看安全网 140。
   * 这条断言就是"硬截断已被移除"的守门人。 */
  ok(!mk('long', 100).over, 'long round 100 must NOT end any more (sudden death onset, not a cap)');
  ok(!mk('long', 139).over, 'long round 139 must not end');
  eq(mk('long', 140).winner, 0, 'long round 140 (safety net) ends, highest hp wins');
  eq(mk('multi', 60).winner, 0, 'multi round 60 ends (unchanged)');
});

t('D6 终局收缩：到 suddenDeath 后每回合末全员 -1（反弹挡不住、不触发地雷）', function () {
  /* v1.4.8：用户方案（100 回合后每轮全员扣 1 血）替代硬截断。
   * 反证：把 resolve.js 里收缩那段的 bypassGuards 去掉，下面"反弹挡不住"必红；
   *       去掉 noMine 则地雷断言必红。 */
  const mk = function (round, hp) {
    const st = S.createState('long', { next: mulberry32(91) }, 3);
    st.round = round;
    for (const p of st.p) { p.hp = hp; p.mineArmed = true; }
    for (let i = 0; i < 3; i++) st.actions[i] = { key: R.SK.REFLECT, target: null };  // 全员挂反弹
    X.endTurn(st);
    return st;
  };
  eq(mk(99, 3).p[0].hp, 3, '未到 suddenDeath 不能扣血');
  const on = mk(100, 3);
  eq(on.p[0].hp, 2, '到 suddenDeath 当回合就扣 1（且反弹挡不住）');
  eq(on.p[1].hp, 2, '全员扣血');
  eq(on.p[2].hp, 2, '全员扣血');
  ok(!on.events.some(function (e) { return e.type === 'mine'; }), '收缩不能触发地雷');
  ok(!on.events.some(function (e) { return e.type === 'reflect'; }), '收缩不能被反弹（bypassGuards）');
  eq(mk(105, 1).p[0].hp, 0, '1 血时被收缩扣死');
});

t('D54 引擎层对称性烟测：同一策略坐满 5 座不得系统性偏座（L7 守卫）', function () {
  /* v1.5.55：本会话修掉四条"确定性身份映射"（槽位并列 / 结算起点相位 / 默认作用者 t1,t2）。
   * 这条是它们的**统计守卫**：固定种子的（近随机）策略坐满 5 座，各座胜场与死亡次数都不得系统性偏差。
   * 修前实测（训练产物）：0 号座每局必死 60/60、其余座 37~46 ⇒ 死亡极差 20~26，本用例会红。 */
  Pol.setRng(T.mulberry32(90210));
  /* v1.5.74：夹具改用**脚本**（同一脚本坐满 5 座）。原用随机权重神经网络，而 F2 两级采样后
   * "条目少的技能（ジ/防御）"拿回份额 ⇒ 随机网络的局面更平（实测只剩 17/120 分出胜负）⇒
   * 这条**引擎层**烟测会被夹具的被动性带偏（它要测的是引擎对称性，不需要神经网络）。 */
  const scripted = T.wrapBotN(Bots.pickAggro);
  const win = [0, 0, 0, 0, 0], dead = [0, 0, 0, 0, 0];
  let dec = 0;
  for (let g = 0; g < 120; g++) {
    const st = S.createState('multi', { next: T.mulberry32(31000 + g) }, 5);
    st.slotSalt = ((g * 2654435761) >>> 0);
    Play.autoGameN(st, [scripted, scripted, scripted, scripted, scripted]);
    for (let i = 0; i < 5; i++) if (st.p[i].hp <= 0) dead[i]++;
    /* v1.5.74：胜负要用**引擎自己的裁定**（v1.5.65 起"全灭按累计伤害判胜"）——
     * 旧的"有人活着且血量唯一最高"口径会把全员阵亡的局全算成平局
     * （脚本对局里几乎每局都全员阵亡 ⇒ 实测只有 12/120 被判"分出胜负"）。 */
    if (st.winner !== 'draw' && st.winner != null) { win[st.winner]++; dec++; }
  }
  const winners = win.filter(function (w) { return w > 0; }).length;
  const wSpread = Math.max.apply(null, win) - Math.min.apply(null, win);
  const dSpread = Math.max.apply(null, dead) - Math.min.apply(null, dead);
  ok(dec >= 20, '必须有足够多分出胜负的局（实测 ' + dec + '/120；未训练策略平局多，阈值放宽）');
  ok(winners >= 4, '5 个座位里至少 4 个必须赢过（否则系统性偏座，win=' + JSON.stringify(win) + '）');
  ok(wSpread <= 18, '各座胜场极差必须小（实测 ' + wSpread + '，win=' + JSON.stringify(win) + '）');
  ok(dSpread <= 22, '各座死亡次数极差必须小（实测 ' + dSpread + '，dead=' + JSON.stringify(dead) + '）');
});

t('D57 multi 的收缩必须落进回合上限内，且"全灭"必须按伤害判胜（否则场 B 上限恒为 0）', function () {
  /* v1.5.65（第五轮复核 §4-2，第四轮就提过；本轮实测坐实）：
   * ① multi 不设 suddenDeath ⇒ 走全局 100，而上限是 60 ⇒ **收缩永不触发** ⇒ "不打"零代价；
   * ② 收缩一旦生效又会**同时**清场（实测 40 局回合恒 47、5/5 阵亡）⇒ 旧"全灭=平局"口径下
   *    "4 席只ジ vs 1 席冠军"是 0 胜 / 40 平 ⇒ 严格胜率上限恒为 0，惩罚攒钱无从谈起。 */
  ok(R.MODES.multi.suddenDeath > 0, 'multi 必须显式设 suddenDeath（否则走全局 100 > 上限 60）');
  ok(R.MODES.multi.suddenDeath < R.MAX_ROUNDS, 'multi 的收缩起点必须 < MAX_ROUNDS（实测修前永不触发）');
  const rj = readFileSync('js/core/resolve.js', 'utf8');
  ok(rj.indexOf('dealtSum') >= 0, '全灭分支必须按累计造成伤害判胜');
  /* 行为断言：4 席只ジ vs 1 席冠军 —— 修前 0/40 分出胜负、回合恒打满；修后必须出现胜者且不撞上限 */
  /* v1.5.163：这里原来钉的是 `passiveFieldAt` 的三条**正向**断言（"第 0 局必须是暴露局"）——
   * 而那条注入自 v1.5.65 起一局没开过火（消费点查 `BOT_PICKS` 不存在的键）。键与分支都已删除，
   * 断言随之**反向**：不许复活。复活一次就要再白跑一臂才看得见，那正是 §N11 的代价。 */
  eq(typeof T.passiveFieldAt, 'undefined', 'passiveFieldAt 必须已随 EPIRUS_PASSIVE_FIELD 一起删除');
  eq(typeof T.setPassiveField, 'undefined', 'setPassiveField 同上');
  ok(readFileSync('js/train/evo.js', 'utf8').indexOf('PASSIVE_EVERY') < 0,
    'evo.js 里不许留下该机制的残留变量（半删状态最坏： setter 还在、作用点没了）');
  Pol.setRng(T.mulberry32(777));
  const pl = Pol.makePolicy(0.25);
  const ji = function () { return { key: R.SK.JI }; };
  let dec = 0, cap = 0;
  for (let g = 0; g < 12; g++) {
    const st = S.createState('multi', { next: T.mulberry32(900 + g) }, 5);
    st.slotSalt = ((g + 1) * 2654435761) >>> 0;
    Play.autoGameN(st, [T.policyChooserN(pl, 0.15), ji, ji, ji, ji]);
    if (st.winner !== 'draw' && st.winner != null) dec++;
    if (st.round >= R.MAX_ROUNDS) cap++;
  }
  ok(dec >= 1, '收缩+伤害判胜之后，"4 席只ジ"场里必须出现分出胜负的局（实测 ' + dec + '/12）');
  eq(cap, 0, '不该再有打满上限的局（实测 ' + cap + '/12）');
});

t('D18 哨声惩罚：熬到回合上限的胜利必须打折（反摆烂）', function () {
  /* v1.5.8：多人局允许"熬到上限比血量"，而考卷看不出"熬"与"打" ⇒ 必须让"熬出来的胜利"不那么值钱。
   * 实测动因（tools/champ-audit.mjs，5 座同一冠军自对局）：long-33 考卷 45.3%、自对局 20/20 局零伤害。 */
  const C = T.rankCredit;
  ok(typeof C === 'function', 'T.rankCredit 必须存在（纯函数，便于钉语义）');
  T.setFightReward({ whistlePen: 0 });                    // 旧行为
  eq(C(1, 1), 1.0, 'whistlePen=0 时头名仍是 1.0（KO 胜）');
  eq(C(1, 3), 1.0, 'whistlePen=0 时哨声局不打折（保持既有路径逐位不变）');
  T.setFightReward({ whistlePen: 0.5 });
  eq(C(1, 1), 1.0, '打出 KO 的胜利必须全额（实测 ' + C(1, 1) + '）');
  ok(Math.abs(C(1, 3) - 0.5) < 1e-9, '还有 3 人活着 ⇒ 哨声局头名只算 0.5（实测 ' + C(1, 3) + '）');
  ok(C(2, 3) < C(2, 1), '哨声局的第二名同样要低于 KO 局的第二名');
  T.setFightReward({ dealW: 0.05 });
  eq(T.fightReward().dealW, 0.05, '出手权重可调（实测 ' + T.fightReward().dealW + '）');
  T.setFightReward({ reset: true });                      // 复位
  eq(T.fightReward().whistlePen, 0, 'reset 后回到 0（默认关）');
  eq(T.fightReward().dealW, 0.01, 'reset 后出手权重回到 0.01');
  /* v1.5.12：**取消**"长程自动 0.5"。实测（lngC vs lngD，6 seed）产出逐字节相同 ⇒ 长程里是空操作
   * （长程局几乎总以淘汰结束 ⇒ 哨兵局≈0%）。惩罚只在多人 3 血有意义，用 env 显式开。 */
  T.setTrainMode('multi'); eq(T.fightReward().whistlePen, 0, 'multi 默认关');
  T.setTrainMode('long'); eq(T.fightReward().whistlePen, 0, 'long 默认也关（v1.5.12 回滚了自动 0.5）');
  T.setFightReward({ whistlePen: 0.5 }); eq(T.fightReward().whistlePen, 0.5, '仍可显式开（env / setFightReward）');
  T.setFightReward({ reset: true }); T.setTrainMode('multi');
});

t('D19 终局收缩是**全局规则**：第 100 回合起每回合末全员 −1 血（不可格挡、不计来源）', function () {
  /* v1.5.10（用户裁定）："把 100 回合之后扣血的机制直接做到正常对战规则里面，反正一般也打不了那么久"。
   * 它原本只挂在 long 模式的 `suddenDeath` 字段上 ⇒ standard/multi 完全没有这条规则。
   * 现在阈值是全局 `R.SUDDEN_DEATH`（模式仍可用自己的字段覆盖，写 0 = 关）。 */
  eq(R.SUDDEN_DEATH, 100, '全局阈值必须是 100');
  const mk = function (round) {
    /* v1.5.65：全局 100 的用例改用 long（它继承全局阈值）；multi 已有自己的 45（下面单独断言）。 */
    const st = S.createState('long', { next: T.mulberry32(7) }, 3);
    st.round = round;
    return st;
  };
  /* ① 第 99 回合：不触发 */
  let st = mk(99);
  const hpA = st.p.map(function (p) { return p.hp; });
  X.endTurn(st);
  eq(st.p[0].hp, hpA[0], '第 99 回合不该触发终局收缩');
  eq(st.p[1].hp, hpA[1], '第 99 回合不该触发终局收缩（所有人）');
  /* v1.5.65 新增：multi 自己的阈值必须生效（44 不触发 / 45 触发） */
  const mkMulti = function (round) { const st2 = S.createState('multi', { next: T.mulberry32(7) }, 3); st2.round = round; return st2; };
  let sm = mkMulti(44);
  const hpM = sm.p.map(function (p) { return p.hp; });
  X.endTurn(sm);
  eq(sm.p[0].hp, hpM[0], 'multi 第 44 回合不该触发收缩（阈值 45）');
  sm = mkMulti(45);
  const hpM2 = sm.p.map(function (p) { return p.hp; });
  X.endTurn(sm);
  eq(sm.p[0].hp, hpM2[0] - 1, 'multi 第 45 回合必须全员 −1（这是"不打"不再免费的规则基础）');
  /* ② 第 100 回合：全员 −1 */
  st = mk(100);
  const hpB = st.p.map(function (p) { return p.hp; });
  X.endTurn(st);
  const hpN = st.p.map(function (p) { return p.hp; });
  ok(hpN.every(function (h, i) { return h === hpB[i] - 1; }), '第 100 回合必须全员 −1（实测 ' + hpN.join('/') + '，原 ' + hpB.join('/') + '）');
  /* ③ 有防御架势也照掉（这是"场地收缩"，不是攻击） */
  st = mk(100);
  S.attemptAction(st, 0, R.SK.GUARD, {});
  const hpC = st.p[0].hp;
  X.resolveActions(st);
  X.endTurn(st);
  eq(st.p[0].hp, hpC - 1, '有防御架势也必须掉 1 血（不可格挡）');
  /* ④ 事件可追溯：reason=终局收缩，且不记任何人战功 */
  const evs = st.events.filter(function (e) { return e.type === 'damage' && e.reason === '终局收缩'; });
  ok(evs.length >= 1, '必须有 reason=终局收缩 的伤害事件（实测 ' + evs.length + ' 条）');
  ok(evs.every(function (e) { return e.source === undefined || e.source === null; }),
    '终局收缩的伤害不得有来源（否则会记成某个人的战功）');
  /* ⑤ 模式仍可覆盖（写 0 = 关掉） */
  const st5 = S.createState('multi', { next: T.mulberry32(7) }, 3);
  st5.round = 100;
  const realMode = st5.mode;
  st5.mode = { hp: realMode.hp, minPlayers: 3, maxPlayers: 5, suddenDeath: 0, maxRounds: realMode.maxRounds };
  const hpD = st5.p[0].hp;
  X.endTurn(st5);
  eq(st5.p[0].hp, hpD, '模式把 suddenDeath 写成 0 时必须真的关掉（可覆盖）');
  /* ⑥ v1.5.11：**起扣回合与每回合扣血量都可调**（页面入口经 createState 的 opts 传入）
   *    —— 且必须是浅拷贝，不能污染全局共享的 MODES 对象（否则会串到之后所有对局） */
  const st6 = S.createState('multi', { next: T.mulberry32(7) }, 3, { suddenDeath: 5, suddenDeathDmg: 2 });
  st6.round = 5;
  const hpE = st6.p[0].hp;
  X.endTurn(st6);
  eq(st6.p[0].hp, hpE - 2, 'suddenDeathDmg=2 时每回合必须扣 2 血（实测 ' + st6.p[0].hp + ' vs ' + hpE + '）');
  eq(st6.mode.suddenDeath, 5, 'createState 的 opts 必须能覆盖起扣回合');
  /* v1.5.65：multi 现在**自己**有 suddenDeath=45（见 D3）⇒ 这里改成断言"全局值保持模式自身的 45"，
   * 而上面那次 opts 覆盖是 5 ⇒ 若发生污染，这里就会变成 5（污染检查的效力不变）。 */
  eq(R.MODES.multi.suddenDeath, 45, 'opts 覆盖不得污染全局 MODES（全局仍是模式自身的 45）');
  eq(R.SUDDEN_DEATH_DMG, 1, '全局默认每回合扣 1 血');
});

t('D21 先手激励（v1.5.14 选项 A）：默认关，且"首伤方"的判定只看带 source 的伤害', function () {
  /* 动机（REVIEW §12）：多人局三张架势牌费用为 0 ⇒ 互戒均衡；`deal` 只有 0.01、`proact` 是相对
   * 全场均值的（全场 0 伤害时恒 0）⇒ 对称局面下没有梯度先出手。**首伤奖励是区分名次的项**
   * （每局只有一个席位拿到），这是它可能有效的关键；而统一加在所有人身上的项（如哨声惩罚）无效。 */
  eq(T.fightReward().firstW, 0, '默认必须关（不猜默认值，先用对照臂证明）');
  eq(T.fightReward().dealW, 0.01, 'deal 默认仍是 0.01');
  T.setFightReward({ firstW: 0.08, dealW: 0.05 });
  eq(T.fightReward().firstW, 0.08, '可显式打开先手奖励');
  eq(T.fightReward().dealW, 0.05, '可显式抬高出手权重');
  const F = T.firstBloodSeat;
  ok(typeof F === 'function', 'T.firstBloodSeat 必须存在（纯函数，便于钉语义）');
  eq(F([]), null, '没有事件 ⇒ 无先手');
  eq(F([{ type: 'ep', pid: 1, delta: 1 }]), null, '只有攒钱事件 ⇒ 无先手');
  /* 关键：终局收缩是 source:null 的场地伤害，不能算任何人的先手 */
  eq(F([{ type: 'damage', to: 3, amt: 1, reason: '终局收缩', source: null }]), null, '终局收缩不算先手');
  /* 有人真的打中了 ⇒ 那才是先手；后续伤害不改变"第一" */
  eq(F([{ type: 'damage', to: 2, amt: 1, reason: '枪', source: 4 },
        { type: 'damage', to: 1, amt: 2, reason: '激光剑', source: 0 }]), 4, '第一个造成伤害的席位才算先手');
  T.setFightReward({ reset: true });
  eq(T.fightReward().firstW, 0, 'reset 回到关');
  eq(T.fightReward().dealW, 0.01, 'reset 回到 0.01');
});

t('D98 "终局收缩"的哨兵必须是它自己的标记（不许再用 source==null —— 地雷/天火按规则就是无来源）', function () {
  /* 病：`场B 清场` 的判据用 `damage.source == null` 当"收缩开始"的哨兵，可是
   * **地雷伤害按规则就是无来源**（N20 第 6 条）· **天火被用户裁定为无目标伤害**（R57，也是 null）
   * ⇒ 收缩前第一颗雷/第一发天火会被误判成收缩开始 ⇒ **场B 清场被系统性少读**。 */
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf("if (e.reason === '终局收缩') shrinkStarted = true;") >= 0,
    '量具必须用 `reason === \'终局收缩\'` 当哨兵');
  ok(al.indexOf('if (e.source == null) shrinkStarted = true;') < 0,
    '旧的 `source == null` 哨兵**不得**回来');
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(ev.indexOf("if (e.reason === '终局收缩') shrink = true;") >= 0,
    '训练侧 `countClears`（清场奖励）必须与门禁**同口径**（否则奖励与判据量的是两件事）');
  ok(ev.indexOf('if (e.source == null) shrink = true;') < 0, '训练侧旧哨兵不得回来');
  /* 反向证据：引擎里收缩伤害确实带这个 reason，且地雷/天火确实无来源。 */
  const rs = readFileSync('js/core/resolve.js', 'utf8');
  ok(rs.indexOf("reason: '终局收缩'") >= 0, '引擎的收缩伤害必须带 `reason: \'终局收缩\'`（哨兵的真源）');
  ok(rs.indexOf("地雷伤害无来源") >= 0 || rs.indexOf('noMine: true') >= 0,
    '地雷的无来源是有明文规则依据的（N20 第 6 条）—— 这正是旧哨兵会误判的原因');
});

t('D126 R48「回魂复活回合」只免**花费**、不免**条件**（v1.5.166 · 用户报的摄魂 bug 追到的三处短路）', function () {
  /* 规则原文（docs/RULES-2P.md:336）：「下回合开始你以 1HP 复活，本回合内拥有无限各类能量
   * （**一切花费为 0**，含蓄能产物无限 ⚠️ R48）」。"花费为 0" ≠ "条件作废"。
   * 旧实现在三处整体短路：`state.js:computeCost` 开头就 return ok、`state.js:attemptAction` 干脆不走 computeCost、
   * `play.js:legalActions` 直接 push affordable ⇒ 满血也能摄魂、电磁炮免备珠、过载炮免血债。
   * 行为变化范围（配对复现 6480 局，新旧引擎同种子）：只有 13 局触发过回魂、4 局读数不同、**胜者全部相同**
   * ⇒ 这条不是"能赢多少"的改动，是"规则说的是什么"的改动。 */
  const mkLong = function () { const s = S.createState('long', { next: T.mulberry32(4242) }, 5); return s; };
  /* ① 满血 + 免费回合：三个条件门都不许被绕过 */
  let st = mkLong();
  Object.assign(st.p[0], { hp: 5, ep: 0, infiniteEnergy: true, elec: 0, boom: 0 });
  eq(S.computeCost(st, 0, R.SK.DRAIN).ok, false, '满血（hp=5 > long 的 ≤3）⇒ 摄魂必须仍判非法（这是用户报的那一格）');
  eq(S.computeCost(st, 0, R.SK.RAILGUN).ok, false, '无电珠 ⇒ 电磁炮必须仍判非法（"含珠无限"是免花费，不是凭空给珠）');
  eq(S.computeCost(st, 0, R.SK.LASER_EYE).ok, false, '首次激光眼无爆珠 ⇒ 必须仍判非法');
  const legal = Play.legalActions(st, 0).map(function (l) { return l.key; });
  ok(legal.indexOf(R.SK.DRAIN) < 0, '合法表里不许出现摄魂（页面按钮因此不可点、AI 因此看不见它）');
  ok(legal.indexOf(R.SK.RAILGUN) < 0, '合法表里不许出现免珠的电磁炮');
  /* ② 真在窗口内（复活后 hp=1）⇒ 可用，且**花费**归零 */
  st = mkLong(); Object.assign(st.p[0], { hp: 1, ep: 0, infiniteEnergy: true });
  const c2 = S.computeCost(st, 0, R.SK.DRAIN);
  eq(c2.ok, true, 'hp=1 ≤3 ⇒ 免费回合摄魂应合法'); eq(c2.ep, 0, '免费回合 ep 必须归零');
  S.attemptAction(st, 0, R.SK.DRAIN, { target: 1 }, null);
  eq(st.p[0].ep, 0, '执行后不扣ジ'); eq(st.p[0].hp, 1, '执行后不掉血（血债属花费）');
  /* ③ 免费回合的过载炮：第 2 次不要求 ≥1ジ、第 3 次不自损 1 血 */
  st = mkLong(); Object.assign(st.p[0], { hp: 4, ep: 0, infiniteEnergy: true, cannonCount: 1 });
  eq(S.computeCost(st, 0, R.SK.CANNON).ok, true, '过载炮第 2 次在免费回合不该被"需至少 1ジ"挡住');
  st.p[0].cannonCount = 2;
  S.attemptAction(st, 0, R.SK.CANNON, null, null);
  eq(st.p[0].hp, 4, '过载炮第 3 次的自损 1 血是**花费** ⇒ 免费回合不该扣（R42 × R48）');
  /* ④ 非免费回合回归：旧口径一字不变 */
  st = mkLong(); Object.assign(st.p[0], { hp: 5, ep: 0, elec: 0, boom: 0 });
  eq(S.computeCost(st, 0, R.SK.RAILGUN).ok, false, '普通回合电磁炮照旧需要电珠');
  eq(S.computeCost(st, 0, R.SK.DRAIN).ok, false, '普通回合摄魂照旧看 HP 窗口');
  eq(S.attemptAction(st, 0, R.SK.SNIPE, { target: 1 }, null).outcome, 'insufficient', '普通回合 ep 不足 ⇒ 照旧 insufficient（不是 ok）');
  /* ⑤ 反抄：三处短路都不许复活 */
  ok(readFileSync('js/core/state.js', 'utf8').indexOf('if (p.infiniteEnergy) return { ok: true') < 0, 'computeCost 不许再整体短路');
  ok(readFileSync('js/core/play.js', 'utf8').indexOf('if (p.infiniteEnergy) { out.push') < 0, 'legalActions 不许再整体短路');
  const sj = readFileSync('js/core/state.js', 'utf8');
  ok(sj.indexOf('if (p.infiniteEnergy) {') < 0 || sj.indexOf('const cost = computeCost') < sj.indexOf('if (p.infiniteEnergy) {'),
    'attemptAction 必须先过 computeCost（条件）再谈免费');
});

}

