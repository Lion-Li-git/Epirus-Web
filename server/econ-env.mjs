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
  'EPIRUS_DIV_W', 'EPIRUS_DIV_K', 'EPIRUS_DIV_CATW', 'EPIRUS_DIV_FORCE_GENS', 'EPIRUS_WALL_FILTER', 'EPIRUS_WALL_GAMES'];

/* 与 `js/train/evo.js` 的 `setEconomyReward(o)` / `economyReward()` 字段名对齐
 * （D77 拿这份去比"读到的键"与"setter 认的键"，漏一个就红）。 */
export const ECON_REWARD_KEYS = ['target', 'cap', 'divW', 'divK', 'divCatW', 'divForceGens', 'wallFilter', 'wallGames'];

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
    divCatW: nv(e.EPIRUS_DIV_CATW),   // v1.5.92：类间（跨角色）广度的权重；不设 ⇒ 0 ⇒ 逐位等于旧口径
    divForceGens: nv(e.EPIRUS_DIV_FORCE_GENS),
    /* 破墙过滤只在**显式 ='1'** 时打开（与改动前 train-server 的判定逐字一致：
     * '0' / 'true' / 空串都不是"开" ⇒ 不与历史臂的语义漂移）。 */
    wallFilter: e.EPIRUS_WALL_FILTER === '1' ? true : null,
    wallGames: nv(e.EPIRUS_WALL_GAMES)
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
