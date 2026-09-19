/* Epirus 多人训练对手池的**单一来源**（v1.4.9）。
 *
 * 为什么单独抽一个文件：原先 server 的 `BOT_FN_N`（名字→函数名字符串）与
 * worker 的 `OPP_POOL`（名字→函数引用）**各写了一遍**，于是两处会静默漂移。
 * 这个坑已经踩过两次：
 *   · v1.3.59 加 tankline/heavyfire/deepsaver 时只补了 worker（漏 server ⇒ 未知名字）；
 *   · v1.4.8 加 reflectspam 时只补了 server（漏 worker ⇒ worker 的 filter **静默取子集**，
 *     "13 对手"的臂实际只跑 12 个，A/B 退化成同一个实验，且告警只写进隐藏 server 的 stderr）。
 * 现在两处都从这里派生 ⇒ 加名字只改一个地方。
 *
 * `fn` 是 `EpirusBots` 上的函数名：
 *   · server 用 `B[BOT_FN_N[nm]]` 取；
 *   · worker 用 `{ name, sel: B[o.fn] }` 取。
 */
export const OPP_SPECS = [
  { name: 'random', fn: 'pickRandom' },
  { name: 'balanced', fn: 'pickBalanced' },
  { name: 'aggro', fn: 'pickAggro' },
  { name: 'defend', fn: 'pickDefend' },
  { name: 'wall', fn: 'pickWall' },
  { name: 'antidef', fn: 'pickAntiDef' },
  { name: 'breakdef', fn: 'pickBreakDef' },
  { name: 'mix', fn: 'pickMix' },
  { name: 'farmer', fn: 'pickFarmer' },
  /* v1.3.59：坦克流 / 重火力 / 深经济（原先池里既无坦克流也无深经济对手） */
  { name: 'tankline', fn: 'pickTankLine' },
  { name: 'heavyfire', fn: 'pickHeavyFire' },
  { name: 'deepsaver', fn: 'pickDeepSaver' },
  /* v1.4.8：单一防御 specialists。v1.3.22 曾以"有效技能数=1.00 / 1st=0%"为由整体剔除 ——
   * 那是按"像不像一个像样的对手/人格"审计的；但训练池该问"它能不能暴露冠军的洞"。
   * 我方复验：冠军 v1.3.58 对 4×反弹墙 1st=0.0%（每局被自己的枪弹回 3.00 次 = 恰好 3 血上限），
   * 而对 4×防御/八卦/原型墙都是 100.0% ⇒ **只有反弹是真洞**，其余三个只留名字供实验用。 */
  { name: 'reflectspam', fn: 'pickReflectSpam' },
  { name: 'guardspam', fn: 'pickGuardSpam' },
  { name: 'baguaspam', fn: 'pickBaguaSpam' },
  { name: 'protowall', fn: 'pickProtoWall' },
  { name: 'protomine', fn: 'pickProtoMine' },
  { name: 'prototransfer', fn: 'pickProtoTransfer' },
  /* v1.4.14：聚能环经济流（用户指出小雷的反制目标是它）。**这是第三次"加名字漏一处"**：
   * v1.3.59 只补 worker、v1.4.8 只补 server、v1.4.14 只补了 eval-5p 而漏了这里 ⇒
   * 服务端拿到未定义的名字、`B[undefined]` 变成 undefined，训练跑到一半才报 `sel is not a function`。 */
  { name: 'ringspam', fn: 'pickRingSpam' },
  /* v1.5.71（第五轮复核 §4-1）：**会瞄人的对手**。此前池子里没有任何对手会瞄准特定的人
   * （脚本走 pickTargetN = 击杀优先 → 血量最高，而"满血又不出头的狙击手"永远进不了任何人的候选集），
   * 于是"靶向"类能力在训练里拿不到梯度 —— 复核的反向验证：给 4 席对手加一条"谁用狙击就瞄谁"
   * 的规则，候选 v17-146 的夺冠率立刻 30% → 0%。这一个对手同时给三件事提供梯度
   * （反狙击 / 反环 / 主动清场），见 js/train/bots.js 的 `pickTargeter`。 */
  { name: 'targeter', fn: 'pickTargeter' },
  /* v1.5.71（第五轮复核 §4-2）：4 席狙击专精 = **狙击场探针**的威胁源（默认池不含它）。
   * 复核把"狙击无解"证伪了：任何带攻击效果技能指过来就能让狙击无效（1 ジ 的枪就够）——
   * 它之所以在旧池里显得无敌，正是因为**没人会瞄人**。登记在这里是为了让实验臂能按需加入。 */
  { name: 'snipespam', fn: 'pickSnipeSpam' },
  /* v1.5.90（第八轮复核 §6 / §8-3）：**压制密度**对手 —— 1 ジ 的枪、打血量最高者。
   * 复核实测：这一行代码在长程把线上冠军打死 **65%**，四包里没有一包顶得住；
   * 机制**不是**集火而是 **overkill 浪费 + 输出密度**（冠军 57~65% 的回合在按ジ、ep 峰值只有 2
   * ⇒ "交 tempo 税去攒一种永远花不掉的东西"）。池里没有这种压迫 ⇒ 训练里低密度不受罚
   * ⇒ 这条线一直没有梯度（动机同 `pickTargeter`）。**默认池不含它**，只在显式实验里按需加入。 */
  { name: 'gunspam', fn: 'pickGunSpam' },
  /* v1.5.133：**聚焦枪手** —— G4 那格（`gate-drafts.mjs:222` 的「只枪」）的**同一个口径**写成人格：
   * 击杀优先 → 再压血量最高者（`pT` → `T.pickTargetN`）。与上面的 `gunspam`（只打最肥）**不是**同一条线：
   * 实测同一个 G4 harness 里 `gunspam` 是 83%/77%，**比 G4 那格（75%/62%）更狠** ⇒ 池里不是"没有枪线"。
   * 加它是为了做**池子单杠杆**的受控 A/B（假设 = "缺的是**枪在聚我**这个压力"）；⚠️ 跑之前已写下
   * **预注册预测：很可能不动 G4**（训练局是 1 席候选 vs 4 席对手 ⇒ 枪的目标里只有 ~1/4 是候选；
   * 考卷是 4 席家族 vs 1 席枪手 ⇒ 子弹全落在我家），理由详见 `js/train/bots.js` 里本函数的头注。
   * **默认池不含它**（`OPP_DEFAULT` 取前 9 条 ⇒ 追加在尾部不会改变任何既有协议）。 */
  { name: 'gunfocus', fn: 'pickGunFocus' }
];

/* 训练池的默认集合（名字数组）。默认**不含**四个 specialist —— 它们只在显式实验里按需加入
 * （`?opps=` / `EPIRUS_OPP_N`），这样默认基线不会被悄然改变。 */
export const OPP_DEFAULT = OPP_SPECS.slice(0, 9).map(function (o) { return o.name; });

/* 名字 → 函数名（server 用） */
export const OPP_FN = (function () {
  const m = {};
  for (const o of OPP_SPECS) m[o.name] = o.fn;
  return m;
})();
