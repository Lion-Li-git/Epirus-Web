/* Epirus 训练 worker：在独立线程里加载引擎，并行计算个体的 fitness。
 * 每个 worker 会加载 js/ 下的引擎/策略/进化模块（经 vm 沙箱），收到 {type:'eval'} 请求后
 * 对给定的一批个体跑 scoreMember（纯函数），把结果发回主线程。
 */
import { parentPort } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { OPP_SPECS } from './opp-pool.mjs';   // v1.4.9：池子单一来源（原先 server/worker 各写一遍会静默漂移）
/* v1.5.2：`champ:<路径>` 冠军对手。函数无法跨线程传 ⇒ 各 worker 自己构造，但解析规则是同一份。 */
import { makeOppSelResolver } from './opp-champs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const sb = { console, Math, JSON, Object, Array, Number, String, Error,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
sb.globalThis = sb;
__seedSandbox(sb, Number(process.env.EPIRUS_SEED0 || 0));   // worker 与主线程同种子

/* 工具链修复：把沙箱内的 Math.random 整体替换为可播种 RNG。
 * 原先 evo.js(4 处)/bots.js(1 处)/policy.js 的 randn 都在用 Math.random，
 * 只播种 policy 的 randn 不够 —— 同 seed 两次运行结果仍然不同（已实测）。
 * 覆盖整个沙箱的 Math 可一次盖住所有随机源；不设 seed 时保持原样。 */
function __seedSandbox(sbox, seed) {
  if (!seed) return;
  const M = Object.create(Math);
  let s = (seed >>> 0) || 1;
  M.random = function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  sbox.Math = M;
}

