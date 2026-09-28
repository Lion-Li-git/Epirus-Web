/* ============================================================================
 * bot-chooser-lib.mjs —— 把"脚本 bot（返回一个键或 {key,target}）"包成引擎要的 chooser，**单一来源**。
 *
 * 为什么单独一个文件：这段规则此前已经有两份完全同构的实现 ——
 *   · `js/train/evo.js` 的 `wrapBotN`（训练/对局里给脚本用的那份，v1.3.55 修好了目标语义）
 *   · `tools/eval-5p.mjs` 的 `asChooser`（评测里**故意独立实现**的一份，注释写明"避免评测反过来依赖被测代码"）
 * 现在是第三处使用方（`tools/probe-5p-envfit.mjs`，§E142 的 5P 环境矩阵）。
 * ⚠ 但"故意再抄一份"的代价是：**两份漂移时，评测与训练看到的对手就不是同一种对手**。
 *   §E142 要算的是 `oracle − best_single`（按环境换包的上界），它只在"33 个原型都用同一套对手规则"时才有意义
 *   ⇒ 所以这里把 eval-5p 那一份**原样搬过来**当唯一来源，eval-5p 改成 import（行为逐字不变，由门 D200 用"改动前后 stdout 逐字相同"钉住）。
 *
 * 规则本身（与 eval-5p 里那条注释同）：**保留脚本自己选的目标**，只有脚本没给目标时才回落到 `pickTargetN/pickTarget2N`。
 * ==========================================================================*/

/** deps = { T: EpirusTrainer, R: EpirusRules } —— 由调用方从自己的沙箱里传进来（探针与评测各有各的 vm 沙箱） */
export function makeAsChooser(deps) {
  const T = deps.T, R = deps.R;
  if (!T || typeof T.pickTargetN !== 'function' || !R || !R.SK) {
    throw new Error('makeAsChooser 需要 {T: EpirusTrainer, R: EpirusRules}（缺 pickTargetN 或 R.SK）');
  }
  return function asChooser(fn) {
    return function (state, pid, legal) {
      const k = fn(state, pid, legal);
      const key = (typeof k === 'string') ? k : (k && k.key);
      if (key == null) return { key: R.SK.JI, target: null, target2: null };
      const obj = (typeof k === 'object' && k) ? k : null;
      const t1 = (obj && obj.target != null) ? obj.target : T.pickTargetN(state, pid, key);
      const t2 = (obj && obj.target2 != null) ? obj.target2 : T.pickTarget2N(state, pid, key, t1);
      return { key: key, target: t1, target2: t2 };
    };
  };
}
