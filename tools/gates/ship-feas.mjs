/*#np-part-header
{"file":"tools/gates/ship-feas.mjs","part":"ship-feas","group":"ship","ranges":[[3697,3730],[3971,3992],[4278,4290],[4324,4346],[4362,4362],[4388,4411],[4781,4796],[5888,5946],[6293,6413],[7206,7234],[8175,8192],[8272,8291],[8767,8809],[11526,11643]],"gates":[3697,3971,4278,4324,4388,4781,5888,6293,6344,7206,8175,8272,8767,11526],"patched":[6367,11620]}
#np-part-header-end*/
import { makeCtx, NP_GATE_FILES, npSourceAll } from './_ctx.mjs';
/* 前导里的全部具名绑定原样接回（自由变量照原样解析 ⇒ 门体零改动）。 */
const {
  existsSync, readFileSync, readdirSync, statSync, mkdtempSync,
  mkdirSync, writeFileSync, rmSync, copyFileSync, tmpdir,
  join, createHash, _spawnSync, spawnSync,
  parsePairTable, makeGuardCost, resolveOutPath, loadSlotId, sigOf,
  LADDER_CLAIM, pushTarget, hardwiredLine, widOfArr, seatRd,
  seatKillIndex, pairHasBase, classifyDefenseWindow, defenseQuality, formatQuality,
  parseQuality, formatQualityRecord, AUDIT, PS, PF_FRONT,
  spawnCached, inputHash, cacheStats, cacheDir, spawnNC,
  spawnBatch, RGAIN, OPP_SPECS,
  conc, fieldProfile, tallyPick, WIN, loadPool,
  selfTest, vm, isChampOpp, loadChampParams, makeChampOppResolver,
  makeShapeScorer, rulesFingerprint, fingerprintOfBundle, pickBestByExam, regressionsOf,
  fixesOf, INCUMBENT_TAG, rejectDegenerateWinners, vetoBy3p, bandPickByLand,
  bandPickByUsage, rejectNarrowWinners, COLLAPSE_LINE, SEL_BASE0, SEL_STRIDE,
  SEL_SEEDS_DEFAULT, parseSelSeeds, selBase, selBases, scoreRuns,
  selNote, selGapNote,
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
export const ords = [3697, 3971, 4278, 4324, 4388, 7206, 8175, 8272, 8767, 11526];  /* 2026-11-19：D73/D124/D125/D121 随 v7 训练器删除（见 GATE-SHIFTS） */
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D35 训练侧"自对局健康门槛"必须存在、默认开、且与体检共用同一实现', function () {
  /* 起因（v1.5.19）：v7 加完特征后，分最高的几个候选在**自对局**里只剩 1~2 张卡、打到 50~60 回合
   * （实测 G=1.00~1.66，而 eco-34 是 4.24）—— 单一 1st 率能被"熬"骗（REVIEW §11）。
   * 修法是把体检的 G/平局/回合做成**换冠军的硬门槛**，且**与 champ-audit 共用一份实现**。 */
  ok(typeof T.mirrorHealth === 'function', 'T.mirrorHealth 必须导出（体检 G 列与训练门槛的单一真源）');
  const hg = T.healthGate();
  ok(hg.on === true, '健康门槛默认必须开（关掉就等于把"熬"解放回冠军位）');
  eq(hg.minG, 3, 'G 门槛必须与 champ-audit 的判读口径一致（<3 = 打法坍缩到两三张卡）');
  eq(hg.maxDraw, 0.2, '平局率门槛 20%');
  eq(hg.maxRounds, 40, '自对局回合门槛 40');
  ok(hg.promoteGames >= 4, 'promoteGames（提升冠军前的自对局局数）必须存在且够小样本可用');
  /* ⚠️ 门槛必须加在**决定产物的那一行**上：产物冠军由 finishStep 的 `t.champion = t.bestChamp` 决定，
   * 第一版只加在收尾的 pickChampionByWinRate 上 ⇒ 12 个 seed 的产物与没加时**逐个相同**（空操作）。 */
  const evo0 = readFileSync('js/train/evo.js', 'utf8');
  ok(/if \(better && HEALTH\.on( && !IN_EXPLORE)?\) \{/.test(evo0), '提升冠军前（finishStep 的 better 分支）必须有健康门槛（v1.5.42 起允许探索期例外）');
  ok(/if \(better && !healthReject\) \{/.test(evo0), '体检不过时必须**不提升**（保留上一个合格冠军）');
  /* 单一真源：体检侧不许再自己算一遍 exp(熵)（两处各写一遍必出事，METHODOLOGY 第 13 条） */
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('mirrorHealth(') >= 0, 'tools/audit-lib.mjs 的 selfPlay 必须调用 T.mirrorHealth（单一真源）');
  ok(al.indexOf('Math.exp(H)') < 0, 'audit-lib 不许再自己算一遍 exp(熵)（否则门槛与体检会漂移）');
  /* 阈值逻辑本身（纯函数，逐条可判） */
  eq(T.healthFails({ effSkills: 4.2, drawRate: 0, rounds: 30 }).length, 0, '健康候选不得报失败');
  eq(T.healthFails({ effSkills: 1.5, drawRate: 0, rounds: 55 }).length, 2, 'G<3 与回合>40 必须各报一条');
  eq(T.healthFails({ effSkills: 3.1, drawRate: 0.5, rounds: 20 }).length, 1, '平局率 50% 必须报一条');
  /* 门槛必须真的参与择优：容差带过滤条件里必须有 healthOk */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(/band = pool\.filter\(function \(c\) \{ return c\.healthOk && c\.score >= topScore - WR_TOL; \}\)/.test(evo),
    '容差带必须只收健康候选（否则"高分但退化"仍会被选中）');
  /* 实测一次（2 局，便宜）：镜像局体检必须给出有限数值并回显局数 */
  const mh = T.mirrorHealth(new Float64Array(Pol.paramCount()), 2, 5, 'multi');
  ok(mh && mh.games === 2 && isFinite(mh.effSkills) && isFinite(mh.rounds) && isFinite(mh.drawRate),
    'mirrorHealth 必须返回有限数值并回显 games');
});

