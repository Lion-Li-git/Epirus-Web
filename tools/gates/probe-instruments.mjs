/*#np-part-header
{"file":"tools/gates/probe-instruments.mjs","part":"probe-instruments","group":"probe","ranges":[[3662,3696],[5111,5126],[5303,5314],[6946,7059],[7435,7472],[7531,7660],[7744,7786],[7824,7928],[8052,8077],[8462,8497],[9121,9175],[9332,9373],[9507,9553],[9680,9994],[10313,10390],[10418,10449],[10468,10489],[10507,10513],[10783,10897],[11242,11361],[11419,11525],[11855,12020]],"gates":[3662,5111,5303,6946,7015,7435,7531,7595,7637,7744,7824,7850,8052,8462,9121,9140,9332,9507,9680,9716,9921,9959,10313,10418,10468,10783,10875,11242,11262,11303,11419,11484,11855],"patched":[]}
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
export const ords = [3662, 5111, 5303, 6946, 7015, 7435, 7531, 7595, 7637, 7744, 7824, 7850, 8052, 8462, 9121, 9140, 9332, 9507, 9680, 9716, 9921, 9959, 10313, 10418, 10468, 10783, 10875, 11242, 11262, 11303, 11419, 11484, 11855];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D34 旧包"逐位等价嵌入"：embedLegacy 的输出必须与按旧布局手算的参考逐位相同', function () {
  /* 为什么需要：训练是**热启动**的（从 champion-5p-v1.3.58.bak 这类 v6 包长出来），
   * 而 train-server 用的是严格 unpack（v7 会拒收 v6 包）⇒ 不嵌入就只能从随机重开，
   * "同起点 A/B"与 meta 的 hotstartFrom 谱系一起报废。
   * 这条用一个**独立手算的参考实现**（按 v6 布局的小 MLP）对着比 —— 布局错一位就红。 */
  const n6 = 3337, HID = Pol.HID;
  const w6 = new Float64Array(n6);
  for (let i = 0; i < n6; i++) w6[i] = ((i * 2654435761) % 997) / 997 - 0.5;
  const w7 = Pol.embedLegacy(w6);
  eq(w7.length, Pol.paramCount(), '嵌入后必须是新形状（paramCount）');
  const st = S.createState('multi', { next: function () { return 0.5; } }, 3);
  st.p[0].ep = 8; st.p[0].guardNext = true; st.p[1].copiedGuard = R.SK.REFLECT;
  const x6 = Pol.features(st, 0, 123);
  let worst = 0, n = 0;
  for (const k of ['gun', 'sword', 'charge', 'bagua', 'reflect', 'ji', 'bigT']) {
    const af = Pol.actionFeatures(st, 0, k, null).slice(0, 14);
    let ref = w6[n6 - 1];                                  // b2
    for (let j = 0; j < HID; j++) {
      let s = w6[HID * 137 + j];                           // b1
      const base = j * 137;
      for (let i = 0; i < 123; i++) s += w6[base + i] * x6[i];
      for (let i = 0; i < 14; i++) s += w6[base + 123 + i] * af[i];
      if (s > 0) ref += w6[HID * 137 + HID + j] * s;       // ReLU + W2
    }
    worst = Math.max(worst, Math.abs(Pol.value(st, 0, k, w7, Pol.shapeOf(w7)) - ref));
    n++;
  }
  /* 参考实现是**另一个加法顺序**（先加 b1 再加特征）⇒ 浮点求和不可结合，允许 1e-12 级别的差。
   * 与"旧代码本身"的逐位比较在开发时做过（偏差恰好 0，因为两条路径的加法顺序一致）。 */
  ok(worst < 1e-12, '嵌入后的输出必须等于按 v6 布局手算的参考（' + n + ' 个技能，实测最大偏差 ' + worst + '）');
  ok(Pol.loadAny({ v: 6, a: Array.from(w6), f: 123, h: HID }).legacy === true, 'loadAny 必须把 v6 包标成 legacy 并嵌入');
  ok(Pol.loadAny({ v: 7, a: Array.from(w7), f: Pol.FEAT_S, fa: Pol.FEAT_A, h: HID }).legacy === false,
    'loadAny 读当前版本包必须走严格路径（不得嵌入）');

  /* ===== v8 准备（用户 10-15 晚「先做一下自动兼容性，让 v7 包可以直接加载进后续的版本」）=====
   * 与上面 v6→v7 那条的**关键区别**：那里 `featA` 也变了（14→22）⇒ 嵌入过的旧包必须靠 `lv` 标记走旧候选口径；
   * 这里只加**状态维**（`featA` 不动、新维一律追加在状态段末尾）⇒ 嵌入是纯列重映射 + 补零：
   *   · 前向输出与旧包逐位相同（新列乘 0）⇒ 不必重训、不必重发池；
   *   · 候选口径同源（`featA` 没变）⇒ **不需要** `lv` 标记。
   * 做法（照本腿上面的方法）：把当前形状的权重**裁掉末尾 k 个状态列**造一只"旧形状"包，再嵌回去 ⇒ 必须逐位回到原样。
   * 变异实验（人工）：把 `canUpgradeStateOnly` 里的 `sh.featA === FEAT_A` 去掉 ⇒ 下面那条 v6 反面断言当场红。 */
  const kUp = 6;
  const fsOld = Pol.FEAT_S - kUp, faOld = Pol.FEAT_A, fO = fsOld + faOld, fN = Pol.FEAT_S + Pol.FEAT_A;
  const wCur = new Float64Array(Pol.paramCount());
  for (let i = 0; i < wCur.length; i++) wCur[i] = ((i * 40503) % 991) / 991 - 0.5;
  for (let j = 0; j < HID; j++) for (let i = fsOld; i < Pol.FEAT_S; i++) wCur[j * fN + i] = 0;   // 模拟"旧包没有这些新维"
  const wOld = new Float64Array(HID * fO + HID + HID + 1);
  for (let j = 0; j < HID; j++) {
    const o = j * fO, q = j * fN;
    for (let i = 0; i < fsOld; i++) wOld[o + i] = wCur[q + i];
    for (let i = 0; i < faOld; i++) wOld[o + fsOld + i] = wCur[q + Pol.FEAT_S + i];
  }
  for (let i = 0; i < HID; i++) wOld[HID * fO + i] = wCur[HID * fN + i];
  for (let i = 0; i < HID; i++) wOld[HID * fO + HID + i] = wCur[HID * fN + HID + i];
  wOld[wOld.length - 1] = wCur[wCur.length - 1];
  const shOldU = Pol.shapeOf(wOld);
  ok(!!shOldU && shOldU.legacy === true && shOldU.featA === Pol.FEAT_A && shOldU.featS === fsOld,
    '状态段只增的旧形状必须被 shapeOf 认出（featS=' + fsOld + ' 更小、featA 不变）');
  const packOldU = { v: Pol.PACK_VERSION - 1, a: Array.from(wOld), f: fsOld, fa: faOld, h: HID };
  ok(Pol.canUpgradeStateOnly(packOldU) === true, 'canUpgradeStateOnly 必须认这只包');
  ok(Pol.checkPack(packOldU).ok === false, '严格 checkPack 仍必须拒它（放宽的是 loadGame 这条入口，不是闸的定义）');
  const backU = Pol.embedLegacy(wOld);
  let worstU = 0;
  for (let i = 0; i < wCur.length; i++) worstU = Math.max(worstU, Math.abs(backU[i] - wCur[i]));
  ok(worstU === 0, '状态段只增的旧包嵌回去必须**逐位**等于原权重（实测最大差 ' + worstU + '）');
  const lgU = Pol.loadGame(packOldU);
  ok(!!lgU && lgU.length === Pol.paramCount(), 'loadGame（游戏侧入口）必须接受它并给出当前形状');
  ok(Pol.canUpgradeStateOnly({ v: 6, a: Array.from(w6), f: 123, h: HID }) === false,
    '反面：featA 也变过的 v6/v5 包**不许**走这条自动升级（那会静默切错候选口径，见 policy.js:777-791）');
  ok(Pol.loadGame({ v: 6, a: Array.from(w6), f: 123, h: HID }) === null, '反面：loadGame 对 v6 包必须返回 null');
});

t('D83 转化率探针：分母必须是"可负担的决策点"（**不得用使用率**）+ 蒙特卡洛不得消耗对局随机流', function () {
  /* v1.5.95（第九轮复核 §5-2/§7-2）：验收"价值估计病"必须用**可负担时的选中率** ——
   * 使用率会被"压根不出手"的退化包骗（`v7ctrlE-31` 0.00 攻击/回合，照样拿 A 卷 46.8%）。
   * 这条门把这个口径选择**钉在源码里**，免得以后有人图省事换成使用率。 */
  const p = readFileSync('tools/probe-convert.mjs', 'utf8');
  ok(p.indexOf('const ready = rows.filter(function (r) { return r.affordable.indexOf(k) >= 0; });') >= 0,
    '分母必须是**可负担的决策点**（不是全部决策点）');
  ok(p.indexOf('picks += (r.mc[k] || 0); opp += MC;') >= 0, '分子必须是蒙特卡洛采样选中次数（按点数累计）');
  ok(p.indexOf('const realRng = state.rng;') >= 0 && p.indexOf('state.rng = { next: mulberry32(') >= 0 &&
    p.indexOf('finally { state.rng = realRng; }') >= 0,
    '蒙特卡洛必须换**独立 RNG** 并在 finally 里还原（否则会污染对局随机流）');
  ok(p.indexOf('实际选中率') >= 0 && p.indexOf('【转化拒绝】') >= 0 && p.indexOf('【收入饥饿】') >= 0,
    '必须同时给"实际选中率"对照 + 转化拒绝/收入饥饿两张分类表（两种形态必须分开数）');
  ok(p.indexOf('可负担 ≥10% 的决策点，却选中 <1%') >= 0, '转化拒绝的判据必须写清（可负担门槛 + 选中门槛）');
});

t('D88 门地形量具：挂科清单必须在第一个括号前截断（括号里是读数）+ 在位包单列参照 + 跳过 A 卷', function () {
  /* v1.5.100：`promote-champion` 一次只看**一个**候选，而"门是否可达到"是**分布**问题 ⇒ 新增 `gate-landscape`。
   * 这条门钉住三个容易出错的口径（第一版实现时我自己就踩了第一个）。 */
  const s = readFileSync('tools/gate-landscape.mjs', 'utf8');
  ok(s.indexOf("split('（')[0]") >= 0,
    '挂科清单必须在**第一个括号之前**截断 —— 括号里是"座位 26.9pt · G 3.9 · …"这种读数，当成挂科会全表误判');
  ok(s.indexOf('参照行') >= 0, '必须写明在位包是**参照行**（它自己过不了只枪格 G4，别读成"候选不行"）');
  ok(s.indexOf('--exam-first=0') >= 0, '必须跳过 A 卷那 1400 局（五道门不依赖它，约 10~20s/包）');
  ok(s.indexOf('五道全过 = ') >= 0 && s.indexOf('各门阻塞次数') >= 0, '必须汇总过门数与各门阻塞频次');
  ok(s.indexOf('清场均值') >= 0, '必须给出"广度 vs 清场"的两组对照（它曾否掉一个假说）');
});

t('D137 三把量具（v1.5.190）：判定必须过显著性 · 通吃必须"除 2P"排序 · "读不出"必须分得出是算力还是钱墙（Q-9/Q-10）', function () {
  /* ===== ① skill-report：判定标签只许贴在"分得出"的卡上 =====
   * 病（Q-9 原话：30 张里 21 张读不出，而表上没有 SE ⇒ 读表人把"读不出"当"没价值"）：
   * 旧门槛 `|Δ|>0.5pt` 比本工具自己的配对噪声（实测中位 ±3.4pt）**还小** ⇒ 一部分标签是贴给噪声的。
   * 判据不钉文本：**从 --json 产物里逐行复核不变式**（四象限标签 ⇒ |Δ|>1.96·SE；消融标签 ⇒ |Δ_lost|>1.96·banSE）。 */
  const dir = mkdtempSync(join(tmpdir(), 'd137-'));
  const outHtml = join(dir, 'r.html'), outJson = join(dir, 'r.json');
  const run = spawnSync(process.execPath,
    ['tools/skill-report.mjs', '3', '2', outHtml, '--champ=js/bundled-champion-3p.js', '--json=' + outJson],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, 'skill-report 要跑得通（stderr=' + String(run.stderr || '').slice(0, 200) + '）');
  ok(existsSync(outJson), '必须能导出 --json（否则这条判据只能靠肉眼读 HTML）');
  const rep = JSON.parse(readFileSync(outJson, 'utf8'));
  ok(rep.targetPt > 0, 'JSON 里要带 `targetPt`（"要辨几 pt"这件事必须随产物一起落盘，不然价码就丢了）');
  const QUAD = ['坑（', '主力（', '没学会的强招', '死技能（'];
  const monoBad = [], banBad = [], noSe = [];
  for (const r of rep.rows) {
    if (typeof r.se !== 'number') noSe.push(r.name);
    if (r.banLost == null) {
      if (QUAD.some(function (q) { return String(r.verdict).indexOf(q) === 0; })) {
        if (!(r.se > 0) || !(Math.abs(r.delta) > 1.96 * r.se)) monoBad.push(r.name + '=' + r.verdict + ' Δ=' + (100 * r.delta).toFixed(1) + ' SE=' + (100 * r.se).toFixed(1));
      }
    } else {
      if (typeof r.banSe !== 'number') noSe.push(r.name + '(消融)');
      const isLoad = String(r.verdict).indexOf('承重') === 0 || String(r.verdict).indexOf('陷阱') === 0;
      if (isLoad && !(r.banSe > 0) || (isLoad && Math.abs(r.banLost) <= r.banMde)) {
        banBad.push(r.name + '=' + r.verdict + ' Δ_lost=' + (100 * r.banLost).toFixed(1) + ' SE=' + (r.banSe > 0 ? (100 * r.banSe).toFixed(1) : '?'));
      }
    }
  }
  eq(noSe.length, 0, '每行都必须带配对 SE（`se` / `banSe`）：' + JSON.stringify(noSe));
  eq(monoBad.length, 0, '不许给"分不出"的卡贴四象限标签（Q-9 的正面钉）：' + JSON.stringify(monoBad));
  eq(banBad.length, 0, '消融臂同一条规矩（承重/陷阱要过 1.96·SE）：' + JSON.stringify(banBad));
  ok(/要辨[\d.]+pt需\d+局\/组/.test(String(run.stdout || '')),
    '控制台必须印"要辨 X pt 需几局/组"（算力价码；没有它就只剩一句"噪声内"，等于没回答 Q-10）');
  ok(/噪声内.*张/.test(String(run.stdout || '')) && /1\.96SE 中位/.test(String(run.stdout || '')),
    '必须有"可测量性"汇总（多少张分不出 + 本口径噪声中位）⇒ 这是把"读不出"和"没价值"分开的那句话');
  /* ===== ② probe-cross-mode：通吃排序必须"除 2P" =====
   * 病（今天 9 粒历史包实测）：3P 包塞进 2P 格是**结构性 0% 胜/100% 平**（含现役）⇒ 含 2P 的"最弱格"对这批包恒 0，
   * 排序键等于没有，把真正分辨得出的四格糊平。 */
  const cm = spawnCached(['tools/probe-cross-mode.mjs',
    'js/bundled-champion-3p.js', 'docs/artifacts/v7aim3-93.bak', 'docs/artifacts/v7divK-31.bak', '--games=6', '--json'],
    { encoding: 'utf8', timeout: 600000 });
  eq(cm.status, 0, '通吃矩阵要跑得通');
  const mx = JSON.parse(String(cm.stdout)).rows;
  ok(mx.length > 0 && mx[0].weakestMulti !== undefined, '每行必须带 `weakestMulti`（除 2P 的最弱格）');
  const byField = {};
  for (const r of mx) { (byField[r.field] = byField[r.field] || []).push(r); }
  for (const f in byField) {
    const arr = byField[f];
    for (let i = 1; i < arr.length; i++) {
      ok(arr[i - 1].weakestMulti.first >= arr[i].weakestMulti.first - 1e-12,
        '环境 ' + f + ' 的排序必须按 `weakestMulti`（第 ' + i + ' 行 ' + arr[i].pack + ' 排在 ' + arr[i - 1].pack + ' 后面却更高）');
    }
  }
  ok(mx.some(function (r) { return r.weakest.id === '2P' && r.weakestMulti.id !== '2P'; }),
    '必须真的存在"含 2P 最弱格 ≠ 除 2P 最弱格"的行（否则这条改动是空操作，两列同形等于没加）');
  /* ===== ③ probe-skill-marginal：把"读不出"分成两种病 =====
   * `机会≈0` 的判据是 `chance`（每局几次机会）⇒ **与局数无关 ⇒ 加算力救不了**；`噪声内` 才是算力问题。
   * 混为一谈就会白烧算力（Q-10 的实际答复：×3.1 算力只把原生口径的可测从 3/30 抬到 4/30，换 `--rich=card` 才到 14/30）。 */
  const mg = spawnCached(['tools/probe-skill-marginal.mjs', '--mode=multi', '--games=6', '--only=ji,gun'],
    { encoding: 'utf8', timeout: 600000 });
  eq(mg.status, 0, '边际价值探针要跑得通');
  const mgOut = String(mg.stdout || '');
  ok(/病因拆开/.test(mgOut), '汇总必须把"读不出"拆成**钱墙 / 算力**两种病（不拆就是让人拿算力去治钱墙）');
  ok(/合计 \d+ 张卡/.test(mgOut), '汇总行要在（可测/噪声内/机会≈0 三分类）');
  ok(!/要 SE→.*需 ~0 局/.test(mgOut), '不许出现"需 0 局"这种假价码（se=0 时该走"读不出"而不是"再跑 0 局就行"）');
});

t('D138 拦截代价表（v1.5.191 新量具）：归因必须真收到 blocked/reflect、"没测到"必须单独成类、判读必须要求两场符号翻转', function () {
  /* 这把尺子要回答的是用户那句"AI 为了防止技能被拦截、倾向于完全不用可能被拦截的技能"。
   * 它有三个可失败点，逐个钉：① `blocked` 事件**没有 source** ⇒ 对手必须禁用被测卡，否则被挡率会混进别人的手；
   * ② 贵卡在猛攻场里"4 回合就死 ⇒ 一次都没出手"，只报 0% 被挡率就会把**没测到**当成"拦截不成立"（门 L2 那句原话）；
   * ③ ε=1 的 mono-spam 自带"只会一招"的惩罚 ⇒ 判"理性"必须要求**两场符号翻转**，不能只看 Δ 为负。 */
  const run = spawnSync(process.execPath, ['tools/probe-intercept-cost.mjs', '--games=12', '--only=bigT,gun,ji', '--json'],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, '探针要跑得通（stderr=' + String(run.stderr || '').slice(0, 200) + '）');
  const out = String(run.stdout || '');
  ok(out.indexOf('{"games"') >= 0, '探针必须能把结果导成 JSON（找不到就是 `--json` 这条路断了，别拿人读表格凑数）');
  const j = JSON.parse(out.slice(out.indexOf('{"games"')));
  ok(j.judged.length >= 3, '三张被测卡都要有判读行（实测 ' + j.judged.length + '）');
  /* ① 归因活着：枪/大雷在"半数席设防"的场里必须**真收到**拦截事件（收不到 = 字段筛错 = 整张表是空枪） */
  const gun = j.judged.filter(function (r) { return r.key === 'gun'; })[0];
  const big = j.judged.filter(function (r) { return r.key === 'bigT'; })[0];
  ok(gun && gun.casts > 0.5, '枪必须真出手（否则被挡率是 0/0 的假 0；实测 casts/局=' + (gun && gun.casts) + '）');
  ok(gun.blockRate > 0.10, '枪在会防的混合场里必须**收到**拦截事件（实测被挡率 ' + (100 * gun.blockRate).toFixed(0) + '%；为 0 说明 `via`/归因断了）');
  ok(Object.keys(gun.who || {}).length > 0, '必须记下"被哪张防御卡挡的"（`blocked.by`），否则这张表只剩一个数、解释不了机制');
  /* ② "没测到"必须能单独成类，且优先级高于 N/R/L */
  const clsOf = function (r) { return r.cls; };
  ok(j.judged.map(clsOf).every(function (c) { return 'RLNUC?'.indexOf(c) >= 0; }), '判读只能落在 R/L/N/U/C/? 里');
  {
    /* §E588：这一臂原来不传 `--pack=` ⇒ 默认拿**活槽那一枚**，而它要证的是"**分类器能把'没测到'单独成类**"。
     *   旧包在"关垫钱"下确实活不到有钱（判 U ✓），v1.6.62 换上去的新包 0.5 次/局 ⇒ 判 N（不是 bug，它真出得起钱）。
     *   ⇒ 夹具钉成 `FIXTURE_PACK`，断言一字不减；"新包活得久"是包的事实，归 §E588 日志，不归这条腿。 */
    const u = spawnSync(process.execPath, ['tools/probe-intercept-cost.mjs', '--games=6', '--only=drain', '--grant=0',
      '--pack=' + FIXTURE_PACK, '--json'],
      { encoding: 'utf8', timeout: 600000 });
    ok(u.status === 0, '关掉垫钱的对照臂要跑得通（status=' + u.status + '）');
    const uu = JSON.parse((function (s) { return s.slice(s.indexOf('{"games"')); })(String(u.stdout || '')));
    const r0 = uu.judged.filter(function (x) { return x.key === 'drain'; })[0];
    ok(r0 && r0.cls === 'U', '关掉定向垫钱后，"活不到有钱"的卡必须判 **U（未测到）**而不是 N —— ' +
      '把"没测到"读成"拦截解释不成立"就是本仓门 L2 点名的那族病（实测 cls=' + (r0 && r0.cls) + ' casts/局=' + (r0 && r0.casts) +
      ' ‖ 夹具=' + FIXTURE_PACK + '）');
  }
  /* ③ 判据形状：R 要求两场符号翻转（Δ混合<0 且 Δ不防>0）；L 要求 Δ混合>0 —— 直接从产物复核，不钉源码文本 */
  for (const r of j.judged) {
    if (r.cls === 'R') ok(r.dMix < 0 && r.dNodef > 0, 'R 必须两场符号翻转：' + r.name + ' Δ混合=' + r.dMix + ' Δ不防=' + r.dNodef);
    if (r.cls === 'L') ok(r.dMix > 0 && r.blockRate >= 0.10, 'L 必须是"会防场里仍赚 + 真被挡"：' + r.name);
    if (r.cls === 'N') ok(r.blockRate < 0.10, 'N 只能给被挡率 <10% 的卡：' + r.name + ' 实测 ' + (100 * r.blockRate).toFixed(0) + '%');
    ok(typeof r.interceptCost === 'number', '机制列（拦截代价=Δ混合−Δ不防）必须在');
  }
  ok(/判读合计/.test(out) && /规则：/.test(out), '必须印分类合计与判读规则（没有规则的话，这张表就是一堆没有口径的数）');
});

