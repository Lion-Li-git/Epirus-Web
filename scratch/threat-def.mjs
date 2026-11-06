#!/usr/bin/env node
/* threat-def.mjs — 「威胁门控防御」后处理：用 AUC 0.77 的公开特征预测器给防御挑时机（DS · 11-03）
 * 做法：先在目标包的对局里拟合 logistic（被攻击 vs 公开特征），
 *   再跑两组对局：裸包 vs 裸包+后处理（p>=T 且当前不是防御、且合法防御里有牌 ⇒ 改出防御）。
 * 量：夺1、防御手/局、有效（blocked|defended）、白防。
 * 用法：node scratch/threat-def.mjs --pack=... --table=gun|mix --games=150
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/arms/OC3C-L5D4a.bak'), TABLE = arg('table', 'gun'), GAMES = Math.max(40, Number(arg('games', 150)) || 150);
const N = Math.max(2, Number(arg('n', 5)) || 5), MODE = arg('mode', 'long'), TEMP = 0.1;
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
let pv = null;
try {
  const raw = readPack2(PACK);
  if (raw && raw.v === 92) { const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); }
} catch (e) {}
if (!pv) pv = Float64Array.from(loadChamp(W, PACK, '.'));   /* v7 包 */
const ch = T.policyChooserN(pv, TEMP, 0, N, 'soft');
const A = createArena2(W, { refParams: pv, temp: TEMP, stratified: false });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
const DEFKEYS = ['reflect', 'guard', 'jinshield', 'bagua', 'proto', 'armor', 'holo'];
const feat = (state) => {
  const me = state.p[0], ops = state.p.filter((q) => q.id !== 0 && q.hp > 0);
  const epMax = ops.reduce((a, q) => Math.max(a, q.ep || 0), 0);
  return [Math.min(me.hp, 5) / 5, ops.length / N, Math.min(state.round, 140) / 140, Math.min(me.ep, 12) / 12,
    me.bead ? 1 : 0, epMax / 5, ops.filter((q) => (q.ep || 0) >= 2).length / N, ops.filter((q) => q.bead).length / N,
    ops.filter((q) => q.lastSkill === R.SK.CHARGE).length / N, ops.filter((q) => q.lastSkill && R.ATK_EFFECT.indexOf(q.lastSkill) >= 0).length / N,
    ops.filter((q) => q.lastTarget === 0).length / N, me.baguaExtra ? 1 : 0, (me.stickers || []).length / 4];
};
function opps(g) {
  const out = [];
  for (let pid = 1; pid < N; pid++) {
    if (TABLE === 'gun') { out.push(A.roster.find((e) => e.name === 'only:gun').sel); continue; }
    if (TABLE === 'guard') { out.push(A.roster.find((e) => e.name === 'only:guard').sel); continue; }
    let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri];
    while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
    out.push(e.sel);
  }
  return out;
}
function run(withWrapper, T_, fit) {
  const X = [], Y = [];
  let win = 0, draw = 0, def = 0, blk = 0, n = 0;
  for (let g = 0; g < GAMES; g++) {
    let pend = null;
    const flush = (state) => {
      if (!pend) return;
      let hit = 0, blocked = 0;
      for (const e of (state.events || []).slice(pend.c)) if (e && e.to === 0) { if (e.type === 'damage') hit = 1; if (e.type === 'blocked' || e.type === 'reflect') { hit = 1; blocked = 1; } }
      if (fit) { X.push(pend.x); Y.push(hit); }
      if (pend.isDef) { def++; if (blocked) blk++; }
      pend = null;
    };
    const focus = (state, pid, legal) => {
      flush(state);
      let a = ch(state, pid, legal);
      if (withWrapper && fit === null) {
        const x = feat(state), p = sig(dot(w, x.map((v, j) => (v - mu[j]) / sd[j])) + b);
        const isDef = a && DEFKEYS.indexOf(a.key) >= 0;
        const hpOk = !process.env.HPMAX || (state.p[0] && state.p[0].hp <= Number(process.env.HPMAX));
        if (!isDef && p >= T_ && hpOk) {
          const pick = (function () {
            const defs = legal.filter((l) => DEFKEYS.indexOf(l.key) >= 0 && l.affordable !== false);
            if (!defs.length) return null;
            if (!process.env.SMART) return defs[0];
            const ops = state.p.filter((q) => q.id !== 0 && q.hp > 0);
            const refl = ops.filter((q) => q.lastSkill === R.SK.GUN || q.lastSkill === R.SK.TANK || q.lastSkill === R.SK.DUAL_GUN).length;
            const want = refl >= ops.length / 2 ? 'reflect' : 'guard';
            return defs.find((d) => d.key === want) || defs.find((d) => d.key === 'jinshield') || defs[0];
          })();
          if (pick) a = pick;
        }
      }
      const k = (a && typeof a === 'object') ? (a.key || '') : String(a);
      pend = { c: (state.events || []).length, isDef: DEFKEYS.indexOf(k) >= 0, x: feat(state) };
      return a;
    };
    const subs = [focus, ...opps(g)];
    const r = T.oneGameN(subs, 95000 + g * 977, N, { mode: MODE });
    n++;
    if (r.winner === 0) win++; else if (r.winner == null || r.winner === 'draw') draw++;
  }
  return { win, draw, def, blk, n, X, Y };
}
const sig = (t) => 1 / (1 + Math.exp(-t));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
/* 1) 拟合：裸包跑 GAMES 局收数据 */
const F = run(false, 0, true);
const X = F.X, Y = F.Y, D = X[0].length;
const mu = new Array(D).fill(0), sd = new Array(D).fill(0);
for (const x of X) for (let j = 0; j < D; j++) mu[j] += x[j];
for (let j = 0; j < D; j++) mu[j] /= X.length;
for (const x of X) for (let j = 0; j < D; j++) { const d = x[j] - mu[j]; sd[j] += d * d; }
for (let j = 0; j < D; j++) sd[j] = Math.max(1e-6, Math.sqrt(sd[j] / X.length));
let w = new Array(D).fill(0), b = 0;
for (let ep = 0; ep < 300; ep++) {
  const gw = new Array(D).fill(0); let gb = 0;
  for (const i in X) { const xi = X[i].map((v, j) => (v - mu[j]) / sd[j]); const e = sig(dot(w, xi) + b) - Y[i]; for (let j = 0; j < D; j++) gw[j] += e * xi[j]; gb += e; }
  for (let j = 0; j < D; j++) w[j] -= 0.4 * gw[j] / X.length;
  b -= 0.4 * gb / X.length;
}
const base = Y.reduce((a, c) => a + c, 0) / Y.length;
const fmt = (r) => '夺1 ' + (100 * r.win / r.n).toFixed(1) + '% ‖ 防御 ' + (r.def / r.n).toFixed(1) + '/局 ‖ 有效 ' + (r.def ? (100 * r.blk / r.def).toFixed(1) + '%' : '—');
const bare = run(false, 0, false);
console.log(PACK.split('/').pop() + ' [' + TABLE + '] 被攻击率 ' + (100 * base).toFixed(1) + '% ‖ 裸包: ' + fmt(bare));
const TS = process.env.GATE_ONLY_T ? [Number(process.env.GATE_ONLY_T)] : [0.10, 0.15, 0.20, 0.30];
for (const T_ of TS) {
  const r = run(true, T_, null);
  console.log('  门控 T=' + T_.toFixed(2) + ': ' + fmt(r));
}