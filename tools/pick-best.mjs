/* Epirus —— 「多目标择优」的**纯函数单一来源**（v1.5.130）
 *
 * 为什么抽成单独文件：这段逻辑原先**内联在 `tools/train-best.mjs` 里**，
 * 于是 `np-test` 想守它就只能钉文本（本仓 v1.5.128 的门禁审计刚刚把一批"钉排版"的
 * 近恒真断言换成了运行时喂值读回）。抽成纯函数后，门可以喂**合成候选表**直接验行为。
 *
 * ===== 它修的是什么（一个有实测反例的假承诺）=====
 * `train-best.mjs` 第 92 行一直写着"保证新一轮择优绝不会回归到比现有更弱的冠军"，
 * 而旧实现只有 `sc`（胜率分）+ 容差带 + 发散度三步 —— **没有**任何一步在看"冠军原本过得去的线被打回去了"。
 * 更要命的是 `evScore()` 的闸门罚项在有洞时**退化成常数**：
 *     gateOk=false ⇒ sc = gateMin*0.4 - 1；而 gateMin 就是那个洞（常见 = 0）⇒ sc ≡ -1
 * ⇒ 只要有**一个**候选有洞，容差带就退化成"全部候选"，择优实际由 `divNorm` 决定。
 *
 * 实测反例（v1.5.130 第一臂，`train2p.log`）：
 *   现有冠军     avg=89%  divNorm=0.201  洞：beadburst 0%
 *   候选1（选中）avg=85%  divNorm=0.366  洞：beadburst 修好到 93%，但 defend 0% / reflectspam 0%
 *   5 个候选 sc 全是 -1.000 ⇒ 容差带 = 5 ⇒ "取最发散" ⇒ **把 1 个洞的包换成了 2 个洞的包**。
 *
 * 所以这里加**不回归层**：把"现有冠军已过（>50%）却被该候选打回（≤50%）"的候选整层剔除。
 * 现有冠军自身在该层里恒成立（它跟自己比没有回归）⇒ **"绝不回归"第一次有了机械保证**。
 * 注意：候选**自己仍有洞**（≤50%）是允许留在这层的 —— 那正是我们要修的洞。
 */

export const INCUMBENT_TAG = '现有冠军';

/* ===== §E322（v1.6.7）：当选键的**多评估种子**单一来源 =====
 * 病（实测，`champion-map/evaln-noise.mjs` ‖ `docs/OVERNIGHT-2026-10-05-qoder.md` §E316）：
 *   终局当选键原先是 `evalN(params, ALL_PAIRS, 20, n, **987654**)` 的 `firstRate + 0.5·top2Rate`
 *   —— **只有一粒 seedBase、每粒候选 720 局**。在它自己口径上量的种子噪声：
 *     单枚包换 seedBase ⇒ `sc` 摆 **p50 5.42 ‖ 8.54 ‖ 9.10pt（max 9.65pt）**，而同分带容差只有 **3.0pt**
 *     ⇒ **这把尺的噪声比它自己的同分带粗 2~3 倍**；三批真名人堂里 **2 批的当选者随 seedBase 换人**
 *       （`epsX-201` 是 band1 ‖ band6 = **4:4**，两者分差 0.49pt）⇒ "谁当冠军"里有一部分是抽签。
 *   修法不涉及任何口径之争：**同一批候选多打几粒 seedBase 取均值**（4 粒 ⇒ 每粒候选 2880 局，SE 约减半）。
 *     代价实测 ≈ **+25 秒/臂**（6 粒 × 8 粒 = 34,560 局只要 100 秒）。
 *
 * ⚠ `SEL_STRIDE` 必须 > `evalN` 内部的 seed 跨度：`oneGameN` 的 seed = `seedBase + g*977 + total`，
 *   g < 20、total < 720 ⇒ 单粒 base 占掉约 20,260 个整数 ⇒ 步长取 100,000 才能保证**两粒 base 的局 seed 集合不重叠**。
 *   （§E316 那台量具用步长 1 是**故意**的：它要的是"另一条随机流"，不是"不交的样本集"；两处目的不同，别抄成同一个数。）
 *
 * 抽成纯函数的理由与本文件其它部分一样：门可以**喂合成 runs** 直接验行为，不必跑一条真臂（§E249 那条"短训练 band=1 ⇒ 永绿装饰"）。 */
