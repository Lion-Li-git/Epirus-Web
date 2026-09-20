/* P2 形状评分器的**宿主接线**（qoder-research 0920 · RESEARCH-QUEUE P2）—— worker 与 server 共用这一份。
 * 为什么在宿主侧而不是 evo.js 里：装配本体 `duelAssembly` 的唯一真源在 `tools/v2v4-lib.mjs`（D107 守着
 * "1 席脚本 vs 4 席被测"只许一份实现）；evo.js 跑在 vm 沙箱里 import 不了 ESM ⇒ 由宿主把评分器
 * **注入沙箱全局** `__shapeScorer`，evo 只调用、不复制装配。
 * 口径（预注册在 RESEARCH-LOG §12）：对两条外部压迫线（`pickGunFocus` 聚焦枪手 · `pickBeadBurst` 珠爆发）
 * 各跑 V4 形状（4 席被测家族 vs 1 席脚本），取 `dmgToScriptedPerGame / 4.0`（封顶 1）的平均 ——
 * 即"**家族会不会把火力压到外部威胁身上**"这一列，正是 v1.5.134 §4 里与只枪格 r=−0.82 的那条轴。
 * ⚠️ 不奖励"赢没赢"（v7gf1-92 演示过：标量胜利率会被被动解占领）。 */
import { duelAssembly } from '../tools/v2v4-lib.mjs';

export function makeShapeScorer(win, games) {
  const deps = { S: win.EpirusState, Play: win.EpirusPlay, T: win.EpirusTrainer, R: win.EpirusRules };
  const B = win.EpirusBots;
  const G = Math.max(2, games | 0);
  return function (params) {
    const one = function (scripted) {
      const r = duelAssembly(deps, params, { games: G, mode: 'long', seed0: 90210, scripted: scripted });
      return Math.min(1, r.dmgToScriptedPerGame / 4.0);
    };
    return (one(B.pickGunFocus) + one(B.pickBeadBurst)) / 2;
  };
}
