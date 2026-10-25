/*#np-part-header
{"file":"tools/gates/meta-lint.mjs","part":"meta-lint","group":"meta","ranges":[[846,862],[1064,1183],[10391,10417],[11216,11241]],"gates":[846,1064,10391,11216],"patched":[850,1106,10395,11229,11233]}
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
export const ords = [846, 1064, 10391, 11216];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('L1 断言不得是恒真式（空断言 / 近乎恒真）——本项目出现过 3 次', function () {
  /* Real instances are described in prose only -- spelling the patterns on a
   * code-like line would trip this very lint. */

  const src = npSourceAll();   /* v1.7.8 拆分：门体搬进 tools/gates/*.mjs ⇒ 这条 lint 必须扫**全部门体文件**（只扫 runner 就成了恒真空门，正是它要防的那类） */
  const lines = src.split('\n');
  const bad = [];
  const PAT = [/ok\(\s*true\b/, /ok\(\s*[0-9]+\s*[,)]/, /\?\s*false\s*:\s*true/, /ok\(\s*1\s*[,)]/];
  for (let i2 = 0; i2 < lines.length; i2++) {
    const L = lines[i2];
    if (L.trim().startsWith('*') || L.trim().startsWith('//')) continue;
    if (L.indexOf('PAT') >= 0) continue;                 // this definition line itself
    for (const re of PAT) if (re.test(L)) { bad.push((i2 + 1) + ': ' + L.trim().slice(0, 60)); break; }
  }
  eq(bad.length, 0, '恒真断言（测不到任何东西）：\n    ' + bad.join('\n    '));
});

