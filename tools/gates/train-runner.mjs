/*#np-part-header
{"file":"tools/gates/train-runner.mjs","part":"train-runner","group":"train","ranges":[[1207,1597],[2404,2415],[2485,2591],[4758,4780],[5315,5332],[5483,5548],[6013,6023],[6128,6144],[6456,6567],[6598,6651],[6764,6945],[8193,8207],[8255,8271],[8338,8461],[8498,8541],[8939,9120],[9265,9299],[9374,9506],[10450,10467],[10573,10651],[11644,11708]],"gates":[1207,1255,1327,1388,2404,2485,2499,2547,4758,5315,5483,6013,6128,6456,6526,6598,6764,6872,8193,8255,8338,8498,8939,8967,9003,9265,9374,9442,10450,10573,11644],"patched":[8344,8348,8349]}
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
  fnBody,
} = makeCtx();
/* 每个门单元的**原始行号**（与下面 register() 里 t() 的调用次序一一对应）⇒ runner 按它排序执行。 */
export const ords = [1207, 1255, 1327, 1388, 2404, 2485, 2499, 2547, 4758, 5315, 5483, 6013, 6128, 6456, 6526, 6598, 6764, 6872, 8193, 8255, 8338, 8498, 8939, 8967, 9003, 9265, 9374, 9442, 10450, 10573, 11644];
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
  /* ② 接线：默认关 ⇒ 源里走的是空串；开了 ⇒ 真推进 fitness 的对手表，并且**产物自带这臂上了谁** */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf("EPIRUS_ECON_OPPS || ''") >= 0, '必须默认空（不设 ⇒ 一个对手都不加，历史臂逐位可复现）');
  ok(t3.indexOf("'EPIRUS_ECON_OPPS'") >= 0, '必须进 SELF_ENV_KEYS（否则黑键侦测会判它"传了没人读"）');
  ok(/EPIRUS_ECON_OPPS 里有不认识的名字[\s\S]{0,200}process\.exit\(4\)/.test(t3), '名字不在表里必须 exit 4（少一个 = 一根空枪）');
  ok(t3.indexOf('for (const o of ECON_OPPS) OPPS.push(o)') >= 0, '开了必须真推进 `OPPS`（推进别处 = 死作用点）');
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

t('D221 同分带内按"贵卡出手"选人（v1.5.326 · §E249 · 今晚 4 批 47 臂的账：奖励改的是种群，**当选那一步把它又筛掉了**）：默认 0 ⇒ 冠军逐字不变 · **零剂量时不许换人** · 排序键必须真咬到', function () {
  /* 病（实测，不是猜）：`EPIRUS_COSTLY_W` 把名人堂"会打大雷"的粒从**对照 0/6 抬到 6/6**，可**当选产物**常常还是 0.000
   *   —— 终局重验只按胜负分选人，"会不会打这张卡"看不见；而 `SEL_KEEP` 的 bigT veto **逐位没换人**
   *   （它只能在保住优点的粒里挑，**造不出**这样的粒）。⇒ 修法是把"用量"做成**选人排序键**（同 `SEL_LAND` 的先例），
   *   代价明码标价：只在胜负分相差 ≤ tol pt 的带内换，且**带内零剂量时一律不改判**（否则就是一根在没有证据时也会动判定的键）。 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  /* ⓪ **先钉纯函数**（合成候选表，不跑训练）—— 三条各挡一种失效。
   *    为什么不能只跑真臂：6 代的小训练里"带内"通常只有当选者自己（实测 `band=1`）⇒
   *    那种断言**永远不会红**（§E198"永绿假守卫"的同族，我 01:2x 用变异实测撞了一次：
   *    把"零剂量也不换人"故意改成"换"，真臂夹具照样绿）。 */
  const EU = function (score, usage) { return { score: score, usage: usage }; };
  const uof = function (e) { return e.usage; };
  const hiSet = [EU(0.70, 0), EU(0.69, 3), EU(0.50, 9)];            // tol=2pt ⇒ 带内前两粒；分数最高那粒用量 0
  const ph = bandPickByUsage(hiSet, 2, uof);
  ok(ph.best === hiSet[1] && ph.tieBrokenBy === 'usage',
    '带内存在用量差 ⇒ **必须换人**到用量最高那粒（实测换到 usage=' + (ph.best && ph.best.usage) + '，by=' + ph.tieBrokenBy + '）');
  ok(ph.band.length === 2, '带外那粒（胜负分差 20pt）用量再高也不许进带（实测 band=' + ph.band.length + '）');
  const zeroSet = [EU(0.60, 0), EU(0.59, 0), EU(0.20, 12)];
  const pz = bandPickByUsage(zeroSet, 5, uof);
  ok(pz.zeroDose === true && pz.best === zeroSet[0] && pz.tieBrokenBy === 'score',
    '带内全部零剂量 ⇒ **一律不换人**（这根键不许在没有证据时动判定；实测 best.usage=' + (pz.best && pz.best.usage) + '）');
  const tieSet = [EU(0.70, 4), EU(0.70, 4), EU(0.69, 1)];
  const pt = bandPickByUsage(tieSet, 2, uof);
  ok(pt.best === tieSet[0], '用量相同 ⇒ 按胜负分取高，且**不许抖**（实测 best.score=' + (pt.best && pt.best.score) + '）');
  ok(t3.indexOf('bandPickByUsage(sel.clean, SEL_BIGT, useOf)') >= 0,
    'train-3p 必须调这份纯函数（在调用点重写一遍排序 = 两份实现必漂移）');
  ok(t3.indexOf('EPIRUS_SEL_BIGT || 0') >= 0, '默认必须 0（关档 ⇒ 当选者与历史臂逐字相同）');
  ok(t3.indexOf("'EPIRUS_SEL_BIGT'") >= 0, '必须进 SELF_ENV_KEYS（否则黑键闸会判它"传了没人读"）');
  ok(t3.indexOf('fieldProfile(e.ref.params, 0, ') >= 0,
    '用量必须走 `behavior-profile.fieldProfile`（与 `SEL_KEEP_CAL=plain` 同一把尺）—— 另写一份逐卡计数 = 两份实现必漂移');
  ok(/EPIRUS_SEL_BIGT_KEYS 里有不认识的卡名[\s\S]{0,220}process\.exit\(7\)/.test(t3), '卡名不合法必须 exit 7（判不到的维不许当排序键）');
  ok(t3.indexOf('selBigT: SEL_BIGT_LOG') >= 0, '结果必须写进 `meta.recipe.selBigT`（否则"改没改判"只能靠读日志）');
  const dir = mkdtempSync(join(tmpdir(), 'd221-'));
  const run = function (env, tag) {
    const out = join(dir, tag + '.js');
    const r = spawnSync(process.execPath, ['tools/train-3p.mjs', '6', '3', '8', '6'], {
      env: Object.assign({}, process.env, { EPIRUS_SEED: '21', EPIRUS_ARM: 'd221' + tag, EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: out, EPIRUS_PUBLISH: '' }, env || {}),
      encoding: 'utf8', timeout: 300000
    });
    return { r: r, out: out };
  };
  const metaOf = packMetaOf;   /* v1.7.67：实现只有一份（`_ctx.mjs`） */
  const weightsOf = function (p) {
    const m = /"a":\[([^\]]*)\]/.exec(readFileSync(p, 'utf8'));
    return m ? m[1] : 'NOPARSE';
  };
  /* ① 关档 ⇒ recipe 写 null；② 开档但**带内零剂量**（6 代的小训练里没人够得着 5 珠）⇒ **冠军必须逐字不变** + 响亮印"零作用" */
  const off = run({}, 'off'), on = run({ EPIRUS_SEL_BIGT: '2' }, 'on');
  eq(off.r.status, 0, '关档要跑得通（实测 ' + off.r.status + '）');
  eq(on.r.status, 0, '开档要跑得通（实测 ' + on.r.status + ' · ' + String(on.r.stdout || '').slice(-140) + '）');
  const mOff = metaOf(off.out), mOn = metaOf(on.out);
  ok(!!mOff && !!mOn, '两遍都要能读出 META（读不出 = 这条门自己瞎了）');
  eq(mOff.recipe.selBigT, null, '关档必须写 null（一行都不跑）');
  const lg = mOn.recipe.selBigT;
  ok(lg && lg.zeroDose === true, '6 代的小训练里带内应当零剂量 ⇒ 必须报 zeroDose（实测 ' + JSON.stringify(lg) + '）');
  ok(/带内一张贵卡都没打过/.test(String(on.r.stdout || '')), '零作用必须**响亮印出来**（静默等效比静默报错危险，§E192）');
  eq(weightsOf(off.out), weightsOf(on.out), '**零剂量时不许换冠军**：换了 = 这根键在没有证据的情况下动了判定');
  /* ③ 排序键真咬到：把"贵卡"换成 `gun`（枪永远有人打）⇒ 用量必非零，且 `picked` 必须等于带内最大值 */
  const gun = run({ EPIRUS_SEL_BIGT: '2', EPIRUS_SEL_BIGT_KEYS: 'gun', EPIRUS_SEL_BIGT_MODE: 'multi' }, 'gun');
  eq(gun.r.status, 0, 'gun 档要跑得通');
  const gl = metaOf(gun.out).recipe.selBigT;
  ok(gl && gl.zeroDose === false, 'gun 档必须量到非零用量（否则"取最大"这句没被检验过：' + JSON.stringify(gl) + '）');
  ok(gl && gl.usage && gl.usage.length && gl.picked === Math.max.apply(null, gl.usage),
    '`picked` 必须 = 带内用量最大值（实测 picked=' + (gl && gl.picked) + ' usage=' + JSON.stringify(gl && gl.usage) + '）⇒ 否则排序键根本没咬');
  /* ④ 非法卡名必须响 */
  const bad = run({ EPIRUS_SEL_BIGT: '2', EPIRUS_SEL_BIGT_KEYS: 'nosuchcard' }, 'bad');
  eq(bad.r.status, 7, '不认识的卡名必须 exit 7（实测 ' + bad.r.status + '）');
});

