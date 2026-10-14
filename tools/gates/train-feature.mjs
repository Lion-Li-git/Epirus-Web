/*#np-part-header
{"file":"tools/gates/train-feature.mjs","part":"train-feature","group":"train","ranges":[[2854,2919],[4209,4227],[4491,4539],[5715,5744]],"gates":[2854,4209,4491,5715],"patched":[]}
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
export const ords = [2854, 4209, 4491, 5715];
/* ⚠ 本文件**不执行**任何门：只把 [[原始行号, 门名, 门函数]] 交给 runner 的 t()。 */
export function register(t) {
t('D58 L7 第七处：候选枚举顺序必须无身份（镜像对称 + 5 席不得某座通吃）', function () {
  /* v1.5.66：`candidatesFor` 按 `opponentsOf` 升序枚举目标，而 argmax **并列取第一个下标**
   * ⇒ 网络对目标"无所谓"时实际退化成"打最小 pid" ⇒ 那是一条偏置规则（镜像实验：打最小索引 ⇒ P4 通吃；
   * 打最大索引 ⇒ P0 通吃，而引擎本身镜像对称）。v7 候选口径让**新训的冠军**都暴露在这条通道上；
   * v6 老种子走旧口径（键 + pickTargetN）不经过枚举，所以它均衡。 */
  const pol = readFileSync('js/train/policy.js', 'utf8');
  ok(pol.indexOf('function poolOrder') >= 0, 'policy.js 必须有 poolOrder（按每局盐洗牌目标枚举顺序）');
  ok(pol.indexOf('poolOrder(state, pid, S.opponentsOf') >= 0, '枚举处必须走 poolOrder');
  /* §删（2026-10-11 分诊·千问复核 A/B）：原腿只钉源码文本或打印文案（恒真式 / 数函数名出现次数）⇒ 违反规矩 1，整条删掉
   *   （不留「恒真式 + 原文案」那种"看着有覆盖"的假象 —— 它照样印一行 ✔，但底下什么都不测）。
   *   终态见 `docs/GATE-SHIFTS.md` §十：哪几条已换成行为级腿、哪几条判为**接受损失**，只在那一处记账，不在门体里复制 13 遍。 */
  /* ① 镜像对称（引擎层，最强形式）：脚本"打最小索引"与"打最大索引"必须给出镜像结果 */
  const ATK = [R.SK.GUN, R.SK.SWORD, R.SK.SNIPE, R.SK.TANK, R.SK.RAILGUN, R.SK.DRAIN];
  const mk = function (pick) {
    return function (state, pid, legal) {
      const a = legal.filter(function (x) { return x.affordable && ATK.indexOf(x.key) >= 0; });
      if (!a.length) return { key: R.SK.JI };
      const o = S.opponentsOf(state, pid);
      return { key: a[0].key, target: pick(o) };
    };
  };
  const run = function (fn, G) {
    const win = [0, 0, 0, 0, 0];
    for (let g = 0; g < G; g++) {
      const st = S.createState('multi', { next: T.mulberry32(12000 + g) }, 5);
      st.slotSalt = ((Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0);
      Play.autoGameN(st, [fn, fn, fn, fn, fn]);
      if (st.winner !== 'draw' && st.winner != null) win[st.winner]++;
    }
    return win;
  };
  const lo = run(mk(function (o) { return o[0]; }), 10);
  const hi = run(mk(function (o) { return o[o.length - 1]; }), 10);
  eq(lo[4], 10, '脚本"打最小索引"必须让最高 pid 通吃（实测 ' + lo.join('/') + '）');
  eq(hi[0], 10, '镜像规则"打最大索引"必须让最低 pid 通吃（实测 ' + hi.join('/') + '）⇒ 引擎镜像对称');
  /* ② 5 席同一策略：不得某座通吃（修前实测 v13-106 是 60/60 全给 0 号座）。
   * 用**仓库内的线上包**（它经过候选枚举 ⇒ 正对着这条通道）；未训练策略几乎不出手、样本不足。
   * 包在训练中会被临时改写（D16 已有该守卫）⇒ 这里读不到就跳过而不是误报。 */
  let liveParams = null;
  try {
    const liveSrc = readFileSync('js/bundled-champion-3p.js', 'utf8');
    const lm = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(liveSrc);
    if (lm) liveParams = Pol.unpack(JSON.parse(lm[1]), true);
  } catch (e) { liveParams = null; }
  if (!liveParams) {
    /* v1.5.201（门层审计 D58/D59）：**不可判必须红** —— 静默跳过等于把这条测量关掉，
     * 而汇总仍显示全绿（"190/190"里完全看不见）。它守的正是"5 席通吃"这个产品级退化。 */
    ok(false, '线上多人包必须可读（不可判 = 红，不允许静默跳过）：' +
      (existsSync('js/bundled-champion-3p.js') ? '文件在但解析失败' : '文件不存在') +
      ' —— 训练进行中请先停训练再跑门禁');
  } else {
    const win2 = [0, 0, 0, 0, 0];
    let dec = 0;
    for (let g = 0; g < 60; g++) {
      const st = S.createState('multi', { next: T.mulberry32(12000 + g) }, 5);
      st.slotSalt = ((Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0);
      const base = T.policyChooserN(liveParams, 0.15);
      Play.autoGameN(st, [base, base, base, base, base]);
      if (st.winner !== 'draw' && st.winner != null) { win2[st.winner]++; dec++; }
    }
    ok(dec >= 20, '必须有足够多分出胜负的局（实测 ' + dec + '/60）');
    ok(Math.max.apply(null, win2) <= Math.round(dec * 0.55),
      '5 席同一策略时不得某座通吃（最高座 ' + Math.max.apply(null, win2) + '/' + dec + '：' + win2.join('/') + '）');
  }
});

t('D45 全息屏障候选**不得含幻影"自己"**（这张卡本来就不能给自己）', function () {
  /* 复核 §2-1：`holoShieldFrom` 明写"自己给自己套不算"，而 `targetOf()` 会把 null/自己
   * 在声明阶段退成"第一个存活对手" ⇒ 候选里的"自己"是幻影：策略以为在做 A，引擎执行的是送盾给 1 号
   * （实测被选中 35/330 次，每次都给训练喂错误归因）。修法=只给真实对手。 */
  const pol = readFileSync('js/train/policy.js', 'utf8');
  ok(pol.indexOf("def.target === 'other'") >= 0, 'candidatesFor 必须有 target:other 分支');
  /* v1.5.201（审计 D45）：原来这两条钉的是**注释文本**（policy.js 的「幻影选项」、resolve.js 的「自己给自己套不算」）
   * —— 注释一改就红，而它描述的 bug 完全可以在注释仍在的情况下复活。改成**行为断言**：直接枚举候选。
   * 判据 = 候选里不许出现 target==null（引擎会把 null 退成"第一个存活对手" ⇒ 送盾给别人却按"给自己"归因）。 */
  const st45 = S.createState('multi', { next: function () { return 0.5; } }, 5);
  const holo45 = Pol.candidatesFor(st45, 0, [{ key: R.SK.HOLO }]);
  eq(holo45.length, S.opponentsOf(st45, 0).length, '全息屏障候选数必须等于存活对手数（一人一个真实对手）');
  eq(holo45.filter(function (x) { return x.target == null; }).length, 0,
    '全息屏障候选里**不许有自己的幻影选项**（target=null ⇒ 引擎退成「第一个存活对手」，归因全错）');
  const res = readFileSync('js/core/resolve.js', 'utf8');
  ok(res.indexOf('const hDecl = targetOf') < 0, 'v1.5.34 那个"无目标=自己"的特例必须已撤销');
});


t('D65 候选表过滤买不起 + 两级采样抹平槽位放大（v1.5.74 F1/F2）', function () {
  const st = S.createState('multi', { next: mulberry32(6501) }, 5);
  /* ① F1：显式 affordable:false 必须被排除（字段真源 = play.js:17/21） */
  const legal = [
    { key: R.SK.JI, affordable: true },
    { key: R.SK.CHARGE, affordable: false },
    { key: R.SK.GUN, affordable: true },
    { key: R.SK.GUARD, affordable: false }
  ];
  const c1 = Pol.candidatesFor(st, 0, legal, {});
  ok(c1.every(function (c) { return c.key !== R.SK.CHARGE && c.key !== R.SK.GUARD; }),
    '买不起的招不得进候选表（实测 [' + c1.map(function (c) { return c.key; }).join(',') + ']）');
  ok(c1.some(function (c) { return c.key === R.SK.GUN; }), '买得起的招必须仍在表里');
  const c2 = Pol.candidatesFor(st, 0, legal, { allowUnaffordable: true });
  ok(c2.some(function (c) { return c.key === R.SK.CHARGE; }), '逃生口 allowUnaffordable 必须能放回它们（评测脚本用）');
  /* ② 只过滤**显式 false**：页面/工具/夹具自造的 legal 通常不带该字段，过滤会把表清空 ⇒ 冠军只出ジ */
  const c3 = Pol.candidatesFor(st, 0, [{ key: R.SK.GUN }], {});
  ok(c3.length >= 1 && c3.every(function (c) { return c.key === R.SK.GUN; }),
    'legal 不带 affordable 字段时不得被过滤（D51 曾因此红；实测 ' + c3.length + ' 条）');
  /* ③ F2 的判别性检查：零权重 ⇒ 所有候选同分 ⇒ 槽位多寡**不得**改变技能概率 */
  const zero = new Array(Pol.paramCount()).fill(0);
  const cands = [
    { key: R.SK.GUN, target: 1, target2: null, bead: null },
    { key: R.SK.GUN, target: 2, target2: null, bead: null },
    { key: R.SK.GUN, target: 3, target2: null, bead: null },
    { key: R.SK.GUN, target: 4, target2: null, bead: null },
    { key: R.SK.PROTO, target: null, target2: null, bead: null }
  ];
  const f = Pol.forwardCands(st, 0, cands, zero, { temp: 0.5 });
  let pg = 0; for (let i = 0; i < 4; i++) pg += f.probs[i];
  ok(Math.abs(pg - f.probs[4]) < 0.05,
    '同分时"4 条槽位"与"1 条槽位"的技能概率必须相等（实测 ' + (pg * 100).toFixed(1) + '% vs ' + (f.probs[4] * 100).toFixed(1) + '%）');
  let s = 0; for (let i = 0; i < f.probs.length; i++) s += f.probs[i];
  ok(Math.abs(s - 1) < 1e-9, '两级相乘后 prob 表必须仍严格归一（实测 ' + s + '）');
  /* ④ argmax/greedy 语义必须不变（两级后"条目少"的条目概率反而更高 ⇒ 不能用 probs 取最大） */
  const y = new Array(Pol.paramCount()).fill(0);
  ok(Pol.forwardCands(st, 0, cands, y, { temp: 0.5 }).cand.key === R.SK.GUN,
    'greedy 语义 = 全表最大对数几率（零权重时取第一个条目）');
  /* ⑤ 结构断言：两级相乘与 F1 的"显式 false"必须真在源码里 */
  const src = readFileSync('js/train/policy.js', 'utf8');
  ok(src.indexOf('kProb[k] * within') >= 0, '两级采样必须写在 forwardCands（技能层 × 条目层）');
  ok(src.indexOf('l.affordable === false') >= 0, 'F1 必须只过滤显式 false');
});


/* ===== v1.5.76（P1）：珠子闭环奖励 =====
 * 起因：用户实测线上包 `chargeProfile` 浪费率 100%（得珠 0.30/局、花掉 0.00），
 * 而珠子消费卡（电磁炮/天火）都要 2 ジ、蓄能常发生在 ep=1 ⇒ 下回合必然凑不出 ⇒ 闭环学不出来。
 * 窄条件 + 可归因 + 事件派生（与 RING_W/PRESS_W/PIERCE_W 同族）⇒ 不该引 D16 指纹 churn。 */
t('D99 两处修正：原型制御 ≥3 转移（R24）+ 目标架势特征不再是死特征', function () {
  /* ① 原版 `README.md:257` 后半句「若伤害总数≥3 则将伤害各自转移给作用者」从未实现（用户实测没触发）。
   * ② 用户实盘"无根据的突然集火"的根因：`policy.js` 的"目标带架势"那一维读 `X.guardOf(state, tid)`，
   *    而决策时刻 `state.actions` 全 null（startTurn 清空 + autoGameN 先收 picks 再施加）⇒ **恒为 0**。 */
  const rs = readFileSync('js/core/resolve.js', 'utf8');
  ok(rs.indexOf('function protoReflectAll(state)') >= 0, '原型制御必须有"决算"函数（≥3 各自转移）');
  ok(rs.indexOf('protoNote(state, to, dmg.source, dmg.amt, dmg.type, via)') >= 0,
    '挡住的同时必须**记账**（"伤害总数"= 可以生效且会被挡住的伤害之和 —— 用户口径）');
  ok(rs.indexOf('if (total >= 3)') >= 0 && rs.indexOf('if (it.source == null || it.source === to) continue;') >= 0,
    '决算：总数 ≥3 时反给施法者；**无来源的那几份（天火）计入总数但跳过**');
  ok(rs.indexOf('protoReflectAll(state);  // v1.5.117') >= 0, '决算必须真的被调用（不是只定义 —— D28 的教训）');
  ok(rs.indexOf("protoNote(state, v, null, 1, R.DMG.FIRE, 'firestorm')") >= 0,
    '天火那一份必须**计入总数**（用户口径：它会被挡住，所以算进总数；但无来源 ⇒ 不被反）');
  ok(rs.indexOf("reason: '原型制御·转移'") >= 0, '转移伤害必须有事件标记便于量具核对');
  const po = readFileSync('js/train/policy.js', 'utf8');
  /* ⚠️ 只看**代码行**：这条根因的注释里必然会提到旧写法（`guardOf(…)`），扫全文会自己把自己判红
   * （我第一版就这么栽的）。注释行以 `*` 或 `//` 开头 ⇒ 滤掉再断言。 */
  const poCode = po.split('\n').filter(function (l) {
    const s = l.trim();
    return s.indexOf('*') !== 0 && s.indexOf('//') !== 0 && s.indexOf('/*') !== 0;
  }).join('\n');
  ok(poCode.indexOf('guardOf(state, tid)') < 0,
    '**死特征**不得回来 —— `guardOf` 在决策时刻恒为 null（旧写法读的是本回合 actions）');
  ok(poCode.indexOf('(t.guardNext || t.baguaExtra || t.copiedGuard) ? 1 : 0') >= 0,
    '目标架势特征必须用**决策时刻真的存在**的信号（guardNext / baguaExtra / copiedGuard）');
  /* （另有两条"整句在册"钉 —— policy.js 注释里必须写『无根据的突然集火』 ‖ RULES-2P 必须写『三个人各用枪打』那个例子 ——
   *   已于 v1.6.12 删除，理由见 METHODOLOGY 第 89 条。根因说明该不该写是文档纪律，不是能 grep 的判据；
   *   上面两条结构钉（死特征不得回来 + 必须用决策时刻存在的信号）才是这条门真正的牙。） */
});

}