t('D148 E1/E2 量具 `probe-ep-reach.mjs`（09-24 夜 · 交接 §4）：门槛可达性必须问引擎、无决策点必须响、改价必须还原', function () {
  /* 这份量具的产出直接决定"该改价还是该改判据"（交接 §0 的两条来路）⇒ 它自己不能是错的。
   * 三条会复发的形状，逐条钉：
   *  ① 门槛数字**不许自己抄**（抄了就与 `computeCost` 的动态费用漂移：大雷 5、电磁炮 2+珠、聚能环/过载炮是 null）；
   *  ② 决策点为 0 必须**非零退出**（交接 §5-4：静默跳过 = 把测量关掉而汇总仍全绿）；
   *  ③ §B 的改价是**内存里改 `R.byKey`** ⇒ 必须在 finally 还原，否则"改价反事实"会污染后一场读数。 */
  const p = readFileSync('tools/probe-ep-reach.mjs', 'utf8');
  ok(p.indexOf('S.computeCost') >= 0 && p.indexOf('const canNow = ep >= need') >= 0,
    '门槛必须问引擎（`S.computeCost`），再与 ep 比 —— 不许硬写数字');
  ok(!/\bep >= \d+\s*&&/.test(p), '不许出现"ep ≥ 某常量 &&"这种把硬编码门槛喂进判定式的写法（与动态费用必漂）；' +
    '直方图分桶（`ep >= 5 ? \'5+\'`）不算判定，所以只禁"参与判定"的那种');
  ok(p.indexOf("String(rr.need)") >= 0, '打印的门槛数字必须来自引擎回传的 `need`，不是字面量');
  ok(p.indexOf('finally') >= 0 && /R\.byKey\[R\.SK\.BIG_T\]\.cost = prevCost/.test(p),
    '改价反事实必须在 finally 还原单价（否则 §B 三档之间互相污染）');
  const run = spawnSync(process.execPath, ['tools/probe-ep-reach.mjs', '--games=6', '--fields=pool,mirror'],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, '量具要跑得通（' + String(run.stderr || '').slice(0, 160) + '）');
  const out = String(run.stdout || '');
  ok(/可达时成交率/.test(out) && /只差≤2ep/.test(out),
    '必须同时印"可达时成交率"与"只差≤2ep"两列 —— 缺任何一列就分不开"够不着"与"不想去"（E1 的全部意义）');
  ok(/ep 支出结构/.test(out) && /ep 收入/.test(out), 'E2 的收支两栏必须在（不然只剩"钱不够"这一种解释）');
  ok(/n=\d+/.test(out), '每个比例必须带 n（交接 §5-5：阈值不写 n 就没有意义）');
  ok(/真放出去|真买了/.test(out), '必须印"真放出去/真买了" —— 只有"买得起 X%"会把"够不着"与"不去"混成一格');
  /* §E 广度含多少空转：判据必须**来自事件**（写卡名清单必然与引擎的清除清单漂 —— 同 D142 的教训） */
  ok(p.indexOf("e.type === 'purify' && !e.curses") >= 0 && p.indexOf("'beadExpire'") >= 0 &&
     p.indexOf("e.reason === '天火'") >= 0,
    '空转的三类判据必须来自事件（`purify.curses===0` / `beadExpire` / 该回合无 `reason===天火` 的伤害），不许维护第二份卡名清单');
  const b = spawnSync(process.execPath, ['tools/probe-ep-reach.mjs', '--games=4', '--fields=pool', '--breadth-games=8'],
    { encoding: 'utf8', timeout: 600000 });
  eq(b.status, 0, '§E 要跑得通（' + String(b.stderr || '').slice(0, 160) + '）');
  ok(/G 有效技能数：原始 [\d.]+（\d+ 种 \/ \d+ 次非ジ出手） → 扣空转/.test(String(b.stdout)),
    '§E 必须把"原始 G → 扣空转 G"并排印出来 —— 只印一个数就会让人以为扣空转必然变小（实测 `v7cmin4-82` 扣完从 4.83 **涨**到 5.79）');
  /* ② 空枪检测：--games=0 ⇒ 决策点必为 0 ⇒ 必须非零退出，不许印一排 0% 假装量到了 */
  const zero = spawnSync(process.execPath, ['tools/probe-ep-reach.mjs', '--games=0', '--fields=pool'],
    { encoding: 'utf8', timeout: 300000 });
  ok(zero.status !== 0, '零决策点必须**非零退出**（实测 exit=' + zero.status + '）—— 静默返回 0 就是把这条测量关掉');
});

t('D150 全层口径搬运量具 `probe-layer-caliber.mjs`：搬运必须**自证生效**，且判据数量不许冻结成常数', function () {
  /* 为什么要有这份量具：五道门的输入全部写在 ε=0 上（`audit-lib` 9 处 + `evo.js` 4 处 `policyChooserN(params, 0.15)`），
   * 而 5 人产品跑 ε=0.2 soft（`ui.js:464`）—— v1.5.152 只给"真桌出招份额"补了代理栏（D118），**门本身的输入没有第二口径**。
   * 搬运是两条"改内存不改仓库"的路：① 装载 `evo.js` 前做字符串替换；② 装载后把沙箱里的 `EpirusTrainer.policyChooserN` 包一层。
   * ⇒ 最大风险不是数不对，是**没搬成功而两栏一样**（会被读成"口径无关"）。所以本门判的是"搬运有没有留下证据"，不是某个读数。 */
  const p = readFileSync('tools/probe-layer-caliber.mjs', 'utf8');
  ok(p.indexOf('writeFileSync') < 0 && p.indexOf('appendFile') < 0, '量具必须只读（不许落任何产物）');
  ok(/process\.exit\(9\)/.test(p) && /SELF\.patched !== EVO_HARDWIRED \|\| SELF\.wrapper <= 0/.test(p),
    '必须有"两条路都自证生效否则作废"的自检（非零退出）—— 缺它时两栏相同会被当成"口径无关"');
  ok(/EVO_HARDWIRED = \(EVO_SRC\.match\(HARDWIRED\)/.test(p) && !/patched !== 4/.test(p),
    '期望的写死处数量必须**从源码现算**（METHODOLOGY 52：冻结成常数的"期望值"会在别人补一处后静默少覆盖）');
  ok(/arguments\.length >= 3 \? orig\.apply/.test(p),
    '包装层必须**原样透传**已经传了 ≥3 个参数的调用（否则会把产品口径自己的四参数调用改坏，制造假差异）');
  const run = spawnCached(['tools/probe-layer-caliber.mjs', '--packs=js/bundled-champion-3p.js', '--games=30'],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, '量具要跑得通（' + String(run.stderr || '').slice(0, 200) + '）');
  const out = String(run.stdout || '');
  ok(/工具自检：`evo\.js` 写死处实测 \d+ 处 → 内存里替换了 \d+ 处/.test(out) && /经包装调用 \d+ 次/.test(out),
    '必须印出自检两半（现算数量 + 经包装次数）');
  ok(/攒钱场 设防率/.test(out) && /最长连设防/.test(out) && /五道门总结论/.test(out),
    '必须同时印"五道门的输入"与"门不看的栏（设防持续性）"—— 后者是用户 09-24 实机报的病，前者是门唯一在读的东西');
  const num = function (o, label) {
    const m = new RegExp(label + '[^\\n]*ε=0\\s+([\\d.]+)\\s+产品\\s+([\\d.]+)').exec(o);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const seat = num(out, '座位极差'), wall = num(out, '反弹墙伤害/局');
  ok(!!seat && !!wall, '座位与反弹墙两栏必须能被抓出来（格式变了就一起改本门）');
  ok(seat[0] !== seat[1] || wall[0] !== wall[1],
    '两栏至少一列必须**不同** ⇒ 证明搬运真的到了引擎（全同 = 测量没打开）。实测 座位 ' + seat.join(' vs ') + ' / 墙 ' + wall.join(' vs '));
  /* 对照：把产品口径也设成 ε=0，则两栏必须**逐字相同** —— 这条是上面那条的反证，也顺手钉住"差异来自口径而不是别的参数" */
  const ctl = spawnCached(['tools/probe-layer-caliber.mjs', '--packs=js/bundled-champion-3p.js', '--games=30', '--eps=0'],
    { encoding: 'utf8', timeout: 600000 });
  eq(ctl.status, 0, 'eps=0 对照要跑得通');
  const cout = String(ctl.stdout || '');
  const cSeat = num(cout, '座位极差'), cWall = num(cout, '反弹墙伤害/局');
  ok(!!cSeat && !!cWall && cSeat[0] === cSeat[1] && cWall[0] === cWall[1],
    'ε=0 对照下两栏必须相同（实测 座位 ' + (cSeat || []).join('/') + ' · 墙 ' + (cWall || []).join('/') + '）');
  /* 复用方必须**共用**上面那两条搬运路，不许出现第二份口径实现（本仓"同一规则只写一遍"的规矩）。
   * v1.5.223：复用方从 1 个扩到 2 个 —— 理想冠军 7 条量具也要读产品口径的【5】【6】。 */
  for (const rf of ['tools/probe-breadth-flip.mjs', 'tools/probe-ideal-champion.mjs']) {
    const rfSrc = readFileSync(rf, 'utf8');
    /* 语义判定（原来钉的是 `import { build }` 这个**精确形状** ⇒ 复用方一旦同时要第二个 helper，
     *   合法改动就把本门打红；D152/D159 同一族教训）。现在判的是"从那个模块导入的名单里含 build"。 */
    const imp = /import\s*\{([^}]*)\}\s*from\s*'\.\/probe-layer-caliber\.mjs'/.exec(rfSrc);
    ok(!!imp && (imp[1].split(',').map(function (s) { return s.trim(); }).indexOf('build') >= 0),
      '`' + rf + '` 必须从 `probe-layer-caliber.mjs` 导入 `build`（搬运手法单一来源）');
    ok(!/HARDWIRED/.test(rfSrc) && !/vm\.runInNewContext/.test(rfSrc),
      '复用方不许在自己文件里再写一份"替换/装载"逻辑（`HARDWIRED`/`runInNewContext` 都只能活在 `build` 里）：' + rf);
  }
  ok(/export function build/.test(p) && /IS_MAIN/.test(p),
    '被 import 的量具必须"装载不跑 main"（与 behavior-profile.mjs 同规），否则复用时会连带跑出两张表');
  ok(/HARDWIRED/.test(p) && /EVO_HARDWIRED = \(EVO_SRC\.match\(HARDWIRED\)/.test(p),
    '写死处的正则与期望数量必须**同一份常量**（现算），两处各写一遍必漂');
  /* 档案筛（复用同一套搬运）也必须**真跑得通**：09-25 03:30 我给它加"先认货再装载"时漏 import `readFileSync`，
   *   只有把它跑一次才暴露（`node --check` 只抓语法）⇒ 这类"import 漏了"的错误必须由跑通断言兜。 */
  const sw2 = spawnNC(['tools/probe-breadth-flip.mjs', '--every=700', '--limit=2', '--games=6'],
    { encoding: 'utf8', timeout: 600000 });
  eq(sw2.status, 0, '`probe-breadth-flip` 要跑得通（' + String(sw2.stderr || '').slice(0, 200) + '）');
  ok(/结论（n=/.test(String(sw2.stdout)), '筛完必须印结论块（含被跳过的非包 .bak 计数）');
  /* v1.5.223：这条原来靠上面那个 `const sw`（我把它收进复用方循环里了）⇒ 改成**自己读**，不再依赖外层绑定。 */
  const bfSrc = readFileSync('tools/probe-breadth-flip.mjs', 'utf8');
  ok(/SKIP/.test(bfSrc) && /跳过/.test(bfSrc), '扫池工具必须**点名跳过项**——静默跳过会把"没跑成"读成"没体质"（而漏 import 会被洗成数据问题）');
});

t('D151 「攒钱→防御」量具：ep 必须**决策时实读**，因果必须靠**两档配对**，小分母不许当结论', function () {
  /* 这条门是被自己的第一版**逼**出来的：我最初从事件流前缀和重建"对手 ep"，并假定"一回合内 5 条 action 全先于结算"。
   * 实测该假定为假（一局里 64 次结算落在 action 之前/之间、只有 13 次是干净分界）⇒ 前缀和既不是"开始值"、又只加不减（花了不扣）。
   * ⇒ 唯一站得住的读法是**在被评席做决策的那一刻直接读 `state.p[0].ep`**（这才是这只包看得见的钱），回合号用 `state.round`。 */
  const p = readFileSync('tools/probe-defense-cause.mjs', 'utf8');
  ok(p.indexOf('from \'./probe-layer-caliber.mjs\'') >= 0 && /import \{ build \}/.test(p),
    '口径搬运必须继续复用 `build`（单一来源，同 D150）');
  ok(/ep0: opp \? \(opp\.ep \|\| 0\)/.test(p) && !/epAtRound/.test(p),
    '桶变量必须是**决策时实读**的 `state.p[0].ep`；不许回到"从事件流重建 ep"（那种写法只加不减，量的是"一辈子挣过多少"）');
  ok(/const REC = \[\];/.test(p) && /rd: s2\.round/.test(p),
    '决策记录必须带 `state.round`（实测单调），不许再用"某 pid 重复出现"当回合边界');
  /* 因果那一问：单档里 ep 与回合号是同一条轴 ⇒ 必须有两档才能配对判 */
  ok(/arg\('saver', 'hold'\)/.test(p) && /SAVER === 'cycle'/.test(p) && /CYCLE_AT = Number\(arg\('cycle-at', 4\)\)/.test(p),
    '必须提供 `hold`（钱一路堆）与 `cycle`（堆到 `--cycle-at` 就花掉）两档替身 —— 单档答不了"是不是因为对方有钱"');
  /* （原来这里还钉"工具源码里必须出现『按回合号的曲线』与『同一回合号』两句话" —— v1.6.12 删除：
   *   那是对**打印文案**的措辞钉。它想保的东西（"单档答不了因果、必须两档同回合号配对"）由上面那条结构钉守着：
   *   `hold` 与 `cycle` 两档替身必须都在。⇒ 文案改了会红而判据没了也会红，前者是噪音、后者才是牙。） */
  ok(/该桶平均回合/.test(p), '每个 ep 桶必须并排印该桶平均回合 ⇒ 让"ep 轴 = 回合轴"这个混淆在读数里就看得见');
  ok(/玩家侧代价/.test(p) && /攒钱者夺冠/.test(p),
    '必须把代价落到玩家侧（局长中位/p90、平局率、攒钱者夺冠率）——只有设防率的报告会被读成"AI 变弱了"，而实际是它开始奖励龟缩');
  ok(/没掉过血/.test(p) && /LASTHP/.test(p),
    '必须有"自上次决策以来没掉过血"的子样本曲线 —— 缺它时两档的差值可以全是"装配里另一件事（对手会不会真打你）"的差，而不是钱的差');
  ok(/安慰剂|两档在 ep 还没分岔/.test(p) || /同一曲线、但\*\*只取/.test(p),
    '必须印那条"只取没掉过血"的第二曲线（与主曲线同格式，好让人做分岔前/分岔后的对照）');
  ok(/'%（n=' \+ n \+ '）'/.test(p) && /—（n=0）/.test(p),
    '每个比例必须带分母，且空桶印成"—（n=0）"而不是 0.0%（那会把"没量到"读成"量为零"）');
  ok(/const BMIN = Number\(arg\('bucket-min', 40\)\)/.test(p) && /自适应合并|并入/.test(p) && /分母不足/.test(p),
    '必须有分母下限（`--bucket-min`，默认 40）+ 空桶丢弃/高桶自适应合并 + 小样本时输出"分母不足/没量到"');
  ok(/同一席连续设防/.test(p) && /gamesWithRun3/.test(p),
    '"维持很久"是**游程长度**问题，必须单独印（设防率答不了它）');
  /* 引擎侧：决策时读到的是**当下**的 ep（不是回合开始）—— 这条钉的是"包看得见什么" */
  ok(p.indexOf('state.p[0]') >= 0 || /s2\.p\[0\]/.test(p), '必须从 state 直接读对手席');
  for (const sv of ['hold', 'cycle']) {
    const run = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--games=6', '--packs=js/bundled-champion-3p.js', '--saver=' + sv],
      { encoding: 'utf8', timeout: 600000 });
    eq(run.status, 0, '量具两档都要跑得通（saver=' + sv + '：' + String(run.stderr || '').slice(0, 140) + '）');
    const out = String(run.stdout || '');
    ok(/攒钱替身 = `' + SAVER + '`|攒钱替身 = `' + sv + '`/.test(out) || out.indexOf(sv) >= 0, 'saver=' + sv + ' 必须把档位印在表头（读数要带装配）');
    ok(/维持很久/.test(out) && /判读/.test(out), 'saver=' + sv + ' 必须同时印"游程长度"与"方向判读"两行');
  }
});

t('D152 「空蓄能」分因量具 `probe-bead-loop.mjs`：两种相反的病不许挤在同一个"浪费率"里，两把尺不许互相校验', function () {
  /* 动因（§H-27）：`chargeProfile` 只给"得珠/花掉/过期"三个总量。按"蓄能后下一次决策时电磁炮买不买得起"拆开之后，
   *   现役是 **② 买得起却没射 68.1%**（选择），`v7cmin4-82` 是 **① 买不起 83.3%**（经济）—— 同一个"浪费率高"指向两层完全不同的修法。
   * ⇒ 本门钉的是"这把尺别又长回一个总量"。 */
  const p = readFileSync('tools/probe-bead-loop.mjs', 'utf8');
  ok(p.indexOf('writeFileSync') < 0, '量具必须只读');
  /* v1.5.234：改成**语义**断言 —— 原来钉的是 `import { chargeProfile }` 的**字面文本**，
   * 于是我加一个 `rejectUnknownFlags` 进同一行 import、行为一字未改，门就红了（同族：D159 那次正则没算括号）。
   * 门该守的是"**从单一来源 import、不许自建第二份**"，不是"这行长什么样"。 */
  ok(/import \{ build \} from '\.\/probe-layer-caliber\.mjs'/.test(p) && /import \{[^}]*chargeProfile[^}]*\} from '\.\/audit-lib\.mjs'/.test(p),
    '口径搬运复用 `build`、总量复用真源 `chargeProfile`（都不许有第二份实现）');
  ok(/beadAlive/.test(p) && /beadGone/.test(p),
    '必须先判"珠子还活不活"：该席下一次决策可能已隔两三回合 ⇒ 那批要单列 `beadGone`，不混进①②的分母（第一版没判，造出过 8 次假"买不起"）');
  ok(/按决策计/.test(p) && /按珠子计/.test(p),
    '必须写明"本表按决策计、真源按珠子计，两者不该相等"—— 不写就会有人拿其中一个去"校验"另一个，把发现当 bug 删掉');
  ok(/实际干了什么/.test(p), '② 必须并排印"那些决策实际出了什么卡"（不然"选择问题"这四个字没有内容）');
  const run = spawnSync(process.execPath, ['tools/probe-bead-loop.mjs', '--games=8', '--packs=js/bundled-champion-3p.js'],
    { encoding: 'utf8', timeout: 600000 });
  eq(run.status, 0, '量具要跑得通（' + String(run.stderr || '').slice(0, 180) + '）');
  const out = String(run.stdout || '');
  ok(/① 下一回合电磁炮/.test(out) && /② 买得起/.test(out) && /③ 买得起也射了/.test(out), '三桶必须都在且互斥（加起来等于分母）');
  ok(/真源 `chargeProfile`（\*\*按珠子计\*\*）/.test(out), '必须印真源那一行做并排对照');
});