for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/evo.js']) {
  vm.runInNewContext(readFileSync(join(root, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer;
const B = sb.EpirusBots;
/* 多人训练的对手池：**从 server/opp-pool.mjs 派生**（名字→函数，worker 内自己解析，
 * 因为函数无法跨线程传）。v1.4.9 之前这里与 server 的 BOT_FN_N 是两份独立清单，
 * 漏加一个名字会让 worker 的 filter 静默取子集（v1.4.8 就这么把"13 对手"跑成了 12 个）。 */
const OPP_POOL = OPP_SPECS.map(function (o) {
  if (typeof B[o.fn] !== 'function') throw new Error('opp-pool: ' + o.name + ' → Bots.' + o.fn + ' 不存在');
  return { name: o.name, sel: B[o.fn] };
});
/* v1.5.2：对手名走**与 server 同一个解析器**（脚本名 + `champ:<路径>` 冠军对手）。
 * 函数无法跨线程传 ⇒ worker 必须自己构造，但**规则只有一份**（opp-champs.mjs）——
 * "两处各写一遍"正是这个项目栽过三次的地方。 */
const FN_MAP = (function () { const m = {}; for (const o of OPP_SPECS) m[o.name] = o.fn; return m; })();
const resolveOpp = makeOppSelResolver(sb, root, FN_MAP, B);

parentPort.on('message', (msg) => {
  if (msg && msg.type === 'eval') {
    const opps = T.buildOpps(msg.champion, 0.05);
    const results = msg.members.map(({ idx, params }) => {
      const r = T.scoreMember(params, opps, msg.gamesPerOpp, msg.gen, idx);
      return { idx: idx, score: r.score, attackGames: r.attackGames, attackChoices: r.attackChoices,
        totalChoices: r.totalChoices, attackRate: r.attackRate, attackShare: r.attackShare };
    });
    parentPort.postMessage({ type: 'evalResult', id: msg.id, results: results });
  }
  if (msg && msg.type === 'evalN') {
    /* v1.5.2：按 msg.oppNames 的**原顺序**构造（轮换 `oi = (gen*3+g) % opps.length` 依赖顺序 ——
     * 顺序变了就是另一场实验），并支持 `champ:<路径>` 冠军对手。 */
    const wantNames = (msg.oppNames && msg.oppNames.length) ? msg.oppNames : OPP_POOL.map(function (o) { return o.name; });
    const opps = [];
    const missing = [];
    for (const nm of wantNames) {
      try {
        const sel = resolveOpp(nm);
        if (sel) opps.push({ name: nm, sel: sel }); else missing.push(nm);
      } catch (e) {
        parentPort.postMessage({ type: 'evalNResult', id: msg.id, error: '对手解析失败 ' + nm + ' — ' + e.message });
        return;
      }
    }
    /* v1.3.59：这里是**静默 filter 子集** —— 漏加一个名字会让"12 对手"的臂实际只跑 9 个，
     * A/B 退化成同一个实验（本类静默失败已坑过一次）。改成响亮告警。 */
    if (missing.length) {
      console.error('[worker] 对手池缺名字: ' + missing.join(',') + ' —— 本臂实际只有 ' + opps.length + '/' + wantNames.length + ' 个对手');
    }
    /* v1.5.0：worker 是**独立沙箱** ⇒ 服务端的 setTrainMode 不会传过来，必须按消息里的 mode 设。
     * 漏这一行的症状极隐蔽：进化照旧 3 血、只有服务端终局评估是 5 血，best 曲线看起来完全正常。 */
    if (T.setTrainMode) T.setTrainMode(msg.mode || 'multi');
    /* v1.5.2：风格切片也必须在**本 worker 的沙箱里**设一遍（同 mode 的道理：服务端那份改不到这里）。
     * 并把回执带回去，让服务端能自检"切片真的生效了"而不是静默半开。 */
    let sliceOk = null;
    if (T.setStyleSlice) {
      const sNames = (msg.styleOppNames && msg.styleOppNames.length) ? msg.styleOppNames : [];
      const sOpps = [];
      for (const nm of sNames) {
        try { const sel = resolveOpp(nm); if (sel) sOpps.push({ name: nm, sel: sel }); }
        catch (e) { parentPort.postMessage({ type: 'evalNResult', id: msg.id, error: '风格切片对手解析失败 ' + nm + ' — ' + e.message }); return; }
      }
      sliceOk = T.setStyleSlice(sOpps.length ? sOpps : null, msg.styleW, msg.styleGames);
      if (sNames.length && (!sliceOk || sliceOk.games <= 0)) {
        parentPort.postMessage({ type: 'evalNResult', id: msg.id, error: '风格切片没在 worker 生效（w=' + msg.styleW + ' games=' + msg.styleGames + ' n=' + sOpps.length + '）' });
        return;
      }
    }
    const results = msg.members.map(function (m) {
      /* 千问指出的两个跨机问题一次修掉：
       *  a) 所有 worker 共用同一个 EPIRUS_SEED0，个体的随机流偏移随 worker 数变化（8 核 != 18 核）；
       *  b) 同种子导致各 worker 是相关样本，会系统性低估个体间差异、放大假信号。
       * 修法：按 (seed0, gen, 个体下标) 播种 —— 与哪个 worker 跑它无关、与 worker 数无关，
       * 且每个个体拿到独立随机流（比按 workerIndex 播种更彻底）。 */
      const S0 = Number(process.env.EPIRUS_SEED0 || 0);
      if (S0) __seedSandbox(sb, S0 * 100003 + (msg.gen + 1) * 1009 + (m.idx + 1));
      const r = T.scoreMemberN(m.params, opps, msg.games, msg.n, msg.gen, m.idx, m.h);
      return {
        idx: m.idx, score: r.fit, firstRate: r.firstRate, top2Rate: r.top2Rate, avgDealt: r.avgDealt,
        // (c) 承诺局记账：分巢精英与终局门槛都要靠它，丢了这一项 h 基因就白加了
        hGene: m.h || 0, commitGames: r.commitGames, commitFirstRate: r.commitFirstRate,
        modeUsed: (T.trainMode ? T.trainMode() : null),   // 自检回执：服务端据此确认模式真的生效
        styleGames: r.styleGames || 0, styleRate: r.styleRate || 0,   // v1.5.2：风格切片回执（服务端据此自检）
        commitTop2Rate: r.commitTop2Rate, commitMaxEp: r.commitMaxEp
      };
    });
    parentPort.postMessage({ type: 'evalNResult', id: msg.id, results: results });
  }
});
