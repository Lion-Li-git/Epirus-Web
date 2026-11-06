/* 「蓄能攒哪种珠」的唯一决定处 —— v1.5.199 起存在的原因（用户实机复核，非行为改动）：
 * 冠军策略（`policyChooserN` / `pickChampion`）返回的动作里 **`bead` 通常是 null**（网络的动作面没有"攒电珠还是爆珠"这个输出），
 * 于是"这一手蓄能到底产生哪种珠"是**界面层**替它决定的：`ui.js` 里原本有**三处**各自写了一遍
 * `p.elec > p.boom ? 'boom' : 'elec'`（2 人主循环 / 多人主循环 / 人类阵亡后的观战循环）。
 * ⇒ 两个问题：① 三处会漂（漂了就是"同一个包，你活着时和死后打法不同"，而这类差别最难查）；
 *   ② 决策住在错误的层（策略没有发言权，改口径要动 UI）。
 * 本文件先把 ① 收掉：**纯函数、不碰 DOM**（门 `np-test D142` 直接 headless 跑它），行为与原来三处**逐字相同**；
 *   ② 属"要不要把珠类型纳入动作面"的**训练/规则口径改动**，不在这里做，记在 v1.5.199 的待裁里。
 * 引擎侧事实（`js/core/resolve.js` 的 `case SK.CHARGE`）：`opt.bead` 缺省回落成 `'elec'` ⇒ 这里必须**总是**给出一个值，
 *   否则三处的"缺省"会变成"一律电珠"，那是**行为改动**，不是收拢。 */
(function () {
  'use strict';
  /** 该席位这次蓄能攒哪种珠：手上哪种少就攒哪种（相等时保持原口径 = 电珠）。 */
  function prefer(p) {
    if (!p) return 'elec';
    return ((p.elec || 0) > ((p.boom || 0))) ? 'boom' : 'elec';
  }
  /** 出手时最终生效的珠类型：策略给了就听策略的，否则用上面的口径。 */
  function of(p, chosen) {
    return (chosen === 'elec' || chosen === 'boom') ? chosen : prefer(p);
  }
  window.EpirusBeadChoice = { prefer: prefer, of: of };
})();