t('D222 费用表反事实旗标 `--bigtcost=`（v1.5.327 · §E255）：不设 ⇒ 逐字不变 · 出厂价档 ⇒ **零剂量逐字相同** · 生效与否由**引擎回读**判而不是由配置印了没印判 · 假值必须 exit 2 · 落盘表头必须带这一维', function () {
  /* 为什么钉这道：这是本仓第一次把**规则参数**（大雷单价）做成研究旗标。
   * 后果两向都坏：静默不生效 ⇒ 我把"出厂世界"当成"4 珠世界"报给用户裁定（那是**错的裁定输入**）；
   * 静默生效 ⇒ `eval-5p` 历史读数全部换尺（D197 那一族的反面）。
   * ⚠ 判"生效"不许用 banner 出现与否（那是自我印证），必须用**引擎自己的定价回读**（`computeCost` 报的 ep）。
   * ⚠ 判"没生效"的对照必须是**同种子同场**的差分（绝对量守卫会杀掉正对照，METHODOLOGY 那一族）。 */
  const src = readFileSync('tools/eval-5p.mjs', 'utf8');
  ok(src.indexOf('FLAG.bigtcost') >= 0, '① `eval-5p` 里已经没有 `FLAG.bigtcost` ⇒ 旗标被删了而记账（CHANGELOG §E255）还写着有');
  /* v1.7.73 · gate-sentinel ③ 分诊：摘掉 `indexOf('改价没生效')`（措辞）。本门**真跑**反事实臂去量"改价有没有生效"，
   *   那才是判据；源码里那句提示只是它的措辞 ⇒ 留 `computeCost`（接线在不在）就够。 */
  ok(src.indexOf('computeCost') >= 0,
    '② 缺"由引擎回读新价"那条自检 ⇒ 定价若被别处缓存，工具会印"已生效"而跑的仍是出厂世界');

  const runE = function (extra, tag) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '6', '5', '77000', '--field=mix4'].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  /* §E275：v1.5.333 起大雷档是**引擎默认**，而带研究旗标的臂会被工具自动顶回 0 ⇒
   *   基线必须**显式 `--shipbigt=0`**，否则这格比的就是"默认开着"与"旗标顶回 0"两个世界（实测 np 就是这么红的）。
   *   比的仍是同一件事：`--bigtcost=5` 这根键在不改价时动不动判定。 */
  const base = runE(['--shipbigt=0'], 'base');
  eq(base.code, 0, '⓪ 默认臂必须跑通（否则下面三条差分对照全在比错误输出）：' + base.out.slice(0, 200));
  ok(base.out.indexOf('bigtcost') < 0, '③ 关档（不设旗标）**一行都不许印** ⇒ 印了就是"看起来像改了价"的噪声');

  /* ④ 零剂量：出厂价档 `--bigtcost=5` 与不设 ⇒ **剥掉 banner 行后逐字相同**（这根键不咬就不许动任何一个读数） */
  const w5 = runE(['--bigtcost=5'], 'w5');
  eq(w5.code, 0, '出厂价档不该报错：' + w5.out.slice(0, 200));
  /* ⚠ 剥掉两类**与判定无关**的行才能比"逐字相同"：banner 本身（`[bigtcost]` 与 `[shipbigt]` 两族），和 `eval-5p` 末行的**墙钟**（`耗时 0.0s` ‖ `0.1s` 两次跑就会差）。
   *    这条门第一次整轮认证就红在腿 ⑥（624s 那一趟），根因正是我没剥墙钟行 —— 小样本两次跑的耗时常常撞在一起 ⇒ 独立复跑看不出来，
   *    整轮抢核时才暴露（§E257 那条"未归因的红"事后归因到了这里：**是门错，不是抖动**）。 */
  const strip = function (s) { return s.split('\n').filter(function (l) {
    return l.indexOf('[bigtcost]') !== 0 && l.indexOf('[shipbigt]') !== 0 && l.indexOf('[shipdrain') !== 0 && l.indexOf('耗时') !== 0;
  }).join('\n'); };
  ok(w5.out.indexOf('[bigtcost]') === 0 || w5.out.split('\n').some(function (l) { return l.indexOf('[bigtcost]') === 0; }),
    '⑤ 开档必须响亮印一行 banner（不印 ⇒ 我没法从输出判断这一臂在哪个世界）');
  eq(strip(w5.out), strip(base.out), '⑥ **出厂价档必须零剂量**：`--bigtcost=5` 去掉 banner 后与不设旗标逐字相同（不同 ⇒ 这根键在没有改价时也动了判定）');

  /* ⑦ 生效判据 = 引擎回读的数字，不是 banner 的措辞 */
  const w1 = runE(['--bigtcost=1'], 'w1'), w99 = runE(['--bigtcost=99'], 'w99');
  ok(/ep=1\b/.test(w1.out), '⑧ `--bigtcost=1` 的世界必须让 `computeCost` 回读出 **ep=1**（实测没读到 ⇒ 定价被别处缓存，整个反事实是幻觉）');
  ok(/ep=99\b/.test(w99.out), '⑨ `--bigtcost=99` 的世界必须回读出 ep=99（同上）');
  /* ⑩ 落盘身份腿：改价与封卡都必须进表头 —— 配对尺只看表头，缺哪一维就会把"世界 4"与"世界 3"当成同世界配对着配（§E246 那一族）。
   *     ⚠ 这里**不**做"两个世界的读数必须不同"那种绝对量守卫：小样本里真可能一字不差，那会把正对照杀成假红（本仓踩过）。 */
  const dir = mkdtempSync(join(tmpdir(), 'd222-'));
  const dump = join(dir, 'h.tsv');
  const rd = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--pool=core', '--every=17',
    '--bigtcost=4', '--ban=bigT', '--dump-per=' + dump], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  eq(rd.status, 0, '⑩a 带 `--dump-per` 的改价+封卡臂必须跑通：' + String(rd.stderr || '').slice(0, 200));
  if (existsSync(dump)) {
    const headTxt = readFileSync(dump, 'utf8').split('\n').filter(function (l) { return l[0] === '#'; }).join('\n');
    ok(headTxt.indexOf('#bigtcost=4') >= 0, '⑩b 落盘表头必须带 `#bigtcost=`（跨世界配对必须能被拒）实测=' +
      (/^#bigtcost=.*$/m.exec(headTxt) || ['(缺)'])[0]);
    ok(headTxt.indexOf('#ban=bigT') >= 0, '⑩c 落盘表头必须带 `#ban=`（同臂自配与两臂差分的唯一区分处）');
  } else { console.error('⑩d 没落盘 ⇒ 这条腿退化成装饰，判红'); ok(false, '`--dump-per` 没写出文件'); }

  /* ⑪ 假值必须响亮拒绝，不许降级成"当没写" */
  for (const badv of ['abc', '-2', '1.5']) {
    const rb = runE(['--bigtcost=' + badv], 'bad');
    eq(rb.code, 2, '`--bigtcost=' + badv + '` 必须 exit 2（实测 ' + rb.code + '）⇒ 含糊写法被当出厂价跑完就是假世界');
  }
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
  const residualB = (b.fit - b.fitNoDiv) - (b.divBonus + 0.5 * b.styleRate - (b.seatPen || 0));
  ok(isFinite(b.seatPen), 'seatPen 必须照实报告（fit 的每个加项都要可审计，否则这条恒等式必然偶发红）');
  ok(Math.abs(residualB) < 1e-9,
    'fit 必须等于**全部**已报告加项之和（熵奖励 + w*styleRate - seatPen）；残差 ' + residualB.toFixed(6) +
    '（实测多出 ' + (b.fit - b.fitNoDiv).toFixed(6) + '，报告项合计 ' + (b.divBonus + 0.5 * b.styleRate - b.seatPen).toFixed(6) + '）');
  ok(Math.abs(b.fitNoDiv - a.fitNoDiv) < 1e-9,
    '切片必须是**追加**：池子那部分 fit 不得被改变（无切片 ' + a.fitNoDiv + ' vs 有切片 ' + b.fitNoDiv + '）');
  T.setStyleSlice(null, 0, 0);
  const c = T.scoreMemberN(p, opps, 2, 3, 1, 0, 0);
  ok(c.styleGames === 0 && Math.abs((c.fit - c.fitNoDiv) - (c.divBonus - (c.seatPen || 0))) < 1e-9, '关掉切片后必须完全回到无切片状态（只剩熵奖励 - seatPen）');
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

t('D104 「择优不得回归」必须是机械保证（而不是注释里的承诺）', function () {
  /* 病（v1.5.130 实测反例，`train2p.log`）：`train-best` 的择优原先只有 `sc` + 容差带 + 发散度三步，
   * 而 `evScore()` 的闸门罚项**在有洞时退化成常数**（`gateMin*0.4-1`，gateMin=0 ⇒ sc ≡ -1）
   * ⇒ 5 个候选 sc 全 -1、容差带 = 全部 ⇒ 择优实际由 `divNorm` 决定，
   * 实测把现有冠军（1 个洞：beadburst 0%）换成了更差的包（2 个洞：defend 0% / reflectspam 0%，avg 89%→85%）。
   * 而第 92 行的注释从 v1.5.18 起就一直写着"保证**绝不会**回归到比现有更弱的冠军"——**假承诺**。
   * 现在择优是纯函数（`tools/pick-best.mjs`），这里喂**合成候选表**验行为（不是钉排版）。 */
  const INC = { tag: INCUMBENT_TAG, sc: -1,
    ev: { avg: 0.89, per: { wall: 1.0, defend: 1.0, beadburst: 0.0, reflectspam: 0.9 } }, div: { divNorm: 0.201, distinct: 2 } };
  /* 那次运行里**被选中**的那个候选（数值逐条取自 `train2p.log`） */
  const REGRESS = { tag: '候选1', sc: -1,
    ev: { avg: 0.85, per: { wall: 0.70, defend: 0.0, beadburst: 0.93, reflectspam: 0.0 } }, div: { divNorm: 0.366, distinct: 5 } };
  const FIX = { tag: '候选X', sc: -1,
    ev: { avg: 0.88, per: { wall: 1.0, defend: 1.0, beadburst: 0.70, reflectspam: 0.9 } }, div: { divNorm: 0.22, distinct: 3 } };
  /* ① 回归数（冠军已过、却被候选打回 ≤50% 的条数）必须数得出来 */
  eq(regressionsOf(REGRESS, INC), 2, '「候选1」把冠军已过的 defend/reflectspam 打回 0% ⇒ 回归数必须是 2');
  eq(fixesOf(REGRESS, INC), 1, ' 且它确实新过了 1 条（beadburst 0%→93%）—— 修了洞也**不能**抵掉回归');
  eq(regressionsOf(FIX, INC), 0, '「候选X」不回归');
  eq(fixesOf(FIX, INC), 1, ' 且修好了那个洞');
  /* ② 回归型候选**不许**当选 —— 旧实现正会选它（发散度最大 0.366）。这是本条门的核心。 */
  eq(pickBestByExam([INC, REGRESS], { wrTol: 0.03 }).best.tag, INCUMBENT_TAG,
    '把冠军已过的基准打回 ≤50% 的候选一律不许当选（哪怕它修好了别的洞、发散度更大）');
  eq(pickBestByExam([INC, REGRESS], { wrTol: 0.03 }).dropped, 1,
    '该候选必须是被"不回归层"**剔除**的（而不是碰巧没被挑中）');
  /* ③ 0 回归且真修好了洞 ⇒ 必须能当选（否则修法本身成了障碍，这条线永远修不动） */
  eq(pickBestByExam([INC, FIX], { wrTol: 0.03 }).best.tag, '候选X', '0 回归且修好了洞的候选必须能当选');
  /* ④ 所有候选都有回归 ⇒ 现有冠军必须原样留下 */
  const ALLREG = { tag: '候选Y', sc: 0.2,
    ev: { avg: 0.95, per: { wall: 1.0, defend: 0.0, beadburst: 0.9, reflectspam: 0.9 } }, div: { divNorm: 0.9, distinct: 6 } };
  eq(pickBestByExam([INC, REGRESS, ALLREG], { wrTol: 0.03 }).best.tag, INCUMBENT_TAG,
    '全部候选都有回归 ⇒ 现有冠军必须留下（这才是"绝不回归"的实际含义）');
  /* ⑤ 现有冠军自身在不回归层里恒成立（否则会把自己剔掉 ⇒ 无包可用） */
  eq(regressionsOf(INC, INC), 0, '现有冠军对自己没有回归');
  eq(pickBestByExam([INC], { wrTol: 0.03 }).best.tag, INCUMBENT_TAG, '只有现有冠军时也必须选出它（不许抛）');
  /* ⑥ 单一来源：工具必须 import 这个纯函数 —— 否则上面这些用例测的是**另一份**实现 */
  const tb = readFileSync('tools/train-best.mjs', 'utf8');
  ok(tb.indexOf("from './pick-best.mjs'") >= 0, 'tools/train-best.mjs 必须从 pick-best.mjs 导入择优');
  ok(tb.indexOf('const regressOf = function') < 0, ' 且不许再内联一份 regressOf（两处实现必然漂移）');
  /* ⑦ v1.5.147（xfer44 反例）：带内排序主键 = hill05（Rényi-0.5 有效技能数），divNorm 退居末级。
   * 病形复刻：候选N"两件套打花"divNorm .194 / hill05 1.98，候选W"五件套一主四辅"divNorm .189 / hill05 3.1
   * ⇒ 旧序选 N（0.005 的采样熵噪声定冠军），新序必须选 W。 */
  const INC7 = { tag: INCUMBENT_TAG, sc: 0.90, ev: { avg: 0.99, per: { wall: 1.0 } }, div: { divNorm: 0.10, distinct: 2, hill05: 1.5 } };
  const NARROW = { tag: '候选N', sc: 0.90, ev: { avg: 0.99, per: { wall: 1.0 } }, div: { divNorm: 0.194, distinct: 2, hill05: 1.98 } };
  const WIDE = { tag: '候选W', sc: 0.89, ev: { avg: 0.98, per: { wall: 1.0 } }, div: { divNorm: 0.189, distinct: 5, hill05: 3.1 } };
  eq(pickBestByExam([INC7, NARROW, WIDE], { wrTol: 0.03 }).best.tag, '候选W',
    '带内（胜率差在容差内）必须选 hill05 更大的广包 —— divNorm 更高但 hill05 更低的窄包不许赢（0921 xfer44 实测反例）');
  /* ⑧ 旧对象没有 hill05 列 ⇒ 退回 distinct→divNorm 的老序（历史可比性不许被打破） */
  const OLDA = { tag: '候选A', sc: 0.9, ev: { avg: 0.99, per: {} }, div: { divNorm: 0.30, distinct: 2 } };
  const OLDB = { tag: '候选B', sc: 0.9, ev: { avg: 0.98, per: {} }, div: { divNorm: 0.20, distinct: 5 } };
  eq(pickBestByExam([OLDA, OLDB], { wrTol: 0.03 }).best.tag, '候选B', '无 hill05 列时按 distinct 退回（种类多者赢）');
  /* ⑨ 带内候选必须全部落盘（D82 精神：落选者也是证据）—— 行为式钉：train-best 源码里存在 band-save 写盘点 */
  ok(tb.indexOf("ARM + '-band'") >= 0 && tb.indexOf('selected: c === best') >= 0,
    'train-best 必须把容差带内每一粒写成 <arm>-band<k>.bak 并标 selected（候选3 那种"死了都没碑"不许再有）');
  /* ⑩ 夜班（seed 11 反例）：`vetoDegenerate` 双向验——不开时退化包凭 avg=100% 必当选（量具有判别力），
   * 开了必须把它踢下去、由正常候选继承。 */
  const INC10 = { tag: INCUMBENT_TAG, sc: 0.8, ev: { avg: 0.98, per: { wall: 1.0 } }, div: { divNorm: 0.2, distinct: 3, hill05: 2.0 } };
  const DEGEN = { tag: '候选D', sc: 0.99, ev: { avg: 1.00, per: { wall: 1.0 } }, div: { divNorm: 0, distinct: 0, hill05: 0 } };
  const OK10 = { tag: '候选O', sc: 0.82, ev: { avg: 0.98, per: { wall: 1.0 } }, div: { divNorm: 0.3, distinct: 4, hill05: 2.8 } };
  eq(pickBestByExam([INC10, DEGEN, OK10], { wrTol: 0.03 }).best.tag, '候选D',
    '不开闸时退化包凭考卷分必当选（证明该反例真实存在、闸有东西可挡）');
  eq(pickBestByExam([INC10, DEGEN, OK10], { wrTol: 0.03, vetoDegenerate: true }).best.tag, '候选O',
    '开 vetoDegenerate 后：种类=0 的退化包取消资格，正常候选继承（现有冠军/闸内豁免不许被误杀）');
  eq(pickBestByExam([INC10], { wrTol: 0.03, vetoDegenerate: true }).best.tag, INCUMBENT_TAG,
    '现有冠军即使 distinct=0 也恒在层内（闸不打破 D104 的冠军豁免承诺）');
});

t('D114 §N6 跨 N 混适应度：默认关（行为逐字）+ 接线三钉（夜班 09-22 · 时间盒=只实现+smoke）', function () {
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf("process.env.EPIRUS_XN2W || 0") >= 0, 'EPIRUS_XN2W 必须默认 0（未设 ⇒ 一条行为不变）');
  ok(t3.indexOf('if (XN2W > 0 && N > 2)') >= 0, '2P 切片只许在 W>0 且主场 N>2 时追加（2P 主场自己混自己 = 无意义）');
  ok(t3.indexOf("T.setTrainMode('standard')") >= 0 && t3.indexOf('T.setTrainMode(prevMode)') >= 0,
    '切片必须临时切 standard 并**复原**（半开事故族：fight-env/econ-env 的前车）');
  /* 行为面：默认关时混入代码不可达 ⇒ 用一个 2 代微跑对照 W=0 与"未装此代码"同分不实测（CPU 紧），
   * 这里退而求其次：验证 setTrainMode/trainMode 真在 EpirusTrainer 导出面上（否则上面全是死代码）。 */
  ok(typeof T.setTrainMode === 'function' && typeof T.trainMode === 'function', 'evo 必须导出 setTrainMode/trainMode');
});

t('D119 热启动不许静默失败（v1.5.153 · DS）：两种外壳都认 + 读不出种子必须 exit 5 —— 否则整臂白跑', function () {
  /* 病（DS 09-22 实测 · 两臂白跑）：`tools/train-3p.mjs` 的热启动正则只认 `window.EPIRUS_CHAMPION_3P`，
   * 而 `train-best` 产的包是 **2P 外壳** `window.EPIRUS_CHAMPION` ⇒ `EPIRUS_SEEDPACK=<2P 包>` 时
   * `try/catch` **静默不热启动** ⇒ 臂 7/臂 8（跨 N 的 W 轴与排练轴）实际是**冷启动**跑的 ✗ ——
   * 预注册前提没成立、两条结论作废，直到做锚定正则时 `距种子` 一直不打才发现。
   * ⇒ 本条钉两件事：① 兼容两种外壳；② **明确要了热启动却读不出 ⇒ exit 5**（与 `EPIRUS_XN2REF` 同规矩）。 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3.indexOf('window\\.EPIRUS_CHAMPION(?:_3P)?') >= 0, '热启动必须兼容两种外壳（2P 壳 = train-best 的产物）');
  ok(t3.indexOf('拒绝静默冷启动') >= 0 && t3.indexOf('process.exit(5)') >= 0,
    '读不出种子必须 exit 5（静默冷启动会让整臂白跑且看起来"有结果"）');
  ok(t3.indexOf('热启动：以现有冠军为种子') >= 0, '生效时必须打印那一行（非空枪自检就靠它）');
  /* 行为式：坏种子 ⇒ exit 5（训练前就退出，不写任何产物）。 */
  const bad = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_HOTSTART: '1', EPIRUS_SEEDPACK: 'no/such/seed.bak' }), encoding: 'utf8', timeout: 120000 });
  ok(bad.status === 5, '坏种子必须 exit 5（实测 exit=' + bad.status + '）');
});

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
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd127off', EPIRUS_BAND_DIR: dirA, EPIRUS_T3P_OUT: join(dirA, 'd127off.js') }), encoding: 'utf8', timeout: 300000 });
  eq(off.status, 0, '默认关必须跑通');
  eq(wh(join(dirA, 'd127off.js')), CLI_ARM_BASELINE, '默认关的产物必须仍是那条基线（动了它 = 所有 CLI 臂的当选规则被偷改）');
  const on = spawnNC(['tools/train-3p.mjs', '3', '3', '6', '4'],
    /* §E654：这条臂原先**只改了 BAND_DIR 没改落点** ⇒ 它把 D123/D162 逐字比对的基线覆盖掉了
     *   （运行时台账抓到：`d127on` 于 14:50:38 与 06:50 那轮各写一次 `docs/artifacts/train-3p-out.js`，
     *   同一趟 D162 就报 `got≠want`）。孪生的 off 臂一直有 `EPIRUS_T3P_OUT`（上一行），on 臂是漏的那一条。 */
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd127on', EPIRUS_SEL_LAND: '1', EPIRUS_BAND_DIR: dirB, EPIRUS_T3P_OUT: join(dirB, 'd127on.js') }), encoding: 'utf8', timeout: 300000 });
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
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd130on', EPIRUS_COUNTER_OPPS: '1', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: D130OUT }), encoding: 'utf8', timeout: 300000 });
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
    { env: Object.assign({}, process.env, { EPIRUS_SEED: '7', EPIRUS_ARM: 'd130one', EPIRUS_COUNTER_OPPS: 'snipeSpam', EPIRUS_BAND_DIR: dir, EPIRUS_T3P_OUT: D130ONE }), encoding: 'utf8', timeout: 300000 });
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
  eq(Math.max.apply(null, castLines), 0, '没有示范 ⇒ 该席大雷出手必须恒 0（实测最大 ' + Math.max.apply(null, castLines) + '）');
  ok(!/连带=([1-9]\d*) 条/.test(out2), '没有示范 ⇒ 一条链都不许出现（出现就说明分子数到了别人/注入之外的东西）');
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

