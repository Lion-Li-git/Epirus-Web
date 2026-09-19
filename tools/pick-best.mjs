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

/* 择优：① 不回归层 → ② 胜率容差带 → ③ 带内取覆盖熵最大者。
 * cands: [{ tag, sc, ev:{ avg, per:{...} }, div:{ divNorm, distinct } }]（现有冠军的 tag 必须是 INCUMBENT_TAG）
 * 返回 { best, band, safe, incumbent, topSc, dropped } */
export function pickBestByExam(cands, opts) {
  const WR_TOL = (opts && opts.wrTol != null) ? opts.wrTol : 0.03;
  const list = (cands || []).slice();
  const incumbent = list.filter(function (c) { return c.tag === INCUMBENT_TAG; })[0] || null;
  /* 没有现有冠军（首次训练）⇒ 无从谈"回归"，不回归层不生效（行为与旧版一致）。 */
  const safe = incumbent ? list.filter(function (c) { return regressionsOf(c, incumbent) === 0; }) : list;
  if (!safe.length) throw new Error('[pick-best] 不回归层把所有候选都剔除了（现有冠军应恒在层内）');
  const topSc = Math.max.apply(null, safe.map(function (c) { return c.sc; }));
  const band = safe.filter(function (c) { return c.sc >= topSc - WR_TOL; });
  band.sort(function (a, b) { return b.div.divNorm - a.div.divNorm; });
  return { best: band[0], band: band, safe: safe, incumbent: incumbent, topSc: topSc, dropped: list.length - safe.length };
}
