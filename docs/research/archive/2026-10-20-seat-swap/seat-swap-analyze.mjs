/* §E668 · "固定三席、只换第 N 席"的近因果切法（预注册 = docs/research/PREREG-2026-10-20-seat-swap-qoder.md）
 *
 * 只读 §E666 的六份逐桌子落盘：C(7,4)=35 是**完全设计** ⇒ "另外三席一模一样、只把第四席换个名字"的每一对
 * 本来就在数据里，**不需要新跑一局，也不需要给 `eval-5p.mjs` 加旗标**（那台被三条门钉着，而 `--field` 只认
 * 预设场名 —— 我上一条给用户的"用 --field= 固定桌子"那个前提是我读错的，更正已写进预注册 §〇）。
 *
 * 方向约定（写死）：Δ(T) = 1st率(开档,T) − 1st率(关档,T)，**负 = 开档更差**。
 *   §E666 那张表用的是"关−开 为正"⇒ 与本节差一个符号，两边的数不许并排引。
 *
 * 用法：node docs/research/archive/2026-10-20-seat-swap/seat-swap-analyze.mjs [--mutate=<池>:<pt>] [--boot=20000] [--rng=<n>]
 * 四条闸（不过就 exit，不许"先出数再说"）：① 配对身份 ② 复现 §E666 ③ Σ_x M(x)=0 ④ 结构零剔除。
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { rejectUnknownFlags } from '../../../../tools/audit-lib.mjs';

rejectUnknownFlags(process.argv.slice(2), ['mutate', 'boot', 'rng', 'perm'], 'seat-swap-analyze');
const HERE = import.meta.dirname;
const SRC = path.join(HERE, '..', '2026-10-20-night-d15-gates', 'pool-split');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const BOOT = Number(arg('boot', 20000));
const RNG0 = Number(arg('rng', 20261020));
const SEEDS = [77000, 77001, 77002];
const ZERO_SEED = 77001;                                     // 两臂同一粒权重 ⇒ Δ≡0，不进判据（闸④）
/* §E666 落纸的数（闸②用它证明这把新尺吃的是同一批数、口径没漂）。
 *   ⚠ 必须**按格存**：§E666 那张表每个池有两列（seed 77000 ‖ 77002），只存一列的话另一格会集体"对不上"
 *     —— 第一次跑就是这么误红过一次（7 格全 ⚠，而数值恰好等于那一节的第二列 ⇒ 是我的常数错，不是数据错）。 */
const E666_POOL = {
  77000: { antidef: 2.45, deepsaver: 7.30, defend: 5.15, farmer: 5.17, heavyfire: 3.30, random: 9.25, wall: 10.98 },
  77002: { antidef: 8.93, deepsaver: 4.35, defend: 2.60, farmer: 3.25, heavyfire: 4.87, random: 6.85, wall: 4.85 }
};
const E666_TOTAL = { 77000: 6.229, 77002: 5.100 };
const NAMES = ['antidef','deepsaver','defend','farmer','heavyfire','random','wall'];   // 七个池（CORE 名单，与 §E666 同一套）

function load(arm, seed) {
  const f = path.join(SRC, 'gv' + arm + '-' + seed + '.per.txt');
  if (!existsSync(f)) { console.error('⛔ 落盘不在：' + f); process.exit(2); }
  const rows = [];
  for (const ln of readFileSync(f, 'utf8').split('\n')) {
    if (ln[0] === '#' || !ln.trim()) continue;
    const c = ln.split('\t');
    if (c[0] !== 'subject') continue;
    rows.push({ idx: +c[1], names: c[2], games: +c[3], first: +c[4] });
  }
  rows.sort((a, b) => a.idx - b.idx);
  return rows;
}
const mean = a => a.reduce((x, v) => x + v, 0) / a.length;
const key = names => names.slice().sort().join(',');
function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ── 闸①④：读六份落盘，逐格建"桌子 → Δ(开−关)" ── */
const MUT = arg('mutate', '');
const MP = /^([a-z]+):(-?[\d.]+)$/.exec(MUT);
if (MUT && !MP) { console.error('⛔ --mutate 写法应为 <池>:<pt>，实测 `' + MUT + '`'); process.exit(2); }
if (MP && NAMES.indexOf(MP[1]) < 0) { console.error('⛔ 变异指定的池 `' + MP[1] + '` 不在七个池名里 ⇒ 变异根本不生效，拒跑'); process.exit(2); }

