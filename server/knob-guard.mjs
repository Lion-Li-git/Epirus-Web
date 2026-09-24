/* 训练入口的 env 契约守卫 —— **单一来源**（v1.5.200）
 *
 * ## 病（实测，不是猜）
 * 每个训练入口的 env 面都是一个**闭集**，而传了它读不到的键时**没有任何提示**：
 *   `EPIRUS_KILL_REWARD` 只接在 `tools/train-3p.mjs`，于是
 *   `train-best`（README 推荐的 2P 入口）与页面「训练场」背后的训练服务收到这个键后
 *   **静默忽略**，产物与不带它那次**逐字节相同**（实测 pack sha1 两次一致）。
 *   本仓为这一族栽过至少 9 次（`FEAS_N` / `ECON_ENV_KEYS` / `pierceKeys` / `HOLO_GIFT_MAX` /
 *   承诺局 `% 3` / `countBigCards` / `EPIRUS_PASSIVE_FIELD` / `EPIRUS_DIV_*` / 本次）。
 *
 * ## 判据（v1.5.200 升级：不再手抄名单）
 * - **读集**（本入口读得到的键）= 扫 `entry` 的**传递 import 闭包** + `extraReadKeys`
 *   （有些键是经 `readEconEnv(process.env)` 这类**单一来源列表**读的，源码里没有 `process.env.X` 字面量）
 *   + `selfFiles`（不走 import 但真会继承 env 的进程，例如 server 起 worker 时 worker 读的那些）。
 * - **全集** = `tools/` 与 `server/` 下所有 `.mjs`/`.js` 里出现过的 `EPIRUS_*`（**排除 `js/`**：
 *   `js/` 在 vm 沙箱里没有 `process`，那里的字面读本来就是死键，该由 D122 ④ 那族门去钉）。
 * - **暗键** = 全集 ∩ 环境里真实出现的键 − 读集。**响亮 `exit 6`**，`EPIRUS_ALLOW_DARK=1` 放行。
 *
 * ⚠️ 刻意**不是**"任何 `EPIRUS_*`"：用户 shell 里残留一个全仓没人读的旧变量（如 `EPIRUS_NO_PROXY`）
 *    不该让所有迷你臂 exit 6（那是误伤）。只盯"这个仓里**有人真读**、而**本入口读不到**"的那些。
 *
 * ⚠️ 扫描前先**去注释**：注释里提到的键名不算"读过"（本仓多处注释在解释某个键，若算进去会把真暗键洗白）。
 * ⚠️ 所有路径相对**本模块所在仓库**解析（不是 cwd）—— 否则从别的目录跑工具时全集为空 ⇒ 静默失效。
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..');

export const ESCAPE_KEY = 'EPIRUS_ALLOW_DARK';

/* 去注释：块注释 + 行注释。同时保留字符串字面量（`'EPIRUS_X'` 必须留下 —— 单一来源列表就是那么写的）。 */
export function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let mode = 0; // 0=code 1=block 2=line 3='…' 4="…" 5=`…`
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === 1) { if (c === '*' && d === '/') { mode = 0; i += 2; continue; } i++; continue; }
    if (mode === 2) { if (c === '\n') { mode = 0; out += c; } i++; continue; }
    if (mode === 3 || mode === 4) {
      out += c;
      if (c === '\\') { out += (d || ''); i += 2; continue; }
      if ((mode === 3 && c === "'") || (mode === 4 && c === '"')) mode = 0;
      i++; continue;
    }
    if (mode === 5) { out += c; if (c === '\\') { out += (d || ''); i += 2; continue; } if (c === '`') mode = 0; i++; continue; }
    if (c === '/' && d === '*') { mode = 1; i += 2; continue; }
    if (c === '/' && d === '/') { mode = 2; i += 2; continue; }
    if (c === "'") { mode = 3; out += c; i++; continue; }
    if (c === '"') { mode = 4; out += c; i++; continue; }
    if (c === '`') { mode = 5; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}

/** 不是 env 键、但形如键名的那些（页面全局量 / 冠军外壳名）—— 扫到了也不算旋钮。
 *  `EPIRUS_CHAMPION*` 是 `window` 上的包名（全仓从没有 `process.env.EPIRUS_CHAMPION*`，已 grep 证），
 *  留在全集里只会让"有人读"的名单虚胖。 */
const NOT_A_KNOB = /^EPIRUS_CHAMPION/;

/** 全集口径 = 读集口径：出现过的**键名**（裸字符串字面量也算）。
 *
 *  ⚠️ 这里刻意**区分不了**"点名"与"取值"（`FIGHT_ENV_KEYS = ['EPIRUS_FIGHT_WHISTLE']` 和
 *  `pick(o,'EPIRUS_AGGR_GAMES',20)` 在源码里长得一样）。第一版按"点号取值才算读"来区分，
 *  结果把 `feasPlan` 那种"把键名当参数交给 reader"的**真读**判成了不读（会把活键误报成黑键）。
 *  ⇒ 改由**文件级**区分：名单模块 `*-env.mjs` 整个排除（见 `ENV_LIST_MODULE`），
 *    其余文件里的键名一律当成"该入口读得到"。 */
export function scanKeysFromSource(src) {
  const out = new Set();
  const m = stripComments(src).match(/EPIRUS_[A-Z0-9_]+/g);
  if (m) for (const k of m) if (!NOT_A_KNOB.test(k)) out.add(k);
  return out;
}

