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
  /* ===== 行为腿（10-25 夜班·#61，照 D38/D166 那招切真源码再跑）=====
   *   原来这 8 条里 6 条是 `ui.js` 的字面钉（`'=【已淘汰】'` 在不在、`const sdOrder = R.skills.map(...)`
   *   一字不差、`const SD_GRP =` 不许出现、两条函数名正则）。它们**两头都错**：改个措辞（【已淘汰】→【阵亡】）
   *   就误红，而这条门真正该守的事一条都读不到 ——
   *     ⓐ 本回合**刚死但出过手**的人仍要显示他用了什么：把 `!(a && a.key) && p.hp <= 0` 写成只看 hp
   *        就是"死人一律打叉"的回归，而旧钉**照样绿**（它只钉住了"死人显示已淘汰"那一半）；
   *     ⓑ 四种 outcome 后缀（未发动 ‖ 禁用无效 ‖ 无效 ‖ 无后缀）；
   *     ⓒ transcript 那一行的字段（round / line / human / ai / 剥 HTML / 空事件不许留成 null）
   *        —— "导出对局记录"读的就是这些字段，旧钉只钉"有没有调用"；
   *     ⓓ 两条路都不许**手抄**一份回合行（`=【` 只许出现在 roundLineParts 里）。
   *   这些都不需要浏览器。`tools/smoke.mjs` 起真页面跑的是 12 组合"能否打完"，**不读 transcript/回合行**
   *   （10-25 现 grep：smoke.mjs 里没有 roundLineParts / pushTranscript / transcript 的任何一个消费者）
   *   ⇒ 本腿不与它重叠，不是"再来一遍"。 */
  const ui = readFileSync('js/ui/ui.js', 'utf8').split('\r\n').join('\n');
  const fSkill37 = fnBody(ui, 'function skillName(');
  const fRound37 = fnBody(ui, 'function roundLineParts(');
  const fPush37 = fnBody(ui, 'function pushTranscript(');
  ok(fSkill37.length > 10 && fRound37.length > 40 && fPush37.length > 40,
    '切片前置：skillName ‖ roundLineParts ‖ pushTranscript 三个函数体都要按名字切得到（实测 '
    + fSkill37.length + ' ‖ ' + fRound37.length + ' ‖ ' + fPush37.length + ' 字符）'
    + '⇒ 切不到 = 改名或被搬走，本门要跟着改，不许静默变成读空气');
  const B37 = { state: null, transcript: [] };
  const D37 = new Function('B', 'R', 'evText',
    fSkill37 + '\n' + fRound37 + '\n' + fPush37 +
    '\nreturn { roundLineParts: roundLineParts, pushTranscript: pushTranscript };')(
      B37, R, function (e) { return (!e || e.html == null) ? null : { html: e.html }; });
  const NM37 = function (k) { return R.byKey[k].name; };
  /* 把座位表装进 B.state 再跑**真函数**：seats = [{hp, a}]，`a` 缺省 ⇒ 本回合没出手 */
  const line37 = function (seats) {
    B37.state = {
      round: 7,
      p: seats.map(function (s, i) { return { name: '席' + i, hp: s.hp }; }),
      actions: seats.map(function (s) { return s.a; })
    };
    return D37.roundLineParts();
  };
  const one37 = function (a) { return line37([{ hp: 3, a: a }])[0]; };
  /* --- ⓐ 死人的两半：没出手 ⇒ 已淘汰；出过手 ⇒ 仍然要说他用了什么 --- */
  const deadIdle37 = line37([{ hp: 3, a: { key: R.SK.GUN, outcome: 'ok' } }, { hp: 0 }])[1];
  eq(deadIdle37, '席1=【已淘汰】',
    '① 死且本回合没出手 ⇒ 只许【已淘汰】，不许出现技能名或ジ（用户实测报的 bug①；实测 ' + deadIdle37 + '）');
  const deadActed37 = line37([{ hp: 3, a: { key: R.SK.GUN, outcome: 'ok' } }, { hp: 0, a: { key: R.SK.SWORD, outcome: 'ok' } }])[1];
  ok(deadActed37.indexOf(NM37(R.SK.SWORD)) >= 0 && deadActed37.indexOf('已淘汰') < 0,
    '① **本回合刚死但出过手**的人仍要显示他用了什么（旧 8 条读不到的那一半：只看 hp 的写法当场红，'
    + '而"『=【已淘汰】』这个字面还在不在"照样绿；实测 ' + deadActed37 + '）');
  eq(one37(undefined), '席0=【' + NM37(R.SK.JI) + '】',
    '① 活着但本回合没出手 ⇒ 照规则显示ジ（【已淘汰】只属于死人；实测 ' + one37(undefined) + '）');
  /* --- ⓑ 四种失效后缀（以前只能钉字面，现在直接看返回值） --- */
  ok(one37({ key: R.SK.GUN, outcome: 'ok' }).indexOf('（') < 0,
    '② outcome=ok ⇒ 不许挂任何后缀括号（实测 ' + one37({ key: R.SK.GUN, outcome: 'ok' }) + '）');
  ok(one37({ key: R.SK.GUN, outcome: 'insufficient' }).indexOf('（ジ不足·未发动）') >= 0,
    '② ジ不足要说"未发动"，不能只写"无效"（玩家要分得清"没放成"和"放出去被挡"；实测 '
    + one37({ key: R.SK.GUN, outcome: 'insufficient' }) + '）');
  ok(one37({ key: R.SK.GUN, outcome: 'banned' }).indexOf('（禁用无效）') >= 0,
    '② 禁用中的卡要写"禁用无效"（实测 ' + one37({ key: R.SK.GUN, outcome: 'banned' }) + '）');
  const voided37 = one37({ key: R.SK.GUN, outcome: 'voided' });
  ok(voided37.indexOf('（无效）') >= 0 && voided37.indexOf('未发动') < 0,
    '② 其余失效只写"无效"，不许和ジ不足混成同一格（实测 ' + voided37 + '）');
  /* --- 目标与占位 --- */
  const aim37 = line37([{ hp: 3, a: { key: R.SK.GUN, outcome: 'ok', target: 1 } }, { hp: 3 }])[0];
  ok(aim37.indexOf('→席1') >= 0, '③ 打了别人 ⇒ 回合行必须显出打到谁（实测 ' + aim37 + '）');
  const self37 = one37({ key: R.SK.JI, outcome: 'ok', target: 0 });
  eq(self37, '席0=【' + NM37(R.SK.JI) + '】', '③ 目标是自己 ⇒ 不许画箭头（实测 ' + self37 + '）');
  const allDead37 = line37([{ hp: 0 }, { hp: 0 }, { hp: 0 }, { hp: 3 }, { hp: 3 }]);
  eq(allDead37.length, 5, '③ 回合行必须**每席一格**（含死人）——"死亡席不占位"是 2 人旧路径的漏项，'
    + 'v1.6.6 合并两条路时才补上；实测 ' + allDead37.length + ' 格 ‖ ' + allDead37.join(' '));
  /* --- ⓒ transcript 的字段（"导出对局记录"读的就是这一行） --- */
  const p37 = line37([{ hp: 3, a: { key: R.SK.GUN, outcome: 'ok', target: 1 } }, { hp: 0 }]);
  B37.transcript = [];
  D37.pushTranscript(p37, [{ html: '<b>你</b>出枪' }, { html: null }, { html: '<i>伤害 1</i>' }]);
  eq(B37.transcript.length, 1, '④ 每次调用必须且只追加一行（实测 ' + B37.transcript.length + ' 行）');
  const row37 = B37.transcript[0];
  eq(row37.round, 7, '④ 行里必须带回合号（否则导出看不出这段属于第几回合；实测 ' + row37.round + '）');
  eq(row37.line, p37.join('  '), '④ line 必须就是**上面那套回合行**（观战与正常路共用 ⇒ 实测 ' + row37.line + '）');
  eq(row37.human, p37[0], '④ human 段 = 第一席（实测 ' + row37.human + '）');
  eq(row37.ai, p37.slice(1).join(' '), '④ ai 段 = 其余各席，3~5 人都在这段（实测 ' + row37.ai + '）');
  eq(row37.lines.join('|'), '你出枪|伤害 1',
    '④ 事件行必须**剥掉 HTML 标签**、且 evText 判为空的事件**不许留成 null/空串**（实测 '
    + JSON.stringify(row37.lines) + '）');
  /* --- ⓓ 接线：两条路都必须用上面那套，且都不许自己手抄一份 --- */
  const fMain37 = fnBody(ui, 'function doPickMulti(');
  const fSpect37 = fnBody(ui, 'function autoRunRest(');
  ok(fMain37.length > 40 && fSpect37.length > 40, '⑤ 切片前置：两条出手/结算循环都要按名字切得到（实测 '
    + fMain37.length + ' ‖ ' + fSpect37.length + ' 字符）⇒ 就是 D142 认定的那两条路（v1.6.6 起页面只有这两条）');
  ok(fSpect37.indexOf('roundLineParts()') >= 0, '⑤ 观战循环必须走 roundLineParts()（用户报的 bug③：以前只写"第 N 回合（观战）"、不显示任何人用了什么）');
  ok(fSpect37.indexOf('pushTranscript(') >= 0, '⑤ 观战循环必须 pushTranscript()（用户报的 bug②：导出只到玩家死前）');
  ok(fSpect37.indexOf('persistBattle()') >= 0, '⑤ 观战循环必须 persistBattle()（上局记录也要完整）');
  ok(fMain37.indexOf('roundLineParts()') >= 0 && fMain37.indexOf('pushTranscript(') >= 0,
    '⑤ 主循环 doPickMulti 同样必须走这两个单一真源（只接一条 = 修一半）');
  ok(fMain37.indexOf("'=【") < 0 && fSpect37.indexOf("'=【") < 0,
    '⑤ 两条路都不许**自己手抄**一份回合行（`=【` 只许出现在 roundLineParts 里；实测主循环 '
    + (fMain37.match(/'=【/g) || []).length + ' 处 ‖ 观战 ' + (fSpect37.match(/'=【/g) || []).length + ' 处）');
  /* ⚠️ 用户第三次澄清（v1.5.22）：**技能格按钮**用规则顺序（能量在最上）；
   * "防御优先"指的是**回合日志的显示顺序**，与格子无关 —— 前两轮把它错用在格子上，各错一次。 */
  /* --- ⓔ 技能格的**渲染顺序**：假 DOM 跑 buildSkillGrid，读按钮出现的先后 ---
   *   旧门在这里钉的是两条写法（`const SD_GRP =` 不许出现 + `const sdOrder = R.skills.map(...)` 一字不差）。
   *   后者改个变量名/换种写法就误红；前者更糟：一个**没人用的死常量**也会让它红，而它要防的那件事
   *   （**再排一次序**）现在直接读得出来。 */
  const fCost37 = fnBody(ui, 'function costLabel(');
  const fGrid37 = fnBody(ui, 'function buildSkillGrid(');
  ok(fCost37.length > 10 && fGrid37.length > 40, '⑥ 切片前置：costLabel ‖ buildSkillGrid 都要按名字切得到（实测 '
    + fCost37.length + ' ‖ ' + fGrid37.length + ' 字符）');
  const mk37el = function () {
    return { className: '', textContent: '', title: '', disabled: false, kids: [],
      appendChild: function (c) { this.kids.push(c); } };
  };
  const grid37 = { innerHTML: '', kids: [], appendChild: function (c) { this.kids.push(c); } };
  new Function('$', 'B', 'Play', 'S', 'R', 'document', 'CAT_NM', 'Tip', 'pickSkill',
    fCost37 + '\n' + fGrid37 + '\nbuildSkillGrid();')(
      function () { return grid37; },
      { state: { over: false, p: [{ cooldown: {} }] } },
      { legalActions: function () { return []; } },
      { canUseSkillInMode: function () { return true; } },
      R, { createElement: mk37el }, {}, { of: function () { return ''; } }, function () { });
  const btn37 = grid37.kids.map(function (b) {
    const nm = b.kids.filter(function (c) { return c.className === 'nm'; })[0];
    return nm ? nm.textContent : '?';
  });
  eq(btn37.join(','), R.skills.map(function (s) { return s.name; }).join(','),
    '⑥ 技能格必须**逐位等于 `R.skills` 的声明顺序**（能量 → 攻击 → 防御 → 特殊；实测 ' + btn37.join(',') + '）'
    + '⇒ 再排一次序（防御优先 ‖ 按 pri ‖ 按名字）红的是这一条，而不是"某个变量名的写法还在不在"');
  const guardAt37 = btn37.indexOf(NM37(R.SK.GUARD));
  ok(guardAt37 > 2, '⑥ 防御类不许浮到能量类三格之上（用户原话"能量类跑到防御类下面了，不符合直觉"；'
    + '实测「防御」在第 ' + (guardAt37 + 1) + ' 格，能量三格是 ' + btn37.slice(0, 3).join('/') + '）');
  /* （§删 · 10-25 夜班 #61：这里原来还有两条 —— `function roundLineParts\(\)` / `function pushTranscript\(`
   *   两条正则（上面的**切片前置**接管，且红时消息明写"本门要跟着改"，不会再被误读成"实现错了"）、
   *   `p.name + '=【已淘汰】'` 字面钉（ⓐ 接管，且旧钉只守得住"死人打叉"那一半、守不住"刚死但出过手"）；
   *   `const sdOrder = R.skills.map(...)` 一字不差与 `const SD_GRP =` 不许出现（ⓔ 接管；后者原本还会被一个
   *   **没人用的死常量**触发，那是误红而不是回归）。
   *   ⚠ 留着的那 5 条"有没有调用"（⑤）不是遗漏：**接线事实行为腿看不见** —— 与 D38 留
   *   `for (const e of orderEventsForDisplay(list))` 同理。 */
});