t('D218 研究工具的旗标登记结构（v1.5.318）：读了却没登记的旗标必须为 0，且假旗标必须 exit 64', function () {
  /* 为什么：`rejectUnknownFlags` 是研究工具唯一的输入消毒层，漏登记的后果**两向都坏** ——
   * 要么工具自己读的旗标被它响亮拒掉（§E230 跑前发现的 `allowmixedcfg` 正是这一类：
   * 亲手建的逃生口被自己的门挡死），要么拼错的旗标**静默被忽略**、读数按默认档跑完而没人知道。
   * 判据钉的是**结构**（读到的每个旗标都在自己的名单里），不是某几个旗标词 ⇒ 加旗标不用改门，漏登记才红。
   * 纯 indexOf 实现（本仓踩过 heredoc 把反斜杠折掉、正则变成真换行的坑）⇒ 门里不出现反斜杠。 */
  const quoted = function (s) { const p = s.split(String.fromCharCode(39)); const out = [];
    for (let i = 1; i < p.length; i += 2) out.push(p[i]); return out; };
  const grab = function (src, needle) { const out = []; const q = String.fromCharCode(39); let i = -1;
    while ((i = src.indexOf(needle, i + 1)) >= 0) { const j = src.indexOf(q, i + needle.length);   /* v1.5.323 修 off-by-one：针脚自己含开引号 ⇒ 名字从针脚之后起到**下一个引号**止 */
      if (j > i + needle.length) out.push(src.slice(i + needle.length, j)); } return out; };
  /* v1.5.323：**名单解析器** —— 按**顶层逗号**取第二个实参，且它必须以 `[` 开头才算「内联名单」。
   * 为什么必须换成它：上一版用 `indexOf('[', 调用处)` + 「调用处到 `[` 之间不能再有 `)`」当守卫，
   * 前者在 `FLAGS` 变量形式下会把**后面别的数组**当名单（假违规），
   * 后者又把 `process.argv.slice(2)` 里那个 `)` 当分界 ⇒ **把所有内联名单也跳过 ⇒ 这条腿又空转**。
   * 纯 indexOf/charAt 实现，**不出现反斜杠**（沿用本门风格）。 */
  const flagListSpan = function (src) {
    const call = 'rejectUnknownFlags(';
    const i0 = src.indexOf(call);
    if (i0 < 0) return null;
    const open = i0 + call.length - 1;
    let d = 1, comma = -1, end = -1;
    for (let j = open + 1; j < src.length; j++) {
      const c = src.charAt(j);
      if (c === '(' || c === '[' || c === '{') d++;
      else if (c === ')' || c === ']' || c === '}') { d--; if (d === 0) { end = j; break; } }
      else if (c === ',' && d === 1 && comma < 0) comma = j;
    }
    if (comma < 0 || end < 0) return null;
    let k0 = comma + 1;
    while (k0 < end && (src.charCodeAt(k0) === 32 || src.charCodeAt(k0) === 9 || src.charCodeAt(k0) === 13 || src.charCodeAt(k0) === 10)) k0++;
    if (src.charAt(k0) !== '[') return null;                 /* 变量形式（如 FLAGS）⇒ 不是内联名单 */
    let d2 = 0, closeIdx = -1;
    for (let j = k0; j < end; j++) {
      const c = src.charAt(j);
      if (c === '[') d2++;
      else if (c === ']') { d2--; if (d2 === 0) { closeIdx = j; break; } }
    }
    if (closeIdx < 0) return null;
    return { start: k0, end: closeIdx, listed: quoted(src.slice(k0, closeIdx)) };
  };
  /* 不扫门文件自己：它里面就写着 grab(src, "arg('" ) 这类字面量，会把门自己的源码当读数扫进来（首版就栽在这）。 */
  const files = readdirSync('tools').filter(function (f) { return f.slice(-4) === '.mjs' && f !== 'np-test.mjs'; });   /* v1.7.8 拆分后：readdirSync 不递归 ⇒ tools/gates/** 不在名单里，这是**对的**：门体文件不是量具（没有命令行旗标），混进量具名单只会改变这条门的语义 */
  const offenders = []; let scanned = 0;
  for (let fi = 0; fi < files.length; fi++) {
    const src = readFileSync('tools/' + files[fi], 'utf8');
    const a0 = src.indexOf('rejectUnknownFlags(argv, [');
    if (a0 < 0) continue;
    scanned++;
    const a1 = src.indexOf(']', a0);
    const listed = {}; quoted(src.slice(a0, a1)).forEach(function (x) { listed[x] = 1; });
    const used = {};
    grab(src, "arg('").concat(grab(src, "flag('")).concat(grab(src, "=== '--")).concat(grab(src, "startsWith('--"))
      .forEach(function (x) { const v = x.replace('=', ''); const isName = v.length > 0 && v.split('').every(function (c) { const o = c.charCodeAt(0); return (o >= 48 && o <= 57) || (o >= 65 && o <= 90) || (o >= 97 && o <= 122) || o === 95; }); if (isName) used[v] = 1; });
    const miss = Object.keys(used).filter(function (x) { return !listed[x]; });
    if (miss.length) offenders.push(files[fi] + ' -> ' + miss.join(','));
  }
  ok(scanned > 0, '抽取没瞎：至少要能认出带消毒层的入口（实测 ' + scanned + ' 台）—— 一个都认不出来说明抽取式坏了');
  /* v1.7.67（用户 10-16 裁定「钉绝对数量的门改掉或者删了」）：原来是 `scanned >= 8` —— 一个**绝对数**，已换成不钉数量的形状。
   *   ⚠ 但要把**真缺口**记在案（本门的已知盲区，第一版注释自己就写过）：本门只扫「**已经有**这道层的工具」，
   *   对「根本没有消毒层、却在读 `--` 旗标」的工具是**瞎的**。实测（2026-10-16）：读了旗标却没有层的 = **18 台**
   *   （analyze-* / build-pool-bundle / promote-champion{,2p} / soup-pack / pick-5p / gate-all / np-parallel …）
   *   ⇒ 它们**静默忽略拼错的旗标** = 「静默忽略 = 假读数」那条规矩下的真缺口。**先只记录、不阻断**（给 18 台各补一份
   *   旗标名单是单独一笔活），已在 CHANGELOG v1.7.67 记账。 */
  const readsFlags = files.filter(function (f) {
    const s = readFileSync('tools/' + f, 'utf8');
    return /arg\('|flag\(|=== '--|startsWith\('--/.test(s);
  });
  const noLayerAny = readsFlags.filter(function (f) { return readFileSync('tools/' + f, 'utf8').indexOf('rejectUnknownFlags') < 0; });
  if (noLayerAny.length) {
    console.log('  ℹ️ 读了 `--` 旗标但**没有** rejectUnknownFlags 的工具 = ' + noLayerAny.length + ' 台（待办，不阻断）：' + noLayerAny.join(' '));
  }
  eq(offenders.length, 0, '读了却没登记的旗标必须为 0（实测违规：' + (offenders.join(' | ') || '无') + '）');
  /* 行为腿：假旗标必须**响亮**失败（exit 64），不许静默按默认档跑完 */
  const rb = spawnSync(process.execPath, ['tools/probe-distill-learnability.mjs', '--绝对不存在的旗标=1'], { encoding: 'utf8' });
  eq(rb.status, 64, '假旗标必须以 exit 64 被拒（实测 status=' + rb.status + '）');
  /* ══════════ v1.5.323 加强：研究量具**必须有**这道层 ══════════
   * 原版只扫"**已经有**这道层"的工具（8 台）⇒ 对"**根本没有**消毒层"的工具是**瞎的**。
   * 实测缺口：`tools/probe-skill-marginal.mjs`（就是产出"摄魂 +22.5"那台）grep `rejectUnknownFlags`
   * **零命中** ⇒ 拼错的旗标（`--games=80` 打成 `--game=80`）**静默按默认档跑完**、读数照旧出来，
   * 而人会以为"我控制了这个变量" —— 这正是仓规"静默忽略 = 假读数"要防的那一类（v1.5.234 立）。
   * 判据升级成两条合取：① 枚举规则内的每一台研究量具都**带**这道层（结构）；
   *   ② 每一台都**真的**以 exit 64 拒绝假旗标（行为，逐台 spawn）。 */
  const probes = files.filter(function (f) { return f.indexOf('probe-') === 0; }).sort();
  const noLayer = [];
  for (let pi = 0; pi < probes.length; pi++) {
    if (readFileSync('tools/' + probes[pi], 'utf8').indexOf('rejectUnknownFlags') < 0) noLayer.push(probes[pi]);
  }
  /* v1.7.67（用户 10-16 裁定「钉绝对数量的门改掉或者删了」）：原来这条是 `probes.length >= 40` —— 一个**绝对数**。
   *   规模无关的判据应该判**「一台都不许逃过扫描」**：扫描根是 `readdirSync('tools')`（**不递归**）⇒ 把一台探针
   *   搬进子目录就会静默掉出名单（门变瞎、而名单看着还是「够多」），那正是原来那个数字想防的事。
   *   改成递归对账。⚠ 要排除 `tools/gates/**`：那里的 `probe-instruments.mjs` / `probe-libs.mjs` 是**部分文件**
   *   （门体），只是名字撞上了 `probe-`，它们不是量具。 */
  const probeAll = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = d + '/' + e.name;
      if (e.isDirectory()) { if (p !== 'tools/gates') walk(p); }
      else if (/^probe-.*\.mjs$/.test(e.name)) probeAll.push(p);
    }
  })('tools');
  eq(probes.length, probeAll.length,
    '工具根下的 probe-*.mjs 台数必须等于**递归**数到的台数（实测 ' + probes.length + ' vs ' + probeAll.length
    + '）—— 多了说明有探针被搬出了扫描根（那台量具的门会**静默变瞎**，而台数看着还够）');
  eq(noLayer.length, 0, '每一台研究量具都必须带 rejectUnknownFlags（实测缺口：' + (noLayer.join(', ') || '无') + '）');
  /* 登记一致性**覆盖两种调用形式**：原版只认 `rejectUnknownFlags(argv, [` ⇒
   * 用 `process.argv.slice(2)` 的那批工具从来没被这条腿扫到过（同一个"名单写两遍"家族）。 */
  const isFlagName = function (v) {
    if (v.length < 2 || v.charAt(0) === '-') return false;
    return v.split('').every(function (c) { const o = c.charCodeAt(0); return (o >= 48 && o <= 57) || (o >= 65 && o <= 90) || (o >= 97 && o <= 122) || o === 95 || o === 45; });
  };
  /* 自检（**防这条腿再空转**）：在夹具上抽，必须**恰好**抽到这三个名字。
   * 为什么必须有它：抽取函数原先有 **off-by-one** —— 针脚 `arg('` 自己就含开引号，名字应从「针脚之后」到
   * 「下一个引号」；原实现从「下一个引号之后再下一个引号」取 ⇒ 抽到的是 `, ` 这种垃圾，
   * 再被名字过滤一滤 ⇒ **这条腿自 v1.5.318 起一直在空转**（"永不触发的守卫 = 没有守卫"再犯一次）。
   * 下面这条自检就是为了让抽取器**再也不能**静默失准。 */
  const q2 = String.fromCharCode(39);
  const fxSrc = "const a = arg(" + q2 + "games" + q2 + ", 1); if (x === " + q2 + "--json" + q2 + ") f.startsWith(" + q2 + "--self-test=" + q2 + ");";
  const fxNames = {};
  grab(fxSrc, "arg('").concat(grab(fxSrc, "=== '--")).concat(grab(fxSrc, "startsWith('--"))
    .forEach(function (x) { const v = x.replace('=', ''); if (isFlagName(v)) fxNames[v] = 1; });
  eq(Object.keys(fxNames).sort().join(','), 'games,json,self-test',
    '旗标抽取自检：夹具上必须恰好抽到 games,json,self-test（实测 ' + (Object.keys(fxNames).sort().join(',') || '空') + '）—— 抽不到说明这条腿又空转了');
  const misreg = [];
  for (let pi = 0; pi < probes.length; pi++) {
    const src2 = readFileSync('tools/' + probes[pi], 'utf8');
    const c0 = src2.indexOf('rejectUnknownFlags(');
    if (c0 < 0) continue;
    const span2 = flagListSpan(src2);
    if (!span2) continue;   /* 名单是变量形式（如 FLAGS）⇒ 跳过：宁可跳过也不误报 */
    const listed2 = {};
    span2.listed.forEach(function (x) { listed2[x] = 1; });
    const used2 = {};
    grab(src2, "arg('").concat(grab(src2, "flag('")).concat(grab(src2, "=== '--"))
      .concat(grab(src2, "startsWith('--")).concat(grab(src2, "indexOf('--")).concat(grab(src2, "includes('--"))
      .forEach(function (x) { const v = x.replace('=', ''); if (isFlagName(v)) used2[v] = 1; });
    const m2 = Object.keys(used2).filter(function (x) { return !listed2[x]; });
    if (m2.length) misreg.push(probes[pi] + ' -> ' + m2.join(','));
  }
  eq(misreg.length, 0, '研究量具读到的旗标必须全部登记（两种调用形式都算；实测违规：' + (misreg.join(' | ') || '无') + '）');
  /* 行为腿（逐台）：消毒层**真的接上了**的唯一凭据 —— 假旗标必须 exit 64 */
  const notRejecting = [];
  for (let pi = 0; pi < probes.length; pi++) {
    const rr = spawnSync(process.execPath, ['tools/' + probes[pi], '--绝对不存在的旗标=1'], { encoding: 'utf8', timeout: 15000 });
    if (rr.status !== 64) notRejecting.push(probes[pi] + '(status=' + rr.status + ')');
  }
  eq(notRejecting.length, 0, '每一台研究量具都必须以 exit 64 拒绝假旗标（实测不拒：' + (notRejecting.join(', ') || '无') + '）');
});

