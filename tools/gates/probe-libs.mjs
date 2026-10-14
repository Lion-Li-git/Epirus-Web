/*#np-part-header
{"file":"tools/gates/probe-libs.mjs","part":"probe-libs","group":"probe","ranges":[[4454,4490],[7473,7530],[10069,10312]],"gates":[4454,7473,10069,10201],"patched":[]}
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
export const ords = [4454, 7473, 10069, 10201];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D64 狙击场探针：归因纯函数 + 混合场的靶向判据（复核 §4-2）', function () {
  ok(typeof Bots.pickSnipeSpam === 'function', 'Bots.pickSnipeSpam 必须存在（狙击场探针的威胁源）');
  const poolSrc = readFileSync('server/opp-pool.mjs', 'utf8');
  ok(/\{\s*name:\s*'snipespam'/.test(poolSrc) && poolSrc.indexOf("fn: 'pickSnipeSpam'") >= 0,
    'snipespam 必须登记进 OPP_SPECS（单一来源，实验臂按需加入；默认池不受影响）');
  const lib = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(lib.indexOf('export function sniperField(') >= 0, 'audit-lib 必须导出 sniperField');
  ok(lib.indexOf('export function attackAttribution(') >= 0, 'audit-lib 必须导出 attackAttribution（纯函数，可单测）');
  /* ① 归因纯函数：只认 `source` + `via`；反向反证（别人的攻击、无 via 的伤害都必须不计） */
  const ev = [
    { type: 'damage', source: 0, to: 2, via: 'gun', amt: 1 },   // 我打的 ✓
    { type: 'damage', source: 0, to: 2, via: 'gun', amt: 1 },   // 我打的 ✓
    { type: 'damage', source: 0, to: 0, via: 'railgun', amt: 1 },// 自伤（计入 total，判据里排除）
    { type: 'damage', source: 1, to: 2, via: 'gun', amt: 1 },   // **别人**打的 ✗
    { type: 'damage', source: 0, to: 3, amt: 1 },               // 无 via（非技能）✗
    { type: 'action', pid: 0, key: 'gun', outcome: 'ok' }       // action 不带目标，不该被当攻击 ✗
  ];
  const a = attackAttribution(ev, 0);
  eq(a.total, 3, '只统计 source=我 且有 via 的伤害（实测 ' + a.total + '）');
  eq(a.byTarget[2], 2, '命中 2 号座两次必须照实统计');
  eq(a.byTarget[0], 1, '自伤照实统计（由调用方排除）');
  eq(a.targets, 2, '打过的人数 = 2（0 号=自伤，2 号=对手）');
  eq(attackAttribution(ev, 1).total, 1, '换成 1 号座视角只统计它自己那一次');
  eq(attackAttribution(null, 0).total, 0, '空事件必须安全返回 0');
  /* ② 判别力声明：混合场给"均匀乱打=25%"的基准，wall 场不得谎报基准 */
  ok(lib.indexOf("uniformRate: (K === 'mixed') ? 0.25 : null") >= 0,
    '混合场必须声明 uniformRate=0.25（4 席里 1 席是狙击手）；wall 场必须为 null（无靶向判别力）');
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
});


/* ===== v1.5.74（用户 4 局实测两问 → F1/F2）=====
 * ① F1：**买不起的招不得进候选表**（旧行为：进表 → 被选中 → 引擎静默降级成ジ = 幻影动作）；
 * ② F2：**两级采样**（先技能、后条目）⇒ 槽位数不再放大某技能的抽样概率。
 * 两条都必须能被反证：③ 用零权重（所有候选同分）检查"4 条槽位 vs 1 条槽位"的概率是否相等。 */