t('D120 CLI 训练器上的 EPIRUS_* 开关不许"传了没人读"（§N8b · qoder 09-22 空转臂反例）', function () {
  /* 病：`EPIRUS_CLEAR_W` 只接在 train-server/worker；train-3p CLI 读了 env 也没人调 setter ⇒
     09-22 臂 a 的"单变量"实为**逐字节复现 7′**（同种子 ⇒ 连门读数都一模一样，幸而当场看穿）。
     与 v1.5.153 热启动静默同族。门两半：① setter 行为（打进/复位）；② train-3p 的接线与 exit-5 拒绝存在。 */
  const w0 = T.clearReward ? T.clearReward().w : 0;
  const got = T.setClearReward(0.1);
  eq(Number(got), 0.1, 'setClearReward(0.1) 必须回读 0.1（生效值 ≠ 请求值 ⇒ 静默钳位在骗人）');
  T.setClearReward(0);   // 复位：不污染后面的门
  const t3src = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(t3src.indexOf('EPIRUS_CLEAR_W') >= 0 && t3src.indexOf('setClearReward') >= 0,
    'train-3p 必须读 EPIRUS_CLEAR_W 并打进本沙箱 evo（CLI 与 server 两条入口同口径）');
  ok(t3src.indexOf('拒绝静默空转') >= 0, '开关 >0 但 setter 拒绝 ⇒ 必须 exit 5 响亮（同 D119 规矩）');
  T.setClearReward(w0);
});

t('D144 墙上时钟上限：`EPIRUS_WALL_MS=0` 必须是**关闭**（v1.5.200）—— 此前它第一次检查就判超时、训练当场中止，与它自己的注释正好相反', function () {
  /* 病（本轮实测）：`server/train-server.mjs` 两处 `if (Date.now() - t0 > cap)` 都**没有 `cap > 0` 这一半**，
   * 而同文件 :247/:476 的注释写着「EPIRUS_WALL_MS=0 关闭（纯按代数收敛）」。我拿它去关上限时被它打成两轮空炮
   * （SSE 直接回 `训练超时上限（30 分钟）`、一代都没跑）。语义收进纯函数 ⇒ 门喂合成值即可判，不必真等 30 分钟。 */
  eq(wallCapExceeded(0, 1e12), false, 'cap=0 必须是**关闭**（旧写法此刻判超时 —— 这就是被修的那条）');
  eq(wallCapExceeded(-1, 1e12), false, 'cap<0 也是关闭');
  eq(wallCapExceeded(NaN, 1e12), false, 'cap=NaN 不许静默变成"永远超时"');
  eq(wallCapExceeded(1800000, 100), false, '未到上限不许判超');
  eq(wallCapExceeded(1800000, 1800001), true, '过了上限必须判超（别把闸修成死的）');
  eq(wallCapOf({}), 1800000, '缺省仍是 30 分钟（改了 = 历史行为变）');
  eq(wallCapOf({ EPIRUS_WALL_MS: '0' }), 0, '显式 0 要原样传下去（不许 \|\| 之类把它变成默认值）');
  const sv = readFileSync('server/train-server.mjs', 'utf8');
  eq((sv.match(/wallCapExceeded\(cap, Date\.now\(\) - t0\)/g) || []).length, 2, '两处（2P 与 N 人）都必须走 wallCapExceeded');
  ok(sv.indexOf('Date.now() - t0 > cap') < 0, '不许再留裸的 `Date.now() - t0 > cap`（缺 cap>0 的那一半）');
  ok(sv.indexOf('wallCapOf(process.env)') >= 0, '上限的读取也必须走单一来源（默认值与判定不许两处各写一遍）');
});

