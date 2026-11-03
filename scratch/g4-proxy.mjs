#!/usr/bin/env node
/* g4-proxy.mjs — G4 单席代理（DS · 11-03）：1 席脚本 + 3 席 roster 随机，量被测包夺1
 * 口径对齐 G4：最克格 = 该脚本席夺冠率；线 = 被测包夺1 ≥ 40%（脚本 ≤60%）。
 * 用法：node scratch/g4-proxy.mjs --packs=a,b --style=gun --games=300
 */
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACKS = String(arg('packs', '')).split(',').map((s) => s.trim()).filter(Boolean);
const STYLE = arg('style', 'gun'), GAMES = Math.max(50, Number(arg('games', 300)) || 300);
const N = 5, MODE = arg('mode', 'long'), TEMP = 0.1;
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer;
for (const path of PACKS) {
  const raw = readPack2(path); const got = packCfgExit(raw, path);
  installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
  const pv = Float64Array.from(P.unpack(raw, true));
  const ch = T.policyChooserN(pv, TEMP, 0, N, 'soft');
  const A = createArena2(W, { refParams: pv, temp: TEMP, stratified: false });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
  const script = A.roster.find((e) => e.name === 'only:' + STYLE);
  if (!script) { console.error('no only:' + STYLE); process.exit(7); }
  let win = 0, draw = 0, scriptWin = 0, rounds = 0;
  for (let g = 0; g < GAMES; g++) {
    const subs = [ch, script.sel];
    for (let pid = 2; pid < N; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
    const r = T.oneGameN(subs, 96000 + g * 977, N, { mode: MODE });
    rounds += r.rounds || 0;
    if (r.winner === 0) win++; else if (r.winner === 1) scriptWin++; else if (r.winner == null || r.winner === 'draw') draw++;
  }
  const wv = (win + 0.5 * draw) / GAMES;
  const clean = (wv - 1 / N) / (1 - 1 / N);
  console.log(path.split('/').pop() + ' vs 1×only:' + STYLE + ' ‖ 被测夺1 ' + (100 * win / GAMES).toFixed(1) + '% ‖ 脚本夺冠 ' + (100 * scriptWin / GAMES).toFixed(1) + '% ‖ clean ' + clean.toFixed(3) + ' ‖ 局长 ' + (rounds / GAMES).toFixed(0));
}
