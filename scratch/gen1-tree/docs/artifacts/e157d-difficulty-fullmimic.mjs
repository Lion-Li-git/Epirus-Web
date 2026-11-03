import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadPool, makeMimic } from '../../tools/human-pool.mjs';

/* §E178 · 这台是 §E174/§E175/§E176 那条"两份人类形状采样器等不等价"的**结案证据**：
   与 `e157-difficulty.mjs` 的唯一区别是"人类代表"整只换成单一来源 `tools/human-pool.mjs` 的 `makeMimic`，并带**心跳打印**（每手抽数 / 出手分布）。
   实测：三批 seed 带 × 两档剂量，与 `e157` **逐位相同**（夺冠率 14.00%/10.50%、配对差 −3.50pt [−7.25,0.25]、每手抽数 28702、出手分布 `ji:8616 ring:794 reflect:755 gun:628 snipe:423 sword:411`）
   ⇒ **两份实现等价 ⇒ 收益表与难度表用的是同一个对手**；§E175 那句"替身依赖"作废（那是我当时那台 `e157b` 接线坏了）。
   ⚠ 用之前先看最后那行"⚙ 心跳"：**每手抽数必须 > 0**，否则就是 §E176 那个错又犯了一次。
   ⚙ 这台同时是"收编 `e157` 之后应当长什么样"的样板（收编要顺手把 D209⑦ 的 `EXEMPT` 从 2 条改成 1 条 ⇒ 那是 `tools/np-test.mjs`，需重认证）。 */

/* §E157 · 把"开档会让玩家难赢多少"量出来 —— 这是 ⑦ 那条裁定真正需要的数。
 * 前面所有读数都在说"AI 变强了"，但产品的真问题是**玩家侧**：五席里只有一个是"人"，剩下四席是 AI。
 * 所以这里让 0 号位坐一个**人类形状的代表**（从 56 局人类日志导出的经验分布抽样，`docs/artifacts/human-behavior.json` = 单一真源），
 *   1~4 号位坐现役包：对照 = 四席全关档，处理 = 四席全开档（`policyChooserBelief`）。
 *   报的是**那位"玩家"的夺冠率**：关档 vs 开档 ⇒ 差值就是"玩家体验到的难度增量"。
 * ⚠ 三条限定：
 *   ① 那是**粗模型人类**（每局只有 ~18 个决策可学、n=997 手总量），不等于真人，更不等于会读你的高手；
 *   ② 目标选择是随机化的（`--tgt=rand` 那次教训：机械指向会造出"合力打某席"的假绝对值）；
 *   ③ 四席同时开档会互相建模（桌面上多了四个会读人的对手 ⇒ 内耗也变强），所以这一张表读的是"整桌难度"，
 *      不是"单个 AI 变凶多少"。要那个数得开一席/四席的**剂量档**（`--on` 参数控制开几席，下面就有）。 */
