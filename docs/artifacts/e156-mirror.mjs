import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* §E156 · 开档的**代价面**：长程镜像能不能破局。
 * 为什么必须单独量：浏览器那档 ε（v1.5.139/141 请进来的）**唯一用途**就是把 2 席同包的长程镜像从
 *   "104 回合零决胜"拉到 ~30 回合/100% 决胜（`ui.js:489` 那段注释是这么写的）。
 *   搜索是**确定性**的 ⇒ 如果它顶掉了探索，就等于把那条用途删掉 ⇒ 没有这一张表就不能说"可以开档"。
 * 只读引擎自己的字段（`round`/`winner`/`over`），**不重造任何度量**（度量住在 `tools/behavior-profile.mjs`，那是单一真源）。 */
const REPO = 'D:/code/Epirus-Web/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 150));
const SEED = Number(arg('seed', 20260930));
const MODE = arg('mode', 'long');

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Play = W.EpirusPlay;
const mm = readFileSync(REPO + 'js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
const MAXR = R.MAX_ROUNDS;
console.log('# §E156 代价面：2 席同包' + MODE + '镜像 ‖ 局/档=' + GAMES + ' ‖ seed=' + SEED + ' ‖ MAX_ROUNDS=' + MAXR);

function run(kind) {
  let rounds = 0, draws = 0, maxed = 0;
  const per = [];
  for (let g = 0; g < GAMES; g++) {
    const seed = SEED + g * 977;
    const st = S.createState(MODE, { next: T.mulberry32(seed) }, 2);
    if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(seed);
    /* 两席各自拿到"同一个 chooser 工厂"的一次实例化 —— 与页面一致：每次决策现建（`pickChampion` 就是这个形状） */
    const mkOne = function () {
      if (kind === 'eps0') return T.policyChooserN(params, 0.15, 0);
      const er = 0.2;                       /* 镜像测试用浏览器稳态档（第 3 回合起 ε=0.2；`ui.js:489` 的斜坡到 0.2 为止） */
      return kind === 'belief' ? T.policyChooserBelief(params, 0.15, er, 5, 'soft') : T.policyChooserN(params, 0.15, er, 5, 'soft');
    };
    const c0 = mkOne(), c1 = mkOne();
    Play.autoGameN(st, [c0, c1]);
    rounds += st.round; per.push(st.round);
    if (st.winner === 'draw') draws++;
    if (st.round >= MAXR) maxed++;
  }
  per.sort(function (a, b) { return a - b; });
  return { avg: rounds / GAMES, med: per[Math.floor(per.length / 2)], p90: per[Math.floor(per.length * 0.9)],
    draw: 100 * draws / GAMES, maxed: 100 * maxed / GAMES };
}
const LABEL = { eps0: 'ε=0（训练/门禁口径）', browser: '浏览器档（ε 斜坡 + top5 键 + soft）', belief: '浏览器档 + 在线对手模型搜索' };
console.log('\n  档                               平均回合     中位     P90     和局率     触顶率');
const out = {};
for (const k of ['eps0', 'browser', 'belief']) {
  out[k] = run(k);
  console.log('  ' + LABEL[k].padEnd(30) + out[k].avg.toFixed(1).padStart(8) + out[k].med.toFixed(0).padStart(8) +
    out[k].p90.toFixed(0).padStart(7) + (out[k].draw.toFixed(1) + '%').padStart(10) + (out[k].maxed.toFixed(1) + '%').padStart(10));
}
console.log('\n  判读：**开档不许把"镜像能破局"顶掉** ⇒ `belief` 的和局率/触顶率若明显高于 `browser`，');
console.log('  就说明搜索是确定性的、替代了探索 ⇒ 开档必须**保留探索**（现在这版是"只换贪心那一支"，理论上仍会抽 ε，');
console.log('  但贪心被换掉之后"抽到 ε 才有的那些不同键"就没机会出现了 ⇒ 这一条就是本表要抓的东西）。');
console.log('  ⚠ 与 §E154 的读数不同轴：那边是 5 人异质桌的夺冠率，这里是 2 席同包的**僵局**——两件事都得绿才叫可开。');
