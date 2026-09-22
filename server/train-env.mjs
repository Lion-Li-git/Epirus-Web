/* 训练分布侧旋钮的**单一来源**（v1.5.159 · DS 09-22 建立；v1.5.163 起只剩一个键）。
 *
 * 为什么需要它：`js/train/evo.js` 里的训练分布旋钮原先只在**加载时字面读 `process.env`**，而 CLI（`tools/train-3p.mjs`）
 * 与 server（`server/train-worker.mjs`）用的都是**手搭沙箱对象**（`{ console, Math, … }`，**没有 `process`**）
 * ⇒ 传进去的值**永远到不了消费点**，静默吃默认 ✗（qoder §N10 审计的"CLI 黑旋钮"）。
 * 修法与 `server/econ-env.mjs` / `server/fight-env.mjs` **完全同构**：宿主读 env（本模块）⇒
 * 通过 `EpirusTrainer` 的 setter 下发 ⇒ 消费点读 setter 后的值。
 *
 * ⚠️ v1.5.163：本模块原来的第一个键 `EPIRUS_PASSIVE_FIELD` **已整族删除**（那条"4 席全被动"注入自 v1.5.65 落地起
 * 一局都没开过火 —— 消费点查 `BOT_PICKS` 里不存在的键，而两道门都判在变量上、没一道判在效果上；见 CHANGELOG v1.5.163 与
 * 夜日志 §N11）。**别再往这儿加"只改默认值、却没人验证效果"的键**：新旋钮必须自带 `countX()` 开火计数（先例 `KILL_FIELD`）。
 *
 * 本模块与 econ-env/fight-env 一样是**纯函数**（不 import 任何东西）⇒ 可被 CLI / server / 门 直接复用。
 */

/** env 键名清单（与 econ-env/fight-env 同规矩：单一来源，别处不许再抄一份） */
export const TRAIN_ENV_KEYS = ['EPIRUS_KILL_FIELD'];

/** 旋钮字段名清单（下发对象里允许出现的键；给"空枪检测"与回显用） */
export const TRAIN_KNOB_KEYS = ['kill'];

/** v1.5.163 删掉的键：仍要**响亮**拒绝，不许"传了等于没传"（那是本仓烧过三臂的那类病） */
export const REMOVED_TRAIN_KEYS = { EPIRUS_PASSIVE_FIELD: 'v1.5.163（死作用点：注入从未开火；见 CHANGELOG 与夜日志 §N11）' };

const nv = function (v) { return (v == null || v === '') ? null : v; };

/** 从 env 读出下拉对象。返回 {} 表示"无覆盖、用默认值"（⇒ 行为逐位不变）。 */
export function readTrainEnv(env) {
  const e = env || (typeof process !== 'undefined' && process.env ? process.env : {});
  const o = {};
  /* 收割席注入密度（v1.5.160 · qoder §N13）。默认 0 = **不注** ⇒ 历史臂逐位不变：
   * 它买的是新语义（桌上放一个会抢收割的对手），且用户 09-22 裁掉过"顺手改默认分布"的做法 ⇒ 只许显式下达。 */
  const k = nv(e.EPIRUS_KILL_FIELD);
  if (k != null) { const n = Number(k); if (isFinite(n)) o.kill = n; }
  return o;
}

/** 是否有真正的覆盖（空对象 ⇒ false） */
export function hasTrainOverride(o) {
  return !!(o && o.kill != null && isFinite(Number(o.kill)));
}

/** 一行式回显（给日志/体检用；无覆盖时返回空串） */
export function trainEcho(o) {
  return (o && o.kill != null && isFinite(Number(o.kill))) ? ('killField=' + Number(o.kill)) : '';
}
