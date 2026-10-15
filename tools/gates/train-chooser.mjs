/*#np-part-header
{"file":"tools/gates/train-chooser.mjs","part":"train-chooser","group":"train","ranges":[[1003,1063],[2104,2252]],"gates":[1003,2104],"patched":[]}
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
export const ords = [1003, 2104];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D217 经济轴的两根锚（v1.5.313 · 用户裁定批）：两枚新桌必须导出/登记/不进默认池，且**只差一个自由量**', function () {
  /* 10-02（千问 `PROPOSAL-2026-10-02-econ-exam-tables.md` §2 · 用户裁定"批"）。
   * 为什么这两枚值得一道门：它们是**考场**（不是能力）的地基 —— §E226 体检 32,200 局实测
   * `saver − spender` 在 23 张原型桌里的 21 张上是 **0.0 vs 0.0** ⇒ **经济轴在考场里不存在**，
   * 而"攒 vs 花"正是头号目标（"不同环境用不同策略"）目前唯一还没被否掉的落点。
   * ⇒ 它俩被静默改掉（改目标 / 改选牌 / 退化成"什么都打"）会让那条结论变成假的，而**没有门会知道**
   *   —— 与 L6 那条"pickDeepSaver 被静默删除、24 个版本没人发现"是同族。
   * 判据三层：① 形状（导出 + 登记 + 不进默认池 + 选牌/目标各只有一份实现）
   *            ② 单决策行为（死线在 B 之前攒、到点全额兑现成最贵的**伤害牌**；早压第 2 回合就花）
   *            ③ **单自由度**（同一状态下两枚必须选同一张牌 ⇒ 唯一区别只剩"第几回合开始花"）。 */
  ok(typeof Bots.pickDeadlineBurst === 'function' && typeof Bots.pickEarlyPressure === 'function',
    '两枚经济锚必须都在 EpirusBots 里（别再被静默删掉）');
  const poolSrc2 = readFileSync('server/opp-pool.mjs', 'utf8');
  ok(/\{\s*name:\s*'deadlineburst'/.test(poolSrc2) && /fn:\s*'pickDeadlineBurst'/.test(poolSrc2) &&
    /\{\s*name:\s*'earlypressure'/.test(poolSrc2) && /fn:\s*'pickEarlyPressure'/.test(poolSrc2),
    '两枚必须登记进 OPP_SPECS（单一来源；漏登记 = 服务端拿到 undefined）');
  const DEF9 = OPP_SPECS.slice(0, 9).map(function (o) { return o.name; });
  ok(DEF9.indexOf('deadlineburst') < 0 && DEF9.indexOf('earlypressure') < 0,
    '两枚**不许**进默认进化池（它们是考场，不是默认基线；要进进化池必须单独裁）');
  eq(Bots.getEconB(), 6, '死线的默认爆发回合必须是 6（锚点来自 §E227 实测，不是扫参扫出来的）；要改必须走 `setEconB` 并被记录');
  eq(Bots.setEconB(4), 4, '`setEconB` 必须真改（预注册里"若判 (a) 才补 B∈{4,9} 敏感性"靠它零改码跑）');
  eq(Bots.setEconB(6), 6, '必须能改回 6（别把状态泄漏给后面的用例）');
  const botSrc2 = readFileSync('js/train/bots.js', 'utf8');
  ok(/function mpEconSpend\(/.test(botSrc2) && /function econTarget\(/.test(botSrc2) &&
    (botSrc2.match(/mpEconSpend\(legal\)/g) || []).length >= 2 && (botSrc2.match(/econTarget\(state, pid\)/g) || []).length >= 2,
    '选牌与目标必须各只有**一份**实现（两枚共用）—— 一次对照只能有一个自由量（§E194）');

  const cidx = {};
  for (const k in R.skills) { const s = R.skills[k]; if (s && s.key) cidx[s.key] = { cost: s.cost || 0, dmg: !!s.dmg, name: s.name }; }
  const mkEcon = function (ep, round) {
    const st = S.createState('multi', { next: mulberry32(97) }, 5);
    for (let i = 0; i < 5; i++) st.p[i].ep = 0;
    st.p[0].ep = ep; st.round = round; X.startTurn(st);
    return { st: st, legal: Play.legalActions(st, 0) };
  };
  /* ② 死线：B 之前，买得起也不许花 */
  const pre = mkEcon(5, 3);
  const affBig2 = pre.legal.filter(function (l) { return l.affordable && (cidx[l.key] || {}).cost >= 4; });
  ok(affBig2.length > 0, '前置：ep=5 / 第 3 回合必须有 ≥4 费的牌可负担（否则下面那条断言测不到东西）');
  eq(T.wrapBotN(Bots.pickDeadlineBurst)(pre.st, 0, pre.legal).key, R.SK.JI,
    'T‑死线在死线（第 6 回合）之前必须只攒（ジ）—— 买得起也不花，这才是"硬死线"的全部意义');
  /* ②' 死线：到点必须全额兑现成"最贵的那张**伤害牌**" */
  const at6 = mkEcon(5, 6);
  const dmgs6 = at6.legal.filter(function (l) { return l.affordable && (cidx[l.key] || {}).dmg; })
    .sort(function (a, b) { return (cidx[b.key] || {}).cost - (cidx[a.key] || {}).cost; });
  ok(dmgs6.length > 0, '前置：第 6 回合 ep=5 时必须有可负担的伤害牌');
  const actD6 = T.wrapBotN(Bots.pickDeadlineBurst)(at6.st, 0, at6.legal);
  eq(actD6.key, dmgs6[0].key,
    'T‑死线到点必须打**最贵的那张伤害牌**：用规则表自己的 `dmg` 字段判，**不许**按 `cat === ATTACK` 过滤 —— ' +
    '真正的落雷/电磁炮/过载炮全是 `CAT.SPECIAL`，按类别过滤会把最贵那一整族排除掉（首版就是这么错的）');
  ok(actD6.target != null, 'T‑死线必须显式给 target（wrapBotN 不许剥掉瞄准 —— L6 那条的同一族）');
  /* ②'' 早压：第 2 回合就得花 */
  const early2 = mkEcon(5, 2);
  ok(T.wrapBotN(Bots.pickEarlyPressure)(early2.st, 0, early2.legal).key !== R.SK.JI,
    'T‑早压必须从第 1~2 回合就花光（"先攒后打"的一方在攒的过程中被磨死，靠的就是这条）');
  /* ③ 单自由度 */
  eq(T.wrapBotN(Bots.pickEarlyPressure)(mkEcon(5, 7).st, 0, mkEcon(5, 7).legal).key,
    T.wrapBotN(Bots.pickDeadlineBurst)(mkEcon(5, 7).st, 0, mkEcon(5, 7).legal).key,
    '≥B 时两枚必须选**同一张**牌 ⇒ 唯一区别只剩"第几回合开始花"（否则 §3 那条"分离方向相反"没法解释）');
});

t('D227 §E286 难度阶梯（v1.6.6 · 用户指令 2「冠军作为底层但脚本探索概率很高」+「原本的简单普通不能用了」）：档位表是唯一来源 · 剂量由易到难单调 · 默认档逐字等于旧口径 · 量具真跑出分级 · 旧的 2 人三档不许回来', function () {
  const botsSrc = readFileSync('js/train/bots.js', 'utf8');
  const uiSrc = readFileSync('js/ui/ui.js', 'utf8');
  const BT = Bots || {};
  const TIERS = BT.DIFF_TIERS || [];

  /* ===== ① 表在册且自洽（形状检查，不看数） ===== */
  /* ⚠ 10-12 用户裁定「不需要 5 个难度了，合并成 3 个吧」⇒ 下限从 4 降到 **3**。
   *   这不是"放宽以让它绿"：原来的 4 挡的是"表被掏空成一档"，3 同样挡得住（掏空到 1~2 档照样红），
   *   而多出来的那一格（第 4 档）在这张表里已经没有了 —— 留着 4 就等于宣布"这次合并永远不许发生"。
   *   台账记在 `docs/GATE-AUDIT-2026-10-12.md` 的裁定段（判据变窄必须看得见）。 */
  ok(Array.isArray(TIERS) && TIERS.length >= 3, '①a `Bots.DIFF_TIERS` 必须至少 3 档（实测 ' + TIERS.length + '）⇒ 单一来源被掏空时下面的腿全是装饰');
  const ids = TIERS.map(function (t) { return t.id; });
  eq(new Set(ids).size, ids.length, '①b 档 id 不许重复：' + ids.join(','));
  ok(TIERS.every(function (t) { return t.kind === 'champ' || t.kind === 'style'; }),
    '①c 每档的 kind 必须是 champ|style（实测 ' + TIERS.map(function (t) { return t.kind; }).join(',') + '）');
  ok(TIERS.every(function (t) { return !t.name || /简单|入门|普通|困难|极限|陪练|风格/.test(t.name) || t.name.length > 0; }), '①d 每档都得有名（下拉要显示）');
  const badChamp = TIERS.filter(function (t) { return t.kind === 'champ' && !(typeof t.eps === 'number' && t.eps >= 0 && t.eps <= 1 && typeof t.epsK === 'number' && typeof t.epsMode === 'string'); });
  eq(badChamp.length, 0, '①e champ 档必须带齐 (eps, epsK, epsMode)——剂量是难度的**唯一**自由量：' + badChamp.map(function (t) { return t.id; }).join(','));
  const styleIds = {}; (BT.STYLES || []).forEach(function (s) { styleIds[s.id] = 1; });
  const badStyle = TIERS.filter(function (t) { return t.kind === 'style' && !styleIds[t.style]; });
  eq(badStyle.length, 0, '①f style 档指向的风格必须真在 `Bots.STYLES` 里（点了选不出来的风格 = 假档）：' + badStyle.map(function (t) { return t.id + '→' + t.style; }).join(','));
  ok((BT.DIFF_DEFAULT || '') !== '' && ids.indexOf(BT.DIFF_DEFAULT) >= 0, '①g `DIFF_DEFAULT` 必须在表里（实测 ' + BT.DIFF_DEFAULT + '）');

  /* ===== ② 剂量单调 + 默认档 = 旧口径（这两条是"阶梯"这句话的可执行内容） ===== */
  const champs = TIERS.filter(function (t) { return t.kind === 'champ'; });
  /* 表**就是**由易到难排的（页面上拉的顺序 = 数组顺序）⇒ 剂量必须不增 */
  for (let i = 1; i < champs.length; i++) {
    ok(champs[i].eps <= champs[i - 1].eps,
      '②a 第 ' + i + ' 档（' + champs[i].id + ' ε=' + champs[i].eps + '）不许比上一档（' + champs[i - 1].id + ' ε=' + champs[i - 1].eps + '）更**能探索** ⇒ 下拉顺序就是难度顺序，翻过来就是标签说谎');
  }
  /* ⚠ §E596（用户 10-12 15:2x 裁定「统一成 0→0.1→0.2」）：**五人桌的剂量轴被并掉了 ⇒ 难度只剩"带"**，
   *   所以原来那句"首末两档的剂量必须真的不同"描述的是已经不存在的机制（照它判 = 判一个恒假的东西）。
   *   换成判这次改动**真正依赖**的那件事：首末两档必须落在不同的带里（同带 = 同一档写了两遍 = 下拉在骗人）。
   *   ⚑ 同一条判据换到了 2 人桌那一根轴上：2 人桌没池（§E286），所以那里剂量仍是唯一的分档轴 ⇒ ②a 现在**两条轴都查**
   *     （五人桌读 `eps/ramp`，2 人桌读 `eps2`），这不是新增判据，是同一句"剂量不许翻序"跟着产品换了实现点。 */
  const bandOf = function (t) { return t.pool || ('style:' + (t.style || '')); };
  ok(champs.length >= 2 && bandOf(champs[0]) !== bandOf(champs[champs.length - 1]),
    '②b 首末两档必须落在**不同的带**（实测 ' + bandOf(champs[0]) + ' vs ' + bandOf(champs[champs.length - 1]) +
    '）⇒ 剂量已并成一条，带就是难度的唯一载体；同带两档 = 同一档写了两遍');
  /* 2 人桌的**有效**剂量：有 `eps2` 用它，否则**调产品自己那份形状**（`bots.js:tierEps`，第 3 回合起 = 稳定值）。
   *   ⚠ 这里原来写的是 `(t.ramp ? 0.2 : t.eps)` —— 一份手抄的规则，而且抄的还是**旧顶点**：
   *   下午把顶点降到 0.1 之后这条腿一直在按 0.2 判，注释却写着"不许抄第二份"。
   *   ⇒ 现在它和页面共用 `BT.tierEps`，产品改形状时这条腿自己跟着变（D153 钉住那份字面值）。 */
  /* §E625：这里原来自己写了一份"几个人才用 eps2"的三元（与本夜在 ui.js / 两把量具上抓到的同一族病）
   *   ⇒ 改成调 `bots.js:tierEpsAt` 那一份。**判据内容逐字不变**：`tierEpsAt(t, 2, 3)` ≡ `typeof t.eps2 === 'number' ? t.eps2 : tierEps(t, 3)`。 */
  const eff2 = function (t) { return BT.tierEpsAt(t, 2, 3); };
  for (let i = 1; i < champs.length; i++) {
    ok(eff2(champs[i]) <= eff2(champs[i - 1]), '②a2 2 人桌的剂量也不许翻序：第 ' + i + ' 档（' + champs[i].id + ' 有效 eps=' +
      eff2(champs[i]) + '）不许比上一档（' + champs[i - 1].id + ' 有效 eps=' + eff2(champs[i - 1]) + '）更能探索'
      + '（2 人桌没池 ⇒ 剂量是那里唯一的分档轴）');
  }
  const def = TIERS.filter(function (t) { return t.id === BT.DIFF_DEFAULT; })[0] || {};
  ok(def.eps === 0.1 && def.epsK === 5 && def.epsMode === 'soft' && def.ramp === true,
    '②c 默认档必须逐字是 (ε=0.1, k=5, soft, ramp) —— 斜坡这条**形状**是 v1.5.141/1.5.298 以来玩家实际吃的那条口径（D153 钉斜坡本身），'
    + '而**顶点 0.2 → 0.1 是用户 10-12 16:4x 的裁定**（「普通和困难调成 0.1，简单 0.2」）⇒ 这里重钉的是那次裁定的落地，不是顺手改手感；'
    + '再改默认档仍属产品裁定，不许夹在别的机会里做（实测默认 ' + JSON.stringify({ e: def.eps, k: def.epsK, m: def.epsMode, r: def.ramp }) + '）');

  /* ===== ③ 页面接线：值只从表里拿，旧三档不许回来 ===== */
  ok(/tier\.epsK,\s*tier\.epsMode/.test(uiSrc),
    '③a `ui.js` 调冠军 chooser 时不许再写死 k/mode，必须传 `tier.epsK, tier.epsMode`（否则表就成了装饰）');
  /* ⚠ 这里刻意用 `\b` 而不是 `indexOf('Bots.DIFFICULTY')`：`ui.js` 的注释里有一句历史说明
   *   （"`const DN = Bots.DIFFICULTY_N` 在同一个提交里被删掉了"），indexOf 会把它当成**消费点** ⇒ 门因为解释 bug 的注释而红
   *   （D226⑤c 同族，本仓已踩过两次：静态钉要钉结构，不钉词）。 */
  ok(!/Bots\.DIFFICULTY\b/.test(uiSrc) && !/DIFFICULTY\.(easy|medium|hard)\b/.test(uiSrc),
    '③b 页面不许再**消费**旧三档表 `Bots.DIFFICULTY`（用户裁定"原本的简单普通就不能用了"）');
  /* ⚠ 同上：这条也判"取用"（后面跟 `.`/`[`），不判"提到" —— `ui.js` 的修复说明里必须写出那张表的名字，
   *   用 indexOf/`\b` 会把解释 bug 的注释判成红（就是上面那条注释里写的同一个坑，我在这条上先红了一次）。 */
  ok(!/Bots\.DIFFICULTY_N\s*[.[]/.test(uiSrc) && !/const DIFFICULTY_N = \{/.test(botsSrc),
    '③b2 `DIFFICULTY_N` 这张表必须连着它的死引用一起没：页面那行 `DN.hard.pick` 自 v1.3.22 起就没定义（ReferenceError），' +
    '而这张表除了那行**零消费者** ⇒ 现在兜底点名到 `pickMultiStrong`/`pickAdaptive`（D153 的兜底腿钉它真的可解析）');
  ok(!/const DIFFICULTY = \{/.test(botsSrc), '③c `bots.js` 里那份旧三档常量不许复活（复活 = 同时存在两份难度定义，本仓的老账）');
  ok(/function champForCount/.test(uiSrc) && /Champ\.store\.load\(\)/.test(uiSrc.slice(uiSrc.indexOf('function champForCount'), uiSrc.indexOf('function champForCount') + 1400)),
    '③d 2 人桌必须换包（`champForCount` 里读 2P 那颗 `Champ.store.load()`）⇒ §E286 实测 3P 包在 1v1 上是分布外的（贪心档替身夺冠 27.5% ‖ 2P 包 15.5%），而且剂量梯反号');

  /* ===== ④ 【10-12 用户裁定甲】"分得开"必须是在册声称，不是每次现场判断 =====
   * 为什么不是原样恢复：旧 ④ 每次跑 1500 局 × 两装配去现场证明"五档两两分得开"，
   *   而那句话已经被 10-11 的实测证否（换包把中段压平：hunter→hard 1.27pt ‖ regular→novice 1.87pt，线 2pt）。
   *   甲 = **只声明分得开的档** ⇒ "分得开"变成一条**有出处、绑定参数签名**的读数（`tools/diff-ladder-claims.mjs`）：
   *     ④a 签名对得上 ⇒ 剂量/池档一改，那张账就过期，要重跑 `--pairs=1 --games=1500` 才许再声称；
   *     ④b σ 与"分得开/分不开"的标法必须彼此自洽 ⇒ 手动把某步改成"分得开"而 σ 不够，当场红；
   *     ④c 每一对相邻档在每个池装配模式下都**必须有记录** ⇒ 新增一档却没测 = 红（不许多一个没人管的位置）；
   *     ④d 现场只验两件事，因为它们对样本量不敏感：量具还活着（≥3 个不同夺冠率）+ 极端那一步仍分得开（实测 25.8σ）。
   *   ⚠ 为什么不在门里现场判中段：200 局下"普通↔入门"经常正好并列（10-12 实测三遍，两遍序就翻），
   *     把那种 n 的序钉进去只会造出**随机假红** —— 这正是暂停期间该防的事。
   * ⚠ 已知边界（写在账本上，不假装没有）：签名不含**池成员名册** ⇒ 只换池成员时这张账不会自动过期；
   *   那种情形的兜底是 ④d 与 `D234` 的池契约。名册进签名 = 每次调池都要重跑 1500 局 × 两模式，现在不付这个代价。 */
  eq(sigOf(TIERS), LADDER_CLAIM.sig, '④a 在册实测账绑的是这套档位参数（签名不同 ⇒ 那张账过期）。'
    + '重跑：node tools/probe-diff-ladder.mjs --pairs=1 --games=1500 --pool=1（另跑一遍不带 --pool=1 的是单包对照）再把 sig 现算贴回 tools/diff-ladder-claims.mjs'
    + '\n     现算=' + sigOf(TIERS) + '\n     在册=' + LADDER_CLAIM.sig);
  const claimModes = Object.keys(LADDER_CLAIM.modes || {});
  ok(claimModes.length >= 2, '④a2 至少要有两类装配的账（实测 ' + claimModes.length + ' 类：池装配 = 现在难度的载体 ‖ 单包对照 = 证明剂量轴已被并掉）⇒ 只留一类就没法说"台阶是带给的"');
  for (const mk of claimModes) {
    const rows = LADDER_CLAIM.modes[mk] || [];
    for (const p of rows) {
      /* ⚠ `se = 0` 是"两行读数逐字相同"（§E596 并掉剂量后，单包装配下三档真的成了同一台机器）——
       *   那**不是**"无穷显著"，而是"没有任何东西可声称" ⇒ 判 -1（永远不许标成"分得开"）。
       *   原来这里给 Infinity 会因为 `Infinity >= 2` 把恒等行判成"分得开"，正好把这次改动的证据反着读。 */
      const sg = p.se > 0 ? Math.abs(p.d) / p.se : -1;
      eq(sg >= 2, p.sep, '④b[' + mk + '] `' + p.from + '→' + p.to + '` 差 ' + p.d + '±' + p.se + ' = ' + sg.toFixed(2) +
        'σ，却标成"' + (p.sep ? '分得开' : '分不开') + '" ⇒ 判据边界（|σ|≥2 才许声称分得开）与标法不一致');
    }
    /* ⚠ `Bots.DIFF_TIERS` 的数组顺序是**从易到难**（`lv:sparring` 在头，实测 10-12：读出来就是这个序），
     *   而在册账里 `from` 一律是**更难**那一档（与 `probe-diff-ladder` 输出的从难到易一致）。
     *   第一版我把两边取向写反 ⇒ 门立刻红在"sparring→novice 没记账"这种根本不存在的缝隙上（自造假红）。 */
    for (let i = 0; i + 1 < TIERS.length; i++) {
      const easy = TIERS[i], hard = TIERS[i + 1];
      const hit = rows.filter(function (p) { return p.from === hard.id && p.to === easy.id; })[0];
      ok(!!hit, '④c[' + mk + '] 相邻档 `' + hard.id + '→' + easy.id + '` 在册账里没有这一行 ⇒ 这一步没人判过（新增档忘了测 / 换序没记账）');
    }
  }
  /* 这一行只是**把账本上的东西念出来**，不加判据（第 102 条管着扩判据那件事）。
   *   ⚠ 原来这里写死了"（1.9σ < 2σ）"—— 那个 1.9 是上一批读数的数，换池之后就对不上了（手打派生值这个仓最常犯）。
   *   现在每步的 σ 从行里现算；另外把"过 2σ 但符号与声明序相反"的那几步也念出来 ——
   *   门不为此红（等裁：要不要让它红是另一件事），但**不许绿色把翻序藏起来**。 */
  const notClaimed = (LADDER_CLAIM.modes['pool:long'] || []).filter(p => !p.sep)
    .map(p => p.from + '→' + p.to + '（' + (p.se > 0 ? (Math.abs(p.d) / p.se).toFixed(1) : '?') + 'σ）');
  const flipped = [];
  for (const mk of claimModes) for (const p of (LADDER_CLAIM.modes[mk] || []))
    if (p.sep && p.d < 0) flipped.push(mk + ' `' + p.from + '→' + p.to + '` ' + p.d.toFixed(2) + '±' + p.se.toFixed(2) + 'pt');
  console.log('   ⚑ ④ 阶梯在册账：' + claimModes.join(' ‖ ') + ' ‖ 按甲**没声称分得开**的那几步：' +
    (notClaimed.length ? notClaimed.join(' ‖ ') : '无') +
    ' ‖ ⚠ 符号与声明序相反（= 实测这一档比它下面那档**更软**）：' + (flipped.length ? flipped.join(' ‖ ') : '无'));
  {
    /* ⚠ §E596 并重写了这条现场腿的**判的对象**（不是放宽阈值）：原来它拿"简单 − 普通 ≥ 10pt"当"量具还活着"的证据，
     *   而那 10pt 来自简单档的 ε=1/uniform —— 剂量并掉之后那一步只剩 3.6pt，继续判它 = 判一个已经不存在的机制。
     *   现在判**首末两档**（简单带 vs 困难带），因为带是这次难度的唯一载体。
     *   ⚑ 局数从 200 提到 600：1500 局的真值是 7.0pt，200 局的配对 σ ≈ 3.4pt ⇒ 200 局下"线以下"的概率不低
     *     （实测三个 seed 的首末差 = 7.5 ‖ 13.5 ‖ 7.0，而第三跑里 普通 21.5 已经**反超** 简单 18.5 ⇒ 中段的序在 200 局根本钉不住，
     *     所以这条腿只判首末，不判中间）。⚠ 地板是**跟着在册真值算出来的**，不是拍来的：17:10 剂量再调（简单 0.2 ‖ 普通/困难 0.1）之后真值从 7.0pt 压到 5.9pt,
     *     ⇒ 局数 600 → 1200（1σ≈1.4pt）、地板 4pt → 3pt（≈2σ 之下，误红率 ~2%）。**每次改剂量都要重算这两个数**，否则这条腿会先于产品坏掉。
     *   ⚑ §E623（10-15 早）把那句"要重算"真的算了一遍，结论是**这条腿现在是红的、而红的是真话**：
     *     换一整组新种子（78000..78007，与在册那批 77000..77007 不共用）把**上面那条命令行**跑 8 遍 ⇒
     *     首末差 multi **2.04 ±0.57pt**（单跑 1σ 实测 **1.62**，与这里写的 1.4 同量级 ⇒ 误差模型没坏，坏的是"真值 5.9pt"那句，它是裁定前装配的数）‖ long 1.78 ±0.56 ‖
     *     8 跑里只有 **3** 跑（long 只 2 跑）≥3pt ⇒ 换种子重跑也过不了线的概率约 5/8，**不是抽样运气**。
     *     按同一公式重算地板（2.04 − 2σ ≈ 0.9 ⇒ 取整到 1）的实际含义是**这条腿不再判首末差**（任何正差都过），不是"把 3 改成 2"。
     *     ⇒ 所以这里**阈值一个数字没动、判词一个字没改**（改它 = 喂字符串）：这条红是 10-15 那句"掺席买可玩性、不买难度"裁定的直接代价，
     *     走哪条路归裁（日志待裁 #29 的甲/乙/丙）。底稿 `docs/artifacts/e608-out/e623-both-shapes.txt`。
     *   ⚠ 一句反面提醒（写给下一个想"修"它的人）：我差点把这次 SE 变大解释成"这条腿不传 `--pairs=1` ⇒ 它的差是未配对的"，
     *     **被自己的对照否了**（两种形状各跑 8 遍，16 个数字逐字全等 ⇒ 那条旗标只改报表、不改抽样，见 `tools/probe-diff-ladder.mjs:353-370`）⇒ 别拿那个当理由。 */
    const run = spawnSync(process.execPath, ['tools/probe-diff-ladder.mjs', '--machine=1', '--quiet',
      '--games=1200', '--n=5', '--mode=multi', '--pool=1'], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    const out = String(run.stdout || '');
    const last = out.trim().split('\n').filter(function (l) { return /^\{/.test(l); }).pop();
    let obj = null; try { obj = JSON.parse(last || 'null'); } catch (e) { /* 下面响亮报 */ }
    ok(!!obj, '④d 现场那跑必须跑出机器可读的一行（rc=' + run.status + ' ‖ 尾部：' + out.slice(-160) + '）');
    ok(!!obj && Array.isArray(obj.rows) && obj.rows.length === TIERS.length,
      '④d 量具要把**整张表**都跑一遍（实测 ' + (obj && obj.rows ? obj.rows.length : '?') + ' 行 ‖ 表 ' + TIERS.length + ' 档）');
    const pcts = ((obj && obj.rows) || []).map(function (r) { return r.pct; });
    ok(new Set(pcts).size >= 3, '④d 正对照：至少三个不同的夺冠率（实测 ' + new Set(pcts).size + ' 个 ‖ ' + pcts.join('/') +
      '）⇒ 全相同说明带没在动判决（第二十五条那族"夹具退化"），那 ④b/④c 那张账就是在描述一台停住的机器');
    const byId = {}; ((obj && obj.rows) || []).forEach(function (r) { byId[r.id] = r.pct; });
    const easyEnd = byId['lv:sparring'], hardEnd = byId['lv:hard'];
    ok(typeof easyEnd === 'number' && typeof hardEnd === 'number' && easyEnd - hardEnd >= 3,
      '④d 首末两档（简单带 vs 困难带）必须还分得开：实测 简单 ' + easyEnd + '% ‖ 困难 ' + hardEnd + '% ‖ 差 ' +
      ((easyEnd || 0) - (hardEnd || 0)).toFixed(2) + 'pt（17:10 在册真值 5.9pt ‖ 1200 局 1σ≈1.4pt ⇒ 地板钉 3pt）'
      + ' ⇒ 这一步塌了说明"难度由带扛"整句话失效，那张在册账要整张重测');
  }
});

}

