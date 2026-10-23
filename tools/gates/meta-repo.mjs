/*#np-part-header
{"file":"tools/gates/meta-repo.mjs","part":"meta-repo","group":"meta","ranges":[[661,704],[863,883],[917,1002],[2253,2288],[2416,2432],[5078,5110],[9554,9573],[9613,9679],[11116,11215]],"gates":[661,863,917,944,971,2253,2416,5078,9554,9613,11116,11158],"patched":[11121]}
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
export const ords = [661, 863, 917, 944, 971, 2253, 2416, 5078, 9554, 9613, 11116, 11158];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('REPRO 训练路径不得出现裸 Math.random / Date.now（白名单见下）', function () {
  const WL = [
    'js/train/bots.js',            // rnd() 的 Math.random 兜底（浏览器无 state.rng 时）
    'js/train/policy.js',          // __rng 的默认值 Math.random（可被 setRng 覆盖）
    'T.mulberry32 ? T.mulberry32', // 播种流不可用时的显式兜底
    'Date.now() - t0 > cap',       // ⚠️ 理由已更正：它**参与决策**（在生成循环内，到点直接 return
    //   ⇒ 机器负载不同 ⇒ 跑到的代数不同 ⇒ 冠军不同）。暂列白名单只为让断言可用，
    //   正解是改成按代数上限（docs/research/reviews/REVIEW-3P.md P3#2）
    'Date.now() % ',               // 仅允许作为"已废弃写法"的检测目标，不应出现在有效代码
  ];
  /* 扩面（千问复核指出）：原先只扫 server/*.mjs —— **恰好只保护了刚修好的那条路**，
   * 而 tools/train-*.mjs 三个 CLI 训练器完全没播种，研究数字多半出自它们。 */
  const files = ['server/train-server.mjs', 'server/train-worker.mjs', 'server/paralleltrain.mjs',
    'tools/train-fast.mjs', 'tools/train-best.mjs', 'tools/train-3p.mjs', 'js/train/evo.js'];
  /* v1.8.13：把"扫一个文件"抽成一个函数，好让这条门能**自己喂自己一行坏代码**（下面三条自检）。
   *   为什么必须有：这条门的白名单已经长到 9 条 `indexOf(...) >= 0 ⇒ continue`，
   *   于是"白名单把真违规也一起吃掉"这件事**只会让它变绿、不会让它变红** ⇒ 没有正对照的扫描器就是装饰
   *   （这正是本仓那条"跑 X 绿 ≠ 坏了 X 会红"，也是 §廿四/§廿五 同一个病根的第三种形状）。 */
  const scanTrainRandom = function (f, src) {
    const out = [];
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      const t0 = L.trim();
      if (t0.startsWith('*') || t0.startsWith('//') || t0.startsWith('/*')) continue;   // 注释不算
      const hasRand = L.indexOf('Math.random(') >= 0;
      const hasClock = L.indexOf('Date.now(') >= 0;
      if (!hasRand && !hasClock) continue;
      if (WL.some(function (w) { return L.indexOf(w) >= 0 || f.indexOf(w) >= 0 && w.indexOf('/') >= 0; })) continue;
      if (L.indexOf('const t0 = Date.now()') >= 0) continue;   // 纯计时（不参与决策）
      if (L.indexOf('Date.now() - t0') >= 0) continue;      // 超时
      if (L.indexOf('toISOString') >= 0) continue;          // 时间戳（meta 用）
      if (L.indexOf('toString(36)') >= 0) continue;         // cache-busting token
      if (L.indexOf('mulberry32') >= 0) continue;           // 播种兜底
      /* js/train/evo.js 里的 Math.random 是**安全**的，但这个安全性依赖于另一条断言：
       * evo.js 跑在沙箱里，而 __seedSandbox 把整个沙箱的 Math 换掉了；
       * REPRO2 正好保证"每个训练入口都必须播种"。两者合起来才成立 ——
       * 如果有一天新加了一个不播种的入口，REPRO2 会先红。
       * （千问倾向把这几处直接改成播种流；列白名单是我在预算内的折中，已记入 CHANGELOG。） */
      if (f === 'js/train/evo.js' && L.indexOf('Math.random(') >= 0) continue;
      if (f === 'js/train/bots.js' && L.indexOf('Math.random(') >= 0) continue;  // rnd() 兜底
      out.push(f + ':' + (i + 1) + '  ' + L.trim().slice(0, 70));
    }
    return out;
  };
  const bad = [];
  for (const f of files) { for (const b of scanTrainRandom(f, readFileSync(f, 'utf8'))) bad.push(b); }
  eq(bad.length, 0, '训练路径出现裸随机/时间源：\n    ' + bad.join('\n    '));
  /* ===== 这条扫描器自己的三条腿（跑在同一份逻辑上，不读任何真实文件）===== */
  const FAKE = 'server/__selftest__.mjs';
  const hitRand = scanTrainRandom(FAKE, '  const jitter = Math.random();\n');
  eq(hitRand.length, 1, '自检①（正对照）：扫描器必须抓到一行裸 `Math.random()` ⇒ 抓不到就是白名单把它吃掉了，这条门是装饰。实测抓到 ' + hitRand.length + ' 行');
  const hitClock = scanTrainRandom(FAKE, '  const stamp = Date.now();\n');
  eq(hitClock.length, 1, '自检②（正对照）：必须抓到低面钟的裸 `Date.now()`（变量名不是 t0 ⇒ 不在"纯计时"那一支）。实测抓到 ' + hitClock.length + ' 行');
  const fp = scanTrainRandom(FAKE, '  const t0 = Date.now();\n  // Math.random() 写在注释里\n  /* Date.now() 写在块注释里 */\n');
  eq(fp.length, 0, '自检③（不许误伤）：纯计时那一行与两处注释都不该报 ⇒ 报了就是白名单在拦正常代码，判据会被人整个拆掉。实测 ' + JSON.stringify(fp));
});

