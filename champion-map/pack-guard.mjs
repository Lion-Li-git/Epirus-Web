/* pack-guard.mjs —— 落盘前的"这粒权重是不是已经有真身"检查（§E589 防新增 · 千问 10-11）
 *
 * 为什么要有这一份（普查实测，§E589）：`docs/artifacts/**` 里 1443 个包文件只有 **1130 粒不同权重**，
 *   301 份是多余拷贝；而最大的那组 17 份**META 配方一字相同、时间戳成对相同** ⇒
 *   不是"17 个配方各自收敛"，是**同一次跑被按当时的系列名各存了一份**。
 *   也就是说：拷贝不是人手工复制出来的，是**工具在落盘那一刻自己造的**（`train-3p` / `train-best` / `train-fast` /
 *   `soup-pack` / `keep-artifact` 五个出口 + 两处 band 夹具循环）。所以堵它要堵在写之前，不是事后清。
 *
 * 三条规矩：
 *   ① **一权重一真身**：要写的名字如果与已有的某文件同权重 ⇒ **不写第二份**，只把这个名字登记进
 *      `champion-map/pack-aliases.tsv`（别名表 = 用户要的"名字并到一枚权重上，其余留给文档与谱系图连接"）；
 *   ② 确实要复制（git 耐久层 `kept/`、band 夹具这类**设计如此**）⇒ 走 `declareCopy`，**必须带一句 why**，登记之后
 *      才算"已登记的重复"，D191 那条腿只打未登记的；
 *   ③ 原地覆写（目标就是那个文件、权重也一样）算合法更新，不拦。
 * ⚠ 身份只按**权重**（`pack-id.mjs` 的 `widOf`），不按文件字节 —— META 的 ts/arm/目录每次都不同（`probe-pack-identity.mjs` 头注①）。
 * ⚠ 扫一遍约 1.5 秒（1158 个文件）：只在**真要写盘**时扫，且同一次进程里缓存。
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep, isAbsolute, resolve } from 'node:path';
import { widOf } from './pack-id.mjs';

const SCAN = ['docs/artifacts', 'd180-bands'];
/* v1.7.125（用户 10-20 裁定「门写临时账」）：这份表是 **tracked** 的，而门每跑一轮会往里追加登记行 ⇒
 *   跑完工作树就脏（幂等 ≠ 只读）。⇒ 在**门内**改道到 `%TEMP%`：`tools/gates/_ctx.mjs` 一加载就设
 *   `EPIRUS_ALIAS_TSV`，所以门跑的写入不落 tracked 文件；**单独手跑**仍写正式表（没设那个 env）。
 *   读者（`lineage.mjs` / `audit-parent-evidence.mjs`）不动 —— 它们读的仍是正式表，语义不变。 */
const ALIAS_REL = process.env.EPIRUS_ALIAS_TSV || 'champion-map/pack-aliases.tsv';
const ALIAS_COLS = ['ts', 'wid', 'canonical', 'wantedPath', 'tool', 'note'];
const CACHE = new Map();   // (root + scope) → Map(wid → rel)

function walk(d, root, out) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === '_quarantine' || e.name === 'node_modules' || /^chrome-profile/.test(e.name)) continue;
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, root, out);
    else if (/\.(bak|js)$/.test(e.name)) out.push(p);
  }
  return out;
}
/** wid → 第一个见到它的文件（相对路径）。缓存"每进程每范围一遍"；`scope` 给了就只扫那些目录。 */
function widIndex(root, scope) {
  const key = root + ' :: ' + (scope ? scope.join(',') : '*');
  if (CACHE.has(key)) return CACHE.get(key);
  const map = new Map();
  for (const s of (scope && scope.length ? scope : SCAN)) {
    const d = join(root, s);
    if (!existsSync(d)) continue;
    for (const f of walk(d, root, [])) {
      const rel = relative(root, f).split(sep).join('/');
      let w = null;
      try { w = widOf(readFileSync(f, 'utf8')); } catch (e) { continue; }
      if (w && !map.has(w)) map.set(w, rel);
    }
  }
  CACHE.set(key, map);
  return map;
}
export function findCanonical(root, text, scope) {
  const w = widOf(text);
  return w ? { wid: w, hit: widIndex(root, scope).get(w) || null } : { wid: null, hit: null };
}
function registerAlias(root, row) {
  const p = join(root, ALIAS_REL);
  const line = [row.ts || new Date().toISOString(), row.wid, row.canonical, row.wantedPath, row.tool, (row.note || '').replace(/[\t\r\n]+/g, ' ')].join('\t');
  if (!existsSync(p)) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, ALIAS_COLS.join('\t') + '\r\n' + line + '\r\n'); }
  else {
    /* §E654（10-19 下午 · 千问）：**同一三元组不重复追加**（幂等）。
     *   病：10-19 实测同一个 (wid, canonical, wantedPath) 在一趟门里被追加了 3 行（只有 `ts` 不同）⇒
     *     ① 门跑一轮就改一份 tracked 文件、越跑越长；② 读账的人会把一次事件读成三次（"重复测量不是复现"同族）。
     *   键只用 wid + canonical + wantedPath（`ts`/`note` 每次必不同，进键就等于永远不命中）。
     *   ⚠ 只去掉重复行，不动 §E589"命中守卫就不写第二份、只登记别名"这条设计本身。 */
    const keyOf = function (l) { const q = l.split('\t'); return q.length >= 4 ? (q[1] + '|' + q[2] + '|' + q[3]) : null; };
    const mine = keyOf(line);
    const prior = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').split('\n');
    if (mine && prior.some(function (l) { return keyOf(l) === mine; })) return '(已在册，不重复追加) ' + line;
    appendFileSync(p, line + '\r\n');
  }
  return line;
}
const relOf = (root, abs) => relative(root, abs).split(sep).join('/');
/** 目标在不在仓库内。**不能只看 `rel` 是否以 `..` 开头** —— 见 `guardWrite` 里那条 Windows 跨盘的坑。
 *  判法：把两边都 resolve 成绝对路径再比前缀（大小写与分隔符按当前平台归一，Windows 盘符大小写不敏感）。 */