export const SEL_BASE0 = 987654;        // 现状那一粒 = 现役冠军当初被选上台的那一粒
export const SEL_STRIDE = 100000;
export const SEL_SEEDS_DEFAULT = 4;
/** 把 `EPIRUS_SEL_EVAL_SEEDS` 解析成粒数。**只认 1..8 的整数**；非法值不静默回落，返回 `bad` 让调用方响亮。 */
export function parseSelSeeds(raw) {
  if (raw === undefined || raw === null || raw === '') return { k: SEL_SEEDS_DEFAULT, bad: null, from: '默认' };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 8) return { k: SEL_SEEDS_DEFAULT, bad: String(raw), from: '回落默认' };
  return { k: n, bad: null, from: 'env' };
}
/** 第 i 粒 seedBase（i 从 0 起）。 */
export function selBase(i) { return SEL_BASE0 + i * SEL_STRIDE; }
export function selBases(k) { const a = []; for (let i = 0; i < k; i++) a.push(selBase(i)); return a; }
/** runs = `evalN` 的返回数组 ⇒ 给出**均值口径的 sc**、各自的 first/top2 均值、以及 sc 的种子极差（pt）。
 *  极差必须一路印到日志与 meta 里 —— §E318 的结论是"链上从不印分差与噪声的关系"，这条先把噪声印出来。 */
export function scoreRuns(runs) {
  const list = (runs || []).filter(function (v) { return v && typeof v.firstRate === 'number'; });
  if (!list.length) return { sc: 0, firstRate: 0, top2Rate: 0, spreadPt: 0, n: 0, first: 0, second: 0, third: 0, games: 0 };
  const scs = list.map(function (v) { return v.firstRate + 0.5 * v.top2Rate; });
  const mean = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
  const sum = function (k) { return list.reduce(function (x, v) { return x + (Number(v[k]) || 0); }, 0); };
  return {
    sc: mean(scs),
    firstRate: mean(list.map(function (v) { return v.firstRate; })),
    top2Rate: mean(list.map(function (v) { return v.top2Rate; })),
    spreadPt: (Math.max.apply(null, scs) - Math.min.apply(null, scs)) * 100,
    n: list.length,
    /* 计数也一并聚合：报告行 `1st/2nd/3rd = a/b/c of N` 的 N 必须与上面那个均值**同一段对局**，
     * 否则印出来的分母是 720 而读数其实来自 4×720 ⇒ 又是一处"图上两个口径"。 */
    first: sum('first'), second: sum('second'), third: sum('third'), games: sum('games')
  };
}
/** 一行给日志看的"这枚候选自己被量得多稳"。
 *  ⚠ 这里**不下"判不动"的结论** —— 单枚自身的极差只说明它的读数有多抖，
 *    "能不能判"要看**第 1 与第 2 名的分差**（那是 `selGapNote` 的活）。把两件事混起来印，
 *    就是 §E318 那条"链上从不印分差与噪声的关系"的另一种犯法。 */
export function selNote(s) {
  // n=1 时极差恒 0 ⇒ 印成 "0.0pt" 会被读成"这枚很稳"，而它其实是"没量过"
  return '（n=' + s.n + ' 粒 seedBase ‖ 自身极差 ' + (s.n < 2 ? '无从估' : s.spreadPt.toFixed(1) + 'pt') + '）';
}
/** 当选现场的"分差 vs 噪声"判决行：拿排序后的前两名胜者分作差，与两者各自的种子极差里较大的那个比。
 *  entries = `hallEntries`（有 `score` 与 `ev.spreadPt`、`ev.n`）。返回一行可直接 console.log 的字符串。
 *  ⚠ `EPIRUS_SEL_EVAL_SEEDS=1` 时每枚的"自身极差"恒为 0 —— 那是**没有噪声估计**，不是"噪声为零"。
 *    拿 0 去比分差会印出"判得动"，等于用一把从没量过的尺自证清白（口径陷阱第 57 条的同族）。 */