const cells = [];
for (const s of SEEDS) {
  const off = load(0, s), on = load(1, s);
  if (off.length !== on.length || off.some((r, i) => r.idx !== on[i].idx || r.names !== on[i].names)) {
    console.error('⛔ 闸① seed=' + s + ' 两臂的桌子名单不逐位相同 ⇒ 不是同一批桌子，不许配对'); process.exit(2);
  }
  const byKey = {};
  for (let i = 0; i < off.length; i++) {
    let d = 100 * (on[i].first / on[i].games - off[i].first / off[i].games);
    if (MP && off[i].names.split(',').indexOf(MP[1]) >= 0) d += Number(MP[2]);      // 变异只动"该池在场"的桌子
    byKey[key(off[i].names.split(','))] = d;
  }
  const g = off.reduce((x, r) => x + r.games, 0);
  cells.push({
    seed: s, byKey, n: Object.keys(byKey).length,
    tot: 100 * on.reduce((x, r) => x + r.first, 0) / g - 100 * off.reduce((x, r) => x + r.first, 0) / g
  });
}
const used = cells.filter(c => c.seed !== ZERO_SEED);
const zc = cells.filter(c => c.seed === ZERO_SEED)[0];
console.log('闸① 配对身份 ✔ ‖ 每格桌子数 = ' + cells.map(c => c.n).join(' ‖ ') + '（应为 35 = C(7,4)）');
console.log('闸④ 结构零格 seed=' + ZERO_SEED + '：逐格总 Δ = ' + zc.tot.toExponential(2) + 'pt ⇒ ' +
  (Math.abs(zc.tot) < 1e-9 ? '✔ 恒零（两臂同一粒权重），已剔除，不进任何均值/判据' : '⛔ 本应恒零却非零 ⇒ 停'));
if (Math.abs(zc.tot) >= 1e-9) process.exit(2);
if (MP) console.log('⚑⚑ 变异档已生效：含 `' + MP[1] + '` 的桌子 Δ 全体 +' + MP[2] + 'pt（这是**尺的牙**检查，不是读数）');

/* ── 枚举"三席固定、换第四席"：每个 3 子集 S × 余集里每对 (x,y) ⇒ C(7,3)×C(4,2) = 35×6 = 210 组 ── */
const TRIPLES = [];
for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) for (let k = j + 1; k < 7; k++) {
  const S = [NAMES[i], NAMES[j], NAMES[k]];
  const rest = NAMES.filter(n => S.indexOf(n) < 0);
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    const sx = key(S.concat([rest[a]])), sy = key(S.concat([rest[b]]));
    if (used.some(c => c.byKey[sx] == null || c.byKey[sy] == null)) { console.error('⛔ 完全设计里缺桌子 ' + sx + '/' + sy + ' ⇒ 拆不出这一对'); process.exit(2); }
    TRIPLES.push({ x: rest[a], y: rest[b], sx, sy });
  }
}
/* 换席边际：M(x) = 平均 over (S,y,格) 的 [Δ(S∪{x}) − Δ(S∪{y})]。
 * 抽样单位是**整张桌子**（两臂同处一簇），重抽到的同一张桌子按出现次数计权（⇒ 用 pos 列表，不用去重表）。 */
function margsOf(posOf, strict) {                   // posOf: key → [d,...]
  const acc = {}; for (const n of NAMES) acc[n] = { s: 0, n: 0 };
  let miss = 0;
  for (const t of TRIPLES) {
    const A = posOf[t.sx], B = posOf[t.sy];
    /* cluster bootstrap 里"这一张桌子没被抽到"是**正常的**（它就是被重抽样跳过了）⇒ 这一组对比不进这一趟的分母；
     *   但点估计（strict=true）缺桌子 = 设计破了 ⇒ 响亮停。两种情形不许同形。 */
    if (!A || !B) { miss++; if (strict) { console.error('⛔ 完全设计里缺桌子 ' + t.sx + '/' + t.sy + ' ⇒ 停'); process.exit(2); } continue; }
    for (const da of A) for (const db of B) { const d = da - db; acc[t.x].s += d; acc[t.x].n++; acc[t.y].s -= d; acc[t.y].n++; }
  }
  const m = {}; for (const n of NAMES) m[n] = acc[n].s / acc[n].n;
  m.__den = acc[NAMES[0]].n; m.__miss = miss;
  return m;
}
/* 点估计：把**两格**的同一个桌子键并成一条列表（每键 2 个值）——
 *   ⚠ 这里原来写 `Object.assign({}, ...posAll)`，那是**后一格顶掉前一格**（每个键只剩一个值）⇒ 分母偷偷减半。 */
