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
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install, layout, paramCount, make, verifyWired } from './arch2.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer;
const R = W.EpirusRules;
/* ⚑ T14 要的参照包：**装任何档之前**读（装完之后 `unpack` 只认 v:90 ⇒ 会读成 null） */
const REF_V7 = (() => { const o = loadChamp(W, 'js/bundled-champion-3p.js', ''); return o ? Float64Array.from(o) : null; })();

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

/* ---- T9：**接线自证**（10-28 晚三波读数作废换来的这一条必须常驻）----
 * 只验"装上了、跑着没崩"是不够的：作废的那几波全都"没崩"。真凭据是训练环里 **2.0 的 forwardCands 被叫到**。 */
{
  let out = null, err = null;
  try { out = verifyWired(W, A2, { mode: 'long', n: 5, games: 1 }); } catch (e) { err = String(e && e.message || e); }
  ok(!!out && out.forwards > 0 && out.chooseCandidatesCalls > 0,
    'T9 接线：打一局 ⇒ forwardCands ' + (out ? out.forwards : 'n/a') + ' 次 ‖ 2.0 版 chooseCandidates ' + (out ? out.chooseCandidatesCalls : 'n/a') + ' 次' +
    (err ? '（抛：' + err.slice(0, 70) + '）' : '') + ' ⇒ 训练环真走在 2.0 上（此前这里是 **0 次**，而 fit 照样出数）');
  const modeNow = T.trainMode ? T.trainMode() : null;
  ok(modeNow === 'multi', 'T9b 接线自证**没把桌形改走**（用完还原 ⇒ 现在 ' + modeNow + '）');
}

/* ---- T10/T11/T12（10-29 夜加）：obs3 输入面、S1o 接线、以及**相对步长**的两侧对账 ----
 * 加这三条的动因：obs3 与 arch2 是两个文件，宽度各写一遍就会**静默错位**（1584 死权重那一族的跨文件版本）；
 *   而 mutRel 这条如果只测"新口径有界"，就看不出我是不是顺手把旧口径也改了 ⇒ 旧病理必须仍然在，才算没偷改。 */
