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
  /* 11-09（用户：考卷枪席太多、穿透太少，反弹被喂肥）⇒ 新增两个穿透型人格 */
  { name: 'swordspam', fn: 'pickSwordSpam' },
  { name: 'piercemix', fn: 'pickPierceMix' },
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
  { name: 'gunfocus', fn: 'pickGunFocus' },
  /* 10-02（用户裁定批 · 千问 `PROPOSAL-2026-10-02-econ-exam-tables.md` §2）：**经济轴的两根反向锚**。
   * 动机：§E226 体检 32,200 局 ⇒ 23 张桌里 `saver − spender` 在 21 张上是 0.0 vs 0.0，
   * 考场里**根本没有经济轴**；根因是 20/23 张桌的脚本对手打出 ≥4 费卡的比例≈0（没人攒到值得怕）。
   *   · `deadlineburst`（T‑死线）：前 `ECON_B=6` 回合只攒珠，第 6 回合起每回合**全额兑现并压领先者**；
   *   · `earlypressure`（T‑早压）：**从第 1 回合起**每回合全额兑现。
   * ⚠️ 两枚只差**一个自由量：花费时机**（选牌与目标规则逐字相同，见 `js/train/bots.js` 里这两枚的头注）。
   * ⚠️ **默认池不含它们**（`OPP_DEFAULT = OPP_SPECS.slice(0, 9)` ⇒ 追加在尾部不改任何既有协议），
   *   也只是**考场/评估**用的原型；要不要进进化池要等 §3 主判据结果再单独裁。 */
  { name: 'deadlineburst', fn: 'pickDeadlineBurst' },
  { name: 'earlypressure', fn: 'pickEarlyPressure' },
  /* v2.0.3（11-07 · DS）：补齐「`bots.js` 里有实现、OPP_SPECS 没登记」的几条 ——
   * 登记表缺一条，`--pool=all` 就少一个对手，而没人会发现（这正是 v1.3.59 / v1.4.8 / v1.4.14 那三次事故的形状）。 */
  { name: 'combocounter', fn: 'pickComboCounter' },
  { name: 'reflectmix', fn: 'pickReflectMix' },
  { name: 'reflecttank', fn: 'pickReflectTank' },
  { name: 'guardgun', fn: 'pickGuardGun' },
  { name: 'bigtfocus', fn: 'pickBigTFocus' },
  { name: 'killsecure', fn: 'pickKillSecure' },
  /* v2.0.3（11-07 · 用户提案）：**多人专用卡**的两条对手线。整池此前只有 `pickToolKit` 会碰
   * 双枪/镜面/全息 ⇒ 「4 人+ 专用卡」在考卷上零覆盖。这两条补镜面与双枪（全息仍只有 toolkit 会碰）。 */
  { name: 'mirrorspam', fn: 'pickMirrorSpam' },
  { name: 'dualspam', fn: 'pickDualSpam' },
  /* v2.0.3（11-07）：珠爆发线（2P 考卷第 20 席的同一条线），多人池此前未登记。 */
  { name: 'beadburst', fn: 'pickBeadBurst' }
];

/* 训练池的默认集合（名字数组）。默认**不含**四个 specialist —— 它们只在显式实验里按需加入
 * （`?opps=` / `EPIRUS_OPP_N`），这样默认基线不会被悄然改变。 */


/* ===== 四人数考卷池 EXAM_POOL（v2.0.3 · 2026-11-07 · 用户提案）=====
 * 为什么单独一张表：考试要的是「每根能力轴都有牙」，训练池要的是「覆盖得广」—— 两者会各自演化
 *   （`farmer` 已按用户 11-07 的话从本表剔除：纯攒不打对任何有攻击能力的包都≈100% 胜率 ⇒ 无信息席）。
 * 为什么 28 席：排程要对 4 种人数都「一整轮恰好每对手一次」⇒ K 必须能被 N−1 整除，
 *   N−1 = 1 / 2 / 4 / 7 ⇒ K 是 28 的倍数。28 是能同时覆盖 8 轴又满足整除的最小值。
 * 轴：压制(pressure) ‖ 墙(wall) ‖ 反弹/反制(reflect) ‖ 经济(econ) ‖ 爆发(burst) ‖ 混合(mix) ‖ 瞄准/地板(aim) ‖ 多人专用(multi)。
 * ⚠ 本表只放**名字**：函数名仍以 OPP_SPECS 为单一来源（`EXAM_FN` 从那里查，查不到当场抛错）。
 * `minN` = 该对手在几人局才有意义（镜面/双枪要 ≥3 人；其余 2 人局也合法，只是行为退化）。 */
