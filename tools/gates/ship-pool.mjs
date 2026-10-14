/*#np-part-header
{"file":"tools/gates/ship-pool.mjs","part":"ship-pool","group":"ship","ranges":[[12021,12291]],"gates":[12021],"patched":[]}
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
export const ords = [12021];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D234 §E590 冠军池装配契约：成员必须在册 · bundle 与表同权重 · 自动成员不许带伤 · 抽签可复现 · 降级必须说话', function () {
  const TS = 'champion-map/pool-members.tsv', BD = 'js/bundled-champion-pool.js';
  const AU = spawnSync(process.execPath, ['tools/pool-add.mjs', '--audit'], { encoding: 'utf8', timeout: 600000 });
  const aLine = String(AU.stdout || '').trim().split('\n').filter(l => /^\{/.test(l)).pop();
  ok(!!aLine, '① `pool-add --audit` 必须吐出机器可读那一行（stdout 尾部：' + String(AU.stdout || AU.stderr || '').slice(-220) + '）');
  const A = JSON.parse(aLine);
  ok(existsSync(TS), '① 池真源表不在：' + TS + ' ⇒ 池机制被引用了但根本没接');
  eq(A.untracked, 0, '① 有 ' + A.untracked + ' 枚成员的文件不在 git 里 ⇒ CI 里这枚不存在（最坏几处：' + JSON.stringify(A.bad) +
    '）⇒ 跑 `git add -f <那几枚>` 再重烘 bundle');
  eq(A.dupWid, 0, '① 同一粒权重占了 ' + A.dupWid + ' 个成员 ⇒ "池里有 N 枚"会虚高，而抽签会连着抽到同一颗（§E589：1443 文件 = 1130 粒）');
  eq(A.blockedAuto, 0, '③ 自动成员里有 ' + A.blockedAuto + ' 枚被上槽体检判 block（送盾/G4/G5）⇒ 自动挑出来的包必须过体检，要点名请走 --invite');
  eq(A.seatKilledAuto, 0, '③ 自动成员里有 ' + A.seatKilledAuto + ' 枚被人席杀刀判死（§E531 两批同号 ≥20pt）⇒ 它已经给人类送分了');
  console.log('   ⚑ 池成员 ' + A.members + ' 枚 ' + JSON.stringify(A.tiers) +
    ' ‖ 体检没量过的自动成员 ' + A.untestedAuto + ' 枚 ‖ 人席没量过的 ' + A.seatUnknown + ' 枚（**没测 ≠ 过关**）');

  /* ② bundle 与表同权重：读 bundle（committed）里的内嵌权重**重算** wid，再与表逐条对 —— 只比"两边都写着同一个字符串"是抓不到"表改了没重烘"的 */
  ok(existsSync(BD), '② 池 bundle 不在：' + BD + ' ⇒ 跑 node tools/build-pool-bundle.mjs');
  const bt = readFileSync(BD, 'utf8');
  const raw = AUDIT.extractJsonObject(bt, 'global.EPIRUS_CHAMPION_POOL');
  ok(!!raw, '② bundle 里找不到 `global.EPIRUS_CHAMPION_POOL = {…}`（生成格式被人改了 ⇒ 页面加载会静默拿不到池）');
  const BO = JSON.parse(raw);
  const TL = readFileSync(TS, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
  const th = Object.fromEntries(TL[0].split('\t').map((x, i) => [x, i]));
  const trows = TL.slice(1).map(l => l.split('\t'));
  eq(BO.members.length, trows.length, '② bundle 有 ' + BO.members.length + ' 条而表有 ' + trows.length + ' 条 ⇒ 表改过没重烘 bundle');
  for (const m of BO.members) {
    const w = widOfArr(m.pack && m.pack.a);
    ok(w === m.wid, '② bundle 里 ' + m.id + ' 的**内嵌权重**算出 wid=' + w + '，但它自己写着 ' + m.wid + ' ⇒ 嵌的是另一枚');
    const row = trows.filter(r => r[th.id] === m.id)[0];
    ok(!!row, '② bundle 里的 ' + m.id + ' 在表里没有这一行（bundle 过期或手改）');
    if (row) { eq(row[th.wid], m.wid, '② ' + m.id + ' 的 wid 表与 bundle 不一致'); eq(row[th.tier], m.tier, '② ' + m.id + ' 的 tier 表与 bundle 不一致'); }
  }

  /* ④⑤ 抽签：产品与量具必须跑同一份实现 ⇒ 拿 sandbox 里的 `js/pool-draw.js`（不是在本文件里再抄一遍抽签） */
  const W = sandbox(process.cwd());
  const PD = W.EpirusPoolDraw;
  ok(PD && typeof PD.compose === 'function' && typeof PD.rng === 'function',
    '④ `js/pool-draw.js` 必须进 `audit-lib.mjs` 的 `CORE` 名单 ⇒ 否则门、量具、页面跑的是三份不同的抽签');
  const lite = trows.map(r => ({ id: r[th.id], wid: r[th.wid], tier: r[th.tier] }));
  ok(lite.length >= 2, '④ 这一份名单不足 2 枚 ⇒ 抽签在数学上必然全同（用户裁定不许）：先补齐成员再谈装配');
  const same = JSON.stringify(PD.compose(lite, 4, PD.rng(20261011))), again = JSON.stringify(PD.compose(lite, 4, PD.rng(20261011)));
  eq(again, same, '④ 同 seed 重放得到不同组成 ⇒ 抽签吃了别的东西（时间/上一个局的状态），所有池读数当场作废');
  let allSame = 0, distinctSum = 0;
  const seen = {};
  for (let s = 1; s <= 40; s++) {
    const c = PD.compose(lite, 4, PD.rng(s * 7919));
    eq(c.seats.length, 4, '④ 五席桌必须恰好分到 4 枚 AI 成员（实测 ' + c.seats.length + '）');
    if (c.allSame) allSame++;
    distinctSum += PD.distinct(c.seats);
    seen[c.seats.map(x => x.id).sort().join('+')] = 1;
  }
  eq(allSame, 0, '④ 40 个 seed 里有 ' + allSame + ' 场四席全同 ⇒ 违反裁定②"可以有重复，但别全同"');
  ok(distinctSum / 40 >= 3.5, '④ 平均不同枚数 ' + (distinctSum / 40).toFixed(2) + ' < 3.5 ⇒ 抽签退化成"基本同一枚"，多样性没进来');
  ok(Object.keys(seen).length >= 8, '④ 40 场只出现 ' + Object.keys(seen).length + ' 种组成 ⇒ "随机抽"名不副实（多样性检查，不是口味）');
  const e = PD.compose([], 4, PD.rng(1));
  eq(e.degraded, 'empty', '⑤ 空池必须报 degraded=empty（不报 ⇒ 页面会"看起来正常"地没有 AI）');
  eq(e.seats.length, 0, '⑤ 空池不许凑席位');
  const one = PD.compose([lite[0]], 4, PD.rng(1));
  ok(one.allSame && one.degraded === 'single-member-tier',
    '⑤ 档内只有 1 枚时全同是数学必然 ⇒ 必须**说出来**（degraded=single-member-tier），静默就是骗玩家');

  /* ⑥ 契约的三处读者必须存在且各就各位：产品取包点、量具、真源表 —— 少一个就是"文档写了但没人执行"。
   *   ⚠ 这里**原本还有一条** `POOL-CONTRACT.md` 里必须出现"逐席"的正向钉措辞腿，10-12 摘掉了：
   *     ① 它违反 METHODOLOGY 第 89 条（10-06 用户点名：文档面只许钉"指向不存在的东西"，不许钉"某句话必须出现"，后者同时造假绿与假红），
   *        而且是全库 278 条里**唯一**一条 C 类（`node tools/gate-audit-vacuous.mjs` 报 C=1 就报到我这条上）；
   *     ② 按第 127 条判"摘了丢不丢覆盖"是**全仓**判的：`docs/POOL-CONTRACT.md` 被 12 处活引用面指着
   *        （`js/ui/ui.js` / `js/train/bots.js` / 生成的 bundle 头 / `tools/audit-lib.mjs` / `build-pool-bundle` 的两条警告 …），
   *        而 `D230` 会把"活引用面里的 `docs/**.md` 指针落空"当场判红 ⇒ 删文档这件事**已经有人守**，我这条只是把措辞也钉死。
   *     ⇒ 保留下面三条**行为/接线**腿（量具存在、必须走 `chooserFor`+`js/pool-draw.js`、必须用共享人类原型表）。 */
  const PB = 'tools/probe-pool.mjs';
  ok(existsSync(PB), '⑥ 池形态的量具不在：' + PB + ' ⇒ 旧尺的缺省装配没被动过，池读数无处来');
  const pbs = readFileSync(PB, 'utf8');
  ok(pbs.indexOf('chooserFor') >= 0 && pbs.indexOf('EpirusPoolDraw') >= 0,
    '⑥ 量具必须走 `duelAssembly` 的 `chooserFor` + `js/pool-draw.js` ⇒ 自己写一份对局循环就是第二份实现（规矩：单一来源）');
  ok(pbs.indexOf('humanPrototypes') >= 0, '⑥ 量具必须用共享的人类原型表（`audit-lib.humanPrototypes`）⇒ 与 `probe-human-seat` 不同原型 = 两个数不能并排读');

  /* ⑦ **真跑解包**：页面的 `loadPool` 必须用能解开 bundle 的那个对象。
   *   这条腿存在是因为 10-11 夜我亲手写错了一次：把 `unpack` 当成 `EpirusChampionPack` 的方法（它只导出 `extract`/`version`），
   *   于是 7 枚成员全部"解不开" ⇒ 页面**静默退回单包**，而标签却照样显示池在生效 —— 浏览器实机才抓得到，CI 抓不到。
   *   ⇒ 这里不用注释提醒，直接把两个模块跑起来比 API，再把 bundle 第一条真解一遍。 */
  const boxPC = { window: {} };
  vm.runInNewContext(readFileSync('js/champion-pack.js', 'utf8'), boxPC, { filename: 'js/champion-pack.js' });
  const PC = boxPC.window.EpirusChampionPack || {};
  ok(typeof PC.unpack !== 'function', '⑦ 前提变了：`EpirusChampionPack` 现在有了 `unpack` ⇒ 本条腿与页面用哪个对象 need 一起重看（别只改门）');
  /* `policy.js` 依赖 rules/state（`R.SK`）⇒ 不能单独塞进空 vm（第一版就是这么炸的：`reading 'SK'`）。
   *   走 `audit-lib.sandbox()` 那条既有链路（`CORE` 里已含 policy.js）。 */
  const POL = sandbox(process.cwd()).EpirusPolicy;
  ok(POL && typeof POL.unpack === 'function', '⑦ 解包的唯一入口 `EpirusPolicy.unpack` 必须存在（页面靠它）');
  const uiSrc = readFileSync('js/ui/ui.js', 'utf8');
  const lpAll = uiSrc.slice(uiSrc.indexOf('function loadPool'), uiSrc.indexOf('function poolDrawFor'));
  /* ⚠ 判"有没有写错对象"只能看**代码**：我在那儿留了一句解释错误本身的注释（"第一版写成 `window.EpirusChampionPack.unpack`"），
   *   不剥注释这条腿会永远红 —— 与普查脚本同一课（`gate-audit` 技能的"常见自坑"）。 */
  const lp = lpAll.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  ok(lp.length > 80 && /P\.unpack\(/.test(lp), '⑦ 页面的 `loadPool` 必须走 `P.unpack(`（= `EpirusPolicy.unpack` 的模块内别名）');
  ok(!/EpirusChampionPack\.unpack|PK\.unpack/.test(lp), '⑦ `loadPool` 里不许出现 `EpirusChampionPack.unpack`/`PK.unpack` ⇒ 那个对象没有 `unpack`，写错了不报错、只会静默退回单包');
  const bundleSrc = readFileSync('js/bundled-champion-pool.js', 'utf8');
  const rawB = AUDIT.extractJsonObject(bundleSrc, 'global.EPIRUS_CHAMPION_POOL');
  ok(!!rawB, '⑦ bundle 解析不出来（生成格式变了？）');
  if (rawB) {
    const first = JSON.parse(rawB).members[0];
    const un = POL.unpack(first.pack, true);
    ok(un && typeof un.length === 'number' && un.length > 50,
      '⑦ `EpirusPolicy.unpack` 必须真能解开成员 ' + first.id + ' 的内嵌包（拿到长度 ' + (un && un.length) + '）' +
      ' ⇒ 解不开就意味着页面里该枚会被整枚踢出池，而这是**静默**的');
  }

  /* ⑧ **人席那道闸的输入卫生**：批表里没有基准行 ⇒ "与现役比 ≥20pt"根本比不出来，不许读成"零格否决 = 合格"。
   *   立案依据（10-12 00:5x 实测）：`pool-seat-ml-*.tsv` 是跑探针时 `--packs=` 顶掉了默认基准
   *   `js/bundled-champion-3p.js` 造出来的 ⇒ 12 行全是成员、0 行基准，而第一版 `seatKillIndex` 的 `kills` 初值是 0
   *   ⇒ 六枚 mid/low 全被刷成"量过且干净"进了自动成员，其中两枚**真踩 4 格 / 2 格**（给只会开枪的人类送一半的局）。
   *   这条腿不钉文案：把同一批表**带基准 / 剥掉基准**各喂一次，比两次的结论数量。 */
  const SF = 'champion-map/pool-seat-ml2-90210.tsv', SF2 = 'champion-map/pool-seat-ml2-90211.tsv';
  ok(existsSync(SF) && existsSync(SF2), '⑧ 人席批表不在：' + SF + ' / ' + SF2 +
    ' ⇒ 这条腿没有输入可判（要判"没量过 ≠ 干净"，表必须在册 —— 与腿① 同一个纪律）');
  const idw = rel => rel;                     /* 只验证判据本身：按路径当身份就能对齐两张表，不需要读包 */
  const withBase = [SF, SF2].map(f => seatRd(f, readFileSync(f, 'utf8')));
  const strip = t => ({ h: t.h, rows: t.rows.filter(r => r[t.h.id] !== 'bundled-champion-3p') });
  const noBase = withBase.map(strip);
  eq(pairHasBase(withBase), true, '⑧ 带基准的那一对必须被认成"可判"（认不出 ⇒ 这条闸永远整对作废，等于没有）');
  eq(pairHasBase(noBase), false, '⑧ 剥掉基准行之后必须判"不可判" ⇒ 现在它被当成可判，说明基准的找法不对');
  const ixOk = seatKillIndex(withBase, idw), ixBad = seatKillIndex(noBase, idw);
  ok(ixOk.size > 0, '⑧ 带基准的表必须出得了结论（现在 0 条 ⇒ 批表格式或判据接线变了，本门在看空气）');
  eq(ixBad.size, 0, '⑧ 无基准的表必须一条结论都不给，实测给了 ' + ixBad.size + ' 条 ⇒ "算不出"正在被读成"零格否决"（假干净）');
  const killedPath = 'docs/artifacts/v7divK2b-82.bak';   /* 池里的 `v7w3c-82`，10-12 实测踩 4 格；它已被移出池 */
  const kHit = ixOk.get(killedPath);
  ok(kHit && kHit.kills > 0, '⑧ 已知送分包 ' + killedPath + ' 必须被判出踩线（实测 ' + (kHit ? kHit.kills : '索引里没有') +
    '）⇒ 判据读不到格就别说自己在守门');
  ok(readFileSync('champion-map/pool-members.tsv', 'utf8').indexOf(killedPath) < 0,
    '⑧ 已被人席判死的 ' + killedPath + ' 不许还在池里（腿③ 只查自动成员的 seatKill>0，这条钉的是"路径也别留在表里"）');

  /* ⑨ **回显与决策必须走同一个判定**（10-12 03:0x~03:1x 浏览器实机抓到的一条真撒谎；时间更正见 `js/ui/ui.js` 的 `poolPlan` 头注）：
   *   `champForSeat`（真决策）先查了"本机导入优先"，而 `aiInfo`（席位标签）没查就报"池·mid 本局=…"
   *   ⇒ 只要用户在这台机器上训练/导入过 3P 冠军（训练完页面**自动**写 `localStorage['epirus.champion3p']`），
   *     五人桌实际四席用他那枚，而标签说池在跑。修法不是补一句注释，是把判定收成一个 `poolPlan()`，两边都问它。
   *   这条腿因此钉"结构"：`aiInfo` 里不许再出现直接调 `poolDrawFor` 的那条路（走了就绕开本机导入那一支）。 */
  const aiAll = uiSrc.slice(uiSrc.indexOf('function aiInfo'), uiSrc.indexOf('function pickTargetFor'));
  const ai = aiAll.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  ok(ai.length > 200, '⑨ 前提变了：`aiInfo` 抽不出来了（改名或挪走 ⇒ 本条与它要防的那件事一起失效，别让它默默不跑）');
  ok(/poolPlan\(/.test(ai), '⑨ `aiInfo` 必须问 `poolPlan(`（回显与决策同一个判定）⇒ 现在它自己判池，就会漏掉"本机导入优先"那一支');
  ok(!/poolDrawFor\(/.test(ai), '⑨ `aiInfo` 里不许直接调 `poolDrawFor(` ⇒ 绕开 `poolPlan` 就是绕开"本机导入优先"，标签会与真决策分叉（实测过的病）');
  ok(uiSrc.indexOf('function poolPlan') > 0 && uiSrc.indexOf('function champForSeat') > 0,
    '⑨ `poolPlan` 与 `champForSeat` 必须都在（少一个就是"单一判定"这句只剩一半）');
  /* ⑩ §E599（用户 10-12：「现在演化图的分带问题，现在还挂着旧冠军池」）：**图必须与池真源一致**。
   *   图是**烘焙期**从 `pool-members.tsv` 抄的（`champion-map/viewer.mjs` 把每枚的 `tier` 写进内联
   *   `var DATA` 的 `pt`），池表一改（`tools/pool-add.mjs` 写）图就落后 —— 而以前**没有任何东西会提醒**
   *   （本仓为此手工重烘过多次；本次实测图整整落后一个名册：图里 20 枚 7/6/7、真源 27 枚 9/7/11
   *   ⇒ 新增 7 枚 + 换带 4 枚）。
   *   同步器 = `champion-map/pool-sync.mjs`（重烘 0.3 秒 + **回读复核**，不信"我写了"）；`--check` 只报不写。 */
  const syncArgs = a => spawnSync(process.execPath, ['champion-map/pool-sync.mjs'].concat(a), { cwd: process.cwd(), encoding: 'utf8' });
  const sA = syncArgs(['--check', '--quiet']);
  eq(sA.status, 0, '⑩a 演化图的池层必须与真源逐枚一致（同步：`node champion-map/pool-sync.mjs`）：'
    + String(sA.stdout || sA.stderr || '').trim().split('\n').slice(-1)[0].slice(0, 200));
  /* ⑩b 合成正对照：拿一份"被改过一枚带的图"当输入 ⇒ `--check` 必须 exit 1
   *   （否则这条腿只是"跑了个命令"，钉不住任何东西 —— 它咬的正是"图 ≠ 表"这件事）。 */
  const psFix = join(tmpdir(), 'np-d234-poolsync-fixture.html');
  writeFileSync(psFix, String(readFileSync('champion-map/index.html', 'utf8')).replace('"pt":"hard"', '"pt":"soft"'));
  const sB = syncArgs(['--check', '--quiet', '--chart=' + psFix]);
  eq(sB.status, 1, '⑩b 合成正对照：把图里一枚成员的带改掉（图 ≠ 表）⇒ `--check` 必须 exit 1（实测 ' + sB.status + '）');

  /* ⑩c §E608（千问 10-15）：**整张页面必须逐字等于生成器的输出** —— ⑩a 只比"池层那一小块"，
   *   而 10-15 本机撞的是另一件事：`viewer.mjs` 的注释里混进反引号（那段是模板字符串 ⇒ 整个烘焙 **SyntaxError 崩掉**），
   *   而四视图页检照样报 89/0 —— 因为它读的是**上一版产物**。崩了没人知道、判据全绿，这就是"跑在旧页面上"。
   *   判据不能靠 mtime（CI 检出顺序会让它假红）⇒ 重烘到临时路径逐字节比。
   *   ⑩d 是给这条比本身验牙：把在册产物改一个字符再比，必须**不等**（否则 ⑩c 只是"跑了个烘焙"）。 */
  const bakeFix = join(tmpdir(), 'np-d234-rebake-' + process.pid + '.html');
  const bk = spawnSync(process.execPath, ['champion-map/viewer.mjs', '--out=' + bakeFix],
    { cwd: process.cwd(), encoding: 'utf8' });
  eq(bk.status, 0, '⑩c 烘焙必须成功（失败 ⇒ 页面产物是旧的，判据与截图都跑在上一版上）：' +
    String(bk.stdout || bk.stderr || '').trim().split('\n').slice(-2).join(' ‖ ').slice(0, 220));
  const shipped = readFileSync('champion-map/index.html');
  let pageSame = true;
  try { const baked = readFileSync(bakeFix); pageSame = baked.length === shipped.length && baked.equals(shipped); }
  catch (e) { pageSame = false; }
  ok(pageSame, '⑩c 在册的 champion-map/index.html 必须逐字等于 `node champion-map/viewer.mjs` 的输出' +
    '（改了生成器忘了重烘 ⇒ 页检/截图量的都不是这份代码）。重烘：node champion-map/viewer.mjs');
  const perturbed = Buffer.from(shipped); perturbed[perturbed.length - 20] = perturbed[perturbed.length - 20] ^ 0x20;
  ok(!perturbed.equals(shipped), '⑩d 牙口自证：改一个字节必须让上面的逐字比对判成"不等"（这条不成立说明 ⑩c 比的是空气）');
  try { rmSync(bakeFix, { force: true }); } catch (e) { /* 临时件删不掉不影响判据（它在 tmpdir，不在 docs/artifacts 的 24h 账里） */ }

  /* ⑫ §E600-B（用户 10-13 裁定「把启发式随机脚本塞到弱池子里面」）：**掺脚本席这件事必须两侧同源、可复现、不吞掉池**。
   *   钉四件行为 + 一条窄接线：
   *     ⑫a 声明了 `scriptMix` 的档，`scriptSeats` 推出的席数必须 ≥1 且 **小于 AI 席数**（至少留一席包 ⇒ 池不许被整个盖掉）
   *     ⑫b 同 salt 重放 ⇒ 组成逐字相同（掺席用的是同一个 rand，不许偷偷读时间/自造种子）
   *     ⑫c 掺席只**盖位置**、不重排抽签：不掺时的包阵容前缀必须与掺了之后的包阵容一致
   *     ⑫d `scriptMix.ids` 里每个 id 都必须真在 `Bots.STYLES` 里（D227①f 钉的是 style 档，这条钉 mix 档）
   *     ⑫e 页面的 `poolDrawFor` 必须把 mix 传进 `compose`（少传一个参数就是"档位表写了但产品没跑"——
   *          这类"配置在、接线断"是本仓第 45/92 条反复付过学费的形状，只能钉接线这一处） */
  {
    const BW = sandbox(process.cwd());
    const BPD = BW.EpirusPoolDraw, BB = BW.EpirusBots;
    ok(!!BPD && typeof BPD.scriptSeats === 'function' && typeof BPD.compose === 'function',
      '⑫ 前提：`js/pool-draw.js` 必须导出 `scriptSeats` 与 `compose`（推导只许这一份）');
    ok(!!BB && Array.isArray(BB.STYLES), '⑫ 前提：`Bots.STYLES` 取不到');
    const mixTiers = ((BB && BB.DIFF_TIERS) || []).filter(t => t.scriptMix);
    ok(mixTiers.length >= 1, '⑫ 前提：现在至少有一档声明 scriptMix（实测 ' + mixTiers.length + ' 档）⇒ 一条都没了就是被撤了，这条门要一起改');
    const fake = []; for (let i = 0; i < 11; i++) fake.push({ id: 'M' + i, wid: 'w' + i, tier: 'soft' });
    for (const t of mixTiers) {
      const ai = 4;
      const mix = BPD.scriptSeats(t, ai, BB.STYLES);
      ok(mix && mix.seats >= 1 && mix.seats < ai,
        '⑫a 档 ' + t.id + ' 的掺席数必须在 1..' + (ai - 1) + ' 之间（至少留一席包）实测 ' + (mix ? mix.seats : 'null'));
      const ids = (t.scriptMix.ids || []);
      ok(ids.every(id => BB.STYLES.some(s => s.id === id)),
        '⑫d 档 ' + t.id + ' 的 scriptMix.ids 必须全在 STYLES 里（认不出的会被静默跳过 = 档位表撒谎）：' + ids.join(','));
      const m2 = BPD.scriptSeats(t, ai, BB.STYLES);
      ok(JSON.stringify(mix) === JSON.stringify(m2), '⑫b 同一档推导两次必须逐字相同（不许读时间）');
      const r1 = BPD.compose(BPD.byTier(fake, 'soft'), ai, BPD.rng(90210), mix);
      const r2 = BPD.compose(BPD.byTier(fake, 'soft'), ai, BPD.rng(90210), mix);
      ok(JSON.stringify(r1) === JSON.stringify(r2), '⑫b 同 salt 两次组成逐字相同（' + t.id + '）');
      const noMix = BPD.compose(BPD.byTier(fake, 'soft'), ai, BPD.rng(90210));
      /* 正确的比法：**把脚本席那几号位置去掉**之后的包序列，必须与不掺时同位置的包一致。
       *   （第一版我比的是"不掺序列的前 k 个"—— 脚本席落在中间时那个前缀本来就不该相等，
       *    红的是我的断言，不是产品：这条腿当场把这句话抓出来了。） */
      const packsAfter = r1.seats.filter(s => s.kind !== 'script').map(s => s.id);
      const packsNoMixSamePos = noMix.seats.filter((s, ix) => !r1.seats.some(q => q.kind === 'script' && q.seat === ix)).map(s => s.id);
      ok(JSON.stringify(packsNoMixSamePos) === JSON.stringify(packsAfter),
        '⑫c 档 ' + t.id + '：掺席只许盖位置、不许重排抽签 ⇒ 去掉脚本席之后的包序列必须与不掺时一致（不掺=' +
        packsNoMixSamePos.join(',') + ' ‖ 掺后=' + packsAfter.join(',') + '）');
      const nScript = r1.seats.filter(s => s.kind === 'script').length;
      ok(nScript === mix.seats, '⑫a 档 ' + t.id + ' 组成里的脚本席数必须等于推导值（实测 ' + nScript + ' vs ' + mix.seats + '）');
      const two = BPD.scriptSeats(t, 1, BB.STYLES);
      ok(!two || !two.seats, '⑫a 只有 1 席 AI（2P 桌）时不许掺（会把池整个盖掉），实测 seats=' + (two ? two.seats : 'null'));
    }
    const uiS = String(readFileSync('js/ui/ui.js', 'utf8')).split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
    /* 只看那一行调用本身（第一版写 `/D\.compose\([^)]*mix/`，但参数里嵌套着 `D.rng((state && ...))` ⇒
     *   `[^)]*` 在第一个右括号就断了，**接线其实是通的、腿却红** —— 又一例"红的是尺子自己"）。 */
    const compLine = uiS.find(l => l.indexOf('D.compose(') >= 0) || '';
    ok(compLine.length > 0 && /,\s*mix\b/.test(compLine),
      '⑫e 页面 `poolDrawFor` 必须把推导出来的 mix 传给 `compose`（档位表写了 scriptMix 而产品不传 = 假档）‖ 实测那行：' +
      (compLine.trim().slice(0, 120) || '(整页找不到 D.compose 调用)'));
  }
  /* ⑬ §E609 按带加权混抽（用户 10-15 裁定：中等带拆开丢进两端 ⇒ "普通"逐席按 0.5/0.5 掷带、带内均匀取枚）。
   *   四条各卡一种坏法，其中 ⑬a 的牙是**量出来的**：
   *     ⑬a 真源 3P 表上声明了 `poolMix` 的档必须真的走到加权，且 **10000 场 × 4 席 = 40000 席**里 soft 份额落在 0.500±0.02。
   *          牙：把 `bandW` 传丢 ⇒ 退化成"整表均匀抽" ⇒ 份额就是 soft 占比 16/27 = **0.593**，当场出界（跑过，见 CHANGELOG v1.7.19）；
   *          40000 席下 p=0.5 的 SE = 0.0025 ⇒ ±0.02 是 8σ，不是"刚好绿"。
   *     ⑬b **没拆带的表必须走退路并说话**：2P 那张（hard 2 ‖ mid 3 ‖ soft 2）上 `rosterFor` 必须给 `bandW=null` + 非空 `note`
   *          + 非空成员 ⇒ 抓的是"拿 3P 的证据替 2P 决定归属"和"静默换抽法"两种坏。
   *     ⑬c `compose` 必须把生效的带比印出来（`out.bands`）⇒ 页面标签与判词有地方抄，不必自己再推一遍（第 134 条那一族）。
   *     ⑬d 页面与量具都必须调 `rosterFor(` ⇒ 同 ⑫e 那一族："配置在表里、接线断了"。 */
  {
    const BW3 = sandbox(process.cwd());
    const Q = BW3.EpirusPoolDraw, BT = BW3.EpirusBots;
    ok(!!Q && typeof Q.rosterFor === 'function', '⑬ 前提：`js/pool-draw.js` 必须导出 `rosterFor`（带抽法只许这一份推导）');
    const mixT = ((BT && BT.DIFF_TIERS) || []).filter(t => t.poolMix);
    ok(mixT.length >= 1, '⑬ 前提：至少一档声明 poolMix（实测 ' + mixT.length + ' 档）⇒ 一条都没了就是被撤了，这条门要一起改');
    const all3 = trows.map(r => ({ id: r[th.id], wid: r[th.wid], tier: r[th.tier] }));
    const tierOf = {}; for (const m of all3) tierOf[m.id] = m.tier;
    for (const t of mixT) {
      const R = Q.rosterFor(all3, t);
      const names = Object.keys(t.poolMix).filter(k => k !== 'else');
      ok(names.every(k => all3.some(m => m.tier === k)),
        '⑬a 档 ' + t.id + ' 声明的带在真源表里一枚都没有：' + names.join(',') + ' ⇒ 加权会静默退到剩下的那一头');
      ok(!!R.bandW, '⑬a 真源 3P 表上档 ' + t.id + ' 必须走到按带加权（mid 已拆空）‖ 实测 bandW=' + JSON.stringify(R.bandW) +
        ' ‖ note=' + (R.note || '无'));
      let softCnt = 0, seatCnt = 0, bandsTxt = '';
      for (let s = 1; s <= 10000; s++) {
        const c = Q.compose(R.members, 4, Q.rng(s * 7919 + 13), null, R.bandW);
        eq(c.seats.length, 4, '⑬a 五席桌必须恰好 4 席 AI（实测 ' + c.seats.length + '）');
        for (const m of c.seats) { seatCnt++; if (tierOf[m.id] === 'soft') softCnt++; }
        bandsTxt = c.bands || '';
      }
      const share = softCnt / seatCnt;
      ok(Math.abs(share - 0.5) <= 0.02, '⑬a 档 ' + t.id + ' 抽 ' + seatCnt + ' 席里 soft 份额 ' + (100 * share).toFixed(2) +
        '% 不在 50%±2% ⇒ 加权没落地（整表均匀抽会得到 ' + (100 * all3.filter(m => m.tier === 'soft').length / all3.length).toFixed(1) + '%）');
      ok(/hard 50% ‖ soft 50%/.test(bandsTxt), '⑬c `compose` 必须把生效带比印出来（页面标签要抄这一句）‖ 实测 bands=' + (bandsTxt || '(空)'));
    }
    const P2 = 'champion-map/pool-members-2p.tsv';
    if (existsSync(P2) && mixT.length) {
      const L2 = readFileSync(P2, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
      const h2 = L2[0].split('\t'), i2 = h2.indexOf('tier'), id2 = h2.indexOf('id');
      const m2 = L2.slice(1).map(l => l.split('\t')).filter(r => r[id2]).map(r => ({ id: r[id2], wid: r[id2], tier: r[i2] }));
      const R2 = Q.rosterFor(m2, mixT[0]);
      ok(!R2.bandW && !!R2.note && R2.members.length > 0,
        '⑬b 2P 那张表还没拆带 ⇒ `rosterFor` 必须走退路（bandW=null + 说出 note）‖ 实测 bandW=' + JSON.stringify(R2.bandW) +
        ' ‖ members ' + R2.members.length + ' 枚 ‖ note=' + (R2.note || '(空 = 静默降级)'));
    }
    const uiLines = String(readFileSync('js/ui/ui.js', 'utf8')).split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
    const ladLines = String(readFileSync('tools/probe-diff-ladder.mjs', 'utf8')).split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
    /* ⚠ 第一版这条只判"有没有调 rosterFor" ⇒ 拿"算出来但没传给 compose"那个变异去验，**它是绿的**（红话见 CHANGELOG v1.7.19）。
     *   所以钉两处：① rosterFor 必须被调（推导不许在页面里重写一遍）② 它算出的 bandW 必须真的进 compose 那一行。
     *   形状与 ⑫e 同一族（"配置在表里、接线断了"）—— 这类只能钉接线，因为断点在源码里，不在数据里。 */
    ok(uiLines.some(l => l.indexOf('D.rosterFor(') >= 0), '⑬d1 页面 `poolDrawFor` 必须调 `rosterFor`（不许自己判 mid 空了要不要换 mix）');
    const uiComp = uiLines.find(l => l.indexOf('D.compose(') >= 0) || '';
    ok(/R\.bandW/.test(uiComp), '⑬d2 页面必须把 `rosterFor` 算出的 bandW 传进 `compose` ⇒ 传丢了就是"表里写了混抽、产品还在整表均匀抽"（实测份额会跑到 59.3%）‖ 实测那行：' +
      (uiComp.trim().slice(0, 150) || '(找不到 D.compose 调用)'));
    ok(ladLines.some(l => l.indexOf('rosterFor(') >= 0), '⑬d3 量具 `probe-diff-ladder` 必须调同一份 `rosterFor` ⇒ 否则量的是"我以为产品会怎么抽"');
    const ladComp = ladLines.find(l => l.indexOf('PD.compose(') >= 0) || '';
    ok(/bandW/.test(ladComp), '⑬d4 量具的 compose 也必须带 bandW（与页面同一条抽法）‖ 实测那行：' + (ladComp.trim().slice(0, 150) || '(找不到 PD.compose 调用)'));
  }
  /* ⑪ §E600-A（用户 10-13 裁定③④：「如今没有『当前现役』这个东西了」‖「调整成实时更新而不是定死」）
   *   钉两件**可控**的事，不钉措辞（METHODOLOGY 89）：
   *     ⑪a 名册与烘焙页都不许再带「当前线上」这个身份类别（扫**数据**的值）；
   *     ⑪b 活槽必须被解析认得到图上的一行，且**那一行在页面上带着上线时刻 `sh`** ——
   *        这就是 10-11 那次没响的警报：`T8-s114` 上槽之后，`ship-times.tsv` 停在上一任，
   *        真现役在图上被画成"没上过线"的小点，而 278 条门与 86 条页内自检**全绿**。
   *   ⑪c 合成正对照（牙口）：把时间轴里活槽那一段的身份字段挖掉 + 声明末行改指一个图上不存在的名字
   *        ⇒ 解析必须认不出（`live.ok` 为假），否则这条腿只是"跑了个命令"。 */
  {
    const SIDI = loadSlotId();
    const LV = String(readFileSync('champion-map/coords.tsv', 'utf8')).replace(/\r\n/g, '\n').split('\n');
    const lset = new Set(); const lIdx = LV[0].split('\t').indexOf('lineage');
    for (let k = 1; k < LV.length; k++) { const c = LV[k].split('\t'); if (c[lIdx]) lset.add(c[lIdx]); }
    ok(!lset.has('当前线上'), '⑪a 名册里不许再有「当前线上」这一类身份（现值：' + Array.from(lset).join(' ‖ ') + '）');
    const PG = String(readFileSync('champion-map/index.html', 'utf8'));
    ok(PG.indexOf('"lin":"当前线上"') < 0, '⑪a 烘焙页的 DATA 里也不许带它（图必须与名册同一份身份）');
    /* 取节点用**balanced-free 的正则**而不是整段 JSON.parse：第一版 `indexOf('];')` 截到数组内部就炸
     *   （实测 `Unexpected non-whitespace character after JSON at position 775`）—— 页内 DATA 的节点是扁平对象，
     *   用 `"id":"X"` 起、到第一个 `}` 止就够，取不到就如实报"这一行不在图上"。 */
    const nodeOf = id => { const m = new RegExp('"id":"' + id.replace(/[.]/g, '\\.') + '"[^}]*\\}').exec(PG);
      return m ? m[0] : null; };
    const nNodes = (PG.match(/\{"id":"/g) || []).length;
    const nStr = nodeOf(SIDI.live.coordsId || '__no_such__');
    ok(!!SIDI.live.coordsId, '⑪b 活槽 wid (' + String(SIDI.live.wid).slice(0, 8) + ') 必须解到图上的一行（现解 = ' + (SIDI.live.coordsId || '⛔ 认不出') + '）');
    ok(!!nStr, '⑪b 活槽现主「' + SIDI.live.coordsId + '」必须在页内 DATA 里有行（' + nNodes + ' 枚里找不到 = 图没重烘）');
    const mSh = nStr && /"sh":"([^"]*)"/.exec(nStr), mSv = nStr && /"sv":"([^"]*)"/.exec(nStr);
    ok(mSh && mSh[1], '⑪b 活槽现主那一行必须带着上线时刻（sh 空 = 换包那笔没同步进图 ‖ 实测 sh=' + JSON.stringify(mSh && mSh[1]) + ' ‖ sv=' + JSON.stringify(mSv && mSv[1]) + ' ‖ 期望 wid=' + String(SIDI.live.wid).slice(0, 8) + '）');
    { /* ⑪c 正对照：造一棵"换了包但什么都没同步"的临时树 */
      const fx = mkdtempSync(join(tmpdir(), 'np-d234-slot-'));
      mkdirSync(join(fx, 'champion-map'), { recursive: true }); mkdirSync(join(fx, 'js'), { recursive: true });
      copyFileSync('champion-map/coords.tsv', join(fx, 'champion-map/coords.tsv'));
      copyFileSync('champion-map/lineage.tsv', join(fx, 'champion-map/lineage.tsv'));
      copyFileSync('js/bundled-champion-3p.js', join(fx, 'js/bundled-champion-3p.js'));
      const tlF = String(readFileSync('champion-map/slot-timeline.tsv', 'utf8')).replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
      const th = tlF[0].split('\t'), iw = th.indexOf('wid'), ip = th.indexOf('panelId'), ia = th.indexOf('metaArm');
      let cut = 0;
      for (let k = tlF.length - 1; k >= 1; k--) { const c = tlF[k].split('\t');
        if (c[iw] === SIDI.live.wid) { c[ip] = ''; c[ia] = '不存在的名字-' + k; tlF[k] = c.join('\t'); cut++; } }
      writeFileSync(join(fx, 'champion-map/slot-timeline.tsv'), tlF.join('\n') + '\n', 'utf8');
      /* 第一版正对照只挖了 panelId/metaArm，结果**没咬下来**：解析还有第三跳 `ID_OF_WID[wid]`（按 `lineage.tsv` 的
       *   wid 列认行）照样把它认成了 T8-s114。这不是解析器的错，是我这只眼做得太浅 ——
       *   正对照要挖的是**整条兜底链**：面板名、合成行名（SLOT-<wid8> 在 coords 里没有对应行）、声明行、wid 跳。 */
      const lgF = String(readFileSync('champion-map/lineage.tsv', 'utf8')).replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
      const lh = lgF[0].split('\t'), lw = lh.indexOf('wid');
      let lgcut = 0;
      if (lw >= 0) for (let k = 1; k < lgF.length; k++) { const c = lgF[k].split('\t');
        if (c[lw] === SIDI.live.wid) { c[lw] = ''; lgF[k] = c.join('\t'); lgcut++; } }
      writeFileSync(join(fx, 'champion-map/lineage.tsv'), lgF.join('\n') + '\n', 'utf8');
      ok(lgcut > 0, '⑪c 前提：lineage.tsv 里找不到活槽 wid 那一行（' + String(SIDI.live.wid).slice(0, 8) + '）⇒ 正对照没改到东西，这只眼是瞎的');
      const hist = String(readFileSync('champion-map/slot-history.tsv', 'utf8')).replace(/\r\n/g, '\n').split('\n');
      for (let k = hist.length - 1; k >= 0; k--) if (hist[k] && hist[k].charAt(0) !== '#' && hist[k].split('\t')[1]) {
        const c = hist[k].split('\t'); c[1] = '不存在的名字-declared'; hist[k] = c.join('\t'); }
      writeFileSync(join(fx, 'champion-map/slot-history.tsv'), hist.join('\n') + '\n', 'utf8');
      const FX = loadSlotId(fx);
      ok(cut > 0, '⑪c 前提：正对照没能改到活槽那一段（时间轴里找不到 wid=' + String(SIDI.live.wid).slice(0, 8) + '）⇒ 这只眼是瞎的');
      ok(!FX.live.coordsId, '⑪c 合成正对照：时间轴身份挖掉 + 声明改指不存在的名字 ⇒ 解析必须认不出（实测认成「' + (FX.live.coordsId || '(空)') + '」）');
      rmSync(fx, { recursive: true, force: true });
    }
  }
});
}

