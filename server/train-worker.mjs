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
      const r = T.scoreMemberN(m.params, opps, msg.games, msg.n, msg.gen, m.idx);
      return { idx: m.idx, score: r.fit, firstRate: r.firstRate, top2Rate: r.top2Rate, avgDealt: r.avgDealt };
    });
    parentPort.postMessage({ type: 'evalNResult', id: msg.id, results: results });
  }
});
