#!/usr/bin/env node
/* profile2.mjs — 2.0 包的**行为剖面**尺（§E 段 D 前置 · 千问 · 10-29 夜）
 *
 * 为什么要有它：臂的 `dFirst` 只有一个数。用户定的展示规矩是**给特性剖面不给总分**（在册 10-10），
 *   而 2.0 的包现在没有任何一条能读它的路径——v7 那三把尺（§E815/817/819b）都吃 235 维的 dump，
 *   `EpirusPolicy.value` 对 2.0 向量**当场抛**（那是 §E822 根因修完之后才有的硬行为）。
 *   ⇒ 新对象要配自己的尺，不是把旧尺硬套。
 *
 * 三条硬条款：
 *   ① 每格同场跑一枚**同结构随机起点包**当对照 ⇒ 只报"与随机起点的差"；绝对值不与 §E818 那些热启动 v7 臂并排（在册裁定）。
 *   ② **接线自证**（覆盖式接入必须证明真被调用）：同一份局面上两粒参数的 logits 若**逐位相同**，
 *      要么被测包就是那枚随机粒（会印出来），要么 chooser 根本没吃到它 ⇒ 后者当场 exit 7，不许继续印剖面。
 *   ③ 对手表由**参照包**造（`T.buildOpps(refParams)`），不用被测包自己造 ⇒ 避免"对手随被评粒变化"那条病。
 *
 * 用法：node tools/proto2/profile2.mjs --pack=scratch/arms/xxx.bak [--games=24] [--ref=js/bundled-champion-3p.js]
 *   · 包里的 `arch` 字段决定输入面（`S1`=吃 v7 切片 ‖ `S1o`=吃 obs3）⇒ 不需要手对齐，读错会当场抛。
 *   · 只读，不改引擎、不 promote、不进产品门。
 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install as installArch2 } from './arch2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', '');
const GAMES = Math.max(4, Number(arg('games', 24)) || 24);
if (!PACK) { console.error('⛔ 需要 --pack=<2.0 的 .bak>'); process.exit(2); }

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const raw = JSON.parse(readFileSync(PACK, 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
if (raw.v !== 90) { console.error('⛔ 这不是 2.0 容器（v=' + raw.v + ' ⇒ 只认 v:90）'); process.exit(2); }
const archTag = raw.arch || 'S1';
const cfg = { mutMode: 'seg', ...(raw.dims || {}) };
if (archTag === 'S1o') cfg.input = 'obs3';

/* ⚑ 顺序要紧：**先**用原生 `unpack` 把 v7 参照包读出来，**再**装 2.0 覆盖。
 *   装完之后再读 v7 ⇒ `unpack` 只认 v:90 ⇒ 返回 null（我第一版就栽在这里，报的还是"参照包读不出"这种指错方向的话）。 */
const refSrc = arg('ref', 'js/bundled-champion-3p.js');
let refParams = loadChamp(W, refSrc, '');
if (!refParams) { console.error('⛔ 参照包读不出（' + refSrc + '）⇒ 对手表无法固定'); process.exit(2); }
refParams = Float64Array.from(refParams);

const A = installArch2(W, cfg);
const params = Float64Array.from(P.unpack(raw, true));
if (!params || params.length !== P.paramCount()) { console.error('⛔ 包形状不对：读出 ' + params.length + ' ‖ 当前结构要 ' + P.paramCount()); process.exit(7); }
P.setRng(T.mulberry32(4242));
const randParams = Float64Array.from(P.makePolicy(0.25));
const POOL = T.buildOpps(refParams, 0.05);
const STYLES = ['breakdef', 'wall', 'tankline', 'guardgun', 'protowall', 'reflectmix', 'beadburst', 'aggro'];
const CELLS = [];
for (const n of [3, 5]) for (const nm of STYLES) { const i = POOL.findIndex((o) => o.name === nm); if (i >= 0) CELLS.push({ n, name: nm, idx: i }); }

/* ===== 条款 ②：接线自证 =====
 * 候选集不自己重写：`legal` 只能从引擎的 chooser 回调里拿（`econBase(state,pid,legal)` 要它），
 *   所以这里在开局的决策点上装一枚"capturing chooser"，把 (state,pid,legal) 抓一份下来再打分。 */