t('D27 体检指标必须单一来源 + 换冠军必须有**阻断**条件（不能只 warn）', function () {
  /* 第三方复核 §7-4(1)：champ-audit 的 E/F 两列"只打印、不参与任何判定"，
   * `promote-champion.mjs:77-81` 也只有三条 console.warn、末尾还写着"决定权在你"
   * ⇒ "集体防御/打法坍缩"这种形状量出来了也没人挡。
   * 修法有两半，这条守门的也正是这两半：① 指标只有一份实现（否则门槛会跟打印漂移）；
   * ② 不过门槛必须**中止**，越过必须显式 `--force` 且在 meta 里留痕。 */
  const ca = readFileSync('tools/champ-audit.mjs', 'utf8');
  const pc = readFileSync('tools/promote-champion.mjs', 'utf8');
  /* v1.7.76（千问夜班 · DS §五 T1 ③→②）：原来这两条钉的是**字符串** `from './audit-lib.mjs'`
   * —— 它既不认 `../`、也不认双引号，更要命的是**指到别处的第二份 lib 也算过**。
   * 现在做三件真事：① 抓出那条 import 的**说明符与清单**；② 按该文件所在目录把说明符**解析成绝对路径**，
   * 与已装载模块自报的 `AUDIT.ROOT/tools/audit-lib.mjs` 比（路径不同 = 两份实现，正是这条门的病根）；
   * ③ 清单里每个名字都拿去问**已经装载好的那个模块**在不在。
   * 牙口四条**实测**（`docs/artifacts/e608-out/s72-d27-teeth.mjs`，03:2x）：
   *   A 路径写 `../audit-lib.mjs` ⇒ 红（原话「解析成 …\audit-lib.mjs ⇒ 必须就是那一份 …\tools\audit-lib.mjs」）‖
   *   B 清单里 `selfPlay`→`selfPlayX` ⇒ 红（原话「导入的 `selfPlayX` 在…已装载模块里必须真存在」）‖
   *   C 基线 ⇒ 绿 ‖ **D 只改头注一句话 ⇒ 绿**（这条是"别把注释又钉回去"的反向对照）。 */

  const LIB_PATH = join(AUDIT.ROOT, 'tools', 'audit-lib.mjs');
  /* 手写解析（ctx 里没有 node:path 的 resolve/dirname，而为两个名字去扩 _ctx 的导出面 = 全部门文件头部要重烘，
   * 那是 DS §五 T3 那类"要付整轮"的钱 ⇒ 这里只做**同一件事的便宜版**：按 ./ ../ 逐段走）。 */
  const walkUp = function (p, k) { const seg = p.split(/[\\/]/); while (k-- > 0) seg.pop(); return seg.join('/'); };
  const resolveSpec = function (dir, spec) {
    let p = spec.charAt(0) === '/' ? spec : dir;
    for (const seg of spec.split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') p = walkUp(p, 1);
      else p = join(p, seg);
    }
    return p;
  };
  const libNames = function (src, file, label) {
    const dir = walkUp(join(AUDIT.ROOT, file), 1);
    const re = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]*audit-lib\.mjs)['"]/g;
    const names = []; let m;
    while ((m = re.exec(src)) !== null) {
      const abs = resolveSpec(dir, m[2]);
      ok(abs === LIB_PATH || abs.replace(/[\\/]/g, '/') === LIB_PATH.replace(/[\\/]/g, '/'),
        label + ' 的 audit-lib 说明符 `' + m[2] + '` 解析成 ' + abs + ' ⇒ 必须就是那一份 ' + LIB_PATH);
      for (const raw of m[1].split(',')) { const nm = raw.trim().split(/\s+as\s+/)[0].trim(); if (nm) names.push(nm); }
    }
    ok(names.length >= 3, label + ' 必须从 audit-lib 具名导入指标（本次读到 ' + names.length + ' 个：' + names.join(',') + '）');
    for (const nm of names) ok(nm in AUDIT, label + ' 导入的 `' + nm + '` 在 tools/audit-lib.mjs 的**已装载模块**里必须真存在');
    return names;
  };
  const caNames = libNames(ca, 'tools/champ-audit.mjs', 'champ-audit');
  const pcNames = libNames(pc, 'tools/promote-champion.mjs', 'promote-champion');
  /* 单一来源的另一半：两边都得名带到**同一批**指标（否则"门"和"打印"就会各算各的）。
   * 名单取的是本班实测的交集形状：`loadChamp` 只有 champ-audit 用（promote 走自己的读取口），所以不能拿它当共同项。 */
  for (const nm of ['selfPlay', 'fieldRate', 'seatSymmetry']) {
    ok(caNames.indexOf(nm) >= 0 && pcNames.indexOf(nm) >= 0, nm + ' 必须由两个工具**各自从库里**导入（共享的那一份才是真源）');
  }
  for (const f of ['function fieldRate', 'function selfPlay', 'function loadChamp']) {
    ok(ca.indexOf(f) < 0, 'champ-audit 不得再自带 ' + f + '（两处各写一遍必漂移）');
    ok(pc.indexOf(f) < 0, 'promote-champion 不得再自带 ' + f);
  }
  ok(/process\.exit\(6\)/.test(pc), 'promote-champion 必须在体检不过时中止（exit 6），而不是只 warn');
  ok(pc.indexOf('--force') >= 0, '必须提供显式 --force 才能越过阻断');
  ok(pc.indexOf('auditForced') >= 0 && pc.indexOf('auditFails') >= 0, '越过阻断必须在 meta 里留痕（auditFails/auditForced）');
  for (const k of ['selfPlayEffSkills', 'passiveStanceRate', 'activeAttackRate']) {
    ok(pc.indexOf(k) >= 0, 'meta 必须记下 ' + k + '（否则"当年怎么过门的"又不可查）');
  }
});

t('D49 探索期不得被健康门槛惩罚（否则强迫会堵死整条提升链：实测逃逸率 1/6）', function () {
  /* 实测（v1.5.40/41）：格内强迫出来的小雷降低成员形状分/体检 ⇒ 提升被拒 ⇒ 冠军冻回种子。
   * 修法：探索期（强迫窗口内）跳过健康判定与 healthOk 过滤；**窗口外必须照旧**。 */
  const evo = readFileSync('js/train/evo.js', 'utf8');
  ok(evo.indexOf('let IN_EXPLORE = false;') >= 0, '必须有探索期标志');
  ok(evo.indexOf('IN_EXPLORE = _fe > 0;') >= 0, '标志必须由 scoreMemberN 按当前代更新');
  ok(evo.indexOf('if (better && HEALTH.on && !IN_EXPLORE)') >= 0, '提升闸门必须在探索期内跳过健康判定');
  ok(evo.indexOf('const mh = (HEALTH.on && !IN_EXPLORE) ? mirrorHealth') >= 0, '选择过滤在探索期内也必须不评健康');
  ok(evo.indexOf('const hf = healthFails(mh);') >= 0, '窗口外的健康判定链必须完整保留（healthFails(mh)）');
  ok(evo.indexOf('mirrorHealth(cand.params') >= 0, '非探索期的提升健康判定必须仍在');
});


