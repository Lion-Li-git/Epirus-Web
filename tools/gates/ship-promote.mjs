/*#np-part-header
{"file":"tools/gates/ship-promote.mjs","part":"ship-promote","group":"ship","ranges":[[1184,1206],[2750,2775],[2964,3000],[4363,4387],[4572,4684],[4929,5005],[5426,5482],[6024,6076],[6109,6127],[7661,7743],[7787,7823],[8006,8051],[8078,8131],[8292,8337],[8682,8766],[8810,8888],[9574,9612],[11362,11418]],"gates":[1184,2750,2964,4363,4572,4929,4980,5426,6024,6109,7661,7787,8006,8078,8108,8292,8312,8682,8810,9574,11362],"patched":[8308]}
#np-part-header-end*/
import { makeCtx, NP_GATE_FILES, npSourceAll } from './_ctx.mjs';
/* §改（2026-10-22 千问·第六批）：D103 原来用正则钉 `p2-baselines.mjs` 的**源码字符串**判"有没有登记 beadburst / 是不是表尾"。
 * 这张表本来就 `export`（`tools/promote-champion2p.mjs:23` 已在用它）⇒ 直接读运行时的表，写法/换行/注释怎么改都不误红。
 * 与 `probe-libs.mjs:5` 同一种接法（门文件 import 工具模块，早有先例）。 */
import { P2_FNAME, P2_NAMES } from '../p2-baselines.mjs';
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
export const ords = [1184, 2750, 2964, 4363, 4572, 4929, 4980, 5426, 6024, 6109, 7661, 7787, 8006, 8078, 8108, 8292, 8312, 8682, 8810, 9574, 11362];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D219 「6 珠悬崖」回归护栏（v1.5.318）：现役冠军决策时 ep 的暴露面不许越过实测基线', function () {
  /* 依据（千问 §16④ / §E232）：夺冠率对手里留多少珠是**一片平台 + 一道悬崖** ——
   *   0.77~1.81 珠 => 14.9~20.9%（无差异区）；6.5~6.8 珠 => 1.6%；8.2~8.6 珠 => 0.1~0.3%。
   * => 门禁/进化池要考经济判断，考的应当是会不会越过 6 珠，不是攒不攒。
   * 这条曲线是**相关性**读数，合法用法只有两条：否证单调性 / 支持 theta=0 是局部最优（§16④ 的限定）。
   * => 本门是**回归护栏**（别让暴露面变大），不是证明 6 珠以上必输。
   * 夹具：60 局 multi/5（冠军席 + 4 脚本），固定种子；实测基线 ep>=6 = 1.95%（14/717 次）、峰值 12。 */
  const ch = AUDIT.loadChamp(sb, 'js/bundled-champion-3p.js');
  const pr = ch && ch.params ? ch.params : ch;
  const OPPX = [Bots.pickBalanced, Bots.pickAggro, Bots.pickDefend, Bots.pickMix, Bots.pickFarmer];
  let n = 0, ge6 = 0, peak = 0;
  for (let g = 0; g < 60; g++) {
    const st = S.createState('multi', { next: mulberry32(3100 + g * 7919) }, 5);
    st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3779b9) >>> 0;
    const base = T.policyChooserN(pr, 0.15, 0.15, 5);
    const rec = function (state, pid, legal) { const ep = state.p[pid].ep || 0; n++; if (ep >= 6) ge6++; if (ep > peak) peak = ep; return base(state, pid, legal); };
    Play.autoGameN(st, [rec, OPPX[0], OPPX[1], OPPX[2], OPPX[3]]);
  }
  ok(n >= 500, '夹具必须真的跑出足够决策（实测 ' + n + ' 次）—— 少了说明夹具坏了，不是冠军变好了');
  ok(100 * ge6 / n <= 4, '决策时 ep>=6 的占比必须 <= 4%（实测 ' + (100 * ge6 / n).toFixed(2) + '%，基线 1.95%）');
  ok(peak <= 14, '决策时 ep 峰值必须 <= 14（实测 ' + peak + '，基线 12）');
});

t('D55 F 的口径必须是"场 A 被集火还手率"（考核依据修正），旧口径不得再作判据', function () {
  /* v1.5.62（用户裁定）：旧 F 的场地是"1 席进攻者 + 4 席冠军自己" ⇒ 量到的是自对局均衡；
   * 门槛从 35% 降到 25% 后仍靠 --force 越过（所有冠军 22~35%）⇒ 问题在考核依据。
   * 新口径 = 场 A（4 席脚本猛攻 vs 1 席冠军）的还手率，阈值 20%（线上包 13% ✗ / 种子 27% ✓ / eco-34 25% ✓）。 */
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('export function aggressionProfile') >= 0, 'audit-lib 必须导出 aggressionProfile（单一真源）');
  ok(al.indexOf('e.source === me') >= 0, '伤害归因必须用事件真字段 source（不是 from）');
  ok(al.indexOf("me = g % 5") >= 0, '冠军座位必须逐局轮换（避免座位相位污染）');
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf('agg.fieldA.atk < 0.20') >= 0, '上线体检的 F 判据必须是场 A 的 >=20%');
  ok(pc.indexOf('fAct.atk < 0.25') < 0, '旧的"活跃场进攻率 < 25%"判据必须已移除');
  const sc = readFileSync('tools/screen-champ.mjs', 'utf8');
  ok(sc.indexOf('agg.fieldA.atk < 0.20') >= 0, '筛选器必须同步用场 A');
  /* 行为断言：两场必须真的不同构造 —— 场 A 的对手出手次数应远多于场 B（B 场对手只ジ） */
  const Wl = { EpirusRules: R, EpirusState: S, EpirusTrainer: T, EpirusPlay: Play };
  Pol.setRng(T.mulberry32(31337));
  const pl = Pol.makePolicy(0.25);
  const agg = aggressionProfile(Wl, pl, 8);
  ok(agg.fieldA.oppAtkPerGame > agg.fieldB.oppAtkPerGame + 1,
    '场 A 的对手必须真的在进攻（A=' + agg.fieldA.oppAtkPerGame.toFixed(1) + ' vs B=' + agg.fieldB.oppAtkPerGame.toFixed(1) + '）');
  ok(agg.fieldA.atk >= 0 && agg.fieldA.atk <= 1 && agg.fieldB.atk >= 0 && agg.fieldB.atk <= 1, '两场都必须返回合法比率');
  /* v1.5.65：终局收缩的伤 source=null（不可格挡）⇒ 场 B 里冠军仍会掉血，必须按"对手造成的伤"判。 */
  ok(agg.fieldB.takenByOpponentPerGame === 0,
    '场 B（对手只ジ）里冠军不该被**对手**打（实测 ' + agg.fieldB.takenByOpponentPerGame.toFixed(2) + '/局）');
});

t('D16 两个线上冠军包（2P/3P）的规则指纹都必须等于当前规则指纹（否则成绩已过期）', function () {
  /* v1.5.7（千问体检 §5-2 建议 / HANDOFF §4-9 规矩）：v1.5.4 只改了 rules.js 里一个 `target` 字段，
   * 5P 线上冠军的考卷成绩就从 38.0% 掉到 15.0%，而当时**没有任何机制**能自动发现"产物与引擎错配"。
   * 这条把两者绑成机械检查：规则源码一改 ⇒ 指纹变 ⇒ 本用例立刻红 ⇒ 必须重测线上冠军、
   * 把新成绩与新指纹一起记回 bundle 的 meta。它**故意敏感**（连注释改动都会触发），
   * 因为重记的成本是"一次考卷 + 一行 meta"，而漏掉的成本是交付质量静默下降。 */
  const cur = rulesFingerprint();
  /* v1.5.71 **更正**：这条"训练期间 bundle = 热启动基线"的旧假设**已过期**。
   * v1.5.48 做了训练隔离（自跑器只把基线拷到 staging `docs/artifacts/.training-in-3p.js`、
   * 产物从 `.training-out-3p.js` 取；线上包只在臂首**备份**、臂尾**还原**，训练期间**不写**）——
   * 实测铁证：本臂运行中 `js/bundled-champion-3p.js` 的 mtime 仍是**前一天**。
   * 旧断言于是把**每一条臂**在训练期间都打红（我用它提交时被挡了一次）⇒ 属"门禁在正常运行时乱响"。
   * 改成两条真断言：臂首快照存在 ⇒ 逐字节比对（能抓住"训练又去写线上包"这种回归 ——
   * 用户被这个坑过两次）；无快照（旧臂）⇒ 走下面的正常路径校验指纹（隔离下本来就该成立）。 */
  if (existsSync('docs/artifacts/.training.lock') && existsSync('docs/artifacts/.training-live.sha1')) {
    const want = readFileSync('docs/artifacts/.training-live.sha1', 'utf8').trim().split(/\s+/)[0];
    const got = createHash('sha1').update(readFileSync('js/bundled-champion-3p.js')).digest('hex');
    eq(got, want, '训练进行中：线上包必须与臂首快照逐字节相同（不等 ⇒ 训练在写线上包，用户被这个坑过两次）');
  }
  const bundle = readFileSync('js/bundled-champion-3p.js', 'utf8');
  const fp = fingerprintOfBundle(bundle);
  ok(!!fp, '线上 bundle 的 meta 必须记 rulesFingerprint（当前规则指纹 = ' + cur + '）');
  eq(fp, cur, 'bundle 记的规则指纹必须等于当前规则指纹（不等 ⇒ 考卷成绩已过期，重测后把新指纹/成绩记回 meta）');
  ok(/"examScoreAtBuild"\s*:\s*[0-9.]+/.test(bundle), 'bundle 的 meta 必须记 examScoreAtBuild（构建时的考卷成绩）');

  /* v1.5.18（第三方复核 §5-1）：**2P 包也必须被罩住**。此前 `js/bundled-champion.js` 一个 meta
   * 字段都没有 ⇒ 它落在本用例视野之外：最后一次重训是 v1.3.47，此后 11 次提交动过 core，
   * 其中 v1.5.7 还把【全息屏障】移出 2P 卡表 —— 而没有任何机械检查能发现"这个包是在旧规则下训的"。
   * 反证：删掉 promote-champion2p 写的那行 meta ⇒ 本用例立即红。 */
  const bundle2 = readFileSync('js/bundled-champion.js', 'utf8');
  const fp2 = fingerprintOfBundle(bundle2);
  ok(!!fp2, '2P bundle（js/bundled-champion.js）的 meta 必须记 rulesFingerprint（v1.5.18 起；用 tools/promote-champion2p.mjs 补记）');
  eq(fp2, cur, '2P bundle 记的规则指纹必须等于当前规则指纹');
  ok(/"examScoreAtBuild"\s*:\s*[0-9.]+/.test(bundle2), '2P bundle 的 meta 必须记 examScoreAtBuild（2P 基准表 × 40 局的平均胜率）');
  ok(/window\.EPIRUS_CHAMPION\s*=/.test(bundle2), '2P bundle 的冠军槽必须还在（补 meta 不得写坏权重槽）');
});

t('D61 五道门槛是单一真源：落盘处与出厂换包都必须走 feasibilityOf（复核 §4-6）', function () {
  const srv = readFileSync('server/train-server.mjs', 'utf8');
  const pro = readFileSync('tools/promote-champion.mjs', 'utf8');
  const lib = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(srv.indexOf('audit.feasibilityOf(') >= 0, '训练落盘处必须调用 audit.feasibilityOf');
  ok(srv.indexOf('fieldB.clearedPerGame < 0.3') < 0, '落盘处不得再自己写一份阈值（应已搬进 audit-lib）');
  ok(pro.indexOf('feasibilityOf(') >= 0, '出厂换包处必须调用 feasibilityOf（线上包曾因绕过落盘而没有 feasibility 记录）');
  ok(pro.indexOf('meta.feasibility') >= 0, '出厂包必须把可行性记录写进 meta');
  /* 阈值必须在 lib 里，且五道齐全（搬运时漏一条 = 静默放宽） */
  const i0 = lib.indexOf('export function feasibilityOf(');
  /* v1.5.201（审计 D61）：原来是"锚点 + 固定 4000 字符窗"。实测最远的钉点离锚 2114 字符，
   * 余量只剩 ~1.9KB —— 代码一挪出窗口，红出来的信息会读成"实现错了"，而真相是"实现搬了"。
   * 改成按**配对花括号**取整个函数体（fnBody），阈值还在不在就是"在不在这个函数里"。 */
  const seg = fnBody(lib, 'export function feasibilityOf(');
  ok(seg.length > 0, '必须能定位 feasibilityOf 的实现段');
  ok(seg.indexOf('clearedPerGame) < 0.3') >= 0, '五道之一：场B 清场 < 0.3/局');
  ok(seg.indexOf('atk) < 0.20') >= 0, '五道之二：场A 还手 < 20%');
  ok(seg.indexOf('effSkills) < 3') >= 0, '五道之三：G < 3');
  ok(seg.indexOf('dmgPerGame) <= 0.5') >= 0, '五道之四：反弹墙伤害 ≤ 0.5/局');
  ok(seg.indexOf("s.verdict === 'biased'") >= 0, '五道之五：座位偏座');
  ok(seg.indexOf('winRate <') < 0 && seg.indexOf('winRate >=') < 0, 'feasibilityOf 里不得有任何以胜率为准的比较');
  /* 缺值必须响亮：`!(NaN > 0.5)` 曾是本函数第一个 bug（把"探针没跑"读成"墙瘫了"，假红） */
  ok(seg.indexOf('探针缺失') >= 0, '探针缺失/无值必须显式判失败（不许静默通过，也不许静默判死）');
});

