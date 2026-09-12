/* 多人冠军评测：全部对手组合 × 座位轮换 → 1st/top2 率 + 出招分布
 * 用法：node tools/eval-3p.mjs [每对局数=20] [人数=3]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const GAMES = Number(process.argv[2] || 20);
const N = Number(process.argv[3] || 3);
const FILE = process.argv[4] || 'js/bundled-champion-3p.js';   // v1.3.57: 支持指定冠军文件以便 A/B

const sb = {
  console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN,
  parseInt, parseFloat, Float64Array, Date
};
sb.window = sb; sb.globalThis = sb;
for (const f of [
  'js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', FILE
]) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });

const P = sb.window.EpirusPolicy;
const R = sb.window.EpirusRules;
const Bots = sb.window.EpirusBots;
const T = sb.window.EpirusTrainer;

const params = P.unpack(sb.window.EPIRUS_CHAMPION_3P);
if (!params) { console.log('冠军包不兼容：' + JSON.stringify(P.checkPack(sb.window.EPIRUS_CHAMPION_3P))); process.exit(1); }
const meta = sb.window.EPIRUS_CHAMPION_3P_META || {};
console.log('冠军 meta: ' + JSON.stringify(meta));
console.log('文件: ' + FILE);

const BOTS = [
  ['random', Bots.pickRandom], ['aggro', Bots.pickAggro], ['defend', Bots.pickDefend],
  ['balanced', Bots.pickBalanced], ['antidef', Bots.pickAntiDef], ['breakdef', Bots.pickBreakDef],
  ['wall', Bots.pickWall], ['mix', Bots.pickMix],
  ['farmer', Bots.pickFarmer]
];

const counts = {};
let first = 0, second = 0, third = 0, total = 0;
let seatFirst = [0, 0, 0, 0, 0], seatGames = [0, 0, 0, 0, 0];

function champSel(temp) {
  return function (state, pid, legal) {
    const r = T.policyChooserN(params, temp)(state, pid, legal);
    counts[r.key] = (counts[r.key] || 0) + 1;
    return r;
  };
}

const t0 = Date.now();
for (let a = 0; a < BOTS.length; a++) {
  for (let b = a + 1; b < BOTS.length; b++) {
    for (let g = 0; g < GAMES; g++) {
      const seat = g % N;
      const choosers = [];
      let oi = 0;
      const pair = [BOTS[a][1], BOTS[b][1]];
      for (let pid = 0; pid < N; pid++) {
        if (pid === seat) choosers.push(champSel(0.15));
        else { choosers.push(T.wrapBotN(pair[oi % pair.length])); oi++; }
      }
      const r = T.oneGameN(choosers, 77000 + a * 131 + b * 17 + g * 977, N);
      const rank = T.rankOf(r.state, seat, 77000 + a * 131 + b * 17 + g * 977);   // v1.3.57: 同上
      if (rank === 1) first++; else if (rank === 2) second++; else third++;
      if (rank === 1) seatFirst[seat]++;
      seatGames[seat]++;
      total++;
    }
  }
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log('\n=== ' + N + ' 人全组合评测（' + (BOTS.length*(BOTS.length-1)/2) + ' 对 × ' + GAMES + ' 局 = ' + total + ' 局，座位轮换，temp0.15）===');
console.log('1st = ' + (first / total * 100).toFixed(1) + '%   top2 = ' + ((first + second) / total * 100).toFixed(1) +
  '%   (1st/2nd/3rd = ' + first + '/' + second + '/' + third + ')');
console.log('随机基线：1st 33.3% / top2 66.7%');
console.log('各座位 1st 率：' + seatGames.map(function (g, i) { return 'P' + i + '=' + (g ? (seatFirst[i] / g * 100).toFixed(0) : '-') + '%'; }).join(' '));

const totalPicks = Object.keys(counts).reduce(function (s, k) { return s + counts[k]; }, 0);
const sorted = Object.keys(counts).sort(function (x, y) { return counts[y] - counts[x]; });
console.log('\n出招分布（共 ' + totalPicks + ' 次）：');
for (const k of sorted.slice(0, 12)) {
  const nm = R.byKey[k] ? R.byKey[k].name : k;
  console.log('  ' + nm.padEnd(8) + (counts[k] / totalPicks * 100).toFixed(1) + '%');
}
const multiOnly = ['dualGun', 'mirror'];
console.log('多人专用技能使用：' + multiOnly.map(function (k) {
  return (R.byKey[k] ? R.byKey[k].name : k) + '=' + ((counts[k] || 0) / totalPicks * 100).toFixed(2) + '%';
}).join('  '));
console.log('耗时 ' + secs + 's');