t('D60 场B 判据只认清场数，胜率是规则红利（复核 §2-1）', function () {
  /* 背景：v1.5.65 的 multi 终局收缩 + 全灭按累计伤害判胜 ⇒ "打 1 点就赢"。线上包场B 严格胜率
   * 100%，而清场 0.00/局、伤害 1.0/局 ⇒ 用胜率当门槛等于白送。 */
  const base = {
    seat: { verdict: 'ok', spread: 10, decisiveRate: 0.6, pct: [22, 20, 19, 21, 18] },
    G: { effSkills: 4.0, distinctKeys: 11 }, wall: { dmgPerGame: 3.0, pierceLand: 100 },
    aggr: { fieldA: { atk: 0.3, dealtPerGame: 5 }, fieldB: { clearedPerGame: 1.0, winRate: 0.0 } }
  };
  /* ① 反向反证：真的在清场（清场 1.0/局）即使胜率 0% 也必须**过** —— 证明判据不是胜率。 */
  const okCase = feasibilityOf(base);
  ok(okCase.fails.length === 0, '清场 1.0/局、胜率 0% 必须判可行（实测 fails=' + JSON.stringify(okCase.fails) + '）');
  /* ② 正向反证：胜率 100% + 清场 0 ⇒ 必须**拒**，且文案说的是清场、不能出现"胜率"。 */
  const windfall = JSON.parse(JSON.stringify(base));
  windfall.aggr.fieldB = { clearedPerGame: 0.0, winRate: 1.0 };
  const bad = feasibilityOf(windfall);
  ok(bad.fails.length === 1, '只有场B 崩掉时应当恰好一条失败（实测 ' + JSON.stringify(bad.fails) + '）');
  ok(bad.fails[0].indexOf('清场') >= 0, '失败文案必须是"清场"（实测：' + bad.fails[0] + '）');
  ok(bad.fails[0].indexOf('胜率') < 0, '场B 失败文案里不得出现"胜率"（那是规则红利）');
  /* ③ 胜率仍然**记录**（可查），但不参与判定 */
  eq(bad.fieldBWinRate, 1, 'fieldBWinRate 必须照实记录');
  eq(bad.fieldBClears, 0, 'fieldBClears 必须照实记录');
});


t('D62 座位判据的样本量守卫：小样本必须报"不知道"，不得当"均衡"（复核 §2-3）', function () {
  const lib = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(lib.indexOf("'underpowered'") >= 0, '必须存在第三态 underpowered（小样本=不知道）');
  /* v1.7.76（千问夜班 · DS §五 T1 ③→②）：这条原来钉的是 `/MIN_N_SPREAD = 50/` —— 一个**常数文本**。
   * 它管不到真正的病：把门槛挪到 `G < 1`、或把判定顺序换到 `biased` 之后，`MIN_N_SPREAD = 50` 这行**照在**、门照绿。
   * 改成两格**真跑**（夹具 = 在册 FIXTURE_PACK，种子固定 ⇒ 确定性；实测成本 72ms + 465ms）：
   *   ① G=6（<门槛）verdict 必须是 underpowered —— 守卫真的在挡；
   *   ② G=50（=门槛）verdict 必须**不再**是 underpowered —— 它是门槛不是一票否决，否则①恒真。
   * 牙口（`s73-d62-teeth.mjs` 实测）：把 `MIN_N_SPREAD` 从 50 改成 1 ⇒ ①当场红；改成 500 ⇒ ②当场红。 */
  const W62 = AUDIT.sandbox(AUDIT.ROOT);
  const p62 = AUDIT.loadChamp(W62, FIXTURE_PACK, AUDIT.ROOT);
  ok(!!p62 && p62.length > 0, '夹具包必须读得出参数（读不出 = 这两格什么都没判，不许当干净）：' + FIXTURE_PACK);
  const r6a = AUDIT.seatSymmetry(W62, p62, 'multi', 6);
  const r6b = AUDIT.seatSymmetry(W62, p62, 'multi', 50);
  ok(r6a && r6a.verdict === 'underpowered',
    'G=6（低于门槛）必须报"不知道"，实测 verdict=' + (r6a || {}).verdict + ' basis=' + (r6a || {}).basis);
  ok(r6b && r6b.verdict !== 'underpowered',
    'G=50（达到门槛）不得继续报"不知道"（否则上一条恒真），实测 verdict=' + (r6b || {}).verdict + ' basis=' + (r6b || {}).basis);
  eq(r6a.minNForSpread, r6b.minNForSpread, '两格读到的必须是同一个门槛值（不许两处各写一份）');
  ok(/SHARE_BIAS = 70/.test(lib), '占比判据必须是"某座 ≥70%"（对称假设下 ~0.2%，任意 n 稳健）');
  /* 行为反证：underpowered 不许判 fail，但必须留 note；biased/missing 必须判 fail。
   * 注意**必须给全四道探针**：缺值本身是另一条失败（见 D61 的"探针缺失"断言）。 */
  const full = { G: { effSkills: 4.0 }, wall: { dmgPerGame: 3.0 }, aggr: { fieldA: { atk: 0.3 }, fieldB: { clearedPerGame: 1.0 } } };
  const up = feasibilityOf(Object.assign({}, full, { seat: { verdict: 'underpowered', basis: 'n=6<50', pct: [40, 30, 15, 10, 5] } }));
  eq(up.fails.length, 0, 'underpowered 不得作为失败条件（否则小样本噪声会挡住所有候选）');
  ok(up.notes.length >= 1 && up.notes[0].indexOf('未判定') >= 0, 'underpowered 必须留下"未判定"的 note（不得沉默）');
  const bi = feasibilityOf(Object.assign({}, full, { seat: { verdict: 'biased', basis: '某座≥70%', pct: [90, 10, 0, 0, 0], spread: 90, decisiveRate: 0.5 } }));
  ok(bi.fails.length >= 1 && bi.fails[0].indexOf('座位') >= 0, 'biased 必须判 fail（实测 ' + JSON.stringify(bi.fails) + '）');
  const noSeat = feasibilityOf({ G: { effSkills: 4.0 }, wall: { dmgPerGame: 3.0 }, aggr: { fieldA: { atk: 0.3 }, fieldB: { clearedPerGame: 1.0 } } });
  eq(noSeat.fails.length, 1, '座位探针整个缺失必须判 fail（不许当"均衡"）');
  ok(noSeat.fails[0].indexOf('座位') >= 0, '缺座位探针的失败文案必须点名"座位"（实测：' + noSeat.fails[0] + '）');
});


