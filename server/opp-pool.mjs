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
  /* v1.4.14：聚能环经济流（用户指出小雷的反制目标是它）。**这是第三次"加名字漏一处"**：
   * v1.3.59 只补 worker、v1.4.8 只补 server、v1.4.14 只补了 eval-5p 而漏了这里 ⇒
   * 服务端拿到未定义的名字、`B[undefined]` 变成 undefined，训练跑到一半才报 `sel is not a function`。 */
  { name: 'ringspam', fn: 'pickRingSpam' }
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
