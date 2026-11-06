/* 只读探针 3：把两处异常读数查到能点名，不解释成噪声。
   Q1 B 组那个 0.8333：把 seats 列表、每席 hp、分母逐个印出来
   Q2 珠子：pid0 强制蓄能，逐回合印 me.elec/me.boom/beadNew + obs3 ownElec 的读数 */
import { sandbox } from '../tools/audit-lib.mjs';
import { install } from '../tools/proto2/arch2.mjs';
import * as O3 from '../tools/proto2/obs3.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
let seed = 20261030;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const M = O3.blocks(R);

/* ---------- Q1 ---------- */
console.log('=== Q1 池化构造：把每一席的 hp 印出来 ===');
const cfg = { input: 'obs3', seatH: 16, actH: 8, hid: 32, hid2: 24, mutMode: 'seg' };
const A = install(W, cfg);
const L = A.L;
const sg = {}; for (const s of L.seg) sg[s.name] = s;
const mk = () => {
  const p = new Float64Array(L.n);
  p[sg.seatEnc.off + 0 * L.seatIn + 0] = 1;                 // e0 = relu(hp/modeHp)
  p[sg.ctx.off + 0 * L.ctxDim + (L.selfDim + 0)] = 1;       // hctx0 = relu(mean[0])
  p[sg.cand.off + 0 * L.candIn + 0] = 1;                    // hc0 = relu(hctx0)
  p[sg.policyHead.off + 0] = 1;                             // logit = hc0
  return p;
};
const p0 = mk();
const st = S.createState('multi', { next: rng }, 5);
st.rng = { next: rng };
st.p[0].hp = 1;
for (let i = 1; i < 5; i++) st.p[i].hp = 3;
console.log('  st.p.length=' + st.p.length + ' ‖ hp=[' + st.p.map((q) => q.hp).join(',') + '] ‖ mode.hp=' + (st.mode && st.mode.hp) + ' ‖ modeKey=' + (st.modeKey || '?'));
const sc = O3.scene(W, st, 0);
console.log('  sc.seats=' + sc.seats.length + ' ‖ 每席 [pid,isSelf,hp维]=' + sc.seats.map((s) => `[${s.id},${s.isSelf},${s.public[0].toFixed(3)}]`).join(''));
const manualAll = sc.seats.reduce((a, s) => a + s.public[0], 0) / sc.seats.length;
console.log('  手算：全体含自己均值=' + manualAll.toFixed(4));
const cands = P.candidatesFor(st, 0, [{ key: R.SK.JI, affordable: true }], { lockTarget: false });
const f = P.forwardCands(st, 0, cands, p0, { temp: 0.5 });
console.log('  网络 logit=' + Number(f.logits[0]).toFixed(4) + ' ‖ logits.length=' + f.logits.length);
/* 逐段确认哪一层被别的东西污染：直接把 xin 的 mean[0] 与 hctx[0] 取出来（重跑一遍前向的手工版） */
const encMap = new Map();
const eOf = (seatVec) => { let s = p0[sg.seatEnc.off + L.seatH * L.seatIn + 0]; for (let i = 0; i < L.seatIn; i++) s += p0[sg.seatEnc.off + 0 * L.seatIn + i] * seatVec[i]; return s > 0 ? s : 0; };
const eArr = sc.seats.map((s) => { const v = new Float64Array(L.seatIn); for (let j = 0; j < 22; j++) v[j] = s.public[j]; for (let j = 0; j < 5; j++) v[22 + j] = s.rel[j]; v[27] = s.isSelf; return eOf(v); });
console.log('  手工：每席 e0=[' + eArr.map((x) => x.toFixed(3)).join(',') + '] ‖ mean over seats=' + (eArr.reduce((a, b) => a + b, 0) / eArr.length).toFixed(4));
/* 那 48 维序列块里，seq 的最后一维（seq3.out.none）会不会正好落在 xin[57] 之后？—— 检查 selfDim 的构成 */
console.log('  L.selfDim=' + L.selfDim + ' ‖ L.ctxDim=' + L.ctxDim + ' ‖ g+priv+seq+sums=' + (sc.g.length + sc.priv.length + sc.seq.length + sc.sums.length));
const xinCheck = [...sc.g, ...sc.priv, ...sc.seq, ...sc.sums];
console.log('  xin[57] 若按手工拼装 = ' + (xinCheck[57] === undefined ? 'undefined（57 就是 mean[0] 的位置）' : xinCheck[57]) + ' ‖ 手工长度=' + xinCheck.length);
A.restore();

/* ---------- Q2 珠子生命周期 ---------- */
console.log('\n=== Q2 蓄能 → 珠子在决策时刻看得见吗 ===');
function cancelOtherLocal(state, pid) {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) return e.pids[0] === pid ? e.pids[1] : e.pids[0];
  }
  return null;
}
const fixed = (key) => function (state, pid, legal) {
  const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || [];
  if (!cs.length) return { key: R.SK.JI };
  for (const c of cs) if (c.key === key) return { key: c.key, target: c.target == null ? null : c.target, bead: c.bead || null };
  const ji = cs.filter((c) => c.key === R.SK.JI)[0]; return ji ? { key: ji.key } : cs[0];
};
const st2 = S.createState('multi', { next: rng }, 3);
st2.rng = { next: rng };
const seen = [];
const ch2 = [];
for (let pid = 0; pid < 3; pid++) {
  const who = pid === 0 ? fixed('charge') : (pid === 1 ? fixed('ji') : fixed(R.SK.RAILGUN || 'railgun'));
  ch2.push((s, p, legal) => {
    if (p === 0) {
      const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: cancelOtherLocal(s, p) }) || [];
      const own = O3.scene(W, s, 0);
      seen.push({ round: s.round, ep: s.p[0].ep, elec: s.p[0].elec, boom: s.p[0].boom, beadNew: s.p[0].beadNew, ownElecDim: obs3own(own), chargeCands: cs.filter((c) => c.key === 'charge').length, railgunC: cs.filter((c) => c.key === 'railgun').length });
    }
    return who(s, p, legal);
  });
}
function obs3own(own) { const v = O3.encode(W, st2, 0, { key: R.SK.JI, target: null, bead: null }); const i = M.findIndex((x) => x.name === 'ownElec'); return v[i]; }
Play.autoGameN(st2, ch2);
console.log('  pid0 每回合首决策：round/ep/elec/boom/beadNew/ownElec维/蓄能候选/电磁炮候选');
for (const r of seen.slice(0, 14)) console.log(`   r${r.round} ep=${r.ep} elec=${r.elec} boom=${r.boom} beadNew=${JSON.stringify(r.beadNew)} ownElec=${r.ownElecDim} chargeC=${r.chargeCands} railgunC=${r.railgunC}`);
console.log('  抽样决策 ' + seen.length + ' 次 ‖ 其中 elec>0 的：' + seen.filter((x) => x.elec > 0).length + ' ‖ ownElec>0：' + seen.filter((x) => x.ownElecDim > 0).length);
/* v7 那一面对同一件事的读数 */
const i7 = (() => { const fs = P.features(st2, 0, P.FEAT_S); const nzIdx = []; for (let i = 0; i < fs.length; i++) if (fs[i] !== 0) nzIdx.push(i); return nzIdx; })();
console.log('  v7 特征非零下标（前 30）：' + i7.slice(0, 30).join(','));