/* ===== v1.5.71（第五轮复核 §4-1）：会瞄人的对手 =====
 * 复核的反向验证把病根钉死了：给 4 席对手加一条"谁用狙击就瞄谁"的规则 ⇒ 候选 v17-146 夺冠 30% → 0%。
 * 也就是说池子里**没有任何对手会瞄人**（脚本走 pickTargetN = 击杀优先 → 血量最高，满血不出头的狙击手
 * 永远进不了任何人的候选集）。这条用例盯三件事：① 它真的指威胁；② 目标**不被引擎剥掉**（否则退化成
 * 又一个 pickTargetN ⇒ 整批实验白跑）；③ 无威胁时攒钱（它是惩罚者，不是又一个乱打的激进派）。 */
/* 〔撤编 2026-11-19〕原 D73 落盘阻断开关（train-server 已删） —— 主语（v7 训练器）已删，见 docs/GATE-SHIFTS.md */

t('D105 V4「满桌同包」必须有地板（v1.5.132 立门；**阈值是草案、待用户裁定**）· V2 记录不阻断（09-21 晨回滚，理由见 ③）', function () {
  /* 动机（两条独立证据，都出自 v1.5.131）：
   *  ① R61 改引擎后，线上 3P 包（权重是在旧语义下训的）在 V4/V2 上掉了 1.1pt / **24.7pt**，
   *     而**这两条轴当时没有任何门** ⇒ 静默丢了两个版本（CHANGELOG v1.5.131 §4/§5、HANDOFF §4-11/§4-12）。
   *  ② 同引擎跑一条 6 seed 臂：V4 落在 **1.8~15.0%/席** ⇒ "臂把包送到哪里就是哪里"。
   * 量什么（用户已否掉"数动作投向谁" ⇒ 量**后果**）：**V4 每席位胜率** = 产品形态（满桌同包、会不会跟自己人互杀）；
   *  公平份额 **20%/席**。口径与 `tools/probe-ring-ablate.mjs` **共用同一份实现**（`tools/v2v4-lib.mjs`），n=600、seed 7777。
   * ⚠️ **阈值与标定理由写在一起**（v1.5.104 给 G4 立 45%→60% 时定的规矩）。标定证据（本次实跑 · n=600 · 同 seed）：
   *   线上包 **V4 16.1%/席**；**零权重常数策略 V4 3.4%/席**（阳性对照）；6 个臂包 1.8 / 5.1 / 2.5 / 5.8 / 15.0 / 4.0。
   *   ⇒ 草案 **V4 ≥ 10%/席**：现包余量 6.1pt、零权重 3.4 被挡、**6 个臂里 5 个跌破** ⇒ 判别力够。
   *   **阈值是草案，等用户裁定**；改它只需改下面的 `V4_MIN`（判词会自动跟上）。
   * ⚠️⚠️ **V2 为什么只记录不阻断**（v1.5.132 实测；09-20 夜曾升级成 15% 阈值门，**09-21 晨已回滚**——
   *   回滚理由见下面 ③ 的两晚标定账：整条 V2 轴会随引擎语义平移 ~6pt，绝对阈值跨指纹代不稳定），
   *   本段留作背景：**零权重常数策略在 V2 上拿到 10.2%，
   *   与线上冠军的 10.0% 一模一样** ⇒ 这条轴对"包好不好"**没有判别力**（任何阈值都会被垃圾满足）。
   *   但它作为**历史坐标**仍有意义：R61 之前同一个包在 V2 上是 **34.7%** ⇒ 那次引擎改动把它**从"明显高于
   *   什么都不做"打到了"就是什么都不做"**。⇒ 想让它重新有判别力，得先让"什么都不做"显著低于"好包"，
   *   那是**另一件工作**（不是加个阈值就能解决的）。 */
  const V4_MIN = 10;
  /* V2 阳性对照线（**不是**现役包阈值 —— 见 ③ 的两次标定账）。 */
  const V2_LINE = 12;
  const G = 600, SEED = 7777;
  const DEP = { S: S, Play: Play, T: T, R: R, B: Bots };
  /* 10-23 夜班（用户口径「上线后的门只测引擎是否正常工作；冠军有什么表现归入池时判」）：
   *   被测对象从**活槽 `sb.window.EPIRUS_CHAMPION_3P`** 换成**在册冻结夹具** `FIXTURE_PACK` ——
   *   本门留下的三条全是**仪器判据**（"量具给得出有限数"、"零权重常数策略必须落在地板下"、"学过的那一侧必须高过空白"），
   *   它们需要一个"已知好"的样本，但**不必是现任包**（现任在训练期间会被改写 ⇒ 旧写法有训练日误红，同 D58/D59）。
   *   删掉的那条是 `ok(o.V4 >= V4_MIN)` ——「现任包满桌同包互杀时每席 ≥10%」是产品读数，现在没人判（见本文件末尾与 OVERNIGHT 台账）。 */
  const params = loadChampParams(Pol, FIXTURE_PACK);
  ok(!!params, '夹具必须能解包（否则本门没有测量对象）');
  const meas = function (pp) {
    const m = measureAll(DEP, pp, { games: G, seed: SEED, countKey: null, ablate: false });
    return { V1: m.V1.rate, V2: m.V2.rate, V4: m.V4.rate };
  };
  const o = meas(params);
  const zero = new Float64Array(Pol.paramCount());     // 什么都不学的常数策略 = 本门的"地板参考"
  const z = meas(zero);
  ok(isFinite(o.V4) && isFinite(o.V2) && isFinite(z.V4), '量具必须给出有限数（V4=' + o.V4 + ' V2=' + o.V2 + '）');
  /* ① **仪器必须能看见"坏"**（阳性对照；同族做法见 `probe-ring-ablate` 的"禁一张高频卡必须掉分"）：
   *    零权重策略必须**落在地板下** —— 否则本门的绿是"量具死了"，不是"包好"。 */
  ok(z.V4 < V4_MIN, '阳性对照：零权重常数策略的 V4 必须低于 ' + V4_MIN + '%（实测 **' + z.V4.toFixed(1) +
    '%**）⇒ 否则这条门只是"量具死了"');
  /* ② 判别力的另一侧：**学过的那一坨权重必须高过空白**（相对口径，不赌任何人的绝对读数） */
  ok(o.V4 > z.V4, '夹具（学过）的 V4 必须高于零权重策略（' + o.V4.toFixed(1) + '% vs ' + z.V4.toFixed(1) + '%）⇒ 相等即量具无判别力');
  /* ③ V2：**记录不阻断**（昨夜一度升级成 15% 阈值门，今晨用实测证据回滚 —— 下面是两晚的完整标定账）。
   *    · 旧引擎 72a9c1b5（昨夜）：零 10.2 / 前任 10.0 / 现役 21.2 ⇒ 判"有判别力"、立 V2≥15 草案；
   *    · 新引擎 56402bbf（今晨指向盲三修后同口径复测）：零 **7.7** / 现役 **13.7** / v7n1-31 13.8 /
   *      v7s9-82 15.7 / v7press3-91 4.3 ⇒ **整条轴随引擎语义平移 ~6pt**（saltPick 兜底本身改了选目标），
   *      15 那条线当场把合法在位包挡红。
   *    ⇒ 结论：判别力是真的（零与好包的**相对**差稳定在 ~6pt），但**绝对值阈值跨指纹代无效**。
   *      本门保留"阳性对照"（零权重必须 < V2_LINE=12 ⇒ 量具没死），现役读数只记录不阻断；
   *      若要立门应改用**相对口径**（如 现役 ≥ 零+5）——那是要用户裁定的事，不偷跑。 */
  ok(z.V2 < V2_LINE, '阳性对照：零权重常数策略的 V2 必须低于 ' + V2_LINE + '%（实测 **' + z.V2.toFixed(1) +
    '%**）⇒ 否则 V2 这条轴又是"量具死了"');
  console.log('  [记录] V2 现役 ' + o.V2.toFixed(1) + '% vs 零权重 ' + z.V2.toFixed(1) + '%（差 ' +
    (o.V2 - z.V2).toFixed(1) + 'pt；绝对阈值跨指纹代不稳定 ⇒ 见 RESEARCH-LOG §25 的裁定件）');
  /* ④ 单一来源：装配只许有一份（本仓"同一规则两处维护必然漂移"栽过四次）。 */
  const pb = readFileSync('tools/probe-ring-ablate.mjs', 'utf8');
  ok(pb.indexOf("from './v2v4-lib.mjs'") >= 0, '探针必须从 v2v4-lib.mjs 导入装配（不许自己再写一份）');
  ok(pb.indexOf('pickBalanced') < 0, ' 且探针里不许再出现对手名清单（它是装配定义的一部分）');
});

