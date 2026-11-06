/* 微基准：同一夹具、同一候选表，分别量 v7 前向与 2.0(S1o) 前向的单次成本 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
let seed = 4242;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const st = S.createState('multi', { next: rng }, 5); st.rng = { next: rng }; st.round = 6;
st.p[0].ep = 8; for (let i = 0; i < 5; i++) st.p[i].hp = 2 + (i % 3);
const cands = P.candidatesFor(st, 0, T.econBase(st, 0, Play.legalActions(st, 0)), { lockTarget: false });
const mode = process.argv[2] || 'v7';
let params, label;
if (mode === 'v7') { const c = loadChamp(W, 'js/bundled-champion-3p.js', ''); params = Float64Array.from(c); label = 'v7 前向（现役冠军 ' + params.length + ' 参数）'; }
else { const { install } = await import('../tools/proto2/arch2.mjs');
  const A = install(W, { input: 'obs3', seatH: 16, actH: 8, hid: 32, hid2: 24, mutMode: 'seg' });
  params = Float64Array.from(P.makePolicy(0.25)); label = '2.0 S1o 前向（' + params.length + ' 参数）'; }
const N = 20000;
for (let k = 0; k < 200; k++) P.forwardCands(st, 0, cands, params, { temp: 0.5 });   // 预热
const t = process.hrtime.bigint();
for (let k = 0; k < N; k++) P.forwardCands(st, 0, cands, params, { temp: 0.5 });
const ms = Number(process.hrtime.bigint() - t) / 1e6;
console.log(label + ' ‖ 候选 ' + cands.length + ' 枚 ‖ ' + N + ' 次前向 = ' + ms.toFixed(0) + ' ms ‖ 单次 ' + (ms / N * 1000).toFixed(1) + ' µs ‖ 每候选 ' + (ms / N / cands.length * 1000).toFixed(1) + ' µs');
