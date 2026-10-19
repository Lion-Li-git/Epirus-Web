/*#np-part-header
{"file":"tools/gates/ui-contract.mjs","part":"ui-contract","group":"ui","ranges":[[3751,3797],[3993,4044],[5846,5859],[6671,6712],[8132,8174],[8542,8643]],"gates":[3751,3772,3993,5846,6671,8132,8542,8543],"patched":[]}
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
export const ords = [3751, 3772, 3993, 5846, 6671, 8132, 8542, 8543];
/* 8543 = v1.7.115 的 D236（新门）。取上一枚之后的合成号：排序仍落在最后，且与既有门的原始行号不冲突。 */
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D37 页面回合列表/导出：死人不许出ジ、观战回合必须显示技能并落 transcript', function () {
  /* 用户实测报的三个 bug（v1.5.21 修）：① 死掉的玩家仍在回合列表里出【ジ】；
   * ② 人类死后自动观战那段从不追加 transcript ⇒ "导出对局记录"只到玩家死前；
   * ③ 同处只写"第 N 回合（观战）"，不显示任何人用了什么技能。
   * 修法是把"拼回合行 / 追加 transcript"抽成**单一真源**（roundLineParts / pushTranscript），
   * 正常回合与观战回合共用。这条用源码级断言钉住"不许再退回各写一份"。 */
  const ui = readFileSync('js/ui/ui.js', 'utf8');
  ok(/function roundLineParts\(\)/.test(ui), '必须有 roundLineParts()：回合行的单一真源');
  ok(/function pushTranscript\(/.test(ui), '必须有 pushTranscript()：transcript 的单一真源');
  ok(ui.indexOf("p.name + '=【已淘汰】'") >= 0, '死且本回合没出手的玩家必须显示【已淘汰】（不许再出ジ）');
  const spec = ui.slice(ui.indexOf('function autoRunRest()'), ui.indexOf('function autoRunRest()') + 1600);
  ok(spec.indexOf('roundLineParts()') >= 0, '观战回合必须走 roundLineParts()（显示技能行）');
  ok(spec.indexOf('pushTranscript(') >= 0, '观战回合必须 pushTranscript()（否则导出只到玩家死前）');
  ok(spec.indexOf('persistBattle()') >= 0, '观战回合必须 persistBattle()（上局记录也要完整）');
  /* ⚠️ 用户第三次澄清（v1.5.22）：**技能格按钮**用规则顺序（能量在最上）；
   * "防御优先"指的是**回合日志的显示顺序**，与格子无关 —— 前两轮把它错用在格子上，各错一次。 */
  ok(ui.indexOf('const SD_GRP =') < 0, '技能格按钮**不得**再做"防御优先"重排（用户已明确：格子用规则顺序）');
  ok(/const sdOrder = R\.skills\.map\(function \(s, i\) \{ return \{ s: s, i: i \}; \}\);/.test(ui),
    '技能格按钮必须用 R.skills 的规则声明顺序（能量 → 攻击 → 防御 → 特殊）');
});