/* 〔撤编 2026-11-19〕原 D124 当选面 3P 第二栏（train-best 已删） —— 主语（v7 训练器）已删，见 docs/GATE-SHIFTS.md */

/* 〔撤编 2026-11-19〕原 D125 样本量单一来源（train-best/server 已删） —— 主语（v7 训练器）已删，见 docs/GATE-SHIFTS.md */

t('D141 破龟群栏（v1.5.195）：`归因伤害/局` 与 `终场存活` 必须存在、必须与 `resolve.js` 的判胜口径同源、且**不是恒 0 的死读数**', function () {
  /* 病（今晚量出来的）：`--field=guardwall` 的 1st 是**下限判据** —— 那格 4 席不还手 ⇒ 全员被终局收缩清场 ⇒
   * 判胜走 `resolve.js` 的 `alive.length === 0` 分支 = "累计**有归因**伤害最高者胜"。
   * 于是"破防 100%"只等价于"至少蹭到一发"，实测同为 100% 的两粒包幅值差 4 倍（2.17 vs 8.77 点/局）。
   * ⇒ 光有胜率会把"蹭一发"和"凿穿"排进同一档 ⇒ 必须并读幅值。这条门钉三件事：
   *   ① 两个新读数存在；② 归因口径与引擎判胜口径**同一个表达式**（不许自己抄一份 `source != null`）；
   *   ③ 读数**会动**（同一只包在头对头场 > 0 ⇒ 那个 0 不是死读数）—— 防"死读数当结论"（seam 2 那一族）。
   *   ⚠ 10-23：原样还钉着"③ 现役在破龟群场 = 0"，那一格是**冠军行为**（产品事实），已按用户口径删掉（见本门下面那段 §删 注释）。 */
  const p = readFileSync('tools/probe-kill-reward.mjs', 'utf8');
  ok(/if \(e\.type === 'damage' && e\.source != null && dsum\[e\.source\] != null\) dsum\[e\.source\] \+= e\.amt;/.test(p),
    '受评席伤害累计必须按 `damage` 事件 + `e.source != null` 累加 —— 与 `resolve.js` 全灭判胜的表达式同形（换槽径）');
  ok(/deal: deal \/ games, alive: aliveEnd \/ games,/.test(p) && /if \(r\.state\.p\[seat\]\.hp > 0\) aliveEnd\+\+;/.test(p),
    '两栏都必须真累加并归一（`终场存活`判据 = 终场血量 > 0，**不是**"局长 < 回合上限"：那格是被收缩清场的，人人都会"提前"）');
  const run = spawnSync(process.execPath, ['tools/probe-kill-reward.mjs', '--games=40',
    /* v1.8.14（NEXT 里那条"活槽当载体"）：原来这两枚载体是 `js/bundled-champion-3p.js`（**活槽**）——
     *   训练期间 bundle 会被备份/改写（本仓 `D16` 自己记着），于是这条门在训练日会拿着"今天盘上那枚"试一遍 ⇒ 误红与包名无关。
     *   换成两枚 tracked 夹具：受评 = `FIXTURE_PACK`（win-Ldemo），对手 = `v7f5t-31.bak` ⇒ 真头对头（两侧不同包），且输入在干净克隆里读得到。
     *   实测：同一枚夹具在 `guardwall` 场 `deal=0`、在 `vs` 场 `deal=1` ⇒ 这条"读数会动"的腿换夹具后**照样有判别力**（比原先更强：同一只包、两个场、一个 0 一个非 0）。 */
    '--fields=guardwall,vs', '--opp=docs/artifacts/v7f5t-31.bak', '--rules=0', '--json', '--packs=' + FIXTURE_PACK],
    { encoding: 'utf8', timeout: 900000 });
  eq(run.status, 0, '实验台要跑得通（' + String(run.stderr || '').slice(0, 160) + '）');
  const out = String(run.stdout || '');
  const j = JSON.parse(out.slice(out.lastIndexOf('{"games"')));
  /* 载体不再按包名过滤（改名/搬家就不必回来改这里），改成**按"输入几枚包就该出几行"判**：
     少一行 = 有一枚包被静默跳过（那正是 `gate-landscape` 的 `(缺文件)` 那一族）。 */
  const cell = function (f) {
    const rows = j.rows.filter(function (r) { return r.field === f; });
    eq(rows.length, 1, '场 `' + f + '` 应当恰好一行（实测 ' + rows.length + ' 行 ‖ 传入 --packs=' + FIXTURE_PACK + '）⇒ 行数不对就别读它的数');
    return rows[0];
  };
  const wall = cell('guardwall'), vs = cell('vs');
  ok(wall && vs, '必须有"破龟群 × 夹具包"和"头对头 × 夹具包"两格');
  eq(typeof wall.by[0].deal, 'number', '`归因伤害/局` 必须进 JSON 读数（不印出来的读数下次没人信）');
  eq(typeof wall.by[0].alive, 'number', '`终场存活` 必须进 JSON 读数');
  /* §删（10-23 夜班 · 用户口径「冠军有什么表现归入池时判，上线后的门只测引擎是否正常工作」）：
   *   原来这里有两条 `eq(wall.by[0].deal, 0)` 与 `eq(wall.by[0].alive, 0)` ——
   *   主语是"**现任包在破龟群场一发都打不出伤害、一局都没活着收场**"（一条产品事实，§N37 那三复现的那格）。
   *   ⇒ 少掉的覆盖：**这一格现任包的具体行为今天没人判**。入池侧确实没有"破龟群"这一轴
   *     （`feasibilityOf` 只有反弹墙 `pickReflectSpam`（audit-lib.mjs:238-263）与场B 清场，没有 `pickGuardSpam` 那格）。
   *   ⇒ 若要把这维找回来，正解是**加进入池侧**（给候选包量 `guardwall` 场的 归因伤害/局 与 终场存活，
   *     并像 §31 那样先标定"已知好 vs 已知坏"两侧才许阻断），不是留一条每次 CI 都拿现任包试一遍的上线门。
   *   下面那条 `vs.by[0].deal > 0` **保留**：它判的是"读数会动"（防"死读数当结论"，seam 2 那一族），属仪器判别力。 */
  ok(vs.by[0].deal > 0, '同一只包在头对头场必须有非 0 归因伤害（否则 0 是"死读数"而不是"那格打不穿"）；实测 ' + vs.by[0].deal);
  ok(/归因伤害\/局.*终场存活/.test(out), '表头必须印出这两栏（读表人看得见才知道不能只看 1st）');
});

