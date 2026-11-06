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
export function makeAsChooser(deps) {  const T = deps.T, R = deps.R;
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

/* ============================================================================
 * §E262（用户 10-03 指令）：`ep≥门槛` 时把大雷在探索里提前，**并且挑一个"该打的人"**。
 * 这函数只管后半句（选点规则），**纯函数**：不读随机流、不碰 state、不 import 引擎 ——
 * 为什么单独抽出来（本仓第 十九 条的教训）：目标规则如果只在真局里测，"打谁"这件事在 6 局小样本里可能一次都不分 ⇒
 * 门要喂**合成 state**（谁 ep 高 / 谁有珠 / 谁血少 / 谁被大家盯着）逐条钉，翻一个比较号就得红。
 *
 * rule 语义（都只在**存活对手**里选，`S.opponentsOf` 那份判定由调用方给好的 pool 传进来）：
 *   net    = 不由本函数决定（返回 null ⇒ 调用方回落到引擎默认的 `pickTargetN`/网络选点）
 *   threat = 最可能发动进攻的人 = **ep 最高**（钱多下一手就打得出来），平手退 lowhp
 *   bead   = 正在攒环/珠的人 = `elec+boom` 最高，平手退 threat
 *   lowhp  = 被集火过/最容易收掉的人 = **hp 最低**（大雷 2 点伤害 ⇒ 血≤2 直接减员）
 *   focus  = 被别人盯得最多的人 = 出现在各家 `tauntBy` 义务名单里的次数最多（引擎里现成的"谁在被迫打谁"信号），平手退 threat
 * ⚠ 平手一律按**座位号小的先出**（不做随机、不做"先到先得于遍历序"）⇒ 平手偏向是可复现的，也是可被审计的（§E215 那一族）。
 */
export function pushTarget(pool, state, rule) {
  if (!Array.isArray(pool) || !pool.length) return null;
  if (rule == null || rule === 'net') return null;
  const p = (state && state.p) ? state.p : null;
  if (!p) return null;
  const hp = i => (typeof p[i].hp === 'number' ? p[i].hp : 0);
  const ep = i => (typeof p[i].ep === 'number' ? p[i].ep : 0);
  const bd = i => (p[i].elec || 0) + (p[i].boom || 0);
  /* 被盯次数：各家 `tauntBy`（v1.5.138 的义务名单，缺字段时用 pending）里出现 i 的次数 */
  const watch = i => {
    let n = 0;
    for (let j = 0; j < p.length; j++) {
      if (j === i) continue;
      const tb = p[j].tauntBy || p[j].tauntByPending;
      if (Array.isArray(tb) && tb.indexOf(i) >= 0) n++;
    }
    return n;
  };
  /* 每条规则 = 一串**判据**（前面的判据平手才轮到后面的），最后一定落到"座位号小的先" ⇒ 全序、可复现。
   * sign=+1 越大越优先；sign=-1 越小越优先。 */
  const CRIT = {
    threat: [[ep, 1], [hp, -1]],
    bead: [[bd, 1], [ep, 1], [hp, -1]],
    lowhp: [[hp, -1], [ep, 1]],
    focus: [[watch, 1], [ep, 1], [hp, -1]]
  };
  const crit = CRIT[rule];
  if (!crit) throw new Error('pushTarget: 不认识的目标规则 `' + rule + '`（可选 net|threat|bead|lowhp|focus）');
  const sorted = pool.slice().sort(function (a, b) {
    for (const c of crit) {
      /* 比较号方向：sign=+1 ⇒ 值大的先（要 `b-a`）；sign=-1 ⇒ 值小的先（要 `a-b`）。
       * ⚠ 这里第一次写反了（`(f(a)-f(b))*sign` ⇒ 四条规则**全部选中"最不该打的那个"**，
       *    而且因为返回的是合法座位号，真局里完全看不出来 —— 只有合成表能抓到（门 D223 的 ⓪ 腿就是它）。 */
      const d = (c[0](b) - c[0](a)) * c[1];
      if (d !== 0) return d;
    }
    return a - b;
  });
  const best = sorted[0];
  const tiedBy = function (i) { for (const c of crit) { if (c[0](i) !== c[0](best)) return false; } return true; };
  return { target: best, tie: sorted.filter(tiedBy).length, of: pool.length, rule: rule };
}
