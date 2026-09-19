/* Epirus 训练"经济 / 熵奖励"覆盖 env 的**单一来源** —— v1.5.89。
 *
 * 为什么要有它（第八轮第三方复核 §2，[实测 + 代码事实]）：
 * 这一组 env 此前**内联**写在 `train-server.mjs`（原 :337-340），但 fitness 是在
 * **16 个 worker 线程**里算的，而 `server/train-worker.mjs` 只读了
 * `EPIRUS_ECO_TARGET / EPIRUS_ECO_CAP / EPIRUS_ECO_DIVW` 三个名字
 * ⇒ `EPIRUS_DIV_W / EPIRUS_DIV_K / EPIRUS_DIV_FORCE_GENS / EPIRUS_WALL_FILTER`
 * **只落在服务进程自己那份模块上**，worker 里仍是代码默认值：
 *   - 日志完全正常（`[eco] 生效值` 打的是被覆盖后的值）；
 *   - 臂 K（`EPIRUS_DIV_W=0.3`）与臂甲（退火强迫 60 代 + 破墙硬过滤）的 A/B 实际是 **A/A**
 *     ⇒ 这两条臂的全部读数作废（CHANGELOG 附录 D/E/F/G 与 HANDOFF §5.4 的相应结论要跟着降级）。
 * 这是"开关看着接上了，实际作用在没跑的那条路径上"这一族的第 N 次：
 * 同族 = v1.5.18 修掉的 `EPIRUS_FIGHT_*` 静默半开（D24 盯着）、对手池两份清单（D7/D72）、
 * v1.5.79 的 `TGT_W` 空发、v1.5.68 的 `mirDec>=3` 永不满足。
 *
 * 修法不是"在 worker 里再补一份解析"（那正是它第二次犯错的方式），而是**单一来源**：
 * 哪些 env 属于这一组、值怎么解析，只在**本文件**里有一份实现 ⇒ 两端结构上不可能再分叉。
 * 第二道网是 worker 的 `[econ] worker 生效值` 回执（见 `train-worker.mjs`），
 * 第三道网是门禁 **D77**（扫描"是否还有第二处读取点"+ "读到的键 setter 是否都认"）。
 *
 * 规矩：`EPIRUS_DIV_* / EPIRUS_WALL_* / EPIRUS_ECO_*` 只允许在本文件里被读。
 * 用 ES5 写法（不用 `??` / `?.`）：这套代码同时要在 vm 沙箱与旧 Node 里跑。
 */

/* 本组覆盖涉及的全部 env 名。旧名 `EPIRUS_ECO_DIVW`（历史臂的启动命令用它）与新名
 * `EPIRUS_DIV_W` 并存：两个都设时**新名优先**（新名是文档口径，旧名只为让老命令仍可复现）。 */