/* 〔撤编 2026-11-19〕原 D121 退化闸三处对齐（train-3p 臂已删） —— 主语（v7 训练器）已删，见 docs/GATE-SHIFTS.md */

t('D145 座位极差线必须随 n 标定（v1.5.202）：固定 30pt 线在 n=400 会**放走**真偏置包（26.6pt）—— 而座位事故在本仓真实发生过', function () {
  /* 历史实测（np-test D59 注释的收敛表 + `docs/research/reviews/REVIEW-3P.md:29`）：
   *   `v7new5_005-31`（v1.5.114 用 --force 换掉的那只）在 n=60 读 **43.2pt**、n=400 读 **26.6pt**；
   *   另一只破防脚本三座 1st 率 **73.5 / 14.5 / 0.0**（极差 73.5pt）。
   * 而 v1.5.69 修的正是"**座位惩罚从未触发**（我自己的错）"⇒ 这条线**复发过**，用户明确要求保留。
   * 旧口径 = 固定 30pt ⇒ 在 n=400 上 26.6 < 30，**放它过去**；同时 30pt 又坐在零分布的最大值上（n=100 的 max=30.0，2 万次）。
   * 新口径 = **该 n 下均匀零分布的分位**（种子固定 ⇒ 可复现）。这不是放宽/收紧阈值，而是让阈值跟着样本量走。 */
  const line100 = nullSpreadQuantile(100, 5, 0.99), line400 = nullSpreadQuantile(400, 5, 0.99);
  ok(line100 > 15 && line100 < 28, 'n=100 的线必须落在标定锚点附近（实测 20~21pt，本机 ' + line100.toFixed(1) + '）');
  ok(line400 > 8 && line400 < 14, 'n=400 的线必须落在标定锚点附近（实测 10.3pt，本机 ' + line400.toFixed(1) + '）');
  ok(line400 < line100, '线必须随 n 单调下降（n 越大，真偏置的读数与噪声同比缩小）');
  /* 判定演练：历史上真实出现过的三个读数都必须被抓住 */
  for (const c of [[60, 43.2], [100, 38], [400, 26.6], [100, 73.5]]) {
    ok(c[1] >= nullSpreadQuantile(c[0], 5, 0.99), '历史的偏置读数必须被抓住：n=' + c[0] + ' 极差 ' + c[1] + 'pt（线 ' + nullSpreadQuantile(c[0], 5, 0.99).toFixed(1) + '）');
  }
  /* 标定锚点：11.6 / 6.5 是 **v7cmin4-31（v1.5.144 上槽那任，早已不在位）** 的历史读数 ⇒ 这里用它当"真没偏置的包"那一侧的样本，
   *   不是声称它现役（10-22 改注：线上 3P 自 v1.6.62 起是 `T8-s114`；写"现役"会让人以为这条线是照着现任标的）。 */
  ok(11.6 < line100 && 6.5 < line400, '历史参照 v7cmin4-31（n=100 读 11.6、n=400 读 6.5）必须有约 2 倍余量地通过');
  const al = readFileSync('tools/audit-lib.mjs', 'utf8');
  ok(al.indexOf('spread >= 30') < 0 && al.indexOf('spreadLine') >= 0, '极差判定必须走 spreadLine（不许回到裸的 30）');
});

