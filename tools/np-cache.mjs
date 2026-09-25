/* 确定性重活的**内容寻址缓存**（v1.5.225 · 用户批准方案 (a)：『没改动的地方重复跑浪费时间』）
 *
 * ## 病
 * `np-test` 里有一批**确定性**的子进程（固定 seed + 固定 env + 固定输入）：训练臂、量具、行为门……
 * 它们每次全量重跑。实测最重的几条：**D135 两条 60 代训练臂 41.4 秒**、D134 16.1、D136 13.8 ——
 * 合计约 **71 秒**，而绝大多数提交根本没碰训练侧。改一行文档也要等它们跑完，纯浪费。
 *
 * ## 判据（三条，缺一不可）
 * 1. **键 = 内容**：`argv` + `EPIRUS_*` 环境 + **源码树内容**（`tools/` `js/` `server/` 的 .mjs/.js）+ argv 里引用的文件
 *    + `process.version` 的 sha1。**任何一处内容变了键就变** ⇒ 结构上不可能"没改却复用旧结果"。
 *    （实测哈希 82 个文件 / 2.4 MB 只要 **8 ms**，所以每次 spawn 都重算，不做增量。）
 * 2. **只缓存 `(status, stdout, stderr)`，绝不缓存"通过/失败"** ⇒ **断言照旧在缓存输出上跑**。
 *    门没有被跳过，只是那个**确定性**子进程没重跑 —— 这是本模块与"静默跳过"（D58/D59 那族病）的分界线。
 * 3. **响亮**：每次命中有独立一行（含 key 前 8 位与省下的秒数）；收尾由调用方印汇总；
 *    `NP_NOCACHE=1` 一律真跑（逃生口）。缓存坏了/读不动 ⇒ 一律回退真跑，绝不因为缓存而少跑。
 *
 * ## ⚠️ 前置要求（写在这里，防以后有人乱扩）
 * **只许缓存"断言只用 stdout/status"的子进程。**
 * 若某条门还要读该子进程**产出的文件**（例如训练臂存进 `EPIRUS_BAND_DIR` 的 band，随后被断言打开），
 * 那么缓存命中的那一次**没有那些文件** ⇒ 光缓存 stdout 会造出**假绿**。
 * 判断方法：在该门的 `spawnSync` 之后 `grep readFileSync|readdirSync|existsSync` —— 命中就等于前置不满足。
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CACHE_DIR = join(tmpdir(), 'epirus-npcache');
const MAX_ENTRIES = 400;
const __S = { hit: 0, miss: 0, savedMs: 0, on: true };

/** 逃生口：`NP_NOCACHE=1` ⇒ 一律真跑。 */
export function cacheOn() { return process.env.NP_NOCACHE !== '1'; }
export function cacheStats() { return { hit: __S.hit, miss: __S.miss, savedMs: __S.savedMs }; }
export function cacheReset() { __S.hit = 0; __S.miss = 0; __S.savedMs = 0; }

const TREE_DIRS = ['tools', 'js', 'server'];
function collectFiles() {
  const out = [];
  const walk = function (d) {
    let es = [];
    try { es = readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of es) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(mjs|js)$/.test(e.name)) out.push(p);
    }
  };
  for (const d of TREE_DIRS) walk(d);
  return out;
}

/** 与行为有关的 env：本仓的旋钮全是 `EPIRUS_*`；另带 TZ/LANG（会影响格式化输出）。
 *  ⚠️ **临时路径必须归一化**：训练臂传的是 `EPIRUS_BAND_DIR = mkdtempSync(...)`，**每次都是新路径** ——
 *  若不归一化，键每次都不一样、缓存永远不命中（v1.5.225 第一版就是这么白跑的：冷跑写入 4 条、热跑又写 4 条新条目）。
 *  临时路径是**输出位置**，不是行为参数；真正会读那些产物的门本来就不许缓存（见头注前置要求）。 */
const TMPDIR = tmpdir();
/* 把**整段**临时路径（含 mkdtemp 生成的随机后缀）折成 `<TMP>`：
 * 只换前缀是不够的 —— `mkdtempSync` 的后缀每次随机，键照样每次都变（v1.5.225 第二版又栽在这）。 */
const TMP_RE = new RegExp(TMPDIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\\\/][^;,\\s]*', 'g');
function normVal(v) { return String(v).replace(TMP_RE, '<TMP>'); }
function envKey(env) {
  const e = env || process.env;
  return Object.keys(e).filter(function (k) { return /^EPIRUS_|^TZ$|^LANG$/.test(k); })
    .sort().map(function (k) { return k + '=' + normVal(e[k]); }).join('\n');
}

/** 内容键。导出是为了让门**能行为式地验它**（稳定 / argv 敏感 / 内容敏感）。 */
export function inputHash(argv, env) {
  const h = createHash('sha1');
  h.update('node:' + process.version + '\n');
  const files = collectFiles();
  for (const a of argv || []) {
    if (typeof a === 'string' && /\.(bak|js|mjs)$/.test(a) && existsSync(a)) files.push(a);
  }
  files.sort();
  for (const f of files) { h.update(f); h.update('\0'); h.update(readFileSync(f)); h.update('\0'); }
  h.update('argv:' + JSON.stringify(argv || []) + '\n');
  h.update('env:' + envKey(env) + '\n');
  return h.digest('hex');
}

function pruneIfNeeded() {
  try {
    const es = readdirSync(CACHE_DIR).filter(function (f) { return /\.json$/.test(f); });
    if (es.length <= MAX_ENTRIES) return;
    const withT = es.map(function (f) { let t = 0; try { t = statSync(join(CACHE_DIR, f)).mtimeMs; } catch (e) {} return [t, f]; });
    withT.sort(function (a, b) { return a[0] - b[0]; });
    for (const r of withT.slice(0, es.length - MAX_ENTRIES)) { try { rmSync(join(CACHE_DIR, r[1])); } catch (e) {} }
  } catch (e) { /* 清理失败无所谓 */ }
}

/**
 * `spawnSync(process.execPath, argv, opts)` 的缓存版。**返回形状与 spawnSync 一致**。
 * 只在 `opts.encoding` 为字符串（默认 utf8 模式）时缓存 —— Buffer 模式不缓存，免得多一层形状风险。
 */
export function spawnCached(argv, opts) {
  const o = opts || {};
  if (!cacheOn() || !o.encoding) return spawnSync(process.execPath, argv, o);
  __S.on = true;
  let f = null, key = null;
  try {
    key = inputHash(argv, o.env);
    f = join(CACHE_DIR, key + '.json');
    const c = JSON.parse(readFileSync(f, 'utf8'));
    __S.hit++; __S.savedMs += (c.ms || 0);
    console.log('  ⏩ 缓存命中（' + key.slice(0, 8) + ' · 省 ' + ((c.ms || 0) / 1000).toFixed(1) + ' 秒）：' + argv.join(' ').slice(0, 88));
    return { status: c.status, stdout: c.stdout, stderr: c.stderr, error: null, signal: null, __cached: true };
  } catch (e) { /* 未命中 / 缓存坏了 ⇒ 落到下面真跑（**绝不**因为缓存而少跑） */ }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, argv, o);
  const ms = Date.now() - t0;
  __S.miss++;
  try {
    if (f) {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(f, JSON.stringify({ status: r.status, stdout: r.stdout, stderr: r.stderr, ms: ms, argv: argv, at: new Date().toISOString() }));
      pruneIfNeeded();
    }
  } catch (e) { /* 写不进去也无所谓：下次照样真跑 */ }
  return r;
}
