/*#np-part-header
{"file":"tools/gates/train-pick.mjs","part":"train-pick","group":"train","ranges":[[1255,1597],[5483,5548],[6013,6023],[9003,9120],[10450,10467],[10573,10651]],"gates":[1255,5483,6013,9003,10450,10573],"patched":[]}
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
export const ords = [1255, 5483, 6013, 9003, 10450, 10573];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
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

t('D176 载重优点 veto（v1.5.265b · §E66）：容差 100% 逐位不变 + 全塌缩不硬换人 + 账进产物 + 无参照即拒', function () {
  const dir = mkdtempSync(join(tmpdir(), 'd176-'));
  const SEEDPACK = 'docs/artifacts/eval-out/win-Ldemo.bak';   // 与线上槽权重逐位相同（09-28 实测 d490dc136293）
  ok(existsSync(SEEDPACK), '用例需要一粒"起点包"当参照（缺了就只能造静默通过的假绿）');
  const armEnv = (name, extra) => Object.assign({
    EPIRUS_HOTSTART: '1', EPIRUS_SEEDPACK: SEEDPACK, EPIRUS_SEED: '31', EPIRUS_ARM: name, EPIRUS_SUPPORT_PRIOR: '0',
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
  })), { max: Math.min(specs.length, batchCap()), timeout: 900000 });   /* v1.7.117：显式取上限（§E655 指出这台闸原先够不到这里）。本地 18 核仍是 6 = 与旧行为逐字相同；CI 2 核降到 2。 */
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
  const runArm = (name, extra, gens) => spawnSync(process.execPath, ['tools/train-3p.mjs', String(gens || 2)], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { EPIRUS_ARM: name, EPIRUS_T3P_OUT: dir + '/' + name + '.js', EPIRUS_BAND_DIR: dir + '/band' }, extra || {})
  });
  try {
    const rU = runArm('d165u'), rZ = runArm('d165z', { EPIRUS_FIT_TAIL_W: '0' }), rK = runArm('d165k', { EPIRUS_FIT_TAIL_W: '0.4' });
    /* ⚑ R62（2026-10-25 · 天火阶梯计价）漂移账：原判别臂是 `rK`（W=0.4）对 `rU`——2 代迷你臂里
     *   尾部聚合的排序差被 R62 的轨迹漂移抹平（同权重产出 ⇒ 那条"开关流入选拔"的腿假红）。当时加过一支 5 代满档臂 `rM` 去撑那条腿。
     * ⚑⚑ 2026-10-25 17:4x（**用户裁定：那条臂级腿与 `rM` 一起删**）：「训练的问题应该在训练时候做，要是发现训练失败权重一样
     *   早该发现了，而不是等上线的时候跑门禁才发现」⇒ "两臂权重必须不同"不再由这道门判，**5 代臂也就不必再跑**（省一趟 spawn）。
     *   留下的都是与"两臂之间的剂量差"无关的判据：① 进程内【作用点】两条腿（开档必须改 fit ‖ 只会往下压）‖
     *   ② 派发回执逐键点名 ‖ ③ `不设 vs 显式 0 ⇒ 逐位相同`（"默认关"这句话的门票）‖ ④ 越界/非数值/未接线三个响亮拒。 */
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

}
