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
export function rejectNarrowWinners(entries, floor) {
  const F = (floor != null ? floor : 1.5);
  const list = (entries || []).filter(function (e) { return !!e; });
  const bad = function (e) { return !!(e && e.ref) && ((Number(e.landedKeys) || 0) < 2 || !(Number(e.landG) >= F)); };
  const clean = list.filter(function (e) { return !bad(e); });
  const dropped = list.length - clean.length;
  clean.sort(function (a, b) { return b.score - a.score; });
  return {
    best: clean.length ? clean[0] : null, clean: clean, dropped: dropped, floor: F,
    allRejected: list.length > 0 && clean.length === 0,
    victims: list.filter(bad).map(function (e) { return { landG: Number(e.landG) || 0, landedKeys: Number(e.landedKeys) || 0, score: e.score }; })
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
