/* 只读探针 12：补两个洞——① 珠候选（电磁炮/激光眼）到底可达吗 ② tgt.none 是不是结构性恒零 */
import { sandbox } from '../tools/audit-lib.mjs';
import * as O3 from '../tools/proto2/obs3.mjs';
const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
const M = O3.blocks(R);
let seed = 606;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function cancelOtherLocal(state, pid) { for (let i = state.events.length - 1; i >= 0; i--) { const e = state.events[i];
  if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) return e.pids[0] === pid ? e.pids[1] : e.pids[0]; } return null; }
/* 条件打法：手里没珠就蓄能，有珠就打这一张 */
const beadAndFire = (wantBead, fireKey) => function (state, pid, legal) {
  const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || [];
  const me = state.p[pid];
  const has = wantBead === 'elec' ? me.elec > 0 : me.boom > 0;
  if (has) { for (const c of cs) if (c.key === fireKey) return { key: c.key, target: c.target == null ? null : c.target, bead: c.bead || null }; }
  for (const c of cs) if (c.key === R.SK.CHARGE && (c.bead === wantBead)) return { key: c.key, bead: c.bead };
  for (const c of cs) if (c.key === R.SK.CHARGE) return { key: c.key, bead: c.bead || null };
  const ji = cs.filter((c) => c.key === R.SK.JI)[0]; return ji ? { key: ji.key } : cs[0];
};
for (const [tag, want, fire] of [['电磁炮（需电珠）', 'elec', 'railgun'], ['激光眼（需爆珠）', 'boom', 'laserEye']]) {
  const st = S.createState('multi', { next: rng }, 4); st.rng = { next: rng };
  const lit = new Set(); let dec = 0, sawFire = 0;
  const ch = [];
  for (let pid = 0; pid < 4; pid++) {
    const sel = pid === 0 ? beadAndFire(want, fire) : (pid === 1 ? beadAndFire(want === 'elec' ? 'boom' : 'elec', want === 'elec' ? 'laserEye' : 'railgun') : null);
    ch.push((s, p, legal) => {
      const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: cancelOtherLocal(s, p) }) || [];
      for (const c of cs) { const v = O3.encode(W, s, p, c); for (let i = 0; i < v.length; i++) if (v[i] !== 0) lit.add(M[i].name); if (c.key === fire) sawFire++; }
      dec++;
      return sel ? sel(s, p, legal) : (function () { const ji = cs.filter((c) => c.key === R.SK.JI)[0]; return ji ? { key: ji.key } : { key: R.SK.JI }; })();
    });
  }
  Play.autoGameN(st, ch);
  const probe = ['needBead', 'ownElec', 'ownBoom', 'tgt.none', 'skill.' + fire, 'beadIsElec', 'beadIsBoom', 'beadAfford'];
  console.log('  ' + tag.padEnd(18) + ' 决策 ' + dec + ' ‖ 候选里出现过 ' + fire + '：' + sawFire + ' 次 ‖ 点亮: ' + probe.filter((n) => lit.has(n)).join(' '));
}
/* 结构性检查：卡表里有没有 target 为假的技能（决定 tgt.none 能不能亮） */
const noTgt = R.skills.filter((s) => !s.target).map((s) => s.key);
console.log('\n  卡表里 target 为空/假 的技能：' + (noTgt.length ? noTgt.join(',') : '（一个都没有 ⇒ tgt.none 恒 0，是构造性死维）'));
console.log('  target 取值分布：' + JSON.stringify(R.skills.reduce((a, s) => { a[s.target || '(空)'] = (a[s.target || '(空)'] || 0) + 1; return a; }, {})));
console.log('  energyNeeds 非空的技能：' + R.skills.filter((s) => s.energyNeeds).map((s) => s.key + '=' + JSON.stringify(s.energyNeeds)).join(' '));
