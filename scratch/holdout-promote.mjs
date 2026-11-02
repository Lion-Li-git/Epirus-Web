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

const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer;
const cand = [];
if (DIR) for (const f of readdirSync(DIR).filter((x) => /^band\d+\.bak$/.test(x)).sort()) cand.push({ name: f, path: DIR + '/' + f });
if (PRODUCT) cand.push({ name: 'product', path: PRODUCT });

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
    scores.push({ name: c.name, out });
    console.log(c.name.padEnd(14) + ' ‖ ' + out.map((o) => o.mode + ' clean=' + o.clean + '%').join(' ‖ '));
  } catch (e) { console.log('⛔ ' + c.name + '：' + e.message); }
}
if (scores.length) {
  const ranked = scores.slice().sort((a, b) => (parseFloat(b.out.find((o) => o.mode === 'long').clean) * 2 + parseFloat(b.out.find((o) => o.mode === 'multi').clean)) - (parseFloat(a.out.find((o) => o.mode === 'long').clean) * 2 + parseFloat(a.out.find((o) => o.mode === 'multi').clean)));
  console.log('\n[留出复排] 首选 = ' + ranked[0].name + '（long*2+multi 加权；两界固定种子 ' + 700000 + '/' + 800000 + '）');
  const prod = scores.find((s) => s.name === 'product');
  if (prod && ranked[0].name !== 'product') console.log('[留出复排] ⚠ 产物不是留出最优 ⇒ E3 会换人（换不换等裁，本工具只报告）');
}
