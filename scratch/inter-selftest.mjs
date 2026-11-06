/* 交互头有牙自检（整局级，不是单前向）：
 *   ① inter=4 且交互段全零 ⇒ 与 inter=0 的**整局 holdout 逐位相同**（清零段在局内任何路径都不许漏贡献）；
 *   ② 同一包把交互段随机化 ⇒ 结果必须**不同**（通道真的在前向里）。 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, layout } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

function mkCtx(installOpts) {
  const W = sandbox();
  W.EpirusTrainer.setBigTPush(12);
  const ref = loadChamp(W, 'js/bundled-champion-3p.js', '');   /* 必须在 installArch2 之前读 */
  const refParams = Float64Array.from(ref);
  installArch2(W, installOpts);
  const A = createArena2(W, { refParams, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
  return { W, A, refParams, P: W.EpirusPolicy, T: W.EpirusTrainer };
}
const c0 = mkCtx({ mutMode: 'seg', input: 'obs3' });
const c1 = mkCtx({ mutMode: 'seg', input: 'obs3', inter: 4 });
const SKILLS = c0.W.EpirusRules.skills.length;             /* install() 用引擎的技能数 ⇒ layout 对账必须同一个数 */
const L0 = layout({ input: 'obs3', skills: SKILLS });
const L1 = layout({ input: 'obs3', skills: SKILLS, inter: 4 });
const segI = L1.seg.find((s) => s.name === 'inter');
if (c0.P.paramCount() !== L0.n || c1.P.paramCount() !== L1.n) { console.log('⛔ paramCount 对不上'); process.exit(1); }
console.log('K=0 paramCount=' + c0.P.paramCount() + ' ‖ K=4 paramCount=' + c1.P.paramCount() + '（差 ' + (L1.n - L0.n) + ' = ' + segI.len + '）');

const p0 = Float64Array.from(c0.P.makePolicy(0.25));
c0.P.setRng && c0.P.setRng(c0.T.mulberry32(777));
const p1 = new Float64Array(L1.n); p1.set(p0);            /* 交互段留零 */
/* 随机化交互段（固定种子 mulberry） */
const p2 = Float64Array.from(p1);
{ let x = 4242 >>> 0; const r = () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = segI.off; i < segI.off + segI.len; i++) p2[i] = (r() - 0.5) * 0.5; }

const ev = (c, p) => c.A.evalParams(p, { phase: 'holdout', gamesPerShape: 4, temp: 0.15 });
const j0 = JSON.stringify(ev(c0, p0));
const j1 = JSON.stringify(ev(c1, p1));
const j2 = JSON.stringify(ev(c1, p2));
let ok = true;
console.log('腿① 零段整局等价（K=0 vs K=4+零段，44 局 holdout JSON 全等）: ' + (j0 === j1 ? 'PASS' : 'FAIL'));
ok = ok && j0 === j1;
console.log('腿② 随机交互段改变结果: ' + (j1 !== j2 ? 'PASS' : 'FAIL'));
ok = ok && j1 !== j2;
console.log('   （读数参考：零段 clean ' + JSON.parse(j1).cleanScore.toFixed(3) + ' ‖ 随机段 clean ' + JSON.parse(j2).cleanScore.toFixed(3) + '）');
process.exit(ok ? 0 : 1);
