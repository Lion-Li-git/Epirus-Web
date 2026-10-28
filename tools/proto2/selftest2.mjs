#!/usr/bin/env node
/* §E821 · 2.0 原型的**自证**（研究分支，10-28 傍晚）
 * 规矩（在册）：一把新量具/一个新结构必须**能失败**，而且要有"已知答案的构造对照"。
 * 六条腿，任何一条不过 ⇒ exit 8（不允许"跑了没红"当成通过）。
 *   T1 形状自洽：paramCount === Σ 段长；pack/unpack 逐位往返。
 *   T2 **偏移不是猜的**：把两个对手的血互换 ⇒ 特征里那两段 10 维对手块必须跟着换（证明我切的 OPP 偏移真的是"槽位=血量升序"）。
 *   T3 **死席不进集合**：把某对手 hp 设成 0 但其余字段填**垃圾** ⇒ 打分必须与"该对手字段全 0"逐位相同
 *      （v7 是按槽补零，这条对它是绿的；对 2.0 它是"集合编码"的定义性判据 —— 一旦我把死席漏进池化就当场红）。
 *   T4 **Q(s) 头不参与组内排序**：把 qHead 整段灌大随机数 ⇒ logits/argmax 必须逐位不变（两头分离是结构承诺，不是措辞）。
 *   T5 确定性：同一份 params 同一份局面跑两遍 ⇒ 逐位相同。
 *   T6 牙（非恒真）：动 `cand` 段一个权重 ⇒ logits 必须变；全零 params ⇒ logits 必须全等（退化基线）。
 */
import { sandbox } from '../audit-lib.mjs';
import { install, layout, paramCount, make } from './arch2.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer;
const R = W.EpirusRules;

const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const cfg = { seatH: Number(arg('seatH', 16)), actH: Number(arg('actH', 8)), hid: Number(arg('hid', 32)), hid2: Number(arg('hid2', 24)) };

const fails = [];
let done = 0;
const ok = (cond, msg) => { done++; console.log((cond ? '  ✔ ' : '  ✖ ') + msg); if (!cond) fails.push(msg); };

let seed = 12345;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const A2 = install(W, Object.assign({}, cfg, { mutMode: 'seg' }));
const L = A2.L;

/* ---- 造一个"有决策可做"的局面：跑一局到第 1 个焦点席决策点就停 ---- */
function mkState(n) {
  const st = S.createState('multi', { next: rng }, n);
  st.rng = { next: rng };
  return st;
}
function decision(n) {
  const st = mkState(n);
  const legal = Play.legalActions(st, 0);
  const base = legal.filter(l => l.affordable);
  const list = base.length ? base : [{ key: R.SK.JI, affordable: true }];
  const cands = P.candidatesFor(st, 0, T.econBase ? T.econBase(st, 0, list) : list, { lockTarget: false });
  return { st, cands };
}
const D = decision(5);
if (!D.cands || D.cands.length < 2) { console.error('⛔ 造不出候选集（拿到 ' + (D.cands ? D.cands.length : 0) + ' 个）—— 先修夹具，别改判据'); process.exit(2); }
console.log('# §E821 2.0 原型自证 ‖ 结构 S1 ' + JSON.stringify(cfg) + ' ‖ paramCount=' + paramCount(L) + ' ‖ 候选 ' + D.cands.length + ' 个');

const p1 = make(L, rng, 0.25);
const score = (st, cands, params) => P.forwardCands(st, 0, cands, params, { greedy: true, temp: 0.5 });

/* ---- T1 ---- */
const sum = L.seg.reduce((a, s) => a + s.len, 0);
ok(sum === L.n && L.n === P.paramCount(), 'T1 形状自洽：Σ 段长 ' + sum + ' === n ' + L.n + ' === P.paramCount()');
const rt = P.unpack(P.pack(p1));
let bitSame = !!rt && rt.length === p1.length;
if (bitSame) for (let i = 0; i < p1.length; i++) if (rt[i] !== p1[i]) { bitSame = false; break; }
ok(bitSame, 'T1 pack/unpack 逐位往返（容器显式带 arch+dims ⇒ 不再从长度反推形状）');