const posAll = {};
for (const c of used) for (const k of Object.keys(c.byKey)) (posAll[k] = posAll[k] || []).push(c.byKey[k]);
const M = margsOf(posAll, true);
const sum = NAMES.reduce((a, n) => a + M[n], 0);
console.log('\n换席边际 M(x)（pt ‖ **正 = 把 x 摆进可换那一格之后，开档相对关档多赚** ‖ 每池分母 ' + M.__den
  + ' 条 = 20 个固定三席 × 3 个被换对象 × 2 向（摆进去/被摆出去）× 两格交叉配对（每对 2×2）；其中**互不相同**的对比 = 20×3×2×' + used.length + ' = 120）');
for (const n of NAMES.slice().sort((a, b) => M[b] - M[a])) console.log('  ' + n.padEnd(11) + (M[n] >= 0 ? '+' : '') + M[n].toFixed(3));
console.log('  闸③ Σ_x M(x) = ' + sum.toExponential(2) + (Math.abs(sum) < 1e-9
  ? ' ✔（每条对比都以反号各出现一次 ⇒ 必须为 0；不为 0 = 我索引接错线）'
  : ' ⛔ 不为 0 ⇒ 本节作废'));
if (Math.abs(sum) >= 1e-9) process.exit(2);

const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))]; };

/* ── 逐格（每粒 seed）各算一遍 M(x)：两格是**两次独立起点**，排序对不对得上是这条结论能不能升级的关键 ── */
console.log('\n逐格复核（每粒 seed 单独算 M(x)，Bonferroni 区间用同一套 bootstrap 在该格内重抽）');
const perCellBoot = used.map(c => {
  const rr = rng(RNG0 + c.seed);
  const ks = Object.keys(c.byKey), out = [];
  for (let b = 0; b < BOOT; b++) {
    const o = {};
    for (let i = 0; i < ks.length; i++) { const k = ks[Math.floor(rr() * ks.length)]; (o[k] = o[k] || []).push(c.byKey[k]); }
    out.push(margsOf(o, false));
  }
  return out;
});
const perCellM = used.map(c => margsOf((() => { const o = {}; for (const k of Object.keys(c.byKey)) o[k] = [c.byKey[k]]; return o; })(), true));
console.log('  池           ' + used.map(c => '  seed' + c.seed).join('') + '   ‖ 两格同号?');
for (const n of NAMES.slice().sort((a, b) => M[b] - M[a])) {
  const vs = perCellM.map(m => m[n]);
  console.log('  ' + n.padEnd(11) + vs.map(v => ((v >= 0 ? '+' : '') + v.toFixed(2)).padStart(9)).join('')
    + '   ‖ ' + (vs[0] * vs[1] > 0 ? '同号' : '**反号**'));
}
console.log('  逐格 95% 区间（该格内 cluster bootstrap）：');
for (const n of NAMES.slice().sort((a, b) => M[b] - M[a])) {
  console.log('  ' + n.padEnd(11) + perCellBoot.map(b => {
    const v = b.map(m => m[n]);
    return '[' + q(v, 0.025).toFixed(1) + ',' + q(v, 0.975).toFixed(1) + ']';
  }).join('  '));
}
const ranks = perCellM.map(m => NAMES.slice().sort((a, b) => m[b] - m[a]));
console.log('  两格各自的排序（高→低）：\n   ' + ranks.map((rk, i) => 'seed' + used[i].seed + ': ' + rk.join('>')).join('\n   '));
const agree = ranks[0].indexOf('defend') < 3 && ranks[1].indexOf('defend') < 3;
console.log('  ⇒ defend 在两格里都排进前三：' + (agree ? '是' : '**否**') + '（描述，不是判据）');

