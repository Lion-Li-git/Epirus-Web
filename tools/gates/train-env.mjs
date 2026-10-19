/*#np-part-header
{"file":"tools/gates/train-env.mjs","part":"train-env","group":"train","ranges":[[6145,6209],[6222,6222],[8208,8254],[8644,8681],[9238,9264]],"gates":[6145,8208,8644,9238],"patched":[]}
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
export const ords = [6145, 8208, 8644, 9238];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D122 CLI 黑旋钮不许静默（v1.5.155 · DS 裁定；v1.5.159 升级：已下达的键改用**空枪检测**）：train-3p 命中读不到的 EPIRUS_* ⇒ exit 6 + 静态钉住"引擎里字面读 env"的清单', function () {
  /* 病（qoder §N10 审计 + DS 本会话第 5/6 例）：`train-3p` 的 env 面是**闭集**，而 server 侧旋钮走
   * `server/econ-env.mjs`/`fight-env.mjs` 下发（CLI 不 import ⇒ 全黑）；`js/` 里还有**加载时字面读**
   * `process.env` 的键（而 vm 沙箱没有 `process` ⇒ 永远默认）⇒ 从 CLI 传这些键**一律无效却毫无提示**，
   * 会跑出"看起来在调参、其实是默认经济"的臂。用户/DS 裁定：**采纳黑键侦测 + 加静态门**。
   * v1.5.159：`EPIRUS_PASSIVE_FIELD` 已**升级为可下达**（`server/train-env.mjs` + `T.setPassiveField`）
   * ⇒ 它从"死键"移入闭集，本门对它的期待**从 exit 6 改为"必须真到达消费点"**（空枪检测，见 ③）。 */
  const t3 = readFileSync('tools/train-3p.mjs', 'utf8');
  /* v1.5.200：判定已搬进单一来源 `server/knob-guard.mjs`（原先只有 train-3p 一份 IIFE ⇒
   * train-best / train-fast / 页面训练服务全都没有这道闸）。静态钉跟着搬到单一来源，
   * 行为断言（下面 ①②③）**一个字没改** —— 门守的是行为，不是实现放在哪个文件。 */
  const kgSrc = readFileSync('server/knob-guard.mjs', 'utf8');
  /* 为什么这几条**源码正则腿**能留（T1 分诊 train-env · 千问 10-17）：判据是"删掉被钉那行，行为会不会变"。
   *   `SELF_ENV_KEYS` / `enforceKnobs(` / `knob-guard.mjs` 三处是**接线本身** —— 删掉调用，暗键就回到"传了等于没传"的静默档，
   *   行为真的变（而且正是这条门存在的理由）。所以它不是钉措辞，是钉"这个入口有没有接上那道闸"。
   *   ⚠ 同一条门里下面的 exit 6 / ALLOW_DARK 放行两条是**行为腿**，两半各管一件事：正则腿防"换了个入口忘了接"，行为腿防"接了但没生效"。 */
  ok(t3.indexOf('SELF_ENV_KEYS') >= 0 && t3.indexOf('enforceKnobs(') >= 0 && t3.indexOf('knob-guard.mjs') >= 0,
    'train-3p 必须走单一来源的黑键闸（enforceKnobs + 自己的闭集 SELF_ENV_KEYS）');
  /* v1.7.74 · gate-sentinel ③ 分诊：摘掉中间那句中文（`CLI 黑键`）—— 它只是那两个**标识符**之间的措辞；
   *   要保的是「`detectDarkKnobs` 与 `EPIRUS_ALLOW_DARK` 这条链路在源码里接上了」。 */
  ok(kgSrc.indexOf('detectDarkKnobs') >= 0 && kgSrc.indexOf('EPIRUS_ALLOW_DARK') >= 0,
    '单一来源里必须响亮说明白 + 留逃逸口');
  /* ① 行为：**仍未下达**的暗键 ⇒ exit 6（用 fight 族键：CLI 至今不 import 它 ⇒ 传它本就无效） */
  const dark = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_FIGHT_WHISTLE: '0.34' }), encoding: 'utf8', timeout: 120000 });
  ok(dark.status === 6, '暗键必须 exit 6（实测 exit=' + dark.status + '）');
  /* ② 行为：逃逸口放行（1 代迷你臂，写临时目录 ⇒ 不欠 D82） */
  const dir2 = mkdtempSync(join(tmpdir(), 'darkok-'));
  const okRun = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_FIGHT_WHISTLE: '0.34', EPIRUS_ALLOW_DARK: '1', EPIRUS_BAND_DIR: dir2, EPIRUS_T3P_OUT: dir2 + '/env-out.js', EPIRUS_ARM: 'nptest-dark' }), encoding: 'utf8', timeout: 300000 });
  ok(okRun.status === 0, 'EPIRUS_ALLOW_DARK=1 必须放行（实测 exit=' + okRun.status + '）');
  /* ③a 行为（v1.5.163）：**已删除的键也必须响亮** —— 传 `EPIRUS_PASSIVE_FIELD` ⇒ exit 6 + 说明删于哪一版。
   * 静默忽略等于把"传了等于没传"换个形态留下（它就是白跑两臂的那个病）。 */
  const goneRun = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '2', '2'],
    { env: Object.assign({}, process.env, { EPIRUS_PASSIVE_FIELD: '0.34' }), encoding: 'utf8', timeout: 120000 });
  eq(goneRun.status, 6, '已删除的键必须 exit 6（实测 exit=' + String(goneRun.status) + '）');
  ok(/已被删除/.test(String(goneRun.stderr || '')), '必须说清"已被删除 + 删于哪一版 + 用什么替代"');
  /* ③b 行为（v1.5.163 取代旧"横幅读回"式空枪检测）：**活键必须改到评估分布本身** ——
   * 判据是跑完打印的 `开火计数` 与它覆盖的受评座位数，不是"消费点读回 X"（§N11 的教训：读回 = 变量到位 ≠ 效果发生）。 */
  const dir3 = mkdtempSync(join(tmpdir(), 'knobok-'));
  const knobRun = spawnSync(process.execPath, ['tools/train-3p.mjs', '1', '3', '8', '4'],
    { env: Object.assign({}, process.env, { EPIRUS_KILL_FIELD: '0.2', EPIRUS_SEED: '7', EPIRUS_BAND_DIR: dir3, EPIRUS_T3P_OUT: dir3 + '/env-out.js', EPIRUS_ARM: 'nptest-knob' }), encoding: 'utf8', timeout: 300000 });
  ok(knobRun.status === 0, 'EPIRUS_KILL_FIELD 下达 ⇒ 不许 exit 5/6/7/8（实测 exit=' + String(knobRun.status) + '）');
  const fired = /开火计数：注入 (\d+) 局 · 覆盖受评座位 (\d+) 个/.exec(String(knobRun.stdout || ''));
  ok(fired, '必须打印开火计数（没有它 = 回到"横幅自证"）');
  ok(fired && Number(fired[1]) > 0, '真注到局才算下达（实测 ' + (fired ? fired[1] : '无') + ' 局）');
  ok(fired && Number(fired[2]) >= 2, '注入必须覆盖 >=2 个受评座位（座位偏置 = 用户 09-22 裁掉的对象）');
  /* ④ 静态：引擎里"字面读 process.env"的清单（新增一处 ⇒ 红；修掉一处 ⇒ 也要来改这份清单）
   * v1.5.163：清单**清空** —— `EPIRUS_PASSIVE_FIELD` 是最后一个字面死读，随整族删除一起退场。
   * 从此往 `js/` 里加任何 `process.env.EPIRUS_*` 都会立刻红 ⇒ 必须走宿主 setter（或显式登记为死键）。 */
  const DEAD_LITERAL = {};
  const found = {};
  const walk = function (d) {
    for (const nm of readdirSync(d)) {
      const p = d + '/' + nm;
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.js$/.test(nm)) continue;
      const ks = (readFileSync(p, 'utf8').match(/process\.env\.EPIRUS_[A-Z0-9_]+/g) || [])
        .map(function (s) { return s.replace('process.env.', ''); });
      if (ks.length) found[p.replace(/\\/g, '/')] = Array.from(new Set(ks)).sort();
    }
  };
  walk('js');
  ok(JSON.stringify(Object.keys(found).sort()) === JSON.stringify(Object.keys(DEAD_LITERAL).sort()),
    'js/ 里字面读 env 的文件清单必须与声明一致（新增一处就得来处理：走宿主 setter 或显式登记为死键）\n      实测 ' +
    JSON.stringify(found) + '\n      声明 ' + JSON.stringify(DEAD_LITERAL));
  for (const f of Object.keys(DEAD_LITERAL)) {
    ok(JSON.stringify(found[f]) === JSON.stringify(DEAD_LITERAL[f].slice().sort()), f + ' 的字面读键必须与声明一致');
  }
});