t('D38 结算事件行的**显示顺序**（防御→中立→攻击→镜像；被无效先于使其无效）+ 不得改动引擎事件数组', function () {
  /* 用户第三次澄清（v1.5.22）："防御优先"说的是**回合日志里结算事件行的显示顺序**，且明确"与后端实现无关"。
   * 三条规则：① 防御类先于攻击类 ② 被无效的先于使其无效的 ③ 原技能先于镜面反射复制出来的。
   * 这条钉住：实现存在 + 只排渲染副本（不许给 state.events 排序）+ 同档稳定。 */
  const ui = readFileSync('js/ui/ui.js', 'utf8');
  ok(/function evDisplayRank\(e\)/.test(ui), '必须有 evDisplayRank()：事件 → 显示档 (tier, sub)');
  ok(/function orderEventsForDisplay\(list\)/.test(ui), '必须有 orderEventsForDisplay()：稳定排序');
  ok(ui.indexOf('for (const e of orderEventsForDisplay(list))') >= 0,
    'logEvents 必须渲染**排序后的副本**（否则显示顺序规则等于没做）');
  ok(ui.indexOf('EV_TIER_DEF') >= 0 && ui.indexOf('EV_TIER_ATK') >= 0 && ui.indexOf('EV_TIER_MIRROR') >= 0,
    '三个档位表必须存在：防御 / 攻击 / 镜像复制');
  ok(ui.indexOf('EV_SUB_VOIDER') >= 0, '必须有"使其无效"子档（cancel/clash/thunderRing）');
  const at = ui.indexOf('function orderEventsForDisplay(list)');
  const fn = ui.slice(at, at + 400);
  ok(fn.indexOf('list.map(') >= 0, 'orderEventsForDisplay 必须先 map 出副本（不许就地排序）');
  ok(!/list\.sort\(/.test(fn), 'orderEventsForDisplay 不许对入参 list 直接 sort（会打乱引擎事件数组）');
  ok(fn.indexOf('a.i - b.i') >= 0, '同档必须用原始下标做**稳定**排序（否则无关事件被打乱）');
  ok(ui.indexOf("if (e.type === 'death') return [2, 1];") >= 0,
    '**死亡结算必须排在伤害之后**（用户实测：第一版把 death 当中立 ⇒ 先死再掉血，很搞笑）');
  /* v1.5.140（用户实机 R9/R10/R23 抓到"挡下先于摆出"）：防御档内部必须再分子档——
   * 摆出架势类（guardSet/holoSet/rod）sub=0，其结果类（blocked/reflect/voidImmune/curseBlock/rodBlock）sub=1。 */
  ok(ui.indexOf('EV_SUB_RESULT') >= 0, '必须有"架势结果"子档表 EV_SUB_RESULT（blocked/reflect/…排在摆出之后）');
  ok(/EV_TIER_DEF\[e\.type\]\) return \[0, EV_SUB_RESULT\[e\.type\] \? 1 : 0\]/.test(ui),
    'evDisplayRank 的防御档必须按 EV_SUB_RESULT 分 [0,0]/[0,1]（一律 [0,0] = 老 bug 复现）');
});

