/* Epirus 训练奖励覆盖（反摆烂）env 的**单一来源** —— v1.5.18。
 *
 * 为什么要有它（第三方复核 §5-3）：这三个 env（哨声惩罚 / 出手权重 / 先手激励）此前在
 * `train-server.mjs` 与 `train-worker.mjs` **各写一遍**，于是"服务端判 `whistlePen || dealW`、
 * worker 判三个都判"这种不一致长期存活：只设 `EPIRUS_FIGHT_FIRST` 时 **worker 开、主线程不开**
 * ⇒ 产物静默少一份适应度，而日志完全正常（"半开"事故同型，与 v1.5.0 的 mode 半开是同一类）。
 * 历史两轮 fstA/fstB 因为同时设了 dealW 才侥幸没暴露。
 *
 * 现在"哪些 env 属于这一组"（`FIGHT_ENV_KEYS`）与"要不要覆写"（`hasFightOverride`）都只有**一份**实现
 * ⇒ 两端不可能再分叉；服务端的 worker 回执自检是第二道网（见 `train-server.mjs`）。
 *
 * 规矩：`EPIRUS_FIGHT_*` 只允许在本文件里被读（`tools/np-test.mjs` 的 D24 盯着这条）。
 * 与 `server/opp-pool.mjs`（对手池单一来源）、`server/opp-champs.mjs`（名字→函数单一入口）同一套规矩。
 */
export const FIGHT_ENV_KEYS = ['EPIRUS_FIGHT_WHISTLE', 'EPIRUS_FIGHT_DEAL', 'EPIRUS_FIGHT_FIRST'];
/* 与 `js/train/evo.js` 的 `setFightReward(o)` / `fightReward()` 的字段名对齐（回执自检按这份比）。 */
export const FIGHT_REWARD_KEYS = ['whistlePen', 'dealW', 'firstW'];

/* 读 env ⇒ `setFightReward` 的入参形状。未设的键一律 null（不参与覆盖）。
 * 注意用 ES5 写法（不用 `??` / `?.`）：这套代码同时要在 vm 沙箱与旧 Node 里跑。 */
export function readFightEnv(env) {
  const e = env || {};
  return {
    whistlePen: e.EPIRUS_FIGHT_WHISTLE != null ? e.EPIRUS_FIGHT_WHISTLE : null,
    dealW: e.EPIRUS_FIGHT_DEAL != null ? e.EPIRUS_FIGHT_DEAL : null,
    firstW: e.EPIRUS_FIGHT_FIRST != null ? e.EPIRUS_FIGHT_FIRST : null
  };
}

/* 至少要设了一个键才去覆写（否则保持 `evo.js` 的代码默认值）。 */
export function hasFightOverride(o) {
  return !!o && FIGHT_REWARD_KEYS.some(function (k) { return o[k] != null; });
}