const REPO = 'D:/code/Epirus-Web/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const TABLES = Number(arg('tables', 60));
const GAMES = Number(arg('games', 10));
const SEED = Number(arg('seed', 77000));

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Play = W.EpirusPlay;
const mm = readFileSync(REPO + 'js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
/* §E175 · 这台是 `e157-difficulty.mjs` 的**换采样器对照版**：除这一段之外与 e157 逐字相同，唯一区别是"人类形状代表"改用单一来源
   `tools/human-pool.mjs` 的 `makeMimic`（e155/e168/e169/e170/e172 用的那个替身）。
   目的只有一个：量"难度那张表"依赖不依赖**替身**（§E174 实测到两套实现能把关档 14.00% 变成 0.00%）。
   ⚠ 它不是新口径、不进任何门、不改历史数 ⇒ 历史难度表仍以 e157 那份为准；这里只用来做对照。
   ⛔ **07:4x 自我更正：这台对照版是坏的（§E176），它跑出的 0.00% 不是"另一个替身"的读数。**
      受控 A/B（同一条流、驱动同一局、两边各问一次）里两份采样器**整局 13 手逐字同结果**；而在这台 e157b 里主体席**每手抽 0 次随机数、永远打 ジ、ep 单调涨到 8**
      ⇒ 分叉来自我这 6 行接线（`makeMimic` 拿到的注入流/`tgt` 与 e157 的 `rng` 语义没对上），不是采样器实现的差异。**保留此档作为反面样本**；要重做请从 e157 整文件复制后逐行替换 `humanSeat`，改完必须先看"每手抽数 > 0"再读表。 */
const pool = loadPool(W, 'human');
let rng = null;                                    /* 每局的抽样流由 `run()` 按 seed 注入 ⇒ 两臂面对同一串抽样 */
let hbDraws = 0, hbHands = 0; const hbKeys = {};
const humanSeat = function (s0, pid0, lg0) {
  hbHands++;
  const pk = makeMimic(W, pool, 'rand', function () { hbDraws++; return rng(); })(s0, pid0, lg0);
  hbKeys[pk.key] = (hbKeys[pk.key] || 0) + 1;
  return pk;
};
const erFor = r => (r <= 1 ? 0 : r === 2 ? 0.1 : 0.2);
function packSeat(belief) {
  return function (s, pid, legal) {
    const bf = legal.filter(l => l.affordable);
    const lfa = bf.length ? bf : [{ key: R.SK.JI, affordable: true }];
    const f = belief ? T.policyChooserBelief(params, 0.15, erFor(s.round), 5, 'soft') : T.policyChooserN(params, 0.15, erFor(s.round), 5, 'soft');
    return f(s, pid, lfa);
  };
}
/* 剂量档：`--on=0/1/2/3/4` ⇒ 四席 AI 里有几席开档（其余关档）。默认 4 = 全开对全关。 */
const ON = Number(arg('on', 4));
/* §E161d：`--tie=1` ⇒ 开档席的平票交给网络打分（§E161c 那个"零代价但更凶"的档）。默认 0 = §E157 已量过那一版。
   这条要在裁定"开几席"之前量，因为**要开的是最好的那一版，不是最早的那一版**。 */
const TIE = Number(arg('tie', 0));
if (TIE && typeof T.setBeliefTie === 'function') T.setBeliefTie(TIE);
function run(beliefCount) {
  const rows = [];
  for (let t = 0; t < TABLES; t++) {
    let playerWin = 0, aiWin = 0, draws = 0, rounds = 0;
    for (let g = 0; g < GAMES; g++) {
      const seed = SEED + t * 104729 + g;
      const st = S.createState('multi', { next: T.mulberry32(seed) }, 5);
      if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(seed);
      rng = T.mulberry32(seed * 7 + 13);                 /* 人类代表的抽样流：两档共用同一 seed ⇒ 同一串抽样 */
      const fns = [humanSeat];
      for (let i = 1; i <= 4; i++) fns.push(packSeat(i <= beliefCount));
      Play.autoGameN(st, fns);
      if (st.winner === 0) playerWin++; else if (st.winner === 'draw') draws++; else aiWin++;
      rounds += st.round;
    }
    rows.push({ t: t, player: playerWin / GAMES, ai: aiWin / GAMES, rounds: rounds / GAMES });
  }
  return rows;
}
const { pairedDiff } = await import('file://' + REPO + 'tools/routing-gain-lib.mjs');
console.log('# §E157 玩家侧难度 ‖ 0 号位=人类形状代表 ‖ 1~4 号位=现役包（开档席数=' + ON + ' · tie=' + TIE + (TIE ? '，平票交给网络打分' : '，§E157 原形状') + '） ‖ 桌=' + TABLES + ' × 局=' + GAMES);
const A = run(0), B = run(ON);
const mean = (x, k) => 100 * x.reduce((s, r) => s + r[k], 0) / x.length;
console.log('\n  档                     "玩家"夺冠    AI 夺冠     和局     平均回合');
console.log('  四席全关（今天）        ' + mean(A, 'player').toFixed(2).padStart(7) + '%  ' + mean(A, 'ai').toFixed(2).padStart(7) + '%  ' +
  (100 - mean(A, 'player') - mean(A, 'ai')).toFixed(2).padStart(6) + '%  ' + (A.reduce((s, r) => s + r.rounds, 0) / TABLES).toFixed(1));
console.log('  ' + (ON === 4 ? '四席全开' : ON + ' 席开') + '              ' + mean(B, 'player').toFixed(2).padStart(7) + '%  ' + mean(B, 'ai').toFixed(2).padStart(7) + '%  ' +
  (100 - mean(B, 'player') - mean(B, 'ai')).toFixed(2).padStart(6) + '%  ' + (B.reduce((s, r) => s + r.rounds, 0) / TABLES).toFixed(1));
const dp = pairedDiff(B.map(r => r.player), A.map(r => r.player), 1.96);
const da = pairedDiff(B.map(r => r.ai), A.map(r => r.ai), 1.96);
console.log('\n  玩家夺冠率变化（逐桌配对 n=' + dp.n + '）= **' + (100 * dp.m).toFixed(2) + 'pt [' + (100 * dp.lo).toFixed(2) + ', ' + (100 * dp.hi).toFixed(2) + ']**');
console.log('  AI 合计夺冠率变化          = ' + (100 * da.m).toFixed(2) + 'pt [' + (100 * da.lo).toFixed(2) + ', ' + (100 * da.hi).toFixed(2) + ']');
console.log('\n  ⚠ 这一行是给"⑦ 开不开、开几席"用的，不是给"AI 变强多少"用的：随机基线下玩家（五席之一）本该有 20%。');
console.log('  ⚠ 剂量档（`--on=1/2`）才回答"开一席当高手档"值多少；上面这行是 --on=' + ON + ' 的读数。');
console.log("  ⚙ 心跳：被问 " + hbHands + " 次，总抽数 " + hbDraws + "（每手 " + (hbDraws / Math.max(1, hbHands)).toFixed(2) + " 次）‖ 出手分布 " + Object.keys(hbKeys).sort((x, y) => hbKeys[y] - hbKeys[x]).slice(0, 6).map(k => k + ":" + hbKeys[k]).join(" "));
