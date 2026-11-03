/* 诊断：逐局 diff —— 两趟 holdout（各自新建 chooser）哪几局变了、变局的对手是谁
 * 再验证：resetBotMem 重置能不能翻回、全新 sandbox 首评落在哪个不动点 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

function mulberry32(a) {
  let x = a >>> 0;
  return function () { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function cancelOtherLocal(state, pid) {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) {
      return e.pids[0] === pid ? e.pids[1] : e.pids[0];
    }
  }
  return null;
}
function fixedChooser(P_, T_, R_, keyVal) {
  return function (state, pid, legal) {
    const cs = P_.candidatesFor(state, pid, T_.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || [];
    if (!cs.length) return { key: R_.SK.JI };
    for (const c of cs) {
      if (c.key === keyVal) return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
    }
    const ji = cs.filter((c) => c.key === R_.SK.JI)[0] || cs[0];
    return { key: ji.key, target: ji.target == null ? null : ji.target, target2: null, bead: null };
  };
}
function randChooser(P_, T_, seed, jiKey) {
  const r = mulberry32(seed);
  return function (state, pid, legal) {
    const cs = P_.candidatesFor(state, pid, T_.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || [];
    if (!cs.length) return { key: jiKey };
    const c = cs[Math.floor(r() * cs.length)];
    return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
  };
}
const PREDATORS = ['bigT', 'reflect', 'snipe', 'guard'];

/* ctx = { W, A }；playOne 逐字克隆 arena2.mjs 内部版，只是对手来源改走 ctx */
function makePlayOne(ctx) {
  const { W, A } = ctx;
  const T = W.EpirusTrainer, P = W.EpirusPolicy, R = W.EpirusRules;
  const stratCap = 2, stratMix = 0.5;
  return function playOne(sel, shapeIdx, gameSeq, salt) {
    const shapes = A.shapes;
    const shape = shapes[shapeIdx];
    const n = shape.n;
    const seed = ((salt + gameSeq * 104729 + shapeIdx * 7919 + n * 97) >>> 0) || 1;
    const seat = gameSeq % n;
    const choosers = new Array(n), classes = new Array(n);
    choosers[seat] = sel; classes[seat] = '@me';
    const oppPids = [];
    for (let pid = 0; pid < n; pid++) if (pid !== seat) oppPids.push(pid);
    const stratHere = stratifiedOn(A) && ((gameSeq * 2654435761 ^ shapeIdx * 40503 ^ (salt | 0)) >>> 0) % 1000 < Math.round(stratMix * 1000);
    const predN = stratHere ? Math.min(oppPids.length, stratCap) : 0;
    const predStart = gameSeq % Math.max(1, PREDATORS.length);
    for (let pi = 0; pi < oppPids.length; pi++) {
      const pid = oppPids[pi];
      let e;
      if (pi < predN) {
        const k = PREDATORS[(predStart + pi) % PREDATORS.length];
        e = { name: 'only:' + k, kind: 'fixed', sel: fixedChooser(P, T, R, k) };
      } else {
        const ri = (gameSeq * 7 + pid * 11 + shapeIdx * 13 + salt) % A.roster.length;
        e = A.roster[ri];
      }
      choosers[pid] = e.kind === 'random' ? randChooser(P, T, (seed ^ (pid * 2654435761)) >>> 0, R.SK.JI) : e.sel;
      classes[pid] = e.name;
    }
    const rm = T.oneGameN(choosers, seed, n, { regen: 0, mode: shape.mode });
    const st = rm.state;
    const hp = st.p[seat] ? Math.max(0, st.p[seat].hp) : 0;
    const win = rm.winner === seat;
    const wv = win ? 1 : (rm.winner === 'draw' ? 0.5 : 0);
    const scoreNet = (wv - 1 / n) / (1 - 1 / n);
    const scoreClean = (((win && hp > 0) ? 1 : 0) - 1 / n) / (1 - 1 / n);
    let acts = 0, nonji = 0; const cat = {};
    for (const e of (st.events || [])) if (e.type === 'action' && e.pid === seat) { acts++; cat[e.key] = (cat[e.key] || 0) + 1; if (e.key !== R.SK.JI) nonji++; }
    return { key: shapeIdx + ':' + gameSeq, shape: shape.n + ':' + shape.mode, seat, seed, win, hp, rounds: rm.rounds || 0, acts, nonji, scoreNet, scoreClean, classes: classes.join(','), cat };
  };
}
const stratifiedOn = (A) => !!A.stratified;