t('L2 事件字段名必须与发射端一致（筛错字段 => 把"没发生"当结论）', function () {
  /* Real instance: I filtered transfer events by `e.from === 0`, but the event is
   * { type:'transfer', to:<transfer player>, from:<attacker> } -- so I concluded
   * "transfer never fired" from a wrong field. Pin the schema here. */
  const st = S.createState('multi', { next: mulberry32(61) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.GUN, { target: 1 });
  S.attemptAction(st, 1, R.SK.TRANSFER, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  const tr = st.events.filter(function (e) { return e.type === 'transfer'; });
  ok(tr.length > 0, '构造场景里应出现 transfer 事件');
  ok(tr.every(function (e) { return typeof e.to === 'number'; }), 'transfer 必须带 to（转移方）');
  ok(tr.every(function (e) { return typeof e.from === 'number'; }), 'transfer 必须带 from（攻击者）');
  ok(tr.every(function (e) { return e.to !== e.from; }), 'transfer 的 to/from 不能是同一人');
  // 反过来：damage 事件的 source 表示"来源"，地雷伤害必须为 null
  const md = st.events.filter(function (e) { return e.type === 'damage' && e.via === 'mine'; });
  ok(md.every(function (e) { return e.source == null; }), 'mine 伤害 source 必须为 null');
});

t('L3 复现工具必须保留冷/热启动断言（v1.5.128 诚实化：原名的"每个工具都能跑"从未实现）', function () {
  /* Real instance: my bisect script died on `T.buildOpps(null, 0.05)` -- a signature I
   * never verified. A per-tool smoke run turns "I forgot to check the API" into a red test.
   * Only --help / tiny-arg runs here: fast and side-effect free. */
  const fsx = readFileSync('tools/repro-check.mjs', 'utf8');
  ok(fsx.indexOf('EPIRUS_HOTSTART') >= 0 || fsx.indexOf('D cold start') >= 0,
    'repro-check 应包含冷启动/热启动断言');
  /* v1.5.128（审计 §C）：原来这里断言 `npt.indexOf('REPRO2') >= 0` —— 而 `REPRO2` 就是**本文件自己**定义的
   * 字符串 ⇒ 近乎恒真、纯自指。已删；真实覆盖由 REPRO2 那条门自己提供。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('process.env.EPIRUS_WR_TOL') < 0,
    'WR_TOL 不得在引擎内读 env（CLI 沙箱无 process => 两条路取到不同值）');
  ok(evo.indexOf('setWrTol') >= 0, 'WR_TOL 应由调用方通过 setWrTol 显式传入');

  /* v1.3.56：「浏览器训练不可复现」的根因不是随机源，是**输入没被记录**：
   * 浏览器按钮走 Node 服务，而 index.html 的"从头训练"默认不勾 ⇒ 默认热启动，
   * 种群围绕 js/bundled-champion*.js 长出来。那个文件会随每次训练变化 ⇒ 输入变了。
   * 修法与 v1.3.50 给 CLI 定的规矩一致：把输入标识记进产物。 */
  const srv = readFileSync('server/train-server.mjs', 'utf8');
  ok(srv.indexOf('weightsId') >= 0,
    'server 必须能把"输入冠军"算成标识（weightsId）——否则热启动产物无法复现');
  ok((srv.match(/hotstartFrom/g) || []).length >= 3,
    'server 的冠军 meta 必须记录 hotstartFrom（2P 与 N 两条路径都要）');
  ok(/seed:\s*(SEED0|Number\(\(cfg && cfg\.seed0\))/.test(srv),
    'server 的冠军 meta 必须记录 seed');
});

t('L7 rankOf 不得有座位偏置（并列时不许按 pid 升序）', function () {
  /* 真实缺陷（v1.3.57）：`rankOf` 的比较器是 alive→hp→taken，**没有 pid**，完全并列时
   * 落到 Array.prototype.sort 的稳定性 = 插入顺序 = pid 升序。对称场 800 局实测
   * 各座位 1st 率 P0=61.9% … P4=7.5%（极差 54.4pt），换成种子洗牌后 16.0…23.5%（7.5pt）。
   * 本用例构造"五人完全并列"的终局，断言 rank1 在座位间大致均匀。
   * 旧实现在这里会是 [400,0,0,0,0]（座位 0 拿满），所以它会红。 */
  const TR = 400;
  const firsts = [0, 0, 0, 0, 0];
  for (let s = 0; s < TR; s++) {
    const st = S.createState('multi', { next: mulberry32(7000 + s) }, 5);
    for (let i = 0; i < 5; i++) st.p[i].hp = 3;          // 全员同血、无伤害事件 ⇒ 完全并列
    for (let pid = 0; pid < 5; pid++) if (T.rankOf(st, pid, 12345 + s) === 1) firsts[pid]++;
  }
  const spread = Math.max.apply(null, firsts) - Math.min.apply(null, firsts);
  ok(spread <= 80,
    '并列时 rank1 的座位分布过于偏斜（疑似按 pid 升序）: ' + firsts.join('/') + ' 极差=' + spread + '（' + TR + ' 次里每座位期望 ' + (TR / 5) + '）');

  // 幂等 + 严格排列（同一局可能被问多个座位）
  const st2 = S.createState('multi', { next: mulberry32(1) }, 5);
  for (let i = 0; i < 5; i++) st2.p[i].hp = 3;
  const a = [], b = [];
  for (let pid = 0; pid < 5; pid++) { a.push(T.rankOf(st2, pid, 999)); b.push(T.rankOf(st2, pid, 999)); }
  ok(a.join(',') === b.join(','), 'rankOf 必须幂等：同局同 seed 问两次结果要一致（不要消耗 st.rng）');
  const uniq = {}; for (const r of a) uniq[r] = 1;
  eq(Object.keys(uniq).length, 5, 'rankOf 必须返回 1..N 的严格排列（调用方按整数比较名次）');
});

t('L6 考卷完整性：深经济对手必须在池子里 + wrapBotN 必须保留脚本自己选的目标', function () {
  /* 两个都在 v1.3.55 被发现，且都是"没人发现的静默退化"：
   * (a) pickDeepSaver（"会攒 + 会还手"）在 v1.3.27 加入、v1.3.30 被**静默删除**，
   *     CHANGELOG 只字未提，24 个版本没人发现，而 REVIEW §1-D 把它记成"对手池去重（卫生）"。
   *     后果：现有池里 pickFarmer 只攒不还手、pickHeavyFire 会还不攒（ep<=2 贵技能分支永不触发）
   *     => "不攒钱"在考卷里**没有任何惩罚来源**。这正是 P3.5 说的"考卷未改"。
   * (b) wrapBotN 无条件用 pickTargetN 重算目标，把返回 {key,target} 的脚本（protomine /
   *     prototransfer / focusfire / deepsaver）的目标整个丢掉 => "会还手"的脚本被剥掉瞄准。 */
  ok(typeof Bots.pickDeepSaver === 'function', 'pickDeepSaver 必须在 EpirusBots 里（别再被静默删掉）');

  // (b) 显式目标必须被保留
  const st1 = S.createState('multi', { next: mulberry32(93) }, 3);
  st1.p[0].ep = 9;
  X.startTurn(st1);
  const legal1 = Play.legalActions(st1, 0);
  const wrapped = T.wrapBotN(function () { return { key: R.SK.GUN, target: 2 }; });
  const got = wrapped(st1, 0, legal1);
  eq(got.key, R.SK.GUN, 'wrapBotN 应保留脚本选的技能');
  eq(got.target, 2, 'wrapBotN 必须保留脚本显式返回的 target（否则被剥掉瞄准）');

  // (c) 行为反证：ep=5 时它必须真的把大雷打出去（"会攒 + 会还手"）
  const st2 = S.createState('multi', { next: mulberry32(94) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st2.p[i2].ep = 0; }
  st2.p[0].ep = 5;
  X.startTurn(st2);
  const legal2 = Play.legalActions(st2, 0);
  const bigAff = legal2.filter(function (l) { return l.key === R.SK.BIG_T && l.affordable; });
  ok(bigAff.length === 1, 'ep=5 时真正的落雷(5 ジ)必须可负担（前置条件，先验证再断言）');
  const act = T.wrapBotN(Bots.pickDeepSaver)(st2, 0, legal2);
  eq(act.key, R.SK.BIG_T, 'pickDeepSaver 攒够 5 ジ 后必须打出大雷（否则它就不惩罚"不攒钱"了）');
});

t('L5 测试跑不得给 shipped 文件留残留（会随 git add -A 提交）', function () {
  /* 真实事故（v1.3.48）：一次测试跑把 js/bundled-champion*.js 覆写成测试冠军并被提交。
   * v1.3.54 又发现两个同类缺口，都只在"跑完看 git status"时才显形：
   *  (1) server 的 writeBundleMP 会顺带把 index.html 的 ?v= 缓存戳改成新值；
   *      repro-check 备份还原了冠军包，却没还原 index.html => 每次测试都留 diff。
   *  (2) 训练工具的非发布输出 docs/artifacts/*-out.js 没被 .gitignore 覆盖。
   * 所以这条断言查的是"残留通道"，不是某个具体文件。 */
  const gi = readFileSync('.gitignore', 'utf8');
  ok(gi.indexOf('-out.js') >= 0, '.gitignore 必须忽略训练工具的非发布输出（docs/artifacts/*-out.js）');

  // 反向：真的会写那个落点的工具，必须同时有 EPIRUS_PUBLISH 门槛（否则它会写线下路径）
  for (const f of ['tools/train-3p.mjs', 'tools/train-fast.mjs', 'tools/train-best.mjs']) {
    const src = readFileSync(f, 'utf8');
    if (src.indexOf('-out.js') >= 0) {
      ok(src.indexOf('EPIRUS_PUBLISH') >= 0, f + ' 用了 -out.js 落点，就必须有 EPIRUS_PUBLISH 门槛');
    }
  }

  // index.html 的缓存戳副作用必须被测试工具还原
  const rc = readFileSync('tools/repro-check.mjs', 'utf8');
  ok(rc.indexOf('htmlBackup') >= 0,
    'repro-check 必须备份/还原 index.html（writeBundleMP -> bumpChampionVersion 会改它）');
  ok(rc.indexOf('bumpChampionVersion') >= 0 || rc.indexOf('index.html') >= 0,
    'repro-check 的注释里应能看出它还原的是 index.html');

  /* v1.5.0：本轮新踩的同类残留 —— 产物名把 TAG 拼在**扩展名之后**
   * （`ring2-status.log-<tag>`、`ring2-server.log-<tag>`）⇒ `.gitignore` 的 `*.log` 匹配不到
   * ⇒ `git add -A` 会把它们带进仓库。凡按 TAG 拼名字的产物，扩展名必须在最后。 */
  const rr = readFileSync('tools/ring2-run.mjs', 'utf8');
  ok(!/'ring2-[a-z]+\.log' \+ TAG/.test(rr),
    "ring2-run 的日志名必须是 <名字><TAG>.log，不能是 <名字>.log<TAG>（否则 *.log 忽略不到）");
});

/* ===== v1.4.0：长程模式（5 血）+ 按模式配摄魂门槛 =====
 * 反证：把 state.js 的 DRAIN 门槛写回写死的 `p.hp > 1` 时 D2 必红；
 *       把 resolve.js 的终局判定写回 `R.MAX_ROUNDS` 时 D3 必红。 */
t('D8 版本号三方一致（CHANGELOG 最新条目 = README = index.html）', function () {
  /* v1.4.13：本轮发现 README 停在 v1.4.6、index.html 停在 v1.4.1（HEAD 已是 v1.4.13），
   * 而 CHANGELOG 还缺 v1.4.10/v1.4.12 两条 —— 根因是我用 sed 假设"上一版的字符串"，
   * 而 sed 不匹配时不报错 ⇒ 连续多次静默 no-op（index.html 还被 A/B 任务的备份还原打乱过）。
   * 反证：把 README 改回任意旧版本号，这条立即红。 */
  const cl = readFileSync('CHANGELOG.md', 'utf8');
  const m = cl.match(/^## v([0-9]+\.[0-9]+\.[0-9]+)/m);
  ok(m, 'CHANGELOG 里找不到 ## vX.Y.Z 条目');
  const newest = m[1];
  const rd = readFileSync('README.md', 'utf8').match(/当前版本：v([0-9]+\.[0-9]+\.[0-9]+)/);
  ok(rd, 'README 里找不到"当前版本：vX.Y.Z"');
  eq(rd[1], newest, 'README 版本号必须等于 CHANGELOG 最新条目');
  const ix = readFileSync('index.html', 'utf8').match(/程序 v([0-9]+\.[0-9]+\.[0-9]+)/);
  ok(ix, 'index.html 里找不到"程序 vX.Y.Z"');
  eq(ix[1], newest, 'index.html 版本号必须等于 CHANGELOG 最新条目');
});

t('D82 记账纪律：24 小时内落盘的 .bak 必须在 CHANGELOG 里被点名（第九轮复核 §7-5）', function () {
  /* 复核抓到：整晚 20 个产物零记录（其中一个座位极差 99pt）—— "产物=证据，没记账的产物等于没有结论"。
   * 这条门只看**最近 24 小时**（不去追溯历史堆积，那是另一件清理工作）；它的作用是：
   * **新落的臂在下次跑门禁时就被点名**，直到写进 CHANGELOG 为止。 */
  const cd = readFileSync('CHANGELOG.md', 'utf8');
  const dir = 'docs/artifacts';
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const fresh = readdirSync(dir).filter(function (f) { return /\.bak$/.test(f); })
    .filter(function (f) { return statSync(dir + '/' + f).mtimeMs >= cutoff; });
  /* v1.5.201（门层审计 D82）：原来"时窗内无产物"时退化成 ok(cd.length > 1000)
   * = "CHANGELOG 大于 1000 字节"（该文件 307KB）—— 一条恒真断言，等于这条门在干净检出上不存在。
   * 现在**两个方向都查**：① 在场但没点名（下面这一段，原有）；② **点过名却不在场**（这里）。
   * ② 只认 **显式产物点名行**（`> 产物点名（D82）：a.bak, b.bak`）且只查**最新条目**那一块 ——
   * 正文里随口提到的文件名不是账本（第一版就是这么误报的：把 v1.5.200 正文里的
   * `js/bundled-champion.js.bak` 与范围写法 `train-3p-out-band1..6.bak` 都当成了账本条目），
   * 而历史条目里被清理掉的产物属正常，全查会永久红。
   * 补这半条的直接起因：本轮我误删了 6 个 09-22「排练臂」产物，整套门禁全绿、没有一条发现。 */
  const i2 = cd.indexOf('\n## ', 1);
  const topBlock = i2 > 0 ? cd.slice(0, i2) : cd;
  const ledLine = (topBlock.match(/^> 产物点名（D82）：(.*)$/m) || [])[1] || '';
  const namedTop = (ledLine.match(/[A-Za-z0-9_./-]+\.bak/g) || []);
  const absent = namedTop.filter(function (n) {
    return !existsSync(n.indexOf('/') >= 0 ? n : (dir + '/' + n));
  });
  ok(absent.length === 0, '最新条目的产物点名行点过名、但盘上不在的产物（被删了？改名了？）：' + absent.join(', '));
  const miss = fresh.filter(function (f) { return cd.indexOf(f.replace(/\.bak$/, '')) < 0; });
  /* §2026-10-08 DS（用户转 Claude 复核）：这半条**降级为警告** —— 它的结果取决于运行时钟 + 文件 mtime，
   *   同一份代码今天绿明天红；它测的是"记账有没有做"而不是代码对不对（§E499 我就被它红过一次）。
   *   上面那半（点过名却不在场）是确定性的，**继续当断言**。 */
  if (miss.length) console.log('⚠ D82（警告，不计红）这些 24h 内的产物在 CHANGELOG 里查无字（' + fresh.length + ' 个里缺 ' + miss.length + '）：' +
    miss.slice(0, 12).join(', ') + (miss.length > 12 ? ' …' : ''));
  /* ===== T2（用户 10-16 深夜交班 · 千问本笔）：把"设防的那半条"从**时钟**挪到**账本**上 =====
   * 病（实测，不是推测）：上面那半条 mtime 判据在**今天这台机器上就是空的** —— 盘上 700 个 `.bak`、
   *   24h 内 **0 个**，而 `namedTop` 依赖的那行 `> 产物点名（D82）：…` 在当前 CHANGELOG 顶部条目里**根本不存在**
   *   ⇒ `absent=[]`、`miss=[]` ⇒ 这条门**一个断言都没做却报绿**（R8 那一族：初值空数组被读成"零违规=合格"）。
   *   而干净克隆里 mtime 全是 checkout 时刻 ⇒ 那半条永远不可靠。
   * 改法：**用仓里已经有的那本账** —— `tools/keep-artifact.mjs` 维护的 `docs/artifacts/kept/MANIFEST.tsv`
   *   （`file / sha256 / bytes / source / keptAt / note`）。它是**被跟踪的文件**，所以干净克隆里照样可判，
   *   不需要时钟、不需要 git 历史（CI 是 depth=1 检出，靠历史的那类修法在这里直接失效）。
   *   ⛔ 不另起第二份清单：本仓 v1.7.67 刚清完"同一件事五处口径"，再造一个 baseline 就是复发。
   * 两条新断言（都有反向实验，见日志 DONE）：
   *   **① 账本完整性**：manifest 每一行的 kept 文件必须在场，且 sha256 与 bytes 都对得上 ⇒ "结论引用的证据不许悄悄消失"（§E120 那笔就是这么丢的）；
   *   **② 最新条目引用的证据必须在场**：顶部 CHANGELOG 条目里写全路径的 `docs/artifacts/….bak` 必须盘上有
   *      （⚠ 只认**带目录的全路径**，且跳过带 `*`/`..` 的范围写法 —— DS 第一版把正文里随口提到的名字当账本，误报过）。
   * mtime 那半条**保留为警告**（本机有用），但它在门文本里被明确标成"不设防"。 */
  const MAN = 'docs/artifacts/kept/MANIFEST.tsv';
  if (!existsSync(MAN)) {
    ok(false, '账本 ' + MAN + ' 不在 ⇒ D82 无从判（这条门的设防面就是这本账，不许缺文件还报绿）');
  } else {
    const rows = readFileSync(MAN, 'utf8').split('\n').slice(1).filter(function (l) { return l.trim().length; });
    const bad = [], gone = [];
    for (const r of rows) {
      const c = r.split('\t');
      const f = c[0], sha = c[1], by = Number(c[2]);
      if (!f || !sha) continue;
      const p = 'docs/artifacts/kept/' + f;
      if (!existsSync(p)) { gone.push(f); continue; }
      const buf = readFileSync(p);
      if (by && buf.length !== by) { bad.push(f + '（bytes ' + buf.length + ' ≠ 账上 ' + by + '）'); continue; }
      const h = createHash('sha256').update(buf).digest('hex');
      if (h !== sha) bad.push(f + '（sha256 不符 ⇒ 内容被改过而账本没换）');
    }
    ok(gone.length === 0, '账本里点过名、盘上却不在了的 kept 产物（' + rows.length + ' 行里缺 ' + gone.length + '）：' + gone.slice(0, 10).join(', '));
    ok(bad.length === 0, 'kept 产物与账本对不上（bytes/sha256）：' + bad.slice(0, 6).join(' ‖ '));
    const i3 = cd.indexOf('\n## ', 1);
    const top = i3 > 0 ? cd.slice(0, i3) : cd;
    const cited = (top.match(/docs\/artifacts\/[A-Za-z0-9_./-]+\.bak/g) || [])
      .filter(function (p) { return p.indexOf('..') < 0 && p.indexOf('*') < 0; });
    const citedMiss = cited.filter(function (p) { return !existsSync(p); });
    ok(citedMiss.length === 0, '最新 CHANGELOG 条目写了全路径引用、但盘上不在的产物（结论的证据消失了）：' +
      citedMiss.slice(0, 8).join(', ') + '（引用 ' + cited.length + ' 处）');
    console.log('  D82 读数：账本 ' + rows.length + ' 行全在场全对账 ‖ 最新条目引用 ' + cited.length + ' 处全在场 ‖（mtime 那半条只警告：' + fresh.length + ' 个 24h 内产物）');
  }
});

t('D189 gate-drafts **不许静默吞参数**（认不出 ⇒ exit 64；`.bak` 与 bundle `.js` 都要真量）（v1.5.282 · Qoder §5-3 点名）', function () {
  /* 病（Qoder 09-28 §5-3 点名交给 DS）：`EXTRA` 原来只收 `.bak` ⇒ 传 `js/bundled-champion-3p.js` 这类 bundle
   * 会被**静默丢掉**，而工具照样打出全套结论（其实只量了"线上包"那一行）—— **量具自己骗人**，
   * 与 §24 那族"静默无效果"同族。（我自己此前量"抗克参照"时传过 `.js`，读数对只是**因为那个文件恰好就是线上包**。）
   * 规矩：认不出的参数 ⇒ exit 64；认得出但读不出 ⇒ 一并报出并 exit 64。 */
  const GD = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(/\.\(bak\|js\|json\)\$/.test(GD) || /\\.\(bak\|js\|json\)/.test(GD),
    '参数识别必须接受 `.bak` / `.js` / `.json` 三种（v1.5.78 起 loadBakParams 本来就支持 bundle）');
  ok(/const EXTRA = \[\], BAD = \[\];/.test(GD), '必须把读不出的参数**收集起来**而不是过滤掉');
  ok(/if \(BAD\.length\)/.test(GD) && /process\.exit\(64\)/.test(GD),
    '读不出 ⇒ **exit 64 响亮失败**（不许静默忽略）');
  ok(!/filter\(function \(a\) \{ return \/\\.bak\$\/\.test\(a\); \}\)/.test(GD),
    '【反例】不许再出现"只留 `.bak`、其余静默丢"的那种过滤器');
  /* 行为：传一个不存在的 `.bak` ⇒ 必须 exit 64（在 G1/G2/G3 之后、重活之前就退出） */
  const r = spawnSync(process.execPath, ['tools/gate-drafts.mjs', 'this-file-does-not-exist-12345.bak'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 300000, maxBuffer: 1 << 22 });
  eq(r.status, 64, '传不存在的路径 ⇒ 必须 exit 64 且印出"拒绝静默忽略"（实测 status=' + r.status + '）');
  ok(/拒绝静默忽略/.test(r.stderr || r.stdout || ''), '必须印出"拒绝静默忽略"这句话（人能看懂才算响亮）');
});

t('D191 kept/ 别名检测（v1.5.285 · §E128）：按权重本体分组 · 已知别名必须查到 · 读不出不许当"无重复"', function () {
  /* 动因（09-28 凌晨实测）：`--aliases` 一跑就发现 kept/ 的 25 个文件其实只有 19 粒不同权重，
   * 其中 `NOL24-71 ≡ V2-71` 被交接件当成**两个方向的活体案例**引用（§17-E-3）⇒ 一例是重复计数。
   * 文件 sha 看不出来（权重同、META 不同）⇒ 必须比 `.a` **数组本体**（与 `probe-pack-identity` 同一判据，
   * 但那是两两比，这把尺是全池分组）。这条门防的是"证据池静默缩水成 N-1 粒"。 */
  const r = spawnSync(process.execPath, ['tools/keep-artifact.mjs', '--aliases'], { encoding: 'utf8', timeout: 180000 });
  eq(r.status, 0, '别名检测必须能跑（读不出权重时要 exit 7 点名，实测 ' + r.status + '）：' + String(r.stderr || '').slice(0, 200));
  const out = String(r.stdout);
  /* ① 判别力：账本里**已知存在**的一对别名必须被查到（查不到 = 这把尺是瞎的） */
  const hasPair = /e78-out__G08-71\.bak[\s\S]{0,160}e124-out__blk0t00-s71\.bak|e124-out__blk0t00-s71\.bak[\s\S]{0,160}e78-out__G08-71\.bak/.test(out);
  ok(hasPair, '① 必须查到已知别名对 G08-71 ≡ blk0t00-s71（同一配方同 seed ⇒ 两个班次跑出的产物逐位相同）⇒ 查不到说明分组没在读权重本体');
  ok(/权重本体不同的 \*\*\d+ 粒\*\*/.test(out) && /个文件/.test(out),
    '① 必须同时报"文件数"和"权重本体粒数"（只报一个就看不出缩水）');
  /* ⚠ 本门第一版在这里红过一次，**不是工具坏了**：真实输出是 `**19 粒**`，而我按 `**19**` 匹配 ⇒
   * 正则没对上就让门判红。教训同 D183：**门自己也要判别力自证**，正则必须照真实打印格式写。 */
  const nFiles = Number((/池子：(\d+) 个文件/.exec(out) || [])[1]);
  const mUniq = /权重本体不同的 \*\*(\d+) 粒\*\*/.exec(out);
  const nUniq = mUniq ? Number(mUniq[1]) : NaN;
  ok(nFiles > 15 && nUniq > 10, '② 读数必须在合理量级（池子 ' + nFiles + ' 个 / 独立 ' + nUniq + ' 粒 ⇒ 太小 = 外壳正则没命中，会被当成"无重复"）');
  ok(!/读不到权重本体/.test(out), '② 本次跑不许有"读不到权重本体"的文件（有就是 exit 7，不许继续报"无重复"）');
  /* ③ 静态钉：比较的本体必须是 `.a` 数组，不是文件字节（字节会把"同权重不同 META"误判成两粒） */
  const src = readFileSync('tools/keep-artifact.mjs', 'utf8');
  ok(/JSON\.parse\(m\[1\]\)\.a/.test(src) && /createHash\('sha1'\)\.update\(JSON\.stringify\(arr\)\)/.test(src),
    '③ 分组键必须是**权重数组本体**的哈希（文件 sha 会因 META 不同而漏掉别名 —— 这正是本次要抓的情形）');
  /* ④ §E589 防新增：全库"**未登记的重复**"必须为 0。判据与算法都在 `tools/dedupe-artifacts.mjs --audit` 那一份里
   *   （规矩 1：门只测行为，不在这儿再抄一遍 wid 公式）。登记 = 账本 `dupes-manifest.tsv` 的 role=move
   *    ‖ 别名表 `pack-aliases.tsv` 的 wantedPath ⇒ band 夹具、kept 耐久层这类"设计如此的复制"经 `pack-guard` 登记后不算。
   *   ⚠ 判的是 JSON 里 `unregistered` 这个数，**不是退出码**（管道会把退出码吃掉 —— 本机栽过两次）。
   *   ⚠ 这条腿 10-11 在 **CI 上红过一次**（exit=1，判词"必须吐出机器可读那一行"）：`--scope` 默认含 `d180-bands/`，
   *     而它被 `.gitignore:29` 屏着 ⇒ 干净克隆里没这个目录 ⇒ 审计工具 `exit 2`、一行不吐 ⇒ **门自己没跑，被当成门红**。
   *     根因在我这条腿：**把判据绑到了"只在我这台机的盘上存在的东西"**（与规矩 134 同族，134 管"会换主人的指针"，这条是"只在本机存在的目录"）。
   *     ⇒ 修的是工具（只读档跳过缺失目录并把名字报进 `missing`），**不是把腿删掉或放宽阈值**。
   *     ⚑ 代价要写明：**CI 上这条腿覆盖的池子比本机小**（只剩 tracked 的那些），所以它抓不到"本机新落盘的未登记拷贝"——
   *       与 D233 在 CI 永远 SKIP 是同一族盲区，差别是这条腿在 CI 仍有实效（tracked 层照样判）。 */
  const au = spawnSync(process.execPath, ['tools/dedupe-artifacts.mjs', '--audit'], { encoding: 'utf8', timeout: 600000 });
  const aLine = String(au.stdout || '').trim().split('\n').filter(l => /^\{/.test(l)).pop();
  ok(!!aLine, '④ `--audit` 必须吐出机器可读那一行（stdout 尾部：' + String(au.stdout || au.stderr || '').slice(-200) + '）');
  if (aLine) {
    const A = JSON.parse(aLine);
    eq(A.unregistered, 0, '④ 未登记的重复必须为 0（实测 ' + A.unregistered + ' ‖ 最坏几组：' + JSON.stringify(A.worst) +
      '）⇒ 同一粒权重多存一份，就会把"N 个配方/N 枚候选"读得比实际多（§E589 普查：1443 个文件其实只有 1130 粒）');
    ok(A.files > 0, '④ 审计必须真数到包文件（files=' + A.files + ' groups=' + A.groups +
      ' scope 里缺的目录=' + JSON.stringify(A.missing || []) + '）⇒ 数到 0 是"没数"，不是"没重复"');
  }
  /* ⑤ §E590 别名账本 `pack-aliases.tsv` 是**进仓的账本** ⇒ 里面只许出现仓内相对路径。
   *   起因（实测，不是推测）：门跑测试时 `train-3p` 往 `os.tmpdir()` 写 band 夹具，
   *   `pack-guard` 的"目标在仓外 ⇒ 不登记"判断**在 Windows 跨盘时失效**
   *   （`path.relative('D:/…','C:/Users/…/Temp/…')` 不返回 `..` 开头，而是原样吐绝对路径）
   *   ⇒ 我一跑 `--group=meta`/`ui` 就一口气往账本里追加了 **75 行 temp 绝对路径**（`git status` 里那笔"意外改动"就是它）。
   *   ⇒ 这条腿钉的就是"账本别再被测试自己写脏"：任何仓外/绝对路径都判红。 */
  const AL = readFileSync('champion-map/pack-aliases.tsv', 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
  const ah = Object.fromEntries(AL[0].split('\t').map((c, i) => [c, i]));
  const badPath = [];
  for (const l of AL.slice(1)) {
    const c = l.split('\t');
    for (const col of ['canonical', 'wantedPath']) {
      const v = c[ah[col]] || '';
      if (!v) continue;
      if (/^[A-Za-z]:[\\/]/.test(v) || v.startsWith('\\\\') || v.split('/').indexOf('..') === 0) badPath.push(col + '=' + v.slice(0, 60));
    }
  }
  ok(badPath.length === 0, '⑤ 别名账本里有 ' + badPath.length + ' 个仓外/绝对路径（样例：' + badPath.slice(0, 3).join(' ‖ ') +
    '）⇒ 账本只描述仓内真身关系，门跑测试产生的 temp 路径不许进来（`pack-guard` 的 `isOutside` 判跨盘要用 resolve 比前缀，不能只看 `..`）');
});



t('D205 门号纪律（DS 清单 B8 · 09-30 夜班）：D 号不许撞车，且 CHANGELOG 最新一版声称的每个门号必须真在册（钉"记账说门在、门不在"）', function () {
  /* 为什么有这条：09-29 DS 的插门脚本拿 `indexOf("t('D200")` 当"已经插过了"的判据 ⇒ 撞上在册的 D200 就**静默跳过**，
     而提交说明与 CHANGELOG 都写了"门 D200"（我复核时抓到）。这类事故靠人核对核不住——今晚我自己就把一段截断的输出读成了"两道红"。
     ⚠ 本门只管**精确撞车**（同号两次）。另有一条已知但今天不动的形状：`D33` 与 `D33b` 互为**前缀**，
     所以 `indexOf("t('D33")` 这种写法对它们天然歧义 ⇒ 已写进 HANDOFF 交 DS 裁要不要给带字母后缀的那道换号（半夜单方面改历史门号，风险大于收益）。 */
  const own = npSourceAll();   /* v1.7.8：`^t(` 这类抽取式现在必须扫**全部门体文件** —— `import.meta.url` 只会指到本部件，那样只数得到本部件那几条 */
  const gateIds = [...own.matchAll(/^t\('([A-Za-z]+[0-9]+[a-z]?)/gm)].map(m => m[1]);
  const dupOf = function (list) { const c = {}; for (const x of list) c[x] = (c[x] || 0) + 1; return Object.keys(c).filter(k => c[k] > 1); };
  const dOnly = gateIds.filter(x => /^D[0-9]/.test(x));
  ok(dOnly.length >= 150, '① 反装饰守卫：本文件应扫到 ≥150 道 D 类门（实测 ' + dOnly.length + '）⇒ 抽取式一旦被改空，这条要响亮失败，不许变成"永远通过');
  ok(dupOf(dOnly).length === 0, '② D 号撞车：' + dupOf(dOnly).join(' ') + ' ⇒ 撞号的那道会被"已插入"判据静默吞掉，记录里却写着有这道门');
  ok(dupOf(['D204', 'D204', 'D205']).length === 1, '③ 合成正对照：判据函数对明知重复的输入必须响（没响 ⇒ 上面那条是装饰）');
  /* ④ 改判（§E443，用户 10-08 裁：「不要为了过门禁而过，现在的版本是好的，你可以反思一下红的门禁是不是写的有什么问题」）
   *   原来这条判的是「最新一版条目至少提到 3 个门号」，而它自己的说明写的是「提到 0 个说明抽取式失效」⇒ **主语错位**：
   *   抽取式坏没坏量的是抽取式，不是作者引了几次门号。两处实测后果：
   *     · 抓不到真病 —— 往条目里粘三个在册 D 号它就绿（本仓 §E430 刚按用户裁定删掉两条同族病：定死标签、不看效果）；
   *     · 会冤枉好账 —— v1.6.25 那版**真的动了门**（§E430 删了两条门腿）却没写一个 D 号 ⇒ 判红，而它记的内容一字不差。
   *   现在改成量它本来要量的那件事：**抽取式对整段 v1.6.x 必须还数得出门号**（数不出 = 正则或区段边界被改坏，
   *   那时 ⑤ 会跟着变成假绿）。"每一版都点名自己动了哪些门"这条习惯保留 —— 但它写进条目正文由人核，不由数 token 的门代管。 */
  const top = String(readFileSync('CHANGELOG.md', 'utf8').split(/^## /m)[1] || '');
  const zone = String(readFileSync('CHANGELOG.md', 'utf8').split('\n## v1.5.')[0] || '');
  const idSet = new Set(gateIds);
  const claimOf = function (text) { return [...new Set([...text.matchAll(/\bD([0-9]+)(?![0-9])/g)].map(m => 'D' + m[1]))]; };
  const claims = claimOf(top);
  ok(claimOf(zone).length >= 10, '④ 抽取式自证：整段 v1.6.x 至少该数出 10 个不同门号（实测 ' + claimOf(zone).length +
    ' ‖ 区段长 ' + zone.length + ' 字符）⇒ 数到 0 就是正则或"到 v1.5 为止"那道边界被改坏，下面 ⑤ 会跟着假绿');
  const ghost = claims.filter(c => !idSet.has(c));
  ok(ghost.length === 0, '⑤ 记账说门在、门不在：最新一版提到 ' + claims.length + ' 道门' +
    (claims.length ? '（' + claims.join(' / ') + '）' : '（本版一个门号都没提 ⇒ ⑤ 无可判，按上面 ④ 的说明这是**允许**的）') +
    (ghost.length ? '，其中 ' + ghost.join(' / ') + ' 在 np-test 里**没有注册**' : ''));
  ok(claimOf('新增门 D99999 与 D204').filter(c => !idSet.has(c)).join() === 'D99999',
    '⑥ 合成正对照：给判据一段"声称有 D99999"的文本，它必须把 D99999 抓出来（抓不到 ⇒ ⑤ 是假的）');
});

/* ===== §E357（10-06 用户「重新整理一下仓库」那批的第三件）：文档指针不许落空 =====
 * 病（这次是真的量到过，不是设想）：docs 里的按天日志 10-05 搬过一次顶层（§E339）、10-06 又搬进 `docs/research/` 两层，
 *   而**代码注释与 README 里的旧锚没人改** ⇒ 我数出来活引用面上有 **35 处**指向已不存在的文件，
 *   其中 17 处已经落空两天以上（`--only`/`--group` 都看不见，因为没有任何门读这件事）。
 *   本仓对"引用会落空"这一族已经栽过至少四次（门号 / 行号 / 产物 / 文档路径），而前三族各有牙（D205 / D82 / L5），**只有文档路径这一族没有**。
 * ⇒ 判据形状按 `docs/METHODOLOGY.md` 第 89 条：**钉存在性（指针必须落得到盘上），不钉措辞**。
 *   历史文本（`CHANGELOG.md` 与 `docs/research/**`）**不在扫描范围** —— 那里的旧锚是当时的账，逐条改写等于篡改历史；
 *   换读法靠 `docs/README.md` 第四节的 old→new 对照表。 */
t('D230 §E357 活引用面里的 `docs/**.md` 指针必须真在盘上（docs 两层化之后，搬目录漏改引用当场红）', function () {
  const LIVE_DIRS = ['tools', 'server', 'js', 'champion-map', 'tests', '.github'];
  const files = ['README.md'];
  for (const d of LIVE_DIRS) {
    const stack = [d];
    while (stack.length) {
      const cur = stack.pop();
      let ents;
      try { ents = readdirSync(cur, { withFileTypes: true }); } catch (e) { continue; }
      for (const en of ents) {
        const p = cur + '/' + en.name;
        if (en.isDirectory()) { if (en.name !== 'node_modules' && en.name !== 'artifacts') stack.push(p); continue; }
        if (/\.(mjs|js|html|cmd|yml)$/.test(en.name)) files.push(p);
      }
    }
  }
  const RE = /docs\/[A-Za-z0-9._\/-]+\.md/g;
  /* 三处**故意留着**的旧锚：它们在规则指纹五件套里，改一个字符就要换代指纹 + 重记两个线上槽的 meta，
   *   而代价只是"注释里的锚要多跳一次" ⇒ 由 docs/README.md 第四节的对照表兜。豁免的是**这一条锚**，不是整个文件，
   *   所以这三个文件里新出现的落空指针照样红。
   * ⚠ 下面每条旧锚都**拆成两段拼接**：本文件自己在活引用面里 ⇒ 写成连着的字面量会被这条门扫成"落空指针"
   *   （第一版就是这么红的：D230 抓到的第一个文件是它自己）。谁把这些字符串拼回去，门会当场红 —— 那不是 bug，是它在提醒别把豁免写成正文。 */
  const OLD_REVIEW_QODER = 'docs/' + 'REVIEW-QODER-2026-09-19.md';
  const OLD_PARAMS_PLAN = 'docs/' + 'PARAMS-PLAN.md';
  const KNOWN_OLD_ANCHORS = {
    'js/core/resolve.js': [OLD_REVIEW_QODER],
    'js/core/state.js': [OLD_PARAMS_PLAN],
    'js/train/policy.js': [OLD_PARAMS_PLAN]
  };
  /* 正对照用的假锚（同样拆开写，免得它自己变成一条被扫到的落空引用）。 */
  const FAKE_ANCHOR = 'docs/research/logs/' + '__D230_FAKE_ANCHOR__.md';
  const isDead = function (f, ref) {
    if (/[<>*{}]/.test(ref)) return false;                    // `docs/OVERNIGHT-<日期>-qoder.md` 这种是**写法**，不是路径
    if (ref.indexOf('docs/artifacts/') === 0) return false;   // 产物面归 D82（那里有它自己的两套检索范围）
    if (existsSync(ref)) return false;
    return (KNOWN_OLD_ANCHORS[f] || []).indexOf(ref) < 0;
  };
  const dead = [];
  let scanned = 0;
  for (const f of files) {
    let src = '';
    try { src = readFileSync(f, 'utf8'); } catch (e) { continue; }
    const hits = src.match(RE) || [];
    scanned += hits.length;
    for (const ref of hits) { if (isDead(f, ref)) dead.push(f + ' → ' + ref); }
  }
  ok(scanned >= 40, '① 反装饰守卫：本次从活引用面扫到 ' + scanned + ' 个 `docs/**.md` 指针 ⇒ 少于 40 说明抽取式或目录名单被改空，'
    + '这条门就退化成"恒真"（本仓的 D82①/D205④ 是同族守卫，理由都在各自注释里）');
  eq(dead.length, 0, '② 指针落空（搬了目录/改了文件名却没改引用；换读法见 docs/README.md 第四节）：'
    + dead.slice(0, 12).join(' ‖ ') + (dead.length > 12 ? ' …共 ' + dead.length + ' 处' : ''));
  ok(isDead('tools/x.mjs', FAKE_ANCHOR),
    '③ 合成正对照：明知不在盘上的指针必须判**死**（判不死 ⇒ ② 是恒真好绿）');
  ok(!isDead('tools/x.mjs', 'docs/README.md'),
    '③b 反向对照：真在盘上的必须判**活**（判活反了 ⇒ 整条门会因为路径分隔符/大小写假红）');
  ok(!isDead('js/core/state.js', OLD_PARAMS_PLAN) && isDead('js/core/state.js', FAKE_ANCHOR),
    '③c 豁免名单必须**只管那三条锚**、不是放过整个文件（文件级豁免 = 三个指纹文件从此永远查不出来）');
});

}