t('D28 模式入口一致性：两根轴都在页面上、每档下拉都被映射表接住（v1.6.5 起「模式」下拉已删，入口 = 人数 × 血量）', function () {
  /* 第三方复核 §3-2(d) 的建议。起因是实测：`MODES.lucky` 无入口无测试、`MODES.fast` 无入口
   * 但引擎分支还在、`tests/spec.js` 的 R52 用例**还在跑**（守一条不可达路径）——
   * 作者本人都以为删了。这条把"入口/实现/文档三者一致"变成机械检查，与 D8（版本号三方一致）同族。
   * ===== v1.6.5 的形状变化 =====
   * 原来那根「模式」下拉同时焊死了**人数**与**血量**（standard=2人3血 / multi=3~5人3血 / long=3~5人5血），
   * 用户裁定"把 2 人合并进多人，变成选人数 × 3血/5血正交"之后入口变成两根轴（`#sel-players` × `#sel-hp`），
   * 模式键由 `js/ui/ui.js` 的表查出来。于是本条改判**页面结构**：两根轴都在、取值合法、旧下拉删净。
   * ⚠ 分工（避免三份实现）：映射表的**集合运算**在 D226③，12 种组合的**真行为**在 `tools/smoke.mjs`（要起浏览器）。
   *   本条抓的是另一类半截改动：有人给下拉加了一档（如 6 血）却忘了给映射表加行 ⇒ 那一档静默回落成默认血量。
   * 反证：给 `#sel-hp` 加一档 6 血 ⇒ ①c 与 ③ 红；给 MODES 加一个不在映射表里的 key ⇒ D226③d 红；把 option 拼错 ⇒ ①a 红。 */
  const html = readFileSync('index.html', 'utf8');
  const uiSrc = readFileSync('js/ui/ui.js', 'utf8');
  const optVals = function (id) {
    const sel = new RegExp('<select id="' + id + '">([\\s\\S]*?)</select>').exec(html);
    if (!sel) return null;
    const out = []; const re2 = /<option value="([^"]+)"/g; let m3;
    while ((m3 = re2.exec(sel[1]))) out.push(m3[1]);
    return out;
  };
  const pl = optVals('sel-players'), hp = optVals('sel-hp');
  ok(pl !== null && pl.join(',') === '2,3,4,5', '①a 人数下拉必须在、且恰好 2/3/4/5 四档（实测 ' + JSON.stringify(pl) + '）');
  ok(hp !== null && hp.length >= 3, '①b 血量下拉 `#sel-hp` 必须在（v1.6.5：人数与血量是两根正交轴）');
  /* ①c 每一档血量都必须被 `ui.js` 的映射表接住（表里的行形状是 `3: 'multi'` ⇒ 判 `\b<值>:`） */
  for (const h of (hp || [])) ok(new RegExp('\\b' + h + ':').test(uiSrc), '①c 血量档 ' + h + ' 血在 `ui.js` 的映射表里必须有行（没行 = 选了它却静默建出默认血量的局）');
  ok(html.indexOf('id="sel-mode"') < 0, '①d 旧那根「模式」下拉必须删净（留着就是第三根轴，会把两根轴的查表结果盖掉）');

  const modes = Object.keys(R.MODES);
  /* ② MODES 里每个 key 都必须真出现在映射表的**值**侧（不是名字侧的注释里）⇒ 防"有实现、有测试、无入口"这种原始形状。
   * ⚠ 这里只判"值在不在 ui.js 里"；**像的集合运算**（哪一格查出哪个键）在 D226③ ⇒ 同一件事不写三份判据。 */
  for (const k of modes) {
    ok(new RegExp("'" + k + "'").test(uiSrc), '② MODES.' + k + ' 必须在 `js/ui/ui.js` 的映射里出现（不然这个模式页面永远查不到 = 幽灵模式，D28 当年抓的 `fast`/`lucky` 就是这种）');
  }
  /* ③ 反方向：映射表里有行、下拉里却没那一档 ⇒ 那行是死代码（玩家选不到），也要响亮红 */
  const tblBlock = (/const HP_MODE = \{([\s\S]*?)\}/.exec(uiSrc) || [, ''])[1];
  const tblHps = [];
  tblBlock.split(',').forEach(function (pair) {
    const k = (pair.split(':')[0] || '').trim();
    if (/^\d+$/.test(k)) tblHps.push(k);
  });
  ok(tblHps.length >= 3, '③a 从 `ui.js` 的映射表切出的血量档必须 ≥3（实测 ' + tblHps.length + '）⇒ 切不到就是表的形状变了，下面那条双向比会变成装饰（记忆第二十五条）');
  const ghost = hp === null ? [] : tblHps.filter(function (h) { return hp.indexOf(h) < 0; });
  eq(ghost.length, 0, '映射表里有血量档而 `#sel-hp` 没有（选了也到不了 = 第二份定义的漂移起点）：' + ghost.join(', '));

  /* 原始规则里有、本程序**明确不做**的模式必须显式登记（v1.5.18 用户裁定：快速/欧皇删掉）。 */
  for (const k of ['fast', 'lucky', 'vampire']) {
    ok(modes.indexOf(k) < 0, 'MODES 不应再有 ' + k + '（不做的模式只登记在文档里，不留在代码里）');
  }
  /* （原来这里还钉"RULES-2P 里必须出现『本程序不做』这四个字" —— v1.6.12 删除 ⇒ 上面那三条**代码侧**的钉
   *   （MODES 里不许再有 fast/lucky/vampire）才是真牙；文档那半边交给 D230 管"指针不许落空"，措辞不管。） */
});

t('D70 UI 契约：目标弹窗可取消 + 结算期点击有反馈（复核 §5-①②）', function () {
  const src = readFileSync('js/ui/ui.js', 'utf8');
  ok(src.indexOf('B.picking = { key: key, bead: bead }') >= 0, '目标弹窗必须登记待选状态 picking');
  ok(src.indexOf('function cancelPick()') >= 0, '必须有 cancelPick');
  ok(src.indexOf("ev.key === 'Escape' && B.picking") >= 0, 'Esc 必须能取消（只在有待选状态时拦截）');
  ok(src.indexOf("$('modal-root').onclick") >= 0 && src.indexOf('B.picking) cancelPick()') >= 0, '点遮罩也要能取消');
  ok(src.indexOf('选择目标（Esc') >= 0, '弹窗开着时提示必须写"选择目标"');
  ok(src.indexOf('你刚才的点击没有生效') >= 0, '结算期间点击必须明确告知（不再静默丢弃）');
  ok(src.indexOf('已放弃【') >= 0, '改主意/误触必须留痕');
  ok(src.indexOf('取消', src.indexOf('label:')) >= 0 || src.indexOf('↩ 取消') >= 0, '弹窗必须提供「取消」按钮');
  ok(src.indexOf('B.aiKey = null; B.picking = null;') >= 0, '新局必须重置待选状态');
  ok(src.indexOf('请出招') >= 0, '回合开始的"请出招"提示必须保留（只改弹窗开着时的提示）');
});

