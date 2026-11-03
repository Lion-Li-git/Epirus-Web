#!/usr/bin/env node
/* make-norm.mjs — 为 ctx 输入算逐维 mean/std（E1 输入标准化 · DS 2026-11-02）
 * 语料：给定包打 5P long 40 局 + 5P multi 20 局，抓每次决策的 TP.xin（标准化前）。
 * 输出 {mean:[], std:[]}（std 下限 1e-2，避免放大恒定维噪声）。
 * 用法：node scratch/make-norm.mjs --pack=scratch/ga-arms/L5-D4a-s13.js --out=scratch/norm/obs3-n.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/ga-arms/L5-D4a-s13.js'), OUT = arg('out', 'scratch/norm/obs3-n.json');
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const raw = readPack2(PACK); const got = packCfgExit(raw, PACK);
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const pv = Float64Array.from(P.unpack(raw, true));
const xs = [];
function run(mode, games, N) {
  const ch = T.policyChooserN(pv, 0.15, 0, N, 'soft');
  const A = createArena2(W, { refParams: pv, temp: 0.15, stratified: false });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === mode);
  for (let g = 0; g < games; g++) {
    const focus = (state, pid, legal) => {
      const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
      if (cs.length >= 2) { const fr = P.forwardCands(state, pid, cs, pv, { temp: 1, wantTape: 1 }); if (fr && fr.tape && fr.tape.xin) xs.push(Array.from(fr.tape.xin)); }
      return ch(state, pid, legal);
    };
    const subs = [focus];
    for (let pid = 1; pid < N; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
    T.oneGameN(subs, 98000 + g * 977, N, { mode });
  }
}
run('long', 40, 5);
run('multi', 20, 5);
const D = xs[0].length, mean = new Array(D).fill(0), std = new Array(D).fill(0);
for (const x of xs) for (let j = 0; j < D; j++) mean[j] += x[j];
for (let j = 0; j < D; j++) mean[j] /= xs.length;
for (const x of xs) for (let j = 0; j < D; j++) { const d = x[j] - mean[j]; std[j] += d * d; }
for (let j = 0; j < D; j++) std[j] = Math.max(1e-2, Math.sqrt(std[j] / Math.max(1, xs.length - 1)));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ mean: mean.map((v) => Number(v.toFixed(6))), std: std.map((v) => Number(v.toFixed(6))), n: xs.length, dims: D }, null, 1));
const nearZero = std.filter((s) => s <= 1e-2).length;
console.log('✔ ' + OUT + '（' + D + ' 维，' + xs.length + ' 决策）‖ std 被下限夹住 ' + nearZero + ' 维');