export const ECON_ENV_KEYS = ['EPIRUS_ECO_TARGET', 'EPIRUS_ECO_CAP', 'EPIRUS_ECO_DIVW',
  'EPIRUS_DIV_W', 'EPIRUS_DIV_K', 'EPIRUS_DIV_ROLEW', 'EPIRUS_DIV_CATW', 'EPIRUS_DIV_FORCE_GENS', 'EPIRUS_WALL_FILTER', 'EPIRUS_WALL_GAMES',
  /* v1.5.116（第十二轮复核 L2′）：经济 shaping 去阶梯化的三个开关。同样必须走这条单一来源 ——
   * 否则又会落到"服务进程自己那份模块上、16 个 worker 仍是代码默认值"那个事故形状（附录 D 臂 K 的 A/A）。 */
  'EPIRUS_HOARD_LEFTOVER', 'EPIRUS_CONV_RATIO', 'EPIRUS_HOARD_CAP_MULT',
  /* 攒钱奖励的**上限**（对应 evo.js 里的 `STOCK_BONUS`）。为什么也要能开：实测两包的病方向**相反**
   * （`tools/probe-leftover.mjs`：线上包 multi 兑现率 94%、余 ep/人 0.9、峰 ep 2；arm A 兑现率 23%、余 23.2）
   * ⇒ 余款惩罚对在位包是空操作（它没余款可罚，它是"攒不到就花光"）。给它开一臂：把 0.05 抬到 0.15，
   *    直接检验"**奖惩不对称**才是环学不出来的阻力"这条假设（否则这句话永远只是评论）。 */
  'EPIRUS_STOCK_BONUS', 'EPIRUS_CONV_OFFENSE',
  /* v1.5.121（第十三轮复核 §23 的 **E4**）：**挡下伤害**的奖励权重。
   * 为什么必须有这一条：防御族**费用 0 ep** ⇒ 不需要多回合计划 ⇒ 是"shaping 只在 0.0X 尺度、
   * 买不动多回合计划"这条限制唯一还可能绕过的方向。走这条单一来源 ⇒ 服务端与 16 个 worker 同时生效。 */
  'EPIRUS_BLOCK_W',
  /* v1.5.124（复核 §28a 的处方 (ii)）：**把"广度"从门槛升格为收益项**的权重。
   * 病：`DIV_W=0.06` 在胜率项前没有梯度，而 `G≥3` 只是事后砍窄包（无筛选种群 G 中位 2.4）⇒ 门槛不生产宽包。
   * 形状：按**绝对**有效技能数（`coverageEntropy` 的 exp(H)）从 G=3 到 G=6 线性给钱 ⇒ 刷不动。 */
  'EPIRUS_WIDTH_W',
  /* v1.5.126（**用户洞察**）：**贵卡出手**的奖励权重 —— "这个包不会用电磁炮/大雷、也丢了地雷/净化 ⇒
   * 它当然没必要攒 ep"。贵卡由**声明字段**推导（`cost ≥ 3` 或 `energyNeeds`），不写卡名清单。 */
  'EPIRUS_BIGCARD_W',
  /* qoder-research 0920（RESEARCH-LOG §5b · HANDOFF §4-2 候选①）：**环奖励权重**（`evo.js` 的 `RING_W`，
   * 出厂 0.10）接进单一来源 ⇒ 臂上可开"贵卡 + 环"同抬的配方，找那个"既打环又会花贵卡"的合格包。
   * 不设 ⇒ 逐字不变。 */
  'EPIRUS_RING_W'];

/* 与 `js/train/evo.js` 的 `setEconomyReward(o)` / `economyReward()` 字段名对齐
 * （D77 拿这份去比"读到的键"与"setter 认的键"，漏一个就红）。 */
export const ECON_REWARD_KEYS = ['target', 'cap', 'divW', 'divK', 'divRoleW', 'divCatW', 'divForceGens', 'wallFilter', 'wallGames',
  'hoardOnLeftover', 'convRatio', 'convOffense', 'hoardCapMult', 'stockBonus',
  'blockW', 'widthW', 'bigcardW', 'ringW'];   // v1.5.121 E4 / v1.5.124 §28a / v1.5.126 贵卡 / 0920 qoder 环权重（与 setter 逐字对齐 ⇒ D77 盯得住）

/* "未设"与"设成空串"都算**未设**：`EPIRUS_DIV_W=` 不能被当成 divW=0 这个真实取值
 * （旧代码用 `!= null`，空串会静默变成 0 ⇒ 一个手滑的启动命令就能改掉训练口径）。
 * 注意 `EPIRUS_DIV_W=0` / `EPIRUS_WALL_FILTER=0` 是**设过**（字符串 '0' 非空）。 */
function nv(v) { return v == null || v === '' ? null : v; }