t('D143 黑键闸必须铺到**每个**训练入口（v1.5.200）：`EPIRUS_KILL_REWARD` 传给 train-best / 页面训练服务时曾是**静默无效**（产物与不带它逐字节相同）', function () {
  /* 病（本轮实测，不是推演）：`EPIRUS_KILL_REWARD` 全仓只在 tools/train-3p.mjs 被读。
   *   KR=1 与 KR=0 在 train-best 上跑出的 pack sha1 相同（c67521d82ff32d2a），去掉 ts 后两个产物
   *   文件逐字节相同；页面「训练场」的 server 路径同理（ad5baadcd32aaec8）。本仓为"传了没人读"
   *   这一族栽过至少 9 次 ⇒ 判定抽成单一来源之后，必须**每个入口都挂上**，而且要在握手/训练之前。 */
  const SRC = 'server/knob-guard.mjs';
  ok(existsSync(SRC), '判定必须是单一来源 ' + SRC);
  const kg = readFileSync(SRC, 'utf8');
  ok(kg.indexOf('detectDarkKnobs') >= 0 && kg.indexOf('enforceKnobs') >= 0, '单一来源必须导出 detectDarkKnobs / enforceKnobs');
  const ENTRIES = ['tools/train-3p.mjs', 'tools/train-best.mjs', 'tools/train-fast.mjs', 'server/train-server.mjs'];
  for (const e of ENTRIES) {
    const src = readFileSync(e, 'utf8');
    /* 留（T1 train-env）：这条是**逐入口的接线检查** —— 少接一个入口，那个入口就把旋钮当暗键静默吞掉（`EPIRUS_KILL_REWARD`
     *   当年在 train-best / 页面训练服务上就是"传了等于没传"，产物与不带它逐字节相同）。删掉这行 ⇒ 行为真的变 ⇒ 措辞不算主语。 */
    ok(src.indexOf('knob-guard.mjs') >= 0 && src.indexOf('enforceKnobs(') >= 0,
      e + ' 必须挂 enforceKnobs —— 否则它继续静默忽略自己读不到的键（整臂可能跑成 A/A）');
  }
  /* ① 纯口径：名单模块（*-env.mjs）不许靠 import 自动继承读权（否则"只 import 名单来点名"被当成真读 ⇒ 假阴性）。
   * 第一版就是这么错的：FIGHT_WHISTLE 传 train-3p 从 exit 6 变成静默通过，被 D122 当场抓住。 */
  const wr = readKeysOf({ entry: 'tools/train-3p.mjs' });
  ok(!wr.read.has('EPIRUS_FIGHT_WHISTLE'),
    'train-3p 只 import 了 FIGHT_ENV_KEYS（点名）、没读它的值 ⇒ 不许算"读得到"');
  eq(detectDarkKnobs({ EPIRUS_KILL_REWARD: '1' }, { entry: 'tools/train-best.mjs' }).dark.join(','), 'EPIRUS_KILL_REWARD',
    'train-best 读不到的 KILL_REWARD 必须被列为暗键');
  eq(detectDarkKnobs({ EPIRUS_KILL_REWARD: '1' }, { entry: 'tools/train-3p.mjs' }).dark.length, 0,
    'train-3p 真读它 ⇒ 不许误报（误报会让迷你臂无故 exit 6）');
  eq(detectDarkKnobs({ EPIRUS_TB3P: '1', EPIRUS_CHARGE_GAMES: '8' }, { entry: 'tools/train-best.mjs' }).dark.length, 0,
    'train-best 经 audit-lib 的 feasPlan 真读 EPIRUS_CHARGE_GAMES ⇒ 闭包要跟到 reader 那一层，不许误报');
  /* ② 行为：用户报的那个病 —— 传 KILL_REWARD 给 train-best 必须响亮 */
  const d1 = spawnSync(process.execPath, ['tools/train-best.mjs', '1', '1'],
    { env: Object.assign({}, process.env, { EPIRUS_KILL_REWARD: '1' }), encoding: 'utf8', timeout: 120000 });
  eq(d1.status, 6, 'KILL_REWARD 传给 train-best 必须 exit 6（实测 ' + d1.status + '）');
  ok(/EPIRUS_KILL_REWARD/.test(String(d1.stderr || '')), '拒绝时必须点名是哪个键');
  const d2 = spawnSync(process.execPath, ['tools/train-fast.mjs', '1'],
    { env: Object.assign({}, process.env, { EPIRUS_COUNTER_OPPS: '1' }), encoding: 'utf8', timeout: 120000 });
  eq(d2.status, 6, 'COUNTER_OPPS 传给 train-fast 必须 exit 6（实测 ' + d2.status + '）');
  /* 页面训练服务是长驻进程 —— 静默起来最难发现 ⇒ 必须在**起监听之前**就拒绝 */
  const d3 = spawnSync(process.execPath, ['server/train-server.mjs', '8799'],
    { env: Object.assign({}, process.env, { EPIRUS_KILL_REWARD: '1' }), encoding: 'utf8', timeout: 90000 });
  eq(d3.status, 6, 'KILL_REWARD 传给页面训练服务必须 exit 6（实测 ' + d3.status + '）');
  ok(!/Epirus train server on/.test(String(d3.stdout || '')), '拒绝时不许已经起监听');
  /* ③ 行为：逃逸口仍放行（1 代迷你臂 + 临时落点 ⇒ 不欠 D82） */
  const dirE = mkdtempSync(join(tmpdir(), 'knobesc-'));
  const d4 = spawnSync(process.execPath, ['tools/train-best.mjs', '1', '1'],
    { env: Object.assign({}, process.env, { EPIRUS_KILL_REWARD: '1', EPIRUS_ALLOW_DARK: '1',
      EPIRUS_TB_OUT: join(dirE, 'out.js'), EPIRUS_ARM: 'nptest-esc' }), encoding: 'utf8', timeout: 300000 });
  ok(d4.status === 0 || d4.status === 9, 'EPIRUS_ALLOW_DARK=1 必须放行（实测 exit=' + d4.status + '）');
});

