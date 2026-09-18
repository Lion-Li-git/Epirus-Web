/* E5 "富有安慰剂"：环×8 的两套独立样本里都给出 +22/+41pt（按局聚类的 CI 跨 0 以外），
 *   但必须先排除一个feature 假象：arm A 的政策是 ep 的**悬崖函数**（对照臂连打 40 手ジ、攥着 40 ep 死），
 *   所以"多给点 ep"本身就可能让它翻到另一个行为区 ⇒ 赢的不是环，是**扰动**。
 * 四臂（同一快照、同一 rng 流、配对）：
 *   对照 / 直接加钱 ep+=10 / 直接加钱 ep+=18（与环×8 的净收益同量级）/ 环×8
 * 判据：若"加钱"就复现同量级的 Δ ⇒ 环的读数是 feature 假象，不该为环动奖励；
 *       若只有环×8 赢、加钱不赢 ⇒ 环有独立的机制价值（链本身、或"连续同一招"这个节奏）。
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
function mb(seed) {
  let a = seed >>> 0;
  return {
    next() { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; },
    save() { return a >>> 0; }, restore(v) { a = v >>> 0; },
  };
}
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function loadBak(f) { const t = readFileSync(REPO + f, 'utf8'); return P.loadAny(JSON.parse(t.slice(t.indexOf('{"v":'), t.lastIndexOf('}') + 1))).params; }
const LIVE = P.unpack(sb.window.EPIRUS_CHAMPION_3P);
const ARM = loadBak('docs/artifacts/v7ringA1-82.bak');
const ch = p => T.policyChooserN(p, 0.15);
const STATES = Number(process.env.STATES || 30), K = Number(process.env.K || 6);
function resumeN(state, choosers, skipStart, trace) {
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
      picks.push({ key: (choosers[pid] && choosers[pid].whiffOk) ? raw.key : ((l && l.affordable) ? raw.key : R.SK.JI),
        target: raw.target, target2: raw.target2, bead: raw.bead });
    }
    for (let pid = 0; pid < N; pid++) {
      if (!picks[pid]) continue;
      S.attemptAction(state, pid, picks[pid].key, { bead: picks[pid].bead || beadOf(state.p[pid]), target: picks[pid].target, target2: picks[pid].target2 });
    }
    X.resolveActions(state); X.endTurn(state);
    if (trace) {   // 峰值 ep 逐回合取：trace 会截断，只在前 200 条里取峰会把"攥到 40"读成"只有 12"
      const e2 = state.p[0].ep; if (e2 > (trace.peak || 0)) trace.peak = e2;
      if (trace.length < 200) trace.push({ round: state.round, ep: e2, hp: state.p[0].hp, act: picks[0] ? picks[0].key : '-', dmg: state.events.filter(e => e.type === 'damage' && e.source === 0).length });
    }
    if (++guard > 5000) throw new Error('guard');
  }
  return state.winner;
}
function harvest(params, mode, want, maxRound, minHp, minEp) {
  const inner = ch(params); const pool = []; let cur = 0, pg = 0;
  const mk = () => {
    const cs = [];
    for (let i = 0; i < 5; i++) cs.push(function (s2, pid, lg) {
      if (pid === 0 && s2.actions.every(a => a == null) && pg < 2) {
        const me = s2.p[0];
        if (s2.round <= maxRound && me.hp >= minHp && me.ep >= minEp
          && lg.some(l => l.key === A.RING && l.affordable)) {
          pool.push({ snap: S.cloneState(s2), rngSave: s2.rng.save(), round: s2.round, ep: me.ep, hp: me.hp, game: cur });
          pg++;
        }
      }
      return inner(s2, pid, lg);
    });
    return cs;
  };
  for (let g = 0; g < 500 && pool.length < want; g++) {
    cur = g; pg = 0;
    const st = S.createState(mode, { next: mb(4242 + g * 977) }, 5);
    st.rng = mb(4242 + g * 977); st.slotSalt = h32(4242 + g * 2246822519);
    resumeN(st, mk(), false);
  }
  return Object.assign(pool.slice(0, want), { games: new Set(pool.slice(0, want).map(s => s.game)).size });
}
/* force = null | {key,taps} | {grant:n}（只改钱包、不动出招、不动 rng） */
function rollout(params, s, force, rngSeed, trace) {
  const st = S.cloneState(s.snap); st.rng = mb(1); st.rng.restore(rngSeed);
  if (force && force.grant != null) st.p[0].ep += force.grant;
  const base = ch(params); let left = force && force.taps ? force.taps : 0;
  const cs = [];
  for (let i = 0; i < 5; i++) cs.push(i === 0 ? function (s2, pid, lg) {
    if (left > 0 && lg.some(l => l.key === force.key && l.affordable)) { left--; return { key: force.key, target: null, target2: null, bead: null }; }
    return base(s2, pid, lg);
  } : base);
  resumeN(st, cs, true, trace);
  const me = st.p[0];
  return { won: st.winner === 0, hp: me.hp, ep: me.ep, rounds: st.round, winner: st.winner };
}
const mm = x => x.reduce((t, v) => t + v, 0) / x.length;
const brng = mb(20260918);
function clusterCI(pairs) {
  const byGame = {}; for (const p of pairs) (byGame[p.g] = byGame[p.g] || []).push(p.d);
  const games = Object.keys(byGame); const stats = [];
  for (let b = 0; b < 2000; b++) { const acc = []; for (let i = 0; i < games.length; i++) acc.push(...byGame[games[Math.floor(brng.next() * games.length)]]); stats.push(100 * mm(acc)); }
  stats.sort((a, x) => a - x);
  return [stats[Math.floor(0.025 * stats.length)], stats[Math.floor(0.975 * stats.length)]];
}
const ARMS = [['加钱+10', { grant: 10 }], ['加钱+18', { grant: 18 }], ['加钱+40', { grant: 40 }],
  ['环×8', { key: A.RING, taps: 8 }], ['环×8+加钱10', { key: A.RING, taps: 8, extra: 10 }]];