/* ── cluster bootstrap：每格有放回抽 35 张桌子（重影按次计权） ── */
const r = rng(RNG0);
const bootM = [];
const bootPerCell = used.map(() => []);          // 逐格各存一份 ⇒ 用来判"这一对在两个起点里是不是同向且都过线"
for (let b = 0; b < BOOT; b++) {
  const o = {};
  const per = [];
  for (let ci = 0; ci < used.length; ci++) {
    const c = used[ci], ks = Object.keys(c.byKey), oc = {};
    for (let i = 0; i < ks.length; i++) {
      const k = ks[Math.floor(r() * ks.length)];
      (oc[k] = oc[k] || []).push(c.byKey[k]);
      (o[k] = o[k] || []).push(c.byKey[k]);
    }
    const mm = margsOf(oc, false);
    per.push(mm);
    bootPerCell[ci].push(mm);
  }
  void per;
  bootM.push(margsOf(o, false));
}
const BONF = 0.05 / 21, loP = BONF / 2, hiP = 1 - BONF / 2;
console.log('\n逐池换席边际 + cluster bootstrap（' + BOOT + ' 次，抽样单位=整张桌子；单位 pt）');
for (const n of NAMES.slice().sort((a, b) => M[b] - M[a])) {
  const v = bootM.map(m => m[n]);
  const lo = q(v, loP), hi = q(v, hiP);
  console.log('  ' + n.padEnd(11) + (M[n] >= 0 ? '+' : '') + M[n].toFixed(2).padStart(6)
    + '   95%[' + q(v, 0.025).toFixed(2) + ',' + q(v, 0.975).toFixed(2) + ']   Bonf[' + lo.toFixed(2) + ',' + hi.toFixed(2) + ']'
    + (lo > 0 || hi < 0 ? '   ← 该池离全体均值确实远' : ''));
}
const pairs = [];
for (let i = 0; i < NAMES.length; i++) for (let j = i + 1; j < NAMES.length; j++) {
  const x = NAMES[i], y = NAMES[j];
  const v = bootM.map(m => m[x] - m[y]);
  const lo = q(v, loP), hi = q(v, hiP);
  /* ⚑ 这条"两格都过线"是我**看到第一版读数之后加的第二把_checks**（antidef 在两格里反号 ⇒ 只靠合池的 Bonferroni 会把"不稳定"读成"有效应"）。
   *   主判线仍是预注册 §三 那条（合池 + Bonferroni），这条只用来**降级**，不用来说事。 */
  const perSig = used.map((c, ci) => {
    const vv = bootPerCell[ci].map(m => m[x] - m[y]);
    return q(vv, loP) > 0 || q(vv, hiP) < 0;
  });
  const perVal = perCellM.map(m => m[x] - m[y]);
  /* 单格的 Bonferroni 区间必然更宽（一格只有一半的桌子）⇒ 这里连区间一起印出来，
   *   好把"**两格反号**"与"两格同向但单格分母不够"分开 —— 这两种"没过线"长得一样，意思完全不同。 */
  const perCI = used.map((c, ci) => {
    const vv = bootPerCell[ci].map(m => m[x] - m[y]);
    return '[' + q(vv, loP).toFixed(1) + ',' + q(vv, hiP).toFixed(1) + ']';
  });
  const sameSign = perVal[0] * perVal[1] > 0;
  pairs.push({ x, y, d: M[x] - M[y], lo, hi, sig: lo > 0 || hi < 0, perSig, perVal, perCI, sameSign });
}
const sig = pairs.filter(p => p.sig);
const sigBoth = sig.filter(p => p.perSig.every(Boolean));
const widest = pairs.slice().sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
console.log('\n成对判定（21 对，Bonferroni α=0.05/21=' + BONF.toFixed(4) + '）：合池过线的对 = **' + sig.length + '** ‖ 其中**两格都过线**的 = **' + sigBoth.length + '**');
for (const p of sig.slice(0, 8)) {
  console.log('  ' + p.x + ' vs ' + p.y + '：合池 ' + (p.d >= 0 ? '+' : '') + p.d.toFixed(2) + ' Bonf[' + p.lo.toFixed(2) + ',' + p.hi.toFixed(2) + ']'
    + '   ‖ 逐格 ' + p.perVal.map((v, i) => (v >= 0 ? '+' : '') + v.toFixed(2) + ' Bonf' + p.perCI[i]).join(' ‖ ')
    + '   ⇒ ' + (p.perSig.every(Boolean) ? '**两格都过线**' : (p.sameSign ? '两格**同向**、但单格分母不够（一格只有 20 张桌子）' : '⚑ **两格反号** ⇒ 这一对不能指名')))
}
const flip = sig.filter(p => !p.sameSign);
console.log('  ⇒ 过线的 ' + sig.length + ' 对里：两格反号的 = ' + flip.length + '（' + flip.map(p => p.x + '/' + p.y).join(' ‖ ') + '）‖ 同向但单格欠分母的 = ' + (sig.length - flip.length - sigBoth.length));
console.log('  最大的那一对（不论过没过线）：' + widest.x + ' vs ' + widest.y + ' = ' + (widest.d >= 0 ? '+' : '') + widest.d.toFixed(2)
  + ' Bonf[' + widest.lo.toFixed(2) + ',' + widest.hi.toFixed(2) + ']' + (widest.sig ? ' ⇒ 过线' : ' ⇒ 含 0'));

