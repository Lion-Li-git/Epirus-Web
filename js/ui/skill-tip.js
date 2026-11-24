/* 卡面提示的唯一组装处：模式可变数字从 state.mode 取真值。
 * 摄魂指法的 HP 窗口为标准/多人/4 血 ≤1、长程 ≤2，见 docs/RULES-NP.md N24。
 * rules.js 的 desc 保持静态；本文件纯函数、不碰 DOM，供 np-test D131 直接调用。 */
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
