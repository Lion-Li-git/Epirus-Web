/* 标定第二条判据：**同一串随机数下，两枚包会不会打出同一手**（这才是实测到的“记录撞车”现象本身）
   argmax 分歧率已被否掉（随机包彼此 43~100%，无分离力）⇒ 换成“采样一致率” */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install, readPack2 } from '../tools/proto2/arch2.mjs';
import { collectFixtures } from '../tools/proto2/head-health.mjs';

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer;
const FX = collectFixtures(W, { perShape: 10, seed: 555 }).fixtures;
/* ⚑ 参照包必须在**装档之前**读（装完之后再读就是 null —— 这条坑在册，我上一版正好踩了） */
const REF7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
const A = install(W, { input: 'obs3', mutMode: 'seg', seatH: 16, actH: 8, hid: 32, hid2: 24 });
const rnd = (sd) => { A.rngRef.r = T.mulberry32(sd); return Float64Array.from(P.makePolicy(0.25)); };
const load = (n) => P.unpack(readPack2('scratch/arms/' + n + '.bak'));

/* 每个决策点固定一个随机数 r（同一串给所有包用）⇒ 一致 = 两枚包在同一串骰子上给出同一手 */
const RS = FX.map((f, i) => (function (x) { x = (x * 1664525 + 1013904223) >>> 0; return (x / 4294967296) * 0.999999; })(i * 7919 + 13));
function sampleSeq(params, temp) {
  return FX.map((f, i) => {
    const fr = P.forwardCands(f.st, f.pid, f.cands, params, { temp });
    let acc = 0; const r = RS[i];
    for (let k = 0; k < fr.probs.length; k++) { acc += fr.probs[k]; if (r < acc) return f.cands[k].key + '/' + (f.cands[k].target == null ? '-' : f.cands[k].target); }
    return 'LAST';
  });
}
const agree = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] === b[i]) d++; return (100 * d / a.length).toFixed(0) + '%'; };
const T015 = 0.15, T002 = 0.02;

for (const [tag, temp] of [['t=0.15（在册缺省）', T015], ['t=0.02（这批臂自选的最佳温度）', T002]]) {
  const R1 = sampleSeq(rnd(11), temp), R2 = sampleSeq(rnd(22), temp), R3 = sampleSeq(rnd(33), temp);
  const s7 = sampleSeq(load('GEN2-s7'), temp), s11 = sampleSeq(load('GEN2-s11'), temp), s13 = sampleSeq(load('GEN2-s13'), temp);
  const h8 = sampleSeq(load('HEADTEST-s7'), temp), rg = sampleSeq(load('RND-gen2'), temp);
  const v7 = temp === T015 ? sampleSeq(REF7, temp) : null;
  console.log('\n## ' + tag + '  决策点 ' + FX.length);
  console.log('  底（随机起点彼此）      R1↔R2 ' + agree(R1, R2) + ' ‖ R1↔R3 ' + agree(R1, R3) + ' ‖ R2↔R3 ' + agree(R2, R3));
  console.log('  短臂彼此                s7↔s11 ' + agree(s7, s11) + ' ‖ s7↔s13 ' + agree(s7, s13) + ' ‖ s11↔s13 ' + agree(s11, s13));
  console.log('  短臂 vs 随机            s7↔R1 ' + agree(s7, R1) + ' ‖ s11↔R2 ' + agree(s11, R2) + ' ‖ s13↔R3 ' + agree(s13, R3));
  console.log('  未训臂（evals=8）       h8↔R1 ' + agree(h8, R1) + ' ‖ h8↔RND-gen2 ' + agree(h8, rg) + ' ‖ h8↔s11 ' + agree(h8, s11));
  if (v7) console.log('  v7 vs 随机 / 短臂       v7↔R1 ' + agree(v7, R1) + ' ‖ v7↔s11 ' + agree(v7, s11) + ' ‖ v7↔s13 ' + agree(v7, s13));
}
