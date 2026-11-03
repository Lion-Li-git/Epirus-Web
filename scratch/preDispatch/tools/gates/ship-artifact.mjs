/*#np-part-header
{"file":"tools/gates/ship-artifact.mjs","part":"ship-artifact","group":"ship","ranges":[[9995,10068]],"gates":[9995],"patched":[]}
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
export const ords = [9995];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D197 §E136 的换包开关默认必须是关的（v1.5.292）：不写 --swap 逐位不变、写了必须真生效、含糊写法要拒绝', function () {
  /* 为什么钉这道：§E136 往**产品口径的量具**（eval-5p）里加了一条"第 R 回合换权重"的分支。
   * 这条一旦悄悄生效，历史上所有 eval-5p 读数就换了尺 —— 所以门的重点是"默认关"而不是"能用"：
   *   ① 用同一个场跑 三臂：不换 / 换包点写在终局之后 / 换包点写在第 1 回合。
   *      **第一臂与第二臂必须逐字相同（只有标签不同），第三臂必须不同** ⇒ 一正一负，"没生效"和"总在生效"都跑不掉。
   *   ② 含糊的写法（没有 @、第 0 回合、路径不存在、和第二粒包与主包同一个、抢主体席的组合）必须 exit 2，
   *     不许降级成"当没写"。 */
  const A = 'docs/artifacts/kept/e78-out__G08-71.bak';
  const B = 'docs/artifacts/eval-out/win-Ldemo.bak';
  ok(existsSync(A) && existsSync(B), '⓪ 两粒入库包必须在（门要用它们做"换包 vs 不换包"的对照）：A=' +
    existsSync(A) + ' B=' + existsSync(B));
  const run = function (extra) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '4', '5', '77000', A, '--field=mix4'].concat(extra),
      { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  };
  const base = run([]);
  const far = run(['--swap=' + B + '@9999']);
  const early = run(['--swap=' + B + '@1']);
  ok(base.code === 0 && far.code === 0 && early.code === 0, '① 三臂都要跑得完（实测 ' + base.code + '/' + far.code + '/' + early.code + '）');
  const rate = function (o) { const m = o.match(/\[[^\]]*\] 1st=([0-9.]+)% 严胜=([0-9.]+)%/); return m ? m[1] + '/' + m[2] : null; };
  /* `耗时 0.1s` 那行本来就随机器抖动 ⇒ 先抹掉它，再要求"其余逐字相同"。
   * ⚠ 这里**不能只比 1st 那一行**：换包分支若泄漏，最先变的可能是回合数/经济行为，只看胜率会放过它。 */
  const norm = function (o) { return String(o).replace(/冠军→第 \d+ 回合换 [A-Za-z0-9_.\-]+/g, '冠军').replace(/耗时 [0-9.]+s/g, '耗时 抹掉'); };
  const firstDiff = function (a, b) {
    const la = a.split('\n'), lb = b.split('\n');
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      if (la[i] !== lb[i]) return '第 ' + (i + 1) + ' 行 [' + String(la[i] || '').slice(0, 66) + '] vs [' + String(lb[i] || '').slice(0, 66) + ']';
    }
    return null;
  };
  const fd = norm(far.out) === norm(base.out) ? null : firstDiff(norm(far.out), norm(base.out));
  ok(fd === null,
    '② **不带 --swap 与"换包点在终局之后"必须逐字相同**（实测差异：' + (fd || '') + '）⇒ 产品口径的量具不许多一条会悄悄生效的分支');
  ok(rate(base.out) != null && rate(early.out) != null && norm(early.out) !== norm(base.out),
    '②′ 反过来：换包点写在第 1 回合时读数**必须变**（不换=' + rate(base.out) + ' ‖ 第1回合换=' + rate(early.out) +
    '，输出差异=' + (norm(early.out) === norm(base.out) ? '无' : '有') + '）⇒ 两臂相同就意味着这条分支是死代码');
  /* ③ 拒绝口径：每一类含糊写法都要 exit 2，不许"当没写"继续出读数 */
  const bad = [
    ['--swap=' + B, '没有 @'],
    ['--swap=' + B + '@0', '第 0 回合'],
    ['--swap=' + B + '@2.5', '非整数回合'],
    ['--swap=nope-not-here.bak@5', '路径不存在'],
    ['--swap=' + A + '@5', '第二粒包与主包同一个文件'],
    ['--swap=' + B + '@5', '与 --subject 同时给（抢主体席）', '--subject=aggro'],
  ];
  for (const c of bad) {
    const argv = ['tools/eval-5p.mjs', '1', '5', '77000', A].concat([c[0]]).concat(c.slice(2));
    const r = spawnSync(process.execPath, argv, { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    ok(r.status === 2, '③ ' + c[1] + ' ⇒ 必须 exit 2 拒绝（实测 exit=' + r.status + '，' + String(r.stderr || '').slice(0, 40).replace(/\n/g, ' ') + '）');
  }
  /* ④ 接线：默认那条主体分支必须走 subjectPolicy()（否则上面的"逐字相同"只是没接上） */
  const src = readFileSync('tools/eval-5p.mjs', 'utf8');
  ok(/:\s*function \(\) \{ return subjectPolicy\(\); \}\)/.test(src),
    '④ 主体席的默认分支必须调 `subjectPolicy()`（写死 `T.policyChooserN(params, 0.15)` 就等于把开关焊死在半开）');
  ok(/function subjectPolicy\(\)[\s\S]{0,320}state\.round >= SWAP_ROUND \? b : a/.test(src),
    '④ `subjectPolicy` 必须按 `state.round >= SWAP_ROUND` 选 a/b（换成别的判据就不是"按阶段换打法"了）');
  ok(!/FLAG\.field\s*\)\s*\{[\s\S]{0,120}--swap 只能单独用/.test(src),
    '④ `--field` 不许进"与 --swap 互斥"的名单：它只换对手场、不抢主体席，而它是唯一能把一臂压到"1 组 × 几局"的便宜口径（本门就靠它）');
  /* ⑤ --every 采样：默认必须逐位不变，采样后组合数要按 ceil(N/step) 掉、且非法值要拒 */
  const d1 = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000'], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const d2 = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--every=1'], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const d5 = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--every=5'], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
  const nOf = function (o) { const m = String(o).match(/全部 (\d+) 组合/); return m ? Number(m[1]) : null; };
  const n1 = nOf(d1.stdout), n5 = nOf(d5.stdout);
  ok(norm(d2.stdout) === norm(d1.stdout), '⑤ `--every=1` 与不写必须**逐字相同**（默认口径不许被采样代码动过；实测差异：' +
    (norm(d2.stdout) === norm(d1.stdout) ? '' : firstDiff(norm(d2.stdout), norm(d1.stdout))) + '）');
  ok(n1 === 35 && n5 === 7, '⑤ core 池 C(7,4)=35 组 ⇒ `--every=5` 要剩 ceil(35/5)=7 组（实测 默认=' + n1 + ' ‖ every=5 → ' + n5 + '）');
  for (const v of ['0', '2.5', 'abc', '-3']) {
    const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', '1', '5', '77000', '--every=' + v], { cwd: process.cwd(), encoding: 'utf8', timeout: 600000 });
    ok(r.status === 2, '⑤ --every=' + v + ' ⇒ 必须 exit 2（实测 exit=' + r.status + '）');
  }
});

}

