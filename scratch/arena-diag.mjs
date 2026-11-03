import { sandbox, loadChamp, buildPoolSeeded } from '../tools/audit-lib.mjs';
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const ref = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
if (typeof T.setBigTPush === 'function') T.setBigTPush(12);
function cancelOtherLocal(state, pid) {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) return e.pids[0] === pid ? e.pids[1] : e.pids[0];
  }
  return null;
}
function candsOf(state, pid, legal) { return P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || []; }
function pickBy(pred) {
  return function (state, pid, legal) {
    const cs = candsOf(state, pid, legal);
    if (!cs.length) return { key: R.SK.JI };
    for (const c of cs) if (pred(c)) return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
    const ji = cs.filter((c) => c.key === R.SK.JI)[0] || cs[0];
    return { key: ji.key, target: ji.target == null ? null : ji.target, target2: null, bead: null };
  };
}
const row = process.argv[2] || 'gun';
const n = Number(process.argv[3] || 2);
const G = Number(process.argv[4] || 10);
const sel = pickBy((c) => c.key === row);
let v7w = 0, rw = 0;
const actsMe = {}, actsOpp = {};
for (let i = 0; i < G; i++) {
  const seed = 900000 + n * 7919 + (i + 1) * 104729;
  const seat = i % n;
  const me = T.policyChooserN(ref, 0.15);
  const ch = [];
  for (let pid = 0; pid < n; pid++) ch.push(pid === seat ? me : sel);
  const rm = T.oneGameN(ch, seed, n, { regen: 0, mode: 'multi' });
  if (rm.winner === seat) v7w++;
  for (const e of rm.state.events) if (e.type === 'action') { const k = e.pid === seat ? actsMe : actsOpp; k[e.key] = (k[e.key] || 0) + 1; }
  rw += rm.rounds || 0;
  if (i < 6) {
    const hp = rm.state.p.map((x) => x.hp);
    console.log(' 局' + i + ' seed=' + seed + ' seat=' + seat + ' winner=' + String(rm.winner) + ' rounds=' + rm.rounds + ' hp=' + JSON.stringify(hp) + ' dmg=' + JSON.stringify(rm.dmg));
  }
}
console.log('v7 对 只' + row + ' n=' + n + '：v7 夺1 ' + (100 * v7w / G).toFixed(1) + '% ‖ 局长 ' + (rw / G).toFixed(1));
console.log('  v7 出手族 ' + JSON.stringify(actsMe));
console.log('  对手出手族 ' + JSON.stringify(actsOpp));