t('D154 `--pair=1` 必须**一条命令跑两档并自带 placebo 自检**（09-25 E18 那次自我作废换来的）', function () {
  const p = readFileSync('tools/probe-defense-cause.mjs', 'utf8');
  ok(/const PAIR = arg\('pair', ''\) === '1';/.test(p), "两档配对要成为**一个档**（`--pair=1`），不能靠人眼比两根曲线");
  ok(/const SAVES = PAIR \? \['hold', 'cycle'\] : \[SAVER\];/.test(p) && /for \(const SAV of SAVES\)/.test(p) && /SAVER = SAV;/.test(p),
    '配对模式必须**在同一次调用里**跑 hold+cycle（同种子同局数）⇒ 唯一变量是"对手手里的钱"；跨两次调用会漂');
  ok(/CURVES\.push\(\{ pack:.*byRound: byRound/.test(p), '每档的"按回合号曲线"必须留档到内存 ⇒ 才有逐回合对齐的原料（探针不写文件）');
  ok(/placebo 自检/.test(p) && /两档不该分岔的回合/.test(p),
    '必须自带 placebo 自检：两档在 ep 未分岔的前几回合读数**必须逐字相同**，不同就当场作废（这条抓到过替身做错）');
  ok(/不能当体质流行率/.test(p), '输出里必须留着那句更正：**单档 `hold` 的"倍差≥2"是含混了回合轴的粗筛**（E18：八成在配对后掉下 Δ≥15pt）');
  ok(p.indexOf('不是拍的（§H-55') >= 0 && p.indexOf('池化 Δ') >= 0,
    '判定线要自己声明带宽是实测来的（跨种子极差），不是拍的 —— §H-55 的教训：贴线那一段本身就是噪声');
  const one = 'docs/artifacts/cbs1s2-band2.bak';
  const r = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=25', '--pair=1'], { encoding: 'utf8' });
  eq(r.status, 0, '`--pair=1` 要跑得通（' + String(r.stderr || '').slice(0, 200) + '）');
  const o = String(r.stdout || '');
  ok(o.indexOf('同回合配对') >= 0, '`--pair=1` 必须印出同回合配对表');
  ok(o.indexOf('✓ placebo 自检通过') >= 0, '小样本上 placebo 自检必须**通过**（不通过 = 两档连不该分岔的地方都分了岔，读数没意义）');
  ok(o.indexOf("⇒ 判定用的是") >= 0 && o.indexOf("12~18 灰区 / ≤12 低") >= 0,
    '配对表必须把三档判定线（含灰区）印在表尾 —— 线不许只存在于源码里');
  const q = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=15'], { encoding: 'utf8' });
  eq(q.status, 0, '不开 `--pair` 的默认档要照常跑完');
  ok(String(q.stdout || '').indexOf('同回合配对') < 0, '默认档**不许**偷跑两档（历史读数必须逐字节可复现：09-25 已用 diff 自证过）');

  /* --seeds=N：多种子池化 + 跨种子极差（§H-55 立这条的理由：贴线那一段本身就是噪声，只看单种子会把"线"当成"事实"） */
  ok(/const NSEEDS = Math.max\(1, Number\(arg\('seeds', 1\)\)\)/.test(p),
    '--seeds 必须存在且默认 1（默认时取到的种子与改前完全相同 ⇒ 历史读数一字不变）');
  ok(/SEED_LIST\.push\(\(SEED0 \+ si \* 100003\)/.test(p) && /let SEED_BASE = SEED0;/.test(p),
    '每粒种子必须走同一条 SEED_BASE 通道（两处 mul(SEED0…) 都要改，漏一处就等于"换了参数却没换种子"）');
  ok(/池化计数/.test(p) && /spread/.test(p),
    '多种子必须**按计数池化**（不是把率求平均）并印跨种子极差 ⇒ 极差才是判"线落在噪声里吗"的量');
  ok(/灰区 12~18pt/.test(p) && /灰区宽度来自实测跨种子极差/.test(p),
    '灰区宽度必须声明是实测来的，不是拍的（§H-55：eco-34 换种子从 +14.2 跨到 +15.9）');
  const sr = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=8', '--pair=1', '--seeds=2'], { encoding: 'utf8' });
  eq(sr.status, 0, '--seeds=2 要跑得通（' + String(sr.stderr || '').slice(0, 200) + '）');
  ok(/每粒种子Δ/.test(String(sr.stdout || '')) && /极差/.test(String(sr.stdout || '')),
    '多种子必须逐粒印 Δ 与极差（只印均值会把"这条线站不站得住"藏掉）');
  const sn = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=6', '--seeds=2'], { encoding: 'utf8' });
  eq(sn.status, 4, '不开 --pair 却要求多粒种子必须**报错退出**，不许静默按单种子跑完装作跑了两种子');
  const sp = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=' + one, '--games=8', '--pair=1', '--seeds=1'], { encoding: 'utf8' });
  ok(/同回合配对/.test(String(sp.stdout || '')) && !/多种子：/.test(String(sp.stdout || '')),
    'seeds=1 时退回单种子表（不印池化说明），配对表照常存在'
  );
});
t('D160 探针的参数守卫：接过的不许掉、位置要对、且不许误伤自己；没接的**点名只记录**（v1.5.236 · 落地仓规 v1.5.234）', function () {
  /* 语义断言优先（D152/D159 的教训：钉字面文本会被合法重构打红）——这里判的是"守卫存在 + 位置 + 真跑行为"。 */
  const GUARDED = ['probe-defense-cause', 'screen-cheap-predict', 'probe-breadth-flip', 'probe-seat-caliber',
    'probe-layer-caliber', 'probe-kill-reward', 'probe-ideal-champion', 'probe-bead-loop', 'probe-ep-reach'];
  for (const nm of GUARDED) {
    const src = readFileSync('tools/' + nm + '.mjs', 'utf8');
    ok(/rejectUnknownFlags\(/.test(src), nm + ' 必须调用 rejectUnknownFlags（不认识的 `--` 参数必须 exit 64）');
  }
  const dc = readFileSync('tools/probe-defense-cause.mjs', 'utf8');
  ok(dc.indexOf('rejectUnknownFlags(') < dc.indexOf("arg('packs'"),
    '守卫必须**早于**任何 arg() 读取 —— 晚跑的守卫挡不住已经算完的读数（那正是"假成功"的形态）');
  const lc = readFileSync('tools/probe-layer-caliber.mjs', 'utf8');
  ok(lc.indexOf('rejectUnknownFlags(') > lc.indexOf('function main()'),
    '被 import 的模块（probe-layer-caliber）守卫必须只在自己的 main() 里跑 —— 放在顶层会把调用方的 --packs/--pair 当成非法参数打死');
  const bad = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--typo-flag=1'], { encoding: 'utf8' });
  eq(bad.status, 64, '真跑：不认识的参数必须 exit 64（实测 ' + bad.status + '）');
  ok(/不认识的参数/.test(String(bad.stderr || '')) && /--typo-flag/.test(String(bad.stderr || '')),
    '必须**点名**是哪个参数（只给退出码 = 下一次还要再猜）');
  const good = spawnSync(process.execPath, ['tools/probe-defense-cause.mjs', '--packs=docs/artifacts/cbs1s2-band2.bak', '--games=6', '--pair=1'], { encoding: 'utf8' });
  eq(good.status, 0, '真跑：认识的那一串参数不许被自己的守卫误伤（**守卫名单漏项是这类门最常见的死法**）');
  const rest = readdirSync('tools').filter(function (f) { return /^(probe|screen)-.*\.mjs$/.test(f); })
    .filter(function (f) { return GUARDED.indexOf(f.replace(/\.mjs$/, '')) < 0; })
    .filter(function (f) { const s = readFileSync('tools/' + f, 'utf8'); return /arg\('/.test(s) && !/rejectUnknownFlags/.test(s); });
  console.log('   ℹ️ 另有 ' + rest.length + ' 个读 `--参数` 的工具尚未接守卫（**只记录不阻断**，各归其 owner）：' + (rest.join('、') || '无'));
});

t('D161 「防御定价」量具必须自带三把自检：零价档逐字等于对照 · 重价档不许读成空枪 · 补丁真打进**内部调用点**（v1.5.237 · E23 那三个假读数换来的）', function () {
  /* 这道门钉的是**量具**，不是任何一条实验结论。三个假读数都真实发生过（见 RESEARCH-LOG 09-26 §E23）：
   *   ① `Number(o.cost || 1)` 把 `--cost=0` 静默变成 1ep ⇒ "零价对照档"根本不存在（同族：v1.5.174 的 `|| 1` 让 0 关不掉）；
   *   ② 空枪判据写成 `billed===0` ⇒ `cost=99`（防御被整条摘光、一分钱没扣）会被自己的自检判成"读数作废"；
   *   ③ route ②（只包属性层）打不进 `mirrorHealth` 的内部闭包调用 ⇒ 强度栏三档"逐字相同"，看着像"定价不影响强度"。
   * 全部**真跑 + 语义比较**，不钉探针的措辞（D152/D159 的教训）。 */
  const DEFK = Object.keys(R.byKey).find(function (k) { return R.byKey[k] && R.byKey[k].cat === R.CAT.DEFENSE; });
  const ATKK = Object.keys(R.byKey).find(function (k) { return R.byKey[k] && R.byKey[k].cat !== R.CAT.DEFENSE; });
  ok(!!DEFK, '规则表里必须至少有一张 DEFENSE 族卡（这道门的载体）');

  /* ① 零价不许被吞 */
  eq(makeGuardCost(R, S, { mode: 'L2', cost: 0 }).stat.cost, 0, '`cost:0` 必须真的是 0（`|| 1` 会把零价对照档变成 1ep 档）');
  /* 对照组不许套壳：`off` 档与"不打补丁"必须是**同一个函数对象**，否则"对照"二字是假的 */
  { const f = function () { return 0; }; eq(makeGuardCost(R, S, { mode: 'off' }).wrapOne(f), f, '`off` 档必须原样返回传入的决策者（对照组不许被包一层）'); }

  /* ② 事前摘菜单 + 真选了才扣 */
  {
    const gc = makeGuardCost(R, S, { mode: 'L2', cost: 2 });
    const st = { p: [{ ep: 5 }] };
    const pick = gc.wrapOne(function (s2, i2, lg) { return lg[0]; })(st, 0, [{ key: DEFK }, { key: ATKK }]);
    eq(pick.key, DEFK, '付得起时防御不许被摘');
    eq(st.p[0].ep, 3, '选了防御必须真扣到钱（5 − 2 = 3）');
    eq(gc.stat.billed, 1, '`billed` 计一次');
    eq(gc.stat.epTaken, 2, '`epTaken` 计 2ep');
  }
  {
    const gc = makeGuardCost(R, S, { mode: 'L2', cost: 99 });
    const st = { p: [{ ep: 0 }] };
    let saw = null;
    const pick = gc.wrapOne(function (s2, i2, lg) { saw = lg.map(function (l) { return l.key; }); return lg[0]; })(st, 0, [{ key: DEFK }, { key: ATKK }]);
    ok(saw.indexOf(DEFK) < 0, '付不起时防御必须**事前**从菜单里摘掉（事后扣 = 从 0 里扣，实测等于没扣）');
    eq(pick.key, ATKK, '摘掉之后 chooser 只能在剩下的里选');
    eq(gc.stat.dropped, 1, '`dropped` 必须计到这一次摘除 ⇒ 它是"补丁有没有作用点"的唯一凭据');
    eq(gc.stat.billed, 0, '没选防御就不许扣钱');
  }
  {
    /* 摘到空必须**退回原菜单**：不许为了"看起来生效"造出一局无路可走的假局 */
    const gc = makeGuardCost(R, S, { mode: 'L2', cost: 99 });
    const st = { p: [{ ep: 0 }] };
    let sawLen = -1;
    gc.wrapOne(function (s2, i2, lg) { sawLen = lg.length; return lg[0]; })(st, 0, [{ key: DEFK }]);
    eq(sawLen, 1, '菜单只有防御一张时不许摘成空集（退回原菜单 ⇒ chooser 仍有一手可出）');
    ok(gc.stat.dropped > 0, '退回原菜单这件事仍要计入 `dropped`（否则"没得选"会被读成"选了别的"）');
  }

  /* ③ 真跑两档：零价必须与对照逐字相同；重价必须改变**强度栏**（= route ① 打进内部调用点的证据） */
  const tailOf = function (txt, mode) {
    const ln = txt.split('\n').filter(function (l) { return new RegExp('^\\s+' + mode + '\\s').test(l); })[0];
    if (!ln) return null;
    const i = ln.search(/\d+\.\d%/);
    return i < 0 ? null : ln.slice(i);
  };
  const zero = spawnSync(process.execPath, ['tools/probe-guard-cost.mjs', '--packs=docs/artifacts/cbs1s2-band2.bak',
    '--modes=off,L1', '--cost=0', '--games=12', '--feas-games=3'], { encoding: 'utf8', timeout: 300000 });
  eq(zero.status, 0, '零价档探针必须正常退出（实测 status=' + zero.status + '）');
  {
    const zo = tailOf(String(zero.stdout || ''), 'off'), z1 = tailOf(String(zero.stdout || ''), 'L1');
    ok(zo && z1, '探针必须能解析出 off/L1 两行（行形一改，这道门就红着提醒）');
    eq(z1, zo, '`cost=0` 的行为读数必须与对照**逐字相同**（不一样 ⇒ 补丁有观察者效应，或在偷读别的档）');
    ok(String(zero.stdout).indexOf('⛔ 空枪：') >= 0, '零价档必须被自检抓出来（一分钱没拿走 = 这一档没有作用点，不许留成"两档相同 ⇒ 定价无效"的结论）');
  }
  const hot = spawnSync(process.execPath, ['tools/probe-guard-cost.mjs', '--packs=docs/artifacts/cbs1s2-band2.bak',
    '--modes=off,L2', '--cost=99', '--games=12', '--feas-games=3'], { encoding: 'utf8', timeout: 300000 });
  eq(hot.status, 0, '重价档探针必须正常退出（实测 status=' + hot.status + '）');
  {
    const out = String(hot.stdout || '');
    ok(out.indexOf('⛔ 空枪：') < 0, '重价档不许被判成空枪：防御被整条摘光时 `billed=0` 而 `dropped>0`，那正是补丁生效到顶（E23 建台时实测就是这个形状）');
    const dm = out.match(/摘掉菜单项 (\d+)/);
    ok(dm && Number(dm[1]) > 0, '必须打印被摘掉的菜单项数（`dropped` 是这条档唯一的自证）');
    const ho = tailOf(out, 'off'), h2 = tailOf(out, 'L2');
    ok(ho && h2, '重价档必须解析出 off/L2 两行');
    ok(h2.slice(0, h2.indexOf('%') + 1) === '0.0%', '防御被定价 99ep 时【病】栏设防率必须是 0.0%（不是 ⇒ 地形闸没关住防御）');
    const cut = function (t2) { const i = t2.indexOf('‖'); return i < 0 ? t2 : t2.slice(i); };
    ok(cut(h2) !== cut(ho),
      '【强度】栏必须与对照**不同** ⇒ 这是"补丁打进 mirrorHealth 内部调用点"的行为证据（route ② 只包属性层时这里会逐字相同，而那正是我第一版读到的假"定价不影响强度"）：\n     off ' +
      cut(ho).trim() + '\n     L2  ' + cut(h2).trim());
  }
});

t('D106 场A/场B 打印器必须真的能工作（`probe-aggr` 曾长期每行打「读失败」）', function () {
  /* 病（v1.5.133 实测）：`tools/probe-aggr.mjs` 读的字段名与 `audit-lib.aggressionProfile()` 实际返回的
   * 漂移了（它读 `x.atkOld`/`x.dealt`/`x.taken`/`x.rounds`；真源给的是 `atkOldWhitelist`/`dealtPerGame`/
   * `takenPerGame`/`roundsPerGame`）⇒ `undefined.toFixed()` 每行抛错、被 catch 吞成一行「读失败」
   * ⇒ **全仓没有一个能用的场A/场B 打印器**，而这两条轴正是 G4/五道门争论里被反复引用的东西。
   * 本门**真跑一次探针**（1 局），不钉源码文本；同时要求它打印**门禁真正判的那一列**「清场/局」
   * （阈值 ≥0.3 局；D60 明确：场B 判据只能是清场数，胜率是规则红利）—— 原探针只打胜率/平局。 */
  const r = spawnSync(process.execPath, ['tools/probe-aggr.mjs', '1', 'js/bundled-champion-3p.js'],
    { encoding: 'utf8', timeout: 180000 });
  const out = String(r.stdout || '') + String(r.stderr || '');
  ok(r.status === 0, '探针必须正常退出（实测 status=' + r.status + '）');
  ok(out.indexOf('读失败') < 0, '探针输出不许出现「读失败」（= 字段名与真源漂移，整行读数无效）：' +
    out.split('\n').filter(function (l) { return l.indexOf('读失败') >= 0; }).join(' | ').slice(0, 90));
  ok(out.indexOf('清场/局') >= 0, '探针必须打印「清场/局」——那是场B 唯一被门禁判的数（≥0.3/局）');
  /* 真源 → 打印器 的键对账（比钉文本结实：字段名两边一起改才不会红） */
  const Wl = { EpirusRules: R, EpirusState: S, EpirusTrainer: T, EpirusPlay: Play };
  Pol.setRng(T.mulberry32(31337));
  const one = aggressionProfile(Wl, Pol.makePolicy(0.25), 1);
  for (const k of ['fieldA', 'fieldB']) {
    const keys = Object.keys(one[k]);
    ok(keys.indexOf('clearedPerGame') >= 0 && keys.indexOf('jiShare') >= 0 && keys.indexOf('forced') >= 0,
      k + ' 必须带诊断字段（clearedPerGame / jiShare / forced）—— 反事实读数要靠 forced 判空枪');
    ok(one[k].forced === 0, '默认关闭诊断钩子时 ' + k + '.forced 必须是 0（钩子不得改变基线读数）');
  }
});

t('D158 产物必须能自证**实际生效的 EPIRUS_* 配方**（v1.5.226 · 用户批准；千问 E9/E10 就是被这个缺口逼着绕道跑的）', function () {
  /* 病：`meta.recipe` 原先是**手抄名单**（arm/seed/xn2w/kill/trainMode/counterOpps/…）⇒ **新旋钮天生不在里面**
   * （METHODOLOGY 13「白名单两处各写一遍必出事」的同族）。后果很具体：想问"哪根旋钮养出这粒包"，
   * 查 meta 却没有 env ⇒ 只能归因到"抽奖"，并用**前瞻实验绕道**才把问题问出来（千问 E9/E10）。
   * 修法：读集问 `knob-guard.readKeysOf`（与 `enforceKnobs` **同一份**），再取环境里真设了的键 ⇒ 加旋钮不用改这里。 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  ok(/import \{ enforceKnobs, readKeysOf \}/.test(t3), '读集必须来自 knob-guard 单一来源');
  ok(/readKeysOf\(\{ entry: 'tools\/train-3p\.mjs', extraReadKeys: SELF_ENV_KEYS \}\)/.test(t3),
    '必须用**与 enforceKnobs 同一个读集**（entry + SELF_ENV_KEYS），不许另抄一份名单');
  ok(/const EFFECTIVE_ENV = \(function \(\) \{/.test(t3) && /env: EFFECTIVE_ENV, envKeys:/.test(t3),
    '主 meta 的 recipe 必须带 env + envKeys');
  ok(/recipe: \{ env: EFFECTIVE_ENV, envKeys:/.test(t3), 'band meta 也必须带配方（`.bak` 才是长期留存的那份）');
  /* 行为断言：真跑一条小臂，读它写出来的 `.bak` 的 META —— 配方必须**逐键逐值**对上，且只记"真设了的"。
   * ⚠️ 这条 spawn **故意不走缓存**：它要读子进程**产出的文件**（np-cache 的前置要求正好把这类排除在外）。 */
  const d = mkdtempSync(join(tmpdir(), 'd158-'));
  const r = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'], {
    env: Object.assign({}, process.env, {
      EPIRUS_BAND_DIR: d, EPIRUS_ARM: 'd158probe', EPIRUS_KILL_REWARD: '2', EPIRUS_BIGT_CHAIN_W: '0.5'
    }), encoding: 'utf8', timeout: 600000
  });
  eq(r.status, 0, '小臂要跑得通（' + String(r.stderr || '').slice(0, 160) + '）');
  const baks = readdirSync(d).filter(function (f) { return /\.bak$/.test(f); });
  ok(baks.length >= 1, '必须写出至少一粒 band（实测 ' + baks.length + '）');
  const bsrc = readFileSync(join(d, baks[0]), 'utf8');
  const mm = /window\.EPIRUS_CHAMPION_3P_META = (\{[\s\S]*?\});/.exec(bsrc);
  ok(!!mm, 'band .bak 必须带 META');
  const bmeta = JSON.parse(mm[1]);
  ok(bmeta.recipe && bmeta.recipe.env, 'band META 必须有 recipe.env —— 实测 ' + JSON.stringify(bmeta.recipe || null));
  eq(bmeta.recipe.env.EPIRUS_KILL_REWARD, '2', '配方必须逐值记下真设了的旋钮');
  eq(bmeta.recipe.env.EPIRUS_BIGT_CHAIN_W, '0.5', '同上（按字符串形态原样记）');
  eq(bmeta.recipe.env.EPIRUS_ARM, 'd158probe', '臂名也要在配方里');
  ok(bmeta.recipe.env.EPIRUS_XN2W === undefined, '**没设的旋钮不许凭空出现在配方里**（记的是配方，不是默认值）');
  eq(bmeta.recipe.envKeys, Object.keys(bmeta.recipe.env).length, 'envKeys 必须等于 env 的键数（自洽）');
  try { rmSync(d, { recursive: true, force: true }); } catch (e) {}
});

t('D177 champ-audit 缺包必须点名 + 保留其余行 + exit 7（v1.5.270 · §E81）', function () {
  const rGood = spawnSync(process.execPath, ['tools/champ-audit.mjs', 'js/bundled-champion-3p.js'],
    { encoding: 'utf8', timeout: 420000 });
  eq(rGood.status, 0, '只给一个正常包时必须 exit 0（新加的"缺包即失败"不许误伤常规路径）：' + String(rGood.stderr || '').slice(0, 120));
  ok(/^bundled-champion-3p\.js\s+\d/m.test(String(rGood.stdout)), '正常路径必须真的打出行（否则下面那条"保留其余行"是恒真）');
  const rBad = spawnSync(process.execPath, ['tools/champ-audit.mjs', 'js/bundled-champion-3p.js', 'docs/artifacts/__d177_missing__.bak'],
    { encoding: 'utf8', timeout: 420000 });
  eq(rBad.status, 7, '有一个包读不出必须非零退出（缺行 ≠ 量了没测出来）');
  ok(/__d177_missing__/.test(String(rBad.stdout) + String(rBad.stderr)), '要点名**是哪个包**读不出（只报一句 ENOENT 等于没报）');
  ok(/^bundled-champion-3p\.js\s+\d/m.test(String(rBad.stdout)), '坏包**不能带走整张表**：好包那一行必须仍然打出来');
  ok(/整行没量到/.test(String(rBad.stdout) + String(rBad.stderr)), '末尾必须汇总"有几个包整行没量到"');
});

/* ===== D178（qoder 09-28 §E82）：新量具 `probe-human-seat`（1 席"人" vs 4 席被测冠军） =====
 * 动因：仓里两种装配（`eval-5p` 的 1 主体+4 脚本 / G4 的 1 脚本+4 被测）里，**用户实盘那一格从来没有常驻读数**
 * —— G4 虽然就是这个形状，但它的脚本席八格里没有一格是反弹型，而 §E63 量到线上冠军在"4 席纯反弹"场严胜 0%。
 * 钉四条：① 必须**复用** `v2v4-lib.duelAssembly`（不许另写一份装配，否则与 G4 不同尺）；
 * ② 同种子两次必须逐字相同（量具自己先要可复现）；③ 缺包必须点名 + 保留其余行 + 非零退出；
 * ④ 这一格必须有判别力（全行 0% = 尺子坏了，不许读成"冠军无敌"）。 */
t('D178 人类那一席量具（v1.5.271 · §E82）：单一来源装配 + 可复现 + 缺包点名 + 判别力', function () {
  const src = readFileSync('tools/probe-human-seat.mjs', 'utf8');
  ok(/import \{ duelAssembly \} from '\.\/v2v4-lib\.mjs'/.test(src), '① 必须 import v2v4-lib 的 duelAssembly（与 G4 同源）');
  ok(!/autoGameN\(/.test(src), '① 不许自己写装配（第二份实现必然漂移，本仓栽过四次）');
  ok(!/pickDefend \|\|/.test(src) && !/\|\| *B\.pick/.test(src), '① 人类原型不许写兜底链（把"名字写错"伪装成"这原型不赢"）');
  const run = (extra) => spawnSync(process.execPath, ['tools/probe-human-seat.mjs',
    '--packs=js/bundled-champion-3p.js', '--games=40'].concat(extra || []), { encoding: 'utf8', timeout: 420000 });
  const r1 = run(), r2 = run();
  eq(r1.status, 0, '正常包必须 exit 0：' + String(r1.stderr || '').slice(0, 160));
  const nm = ['全程刷反弹', '全程只防御', '只攒不打(农民)', '只枪压制', '攒钱+反弹(会玩)', '重火力+反弹'];
  const out1 = String(r1.stdout);
  for (const k of nm) ok(out1.indexOf(k) >= 0, '② 六个"人类原型"必须都在（缺一个 = 那格静默消失）：' + k);
  ok(/multi/.test(out1) && /long/.test(out1), '② 两个模式都要印（与 G4 同规矩）');
  eq(String(r2.stdout), out1, '② 同 seed0 两次必须逐字相同（量具不可复现 = 读数无意义）');
  ok(!/所有"人"都 0%/.test(out1), '④ 现役包上这一格必须有判别力（全行 0% 时工具自己会警告）');
  const cells = (out1.match(/(\d+\.\d)%\(和\d+%\)/g) || []);
  eq(cells.length, 12, '④ 必须正好 6 原型 × 2 模式 = 12 格（少一格 = 有原型静默失败）');
  const rBad = spawnSync(process.execPath, ['tools/probe-human-seat.mjs',
    '--packs=js/bundled-champion-3p.js,docs/artifacts/__d178_missing__.bak', '--games=20'], { encoding: 'utf8', timeout: 420000 });
  eq(rBad.status, 7, '③ 缺包必须非零退出（缺行 ≠ 量了没测出来）');
  ok(/__d178_missing__/.test(String(rBad.stdout) + String(rBad.stderr)), '③ 要点名是哪个包');
  ok(/== js\/bundled-champion-3p\.js/.test(String(rBad.stdout)), '③ 坏包不许带走整张表');
  const rFlag = spawnSync(process.execPath, ['tools/probe-human-seat.mjs', '--packs=js/bundled-champion-3p.js', '--mode=multi'],
    { encoding: 'utf8', timeout: 120000 });
  eq(rFlag.status, 64, '③ 不认识的 `--mode=` 必须响亮失败（写错开关名不许当默认值跑）');
});

/* ===== D179（qoder 09-28 §E83）：行为剂量表——计数门的粒度从"各自的 W"换成"整族有没有被下达" =====
 * 动因：`bigUses` 那次假零结果（§E65）的同族形状在 `evo.js` 里还留着 8 处，而且这 8 个计数**连剂量字段都不返回**
 * ⇒ "这根杠杆没作用"永远无法否证。更要紧的是**其中 4 根是出厂就开着的**（pierceW .04 / beadW .05 / pressW .03 / ringW .10）
 * ⇒ 现役配方里这 4 项的剂量从未被打印过一次。
 * 钉五条：① 8 个累加点必须都写 `if (DOSE_ON)`，一处都不许留"跟着自己的 W"；
 * ② 8 个**收益项**必须仍各自按自己的 W ⇒ 这才是"逐位不变"的结构保证；
 * ③ 族里有任何一根 W 非零 ⇒ `doseOn===true` 且 8 个读数全是数字（未下达的兄弟也必须给出数，那是对照组）；
 * ④ 整族全 0 ⇒ `doseOn===false` 且读数必须是 **null（未量）**，不许是 0（把"未量"印成 0 就是重新制造这次的事）；
 * ⑤ `train-3p` 的逐代行只在 `r.doseOn` 时印剂量表。 */
t('D183 权重逐位对账工具（v1.5.276 · §E115）：比数组 + 判别力自证 + 缺包点名 + 反恒真', function () {
  const src = readFileSync('tools/probe-pack-identity.mjs', 'utf8');
  ok(/loadChamp\(W, f\)/.test(src) && /x\[i\] !== y\[i\]/.test(src), '① 必须解出权重数组逐元素比（不是文件字节 / 整文件哈希）');
  ok(/self-test/.test(src) && /恒真的比较器/.test(src), '④ 必须带 --self-test 这条反恒真路径');
  const P = function (args) { return spawnSync(process.execPath, ['tools/probe-pack-identity.mjs'].concat(args),
    { encoding: 'utf8', timeout: 120000 }); };
  /* 用两份**门禁自带的 fixture** 造"一对不同"：线上包与 2P 壳/不同 seed 的产物结构不同 ⇒ 数组不同。
   * 为避免依赖 gitignore 的实验产物，这里现造两份临时包：把线上包原样复制一份（必同）与把它某维 +1（必不同）。 */
  const dir = mkdtempSync(join(tmpdir(), 'd183-'));
  const live = readFileSync('js/bundled-champion-3p.js', 'utf8');
  const mm = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\});/.exec(live);
  ok(!!mm, '① 前置：线上包里要能取到权重对象（取不到说明 fixture 变了，本门该红去修 fixture）');
  const obj = JSON.parse(mm[1]);
  const bumped = JSON.parse(JSON.stringify(obj)); bumped.a[0] = (bumped.a[0] || 0) + 1;
  const same = join(dir, 'same.js'), same2 = join(dir, 'same2.js'), diffp = join(dir, 'diff.js');
  writeFileSync(same, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(obj) + ';\n');
  writeFileSync(same2, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(obj) + ';\n');
  writeFileSync(diffp, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(bumped) + ';\n');
  const rEq = P([same, same2]);
  eq(rEq.status, 0, '② 两份内容相同、路径不同的包必须 exit 0：' + String(rEq.stderr || '').slice(0, 140));
  ok(/逐位相同/.test(String(rEq.stdout)), '② 必须报"逐位相同"（并报维度数 n，否则不知道它读了几个数）');
  ok(/n=\d{3,}/.test(String(rEq.stdout)), '② 必须印出维度数 n（一个只读到 0 维的比较器会永远"相同"）');
  const rDup = P([same, same]);
  eq(rDup.status, 7, '⑤ 同一个路径传两次必须**拒**（去重后无对可比 ⇒ "零比较然后 exit 0"就是把没比报成相同）：实得 ' + rDup.status);
  const rNe = P([same, diffp]);
  ok(/不同 \d+\/\d+ 维/.test(String(rNe.stdout)), '② **必须能报出"不同"** —— 只会说相等不叫比较器（这里改了一维）');
  const rST = P([same, same2, '--self-test']);
  eq(rST.status, 7, '④ 全同输入 + --self-test 必须判失败（恒真比较器是本仓最怕的形状）');
  const rMiss = P([same, join(dir, 'nope.js')]);
  eq(rMiss.status, 7, '③ 读不出的包必须非零退出（缺行 ≠ 相同）');
  ok(/nope\.js/.test(String(rMiss.stderr) + String(rMiss.stdout)), '③ 且要点名是哪个包');
});


/* ===== D184（qoder 09-28 §E113）：接力"把起点重新当选"必须**自己喊出来** =====
 * 病（今晚最贵的一条）：§E111 两臂（λ=0.30 × costlyW=0.02 × N=5 × 1200 代）产物与现役**逐位相同**，
 *   而日志一切照常（逐代行、`[band-save] …（当选）`、`已写入 …` 全都在）⇒ 我把起点的读数（炮 2.23 / maxEp 93）
 *   当成了那根旋钮的成绩。机制：种子常驻种群 0 号 + 锚定罚对它恰为 0 ⇒ 它照样进名人堂、照样在终局重验里当选。
 *   v1.5.150 的 band-save 注释六晚前就点名了这件事，但**只补了落盘、没补读数**。
 * 钉三向（都用真跑的迷你臂，fixture 现造在临时目录 ⇒ 不欠 D82 的账）：
 *   ① 正例必须喊 + `meta.productIsSeed=true`；② **反例必须能不喊**（换成全 0 的起点、训够代 ⇒ `false`）——
 *      没有这条，"永远喊"与"永远不喊"一样是恒真；③ 冷启动必须是 `null`（"没起点"≠"产物等于起点"）。 */
t('D186 序列机会率探针（v1.5.278 · §E122）：原样交回 + 复现/中性/守恒/判别力四自证 + 两档口径', function () {
  const src = readFileSync('tools/probe-seq-opportunity.mjs', 'utf8');
  ok(/rejectUnknownFlags\(process\.argv\.slice\(2\), \['packs', 'games', 'n', 'seed', 'self-test', 'json'\]/.test(src),
    '① 参数守卫必须走 `rejectUnknownFlags`（D160 那条：写错开关名不许当默认值跑）');
  ok(/const r = base\(st, pid, legal\)/.test(src) && /return r;/.test(src) && /return r2;/.test(src),
    '① 观察点必须把真 chooser 的返回**原样交回**（重造对象会吞掉 target ⇒ 探针改玩法，测的就不是这个包了）');
  ok(!/return \{ key:/.test(src), '① 反向哨兵：源码里不许出现"重造返回对象"的写法（我第一版就是这么错的）');
  ok(/armed !== c\.notOffered \+ c\.notAfford \+ c\.opp/.test(src) && /c\.opp !== c\.taken \+ c\.missed/.test(src),
    '② 计数守恒必须自己检查（不守恒 = 尺坏了，读数作废）');
  ok(/runOnce\(params, cal\.mk, GAMES, SEED0, false\)/.test(src), '③ 必须有"摘掉观察者再跑一遍"的中性对照');
  ok(/firedReal/.test(src), '④ 必须另数**事件里的真开炮**（只信意图计数就是 §E121 那个错的复刻）');
  /* ⑥ 电珠账目（§E123 新增）：**"按下蓄能"≠"得到珠"** ⇒ 意图计数 `charges` 会把被引擎换掉的那一半也算进去，
   *   所以必须同时有 `beadGained`（事件 delta>0）与 `refresh`（R9 引注的"已持珠再蓄能只刷新"），并如实打印差额 Δ、
   *   Δ 过大时拒发账目（但**不拖累** armed/opp/taken 这些直接观测）。 */
  ok(/beadGained/.test(src) && /refresh/.test(src) && /c\.delta = \(c\.beadGained - c\.refresh\)/.test(src),
    '⑥ 电珠流必须有"得到/刷新/差额"三项（缺任何一项就会把意图读成结果 —— §E122 我犯的正是这个）');
  ok(/0\.25 \* Math\.max\(1, c\.beadGained - c\.refresh\)/.test(src),
    '⑥ Δ 超阈必须拒发账目（差额大到不能当描述用时，不许装作还能引）');
  ok(/CALIBERS = \[/.test(src) && src.indexOf('0.35, 0.15') > 0 && src.indexOf("0.15, 0.2, 5, 'soft'") > 0,
    '⑤ 两档口径必须都在（序列窗锁只在 soft 生效 ⇒ 只报一档就是撒谎）');

  const P = function (args) {
    return spawnSync(process.execPath, ['tools/probe-seq-opportunity.mjs'].concat(args), { encoding: 'utf8', timeout: 600000 });
  };
  const bad = P(['--nonsense=1']);
  eq(bad.status, 64, '② 不认识的 `--` 参数必须 exit 64（实得 ' + bad.status + '）');
  const miss = P(['--packs=no/such/pack.bak', '--games=40']);
  eq(miss.status, 7, '③ 包读不出必须 exit 7（"读不到"不许被读成"机会率 0"）：实得 ' + miss.status);
  ok(/no\/such\/pack\.bak/.test(String(miss.stderr)), '③ 且要点名是哪个包');
  const okRun = P(['--packs=js/bundled-champion-3p.js', '--games=40']);
  eq(okRun.status, 0, '④ 现役包（含四道自证）必须跑通（exit=' + okRun.status + ' ' + String(okRun.stderr || '').slice(0, 160) + '）');
  ok(/判别力自证 @train/.test(String(okRun.stdout)) && /判别力自证 @product/.test(String(okRun.stdout)),
    '④ 判别力自证必须两档口径都跑（均匀策略对照必须与真包不同 ⇒ "机会率 0"才不是"探针没在看"）');
  ok(/训练评分口径/.test(String(okRun.stdout)) && /产品口径/.test(String(okRun.stdout)), '⑤ 输出必须同时给两档口径的表');
  const dup = P(['--packs=js/bundled-champion-3p.js,js/bundled-champion-3p.js', '--games=40']);
  eq(dup.status, 0, '⑥ 同一粒包传两次必须跑通（这不是"零比较"，是**确定性**自证）：实得 ' + dup.status);
  const rows = String(dup.stdout).split('\n').filter(function (l) { return /bundled-champion-3p\.js/.test(l); });
  /* 形状（§E123 之后）：每档口径印**两块**（机会率表 + 电珠流水账）× 两行（同粒包传两次）= 8 行 */
  eq(rows.length, 8, '⑥ 两档口径 × 两块表 × 两行 = 8 行读数（实测 ' + rows.length + ' 行 ⇒ 表的形状变了，本门的基准要跟着改，别把它改成"只要非空就过"）');
  eq(rows[0], rows[1], '⑥ 同一粒包同尺同种子 ⇒ 机会率表两行必须**逐字相同**（不同就说明读数里混了未播种的随机）');
  eq(rows[2], rows[3], '⑥ 电珠流水账两行同理（Δ 也必须相同，否则账目本身依赖运行顺序）');
  eq(rows[4], rows[5], '⑥ 第二档口径的机会率表同理');
  eq(rows[6], rows[7], '⑥ 第二档口径的流水账同理');
  ok(/Δ=/.test(String(dup.stdout)), '⑥ 电珠账目的差额 Δ 必须印出来（不守恒却"看起来平衡"是最坏的形状）');
});


t('D192 判定读数自带噪声尺（v1.5.287 · DS 清单第 8 条后半）：区间在边界不塌、n 小就变大、量不出不装 0', function () {
  /* 单一来源在 audit-lib（gate-drafts 只 import，不另抄公式 —— METHODOLOGY 35）。
   * 这条门判的是**这把尺自己有没有牙**，不是它印得好看。 */
  const c = AUDIT.ci95pt, tag = AUDIT.ci95tag;
  eq(typeof c, 'function', '① audit-lib 必须导出 ci95pt');
  eq(typeof tag, 'function', '① 与 ci95tag（打印形态只有一处定义）');
  /* ② 反"边界塌成 ±0.0"：裸 Wald 在 0%/100% 会给 ±0.0 ⇒ 被读成极其精确。add-2 调整不许这样 */
  ok(c(0, 300) > 0.5, '② 读数 0% 也必须给出非零区间（实测 ' + c(0, 300) + ' ⇒ 裸 Wald 就是 0，那是在装精确）');
  ok(c(100, 300) > 0.5, '② 读数 100% 同上（实测 ' + c(100, 300) + '）');
  /* ③ 判别力：n 变小 ⇒ 区间必须变大，且方向单调（否则"噪声尺"不随样本量动 = 装饰） */
  const s60 = c(62, 60), s300 = c(62, 300), s1000 = c(62, 1000);
  ok(s60 > s300 && s300 > s1000 && s60 > 2 * s300,
    '③ 同一读数下 n=60 的区间必须明显大于 n=300 且大于 n=1000（实测 ' + s60 + ' / ' + s300 + ' / ' + s1000 + '）');
  /* ④ 量不出就说量不出：坏 n / 坏 pct 一律 null，且打印形态不许出现 ±0.0 */
  eq(c(50, 1), null, '④ n<2 必须 null（单样本没有区间）');
  eq(c(-3, 300), null, '④ 非法读数必须 null');
  eq(c('abc', 300), null, '④ 非数值必须 null（不许 NaN 混进打印）');
  ok(tag(50, 1).indexOf('±?') === 0, '④ 打印形态在量不出时写 `±?…` 而不是 ±0.0');
  /* ⑤ 消费点必须真在用（只导出不用 = 第二把没人读的尺，本仓 §24 那族） */
  const gd = readFileSync('tools/gate-drafts.mjs', 'utf8');
  ok(/import \{ ci95tag, ci95pt \} from '\.\/audit-lib\.mjs'/.test(gd), '⑤ gate-drafts 必须 import 这两个（不许在工具里再抄一遍公式）');
  ok((gd.match(/ci95tag\(/g) || []).length >= 3, '⑤ G4 最克格 / G4 基线格 / G5 三处读数都要带尺（实测 ' + (gd.match(/ci95tag\(/g) || []).length + ' 处调用）');
  ok(/阈值 25% 落在 95% 区间内|落在这一格的 95% 区间内/.test(gd),
    '⑤ **判定线落在区间内时必须明说"红/绿由抽样决定"** —— 只印 ±SE 不点名，读的人还是会当结论');
  /* ⑥ 行为：真跑一次小 n 的 gate-drafts，输出里必须出现噪声尺（判在输出上，不判在源码上） */
  const rg = spawnSync(process.execPath, ['tools/gate-drafts.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24,
    env: Object.assign({}, process.env, { GATE3_GAMES: '20', GATE4_GAMES: '20', GATE6_GAMES: '4' })
  });
  const gout = String(rg.stdout || '');
  ok(rg.stdout && rg.stdout.length > 800, '⑥ 前置：量具必须真跑出正文（长度 ' + String(rg.stdout || '').length +
    '，status=' + rg.status + '）——**没跑完不许被读成"尺没印"**');
  ok(/噪声尺：/.test(gout), '⑥ 实际输出里必须有"噪声尺"');
  ok(/±\d+\.\dpt\(95%,n=20\)/.test(gout), '⑥ 且带上具体的 n（没有 n 的 ±x 等于没给口径）');
});

t('D193 多包路由收益的算式有牙（v1.5.288-289 · §E129/§E130/§E131）：分支全覆盖、绝对阈值不许回来、印出来的分支必须等于重算的分支、并列与弃权都不许偷偷改分母', function () {
  /* 这条门**不判科学结论**（R 是多少由 §E129 的记录负责），只判三件事：
   *   ① 判读函数的每条分支都走得到、边界值不许含混；
   *   ② 我预注册写错的那条**绝对 25% 阈值**不许回来（27 类时 13% 是"有信息"的，旧规则在这里判了"路由不可实现"，
   *      而同一次运行的 realizable > best_single 说明钱真赚到了 ⇒ 两条判词互相打脸）；
   *   ③ 矩阵读不出、环境被排空时必须**拒绝出结论**，不许拿空表算上界。
   * 变异实测（把 `isInformative` 换回旧的绝对阈值）⇒ ② 的两条红；开发台 47 断言全绿后才搬进本文件。 */
  for (const fn of ['routingReadings', 'bestInByEnv', 'bestSingleOf', 'realizableOf', 'chanceOf', 'isInformative', 'branchOf', 'matrixComplaint', 'pairedDiff']) {
    ok(typeof RGAIN[fn] === 'function', '① routing-gain-lib 必须导出 ' + fn + '（算式只许这一处）');
  }
  const B = RGAIN.BRANCHES;
  /* ---- ② 合成表：完美路由器的 R 恰好 1；没预测 ⇒ ⑥；全平 ⇒ ⑤ ---- */
  const E6 = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
  const row = (pack, f) => ({ pack: pack, per: Object.fromEntries(E6.map((e, i) => [e, { fit: f[i] }])) });
  const ROWS = [
    row('A', [0.90, 0.30, 0.30, 0.30, 0.30, 0.30]), row('B', [0.20, 0.85, 0.20, 0.20, 0.20, 0.20]),
    row('C', [0.20, 0.20, 0.80, 0.75, 0.20, 0.20]), row('D', [0.10, 0.10, 0.10, 0.10, 0.10, 0.60]),
  ];
  const BI = RGAIN.bestInByEnv(ROWS, E6);
  eq(BI.e1, 'A', '② 每个环境的最佳包要挑对');
  const perf = RGAIN.routingReadings({ rows: ROWS, envs: E6, bestIn: BI, picks: Object.fromEntries(E6.map((e) => [e, e])), acc: 0.9, placebo: 0.05, fallbackPack: 'A' });
  ok(perf.oracle >= perf.bestSingle, '② oracle 不许低于 best_single（上界是"每环境各挑各的"，一定不差于一招鲜）');
  eq(perf.R, 1, '② 完美路由器（picks=真环境）的 R 必须恰好 1');
  eq(perf.branch, B.WORTH, '② R=1 且有分辨力 ⇒ 必须判 ②');
  /* "一个预测都没有"在新口径下**不是**"读数不全"：路由器什么都没换 ⇒ `realizable` 逐位等于 `best_single` ⇒ R=0。
   * （v1.5.288 的老断言判的是 ⑥，那是彼时"没预测的环境被整条跳过"的口径 —— §E131 量到 R=2.81 才暴露那套均值不可比。） */
  const none = RGAIN.routingReadings({ rows: ROWS, envs: E6, bestIn: BI, picks: {}, acc: 0.9, placebo: 0.05, fallbackPack: BI.e1 });
  ok(none.realizable === none.bestSingle, '② 一个预测都没有 ⇒ realizable 必须**逐位等于** best_single（实测 ' + none.realizable + ' vs ' + none.bestSingle + '）');
  eq(none.R, 0, '② 那台路由器等于什么都没做 ⇒ R 必须是 0，不许是"未量到"（"没做"与"没量到"是两件事）');
  eq(none.branch, B.NEEDS_NET, '② R=0 且有分辨力 ⇒ 判 ④（钱要靠网络内部条件化），这是**允许**的结论形状');
  let threw = false;
  try { RGAIN.realizableOf(ROWS, E6, BI, {}, 'fit'); } catch (e) { threw = /必须有 fallbackPack/.test(e.message); }
  ok(threw, '② **不给 fallbackPack 必须抛**：没有预测的环境被跳过 ⇒ realizable 与 oracle 就不是同一批环境 ⇒ 这正是 §E131 那次 R=2.81 的成因');
  const over = RGAIN.routingReadings({ rows: ROWS, envs: E6, bestIn: BI, picks: Object.fromEntries(E6.map((e) => [e, e])), acc: 0.9, placebo: 0.05, fallbackPack: 'A' });
  ok(over.realizable <= over.oracle + 1e-12, '② 构造保证 realizable ≤ oracle（越线就说明链路又变成两套均值比大小）');
  const FLAT = [row('X', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), row('Y', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), row('Z', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5])];
  const flat = RGAIN.routingReadings({ rows: FLAT, envs: E6, bestIn: RGAIN.bestInByEnv(FLAT, E6), picks: Object.fromEntries(E6.map((e) => [e, e])), acc: 0.9, placebo: 0, fallbackPack: 'X' });
  eq(flat.branch, B.NO_EDGE, '② 上界缺口 < 0.02 ⇒ 必须判 ⑤（不必谈 R）');
  eq(flat.R, null, '② 判 ⑤ 时 R 必须是 null，不许印 0（0 会被读成"路由赚不到钱"）');
  /* ---- ③ 分支函数：四个带的上下边界 + 两条优先级 ---- */
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: true, informative: true, R: 0.50 }), B.WORTH, '③ R=0.50 在 ② 的界上（含）');
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: true, informative: true, R: 0.49 }), B.HALF, '③ R=0.49 掉进 ③');
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: true, informative: true, R: 0.20 }), B.HALF, '③ R=0.20 在 ③ 的界上（含）');
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: true, informative: true, R: 0.19 }), B.NEEDS_NET, '③ R=0.19 掉进 ④');
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: true, informative: false, R: 0.90 }), B.NO_SIGNAL, '③ 签名没分辨力时 R 再大也不许判"值得做"');
  eq(RGAIN.branchOf({ gap: 0.019, readingsOk: true, informative: true, R: null }), B.NO_EDGE, '③ 缺口太小 ⇒ ⑤ 优先');
  eq(RGAIN.branchOf({ gap: 0.10, readingsOk: false, informative: true, R: null }), B.NO_READING, '③ 读数不全 ⇒ ⑥ 优先于收益判断');
  /* ---- ④ 核心那条：§E129 的读数在这把尺下必须是"有信息"，旧的绝对 25% 不许回来 ---- */
  const CH27 = RGAIN.chanceOf(27);
  ok(RGAIN.isInformative(0.1267, CH27, 0.0047) === true, '④ §E129 主读数（准确率 12.7% / 随机 3.7% / placebo 0.5%）必须判"有分辨力"');
  ok(RGAIN.isInformative(0.24, CH27, 0) === true, '④ 准确率 24%（低于旧的 25% 绝对阈值）在 27 类下仍是**有信息** ⇒ 绝对阈值不许回来');
  ok(RGAIN.isInformative(0.05, CH27, 0.04) === false, '④ 只比随机高一点点（5% vs 3.7%）⇒ 必须判"没有分辨力"');
  ok(RGAIN.isInformative(NaN, CH27, 0) === false, '④ 准确率没量到 ⇒ 不许判有信息');
  ok(RGAIN.isInformative(0.20, RGAIN.chanceOf(2), 0.19) === false, '④ 两类问题里 20% 低于随机 50% ⇒ 没信息（placebo 参与取大）');
  /* ---- ⑤ 矩阵读不出就拒绝 ---- */
  ok(/不足 3 粒/.test(RGAIN.matrixComplaint(ROWS.slice(0, 2), E6) || ''), '⑤ 只有 2 粒包 ⇒ 拒绝并说清为什么');
  ok(/包名读不出/.test(RGAIN.matrixComplaint([{ per: {} }, { per: {} }, { pack: '', per: {} }], E6) || ''), '⑤ 有行没名字 ⇒ 拒绝（矩阵改键时不许静默用无名行）');
  ok(/环境数不足/.test(RGAIN.matrixComplaint(ROWS, ['a', 'b', 'c']) || ''), '⑤ 环境不足 4 ⇒ 拒绝');
  eq(RGAIN.matrixComplaint(ROWS, E6), null, '⑤ 合格的表必须放行');
  /* ---- ⑥ 消费点：探针必须用这把尺，且不许留第二份公式 ---- */
  const probeSrc = readFileSync('tools/probe-regime-identifiability.mjs', 'utf8');
  ok(/from '\.\/routing-gain-lib\.mjs'/.test(probeSrc), '⑥ 探针必须 import routing-gain-lib');
  ok(!/R\s*=\s*\(realizable\s*-/.test(probeSrc), '⑥ 探针里不许再抄一份 R 的公式');
  ok(!/acc\s*<\s*0\.25/.test(probeSrc) && !/改观测面是唯一路/.test(probeSrc), '⑥ 旧的 25% 绝对阈值判词必须已从探针里删干净');
  ok(/nearestDistinct\(s\.v, pool, s, dist\)/.test(probeSrc),
    '⑥ 探针的最近邻必须走 `routing-gain-lib.nearestDistinct`（**并列怎么裁决**这件事只许有一处定义）');
  /* ---- ⑩ 并列裁决与弃权闸（§E131 那两处读数错误的直接补丁，判在纯函数上）---- */
  const dv = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) * (x - b[i]), 0));
  const P1 = { v: [1, 0], env: 'x' }, P2 = { v: [1, 0], env: 'y' }, P3 = { v: [1, 0], env: 'x' }, P4 = { v: [0, 1], env: 'z' };
  const nd1 = RGAIN.nearestDistinct(P1.v, [P1, P2, P3, P4], P1, dv);
  ok(nd1.ambiguous === true && nd1.env === null,
    '⑩ 并列来自**不同环境** ⇒ 必须判歧义、不给预测（原先按遍历顺序取第一个最小距离 ⇒ §E129 那个 13% 里有一部分是顺序给的假分辨力）');
  const nd2 = RGAIN.nearestDistinct(P1.v, [P3, P4], P1, dv);
  ok(nd2.ambiguous === false && nd2.env === 'x', '⑩ 同环境内部的逐位重复**不算歧义**（那正是"同一个原型"，不许把它判成不可辨）');
  const nd3 = RGAIN.nearestDistinct([0.9, 0.1], [{ v: [1, 0], env: 'a' }, { v: [0, 1], env: 'b' }], null, dv);
  ok(nd3.ambiguous === false && nd3.env === 'a' && Math.abs(nd3.d - Math.sqrt(0.02)) < 1e-9,
    '⑩ 明显更近的那个要照单收下（歧义判定不许退化成"一律不给答案"）');
  eq(RGAIN.branchOf({ gap: 0.1, readingsOk: true, informative: true, R: 0.3, abstainOn: true, nSwitch: 4, minSwitch: 5 }), B.DEGENERATE,
    '⑩ 弃权版只换 4 个环境 ⇒ ⓪ "没有结论"（§E131 跑前写死的反退化条款）');
  eq(RGAIN.branchOf({ gap: 0.1, readingsOk: true, informative: true, R: 0.3, abstainOn: true, nSwitch: 5, minSwitch: 5 }), B.HALF,
    '⑩ 换满 5 个才进入正常判读（边界含）');
  eq(RGAIN.branchOf({ gap: 0.1, readingsOk: true, informative: true, R: 0.3, abstainOn: false, nSwitch: 0, minSwitch: 5 }), B.HALF,
    '⑩ 没开弃权闸时 ⓪ 不许介入（§E129/§E130 的读数靠这条保住口径）');
  eq(RGAIN.medianOf([]), null, '⑩ 空样本的中位数必须是 null（不许印 0 冒充量到）');
  const sh = RGAIN.shareOf({ a: 30, b: 10 });
  ok(Math.abs(sh.share - 0.75) < 1e-9 && sh.top === 'a', '⑩ share 算的是众数占比（0.75），不是票数');
  ok(RGAIN.decideSwitch('dist', { nnMed: 0.001, tau: 0, share: 1 }).canSwitch === false, '⑩ dist：比 τ 远一点就不许换（τ=0 时只有逐位重合才允许）');
  ok(RGAIN.decideSwitch('share', { nnMed: 0, tau: 0, share: 0.49 }).canSwitch === false, '⑩ share 差一点也不许换（0.49 < 0.5）');
  ok(RGAIN.decideSwitch('off', { nnMed: 9, tau: 0, share: 0 }).canSwitch === true, '⑩ off 不改任何旧读数（默认口径不许被新闸偷偷挪动）');
  /* ---- ⑦ 行为：真跑一次（合成矩阵 + opp-pool 现取的环境名），**印出来的分支必须等于用同一批数重算的分支** ----
   * 复算用的 R 必须由未取整的 realizable/bestSingle/gap 推出，**不能**用 json 里那个取整过的 `R`：
   * 取整值恰好压在带边界上（真实 0.49996 → 印 0.5000）会把分支判到隔壁一档 ⇒ **门自己**在正确的代码上假红。
   * 这条是变异实测撞出来的，不是设想出来的。 */
  const dir = mkdtempSync(join(tmpdir(), 'd193-'));
  try {
    const specs = Array.isArray(OPP_SPECS) ? OPP_SPECS : Object.values(OPP_SPECS);
    /* 8 个环境（不是 5）：合成表要让**命中率非零**，否则 ⑨″ 那条"链路命中率不许整体塌成 0"
     * 会在一份全都歧义的表上变成空转（实测 5 个环境时 acc=0 ⇒ 装饰；8 个时 acc≈23% ⇒ 有牙）。 */
    const names = specs.slice(0, 8).map((s) => s.name);
    const synth = { rows: names.map((nm, i) => ({ label: nm, per: Object.fromEntries(names.map((e, j) => [e, { fit: i === j ? 0.95 : 0.30 }])) })) };
    const mf = join(dir, 'matrix.json');
    writeFileSync(mf, JSON.stringify(synth));
    const run = (extra, out) => spawnSync(process.execPath, ['tools/probe-regime-identifiability.mjs', '--matrix=' + mf, '--games=6', '--k=3'].concat(extra, out ? ['--json=' + out] : []),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 300000, maxBuffer: 1 << 24 });
    const jf = join(dir, 'out.json');
    const r1 = run([], jf);
    const o1 = String(r1.stdout || '');
    ok(r1.status === 0 && o1.length > 300, '⑦ 前置：探针必须真跑出正文（status=' + r1.status + '，长度 ' + o1.length + '）——没跑完不许把"分支对不上"当结论');
    const j = JSON.parse(readFileSync(jf, 'utf8'));
    ok(j.meta.envs >= 4, '⑦ 前置：合成矩阵至少 4 个有效环境（实测 ' + j.meta.envs + '）');
    ok(j.oracle >= j.bestSingle, '⑦ 实跑也必须满足 oracle ≥ best_single');
    const Rcalc = (j.realizable - j.bestSingle) / j.gap;
    eq(j.chance, RGAIN.chanceOf(j.meta.envs), '⑦ json 的随机基线必须等于 1/参与判定环境数');
    eq(j.informative, RGAIN.isInformative(j.acc, j.chance, j.placebo), '⑦ json 的"有分辨力"必须能由它自己的三个数重算出来');
    ok(j.gap < 0.02 || Math.abs(j.R - Rcalc) < 1e-3, '⑦ json 印的 R 与复算的 R 必须一致（实测 ' + j.R + ' vs ' + Rcalc + '）');
    eq(j.branch, RGAIN.branchOf({ gap: j.gap, readingsOk: isFinite(j.realizable) && isFinite(j.acc), informative: j.informative, R: Rcalc }),
      '⑦ **印出来的分支 = 用同一批数重算的分支**');
    const vline = o1.split('\n').filter(l => /判读：/.test(l))[0] || '（输出里没有判读行）';
    ok(new RegExp('^\\s*判读：' + j.branch).test(vline), '⑦ 屏幕上的判读开头必须是 json 里那个分支符（实测：' + vline.trim().slice(0, 60) + '）');
    const n1 = Number((o1.match(/参与判定环境 (\d+) 个/) || [])[1]);
    const n2 = Number((String(run(['--exclude=' + names[0]]).stdout || '').match(/参与判定环境 (\d+) 个/) || [])[1]);
    ok(isFinite(n1) && isFinite(n2) && n2 === n1 - 1, '⑦ --exclude 一个真环境 ⇒ 参与判定环境必须少 1 个（实测 ' + n2 + ' vs ' + n1 + '）');
    const o3 = String(run(['--exclude=zzz-not-an-env']).stdout || '');
    const n3 = Number((o3.match(/参与判定环境 (\d+) 个/) || [])[1]);
    ok(/typo/.test(o3) && n3 === n1, '⑦ 排除一个不存在的名字 ⇒ 必须点名"typo？忽略"，且参与判定环境与不排除时相同（实测 ' + n3 + ' vs ' + n1 + '）');
    ok(run(['--exclude=' + names.join(',')]).status === 2, '⑦ 把环境全排除 ⇒ 必须 exit 2 拒绝出结论');
    ok(spawnSync(process.execPath, ['tools/probe-regime-identifiability.mjs', '--games=2'], { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 }).status === 2,
      '⑦ 不给 --matrix ⇒ 必须 exit 2');
    /* ---- ⑧ `--metric=` 必须真的换列打分（不是被忽略），拼错的量纲必须响亮拒 ----
     * 这是 §E130 的整条依据：同一套预测在 `fit` 与 `win` 上读出 R=0.235 与 R=0.14 两个结论。
     * 若这个参数被静默忽略，两个"口径"其实是同一个数 ⇒ 那条更正就是假的。 */
    const mf2 = join(dir, 'matrix2.json');
    /* 这张合成表是**故意设计成有对比度**的（第一版没有，于是一条断言成了装饰 —— 变异实测抓出来的）：
     * `pack[0]` 两个量纲上都平（fit 0.55 / win 0.20），`pack[i≥1]` 只在自己那一格尖（fit 0.95 / win 0.90）
     * ⇒ `fit` 的一招鲜 = pack0，而 `win` 的一招鲜 = 某个尖包 ⇒ ⑧ 的"换列必须换数"量得出；
     * ⇒ 且 per-env 最佳包 ≠ 那一招鲜 ⇒ ⑨ 的"链路均值 = 印出来的均值"也量得出。 */
    writeFileSync(mf2, JSON.stringify({ rows: names.map((nm, i) => ({
      label: nm,
      per: Object.fromEntries(names.map((e, j) => [e,
        i === 0 ? { fit: 0.55, win: 0.20 }
          : { fit: j === i ? 0.95 : 0.10, win: j === i ? 0.90 : 0.05 }]))
    })) }));
    const run2 = (extra, out) => spawnSync(process.execPath, ['tools/probe-regime-identifiability.mjs', '--matrix=' + mf2, '--games=6', '--k=3'].concat(extra, out ? ['--json=' + out] : []),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 300000, maxBuffer: 1 << 24 });
    const jfFit = join(dir, 'm-fit.json'), jfWin = join(dir, 'm-win.json');
    const rFit = run2(['--metric=fit'], jfFit), rWin = run2(['--metric=win'], jfWin);
    ok(rFit.status === 0 && rWin.status === 0, '⑧ 前置：两个量纲都要跑完（fit status=' + rFit.status + '，win status=' + rWin.status + '）');
    const jFit = JSON.parse(readFileSync(jfFit, 'utf8')), jWin = JSON.parse(readFileSync(jfWin, 'utf8'));
    eq(jWin.meta.metric, 'win', '⑧ json 必须记下用的哪个量纲');
    ok(/打分量纲 = \*\*win\*\*/.test(String(rWin.stdout || '')), '⑧ 屏幕上必须印出量纲（换列打分这件事不许只藏在 json 里）');
    ok(jWin.bestSinglePack !== jFit.bestSinglePack || Math.abs(jWin.bestSingle - jFit.bestSingle) > 1e-6,
      '⑧ **同一套预测、换一列打分必须读出不同的数**（实测 fit ' + jFit.bestSinglePack + '/' + jFit.bestSingle + ' vs win ' + jWin.bestSinglePack + '/' + jWin.bestSingle + '）⇒ 一模一样就说明 `--metric` 被忽略了');
    ok(jFit.realizable !== jWin.realizable, '⑧ realizable 也必须随量纲变（实测 ' + jFit.realizable + ' vs ' + jWin.realizable + '）');
    const rBad = run2(['--metric=winn']);
    ok(rBad.status === 2 && /不认识的量纲/.test(String(rBad.stderr || '')),
      '⑧ 拼错的量纲必须 exit 2 并点名（实测 status=' + rBad.status + '）⇒ 读出一列 undefined 比红危险得多');
    /* ---- ⑨ `--dump=` 的逐环境链路必须与印出来的均值**是同一笔算术**，且区间量具读得动它 ----
     * §E130 那句"增益与 0 不可分"全靠这份链路能对上账；对不上就是拿另一套数算的区间。 */
    const dp = join(dir, 'dump.json'), jdp = join(dir, 'dumpmeta.json');
    const rd = run2(['--metric=fit', '--dump=' + dp], jdp);
    ok(rd.status === 0 && existsSync(dp), '⑨ 前置：--dump 必须真写出文件（status=' + rd.status + '）');
    const DM = JSON.parse(readFileSync(dp, 'utf8')), JD = JSON.parse(readFileSync(jdp, 'utf8'));
    ok(Array.isArray(DM.perEnv) && DM.perEnv.length === JD.meta.envs,
      '⑨ 逐环境条数必须等于参与判定环境数（实测 ' + (DM.perEnv || []).length + ' vs ' + JD.meta.envs + '）');
    const mOf = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const got = DM.perEnv.filter(r => typeof r.chosen.fit === 'number').map(r => r.chosen.fit);
    const inc = DM.perEnv.map(r => r.incumbent.fit);
    ok(got.length === JD.realizableN, '⑨ 链路里"真拿到包"的环境数必须等于 json 的 realizableN（实测 ' + got.length + ' vs ' + JD.realizableN + '）');
    ok(Math.abs(mOf(got) - JD.realizable) < 1e-9,
      '⑨ 链路的 chosen 均值必须等于印出来的 `realizable`（实测 ' + mOf(got) + ' vs ' + JD.realizable + '）⇒ 链路落的数与印出来的数不是同一笔算术，区间就是假的');
    ok(Math.abs(mOf(inc) - JD.bestSingle) < 1e-9,
      '⑨ 链路的 incumbent 均值必须等于印出来的 `best_single`（实测 ' + mOf(inc) + ' vs ' + JD.bestSingle + '）');
    ok(Math.abs(mOf(got) - mOf(inc) - (JD.realizable - JD.bestSingle)) < 1e-9,
      '⑨ 两者之差（配对均值）必须等于 `realizable − best_single`');
    ok(DM.perEnv.every(r => r.env && typeof r.acc === 'number'), '⑨ 每条链路要带环境名与该环境命中率（聚类区间要用）');
    /* ⑨″ dump 的逐环境命中率必须与 json 的总命中率**是同一个量**，而且不许整体塌成 0。
     * 动因（真实事故）：`nearestOther` 从返回字符串改成返回对象之后，链路里的 `nn === s.env` 恒 false
     * ⇒ **每个环境命中率都成 0**、工具不崩、别的字段全都正常 ⇒ 聚类区间那条读数悄悄废掉。
     * 只判"字段存在"挡不住这种错（0 也是 number），必须判**它与总量对得上、并且不恒为 0**。 */
    const wsum = DM.perEnv.reduce((s, r) => s + r.acc * r.n, 0), wtot = DM.perEnv.reduce((s, r) => s + r.n, 0);
    ok(wtot > 0 && Math.abs(wsum / wtot - JD.acc) < 1e-9,
      '⑨″ 链路命中率的**样本加权均值**必须等于 json 的总准确率（实测 ' + (wtot ? wsum / wtot : NaN) + ' vs ' + JD.acc + '）');
    ok(JD.acc === 0 || DM.perEnv.some(r => r.acc > 0),
      '⑨″ json 说准确率不是 0（实测 ' + JD.acc + '）⇒ 链路里至少要有一个环境的命中率 > 0；两者不一致就是**形状改了之后的死代码**（不是"真的都没认出来"）');
    const an = spawnSync(process.execPath, ['tools/analyze-routing-gain.mjs', dp], { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 });
    ok(an.status === 0 && /95% \[/.test(String(an.stdout || '')) && /变好 \d+ ‖ 变差 \d+/.test(String(an.stdout || '')),
      '⑨ 区间量具必须读得动这份 dump，并印出 95% 区间与**逐环境好/差分布**（实测 status=' + an.status + '）');
    /* ⑨′ 同一件事在**弃权版**上再验一遍：`门槛过了但没有票` 的环境也必须"实际打一粒包"（落回一招鲜），
     * 不许留 null —— 留 null 就是把这个环境从均值里悄悄删掉，而 json 的 realizable 却按"落回"算 ⇒ 两笔算术。
     *（这一条是 §E131 第一次撞到之后补的，形如"dump 与均值不一致"的错在本仓已经出现过三次。）*/
    const dp2 = join(dir, 'dump-abstain.json'), jdp2 = join(dir, 'dumpmeta-abstain.json');
    const rd2 = run2(['--metric=win', '--abstain=dist', '--dump=' + dp2], jdp2);
    ok(rd2.status === 0 && existsSync(dp2), '⑨′ 前置：弃权版也必须跑完并落下 dump（status=' + rd2.status + '，' + String(rd2.stderr || '').slice(0, 90) + '）');
    const DM2 = JSON.parse(readFileSync(dp2, 'utf8')), JD2 = JSON.parse(readFileSync(jdp2, 'utf8'));
    ok(DM2.perEnv.every(r => r.chosen && typeof r.chosen.win === 'number' && typeof r.chosen.fit === 'number'),
      '⑨′ 每个参与打分的环境都要有"**实际打的那一粒**"（弃权 ⇒ 落回一招鲜，不许 null）：实测 null 条数 '
      + DM2.perEnv.filter(r => !r.chosen || typeof r.chosen.win !== 'number').length);
    const m2 = DM2.perEnv.map(r => r.chosen[JD2.metric || 'win']);
    ok(Math.abs(m2.reduce((s, x) => s + x, 0) / m2.length - JD2.realizable) < 1e-9,
      '⑨′ 弃权版的链路均值必须等于 json 的 realizable（实测 ' + (m2.reduce((s, x) => s + x, 0) / m2.length) + ' vs ' + JD2.realizable + '）');
    ok(DM2.perEnv.filter(r => r.switched).length === JD2.meta.switched,
      '⑨′ 链路里 `switched` 的条数必须等于 json 的 meta.switched（实测 ' + DM2.perEnv.filter(r => r.switched).length + ' vs ' + JD2.meta.switched + '）');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

t('D195 特征可分性这把前置尺有牙（v1.5.290 · §E134）：分得开要能测出来、分不开不许靠"唯一点数多"蒙过去', function () {
  /* 为什么补这道门：§E134 的全部价值在于"它比验收益便宜一个数量级，而且能提前否证一整条方向"。
   * 尺子本身如果没牙（比如把"每条样本都独一无二"误当"原型分得开"），那这条便宜路就会变成**新的假绿灯**。 */
  ok(typeof RGAIN.separabilityOf === 'function', '① routing-gain-lib 必须导出 separabilityOf（判据只许一处定义）');
  ok(typeof RGAIN.euclid === 'function', '① 与 euclid（§E131/§E134 共用同一把距离）');
  const V = (a) => a.slice();
  /* ② 三个离得很远、组内很紧的原型 ⇒ 必须**全部判可分**、歧义率 0、留一准确率 1 */
  const sep3 = { x: [V([0, 0]), V([0.01, 0]), V([0, 0.01]), V([0.01, 0.01])],
    y: [V([10, 0]), V([10.01, 0]), V([10, 0.01]), V([10.01, 0.01])],
    z: [V([0, 10]), V([0.01, 10]), V([0, 10.01]), V([0.01, 10.01])] };
  const r2 = RGAIN.separabilityOf(sep3);
  eq(r2.U_sep, 3, '② 明显分得开 ⇒ U_sep 必须等于原型数（实测 ' + r2.U_sep + '）');
  eq(r2.ambRate, 0, '② 没有跨环境并列 ⇒ 歧义率必须 0');
  eq(r2.acc, 1, '② 留一最近邻必须全中');
  /* ③ 两个逐位重合的原型 ⇒ 必须判**一个都分不开**、歧义率 1（这条钉住"并列不许按顺序裁决"） */
  const same = { p: [V([1, 1]), V([1, 1]), V([1, 1])], q: [V([1, 1]), V([1, 1]), V([1, 1])] };
  const r3 = RGAIN.separabilityOf(same);
  eq(r3.U_sep, 0, '③ 质心重合 ⇒ 必须 0 个可分（实测 ' + r3.U_sep + '）');
  eq(r3.ambRate, 1, '③ 每条样本的最近邻都跨环境并列 ⇒ 歧义率必须 1（不许按遍历顺序编一个答案）');
  eq(r3.acc, 0, '③ 准确率必须 0');
  /* ④ **这条最要紧**：组内极散、质心却挨得很近 ⇒ `U_sample` 很大但 `U_sep` 必须小。
   *    钉住"维度多/样本条条唯一 ≠ 分得开"——这正是我第一节 §E134 差点读错的地方。 */
  const spread = { a: [V([-5, 0]), V([5, 0]), V([0, -5]), V([0, 5])], b: [V([-4, 1]), V([4, 1]), V([1, -4]), V([-1, 4])] };
  const r4 = RGAIN.separabilityOf(spread);
  ok(r4.U_sample >= 7, '④ 前置：这个构造就该"条条样本独一无二"（实测 U_sample=' + r4.U_sample + '）');
  ok(r4.U_sep <= 1, '④ **唯一点数多不算分得开**：组内比组间还远 ⇒ U_sep 必须 ≤1（实测 ' + r4.U_sep + '，U_sample ' + r4.U_sample + '）');
  ok(r4.inseparable.length >= 1 && r4.inseparable[0].ratio <= 1, '④ 分不开的原型要**点名列出来**并给 b/w 比值（实测 ' + JSON.stringify(r4.inseparable[0]) + '）');
  /* ⑤ 只有一条样本的原型：组内没有距离 ⇒ 不许当"可分"（更不许崩） */
  const solo = { m: [V([0, 0])], n: [V([9, 9])] };
  const r5 = RGAIN.separabilityOf(solo);
  eq(r5.U_sep, 0, '⑤ 单样本原型无法算组内距离 ⇒ 判不可分（实测 ' + r5.U_sep + '）');
  eq(r5.nEnvs, 2, '⑤ 原型数照常报');
  /* ⑥ 探针必须用这把尺（而不是自己再写一份）；**行为面（K 有没有真截断、判据的线）由 D196 负责**，这里不重复 spawn */
  const src = readFileSync('tools/probe-sig-separable.mjs', 'utf8');
  ok(/import \{[^}]*separabilityOf[^}]*\} from '\.\/routing-gain-lib\.mjs'/.test(src), '⑥ 探针必须 import separabilityOf（判据只许一处定义）');
  ok(!/U_sep: sep/.test(src), '⑥ 探针里不许留第二份 U_sep 的实现');
});