/* ── 两条置换零假设（**两条都要跑**，因为它们回答的不是同一个问题，而第一条差点把我骗过去）──
 *  (1) 桌子层随机重排【主判】：把每格里 35 个 Δ **重排到别的桌子**（保多重集、打断"哪一池在场"与 Δ 的关联）
 *      ⇒ H0 = "桌子的构成与掉分无关" —— 这才是本节要问的那件事，且抽样单位仍是 70 张桌子（不是 420 条对比）。
 *  (2) 逐对比翻号【反面教材，只印不判】：把每条 D(x,y|S) 以 1/2 概率翻号。
 *      ⚑ 我第一版把"随机改池名"当零假设，那是**一条假检验**：设计对七个名字完全对称 ⇒ 改名只是把 M 的值在池之间搬，
 *      统计量"21 对里最大的 |差|"根本不动 ⇒ 零分布退化成一竖线（中位=P99=观测值，p=0.98）。
 *      第二版（逐对比翻号）p=0.0000、零分布最大才 1.83pt —— 也**不能用**：那 420 条对比全都由 70 个桌子级 Δ 决定，
 *      把它们当独立号翻 ⇒ 零分布窄了约一个根号，等于把有效样本从 70 谎报成 420（**反保守**）。
 *      两条一起印出来，是为了让下一个人一眼看见"p=0"长什么样的两种错法。 */
const PERM = Number(arg('perm', 4000));
{
  const obsMax = Math.max(...pairs.map(p => Math.abs(p.d)));
  const rp = rng(RNG0 + 999331);
  const maxOf = (m) => { let best = 0; for (let i = 0; i < NAMES.length; i++) for (let j = i + 1; j < NAMES.length; j++) best = Math.max(best, Math.abs(m[NAMES[i]] - m[NAMES[j]])); return best; };
  const cellKeys = used.map(c => Object.keys(c.byKey));
  const mx = [];
  for (let b = 0; b < PERM; b++) {
    const o = {};
    for (let ci = 0; ci < used.length; ci++) {
      const ks = cellKeys[ci], vals = ks.map(k => used[ci].byKey[k]);
      for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(rp() * (i + 1)); const t = vals[i]; vals[i] = vals[j]; vals[j] = t; }
      for (let i = 0; i < ks.length; i++) (o[ks[i]] = o[ks[i]] || []).push(vals[i]);
    }
    mx.push(maxOf(margsOf(o, false)));
  }
  mx.sort((a, b) => a - b);
  let ge = 0; for (const v of mx) if (v >= obsMax) ge++;
  console.log('\n置换 (1) 桌子层重排【主判】（H0="桌子的构成与掉分无关"，' + PERM + ' 次；单位 pt）');
  console.log('  观测值：21 对里最大的 |M(x)−M(y)| = ' + obsMax.toFixed(2));
  console.log('  零分布：中位 ' + mx[Math.floor(mx.length / 2)].toFixed(2) + ' ‖ P90 ' + q(mx, 0.9).toFixed(2) + ' ‖ P95 ' + q(mx, 0.95).toFixed(2)
    + ' ‖ P99 ' + q(mx, 0.99).toFixed(2) + ' ‖ 最大 ' + mx[mx.length - 1].toFixed(2) + '（' + PERM + ' 次里没有一个）');
  console.log('  ⇒ p = ' + (ge / PERM).toFixed(4) + '（' + ge + '/' + PERM + '）'
    + (ge / PERM <= 0.05 ? ' ⇒ **过线**：重排桌子造不出这么大的池间差' : ' ⇒ **不过线**：重排就能造出来 ⇒ 那 6 对不能指名'));

  const flat = [];
  for (const c of used) for (const t of TRIPLES) flat.push({ x: t.x, y: t.y, d: c.byKey[t.sx] - c.byKey[t.sy] });
  const flatLen = flat.length;
  const rp2 = rng(RNG0 + 7777);
  const mx2 = [];
  for (let b = 0; b < PERM; b++) {
    const acc = {}; for (const n of NAMES) acc[n] = 0;
    for (const f of flat) { const d = rp2() < 0.5 ? -f.d : f.d; acc[f.x] += d; acc[f.y] -= d; }
    let best = 0;
    for (let i = 0; i < NAMES.length; i++) for (let j = i + 1; j < NAMES.length; j++) best = Math.max(best, Math.abs(acc[NAMES[i]] - acc[NAMES[j]]) / flatLen);
    mx2.push(best);
  }
  mx2.sort((a, b) => a - b);
  let ge2 = 0; for (const v of mx2) if (v >= obsMax) ge2++;
  console.log('\n置换 (2) 逐对比翻号【反面教材，不用于判读】（分母 ' + flatLen + ' 条对比，但它们只由 70 张桌子决定）');
  console.log('  零分布：中位 ' + mx2[Math.floor(mx2.length / 2)].toFixed(2) + ' ‖ P99 ' + q(mx2, 0.99).toFixed(2) + ' ‖ 最大 ' + mx2[mx2.length - 1].toFixed(2)
    + '   ⇒ p = ' + (ge2 / PERM).toFixed(4) + '（**这条"过线"不算数**：它把有效样本从 70 谎报成 420）');
}

