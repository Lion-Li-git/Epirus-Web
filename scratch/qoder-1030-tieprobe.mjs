/* 同一批真局状态上，逐候选 logits 到底有几个不同值（并列 ⇒ 打分不分候选 ⇒ 出手由抽卡决定，包不包都一样） */
import { sandbox } from '../tools/audit-lib.mjs';
import { install, readPack2 } from '../tools/proto2/arch2.mjs';
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules, Play = W.EpirusPlay, S = W.EpirusState;
const packs = process.argv.slice(2);
let seed = 1234; const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const states = [];
for (const mk of ['multi', 'long']) for (const n of [3, 5]) for (let g = 0; g < 2; g++) {
  const st = S.createState(mk, { next: rng }, n); st.rng = { next: rng };
  const ch = [];
  for (let pid = 0; pid < n; pid++) ch.push((s, p, legal) => { const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: null }) || []; const want = cs.find((c) => c.key !== 'ji') || cs[0]; return want ? { key: want.key, target: want.target, bead: want.bead } : { key: R.SK.JI }; });
  try { Play.autoGameN(st, ch); } catch (e) {}
  const st2 = S.createState(mk, { next: rng }, n); st2.rng = { next: rng }; st2.round = 4;
  for (let i = 0; i < n; i++) { st2.p[i].ep = 3 + i; st2.p[i].hp = (i % 3) + 1; }
  const cands = P.candidatesFor(st2, 0, T.econBase(st2, 0, Play.legalActions(st2, 0)), { lockTarget: false });
  if (cands.length > 3) states.push({ st: st2, cands, tag: n + ':' + mk + '#' + g });
}
console.log('状态数=' + states.length);
for (const nm of packs) {
  const raw = readPack2('scratch/arms/' + nm + '.bak');
  const A = install(W, Object.assign({ mutMode: 'seg' }, raw.dims));
  A.rngRef.r = T.mulberry32(4242);
  const params = P.unpack(raw);
  const out = [];
  let degenerate = 0;
  for (const s of states) {
    const f = A.forwardCands(s.st, 0, s.cands, params, { temp: 0.15 });
    const lg = Array.from(f.logits);
    const distinct = new Set(lg.map((x) => x.toFixed(12))).size;
    if (distinct <= 2) degenerate++;
    out.push(s.tag + ' 候选' + lg.length + '/异值' + distinct + '/极差' + (Math.max(...lg) - Math.min(...lg)).toFixed(4));
  }
  console.log('  ' + nm.padEnd(11) + ' 退化(异值≤2)的局 ' + degenerate + '/' + states.length + ' ‖ ' + out.slice(0, 3).join(' ‖ '));
  A.restore();
}
