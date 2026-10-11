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
const ALIAS_REL = 'champion-map/pack-aliases.tsv';
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
  else appendFileSync(p, line + '\r\n');
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
  return { wrote: true, canonical: hit || rel, rel, wid, note: hit ? '按 `--force-copy` 复制了一份（已登记）' : '新权重 ⇒ 写盘' };
}
/** 设计如此的复制（`kept/` 耐久层、band 夹具…）：写，并且**必须**登记理由。 */
export function declareCopy(o) {
  const r = guardWrite(Object.assign({}, o, { force: true }));
  if (!o.why) console.log('⚠ declareCopy 没带 why ⇒ 登记成"没写理由"的复制（这种条目 D191 会点名）');
  return r;
}
export const ALIAS_FILE = ALIAS_REL;