export function selGapNote(entries) {
  const list = (entries || []).filter(function (e) { return e && typeof e.score === 'number'; })
    .slice().sort(function (a, b) { return b.score - a.score; });
  if (list.length < 2) return '[当选键] 候选不足 2 粒 ⇒ 无从谈分差';
  const gapPt = (list[0].score - list[1].score) * 100;
  const ns = [list[0].ev, list[1].ev].map(function (e) { return e && typeof e.n === 'number' ? e.n : null; });
  if (ns.indexOf(null) >= 0 || Math.min(ns[0], ns[1]) < 2) {
    return '[当选键] 第 1 与第 2 名分差 ' + gapPt.toFixed(2) + 'pt ‖ **只有一粒 seedBase ⇒ 这一格没有任何噪声估计**' +
      '（极差恒 0 是"没量过"，不是"量出来是 0"）⇒ 分差与噪声不可比，要判就得加 seedBase';
  }
  const noisePt = Math.max(list[0].ev.spreadPt || 0, list[1].ev.spreadPt || 0);
  const tol = 3.0;   // 同分带容差（WR_TOL / SEL_LAND_TOL 的默认 0.03，换算到 ×100 的读数上就是 3.0pt）
  return '[当选键] 第 1 与第 2 名分差 ' + gapPt.toFixed(2) + 'pt ‖ 两者自身极差较大者 ' + noisePt.toFixed(1) + 'pt ‖ 同分带 ' + tol.toFixed(1) + 'pt（各 n=' + ns[0] + ' 粒） ⇒ ' +
    (gapPt <= tol ? '**分差落在同分带内 ⇒ 这一格基本是抽签**（要判就得加 seedBase 或换键）'
      : gapPt <= noisePt ? '**分差小于自身噪声 ⇒ 方向可信、幅度判不动**'
        : '分差大于自身噪声 ⇒ 这一格判得动');
}


/* 候选把冠军已过的基准打回去的条数（>0 = 有回归，不许当选） */
export function regressionsOf(cand, incumbent) {
  if (!incumbent || !cand || !cand.ev || !cand.ev.per) return 0;
  let n = 0;
  for (const k in incumbent.ev.per) {
    if (incumbent.ev.per[k] > 0.5 && cand.ev.per[k] <= 0.5) n++;
  }
  return n;
}

/* 候选**新过**的条数（冠军 ≤50% 而候选 >50%）—— 只用于日志/产物留痕，不参与排序 */
export function fixesOf(cand, incumbent) {
  if (!incumbent || !cand || !cand.ev || !cand.ev.per) return 0;
  let n = 0;
  for (const k in incumbent.ev.per) {
    if (incumbent.ev.per[k] <= 0.5 && cand.ev.per[k] > 0.5) n++;
  }
  return n;
}

/* ===== v1.5.154-night（§N9 · 三处对齐）：当选面的退化闸 =====
 * 2P `train-best` 有 vetoDegenerate、`promote-champion` 有"零攻击 ≥90% 阻断"，
 * 但 **train-3p 的名人堂当选**什么都没有 —— xn10b 让纯ジ龟包以带内最高 trainFit 当选
 * （收割奖励在"存活 rank 主梯度"下的反向捷径）。本函数把三处拉平。
 * entries: [{ ref, score, zeroAtkRate }]（按 score 降序或任意序）；阈值与 promote 同 0.9。
 * 全退化 ⇒ 返回 {best:null}：调用方**必须响亮**，不许回退当选（"回退旧行为"= 本闸要堵的东西）。 */