t('D149 理想冠军 7 条表**不是一个口径**：两个旋钮要分开、【5】【6】必须**两口径都印**且搬运自证（v1.5.224 契约升级）', function () {
  /* 病（09-25 凌晨实测）：`probe-ideal-champion.mjs` 原本只有一个写死的 `0.15`，名字读起来像 ε、实际是**温度**（交接 §4-E5 让人拿温度去扫探索率，整晚白跑）；
   * 拆成 `--temp/--eps` 之后又发现第二层：**【5】seatSymmetry 与【6】mirrorHealth 各自在内部建 Chooser**（audit-lib.mjs:403 / evo.js:403 都是
   * `policyChooserN(params, 0.15)`），所以 ε 扫描时那两行**逐字不变** —— 容易被读成"座位/广度对探索不敏感"，而真实原因是**它们没接到旋钮**。
   * ⇒ 钉三件：旋钮分开、调用点真用、不吃旋钮的行必须**在输出里自报口径**。 */
  const p = readFileSync('tools/probe-ideal-champion.mjs', 'utf8');
  ok(/arg\('temp'/.test(p) && /arg\('eps'/.test(p),
    '温度与探索率必须是**两个**参数（只有一个 0.15 时谁按交接做 E5 都会拉错杆）');
  ok(/policyChooserN\(live, TEMP, EPS, EPSK, EPSMODE\)/.test(p),
    '受评席的 Chooser 必须把四个参数一起传（只传 eps = 全候选均匀抽，那是 v1.5.139 被用户否掉的口径）');
  ok(!/policyChooserN\(live, 0\.15\)/.test(p), '调用点不许再留写死的 0.15');
  const i5 = p.lastIndexOf('【5】'), i6 = p.lastIndexOf('【6】'), i7 = p.lastIndexOf('【7】');
  ok(i5 > 0 && i6 > i5 && i7 > i6, '【5】【6】【7】三条必须都在（用 lastIndexOf 定位打印行，头注释里也出现这些标号）');
  /* v1.5.223 契约**升级**（不是放宽）：原来这两行只能"自报不吃旋钮"；现在必须**两个口径都印出来**。
   * 原有每一层意图都保留：① 单一真源（仍调 seatSymmetry / mirrorHealth，不许另起实现）；
   * ② 口径必须在**输出里**可见；③ 旋钮分开、四参数调用（上面几条仍钉着）。 */
  ok(/seatSymmetry\((A|B2)\.sb, live, MODE, n\)/.test(p),
    '【5】仍走 seatSymmetry（单一真源，不许在这份表里另起一份实现）');
  ok(/\.EpirusTrainer\.mirrorHealth\(live, (MIRROR_N|400), 5, MODE\)/.test(p),
    '【6】仍走 mirrorHealth（单一真源，不许在这份表里另起一份实现）—— 样本量可以是门禁小档，但函数不许换');
  ok(/from '\.\/probe-layer-caliber\.mjs'/.test(p) && p.indexOf('build({ on: true') >= 0,
    '第二口径必须复用 build()（D150 的单一来源），不许自建第二份"替换/装载"');
  ok(/B2\.patched !== B2\.hardwired/.test(p) && /__viaWrapper > 0/.test(p),
    '搬运必须**两半自证**（替换数 = 源码现算数；包装层真被调用）—— 否则"两栏相同"会被误读成"口径无关"');
  /* 指针行号**从源码现算**（原来门钉的是探针**源码里**的字面量 `403`/`2554` ⇒ 谁在它们上面插一行，
   *   探针印的就是假行号而门仍绿；这正是 METHODOLOGY 52 那族"冻结的期望值"）。
   *   改判法：不查源码字面，改查**输出里印出来的行号 == 源码现算的行号**（见下面 o5/o6 那两条）。 */
  const LN_AL = hardwiredLine('tools/audit-lib.mjs', 'export function seatSymmetry(');
  const LN_MH = hardwiredLine('js/train/evo.js', 'function trainChooser(');
  ok(LN_AL != null && LN_MH != null, '两处 ε 决定点必须还能从源码定位到（定位不到 ⇒ 探针的口径警示会印"行号读不出"，本门判红）');
  ok(/function mirrorHealth\([\s\S]{0,9000}?\btrainChooser\(params\)/.test(readFileSync('js/train/evo.js', 'utf8')),
    '【6】的 ε 现在决定在漏斗 `trainChooser()` 里 ⇒ 必须真看到 `mirrorHealth` 通过漏斗建 Chooser（v1.5.237 E28 把四处收成一处；漏斗若被拆回四处，本门红着提醒去重钉指针）');
  /* v1.5.224：spawn 用**门禁专用小样本档**（座位 60/120、广度 120）—— 门只要"两列都在且不同"，
   * 不需要报告里那个 n（座位 100+400、广度 400 ⇒ 这一段让本门吃 46.5 秒、是整支门禁最慢的一道）。
   * 两次 spawn 必须传**同一组**档位，否则下面"逐字相同"那条对照就不成立了。 */
  const run = spawnSync(process.execPath, ['tools/probe-ideal-champion.mjs', '--games=8', '--eps=0.2', '--epsmode=soft', '--seat-n=60,120', '--mirror-n=120'],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, '表要跑得通（' + String(run.stderr || '').slice(0, 160) + '）');
  const out = String(run.stdout || '');
  const n5 = (out.match(/极差 [\d.]+pt/g) || []).join('|'), n6 = (out.match(/净兑现 G = [\d.]+/g) || []).join('|');
  /* 输出侧：两条口径都必须**看得见**（源码里有、输出里没有 = 读表的人看不见）。
   * v1.5.223 起判的是"两列都在"，而不是"两条不吃旋钮的警示"—— 后者已被两列并列取代。 */
  const o5 = out.slice(out.indexOf('【5】'), out.indexOf('【6】')), o6 = out.slice(out.indexOf('【6】'), out.indexOf('【7】'));
  ok(/ε=0/.test(o5) && /产品/.test(o5), '【5】输出里必须两口径都看得见（ε=0 与产品）');
  ok(/ε=0/.test(o6) && /产品/.test(o6), '【6】输出里必须两口径都看得见（ε=0 与产品）');
  ok(new RegExp('audit-lib\\.mjs:' + LN_AL + '(?!\\d)').test(o5),
    '【5】输出里必须指到 seatSymmetry 的写死处，且**行号 = 源码现算的 ' + LN_AL + '**（印死数字会在别人插一行后撒谎）');
  ok(new RegExp('evo\\.js:' + LN_MH + '(?!\\d)').test(o6),
    '【6】输出里必须指到 ε 的决定点（现算行号 = 漏斗 `trainChooser()` 的 ' + LN_MH + '）—— 印死数字会在别人插一行后变成假行号');
  ok(/口径搬运自证/.test(out) && /经包装调用 \d+ 次/.test(out),
    '自证两半必须**打印出来**（现算数量 + 经包装次数）—— 源码里有、输出里没有就等于没自证');
  const r2 = spawnSync(process.execPath, ['tools/probe-ideal-champion.mjs', '--games=8', '--seat-n=60,120', '--mirror-n=120'],
    { encoding: 'utf8', timeout: 600000 });
  const out2 = String(r2.stdout || '');
  eq((out2.match(/极差 [\d.]+pt/g) || []).join('|'), n5, '【5】在 eps=0.2 与默认下必须逐字相同（它不吃旋钮 ⇒ 这条相等本身就是那处写死的证据）');
  eq((out2.match(/净兑现 G = [\d.]+/g) || []).join('|'), n6, '【6】同上 —— 若哪天这两行开始随 ε 动，说明单一真源被改散了，要重看钉法');
});

t('D198 §E136 的配对判读有牙（v1.5.292）：配对不成立要拒、三个判读分支都走得到、逐桌子账要与汇总对得上、配对算术只有一份', function () {
  /* 为什么钉这道：`analyze-swap-gain.mjs` 是"把 8 臂变成一个结论"的那一层 ——
   * 它若把"配对不成立"当警告、或把判读分支写死成一条，§E136 的结案就是脚本自己编的。
   * 全部用合成 TSV（tmpdir），一局都不重跑。 */
  const dir = mkdtempSync(join(tmpdir(), 'd198-'));
  const NAMES = []; for (let i = 0; i < 24; i++) NAMES.push('n' + i + 'a,n' + i + 'b,n' + i + 'c,n' + i + 'd');
  const tsv = function (firsts, games) {
    const L = ['#eval5p-percombo', '#seed=77000', '#games=' + games, '#n=5', '#pool=all', '#every=1', '#field=-', '#file=x', '#swap=-',
      '#arm\tidx\tnames\tgames\tfirst\tstrict'];
    firsts.forEach(function (f, i) { L.push('subject\t' + i + '\t' + NAMES[i] + '\t' + games + '\t' + f + '\t' + Math.max(0, f - 1)); });
    return L.join('\n') + '\n';
  };
  const wave = function (base, amp) { const a = []; for (let i = 0; i < 24; i++) a.push(base + (i % 2 ? amp : -amp)); return a; };
  const put = function (arm, firsts, games, names) {
    const body = tsv(firsts, games == null ? 10 : games);
    writeFileSync(join(dir, arm + '.tsv'), names ? body.replace(/n\d+[a-d]/g, function (x) { return 'x' + x; }) : body);
    writeFileSync(join(dir, arm + '.txt'), '平均回合=31.3  转移事件=0');
  };
  const run = function (extra) {
    const r = spawnSync(process.execPath, ['tools/analyze-swap-gain.mjs', '--dir=' + dir].concat(extra || []),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  /* ②′ 夹具：A→B 越过两个对照，B→A 只越过弱对照 ⇒ 反巧合条款必须把 ① 拦下 */
  put('AAA', wave(6, 0)); put('BBB', wave(4, 0));
  put('A2B-at5', wave(8, 0)); put('B2A-at5', wave(5, 0));
  const p2 = run();
  ok(p2.code === 0, '⓪ 正常夹具要跑得完（exit=' + p2.code + ' ' + p2.out.slice(0, 90).replace(/\n/g, ' ') + '）');
  ok(/判读[^\n]*\n\s*②′/.test(p2.out), '① 只有一个方向越过两个对照 ⇒ 必须判 ②′（反巧合拦下），不许出 ①');
  ok(/◆ 夹在中间/.test(p2.out), '② `B2A-at5`（50%）显著低于 AAA(60%)、显著高于 BBB(40%) ⇒ 必须印成**夹在中间**，不许并进"分不出"');
  ok(!/— 与某个对照分不出/.test(p2.out), '②′ 这份夹具里没有任何臂该被判"分不出"（印出来就是区间算错）');
  /* ① 夹具：两个方向都越过两个对照 */
  put('B2A-at5', wave(9, 0));
  const p1 = run();
  ok(/判读[^\n]*\n\s*①/.test(p1.out) && !/②′/.test(p1.out), '③ 两个方向同时越过两个对照 ⇒ 才允许判 ①（实测 ' + (p1.out.match(/\n\s+([①②②′]+)/) || ['', '?'])[1] + '）');
  /* ② 夹具：两个方向都低于两个对照 */
  put('A2B-at5', wave(3, 0)); put('B2A-at5', wave(2, 0));
  const p0 = run();
  ok(/判读[^\n]*\n\s*② /.test(p0.out), '④ 全部低于对照 ⇒ 必须判 ②（不赚钱），不许因为"有臂高于弱对照"就翻成正');
  /* ⑤ 配对前提：组合名字列被改动 ⇒ exit 2 拒绝（不是警告） */
  put('A2B-at5', wave(8, 0), 10, true);
  const pBad = run();
  ok(pBad.code === 2 && /配对不成立/.test(pBad.out), '⑥ 组合序列不同就不是同一批桌子 ⇒ 必须 exit 2 拒绝出读数（实测 exit=' + pBad.code + '）');
  /* ⑥ 每桌局数不同 ⇒ 同样要拒；缺臂 ⇒ 要拒 */
  put('A2B-at5', wave(8, 0));
  put('B2A-at5', wave(9, 0));
  writeFileSync(join(dir, 'B2A-at5.tsv'), tsv(wave(9, 0), 12));
  const pG = run();
  ok(pG.code === 2 && /配对不成立/.test(pG.out) && /games/.test(pG.out),
    '⑥′ 每桌局数不一致 ⇒ 也必须 exit 2 并点名是 `games` 这一要素不同（实测 exit=' + pG.code + '，' + pG.out.slice(0, 70).replace(/\n/g, ' ') + '）');
  writeFileSync(join(dir, 'B2A-at5.tsv'), tsv(wave(9, 0), 10));
  rmSync(join(dir, 'BBB.tsv'), { force: true });
  const pM = run();
  ok(pM.code === 2 && /缺臂/.test(pM.out), '⑥″ 缺臂 ⇒ exit 2 点名，不许拿剩下的臂出结论（实测 exit=' + pM.code + '）');
  /* ⑦ 内部守卫：分位数/累积分布错了就整表区间一起错 */
  const src = readFileSync('tools/analyze-swap-gain.mjs', 'utf8');
  ok(/x \/ Math\.SQRT2/.test(src), '⑧ `Φ(x)` 必须按 `erf(x/√2)` 算（少除 √2 会把 z₀.₉₇₅ 从 1.96 算成 1.39）');
  ok(/内部自检失败[\s\S]{0,200}拒绝出读数/.test(src), '⑧ 必须带那条无条件自测守卫');
  /* ⑨ 单一来源：配对算术只许住在 lib */
  const lib = readFileSync('tools/routing-gain-lib.mjs', 'utf8');
  const ar = readFileSync('tools/analyze-routing-gain.mjs', 'utf8');
  ok(/export function pairedDiff\(a, b, z\)/.test(lib), '⑨ lib 必须导出 pairedDiff');
  ok(/const zz = z == null \? 1\.96 : z;/.test(lib), '⑨ 默认 z 必须是 1.96（`analyze-routing-gain` 的历史区间靠这个默认值逐位不变）');
  ok(/import \{[^}]*pairedDiff[^}]*\} from '\.\/routing-gain-lib\.mjs'/.test(src) &&
    /import \{[^}]*pairedDiff[^}]*\} from '\.\/routing-gain-lib\.mjs'/.test(ar), '⑨ 两个分析器都必须 import lib 那一份');
  ok(!/function paired\(a, b\)/.test(ar) && !/const sd = Math\.sqrt/.test(src),
    '⑨ 分析器里不许留第二份配对 SE 的实现');
  /* ⑩ lib 自己的算术：d=[2,4,6] ⇒ m=4、sd=2（除以 n−1）、se=2/√3、h=1.96·se */
  ok(typeof RGAIN.pairedDiff === 'function', '⑩ `pairedDiff` 要能被门禁直接调用（本门下面拿它算夹具）');
  const pd = RGAIN.pairedDiff([3, 5, 7], [1, 1, 1]);
  ok(Math.abs(pd.m - 4) < 1e-12 && Math.abs(pd.sd - 2) < 1e-12 && Math.abs(pd.se - 2 / Math.sqrt(3)) < 1e-12,
    '⑩ m/sd/se 必须等于手算值（实测算得 m=' + pd.m + ' sd=' + pd.sd.toFixed(6) + ' se=' + pd.se.toFixed(6) + '，期望 4 / 2 / 1.154700）');
  ok(Math.abs(pd.lo - (4 - 1.96 * pd.se)) < 1e-12 && Math.abs(pd.hi - (4 + 1.96 * pd.se)) < 1e-12,
    '⑩ 区间必须由 `z·se` 双向张开（实测 [' + pd.lo.toFixed(4) + ', ' + pd.hi.toFixed(4) + ']）');
  eq(pd.n, 3, '⑩ n 是**成对**样本数');
  eq(pd.better, 3, '⑩ better 计数（变好 3 桌）');
  ok(RGAIN.pairedDiff([3], [1]) === null, '⑩ n<2 要返回 null（调用方负责"不出结论"，不许把 null 当 0）');
  const pd2 = RGAIN.pairedDiff([3, 5, NaN], [1, 1, 9]);
  ok(pd2 && pd2.n === 2 && Math.abs(pd2.m - 3) < 1e-12,
    '⑩ 非数值项必须**成对**剔除：3 项里剔掉 NaN 那对 ⇒ n=2、m=(2+4)/2=3（实测 n=' + (pd2 ? pd2.n : 'null') + ' m=' + (pd2 ? pd2.m : 'null') + '）');
  /* ⑪ eval-5p 的逐桌子账必须与它自己印的汇总对得上（否则配对分析建在假账上） */
  const dp = join(dir, 'per.txt');
  const rr = spawnSync(process.execPath, ['tools/eval-5p.mjs', '2', '5', '77000', '--field=mix4', '--dump-per=' + dp],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(rr.status === 0 && existsSync(dp), '⑪ 带 --dump-per 要跑得完并落盘（exit=' + rr.status + '）');
  const txt = String(rr.stdout || '');
  const printed = txt.match(/\[冠军\] 1st=([0-9.]+)%/);
  const subj = readFileSync(dp, 'utf8').split('\n').filter(function (l) { return l.indexOf('subject\t') === 0; });
  const totFirst = subj.reduce(function (a, l) { return a + Number(l.split('\t')[4]); }, 0);
  const totGames = subj.reduce(function (a, l) { return a + Number(l.split('\t')[3]); }, 0);
  ok(subj.length === 1 && totGames === 2, '⑪ mix4 只有 1 组 × 2 局 ⇒ 主体席应有 1 行、合计 2 局（实测 ' + subj.length + ' 行 / ' + totGames + ' 局）');
  ok(printed && Math.abs(totFirst / totGames * 100 - Number(printed[1])) < 0.06,
    '⑪ 逐桌子求出的 1st 必须与打印的 1st 一致（实测 逐桌子=' + (totFirst / totGames * 100).toFixed(1) + '% ‖ 打印=' + (printed ? printed[1] : '?') + '%）' +
    ' ⇒ 配对分析的分母就是这张表自己数的局');
  const noDump = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--field=mix4'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(!/逐桌子命中数/.test(String(noDump.stdout || '')), '⑪′ 不带 --dump-per 时** stdout 不许多出任何一行**（默认关）');
  /* ⑫ 目录里只有对照 ⇒ 不许印 §E136 的判语（§E139 用同一把尺读"A 粒 vs B 粒"，判语留着就是误导） */
  const dir2 = mkdtempSync(join(tmpdir(), 'd198b-'));
  writeFileSync(join(dir2, 'AAA.tsv'), tsv(wave(6, 0), 10));
  writeFileSync(join(dir2, 'BBB.tsv'), tsv(wave(4, 0), 10));
  const only = spawnSync(process.execPath, ['tools/analyze-swap-gain.mjs', '--dir=' + dir2],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  const oo = String(only.stdout || '') + String(only.stderr || '');
  ok(only.status === 0 && /只有两个对照、没有 swap 臂/.test(oo),
    '⑫ 只有对照时要正常退出并点名"这一轮不判 §E136"（实测 exit=' + only.status + '）');
  ok(!/=== 判读（按/.test(oo), '⑫′ 这种目录里**不许**出现 ①/②/②′ 的判语');
  ok(/A\/B 两粒本身的差（配对）: 20\.00pt/.test(oo),
    '⑫″ 对照之间的配对差仍要印出来（60% vs 40% ⇒ 20.00pt）（实测 ' + ((oo.match(/A\/B 两粒本身的差（配对）: [-0-9.]+pt/) || ['?'])[0]) + '）');
  try { rmSync(dir2, { recursive: true, force: true }); } catch (e) { /* 同上：Windows 偶发占用 */ }
  /* ⑬ 配对校验必须看**跑法**，不能只数组合名：组合由"池子 + --every"决定，**与 seed 无关**
   * ⇒ 两个 seed 的臂放在同一个目录里（§E140 就是这种用法）时，序列完全一样，只看序列会把两批不同的桌子当成同一批。 */
  const dir3 = mkdtempSync(join(tmpdir(), 'd198c-'));
  const tsvSeed = function (firsts, games, seed) { return tsv(firsts, games).replace('#seed=77000', '#seed=' + seed); };
  writeFileSync(join(dir3, 'AAA.tsv'), tsv(wave(6, 0), 10));
  writeFileSync(join(dir3, 'BBB.tsv'), tsv(wave(4, 0), 10));
  writeFileSync(join(dir3, 'A2B-at5.tsv'), tsvSeed(wave(8, 0), 10, 999));
  const seedRun = spawnSync(process.execPath, ['tools/analyze-swap-gain.mjs', '--dir=' + dir3],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  const se = String(seedRun.stdout || '') + String(seedRun.stderr || '');
  ok(seedRun.status === 2 && /seed/.test(se) && /配对不成立/.test(se),
    '⑬ 只有 `#seed` 不同（组合名逐位相同）⇒ 也必须 exit 2 点名跑法不同（实测 exit=' + seedRun.status + '，' + se.slice(0, 60).replace(/\n/g, ' ') + '）');
  /* ⑬′ 反向：跑法完全相同就**不许**误报（否则上面那条会退化成"永远拒绝"） */
  writeFileSync(join(dir3, 'A2B-at5.tsv'), tsv(wave(8, 0), 10));
  const sameRun = spawnSync(process.execPath, ['tools/analyze-swap-gain.mjs', '--dir=' + dir3],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(sameRun.status === 0 && /跑法已逐臂核对相同/.test(String(sameRun.stdout || '')),
    '⑬′ 跑法一致时必须放行，并把核对过的五要素**印出来**（实测 exit=' + sameRun.status + '）');
  try { rmSync(dir3, { recursive: true, force: true }); } catch (e) { /* 同上 */ }
  try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* Windows 偶发占用：tmpdir 里留一个空目录不影响门禁 */ }
});

t('D200 §E142/§E143 的 5P 环境量具有牙（v1.5.296）：构造默认满席、名字与包装规则只许一份真源、桌子不许跟着包漂', function () {
  /* 为什么钉这道：§E142 是今晚**唯一翻掉总结论**的那条（5P 上界 +12.35pt），它现在直接决定用户"下一班往哪投"。
   * 一个会翻结论的量具，最贵的三种坏法正好对应下面三组判据：
   *   ① 名字表/对手包装规则各抄一份 ⇒ "探针里的对手"与"评测里的对手"不是同一种对手（本仓这族事故踩过四次）；
   *   ② 桌子种子跟着包走 ⇒ `oracle − best_single` 变成两批不同桌子的比较（配对假成立，§E136 前科）；
   *   ③ 构造（每桌几席原型）不写进产物 ⇒ mix=4 与 mix=2 的产物混在一个目录里也照样算出一个数。 */
  const A = 'docs/artifacts/kept/e78-out__G08-71.bak';
  const B = 'docs/artifacts/eval-out/win-Ldemo.bak';
  const dir = mkdtempSync(join(tmpdir(), 'd200-'));
  const probe = function (tag, extra) {
    const out = join(dir, tag + '.tsv');
    const r = spawnSync(process.execPath, ['tools/probe-5p-envfit.mjs', '--pack=' + A, '--games=2', '--seeds=0', '--out=' + out].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || ''), tsv: existsSync(out) ? readFileSync(out, 'utf8') : null };
  };
  const body = function (txt) {
    return String(txt).replace(/\r\n/g, '\n').split('\n').filter(function (l) { return l && l[0] !== '#' && !/^env\t/.test(l); });
  };
  /* ---- ① 单一来源 ---- */
  const src = readFileSync('tools/probe-5p-envfit.mjs', 'utf8');
  const ev = readFileSync('tools/eval-5p.mjs', 'utf8');
  const lib = readFileSync('tools/bot-chooser-lib.mjs', 'utf8');
  ok(/import \{[^}]*poolFromSpecs[^}]*\} from '\.\/regime-panel\.mjs'/.test(src) && /import \{[^}]*HELDOUT[^}]*\}/.test(src),
    '① 探针的环境名单必须来自 `regime-panel`（池内取 `OPP_SPECS` 函数引用、池外取 `HELDOUT`），不许自己列名字');
  ok(!/pickTarget2?N\s*\(/.test(src) && /import \{[^}]*makeAsChooser[^}]*\} from '\.\/bot-chooser-lib\.mjs'/.test(src),
    '① 对手 chooser 的包装规则必须 import lib 那一份：探针里出现 `pickTargetN/pickTarget2N` 就等于手抄了第二份目标语义');
  ok(/const asChooser = makeAsChooser/.test(ev) && !/function asChooser\(fn\)/.test(ev),
    '① `eval-5p` 也必须改成 lib 那一份（它原来自己实现了一遍，这是第二份的来源）');
  ok(/export function makeAsChooser\(deps\)/.test(lib) && /保留脚本自己选的目标/.test(lib),
    '① lib 必须导出 `makeAsChooser`，并写明那条规则（保留脚本自己的目标）');
  /* ---- ② 桌子与包无关（配对的命根子）---- */
  ok(/const gameSeed = \(salt \^ \(sd \* 1000003\)\) \+ g \* 977;/.test(src),
    '② 每局种子必须由 `(环境, seed 档, 第几局)` 唯一决定；出现包名/包下标就意味着不同包打的是不同桌子 ⇒ `oracle − best_single` 不是配对比较');
  const pa = probe('pa', []);
  const pb = (function () {
    const out = join(dir, 'pb.tsv');
    const r = spawnSync(process.execPath, ['tools/probe-5p-envfit.mjs', '--pack=' + B, '--games=2', '--seeds=0', '--out=' + out],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    return { code: r.status, tsv: existsSync(out) ? readFileSync(out, 'utf8') : null };
  })();
  ok(pa.code === 0 && pb.code === 0 && pa.tsv && pb.tsv, '② 两粒包都要跑得完（实测 ' + pa.code + '/' + pb.code + '）');
  const envColOf = function (txt) { return body(txt).map(function (l) { return l.split('\t')[0] + '|' + l.split('\t')[1]; }); };
  ok(envColOf(pa.tsv).join(',') === envColOf(pb.tsv).join(','),
    '②′ 两粒包的环境×seed 行序必须逐字相同（同一批桌子的可观察证据）');
  /* ---- ③ 构造：默认满席 + 头部必须带 mix ---- */
  ok(/#mix=4/.test(pa.tsv), '③ 不写 `--mix` 时必须是 §E142 那份"满席原型"构造，且**把 k 写进产物头部**（`#mix=4`）');
  const mixFull = probe('mixfull', ['--mix=4']);
  ok(mixFull.tsv && body(mixFull.tsv).join('\n') === body(pa.tsv).join('\n'),
    '③′ **默认与显式 `--mix=4` 的数据行必须逐字节相同**（新旗标不许动老构造）');
  const mix2 = probe('mix2', ['--mix=2']);
  ok(mix2.code === 0 && /#mix=2/.test(mix2.tsv) && body(mix2.tsv).join('\n') !== body(pa.tsv).join('\n'),
    '③″ `--mix=2` 要跑得完、头部写 `#mix=2`，且数据必须与满席构造**不同**（相同就意味着这个旗标根本没生效）');
  for (const bad of ['--mix=0', '--mix=5', '--mix=abc']) {
    const r = probe('bad-' + bad.replace(/[^a-z0-9]/gi, ''), [bad]);
    ok(r.code === 2, '③‴ ' + bad + '（n=5 ⇒ 合法是 1~4）必须 exit 2，实测 exit=' + r.code + '');
  }
  /* ---- ④ 一个环境都不许静默丢：造一份含假环境的矩阵 ---- */
  /* ⚠ 必须先满足"环境数 ≥ 10"那道守卫，否则探针会在更早的地方 exit 2，
   *    于是这条断言测的就变成"分母守卫"而不是"点名缺环境"（本门第一版就是这么假通过的）。 */
  const REAL_ENVS = Object.keys(JSON.parse(readFileSync('docs/artifacts/e129-out/matrix.json', 'utf8')).rows[0].per);
  ok(REAL_ENVS.length >= 12, '④ 前置：真矩阵要有 ≥12 个环境可借（实测 ' + REAL_ENVS.length + '）');
  const perFake = {};
  REAL_ENVS.slice(0, 12).forEach(function (e) { perFake[e] = { fit: 1 }; });
  perFake.totallyNotAnArchetype = { fit: 1 };
  const fake = join(dir, 'fake-matrix.json');
  writeFileSync(fake, JSON.stringify({ rows: [{ per: perFake }] }));
  const rFake = spawnSync(process.execPath, ['tools/probe-5p-envfit.mjs', '--pack=' + A, '--games=1', '--seeds=0',
    '--envs=' + fake, '--out=' + join(dir, 'fake.tsv')], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(rFake.status === 2 && /totallyNotAnArchetype/.test(String(rFake.stderr || '') + String(rFake.stdout || '')),
    '④ 名单里出现解析不到的环境 ⇒ 必须 exit 2 **点名是哪个**（少一个环境 = 分母变了 = 与 §E129 不可比），实测 exit=' + rFake.status + '');
  for (const argv of [['--games=0'], ['--games=2.5'], ['--n=2'], ['--n=6']]) {
    const r = spawnSync(process.execPath, ['tools/probe-5p-envfit.mjs', '--pack=' + A, '--out=' + join(dir, 'x.tsv')].concat(argv),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    ok(r.status === 2, '④′ ' + JSON.stringify(argv) + ' 这类含糊剂量/人数必须 exit 2（实测 exit=' + r.status + '）');
  }
  const noPack = spawnSync(process.execPath, ['tools/probe-5p-envfit.mjs', '--games=1', '--seeds=0'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(noPack.status === 2 && /--pack/.test(String(noPack.stderr || '')),
    '④″ 缺 `--pack` 必须 exit 2 并点名它（**不许"默认拿出厂包"混进矩阵**），实测 exit=' + noPack.status + '');
  /* ---- ⑤ 决定论 ---- */
  const again = probe('again', []);
  ok(again.tsv && body(again.tsv).join('\n') === body(pa.tsv).join('\n'), '⑤ 同参数两次运行的数据行必须逐字节相同（量具自己得先可复现）');
  /* ---- ⑥ 分析器：不许把两种构造合算；判语只许一条规则 ---- */
  const dA = join(dir, 'an-a'), dB = join(dir, 'an-b');
  mkdirSync(dA); mkdirSync(dB);
  const rowsA = body(pa.tsv), rowsB = body(mix2.tsv);
  const mk = function (p, pack, mix, rows) {
    writeFileSync(p, ['#probe-5p-envfit', '#pack=' + pack, '#n=5', '#mix=' + mix, '#games=2', '#seeds=0', '#envs=' + rows.length,
      '#env\tseed\tinPool\tgames\tfirst\tstrict'].concat(rows).join('\n') + '\n');
  };
  /* 拿两粒包各自造一份同构造的目录（分析器要 ≥3 粒 ⇒ 第三份复制） */
  mk(join(dA, 'a.tsv'), 'pa', 4, rowsA);
  mk(join(dA, 'b.tsv'), 'pb', 4, rowsB.map(function (l) { const c = l.split('\t'); return [c[0], c[1], c[2], c[3], Number(c[4]) - 1 >= 0 ? Number(c[4]) - 1 : 0, c[5]].join('\t'); }));
  mk(join(dA, 'c.tsv'), 'pc', 4, rowsB.map(function (l) { const c = l.split('\t'); return [c[0], c[1], c[2], c[3], Number(c[4]) + 1 <= Number(c[3]) ? Number(c[4]) + 1 : c[4], c[5]].join('\t'); }));
  const an = spawnSync(process.execPath, ['tools/analyze-5p-envfit.mjs', '--dir=' + dA, '--rule=off'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(an.status === 0 && /构造 = 每桌原型 \*\*4\*\*/.test(String(an.stdout || '')), '⑥ 分析器要把构造（`#mix`）**印在表头**（实测 exit=' + an.status + '）');
  ok(/判读：本工具\*\*不出判语\*\*/.test(String(an.stdout || '')) && !/=== 判读（按 §E142/.test(String(an.stdout || '')),
    '⑥′ `--rule=off` 时**不许**印 §E142 那条判语（§E143 有自己的三条阈值，一份代码同时印两种判语迟早会有人读错那条）');
  const an2 = spawnSync(process.execPath, ['tools/analyze-5p-envfit.mjs', '--dir=' + dA],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(an2.status === 0 && /=== 判读（按 §E142 第 2 节写死的规则/.test(String(an2.stdout || '')), '⑥″ 默认必须印 §E142 那条判语（不写旗标时的行为不变）');
  mk(join(dB, 'a.tsv'), 'pa', 4, rowsA);
  mk(join(dB, 'b.tsv'), 'pb', 2, rowsB);
  mk(join(dB, 'c.tsv'), 'pc', 4, rowsA);
  const anMix = spawnSync(process.execPath, ['tools/analyze-5p-envfit.mjs', '--dir=' + dB],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(anMix.status === 2 && /mix/.test(String(anMix.stderr || '') + String(anMix.stdout || '')),
    '⑥‴ 目录里混了 `#mix=4` 与 `#mix=2` ⇒ 必须 exit 2 拒绝合算（那是两个实验，不是一个）');
  try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 同上 */ }
});

}