t('D67 G4/G5 行为门：量具可跑 + 只有 G4/G5 进阻断 + 退出码契约（第七轮复核 §15-1）', function () {
  const g = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(g.indexOf('st.slotSalt = h32pre(') >= 0, '对局必须设**与轮座去相关**的盐（否则座位/基线自检出假数）');
  ok(g.indexOf('judgeable') >= 0 && g.indexOf('不可判') >= 0, 'G4 必须有"基线格可判"的前置守卫');
  ok(g.indexOf('G6[元测试]') >= 0, 'G6 必须先有"量具判别力"元测试');
  /* v1.5.202：把"默认值"也钉住 —— 否则上面那条 spawn 用的是显式 GATE4_GAMES=60，默认被改回去也没人发现。
   * 默认 300 的依据：同一只包的参照行基线在 n=60→300 之间摆 **7pt**（long 27%→20%）；代价实测 +35 秒（15s→50s）。
   * 生产路径（promote-champion）走的就是这个默认值；本用例自己显式传 60 只为跑得快。 */
  ok(g.indexOf('GATE4_GAMES || 300') >= 0, 'G4/G5 的**默认**样本量必须是 300（n=60 的参照行基线会摆 ±7pt）');
  /* v1.7.70 · gate-sentinel ③ 分诊：原来钉的是 `' 记录  G6['` —— **连排版（两个空格）一起钉死**，属 ③ 里最硬的一条。
   *   要保的语义是「逐包行是**记录**不是 PASS/FAIL」，与空几格无关 ⇒ 换成对空格宽容的正则。 */
  ok(/记录\s+G6\[/.test(g) && g.indexOf('gate(`G6[${nm}]') < 0, 'G6 的逐包行必须是**记录**而不是 PASS/FAIL（四代包全未达 ⇒ 恒假）；元测试那条仍是门');
  ok(g.indexOf('process.exitCode') >= 0, '必须有退出码契约（FAIL ⇒ 非 0）');
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf("['tools/gate-drafts.mjs', SRC]") >= 0, 'promote-champion 必须调用量具');
  ok(pc.indexOf('/^G4\\[/.test(nm) || /^G5\\[/.test(nm)') >= 0, '只有 G4/G5 进阻断面（G3/G6 只记录）');
  ok(pc.indexOf('行为门未过') >= 0 && pc.indexOf('meta.gateDrafts') >= 0, '阻断结论必须留痕（meta）');
  /* v1.5.89：本轮实测发现的三处**判词缺陷**，各留一条"能失败"的断言（都与 v1.5.78 的原病根同族）：
   * 原病根 = "把没跑 / 没判的当成过了"。这三个缺陷是它的三种变体：主语错位、判词不可读、缺第三态。 */
  const gd = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(pc.indexOf("const isRef = /^G[3-6]\\[(线上包|元测试)/.test(nm);") >= 0,
    '必须识别**参照行**（线上包 / 元测试）—— 它们说的是别的对象，不得阻断候选');
  ok(/if \(m\[1\] === 'FAIL' && !isRef &&/.test(pc),
    '阻断条件必须排除参照行：否则候选被"在位包是红的"连坐 ⇒ 任何换包都只能靠 --force（主语错位）');
  /* v1.5.202：第三态现在**带方向**（`UNRUN:弱|强|缺`）—— 因为处置按方向分，光有"第三态"不够了。 */
  ok(gd.indexOf("const st = unrun ? ('UNRUN'") >= 0 && gd.indexOf("unrunKind") >= 0,
    'gate-drafts 必须支持 UNRUN 第三态（跑不了 / 不可判 ≠ 不合格）**且带方向**（弱/强/缺 ⇒ 处置不同）');
  /* v1.5.202：UNRUN 不再"一律只打印" —— 处置走纯函数、按**方向**分（弱/强/缺）。 */
  ok(pc.indexOf('unrunDisposition(') >= 0 && pc.indexOf('unrun-policy.mjs') >= 0,
    'UNRUN 的处置必须是单一来源纯函数（v1.5.202：原来它从不进 fails ⇒ 基线退化的候选可零阻断通过）');
  ok(g.indexOf("'UNRUN' + (unrunKind") >= 0 && g.indexOf('unrunKind') >= 0,
    'gate-drafts 必须给 UNRUN 带上**方向**（弱/强/缺）—— 可判窗口把两个相反形状合并了');
  ok(pc.indexOf('gateDrafts.unrun') >= 0 && pc.indexOf('不得当作通过') >= 0,
    'UNRUN 必须被单独收集 + 醒目提示"不得当作通过"（否则它读起来就是"过"）');
  ok(gd.indexOf('最克「${worst[0]}」${worst[1]}%') >= 0,
    'G4 标题必须带"最克那一格"：原先标题只有基线 ⇒ FAIL 行读起来像"这条过了"（实测时连作者都被误导）');
  ok(gd.indexOf('实测防席夺冠 ${pct}%') >= 0, 'G5 标题必须带实测值而不是只有阈值');
  /* 行为：用极小局数真跑一遍量具（不拖慢门禁），验元测试与退出码契约 */
  const r = spawnSync(process.execPath, ['tools/gate-drafts.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24,
    env: Object.assign({}, process.env, { GATE3_GAMES: '20', GATE4_GAMES: '60', GATE6_GAMES: '6' })
  });
  const out = String(r.stdout || '') + String(r.stderr || '');
  ok(/PASS\s+G6\[元测试\]/.test(out), 'G6 元测试必须 PASS（量具判别力不足 ⇒ 后面所有读数不可信）');
  /* v1.5.89：口径改了 —— 补入"只枪(1ジ压制·打最肥)"这一格之后，线上包自己在 **G4[long]** 就是红的
   * （长程被最便宜的一张卡打穿，第八轮复核 §6 的结论）。判别力依据只要求"线上包**至少一个模式** PASS"；
   * 而"在位包是红的"必须**只记录、不阻断候选** —— 该契约由上面那两条 isRef 断言守着。
   * （v1.5.104：`GATE4_GAMES` 由 6 抬到 **60** —— n=6 的"哪一格最克 / 是否越线"本身就是小样本统计量
   *  （§31/§35 的同一条教训），拿它断言等于内置"偶发红"；仍**不**断言 `FAIL G4[线上包/long]`，
   *  因为在位包/候选的 long 读数会随包更替而变。） */
  /* ===== v1.5.129（**用户裁定②**）：这一条从"硬红"改成"**已记录的例外**" =====
   * 背景（v1.5.123 §3，如实记录过）：线上包 `v7press3-91` 是**用 `--force` 越过 G4** 换上的
   * ⇒ 它两个模式都红 ⇒ 旧措辞（"线上包至少一个模式必须 PASS"）**会一直红**。
   * "长期红"的代价不是"少一道网"，而是**以后的真红会被已知红淹没**（每次提交都要人肉分辨哪条是新的）。
   * 现在的判据是**三分支**（口径 id 来自 gate-drafts 打印的 `G4POOL` 行，见其 `G4_POOL_ID`）：
   *   ① 至少一个模式 PASS ⇒ 通过（原口径，锚还在）；
   *   ② 两模式都红 **且** bundle 的 meta 里有一条**格式良好 + 口径匹配**的 G4 越线留痕 ⇒ 通过（已记录的例外）；
   *   ③ 两模式都红 **且** 无留痕 / 留痕口径与当前克制表不一致 ⇒ **红**。
   * ⇒ 安全网没丢：丢掉的只是"记过账的旧账"，留下的是"**没记的账**"与"**改了池子却没重记的账**"
   *   （后者正是本次自己会踩的那一步：加了「珠爆发」一格 ⇒ 口径 id 变 ⇒ 旧留痕自动失效 ⇒ 必须重记）。 */
  const refPassG4 = /PASS\s+G4\[线上包\/(long|multi)\]/.test(out);
  const poolM = /G4POOL\s+([0-9a-f]{8})/.exec(out);
  const curPool = poolM ? poolM[1] : null;
  /* qoder-research 0920（RESEARCH-LOG §3-2 · 缝自曝于 v1.5.133 §5）：**实现身份双绑**。
   * `G4IMPL` = 各格 chooser 源码 + `pT` 的 sha1 ⇒ **改格子行为不改键名**时它也变，旧例外失效。
   * 在位包的留痕记于"实现身份"发明**之前**（meta 无 `impl` 字段）⇒ 给一条**冻结豁免**：
   * 仅当"当前实现 == v1.5.134 那一版（`caecc92f`）"时放行；谁改了任何一格，豁免随 id 一起作废，
   * 届时必须 `--force` 重记（新留痕会带 impl，走正常比对）。这是**一次性**的迁移垫脚，不是永久通道。 */
  const G4IMPL_AT_EXCEPTION = G4FROZEN;   // v1.5.202：单一来源（原为手抄常量）
  const implM = /G4IMPL\s+([0-9a-f]{8})/.exec(out);
  const curImpl = implM ? implM[1] : null;
  let meta3p = null;
  try {
    const m3 = /(window\.EPIRUS_CHAMPION_3P_META\s*=\s*)(\{[\s\S]*?\})(\s*;)/.exec(readFileSync('js/bundled-champion-3p.js', 'utf8'));
    meta3p = m3 ? JSON.parse(m3[2]) : null;
  } catch (e) { meta3p = null; }
  const g4rec = (meta3p && meta3p.gate4Forced && typeof meta3p.gate4Forced === 'object') ? meta3p.gate4Forced : null;
  /* ⚠️ 例外的**完整性**并进判据本身（而不是另立一条恒真断言）：
   * `forced` 为真 + **口径 id 相等** + **带上被放过的具体行**，三者缺一 ⇒ 不认这条例外。
   * 第三条（`lines`）不是排版洁癖：promote-champion 哪天只写 `forced` 而丢掉 `lines`，
   * 例外就变成"记了账但不知道记了什么"—— 那时这条门必须**红**，而不是静默放行。 */
  /* v1.5.202：判定搬进 pure function（\`tools/gate4-exception.mjs\`）。
   * 原来这段被 \`refPassG4\` 短路 ⇒ 只要在位包 G4 有一个模式 PASS（常态）它就**从未被求值**，
   * 第一次真正运行会发生在"正要发一只过不了门的冠军"的那次提交里 —— 那是最不能出错、却唯一没被验证过的时刻。
   * 抽出来之后 D146 用**合成 meta** 把六种组合逐一跑过。语义一个字没改。 */
  const g4recOk = g4ExceptionOk(curImpl, curPool, g4rec);
  ok(refPassG4 || g4recOk,
    refPassG4 ? '线上包 G4 **至少一个模式** PASS（"已知好"一侧成立）'
      : (g4recOk ? '线上包 G4 两模式都红，但 meta 有**完整且口径匹配的 `--force` 留痕** ⇒ 已记录的例外（' +
        String(g4rec.ts || '?') + ' · pool ' + g4rec.pool + ' · impl ' + (g4rec.impl || G4IMPL_AT_EXCEPTION + '(冻结豁免)') +
        ' · ' + g4rec.lines.length + ' 行）'
        : '线上包 G4 两模式都红，且 meta 里**没有可用的越线留痕**（缺失 / 未 `--force` / 口径 id 与当前克制表不一致' +
          ' / **实现身份已变而例外未重记** / 留痕没带被放过的具体行）⇒ **必须重记**：node tools/promote-champion.mjs <源.bak> --force'));
  /* v1.5.104（用户裁定）：G4 阈值 45% → 60%。**阈值必须有单一常量 + 标定理由**，
   * 否则它会像 `sed` 不匹配那样静默漂移；同时把"理想线 45%"单独留着，别让绿灯被读成"已达理想"。 */
  const gsrc = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(gsrc.indexOf('const G4_MAX = 60, G4_IDEAL = 45;') >= 0,
    'G4 阈值必须是**单一常量**（`G4_MAX`），理想线（`G4_IDEAL = 45`）分开存');
  ok(gsrc.indexOf('在位包自己在 G4[long] 就是 65%') >= 0,
    '必须写明标定理由：45% 是**现役包都达不到**的线（用户裁定 60%），否则下轮又会有人把它当"该回到 45%"');
  ok(gsrc.indexOf('距理想线') >= 0, '过闸但未达理想线时，判词必须显式写出差距（别让绿灯冒充"已达理想"）');
  ok(/PASS\s+G5\[线上包\/(long|multi)\]/.test(out), '线上包 G5 必须 PASS（同上）');
  const anyFail = /^\s*FAIL\s+/m.test(out);
  eq(r.status, anyFail ? 1 : 0, '退出码必须与"是否存在 FAIL"一致（CI/promote 靠它判定）');
});





/* ===== v1.5.79（第七轮复核 §15-1）：**威胁靶向**奖励 =====
 * 复核的机制发现：池子里没人会瞄人 ⇒"狙击专精"是池子漏洞（给 4 席加一条"谁放冷枪就打谁"的一行规则，
 * v17-146 的 A 考卷 30%→0%）。与环课题的关键区别：环出手率 0（bootstrap 不到），
 * 而"打威胁者"已在发生（22.5% ≈ 随机 25%）⇒ 窄奖励能给**已有的偶然行为**定向加压。
 * 归因走 damage.source/to（真字段；动作事件**没有** target ⇒ 只能从结果归属）。 */
t('D78 第 6 道判据（输出密度 / 经济出口）：**没有"已知好"一侧就不许上闸** + 密度对手必须在册', function () {
  /* v1.5.90（第八轮复核 §8-3/§8-4）：把"输出密度 / 经济出口"机械化。
   * 这条守门盯的不是阈值数字，而是**上闸的前提**：本仓库栽过多次"阈值把所有人挡住"
   * （附录 B2-6 / C-4：阈值必须先能分开已知好与已知坏）。在位线上包花珠率 0%（未闭环）
   * ⇒ 这道判据现在**没有**判别力 ⇒ 只许记录、不许阻断；等有候选真过了它再打开。
   * 反证：把 `DENSITY_BLOCK` 改成 true ⇒ 这条立即红（它就开始挡所有候选了）。 */
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('export function densityProfile(') >= 0, '必须有输出密度探针（每回合出手伤害 / 按ジ占比）');
  ok(al.indexOf('export const DENSITY_BLOCK = false;') >= 0, '第 6 道判据默认**不阻断**（现在没有判别力）');
  /* v1.5.94（第九轮复核 §6）：复核要求"上闸"，我**部分不采纳**，理由必须钉在源码里 ——
   * 它点名的"密度门"是 `只枪(打最肥)` 那一格，而那一格**早就已经是阻断项**（G4，标定包 `v7f3-94` = 5%/5%）；
   * 本常量管的是**珠经济闭环**，过了它的两个包都是废包 ⇒ 翻了只会挡死所有候选。 */
  ok(al.indexOf('v7f3-94') >= 0 && al.indexOf('已经是闸') >= 0,
    '必须把"只枪格已由 G4 阻断、本常量管的是另一件事"写进源码注释（免得下轮又有人来翻它）');
  /* v1.5.94（第九轮复核 §5-1）：**退化包**（自对局从不出手）必须能被判负，且走 fails */
  ok(al.indexOf('zeroAtkRate') >= 0 && al.indexOf('自对局零攻击局') >= 0 &&
    al.indexOf("fails.push('自对局零攻击局") >= 0,
    '退化包判据必须存在且进 fails（复核实测：0 出手的包照样拿 A 考卷 46.8~47.1%）');
  ok(al.indexOf('zeroDealtRate') >= 0, '零出手率与零伤害率必须分两列（复核 §7-1）');
  /* v1.5.101（第十轮复核 §4-2）：**布尔化的经济判据会被"最小非零"刷分** ——
   * 候选② `v7wall1-93` 得珠 835 / 花掉 **1**（花/得 0.12%）就点亮了"闭环 ✓"，而它每局浪费 20.9 颗。
   * ⇒ 闭环改成**双条件**，并单列"过期/局"。 */
  ok(al.indexOf('Number(dens.spentRate) >= 0.2 && Number(dens.expiredPerGame) <= 1') >= 0,
    '珠经济闭环必须是**双条件**（花/得 ≥20% 且 过期/局 ≤1）');
  ok(al.indexOf('beadExpiredPerGame') >= 0, '必须记录"过期/局"（双条件的第二项）');
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
  ok(al.indexOf('density: dRec') >= 0, '第 6 道的读数必须进 feasibilityOf 的返回值（落盘 meta 要能查）');
  const fs0 = al.indexOf('export function feasibilityOf(');
  const fs1 = al.indexOf('export function chargeProfile(');
  ok(fs0 > 0 && fs1 > fs0, '必须能定位 feasibilityOf 的函数体（用顶层兄弟函数定界，不能用"下一个 function"）');
  const fs = al.slice(fs0, fs1);
  ok(fs.indexOf('fails.push') >= 0, '前五道仍照旧记 fails');
  ok(fs.indexOf('notes.push') >= 0 && /notes\.push\('第6道/.test(fs) && fs.indexOf('DENSITY_BLOCK') >= 0,
    '第 6 道必须走 notes（记录）+ 由 DENSITY_BLOCK 显式控制 —— **不得**进 fails');
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf('densityProfile(W, params') >= 0 && pc.indexOf('输出密度') >= 0,
    '体检必须打印输出密度（否则等于没量 —— "命门"就还只是口头的）');
  ok(pc.indexOf('density: { dmgPerRound: dens.dmgPerRound') >= 0, '体检必须把密度读数喂给 feasibilityOf');
  /* 上游：密度对手必须在册，否则"把压制密度放进池子"这条实验根本起不来（第 4 次"加名字漏一处"）。 */
  const bots = readFileSync('js/train/bots.js', 'utf8');
  ok(bots.indexOf('function pickGunSpam(') >= 0, '必须有"只枪·打最肥"的对手（复核 §6 那一行脚本）');
  ok(bots.indexOf('pickGunSpam,') >= 0, 'pickGunSpam 必须导出');
  ok(bots.indexOf('mpPickOne(state, fattest)') >= 0,
    '打最肥必须在最高血那一档里**随机**取（按 pid 取 = 座位身份通道，D50/D58 家族）');
  ok(readFileSync('server/opp-pool.mjs', 'utf8').indexOf("name: 'gunspam'") >= 0, 'gunspam 必须在对手注册表里');
  const T2 = readFileSync('server/opp-pool.mjs', 'utf8');
  ok(/OPP_DEFAULT = OPP_SPECS\.slice\(0, 9\)/.test(T2), '默认池仍取前 9 个 ⇒ 新增 specialist 不进默认基线');
});