t('D167 econ 族 5 键必须能在 CLI **真下达并读回消费点**（用户 GO · 千问 §E59 NEXT 6）：开档臂不许 exit 6、同族没接线的键必须仍是 6', function () {
  /* 病：`beadW/bigcardW/stockBonus/hoardOnLeftover/convRatio` 只走 server/worker，
   *   `train-3p` 不 dispatch ⇒ CLI 传进去**静默 exit 6**（治闭环"花"那一半时卡在这里）。
   * 判"真接上了"用**行为式**两条一起（METHODOLOGY 73 的变异测试同族）：
   *   ①开档臂必须跑通并印**读回**；②同族但没接线的键必须仍 `exit 6`（证明守卫没被自己关掉）。 */
  const src = readFileSync('tools/train-3p.mjs', 'utf8');
  for (const k of ['beadW', 'bigcardW', 'stockBonus', 'hoardOnLeftover', 'convRatio']) {
    ok(src.indexOf("'" + k + "'") >= 0, 'CLI 白名单 `CLI_ECON_REWARD_KEYS` 必须含 ' + k);
  }
  const econ = readFileSync('server/econ-env.mjs', 'utf8');
  ok(econ.indexOf("'EPIRUS_BEAD_W'") >= 0,
    '`ECON_ENV_KEYS` 必须含 `EPIRUS_BEAD_W`（v1.5.254 之前**漏在名单外**：`readEconEnv` 一直在读它 ⇒ 名单是"本族覆盖了哪些 env"的单一来源，漏名 = 任何按名单派生的入口都把它当暗键）');
  /* §删（千问 10-17 通宵班 · T1 分诊 train-env 部分）：这里原来还有一条
   *   `ok(/for \(const v of \[0\.5, '1'\]\)/.test(src), '派生探针必须一试两档…')` —— 钉的是 `train-3p.mjs:140` 那一行的**写法**。
   *   按 DS 的判据（"删掉那行代码，行为会不会变"）它属于 B 族：把那两档改成任何等价的写法（常量表 / 两次调用）行为不变而门会红。
   *   ⚠ 摘它之前先做过一次"先摘腿再变异"的实验（不是"看着像冗余就摘"）：把 `train-3p.mjs:140` 改成只试 `0.5`，
   *     带着这条正则腿跑 ⇒ 红在**这条措辞腿**上（前面的腿红会短路后面的行为腿，所以那一次**不能**证明行为腿抓不住）；
   *     摘掉之后再跑同一个变异 ⇒ 红在下面 `EPIRUS_CONV_RATIO=1` 那两条行为腿上 ⇒ 覆盖没丢，只是把主语从"源码怎么写"换回"行为是什么"。 */

  const dir = mkdtempSync(join(tmpdir(), 'd167-'));
  const runArm = (name, extra) => spawnSync(process.execPath, ['tools/train-3p.mjs', '1'], {
    encoding: 'utf8', timeout: 240000,
    env: Object.assign({}, process.env, { EPIRUS_ARM: name, EPIRUS_T3P_OUT: dir + '/' + name + '.js', EPIRUS_BAND_DIR: dir + '/band' }, extra || {})
  });
  try {
    const rU = runArm('d167u');
    ok(!/econ 旋钮已下达/.test(String(rU.stdout)), '不设 ⇒ 一行都不许印（"开了但没生效"与"没开"要看得见差别）');
    const rB = runArm('d167b', { EPIRUS_BEAD_W: '0.4' });
    eq(rB.status, 0, '`EPIRUS_BEAD_W=0.4` 必须成功（不许再 `exit 6`）：' + String(rB.stderr || '').slice(0, 90));
    ok(/econ 旋钮已下达并读回消费点：beadW=0\.4/.test(String(rB.stdout)), '`beadW` 必须印**消费点读回**值');
    const rC = runArm('d167c', { EPIRUS_CONV_RATIO: '1' });
    eq(rC.status, 0, '`EPIRUS_CONV_RATIO=1` 必须成功：' + String(rC.stderr || '').slice(0, 90));
    ok(/convRatio=true/.test(String(rC.stdout)), '布尔档必须按**真值**读回（印 true，不是 1）');
    const rBad = runArm('d167bad', { EPIRUS_BEAD_W: 'abc' });
    eq(rBad.status, 7, '非数值必须 `exit 7`（读回不相等就算被拒），实际 ' + rBad.status);
    const rDark = runArm('d167dark', { EPIRUS_S4_W: '0.4' });
    eq(rDark.status, 6, '同族但**没接线的键**（`EPIRUS_S4_W`）必须仍 `exit 6` ⇒ 守卫是活的，上面"开档臂跑通"才真是"接上了"');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  }
});