t('D194 `--only` 复跑单道门不许伪装成全绿（v1.5.288）：跳过的条数必须响亮印出、打错字要拒绝、注册数守卫要把跳过算进去', function () {
  /* 为什么补这道：本班给 np-test 加了 `--only=`（改门→验门从 9 分钟降到 10 秒）。
   * 这把刀的危险很具体：**跳过 237 道门然后报"通过 1 / 1"**，或者**子串打错 ⇒ 一条没跑也报绿**。
   * 所以判据钉在三处可观察的行为上，不是钉在"有这个参数"上。 */
  const src = npSourceAll();   /* v1.7.8：--only 入口与收尾注册数守卫都在 runner 里 ⇒ 扫全程序面（判据一字未改） */
  ok(/const ONLY = \(process\.argv\.find\(a => a\.startsWith\('--only='\)\)/.test(src), '① 入口必须解析 --only');
  ok(/__nReg !== PASS \+ FAIL \+ __skipped/.test(src),
    '② "注册数 vs 执行数"那道守卫必须把**被 --only 跳过的**也计进去（否则加了开关就等于把守卫拆了）');
  const one = spawnSync(process.execPath, ['tools/np-test.mjs', '--only=D193'], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const o1 = String(one.stdout || '');
  /* ⚑ 10-25（D193⑨′ 那次真红把本门也点着之后改的）：这里原来钉的是**「`--only=D193` 必须 exit 0 且通过 1/1」**
   *   ⇒ 等于把本门接在**另一道门的健康度**上：一个原因（D193 红）亮两盏灯，而本门真正要判的是 **runner 诚不诚实**，
   *   不是被探针那道门判成了什么。改成钉**自洽**：报绿与退出码必须同真同假（探针那道门红着时本门照过，
   *   而 runner 若"通过 1/1 却 exit=1"或"exit=0 却 0/1"就当场红）。下面那三条计数腿一字未动。 */
  const tally1 = (o1.match(/通过 (\d+) \/ (\d+)/) || []);
  ok(tally1.length === 3 && Number(tally1[2]) === 1 && ((one.status === 0) === (Number(tally1[1]) === 1)),
    '③ 探针那一道的"通过 N / M"必须与退出码**自洽**、且 M 必须是 1（实测 exit=' + one.status + ' ‖ 报的是 "' +
    (tally1[1] === undefined ? '（没印计数行）' : tally1[1] + ' / ' + tally1[2]) + '"）⇒ 计数与退出码各说各话就是 runner 在撒谎');
  const m = o1.match(/只跑了 (\d+) \/ (\d+) 条\*\*（跳过 (\d+) 条）/);
  ok(!!m, '③ 必须响亮印出"只跑了 N / M 条（跳过 K 条）"——**没有这一行就是静默少跑**');
  if (m) {
    eq(Number(m[1]), 1, '③ 实跑条数');
    ok(Number(m[2]) === Number(m[1]) + Number(m[3]) && Number(m[2]) > 100,
      '③ 分母必须是**全部注册数**（' + m[2] + ' = 跑的 ' + m[1] + ' + 跳的 ' + m[3] + '）⇒ 分母偷偷变小就等于把守卫拆了');
    /* （原来这条钉的是整句『不许当"四道全绿"引用』—— 那是**措辞在册**，而且把"四"这个数写死进了判据：
     *   §E365 给 gate-all 加了第五道（演化页自检）之后，那句话本身就该过期，而门会替我"守住一个旧数字"。
     *   换成钉**语义核心**：这一行必须说"这不是全量门禁"，并且分母必须还是全部注册数（上面那条已经钉了）。） */
    ok(/这不是全量门禁/.test(o1), '③ 那句"这不是全量门禁"必须跟着印出来（钉语义，不钉"四道"这个数）');
  }
  const typo = spawnSync(process.execPath, ['tools/np-test.mjs', '--only=ZZ-没有这道门'], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  ok(typo.status === 3 && /一个都没匹配到/.test(String(typo.stderr || '')),
    '④ 子串打错 ⇒ 必须 **exit 3 拒绝**，不许报"通过 0 / 0"当绿（实测 exit=' + typo.status + '）');
});

t('D206 econ 奖励键三处名单自洽（DS 清单 B7 · 09-30 夜班）：默认表 / CLI 名单 / 两处 SENT 夹具 ⇒ 缺任一处就是"通过黑键闸却从没送到引擎"', function () {
  /* 为什么有这条：v1.5.274 那回 `costlyW` 登记进了 CLI 名单、黑键闸放行，但**引擎侧没人读它** ⇒ "传了等于没传"（METHODOLOGY 第一条硬规矩）。
     B7 列的"五处"里今天能机械核对的是这三处，就钉这三处；钉不全的诚实印出来当**已知欠账**，不假装覆盖。 */
  const defaults = readEconEnv({});
  ok(ECON_REWARD_KEYS.length >= 20, '① 反装饰：`ECON_REWARD_KEYS` 该有 ≥20 个键（实测 ' + ECON_REWARD_KEYS.length + '）⇒ 名单被清空时这条要响');
  const noDef = ECON_REWARD_KEYS.filter(k => !(k in defaults));
  ok(noDef.length === 0, '② 名单里的键在 `readEconEnv({})` 默认表里找不到（引擎读到 undefined ⇒ 设了也不生效）：' + noDef.join(' / '));
  const cliBlock = String(readFileSync('tools/train-3p.mjs', 'utf8').match(/const CLI_ECON_REWARD_KEYS = \[[\s\S]*?\];/)[0]);
  const cli = [...cliBlock.matchAll(/'([^']+)'/g)].map(m => m[1]);
  ok(cli.length >= 8, '③ 反装饰：从 `train-3p` 抠到的 CLI 名单只有 ' + cli.length + ' 个键 ⇒ 抽取式大概已失效');
  const notKnown = cli.filter(k => ECON_REWARD_KEYS.indexOf(k) < 0);
  ok(notKnown.length === 0, '④ CLI 认得、引擎名单不认得（值被下达后就丢）：' + notKnown.join(' / '));
  const sentOf = function (f) {
    const s = f === null ? npSourceAll() : readFileSync(f, 'utf8'); const i = s.indexOf(f === null ? 'const SENT = {' : 'SENT');
    const seg = s.slice(i, s.indexOf('};', i));
    return new Set([...seg.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map(m => m[1]));
  };
  const sA = sentOf(null), sB = sentOf('tools/probe-econ-reset-audit.mjs');   /* v1.7.8：SENT 夹具随门体搬进 tools/gates/** ⇒ 从全程序面里抽**第一处**（拼序 = 原始行号序 ⇒ 与拆前同一处） */
  ok(sA.size >= 15 && sB.size >= 20, '⑤ 反装饰：两处 SENT 解析出的键数 = ' + sA.size + ' / ' + sB.size + ' ⇒ 解析失效就别放行（D199 第一版那个形状）');
  const unsent = ECON_REWARD_KEYS.filter(k => !sA.has(k) && !sB.has(k));
  ok(unsent.length === 0, '⑥ 这个键**两处测试夹具都不送**（新登记的键没人验过它真能到达作用点）：' + unsent.join(' / '));
  const unsentOf = function (keys) { return keys.filter(k => !sA.has(k) && !sB.has(k)); };
  ok(unsentOf(['zzNotARealRewardKey']).join() === 'zzNotARealRewardKey',
    '⑦ 合成正对照：凭空造一个没登记的键，判据必须抓到（抓不到 ⇒ ⑥ 是装饰）');
});

}