t('D79 技能广度 S：定义明确 + 按 rules.js 声明的 cat 分层（**不按伤害加权**）+ 固定分母 + 只记录不阻断', function () {
  /* v1.5.91（用户裁定）：用户要的目标形状是 `H + T·S`（H = 与胜率相关的强度、S = 技能广度、T = 交换率）。
   * 这条守门盯的是**用户明确否定过的东西**，免得以后又走回去：
   *   ① 不得按"落地伤害"加权 —— 那样梯度会全给最便宜的枪，而且防御类卡伤害恒 0 ⇒ 量不出防御技能的使用；
   *      更根本：任何"按卡打分"的权重都会给某张卡一个**专属梯度**（v1.3.7 的 hold+conv 就是活例）；
   *   ② 分母不得来自"当时可负担的技能数"（v1.5.86 那个可以靠"把菜单变穷"刷分的洞）；
   *   ③ 不得悄悄变成阻断项（它现在**只测量**；上闸是独立决策，且要先有判别力）。 */
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('export function breadthProfile(') >= 0, '必须有广度的权威定义 breadthProfile');
  const seg = al.slice(al.indexOf('export function breadthProfile('));
  ok(seg.indexOf('.cat') >= 0, 'S 必须按 rules.js **自己声明的 cat** 分层（单一真源，不手搓角色表）');
  ok(seg.indexOf('dmg') < 0 && seg.indexOf('amt') < 0,
    'S **不得**按落地伤害加权（用户 v1.5.91：那会全跑去用枪，且量不出防御技能）');
  ok(seg.indexOf('Math.log(K_menu)') >= 0, '分母必须是**固定的声明菜单** ln(K_menu)');
  ok(seg.indexOf('aff') < 0, '分母不得取自"当时可负担的技能数"（v1.5.86 的刷分洞）');
  ok(seg.indexOf('e.key !== R.SK.JI') >= 0, 'ジ 必须排除（它是攒钱/等待，不算技能选择）');
  ok(seg.indexOf("e.outcome === 'ok'") >= 0, '只统计成功动作（与门禁 G 同源，D74 的同一条规矩）');
  ok(seg.indexOf('N: N') >= 0 && seg.indexOf('maxCardShare') >= 0, '必须返回样本量 N 与反 spam 的 maxCardShare');
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf('breadthProfile(W, params') >= 0 && pc.indexOf('技能广度 S（n=') >= 0,
    '体检必须打印 S，且**与 n 一起打**（S 对样本量敏感 —— METHODOLOGY 22）');
  ok(pc.indexOf('目标 = H + T·S') >= 0, '打印里必须写清目标形状（用户要求"S 怎么算"必须明确）');
  ok(pc.indexOf("fails.push('广度") < 0 && pc.indexOf('fails.push("广度') < 0,
    '广度**不得**进 fails（只测量；要上闸是独立决策）');
});

t('D103 「珠爆发」线必须同时在册（2P 考卷 + G4 克制表），且 G4 **复用同一份实现**', function () {
  /* 动机（第三方复核 §3 的建议 + 本仓**栽过四次**的老病"加名字漏一处"）：
   * v1.3.59 只补 worker、v1.4.8 只补 server、v1.4.14 漏 opp-pool 本身、v1.5.19 漏 trainer.js。
   * 这条线要同时出现在**两处池子**才有意义：2P 考卷（`p2-baselines`）量"2 人局防不防电"、
   * G4 克制表量"5 席 multi/long 防不防电"。少一处 ⇒ 那个洞在那一侧仍然不可见。
   * ① **行为**部分（运行时，不是文本钉）：这个脚本必须真的是"为放电而蓄电珠 → 有珠就放电 → 残血摄魂"。 */
  ok(typeof Bots.pickBeadBurst === 'function', 'pickBeadBurst 必须在 EpirusBots 里（并被 p2-baselines 指向）');
  const mk = function (ep, elec, hp0) {
    const st = S.createState('standard', { next: mulberry32(9501) }, 2);
    st.p[0].ep = ep; st.p[0].elec = elec; st.p[0].boom = 0;
    if (hp0 != null) st.p[0].hp = hp0;
    return st;
  };
  const pickOf = function (st) { return Bots.pickBeadBurst(st, 0, Play.legalActions(st, 0)); };
  /* ⚠️ 下面这组断言来自 v1.5.129 的**实测教训**：我的第一版写成"买得起蓄能就蓄"，而**珠只活一回合**、
   * 蓄能又花 1 ジ ⇒ 退化成 `蓄能 → ジ → 珠过期 → 蓄能 → …` **永不放炮**
   * （200 局里 `railgun` 出手 **0** 次、造成伤害 **0.00/局**）。所以"ep=1 不许蓄珠"不是风格问题，
   * 而是**这条线能不能成立**的条件；单点行为全对也救不了——必须另有端到端断言（见 ①b）。 */
  const s1 = mk(1, 0);
  eq(pickOf(s1).key, R.SK.JI, 'ep=1 **不许**蓄珠（蓄完只剩 0 ジ，珠活不过下一回合 ⇒ 永不放炮）');
  const s2 = mk(3, 0);
  const r2 = pickOf(s2);
  eq(r2.key, R.SK.CHARGE, 'ep=3 ⇒ **蓄珠**（花 1 后余 2，下一回合正好付得起电磁炮）');
  eq(r2.bead, 'elec', ' 且必须**显式指定电珠**（`play.js:33-37` 的 v7 珠类型通道；不指定就学不会为放电蓄珠）');
  const s3 = mk(2, 1);
  const r3 = pickOf(s3);
  eq(r3.key, R.SK.RAILGUN, '有电珠且付得起（2 ジ）⇒ 必须放**电磁炮**');
  ok(r3.target === 1, ' 且目标必须指向唯一对手（不按 pid 乱指）');
  const s4 = mk(0, 0);
  eq(pickOf(s4).key, R.SK.JI, '什么都买不起 ⇒ 只能ジ（攒钱）');
  const s5 = mk(3, 0, 1);
  eq(pickOf(s5).key, R.SK.DRAIN, '自己残血（standard 摄魂窗口 = 自己 HP≤1）且付得起 ⇒ 摄魂收尾');
  /* ①b **端到端**（这条才是抓第一版那个 bug 的那条）：单点行为全对而整条链死循环，
   *    正是第一版的形态 ⇒ 必须有一条"**链条真的转起来**"的断言。
   *    对手只出ジ（零伤害）⇒ 只要脚本放得出炮，`railgun` 次数必 > 0；第一版在这里读到 **0**。 */
  const stG = S.createState('standard', { next: mulberry32(9502) }, 2);
  Play.autoGame(stG, [function (st2, pid, legal) { return Bots.pickBeadBurst(st2, pid, legal); },
    function () { return { key: R.SK.JI, target: null }; }]);
  const rg = stG.events.filter(function (e) { return e.type === 'action' && e.pid === 0 && e.key === R.SK.RAILGUN; }).length;
  ok(rg > 0, '整条线必须真的转起来（对"只出ジ"的对手，脚本必须放得出电磁炮；第一版这里是 0）');
  /* ② 注册部分：2P 考卷**只能追加在表尾**（`p2-baselines.mjs:8-10`：顺序是行为输入）。
   * §改（2026-10-22 千问·第六批）：原来这里两条是源码正则（`/beadburst: 'pickBeadBurst'/` 与它后面紧跟 `};`）。
   *   旁边那句"运行时读不出是第几个"**不成立** —— 这张表本来就 `export`（`P2_FNAME` / `P2_NAMES = Object.keys(...)`，
   *   `promote-champion2p.mjs:23` 就在用），字符串键保持插入序 ⇒ 表尾是**读得出来的数据**。
   *   换成两条运行时判据：登记在不在（且指的必须是这条线自己的名字）‖ 是不是末项。
   *   ⇒ 换行/加注释/改缩进都不再误红，而"插到中间"仍然当场红。
   *   牙测（`docs/research/GATE-AUDIT-2026-10-22-qoder.md` §二 14)）：把 beadburst 挪到表中间 ⇒ 末项那条红（实测读成 `defreflectgun`）；
   *   整条不登记 ⇒ 第一条红（实测 `undefined`）；值指到别家 `pickAggro` ⇒ 第一条红（实测读到 `"pickAggro"`）；
   *   **只改排版**（`"beadburst":` 拆两行 + 加注释，语义一字不变）⇒ 仍绿，而旧那两条正则**必然红**（它们要求 `beadburst: 'pickBeadBurst'` 逐字相邻再紧跟 `};`）。 */
  ok(P2_FNAME.beadburst === 'pickBeadBurst', '2P 考卷必须登记 beadburst 且指向 `pickBeadBurst`（实测 ' + JSON.stringify(P2_FNAME.beadburst) + '）');
  /* 注：本来还想加第三条"`Bots[P2_FNAME.beadburst]` 必须是函数"——**没加**：
   *   本门第一行已经钉 `typeof Bots.pickBeadBurst === 'function'`，上面这条又钉 `P2_FNAME.beadburst === 'pickBeadBurst'`，
   *   两条合起来已经蕴含它 ⇒ 单独摆一条只会让"腿数"看着像覆盖面（用户上限句：可以加，但尽量少加）。 */
  eq(P2_NAMES[P2_NAMES.length - 1], 'beadburst',
    'beadburst 必须是**表尾最后一项**（实测末项是 ' + JSON.stringify(P2_NAMES[P2_NAMES.length - 1]) + '，共 ' + P2_NAMES.length +
    ' 项）—— 插在中间会改掉后面每个对手的种子（`20260207 + i*977`）⇒ 历史考卷分全漂移');
  /* ③ 单一来源：G4 那一格必须**复用** bots.js 的函数对象，不许抄第二份实现。 */
  const gd = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(gd.indexOf("'珠爆发(ジ→蓄电珠→电磁炮/摄魂)': B.pickBeadBurst") >= 0,
    'G4 的第 8 格必须直接引用 `B.pickBeadBurst`（抄一份副本 = 同一规则两处维护，本仓栽过四次）');
  /* ⚠️ 这条文本钉**不是**排版洁癖，它挡的是**假绿**：`B` 若没绑上，那一格就是 `undefined`
   * ⇒ `duel` 把该席当"没有 chooser"跑，`autoGameN` 兜底成只出ジ ⇒ **读数看起来更"安全"**，
   * 而实际什么都没测（v1.5.89「把没跑的/没判的当成过了」同族）。行为上无法廉价复现，故用文本钉。 */
  ok(gd.indexOf('const B = sb.window.EpirusBots;') >= 0,
    '前提：gate-drafts 必须真的把 EpirusBots 取出来（否则「珠爆发」格会静默退化成"只出ジ"的**假安全读数**）');
});

