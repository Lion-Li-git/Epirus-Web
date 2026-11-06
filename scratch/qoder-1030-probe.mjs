/* 只读探针（千问 10-30 复核）：不改任何在册文件，只印读数。
   查四件事：
   P1 obs3 的 round 分母是否忽略 state.mode.maxRounds（long=140）
   P2 L0 里哪些维在 arena2 实际环境恒零 / 越界（n/6、seats/6、aoeCount/5 等量程）
   P3 网络那条路（arch2 forwardObs3）的池化是否把"自己"也算进 mean/max —— 与 obs3.encode 的口径对比
   P4 obs3 逐维死维扫描：真跑若干局，统计每一维的非零率与组间方差 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install } from '../tools/proto2/arch2.mjs';
import * as O3 from '../tools/proto2/obs3.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
const obs3Encode = O3.encode, obs3Blocks = O3.blocks, obs3Scene = O3.scene;

/* ---------- P1：long 模式下 round 分母 ---------- */
console.log('=== P1 round 分母（mode.maxRounds vs R.MAX_ROUNDS）===');
console.log('R.MAX_ROUNDS=' + R.MAX_ROUNDS + ' ‖ R.SUDDEN_DEATH=' + R.SUDDEN_DEATH);
for (const mk of ['multi', 'multi4', 'long']) {
  const st = S.createState(mk, { next: () => 0.5 }, 5);
  const modeMax = (st.mode && st.mode.maxRounds) || null;
  const sd = (st.mode && st.mode.suddenDeath != null) ? st.mode.suddenDeath : null;
  st.round = modeMax ? Math.floor(modeMax * 0.8) : 48;   // long: 112 / 其余: 48
  const cands = P.candidatesFor(st, 0, [{ key: R.SK.JI, affordable: true }], { lockTarget: false });
  const sc = obs3Scene(W, st, 0);
  const gRound = sc.g[3];
  const cp = O3.candOf(sc, cands[0]);
  const endIdx = 0; // 找 endgame 维
  const M = obs3Blocks(R);
  const at = M.findIndex((x) => x.name === 'endgame');
  const enc = obs3Encode(W, st, 0, cands[0]);
  console.log(`  ${mk}: state.mode.maxRounds=${modeMax} suddenDeath=${sd} ‖ 本局 round=${st.round}` +
    ` ‖ obs3 G.round=${gRound.toFixed(3)} ${gRound > 1 ? '⚠️ 越过 1（分母只认 60）' : ''}` +
    ` ‖ endgame 维(#${at})=${enc[at]} ${enc[at] ? '⚠️ 该回合被判终局' : ''}`);
}

/* ---------- P2：L0/量程维在各桌形下的取值 ---------- */
console.log('\n=== P2 L0 维取值与量程 ===');
for (const n of [2, 5, 8, 10]) {
  const st = S.createState('multi', { next: () => 0.5 }, n);
  const sc = obs3Scene(W, st, 0);
  const cands = P.candidatesFor(st, 0, [{ key: R.SK.JI, affordable: true }], { lockTarget: false });
  const enc = obs3Encode(W, st, 0, cands[0]);
  const M = obs3Blocks(R);
  const idxOf = (nm) => M.findIndex((x) => x.name === nm);
  console.log(`  n=${n}: G=[` + sc.g.map((x) => x.toFixed(2)).join(',') + `] priv=[` + sc.priv.map((x) => x.toFixed(2)).join(',') + `]` +
    ` sums=[` + sc.sums.map((x) => x.toFixed(2)).join(',') + `]` +
    ` ‖ n维=${enc[idxOf('n')].toFixed(3)} alive=${enc[idxOf('alive')].toFixed(3)} modeHp=${enc[idxOf('modeHp')].toFixed(3)} epRegen=${enc[idxOf('epRegen')].toFixed(3)}` +
    ` ‖ pool.count=${enc[idxOf('pool.count')].toFixed(3)}`);
}
/* epRegen 到底谁写：产品/arena2 有没有非 0 的局 */
let regenOn = 0, regenTot = 0;
for (const mk of ['multi', 'multi4', 'long']) {
  for (const r0 of [0, 2]) {
    const st = S.createState(mk, { next: () => 0.5 }, 3, { regen: r0 });
    regenTot++; if (st.epRegen) regenOn++;
  }
}
console.log('  createState 传 regen 才置位：本探针里 epRegen>0 的桌 ' + regenOn + '/' + regenTot + '（arena2 playOne 恒传 regen:0）');