t('D131 卡面提示必须说真话（v1.5.173 · 用户实测"摄魂 bug 没解决"追到的成因）：门槛按模式取真值，文案不许自己抄一份数字', function () {
  /* 成因（`results/摄魂.txt`）：引擎按 `state.mode.drainHpMax` 放行（长程 3），而 `rules.js` 的 `desc` 写死"仅限 HP≤1"
   * ⇒ 长程 HP 2 时格子**该亮**也确实亮，提示却说"≤1" ⇒ 玩家读成"血回上去了还能用 = 没修"。**引擎没错，文案过期。**
   * 所以这条门两半：① 判**引擎**逐档（防真闩锁回来）；② 判**提示跟着模式变数字**（防这次这种"说的≠做的"）。 */
  const caps = { long: 2, multi: 1, multi4: 1, standard: 1 };   // v1.5.174：长程窗口 3 → 2（用户裁定）‖ v1.6.5：4 血那一格照 multi 的 ≤1（D226①c 钉"4 血 = 多一格血，不是第四套规则"）
  for (const mode in caps) {
    const cap = (R.MODES[mode].hp) || 3, lim = caps[mode];
    for (let hp = cap; hp >= 1; hp--) {
      const st = S.createState(mode, { next: mulberry32(4242) }, mode === 'standard' ? 2 : 5);
      st.p[0].hp = hp; st.p[0].ep = 9;
      const okCost = S.computeCost(st, 0, R.SK.DRAIN).ok;
      const inLegal = Play.legalActions(st, 0).some(function (x) { return x.key === R.SK.DRAIN && x.affordable; });
      eq(okCost, hp <= lim, mode + ' HP' + hp + ' 的 computeCost 必须按 ≤' + lim + ' 判（实测 ok=' + okCost + '）');
      eq(inLegal, hp <= lim, mode + ' HP' + hp + ' 的合法表必须与 computeCost 同口径（防"UI 亮着而引擎拒"那种分裂）');
    }
  }
  /* ② 提示组装：单一来源 `js/ui/skill-tip.js`（纯函数 ⇒ 这里能直接跑），数字必须来自 `st.mode.drainHpMax` */
  const box = { console: console, Math: Math, JSON: JSON, Object: Object, Array: Array, Number: Number, String: String, Error: Error, isNaN: isNaN };
  box.window = box; box.globalThis = box;
  vm.runInNewContext(readFileSync('js/ui/skill-tip.js', 'utf8'), box, { filename: 'js/ui/skill-tip.js' });
  ok(box.EpirusSkillTip && typeof box.EpirusSkillTip.of === 'function', '必须导出 EpirusSkillTip.of');
  const drain = R.skills.find(function (x) { return x.key === R.SK.DRAIN; });
  const tipLong = box.EpirusSkillTip.of(R, { mode: { drainHpMax: 3 } }, drain);
  const tipStd = box.EpirusSkillTip.of(R, { mode: {} }, drain);
  ok(/仅限 HP≤3/.test(tipLong), '提示必须跟着模式给的数字走（合成态喂 3 就要写 3；实测：' + tipLong + '）');
  /* v1.5.174（用户裁定长程 3 → 2）：**真模式对象**的提示必须写 ≤2 —— 这条才是"页面此刻对用户说了什么" */
  const tipReal = box.EpirusSkillTip.of(R, { mode: R.MODES.long }, drain);
  ok(/仅限 HP≤2/.test(tipReal), '长程（真配置）提示必须写 ≤2（实测：' + tipReal + '）');
  ok(!/仅限 HP≤3/.test(tipReal), '长程提示里不许残留上一代的 ≤3');
  ok(/仅限 HP≤1/.test(tipStd), '2 人/多人提示必须仍是 ≤1（实测：' + tipStd + '）');
  ok(tipLong !== tipStd, '两种模式的提示不许相同（相同 = 又回到"一个数字写死"）');
  ok(tipLong.indexOf('HP≤1') < 0, '长程提示里不许残留过期数字');
  /* 非摄魂卡必须逐字不变（本函数只换它负责的那一处数字） */
  const gun = R.skills.find(function (x) { return x.key === R.SK.GUN; });
  eq(box.EpirusSkillTip.of(R, { mode: { drainHpMax: 3 } }, gun), String(gun.desc), '别的卡一个字都不许动');
  /* ③ 接线：ui.js 必须走这个单一来源，index.html 必须加载它（否则页面里 undefined ⇒ 静默不显示） */
  const uiSrc = readFileSync('js/ui/ui.js', 'utf8');
  ok(uiSrc.indexOf('Tip.of(R, st, s)') >= 0, 'ui.js 组卡面提示必须走 EpirusSkillTip（自己再抄一份数字 = 本仓那四次同型病）');
  ok(uiSrc.indexOf("仅限 HP≤") < 0, 'ui.js 里不许再出现写死的"仅限 HP≤N"');
  ok(readFileSync('index.html', 'utf8').indexOf('js/ui/skill-tip.js') >= 0, 'index.html 必须加载 skill-tip.js');
});

