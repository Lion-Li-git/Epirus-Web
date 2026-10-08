/* pack-id.mjs —— 一枚包的"身份三件套"的**单一来源**（§E328 从 `lineage.mjs` 里搬出来，不是重写）。
 *
 * 为什么要单独一份：`chain-scan.mjs`（查现役冠军的父链/子代）要干和 `lineage.mjs` 完全相同的解析与哈希，
 *   而 `lineage.mjs` 是**脚本**（顶层直接读 `coords.tsv`、写 `lineage.tsv`）⇒ import 它就会把普查再跑一遍并覆盖产物。
 *   本仓在这件事上翻过很多次车（§E312"复刻仪器要搬代码，别照记忆重写"、D206/D172 的"三处名单缺一处"），
 *   ⇒ 所以这里**逐字搬**（三个函数的函数体一字未改），`lineage.mjs` 改成从本文件 import。
 *   验收：搬完重跑 `node champion-map/lineage.mjs`，`lineage.tsv` 与搬前**逐字节相同**。
 */
import { createHash } from 'node:crypto';

/* META 是包文件顶部一行 `.EPIRUS_CHAMPION_3P_META = {...}`；有些字段是**被字符串再包一层**的 JSON
 *   （ecoOverride / ecoEffective / fightEffective 都是字符串）⇒ 要二次 parse，否则整个字段全成"一个超长字符串"。 */
export function braceObj(txt, from) {
  const a = txt.indexOf('{', from); if (a < 0) return null;
  let depth = 0, end = -1, inS = false, esc = false;
  for (let j = a; j < txt.length; j++) { const c = txt[j];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') inS = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) { end = j; break; } } }
  if (end < 0) return null;
  try { return JSON.parse(txt.slice(a, end + 1)); } catch (e) { return null; }
}
export function parseMeta(txt) {
  const i = txt.indexOf('EPIRUS_CHAMPION_3P_META'); if (i < 0) return null;
  const m = braceObj(txt, i); if (!m) return null;
  for (const k of ['ecoOverride', 'ecoEffective', 'fightOverride', 'fightEffective', 'feasibility']) {
    if (typeof m[k] === 'string' && m[k].trim().startsWith('{')) { try { m[k] = JSON.parse(m[k]); } catch (e) { /* 留字符串 */ } } }
  return m;
}
/* 权重身份 = `server/train-server.mjs` 的 `weightsId()`：sha1(JSON.stringify(Array.from(params))) 前 16 位。
 *   它**只哈希权重数组**（源码注释里写着 v1.3.36 的教训：整文件哈希会被 META 的 ts 污染）。
 *   ⇒ 拿它去对 `META.hotstartFrom`，就能把"这枚是从哪一枚长出来的"还原成真正的父子边。*/
export function packArr(txt) {
  /* 坑：`EPIRUS_CHAMPION_3P` 同时是 `EPIRUS_CHAMPION_3P_META` 的前缀，而 .bak 里 META 那行**在前面**
   *   ⇒ 直接 indexOf 会拿到 META 对象（它没有 `.a`）⇒ 全部静默返回 null。只认"名字后面紧跟 ="的那一处。 */
  const KEY = 'EPIRUS_CHAMPION_3P';
  for (let k = txt.indexOf(KEY); k >= 0; k = txt.indexOf(KEY, k + 1)) {
    const after = txt.slice(k + KEY.length, k + KEY.length + 4);
    if (!/^\s*=/.test(after)) continue;
    const o = braceObj(txt, k); if (!o || !Array.isArray(o.a)) continue;
    return o.a;
  }
  return null;
}
/** §E464 哈希这件事抽成"给一个数组算指纹"，因为同一枚包现在有**两个**合法身份（v6 形状与嵌入成 v7 之后），
 *   而口径必须逐字相同（sha1(JSON.stringify(Array.from(params))) 前 16 位 = `weightsId()`）。
 * ⚠ 收**任何 array-like**，不收"看着像数组的普通对象"：`EpirusPolicy.embedLegacy()` 返回的是
 *   **Float64Array**，而 `Array.isArray(Float64Array)` 是 false ⇒ 原来这里直接 return null，
 *   于是 §E464 那套第二身份登记从写下起就一条也没成功过（0 条 = 静默空转，不报错）。
 *   `weightsId` 那侧本来就是 `Array.from(params)` 再 stringify ⇒ 类型化数组与同内容数组哈希一致，口径不变。 */
export function widOfArr(a) {
  if (!a || typeof a.length !== 'number') return null;
  return createHash('sha1').update(JSON.stringify(Array.from(a))).digest('hex').slice(0, 16);
}
export function widOf(txt) { return widOfArr(packArr(txt)); }