/** 名单模块（`server/econ-env.mjs` / `fight-env.mjs` / `train-env.mjs`）：它们的键是**清单**，
 *  import 一个清单 ≠ 调用了那个 reader。train-3p 就只 import 了 `FIGHT_ENV_KEYS` 来"点名"、
 *  从不读它的值 —— 若靠闭包自动继承，`EPIRUS_FIGHT_WHISTLE` 传给它就会从 `exit 6` 变成静默通过
 *  （**假阴性**，正是本模块要治的病；第一版就是这么错的，被 D122 当场抓住）。
 *  ⇒ 从这类模块里拿键必须**显式声明**（`extraReadKeys`，例如 server 传 ECON∪FIGHT∪TRAIN 三个名单）。
 *  ⚠️ 两个分隔符都要认：Windows 上 `importClosure` 返回的是 `server\fight-env.mjs`。 */
const ENV_LIST_MODULE = /(^|[\\/])[a-z0-9-]+-env\.mjs$/;

const abs = function (p) { return resolve(REPO_ROOT, p); };

/** `entry` 的**传递 import 闭包**（只跟相对路径；node: 内置与包名跳过）。 */
export function importClosure(entry) {
  const seen = new Set(), stack = [abs(entry)];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !existsSync(f)) continue;
    const ext = extname(f);
    if (ext !== '.mjs' && ext !== '.js') continue;
    seen.add(f);
    let src;
    try { src = stripComments(readFileSync(f, 'utf8')); } catch (e) { continue; }
    const re = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) {
      const p = resolve(dirname(f), m[1]);
      if (existsSync(p) && !seen.has(p)) stack.push(p);
    }
  }
  return Array.from(seen).map(function (p) { return p.slice(REPO_ROOT.length + 1); });
}

/** 全集：`tools/` + `server/` 下所有 `.mjs`/`.js` 里出现过的键（**排除 `js/`**，理由见模块头）。 */
export function repoKnobUniverse(roots) {
  const rr = (roots || ['tools', 'server']).map(abs);
  const files = [];
  for (const r of rr) {
    if (!existsSync(r)) continue;
    for (const e of readdirSync(r, { withFileTypes: true })) {
      if (!e.isFile()) continue;
      const p = join(r, e.name);
      const ext = extname(p);
      if (ext === '.mjs' || ext === '.js') files.push(p);
    }
  }
  const out = new Set();
  for (const f of files) { try { for (const k of scanKeysFromSource(readFileSync(f, 'utf8'))) out.add(k); } catch (e) { } }
  return out;
}

/** 本入口**真正读得到**的键集。返回读集与它扫过的文件（可审计）。 */
export function readKeysOf(opt) {
  const read = new Set([ESCAPE_KEY]);   // 逃逸口永远算"认得"
  const own = [opt.entry].concat(opt.selfFiles || []);
  const files = importClosure(opt.entry).concat(
    (opt.selfFiles || []).filter(function (f) { return existsSync(abs(f)); }));
  for (const f of files) {
    if (ENV_LIST_MODULE.test(f) && own.indexOf(f) < 0) continue;   // 名单模块要显式声明，见 ENV_LIST_MODULE
    try { for (const k of scanKeysFromSource(readFileSync(abs(f), 'utf8'))) read.add(k); } catch (e) { }
  }
  for (const k of (opt.extraReadKeys || [])) read.add(k);
  return { read, files };
}

/** 纯判定：分成"已删除的键"与"暗键（本入口读不到）"两堆。不打印、不退出 ⇒ 门可直接喂合成 env。 */
export function detectDarkKnobs(env, opt) {
  const { read, files } = readKeysOf(opt);
  const universe = repoKnobUniverse(opt.roots);
  const removed = opt.removed || {};
  const gone = Object.keys(removed).filter(function (k) { return env[k] !== undefined; }).sort();
  const dark = Array.from(universe).filter(function (k) {
    return env[k] !== undefined && !read.has(k);
  }).sort();
  return { read, universe, files, dark, gone };
}

/** 响亮拒绝（`exit 6`）。`EPIRUS_ALLOW_DARK=1` 放行。返回判定结果，便于测试与调用方记账。 */
export function enforceKnobs(opt) {
  const r = detectDarkKnobs(opt.env, opt);
  if (opt.env[ESCAPE_KEY] === '1') return r;
  if (!r.dark.length && !r.gone.length) return r;
  const tag = '[' + opt.tool + '] ';
  for (const k of r.gone) {
    console.error(tag + '⛔ ' + k + ' 已被删除 —— ' + ((opt.removed || {})[k] || ''));
  }
  if (r.dark.length) {
    console.error(tag + '⛔ 检测到本入口**读不到的旋钮**（CLI 黑键一族：传了等于没传，会跑出"看着在调参、其实是默认"的臂）：' + r.dark.join(', '));
    console.error('  · 本入口读集来自 ' + r.files.length + ' 个文件（源码 + 传递 import 闭包 + 单一来源列表）');
    console.error('  · 这些键在本仓**别的入口**里是真读的 ⇒ 想让它们在这里生效，先把线接过来（或换那个入口跑）');
    console.error('  · 只是环境里残留 / 只想透传给别处 ⇒ 显式 `' + ESCAPE_KEY + '=1` 放行');
  } else {
    console.error('  · 只是环境里残留 ⇒ 显式 `' + ESCAPE_KEY + '=1` 放行');
  }
  process.exit(6);
}
