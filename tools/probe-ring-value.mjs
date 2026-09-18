/* E3d 环的反事实优势 —— **跨局分层 + 按局聚类置信区间 + 机制追踪**
 * 要证伪的东西：E3c 里 multi 的"环×3 = +15pt / 环×5 = +24pt"，而安慰剂 ジ×3 = −1.1pt。
 *   两处可疑：① 那 30 个快照只来自 **6 局**（簇内相关 ⇒ 每对 SE 假小）；
 *   ② 算术上环×3 与 ジ×3 的**净 ep 完全相同**（都是 +3），且中途 ジ 一直领先 ⇒ 若环真赢 15pt，
 *      机制**不可能**是 ep 收入，只能是别的（可观测的 ringStreak 改变对手评估 / 成本时序 / 隐藏副作用）。
 * 所以这个脚本一次做三件事：跨局铺开重采、按局 bootstrap 出区间、把一对轨迹逐回合打出来找机制。
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
const STATES = Number(process.env.STATES || 60), K = Number(process.env.K || 8);
const PER_GAME = Number(process.env.PER_GAME || 2);

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
    if (trace && trace.length < 60) trace.push({ round: state.round, ep: state.p[0].ep, hp: state.p[0].hp, rs: state.p[0].ringStreak, act: picks[0] ? picks[0].key : '-', dmg: state.events.filter(e => e.type === 'damage' && e.to === 0 && (e.round || 0) >= state.round).length });
    if (++guard > 5000) throw new Error('resume guard');
  }
  return state.winner;
}
function harvest(params, mode, want, maxRound, minHp, perGame) {
  const inner = ch(params); const pool = []; let cur = 0;
  const cnt = () => pool.filter(s => s.game === cur).length;
  const mk = () => {
    const cs = [];
    for (let i = 0; i < 5; i++) cs.push(function (s2, pid, lg) {
      if (pid === 0 && s2.actions.every(a => a == null) && cnt() < perGame) {
        const me = s2.p[0];
        if (s2.round <= maxRound && me.hp >= minHp && me.ep >= 3 && me.ep <= 6 && me.ringStreak === 0
          && lg.some(l => l.key === A.RING && l.affordable)) {
          pool.push({ snap: S.cloneState(s2), rngSave: s2.rng.save(), round: s2.round, ep: me.ep, hp: me.hp, game: cur, ref: {} });
        }
      }
      return inner(s2, pid, lg);
    });
    return cs;
  };
  const seen = new Set();
  for (let g = 0; g < 400 && pool.length < want; g++) {
    cur = g;
    const st = S.createState(mode, { next: mb(4242 + g * 977) }, 5);
    st.rng = mb(4242 + g * 977); st.slotSalt = h32(4242 + g * 2246822519);
    resumeN(st, mk(), false);
    for (const s of pool) if (s.game === g) { s.ref.winner = st.winner; s.ref.rounds = st.round; }
    if (pool.some(s => s.game === g)) seen.add(g);
  }
  return Object.assign(pool.slice(0, want), { games: seen.size });
}
function rollout(params, s, force, rngSeed, trace) {
  const st = S.cloneState(s.snap); st.rng = mb(1); st.rng.restore(rngSeed);
  const base = ch(params); let left = force ? force.taps : 0; const fk = force ? force.key : null;
  const cs = [];
  for (let i = 0; i < 5; i++) cs.push(i === 0 ? function (s2, pid, lg) {
    if (left > 0 && lg.some(l => l.key === fk && l.affordable)) { left--; return { key: fk, target: null, target2: null, bead: null }; }
    return base(s2, pid, lg);
  } : base);
  resumeN(st, cs, true, trace);
  const me = st.p[0];
  return { won: st.winner === 0, draw: st.winner === 'draw', hp: me.hp, ep: me.ep, rounds: st.round, winner: st.winner };
}
const mm = x => x.reduce((t, v) => t + v, 0) / x.length;
/* 按局 bootstrap：同局的对不许当成独立样本 */
const brng = mb(20260918);
function clusterCI(pairs) {
  const byGame = {};
  for (const p of pairs) (byGame[p.g] = byGame[p.g] || []).push(p.d);
  const games = Object.keys(byGame);
  const stats = [];
  for (let b = 0; b < 2000; b++) {
    const acc = [];
    for (let i = 0; i < games.length; i++) { const g = games[Math.floor(brng.next() * games.length)]; acc.push(...byGame[g]); }
    stats.push(100 * mm(acc));
  }
  stats.sort((a, x) => a - x);
  return [stats[Math.floor(0.025 * stats.length)], stats[Math.floor(0.975 * stats.length)]];
}
const ARMS = [['环1', { key: A.RING, taps: 1 }], ['环3', { key: A.RING, taps: 3 }], ['环5', { key: A.RING, taps: 5 }],
  ['环8', { key: A.RING, taps: 8 }], ['安慰剂ジ×3', { key: A.JI, taps: 3 }], ['安慰剂ジ×8', { key: A.JI, taps: 8 }]];