t('D169 闭环判据的**分形态版**必须只在"贵卡真出手且余珠不多"时才算闭环，且**默认不启用**（v1.5.256 · §15 实测）', function () {
  /* 病（5 种子实测 · 日志 §15）：`isClosed`（得珠≥100 且 花珠率≥0.5）把两种**不同病因**判成同一个 ✗ ——
   *   ① 攒着不花（seed31：得珠 402、花珠率 9.2%）② 根本没有经济（seed71/191：得珠 0）；
   * 而"大雷>0"与"花珠率≥0.5"两点集不相交，skill report 又说大雷值 +4.9~7.7pt
   *   ⇒ 旧线在惩罚"会用贵卡"。分形态版以"**钱有没有出口**"为实质。
   * 本门两侧都钉：**该收的形态必须收**、**不该收的假对冲必须拒**，并且**默认路径不许被换掉**。 */
  const rows = {
    hoardWithBig: { gained: 402, spentRate: 0.092, bigCardPerGame: 2.92, leftoverPerGame: 5.0 },   // seed31 形状 ⇒ 该收
    noEconomy: { gained: 0, spentRate: 0, bigCardPerGame: 1.7, leftoverPerGame: 0 },               // 没经济 ⇒ 拒
    spender: { gained: 290, spentRate: 0.886, bigCardPerGame: 2.5, leftoverPerGame: 1 },           // 花得动 ⇒ 收
    fakeHedge: { gained: 402, spentRate: 0.09, bigCardPerGame: 0.3, leftoverPerGame: 30 }          // 攒着且贵卡不出 ⇒ 拒
  };
  ok(AUDIT && PF_FRONT.isClosedShaped, '`isClosedShaped` 必须从 pool-frontier-lib 导出');
  eq(PF_FRONT.isClosed(rows.hoardWithBig, 0.5, 100), false, '（前提自检）旧判据对"攒着不花"确实判 ✘ —— 这条门才有意义');
  eq(PF_FRONT.isClosedShaped(rows.hoardWithBig, 0.5, 100), true,
    '攒着但**贵卡真出手**且余珠不多 ⇒ 分形态版必须判闭环（这正是被旧线误杀的形态）');
  eq(PF_FRONT.isClosedShaped(rows.spender, 0.5, 100), true, '花得动 ⇒ 两种判据都要收（不许把旧的正确判定弄丢）');
  eq(PF_FRONT.isClosedShaped(rows.noEconomy, 0.5, 100), false, '得珠 0（根本没经济）⇒ 拒（"挣到"这条是前提）');
  eq(PF_FRONT.isClosedShaped(rows.fakeHedge, 0.5, 100), false,
    '攒着不花且贵卡也不出手 ⇒ 必须拒（余珠门槛就是防"假对冲"把这条线刷松）');
  eq(PF_FRONT.isClosedShaped({ gained: 402, spentRate: 0.09, bigCardPerGame: NaN, leftoverPerGame: NaN }, 0.5, 100), false,
    '【fail-closed】读数缺失 ⇒ 判**不闭环**（不许因为读不到就当通过，与 `isRobust` 同规矩）');
  ok(Number.isFinite(PF_FRONT.CARD_BUDGET.bigCardMin) && Number.isFinite(PF_FRONT.CARD_BUDGET.leftoverMax),
    '阈值必须是**具名单一来源**（`CARD_BUDGET`），不许散在调用点里');
  /* 【默认不启用】当前调用路径必须仍是旧判据 —— 判据变更属用户裁定，不许代码偷偷换 */
  const pfSrc = readFileSync('tools/probe-pool-frontier.mjs', 'utf8');
  ok(!/isClosedShaped/.test(pfSrc), 'probe-pool-frontier **不许**已经改用分形态版：切换要用户点头、并留痕（本门就是那句"留痕"）');
  ok(/isClosed\(m, BEAD, GAINED\)/.test(pfSrc), 'probe-pool-frontier 当前必须仍走 `isClosed`');
  /* ===== 【本条是"先量再切"的产物】分形态版**被实测反例否掉**，所以不能照那个设计切 =====
   * 用户裁定"切、用占位阈值"之后，我在**切之前**把两个新读数在真包上量了一遍（5 粒 · 同一把尺 · 40 局账）：
   *   · 得珠/局：现役 6.8 · 713 2.5 · Ldemo 4.2 · **Lctl(seed31) 10.1** · s111 7.3
   *   · **过期/局**：现役 0.9 · 713 0.4 · Ldemo 1.6 · **Lctl 9.1** · s111 0.7   ← Lctl 的珠子是**过期烂掉**，不是花掉
   *   · **贵卡/局**：现役 3.81 · 713 3.55 · Ldemo 4.20 · Lctl 5.58 · s111 4.46  ← 全落在 3.55~5.58 ⇒ **没有判别力**
   * ⇒ 照分形态版：`Lctl`（花珠率 9.2% · 过期 9.1/局）会被判 **✔** —— 等于把"珠子经济烂掉"的粒**洗白**。
   * ⇒ 正确读法：这不是"闭环在惩罚正确行为"，而是**两套货币各自崩**（贵卡/大雷花的是 ep；珠子是另一种资源）。
   * ⇒ 处置：**不切**（保留 `isClosed`），把这条反例钉在这里：以后谁要切，必须先面对这组数。 */
  const LCTL = { gained: 404, spentRate: 0.092, bigCardPerGame: 5.58, leftoverPerGame: 0.05 };
  eq(PF_FRONT.isClosed(LCTL, 0.5, 100), false,
    '【实测反例】Lctl 的珠子经济（花珠率 9.2% · 过期 9.1/局）必须被判 ✘ —— 旧判据在这件事上是对的');
  /* §删（10-23 夜班）：原来这里还有一条 `ok(/洗白/.test(readFileSync('tools/pool-frontier-lib.mjs','utf8')), '文档必须留痕这条反例')`
   *   —— 它钉的是**另一份文件里的注释用词**，属 DS 自己在 v1.7.162 立的规矩里明令禁止的那一族
   *   （"以后理由写在文档/CHANGELOG，不许再靠门钉注释"；反文案钉同禁）。
   *   留痕本身还在（`tools/pool-frontier-lib.mjs:53` 那句"把烂的洗白"），只是不再由门守——
   *   真正判住这个决定的上一条腿（`Lctl` 必须判 ✘ 的实测反例）没动。 */
});

