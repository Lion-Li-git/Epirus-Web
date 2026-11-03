/* G4 `--force` 越线例外的**判定单一来源**（v1.5.202）
 *
 * ## 为什么抽出来
 * 这段判定原先只活在 `tools/np-test.mjs` 的 D67 里，而它是被 `refPassG4` **短路**的：
 * 只要在位包的 G4 有一个模式 PASS（现在的常态），`implOk`/`g4recOk` **永远不会被求值**。
 * 也就是说它的**第一次真正运行**，会发生在"正要发一只过不了门的冠军"的那次提交里 ——
 * 那是最不能出错的时刻，却也是这段代码唯一没被验证过的时刻。
 * ⇒ 抽成纯函数后，门（D146）可以用**合成 meta** 把六种组合逐一跑一遍。
 *
 * ## 语义（一个字都没改，只是搬了位置）
 * 认一条例外的条件是**四者齐全**：
 *   ① `forced === true`（真做过 `--force`）；
 *   ② **口径 id 相等**（`pool`）—— 克制表键序或阈值变过 ⇒ 旧例外当场失效；
 *   ③ **实现身份**匹配 —— `g4rec.impl` 有就用它比；没有（例外记于"实现身份"发明之前）则只认
 *      **冻结豁免**：当前实现必须仍等于 v1.5.134 那一版（`caecc92f`），谁改了一格豁免就作废；
 *   ④ 带上**被放过的具体行**（`lines` 非空且第一行是 `G4[`）—— 否则例外就变成"记了账但不知道记了什么"。
 */

/** 冻结豁免：在位包的留痕记于"实现身份"（G4IMPL）发明之前 ⇒ 仅当当前实现仍是这一版时放行。
 *  ⚠️ 这是一个**一次性迁移垫脚**，不是永久通道：任何一格 chooser 的实现变了，这个 id 就变，豁免随之作废。 */
export const G4IMPL_AT_EXCEPTION = 'caecc92f';

/** 这条 `--force` 例外是否**完整且口径匹配**。`curImpl` 可为 null（读不出 G4IMPL 时不认例外）。 */
export function g4ExceptionOk(curImpl, curPool, g4rec) {
  if (!g4rec || typeof g4rec !== 'object') return false;
  const implOk = !!(curImpl && (g4rec.impl != null ? g4rec.impl === curImpl : curImpl === G4IMPL_AT_EXCEPTION));
  return !!(g4rec.forced === true && curPool && g4rec.pool === curPool &&
    Array.isArray(g4rec.lines) && g4rec.lines.length > 0 &&
    /^G4\[/.test(String(g4rec.lines[0])) && implOk);
}