/* ---- T2：OPP 块偏移 ---- */
{
  const st = mkState(5);
  for (let i = 1; i < 5; i++) { st.p[i].hp = 30 + i; st.p[i].ep = i; }          // 让槽序有唯一解
  const fsA = P.features(st, 0, P.FEAT_S);
  const slotPids = P.oppSlots(st, 0);
  const off = 63 + 0 * 10;                                                       // 槽 1 的那 10 维
  const hpFirst = fsA[off + 1];                                                  // 该块第 2 维 = op.hp / hp
  const expect = st.p[slotPids[0]].hp / st.mode.hp;
  ok(Math.abs(hpFirst - expect) < 1e-12, 'T2 偏移对得上：槽 1 的 10 维块第 2 维 = ' + hpFirst.toFixed(4) + ' === state.p[' + slotPids[0] + '].hp/hp = ' + expect.toFixed(4));
  st.p[slotPids[0]].hp = 1;                                                       // 改这一个人 ⇒ 这块必须跟着变
  const fsB = P.features(st, 0, P.FEAT_S);
  ok(Math.abs(fsB[off + 1] - 1 / st.mode.hp) < 1e-12 && fsB[off + 1] !== hpFirst, 'T2 反向：改血之后那一位真的挪了（不是常量）');
}

/* ---- T3：死席不进池化 ---- */
{
  const st0 = mkState(5);
  const victim = st0.p.length - 1;
  const cands0 = P.candidatesFor(st0, 0, T.econBase(st0, 0, Play.legalActions(st0, 0)), { lockTarget: false });
  st0.p[victim].hp = 0;
  const fDead = P.forwardCands(st0, 0, cands0, p1, { temp: 0.5 });
  const logitsDead = Array.from(fDead.logits).join(',');
  for (let i = 0; i < 40; i++) st0.p[victim].guardNext = true, st0.p[victim].ep = 12, st0.p[victim].copiedGuard = i % 3 ? 'gun' : null, st0.p[victim].stickers = ['x'];
  const fGarbage = P.forwardCands(st0, 0, cands0, p1, { temp: 0.5 });
  ok(Array.from(fGarbage.logits).join(',') === logitsDead, 'T3 死席（hp=0）填垃圾字段 ⇒ 打分逐位不变 ⇒ **确实没进集合**');
  st0.p[victim].hp = 20;
  const fAlive = P.forwardCands(st0, 0, cands0, p1, { temp: 0.5 });
  ok(Array.from(fAlive.logits).join(',') !== logitsDead, 'T3 反向：把同一位复活 ⇒ 打分必须变（否则 T3 是恒真）');
}

/* ---- T4：Q(s) 不参与排序 ---- */
{
  const before = P.forwardCands(D.st, 0, D.cands, p1, { temp: 0.5 });
  const q = L.seg[5];
  for (let i = q.off; i < q.off + q.len; i++) p1[i] = (rng() - 0.5) * 1000;
  const after = P.forwardCands(D.st, 0, D.cands, p1, { temp: 0.5 });
  const sameLogits = Array.from(before.logits).join(',') === Array.from(after.logits).join(',');
  ok(sameLogits, 'T4 qHead 灌 ±500 ⇒ logits/argmax 逐位不变（argmax ' + before.argmax + ' → ' + after.argmax + '）');
  ok(after.q !== before.q, 'T4 反向：同一处扰动确实改了 Q(s)（' + before.q.toFixed(3) + ' → ' + after.q.toFixed(3) + '）⇒ 不是"那段根本没被读"');
}

/* ---- T5：确定性 ---- */
{
  const a = P.forwardCands(D.st, 0, D.cands, p1, { temp: 0.5 });
  const b = P.forwardCands(D.st, 0, D.cands, p1, { temp: 0.5 });
  ok(Array.from(a.logits).join(',') === Array.from(b.logits).join(','), 'T5 同 params 同局面跑两遍 ⇒ 逐位相同');
}

/* ---- T7：2.0 能打完一整局（并且走的就是引擎的决策口径）+ 顺手取一个**中局夹具** ----
 * 为什么要中局夹具：T6c 第一次跑红在这条上 —— 开局那一步 213 维里只有 16 维非零、候选只有 4 个
 *   ⇒ "动一个权重"落在恒零输入上，输出必然不动。那测的是夹具的稀疏度，不是结构的接线的。
 *   取"回合 ≥4 的第一个决策"存快照（`cloneState` 后把 rng 换成独立流，免得抽走母局的随机数 —— 在册条款）。 */
let MID = null;
{
  const st = mkState(5);
  const ch = [];
  for (let i = 0; i < 5; i++) ch.push(function (s, pid, legal) {
    const aff = legal.filter(l => l.affordable);
    const list = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    const cs = P.candidatesFor(s, pid, list, { lockTarget: false });
    if (!MID && s.round >= 4 && pid === 0 && cs.length >= 3) {
      const q = S.cloneState(s);
      q.rng = { next: rng };
      MID = { st: q, cands: P.candidatesFor(q, pid, list, { lockTarget: false }) };
    }
    return P.chooseCandidates(s, pid, cs, p1, { temp: 0.5 });
  });
  let over = false, err = '';
  try { Play.autoGameN(st, ch); over = !!st.over; } catch (e) { err = String(e && e.message || e); }
  ok(over, 'T7 五个座位全用 2.0 打分器打完一局 ⇒ over=true' + (err ? '（抛错：' + err + '）' : '') +
    ' ‖ 回合 ' + st.round + ' ‖ 存活 ' + st.p.filter(x => x.hp > 0).length);
  ok(!!MID, 'T7b 中局夹具取到了吗：' + (MID ? '回合 ' + MID.st.round + ' ‖ 候选 ' + MID.cands.length : '**没取到**'));
}

