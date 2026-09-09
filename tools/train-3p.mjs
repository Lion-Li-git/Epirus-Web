/* Epirus 多人自对战训练器（N19）：名次适应度 + 座位轮换 + 多对手池
 * 用法：node tools/train-3p.mjs [代=200] [人数=3] [每代评估局数=8] [种群=12]
 * 产出：js/bundled-champion-3p.js（window.EPIRUS_CHAMPION_3P）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const GENS = Number(process.argv[2] || 200);
const N = Number(process.argv[3] || 3);
const GAMES = Number(process.argv[4] || 8);
const POP = Number(process.argv[5] || 12);

const sb = {
  console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN,
  parseInt, parseFloat, Float64Array, Date
};
sb.window = sb; sb.globalThis = sb;
for (const f of [
  'js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js'
]) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });

const P = sb.window.EpirusPolicy;
const Bots = sb.window.EpirusBots;
const T = sb.window.EpirusTrainer;

const OPPS = [
  { name: 'random', sel: Bots.pickRandom },
  { name: 'balanced', sel: Bots.pickBalanced },
  { name: 'aggro', sel: Bots.pickAggro },
  { name: 'defend', sel: Bots.pickDefend },
  { name: 'wall', sel: Bots.pickWall },
  { name: 'antidef', sel: Bots.pickAntiDef },
  { name: 'breakdef', sel: Bots.pickBreakDef },
  { name: 'mix', sel: Bots.pickMix }
];

const t0 = Date.now();

// 热启动：已有多人冠军则以它为种子（pop[0] 保留原样，保证不退化）
let seedParams = null;
try {
  const src = readFileSync('js/bundled-champion-3p.js', 'utf8');
  const m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (m) seedParams = P.unpack(JSON.parse(m[1]));
} catch (e) { /* 无热启动 */ }

let pop = [];
for (let i = 0; i < POP; i++) {
  if (seedParams && i === 0) pop.push(seedParams);
  else if (seedParams && i < Math.floor(POP / 3)) pop.push(P.mutatePolicy(seedParams, 0.10));
  else pop.push(P.makePolicy(0.25));
}
if (seedParams) console.log('[train-3p] 热启动：以现有冠军为种子');
let sigma = 0.18;
let bestParams = pop[0], bestFit = -1e9;
const hall = [];                       // 名人堂：训练分靠前的个体（终局用全对手验证重选）
function addHall(params, fit) {
  hall.push({ params: params, fit: fit });
  hall.sort(function (a, b) { return b.fit - a.fit; });
  if (hall.length > 6) hall.pop();
}

console.log('[train-3p] 人数=' + N + ' 代=' + GENS + ' 种群=' + POP + ' 每代局数=' + GAMES +
  ' 参数=' + P.paramCount());

for (let gen = 0; gen < GENS; gen++) {
  const scored = pop.map(function (params, i) {
    return { params: params, r: T.scoreMemberN(params, OPPS, GAMES, N, gen, i) };
  });
  scored.sort(function (a, b) { return b.r.fit - a.r.fit; });
  if (scored[0].r.fit > bestFit) { bestFit = scored[0].r.fit; bestParams = scored[0].params; }
  addHall(scored[0].params, scored[0].r.fit);
  addHall(scored[1].params, scored[1].r.fit);
  if (gen % 20 === 0 || gen === GENS - 1) {
    const r = scored[0].r;
    console.log('gen ' + gen + ' bestFit=' + r.fit.toFixed(3) +
      ' 1st=' + (r.firstRate * 100).toFixed(0) + '% top2=' + (r.top2Rate * 100).toFixed(0) +
      '% avgDealt=' + r.avgDealt.toFixed(2) + ' sigma=' + sigma.toFixed(3));
  }
  const elite = scored.slice(0, 3).map(function (x) { return x.params; });
  const next = elite.slice();
  while (next.length < POP) {
    const a = elite[Math.floor(Math.random() * elite.length)];
    const b = scored[Math.floor(Math.random() * Math.min(6, scored.length))].params;
    let child = Math.random() < 0.5 ? P.crossover(a, b) : a.slice();
    child = P.mutatePolicy(child, sigma);
    next.push(child);
  }
  if (gen % 30 === 29) next[POP - 1] = P.makePolicy(0.25);   // 定期注入随机个体
  pop = next;
  sigma = Math.max(0.06, sigma * 0.995);
}

const POOL = [Bots.pickRandom, Bots.pickAggro, Bots.pickDefend, Bots.pickBalanced,
              Bots.pickAntiDef, Bots.pickBreakDef, Bots.pickWall, Bots.pickMix];
const ALL_PAIRS = [];
for (let a = 0; a < POOL.length; a++) for (let b = a + 1; b < POOL.length; b++) ALL_PAIRS.push([POOL[a], POOL[b]]);

// 名人堂逐个用全部 28 对手对验证（新种子），取 1st 最高者作为最终冠军
let finalParams = bestParams, ev = null;
console.log('=== 名人堂验证（' + ALL_PAIRS.length + ' 对 x 20 局）===');
for (const h of hall) {
  const v = T.evalN(h.params, ALL_PAIRS, 20, N, 987654);
  const sc = v.firstRate + 0.5 * v.top2Rate;
  console.log('  trainFit=' + h.fit.toFixed(3) + ' -> 1st=' + (v.firstRate * 100).toFixed(1) +
    '% top2=' + (v.top2Rate * 100).toFixed(1) + '%');
  if (!ev || sc > (ev.firstRate + 0.5 * ev.top2Rate)) { finalParams = h.params; ev = v; }
}
bestParams = finalParams;
console.log('\n=== ' + N + ' 人实测（最终冠军，28 对 × 20 局，座位轮换，temp0.15）===');
console.log('1st=' + (ev.firstRate * 100).toFixed(1) + '%  top2=' + (ev.top2Rate * 100).toFixed(1) +
  '%   (1st/2nd/3rd = ' + ev.first + '/' + ev.second + '/' + ev.third + ' of ' + ev.games + ')');
console.log('耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');

const pack = P.pack(bestParams);
const meta = {
  source: 'tools/train-3p.mjs', n: N, gens: GENS, games: GAMES, pop: POP,
  ts: new Date().toISOString(), firstRate: ev.firstRate, top2Rate: ev.top2Rate
};
writeFileSync('js/bundled-champion-3p.js',
  '/* Epirus \u591a\u4eba\u51a0\u519b\uff08\u7531 tools/train-3p.mjs \u751f\u6210\uff09\u3002\u53ea\u8bfb\u6570\u636e\uff0c\u4e0d\u8981\u624b\u6539\u3002 */\n' +
  'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\n' +
  'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(pack) + ';\n');
console.log('\n\u5df2\u5199\u5165 js/bundled-champion-3p.js');