t('D111 前台探索三条规则（v1.5.142 · ②③ 于 09-22 夜升级为序列窗锁）：铺垫卡 ep 门槛 + 链上回合整锁', function () {
  /* 病（docs/research/logs/RESEARCH-LOG-2026-09-21-ds.md §10，DS 实测）：贴贴/蓄能只在 ε>0 时出现（ε=0 ⇒ 0.00/局、
     前台 ε.2 ⇒ 2.7/局），而**天火两档都是 0.00/局** ⇒ 探索只付铺垫成本、结构性地拿不到收尾。
     用户三条裁定 → 落在 `policyChooserN` 的 `epsMode==='soft'` 分支里。本门**行为式**验证。 */
  const evoSrc = readFileSync('js/train/evo.js', 'utf8');
  ok(evoSrc.indexOf("epsMode === 'soft'") >= 0 && evoSrc.indexOf('HOLD_MIN_EP') >= 0,
    '规则必须只作用于 soft（缺省 epsMode 与 eps=0 的读数逐字不变）');
  const params = loadChampParams(Pol, 'js/bundled-champion-3p.js');   // 线上 3P 包（S / R / T / mulberry32 用外层句柄）
  const draws = function (st, pid, key, n) {   // 用 ε=1（必探索）+ soft ⇒ 只测"探索集"本身
    const chooser = T.policyChooserN(params, 0.15, 1, 5, 'soft');
    const legal = key.map(function (k) { return { key: k, affordable: true }; });
    const hit = {};
    for (let i = 0; i < n; i++) { const r = chooser(st, pid, legal); hit[r.key] = (hit[r.key] || 0) + 1; }
    return hit;
  };
  const mk = function () { return S.createState('multi', { next: mulberry32(11) }, 5); };
  const K = R.SK;
  const KEYS = [K.JI, K.CURSE, K.CHARGE, K.RAILGUN, K.FIRESTORM, K.GUN, K.SNIPE];
  /* ① 低 ep（<3）：贴贴/蓄能**不许**进探索集 ⇒ 200 次抽样里一次都不该出现 */
  const st1 = mk(); st1.p[0].ep = 1;
  const h1 = draws(st1, 0, KEYS, 200);
  eq((h1[K.CURSE] || 0) + (h1[K.CHARGE] || 0), 0, 'ep=1 时探索不得抽到贴贴/蓄能（实测 ' +
    (h1[K.CURSE] || 0) + '/' + (h1[K.CHARGE] || 0) + ' 次）');
  /* ②③（09-22 夜裁升级）：白班的"并入探索集"被**序列窗锁**覆盖 —— 持珠/持符的回合整回合作废探索，
   * 比"收尾卡抽得到"更强（抽不到≠会被改判；夜测 §N4：悬崖在 ε=0.1 就跌满 ⇒ 可达性不够，要原子性）。
   * 断言随之改写：这类态上 ε=1 soft 必须**逐手等于 ε=0**（锁生效；deviation=0）。① 原样保留。 */
  const eqGreedy = function (st, n) {
    const soft = T.policyChooserN(params, 0.15, 1, 5, 'soft');
    const zero = T.policyChooserN(params, 0.15, 0);
    const legal = K ? KEYS.map(function (k) { return { key: k, affordable: true }; }) : [];
    let diff = 0;
    for (let i = 0; i < n; i++) {
      const a = zero(st, 0, legal), b = soft(st, 0, legal);
      if (a.key !== b.key) diff++;
    }
    return diff;
  };
  const st2 = mk(); st2.p[0].ep = 4; st2.p[0].elec = 1;
  eq(eqGreedy(st2, 100), 0, '持电珠回合 ε=1soft 与 ε=0 不许有任何改判（序列锁·白班②升级）');
  const st3 = mk(); st3.p[0].ep = 4; st3.p[1].stickers = [{ owner: 0, age: 1 }];
  eq(eqGreedy(st3, 100), 0, '有我方符咒回合 ε=1soft 与 ε=0 不许有任何改判（序列锁·白班③升级）');
});

