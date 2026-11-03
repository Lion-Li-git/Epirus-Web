/* 只读探针 11（最终版可达性扫描）：对**每一枚候选**编码，按**决策数**封顶（不是编码数） */
import { sandbox } from '../tools/audit-lib.mjs';
import * as O3 from '../tools/proto2/obs3.mjs';
const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
const M = O3.blocks(R); const D = M.length;
let seed = 8080;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function cancelOtherLocal(state, pid) {
  for (let i = state.events.length - 1; i >= 0; i--) { const e = state.events[i];
    if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) return e.pids[0] === pid ? e.pids[1] : e.pids[0]; }
  return null;
}
const fixed = (key) => function (state, pid, legal) {
  const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || [];
  if (!cs.length) return { key: R.SK.JI };
  for (const c of cs) if (c.key === key) return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
  const ji = cs.filter((c) => c.key === R.SK.JI)[0]; return ji ? { key: ji.key } : cs[0];
};
const shapes = [{n:2,m:'multi'},{n:2,m:'long'},{n:3,m:'multi4'},{n:5,m:'multi'},{n:5,m:'long'},{n:8,m:'multi'},{n:10,m:'multi'}];
const force = ['gun','tank','guard','reflect','taunt','mine','curse','firestorm','cannon','ring','charge','railgun','laserEye','bagua','proto','holo','drain','mirror','dualGun','snipe','sword','armor','shift','jinshield','rod','miniT','bigT','transfer','purify','ji'];
const nz = new Array(D).fill(0); let decisions = 0; const perShape = {};
for (const shape of shapes) { let sd = 0;
  for (let g = 0; g < 5; g++) {
    const st = S.createState(shape.m, { next: rng }, shape.n); st.rng = { next: rng };
    const ch = [];
    for (let pid = 0; pid < shape.n; pid++) {
      const key = force[(g * 4 + pid * 3) % force.length];
      const sel = R.skills.some((s) => s.key === key) ? fixed(key) : fixed('ji');
      ch.push((s, p, legal) => {
        const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: cancelOtherLocal(s, p) }) || [];
        for (const c of cs) { const v = O3.encode(W, s, p, c); for (let i = 0; i < D; i++) if (v[i] !== 0) nz[i]++; }
        decisions++; sd++; return sel(s, p, legal);
      });
    }
    try { Play.autoGameN(st, ch); } catch (e) {}
  }
  perShape[shape.n + ':' + shape.m] = sd;
}
console.log('决策数=' + decisions + ' ‖ ' + Object.entries(perShape).map(([k,v])=>k+'='+v).join(' '));
const never=[],rare=[];
for (let i=0;i<D;i++){const r=nz[i]/decisions; if(nz[i]===0) never.push(M[i].name); else if(r<0.02) rare.push(M[i].name+' '+(100*r).toFixed(1)+'%');}
const byB={};for(const nm of never){const b=M.find(x=>x.name===nm).block;byB[b]=(byB[b]||[]).concat(nm);}
console.log('仍为 0 的维（'+never.length+'/'+D+'）：');
for(const b of Object.keys(byB)) console.log('  ['+b+'] '+byB[b].join(' ‖ '));
console.log('出现率<2% 的维（'+rare.length+'）：'+rare.join(' ‖ '));