const O3 = await import('./obs3.mjs');
{
  const FX = MID || D;
  const Lo = layout(Object.assign({ input: 'obs3', skills: R.skills.length }, cfg));
  const enc = O3.encode(W, FX.st, 0 /* 焦点席 */, FX.cands[0]);
  const sc = O3.scene(W, FX.st, 0 /* 焦点席 */), cp = O3.candOf(sc, FX.cands[0]);
  ok(enc.length === O3.blocks(R).length, 'T10a obs3：encode 长度 === MANIFEST（' + enc.length + ' ‖ dims()=' + O3.dims(R) + '）');
  ok(cp.base.length + cp.idOne.length === Lo.actIn, 'T10b 跨文件对账：obs3 的 base+身份(' + cp.base.length + '+' + cp.idOne.length + ') === S1o.actIn(' + Lo.actIn + ')');
  ok(sc.seats[0].public.length + 6 === Lo.seatIn, 'T10c 跨文件对账：obs3 逐席(22+5关系+isSelf) === S1o.seatIn(' + Lo.seatIn + ')');
  const sp = sc.g.length + sc.priv.length + sc.seq.length + sc.sums.length;
  ok(sp === Lo.selfDim, 'T10d 跨文件对账：obs3 局面侧(5+2+48+2=' + sp + ') === S1o.selfDim(' + Lo.selfDim + ')');
}
{
  /* T11：S1o 装进真训练环打一局 ⇒ 前向被叫到；同 params 跑两遍 ⇒ 逐位相同 */
  const A2o = install(W, Object.assign({ input: 'obs3', mutMode: 'seg' }, cfg));
  A2o.rngRef.r = rng;
  const Lo = A2o.L || layout(Object.assign({ input: 'obs3', skills: R.skills.length }, cfg));
  let wired = null, err = '';
  try { wired = verifyWired(W, A2o, { mode: 'multi', n: 5, games: 1 }); } catch (e) { err = String(e && e.message || e); }
  ok(!!(wired && wired.forwards > 0 && wired.chooseCandidatesCalls > 0) && P.paramCount() === Lo.n,
    'T11a S1o 接线：paramCount=' + P.paramCount() + ' ‖ 打一局 forwardCands ' + (wired ? wired.forwards : 0) + ' 次 ‖ chooseCandidates ' + (wired ? wired.chooseCandidatesCalls : 0) + ' 次' + (err ? ' ‖ 抛了：' + err : ''));
  const FX = MID || D;
  const pp = P.makePolicy(0.25);
  const a1 = P.forwardCands(FX.st, 0 /* 焦点席 */, FX.cands, pp, { temp: 0.5 });
  const a2 = P.forwardCands(FX.st, 0 /* 焦点席 */, FX.cands, pp, { temp: 0.5 });
  ok(Array.from(a1.logits).join(',') === Array.from(a2.logits).join(','), 'T11b S1o 确定性：同 params 同局面跑两遍 ⇒ 逐位相同');
  /* T13：容器的 arch 标签必须由**实际布局**写 —— 硬写 'S1' 那版会把 5650 条的 S1o 包打成 S1，
   *   下游按 arch 选输入面的尺（profile2）就拿错脸读。判"消费者真读得到"：两侧各打一次包再回读。 */
  const pkO = P.pack(P.makePolicy(0.25));
  ok(pkO.arch === 'S1o', 'T13a S1o 打包标签 = ' + pkO.arch + '（' + pkO.a.length + ' 条 ‖ input=' + (pkO.dims && pkO.dims.input) + '）');
  /* T14：**装档不许把 v7 的包接走**（10-29 03:0x 确诊的大修）。`shapeOf(v7)` 是 `{v:7, legacy:false}` ⇒
   *   `evo.js:21` 的 LEGACY 判 false ⇒ 选择器走现代分支 = `P.chooseCandidates/forwardCands`；
   *   那两个入口一旦被 2.0 覆盖而**没有长度守卫**，v7 的 5689 条权重就会按 5258/5650 的偏移被切着打
   *   （实测 3 局 v7 自对局打了 423 次 2.0 forward ⇒ profile2 的参照行、整张对手表、probe-cem-arm 的 FIX_OPPS 全被污染）。
   *   ⇒ 这条腿判的就是"守卫还在不在"：拿 v7 打一局，2.0 的计数器必须**一次都不涨**。摘掉守卫它就红。 */
  {
    const A7 = install(W, Object.assign({ mutMode: 'seg' }, cfg));
    A7.rngRef.r = rng;
    const refParams = REF_V7;
    const f0 = A7.CNT.forwards, c0 = A7.CNT.cands;
    let routeErr = '';
    if (refParams && refParams.length !== A7.L.n) {
      try {
        const sel = T.policyChooserN(refParams, 0.001);
        const cs = []; for (let pid = 0; pid < 3; pid++) cs.push(sel);
        T.oneGameN(cs, 555, 3, { regen: 0, mode: 'multi' });
      } catch (e) { routeErr = String(e && e.message || e); }
      const df = A7.CNT.forwards - f0, dc = A7.CNT.cands - c0;
      ok(df === 0 && dc === 0 && !routeErr, 'T14 v7 不被接走：打一局 2.0 forwardCands 涨 ' + df + ' ‖ 候选打分涨 ' + dc + (routeErr ? ' ‖ 抛了：' + routeErr : ''));
    } else {
      ok(false, 'T14 v7 不被接走：没拿到参照包（长度 ' + (refParams && refParams.length) + ' ‖ 本档要 ' + A7.L.n + '）⇒ 这条腿没跑成，不许当过');
    }
    A7.restore();
  }
  const backO = P.unpack(pkO);
  ok(!!backO && backO.length === Lo.n, 'T13b S1o 同档回读成功（' + (backO ? backO.length : 0) + '）‖ checkPack=' + JSON.stringify(P.checkPack(pkO)));
  /* 真包的跨档读会被**长度**先挡住（5650≠5258）⇒ 那证不到 arch 这条腿。这里造一枚"长度刚好骗过长度检查、
   *   但 arch 标错"的构造样本（现在两档长度不同所以盘上不会出现，可这正是要防的潜在形状：以后调 seatH 就可能撞等长）。 */
  const wrongTag = (() => {
    const A1 = install(W, Object.assign({ mutMode: 'seg' }, cfg)); A1.rngRef.r = rng;
    const fake = { v: 90, arch: 'S1o', dims: { seatH: A1.L.seatH, actH: A1.L.actH, hid: A1.L.hid, hid2: A1.L.hid2 }, a: new Array(A1.L.n).fill(0), n: A1.L.n };
    const r = P.checkPack(fake); const rr = P.unpack(fake); A1.restore(); return { r, rr };
  })();
  ok(wrongTag.r.ok === false && wrongTag.r.reason === 'arch' && wrongTag.rr === null,
    'T13c 跨档拒读（构造样本：长度合、arch 标反）⇒ checkPack=' + JSON.stringify(wrongTag.r) + ' ‖ unpack=' + wrongTag.rr + '（宁可读不出，不许静默错切）');
  A2o.restore();
}
{
  /* T12：mutRel 的两侧对账 —— 新口径有界，旧口径的病理**必须仍然存在** */
  const Ld = layout(cfg), Lo = layout(Object.assign({ input: 'obs3', skills: R.skills.length }, cfg));
  const worstOf = (segL, rel) => {
    const A = install(W, Object.assign({ mutMode: 'seg', mutRel: rel ? 1 : 0, input: segL.input }, cfg));
    A.rngRef.r = rng;
    const p = P.makePolicy(0.25), q = P.mutatePolicy(p, 0.2);
    if (q.length !== p.length || p.length !== segL.n) { A.restore(); return NaN; }   // 几何必须与量的那块一致，否则是比错段
    let w = 0;
    for (const s of segL.seg) {
      const std = segL.initScale / Math.sqrt(Math.max(1, segL.fanIn[s.name]));
      for (let i = s.off; i < s.off + s.len; i++) w = Math.max(w, Math.abs(q[i] - p[i]) / std);
    }
    A.restore();
    return w;
  };
  const wRel = worstOf(Lo, 1), wOld = worstOf(Ld, 0);
  ok(wRel < 14, 'T12a mutRel：最坏坐标 |Δ| = ' + wRel.toFixed(1) + '× 自身 init 尺度（σ=0.2，高斯尾部 ⇒ 该有界）');
  ok(wOld > 14, 'T12b 旧口径的病理仍在：最坏 |Δ| = ' + wOld.toFixed(1) + '×（偏置段拿原 σ）⇒ 我没有偷偷改掉以前 12 臂的口径');
  console.log('  · 两边实测：mutRel 最坏 ' + wRel.toFixed(1) + '× ‖ 旧口径最坏 ' + wOld.toFixed(1) + '×（S1 旧口径平均 |Δ| 0.0216 / S1o 相对口径 0.0048 见台账）');
}

