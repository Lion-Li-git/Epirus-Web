/* 探针：**为什么 3P 冠军在 2 人局里被打崩？**（用户 2026-09-19 的疑问）
 *
 * 背景：`docs/REVIEW-QODER-2026-09-19.md` §4-3 实测「3P 包 vs 2P 冠军 = 24 负 0 胜」，用户问：
 *   "2P 的状态实际上完全包含在 3P 里面，为什么 3P 冠军跑去打 2P 会被暴打？"
 *
 * 结论（本探针自己量的，见输出）：
 *   · **不是模式**：`multi@N=2` 与 `standard@N=2` 在这个 matchup 里**逐字节相同**
 *     （多出的 `holo/dualGun/mirror` 一次也没被选中；`suddenDeath 45` 在 6 回合的局里不可达）。
 *   · **是"输出密度"错配**：3P 冠军在 2 席里按ジ **66%**、200 局只开 **193** 枪；
 *     2P 冠军按ジ **52.7%**、开 **526** 枪（2.7×）⇒ 6.3 回合被打死。它**自己没坏**
 *     （自镜像 50/50、15.8 回合），是价值函数按**4 席对手**学的。
 *   · 判别性证据：`只枪`（最便宜的密度线）打 3P 冠军 ≈ 98%，打 2P 冠军 ≈ 个位数 ——
 *     **2P 冠军会防密度，3P 冠军不会**。反向对照：把 2P 冠军丢进 5 席也会掉到基准线附近。
 *   · 概念：**"状态空间被包含" ≠ "策略被包含"** —— 同一状态在 2 席与 5 席里**价值不同**
 *     （对手数、谁会互相消耗、按ジ 的机会成本），而网络的输入里有一大块是**对手集合的聚合特征**。
 *
 * ⚠️ 只读探针：不写任何文件。用法：`node tools/probe-2p-mismatch.mjs`（`N=` 换样本量）。
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

function loadParams(file, slot) {
  const t = readFileSync(file, 'utf8');
  const re = slot === '3p' ? /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/ : /window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/;
  const m = re.exec(t);
  if (!m) { console.error('找不到 ' + file + ' 的冠军槽'); process.exit(2); }
  return P.unpack(JSON.parse(m[1]));
}
const p3 = loadParams('js/bundled-champion-3p.js', '3p');
const p2 = loadParams('js/bundled-champion.js', '2p');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* 与 promote-champion2p / probe-beadburst 同一口径：temp 0.15、候选感知 */
const sel = function (params) {
  return function (state, pid, legal) {
    const aff = legal.filter(function (l) { return l.affordable; });
    return T.pickChampion(state, pid, aff.length ? aff : [{ key: R.SK.JI, affordable: true }], params, 0.15);
  };
};
const DEFENSE = [R.SK.GUARD, R.SK.REFLECT, R.SK.BAGUA, R.SK.SHIFT, R.SK.JINSHIELD, R.SK.PROTO];
const G = Number(process.env.N || 200);
const pct = function (x) { return (100 * x / G).toFixed(1) + '%'; };

/* ① 2 席对拆：报告"甲对乙"的胜率 + 双方出手构成（用于看"密度"） */
function headsUp(label, mode, seed0, pa, pb) {
  const cA = sel(pa), cB = sel(pb);
  let aWin = 0, bWin = 0, draw = 0, rounds = 0, dmgA = 0, dmgB = 0;
  const histA = {}, histB = {};
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode, { next: mulberry32(seed0 + g) }, 2);
    const swap = (g % 2) === 1;                       // 座位轮换，抵消先手优势
    Play.autoGame(st, swap ? [cB, cA] : [cA, cB]);
    const seatA = swap ? 1 : 0, seatB = swap ? 0 : 1;
    if (st.winner === seatA) aWin++; else if (st.winner === seatB) bWin++; else draw++;
    rounds += st.round || 0;
    for (const e of st.events) {
      if (e.type === 'action') (e.pid === seatA ? histA : histB)[e.key] = ((e.pid === seatA ? histA : histB)[e.key] || 0) + 1;
      if (e.type === 'damage' && e.via !== 'cost') { if (e.to === seatB) dmgA += e.amt; else if (e.to === seatA) dmgB += e.amt; }
    }
  }
  const top = function (h) { return Object.keys(h).sort(function (x, y) { return h[y] - h[x]; }).slice(0, 6).map(function (k) { return k + ':' + h[k]; }).join(' '); };
  const stats = function (h) {
    const tot = Object.keys(h).reduce(function (s, k) { return s + h[k]; }, 0) || 1;
    const def = DEFENSE.reduce(function (s, k) { return s + (h[k] || 0); }, 0);
    return '出手 ' + tot + ' · ジ ' + (100 * (h[R.SK.JI] || 0) / tot).toFixed(1) + '% · 防御类 ' + (100 * def / tot).toFixed(1) + '%';
  };
  console.log('\n== ' + label + '（' + mode + ' · N=2 · ' + G + ' 局）==');
  console.log('   甲 胜 ' + pct(aWin) + ' / 乙 胜 ' + pct(bWin) + ' / 平 ' + pct(draw) + ' · 平均 ' + (rounds / G).toFixed(1) + ' 回合');
  console.log('   甲造成伤害 ' + (dmgA / G).toFixed(2) + '/局 · 乙造成伤害 ' + (dmgB / G).toFixed(2) + '/局');
  console.log('   甲 ' + stats(histA) + ' ｜ ' + top(histA));
  console.log('   乙 ' + stats(histB) + ' ｜ ' + top(histB));
}