/* ---------- P3：池化到底含不含自己 ---------- */
console.log('\n=== P3 池化口径：obs3.encode(平面向量) vs arch2.forwardObs3(网络) ===');
{
  const st = S.createState('multi', { next: () => 0.5 }, 5);
  st.rng = { next: () => 0.5 };
  for (let i = 0; i < 5; i++) { st.p[i].hp = 3 + i * 2; st.p[i].ep = i; }
  const cands = P.candidatesFor(st, 0, T.econBase(st, 0, Play.legalActions(st, 0)), { lockTarget: false });
  const sc = obs3Scene(W, st, 0);
  /* 平面向量口径：mean 只对 !isSelf */
  const opps = sc.seats.filter((s) => !s.isSelf);
  const meanHpEnc = (() => { let a = 0; for (const s of opps) a += s.public[0] / opps.length; return a; })();
  const allHpMean = (() => { let a = 0; for (const s of sc.seats) a += s.public[0] / sc.seats.length; return a; })();
  console.log('  对手 hp 均值（encode 口径，排除自己）=' + meanHpEnc.toFixed(4) +
    ' ‖ 全体 hp 均值（含自己）=' + allHpMean.toFixed(4) + ' ‖ 自己 hp=' + sc.seats.find((s) => s.isSelf).public[0].toFixed(4));
  /* 网络那条路：seatH 维的 mean 是编码后隐向量，无法直接比 hp，但可以用"把 hp 灌满整段 seatEnc 权重=单位读出"的构造：
     更省事的做法——数分母：网络用 seats.length（含自己）还是 opps.length */
  const A = install(W, { input: 'obs3', mutMode: 'seg', seatH: 16, actH: 8, hid: 32, hid2: 24 });
  const src = String(A.forwardCands);
  const incSelfNet = /for \(const s of sc\.seats\)/.test(src) && !/sc\.seats\.filter/.test(src);
  A.restore();
  console.log('  网络池化循环遍历的是 sc.seats（含 isSelf=1 那一席）吗：' + (incSelfNet ? '是 ⇒ 自己进 mean/max' : '需人工看') +
    ' ‖ 设计文档 L1.5 写的是 mean/max_{i≠self}');
  /* 反证：让"自己"的血远低于对手，看 max 池是否被自己污染（encode 口径与网络口径应给出不同列） */
  const e1 = obs3Encode(W, st, 0, cands[0]);
  const M = obs3Blocks(R);
  const i = M.findIndex((x) => x.name === 'pool.max.hp');
  console.log('  encode 的 pool.max.hp=' + e1[i].toFixed(4) + '（= 对手里最' + (e1[i] > 0.9 ? '高' : '') + '的那个，不含自己）');
}

/* ---------- P4：真跑若干局，逐维扫死维 ---------- */
console.log('\n=== P4 逐维非零率 / 组间方差（真决策抽样）===');
let seed = 4242;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const M = obs3Blocks(R);
const D = M.length;
const nz = new Array(D).fill(0), rows = [];
let decisions = 0;
const champ = loadChamp(W, 'js/bundled-champion-3p.js', '');
const refP = champ ? Float64Array.from(champ) : null;
const sel = T.policyChooserN(refP, 0.15);
for (const shape of [{ n: 2, m: 'multi' }, { n: 5, m: 'multi' }, { n: 5, m: 'long' }, { n: 8, m: 'multi' }, { n: 10, m: 'multi' }]) {
  for (let g = 0; g < 3; g++) {
    const st = S.createState(shape.m, { next: rng }, shape.n);
    if (!st.rng) st.rng = { next: rng };
    const ch = [];
    for (let pid = 0; pid < shape.n; pid++) ch.push((s, p, legal) => {
      const aff = legal.filter((l) => l.affordable);
      const list = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
      const cs = P.candidatesFor(s, p, T.econBase(s, p, list), { lockTarget: false });
      if (p === 0 && cs.length > 1 && s.round >= 3 && decisions < 2000) {
        const v = obs3Encode(W, s, 0, cs[0]);
        if (v.length === D) { rows.push({ v, shape: shape.n + ':' + shape.m }); decisions++; for (let i = 0; i < D; i++) if (v[i] !== 0) nz[i]++; }
      }
      return sel(s, p, legal);
    });
    try { T.oneGameN2 ? T.oneGameN2(ch, g + 1, shape.n, { regen: 0, mode: shape.m }) : Play.autoGameN(st, ch); } catch (e) { console.log('  · 桌 ' + shape.n + ':' + shape.m + ' 抛：' + e.message.slice(0, 60)); }
  }
}
console.log('  抽样决策数=' + decisions + ' ‖ 维数=' + D);
const dead = [], tiny = [];
for (let i = 0; i < D; i++) {
  const vals = rows.map((r) => r.v[i]);
  const mean = vals.reduce((a, b) => a + b / vals.length, 0);
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, vals.length - 1));
  if (nz[i] === 0) dead.push(M[i].name);
  else if (sd < 1e-6) tiny.push(M[i].name);
}
console.log('  ⚠️ 恒零维（' + dead.length + '）：' + dead.join(' ‖ '));
console.log('  ⚠️ 有值但零方差（' + tiny.length + '）：' + tiny.join(' ‖ '));
/* 越界读数：>1 的维（归一化承诺） */
const over = {};
for (const r of rows) for (let i = 0; i < D; i++) if (r.v[i] > 1.0000001) { const b = M[i].block; over[b] = (over[b] || 0) + 1; }
console.log('  越过 1.0 的维按块统计：' + JSON.stringify(over));
