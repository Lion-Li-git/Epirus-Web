/* 墙上时钟上限的语义（**单一来源** · v1.5.200）
 *
 * ## 病（实测）
 * `server/train-server.mjs` 里两处（2P 的 `runTrain` 与 N 人的 `runTrainN`）写的是：
 *     const cap = Number(process.env.EPIRUS_WALL_MS == null ? 1800000 : Number(process.env.EPIRUS_WALL_MS));
 *     if (Date.now() - t0 > cap) { ...超时中止... }
 * 而紧挨着的注释（`:247` / `:476`）写的是「**`EPIRUS_WALL_MS=0` 关闭**（纯按代数收敛）」。
 * **两处判定都没有 `cap > 0` 这一半** ⇒ `EPIRUS_WALL_MS=0` 的第一次检查就成立，
 * 训练**当场中止**并报「训练超时上限（30 分钟）」—— 与它自己的注释**正好相反**。
 * （我是拿这个键去关上限时被它打成两轮空炮才发现的；注释与实现不一致时，读代码的人会信注释。）
 *
 * 本模块把语义收成一个纯函数，门直接喂合成值即可判，不必真等 30 分钟。
 */

/** 上限是否已经超了。`cap <= 0`（含 0、NaN、负）⇒ **关闭**，永远不超。 */
export function wallCapExceeded(cap, elapsedMs) {
  const c = Number(cap);
  if (!isFinite(c) || c <= 0) return false;
  return Number(elapsedMs) > c;
}

/** 从 env 读上限（缺省 30 分钟）。与 `wallCapExceeded` 同源，避免两处各写一遍默认值。 */
export function wallCapOf(env) {
  const raw = env && env.EPIRUS_WALL_MS;
  return (raw == null || raw === '') ? 1800000 : Number(raw);
}
