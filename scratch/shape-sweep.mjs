/* 用户那一问的直接答案：**2.0 原型在不同人数/血量下到底跑不跑得起来**。
 * 今夜之前只量过 `mode:'multi'`（3 血）× n∈{3,5}（`profile2.mjs:99` 与 `rankfit.mjs` 的 `gg % 2 ? 5 : 3`）。
 * 这里扫 n=2..10 × hp 档（standard/multi/multi4/long），每格问四件事：
 *   ① 引擎接不接受这个 n（`createState` 会不会自己夹）② v7 特征面能看见几席（`P.oppSlots`）
 *   ③ obs3 的活席集合大小 ④ S1 与 S1o 的 forward 能不能跑完（抛不抛） */
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
import { scene as obs3Scene } from '../tools/proto2/obs3.mjs';
const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, Play = W.EpirusPlay, T = W.EpirusTrainer;
const MODES = ['standard', 'multi', 'multi4', 'long'];
const rows = [];
for (const mode of MODES) {
  for (let n = 2; n <= 10; n++) {
    let out = { mode, n, hp: (R.MODES[mode] || {}).hp, created: '—', seats: '—', opps: '—', s1: '—', s1o: '—' };
    try {
      const st = S.createState(mode, { next: () => 0.37 }, n);
      st.rng = { next: () => 0.37 };
      out.created = st.p.length;
      out.seats = st.p.filter((q) => q.hp > 0).length;
      const legal = Play.legalActions(st, 0);
      const cands = P.candidatesFor(st, 0, T.econBase(st, 0, legal), { lockTarget: false });
      out.opps = (P.oppSlots(st, 0) || []).length;
      out.scene = (obs3Scene(W, st, 0).seats || []).length;
      const A1 = installArch2(W, { mutMode: 'seg' });
      const h1 = Float64Array.from(P.makePolicy(0.25));
      try { const f = P.forwardCands(st, 0, cands, h1, { temp: 0.5 }); out.s1 = f && f.logits.length === cands.length ? 'ok' : '长度不符'; }
      catch (e) { out.s1 = '抛:' + e.message.slice(0, 26); }
      A1.restore();
      const A2 = installArch2(W, { mutMode: 'seg', input: 'obs3' });
      const h2 = Float64Array.from(P.makePolicy(0.25));
      try { const f = P.forwardCands(st, 0, cands, h2, { temp: 0.5 }); out.s1o = f && f.logits.length === cands.length ? 'ok' : '长度不符'; }
      catch (e) { out.s1o = '抛:' + e.message.slice(0, 26); }
      A2.restore();
    } catch (e) { out.created = '抛:' + e.message.slice(0, 22); }
    rows.push(out);
  }
}
console.log('| 模式（血量档） | n | 引擎造出的席数 | 活席 | v7 面 oppSlots | obs3 scene 席 | S1 forward | S1o forward |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) console.log('| ' + r.mode + '（' + r.hp + ' 血） | ' + r.n + ' | ' + r.created + ' | ' + r.seats + ' | ' + r.opps + ' | ' + (r.scene === undefined ? '—' : r.scene) + ' | ' + r.s1 + ' | ' + r.s1o + ' |');