export function rejectDegenerateWinners(entries, thr) {
  const T = (thr != null ? thr : 0.9);
  const clean = (entries || []).filter(function (e) { return !(e && e.ref) || !(Number(e.zeroAtkRate) >= T); });
  const dropped = (entries || []).length - clean.length;
  clean.sort(function (a, b) { return b.score - a.score; });
  /* v1.5.167：`clean` 也返回 —— 当选面还要在闸后按兑现广度取大者（`bandPickByLand`）。
   * 不在这里开口子，调用点就会再抄一遍 0.9 阈值（本仓"两处各写一遍"的老毛病）。 */
  return { best: clean.length ? clean[0] : null, dropped: dropped, clean: clean };
}

/** v1.5.170（qoder §N29 · `EPIRUS_BREADTH_FLOOR`）：**广度塌缩当"不合格"，不当"排序键"**。
 * 为什么换成"线"：§N25 已否掉排序键（同分带里只剩 1 粒 ⇒ 咬不动；咬动了换上来的是病包），
 * 而 §N28 两对种子实测**四粒冠军里有三粒净兑现只剩一种卡**（`xn17a`/`xn15f` = `G(落地) 1.00、1 种`）
 * ⇒ 塌缩不是意外而是常态，需要的是**准入线**而不是第三根排序键。
 * 口径（只数真卡名的那一套，见 `mirrorHealth.effSkillsLand`）：`landedKeys ≥ 2` **且** `effSkillsLand ≥ floor`。
 * 前者是"塌缩"的定义本身（只有一种卡打上血），后者防"两种但一种占 99%"。标定（`mirrorHealth(20,5,'multi')` 实测）：
 *   现役 3P `2.66（3 种）` · 2P 槽 `2.98（3 种）` · 塌缩臂 `1.00（1 种）` · 今晚最宽的那粒 `1.75（3 种）` ⇒ 默认线 1.5 只砍塌缩，不砍宽包。
 * 与 `rejectDegenerateWinners` 同规矩：**全不合格 ⇒ `allRejected=true`，调用方必须响亮**，不许静默退回"不过滤"。 */
/** v1.5.227：**塌缩线**（最大单卡落地份额）—— 单一来源，探针/门/训练都 import 它，不许各处各写一个数。 */
export const COLLAPSE_LINE = 0.60;
export function rejectNarrowWinners(entries, floor) {
  const F = (floor != null ? floor : 1.5);
  const list = (entries || []).filter(function (e) { return !!e; });
  /* v1.5.227（用户裁定"换 G 的定义"）：**塌缩 = 最大单卡落地份额**，不再是"数种类"。
   * 病（实测，见 `tools/probe-g-collapse.mjs` 的 20 粒样本）：旧子句 `landedKeys < 2` **从来没触发过** ——
   *   池里每粒包都是 4~10 种（中位 5），连 `v7expo-31` 那种 **10 种卡打上血、却有 76.4% 的伤害来自 `sword`**
   *   的粒也照样放行；口语里的"≥4 种"线更是恒真。⇒ **宽度会误导**：种类多与塌缩可以同时成立。
   * 改成判份额：`max(landByKey)/landedTotal > 0.60` ⇒ 塌缩（"一种卡吃掉六成以上落地"）。
   * 实测散布（产品口径 · 20 粒）：36.0% → 97.7%，中位 69.1%，**11/20 超线**，现役在 **45.9%**（安全侧）
   * ⇒ 这个轴有判别力，旧轴没有。份额线是**加严**：`landedKeys<2` 蕴含其中（只有一种卡 ⇒ 份额 100%）。
   * 缺 `maxLandShare` 的条目退回旧子句，并把缺的个数报成 `shareMissing`（不许静默降级成"看不见就当过"；
   * 也不许因老调用方没传就把它们全判死 —— 那会把 D128 的既有单测全打红）。训练路径总是传 ⇒ 由 D159 钉住。 */
  let shareMissing = 0;
  const bad = function (e) {
    if (!(e && e.ref)) return false;
    const keys = Number(e.landedKeys) || 0;
    const share = (e.maxLandShare == null || e.maxLandShare === '') ? null : Number(e.maxLandShare);
    if (share == null) shareMissing++;
    const collapsed = (share == null) ? (keys < 2) : (share > COLLAPSE_LINE);
    return collapsed || !(Number(e.landG) >= F);
  };
  const clean = list.filter(function (e) { return !bad(e); });
  const dropped = list.length - clean.length;
  clean.sort(function (a, b) { return b.score - a.score; });
  return {
    best: clean.length ? clean[0] : null, clean: clean, dropped: dropped, floor: F,
    collapseLine: COLLAPSE_LINE, shareMissing: shareMissing,
    allRejected: list.length > 0 && clean.length === 0,
    victims: list.filter(bad).map(function (e) {
      return { landG: Number(e.landG) || 0, landedKeys: Number(e.landedKeys) || 0, score: e.score,
        maxLandShare: (e.maxLandShare == null ? null : Number(e.maxLandShare)), maxLandKey: e.maxLandKey || null };
    })
  };
}