t('D116 §N6 修正（v1.5.150 · DS）：2P 切片必须打**2P 强参照**（对多人池 ⇒ 常数 ⇒ 空枪）+ 参照读不出必须响 + 带内候选落盘', function () {
  /* 病（DS 09-22 实测 · `docs/research/logs/RESEARCH-LOG-2026-09-22-ds.md` §2）：切片原来拿多人池 `OPPS` 当 2P 对手，
   * 而现役包对池子脚本在 2P 里**0% 胜率** ⇒ 人人 ≈0 分 ⇒ 该切片是常数 ⇒ 加常数不改变排序
   * ⇒ 第一臂 `v7xn1-31.bak` 与热启动**逐字节相同**（空枪，白跑）。 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf('T.scoreMemberN(params, XN2_OPPS') >= 0,
    '2P 切片必须用参照列表 XN2_OPPS（改成 OPPS 就退回"常数切片"= 空枪）');
  ok(t3.indexOf("EPIRUS_XN2REF || 'js/bundled-champion.js'") >= 0, '默认参照 = 现役 2P 冠军（不设环境变量也得有梯度）');
  /* v1.7.73 · gate-sentinel ③ 分诊：摘掉 `indexOf('拒绝静默退化')`（措辞）；响亮 = `exit 2`，那半句仍在判。 */
  ok(t3.indexOf('process.exit(2)') >= 0,
    '参照包读不出必须**立刻退出**（静默退化正是这次踩的坑）');
  ok(t3.indexOf('-band') >= 0 && t3.indexOf('EPIRUS_BAND_DIR') >= 0,
    '必须带内候选落盘，且目录可指（门才测得了它，且不欠 D82 的账）');
  /* v1.5.150 追加：`exam` 关键词 = 直接用 2P 考卷那 20 个基准当切片对手（与产品判据同表）。
   * 为什么钉：臂 3 的教训是"混入弱对手 ⇒ 信号被平均稀释 ⇒ 退回常数切片"；而考卷基准**全部可打**
   * （现役 2P 冠军对它们 99%）⇒ "对着验收标准训"是唯一能让目标与验收一致的路径，这条接线不许悄悄断。 */
  ok(t3.indexOf("from './p2-baselines.mjs'") >= 0 && t3.indexOf("rp === 'exam'") >= 0,
    'exam 模式必须接**单一来源** p2-baselines（自己抄一份基准表 = 本仓栽过三次的老坑）');
  ok(t3.indexOf('exam:') >= 0 && t3.indexOf('p2-baselines 与 bots.js 漂移') >= 0,
    'exam 模式的基准函数缺失必须响（不许静默少几个对手 ⇒ 验收口径偷偷变窄）');
  /* 行为一：坏参照 ⇒ 训练前就 exit 2（无副作用、不写任何产物）。 */
  const bad = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_XN2W: '1', EPIRUS_XN2REF: 'no/such/pack.bak' }), encoding: 'utf8', timeout: 120000 });
  ok(bad.status === 2, '坏参照必须 exit 2（实测 exit=' + bad.status + '）');
  /* 行为二：迷你臂（1 代 · N=3 · pop 2 · 2P 局 2）写进**临时目录** ⇒ 断言候选落盘 + meta 自证口径。 */
  const dir = mkdtempSync(join(tmpdir(), 'xn2band-'));
  const run = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    /* §E654：这条迷你臂原先只给 `EPIRUS_BAND_DIR`、没给落点 ⇒ 写的是 D123 的基线文件；
     *   而 10-19 它连基线都写不成了——§E589 守卫发现同一粒权重已在 `docs/artifacts/train-3p-out-band1.bak`（手跑残留）⇒ exit 9 ⇒ 本腿"必须跑通"必红。
     *   补上落点两件事一起解决：不再碰共享基线，也不再撞那条残留真身。 */
    { env: Object.assign({}, process.env, { EPIRUS_XN2W: '1', EPIRUS_XN2G: '2', EPIRUS_SUPPORT_PRIOR: '0', EPIRUS_BAND_DIR: dir, EPIRUS_ARM: 'nptest-arm', EPIRUS_T3P_OUT: join(dir, 'nptest-arm.js') }), encoding: 'utf8', timeout: 300000 });
  ok(run.status === 0, '迷你臂必须跑通（exit=' + run.status + '）');
  const bands = readdirSync(dir).filter(function (f) { return /-band\d+\.bak$/.test(f); });
  ok(bands.length > 0, '带内候选必须落盘（实测 ' + bands.length + ' 个）');
  /* 行为二b（v1.5.247）：**目录不存在**时必须自己建，不许静默跳过。
   * 为什么单独钉：上面那条"行为二"用 `mkdtempSync` 先把目录建好了 ⇒ **门自己替被测代码满足了它的前置条件**，
   * 于是 09-26 两批共 52 支臂（把 BAND_DIR 指到没建过的嵌套路径）每支都打 `[band-save] 无 … 目录，跳过`
   * 把带内候选全丢了，而门一直是绿的 —— 这是"用例把前提喂饱"的典型盲区（METHODOLOGY 63 同族）。 */
  const bandRoot = mkdtempSync(join(tmpdir(), 'xn2band2-'));
  const dir2 = join(bandRoot, 'deep', 'nested');
  const run2 = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_XN2W: '1', EPIRUS_XN2G: '2', EPIRUS_SUPPORT_PRIOR: '0', EPIRUS_BAND_DIR: dir2, EPIRUS_ARM: 'nptest-nodir', EPIRUS_T3P_OUT: join(bandRoot, 'out.js') }), encoding: 'utf8', timeout: 300000 });
  eq(run2.status, 0, 'BAND_DIR 不存在时迷你臂仍须跑通（exit=' + run2.status + ' ' + String(run2.stderr || '').slice(0, 80) + '）');
  const bands2 = existsSync(dir2) ? readdirSync(dir2).filter(function (f) { return /-band\d+\.bak$/.test(f); }) : [];
  ok(bands2.length > 0, 'BAND_DIR 不存在 ⇒ 必须**自建嵌套目录**并落盘带内候选（实测目录在场=' + existsSync(dir2) + ' · 候选 ' + bands2.length + ' 个）——'
    + '静默跳过 = 臂"跑成功"但落选证据全丢（09-26 实测丢过 52 支）');
  ok(String(run2.stdout || '').indexOf('目录，跳过') < 0, '不许再出现"无目录，跳过"这条静默退路');
  rmSync(bandRoot, { recursive: true, force: true });
  if (bands.length) {
    const txt = readFileSync(join(dir, bands[0]), 'utf8');
    ok(txt.indexOf('"xn2w":1') >= 0 && txt.indexOf('bundled-champion.js') >= 0,
      'band 产物的 meta 必须自证 2P 口径（权重 + 参照路径），否则没人能追溯"它是跟谁训的"');
  }
  ok(String(run.stdout || '').indexOf('2P对手=ref:bundled-champion.js') >= 0,
    'banner 必须打出 2P 对手（非空枪自检就靠这一行）');
});

t('D118 体检必须并报"产品代理栏"（真桌 1+4 · ε=0.2 soft）—— **只记录不阻断**（v1.5.152 · 用户裁定）', function () {
  /* 病（DS 09-22 §7 实测 · 用户追问"ε=0 下防御 0% 也不是很对吧"）：同一包同一 **ε=0**，
   *   **镜像**装配（5 席同包 · 门禁/体检用的就是它）电磁炮 4.30/局，**真桌**（1 冠 + 4 脚本）只有 0.10/局
   *   ⇒ **装配单独值 43 倍、ε 只值 2 倍** ⇒ 体检打印的贵卡数字是**镜像局特有**的，却被当成"这个包的能力"
   *   （千问 §23 的"4 倍口径差"也是把 ε 与装配混算的结果 ✗）。
   * 用户裁定：把"真桌 + ε=0.2"接进体检，**只记录不阻断**（在它有判别力之前不拦人）。
   * 本条钉四件事：那一栏必须打印 · 必须借 `behavior-profile` 的实现（**单一来源**，不抄第二份）·
   * 必须写明"只记录不阻断"· 可关掉（`EPIRUS_NO_PROXY`）；并守住 `behavior-profile` 的导出/守卫。 */
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf('产品代理栏') >= 0 && pc.indexOf("fieldProfile(params, 0.2, 'soft'") >= 0,
    '体检必须并报产品代理栏（真桌装配 · ε=0.2 soft）');
  ok(pc.indexOf("from './behavior-profile.mjs'") >= 0, '必须借 behavior-profile 的实现（单一来源 —— 本仓"同一份名单抄两遍"栽过三次）');
  ok(pc.indexOf('只记录不阻断') >= 0, '必须写明只记录不阻断（否则读者会以为它参与判定）');
  ok(pc.indexOf('EPIRUS_NO_PROXY') >= 0, '必须能关掉（省时间；也留一条"不装它也能跑"的活路）');
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  ok(bp.indexOf('export function fieldProfile') >= 0 && bp.indexOf('RUN_AS_MAIN') >= 0,
    'behavior-profile 必须导出 fieldProfile、且**被 import 时不跑 main**（否则体检一 import 就把整个剖面跑一遍）');
});