t('D196 可分性量具的窗口与判据不许自骗（v1.5.290 · §E134）：K 必须真截断、事件没 round 就不能靠事件分回合', function () {
  /* 这道门只为一个事故存在：§E134 第一版拿 `e.round` 给事件分回合，而 **action 事件根本没有 round 字段**
   * ⇒ 三档 K 算的是"整局"，读数字父相同、工具不崩、表看着完全合理。现在靠"每回合开局记事件水位"截断，
   *   并且工具自己把"前 K 回合 vs 整局"印出来 —— 本门判的就是这个印出来的数**必须随 K 变**。 */
  const argvOf = (K) => ['tools/probe-sig-separable.mjs', '--games=6', '--n=3', '--ks=' + K];
  const o3 = String(spawnSync(process.execPath, argvOf(3), { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 }).stdout || '');
  const o15 = String(spawnSync(process.execPath, argvOf(15), { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 }).stdout || '');
  const m3 = o3.match(/A\/C 实际用的那条 `inWindow` = \*\*前 (\d+) 回合 (\d+) 次出招\*\* ‖ 整局 (\d+) 次/);
  const m15 = o15.match(/A\/C 实际用的那条 `inWindow` = \*\*前 (\d+) 回合 (\d+) 次出招\*\* ‖ 整局 (\d+) 次/);
  ok(!!m3 && !!m15, '① 两档都必须印出窗口自检（K=3 有=' + !!m3 + '，K=15 有=' + !!m15 + '）——**自检必须走特征向量用的那条 `inWindow`**，另写一份就等于给自己打勾');
  if (m3 && m15) {
    eq(Number(m3[1]), 3, '① 第一档确实按 K=3 算');
    eq(Number(m15[1]), 15, '① 第二档确实按 K=15 算');
    ok(Number(m3[2]) < Number(m15[2]), '② **窗口越长按到的出招必须越多**（实测 K=3 得 ' + m3[2] + ' 次 ‖ K=15 得 ' + m15[2] + ' 次）'
      + ' ⇒ 两档相等就意味着 K 根本没起作用（就是那个事故）');
    ok(Number(m15[2]) <= Number(m3[3]), '② 长窗口也不许超过整局（' + m15[2] + ' vs ' + m3[3] + '）');
  }
  /* ③ 判据的线必须来自跑前定死的常数，且 json 里要带出来 */
  const jp = join(mkdtempSync(join(tmpdir(), 'd196-')), 'e134.json');
  const rj = spawnSync(process.execPath, ['tools/probe-sig-separable.mjs', '--games=6', '--n=3', '--ks=8', '--json=' + jp],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
  ok(rj.status === 0 && existsSync(jp), '③ 带 --json 必须跑得完并落下产物（status=' + rj.status + '）');
  const J = JSON.parse(readFileSync(jp, 'utf8'));
  eq(J.meta.uBar, 25, '③ json 必须把过线的那条 U 线带出来（25，§E134 跑前定死）');
  eq(J.meta.ambBar, 0.40, '③ 与歧义率那条线（40%）');
  ok(J.rows.length === 8, '③ 七组特征 + 一条拼接 = 8 行（§E135 起了 E/F/G 三组 ⇒ 这条行数也要跟着动；实测 ' + J.rows.length + '）');
  ok(J.rows.every(r => r.U_sep <= J.meta.envs), '③ U_sep 不许超过原型数（实测最大 ' + Math.max(...J.rows.map(r => r.U_sep)) + ' / ' + J.meta.envs + '）');
  ok(J.rows.every(r => r.pass === (r.U_sep >= J.meta.uBar && r.ambRate <= J.meta.ambBar)),
    '③ "过线"必须由这两条线算出来，不许手写文案');
  rmSync(jp, { force: true });
  /* ④ 单一来源：判据住在 lib，探针只负责观测与打印 */
  const src = readFileSync('tools/probe-sig-separable.mjs', 'utf8');
  ok(/import \{[^}]*separabilityOf[^}]*\} from '\.\/routing-gain-lib\.mjs'/.test(src), '④ 探针必须 import separabilityOf');
  ok(!/U_sep: sep/.test(src), '④ 探针里不许留第二份 U_sep 的实现');
});