/* ② 2 席：一行脚本（最便宜的密度线）打冠军 —— 直接量"会不会防密度" */
function botVsChamp(label, mode, seed0, botFn, params) {
  const cC = sel(params);
  let botWin = 0, draw = 0, rounds = 0, dmgBot = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(mode, { next: mulberry32(seed0 + g) }, 2);
    const swap = (g % 2) === 1;
    const botSeat = swap ? 1 : 0;
    Play.autoGame(st, swap ? [cC, botFn] : [botFn, cC]);
    if (st.winner === botSeat) botWin++; else if (st.winner === 'draw') draw++;
    rounds += st.round || 0;
    for (const e of st.events) if (e.type === 'damage' && e.via !== 'cost' && e.to !== botSeat) dmgBot += e.amt;
  }
  console.log('\n== ' + label + '（' + mode + ' · N=2 · ' + G + ' 局）==');
  console.log('   一行脚本夺冠 ' + pct(botWin) + ' / 平 ' + pct(draw) + ' · 平均 ' + (rounds / G).toFixed(1) + ' 回合 · 它对冠军造成伤害 ' + (dmgBot / G).toFixed(2) + '/局');
}

/* ③ 5 席："外来者"（1 席）打 4 席本地冠军 ⇒ 夺冠率；基准 = 20%（公平份额） */
function oddOneOut(label, seed0, oddParams, localParams) {
  const cOdd = sel(oddParams), cLocal = sel(localParams);
  let win = 0, draw = 0;
  for (let g = 0; g < G; g++) {
    const seat = g % 5;
    const st = S.createState('multi', { next: mulberry32(seed0 + g) }, 5);
    const cs = [];
    for (let i = 0; i < 5; i++) cs.push(i === seat ? cOdd : cLocal);
    Play.autoGame(st, cs);
    if (st.winner === seat) win++; else if (st.winner === 'draw') draw++;
  }
  console.log('   ' + label.padEnd(44) + ' 夺冠 ' + pct(win).padStart(6) + ' / 平 ' + pct(draw).padStart(6));
}

console.log('探针：3P 冠军在 2 人局里的失校 · N=' + G + '/格');
headsUp('A) 3P 冠军（甲） × 2P 冠军（乙） @ standard', 'standard', 31000, p3, p2);
headsUp('B) 同上，但换成 multi（控制"模式"这个因素）', 'multi', 31000, p3, p2);
headsUp('C) 2P 冠军镜像 @ standard（对照）', 'standard', 32000, p2, p2);
headsUp('D) 3P 冠军镜像 @ standard（对照：它自己没坏）', 'standard', 33000, p3, p3);

console.log('\n== 判别性测量：一行"只枪"（最便宜的密度线）能不能打穿 ==');
botVsChamp('E) 只枪 × 3P 冠军 @ standard', 'standard', 34000, B.pickGunSpam, p3);
botVsChamp('F) 只枪 × 2P 冠军 @ standard', 'standard', 34000, B.pickGunSpam, p2);

console.log('\n== 反向对照：把冠军丢进对方的席位数（5 席 multi · 基准 20%）==');
oddOneOut('G) 1 席 2P 冠军 vs 4 席 3P 冠军（2P 冠军当外来者）', 35000, p2, p3);
oddOneOut('H) 1 席 3P 冠军 vs 4 席 2P 冠军（3P 冠军当外来者）', 35000, p3, p2);
oddOneOut('I) 1 席 3P 冠军 vs 4 席 3P 冠军（同策略基线锚）', 35000, p3, p3);
oddOneOut('J) 1 席 2P 冠军 vs 4 席 2P 冠军（同策略基线锚）', 35000, p2, p2);
