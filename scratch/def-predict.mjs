#!/usr/bin/env node
/* def-predict.mjs — 「这一回合我会不会被攻击」在公开信息上可预测吗（DS · 11-03）
 * 若 AUC≈0.5 ⇒ 时机不可预测（防御准头只能靠规则/场景改）；AUC 明显 >0.5 ⇒ 有可学的条件信号。
 * 用法：node scratch/def-predict.mjs --pack=... --games=300
 */
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/night4/D-a-s13.js'); const GAMES = Math.max(50, Number(arg('games', 300)) || 300);
const N = 5, MODE = 'long', TEMP = 0.1;
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const raw = readPack2(PACK); const got = packCfgExit(raw, PACK);
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const pv = Float64Array.from(P.unpack(raw, true));
const ch = T.policyChooserN(pv, TEMP, 0, N, 'soft');
const A = createArena2(W, { refParams: pv, temp: TEMP, stratified: false });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
const X = [], Y = [], XI = [];
const feat = (state) => {
  const me = state.p[0], ops = state.p.filter((q) => q.id !== 0 && q.hp > 0);
  const epMax = ops.reduce((a, q) => Math.max(a, q.ep || 0), 0);
  const nGun = ops.filter((q) => (q.ep || 0) >= 2).length;
  const nBead = ops.filter((q) => q.bead).length;
  const nCharge = ops.filter((q) => q.lastSkill === R.SK.CHARGE).length;
  const nAtk = ops.filter((q) => q.lastSkill && R.ATK_EFFECT.indexOf(q.lastSkill) >= 0).length;
  const tgtMe = (me.lastTarget === 0) ? 0 : ops.filter((q) => q.lastTarget === 0).length;
  return [Math.min(me.hp, 5) / 5, ops.length / 5, Math.min(state.round, 140) / 140, Math.min(me.ep, 12) / 12,
    me.bead ? 1 : 0, epMax / 5, nGun / 5, nBead / 5, nCharge / 5, nAtk / 5, tgtMe / 5,
    (me.baguaExtra ? 1 : 0), (me.stickers || []).length / 4];
};
for (let g = 0; g < GAMES; g++) {
  let pend = null;
  const flush = (state) => {
    if (!pend) return;
    let hit = 0;
    for (const e of (state.events || []).slice(pend.c)) if (e && e.to === 0 && (e.type === 'damage' || e.type === 'blocked' || e.type === 'reflect' || e.type === 'transfer')) hit = 1;
    X.push(pend.x); Y.push(hit); if (pend.xin) XI.push(pend.xin); pend = null;
  };
  const focus = (state, pid, legal) => {
    flush(state);
    const x = feat(state);
    let xin = null;
    try { const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }); if (cs && cs.length) { const fr = P.forwardCands(state, pid, cs, pv, { temp: 1, wantTape: 1 }); if (fr && fr.tape && fr.tape.xin) xin = Array.from(fr.tape.xin); } } catch (e) {}
    const a = ch(state, pid, legal);
    pend = { c: (state.events || []).length, x, xin };
    return a;
  };
  const subs = [focus];
  for (let pid = 1; pid < N; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
  T.oneGameN(subs, 97000 + g * 977, N, { mode: MODE });
}
const D = X[0].length, n = X.length;
const idx = []; for (let i = 0; i < n; i++) idx.push(i);
for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
const cut = Math.floor(n * 0.8);
const tr = idx.slice(0, cut), te = idx.slice(cut);
const mu = new Array(D).fill(0), sd = new Array(D).fill(0);
for (const i of tr) for (let j = 0; j < D; j++) mu[j] += X[i][j];
for (let j = 0; j < D; j++) mu[j] /= tr.length;
for (const i of tr) for (let j = 0; j < D; j++) { const d = X[i][j] - mu[j]; sd[j] += d * d; }
for (let j = 0; j < D; j++) sd[j] = Math.max(1e-6, Math.sqrt(sd[j] / tr.length));
const z = (i) => X[i].map((v, j) => (v - mu[j]) / sd[j]);
const w = new Array(D).fill(0); let b = 0;
const sig = (t) => 1 / (1 + Math.exp(-t));
for (let ep = 0; ep < 400; ep++) {
  const gw = new Array(D).fill(0); let gb = 0;
  for (const i of tr) { const xi = z(i); let t = b; for (let j = 0; j < D; j++) t += w[j] * xi[j]; const e = sig(t) - Y[i]; for (let j = 0; j < D; j++) gw[j] += e * xi[j]; gb += e; }
  for (let j = 0; j < D; j++) w[j] -= 0.5 * gw[j] / tr.length;
  b -= 0.5 * gb / tr.length;
}
const score = (i) => { const xi = z(i); let t = b; for (let j = 0; j < D; j++) t += w[j] * xi[j]; return t; };
const pairs = [];
for (const i of te) pairs.push([score(i), Y[i]]);
pairs.sort((a, b) => a[0] - b[0]);
let pos = 0, neg = 0, auc = 0;
for (const [s, y] of pairs) { if (y === 1) { auc += neg; pos++; } else neg++; }
auc = pos && neg ? auc / (pos * neg) : 0.5;
const base = Y.reduce((a, b) => a + b, 0) / n;
console.log(PACK.split('/').pop() + ' ‖ 样本 ' + n + ' ‖ 被攻击率 ' + (100 * base).toFixed(1) + '% ‖ 测试 AUC ' + auc.toFixed(3) + '（0.5=不可预测）');
console.log('   权重前5: ' + w.map((v, j) => [j, v]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5).map(([j, v]) => 'f' + j + '=' + v.toFixed(2)).join(' '));
if (XI.length > 100) {
  const D2 = XI[0].length, mu2 = new Array(D2).fill(0), sd2 = new Array(D2).fill(0);
  for (const x of XI) for (let j = 0; j < D2; j++) mu2[j] += x[j];
  for (let j = 0; j < D2; j++) mu2[j] /= XI.length;
  for (const x of XI) for (let j = 0; j < D2; j++) { const d = x[j] - mu2[j]; sd2[j] += d * d; }
  for (let j = 0; j < D2; j++) sd2[j] = Math.max(1e-6, Math.sqrt(sd2[j] / XI.length));
  const Z = XI.map((x) => x.map((v, j) => (v - mu2[j]) / sd2[j]));
  let w2 = new Array(D2).fill(0), b2 = 0;
  for (let ep = 0; ep < 300; ep++) {
    const gw = new Array(D2).fill(0); let gb = 0;
    for (let i = 0; i < Z.length; i++) { let t = b2; for (let j = 0; j < D2; j++) t += w2[j] * Z[i][j]; const e = 1 / (1 + Math.exp(-t)) - Y[i]; for (let j = 0; j < D2; j++) gw[j] += e * Z[i][j]; gb += e; }
    for (let j = 0; j < D2; j++) w2[j] -= 0.4 * gw[j] / Z.length;
    b2 -= 0.4 * gb / Z.length;
  }
  const sc = Z.map((z, i) => { let t = b2; for (let j = 0; j < D2; j++) t += w2[j] * z[j]; return [t, Y[i]]; }).sort((a, b) => a[0] - b[0]);
  let pos = 0, neg = 0, auc2 = 0;
  for (const [s, y] of sc) { if (y === 1) { auc2 += neg; pos++; } else neg++; }
  auc2 = pos && neg ? auc2 / (pos * neg) : 0.5;
  console.log('   网络自己的输入（xin ' + D2 + ' 维）→ 被攻击 AUC ' + auc2.toFixed(3));
}