t('D199 eval-5p 必须决定论、逐桌子账必须与它自己印的读数对得上（v1.5.295 · §E140 的免费自检升级成门）', function () {
  /* 为什么钉这道：§E140 之所以能当"新旗标没动口径"的证据，全靠**同 seed 重跑逐字相同**这一件事。
   * 而这条此前**没有任何门守着** ⇒ 任何一次重构（换随机流消费顺序、把 ε 探索改成共享、把 dump 挪到统计之后）
   * 都会让今晚所有"同 seed 复现"式的论证一夜之间失效。四段 spawn 各约 1~2 秒，成本可忽略。 */
  const A = 'docs/artifacts/kept/e78-out__G08-71.bak';
  const B = 'docs/artifacts/eval-out/win-Ldemo.bak';
  const dir = mkdtempSync(join(tmpdir(), 'd199-'));
  /* ⚠ 场子必须选 **farmerwall**（4 席只按ジ的农民）：实测主体 1st=100% 而对照 `pickRandom` 是
   * `1st=91.7% 严胜=75.0% 并列=16.7%` ⇒ **有并列**，才能把"把 rank 当 winner 写进账里"这类错暴露出来。
   * 换 ringmix/mix4 那种主体 0% 并列的场，本门的 ③′/③″/③‴ 三条恒等式会**退化成同一条**（变异实测确实红不了过一次）。 */
  const norm2 = function (o) {
    return String(o).replace(/耗时 [0-9.]+s/g, '耗时 抹掉')
      .replace(/逐桌子命中数 → \S+/g, '逐桌子命中数 → 路径');
  };
  const runDump = function (tag, extra) {
    const p = join(dir, tag + '.tsv');
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '12', '5', '77000', A, '--field=farmerwall', '--dump-per=' + p].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || ''), dump: existsSync(p) ? readFileSync(p, 'utf8') : null };
  };
  const r1 = runDump('r1', []);
  const r2 = runDump('r2', []);
  ok(r1.code === 0 && r2.code === 0 && r1.dump !== null, '① 两次同参数运行都要跑得完并落盘（实测 ' + r1.code + '/' + r2.code + '）');
  ok(norm2(r1.out) === norm2(r2.out), '② **同 seed 同参数 ⇒ stdout 必须逐字相同**（除耗时）' +
    ' ⇒ §E140/§E137 那批"同 seed 复现"的论证靠的就是这件事');
  ok(r1.dump === r2.dump, '②′ **逐桌子账也必须逐字节相同**（不是"总量相同"，是每桌每一个数相同）');
  /* ③ 账要对得上自己的表头：桌数 = 打印的组合数；Σfirst/Σgames = 打印的 1st；Σfirst = ranks[0] 那一格 */
  const nCombo = (r1.out.match(/全部 (\d+) 组合/) || ['', '-1'])[1];
  const subj = r1.dump.split('\n').filter(function (l) { return l.indexOf('subject\t') === 0; });
  const ctrl = r1.dump.split('\n').filter(function (l) { return l.indexOf('ctrl\t') === 0; });
  const sum = function (rows, col) { return rows.reduce(function (a, l) { return a + Number(l.split('\t')[col]); }, 0); };
  const sFirst = sum(subj, 4), sGames = sum(subj, 3), sStrict = sum(subj, 5);
  ok(subj.length === Number(nCombo) && ctrl.length === Number(nCombo),
    '③ 落盘桌数必须等于表头打印的组合数（打印 ' + nCombo + ' ‖ 主体 ' + subj.length + ' / 对照 ' + ctrl.length + '）' +
    ' ⇒ 少写一桌就等于配对分析悄悄少一批桌子');
  const p1st = (r1.out.match(/\[冠军\] 1st=([0-9.]+)%/) || ['', '-1'])[1];
  ok(Math.abs(sFirst / sGames * 100 - Number(p1st)) < 0.06,
    '③′ 逐桌子求出的 1st 必须等于打印的 1st（逐桌子=' + (sFirst / sGames * 100).toFixed(2) + '% ‖ 打印=' + p1st + '%）');
  const pStrict = (r1.out.match(/严胜=([0-9.]+)%/) || ['', '-1'])[1];
  const pTie = (r1.out.match(/并列=([0-9.]+)%/) || ['', '-1'])[1];
  ok(Math.abs(sStrict / sGames * 100 - Number(pStrict)) < 0.06,
    '③″ `strict` 那一列也必须等于打印的**严胜**（逐桌子=' + (sStrict / sGames * 100).toFixed(2) + '% ‖ 打印=' + pStrict + '%）' +
    ' ⇒ 两个终点各自对账，才排掉"把 rank 与 winner 混成一列"这种错');
  ok(Math.abs((sFirst - sStrict) / sGames * 100 - Number(pTie)) < 0.06,
    '③‴ `Σfirst − Σstrict` 就是**并列第一**（引擎没判赢但名次第一），必须等于打印的 `并列`（实测 ' +
    ((sFirst - sStrict) / sGames * 100).toFixed(2) + '% ‖ 打印=' + pTie + '%）');
  const cFirst = sum(ctrl, 4), cGames = sum(ctrl, 3), cStrict = sum(ctrl, 5);
  const pCtrl = (r1.out.match(/\[对照 pickRandom\] 1st=([0-9.]+)%/) || ['', '-1'])[1];
  const pCtrlStrict = (r1.out.match(/\[对照 pickRandom\] 1st=[0-9.]+% 严胜=([0-9.]+)%/) || ['', '-1'])[1];
  const pCtrlTie = (r1.out.match(/\[对照 pickRandom\] 1st=[0-9.]+% 严胜=[0-9.]+% 并列=([0-9.]+)%/) || ['', '-1'])[1];
  ok(cGames === sGames && Math.abs(cFirst / cGames * 100 - Number(pCtrl)) < 0.06,
    '④ 对照行的总局数必须与主体相同、且它的逐桌子 1st 也等于打印值（' + cGames + ' vs ' + sGames +
    ' ‖ 逐桌子=' + (cFirst / cGames * 100).toFixed(2) + '% ‖ 打印=' + pCtrl + '%）⇒ 两行确实是同一批桌子');
  ok(Math.abs(cStrict / cGames * 100 - Number(pCtrlStrict)) < 0.06 &&
    Math.abs((cFirst - cStrict) / cGames * 100 - Number(pCtrlTie)) < 0.06,
    '④′ 对照行的 `strict` 与 `first − strict` 必须分别等于打印的**严胜**与**并列**（逐桌子 ' +
    (cStrict / cGames * 100).toFixed(2) + '% / ' + ((cFirst - cStrict) / cGames * 100).toFixed(2) +
    '% ‖ 打印 ' + pCtrlStrict + '% / ' + pCtrlTie + '%）');
  ok(Number(cFirst - cStrict) > 0,
    '④″ 这份夹具里对照**必须真的有并列**（实测 `first − strict` = ' + (cFirst - cStrict) + ' 桌）' +
    ' ⇒ 没有并列时 ③′/③″/③‴ 会退化成同一条恒等式，本门就没有牙了（换场时要重新核对这一条）');
  /* ⑤ 换包臂的账也要自洽（此前 ⑪ 只查了默认臂；`--swap` 那条分支的 cFirst 走的是另一个 chooser） */
  const sw = runDump('sw', ['--swap=' + B + '@3']);
  ok(sw.code === 0 && sw.dump !== null, '⑤ 带 `--swap` 的一臂要跑得完并落盘（exit=' + sw.code + '）');
  const swSubj = sw.dump.split('\n').filter(function (l) { return l.indexOf('subject\t') === 0; });
  const swFirst = sum(swSubj, 4), swGames = sum(swSubj, 3);
  const swP1 = (sw.out.match(/1st=([0-9.]+)%/) || ['', '-1'])[1];
  ok(Math.abs(swFirst / swGames * 100 - Number(swP1)) < 0.06,
    '⑤′ 换包臂的逐桌子 1st 也必须等于它打印的 1st（逐桌子=' + (swFirst / swGames * 100).toFixed(2) + '% ‖ 打印=' + swP1 + '%）');
  ok(swSubj.length === subj.length && sw.dump !== r1.dump,
    '⑤″ 换包臂桌数不变，但**逐桌子账必须与不换包那臂不同**（相同就等于 `--swap` 在这条分支里根本没生效）');
  /* ⑥ 头部元信息齐不齐：分析器靠这五个字段判"是不是同一批桌子"（D198 ⑬），所以这里必须钉它们在 */
  ok(/#seed=77000/.test(r1.dump) && /#games=12/.test(r1.dump) && /#pool=core/.test(r1.dump) &&
    /#every=1/.test(r1.dump) && /#field=farmerwall/.test(r1.dump),
    '⑥ 落盘头部必须带 `seed/games/pool/every/field`（缺一个，配对校验就会把不同批桌子放行）');
  try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 同上 */ }
});