t('D166 大雷连带**被挡下时 UI 不许说"造成伤害"**（v1.5.253 用户报）：文案必须按同回合的真事件反推', function () {
  /* 病（用户在实盘里发现）：`bigTChain` 事件在 `js/core/resolve.js` 里是**无条件发出**的 —— 发完才可能
   *   `continue` 完全挡住、或把伤害转给防御者的作用目标。UI 原来把这条**硬编码**成"受 2 点电伤"
   *   ⇒ "被挡下"被渲染成"造成了伤害"（**结算是对的，错的只有文案**）。
   * 本门做两件事：① 从 `js/ui/ui.js` **真源码**里抽出 `bigTChainText` 并跑它（不拷一份，测试跑的就是产品代码）；
   *   ② 三档现场用**引擎真结算**造出来（不手搓事件）：自守防御=完全挡住 / 藤甲=转给被贴者 / 非防御族=真打中。 */
  const src = readFileSync('js/ui/ui.js', 'utf8').split('\r\n').join('\n');
  const i0 = src.indexOf('const BIGT_CHAIN_REASON');
  const i1 = src.indexOf('function evText(e, roundEvents)');
  ok(i0 >= 0 && i1 > i0, 'ui.js 里必须存在 `bigTChainText`（连带文案的唯一来源）');
  const NM = ['你', '电脑1', '电脑2', '电脑3', '电脑4'];
  const nm = function (pid) { return NM[pid] != null ? NM[pid] : String(pid); };
  const mod = new Function('nm', src.slice(i0, i1) + '\n return { bigTChainText: bigTChainText };')(nm);
  ok(typeof mod.bigTChainText === 'function', '抽出的 `bigTChainText` 必须可调用（源码形状变了就要改本门）');

  const W = sandbox('.');
  const R = W.EpirusRules, S = W.EpirusState, X = W.EpirusResolve;
  const rng = function (a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  /* 现场：c=0 放【真正的落雷】→2；T=2 用【枪】打 q=1（让 q 成为连带候选）；q=1 用 `qKey`。 */
  const scen = function (qKey, qTarget) {
    const st = S.createState('long', { next: rng(7) }, 5);
    X.startTurn(st);
    st.p.forEach(function (p) { p.ep = 0; });
    st.p[0].ep = 10; st.p[2].ep = 3;
    st.actions[0] = { key: R.SK.BIG_T, target: 2, opt: null };
    st.actions[2] = { key: R.SK.GUN, target: 1, opt: null };
    st.actions[1] = { key: qKey, target: qTarget, opt: null };
    st.actions[3] = { key: R.SK.JI, target: 3, opt: null };
    st.actions[4] = { key: R.SK.JI, target: 4, opt: null };
    const before = st.events.length;
    X.resolveActions(st);
    const evs = st.events.slice(before);
    return { evs: evs,
      chain: evs.filter(function (e) { return e.type === 'bigTChain'; }),
      dmg: evs.filter(function (e) { return e.type === 'damage' && e.reason === '真正的落雷·连带'; }) };
  };
  const A = scen(R.SK.GUARD, 1);      // 自守防御 ⇒ 完全挡住
  const B = scen(R.SK.ARMOR, 2);      // 藤甲（enemy 目标）⇒ 伤害转给被贴者
  const C = scen(R.SK.GUN, 2);        // 非防御族 ⇒ 真打中（对照）
  /* 前置（本门要测的三档都必须真的被造出来，否则门会变成"测空气"） */
  eq(A.chain.length, 1, '前置：自守防御那档必须产生 bigTChain 事件');
  eq(A.dmg.length, 0, '前提：自守防御那档**没有连带伤害**（这正是用户看到"被挡下"的情形）');
  eq(B.dmg.length, 1, '前置：藤甲那档必须产生连带伤害（转给被贴者）');
  eq(C.dmg.length, 1, '前置：非防御族那档必须真的打中');

  const aT = mod.bigTChainText(A.chain[0], A.evs).html;
  ok(!/受 2 点电伤|受 2 点伤害/.test(aT) && /挡下/.test(aT),
    '【用户报的那条】被挡下时绝对不许说"受 2 点电伤"，必须说"挡下"：实际=' + aT);
  const bT = mod.bigTChainText(B.chain[0], B.evs).html;
  ok(bT.indexOf(NM[B.dmg[0].to]) >= 0 && /转给/.test(bT) && !new RegExp(NM[B.chain[0].to] + ' 受').test(bT),
    '转走时必须指出**真实受害者**、不许记在连带候选头上：实际=' + bT);
  const cT = mod.bigTChainText(C.chain[0], C.evs).html;
  ok(/受 2 点电伤/.test(cT), '真打中时仍要报数（不许为了修 A 把 C 也改哑）：实际=' + cT);
  /* ===== 第四档：**一回合两个候选**（q=1 自守防御=被挡 · q=3 非防御族=真中）=====
   * 这一档是**第一版说假话的地方**，而它是我在**真 Chrome**里跑页面才发现的：
   *   第一版扫的是"整回合的连带伤害" ⇒ 被挡的那条看到**别的候选的伤害**，把它误报成"转给你"。
   * 引擎对每个候选是"先发 `bigTChain`、紧跟自己的投递" ⇒ 判据必须落在**段内**（到下一个 bigTChain 为止）。 */
  const two = (function () {
    const st = S.createState('long', { next: rng(7) }, 5);
    X.startTurn(st);
    st.p.forEach(function (p) { p.ep = 0; });
    st.p[0].ep = 10; st.p[2].ep = 3;
    st.actions[0] = { key: R.SK.BIG_T, target: 2, opt: null };
    st.actions[2] = { key: R.SK.GUN, target: 1, opt: null };
    st.actions[1] = { key: R.SK.GUARD, target: 1, opt: null };   // 自守防御 ⇒ q=1 被完全挡住
    st.actions[3] = { key: R.SK.GUN, target: 2, opt: null };     // 非防御族 ⇒ q=3 真吃 2 点
    st.actions[4] = { key: R.SK.JI, target: 4, opt: null };
    const before = st.events.length;
    X.resolveActions(st);
    const evs = st.events.slice(before);
    return { evs: evs,
      chain: evs.filter(function (e) { return e.type === 'bigTChain'; }),
      dmg: evs.filter(function (e) { return e.type === 'damage' && e.reason === '真正的落雷·连带'; }) };
  })();
  eq(two.chain.length, 2, '前置：一回合两候选必须产生两条 bigTChain');
  eq(two.dmg.length, 1, '前置：这一回合只有**一个**候选真吃到连带伤害');
  const blk = two.chain.filter(function (x) { return x.to === 1; })[0];
  const hit = two.chain.filter(function (x) { return x.to === 3; })[0];
  ok(blk && /挡下（未造成电伤）/.test(mod.bigTChainText(blk, two.evs).html),
    '同回合还有别的候选真中时，被挡的那条**仍**必须说"挡下（未造成电伤）"，不许说"转给"（第一版就是在这里说假话）：实际=' +
    (blk ? mod.bigTChainText(blk, two.evs).html : '(缺候选)'));
  ok(hit && /受 2 点电伤/.test(mod.bigTChainText(hit, two.evs).html), '同回合真中的那条仍要报数：实际=' +
    (hit ? mod.bigTChainText(hit, two.evs).html : '(缺候选)'));
  /* 接线：每个渲染路径的调用点都必须把**整回合事件表**传进去（否则 `roundEvents` 恒为 undefined、修了等于没修）
   * ⚠ v1.6.6 计数从 3 改成 2 + **按函数体判**：第三个调用点在被删掉的 2 人专属 AI 路径里（`doPick`/`chooseAI`）。
   *   只判总数会被"两处都落在同一个函数里、另一条渲染路径没接"蒙过去 ⇒ 这里逐条问"这两个函数各自接到没有"。 */
  const evBody = function (name) {
    const i = src.indexOf('function ' + name + '(');
    if (i < 0) return null;
    const j = src.indexOf('\n  function ', i + 10);
    return src.slice(i, j < 0 ? src.length : j);
  };
  ok(String(evBody('logEvents') || '').indexOf('evText(e, list)') >= 0,
    'D166 接线：`logEvents` 必须把整回合事件表传给 `evText`（实测 ' + (evBody('logEvents') === null ? '函数不见了' : '没有该调用') + '）');
  ok(String(evBody('pushTranscript') || '').indexOf('evText(e, events)') >= 0,
    'D166 接线：`pushTranscript`（回合行 → transcript 的那一处）必须把事件表传给 `evText`（实测 ' + (evBody('pushTranscript') === null ? '函数不见了' : '没有该调用') + '）');
  eq((src.match(/evText\(e, (list|events)\)/g) || []).length, 2,
    '页面里带事件表的 `evText` 调用点必须**恰好 2 处**（v1.6.6 起 2 人不再有自己的第三条渲染路径）；多一处 = 又开了一条没并进来的循环');
  ok(/case 'bigTChain': return bigTChainText\(e, roundEvents\);/.test(src),
    '`evText` 的 bigTChain 分支必须委托给 `bigTChainText`（不许再内联硬编码）');
});

/* ===== v1.7.115（用户 10-19 裁「页面默认开档要不要门腿」= 要）：页面必须把送盾先验开起来 =====
 * 为什么需要这条腿：`js/ui/ui.js` 里那一行 `setSupportPrior(2)` 是**产品行为的开关**——删掉它，
 *   `v7beadseed-82` 这类包在真机上就是 17.3 次/局送盾刷屏（我 v1.7.111 开的就是它）。
 *   而它此前**没有任何门覆盖**（`grep tools/gates/ tools/np-test.mjs` 对 `SUPPORT_PRIOR` 零命中）⇒ 删了没人拦。
 * 形状：**接线腿**（源码里那条调用在）+ **反静默腿**（不许再用 `catch (e) { void e; }` 吞掉回读失败）。
 *   行为面已由 `tools/probe-support-prior.mjs` 的 9 条自证腿覆盖，这里只管"页面有没有接上"。 */
t('D236 页面必须把送盾先验开档 2 并且**不许静默吞**回读失败（v1.7.115 · 接线腿）', function () {
  const uiRaw = readFileSync('js/ui/ui.js', 'utf8');
  /* ⚠ 先剥注释：ui.js 的 §E648 注释里就写着「原来那个 catch(e){void e;}」，不剥会自己踩自己。 */
  const ui = uiRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok(/setSupportPrior\(2\)/.test(ui), '页面必须在拿到 Trainer 之后调 `setSupportPrior(2)`（实测没有该调用 ⇒ 送盾先验在真机上等于关闭）');
  ok(!/catch\s*\(\s*e\s*\)\s*\{\s*void\s+e;\s*\}/.test(ui),
    '回读失败不许用 `catch (e) { void e; }` 静默吞（那会把"设失败"变成"看不出"）—— 必须回读 + 响亮警告');
  const T = readFileSync('js/train/evo.js', 'utf8');
  ok(/function setSupportPrior\(/.test(T) && /setSupportPrior,\s*supportPriorOn/.test(T),
    '引擎必须导出 `setSupportPrior`（页面的调用要真有落点，不能是死名）');
  ok(/supportPriorOn,/.test(T) || /supportPriorOn\s*,/.test(T), '引擎必须同时导出只读回读口 `supportPriorOn`（否则页面无法自证\'真的设成了 2\'）');
});

}

