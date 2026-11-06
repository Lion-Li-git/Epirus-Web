/* 卡面提示（tooltip）的唯一组装处 —— v1.5.173 起存在的原因：
 * 技能说明里**有数字是"按模式可变"的**（摄魂指法的 HP 窗口：R25 原口径 `HP≤1`，长程按 `state.mode.drainHpMax=3` 放宽，
 * 见 `docs/RULES-NP.md` N24），而 `rules.js` 里的 `desc` 是一个**静态字符串**（且 `rules.js` 是指纹五件套之一，
 * 不能为了显示文案换代）。于是"卡面说的话"与"引擎做的事"分家 ⇒ 用户在长程 HP 2 看到格子亮着、提示却写着"仅限 HP≤1"，
 * 读出来的就是"血回上去了还能用 = bug 没修"（`results/摄魂.txt` 那次实测报告的真实成因）。
 * 所以：文案里凡有模式可变数字，一律在这里从 `state.mode` 取**真值**，不许在别处再抄一份数字。
 * 本文件必须是**纯函数、不碰 DOM**（这样门 `np-test D131` 能直接 headless 跑它）。 */
(function () {
  'use strict';

  /** 组一行卡面提示：`s.desc` 里"仅限 HP≤N"这类数字换成本局真值。 */
  function of(R, st, s) {
    var d = String((s && s.desc) || '');
    if (s && R && R.SK && s.key === R.SK.DRAIN) {
      var cap = (st && st.mode && st.mode.drainHpMax != null) ? st.mode.drainHpMax : 1;
      d = d.replace(/仅限 HP≤\d+/, '仅限 HP≤' + cap + (cap > 1 ? '（本模式放宽，见 RULES-NP N24）' : ''));
    }
    return d;
  }

  (typeof window !== 'undefined' ? window : this).EpirusSkillTip = { of: of };
})();