function mkCtx() {
  const W = sandbox();
  W.EpirusTrainer.setBigTPush(12);
  const ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
  const refParams = Float64Array.from(ref);
  const A = createArena2(W, { refParams, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
  return { W, A, refParams };
}
function runPass(ctx, tag) {
  const playOne = makePlayOne(ctx);
  const ch = ctx.W.EpirusTrainer.policyChooserN(ctx.refParams, 0.15);
  const rows = [];
  for (let s = 0; s < ctx.A.shapes.length; s++) for (let g = 0; g < 40; g++) rows.push(playOne(ch, s, 100000 + s * 1000 + g, 90001));
  const games = rows.length;
  const win = rows.filter((r) => r.win).length;
  const sumNet = rows.reduce((a, r) => a + r.scoreNet, 0);
  const sumClean = rows.reduce((a, r) => a + r.scoreClean, 0);
  const nonji = rows.reduce((a, r) => a + r.nonji, 0);
  console.log(tag + ': 夺1 ' + (100 * win / games).toFixed(1) + ' 净胜 ' + (sumNet / games).toFixed(3) + ' 干净 ' + (sumClean / games).toFixed(3) + ' nonji ' + nonji);
  return rows;
}
const byKey = (rows) => { const m = {}; for (const r of rows) m[r.key] = r; return m; };
function reportDiff(rowsA, rowsB, tagA, tagB) {
  const m1 = byKey(rowsA), m2 = byKey(rowsB);
  const diffs = [];
  for (const k in m1) {
    const a = m1[k], b = m2[k];
    if (a.win !== b.win || a.hp !== b.hp || a.rounds !== b.rounds || a.acts !== b.acts || a.nonji !== b.nonji) diffs.push(k);
  }
  console.log('\n' + tagA + ' vs ' + tagB + '：不同局数 = ' + diffs.length + ' / ' + rowsA.length);
  for (const k of diffs.slice(0, 30)) {
    const a = m1[k], b = m2[k];
    console.log('  ' + k + ' seat' + a.seat + ' rounds ' + a.rounds + '→' + b.rounds + ' win ' + (a.win ? 1 : 0) + '→' + (b.win ? 1 : 0) + ' hp ' + a.hp + '→' + b.hp + ' acts ' + a.acts + '→' + b.acts + ' nonji ' + a.nonji + '→' + b.nonji);
    console.log('     对手: ' + a.classes);
    if (a.classes !== b.classes) console.log('     对手2: ' + b.classes + '  ⚠ 对手表本身不同');
  }
  return diffs.length;
}

const ctx1 = mkCtx();
const p1 = runPass(ctx1, '同sandbox pass1（应=X 41.6/0.097/5418）');
const p2 = runPass(ctx1, '同sandbox pass2（应=Y 41.8/0.102/5400）');
reportDiff(p1, p2, 'pass1', 'pass2');
const p3 = runPass(ctx1, '同sandbox pass3');
const nd3 = reportDiff(p2, p3, 'pass2', 'pass3');
if (nd3 === 0) console.log('⇒ pass2 与 pass3 逐局相同：从第 2 趟起进入稳定不动点 Y');
/* resetBotMem 能不能翻回 X */
let rbm = null;
for (const ns of ['EpirusTrainer', 'EpirusBots', 'EpirusPolicy']) if (ctx1.W[ns] && typeof ctx1.W[ns].resetBotMem === 'function') rbm = ns + '.resetBotMem';
if (rbm) {
  rbm.split('.')[0] === 'EpirusTrainer' ? ctx1.W.EpirusTrainer.resetBotMem() : ctx1.W[rbm.split('.')[0]].resetBotMem();
  const p4 = runPass(ctx1, 'resetBotMem 后 pass4');
  reportDiff(p1, p4, 'pass1(X)', 'pass4(reset后)');
} else console.log('\n（sandbox 顶层命名空间没有暴露 resetBotMem）');
/* 全新 sandbox 首评 */
const ctx2 = mkCtx();
const p5 = runPass(ctx2, '全新sandbox 首评');
reportDiff(p1, p5, 'pass1(X)', 'fresh首评');
