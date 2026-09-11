/* Epirus 训练 worker：在独立线程里加载引擎，并行计算个体的 fitness。
 * 每个 worker 会加载 js/ 下的引擎/策略/进化模块（经 vm 沙箱），收到 {type:'eval'} 请求后
 * 对给定的一批个体跑 scoreMember（纯函数），把结果发回主线程。
 */
import { parentPort } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

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
/* 多人训练的对手池（名字→函数，worker 内自己解析，因为函数无法跨线程传） */
const OPP_POOL = [
  { name: 'random', sel: B.pickRandom }, { name: 'balanced', sel: B.pickBalanced },
  { name: 'aggro', sel: B.pickAggro }, { name: 'defend', sel: B.pickDefend },
  { name: 'wall', sel: B.pickWall }, { name: 'antidef', sel: B.pickAntiDef },
  { name: 'breakdef', sel: B.pickBreakDef }, { name: 'mix', sel: B.pickMix },
  { name: 'farmer', sel: B.pickFarmer }
];

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
    const opps = (msg.oppNames && msg.oppNames.length)
      ? OPP_POOL.filter(function (o) { return msg.oppNames.indexOf(o.name) >= 0; })
      : OPP_POOL;
    const results = msg.members.map(function (m) {
      /* 千问指出的两个跨机问题一次修掉：
       *  a) 所有 worker 共用同一个 EPIRUS_SEED0，个体的随机流偏移随 worker 数变化（8 核 != 18 核）；
       *  b) 同种子导致各 worker 是相关样本，会系统性低估个体间差异、放大假信号。
       * 修法：按 (seed0, gen, 个体下标) 播种 —— 与哪个 worker 跑它无关、与 worker 数无关，
       * 且每个个体拿到独立随机流（比按 workerIndex 播种更彻底）。 */
      const S0 = Number(process.env.EPIRUS_SEED0 || 0);
      if (S0) __seedSandbox(sb, S0 * 100003 + (msg.gen + 1) * 1009 + (m.idx + 1));
      const r = T.scoreMemberN(m.params, opps, msg.games, msg.n, msg.gen, m.idx);
      return { idx: m.idx, score: r.fit, firstRate: r.firstRate, top2Rate: r.top2Rate, avgDealt: r.avgDealt };
    });
    parentPort.postMessage({ type: 'evalNResult', id: msg.id, results: results });
  }
});
