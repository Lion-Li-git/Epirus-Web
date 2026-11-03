#!/usr/bin/env node
/* obs3b-tooth.mjs — 新块有牙检验（消融 → logits 逐位对照；scratch 诊断件） */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install, readPack2, packInstallCfg } from '../tools/proto2/arch2.mjs';
import { setAblate } from '../tools/proto2/obs3.mjs';

const PACK = process.argv[2] || 'scratch/arms/OBS3B-smoke.bak';
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay;
const ref = loadChamp(W, 'js/bundled-champion-3p.js');
const raw = readPack2(PACK);
const got = packInstallCfg(raw, {});
install(W, got.cfg);
const params = Float64Array.from(P.unpack(raw, true));

const st = S.createState('multi', { next: T.mulberry32(4242) }, 3);
st.slotSalt = 9;
const ch = T.policyChooserN(params, 0.15);
for (let r = 0; r < 10 && !st.over; r++) {
  const picks = [];
  for (let pid = 0; pid < 3; pid++) if (st.p[pid].hp > 0) picks.push([pid, ch(st, pid, Play.legalActions(st, pid))]);
  for (const [pid, pk] of picks) S.attemptAction(st, pid, pk.key, { target: pk.target, target2: pk.target2, bead: pk.bead });
  W.EpirusResolve.resolveActions(st);
  W.EpirusResolve.endTurn(st);
}
const pid = 0;
const legal = Play.legalActions(st, pid).filter((x) => x.affordable);
const cands = legal.slice(0, 8).map((x) => ({ key: x.key, target: legal.length > 1 ? (pid + 1) % 3 : null }));
function logitsWith(ablate) {
  setAblate(ablate);
  const f = P.forwardCands(st, pid, cands, params, { temp: 0.15 });
  setAblate(null);
  return Array.from(f.logits).map((x) => x.toFixed(4)).join(',');
}
const base = logitsWith(null);
console.log('决策点：round', st.round, '‖ 候选', cands.length, '‖ 基线 logits', base.slice(0, 40) + '…');
for (const blk of ['Q.bag', 'S.self', 'P.opp', 'G', 'C.cand', 'C.id', 'Q.seq', 'Q.out']) {
  let l;
  try { l = logitsWith([blk]); } catch (e) { l = 'ERR:' + e.message.slice(0, 40); }
  console.log(blk.padEnd(8) + (l !== base ? ' 有牙 ✔' : ' ⚠ 零牙（logits 逐位同）'));
}
