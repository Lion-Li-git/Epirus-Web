import { sandbox, loadChamp } from '../../../tools/audit-lib.mjs';
import { install, readPack2, packInstallCfg } from '../../../training/proto2/arch2.mjs';
import { layoutOf, tailOf, tapeForward, tapeBackward, dLogPi, dLogKeyP } from '../../../training/proto2/pg-lib.mjs';

const pack = process.argv[2];
if (!pack) throw new Error('usage: node diagnose-selftest3.mjs <pack>');
const W = sandbox(process.cwd()), P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay;
loadChamp(W, 'js/bundled-champion-3p.js');
const raw = readPack2(pack);
install(W, packInstallCfg(raw, {}).cfg);
const params = Float64Array.from(P.unpack(raw, true));
const ly = layoutOf(P);
let finite = 0, zero = 0, min = Infinity, max = -Infinity;
for (const x of params) {
  if (Number.isFinite(x)) finite++;
  if (x === 0) zero++;
  if (x < min) min = x;
  if (x > max) max = x;
}

let seed = 20261031;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pts = [];
let g = 0;
while (pts.length < 50 && g < 400) {
  g++;
  const st = S.createState('multi', { next: T.mulberry32(1000 + g) }, 3);
  st.slotSalt = (g * 7919) % 100000;
  const ch = T.policyChooserN(params, 0.15);
  for (let r = 0; r < 14 && !st.over; r++) {
    for (let pid = 0; pid < 3; pid++) {
      if (st.p[pid].hp <= 0) continue;
      const legal = Play.legalActions(st, pid);
      if (pts.length < 50 && rnd() < 0.12) {
        const cands = P.candidatesFor(st, pid, T.econBase(st, pid, legal), { lockTarget: false }) || [];
        if (cands.length >= 2) {
          const snap = S.cloneState(st); snap.rng = { next: mulberry(12345) };
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

function analyticGrad(pt, idx) {
  const fr = P.forwardCands(pt.st, pt.pid, pt.cands, params, { temp: 0.15, wantTape: 1 });
  const act = tapeForward(fr.tape, params, ly);
  const t = tailOf(fr.logits, fr.tape.keys, 0.15);
  const grad = new Float64Array(params.length);
  tapeBackward(fr.tape, params, ly, act, dLogPi(idx, fr.logits, fr.tape.keys, 0.15, t), grad);
  return grad;
}
function logPiOf(pv, pt, idx) {
  const fr = P.forwardCands(pt.st, pt.pid, pt.cands, pv, { temp: 0.15 });
  return Math.log(Math.max(1e-300, fr.probs[idx]));
}

let fullPt = null, fullIdx = -1, fullPi = NaN, fullRes = 0;
for (const pt of pts) {
  const fr = P.forwardCands(pt.st, pt.pid, pt.cands, params, { temp: 0.15 });
  for (let i = 0; i < fr.probs.length; i++) {
    if (fr.probs[i] < 0.05 || fr.probs[i] > 0.95) continue;
    const ag = analyticGrad(pt, i);
    let res = 0; for (const x of ag) if (Math.abs(x) > 1e-6) res++;
    if (res > fullRes) { fullRes = res; fullPt = pt; fullIdx = i; fullPi = fr.probs[i]; }
    if (fullRes >= 300) break;
  }
  if (fullRes >= 300) break;
}

const f = P.forwardCands(pts[13].st, pts[13].pid, pts[13].cands, params, { temp: 1, wantTape: 1 });
const keys = f.tape.keys, t0 = tailOf(f.logits, keys, 1);
const groups = {};
for (let i = 0; i < keys.length; i++) (groups[keys[i]] ||= []).push(i);
const ties = Object.entries(groups).filter(([, ix]) => {
  const m = Math.max(...ix.map(i => f.logits[i]));
  return ix.filter(i => f.logits[i] === m).length > 1;
}).map(([k, ix]) => ({ key: k, indices: ix, logits: ix.map(i => f.logits[i]) }));
const fRows = [];
for (const k of Object.keys(groups)) {
  const ag = dLogKeyP(k, f.logits, keys, 1, t0);
  for (const eps of [1e-4, 1e-5, 1e-6, 1e-7]) {
    let worst = 0, worstJ = -1, numWorst = 0, anaWorst = 0;
    for (let j = 0; j < f.logits.length; j++) {
      const p2 = Float64Array.from(f.logits), m2 = Float64Array.from(f.logits);
      p2[j] += eps; m2[j] -= eps;
      const num = (Math.log(tailOf(p2, keys, 1).kProb[k]) - Math.log(tailOf(m2, keys, 1).kProb[k])) / (2 * eps);
      const err = Math.abs(num - ag[j]);
      if (err > worst) { worst = err; worstJ = j; numWorst = num; anaWorst = ag[j]; }
    }
    if (worst > 1e-8 + 1e-3 * Math.max(Math.abs(numWorst), Math.abs(anaWorst))) fRows.push({ key: k, eps, j: worstJ, analytic: anaWorst, numeric: numWorst, absErr: worst });
  }
}

const cCoords = pack.includes('seg1200') ? [5708, 5772, 5965, 6056] : [];
const cRows = [];
if (fullPt) for (const k of cCoords) {
  const ag = analyticGrad(fullPt, fullIdx)[k];
  for (const eps of [1e-4, 1e-5, 1e-6, 1e-7]) {
    const p2 = Float64Array.from(params), m2 = Float64Array.from(params);
    p2[k] += eps; m2[k] -= eps;
    const lp = logPiOf(p2, fullPt, fullIdx), lm = logPiOf(m2, fullPt, fullIdx);
    const num = (lp - lm) / (2 * eps);
    cRows.push({ k, eps, analytic: ag, numeric: num, absErr: Math.abs(num - ag) });
  }
}

console.log(JSON.stringify({ pack, params: { n: params.length, finite, zero, min, max }, points: pts.length,
  full: { pi: fullPi, resolvable: fullRes, chosen: fullPt ? fullIdx : null },
  fPoint: { candidates: keys.length, logits: Array.from(f.logits), ties, failures: fRows },
  cProbe: cRows }, null, 2));