t('D157 确定性重活的缓存必须**内容寻址**、**响亮**、且不许把"没跑"伪装成"过了"（v1.5.225 · 用户批准方案 a）', function () {
  /* 病：D134/D135/D136 里的训练臂是**确定性**的（固定 seed + 固定 env + 固定输入），却每次全量重跑 ——
   * 实测（**v1.5.225 当时**）D135 一条 41.4 秒、D134 16.1、D136 13.8，合计约 71 秒；而绝大多数提交根本没碰训练侧。
   *   ⚠ 这三个数是**改法之前**的读数（此后当选键默认改 4 粒、缓存腿又绕开 seed 钉值）⇒ 现数见 `docs/GATE-SHIFTS.md` 真源表，别引用这一行。
   * 危险不在"慢"，在**修错方向**：把"门跑过"变成"门认定输入没变"就是 D58/D59 那族"静默跳过"的新外衣。
   * ⇒ 所以本门判三件：① 键必须是**内容**（不是路径/时间）；② 只缓存 (status,stdout,stderr) 且**断言照旧跑**；
   *   ③ 命中必须**响亮**（独立一行 + 收尾计数），且有 `NP_NOCACHE=1` 逃生口。 */
  const src = npSourceAll();   /* v1.7.8：runner + _ctx + 16 个部件合起来才是「这个程序」的源码面 */
  /* §E566（千问）：这条原来钉的是**逐字顺序** `{ spawnCached, inputHash, cacheStats }` ⇒ 今晚我往里加一个名字就当场红
   *   （钉拼写不钉语义 —— 与 §2026-10-11 摘掉的那两条"数名字出现次数"同族，只是这次咬到的是我自己）。
   *   改成钉"从 np-cache 导入 spawnCached"这件事：加别的名字算接上，删掉导入照样红。 */
  ok(/import\s*\{[^}]*\bspawnCached\b[^}]*\}\s*from\s*'\.\.\/np-cache\.mjs'/.test(src),
    'np-test（拆分后：前导在 _ctx.mjs）必须从 `../np-cache.mjs` 导入 spawnCached（往里加别的名字不算红，删掉导入才算红）');
  /* 门里**绝不许**把缓存计数器清零：那会把收尾"命中 N 次 · 省下 X 秒"抹掉 —— D157 第一版就这么把自己的成绩抹了
   * （热跑明明省 140+ 秒，收尾却印"命中 2 次 · 省 0.2 秒"）。
   * ⚠️ 判的是**整份源码里不许出现那个名字**（含注释）：v1.5.225 试过"逐行过滤掉注释行"，被 `/*` 与字符串骗了两次。 */
  ok(!src.includes('cache' + 'Reset'), '整个门体面（runner + _ctx + 16 个部件）里不许出现缓存清零的那个 API 名（连注释也别提，免得断言与注释打架）');
  /* 计数断言用**下限**而不是等号：本版只接了 7 条 train-3p，以后扩到别的确定性 spawn 是**好事**，
   * 写成 `=== 4` 会在扩展时无故变红（门不该阻止自己被扩）。 */
  /* §2026-10-10 DS：这条腿原来要求「至少四条最重的训练臂要走缓存」—— **那条要求本身是错的** ✗：
   *   那四条重臂（40/60/60/30 代）正是**断言要读子进程产出文件**的门（D134/D135/D136/D137）⇒ 缓存命中时子进程不跑 ⇒
   *   它们读的是**上一次留下的文件** ⇒ 可双向骗人（Claude 整改建议 §门禁「现在要修的问题」· METHODOLOGY 117）。
   *   所以现在要求的是**反过来的**那条：读产出的门必须走 spawnNC（nocache）。判据仍用**下限**，免得扩面时无故变红。 */
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
  ok(/缓存：命中 ' \+ __cs\.hit/.test(src), '收尾必须印命中数与省下的秒数（亮不亮要看得见）');
  const mod = readFileSync('tools/np-cache.mjs', 'utf8');
  ok(/NP_NOCACHE/.test(mod) && /export function spawnCached/.test(mod) && /createHash\('sha1'\)/.test(mod),
    '模块必须有逃生口 + sha1 内容键');
  ok(!/pass|fail|PASS|FAIL/.test(mod.replace(/[\s\S]*?## ⚠️/, '')), '模块**绝不许**缓存"通过/失败"（只许缓存 status/stdout/stderr）');

  /* ===== 行为断言（不是钉文本）：键的四种敏感性 ===== */
  const k1 = inputHash(['--probe-a'], { EPIRUS_X: '1' });
  eq(k1, inputHash(['--probe-a'], { EPIRUS_X: '1' }), '同一个 argv+env 必须给同一个键（否则永不命中）');
  ok(k1 !== inputHash(['--probe-b'], { EPIRUS_X: '1' }), 'argv 变 ⇒ 键必须变');
  ok(k1 !== inputHash(['--probe-a'], { EPIRUS_X: '2' }), 'EPIRUS_* 值变 ⇒ 键必须变（旋钮就是靠这个）');
  /* **内容敏感**这条最要紧：同一个路径、同一份大小，只改一个字节，键就必须变
   * （否则"改了源码却复用旧结果"就是必然事故） */
  const d = mkdtempSync(join(tmpdir(), 'd157-'));
  const tf = join(d, 'fake-input.mjs');
  writeFileSync(tf, 'const A = 1;\n');
  const kA = inputHash([tf], {});
  writeFileSync(tf, 'const A = 2;\n');
  const kB = inputHash([tf], {});
  ok(kA !== kB, '**同一个路径、只改一个字节 ⇒ 键必须变**（这条挂了就等于"改了源码还复用旧结果"）');

  /* **临时路径必须被归一化**（这条是 v1.5.225 我自己连栽两版的坑，必须由门钉住）：
   * 训练臂传 `EPIRUS_BAND_DIR = mkdtempSync(...)`，**每次随机** ⇒ 若不折成 `<TMP>`，键每次都变、缓存永不命中
   * （第一版冷跑写 4 条、热跑又写 4 条新条目；第二版只折了前缀、没折 `mkdtemp` 的随机后缀，照样不命中）。 */
  const e1 = { EPIRUS_SEED: '31', EPIRUS_BAND_DIR: join(tmpdir(), 'd134-AAA') };
  const e2 = { EPIRUS_SEED: '31', EPIRUS_BAND_DIR: join(tmpdir(), 'd134-BBB') };
  const e3 = { EPIRUS_SEED: '32', EPIRUS_BAND_DIR: join(tmpdir(), 'd134-AAA') };
  eq(inputHash(['tools/train-3p.mjs'], e1), inputHash(['tools/train-3p.mjs'], e2),
    '同一个旋钮、只有**临时输出目录不同** ⇒ 键必须相同（否则缓存永远不命中）');
  ok(inputHash(['tools/train-3p.mjs'], e1) !== inputHash(['tools/train-3p.mjs'], e3),
    '旋钮值真变了（EPIRUS_SEED 31→32）⇒ 键必须变');

  /* ===== 命中/未命中行为：命中必须给出**与真跑逐字相同**的输出 =====
   * ⚠️ 用**差值**判、绝不清零计数器 —— 清零会把收尾"命中 N 次 · 省下 X 秒"的成绩抹掉
   * （v1.5.225 第一版就犯了这个：热跑明明省了 142 秒，收尾却印"命中 2 次 · 省 0.2 秒"）。 */
  /* §2026-10-10 DS（Claude 整改建议 §门禁「现在要修的问题」第 5 条）：NP_NOCACHE=1 与下面这条「第二次必须命中」天然互斥 ⇒
   *   用户显式要冷跑时，这条自证**响亮跳过**（不算通过也不算失败）—— 而不是把「无缓存审计」判成红。
   *   （旧病：千问 METHODOLOGY 124 记过同一件事 —— 要冷跑得换一棵树或清空 TMPDIR，否则拿不到全绿。） */
  if (process.env.NP_NOCACHE) throw new Skip('你设了 NP_NOCACHE=1（要求冷跑）⇒ 这条缓存自证无法进行 ⇒ 跳过；要验缓存请先去掉它');
  const cs0 = cacheStats();
  const argv = ['-e', 'process.stdout.write("cache-probe-42")'];
  const r1 = spawnCached(argv, { encoding: 'utf8' });
  const r2 = spawnCached(argv, { encoding: 'utf8' });
  const cs = cacheStats();
  ok(cs.hit - cs0.hit >= 1, '第二次必须**命中**（实测本次增量 ' + (cs.hit - cs0.hit) + '）');
  eq(r2.status, r1.status, '命中与真跑的 status 必须一致');
  eq(String(r2.stdout), String(r1.stdout), '命中与真跑的 stdout 必须逐字一致');
  /* 逃生口的行为断言：设上之后必须**真跑**（命中数不许再涨） */
  const bak = process.env.NP_NOCACHE;
  process.env.NP_NOCACHE = '1';
  const r3 = spawnCached(argv, { encoding: 'utf8' });
  ok(String(r3.stdout) === String(r1.stdout) && cacheStats().hit === cs.hit,
    '`NP_NOCACHE=1` 时必须**真跑**（命中数不许再涨）');
  if (bak == null) delete process.env.NP_NOCACHE; else process.env.NP_NOCACHE = bak;

  /* ===== 行为断言：`opts.outputs`（"命中时连子进程产出的文件一起还原"）的语义 =====
   * §2026-10-11 千问复核 · 待办②。为什么这条必须存在：`b371306` 把 6 处 `outputs` 声明删光之后，
   *   这套能力**既没有调用者也没有测试** ⇒ 它坏掉不会有任何东西响（而 §九 的结论是"读产出的门将来要接回缓存得靠它"）。
   * 三条各自都能红，缺一条就是假绿：
   *   ① 真跑 ⇒ 产出落在声明的路径里；
   *   ② 命中 ⇒ 把**本次被删掉的**产出还原回来，而且**不靠重跑子进程**；
   *   ③ 盒子里少一项 ⇒ **不再算命中**（回退真跑）—— 这正是 `cb20df1` 补的那个洞，补之前它是"跳过那一项照样命中"。
   * ⚠️ 为什么不再拿"第二遍门仍绿"当 sound 判据：只读 stdout 的门，盒子对/错/整个缺失，第二遍**都是绿的**
   *   （今晚实测 6 处声明里 5 处挂在这种腿上、1 处挂在原生 `spawnSync` 上被静默忽略，两遍验全程绿 ⇒ 它证不了任何事）。
   * ⚠️ 观测点：`counter.txt` **故意不声明进 outputs** ⇒ 它只随真跑递增，于是"有没有偷偷重跑"是可数的。 */
  const oScratch = mkdtempSync(join(tmpdir(), 'd157o-'));
  const oDir = join(oScratch, 'out'), oCnt = join(oScratch, 'counter.txt'), oTool = join(oScratch, 'w.mjs');
  writeFileSync(oCnt, '0');
  writeFileSync(oTool, "import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';\n"
    + "const d = process.argv[2], c = process.argv[3];\nmkdirSync(d, { recursive: true });\n"
    + "const n = Number(readFileSync(c, 'utf8')) + 1; writeFileSync(c, String(n));\n"
    + "writeFileSync(d + '/f.txt', 'payload-' + n);\n");
  const oArgv = [oTool, oDir, oCnt], oOpts = { outputs: [oDir], encoding: 'utf8', timeout: 120000 };
  const oFile = () => (existsSync(join(oDir, 'f.txt')) ? readFileSync(join(oDir, 'f.txt'), 'utf8') : '缺');
  const oRuns = () => Number(readFileSync(oCnt, 'utf8'));
  const oBox = join(cacheDir(), inputHash(oArgv, oOpts.env) + '.out');

  const o1 = spawnCached(oArgv, oOpts);
  eq(o1.status, 0, '① 声明 outputs 的 spawn 要跑得通（status=' + o1.status + ' ' + String(o1.stderr || '').slice(0, 120) + '）');
  ok(/^payload-/.test(oFile()), '① 真跑必须把产出写进声明的路径（实测 ' + oFile() + '）');
  if (!existsSync(join(oBox, '0'))) throw new Skip('缺缓存产出盒（被轮换掉了，或同机正有第二遍整轮在跑）⇒ ②③ 不可判：' + oBox);
  const runs0 = oRuns(), v1 = oFile();

  rmSync(join(oDir, 'f.txt'));                       /* 毁掉本次产出，逼"命中"这条路径自己证明它还原了 */
  const o2 = spawnCached(oArgv, oOpts);
  ok(o2.__cached === true, '② 同输入第二遍必须命中（没命中 ⇒ 键不稳，那是另一条腿管的病）');
  eq(oFile(), v1, '② 命中必须把被删掉的产出**还原回本次路径**（实测 ' + oFile() + ' 应为 ' + v1 + '）');
  eq(oRuns(), runs0, '② 还原不许靠重跑子进程（真跑次数必须还是 ' + runs0 + '，实测 ' + oRuns() + '）');

  rmSync(join(oBox, '0'), { recursive: true, force: true });   /* 假装"上次只存了一半" */
  const o3 = spawnCached(oArgv, oOpts);
  ok(o3.__cached !== true, '③ 盒子里少一项必须**不再算命中**（回退真跑）—— 命中却交出一份没还原的产出就是假绿');
  eq(oRuns(), runs0 + 1, '③ 回退必须真的重跑了一次（实测真跑次数 ' + oRuns() + '，应为 ' + (runs0 + 1) + '）');
  /* 不用手工还原现场：o3 真跑之后 captureOutputs 自己先 rmSync(box) 再整盒重写 */
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

t('D174 econ 通用下达：**名单驱动** + **逐键回执比对**（不一致 exit 7）+ 位置在 T 之后 + 禁止 typeof 静默守卫（v1.5.262 · §24）', function () {
  /* 动因（本班 §24 的根因）：`train-3p` 原来对 econ 键**逐个键各写一块**下达代码 ⇒
   * 新登记进名单的键（`costlyW`）**通过了黑键闸却从没送给引擎** ⇒ 三族实验（0/0.05/0.2 · 长程场 · 从会出贵卡的粒出发）
   * 全部跑出**逐字节相同**的权重 —— 看起来像"压力无效"，实际是"**线根本没接**"。
   * 本门钉五条，缺一条就会退回那种"静默无效果"的状态。 */
  const T3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/import \{[^}]*ECON_REWARD_KEYS[^}]*\} from '\.\.\/server\/econ-env\.mjs'/.test(T3),
    '必须从**单一来源** import ECON_REWARD_KEYS（第一版漏了它 ⇒ 静默空转）');
  ok(/for \(const k of ECON_REWARD_KEYS\) if \(eff\[k\] != null\) payload\[k\] = eff\[k\];/.test(T3),
    '下达内容必须**由名单驱动**（不许再逐个键手写一块 —— 那正是新键从来不发的原因）');
  ok(/T\.setEconomyReward\(payload\)/.test(T3), '必须真的调 setEconomyReward');
  ok(/const miss = Object\.keys\(payload\)\.filter/.test(T3) && /if \(miss\.length\)/.test(T3),
    '**逐键回执比对**必须有：不一致就 exit 7 —— 这是"下达了但没生效"的唯一自动防线');
  const iT = T3.indexOf('const T = sb.window.EpirusTrainer;');
  const iD = T3.indexOf('econ 族通用下达');
  ok(iT >= 0 && iD > iT, '下达块必须在 **T 装配之后**（第一条修复尝试放在文件顶部 ⇒ 连日志都没出来）');
  ok(T3.indexOf("typeof ECON_REWARD_KEYS !== 'undefined'") < 0,
    '【本班教训】禁止 `typeof <常量> !== undefined` 这种**静默守卫**：它把"接线 bug"变成"静默无效果"（我在这条路上栽了两次）');
});

/* ===== D175（qoder 09-28 夜班 §E65b）：econ 族的**两条接线卫生**必须判在效果上 =====
 * 动因（今天实测推翻的一条结论）：09-27 那三档 `costlyW`（0/0.05/0.2）跑出逐字节相同的产物，被写成
 * "`bigUses` 在训练评分局里恒为 0 ⇒ 这条杠杆**结构性惰性**"。真相是 `evo.js` 把**累加本身**包在
 * `if (BIGCARD_W > 0)` 里 ⇒ 只开 `costlyW` 的臂剂量恒 0 是**开关造成的**，不是训练场造成的（同 §24 的"闸放行≠线接通"）。
 * 同一次审计还抓出 `setEconomyReward({reset:true})` 的手写名单**漏了 5 个键**
 * （`divW/divK/divRoleW/divForceGens/costlyW`）⇒ 同进程后续所有评分都活在哨兵脏值里。
 * 本门不钉源码文本（文本会重构掉），钉三件**行为**：剂量在权重全 0 时仍可见、开档必须改变 fit、reset 必须逐位可逆；
 * 外加"臂上必须印剂量"与"名单驱动 ⇒ 新键不可能被忘记"。 */
t('D175 econ 接线卫生：贵卡计数**不受权重门控** + costlyW 到作用点 + reset 名单驱动全覆盖（v1.5.265 · §E65b）', function () {
  const dir = mkdtempSync(join(tmpdir(), 'd175-'));
  const outJson = dir + '/audit.json';
  const r = spawnSync(process.execPath, ['tools/probe-econ-reset-audit.mjs', '--games=32', '--json=' + outJson],
    { encoding: 'utf8', timeout: 120000 });
  eq(r.status, 0, '审计探针必须通过（泄漏/没接上/不可逆都会 exit 7）：' + String(r.stderr || '').slice(0, 160));
  let j = null;
  try { j = JSON.parse(readFileSync(outJson, 'utf8')); } catch (e) { /* 下面会判 */ }
  ok(!!j, '探针必须按 `--json` 落结构化结果（没有它，门只能去 grep 中文横幅）');
  ok(j && j.leak.length === 0, 'reset 之后**每个** ECON_REWARD_KEYS 键都要回出厂（漏一个 = 哨兵泄漏给后续门/臂）：' + (j ? j.leak.join(' · ') : '-'));
  ok(j && j.notApplied.length === 0, '名单里的键必须**都**被 setter 吃（登记了却没接线 = §24 那个形状）：' + (j ? j.notApplied.join(' · ') : '-'));
  ok(j && j.dose > 0, '【作用点 A】两个权重全 0 时也必须量到**贵卡剂量**（读不到 = 计数又被关进某个 W 的门里，09-27 的假零结果就是这么来的）。实测 dose=' + (j && j.dose));
  ok(j && j.fitW !== null && Math.abs(j.dFit) > 0, '【作用点 B】`costlyW` 开档必须改变 fit（不变 = 项没接到每代评分通路）。实测 Δfit=' + (j && j.dFit));
  ok(j && j.resetReversible === true, 'reset 之后 fit 必须**逐位**回到出厂（留隐性状态 ⇒ "出厂行为不变"这句话就是假的）');
  /* 臂上必须看得见剂量：这是 09-27 那次"事后也查不到"的直接补救 */
  const runArm = (name, extra) => spawnSync(process.execPath, ['tools/train-3p.mjs', '2'], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { EPIRUS_ARM: name, EPIRUS_T3P_OUT: dir + '/' + name + '.js', EPIRUS_BAND_DIR: dir + '/band' }, extra || {})
  });
  const rOff = runArm('d175off'), rOn = runArm('d175on', { EPIRUS_COSTLY_W: '0.2' });
  eq(rOff.status, 0, '对照臂必须成功：' + String(rOff.stderr || '').slice(0, 120));
  eq(rOn.status, 0, '`costlyW=0.2` 臂必须成功');
  ok(/贵卡=\d+/.test(String(rOff.stdout)), '不设权重时逐代行**也要**印剂量（只在开档时印 ⇒ 又变回"没生效"与"没出手"不可分）');
  ok(/贵卡=\d+/.test(String(rOn.stdout)), '开档臂必须印剂量');
  const rBad = runArm('d175bad', { EPIRUS_COSTLY_W: 'abc' });
  eq(rBad.status, 7, '非数值必须 `exit 7`（不许 clamp 成 0 再谎称"开过了"）');
});