function isOutside(root, dest, rel) {
  if (isAbsolute(rel)) return true;
  if (rel.split('/').indexOf('..') === 0) return true;
  const R = resolve(root).replace(/[\\/]$/, ''), D = resolve(dest);
  const same = process.platform === 'win32';
  const rr = same ? R.toLowerCase() : R, dd = same ? D.toLowerCase() : D;
  return !(dd === rr || dd.startsWith(rr + sep) || dd.startsWith(rr + '/'));
}

/**
 * 要写一枚包之前调它。返回 `{ wrote, canonical, rel }`。
 *   `force` = 调用方已经拿到用户/门的许可要复制（等价 `--force-copy`）；不 force 就**只登记不写第二份**。
 */
export function guardWrite(o) {
  const rel = relOf(o.root, o.dest);
  /* 目标不在仓库里（临时目录、别的盘）⇒ 不查重也不登记：账本只描述仓内的真身关系。
   * ⚠ 判断"在不在仓内"不能靠 `rel.startsWith('..')`：**Windows 下跨盘根的 `path.relative` 不返回 `..` 开头，
   *   而是把绝对路径原样吐回来**（`D:` 仓 vs `C:\...\Temp` ⇒ `'C:/Users/...'`）。
   *   10-11 夜门跑测试时把 75 行 temp 路径写进了进仓的别名账本，就是这么漏的（`D191` 的⑤ 现在盯着这件事）。 */
  if (isOutside(o.root, o.dest, rel)) {
    mkdirSync(dirname(o.dest), { recursive: true }); writeFileSync(o.dest, o.text, 'utf8');
    return { wrote: true, canonical: rel, rel, wid: null, note: '目标在仓库外 ⇒ 不查重（' + rel + '）' };
  }
  /* `js/**` 是产品槽，不是产物：查重只针对 `docs/artifacts/` 与 `d180-bands/`。 */
  if (/^js\//.test(rel)) { writeFileSync(o.dest, o.text, 'utf8'); return { wrote: true, canonical: rel, rel, wid: null, note: '写的是 `js/**`（产品槽）⇒ 不查重' }; }
  const { wid, hit } = findCanonical(o.root, o.text, o.scope);
  if (!wid) { writeFileSync(o.dest, o.text, 'utf8'); return { wrote: true, canonical: rel, rel, wid: null, note: '解不出权重 ⇒ 照常写（不拦读不懂的东西）' }; }
  if (hit === rel) { writeFileSync(o.dest, o.text, 'utf8'); return { wrote: true, canonical: rel, rel, wid, note: '原地覆写同一粒权重 ✓' }; }
  if (hit && !o.force) {
    registerAlias(o.root, { wid, canonical: hit, wantedPath: rel, tool: o.tool, note: o.why || '未复制：同一粒权重已有真身' });
    return { wrote: false, canonical: hit, rel, wid, note: '↷ 同一粒权重已在 `' + hit + '` ⇒ 没写第二份，只登记别名 `' + rel + '`（真要复制请加 `--force-copy` 并写明理由）' };
  }
  if (hit) registerAlias(o.root, { wid, canonical: hit, wantedPath: rel, tool: o.tool, note: '已登记的复制：' + (o.why || '（没写理由）') });
  mkdirSync(dirname(o.dest), { recursive: true });
  writeFileSync(o.dest, o.text, 'utf8');
  /* ⚠ 这里原本要补一行"把刚写的 wid 塞进本进程索引"（10-13 夜班查到：`widIndex` 每进程只扫一遍 ⇒
   *   `train-3p` 收尾写产物时看不见**本进程刚落的 band 夹具** ⇒ 判成"新权重"、不登记别名 ⇒
   *   每跑完一批臂都留下一批"未登记的重复"，等下次 D191④ 才红）。
   *   **没做**，因为补上缓存会让下面那条非 force 分支真的命中 ⇒ 收尾那次会"不写第二份、只登记别名"
   *   ⇒ 臂产物文件不再存在，而 `train-3p` 的注释写明这是**设计如此**（还有 `--force-copy` 出口）
   *   ⇒ 该改的是"臂产物算不算设计如此的复制"（走 declareCopy），那是裁定面，不是夜里单方面动共享守卫。
   *   现状与提案记在 10-13 夜班日志的待裁 #20。 */
  return { wrote: true, canonical: hit || rel, rel, wid, note: hit ? '按 `--force-copy` 复制了一份（已登记）' : '新权重 ⇒ 写盘' };
}
/** 设计如此的复制（`kept/` 耐久层、band 夹具…）：写，并且**必须**登记理由。 */
export function declareCopy(o) {
  const r = guardWrite(Object.assign({}, o, { force: true }));
  if (!o.why) console.log('⚠ declareCopy 没带 why ⇒ 登记成"没写理由"的复制（这种条目 D191 会点名）');
  return r;
}
export const ALIAS_FILE = ALIAS_REL;
