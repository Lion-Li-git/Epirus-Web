/* 验证：pg-lib.tapeForward 重放 obs4 包时，xin 尾块被换成 obs3 族的 hSelf/mean/mx，
 * 且头部 116 维（槽 0-4 嵌入）是采 tape 时的陈旧值 —— supfit-full 的 obs4 KD 桥是否被静默污染。
 * 判据：同一 params 同一 state 下，forwardObs3 直算 logits ≠ tapeForward 重放 logits ⇒ 污染坐实。 */
import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2 } from '../../tools/proto2/arch2.mjs';
import { layoutOf, tailOf, tapeForward } from '../../tools/proto2/pg-lib.mjs';
import { readFileSync } from 'node:fs';

function readPack2(path) {
  const s = readFileSync(path, 'utf8');
  const m = s.match(/EPIRUS_CHAMPION_3P = (\{.*\});?\s*$/s) || s.match(/EPIRUS_CHAMPION_3P = (\{.*?\});/s);
  return m ? JSON.parse(m[1]) : null;
}
function cfgOf(raw) {
  const env = (typeof window !== 'undefined' ? window.EPIRUS_CHAMPION_3P_META : null);
  return raw.dims;
}

const W = sandbox();
const raw = readPack2('scratch/obs4/mini-obs4.js');
installArch2(W, { input: raw.dims.input, gen: raw.dims.gen, keySplit: raw.dims.keySplit, skills: raw.skills || W.EpirusRules.skills.length, seatH: raw.dims.seatH, actH: raw.dims.actH, hid: raw.dims.hid, hid2: raw.dims.hid2, mutMode: 'seg' });
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, B = W.EpirusBots;
const params = new Float64Array(P.paramCount());
const up = P.unpack(raw, true);
params.set(up);
const L = P.__arch2 && P.__arch2.L;
console.log('input=' + L.input + ' ctxDim=' + L.ctxDim + ' n=' + L.n + ' 段=' + L.seg.map(s => s.name).join(','));

/* 跑一局 5P，收集一个 tape（与 supfit 的采法同源：学生自己开车走出来的状态） */
let cap = null;
function chooser(state, pid, legal) {
  try {
    if (!cap && legal && legal.length >= 2) {
      const econ = T.econBase(state, pid, legal);
      const cands = P.candidatesFor(state, pid, econ, { lockTarget: false }) || [];
      if (cands.length >= 2) {
        const o = P.forwardCands(state, pid, cands, params, { wantTape: 1 });
        cap = { state: state, pid, cands, o };
      }
    }
  } catch (e) { console.error('采 tape 失败: ' + (e && e.stack || e)); process.exit(1); }
  return P.chooseCandidates(state, pid, legal, params, { temp: 0.3 });
}
const st = S.createState('multi', { next: T.mulberry32(4242) }, 5);
const bots = [chooser, B.pickRandom, B.pickRandom, B.pickRandom, B.pickRandom];
T.oneGameN(bots, 77, 5, { mode: st.mode });
if (!cap) { console.error('没采到 tape'); process.exit(1); }

const { o, cands } = cap;
const tape = o.tape;
console.log('tape.xin=' + tape.xin.length + ' 维 ‖ 前向 logits[0..2]=' + [...o.logits.slice(0, 3)].map(v => v.toFixed(4)).join(','));

/* pg-lib 重放（supfit 的 acc() 用的就是这条） */
const ly = layoutOf(P);
const a2 = tapeForward(tape, params, ly);
console.log('重放 logits[0..2]=' + [...a2.logits.slice(0, 3)].map(v => v.toFixed(4)).join(','));
const dl = Math.max(...[...a2.logits].map((v, i) => Math.abs(v - o.logits[i])));
console.log('max|直算−重放| = ' + dl.toFixed(6) + (dl > 1e-6 ? '  ⛔ 污染坐实：supfit 的 obs4 KD 桥在重放被改写的前向上训练' : '  ✓ 一致'));

/* 再看 xin 尾块差异（60..251）：重放把尾块换成了 hSelf/mean/mx */
let tailDiff = 0, n = 0;
for (let i = 60; i < L.ctxDim; i++) { if (Math.abs(a2.xin[i] - tape.xin[i]) > 1e-12) { tailDiff++; } n++; }
console.log('xin[60..] 被改写 ' + tailDiff + '/' + n + ' 维');
/* 陈旧性：把 params 抖动一下再重放，看头部槽嵌入动不动（动 = 前向依赖特征被冻结在 tape 里） */
const p2 = Float64Array.from(params);
for (let i = 0; i < 200; i++) p2[i] += 0.05;
const a3 = tapeForward(tape, p2, ly);
let headMoved = 0;
for (let i = 60; i < 180; i++) if (Math.abs(a3.xin[i] - a2.xin[i]) > 1e-12) headMoved++;
console.log('seatEnc 抖动后 xin[60..180) 里仍变化 ' + headMoved + ' 维（=0 说明这些列被 tape 冻结=陈旧）');