/* ===== D176（qoder 09-28 夜班 §E66）：**载重优点 veto** 的语义必须判在产物上 =====
 * 动因（同批臂实测）：从现役接力，**60 代**就把名人堂 6 粒的电磁炮落地全部打掉（起点 1.25/局 → 候选 ≤0.55），
 * 1200 代产物级 2.23→0~0.75/局、最大 ep 93→2~18，5P 三粒全部低于现役（38.7/25.0/37.1 vs 42.5）。
 * ⇒ 这根开关不许"开了等于没开"，也不许"为了保优点把别的塞进 fit"：
 *   ① 容差 100% ⇒ **产物逐位等于不设**（证明它只挑人不加项）；
 *   ② 全塌缩 ⇒ 产物仍等于不设 + 标 `allRejected`（不许硬换人）；
 *   ③ 账必须落在**产物 META** 上（参照/线/剔了几粒/分母），否则事后无法复核；
 *   ④ 参照缺失 / 非法卡名 / 越界 ⇒ `exit 7`（拒绝恒真判据与静默空转）。 */
t('D176 载重优点 veto（v1.5.265b · §E66）：容差 100% 逐位不变 + 全塌缩不硬换人 + 账进产物 + 无参照即拒', function () {
  const dir = mkdtempSync(join(tmpdir(), 'd176-'));
  const SEEDPACK = 'docs/artifacts/eval-out/win-Ldemo.bak';   // 与线上槽权重逐位相同（09-28 实测 d490dc136293）
  ok(existsSync(SEEDPACK), '用例需要一粒"起点包"当参照（缺了就只能造静默通过的假绿）');
  const armEnv = (name, extra) => Object.assign({
    EPIRUS_HOTSTART: '1', EPIRUS_SEEDPACK: SEEDPACK, EPIRUS_SEED: '31', EPIRUS_ARM: name,
    EPIRUS_BAND_DIR: dir + '/band-' + name, EPIRUS_T3P_OUT: dir + '/' + name + '.js'
  }, extra || {});
  const arm = (name, extra) => spawnSync(process.execPath, ['tools/train-3p.mjs', '60'], {
    encoding: 'utf8', timeout: 420000, env: Object.assign({}, process.env, armEnv(name, extra))
  });
  /* v1.5.281：这几支 60 代臂**互相独立**（各自 EPIRUS_ARM / BAND_DIR / T3P_OUT），串行只是 `spawnSync`
   * 的写法顺出来的，不是判据要求的 ⇒ 一批并发跑。判据一条没减：下面的"逐位相同 / 换 seed 必须不同 /
   * 账进产物"全都照旧，而"并发会不会改变产物"由这条门自己的变异对照兜着（`wCtl===wWide` 与 `wOther!==wCtl`）；
   * 门面另有门 D188 判"归属不串台 / 失败不吞 / 少一个 job 就判红"。 */
  const armBatch = (specs) => spawnBatch(specs.map(s => ({
    tag: s[0], argv: ['tools/train-3p.mjs', '60'], env: armEnv(s[0], s[1])
  })), { max: specs.length, timeout: 900000 });
  const metaOf = f => {
    const s = readFileSync(f, 'utf8'); const i = s.indexOf('EPIRUS_CHAMPION_3P_META = ');
    if (i < 0) return null;
    const b = s.indexOf('{', i), j = s.indexOf(';\n', b);
    try { return JSON.parse(s.slice(b, j)); } catch (e) { return null; }
  };
  const wOf = f => { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(readFileSync(f, 'utf8')); return m ? JSON.stringify(JSON.parse(m[1]).a) : null; };
  /* ④ 三条响亮拒绝（都不该跑到训练，秒级） */
  const rBad = arm('d176bad', { EPIRUS_SEL_KEEP: 'abc' });
  eq(rBad.status, 7, '`SEL_KEEP` 非数值必须 exit 7（不许 clamp 后谎称开过）');
  const rNoRef = spawnSync(process.execPath, ['tools/train-3p.mjs', '2'], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { EPIRUS_SEL_KEEP: '0.5', EPIRUS_ARM: 'd176noref', EPIRUS_T3P_OUT: dir + '/noref.js', EPIRUS_BAND_DIR: dir + '/band-noref' })
  });
  eq(rNoRef.status, 7, '开了 veto 却**没有热启动参照包**必须 exit 7（无参照的"不劣于起点"是恒真判据）');
  const rBadKey = arm('d176badkey', { EPIRUS_SEL_KEEP: '0.5', EPIRUS_SEL_KEEP_KEYS: 'notacard' });
  eq(rBadKey.status, 7, '`SEL_KEEP_KEYS` 里非法卡名必须 exit 7（判不到的维不许当通过）');
  /* ①② 三臂并排：不设 / 容差 100% / 容差 35%（现役起点 60 代实测会全塌缩）+ 变异对照（换 seed） */
  const BB = armBatch([
    ['d176ctl'],
    ['d176wide', { EPIRUS_SEL_KEEP: '1' }],
    ['d176tight', { EPIRUS_SEL_KEEP: '0.35' }],
    ['d176other', { EPIRUS_SEED: '57' }],
    /* 2026-10-16：v1.5.267 那两支**座位对称性**臂并进同一批。原先它们另起一批、串在第一批之后，
     *   而两批之间**没有任何数据依赖**（各自 EPIRUS_ARM / BAND_DIR / T3P_OUT，判据吃各自的产物）
     *   ⇒ 串行纯属 spawnBatch 的写法顺出来的，不是判据要求的。合并后并发 4→6；
     *   批跑的「归属不串台 / 失败不吞 / 少一个 job 就判红」仍由 D188 单独钉着。判据一条没减。 */
    ['d176seatlax', { EPIRUS_SEL_KEEP: '1', EPIRUS_SEL_KEEP_SEAT: '100' }],
    ['d176seat', { EPIRUS_SEL_KEEP: '1', EPIRUS_SEL_KEEP_SEAT: '0' }],
  ]);
  const rCtl = BB.d176ctl, rWide = BB.d176wide, rTight = BB.d176tight, rOther = BB.d176other;
  eq(rCtl.status, 0, '对照臂必须成功：' + String(rCtl.stderr || '').slice(0, 140));
  eq(rWide.status, 0, '容差 100% 臂必须成功');
  eq(rTight.status, 0, '容差 35% 臂必须成功（全塌缩也只许响亮报告，不改退出码）');
  const wCtl = wOf(dir + '/d176ctl.js'), wWide = wOf(dir + '/d176wide.js'), wTight = wOf(dir + '/d176tight.js');
  ok(wCtl && wWide && wTight, '三臂产物都要能读出权重本体');
  /* 变异对照：不同 seed 的产物必须不同，否则上面的"逐位相同"是恒真比较器 */
  eq(rOther.status, 0, '变异对照臂必须成功');
  const wOther = wOf(dir + '/d176other.js');
  ok(wOther && wOther !== wCtl, '【比较器自检】换 seed 必须产出**不同**的权重（相同 = 比较器恒真，D165 建门时踩过同族）');
  ok(wCtl === wWide, '【①】容差 100% 的产物必须与**不设 veto 逐位相同**（veto 只挑人不加项；不同 = 它往 fit 里塞了东西）');
  const mWide = metaOf(dir + '/d176wide.js'), mTight = metaOf(dir + '/d176tight.js');
  ok(mWide && mWide.selKeep && mWide.selKeep.dropped === 0, '【③】容差 100% 臂的账必须写着"剔了 0 粒"：' + JSON.stringify(mWide && mWide.selKeep));
  ok(mTight && mTight.selKeep && Array.isArray(mTight.selKeep.ref) && mTight.selKeep.ref.length > 0,
    '【③】账必须进**产物**（参照逐卡落地量与线），否则事后没人能复核这臂按什么判的：' + JSON.stringify(mTight && mTight.selKeep));
  const sk = mTight && mTight.selKeep;
  ok(sk && sk.of > 0 && (sk.dropped === sk.of ? sk.allRejected === true : sk.allRejected === false),
    '【②】"全剔"与 `allRejected` 必须互推（实测 dropped=' + (sk && sk.dropped) + ' of=' + (sk && sk.of) + ' allRejected=' + (sk && sk.allRejected) + '）');
  if (sk && sk.dropped === sk.of) {
    ok(wTight === wCtl, '【②】全塌缩时**不许硬换人**：产物必须仍逐位等于不设 veto 的对照');
    ok(/名人堂\*\*全部\*\*丢了起点载重卡|走向②/.test(String(rTight.stdout) + String(rTight.stderr)),
      '全塌缩必须响亮（写进 stdout/stderr，不许只留在 META 字段里）');
  } else {
    ok(wTight !== wCtl || /未改判/.test(String(rTight.stdout)), '有达标候选时 veto 必须给出"改判/未改判"的明确归因');
  }
  /* v1.5.266：**出手口径**那一维必须真生效（`landByKey` 只数造成过伤害的卡 ⇒ 环/蓄能按落地判会永远是 0） */
  const castKeys = ((sk && sk.keys) || []).filter(function (x) { return /^ring[:]|^charge[:]/.test(x); });
  ok(castKeys.length >= 2, '账里必须有**出手名单**（ring/charge）的维；实测 keys=' + JSON.stringify(sk && sk.keys));
  /* v1.5.269：默认口径必须是 **plain（ε=0 五席同包出手）** —— 拿训练口径的尺当"上线后退不退化"的判据，
   * 就是 09-28 那次误挑（NCV-71 炮 2.90→0.97）的成因。这条判在**产物的账**上，不判横幅。 */
  ok(sk && sk.cal === 'plain', 'veto 的默认量具口径必须是 plain（ε=0，与 `behavior-profile` 同尺）；实测 cal=' + (sk && sk.cal));
  ok(sk && typeof sk.games === 'number' && sk.games >= 20, 'plain 口径的局数必须 ≥20（实测 G=20 与 60 的炮读数差 0.22/局 ⇒ 再小是噪声）；实测 games=' + (sk && sk.games));
  const rBadCal = arm('d176badcal', { EPIRUS_SEL_KEEP: '0.35', EPIRUS_SEL_KEEP_CAL: 'notacal' });
  eq(rBadCal.status, 7, '`SEL_KEEP_CAL` 不认识的值必须 exit 7（静默退回 mirror = 又拿训练口径当判据）');
  const rFewGames = arm('d176fewg', { EPIRUS_SEL_KEEP: '0.35', EPIRUS_SEL_KEEP_PLAIN_GAMES: '5' });
  eq(rFewGames.status, 7, '`SEL_KEEP_PLAIN_GAMES < 20` 必须 exit 7（判据不许建在噪声上）');
  /* v1.5.268：**两模式都判**（09-28 实测单模式尺会反向：NCV-71 改判后 炮 2.90→0.90、5P 41.3→39.2） */
  ok(Array.isArray(sk && sk.modes) && sk.modes.indexOf('multi') >= 0 && sk.modes.indexOf('long') >= 0,
    '默认判据必须同时覆盖 multi 与 long 两个模式（实测 modes=' + JSON.stringify(sk && sk.modes) + '）');
  ok(((sk && sk.keys) || []).some(function (x) { return /@multi$/.test(x); }) && ((sk && sk.keys) || []).some(function (x) { return /@long$/.test(x); }),
    '账里每条规则要带它属于哪个模式（缺了就没法复核"两模式都判"到底判没判）：keys=' + JSON.stringify(sk && sk.keys));
  const rBadMode = arm('d176badmode', { EPIRUS_SEL_KEEP: '0.35', EPIRUS_SEL_KEEP_MODES: 'notamode' });
  eq(rBadMode.status, 7, '`SEL_KEEP_MODES` 里不认识的模式必须 exit 7（静默丢掉一个模式 = 又回到单模式尺骗人）');
  const castRef = ((sk && sk.ref) || []).filter(function (r) { return r.src === 'cast' || r.src === 'act'; });
  ok(castRef.length >= 2 && castRef.every(function (r) { return r.perGame > 0 && r.line >= 0 && r.line < r.perGame; }),
    '出手参照必须**当场量到非零**且线低于参照（0 = 起点根本没打这两张卡 ⇒ 该维不该进判据）：' + JSON.stringify(castRef));
  ok(!((sk && sk.unjudgeable) || []).some(function (x) { return /^charge/.test(x); }),
    'v1.5.266 修的就是这条：`charge` 从前只按落地判 ⇒ 被点名"无法判"（09-28 实测），现在按出手判就不该再出现');
  /* ===== v1.5.267：座位对称性维（第三条尺）—— 起点读 16.7pt(N=3/60 局)，宽容差必须完全不动人 ===== */
  /* 2026-10-16：这两支臂已并进上面那一批（`BB`）⇒ 这里只取结果，不再单独起一批。 */
  const BS = BB;
  const rSeatLax = BS.d176seatlax, rSeatStrict = BS.d176seat;
  const rSeatBad = arm('d176seatbad', { EPIRUS_SEL_KEEP: '1', EPIRUS_SEL_KEEP_SEAT: 'abc' });
  eq(rSeatBad.status, 7, '`SEL_KEEP_SEAT` 非数值必须 exit 7');
  const rSeatBig = arm('d176seatbig', { EPIRUS_SEL_KEEP: '1', EPIRUS_SEL_KEEP_SEAT: '999' });
  eq(rSeatBig.status, 7, '`SEL_KEEP_SEAT` 越界（>100pt）必须 exit 7（不许 clamp 成"最松档"后谎称开了）');
  eq(rSeatLax.status, 0, '宽容差座位臂必须成功');
  eq(rSeatStrict.status, 0, '严座位臂必须成功（剔人也不改退出码）');
  ok(wOf(dir + '/d176seatlax.js') === wCtl,
    '【①同形】座位容差 +100pt（等于"什么都放行"）时产物必须与不设 veto **逐位相同** ⇒ 证明这一维不加任何项');
  const mSeat = metaOf(dir + '/d176seat.js');
  ok(mSeat && mSeat.selKeep && mSeat.selKeep.seat && typeof mSeat.selKeep.seat.ref === 'number',
    '【③账进产物】严臂的 META 要写下座位参照与线（实测 seat=' + JSON.stringify(mSeat && mSeat.selKeep && mSeat.selKeep.seat) + '）');
  ok(mSeat && mSeat.selKeep && mSeat.selKeep.seat && mSeat.selKeep.seat.games >= 20,
    '座位维必须用**专用量具**（09-28 实测：共用 20 局只有 18 个决胜局 ⇒ 起点自己读出 25~33pt，那是噪声不是判据）；实测 games=' +
    (mSeat && mSeat.selKeep && mSeat.selKeep.seat && mSeat.selKeep.seat.games));
  ok(wOf(dir + '/d176seat.js') === wCtl || /改判/.test(String(rSeatStrict.stdout)),
    '严座位臂要么没换人（则不许印"改判"），要么换人并**明说改判**——两者必须一致');
});

