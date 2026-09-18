/* E4 兑现 vs 攒钱：把反事实的刀口挪到真正的病灶上
 * E3d 的逐回合追踪：arm A 从 r7 到 r46 **连打 40 手ジ**，ep 4→40，hp 2→0 —— 死的时候手里全是钱。
 *   ⇒ "环被低估"这个说法站不住（按局聚类后 multi 全部区间跨 0；而且安慰剂 ジ×3 与对照**逐字相同**，
 *      因为那条线本来就在打 ジ ⇒ 安慰剂根本不构成独立臂）。
 *   ⇒ 真正的可动变量是**兑现**：ep≥5 且网络此刻的 argmax 是 ジ 时，强制它花钱买输出值多少胜。
 * 快照口径：pid=0 回合开始 · 血量健康 · **ep≥5** · argmax=ジ（正卡在"无限攒钱"区）。
 * 臂：对照 / 兑现1手 / 兑现3手 / 兑现8手（每次强制打"当前付得起的最贵攻击卡"）/ 环×8（留档，防我偏颇）
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
const STATES = Number(process.env.STATES || 40), K = Number(process.env.K || 6);
const ATK = R.skills.filter(s => s.cat === R.CAT.ATTACK).sort((a, b) => (b.cost || 0) - (a.cost || 0)).map(s => s.key);
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
    if (trace && trace.length < 80) {
      const d = state.events.filter(e => e.type === 'damage' && e.source === 0).length;
      trace.push({ round: state.round, ep: state.p[0].ep, hp: state.p[0].hp, act: picks[0] ? picks[0].key : '-', dmg: d });
    }
    if (++guard > 5000) throw new Error('resume guard');
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
        if (s2.round <= maxRound && me.hp >= minHp && me.ep >= minEp) {
          const aff = lg.filter(l => l.affordable);
          const cands = P.candidatesFor(s2, 0, T.econBase(s2, 0, aff), {});
          const f = P.forwardCands(s2, 0, cands, params, { temp: 0.15 });
          if (cands[f.argmax].key === A.JI && aff.some(l => ATK.indexOf(l.key) >= 0 && l.affordable)) {
            pool.push({ snap: S.cloneState(s2), rngSave: s2.rng.save(), round: s2.round, ep: me.ep, hp: me.hp, game: cur, ref: {} });
            pg++;
          }
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
    for (const s of pool) if (s.game === g) { s.ref.winner = st.winner; s.ref.rounds = st.round; }
  }
  return Object.assign(pool.slice(0, want), { games: new Set(pool.slice(0, want).map(s => s.game)).size });
}
function rollout(params, s, force, rngSeed, trace) {
  const st = S.cloneState(s.snap); st.rng = mb(1); st.rng.restore(rngSeed);
  const base = ch(params); let left = force ? force.taps : 0;
  const cs = [];
  for (let i = 0; i < 5; i++) cs.push(i === 0 ? function (s2, pid, lg) {
    if (left > 0) {
      const aff = lg.filter(l => l.affordable);
      let k = null;
      if (force.key) { if (aff.some(l => l.key === force.key)) k = force.key; }
      else { const cand = P.candidatesFor(s2, pid, T.econBase(s2, pid, aff), {}); const f = P.forwardCands(s2, pid, cand, params, { temp: 0.15 }); const c = cand[f.argmax]; if (c.key !== A.JI && c.key !== A.CHARGE && c.key !== A.RING) k = c.key; }
      if (k) { left--; const t = T.pickTargetN(s2, pid, k); return { key: k, target: t, target2: T.pickTarget2N(s2, pid, k, t), bead: null }; }
    }
    return base(s2, pid, lg);
  } : base);
  resumeN(st, cs, true, trace);
  const me = st.p[0];
  return { won: st.winner === 0, draw: st.winner === 'draw', hp: me.hp, ep: me.ep, rounds: st.round, winner: st.winner };
}
const mm = x => x.reduce((t, v) => t + v, 0) / x.length;
const brng = mb(20260918);
function clusterCI(pairs) {
  const byGame = {};
  for (const p of pairs) (byGame[p.g] = byGame[p.g] || []).push(p.d);
  const games = Object.keys(byGame); const stats = [];
  for (let b = 0; b < 2000; b++) {
    const acc = [];
    for (let i = 0; i < games.length; i++) acc.push(...byGame[games[Math.floor(brng.next() * games.length)]]);
    stats.push(100 * mm(acc));
  }
  stats.sort((a, x) => a - x);
  return [stats[Math.floor(0.025 * stats.length)], stats[Math.floor(0.975 * stats.length)]];
}
const ARMS = [['兑现1手', { taps: 1 }], ['兑现3手', { taps: 3 }], ['兑现8手', { taps: 8 }],
  ['最贵攻击1手', { taps: 1, key: ATK[0] }], ['环×8', { taps: 8, key: A.RING }]];
for (const mode of ['multi', 'long']) {
  const maxRound = mode === 'multi' ? 20 : 40, minHp = mode === 'multi' ? 2 : 3;
  const snaps = harvest(ARM, mode, STATES, maxRound, minHp, 5);
  console.log(`\n=== arm A [${mode}] “卡在无限攒钱区”的快照 ${snaps.length} 个 · 来自 ${snaps.games} 局 · 均 round ${mm(snaps.map(s => s.round)).toFixed(1)} 均 hp ${mm(snaps.map(s => s.hp)).toFixed(1)} 均 ep ${mm(snaps.map(s => s.ep)).toFixed(1)} ===`);
  if (!snaps.length) { console.log('  无快照'); continue; }
  const res = ARMS.map(() => []), wins = ARMS.map(() => 0), eps = ARMS.map(() => []), dmg = ARMS.map(() => 0);
  let w0 = 0, n0 = 0, ep0 = [], dmg0 = 0;
  snaps.forEach(s => {
    for (let k = 0; k < K; k++) {
      const seed = 9000 + k * 7919;
      const tr0 = []; const a = rollout(ARM, s, null, seed, tr0);
      w0 += a.won ? 1 : 0; n0++; ep0.push(a.ep); dmg0 += tr0.length ? tr0[tr0.length - 1].dmg : 0;
      for (let ai = 0; ai < ARMS.length; ai++) {
        const tr = []; const b = rollout(ARM, s, ARMS[ai][1], seed, tr);
        res[ai].push({ g: s.game, d: (b.won ? 1 : 0) - (a.won ? 1 : 0) });
        wins[ai] += b.won ? 1 : 0; eps[ai].push(b.ep); dmg[ai] += tr.length ? tr[tr.length - 1].dmg : 0;
      }
    }
  });
  console.log(`  对照（继续攒）：胜率 ${(100 * w0 / n0).toFixed(1)}% · 累计出手伤害 ${dmg0 / n0} · 终局余 ep ${mm(ep0).toFixed(1)}`);
  for (let ai = 0; ai < ARMS.length; ai++) {
    const m = 100 * mm(res[ai].map(p => p.d)); const [lo, hi] = clusterCI(res[ai]);
    console.log(`    ${ARMS[ai][0].padEnd(10)} 胜率 ${(100 * wins[ai] / res[ai].length).toFixed(1)}%  Δ胜 = ${m >= 0 ? '+' : ''}${m.toFixed(1)}pt  95%CI[${lo.toFixed(1)}, ${hi.toFixed(1)}]（局数 ${new Set(res[ai].map(p => p.g)).size}·n=${res[ai].length}）· 累计出手 ${(dmg[ai] / res[ai].length).toFixed(1)} · 余ep ${(mm(eps[ai])).toFixed(1)}`);
  }
}
console.log('\n=== 追踪：arm A 在"卡在攒钱区"的快照上，兑现 3 手 vs 继续攒 ===');
{
  const snaps = harvest(ARM, 'multi', 3, 20, 2, 5);
  const s = snaps[0];
  console.log(`  快照 round ${s.round} ep ${s.ep} hp ${s.hp}`);
  for (const [nm, f] of [['继续攒', null], ['兑现3手', { taps: 3 }]]) {
    const tr = []; const r = rollout(ARM, s, f, 9000, tr);
    console.log(`  ${nm} ⇒ 胜=${r.won} winner=${r.winner} 回合=${r.rounds} 终血=${r.hp} 余ep=${r.ep}`);
    console.log('    ' + tr.slice(0, 30).map(t => `r${t.round}:${t.act}/${t.ep}ep${t.hp}hp/累伤${t.dmg}`).join('  '));
  }
}
