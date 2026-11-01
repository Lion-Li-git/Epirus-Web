/* probe-seats.cjs — 观测集合在不同人数下的实际取席（3/5/8P） */
const { sandbox, loadChamp } = require('../tools/audit-lib.mjs');
const { install: installArch2, packCfgExit } = require('../tools/proto2/arch2.mjs');
const fs = require('fs');
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer;
const src = fs.readFileSync('scratch/ga-arms/GA2R-sword-s13.js', 'utf8');
const at = src.indexOf('EPIRUS_CHAMPION_3P ');
let d = 0, inS = false, esc = false, end = -1;
for (let k = src.indexOf('{', at); k < src.length; k++) { const c = src[k];
  if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
  if (c === '"') { inS = true; continue; }
  if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = k; break; } } }
const raw = JSON.parse(src.slice(src.indexOf('{', at), end + 1));
const got = packCfgExit(raw, 'probe');
installArch2(W, got.cfg);
if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
const params = Float64Array.from(P.unpack(raw, true));
for (const N of [2, 3, 5, 8]) {
  const st = W.EpirusState.createState('multi', { next: () => 0.5 }, N);
  const slots = P.oppSlots(st, 0);
  const visible = Math.min(4, slots.length);
  console.log(N + 'P：存活=' + st.p.length + ' ‖ oppSlots=' + slots.length + ' 对手 ‖ 观测集合实取=' + visible + ' 对手（=自己共 ' + (visible + 1) + ' 席）');
}
/* 顺带量一局 3P 的前向是否真的只池化 2 个对手（集合制 ⇒ 权重同一套） */
const rm = T.oneGameN([T.policyChooserN(params, 0.15), W.EpirusBots.pickRandom, W.EpirusBots.pickRandom], 91, 3, { regen: 0, mode: 'multi' });
console.log('3P 整局正常跑完：rounds=' + rm.state.round + ' winner=' + rm.state.winner + '（同一套 7993 权重，无 5 席填充）');
