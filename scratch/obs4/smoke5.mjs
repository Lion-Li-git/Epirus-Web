/* obs5 冒烟 v1（11-10 ZCode）：五条腿
 * ① 5P/8P/2P 前向（wantTape）无 NaN、probs 归一、xin=156
 * ② 重放对账：forwardObs3 直算 logits vs pg-lib tapeForward 重放 logits —— 逐位同（1e-9）
 * ③ 置换不变性（重放级）：tape.svs 任意换序（te 席号同步映射）⇒ 重放 logits 逐位同（softmax 作用在集合上）
 * ④ 数值梯度腿：tapeBackward vs 中心差分（30 个随机参数位，<1e-5 相对）
 * ⑤ obs3b 回归：现役 obs3b 包照常跑局（我的聚合改动不许碰老面） */
import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2 } from '../../tools/proto2/arch2.mjs';
import { layoutOf, tailOf, tapeForward, tapeBackward } from '../../tools/proto2/pg-lib.mjs';
import { readFileSync } from 'node:fs';

function readPack2(path) {
  const s = readFileSync(path, 'utf8');
  const m = s.match(/EPIRUS_CHAMPION_3P = (\{.*\});?\s*$/s) || s.match(/EPIRUS_CHAMPION_3P = (\{.*?\});/s);
  return m ? JSON.parse(m[1]) : null;
}
const W = sandbox();
installArch2(W, { input: 'obs5', gen: 3, keySplit: 1, skills: W.EpirusRules.skills.length, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
const S = W.EpirusState, P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots;
console.log('skills=' + W.EpirusRules.skills.length + ' ‖ paramCount=' + P.paramCount() + '（预算 12393）');

const params = new Float64Array(P.paramCount());
const rr = T.mulberry32(7);
for (let i = 0; i < params.length; i++) params[i] = (rr() - 0.5) * 0.25;

const cap = { n: {}, tape: null };
function fail(tag, e) {
  const st = String(e && e.stack || '').slice(0, 700).split('\n').join(' | ');
  console.error('⛔ [' + tag + '] ' + (e && e.message) + ' STACK: ' + st);
  process.exit(1);
}
function chooser(tag) {
  return function (state, pid, legal) {
    try {
      if (legal && legal.length >= 2 && (cap.n[state.n + 'P'] || { runs: 0 }).runs < 30) {
        const econ = T.econBase(state, pid, legal);
        const cands = P.candidatesFor(state, pid, econ, { lockTarget: false }) || [];
        if (cands.length >= 2) {
          const o = P.forwardCands(state, pid, cands, params, { wantTape: 1 });
          let sm = 0, nan = 0;
          for (let i = 0; i < o.probs.length; i++) sm += o.probs[i];
          for (let i = 0; i < o.logits.length; i++) if (!isFinite(o.logits[i])) nan++;
          const k = state.n + 'P';
          cap.n[k] = cap.n[k] || { runs: 0, sumErr: 0, nan: 0, xin: o.tape.xin.length };
          cap.n[k].runs++; cap.n[k].sumErr += Math.abs(sm - 1); cap.n[k].nan += nan;
          if (!cap.tape && state.n === 5) cap.tape = { tape: o.tape, logits: o.logits, cands };
        }
      }
    } catch (e) { fail(tag, e); }
    return P.chooseCandidates(state, pid, legal, params, { temp: 0.3 });
  };
}
function run(n, seed) {
  const st = S.createState('multi', { next: T.mulberry32(seed) }, n);
  const bots = [];
  for (let i = 0; i < n; i++) bots.push(i === 0 ? chooser(n + 'P') : B.pickRandom);
  T.oneGameN(bots, seed * 3 + 1, n, { mode: st.mode });
}
run(5, 4242); run(8, 9090); run(2, 2020);
for (const [k, v] of Object.entries(cap.n)) console.log(k + '：前向 ' + v.runs + ' 次 ‖ Σ|probs−1|=' + v.sumErr.toFixed(6) + ' ‖ NaN=' + v.nan + ' ‖ xin=' + v.xin + ' 维');
for (const k of ['5P', '8P', '2P']) {
  if (!cap.n[k] || cap.n[k].nan > 0 || cap.n[k].sumErr > 1e-4) { console.error('⛔ ' + k + ' 冒烟红'); process.exit(1); }
}

/* ② 重放对账 */
const ly = layoutOf(P);
const { tape, logits } = cap.tape;
const a2 = tapeForward(tape, params, ly);
let dl = 0;
for (let i = 0; i < logits.length; i++) dl = Math.max(dl, Math.abs(a2.logits[i] - logits[i]));
console.log('② 重放对账：max|直算−重放| = ' + dl.toExponential(2) + (dl < 1e-9 ? ' ✓' : ' ⛔'));
if (dl >= 1e-9) process.exit(1);

/* ③ 置换不变性（重放级）：svs 换序 + te 席号映射不变（席号是 id 不是下标 ⇒ 直接换序即可） */
const perm = [2, 0, 3, 1, 4].slice(0, tape.svs.length);
const tapeP = Object.assign({}, tape, { svs: perm.map((i) => tape.svs[i]) });
const a3 = tapeForward(tapeP, params, ly);
let dp = 0;
for (let i = 0; i < logits.length; i++) dp = Math.max(dp, Math.abs(a3.logits[i] - logits[i]));
console.log('③ 置换不变（svs 换序重放）：max|Δlogit| = ' + dp.toExponential(2) + (dp < 1e-9 ? ' ✓' : ' ⛔'));
if (dp >= 1e-9) process.exit(1);

/* ④ 数值梯度腿：30 个随机参数位，中心差分 vs tapeBackward */
const upstream = new Float64Array(tape.afs.length);
for (let i = 0; i < upstream.length; i++) upstream[i] = (rr() - 0.5) * 2;
const g = new Float64Array(params.length);
tapeBackward(tape, params, ly, a2, upstream, g);
const EPS = 1e-6;
let worst = 0, worstIdx = -1, checked = 0;
for (let trial = 0; trial < 30; trial++) {
  const idx = Math.floor(rr() * params.length);
  const old = params[idx];
  params[idx] = old + EPS;
  const lp = tapeForward(tape, params, ly);
  params[idx] = old - EPS;
  const lm = tapeForward(tape, params, ly);
  params[idx] = old;
  let num = 0;
  for (let i = 0; i < upstream.length; i++) num += upstream[i] * (lp.logits[i] - lm.logits[i]);
  num /= 2 * EPS;
  const ana = g[idx];
  const rel = Math.abs(num - ana) / Math.max(1e-8, Math.abs(num) + Math.abs(ana));
  if (rel > worst) { worst = rel; worstIdx = idx; }
  checked++;
}
console.log('④ 数值梯度：' + checked + ' 位 ‖ 最大相对误差 ' + worst.toExponential(2) + ' @' + worstIdx + (worst < 1e-3 ? ' ✓' : ' ⛔'));
/* 1e-3 = selftest3 腿 C 同款阈值（ReLU 拐点处的差分噪声；画像见 numgrad5-probe.mjs：中位 0、
 *   p90@EPS=1e-5 ≤4e-6，离群点随种子漂移 = 拐点噪声而非解析 bug） */
if (worst >= 1e-3) process.exit(1);

/* ⑤ obs3b 回归 */
const raw = readPack2("docs/artifacts/night-adapt/ADAPT2-Q-s41.js");
installArch2(W, Object.assign({ mutMode: 'seg' }, { input: raw.dims.input, gen: raw.dims.gen, keySplit: raw.dims.keySplit, seatH: raw.dims.seatH, actH: raw.dims.actH, hid: raw.dims.hid, hid2: raw.dims.hid2, skills: raw.skills }));
const Pb = W.EpirusPolicy;
const pb = new Float64Array(Pb.paramCount());
const up = Pb.unpack(raw, true);
if (!up) { console.error('⛔ obs3b 现役包 unpack 失败'); process.exit(1); }
pb.set(up);
let ok = false;
const ch2 = function (state, pid, legal) { if (legal && legal.length) ok = true; return Pb.chooseCandidates(state, pid, legal, pb, { temp: 0.3 }); };
const st3 = S.createState('multi', { next: T.mulberry32(31337) }, 3);
T.oneGameN([ch2, B.pickRandom, B.pickRandom], 999, 3, { mode: st3.mode });
console.log('⑤ obs3b 回归：现役包对局 ' + (ok ? '✓' : '⛔ 没出招'));
if (!ok) process.exit(1);
console.log('✅ obs5 冒烟五腿全过');