t('D38 结算事件行的**显示顺序**（防御→中立→攻击→镜像；被无效先于使其无效）+ 不得改动引擎事件数组', function () {
  /* 用户第三次澄清（v1.5.22）："防御优先"说的是**回合日志里结算事件行的显示顺序**，且明确"与后端实现无关"。
   * 三条规则：① 防御类先于攻击类 ② 被无效的先于使其无效的 ③ 原技能先于镜面反射复制出来的。
   * 这条钉住：实现存在 + 只排渲染副本（不许给 state.events 排序）+ 同档稳定。 */
  const ui = readFileSync('js/ui/ui.js', 'utf8').split('\r\n').join('\n');
  /* ===== 行为腿（10-25 夜班·#40 第二批）：照 D166 那招**从真源码切出函数再跑** =====
   *   原来这 11 条全是 `ui.js` 的写法钉（表在不在、`list.map(` 在不在、`a.i - b.i` 在不在、
   *   `if (e.type === 'death') return [2, 1];` 一字不差）。那种钉改名就误红，而真正会坏的四族
   *   ——① 同档丢子档（"先看到挡下、后看到摆出"，用户实机 R9/R10/R23）② 死亡跑到伤害前
   *   ③ 使其无效的排到被无效的前面 ④ **就地排序把引擎事件数组打乱**——一条都读不到
   *   （它们四族全是"返回值顺序"这一件事，而那件事根本不需要浏览器）。 */
  const d38i0 = ui.indexOf('const EV_TIER_DEF');
  const d38i1 = ui.indexOf('function logEvents');
  ok(d38i0 >= 0 && d38i1 > d38i0, 'ui.js 里必须能切出"显示顺序"那一段（锚点 `const EV_TIER_DEF` … `function logEvents`；'
    + '切不到 = 这段被搬走或改名，本门要跟着改，不许静默变成读空气）');
  const D38 = new Function(ui.slice(d38i0, d38i1) + '\nreturn { evDisplayRank: evDisplayRank, orderEventsForDisplay: orderEventsForDisplay };')();
  ok(typeof D38.orderEventsForDisplay === 'function' && typeof D38.evDisplayRank === 'function',
    '切出来的两个函数必须可调用（实测 ' + typeof D38.orderEventsForDisplay + ' ‖ ' + typeof D38.evDisplayRank + '）');
  /* 一张**故意把所有规则都踩一遍**的事件表（下标即引擎发射顺序：挡下早于摆出、伤害早于死亡） */
  const L38 = [{ id: 'cancel', type: 'cancel' }, { id: 'blocked', type: 'blocked' }, { id: 'd2', type: 'damage' },
    { id: 'death', type: 'death' }, { id: 'guard', type: 'guardSet' }, { id: 'ep', type: 'ep' },
    { id: 'mirror', type: 'mirror' }, { id: 'd1', type: 'damage' }];
  const order38 = function (arr) { return D38.orderEventsForDisplay(arr).map(function (e) { return e.id; }); };
  const want38 = ['guard', 'blocked', 'ep', 'cancel', 'd2', 'd1', 'death', 'mirror'];
  const before38 = L38.map(function (e) { return e.id; });
  eq(order38(L38).join(','), want38.join(','),
    '显示顺序必须一次满足四条：摆出(guard)先于挡下(blocked) ‖ 被无效(ep)先于使其无效(cancel) ‖ '
    + '伤害(d2,d1 —— 同档还须保持发射顺序)先于死亡(death) ‖ 镜像(mirror)压轴（实测 ' + order38(L38).join(',') + '）');
  eq(L38.map(function (e) { return e.id; }).join(','), before38.join(','),
    '**入参数组必须一个字节都没被改**（排序只许发生在渲染副本上；实测前 ' + before38.join(',') + ' 后 '
    + L38.map(function (e) { return e.id; }).join(',') + '）⇒ 给 `state.events` 排序 = 改引擎事实');
  ok(D38.orderEventsForDisplay(L38) !== L38, '必须返回**新数组**（同对象返回 ⇒ 上面那条"没改入参"是假的）');
  eq(D38.evDisplayRank({ type: 'blocked' })[0], 0, '挡下必须落在防御档（[0,*]，实测 ' + JSON.stringify(D38.evDisplayRank({ type: 'blocked' })) + '）');
  eq(D38.evDisplayRank({ type: 'guardSet' })[1], 0, '摆出在防御档内的 sub=0（实测 ' + JSON.stringify(D38.evDisplayRank({ type: 'guardSet' })) + '）⇒ sub 丢了就是"先果后因"复现');
  eq(D38.evDisplayRank({ type: 'blocked' })[1], 1, '挡下在防御档内的 sub=1（实测 ' + JSON.stringify(D38.evDisplayRank({ type: 'blocked' })) + '）');
  /* ⚠ 稳定序这一条**本机量不到**（μ4 实测：把 `(a.i - b.i)` 从 comparator 里摘掉，`git diff` 确认那一行真改了 -1/+1，
   *   本门**仍绿** ⇒ 因为 V8 的 `Array#sort` 自 ES2019 起规范保证稳定，tiebreaker 是第二道保险而不是那一格的牙）。
   *   所以下面留的那条 `!/list\.sort\(/` 与本腿的"入参逐字节不变"才是这一族的真守门人。 */
  ok(ui.indexOf('for (const e of orderEventsForDisplay(list))') >= 0,
    'logEvents 必须渲染**排序后的副本**（否则上面那一整套顺序规则等于没做；这条是"接线"，行为腿看不见）');
  { const fn = ui.slice(ui.indexOf('function orderEventsForDisplay(list)'), ui.indexOf('function orderEventsForDisplay(list)') + 400);
    ok(!/list\.sort\(/.test(fn), 'orderEventsForDisplay 不许对入参 list 直接 sort（会打乱引擎事件数组）'); }
  /* （§删 · 10-25 夜班 #40：这里原来还有 8 条写法钉 —— `function evDisplayRank\(e\)` /
   *   `function orderEventsForDisplay\(list\)` 两条正则（上面的切片锚点已经替代，且红时消息明写"本门要跟着改"）、
   *   三个档位表存在 ‖ `EV_SUB_VOIDER` 存在 ‖ `list.map(` ‖ `a.i - b.i` ‖ `death` 那行字面 ‖
   *   `EV_TIER_DEF\[e\.type\]\) return \[0, EV_SUB_RESULT…` 那行字面 —— 全部由上面的**返回值**判据接管。
   *   摘腿后变异实测 μ1/μ2/μ3/μ5 见 §E738；μ4 判为"本机量不到"，如实留一条文本钉。） */
  /* ⚑ 10-22（CDP 试点②）+ 10-24 第一批：真页面腿在这里**不加**——`orderEventsForDisplay` 没挂到 window，
   *   而起页面重跑一整套日志渲染与 `tools/smoke.mjs`（12 组合真页面）重叠。行为腿用真源码已足够。 */
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
  /* §删（10-24 千问 · #40 第一批）：这里原来有两条文本钉
   *   `src.indexOf("ev.key === 'Escape' && B.picking") >= 0` ‖ `src.indexOf("$('modal-root').onclick") >= 0 && …`，
   *   下面那条**派真事件的页面行为腿判的是同一件事**（真监听器有没有接上、按下去取不取消），而且它判的是被消费的那个状态，
   *   不是那行字的写法（把 `addEventListener` 折成两行会让文本钉红、页面却好好的 —— 本仓第八批 D111 就是那么改的）。
   *   摘腿后变异自证：摘掉 `ui.js` 那行 Esc 监听 ⇒ 只靠行为腿仍然红（见 `docs/GATE-SHIFTS.md` 本次那条）。 */
  ok(src.indexOf('选择目标（Esc') >= 0, '弹窗开着时提示必须写"选择目标"');
  ok(src.indexOf('你刚才的点击没有生效') >= 0, '结算期间点击必须明确告知（不再静默丢弃）');
  ok(src.indexOf('已放弃【') >= 0, '改主意/误触必须留痕');
  ok(src.indexOf('取消', src.indexOf('label:')) >= 0 || src.indexOf('↩ 取消') >= 0, '弹窗必须提供「取消」按钮');
  ok(src.indexOf('B.aiKey = null; B.picking = null;') >= 0, '新局必须重置待选状态');
  ok(src.indexOf('请出招') >= 0, '回合开始的"请出招"提示必须保留（只改弹窗开着时的提示）');
  /* ⚑ 10-24（#40 第一批 · 千问）：上面那 11 条**全是 `indexOf` 文本钉** —— 把 `cancelPick` 换个名、把那行
   *   `addEventListener` 折成两行，门就红，而"玩家按 Esc 到底取不取消得了"这件事一条都没判到
   *   （本仓判过的同型病：D86/D87 的"逗号 only"、D131 的 CDP 试点 ②）。
   *   这条腿**派真事件**：真页面起一局 ⇒ 造一个待选状态并把遮罩打开 ⇒ 在 document 上派发真 `keydown(Escape)`
   *   ⇒ 读回 `B.picking` 必须被清空、遮罩必须回到 `hidden`；遮罩那一下同理派真 `click`。
   *   主语是 `ui.js:1165/1166` 注册的那两个真监听器（不是去调 `cancelPick` 自己 —— 那是"自己算自己"）。
   *   ⚠ 没有 Chrome ⇒ `Skip`（与 D131 的 CDP 腿同一纪律：环境限制不算页面红）。 */
  const cancelExpr = '(async()=>{const U=window.EpirusUI;if(!U||!U.B)return "NO_UI";U.newGame();'
    + 'const B=U.B;const mr=document.getElementById("modal-root");if(!mr)return "NO_MODAL_ROOT";'
    + 'B.picking={key:"holo",bead:null};mr.classList.remove("hidden");'
    + 'document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));'
    + 'const esc=(B.picking===null)&&mr.classList.contains("hidden");'
    + 'B.picking={key:"holo",bead:null};mr.classList.remove("hidden");'
    + 'mr.dispatchEvent(new MouseEvent("click",{bubbles:true}));'
    + 'const clk=(B.picking===null)&&mr.classList.contains("hidden");'
    + 'return JSON.stringify({esc:esc,click:clk});})()';
  const cp = spawnSync(process.execPath, ['tools/page-chrome.mjs', '--expr=' + cancelExpr], { encoding: 'utf8', timeout: 90000 });
  if (cp.status === 4) throw new Skip('本机没有 Chrome ⇒ 弹窗取消的页面行为腿跳过（环境限制，不是页面红）');
  eq(cp.status, 0, '页面必须能起并派发真事件：' + String(cp.stderr || '').slice(0, 160));
  let cval = null;
  /* `page-chrome` 打的是 `RESULT <JSON of value>`，而表达式返回的是**字符串** ⇒ 解出来还是一层字符串，要再解一次
   *   （实测第一次跑就栽在这儿：读到的是字符串 "{"esc":true,...}"，被下面那条"必须读出对象"当场拦下）。 */
  try { cval = JSON.parse(String((cp.stdout || '').split('RESULT ').slice(-1)[0] || '').trim());
    if (typeof cval === 'string') cval = JSON.parse(cval); } catch (e) { cval = null; }
  ok(cval && typeof cval === 'object' && !cval.error, '页面腿必须读出对象（读到 ' + JSON.stringify(cval) + ' ⇒ 表达式或页面挂了）');
  eq(cval.esc, true, '真页面 + 有待选状态时派真 keydown(Escape) ⇒ 待选必须被清空、遮罩必须回 hidden（实测 ' + JSON.stringify(cval) + '）');
  eq(cval.click, true, '真页面 + 有待选状态时点遮罩本体 ⇒ 同样要取消（实测 ' + JSON.stringify(cval) + '）');
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
  /* §删（10-25 夜班·#40）：这里原来钉 `index.html 必须包含 js/ui/skill-tip.js`。
   *   下面那条真页面腿读的就是**页面自己加载出来的** `window.EpirusSkillTip` ⇒ 脚本没加载时它是 `NO_TIP`/空串，
   *   那条腿直接红（实测：摘掉 index.html 里的 `<script src>` ⇒ 红在"真页面 + 真长程模式，摄魂提示必须写 ≤2"）。
 *   ⇒ 文本钉与行为腿判的是同一件事，摘钉不丢覆盖（改加载方式——比如合并打包——就不再误红）。 */
  /* ⚑ 10-22（CDP 试点 ②）：文本钉只能证明「写了调用 / 加载了脚本」；这条真起页面，
   *   用**页面自己加载的** EpirusSkillTip + 真 EpirusRules.MODES.long 组提示 ⇒ 证明运行时也写 ≤2、且没有 ≤3 残留。 */
  const expr = `(()=>{const R=window.EpirusRules;const T=window.EpirusSkillTip;if(!T||!T.of)return 'NO_TIP';const d=R.skills.find(s=>s.key==='drain');return T.of(R,{mode:R.MODES.long},d)})()`;
  const pr = spawnSync(process.execPath, ['tools/page-chrome.mjs', '--expr=' + expr], { encoding: 'utf8', timeout: 90000 });
  if (pr.status === 4) throw new Skip('本机没有 Chrome ⇒ 卡面提示的页面行为腿跳过（环境限制，不是页面红）');
  eq(pr.status, 0, '页面必须能起并求值 EpirusSkillTip.of：' + String(pr.stderr || '').slice(0, 160));
  ok(/仅限 HP≤2/.test(String(pr.stdout)), '真页面 + 真长程模式，摄魂提示必须写 ≤2（实测 ' + String(pr.stdout).trim().slice(0, 80) + '）');
  ok(!/仅限 HP≤3/.test(String(pr.stdout)), '真页面提示里不许残留上一代的 ≤3');
});

t('D111 前台探索三条规则（v1.5.142 · ②③ 于 09-22 夜升级为序列窗锁）：铺垫卡 ep 门槛 + 链上回合整锁', function () {
  /* 病（docs/research/logs/RESEARCH-LOG-2026-09-21-ds.md §10，DS 实测）：贴贴/蓄能只在 ε>0 时出现（ε=0 ⇒ 0.00/局、
     前台 ε.2 ⇒ 2.7/局），而**天火两档都是 0.00/局** ⇒ 探索只付铺垫成本、结构性地拿不到收尾。
     用户三条裁定 → 落在 `policyChooserN` 的 `epsMode==='soft'` 分支里。本门**行为式**验证。 */
  /* §改（2026-10-22 千问·第八批）：这里原来是一条文字钉 `indexOf("epsMode === 'soft'") >= 0 && indexOf('HOLD_MIN_EP') >= 0`
   *   （钉"规则写在 soft 分支里"这个**形状**）。判据换成问它真正的那件事：**规则只许作用于 soft，
   *   缺省口径必须逐字保持旧行为** ⇒ 见下面"缺省 epsMode 抽 400 手必须还抽得到贴贴"那一段（放在 KEYS/mk 定义之后）。
   *   牙测：把 `js/train/evo.js:838/872` 两处 `if (epsMode === 'soft')` 改成无条件 ⇒ 新腿当场红；
   *   反向（把 soft 分支整个摘掉）⇒ ① 那条 `ep=1 不许抽到贴贴/蓄能` 红 ⇒ 两问各抓一边，比文字钉宽。 */
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
  /* 缺省口径必须**不被这三条规则碰**（替掉原来那条钉 `epsMode === 'soft'` 的字面钉） */
  {
    const selDefault = T.policyChooserN(params, 0.15, 1, 5);   /* 不传 epsMode = 缺省口径 */
    const stD = mk(); stD.p[0].ep = 1;
    const legalD = KEYS.map(function (k) { return { key: k, affordable: true }; });
    const hitD = {};
    for (let i = 0; i < 400; i++) { const r = selDefault(stD, 0, legalD); hitD[r.key] = (hitD[r.key] || 0) + 1; }
    ok((hitD[K.CURSE] || 0) + (hitD[K.CHARGE] || 0) > 0,
      '缺省 `epsMode` 下 ep=1 仍须抽得到铺垫卡（实测贴贴 ' + (hitD[K.CURSE] || 0) + '/400 ‖ 蓄能 ' + (hitD[K.CHARGE] || 0) +
      '/400）⇒ 抽不到就说明这三条规则漏到了缺省口径，训练/评测/门禁的读数会跟着一起变（文字钉判的是形状，这条判的是事实）');
  }
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
  /* §改（2026-10-22 千问·第八批）：这里原来三条 —— 两条"函数体内必须出现 `evText(e, list)` / `evText(e, events)`
   *   这个**逐字串**"，一条"全页面带事件表的调用点恰好 2 处"（绝对计数）。
   *   换成**数实参**：在每个渲染函数的体内找出所有 `evText(` 调用点，括号配对切出实参表，要求每个都是**两个**实参；
   *   并让覆盖面自己报数（"扫到几个调用点"印出来，别把"没扫到"读成"没问题"）。
   *   ⇒ 换变量名（`list` → `turnEvents`）不再误红；而真正的病（少传一个实参 ⇒ 段窗口恒为 undefined、修了等于没修）
   *     反而更抓得住（`evText(e, events.slice(0))` 那种写法旧钉看不见，新判据看）。
   *   绝对计数那条**删**：它判的"没多没少"里，"又开了一条没并进来的渲染路径"这一半由**逐函数**那两问覆盖
   *   （新函数体里少传 ⇒ 那条红；多传 ⇒ 不判，因为它本来就不是要防的事）。 */
  const callArgCounts = function (body, fname) {
    const out = [];
    let i = -1;
    while ((i = body.indexOf(fname + '(', i + 1)) >= 0) {
      let d = 0, cur = '', args = [];
      for (let j = i + fname.length + 1; j < body.length; j++) {
        const c = body.charAt(j);
        if (c === '(' || c === '[' || c === '{') { d++; cur += c; }
        else if (c === ')' || c === ']' || c === '}') { if (d === 0) { args.push(cur); break; } d--; cur += c; }
        else if (c === ',' && d === 0) { args.push(cur); cur = ''; }
        else cur += c;
      }
      out.push(args.filter(function (x) { return x.trim().length > 0; }).length);
    }
    return out;
  };
  for (const fn of ['logEvents', 'pushTranscript']) {
    const body = evBody(fn);
    ok(body !== null, 'D166 接线前提变了：`' + fn + '` 抽不出来了（改名或挪走 ⇒ 这条与它要防的那件事一起失效，别让它默默不跑）');
    const counts = callArgCounts(String(body), 'evText');
    ok(counts.length > 0, 'D166 接线：`' + fn + '` 体内一个 `evText(` 都没扫到 ⇒ 判据看不见这条渲染路径（覆盖面自己报数）');
    ok(counts.every(function (k) { return k === 2; }),
      'D166 接线：`' + fn + '` 里每个 `evText(` 都必须传**两个**实参（事件 + 整回合事件表）⇒ 实测各调用点实参数 ' + JSON.stringify(counts) +
      '；少一个 ⇒ `roundEvents` 恒为 undefined，段窗口退化成整回合（用户看到的那句假话就是这么来的）');
  }
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
  /* ⚑ 10-22 行为腿（CDP 试点）：文本钉只能证明「写了调用」，这条真起页面读 Trainer 的回读值 ——
   *   证明「设成了 2」在运行时成立。工具：`tools/page-chrome.mjs`（cdp-boot + 最小 CDP 客户端）。 */
  const pr = spawnSync(process.execPath, ['tools/page-chrome.mjs', '--expr=window.EpirusTrainer.supportPriorOn()'], { encoding: 'utf8', timeout: 90000 });
  if (pr.status === 4) throw new Skip('本机没有 Chrome ⇒ 页面行为腿跳过（环境限制，不是页面红）');
  eq(pr.status, 0, '页面必须能起并求值 `supportPriorOn()`：' + String(pr.stderr || '').slice(0, 160));
  ok(/RESULT 2/.test(String(pr.stdout)), '真页面里 Trainer 的送盾先验必须**真回读成 2**（实测 ' + String(pr.stdout).trim().slice(0, 80) + '）');
});

}