/* ===== D177（qoder 09-28 §E81）：`champ-audit` 遇到读不出的包**不许把整张表带走** =====
 * 动因（09-28 实测）：我传了一个不存在的包路径 ⇒ `loadChamp` 里裸的 `readFileSync` 抛 ENOENT ⇒
 * **前面已经打完的行全部作废**，现场只剩一句报错，没人知道是哪个包；同族另一种表现是 `gate-drafts`
 * 对非 `.bak` 路径**静默忽略**。⇒ 钉三条行为：坏包要**点名**、好包的行必须**还在**、整体**非零退出**。 */
t('D180 econ 回执按数值比（v1.5.273 · §E85）：0.10 写法不再被拒 + 拒收值仍红 + 黑键闸仍响', function () {
  const src = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/function rcptEq\(a, b\)/.test(src) && /return !rcptEq\(echo\[k\], payload\[k\]\)/.test(src),
    '① 比对必须走 `rcptEq`（不许退回字符串等值）');
  ok(/isFinite\(na\) && isFinite\(nb\) && Math\.abs\(na - nb\) < 1e-12/.test(src),
    '① 数值档必须真的比数值（且两边都不是数值时返回 false ⇒ 兜底不放宽）');
  /* ⚠ 必须落到 `mkdtemp` 出来的临时目录：第一版写成 `process.env.TMPDIR || '.'` ⇒ 在 Git Bash 下 `TMPDIR` 为空 ⇒
   *   产物与 `*-bandN.bak` 直接落在**仓库根目录**（顶层 `.bak` 会触发 D82 点名、也是脏工作区）。 */
  const d180Dir = mkdtempSync(join(tmpdir(), 'd180-'));
  const short = (env) => spawnSync(process.execPath, ['tools/train-3p.mjs', '3', '3', '4', '4'], {
    encoding: 'utf8', timeout: 420000,
    env: Object.assign({}, process.env, {
      EPIRUS_ARM: 'D180', EPIRUS_SEED: '5', EPIRUS_HOTSTART: '1',
      EPIRUS_BAND_DIR: d180Dir + '/bands', EPIRUS_T3P_OUT: d180Dir + '/d180-out.js'
    }, env)
  });
  const r10 = short({ EPIRUS_BEAD_W: '0.10' });
  eq(r10.status, 0, '② `=0.10` 这种写法必须能跑（实测它曾把整臂顶成非零）：' + String(r10.stderr || '').slice(0, 140));
  ok(/逐键回执一致/.test(String(r10.stdout)), '② 而且必须仍然**打印**回执一致（不是靠跳过检查过的）');
  const rNeg = short({ EPIRUS_BEAD_W: '-5' });
  ok(rNeg.status !== 0, '③ 引擎拒收的值（`-5` ⇒ 回执仍是出厂 0.05）必须仍然失败 —— 这次放宽只放宽格式：实得 ' + rNeg.status);
  ok(/回执不一致/.test(String(rNeg.stderr) + String(rNeg.stdout)), '③ 且必须是"回执不一致"这条响，不是别的偶然报错');
  const rDark = short({ EPIRUS_BEAD_W_ROLL: '0.10' });
  ok(rDark.status !== 0, '④ 名字写错仍必须失败（黑键闸没被吃掉）：实得 ' + rDark.status);
  ok(/读不到/.test(String(rDark.stderr) + String(rDark.stdout)), '④ 且要明说"本入口读不到这个旋钮"');
});


/* ===== D182（qoder 09-28 §E102）：`probe-dead-term` 必须**禁止过度声称**，且自己先做到可复现 =====
 * 这把尺是为"我今晚把『两次产物逐位相同』写成『可证死项』然后被下一个实验推翻"（§E99）而做的，
 * 所以门判的不是它算得快不快，而是它**会不会再次让人把记忆/稀有当成效应**：
 * ① 出厂权重为 0 的根（`tgtW`）必须**报恒真**，且"变的行"必须是 0/9 —— 这一条同时钉住预热（不预热时我实测过到 1/9）；
 * ② `ringW` 必须给出"单位级 0/9 不变 + 阳性对照会变"这对**方向相反**的读数（少了任何一半都会让人误判）；
 * ③ 认不来的根必须**响亮失败**（不许"探测不到就跳过"）；未知 `--` 参数必须 exit 64；
 * ④ 输出末尾必须带那句"不支持可以摘某根权重"的限定。 */
t('D184 产物=起点读数（v1.5.276 · §E113）：正例喊、反例不喊、冷启动为 null', function () {
  const src = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/for \(let i = 0; i < p\.length; i\+\+\) if \(p\[i\] !== seedParams\[i\]\) return false;/.test(src),
    '① 必须是**逐维权重**比较（对象同一 `===` 会漏掉"同一粒权重的另一个对象"，文件哈希会被头注骗）');
  ok(/productIsSeed: PRODUCT_IS_SEED/.test(src) && /hallSeedEntries: HALL_SEED_ENTRIES/.test(src),
    '① 必须写进产物 meta（只在 stdout 喊一遍 ⇒ 事后拿到 .bak 的人看不见）');
  ok(/dupOfBand/.test(src) && /同一粒权重/.test(src),
    '① 名人堂重复席位必须标出来（今晚就是"两个（当选）"让我发现产物是起点）');

  const dir = mkdtempSync(join(tmpdir(), 'd184-'));
  const live = readFileSync('js/bundled-champion-3p.js', 'utf8');
  const mm = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\});/.exec(live);
  ok(!!mm, '① 前置：线上包要能取到权重对象（取不到 ⇒ fixture 变了，本门该红去修）');
  const zeroObj = JSON.parse(mm[1]);
  zeroObj.a = zeroObj.a.map(function () { return 0; });
  const zeroSeed = join(dir, 'zero-seed.js');
  writeFileSync(zeroSeed, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(zeroObj) + ';\n');
  const arm = function (argv, extra) {
    return spawnSync(process.execPath, ['tools/train-3p.mjs'].concat(argv), {
      encoding: 'utf8', timeout: 600000,
      env: Object.assign({}, process.env, extra, { EPIRUS_BAND_DIR: join(dir, 'b' + Math.random().toString(36).slice(2)) })
    });
  };
  const metaOf = function (p) {
    const s = readFileSync(p, 'utf8');
    return JSON.parse(/window\.EPIRUS_CHAMPION_3P_META = (\{.*\});\n/.exec(s)[1]);
  };

  /* ① 正例：热启动 + 极大的 λ ⇒ 除了起点没人能在训练分上活着 ⇒ 必然"产物=起点"（实测同配置两次逐位复现）。
   * 种子包用**线上包本身**（`EPIRUS_SEEDPACK` 指到不存在的文件会 exit 5，不是回退 ⇒ 不能给假路径）。 */
  const hot = arm(['1', '3', '2', '2'], {
    EPIRUS_ARM: 'd184-hot', EPIRUS_SEED: '5', EPIRUS_HOTSTART: '1', EPIRUS_ANCHOR: '50',
    EPIRUS_SEEDPACK: 'js/bundled-champion-3p.js', EPIRUS_T3P_OUT: join(dir, 'hot.js')
  });
  eq(hot.status, 0, '① 正例迷你臂必须跑通（exit=' + hot.status + ' ' + String(hot.stderr || '').slice(0, 120) + '）');
  ok(/产物=起点/.test(String(hot.stderr)), '① 产物与起点逐位相同时必须**喊出来**（这条线六晚前只在注释里，无人读数 ⇒ 我今晚重新掉了一遍）');
  ok(/产物与起点逐位相同（本臂零改包）/.test(String(hot.stdout)), '① 末行"已写入"也要带（很多人只读最后一行）');
  eq(metaOf(join(dir, 'hot.js')).productIsSeed, true, '① meta.productIsSeed 必须为 true');
  ok(metaOf(join(dir, 'hot.js')).hallSeedEntries >= 1, '① 起点占了几席要写出来（0 席却当选 = 说明读数逻辑 itself 有问题）');
  eq(String(hot.stdout).split('（当选）').length - 1, 1, '① "（当选）"只许出现一次（重复席位改标"与 bandN 同一粒权重"）');

  /* ② 反例：起点是**全 0 的坏包** + 训 40 代 ⇒ 一定有候选赢过它 ⇒ 不许喊、meta 必须 false。
   * 为什么专门钉：正例只证明"它会喊"，不证明"它会不喊"。 */
  const rev = arm(['40', '3', '2', '8'], {
    EPIRUS_ARM: 'd184-rev', EPIRUS_SEED: '5', EPIRUS_HOTSTART: '1', EPIRUS_ANCHOR: '0',
    EPIRUS_SEEDPACK: zeroSeed, EPIRUS_T3P_OUT: join(dir, 'rev.js')
  });
  eq(rev.status, 0, '② 反例臂必须跑通（exit=' + rev.status + ' ' + String(rev.stderr || '').slice(0, 120) + '）');
  ok(!/产物=起点/.test(String(rev.stderr)), '② 产物**不等于**起点时不许喊（永远喊 = 又一个恒真）');
  eq(metaOf(join(dir, 'rev.js')).productIsSeed, false, '② meta 必须读成 false（不是 null、不是缺字段）');

  /* ③ 冷启动：没有起点 ⇒ 这个判断根本不适用，必须是 null（"没起点" ≠ "产物等于起点"） */
  const cold = arm(['1', '3', '2', '2'], {
    EPIRUS_ARM: 'd184-cold', EPIRUS_SEED: '5', EPIRUS_T3P_OUT: join(dir, 'cold.js')
  });
  eq(cold.status, 0, '③ 冷启动迷你臂必须跑通（exit=' + cold.status + '）');
  ok(!/产物=起点/.test(String(cold.stderr)), '③ 冷启动不许喊"产物=起点"');
  eq(metaOf(join(dir, 'cold.js')).productIsSeed, null, '③ 冷启动的 productIsSeed 必须是 null（未定义 ≠ 假）');

});


