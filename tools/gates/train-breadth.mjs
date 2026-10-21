/*#np-part-header
{"file":"tools/gates/train-breadth.mjs","part":"train-breadth","group":"train","ranges":[[6456,6567],[6598,6651],[8498,8541]],"gates":[6456,6526,6598,8498],"patched":[]}
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
  packMetaOf, packMetaFrom, packWeightsOf, packWeightsFrom,
  spawnBatch, batchCap, RGAIN, OPP_SPECS, ECON_REWARD_KEYS, readEconEnv,
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
export const ords = [6456, 6526, 6598, 8498];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D127 兑现广度（v1.5.167 · §N24 · 用户"G_eff 像刷分"）：mirrorHealth 出 effSkillsLand + 同分带内按落地取大者（默认关 ⇒ 逐位不变）', function () {
  /* 为什么需要第二把尺：`effSkills` 数的是**发起**几种（`keyCount` 的熵）⇒ 一张常出手常被防的卡与
   * 一张少见但每次掉血的卡等价。实测（`tools/probe-cast-vs-land.mjs`）现役包出手:落地 = 530:237，
   * G=4.44 而真打上血的只有 3~4 种 ⇒ 用户那句"像是为了刷 eff 只用最容易被测到的技能"成立。
   * ⚠️ 它**只许当选面当排序键**，不许进 fit：仓里已证"奖励贵技能落地"会选出乱挥双枪的冠军（−27pt）。 */
  const mh = T.mirrorHealth(sb.window.EPIRUS_CHAMPION_3P ? sb.window.EpirusPolicy.unpack(sb.window.EPIRUS_CHAMPION_3P, true) : null, 6, 3, 'multi');
  ok(mh && typeof mh.effSkillsLand === 'number', 'mirrorHealth 必须同时给 G(出手) 与 G(落地)');
  ok(mh.effSkillsLand >= 0 && Number.isInteger(mh.landedKeys), 'landedKeys 必须是整数种（来自 landByKey，不另数一遍）');
  /* ⚠️ 口径钉（发布前自查发现的缺陷）：`damage.via` 有两类取值**不是一张卡**——`终局收缩`（`deliverDamage` 在 `via`
   * 缺省时回落成中文 reason，`resolve.js:305`）与 `headshot`（爆头 = 结果修饰）。它们能占"落地"计数的 35%（实测 band4 那粒
   * 293 次落地里 104 次是收缩）⇒ 不滤就会**奖励"拖到收缩阶段活着"的包**、惩罚主动进攻的包，L1 臂的"改判"whole 是这个 bug 的产物。
   * 本断言在**已知会出非卡名 via** 的读数上独立复算熵，不许只比个大小。 */
  const mh20 = T.mirrorHealth(sb.window.EPIRUS_CHAMPION_3P ? Pol.unpack(sb.window.EPIRUS_CHAMPION_3P, true) : null, 20, 5, 'multi');
  const lbk = mh20.landByKey || {};
  const nonCard = Object.keys(lbk).filter(function (k) { return !R.byKey[k]; });
  ok(nonCard.length > 0, '这份读数里必须真的出现非卡名 via（终局收缩/headshot），否则本断言是空枪');
  {
    const ck = Object.keys(lbk).filter(function (k) { return lbk[k] > 0 && R.byKey[k]; });
    const ct = ck.reduce(function (a, k) { return a + lbk[k]; }, 0);
    let he = 0; for (const k of ck) { const pr = lbk[k] / ct; he -= pr * Math.log(pr); }
    eq(mh20.landedTotal, ct, 'landedTotal 必须只加真卡名（非卡名 via 一次都不许进）');
    eq(Math.round(Math.exp(he) * 1e9) / 1e9, Math.round(mh20.effSkillsLand * 1e9) / 1e9, 'effSkillsLand 必须 = 只数真卡名的那套熵（独立复算）');
    ok(mh20.landedKeys === ck.length && ck.length < Object.keys(lbk).length, 'landedKeys 要比 landByKey 的键数小（滤是真动作，不是恒等）');
    eq(mh20.landedFiltered, Object.keys(lbk).reduce(function (a, k) { return a + (R.byKey[k] ? 0 : lbk[k]); }, 0),
      'landedFiltered 必须等于被滤掉的量（尺子要自证"我少算了多少"，不许悄悄丢数）');
  }
  /* ① 纯函数：带外永不参与 / 带内按落地取大 / 缺 landG 记 0 / tieBrokenBy 说真话 */
  const E = function (score, landG) { return { score: score, landG: landG }; };
  let r = bandPickByLand([E(1.00, 2), E(0.99, 5), E(0.90, 9)], 0.03);
  eq(r.best.score, 0.99, '带内（0.99 与 1.00）必须按落地取大者 ⇒ 选 0.99/land5');
  eq(r.tieBrokenBy, 'land', '改了判就得说"是广度改的"');
  r = bandPickByLand([E(1.00, 2), E(0.90, 99)], 0.03);
  eq(r.best.score, 1.00, '带外的"超广"候选永不参与（广度不许救一个胜率更差的包）');
  eq(r.dropped, 1, '带外者要计数（不能静默消失）');
  r = bandPickByLand([E(1.00, 2), E(0.99)], 0.03);
  eq(r.best.score, 1.00, '缺 landG 记 0（不是当它无限好）—— 未测 = 不占便宜');
  r = bandPickByLand([E(1.00, 4), E(0.99, 4)], 0.03);
  eq(r.tieBrokenBy, 'score', '落地相同则回到胜率，不许拿并列当理由乱换');
  eq(bandPickByLand([], 0.03).best, null, '空表 ⇒ best=null（调用方须自己响）');
  /* ② 接线：默认关逐位不变（与 D123③ 同一基线哈希）；开 ⇒ 必须真打印两把尺并说改没改判 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf("EPIRUS_SEL_LAND || 0") >= 0, 'EPIRUS_SEL_LAND 必须默认 0');
  ok(t3.indexOf('bandPickByLand(') >= 0 && t3.indexOf('sel.best = lp.best') >= 0, 'train-3p 当选面必须真用它（接了不看结果 = 死作用点）');
  const wh = function (p2) {
    const m = /"a":\[([^\]]*)\]/.exec(readFileSync(p2, 'utf8'));
    return m ? createHash('sha1').update(m[1]).digest('hex').slice(0, 10) : 'NOPARSE';
  };
  /* v1.5.168：预筛也必须被记账 —— L1b 实测：`gateOk` 预筛换掉了池（6 剔 4），排序键自己没换人，
   *  当时只报"未改判" ⇒ 读表的人会以为这臂与不开开关逐字相同。三条分支缺一不可。 */
  r = bandPickByLand([{ score: 1.00, landG: 2, gateOk: true }, { score: 0.99, landG: 9, gateOk: false }], 0.03);
  eq(r.skipped, 1, '过不了不可 --force 硬门槛的候选必须先被剔出池（兑现广度不许把病包换上来）');
  eq(r.best.score, 1.00, '被剔的"超广"病包不许赢');
  r = bandPickByLand([{ score: 1.00, landG: 2 }, { score: 0.99, landG: 9 }], 0.03);
  eq(r.skipped || 0, 0, '未提供 gateOk（旧调用点）⇒ 视为通过，行为与 v1.5.167 一致');
  const dirA = mkdtempSync(join(tmpdir(), 'd127a-')), dirB = mkdtempSync(join(tmpdir(), 'd127b-'));
  const off = spawnNC(['tools/train-3p.mjs', '3', '3', '6', '4'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd127off', EPIRUS_SUPPORT_PRIOR: '0', EPIRUS_BAND_DIR: dirA, EPIRUS_T3P_OUT: join(dirA, 'd127off.js') }), encoding: 'utf8', timeout: 300000 });
  eq(off.status, 0, '默认关必须跑通');
  eq(wh(join(dirA, 'd127off.js')), CLI_ARM_BASELINE, '默认关的产物必须仍是那条基线（动了它 = 所有 CLI 臂的当选规则被偷改）');
  const on = spawnNC(['tools/train-3p.mjs', '3', '3', '6', '4'],
    /* §E654：这条臂原先**只改了 BAND_DIR 没改落点** ⇒ 它把 D123/D162 逐字比对的基线覆盖掉了
     *   （运行时台账抓到：`d127on` 于 14:50:38 与 06:50 那轮各写一次 `docs/artifacts/train-3p-out.js`，
     *   同一趟 D162 就报 `got≠want`）。孪生的 off 臂一直有 `EPIRUS_T3P_OUT`（上一行），on 臂是漏的那一条。 */
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd127on', EPIRUS_SEL_LAND: '1', EPIRUS_SUPPORT_PRIOR: '0', EPIRUS_BAND_DIR: dirB, EPIRUS_T3P_OUT: join(dirB, 'd127on.js') }), encoding: 'utf8', timeout: 300000 });
  eq(on.status, 0, '开开关也要跑通');
  ok(/\[兑现广度\].*G\(出手→落地\)/.test(String(on.stdout || '')), '开了必须印出每候选的两把尺（不印 = 又一根暗旋钮）');
  ok(/改判（排序键换人）|改判（是预筛选掉的|未改判/.test(String(on.stdout || '')),
    '必须三分归因：排序键换人 / 预筛换池 / 都没换 —— 只报"未改判"会让人误以为与不开开关逐字相同');
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
});

t('D128 广度准入线（v1.5.170 · §N29 · §N28"四粒冠军三粒塌成一种卡"）：塌缩当**不合格**，不当排序键（默认关 ⇒ 逐位不变）', function () {
  /* 为什么是"线"不是"键"：§N25 实测排序键要么咬不动（同分带只剩 1 粒）要么咬错（换上来过不了硬门槛的包）；
   * 而 §N28 两对种子 4 粒冠军里 3 粒净兑现只剩 `1.00（1 种）` ⇒ 塌缩是常态，需要准入线。 */
  const E = function (score, landG, landedKeys) { return { ref: { params: 'p' + score }, score: score, landG: landG, landedKeys: landedKeys }; };
  let r = rejectNarrowWinners([E(1.00, 2.66, 3), E(0.99, 1.00, 1)], 1.5);
  eq(r.dropped, 1, '塌缩粒（landedKeys=1）必须被剔');
  eq(r.best.score, 1.00, '留下的必须是过线的那粒');
  r = rejectNarrowWinners([E(1.00, 9.00, 1), E(0.50, 1.60, 2)], 1.5);
  eq(r.best.score, 0.50, 'G 再高但只有 1 种卡 ⇒ 仍然不合格（**"塌缩的定义"不许被大数绕过**）');
  r = rejectNarrowWinners([E(1.00, 1.49, 3), E(0.98, 1.50, 2)], 1.5);
  eq(r.dropped, 1, '线是 `>=`：1.49 不过、1.50 过');
  r = rejectNarrowWinners([E(1.00, undefined, undefined), E(0.90, 2.0, 3)], 1.5);
  eq(r.dropped, 1, '未测（缺 landG/landedKeys）= 不合格（与 vetoBy3p"看不见就当不过"同规矩）');
  r = rejectNarrowWinners([E(1.00, 1.0, 1), E(0.90, 1.2, 1)], 1.5);
  eq(r.allRejected, true, '全塌缩 ⇒ allRejected=true，调用方必须响亮（不许静默退回"不过滤"）');
  eq(r.best, null, 'allRejected 时没有 best');
  eq(rejectNarrowWinners([E(1.00, 1.6, 2), E(0.90, 2.5, 3)]).floor, 1.5, '默认线 1.5（标定见函数头注：现役 2.66 / 2P 槽 2.98 / 塌缩 1.00~1.24）');
  /* 接线：默认 0 ⇒ 逐位不变；开了 ⇒ **产物自己必须满足这条线**（判效果，不判横幅） */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf("EPIRUS_BREADTH_FLOOR || 0") >= 0, 'EPIRUS_BREADTH_FLOOR 必须默认 0');
  ok(t3.indexOf('rejectNarrowWinners(') >= 0 && t3.indexOf('sel.best = nf.best') >= 0, 'train-3p 当选面必须真用它（接了不看结果 = 死作用点）');
  ok(t3.indexOf("'EPIRUS_BREADTH_FLOOR'") >= 0, '必须进 SELF_ENV_KEYS（否则黑键侦测会把它当"传了没人读"）');
  const dir = mkdtempSync(join(tmpdir(), 'd128-'));
  const run = spawnSync(process.execPath, ['tools/train-3p.mjs', '3', '3', '6', '4'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd128floor', EPIRUS_BREADTH_FLOOR: '1.5', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: join(dir, 'd128floor.js') }), encoding: 'utf8', timeout: 300000 });
  eq(run.status, 0, '开了线也要跑通');
  ok(/\[广度线\] 判据 = 净 `G\(落地\)/.test(String(run.stdout || '')), '开了必须印出判据与每粒的净兑现（不印 = 又一根暗旋钮）');
  const mt = packMetaOf(join(dir, 'd128floor.js'));
  ok(!!mt, '产物 meta 必须能解析（配方自证的前提）');
  ok(mt.recipe && Number(mt.recipe.breadthFloor && mt.recipe.breadthFloor.floor) === 1.5, 'meta.recipe.breadthFloor 必须记下这臂的线');
  if (mt.breadthFloorAllNarrow) {
    ok(/⛔ \[广度线\] 名人堂\*\*全部塌缩\*\*/.test(String(run.stderr || '') + String(run.stdout || '')),
      '全塌缩必须响亮（并指向"走向②：该改奖励面"）');
  } else {
    ok(Number(mt.recipe.breadthFloor.winnerKeys) >= 2 && Number(mt.recipe.breadthFloor.winnerLandG) >= 1.5,
      '当选者必须真满足这条线（判产物，不判打印）：实测 winnerKeys=' + mt.recipe.breadthFloor.winnerKeys +
      ' winnerLandG=' + mt.recipe.breadthFloor.winnerLandG);
  }
});

t('D130 判据原型必须能放上**训练桌**（v1.5.172 · §N35 · `v7xn22a` 被"只防御不还手"85% 击败）：`EPIRUS_COUNTER_OPPS` 默认关 + 缺对手必须响', function () {
  /* 病（实测）：`promote --dry` 把大配方臂砍在 G4/G5 上，最克的两个原型是「只防御(不还手)」「只枪 1ジ压制」——
   * 而 `train-3p` 的 `OPPS` 九个里最接近的 `defend` 是**会还手**的防御，纯不还手的 `guardSpam` 在 `EpirusBots` 里早就有却没人拿它当对手。
   * ⇒ "判它的对手从不出现，适应力学不出来"。修法与 v1.5.150 的 `EPIRUS_XN2REF=exam` 同一条：**对着产品判据本身训**。 */
  ok(Bots && typeof Bots.pickGuardSpam === 'function' && typeof Bots.pickGunSpam === 'function' && typeof Bots.pickSnipeSpam === 'function',
    '三个判据原型必须真在 `EpirusBots` 里（不在就是 train-3p 引用了不存在的名字）');
  /* ① 行为：`guardSpam` 必须**只防不还手**——它值钱就正是因为它"没有攻击性"（把它改成会还手 = 把量具改没了） */
  const stG = S.createState('multi', { next: mulberry32(3) }, 5);
  stG.p[0].ep = 9;
  const lgG = Play.legalActions(stG, 0).filter(function (x) { return x.affordable; });
  const gk = lgG.find(function (x) { return x.key === R.SK.GUARD; });
  ok(!!gk, '构造态必须让防御卡合法（否则本断言空转）');
  eq(Bots.pickGuardSpam(stG, 0, lgG), R.SK.GUARD, '防御在手 ⇒ 必须出防御');
  const atk = lgG.filter(function (x) { return x.key !== R.SK.GUARD && x.key !== R.SK.JI; }).map(function (x) { return x.key; });
  ok(atk.length > 0, '构造态里必须**有**可出的攻击卡（否则"不还手"是白测）');
  const noRet = atk.every(function (k) { return Bots.pickGuardSpam(stG, 0, lgG) !== k; });
  ok(noRet, '手里有攻击卡也不许出 ⇒ 这才叫"不还手"原型');
  /* ② 接线：默认关 ⇒ `OPPS` 逐字不变；开了 ⇒ 进桌且**产物自证** */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/EPIRUS_COUNTER_OPPS \|\| ''/.test(t3), '默认必须是**空 ⇒ 关**（§E500 起这根是名字表，不再默认三个）');
  ok(t3.indexOf('OPPS.push(o)') >= 0, '开了必须真推进 fitness 的对手表（推进别处 = 死作用点）');
  ok(t3.indexOf("'EPIRUS_COUNTER_OPPS'") >= 0, '必须进 SELF_ENV_KEYS（否则黑键侦测会判它"传了没人读"）');
  ok(/typeof o\.sel !== 'function'[\s\S]{0,200}process\.exit\(4\)/.test(t3), '缺一个对手必须 exit 4（少一个 = 一根空枪，不许静默少放）');
  const dir = mkdtempSync(join(tmpdir(), 'd130-'));
  /* 2026-10-16：每个臂**各有各的落点**（原先都写默认落点 `docs/artifacts/train-3p-out.js`，靠"最后写的那个"
   *   被读到 —— 本机与别的部分并发时那个文件会被别人覆盖，所以 metaOf 现在收一个路径参数）。 */
  const D130OUT = join(dir, 'd130on.js'), D130ONE = join(dir, 'd130one.js');
  const metaOf = packMetaOf;   /* v1.7.67：实现只有一份（`_ctx.mjs`） */
  const on = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd130on', EPIRUS_SUPPORT_PRIOR: '0', EPIRUS_COUNTER_OPPS: '1', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: D130OUT }), encoding: 'utf8', timeout: 300000 });
  eq(on.status, 0, '老口径 `=1` 要跑得通（历史臂逐位复现不能坏）');
  ok(/\[counter-ops\] 判据原型已进训练桌：cnt:guardSpam,cnt:gunSpam,cnt:snipeSpam/.test(String(on.stdout || '')),
    '必须印出进了哪三个（不印 = 又一根暗旋钮）');
  ok(/老口径[^\n]*不能[^\n]*归因|不能归因到某一型对手/.test(String(on.stdout || '')),
    '三个一起上时**日志必须自认"归因不到某一型"**（§E500 的病：一根 boolean 改三个自由度却读起来像单自由度）');
  const mt1 = metaOf(D130OUT);
  ok(mt1.recipe && Array.isArray(mt1.recipe.counterOpps) && mt1.recipe.counterOpps.length === 3,
    '产物要自带"这臂的训练桌上放了哪几个判据原型"（实测 ' + JSON.stringify(mt1.recipe && mt1.recipe.counterOpps) + '）');
  /* ③ §E500 的新牙口：名字表 ⇒ **单自由度**必须表达得出来（今晚 R1 的对照臂就靠这一格） */
  const one = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd130one', EPIRUS_SUPPORT_PRIOR: '0', EPIRUS_COUNTER_OPPS: 'snipeSpam', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: D130ONE }), encoding: 'utf8', timeout: 300000 });
  eq(one.status, 0, '只上狙击场要跑得通');
  ok(/\[counter-ops\][^\n]*cnt:snipeSpam[^\n]*OPPS 从 9 个变 10 个/.test(String(one.stdout || '')),
    '只上 `snipeSpam` ⇒ 必须**恰好进一个**（9→10；印成 9→12 = 名字表没接住，三个又被一把塞）');
  ok(/单自由度/.test(String(one.stdout || '')), '单自由度那一臂要把"单自由度"印出来（读日志的人要能分辨这臂归因得动）');
  const mtOne = metaOf(D130ONE);
  ok(mtOne.recipe && mtOne.recipe.counterOpps.length === 1 && mtOne.recipe.counterOpps[0] === 'cnt:snipeSpam',
    '产物 meta 要落生效值（实测 ' + JSON.stringify(mtOne.recipe && mtOne.recipe.counterOpps) + '）');
  const bad = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd130bad', EPIRUS_COUNTER_OPPS: 'snipeSpam2', EPIRUS_BAND_DIR: dir }), encoding: 'utf8', timeout: 300000 });
  eq(bad.status, 4, '写错名字必须 exit 4 点名（打错一个字母就"少放一个对手还照跑" = 空枪臂）');
  ok(/不认识的名字/.test(String(bad.stderr || '')), '要点名"不认识的名字"并列出合法的三个');
});

t('D159 广度判据必须是**最大单卡落地份额**（v1.5.227 · 用户裁定换 G）：数种类会误导，且旧子句从不触发', function () {
  /* 病（实测 `tools/probe-g-collapse.mjs` 20 粒产品口径样本）：
   *   旧判据 `landedKeys < 2`（以及口语里的"≥4 种"）**从来没触发过** —— 池里每粒都是 4~10 种（中位 5）。
   *   反例就在样本里：`v7expo-31`/`v7r3-42`/`v7soft-36` **10 种卡打上血、却有 76.4% 的伤害来自 `sword`**
   *   ⇒ **宽度会误导**（种类多与塌缩可以同时成立）。
   * 新判据 = `max(landByKey)/landedTotal > 0.60` ⇒ 塌缩。实测散布 36.0%→97.7%、中位 69.1%、11/20 超线，
   *   现役 45.9% 在安全侧 ⇒ **这个轴有判别力，旧轴没有**（这就是"先量判别力再立门"那条纪律的产物）。 */
  const pb = readFileSync('tools/pick-best.mjs', 'utf8');
  ok(/export const COLLAPSE_LINE = 0\.60/.test(pb), '塌缩线必须是单一来源常量（探针/门/训练都 import 它）');
  /* 断言用**语义**而不是逐字（v1.5.227 第一版把正则写死成 `share == null ? ...`，
   * 而真代码是 `(share == null) ? ...` ⇒ 门因为多了一对括号就红 —— 那种门守的是空白，不是行为）。 */
  ok(/share == null[\s\S]{0,48}keys < 2/.test(pb) && /share > COLLAPSE_LINE/.test(pb) && /shareMissing/.test(pb),
    '缺 `maxLandShare` 时必须退回旧子句**并把缺的个数报出来**（不许静默降级成"看不见就当过"）');
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  /* 训练路径必须**真的**把份额传进否决（否则新判据在真路径上是死代码），而且必须走 `landShareOf` 单一来源 ——
   * 顺手**禁止**退回手写：我第一版写的是 `max(landByKey)/landedTotal`，而 `landByKey` 含非卡键 ⇒ 算出过 44900%。 */
  ok(/landShareOf\(sb, mh\)/.test(t3) && /e\.maxLandShare = __ls\.share; e\.maxLandKey = __ls\.key;/.test(t3),
    '训练路径必须把份额传进否决，且走 `landShareOf`（单一来源）');
  ok(!/Object\.keys\(__lb\)/.test(t3),
    '不许退回手写 `max(landByKey)/landedTotal`：`landByKey` 含**非卡键**（"终局收缩"…）而 landedTotal 是过滤后的 ⇒ 份额会 >100%');
  ok(/HOLO_GIFT_MAX/.test(t3) && /最大单卡落地份额/.test(t3), '训练日志必须按新口径印（含阈值与最大卡名）');

  /* ===== 行为断言：判别力本身 ===== */
  const mk = function (score, landG, keys, share, key) {
    return { ref: { params: 'p' + score }, score: score, landG: landG, landedKeys: keys, maxLandShare: share, maxLandKey: key };
  };
  /* ① **旧判据放行、新判据必须砍**的那一粒（10 种但 76.4% 塌缩）—— 本门存在的理由 */
  let r = rejectNarrowWinners([mk(1.00, 3.2, 10, 0.764, 'sword'), mk(0.90, 3.0, 5, 0.459, 'gun')], 1.5);
  eq(r.dropped, 1, '10 种卡但 76.4% 来自一张 ⇒ 必须判塌缩（旧判据会放行它）');
  ok(r.best && r.best.score === 0.90, '该留的是份额健康的那一粒');
  eq(r.victims[0].maxLandKey, 'sword', '被剔者必须带上是哪张卡塌的（否则日志读不出病因）');
  /* ② 线的方向：`>` 而非 `>=`（恰好 0.60 不砍、0.601 砍）—— 阈值语义不许漂 */
  eq(rejectNarrowWinners([mk(1, 3.2, 5, 0.60, 'gun')], 1.5).dropped, 0, '恰好 60% 不算塌缩（线是 >）');
  eq(rejectNarrowWinners([mk(1, 3.2, 5, 0.601, 'gun')], 1.5).dropped, 1, '60.1% 必须判塌缩');
  /* ③ 加严而非放宽：只有一种卡 ⇒ 份额 100% ⇒ 一定被砍（旧子句的 case 被蕴含） */
  eq(rejectNarrowWinners([mk(1, 3.2, 1, 1.0, 'gun')], 1.5).dropped, 1, '只剩一种卡必须仍被砍（新线蕴含旧线）');
  /* ④ 缺字段的老调用方：不许静默当"过"，也不许一律判死 —— 走旧子句 + 计数 */
  r = rejectNarrowWinners([mk(1, 3.2, 3, null) ], 1.5);
  eq(r.dropped, 0, '缺份额且种类够 ⇒ 按旧子句放行');
  eq(r.shareMissing, 1, '缺份额必须被计数（让调用方看得见）');
  /* ⑤ G(落地) 那条下限仍在（两条子句是"且"的关系） */
  eq(rejectNarrowWinners([mk(1, 1.49, 5, 0.3, 'gun')], 1.5).dropped, 1, '净兑现低于地板仍要砍');
});

}