/** v1.5.161（qoder P1 · §N14 实证）：**3P 第二栏否决** —— 过不了 3P 可行性五道的候选不许当选。
 * 病：收口臂 `v7xn14a` 里 `band2`（考卷 98.25%/最差 85%、3P 五道全过、场B 4.00/局、score 0.916 **高于**当选者）
 * 只因容差带内 hill05 低被挤掉，而当选的 `band1` 在 3P 侧是**场B 0.00 + 墙 0.00/局** ⇒ 本臂目标对择优完全透明。
 * 入参：`entries[i].col3p = { measured, ok, fails }`；**未测/缺栏一律视为不合格**（拒绝"看不见就当过"的静默降级）。
 * `isIncumbent` 的在位参照不参与否决（它是"不回归层"的基线，不是竞争者）。
 * 返回 `{ kept, rejected, allRejected }` —— `allRejected` 时**调用方必须响亮退出**，不许退回单栏硬选（§N14 就是这么错的）。 */
export function vetoBy3p(entries) {
  const list = (entries || []).filter(function (e) { return !!e; });
  const kept = [], rejected = [];
  for (const e of list) {
    if (e.isIncumbent) { kept.push(e); continue; }
    const c = e.col3p;
    if (c && c.measured === true && c.ok === true) kept.push(e); else rejected.push(e);
  }
  const comp = list.filter(function (e) { return !e.isIncumbent; });
  return {
    kept: kept, rejected: rejected,
    /* "有竞争者、但一合格都没有" —— 与"根本没有竞争者"分开判，别把空池当成全否决 */
    allRejected: comp.length > 0 && kept.filter(function (e) { return !e.isIncumbent; }).length === 0
  };
}

/* 择优：① 不回归层 → ② 胜率容差带 → ③ 带内取**广度**最大者。
 * cands: [{ tag, sc, ev:{ avg, per:{...} }, div:{ divNorm, distinct, effSkills, hill05 } }]（现有冠军的 tag 必须是 INCUMBENT_TAG）
 * 返回 { best, band, safe, incumbent, topSc, dropped }
 *
 * ===== v1.5.147（xfer44 臂反例 · 用户批准）：带内排序键 divNorm → hill05 → distinct → divNorm =====
 * 病（2026-09-21 实测）：三候选 avg 98~99% 全进带，divNorm 差 **0.194 vs 0.189** ⇒ 0.005 的分差
 * （60 局采样熵的噪声以下）把"种类=2 的两件套"选成了冠军，杀掉"种类=5"的候选 ——
 * Shannon 归一熵把"两张卡打花"记成和"五种卡有主次"**同价**，能量项在"广度"这个轴上是瞎的。
 * 新主键 hill05 = (Σ√p)²（Rényi-0.5 有效技能数，D_q=(Σp^q)^{1/(1-q)}）：长尾按 √p 计权，
 * "真用出下一张卡"严格贵于"把已有两张摇匀"；与门禁 `effSkills=exp(H)`（Hill-1）同一量纲家族。
 * 历史对象没有这两列 ⇒ `|| 0` 兜底后自然退回 distinct→divNorm（旧可比性不破坏）。 */