/* ===== D185（qoder 09-28 §E114）：`EPIRUS_HALL_SEED` 只**多一粒候选**，一分打分都不许动 =====
 * 背景：今晚 9 支接力臂里 **7 支的名人堂一席起点都没有** ⇒ "接力交出的包从没跟现役比过"是常态（§E113 补）。
 * 这个开关把起点补进终局重验的池子。它是**训练侧配方**（会改变交出去的那一粒）⇒ 出厂必须关、必须可证中性。
 * 钉三向：① 关时一行 `[hall-seed]` 都不许出现；② 开时"真的多了一席"，而**六席的 trainFit 逐字不变**、
 * 且起点是坏包时**产物必须逐位相同**（只多候选、不改判据）；③ 起点已在堂必须走"不重复追加"（幂等 ——
 * 否则同一粒被当两票，§E113 那"两个（当选）"就是这个形状）。 */
t('D185 起点补进重验池（v1.5.277 · §E114）：默认零行 + 只多候选不动打分 + 幂等', function () {
  const src = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/'EPIRUS_HALL_SEED'/.test(src.split('const SELF_ENV_KEYS')[1].split('];')[0]),
    '① 必须登记进 `SELF_ENV_KEYS`（否则按 D122 它是个"黑键"，一设就 exit 6）');
  ok(/if \(HALL_SEED > 0 && seedParams\)/.test(src), '① 追加必须在开关后面（默认 0 ⇒ 一行不跑）');
  ok(/hall\.push\(\{ params: seedParams, fit: null \}\)/.test(src), '② 追加那席的 `fit` 必须是 null（它没参加过训练打分，不许编一个数）');
  ok(/hh\.fit === null/.test(src), '② band-save 必须跳过追加的起点席（线上包本来就在仓里，另存一份会误导下一班）');

  const dir = mkdtempSync(join(tmpdir(), 'd185-'));
  const live = readFileSync('js/bundled-champion-3p.js', 'utf8');
  const zeroObj = JSON.parse(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\});/.exec(live)[1]);
  zeroObj.a = zeroObj.a.map(function () { return 0; });
  const zeroSeed = join(dir, 'zero-seed.js');
  writeFileSync(zeroSeed, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(zeroObj) + ';\n');
  const arm = function (argv, extra) {
    return spawnSync(process.execPath, ['tools/train-3p.mjs'].concat(argv), {
      encoding: 'utf8', timeout: 600000,
      env: Object.assign({}, process.env, extra, { EPIRUS_BAND_DIR: join(dir, 'b' + Math.random().toString(36).slice(2)) })
    });
  };
  const fitsOf = function (txt) {
    return String(txt).split('\n').filter(function (l) { return /^\s+trainFit=[\d.]/.test(l); }).map(function (l) { return l.trim(); });
  };
  const common = { EPIRUS_SEED: '5', EPIRUS_HOTSTART: '1', EPIRUS_ANCHOR: '0', EPIRUS_SEEDPACK: zeroSeed };
  const offOut = join(dir, 'off.js'), onOut = join(dir, 'on.js');
  /* v1.5.281：off/on 两臂互相独立 ⇒ 一批并发（判据不变：下面仍比 `fitsOff.length` / 产物逐位 / 横幅有无） */
  const B185 = spawnBatch([
    { tag: 'off', argv: ['tools/train-3p.mjs', '40', '3', '2', '8'],
      env: Object.assign({}, common, { EPIRUS_ARM: 'd185-off', EPIRUS_HALL_SEED: '0', EPIRUS_T3P_OUT: offOut, EPIRUS_BAND_DIR: join(dir, 'b-off') }) },
    { tag: 'on', argv: ['tools/train-3p.mjs', '40', '3', '2', '8'],
      env: Object.assign({}, common, { EPIRUS_ARM: 'd185-on', EPIRUS_HALL_SEED: '1', EPIRUS_T3P_OUT: onOut, EPIRUS_BAND_DIR: join(dir, 'b-on') }) },
  ], { max: 2, timeout: 900000 });
  const off = B185.off, on = B185.on;
  eq(off.status, 0, '① 开关关的迷你臂必须跑通（exit=' + off.status + ' ' + String(off.stderr || '').slice(0, 100) + '）');
  ok(!/hall-seed/.test(String(off.stdout) + String(off.stderr)), '① 默认（关）不许出现任何 `[hall-seed]` 行 ⇒ 出厂路径一行都不跑');
  const fitsOff = fitsOf(off.stdout);
  eq(fitsOff.length, 6, '① 前置：关档要读到 6 席重验行（实测 ' + fitsOff.length + ' ⇒ 终局形状变了，本门的比较基准得跟着改）');
  eq(on.status, 0, '② 开关开的迷你臂必须跑通（exit=' + on.status + '）');
  ok(/起点已追加为终局重验候选（现在 7 席/.test(String(on.stdout)), '② 必须**真的多了一席候选**（只打横幅不改池子 = 本仓"seam 2"族的老病）');
  const fitsOn = fitsOf(on.stdout);
  eq(fitsOn.length, 6, '② 开档的**训练打分**席仍必须只有 6 行（起点那行标 `trainFit=起点`，不许混进来）');
  eq(fitsOn.join('|'), fitsOff.join('|'), '② 六席读数必须**逐字相同** ⇒ 这个开关不动任何打分，只多一粒候选');
  ok(/第 7 席 = 追加的起点 ⇒ 不另存/.test(String(on.stdout)), '② 追加的起点席不许写成带内候选（会让人以为训练挖出了一粒"等于现役"的料）');
  const idp = spawnSync(process.execPath, ['tools/probe-pack-identity.mjs', offOut, onOut], { encoding: 'utf8', timeout: 120000 });
  eq(idp.status, 0, '② 起点是坏包时开/关的产物必须**逐位相同**（它是"多一粒候选"，不是"改判据"）：' + String(idp.stderr || '').slice(0, 120));
  const idem = arm(['1', '3', '2', '2'], {
    EPIRUS_ARM: 'd185-idem', EPIRUS_SEED: '5', EPIRUS_HOTSTART: '1', EPIRUS_ANCHOR: '50',
    EPIRUS_SEEDPACK: 'js/bundled-champion-3p.js', EPIRUS_HALL_SEED: '1', EPIRUS_T3P_OUT: join(dir, 'idem.js')
  });
  ok(/起点本来就在名人堂里/.test(String(idem.stdout)), '③ 起点已在堂必须走"不重复追加"（幂等 ⇒ 同一粒不许被当两票）');
  ok(!/现在 7 席/.test(String(idem.stdout)), '③ 幂等分支不许又声称追加了');
  const mOn = JSON.parse(/window\.EPIRUS_CHAMPION_3P_META = (\{.*\});\n/.exec(readFileSync(onOut, 'utf8'))[1]);
  eq(mOn.hallSeedAppended, true, '④ 追加与否必须写进产物 meta（只有 stdout 有账 ⇒ 事后拿 .bak 的人看不见）');
  eq(mOn.hallSeedReq, 1, '④ meta 还要记"这臂请求过这个开关"（开了但没追加，事后要能区分）');
  rmSync(dir, { recursive: true, force: true });
});


/* ===== D186（qoder 09-28 §E122）：序列机会率探针必须**只读、可复现、有判别力**，且不许把 chooser 的返回重造 =====
 * 为什么单独钉一道：这把尺是裁 (a) 目标函数缺维 / (b) 课程缺行为 的**唯一依据**，
 * 而我建它的时候**当场产出过一个假读数** —— 第一版把 `policyChooserN` 的返回值当字符串比（它其实是 `{key,target,target2,bead}`），
 * 于是现役被读成"兑现率 0.0%"，与独立的 §E121（现役炮 1.45/局）矛盾才被抓出来。
 * 更坏的是第一版修法：重造 `{key, target:null}` 返回 ⇒ **探针自己吞掉目标选择、改了玩法**（那就不是在测这个包）。
 * 所以钉：① 源码必须原样交回返回对象；② 不认识的参数 exit 64；③ 包读不出必须点名 exit 7；
 * ④ 默认自证（复现 + 中性 + 守恒 + 判别力）必须全过且**两档口径都在**；⑤ 同一粒包传两次读数必须逐字相同。 */
