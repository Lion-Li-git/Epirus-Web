/* Epirus — 并行训练加速器（Node 内置 worker_threads，零依赖、真实多核并行）。
 * 把每代的“个体评估”从主线程切到 worker 池里并行跑：
 *   - worker 加载同一份引擎（vm 沙箱），用纯函数 scoreMember 算 fitness；
 *   - 主线程等所有 worker 完成后，调用 T.finishStep(t) 做排序/冠军/繁殖（轻量）。
 * 这样 500 代可以从 ~1 代/s 提升到接近核心数倍（如 8 核 → ~6-8 代/s）。
 */
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* 构造一个异步 step(t)：优先并行评估，worker 池可用则用它，否则回退串行 T.step(t)。 */
export function makeAsyncStep(T, opts) {
  opts = opts || {};
  const num = Math.max(1, Math.min(opts.workers || (cpus().length - 1), 16));
  let pool = [];
  try {
    for (let i = 0; i < num; i++) {
      pool.push(new Worker(new URL('./train-worker.mjs', import.meta.url)));
    }
  } catch (e) {
    console.error('[parallel] worker pool 启动失败，回退串行：', e && e.message);
    pool = [];
  }
  let reqId = 0;
  function runOne(worker, msg) {
    return new Promise((resolve) => {
      const id = ++reqId;
      const h = (m) => {
        if (m && m.type === 'evalResult' && m.id === id) { worker.off('message', h); resolve(m.results); }
      };
      worker.on('message', h);
      worker.postMessage(Object.assign({}, msg, { id: id }));
    });
  }
  async function evalAll(t, championSnap) {
    if (!pool.length || t.pop.length <= 1) return false;
    const members = t.pop.map((m, idx) => ({ idx: idx, params: m.params }));
    const n = pool.length;
    const chunk = Math.ceil(members.length / n);
    const jobs = [];
    for (let w = 0; w < n; w++) {
      const sl = members.slice(w * chunk, (w + 1) * chunk);
      if (sl.length) jobs.push(runOne(pool[w], { type: 'eval', members: sl, champion: championSnap, gamesPerOpp: t.gamesPerOpp, gen: t.gen }));
    }
    const res = (await Promise.all(jobs)).flat();
    const by = {};
    for (const r of res) by[r.idx] = r;
    for (let i = 0; i < t.pop.length; i++) {
      const r = by[i]; if (!r) { continue; }
      const m = t.pop[i];
      m.attackGames = r.attackGames; m.attackChoices = r.attackChoices; m.totalChoices = r.totalChoices;
      m.attackRate = r.attackRate; m.attackShare = r.attackShare; m.score = r.score;
    }
    return true;
  }
  async function stepAsync(t) {
    const championSnap = t.champion.slice();
    const ok = await evalAll(t, championSnap);
    return ok ? T.finishStep(t) : T.step(t);
  }
  stepAsync.workers = pool.length;
  stepAsync.close = function () {
    for (const w of pool) { try { w.terminate(); } catch (e) { /* ignore */ } }
    pool = [];
  };
  return stepAsync;
}

/* ---- 多人（N）版：把每代的个体评估切到 worker 池里跑 scoreMemberN ---- */
export function makeParallelEvalN(T, opts) {
  opts = opts || {};
  const num = Math.max(1, Math.min(opts.workers || (cpus().length - 1), 16));
  let pool = [];
  try {
    for (let i = 0; i < num; i++) pool.push(new Worker(new URL('./train-worker.mjs', import.meta.url)));
  } catch (e) {
    console.error('[parallel] N 人 worker 池启动失败，回退串行：', e && e.message);
    pool = [];
  }
  let reqId = 0;
  function runOne(worker, msg) {
    return new Promise(function (resolve) {
      const id = ++reqId;
      const h = function (m) {
        if (m && m.type === 'evalNResult' && m.id === id) { worker.off('message', h); resolve(m.results); }
      };
      worker.on('message', h);
      worker.postMessage(Object.assign({}, msg, { id: id }));
    });
  }
  /* 返回与 pop 同长的结果数组；池不可用时返回 null（调用方自行回退串行） */
  async function evalPopN(pop, gen, games, n, oppNames) {
    if (!pool.length || pop.length <= 1) return null;
    const members = pop.map(function (params, idx) { return { idx: idx, params: params }; });
    const chunk = Math.ceil(members.length / pool.length);
    const jobs = [];
    for (let w = 0; w < pool.length; w++) {
      const sl = members.slice(w * chunk, (w + 1) * chunk);
      if (sl.length) jobs.push(runOne(pool[w], { type: 'evalN', members: sl, gen: gen, games: games, n: n, oppNames: oppNames }));
    }
    const res = (await Promise.all(jobs)).flat();
    const out = new Array(pop.length).fill(null);
    for (const r of res) out[r.idx] = r;
    return out;
  }
  return {
    evalPopN: evalPopN,
    workers: pool.length,
    close: function () { for (const w of pool) { try { w.terminate(); } catch (e) { /* ignore */ } } pool = []; }
  };
}
