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
 *
 * ### §2026-10-11 更新：这一条现在有两种安全做法（口径变了，别照旧文一刀切绕开）
 * ① **绕开**：`spawnNC()` / `opts.nocache` —— 简单，代价是每遍热跑真跑（实测 `D134` 36 s ‖ `D135` 54.5 s ‖ `D137` ~10 s）。
 * ② **把产出也进缓存**：`opts.outputs = [路径,…]`（见下面的 `captureOutputs`/`restoreOutputs`）—— 命中时先还原再交结果。
 * ⚠️ ②只有一种情形是真安全的：**声明必须覆盖那条门读到的每一个产出路径**。这条**机制测试永远看不见**
 *   （它对"只读 stdout 的门"和"声明漏了东西的门"都照样绿），只能逐门读代码确认 —— 实测反例：`D127` 按
 *   `EPIRUS_BAND_DIR` 声明了 `[dirA,dirB]`，命中那遍**门红了** ⇒ 它读的产出超出所声明 ⇒ 退回①。
 * ⚠️ 另一个坑：`outputs` 是**本模块的选项**，传给原生 `spawnSync` 会被**静默忽略**（不报错、status 照回）
 *   ⇒ 用 ② 时必须确认那一句调的确实是 `spawnCached`，不是同名形状的 `spawnSync`（今晚就有 1/6 处栽在这）。
 * ② 的语义由门 `D157` 行为式自证（真跑写进声明路径 ‖ 命中把被删掉的产出还原回来且不重跑 ‖ 盒子里少一项必须**不再算命中**）。
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, statSync, existsSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CACHE_DIR = join(tmpdir(), 'epirus-npcache');
const MAX_ENTRIES = 400;
const __S = { hit: 0, miss: 0, savedMs: 0, on: true };

/** 逃生口：`NP_NOCACHE=1` ⇒ 一律真跑。 */
export function cacheOn() { return process.env.NP_NOCACHE !== '1'; }
export function cacheStats() { return { hit: __S.hit, miss: __S.miss, savedMs: __S.savedMs }; }
export function cacheReset() { __S.hit = 0; __S.miss = 0; __S.savedMs = 0; }
/** §2026-10-11 千问复核：给门**行为式地**验 `outputs` 语义用（腿要能算出产出盒的路径，不许自己再拼一遍目录约定）。 */
export function cacheDir() { return CACHE_DIR; }

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

/* §2026-10-11 DS（用户：「先试一下能不能提高缓存的功效」）：**产出文件也进缓存**。
 *   动机：有一批门的断言要读子进程**产出的文件**（训练臂写进 EPIRUS_BAND_DIR 的 band、量具的输出）。
 *   头注的前置要求把这类排除在缓存之外（对：只缓存 stdout 会造**假绿**），但代价是它们每遍真跑（实测热跑多付 2~3 分钟）。
 *   做法：调用方用 `opts.outputs = [路径, …]`（文件或目录）声明"这次会产出什么" ⇒
 *     **存**：真跑之后把那些路径整份拷进 `CACHE_DIR/<key>.out/<i>`；
 *     **还**：命中时先还原到**本次**的路径（临时目录每次都不同 ⇒ 正因如此键里要把临时路径归一化，见 TMP_RE）。
 *   ⚠️ 安全性靠两条：① 命中**必须**还原成功才返回缓存结果，否则当未命中回退真跑；
 *     ② 仍然不许缓存"非确定性"的子进程（前置要求第 1 条不变：键=内容，任何输入变键就变）。 */
function outBox(key) { return join(CACHE_DIR, key + '.out'); }
function captureOutputs(key, outputs) {
  if (!outputs || !outputs.length) return;
  const box = outBox(key);
  try { rmSync(box, { recursive: true, force: true }); mkdirSync(box, { recursive: true }); } catch (e) { return; }
  outputs.forEach(function (p, i) {
    try { if (existsSync(p)) cpSync(p, join(box, String(i)), { recursive: true }); } catch (e) { /* 拷不动就算了 */ }
  });
}
function restoreOutputs(key, outputs) {
  if (!outputs || !outputs.length) return true;
  const box = outBox(key);
  if (!existsSync(box)) return false;
  let okAll = true;
  outputs.forEach(function (p, i) {
    const src = join(box, String(i));
    /* §2026-10-11（千问复核 D）：盒子里**少一项**说明这次没存全 ⇒ 必须当**还原失败**（回退真跑），
     *   不能跳过就算了 —— 否则「命中必须还原成功才返回」这句话是假的。 */
    if (!existsSync(src)) { okAll = false; return; }
    try { cpSync(src, p, { recursive: true }); } catch (e) { okAll = false; }
  });
  return okAll;
}

function pruneIfNeeded() {
  try {
    /* §2026-10-11（千问复核 D）：`.out` 产出盒也要参与轮换 —— 原来只删 .json ⇒ 盒子只增不减（实测 46 盒/22.8MB）。 */
    const es = readdirSync(CACHE_DIR).filter(function (f) { return /\.json$/.test(f) || /\.out$/.test(f); });
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
  /* §2026-10-10 DS：显式逃生口 —— 断言要读子进程**产出的文件**时，必须 `nocache: true`（缓存命中 ⇒ 子进程不跑 ⇒
   *   那些文件是上一次留下的 ⇒ 可双向骗人，见 METHODOLOGY 117 与 Claude 整改建议）。np-test 里用 spawnNC() 包一层。 */
  if (!cacheOn() || !o.encoding || o.nocache) return spawnSync(process.execPath, argv, o);
  __S.on = true;
  let f = null, key = null;
  try {
    key = inputHash(argv, o.env);
    f = join(CACHE_DIR, key + '.json');
    const c = JSON.parse(readFileSync(f, 'utf8'));
    if (!restoreOutputs(key, o.outputs)) throw new Error('产出未入库 ⇒ 当未命中');   /* §2026-10-11：假绿防线 */
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
      captureOutputs(key, o.outputs);
      pruneIfNeeded();
    }
  } catch (e) { /* 写不进去也无所谓：下次照样真跑 */ }
  return r;
}
