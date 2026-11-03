#!/usr/bin/env node
/* gate-drift.mjs — 门控注入对冠军出招的影响（DS · 11-03）
 * 量：决策数 / 覆盖写次数与比例 / 被换掉的招（直方图）/ 换成的防御 / 按 HP 档 / 触发时 p 均值 /
 *     局长与出手数变化（裸 vs 门控）。
 * 用法：node scratch/gate-drift.mjs --pack=... [--table=mix|gun] [--games=150] [--n=5] [--mode=long]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js'), TABLE = arg('table', 'mix');
const GAMES = Math.max(30, Number(arg('games', 150)) || 150), N = Math.max(2, Number(arg('n', 5)) || 5), MODE = arg('mode', 'long');
const T_ = Number(arg('t', 0.15)), HPMAX = Number(arg('hp', 2)), TEMP = 0.1;
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
let pv = null;
try { const raw = readPack2(PACK); if (raw && raw.v === 92) { const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); } } catch (e) {}
if (!pv) pv = Float64Array.from(loadChamp(W, PACK, '.'));
const ch = T.policyChooserN(pv, TEMP, 0, N, 'soft');
const A = createArena2(W, { refParams: pv, temp: TEMP, stratified: false });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
const DEFK = new Set(['guard', 'reflect', 'bagua', 'shift', 'jinshield', 'armor', 'proto', 'holo']);
const feat = (state) => {
  const me = state.p[0], ops = state.p.filter((q) => q.id !== 0 && q.hp > 0);
  const epMax = ops.reduce((a, q) => Math.max(a, q.ep || 0), 0);
  return [Math.min(me.hp, 5) / 5, ops.length / N, Math.min(state.round, 140) / 140, Math.min(me.ep, 12) / 12,
    me.bead ? 1 : 0, epMax / 5, ops.filter((q) => (q.ep || 0) >= 2).length / N, ops.filter((q) => q.bead).length / N,
    ops.filter((q) => q.lastSkill === R.SK.CHARGE).length / N, ops.filter((q) => q.lastSkill && R.ATK_EFFECT.indexOf(q.lastSkill) >= 0).length / N,
    ops.filter((q) => q.lastTarget === 0).length / N, me.baguaExtra ? 1 : 0, (me.stickers || []).length / 4];
};
/* 先在裸包里采数据、拟合 logistic */
function collect(fit) {
  const X = [], Y = [], stat = { dec: 0, over: 0, byHp: { lo: [0, 0], mid: [0, 0], hi: [0, 0] }, rep: {}, to: {}, pSum: 0, rounds: 0, acts: 0 };
  for (let g = 0; g < GAMES; g++) {
    let pend = null;
    const flush = (state) => {
      if (!pend) return;
      let hit = 0;
      for (const e of (state.events || []).slice(pend.c)) if (e && e.to === 0 && (e.type === 'damage' || e.type === 'blocked' || e.type === 'reflect')) hit = 1;
      if (fit) { X.push(pend.x); Y.push(hit); }
      pend = null;
    };
    const focus = (state, pid, legal) => {
      flush(state);
      stat.dec++;
      let a = ch(state, pid, legal);
      stat.acts++;
      const isDef = a && DEFK.has(a.key);
      if (!fit) {
        const x = feat(state), p = sig(dot(w, x.map((v, j) => (v - mu[j]) / sd[j])) + b);
        const hp = state.p[0] ? state.p[0].hp : 0;
        const bn = hp <= 1 ? 'lo' : (hp === 2 ? 'mid' : 'hi');
        stat.byHp[bn][0]++;
        const pick = pickDef(state, legal);
        if (!isDef && hp <= HPMAX && p >= T_ && pick) {
          stat.over++; stat.byHp[bn][1]++; stat.pSum += p;
          const bk = (a && typeof a === 'object') ? (a.key || '?') : String(a);
          stat.rep[bk] = (stat.rep[bk] || 0) + 1;
          stat.to[pick.key] = (stat.to[pick.key] || 0) + 1;
          a = pick;
        }
      }
      pend = { c: (state.events || []).length, x: feat(state) };
      return a;
    };
    const subs = [focus];
    for (let pid = 1; pid < N; pid++) {
      if (TABLE === 'gun') { subs.push(A.roster.find((e) => e.name === 'only:gun').sel); continue; }
      let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri];
      while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
      subs.push(e.sel);
    }
    const r = T.oneGameN(subs, 93000 + g * 977, N, { mode: MODE });
    stat.rounds += r.rounds || 0;
  }
  return { X, Y, stat };
}
const sig = (t) => 1 / (1 + Math.exp(-t));
function pickDef(state, legal) {
  const defs = legal.filter((l) => DEFK.has(l.key) && l.affordable !== false);
  if (!defs.length) return null;
  if (!process.env.SMART) return defs[0];
  const ops = state.p.filter((q) => q.id !== 0 && q.hp > 0);
  const refl = ops.filter((q) => q.lastSkill === R.SK.GUN || q.lastSkill === R.SK.TANK || q.lastSkill === R.SK.DUAL_GUN).length;
  const want = refl >= ops.length / 2 ? 'reflect' : 'guard';
  return defs.find((d) => d.key === want) || defs.find((d) => d.key === 'jinshield') || defs[0];
}
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const F = collect(true);
const D = F.X[0].length, mu = new Array(D).fill(0), sd = new Array(D).fill(0);
for (const x of F.X) for (let j = 0; j < D; j++) mu[j] += x[j];
for (let j = 0; j < D; j++) mu[j] /= F.X.length;
for (const x of F.X) for (let j = 0; j < D; j++) { const d = x[j] - mu[j]; sd[j] += d * d; }
for (let j = 0; j < D; j++) sd[j] = Math.max(1e-6, Math.sqrt(sd[j] / F.X.length));
let w = new Array(D).fill(0), b = 0;
for (let ep = 0; ep < 300; ep++) {
  const gw = new Array(D).fill(0); let gb = 0;
  for (let i = 0; i < F.X.length; i++) { const xi = F.X[i].map((v, j) => (v - mu[j]) / sd[j]); const e = sig(dot(w, xi) + b) - F.Y[i]; for (let j = 0; j < D; j++) gw[j] += e * xi[j]; gb += e; }
  for (let j = 0; j < D; j++) w[j] -= 0.4 * gw[j] / F.X.length;
  b -= 0.4 * gb / F.X.length;
}
const G = collect(false).stat;
const pct = (x, y) => y ? (100 * x / y).toFixed(1) + '%' : '—';
console.log(PACK.split('/').pop() + ' [' + TABLE + ' ' + N + 'P ' + MODE + '] ‖ 决策 ' + G.dec + ' ‖ 覆盖写 ' + G.over + '（' + pct(G.over, G.dec) + '）‖ 局长 ' + (G.rounds / GAMES).toFixed(1));
console.log('   被换掉: ' + Object.entries(G.rep).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + '=' + v).join(' '));
console.log('   换成:   ' + Object.entries(G.to).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + '=' + v).join(' ') + ' ‖ 触发时 p 均值 ' + (G.pSum / Math.max(1, G.over)).toFixed(2));
console.log('   HP档覆盖: ≤1 ' + G.byHp.lo[1] + '/' + G.byHp.lo[0] + '（' + pct(G.byHp.lo[1], G.byHp.lo[0]) + '） ‖ =2 ' + G.byHp.mid[1] + '/' + G.byHp.mid[0] + '（' + pct(G.byHp.mid[1], G.byHp.mid[0]) + '） ‖ ≥3 ' + G.byHp.hi[1] + '/' + G.byHp.hi[0] + '（' + pct(G.byHp.hi[1], G.byHp.hi[0]) + '）');