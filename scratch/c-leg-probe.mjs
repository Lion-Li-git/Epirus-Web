/* c-leg-probe.mjs — 腿 C 里那些"解析≈0 而数值 1e-8"的格子到底是什么。
 *   对每一格把数值梯度按 ε=1e-3/1e-4/1e-6/1e-8 各算一遍，按斜率分诊：
 *     num ∝ 1/ε（ε 越小越大）⇒ 舍入噪声（解析侧的 0 是对的）
 *     num ∝ ε  （ε 越小越小）⇒ ReLU 折点（不可导，两侧斜率不同 ⇒ 数值法在 kink 上必然给非零）
 *     num 随 ε 不变            ⇒ 解析侧真漏了项 ⇒ 产品坏了
 * 夹具与 selftest3 同法（真打局 + 克隆中盘态 + 同 LCG）。只读 tools/**（现役分支）。 */
import { sandbox, loadChamp, mulberry32 } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { layoutOf, tailOf, dLogPi, tapeForward, tapeBackward } from '../tools/proto2/pg-lib.mjs';

const PACK = process.argv[2] || 'scratch/arms/gd3b-ks-sb.bak';
const W = sandbox();
loadChamp(W, 'js/bundled-champion-3p.js', '');
const raw = readPack2(PACK);
const got = packCfgExit(raw, PACK);
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay;
const params = Float64Array.from(P.unpack(raw, true));
if (!params) { console.error('⛔ 读不出 ' + PACK); process.exit(2); }
const ly = layoutOf(P);
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mulberry = mulberry32;

function decisionPoints(k) {
  const pts = [];
  let g = 0;
  while (pts.length < k && g < 400) {
    g++;
    const st = S.createState('multi', { next: T.mulberry32(1000 + g) }, 3);
    st.slotSalt = (g * 7919) % 100000;
    const ch = T.policyChooserN(params, 0.15);
    for (let r = 0; r < 14 && !st.over; r++) {
      for (let pid = 0; pid < 3; pid++) {
        if (st.p[pid].hp <= 0) continue;
        const legal = Play.legalActions(st, pid);
        if (pts.length < k && rnd() < 0.12) {
          const cands = P.candidatesFor(st, pid, T.econBase(st, pid, legal), { lockTarget: false }) || [];
          if (cands.length >= 2) {
            const snap = S.cloneState(st);
            snap.rng = { next: mulberry(12345) };
            pts.push({ st: snap, pid, cands: P.candidatesFor(snap, pid, T.econBase(snap, pid, legal), { lockTarget: false }) || [] });
          }
        }
        const pk = ch(st, pid, legal);
        S.attemptAction(st, pid, pk.key, { target: pk.target, target2: pk.target2, bead: pk.bead });
      }
      W.EpirusResolve.resolveActions(st);
      W.EpirusResolve.endTurn(st);
    }
  }
  return pts;
}
const E_list = [1e-3, 1e-4, 1e-6, 1e-8];
const numAt = (pt, idx, k, eps) => {
  const p2 = Float64Array.from(params), m2 = Float64Array.from(params);
  p2[k] += eps; m2[k] -= eps;
  const lp = Math.log(Math.max(1e-300, P.forwardCands(pt.st, pt.pid, pt.cands, p2, { temp: 0.15 }).probs[idx]));
  const lm = Math.log(Math.max(1e-300, P.forwardCands(pt.st, pt.pid, pt.cands, m2, { temp: 0.15 }).probs[idx]));
  return (lp - lm) / (2 * eps);
};

const pts = decisionPoints(50);
const cls = { noise: 0, kink: 0, flat: 0, real: 0 };
let printed = 0, scanned = 0;
for (const pt of pts) {
  const fr = P.forwardCands(pt.st, pt.pid, pt.cands, params, { temp: 0.15, wantTape: 1 });
  for (let idx = 0; idx < fr.probs.length; idx++) {
    if (fr.probs[idx] < 0.05 || fr.probs[idx] > 0.95) continue;
    const act = tapeForward(fr.tape, params, ly);
    const t = tailOf(fr.logits, fr.tape.keys, 0.15);
    const g = dLogPi(idx, fr.logits, fr.tape.keys, 0.15, t);
    const grad = new Float64Array(params.length);
    tapeBackward(fr.tape, params, ly, act, g, grad);
    /* 只看"解析≈0 但腿 C 会按 1e-6 抽样撞上"的坐标：随机抽 6 个 ana≈0 的下标 */
    const pick = [];
    for (let k = 0; k < params.length && pick.length < 6; k++) if (Math.abs(grad[k]) < 1e-12 && rnd() < 6 / params.length) pick.push(k);
    for (const k of pick) {
      const vals = E_list.map((e) => numAt(pt, idx, k, e));
      const a = Math.abs(vals[0]), b = Math.abs(vals[2]);   // ε=1e-3 vs 1e-6（差 1000 倍）
      let kind;
      if (Math.max(...vals.map(Math.abs)) < 1e-12) kind = 'flat';
      else if (b > a * 20) kind = 'noise';          // num 随 ε 变小而放大 ⇒ 舍入
      else if (b < a / 20) kind = 'kink';           // num 随 ε 变小而收敛到 0 ⇒ 折点
      else kind = 'real';
      cls[kind]++; scanned++;
      if (kind === 'real' && printed < 8) {
        printed++;
        console.log('  ⚠ 疑似漏项 参数 ' + k + ' ‖ π=' + fr.probs[idx].toExponential(2) + ' ‖ 解析 ' + grad[k].toExponential(2) +
          ' ‖ ' + E_list.map((e, i) => 'ε' + e.toExponential(0) + ':' + vals[i].toExponential(2)).join(' ‖ '));
      }
      if (printed === 0 && (kind === 'kink' || kind === 'noise') && cls[kind] === 1) {
        console.log('  样本（' + kind + '）参数 ' + k + ' ‖ π=' + fr.probs[idx].toExponential(2) + ' ‖ 解析 ' + grad[k].toExponential(2) +
          ' ‖ ' + E_list.map((e, i) => 'ε' + e.toExponential(0) + ':' + vals[i].toExponential(2)).join(' ‖ '));
      }
    }
  }
}
console.log('  分诊：扫 ' + scanned + ' 格 ⇒ 舍入噪声 ' + cls.noise + ' ‖ ReLU 折点 ' + cls.kink + ' ‖ 两边都 0 ' + cls.flat + ' ‖ **疑似真漏项 ' + cls.real + '**');