function midFixture(seed) {
  let cap = null;
  const probe = (state, pid, legal) => { if (!cap && legal && legal.length) cap = { state, pid, legal }; return POOL[0].sel(state, pid, legal); };
  const choosers = [probe];
  for (let pid = 1; pid < 5; pid++) choosers.push(POOL[pid % POOL.length].sel);
  T.oneGameN(choosers, seed, 5, { regen: 0, mode: 'multi' });
  if (!cap) { console.error('⛔ 一整局都没抓到 (state,pid,legal) ⇒ 夹具失效，接线自证没法做'); process.exit(7); }
  return cap;
}
function logitsOf(pack, fx) {
  const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
  if (!cands || !cands.length) { console.error('⛔ 夹具上没有合法候选 ⇒ 自证失效'); process.exit(7); }
  const f = P.forwardCands(fx.state, fx.pid, cands, pack, { temp: 0.5 });
  return { s: Array.from(f.logits).map((v) => v.toFixed(6)).join(','), n: cands.length };
}
{
  const st = midFixture(777);
  const a = logitsOf(params, st), b = logitsOf(randParams, st);
  const wiredOK = A.CNT ? A.CNT.forwards > 0 : (P.__arch2 && P.__arch2.CNT.forwards > 0);
  const cn = (P.__arch2 && P.__arch2.CNT) || A.CNT;
  if (!wiredOK) { console.error('⛔ 2.0 前向一次都没被叫到 ⇒ chooser 没吃到这份参数，剖面全是假的'); process.exit(7); }
  if (a.s === b.s) {
    let diff = 0; for (let i = 0; i < params.length; i++) if (params[i] !== randParams[i]) { diff = i + 1; break; }
    if (!diff) { console.log('⚠ 接线自证：被测包与随机起点包**逐位同一粒** ⇒ 这条臂其实没动过权重（剖面照跑，但判语只能是"没学到东西"）'); }
    else { console.error('⛔ 接线自证：两粒权重第 ' + diff + ' 个坐标已不同，但 logits 逐位相同 ⇒ 前向没吃到参数（§E822 那族病）'); process.exit(7); }
  }
  console.log('# 接线自证 ✔ forwardCands 已跑 ' + cn.forwards + ' 次 ‖ 候选打分 ' + cn.cands + ' 个 ‖ 同局面 logits：包 ' + a.s.slice(0, 34) + '… ‖ 随机 ' + b.s.slice(0, 34) + '…（各 ' + a.n + ' 个候选）');
}

