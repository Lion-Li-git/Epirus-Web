/* 只读探针 2（千问 10-30）：修掉 probe1 的抽样口径，并把两条疑点做成构造对照。
   A) 逐维可见性：用**固定打法**（每席只出一张指定卡）逼出持续状态，抽样时对**每一枚候选**编码
      ⇒ 区分"这一维引擎根本写不出来" vs "上一版是我的分母错了"
   B) 池化口径的构造对照：把网络配成"logit = 池化的 hp 均值"，与 obs3.encode 的 pool.mean.hp 并排读数 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install, layout } from '../tools/proto2/arch2.mjs';
import * as O3 from '../tools/proto2/obs3.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
const M = O3.blocks(R);
const D = M.length;

/* ---------- A. 固定打法逼出持续状态，逐候选抽样 ---------- */
function cancelOtherLocal(state, pid) {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) return e.pids[0] === pid ? e.pids[1] : e.pids[0];
  }
  return null;
}
function fixed(key) {
  return function (state, pid, legal) {
    const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || [];
    if (!cs.length) return { key: R.SK.JI };
    for (const c of cs) if (c.key === key) return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
    return cs[0];
  };
}
let seed = 20261030;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const nz = new Array(D).fill(0);
const rowsByBlock = {};
let decisions = 0, candEnc = 0;
const keysToForce = ['taunt', 'mine', 'rod', 'cannon', 'curse', 'firestorm', 'holo', 'proto', 'bagua', 'shift', 'armor', 'vampire', 'nightmare', 'revive', 'drain', 'mirror', 'dualGun', 'transfer', 'ring', 'charge', 'purify', 'bigT', 'miniT', 'laserEye', 'railgun', 'snipe', 'jinshield', 'guard', 'reflect', 'tank', 'gun', 'sword', 'ji'];
const shapes = [{ n: 2, m: 'multi' }, { n: 3, m: 'multi' }, { n: 5, m: 'multi' }, { n: 5, m: 'long' }, { n: 8, m: 'multi' }, { n: 10, m: 'multi' }];
for (const shape of shapes) {
  for (let g = 0; g < 6; g++) {
    const st = S.createState(shape.m, { next: rng }, shape.n);
    st.rng = { next: rng };
    const ch = [];
    for (let pid = 0; pid < shape.n; pid++) {
      const kA = keysToForce[(g * shape.n + pid) % keysToForce.length];
      const kB = keysToForce[(g * 7 + pid * 3 + 11) % keysToForce.length];
      const who = pid % 2 === 0 ? kA : kB;
      const sel = R.skills.some((s) => s.key === who) ? fixed(who) : fixed('ji');
      ch.push(function (s, p, legal) {
        const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: cancelOtherLocal(s, p) }) || [];
        if (cs.length > 1 && s.round >= 2 && candEnc < 40000) {
          for (const c of cs) {
            const v = O3.encode(W, s, p, c);
            candEnc++;
            for (let i = 0; i < D; i++) {
              if (v[i] !== 0) nz[i]++;
              const b = M[i].block;
              const set = rowsByBlock[b] || (rowsByBlock[b] = new Set());
              if (v[i] !== 0) set.add(M[i].name);
            }
          }
          decisions++;
        }
        return sel(s, p, legal);
      });
    }
    try { Play.autoGameN(st, ch); } catch (e) { console.log('  · 桌 ' + shape.n + ':' + shape.m + ' 抛：' + String(e.message).slice(0, 70)); }
  }
}
console.log('=== A. 逐候选可见性 ‖ 决策 ' + decisions + ' ‖ 候选编码 ' + candEnc + ' 次 ‖ 维数 ' + D + ' ===');
const dead = [];
for (let i = 0; i < D; i++) if (nz[i] === 0) dead.push({ name: M[i].name, block: M[i].block });
const rare = [];
for (let i = 0; i < D; i++) if (nz[i] > 0 && nz[i] / candEnc < 0.005) rare.push(M[i].name + ' ' + (100 * nz[i] / candEnc).toFixed(2) + '%');
console.log('恒零维 ' + dead.length + ' 个：');
const byB = {};
for (const d of dead) (byB[d.block] || (byB[d.block] = [])).push(d.name);
for (const b of Object.keys(byB)) console.log('  [' + b + '] ' + byB[b].join(' ‖ '));
console.log('稀有维（<0.5% 的候选非零）' + rare.length + ' 个：' + rare.slice(0, 30).join(' ‖ '));

