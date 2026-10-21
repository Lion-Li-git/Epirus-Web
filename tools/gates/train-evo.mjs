/*#np-part-header
{"file":"tools/gates/train-evo.mjs","part":"train-evo","group":"train","ranges":[[797,845],[884,916],[1598,2103],[2363,2381],[2433,2484],[2592,2625],[2776,2821],[2920,2963],[3001,3029],[3437,3661],[3731,3750],[3798,3970],[4201,4208],[4239,4277],[4540,4571],[4685,4757],[4797,4928],[5006,5077],[5127,5302],[5333,5356],[5680,5694],[5745,5845],[5947,6012],[6223,6292],[6568,6597],[6652,6670],[6713,6763],[7060,7205],[7235,7305],[7929,8005],[8889,8938],[9176,9237],[9300,9331],[10514,10572],[10652,10782],[10898,11115],[11709,11854]],"gates":[797,884,1598,1820,1993,2363,2433,2447,2592,2776,2920,3001,3437,3472,3501,3572,3609,3731,3798,3821,3846,3934,3953,4201,4239,4258,4540,4685,4797,4812,4820,4843,5006,5042,5127,5183,5228,5263,5333,5680,5745,5772,5798,5820,5947,5965,6223,6568,6652,6713,7060,7087,7235,7929,8889,8922,9176,9300,10514,10652,10699,10733,10898,11709,11799],"patched":[]}
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
  fnBody, fnMap,
} = makeCtx();
/* 每个门单元的**原始行号**（与下面 register() 里 t() 的调用次序一一对应）⇒ runner 按它排序执行。 */
export const ords = [797, 884, 1598, 1820, 1993, 2363, 2433, 2447, 2592, 2776, 2920, 3001, 3437, 3472, 3501, 3572, 3609, 3731, 3798, 3821, 3846, 3934, 3953, 4201, 4239, 4258, 4540, 4685, 4797, 4812, 4820, 4843, 5006, 5042, 5127, 5183, 5228, 5263, 5333, 5680, 5745, 5772, 5798, 5820, 5947, 5965, 6223, 6568, 6652, 6713, 7060, 7087, 7235, 7929, 8889, 8922, 9176, 9300, 10514, 10652, 10699, 10733, 10898, 11709, 11799];
/* v1.7.67 收拢：`eval-5p 1 5 77000 --pool=core --every=17` 这一发原先在**两条门里各抄了一份逐字相同的包装**
 *   （`:135` 与 `:386`，连包装都各一份）⇒ 提到文件级只留一份。判据一字未改。 */
const runE = function (extra) {
  const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--pool=core', '--every=17'].concat(extra),
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
};
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('REPRO2 每个训练入口都必须**真的**播种（按 makeTrainer 调用点反查 + 按函数体切分）', function () {
  /* 第三方复核 §5-2 的两条实测，把上一版的问题说清了：
   * ① 上一版是**字符串存在性检查**（对硬编码的 5 个文件 grep 'seedSandbox|setRng'）——
   *    而 2P 的 `runTrain`（server/train-server.mjs）整段没有任何播种却**照样通过**：
   *    因为同一个文件里的 `runTrainN` 有 ⇒ 守门守的是"文件"，不是"入口"。
   *    那条未播种的路产出的正是 `js/bundled-champion.js`（2P 线上包，meta 至今是空的）。
   * ② `tools/diag.mjs` 是第 6 个入口，既不在 REPRO 的扫描表、也不在 REPRO2 的名单里。
   * 现在三层：(a) 名单**反查**（不再硬编码，新增入口自动纳入）；
   *          (b) server 的两个入口**按函数体**各自要求播种；
   *          (c) 可复现性由 D25 用"同 seed 两遍逐字节相同"**实测**（静态检查只是兜底）。 */
  const dirs = [['server', /\.mjs$/], ['tools', /\.mjs$/], ['js/train', /\.js$/]];
  const entries = [];
  for (const pair of dirs) {
    for (const f of readdirSync(pair[0])) {
      if (!pair[1].test(f)) continue;
      const p = pair[0] + '/' + f;
      /* 只认**调用点**（`.makeTrainer(`），不认 `js/train/evo.js` 里的 `function makeTrainer(` 定义
       * —— 定义文件是引擎，不是"入口"；把它算进来只会让这条永远红。 */
      if (readFileSync(p, 'utf8').indexOf('.makeTrainer(') >= 0) entries.push(p);
    }
  }
  ok(entries.length >= 4, '按 makeTrainer 调用点反查只找到 ' + entries.length + ' 个入口（应当 ≥4）—— 反查逻辑坏了？');
  const miss = entries.filter(function (f) {
    const s2 = readFileSync(f, 'utf8');
    return s2.indexOf('__seedSandbox') < 0 && s2.indexOf('setRng') < 0;
  });
  eq(miss.length, 0, '以下训练入口未播种：' + miss.join(', '));

  /* (b) 文件级存在性不够：每个训练入口必须**自己这条链上**有播种。
   * §改（2026-10-22 千问，用户指令「改掉钉文本和函数名的门禁」）：原来这里写死了
   *   `['runTrain','runTrainN']` 两个名字，并按"锚点 + 到下一个 async function"切体 ⇒
   *   v1.7.142 把真身改名 `runTrainNOne`、外面只留一个 rounds×seeds 调度壳，它就当场红，
   *   而它本该抓的那件事（这条入口没人播种）红的时候**并没有坏**。
   *   现在两样名单都从文件里反查：**入口** = handler 里被调用的 `runTrain*`，
   *   **受托者** = 函数体里同时出现 `__seedSandbox(` 与 `setRng(` 的那些函数。
   *   入口要么自己播，要么调一个真播了种的兄弟 ⇒ 改名/搬家不红，而"整条链没人播"必红
   *   （"文件里别处有播种"仍然不算数 —— 那正是 v1.5.17 的洞形：另一条入口里的播种救不了这条）。 */
  const srvSrc = readFileSync('server/train-server.mjs', 'utf8');
  const hStart = srvSrc.indexOf('http.createServer');
  ok(hStart > 0, 'server 里找不到 handler ⇒ 入口反查没有起点');
  const entryFns = Array.from(new Set((srvSrc.slice(hStart).match(/\brunTrain[A-Za-z0-9_]*(?=\s*\()/g) || [])));
  ok(entryFns.length >= 2, '从 handler 反查到的训练入口只有 ' + entryFns.length + ' 个（实测 ' + entryFns.join(',') +
    '）⇒ 反查失效，这条门已经看不见入口了');
  const fmap = fnMap(srvSrc);
  const seededOf = function (nm) {
    const e2 = fmap.filter(function (x) { return x.name === nm; })[0];
    return !!e2 && e2.body.indexOf('__seedSandbox(') >= 0 && e2.body.indexOf('setRng(') >= 0;
  };
  const hosts = fmap.filter(function (x) { return x.body.indexOf('__seedSandbox(') >= 0 && x.body.indexOf('setRng(') >= 0; })
    .map(function (x) { return x.name; });
  ok(hosts.length >= 1, '`train-server.mjs` 里没有任何函数体同时播种（`__seedSandbox` + `setRng`）⇒ 播种被整体掏空');
  for (const en of entryFns) {
    const e3 = fmap.filter(function (x) { return x.name === en; })[0];
    ok(!!e3, '入口 ' + en + ' 的函数体取不出来（改名了？还是 handler 里那个名字是笔误）');
    if (!e3) continue;
    const delegates = hosts.filter(function (h) { return h !== en && e3.body.indexOf(h + '(') >= 0; });
    ok(seededOf(en) || delegates.length > 0, en + ' 这条链必须有人播种：要么自己播，要么调用一个真播了种的同文件函数' +
      '（实测委托到：' + (delegates.join(',') || '(无)') + ' ‖ 全文件播了种的函数：' + hosts.join(',') + '）');
  }
});

/* ===== LESSON->TEST: turn the recurring failure classes into cases that FAIL =====
 * Claude's review of the changelog: the "this is the Nth time" counters kept growing, i.e.
 * the rules were written down but never INTERNALISED. But every lesson that actually stuck
 * in this project stuck as a TEST (repro-check.mjs, the REPRO assertion, the falsification
 * rule) -- a note dies with the context, a test does not.
 * So each recurring class below is encoded as an assertion. All of these were real, and each
 * one would have failed on the buggy code. */

t('L4 补贴口径：chooser 内补 ep 只对当回合无效、次回合起生效（turn-start 通道才干净）', function () {
  /* 为什么钉这条：为诊断"深经济锁死"我写了补贴探针，看到贵技能 0 次就写下"这是测量假象"。
   * 实测（tools/grant-mech-diag.mjs）否定了它：play.js:50-53 先算 affordable 再问 chooser、
   * 事后又用旧值把买不起的选择强制改回 ジ，所以**每局第 1 回合**是盲的；但改的是真实 state，
   * 从第 2 回合起 affordable 就变 true 了。两种解读对历史结论的含义完全相反
   * （"纯假象" => 那个结论要推翻；"只有首回合盲" => 结论仍成立），所以必须由用例钉住。 */
  const RINGk = R.SK.RING, BIGk = R.SK.BIG_T;

  // (1) chooser 内补 ep：当回合 affordable 仍为 false，次回合起才 true
  const st1 = S.createState('multi', { next: mulberry32(91) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st1.p[i2].ep = 2; st1.p[i2].elec = 0; st1.p[i2].boom = 0; }
  const seenAff = [];
  const ch1 = function (state, pid, legal) {
    state.p[pid].ep = Math.max(state.p[pid].ep, 99);
    const l = legal.find(function (x) { return x.key === RINGk; });
    seenAff.push(l ? l.affordable : null);
    return { key: BIGk, target: 1, target2: null };
  };
  Play.autoGameN(st1, [ch1, ch1, ch1]);
  eq(seenAff[0], false, '首回合：legal 在 chooser 之前算好，补 ep 不能让 RING 变可负担');
  ok(seenAff.indexOf(true) >= 0, '次回合起：补的 ep 留在真实 state 上，RING 必须变可负担');
  ok(st1.events.some(function (e) { return e.via === BIGk || e.via === RINGk; }),
    '既然次回合起可负担，就该真的出现贵/环技能出手（否则连"留存"都不成立）');

  // (2) turn-start 通道（引擎 opts.regen）在 chooser 之前就把 ep 发好 —— 这是干净口径
  const st2 = S.createState('multi', { next: mulberry32(92) }, 3, { regen: 6 });
  st2.p[0].ep = 0;
  X.startTurn(st2);
  const l2 = Play.legalActions(st2, 0).find(function (x) { return x.key === BIGk; });
  ok(!!l2, 'multi 模式应含 bigT（真正的落雷）');
  ok(l2.affordable === true, 'opts.regen 在 startTurn 发 ep，早于 legalActions => bigT 当回合必须可负担');
});

t('D224 §E271/§E273/§E274 大雷"每几局看得见一次"的档（v1.5.333 起 **p=12 是默认行为**，js/train/evo.js 的 BIGT_PUSH）：默认值在册 · 页面不许有第二处开关 · 关掉要显式且真不同 · 剂量与用量只能实测 · 两条路径必须同意', function () {
  const evoSrc = readFileSync('js/train/evo.js', 'utf8');
  const uiSrc = readFileSync('js/ui/ui.js', 'utf8');

  /* ① 默认值在册（v1.5.333 起"默认开着"**就是**现网行为）+ 结构钉。
   *    ⚠ 这一格从"默认必须是 0"翻成"默认必须是 8"是**用户裁定**（「你把 p=8 默认开吧」）⇒
   *      连带后果是有意的：训练/评测/门禁现在也带着这一档跑，对照必须显式 `--shipbigt=0`。 */
  const defM = /^\s*let BIGT_PUSH = ([0-9]+);$/m.exec(evoSrc);
  ok(!!defM, '①a 默认值必须**写在 `evo.js` 里**（找不到 `let BIGT_PUSH = N;` ⇒ 现网行为没有唯一来源）');
  eq(Number(defM[1]), 12, '①b 引擎默认必须是 **12**（用户 10-03 晚先要 8，看到 G5 后改口「那换 p=12 吧」；实测 ' + (defM ? defM[1] : '读不到') + '）');
  ok(/if \(BIGT_PUSH >= 1\) \{/.test(evoSrc), '①c 钩子必须在 `BIGT_PUSH >= 1` 的短路后面');
  ok(/function setBigTPush\(v\)/.test(evoSrc) && /setBigTPush[\s,}]/.test(evoSrc.slice(evoSrc.indexOf('global.EpirusTrainer'))),
    '①d `setBigTPush` 必须导出到 `EpirusTrainer`（**要关必须能显式关**：评测的对照臂靠它）');
  ok(uiSrc.indexOf('setBigTPush(') < 0,
    '①e **页面里不许再有第二处开关**（v1.5.332 的 `ui.js` 显式调用已撤 ⇒ 两处开关必漂移；默认值只由 `evo.js` 那个常数表达。实测页面里出现=' + (uiSrc.indexOf('setBigTPush(') >= 0) + '）');

  /* ② 坏输入 exit 2（工具侧旗标与引擎侧 setter 都要拒，不许静默降级）*/
  /* `runE` 见文件头那一份（v1.7.67 收拢：此前两处逐字相同） */
  for (const b of [['--shipbigt=13'], ['--shipbigt=0.5'], ['--shipbigt=abc'], ['--shipbigt=12', '--bigtpush=1'], ['--shipbigt=12', '--bigtpush=0']]) {
    const rb = runE(b);
    eq(rb.code, 2, '`' + b.join(' ') + '` 必须 exit 2（实测 ' + rb.code + '）⇒ 越界或与"工具外挂"同时给 = 两个自由量捆一起');
  }

  /* ③ 默认**真的不靠调用方**就生效：`--shipbigt=8` ≡ 不设旗标（剥墙钟后逐字），而 `--shipbigt=0` 必须与默认**不同**。
   *    ⚠ 这一格的形状在 v1.5.333 翻转过：原来钉"`--shipbigt=0` ≡ 不设旗标"（默认关），现在钉"`--shipbigt=8` ≡ 不设旗标"（默认开）
   *      ⇒ 若有人只把 ①b 的默认值改掉而忘改这里，门会**红在 ③b**，不会静默放过。 */
  const strip = function (s) { return s.split('\n').filter(function (l) {
    return l.indexOf('[shipbigt') !== 0 && l.indexOf('耗时') !== 0;
  }).join('\n'); };
  const off0 = runE(['--shipbigt=0']), offNone = runE([]), off8 = runE(['--shipbigt=12']);
  eq(off0.code, 0, '③a `--shipbigt=0`（显式关掉）不该报错：' + off0.out.slice(0, 160));
  eq(off8.code, 0, '③a2 `--shipbigt=12`（显式给默认值）不该报错：' + off8.out.slice(0, 160));
  eq(strip(off8.out), strip(offNone.out), '③b **默认档必须等于 12**：`--shipbigt=8` 与不设旗标剥墙钟后逐字相同（不同 ⇒ "默认"与"旗标"走的是两条路）');
  ok(offNone.out.indexOf('[大雷用量]') >= 0, '③c 不设旗标时**也要**印用量行（默认开着 ⇒ "到底开没开"必须可观测；不印就退化成只能靠 banner 猜）');
  ok(off0.out.indexOf('[大雷用量]') < 0, '③d 显式关档不许印这一行（关档时工具侧一行都不许多动）');
  ok(strip(off0.out) !== strip(offNone.out), '③e **关掉档必须与默认不同**（相同 ⇒ 那个"默认"从没作用到判定上，是纸面上的）');
  ok(/BIGT_PUSH = 12/.test(offNone.out), '③f 有效档要由**引擎回读**后印出来（实测读不到 `BIGT_PUSH = 12` ⇒ 那是工具按"旗标有没有出现"推断的，不是回读）');

  /* ④ 开档真改变行为，且**用量由引擎事件数**（`champ.use`），不是工具自己的计数器 ⇒ 剂量必须落到落点上 */
  const runP = function (extra) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '6', '5', '77000', '--pool=all', '--every=48'].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  const useOf = function (txt) {
    const m = /真打出 \*\*(\d+) 张 \/ (\d+) 局/.exec(txt);
    return m ? { casts: Number(m[1]), games: Number(m[2]) } : { casts: NaN, games: NaN };
  };
  const castOf = function (txt) { return useOf(txt).casts; };
  const s1 = runP(['--shipbigt=1']), s8 = runP(['--shipbigt=12']);
  eq(s1.code, 0, '④c `--shipbigt=1` 臂必须跑通：' + s1.out.slice(0, 160));
  const c1 = castOf(s1.out), c8 = castOf(s8.out);
  /* ⚠ ④d 原先只判 `c1 > 0`，M4（把剂量短路成"永不命中"）实测**照样绿**——因为出厂冠军自己就偶尔打大雷（全卷 103 ‖ 355 张），
   *   小样本里 4 张就把它喂饱了。⇒ 改成判**密度**：N=1 时每一扇窗口都该兑现，实测这批夹具（6 局 × pool=all × every=48 = 2562 局）
   *   给出 **1307 张 / 2562 局 = 0.51 张/局**，地板取 **0.3**（对真值留 1.7×，对 M4 的 0.002 差 250 倍）。
   *   N=8 在这一批上是 452/2562 = 0.176 张/局 ⇒ 地板**只加在 N=1 那一臂**，别把它当成通用阈值。 */
  const u1 = useOf(s1.out);
  ok(isFinite(u1.games) && u1.games > 0 && u1.casts / u1.games >= 0.3,
    '④d **独立证据**：`--shipbigt=1` 的用量密度必须 ≥ 0.3 张/局（实测 ' + (isFinite(u1.casts) ? (u1.casts / u1.games).toFixed(3) : '读不出这一行')
    + ' 张/局 = ' + u1.casts + ' 张 / ' + u1.games + ' 局）⇒ 接近 0 就是"钩子没接进真路径"或"剂量永不命中"（本夹具实测 N=1 ⇒ 0.51 张/局）');
  ok(isFinite(c8) && c8 > 0 && c8 < c1, '④e N=12 的张数必须**严格低于** N=1（实测 ' + c1 + ' ‖ ' + c8 + '）⇒ 不降就是剂量没接上（"提了名次、没打出去"）');

  /* ⑤ 两条路径必须同意：工具外挂 `--bigtpush=8` vs 现网路径 `--shipbigt=8`（同一批桌子、同一目标规则）
   *    ⚠ 这是"两份实现必漂移"那一族的**验收腿**（§E178 两台采样器、D204⑧ 两 chooser 同构）—— 不测就永远不知道漂了多远。 */
  const s8same = runP(['--shipbigt=8']), t8b = runP(['--bigtpush=8', '--bigttgt=threat']);
  const cs8 = castOf(s8same.out), ct8 = castOf(t8b.out);
  ok(isFinite(ct8) && ct8 > 0, '⑤a 工具外挂臂也要能数出用量（实测 ' + (isFinite(ct8) ? ct8 : '读不出') + '）⇒ ⑤ 这一整格没测到东西');
  const ratio = cs8 / ct8;
  ok(ratio > 0.34 && ratio < 3.0, '⑤b 两条路径的用量比必须落在 [1/3, 3]（实测 ' + ratio.toFixed(2) + '：现网 N=8 ' + cs8 + ' ‖ 外挂 p=8 ' + ct8 + '）'
    + '⇒ 差一个数量级就说明其中一条没接进同一条窗口/目标判定，§E270 那张价签表就不能横用到上线档'
    + '（⚠ 两臂必须**同 N** 才叫"两份实现对照"：外挂那一臂因为带研究旗标会被工具顶成引擎档 0，所以这里现网侧必须显式给 `--shipbigt=8`）');

  /* ⑦ §E273：默认开着之后，**别的注入旗标必须把它顶回 0** —— 否则一条臂上叠两个自由量，
   *    而 §E262~§E268 那批读数的世界是"这一档关着、只有那面旗标在动"。这条纪律不钉住就会被下一个人顺手删掉。 */
  const inj = runE(['--bigtpush=1', '--bigttgt=threat']);
  eq(inj.code, 0, '⑦a 带 `--bigtpush` 的臂不该报错：' + inj.out.slice(0, 160));
  ok(inj.out.indexOf('顶成 0（关）') >= 0,
    '⑦b 检测到研究注入旗标时必须**响亮地把引擎档顶回 0**（实测没印 ⇒ 默认档与工具外挂叠在一起测了，两个自由量）');
  ok(inj.out.indexOf('[大雷用量] 路径=工具外挂') >= 0,
    '⑦c 顶回之后用量行必须只报"工具外挂"这一条路（印成"现网"= 两条路同时在动，⑤ 的对比就废了）');
  ok(offNone.out.indexOf('顶成') < 0, '⑦d 没有注入旗标时**不许**顶（那条一行都不该出现；出现了就是"默认开"这件事又被关回去了）');

  /* ⑥ 落盘身份：`#shipbigt=` 必须进表头（配对尺靠它拒跨档配对）*/
  const dir = mkdtempSync(join(tmpdir(), 'd224-'));
  const dump = join(dir, 's.tsv');
  const rd = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--pool=core', '--every=17',
    '--shipbigt=8', '--dump-per=' + dump], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  eq(rd.status, 0, '⑥a 带 `--dump-per` 的上线档臂必须跑通：' + String(rd.stderr || '').slice(0, 160));
  if (existsSync(dump)) {
    const headTxt = readFileSync(dump, 'utf8').split('\n').filter(function (l) { return l[0] === '#'; }).join('\n');
    ok(headTxt.indexOf('#shipbigt=8') >= 0, '⑥b 表头必须带 `#shipbigt=`（实测=' + (/^#shipbigt=.*$/m.exec(headTxt) || ['(缺)'])[0] + '）⇒ 缺这一维，上线档与出厂落盘会被配成同臂');
  }

  /* ⑧ §E278（我复核 DS 的 v1.6.0 补的）：`--pushfloor` 是 `--pushrank` 第四段**正名出来的新旗标**，
   *   DS 把写侧读侧的改名做了半边（落盘维 `#pushfloor=` 改了、配对尺的**比较式**还在读 `pushrank` ⇒ 那条"两个剂量不许互配"的守卫静默失效，
   *   实测：只差 `#pushfloor` 一维（0.6 ‖ 0.0001）的两份落盘被配成"同一臂、dm=0.00"），
   *   而⑦ 那条"注入旗标 ⇒ 顶掉引擎默认档"的纪律**根本没搬过来**。两件事都在这一格里变成可执行断言。 */
  const pf = runE(['--pushfloor=0.6']);
  eq(pf.code, 0, '⑧a `--pushfloor=0.6`（DS 的新写法，单独用）不该报错：' + pf.out.slice(0, 160));
  ok(pf.out.indexOf('顶成 0（关）') >= 0,
    '⑧b **新名字也必须顶掉引擎默认档**（实测没印 ⇒ 这条臂同时挂着出厂的 12 与软抬档，两个自由量；而 §E262~§E268 那批读数都是"引擎档关着"的世界）');
  const pfShip = runE(['--pushfloor=0.6', '--shipbigt=8']);
  eq(pfShip.code, 0, '⑧c `--pushfloor` 与显式 `--shipbigt` 同时给不该报错：' + pfShip.out.slice(0, 160));
  /* ⚠ 同 ⑧f/⑨h 那一族：`--pushfloor` 也是**摄魂侧**的注入旗标 ⇒ 这一臂会正当地印 `[shipdrain] … 顶成 0（关）`，
   *   所以"不许顶"只能钉在 `[shipbigt]` 自己那几行上，不能扫全 stdout（否则正确的行为会被判成我的失败）。 */
  const btLines = pfShip.out.split('\n').filter(function (l) { return l.indexOf('[shipbigt') === 0; }).join('\n');
  ok(btLines.indexOf('顶成') < 0, '⑧d 显式给了 `--shipbigt` 时**大雷那一行**不许说"顶"（实测含=' + (btLines.indexOf('顶成') >= 0) + '）'
    + '⇒ "旗标优先"是这条纪律的另一半，缺了它就没法连着现网档量');
  const pfBad = runE(['--pushfloor=2']);
  eq(pfBad.code, 2, '⑧e `--pushfloor=2`（越界）必须 exit 2，不许降级成"当没写"：实测 ' + pfBad.code);
  const pfBadLine = (/^.*⛔.*$/m.exec(pfBad.out) || ['(没有 ⛔ 行)'])[0];
  ok(pfBadLine.indexOf('--pushfloor') >= 0 && pfBadLine.indexOf('收到 `2`') >= 0,
    '⑧f 告警必须说**实际写的那个旗标**并回显**实际收到的值**（实测=' + pfBadLine.trim().slice(0, 120) + '）'
    + '⇒ DS 那版印的是"--pushrank 第四段…收到 `undefined`"：名字报错、值丢掉，读的人只会去找一个他根本没写的旗标（记忆第二十六条②）');

  /* ⑨ banner 不许把"旗标值"说成"引擎默认"（原来那句 `不设旗标 = 默认 <SHIP_EFFECTIVE>` 在 `--shipbigt=3` 的跑法里宣称默认是 3）*/
  const d3 = runE(['--shipbigt=3']);
  eq(d3.code, 0, '⑨a `--shipbigt=3` 不该报错：' + d3.out.slice(0, 160));
  const banner3 = (/^\[shipbigt\].*$/m.exec(d3.out) || ['(没有 banner 行)'])[0];
  ok(banner3.indexOf('默认档回读为 12') >= 0,
    '⑨b banner 必须报**引擎自己回读的默认档**（实测=' + banner3.slice(0, 150) + '）⇒ 把旗标值说成默认值，等于在日志里伪造"出厂形状"');
  ok(banner3.indexOf('= 默认 3') < 0, '⑨c 不许出现"默认 3"这种由旗标值反推的说法（实测含=' + (banner3.indexOf('= 默认 3') >= 0) + '）');

  /* ⑩ §E278（文档与代码必须同侧）：DS 的 v1.6.0 条目原文写着"`js/ui/ui.js` 的 `EPIRUS_BIGT_PUSH_N` 可调"，
   *   而那个页面级旋钮在 **v1.5.333 就被撤掉了**（①e 正是钉它不许回来）⇒ 照着 CHANGELOG 去页面找开关的人必然扑空。
   *   D8 只核版本号三处一致、D205 只核门号在册，**都管不到"文档指向一个已经不存在的旋钮"**这一类。 */
  const cl = readFileSync('CHANGELOG.md', 'utf8');
  const clCut = cl.indexOf('\n## v1.5.');
  ok(clCut > 400, '⑩a 抽取的"v1.6.x 区段"必须**非空且真的到 v1.5 为止**（实测边界 ' + clCut + '）⇒ 区段取空（或整个文件都在区段外）这条腿就是永绿装饰');
  const v16zone = cl.slice(0, clCut);
  const knobInPage = uiSrc.indexOf('EPIRUS_BIGT_PUSH_N') >= 0;
  ok(!knobInPage, '⑩b **代码侧**：`js/ui/ui.js` 里不许有这个页面级旋钮（实测含=' + knobInPage + '）⇒ 这一条与 ①e 同源，但 ①e 钉的是"不许调用 setter"，这里钉的是"常数本身也不许回来"');
  ok(v16zone.indexOf('EPIRUS_BIGT_PUSH_N') < 0,
    '⑩c **文档侧**：v1.6.x 的条目里不许把它当成可调项写给用户（实测含=' + (v16zone.indexOf('EPIRUS_BIGT_PUSH_N') >= 0) + '）⇒ 代码里没有、文档里说有，比"文档少写一句"贵（用户会去页面找那个不存在的开关）');

  /* ===== ⑫ §E282（v1.6.3 · 用户 10-03 夜裁定「接到风格 bot 席，默认难度也看得见」）=====
   * 起因：这一档原本只路过 `policyChooserN` ⇒ 只有难度=「冠军（最强）」的席位才在用这颗包，其余五个具名难度实测 **0 张/200 局**（§E281）。
   * 修法是把外壳 `wrapBigTPush` 包在脚本席的 pick 外面。⚠ 这一族最贵的风险是"抄第二份散列"与"作用面悄悄扩大"，
   *   所以这里既钉**行为**（关档透传 / 命中才动 / 不问意愿问牌 / 不吃随机流 / 剂量单调），也钉**接线与边界**（只有一个调用点、且只在多人；工具侧一次都不许用）。 */
  const sb12 = sandbox(process.cwd());
  const TE12 = sb12.EpirusTrainer, R12 = sb12.EpirusRules, S12 = sb12.EpirusState;
  ok(typeof TE12.wrapBigTPush === 'function' && typeof TE12.bigTPushSalt === 'function',
    '⑫a 外壳与散列都必须是**导出的**（否则门只能钉字符串，"只有一份实现"这句话钉不住）');
  ok(/const hit = bigTPushPick\(state, pid, aff\);/.test(evoSrc) && (evoSrc.match(/% BIGT_PUSH/g) || []).length === 1,
    '⑫b 全仓 `evo.js` 里**只许有一处** `% BIGT_PUSH`（实测 ' + (evoSrc.match(/% BIGT_PUSH/g) || []).length + ' 处）'
    + '⇒ 散列/档位一旦被抄第二份，就会"页面这档生效、考卷那档没生效"（§E274 的 G5 盲区换个位置复发）');
  const botPick = { key: R12.SK.JI, target: 1, target2: null, bead: null };
  const bot = function () { return botPick; };
  const mkSt = function (round, salt) {
    let calls = 0;
    const st = S12.createState('multi', { next: function () { calls++; return 0.5; } }, 5);
    st.round = round; st.slotSalt = salt >>> 0;
    for (let i = 0; i < 5; i++) st.p[i].ep = i === 0 ? 8 : 0;
    return { st: st, calls: function () { return calls; } };
  };
  const LEGAL = [{ key: R12.SK.JI, affordable: true }, { key: R12.SK.BIG_T, affordable: true }];
  const LEGAL_NOBT = [{ key: R12.SK.JI, affordable: true }];
  const LEGAL_UNAFF = [{ key: R12.SK.JI, affordable: true }, { key: R12.SK.BIG_T, affordable: false }];
  TE12.setBigTPush(0);
  let offAllSame = true;
  for (let r = 1; r <= 24 && offAllSame; r++) {
    const m = mkSt(r, 4242 + r * 7);
    if (TE12.wrapBigTPush(bot)(m.st, 0, LEGAL) !== botPick) offAllSame = false;
  }
  ok(offAllSame, '⑫c **关档必须是纯透传**（24 个回合逐一验：返回值就是 bot 自己那一手，同一个对象）⇒ 否则"默认值 0 = 关掉"是纸面的');
  TE12.setBigTPush(12);
  let hitRound = -1, missRound = -1;
  for (let r = 1; r <= 60 && (hitRound < 0 || missRound < 0); r++) {
    const m = mkSt(r, 90210);
    const h = (TE12.bigTPushSalt(m.st, 0) % 12) === 0;
    if (h && hitRound < 0) hitRound = r;
    if (!h && missRound < 0) missRound = r;
  }
  ok(hitRound > 0 && missRound > 0, '⑫d 夹具里必须同时找得到"命中"与"不命中"的回合（实测 ' + hitRound + ' ‖ ' + missRound + '）⇒ 找不到就是散列没落地');
  const mh = mkSt(hitRound, 90210), ms = mkSt(missRound, 90210);
  const ph = TE12.wrapBigTPush(bot)(mh.st, 0, LEGAL);
  ok(ph && ph.key === R12.SK.BIG_T && typeof ph.target === 'number',
    '⑫e 命中 + 这张牌打得出来 ⇒ 必须交出这一手并**带上目标**（实测 key=' + (ph && ph.key) + ' target=' + (ph && ph.target) + '）');
  const pm = TE12.wrapBigTPush(bot)(ms.st, 0, LEGAL);
  ok(pm === botPick, '⑫f **没命中就必须逐字不动**（实测换了=' + (pm !== botPick) + '）⇒ 命中判错一个方向，整档就变成"每回合都打大雷"');
  const pn = TE12.wrapBigTPush(bot)(mh.st, 0, LEGAL_NOBT);
  ok(pn === botPick, '⑫g 命中但**手上没这张牌** ⇒ 不许动（实测换了=' + (pn !== botPick) + '）⇒ 窗口问的是牌，不是意愿');
  const pa = TE12.wrapBigTPush(bot)(mh.st, 0, LEGAL_UNAFF);
  ok(pa === botPick, '⑫h 命中但**不可付**（5 珠/封锁由引擎判）⇒ 不许动 ⇒ 这一层绝不能自己判价格，否则规则一改就漂');
  const rngA = mh.calls(); TE12.wrapBigTPush(bot)(mh.st, 0, LEGAL); const rngB = mh.calls();
  ok(rngB === rngA, '⑫i 外壳**一次都不许碰 `state.rng`**（实测调用前后随机流抽了 ' + (rngB - rngA) + ' 次）⇒ 新增随机流会让同种子的两臂漂向不同轨迹');
  /* ⚠ 夹具形状：这里**必须像真桌那样变**（一局一个盐，变的是"回合 × 座位"）。
   *   我第一版写的是 `slotSalt = r * 2654435761`（盐跟着回合号线性走）⇒ 240 组**全部命中**（N=12 也 240/240），
   *   那条腿当时是**永绿的装饰**（记忆第十九条"夹具必须用真池子"、第二十三条"先证明各档位是同一份样本"）。 */
  let n1 = 0, n4 = 0, n12 = 0;
  for (let r = 1; r <= 48; r++) {
    for (let pid = 0; pid < 5; pid++) {
      const m = mkSt(r, 90210);
      const v = TE12.bigTPushSalt(m.st, pid);
      if (v % 1 === 0) n1++;
      if (v % 4 === 0) n4++;
      if (v % 12 === 0) n12++;
    }
  }
  ok(n1 === 240 && n4 >= 40 && n4 <= 110 && n12 >= 8 && n12 <= 50 && n12 < n4,
    '⑫j 剂量必须**真的按 1/N 落地**（240 组"回合 × 座位"：N=1 ⇒ ' + n1 + ' ‖ N=4 ⇒ ' + n4 + '（期望 ~60）‖ N=12 ⇒ ' + n12 + '（期望 ~20））'
    + '⇒ 三个档位的命中数必须**分层**，全命中 = 散列退化成恒真（实测已见过：盐跟着回合号线性生成时 240/240 全命中）');
  const camAt = uiSrc.indexOf('function chooseAIMulti');
  const wrapAt = uiSrc.indexOf('wrapBigTPush(');
  const nextFn = uiSrc.indexOf('\n  function ', camAt + 20);
  ok(camAt >= 0 && wrapAt > camAt && (nextFn < 0 || wrapAt < nextFn),
    '⑫k 页面上这一层**只能接在脚本席那一段**里（实测 chooseAIMulti@' + camAt + ' ‖ wrap@' + wrapAt + ' ‖ 下一个函数@' + nextFn + '）' +
    '⇒ v1.6.6 起这一条路同时服务 2~5 人（旧的 2 人专属 AI 路径已删），所以"多人"这个词换成了"脚本席"——不许把它接到冠军席前面');
  eq((uiSrc.match(/wrapBigTPush\(/g) || []).length, 1,
    '⑫l `ui.js` 里这层的调用点必须**恰好 1 处**（实测 ' + (uiSrc.match(/wrapBigTPush\(/g) || []).length + '）⇒ 一处实现、两处读数的形状不许复活。' +
    '⚠ 旧文案那句"2 人那条路不许包（用户裁定 2p 不用大雷）"随 2 人专属路径一起作废：现在 2 人桌选到风格/极限档也会走到这一行，' +
    '实测密度由 `tools/probe-diff-ladder.mjs` 一并印出（2人·3血·2P 包：贪心档 0.29 ‖ 极限档 0.09 张/桌）⇒ 这是"合并"的必然后果，不是偷偷加的剂量');
  const toolSrc = ['tools/eval-5p.mjs', 'tools/behavior-profile.mjs', 'js/train/bots.js']
    .map(function (f) { return readFileSync(f, 'utf8'); }).join('\n');
  ok(toolSrc.indexOf('wrapBigTPush') < 0,
    '⑫m **工具侧一次都不许用**（实测含=' + (toolSrc.indexOf('wrapBigTPush') >= 0) + '）⇒ 考卷/门禁里的脚本对手必须逐字不变，否则今晚之前所有配对读数全部作废');
});

t('D225 §E275/§E284 摄魂指法的"残血只在**探索里**软提升"档（evo.js 的 DRAIN_PUSH · v1.6.4 起**默认 1=开**）：默认值在册 · 不改规则可证 · 只在 ε>0 的 soft 分支生效 · 窗口与剂量用纯函数直读 · 贪心臂不许把"看不见"读成"没效果" · 与大雷对称的顶档纪律 · 落盘带两维', function () {
  const evoSrc = readFileSync('js/train/evo.js', 'utf8');
  const coreState = readFileSync('js/core/state.js', 'utf8');
  const coreRules = readFileSync('js/core/rules.js', 'utf8');
  const evSrc = readFileSync('tools/eval-5p.mjs', 'utf8');

  /* ① 结构钉：默认关 + 钩子的**作用面**（探索分支内，不是决策入口） */
  ok(/^\s*let DRAIN_PUSH = 1;$/m.test(evoSrc),
    '①a `DRAIN_PUSH` 的默认必须是 **1（开）** ⇒ 用户 10-03 夜依 §E283 的**实机**读数裁定开（3 血桌上每 4.3 局一张 ‖ 关档 0 张/200 局 ‖ 代价 +0.08±0.09 ‖ +0.07±0.07pt 噪声内）。'
    + '⚠ 形状翻转的安全性说明同 D224①b：只改这一格而忘了改下面的横幅/顶档腿，会红在 ⑨ 而不是静默放过');
  ok(/function setDrainPush\(v\)/.test(evoSrc) && /setDrainPush[\s,}]/.test(evoSrc.slice(evoSrc.indexOf('global.EpirusTrainer'))),
    '①b `setDrainPush` 必须导出到 `EpirusTrainer`（否则评测无法下达、"实装"就只剩注释）');
  const hookAt = evoSrc.indexOf('if (drainPushWants(state, pid)) forced.push(R.SK.DRAIN);');
  ok(hookAt > 0, '①c 钩子必须在（挂到 `forced` 那个 v1.5.142 的老口子上 ⇒ **并进探索集**，不是强行落子）');
  const softAt = evoSrc.indexOf("if (epsMode === 'soft') {");
  ok(hookAt > softAt && softAt > 0, '①d 钩子必须落在 `epsMode === \'soft\'` 的分支里 ⇒ 用户要的是"仅调整探索时"，训练/门禁 ε=0 走不到 ⇒ 既有读数逐字不变');
  ok(hookAt < evoSrc.indexOf('pick = cands[keyIdx[top'), '①e 钩子必须在**抽键之前**（抽完再挂就是装饰）');

  /* ② "不改规则"必须是**可证的**，不是我说一句"我没碰 core"就算 */
  ok(/drainHpMax/.test(coreState) && /R\.SK\.DRAIN/.test(coreState),
    '②a `js/core/state.js` 里那张牌的合法性仍由 `mode.drainHpMax` 判 ⇒ 探索侧没有任何一行去改它');
  ok(/drainHpMax: 1/.test(coreRules) && /drainHpMax: 2/.test(coreRules),
    '②b `rules.js` 里 multi=≤1 / long=≤2 两个窗口值一字未动（改了它就是**改规则**，那是用户裁定级）');
  /* ⚠ 这里判的是"**写**了这个字段"，不是"提到了这个名字"——第一版我写成 `indexOf('drainHpMax') < 0`，
   *   于是我自己在注释里写的那句"`mode.drainHpMax` 一个字都不改"当场把它判红（门被解释文本绊倒 = 假红，见 D224①e 的同族）。 */
  ok(!/\.drainHpMax\s*=[^=]/.test(evoSrc) && !/delete\s+\S*\.drainHpMax/.test(evoSrc),
    '②c `evo.js` 里**不许写** `drainHpMax`（赋值或删除）⇒ 一旦出现就是引擎在偷偷改牌的门槛，那是改规则');

  /* ③ 纯函数直读合成表（记忆第十九条：这类"名单/窗口"式的腿在短夹具上是永绿装饰 ⇒ 必须能在一次调用里判形状） */
  const TE = sandbox(process.cwd()).EpirusTrainer;   // `sandbox()` 返回的就是 `sb.window`（`audit-lib.mjs:30`），CORE 里已含 evo.js
  ok(typeof TE.drainPushWants === 'function' && typeof TE.setDrainPush === 'function',
    '③a 窗口判定必须是**导出的纯函数**（否则门只能钉字符串，钉不住行为）');
  const fake = function (hp, round, salt) { return { slotSalt: salt >>> 0, round: round, p: [{ hp: hp, ep: 3 }, { hp: 3, ep: 0 }] }; };
  TE.setDrainPush(0);
  ok(TE.drainPushWants(fake(1, 5, 7), 0) === false, '③b 关档 ⇒ 一律 false（默认值不是摆设）');
  TE.setDrainPush(1);
  ok(TE.drainPushWants(fake(1, 5, 7), 0) === true, '③c 开档 + 自己 hp=1 ⇒ true');
  ok(TE.drainPushWants(fake(2, 5, 7), 0) === false,
    '③d **hp=2 ⇒ false**：残血门槛是加在"提升"上的，不是加在牌上的 ⇒ 长程桌（牌本身 ≤2 可打）里 HP=2 的自己不会被提');
  ok(TE.drainPushWants(fake(0, 5, 7), 0) === false, '③e 已阵亡（hp=0）⇒ false（别把"死人窗口"算成兑现）');
  let hits = 0;
  TE.setDrainPush(4);
  for (let r = 1; r <= 40; r++) if (TE.drainPushWants(fake(1, r, (r * 2654435761) >>> 0), 0)) hits++;
  ok(hits >= 3 && hits <= 22, '③f N=4 时 40 个 (回合, 盐) 组合里命中数应在 ~10 附近（实测 ' + hits + '）⇒ 0 = 剂量不落地，接近 40 = 散列退化成恒真');

  /* ④ 工具侧：ε=0 的臂必须**拒跑**，不许把"结构性看不见"读成"没效果" */
  /* `runE` 见文件头那一份（v1.7.67 收拢：此前两处逐字相同） */
  const blind = runE(['--shipdrain=1']);
  eq(blind.code, 2, '`--shipdrain=1` 但不给 ε 必须 exit 2（实测 ' + blind.code + '）⇒ 贪心臂上这一档永不触发，静默跑完会被记成"这一档没效果"');
  ok(/永不触发/.test(blind.out), '④a 拒绝时要把**为什么**说清楚（实测输出里没那句解释）');
  for (const bad of [['--shipdrain=13'], ['--shipdrain=0.5'], ['--shipdrain=abc']]) {
    const rb = runE(bad);
    eq(rb.code, 2, '`' + bad.join('') + '` 必须 exit 2（实测 ' + rb.code + '）');
  }
  const on = runE(['--shipdrain=1', '--eps=0.2', '--eps-mode=soft']);
  eq(on.code, 0, '④b 页面口径（ε=0.2 soft）下的开档臂必须跑得通：' + on.out.slice(0, 200));
  ok(/\[shipdrain\] 引擎档 = 1/.test(on.out), '④c 必须印出**引擎回读**到的档（横幅文案改了就要红，因为"生效与否"只能由这一行证明）');

  /* ⑤ 落盘身份：两维都必须在（配对尺靠 `#eps` 拒绝"贪心 vs 页面口径"跨世界配对） */
  ok(/'#shipdrain=' \+ String\(DRAIN_EFFECTIVE\)/.test(evSrc), '⑤a `#shipdrain=` 必须进落盘（且写的是**回读值**）');
  /* §E599（2026-10-12 DS 修）：本条原来是**源码字面**断言 `/'#eps=' \+ \(SHIP_EPS > 0/` ——
   *   §E597 给 `eval-5p.mjs` 加 `--eps-tier=` 时，同一行被改成三元式
   *   （`EPS_TIER ? 'tier:…' : (SHIP_EPS > 0 ? … : '0')`）⇒ **行为没坏、断言坏了**（钉文本不钉行为的又一例）。
   *   改法：钉"落盘里真有一行 `#eps=`，且它的 ε 来路同时覆盖 `--eps=` 与 `--eps-tier=`" ⇒
   *   以后往这一行加第三种来路不必改门，而**删掉/注释掉**这一维照样红（⑤b′ 的合成正对照咬这个）。 */
  const epsTagLine = (evSrc.split('\n').filter(function (l) { return l.indexOf("'#eps='") >= 0; })[0] || '');
  ok(epsTagLine && epsTagLine.indexOf('EPS_TIER') >= 0 && epsTagLine.indexOf('SHIP_EPS') >= 0,
    '⑤b `#eps=` 必须进落盘、且这一维要同时覆盖 `--eps=` 与 `--eps-tier=` 两条来路 ⇒ 少了它，摄魂档的"必然相同"会被当成"测过没效果"'
    + '（读到的那一行：' + (epsTagLine.trim().slice(0, 130) || '**没有 `#eps=` 那一行**') + '）');
  ok(!!epsTagLine && !/^\s*\/\/.*#eps=/.test(epsTagLine) && !/if\s*\(\s*false\s*\)/.test(epsTagLine),
    '⑤b′ 合成正对照：把那一维注释掉或塞进 `if (false)` ⇒ 本条必须红（否则它只是在门里抄了一遍源码）');

  /* ⑥ 兑现率必须真落在落点上（同 D224④ 那一族：判**密度**、判**两臂之差**，不判"出现过"）
   *    §E588：这里第 4 个位置参数（`eval-5p` 的包文件）从"缺省=活槽"改成**钉住的夹具包** ——
   *    这条腿判的是 `DRAIN_PUSH` 的剂量-反应，与槽里躺着谁无关（旧包 82‖19 通过，v1.6.62 换上去的新包
   *    482‖469 几乎持平 ⇒ 门红在夹具身上，不是红在旋钮身上；新包那一笔读数记进 §E588 日志，不靠门保）。 */
  const runP = function (extra) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '8', '5', '77000', FIXTURE_PACK, '--pool=all', '--every=48',
      '--eps=0.2', '--eps-mode=soft'].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  const dOf = function (txt) { const m = /真打出 \*\*(\d+) 张 \/ (\d+) 局/.exec(txt); return m ? { casts: Number(m[1]), games: Number(m[2]) } : { casts: NaN, games: NaN }; };
  const d1 = runP(['--shipdrain=1']), d4 = runP(['--shipdrain=4']), d0 = runP(['--shipdrain=0']);
  eq(d1.code, 0, '⑥a N=1 臂要跑得通：' + d1.out.slice(0, 200));
  const u1 = dOf(d1.out), u4 = dOf(d4.out);
  ok(isFinite(u1.casts) && u1.casts > 0, '⑥b N=1 时引擎必须数出摄魂真被打出来（实测 ' + (isFinite(u1.casts) ? u1.casts : '读不出') + '）⇒ 读不出就是钩子没接进探索那一支');
  ok(isFinite(u4.casts) && u4.casts > 0 && u4.casts < u1.casts,
    '⑥c N=4 的张数必须**严格低于** N=1（实测 ' + u1.casts + ' ‖ ' + u4.casts + '）⇒ 不降就是剂量没接上');
  void d0;

  /* ⑦ §E274：G5 必须**两行分开判**（关掉档 ≤25% 与带上线档 ≤40%）—— 这是"把门开进引擎"换来的那条洞的正面处理。
   *   ⚠ 钉的是形状而不是措辞：两行都得在、两个阈值都必须是**具名常量**，且"关掉档"那一行的阈值不许被放宽（放宽它 = 用一档抽样噪声去遮掩包的破防能力）。 */
  const gdSrc = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(/const G5_MAX = 25, G5_MAX_DEPLOY = 40;/.test(gdSrc),
    '⑦a G5 的两个阈值必须是**同一行的具名常量**（25 / 40）⇒ 改了要在这里响，不许像 `sed` 那样静默漂（本仓 D8/D205 同族）');
  ok(/tag: '', dose: 0, max: G5_MAX/.test(gdSrc) && /tag: '带档', dose: savedPush, max: G5_MAX_DEPLOY/.test(gdSrc),
    '⑦b 两行必须分别是"关掉档判 `G5_MAX`"与"带上线档判 `G5_MAX_DEPLOY`"（顺序反了 = 原门被放宽、新门形同虚设）');
  const g5pos = gdSrc.indexOf('G5${PASS.tag}[');
  ok(g5pos > 0 && gdSrc.indexOf('G5_MAX_DEPLOY') < gdSrc.indexOf('=== G6'), '⑦c G5 的双行必须在 G6 之前（跑到别的门里去就不叫 G5 了）');
  /* 合成正对照：把"带档"那一行抹掉，判据必须响 —— 否则 ⑦b 是钉给字符串的装饰。 */
  const noDeploy = gdSrc.replace(/G5_MAX_DEPLOY/g, 'G5_MAX');
  ok(!/tag: '带档', dose: savedPush, max: G5_MAX_DEPLOY/.test(noDeploy),
    '⑦d 合成正对照：把带档阈值改回 G5_MAX 时，⑦b 那条抽取式必须失配（不失配 ⇒ 它其实什么都没钉）');

  /* ===== ⑧ §E278：旗标**写法**（大小写与连字符）也是量具的一部分 =====
   * 复发过程很干净：§E266 那次是 `--drainHp` vs `--drainhp`，修法=让含糊拼写 exit 2 —— 但那条修复**只钉了那一面旗标**。
   * v1.6.0 把第四段正名成 `--pushfloor` 之后，`--pushFloor=0.6`（大写 F）又回到"落进一个没人读的键、整条臂静默等于上一档"的状态
   *   （实测 exit 0、一声不响 ⇒ 两臂读数会被配成"剂量没差别"）。⇒ 这次把纪律做成**一张名单 + 一道通用守卫**，不再一枚一枚补。 */
  const idListM = /const IDENTITY_FLAGS = \[([\s\S]*?)\];/.exec(evSrc);
  ok(!!idListM, '⑧a 守卫必须有**一张具名名单**（`IDENTITY_FLAGS`）⇒ 散在各处的"这一枚我记得校验"就是 §E266 复发的原因');
  const idList = (idListM ? idListM[1] : '').split(',')
    .map(function (s) { return s.trim().replace(/^['"]|['"]$/g, ''); }).filter(Boolean);
  ok(idList.length >= 18, '⑧b 名单枚数必须 ≥18（实测 ' + idList.length + '）⇒ 名单式纪律要钉数量，删一枚就得响（记忆第十六条）');
  const idUnread = idList.filter(function (k) {
    return !(new RegExp('FLAG\\.' + k + '\\b').test(evSrc) || new RegExp("FLAG\\['" + k + "'\\]").test(evSrc));
  });
  eq(idUnread.length, 0, '⑧c 名单里每一枚都必须**真有读点**（读不到=' + idUnread.join(',') + '）'
    + '⇒ 把死键写进名单 = 守卫守着一个没人用的名字，而正写的旗标反倒没人管（我写这一格的第一版就把 `drainHp` 误登记成 `drainhp`，被这条抓回）');
  const idNorm = idList.map(function (k) { return k.toLowerCase().replace(/-/g, ''); });
  eq(new Set(idNorm).size, idNorm.length, '⑧d 抹掉大小写与 `-` 之后不许撞名（实测 ' + idNorm.length + ' 枚只剩 ' + new Set(idNorm).size + ' 个）'
    + '⇒ 撞了就会对**正确写法**报"正确写法是另一个"，那是一道永远红的假守卫');
  const badSpell = [];
  for (const b of ['--pushFloor=0.6', '--shipBigT=8', '--epsMode=soft', '--drainhp=3', '--push-key=drain']) {
    const rb = runE([b]);
    if (rb.code !== 2) badSpell.push(b + '(实测 ' + rb.code + ')');
  }
  eq(badSpell.length, 0, '⑧e 含糊拼写必须**全部** exit 2（漏网=' + (badSpell.join(' ') || '无') + '）⇒ 静默忽略一个拼错的臂，比报错贵得多');
  /* 反面对手：正确写法**不许**被这道守卫挡（否则它会变成第二道 D221 那种"永红"装饰）。 */
  const goodSpell = [];
  for (const g of ['--pushfloor=0.6', '--shipbigt=8', '--eps-mode=soft', '--drainHp=3', '--pushkey=drain', '--epsk=6']) {
    const rg = runE([g]);
    if (rg.code !== 0) goodSpell.push(g + '(实测 ' + rg.code + '：' + rg.out.slice(0, 90) + ')');
  }
  eq(goodSpell.length, 0, '⑧f 正写必须放行（被挡=' + (goodSpell.join(' | ') || '无') + '）⇒ 名单里写的必须是读侧的实际拼写');

  /* ===== ⑨ §E284（v1.6.4）：默认档从 0 翻成 1 ⇒ 大雷那两条纪律必须**对称地**搬到摄魂侧 =====
   * ① 研究注入旗标（`--pushkey` / `--pushminep` / `--drainHp` / `--pushrank` / `--pushfloor`）出现而没显式 `--shipdrain` ⇒ 顶成 0，
   *    否则页面口径的臂上"软提升"和"提顺位/强制"会同时在动**同一张卡**（一次对照只能一个自由度）。
   * ② 默认开着之后，**贪心臂必须自己说出来"我看不见这一档"**（ε=0 下钩子走不到 ⇒ 输出与关档逐字相同）——
   *    否则下一个人会把这份"逐字相同"记成"测过、没效果"（这正是 §E266 那条口径缺陷的复发形状）。 */
  const dnPlain = runE([]);
  eq(dnPlain.code, 0, '⑨a 不设任何旗标的默认臂必须跑通：' + dnPlain.out.slice(0, 160));
  /* ⚠ 三条 ⑨ 腿全部**只看 `[shipdrain` 自己那几行**：`--pushkey` 之类同时是两面的注入旗标，大雷那行也会印"顶成 0（关）"；
   *    拿全 stdout 找共同词 = 假绿（这条是被"关掉顶档"那一刀变异抓出来的，不是想出来的）。 */
  const dnOf = function (txt) { return txt.split('\n').filter(function (l) { return l.indexOf('[shipdrain') === 0; }).join('\n'); };
  ok(/DRAIN_PUSH = 1|引擎默认档 = 1/.test(dnOf(dnPlain.out)),
    '⑨b 默认档必须由**引擎回读**印在 `[shipdrain]` 自己那行里（实测该行=' + (dnOf(dnPlain.out).split('\n')[0] || '(没有 shipdrain 行)').slice(0, 110) + '）');
  ok(dnOf(dnPlain.out).indexOf('永不触发') >= 0,
    '⑨c 贪心臂（ε=0）必须**自己声明**这一档永不触发（实测没印 ⇒ 默认开着时的"逐字相同"会被读成"测过没效果"）');
  const dnInj = runE(['--pushkey=drain', '--pushminep=0']);
  eq(dnInj.code, 0, '⑨d 摄魂侧注入臂不该报错：' + dnInj.out.slice(0, 160));
  ok(dnOf(dnInj.out).indexOf('顶成 0（关）') >= 0,
    '⑨e 出现摄魂侧注入旗标时，**`[shipdrain]` 那一行**必须说顶掉了引擎默认档（实测=' + (dnOf(dnInj.out).split('\n')[0] || '(没有 shipdrain 行)').slice(0, 110) + '）'
    + '⇒ 不顶就是"软提升 + 这一面旗标"同时在动 `drain` 这张卡（两个自由量）');
  ok(dnOf(dnInj.out).indexOf('永不触发') < 0,
    '⑨f 已经顶成 0 之后**不许再印**"默认档=1 但永不触发"（实测含=' + (dnOf(dnInj.out).indexOf('永不触发') >= 0) + '）⇒ 两行互相矛盾等于没有回读');
  const dnBoth = runE(['--pushkey=drain', '--shipdrain=1', '--eps=0.2', '--eps-mode=soft']);
  eq(dnBoth.code, 0, '⑨g 显式 `--shipdrain` + 注入旗标同时给不该报错：' + dnBoth.out.slice(0, 160));
  /* ⚠ 判据只许看**自己那一面旗标的行**：`--pushkey` 同时是"大雷侧的注入旗标" ⇒ 这一臂必然还印着 `[shipbigt] … 顶成 0（关）`，
   *   拿全 stdout 找"顶成"会把那条正确的行判成我这一条的失败（=记忆第二十六条②"窄化/宽化的告警比真守卫更误导"的镜像形状：键集合要钉在同一个名单上）。 */
  const dnLines = dnBoth.out.split('\n').filter(function (l) { return l.indexOf('[shipdrain') === 0; }).join('\n');
  ok(dnLines.indexOf('顶成') < 0, '⑨h **显式给了就不许顶**（实测 `[shipdrain]` 行里含顶档=' + (dnLines.indexOf('顶成') >= 0) + '）⇒ "旗标优先"是这条纪律的另一半');
  ok(/引擎档 = 1/.test(dnLines), '⑨i 显式档也要由引擎回读后印在**它自己那行**里（实测该行=' + (dnLines.split('\n')[0] || '(没有 shipdrain 行)').slice(0, 90) + '）');

  /* ⑩（v1.6.4 加的"文档措辞"三条腿：README 必须出现 `DRAIN_PUSH` / 提到它的那一行不许写与默认相反的词）
   *   已于 v1.6.10 **整段删除** —— 判据见 CHANGELOG v1.6.10 与 `docs/METHODOLOGY.md` 第 89 条。 */
});

t('D226 §E285 人数 × 血量正交（v1.6.5 · 用户裁定「把 2 人合并进多人，变成选人数 × 3血/5血正交；4 血也可以上，实现连续性」）：`multi4` = `multi` 那一套 + 一格血 · 页面那张映射表的像必须恰好盖住 MODES 全部 key · **2 人时三张多人专用卡在 4/5 血格上也要自动屏蔽**（用户点名要复测的那条）· 第三根「模式」轴与零消费者的 minPlayers 都不许复活', function () {
  const uiSrc = readFileSync('js/ui/ui.js', 'utf8');
  const html = readFileSync('index.html', 'utf8');
  const rulesSrc = readFileSync('js/core/rules.js', 'utf8');

  /* ===== ① 4 血是"多一格血"，不是第四套规则 ⇒ 除 hp/name 外**逐字段**与 multi 同值 =====
   * 这条钉的是我这一版的设计决定：以后谁想给 4 血配一套新门槛/新上限，必须**同时改这条腿**，
   * 也就是必须过一次用户裁定级（`BIG_T` 的价、摄魂窗口、收缩起点都是裁定过的数）。 */
  const m4 = R.MODES.multi4, m3 = R.MODES.multi;
  ok(!!m4 && !!m3, '①a `R.MODES.multi4` 与 `R.MODES.multi` 都必须在册');
  eq(m4.hp, 4, '①b `multi4.hp` = 4');
  eq(m4.drainHpMax, m3.drainHpMax, '①c 摄魂窗口与 `multi` 同值（不同就是第四套规则了）');
  eq(m4.suddenDeath, m3.suddenDeath, '①d 终局收缩起点与 `multi` 同值');
  eq(m4.maxRounds, m3.maxRounds, '①e 回合上限与 `multi` 同值（两边都不设 ⇒ 都走全局 60）');
  eq(m4.skills.length, m3.skills.length, '①f 卡表与 `multi` 同长（都是 AVAILABLE_MULTI，含三张多人专用）');
  eq(R.MODES.standard.hp, 3, '①g `standard` 仍是 3 血 —— 2 人 · 3 血那一格走的是 v1.0.0 冻结档，本版没动它');

  /* ===== ② 建局真取到 4 血（`state.mode.hp` 与每个座位的初始血一起判，缺一半就是"表上写 4、局里是 3"） ===== */
  for (let n = 2; n <= 5; n++) {
    const st = S.createState('multi4', { next: mulberry32(4000 + n) }, n);
    eq(st.mode.hp, 4, '② n=' + n + ' 的 multi4 局 `mode.hp` 必须是 4');
    eq(st.p.length, n, '② n=' + n + ' 的座位数必须真等于 n（页面那根人数轴要能落到 2~5 的每一格）');
    for (let i = 0; i < n; i++) eq(st.p[i].hp, 4, '② n=' + n + ' 席 ' + i + ' 的初始血必须是 4');
  }

  /* ===== ③ 映射只有一份来源，且它的**像**恰好 = MODES 的全部 key =====
   * 静态钉的是"表在不在、值对不对"；真跑 `modeFor` 的行为版在 `tools/smoke.mjs`（浏览器里把 12 种组合全过一遍）。
   * 两遍都要：静态会被重构架空（本仓记过账），行为版需要起浏览器、进不了 np 的快速路径。 */
  const tbl = /const HP_MODE = \{([^}]*)\}/.exec(uiSrc);
  ok(!!tbl, '③a `ui.js` 里那张 (血量 → 模式键) 表必须还在，且是这个字面形状（映射不许有第二份来源）');
  const hpMap = {};
  String(tbl ? tbl[1] : '').split(',').forEach(function (kv) {
    const p = kv.split(':');
    if (p.length === 2) hpMap[p[0].trim()] = p[1].trim().replace(/['" ]/g, '');
  });
  const twoPm = /const HP_MODE_2P = '([A-Za-z0-9_]+)'/.exec(uiSrc);
  ok(!!twoPm, '③b 2 人 · 3 血那一格（`HP_MODE_2P`）必须也在表里 —— 它不在 MODES 之外凭空建局');
  const modeKeys = Object.keys(R.MODES);
  const unknown = modeKeys.concat(['x']).filter(function (k) { return k !== 'x' && !hpMap[k]; });
  const vals = Object.keys(hpMap).map(function (k) { return hpMap[k]; }).concat(twoPm ? [twoPm[1]] : []);
  const ghosts = vals.filter(function (v) { return modeKeys.indexOf(v) < 0; });
  eq(ghosts.length, 0, '③c 映射表里有 MODES 中不存在的模式键（幽灵入口，D28 同族）：' + ghosts.join(', '));
  const uncovered = modeKeys.filter(function (k) { return vals.indexOf(k) < 0; });
  eq(uncovered.length, 0, '③d MODES 里有页面查不到的模式（**没有入口的模式**就是 D28 当年抓到的 `fast`/`lucky` 那种"有实现、有测试、无入口"）：' + uncovered.join(', '));
  /* 血量下拉的每一档都必须被表接住（否则选 6 血会静默回落到 3 血） */
  const hpOpts = [];
  const hpSel = /<select id="sel-hp">([\s\S]*?)<\/select>/.exec(html);
  ok(!!hpSel, '③e `index.html` 里必须有 `#sel-hp`（血量是玩家可见的一根轴）');
  const reH = /<option value="(\d+)"/g; let mh;
  while ((mh = reH.exec(hpSel ? hpSel[1] : ''))) hpOpts.push(mh[1]);
  eq(hpOpts.length, Object.keys(hpMap).length, '③f 血量下拉的档数必须等于映射表的行数（实测下拉 ' + hpOpts.length + ' 档 ‖ 表 ' + Object.keys(hpMap).length + ' 行）⇒ 多出来的那一档会静默回落到默认血量');
  for (const h of hpOpts) ok(!!hpMap[h], '③g 下拉里的 ' + h + ' 血在表里查得到');

  /* ===== ④ 用户点名的回归：2 人局里那三张多人专用卡必须屏蔽（**新开的 4/5 血格尤其要判**）=====
   * 旧版这条由 `standard` 的卡表（AVAILABLE_2P）挡着；现在 2 人也能开 `multi4`/`long`，
   * 那里的卡表是 AVAILABLE_MULTI ⇒ 唯一还挡着它的是 `canUseSkillInMode` 里"当前存活人数 ≤2"那一支（v1.5.140 用户裁定）。
   * 所以这一格必须**逐血量**判，不能只判 standard。 */
  for (const mk of ['standard', 'multi4', 'long']) {
    const st = S.createState(mk, { next: mulberry32(5150) }, 2);
    st.p[0].ep = 30;
    for (const sk of R.MULTI_ONLY) {
      ok(!S.canUseSkillInMode(st, sk), '④ ' + mk + ' · 2 人局里【' + (R.byKey[sk] || {}).name + '】必须不可用（人数=2 自动屏蔽这条不能只在新模式里失效）');
      ok(!Play.legalActions(st, 0).some(function (x) { return x.key === sk; }),
        '④ ' + mk + ' · 2 人局的**合法表**里也不许出现【' + (R.byKey[sk] || {}).name + '】（UI 亮着而引擎拒 = D131 那类分裂）');
    }
    /* 正对照（记忆第二十五条：没有对比度的守卫是假绿）：同一张牌在 5 人局必须真能亮 */
    const st5 = S.createState(mk === 'standard' ? 'multi4' : mk, { next: mulberry32(5150) }, 5);
    st5.p[0].ep = 30;
    let canAny = 0;
    for (const sk of R.MULTI_ONLY) { if (S.canUseSkillInMode(st5, sk)) canAny++; }
    ok(canAny === R.MULTI_ONLY.length, '④+ 正对照：5 人局里三张都必须可用（实测 ' + canAny + '/' + R.MULTI_ONLY.length + '）⇒ 数不到就说明这条屏蔽判的是别的量');
  }

  /* ===== ⑤⑥ 反漂移：第三根轴与那两个死字段都不许回来 ===== */
  ok(html.indexOf('sel-mode') < 0,
    '⑤a `index.html` 里不许再有 `#sel-mode`（人数与血量已经是两根独立的轴；把"模式"下拉加回来 = 两根轴重新被焊成一根）');
  ok(html.indexOf('id="sel-players"') >= 0, '⑤b 人数下拉必须在册');
  /* ⚠ 判"还在不在"要看**调用形状**：`applyAxes` 的注释里写了"旧版这根叫 syncModeOptions"，
   *   用裸 `indexOf('syncModeOptions')` 会被自己的解释文本绊红（D224①e 同族）。 */
  ok(!/syncModeOptions\s*\(/.test(uiSrc), '⑤c 旧那根反方向的 `syncModeOptions`（先选模式、再按人数置灰）不许复活成函数或调用点');
  ok(!/minPlayers\s*:/.test(rulesSrc) && !/maxPlayers\s*:/.test(rulesSrc),
    '⑥ `minPlayers`/`maxPlayers` 不许回到 MODES（v1.6.5 实测全库零消费者 ⇒ 留着就是"会说谎的字段"：2 人现在也能开 5 血长程）');

  /* ===== ⑦ 两个线上槽必须**真能解析并加载**（本轮真浏览器探针抓到的门洞）=====
   * 我往 2P bundle 的 `meta.fingerprintRefresh` 里塞了一对**英文双引号**（`含"收缩起点…"那条`）⇒ 整个文件语法坏、
   * 页面里 `window.EPIRUS_CHAMPION` 变成 `undefined`，而 **D16 全绿** —— 因为它只 regex 刮 meta 字符串和"槽那一行还在不在"，
   * 刮得动的文件未必解析得了。这是记忆第二十条（"生效了没不许由自己印的 banner 判"）的又一形状：**文本级判据判不出"这文件在 JS 里跑不起来"**。
   * ⇒ 这条把三件事变成断言：① `vm.Script` 解析得过 ‖ ② 真跑一遍，权重全局必须挂到 `window` 上 ‖ ③ meta 必须是**合法 JSON、不需要修补**。 */
  const slots = [['js/bundled-champion.js', 'EPIRUS_CHAMPION'], ['js/bundled-champion-3p.js', 'EPIRUS_CHAMPION_3P']];
  for (const pair of slots) {
    const f = pair[0], gvar = pair[1];
    const src = readFileSync(f, 'utf8');
    let perr = '';
    try { new vm.Script(src, { filename: f }); } catch (e) { perr = String((e && e.message) || e); }
    ok(perr === '', '⑦a ' + f + ' 必须解析得了（实测 ' + (perr || 'OK') + '）⇒ D16 刮文本刮得过，玩家浏览器却加载不到冠军');
    const ctx = { window: {}, console: { log: function () { }, warn: function () { }, error: function () { } } };
    vm.createContext(ctx);
    let rerr = '';
    try { vm.runInContext(src, ctx, { filename: f }); } catch (e) { rerr = String((e && e.message) || e); }
    ok(rerr === '' && ctx.window[gvar] != null,
      '⑦b ' + f + ' 真跑一遍必须把权重挂到 `window.' + gvar + '`（实测 报错=' + (rerr || '无') + ' ‖ 挂上=' + (ctx.window[gvar] != null) + '）');
    const metaJson = AUDIT.extractJsonObject(src, gvar + '_META');
    ok(!!metaJson, '⑦c ' + f + ' 的 `' + gvar + '_META` 必须抽得出（抽不出 = 页面/体检都读不到构建时成绩）');
    let pm = null, jerr = '';
    try { pm = AUDIT.parseMetaTolerant(String(metaJson), gvar); } catch (e) { jerr = String((e && e.message) || e); }
    ok(jerr === '', '⑦d ' + f + ' 的 meta 必须是合法 JSON（实测 ' + (jerr || 'OK') + '）');
    ok(jerr === '' && pm && (!pm.repaired || pm.repaired.length === 0),
      '⑦e meta 不许靠"修补"才能 parse（修补表 ' + (pm && pm.repaired ? pm.repaired.length : '?') + ' 条）⇒ 需要修补就说明写进去的文本已经带裸引号');
  }
});

t('D5 dualGun second shot must come from the same data row', function () {
  /* v1.4.7：第二发原先写死 amt:1/NORMAL/无 pierce，与注释"走数据表"矛盾 ——
   * 改 byKey.dualGun.dmg.amt 只会影响第一发（第十轮复核 §6-2 用内存改表验证）。
   * 这条用例就是那个内存改表的固化版：改表后两发都必须跟着变。 */
  const dg = R.byKey[R.SK.DUAL_GUN];
  const bakAmt = dg.dmg.amt;
  try {
    dg.dmg.amt = 2;
    const st = S.createState('multi', { next: mulberry32(81) }, 3);
    st.p[0].ep = 3; st.p[1].hp = 3; st.p[2].hp = 3;
    X.startTurn(st);
    const r = S.attemptAction(st, 0, R.SK.DUAL_GUN, { target: 1, target2: 2 });
    ok(r && r.outcome === 'ok', '双枪应能出手: ' + JSON.stringify(r));
    X.resolveActions(st);
    eq(3 - st.p[1].hp, 2, '第一发伤害应跟数据表(2)');
    eq(3 - st.p[2].hp, 2, '第二发伤害也必须跟数据表(2)，不能写死 1');
  } finally { dg.dmg.amt = bakAmt; }
});

t('D9 对手池单一来源里的每个 fn 都必须存在于 EpirusBots', function () {
  /* v1.4.14：第三次"加名字漏一处"（v1.3.59 漏 server、v1.4.8 漏 worker、v1.4.14 漏 opp-pool 本身）。
   * 这次的症状最隐蔽：服务端拿到未定义名字 → B[undefined] = undefined → 训练跑到中途才炸成
   * "sel is not a function"。这条用例把"名字 → 函数"这一步钉在测试期。 */
  const src = readFileSync('server/opp-pool.mjs', 'utf8');
  const items = [...src.matchAll(/\{ name: '([A-Za-z0-9_]+)', fn: '([A-Za-z0-9_]+)' \}/g)];
  ok(items.length >= 12, 'opp-pool.mjs 条目数异常: ' + items.length);
  for (const it of items) {
    ok(typeof Bots[it[2]] === 'function', 'opp-pool 的 ' + it[1] + ' → Bots.' + it[2] + ' 不存在');
  }
  ok(items.some(function (it) { return it[1] === 'reflectspam'; }), 'reflectspam 必须在池子里（v1.4.8）');
  ok(items.some(function (it) { return it[1] === 'ringspam'; }), 'ringspam 必须在池子里（v1.4.14）');
});

t('D10 训练模式必须真的透传到建局（setTrainMode(long) ⇒ 5 血）', function () {
  /* v1.5.0：`oneGameN` 从 v1.4.0 起就支持 `opts.mode`，但**训练路径没有一处传它** ——
   * 19 个 oneGameN 调用点里唯一传过的还是评测工具（eval-5p.mjs）。于是历次训练
   * （hA9 / hB12 / wall2 / ms2 / ring2…）全部按 'multi'（3 血）建局，
   * "5 血冠军"从来没被训过，产物 meta 里连模式字段都没有。
   * 这条用例不看返回值，直接盯**真正建出来的局用的模式**（state.mode.hp）——
   * 反证：把 evo.js 里 scoreMemberN / evalN / champEntropy 任意一处 mode 传参删掉，本条立刻红。 */
  const seen = [];
  const origGame = Play.autoGameN;
  Play.autoGameN = function (st) { seen.push(st.mode && st.mode.hp); return origGame.apply(Play, arguments); };
  try {
    const p = Pol.makePolicy(0.25);
    const opps = [{ name: 'random', sel: Bots.pickRandom }];
    T.setTrainMode('multi');
    seen.length = 0;
    T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
    ok(seen.length > 0, 'scoreMemberN 必须真的建局（否则本条是空转断言）');
    ok(seen.every(function (hp) { return hp === 3; }), '默认必须是 3 血(multi)，实测 hp=' + seen.join(','));
    T.setTrainMode('long');
    seen.length = 0;
    T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
    ok(seen.length > 0, 'setTrainMode(long) 后 scoreMemberN 仍必须建局');
    ok(seen.every(function (hp) { return hp === 5; }), 'setTrainMode(long) 后训练建局必须 5 血，实测 hp=' + seen.join(','));
    seen.length = 0;
    T.evalN(p, [[Bots.pickRandom, Bots.pickDefend]], 2, 3, 999);
    ok(seen.length > 0 && seen.every(function (hp) { return hp === 5; }), 'setTrainMode(long) 后 evalN 也必须建 5 血局，实测 hp=' + seen.join(','));
    seen.length = 0;
    T.champEntropy(p, 0.15, 2, 4242, 3);
    ok(seen.length > 0 && seen.every(function (hp) { return hp === 5; }), 'setTrainMode(long) 后 champEntropy 也必须建 5 血局，实测 hp=' + seen.join(','));
    ok(T.trainMode() === 'long', 'setTrainMode 之后 trainMode() 必须回读 long');
    T.setTrainMode('nonexistent');
    ok(T.trainMode() === 'long', '未知模式名不得悄悄改掉当前模式');
  } finally {
    Play.autoGameN = origGame;
    T.setTrainMode('multi');
  }
});

t('D15 ep 奖罚门槛必须按 (人数,模式) 走（用户锚点）+ 熵奖励已恢复', function () {
  /* v1.5.6（用户裁定）：用户回忆的"ep 奖励/惩罚"就是 stock 项，但门槛原先**写死 4/10**、与人数和模式无关
   * ⇒ 5 血里 11 ep 就被当囤积。锚点：3 人局 → 奖励到 **3 ep**、惩罚 **>10 ep**；
   * 5 人 · 5 血 → 奖励到 **5 ep**、惩罚 **>20 ep**。这里直接点纯函数的语义，不靠跑训练看数字。 */
  const B = T.economyStock;
  ok(typeof B === 'function', 'T.economyStock 必须存在（纯函数，便于钉门槛）');
  const t3 = T.economyTargets(3, 'multi'), t5 = T.economyTargets(5, 'long'), t4 = T.economyTargets(4, 'multi');
  eq(t3.target, 3, '3 人局奖励点 = 3'); eq(t3.cap, 10, '3 人局惩罚点 = 10');
  eq(t5.target, 5, '5 人 5 血奖励点 = 5'); eq(t5.cap, 20, '5 人 5 血惩罚点 = 20');
  eq(t4.target, 4, '4 人局落在中间（奖励点 4）');
  const b3 = B(3, 3, 'multi'), b10 = B(10, 3, 'multi'), b11 = B(11, 3, 'multi');
  ok(b3 > 0, '3 人局：到 3 ep 应有攒钱奖励（实测 ' + b3.toFixed(4) + '）');
  ok(Math.abs(b10 - b3) < 1e-9, '3..10 ep 不奖不罚（实测 ' + b10.toFixed(4) + '）');
  ok(b11 < b10, '超过 10 ep 开始惩罚（实测 ' + b11.toFixed(4) + ' < ' + b10.toFixed(4) + '）');
  const l5 = B(5, 5, 'long'), l20 = B(20, 5, 'long'), l21 = B(21, 5, 'long');
  ok(l5 > 0 && Math.abs(l20 - l5) < 1e-9, '5 人 5 血：到 5 ep 满额、到 20 ep 仍不罚');
  ok(l21 < l20, '超过 20 ep 才开始惩罚（实测 ' + l21.toFixed(4) + ' < ' + l20.toFixed(4) + '）');
  ok(B(15, 5, 'long') > B(15, 3, 'multi'), '同一个 15 ep：长程 5 人必须比 3 人 3 血宽松（人数/模式真的进了门槛）');
  /* 熵奖励：从 0 恢复，且权重必须小（"奖惩不用给太多"） */
  const er = T.economyReward();
  ok(er.divW > 0 && er.divW <= 0.2, '熵奖励权重要小而正（实测 divW=' + er.divW + '）');
  /* §E658（10-20 夜班）这条腿以前是**运气绿**，两处病一起修：
   *   ① 原来 `setRng` 写在 `makePolicy` **之后** ⇒ 策略初始化吃的是"跑到这里时进程里剩的 RNG 状态"，
   *     而策略长什么样决定那 2 局的座位分布 ⇒ 上游任何一条腿多动/少动一次随机都能把它翻红。
   *     实测（归档 `d15-residual.log.txt`）：只改 `makePolicy` 之前的 RNG 状态、跑 40 档，
   *     **7/40 = 18% 让下面那条断言崩**（最大残差 0.300），而崩的正是 `seatPen > 0` 那 7 个。⇒ 先播种再造策略。
   *   ② 引擎的 `fit` 实际是六项（`js/train/evo.js:2422`：`fitAgg + divBonus + STYLE_W*styleRate
   *     − seatPen + shapeBonus + gBonus`），而这里只断前三项 ⇒ 只要 `seatPen > 0` 就必然崩，
   *     而 `SEAT_PEN_W = 1.0` 是写死的常数（`:2370`）**不是开关**：2 局里同一席全赢就是 100%。
   *     ⇒ 改成断**全式**；`shapeBonus` 这一项不新增引擎读数，而是**先把档别钉住**（`s4W = 0` ⇒ `:2411` 那支恒 0）。
   *   ③ 开头补一次 `setEconomyReward({reset:true})` 做**自隔离** ⇒ 本腿不再依赖"前面哪些腿跑过"。 */
  T.setEconomyReward({ reset: true });
  Pol.setRng(T.mulberry32(4242));
  const p0 = Pol.makePolicy(0.25);
  const r = T.scoreMemberN(p0, [{ name: 'random', sel: Bots.pickRandom }], 2, 3, 1, 0, 0);
  eq(T.economyReward().s4W, 0, '本腿跑在出厂档（s4W=0 ⇒ shapeBonus 恒 0；下面那条全式已把它算进去，开着也不会假红）');
  /* 10-20 夜班自证抓到的边界：出厂 `STYLE_W = 0` ⇒ 式子里"风格切片"那一项恒 0，**这条断言盖不到风格路径**
   *   （变异实测：把 styleRate 挪 1e-3，残差仍是 0）。把它钉在文案里，别让下一个人以为全式过了=风格过了。 */
  eq(r.styleWeight, 0, '出厂风格权重必须是 0（≠ 0 ⇒ 本腿这条全式开始覆盖风格路径，但同时它不再是"风格项的自证"，要另立断言）');
  ok(!r.wallReject, '这次调用不该触发破墙硬过滤（走了 `fit = −5` 那条支 ⇒ 全式不适用，得换断法）');
  ok(Math.abs(r.fit - (r.fitNoDiv + r.divBonus + r.styleWeight * r.styleRate - r.seatPen + r.shapeBonus + r.gBonus)) < 1e-9,
    'fit 必须 = 池子分 + 熵奖励 + 风格切片 − 座位罚 + 形状项 + 广度罚（实测 fit=' + r.fit.toFixed(5)
    + ' ‖ seatPen=' + r.seatPen.toFixed(5) + ' ‖ shapeBonus=' + r.shapeBonus.toFixed(5) + ' ‖ gBonus=' + r.gBonus.toFixed(5)
    + ' ‖ seatMaxPct=' + (r.seatMaxPct == null ? '—' : r.seatMaxPct.toFixed(0)) + '）');
  /* v1.5.87（用户裁定 A）：进 fit 的熵改用与门禁同口径的 spDivNorm（自对局·成功非ジ动作），
   * 旧口径 divNorm 只留作对照 ⇒ 这条公式断言跟着改（它红过一次，正是它该做的事）。 */
  ok(Math.abs(r.divBonus - r.divW * r.spDivNorm) < 1e-9,
    'divBonus 必须 = divW × spDivNorm（实测 ' + r.divBonus.toFixed(5) + ' vs ' + (r.divW * r.spDivNorm).toFixed(5) + '）');
  ok(r.avgStock != null, '必须回报 avgStock（攒钱分）便于诊断');
  T.setEconomyReward({ reset: true });   // 复位，别污染后面的用例
});

t('D56 旧冠军嵌入 v7 后必须仍走旧口径（否则目标退化：实测破墙 12.25→7.70）', function () {
  /* v1.5.64（第五轮复核）：换回 eco-34 时用 upgrade-pack 嵌成 v7 容器，但 `LEGACY()` 靠
   * `shapeOf(params).legacy`（按 `params.length` 反推）判断 ⇒ 嵌入后 legacy=false ⇒ 被切到
   * **它从没训练过的** v7 候选口径（动作侧目标/珠权重为 0 ⇒ 分不出目标 ⇒ 目标退化成枚举顺序）
   * ⇒ 实测破墙伤害 12.25→7.70、穿透 242→152。修法：容器写 `lv`、读取挂到 params、chooser 认标记。 */
  /* §改（2026-10-22 千问·第六批）：这里原来三条是 `policy.js` 的**写法钉**
   *   （`function isLegacyChooser` ‖ `o.lv != null` ‖ `o.lv = p.legacyFrom`）。
   *   · 第一条与本门下面对 `Pol.isLegacyChooser(...)` 的**直接调用**重复 ⇒ 摘腿后变异：把函数改名（行为不变地全换名）
   *     仍被调用那条抓到 ⇒ 纯冗余，删。
   *   · 第二、三条钉的是"这一行在不在"，钉不住真正要防的洞（标记在存/读某一环丢掉 ⇒ 旧冠军被切到 v7 口径）。
   *     下面换成跑一遍 **pack → unpack 往返**，写法改名不再误红。 */
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
  /* 行为断言：同一份"旧形状权重"（3337 位）原生跑 vs 嵌入+标记跑 ⇒ 逐场结果必须相同。 */
  Pol.setRng(T.mulberry32(4242));
  const p7 = Pol.makePolicy(0.25);
  const legacy = new Float64Array(3337);
  for (let i = 0; i < legacy.length; i++) legacy[i] = p7[i];
  const emb = Pol.embedLegacy(legacy);
  ok(emb && emb.length === Pol.paramCount(), 'embedLegacy 必须把 3337 撑成 ' + Pol.paramCount() + ' 位');
  emb.legacyFrom = 6;
  ok(Pol.isLegacyChooser(emb) === true, '带 lv 标记的嵌入包必须被判为旧口径');
  ok(Pol.isLegacyChooser(p7) === false, '纯 v7 包不得被判为旧口径');
  /* 往返腿（替掉上面那两条 `o.lv` 写法钉）：标记必须能穿过"打包 → 解析"这一对而不丢。
   * 用**游戏侧口径**（`unpack(o)` 不带 allowLegacy）—— 那正是载入旧冠军会走的那一支。 */
  const contRT = Pol.pack(emb);
  eq(contRT.lv, 6, 'pack 必须把 params 上的 `legacyFrom` 写回容器 `lv`（实测 ' + JSON.stringify(contRT.lv) +
    '）⇒ 写丢 = 存一次盘标记就没了，下面那条跟着失守');
  const backRT = Pol.unpack(contRT);
  ok(backRT && Pol.isLegacyChooser(backRT) === true, 'unpack 必须把容器 `lv` 挂回 params（实测挂回后 isLegacyChooser=' +
    (backRT ? Pol.isLegacyChooser(backRT) : 'unpack 返回 null') + '）⇒ 挂丢就是本门标题那个 12.25→7.70：旧冠军被切到它从没训练过的 v7 口径');
  const play = function (params, seed) {
    const st = S.createState('multi', { next: T.mulberry32(seed) }, 5);
    const ch = [];
    for (let i = 0; i < 5; i++) ch.push(T.policyChooserN(params, 0.15));
    Play.autoGameN(st, ch);
    return String(st.winner) + '|' + st.round + '|' + st.p.map(function (x) { return Math.max(0, x.hp); }).join(',');
  };
  const A = [0, 1, 2].map(function (k) { return play(legacy, 777 + k); }).join(' ; ');
  const B = [0, 1, 2].map(function (k) { return play(emb, 777 + k); }).join(' ; ');
  eq(B, A, '嵌入+标记后必须与原生旧口径逐场相同（旧版嵌入会改行为）');
  /* §E566（千问 · 替回被摘掉的那条"evo.js 认显式标记"名字钉的**行为**面）：
   *   上面那把 `play()` 直接调 `T.policyChooserN` ⇒ 它证明的是"分类器 + 引擎结果"对，**绕过了 evo.js 里那句 `LEGACY()`**
   *   （`js/train/evo.js:14` 定义、:146 在评分路径上用）。原腿钉的是 `evo.js` 里出现 `P.isLegacyChooser` 这个串 —— 改名不改行为。
   *   这里改问行为：**走 evo 的评分那条路**，带标记的嵌入包必须与原生旧口径**同分**；
   *   再拿"同一份权重、把标记摘掉"当正对照 —— 它必须**分数不同**，否则这把尺根本看不见标记，上面那条等式就是空枪。
   *   病根（本门标题里那个读数）：旧版嵌入把目标改成 v7 口径 ⇒ 破墙 12.25 → 7.70。 */
  const oppsD56 = [{ name: 'random', sel: Bots.pickRandom }];
  const fitOf = function (p) { return T.scoreMemberN(p, oppsD56, 2, 3, 1, 0, 0).fit; };
  T.setTrainMode('multi');                      /* D10 那族用例的出厂默认，别继承上一个门留下的模式 */
  eq(fitOf(emb), fitOf(legacy), '带 lv 标记的嵌入包走 evo 评分必须与原生旧口径同分（不同 = evo 没认这个标记 ⇒ 目标会退化）');
  const unmarkedD56 = Float64Array.from(emb);   /* 同长度、无标记：若 evo 不认标记，上面那条就会与它等值 ⇒ 这条对照正是来看穿的 */
  ok(fitOf(unmarkedD56) !== fitOf(legacy), '正对照：同一份权重摘掉标记必须读出不一样（读不出 ⇒ 这把尺看不见标记，上面那条等式是空枪）');
});

t('D59 阈值式座位惩罚必须真的在 fit 里（让演化"看得见"偏置）', function () {
  /* v1.5.68（第五轮复核 §4 的 ④ 落地）：训练从不评估"5 席同策略"配置 ⇒ 固定目标偏好的策略
   * 在机器人池上能赢、在 5 席测量里却某座通吃（v9~v15 五批 30+ 候选全是这个形状）。
   * 修：用**已经在打的 mirror 局**统计各座胜场，极差超过阈值才扣分（阈值式 = 约束处理，不是奖励权重）。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(ev.indexOf('SEAT_PEN_MAXPCT') >= 0 && ev.indexOf('SEAT_PEN_W') >= 0, '必须有阈值式座位惩罚常量');
  /* v1.5.69：触发条件必须是"明显通吃"（静音地板：6 局样本的极差噪声就有 40~60pt） */
  ok(ev.indexOf('seatMaxPct >= SEAT_PEN_MAXPCT') >= 0, '触发条件必须按 maxPct（不是极差，否则等于按噪声扣分）');
  /* v1.5.69：惩罚必须**真的能算出极差** —— v1.5.68 曾因蹭 MIRROR_GAMES=2 而静默失效（seatPen 恒 0） */
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
  ok(typeof T.seatGames === 'function' && T.seatGames() >= 4, '座位探针局数必须 >=4（实测 ' + (typeof T.seatGames === 'function' ? T.seatGames() : '?') + '）');
  ok(ev.indexOf('- seatPen') >= 0, '座位惩罚必须真的减进 fit');
  ok(ev.indexOf('seatSpreadMirror') >= 0, '成员评分必须回报座位极差（供审计）');
  ok(ev.indexOf('seatWins: seatWins') >= 0, 'mirrorHealth 必须回报各座胜场');
  /* 行为断言：mirrorHealth（5 席同策略）必须给出座位分布；线上包（已知均衡）极差应 <40pt。
   * v1.5.104：样本 20 → 60 局（METHODOLOGY §31/§35 的第三次现身）。
   * v1.5.115（第十二轮复核 §31 的第四次现身）：60 局仍不够 —— v1.5.114 换包后本门被新包打到 **43pt 红**，
   * 但同一份包的极差随样本量单调收敛：n=20→57.1 · 60→43.2 · 80→39.0 · 120→37.0 · 160→34.1
   * · 240→27.7 · 320→27.0 · 400→26.6pt ⇒ 真值约 27pt，43pt 是抽样噪声。
   * 按 §31「判据要用够用的样本，而不是放宽阈值」⇒ n 提到 **400**（实测 3.5 秒，相对全套件可忽略），
   * **阈值 40pt 一字不放宽**；分胜负守卫同比抬到 ≥120（不可判时必须红）。 */
  const SEAT_N = 400;
  let live = null;
  try {
    const src2 = readFileSync('js/bundled-champion-3p.js', 'utf8');
    const lm2 = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src2);
    if (lm2) live = Pol.unpack(JSON.parse(lm2[1]), true);
  } catch (e) { live = null; }
  if (!live) {
    /* v1.5.201：同 D58 —— 这条是守 v1.5.114 "43pt 红"的哨兵，不许在读不出包时变成一句打印。 */
    ok(false, '线上多人包必须可读（不可判 = 红，不允许静默跳过）：' +
      (existsSync('js/bundled-champion-3p.js') ? '文件在但解析失败' : '文件不存在') +
      ' —— 训练进行中请先停训练再跑门禁');
  } else {
    const mh = T.mirrorHealth(live, SEAT_N, 5, 'multi');
    ok(Array.isArray(mh.seatWins) && mh.seatWins.length === 5, 'mirrorHealth 必须回报 5 个座位的胜场');
    ok(mh.seatDecisive >= 120, '必须有足够多分出胜负的局（实测 ' + mh.seatDecisive + '/' + SEAT_N + '；<120 时极差不可判）');
    ok(mh.seatSpread != null && mh.seatSpread < 40,
      '线上包（已知均衡）的 5 席极差必须 <40pt（实测 ' + (mh.seatSpread == null ? '?' : mh.seatSpread.toFixed(0)) + 'pt，分布 ' + mh.seatWins.join('/') + '）');
  }
});

t('D17 技能熵必须**只统计非ジ动作**（否则熵奖励会惩罚攒钱）', function () {
  /* v1.5.8（用户裁定）：熵是按**动作分布**算的，而"攒钱/等待"就是反复出ジ ⇒ 攒钱会把熵压到极低
   * ⇒ 熵奖励其实在**惩罚攒钱**，与 ep 攒钱奖励互相打架（v1.5.7 实测：熵权重 0→0.06 后
   * 最高 ep 44.8→12.8、ep≥3 决策 34.3%→5.8%）。修法：熵只统计非ジ动作。 */
  const E = T.coverageEntropy;
  ok(typeof E === 'function', 'T.coverageEntropy 必须存在（纯函数，便于钉语义）');
  const JI = R.SK.JI, GUN = R.SK.GUN, SWORD = R.SK.SWORD;
  /* ① 纯ジ（只等不做事）⇒ 广度 0 */
  eq(E({ [JI]: 100 }, null, 10).divNorm, 0, '只出ジ ⇒ 熵必须为 0');
  /* ② 90 次ジ + 10 次枪：非ジ只有一种 ⇒ 广度仍是 0（"攒钱+一招"不是广度） */
  eq(E({ [JI]: 900, [GUN]: 100 }, null, 10).divNorm, 0, '攒钱+单一招式 ⇒ 熵必须为 0');
  /* ③ 关键性质：**多出ジ不该改变熵**（旧口径下出ジ越多熵越低 ⇒ 等于惩罚攒钱） */
  const a = E({ [GUN]: 50, [SWORD]: 50 }, null, 10).divNorm;
  const b = E({ [JI]: 10000, [GUN]: 50, [SWORD]: 50 }, null, 10).divNorm;
  ok(a > 0, '两种非ジ招式均用 ⇒ 熵应 > 0（实测 ' + a.toFixed(4) + '）');
  ok(Math.abs(a - b) < 1e-9, '掺进任意多ジ都不得改变熵（实测 ' + a.toFixed(4) + ' vs ' + b.toFixed(4) + '）');
  /* ④ 单调性：多一种非ジ招式 ⇒ 熵上升 */
  ok(E({ [GUN]: 50, [SWORD]: 50, [R.SK.TANK]: 54 }, null, 10).divNorm > a, '多一种非ジ招式 ⇒ 熵应上升');
  /* ⑤ 归一化分母也排除ジ：可负担集合里只有ジ+1 招 ⇒ 熵按 ln2 归一（否则永远到不了 1） */
  const c = E({ [GUN]: 50, [SWORD]: 50 }, { [JI]: 1, [GUN]: 1, [SWORD]: 1 }, null);
  ok(Math.abs(c.divNorm - 1) < 1e-9, '两种可负担的非ジ均匀 ⇒ 归一化后应为 1（实测 ' + c.divNorm.toFixed(4) + '）');
  /* ⑥ fit 里那条也要跟着变：报告里 distinctNonJi 存在 */
  Pol.setRng(T.mulberry32(31));   /* §E660：播种必须在 `makePolicy` 之前（它逐位读模块级 `__rng`，见 D15 那条的同一处） */
  const p = Pol.makePolicy(0.25);
  const r = T.scoreMemberN(p, [{ name: 'random', sel: Bots.pickRandom }], 2, 3, 1, 0, 0);
  ok(r.distinctNonJi != null && r.nonJiShare != null, 'scoreMemberN 必须回报 distinctNonJi / nonJiShare');
  ok(r.distinctNonJi <= r.distinct, '非ジ种类数不得多于总种类数（实测 ' + r.distinctNonJi + ' vs ' + r.distinct + '）');
});

t('D24 反摆烂奖励 env 只能有**一个**读取点（server/fight-env.mjs）—— 两端各写一遍会静默半开', function () {
  /* 第三方复核 §5-3（实测）：`train-server.mjs` 的触发条件写的是 `whistlePen || dealW`，
   * 而 `train-worker.mjs` 三个 env 都判 ⇒ **只设 `EPIRUS_FIGHT_FIRST` 时主线程不开、worker 开**：
   * 产物静默少一份适应度，日志完全正常（与 v1.5.0 的 mode 半开同型）。历史两轮 fstA/fstB
   * 因为同时设了 dealW 才侥幸没暴露。
   * 修法不是"补一个 ||"（那正是它第二次犯错的方式），而是**单一来源**：env 名与"要不要覆写"
   * 都只在 `server/fight-env.mjs` 里。这条断言扫全库训练侧代码文件，出现第二处读取点就红
   * —— 与 D7（对手池单一来源）同一族。反证：把 `readFightEnv` 换回任一处裸读 ⇒ 立即红。 */
  const files = ['server/train-server.mjs', 'server/train-worker.mjs', 'server/paralleltrain.mjs',
    'tools/train-fast.mjs', 'tools/train-best.mjs', 'tools/train-3p.mjs', 'tools/ring2-run.mjs',
    'js/train/evo.js', 'js/train/policy.js', 'js/train/trainer.js'];
  const bad = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    for (let i2 = 0; i2 < lines.length; i2++) {
      const L = lines[i2];
      const t2 = L.trim();
      if (t2.startsWith('*') || t2.startsWith('//') || t2.startsWith('/*')) continue;   // 注释里提到名字不算
      const re = /EPIRUS_FIGHT_[A-Z_]+/g; let m2;
      while ((m2 = re.exec(L))) bad.push(f + ':' + (i2 + 1) + '  ' + m2[0]);
    }
  }
  eq(bad.length, 0, 'EPIRUS_FIGHT_* 的读取必须集中在 server/fight-env.mjs：\n    ' + bad.join('\n    '));

  /* 正证：被集中的那一份必须真的覆盖三个 env，且两端都从它导入（否则"集中"只是集中了一半）。 */
  const fe = readFileSync('server/fight-env.mjs', 'utf8');
  for (const k of ['EPIRUS_FIGHT_WHISTLE', 'EPIRUS_FIGHT_DEAL', 'EPIRUS_FIGHT_FIRST']) {
    ok(fe.indexOf(k) >= 0, 'fight-env.mjs 必须覆盖 ' + k);
  }
  ok(fe.indexOf('hasFightOverride') >= 0, 'fight-env.mjs 必须导出"要不要覆写"的判定（两端共用同一份）');
  for (const f of ['server/train-server.mjs', 'server/train-worker.mjs']) {
    ok(readFileSync(f, 'utf8').indexOf("from './fight-env.mjs'") >= 0, f + ' 必须从 fight-env.mjs 导入');
  }
});

t('D25 播种必须**真的**可复现：同 seed 两遍逐字节相同、换 seed 必须不同（实测，不靠 grep）', function () {
  /* 第三方复核 §5-2 的结论是"REPRO2 形同虚设"：它的判据是**字符串存在性**，而 2P 入口整段没播种
   * 照样通过。这条把"可复现"从"代码里出现了某个词"变成**跑两遍比字节**。
   * 反向对照同样重要：换 seed 必须产出不同结果 —— 否则可能是"播种了但没人用它"。
   * （这也正是 §5.2-16 那条教训的固化：`workers` 都是行为输入，何况随机流。） */
  const orig = sb.Math;
  const runOnce = function (seed) {
    const s0 = (seed >>> 0) || 1;
    const M = Object.create(Math);
    let s = s0;
    M.random = function () {
      s = (s + 0x6D2B79F5) | 0;
      let t2 = Math.imul(s ^ (s >>> 15), 1 | s);
      t2 = (t2 + Math.imul(t2 ^ (t2 >>> 7), 61 | t2)) ^ t2;
      return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296;
    };
    sb.Math = M;                                  // 覆盖 evo/bots 里的裸 Math.random（等价 __seedSandbox）
    Pol.setRng(T.mulberry32(s0 * 7919 + 13));     // policy 的 randn
    const tr = T.makeTrainer({ popSize: 8, gamesPerOpp: 4 });
    for (let g = 0; g < 3; g++) T.step(tr);
    return JSON.stringify(Pol.pack(tr.champion));
  };
  try {
    const a1 = runOnce(31), a2 = runOnce(31), b1 = runOnce(32);
    eq(a1, a2, '同 seed 同代数必须逐字节相同（不可复现 ⇒ 一切 A/B 都是噪声）');
    ok(a1 !== b1, '换 seed 必须产出不同结果（若相同，说明"播种"根本没被用上）');
  } finally { sb.Math = orig; }
});

t('D26 网络形状必须被钉住（FEAT_S/FEAT_A/paramCount）+ v5 裁剪规则精确（shapeOf 守门）', function () {
  /* 第三方复核 §5-7：`docs/research/reviews/PARAMS-PLAN.md` 承诺过一条"shapeOf 守门"，但**它并不存在** ——
   * np-test 全文没有 shapeOf，也没有任何断言钉住 FEAT_S=123 / paramCount=3337。
   * 后果：静默改维度不会被任何用例发现，而那正是"升 v6 时 7 个 v5 存档当场变砖"的成因。
   * 这条把常量、反推、以及**v5 裁剪规则**一起钉住：维度一变立刻红，逼你同步 PACK_VERSION 与裁剪规则。 */
  /* v7（v1.5.19）：候选体系 + 关系块 T(15) + 效果快照块 B(70) + 动作侧 +8。
   * 常量一变就必须同步：PACK_VERSION、VER_SHAPES 形状表、裁剪规则、两个 bundle 的重训与重记。 */
  eq(Pol.FEAT_S, 213, 'FEAT_S 变了 ⇒ 旧冠军包不兼容，必须同时升 PACK_VERSION 并写清裁剪规则');
  eq(Pol.FEAT_A, 22, 'FEAT_A 变了 ⇒ 动作特征布局变了（v7：+2 珠类型 +6 目标相对）');
  eq(Pol.FEAT_N, 235, 'FEAT_N 必须 = FEAT_S + FEAT_A');
  eq(Pol.HID, 24, 'HID 变了 ⇒ 参数量与所有训练曲线不可比');
  eq(Pol.PACK_VERSION, 7, 'PACK_VERSION 变了 ⇒ 游戏侧 checkPack 会拒绝所有旧包（要有意为之）');
  eq(Pol.paramCount(), 5689, 'paramCount = HID*FEAT_N + HID + HID + 1');
  eq(Pol.FEAT_S_V6, 123, 'v6 前缀长度错了 ⇒ 旧包会按错位置裁剪（静默错位）');
  eq(Pol.EFFECTS.length, 14, 'B 块效果表的条数变了 ⇒ 同时改"每玩家槽位数"与文档');
  eq(Pol.PLAYER_SLOTS, 5, '自己 + 4 个对手槽');
  /* ACT_KEYS 是"动作键表"（= R.skills 的 key），**不是** FEAT_A 那个 14 维动作特征。
   * 这里钉住卡数：新增一张卡会同时改变 ACT_KEYS / `MIRROR_SELF` 归类 / 特征布局，
   * 必须是有意为之（算法见 `PARAMS-PLAN.md` §3）。 */
  eq(Pol.ACT_KEYS.length, 30, '技能表必须是 30 张卡（TOTAL 变了就要同步走一遍"新增卡必须显式归类"的守门）');

  const cur = new Float64Array(Pol.paramCount());
  const nw = Pol.shapeOf(cur);
  ok(nw && nw.featS === Pol.FEAT_S && nw.featA === Pol.FEAT_A && nw.legacy === false,
    'shapeOf 对新形状必须给出 featS=' + Pol.FEAT_S + '/featA=' + Pol.FEAT_A + ' 且非 legacy');
  /* v7 起 FEAT_A 也会变 ⇒ 形状**必须按表查**：(len-49)/24 只能反推出 featN，
   * 无法决定"状态段/动作段"的切分点（切错 = 静默错位，正是这套机制存在的理由）。 */
  const v6Len = Pol.HID * (123 + 14) + Pol.HID + Pol.HID + 1;
  eq(v6Len, 3337, 'v6 参数量应当 = 3337');
  const v6s = Pol.shapeOf(new Float64Array(v6Len));
  ok(v6s && v6s.featS === 123 && v6s.featA === 14 && v6s.legacy === true,
    'shapeOf 必须认出 v6（featS=123 / featA=14）并标 legacy —— 只靠整除反推会把它切成 115+22');
  const oldLen = Pol.HID * (122 + 14) + Pol.HID + Pol.HID + 1;
  eq(oldLen, 3313, 'v5 参数量应当 = 3313');
  const od = Pol.shapeOf(new Float64Array(oldLen));
  ok(od && od.featS === 122 && od.featA === 14 && od.legacy === true, 'shapeOf 必须认出 v5（featS=122/featA=14）');
  eq(Pol.unpack({ v: 5, a: new Array(oldLen).fill(0), f: 122, h: Pol.HID }), null,
    '游戏侧 unpack 必须**拒绝** v5 包（严格校验是刻意的）');
  eq(Pol.unpack({ v: 6, a: new Array(v6Len).fill(0), f: 123, h: Pol.HID }), null,
    '游戏侧 unpack 必须**拒绝** v6 包（v7 上线后线上包必须重训重发）');
  const lg = Pol.unpack({ v: 5, a: new Array(oldLen).fill(0), f: 122, h: Pol.HID }, true);
  ok(lg && lg.length === oldLen, '工具侧 unpack(o,true) 必须仍能读 v5 包（否则 A/B 证据链一次性）');
  const lg6 = Pol.unpack({ v: 6, a: new Array(v6Len).fill(0), f: 123, h: Pol.HID }, true);
  ok(lg6 && lg6.length === v6Len, '工具侧必须仍能读 v6 包（用于与历史冠军做配对对照）');

  /* v5 裁剪规则必须精确等于"v6 去掉'自己跨得过环启动线'那一维"（运行时探测，不硬编码下标）。
   * 裁错维度不会有任何报错 —— 只会让旧包静默错位，所以这条必须是逐位比较。 */
  const mk = function (rs) {
    const s2 = S.createState('standard', { next: function () { return 0.5; } }, 2);
    s2.p[0].ep = 3; s2.p[0].ringStreak = rs;
    return Pol.featuresV7(s2, 0);
  };
  const a0 = mk(0), b0 = mk(3);
  let idx = -1;
  for (let i = 0; i < a0.length; i++) if (a0[i] - b0[i] > 0.5) { idx = i; break; }
  ok(idx >= 0, '应当能探测到"自己跨得过环启动线"那一维（特征加了新维度就得同步改裁剪规则）');
  ok(idx < 123, 'v7 新维度必须全部追加在 123 之后（插在中间会让 v6 前缀错位）');
  const st5 = S.createState('standard', { next: function () { return 0.5; } }, 2);
  const f6 = Pol.features(st5, 0, 123);
  eq(f6.length, 123, 'features(state,pid,123) 必须裁成 v6 长度');
  eq(f6.join(','), Pol.featuresV7(st5, 0).slice(0, 123).join(','),
    'v6 裁剪必须逐位等于新向量的**前 123 维**（裁错 = 旧包静默错位）');
  const f5 = Pol.features(st5, 0, 122);
  eq(f5.length, 122, 'features(state,pid,122) 必须裁成 v5 长度');
  const expect = Pol.featuresV7(st5, 0).slice(0, 123).filter(function (_, i) { return i !== idx; });
  eq(f5.join(','), expect.join(','), 'v5 裁剪必须逐位等于"v6 去掉那一维"（裁错维度 = 旧包静默错位）');

});

/* v1.5.202：本块原**嵌在 D26 的用例里** —— 它失败会报成 `✘ D26 网络形状必须被钉住…`，
 * 把读者指向网络形状常量（而那是对的），是"名字与内容不对应"的典型。提成独立用例，判定一个字没改。 */
t('D33b v7 两块新状态特征的语义：T 关系块（上一手指向谁）+ B 效果快照块（符号 = 自施/他施）—— 原嵌在 D26 里，失败会误报成 D26', function () {
  /* ===== D33（同一条用例里）：v7 两块新状态特征的语义 ===== */
  /* T 关系块：上一手"指向谁"必须可读 —— `state.actions` 每回合清空，所以引擎把它落在
   * `p.lastTarget` 上（js/core/state.js）。这里同时钉住"引擎真的写了"和"特征真的读了"。 */
  const st3 = S.createState('multi', { next: function () { return 0.5; } }, 3);
  X.startTurn(st3);
  S.attemptAction(st3, 1, R.SK.GUN, { target: 2 });      // 玩家1 拿枪指**玩家2（不是我）**
  S.attemptAction(st3, 0, R.SK.JI, {});
  S.attemptAction(st3, 2, R.SK.JI, {});
  eq(st3.p[1].lastTarget, 2, '引擎必须把"这一手指向谁"留在 p.lastTarget 上（决策时刻 state.actions 已清空）');
  X.resolveActions(st3); X.endTurn(st3);
  X.startTurn(st3);
  const fv = Pol.featuresV7(st3, 0);
  const tBase = Pol.FEAT_S - Pol.EFFECTS.length * Pol.PLAYER_SLOTS - 4 * Pol.PLAYER_SLOTS;
  eq(tBase, 123, 'T/B 两块必须正好从第 124 维（下标 123）开始');
  /* v1.5.52：对手槽顺序在并列时是**随机**的（L7：不得有确定性身份映射）⇒ 测试**不得硬编码槽下标**，
   * 必须按 pid 反查槽位。（旧写法硬编码"玩家1 在槽 1"，那是"槽位永远按 pid 升序"时代的遗留。） */
  const slots0 = Pol.oppSlots(st3, 0);
  const SL1 = 1 + slots0.indexOf(1);
  ok(slots0.indexOf(1) >= 0 && slots0.indexOf(2) >= 0, '三人局里 1、2 号都必须出现在对手槽里');
  eq(fv[tBase + SL1 * 4 + 2], 1, 'T 块：玩家1 的"上一手指向别人"必须是 1（三人局"他们互相打"的核心信号）');
  eq(fv[tBase + SL1 * 4 + 1], 0, 'T 块：玩家1 上回合指的不是我 ⇒"指向我"必须是 0');
  eq(fv[tBase + 0 * 4 + 0], 1, 'T 块：我上回合按ジ ⇒ 引擎解析出来的目标就是自己（"指向自己"=1）');
  /* B 效果快照块：值的符号 = 自己施加(+) / 他人施加(−)（镜面复制来的架势就是"他人给的"） */
  const bBase = Pol.FEAT_S - Pol.EFFECTS.length * Pol.PLAYER_SLOTS;
  const CG = Pol.EFFECTS.findIndex(function (e) { return e[0] === 'copiedGuard'; });
  const GP = Pol.EFFECTS.findIndex(function (e) { return e[0] === 'guardPrev'; });
  ok(CG >= 0 && GP >= 0, 'B 块必须同时有 copiedGuard 与 guardPrev 两条');
  st3.p[0].guardNext = true;                              // 自己摆的架势
  st3.p[1].copiedGuard = R.SK.REFLECT;                    // 镜面反射复制来的（他人技能）
  const fv2 = Pol.featuresV7(st3, 0);
  eq(fv2[bBase + 0 * Pol.EFFECTS.length + GP], 1, 'B 块：自己摆的架势应当是 +1');
  eq(fv2[bBase + SL1 * Pol.EFFECTS.length + CG], -1, 'B 块：镜面复制来的架势应当是 −1（他人施加）');
  eq(fv2[tBase + SL1 * 4 + 3], R.skills.findIndex(function (s) { return s.key === R.SK.REFLECT; }) / R.skills.length,
    'T 块最后一维必须是"他复制到了哪张卡"（② 的可见性）');
});

t('D33 v7 候选体系：候选枚举 / 珠类型与目标真的进输入 / 掩码不改形状 / 旧包走旧口径', function () {
  /* v7 的结构性改动：网络不再只对"技能 key"打分，而是对 **候选 = (技能, 目标, 珠类型)** 打分。
   * 这条钉住四件事 —— 任何一件坏了，"打谁/蓄哪种珠"都会静默退化成固定启发式（而分数照常出）。 */
  const st = S.createState('multi', { next: function () { return 0.5; } }, 3);
  st.p[0].ep = 6;
  const legal = Play.legalActions(st, 0);
  const cands = Pol.candidatesFor(st, 0, legal, {});
  const gun = cands.filter(function (c) { return c.key === R.SK.GUN; });
  eq(gun.length, 2, '3 人局里 枪 必须展开成 2 个候选（每个对手一个）');
  ok(gun[0].target !== gun[1].target, '两个候选的目标必须不同');
  const ch = cands.filter(function (c) { return c.key === R.SK.CHARGE; });
  eq(ch.length, 2, '蓄能 必须展开成 2 个候选');
  eq(ch.map(function (c) { return c.bead; }).sort().join(','), 'boom,elec', '两个候选的珠类型必须是 elec/boom');
  const ae = Pol.actionFeatures(st, 0, R.SK.CHARGE, { key: R.SK.CHARGE, target: null, bead: 'elec' });
  const ab = Pol.actionFeatures(st, 0, R.SK.CHARGE, { key: R.SK.CHARGE, target: null, bead: 'boom' });
  eq(ae.length, Pol.FEAT_A, '动作特征长度必须是 FEAT_A');
  let diff = 0;
  for (let i = 0; i < ae.length; i++) if (ae[i] !== ab[i]) diff++;
  eq(diff, 2, '两个珠类型候选必须**恰好差 2 维**（电/爆两个指示位）—— 否则同分、等于随机');
  const ag = Pol.actionFeatures(st, 0, R.SK.GUN, gun[0]);
  const ag0 = Pol.actionFeatures(st, 0, R.SK.GUN, { key: R.SK.GUN, target: null, bead: null });
  let diff2 = 0;
  for (let i = 0; i < ag.length; i++) if (ag[i] !== ag0[i]) diff2++;
  ok(diff2 > 0, '带目标的候选必须在动作特征上与不带目标的不同（目标血量/ジ/收割窗口…）');
  /* 动作侧新维度的**布局**：14=蓄电珠、15=蓄爆珠、16..21=目标相对 6 维。写死下标是为了
   * 让"顺序被改动"也能被这条用例抓住（追加维度的顺序一旦变，旧包裁剪规则就要跟着改）。 */
  eq(ag[16], st.p[gun[0].target].hp / st.mode.hp, '第 17 维（下标 16）必须是目标血量占比');
  /* 掩码：只改取值、不改形状（"去掉某几块再训一版"不能动版本与包格式）。
   * 语义：`setFeatMask('target')` = **只开 target 块**，其余（bead/effects/rel）恒 0。 */
  Pol.setFeatMask('target');
  eq(Pol.paramCount(), 5689, '掩码不得改变参数量');
  eq(Pol.featMask().bead, false, 'setFeatMask 的语义是"列出的块开、其余关"');
  const ae2 = Pol.actionFeatures(st, 0, R.SK.CHARGE, { key: R.SK.CHARGE, target: null, bead: 'elec' });
  const ab2 = Pol.actionFeatures(st, 0, R.SK.CHARGE, { key: R.SK.CHARGE, target: null, bead: 'boom' });
  eq(ae2.join(','), ab2.join(','), '掩掉 bead 后两个候选的动作特征必须逐位相同（这正是"缩臂"臂的定义）');
  const fx = Pol.featuresV7(st, 0);
  eq(fx.length, Pol.FEAT_S, '掩码不得改变状态向量长度');
  let tailZero = true;
  for (let i = 123; i < fx.length; i++) if (fx[i] !== 0) tailZero = false;
  ok(tailZero, '掩掉 effects/rel 后 T/B 两块必须恒为 0');
  Pol.setFeatMask(null);
  eq(Pol.featMask().effects && Pol.featMask().rel, true, 'setFeatMask(null) 必须全开');
  eq(Pol.featuresV7(st, 0).length, Pol.FEAT_S, '复位掩码后长度不变');
  /* 旧包必须走旧口径（否则历史基线不可比）：legacy 形状的 chooser 不得产生 bead 选择，
   * 且目标必须**恰好等于** pickTargetN 的结果（而不是候选枚举里的那个）。 */
  const v6params = new Float64Array(3337);
  for (let i = 0; i < v6params.length; i++) v6params[i] = ((i * 37) % 101) / 101 - 0.5;   // 非零权重，避免 softmax 全等
  const pick6 = T.policyChooserN(v6params, 0.15, 0)(st, 0, legal);
  eq(pick6.bead, null, '旧包（v6 形状）必须走旧口径：不产生 bead 选择');
  ok(pick6.key != null, '旧包仍必须给出 key');
  eq(pick6.target, T.pickTargetN(st, 0, pick6.key), '旧包的目标必须逐位等于 pickTargetN（旧口径），不能走候选');
});

t('D36 方向 A：自对局必须折进适应度（只折动作分布，不折胜负）', function () {
  /* 只"筛"（健康门槛）不"教" 的实测后果：6/7 个 seed 被拦回"健康但弱"的角落（考卷 15.8%）。
   * 这条钉住"教"的那一半：每个个体额外打 MIRROR_GAMES 局 n 座同策略，只把**非ジ动作直方图**
   * 并进 agg.use（抬升已有的覆盖熵项），**胜负名次一项都不折**。 */
  const P0 = Pol.makePolicy(0.25);
  const opps = [{ sel: Bots.pickRandom }, { sel: Bots.pickAggro }, { sel: Bots.pickDefend }];
  eq(T.setMirrorGames(0), 0, 'setMirrorGames(0) 必须能关掉（对照臂要用）');
  const r0 = T.scoreMemberN(P0, opps, 2, 5, 4242, 0, 0);
  eq(T.mirrorGames(), 0, 'mirrorGames() 必须回显当前配置');
  eq(T.setMirrorGames(2), 2, 'setMirrorGames(2) 必须开启');
  const r2 = T.scoreMemberN(P0, opps, 2, 5, 4242, 0, 0);
  eq(r0.mirrorGames, 0, '关闭时不得跑自对局');
  eq(r2.mirrorGames, 2, '开启后必须真的跑了 2 局自对局');
  eq(r0.games, r2.games, '自对局**不得**改变胜负统计的对局数（镜像局的第 1 名是轮盘，无信息）');
  eq(r0.first, r2.first, '自对局**不得**改变 1st 计数');
  eq(r0.played === undefined ? r0.games : r0.played, r2.played === undefined ? r2.games : r2.played, '场次口径不得被自对局污染');
  ok(Math.abs(r0.divNorm - r2.divNorm) > 1e-9,
    '自对局必须改变覆盖熵 divNorm（否则"折进适应度"是空操作）：' + r0.divNorm.toFixed(4) + ' vs ' + r2.divNorm.toFixed(4));
});

t('D39 环奖励必须**可归因**（复核 §5-1：voided 不记施法者 ⇒ 反例 A 与 B 曾同分）', function () {
  /* 复核给的五个反例，缺一不可（旧版只测了 A，恰好漏掉 B 这一格）。 */
  const evs = function (byPid) {
    return [
      { type: 'action', pid: 1, key: R.SK.RING, outcome: 'ok' },
      { type: 'action', pid: 0, key: R.SK.MINI_T, outcome: 'ok' },
      { type: 'voided', pid: 1, by: R.SK.MINI_T, byPid: byPid },
    ];
  };
  ok(T.ringReward().w > 0, 'RING_W 默认必须 > 0');
  eq(T.countRingBreaks(evs(0), 0), 1.5, 'A 我小雷作废开环者 ⇒ 1.5（0.5 密集 + 1 作废）');
  eq(T.countRingBreaks(evs(3), 0), 0.5, 'B 是**别人**（byPid=3）作废的 ⇒ 只拿 0.5，**必须与 A 不同**');
  eq(T.countRingBreaks([{ type: 'action', pid: 1, key: R.SK.RING, outcome: 'ok' },
    { type: 'voided', pid: 1, by: R.SK.MINI_T, byPid: 2 }], 0), 0, 'C 我全程没出小雷 ⇒ 0');
  eq(T.countRingBreaks([{ type: 'action', pid: 1, key: R.SK.RING, outcome: 'ok' },
    { type: 'action', pid: 0, key: R.SK.MINI_T, outcome: 'ok' }], 0), 0.5, 'D 环的**首次**出手也算开环（delta 是 1 然后 2）');
  eq(T.countRingBreaks([{ type: 'ep', pid: 1, delta: 4 },
    { type: 'action', pid: 0, key: R.SK.MINI_T, outcome: 'ok' }], 0), 0, 'E 避雷针回馈 +4 ジ ≠ 开环，不得误触发');
  eq(T.setRingReward(0), 0, 'setRingReward(0) 必须能关掉');
  eq(T.setRingRamp(0, 1).g1, 1, 'setRingRamp 必须可调');
  T.setRingReward(0.10);
});

t('D40 训练信号：惩罚被动（只奖"打中了且这一回合没挨打"的回合）', function () {
  /* 起因：v7anneal-34 在**被动场**里 E=100%（对手只出ジ，它也只会堆架势）⇒ 被体检判成"集体防御"。
   * 这条用合成事件流验：回合重建（每回合每玩家最多一条 action）+ 只奖"我没挨打"的回合。 */
  ok(T.pressReward().w > 0, 'PRESS_W 默认必须 > 0（默认开）');
  const A0 = { type: 'action', pid: 0 }, A1 = { type: 'action', pid: 1 };
  /* ① 第 0 回合：我打中对手、自己没挨打 ⇒ 记 1 个主动回合 */
  eq(T.countPressRounds([A0, A1, { type: 'damage', to: 1, source: 0, amt: 1 }], 0), 1,
    '打中了且没挨打 ⇒ 记一个主动回合');
  /* ② 同一个回合我也挨了打 ⇒ 不算（不是"对手没威胁") */
  eq(T.countPressRounds([A0, A1, { type: 'damage', to: 1, source: 0, amt: 1 }, { type: 'damage', to: 0, source: 1, amt: 1 }], 0), 0,
    '这一回合我也挨了打 ⇒ 不算主动回合');
  /* ③ 没造成任何伤害 ⇒ 不算（防"乱打也给奖"） */
  eq(T.countPressRounds([A0, A1], 0), 0, '没有伤害 ⇒ 不算');
  /* ④ 归因：伤害不是我造成的 ⇒ 不算 */
  eq(T.countPressRounds([A0, A1, { type: 'damage', to: 1, source: 1, amt: 1 }], 0), 0, '不是我打的不算');
  /* ⑤ 两回合：一回合主动、一回合挨打 ⇒ 只记 1（回合重建必须正确） */
  eq(T.countPressRounds([
    A0, A1, { type: 'damage', to: 1, source: 0, amt: 1 },
    A0, A1, { type: 'damage', to: 1, source: 0, amt: 1 }, { type: 'damage', to: 0, source: 1, amt: 1 },
  ], 0), 1, '两回合里只有一回合是"我打他没挨打"');
  /* ⑥ 可关闭（对照臂） */
  eq(T.setPressReward(0), 0, 'setPressReward(0) 必须能关掉');
  T.setPressReward(0.03);
});

t('D41 E 新口径：只有"**没有大雷威胁时还一直摆架势**"才算病（合理防御不算）', function () {
  /* 用户裁定（v1.5.26）：旧 E（摆架势回合占比>85%）把"看到对手攒到 5 ジ 该防一下"也判成病 ——
   * 实测 eco-34 旧口径 89%（判病）而新口径只有 16%（合理）。新口径两条：
   *   ① noThreatStanceRate：对手ジ < 5（无大雷威胁）的回合里摆架势的占比 —— 主门槛；
   *   ② maxNoThreatRun：无威胁回合里的最长连摆（只作参考，实测区分度不足）。 */
  const rows = [
    { seat: 1, round: 0, stance: true },
    { seat: 1, round: 1, stance: true },     // 无威胁连摆 2 回合
    { seat: 1, round: 2, stance: false },
    { seat: 1, round: 3, stance: true },     // 这一回合**有威胁**（对手ジ≥5）⇒ 不该算病
  ];
  const threat = { 0: false, 1: false, 2: false, 3: true };
  const p = stanceProfile(rows, threat);
  eq(p.noThreatRounds, 3, '有威胁的回合不得计入"无威胁回合数"');
  eq(p.noThreatStanceRate.toFixed(3), (2 / 3).toFixed(3), '无威胁回合里 2/3 摆架势 ⇒ 占比 0.667');
  eq(p.maxNoThreatRun, 2, '无威胁最长连摆 = 2（第 0、1 回合）');
  eq(p.stanceRate.toFixed(3), (3 / 4).toFixed(3), '旧口径占比仍然可算（3/4，用于对照打印）');
  /* 全防 + 全无威胁 ⇒ 100%（这才是该挡的病理样本，实测 v7anneal-34 = 100%） */
  eq(stanceProfile([{ seat: 1, round: 0, stance: true }, { seat: 1, round: 1, stance: true }],
    { 0: false, 1: false }).noThreatStanceRate, 1, '全程无威胁还每回合摆架势 ⇒ 100%');
  /* 合理防御：只在有威胁的回合摆 ⇒ 无威胁占比 0（旧口径仍会很高，正是要修掉的误伤） */
  const fair = stanceProfile([
    { seat: 1, round: 0, stance: false }, { seat: 1, round: 1, stance: false },
    { seat: 1, round: 2, stance: true }, { seat: 1, round: 3, stance: true },
  ], { 0: false, 1: false, 2: true, 3: true });
  eq(fair.noThreatStanceRate, 0, '只在有威胁时防 ⇒ 新口径 0%（旧口径会是 50%）');
  eq(fair.stanceRate, 0.5, '旧口径对照值 = 50%');
  /* 门槛必须挂在**新口径**上 */
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf('fPass.noThreatStanceRate > 0.6') >= 0, 'promote-champion 的 E 门槛必须用新口径（noThreatStanceRate）');
  ok(pc.indexOf('fPass.stance > 0.85') < 0, '旧口径（stance > 0.85）必须已从门槛里移除');
  /* v1.5.62：F 的口径已整体换成"场 A 被集火还手率"（≥20%）—— 新契约由 D55 专管。
   * 这里只留**反断言**：旧的 25%/35% 阈值写法都必须不存在（防止回退到"所有人靠 --force 过"的老路）。 */
  ok(pc.indexOf('fAct.atk < 0.25') < 0, '旧的 F 门槛（25%）必须已移除（口径已换成场 A，见 D55）');
  ok(pc.indexOf('fAct.atk < 0.35') < 0, '旧的 F 门槛（35%）必须已移除');
  /* v1.5.28：**反弹墙穿透卡零命中 = 阻断**（第三方复核 §3-1 实测：v1.5.27 自对局激光剑命中 20 次、墙里 0 次） */
  ok(pc.indexOf('reflectWall') >= 0, 'promote-champion 必须调用 reflectWall（反弹墙探针）');
  ok(pc.indexOf('rw.pierceLand === 0') >= 0, '反弹墙穿透卡零命中必须是阻断条件');
  ok(pc.indexOf("fails.push('穿透卡零命中") < 0, "自对局穿透卡零命中**不得**是阻断条件（实测所有冠军都没用过坦克/电磁炮）");
  /* ===== v1.6.53 §E568（用户 10-10 裁定「那你就补一下吧」）：**long 广度那条断口原来一条腿都没有** =====
   * 凭据（不是推测）：把 `tools/promote-champion.mjs` 的 `if (spL.effSkills < 3) fails.push(...)` 短路成 `if (false && …)`（其余字节一字不动），
   *   `docs/artifacts/e504-out/P-s30.js --dry` 从 **exit 6 变 exit 0**（⇒ 这行就是唯一挡手），而 D27/D41/D155/D163 **当时全部 1/1** ⇒ 删掉它门禁一声不响。
   *   记录见 `docs/research/reviews/2026-10-10-day-review-ds.md` §3-②（那里也记了真测出的代价：**净新增挡下 74 枚**，不是 v1.6.49 写的 102）。
   * 为什么补在 D41 而不是新开一门：D41 的本业就是"出厂闸的门槛必须挂在**正确那条口径**上"（E 的新旧口径、F 的 25%/35% 反断言、反弹墙的"必须阻断/不得阻断"一对，全是这个形状）
   *   ⇒ 只加腿不加门（仓规 v1.5.x 起沿用）。三条各管一个失败模式：① 断口被删或被短路 ② 挡住了但打印只报 multi（规矩 44 打印与阻断同源）③ 反过来把现役自己误伤。
   *
   * ===== v1.6.61（用户 10-11 裁定「先做 C」）：这三条腿从**源码正则 / 中文措辞**改成**行为级** =====
   * 病（Claude 点名 · 千问 §E580 草案 · 本班实测复现）：
   *   ① 原来钉的是 `ok(/if\s*\(\s*spL\.effSkills\s*<\s*3\s*\)\s*fails\.push\(/)` —— **源码文本**。后果两个：
   *      之一：有人把阈值 3 改成 4（那是**换判据**，不是坏）这条腿就红；
   *      之二：有人把 `fails.push` 挪进**永远进不去的分支**时它**反而绿** —— 断口被删也一声不响。**这才是要治的病。**
   *   ② 打印侧原来钉 `_gBlocked = fails.filter(` 的文本 + `门判 multi 与 long` / `两条都未阻断` 两句中文 ⇒
   *      改一个字就红，而"打印与阻断同源"（METHODOLOGY 44）这条**规矩本身**反而没被验。
   * 新守法：**喂证人、看行为**（不看源码、不看措辞）。
   *   证人 = `docs/artifacts/v7w3c-93.bak`：**已入库**（干净克隆也在）· 实测唯一阻断就是 long 广度 2.38 < 3 · 两遍逐字相同（确定性）。
   *     备选 `docs/artifacts/v7divK-31.bak`（2.39）。投影 = promote 的 `--json`（v1.6.61 加；不带它时输出**逐字节不变**，已实测）。 */
  const W_LONG = 'docs/artifacts/v7w3c-93.bak';
  const promoteJson = function (pack) {
    const r = spawnCached(['tools/promote-champion.mjs', pack, '--dry', '--games=20', '--skip-gate-drafts', '--json'], { encoding: 'utf8' });
    const txt = String(r.stdout || '') + String(r.stderr || '');
    const ln = txt.split(/\r?\n/).filter(function (l) { return l.indexOf('EPIRUS_JSON ') === 0; })[0];
    let j = null;
    if (ln) { try { j = JSON.parse(ln.slice('EPIRUS_JSON '.length)); } catch (e) { j = null; } }
    return { status: r.status, json: j, txt: txt };
  };
  /* ① 断口必须**真的挡**，而且挡它的**就是 long 广度这一类**（把"文本里有这行字"换成"行为上真的挡了"） */
  const wj = promoteJson(W_LONG);
  ok(wj.json, '① promote `--json` 必须给出结构化投影（拿不到 ⇒ 下面两条是空的，先修投影）');
  ok(wj.status !== 0 && wj.json && wj.json.blocked === true,
    '①a 证人（唯一阻断 = long 广度）必须**真的被挡**：实测 exit=' + wj.status + ' · blocked=' + (wj.json ? wj.json.blocked : '无投影'));
  if (wj.json) {
    eq(wj.json.breadthBlocked.join(','), 'breadth-long',
      '①b 广度类阻断必须**恰好是 long 那一条**（G=' + wj.json.G + ' · G(long)=' + wj.json.G2 + '）；' +
      '这一格变空或变成 breadth-multi ⇒ long 断口被删/被短路/判据被换 ⇒ 本腿红');
    eq(wj.json.printSaysBlocked.join(','), wj.json.breadthBlocked.join(','),
      '② 打印侧 `_gBlocked` 必须与阻断侧**同源**（METHODOLOGY 44）：挡住 long 却不报是哪条挡的，与"只打印"一样坏');
  }
  /* ③ 正对照：现役必须仍然放行，且**两类都不许有**（既没被误伤、打印也不许瞎报被挡） */
  const cj = promoteJson('js/bundled-champion-3p.js');
  eq(cj.status, 0, '③a 正对照：现役包 `--dry` 必须放行（实测 exit=' + cj.status + '）');
  if (cj.json) {
    eq(cj.json.classes.length, 0, '③b 现役不许有任何阻断类（实测 ' + JSON.stringify(cj.json.classes) + '）');
    eq(cj.json.printSaysBlocked.length, 0, '③c 现役的打印侧也不许报"被挡"（实测 ' + JSON.stringify(cj.json.printSaysBlocked) + '）');
  } else {
    ok(false, '③ 现役那一遍也必须带结构化投影（拿不到 ⇒ promote --json 坏了）');
  }
});

t('D42 破墙奖励（方案 b）：只有"我用穿透卡**落地命中**"才记分', function () {
  /* 起因：v1.5.27 的冠军面对 4 面反弹墙一枪未发（穿透卡 0 命中）⇒ 长程反弹墙 85%→0%。
   * 修法是在 fitness 里显式补一条窄条件奖励：只认能穿反弹/穿防御的卡，且必须落地命中、必须是我打的。 */
  const pk = T.pierceKeyList();
  ok(pk.length >= 3, '穿透卡清单必须从 R.skills 推导（实测：' + pk.join(',') + '）');
  ok(pk.indexOf('sword') >= 0 && pk.indexOf('tank') >= 0 && pk.indexOf('snipe') >= 0,
    '清单至少含 激光剑(sword)/坦克(tank)/狙击枪(snipe)');
  ok(T.pierceReward().w > 0, 'PIERCE_W 默认必须 > 0（默认开）');
  eq(T.countPierceHits([{ type: 'damage', to: 1, source: 0, via: 'sword' }], 0), 1, '我用激光剑打中 ⇒ 记 1');
  eq(T.countPierceHits([{ type: 'damage', to: 1, source: 0, via: 'gun' }], 0), 0, '普通攻击卡（枪）不算破墙');
  eq(T.countPierceHits([{ type: 'damage', to: 1, source: 1, via: 'sword' }], 0), 0, '可归因：不是我打的不算');
  eq(T.countPierceHits([{ type: 'action', pid: 0, key: 'sword', outcome: 'ok' }], 0), 0,
    '只出招没打中不算（要**落地命中**，否则"朝墙上砍空气"也能得分）');
  eq(T.countPierceHits([{ type: 'damage', to: 1, source: 0, via: 'sword' }, { type: 'damage', to: 2, source: 0, via: 'snipe' }], 0), 2,
    '两张不同的穿透卡各记一次');
  eq(T.setPierceReward(0), 0, 'setPierceReward(0) 必须能关掉（对照臂）');
  T.setPierceReward(0.04);
});

t('D43 课程/示范：反环教师必须砸**真的在滚环的那个人**（复核 §5-2：旧条件 ep>=2 宽 300 倍）', function () {
  /* 复核实测：`ep >= 2` 在真实自对局里 **45%** 的决策都成立，而"有人真在滚环"只有 **0.15%** ⇒
   * 旧教师实际在教"见人兜里有 2 ジ就砸小雷"，与"开环"这个状态几乎不相关（这就是示范没建立关联的原因）。 */
  const base = function () { return { key: R.SK.JI }; };
  const teach = T.makeAntiRingTeacher(base);
  const mt = [{ key: R.SK.MINI_T, affordable: true }];
  const ringers = { p: [{ hp: 3, ep: 0, ringStreak: 0 }, { hp: 3, ep: 3, ringStreak: 2 }] };
  eq(T.setAntiRingTeacher(), true, 'setAntiRingTeacher() 必须能把教师换成反环教师');
  eq(teach(ringers, 0, mt).key, R.SK.MINI_T, '有人在滚环 ⇒ 教师必须示范小雷');
  eq(teach(ringers, 0, mt).target, 1, '必须砸**那个**滚环的（死掉的不算）');
  eq(teach({ p: [{ hp: 3, ep: 0, ringStreak: 0 }, { hp: 3, ep: 5, ringStreak: 0 }] }, 0, mt).key, R.SK.JI,
    '只是兜里有 ジ（没滚环）⇒ 不得砸小雷（旧条件在这里会误触发）');
  eq(teach({ p: [{ hp: 3, ep: 0, ringStreak: 0 }, { hp: 3, ep: 3, ringStreak: 1 }, { hp: 3, ep: 9, ringStreak: 3 }] }, 0, mt).target, 2,
    '多个滚环者 ⇒ 优先砸环最粗的那个');
  eq(teach(ringers, 0, [{ key: R.SK.MINI_T, affordable: false }]).key, R.SK.JI, '付不起小雷 ⇒ 交回基础策略');
  eq(T.setImitTeacher(null), false, 'setImitTeacher(null) 必须能恢复默认教师（heavyfire）');
});

t('D44 零提升检测：训练"静默冻结"必须可被发现（产物 == 热启动种子）', function () {
  const zc = readFileSync('tools/zero-promote-check.mjs', 'utf8');
  ok(zc.indexOf("createHash('sha1')") >= 0, '检测必须用权重哈希比对（分数会骗人）');
  ok(zc.indexOf('process.exit(3)') >= 0, '发现零提升必须非零退出（可被脚本捕获，不能只打印）');
  ok(zc.indexOf('embedLegacy') >= 0, '必须按训练起点口径 embedLegacy 后再比');
  ok(zc.indexOf('零提升') >= 0, '必须有明确判定文案');
});

t('D47 定向强制探索：**只在"有滚环者且我付得起小雷"这一格**生效，其余必须原样交回学习到的策略', function () {
  /* 前五次实测（奖励/池子/示范/暴露度/可归因信号）都拿不到自然小雷 ⇒ 动作从未被采样。
   * 定向强迫是最后一枪；但**不能**用教师槽做常开 ε（那会用 heavyfire 扰动全局）。 */
  const mt = [{ key: R.SK.MINI_T, affordable: true }];
  const ringers = { p: [{ hp: 3, ringStreak: 0 }, { hp: 3, ringStreak: 2 }] };
  eq(T.ringForceTarget(ringers, 0, mt), 1, '有滚环者且付得起小雷 ⇒ 目标就是那个滚环者');
  eq(T.ringForceTarget({ p: [{ hp: 3, ringStreak: 0 }, { hp: 3, ringStreak: 0 }] }, 0, mt), -1, '没人滚环 ⇒ 不出手（-1）');
  eq(T.ringForceTarget(ringers, 0, [{ key: R.SK.MINI_T, affordable: false }]), -1, '付不起 ⇒ 不出手（-1）');
  eq(T.ringForceTarget({ p: [{ hp: 3, ringStreak: 0 }, { hp: 0, ringStreak: 3 }] }, 0, mt), -1, '滚环者已死 ⇒ 不出手（-1）');
  eq(T.setRingForceEps(0.05), 0.05, 'setRingForceEps 必须可设');
  eq(T.setRingForceEps(0), 0, 'setRingForceEps(0) 必须能关掉（验收要在关掉后量自然行为）');
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('const _fe = ringForceEpsAt(gen);') >= 0, '强迫必须带**按代**概率门（v1.5.40 起；不能常开、也不能全程常数）');
  ok(evo.indexOf('return econ(state, pid2, legal);') >= 0, '非目标格必须原样返回学习到的动作');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('EPIRUS_RING_FORCE_EPS') >= 0, 'worker 必须能通过 env 打开强迫（独立进程）');
});


t('D48 强迫必须可退火（否则会把训练冻死）：只在早期代生效，之后归零', function () {
  /* 实测：格内常开 ε=1.0 ⇒ 6/6 零提升（训练整体冻死，产物退回种子）；格内 ε=5% 又因格子罕见（0.15%）等于没做。
   * 正确形态：早期强制示范、之后关掉 ⇒ 最终产物来自无强迫的后段，验收才有意义。 */
  eq(T.setRingForceEps(1), 1, 'setRingForceEps 必须可设到 1.0');
  eq(T.setRingForceUntil(40), 40, 'setRingForceUntil 必须可设');
  eq(T.ringForceEpsAt(0), 1, '第 0 代：强迫生效');
  eq(T.ringForceEpsAt(39), 1, '第 39 代（<40）：仍生效');
  eq(T.ringForceEpsAt(40), 0, '第 40 代起：必须归零（产物后段无强迫）');
  eq(T.ringForceEpsAt(200), 0, '后期必须为 0，否则产物不可信');
  eq(T.setRingForceEps(0), 0, '关掉后必须恒为 0');
  eq(T.ringForceEpsAt(0), 0, '关掉后第 0 代也不强迫');
  T.setRingForceEps(1); T.setRingForceUntil(40);
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('const _fe = ringForceEpsAt(gen);') >= 0, '包装层必须**按代**取概率（不能是常数）');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('EPIRUS_RING_FORCE_UNTIL') >= 0, 'worker 必须能通过 env 设退火窗口');
  T.setRingForceEps(0); T.setRingForceUntil(0);
});


t('D66 珠子闭环奖励：只认**花掉**，囤着/过期不记分（v1.5.76 P1）', function () {
  const ev = [
    { type: 'bead', pid: 0, kind: 'elec', delta: 1 },    // 蓄能得珠 ⇒ 不记
    { type: 'bead', pid: 0, kind: 'elec', delta: -1 },   // 花掉 ⇒ 记
    { type: 'bead', pid: 0, kind: 'boom', delta: -1 },   // 花掉 ⇒ 记
    { type: 'beadExpire', pid: 0, kind: 'elec' },        // 过期 ⇒ 不记
    { type: 'bead', pid: 1, kind: 'elec', delta: -1 },   // 别人花的 ⇒ 不记
    { type: 'bead', pid: 0, kind: 'elec' }               // 无 delta ⇒ 不记
  ];
  eq(T.countBeadSpent(ev, 0), 2, '只数自己花掉的珠子（实测 ' + T.countBeadSpent(ev, 0) + '）');
  eq(T.countBeadSpent(ev, 1), 1, '换座位视角只数它的');
  eq(T.countBeadSpent(null, 0), 0, '空事件必须安全返回 0');
  const r = T.beadReward();
  ok(r && typeof r.w === 'number' && r.w > 0, '默认权重必须为正（否则奖励形同虚设）');
  ok(typeof T.setBeadReward === 'function', '必须可调（实验臂/守门用）');
  const src = readFileSync('js/train/evo.js', 'utf8');
  ok(src.indexOf('const beadBonus = BEAD_W * Math.min(1, beadSpent / 2)') >= 0, '两次封顶的加成必须真的存在');
  const gfitLine = src.slice(src.indexOf('const gFit = '), src.indexOf('const gFit = ') + 500);
  ok(gfitLine.indexOf('+ beadBonus') >= 0, 'beadBonus 必须并进 gFit（漏了 = 静默空操作）');
  /* ⚠ 这一行原本钉的是字面量 `if (BEAD_W > 0) beadSpent += …`，被 v1.5.272（§E83）换成了整族门 `DOSE_ON`
   * ⇒ 钉的**语义不变**（"计数必须逐局接上"），换的是那根门的形状：计数按族算，**付钱仍按 `BEAD_W`**（上面那条 `beadBonus` 断言就是守这一半的）。
   * 反过来也钉：不许再退回"跟着自己的 W 关"（那正是本门当初要防的假零结果的成因）。 */
  ok(src.indexOf('if (DOSE_ON) beadSpent += countBeadSpent(') >= 0, '每局的计数必须接上（v1.5.272 起按整族 `DOSE_ON` 算）');
  ok(src.indexOf('if (BEAD_W > 0) beadSpent +=') < 0, '计数不许再退回跟着自己的 W 关（§E65 那族假零结果）');
});


/* ===== v1.5.78（第七轮复核 §15-1）：G4/G5 行为门 =====
 * 复核把"一行脚本能否克制它"（G4）与"面对只防御不还手能否清场"（G5）写成可跑代码，并**先证明量具有判别力**：
 *   线上包 G4 两模式 PASS（最克 22%/18%）、G5 PASS（防席 0%）；91/94 分别在这些格上 FAIL。
 * ⇒ 只有这两条进阻断面（G3 阈值连线上包都过不了；G6 四代全红=能力未长出，都不能当阻断）。
 * 本条守门锁三件事：① 量具仍在且带判别力元测试；② 只有 G4/G5 进阻断；③ 退出码契约（有 FAIL ⇒ 1）。 */
t('D68 威胁靶向奖励：只记"我打的、上回合构成威胁的、不同受击者"（复核 §15-1）', function () {
  eq(T.targetReward().w, 0, '默认必须是**关**（实验臂用 EPIRUS_TGT_W 打开，不改出厂口径）');
  const tk = T.threatKeyList();
  ok(tk.indexOf('snipe') >= 0 && tk.indexOf('ring') >= 0, '威胁键 = 穿透类 + 聚能环（实测 ' + tk.join(',') + '）');
  const ev = [
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 0, to: 1, amt: 2, via: 'gun' },
    { type: 'action', pid: 1, key: 'snipe', outcome: 'ok' },
    { type: 'damage', source: 1, to: 0, amt: 2, via: 'snipe' },
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 0, to: 1, amt: 2, via: 'gun' },
    { type: 'action', pid: 2, key: 'ji', outcome: 'ok' },
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 0, to: 2, amt: 2, via: 'gun' }
  ];
  eq(T.countThreatHits(ev, 0), 1, '只有"上回合放冷枪的人"记 1（打无威胁的攒ジ者不计）');
  eq(T.countThreatHits(ev, 1), 0, '可归因：不是我打的不算我的分');
  eq(T.countThreatHits([{ type: 'damage', source: 0, to: 1, amt: 2, via: 'gun' }], 0), 0, '第 1 回合没有"上一回合" ⇒ 一律不计');
  const ev2 = [
    { type: 'action', pid: 1, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 1, to: 3, amt: 2, via: 'gun' },
    { type: 'action', pid: 2, key: 'ji', outcome: 'ok' },
    { type: 'action', pid: 1, key: 'gun', outcome: 'ok' },
    { type: 'damage', source: 0, to: 1, amt: 2, via: 'gun' }
  ];
  eq(T.countThreatHits(ev2, 0), 1, '上回合造成 >=2 伤害也算威胁（事件派生，不硬编码技能名）');
  const src = readFileSync('js/train/evo.js', 'utf8');
  const gline = src.slice(src.indexOf('const gFit = '), src.indexOf('const gFit = ') + 500);
  ok(gline.indexOf('+ tgtBonus') >= 0, 'tgtBonus 必须并进 gFit（漏了 = 静默空操作）');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('EPIRUS_TGT_W') >= 0 && wk.indexOf('setTargetReward') >= 0, 'worker 必须读 EPIRUS_TGT_W');
  /* §E566（千问 · 把上面那条名字钉要守的**行为**补回来，替掉它而不是留着恒真式）：
   *   原腿钉的是「`server/train-server.mjs` 里出现 `EPIRUS_TGT_W` 这个串」⇒ 改个名就红、真断了却不响
   *   （§八 口径 1 的第二层：只读源码文本的腿不许当红灯）。这里改问行为：**这个键在这条路上认不认**。
   *   `detectDarkKnobs` 顺着 import 链找到真正读键的那一层（与 `enforceKnobs` 同一份读集）⇒ server 侧一旦不认，
   *   就会被列成暗键 ⇒ 红。病根（v1.5.79）：`v7tgt4` 整臂的靶向奖励从没发出去过，而 worker 的 stdout 不进流
   *   ⇒ 当时事后无从追查"这根旋钮到底开没开"，那臂的读数全部作废。 */
  const dkSrv = detectDarkKnobs({ EPIRUS_TGT_W: '0.07' }, { entry: 'server/train-server.mjs' });
  eq(dkSrv.dark.indexOf('EPIRUS_TGT_W'), -1,
    '页面训练服务必须**认** EPIRUS_TGT_W（被列为暗键 = 会被黑键闸拒掉或静默吞，实测 dark=[' + dkSrv.dark.join(',') + ']）');
  /* 负对照：同一个探测器必须**能**把这个键列成暗键（实测 `train-fast` 不读它 ⇒ dark 里有它）。
   *   没有这半条，上面那句就成了"探测器永远说读得到"的空枪 —— 照 D143 那种"正/负同键成对"的写法。 */
  const dkCtl = detectDarkKnobs({ EPIRUS_TGT_W: '0.07' }, { entry: 'tools/train-fast.mjs' });
  ok(dkCtl.dark.indexOf('EPIRUS_TGT_W') >= 0,
    '负对照：`train-fast` 不读 EPIRUS_TGT_W 必须被列为暗键（列不出 ⇒ 上面那条判据没有判别力，实测 dark=[' + dkCtl.dark.join(',') + ']）');
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
  /* 加硬（v1.5.79 事故本身）：**多回合**序列才抓得住"回合边界不重置 seen"这类 bug ——
   * 第一版 D68 只用 <=2 回合的序列 ⇒ 漏掉了 countThreatHits 恒 0 的**静默空操作**
   * （奖励在 v7tgt4 整臂里从没发出去过，那一臂的读数因此作废）。 */
  const evLong = [];
  for (let r = 0; r < 6; r++) {
    evLong.push({ type: 'action', pid: 0, key: 'gun', outcome: 'ok' });
    evLong.push({ type: 'damage', source: 0, to: 1, amt: 1, via: 'gun' });
    evLong.push({ type: 'action', pid: 1, key: 'ji', outcome: 'ok' });
    evLong.push({ type: 'damage', source: 1, to: 3, amt: 2, via: 'gun' });
  }
  ok(T.countThreatHits(evLong, 0) >= 4, '6 回合重复序列必须认出 >=4 次（回合边界必须重置 seen；恒 0 = 静默空操作）');
  const evSrc = readFileSync('js/train/evo.js', 'utf8');
  ok(evSrc.indexOf('else if (seen[e.pid] !== undefined) { seen = {}; cur++; }') >= 0, 'countThreatHits 必须在换回合处重置 seen');
  const mhSrc = evSrc.slice(evSrc.indexOf('function mirrorHealth'));
  ok(mhSrc.indexOf('threatHitsPerGame') >= 0 && mhSrc.indexOf('threatCapRate') >= 0, '健康探针必须暴露奖励的支付诊断');
  eq(T.setTargetReward(0.07), 0.07, 'setTargetReward 可设');
  T.setTargetReward(0);
});
/* ===== v1.5.80（第八轮复核 §5）：UI 契约（目标弹窗可取消 / 结算期点击有反馈）=====
 * 探针 tools/ui-probe.mjs 在真页面上复现过三条缺陷（读数记在 CHANGELOG v1.5.80）。
 * Chrome 依赖 ⇒ 行为验证走探针，这里只锁**接线**，防它被改回去。 */
/* ===== v1.5.86：对手注册表一致性（这个 bug 在本仓库已发生 ≥3 次，文件注释里自己都写着）=====
 * 事故：往池子里加一个新对手名，只加了 runner 或只加了 worker ⇒ 服务端拿到未定义名字，
 * 跑起来才 `sel is not a function` / `未知/缺失对手`。本轮我又踩了一次（protomine/prototransfer
 * 只注册在 BOT_FN、没进 opp-pool ⇒ 整臂 0.4 秒就失败）。这里把三份清单绑成机械检查。 */
t('D74 熵奖励与门禁同口径：进 fit 的熵必须来自"自对局·成功非ジ动作"（用户裁定 A）', function () {
  const src = readFileSync('js/train/evo.js', 'utf8');
  ok(src.indexOf('const spUse = {};') >= 0, '必须有自对局成功动作直方图 spUse');
  ok(src.indexOf("e.outcome === 'ok' && e.key && e.key !== R.SK.JI") >= 0,
    'spUse 必须只收 outcome===ok 的非ジ动作（与 mirrorHealth 的 keyCount 同口径）');
  /* v1.5.92 引入、v1.5.93 换层：进 fit 的那一项是"与门禁同源的量 × 类间/类内**混比**"。
   * `DIV_ROLE_W = 0`（默认）时 `spMixNorm === spDivNorm` ⇒ 逐位等于 v1.5.87 的口径，旧读数仍可比；
   * 这条断言同时钉住"必须与门禁同源"和混比公式（免得有人把 spDivNorm 换成别的量）。 */
  ok(src.indexOf('const divBonus = DIV_W * spMixNorm;') >= 0 &&
    src.indexOf('const spMixNorm = (1 - DIV_ROLE_W) * spDivNorm + DIV_ROLE_W * spRoleNorm;') >= 0,
    '进 fit 的必须是 spDivNorm 与角色间熵的混比（DIV_ROLE_W=0 时逐位等于 spDivNorm）');
  ok(src.indexOf('coverageEntropy(agg.use, agg.aff, DIV_K)') >= 0, '旧口径保留为对照量（便于审计两口径之差）');
  ok(src.indexOf('effSkills: tot ? Math.exp(H) : 0') >= 0, '门禁量仍是自对局成功非ジ动作的 exp(H)（同源）');
});

t('D75 破墙硬过滤：必须在**真的反弹墙**里量（自对局用量不能预测），wall<0.5 压到底', function () {
  const src = readFileSync('js/train/evo.js', 'utf8');
  ok(src.indexOf('function wallProbe(params, games, n)') >= 0, '必须有 wallProbe');
  ok(src.indexOf("BOT_PICKS['reflectspam']") >= 0, '探针必须用真的 reflectspam 对手（不能拿自对局代理量）');
  ok(src.indexOf('wallReject ? (-5.0)') >= 0, '不过关的成员必须被压到选择之外');
  ok(src.indexOf('const wallDmg = WALL_FILTER_ON ? wallProbe') >= 0, '必须有开关（默认关）');
  ok(src.indexOf('let WALL_FILTER_ON = false;') >= 0, '默认 false（出厂口径不变）');
});
t('D76 退火强迫多样性：窗口默认 0（关）、只作用于计分对局、有 env 接线', function () {
  const src = readFileSync('js/train/evo.js', 'utf8');
  ok(src.indexOf('function makeDiversityForce(inner, gen)') >= 0, '必须有强迫器');
  ok(src.indexOf('let DIV_FORCE_GENS = 0;') >= 0, '窗口默认 0（出厂口径不变）');
  ok(src.indexOf('gen < DIV_FORCE_GENS) baseSel = makeDiversityForce') >= 0, '只包计分 chooser（自对局探针不动）');
  /* v1.5.89：接线点从 train-server 的**内联读**挪到**单一来源** server/econ-env.mjs（见 D77）——
   * 所以这里不能再断言"train-server 里有这个 env 名"（它已经不在那儿了），
   * 要断言的是"真正被两端共用的那一份里有它" + "worker 确实导入了那一份"。
   * （这正是本轮修的 bug：断言的是"名字存在"，而名字存在 ≠ 开关进得了算 fitness 的进程。） */
  const eeW = readFileSync('server/econ-env.mjs', 'utf8');
  ok(eeW.indexOf('EPIRUS_DIV_FORCE_GENS') >= 0, '必须有 env 接线（接线点在单一来源 econ-env.mjs）');
  ok(readFileSync('server/train-worker.mjs', 'utf8').indexOf("from './econ-env.mjs'") >= 0,
    'worker 必须导入同一份接线（否则这四个开关到不了算 fitness 的进程 —— 第八轮复核 §2）');
});

/* ===== v1.5.89（第八轮复核 §2）：经济/熵奖励 env 的**单一来源** + "worker 真的拿到了吗" =====
 * 事故（[实测 + 代码事实]）：`EPIRUS_DIV_W / EPIRUS_DIV_K / EPIRUS_DIV_FORCE_GENS / EPIRUS_WALL_FILTER`
 * 原先只在 `train-server.mjs` 内联读，而 fitness 在 **16 个 worker 线程**里算，worker 只读
 * `EPIRUS_ECO_*` 三个名字 ⇒ 这四个开关在 worker 里**全是空操作**，而日志完全正常
 * （服务端 `[eco] 生效值` 打的是被覆盖后的值）⇒ 臂 K（`DIV_W=0.3`）与臂甲（强迫 60 代 + 破墙过滤）
 * 的 A/B 实际是 **A/A**，两条臂的读数整批作废。
 * 同族：D24（fight env 半开）、D7/D72（对手池两份清单）、v1.5.79 的 `TGT_W` 空发。
 * 解法同族：**单一来源** + 两端回执。反证：把 `readEconEnv` 换回任一处裸读 ⇒ 这条立即红。 */
t('D77 经济/熵奖励 env 只能有**一个**读取点（server/econ-env.mjs），且 worker 必须拿到生效值', function () {
  const ee = readFileSync('server/econ-env.mjs', 'utf8');
  /* 键名表从模块里解析 ⇒ 以后往 econ-env.mjs 加一个键，这条扫描自动覆盖它（不会漏）。 */
  const keyList = ((ee.match(/ECON_ENV_KEYS = \[([\s\S]*?)\]/) || ['', ''])[1].match(/'([^']+)'/g) || [])
    .map(function (q) { return q.replace(/'/g, ''); });
  ok(keyList.length >= 8, 'ECON_ENV_KEYS 应 >=8 个 env 名（实测 ' + keyList.length + '）');

  /* ① 静态：这些 env 名不得出现在**任何**读取点。用**整名**匹配（不能用 EPIRUS_WALL_*
   * 这种前缀正则 —— `EPIRUS_WALL_MS`（墙上时钟上限）是另一个无辜的 env，会被误伤）。 */
  const files = ['server/train-server.mjs', 'server/train-worker.mjs', 'server/paralleltrain.mjs',
    'tools/train-fast.mjs', 'tools/train-best.mjs', 'tools/train-3p.mjs', 'tools/ring2-run.mjs',
    'js/train/evo.js', 'js/train/policy.js', 'js/train/trainer.js'];
  const bad = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    for (let i2 = 0; i2 < lines.length; i2++) {
      const L = lines[i2]; const t2 = L.trim();
      if (t2.startsWith('*') || t2.startsWith('//') || t2.startsWith('/*')) continue;   // 注释里提到名字不算
      for (const k of keyList) if (L.indexOf(k) >= 0) bad.push(f + ':' + (i2 + 1) + '  ' + k);
    }
  }
  eq(bad.length, 0, '这些 env 的读取必须集中在 server/econ-env.mjs：\n    ' + bad.join('\n    '));

  /* ② 正证：两端都从它导入，且 worker 把**生效值**打出来（"到没到 worker"唯一能直接看到的证据，
   * 与 `[ringforce] worker eps=` 同族 —— 本轮全靠第三方复核才发现，就是因为没有这一行）。 */
  for (const f of ['server/train-server.mjs', 'server/train-worker.mjs']) {
    ok(readFileSync(f, 'utf8').indexOf("from './econ-env.mjs'") >= 0, f + ' 必须从 econ-env.mjs 导入');
  }
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('hasEconOverride(econEnv)') >= 0, 'worker 必须用 hasEconOverride 判"要不要覆写"');
  ok(wk.indexOf('[econ] worker 生效值: ') >= 0, 'worker 必须有 [econ] worker 生效值 回执（否则静默半开看不出来）');
  ok(wk.indexOf('T.economyReward()') >= 0, '回执必须报 setter 后的**生效值**，不能只报 env 原文');

  /* ③ 契约：`readEconEnv` 可能返回的每个键，`evo.js:setEconomyReward` 都必须认 ——
   * 漏一个键 = "开关看着接上了、实际被 setter 忽略"，与 §2 是同一类事故的另一种形态。 */
  const keys = ((ee.match(/ECON_REWARD_KEYS = \[([\s\S]*?)\]/) || ['', ''])[1].match(/'([^']+)'/g) || [])
    .map(function (q) { return q.replace(/'/g, ''); });
  ok(keys.length >= 6, 'ECON_REWARD_KEYS 应 >=6 个键（实测 ' + keys.length + '）');
  /* ===== v1.5.128（门禁审计 §2-1）：**把"1200 字符窗口"检查换成运行时往返** =====
   * 旧写法 `evo.slice(indexOf('function setEconomyReward(o)'), +1200).indexOf('o.<键> != null')` 有三个毛病：
   *   ① 保的是**排版**（加一行注释就能把后面的键顶出窗口）；② 窗口会在模式串**中途截断** ⇒ 起点 1194 也会红
   *   （我为它连红四次）；③ 抓不到"读了但没生效"。下面喂值读回：**更强、且与排版无关**。 */
  const SENT = { target: 7, cap: 33, divW: 0.123, divK: 9, divRoleW: 0.25, divCatW: 0.25, divForceGens: 5, wallFilter: true, fitCal: true,
    wallGames: 4, hoardOnLeftover: true, convRatio: true, convOffense: true, hoardCapMult: 5, stockBonus: 0.11,
    blockW: 0.22, widthW: 0.33, bigcardW: 0.44 };
  const ALIAS = { target: 'targetOverride', cap: 'capOverride' };
  const notOk = [];
  try {
    T.setEconomyReward({ reset: true });
    for (const k of keys) {
      const s = Object.prototype.hasOwnProperty.call(SENT, k) ? SENT[k] : 0.5;
      T.setEconomyReward({ reset: true });
      let back = null;
      const one = {}; one[k] = s;
      try { T.setEconomyReward(one); back = T.economyReward(); } catch (e) { notOk.push(k + '(抛错)'); continue; }
      const f = ALIAS[k] || k;
      if (!back || !(f in back)) { notOk.push(k + '(未接受)'); continue; }
      if (back[f] !== s && String(back[f]) !== String(s)) notOk.push(k + '(未生效:' + String(back[f]) + ')');
    }
  } finally { T.setEconomyReward({ reset: true }); T.setEconomyReward({ divRoleW: 0 }); }
  eq(notOk.length, 0, 'setEconomyReward 必须**接受并生效** econ-env 的每个键（运行时往返；坏: ' + notOk.join(',') + '）');

  /* ④ 行为：把真模块跑一遍 —— 新名优先、旧名兜底、空串＝未设、wallFilter 只认 '1'。 */
  const prog = [
    'const { pathToFileURL } = require("node:url");',
    'import(pathToFileURL(process.cwd() + "/server/econ-env.mjs").href).then(function (M) {',
    '  var a = M.readEconEnv({ EPIRUS_DIV_W: "0.3", EPIRUS_ECO_DIVW: "0.06", EPIRUS_DIV_K: "6", EPIRUS_DIV_FORCE_GENS: "60", EPIRUS_WALL_FILTER: "1", EPIRUS_WALL_GAMES: "3" });',
    '  var b = M.readEconEnv({ EPIRUS_ECO_DIVW: "0.06" });',
    '  var c = M.readEconEnv({ EPIRUS_DIV_W: "", EPIRUS_WALL_FILTER: "0" });',
    '  console.log(JSON.stringify({ a: a, b: b, c: c, ha: M.hasEconOverride(a), hb: M.hasEconOverride(b), hc: M.hasEconOverride(c) }));',
    '}).catch(function (e) { console.log("ERR " + e.message); });'
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', prog], { encoding: 'utf8' });
  ok(r.status === 0 && String(r.stdout || '').indexOf('ERR ') < 0,
    'econ-env 自检进程必须正常跑完（stdout: ' + String(r.stdout || '').slice(0, 120) +
    ' stderr: ' + String(r.stderr || '').slice(0, 200) + '）');
  const out = JSON.parse(String(r.stdout || '').trim().split('\n').pop());
  eq(out.a.divW, '0.3', '新名 EPIRUS_DIV_W 必须优先于旧名 EPIRUS_ECO_DIVW');
  eq(out.a.wallFilter, true, "EPIRUS_WALL_FILTER='1' 才是开");
  eq(out.b.divW, '0.06', '旧名 EPIRUS_ECO_DIVW 必须继续生效（历史臂的启动命令仍可复现）');
  eq(out.c.divW, null, "空串必须当**未设**（不能被静默当成 divW=0 从而改掉训练口径）");
  eq(out.c.wallFilter, null, "EPIRUS_WALL_FILTER='0' 不是开（与改动前的语义逐字一致）");
  eq(out.hc, false, "只有空串 / 非 '1' 的 wallFilter ⇒ 不应触发覆写（保持出厂行为一字不变）");
  eq(out.hb, true, '只设旧名也必须触发覆写');
});

t('D80 类间广度权重 DIV_ROLE_W：默认 0（逐位等于旧口径）+ 走单一来源接线 + 真源与 breadthProfile 同一个', function () {
  /* v1.5.92 引入（当时叫 `DIV_CAT_W`、按 4 个 `cat`），v1.5.93 换成按 **8 个功能角色** 并更名 `DIV_ROLE_W`。
   * 设计上必须同时满足三条：
   *   ① 默认（不设 env）**逐位等于** v1.5.87 的旧口径 ⇒ 旧产物 / 旧读数仍可比（"默认不设即不变"的规矩）；
   *   ② 类间那一层必须与 `tools/audit-lib.mjs` 的 `breadthProfile` **同一个真源**（现在是 `T.roleOf`），
   *      否则"训练在优化什么"与"体检在量什么"会分叉 —— v1.5.89 的静默半开就是这一族；
   *   ③ 旧 env `EPIRUS_DIV_CATW` 必须仍可用（新名优先），否则老命令会**静默变成空操作**。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('let DIV_ROLE_W = 0;') >= 0, '默认必须是 0（不设 env 即旧行为）');
  /* v1.5.128（审计 §2-4）：把**源码文本钉**换成**运行时喂值读回** ——
   * 旧写法逐字匹配 setter 的表达式，2026-09-19 一次"语义不变的重写"就把它弄红过（它保的是排版不是行为）。 */
  try {
    T.setEconomyReward({ reset: true });
    T.setEconomyReward({ divRoleW: 0.4 });
    eq(T.economyReward().divRoleW, 0.4, '新名 divRoleW 必须生效');
    T.setEconomyReward({ reset: true });
    T.setEconomyReward({ divCatW: 0.4 });
    eq(T.economyReward().divCatW, 0.4, '旧名 divCatW 必须兜底生效（新名优先）');
  } finally { T.setEconomyReward({ reset: true }); T.setEconomyReward({ divRoleW: 0 }); }
  ok(evo.indexOf('const spMixNorm = (1 - DIV_ROLE_W) * spDivNorm + DIV_ROLE_W * spRoleNorm;') >= 0,
    '混比公式必须显式可读（W=0 ⇒ 只剩 spDivNorm = 旧口径）');
  ok(evo.indexOf('const divBonus = DIV_W * spMixNorm;') >= 0, 'fit 必须用混比后的量');
  ok(evo.indexOf('Math.log(K_ROLE)') >= 0, '类间熵的分母必须是**声明的角色数** ln(K_ROLE)（固定，不可随实测变）');
  const ee = readFileSync('server/econ-env.mjs', 'utf8');
  ok(ee.indexOf("'EPIRUS_DIV_ROLEW'") >= 0 && ee.indexOf("'EPIRUS_DIV_CATW'") >= 0 &&
    ee.indexOf("'divRoleW'") >= 0 && ee.indexOf("'divCatW'") >= 0,
    'econ-env 必须同时覆盖新名与旧名（D77 会顺带查"读到的键 setter 都认"）');
  /* 行为：设一次 / 试旧名 / 试优先序 / 复位 —— 防"写了但从没生效"这类静默空操作 */
  eq(T.economyReward().divRoleW, 0, 'D80 跑到这里时它必须还是默认 0');
  eq(T.setEconomyReward({ divRoleW: 1 }).divRoleW, 1, '设 divRoleW=1 后 economyReward() 必须回读 1');
  eq(T.setEconomyReward({ divCatW: 0.5 }).divRoleW, 0.5, '旧名 divCatW 必须仍能设（老命令不能变成空操作）');
  eq(T.setEconomyReward({ divRoleW: 0.25, divCatW: 0.75 }).divRoleW, 0.25, '两个都给时新名优先');
  eq(T.economyReward().K_role, 8, '声明的角色数应为 8');
  eq(T.setEconomyReward({ divRoleW: 0 }).divRoleW, 0, '复位必须回 0（别把状态泄漏给后面的用例）');
});

t('D81 功能角色表 roleOf：只从声明字段推导（**不得枚举卡名**）+ 每张非ジ卡恰好一类 + tools 侧共用同一真源', function () {
  /* v1.5.93（用户裁定的下一步）：v1.5.92 的 4 个 `cat` 太粗 —— `attack` 里混着三种**不同功能**
   * （枪=廉价压制 / 激光剑=穿透反射 / 狙击=穿透防御）⇒ 几次 token 出手就能把类间熵拉满。
   * 换成 8 个功能角色。这条守门钉住两件事：分类是**推导**出来的（不是手搓），以及两处**不许各写一张表**。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  const i0 = evo.indexOf('  function roleOf(k) {');
  const i1 = evo.indexOf('const K_ROLE = (function () {');
  ok(i0 > 0 && i1 > i0, '必须能定位 roleOf 的定义（用 K_ROLE 定界）');
  const seg = evo.slice(i0, i1);
  ok(seg.indexOf('c.cat') >= 0 && seg.indexOf('c.pierce') >= 0 && seg.indexOf('c.dmg') >= 0,
    '分类只许用 rules.js 已声明的字段（cat / pierce / dmg）');
  const NAMES = ['gun', 'sword', 'tank', 'snipe', 'guard', 'reflect', 'bagua', 'shift', 'jinshield', 'armor',
    'proto', 'holo', 'charge', 'ring', 'drain', 'railgun', 'miniT', 'bigT', 'rod', 'laserEye', 'transfer',
    'curse', 'firestorm', 'mine', 'taunt', 'cannon', 'purify', 'dualGun', 'mirror'];
  const hit = NAMES.filter(function (n) { return seg.indexOf("'" + n + "'") >= 0 || seg.indexOf('"' + n + '"') >= 0; });
  ok(hit.length === 0, '不得枚举卡名（命中：' + hit.join(',') + '）—— 手搓白名单是本仓库踩过三次的坑');
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  const seg2 = al.slice(al.indexOf('export function breadthProfile('));
  ok(seg2.indexOf('T.roleOf') >= 0 && seg2.indexOf('K_role') >= 0,
    'breadthProfile 必须调 T.roleOf（单一真源），不得自己再写一张角色表');
  /* 行为：在**真卡表**上跑一遍 —— 每张卡都要有归属，且非ジ卡恰好 8 类 */
  const roles = {};
  const bad = [];
  Object.keys(R.byKey).forEach(function (k) {
    const r2 = T.roleOf(k);
    if (typeof r2 !== 'string' || !r2) bad.push(k);
    if (k !== R.SK.JI) roles[r2] = (roles[r2] || 0) + 1;
  });
  eq(bad.length, 0, '每张卡都必须能归类（未归类：' + bad.join(',') + '）');
  eq(T.roleOf(R.SK.JI), 'ji', 'ジ 必须单独归为 ji（它是攒钱/等待，不算技能选择）');
  eq(Object.keys(roles).length, 8, '非ジ卡应恰好分 8 个角色（实测 ' + Object.keys(roles).sort().join(',') + '）');
  ['defense', 'economy', 'pierceBoth', 'pierceReflect', 'pierceDefense', 'burst', 'damage', 'utility'].forEach(function (n) {
    ok(roles[n] >= 1, '角色 ' + n + ' 至少要有一张卡（实测 ' + (roles[n] || 0) + '）');
  });
});

t('D84 真示范（override）：默认关、只在教师动作**可负担**时覆盖、教师按名字选、env 两端接线', function () {
  /* v1.5.96（承接第九轮复核 §5-2 的"价值估计病"）：v1.5.31 起的"教师模仿"其实**只做一致性计数**
   * （`_mt/_mm`），策略从来没走过教师那条线 ⇒ 跨回合后果（环先付 3 ジ、之后 +3/回合）没被体验过。
   * 这条门钉住补上的"真示范"的三个安全性质，以及"名字→函数"只在 evo.js 里写一遍。 */
  /* §改（2026-10-22 千问·第六批）：这里原来三条都是 `evo.js` 的**写法钉**：
   *   · `let IMIT_OVERRIDE = false;`（默认关）⇒ 换成跑出来的（下面那一块：新沙箱 + 只设教师和窗口，从不打开开关 ⇒
   *     `countImitInject()` 必须 `fired=0` 且 `tries=0`，再拿"同一份沙箱把开关打开 ⇒ 必须真开火"当**正对照**）；
   *   · `if (IMIT_OVERRIDE && teacherFn && imitB > 0 && subOK && state.rng && …)` 那一整句 ⇒ **删**：
   *     同一个洞由 `D86:1811` 与 `D87:1842/1844/1845` 各钉了一份，本门这条只是把同一行源码**抄第二遍**（搬家不是丢覆盖）；
   *   · `legal.some(l => l.key === ta.key && l.affordable)`（可负担才覆盖）⇒ **保留**，但换成跑出来的：
   *     教师给一张**付不起**的卡 ⇒ `unaffordable` 必须涨而 `fired` 不涨（这是"示范不许教成白扔一回合"的可观测量）。 */
  {
    const W0 = sandbox(process.cwd());
    const T0 = W0.EpirusTrainer, P0 = W0.EpirusPolicy;
    T0.setTrainMode('multi');
    T0.setImitUntil(100);
    ok(T0.imitBetaForGen(0) > 0, '前置：β(gen0) 必须 >0（实测 ' + T0.imitBetaForGen(0) + '）⇒ 否则下面"没开火"是窗口关着的空枪');
    const OPPS0 = [{ name: 'balanced', sel: W0.EpirusBots.pickBalanced }];
    const score0 = function () { T0.scoreMemberN(P0.makePolicy(0.25), OPPS0, 8, 3, 0, 0, 0); };
    eq(T0.setImitTeacherByName('heavyfire'), true, '前置：教师必须真设上了（否则 fired=0 什么都没判）');
    T0.resetImitStat();
    score0();
    const c0 = T0.countImitInject();
    eq(c0.fired, 0, '真示范必须**出厂默认关**（新沙箱里实测 fired=' + c0.fired + ' tries=' + c0.tries +
      '）⇒ 默认开会让旧产物与新读数不可比（这条以前靠读 `let IMIT_OVERRIDE = false;` 那一行）');
    eq(c0.tries, 0, '连"轮到示范"都不许发生（tries>0 = 门控那句已经被走过，只是没中概率）');
    /* 正对照：把开关打开 ⇒ 这把尺**必须读得到开火**，否则上面两个 0 是"尺没接上"的形状 */
    T0.setImitOverride(true);
    T0.setImitTeacher(function () { return { key: R.SK.JI, target: null }; });   // ジ 恒可负担 ⇒ 一定会覆盖
    T0.resetImitStat();
    score0();
    const c1 = T0.countImitInject();
    ok(c1.fired > 0, '正对照：同一份沙箱把开关打开 ⇒ 必须**真开火**（实测 tries=' + c1.tries + ' fired=' + c1.fired +
      '）⇒ 读不到开火就说明这把尺看不见注入，上面那条 fired=0 是空枪');
    /* 可负担/合法门槛（替掉原来那条钉 `legal.some(l => l.key === ta.key && l.affordable)` 的字面钉）：
     * 教师给的动作当回合**下不了手**（不在合法表里 / 付不起，同一条 `!okL` 分支）⇒ 只许记账，不许覆盖 */
    T0.setImitTeacher(function () { return { key: '__no_such_card__', target: 1 }; });
    T0.resetImitStat();
    score0();
    const c2 = T0.countImitInject();
    ok(c2.tries > 0, '前置：这一趟必须真轮到过示范（实测 tries=' + c2.tries + '）⇒ 否则下面两条在读一个没走到的分支');
    eq(c2.fired, 0, '教师动作**当回合下不了手**时必须不覆盖（实测 fired=' + c2.fired + ' unaffordable=' + c2.unaffordable +
      '）⇒ 覆盖下去就是教它"白扔一回合"');
    ok(c2.unaffordable > 0, '而且必须**记在账上**（实测 unaffordable=' + c2.unaffordable + '）⇒ 静默丢掉与"从没轮到"长得一样');
    T0.setImitOverride(false);
  }
  /* §改（2026-10-22 千问·第六批）：这里原来是两条写法钉 ——
   *   · `function teacherFull(` ⇒ 换成**直接调用**（下面那一组）：注入用的是"带 target 的完整动作"，
   *     这件事本来就问得出答案，不必问源码长什么样；
   *   · `if (n === 'antiring') return setAntiRingTeacher();` + `typeof BOT_PICKS[n] === 'function'` ⇒ **删**：
   *     "名字→函数映射在这一份里"早已由下面三行 `T.setImitTeacherByName(...)` 真调着判
   *     （`antiring` ‖ `heavyfire` ‖ 认不出的名字必须返回 false）⇒ 映射搬去 server/worker 或换个写法，调用那三条立刻红。
   *     实测：把 `if (n === 'antiring')` 换成等价的 `if ('antiring' === n)` ⇒ 旧钉**红**、调用腿**绿**（这条钉只会为一次无害重排报错）。 */
  {
    const tfSt = S.createState('multi', { next: T.mulberry32(20261022) }, 5);
    const tfLegal = Play.legalActions(tfSt, 0);
    const tfFull = T.teacherFull(function () { return { key: R.SK.GUN, target: 2 }; }, tfSt, 0, tfLegal);
    eq(tfFull && tfFull.target, 2, '注入必须走**带 target 的完整动作**（实测读到 ' + JSON.stringify(tfFull && tfFull.target) +
      '）⇒ 丢了 target 的示范会教成"打错人"');
    const tfKey = T.teacherFull(function () { return R.SK.GUN; }, tfSt, 0, tfLegal);
    eq(tfKey && tfKey.key, R.SK.GUN, '教师只回 key 的旧形状也必须吃得下（`target` 由这一处补，不许每个调用方各补一遍）');
  }
  /* 行为：真模块上设一次 / 复位；名字认不认 */
  eq(T.setImitOverride(true), true, 'setImitOverride(true) 必须回读 true');
  eq(T.setImitOverride(false), false, '复位必须回 false（别把状态泄漏给后面的用例）');
  eq(T.setImitTeacherByName('antiring'), true, 'antiring 必须仍被认（老命令不能变成空操作）');
  eq(T.setImitTeacherByName('heavyfire'), true, '必须能按名字取 `BOT_PICKS` 里的教师');
  /* §改（2026-10-22 千问·第六批）：原来这条钉的是 evo.js 里出现 `global.EpirusBots` 那一串 ⇒ 换成**真走一遍那条路**：
   *   按函数名取环专精当教师必须成功，且取到的**就是 `bots.js` 那个函数对象**（引用相等 ⇒ 抄一份副本会当场红）。
   *   剩下半件"不许往默认池 `BOT_PICKS` 加键"没有便宜的运行时口径（那张表不对外导出）⇒ 仍写在注释与
   *   `docs/GATE-SHIFTS.md` §廿一，判它的人一眼能看到；本轮不假装有腿。 */
  eq(T.setImitTeacherByName('pickRingSpam'), true, '环专精不在 `BOT_PICKS` 里 ⇒ 必须仍能按**全局注册表的函数名**取到教师（实测 false ⇒ 那条路被摘了）');
  ok(T.imitTeacher() === Bots.pickRingSpam, '按名字取到的必须**就是** `bots.js` 那个函数对象（引用相等 ⇒ 第二份实现/自己包一层都在这条上红）');
  eq(T.setImitTeacherByName('绝对不存在的名字'), false, '认不出的名字必须返回 false（不许静默当没设）');
  T.setImitTeacher(null);   // 复位成默认教师
  /* 接线：worker 必须读 ENV 并打回执 */
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf("process.env.EPIRUS_IMIT_OVERRIDE === '1'") >= 0 && wk.indexOf('T.setImitTeacherByName') >= 0,
    'worker 必须读 EPIRUS_IMIT_OVERRIDE 并按名字设教师');
  ok(wk.indexOf("[imit] worker 启动值") >= 0, 'worker 必须打启动回执（照 [econ] 的先例，防静默半开）');
  ok(wk.indexOf('gens(env)=') >= 0 && wk.indexOf('以**消息**为准') >= 0,
    '启动回执必须标明"env 是拷贝、示范代数以消息为准"（免得下一个人又被 gens=0 误导）');
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
  /* v1.5.96 追加（被真实事故逼出来的）：示范代数必须**走消息**。
   * `worker_threads` 的 process.env 是**创建时的拷贝**，而 `EPIRUS_IMIT_GENS` 是服务端事后派生的
   * ⇒ 只走 env 时 worker 永远读到 0 ⇒ 整臂与对照**逐位相同**（本轮 `v7ringT` 实测，回执里 `gens=0`）。 */
  const pt = readFileSync('server/paralleltrain.mjs', 'utf8');
  ok(pt.indexOf('imitGens: Number(process.env.EPIRUS_IMIT_GENS || 0)') >= 0,
    'evalN 消息必须带 `imitGens`（示范代数不能只走 env）');
  ok(wk.indexOf('T.setImitUntil(Number(msg.imitGens) || 0)') >= 0, 'worker 必须按**消息**设示范代数');
  ok(wk.indexOf('示范代数没在 worker 生效') >= 0, 'worker 必须自检生效并**响亮报错**（不许静默半开）');
  ok(wk.indexOf('[imit] worker **消息**生效值') >= 0, '消息生效值必须有回执（照 [econ] 的先例）');
  /* v1.5.96 真根因：IMIT 接线原先**只写在 2 人路径 `runTrain`**，而 runner 带 `n=5` 走的是
   * `runTrainN` ⇒ N 人臂上 `imitB ≡ 0`、整臂与对照逐位相同。⇒ 两条路径必须**共用一份实现**。 */
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf('function applyImitEnv(') >= 0, '必须抽成共用的 `applyImitEnv`（同一件事不许写两遍）');
  /* §改（2026-10-22 千问）：原来两条分别是"数 `applyImitEnv(` 出现次数 ≥3"和
   *   `/async function runTrainN\([\s\S]{0,400}applyImitEnv\(/`（锚点 + 400 字符窗）⇒ v1.7.142 把 N 人真身
   *   改名 `runTrainNOne`、外面留个调度壳，窗口里就看不见调用了：门红的是"名字搬了"，不是"示范没接"。
   *   现在按**调用链**判：入口名单从 handler 反查，受托者名单从函数体反查，
   *   每个入口要么自己调，要么委托给一个真调了它的同文件函数。 */
  const fmap84 = fnMap(sv);
  const imitHosts = fmap84.filter(function (x) { return x.name !== 'applyImitEnv' && x.body.indexOf('applyImitEnv(') >= 0; })
    .map(function (x) { return x.name; });
  ok(imitHosts.length >= 2, '`applyImitEnv` 必须被**两条训练路径**都调用（实测调到它的函数：' + imitHosts.join(',') +
    '）—— 本轮事故正是"只写在 2 人路径"');
  const h84 = sv.indexOf('http.createServer');
  const entryFns84 = Array.from(new Set((sv.slice(h84).match(/\brunTrain[A-Za-z0-9_]*(?=\s*\()/g) || [])));
  ok(h84 > 0 && entryFns84.length >= 2, '从 handler 反查训练入口只拿到 ' + entryFns84.length + ' 个（' + entryFns84.join(',') +
    '）⇒ 反查失效，这条门已经看不见入口');
  for (const en of entryFns84) {
    const b84 = (fmap84.filter(function (x) { return x.name === en; })[0] || {}).body || '';
    const delegates = imitHosts.filter(function (h) { return h !== en && b84.indexOf(h + '(') >= 0; });
    ok(b84.indexOf('applyImitEnv(') >= 0 || delegates.length > 0,
      en + ' 这条链必须把示范参数下达出去（自己调 `applyImitEnv` 或委托给真调了它的函数 ‖ 实测委托到：' +
      (delegates.join(',') || '(无)') + ' ‖ 全文件调了它的函数：' + imitHosts.join(',') + '）');
  }
  ok(/\[imit\] 主线程生效值 gens=/.test(sv), '主线程必须打"生效值"回执（含 gens / frac / teacher / accepted / override / β(gen0)）');
  /* v1.5.96 补：名字解析不出来**必须响亮拒绝** —— `v7stock1` 就是 env 写了 `deepsaver`（不在 BOT_PICKS 里）
   * 而库里静默用默认教师 heavyfire，整臂**贴着错标签跑完**（回执打了 accepted=false，但没人拦）。 */
  ok(sv.indexOf('教师名字解析失败') >= 0 && /if \(!acc\) \{\s*throw new Error/.test(sv),
    '教师名字解析不出来必须抛错拒绝（不许静默退回默认 heavyfire）');
});

t('D85 分段教师计划（两段课程）：解析只写一份、两条路径 + worker 都调它、每段各自退火、坏名字抛错', function () {
  /* v1.5.97（承接 v1.5.96 §7 的机制结论）：一次性"开环教师"够不着环（环恒不可负担）；
   * 两段课程 = 先用攒钱教师把 ep 攒起来，再换开环教师。这条门钉住这四件事。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('function setImitPlanByName(spec, totalGens) {') >= 0, '必须有**唯一一份**解析函数 setImitPlanByName');
  ok(evo.indexOf('let IMIT_PLAN = null;') >= 0, '默认无计划（不设 plan ⇒ 行为与旧版逐位相同）');
  ok(evo.indexOf('if (!IMIT_UNTIL || gen >= IMIT_UNTIL) return 0;') >= 0,
    '旧口径（单一退火窗）必须保留 —— 不设 plan 时逐位不变');
  ok(evo.indexOf('return IMIT_BETA * Math.max(0, 1 - (gen - s.start) / span);') >= 0,
    '计划模式下必须**每段各自**线性退火（第二段要重新施加压力）');
  ok(evo.indexOf("imitTeacherForGen(gen) || BOT_PICKS['heavyfire']") >= 0,
    '取教师必须按当前代数走 imitTeacherForGen（分段）');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf('T.setImitPlanByName(process.env.EPIRUS_IMIT_PLAN, imitGens)') >= 0, '主线程必须按 plan 建计划');
  ok(readFileSync('server/paralleltrain.mjs', 'utf8').indexOf('imitPlan: process.env.EPIRUS_IMIT_PLAN || null') >= 0,
    'evalN 消息必须带 imitPlan（同 imitGens 的理由：env 是拷贝）');
  const wk2 = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk2.indexOf('T.setImitPlanByName(msg.imitPlan, Number(msg.imitGens) || 0)') >= 0,
    'worker 必须调**同一个**解析函数（不许各写一份）');
  ok(wk2.indexOf('[imit] worker **消息**计划生效') >= 0, '计划生效必须有回执（含第二段 β ⇒ 自证每段退火）');
  ok(wk2.indexOf("[imit] worker **消息**计划生效") < wk2.indexOf('catch (e) {', wk2.indexOf('msg.imitPlan')) ||
    wk2.indexOf('postMessage({ type: \'evalNResult\', id: msg.id, error: String((e && e.message) || e) })') >= 0,
    'worker 侧解析失败必须 post error（不许崩、不许静默）');
  /* 行为：空 spec ⇒ 无计划；单段 ⇒ 1 段；坏名字 ⇒ 抛错；两段 ⇒ 教师不同 + 第二段 β>0 */
  eq(T.setImitPlanByName('', 100), 0, '空 spec 必须等于"无计划"');
  eq(T.setImitPlanByName('heavyfire:1', 100), 1, '单段计划应有 1 段');
  let threw = null;
  try { T.setImitPlanByName('noSuchTeacher:1', 100); } catch (e) { threw = String((e && e.message) || e); }
  ok(threw && threw.indexOf('教师名字解析失败') >= 0,
    '计划里"认不出的名字"必须抛**名字解析**错误（实测：' + threw + '）');
  let threw2 = null;
  try { T.setImitPlanByName('不是合法片段:1', 100); } catch (e) { threw2 = String((e && e.message) || e); }
  ok(threw2 && threw2.indexOf('无法解析') >= 0,
    '计划里格式错的片段必须抛**片段解析**错误（实测：' + threw2 + '）—— 两条错路都得响亮');
  eq(T.setImitPlanByName('heavyfire:0.5,guardgun:0.5', 100), 2, '两段计划应有 2 段');
  ok(T.imitTeacherForGen(10) !== T.imitTeacherForGen(90), '两段的教师必须不同（前段 10 / 后段 90）');
  /* 钉的是"**段边界处 β 回到接近满额**"（第二段重新施加压力）：
   * 两段各 50 代 ⇒ β(50) 应≈0.12；旧的单窗口口径在 50 处只有 0.06 ⇒ 这条能判别。 */
  ok(T.imitBetaForGen(50) > 0.10,
    '第二段开头必须重新接近满额（β(50) 实测 ' + T.imitBetaForGen(50).toFixed(3) + ' > 0.10；旧口径会是 0.060）');
  ok(T.imitBetaForGen(90) > 0, '第二段内部必须仍为正（β(90) 实测 ' + T.imitBetaForGen(90).toFixed(3) + '）');
  ok(T.imitBetaForGen(100) === 0, '窗末 β 必须为 0（退火到底）');
  eq(T.setImitPlanByName('', 0), 0, '复位成无计划（别把状态泄漏给后面的用例）');
});

t('D86 只示范目标卡（only）：override 与奖励计数**都**过滤 + 非法卡名抛错 + 随消息下发', function () {
  /* v1.5.98（承接 v1.5.97 §4）：两段课程里第二段的 fallback 覆盖把第一段教出来的"攒"抹掉了。
   * 修法 = 让示范只作用于**教师真要教的那张卡**（环）⇒ fallback 不再覆盖策略自己的好动作。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('let IMIT_ONLY = null;') >= 0 && evo.indexOf('function setImitOnly(k) {') >= 0,
    '必须有 only 开关且默认 null（不过滤 ⇒ 行为与旧版逐位相同）');
  ok(evo.indexOf('else if (onlyKey && ta.key !== onlyKey) { IMIT_STAT.filteredByOnly++; }') >= 0 &&
    evo.indexOf('IMIT_STAT.fired++;') >= 0,
    'override 必须被 only 过滤（只覆盖教师真要教的那张卡）—— v1.5.181 起同时记"被 only 过滤"的次数'
    + '（这条原来是钉旧文本形态的，随 v1.5.181 的结构改动而红 ⇒ 见门禁审计 §2-4：这类文本钉应改运行时）');
  ok(evo.indexOf('if (tk != null && (!onlyKey || tk === onlyKey) && subOK) {') >= 0,
    '**奖励计数也必须被 only 与 subOK 过滤** —— 否则"与 fallback 一致"白拿奖励，正是抹掉"攒"的那股力');
  ok(evo.indexOf('function imitOnlyForGen(gen)') >= 0 && evo.indexOf('imitB, imitOnlyForGen(gen)') >= 0,
    '取值必须按当前代数走 imitOnlyForGen（计划里可**按段**设 only）');
  ok(evo.indexOf('(?:\\s*:\\s*([A-Za-z_][A-Za-z0-9_]*|\\*))?$/.exec(parts[i])') >= 0,
    '计划片段必须支持第三段 `:卡名`（或 `:*` = 不过滤）');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf('T.setImitOnly(process.env.EPIRUS_IMIT_ONLY || null)') >= 0, '主线程必须设 only');
  ok(readFileSync('server/paralleltrain.mjs', 'utf8').indexOf('imitOnly: process.env.EPIRUS_IMIT_ONLY || null') >= 0,
    'evalN 消息必须带 imitOnly（env 是拷贝的正当教训）');
  ok(readFileSync('server/train-worker.mjs', 'utf8').indexOf('T.setImitOnly(msg.imitOnly)') >= 0,
    'worker 必须按消息设 only');
  /* 行为：默认 null；合法卡可设；非法卡抛错；计划第三段能按段指定 */
  eq(T.setImitOnly(null), null, '不设 ⇒ null（不过滤）');
  eq(T.setImitOnly('ring'), 'ring', '合法卡必须能被设上');
  let threwO = null;
  try { T.setImitOnly('不是一张卡'); } catch (e) { threwO = String((e && e.message) || e); }
  ok(threwO && threwO.indexOf('不是一张合法的卡') >= 0, '非法卡名必须抛错（实测：' + threwO + '）');
  eq(T.setImitOnly(null), null, '复位');
  eq(T.setImitPlanByName('pickDeepSaver:0.5,pickRingSpam:0.5:ring', 100), 2, '第三段形式的计划必须能解析');
  eq(T.imitOnlyForGen(10), null, '段1（无 only）不设过滤');
  eq(T.imitOnlyForGen(90), 'ring', '段2 必须按段生效 only=ring');
  eq(T.setImitPlanByName('', 0), 0, '复位计划');
});

t('D87 只在补贴局里示范目标卡（subOnly）：只对设了 only 的示范生效、值随消息下发', function () {
  /* v1.5.99（承接 v1.5.98 §3）：原生经济里示范"开环"≡ 对"攒"征税（逼它把攒的 ep 花掉）；
   * 补贴局里花的是**白来的 ep** ⇒ 不构成对"攒"的惩罚。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('let IMIT_SUB_ONLY = false;') >= 0 && evo.indexOf('function setImitSubOnly(on)') >= 0,
    '必须有 subOnly 开关且默认 false（不影响旧行为）');
  ok(evo.indexOf('const subOK = (!IMIT_SUB_ONLY || !onlyKey || !!subFlag);') >= 0,
    '门槛必须**只对设了 onlyKey 的示范**生效（段1 教攒不受影响）');
  ok(evo.indexOf('imitB > 0 && subOK && state.rng') >= 0, 'override 必须被 subOK 门控');
  ok(evo.indexOf('&& subOK) {') >= 0,
    '**奖励计数也必须被 subOK 门控**（否则奖励侧仍在原生局里推它花掉攒的 ep）');
  ok(evo.indexOf('const regenThisGame = commitGame ? 2 : regenForGame(g, games, gen);') >= 0 &&
    evo.indexOf('const regen = regenThisGame;') >= 0,
    '补贴局的判定必须**只算一遍**（同一口径，避免两处各算一遍）；v1.5.186 起必须把 `gen` 传进去（相位按代旋转）');
  ok(evo.indexOf('imitB, imitOnlyForGen(gen), subThisGame)') >= 0, '本局是否补贴必须传进 chooser');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf("T.setImitSubOnly(process.env.EPIRUS_IMIT_SUB_ONLY === '1')") >= 0, '主线程必须设 subOnly');
  ok(readFileSync('server/paralleltrain.mjs', 'utf8').indexOf('imitSubOnly: process.env.EPIRUS_IMIT_SUB_ONLY || null') >= 0,
    'evalN 消息必须带 imitSubOnly');
  ok(readFileSync('server/train-worker.mjs', 'utf8').indexOf('T.setImitSubOnly(String(msg.imitSubOnly') >= 0,
    'worker 必须按消息设 subOnly');
  eq(T.setImitSubOnly(true), true, '可打开');
  eq(T.setImitSubOnly(false), false, '可关回（默认关）');
  /* v1.5.141（DS 研究）：`subBead` 与 `subOnly` **同一族**（补贴局里连"珠"一起补）——
   * 接线必须齐，否则旋钮会**静默无效**：本日研究查出的病正是"教师示范了 0 次"却没人发现
   * （`pickHeavyFire` 最大 ep=2 ⇒ 结构上买不起 cost≥3 ⇒ v7t2 那一臂的"贵卡示范段"是空的）。
   * 所以这条旋钮**自己先被门管住**：默认关 + 四个接线点 + 只作用于补贴局。 */
  const ev3 = readFileSync('js/train/evo.js', 'utf8');
  ok(ev3.indexOf('function setSubBead') >= 0, 'evo 必须实现 setSubBead');
  ok(ev3.indexOf('SUB_BEAD && regen > 0') >= 0, '补珠只许作用于 regen>0 的补贴局（原生局/体检读数不受影响）');
  ok(ev3.indexOf('onRoundStart: subBeadHook') >= 0, '补贴局必须把补珠钩子真的传进 onRoundStart');
  ok(readFileSync('server/paralleltrain.mjs', 'utf8').indexOf('subBead: process.env.EPIRUS_SUB_BEAD || null') >= 0,
    'evalN 消息必须带 subBead');
  ok(readFileSync('server/train-worker.mjs', 'utf8').indexOf('T.setSubBead(String(msg.subBead') >= 0,
    'worker 必须按消息设 subBead（否则旋钮静默无效）');
  eq(T.subBeadOn(), false, '默认必须是关（不设 EPIRUS_SUB_BEAD ⇒ 旧行为逐位不变）');
  eq(T.setSubBead(true), true, '可打开');
  eq(T.setSubBead(false), false, '可关回');
});

t('D90 清场计数奖励：口径必须与门禁同源（收缩分界 + 归因）且默认关', function () {
  /* v1.5.103（v1.5.100 §20）：门禁要 `场B 清场 ≥ 0.3/局`，而训练 `fit` 里**一项都没有** ⇒
   * 演化没有理由去长"真的能打死人"（新规则下打 1 点就赢）。这条门钉住口径与接线。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(ev.indexOf('function countClears(events, seat)') >= 0, '必须有 countClears');
  ok(ev.indexOf("if (e.reason === '终局收缩') shrink = true;") >= 0,
    '分界必须是**收缩自己的标记**（`reason === \'终局收缩\'`）—— 与 audit-lib 场B 清场同口径；'
    + 'v1.5.113 之前两边都用 `source == null`，那会被地雷/天火的无来源伤害误触发（见 D98）');
  ok(ev.indexOf('lastBy[e.pid] === seat') >= 0,
    '必须**归因**（`death` 事件不带凶手 ⇒ 只能用"最后一次伤害来源"回溯；不归因等于奖励"别人清场"）');
  ok(ev.indexOf('const clearBonus = CLEAR_W * Math.min(1, clears / 1)') >= 0,
    '奖励必须进 `fit` 且封顶 /1（与 tgtBonus 同尺度，按 v1.5.79 的标度教训）');
  ok(ev.indexOf('let CLEAR_W = 0;') >= 0, '默认必须是 0（不开就是原行为）');
  eq(T.clearReward().w, 0, 'D90 跑到这里时 CLEAR_W 必须仍是 0');
  eq(T.setClearReward(0.2), 0.2, 'setClearReward 必须回读生效值');
  eq(T.setClearReward(0), 0, '复位回 0（别把状态泄漏给后面的用例）');
  const pt = readFileSync('server/paralleltrain.mjs', 'utf8');
  ok(pt.indexOf('clearW: Number(process.env.EPIRUS_CLEAR_W || 0) || null') >= 0,
    '必须随**消息**下发（env 是 worker 创建时的拷贝）');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('T.setClearReward(Number(msg.clearW) || 0)') >= 0 && wk.indexOf('[clear] worker **消息**生效值') >= 0,
    'worker 必须按消息设 + 打回执（今晚已四次栽在"看着接了、其实没通"）');
});

t('D97 环的**段长口径**（复核 §4）：必须按"用成了"数段（被无效化=断链）+ 不许只报"上环率"', function () {
  /* 复核 §4 的原话：现在报的"环转化率 8.06%"只数"上没上环" ⇒ **一个疯狂单按的包会被读成"很会用环"**，
   * 而成本表是"首次净 −2 / 第 2 次刚好回本 / 第 3 次起才 +3" ⇒ 必须有段长口径。 */
  const pc = readFileSync('tools/probe-convert.mjs', 'utf8');
  ok(pc.indexOf('ringRun2') >= 0 && pc.indexOf('ringRun3') >= 0,
    '探针必须给出 ringRun2（段长≥2 / 可负担点）与 ringRun3（段长≥3 / 可负担点）');
  ok(pc.indexOf("e.key !== R.SK.RING) close(e.pid)") >= 0, '非环出手必须终止当前段（出手侧口径）');
  ok(pc.indexOf("e.type === 'voided'") >= 0 && pc.indexOf('close(e.pid);                                                // R10') >= 0,
    '被无效化必须终止当前段 —— 这是 R10 之后的真口径（所以必须读**事件**而不是选择序列）');
  /* （原来这里还钉"探针源码里必须写明旧口径会被单按刷高"那句注释 —— v1.6.12 删除 ⇒ 同族第 89 条。
   *   这条门真正的牙是上面那两条（段长两档必须在 + 被无效化必须断段）与下面那条（调用点必须在）。） */
  ok(pc.indexOf('extractRingRuns(st.events)') >= 0,
    '**调用点必须在**（v1.5.111 我第一版只写了定义、漏了调用 ⇒ 读数全是 0 —— 与 D28"接线在文件里≠在跑的那条路径上"同族）');
  });

t('D100 E4：挡下伤害奖励（env 单一来源 · 只认真的挡下 · 标度按实测 · 必须进 gFit）', function () {
  /* 复核 §23/E4：防御族**费用 0 ep** ⇒ 不需要多回合计划 ⇒ 是"shaping 只在 0.0X 尺度、买不动多回合计划"
   * 这条限制唯一还可能绕过的方向。口径：只数 `{type:'blocked'|'reflect', to: seat}`（**不认摆架势**）。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(ev.indexOf('function countBlocks(events, seat)') >= 0, '必须有 countBlocks');
  ok(ev.indexOf("(e.type === 'blocked' || e.type === 'reflect') && e.to === seat") >= 0,
    '只认"真的挡掉/弹走"（blocked / reflect），且必须是**发生在我身上**的那一次');
  ok(ev.indexOf('const blockBonus = BLOCK_W * Math.min(1, blocks / 1);') >= 0,
    '标度必须是 /1（量出来的：线上包每席每局 0.10 次挡下 ⇒ 用 /2 会退化成常数微扰）');
  ok(ev.indexOf('+ blockBonus') >= 0,
    '必须真的进 gFit（不是只算不用 —— D28 的教训）');
  ok(ev.indexOf('let BLOCK_W = 0;') >= 0, '默认必须关（0 ⇒ 出厂行为一字不变）');
  ok(ev.indexOf('if (o.blockW != null) BLOCK_W = Math.max(0, Number(o.blockW));') >= 0,
    'setEconomyReward 必须接受 blockW');
  /* 同 D66：v1.5.272（§E83）把"跟着自己的 W 计数"换成整族 `DOSE_ON` ⇒ 钉的语义没变（必须在快照循环里累加），
   * 换的是形状；`blockBonus` 那条断言仍单独守着"付钱按 `BLOCK_W`"这一半（全族 8 个形状由门 D179 统一钉）。 */
  ok(ev.indexOf('if (DOSE_ON) blocks += countBlocks') >= 0, '必须在快照循环里累加（v1.5.272 起按整族 `DOSE_ON`）');
  ok(ev.indexOf('if (BLOCK_W > 0) blocks +=') < 0, '不许退回"计数跟着自己的 W 关"（§E65 那族假零结果的成因）');
  ok(ev.indexOf('BLOCK_W = 0;') >= 0, 'reset 必须把它复位');
  const en = readFileSync('server/econ-env.mjs', 'utf8');
  ok(en.indexOf("'EPIRUS_BLOCK_W'") >= 0, 'env 名必须在**单一来源**里（否则 worker 拿不到 ⇒ 附录 D 臂 K 的 A/A 事故）');
  ok(en.indexOf("'blockW'") >= 0 && en.indexOf('blockW: nv(e.EPIRUS_BLOCK_W)') >= 0,
    '必须被 readEconEnv 读出（两端同一对函数）');
  /* v1.5.128（审计 §2-1）：原来这里复制了一份"D77 的 1200 字符窗口"检查（同一规则三处实现，改一次要改三处）。
   * D77 已改成**运行时往返**（喂值读回）⇒ 这条窗口子检查**删除**。 */
});

t('D101 贵卡出手奖励（v1.5.126 用户洞察：它不会用电磁炮/大雷、也丢了地雷/净化 ⇒ 没必要攒 ep）', function () {
  /* 贵卡由**声明字段**推导（D81/D72 的规矩：不得枚举卡名）：`cost ≥ 3`（大雷 5 · 地雷/净化/摄魂 3）
   * 或 `energyNeeds` 非空（电磁炮需 1 电珠 · 激光眼需爆珠）。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  /* v1.5.128（审计 §2-4）：**语义改用运行时验**（原来这三条是源码文本钉 —— 保排版不保行为）。
   * 贵卡 = `cost ≥ 3` 或 `energyNeeds` 非空 ⇒ 大雷(5)/地雷(3)/净化(3)/电磁炮(需电珠) 记分，枪(1)/狙击(2)/ジ(0) 不记；
   * 且只认 `outcome === 'ok'`（被无效化的不算 ⇒ 不可刷）。**不枚举卡名**：靠声明字段。 */
  const mkAct = function (key, voided) { return { type: 'action', pid: 0, outcome: voided ? 'voided' : 'ok', key: key }; };
  eq(T.countBigCards([mkAct(R.SK.BIG_T)], 0), 1, '真正的落雷（cost 5）必须记分');
  eq(T.countBigCards([mkAct(R.SK.MINE), mkAct(R.SK.PURIFY)], 0), 2, '地雷/净化（cost 3）必须记分');
  eq(T.countBigCards([mkAct(R.SK.RAILGUN)], 0), 1, '电磁炮（需 1 电珠）必须记分');
  eq(T.countBigCards([mkAct(R.SK.GUN)], 0), 0, '枪（cost 1）不得记分');
  eq(T.countBigCards([mkAct(R.SK.SNIPE)], 0), 0, '狙击枪（cost 2）不得记分');
  eq(T.countBigCards([mkAct(R.SK.JI)], 0), 0, 'ジ 不得记分');
  eq(T.countBigCards([mkAct(R.SK.BIG_T, true)], 0), 0, '被无效化的出手不得记分（不可刷）');
  ok(ev.indexOf('const bigBonus = BIGCARD_W > 0 ?') >= 0, '标度必须有关闭守卫（0 * NaN = NaN 会把 fit 打成 NaN —— v1.5.124 的坑）');
  /* v1.5.187：原来钉的是 `+ blockBonus + widthBonus + bigBonus));`（**带尾巴**）⇒ 任何新加权项接到后面都会误伤这条门。
   * 与 D100 同形（只钉"+ 该项"，不钉求和式的顺序/结尾）。 */
  ok(ev.indexOf('+ bigBonus') >= 0, '必须真的进 gFit');
  ok(ev.indexOf('let BIGCARD_W = 0;') >= 0, '默认必须关');
  ok(ev.indexOf('if (o.bigcardW != null) BIGCARD_W') >= 0, 'setEconomyReward 必须接受 bigcardW');
  const en = readFileSync('server/econ-env.mjs', 'utf8');
  ok(en.indexOf("'EPIRUS_BIGCARD_W'") >= 0 && en.indexOf("'bigcardW'") >= 0 && en.indexOf('bigcardW: nv(e.EPIRUS_BIGCARD_W)') >= 0,
    'env 名/键/读出三处都要在**单一来源**里');
});

t('D108 候选特征不得把"打 0 号座"当成"无目标"（qoder-research 0920 · 座位身份泄漏现行犯）', function () {
  /* 病（policy.js:397 旧写法 `if (!tid ...)`）：target pid 0 是 falsy ⇒ "打 0 号"的候选
   * 拿到与"无目标"同款的**全零目标块** ⇒ 网络能把"零块"学成"软目标"，镜像局全员集火 0 号座。
   * 实测（RESEARCH-LOG §9）：v7aim1-82 自对局 120 局 × 3 盐配置，**首死 120/120 全是 0 号座**。
   * 守门 = 镜像等性价对：完全对称局面上，(座1 打 座0) 与 (座0 打 座1) 是同一相对局面，
   * actionFeatures 必须**逐位相等**；并对照组 (座1 打 0) vs (座1 打 2) 允许不等（防止"恒输出零块"的假修法）。 */
  const st = S.createState('long', { next: function () { return 0.5; } }, 5);
  st.slotSalt = 123456;
  const a = Pol.actionFeatures(st, 1, 'snipe', { key: 'snipe', target: 0 });
  const b = Pol.actionFeatures(st, 0, 'snipe', { key: 'snipe', target: 1 });
  eq(a.length, b.length, '两侧维数一致');
  const diff = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  eq(diff.length, 0, '镜像等性价对（1→0 vs 0→1）特征必须逐位相等，不等的维：' + JSON.stringify(diff));
  /* 对照组必须造**不对称**局面：完全对称局面上不同目标的特征**本应全同**（那是真对称，不是假修法）。 */
  st.p[2].hp = 3;
  const c2 = Pol.actionFeatures(st, 1, 'snipe', { key: 'snipe', target: 2 });
  st.p[2].hp = 5;
  let anyDiff = false;
  for (let i = 0; i < a.length; i++) if (c2[i] !== a[i]) anyDiff = true;
  ok(anyDiff, '对照组（不对称局面）：换目标的特征不得全同（挡"永远返回零块"的假修法）；对称局面特征全同是**正确的**');
});
t('D109 形状适应度 S4_W：默认关 · 断线必抛 · 真评分器可跑（P2 · qoder-research 0920）', function () {
  /* 三件事：① 出厂 s4W=0（不加项）；② S4_W>0 而宿主没注入 __shapeScorer ⇒ scoreMemberN **抛错**
   *    （静默降级 = 又一次"开关看着接上、实际作用在没跑的那条路"——附录 D 臂 K 的 A/A 事故形状）；
   * ③ 真接线可跑：shape-scorer.mjs（复用 tools/v2v4-lib 的 duelAssembly，D107 单一来源）在 np-test 沙箱里
   *    对随机策略出 0..1 的分。 */
  eq(T.economyReward().s4W, 0, '默认 s4W 必须 0（econ-env 不设 ⇒ 出厂逐字不变）');
  T.setEconomyReward({ wallFilter: false });   // 自防：不依赖前面门的收尾（wallFilter 泄漏史见 evo reset 注释）
  const p = Pol.makePolicy(0.25);
  const opps = [{ name: 'random', sel: Bots.pickRandom }];
  const had = sb.window.__shapeScorer;
  try {
    T.setEconomyReward({ s4W: 0.2 });
    delete sb.window.__shapeScorer;
    let threw = false;
    try { T.scoreMemberN(p, opps, 1, 3, 1, 0, 0); } catch (e) { threw = /__shapeScorer/.test(String(e && e.message)); }
    ok(threw, 'S4_W>0 且评分器缺线 ⇒ 必须抛错（不许静默跑成 A/A）');
    sb.window.__shapeScorer = function () { return 0.5; };
    const r1 = T.scoreMemberN(p, opps, 1, 3, 1, 0, 0);
    ok(r1 && typeof r1.fit === 'number' && isFinite(r1.fit), '接上桩评分器后打分必须正常出 fit');
    const v = makeShapeScorer(sb.window, 2)(p);
    ok(typeof v === 'number' && v >= 0 && v <= 1, '真评分器（V4 形状 × 两条外部线）输出须在 0..1，实测 ' + v);
  } finally {
    T.setEconomyReward({ reset: true }); T.setEconomyReward({ divRoleW: 0 });
    if (had) sb.window.__shapeScorer = had; else delete sb.window.__shapeScorer;
  }
});
t('D112 **广度两个模式都判** + 最大单卡占比排除ジ且打出卡名（v1.5.145 用户裁定）', function () {
  /* 病（用户 2026-09-21 晚）：现役包"不探索时广度非常差"却能上线。查证：阻断项 `G` 只取
     `selfPlay(..., 'multi', G)`，而产品常用模式是 long（现役 long G_eff 2.79 < 3 却无人管）。
     用户裁定："**两个模式都判**" + "**最大单卡占比要排除 ji**"（查证：`breadthProfile` 的计数条件本就
     `key !== R.SK.JI` ⇒ 已排除，但打印只给数字 ⇒ 会被读成ジ的份额 ⇒ 补卡名）。 */
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  ok(pc.indexOf("selfPlay(W, params, 'multi', G)") >= 0, '第一模式（multi）必须仍走自对局');
  ok(pc.indexOf("selfPlay(W, params, 'long', G)") >= 0, '第二模式（long = 产品常用模式）必须也有自对局 G');
  ok(pc.indexOf('G2: spL') >= 0 && pc.indexOf("G2name: 'long'") >= 0, 'long 的 G 必须传进 feasibilityOf 才会**阻断**');
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('o.G2') >= 0 && al.indexOf('第二模式') >= 0, 'feasibilityOf 必须真的用 G2 判（否则只是打印）');
  ok(al.indexOf('e.key !== R.SK.JI') >= 0, '广度计数必须排除ジ（S/最大单卡占比同源）');
  ok(al.indexOf('maxCardKey: maxCardKey') >= 0, 'maxCardShare 必须带卡名返回（读者可自证"不含ジ"）');
  ok(pc.indexOf('最大单卡占比（**非ジ**）') >= 0 && pc.indexOf('brd.maxCardKey') >= 0,
    '打印必须写明"非ジ"并把卡名印出来');
  ok(pc.indexOf('两个模式都判') >= 0, '打印必须说明两模式都判（否则读者以为另一栏只记录）');
});

t('D113 chooser 入口必须免疫"直喂原始包"（0921 qoder 审计：忘 unpack ⇒ 静默均匀分布、零报错）', function () {
  /* 病（实测踩中）：把 `window.EPIRUS_CHAMPION_3P` 的**原始外壳**直接喂 `policyChooserN` /
   * `Trainer.pickChampion` 不抛错，权重取不到 ⇒ forwardCands 输出**均匀分布**（25 候选实测全 0.002）
   * ⇒ 谁写新工具忘了 unpack，就会拿着"冠军只出ジ"这种假结论去对账（09-21 写对战台当场中招，
   * unpack 后同包复跑 balanced 50/50）。守卫在 `evo.js` 的 `normChampParams`：原始壳自动 unpack、
   * 垃圾**响亮抛错**、Float64Array/null 走原路（训练热路径零成本 + 不打破健康门槛兜底）。 */
  const raw = sb.window.EPIRUS_CHAMPION_3P;
  ok(!!raw && Array.isArray(raw.a), '前置：仓库里必须有真 3P 包（门不依赖本机 .bak）');
  const W = Pol.unpack(raw);
  ok(!!W, '前置：原始包必须能过 checkPack 并 unpack（否则先修包，别动这条门）');
  Pol.setRng(T.mulberry32(113113));
  /* ① 行为一致：同一装配逐 seed 出招相同（eps=0 贪心 ⇒ 判定不含抽样噪声） */
  for (let g = 0; g < 3; g++) {
    const mk = function () {
      const st = S.createState('long', { next: T.mulberry32(77000 + g) }, 3);
      X.startTurn(st); st.p[0].ep = 5;
      return st;
    };
    const s1 = mk(), s2 = mk();
    const l1 = Play.legalActions(s1, 0).filter(function (x) { return x.affordable; });
    const l2 = Play.legalActions(s2, 0).filter(function (x) { return x.affordable; });
    const p1 = T.policyChooserN(raw, 0.15)(s1, 0, l1);
    const p2 = T.policyChooserN(W, 0.15)(s2, 0, l2);
    ok(p1.key === p2.key, '直喂原始包与 unpack 后必须同一手（seed ' + g + '：' + p1.key + ' vs ' + p2.key + '）');
  }
  /* ② "相同"不许是两条都退化成均匀分布的巧合 ⇒ 单独证明 W 在该态下给的是**尖**分布 */
  const s3 = S.createState('long', { next: T.mulberry32(77000) }, 3);
  X.startTurn(s3); s3.p[0].ep = 5;
  const l3 = Play.legalActions(s3, 0).filter(function (x) { return x.affordable; });
  const cands3 = Pol.candidatesFor(s3, 0, l3, {});
  const f3 = Pol.forwardCands(s3, 0, cands3, W, { temp: 0.05 });
  let mx = 0; for (let i = 0; i < f3.probs.length; i++) mx = Math.max(mx, f3.probs[i]);
  /* ⚠️ 阈值必须是**相对均匀基线**而不是绝对值：两级 softmax（先技能后条目）把 joint 峰的
   * 上界压到恰好 0.5（v1.5.74 的两级归一 + temp 0.05 ⇒ "技能概率 1.0 × 键内 0.5"），
   * 写 `>0.5` 会把**正确实现**判红（0921 首跑实测峰恰好 0.5000）。均匀退化读数是 1/n（此处 ≈0.024）
   * ⇒ 判据取 4/n：离退化线两个数量级、离上界留够余量，任何"真尖"包都过、任何平摊都红。 */
  ok(mx > 4 / f3.probs.length, 'unpack 权重必须产生非均匀分布（实测峰 p=' + mx.toFixed(3) + ' vs 均匀基线 ' +
    (1 / f3.probs.length).toFixed(3) + '；旧坑读数就是那个平摊值）');
  /* ③ 垃圾输入必须响亮 */
  let thr1 = false, thr2 = false;
  try { T.policyChooserN({}, 0.15); } catch (e) { thr1 = /unpack|权重/.test(String(e && e.message)); }
  try { T.policyChooserN({ a: [1, 2, 3] }, 0.15); } catch (e) { thr2 = true; }
  ok(thr1, '空对象必须被守卫挡下并给出点名 unpack 的错（不许再走静默均匀）');
  ok(thr2, '维度错的假包必须被挡下（checkPack 失败 ⇒ 重训重发，不许静默）');
  /* ④ null 的既有兜底不许被守卫打破（LEGACY(null)=true 是健康门槛拒配时的活路） */
  ok(typeof T.policyChooserN(null, 0.15) === 'function', 'params=null 必须仍可建 chooser');
});

t('D123 收割席注入（v1.5.160 · §N13 · 用户裁定"场B 缺口走对手池"）：默认关逐位不变 + **判开火计数不判横幅** + 座位不偏置 + 不拿纯攒钱型当陪练', function () {
  /* 四条各钉一类 09-22 实测过的病：
   *  · **默认关 ⇒ 逐位不变**（一次加旋钮不许偷偷挪所有历史臂的评估分布）；
   *  · **判作用点**：§N11 的病是"横幅读回 0.34 ✓ 而一局未注"（`PASSIVE_FIELD` 查 `BOT_PICKS` 不存在的键 ⇒ 死分支），
   *    烧掉 `v7xn10c`/`v7xn11a` 两臂 —— 所以本门**不钉横幅**，钉"跑完报了几局注入"；
   *  · **座位不偏置**：用户 09-22 裁掉"每 8 局注入"那种恒落 `g=0` ⇒ 恒 0 号座的覆盖（`seat = g % n`）；
   *  · **不罚囤**：用户原话"囤一点 ep 放大招也是有好处的" ⇒ 陪练必须是**会抢收割**的 `pickKillSecure`，
   *    只攒不打的 farmer/deepsaver 不许上这条分支（那等于出一道没有反击的题）。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  /* ① 静态：注入分支取的是注册表函数，且该分支里不许出现纯攒钱型 */
  ok(evo.indexOf('Bots.pickKillSecure') >= 0, '注入必须直接取 Bots.pickKillSecure（不查 BOT_PICKS —— 那张表加键会改默认池）');
  const br = /else if \(killSeatPid[\s\S]*?\n        \} else/.exec(evo);
  ok(br, '收割席分支必须存在（v1.5.163 起它是唯一的注入分支）');
  ok(!/farmer|deepsaver/.test(br[0]), '注入分支里不许出现 farmer/deepsaver（用户裁定：囤是有效打法，不许拿它当陪练罚）');
  ok(evo.indexOf('KILL_STAT.fired++') >= 0 && typeof T.countKillSeats === 'function',
    '必须有开火计数（§N12 教训：setter + 横幅读回证明不了作用点）');
  /* v1.7.73 · gate-sentinel ③ 分诊：摘掉 `indexOf('本臂作废')` —— 那是**措辞**（换个说法门就红、行为没变）。
   *   要保的语义是「一局未注 / 座位偏置 ⇒ **响亮失败**」，而响亮 = `exit 8`（上面那半句仍在判，且接口处真跑过）。 */
  ok(t3.indexOf('process.exit(8)') >= 0, '一局未注 / 座位偏置 ⇒ 必须 exit 8 响亮（措辞不判：换成哪句话都一样要响）');
  /* ② 单元：只注多人局 + 永不注到受评席自己 + 相位真的按代旋转（自建沙箱，别污染共享 T） */
  const sb2 = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
  sb2.window = sb2; sb2.globalThis = sb2;
  for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
    'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(f, 'utf8'), sb2, { filename: f });
  const T2 = sb2.window.EpirusTrainer;
  eq(T2.setKillField(0.2), 0.2, 'setKillField 必须回读生效值');
  for (let g = 0; g < 8; g++) for (let gen = 0; gen < 20; gen++) {
    const pid = T2.killSeatFor(g, gen, 0, 2, 0);
    eq(pid, -1, '2P 局一律不许注（切片的全部意义是"对着考卷基准打"，注进去等于换参照 ⇒ 目标与验收不一致）');
    const p5 = T2.killSeatFor(g, gen, 2, 5, 0);
    ok(p5 === -1 || p5 !== 2, '注入席永远不许是受评席自己（g=' + g + ' gen=' + gen + ' 实得 ' + p5 + '）');
  }
  /* 承诺局（`T.isCommitGame`）**一分不进 fit** ⇒ 那一局不许注（注了等于白注，§N12 的第三处错位）
   * ⚠️ v1.5.186：这里原来自己写了一遍 `g % 3 === 0` —— 而承诺局的相位从本版起**按代旋转**（修 DS 交接 §3 坑#8 的席位锁死），
   *    于是这条门立刻变成"用旧口径判新代码"的红。**门也不许复制判据**（同一味药，换了个病人）。 */
  let commitLeaks = 0;
  for (let gen = 0; gen < 40; gen++) for (let g = 0; g < 8; g++) if (T2.isCommitGame(g, gen, 2) && T2.killSeatFor(g, gen, g % 5, 5, 2) >= 0) commitLeaks++;
  eq(commitLeaks, 0, '承诺局不许注入（那局不进 fit ⇒ 白注）');
  const seen = new Set();
  for (let gen = 0; gen < 6; gen++) for (let g = 0; g < 8; g++) { const p = T2.killSeatFor(g, gen, g % 5, 5, 0); if (p >= 0) seen.add(g % 5); }
  ok(seen.size >= 3, '受评座位必须随代旋转（6 代里至少覆盖 3 个不同座位；实测 ' + seen.size + ' 个 [' + Array.from(seen).sort().join(',') + ']）');
  T2.setKillField(0);
  /* ③ 行为 · 默认关 ⇒ 与登记产物**逐位相同**（seed 7 · 3 代 × 3 人 × 6 局 × 种群 4） */
  const wh = function (p) {
    const s = readFileSync(p, 'utf8');
    const m = /"a":\[([^\]]*)\]/.exec(s);
    return m ? createHash('sha1').update(m[1]).digest('hex').slice(0, 10) : 'NOPARSE';
  };
  const dir = mkdtempSync(join(tmpdir(), 'd123-'));
  /* ⚠ `nocache` 那一档是**必须**的（2026-10-16 实测）：下面 2059 行读的是**子进程写出的产物**
   *   `docs/artifacts/train-3p-out.js`，而 `spawnCached` 命中时子进程**根本不跑** ⇒ 读到的是盘上留着的
   *   上一次的东西（`_ctx.mjs:44` 那段 §2026-10-10 立的规矩就是这件事："命中 ⇒ 子进程不跑 ⇒ 读到上次留下的文件
   *   ⇒ 可双向骗人"）。实测病象：`probe-instruments` 的 D158 用**默认落点**跑过 train-3p 之后，
   *   缓存一热 D123 就红（`got=50ada2f512 want=aa743488cc`），而门本身是对的。 */
  let miniN = 0;
  const mini = function (env, nocache, defaultOut) {
    /* `defaultOut` 只有**要读默认落点产物的那一次**才传：其余两次改道进自己的 temp 目录
     *   （2026-10-16：否则未命中缓存时它们顺手写脏 `docs/artifacts/train-3p-out.js`，而那是别人当基线的文件）。 */
    miniN++;
    /* §E654：`defaultOut` 那一支不再"默默用缺省路径"，而是**显式声明基线身份**（`EPIRUS_T3P_BASELINE=1`）——
     *   根上那条闸（`train-3p` 的 exit 10）只该为这种"我就是要写基线"的调用放行；落盘时它打 `[WRITE-BASELINE]`。 */
    const outEnv = defaultOut ? { EPIRUS_T3P_BASELINE: '1' } : { EPIRUS_T3P_OUT: join(dir, 'd123-' + miniN + '.js') };
    return (nocache ? spawnNC : spawnCached)(['tools/train-3p.mjs', '3', '3', '6', '4'], { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd123', EPIRUS_BAND_DIR: dir }, outEnv, env || {}),
      encoding: 'utf8', timeout: 300000,
    });
  };
  let r = mini({}, true, true);   /* 第一次**必须真跑、且必须写默认落点**：跑完要读它写出的产物去比 `CLI_ARM_BASELINE` */
  eq(r.status, 0, '默认关必须跑通（实测 exit=' + r.status + '）');
  eq(wh('docs/artifacts/train-3p-out.js'), CLI_ARM_BASELINE, '默认关的产物必须与登记基线逐位相同（动了它 = 偷偷改了所有 CLI 臂的分布）');
  /* ④ 行为 · 下达 ⇒ **必须真开火**，且覆盖 ≥2 个受评座位（判计数，不判横幅） */
  r = mini({ EPIRUS_KILL_FIELD: '0.2' });
  const so = String(r.stdout || '');
  eq(r.status, 0, 'KILL_FIELD=0.2 必须跑通（实测 exit=' + r.status + '）\n' + so.slice(-400));
  const fired = /开火计数：注入 (\d+) 局 · 覆盖受评座位 (\d+) 个/.exec(so);
  ok(fired, '必须打印开火计数（没有它 = 回到"横幅自证"的老病）');
  ok(Number(fired[1]) > 0, '注入了密度就必须真注到局（实测 0 局 ⇒ 死作用点，正是 §N11 那两臂的病）');
  ok(Number(fired[2]) >= 2, '注入覆盖的受评座位必须 ≥2 个（座位偏置 = 用户 09-22 裁掉的对象；实测 ' + fired[2] + '）');
  ok(so.indexOf('注入名单 killsecure') >= 0, '名单只许 killsecure（出现别的 = 有人往这条路上加了罚囤陪练）');
  /* ⑤ 反证 · 密度小到不可能开火 ⇒ 必须 exit 8（证明这道闸自己会响，而不是摆设） */
  const never = mini({ EPIRUS_KILL_FIELD: '1e-9' });
  eq(never.status, 8, 'EPIRUS_KILL_FIELD 小到一局未注时必须 exit 8（拒绝白跑；实测 exit=' + never.status + '）');
});

t('D129 训练模式可以在 CLI 上下达（v1.5.169 · §N28 · 用户"炼一个 5 血长程通吃其他模式"）：认不了就 exit 7，不许静默退回 multi', function () {
  /* 病（这次是"从来没接过"）：`evo.js` v1.4.0 就有 `setTrainMode`（门 D10 钉着它透传到建局），
   * 但 CLI 从来没有这个键 ⇒ `TRAIN_MODE` 恒 multi，"5 血冠军从来没被训过"（`evo.js:28` 自己注释着）。 */
  ok(TEK.indexOf('EPIRUS_TRAIN_MODE') >= 0, '必须进 train-env 的单一来源清单（别处不许再抄键名）');
  eq(readTrainEnv({ EPIRUS_TRAIN_MODE: 'long ' }).mode, 'long', 'readTrainEnv 要搬运并去空格');
  eq(readTrainEnv({}).mode, undefined, '没下达 ⇒ 不带 mode 键（⇒ 行为逐字不变）');
  eq(hasTrainOverride({ mode: 'long' }), true, '只有 mode 也算覆盖（不许被 kill 一家独占）');
  const dir = mkdtempSync(join(tmpdir(), 'd129-'));
  /* ① 乱写的模式名 ⇒ 必须 exit 7 且**不产出**（静默退回 multi 就是 §N11 那一族） */
  const bad = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd129bad', EPIRUS_TRAIN_MODE: 'nope', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: join(dir, 'd129bad.js') }), encoding: 'utf8', timeout: 300000 });
  eq(bad.status, 7, '不认的模式名必须 exit 7（实测 ' + bad.status + '）');
  ok(/不是规则表里的模式/.test(String(bad.stderr || '')), 'exit 7 要说清为什么');
  /* ② 合法名 ⇒ 跑通 + 横幅读回 + 产物 meta 自证 */
  const good = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd129long', EPIRUS_TRAIN_MODE: 'long', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: join(dir, 'd129long.js') }), encoding: 'utf8', timeout: 300000 });
  eq(good.status, 0, '长程臂要跑得通');
  ok(/训练模式已下达：EPIRUS_TRAIN_MODE=long ⇒ 消费点读回 long/.test(String(good.stdout || '')), '必须印"下达 ⇒ 读回"（横幅只证明变量，读回证明消费点）');
  const mt = packMetaOf(join(dir, 'd129long.js'));
  eq(mt.recipe.trainMode, 'long', '产物要自带这臂的模式（日志会滚走，.bak 不会）');
  eq(mt.recipe.trainModeEffective, 'long', '连消费点读回值一起记');
  /* ③ 长程臂建局真的 5 血（D10 证的是 setter；这里证**整条 CLI 路**通到建局） */
  eq(T.setTrainMode('long'), 'long', 'setter 要能读回');
  const stL = S.createState(T.trainMode(), { next: T.mulberry32(5) }, 5);
  eq(stL.mode.hp, 5, '`long` 模式建局 hp 必须是 5（否则"训长程"是空话）');
  const stM = S.createState(T.setTrainMode('multi'), { next: T.mulberry32(5) }, 5);
  eq(stM.mode.hp, 3, '切回 multi 必须是 3 血（同一批建局参数，只有模式在动）');
});

t('D132 补贴率旋钮 `EPIRUS_REGEN_SLICE`（v1.5.177 · 双侧实验的前置）：默认 0.08 逐位不变 + 下达必须读回 + 拒静默空转', function () {
  /* 动因：全卡边际扫描证明"钱是系统性的墙"（long 59%/18%/3% 买得起 1/2/3 费；multi 0 张可测）
   * ⇒ "给钱+教卡"的双侧实验**必须先能调"给多少钱"**，而它此前是硬编码常量 `REGEN_SLICE = 0.08`。 */
  const ev = readFileSync('js/train/evo.js', 'utf8');
  ok(ev.indexOf('let REGEN_SLICE = 0.08;') >= 0, '必须是 let（可下达）且默认 0.08（不下达 ⇒ 逐位等于旧行为）');
  ok(ev.indexOf('function setRegenSlice(v)') >= 0 && ev.indexOf('function regenSlice()') >= 0, '必须有 setter 与回执');
  ok(ev.indexOf('if (!isFinite(n) || n <= 0) return REGEN_SLICE;') >= 0, '非法值必须原样返回（宿主据此判"被拒"）');
  ok(ev.indexOf('setRegenSlice, regenSlice,') >= 0, '必须导出（CLI/服务端两边都要能调）');
  ok(ev.indexOf('const step = Math.max(2, Math.round(1 / REGEN_SLICE));') >= 0, '消费点必须真的读这个变量（不是只定义）');
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf('process.env.EPIRUS_REGEN_SLICE') >= 0, 'CLI 必须读这个 env');
  ok(t3.indexOf('没有 setRegenSlice ⇒ 拒绝静默空转') >= 0 && t3.indexOf('process.exit(7)') >= 0,
    '没有 setter 必须**响亮拒绝**（§N11/§N8 那一族：横幅读回不等于作用点发生）');
  ok(t3.indexOf('消费点读回') >= 0, '下达后必须**读回消费点**的值');
  ok(t3.indexOf('const reqSlice = Number(process.env.EPIRUS_REGEN_SLICE);') >= 0 &&
    t3.indexOf('!isFinite(reqSlice)') >= 0,
    '非数值必须被挡（**NaN 安全**：`Math.abs(got - NaN) > 1e-9` 恒 false ⇒ 我第一版 `abc` 实测 exit 0 静默跑完）');
});

t('D134 切片相位不许与座位轮换锁死（v1.5.186 · 复核 DS 交接 §3 坑#8）：承诺局/补贴局必须按代旋转，且示范要真覆盖各席', function () {
  /* 病（我实测到的，DS 只记了"注入偏向 0 号席，未结案"）：受评席 `seat = g % n`，而承诺局用 `g % 3`、补贴局用 `g % step`
   * ⇒ **n=3（CLI 臂默认人数）时两者锁死**：示范覆盖席 `{0:236,1:20,2:1}`（92% 在 0 号席）；n=5·12 局时 2 号席**整晚一次没拿到**。
   * ⇒ "给钱/示范"类读数全带席位运气。修法 = 相位按代旋转 + 收成单一来源 `sliceHit`（原来"承诺局"在两个函数里各写一遍 `% 3`）。 */
  const SH = T.sliceHit, IC = T.isCommitGame;
  ok(typeof SH === 'function' && typeof IC === 'function', '必须导出 sliceHit/isCommitGame（不导出 = 门只能钉文本）');
  /* ① 相位随代旋转，且三代合起来覆盖全部余数（否则总有席位拿不到补贴） */
  const hitSets = [0, 1, 2].map(function (gen) {
    const s = []; for (let g = 0; g < 9; g++) if (SH(g, 3, gen)) s.push(g); return s.join(',');
  });
  ok(new Set(hitSets).size === 3, '同一 step 下 gen=0/1/2 的命中集合必须互不相同（实测 ' + hitSets.join(' | ') + '）');
  const seatsByGen = [0, 1, 2].map(function (gen) {
    const s = new Set(); for (let g = 0; g < 12; g++) if (IC(g, gen, 2)) s.add(g % 3); return s;
  });
  eq(seatsByGen[0].size, 1, '单代内 n=3 时承诺局确实只落 1 个席（这就是锁死的形状 —— 本门要钉的是"跨代必须换席"）');
  const union = new Set([].concat.apply([], seatsByGen.map(function (s) { return Array.from(s); })));
  eq(union.size, 3, 'gen=0/1/2 合起来必须覆盖 3 个受评席（有席位整晚拿不到补贴 = 这次的病）');
  /* ② 不传 gen ⇒ 相位 0 ⇒ 与旧版逐字相同（历史臂仍可复现） */
  eq(SH(0, 3), true, 'sliceHit 缺省 gen ⇒ 命中 g=0（旧口径 g % step === 0）');
  eq(SH(1, 3), false, '旧口径下 g=1 不命中');
  /* ③ 单一来源：`killSeatFor` 与评分循环必须用同一个承诺局判据（原来各写一遍 `% 3`） */
  for (let gen = 0; gen < 4; gen++) for (let g = 0; g < 8; g++) {
    if (IC(g, gen, 2)) eq(T.killSeatFor(g, gen, g % 3, 3, 2), -1,
      'gen' + gen + ' g' + g + '：承诺局不许注收割席（两个判据必须一致，否则一处旋转一处没旋转）');
  }
  const evoSrc = readFileSync('js/train/evo.js', 'utf8');
  /* 只判**代码行**：注释里出现这个字面量是历史说明（"原来两处各写一遍"），不是漂移 */
  const bare = evoSrc.split('\n').filter(function (ln) {
    return ln.indexOf('g % 3 === 0') >= 0 && !/^\s*(\*|\/\/|\/\*)/.test(ln);
  });
  eq(bare.length, 0, '`g % 3 === 0` 不许再出现在代码里（只许走 isCommitGame）实测 ' + bare.map(function (l) { return l.trim(); }).join(' / '));
  ok(evoSrc.indexOf('regenForGame(g, games, gen)') >= 0, '补贴切片必须收到 gen（不传 = 相位不转 = 病复发）');
  /* ④ 真跑一臂：判**产出的覆盖席**，不判横幅（§N11 那条纪律） */
  const dir = mkdtempSync(join(tmpdir(), 'd134-'));
  const run = spawnCached(['tools/train-3p.mjs', '40', '3', '8', '8'], { env: Object.assign({}, process.env, {
      EPIRUS_SEED: '31', EPIRUS_IMIT_TEACHER: 'pickBigTFocus', EPIRUS_IMIT_ONLY: 'bigT',
      EPIRUS_IMIT_OVERRIDE: '1', EPIRUS_IMIT_FRAC: '0.5', EPIRUS_IMIT_SUBONLY: '0',
      EPIRUS_REGEN_SLICE: '0.25', EPIRUS_ARM: 'd134', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: join(dir, 'd134.js')
   /* ⚠ 必须**改道**（2026-10-16 实测）：这条 spawn 没设 `EPIRUS_T3P_OUT` ⇒ 未命中缓存时它把产物写在**默认落点**
    *   `docs/artifacts/train-3p-out.js` —— 那是 `train-evo` 的 D123/D162 当 CLI 基线的同一个文件。CI 上每部分一台机
    *   所以看不见；本机并行跑门就变成「隔壁部分把我的基线写脏了」。本门只吃 stdout / 只读自己的 temp 目录 ⇒ 改道零损失。 */
    }), encoding: 'utf8', timeout: 600000
  });
  eq(run.status, 0, '示范臂要跑得通');
  const mm = /覆盖席 \{([^}]*)\}/.exec(String(run.stdout || ''));
  ok(!!mm, '退出前必须报示范注入的覆盖席（不报 = 又一根没计数的旋钮）');
  const seats = mm[1].split(',').map(function (kv) { const a = kv.split(':'); return { k: a[0].replace(/"/g, ''), v: Number(a[1]) }; });
  const tot = seats.reduce(function (p, s) { return p + s.v; }, 0);
  ok(tot > 20, '注入必须真的发生（实测 fired=' + tot + '）');
  ok(seats.length >= 3, 'n=3 · 40 代后示范必须覆盖到 3 个受评席（实测 ' + mm[1] + '）');
  const top = Math.max.apply(null, seats.map(function (s) { return s.v / tot; }));
  ok(top <= 0.8, '单个席位的占比不许超过 80%（修前实测 92% ⇒ 这条就是那次的反例）；实测 ' + (100 * top).toFixed(0) + '%');
});

t('D139 击杀奖励实验台（v1.5.193）：补丁必须真打上、破防场必须证明"奖励根本没发出去"、脚本池场必须证明"它能触发"', function () {
  /* 这条门钉的不是游戏行为，是**实验台本身**的两件事（本仓吃过亏的形状）：
   *   ① 引擎补丁如果没打上（锚点漂了/CRLF），三档跑的是同一个引擎 ⇒ 整份对照是假的 ⇒ 工具必须**抛错**而不是静默跑；
   *   ② "胜率没变"必须能被区分成"没效果"还是"根本没触发" ⇒ 所以要同时钉**发放计数为 0**（破防场）与**> 0**（脚本池场）。
   * 实测结论（§N49）：破防场里现役包三档读数**逐位相同**且 `奖励发放 = 0.00 次/局` ——
   *   因为那场里 5 个座位全死、却没有一次死亡是"被某个有来源的伤害打死的"（都是反弹/自损）⇒
   *   **任何"按击杀归因"的奖励都碰不到龟缩场**。这条就是那个结论的钉子。 */
  const run = spawnSync(process.execPath, ['tools/probe-kill-reward.mjs', '--games=40', '--fields=guardwall,pool', '--json'],
    { encoding: 'utf8', timeout: 900000 });
  eq(run.status, 0, '实验台要跑得通；若报"锚点找不到"就是 play.js 改了而补丁没跟着改（' + String(run.stderr || '').slice(0, 160) + '）');
  const out = String(run.stdout || '');
  const j = JSON.parse(out.slice(out.lastIndexOf('{"games"')));
  const wall = j.rows.filter(function (r) { return r.field === 'guardwall' && r.pack.indexOf('bundled-champion') === 0; })[0];
  ok(wall, '必须有"破防场 × 现役包"这一格（它就是防龟的靶心）');
  eq(wall.by[1].paid, 0, '破防场里**规则 1 的奖励发放必须是 0** —— 大于 0 就说明死亡归因变了，那条"没效果"的结论要重读');
  eq(wall.by[2].paid, 0, '破防场里规则 2 同样发放 0 次');
  eq(wall.by[1].first, wall.by[0].first, '破防场：规则 1 与现状的胜率必须**逐位相同**（没触发 ⇒ 不许有任何差别）');
  eq(wall.by[2].rounds, wall.by[0].rounds, '破防场：规则 2 的局长也必须逐位相同');
  ok(wall.by[0].draws === 1 && wall.by[0].first === 0, '破防场现役必须仍是 `0% 胜 / 100% 平`（这是 §N37/§N46 三次复现的那条形）');
  const poolRows = j.rows.filter(function (r) { return r.field === 'pool'; });
  const paidAny = poolRows.filter(function (r) { return r.by[1].paid > 0.3; });
  ok(paidAny.length >= 2, '脚本池场里奖励必须**能触发**（≥2 格发放 >0.3 次/局）—— 否则这两条规则是死代码，' +
    '上面那些"逐位相同"就只是"永远不发放"的同义反复；实测 ' + paidAny.length + ' 格');
  ok(/Δ胜率 vs 现状（同种子配对）/.test(out) && /噪声内 ±[\d.]+/.test(out),
    '必须印**配对**噪声（±1.96SE）—— 只印 Δ 百分点不印噪声，读表人就会把 ±5pt 的抖动当成结论（Q-9 同族病）');
});

t('D140 击杀奖励规则库（v1.5.194 · 单一来源）：合成局面逐个钉五条语义 —— 单点/按伤害/overkill/蓄能加价/无来源归因/转移记给', function () {
  /* 这份 lib 现在决定"冠军是在哪个世界里训出来的" ⇒ 语义必须逐条钉死，且**不许**只在真对局里顺带验到。
   * 全部用合成 state 喂 `makeKR().pre/post`（不依赖引擎跑局 ⇒ 每条都是确定性的）。 */
  const KR = KR_LIB;   // ESM 里没有 require ⇒ 用顶部静态导入
  const mkState = function (hps) {
    return { p: hps.map(function (h) { return { hp: h, ep: 0 }; }), events: [], round: 1 };
  };
  const dmg = function (to, amt, source, via, extra) {
    return Object.assign({ type: 'damage', to: to, amt: amt, source: source, via: via, reason: via }, extra || {});
  };
  /* ① 规则 1：集火时只回给"优先级最高"者（大雷 pri4 > 枪 pri2） */
  let st = mkState([3, 3, 3]);
  let kr = KR.makeKR(R, S, 1, {});
  kr.pre(st);
  st.p[1].hp = 0;   // 1 号席死
  st.events.push(dmg(1, 2, 0, R.SK.BIG_T), dmg(1, 1, 2, R.SK.GUN));
  kr.post(st);
  eq(st.p[0].ep, 1, '规则1：最高优先级（大雷 pri4）拿 1 ep');
  eq(st.p[2].ep, 0, '规则1：低优先级参与者（枪 pri2）一分不得');
  /* ② 同优先级 + 仍并列 ⇒ 都不回 */
  st = mkState([3, 3, 3, 3]); kr = KR.makeKR(R, S, 1, {}); kr.pre(st);
  st.p[1].hp = 0;
  st.events.push(dmg(1, 1, 0, R.SK.GUN), dmg(1, 1, 2, R.SK.GUN));
  kr.post(st);
  eq(st.p[0].ep + st.p[2].ep, 0, '规则1：同 pri 同 cost 的**不同角色**并列 ⇒ 都不回（用户明说）');
  /* ③ 蓄能算进开销 ⇒ 同优先级里需珠的那手占优（坦克 vs 电磁炮：pri 相同时电磁炮 cost+1 胜出） */
  const priTank = (R.byKey[R.SK.TANK] || {}).pri, priRail = (R.byKey[R.SK.RAILGUN] || {}).pri;
  /* 开销比较值：**动态费用必须问引擎**（聚能环/激光眼/过载炮 的 `cost` 是 null ⇒ 读卡表会把它们当 0） */
  {
    const costOf = KR.buildCostOf(R, S);
    eq(costOf(R.SK.GUN), 1, '枪 = 1');
    eq(costOf(R.SK.BIG_T), 5, '大雷 = 5');
    eq(costOf(R.SK.RAILGUN), 3, '电磁炮 = 费用 2 + 蓄能 1（用户点名要算进开销）');
    eq(costOf(R.SK.LASER_EYE), 2, '激光眼 = 首次 1 + 蓄能 1 = 2（与"续招 2ep"那条路径平价）');
    eq((R.byKey[R.SK.LASER_EYE] || {}).cost, null, '前置事实：激光眼在卡表里是**动态费用（null）** ⇒ 不问引擎就会算成 0');
    eq(costOf(R.SK.RING), 3, '聚能环（动态费用）必须问引擎拿到 3，而不是读卡表得 0');
    ok(costOf(R.SK.CANNON) >= 2, '过载炮（动态费用）≥2；实测 ' + costOf(R.SK.CANNON));
  }
  void priTank; void priRail;
  /* ④ 规则 2：按有效伤害付，overkill 不付（**起始血量必须与注释一致** —— 第一版写了"目标只有 2 血"
   *    却用 `mkState([3,3,3])` 造了 3 血 ⇒ 该发其实不是 overkill，是这条断言自己错了） */
  st = mkState([3, 2, 3]); kr = KR.makeKR(R, S, 2, {}); kr.pre(st);
  st.p[1].hp = 0;
  st.events.push(dmg(1, 1, 0, R.SK.GUN), dmg(1, 3, 2, R.SK.SNIPE));   // 目标开局 2 血：第二发 3 点里 2 点是 overkill
  kr.post(st);
  eq(st.p[0].ep, 1, '规则2：第一发全额付 1 ep');
  eq(st.p[2].ep, 1, '规则2：致命那发只付"把血打到 0"的部分（3 点里 2 点是 overkill ⇒ 只付 1）；实测 ' + st.p[2].ep);
  /* ⑤ 无来源的地雷 / 天火也要回 ep（走 mineFrom / fireFrom，**不动 source**） */
  st = mkState([3, 3, 3]); kr = KR.makeKR(R, S, 1, {}); kr.pre(st);
  st.p[1].hp = 0;
  st.events.push(dmg(1, 1, null, 'mine', { mineFrom: 2 }));
  kr.post(st);
  eq(st.p[2].ep, 1, '地雷炸死 ⇒ 回给埋雷者（`mineFrom`），而不是因为 `source:null` 就谁都不回');
  st = mkState([3, 3, 3]); kr = KR.makeKR(R, S, 2, {}); kr.pre(st);
  st.p[1].hp = 0;
  st.events.push(dmg(1, 2, null, 'firestorm', { fireFrom: 0 }));
  kr.post(st);
  eq(st.p[0].ep, 2, '天火引爆致死 ⇒ 按伤害回给引爆者（`fireFrom`）');
  /* ⑥ 转移伤害：功劳记给**转移者**（默认），可切成原攻击者 */
  st = mkState([3, 3, 3, 3]); kr = KR.makeKR(R, S, 1, {}); kr.pre(st);
  st.p[3].hp = 0;
  st.events.push(dmg(3, 2, 0, R.SK.SNIPE, { transferBy: 1 }));   // 0 打出的伤害被 1 转移给 3
  kr.post(st);
  eq(st.p[1].ep, 1, '转移伤害致死 ⇒ 默认记给转移者（1 号席）');
  eq(st.p[0].ep, 0, '默认口径下原攻击者（0 号席）不拿');
  st = mkState([3, 3, 3, 3]); kr = KR.makeKR(R, S, 1, { transfer: 'source' }); kr.pre(st);
  st.p[3].hp = 0;
  st.events.push(dmg(3, 2, 0, R.SK.SNIPE, { transferBy: 1 }));
  kr.post(st);
  eq(st.p[0].ep, 1, '`--kr-transfer=source` 时改记给原攻击者（两种读法都留了开关）');
  /* ⑦ 真正无主的死亡（铁索传导 / 禁用扣血 / 终局收缩）⇒ 一律不回，也不许崩 */
  st = mkState([3, 3, 3]); kr = KR.makeKR(R, S, 2, {}); kr.pre(st);
  st.p[2].hp = 0;
  st.events.push(dmg(2, 1, null, 'chain'), dmg(2, 1, null, 'ban'), dmg(2, 2, null, '终局收缩'));
  kr.post(st);
  eq(st.p[0].ep + st.p[1].ep, 0, '无归因的死亡 ⇒ 谁都不回（且不许 NaN/抛错）');
  /* ⑧ 引擎补丁：锚点漂了必须抛错（静默没打上 = 三档跑同一个引擎 = 假实验） */
  {
    let threw = 0;
    try { KR.patchResolve('这是一段被改过的、没有锚点的 resolve.js'); } catch (e) { threw = 1; }
    eq(threw, 1, '锚点找不到必须**抛错**，不许静默返回原文');
    const patched = KR.patchResolve(readFileSync('js/core/resolve.js', 'utf8'));
    ok(patched.indexOf('mineFrom:') >= 0 && patched.indexOf('fireFrom:') >= 0 && patched.indexOf('transferBy:') >= 0,
      'resolve.js 补丁必须真的把三个归因字段接进事件（缺一个就有某类死亡回不了 ep）');
    ok(patched.indexOf("source: (opts.source != null ? opts.source : null)") >= 0,
      '**不许动 `source`**（R57：地雷/天火是无来源伤害，且 `source==null` 还是大雷连带与"终局收缩"哨兵的输入）');
  }
  /* ⑨ 补丁行为中性：打了补丁但不挂规则钩子 ⇒ 与未打补丁**逐位相同** */
  {
    const boot = function (patched) {
      const box = {
        console: { log: function () { }, warn: function () { }, error: function () { } },
        Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Float64Array, Date
      };
      box.window = box; box.globalThis = box;
      for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
        'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
        let t = readFileSync(f, 'utf8');
        if (patched && f === 'js/core/resolve.js') t = KR.patchResolve(t);
        if (patched && f === 'js/core/play.js') t = KR.patchPlay(t);
        vm.runInNewContext(t, box, { filename: f });
      }
      return box;
    };
    const play = function (box) {
      const T = box.window.EpirusTrainer, B = box.window.EpirusBots, sig = [];
      for (let g = 0; g < 14; g++) {
        const ch = [];
        for (let pid = 0; pid < 5; pid++) ch.push(function (s2, p2, lg) { return B.pickMix(s2, p2, lg); });
        const r = T.oneGameN(ch, 4242 + g * 7919, 5, { mode: 'multi' });
        sig.push(r.state.winner + '|' + r.state.round + '|' + r.state.p.map(function (q) { return q.hp; }).join(','));
      }
      return sig.join(' ');
    };
    const a = play(boot(false)), b = play(boot(true));
    eq(a, b, 'mode 0（打了补丁、钩子不发）必须与未打补丁**逐位相同** —— 否则所有 Δ 都不是纯规则差');
  }
});

t('D115 序列窗锁：链上状态（持珠/上手蓄能/有我方符咒）⇒ soft 探索整回合作废（v1.5.149-night · 夜测 §N4 悬崖）', function () {
  ok(typeof T.seqLockedTurn === 'function', '判据必须导出（门喂构造态，不钉文本）');
  const mk = function (f) { const s = S.createState('long', { next: mulberry32(9) }, 3); f(s.p[0]); return s; };
  /* ① 判据：三正（珠/上手蓄能/我方符咒）+ 三负（空态/他人符咒/只有 ep 富余） */
  ok(T.seqLockedTurn(mk(p => { p.elec = 1; }), 0), '持电珠 ⇒ 锁（终点炮在手，这一回合不赌）');
  ok(T.seqLockedTurn(mk(p => { p.lastSkill = 'charge'; }), 0), '上一手蓄能 ⇒ 锁（链不许中途撒手）');
  (function () { const s = mk(() => {}); s.p[2].stickers.push({ owner: 0, age: 1 });
    ok(T.seqLockedTurn(s, 0), '自己贴的存活符咒 ⇒ 锁（引爆/续贴线）'); })();
  ok(!T.seqLockedTurn(mk(p => { p.ep = 9; }), 0), 'ep 富余但不在链上 ⇒ 不锁（噪声留给非序列手）');
  (function () { const s = mk(() => {}); s.p[2].stickers.push({ owner: 1, age: 1 });
    ok(!T.seqLockedTurn(s, 0), '别人贴的符咒不算（owner 必须是自己）'); })();
  ok(!T.seqLockedTurn(mk(() => {}), 0), '空态不锁');
  /* ② 端到端：真·链上态 ε=1 soft 的 40 抽样必须与 ε=0（同 rng）逐手相等 ⇒ 锁=探索整回合作废 */
  const W3b = Pol.unpack(sb.window.EPIRUS_CHAMPION_3P);
  Pol.setRng(mulberry32(115115));
  const lockedStates = [];
  const seen = { n: 0 };
  for (let g = 0; g < 30 && lockedStates.length < 4; g++) {
    const st = S.createState('long', { next: mulberry32(330000 + g) }, 5);
    const ch = (state, pid, legal) => {
      const aff = legal.filter(l => l.affordable); const b = aff.length ? aff : [{ key: 'ji', affordable: true }];
      const p = T.pickChampion(state, pid, b, W3b, 0.15);
      if (lockedStates.length < 4 && T.seqLockedTurn(state, pid)) {
        seen.n++;
        lockedStates.push({ snap: JSON.parse(JSON.stringify({ p: state.p, round: state.round })), pid });
      }
      return p;
    };
    Play.autoGameN(st, [ch, ch, ch, ch, ch]);
  }
  ok(lockedStates.length >= 2, '长程自对局里必须存在链上决策态（找不到 ⇒ 珠线又断了，先查 §18-21）· 实测 ' + lockedStates.length);
  for (const rec of lockedStates) {
    let same = 0;
    for (let d = 0; d < 40; d++) {
      const mkSt = function (eps) {
        const st2 = S.createState('long', { next: mulberry32(77000 + d) }, 5);
        const sp = JSON.parse(JSON.stringify(rec.snap));
        for (let i = 0; i < 5; i++) Object.assign(st2.p[i], sp.p[i]);
        st2.round = sp.round;
        const legal = Play.legalActions(st2, rec.pid).filter(l => l.affordable);
        if (!legal.length) return null;
        return T.pickChampion(st2, rec.pid, legal, W3b, 0.15, eps ? 1 : 0, 5, eps ? 'soft' : undefined);
      };
      const a = mkSt(false), b = mkSt(true);
      if (a && b && a.key === b.key) same++;
    }
    ok(same === 40, '链上态 ε=1 soft 必须与 ε=0 逐手相等（实测 ' + same + '/40 ⇒ 锁漏或 rng 假象）');
  }
  /* ③ 反证：锁只在 soft —— 同一批态 ε=1 无 epsMode（uniform 原口径）必须出现改判（否则 ② 是假绿） */
  (function () {
    if (!lockedStates.length) return;
    const rec = lockedStates[0];
    let diff = 0;
    for (let d = 0; d < 40; d++) {
      const st2 = S.createState('long', { next: mulberry32(77000 + d) }, 5);
      const sp = JSON.parse(JSON.stringify(rec.snap));
      for (let i = 0; i < 5; i++) Object.assign(st2.p[i], sp.p[i]);
      st2.round = sp.round;
      const legal = Play.legalActions(st2, rec.pid).filter(l => l.affordable);
      const g0 = T.pickChampion(st2, rec.pid, legal, W3b, 0.15, 0);
      const st3 = S.createState('long', { next: mulberry32(77000 + d) }, 5);
      for (let i = 0; i < 5; i++) Object.assign(st3.p[i], JSON.parse(JSON.stringify(rec.snap)).p[i]);
      st3.round = sp.round;
      const legal3 = Play.legalActions(st3, rec.pid).filter(l => l.affordable);
      const gu = T.pickChampion(st3, rec.pid, legal3, W3b, 0.15, 1, 5);
      if (gu.key !== g0.key) diff++;
    }
    ok(diff > 0, '无 epsMode 的 ε=1 必须会打断链上回合（实测改判 ' + diff + '/40 —— 为 0 说明量具没判别力）');
  })();
});

t('D162 训练/选择执行口径旋钮（v1.5.237 · E28）：默认关要**可逆**、开了要**真打到适应度**、没接的入口要**响亮**', function () {
  /* 建台过程中先纠正了写门的人自己的一条前提（记在 `evo.js` 那段注释与夜日志 §E28b）：
   *   出厂的**每代评分**并不在 ε=0 —— 被评席走"temp 0.35 · ε=0.15 · 不带 epsMode"（硬档）；
   *   ε=0 的是自评/健康门槛那一路。所以这个旋钮改的是"选择压力用哪种噪声"，而"默认关 = 逐字不变"必须能证。
   * 判的四件事（全部真调用，不钉措辞）：
   *   ① `eps=0` 不许被 `|| 默认` 吞（同 v1.5.174 `drainHpMax` 那一族）；非法值必须抛；
   *   ② 开档必须**改变** `mirrorHealth`（= 打进了它的内部闭包调用，不是只包了属性层）与 `scoreMemberN` 的 fit（= 真的在适应度通路上）；
   *   ③ 关档之后两个读数必须**回到原值**（不许留隐性状态）；
   *   ④ `train-3p` 真读它（不算暗键），而 `train-best` 没读 ⇒ 必须被列为暗键（宁可 exit 6，不许静默 A/A，D143 那族的规矩）。 */
  const params = Pol.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
  ok(!!params, '载体：现役 3P 权重要能 unpack（本门全部读数都挂在它身上）');
  eq(typeof T.setTrainEps, 'function', '引擎必须导出 setTrainEps（CLI 侧"没有 setter 就 exit 7"靠它）');
  eq(typeof T.countTrainEps, 'function', '必须导出**开火计数**（横幅读回证明不了作用点发生 · D123 的原话）');
  eq(T.countTrainEps().eps, 0, '出厂默认必须是 eps=0');
  const mhOff = T.mirrorHealth(params, 8, 5, 'multi');
  const fitOff = T.scoreMemberN(params, T.buildOpps(params, 0.05), 4, 5, 0, 0, 0);
  try {
    const back = T.setTrainEps(0.2, 5, 'soft', 0.15);
    eq(back.eps, 0.2, 'setter 必须读回生效值（引擎是唯一口径）');
    eq(back.mode, 'soft', 'mode 必须能下达（出厂每代评分是**硬档** ⇒ "挪到产品口径"这件事一半在 mode 上）');
    eq(T.setTrainEps(0).eps, 0, '`eps=0` 必须真的是 0（`|| 默认` 会把"零档对照"变成 0.2 档）');
    let threw = false;
    try { T.setTrainEps(3); } catch (e) { threw = true; }
    ok(threw, 'eps 越界（>1）必须抛，不许静默夹紧');
    T.setTrainEps(0.2, 5, 'soft', 0.15);
    const mhOn = T.mirrorHealth(params, 8, 5, 'multi');
    ok(Math.abs(mhOn.rounds - mhOff.rounds) > 1e-9 || Math.abs(mhOn.dmgPerGame - mhOff.dmgPerGame) > 1e-9,
      '【作用点 1】开档必须改变 `mirrorHealth` 的读数（不变 ⇒ 漏斗没打进它的内部闭包调用，那正是 E23 第一版读到的假"三档相同"）');
    const fitOn = T.scoreMemberN(params, T.buildOpps(params, 0.05), 4, 5, 0, 0, 0);
    ok(Math.abs((fitOn.fit || 0) - (fitOff.fit || 0)) > 1e-9,
      '【作用点 2】开档必须改变**每代评分的 fit**（同 gen/idx ⇒ 同种子，唯一变量就是口径；不变 ⇒ 选择压力没接到这个旋钮，整臂会跑成 A/A）');
    const c1 = T.countTrainEps();
    ok(c1.fitSeen > 0 && c1.seen > 0, '两条漏斗都必须留下**决策计数**（fit=' + c1.fitSeen + ' · 自评=' + c1.seen + '）');
  } finally {
    T.setTrainEps(0);                 // 门内不许把口径留在开档状态去跑后面的门
  }
  const mhBack = T.mirrorHealth(params, 8, 5, 'multi');
  const fitBack = T.scoreMemberN(params, T.buildOpps(params, 0.05), 4, 5, 0, 0, 0);
  ok(Math.abs(mhBack.rounds - mhOff.rounds) < 1e-12 && Math.abs(mhBack.dmgPerGame - mhOff.dmgPerGame) < 1e-12,
    '关档后 `mirrorHealth` 必须**逐字回到**开档前（差一丝 = 有隐性状态，那"出厂读数不变"这句话就是假的）');
  ok(Math.abs((fitBack.fit || 0) - (fitOff.fit || 0)) < 1e-12, '关档后 fit 同样必须逐字回到原值');
  eq(detectDarkKnobs({ EPIRUS_TRAIN_EPS: '0.2' }, { entry: 'tools/train-3p.mjs' }).dark.indexOf('EPIRUS_TRAIN_EPS'), -1,
    'train-3p 必须被认成"真读这个键"（否则整臂一开就 exit 6 跑不起来）');
  ok(detectDarkKnobs({ EPIRUS_TRAIN_EPS: '0.2' }, { entry: 'tools/train-best.mjs' }).dark.indexOf('EPIRUS_TRAIN_EPS') >= 0,
    'train-best 没接这个旋钮 ⇒ 必须被列为**暗键**并在握手前 exit 6（宁可响，不许"传了没人读"跑成一整臂 A/A —— D143 那一族栽过 9 次）');
  ok(readFileSync('tools/audit-lib.mjs', 'utf8').indexOf('EPIRUS_TRAIN_EPS') < 0,
    '作用范围必须**关在训练侧**：`audit-lib` 的 9 处写死不许经过这两个漏斗（否则门禁口径会被一个训练旋钮悄悄搬走）');
  /* ===== 并发臂的前提：产物必须能改道（用户 09-26 指令"别单核慢慢跑"）=====
   * 所有臂默认都写同一个 `docs/artifacts/train-3p-out.js` ⇒ 并发时互相覆盖，只能串行；而门禁里有两道门
   * 拿这个文件的哈希当 CLI 基线 ⇒ 并发臂还会把基线文件改脏。`EPIRUS_T3P_OUT`（与 `train-best` 的 `EPIRUS_TB_OUT` 同形）解决这两件事。 */
  {
    const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
    ok(/EPIRUS_T3P_OUT/.test(t3) && /EPIRUS_PUBLISH === '1'[\s\S]{0,220}EPIRUS_T3P_OUT/.test(t3),
      'train-3p 必须支持产物改道（`EPIRUS_T3P_OUT`），且**顺序必须在 `EPIRUS_PUBLISH` 之后**（否则一个 env 就能把臂写进线下槽）');
    const def = 'docs/artifacts/train-3p-out.js';
    const before = createHash('sha1').update(readFileSync(def)).digest('hex');
    const dir = mkdtempSync(join(tmpdir(), 't3pout-'));
    const rr = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '5', '4', '4'], {
      encoding: 'utf8', timeout: 300000,
      env: Object.assign({}, process.env, { EPIRUS_ARM: 'nptest-rr', EPIRUS_SEED: '999', EPIRUS_BAND_DIR: join(dir, 'bands'), EPIRUS_T3P_OUT: join(dir, 'RR.js') })
    });
    eq(rr.status, 0, '改道跑一支迷你臂必须成功（status=' + rr.status + ' ' + String(rr.stderr || '').slice(0, 90) + '）');
    ok(existsSync(join(dir, 'RR.js')), '产物必须写到 `EPIRUS_T3P_OUT` 指的地方');
    const after = createHash('sha1').update(readFileSync(def)).digest('hex');
    eq(after, before, '默认 CLI 产物**一个字节都不许动**（并发臂不得污染门禁比对的基线文件）');
    ok(String(rr.stdout).indexOf('已写入 ' + def) < 0, '日志里不许出现"已写入默认路径"（改道要改彻底，含打印）');
    /* 我自己 15:12 踩过的那一下：`train-3p --help` 曾被读成 `GENS=NaN` ⇒ 真开跑一支臂，
     * 默认落点就是上面那个被门禁比哈希的基线文件 ⇒ 一次打错的帮助页能污染正在跑的门禁。
     * **行为式**判定（真跑一遍看退出码），不判横幅。 */
    const hf = spawnSync(process.execPath, ['tools/train-3p.mjs', '--help'], { encoding: 'utf8', timeout: 60000 });
    eq(hf.status, 64, '`train-3p --help` 必须 exit 64（只吃位置参数的入口收到 `--` 一律响亮拒绝），实际 status=' + hf.status + ' 输出=' + String(hf.stdout || '').slice(0, 80));
    /* v1.7.70 · gate-sentinel ③ 分诊：原来这里钉的是 stderr 里那句**中文措辞**（`indexOf('不认识的参数') >= 0`）——
   *   属 METHODOLOGY 第 89 条禁的「钉措辞」。退出码 64 上面那行已经判了；这条要保的语义只是**不许沉默失败**
   *   （仓规：响亮失败）。⇒ 改成判「stderr 非空」，措辞交给工具自己定。 */
  ok(String(hf.stderr || '').trim().length > 0, '拒绝时必须**出声**（不许只给退出码、什么都不说）；具体措辞不判');
    eq(createHash('sha1').update(readFileSync(def)).digest('hex'), before, '那次 `--help` 尝试之后基线文件仍须逐字节不变（不许它已经把臂跑出来）');
    rmSync(dir, { recursive: true, force: true });
  }
});

t('D172 贵卡预算权重 costlyW：默认 0 · 线性形状 · **三处名单齐全**（缺一处就被入口黑键闸拦）· 读回可验（v1.5.260）', function () {
  /* 动因（本班 §20.1/§20.2 + §21 的坑）：大雷/贵卡是"抽到就得留住"的瞬态（21 粒只 1 粒学会、续训三臂全掉回 ~0），
   * 根因候选=适应度里没有读数量它；而现役那条 `bigcardW` 的形状 `min(1, uses/1)` **1 次即吃满** ⇒ 对已出 3~8 次的粒没有梯度。
   * ⇒ 新增 `costlyW`（**线性计数** `costlyW × bigUses`，默认 0 ⇒ 行为逐字不变）。
   * 【本门第二段是这次踩的坑】我第一次只改了 econ-env 的两处名单 ⇒ `train-3p` 仍把 `EPIRUS_COSTLY_W` 当**黑键**拦下
   *   （"传了等于没传"）⇒ 必须在**三个地方**都登记：① `ECON_ENV_KEYS`（env 名）② `ECON_REWARD_KEYS`（驼峰）③ `train-3p` 的 `CLI_ECON_REWARD_KEYS`。 */
  const EVO = readFileSync('js/train/evo.js', 'utf8');
  ok(/let COSTLY_W = 0;/.test(EVO), '`costlyW` 必须默认 0（默认关 ⇒ 行为逐字不变）');
  ok(/const costlyBonus = COSTLY_W > 0 \? \(COSTLY_W \* bigUses\) : 0;/.test(EVO),
    '形状必须是**线性计数** `costlyW × bigUses`（不许复用 bigcardW 那条 1 次即吃满的饱和形状）');
  /* v1.6.50 改判（用户裁定 B 那笔带出来的）：原来这条锚的是**整段字面求和式**
   *   `/\+\s*widthBonus \+ bigBonus \+ costlyBonus \+ chainBonus\)\)/`
   *   ⇒ 任何人**合法地**在末尾再加一项（本次是 `gBonus`）它就红，而它声称要判的是"接线不许只到声明"。
   *   这正是本仓反复写的"定死标签/不看效果"那族（§E430 按用户裁定删过两条同族的门）⇒ 改成锚"作为项被加进 gFit"这件事。 */
  ok(/\+\s*costlyBonus\b/.test(EVO) && /const costlyBonus = COSTLY_W > 0 \? \(COSTLY_W \* bigUses\) : 0;/.test(EVO),
    'costlyBonus 必须真的进 fit 求和（接线不许只到声明）');
  ok(/if \(o\.costlyW != null\) COSTLY_W = Math\.max\(0, Number\(o\.costlyW\)\);/.test(EVO), 'setEconomyReward 必须收口这个键');
  ok(/costlyW: COSTLY_W,/.test(EVO), '生效值回执里必须有它（否则读不回 = 不知道有没有生效）');
  const E = readFileSync('server/econ-env.mjs', 'utf8');
  ok(/'EPIRUS_COSTLY_W'/.test(E), '① `ECON_ENV_KEYS`（env 名表）必须有 EPIRUS_COSTLY_W');
  ok(/costlyW: nv\(e\.EPIRUS_COSTLY_W\)/.test(E), '② 解析里必须真的读它');
  const T3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/CLI_ECON_REWARD_KEYS = \[[^\]]*'costlyW'/.test(T3),
    '③ `train-3p` 的 CLI 名单必须有它 —— **缺这一处就被黑键闸拦**（本次实测：缺它时 exit 非 0、报"本入口读不到的旋钮"）');
  /* v1.5.281 删掉了一条 `/'costlyW'\];|'costlyW',/` 的"写法检查"：它名义上"防止只加在注释里"，
   * 但实测**注释里出现的 `'costlyW',` 也算命中** ⇒ 它声称的事它没在判；而真正的保证就是上一行那条锚定式。
   * ⚠ 别再把它加回来当"双保险" —— 那种第二遍抄写正是本仓反复出事的形状。 */
  /* ④ 读回可验：下达 ⇒ 消费点读回同值（仓里所有旋钮的标准姿势） */
  /* ④ 读回可验（下达 ⇒ 消费点读回同值）本门不 spawn：已在提交前手工验证过
   *   `setEconomyReward({costlyW:0.05})` ⇒ `economyReward().costlyW === 0.05`（下达前 0）；
   *   这里只钉静态三处 + 形状，行为由探针/训练臂体现，免得门为了一个数去起沙箱。 */
});

t('D173 贵卡预算的**剂量表**（开火计数）：非零才计数、随回执一起给出、且不许改任何判定（v1.5.261 · §22.1 的教训）', function () {
  /* 动因（本班 §22.1）：`costlyW` 0/0.05/0.2 三档跑出**逐字节相同**的当选者与 **相同 bestFit**
   *   ⇒ 不是"压力不够大"，而是**剂量恒 0**（`bigUses` 在每代每席 3 局的训练场里几乎总是 0）。
   * 本仓既有规矩（`EPIRUS_TRAIN_EPS` 的开火计数）：**先装计数、再谈剂量**。本门钉三件事：
   *   ① 只在 `costlyBonus > 0` 时 +1（否则计数本身没意义）② 随 `economyReward()` 一起回执（读得到）
   *   ③ **只计数、不改判定**（不许碰 fit/排序/参数）。 */
  const EVO = readFileSync('js/train/evo.js', 'utf8');
  ok(/let COSTLY_HITS = 0;/.test(EVO), '剂量计数必须显式声明（第一版瞬态快照就是栽在"裸用未声明标识符"上）');
  ok(/if \(costlyBonus > 0\) COSTLY_HITS\+\+;/.test(EVO), '只在 costlyBonus **非零**时 +1（剂量表的意义就在"有没有非零过"）');
  ok(/costlyHits: COSTLY_HITS,/.test(EVO), '必须随 `economyReward()` 回执给出（读不到 = 没法用）');
  /* v1.5.281 删掉 `COSTLY_HITS\+\+[\s\S]{0,80}(?!fit)` 这条"形状检查"。变异实测：
   * 它声称要防的写法 `COSTLY_HITS++; fit += 1;` **照样通过**（贪婪 `[\s\S]{0,80}` 配尾部 lookahead 几乎总能满足）⇒ 名不副实。
   * 它想防的事其实由上一行**整句锚定** `if (costlyBonus > 0) COSTLY_HITS++;` 覆盖 —— 那条一改成夹带 fit 就红。判据没有少。 */
  const seg = (function () { const i = EVO.indexOf('COSTLY_HITS++'); return EVO.slice(Math.max(0, i - 200), i + 200); })();
  ok(seg.indexOf('gFit') < 0 && seg.indexOf('.fit =') < 0, '【只计数】计数处附近不许改 fit/判定（与 D171 同规矩）');
});

t('D179 整族行为剂量（v1.5.272 · §E83）：计数按族算 + 收益按各自 W 付 + 未量必须 null + 打印有门', function () {
  const ev = readFileSync('js/train/evo.js', 'utf8'), T3 = readFileSync('tools/train-3p.mjs', 'utf8');
  const CNT = [['ringBreaks', 'countRingBreaks'], ['pressRounds', 'countPressRounds'], ['pierceHits', 'countPierceHits'],
    ['beadSpent', 'countBeadSpent'], ['threatHits', 'countThreatHits'], ['clears', 'countClears'],
    ['blocks', 'countBlocks'], ['varietyMax', 'countVariety']];
  for (const c of CNT) {
    ok(new RegExp('if \\(DOSE_ON\\) ' + c[0] + ' [+=]').test(ev), '① ' + c[0] + ' 的累加必须走 DOSE_ON');
    ok(!new RegExp('if \\([A-Z_]+_W > 0\\) ' + c[0] + ' [+=]').test(ev) &&
      !new RegExp('if \\(ringWeightAt\\(gen\\) > 0\\) ' + c[0]).test(ev),
      '① ' + c[0] + ' 不许再跟着自己那根的 W（假零结果的形状）');
  }
  ok(/const DOSE_ON = PRESS_W > 0 \|\| PIERCE_W > 0/.test(ev), '① DOSE_ON 必须**存在**且按族取或');
  const BON = [['pressBonus', 'PRESS_W', 'pressRounds'], ['pierceBonus', 'PIERCE_W', 'pierceHits'],
    ['beadBonus', 'BEAD_W', 'beadSpent'], ['tgtBonus', 'TGT_W', 'threatHits'], ['clearBonus', 'CLEAR_W', 'clears'],
    ['blockBonus', 'BLOCK_W', 'blocks'], ['ringBonus', 'ringWeightAt\\(gen\\)', 'ringBreaks']];
  for (const b of BON) {
    ok(new RegExp('const ' + b[0] + ' = ' + b[1] + ' \\*').test(ev), '② ' + b[0] + ' 必须仍按自己的 W 付钱（fit 逐位不变的保证）');
  }
  ok(/WIDTH_W \* Math\.min\(1, Math\.max\(0, varietyMax/.test(ev), '② widthBonus 同理');
  const er0 = T.economyReward(), w0 = { press: T.pressReward().w, pierce: T.pierceReward().w, tgt: T.targetReward().w, clear: T.clearReward().w };
  /* 本门跑在整套门禁的最后段，前面的用例可能动过这些权重 ⇒ **不假设出厂值**：
   * 先读回当前值当"要复位的原值"，再显式保证族里至少有一根非零（`Math.max(0.01, 原值)`，不新造默认值），
   * 这样 ③ 判的是"剂量表跟着 `DOSE_ON` 出现"这件事本身，而不是"前面的门有没有复位干净"。 */
  T.setPressReward(Math.max(0.01, w0.press));
  const params = Pol.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
  const opps = [{ name: 'balanced', sel: Bots.pickBalanced }, { name: 'defend', sel: Bots.pickDefend }];
  const KEYS = ['ringBreakEv', 'pressEv', 'pierceEv', 'beadEv', 'threatEv', 'clearEv', 'blockEv', 'varietyMaxEv'];
  const dOn = T.scoreMemberN(params, opps, 4, 3, 0, 0, 0);
  eq(dOn.doseOn, true, '③ 族里有一根被下达 ⇒ `doseOn` 必须为 true');
  for (const k of KEYS) {
    ok(typeof dOn[k] === 'number', '③ 族里有一根被下达时，' + k + ' 必须是数字（没下达的兄弟是对照组，不许缺席）');
  }
  ok(dOn.varietyMaxEv > 0, '③ **WIDTH_W=0 的兄弟也必须真的在数** —— 旧形状下 varietyMax 恒 0，这一条就是"修法生效"的证据');
  T.setPierceReward(0); T.setPressReward(0); T.setTargetReward(0); T.setClearReward(0);
  T.setEconomyReward({ ringW: 0, beadW: 0, blockW: 0, widthW: 0, bigcardW: 0, costlyW: 0, bigtChainW: 0 });
  const dOff = T.scoreMemberN(params, opps, 4, 3, 0, 0, 0);
  eq(dOff.doseOn, false, '④ 整族全 0 ⇒ 不必否证任何杠杆 ⇒ 不算');
  for (const k of KEYS) {
    eq(dOff[k], null, '④ 全 0 时 ' + k + ' 必须是 null（"未量"印成 0 会被读成"这粒真没做出该行为"）');
  }
  T.setPressReward(w0.press); T.setPierceReward(w0.pierce); T.setTargetReward(w0.tgt); T.setClearReward(w0.clear);
  T.setEconomyReward({ ringW: er0.ringW, beadW: er0.beadW, blockW: er0.blockW, widthW: er0.widthW,
    bigcardW: er0.bigcardW, costlyW: er0.costlyW, bigtChainW: er0.bigtChainW });
  const back = { pierce: T.pierceReward().w, press: T.pressReward().w, tgt: T.targetReward().w, clear: T.clearReward().w, er: T.economyReward() };
  /* ⚠ 复位检查走各自的 getter，**不走 `economyReward()` 的快照**：那四根里有些键根本不在快照里，
   * `eq(undefined, undefined)` 会当"通过"印出来（本仓最怕的形状之一就是恒真断言）。 */
  eq(back.pierce, w0.pierce, '⑤ 复位必须真的恢复出厂 pierceW（本门自己不许污染后续用例）');
  eq(back.press, w0.press, '⑤ 同上（pressW）');
  eq(back.tgt, w0.tgt, '⑤ 同上（tgtW）');
  eq(back.clear, w0.clear, '⑤ 同上（clearW）');
  eq(back.er.beadW, er0.beadW, '⑤ 同上（beadW，走 econ 快照）');
  eq(back.er.ringW, er0.ringW, '⑤ 同上（ringW）');
  ok(/r\.doseOn \? ' 剂量\[\/局\]/.test(T3), '⑤ `train-3p` 的逐代行必须只在 doseOn 时印剂量表');
});


/* ===== D181（qoder 09-28 §E91）：`train-3p` 必须能命令 `EPIRUS_RING_W`，且"投不到"这件事必须自己会说话 =====
 * 动因：§E91 那批"把 `ringW` 整根关掉"的臂**一秒就死**在黑键闸上 ⇒ 查出一个事实：
 * 引擎认 `ringW`、env 名单也登记了 `EPIRUS_RING_W`，但**本入口的投递名单 `CLI_ECON_REWARD_KEYS` 没有它**
 * ⇒ 这个入口从来没能命令环权重（D172 立的"三处名单齐全"里缺第三处）。
 * 钉两条：① 补上之后必须**真投递**（回执一致 + 消费点读回 0）；② 顺手把"仍有 8 根投不到"这件事**印出来**
 * （不是假装全通，而是让下一班看得见边界：`widthW/blockW/s4W/wallFilter/divK/hoardCapMult/convOffense/wallGames`）。 */
t('D182 死项筛子（v1.5.275 · §E102）：预热可复现 + 恒真必须标 + 阳性对照方向 + 拒绝兜底', function () {
  const run = (args) => spawnSync(process.execPath, ['tools/probe-dead-term.mjs'].concat(args),
    { encoding: 'utf8', timeout: 420000 });
  const z = run(['--key=tgtW', '--games=4', '--rounds=6']);
  eq(z.status, 0, '① 出厂 0 的根也必须能跑完（它给的是"恒真"警告，不是失败）：' + String(z.stderr || '').slice(0, 140));
  ok(/出厂就是 0/.test(String(z.stdout)), '① 必须明写"出厂就是 0 ⇒ 恒真"，否则下游会把 0→0 读成"这项没用"');
  ok(/变的行 0\/9/.test(String(z.stdout)), '① 权重为 0 时"变的行"必须是 0/9 —— 非零就说明**没预热**，把 `pickMix` 的模块级记忆读成了效应');
  const r = run(['--key=ringW', '--games=6', '--rounds=10']);
  eq(r.status, 0, '② `ringW` 必须跑完：' + String(r.stderr || '').slice(0, 140));
  ok(/变的行 0\/9/.test(String(r.stdout)), '② 单位级：九个池内对手上关掉 `ringW` 后 fit 必须全不变（"稀有"那一半）');
  ok(/阳性对照/.test(String(r.stdout)) && /fit 变 Δ=0\.\d+/.test(String(r.stdout)), '② 阳性对照：必须给出"变"的读数（"但活着"那一半）');
  ok(/稀有但活着/.test(String(r.stdout)), '② 两层合起来的判读必须是"稀有但活着"，不许让工具自己写成"死项"');
  ok(/响一次的频率/.test(String(r.stdout)), '② 前置条件必须给"多久响一次"的量级（或明说"这些局里一次都没出现"），不能只印一个 0');
  ok(/不支持.*可以摘/.test(String(r.stdout)), '④ 末尾必须带"不支持可以摘"的限定');
  const p = run(['--key=pressW', '--games=4', '--rounds=5']);
  eq(p.status, 0, '⑤ `pressW` 也必须跑得起来：' + String(p.stderr || '').slice(0, 120));
  ok(!/变的行 0\/9/.test(String(p.stdout)) && !/稀有但活着/.test(String(p.stdout)),
    '⑤ 出厂每代都有剂量的那根（`pressW`，§E89 实测 0/61 代零剂量）**不许被判成"稀有/死项"** —— ' +
    '它若变 0/9，说明这把尺自己坏了（接线、预热或复位出了问题），而不是这根死了');
  const bad = run(['--key=divW', '--games=4']);
  ok(bad.status === 7, '③ 没钉 setter/getter 的根必须响亮失败（实得 ' + bad.status + '）—— 不许"探测不到就跳过"');
  ok(/不许加.*探测不到就跳过/.test(String(bad.stderr) + String(bad.stdout)), '③ 且要说明为什么拒（这条规矩本身就是本仓的形状库）');
  const fl = run(['--key=ringW', '--bogus=1']);
  eq(fl.status, 64, '③ 不认识的 `--` 参数必须 exit 64（写错开关名不许当默认值跑）');
});


/* ===== D183（qoder 09-28 §E115）：权重逐位对账必须有常驻工具，且**不许是个恒真比较器** =====
 * 今晚一半的"证明"（行为中性 / 两臂同配置可复现 / λ 饱和 0.08≡0.15 / veto 容差 100% 不改人）
 * 都靠"逐位比两粒产物的权重"，而我一直用临时脚本 ⇒ 下一班要么重写、要么拿**整文件哈希**代替（头注与 META 每次都变 ⇒ 会误报）。
 * 钉四条：① 比的是权重数组（不许退成文件字节）；② 仓库里**自带一对已知相同**与**一对已知不同**的用例 ⇒ 判别力自证；
 * ③ 读不出包必须点名 + `exit 7`；④ `--self-test` 在"全部逐位相同"时必须判失败（防恒真）。 */
t('D164 池子前沿量具（v1.5.249）：三判据在线上方向正确、"三合一"必须真是三样求交、没量到不许当通过、参数守卫与 stage 语义判在输出上', function () {
  const M = o => Object.assign({ gMulti: 4, gLong: 4, landMulti: 3, landLong: 3, gained: 200, spentRate: 0.8 }, o);
  ok(PF_FRONT.isWide(M({}), 2.66) === true, '两模式都过线 ⇒ 判宽');
  ok(PF_FRONT.isWide(M({ gLong: 2.99 }), 2.66) === false, 'long 的 G 差 0.01 ⇒ 不许判宽（只看 multi 是本仓踩过的形状）');
  ok(PF_FRONT.isWide(M({ landLong: 2.65 }), 2.66) === false, '净兑现只有一模式过 ⇒ 不许判宽');
  /* ===== v1.5.254（用户 GO）：**"宽"的净兑现判据必须同 n 并排**，绝对线是被实测否掉的形状 =====
   * 病：绝对线自带样本量依赖 —— 现役**自己**在 80 局下 `净兑现 2.63 < 线 2.66`（线抄自另一次 n 的实测）
   *    ⇒ 同一粒包换个 n 就被判成"不宽"。本门钉三件：①同 n 判据本身 ②参照缺时 fail-closed ③探针真用它。 */
  const INC = { landMulti: 2.63, landLong: 2.70 };
  ok(PF_FRONT.isWideVs(M({ gMulti: 3.4, gLong: 3.2, landMulti: 2.63, landLong: 2.70 }), INC) === true,
    '【本条就是要防的】现役**自己**在旧绝对线(2.66)下会被判"不宽"（landMulti 2.63 < 2.66）⇒ 同 n 并排下必须判宽');
  ok(PF_FRONT.isWide(M({ gMulti: 3.4, gLong: 3.2, landMulti: 2.63, landLong: 2.70 }, 2.66)) === false,
    '（前提自检）同一条读数在绝对线下确实是 false —— 不成立就说明这条门在测空气');
  ok(PF_FRONT.isWideVs(M({ gMulti: 3.4, gLong: 3.2, landMulti: 2.58, landLong: 2.65 }), INC) === true,
    '低于现役 ' + PF_FRONT.LAND_TOL + ' 以内（容差内）⇒ 仍判宽');
  ok(PF_FRONT.isWideVs(M({ gMulti: 3.4, gLong: 3.2, landMulti: 2.13, landLong: 2.20 }), INC) === false,
    '低于现役超过容差 ⇒ 不许判宽');
  ok(PF_FRONT.isWideVs(M({ gMulti: 3.4, gLong: 3.2, landMulti: 9, landLong: 9 }), { landLong: 2.1 }) === false,
    '【fail-closed】参照的净兑现读不到 ⇒ 必须判**不宽**，不许因为缺参照就悄悄退回绝对线');
  ok(PF_FRONT.isWideVs(M({ gMulti: 2.9, gLong: 3.2, landMulti: 9, landLong: 9 }), INC) === false,
    '同 n 判据不许覆盖 G≥3 那条（G=2.9 仍不算宽）');
  const pfSrc = readFileSync('tools/probe-pool-frontier.mjs', 'utf8');
  ok(/isWideVs\(m, incM, LAND_TOL\)/.test(pfSrc) && /isWide\(m, LAND\)/.test(pfSrc),
    '探针默认必须走 `isWideVs(m, incM, LAND_TOL)`；绝对线 `isWide(m, LAND)` 只许留在**显式 `--land-line`** 那条支路上');
  ok(/ABS_LAND/.test(pfSrc) && /--land-line=/.test(pfSrc),
    '显式传 `--land-line` 时必须走绝对线并**响亮说明**（历史读数可复现，但不许静默换判据）');
  ok(pfSrc.indexOf('const rows = []') > pfSrc.indexOf('const incM = metricsOf(incParams)'),
    '参照块必须在 rows **之前**算出来（否则同 n 判据拿不到现役读数）');
  ok(PF_FRONT.isClosed(M({}), 0.5, 100) === true, '花珠率 0.8 + 得珠 200 ⇒ 闭环');
  ok(PF_FRONT.isClosed(M({ spentRate: 0.49 }), 0.5, 100) === false, '花珠率差 0.01 ⇒ 不算闭环');
  ok(PF_FRONT.isClosed(M({ gained: 60 }), 0.5, 100) === false, '率高但攒得少 ⇒ 不算闭环');
  ok(PF_FRONT.isClosed({ gained: NaN, spentRate: NaN }, 0.5, 100) === false, '读数 NaN ⇒ 不许当闭环');
  ok(PF_FRONT.isRobust({ long: 30, multi: 30 }, { long: 38, multi: 35 }) === true, '两模式都低于现役 ⇒ 抗克');
  ok(PF_FRONT.isRobust({ long: 39, multi: 10 }, { long: 38, multi: 35 }) === false, '只一模式超线 ⇒ 不许判抗克');
  ok(PF_FRONT.isRobust(null, { long: 38, multi: 35 }) === false, '没量到 ⇒ 必须判"不抗克"，不许当通过');
  /* 四行合成样本，让"两两组合"与"三样全有"各自至少有一粒（第一版我把第二行写成 wide:true ⇒
   * `robustNotWide` 期望 1 实得 0，被自己的门当场逮住 —— 这正是门该干的事） */
  const fr = PF_FRONT.frontierOf([
    { wide: true, closed: true, robust: false },     // 宽+闭环，但不抗克
    { wide: false, closed: false, robust: true },    // 只抗克（不宽）—— 09-26 那 7 粒档案包里有这个形状
    { wide: true, closed: true, robust: true },      // 三样全有
    { wide: true, closed: false, robust: false },    // 只宽
  ], { long: 38, multi: 35 });
  eq(fr.wide, 3, '宽的计数（含三样全有那粒）');
  eq(fr.wideAndClosed, 2, '宽∩闭环 计数不该含抗克');
  eq(fr.three, 1, '"三合一"必须真的是三样求交');
  eq(fr.robustNotWide, 1, '"只抗克不宽"要单独报 —— 它正是"加筛子也筛不出东西"那一类');
  eq(fr.wideNotRobust, 2, '"只宽不抗克" = 2（第一行"宽+闭环不抗克"与第四行"只宽"都算 —— 这一维本来就是大多数）');
  const bad = spawnSync(process.execPath, ['tools/probe-pool-frontier.mjs', '--oops=1'], { encoding: 'utf8', timeout: 90000 });
  eq(bad.status, 64, '`--oops` 必须 exit 64，实际 status=' + bad.status);
  const s1 = spawnSync(process.execPath, ['tools/probe-pool-frontier.mjs', '--stage=1', '--limit=3', '--every=200'],
    { encoding: 'utf8', timeout: 900000 });
  eq(s1.status, 0, 'stage=1 迷你跑必须成功（status=' + s1.status + ' ' + String(s1.stderr || '').slice(0, 90) + '）');
  ok(/前沿计数/.test(String(s1.stdout)), 'stage=1 仍要印出前沿计数（"跑了"与"跑出东西"分不开就是假绿）');
  ok(String(s1.stdout).indexOf('gate-drafts exit=') < 0, 'stage=1 不许起 gate-drafts（跳过的那 ~40 分钟必须是真跳过）');
  ok(/老维包 \d+/.test(String(s1.stdout)) && /2P 壳 \d+/.test(String(s1.stdout)),
    '必须把"老维包"与"2P 壳"的跳过数印出来（09-26 我手工筛时把一粒 2P 壳混进过 3P 池，而 276 个老维包会被今天的引擎解成另一种行为）');
});

t('D187 整桌同原型（v1.5.280 · §E124）：关=逐位可逆 / 开=局内恒等且跨局满覆盖 / 量具路不许被配方拖动', function () {
  /* 这根杠杆动的是**训练桌的形状**，不是规则 ⇒ 判据必须落在"索引公式"本体上，
   * 而不是"横幅印了没有"（D174 那族：闸放行 ≠ 线接通）。 */
  const idx = T.oppSeatIndex;
  eq(typeof idx, 'function', '① 引擎必须把 `oppSeatIndex` 作为**纯函数**导出来（判在公式上，不判在日志上）');
  eq(typeof T.setOppTable, 'function', '① 必须有 setter（train-3p 下达走读回，没有 setter 就是空转）');
  eq(typeof T.oppTable, 'function', '① 必须有 getter（回执与 meta.recipe 都从它取）');
  /* ② 反"假默认关"：关 ⇒ 必须与**旧公式**逐位相同（旧式独立复算，不 import 新函数） */
  let legacyMismatch = 0, N = 0;
  for (const len of [3, 5, 9, 12, 20]) for (let gen = 0; gen < 7; gen++) for (let g = 0; g < 6; g++) for (let k = 0; k < len; k++) {
    const legacy = (((gen * 3 + g) % len) + k) % len;
    N++; if (idx(gen, g, k, len, false) !== legacy) legacyMismatch++;
  }
  eq(legacyMismatch, 0, '② 关开关时 ' + N + ' 个 (gen,g,k,len) 组合必须与旧累加器逐位相同（不同 ⇒ "默认关"是假的，历史臂不再可复现）');
  /* ③ 判别力（反恒真）：开 ⇒ 同一局内所有对手席索引必须相同（整桌同一原型） */
  let spreadBad = 0;
  for (let gen = 0; gen < 9; gen++) for (let g = 0; g < 9; g++) {
    const a = idx(gen, g, 0, 12, true), b = idx(gen, g, 3, 12, true);
    if (a !== b) spreadBad++;
  }
  eq(spreadBad, 0, '③ 开开关 ⇒ 局内第 1 席与第 4 对手的索引必须相同（不同 ⇒ 桌形根本没改，那臂是白跑的）');
  /* ④ 覆盖面不许被牺牲：开 ⇒ 原型仍按 (gen*3+g) 跨局轮换，len 个连续局必须**恰好各出现一次** */
  for (const len of [9, 12]) {
    const seen = new Set();
    for (let g = 0; g < len; g++) seen.add(idx(4, g, 0, len, true));
    eq(seen.size, len, '④ 开开关时 ' + len + ' 个连续局必须覆盖全部 ' + len + ' 个原型（漏一个 = 那个环境永远练不到）');
  }
  /* ⑤ 往返与哨兵：reset 必须抹掉 true，否则后续门活在"整桌同原型"的假世界里（D109 那族事故） */
  T.setOppTable({ block: true }); eq(T.oppTable().block, true, '⑤ 下达 true 必须读得回（读不回 = §E124 那臂不知道自己开了什么）');
  T.setOppTable({ reset: true }); eq(T.oppTable().block, false, '⑤ reset 必须把 true 抹回出厂值（哨兵泄漏防线）');
  const st = T.oppTable();
  ok(st.blockedGames === 0 && st.styleBlocked === 0, '⑤ reset 顺带清零**开火计数**（不清 ⇒ 下一扇门读到上一扇的剂量）');
  /* ⑥ 静态钉：`evalN` 是**量具**，不许被训练配方拖动 —— 否则产品口径跟着配方变（§E87 那族"口径决定结论"）。
   * ⚠ 这里**不能**写 `String(T.evalN || '')`：`evalN` 根本不在导出名单里 ⇒ 空串 ⇒ 判据恒真（本仓最怕的形状）。 */
  const evoSrc = readFileSync('js/train/evo.js', 'utf8');
  const from = evoSrc.indexOf('function evalN(');
  ok(from > 0, '⑥ 要在源码里定位 `evalN`（找不到就说明它被改名/删了 ⇒ 这条钉失效，必须响亮红而不是默默过）');
  const nextFn = evoSrc.indexOf('\n  function ', from + 20);
  const evalBody = evoSrc.slice(from, nextFn > 0 ? nextFn : evoSrc.length);
  ok(evalBody.length > 100, '⑥ `evalN` 函数体必须真取到了（' + evalBody.length + ' 字符 ⇒ 切片失败，判据会假通过）');
  ok(evalBody.indexOf('oppSeatIndex') === -1, '⑥ `evalN` 体内不许出现 `oppSeatIndex`（评测口径必须与训练桌形无关）');
  ok((evoSrc.match(/oppSeatIndex\(gen/g) || []).length >= 2, '⑥ 训练侧两条路（主池 + 风格切片）都要真走这个公式（只改一条 ⇒ "环境"只在一半训练里存在）');
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/'EPIRUS_OPP_BLOCK'/.test(t3), '⑥ 键必须登记进 `SELF_ENV_KEYS`（漏一处就被入口黑键闸拦成暗键，D172 那族三处名单）');
  ok(/EPIRUS_OPP_BLOCK=1 读回/.test(t3) || /没生效，退出/.test(t3), '⑥ 下达必须有"读回不等 ⇒ exit 7"的硬拒（静默空转的臂比不跑更坏）');
});

t('D188 并发批跑器（v1.5.281）：归属不串台 / 失败不吞 / 输入不全就抛 / 真并发 / 退化成串行仍正确', function () {
  /* 这把尺自己必须有牙：D176 的加速全靠它，"跑得快但把结果记错人"比慢更坏。 */
  const J = (tag, code) => ({ tag: tag, argv: ['-e', code] });
  /* ① 归属：4 个微型 job 并发，每个的 stdout 必须只含自己的 tag（串台 = 断言读错臂） */
  const r1 = spawnBatch([J('tA', 'console.log("tA")'), J('tB', 'console.log("tB")'),
    J('tC', 'console.log("tC")'), J('tD', 'console.log("tD")')], { max: 4 });
  for (const t of ['tA', 'tB', 'tC', 'tD']) {
    eq(String(r1[t].stdout).trim(), t, '① ' + t + ' 的输出必须归属自己（实测 ' + JSON.stringify(String(r1[t].stdout).slice(0, 40)) + '）');
    eq(r1[t].status, 0, '① ' + t + ' 必须成功退出');
  }
  /* ② 失败不吞：非零码与抛错都必须原样带回（吞掉失败 = 假绿） */
  const r2 = spawnBatch([J('e3', 'process.exit(3)'), J('thr', 'throw new Error("boom")'), J('out', 'console.error("E")')]);
  eq(r2.e3.status, 3, '② 子进程 exit 3 必须原样带回，实测 ' + r2.e3.status);
  ok(r2.thr.status !== 0, '② 抛错必须非零，实测 ' + r2.thr.status);
  ok(/E/.test(r2.out.stderr) && !/E/.test(r2.out.stdout), '② stderr 与 stdout 不许混（读 stderr 的断言会因此瞎掉）');
  /* ③ 输入不全一律抛：零 job / tag 重复 / 缺 argv —— 都是"少跑了却像过了"的前身 */
  const throws = (fn) => { try { fn(); return null; } catch (e) { return String(e.message || e); } };
  ok(throws(() => spawnBatch([])), '③ 零个 job 必须抛（一条都没跑不许当通过）');
  ok(throws(() => spawnBatch([J('dup', 'console.log(1)'), J('dup', 'console.log(2)')])).indexOf('tag 重复') >= 0,
    '③ tag 重复必须抛（两支臂盖同一份结果 = 悄悄少跑一支）');
  ok(throws(() => spawnBatch([{ tag: 'x' }])), '③ 缺 argv 必须抛');
  /* ④ 真并发：3 个各睡 1 秒的 job，批跑总耗时必须明显小于串跑的 3 秒 */
  const sleep = (tag) => J(tag, 'const t=Date.now();while(Date.now()-t<1000);console.log("ok")');
  const t0 = Date.now();
  spawnBatch([sleep('a'), sleep('b'), sleep('c')], { max: 3 });
  const ms = Date.now() - t0;
  ok(ms < 2500, '④ 三支各 1 秒的 job 并发跑完用了 ' + ms + 'ms ⇒ 必须明显小于串跑（3000ms+），否则加速是假的');
  /* ⑤ 退化成串行也必须给出全部结果（并发只是加速，不许改变"每支都跑"这件事） */
  const r5 = spawnBatch([J('s1', 'console.log("1")'), J('s2', 'console.log("2")'), J('s3', 'console.log("3")')], { max: 1 });
  ok(['s1', 's2', 's3'].every(k => r5[k] && r5[k].status === 0), '⑤ max=1 时三支仍都要有结果');
  eq(String(r5.s2.stdout).trim(), '2', '⑤ 串行路径的归属同样不许错');
});


t('D201 v1.5.299 的 fit 口径旋钮 EPIRUS_FIT_CAL 有牙（补 DS 提交里那条其实不存在的"门 D200"）', function () {
  /* 为什么有这条（09-29 13:47 复核 c0eb9d4）：DS 的提交说明与 `CHANGELOG.md` 都写"门 D200"、`js/train/evo.js` 的注释写
   *   "默认关 ⇒ 门 D191 钉 A/A" —— **两条引用都落空**：D200 是 v1.5.296 给 5P 环境量具立的门（构造/名字真源/桌子漂移），
   *   D191 是 kept/ 别名检测；np-test 在那版实际只多了 1 行（D77 的 `SENT` 里登记 `fitCal: true`，管的是"设得进读得回"，
   *   不管默认值、不管公式、不管调用点）。⇒ 这个**会换掉全部历史臂的尺**的旋钮当时是"声称有门、其实没门"。
   *   与本仓同族事故（D199 第一版恒真、D159 正则没算括号、§E108 改了被读文件没复跑）记在同一类里：**记账说门在，门不在**。
   * ⚠ 本门能钉什么、钉不了什么，写在最后一条注释里，别把它读成"接线已被证明"。 */
  const EVO = readFileSync('js/train/evo.js', 'utf8');
  /* 自建沙箱（与 D162 同规矩）：默认值必须在**干净**模块里读，共享 `T` 早被 D77 那类门喂过值 */
  const sb3 = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
  sb3.window = sb3; sb3.globalThis = sb3;
  for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
    'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(f, 'utf8'), sb3, { filename: f });
  const T3 = sb3.window.EpirusTrainer;
  /* ① 默认关 ⇒ 旧刻度逐位不变（这条是"没换尺"的全部凭据；D77 的往返管不到它） */
  eq(T3.economyReward().fitCal, false, '① 出厂必须**关**（实测 ' + T3.economyReward().fitCal + '）');
  eq(T3.rankCredit(2, 1, 5), 0.3, '① 关着时第二名必须还是绝对刻度 0.3（与人数无关的老行为）');
  eq(T3.rankCredit(1, 1, 3), 1, '① 关着时第一名 1.0');
  /* ② setter 收口径：布尔/数字/字符串 '0' 都要能判，且回执读得到（D77 只喂 true 一种形态） */
  eq(T3.setEconomyReward({ fitCal: 1 }).fitCal, true, '② =1 必须开（回执 fitCal）');
  eq(T3.setEconomyReward({ fitCal: '0' }).fitCal, false, "② 字符串 '0' 必须判成关（env 下达全是字符串，'0' 被当真是本仓反复踩的形状）");
  eq(T3.setEconomyReward({ fitCal: 0 }).fitCal, false, '② 数字 0 必须判成关');
  /* ③ 开了之后的形状：1 名 = 1、其余 = 0、**且不许出负数/NaN**（rank=N 时基线 = 1 ⇒ 除零靠 0.99 夹 + clamp≥0 兜）
     各 N 都试一遍，钉的是"形状与人数无关"这个**设计目的**本身 */
  T3.setEconomyReward({ fitCal: 1 });
  for (const N of [2, 3, 4, 5]) {
    eq(T3.rankCredit(1, 1, N), 1, '③ 开 + N=' + N + '：1 名必须 1.0（对齐后 1 名回到满分）');
    for (let r = 2; r <= N; r++) {
      const v = T3.rankCredit(r, 1, N);
      ok(Number.isFinite(v) && v >= 0, '③ 开 + N=' + N + ' rank=' + r + ' 必须是**有限非负**数（实测 ' + v + '）⇒ 夹住基线上界与 clamp≥0 两道都在');
      eq(v, 0, '③ 开 + N=' + N + ' rank=' + r + '：低于随机基线 ⇒ 归 0（"只有赢才算"是 DS 写进注释的语义）');
    }
  }
  /* ④ 复位必须真能抹掉（DS 自己栽过的坑：`ECON_DEFAULTS` 是**字面量列表**，漏一个新键 ⇒ `reset` 静默抹不掉，D175 才抓到） */
  T3.setEconomyReward({ reset: true });
  eq(T3.economyReward().fitCal, false, '④ reset 后必须回出厂 false（实测 ' + T3.economyReward().fitCal + '）⇒ 新键要同时进 ECON_DEFAULTS 快照');
  eq(T3.rankCredit(2, 1, 5), 0.3, '④ reset 后刻度必须真的回到旧的 0.3（读回接口 false 但作用点没复位 = 假复位）');
  /* ⑤ 签名 + **调用点真传人数**：本仓规矩是"只看签名不算接线"（D174 那次 costlyW 通过黑键闸却从没送给引擎） */
  const sig = /function rankCredit\(rank, aliveEnd, nSeats\)/.exec(EVO);
  ok(sig, '⑤ `rankCredit` 必须收第三个人数参（实测没找到该签名）');
  ok(EVO.indexOf('rankCredit(rank, aliveEnd, r.state.p.length)') >= 0,
    '⑤ 调用点必须把**真实席数**传进去（`r.state.p.length`）—— 接了参数却不传 = 开了也等于没开');
  ok(!/rankCredit\(rank, aliveEnd\)[^,]/.test(EVO), '⑤ 不许残留两参数的老调用点（漏改一处 = 那一处静默用旧刻度）');
  /* ⑥ 名单三处（ECON_ENV_KEYS / ECON_REWARD_KEYS / train-3p 的 CLI 名单）由 D77 与 probe-econ-reset-audit 钉，
     **这里不再抄一份**（仓规：第二遍抄写正是本仓反复出事的形状）。DS 的 A/B 实测已证明它没被黑键闸拦。
   * ⚠ 本门钉不了什么（写清楚，免得下一个人以为"有门 = 接线已被证明"）：
   *   对齐后的输出对 N **恒等**（1 名永远 1.0、其余永远 0）⇒ ③ 无法从数值上区分"按人数算"与"写死按 3 人算"；
   *   那半条只能靠 ⑤ 的调用点静态钉 + DS 的产物级 A/B（末代 bestFit 0.835→0.380）。 */
});

t('D204 在线对手模型 + 1-ply 重放搜索（v1.5.305 · **默认关** · `setBeliefSearch(1)` / 页面 `localStorage.epirus.beliefSearch`）有牙', function () {
  /* 为什么有这条（09-30 夜 §E152d/§E153，Qoder）：五臂分解把现役 AI 的病名定成"**没有对手模型**"，
   *   而"加几维进网络"只买得到 +7.83 / +15.50pt（每席 1~4 个量，60 桌 × 20 局），大头 +44.08pt [34.81, 53.36]
   *   要求"席位 → 具体卡名分布"这种表状结构 ⇒ 于是做成**决策时搜索**，不动 `policy.js`/`FEAT_S`/规则指纹。
   * 发布路径的实测（`docs/artifacts/e152b-arms.mjs` · 40 桌 × 10 局 · 逐桌配对 · 关档走 `pickChampion`、开档走 `policyChooserBelief`）：
   *   关档 **31.50%** ‖ 开档 **74.75%** ⇒ **+43.25pt [33.54, 52.96]**；同桌对撞（0 号位=发布档现役包）**+66.00pt [59.46, 72.54]**。
   * ⚠ 本门是**行为门**，不是文本钉（D190 那种"纯静态、零判据"的门本仓已经点过名）：
   *   四段全部跑真引擎，且关/开用**同一批 seed** ⇒ 配对成立；④ 专门打"假复位"。 */
  const EVO = readFileSync('js/train/evo.js', 'utf8');
  const UI = readFileSync('js/ui/ui.js', 'utf8');
  const mkSb = function () {
    const s3 = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, decodeURIComponent };
    s3.window = s3; s3.globalThis = s3;
    for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
      'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(f, 'utf8'), s3, { filename: f });
    return s3.window;
  };
  /* 跑一批固定 seed 的 5 人局：0 号位是候选（开/关两档），其余四席是可学习的固定型脚本
     ⇒ 脚本必须**有规律**，否则"信念表有没有在工作"这件事根本测不到（§口径陷阱：反事实要先证明扰动进得去） */
  function batch(on, games, collect) {
    const W = mkSb(), T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules, P = W.EpirusPolicy, Play = W.EpirusPlay;
    const mm = readFileSync('js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
    const params = P.unpack(JSON.parse(mm[1]), true);
    if (!params) throw new Error('夹具读不到出厂 3P 包');
    T.setBeliefSearch(on ? 1 : 0);
    const scripted = function (s, pid, legal) {
      const aff = legal.filter(function (l) { return l.affordable; });
      let gun = null;
      for (let i = 0; i < aff.length; i++) if (aff[i].key === R.SK.GUN) { gun = aff[i]; break; }
      if (!gun) return { key: R.SK.JI, target: null };
      let tg = (pid + 1) % s.p.length;
      if (!s.p[tg] || s.p[tg].hp <= 0) tg = pid;
      return { key: R.SK.GUN, target: tg };
    };
    const out = [];
    for (let g = 0; g < games; g++) {
      const st = S.createState('multi', { next: T.mulberry32(555 + g * 7919) }, 5);
      if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(555 + g * 7919);
      const sub = T.policyChooserN(params, 0.15, 0.2, 5, 'soft');
      Play.autoGameN(st, [sub, scripted, scripted, scripted, scripted]);
      const row = { winner: st.winner, round: st.round };
      if (collect) { const bb = T.beliefObserve(st); row.bel = Object.keys(bb.tab).length; row.sig0 = bb.sig[1]; }
      out.push(row);
    }
    return out;
  }
  const sig = function (rows) { return rows.map(function (r) { return r.winner + '/' + r.round; }).join(' '); };
  /* ① 出厂必须关（干净沙箱里读，别用共享 `T` —— 它早被别的门喂过值） */
  const W0 = mkSb();
  eq(W0.EpirusTrainer.beliefSearchOn(), 0, '① 出厂必须是 0（实测 ' + W0.EpirusTrainer.beliefSearchOn() + '）⇒ 开档必须是点名行为，不是默认');
  /* v1.7.126（门禁 ② 分诊，批 4）：这条源码 pin 与**上一行**的行为腿重复 ——
   *   2888 已经真跑 `W0.EpirusTrainer.beliefSearchOn()` 断言出厂 = 0；把默认值改成 1，那条当场红。
   *   实现怎么写（`let X = 0` / `const` / 初始化函数）不该被钉。 */
  /* ② setter 的口径：env/CLI 下达全是字符串，`'0'` 被当真是本仓反复踩的形状 */
  W0.EpirusTrainer.setBeliefSearch('0'); eq(W0.EpirusTrainer.beliefSearchOn(), 0, "② 字符串 '0' 必须判成关");
  W0.EpirusTrainer.setBeliefSearch(0); eq(W0.EpirusTrainer.beliefSearchOn(), 0, '② 数字 0 必须判成关');
  W0.EpirusTrainer.setBeliefSearch('1'); eq(W0.EpirusTrainer.beliefSearchOn(), 1, '② 字符串 "1" 必须判成开');
  /* ③ 开档真的改变了行为（钩子若被注释掉/短路成不返回，这段立刻红）+ 方向必须是"更强" */
  const OFF = batch(false, 12, false), ON = batch(true, 12, true);
  ok(sig(OFF) !== sig(ON), '③ 同 seed 下开档必须至少改变一局的结果（关/开逐字相同 = 钩子根本没接上，D174 那一族）');
  const winO = OFF.filter(r => r.winner === 0).length, winN = ON.filter(r => r.winner === 0).length;
  ok(winN >= winO + 3, '③ 方向：12 局里开档夺冠数必须比关档多 ≥3（实测 关=' + winO + ' 开=' + winN + '）⇒ 大样本是 31.50%→74.75%，掉回来就是坏了');
  /* ④ 复位必须真能抹掉：再跑一遍关档，要与 ③ 的关档基线**逐字相同**（"读回接口是关、作用点还开着"= 假复位） */
  eq(sig(batch(false, 12, false)), sig(OFF), '④ 关掉之后必须逐字回到基线（否则 `setBeliefSearch(0)` 没复位干净，历史臂就不可比）');
  /* ⑤ 信念表确实在长（不是每次都退回默认的 ジ），且键里带**席位身份**（无身份 = §E152d 里那个只有 +7.8/+15.5pt 的便宜档） */
  const sizes = ON.map(r => r.bel);
  ok(sizes.every(function (n) { return n > 3; }), '⑤ 开档的每局都该攒到"多个条件格"（实测 ' + sizes.join(',') + '）⇒ 表太小 = 学习信号没进来，或身份锚没进键');
  ok(/^1@/.test(ON[0].sig0 || ''), '⑤ 预测格的键必须以席位开头（实测 ' + ON[0].sig0 + '）⇒ §E152d：没有身份锚就只剩 +7.83pt 那一档');
  /* ⑤b **克隆保真**（§E159 那条页面缺陷的直接替身，比跑一整局便宜）：
     页面把 AI 喂的是 `cloneState(B.state)` ⇒ 表必须能从"被 JSON 往返过的 state"里原样重建，否则浏览器里开了档等于没开。 */
  {
    const W = mkSb(), T = W.EpirusTrainer, S = W.EpirusState, P = W.EpirusPolicy, Play = W.EpirusPlay;
    const mm3 = readFileSync('js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
    const pp = P.unpack(JSON.parse(mm3[1]), true);
    const st = S.createState('multi', { next: T.mulberry32(9021) }, 5);
    if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(9021);
    const f = T.policyChooserBelief(pp, 0.15, 0.2, 5, 'soft');
    const others = function (s2, pid2, legal) { const lg = legal.filter(function (l) { return l.affordable; }); return lg.length ? lg[0].key : R.SK.JI; };
    Play.autoGameN(st, [f, others, others, others, others]);
    const a = JSON.stringify(T.beliefObserve(st).tab), b2 = JSON.stringify(T.beliefObserve(S.cloneState(st)).tab);
    ok(a.length > 20, '⑤b 一整局之后表必须真的非空（实测序列化长度 ' + a.length + '）');
    eq(b2, a, '⑤b **同一局、克隆体重建的表必须与活对象逐字相同**（页面喂的就是克隆；这条红了就等于"浏览器里开了档但没在学"，§E159 实测过那个失败形状：83.25% → 28.25%）');
  }
  /* ⑥ 泄漏红线：条件量只许用**公开信息**。扫的是重建函数全体（`beliefObserve` + `beliefSigOf`），
     键里出现 `elec`/`boom`/`bead`/`lastTarget`/`target` 就等于把"珠的类型"或"未出手的目标"喂给模型（v1.5.15 那条红线）。 */
  const bsBody = /function beliefObserve\(state\)[\s\S]{0,1600}?\n  \}/.exec(EVO);
  ok(bsBody, '⑥ 找不到 `beliefObserve`（学习条件的唯一来源）');
  /* ⚠ 必须先剥注释再扫：我第一版直接扫函数体，结果被我自己写的"不用 `p.lastSkill`"那句注释判红
     ⇒ 与 D204⑦ 那条 `state.rng` 的坑同族（**钉代码形状，不钉措辞**）。 */
  const bsCode = bsBody[0].replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  ok(!/elec|boom|bead|lastTarget|\.target/.test(bsCode),
    '⑥ `beliefObserve` 的**代码**里不许读珠类型/目标这类私有信息（实测 ' + bsCode.replace(/\s+/g, ' ').slice(0, 140) + '）');
  ok(!/lastSkill/.test(bsCode),
    '⑥ 条件量必须走**同一种构造**（代码里出现 `lastSkill` = 训练格用走查值、预测格用引擎字段，两格不同构，表再准也接不上）');
  /* ⑦ 接线：页面侧的旋钮必须真的送到引擎（"闸放行 ≠ 线接通"，DS 今天立的那条） */
  ok(/localStorage\.getItem\('epirus\.beliefSearch'\)/.test(UI) && /Trainer\.setBeliefSearch\(bsOn\)/.test(UI),
    '⑦ `js/ui/ui.js` 必须读 `epirus.beliefSearch` 并调用 `Trainer.setBeliefSearch`（少了后半句 = 键能设但送不到作用点）');
  ok(/if \(bsMine\) \{ const bs = beliefSearchPick\(state, pid, cands, params\); if \(bs\) return bs; \}/.test(EVO),
    '⑦ 作用点必须在 `greedyOf` **内部**（只换"贪心那一支"，探索支不许动）——挂在 ε 之前会多抽一次随机数，开/关两档的轨迹就分叉了');
  ok(!/state\.rng\.next\(/.test(/function beliefSearchPick[\s\S]{0,1200}/.exec(EVO)[0]),
    '⑦ `beliefSearchPick` 里不许抽 `state.rng`（一次决策只该有一次 ε 抽取；多抽 = 同构漂移的另一半）。' +
    '⚠ 这条一开始写成"不许出现 state.rng"，结果被我自己的注释（"不许抽 `state.rng`"）判红 ⇒ 钉代码形状，不钉措辞');
  /* ⑧ 防漂移。这条判据我连写错两次，两次都被自己抓住，如实记下来免得下一个人再错：
     ✘ 第一版写"eps=1 时两把工厂必须给同样的选择" ⇒ 错：开档本来就该改变软豁免路径下的那一手，选择**应该**不同。
     ✘ 第二版写"开档不许多抽 `state.rng`" ⇒ 也错：搜索是确定性的，开了就不再走网络采样 ⇒ 抽数**必然变少**（实测 270 → 0）。
     ✓ 真正必须钉的是两件事：(a) **不许存在第二份候选枚举**（本仓"两份同构实现必漂移"第五次诱惑，我第一版工厂确实自己重写了三行）；
        (b) 开档必须**可复现**（同 seed 同结果 ⇒ 排除 `Math.random`/对象身份这类隐形输入）。 */
  {
    const fac = /function policyChooserBelief\([\s\S]{0,420}?\n  \}/.exec(EVO);
    ok(fac, '⑧ 找不到 `policyChooserBelief`');
    ok(fac[0].indexOf('policyChooserN(') >= 0, '⑧ 工厂必须**委派**给 `policyChooserN`（自己枚举一份 = 第二份实现，必漂）');
    ok(fac[0].indexOf('candidatesFor(') < 0 && fac[0].indexOf('econBase(') < 0,
      '⑧ 工厂里不许出现 `candidatesFor`/`econBase`（候选口径只许有一份真源；今晚第一版就是在这里漂掉的）');
    const trace = function () {
      const W = mkSb(), T = W.EpirusTrainer, S = W.EpirusState, P = W.EpirusPolicy, Play = W.EpirusPlay;
      const mm2 = readFileSync('js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
      const pp = P.unpack(JSON.parse(mm2[1]), true);
      const f = T.policyChooserBelief(pp, 0.15, 0);
      const others = function (s2, pid2, legal) { const lg = legal.filter(function (l) { return l.affordable; }); return lg.length ? lg[0].key : R.SK.JI; };
      const seen = [];
      for (let g = 0; g < 3; g++) {
        const seed = 4242 + g * 977;
        const st = S.createState('multi', { next: T.mulberry32(seed) }, 5);
        if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(seed);
        Play.autoGameN(st, [f, others, others, others, others]);
        seen.push(st.winner + '/' + st.round);
      }
      return seen.join(',');
    };
    eq(trace(), trace(), '⑧ 开档必须可复现（同 seed 两次跑出不同结果 = 混进了 `Math.random`/对象身份这类隐形输入，A/B 不可信）');
    ok(trace() !== 'undefined/0,undefined/0,undefined/0', '⑧ 复现检查不许是"两批空跑"（真的量到了局）');
  }
  /* ⑪ §E161 的层数旋钮：默认必须是 1（= §E156b 那版行为），且"开档 + ply=2"必须真的不同于 ply=1
     （否则那三列"电磁炮/蓄能/集火回不回来"根本没在被测的东西上）。
     ⚠ 本段在文件里排在 ⑨ 之前（只是插入位置，编号仍跟着 ⑩ 之后）；⑩ 及 ⑪ 这两个圈码在别的门里也用过，
        读时按"本门内部编号"理解，别去别处找同名段。 */
  {
    const W = mkSb(), T = W.EpirusTrainer;
    eq(T.beliefPly(), 1, '⑪ `beliefPly()` 出厂必须是 1（实测 ' + T.beliefPly() + '）⇒ 默认形状必须等于已量过的那版');
    T.setBeliefPly('3'); eq(T.beliefPly(), 3, '⑪ 字符串 "3" 必须能设进去');
    T.setBeliefPly(99); eq(T.beliefPly(), 3, '⑪ 上界夹住（99 ⇒ 3）：一次决策要重放 候选^层，不许有人把它当"越深越好"随手调');
    T.setBeliefPly(0); eq(T.beliefPly(), 1, '⑪ 0 必须回到 1，不许出现"0 层"这种静默退化');
    T.setBeliefPly('abc'); eq(T.beliefPly(), 1, '⑪ 非数值必须回到 1（NaN 传下去会让整局成 NaN）');
    const trace = function (ply) {
      const W2 = mkSb(), T2 = W2.EpirusTrainer, S2 = W2.EpirusState, P2 = W2.EpirusPolicy, Play2 = W2.EpirusPlay, R2 = W2.EpirusRules;
      const mm4 = readFileSync('js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
      const pp = P2.unpack(JSON.parse(mm4[1]), true);
      T2.setBeliefSearch(1); T2.setBeliefPly(ply);
      const f = T2.policyChooserBelief(pp, 0.15, 0.2, 5, 'soft');
      const others = function (s2, pid2, legal) { const lg = legal.filter(function (l) { return l.affordable; }); return lg.length ? lg[0].key : R2.SK.JI; };
      const seen = [];
      for (let g = 0; g < 2; g++) {
        const sd = 31337 + g * 977;
        const st = S2.createState('multi', { next: T2.mulberry32(sd) }, 5);
        if (T2.slotSaltFor) st.slotSalt = T2.slotSaltFor(sd);
        Play2.autoGameN(st, [f, others, others, others, others]);
        seen.push(st.winner + '/' + st.round);
      }
      return seen.join(',');
    };
    const t1 = trace(1), t2 = trace(2);
    ok(t1 !== t2, '⑪ 开档下 ply=1 与 ply=2 的整局必须不同（实测两批都是 ' + t1 + '）⇒ 相同就说明层数没接到评估里');
  }
  /* ⑫ §E161b/§E161c 的两个新档（目标怎么定价 `setBeliefTarget` / 平票怎么破 `setBeliefTie`）：
     出厂必须都是 0（= §E154~§E161 已认证的那把尺），且**每一档必须真的改判决**——
     不然"三列回没回来"是在一把没接到引擎的尺上量的（⑪ 同族的坑：旋钮印在 banner 上不等于进了决策）。 */
  {
    const src12 = readFileSync('js/train/evo.js', 'utf8');
    ok(/let BELIEF_TGT = 0;/.test(src12) && /let BELIEF_TIE = 0;/.test(src12),
      '⑫ 源码默认值必须是 `BELIEF_TGT = 0` / `BELIEF_TIE = 0`（出厂 = 已量过那版）');
    ok(src12.indexOf('else if (BELIEF_TIE === 1') >= 0,
      '⑫ 平票那条支路必须**带 `BELIEF_TIE === 1` 守卫**（tie=0 时一次都不许多算 `P.value` ⇒ 默认形状逐字不变）');
    const W12 = mkSb(), T12 = W12.EpirusTrainer;
    eq(T12.beliefTarget(), 0, '⑫ `beliefTarget()` 出厂必须是 0（实测 ' + T12.beliefTarget() + '）');
    eq(T12.beliefTie(), 0, '⑫ `beliefTie()` 出厂必须是 0（实测 ' + T12.beliefTie() + '）');
    T12.setBeliefTarget('2'); eq(T12.beliefTarget(), 2, '⑫ 字符串 "2" 必须能设进去');
    T12.setBeliefTarget(99); eq(T12.beliefTarget(), 2, '⑫ 上界夹住（99 ⇒ 2）');
    T12.setBeliefTarget(-1); eq(T12.beliefTarget(), 0, '⑫ 负数必须回 0，不许把 -1 当"另一种档"');
    T12.setBeliefTarget('abc'); eq(T12.beliefTarget(), 0, '⑫ 非数值必须回 0');
    T12.setBeliefTie(5); eq(T12.beliefTie(), 1, '⑫ 平票档只有两档，5 必须夹成 1');
    T12.setBeliefTie(0); eq(T12.beliefTie(), 0, '⑫ 0 必须能关回去');
    const trace12 = function (tgt, tie) {
      const W2 = mkSb(), T2 = W2.EpirusTrainer, S2 = W2.EpirusState, P2 = W2.EpirusPolicy, Play2 = W2.EpirusPlay, R2 = W2.EpirusRules;
      const mm4 = readFileSync('js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
      const pp = P2.unpack(JSON.parse(mm4[1]), true);
      T2.setBeliefSearch(1); T2.setBeliefTarget(tgt); T2.setBeliefTie(tie);
      const f = T2.policyChooserBelief(pp, 0.15, 0.2, 5, 'soft');
      const others = function (s2, pid2, legal) { const lg = legal.filter(function (l) { return l.affordable; }); return lg.length ? lg[0].key : R2.SK.JI; };
      const seen = [];
      for (let g = 0; g < 6; g++) {
        const sd = 31337 + g * 977;
        const st = S2.createState('multi', { next: T2.mulberry32(sd) }, 5);
        if (T2.slotSaltFor) st.slotSalt = T2.slotSaltFor(sd);
        Play2.autoGameN(st, [f, others, others, others, others]);
        seen.push(st.winner + '/' + st.round);
      }
      return seen.join(',');
    };
    const base12 = trace12(0, 0);
    ok(trace12(0, 1) !== base12, '⑫ tie=1（平票交给网络打分）必须改判决（实测与基线同为 ' + base12 + '）⇒ 相同就说明这个档没接进搜索');
    ok(trace12(1, 0) !== base12, '⑫ tgt=1（减最强活着的那个）必须改判决（实测与基线同为 ' + base12 + '）');
    ok(trace12(2, 0) !== base12, '⑫ tgt=2（每次淘汰定价）必须改判决（实测与基线同为 ' + base12 + '）');
    eq(trace12(0, 0), base12, '⑫ 同档两次跑必须逐字相同（搜索不许抽 `state.rng`）');
  }
  /* ⑨ 锚点纪律（今晚 D161 真红过一次换来的）：两道量具拿 `policyChooserN` 的**签名整行**当补丁锚点。
     钉法是"从两个库源码里把锚字符串抠出来，再要求 evo.js 逐字含有它"—— 而不是我再抄一遍那行字
     （抄第三份 = 制造下一次"改了一处漏两处"，本仓那条老规矩）。 */
  {
    const anchors = [];
    for (const lib of ['tools/guard-cost-lib.mjs', 'tools/seq-reward-lib.mjs']) {
      const m = /const A = '(  function policyChooserN[^\n]*?)';/.exec(readFileSync(lib, 'utf8'));
      ok(m, '⑨ ' + lib + ' 里抠不到 `policyChooserN` 的锚字符串（库的形状改了 ⇒ 这条纪律要跟着改写法，不许直接删断言）');
      anchors.push(m[1]);
    }
    eq(anchors[0], anchors[1], '⑨ 两道量具的锚必须是**同一行字**（各自一份就会有一天各改各的）');
    ok(EVO.indexOf(anchors[0]) >= 0,
      '⑨ `evo.js` 里必须逐字含有这一行签名（被改 = 两道量具的 route ① 静默失配；D161 今晚就是这么红的）');
  }
});

t('D231 §E477 权重融合入口 `tools/soup-pack.mjs`：自证必须绿 · 四道守卫都要真咬 · 融合结果必须能被引擎解开 · 不许碰线上槽', function () {
  /* 为什么值得一条门（METHODOLOGY 第 15 条："交付清单里的每个文件都得有一条会失败的用例点名"）：
   * 这个工具产出的东西**看起来就是一枚冠军包**（同外壳、同长度、能被页面导入），但它不是任何一次训练的结果。
   * 一旦"平均错了"（形状错位 / 权重没归一 / 把 2P 包拌进 3P 包），产出的仍然是一枚能跑、会给出数、
   * 但语义根本不成立的包 —— 那是本仓最怕的"结果对、理由错"的最坏形状。
   * ⚠ 开发期它已经红过三次（typed array 序列化、浮点结合顺序、`extractJsonObject` 返回字符串不是对象），
   *    三条都是 self-test 抓的 ⇒ 把那份自证搬进门禁，而不是让它只在开发时跑过一次。 */
  const SRC = 'tools/soup-pack.mjs';
  const src = readFileSync(SRC, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'e477-soup-'));
  try {
    const r = spawnSync(process.execPath, [SRC, '--self-test'], { encoding: 'utf8', timeout: 120000 });
    eq(r.status, 0, '① `--self-test` 必须整批绿（exit 0）：\n' + String(r.stdout || '').slice(0, 400) + String(r.stderr || '').slice(0, 200));
    const ticks = (String(r.stdout || '').match(/^ {2}ok {3}/gm) || []).length;
    ok(ticks >= 6, '① 且六条手算期望都要过（实测 ' + ticks + ' 条）—— 只 exit 0 不算，红掉的断言会被 `|| true` 之类吞掉');
    const bad = spawnSync(process.execPath, [SRC, '--typo-flag=1'], { encoding: 'utf8', timeout: 60000 });
    eq(bad.status, 64, '② 不认识的参数必须 exit 64（仓规 v1.5.234，实测 ' + bad.status + '）');
    const one = spawnSync(process.execPath, [SRC, '--packs=js/bundled-champion-3p.js'], { encoding: 'utf8', timeout: 60000 });
    eq(one.status, 64, '③ 只给一粒包不算融合，必须响亮拒（实测 ' + one.status + '）');
    const p2 = spawnSync(process.execPath, [SRC, '--packs=js/bundled-champion.js,js/bundled-champion-3p.js', '--out=' + join(dir, 'x.js')], { encoding: 'utf8', timeout: 60000 });
    eq(p2.status, 2, '④ 2P 包混进多人桌必须 exit 2（两颗包不同桌，实测 ' + p2.status + '）');
    /* ⑤⑥ 合成两粒包：形状不同 ⇒ exit 3；形状同但规则指纹不同 ⇒ exit 4，且 `--force-fp=1` 必须真放行 */
    const packTxt = (len, fp) => 'window.EPIRUS_CHAMPION_3P_META = {"rulesFingerprint":"' + fp + '"};\n' +
      'window.EPIRUS_CHAMPION_3P = {"v":7,"a":[' + Array.from({ length: len }, (_, i) => (i % 7) / 7).join(',') + '],"f":213,"fa":22,"h":24};\n';
    writeFileSync(join(dir, 'a.js'), packTxt(5689, 'aaaa1111'));
    writeFileSync(join(dir, 'b.js'), packTxt(1633, 'aaaa1111'));   /* v5 时代的长度 ⇒ 形状不同 */
    writeFileSync(join(dir, 'c.js'), packTxt(5689, 'bbbb2222'));   /* 同形状、不同规则世界 */
    const shape = spawnSync(process.execPath, [SRC, '--packs=' + join(dir, 'a.js') + ',' + join(dir, 'b.js'), '--out=' + join(dir, 'o1.js')], { encoding: 'utf8', timeout: 60000 });
    eq(shape.status, 3, '⑤ 长度/维度不一致必须 exit 3（"逐位平均"在这条输入上没有意义，实测 ' + shape.status + '）');
    const fp = spawnSync(process.execPath, [SRC, '--packs=' + join(dir, 'a.js') + ',' + join(dir, 'c.js'), '--out=' + join(dir, 'o2.js')], { encoding: 'utf8', timeout: 60000 });
    ok(fp.status === 4 || fp.status === 64, '⑥ 规则指纹不一致必须拒（exit 4；拼参数顺序错了也算响亮失败），实测 ' + fp.status);
    const forced = spawnSync(process.execPath, [SRC, '--packs=' + join(dir, 'a.js') + ',' + join(dir, 'c.js'), '--force-fp=1', '--out=' + join(dir, 'o3.js')], { encoding: 'utf8', timeout: 60000 });
    eq(forced.status, 0, '⑥ 但 `--force-fp=1` 必须真放行（实测 ' + forced.status + '）⇒ 守卫不是"一律不许"，是"不许静默"');
    ok(/"forceFp":true/.test(readFileSync(join(dir, 'o3.js'), 'utf8')), '⑥ 放行这件事必须写进产物 meta（否则第二天没人知道这粒跨了规则世界）');
    /* ⑦ 确定性：同一对输入、两种权重写法 ⇒ wid 逐位相同（权重会归一化） */
    const mk = (w, out) => spawnSync(process.execPath, [SRC, '--packs=' + join(dir, 'a.js') + ',' + join(dir, 'c.js'), '--force-fp=1', '--w=' + w, '--out=' + out], { encoding: 'utf8', timeout: 60000 });
    const A = join(dir, 's1.js'), B = join(dir, 's2.js');
    mk('1,1', A); mk('0.5,0.5', B);
    const sha = f => createHash('sha1').update(readFileSync(f, 'utf8').split('\n').slice(2).join('\n')).digest('hex').slice(0, 12);
    eq(sha(A), sha(B), '⑦ 权重归一化必须与写法无关（`1,1` 与 `0.5,0.5` 要产出逐位相同的包）');
    /* ⑧ 真包融合完必须能被引擎解开（防"平均出 NaN / 形状坏 / 页面导入失败"） */
  /* §2026-10-09 DS：⑧ 那条腿要真包（K2 / E20-71 / v17-146），而它们从未入库 ⇒ 全新 clone（CI）上必红；
   *   缺件时响亮跳过并点名（其余腿是门内自造的，仍会跑）。 */
  needArtifacts('D231 ⑧ 真包融合', ['docs/artifacts/kept/e70-out__D02-31.bak', 'docs/artifacts/e85-out/E20-71.bak', 'docs/artifacts/v17-146.bak']);
    const real = spawnSync(process.execPath, [SRC, '--packs=docs/artifacts/kept/e70-out__D02-31.bak,docs/artifacts/e85-out/E20-71.bak', '--out=' + join(dir, 'ke.js')], { encoding: 'utf8', timeout: 120000 });
    eq(real.status, 0, '⑧ 真包融合必须成功（K2 + E20-71，实测 ' + real.status + '）：\n' + String(real.stderr || '').slice(0, 200));
    const s3 = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Float64Array };
    s3.window = s3; s3.globalThis = s3;
    for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
      'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(f, 'utf8'), s3, { filename: f });
    const PW = s3.window;
    const raw = readFileSync(join(dir, 'ke.js'), 'utf8');
    const body = JSON.parse(/window\.EPIRUS_CHAMPION_3P = (\{[\s\S]*?\});?\n*$/.exec(raw)[1]);
    const ck = PW.EpirusPolicy.checkPack(body);
    ok(ck.ok, '⑧ 融合产物必须过 `checkPack`（页面导入与对局读包走的就是这一道，实测 reason=' + (ck.reason || '?') + '）');
    const up = PW.EpirusPolicy.unpack(body, true);
    ok(!!up && up.length === 5689 && Array.from(up).every(x => isFinite(x)),
      '⑧ 解出来的权重必须有限、长度 5689（NaN/Inf 会伪装成"能跑"，直到第一手棋才炸）');
    /* ⑨ 静态哨兵：这个入口不许把产物写到线上槽（训练侧栽过一次"打错的帮助页改脏门禁基线"） */
    ok(!/writeFileSync\(\s*['"]js\/bundled-champion/.test(src), '⑨ 源码里不许出现往 `js/bundled-champion*` 写的路径');
    ok(/不写 `js\/\*\*`|只写 `--out=`/.test(src), '⑨ 且头注里那条"不写 js/**"的规矩要留字（谁改这段注释得说明为什么）');
    /* ===== §E498 外科复制模式（`--copy-cols=`）的三条 ===== */
    const cp = join(dir, 'copy.js');
    const r2 = spawnSync(process.execPath, [SRC, '--packs=docs/artifacts/kept/e70-out__D02-31.bak,docs/artifacts/v17-146.bak',
      '--copy-cols=4', '--out=' + cp], { encoding: 'utf8', timeout: 300000 });
    eq(r2.status, 0, '⑩ 真跑一次"只复制防御向那一列"必须成功：\n' + String(r2.stderr || r2.stdout).split('\n').slice(-5).join('\n'));
    const csrc = readFileSync(cp, 'utf8');
    const cobj = JSON.parse((csrc.match(/window\.EPIRUS_CHAMPION_3P = (\{[\s\S]*?\});/) || [])[1]);
    const sb = sandbox(process.cwd());
    const cpk = sb.EpirusPolicy.checkPack(cobj);   // 引擎自己那份严格校验（不是工具侧放宽版）
    ok(cpk && cpk.ok !== false, '⑩ 产物必须被**引擎自己**收下（checkPack 不 ok ⇒ 这枚包在页面上就是一堆乱码）：' + JSON.stringify(cpk));
    /* 改动格数必须**正好**等于 HID × 列数：多一格就是"复制时顺手做了平均"，少一格就是行主序算错 */
    const pb = sb.EpirusPolicy.unpack(JSON.parse((readFileSync('docs/artifacts/kept/e70-out__D02-31.bak', 'utf8')
      .match(/window\.EPIRUS_CHAMPION_3P = (\{[\s\S]*?\});/) || [])[1]), true);
    let diff = 0; const q = sb.EpirusPolicy.unpack(cobj, true);
    for (let i = 0; i < pb.length; i++) if (pb[i] !== q[i]) diff++;
    eq(diff, 24, '⑪ 复制 1 列必须改**恰好 24 格**（HID=24 个隐单元 × 1 列；实测 ' + diff + '）');
    ok(/"mode":"copy-cols"/.test(csrc) && /"cols":\[4\]/.test(csrc),
      '⑫ 产物 meta 必须写明"这是外科复制、复制了哪几列"（否则日后有人拿它当平均产物去复算）');
    const r3 = spawnSync(process.execPath, [SRC, '--packs=docs/artifacts/kept/e70-out__D02-31.bak,docs/artifacts/v17-146.bak',
      '--copy-cols=99', '--out=' + join(dir, 'bad.js')], { encoding: 'utf8', timeout: 120000 });
    eq(r3.status, 3, '⑬ 列号越界（99 ≥ FEAT_A=22）必须拒（exit 3），实测 ' + r3.status);
    const r4 = spawnSync(process.execPath, [SRC, '--packs=docs/artifacts/kept/e70-out__D02-31.bak,docs/artifacts/v17-146.bak',
      '--copy-cols=4', '--w=0.5,0.5', '--out=' + join(dir, 'bad2.js')], { encoding: 'utf8', timeout: 120000 });
    eq(r4.status, 64, '⑭ `--copy-cols` 与 `--w` 同时给必须 64（两种语义不许混），实测 ' + r4.status);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

t('D232 §E497 按卡出手谱 `tools/usage-probe.mjs`：三格手算自检必须绿 · 空名单与怪参数必须响 · 真包必须数得出东西 · 不许写 js/**', function () {
  /* 为什么值得一条门（METHODOLOGY 第 15 条）：这把尺是**为了回答一个具体问题现造的**
   *   （用户问"融合为什么让盾变多"，而 coords.tsv 里没有"狙击"也没有"防御类整体"，那问题在旧表上根本没法算）。
   *   新量具最坏的两件事：① 计数器接错事件 ⇒ 读数自洽但量的是别的东西；② 装配与训练侧不一致 ⇒ 跨枚比较没意义。
   *   所以自检钉的是"三格手算得出的极端口"（只ジ / 只防御 / 只狙击），不是"某枚包读数是几"。
   * ⚠ 开发期它已经红过一次，而且红的是判据自己：`row()` 提前 .toFixed() 成字符串 ⇒ `snipe === 0` 永远不成立，
   *    三格里两格 FAIL。那一红恰好证明这三格接的是生效值 —— 把这份自证搬进门禁。 */
  const SRC = 'tools/usage-probe.mjs';
  const src = readFileSync(SRC, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'e497-usage-'));
  try {
    const r = spawnSync(process.execPath, [SRC, '--self-test'], { encoding: 'utf8', timeout: 300000 });
    eq(r.status, 0, '① `--self-test` 必须整批绿（exit 0）：\n' + String(r.stdout || '').slice(0, 500) + String(r.stderr || '').slice(0, 300));
    const ticks = (String(r.stdout || '').match(/^ {2}ok {3}/gm) || []).length;
    ok(ticks >= 3, '① 三格手算期望都要过（实测 ' + ticks + ' 条）—— 只 exit 0 不算，被吞掉的断言照样绿');
    const b1 = spawnSync(process.execPath, [SRC, '--nonsense=1'], { encoding: 'utf8', timeout: 60000 });
    eq(b1.status, 64, '② 不认识的参数必须 64（仓规 v1.5.234），实测 ' + b1.status);
    const b2 = spawnSync(process.execPath, [SRC, '--ids=__查无此枚__'], { encoding: 'utf8', timeout: 120000 });
    eq(b2.status, 2, '③ 名单空到一枚都没有 ⇒ 必须 2（"空跑要响亮失败"），实测 ' + b2.status);
    /* ④ 真包必须数得出东西：接错事件的那一种坏法是三格自检看不见的（脚本 chooser 与策略 chooser 走的路径不同）*/
    const outF = join(dir, 'u.tsv');
    const rr = spawnSync(process.execPath, [SRC, '--ids=SHIPPED-Ldemo', '--games=10', '--out=' + outF], { encoding: 'utf8', timeout: 300000 });
    eq(rr.status, 0, '④ 跑一枚真包必须成功：\n' + String(rr.stderr || rr.stdout).slice(-400));
    const lines = existsSync(outF) ? readFileSync(outF, 'utf8').trim().split('\n') : [];
    ok(lines.length >= 2, '④ 落盘必须有一行读数（实测 ' + lines.length + ' 行）');
    const hd = lines[0].split('\t'), rowv = Object.fromEntries(hd.map((c, i) => [c, lines[1].split('\t')[i]]));
    ok(Number(rowv.acts) > 0 && Number(rowv.rounds) > 0, '④ 出手数与回合数都必须 > 0（=0 ⇒ 计数器没接到 action 事件，这台尺是死的）');
    ok(isFinite(Number(rowv.snipe)) && isFinite(Number(rowv.defense)) && Number(rowv.defense) >= 0,
      '④ 狙击/防御类两栏都必须是有限非负数（实测 snipe=' + rowv.snipe + ' defense=' + rowv.defense + '）');
    ok(!/writeFileSync\([\s\S]{0,40}'js\//.test(src), '⑤ 不许往 js/** 写');
    ok(/from '\.\/audit-lib\.mjs'/.test(src) && /loadChamp/.test(src),
      '⑥ 读包/装配必须走 audit-lib 这一份（不许自己再写一套引擎装载 —— 那就会与训练侧口径分叉）');
    /* ⑦ §2026-10-09：`--out=` 的解析必须是"**绝对路径按原样、相对路径落 champion-map**"。
     *   病（CI 连红 12 笔的唯一一条门）：原先用 Windows 盘符正则判绝对路径 ⇒ ubuntu 上
     *   `--out=/tmp/e497-usage-XXXX/u.tsv` 不命中 ⇒ 被拼进仓库 ⇒ 那层目录不存在 ⇒ ENOENT ⇒ 子进程 exit 1。
     *   为什么这一条不打在 ④ 上：④ 是行为腿，Windows 传进去的 `C:\…` **恰好命中盘符正则** ⇒ 本机结构上看不见；
     *   而这一条喂的是**纯字符串**（不碰盘、不建目录）⇒ **Windows 与 ubuntu 上都真判**，
     *   且旧实现在 Windows 上也会红（`/tmp/…` 同样不命中盘符）⇒ 它抓得住回归，不是摆设。
     *   按整改建议的规矩 1（门禁只许测行为）：原先这里是对 `usage-probe.mjs` 做源码正则，已改成打纯函数。 */
  const ROOTX = process.cwd();
  const ABS_NATIVE = join(tmpdir(), '__e558_never_created__', 'u.tsv');
  eq(resolveOutPath(ABS_NATIVE, ROOTX, 'champion-map'), ABS_NATIVE,
    '⑦a 当前平台的绝对路径必须**按原样**返回（拼进仓库就是 CI 那一支）');
  const POSIXY = '/tmp/e497-usage-XXXXXX/u.tsv';
  const rPosix = resolveOutPath(POSIXY, ROOTX, 'champion-map');
  ok(!rPosix.startsWith(ROOTX), '⑦b POSIX 形状不许被拼进仓库（旧盘符正则在两台上都会走到这一支）got=' + rPosix);
  eq(rPosix.replace(/\\/g, '/'), POSIXY, '⑦b 该返回的就是这个字符串本身');
  eq(resolveOutPath('usage.tsv', ROOTX, 'champion-map'), join(ROOTX, 'champion-map', 'usage.tsv'),
    '⑦c 相对 `--out=` 必须落在 champion-map 下（默认值行为一字没变）');
  let threw = false; try { resolveOutPath('   ', ROOTX, 'champion-map'); } catch (e) { threw = true; }
  ok(threw, '⑦d 空 `--out=` 必须响亮失败（不许悄悄退回默认文件名去覆盖在册表）');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

}

