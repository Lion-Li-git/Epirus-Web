/* E7（09-25 夜 · 交接 §4 最后一条）：**座位极差必须在同一口径下报**，而且要带噪声带
 *
 * 病（交接 §3.2 + 我 09-25 凌晨在 `probe-ideal-champion` 里抓到的口径分裂）：
 *   ① 同一只包 n=60 读 43.2pt、n=400 读 26.6pt ⇒ **不写 n 的极差没有意义**；
 *   ② 更要紧的是 `audit-lib.seatSymmetry` 内部写死 `policyChooserN(params, 0.15)`（ε=0，**评测口径**），
 *      而玩家看到的是 `ui.js:464` 的 `pickChampion(..., 0.15, 0.2, 5, 'soft')`（**产品口径**）⇒
 *      "座位无偏"在两个口径下可以是两个数，而且**方向随包变**（实测见下）。
 *      ⚠️ 这不止 seatSymmetry 一处：`audit-lib.mjs` 里 9 个探针（reflectWall/ringWallProbe/fieldRate/sniperField/
 *      seatSymmetry/densityProfile/chargeProfile/aggressionProfile/breadthProfile）+ `evo.js` 4 处全是同一个写死
 *      ⇒ **整个评测层跑在 ε=0**（METHODOLOGY 49 的另一半）。
 *
 * 设计：**配对**。两栏用同一套 seed 序列（`seedBase+g`）与同一 `slotSalt` 公式，只有 Chooser 的 ε 不同
 *   ⇒ 两栏之差只可能来自口径，不来自抽样。噪声带靠换 `seedBase` 取多次重复（`--reps`）。
 *   自检：我的 ε=0 复刻必须与 `seatSymmetry` 在 `seedBase=12000` 时**逐字相同**，否则整张表作废（会打印 ⛔ 并非零退出）。
 *
 * 用法：node tools/probe-seat-caliber.mjs [--packs=a,b] [--ns=60,200,400] [--mode=multi] [--reps=3]
 * 只读：不训练、不落盘、不改任何产物。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { seatSymmetry, nullSpreadQuantile, mulberry32 } from './audit-lib.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
const PACKS = arg('packs', 'js/bundled-champion-3p.js,docs/artifacts/cbs1s2-band2.bak,docs/artifacts/cbs1s5-band1.bak,docs/artifacts/co1s8-band1.bak,docs/artifacts/v7aim3-93.bak').split(',');
const NS = arg('ns', '60,100,200,400').split(',').map(Number);
const MODE = arg('mode', 'multi');
const REPS = Number(arg('reps', 3));
const SEED0 = Number(arg('seed0', 12000));

function loadPack(file) {
  const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
  sb.window = sb; sb.globalThis = sb;
  for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
    'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', file]) {
    vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
  }
  const Pol = sb.EpirusPolicy;
  const params = Pol.unpack(sb.EPIRUS_CHAMPION_3P, true) || Pol.unpack(sb.EPIRUS_CHAMPION, true);
  return { sb: sb, params: params };
}

/* seatSymmetry 的**可注入口径**复刻：除 `policyChooserN(params, temp, eps, epsK, epsMode)` 一处外，
 * 其余（seed 序列、slotSalt 公式、判胜口径、分母=决定性局数）逐行对齐 audit-lib.mjs:396-419。 */