for (const mode of ['multi', 'long']) {
  const maxRound = mode === 'multi' ? 14 : 24, minHp = mode === 'multi' ? 2 : 3;
  const snaps = harvest(ARM, mode, STATES, maxRound, minHp, PER_GAME);
  console.log(`\n=== ringA1 [${mode}] 快照 ${snaps.length} 个 · 来自 ${snaps.games} 局（每局≤${PER_GAME}）· 均 round ${(mm(snaps.map(s => s.round))).toFixed(1)} 均 hp ${(mm(snaps.map(s => s.hp))).toFixed(1)} 均 ep ${(mm(snaps.map(s => s.ep))).toFixed(1)} ===`);
  if (!snaps.length) { console.log('  窗口内无快照'); continue; }
  const res = ARMS.map(() => []); const wins = ARMS.map(() => 0); const eps = ARMS.map(() => []); const rds = ARMS.map(() => []);
  let w0 = 0, n0 = 0; const hp0 = [];
  snaps.forEach((s, si) => {
    for (let k = 0; k < K; k++) {
      const seed = 9000 + k * 7919;
      const a = rollout(ARM, s, null, seed);
      w0 += a.won ? 1 : 0; n0++; hp0.push(a.hp);
      for (let ai = 0; ai < ARMS.length; ai++) {
        const b = rollout(ARM, s, ARMS[ai][1], seed);
        res[ai].push({ g: s.game, d: (b.won ? 1 : 0) - (a.won ? 1 : 0) });
        wins[ai] += b.won ? 1 : 0; eps[ai].push(b.ep); rds[ai].push(b.rounds);
      }
    }
  });
  console.log(`  对照臂胜率 ${(100 * w0 / n0).toFixed(1)}%（n=${n0}）· 对照终局余 ep ${mm(ARMS.length ? eps[0] : [0]).toFixed(1)} · 被测席终血 ${(mm(hp0)).toFixed(2)}`);
  for (let ai = 0; ai < ARMS.length; ai++) {
    const m = 100 * mm(res[ai].map(p => p.d));
    const per = 100 * wins[ai] / res[ai].length;
    const [lo, hi] = clusterCI(res[ai]);
    console.log(`    ${ARMS[ai][0].padEnd(11)} 胜率${per.toFixed(1)}%  Δ胜 = ${m >= 0 ? '+' : ''}${m.toFixed(1)}pt  95%CI[${lo.toFixed(1)}, ${hi.toFixed(1)}]（按局 bootstrap · 局数 ${new Set(res[ai].map(p => p.g)).size} · n=${res[ai].length}）· 余ep ${(mm(eps[ai])).toFixed(1)} 回合 ${(mm(rds[ai])).toFixed(0)}`);
  }
}
/* ---- 机制追踪：一对轨迹逐回合 ---- */
console.log('\n=== 机制追踪（multi，第 1 个快照 × 同一 seed：对照 vs 环×3 vs ジ×3）===');
{
  const snaps = harvest(ARM, 'multi', 6, 14, 2, 1);
  const s = snaps[0];
  console.log(`  快照：round ${s.round} ep ${s.ep} hp ${s.hp}`);
  for (const [nm, f] of [['对照', null], ['环×3', { key: A.RING, taps: 3 }], ['ジ×3', { key: A.JI, taps: 3 }]]) {
    const tr = [];
    const r = rollout(ARM, s, f, 9000, tr);
    console.log(`  ${nm} ⇒ 胜=${r.won} 和=${r.draw} winner=${r.winner} 回合=${r.rounds}`);
    console.log('    ' + tr.slice(0, 26).map(t => `r${t.round}:${t.act}/${t.rs ? '链' + t.rs : ''}${t.ep}ep${t.hp}hp`).join('  '));
    console.log('    …末 6 手：' + tr.slice(-6).map(t => `r${t.round}:${t.act}/${t.rs ? '链' + t.rs : ''}${t.ep}ep${t.hp}hp`).join('  '));
  }
}
