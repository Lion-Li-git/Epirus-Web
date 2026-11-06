/* 探针（scratch，不入库）：扩表设计的第一道刻度 —— 单一技能对手桌能不能把「只反弹」从顶上拉下来。
 * 只回答一件事：同一批格上，reflect rung 与 v7 参照包各值多少；逐类/逐桌形打印。
 * ⚠ 这不是新尺，只是设计前的对照；正式版本要落成 tools/proto2/arena2.mjs（同构造 + 指纹 + 交叉自检）。
 */
import { sandbox, loadChamp, buildPoolSeeded } from '../tools/audit-lib.mjs';

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const GAMES = Number((process.argv.find((x) => x.startsWith('--games=')) || '--games=20').slice(8)) || 20;
const ref = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
const POOL = buildPoolSeeded(T, ref, 20261029);
if (typeof T.setBigTPush === 'function') T.setBigTPush(12);

function cancelOtherLocal(state, pid) {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) {
      return e.pids[0] === pid ? e.pids[1] : e.pids[0];
    }
  }
  return null;
}
function candsOf(state, pid, legal) {
  return P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || [];
}
function pickBy(pred) {
  return function (state, pid, legal) {
    const cs = candsOf(state, pid, legal);
    if (!cs.length) return { key: R.SK.JI };
    for (const c of cs) if (pred(c)) return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
    const ji = cs.filter((c) => c.key === R.SK.JI)[0] || cs[0];
    return { key: ji.key, target: ji.target == null ? null : ji.target, target2: null, bead: null };
  };
}
function mul(sv) { let a = sv >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function randChooser(seed) {
  const r = mul(seed ^ 0xC0FFEE);
  return function (state, pid, legal) {
    const cs = candsOf(state, pid, legal);
    if (!cs.length) return { key: R.SK.JI };
    const c = cs[Math.floor(r() * cs.length)];
    return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
  };
}
const FIXED = (k) => pickBy((c) => c.key === k);
const SHAPES = [[2, 'multi'], [3, 'multi'], [5, 'multi'], [8, 'multi'], [2, 'long'], [5, 'long']];
const CLASSES = ['mix', 'tankline', 'gun', 'tank', 'snipe', 'drain', 'armor', 'sword', 'cannon', 'taunt', 'mirror', 'reflect', 'beadburst', 'reflectspam', 'defend', 'rand'];
function oppFor(cls, pid, seed) {
  if (cls === 'rand') return randChooser(seed);
  if (cls === 'mix') return POOL[(1 + pid) % POOL.length].sel;
  if (cls.indexOf('pool:') === 0) return POOL[POOL.findIndex((o) => o.name === cls.slice(5))].sel;
  return FIXED(cls);
}
function playRow(sel, cls) {
  let w = 0, g = 0, rounds = 0;
  const perShape = {};
  for (const [n, mode] of SHAPES) {
    let sw = 0;
    for (let i = 0; i < GAMES; i++) {
      const seed = 900000 + n * 7919 + (i + 1) * 104729;
      const seat = i % n;
      const ch = [];
      for (let pid = 0; pid < n; pid++) ch.push(pid === seat ? sel : oppFor(cls, pid, seed));
      const rm = T.oneGameN(ch, seed, n, { regen: 0, mode });
      if (rm.winner === seat) { w++; sw++; }
      g++; rounds += rm.rounds || 0;
    }
    perShape[n + mode] = 100 * sw / GAMES;
  }
  return { win: 100 * w / g, g, rounds: rounds / g, perShape };
}
const rows = [['只反弹', FIXED('reflect')], ['只狙击', FIXED('snipe')], ['只防御', FIXED('armor')], ['参照v7', T.policyChooserN(ref, 0.15)]];
console.log('# arena-probe ‖ 格 ' + (SHAPES.length * CLASSES.length) + '（' + SHAPES.length + ' 桌形 × ' + CLASSES.length + ' 对手类）× ' + GAMES + ' 局 ‖ bigt=12');
for (const [tag, sel] of rows) {
  const out = [];
  let all = 0, games = 0;
  for (const cls of CLASSES) { const r = playRow(sel, cls); out.push(cls + ' ' + r.win.toFixed(0)); all += r.win * r.g; games += r.g; }
  console.log('· ' + tag.padEnd(6) + ' ‖ 总 ' + (all / games).toFixed(1) + '% ‖ ' + out.join(' ‖ '));
}
process.exit(0);
