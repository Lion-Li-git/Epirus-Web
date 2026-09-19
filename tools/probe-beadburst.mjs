/* Epirus 探针：珠爆发线 vs 线上冠军（**1v1 / 2P**）—— v1.5.129 新增
 *
 * 为什么需要它（第三方复核 `docs/REVIEW-QODER-2026-09-19.md` §3 + METHODOLOGY §E.38）：
 *   ① 复核报"ジ → 蓄电珠 → 电磁炮，残血摄魂收尾"这条线把 **2P** 线上冠军打到
 *      **100% 胜 · 均 9 回合**；而 **G4 克制表只跑 5 席**，结构上看不见 1v1 的洞
 *      ⇒ 那个洞需要一把 **1v1** 的量具（G4 里同一格只有 30%(long)/15%(multi)，不是最克格）。
 *   ② 写这条线的脚本时踩过一个坑：珠只活到下一回合末（`js/core/resolve.js` 的 `keep = p.beadNew || null`）
 *      而蓄能花 1 ジ ⇒ "买得起蓄能就蓄"会退化成 `蓄能 → ジ → 珠过期 → …` **永不放炮**
 *      （实测 200 局里 `railgun` 出手 **0** 次、伤害 0.00/局）。
 *      ⇒ 本探针**先打出手构成**，让"链条到底有没有转起来"一眼可见（`np-test D103` 的 ①b 守着同一件事）。
 *
 * 用法：
 *   node tools/probe-beadburst.mjs                # 默认 200 局（与复核同量级）
 *   N=1000 node tools/probe-beadburst.mjs         # 换样本量
 *   MODE=long node tools/probe-beadburst.mjs      # 换模式（注意 long 是 5 血 / 3~5 人）
 * 读法：`胜 100.0% · 平均 9.2 回合` 且出手构成里有 `railgun` ⇒ 这条线成立。
 * ⚠️ **v1.5.130 起这条读数的含义翻转了**：该线进 2P 训练池后冠军学会了防它
 *    （实测 `珠爆发 胜 **0.0%** / 冠军 100.0% / 6.0 回合`，冠军用 1 ジ 的枪抢节奏 —— 不是靠原型制御挡的）
 *    ⇒ 现在它是一个**回归哨兵**：若这个胜率又回到高位，说明"防电"能力在后续训练里丢了。
 * ⚠️ 只读探针：不写任何文件、不落盘。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const W = sb.window, R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay;
const P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots;

/* 线上 2P 冠军（与 tools/promote-champion2p.mjs 的 champSel 同口径：temp 0.15、候选感知） */
const src = readFileSync('js/bundled-champion.js', 'utf8');
const m = /window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
if (!m) { console.error('找不到 js/bundled-champion.js 的冠军槽'); process.exit(2); }
const params = P.unpack(JSON.parse(m[1]));

/* 与项目其它量具同口径的播种（同 seed ⇒ 可复现；也便于与 p2-baselines 的考卷对照） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const champSel = function (state, pid, legal) {
  const aff = legal.filter(function (l) { return l.affordable; });
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  return T.pickChampion(state, pid, base, params, 0.15);
};
const burstSel = function (state, pid, legal) { return B.pickBeadBurst(state, pid, legal); };

const G = Number(process.env.N || 200);
const MODE = process.env.MODE || 'standard';
let wins = 0, losses = 0, draws = 0, rounds = 0, dmgToMe = 0, dmgToOpp = 0;
const mine = {}, theirs = {};
for (let g = 0; g < G; g++) {
  const st = S.createState(MODE, { next: mulberry32(5000 + g) }, 2);
  Play.autoGame(st, [burstSel, champSel]);
  rounds += st.round || 0;
  for (const e of st.events) {
    if (e.type === 'action') (e.pid === 0 ? mine : theirs)[e.key] = ((e.pid === 0 ? mine : theirs)[e.key] || 0) + 1;
    if (e.type === 'damage' && e.via !== 'cost') { if (e.to === 0) dmgToMe += e.amt; else if (e.to === 1) dmgToOpp += e.amt; }
  }
  if (st.winner === 0) wins++; else if (st.winner === 1) losses++; else draws++;
}
const pct = function (x) { return (100 * x / G).toFixed(1) + '%'; };
const top = function (h) { return Object.keys(h).sort(function (a, b) { return h[b] - h[a]; }).map(function (k) { return k + ':' + h[k]; }).join(' ') || '(无)'; };
console.log('mode=' + MODE + ' games=' + G);
console.log('  珠爆发 胜 ' + pct(wins) + ' / 冠军 胜 ' + pct(losses) + ' / 平 ' + pct(draws) + '   平均 ' + (rounds / G).toFixed(1) + ' 回合');
console.log('  我造成的伤害 ' + (dmgToOpp / G).toFixed(2) + '/局   冠军对我造成的伤害 ' + (dmgToMe / G).toFixed(2) + '/局');
console.log('  我的出手构成  ' + top(mine));
console.log('  冠军出手构成  ' + top(theirs));
if (!(mine[R.SK.RAILGUN] > 0)) console.log('  ⚠️ railgun 出手 0 次 ⇒ 这条线的"链条没转起来"（检查蓄电珠门槛 ep>=3），此时胜率不具解释力');
