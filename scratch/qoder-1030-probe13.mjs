import { sandbox } from '../tools/audit-lib.mjs';
const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
let seed = 1212;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const st = S.createState('multi', { next: rng }, 3); st.rng = { next: rng };
let sawRail = 0, fired = 0;
const ch = [];
for (let pid = 0; pid < 3; pid++) ch.push((s, p, legal) => {
  const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: null }) || [];
  if (p === 0) { for (const c of cs) if (c.key === 'railgun') sawRail++;
    const me = s.p[0];
    const fire = cs.find((c) => c.key === 'railgun');
    if (fire) { fired++; return { key: fire.key, target: fire.target, bead: null }; }
    const chg = cs.find((c) => c.key === R.SK.CHARGE && c.bead === 'elec');
    if (chg && me.ep >= 3) return { key: chg.key, bead: 'elec' };
    const ji = cs.find((c) => c.key === R.SK.JI); return ji ? { key: ji.key } : cs[0];
  }
  const ji = cs.find((c) => c.key === R.SK.JI); return ji ? { key: ji.key } : { key: R.SK.JI };
});
Play.autoGameN(st, ch);
console.log('  pid0 候选里出现 railgun：' + sawRail + ' 次 ‖ 真打了：' + fired + ' 次 ‖ 回合 ' + st.round);