/* ---------- B. 池化口径构造对照 ---------- */
console.log('\n=== B. 网络池化 vs obs3.encode 的 pool.mean.hp ===');
const cfg = { input: 'obs3', seatH: 16, actH: 8, hid: 32, hid2: 24, mutMode: 'seg' };
const A = install(W, cfg);
const L = A.L;
const p = new Float64Array(L.n);           // 全零 params
const sg = {}; for (const s of L.seg) sg[s.name] = s;
const seatW = (j, i) => sg.seatEnc.off + j * L.seatIn + i;
const ctxW = (j, i) => sg.ctx.off + j * L.ctxDim + i;
const candW = (j, i) => sg.cand.off + j * L.candIn + i;
p[seatW(0, 0)] = 1;                        // 席位隐元 0 = relu(hp 归一) ⇒ hp
p[ctxW(0, L.selfDim + 0)] = 1;             // ctx 隐元 0 = relu(mean[0])
p[candW(0, 0)] = 1;                        // cand 隐元 0 = relu(hctx[0])
p[sg.policyHead.off + 0] = 1;              // logit = hc0
const st = S.createState('multi', { next: rng }, 5);
st.rng = { next: rng };
st.p[0].hp = 1;                            // 自己 1 血
for (let i = 1; i < 5; i++) st.p[i].hp = 3; // 对手全 3 血
const cands = P.candidatesFor(st, 0, [{ key: R.SK.JI, affordable: true }], { lockTarget: false });
const f = P.forwardCands(st, 0, cands, p, { temp: 0.5 });
const enc = O3.encode(W, st, 0, cands[0]);
const iPool = M.findIndex((x) => x.name === 'pool.mean.hp');
const expNetAll = (1 / 3 + 4 * (3 / 3)) / 5;   // 全体（含自己）hp/modeHp 均值
const expEncOpp = (3 / 3 + 3 / 3 + 3 / 3 + 3 / 3) / 4; // 只算对手
console.log('  网络 logit（构造成"池化 hp"）= ' + Number(f.logits[0]).toFixed(4));
console.log('  obs3.encode 的 pool.mean.hp   = ' + enc[iPool].toFixed(4));
console.log('  理论值：全体含自己 = ' + expNetAll.toFixed(4) + ' ‖ 只算对手 = ' + expEncOpp.toFixed(4));
console.log('  ⇒ 网络那条路 ' + (Math.abs(f.logits[0] - expNetAll) < 1e-9 ? '**把自己也算进池化**' : '口径待判') +
    ' ‖ 平面向量 ' + (Math.abs(enc[iPool] - expEncOpp) < 1e-9 ? '**只算对手**' : '口径待判') +
    ' ‖ MANIFEST 把这一列命名为 pool.mean.hp（块 P.opp）');
/* 反向：把自己打死 ⇒ 网络的池化应当少一席；平面向量本来就不含自己 ⇒ 不动 */
st.p[0].hp = 0;
const f2 = P.forwardCands(st, 0, cands, p, { temp: 0.5 });
const enc2 = O3.encode(W, st, 0, cands[0]);
console.log('  自己 hp=0 之后：网络 logit ' + Number(f.logits[0]).toFixed(4) + ' → ' + Number(f2.logits[0]).toFixed(4) +
    '（4 席全 3 血 ⇒ 理论 1.0000） ‖ 平面向量 ' + enc[iPool].toFixed(4) + ' → ' + enc2[iPool].toFixed(4));
A.restore();

/* ---------- C. 顺手量：obs3 的维数与"候选侧占多少" ---------- */
const cnt = {};
for (const m of M) cnt[m.block] = (cnt[m.block] || 0) + 1;
console.log('\n=== C. 210 维按块 ===');
console.log('  ' + Object.keys(cnt).map((b) => b + '=' + cnt[b]).join(' ‖ '));
