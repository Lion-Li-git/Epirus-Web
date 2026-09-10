/* Epirus 经济画像 + 新旧冠军 head-to-head 评测
 * 用法：node tools/econ-eval.mjs [新冠军文件=js/bundled-champion-3p.js] [旧冠军文件] [局数=60]
 * 输出：① ep 分布与技能使用分布（种类数）② 对脚本对手对的 1st 率 ③ 新 vs 旧 head-to-head
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILE_A = process.argv[2] || 'js/bundled-champion-3p.js';
const FILE_B = process.argv[3] || '';
const GAMES = parseInt(process.argv[4] || '60', 10);
const N = 3;

function loadSandbox(extra) {
  const sb = {
    console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN,
    parseInt, parseFloat, Float64Array, Date, window: {},
    localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } }
  };
  sb.globalThis = sb;
  const files = ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
    'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js'];
  for (const f of files) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
  for (const f of extra) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
  return sb;
}
function packFrom(file) {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) throw new Error('未找到 EPIRUS_CHAMPION_3P: ' + file);
  return JSON.parse(m[1]);
}

const sbA = loadSandbox([FILE_A]);
const WA = sbA.window, RA = WA.EpirusRules, SA = WA.EpirusState, TA = WA.EpirusTrainer, PA = WA.EpirusPolicy;
const A = PA.unpack(packFrom(FILE_A));
if (!A) throw new Error('冠军 A 解包失败（版本/维度不符）');

let B = null, WB = null;
if (FILE_B) {
  const sbB = loadSandbox([FILE_B]);
  WB = sbB.window;
  B = WB.EpirusPolicy.unpack(packFrom(FILE_B));
  if (!B) throw new Error('冠军 B 解包失败');
}

const fname = { random: 'pickRandom', balanced: 'pickBalanced', aggro: 'pickAggro', defend: 'pickDefend', wall: 'pickWall', antidef: 'pickAntiDef', breakdef: 'pickBreakDef', mix: 'pickMix', farmer: 'pickFarmer' };
const BOT = WA.EpirusBots;

/* ① 经济画像：包一层记录 ep 与技能 */
function profile(params, games) {
  const epHist = {}, useCnt = {};
  let decisions = 0, maxEp = 0, heavy = 0;
  const inner = TA.policyChooserN(params, 0.15);
  const probe = function (state, pid, legal) {
    const ep = state.p[pid].ep;
    epHist[ep] = (epHist[ep] || 0) + 1; decisions++;
    if (ep > maxEp) maxEp = ep;
    const a = inner(state, pid, legal);
    useCnt[a.key] = (useCnt[a.key] || 0) + 1;
    const c = SA.computeCost(state, pid, a.key);
    if (c && c.ok && c.ep >= 2) heavy++;
    return a;
  };
  for (let g = 0; g < games; g++) TA.oneGameN([probe, probe, probe], 90001 + g * 131, N);
  const keys = Object.keys(epHist).map(Number).sort(function (x, y) { return x - y; });
  const dist = []; let acc = 0;
  for (const k of keys) { acc += epHist[k]; dist.push('ep' + k + ':' + (acc / decisions * 100).toFixed(0) + '%'); }
  const used = Object.keys(useCnt).length;
  const sorted = Object.keys(useCnt).sort(function (x, y) { return useCnt[y] - useCnt[x]; });
  return { decisions, maxEp, heavyRate: heavy / decisions, dist, used, useCnt, sorted };
}

function showProfile(label, p) {
  console.log(label);
  console.log('  决策=' + p.decisions + '  最大 ep=' + p.maxEp + '  贵技能(ep>=2)出手占比=' + (p.heavyRate * 100).toFixed(1) + '%');
  console.log('  ep 累积分布: ' + p.dist.join('  '));
  console.log('  用到技能种类 = ' + p.used + ' 种');
  console.log('  分布 top10: ' + p.sorted.slice(0, 10).map(function (k) {
    return (RA.byKey[k] ? RA.byKey[k].name : k) + ' ' + (p.useCnt[k] / p.decisions * 100).toFixed(1) + '%';
  }).join(' | '));
}

console.log('=== 冠军 A = ' + FILE_A + ' ===');
showProfile('[A 经济画像]', profile(A, Math.max(40, Math.floor(GAMES / 2))));

if (B) {
  console.log('\n=== 冠军 B（旧）= ' + FILE_B + ' ===');
  showProfile('[B 经济画像]', profile(B, Math.max(40, Math.floor(GAMES / 2))));
}

/* ② 对脚本对手对的 1st 率（座位轮换） */
function vsBots(params, pairs, games) {
  const first = [0, 0, 0]; let total = 0;
  for (const pair of pairs) {
    for (let g = 0; g < games; g++) {
      const seat = g % N;
      const choosers = []; let oi = 0;
      for (let pid = 0; pid < N; pid++) {
        if (pid === seat) choosers.push(TA.policyChooserN(params, 0.15));
        else { choosers.push(TA.wrapBotN(BOT[pair[oi % pair.length]])); oi++; }
      }
      const r = TA.oneGameN(choosers, 70001 + g * 977 + total, N);
      const rk = TA.rankOf(r.state, seat);
      if (rk <= 3) first[rk - 1]++;
      total++;
    }
  }
  return { first: first, total: total, firstRate: first[0] / total, top2: (first[0] + first[1]) / total };
}

const names = Object.keys(fname);
const PAIRS = [];
for (let i = 0; i < names.length; i++) for (let j = i; j < names.length; j++) PAIRS.push([fname[names[i]], fname[names[j]]]);

console.log('\n=== ② 对 ' + PAIRS.length + ' 个脚本对手对，每个 ' + Math.max(4, Math.floor(GAMES / 10)) + ' 局（座位轮换）===');
const ea = vsBots(A, PAIRS, Math.max(4, Math.floor(GAMES / 10)));
console.log('  A: 1st=' + (ea.firstRate * 100).toFixed(1) + '%  top2=' + (ea.top2 * 100).toFixed(1) + '%');
if (B) {
  const eb = vsBots(B, PAIRS, Math.max(4, Math.floor(GAMES / 10)));
  console.log('  B: 1st=' + (eb.firstRate * 100).toFixed(1) + '%  top2=' + (eb.top2 * 100).toFixed(1) + '%');
}

/* ③ head-to-head：A vs B（同一局内），座位轮换 */
if (B) {
  console.log('\n=== ③ head-to-head：A vs B（同局，座位轮换）===');
  for (const setup of [[2, 1], [1, 2]]) {
    const nA = setup[0], nB = setup[1];
    let aFirst = 0, bFirst = 0, total = 0;
    for (let g = 0; g < GAMES; g++) {
      const seats = [];
      for (let k = 0; k < nA; k++) seats.push('A');
      for (let k = 0; k < nB; k++) seats.push('B');
      const rot = g % N;
      const arr = seats.slice(rot).concat(seats.slice(0, rot));
      const choosers = arr.map(function (who, pid) {
        if (who === 'A') return TA.policyChooserN(A, 0.15);
        return WB.EpirusTrainer.policyChooserN(B, 0.15);
      });
      const r = TA.oneGameN(choosers, 88001 + g * 613, N);
      if (typeof r.winner === 'number') {
        if (arr[r.winner] === 'A') aFirst++; else bFirst++;
      }
      total++;
    }
    console.log('  A×' + nA + ' vs B×' + nB + ' → A 胜 ' + aFirst + ' / B 胜 ' + bFirst + ' / 共 ' + total + ' 局  (A 份额 ' + (aFirst / Math.max(1, aFirst + bFirst) * 100).toFixed(1) + '%)');
  }
}