const CAT = {}; R.skills.forEach((s) => { CAT[s.key] = s.cat; });
function playCell(pack, cell, seed) {
  const acc = { games: 0, first: 0, top2: 0, rounds: 0, acts: 0, cat: {}, guard: 0, charge: 0, bead: 0, voidedOnMe: 0, survived: 0 };
  for (let g = 0; g < GAMES; g++) {
    const seat = g % cell.n;
    const choosers = [];
    for (let pid = 0; pid < cell.n; pid++) {
      if (pid === seat) choosers.push(T.policyChooserN(pack));
      else choosers.push(POOL[(cell.idx + 1 + pid) % POOL.length].sel);
    }
    const rm = T.oneGameN(choosers, seed + g * 7919, cell.n, { regen: 0, mode: 'multi' });
    const st = rm.state;
    acc.games++;
    if (rm.winner === seat) acc.first++;
    /* 前2 = 终局血量名次（`oneGameN` 只回 {winner,rounds,dmg,state} ⇒ 名次自己按终局 hp 数，别假设有现成的） */
    const myHp = st.p[seat] ? Math.max(0, st.p[seat].hp) : 0;
    let ahead = 0;
    for (let i = 0; i < cell.n; i++) if (i !== seat) { const h = st.p[i] ? Math.max(0, st.p[i].hp) : 0; if (h > myHp + 1e-9 || (Math.abs(h - myHp) < 1e-9 && rm.dmg[i] > rm.dmg[seat])) ahead++; }
    if (ahead <= 1) acc.top2++;
    acc.rounds += rm.rounds || 0;
    if (myHp > 0) acc.survived++;
    for (const e of (st.events || [])) {
      if (e.type === 'action' && e.pid === seat) {
        acc.acts++; acc.cat[CAT[e.key] || '?'] = (acc.cat[CAT[e.key] || '?'] || 0) + 1;
        if (e.key === 'charge') acc.charge++;
        if (R.GUARD_FAMILY.indexOf(e.key) >= 0) acc.guard++;
        if (e.bead) acc.bead++;
      }
      if (e.type === 'voided' && (e.to === seat || e.pid === seat || e.byPid === seat)) acc.voidedOnMe++;
    }
  }
  return acc;
}
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
const per = (a, b) => b ? (a / b).toFixed(2) : '—';
function row(tag, pack, cell, seed) {
  const a = playCell(pack, cell, seed);
  const cats = ['energy', 'attack', 'defense', 'special'].map((k) => k[0] + ':' + pct(a.cat[k] || 0, a.acts)).join(' ');
  console.log('  ' + tag.padEnd(9) + ' ‖ 局 ' + a.games + ' ‖ 夺1 ' + pct(a.first, a.games) + ' ‖ 前2 ' + pct(a.top2, a.games) +
    ' ‖ 活到终局 ' + pct(a.survived, a.games) + ' ‖ 局长 ' + per(a.rounds, a.games) + ' ‖ 出手/局 ' + per(a.acts, a.games) +
    ' ‖ 族 ' + cats + ' ‖ 蓄能 ' + pct(a.charge, a.acts) + ' ‖ 架势 ' + pct(a.guard, a.acts) + ' ‖ 用珠 ' + a.bead + ' ‖ 无效化事件 ' + a.voidedOnMe);
  return a;
}
console.log('# 2.0 行为剖面 ‖ 包 ' + PACK + ' ‖ 结构 ' + archTag + ' ‖ paramCount=' + P.paramCount() +
  ' ‖ 每格 ' + GAMES + ' 局 ‖ 对手表固定自 ' + refSrc + ' ‖ ⚑ 只与同结构随机起点比（2.0 从随机起点训练，绝对值不与热启动 v7 臂并排）');
const S = { pF: 0, pG: 0, pT: 0, rF: 0, rT: 0, rG: 0 };
for (const cell of CELLS) {
  console.log('· 格 ' + cell.name + ' ‖ n=' + cell.n);
  const a = row('2.0包', params, cell, 1000 + cell.n * 97 + cell.idx);
  const b = row('随机起点', randParams, cell, 1000 + cell.n * 97 + cell.idx);
  S.pF += a.first; S.pG += a.games; S.pT += a.top2; S.rF += b.first; S.rG += b.games; S.rT += b.top2;
}
const dFirst = 100 * (S.pF / S.pG - S.rF / S.rG), dTop2 = 100 * (S.pT / S.pG - S.rT / S.rG);
console.log('⇒ 汇总 ' + CELLS.length + ' 格 ‖ 各 ' + GAMES + ' 局 ‖ 共 ' + S.pG + ' 局：夺1 ' + pct(S.pF, S.pG) + ' vs 随机 ' + pct(S.rF, S.rG) +
  ' ⇒ **Δ夺1 ' + dFirst.toFixed(2) + 'pt** ‖ Δ前2 ' + dTop2.toFixed(2) + 'pt');
const se = 100 * Math.sqrt((S.pF / S.pG) * (1 - S.pF / S.pG) / S.pG + (S.rF / S.rG) * (1 - S.rF / S.rG) / S.rG);
console.log('   合并 SE ≈ ' + se.toFixed(2) + 'pt ⇒ |Δ| < ' + (2 * se).toFixed(1) + 'pt 只能写"分不开"（本轮' + (Math.abs(dFirst) > 2 * se ? '过线' : '**不过线**') + '）');
console.log('   ⚑ 「前2」在 n=3 的**随机基线就是 66.7%**、n=5 是 40% ⇒ 它只当"别死太早"的粗读数，判别力主要看夺1；' +
  '混合两档时前2 的分母不是同一个 ⇒ 不许单独引它下判语');
console.log('   ⚑ 两行分母必须相等（同格同局号）：' + S.pG + ' vs ' + S.rG + (S.pG === S.rG ? ' ✔' : ' ⇒ 剖面作废'));
process.exit(S.pG === S.rG ? 0 : 2);
