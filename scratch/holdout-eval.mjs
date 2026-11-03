#!/usr/bin/env node
/* holdout-eval.mjs — E3 固定留出（DS · 2026-11-02 晚）：同一批固定种子局，给一组包打分
 * 用法：node scratch/holdout-eval.mjs --packs=a,b,c [--long=100] [--multi=60]
 * 输出每包：5:long clean / 5:multi clean / 夺1
 */
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACKS = String(arg('packs', '')).split(',').map((s) => s.trim()).filter(Boolean);
const NL = Math.max(10, Number(arg('long', 100)) || 100), NM = Math.max(10, Number(arg('multi', 60)) || 60);
const TEMP = 0.1, N = 5;
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer;

for (const path of PACKS) {
  const raw = readPack2(path); const got = packCfgExit(raw, path);
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
      if (r.winner === 0) win++; else if (r.winner === 'draw' || r.winner == null) draw++;
    }
    const wv = (win + 0.5 * draw) / games;   /* 比例，不是颗数 */
    const clean = (wv - 1 / N) / (1 - 1 / N);
    out.push(mode + '=' + clean.toFixed(3) + '(夺1 ' + (100 * win / games).toFixed(1) + '%)');
  }
  console.log(path.split('/').pop() + ' ‖ ' + out.join(' ‖ '));
}