/* 符号一致性（描述，不判） */
console.log('\n符号一致性（描述用，不是判据）：把该池摆进那一格 vs 摆别人 —— 每条对比都要落一边');
for (const n of NAMES) {
  const ds = [];
  for (const c of used) for (const t of TRIPLES) {
    const d = c.byKey[t.sx] - c.byKey[t.sy];
    if (t.x === n) ds.push(d); else if (t.y === n) ds.push(-d);
  }
  const pos = ds.filter(v => v > 0).length, neg = ds.filter(v => v < 0).length;
  console.log('  ' + n.padEnd(11) + ' 正 ' + pos + ' ‖ 负 ' + neg + ' ‖ 零 ' + (ds.length - pos - neg) + '（分母 ' + ds.length + '）');
}

/* ── 闸②：独立重算 §E666 的逐池"在场"与总 Δ，与那一节落纸的数逐格对 ── */
if (MP) {
  console.log('\n闸② **跳过**：这一趟是变异对照（数据被我故意扰动过），拿它去对 §E666 必然对不上 —— 那条闸只对"没动过的手"有效。');
} else {
console.log('\n闸② · 复现 §E666（本脚本独立重算 vs 那一节落纸；方向=关−开，与本节的 Δ 反号）');
let drift = 0;
for (const c of used) {
  const tot = -c.tot;
  const ok = Math.abs(tot - E666_TOTAL[c.seed]) < 0.02;
  if (!ok) { drift++; }
  console.log('  seed ' + c.seed + ' 总 Δ 本脚本 ' + tot.toFixed(3) + ' ‖ §E666 ' + E666_TOTAL[c.seed].toFixed(3) + ' ⇒ ' + (ok ? '✔' : '⚠ 对不上'));
  for (const n of NAMES) {
    const inD = Object.keys(c.byKey).filter(k => k.split(',').indexOf(n) >= 0).map(k => -c.byKey[k]);
    const m = mean(inD), ref = E666_POOL[c.seed][n], okk = Math.abs(m - ref) < 0.02;
    if (!okk) { drift++; console.log('    ⚠ 池 ' + n + '：本脚本 ' + m.toFixed(2) + ' vs §E666 该格 ' + ref + '（' + inD.length + ' 张桌子）'); }
  }
}
console.log('  ⇒ 闸②' + (drift ? ' **没通过**（' + drift + ' 格对不上）⇒ 别引用本节' : ' 通过：2 格总 Δ + 14 个池格全部对上（<0.02pt）'));
if (drift) process.exit(2);
}
console.log('\n判读口径（PREREG §三）：只有过 Bonferroni 的对才许说"换这一席确实不一样"；一对都没有 ⇒ 写"当前分母下读不出"，不写"无影响"。');
console.log('DONE');
