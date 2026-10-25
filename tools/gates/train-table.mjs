/*#np-part-header
{"file":"tools/gates/train-table.mjs","part":"train-table","group":"train","ranges":[[1207,1597],[2404,2415],[2485,2591],[4758,4780],[5315,5332],[6764,6945],[9266,9305]],"gates":[1207,1388,2404,2485,2499,2547,4758,5315,6764,6872,9266],"patched":[]}
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
export const ords = [1207, 1388, 2404, 2485, 2499, 2547, 4758, 5315, 6764, 6872, 9266];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D220 深经济对手必须能放上**训练桌**（v1.5.325 · §E237 · DS 交接 (W) 假设的可执行版本）：`EPIRUS_ECON_OPPS` 默认关 + 名字不认识必须响 + 开档产物自证', function () {
  /* 病（读出来的）：训练时那 9 条 `OPPS` 里没有 `deepsaver` —— `farmer` 只攒不还手、`heavyfire` ep≤2（贵卡分支永不触发），
   *   而"会攒到 5 珠并且真花出去"的脚本**只活在考卷里**（`eval-5p` 文件头明写池子含 deepsaver）
   *   ⇒ 训练世界里"攒钱"既没有回报来源也没有威胁来源 ⇒ DS 的 (W)/(R) 分叉以前**根本跑不了**。
   * 纪律与 D130/§E127 的 `counter-ops`/`ring-ops` 逐字同形：默认关 ⇒ `OPPS` 一字不变；要的对手不存在 ⇒ `exit 4`。 */
  ok(Bots && typeof Bots.pickDeepSaver === 'function' && typeof Bots.pickDeadlineBurst === 'function' &&
    typeof Bots.pickEarlyPressure === 'function',
    '三枚深经济脚本必须真在 `EpirusBots` 里（不在就是 train-3p 引用了不存在的名字）');
  /* ① 行为：`deepsaver` 值钱就值钱在"**攒得到、并且真兑现**"——把它改成随手花 = 量具自己没了 */
  const mk = ep => { const s = S.createState('multi', { next: mulberry32(11) }, 5); s.p[0].ep = ep; return s; };
  const poor = mk(1), poorLegal = Play.legalActions(poor, 0).filter(x => x.affordable);
  ok(poorLegal.some(x => x.key === R.SK.BIG_T) === false, '构造态：1 珠时大雷必须**不可负担**（否则"攒"这条空转）');
  const p1 = Bots.pickDeepSaver(poor, 0, poorLegal);
  ok(p1 && (p1.key === R.SK.JI || p1.key === R.SK.CHARGE), '付不起大雷时必须攒（实测出 ' + (p1 && p1.key) + '）');
  const rich = mk(9), richLegal = Play.legalActions(rich, 0).filter(x => x.affordable);
  ok(richLegal.some(x => x.key === R.SK.BIG_T) === true, '构造态：9 珠时大雷必须可负担（否则"兑现"这条空转）');
  eq(Bots.pickDeepSaver(rich, 0, richLegal).key, R.SK.BIG_T, '付得起就必须放大雷 ⇒ 这才叫"真兑现"的威胁来源');
  /* ② 接线：默认关 ⇒ 走的是空串；开了 ⇒ 真推进 fitness 的对手表，并且**产物自带这臂上了谁**。
   * §改（2026-10-22 千问·第六批）：这里原来四条是 `train-3p.mjs` 的写法钉
   *   （`EPIRUS_ECON_OPPS || ''` ‖ `'EPIRUS_ECON_OPPS'` 在 SELF_ENV_KEYS 里 ‖ "不认识的名字…exit(4)" 的正则窗 ‖
   *    `for (const o of ECON_OPPS) OPPS.push(o)` 逐字）。下面 ②③④ 三档**真起子进程**各测一件：
   *   开档必须 status 0 + 印出桌变大 + recipe 记两名 ‖ 写错名必须 exit 4 ‖ 关档必须一行不印 + recipe 写 null。
   *   ⇒ 四次变异逐条判过（见 `docs/research/GATE-AUDIT-2026-10-22-qoder.md` §二 13)）：把默认值改成非空 / 把 exit(4) 改成静默跳过 /
   *   把 push 改成推进别处 —— 三种写坏**都被行为腿抓到**，而第四条（SELF_ENV_KEYS）连"读不到"那一支也被
   *   `train-3p` 自己的 `enforceKnobs` 拦住（键设了却没人读 ⇒ 非零退出 ⇒ ② 的 status 0 当场红）⇒ 四条一起摘。 */
  const dir = mkdtempSync(join(tmpdir(), 'd220-')), out = join(dir, 'arm.js');
  const on = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd220on', EPIRUS_ECON_OPPS: 'deepsaver,deadlineBurst', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: out, EPIRUS_PUBLISH: '' }), encoding: 'utf8', timeout: 300000 });
  eq(on.status, 0, '开了要跑得通（实测 status=' + on.status + ' · ' + String(on.stdout || '').slice(-160) + '）');
  ok(/\[econ-ops\] .*已进训练桌：econ:deepSaver,econ:deadlineBurst.*OPPS 从 9 个变 11 个/.test(String(on.stdout || '')),
    '必须印出进了哪几个、桌变大（不印 = 又一根暗旋钮）');
  const mt = packMetaOf(out);
  ok(!!mt, '产物要能读出 META（读不出就是这条门自己瞎了）');
  ok(mt.recipe && Array.isArray(mt.recipe.econOpps) && mt.recipe.econOpps.length === 2,
    '产物要自带"这臂的训练桌上放了哪几个深经济对手"（实测 ' + JSON.stringify(mt.recipe && mt.recipe.econOpps) + '）');
  /* ③ 反面：写错名字必须**当场响**，不许静默少放一个对手（这正是本仓烧过三臂的那一族） */
  const bad = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd220bad', EPIRUS_ECON_OPPS: 'deepsaver,nosuchbot', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: out }), encoding: 'utf8', timeout: 120000 });
  eq(bad.status, 4, '不认识的卡名必须 exit 4（实测 ' + bad.status + '）');
  /* ④ 关档：不设这个键时**一行都不许印**（"开了没生效"与"没开却在讲话"都是假信号） */
  const off = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '4', '3'],
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd220off', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: out, EPIRUS_PUBLISH: '' }), encoding: 'utf8', timeout: 300000 });
  eq(off.status, 0, '关档要跑得通');
  ok(String(off.stdout || '').indexOf('[econ-ops]') < 0, '关档不许印 econ-ops（印了 = 默认分布被悄悄改了）');
  const mtOff = packMetaOf(out);
  ok(mtOff.recipe && mtOff.recipe.econOpps === null, '关档产物的 recipe 必须写 null（实测 ' + JSON.stringify(mtOff.recipe && mtOff.recipe.econOpps) + '）');
});