t('D181 `EPIRUS_RING_W` 在 train-3p 可命令（v1.5.274 · §E91）：三处名单齐 + 边界必须可见', function () {
  const T3 = readFileSync('tools/train-3p.mjs', 'utf8'), E = readFileSync('server/econ-env.mjs', 'utf8');
  /* 留（T1 train-env）：这里读源码读的是**名单成员**（`CLI_ECON_REWARD_KEYS` 里有没有 `ringW`），不是散文措辞 ——
   *   少一个名字就是"设了没人读"的那一类静默半开（D206 从"三处名单自洽"的角度管同一件事，两条主语不同：
   *   D206 判"名单之间一致"，这条判"这个键在投递名单里 + 边界必须出声"）。改名单写法（换行/加注释）不会误红。 */
  const cli = ((T3.match(/CLI_ECON_REWARD_KEYS = \[([\s\S]*?)\]/) || ['', ''])[1].match(/'([^']+)'/g) || [])
    .map(function (q) { return q.replace(/'/g, ''); });
  ok(cli.indexOf('ringW') >= 0, '① 投递名单必须有 `ringW`（这次缺的就是这一处）');
  const envK = ((E.match(/ECON_ENV_KEYS = \[([\s\S]*?)\]/) || ['', ''])[1].match(/'([^']+)'/g) || [])
    .map(function (q) { return q.replace(/'/g, ''); });
  ok(envK.indexOf('ringW') >= 0 || /EPIRUS_RING_W/.test(E), '① env 单一名名单里也得有它（两处缺一处就是"设了没人读"）');
  const d = mkdtempSync(join(tmpdir(), 'd181-'));
  const r = spawnSync(process.execPath, ['tools/train-3p.mjs', '2', '3', '2', '2'], {
    encoding: 'utf8', timeout: 420000,
    env: Object.assign({}, process.env, {
      EPIRUS_ARM: 'D181', EPIRUS_SEED: '9', EPIRUS_HOTSTART: '1', EPIRUS_RING_W: '0',
      EPIRUS_BAND_DIR: d + '/bands', EPIRUS_T3P_OUT: d + '/out.js'
    })
  });
  eq(r.status, 0, '② 下达 `EPIRUS_RING_W=0` 必须能跑起来（实测补名单前是 exit 6 的黑键拒绝）：' + String(r.stderr || '').slice(0, 160));
  ok(/ringW/.test(String(r.stdout)) && /逐键回执一致/.test(String(r.stdout)),
    '② 必须打印"投递 + 回执一致"（静默生效 = 下次又查不到）');
});


/* ===== D180（qoder 09-28 §E85）：econ 回执比对必须按**数值语义**比，但闸门本身不许被放宽 =====
 * 实测事故：`EPIRUS_BEAD_W=0.10` 被 `String('0.10') !== String(0.1)` 判成"下达没生效"⇒ **整臂 exit 7、一行的量都没跑**。
 * 这类"把合法输入拒了"和"把没生效的放过去"一样糟 ⇒ 三条一起钉：小数写法能过（修好了）·
 * **引擎拒收的值仍必须红**（`-5` 过不了 `setBeadReward` 的 `>=0` ⇒ 回执还是 0.05 ⇒ 必须 exit 7）·
 * 名字写错仍必须响（黑键闸没被吃掉）。后两条是防"为了修第一条把闸门拆了"。 */
}