/* 读 env ⇒ `setEconomyReward` 的入参形状。未设的键一律 null（不参与覆盖）。 */
export function readEconEnv(env) {
  const e = env || {};
  const newDivW = nv(e.EPIRUS_DIV_W);
  return {
    target: nv(e.EPIRUS_ECO_TARGET),
    cap: nv(e.EPIRUS_ECO_CAP),
    /* 新名优先；旧名兜底。两者都是字符串，数值化由 evo.js 的 setter 负责（与历史一致）。 */
    divW: newDivW != null ? newDivW : nv(e.EPIRUS_ECO_DIVW),
    divK: nv(e.EPIRUS_DIV_K),
    /* v1.5.93：`divRoleW` 是按**8 个功能角色**的新口径；`divCatW` 是 v1.5.92 按 4 个 `cat` 的旧名
     * （旧名仍可用，evo.js 的 setter 里新名优先）。不设任何一个 ⇒ 0 ⇒ 逐位等于旧口径。 */
    divRoleW: nv(e.EPIRUS_DIV_ROLEW), divCatW: nv(e.EPIRUS_DIV_CATW),
    divForceGens: nv(e.EPIRUS_DIV_FORCE_GENS),
    /* 破墙过滤只在**显式 ='1'** 时打开（与改动前 train-server 的判定逐字一致：
     * '0' / 'true' / 空串都不是"开" ⇒ 不与历史臂的语义漂移）。 */
    wallFilter: e.EPIRUS_WALL_FILTER === '1' ? true : null,
    wallGames: nv(e.EPIRUS_WALL_GAMES),
    /* ===== v1.5.116（第十二轮复核 L2′）：三个"把阶梯换成斜率"的开关，**默认全关 ⇒ 出厂行为一字不变** =====
     * `HOARD_LEFTOVER`：囤积惩罚的自变量从 `maxEp`（本局最高 ep）换成**终局余款**。
     *   病：`evo.js:986` 取的是 `econ.rec.maxEp` ⇒ "攒到 40 花光赢下来"和"攥着 40 点被打死"**拿同一个罚分**。
     *   实测（multi·24 快照/12 局·n=144）：对照峰 ep 39.9（胜 8.3%）与环×8 峰 ep 21.3（胜 27.1%）
     *   都过 `2C=20` 的夹住点 ⇒ **两项同为 −0.070**，这一项既分不开好坏也谈不上方向。
     * `CONV_RATIO`：`conv` 从"2 次大件封顶"改成比率 `已花 ep / 已获得 ep`（天然 0~1、任何规模都有梯度、
     *   且不奖励"刷次数"）。实测各臂"累计出手"从 1.2 到 5.5 横跨 4 倍，**奖励只体现在前 2 次**。
     * `HOARD_CAP_MULT`：饱和点 `C×mult`（默认 2 ⇒ 与现状逐位相同；臂上试 4 让 40~100 区间重新有斜率）。 */
    hoardOnLeftover: e.EPIRUS_HOARD_LEFTOVER === '1' ? true : null,
    convRatio: e.EPIRUS_CONV_RATIO === '1' ? true : null,
    hoardCapMult: nv(e.EPIRUS_HOARD_CAP_MULT),
    stockBonus: nv(e.EPIRUS_STOCK_BONUS),
    convOffense: e.EPIRUS_CONV_OFFENSE === '1' ? true : null,
    /* v1.5.121（E4）：挡下伤害的权重（0 = 关 ⇒ 出厂行为一字不变）。 */
    blockW: nv(e.EPIRUS_BLOCK_W),
    /* v1.5.124（§28a）：广度收益项的权重（0 = 关 ⇒ 出厂行为一字不变）。 */
    widthW: nv(e.EPIRUS_WIDTH_W),
    /* v1.5.126（用户洞察）：贵卡出手的权重（0 = 关 ⇒ 出厂行为一字不变）。 */
    bigcardW: nv(e.EPIRUS_BIGCARD_W),
    /* 0920 qoder：环奖励权重（不设 ⇒ null ⇒ evo 原样 0.10）。 */
    ringW: nv(e.EPIRUS_RING_W)
  };
}

/* 至少要设了一个键才去覆写（否则保持 `evo.js` 的代码默认值 ⇒ 不设 env 时出厂行为一字不变）。 */
export function hasEconOverride(o) {
  return !!o && ECON_REWARD_KEYS.some(function (k) { return o[k] != null; });
}

/* 回执：只回显"被设了的键"（不 dump 整个 env —— 里面有无辜变量，日志会变得不可读）。
 * 用途：① 两端的 `[econ] ... 生效值` 自检；② 产物 meta 的 `ecoOverride`（可追溯"这一臂到底开了什么"）。 */
export function econEcho(o) {
  const out = {};
  ECON_REWARD_KEYS.forEach(function (k) { if (o && o[k] != null) out[k] = o[k]; });
  return out;
}
