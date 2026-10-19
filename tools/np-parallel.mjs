/* ============================================================================
 * np-parallel.mjs —— 门禁里"多支互相独立的训练臂"的**并发批跑器**（v1.5.281）
 *
 * ## 病（实测，不是估的）
 * `NP_TIME=1` 的榜（**v1.5.281 之前的读数，已被推翻**：D176 现在走 `spawnBatch`、v1.7.64 又把两波合成一波）：
 *   当时 **D176 一道门 274.6 秒 = 整套 562.6 秒的 49%**，形状是"7 支 60 代臂串行 spawnSync"。现数见 `docs/GATE-SHIFTS.md` 真源表。
 * D185（43.4 秒）同形。这些臂**互相独立**（各自 `EPIRUS_ARM` / `EPIRUS_BAND_DIR` / `EPIRUS_T3P_OUT`），
 * 串行只是 `spawnSync` 的写法顺出来的，不是判据要求的。
 *
 * ## 为什么不走 np-cache
 * `np-cache` 的前置写得很清楚：**只许缓存"断言只用 stdout/status"的子进程**。
 * 而这些门随后要**打开臂的产物文件**读权重与 meta ⇒ 缓存命中的那一次没有那些文件（`wOf()` 读不到 ⇒ 判红）。
 * 所以对症的是并发，不是缓存。
 *
 * ## 为什么并发不改变任何结论（三条都验过）
 * ① 每支臂本来就是**独立进程**，`EPIRUS_SEED` 固定 ⇒ 进程内 RNG 与邻居无关；
 * ② CLI 训练路（`tools/train-3p.mjs` / `js/train/evo.js`）**没有墙钟中止**
 *    （`EPIRUS_WALL_MS` 只活在 `server/train-server.mjs` 那条页面路，`server/wall-cap.mjs` 是它的单一来源）
 *    ⇒ 抢核只会慢，不会把一臂截断成另一副权重；
 * ③ 等价性由门 **D188** 判：同一支臂"串跑产物 vs 批跑产物"必须**逐位相同**，
 *    并且**少一个 job 的结果就必须响亮判红**（不许把"没跑"当成"过了"—— D58/D59/D157 那一族）。
 *
 * ## 用法
 *   import { spawnBatch } from './np-parallel.mjs';
 *   const r = spawnBatch([{ tag:'ctl', argv:['tools/train-3p.mjs','60'], env:{...} }, ...], { max: 7 });
 *   r.ctl.status / r.ctl.stdout / r.ctl.stderr
 * 本文件被 `--run` 直接调用时充当并发执行体（父进程用 spawnSync 等它，从而保持门的同步写法）。
 * ==========================================================================*/
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, openSync, closeSync } from 'node:fs';
import os, { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rejectUnknownFlags } from './audit-lib.mjs';
/* v1.7.69：仓规「不认识的 `--` 参数必须**响亮失败**」—— 本工具此前没有消毒层，拼错的旗标被**静默忽略**
 *   （正是「静默忽略 = 假读数」那条规矩要防的事；`gate-sentinel` 一族一直在报告这个缺口）。 */
/* v1.7.69：只在**本文件是入口**时校验 —— 量具既可能被当 CLI 跑，也可能被别的门 `import` 当模块用；
 *   后者时 `process.argv` 是**调用方**的 argv（例如 gate runner 的 `--part=`），无条件校验会把整轮门禁打红。 */
if (process.argv[1] && process.argv[1].endsWith("np-parallel.mjs")) {
  rejectUnknownFlags(process.argv.slice(2), ['run'], "np-parallel");
}

const SELF = import.meta.filename;

/* ---------- 并发执行体（子进程里跑）---------- */
async function runBatch(jobsFile, outFile, max) {
  const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
  const cap = Math.max(1, Number(max) || 7);
  const out = [];
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const j = jobs[i++];
      const so = outFile + '.' + j.tag + '.out', se = outFile + '.' + j.tag + '.err';
      /* 子进程输出**落文件**而不是管道：并发下父进程（执行体）不能同时读 N 条管道，
       * 而"读不到输出"在这里等于假绿 ⇒ 落文件、由门面读。 */
      const st = await new Promise((res) => {
        let fdO, fdE;
        try { fdO = openSync(so, 'w'); fdE = openSync(se, 'w'); }
        catch (e) { res(-98); return; }
        const c = spawn(process.execPath, j.argv, { cwd: j.cwd, env: j.env, stdio: ['ignore', fdO, fdE] });
        c.on('error', (e) => { writeFileSync(se, String(e && e.message || e)); res(-99); });
        c.on('close', (code, sig) => { try { closeSync(fdO); closeSync(fdE); } catch (e) { } res(sig ? -1 : (code == null ? -2 : code)); });
      });
      out.push({ tag: j.tag, status: st, stdoutFile: so, stderrFile: se });
    }
  };
  await Promise.all(Array.from({ length: Math.min(cap, jobs.length) }, worker));
  writeFileSync(outFile, JSON.stringify(out));
}

