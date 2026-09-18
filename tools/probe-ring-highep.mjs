/* 把"环到底值不值得学"这句话彻底钉死 —— 只在**高 ep 窗口**上做配对反事实
 * 为什么还要这一枪：§3/§5 的窗口是 ep∈[3,6]，那里环的第 1 按要净付 −2 ⇒ 先天吃亏。
 *   但算术上环的真优势在**长链**：连打 k 手，环净 +（3k−6）、ジ净 +k ⇒ **k>3 环才反超**（k=5：+9 vs +5）。
 *   所以"环被低估"若成立，只可能出现在"手里本来就有钱、且接下来好几回合不用出手"的窗口。
 * 本探针就在**那种**窗口上测：ep≥16（避开编码夹住点，见 probe-ep-encoding）+ 血量健康 + 无人逼我出手
 *   （近 2 回合没挨打）⇒ 配对四臂：对照 / 环×4 / 环×8 / 白送 +12（与环×8 的净收益同量级，作安慰上界）。
 * 判据：若 环×8 的 Δ胜 与"白送+12"相当且 CI 不跨 0 ⇒ 环确有独立价值（该动表征/奖励）；
 *       若环臂 CI 跨 0 或明显低于白送 ⇒ **"让 AI 学会打环"这个目标正式作废**（不是没教会，是不划算）。
 * 用法：node tools/probe-ring-highep.mjs [快照=30] [配对数=8] [minEp=16] [包列表]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const REPO = process.env.EPIRUS_REPO || './';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  X = sb.window.EpirusResolve, T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, A = R.SK;
function mb(seed) { let a = seed >>> 0; return { next() { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }, save() { return a >>> 0; }, restore(v) { a = v >>> 0; } }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function loadBak(f) { const t = readFileSync(REPO + f, 'utf8'); return P.loadAny(JSON.parse(t.slice(t.indexOf('{"v":'), t.lastIndexOf('}') + 1))).params; }
const LIVE = P.unpack(sb.window.EPIRUS_CHAMPION_3P);
const FILES = (process.argv[5] || 'docs/artifacts/v7ringA1-82.bak,docs/artifacts/v7l2c-82.bak').split(',');
const NSNAP = Number(process.argv[2] || 30), K = Number(process.argv[3] || 8), MIN_EP = Number(process.argv[4] || 16);
const ch = p => T.policyChooserN(p, 0.15);
function resumeN(state, choosers, skipStart) {
  const N = state.p.length; let guard = 0, first = !!skipStart;
  const beadOf = p => (p.elec > p.boom ? 'boom' : 'elec');
  while (!state.over) {
    if (first) first = false; else { X.startTurn(state); if (state.over) break; }
    const picks = [];
    for (let pid = 0; pid < N; pid++) {
      if (state.p[pid].hp <= 0) { picks.push(null); continue; }
      const legal = Play.legalActions(state, pid);
      const raw = Play.normPick(choosers[pid] ? choosers[pid](state, pid, legal, state.events) : null);
      const l = legal.find(x => x.key === raw.key);
      picks.push({ key: (choosers[pid] && choosers[pid].whiffOk) ? raw.key : ((l && l.affordable) ? raw.key : R.SK.JI), target: raw.target, target2: raw.target2, bead: raw.bead });
    }
    for (let pid = 0; pid < N; pid++) { if (!picks[pid]) continue; S.attemptAction(state, pid, picks[pid].key, { bead: picks[pid].bead || beadOf(state.p[pid]), target: picks[pid].target, target2: picks[pid].target2 }); }
    X.resolveActions(state); X.endTurn(state);
    if (++guard > 5000) throw new Error('guard');
  }
  return state.winner;
}
/* 近两回合有没有挨打（"没人逼我出手"这个门） */
function quiet(st) {
  const ev = st.events; let hits = 0;
  for (let i = ev.length - 1; i >= 0 && ev[i].round > st.round - 2; i--) if (ev[i].type === 'damage' && ev[i].to === 0) hits++;
  return hits === 0;
}
function harvest(params, mode, want, minHp) {
  const inner = ch(params); const pool = []; let cur = 0, pg = 0;
  const mk = () => { const cs = []; for (let i = 0; i < 5; i++) cs.push(function (s2, pid, lg) {
    if (pid === 0 && s2.actions.every(a => a == null) && pg < 2) {
      const me = s2.p[0];
      if (me.ep >= MIN_EP && me.hp >= minHp && me.ringStreak === 0 && quiet(s2)
        && lg.some(l => l.key === A.RING && l.affordable)) { pool.push({ snap: S.cloneState(s2), rngSave: s2.rng.save(), ep: me.ep, hp: me.hp, round: s2.round, game: cur }); pg++; }
    }
    return inner(s2, pid, lg);
  }); return cs; };
  for (let g = 0; g < 400 && pool.length < want; g++) {
    cur = g; pg = 0;
    const st = S.createState(mode, { next: mb(4242 + g * 977) }, 5); st.rng = mb(4242 + g * 977); st.slotSalt = h32(4242 + g * 2246822519);
    resumeN(st, mk(), false);
  }
  return Object.assign(pool.slice(0, want), { games: new Set(pool.slice(0, want).map(s => s.game)).size });
}
function rollout(params, s, force, rngSeed) {
  const st = S.cloneState(s.snap); st.rng = mb(1); st.rng.restore(rngSeed);
  if (force && force.grant != null) st.p[0].ep += force.grant;
  const base = ch(params); let left = force && force.taps ? force.taps : 0;
  const cs = [];
  for (let i = 0; i < 5; i++) cs.push(i === 0 ? function (s2, pid, lg) {
    if (left > 0 && lg.some(l => l.key === force.key && l.affordable)) { left--; return { key: force.key, target: null, target2: null, bead: null }; }
    return base(s2, pid, lg);
  } : base);
  resumeN(st, cs, true);
  return { won: st.winner === 0, ep: st.p[0].ep, hp: st.p[0].hp, rounds: st.round };
}
const mm = x => x.reduce((t, v) => t + v, 0) / x.length;
const brng = mb(20260919);
function clusterCI(pairs) {
  const byGame = {}; for (const p of pairs) (byGame[p.g] = byGame[p.g] || []).push(p.d);
  const games = Object.keys(byGame); const stats = [];
  for (let b = 0; b < 2000; b++) { const acc = []; for (let i = 0; i < games.length; i++) acc.push(...byGame[games[Math.floor(brng.next() * games.length)]]); stats.push(100 * mm(acc)); }
  stats.sort((a, x) => a - x); return [stats[Math.floor(0.025 * stats.length)], stats[Math.floor(0.975 * stats.length)]];
}
const ARMS = [['环×4', { key: A.RING, taps: 4 }], ['环×8', { key: A.RING, taps: 8 }],
  ['白送+12', { grant: 12 }], ['白送+18', { grant: 18 }]];