export function pickBestByExam(cands, opts) {
  const WR_TOL = (opts && opts.wrTol != null) ? opts.wrTol : 0.03;
  const list = (cands || []).slice();
  const incumbent = list.filter(function (c) { return c.tag === INCUMBENT_TAG; })[0] || null;
  /* ===== 夜班 00:2x（seed 11 反例 · v1.5.94 退化包闸的 2P 择优侧对应物）=====
   * `opts.vetoDegenerate` ⇒ 镜像零攻击（div.distinct===0）的候选**不许当选**（现有冠军豁免，
   * 它恒在层内是 D104 的承诺）。病：2P 考卷对"只ジ不动手"的包能读 avg=100%（脚本互杀自己），
   * 择优若不看出手面就会给退化包发冠冕。3P promote 早有"自对局零攻击局判负"，两入口从此同判。 */
  let pool = list;
  if (opts && opts.vetoDegenerate) {
    pool = list.filter(function (c) {
      if (c === incumbent) return true;
      if (c.div && c.div.distinct === 0) { (c.__vetoed = true); return false; }
      return true;
    });
  }
  /* 没有现有冠军（首次训练）⇒ 无从谈"回归"，不回归层不生效（行为与旧版一致）。 */
  const safe = incumbent ? pool.filter(function (c) { return regressionsOf(c, incumbent) === 0; }) : pool;
  if (!safe.length) throw new Error('[pick-best] 不回归层把所有候选都剔除了（现有冠军应恒在层内）');
  const topSc = Math.max.apply(null, safe.map(function (c) { return c.sc; }));
  const band = safe.filter(function (c) { return c.sc >= topSc - WR_TOL; });
  band.sort(function (a, b) {
    const da = a.div || {}, db = b.div || {};
    return (db.hill05 || 0) - (da.hill05 || 0)
        || (db.distinct || 0) - (da.distinct || 0)
        || (db.divNorm || 0) - (da.divNorm || 0);
  });
  return { best: band[0], band: band, safe: safe, incumbent: incumbent, topSc: topSc, dropped: list.length - safe.length };
}

/** v1.5.167（qoder §N24 · `EPIRUS_SEL_LAND`）：**同分带内按"兑现广度"取大者**。
 * 为什么不是把"落地"写进奖励：仓里有前例 —— "奖励贵技能落地"的探针会选出**乱挥双枪**的冠军（实测 −27pt，
 * 见 `evo.js:evalSubsidyProbe` 的头注）⇒ 兑现只能当**同分带内的排序键**（胜率不许为广度让路），不能当 fit 的一项。
 * 入参：`entries[i] = { score, landG }`（`score` = 该候选的胜负分；`landG` = `mirrorHealth.effSkillsLand`）。
 * 规则：① 取最高分 top；② 带 = `score ≥ top − tol`；③ 带内按 `landG` 取大、再同则按 `score`；
 * ④ **带外者永不参与**（广度不许用来救一个胜率更差的包）；缺 `landG` 记 0（= 不参与"广"的竞争，而不是当它满格）。 */
