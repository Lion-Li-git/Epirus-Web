/* ============================================================================
 * pool-frontier-lib.mjs — 「池子前沿」三条判据的**单一来源**（v1.5.249 · Qoder 09-26）
 *
 * 为什么单独成模块（而不是埋在探针里）：门要能在**线两侧**逐条钉住判据，而探针被 import 时会把
 * 全池扫描跑一遍（1457 个文件）。本仓这一族已有先例：`defense-quality.mjs` / `unrun-policy.mjs` /
 * `gate4-exception.mjs` —— **判据是纯函数，探针/门/promote 共用同一份**。
 *
 * 三条判据（09-26 的三级筛就是靠它们把"三合一"数出来的）：
 *   宽   = 两个模式（multi / long）的 `selfPlay.effSkills` 都 ≥3 **且**两模式净兑现都 ≥线
 *   闭环 = `chargeProfile` 的花珠率 ≥线 **且** 得珠 ≥线（两条都要 —— 只认率会被"攒得极少"骗）
 *   抗克 = 两个模式的 G4「最克%」**都** ≤ 现役（读数缺失/NaN 一律判"不抗克"，不许当通过）
 * ==========================================================================*/

/* v1.5.254（用户 GO · Qoder §E55 第 3 条）：**净兑现的"宽"判据必须同 n 并排**，不许用绝对线。
 * 病（实测）：绝对线自带**样本量依赖** —— 现役**自己**在 80 局下 `净兑现 2.63 < 线 2.66`
 *   （2.66 是从另一次 n 的实测抄来的）⇒ 同一粒包换个 n 就被判成"不宽"，而判据会静默换掉。
 * 与「抗克 = 两模式最克 ≤ 现役」那条**同形**（都相对参照），这也是把这一族一次收掉的动机。 */
export const LAND_TOL = 0.10;   // 容差（净兑现量纲约 0~6；0.10 ≈ 半个现役的噪声带）
export function isWideVs(m, inc, tol) {
  const T = (tol != null ? tol : LAND_TOL);
  if (!(m.gMulti >= 3 && m.gLong >= 3)) return false;
  /* 参照缺 ⇒ **判不宽**（fail-closed）：不许因为"读不到现役"就悄悄退回绝对线 —— 那会把判据换掉而输出看不出来
   * （与 `isRobust` 对缺失读数的处置逐字一致：没量到 ≠ 过了）。 */
  if (!inc || !Number.isFinite(inc.landMulti) || !Number.isFinite(inc.landLong)) return false;
  return m.landMulti >= inc.landMulti - T && m.landLong >= inc.landLong - T;
}

/** ⚠️ **绝对线版**：只给①门喂合成行 ②复现历史读数用；新代码一律走 `isWideVs`。 */
export function isWide(m, landLine) {
  return m.gMulti >= 3 && m.gLong >= 3 && m.landMulti >= landLine && m.landLong >= landLine;
}

export function isClosed(m, beadLine, gainedLine) {
  return Number.isFinite(m.spentRate) && Number.isFinite(m.gained) &&
    m.spentRate >= beadLine && m.gained >= gainedLine;
}

/** v1.5.256（DS · 证据见 `docs/RESEARCH-LOG-2026-09-27-ds.md` §15）：闭环判据的**分形态版**。
 *
 * 病（5 种子实测）：`isClosed`（`得珠 ≥100 且 花珠率 ≥0.5`）把**两种不同病因**判成同一个 ✗：
 *   ① **攒着不花**（seed31：得珠 **402**、花珠率 **9.2%**）—— 而这一形态恰恰是"为 5ep 的大雷攒钱"；
 *   ② **根本没有经济**（seed71/191：得珠 **0**）。
 * 且实测"大雷 > 0"与"花珠率 ≥0.5"两点集**不相交**，而 skill report 独立地说大雷值 **+4.9~7.7pt**
 *   ⇒ **现有那条线在惩罚"会用贵卡"这条产品目标**。
 *
 * 新形态以"**钱有没有出口**"为实质，而不是"花掉的**比例**"：
 *   `得珠 ≥ gainedLine` **且** （`花珠率 ≥ spendRateLine` **或** （`贵卡出手/局 ≥ bigCardMin` **且** `终局余珠/局 ≤ leftoverMax`））。
 *
 * ⚠️ **阈值是占位值**（按 §15 的实测形状取保守值），**默认不启用** —— 当前所有调用点仍走 `isClosed`。
 *    启用前必须由用户裁定并留痕（本仓规矩：判据变更要能在线两侧钉住，`np-test` D169 已把两侧都钉了）。 */
export const CARD_BUDGET = { bigCardMin: 1.0, leftoverMax: 8.0 };

export function isClosedShaped(m, beadLine, gainedLine, opt) {
  const o = opt || CARD_BUDGET;
  if (!Number.isFinite(m.gained) || m.gained < gainedLine) return false;      // 先要"挣到"
  if (Number.isFinite(m.spentRate) && m.spentRate >= beadLine) return true;   // 花得动 ⇒ 出口在
  /* 花不动：看是不是"为了贵卡攒着"这一形态 —— 贵卡真出手**且**余珠不多（不是攒了不用） */
  const big = m.bigCardPerGame, left = m.leftoverPerGame;
  if (!Number.isFinite(big) || !Number.isFinite(left)) return false;          // 读数缺失 ⇒ 判不闭环（fail-closed，与 isRobust 同规矩）
  return big >= o.bigCardMin && left <= o.leftoverMax;
}

export function isRobust(g4, inc) {
  if (!g4) return false;                                  // 没量到 ≠ 过了
  const L = g4.long, M = g4.multi;
  return Number.isFinite(L) && Number.isFinite(M) && L <= inc.long && M <= inc.multi;
}

/* 计数用**行对象**（{wide, closed, robust}），这样门能喂合成行、不靠"真跑一局希望碰上"。 */
export function frontierOf(rows, inc) {
  const c = f => rows.filter(f).length;
  return {
    n: rows.length,
    wide: c(r => r.wide),
    closed: c(r => r.closed),
    robust: c(r => r.robust),
    wideAndClosed: c(r => r.wide && r.closed),
    three: c(r => r.wide && r.closed && r.robust),
    robustNotWide: c(r => r.robust && !r.wide),
    wideNotRobust: c(r => r.wide && !r.robust),
    inc: inc || null,
  };
}
