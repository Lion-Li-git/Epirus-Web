/* 探针 3（scratch）：扩的是**对手表**——20 只脚本 bot + 11 条单技能固定打法，混合坐席；
 * 桌形轴同时扩到 2/3/5/8/10 人 × 3/4/5 血。看「只反弹」是否还在参照包之上，以及谁是新顶格。
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
const DEGEN = ['reflect', 'snipe', 'drain', 'taunt', 'armor', 'sword', 'cannon', 'tank', 'dualGun', 'gun', 'mirror'];
const POOL2 = POOL.map((o) => ({ name: o.name, sel: o.sel })).concat(DEGEN.map((k) => ({ name: 'only:' + k, sel: pickBy((c) => c.key === k) })));
const SHAPES = [[2, 'multi'], [2, 'long'], [3, 'multi'], [3, 'multi4'], [3, 'long'], [5, 'multi'], [5, 'multi4'], [5, 'long'], [8, 'multi'], [10, 'multi']];
function run(sel) {
  let w = 0, g = 0, draw = 0, deadWin = 0;
  const byClass = {};
  for (const [n, mode] of SHAPES) {
    for (let i = 0; i < G; i++) {
      const seed = 4000 + n * 97 + i * 7919 + (mode === 'long' ? 311 : mode === 'multi4' ? 173 : 0);
      const seat = i % n;
      const ch = [];
      const cls = [];
      for (let pid = 0; pid < n; pid++) {
        if (pid === seat) { ch.push(sel); continue; }
        const j = (i * 3 + pid * 5 + n) % POOL2.length;
        cls.push(POOL2[j].name);
        ch.push(POOL2[j].sel);
      }
      const rm = T.oneGameN(ch, seed, n, { regen: 0, mode });
      const win = rm.winner === seat;
      if (win) { w++; if (rm.state.p[seat].hp <= 0) deadWin++; }
      if (rm.winner === 'draw') draw++;
      g++;
      for (const c of cls) { byClass[c] = byClass[c] || { w: 0, g: 0 }; byClass[c].g++; if (win) byClass[c].w++; }
    }
  }
  return { win: 100 * w / g, draw: 100 * draw / g, deadWin, g, byClass };
}
const rows = [['只反弹', pickBy((c) => c.key === 'reflect')], ['只狙击', pickBy((c) => c.key === 'snipe')], ['只摄魂', pickBy((c) => c.key === 'drain')], ['只装甲', pickBy((c) => c.key === 'armor')], ['参照v7', T.policyChooserN(ref, 0.15)]];
console.log('# 探针3 扩对手表（20 脚本 + 11 单技能）‖ ' + SHAPES.length + ' 桌形 × ' + G + ' 局 ‖ 池 ' + POOL2.length + ' 项');
const res = [];
for (const [tag, sel] of rows) { const r = run(sel); res.push([tag, r]); console.log('· ' + tag.padEnd(5) + ' ‖ 夺1 ' + r.win.toFixed(1) + '% ‖ 平局 ' + r.draw.toFixed(1) + '% ‖ 死者胜 ' + r.deadWin); }
const v7 = res.filter((x) => x[0] === '参照v7')[0][1].win;
const best = res.filter((x) => x[0] !== '参照v7').sort((a, b) => b[1].win - a[1].win)[0];
console.log('⇒ 参照 v7 ' + v7.toFixed(1) + '% ‖ 最高的固定打法 ' + best[0] + ' ' + best[1].win.toFixed(1) + '% ⇒ ' + (best[1].win >= v7 ? '⛔ 仍不能当尺' : '✔ 退化打法在参照之下'));
console.log('  反射的逐对手类读数（夺1）：' + Object.keys(res[0][1].byClass).sort((a, b) => res[0][1].byClass[b].w / res[0][1].byClass[b].g - res[0][1].byClass[a].w / res[0][1].byClass[a].g).map((k) => k + ' ' + (100 * res[0][1].byClass[k].w / res[0][1].byClass[k].g).toFixed(0)).join(' ‖ '));
process.exit(0);