export const EXAM_POOL = [
  { name: 'gunspam', axis: 'pressure', minN: 2 },
  { name: 'gunfocus', axis: 'pressure', minN: 2 },
  { name: 'swordspam', axis: 'pressure', minN: 2 },   /* 11-09 换下 aggro（49% 枪、与 gunspam 同型） */
  { name: 'earlypressure', axis: 'pressure', minN: 2 },
  { name: 'guardspam', axis: 'wall', minN: 2 },
  { name: 'wall', axis: 'wall', minN: 2 },
  { name: 'protowall', axis: 'wall', minN: 2 },
  { name: 'baguaspam', axis: 'wall', minN: 2 },
  { name: 'reflectspam', axis: 'reflect', minN: 2 },
  { name: 'reflecttank', axis: 'reflect', minN: 2 },
  { name: 'antidef', axis: 'reflect', minN: 2 },
  { name: 'combocounter', axis: 'reflect', minN: 2 },
  { name: 'deepsaver', axis: 'econ', minN: 2 },
  { name: 'ringspam', axis: 'econ', minN: 2 },
  { name: 'beadburst', axis: 'econ', minN: 2 },
  { name: 'heavyfire', axis: 'burst', minN: 2 },
  { name: 'bigtfocus', axis: 'burst', minN: 2 },
  { name: 'deadlineburst', axis: 'burst', minN: 2 },
  { name: 'killsecure', axis: 'burst', minN: 2 },
  { name: 'mix', axis: 'mix', minN: 2 },
  { name: 'reflectmix', axis: 'mix', minN: 2 },
  { name: 'guardgun', axis: 'mix', minN: 2 },
  { name: 'piercemix', axis: 'pressure', minN: 2 },   /* 11-09 换下 balanced（49% 枪、无第二轴） */
  { name: 'targeter', axis: 'aim', minN: 2 },
  { name: 'snipespam', axis: 'aim', minN: 2 },
  { name: 'random', axis: 'aim', minN: 2 },
  { name: 'mirrorspam', axis: 'multi', minN: 3 },
  { name: 'dualspam', axis: 'multi', minN: 3 }
];
/* ===== 考卷池版本（11-09 晚补 · Qoder）=====
 * 病：`469dfdb1` 把上面这份 28 席就地换名（aggro→swordspam、balanced→piercemix，且后者从 mix 轴挪进 pressure 轴），
 *   而在册条款 `docs/POOL-CONTRACT.md §1` 明写「EXAM_POOL 一个不动（它现在是尺；动了 X̄₄ 跨批不可比）」，
 *   exam 的输出里又没有池版本 ⇒ 从那之后的每一条 X̄₄ 与图上 900+ 枚历史读数**不是同一把尺**，收据上却看不出来。
 * 这里不评判该不该换（用户 11-09 裁 A 授权改考卷），只补两件最低要求：**v1 可复算** ‖ **用的哪把可读出**。
 *   v1 = 换席前那 28 席（其余 26 席与顺序逐字不动，两个替换点各自还原名字与轴）
 *   v2 = 现在这份 = **默认** ⇒ 任何现有调用方（含 `server/train-server.mjs`）行为一字不变。 */
const EXAM_V1_BACK = { swordspam: { name: 'aggro', axis: 'pressure' }, piercemix: { name: 'balanced', axis: 'mix' } };
export const EXAM_POOL_V1 = EXAM_POOL.map(function (e) {
  const b = EXAM_V1_BACK[e.name];
  return b ? { name: b.name, axis: b.axis, minN: e.minN } : e;
});
export const EXAM_POOL_VERSIONS = ['v1', 'v2'];
export function examPool(version) {
  const v = (version == null || version === '') ? 'v2' : String(version);
  if (v === 'v2') return EXAM_POOL;
  if (v === 'v1') return EXAM_POOL_V1;
  throw new Error('examPool: --expool 只认 ' + EXAM_POOL_VERSIONS.join('/') + '，收到 ' + JSON.stringify(version));
}
/* 名字 → 函数名 的查表（单一来源 OPP_SPECS；查不到 ⇒ 抛错，不静默跳过）。 */
export const EXAM_FN = (function () {
  const byName = {};
  for (const o of OPP_SPECS) byName[o.name] = o.fn;
  for (const e of EXAM_POOL) if (!byName[e.name]) throw new Error('EXAM_POOL 里的 ' + e.name + ' 没有在 OPP_SPECS 登记（加名字漏一处是本仓的老事故）');
  return byName;
})();

export const OPP_DEFAULT = OPP_SPECS.slice(0, 9).map(function (o) { return o.name; });

/* 名字 → 函数名（server 用） */
export const OPP_FN = (function () {
  const m = {};
  for (const o of OPP_SPECS) m[o.name] = o.fn;
  return m;
})();
