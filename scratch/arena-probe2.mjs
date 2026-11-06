/* 探针 2（scratch）：只跑**混合池桌**（与 ladder 同一对手池、同一座席轮换），把人数/血量轴扩出去，
 * 看「只反弹」是否仍然高过参照包。回答"扩桌形本身够不够"的问题。
 */
import { sandbox, loadChamp, buildPoolSeeded } from '../tools/audit-lib.mjs';
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const G = Number((process.argv.find((x) => x.startsWith('--games=')) || '--games=10').slice(8)) || 10;
const ref = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
const POOL = buildPoolSeeded(T, ref, 20261029);
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
const STYLES = ['breakdef', 'wall', 'tankline', 'guardgun', 'protowall', 'reflectmix', 'beadburst', 'aggro'];
const SHAPES = [[2, 'multi'], [2, 'long'], [3, 'multi'], [3, 'multi4'], [3, 'long'], [5, 'multi'], [5, 'multi4'], [5, 'long'], [8, 'multi'], [10, 'multi']];
const CELLS = [];
for (const [n, mode] of SHAPES) for (const nm of STYLES) CELLS.push({ n, mode, idx: POOL.findIndex((o) => o.name === nm) });
function run(sel) {
  let w = 0, g = 0, draw = 0, deadWin = 0;
  const perShape = {};
  for (const cell of CELLS) {
    let sw = 0, sd = 0;
    for (let i = 0; i < G; i++) {
      const seed = 1000 + cell.n * 97 + cell.idx + i * 7919;
      const seat = i % cell.n;
      const ch = [];
      for (let pid = 0; pid < cell.n; pid++) ch.push(pid === seat ? sel : POOL[(cell.idx + 1 + pid) % POOL.length].sel);
      const rm = T.oneGameN(ch, seed, cell.n, { regen: 0, mode: cell.mode });
      if (rm.winner === seat) { w++; sw++; if (rm.state.p[seat].hp <= 0) deadWin++; }
      if (rm.winner === 'draw') { draw++; sd++; }
      g++;
    }
    perShape[cell.n + ':' + cell.mode] = (perShape[cell.n + ':' + cell.mode] || 0) + sw;
  }
  return { win: 100 * w / g, draw: 100 * draw / g, deadWin, g, perShape };
}
const rows = [['只反弹', pickBy((c) => c.key === 'reflect')], ['只狙击', pickBy((c) => c.key === 'snipe')], ['只防御', pickBy((c) => c.key === 'armor')], ['参照v7', T.policyChooserN(ref, 0.15)]];
console.log('# 探针2 混合池桌 ‖ ' + CELLS.length + ' 格（' + SHAPES.length + ' 桌形 × 8 旋转）× ' + G + ' 局');
for (const [tag, sel] of rows) {
  const r = run(sel);
  const shapes = SHAPES.map(([n, m]) => n + ':' + m + ' ' + (100 * (r.perShape[n + ':' + m] || 0) / (8 * G)).toFixed(0)).join(' ‖ ');
  console.log('· ' + tag.padEnd(5) + ' ‖ 夺1 ' + r.win.toFixed(1) + '% ‖ 平局 ' + r.draw.toFixed(1) + '% ‖ 死者胜 ' + r.deadWin + ' ‖ ' + shapes);
}
process.exit(0);