/* ===== v1.5.326（qoder 10-03 夜班 §E249）：**同分带内按"某几张卡的出手量"选人**（`EPIRUS_SEL_BIGT` 的排序键）=====
 * 动因（今晚 4 批 47 臂实测）：`EPIRUS_COSTLY_W` 把名人堂里"会打大雷"的粒从**对照 0/6 抬到 6/6**，
 *   可**当选产物**常常还是 0.000 —— 终局重验只按胜负分选人，"会不会打这张卡"看不见。
 *   ⇒ 与其继续加大奖励（今晚证明"当选层种子压过剂量"），不如把用量做成**选人排序键**。
 * 与 `bandPickByLand` 同一形状，只差排序键；两条纪律**写在这份纯函数里**（不散在调用点，防"名单写两遍"那一族）：
 *   ① **带内全部用量为 0 ⇒ 一律不换人**（`zeroDose:true` + 返回分数最高那粒）——
 *      否则这根键会在没有任何证据的情况下动判定，而下游只看得到"这臂跑过了"（= 永绿假守卫，§E198 同族）；
 *   ② 换人必须被记下来（`tieBrokenBy:'usage'`），门才钉得住"排序键真咬到"。
 * `usageOf(e)` 由调用点给（train-3p 用 `behavior-profile.fieldProfile`，与 `SEL_KEEP_CAL=plain` 同一把尺）。 */
export function bandPickByUsage(entries, tolPt, usageOf) {
  const list = (entries || []).filter(function (e) { return !!e; });
  if (!list.length) return { best: null, band: [], top: 0, zeroDose: true, pickedUsage: 0, tieBrokenBy: 'none' };
  const u = function (e) {
    const v = Number(usageOf ? usageOf(e) : e.usage) || 0;
    e.__usage = v;
    return v;
  };
  const top = list.reduce(function (m, e) { return Math.max(m, Number(e.score) || 0); }, 0);
  const band = list.filter(function (e) { return (Number(e.score) || 0) >= top - (Number(tolPt) || 0) / 100; });
  const byScore = band.slice().sort(function (a, b) { return (Number(b.score) || 0) - (Number(a.score) || 0); });
  const zeroDose = band.every(function (e) { return u(e) === 0; });
  let best = byScore[0] || null;
  if (!zeroDose) {
    const byUse = band.slice().sort(function (a, b) {
      if (u(b) !== u(a)) return u(b) - u(a);
      return (Number(b.score) || 0) - (Number(a.score) || 0);
    });
    best = byUse[0] || best;
  }
  return {
    best: best, band: band, top: top, zeroDose: zeroDose,
    pickedUsage: best ? u(best) : 0, usage: band.map(function (e) { return u(e); }),
    tieBrokenBy: (best && byScore[0] && best !== byScore[0]) ? 'usage' : 'score'
  };
}

export function bandPickByLand(entries, tol) {

  const list = (entries || []).filter(function (e) { return !!e; });
  if (!list.length) return { best: null, band: [], top: 0, dropped: 0, tieBrokenBy: 'none' };
  const T = (tol != null ? tol : 0.03);
  /* v1.5.168：先剔掉 `gateOk === false` 的候选 —— 兑现广度**不许**把一粒"过不了不可 --force 硬门槛"的包换上来
   * （L1 臂实测就是这么错的：用 0.8pt 胜负分换到一粒每局给别人套 11.9 次全息屏障的包）。
   * 未提供 gateOk（旧调用点）⇒ 视为通过，行为与 v1.5.167 逐字一致。 */
  const gated = list.filter(function (e) { return e.gateOk !== false; });
  const skipped = list.length - gated.length;
  const top2 = gated.length ? gated.reduce(function (m, e) { return Math.max(m, Number(e.score) || 0); }, 0) : 0;
  const band = gated.filter(function (e) { return (Number(e.score) || 0) >= top2 - T; });
  const dropped = list.length - band.length;
  const byLand = band.slice().sort(function (a, b) {
    const la = Number(a.landG) || 0, lb = Number(b.landG) || 0;
    if (lb !== la) return lb - la;
    return (Number(b.score) || 0) - (Number(a.score) || 0);
  });
  const byScore = band.slice().sort(function (a, b) { return (Number(b.score) || 0) - (Number(a.score) || 0); });
  const best = byLand[0] || null;
  return {
    best: best, band: band, top: top2, dropped: dropped, skipped: skipped,
    /* 只有"换人"才算被广度改判 —— 门 D127 钉这一格，防止排序键变成哑元素 */
    tieBrokenBy: (best && byScore[0] && best !== byScore[0]) ? 'land' : 'score'
  };
}
