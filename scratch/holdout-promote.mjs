/* holdout-promote.mjs — E3-lite（ZCode · 11-03 凌晨）：**不动 train-3p 选拔管线**的固定留出复排。
 * 用法：node scratch/holdout-promote.mjs --dir=scratch/night4/bands/D-a2b [--product=scratch/night4/D-a2-s13.js] [--long=100] [--multi=60]
 * 量什么：band*.bak 全体 + 产物（若给）在同一把固定种子尺（700000/800000 基座，5P long+multi，DS 的 E3 口径）上复排；
 * 输出排序 + "若按留出选，产物该是谁"——只报告不换文件（转正与否晨班裁）。
 * 依赖：scratch/holdout-eval.mjs 的同款世界（arena2 平均场、temp 0.1、非 stratified）。 */
import { readdirSync, readFileSync } from 'node:fs';
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const DIR = String(arg('dir', ''));
const PRODUCT = String(arg('product', ''));
const NL = Math.max(10, Number(arg('long', 100)) || 100), NM = Math.max(10, Number(arg('multi', 60)) || 60);
const TEMP = 0.1, N = 5;
if (!DIR && !PRODUCT) { console.error('要 --dir=<band目录> 或 --product=<产物>'); process.exit(2); }

const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const cand = [];
if (DIR) for (const f of readdirSync(DIR).filter((x) => /band\d+\.bak$/.test(x)).sort()) cand.push({ name: f.replace(/\.bak$/, ''), path: DIR + '/' + f });
if (PRODUCT) cand.push({ name: 'product', path: PRODUCT });

const COV = Number(arg('coverage', 0)) || 0;
const COVW = Number(arg('covW', 0)) || 0;   /* >0：给"技能种数"加权重（选择压） */   /* --coverage=1：加跑覆盖探针（防御份额/准确 + mine/drain），排序加覆盖项 */
const scores = [];
for (const c of cand) {
  try {
    const raw = readPack2(c.path); const got = packCfgExit(raw, c.path);
    installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
    const pv = Float64Array.from(P.unpack(raw, true));
    const out = [];
    for (const [mode, games, base] of [['long', NL, 700000], ['multi', NM, 800000]]) {
      const A = createArena2(W, { refParams: pv, temp: TEMP, stratified: false });
      const sh = A.shapes.findIndex((s) => s.n === N && s.mode === mode);
      const ch = T.policyChooserN(pv, TEMP, 0, N, 'soft');
      let win = 0, draw = 0;
      for (let g = 0; g < games; g++) {
        const subs = [ch];
        for (let pid = 1; pid < N; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
        const r = T.oneGameN(subs, base + g * 977, N, { mode });
        if (r.winner === 0) win++; else if (r.winner == null || r.winner === 'draw') draw++;
      }
      out.push({ mode, clean: (100 * win / games).toFixed(1), win, draw });
    }
    /* --coverage=1：覆盖探针（8P long 20 局数 mine/tank/snipe + 残血开局数 drain + 5P long 数防御族份额） */
    let cov = null;
    if (COV) {
      const DEFSET = new Set(['guard', 'reflect', 'bagua', 'shift', 'jinshield', 'proto', 'armor', 'holo']);
      function covProbe(np, mode, hpStart, games, base) {
        const ch = T.policyChooserN(pv, TEMP, 0, N, 'soft');
        const sel = {}; let defN = 0, defTot = 0;
        for (let g = 0; g < games; g++) {
          const st = W.EpirusState.createState(mode, { next: T.mulberry32(base + g * 977) }, np);
          if (hpStart) for (const q of st.p) if (q && q.hp > 0) q.hp = Math.min(hpStart, (st.mode && st.mode.hp) || 3);
          const subs = [];
          for (let pid = 0; pid < np; pid++) {
            subs.push(pid === 0 ? function (state, pid, legal) {
              const a = ch(state, pid, legal);
              const k = (a && typeof a === 'object') ? (a.key || '') : String(a);
              if (DEFSET.has(k)) { defTot++; if (state.p[pid] && state.p[pid].hp <= 1) defN++; }
              sel[k] = (sel[k] || 0) + 1;
              return a;
            } : W.EpirusBots.pickRandom);
          }
          W.EpirusPlay.autoGameN(st, subs);
        }
        return sel;
      }
      const s8 = covProbe(8, 'long', 0, 16, 600000), sLow = covProbe(5, 'long', 2, 16, 610000), s5 = covProbe(5, 'long', 0, 16, 620000);
      const tot5 = Object.keys(s5).reduce((a, k) => a + (DEFSET.has(k) ? 0 : s5[k]), 0) || 1;
      let defShare = 0; for (const k of DEFSET) defShare += s5[k] || 0;
      cov = { mine8: s8[R.SK.MINE] || 0, drainLow: sLow[R.SK.DRAIN] || 0, tank: (s5[R.SK.TANK] || 0) + (s8[R.SK.TANK] || 0),
        snipe: (s5[R.SK.SNIPE] || 0) + (s8[R.SK.SNIPE] || 0), defShare: +(100 * defShare / tot5).toFixed(1),
        breadth: Object.keys(s5).filter((k) => k !== R.SK.JI && (s5[k] || 0) > 0).length };
    }
    scores.push({ name: c.name, out, cov });
    console.log(c.name.padEnd(14) + ' ‖ ' + out.map((o) => o.mode + ' clean=' + o.clean + '%').join(' ‖ ') +
      (cov ? ' ‖ 覆盖: mine8=' + cov.mine8 + ' drain残血=' + cov.drainLow + ' 坦/狙=' + cov.tank + '/' + cov.snipe + ' DEF份额=' + cov.defShare + '% 种数=' + cov.breadth : ''));
  } catch (e) { console.log('⛔ ' + c.name + '：' + e.message); }
}
if (scores.length) {
  const sc = (s) => parseFloat(s.out.find((o) => o.mode === 'long').clean) * 2 + parseFloat(s.out.find((o) => o.mode === 'multi').clean) + (s.cov ? COVW * s.cov.breadth : 0);
  const ranked = scores.slice().sort((a, b) => sc(b) - sc(a));
  console.log('\n[留出复排] 首选 = ' + ranked[0].name + '（long*2+multi' + (COVW ? ' + ' + COVW + '×种数' : '') + ' 加权；两界固定种子 ' + 700000 + '/' + 800000 + '）');
  if (COVW && scores[0].cov) console.log('[留出复排] 种数权重下前三：' + ranked.slice(0, 3).map((s) => s.name + '（种数 ' + (s.cov ? s.cov.breadth : '?') + '，long ' + s.out.find((o) => o.mode === 'long').clean + '%）').join(' ‖ '));
  const prod = scores.find((s) => s.name === 'product');
  if (prod && ranked[0].name !== 'product') console.log('[留出复排] ⚠ 产物不是留出最优 ⇒ E3 会换人（换不换等裁，本工具只报告）');
}