function seatSpread(W, params, opts) {
  const S = W.sb.EpirusState, T = W.sb.EpirusTrainer, Play = W.sb.EpirusPlay, G = opts.games;
  const win = [0, 0, 0, 0, 0];
  let dec = 0, draw = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(MODE === 'long' ? 'long' : 'multi', { next: mulberry32(opts.seedBase + g) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const base = T.policyChooserN(params, opts.temp, opts.eps, opts.epsK, opts.epsMode);
    Play.autoGameN(st, [base, base, base, base, base]);
    if (st.winner === 'draw' || st.winner == null) { draw++; continue; }
    win[st.winner]++; dec++;
  }
  const pct = win.map(function (x) { return 100 * x / Math.max(1, dec); });
  return {
    pct: pct, win: win, decisive: dec, draw: draw,
    spread: Math.max.apply(null, pct) - Math.min.apply(null, pct),
    decisiveRate: dec / G
  };
}
const CAL = [
  { key: '评测 ε=0（=seatSymmetry/各门）', short: '评测', temp: 0.15, eps: 0 },
  { key: '产品 ε=0.2 k=5 soft（=ui.js:464）', short: '产品', temp: 0.15, eps: 0.2, epsK: 5, epsMode: 'soft' },
];
const med = function (a) { const b = a.slice().sort(function (x, y) { return x - y; }); return b[b.length >> 1]; };

console.log('# 座位极差 × {n, 口径}（' + MODE + ' · 5 席 · 每格 ' + REPS + ' 个 seed 基址取中位数 · 线 = 该 n 的零分布 p99）');
console.log('# 两栏**配对**：同一 seed 序列、同一 slotSalt，只有 Chooser 的 ε 不同 ⇒ 差值只来自口径。\n');

/* 自检：ε=0 复刻必须与单一真源逐字相同（不同 ⇒ 这张表的"评测栏"是我编的，直接作废） */
{
  const W = loadPack(PACKS[0]);
  if (!W.params) { console.log('⛔ 第一只包就解不出参数：' + PACKS[0]); process.exit(7); }
  const mine = seatSpread(W, W.params, { games: 100, seedBase: SEED0, temp: 0.15, eps: 0 });
  const src = seatSymmetry(W.sb, W.params, MODE, 100);
  if (mine.win.join(',') !== src.win.join(',') || mine.decisive !== src.decisive) {
    console.log('⛔ 复刻与 `seatSymmetry` 不一致（我 ' + mine.win.join('/') + ' vs 真源 ' + src.win.join('/') + '）');
    console.log('   ⇒ 说明 audit-lib 的装配又变了：这张表的评测栏不可信，先去对齐 seatSpread()。');
    process.exit(8);
  }
  console.log('✓ 自检：ε=0 复刻与 `seatSymmetry` 在 n=100/seed0=' + SEED0 + ' 下回胜利逐字相同（' + mine.win.join('/') + '）\n');
}

const rows = [];
for (const f of PACKS) {
  const W = loadPack(f);
  const name = f.replace(/^.*\//, '').replace(/\.bak$/, '').replace(/^bundled-champion-3p\.js$/, '现役 3p');
  if (!W.params) { console.log('⚠️ ' + f + ' 解不出参数，跳过'); continue; }
  console.log('## ' + name);
  console.log('   n        评测口径 ε=0            产品口径 ε=.2         差        零分布p99线');
  for (const n of NS) {
    const line = Math.round(nullSpreadQuantile(n, 5, 0.99) * 10) / 10;
    const cells = CAL.map(function (c) {
      const s = [], dr = [];
      for (let r = 0; r < REPS; r++) {
        const x = seatSpread(W, W.params, Object.assign({ games: n, seedBase: SEED0 + r * 100003 }, c));
        s.push(x.spread); dr.push(x.decisiveRate);
      }
      return { med: med(s), min: Math.min.apply(null, s), max: Math.max.apply(null, s), decMed: med(dr) };
    });
    const flag = function (x) { return x.med >= line ? '⛔' : (x.max >= line ? '⚠' : '✓'); };
    console.log('   ' + String(n).padStart(4) + '  ' +
      (cells[0].med.toFixed(1) + 'pt[' + cells[0].min.toFixed(1) + '~' + cells[0].max.toFixed(1) + ']').padEnd(22) + ' ' +
      (cells[1].med.toFixed(1) + 'pt[' + cells[1].min.toFixed(1) + '~' + cells[1].max.toFixed(1) + ']').padEnd(22) + ' ' +
      ((cells[1].med - cells[0].med >= 0 ? '+' : '') + (cells[1].med - cells[0].med).toFixed(1) + 'pt').padStart(8) + '  ' +
      line.toFixed(1) + 'pt  ' + flag(cells[0]) + '/' + flag(cells[1]) +
      '（判胜中位 ' + (100 * cells[0].decMed).toFixed(0) + '% / ' + (100 * cells[1].decMed).toFixed(0) + '%）');
    rows.push({ pack: name, n: n, gate: cells[0], prod: cells[1], line: line });
  }
}
if (!rows.length) { console.log('\n⛔ 一格读数都没有 ⇒ 这不是"没有偏置"，是没量到'); process.exit(6); }

/* 翻转检测：同一格两栏**越过/落在线两侧** ⇒ "座位无偏"这句话取决于口径，必须写死用哪个 */
const flips = rows.filter(function (r) { return (r.gate.med >= r.line) !== (r.prod.med >= r.line); });
console.log('\n## 结论读数');
console.log('   两栏在同一条线上**判定相反**的格子：' + (flips.length ? flips.map(function (r) {
  return r.pack + ' n=' + r.n + '（评测 ' + r.gate.med.toFixed(1) + ' vs 产品 ' + r.prod.med.toFixed(1) + '，线 ' + r.line.toFixed(1) + '）';
}).join('\n     ') : '无'));
const bigGap = rows.filter(function (r) { return Math.abs(r.prod.med - r.gate.med) >= r.line * 0.5; });
console.log('   |差| ≥ 半条线的格子：' + bigGap.length + '/' + rows.length + ' —— ' +
  bigGap.map(function (r) { return r.pack + '@n' + r.n + ' ' + ((r.prod.med - r.gate.med >= 0 ? '+' : '') + (r.prod.med - r.gate.med).toFixed(1)); }).join(' · '));
console.log('   ⇒ 交接 §4-E7 要的"一律按 n=400 报"能压住 n 引起的噪声，但**压不住口径**：见上两行是否有内容。');