if (process.argv[2] === '--run') {
  runBatch(process.argv[3], process.argv[4], process.argv[5]).catch((e) => {
    console.error('[np-parallel] 执行体自己炸了：' + (e && e.stack || e));
    process.exit(9);
  });
}

/* ---------- 同步门面（门禁里用）---------- */
export function spawnBatch(jobs, opts) {
  const o = opts || {};
  if (!Array.isArray(jobs) || !jobs.length) throw new Error('[spawnBatch] 零个 job —— 一条都没跑不许当过了');
  for (const j of jobs) if (!j.tag || !Array.isArray(j.argv)) throw new Error('[spawnBatch] 每个 job 必须有 tag 与 argv');
  const tags = jobs.map(j => j.tag);
  if (new Set(tags).size !== tags.length) throw new Error('[spawnBatch] tag 重复会互相盖结果：' + tags.join(','));
  const dir = mkdtempSync(join(tmpdir(), 'npbatch-'));
  const jobsFile = join(dir, 'jobs.json'), outFile = join(dir, 'res.json');
  try {
    writeFileSync(jobsFile, JSON.stringify(jobs.map(j => ({
      tag: j.tag, argv: j.argv, env: Object.assign({}, process.env, j.env || {}), cwd: j.cwd,
    }))));
    /* v1.7.116（10-19 晚，查 CI 变慢的根因）：并发上限原来**写死 7**。7 是照 18 核开发机调的，
     *   而 GitHub 免费档 runner 是 **2 核** ⇒ 超订确实存在。
     * ⚑⚑ **10-19 深夜（千问复核）这条闸够不到热点**：下面写的是 `o.max || cap` ⇒ **显式传 `max` 的调用点永远赢**，
     *   而真实耗时主体全部显式传了 —— `tools/gates/train-runner.mjs:1319` 是 `{ max: specs.length }`（1338 那批实际 6 支臂
     *   ⇒ CI 2 核上仍是 6 路），`:1558` 是 `{ max: 2 }`，`train-evo.mjs:2742/:2761/:2765` 是 4/3/1。
     *   全仓唯一吃到这个新缺省的是 `train-evo.mjs:2748`（三个 `-e` 微型 job，微秒级）⇒ **本缺省对 CI 墙钟没有可测影响**。
     *   所以 run 287 的 train-runner 从 1669s 回到 1428s **不能记在这把闸上**（同因：DS 自己 §二 的双峰 820↔1620，
     *   而同一张表里 `train-evo` 286=352s ↔ 287=645s ⇒ 摆动是全体的，n=1 读不出任何 ~14% 的效果）。
     *   真要接上只需一行（把 `armBatch` 的 `max: specs.length` 改成 `Math.min(specs.length, cap)`），但
     *   **预期不买时间**——2 核上 CPU 工作总量没变，只减调度与内存压力 ⇒ 落地前要先答"做了会不会改变什么"，
     *   并且验收必须 n≥3 趟 run。剩下的确定杠杆是**少干活**（拆 train-runner，见 docs/research/CI-WALLCLOCK-2026-10-19-ds.md §七）。 */
    const CPUS = (os.availableParallelism ? os.availableParallelism() : os.cpus().length);
    const autoMax = Math.max(2, Math.min(7, CPUS));
    const cap = Number(process.env.EPIRUS_BATCH_MAX) > 0 ? Number(process.env.EPIRUS_BATCH_MAX) : autoMax;
    const sup = spawnSync(process.execPath, [SELF, '--run', jobsFile, outFile, String(o.max || cap)], {
      encoding: 'utf8', timeout: o.timeout || 1800000,
    });
    if (sup.status !== 0 || !existsSync(outFile)) {
      throw new Error('[spawnBatch] 执行体没交回结果（status=' + sup.status + '）⇒ 一律判红，不许按"没跑"通过：' +
        String(sup.stderr || sup.stdout || '').slice(-400));
    }
    const arr = JSON.parse(readFileSync(outFile, 'utf8'));
    const got = new Map(arr.map(r => [r.tag, r]));
    const missing = tags.filter(t => !got.has(t));
    if (missing.length) throw new Error('[spawnBatch] 少了这几支臂的结果：' + missing.join(',') + '（不许静默少跑）');
    const res = {};
    for (const r of arr) {
      res[r.tag] = {
        status: r.status,
        stdout: existsSync(r.stdoutFile) ? readFileSync(r.stdoutFile, 'utf8') : '',
        stderr: existsSync(r.stderrFile) ? readFileSync(r.stderrFile, 'utf8') : '',
      };
    }
    return res;
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 临时目录清不掉不影响结论 */ }
  }
}
