/*#np-part-header
{"file":"tools/gates/train-econ.mjs","part":"train-econ","group":"train","ranges":[[1327,1597],[6128,6144],[8193,8207],[8255,8271],[8338,8461],[8939,9120],[9265,9299],[9374,9506],[11644,11708]],"gates":[1327,6128,8193,8255,8338,8939,8967,9265,9374,9442,11644],"patched":[]}
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
export const ords = [1327, 6128, 8193, 8255, 8338, 8939, 8967, 9265, 9374, 9442, 11644];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
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