/* ---- T6：非退化 + 灵敏度 + 局部性（夹具优先用中局快照） ---- */
{
  const FX = MID || D;
  const c = P.forwardCands(FX.st, 0, FX.cands, p1, { temp: 0.5 });
  const nz = FX.st ? P.features(FX.st, 0, P.FEAT_S).filter(x => x !== 0).length : 0;
  console.log('  · 夹具：候选 ' + FX.cands.length + ' 个 ‖ 特征非零 ' + nz + '/213 ‖ logits 相异度 ' + new Set(Array.from(c.logits)).size);
  ok(new Set(Array.from(c.logits)).size > 1, 'T6a 非退化：随机 params 下 logits **不全等** ⇒ 动作特征真的走到了输出');
  const s2 = p1.slice(); for (let i = 0; i < s2.length; i++) s2[i] *= 2;
  const d2 = P.forwardCands(FX.st, 0, FX.cands, s2, { temp: 0.5 });
  ok(Array.from(c.logits).join(',') !== Array.from(d2.logits).join(','), 'T6b 灵敏度：整体 ×2 ⇒ logits 变');
  /* 局部性：单点扰动可能被死 ReLU/恒零输入吃掉 ⇒ 判据是"抽若干权重，**至少一个**能动输出"，
   *   并把这个比例当"隐元利用率"的一个读数印出来（§E815 那条在新结构上的对应物）。 */
  const seg3 = L.seg[3];
  let touched = 0, probed = 0;
  for (let i = seg3.off; i < seg3.off + seg3.len; i += 31) {
    const keep = p1[i]; p1[i] += 5; probed++;
    const d3 = P.forwardCands(FX.st, 0, FX.cands, p1, { temp: 0.5 });
    if (Array.from(d3.logits).join(',') !== Array.from(c.logits).join(',')) touched++;
    p1[i] = keep;
  }
  ok(touched > 0, 'T6c 局部性：cand 段抽 ' + probed + ' 个权重各 +5 ⇒ ' + touched + ' 个能动输出（一个都不能动 = 那段没接上）');
  const z = new Float64Array(L.n);
  const f0 = P.forwardCands(FX.st, 0, FX.cands, z, { temp: 0.5 });
  ok(Array.from(f0.logits).every(v => v === 0), 'T6d 退化基线：全零 params ⇒ logits 全为 0（与 T6a 合起来才说明 logits 是算出来的）');
}

/* ---- T8：**布局不变量自己有没有牙**（10-28 傍晚那次 1584 列死权重事故的守卫）----
 * 判据形状照"摘腿后变异"：把声明宽度故意改大 1 列 ⇒ `forwardCands` 必须抛；改回来 ⇒ 必须不抛。
 * 只验"现在没抛"是不够的 —— 那与"这条检查根本没接上"同形。 */
{
  const FX = MID || D;
  let threw = false, msg = '';
  const realIn = L.candIn;
  try { L.candIn = realIn + 1; P.forwardCands(FX.st, 0, FX.cands, p1, { temp: 0.5 }); } catch (e) { threw = true; msg = String(e && e.message || e); }
  L.candIn = realIn;
  ok(threw && /死权重/.test(msg), 'T8a 牙：把 candIn 改大 1 列 ⇒ 必须抛（实测 ' + (threw ? '抛了：' + msg.slice(0, 40) + '…' : '**没抛 ⇒ 这条守卫是摆设**') + '）');
  let clean = true;
  try { P.forwardCands(FX.st, 0, FX.cands, p1, { temp: 0.5 }); } catch (e) { clean = false; }
  ok(clean, 'T8b 正常形状下不抛（声明宽度 === 真拼进去的宽度）');
  console.log('  · 现在的形状：paramCount=' + L.n + ' ‖ 段 ' + L.seg.map(function (s) { return s.name + '(' + s.len + ')'; }).join(' ‖ '));
}

console.log(fails.length ? '\n⛔ 自证未过 ' + fails.length + ' 条 ⇒ 结构不进下一环' : '\n⇒ ' + done + ' 条自证全过：2.0 原型可以进训练环');
process.exit(fails.length ? 8 : 0);