t('D228 §E322 当选键的多评估种子（v1.6.7）：步长不许让两粒 base 的局 seed 重叠 · 单粒必须逐字等于旧算式 · 非法粒数要响亮 · 分差 vs 噪声必须印出来（而 `=1` 那一档不许自证清白）· 两条入口都真在用它', function () {
  /* ===== ① seedBase 的取法本身是量具的一部分 =====
   * `evalN` 内部每局 seed = `seedBase + g*977 + total`（g < 20、total < 720）⇒ 一粒 base 占掉约 20,260 个整数。
   * 步长小于这个跨度 ⇒ 两粒 base 会**共用局 seed**，"多打几枪"就退化成"同一枪多印几遍"（噪声不会降）。 */
  eq(selBases(1)[0], 987654, '① 第 1 粒必须就是现状那一粒 987654（否则 `=1` 不是"回到旧行为"而是换了台仪器）');
  eq(SEL_BASE0, 987654, '① 常量本身也必须还是 987654（上面那条才不是自证）');
  eq(selBase(2), 1187654, '① 第 3 粒 = 987654 + 2×100000');
  const span = 19 * 977 + 719;                       // evalN 单粒 base 实际占用的 seed 跨度上界
  ok(SEL_STRIDE > span, '① 步长 ' + SEL_STRIDE + ' 必须 > 单粒 seed 跨度 ' + span + ' ⇒ 否则两粒 base 的局集合会重叠');
  eq(selBases(4).join(','), [0, 1, 2, 3].map(i => 987654 + i * SEL_STRIDE).join(','), '① 四粒 base 的序列');
  eq(new Set(selBases(8)).size, 8, '① 八粒必须互不相同');

  /* ===== ② 单粒必须逐字等于旧算式（这是"默认改了、但退路是真的"的唯一凭据） ===== */
  const one = { firstRate: 0.4, top2Rate: 0.7, first: 40, second: 30, third: 30, games: 100 };
  const s1 = scoreRuns([one]);
  eq(s1.sc, one.firstRate + 0.5 * one.top2Rate, '② n=1 时 sc 必须等于旧算式 firstRate + 0.5·top2Rate');
  eq(s1.spreadPt, 0, '② 单粒的自身极差必须是 0（不是 undefined，日志要印它）');
  eq(s1.games, 100, '② 计数要透传（报告行 "1st/2nd/3rd = a/b/c of N" 的分母必须与均值同源）');

  /* ===== ③ 均值与极差：喂一张已知答案的合成表 ===== */
  const runs = [
    { firstRate: 0.50, top2Rate: 0.70, first: 50, second: 20, third: 30, games: 100 },   // sc = 0.85
    { firstRate: 0.40, top2Rate: 0.70, first: 40, second: 30, third: 30, games: 100 },   // sc = 0.75
    { firstRate: 0.55, top2Rate: 0.70, first: 55, second: 20, third: 25, games: 100 }    // sc = 0.90
  ];
  const s3 = scoreRuns(runs);
  eq(Math.round(s3.sc * 1e6), Math.round(((0.85 + 0.75 + 0.90) / 3) * 1e6), '③ 三粒均值 sc');
  eq(Math.round(s3.spreadPt * 1e6), 15000000, '③ 极差必须按 sc 算且**已经乘过 100**（0.90−0.75 = 15pt，不是 0.15；日志里印的就是 pt）');
  eq(s3.games, 300, '③ 局数要累计');
  eq(scoreRuns([]).n, 0, '③ 空表 ⇒ n=0 且不炸（旧写法在这里会 Math.max.apply(null,[]) = −Infinity）');
  ok(isFinite(scoreRuns([one, null]).sc), '③ runs 里混进 null 必须被滤掉，不许把 sc 变成 NaN');

  /* ===== ④ 非法粒数要响亮，不许静默回落成"看起来像默认" ===== */
  eq(parseSelSeeds('0').bad, '0', '④ 0 粒必须报非法（它是"什么都不测"，不是"最省的一档"）');
  eq(parseSelSeeds('9').bad, '9', '④ 超过 8 粒必须报非法（默认档的代价是按 4 粒算的，翻倍就是翻倍时间）');
  eq(parseSelSeeds('2.5').bad, '2.5', '④ 非整数必须报非法');
  eq(parseSelSeeds('3').k, 3, '④ 合法值照收');
  eq(parseSelSeeds(undefined).k, SEL_SEEDS_DEFAULT, '④ 不设 ⇒ 默认 ' + SEL_SEEDS_DEFAULT + ' 粒');
  eq(parseSelSeeds(undefined).bad, null, '④ 默认路径不算"回落"（回落必须只属于"你给了个坏值"）');

  /* ===== ⑤ 分差 vs 噪声：这条是 §E318 的直接修法（链上从不印这个关系） ===== */
  const mk = function (sc, spread, n) { return { score: sc, ev: { spreadPt: spread, n: n === undefined ? 4 : n } }; };
  ok(/同分带内|抽签/.test(selGapNote([mk(0.90, 8), mk(0.89, 7)])), '⑤ 分差 1pt ≤ 同分带（k=4 ⇒ 5.8pt，v1.7.103 起按 k 查表）⇒ 必须判"基本是抽签"');
  /* v1.7.103：带改成**按 k 查表**（k=4 ⇒ 5.8pt、k=8 ⇒ 2.9pt）⇒ 这条腿的夹具要**显式给 k** 才能隔离它想测的那一支：
   *   n=8 时带 2.9pt < 分差 4pt ≤ 自身极差 9pt ⇒ 正好落在「方向可信、幅度判不动」。
   *   （原来用默认 n=4（带 5.8pt），4pt 会先落进「抽签」那一支 ⇒ 那是**带变准之后正确的新行为**，不是回归。） */
  ok(/幅度判不动/.test(selGapNote([mk(0.90, 9, 8), mk(0.86, 8, 8)])), '⑤ 分差 4pt > 同分带 2.9pt(k=8)、≤ 自身极差 9pt ⇒ 必须判"方向可信、幅度判不动"');
  ok(/判得动/.test(selGapNote([mk(0.90, 2), mk(0.70, 2)])), '⑤ 分差 20pt ≫ 极差 ⇒ 才许判"判得动"');
  ok(/同分带 2\.9/.test(selGapNote([mk(0.90, 0, 8), mk(0.86, 0, 8)])), '⑤ **带必须跟着 k 走**（k=8 ⇒ 2.9pt；写死 3.0 就红）—— 这是 v1.7.103「带按 k 查表」的牙');
  ok(/不足 2 粒/.test(selGapNote([mk(0.9, 1)])), '⑤ 只有一粒候选时不许编造分差');
  /* 退路那一档（`=1`）最容易说谎：一粒种子时极差**恒等于 0**，那是"没量过"而不是"噪声是 0"。
   * 拿 0 去比分差会印出"判得动" ⇒ 用一把从没量过的尺自证清白（口径陷阱第 57 条的同族）。 */
  const n1 = selGapNote([mk(0.90, 0, 1), mk(0.70, 0, 1)]);
  ok(/没有任何噪声估计/.test(n1), '⑤ n=1 ⇒ 必须明说"没有任何噪声估计"（不能只印个 0 就当噪声）');
  ok(!/判得动/.test(n1), '⑤ n=1 ⇒ **绝不许**判"判得动"（极差 0 是没量过，比分差再大也不构成证据）');
  ok(/极差 无从估|极差无从估/.test(selNote({ n: 1, spreadPt: 0 })), '⑤ 每枚读数也一样：n=1 不许印成"极差 0.0pt"（会被读成"这枚很稳"）');
  ok(/极差 9\.4pt/.test(selNote({ n: 4, spreadPt: 9.4 })), '⑤ n≥2 照旧印实测极差');

/* 〔撤编 2026-11-19〕原 ⑥⑦⑧ trainer 接线与 np 钉数（train-3p/server 已删） —— 主语（v7 训练器）已删，见 docs/GATE-SHIFTS.md */
});

/* ===== §E340（用户 ⑦）全息屏障 → 原型制御 的映射档 ===== */
}

