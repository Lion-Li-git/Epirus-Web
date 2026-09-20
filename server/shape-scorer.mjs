/* P2 形状评分器的**宿主接线**（qoder-research 0920 · RESEARCH-QUEUE P2）—— worker 与 server 共用这一份。
 * 为什么在宿主侧而不是 evo.js 里：装配本体 `duelAssembly` 的唯一真源在 `tools/v2v4-lib.mjs`（D107 守着
 * "1 席脚本 vs 4 席被测"只许一份实现）；evo.js 跑在 vm 沙箱里 import 不了 ESM ⇒ 由宿主把评分器
 * **注入沙箱全局** `__shapeScorer`，evo 只调用、不复制装配。
 * 口径（RESEARCH-LOG §12/§15）：四行——`pickGunFocus` 聚焦枪手 · `pickBeadBurst` 珠爆发 · 真·场B 清场 · G5 防席夺冠取反
 * 各跑 V4 形状（4 席被测家族 vs 1 席脚本），取 `dmgToScriptedPerGame / 4.0`（封顶 1）的平均 ——
 * 即"**家族会不会把火力压到外部威胁身上**"这一列，正是 v1.5.134 §4 里与只枪格 r=−0.82 的那条轴。
 * ⚠️ 不奖励"赢没赢"（v7gf1-92 演示过：标量胜利率会被被动解占领）。 */
import { duelAssembly } from '../tools/v2v4-lib.mjs';
import { aggressionProfile } from '../tools/audit-lib.mjs';

export function makeShapeScorer(win, games) {
  const deps = { S: win.EpirusState, Play: win.EpirusPlay, T: win.EpirusTrainer, R: win.EpirusRules };
  const B = win.EpirusBots;
  const G = Math.max(2, games | 0);
  return function (params) {
    const one = function (scripted) {
      const r = duelAssembly(deps, params, { games: G, mode: 'long', seed0: 90210, scripted: scripted });
      return Math.min(1, r.dmgToScriptedPerGame / 4.0);
    };
    /* 第三行（qoder-research 0920 · Q6 否证后按预注册分支落地）：**真打死被动桌** ——
     * 用场B 门禁的**同一把尺**（`audit-lib.aggressionProfile` 的 `clearedPerGame`：1 席冠军 vs 4 席只按ジ，
     * 收缩开始前打死几个）。⚠️ 第一版误用了 V4 形状（4 家族打 1 木桩 ⇒ 线上包直接 1.000 饱和 ⇒ 无梯度）——
     * 场B 的难是"**一个**要在 45 回合前清掉**四个**"，形状必须与门禁一致。
     * CLEAR_W 旋钮已否证（0.1→0.2 场B 仍 0.00~0.15：包学会"活到收缩后收尸"），这一列把"击杀"与"收缩"分开计价。 */
    const clearRow = function () {
      const prof = aggressionProfile(win, params, G);
      const cl = prof && prof.fieldB ? prof.fieldB.clearedPerGame : NaN;
      return Math.min(1, Math.max(0, (isFinite(cl) ? cl : 0)) / 0.6);
    };
    /* 第四行（Q7 后跷跷板挪到防御轴：v7s6-31 三格绿+场B 3.7，但「只防御」62% · G5 防席 63~68%）：
     * **G5 同形状** —— duelAssembly 的"1 席脚本 vs 4 席被测"里脚本席换成"每回合防御"，
     * `winPct` 就是防席夺冠率；行分 = 1 − min(1, 防席夺冠/25)（阈值与 G5 门禁逐字同）。 */
    const guardOnly = function () { return { key: 'guard', target: null }; };
    const guardRow = function () {
      const r = duelAssembly(deps, params, { games: G, mode: 'long', seed0: 90210, scripted: guardOnly });
      return Math.max(0, 1 - Math.min(1, r.winPct / 25));
    };
    return (one(B.pickGunFocus) + one(B.pickBeadBurst) + clearRow() + guardRow()) / 4;
  };
}