for (const mode of ['multi', 'long']) {
  const maxRound = mode === 'multi' ? 20 : 40, minHp = mode === 'multi' ? 2 : 3;
  const snaps = harvest(ARM, mode, STATES, maxRound, minHp, 3);
  console.log(`\n=== arm A [${mode}] 快照 ${snaps.length} 个 · 来自 ${snaps.games} 局 · 均 round ${mm(snaps.map(s => s.round)).toFixed(1)} 均 hp ${mm(snaps.map(s => s.hp)).toFixed(1)} 均 ep ${mm(snaps.map(s => s.ep)).toFixed(1)} ===`);
  if (!snaps.length) continue;
  const res = ARMS.map(() => []), wins = ARMS.map(() => 0), eps = ARMS.map(() => []), out = ARMS.map(() => 0);
  const pk = ARMS.map(() => []); const pk0 = [];
  let w0 = 0, n0 = 0, e0 = [], o0 = 0;
  snaps.forEach(s => {
    for (let k = 0; k < K; k++) {
      const seed = 9000 + k * 7919; const tr0 = [];
      const a = rollout(ARM, s, null, seed, tr0);
      w0 += a.won ? 1 : 0; n0++; e0.push(a.ep); o0 += tr0.length ? tr0[tr0.length - 1].dmg : 0; pk0.push(tr0.peak || a.ep);
      for (let ai = 0; ai < ARMS.length; ai++) {
        const f = Object.assign({}, ARMS[ai][1]);
        const tr = []; const b = rollout(ARM, s, f.extra != null ? Object.assign({ grant: f.extra }, f) : f, seed, tr);
        res[ai].push({ g: s.game, d: (b.won ? 1 : 0) - (a.won ? 1 : 0) });
        wins[ai] += b.won ? 1 : 0; eps[ai].push(b.ep); out[ai] += tr.length ? tr[tr.length - 1].dmg : 0;
        pk[ai].push(tr.peak || b.ep);
      }
    }
  });
  console.log(`  对照：胜率 ${(100 * w0 / n0).toFixed(1)}% · **局内峰 ep ${mm(pk0).toFixed(1)}** · 终局余 ep ${mm(e0).toFixed(1)} · 累计出手 ${(o0 / n0).toFixed(1)}`);
  for (let ai = 0; ai < ARMS.length; ai++) {
    const m = 100 * mm(res[ai].map(p => p.d)); const [lo, hi] = clusterCI(res[ai]);
    console.log(`    ${ARMS[ai][0].padEnd(11)} 胜率 ${(100 * wins[ai] / res[ai].length).toFixed(1)}%  Δ胜=${m >= 0 ? '+' : ''}${m.toFixed(1)}pt  95%CI[${lo.toFixed(1)}, ${hi.toFixed(1)}]（${new Set(res[ai].map(p => p.g)).size} 局·n=${res[ai].length}）· **峰ep ${mm(pk[ai]).toFixed(1)}** · 余ep ${mm(eps[ai]).toFixed(1)} · 累计出手 ${(out[ai] / res[ai].length).toFixed(1)}`);
  }
}
console.log('\n=== 追踪：加钱+18 vs 环×8（同一快照、同一 seed）===');
{
  const snaps = harvest(ARM, 'multi', 3, 20, 2, 3); const s = snaps[0];
  console.log(`  快照 round ${s.round} ep ${s.ep} hp ${s.hp}`);
  for (const [nm, f] of [['对照', null], ['加钱+18', { grant: 18 }], ['环×8', { key: A.RING, taps: 8 }]]) {
    const tr = []; const r = rollout(ARM, s, f, 9000, tr);
    console.log(`  ${nm} ⇒ 胜=${r.won} winner=${r.winner} 回合=${r.rounds} 余ep=${r.ep}`);
    console.log('    ' + tr.slice(0, 34).map(t => `r${t.round}:${t.act}/${t.ep}e${t.hp}h`).join(' '));
  }
}
