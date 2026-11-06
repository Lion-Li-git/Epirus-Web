import { writeFileSync } from 'node:fs';
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const PACK = process.argv[2] || 'scratch/night4/D-a-s13.js';
const GAMES = Number(process.argv[3] || 250);
const N = Number(process.argv[5] || 5), MODE = process.argv[6] || 'long';
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const raw = readPack2(PACK); const got = packCfgExit(raw, PACK);
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const pv = Float64Array.from(P.unpack(raw, true));
const ch = T.policyChooserN(pv, 0.1, 0, 5, 'soft');
const A = createArena2(W, { refParams: pv, temp: 0.1, stratified: false });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
const feat = (state) => {
  const me = state.p[0], ops = state.p.filter((q) => q.id !== 0 && q.hp > 0);
  const epMax = ops.reduce((a, q) => Math.max(a, q.ep || 0), 0);
  return [Math.min(me.hp, 5) / 5, ops.length / N, Math.min(state.round, 140) / 140, Math.min(me.ep, 12) / 12,
    me.bead ? 1 : 0, epMax / 5, ops.filter((q) => (q.ep || 0) >= 2).length / N, ops.filter((q) => q.bead).length / N,
    ops.filter((q) => q.lastSkill === R.SK.CHARGE).length / N, ops.filter((q) => q.lastSkill && R.ATK_EFFECT.indexOf(q.lastSkill) >= 0).length / N,
    ops.filter((q) => q.lastTarget === 0).length / N, me.baguaExtra ? 1 : 0, (me.stickers || []).length / 4];
};
const X = [], Y = [];
for (let g = 0; g < GAMES; g++) {
  let pend = null;
  const flush = (state) => {
    if (!pend) return;
    let hit = 0;
    for (const e of (state.events || []).slice(pend.c)) if (e && e.to === 0 && (e.type === 'damage' || e.type === 'blocked' || e.type === 'reflect')) hit = 1;
    X.push(pend.x); Y.push(hit); pend = null;
  };
  const focus = (state, pid, legal) => { flush(state); const x = feat(state); const a = ch(state, pid, legal); pend = { c: (state.events || []).length, x }; return a; };
  const subs = [focus];
  for (let pid = 1; pid < N; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
  T.oneGameN(subs, 94000 + g * 977, N, { mode: MODE });
}
const D = X[0].length, mu = new Array(D).fill(0), sd = new Array(D).fill(0);
for (const x of X) for (let j = 0; j < D; j++) mu[j] += x[j];
for (let j = 0; j < D; j++) mu[j] /= X.length;
for (const x of X) for (let j = 0; j < D; j++) { const d = x[j] - mu[j]; sd[j] += d * d; }
for (let j = 0; j < D; j++) sd[j] = Math.max(1e-6, Math.sqrt(sd[j] / X.length));
const Z = X.map((x) => x.map((v, j) => (v - mu[j]) / sd[j]));
let w = new Array(D).fill(0), b = 0;
for (let ep = 0; ep < 400; ep++) {
  const gw = new Array(D).fill(0); let gb = 0;
  for (let i = 0; i < Z.length; i++) { let t = b; for (let j = 0; j < D; j++) t += w[j] * Z[i][j]; const e = 1 / (1 + Math.exp(-t)) - Y[i]; for (let j = 0; j < D; j++) gw[j] += e * Z[i][j]; gb += e; }
  for (let j = 0; j < D; j++) w[j] -= 0.5 * gw[j] / Z.length;
  b -= 0.5 * gb / Z.length;
}
writeFileSync(process.argv[4] || 'scratch/gate-model.json', JSON.stringify({ w, b, mu, sd, n: X.length, base: Y.reduce((a, c) => a + c, 0) / Y.length }, null, 1));
console.log('✔ model n=' + X.length + ' 被攻击率 ' + (100 * Y.reduce((a, c) => a + c, 0) / Y.length).toFixed(1) + '%');