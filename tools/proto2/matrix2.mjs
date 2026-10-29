#!/usr/bin/env node
/* matrix2.mjs — 2.0 包的**桌形覆盖矩阵**尺（人数 × 血量），千问 · 10-29 14:2x ‖ 任务 #148
 *
 * 为什么必须有它：2.0 的承诺是"一包跨 2–10 人与不同血量"，而**今夜之前它只在
 *   `multi`(hp=3) × n∈{3,5} 这一种桌形上被量过**（`tools/proto2/profile2.mjs` 的 CELLS 写死两档）。
 *   ⇒ 承诺的那一半从来没被读过 ⇒ 这把尺只读那一半。
 *
 * 三行 + 一列，每格都跑：
 *   ① `2.0包` = 装档后走引擎 chooser（与 profile2 同一条执行路，temp 一起传）
 *   ② `随机起点` = 同结构、定标种子造的粒（"这格能不能读出来"的下限对照）
 *   ③ `桌形地板` = **被测席由本格那型脚本 bot 自己打** ⇒ 全程不叫 2.0 前向（用 `CNT.forwards` 增量自证这一点）
 *      ⇒ 它量的是"这桌形本身多难"，不是任何包的强弱 ⇒ ①② 的读数要对着它看，不对着 v7 看（10-29 用户裁：不再研究 v7）
 *   ④ **弱检验（拨血量）**：同一批候选、同一个局面，把第 s 席的 hp 拨成 0 / +10 ⇒ 看候选打分动不动
 *      ⚠ 只动 hp 不动候选表 ⇒ 两次打分对的是**同一批下标**，Δ 才有意义
 *   ⑤ **强检验（换席 swap）**：把第 s 席与另一席的 hp **互换** ⇒ 所有聚合量（min/sum/计数/均值）逐字不变
 *      ⇒ 只有"真把那一席当个体读"才会让 logits 动。**判"逐席可见"只认这一列**
 *      ⚑ 这一条是 14:3x 现形的：第一版只有 ④，S1 与 S1o 都报"每一席都动"，因为 ④ 分不清"个体通道"与"聚合通道"
 *         ⇒ 与在册那条"分层读数的自检要能碰到那一格"同族：**尺的判据必须落在你想判的那一格上**
 *
 * 三条口径声明（别把这里的数往别处引）：
 *   · 这里的格**不进阶梯**（锚的 `cells` 只含 n∈{3,5} 的 multi 桌 ⇒ profile2 那行会自动判"锚过期、不印名次"）
 *   · 每格局数缺省 20，n 大时**每局决策数线性涨** ⇒ 打印总耗时与总局数，读数带剂量
 *   · 血量档来自 `R.MODES`（`multi` hp3 ‖ `multi4` hp4 ‖ `long` hp5）——不自己编第二套血量参数
 *
 * 用法：node tools/proto2/matrix2.mjs --pack=scratch/arms/N2-fx-S1o.bak [--ns=2,3,4,5,6,8] [--modes=multi,multi4,long]
 *        [--styles=wall,aggro] [--games=20] [--temp=0.6] [--perturb=dead,rich,swap]
 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp, buildPoolSeeded, poolFingerprint } from '../audit-lib.mjs';
import { install as installArch2 } from './arch2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', '');
if (!PACK) { console.error('⛔ 需要 --pack=<2.0 的 .bak>'); process.exit(2); }
const GAMES = Math.max(4, Number(arg('games', 20)) || 20);
const TEMP = Number(arg('temp', 0.6));
const NS = String(arg('ns', '2,3,4,5,6,8')).split(',').map(Number).filter((x) => Number.isFinite(x) && x >= 2);
const MODES = String(arg('modes', 'multi,multi4,long')).split(',').filter(Boolean);
const STYLES_WANT = String(arg('styles', 'wall,aggro')).split(',').filter(Boolean);
const PERTURB = String(arg('perturb', 'dead,rich,swap')).split(',').filter(Boolean);
if (!NS.length || !MODES.length || !STYLES_WANT.length) { console.error('⛔ --ns/--modes/--styles 里一个合法值都没有 ⇒ 没桌可跑，不许出"全过"'); process.exit(2); }

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
/* 血量档必须真在 `R.MODES` 里：拼错的模式名会静默退回 MODE_DEFAULT（standard），那读的就不是 4 血而是 3 血 */
const badMode = MODES.filter((m) => !R.MODES[m]);
if (badMode.length) { console.error('⛔ 模式名不在 `R.MODES` 里：' + badMode.join(',') + '（可用：' + Object.keys(R.MODES).join(',') + '）⇒ 不许静默退回默认档'); process.exit(2); }