t('D213 C8-lite 选择锦标赛（pick-5p）：同尺 · 只记录 · 自检两侧都有牙（10-01 · 千问 §3.5.3 提的形状）', function () {
  /* 动因：N=3 评分桌排序外推到产品口径会翻号（§E137），但 C8 全量（换评分桌）被量成不值且作废历史臂。
   * ⇒ 折中 = 训练之后加一段 **5P 产品形状选择**：候选与参照跑**完全相同的 eval-5p 参数**（同 seed/pool/局数），
   *   只记录、不 promote。本门钉三件事：① 同尺（一次命令里所有候选同参数）② 只记录（不许写包/不许 promote）
   *   ③ 行为验证（`--self-test` 必须 ✔：解析、排序、噪声带两侧都要有牙）。 */
  const P = readFileSync('tools/pick-5p.mjs', 'utf8');
  ok(/spawnSync\(process\.execPath, \['tools\/eval-5p\.mjs', GAMES, '5', SEED, p, '--pool=' \+ POOL\]/.test(P),
    '必须对**每个候选**都用同一组参数跑 eval-5p（同 seed ⇒ 配对；这是"同尺"的唯一保证）');
  ok(/1\.96 \* se/.test(P), '必须印噪声带判据（±1.96SE），不能只报一个裸百分比');
  ok(/top2/.test(P), '必须同时报 top2（1st 与 top2 双读数）');
  const SRC = P.replace(/^import[^\n]*\n/m, '');   /* 去掉 import 行（writeFileSync 从 node:fs 导入 ⇒ 会误伤） */
  ok(!/writeFileSync\((?!JSONOUT)/.test(SRC), '【只记录】不许写任何包/权重文件（唯一的写是 --json 那份）');
  ok(!/spawnSync\([^\n]*promote-champion/.test(P), '【只记录】不许 spawn promote（注释里提到这个词没关系 —— 第一版就是被我自己的注释判红的）');
  const r = spawnSync(process.execPath, ['tools/pick-5p.mjs', '--self-test'], { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 });
  eq(r.status, 0, '自检必须 exit 0（实测 ' + r.status + '）');
  ok(/自检：✔ 全过/.test(String(r.stdout || '')), '自检必须打 ✔ 全过（行为验证：解析/排序/噪声带两侧都要有牙）');
});

t('D165 尾部聚合适应度开关（v1.5.251 · 夜班 §E49）：默认关要**逐位可逆**、开了只换聚合不加局、越界/非数值要**响亮拒**', function () {
  /* 为什么值得建门：档案级实测（863 等价类 × 33 环境）说 `fit` 那条"逐局求平均"看不见地板
   * —— τ(池内均值, 池外地板) = 0.380，而尾部统计量给 0.749。旋钮本身可逆与否不是看法问题，
   * 是**断言**问题 ⇒ 判四件事：
   *   ① 关着 / 显式 `=0` / reset 之后，fit 必须**逐位相同**（`|| 默认` 那一族：0 是一个真实取值）；
   *   ② 开着必须改变 `fit` 但**不改变** `fitMean` 与 `fitGames`（= 同一批局，只换了聚合；多花一局就是另一回事了）；
   *   ③ `q=1` ⇒ 尾部 = 整体 ⇒ fit 必须回到平均（判**形状**，不只判"数值动了"）；
   *   ④ 臂上真跑：`EPIRUS_FIT_TAIL_W` 不设 vs 设 0 ⇒ **产物权重逐位相同**；设 0.4 ⇒ 必须不同；
   *      非数值 / 越界 ⇒ `exit 7`（"下达了但被 clamp 掉"不许当成开了）。 */
  const params = Pol.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
  ok(!!params, '载体：现役 3P 权重要能 unpack');
  const opps = T.buildOpps(params, 0.05);
  ok(Array.isArray(opps) && opps.length >= 2, '要 ≥2 个对手才谈得上"最差那几局"（实测 ' + (opps && opps.length) + '）');
  const er0 = T.economyReward();
  eq(er0.fitTailW, 0, '出厂必须是 W=0（不加项）');
  eq(er0.fitTailQ, 0.25, '出厂 q 必须是 0.25');
  const SCORE = () => T.scoreMemberN(params, opps, 8, 3, 1200, 5, 0);
  const f0 = SCORE();
  ok(typeof f0.fitMean === 'number', '必须回传 `fitMean`（没有它，"它本来分低"与"被地板拖下来"永远分不开）');
  eq(f0.fitGames, 8, '逐局数必须就是下达的局数');
  try {
    T.setEconomyReward({ fitTailW: 0 });
    const f0z = SCORE();
    ok(f0z.fit === f0.fit && f0z.fitMean === f0.fitMean, '`W=0` 必须逐位等于不设（被当成"未设"再吞回默认 = 零档对照根本不存在）');
    T.setEconomyReward({ fitTailW: 0.6, fitTailQ: 0.25 });
    eq(T.economyReward().fitTailW, 0.6, 'setter 要读回生效值');
    const f1 = SCORE();
    ok(f1.fitMean === f0.fitMean, '开档**不许改局**：fitMean 必须逐位相同（变了就是多跑/换了局，那 A/B 就不是同一个量）');
    eq(f1.fitGames, f0.fitGames, '逐局数也不许变');
    ok(f1.fit !== f0.fit, '【作用点】开档必须改变 fit（不变 ⇒ 该项没接到每代评分通路，整臂会跑成 A/A）');
    ok(f1.fit < f0.fit, '尾部聚合只会往下压（ES ≤ mean ⇒ 上界只能等于平均）');
    T.setEconomyReward({ fitTailQ: 1 });
    const f2 = SCORE();
    ok(Math.abs(f2.fit - f0.fit) < 1e-12, '`q=1` 时 ES = 整体平均 ⇒ fit 必须回到原值（差一丝 = 形状写错了，实测 Δ=' + (f2.fit - f0.fit) + '）');
    T.setEconomyReward({ fitTailW: 1, fitTailQ: 0.25 });
    const f3 = SCORE();
    ok(Math.abs(f3.fit - (f0.fitMean - 0)) >= 0 && f3.fit < f0.fit, 'W=1（纯 ES）必须比平均更低');
  } finally { T.setEconomyReward({ reset: true }); }
  const fBack = SCORE();
  ok(fBack.fit === f0.fit && fBack.fitMean === f0.fitMean, 'reset 之后必须逐位回到出厂（留隐性状态 ⇒ "出厂行为不变"这句话就是假的）');
  eq(T.economyReward().fitTailW, 0, 'reset 必须抹掉 W（D77 的往返会喂 0.5 哨兵，漏抹就泄漏给后面的门）');
  /* ⚠ 这里**不**再用 `detectDarkKnobs({entry})` 判"是不是暗键"：那个调用不传 `extraReadKeys`，
   *   而 econ 族键在 `train-3p` 里是**运行时**从 `ECON_ENV_KEYS` + `CLI_ECON_REWARD_KEYS` 派生出来的
   *   ⇒ 静态判它会把 `EPIRUS_BIGT_CHAIN_W`/`EPIRUS_S4_W`/`EPIRUS_RING_W` 一律报成暗键（实测三条全红）。
   *   判"真接上了"改用下面那条**行为式**的：开档臂必须不是 `exit 6`，且**同族没接线的键必须是 6** ——
   *   两条一起才排除"守卫自己关了"这个混淆（METHODOLOGY 73 的变异测试同族）。 */

  /* ---- ④ 臂上真跑（同种子 2 代 × 3 粒，只换开关）---- */
  const dir = mkdtempSync(join(tmpdir(), 'd165-'));
  const runArm = (name, extra) => spawnSync(process.execPath, ['tools/train-3p.mjs', '2'], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { EPIRUS_ARM: name, EPIRUS_T3P_OUT: dir + '/' + name + '.js', EPIRUS_BAND_DIR: dir + '/band' }, extra || {})
  });
  try {
    const rU = runArm('d165u'), rZ = runArm('d165z', { EPIRUS_FIT_TAIL_W: '0' }), rK = runArm('d165k', { EPIRUS_FIT_TAIL_W: '0.4' });
    eq(rU.status, 0, '对照臂必须成功（' + String(rU.stderr || '').slice(0, 90) + '）');
    eq(rZ.status, 0, '`W=0` 臂必须成功');
    eq(rK.status, 0, '`W=0.4` 臂必须成功');
    /* 下达自 v1.5.262 起走 **DS 的通用 econ 派发**（名单驱动 + 逐键回执），本门只认那一处的回执 ⇒
     * 断言"这个键真的被点名下达过"，而不是我自己的横幅措辞（横幅会改，回执是机制）。 */
    ok(/econ 族通用下达[^\n]*"fitTailW":"0"/.test(String(rZ.stdout)), '`W=0` 必须被通用派发点名并回执（不许把 "0" 当未设）');
    ok(/econ 族通用下达[^\n]*"fitTailW":"0\.4"/.test(String(rK.stdout)), '开档臂必须在派发回执里出现 fitTailW=0.4');
    ok(!/fitTailW/.test(String(rU.stdout)), '不设 ⇒ 派发与回执里都不许出现这个键（"开了但没生效"与"没开"要看得见差别）');
    const wtOf = f => { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(readFileSync(f, 'utf8')); return m ? JSON.stringify((JSON.parse(m[1]) || {}).a) : null; };
    const wU = wtOf(dir + '/d165u.js'), wZ = wtOf(dir + '/d165z.js'), wK = wtOf(dir + '/d165k.js');
    ok(wU && wZ && wK, '三臂产物都要能读出权重（读到的是**数组本体**，不是"数组有几个"那种形状签名 —— 建门时我自己先踩过一次假通过）');
    ok(wU === wZ, '【P3 门票】不设 vs 显式 0 ⇒ 产物权重必须**逐位相同**（不同 ⇒ 这根开关改了出厂训练结果，那"默认关"是假的）');
    ok(wU !== wK, '开档臂必须训出**不同的**权重（相同 ⇒ 开关在臂这条路上是空转的）');
    const rBad = runArm('d165bad', { EPIRUS_FIT_TAIL_W: 'abc' });
    eq(rBad.status, 7, '非数值必须 exit 7（读回不相等就算被拒），实际 ' + rBad.status);
    const rOver = runArm('d165over', { EPIRUS_FIT_TAIL_W: '5' });
    eq(rOver.status, 7, '越界（W=5 会被 clamp 成 1）必须 exit 7，实际 ' + rOver.status);
    const rDark = runArm('d165dark', { EPIRUS_FIT_TAIL_OOPS: '0.4' });
    eq(rDark.status, 6, '同族但**没接线**的键必须 `exit 6` ⇒ 守卫是活的，上面"W=0.4 那臂活着跑完"才真是"接上了"而不是"没人管"');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  }
});

t('D229 §E340 全息屏障→原型制御 的映射档（v1.6.8）：默认 off（出厂零剂量）· 三档语义各有一条牙 · 含糊值响亮拒 · 结构性无解不许假装禁掉 · 出厂面四个入口都读不到它', function () {
  const R = sb.window.EpirusRules, P = Pol;
  /* ① 出厂面：新沙箱默认必须是 off。这一条不是装饰 —— 这一档改的是**决策**，
   *    默认没关就等于把"榜首为什么被挡"那条已裁过的门槛悄悄挪了位置。 */
  eq(P.holo2Proto(), 'off', '① 默认必须是 off ⇒ 否则研究档改掉了出厂形状');
  let threw = false;
  try { P.setHolo2Proto('Prot0'); } catch (e) { threw = true; }
  ok(threw, '② 非法值必须抛（含糊拼写不许被当成"没写"，否则一次拼错 = 一份静默假读数）');
  eq(P.holo2Proto(), 'off', '② 抛过之后档不能被改脏（半套状态比直接红更难查）');

  /* ③~⑥ 三档语义：用**真状态 + 真候选**（手搓的 {key,target} 会绕过 candidatesFor 的目标展开，
   *    而那正是 v1.5.37 那条"幻影选项"出问题的地方）*/
  const st = S.createState('multi', { next: mulberry32(7) }, 4);
  const pack = P.unpack(sb.window.EPIRUS_CHAMPION_3P, true);
  const cands = P.candidatesFor(st, 0, [{ key: R.SK.HOLO }, { key: R.SK.PROTO }, { key: R.SK.GUARD }], { allowUnaffordable: true });
  const holo = cands.filter(c => c.key === R.SK.HOLO)[0];
  ok(!!holo, '③ 夹具必须真能造出 holo 候选（造不出来后面全是空判）');
  const proto = cands.filter(c => c.key === R.SK.PROTO)[0];

  P.setHolo2Proto('off');
  eq(P.remapHolo(st, 0, cands, pack, holo).key, R.SK.HOLO, '③ off 档必须**原样返回**（零剂量）');
  P.setHolo2Proto('proto');
  if (proto) eq(P.remapHolo(st, 0, cands, pack, holo).key, R.SK.PROTO, '④ proto 档：要送盾这一次必须换成给自己上原型制御');
  eq(P.remapHolo(st, 0, cands, pack, cands[cands.length - 1]).key, cands[cands.length - 1].key,
    '④ 非 holo 的那一次出手不许被顺手改掉（映射只针对"送盾"这一个动作）');
  const onlyHolo = cands.filter(c => c.key === R.SK.HOLO);
  eq(P.remapHolo(st, 0, onlyHolo, pack, holo).key, R.SK.HOLO,
    '⑤ 池子里只有 holo ⇒ 原样返回。**结构性无解必须能在读数里看见**，不许假装禁掉了');
  P.setHolo2Proto('drop');
  const d = P.remapHolo(st, 0, cands, pack, holo);
  ok(d && d.key !== R.SK.HOLO, '⑥ drop 档（对照档）必须真的不再送盾，实测回到 ' + (d && d.key));
  P.setHolo2Proto('off');

  /* ⑦ 端到端零剂量 —— §E588 改成**两向都有牙**。旧写法把前提钉在"出厂冠军本来就不用 holo"上：
   *    v1.6.62 换成 `T8-s114` 之后它镜像里每局送盾 0.375 ⇒ 前提跟着旧现役一起没了，"逐字相同"当场红
   *    （红的是夹具，不是旋钮 —— 同族病见文件头 `FIXTURE_PACK` 那段与 METHODOLOGY 131）。
   *      ⑦a「进程默认 = 显式 off」这枚包用不用 holo 都必须成立 ⇒ 它才是"默认关 = 没改任何东西"的最强形式；
   *      ⑦b 基线里真的在送盾的包 ⇒ `proto` 必须**看得出差异**（否则"这一档接上了"只是源码里有个 if）；
   *         基线里不送盾的包 ⇒ 必须逐字相同。两条合起来仍然咬得住"偷偷把档打开"和"这一档其实是死代码"两种坏法。 */
  const hk = o => [o.holoOtherPerGame, o.dmgPerGame, o.rounds, o.effSkills].map(x => x.toFixed(3)).join('|');
  const a = T.mirrorHealth(pack, 8, 5, 'multi');                 // 谁都没 set 过 = 进程默认
  P.setHolo2Proto('off');
  const aOff = T.mirrorHealth(pack, 8, 5, 'multi');
  eq(hk(a), hk(aOff), '⑦a 进程默认必须逐字等于显式 `off`（送盾/伤害/回合/有效技能）—— 这一条与"这枚包用不用 holo"无关');
  P.setHolo2Proto('proto');
  const b = T.mirrorHealth(pack, 8, 5, 'multi');
  P.setHolo2Proto('off');
  ok(a.holoOtherPerGame > 0 ? hk(b) !== hk(a) : hk(b) === hk(a),
    '⑦b 基线每局送盾 ' + a.holoOtherPerGame.toFixed(3) + ' ⇒ ' + (a.holoOtherPerGame > 0 ? '`proto` 必须改变整局读数' : '必须逐字相同') +
    '（实测 proto=' + hk(b) + ' ‖ 基线=' + hk(a) + '）');
  /* ⑧ 出厂面读不到这一档。§E342 曾把它升成"包自带的声明"并接进 promote / 考卷 / 页面，
   *    10-06 由用户撤回 ⇒ 判据回到"别读"（而不是"只能从一个口读"）。
   *    为什么是"别读"：这一档是**进程级研究旋钮**，不属于任何一枚包 ⇒ promote 一旦读它，
   *    同一枚包就有了两个"能不能上槽"的答案，而第二个答案并不来自包自己。
   *    要按映射后的行为上槽，前提是用户裁定"这一档成为包的属性"；在那之前门槛只看未映射的线上行为。
   *    另一半：硬门槛常量本身不许被这一档顺手改掉（改门槛是裁定，不是实现细节）。 */
  const AL = readFileSync('tools/audit-lib.mjs', 'utf8').replace(/\r\n/g, '\n');
  ok(/HOLO_GIFT_MAX\s*=\s*6\b/.test(AL),
    '⑧ 硬门槛常量不许被这一档顺手改掉（改门槛是裁定，不是实现细节）');
  for (const f of ['tools/promote-champion.mjs', 'tools/eval-5p.mjs', 'tools/style-exam.mjs', 'js/ui/ui.js']) {
    ok(readFileSync(f, 'utf8').toLowerCase().indexOf('holo2proto') < 0,
      '⑧ ' + f + ' 不许读这一档（含 `EPIRUS_HOLO2PROTO` 与 `META.holo2proto`）⇒ 出厂面只按未映射行为判分');
  }
});

}

