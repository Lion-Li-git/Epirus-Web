/* P2 形状评分器的**宿主接线**（qoder-research 0920 · RESEARCH-QUEUE P2）—— worker 与 server 共用这一份。
 * 为什么在宿主侧而不是 evo.js 里：装配本体 `duelAssembly` 的唯一真源在 `tools/v2v4-lib.mjs`（D107 守着
 * "1 席脚本 vs 4 席被测"只许一份实现）；evo.js 跑在 vm 沙箱里 import 不了 ESM ⇒ 由宿主把评分器
 * **注入沙箱全局** `__shapeScorer`，evo 只调用、不复制装配。
 * 口径（RESEARCH-LOG §12/§15/§19）：五行——`pickGunFocus` 聚焦枪手 · `pickBeadBurst` 珠爆发 · 真·场B 清场 ·
 * G5 防席夺冠取反 · **打龟穿透占比（N1，与第四行共用对局）**。前三行取 `dmgToScriptedPerGame / 4.0`（封顶 1）——
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
    /* 第四行 + 第五行共用这两次对局（**不加对局成本**）。第五行（N1 · DS 的实测诊断，本机复跑吻合：
     * 线上包打龟 7.3 次/局、穿透占 57% ⇒ 防席夺冠 7%；v7s8/s9-82 打龟 44.5 次/局、穿透仅 4.5~7.3%
     * ⇒ 夺冠 18~43% —— "攻击量大但全砸在免疫普攻的目标上"）。
     * 行分 = 穿透占比（/0.5 封顶，DS 预注册判据同点）× 参与度（打龟 ≥4 次/局才给满，
     * 封死"整局只出一发穿透刷 100%"的占比游戏）。第四行奖励**结果**（防席别夺冠），
     * 第五行奖励**手段**（打在龟身上的卡得是穿防卡）—— Q5~Q10 证明只有结果项时权重会
     * 把防御轴整体压掉（v7s9-82 墙 18.1→1.8）而不是教会"看目标换卡"。 */
    const turtleRow = function (r) {
      return Math.min(1, r.turtlePierceShare / 0.5) * Math.min(1, r.turtleAtkPerGame / 4);
    };
    const guardRows = function () {
      /* Q8 教训（v7s7-31：long G5 过、multi G5 仍 35%）：防龟能力**分模式**——行分必须与门禁一样
       * 两模式都量（G5 判 long+multi），否则训练只修 long、multi 留死角。 */
      const a = duelAssembly(deps, params, { games: G, mode: 'long', seed0: 90210, scripted: guardOnly });
      const b = duelAssembly(deps, params, { games: G, mode: 'multi', seed0: 90210, scripted: guardOnly });
      const pen = function (w) { return Math.max(0, 1 - Math.min(1, w / 25)); };
      return [(pen(a.winPct) + pen(b.winPct)) / 2, (turtleRow(a) + turtleRow(b)) / 2];
    };
    const [guardScore, turtleScore] = guardRows();
    return (one(B.pickGunFocus) + one(B.pickBeadBurst) + clearRow() + guardScore + turtleScore) / 5;
  };
}
