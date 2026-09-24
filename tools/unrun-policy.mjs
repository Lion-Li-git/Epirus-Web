/* UNRUN（本门跑不了 / 不可判）的**处置单一来源**（v1.5.202）
 *
 * ## 为什么需要它
 * `gate-drafts` 的三态设计（PASS / FAIL / UNRUN）本身是对的：v1.5.78 的病根是"把没跑的当成过了"，
 * 而用一个 FAIL 去表达"不可判"同样有害（它会把"量具没量出来"伪装成"候选不合格"）。
 * 但第三态**没有处置语义**：`promote-champion` 把 UNRUN 单独收集、醒目打印"不得当作通过"，
 * 却**从不把它送进 `fails`** ⇒ 一个"基线退化、整格不可判"的候选可以**零阻断**通过，
 * 全靠一句 print 兜着 —— 而门（D67）只钉了那句话的**文本**。
 *
 * ## 但不能无脑阻断：`judgeable` 把两个**相反**方向合并了
 * G4 的可判窗口是"该包的 harness 基线胜率 ∈ [8%, 32%]"：
 *   - `base.win < 8%`  ⇒ **候选把克制表基线压着打** —— 这是**强包**的形状，克制表对它没有判别力，
 *     不是候选的缺陷。无脑阻断会把最强的候选挡在门外（本仓为"误挡强候选"栽过：G5 n=60 把
 *     `co1s8-band1` 按 28% 挡掉，n=300 复测 4%/22%）。
 *   - `base.win > 32%` ⇒ **候选打不过最弱的克制脚本** —— 这是**真缺陷**被"不可判"这个措辞盖住了。
 *   - 读不出（NaN / 探针缺失）⇒ 未知；本仓先例（`audit-lib` 的探针缺失守卫）是**阻断**。
 * ⇒ 所以按方向给处置：**弱 = 只记录；强 = 阻断；缺 = 阻断**；参照行的 UNRUN 与参照行的 FAIL 同待遇（只记录）。
 */

export const UNRUN_KINDS = { WEAK: '弱', STRONG: '强', MISSING: '缺' };

/** 给一个 UNRUN 格定处置。`kind` 缺省（旧格式）按**强**处理（保守）。 */
export function unrunDisposition(kind, isRef) {
  if (isRef) return { blocking: false, why: '参照行（线上包 / 元测试）⇒ 与参照行的 FAIL 同待遇：只记录' };
  if (kind === UNRUN_KINDS.WEAK) {
    return { blocking: false, why: '基线太弱（<8%）⇒ 候选压着克制表打，是**强包**的形状，不是缺陷' };
  }
  if (kind === UNRUN_KINDS.STRONG) {
    return { blocking: true, why: '基线太强（>32%）⇒ 候选打不过最弱的克制脚本，"不可判"这个措辞把它盖住了' };
  }
  if (kind === UNRUN_KINDS.MISSING) return { blocking: true, why: '读不出（探针缺失 / NaN）⇒ 未知，保守判红（同 audit-lib 的探针缺失守卫）' };
  return { blocking: true, why: '未知的 UNRUN 种类（' + String(kind) + '）⇒ 保守判红' };
}