t('D223 §E262/§E266 探索提前（大雷 `--bigttgt=` 挑人 ‖ 摄魂 `--pushkey=drain`）（v1.5.329~330）：选点纯函数喂合成表 · 默认关逐字不变 · 生效由**独立 usage 计数**判 · 剂量必须 ≈1/N 且单调 · 坏输入必须 exit 2 · 落盘带四维', function () {
  /* ⓪ **先钉纯函数**（第十九条的教训：只跑真臂的话，"打谁"这件事在小样本里可能一次都不分 ⇒ 永绿装饰）。
   *    今天写第一版时比较号整体写反 ⇒ **四条规则全部选中"最不该打的那个人"**，而返回的是合法座位号，真局里根本看不出来。
   *    合成表就是为这种错准备的（每格都指定期望席位）。 */
  const st = { p: [{ hp: 3, ep: 0 }, { hp: 3, ep: 2, elec: 1 }, { hp: 1, ep: 4 }, { hp: 3, ep: 1 }, { hp: 2, ep: 4 }] };
  st.p[1].tauntBy = [3]; st.p[2].tauntBy = [3]; st.p[4].tauntBy = [1];
  const POOL = [1, 2, 3, 4];
  const pick = function (rule) { const g = pushTarget(POOL, st, rule); return g ? g.target : null; };
  eq(pick('net'), null, '⓪a `net` 必须返回 null（= 交回引擎默认选点），不许自己造一个');
  eq(pick('threat'), 2, '⓪b `threat`（ep 最高，平手取血少）⇒ 必须选席位 2（ep4/hp1，压过 4 号 ep4/hp2）');
  eq(pick('bead'), 1, '⓪c `bead`（有珠的人 = 会打环那位）⇒ 必须选席位 1（唯一 elec=1）');
  eq(pick('lowhp'), 2, '⓪d `lowhp`（血最少 = 被集火过/最容易减员）⇒ 必须选席位 2（hp1）');
  eq(pick('focus'), 3, '⓪e `focus`（被最多家 `tauntBy` 盯着）⇒ 必须选席位 3（两家盯它）');
  /* 平手必须按**座位号小的先**（不做随机、不做遍历序偏向） */
  const st2 = { p: [{ hp: 3, ep: 0 }, { hp: 2, ep: 2 }, { hp: 2, ep: 2 }] };
  eq(pushTarget([1, 2], st2, 'threat').target, 1, '⓪f 全判据平手 ⇒ 必须取座位号小的（实测 ' + pushTarget([1, 2], st2, 'threat').target + '）');
  eq(pushTarget([1, 2], st2, 'threat').tie, 2, '⓪g 平手数必须回显（tie 要能被读数，否则"平手偏向"这条假设看不见）');
  eq(pushTarget([], st, 'threat'), null, '⓪h 空池 ⇒ null（不许返回 undefined 让调用方拿去当座位号）');
  let threwRule = false;
  try { pushTarget(POOL, st, 'nonsense'); } catch (e) { threwRule = true; }
  ok(threwRule, '⓪i 不认识的规则必须**抛**（静默退回默认选点 = 我给用户的"目标规则"其实是假的）');

  /* ①~③ 真跑：默认关 ⇒ 逐字不变；开档 ⇒ 由**另一条代码路径**（champ.use 的 usage 表）证明它真打了这张卡 */
  const src = readFileSync('tools/eval-5p.mjs', 'utf8');
  ok(src.indexOf('FLAG.bigtpush') >= 0 && src.indexOf('pushTarget(') >= 0,
    '① `eval-5p` 里没有 `FLAG.bigtpush` 或没在用 `pushTarget` ⇒ 旗标被删了而记账还写着有');
  /* §E275：多剥一族 banner —— `[shipbigt]` 现在每臂都印（默认档也要回读打印），不剥就会把"两种关法"的差当成判定之差。
   * §E284：再多剥 `[shipdrain` 一族 —— v1.6.4 起摄魂档默认开着 ⇒ **贪心臂会自述一行"这一档在 ε=0 下永不触发"**，
   *   那是横幅不是判定（正因为它是横幅，"两种关法逐字相同"这条 ③d 才仍成立；不剥就等于让一句解释性文本去改变门的结果）。 */
  const strip = function (s) { return s.split('\n').filter(function (l) {
    return l.indexOf('[bigtpush]') !== 0 && l.indexOf('[提前自检]') !== 0 && l.indexOf('[shipbigt') !== 0 && l.indexOf('[shipdrain') !== 0 && l.indexOf('耗时') !== 0;
  }).join('\n'); };
  const runE = function (extra) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '12', '5', '77000', '--field=guardwall'].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  /* §E275：v1.5.333 起大雷档是**引擎默认**，而带 `--bigtpush` 的臂会被工具自动顶回 0 ⇒
   *   基线必须**显式 `--shipbigt=0`**（否则这格比的是"默认开着"与"顶回 0"两个世界，实测 np 就是这么红的）。
   *   判的东西没变：`--bigtpush=0` 这根键在"零剂量"时动不动判定。 */
  const base = runE(['--shipbigt=0']);
  eq(base.code, 0, '⓪z 默认臂必须跑通：' + base.out.slice(0, 180));
  ok(base.out.indexOf('bigtpush') < 0 && base.out.indexOf('提前自检') < 0, '② 关档一行都不许印（印了就是产品口径的量具上多了一条静默分支）');

  /* ③ 零剂量：`--bigtpush=0`（明确关档）与显式关掉引擎档的基线 ⇒ 去掉墙钟/banner 后**逐字相同** */
  const off0 = runE(['--bigtpush=0']);
  eq(off0.code, 0, '③a `--bigtpush=0` 不该报错：' + off0.out.slice(0, 180));
  eq(strip(off0.out), strip(base.out), '③b `--bigtpush=0` 必须与"显式关掉大雷上线档"的基线逐字相同（不同 ⇒ 这根键在关档时也动了判定）');

  /* ④ 真生效（独立证据 = usage 表，由 `champ.use` 从事件里数，不是我印的计数）。
   *    夹具把门槛/价格一起降到 1 是为了**让窗口必开**（`guardwall` 场里 12 局能不能攒到 5 ep 不由我赌）；
   *    这不是对真实世界的断言，只是证明"提前 + 选点 + 出手"这条链通。 */
  const on = runE(['--bigtcost=1', '--pushminep=1', '--bigtpush=1', '--bigttgt=threat']);
  eq(on.code, 0, '④a 开档臂必须跑通：' + on.out.slice(0, 200));
  ok(on.out.indexOf('[bigtpush]') >= 0 && on.out.indexOf('[提前自检]') >= 0, '④b 开档必须响亮印 banner + 自检行');
  const usage = /真正的落雷\s+([0-9.]+)%/.exec(on.out);
  ok(!!usage && Number(usage[1]) > 0,
    '④c **独立证据**：usage 表里"真正的落雷"必须 >0%（实测 ' + (usage ? usage[1] + '%' : '没有这一行')
    + '）⇒ 没有它就说明"提前"这段代码没真打到卡');
  ok(/OK 实验有效/.test(on.out), '④d 自检行必须报"OK 实验有效"（窗口开了却一次没打 = 计数或可付判定失效）');

  /* ④e~④h **剂量必须真的是 1/N**（这两条腿换来本班自我报告 #9：
   *      第一版按"局内第几个窗口"数 ⇒ 每局窗口常常只有 1~2 个，1/3 退化成像 1/1，三档用量只差 1.2 倍，我差点把"剂量响应是平的"写成结论；
   *      第二版改成 `round % N` ⇒ **非单调**（实测 p=2 兑现率 100%、p=3 30.4%、p=4 47.8%），因为窗口本身集中在特定回合上。
   *      现在是"每局盐 + 回合 + 座位"的确定性 1/N 抽样（不碰 `state.rng`、不依赖臂序）。 */
  const rateOf = function (txt) { const m = /打出去 (\d+) 次（兑现率 ([0-9.]+)%/.exec(txt); return m ? Number(m[2]) : NaN; };
  const fx = ['--bigtcost=1', '--pushminep=1', '--bigttgt=net'];
  /* ⚠ 剂量梯必须在**真池子的小样本**上量，不在 `--field=` 单场上量：本班第三版散列在 guardwall 上测出干净的
   *    100.0 / 50.0 / 32.2 / 15.9%，可真考卷上 p=2 只比 p=1 少 7% 出手 ⇒ **夹具形状不像使用场景 = 门是假的**（§E265 #9）。 */
  const runP = function (extra) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '4', '5', '77000', '--pool=all', '--every=64'].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  const r1 = runP(['--bigtpush=1'].concat(fx)), r2 = runP(['--bigtpush=2'].concat(fx));
  const r3 = runP(['--bigtpush=3'].concat(fx)), r6 = runP(['--bigtpush=6'].concat(fx));
  const q1 = rateOf(r1.out), q2 = rateOf(r2.out), q3 = rateOf(r3.out), q6 = rateOf(r6.out);
  ok([q1, q2, q3, q6].every(function (x) { return isFinite(x); }),
    '④e 四档都要能读出兑现率（实测 ' + [q1, q2, q3, q6].join(' ‖ ') + '）⇒ 读不出就是自检行格式/跑通性坏了');
  ok(q1 > 95 && q1 <= 100, '④f `p=1` 的兑现率必须≈100%（实测 ' + q1 + '）⇒ 窗口开了不打就是计数失效');
  ok(q2 > 33 && q2 < 67, '④g `p=2` 必须落在 1/2 附近（真池样本实测兑现率 ' + q2 + '%）⇒ 不在就是散列没打散（本班踩过两版）');
  ok(q3 > 20 && q3 < 47 && q6 > 8 && q6 < 32, '④h `p=3`/`p=6` 必须各自落在 1/3、1/6 附近（实测 ' + q3 + '% ‖ ' + q6 + '%）');
  ok(q6 < q3 && q3 < q2 && q2 < q1, '④i 剂量必须**严格单调**（实测 ' + q1 + ' → ' + q2 + ' → ' + q3 + ' → ' + q6 + '）');
  /* 出手量也必须随档下降（兑现率是"窗口的比例"，用量才是真剂量） */
  const useOf = function (txt) { const m = /真正的落雷\s+([0-9.]+)%/.exec(txt); return m ? Number(m[1]) : NaN; };
  const u1 = useOf(r1.out), u6 = useOf(r6.out);
  ok(isFinite(u1) && isFinite(u6) && u6 < u1, '④j 用量必须随档下降（实测 p=1 占总出手 ' + u1 + '% ‖ p=6 ' + u6 + '%）');

  /* §E264② 同一套形状搬到摄魂指法（`--pushkey=drain`）⇒ 三件必须成立的事：
   *    ③d **只给卡名、不给剂量**必须逐字等于关档（卡名不许单独动判定）；
   *    ⑥b 它真能打出这张卡，且**窗口/局 > 0**（S1：这张牌的窗口是"自己残血 ∧ 买得起"，必须先证明窗口开着，不许假设）；
   *    ⑥d 剂量梯对这张卡同样成立（p=1 ≈100% ⇒ p=3 ≈1/3），否则"偶尔"这个字对摄魂又是一根假轴（自我报告 #9 同一族）。 */
  const offK = runE(['--bigtpush=0', '--pushkey=drain']);
  eq(offK.code, 0, '③c `--pushkey=drain --bigtpush=0` 不该报错：' + offK.out.slice(0, 180));
  eq(strip(offK.out), strip(base.out), '③d 只改卡名不改剂量必须与关档逐字相同（不同 ⇒ `--pushkey` 在零剂量时也进了判定）');
  const dP = function (push) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '6', '5', '77000', '--pool=all', '--every=48',
      '--pushkey=drain', '--pushminep=0', '--bigtpush=' + push],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  const d1 = dP(1), d3 = dP(3);
  eq(d1.code, 0, '⑥a 摄魂开档臂必须跑通：' + d1.out.slice(0, 200));
  const dUsage = /摄魂指法\s+([0-9.]+)%/.exec(d1.out);
  const dWin = /= ([0-9.]+) 个\/局（/.exec(d1.out);
  ok(!!dUsage && Number(dUsage[1]) > 0,
    '⑥b **独立证据**：usage 表里"摄魂指法"必须 >0%（实测 ' + (dUsage ? dUsage[1] + '%' : '没有这一行') + '）⇒ 没有它就说明提前这段代码对这张卡没打到');
  ok(!!dWin && Number(dWin[1]) > 0,
    '⑥c **S1 窗口必须 >0 个/局**（实测 ' + (dWin ? dWin[1] : '读不出') + '）⇒ 读不出或为 0 时只能记"没测到东西"，不许记"无效"（§E264 S1）');
  const dq1 = rateOf(d1.out), dq3 = rateOf(d3.out);
  ok(isFinite(dq1) && isFinite(dq3) && dq1 > 95 && dq3 > 20 && dq3 < 47 && dq3 < dq1,
    '⑥d 摄魂的剂量梯必须同样是 1/N 且单调（实测 p=1 ' + dq1 + '% → p=3 ' + dq3 + '%）⇒ 不在就是这张卡的轴也是假的');
  ok(/探索提前·摄魂指法/.test(d1.out), '⑥e 读数标签必须写明是哪张卡（两张卡的臂可以除卡名外全同 ⇒ 标签含糊就会串臂）');

  /* ⑤ 坏输入必须 exit 2，不许降级成"当没写" */
  const bads = [['--bigtpush=13'], ['--bigtpush=0.5'], ['--bigttgt=nonsense'], ['--bigttgt=nonsense', '--bigtpush=0'],
    ['--pushminep=x'], ['--bigtpush=1', '--ban=bigT'], ['--bigtpush=1', '--inject=bigT'],
    ['--pushkey=nonsense'], ['--pushkey=nonsense', '--bigtpush=0']];
  for (const b of bads) {
    const rb = runE(b);
    eq(rb.code, 2, '`' + b.join(' ') + '` 必须 exit 2（实测 ' + rb.code + '）⇒ 含糊/抢主体席的写法被静默忽略就是假臂');
  }
  /* ⑤m 边界的**另一侧**也要钉（千问 10-03 下午）：剂量上界从 6 抬到 12（用户要把"每 4~5 局一张大雷"那一档的价量出来，
   *    而 long 的窗口密度是 multi 的两倍 ⇒ 同一个 p=6 在 multi 是每 4.1 局、在 long 只到每 2.6 局）。
   *    ⇒ 原来拿 `--bigtpush=7` 当"必须拒"的正对照现在必须放行；而**只测"坏值被拒"的门会把合法区间一起杀掉还自称有牙**（§E190 那一族）。 */
  const okTop = runE(['--bigtpush=12']);
  eq(okTop.code, 0, '`--bigtpush=12`（新上界）必须放行（实测 exit ' + okTop.code + '）⇒ 拒掉合法档 = 这把尺根本量不到用户要的那一档');
  ok(/窗口（主体 `ep≥5`/.test(okTop.out), '⑤n `--bigtpush=12` 必须真的走到自检那一行（没走到 = 剂量被静默吞掉）');

  /* ⑤ 落盘身份两维（配对尺靠表头拒判，缺维就会把"每 1 次一打"与"每 3 次一打"配成同臂） */
  const dir = mkdtempSync(join(tmpdir(), 'd223-'));
  const dump = join(dir, 'h.tsv');
  const rd = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--pool=core', '--every=17',
    '--bigtpush=2', '--bigttgt=lowhp', '--dump-per=' + dump], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  eq(rd.status, 0, '⑤a 带 `--dump-per` 的提前臂必须跑通：' + String(rd.stderr || '').slice(0, 180));
  ok(existsSync(dump), '⑤b 必须真的落盘（没落盘 ⇒ 这条腿是装饰）');
  if (existsSync(dump)) {
    const headTxt = readFileSync(dump, 'utf8').split('\n').filter(function (l) { return l[0] === '#'; }).join('\n');
    ok(headTxt.indexOf('#bigtpush=2/5') >= 0, '⑤c 表头必须带 `#bigtpush=<N>/<门槛>`（实测=' + (/^#bigtpush=.*$/m.exec(headTxt) || ['(缺)'])[0] + '）');
    ok(headTxt.indexOf('#bigttgt=lowhp') >= 0, '⑤d 表头必须带 `#bigttgt=`（实测=' + (/^#bigttgt=.*$/m.exec(headTxt) || ['(缺)'])[0] + '）');
    /* §E264：卡名与摄魂窗口宽度也是**配对身份维** —— 大雷臂与摄魂臂可以除卡名外逐字相同，缺这一维就会配成同臂。 */
    ok(headTxt.indexOf('#pushkey=bigT') >= 0, '⑤e 表头必须带 `#pushkey=`（实测=' + (/^#pushkey=.*$/m.exec(headTxt) || ['(缺)'])[0] + '）');
    ok(/^#drainhp=[0-9]+$/m.test(headTxt), '⑤f 表头必须带 `#drainhp=<有效窗口>`（实测=' + (/^#drainhp=.*$/m.exec(headTxt) || ['(缺)'])[0] + '）⇒ `--drainhp=` 放宽窗口的臂就隐身了');
  }
  const dump2 = join(dir, 'h2.tsv');
  const rd2 = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--pool=core', '--every=17',
    '--pushkey=drain', '--pushminep=0', '--bigtpush=1', '--drainHp=2', '--dump-per=' + dump2], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  eq(rd2.status, 0, '⑤g 摄魂臂带 `--dump-per` 必须跑通：' + String(rd2.stderr || '').slice(0, 180));
  if (existsSync(dump2)) {
    const h2 = readFileSync(dump2, 'utf8').split('\n').filter(function (l) { return l[0] === '#'; }).join('\n');
    ok(h2.indexOf('#pushkey=drain') >= 0, '⑤h 表头必须写明提前的是哪张卡（实测=' + (/^#pushkey=.*$/m.exec(h2) || ['(缺)'])[0] + '）');
    ok(h2.indexOf('#drainhp=2') >= 0, '⑤i 表头必须回显**有效**窗口宽度而不是旗标原值（实测=' + (/^#drainhp=.*$/m.exec(h2) || ['(缺)'])[0] + '）');
  }
  /* ⑤j 大小写陷阱（自我报告 #11）：`--drainHp` 才是真键，`--drainhp` 会落进一个没人读的 FLAG 键 ⇒
   *    今天我把 S3 那两条臂写成小写，跑出来的其实是 p=3 的复制品 —— **静默失效的旗标比报错危险得多**，必须 exit 2。 */
  const wrongCase = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--pool=core', '--every=17', '--drainhp=3'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  eq(wrongCase.status, 2, '`--drainhp=3`（小写 h）必须 exit 2（实测 ' + wrongCase.status + '）⇒ 拼错的旗标被静默忽略 = 假臂');

  /* ===== ⑦ §E268（DS 2026-10-03）：`--pushrank` 的**惰性守卫**（这条腿是本条的真正目的） =====
   * ⚠️ 千问 10-03 复核时修的位置：DS 原来把这 13 行插在 D223 的收尾 `});` **外面** ⇒ 它们成了**模块顶层语句**，
   *    一旦某条不满足就是"未捕获异常直接掀掉整趟 np"（他报的"变异后输出为空、原因未定"就是这个），
   *    而 `--only=` 的过滤器也管不到它们 ⇒ 这六条**既不点名、也不受控**（本仓第一条"外挂在门外的门腿"）。
   *     now 移进 D223 体内：红了会点名是哪条腿，且与 `--only=D223` 一起跑。
   * 为什么必须有它：DS 第一版算子是"概率 ×倍数"，实测**抬高 63,004 次却一次都没改落点**
   * （dm=0.00±0.00、0/2925 张桌子有差、两份日志除墙钟外一字不差）——因为这张卡在菜单里但策略下概率≈0。
   * 没有这条腿，"提顺位"可以永远绿着却什么都不做（与 D218 登记腿空转、D221 永绿装饰同一族）。 */
  const evSrc = readFileSync('tools/eval-5p.mjs', 'utf8');
  ok(/const rankSel = !RANK \? null :/.test(evSrc), '⑦a 关档必须**不构造**包装器（`!RANK ? null :`）⇒ 结构上保证关档不动任何行为（行为面的逐字等价由 §E268 的剥墙钟 diff 实测：同一份输入新旧两树输出逐字相同）');
  ok(evSrc.indexOf('Math.max(f.probs[i], pFloor)') >= 0, '⑦b 算子必须是**概率下界**（`Math.max(f.probs[i], pFloor)`）—— `×倍数` 是可证明惰性的（×2 个 ≈0 仍是 ≈0）');
  ok(evSrc.indexOf('真搬动的概率质量') >= 0, '⑦c 自检必须印**真搬动的概率质量**（0 = 算子惰性）⇒ 没有这一栏，惰性算子查不出来（实测已印：14.6K/25.6K/39.3K）');
  ok(evSrc.indexOf("process.on('exit'") >= 0 && evSrc.indexOf('[pushrank 自检]') >= 0,
    '⑦d 自检必须**无条件**印 ⇒ 走 process 出口钩子（DS 第一版被 `if (PUSH)` 吞掉、第二版被 `if (FLAG["dump-per"])` 吞掉，两次都是"静默的量具"）');
  ok(/'#pushkey=' \+ \(\(PUSH \|\| RANK\) \? PUSHKEY : '-'\)/.test(evSrc),
    '⑦e 提顺位臂的**卡名也必须落盘**（`(PUSH||RANK)`）⇒ 否则它与出厂那份落盘逐字相同，下一个人读不出这臂动的是哪张卡');
  ok(evSrc.indexOf("'#pushfloor=' + (RANK ?") >= 0, '⑦f `#pushfloor` 必须进落盘身份（v1.6.0 正名后；配对尺的抽取式已同步改名 —— 写侧读侧一起改）');

  /* ===== ⑦g/⑦h 千问 10-03 复核时补的**行为面**腿（⑦a~⑦f 全是静态钉钉，会被"换个写法"绕过；更要紧的是它们钉不到"闸其实没关"）=====
   * 起因：DS 那批剂量曲线用的是 `--pushrank=1,1,top2,<share>`，而 margin 比的是"一选与二选的**概率差**"（上界就是 1）
   *   ⇒ **margin=1 = 闸永远开**（他的自检自己印出来了："落在闸内的 3,102,882 个（100.0%）"）
   *   ⇒ 所以那条曲线量的是"凡这张牌可付就把概率下限抬到一选的 X%"，**用户更正的后半句"只在一二选差距不大、有随机性的地方加"没被测到**。
   *   这两条腿把"闸会关"变成可执行的断言，并把"margin=1 就是没有闸"这件事写进判据里，下一个人不会再看错。 */
  const rkRun = function (margin) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '2', '5', '77000', '--pool=all', '--every=64',
      '--pushkey=drain', '--pushminep=0', '--pushrank=' + margin + ',1,top2,0.6'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  const ratioOf = function (txt) { const m = /落在闸内的 \d+ 个（([0-9.]+)%）/.exec(txt); return m ? Number(m[1]) : NaN; };
  const raisedOf = function (txt) { const m = /真抬高 (\d+) 次/.exec(txt); return m ? Number(m[1]) : NaN; };
  const rkOpen = rkRun(1), rkShut = rkRun(0.1);
  eq(rkOpen.code, 0, '⑦g0 `margin=1` 臂必须跑通：' + rkOpen.out.slice(0, 160));
  eq(rkShut.code, 0, '⑦g1 `margin=0.1` 臂必须跑通：' + rkShut.out.slice(0, 160));
  const o1 = ratioOf(rkOpen.out), o2 = ratioOf(rkShut.out);
  ok(isFinite(o1) && isFinite(o2), '⑦g2 自检必须印"落在闸内的比例"（实测 ' + o1 + ' ‖ ' + o2 + '）⇒ 读不出这一栏，"闸"就没有可验证的口径');
  ok(o1 > 99.5, '⑦g3 **写进判据的事实**：`margin=1` 时闸必须显示为"几乎永远开"（实测 ' + o1 + '%）⇒ 谁把 `--pushrank=1,…` 读成"有闸的软提顺位"，这条会先替他红');
  ok(o2 < o1 - 20, '⑦g4 收紧 margin 必须**真的关掉闸**（margin=1 ⇒ ' + o1 + '% ‖ margin=0.1 ⇒ ' + o2 + '%）⇒ 关不掉就是闸没接进判定（永绿装饰，与 D218/D221 同族）');
  ok(raisedOf(rkShut.out) > 0, '⑦g5 关掉大半闸之后仍必须抬得动（实测真抬高 ' + raisedOf(rkShut.out) + ' 次）⇒ 0 = 这一档在真闸下是空操作，读数不可引');
  ok(/提顺位·摄魂指法/.test(rkShut.out),
    '⑦h stdout 必须写明这是**提顺位臂 + 哪张卡**（实测标签=' + (/^\[([^\]]*1st=)/m.exec(rkShut.out) || ['(无)'])[0] + '）⇒ 顶着"冠军"两字会让人把处理臂当出厂读数');
  /* ⑦k 千问 10-03 复核补的**数值腿**（⑦c 只钉了"这一栏存在"，而存在≠非零）：
   *   把 `pFloor` 悄悄乘个 0，算子就退回惰性，但 ⑦a/⑦b/⑦c 三条静态钉**全部照绿**（字符串还在、fired 还在计数）。
   *   ⇒ 惰性守卫必须钉"真搬动的概率质量 > 0"这个**数**，否则它守的是代码的形状，不是代码的作用。 */
  const movedOf = function (txt) { const m = /真搬动的概率质量 ([0-9.]+)/.exec(txt); return m ? Number(m[1]) : NaN; };
  const mvOpen = movedOf(rkOpen.out), mvShut = movedOf(rkShut.out);
  ok(isFinite(mvOpen) && isFinite(mvShut), '⑦k0 自检必须印"真搬动的概率质量"这个**数**（实测 ' + mvOpen + ' ‖ ' + mvShut + '）');
  ok(mvOpen > 0 && mvShut > 0,
    '⑦k1 两档 margin 的**搬动量都必须 > 0**（实测 margin=1 ⇒ ' + mvOpen + ' ‖ margin=0.1 ⇒ ' + mvShut + '）⇒ 印了这栏却是 0，就是"抬了名次、没搬概率"的惰性算子（DS 的 v1 实测 63,004 次抬名次、对局逐位相同）');
});

t('D7 对手池必须单一来源（server/worker 不得各写一份名单）', function () {
  /* v1.4.9：这类"两处各写一遍"的漂移已经静默坑过两次 ——
   * v1.3.59 只补了 worker、v1.4.8 只补了 server（后者让"13 对手"的臂实际只跑 12 个，
   * 告警又只写进隐藏 server 的 stderr ⇒ 我直到发现"两个不同臂的考卷逐位相同"才察觉）。 */
  const w = readFileSync('server/train-worker.mjs', 'utf8');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(w.indexOf("from './opp-pool.mjs'") >= 0, 'worker 必须从 opp-pool.mjs 导入池子');
  ok(sv.indexOf("from './opp-pool.mjs'") >= 0, 'server 必须从 opp-pool.mjs 导入池子');
  ok(!/const OPP_POOL = \[\s*[\r\n]*\s*\{ name:/.test(w), 'worker 不得自己再写一份字面量池子');
  ok(!/const BOT_FN_N = \{/.test(sv), 'server 不得自己再写一份字面量名单');
});

t('D11 训练模式必须随消息下发到 worker（并行路径不是同一个沙箱）', function () {
  /* v1.5.0 实测事故（我自己踩的）：`T.setTrainMode` 只改**本线程**的模块状态，而训练打分跑在
   * worker 线程里、各自是独立沙箱 ⇒ 只在服务端设 = 进化照旧 3 血、只有服务端终局评估 5 血。
   * 症状是"整条 best 曲线与 multi 轮逐位相同"—— 不看这一点会以为实验跑通了。
   * D10 抓不到它（D10 测的是**进程内**的 scoreMemberN）。故补这条贯通性检查。 */
  const pt = readFileSync('server/paralleltrain.mjs', 'utf8');
  ok(/type: 'evalN'[\s\S]{0,300}?mode:/.test(pt), "paralleltrain 的 evalN 消息必须带 mode（否则 worker 收不到）");
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('setTrainMode(msg.mode') >= 0, 'worker 必须按消息里的 mode 调 setTrainMode');
  ok(wk.indexOf('modeUsed') >= 0, 'worker 必须回报 modeUsed 回执');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf('modeUsed') >= 0, 'server 必须校验 worker 的 modeUsed 回执并响亮中止');
});

t('D12 冠军对手（champ:）机制必须两端都通 + 能真的解出 params', function () {
  /* v1.5.2：训练池要能放「风格化冠军」当靶子（脚本对手打不出成体系的策略）。
   * 这类"两处各写一遍"的机制只要漏一端就静默取子集（v1.4.8 踩过），所以两端都要点名；
   * 而且**功能上**必须真能解包 —— 这里用在册夹具 `FIXTURE_PACK`（10-17 前用的是活槽，账见日志 DONE-16 那一节）。 */
  ok(isChampOpp('champ:docs/artifacts/champion-5p-armB12f.bak'), 'champ: 前缀必须被识别');
  ok(!isChampOpp('heavyfire'), '普通脚本名不得被当成冠军对手');
  const params = loadChampParams(Pol, FIXTURE_PACK);   /* ⚑ 10-17 夜班（R3）：活槽 → 在册夹具。这条腿判的是"能解包 + 解出来的 chooser 与直接走 policyChooserN 逐场相同"，主语是解析路径不是线上那枚 */
  ok(params && params.length > 0, 'loadChampParams 必须能从在库冠军包解出 params（实测 length=' + (params && params.length) + '）');
  /* 反向：拿一个不是冠军包的文件去解，必须**响亮抛错**，不能静默返回半个东西 */
  let threw = false;
  try { loadChampParams(Pol, 'js/core/rules.js'); } catch (e) { threw = true; }
  ok(threw, '非冠军包文件必须抛错（否则会把 undefined 当对手，训练中途才炸）');
  const pt = readFileSync('server/train-server.mjs', 'utf8');
  ok(pt.indexOf('isChampOpp') >= 0, 'server 的对手名校验必须认识 champ:（否则开跑前就被当未知名字中止）');
  ok(pt.indexOf('makeOppSelResolver') >= 0, 'server 必须走**统一解析器** makeOppSelResolver');
  /* ★ 这条是本轮真正的教训（v1.5.2 我踩了第三次）：加对手名时**又漏了一处** ——
   * 终局评估那段自己写了一遍 `B[BOT_FN_N[nm]]`，对 champ: 名字给出 undefined，
   * 于是训练跑到名人堂评估才炸成 `sel is not a function`（前几代轮换只覆盖脚本下标，看不见）。
   * 所以要求 train-server 里**不再存在裸的 B[BOT_FN_N[...] 映射** —— 名字→函数只能有一个入口。 */
  ok(pt.indexOf('B[BOT_FN_N[') < 0, "train-server 不得再有裸的 B[BOT_FN_N[nm]] 映射（'加名字漏一处'就是这个形状）");
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('makeOppSelResolver') >= 0, 'worker 必须用**同一个**解析器（函数无法跨线程传，但规则只有一份）');
  ok(wk.indexOf('resolveOpp') >= 0, 'worker 必须按 msg.oppNames 的**原顺序**逐个解析（顺序变了就是另一场实验）');
  /* §E566（千问 · 把 D12 摘掉的那条名字钉换成行为判据）：解析出来的冠军对手 chooser 必须**就是页面那条推理路径**。
   *   原腿钉的是「`opp-champs.mjs` 里出现 `policyChooserN` 这个串」⇒ 改名不改行为（§八 口径 1 第二层：只读源码文本的腿没有阻断力），
   *   而真正要守的是它的反面：**换成别的 chooser / 别的 temp，训练池里那颗"冠军"就不再是页面上玩家遇到的那颗冠军**
   *   （v1.5.2 那族病是"名字→函数写两处"，形状上 D12 已经用 `B[BOT_FN_N[` 那条负钉守着；这条补的是"走错了推理路径"那一半）。
   *   判据照 D56 的 `eq(B, A)` 形状：同一份权重，走解析器 vs 直接 `policyChooserN` ⇒ 三场**逐场结果必须相同**。 */
  const champResolved = makeChampOppResolver({ EpirusPolicy: Pol, EpirusTrainer: T }, process.cwd(), 0.15)('champ:' + FIXTURE_PACK);
  const gamesOf = function (sel) {
    const out = [];
    for (let k = 0; k < 3; k++) {
      const st = S.createState('multi', { next: mulberry32(90210 + k) }, 5);
      const ch = []; for (let i = 0; i < 5; i++) ch.push(sel);
      Play.autoGameN(st, ch);
      out.push(String(st.winner) + '|' + st.round + '|' + st.p.map(function (p) { return Math.max(0, p.hp); }).join(','));
    }
    return out.join(' ; ');
  };
  eq(gamesOf(champResolved.sel), gamesOf(T.policyChooserN(params, 0.15)),
    '冠军对手必须与页面走同一条推理路径（三场的 winner/回合/血量必须逐场相同；不同 = 训练池里那颗冠军不是玩家遇到的那颗）');
  ok(gamesOf(champResolved.sel) !== gamesOf(T.policyChooserN(params, 0.6)),
    '正对照：temp 换到 0.6 必须读出不一样（读不出 ⇒ 上面那条等式是空枪，这把尺量不到 chooser）');
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
});

t('D13 风格切片（复合适应度）必须真的打进 fit —— 且是**追加**不是替换', function () {
  /* v1.5.2：两次"改对手池"落空（ring2 加 1 个脚本、mix 加 4 个真实风格冠军）之后，改走
   * "在池子预算之外附加 k 局风格局、按权重并进 fit"。这条用例盯四件事：
   *   ① 关闭时不产生风格局；② 打开时真的打 k 局；③ fit 里那部分恰好是 w*styleRate（自洽）；
   *   ④ **池子那一半 fit 逐位不变**（追加而非替换 —— 这正是"不摊薄"的保证）。 */
  ok(typeof T.setStyleSlice === 'function', 'T.setStyleSlice 必须存在');
  /* §E660（10-20 夜班 P3 · 实测尺 `d13-leak.mjs`）：这条腿原来有两处"上游说了算"——
   *   ① `makePolicy` 里的 `randn()` 读的是 `js/train/policy.js:465` 那个模块级 `__rng`，而本腿把
   *     `makePolicy` 写在 `setRng` **之前** ⇒ 这副权重其实来自 `Math.random`。25 档实测：恒等式仍 25/25 绿，
   *     但 `fit` 25 档 25 个取值 ⇒ 判据是相对量所以侥幸不红，读数却不可复现。
   *   ② 前一条腿把 `wallFilter` 设了没复位 ⇒ `fit` 走 `evo.js:2422` 的 −5.0 短路 ⇒ 下面**两条**恒等式
   *     残差同时破（实测 5.85 与 5.60）⇒ 与今晚 D15 那次红是同一条病。
   * 修法与 D15 一致：这条腿自己先复位、先播种再装配。**没加任何新断言**（只是把夹具钉住）。 */
  T.setEconomyReward({ reset: true });
  Pol.setRng(T.mulberry32(777001));
  const p = Pol.makePolicy(0.25);
  const opps = [{ name: 'random', sel: Bots.pickRandom }];
  const styleOpps = [{ name: 'defend', sel: Bots.pickDefend }];
  T.setStyleSlice(null, 0, 0);
  Pol.setRng(T.mulberry32(777001));           // 两次调用从**同一随机流起点**出发（否则比不了）
  const a = T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
  ok(a.styleGames === 0, '切片关闭时不得产生风格局，实测 styleGames=' + a.styleGames);
  T.setStyleSlice(styleOpps, 0.5, 2);
  Pol.setRng(T.mulberry32(777001));
  const b = T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
  ok(b.styleGames === 2, '切片打开后必须真的打 2 局，实测 ' + b.styleGames);
  ok(b.styleRate >= 0 && b.styleRate <= 1, 'styleRate 必须是比率，实测 ' + b.styleRate);
  /* v1.5.6：fit 的组成多了熵奖励 ⇒ 这里的"多出来的部分"要把它算进去（D15 管熵项本身）。
   * v1.5.71：**原来漏了 `seatPen`**（v1.5.68 加的座位惩罚项）⇒ 惩罚一触发这条断言就随机变红
   * （实测 5 次里 1 次，`实测多出 -0.069 vs 期望 0.031`）。修法不是放宽阈值，而是把 fit 的
   * **全部加项**都纳入恒等式 —— 契约是"fit = 报告出来的各加项之和"，将来再加项也必须先报告再进 fit。 */
  /* §E659（10-20 夜班）：上面那段 v1.5.71 说好的契约是"fit = 报告出来的各加项之和"，可这条式子当时只补到
   *   `seatPen` 就停了 —— **`gBonus`（v1.6.50 加的广度罚）与 `shapeBonus`（P2 的形状项）都没进来**。
   *   今天没咬人只因为出厂 `FIT_G_W = 0` 且 `s4W = 0`；只要谁在同一个进程里开一档而没复位（今晚 D15 就是
   *   这么红的），这条就会以同样的方式随机红。⇒ 补齐两项，并把引擎那侧缺的 `shapeBonus` 读数补上（evo.js）。 */
  const residualB = (b.fit - b.fitNoDiv) - (b.divBonus + 0.5 * b.styleRate - (b.seatPen || 0) + (b.shapeBonus || 0) + (b.gBonus || 0));
  ok(isFinite(b.seatPen), 'seatPen 必须照实报告（fit 的每个加项都要可审计，否则这条恒等式必然偶发红）');
  ok(Math.abs(residualB) < 1e-9,
    'fit 必须等于**全部**已报告加项之和（熵奖励 + w*styleRate - seatPen + shapeBonus + gBonus）；残差 ' + residualB.toFixed(6) +
    '（实测多出 ' + (b.fit - b.fitNoDiv).toFixed(6) + '，报告项合计 ' + (b.divBonus + 0.5 * b.styleRate - b.seatPen + b.shapeBonus + b.gBonus).toFixed(6) + '）');
  ok(Math.abs(b.fitNoDiv - a.fitNoDiv) < 1e-9,
    '切片必须是**追加**：池子那部分 fit 不得被改变（无切片 ' + a.fitNoDiv + ' vs 有切片 ' + b.fitNoDiv + '）');
  T.setStyleSlice(null, 0, 0);
  const c = T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
  ok(c.styleGames === 0 && Math.abs((c.fit - c.fitNoDiv) - (c.divBonus - (c.seatPen || 0) + (c.shapeBonus || 0) + (c.gBonus || 0))) < 1e-9, '关掉切片后必须完全回到无切片状态（只剩熵奖励 − seatPen + shapeBonus + gBonus）');
  /* 两端接线（结构性）：这类"两处各写一遍"的机制漏一端就静默半开（v1.5.0 的 mode 事故同型） */
  const pt = readFileSync('server/train-server.mjs', 'utf8');
  ok(pt.indexOf('setStyleSlice') >= 0, 'server 必须调 setStyleSlice');
  ok(pt.indexOf('styleNames, slice.w') >= 0, 'server 必须把风格名单/权重/局数传给 poolN.evalPopN');
  ok(pt.indexOf('回执 styleGames') >= 0, 'server 必须校验 worker 的 styleGames 回执');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('setStyleSlice') >= 0, 'worker 必须在**自己沙箱**里设切片（服务端那份改不到 worker）');
  ok(wk.indexOf('styleGames') >= 0, 'worker 必须回执 styleGames');
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
});

t('D72 对手注册表一致性：runner 的池子名 / opp-pool 注册表 / BOT_FN 映射必须对齐', function () {
  const pool = readFileSync('server/opp-pool.mjs', 'utf8');
  const reg = {};
  const re1 = /name:\s*'([a-z0-9_]+)'\s*,\s*fn:\s*'([A-Za-z0-9_]+)'/g;
  let m; while ((m = re1.exec(pool))) reg[m[1]] = m[2];
  ok(Object.keys(reg).length >= 15, 'opp-pool 注册表应 >=15 个对手（实测 ' + Object.keys(reg).length + '）');
  const srv = readFileSync('server/train-server.mjs', 'utf8');
  const fnBlk = (srv.match(/const BOT_FN = \{[^}]*\}/) || [''])[0];
  ok(fnBlk.length > 0, 'train-server 必须有 BOT_FN 映射表');
  const run = readFileSync('tools/ring2-run.mjs', 'utf8');
  const names = [];
  const re2 = /POOL_[A-E]\s*=\s*[^;]+/g; let m2;
  while ((m2 = re2.exec(run))) {
    const q = m2[0].match(/'([^']+)'/g) || [];
    q.forEach(function (lit) { lit.replace(/'/g, '').split(',').forEach(function (n) { if (n && !/^[A-E]$/.test(n)) names.push(n); }); });
  }
  ok(names.length > 0, '必须能从 runner 里解析出池子名单');
  const bad = names.filter(function (n) { return reg[n] === undefined && n.indexOf('champ:') !== 0; });
  eq(bad.length, 0, 'runner 池子里的名字必须在 opp-pool 注册（未注册: ' + bad.join(',') + '）');
  ok(reg['protomine'] === 'pickProtoMine' && reg['prototransfer'] === 'pickProtoTransfer',
    '本轮补的两个原型系脚本（最强脚本，中立场 45%）必须在册');
});

t('D89 训练侧座位探针局数：必须能按**消息**设（`setSeatGames` 以前导出却从没被调用）+ 缺省不改', function () {
  /* v1.5.102（v1.5.100 §17）：训练侧座位惩罚的样本写死 6 局，而门禁要 ≥50 局 ⇒ **同一个量、两个样本量**。
   * 这条门钉住：① 有旋钮；② 走**消息**（env 是 worker 创建时的拷贝）；③ 缺省不改（`SEAT_GAMES` 仍 6）。 */
  const pt = readFileSync('server/paralleltrain.mjs', 'utf8');
  ok(pt.indexOf('seatGames: Number(process.env.EPIRUS_TRAIN_SEAT_GAMES || 0) || null') >= 0,
    'evalN 消息必须带 `seatGames`（env 到不了 worker ⇒ 必须随消息）');
  const wk = readFileSync('server/train-worker.mjs', 'utf8');
  ok(wk.indexOf('T.setSeatGames(Number(msg.seatGames) || 0)') >= 0, 'worker 必须按消息设座位探针局数');
  ok(wk.indexOf('[seat] worker **消息**生效值') >= 0, '必须有回执（照 [econ]/[imit] 的先例）');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  ok(sv.indexOf('T.setSeatGames(Number(process.env.EPIRUS_TRAIN_SEAT_GAMES))') >= 0, '主线程也要设一份');
  ok(sv.indexOf('Number(process.env.EPIRUS_TRAIN_SEAT_GAMES || 0) > 0') >= 0,
    '缺省必须**不改**（0/未设 ⇒ 保持 6 局；"默认不设即不变"）');
  eq(T.seatGames(), 6, 'D89 跑到这里时训练侧探针必须仍是默认 6 局');
  eq(T.setSeatGames(40), 40, 'setSeatGames(40) 必须回读 40');
  eq(T.setSeatGames(6), 6, '复位回 6（别把状态泄漏给后面的用例）');
});

t('D135 大雷连带收益项（v1.5.187 接线 · v1.5.188 换**率形**）：归因走 bigTChain.from、分子分母都不受权重门控、且证明"这一项的非零只能来自注入"', function () {
  /* ① 计数器的归因口径（DS 自己踩过的 L2 坑：`voided` 事件**没有 reason**，连带主标记是 `bigTChain{from,to,kind}`） */
  const evs = [
    { type: 'bigTChain', from: 2, to: 0, kind: 'attack' },
    { type: 'bigTChain', from: 2, to: 1, kind: 'targeted' },
    { type: 'bigTChain', from: 1, to: 2, kind: 'attack' },        // 别人打出的链 ⇒ 不许算到我头上
    { type: 'voided', pid: 0, by: '真正的落雷连带' },                 // 作废事件不是链标记
    { type: 'damage', to: 0, amt: 2, reason: '真正的落雷·连带' },      // damage.reason 只覆盖"吃到伤害"那半
    { type: 'action', pid: 2, key: R.SK.BIG_T, outcome: 'ok' }
  ];
  eq(T.countBigTChain(evs, 2, R), 2, '只数 `from === 该席` 的 bigTChain（别人的、damage 的、voided 的都不算）');
  eq(T.countBigTChain(evs, 1, R), 1, '换一个席位看归因是否跟着走');
  eq(T.countBigTChain([], 0, R), 0, '空事件 ⇒ 0');
  /* ①b v1.5.188（用户裁 Q-14 ② = 按率付）：**分母**的口径 —— 只数该席"真正打出的大雷"（`outcome === 'ok'`，
   *  与 `countBigCards` 同规矩 ⇒ 被无效化的不算，不可刷）；卡从 `rules.SK.BIG_T` 取，不许写字面卡名。 */
  const casts = [
    { type: 'action', pid: 0, key: R.SK.BIG_T, outcome: 'ok' },
    { type: 'action', pid: 0, key: R.SK.BIG_T, outcome: 'voided' },     // 被无效化 ⇒ 不算
    { type: 'action', pid: 1, key: R.SK.BIG_T, outcome: 'ok' },         // 别人的出手 ⇒ 不算
    { type: 'action', pid: 0, key: R.SK.MINE, outcome: 'ok' },          // 贵卡但不是大雷 ⇒ 不算
    { type: 'bigTChain', from: 0, to: 2, kind: 'attack' }               // 链事件本身不是出手
  ];
  eq(T.countBigTCasts(casts, 0, R), 1, '分母只数该席 `outcome:ok` 的 `BIG_T` 出手');
  eq(T.countBigTCasts([], 0, R), 0, '空事件 ⇒ 分母 0（**0 出手必须走 0 分这条路，不许 0/0**）');
  /* ①c 率形本身：`0 出手 ⇒ 0 分`（`NaN` 会把整个 fit 打坏 —— DS §3 坑#2/#3 那一族）⇒ 用评分器直接判产物 */
  {
    const pack = sb.window.EpirusPolicy.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
    const opps = [{ name: 'balanced', sel: Bots.pickBalanced }, { name: 'defend', sel: Bots.pickDefend }];
    T.setEconomyReward({ bigtChainW: 4 });          // 故意给到能把 fit 顶满的量级
    const hot = T.scoreMemberN(pack, opps, 6, 3, 0, 0, 0);
    T.setEconomyReward({ reset: true });
    const cold = T.scoreMemberN(pack, opps, 6, 3, 0, 0, 0);
    ok(isFinite(hot.fit) && isFinite(hot.chainRate), 'fit 与率都必须是有限数（0/0 会出 NaN）');
    if (hot.chainCasts === 0) {
      eq(hot.chainRate, 0, '分母 0 ⇒ 率必须是 0（不许 NaN）');
      ok(Math.abs(hot.fit - cold.fit) < 1e-12,
        '分母 0 ⇒ **即使 W=4 也不许加一分钱**（这条就是"0 出手却吃到连带奖励"的防伪钉；实测 fit ' + hot.fit + ' vs ' + cold.fit + '）');
    } else {
      ok(Math.abs(hot.chainRate - hot.chainEvents / hot.chainCasts) < 1e-12, '率必须等于分子/分母（读数不许各算一份）');
    }
  }
  /* ② 权重三件套：setter 生效 / 读回 / reset 复位（econ-env 的键对齐由 D77 管）
   *    v1.5.188：**形状也要读得回** —— 这次改的就是形状（计数 → 率），而"权重读回了"证明不了项按哪种方式进 fit。 */
  T.setEconomyReward({ bigtChainW: 0.4 });
  eq((T.bigTChainReward() || {}).w, 0.4, 'setEconomyReward ⇒ bigTChainReward 必须读回生效值');
  eq((T.bigTChainReward() || {}).shape, 'rate', '必须读回形状 `rate`（付的是"连带/出手"，不是"连带绝对数"）');
  T.setEconomyReward({ bigtChainW: -3 });
  eq((T.bigTChainReward() || {}).w, 0, '负数 ⇒ clamp 到 0（不许负权重把 fit 往下拽出反向梯度）');
  T.setEconomyReward({});
  eq((T.bigTChainReward() || {}).w, 0, '未设 ⇒ 不动');
  /* ③ 读数必须**不受权重门控**（W=0 也要能看"这一代打出几条链"）—— 否则"死作用点"与"真没链"永远分不开
   *    （这次就卡在这一步：三档剂量逐位相同，我一度判它死了，其实是链数为 0）
   *    v1.5.188：**分母同样不许跟着门控**（率形没有分母读数 = 又一根只能事后量的尺） */
  T.setEconomyReward({ bigtChainW: 0 });
  const s0 = T.scoreMemberN(sb.window.EpirusPolicy.unpack(sb.window.EPIRUS_CHAMPION_3P, true),
    [{ name: 'balanced', sel: Bots.pickBalanced }, { name: 'defend', sel: Bots.pickDefend }], 4, 3, 0, 0, 0);
  ok(typeof s0.chainEvents === 'number', 'W=0 时评分也必须返回 chainEvents（读数不能跟着权重一起关）');
  ok(typeof s0.chainCasts === 'number' && typeof s0.chainRate === 'number',
    'W=0 时也必须返回**分母与率**（只给分子就无法判断率是几）');
  /* ④a **判活**（示范开着）：跑一臂 W=0.5 ⇒ 必须印"形状=rate"、每代印分子/分母/率；
   *      若整臂一条链都没打出，fit 不许出现 +0.5 级的跳变（否则 = 计数漏了、奖励却在动）。
   *      v1.5.187 用的是 W=1.5 计数形（一发幸运链吃满 ⇒ 把名次适应度整个盖掉，实测考卷 35.4%→23.5%）⇒ 剂量降到 0.5。 */
  const dir = mkdtempSync(join(tmpdir(), 'd135-'));
  /* §E566（千问）：这两处从 `spawnNC` 收回普通 `spawnCached`。§九 里 D135 是被"门里出现过变量路径的 readFileSync"
   *   那道**过宽判据**扫进来的（同 D150 的误伤），DS 当时写的是"同理未验完 ⇒ 一并退回"。逐门读清了：
   *   本门体从 `mkdtempSync` 到结尾**没有任何一处读 `dir`/`dir2`**（那两个目录只作为 `EPIRUS_BAND_DIR` 写出去），
   *   断言全部吃 `String(run.stdout)` ⇒ 前置要求（断言只用 stdout/status）本来就满足 ⇒ 可以缓存，省下 60 代臂 × 2 ≈ 109 s/热遍。
   *   ⚠ 这条判断的依据是"读代码 + 第二遍必须命中且仍绿"两件事一起算，不是只看第二遍绿（那只读 stdout 的门，
   *     盒子对错的第二遍都是绿的 —— 见 `np-cache` 头注与 §十五）。 */
  const run = spawnCached(['tools/train-3p.mjs', '60', '3', '8', '8'], {
    env: Object.assign({}, process.env, {
      EPIRUS_SEED: '31', EPIRUS_IMIT_TEACHER: 'pickBigTChain', EPIRUS_IMIT_ONLY: 'bigT', EPIRUS_IMIT_OVERRIDE: '1',
      EPIRUS_IMIT_FRAC: '0.5', EPIRUS_REGEN_SLICE: '0.25', EPIRUS_BIGT_CHAIN_W: '0.5', EPIRUS_ARM: 'd135', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: join(dir, 'd135a.js')
   /* ⚠ 必须**改道**（2026-10-16 实测）：这条 spawn 没设 `EPIRUS_T3P_OUT` ⇒ 未命中缓存时它把产物写在**默认落点**
    *   `docs/artifacts/train-3p-out.js` —— 那是 `train-evo` 的 D123/D162 当 CLI 基线的同一个文件。CI 上每部分一台机
    *   所以看不见；本机并行跑门就变成「隔壁部分把我的基线写脏了」。本门只吃 stdout / 只读自己的 temp 目录 ⇒ 改道零损失。 */
    }), encoding: 'utf8', timeout: 600000
  });
  eq(run.status, 0, '带连带权重的臂要跑得通');
  const out = String(run.stdout || '');
  /* v1.5.187：CLI 的横幅里**不许出现那个 env 名**（D77 ① 按整名扫，train-3p.mjs 在读的清单里）
   * ⇒ 改钉"下达值 ⇒ 消费点读回同值"，判的还是同一件事（值真到了引擎），只是不钉字面量。 */
  ok(/大雷连带权重已下达：0\.5 ⇒ 消费点读回 0\.5/.test(out), '必须印"下达 ⇒ 读回"');
  ok(/形状=rate/.test(out), '横幅必须印**读到的形状**（形状读不回 = 旧形状还活着也没人知道）');
  ok(/连带=\d+ 条\/[\d.]+每局\*\* 出手=\d+ 率=[\d.]+/.test(out),
    '每代必须把**分子、分母、率**一起印（只印分子时"1 条/1 次出手"与"1 条/8 次出手"在尺子上同形 —— 正是换形状要分开的那两件事）');
  const fitJump = (out.match(/bestFit=([0-9.]+)/g) || []).map(function (s) { return Number(s.split('=')[1]); });
  const withChain = /连带=([1-9]\d*) 条/.test(out);
  ok(withChain || Math.max.apply(null, fitJump) < 1.5,
    '整臂没链时 fit 不许出现 +0.5 级跳变；实测最大 bestFit=' + Math.max.apply(null, fitJump));
  /* ④b **今天真正的结论**（v1.5.188 单变量：把示范关掉，其余与 ④a 同）⇒ 链与出手必须**恒 0**，
   *      且 fit 不许被这项顶起来。含义：`BIGT_CHAIN_W` 的非零信号**只能来自教师注入的那几手**
   *      （事件流里注入与原生出手不可区分 —— 没有标记），所以在"原生零出手"的物种上，这一项**不是在评这个包**。
   *      ⇒ 这就是 Q-14 ①② 都买不到行为的机制解释；钉在这里，防以后有人拿"率很高"当出货。 */
  const dir2 = mkdtempSync(join(tmpdir(), 'd135b-'));
  const run2 = spawnCached(['tools/train-3p.mjs', '60', '3', '8', '8'], {   /* §E566：同上，本门不读任何产出 ⇒ 收回普通缓存 */
    env: Object.assign({}, process.env, {
      EPIRUS_SEED: '31', EPIRUS_BIGT_CHAIN_W: '0.5', EPIRUS_ARM: 'd135b', EPIRUS_BAND_DIR: dir2, EPIRUS_T3P_OUT: join(dir2, 'd135b.js'),
   /* ⚠ 必须**改道**（2026-10-16 实测）：这条 spawn 没设 `EPIRUS_T3P_OUT` ⇒ 未命中缓存时它把产物写在**默认落点**
    *   `docs/artifacts/train-3p-out.js` —— 那是 `train-evo` 的 D123/D162 当 CLI 基线的同一个文件。CI 上每部分一台机
    *   所以看不见；本机并行跑门就变成「隔壁部分把我的基线写脏了」。本门只吃 stdout / 只读自己的 temp 目录 ⇒ 改道零损失。 */
      /* §E275：v1.5.333 起大雷那档是**引擎默认**，所以"这一项的非零只能来自注入"这个前提**必须显式关档**才成立。
       *   实测：不关时 np 红在这里（4 张原生大雷出手）⇒ 红的是**量具前提**，不是结论 ⇒ 修夹具，不把判据改松。 */
      EPIRUS_BIGT_PUSH: '0'
    }), encoding: 'utf8', timeout: 600000
  });
  eq(run2.status, 0, '关掉示范的对照臂要跑得通');
  const out2 = String(run2.stdout || '');
  const castLines = (out2.match(/出手=(\d+)/g) || []).map(function (s) { return Number(s.split('=')[1]); });
  ok(castLines.length > 0, '对照臂也必须印分母（不印 = 这项在没示范时根本不看数据）');
  /* ⚑ R62（2026-10-25 · 天火阶梯计价）漂移账：原断言是 `eq(Math.max(castLines), 0, '没有示范 ⇒ 该席大雷出手必须恒 0')`
   *   ‖ `ok(!/连带=([1-9]\d*) 条/.test(out2), …)`——那是个**经验性零值**（60 代冷进化从不自己出大雷），不是结构不变量：
   *   R62 把天火首下价 2→1 ⇒ 脚本启发式与候选费用特征整体微移 ⇒ 轨迹漂移 ⇒ 手跑实测 4 个世代点里有一代
   *   `出手=3 ‖ 连带=1 条`（其余三代仍 0），且同 seed 下示范臂的散发出手也漂到 1 ⇒ **任何"控制臂 vs 示范臂的出手差"
   *   都不再是稳定断言**。注入机制本身没动。修法（等 Qoder/DS 复核）：锚到**结构性数字**——
   *   ① 对照臂根本不许出现示范注入统计行（没教师 ⇒ 注入结构性为零）；
   *   ② 对照臂的散发出手必须**远少于**示范臂的注入开火数 fired（注入仍是这一项压倒性的加量源）；
   *   ③ 对照臂的连带条数 ≤ 自己的大雷出手数（每条链至少要有一发出手 ⇒ 归因口径没漂）。 */
  ok(!/示范注入统计/.test(out2), '没有示范 ⇒ 不许出现注入统计行（教师缺席 ⇒ 注入结构性为零）');
  const firedM = /fired=(\d+)/.exec(String(run.stdout || ''));
  ok(!!firedM, '示范臂必须印注入开火数 fired（对照腿的锚，见上 ⚑）');
  const ctrlMax = Math.max.apply(null, castLines);
  ok(ctrlMax < Number(firedM && firedM[1] || 0), '没有示范 ⇒ 该席大雷出手必须远少于示范臂的注入开火数（控制臂最大 ' +
    ctrlMax + ' ‖ 示范臂 fired=' + (firedM && firedM[1]) + '）—— R62 漂移后"恒 0"不再是结构不变量，锚换到注入计数');
  const ctrlChains = (out2.match(/连带=(\d+) 条/g) || []).map(function (s) { return Number(s.replace(/[^\d]/g, '')); });
  ok(ctrlChains.reduce(function (a, b) { return a + b; }, 0) <= castLines.reduce(function (a, b) { return a + b; }, 0),
    '对照臂的连带条数不得超过自己的大雷出手数（每条链至少要有一发出手 ⇒ 归因没漂）');
});

t('D136 示范归因（v1.5.189）：教师的手必须能从包自己的手里分出来，且**没有注入的局也照样计数**、**不进 fit**、**按经济口径分桶**', function () {
  /* 病（今天用两条单变量对照才抓到的）：`IMIT_OVERRIDE` 的注入是直接 `return ta` ⇒ 事件流里"教师替它打的那一手"
   * 与"包自己打的那一手"**一模一样** ⇒ 一切"示范学会了没有"的臂内读数都混着教师的手。
   * ⚠️ 这条门自己也要防那个坑：第一版我把打标记挂在"本局有注入"上 ⇒ 退火窗口之后整段没有读数，
   *    等于**量具自己把要测的那半砍掉了**（"没测到"又会被读成"没发生"）。所以 ② 是这条门的主钉。 */
  const mk = function (pid, key, outcome) { return { type: 'action', pid: pid, key: key, outcome: outcome }; };
  T.resetImitStat();
  /* ① 归因口径：只数该席、只数 `outcome:'ok'`；台账按事件顺序消费 ⇒ **条数一定对**（同卡多次谁是被注入的不保证） */
  const ev1 = [mk(0, R.SK.BIG_T, 'ok'), mk(0, R.SK.BIG_T, 'ok'), mk(0, R.SK.GUN, 'ok'),
    mk(0, R.SK.BIG_T, 'voided'), mk(1, R.SK.BIG_T, 'ok')];
  const r1 = T.tagImitActions(ev1, { bigT: 1 }, 0, { subsidy: true });
  eq(r1.tagged, 1, '台账说"教师伸过 1 次手" ⇒ 必须标出 1 条');
  eq(ev1[0].imit, true, '该席第一条 ok 的 bigT ⇒ 打上 `imit`（**同卡多次时"哪一条是注入的"顺序相关、不保证；条数保证**）');
  ok(!ev1[1].imit && !ev1[2].imit && !ev1[3].imit && !ev1[4].imit, '第二条同卡出手（记成原生）/ 别的卡 / 被作废的一手 / 别人的出手都不许标');
  let a = T.imitAttribution();
  eq(a.keys.bigT.imit, 1, '分子账：注入 1');
  eq(a.keys.bigT.native, 1, '分子账：该席 bigT 另有 1 次是**原生**（`voided` 那条不记 ⇒ 与 `countBigCards` 同口径，不可刷）');
  eq(a.keys.bigT.nativeSub, 1, '分桶：补贴局');
  eq(a.keys.bigT.nativeEcon, 0, '分桶：原生经济局 0');
  /* ② **没有注入的局也必须计数**（那次砍掉另一半的回归钉）⇒ 空台账喂进去，原生数照样涨、且进的是 `econ` 桶 */
  const ev2 = [mk(0, R.SK.BIG_T, 'ok'), mk(0, R.SK.GUN, 'ok')];
  const r2 = T.tagImitActions(ev2, {}, 0, { subsidy: false });
  eq(r2.tagged, 0, '空台账 ⇒ 零条注入');
  a = T.imitAttribution();
  eq(a.keys.bigT.nativeEcon, 1, '**无注入的局也要计数** ⇒ `nativeEcon` 必须涨（否则退火后整段没有读数）');
  eq(a.keys.bigT.nativeSub, 1, '两桶各记各的，不许互相污染');
  eq(a.games, 2, '每次调用都算一局（窗口后的那些局同样进账）');
  /* ③ 台账有条数、事件里却没有 ⇒ 必须落进 `unmatched` 被看见，不许静默 */
  T.resetImitAttribution();
  const r3 = T.tagImitActions([mk(0, R.SK.BIG_T, 'ok')], { bigT: 3 }, 0, { subsidy: false });
  eq(r3.unmatched, 2, '注入了 3 次只有 1 次成为事件 ⇒ unmatched=2（不许装作没事）');
  eq(T.imitAttribution().unmatched, 2, '累计账里也要看得见');
  T.resetImitAttribution();
  a = T.imitAttribution();
  eq(a.tagged + a.unmatched + a.games, 0, 'reset 必须真清空（否则上一门的账会污染下一门）');
  ok(T.resetImitStat() === true, '`resetImitStat` 要顺带清归因（同一族账，只清一半就会串代）');
  /* ④ **不进 fit**：β=0（示范窗口没开）⇒ 归因照跑，但评分逐位等于"示范关" —— 这一项只许记账，不许买行为 */
  const pack = sb.window.EpirusPolicy.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
  const opps = [{ name: 'balanced', sel: Bots.pickBalanced }, { name: 'defend', sel: Bots.pickDefend }];
  T.setImitPlan(null); T.setImitUntil(0);            // 显式关窗口：别的手段（前面的门）留下的计划/窗口都不算
  eq(T.imitBetaForGen(0), 0, '前置条件：β(gen0) 必须是 0（否则 ④ 判的就不是"只记账"，而是"示范确实会改行为"）');
  T.setImitOverride(false);
  const sOff = T.scoreMemberN(pack, opps, 4, 3, 0, 0, 0);
  T.resetImitAttribution();
  T.setImitOverride(true);                            // 开 override，但 β≡0 ⇒ 从不注入
  const sOn = T.scoreMemberN(pack, opps, 4, 3, 0, 0, 0);
  T.setImitOverride(false);
  ok(T.imitAttribution().games > 0, '归因这一趟**必须真的跑过**（否则"fit 相同"是空枪：压根没执行就打不开这个证明）');
  eq(sOn.fit, sOff.fit, '示范开着但窗口=0 ⇒ fit 必须逐位相同（归因只记账，不许动目标函数）');
  ok(sOn.chainEvents !== undefined, '顺带：连带读数仍在（与 D135 同一把尺，不许跟着开关关）');
  /* ⑤ 真跑一臂：窗口后的代数里必须仍有归因读数，且**分桶不是恒零尺**（别的卡要在 `econ` 桶里有出手） */
  const dir = mkdtempSync(join(tmpdir(), 'd136-'));
  const run = spawnCached(['tools/train-3p.mjs', '30', '3', '8', '6'], { env: Object.assign({}, process.env, {
      EPIRUS_SEED: '31', EPIRUS_IMIT_TEACHER: 'pickBigTChain', EPIRUS_IMIT_ONLY: 'bigT', EPIRUS_IMIT_OVERRIDE: '1',
      EPIRUS_IMIT_FRAC: '0.5', EPIRUS_REGEN_SLICE: '0.25', EPIRUS_BIGT_CHAIN_W: '0.5', EPIRUS_ARM: 'd136', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: join(dir, 'd136.js')
   /* ⚠ 必须**改道**（2026-10-16 实测）：这条 spawn 没设 `EPIRUS_T3P_OUT` ⇒ 未命中缓存时它把产物写在**默认落点**
    *   `docs/artifacts/train-3p-out.js` —— 那是 `train-evo` 的 D123/D162 当 CLI 基线的同一个文件。CI 上每部分一台机
    *   所以看不见；本机并行跑门就变成「隔壁部分把我的基线写脏了」。本门只吃 stdout / 只读自己的 temp 目录 ⇒ 改道零损失。 */
    }), encoding: 'utf8', timeout: 600000
  });
  eq(run.status, 0, '归因臂要跑得通');
  const out = String(run.stdout || '');
  const lines = (out.match(/\[归因·本代\][^\n]*/g) || []);
  ok(lines.length >= 8, '逐代印归因（30 代 ⇒ 至少 8 行；实测 ' + lines.length + ' 行）');
  const postWindow = lines.slice(Math.ceil(lines.length * 0.6));
  ok(postWindow.length > 0 && postWindow.every(function (l) { return /注入0/.test(l) || /教师这一代一次手都没伸/.test(l); }),
    '退火窗口之后必须**仍有读数**且注入=0 ⇒ 这就是"量具别再砍掉要测的那半"的产物级证据');
  ok(/unmatched=0/.test(out), '臂末 unmatched 必须为 0（台账与事件逐条对得上；实测：' +
    ((/unmatched=(\d+)/.exec(out) || ['', '?'])[1]) + '）');
  const econTot = (/出手归因（受评席 · 只数 `outcome:ok`）：(\{[^\n]*?\}) · tagged=/.exec(out) || [null, '{}'])[1];
  let econSum = 0;
  try { const o = JSON.parse(econTot); for (const k in o) econSum += (o[k].nativeEcon || 0); } catch (e) { econSum = -1; }
  ok(econSum > 0, '`原生经济` 桶不许是恒零尺（别的卡要在里面有出手，否则这条分桶等于没测；实测合计 ' + econSum + '）');
  ok(/bigT.*"nativeSub":([1-9])/.test(out) || /bigT 原生[1-9]（补贴局/.test(out),
    '大雷必须至少在补贴局桶里有原生出手（今天的读数）；两桶都为 0 说明注入根本没发生');
});

/* ===== D238（10-21 · §E676 交班第 5 条）：杂货铺旋钮必须有牙 =====
 * 病：`EPIRUS_TOOLKIT_OPPS` 默认关、改坏不会红；而同族 `COUNTER_OPPS`/`ECON_OPPS` 各有 D130/D220。
 * 形状（同族）：默认关 ⇒ 一行不印 + 产物 `recipe.toolkitOpps` 为 null；开档 ⇒ OPPS 9→11 且 meta 自证；
 *   坏值 ⇒ exit 4 且不落产物。判行为不判文案。 */
t('D238 杂货铺上训练桌的旋钮：默认关必须一行不印 · 开档必须 OPPS 9→11 且产物自证 · 坏值 exit 4（10-21）', function () {
  const src = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(src.indexOf("'EPIRUS_TOOLKIT_OPPS'") >= 0, '旋钮必须进 SELF_ENV_KEYS（否则黑键侦测会把它当「传了没人读」）');
  const dir = mkdtempSync(join(tmpdir(), 'd238-'));
  const base = Object.assign({}, process.env); delete base.EPIRUS_TOOLKIT_OPPS;
  const run = (name, extra) => spawnSync(process.execPath, ['tools/train-3p.mjs', '1'], {
    encoding: 'utf8', timeout: 300000, maxBuffer: 1 << 24,
    env: Object.assign({}, base, { EPIRUS_SEED: '7', EPIRUS_ARM: name,
      EPIRUS_BAND_DIR: join(dir, 'b-' + name), EPIRUS_T3P_OUT: join(dir, name + '.js') }, extra || {})
  });
  try {
    const off = run('d238off', null);
    eq(off.status, 0, '默认关的臂必须跑通：' + String(off.stderr || '').slice(0, 140));
    ok(String(off.stdout || '').indexOf('[toolkit-ops]') < 0, '不设 env 时一行都不许印（默认关要有可见差别）');
    const mt0 = packMetaOf(join(dir, 'd238off.js'));
    ok(!!mt0 && !(mt0.recipe && mt0.recipe.toolkitOpps), '默认关 ⇒ 产物 recipe.toolkitOpps 必须是 null（不许留一行空对象）');
    const on = run('d238on', { EPIRUS_TOOLKIT_OPPS: '2' });
    eq(on.status, 0, '=2 的臂必须跑通：' + String(on.stderr || '').slice(0, 140));
    ok(/\[toolkit-ops\][^\n]*OPPS 从 9 个变 11 个/.test(String(on.stdout || '')), '=2 ⇒ 必须印 OPPS 9→11（份数驱动，不是「多几席」）');
    const mt = packMetaOf(join(dir, 'd238on.js'));
    const tk = mt && mt.recipe && mt.recipe.toolkitOpps;
    ok(!!tk && Number(tk.n) === 2 && Number(tk.poolSize) === 11, '产物 meta 必须自证 toolkitOpps = {n:2,poolSize:11}（实测 ' + JSON.stringify(tk) + '）');
    const bad = run('d238bad', { EPIRUS_TOOLKIT_OPPS: 'abc' });
    eq(bad.status, 4, '非整数必须 exit 4（拒绝把打错的当 0），实测 ' + bad.status);
    ok(!existsSync(join(dir, 'd238bad.js')), '被拒的臂不许落产物');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  }
});
}