t('D153 产品的探索口径必须钉住（temp0.15 + 档位表给的 ε/epsK/epsMode，默认档那条回合斜坡逐字 0→.05→.1，形状在 bots.js:tierEps、全仓只许有一份）——本夜全部"口径"结论都挂在这一行代码 + DIFF_TIERS 上', function () {
  /* 为什么单独立一条：§H-6/H-10/H-12/H-13 的整串"评测口径 ≠ 产品口径"结论，**唯一的凭据就是 `ui.js` 里那一次调用**；
   *   而那行没有任何门钉着（D111/D118 钉的是探索规则与代理栏存在，不钉这四个值）。⇒ 有人调了它，全夜的读数就失去所指。
   * v1.5.298（用户 09-29 裁定）：5 人槽的 ε 从常数 0.2 改成**按回合斜坡 0 → 0.1 → 0.2**。
   *   本门跟着改钉法，**但钉的还是同一件事**：玩家实际看到的探索口径必须写死在这一处、不许被静默改动。
   *   为什么第 1 回合那个 `0` 值得单独一条断言：§E145 量到首手防御 14.91%±0.18 **全部**来自 ε（ε=0 ⇒ 0.00%，
   *   近贪心 ⇒ 0.00%，只压温度 ⇒ 与现役逐字同局），而那一回合**结构性地不可能挡到任何东西**
   *   （攻击卡 ≥1 ジ 而人人 ep=0；架势只活本回合）⇒ 那个 0 是"首手不白站架势"的唯一防线。 */
  const ui = readFileSync('js/ui/ui.js', 'utf8');
  ok(/Trainer\.pickChampion\(state, pid, legalForAI, c, 0\.15, epsForTier, tier\.epsK, tier\.epsMode\)/.test(ui),
    '冠军路径必须是 temp0.15 + **取自档位表**的 (eps, epsK, epsMode) ⇒ 这是本仓唯一一份"玩家实际看到的探索口径"。' +
    'v1.6.6 前这一行末尾写死 `5, \'soft\'`，现在那个 5/soft 住在 `Bots.DIFF_TIERS` 里（默认档仍是 k5/soft，由 D227②c 钉住值）');
  /* ===== v1.6.65（10-12 晚）：斜坡的字面值从 ui.js 搬进 `js/train/bots.js` 的 `tierEps(tier, round)` =====
   * 为什么搬：原来 ui.js 与 `tools/probe-diff-ladder.mjs` **各抄一份**这条斜坡，而这份门只钉 ui.js 那一份
   *   （旧注释自己就写着"这里改了不响门"）。10-12 下午把顶点从 0.2 降到 0.1 时只改到了页面那份 ⇒
   *   量具仍在 0/0.1/0.1 上出数，而 b5ceab1 的在册阶梯账正是那批数 —— 这就是"两份实现"的代价，实测发生过一次。
   * ⇒ 钉法跟着搬，**钉的还是同一件事**：斜坡必须逐字 0 / 0.05 / 0.1，不许悄悄变回常数；多加的是"全仓只许有一份"。 */
  const botsSrc = readFileSync('js/train/bots.js', 'utf8');
  ok(/function tierEps\(tier, round\)[\s\S]{0,200}?return round <= 1 \? 0 : \(round === 2 \? 0\.05 : tier\.eps\);/.test(botsSrc),
    'ε 的回合斜坡必须逐字是 0 / 0.05 / 0.1，而且**住在 `bots.js:tierEps` 里**（形状来自用户 09-29 裁定"第 1~3 回合逐步提升"；'
    + '顶点 0.2→0.1 是用户 10-12 16:4x 裁定「普通和困难调成 0.1，简单 0.2」）⇒ 改回常数 .2 就把 §E145 那条 14.91% 的白站防御放回来');
  ok(/Bots\.tierEpsAt\(tier, state\.p\.length, state\.round\)/.test(ui) && !/tier\.eps2\s*!==\s*undefined/.test(ui),
    '页面必须**调用**那一份（不是自己再写一遍形状）⇒ 抄一份就会漂移，而抄的那份往往在量具手里、不在门手里。' +
    '⚠ §E625 重钉：斜坡之上还有"几个人才用 `eps2`"这一层，它以前**只活在页面那行的三元里**（注释还写着"这是页面才知道的事"），'
    + '结果两把量具各自直接吃 `tier.eps` ⇒ 它们在 2 人桌上量的是产品不喂的那份剂量（简单 0.2 而不是 0.5 ‖ 困难 0.1 而不是 0）。'
    + '现在这条规则住在 `bots.js:tierEpsAt`，页面与两把尺都只调用它 ⇒ 这里同时判"页面不许再把 `eps2` 的挑选写回本地"');
  const botsForAt = readFileSync('js/train/bots.js', 'utf8');
  ok(/function tierEpsAt\(tier, nPlayers, round\)/.test(botsForAt),
    '§E625：人数那层必须**只有一份定义**（`bots.js:tierEpsAt`）⇒ 没有这条定义，上面那条"页面必须调用它"就是空话');
  const probeSrc = readFileSync('tools/probe-diff-ladder.mjs', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(/Bots\.tierEpsAt\(/.test(probeSrc) && !/\bround\s*===\s*2\s*\?/.test(probeSrc),
    '阶梯尺必须走 `Bots.tierEpsAt`（§E625 前钉的是 `Bots.tierEps`，但那一份不读人数 ⇒ 2 人桌读数与产品脱节；钉法跟着搬，判的还是同一件事）'
    + '，且**代码里不许再出现第二个回合三元组**（剥掉注释后判：注释里写"为什么搬走"是合法的，代码里写形状就是漂移的源头）');
  const censusSrc = readFileSync('docs/debug/tier-census.mjs', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  /* ⚠ 这条腿第一版只判"文件里出现过 `B.tierEpsAt(`"⇒ **变异实验当场把它打掉**：把取值那行换回 `t.eps` 之后门仍然绿，
   *   因为表头打印那句也调了同一个函数 ⇒ "出现过"不等于"用在承重的那一行上"（本仓反复栽的那一族：判在字符串上，不判在接线点上）。
   *   ⇒ 改成钉**赋值点**：`const EPS0 = B.tierEpsAt(`。 */
  ok(/const EPS0 = B\.tierEpsAt\(/.test(censusSrc),
    '§E625 同一条病的第二台：普查尺的**剂量取值那一行**必须走 `B.tierEpsAt(档, 人数, 回合)`（它原来直接 `t.eps` ⇒ 2 人桌那批"谱"读数吃的是产品的 0.2/0.1 而不是 0.5/0）');
  /* ===== v1.6.6 改钉法（用户指令 1/2：2 人并进多人、难度做成一条阶梯）=====
   * 旧的第二条断言钉的是"2 人困难槽 = ε=0"那一行（`pickChampion(state, 1, ..., 0.15)`），那行已随 2 人专属 AI 路径一起删了。
   * 现在"产品口径"仍然不是一个数，但**来源变了**：一条阶梯上的不同档 ⇒ 报数要指明**档 id**，而不是"哪个槽"。
   * ⚠ 这里改钉"两行不许并存 + 贪心档在表里"，因为那才是"口径只有一个真源"的可执行内容；旧文案留在 METHODOLOGY §54（同一处同步改）。 */
  ok(!/pickChampion\(\s*state,\s*1\s*,/.test(ui),
    '页面不许再有**第二条**冠军调用（写死 `state, 1,` 的那种 2 人专属路径）⇒ 两条路 = 两份口径，历史读数就得先问"哪条"');
  /* ⚠ 这条原来钉"表里还有一档 `eps: 0`（贪心冠军）"，但 10-12  dose 改动后**表里已经没有 ε=0 的五人桌档**了，
   *   而它照样绿 —— 因为正则 `eps:\s*0\b` 会把 `eps: 0.1` 也算命中（`0` 与 `.` 之间就是词边界）。
   *   这是"正则太松 = 假绿"的现行标本，改钉成今天真正的下界：**2 人桌那一档必须有一个 ε=0 的贪心档**
   *   （§E286：2 人桌没池 ⇒ 那里的难度只能靠剂量，而 ε=0 是"完全不探索"的下界，训练场/考卷量的就是它）。 */
  ok(/kind:\s*'champ',[\s\S]{0,220}?\beps2:\s*0\b/.test(readFileSync('js/train/bots.js', 'utf8')),
    '阶梯里必须还有一档 **2 人桌 ε=0**（贪心冠军下界）⇒ 2 人桌没有池，那里"难度"就是剂量，而 ε=0 是"完全不探索"的下界；'
    + '它一旦从表里消失，"评测口径 vs 产品口径"这句话在 1v1 上就没人能兑现了');
  /* ⚠ **故意剥块注释后再判**：修复说明里必须写出那个坏名字（`DN.hard.pick`），不剥注释就是"因为解释了 bug 而红"。
   *   同一族第三次踩（D226⑤c / ③b / 这一条）⇒ 记进门禁编辑坑：静态钉判"取用"，注释豁免。 */
  const uiCode = ui.replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(!/\bDN\.\w+/.test(uiCode) && /function fallbackPickFor/.test(ui),
    '回退腿 冠军缺失时的兜底必须是**定义得住**的名字：代码里的 `DN.hard.pick` 那个死引用自 v1.3.22 就在（声明被同一提交删了，走进分支是 ReferenceError 而不是"显式回退"）');
  const fbBody = String((ui.match(/function fallbackPickFor[\s\S]{0,300}?\n  \}/) || [''])[0]);
  const fbNames = [];
  const fre = /Bots\.([A-Za-z_]\w*)/g;
  let frm; while ((frm = fre.exec(fbBody)) !== null) fbNames.push(frm[1]);
  ok(fbNames.length >= 2, '回退腿 兜底函数里必须真写出脚本名（实测拿到 ' + fbNames.join('/') + '）⇒ 空函数体 = 这条腿是装饰');
  const fbBad = fbNames.filter(function (k) { return typeof (Bots || {})[k] !== 'function'; });
  eq(fbBad.length, 0, '回退腿 兜底引用的脚本必须**真的在 `EpirusBots` 上**（否则又是"回退到不存在的名字"，与 DN 那个坑同形）：' + fbBad.join(','));
  /* （原来还钉 METHODOLOGY 里"评测口径 + 档 id/DIFF_TIERS"那一段必须在 —— v1.6.12 删除，理由见第 89 条。
   *   口径这件事的真凭据在下面两条：代理栏与门禁输入必须**仍可分辨**（0.2 soft ‖ ε=0）。） */
  /* 反向钉：代理栏与门的输入必须**仍可分辨**（代理栏用 0.2 soft，门禁输入用 ε=0） */
  const pr = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(/fieldProfile\(params, 0\.2, 'soft'/.test(pr), 'D118 的产品代理栏必须继续显式带 0.2/soft（它存在的意义就是"另一口径"）');
  /* ===== v1.5.304（用户 09-29 下午委托裁定）：`evo.js` 那道"剔掉防御键"的门槛 = ≥1 =====
   * 这条钉的不是 ui.js 的 ε 调度，而是**同一口径的另一半**：`soft` 的探索池里到底能不能出现防御键。
   * 旧档（≥2）在"非防御只剩 ジ 一张"的回合里整条豁免 ⇒ §E145 仪器直读：ε 注入的防御占第 1 回合 100%、
   * 第 3 回合 58.56%、第 4+ 74.73% ⇒ 页面上的防御约四分之三是噪声。
   * ⚠ 两条断言都要**能红**（"夹具缺对比度让新门变装饰"是本仓踩过的坑）：
   *   仓库档必须 0.00%，而**同一把探针把门槛退回 ≥2 必须照出 ≈15%** ⇒ 缺了后一条，前一条在"探针根本没跑起来"时也会绿。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(/if \(nonDef\.length >= 1\) pool = nonDef;/.test(ev),
    '探索池"剔掉防御键"的门槛必须是 `>= 1`（v1.5.304 用户裁定）');
  ok(!/if \(nonDef\.length >= 2\) pool = nonDef;/.test(ev),
    '旧门槛 `>= 2` 不许复活：它让"非防御只剩一张"的那些回合整条豁免失效（§E145：那是首手白站防御的唯一来源）');
  const repoRun = spawnSync(process.execPath, ['tools/probe-round1-open.mjs', '--packs=js/bundled-champion-3p.js',
    '--games=200', '--configs=ui', '--draws=4000'], { encoding: 'utf8', timeout: 600000 });
  eq(repoRun.status, 0, '探针（仓库档）要跑得通（stderr=' + String(repoRun.stderr || '').slice(0, 200) + '）');
  const mRepo = /防御合计 ([0-9.]+)%/.exec(String(repoRun.stdout || ''));
  ok(mRepo, '探针必须印出"[A/ui] … 防御合计 x%"那一行（格式变了就要同步这里的正则，别让它静默变成"没找到=通过"）');
  eq(Number(mRepo[1]), 0, '仓库档的第 1 回合防御必须**恰好 0.00%**（≥1 门槛下探索池={ジ}，ε 是空操作）');
  ok(/机制吻合/.test(String(repoRun.stdout || '')), '探针自带的机制预测必须吻合（预测 0.00% ‖ 实测 0.00%）⇒ 不吻合说明防御另有来源，这条改动没治到病根');
  const oldRun = spawnSync(process.execPath, ['tools/probe-round1-open.mjs', '--packs=js/bundled-champion-3p.js',
    '--games=200', '--configs=ui', '--draws=4000', '--filterge2=1'], { encoding: 'utf8', timeout: 600000 });
  eq(oldRun.status, 0, '探针（旧档对照）要跑得通（stderr=' + String(oldRun.stderr || '').slice(0, 200) + '）');
  const mOld = /防御合计 ([0-9.]+)%/.exec(String(oldRun.stdout || ''));
  ok(mOld && Number(mOld[1]) >= 8, '旧档（门槛退回 ≥2）必须照出**非零**的首手防御（实测 ' + (mOld ? mOld[1] + '%' : '读不到') +
    '，§E145 的历史读数是 14.91%±0.18）⇒ 它为 0 说明 `--filterge2` 那条补丁没生效，上面 0.00% 那条就成了空断言');
  ok(/剔掉防御键"因 nonDef=1 <2 而\*\*没生效\*\*/.test(String(oldRun.stdout || '')),
    '旧档那遍必须把"剔除没生效"写在机制预测行里（这半句是"对照真的走到那条分支"的凭据）');
});
t('D155 设防持续性栏必须**只记录不阻断**，且配对表的解析只有 defense-axis.mjs 一处', function () {
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  const ax = readFileSync('tools/defense-axis.mjs', 'utf8');
  ok(pc.indexOf('设防持续性栏') >= 0 && /EPIRUS_NO_GUARD/.test(pc), 'promote 必须印这一栏，且给一条能关掉省时间的开关');
  ok(pc.indexOf("from './defense-axis.mjs'") >= 0 && ax.indexOf('export function parsePairTable') >= 0,
    '解析必须单一来源：promote 里不许有第二份 parsePairTable（同 D150 的"搬运不许各写一份"）');
  ok(pc.indexOf('createState') < 0, 'promote 的新栏**不许自己仿真** —— 只 spawn 探针再解析（自己搭桌子必然与探针漂移）');
  /* §删（2026-10-16 · v1.7.72 · gate-sentinel ③ 分诊）：这里原来钉的是 `tools/defense-axis.mjs` **源码里的中文**
   *   （`indexOf('不许按 0 处理')`）—— 既是②（对源码做正则）又是③（钉措辞）。它要保的语义是
   *   「解析不出行时必须说**没量到**，不许静默回 0」；**同一件事已经有行为版**：D163 那条拿 `null` 真调
   *   `formatQualityRecord(null, {})`，判「含 没量到」且「不含 0.0%」⇒ 本条是**重复的文本版**，摘掉不丢牙口。 */
  /* ① 固定样本回归：第一版把 Δ 读成了"跨种子极差"（每粒种子列有 1~3 个数，按空白切下标就串位） */
  const SAMPLE = ['   包                      placebo    hold均%  cycle均%      Δpt  每粒种子Δ                 极差   判定',
    '   cbs1s2-band2                2 粒      37.2      13.7     +23.5  +22.0 +25.1       3.1   钱驱动（高，≥18pt）',
    '   v7cmin4-31                  单粒       5.5       4.4      +1.6  +1.6                    —    非钱驱动（≤12pt）'].join('\n');
  const parsed = parsePairTable('# 同回合配对（占位表头）\n' + SAMPLE);
  eq(parsed.length, 2, '两行都得解析出来（实际 ' + parsed.length + '）');
  eq(parsed[0].delta, 23.5, 'Δ 必须取 Δpt 那一列，不是极差（v1.5.222 第一版就在这串了位）');
  eq(parsed[0].spread, 3.1, '跨种子极差要单独拿到（判"线落在不落在噪声里"用的就是它）');
  eq(parsed[1].delta, 1.6, '单种子行（极差列是 —）也要解析对');
  ok(!isFinite(parsed[1].spread), '单种子时极差必须是 NaN 而不是 0（0 会被读成"完全稳定"）');
  eq(parsed[0].hold, 37.2, 'hold 均%'); eq(parsed[0].cycle, 13.7, 'cycle 基线%（= 水平轴）');
  /* ② 真链：小样本跑探针 → 同一份解析 → 必须是有限数 + 有判定文案 */
  const one = 'docs/artifacts/cbs1s2-band2.bak';
  const rr = spawnCached(['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=25', '--pair=1', '--seeds=2'], { encoding: 'utf8' });
  eq(rr.status, 0, '探针要跑得通');
  const rows = parsePairTable(rr.stdout);
  ok(rows.length >= 1 && isFinite(rows[0].delta) && rows[0].verdict.length > 0,
    '真表必须解析出有限 Δ 与判定文案（解析 0 行 = 探针换了列序而没人发现，正是本门要防的）');
  /* ③ 行为式铁证：开/关这一栏，promote 的其余输出与退出码必须**逐字相同**（"只记录"不许是口头承诺） */
  const on = spawnCached(['tools/promote-champion.mjs', one, '--dry', '--skip-gate-drafts'], { encoding: 'utf8' });
  const off = spawnCached(['tools/promote-champion.mjs', one, '--dry', '--skip-gate-drafts'], { encoding: 'utf8', env: Object.assign({}, process.env, { EPIRUS_NO_GUARD: '1' }) });
  eq(on.status, off.status, '退出码必须一致（实测 ' + on.status + ' vs ' + off.status + '）⇒ 这栏不许改变判定');
  const strip = x => String(x || '').split(/\r?\n/).filter(l => l.indexOf('设防持续性栏') < 0).join('\n');
  eq(strip(on.stdout + on.stderr), strip(off.stdout + off.stderr), '去掉这一行后两次的全部输出（含 stderr 里的阻断结论）必须逐字相同');
  ok((on.stdout + on.stderr).indexOf('G 有效技能数') >= 0 || on.status === 0, '顺带确认这次 dry-run 真走到了门结论（阻断文案在 stderr，别只拼 stdout）');
});



t('D163 防御质量三档（用户 09-26 裁定：白防 / 被穿透=半 / 有效）必须**判在事件语义上**、单一来源、且 promote 那栏只记录不阻断', function () {
  /* 用户给的判据形状很具体："出防御的时候完全没人打他就算白防御了（被穿透算防御半有效）"
   * ⇒ 三档全靠**回合结算窗里的事件语义**判，所以本门喂**合成窗口**（不靠真跑一局去"希望碰上"某种局面）。
   * 会骗人的三种写法都被下面钉死：① 把梦魇/连环/违约/血债这些**非卡伤害**当成"有人打我"（⇒ 白防被误判成半有效）；
   *   ② 把自损（`source === 我`）算成攻击；③ 解析不到行时回 0（0 会被读成"这包不白防"—— 与 D155 同族）。 */
  const Rk = R;
  const ATKK = Object.keys(Rk.byKey).find(k => Rk.byKey[k] && Rk.byKey[k].cat === Rk.CAT.ATTACK);
  ok(!!ATKK, '载体：得有一张攻击卡当 `via`（合成窗口用它表示"有人朝我来"）');
  eq(classifyDefenseWindow([], Rk, 0), 'idle', '空窗（那一回合没人朝我来）⇒ 白防');
  eq(classifyDefenseWindow([{ type: 'blocked', to: 0, by: '防御', via: ATKK }], Rk, 0), 'eff', '挡下一次 ⇒ 有效');
  eq(classifyDefenseWindow([{ type: 'reflect', to: 0, from: 2, via: ATKK }], Rk, 0), 'eff', '弹回也算有效');
  eq(classifyDefenseWindow([{ type: 'damage', to: 0, source: 2, via: ATKK, amt: 1 }], Rk, 0), 'part', '被卡打穿 ⇒ 半有效');
  eq(classifyDefenseWindow([{ type: 'damage', to: 0, source: 2, via: '梦魇', amt: 0.5 }], Rk, 0), 'idle',
    '`via` 不是一张真卡（梦魇/连环/违约/血债）⇒ **不许**算"有人打我"（这是 `landByKey` 含非卡键那族事故的镜像）');
  eq(classifyDefenseWindow([{ type: 'damage', to: 0, source: null, via: ATKK, amt: 1 }], Rk, 0), 'idle', '`source` 为空的地形伤不算攻击');
  eq(classifyDefenseWindow([{ type: 'damage', to: 0, source: 0, via: ATKK, amt: 1 }], Rk, 0), 'idle', '自损（打自己）不算"有人朝我来"');
  eq(classifyDefenseWindow([{ type: 'damage', to: 1, source: 2, via: ATKK }], Rk, 0), 'idle', '打别人不算招呼我');
  eq(classifyDefenseWindow([{ type: 'blocked', to: 0, by: '防御', via: ATKK }, { type: 'damage', to: 0, source: 2, via: ATKK }], Rk, 0), 'eff',
    '一回合里既挡到又被穿透 ⇒ 记"有效"（它确实挡下了东西，不许两档重复计）');
  const qq = defenseQuality({ eff: 2, part: 2, idle: 6 });
  ok(Math.abs(qq.q - 0.3) < 1e-12, '质量分 = (有效 + 0.5×半) / 手数 ⇒ 2/2/6 应为 0.30（实测 ' + qq.q + '）');
  ok(isNaN(defenseQuality({ eff: 0, part: 0, idle: 0 }).q), '没量到防御手 ⇒ NaN，**不许是 0**');
  const line = formatQuality(defenseQuality({ eff: 3, part: 1, idle: 6 }));
  const back = parseQuality(line);
  ok(back && Math.abs(back.q * 100 - 35) < 0.051 && back.n === 10,
    '打印器与解析器必须闭环（producers/consumers 一份契约）：' + JSON.stringify(back));
  ok(formatQualityRecord(null, {}).indexOf('没量到') >= 0 && formatQualityRecord(null, {}).indexOf('0.0%') < 0,
    '读不到时必须明说"没量到"，不许印成 0.0%（0 会被读成"这包不白防"）');
  /* 真链：探针跑得出这一行，且数字落在合法区间 */
  const one = 'docs/artifacts/cbs1s2-band2.bak';
  const pr = spawnCached(['tools/probe-wasted-play.mjs', '--packs=' + one, '--games=20', '--quiet=1', '--assembly=banker'], { encoding: 'utf8' });
  eq(pr.status, 0, '探针要跑得通（status=' + pr.status + '）');
  const pq = parseQuality(pr.stdout);
  ok(pq && pq.n > 0 && pq.q >= 0 && pq.q <= 1, '真跑必须解析出有限质量分与 >0 的手数（解析 0 行 = 探针改了列序而没人发现）：' + JSON.stringify(pq));
  /* 行为式铁证：开/关 promote 这一栏，其余输出与退出码逐字相同（"只记录"不许是口头承诺） */
  const on = spawnCached(['tools/promote-champion.mjs', one, '--dry', '--skip-gate-drafts'], { encoding: 'utf8' });
  const off = spawnCached(['tools/promote-champion.mjs', one, '--dry', '--skip-gate-drafts'],
    { encoding: 'utf8', env: Object.assign({}, process.env, { EPIRUS_NO_DEFQ: '1' }) });
  eq(on.status, off.status, '退出码必须一致（' + on.status + ' vs ' + off.status + '）⇒ 这栏不许改变判定');
  const stripQ = x => String(x || '').split(/\r?\n/).filter(l => l.indexOf('防御质量栏') < 0).join('\n');
  eq(stripQ(on.stdout + on.stderr), stripQ(off.stdout + off.stderr), '去掉这一行后两次的全部输出（含 stderr 的阻断结论）必须逐字相同');
  ok(on.stdout.indexOf('防御质量栏') >= 0 && on.stdout.indexOf('只记录不阻断') >= 0, '这一栏必须印出来，且自己说清"只记录不阻断"');
  ok(readFileSync('tools/probe-wasted-play.mjs', 'utf8').indexOf("from './defense-quality.mjs'") >= 0,
    '探针与 promote 必须共用同一个分类器（不许两处各写一遍"什么算打到我"）');
});

t('D107 G4「1 席脚本 vs 4 席被测」装配只许有一份实现（v1.5.133 收拢）', function () {
  /* 病：该装配原先**只写在 gate-drafts 内部** ⇒ 任何"想解剖 G4 到底输在哪"的探针只能抄一份
   * （本仓"同一规则两处维护必然漂移"栽过四次）。现在它在 `tools/v2v4-lib.mjs` 的 `duelAssembly()`，
   * gate-drafts 与 `probe-g4-anatomy.mjs` 共用。重构的验收 = G4 全表逐字不变（已对 `g4-check.log` 全部对账）。 */
  const gd = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(gd.indexOf("from './v2v4-lib.mjs'") >= 0, 'gate-drafts 必须从 v2v4-lib.mjs 导入（装配单一来源）');
  ok(gd.indexOf('duelAssembly(') >= 0, ' 且真的调用它');
  ok(gd.indexOf('function duel(') >= 0, ' 但保留 duel() 薄壳（调用点与判词一字不动）');
  ok(gd.indexOf('h32(seed0 + g * 2246822519)') < 0, '装配本体不许再出现在 gate-drafts 里（否则又成两份）');
  const lib = readFileSync('tools/v2v4-lib.mjs', 'utf8');
  ok(lib.indexOf('export function duelAssembly') >= 0, 'v2v4-lib 必须导出 duelAssembly');
  ok(lib.indexOf('forceAttack') >= 0 && lib.indexOf('forceTurtle') >= 0, ' 且带双向反事实钩子');
  /* v1.5.134：这一轮真正的载重列是**伤害归属**（跨 13 个包 r = −0.82；"攒钱比例"只有 +0.23）
   * ⇒ 钩子与那一列计数都得在，否则下次读 G4 又会退回到"看分数猜原因"。 */
  ok(lib.indexOf('aimGunner') >= 0, ' 且带「只改目标」的单杠杆（v1.5.134 实测：主因是瞄准，不是花钱）');
  ok(lib.indexOf('dmgToScriptedPerGame') >= 0, ' 且统计"打在脚本席（枪手）身上的伤害" —— 那一格相关性最强的一列');
  const pg = readFileSync('tools/probe-g4-anatomy.mjs', 'utf8');
  ok(pg.indexOf('dmgToScriptedPerGame') >= 0, '解剖探针必须打印"打在枪手身上 X/局"（否则看不到主因那一列）');
  const pb = readFileSync('tools/probe-g4-anatomy.mjs', 'utf8');
  ok(pb.indexOf("from './v2v4-lib.mjs'") >= 0, '解剖探针必须从单一来源导入装配');
  ok(pb.indexOf('EXPECT') >= 0 && /EXPECT = \{ long: 38, multi: 35 \}/.test(pb),
    '探针必须自带"复现 G4 在位包记录值"的自检（现役 v7cmin4-31：long 38 / multi 35）—— 装配错了就不许读后面的数');
  /* v1.5.205 校正：这条钉原先写死 `long: 75 / multi: 62`，那是 **v1.5.144 之前**那件线上包的读数
   * ⇒ 常量不随换包走，后果不是"数字旧"，而是**每次跑都自证「⛔ 复现失败 ⇒ 下面的读数先别读」**（一个好量具被自己的记账废掉）。
   * 所以这里除了钉数值，还必须钉"来历写清楚"（包名 + n + 日期），换包时漏改就会红 —— 文本钉反过来当防腐用。 */
  ok(/现役 `v7cmin4-31`（v1\.5\.144 上槽）实测 38% \/ 35%/.test(pb) || /现役 `v7cmin4-31` 在同一装配、同一 seed、n=60 上是 \*\*long 38% \/ multi 35%\*\*/.test(pb),
    'EXPECT 旁边必须写清"这个值属于哪件在位包 + n"（否则下一次换包又会把它变成永久自检失败）');
  ok(pb.indexOf('75%/62%') < 0, '历史数字 75%/62% 不许再被当成"当前在位包的记录值"引用（它属于 v1.5.144 之前那件包）');
});

t('D110 冠军包解析单一来源：吃得下产物 .bak 外壳 / 纯 JSON / 垃圾必拒（页面「导入冠军包」的底座）', function () {
  /* v1.5.141（用户要求）：页面的「导入」原本只吃自己导出的 JSON，而训练产物是
   * `window.EPIRUS_CHAMPION[_3P] = {…};` 外壳 ⇒ 候选包没法直接拿去实机试。剥壳逻辑单一来源在
   * `js/champion-pack.js`（纯函数、不碰 DOM）。这条门**真跑一遍**：拿仓里 tracked 的真 bundle 当输入。 */
  const src = readFileSync('js/champion-pack.js', 'utf8');
  ok(src.indexOf('EPIRUS_CHAMPION(_3P)?') >= 0, '必须认产物的 window.EPIRUS_CHAMPION[_3P] 外壳');
  const html = readFileSync('index.html', 'utf8');
  ok(html.indexOf('js/champion-pack.js') >= 0, 'index.html 必须加载 champion-pack.js（否则页面里 undefined ⇒ 静默失效）');
  ok(html.indexOf('.bak') >= 0, '文件选择器必须收 .bak（否则用户选不到产物）');
  ok(readFileSync('js/ui/ui.js', 'utf8').indexOf('EpirusChampionPack') >= 0, 'ui.js 的导入必须走这个单一来源');
  /* 真跑：真 bundle ⇒ 外壳形态与纯 JSON 形态**逐字节相等**；垃圾必拒。 */
  const box = { console: console, Math: Math, JSON: JSON, Object: Object, Array: Array, Number: Number, String: String, Error: Error, isNaN: isNaN };
  box.window = box; box.globalThis = box;
  vm.runInNewContext(src, box, { filename: 'js/champion-pack.js' });
  const X = box.EpirusChampionPack;
  ok(X && typeof X.extract === 'function', '必须导出 extract');
  const a = X.extract(readFileSync('js/bundled-champion-3p.js', 'utf8'));
  ok(a.ok && a.slot === '3p' && a.source === 'bundle', '真 3P bundle 必须解析成 slot=3p（实测 slot=' + a.slot + '）');
  const b = X.extract(JSON.stringify(a.pack));
  ok(b.ok && JSON.stringify(b.pack) === JSON.stringify(a.pack), '纯 JSON 形态必须与外壳形态逐字节相等（保真）');
  ok(X.extract('这不是包').ok === false, '垃圾文本必须被拒（不许塞个空 pack 进槽）');
  ok(X.extract('/* 注释 */\nwindow.EPIRUS_CHAMPION = {"v":7,"params":[1,2]};\n').slot === '2p', '2P 外壳（含前置注释）必须判成 2p');
});

t('D146 G4 `--force` 越线例外的判定必须是被**覆盖**的纯函数（v1.5.202）：它原来只在"在位包 G4 红了"那天才求值', function () {
  /* 病（门层审计）：`ok(refPassG4 || g4recOk, …)` 被 `refPassG4` 短路 —— 现役包 G4 有模式 PASS（常态）⇒
   * `implOk`/`g4recOk` 整段**从未被求值**，第一次真正运行会发生在"正要发一只过不了门的冠军"的那次提交里。
   * 现在判定是 `tools/gate4-exception.mjs` 的纯函数 ⇒ 这里用**合成 meta** 把每种组合跑一遍。 */
  const good = { forced: true, pool: 'p1', impl: 'i1', lines: ['G4[foo/multi] 无一行脚本能以 >60% 击败它'], ts: 't' };
  ok(g4ExceptionOk('i1', 'p1', good), '齐全的例外必须认（forced + pool 匹配 + impl 匹配 + 带 G4 行）');
  ok(!g4ExceptionOk('i1', 'p1', Object.assign({}, good, { forced: false })), 'forced=false 不许认');
  ok(!g4ExceptionOk('i1', 'p1', Object.assign({}, good, { lines: [] })), '没有"被放过的具体行"不许认（记了账但不知道记了什么）');
  ok(!g4ExceptionOk('i1', 'p1', Object.assign({}, good, { lines: ['G5[x] 别的门'] })), 'lines 第一行不是 G4[ 不许认');
  ok(!g4ExceptionOk('i1', 'p2', good), '口径 id（pool）不匹配不许认 —— 克制表键序/阈值变过，旧例外当场失效');
  ok(!g4ExceptionOk('i2', 'p1', good), '实现身份（impl）不匹配不许认 —— 改过任何一格，豁免随 id 作废');
  ok(!g4ExceptionOk(null, 'p1', good), '读不出当前 G4IMPL 时不许认');
  ok(!g4ExceptionOk('i1', 'p1', null), 'meta 里根本没有 gate4Forced 不许认');
  const old = { forced: true, pool: 'p1', lines: ['G4[foo/multi] x'], ts: 't' };
  ok(g4ExceptionOk(G4FROZEN, 'p1', old), '无 impl 字段的旧留痕 + 当前实现 == 冻结版 ⇒ 放行（一次性迁移垫脚）');
  ok(!g4ExceptionOk('deadbeef', 'p1', old), '无 impl 字段 + 当前实现已变 ⇒ 豁免作废');
  const nt = npSourceAll();   /* v1.7.8：D67 的门体现住 tools/gates/** ⇒ 判据落在**全部门体文件**上 */
  ok(nt.indexOf('g4ExceptionOk(curImpl, curPool, g4rec)') >= 0, 'D67 必须调用纯函数（判定的单一来源，不许再抄一份）');
});

t('D147 UNRUN 必须有**处置语义**且按方向分（v1.5.202）：原来它从不进 fails ⇒ 基线退化的候选可零阻断通过', function () {
  /* 病（门层审计）：`promote-champion` 把 UNRUN 单独收集、醒目打印"不得当作通过"，却**从不送进 `fails`**
   * ⇒ 一个"基线退化、整格不可判"的候选能零阻断通过，全靠一句 print 兜着，而门只钉了那句话的**文本**。
   * 但不能无脑阻断：G4 的可判窗口 [8%,32%] 把两个**相反**方向合并了 ——
   *   `base.win < 8%` ⇒ 候选压着克制表打（**强包**形状，阻断它会把最强的候选挡在门外）；
   *   `base.win > 32%` ⇒ 候选打不过最弱的克制脚本（**真缺陷**被"不可判"这个措辞盖住了）。
   * ⇒ 弱 = 只记录；强 / 缺 = 阻断；参照行与参照行的 FAIL 同待遇（只记录）。 */
  eq(unrunDisposition(UNRUN_KINDS.WEAK, false).blocking, false, '基线太弱（候选压着克制表打）⇒ 只记录（否则会把最强候选挡掉）');
  eq(unrunDisposition(UNRUN_KINDS.STRONG, false).blocking, true, '基线太强（候选打不过最弱脚本）⇒ 必须阻断');
  eq(unrunDisposition(UNRUN_KINDS.MISSING, false).blocking, true, '读不出基线 ⇒ 未知，保守判红（同 audit-lib 探针缺失守卫）');
  eq(unrunDisposition(null, false).blocking, true, '未知种类（旧格式）⇒ 保守判红');
  eq(unrunDisposition(UNRUN_KINDS.STRONG, true).blocking, false, '**参照行**的 UNRUN 与参照行的 FAIL 同待遇：只记录、不阻断');
  eq(unrunDisposition(UNRUN_KINDS.WEAK, true).blocking, false, '参照行 + 弱 ⇒ 同样只记录');
  /* 静态：三处必须真的接通（出方向 / 按方向判 / 不再是"一律只打印"） */
  const g3 = readFileSync('tools/gate-drafts.mjs', 'utf8');
  const pc3 = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(g3.indexOf("'弱' ") >= 0 && g3.indexOf('unrunKind') >= 0, 'gate-drafts 必须算出方向（弱/强/缺）');
  ok(pc3.indexOf('uD.blocking') >= 0 && pc3.indexOf('unrunDisposition(') >= 0, 'promote 必须按方向把阻断项送进 fails');
  /* v1.5.202：**被打穿**必须优先于**不可判** —— 否则真 FAIL 会被 UNRUN 盖住。
   * 实测（本轮扫 12 个真实候选）：`v7xn8c-31-band4` 的 multi 格最克脚本 **65% > 60%**（真 FAIL），
   * 却因为**基线那格**退化（0%）而整格报 UNRUN ⇒ 旧口径下它零阻断通过。 */
  ok(g3.indexOf('const hardFail = worst[1] > G4_MAX;') >= 0 && g3.indexOf('const isUnrun = !hardFail && !judgeable;') >= 0,
    '被打穿必须优先于不可判（UNRUN 不许盖住真 FAIL）');
  ok(pc3.indexOf('【阻断】') >= 0 && pc3.indexOf('【只记录】') >= 0, '输出必须能分辨「阻断」与「只记录」，不许含糊成一句「不得当作通过」');
});

t('D168 包 META 的读取必须扛得住**嵌套**与**线上槽的手改损坏**（v1.5.255 · 本班撞上的两个真缺陷）', function () {
  /* 病一（嵌套截断）：旧代码用懒惰正则 `(\{[\s\S]*?\})` 抽 JSON ⇒ 对象里有嵌套时在**第一个** `}` 就截断。
   *   v1.5.226 给 META 加了 `recipe.env` ⇒ 这个形状真实存在（713 那种平铺 meta 恰好不触发）。
   * 病二（线上槽真的坏了）：`js/bundled-champion-3p.js` 与 `js/bundled-champion.js` 的 META 都**少了
   *   `fingerprintRefresh` 的起始引号**（手改追加时丢的）⇒ 任何 `JSON.parse(meta)` 的入口在**线上槽**上必崩 ——
   *   而线上槽恰恰是最该能读的那一个。⇒ 本门两条都钉：扫描器扛嵌套、容错只修这一种且**必须响亮**。 */
  const A = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(/export function extractJsonObject/.test(A), '`extractJsonObject` 必须是 audit-lib 的导出（**唯一一份**这种抽取）');
  ok(/export function parseMetaTolerant/.test(A), '`parseMetaTolerant` 必须是 audit-lib 的导出');

  /* ① 扫描器：嵌套 / 字符串里带花括号 / 转义 / marker 后紧跟 avoid 时跳过 */
  const nested = 'window.M = {"a":1,"r":{"env":{"X":"1"}},"z":2};';
  eq(AUDIT.extractJsonObject(nested, 'window.M'), '{"a":1,"r":{"env":{"X":"1"}},"z":2}', '嵌套对象必须完整抽出（旧懒惰正则会截断）');
  eq(AUDIT.extractJsonObject('window.M = {"s":"}{","a":1};', 'window.M'), '{"s":"}{","a":1}', '字符串里的花括号不许影响配平');
  eq(AUDIT.extractJsonObject('window.M = {"s":"a\\"b"};', 'window.M'), '{"s":"a\\"b"}', '转义引号不许破坏字符串状态');
  eq(AUDIT.extractJsonObject('window.M = {"a":1', 'window.M'), null, '没配平 ⇒ 返回 null（不许静默给半截）');
  eq(AUDIT.extractJsonObject('window.M_META = {"m":1};window.M = {"w":2};', 'window.M', '_META'), '{"w":2}',
    'marker 后紧跟 avoid ⇒ 必须跳过（`_META` 写在 `_3P` **前面**，不跳过就会把元数据当权重包）');

  /* ② 容错解析：合法输入**不许**被改；已知缺陷**修好且报告**；别的损坏**原样抛** */
  const legal = '{"a":1,"s":"x,y:1"}';
  const r0 = AUDIT.parseMetaTolerant(legal, 'unit-legal');
  eq(r0.repaired.length, 0, '合法 JSON 不许报告"修过"');
  eq(r0.meta.s, 'x,y:1', '合法 JSON 的值不许被改（尤其别把值里的 `,x:` 当初坏点）');
  const r1 = AUDIT.parseMetaTolerant('{"a":1,broken:"v"}', 'unit-broken');
  eq(r1.repaired.join(','), 'broken', '已知缺陷（裸键名缺起始引号）必须被修并**列出键名**');
  eq(r1.meta.broken, 'v', '【本条防的是我自己踩过的坑】修引号时**不许把值的开引号吃掉**（第一版写坏 ⇒ 值成了裸的 `v`）');
  let threw = false;
  try { AUDIT.parseMetaTolerant('{"a":,}', 'unit-other'); } catch (e) { threw = true; }
  ok(threw, '不是"缺起始引号"这一种的损坏 ⇒ 必须**原样抛**（不许瞎修）');

  /* ③ 【最有价值的一条】用**真·线上槽**跑一遍：这两个文件正是崩过的现场 */
  for (const f of ['js/bundled-champion-3p.js', 'js/bundled-champion.js']) {
    const src = readFileSync(f, 'utf8');
    const seg = AUDIT.extractJsonObject(src, 'EPIRUS_CHAMPION_3P_META') || AUDIT.extractJsonObject(src, 'EPIRUS_CHAMPION_META');
    ok(!!seg, f + ' 的 META 段必须能被扫描器定位（配平）');
    let got = null;
    try { got = AUDIT.parseMetaTolerant(seg, f).meta; } catch (e) { got = null; }
    ok(got && typeof got === 'object' && Object.keys(got).length >= 8,
      f + ' 的 META 必须能被解析出 ≥8 个顶层键（**这两个文件就是当初崩的现场** ⇒ 本门防回归）');
  }

  /* ③b（10-03 夜班 §E261 新增）：**线上槽必须严格可解析**（不走容错），且**一条警告都不许印**。
   *      为什么加：v1.5.256 把两个包的引号补回来之后，容错路其实只在夹具上走；但旧文本把"源文件是红线包"
   *      硬写在通用警告里 ⇒ 我把单元测试的 `unit-broken` 念成了"生产缺陷 + 待用户裁定"，还写进了日志。
   *      这条腿把"线上槽是干净的"钉成事实：**它红了就是真有人手改了包**，不会再是文本错觉。 */
  const warnSink = [];
  const realWarn = console.warn;
  console.warn = function (s) { warnSink.push(String(s)); };
  try {
    for (const f of ['js/bundled-champion-3p.js', 'js/bundled-champion.js']) {
      const src = readFileSync(f, 'utf8');
      const seg = AUDIT.extractJsonObject(src, 'EPIRUS_CHAMPION_3P_META') || AUDIT.extractJsonObject(src, 'EPIRUS_CHAMPION_META');
      let strictOk = true;
      try { JSON.parse(seg); } catch (e) { strictOk = false; }
      ok(strictOk, f + ' 的 META 必须**严格** JSON.parse 得动（v1.5.256 的修复要站住；红了=有人手改过线上槽，不是"容错路失效"）');
      AUDIT.parseMetaTolerant(seg, f);
    }
    ok(warnSink.length === 0, '读**两个真线上槽**时一条容错警告都不许印（实测印了 ' + warnSink.length + ' 条：'
      + (warnSink[0] || '').slice(0, 90) + '）');
  } finally { console.warn = realWarn; }

  /* ⑤ 警告文本必须**按 label 分岔**（合成夹具不许被念成"线上槽损坏"，真线上槽的措辞也不能丢） */
  const say = [];
  const rw2 = console.warn;
  console.warn = function (s) { say.push(String(s)); };
  try {
    AUDIT.parseMetaTolerant('{"a":1,broken:"v"}', 'unit-broken');
    AUDIT.parseMetaTolerant('{"a":1,broken:"v"}', 'js/bundled-champion-3p.js');
  } finally { console.warn = rw2; }
  eq(say.length, 2, '两条合成分岔都要各印一条（实测 ' + say.length + '）⇒ 抽取式失效时这条要响，不许静默');
  /* v1.7.126（门禁 ② 分诊）：我先把它改成"只留负向" ⇒ **当场红了**：警告正文里本来就写着「调用者**不是**线上槽文件」
   *   ⇒ 负向 pin `线上槽文件 < 0` 把**正确的否定句**判成违规。
   *   ⇒ **原样保留**：这两句中文不是装饰，它们**就是这条腿的语义**（夹具损坏 ≠ 生产缺陷，用户据此判断要不要慌）。
   *   结论：**prose pin 不都是装饰**，判据是"这句话是不是产品要传达的意思"。 */
  ok(say[0].indexOf('红线包') < 0 && say[0].indexOf('不是生产缺陷') >= 0,
    '⑤a **夹具 label** 的警告不许说"线上槽/红线包损坏"（实测：' + say[0].slice(0, 120) + '）');
  ok(say[1].indexOf('线上槽文件') >= 0,
    '⑤b 真的 `js/bundled-champion*` 损坏必须仍响亮指向"由用户裁定"（实测：' + say[1].slice(0, 120) + '）');

  /* ④ promote-champion 必须走扫描器：不许再留**读 META 的懒惰正则**，也不许残留旧的 `metaM` 变量 */
  const P = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(/extractJsonObject\(src, 'window\.EPIRUS_CHAMPION_3P_META'\)/.test(P), 'promote 必须用扫描器定位 META');
  ok(P.indexOf('metaM[0]') < 0 && P.indexOf('metaM[1]') < 0, 'promote 不许再引用那条懒惰正则的捕获组（写回路径也在里面）');
  ok(!/EPIRUS_CHAMPION_3P_META\\s\*=\\s\*\)\(\\\{\[\\s\\S\]\*\?\\\}/.test(P), 'promote 里不许再有"抽 META 的懒惰正则"');
  ok(/src\.replace\(metaSeg, function \(\) \{ return JSON\.stringify\(meta\); \}\)/.test(P),
    '写回必须用**函数形式**替换（字符串形式的替换会把 `$&`/`$\'` 当特殊模式 —— 同一族的"替换吃字符"）');
});

t('D170 出手形状的两条记录读数（目标死磕 / ジ⇄枪交替）必须可复现、缺读数给 NaN、且**只记录不阻断**（v1.5.258 · 用户 09-27 点名）', function () {
  /* 动因（用户原话）：「不过还是有一些**奇怪的公式打法**」+ 点名让我把另外两条也做记录测试：
   *   ① 同一目标死磕（实盘 4 局里 `玩家4→玩家5 ×5`、`玩家3→玩家5 ×4` …）
   *   ② ジ⇄枪 机械交替（30 回合局玩家4 从第16~30回合几乎就是 `枪,ジ,枪,ジ,…`）
   * 另注：**"空防御"那条用户说千问已列过** ⇒ 不要在别处另立一套，用 `tools/defense-quality.mjs` 的**白防**（用户 09-26 裁定）。 */
  const S = PS;
  ok(S && typeof S.attackTargets === 'function' && typeof S.targetFixation === 'function' &&
     typeof S.actionKeys === 'function' && typeof S.jiGunShape === 'function',
    'play-shape 的四个纯函数必须都导出（**唯一一份**这种读数）');

  /* ① 出手目标序列：只认**带 source 的结算事件**（action 事件本身不带目标 —— 别去猜） */
  const ev = [
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 0, to: 2, via: 'gun' },
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' },
    { type: 'blocked', source: 0, to: 2, via: 'gun', reason: '反弹' },
    { type: 'damage', source: 1, to: 0, via: 'gun' },        // 别人打我 ⇒ 不算我的出手
    { type: 'damage', source: 0, to: 3, via: 'sword' },
    { type: 'damage', source: 0 },                             // 没 to ⇒ 跳过
    { type: 'action', pid: 0, key: 'ji', outcome: 'ok' },
    { type: 'action', pid: 0, key: 'ji', outcome: 'noep' }     // 被拒 ⇒ 不算
  ];
  eq(JSON.stringify(S.attackTargets(ev, 0)), '[2,2,3]', '只取带 source 的结算事件（被挡也算一次出手），跳过无 to/他人所为');
  const fx = S.targetFixation([2, 2, 2, 3]);
  eq(fx.maxRun, 3, '最长连打同一目标必须是 3（实盘 `×5` 那种形状要能读出来）');
  eq(Number(fx.sameRate.toFixed(3)), 0.667, '同目标率 = 2/3');
  ok(isNaN(S.targetFixation([]).sameRate) && isNaN(S.targetFixation([]).maxRun),
    '【NaN 纪律】没量到出手 ⇒ 必须 NaN，**不许是 0**（"没量到"≠"量到 0"，与 defense-quality 同规矩）');
  ok(isNaN(S.targetFixation([5]).sameRate), '只有 1 次出手 ⇒ 同目标率 NaN（没有"上一次"可比）');

  /* ② 出手序列 + ジ⇄枪交替 */
  eq(JSON.stringify(S.actionKeys(ev, 0)), '["gun","gun","ji"]', '只取 outcome===ok 的本席 action（被拒的 noep 不算；ev 里那条 ok 的 ji 要算）');
  const jg = S.jiGunShape(['ji', 'gun', 'ji', 'gun'], 'ji', 'gun');
  eq(jg.altRate, 1, '纯交替 ⇒ 交替率 1');
  const jg2 = S.jiGunShape(['ji', 'ji', 'ji'], 'ji', 'gun');
  eq(jg2.altRate, 0, '有相邻对、但一次都不交替 ⇒ 交替率 **0**（那是真的"从不交替"，不是缺读数）');
  ok(isNaN(S.jiGunShape(['ji'], 'ji', 'gun').altRate), '【NaN 纪律】只有 1 次出手 ⇒ 连相邻对都没有 ⇒ 交替率必须 NaN，不许 0');
  eq(jg2.meanJiRun, 3, '连ジ段均长 = 3（"攒钱深度"这半条要能读）');
  eq(jg2.jiShare, 1, 'ジ占比 = 1');
  eq(S.jiGunShape(['gun', 'sword', 'gun'], 'ji', 'gun').jiShare, 0, '没出ジ ⇒ 占比 0（这里**该**是 0，因为有分母）');

  /* ③ 措辞唯一 + 可解析回数字（探针与体检共用同一串） */
  const line = S.formatShape({ n: 5, maxRun: 3, sameRate: 0.5 }, { n: 5, altRate: 0.4, meanJiRun: 2, jiShare: 0.6 });
  ok(/最长 3 连/.test(line) && /ジ⇄枪交替 \*\*40\.0%\*\*/.test(line), '一行读数必须把四条都印出来：' + line);
  const back = S.parseShape(line);
  eq(back.maxRun, 3, 'parseShape 必须能解回最长连打（措辞唯一，免得两处各写一遍）');
  eq(back.altRate, 0.4, 'parseShape 必须能解回交替率');

  /* ④ 【只记录】不许接成判据 —— 判据变更属用户裁定；本门就是那句"留痕" */
  const pro = readFileSync('tools/promote-champion.mjs', 'utf8');
  /* v1.5.258 追加：本栏已**并进 promote 的只记录体检栏**（照 DEFQ 栏同一套：spawn 探针、不自己仿真）⇒
   * 门钉三件事：① 栏在（spawn 探针）② promote 不自己算（不许 import 那两个函数去参与判定）③ 有逃生阀。 */
  ok(/probe-play-shape\.mjs/.test(pro), 'promote 必须 spawn 探针来出这一栏（单一来源，别自己仿真）');
  ok(pro.indexOf('targetFixation(') < 0 && pro.indexOf('jiGunShape(') < 0,
    'promote **不许**自己 import 并计算这两个读数（那就成了第二份实现；要立判据先请用户裁定）');
  ok(/EPIRUS_NO_SHAPE/.test(pro), '这一栏必须有逃生阀 EPIRUS_NO_SHAPE=1（与 DEFQ/GUARD 两栏同规矩）');
  ok(/出手形状栏（同上，\*\*只记录不阻断\*\*/.test(pro), '栏名必须写明"只记录不阻断"（以后有人想拿它阻断，得先改这行字）');
  const lib = readFileSync('tools/play-shape.mjs', 'utf8');
  ok(/只记录不阻断/.test(lib), '`play-shape.mjs` 的头注必须写明"只记录不阻断"');
  /* ===== v1.5.259（用户 GO"做 B"）：**昂贵层只记录读数** —— 大雷出手 / ≥3ep 出手占比 / 珠过期率 =====
   * 动因（§20.1/§20.2）：大雷是"抽到就得留住"的瞬态（21 粒只 1 粒学会；从学会者续训三臂全掉回 ~0），
   *   根因候选是**适应度里没有读数量它**。这一步只让"它出现过没有、以什么代价"可见；进 fit 属判据裁定。 */
  const keys = ['ji', 'gun', 'gun', 'ring', 'ji'];
  const isCostly = (k) => k === 'ring' || k === 'bigT';
  const cpp = PS.costlyProfile(keys, 'bigT', isCostly);
  eq(cpp.n, 5, '昂贵层画像要给出总出手数（分母）');
  eq(cpp.costly, 1, '≥3ep 出手数必须按调用方给的价格口径数（价格在规则里，别在这里复写一份）');
  eq(Number(cpp.costlyShare.toFixed(3)), 0.2, '≥3ep 出手占比 = 1/5');
  ok(isNaN(PS.costlyProfile([], 'bigT', isCostly).costlyShare), '【NaN 纪律】没出手 ⇒ 占比 NaN，不许 0');
  eq(PS.costlyProfile(['bigT', 'bigT'], 'bigT', isCostly).bigT, 2, '真·落雷出手数要单独数（这就是判据缺失的那个量）');
  ok(isNaN(PS.beadRotRate(0, 5)), '【NaN 纪律】得珠 0 ⇒ 过期率 NaN（不许把"没经济"读成"过期率 0 = 很好"）');
  eq(Number(PS.beadRotRate(100, 96.7).toFixed(3)), 0.967,
    '过期率 = 过期/得珠（本班实测 Lctl = 96.7% vs 现役 48.1% —— 这条就是"用贵卡的代价"第一次可见）');
  ok(/昂贵层/.test(PS.formatCostly(cpp, 0.967)) && /96\.7%/.test(PS.formatCostly(cpp, 0.967)),
    '昂贵层那一行的措辞必须把三个数都印出来（探针与体检共用同一串）');
  ok(/defense-quality/.test(lib) && /白防/.test(lib),
    '头注必须指向**已有的白防口径**（用户 09-26 裁定 + 千问已列）—— 不许在别处另立一套"空防御"');
});

t('D190 promote 的阻断计数**不许被重复打印翻倍**（Qoder §F-1 点名 · v1.5.283）', function () {
  /* 病（Qoder 09-28 §F 交给 DS）：`gate-drafts` 会把同一格 `G4[…]` 印**两遍**（实测：stdout 8 行 / 唯一格名 5 个，
   * stderr 0 行 ⇒ 是工具自己重复打印，不是 stdout+stderr 拼接）⇒ 旧代码每遇一行就 push 一次 ⇒
   * 「⛔ 体检未过（N 项阻断）」的 N **翻倍**（判定不受影响，但读数字的人会被误导）。
   * 本门钉 promote 侧的去重（按格名），并留一条"工具侧待修"的说明。 */
  const PM = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(/if \(gateDrafts\.blocking\.indexOf\(nm\) < 0\)/.test(PM),
    'G4/G5 阻断必须**按格名去重**后再 push（同一格被印两遍时不许数两遍）');
  ok(/gateDrafts\.recorded\.indexOf\('FAIL ' \+ nm\) < 0/.test(PM), 'recorded 一族同样要去重');
  ok(/gate-drafts 自己重复打印/.test(PM),
    '必须把根因（工具自己重复打印）留档 —— 免得后人以为已修而删掉去重（工具侧那条还没修）');
  /* ===== v1.5.284（Qoder §20-2/§20-3）：把这条门从"纯文本钉"升级成**行为判据** =====
   * 上面三条都是 `readFileSync(promote)` 的源码匹配 ⇒ 谁把去重提成 `pushUniq()` helper 就会为**非 bug** 变红，
   * 而真正的漏口（UNRUN 分支）反而抓不到。这族病本班刚红过一次（D4 被 `oppSeatIndex` 重构架空，见 §E125 补充）。
   * ① 行为判根因：`gate-drafts` 自己的输出里**每个格名必须恰好出现一次**（汇总段再复述也不许长得像判据行）。
   *    ⇒ 它按**格式**数，所以 FAIL / UNRUN 两种状态一起覆盖，不靠数状态名。 */
  const rgd = spawnSync(process.execPath, ['tools/gate-drafts.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24,
    env: Object.assign({}, process.env, { GATE3_GAMES: '20', GATE4_GAMES: '20', GATE6_GAMES: '4' })
  });
  const gout = String(rgd.stdout || '') + String(rgd.stderr || '');
  /* ⚠ 归因必须先于判据：这条门曾红过一次，报的是"汇总段前缀没了"，而**真实原因是那次 spawn 没跑到汇总**
   * （09-29 复跑同一命令 ⇒ 前缀在、重复 0 ⇒ 绿）。把"没跑完"和"格式回退"混报是本仓反复写的
   * "读不出 ≠ 没接线"同族病 ⇒ 先把 status/长度 断掉，再谈格式。 */
  ok(!!rgd.stdout && rgd.stdout.length > 800, '① 前置：gate-drafts 必须真跑出正文（stdout 长度 ' +
    String(rgd.stdout || '').length + '，status=' + rgd.status + '，error=' + (rgd.error ? rgd.error.message : '无') +
    '）——**没跑完不许被读成"格式回退了"**');
  const cellNames = (gout.match(/^\s*(?:PASS|FAIL|UNRUN)\s+(G[3-6][^\n]*)$/gm) || [])
    .map(s => s.replace(/^\s*(?:PASS|FAIL|UNRUN)\s+/, '').trim());
  ok(cellNames.length > 0, '① 至少要扫到判据行（扫到 0 行 ⇒ 这条门自己退化成恒真，本仓最怕的形状）');
  const dupCell = cellNames.filter((v, i) => cellNames.indexOf(v) !== i);
  eq(dupCell.length, 0, '① 判据行不许重复出现（重复 ⇒ promote 会把同一格数两遍）：实测重复 ' + dupCell.length + ' 处');
  ok(/汇总│\s/.test(gout), '① 汇总段必须还在、且带**不可解析的前缀** `汇总│ `（删掉汇总 = 丢人的读数；改回旧格式 = 丢这道网）');
  /* ② 行为判漏口：promote 的 UNRUN 分支也必须去重（DS v1.5.283 只修了 FAIL 那一支） */
  ok(/if \(uD\.blocking && gateDrafts\.blocking\.indexOf\(uName\) < 0\)/.test(PM),
    '② UNRUN 分支的阻断 push 必须去重（`statusOf` 会产出 `UNRUN:缺`，同样可解析）');
  ok(/gateDrafts\.unrun\.indexOf\(uLine\) < 0/.test(PM), '② UNRUN 的账目行同样不许重复记（meta 里翻倍会误导事后复核）');
});

t('D210 §E169 的第 4 剂药有牙（`setBeliefBead` / `setBeliefRingPrice`，**两个默认 0 ⇒ 出厂形状逐字不变**）：旋钮必须真的改判决，且珠的三条去路只许数一份', function () {
  /* 为什么有这条（本仓"新门不许是装饰"的规矩）：§E169 量的正是"**给跨回合资源手写一个价，能不能买回长程**"。
     如果那两个旋钮没接进 `beliefValue`，仪器上"蓄能回来了"就只是我把噪声读成了趋势。⇒ 三条都要钉：
     ① 出厂默认 0 且两价为 0 的开档臂必须与 §E161 那一版（短写 `1:0:0`）**逐字同结果**（证明新增项没渗进默认路径）；
     ② 每一档必须**把它命名的那一列推动**（`bead`⇒蓄能/珠获得，`ring`⇒环）——同 5 局一批牌、只换一档；
     ③ 珠的三条去路（获得/消耗/过期）在 `behavior-profile` 里**只许出现在一处**，仪器不许自己扫 `state.events`。 */
  const src = readFileSync('js/train/evo.js', 'utf8');
  ok(/let BELIEF_BEAD = 0;/.test(src) && /let BELIEF_RING = 0;/.test(src),
    '① 源码默认值必须是 `BELIEF_BEAD = 0` / `BELIEF_RING = 0`（出厂 = §E161/§E168 已量过那版）');
  ok(/BELIEF_BEAD \* \(\(me\.elec/.test(src) && /BELIEF_RING \* \(me\.ringStreak/.test(src),
    '①′ 两项必须真的进 `beadTerm()`（源码里抠不到乘法形状 ⇒ 说明只加了 setter 没接进评估）');
  ok(src.indexOf('function beadTerm(me)') >= 0 && src.indexOf('return 20 * (me.hp > 0 ? 1 : 0) + me.hp - (n ? sum / n : 0) + beadTerm(me);') >= 0,
    '①″ 默认那一路（`BELIEF_TGT === 0`）必须带 `+ beadTerm(me)` ⇒ 否则 `bead` 档在出厂目标函数上是空转的');
  const ui = readFileSync('js/ui/ui.js', 'utf8');
  ok(ui.indexOf('setBeliefBead') < 0 && ui.indexOf('setBeliefRingPrice') < 0,
    '①⁗ 页面**不许**接这两个档（§E169 是研究旋钮；接了就得重开"线上默认值"那条裁定，本门的"出厂形状不变"论证立刻作废）');
  const T210 = WIN.EpirusTrainer;
  eq(T210.beliefBead(), 0, '② `beliefBead()` 出厂必须是 0（实测 ' + T210.beliefBead() + '）');
  eq(T210.beliefRingPrice(), 0, '② `beliefRingPrice()` 出厂必须是 0（实测 ' + T210.beliefRingPrice() + '）');
  T210.setBeliefBead('6'); eq(T210.beliefBead(), 6, '②′ 字符串必须能设进去');
  T210.setBeliefBead(99); eq(T210.beliefBead(), 12, '②″ 上界夹住（99 ⇒ 12）');
  T210.setBeliefBead(-3); eq(T210.beliefBead(), 0, '②‴ 负数必须回 0（负价=反向激励，不许当"另一种档"）');
  T210.setBeliefBead('abc'); eq(T210.beliefBead(), 0, '②⁗ 非数值必须回 0');
  T210.setBeliefRingPrice(99); eq(T210.beliefRingPrice(), 12, '②⁵ 环价同样有上界');
  T210.setBeliefRingPrice(0); eq(T210.beliefRingPrice(), 0, '②⁶ 0 必须能关回去');
  const SK210 = WIN.EpirusRules.SK;
  const params210 = AUDIT.loadChamp(WIN, FIXTURE_PACK, process.cwd());   /* ⚑ 10-17 夜班（R3）：活槽 → 在册夹具。本班在一次性临时树里先量过（`s79`，NP_NOCACHE=1）：④⑤ 那两条对比度断言（bead=4 抬珠、ring=4 抬环）在夹具包上**照样成立** ⇒ 这条不属于"换夹具会误红"那一族 */
  const arm = function (bead, ringp) {
    T210.setBeliefSearch(1); T210.setBeliefBead(bead); T210.setBeliefRingPrice(ringp); T210.setBeliefTie(0);
    fieldProfile(params210, 0.2, 'soft', 5, 4100, 'mixed', 'multi');           /* 暖机（§E164b：换档后第一遍不同，原因未定位） */
    const t = fieldProfile(params210, 0.2, 'soft', 5, 4100, 'mixed', 'multi');
    T210.setBeliefSearch(0); T210.setBeliefBead(0); T210.setBeliefRingPrice(0);
    return t;
  };
  const z = arm(0, 0), z2 = arm(0, 0);
  const keyZ = t => JSON.stringify({ a: t.acts, w: t.wins, r: t.rounds, d: t.decisive, v: t.voided, f: t.focus,
    bg: t.beadGain, bs: t.beadSpend, bx: t.beadExpire, k: Object.keys(t.keys).sort().map(x => x + ':' + t.keys[x]) });
  eq(keyZ(z), keyZ(z2), '③ 两价为 0 时同批牌两遍必须逐字相同（搜索不许抽 `state.rng`）');
  const b4 = arm(4, 0), r4 = arm(0, 4);
  ok(b4.beadGain > z.beadGain, '④ `bead=4` 必须把**珠获得**推上去（实测 ' + b4.beadGain + ' vs 基线 ' + z.beadGain + '）⇒ 相同就说明这一档没接进评估');
  ok((b4.keys[SK210.CHARGE] || 0) > (z.keys[SK210.CHARGE] || 0), '④′ 同上，`蓄能` 出手数必须动（实测 ' + (b4.keys[SK210.CHARGE] || 0) + ' vs ' + (z.keys[SK210.CHARGE] || 0) + '）');
  ok(r4.ring > z.ring, '⑤ `ring=4` 必须把**环**推上去（实测 ' + r4.ring + ' vs 基线 ' + z.ring + '）');
  ok((r4.keys[SK210.RING] || 0) > (z.keys[SK210.RING] || 0), '⑤′ `聚能环` 出手数必须动（实测 ' + (r4.keys[SK210.RING] || 0) + ' vs ' + (z.keys[SK210.RING] || 0) + '）');
  /* ⑥ 反证那一列必须有内容：`bead` 档如果只会攒不会花，`beadExpire` 就必须看得见（数不出来的度量是装饰） */
  ok(b4.beadExpire > 0, '⑥ `bead=4` 那批牌里必须能看到**珠过期**事件被数到（实测 ' + b4.beadExpire + '）⇒ 为 0 说明 `beadExpire` 那条计数没接上，"只攒不打"就永远量不出来');
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  for (const c of ['t.beadGain++', 't.beadSpend++', 't.beadExpire +=']) {
    const n = (bp.match(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    ok(n === 1, '⑦ 珠的三条去路只许数一份：`' + c + '` 应出现 1 次（实测 ' + n + '）');
  }
  const i169 = readFileSync('docs/artifacts/e169-beadprice.mjs', 'utf8');
  ok(i169.indexOf("st.events") < 0, '⑧ §E169 仪器不许自己扫 `st.events`（读 `fieldProfile` 的 tally ⇒ 两份事件计数必漂移）');
  ok(/\[\s*'script'\s*,\s*'human'\s*\]/.test(i169),
    "⑨ 第 19 条陷阱的机械形状：这台仪器必须**两张桌**都能起 ⇒ `--table=both` 那一支必须展开成 ['script', 'human']" +
    "（只要求文件里出现过 'human' 不算——`flag('src','human')` 里也有，那是**池子来源**不是**桌子**；本门的这条判据本身就被这个假绿抓到过一次）");
});

}

