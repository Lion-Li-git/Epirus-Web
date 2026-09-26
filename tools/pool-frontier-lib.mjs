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

export function isWide(m, landLine) {
  return m.gMulti >= 3 && m.gLong >= 3 && m.landMulti >= landLine && m.landLong >= landLine;
}

export function isClosed(m, beadLine, gainedLine) {
  return Number.isFinite(m.spentRate) && Number.isFinite(m.gained) &&
    m.spentRate >= beadLine && m.gained >= gainedLine;
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
