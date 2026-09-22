/* 训练分布侧旋钮的**单一来源**（v1.5.159 · DS 09-22）。
 *
 * 为什么需要它：`js/train/evo.js` 里的训练分布旋钮（如"把 4 席全被动局面注入评估分布"的
 * `EPIRUS_PASSIVE_FIELD`）原先只在**加载时字面读 `process.env`**，而 CLI（`tools/train-3p.mjs`）
 * 与 server（`server/train-worker.mjs`）用的都是**手搭沙箱对象**（`{ console, Math, … }`，
 * **没有 `process`**）⇒ 传进去的值**永远到不了消费点**，静默吃默认 ✗（qoder §N10 审计的"CLI 黑旋钮"）。
 *
 * 修法与 `server/econ-env.mjs` / `server/fight-env.mjs` **完全同构**：宿主读 env（本模块）⇒
 * 通过 `EpirusTrainer.setPassiveField` 下发 ⇒ 消费点读 setter 后的值。默认（无人下发）保持
 * 0.125（= 每 8 局注入一次）⇒ 行为**逐位不变** ✓。
 *
 * 本模块与 econ-env/fight-env 一样是**纯函数**（不 import 任何东西）⇒ 可被 CLI / server / 门 直接复用。
 */

/** env 键名清单（与 econ-env/fight-env 同规矩：单一来源，别处不许再抄一份） */
export const TRAIN_ENV_KEYS = ['EPIRUS_PASSIVE_FIELD', 'EPIRUS_KILL_FIELD'];

/** 旋钮字段名清单（下发对象里允许出现的键；给"空枪检测"与回显用） */
export const TRAIN_KNOB_KEYS = ['field', 'kill'];

const nv = function (v) { return (v == null || v === '') ? null : v; };

/** 从 env 读出下拉对象。返回 {} 表示"无覆盖、用默认值"（⇒ 行为逐位不变）。 */
export function readTrainEnv(env) {
  const e = env || (typeof process !== 'undefined' && process.env ? process.env : {});
  const o = {};
  const f = nv(e.EPIRUS_PASSIVE_FIELD);
  if (f != null) { const n = Number(f); if (isFinite(n)) o.field = n; }
  /* v1.5.160（qoder §N13）：收割席注入密度。默认 0（**不注**）—— 它买的是新语义（桌上放一个会抢收割的对手），
   * 不像 passiveField 那样有"历史默认"要保，所以显式下达才生效 ⇒ 历史臂逐位不变。 */
  const k = nv(e.EPIRUS_KILL_FIELD);
  if (k != null) { const n2 = Number(k); if (isFinite(n2)) o.kill = n2; }
  return o;
}

/** 是否有真正的覆盖（空对象 ⇒ false） */
export function hasTrainOverride(o) {
  return !!(o && ((o.field != null && isFinite(Number(o.field))) || (o.kill != null && isFinite(Number(o.kill)))));
}

/** 一行式回显（给日志/体检用；无覆盖时返回空串） */
export function trainEcho(o) {
  if (!o) return '';
  const parts = [];
  if (o.field != null && isFinite(Number(o.field))) parts.push('passiveField=' + Number(o.field));
  if (o.kill != null && isFinite(Number(o.kill))) parts.push('killField=' + Number(o.kill));
  return parts.join(' ');
}