{
  /* T15（10-29 03:4x · #142 续 · §E824 那条形参错位欠下的腿）：**标签面候选集必须与比赛面同形**。
   *   那条病坏的时候**一片绿灯**：`P.value` 第 5 形参被塞进珠类型 ⇒ 蓄能两枚拿 `sh='elec'` ⇒ 宽度 undefined ⇒ 分数 NaN
   *   ⇒ 被紧随其后的 `Number.isFinite` **静默丢掉** ⇒ 每组少一整族动作，而比赛时那一族照旧在候选表上。
   *   没有任何一条既有读数会因此变红 ⇒ 只能靠一条"两面同形"的断言钉住。
   *   按"可以加，但尽量少加"的上限句，**一条腿判三件事**：
   *     ① 正确调用下每一枚候选的 v7 分都**有限**（没有候选被静默丢掉）；
   *     ② 名单里**真的有蓄能那两枚珠候选**（`ep≥2` ⇒ `charge/elec`、`charge/boom` 在场 ⇒ 分母不是自己缩出来的）；
   *     ③ **把 bead 塞进形状位这一变异必须当场变 NaN**（摘腿后变异：不验这条，① 就是恒真的装饰）。 */
  const st15 = mkState(5);
  st15.p[0].ep = 6;                                     /* 蓄能被菜单闸门留着（`evo.js:501` 的 ①"ep<2 不蓄能"）*/
  const c15 = P.candidatesFor(st15, 0, T.econBase(st15, 0, Play.legalActions(st15, 0)), { lockTarget: false });
  const beadC = c15.filter((c) => c.key === (R.SK && R.SK.CHARGE ? R.SK.CHARGE : 'charge'));
  let dropped = 0;
  for (const c of c15) if (!Number.isFinite(P.value(st15, 0, c.key, REF_V7, null, c))) dropped++;
  const mutated = beadC.filter((c) => !Number.isFinite(P.value(st15, 0, c.key, REF_V7, c.bead || null, c))).length;
  ok(!!REF_V7 && dropped === 0 && beadC.length === 2 && mutated === beadC.length,
    'T15 标签面==比赛面：候选 ' + c15.length + ' 枚 ‖ 正确调用下被静默丢掉 ' + dropped + ' 枚 ‖ 蓄能珠候选在场 ' + beadC.length + '/2 ‖ 变异（bead 塞形状位）变 NaN ' + mutated + '/' + beadC.length + ' ⇒ 两面同形且这条腿有牙');
}

console.log(fails.length ? '\n⛔ 自证未过 ' + fails.length + ' 条 ⇒ 结构不进下一环' : '\n⇒ ' + done + ' 条自证全过：2.0 原型可以进训练环');
process.exit(fails.length ? 8 : 0);