t('D212 破平票三件套（explain-champion-decision 第⑤节）：只记录 · 自检有牙 · 反转反事实与属性判别都在（v1.5.307 · 接千问 §E180）', function () {
  /* 动因：两席属性相同时同卡分数**逐位相同** ⇒ 选择退化成"枚举顺序 + 温度采样"。
   * 本门钉三件事：① 节在（含自检与两个关键量）② **只记录**（不许拿平票率去阻断/退出）③ 行为验证（真跑一次，
   * 自检必须打 ✔ —— 这是本仓"门要守行为"的规矩；我 v1.5.299 那次"声称有门其实没有"就是反面教材）。 */
  const E = readFileSync('tools/explain-champion-decision.mjs', 'utf8');
  ok(/## ⑤ 破平票/.test(E), '第⑤节必须在（平票率 / 方向 / 反事实 / 属性判别）');
  ok(/scored\.slice\(\)\.reverse\(\)\[0\]/.test(E), '反转候选列表的反事实必须在（顺序决定的判据）');
  ok(/sameAttrs/.test(E) && /diffAttrs/.test(E), '必须直接读 state 判"平票目标属性是否一样"（不能只靠猜特征布局）');
  ok(/tieSelf\.ok/.test(E), '自检必须有牙（tieSelf.ok）');
  ok(/tieByRound/.test(E), '必须按回合分桶（分辨"开局对称"与"结构性"）');
  /* 只记录：**只切我自己那段循环内代码**（第一版切到节尾 ⇒ 把文件别处的自检 exit 也包进来 ⇒ 假红） */
  {
    const i0 = E.indexOf('破平票三件套（v1.5.307 · 只记录）');
    const i1 = E.indexOf('firstTargetSeen === false');
    const seg = (i0 >= 0 && i1 > i0) ? E.slice(i0, i1) : '';
    ok(seg.length > 200, '平票那段循环内代码必须在（找不到就是被删了）');
    ok(seg.indexOf('process.exit') < 0 && seg.indexOf('fails.push') < 0, '【只记录】平票那一段不许有 exit / 阻断');
  }
  /* v1.5.307 追加（我自己踩的坑）：**分母必须是独立的量** —— 第一版把累计的 tie.dec（只在平票分支里 +1）
   * 当分母印 ⇒ 分母=分子 ⇒ 平票率必然 100%。这一条钉住"率的分母不许用只在分子分支里累加的量"。 */
  ok(/decAll:\s*0/.test(E), '必须有独立的分母计数器 tie.decAll');
  ok(/pct\(tie\.n, tie\.decAll\)/.test(E), '平票率的分母必须用 tie.decAll（不是 tie.dec）');
  ok(!/pct\(tie\.n, tie\.dec\)/.test(E), '【反例】不许再拿 tie.dec 当平票率的分母（分母=分子 ⇒ 恒 100%）');
  /* 行为：真跑一次小档，自检必须打 ✔（这是一条会 spawn 的门，成本约 20~40 秒） */
  const r = spawnSync(process.execPath, ['tools/explain-champion-decision.mjs', '--games=2'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const out = String(r.stdout || '') + String(r.stderr || '');
  eq(r.status, 0, '小档必须 exit 0（实测 ' + r.status + '）');
  ok(out.indexOf('## ⑤') >= 0, '小档输出里必须有第⑤节');
  ok(/判别力自检[^\n]*✔ 过/.test(out), '第⑤节的判别力自检必须打 ✔（行为验证，不看静态文本）');
});

t('D214 研究侧模拟仪器必须**默认隔离 rng**（`--freshrng` 默认开；要关必须显式 `--allowrngleak` 且表头留痕）（10-01 · 接千问 §E209 残余扰动）', function () {
  /* 事实（代码级）：`js/core/state.js:236` 的 `cloneState` **复用同一个 rng 对象**；`playRollout` 虽给 clone 换了自己的流，
   * 但引擎抽取走**模块级栈顶 `RNGCUR`**，而该栈顶**只在 `--freshrng` 打开时**才换成 clone ⇒ 不开时 rollout 从**母局**那条流抽，
   * 扰动随 `rep` 增长（§E209 实测 366(rep=8) / 355(rep=2) / 356 零 rollout 参照）。
   * ⇒ 本门钉住：默认必须是隔离；关闭必须有显式逃生阀；表头必须留痕（否则读的人分不出这批数是被扰动的）。 */
  const P = readFileSync('tools/probe-myopia-regret.mjs', 'utf8');
  ok(/let FRESHRNG = true;/.test(P), '默认必须是**开隔离**（`let FRESHRNG = true`）');
  ok(/ALLOW_LEAK/.test(P) && /allowrngleak/.test(P), '必须有显式逃生阀 `--allowrngleak`（并在允许名单里）');
  ok(/freshrng=/.test(P), '表头必须留痕 `freshrng=`（读的人要能分辨这批数有没有被扰动）');
  const r1 = spawnSync(process.execPath, ['tools/probe-myopia-regret.mjs', '--rep=1', '--games=1'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const o1 = String(r1.stdout || '') + String(r1.stderr || '');
  eq(r1.status, 0, '默认档必须能跑（实测 ' + r1.status + '）');
  ok(/freshrng=ON/.test(o1), '默认档表头必须显示 freshrng=ON（实测输出里没找到）');
  const r2 = spawnSync(process.execPath, ['tools/probe-myopia-regret.mjs', '--rep=1', '--games=1', '--allowrngleak'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const o2 = String(r2.stdout || '') + String(r2.stderr || '');
  eq(r2.status, 0, '--allowrngleak 档必须能跑（实测 ' + r2.status + '）');
  ok(/freshrng=off/.test(o2), '关档表头必须印 `freshrng=off`（该工具既有格式；第一版我自造了一串字样 ⇒ 假红）');
  ok(!/freshrng=ON/.test(o2), '关档不许再显示 ON（显示 ON 就分不出这批数有没有被扰动）');
});

/* ===== D164：池子前沿量具（v1.5.249 · Qoder 09-26）=====
 * 钉四件事，全部判在**效果**上：
 *  ① 三条判据在**线处**方向正确（"两模式都要"是今天的核心教训：只看 multi 会让 long 2.86 的包混进来）；
 *  ② "三合一"必须真是三样求交，且**没量到 ≠ 通过**；
 *  ③ 未知 `--` 参数一律 exit 64（真跑，不判文本）；
 *  ④ `--stage=1` 真的不起 gate-drafts（那 ~40 分钟必须能**真的**跳过，而不是"照跑但没印"）。
 * 判据从 `pool-frontier-lib.mjs` import —— 不 import 探针本体（它一被 import 就会去扫 1457 个文件）。 */
t('D202 §E146 的判读器 `analyze-fitcal-ab.mjs` 有牙（合成夹具，<1 秒）：配对不成立必须响亮拒、算术要等于手算值', function () {
  /* 为什么钉这道：这条门产出的数**直接决定用户要不要在目标函数层换手**（决策单 §零 第①件）。
   * 而这类"读现成 tsv 做算术"的工具，最贵的三种坏法恰好是：
   *   ① 两臂其实打的不是同一批桌子，却照样算出一个配对差（§E136 的前科）；
   *   ② 报错走"退出码 0 + 少印一段"，于是**崩在半成品报告中间**、前半截读数被抄走
   *      （**本门就是为这件事立的**：开发时第一版把 `const mean` 写在 H2 使用点之后 ⇒ ESM TDZ ⇒ H1 全印完才炸）；
   *   ③ 判据缺对比度还照判（§E146 的极差在真产物上三档全部饱和 100pt ⇒ 门要验"极差算对了"，缺陷本身记在日志里）。
   * 夹具全是手写字符串 ⇒ 不跑引擎、不进 np 的耗时榜。 */
  const TOOL = 'tools/analyze-fitcal-ab.mjs';
  ok(/import \{ pairedDiff \} from '\.\/routing-gain-lib\.mjs'/.test(readFileSync(TOOL, 'utf8')),
    '① 配对差必须 import lib 那一份（本仓三处 SE 各写一遍的教训；门 D193/D198 同族）');
  ok(!/Math\.sqrt/.test(readFileSync(TOOL, 'utf8')),
    '① 反向哨兵：判读器里不许出现第二个标准差/SE 公式（`pairedDiff` 就是唯一那份）');
  /* ⓪ 参数守卫（仓规 v1.5.234）：`--envdir` 打错会被当"没给"⇒ 静默读默认目录；`--seeds` 打错会退回默认三档
     ⇒ 报出来的"三 seed 同号"其实不是使用者指定的那三档。真跑一遍，不许只看源码。 */
  const typo = spawnSync(process.execPath, [TOOL, '--seed=7,31,77', '--nonsense=1'], { encoding: 'utf8', timeout: 60000 });
  eq(typo.status, 64, '⓪ 不认识的 `--` 参数必须 exit 64（实测 ' + typo.status + '）');
  ok(/nonsense/.test(String(typo.stderr || '')), '⓪ 且要点名是哪个开关打错了');

  const dir = mkdtempSync(join(tmpdir(), 'd202-'));
  const envDir = join(dir, 'env'); mkdirSync(envDir, { recursive: true });
  const HDR = ['#eval5p-percombo', '#seed=77000', '#games=2', '#n=5', '#pool=all', '#every=7', '#field=-', '#swap=-',
    '#arm\tidx\tnames\tgames\tfirst\tstrict'].join('\n');
  /* 手算好的两臂：cal0 两张桌子 (1/2, 0/2)、cal1 (2/2, 1/2) ⇒ 逐桌子差 = 0.5, 0.5 ⇒ 均值 0.5、sd 0 ⇒ 区间退化成 [50,50]pt */
  const perFile = function (file, first0, first1, opts) {
    const o = opts || {};
    const names1 = o.badNames ? 'X|B|C|D|E' : 'A|B|C|D|E';
    const ctrl0 = o.badCtrl ? 1 : 0;
    return HDR.replace('#swap=-', '#file=' + file + '\n#swap=-') + '\n' +
      ['subject\t0\tA|B|C|D|E\t2\t' + first0 + '\t' + first0, 'subject\t1\t' + names1 + '\t2\t' + first1 + '\t' + first1,
        'ctrl\t0\tA|B|C|D|E\t2\t' + ctrl0 + '\t' + ctrl0, 'ctrl\t1\tA|B|C|D|E\t2\t1\t1'].join('\n') + '\n';
  };
  const write2 = function (a, b) {
    writeFileSync(join(dir, 'cal0-s9.tsv'), a); writeFileSync(join(dir, 'cal1-s9.tsv'), b);
  };
  const run = function (extra) {
    const r = spawnSync(process.execPath, [TOOL, '--dir=' + dir, '--envdir=' + envDir, '--seeds=9'].concat(extra || []),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  const num = function (s, label, unit) {
    const u = unit || 'pt';
    const m = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*([-+0-9.]+)' + u).exec(s); return m ? Number(m[1]) : NaN;
  };
  /* ---- ② 算术必须等于手算值（不是"跑通了就行"）---- */
  write2(perFile('packA', 1, 0), perFile('packB', 2, 1));
  const ok0 = run();
  eq(ok0.code, 0, '② 合法夹具必须跑通（实测 ' + ok0.code + '）：' + ok0.out.slice(0, 200));
  eq(num(ok0.out, '配对差'), 50, '② 配对差必须 = 手算的 50.00pt（实测 ' + num(ok0.out, '配对差') + '）');
  ok(/\[50\.00pt, 50\.00pt\]/.test(ok0.out), '② sd=0 时区间必须退化成 [50,50] 而不是塌成 ±0 或 NaN（实测没匹配到）');
  ok(/n=2/.test(ok0.out) && /pickRandom 基线 25\.00%/.test(ok0.out),
    '② 分母 n 与随机基线都要印（基线 = ctrl 的 (0/2,1/2) 均值 = 25%）');
  /* ---- ③ 四道"配对不成立"必须响亮拒（exit 5），不许静默出一个数 ---- */
  const refuse = function (label, a, b) {
    write2(a, b); const r = run();
    eq(r.code, 5, '③ ' + label + ' 必须 exit 5（实测 ' + r.code + '）⇒ 退出码 0 就等于"照常出判据"');
    ok(/配对不成立/.test(r.out), '③ ' + label + ' 还要点名为什么不能比：' + r.out.slice(0, 160));
  };
  refuse('桌子组合不同', perFile('packA', 1, 0), perFile('packB', 2, 1, { badNames: true }));
  refuse('pickRandom 对照不一致（§E139 的配对自检）', perFile('packA', 1, 0), perFile('packB', 2, 1, { badCtrl: true }));
  refuse('两臂 #file 相同（把同一粒包当两臂）', perFile('packA', 1, 0), perFile('packA', 2, 1));
  refuse('两臂 #every 不同（不是同一批桌子）', perFile('packA', 1, 0).replace('#every=7', '#every=5'), perFile('packB', 2, 1));
  /* ---- ④ H2 的算术 + "不许崩在 H2"（TDZ 事故的回归位）---- */
  const envRows = function (rev) {
    const o = [];
    for (let i = 0; i < 12; i++) { const f = rev ? (11 - i) : i; o.push('e' + i + '\t0\t1\t10\t' + f + '\t' + f); }
    return ['#probe-5p-envfit', '#n=5', '#mix=4', '#games=10', '#seeds=0', '#envs=12',
      '#env\tseed\tinPool\tgames\tfirst\tstrict'].join('\n') + '\n' + o.join('\n') + '\n';
  };
  write2(perFile('packA', 1, 0), perFile('packB', 2, 1));
  writeFileSync(join(envDir, 'cal0-s9.tsv'), envRows(false)); writeFileSync(join(envDir, 'cal1-s9.tsv'), envRows(true));
  const h2 = run();
  eq(h2.code, 0, '④ 带环境账时必须整体跑通（第一版在这里 TDZ 崩 ⇒ 崩码非 0 才算抓到）：实测 ' + h2.code);
  ok(/## H2/.test(h2.out) && /极差之差/.test(h2.out), '④ H2 段必须真的印出来（缺这段就是"报告半成品"）');
  eq(num(h2.out, 'cal0 均', '%'), 55, '④ 每臂均值必须 = 手算的 55.00%（0..11 除以 10 局再平均）：实测 ' + num(h2.out, 'cal0 均', '%') +
    '（⚠ 这里第一次跑的是 `pt` 而工具印 `%` ⇒ 门抓到的是**我的正则写窄了**，不是工具算错。这类"断言读不到就 NaN"必须红，不许把 NaN 当 0 放过去）');
  ok(/极差之差 0\.00pt/.test(h2.out), '④ 极差之差必须 = 手算的 0.00pt（两臂是同一组数的正反序 ⇒ max−min 相等）');
  /* ---- ⑤ 缺环境账要**降级**而不是崩（我实际用过这条路：H2 未量、H1 照出）---- */
  const noEnv = spawnSync(process.execPath, [TOOL, '--dir=' + dir, '--envdir=' + join(dir, 'nope'), '--seeds=9'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 });
  eq(noEnv.status, 0, '⑤ 缺 H2 账必须 exit 0 并降级（实测 ' + noEnv.status + '）—— 不许把"没量到"报成崩溃，也不许静默少印一段');
  ok(/降级为"未量"/.test(String(noEnv.stdout || '')), '⑤ 且要在屏幕上明说 H2 没量（否则读者会拿 H1 当两问的答案）');
  /* ---- ⑥ 环境数不足不许算极差（§E142 的名单是 33 个，读出一小撮就是解析坏了）
     ⚠ 本条第一版写成 `few.stderr / few.stdout`，而 `run()` 返回的是 `{code, out}` ⇒ 读到的永远是空串。
        它这次**红**着被抓到（假红比假绿好），但形状与 D199 第一版"恒真断言"是同一族：**门的输入字段名也要有牙**。
        现在改成 `few.out`，并在消息里带上前 160 字（红的时候能一眼看出是"没匹配"还是"真拒了"）。 ---- */
  writeFileSync(join(envDir, 'cal0-s9.tsv'), envRows(false).split('\n').slice(0, 6).join('\n') + '\n');
  const few = run();
  eq(few.code, 5, '⑥ 只读出 3 个环境时必须 exit 5（实测 ' + few.code + '）⇒ 拿 3 个环境算"极差"是个假数');
  ok(/<10/.test(String(few.out || '')), '⑥ 且要点名是环境数不够：' + String(few.out).slice(0, 160));
});

t('D203 §E147 的 k 粒组合收益曲线工具：它自带的**手算自证**必须随门禁一起跑（不许只在开发时跑过一次）', function () {
  /* 为什么这样立：`analyze-kpool-capture.mjs` 的算术（贪心挑子集 + split-half 结算 + 逐环境配对区间）
   * 一旦算错，报出来的就是"备两粒能多赢 3.5pt"这种会直接影响决策的数。开发期它已经抓到过自己三处错：
   *   ① 夹具把 first=90/games=10 当 0.9 用（⇒ 算出 9.0）；② 份额的分母用了"两向平均"而分子是单向 ⇒ 吐出 101%（§E131 同族）；
   *   ③ 标签写死"受限池"，拿 15 粒未受限目录跑也照印 ⇒ 假的池子身份。
   * ⇒ 把它自带的 `--self-test`（六个手算期望值）**搬进门禁**，成本 <5 秒，但以后谁改算式改坏了，门当场红。 */
  const src = readFileSync('tools/analyze-kpool-capture.mjs', 'utf8');
  ok(/import \{ pairedDiff \} from '\.\/routing-gain-lib\.mjs'/.test(src),
    '① 配对区间必须 import lib 那一份 `pairedDiff`（本仓第三处 SE，见 D193/D198/D202 同族规矩）');
  ok(!/function pairedDiff|Math\.sqrt/.test(src), '① 反向哨兵：这个工具里不许有第二份 SE/标准差公式');
  ok(/rejectUnknownFlags\(/.test(src), '② 参数守卫必须在（仓规 v1.5.234：不认识的 `--` 要 exit 64，不许静默走默认目录）');
  ok(/run\(packs, '池子来自 ' \+ DIR/.test(src),
    '③ 池子身份必须由目录名推出来（写死过一次：拿 15 粒未受限目录跑，屏幕却印"受限池（过体检闸的几粒）"⇒ 假的池子身份比不印更坏）');
  const r = spawnSync(process.execPath, ['tools/analyze-kpool-capture.mjs', '--self-test'], { encoding: 'utf8', timeout: 120000 });
  eq(r.status, 0, '④ 手算自证必须整批绿（exit 0）：\n' + String(r.stdout || '').slice(0, 500) + String(r.stderr || '').slice(0, 200));
  const ticks = (String(r.stdout || '').match(/^ {2}✔ /gm) || []).length;
  ok(ticks >= 6, '④ 且六条手算期望必须都过（实测 ' + ticks + ' 条 ✔）—— 只 exit 0 不算，红过的那几条会被 `|| true` 之类的写法吞掉');
  const bad = spawnSync(process.execPath, ['tools/analyze-kpool-capture.mjs', '--nonsense=1'], { encoding: 'utf8', timeout: 60000 });
  eq(bad.status, 64, '⑤ 不认识的参数必须 exit 64（实测 ' + bad.status + '）');
  const noDir = spawnSync(process.execPath, ['tools/analyze-kpool-capture.mjs', '--dir=no/such/dir'], { encoding: 'utf8', timeout: 60000 });
  ok(noDir.status === 2 || noDir.status === 7, '⑥ 目录读不到必须非零退出（实测 ' + noDir.status + '）⇒ "没读到"不许被读成"收益为 0"');
});

t('D207 落点集中度 `conc()` 的手算自证（§E164 · 09-30 夜班）：新度量必须带手算值、分母为零不许 NaN、仪器不许抄第二份算术', function () {
  /* 为什么有这条（这条门的由来本身就是一次**自我更正**）：§E156b/§E161 我用 `focusRate`（"上一次带目标的伤害打的是谁"，连段率）
     断言开档"丢了集火"。但连段率低有两种完全不同的原因：**真的在撒**，或者"**这一回合打最该死的那个、下一回合改打另一个最该死的**"。
     ⇒ 补一把独立的尺：每局"最挨打的那个落点占本席带目标伤害的份额"（top）与"打了几家"（kinds）。
     ⚠ 度量算在 `tools/behavior-profile.mjs` 的 `conc()` 里（单一来源）；仪器只能 import 它，**不许再写一遍 `Σtop/Σgames`**。 */
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  ok(/export function conc\(t\)/.test(bp), '① `behavior-profile` 必须**导出** `conc`（导不出就只能各抄一份算术）');
  ok(bp.indexOf('export const WIN = W;') >= 0, '② `behavior-profile` 必须交出它自己那份沙箱 `WIN`（`sandbox()` 每次新造实例 ⇒ 仪器自己 new 一份就活在另一个世界，档位切不到被测那条路）');
  const c1 = conc({ tgtGames: 3, tgtTopSum: 1.5, tgtKindSum: 7 });
  ok(c1 && Math.abs(c1.top - 50) < 1e-9 && Math.abs(c1.kinds - 7 / 3) < 1e-9,
    '③ 手算值必须对上：3 局、top 份额合计 1.5 ⇒ **50.0%**；家数合计 7 ⇒ **2.333**（实测 ' + JSON.stringify(c1) + '）');
  ok(conc({ tgtGames: 0, tgtTopSum: 0, tgtKindSum: 0 }) === null, '④ 没有带目标伤害的局 ⇒ 必须返回 null（不许 NaN 混进表里当 0%）');
  const inst = readFileSync('docs/artifacts/e161-ply.mjs', 'utf8');
  ok(inst.indexOf("from '../../tools/behavior-profile.mjs'") >= 0 && /conc/.test(inst),
    '⑤ 配对仪器必须**从 behavior-profile import `conc`**（抄第二份算术 = 本仓"两份同构实现必漂移"）');
  ok(!/tgtTopSum\s*\/\s*tgtGames/.test(inst.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')),
    '⑤′ 仪器源码里（剥掉注释后）**不许出现** `tgtTopSum / tgtGames` 这种第二份算术');
  ok(bp.indexOf("'  集中 '") >= 0, '⑥ 打印行必须带"集中"那一栏（少了它，体检与门禁看到的是同一个被误读的连段率）');
});

t('D208 开档的可复现性地基（§E164b · 09-30 夜班）：跨进程逐字相同 + 暖机后同进程两遍相同 + 仪器说明里不许再写"与工具种子带逐字同形"', function () {
  /* 为什么有这条：今晚全部"配对读数"的地基是**同一批牌 + 同一算法 ⇒ 同一个结果**。这句地基话今晚被我错过两次：
     ① 我在仪器与三份文档里写过"块切法与工具自身 `--games` 那条种子带**逐字同形**（b=0 那五局就是工具默认前五局）" ⇒ **实测错的**：
        `fieldProfile` 里 `rng = mulberry32(seed0 + g·997)` 而 `slotSalt = seed0 + g·2246822519`（同 seed0、**不同步长**），块起点只挪对 rng、槽位盐对不上
        ⇒ `G=10@4100` ‖ `G=5@4100 + G=5@8985` 实测 acts 248‖247、rounds 265‖285（**不是同一批牌**）。四处文档已原地更正。
     ② 我以为"同 seed 两遍相同"是显然的 ⇒ **同进程连跑两遍 `fieldProfile`（开档）第一遍与后面不同**（acts 54‖47‖47‖47），
        而**跨进程**同命令行连跑三遍**逐字相同**（防御 12.9% / 攻击 36.1% / 集火 29.2% / 集中 50.0% 三遍一致）。
        ⇒ 根因**今晚没定位到**（怀疑是某处首次调用才建立的缓存/懒初始化；`resolve.js` 与 `play.js` 里 `Math.random` 都是 0 处，`state.js` 1 处不在开档路径上）。
        ⇒ 所以这条门钉的是**实测成立的那两条**（跨进程相同、暖机后相同），而不是我原先那句错的"逐字同形"；
          第一遍不同这件事**留在 §E164b 当未结缺陷**，别当成"已经稳了"。 */
  const TBP = WIN.EpirusTrainer;
  const params = AUDIT.loadChamp(WIN, 'js/bundled-champion-3p.js', process.cwd());
  const key = (t) => JSON.stringify({ a: t.acts, w: t.wins, r: t.rounds, d: t.decisive, v: t.voided, f: t.focus, ta: t.tgtActs,
    tg: t.tgtGames, ts: Number((t.tgtTopSum * 1e6).toFixed(6)), tk: t.tgtKindSum, mx: t.maxEp, k: Object.keys(t.keys).sort().map((x) => x + ':' + t.keys[x]) });
  for (const mode of ['off', 'on']) {
    if (mode === 'on') { TBP.setBeliefSearch(1); TBP.setBeliefPly(1); TBP.setBeliefTarget(0); TBP.setBeliefTie(1); }
    else TBP.setBeliefSearch(0);
    fieldProfile(params, 0.2, 'soft', 3, 4100, 'mixed', 'multi');            /* 暖机一遍（§E164b：开档第一遍与后续不同，原因未定位） */
    const one = key(fieldProfile(params, 0.2, 'soft', 3, 4100, 'mixed', 'multi'));
    const two = key(fieldProfile(params, 0.2, 'soft', 3, 4100, 'mixed', 'multi'));
    TBP.setBeliefSearch(0); TBP.setBeliefTie(0);
    ok(one === two, '① ' + mode + ' 档：暖机之后同参数两遍的度量必须逐字相同（实测 ' + one.slice(0, 80) + ' ‖ ' + two.slice(0, 80) + '）');
    const acts = Number((one.match(/"a":([0-9]+)/) || [0, '0'])[1]);
    ok(acts > 0, '② ' + mode + ' 档：两遍相同但**跑的是空表**（acts=' + acts + '）⇒ 仪器根本没进游戏，"相同"是假的');
  }
  /* ③ 跨进程：这条才是今晚那些表真正依赖的可复现性（每台仪器都是**一个进程跑一个配置**）。 */
  const outs = [];
  for (let i = 0; i < 2; i++) {
    const rr = spawnSync(process.execPath, ['tools/behavior-profile.mjs', '--eps=0.2', '--epsmode=soft', '--games=8', '--mirror=0', '--belief=1'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 300000 });
    ok(rr.status === 0, '③ 跨进程复现：第 ' + (i + 1) + ' 遍没跑成（exit=' + rr.status + '）');
    outs.push(String(rr.stdout || '').replace(/\r/g, ''));
  }
  ok(outs[0] === outs[1], '③ 同一命令行**换进程**必须逐字相同（实测两遍输出不同 ⇒ 今晚的开档读数不可复现，得先修这条再谈引用）');
  ok(/防御 [0-9.]+%.*昏手 [0-9.]+%/.test(outs[0]), '③′ 输出里必须有那行度量（没有 ⇒ 两遍"相同"可能是因为都在空转）');
  /* ④ 把今晚更正的那条错话钉住：不许有人再把"块 = 工具前 N 局"写回来。 */
  const inst = readFileSync('docs/artifacts/e161-ply.mjs', 'utf8');
  ok(inst.indexOf('逐字同形') < 0,
    '④ 配对仪器（`docs/artifacts/e161-ply.mjs`）的说明里不许再出现"与工具种子带**逐字同形**"（§E164b 实测不成立：acts 248‖247、rounds 265‖285）');
});

t('D209 人类形状对手池的单一来源（§E168 · 09-30 夜班）：`tools/human-pool.mjs` 自证 + 两台仪器不许各自再抄一份采样', function () {
  /* 为什么有这条：§E168 要把"风格代价"从脚本桌复量到人类形状桌 ⇒ 必须与 §E155 用**同一个**采样器，否则两张桌子的"人类形状"不是同一个东西，
     而复量出来的差恰好落在我自己最关心的那几列上。提取的动作本身也要钉住——本仓"两份同构实现必漂移"已经应验五次，第六次最可能发生在"重构后忘了删旧的"。 */
  const errs = selfTest();
  ok(Array.isArray(errs) && errs.length === 0, '① `selfTest()` 必须零错误（实测 ' + (Array.isArray(errs) ? errs.length : typeof errs) + '：' + JSON.stringify(errs) + '）');
  const hp = readFileSync('tools/human-pool.mjs', 'utf8');
  ok(/export function loadPool/.test(hp) && /export function makeMimic/.test(hp) && /export function selfTest/.test(hp),
    '② 三个导出齐备（少一个就意味着有人把逻辑挪回仪器里）');
  /* ③ 真池子：数量必须与 §E152e 那台解析器的产物一致（997 手抽样质量 / 56 局）⇒ json 被重新生成或截断时要在这里响 */
  const pool = loadPool(WIN, 'human');
  ok(pool.tot === 997 && pool.games === 56 && pool.conds > 20,
    '③ 人类形状池：抽样质量应为 997 手、56 局、条件键 >20（实测 ' + pool.tot + ' / ' + pool.games + ' / ' + pool.conds + '）⇒ 单一真源 `human-behavior.json` 变了却没人在读这两张桌子');
  const poolAi = loadPool(WIN, 'ai');
  ok(poolAi.tot > pool.tot, '③′ AI 形状池（' + poolAi.tot + '）不该比人类池小 ⇒ 两份分布都来自同一份 json，小的那份说明键前缀剥错了');
  /* ④ 两台仪器必须 import，且**不许**留本地采样实现 */
  for (const f of ['docs/artifacts/e155-humanpool.mjs', 'docs/artifacts/e168-style-human.mjs']) {
    const src = readFileSync(f, 'utf8');
    ok(src.indexOf('tools/human-pool.mjs') >= 0, '④ ' + f + ' 必须 import `tools/human-pool.mjs`（提走之后不许留第二份）');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    ok(!/POOL\[cond\]\s*=\s*POOL\[cond\]/.test(code) && !/function sample\s*\(dist/.test(code),
      '④′ ' + f + ' 里（剥注释后）还有本地采样实现的形状 ⇒ 两份实现必漂移');
  }
  /* ⑤ 风格度量也只许有一份：`behavior-profile` 内部不许出现第二份"按类别计数" */
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  ok(/export function tallyPick/.test(bp) && /export function tallyClose/.test(bp),
    '⑤ `tallyPick`/`tallyClose` 必须导出（`fieldProfile` 与 §E168 那台复量共用这一份计数规则）');
  const defHits = (bp.match(/R\.CAT\.DEFENSE/g) || []).length;
  ok(defHits === 1, '⑤′ `behavior-profile` 里 `R.CAT.DEFENSE` 只许出现 1 次（实测 ' + defHits + '）⇒ 出现第二次就是"防御占比"有了两个定义');
  const inst = readFileSync('docs/artifacts/e168-style-human.mjs', 'utf8');
  ok(inst.indexOf('R.CAT.DEFENSE') < 0, '⑤″ §E168 仪器不许自己判类别（读 `fieldProfile` 的 tally 就行）');
  /* ⑥ §E169 那台仪器同样在人类形状桌上量 ⇒ 一并纳入"单一采样器"的名单（漏一个就会悄悄长出第三份采样） */
  const i169 = readFileSync('docs/artifacts/e169-beadprice.mjs', 'utf8');
  ok(i169.indexOf('tools/human-pool.mjs') >= 0 && !/POOL\[cond\]\s*=\s*POOL\[cond\]/.test(i169),
    '⑥ `e169-beadprice.mjs` 必须 import `tools/human-pool.mjs` 且不留本地采样');
  /* ⑦ §E176：把"单一来源"从**名单式**改成**机械式**。上面那份仪器名单是硬编码的，里面没有比它早生的 `e157`
     ⇒ 这条门"看得见三台、看不见第四台"，而第四份采样实现就那样并排跑了两个夜班。
     ⇒ 现在改成"谁读 `human-behavior.json` 谁就必须 import 那份"；要例外必须**点名 + 写理由 + 钉数量**（本仓"点过名却不在场"那族的老规矩）。 */
  const EXEMPT = {
    'docs/artifacts/e157-difficulty.mjs': '§E176 未结项：自带一份本地采样器，与单一来源"逐手 pick 相同但每手抽数不同步"⇒ 序列等价性未证；等 (a)/(b) 裁定后收编',
    'docs/artifacts/e157b-difficulty-pool.mjs': '§E176 已知**接坏的**对照台（主体席每手抽 0 次随机数），只作反面样本留档，不许当读数来源'
  };
  const readers = readdirSync('docs/artifacts').filter(function (f) { return /\.mjs$/.test(f); })
    .map(function (f) { return 'docs/artifacts/' + f; })
    .filter(function (p) { return readFileSync(p, 'utf8').indexOf('human-behavior.json') >= 0; });
  /* 生产者例外（**写**这份 json 的那台）单独点名——第一次跑这条门时它把 §E152e 也抓出来了，说明"读没读那份 json"这个谓词
     比"是不是第二份采样实现"宽，所以两件事要分开记，别混成一个豁免名单。 */
  const PRODUCER = 'docs/artifacts/e152e-human.mjs';
  ok(readers.indexOf(PRODUCER) >= 0 && readFileSync(PRODUCER, 'utf8').indexOf('writeFileSync(REPO + \u0027docs/artifacts/human-behavior.json') >= 0,
    '⑦‴ 生产者那台必须还在、且确实是**写**这份 json 的（它不采样 ⇒ 只许它一个人例外；改成别人了要同步改这条）');
  ok(Object.keys(EXEMPT).every(function (k) { return readers.indexOf(k) >= 0; }),
    '⑦ 例外名单里点名的文件已经不再读 `human-behavior.json` ⇒ 名单过期，来清账（别让一条已无对象的豁免继续占位）');
  eq(Object.keys(EXEMPT).length, 2, '⑦′ 例外只许两条（新增一条欠账要人裁定，别让它悄悄变多）');
  for (const p of readers) {
    if (EXEMPT[p] || p === PRODUCER) continue;
    ok(readFileSync(p, 'utf8').indexOf('tools/human-pool.mjs') >= 0,
      '⑦″ ' + p + ' 读 `human-behavior.json` 却没 import 单一来源 ⇒ 两份采样实现必漂移（§E174/§E175 的活例）；要例外必须在 `EXEMPT` 里点名并写理由');
  }
});

t('D211 §E169b 把"屯而不打"与"没钱打"分开数的量具有牙（`beadLive/beadBroke/beadHeld`，手算夹具）', function () {
  /* 为什么有这条（这条门的由来是**一条差点写错的结论**）：§E169 量到"开了珠价之后 珠转化率 0.0%、过期 ×40"，我第一反应用的是
     "**近视定价 ⇒ 它学会屯珠不打**"。但补了 `峰值ep` 之后看到 **4.2 → 2.5**（配对差 −1.77 [−2.17,−1.38]）⇒
     电磁炮要 `2 ep + 1 电珠`**同时**成立，而蓄能一手就花 2 ep ⇒ "没开炮"里可能有一块是**蓄能把自己吃穷了**，不是偏好屯。
     两种机制的**修法完全不同**（改价格 vs 改预算），所以必须当场分开数，不能留到下一班猜。
     ⚠ 同族纪律：判据是"这一手**买不买得起**"，这是 `legal[i].affordable` 的直接读法——不是"ep 余额 ≥ 2"（那会把免费回合/减免都算错）。 */
  const bp = readFileSync('tools/behavior-profile.mjs', 'utf8');
  ok(/beadLive: 0, beadBroke: 0, beadHeld: 0/.test(bp), '① `tally()` 必须初始化那三个计数器');
  ok(/if \(state\.p\[pid\]\.elec > 0 && legal\)/.test(bp), '② `tallyPick` 必须在**被问到这一刻**判"手里有电珠"（事后从事件流反推不出可付性）');
  ok(bp.indexOf('tallyPick(t, state, pid, chooser(state, pid, legal), ctx, legal)') >= 0,
    '③ 调用点必须把 `legal` 传进去（不传 ⇒ 那三个计数器恒 0，整列是装饰）');
  /* ④ 手算夹具：合成输入 + 四种组合的期望值，全部当场核对（不跑真引擎 ⇒ <1 秒） */
  const mk = () => ({ acts: 0, def: 0, atk: 0, ring: 0, ji: 0, tgtActs: 0, focus: 0, voided: 0, endgameMultiOnly: 0,
    rounds: 0, wins: 0, decisive: 0, keys: {}, maxEp: 0, tgtGames: 0, tgtTopSum: 0, tgtKindSum: 0,
    beadGain: 0, beadSpend: 0, beadExpire: 0, beadLive: 0, beadBroke: 0, beadHeld: 0 });
  const st = { p: [], length: 5 };
  for (let i = 0; i < 5; i++) st.p.push({ hp: 20, ep: 4, elec: i === 0 ? 1 : 0, boom: 0, ringStreak: 0 });
  const ctx = { lastTgt: {}, tgtCnt: {}, seat: 0 };
  const lgNoGun = [{ key: WIN.EpirusRules.SK.JI, affordable: true }, { key: WIN.EpirusRules.SK.GUN, affordable: true }];
  const lgGun = lgNoGun.concat([{ key: WIN.EpirusRules.SK.RAILGUN, affordable: true }]);
  const lgGunPoor = lgNoGun.concat([{ key: WIN.EpirusRules.SK.RAILGUN, affordable: false }]);
  const A = mk(); tallyPick(A, st, 0, { key: WIN.EpirusRules.SK.JI }, ctx, lgGun);
  ok(A.beadLive === 1 && A.beadHeld === 1 && A.beadBroke === 0,
    '④ 有珠 + 买得起 + 打了ジ ⇒ 应为 live=1 / held=1 / broke=0（实测 ' + A.beadLive + '/' + A.beadHeld + '/' + A.beadBroke + '）');
  const B = mk(); tallyPick(B, st, 0, { key: WIN.EpirusRules.SK.JI }, ctx, lgNoGun);
  ok(B.beadLive === 1 && B.beadHeld === 0 && B.beadBroke === 1,
    '④′ 有珠 + 名单里根本没有电磁炮 ⇒ 应为 live=1 / held=0 / broke=1（实测 ' + B.beadLive + '/' + B.beadHeld + '/' + B.beadBroke + '）');
  const B2 = mk(); tallyPick(B2, st, 0, { key: WIN.EpirusRules.SK.JI }, ctx, lgGunPoor);
  ok(B2.beadBroke === 1, '④″ 有珠但 `affordable:false` ⇒ 同样算"买不起"（实测 ' + B2.beadLive + '/' + B2.beadHeld + '/' + B2.beadBroke + '）');
  const D = mk(); tallyPick(D, st, 0, { key: WIN.EpirusRules.SK.RAILGUN, target: 1 }, ctx, lgGun);
  ok(D.beadLive === 1 && D.beadHeld === 0,
    '④‴ 有珠、买得起、**确实开了炮** ⇒ live=1 / held=0 / broke=0（实测 ' + D.beadLive + '/' + D.beadHeld + '/' + D.beadBroke + '）');
  st.p[0].elec = 0;
  const C = mk(); tallyPick(C, st, 0, { key: WIN.EpirusRules.SK.JI }, ctx, lgGun);
  ok(C.beadLive === 0 && C.beadHeld === 0 && C.beadBroke === 0, '④⁗ 手里没珠 ⇒ 三个计数器都不许动（实测 ' + C.beadLive + '/' + C.beadHeld + '/' + C.beadBroke + '）');
  st.p[0].elec = 1;
  const E = mk(); tallyPick(E, st, 0, { key: WIN.EpirusRules.SK.JI }, ctx, undefined);
  ok(E.beadLive === 0, '④⁙ 没传 `legal` ⇒ 整条判据跳过（不许把"看不见"当成"买不起"，实测 ' + E.beadLive + '）');
  /* ⑤ 单一来源：仪器只许读 tally 的比，不许再自己扫一遍 `legal`（两份可付性判断必漂移） */
  const i169 = readFileSync('docs/artifacts/e169-beadprice.mjs', 'utf8');
  const code169 = i169.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/\.affordable/.test(code169), '⑤ §E169 仪器里不许出现第二份 `.affordable` 判断（可付性只认 `tallyPick` 那一份）');
  ok(/beadHeld/.test(code169) && /beadBroke/.test(code169) && /beadLive/.test(code169),
    '⑤′ 仪器必须把三样都读出来（少一样就退化成"看起来像屯"的单边读数）');
  /* ⑥ 地板：这套计数器**必须真的在真局里有非零读数**，否则前面五条静态钉合起来仍然可能是装饰 */
  const params6 = AUDIT.loadChamp(WIN, 'js/bundled-champion-3p.js', process.cwd());
  const T6 = WIN.EpirusTrainer;
  T6.setBeliefSearch(1); T6.setBeliefBead(2);
  fieldProfile(params6, 0.2, 'soft', 3, 4100, 'mixed', 'multi');
  const t6 = fieldProfile(params6, 0.2, 'soft', 10, 4100, 'mixed', 'multi');
  T6.setBeliefSearch(0); T6.setBeliefBead(0);
  ok(t6.beadLive > 0 && (t6.beadHeld + t6.beadBroke) > 0,
    '⑥ 真局地板：`bead=2` 那 10 局里三个计数器必须都活（实测 live=' + t6.beadLive + ' held=' + t6.beadHeld + ' broke=' + t6.beadBroke +
    '）⇒ 全 0 说明夹具过了但真引擎里接不上（本仓"夹具缺对比度"那一族）');
});

/* ===== D216（10-01 深夜 · 千问 · DS 交接件 §3 点名的三处 + 我复核时挖出的第四处）=====
 * 判**行为**不判字符串：造一份**手算**夹具，跑两个入口，要求逐项计数、四个广度量、分母处理、桶不重叠全部命中手算值，
 * 并且两入口打印的同一组数**逐字相同** —— "读取实现只有一份"这句话，只有跑出来的相等才算证据
 * （两份同构实现必漂移是本仓反复栽的老病：D209 的人类采样器、§E178 的三台仪器都是靠"逐位相同"才敢并排读）。
 * 手算依据：夹具里 AI 席（2..5）共 **12 条**原始计数，其中 **5 条是 `已淘汰`** ⇒ 真出手 **7 手，恰好 7 张不同卡各打一次**
 *   ⇒ 均匀分布 ⇒ `H = ln 7 = 1.9459`、**G = exp(H) = 7.00**（解析值，不需要信工具的算术）
 *   ‖ 前 3 = 3/7 = **42.9%** ‖ 防御族只有「八卦阵」= 1/7 = **14.3%** ‖ 卡表共 30 张 ⇒ 未出现 **23 张**。
 * ⚠ 四条各治一处病：② `已淘汰` 进分母（DS §3.2）③ 两入口同源（DS §3.3）④ 「狙击枪」被 `/枪(?!法)/` 吃进"枪"（千问新查）
 *   ⑤ 表外 token 不许静默丢（DS §3.1 的根：名单被抄第二遍）。 */
t('D216 真机栏的读取只许一份实现：手算夹具四个量 + 两入口逐字相同 + `已淘汰` 不进分母 + 桶不重叠', function () {
  const dir = mkdtempSync(join(tmpdir(), 'd216-'));
  writeFileSync(join(dir, 'a.txt'),
    '第 1 回合：玩家1=【ジ】  玩家2=【枪→玩家1】  玩家3=【狙击枪→玩家2】  玩家4=【八卦阵】  玩家5=【已淘汰】\r\n' +
    '第 2 回合：玩家1=【ジ】  玩家2=【聚能环】  玩家3=【激光剑→玩家4】  玩家4=【已淘汰】  玩家5=【已淘汰】\r\n');
  writeFileSync(join(dir, 'b.txt'),
    '第 1 回合：玩家1=【ジ】  玩家2=【ジ】  玩家3=【已淘汰】  玩家4=【已淘汰】  玩家5=【蓄能】\r\n');
  const run = function (argv) { return spawnSync(process.execPath, argv, { encoding: 'utf8', timeout: 120000 }); };
  const rj = run(['tools/log-census.mjs', dir, '--json']);
  eq(rj.status, 0, '① `log-census --json` 必须 exit 0（实测 ' + rj.status + ' ‖ ' + String(rj.stderr).slice(0, 160) + '）');
  const J = JSON.parse(rj.stdout);
  eq(J.games, 2, '① 局数');
  eq(J.raw, 12, '① 原始计数（含 `已淘汰`，这是"剔之前有多少"的那个数）');
  eq(J.elim, 5, '① `已淘汰` 必须单独计数而不是丢掉');
  eq(J.hands, 7, '② **分母必须剔掉 `已淘汰`**（该是 7；若等于 raw 就是 DS §3.2 那条病复发）');
  eq(J.kinds, 7, '① 出现的种数');
  eq(J.G.toFixed(2), '7.00', '① G=exp(H) 必须等于解析值 7.00（7 项各一次 ⇒ 均匀）');
  eq(J.top3.toFixed(1), '42.9', '① 前 3 占比 = 3/7');
  eq(J.defense.share.toFixed(1), '14.3', '① 防御族 = 八卦阵 1 手 / 7（成员表也从规则表现取）');
  eq(J.cardTableSize, 30, '① 卡表规模（这张表变了 ⇒ 未出现数就得跟着重看）');
  eq(J.never.length, J.cardTableSize - J.kinds, '① 未出现卡数 = 卡表 − 出现过（两条必须自洽，不许一边手写）');
  const g = J.dist.filter(function (o) { return o.card === '枪'; })[0];
  const s = J.dist.filter(function (o) { return o.card === '狙击枪'; })[0];
  eq(g && g.n, 1, '④ 「枪」只许 1 手（旧 `/枪(?!法)/` 会把「狙击枪」也吃进来 ⇒ 报成 2 = 同一手计两次）');
  eq(s && s.n, 1, '④ 「狙击枪」独立成桶');
  eq(Object.keys(J.unknown).length, 0, '⑤ 表外token 必须为 0（不为 0 就是"读不出"，不许静默丢手）');
  /* ③ 两入口逐字相同：把 `log-behavior` 的文本按同一组量抠出来比 */
  const rb = run(['tools/log-behavior.mjs', dir]);
  eq(rb.status, 0, '③ `log-behavior` 必须 exit 0（实测 ' + rb.status + ' ‖ ' + String(rb.stderr).slice(0, 160) + '）');
  const out = String(rb.stdout);
  const grab = function (re) { const m = re.exec(out); return m ? m[1] : null; };
  eq(grab(/有效出手 (\d+)\*\*/), String(J.hands), '③ 两栏的"有效手"必须同一个数');
  eq(grab(/种类 \*\*(\d+)\*\*/), String(J.kinds), '③ 两栏的"种数"必须同一个数');
  eq(grab(/前 3 \*\*([\d.]+)%\*\*/), J.top3.toFixed(1), '③ 两栏的"前 3"必须同一个数');
  eq(grab(/G=exp\(H\) ([\d.]+)/), J.G.toFixed(2), '③ 两栏的 G 必须同一个数');
  eq(grab(/占有效出手 ([\d.]+)%/), J.defense.share.toFixed(1), '③ 两栏的防御占比必须同一个数');
  /* ⑥ 打错的开关必须响亮（仓规 v1.5.234：静默走默认席位 = 假读数）*/
  eq(run(['tools/log-census.mjs', '--seat=2,3,4,5']).status, 64, '⑥ `log-census` 的 `--seat=`（少个 s）必须 exit 64');
  eq(run(['tools/log-behavior.mjs', '--seat=2,3,4,5']).status, 64, '⑥ `log-behavior` 同样要拒（这两个入口以前根本没守卫）');
  try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 临时目录清不掉不影响判据 */ }
});

t('D233 §E503 融合血统不许静默变薄：`lineage.mjs` 的"声明是融合粒 vs 真解出父边"守卫必须在，且默认判红', function () {
  /* §2026-10-09 DS：⑤ 那条腿跑 lineage.mjs，而它按表去解融合粒的父边（那几枚 SOUP-* 的父从未入库）⇒ 全新 clone 上必红；
   *   当时处置是"缺件时响亮跳过并点名"。
   * ⚠ 10-12 用户裁定②把这个处置**换掉了**：跳过 = 这条门在 CI 上**一次都没执行过**（台账 §十七 记的就是这件事），
   *   而"守缺件"守的还是**路径**——`lineage.mjs:274` 解析父边用的是 `BYWID[wid]`，路径不住在表里。
   *   ⇒ ⑤ 现在带 `--soup-thin-ok` 真跑，并钉"不许整层塌 + 每一枚薄掉的都要能指到具体缺失来源"。见下面 ⑤ 的注释。 */
  /* 病（实测复现，不是推测）：10-08 深夜我拿 `git archive HEAD` 解出一棵**干净克隆**跑 `lineage.mjs` ⇒
   *   第二父边 **6 条 → 0 条**，K2 从家族 23（159 枚 · 标签"代数 400→1200"）塌进家族 1 的 868 枚兜底类，
   *   而**退出码 0、页面自测 71 PASS 全绿**（页面读的是已生成好的表）⇒ 图变薄是静默的。
   *   根因：融合粒的**父**住在 gitignored 的 `docs/artifacts/…`，新机器上根本没有那些 `.bak`。
   * 同族账：§E489（重建链漏第⑥步 ⇒ 投影整列写丢）‖ §E491（`Hp` 空洞 ⇒ `+'' = 0` 把"未测"当"0%"画成库内倒数）。
   *   三条的共同点：**门测的是"表在不在"，不是"这张图还是不是那张图"**。 */
  /* ⑥ 同族病在**量具侧**（§E566 千问）：`champion-map/ruler-measure.mjs` 的 `--ids` 原来**只筛不报** ⇒
   *   打错一个 id、或那枚根本不在本档面板里（层内 / 历代冠军 / --extra 是三套不同来源），
   *   结果都是"少测几枚却 exit 0"，跨次比较就在比两套不对齐的名单。本门盯的是 lineage 那边"图变薄"，
   *   这条补的是**名单齐不齐**。两条腿各都能红：
   *     ⑥a 负向：有找不到的枚 ⇒ 必须响亮失败（exit 2）并点名是哪枚；
   *     ⑥b 正对照：面板里真有的枚（`SHIPPED-Ldemo` 是脚本自己硬放进去的那枚）**不许**被筛子拒掉
   *                ⇒ 否则这道判据本身就成了假红机器。
   *   ⚠ 按规矩 1 的边界：⑥b 只读"**哪个守卫响了**"这个判别（stderr 里是不是 `--ids` 那条），**不钉措辞**
   *     —— 要钉"名单 N 枚"那种文案就等于又种下一条恒绿/措辞债。
   *   放在本门**最前面**（`needArtifacts` 之前）⇒ 这两条不需要任何本机产物，CI 的干净克隆上也照样跑。 */
  const rmBad = spawnSync(process.execPath, ['champion-map/ruler-measure.mjs', '--ids=__gate-nonexistent-id__', '--set=champ', '--shard=9/9',
    '--out=__gate-probe-ruler.tsv'], { encoding: 'utf8', timeout: 120000 });
  eq(rmBad.status, 2, '⑥a `--ids` 里有找不到的枚 ⇒ 必须 exit 2 响亮失败，不许"少测几枚却当跑成功"（实测 status=' + rmBad.status + '）');
  ok(/--ids 里有 1 枚/.test(String(rmBad.stderr || '')) && /__gate-nonexistent-id__/.test(String(rmBad.stderr || '')),
    '⑥a 报错必须**点名是哪枚**找不到（只说"筛空了"没法定位 · 实测 stderr=' + String(rmBad.stderr || '').replace(/\n/g, ' ').slice(0, 110) + '）');
  const rmGood = spawnSync(process.execPath, ['champion-map/ruler-measure.mjs', '--ids=SHIPPED-Ldemo', '--set=champ', '--shard=9/9',
    '--out=__gate-probe-ruler.tsv'], { encoding: 'utf8', timeout: 120000 });
  ok(!/--ids 里有/.test(String(rmGood.stderr || '')),
    '⑥b 正对照：合法枚被自己的筛子拒了 ⇒ 这道判据会变成假红机器（实测 stderr=' + String(rmGood.stderr || '').replace(/\n/g, ' ').slice(0, 110) + '）');
  try { rmSync('champion-map/__gate-probe-ruler.tsv', { force: true }); } catch (e) { /* 清不掉也不要影响判词 */ }
  /* （上面那段病写的红路牙口：）不在这里造 fixture（那要搬 js/core + champion-map + tools 三套），而是在**干净克隆**里复原一次
   *   —— 改守卫前那棵克隆 exit 0 且第二父边 0 条，改完同一棵 **exit 2** 并点名缺的 5 枚（记录见 §E503）。 */
  /* ⚑ §E576：`needArtifacts` 从这儿**下移到 ⑤ 之前**（原来是 11696 行，就在 ①–④ 前面）。
   *   病：①–④ 是对 `champion-map/lineage.mjs` 源码的纯正则断言，任何机器上都跑得动，
   *   却被一句"⑤ 需要本机 K2/E20-71 产物"的 Skip 连带整门跳过 ⇒ **干净克隆里这四条一条都没跑**，
   *   而 CI 总结行当时还不印跳过数（就是本门上面刚修的那处）。两句叠起来 = "D233 在册"看着像绿，其实 0 条落地。
   *   下移之后：①–④ 与 ⑥a/⑥b 在干净克隆照样判；只有 ⑤/⑥ 那两条真要本机产物，缺了才 Skip。 */
  const SRC = 'champion-map/lineage.mjs';
  const src = readFileSync(SRC, 'utf8');
  /* ① 声明数必须来自包自己的 meta（`soup.sources`），不许从"这张表今天解不解得开"倒推 —— 那样洞就自灭了 */
  ok(/m\.soup && Array\.isArray\(m\.soup\.sources\)/.test(src) && /nSoupDeclared\+\+/.test(src),
    '① 必须按 meta.soup.sources 数"声明是融合粒"的枚数（换成按解析结果数 = 把尺子和被测物焊在一起）');
  ok(/SOUPDECL\.push\(r\.id\)/.test(src), '② 要按**枚**留名（只留计数就无法在报错里指出是哪几粒塌了）');
  /* ③ 默认必须拒：thin 非空且没给 `--soup-thin-ok` ⇒ exit 2；给了也要**打印**，不许静默 */
  ok(/if \(thin\.length && !process\.argv\.includes\('--soup-thin-ok'\)\)[\s\S]{0,1200}process\.exit\(2\)/.test(src),
    '③ 默认路径必须 exit 2（"薄图"要显式承认才能出）');
  ok(/console\.log\('⚠ §E503 薄图模式/.test(src),
    '④ `--soup-thin-ok` 那一支必须响亮印警告（灰而不判死 ≠ 假装没事）');
  /* ⑤ 真跑 `lineage.mjs` —— 10-12 用户裁定②：**这条腿从此不许再靠"缺件即 SKIP"躲 CI**。
   *   ⚠ 旧写法错在守错了对象：它用 `needArtifacts(['docs/artifacts/kept/e70-out__D02-31.bak', 'docs/artifacts/e85-out/E20-71.bak'])`
   *     守**两个 .bak 路径**，而 `lineage.mjs:274` 解析父边用的是 `BYWID[s.wid]` —— **路径根本不住在表里**。
   *     后果两头都错：CI 上这条门**一次都没执行过**（永远 SKIP），而本机它绿着也说明不了什么
   *     （实测：`e234-out/K2.js` 这条声明路径连我这台盘的 docs/artifacts 下都不存在，wid 却照样解得到 `kept/e70-out__D02-31.bak`）。
   *   现在：带 `--soup-thin-ok` 跑（父粒不齐 ⇒ 它必须响亮印薄图警告并继续，而不是 exit 2），
   *     并把**门自己独立扫 meta** 得到的账对上 —— 不 import lineage 的解析器，两边不是同一份实现，对不上就是真错位。
   *   钉三件事：⑴ 不许"整层塌"（§E503 那个病就是 clone 里 6→0）；⑵ 每一枚被判"薄"的融合粒，必须能指出**至少一条
   *     在盘上找不到同权重来源**的声明来源 ⇒ 指不出就是"边被静默吞掉"；⑶ 全解析那条分支里，lineage 报的声明数必须等于我扫出来的数。 */
  const soupMeta = (function () {
    const out = [];
    const walk = function (dir, depth) {
      let ents;
      try { ents = readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const en of ents) {
        const p = dir + '/' + en.name;
        if (en.isDirectory()) { if (depth < 3) walk(p, depth + 1); continue; }
        if (!/\.(bak|js)$/.test(en.name)) continue;
        let head;
        try { head = readFileSync(p, 'utf8'); } catch (e) { continue; }
        const mi = head.indexOf('EPIRUS_CHAMPION_3P_META');
        if (mi < 0) continue;
        const seg = head.slice(mi, mi + 9000);
        const sm = /"soup"\s*:\s*\{/.exec(seg);
        if (!sm) continue;
        const arr = /"sources"\s*:\s*\[([\s\S]{0,1600}?)\]/.exec(seg.slice(sm.index));
        if (!arr) continue;
        const srcs = [];
        for (const o of arr[1].matchAll(/\{[^{}]*\}/g)) {
          const f = /"file"\s*:\s*"([^"]+)"/.exec(o[0]);
          const w = /"wid"\s*:\s*"([^"]+)"/.exec(o[0]);
          if (f) srcs.push({ file: f[1], wid: w ? w[1] : '' });
        }
        if (srcs.length) out.push({ id: en.name.replace(/\.(bak|js)$/, ''), file: p, srcs: srcs });
      }
    };
    walk('docs/artifacts', 0);
    return out;
  })();
  /* 一粒"声明的来源在这台机器上到底有没有同权重真身"—— 只看它自己声明的那几条路径，不扫全库（≤12 次读包，代价与库大小无关） */
  const srcPresent = function (s) {
    if (!existsSync(s.file)) return false;
    try {
      const ch = AUDIT.loadChamp(sandbox(process.cwd()), s.file, process.cwd());
      const pr = ch && ch.params ? ch.params : ch;
      if (!pr || typeof pr.length !== 'number') return false;
      return !s.wid || widOfArr(Array.from(pr)) === s.wid;
    } catch (e) { return false; }
  };
  const r = spawnSync(process.execPath, [SRC, '--soup-thin-ok'], { encoding: 'utf8', timeout: 300000 });
  eq(r.status, 0, '⑤ `lineage.mjs --soup-thin-ok` 必须跑成（父粒齐 ⇒ 不该走到薄图分支；不齐 ⇒ 必须印警告继续而不是 exit 2）：\n' +
    String(r.stderr || r.stdout || '').slice(-400));
  const so = String(r.stdout || '');
  const okLine = /融合血统口径 ✅ (\d+) 枚声明是权重平均的粒，父边全部解析（第二父边 (\d+) 条）/.exec(so);
  const thinLine = /薄图模式（`--soup-thin-ok`）：(\d+) 枚融合粒的父边解不开 ⇒ 图上这几条\*\*不画\*\*（([^）]*)）/.exec(so);
  ok(!!okLine || !!thinLine, '⑤ 两条口径行必须**至少印出一条**（都没印 ⇒ 守卫被条件跳过或措辞被改，正是 §E489 那一族）');
  ok(soupMeta.length >= 1, '⑤ 门自己扫 meta 得到的融合粒数是 ' + soupMeta.length + '（= 0 ⇒ `soup.sources` 的写法变了或产物面被搬走，'
    + '这条腿从此在看空气）');
  if (okLine) {
    ok(Number(okLine[1]) >= 1 && Number(okLine[2]) === Number(okLine[1]),
      '⑤ 声明数与第二父边条数必须**相等且非零**（实测声明 ' + okLine[1] + ' ‖ 边 ' + okLine[2] + '）');
    eq(Number(okLine[1]), soupMeta.length, '⑤ lineage 报的声明枚数必须等于门自己扫 `soup.sources` 扫出来的数'
      + '（lineage ' + okLine[1] + ' ‖ 门 ' + soupMeta.length + '）⇒ 不相等就是它没扫到那几枚（尺子瞎了），而不是数据薄了');
  }
  if (thinLine) {
    const thinN = Number(thinLine[1]);
    const ids = thinLine[2].split(' ‖ ').map(x => x.trim()).filter(Boolean);
    ok(thinN < soupMeta.length, '⑤ 薄图枚数 ' + thinN + ' 必须**小于**声明总数 ' + soupMeta.length +
      ' ⇒ 相等就是"融合父边整层消失"（§E503 立这条门的那件事：干净克隆里 6→0）');
    const unexplained = ids.filter(id => {
      const me = soupMeta.filter(x => x.id === id || x.file.indexOf(id) >= 0)[0];
      return !me || me.srcs.every(srcPresent);
    });
    eq(unexplained.length, 0, '⑤ 这几枚被判"父边解不开"，但门查得出它们声明的来源**在盘上都有同权重真身** ⇒ '
      + '那不是"机器新、父粒没入库"，是边被**静默吞掉**（本条门要防的正病）：' + unexplained.join(' ‖ '));
    console.log('   ⚑ ⑤ 薄图口径：lineage 报 ' + thinN + ' 枚解不开（' + ids.join(' ‖ ') + '）‖ 门扫 meta 共 ' + soupMeta.length + ' 枚 ‖ 每条缺失都能指到具体来源');
  }
  /* ⑥ 新列不许被删：删掉 `parentOf2` 就等于把"融合粒有两个父"这件事从数据面上抹掉（比薄图更彻底） */
  const LT = readFileSync('champion-map/lineage.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
  const hd = LT[0].split('\t');
  ok(['parentOf2', 'parentName2', 'parentSrc2'].every(c => hd.indexOf(c) >= 0), '⑥ lineage.tsv 表尾三条融合列必须还在');
  ok(hd.indexOf('parentOf2') > hd.indexOf('parentSrc'), '⑥ 新列必须在表尾（插在中间会让按下标取数的下游静默错位 —— §E367 的规矩）');
  const i2 = hd.indexOf('parentOf2');
  const iS2 = hd.indexOf('parentSrc2');
  const nDisk = LT.slice(1).filter(l => (l.split('\t')[i2] || '').trim() !== '').length;
  const nSrc2 = LT.slice(1).filter(l => (l.split('\t')[iS2] || '').trim() === 'soup').length;
  /* ⑦ 落盘的两列必须自洽，且不许整层空。
   * ⚠ 这里原本写的是"声明数 − 薄掉的 − 只解出一个父的 = 边数"那种**自己推 lineage 内部**的公式，
   *   10-12 在干净克隆里第一次真跑就量出它错（期望 1 ‖ 实测 4）：`pof2` 在"父同时能按路径/臂解出来"的粒上也会落值，
   *   而那就不属于"薄图"口径了 ⇒ 在门外重算别人的解析器，得到的只会是这种**看起来合理的假红**。
   *   现在钉的是不需要知道内部的两件事：① `parentOf2` 有值 ⇔ `parentSrc2 == 'soup'`（把两列解耦就当场红）
   *   ② 边数不许为 0、也不许凭空多于声明枚数（§E503 那个病形就是干净克隆里 6→0）。 */
  eq(nDisk, nSrc2, '⑦ `parentOf2` 有值的行数必须等于 `parentSrc2=soup` 的行数（实测 ' + nDisk + ' ‖ ' + nSrc2 +
    '）⇒ 两列一旦解耦，"这枚有两个父"就只剩一半证据');
  ok(nDisk >= 1, '⑦ 第二父边一条都没有（实测 0 ‖ 门扫 meta 声明 ' + soupMeta.length +
    ' 枚融合粒）⇒ 这就是 §E503 立的原始病：图上融合家族整层消失');
  ok(nDisk <= soupMeta.length, '⑦ 第二父边 ' + nDisk + ' 条多于声明的融合粒数 ' + soupMeta.length +
    ' ⇒ 边是从别处冒出来的（表被手改或 wid 反查撞了）');
});
/* ===== D234（§E590 · 千问）冠军池的装配契约不许漂 =====
 * 为什么**立新门**而不是往别处加腿（用户 2026-10-11 23:0x：「不必要死守按照现有的规则」+
 *   「往现有门加腿甚至比单纯加门还要差，不好区分了」）：池是新对象（逐席不同枚），
 *   它的判据主语是"成员在册 / bundle 与表同权重 / 抽签可复现 / 降级要说话"，与 `D191`（kept 别名）、
 *   `D227`（难度阶梯）、`D168`（出厂槽）都不重叠。塞进它们的腿里，只会让这几条门"在判什么"变成不可知。
 * 每条腿都对应一种**具体的坏法**（不写空枪腿）：
 *   ① 成员不在 git ⇒ CI 与干净克隆看不见这枚（今晚 `D191` 的④就是被"只在本机存在的目录"钉红的，同一个坑不能再踩第二遍）
 *   ② bundle 与表不同权重 ⇒ "名字对、包不对"（§E589 那 301 份拷贝的老病，换了形态）
 *   ③ 自动成员带 block / 被人席判死进池 ⇒ 把已经判过刑的包又放上桌
 *   ④ 抽签不可复现 ⇒ 池读数全部作废（同 seed 重放必须逐字相同）
 *   ⑤ 降级不说话 ⇒ 池空/单成员时产品会"看起来正常"地四席全同
 *   ⑥ 契约的三处读者（页面 / 量具 / 真源表）少一个 ⇒ 文档写了但没人执行
 *   ⑦ 页面解包用错对象 ⇒ 整池静默退回单包，而标签照样说"池在生效"（只有真跑解包才抓得到）
 *   ⑧ 人席批表缺基准行 ⇒ "算不出"被读成"零格否决"，被判死的包会以"自动成员"身份进池（10-12 实测两枚）
 *   ⑨ 回显（`aiInfo`）与决策（`champForSeat`）各判一次池生不生效 ⇒ 本机导入时标签说"池在跑"而实际四席用你那一枚
 * ⚠ 判的是 `pool-add --audit` 吐的 **JSON 里的数**，不是退出码（管道会吃掉退出码 —— 本机栽过两次）。
 * ⚠ 本门的输入全在 git 里（腿①自己就在查这件事）⇒ 它不会变成又一个"CI 上永远 SKIP"（`D231`/`D233` 的教训）。 */
}