for (const f of FILES) {
  let params; try { params = f.includes('bundled') ? LIVE : loadBak(f); } catch (e) { console.log(`跳过 ${f}: ${e.message}`); continue; }
  const label = f.split('/').pop().replace('.bak', '');
  for (const mode of ['multi', 'long']) {
    const snaps = harvest(params, mode, NSNAP, mode === 'multi' ? 2 : 4);
    console.log(`\n=== ${label} [${mode}] 高 ep 窗口（ep≥${MIN_EP}·hp≥${mode === 'multi' ? 2 : 4}·近 2 回合没挨打·环可负担）：${snaps.length} 快照 / ${snaps.games || 0} 局 ===`);
    if (!snaps.length) { console.log('    采不到快照 ⇒ 这个包在这种窗口里根本不出现（本身就是读数）'); continue; }
    console.log(`    快照均 ep ${mm(snaps.map(s => s.ep)).toFixed(1)} 均 hp ${mm(snaps.map(s => s.hp)).toFixed(1)} 均 round ${mm(snaps.map(s => s.round)).toFixed(1)}`);
    const res = ARMS.map(() => []), win = ARMS.map(() => 0); let w0 = 0, n0 = 0;
    for (const s of snaps) for (let k = 0; k < K; k++) {
      const seed = 9000 + k * 7919; const a = rollout(params, s, null, seed);
      w0 += a.won ? 1 : 0; n0++;
      for (let ai = 0; ai < ARMS.length; ai++) { const b = rollout(params, s, ARMS[ai][1], seed); res[ai].push({ g: s.game, d: (b.won ? 1 : 0) - (a.won ? 1 : 0) }); win[ai] += b.won ? 1 : 0; }
    }
    console.log(`    对照胜率 ${(100 * w0 / n0).toFixed(1)}%（n=${n0}）`);
    for (let ai = 0; ai < ARMS.length; ai++) {
      const m = 100 * mm(res[ai].map(p => p.d)); const [lo, hi] = clusterCI(res[ai]);
      console.log(`      ${ARMS[ai][0].padEnd(8)} 胜率 ${(100 * win[ai] / res[ai].length).toFixed(1)}%  Δ胜=${m >= 0 ? '+' : ''}${m.toFixed(1)}pt  95%CI[${lo.toFixed(1)}, ${hi.toFixed(1)}]${lo > 0 ? '  ⇐ 显著为正' : hi < 0 ? '  ⇐ 显著为负' : '  ⇐ 跨 0（不可判）'}`);
    }
  }
}
