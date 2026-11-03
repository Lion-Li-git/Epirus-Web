/* 标定“与随机起点包不可区分”这条判据的量程（千问 10-30 傍晚）
   随机包之间、随机 vs 短臂、短臂 vs 短臂、v7 vs 随机 —— 各算 argmax 分歧率，看阈值该划在哪 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install, readPack2 } from '../tools/proto2/arch2.mjs';
import { collectFixtures } from '../tools/proto2/head-health.mjs';

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer;
const RAW7 = loadChamp(W, 'js/bundled-champion-3p.js', '');
const REF7 = RAW7 ? Float64Array.from(RAW7) : null;
const FX = collectFixtures(W, { perShape: 10, seed: 555 }).fixtures;
console.log('夹具决策点 = ' + FX.length);

const A = install(W, { input: 'obs3', mutMode: 'seg', seatH: 16, actH: 8, hid: 32, hid2: 24 });
function rndParams(sd) { A.rngRef.r = T.mulberry32(sd); return Float64Array.from(P.makePolicy(0.25)); }
function load(name) { const raw = readPack2('scratch/arms/' + name + '.bak'); return P.unpack(raw); }
const argmaxOf = (params) => FX.map((f) => {
  const fr = P.forwardCands(f.st, f.pid, f.cands, params, { temp: 0.15 });
  const lg = Array.from(fr.logits);
  let bi = 0; for (let i = 1; i < lg.length; i++) if (lg[i] > lg[bi]) bi = i;
  return (f.cands[bi] || {}).key + '/' + ((f.cands[bi] || {}).target == null ? '-' : (f.cands[bi] || {}).target);
});
const disagree = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return (100 * d / a.length).toFixed(1) + '%'; };

const R1 = argmaxOf(rndParams(11));
const R2 = argmaxOf(rndParams(22));
const R3 = argmaxOf(rndParams(33));
console.log('\n—— 随机起点包之间（同架构不同种子，这是“没有信息”的底）——');
console.log('  R1↔R2 ' + disagree(R1, R2) + ' ‖ R1↔R3 ' + disagree(R1, R3) + ' ‖ R2↔R3 ' + disagree(R2, R3));
const named = ['GEN2-s7', 'GEN2-s11', 'GEN2-s13', 'HEADTEST-s7', 'RND-gen2'];
const got = {};
console.log('\n—— 各包 vs 三枚随机起点 ——');
for (const nm of named) {
  let pp = null;
  try { pp = load(nm); } catch (e) { console.log('  ' + nm + ' 装载失败：' + String(e.message).slice(0, 40)); continue; }
  if (!pp) { console.log('  ' + nm + ' unpack=null'); continue; }
  const g = argmaxOf(pp); got[nm] = g;
  console.log('  ' + nm.padEnd(13) + ' 分歧 R1 ' + disagree(g, R1) + ' ‖ R2 ' + disagree(g, R2) + ' ‖ R3 ' + disagree(g, R3) + ' ‖ 平均 ' +
    (100 * (['R1', 'R2', 'R3'].reduce((a, k, i) => a + disagreeN(g, [R1, R2, R3][i]), 0)) / 3).toFixed(1) + '%');
}
function disagreeN(a, b) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d / a.length; }
if (REF7) {
  const g7 = (() => { const prev = P.forwardCands; /* v7 自己那条路：按 probs 取 argmax */ return FX.map((f) => { const fr = prev.call(P, f.st, f.pid, f.cands, REF7, { temp: 0.15 }); const pr = Array.from(fr.probs || fr.logits || []); let bi = 0; for (let i = 1; i < pr.length; i++) if (pr[i] > pr[bi]) bi = i; return (f.cands[bi] || {}).key + '/' + ((f.cands[bi] || {}).target == null ? '-' : (f.cands[bi] || {}).target); }); })();
  console.log('\n—— v7 参照 vs 随机起点 ——');
  console.log('  v7↔R1 ' + disagree(g7, R1) + ' ‖ v7↔R2 ' + disagree(g7, R2) + ' ‖ v7↔GEN2-s11 ' + disagree(g7, got['GEN2-s11'] || []) );
}
console.log('\n—— 两两之间（有训练与无训练是否分得开）——');
const ks = Object.keys(got);
for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) console.log('  ' + ks[i] + '↔' + ks[j] + ' ' + disagree(got[ks[i]], got[ks[j]]));