const raw = JSON.parse(readFileSync(PACK, 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
if (raw.v !== 90) { console.error('⛔ 这不是 2.0 容器（v=' + raw.v + '）'); process.exit(2); }
const archTag = raw.arch || 'S1';
const cfg = { mutMode: 'seg', ...(raw.dims || {}) };
if (archTag === 'S1o') cfg.input = 'obs3';

/* 参照包只用来**造对手表**（与 profile2/ladder 同源同种子 ⇒ 同一张桌），不参与任何判语 */
const refSrc = arg('ref', 'js/bundled-champion-3p.js');
let refParams = loadChamp(W, refSrc, '');
if (!refParams) { console.error('⛔ 参照包读不出（' + refSrc + '）⇒ 对手表无法固定'); process.exit(2); }
refParams = Float64Array.from(refParams);
const POOL = buildPoolSeeded(T, refParams, 20261029);
const POOL_FP = poolFingerprint(POOL);

const A = installArch2(W, cfg);
const params = Float64Array.from(P.unpack(raw, true));
if (!params || params.length !== P.paramCount()) { console.error('⛔ 包形状不对：' + (params && params.length) + ' vs ' + P.paramCount()); process.exit(7); }
if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
const randParams = Float64Array.from(P.makePolicy(0.25));

const CELLS = [];
for (const mode of MODES) for (const n of NS) for (const nm of STYLES_WANT) {
  const i = POOL.findIndex((o) => o.name === nm);
  if (i >= 0) CELLS.push({ mode, n, name: nm, idx: i });
}
const CAT = {}; R.skills.forEach((s) => { CAT[s.key] = s.cat; });
function playCell(actorSel, cell) {
  const acc = { games: 0, first: 0, top2: 0, rounds: 0, acts: 0, cat: {}, survived: 0 };
  for (let g = 0; g < GAMES; g++) {
    const seat = g % cell.n;
    const choosers = [];
    for (let pid = 0; pid < cell.n; pid++) choosers.push(pid === seat ? actorSel : POOL[(cell.idx + 1 + pid) % POOL.length].sel);
    const rm = T.oneGameN(choosers, 1000 + cell.n * 97 + cell.idx + g * 7919, cell.n, { regen: 0, mode: cell.mode });
    const st = rm.state, myHp = st.p[seat] ? Math.max(0, st.p[seat].hp) : 0;
    acc.games++;
    if (rm.winner === seat) acc.first++;
    let ahead = 0;
    for (let i = 0; i < cell.n; i++) if (i !== seat) { const h = st.p[i] ? Math.max(0, st.p[i].hp) : 0; if (h > myHp + 1e-9 || (Math.abs(h - myHp) < 1e-9 && rm.dmg[i] > rm.dmg[seat])) ahead++; }
    if (ahead <= 1) acc.top2++;
    if (myHp > 0) acc.survived++;
    acc.rounds += rm.rounds || 0;
    for (const e of (st.events || [])) if (e.type === 'action' && e.pid === seat) { acc.acts++; const ck = CAT[e.key] || '?'; acc.cat[ck] = (acc.cat[ck] || 0) + 1; }
  }
  return acc;
}
/* ===== ④ 逐席可见性：抓一个真实中局局面，逐席拨血量，看候选打分动不动 ===== */
function seatVisibility(cell) {
  /* ⚑ 夹具必须抓到**带目标的决策**（第一版抓"整局第一个决策"，那一手往往只有自指/经济类候选 ⇒ 目标可分性恰好读到 0 枚，
   *   看着像"没有目标候选"，其实是**夹具没碰到那一格**——在册那条"分层读数的自检要能碰到那一格"的又一例）。
   *   ⇒ 逐决策检查，抓到第一枚"合法候选 ≥2 且至少一枚带 target"的决策为止；一幅局抓不到就换种子再来，最多 6 幅。 */
  let cap = null, tried = 0;
  /* ⚑ 抓到就**立刻把局停住**（哨兵异常）：`cap.state` 是活引用，局继续跑会把各席血量改掉
   *   ⇒ 第一版在终局状态上做"换目标/换席"，读出的"无处换"其实是**终局只剩一席**，不是 n 的问题（又一次"读的不是那一格"）。 */
  class StopGame extends Error {}
  for (const seed of [777, 1201, 1709, 2213, 2711, 3313]) {
    tried++;
    let cand = null;
    /* 探针挂在**每一席**上（第一版只挂 seat 0，而那席正是本格的脚本型，wall 型从不点目标 ⇒ 6 幅局全落空）。
     *   抓哪个席的决策都行：目标可分性判的是打分头，与是谁在决策无关。 */
    const probe = (state, pid, legal) => {
      if (!cand && legal && legal.length >= 2) {
        const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
        /* 还要**至少两个存活对手**：只有一个对手时"换个目标"无从做（n=2/3 的目标可分性天然是 n/a，不是合格） */
        let aliveOpp = 0;
        for (let k = 0; k < cell.n; k++) if (k !== pid && state.p[k] && state.p[k].hp > 0) aliveOpp++;
        if (cs.length >= 2 && aliveOpp >= 2 && cs.some((c) => c.target != null)) { cand = { state, pid, legal }; throw new StopGame(); }
      }
      return POOL[(cell.idx + 1 + pid) % POOL.length].sel(state, pid, legal);
    };
    const ch = []; for (let pid = 0; pid < cell.n; pid++) ch.push(probe);
    try { T.oneGameN(ch, seed, cell.n, { regen: 0, mode: cell.mode }); } catch (e) { if (!(e instanceof StopGame)) throw e; }
    if (cand) { cap = cand; break; }
  }
  if (!cap) return { err: '试了 ' + tried + ' 幅局都没抓到"带目标且 ≥2 枚候选"的决策点 ⇒ 这一列读不出（不许当合格）' };
  const st = cap.state, me = cap.pid;
  const cands = P.candidatesFor(st, me, T.econBase(st, me, cap.legal), { lockTarget: false }) || [];
  if (cands.length < 2) return { err: '夹具上候选 <2 枚' };
  const score = () => Array.from(P.forwardCands(st, me, cands, params, { temp: 0.001 }).logits);
  /* ⚑ 夹具先把各席血量造成**互不相同**的值，再做互换。
   *   第一版直接拿现场 hp 换 ⇒ 开局各席血量相等，互换等于没做，`Δ=0` 是"分母为 0 的 0%"（在册那条自反对照的病）。
   *   这里是纯打分面（不解析规则），越界的 hp 不会被终局逻辑吃掉；留下的代价是"这一列读的是合成夹具上的席位可分性"，打印里明写。 */
  const seedHp = [];
  for (let s = 0; s < cell.n; s++) { if (s === me || !st.p[s]) continue; seedHp.push({ s, hp: st.p[s].hp }); st.p[s].hp = 0.5 * (s + 1); }
  const restoreSeed = () => { for (const x of seedHp) if (st.p[x.s]) st.p[x.s].hp = x.hp; };
  const base = score();
  const rows = [];
  for (let s = 0; s < cell.n; s++) {
    if (s === me) continue;
    /* 伙伴席：给 swap 用 ⇒ 必须挑**血量与 s 不同**的那一席（相同则互换是空操作，只能报 n/a，不许报 0） */
    let partner = -1;
    for (let t = 0; t < cell.n; t++) if (t !== me && t !== s && st.p[t] && Math.abs(st.p[t].hp - st.p[s].hp) > 1e-9) { partner = t; break; }
    const one = {};
    for (const kind of PERTURB) {
      const p = st.p[s]; if (!p) continue;
      if (kind === 'swap') {
        const q = st.p[partner];
        if (partner < 0 || !q) { one.swap = null; continue; }
        const a = p.hp, b = q.hp;
        p.hp = b; q.hp = a;                                     /* 两席血量互换：聚合量（min/sum）逐字不变 ⇒ 只有真把席位当个体读才会动 */
        let mx = 0; const now = score();
        for (let i = 0; i < base.length; i++) mx = Math.max(mx, Math.abs(now[i] - base[i]));
        p.hp = a; q.hp = b;
        one.swap = mx;
        continue;
      }
      const oldHp = p.hp;
      p.hp = kind === 'dead' ? 0 : oldHp + 10;
      let mx = 0; const now = score();
      for (let i = 0; i < base.length; i++) mx = Math.max(mx, Math.abs(now[i] - base[i]));
      p.hp = oldHp;                                      /* 必须还原：夹具只借不还 ⇒ 后面那格接错线 */
      one[kind] = mx;
    }
    rows.push({ seat: s, partner, one });
  }
  restoreSeed();
  /* ===== 强判据：**候选的目标身份进没进打分** =====
   * 做法：把一枚带目标的候选**只换 `target` 这一格**（key/bead/target2 全不动），再打一次分。
   *   · 若 Δ=0 ⇒ 这枚头**分不出这一枪打的是谁**（= 夜里那格"target2 失明"同族）
   *   · 这是唯一能碰到"目标身份"这一格的形态：换 hp 只会测"血量有没有绑在席位上"，换两席只测池化对称性（都是别的格） */
  const tgtRows = [];
  const otherAlive = [];
  for (let k = 0; k < cell.n; k++) if (k !== me && st.p[k] && st.p[k].hp > 0) otherAlive.push(k);
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    if (c.target == null) continue;
    const t2 = otherAlive.filter((k) => k !== c.target)[0];
    if (t2 == null) { tgtRows.push({ key: c.key, tau: c.target, alt: null, moved: null }); continue; }
    let mx = 0, nowLogit = null;
    try { nowLogit = Array.from(P.forwardCands(st, me, [{ ...c, target: t2 }], params, { temp: 0.001 }).logits)[0]; } catch (e) { nowLogit = null; }
    if (nowLogit == null) { tgtRows.push({ key: c.key, tau: c.target, alt: t2, moved: null }); continue; }
    mx = Math.abs(nowLogit - base[i]);
    tgtRows.push({ key: c.key, tau: c.target, alt: t2, d: mx, moved: mx > 1e-12 });
  }
  const tgtN = tgtRows.filter((r) => r.moved != null).length;
  const tgtMoved = tgtRows.filter((r) => r.moved === true).length;
  const tgtDetail = tgtRows.length ? ('每枚：' + tgtRows.map((r) => r.key + '@seat' + r.tau + '→' + (r.alt == null ? '无处换' : 'seat' + r.alt + (r.moved ? ' Δ' + r.d.toFixed(4) : ' **Δ0**'))).join(' ‖ ')) : '（夹具里没有带目标的候选）';
  return { cands: cands.length, rows, me, seeded: seedHp.length, tgt: { n: tgtN, all: tgtRows.length, moved: tgtMoved, detail: tgtDetail } };
}
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
console.log('# 2.0 桌形覆盖矩阵 ‖ 包 ' + PACK + ' ‖ 结构 ' + archTag + ' ‖ paramCount=' + P.paramCount() +
  ' ‖ 格 ' + CELLS.length + '（人数 ' + NS.join('/') + ' × 血量档 ' + MODES.map((m) => m + '=hp' + R.MODES[m].hp).join(',') + ' × 桌型 ' + STYLES_WANT.join(',') + '）' +
  ' ‖ 每格 ' + GAMES + ' 局 ‖ temp=' + TEMP + ' ‖ 对手表 ' + POOL_FP + '（同 profile2/ladder 的种子 20261029）');
const t0 = Date.now();
const tally = { tgtAll: 0, tgtN: 0, tgtMoved: 0, tgtBad: 0, cells: 0 };
for (const cell of CELLS) {
  const fBefore = (P.__arch2 && P.__arch2.CNT ? P.__arch2.CNT.forwards : 0);
  const a = playCell(T.policyChooserN(params, TEMP), cell);
  const fAfterPack = (P.__arch2 && P.__arch2.CNT ? P.__arch2.CNT.forwards : 0);
  const b = playCell(T.policyChooserN(randParams, TEMP), cell);
  const fAfterRand = (P.__arch2 && P.__arch2.CNT ? P.__arch2.CNT.forwards : 0);
  const c = playCell(POOL[cell.idx % POOL.length].sel, cell);          /* 桌形地板：不叫 2.0 前向 */
  const fAfterFloor = (P.__arch2 && P.__arch2.CNT ? P.__arch2.CNT.forwards : 0);
  const vis = seatVisibility(cell);
  const famOf = (x) => ['energy', 'attack', 'defense', 'special'].map((k) => k[0] + ':' + pct(x.cat[k] || 0, x.acts)).join(' ');
  console.log('· 格 n=' + cell.n + ' ‖ ' + cell.mode + '(hp' + R.MODES[cell.mode].hp + ') ‖ ' + cell.name);
  for (const [tag, x, fn] of [['2.0包', a], ['随机起点', b], ['桌形地板', c]]) {
    const inc = [fAfterPack - fBefore, fAfterRand - fAfterPack, fAfterFloor - fAfterRand][['2.0包', '随机起点', '桌形地板'].indexOf(tag)];
    console.log('   ' + tag.padEnd(9) + ' ‖ 夺1 ' + pct(x.first, x.games) + ' ‖ 前2 ' + pct(x.top2, x.games) + ' ‖ 活到终局 ' + pct(x.survived, x.games) +
      ' ‖ 局长 ' + (x.rounds / x.games).toFixed(1) + ' ‖ 出手/局 ' + (x.acts / x.games).toFixed(2) + ' ‖ 族 ' + famOf(x) + ' ‖ 2.0前向 +' + inc);
  }
  if (vis.err) { console.log('   ⚑ 逐席 ‖ 读不出：' + vis.err); }
  else {
    /* ⚑ **14:4x 判据改过一次**：第一版把"换两席不动"直接叫"折进聚合、是缺陷"——错。
     *   席位在结构里是**无序集合**（池化 mean+max），换两个都不是目标的席本来就该不动 ⇒ 那是设计属性，不是病。
     *   真正要判的是**候选指向的那一席**：把 τ(=c.target) 与另一席的 hp 互换，若该候选的打分与名次都不动
     *     ⇒ 网络**认不出这一枪打的是谁**（这才是 S1 那面 target2 失明同一族的病）。
     *   ⇒ 下面两条分开报：`目标可分` = 强判据 ‖ `非目标互换` = 只当结构说明，不当缺陷。 */
    const tgt = vis.tgt;
    console.log('   ⚑ 目标可分性（只换候选的 `target` 这一格再打分）‖ 带目标 ' + tgt.all + ' 枚 ‖ 可判 ' + tgt.n + ' 枚 ‖ **换目标后打分变了** ' + tgt.moved + '/' + tgt.n +
      (tgt.n === 0 ? '（这格夹具上没有可判的目标候选 ⇒ 读不出，不算合格）' : (tgt.moved === tgt.n ? '  ✔ 每枚都知道打的是谁' : '  ⛔ 有 ' + (tgt.n - tgt.moved) + ' 枚**换个目标分不变**（目标身份没进打分）')));
    console.log('      ' + tgt.detail);
    const naSwap = vis.rows.filter((r) => r.one.swap == null).length;
    console.log('      结构说明（非缺陷）：非目标席两两互换不动是**无序池化应有的样子** ‖ 本格换过的席位对 ' + vis.rows.length + ' 个（无从换 ' + naSwap + '）' +
      ' ‖ 拨血量不响应 ' + vis.rows.filter((r) => Math.max(r.one.dead || 0, r.one.rich || 0) < 1e-12).length + ' 席');
    tally.tgtN += tgt.n; tally.tgtMoved += tgt.moved; tally.tgtAll += tgt.all;
    if (tgt.n > 0 && tgt.moved < tgt.n) tally.tgtBad++;
  }
  tally.cells++;
}
console.log('⇒ 矩阵收口 ‖ ' + tally.cells + ' 格 × ' + GAMES + ' 局 ‖ 目标可分合计：带目标 ' + tally.tgtAll + ' 枚 ‖ 可判 ' + tally.tgtN +
  ' 枚 ‖ 换目标后打分变了 ' + tally.tgtMoved + ' 枚 ‖ 有"换目标不动"的格 ' + tally.tgtBad + ' / ' + tally.cells + ' ‖ 耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('   ⚑ 判读：**只认"目标可分"这一列**。拨血量/换两席那两列测的是别的格（血量绑不绑定席位、池化对称性），'
  + '它们是结构说明，不是"目标身份读不到"的证据 ｜ `--perturb=` 只影响那两列');
process.exit(0);
