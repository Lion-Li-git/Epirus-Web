/* §E576 判读相：哪一维真的对"人席"付账（预登记，跑前写死在这里）
 *
 * 背景（为什么这一步现在该做）：§E575 已经证明**换当选键救不了分辨率** —— 在"20 局 × 36 对"这套样本量下，
 *   名次族与行为族都分不开臂内 6 带。所以下一刀是**换候选集合的形状**（跨臂按行为格筛 3~5 枚，再上贵尺）。
 *   而"按哪几格筛"目前没有任何有数的依据：`charges` 当键两遍判死（p=0.32/0.2531），
 *   考卷 ↔ 出厂闸 ρ=0.217、↔ 广度 ρ=0.014，分数尺 ↔ 人席 ρ≈0（§E506）。
 *
 * 目标量（都是"越低越好"，因为印的是**人类那一席的夺冠率**）：
 *   `multi六格均值`、`long六格均值`、`最大格`
 * 自变量：coords 的 10 个行为维（dmg, heavy, holo, rounds, distinctKeys, charges, waste, noThreatStance, Geff, seatSpread）
 *   ＋ 3 个分数维（H, Hp, De）—— 分数维**只作对照**（已知与人席无关，用来验仪器没接错）。
 *
 * 判据（跑前写死，不许事后改口径）：
 *   (a) **仪器锚点**（§E608 改名，原来叫现役锚点是措辞错）：`SHIPPED-Ldemo` 这一批的 multi/long 六格均值与最大格必须与 §E506 记录的基线
 *       （multi 5.3 ‖ long 12.3 ‖ 最大格 28% = 只枪压制）对上（均值 ±1.5pt、最大格同一格）。
 *       对不上 ⇒ 这台量具换了口径，整表作废（§E312 那条：复刻仪器要搬代码，锚点要搬读数）。
 *   (b) **噪声地板由实测给**：同一枚包在两粒 seed（90210 / 90211）上的六格均值之差 ⇒ 取这批的中位与 p90。
 *       任何"某维与人席相关"的结论，其**效应量必须大于这条地板**才许写。
 *   (c) 一条维**入围**⟺ `|ρ| ≥ 0.5` 且 Holm 校正后 `p ≤ 0.05` 且 **multi 与 long 两口径同号**。
 *       三条缺一就不列进清单。方向也要写：ρ 为负 = 该维越高，人类那一席赢得越少 = 这枚包越"不怕人"。
 *   (d) **分辨率印在数旁边**：n 由实到样本给，双侧 5% 的 `|ρ|` 临界用同一套蒙特卡洛置换算出来（不拍脑袋）。
 *       n=25 时这个临界大约在 0.4 ⇒ `|ρ| ∈ [0.4, 0.5]` 那一档只能写"有感、未入围"。
 *   (e) **三条正对照**（造不出能红的判据就别写它）：
 *       ① 随机自变量列（固定种子打乱）⇒ Holm 后必须**全部不显著**；出了显著就是判据有洞。
 *       ② 分数维 Hp ⇒ 应当 ≈0（复现 §E506 的 −0.030/+0.041）。这次若 `|ρ| ≥ 0.5` 说明我把两把尺接串了。
 *       ③ 把目标量按已知答案倒造（令 target = 该自变量本身）⇒ ρ 必须 = ±1.000 且 p = 最小值。
 *   (f) **名单数 vs 落盘数**：roster 的枚数 × 2 口径必须等于 tsv 行数；两批 seed 的名单必须逐枚相同。
 *
 * ⚠ 诚实声明：判据落笔时，第一批两枚（Ldemo / K2）的 stdout 已经在屏幕上出现过 ——
 *   其中 Ldemo 的 long 最大格 28% 正是 (a) 要验的那个历史基线，**这是设计好的锚点复现，不是挑出来的读数**。
 *   其余 23 枚在判据写完之前没有读过任何一格。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const rd = p => { const L = readFileSync(p.indexOf(':') >= 0 || p[0] === '/' ? p : join(HERE, p), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
  return { h: Object.fromEntries(L[0].split('\t').map((x, i) => [x, i])), rows: L.slice(1).map(l => l.split('\t')) }; };

const BEH = ['dmg', 'heavy', 'holo', 'rounds', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'Geff', 'seatSpread'];
const SCR = ['H', 'Hp', 'De'];
const TARGETS = ['六格均值(multi)', '六格均值(long)', '最大格(multi)'];   // 表里列名通用，口径在 mode 列
const BASE_LDEMO = { multi: 5.3, long: 12.3, 最大格: 28, 格: '只枪压制' };   // §E506 那次同 seed 90210 的基线

/* §E585：统计件抽到 `stats-lib.mjs`（同一份实现给逐格筛查复用，不抄第二份）。
 *   抽取的铁证是**抽取前后本文件的每个 ρ 与 p 逐值不变** —— 拿 §E576 在册读数对：
 *   heavy −0.663/−0.602 ‖ rounds 0.715/0.566 ‖ Geff −0.670/−0.414 ‖ 带内 H −0.036/−0.164。 */
import { mean, ranks, pear, sp, mcP, holm, rngSeed } from './stats-lib.mjs';
import { buildResolver, incumbentAt, resolveId } from './pack-resolve.mjs';
import { load as loadSlotId } from './slot-identity.mjs';

const A = rd(arg('a', 'seat-2026-10-11-90210.tsv'));
const Bt = rd(arg('b', 'seat-2026-10-11-90211.tsv'));
const C = rd('coords.tsv');
const B_ = Number(arg('B', 20000));
const rng0 = () => rngSeed(20261011);   /* ⚑ `rng0` 在原作者手里是**工厂**（每次调用发一条新流：rng0()），不是流本身
   —— 第一版我写成 `const rng0 = rngSeed(20261011)`，于是下面的 `rngD = rng0()` 拿到的是**一个数**而不是函数，
   跑起来才报 "rngD is not a function"。留着这句注释是因为"工厂 vs 流"这个区别下次还会咬人。 */

/* ---- (f) 名单与行数 ---- */
const idsOf = t => [...new Set(t.rows.map(r => r[t.h.id]))];
const ia = idsOf(A), ib = idsOf(Bt);
const 名单差 = ia.filter(x => ib.indexOf(x) < 0).concat(ib.filter(x => ia.indexOf(x) < 0));
console.log('# (f) 名单：A 批 ' + ia.length + ' 枚 ‖ B 批 ' + ib.length + ' 枚 ‖ 逐枚相同=' + (名单差.length === 0 && ia.length === ib.length) +
  (名单差.length ? ' ‖ 差集 ' + 名单差.join(',') : '') + ' ‖ 行数 A=' + A.rows.length + '（应 ' + ia.length * 2 + '）‖ B=' + Bt.rows.length);
if (名单差.length || A.rows.length !== ia.length * 2) { console.error('⛔ (f) 红 ⇒ 别判读'); process.exit(2); }

/* ---- 两批合并成一枚一行的人席读数 ---- */
/* ⚑ 身份必须走 coords 的 **path 列**，不是文件名 basename：那枚历史基线包在 coords 里曾叫 `SHIPPED-Ldemo`（折行后是副名），
 *   而探针打印的是 `js/bundled-champion-3p.js`（⇒ basename = `bundled-champion-3p`）。
 *   按 basename 接的话 Ldemo 会"不在 coords"，锚点与关联同时接错 —— 同 §E330 那条"人席参照必须从 path 列取"。 */
/* §E589：身份解析搬到 `pack-resolve.mjs` 那一份（**id 优先 → path 兜底 → 现役按 slot-history 声明认**）。
 *   为什么现役不能按 path 猜：§E588 把 `SHIPPED-Ldemo` 行的 path 改成钉住的快照之后，图上再没有一行的 path
 *   等于活槽，而活槽自己会换主人 ⇒ 只能按声明（`--incumbent=` 或 `slot-history.tsv`）。 */
const ROOTD = join(HERE, '..');
const SID = loadSlotId(ROOTD);   /* §E608：副名→主名与"活槽现主"的唯一翻译处 */
const INC = arg('incumbent', '') || (function () {
  const r = incumbentAt(ROOTD, [arg('a', 'seat-2026-10-11-90210.tsv'), arg('b', 'seat-2026-10-11-90211.tsv')]);
  console.log('# 现役身份：' + r.why);
  if (!r.id) { console.error('⛔ 现役认不出 ⇒ 不许猜，传 `--incumbent=<图上的行名>`'); process.exit(2); }
  return r.id;
})();
const RS = buildResolver(ROOTD, C.rows.map(r => ({ id: r[C.h.id], path: r[C.h.path] })), { incumbent: INC });
console.log('# ' + RS.liveNote);
const cellOf = (t, id, mode, col) => { const r = t.rows.filter(x => x[t.h.id] === id && x[t.h.mode] === mode)[0]; return r ? r[t.h[col]] : undefined; };
const pathOf = {}; for (const r of A.rows) pathOf[r[A.h.id]] = r[A.h.path];
const P = [];
for (const id of ia) {
  const rr = resolveId(RS, id, pathOf[id]);
  const cid = rr.id;
  if (rr.how.indexOf('共享') >= 0) console.log('  ⚠ ' + id + ' 的 path 去重后被多行共享 ⇒ 这一枚的身份不可靠');
  const crow = C.rows.filter(r => r[C.h.id] === cid)[0];
  if (!crow) { console.log('  ⚠ ' + id + '（coords id=' + cid + '）不在 coords ⇒ 无人席以外的维度读数，只进锚点/噪声，不进关联'); continue; }
  const g = k => Number(crow[C.h[k]]);
  const rec = { id: cid, 行为: {}, 分数: {} };
  for (const k of BEH) rec.行为[k] = g(k);
  for (const k of SCR) rec.分数[k] = g(k);
  /* 三个目标量各自的 A 批（seed 90210）与 B 批（90211）读数。⚑ 表里列名是**通用的** `六格均值`/`最大格`，
   *   口径在 `mode` 列上 —— 干跑时按 `multi六格均值` 取列拿到 undefined ⇒ 均值整片 NaN（这错是干跑抓的，不是判读时）。 */
  rec.multi_a = Number(cellOf(A, id, 'multi', '六格均值')); rec.multi_b = Number(cellOf(Bt, id, 'multi', '六格均值'));
  rec.long_a = Number(cellOf(A, id, 'long', '六格均值')); rec.long_b = Number(cellOf(Bt, id, 'long', '六格均值'));
  rec.最大格_a = Number(cellOf(A, id, 'multi', '最大格')); rec.最大格_b = Number(cellOf(Bt, id, 'multi', '最大格'));
  rec.最大格long_a = Number(cellOf(A, id, 'long', '最大格'));
  rec.锚_multimax = cellOf(A, id, 'multi', '最大格是谁'); rec.锚_longmax = cellOf(A, id, 'long', '最大格是谁');
  P.push(rec);
}

/* ---- (a) **仪器锚点**（这一条判的不是"谁是现役"）----
 *   `BASE_LDEMO` 是 §E506 那次同 seed 90210 的读数，而那次跑的包就是 `SHIPPED-Ldemo` ⇒ 锚必须钉在**那一枚**上。
 *   DS 交接件 §2 建议"问 live"，这一处**不采纳**：换成活槽 = 拿 T8-s114 的读数去比 Ldemo 的基线，
 *   要么永久红、要么有人把基线重钉一次 —— 那这条"同一台仪器"的自证就悄悄变成另一件事了（同 §E588 那批"历史锚不许动"）。
 *   真正要修的两件：① 折行之后 `SHIPPED-Ldemo` 只是**副名**（图上的行叫 `Ldemo`）⇒ 第一支现在恒空；
 *   ② 那条兜底是**正则**（`/bundled|Ldemo/`）而不是精确名 ⇒ 换个名字就悄悄换主语。
 *   ⚠ 我第一版改成"只准匹配解析出来的主名 `Ldemo`"，把这条判据做**红**了，而且**它红得不对**：
 *     这批 seat 表把活槽那枚按**文件名**记成 `bundled-champion-3p`，那记的是**跑这批的当天**（10-11）住在槽里的包 = Ldemo；
 *     今天再按 path 去解同一个名字会解成 T8-s114 ⇒ 拿"今天的活槽"对"Ldemo 的基线"必然对不上。
 *     ⇒ 锚点按**记录名精确匹配**（两支：面板主名 或 这批的记录名），并把这层时间差印出来。不许用宽松正则兜。 */
const ANCHOR_ID = (SID.resolve('SHIPPED-Ldemo') || 'SHIPPED-Ldemo');
const BATCH_NAME = 'bundled-champion-3p';   /* 这批表里"活槽那枚"的记录名（seat 表按文件名记，不按面板行 id 记） */
const L = P.filter(p => p.id === ANCHOR_ID)[0] || P.filter(p => p.id === BATCH_NAME)[0];
if (!L) { console.error('⛔ (a) 红：这一批里没有仪器锚点那枚（既没有主名 ' + ANCHOR_ID + '，也没有记录名 ' + BATCH_NAME + '）。\n' +
  '   为什么大概率就是这个结果：这批表把活槽那枚按文件名记成 `' + BATCH_NAME + '`，而 `resolveId` 今天按 path 把它解给**当下**住在槽里的 ' +
  ((SID.live && SID.live.coordsId) || '?') + ' ⇒ 行的**身份**换人了、行里的**读数**还是跑批那天那枚的（本表 multi/long/最大格 = 5.33/12.0/28.0，恰好是 §E506 给 Ldemo 记的基线）。\n' +
  '   ⇒ 这条仪器锚点只登记了 Ldemo 的基线：换现役之后要么补一份同 seed 的新基线（`BASE_LDEMO` 旁边加一档），要么明确"这条不适用"。\n' +
  '   **不许**拿 Ldemo 的基线判 ' + ((SID.live && SID.live.coordsId) || '今天的活槽') + '，也不许为此放宽本条。'); process.exit(2); }
console.log('# (a) 仪器锚点 = ' + L.id + '（§E506 基线那枚 = ' + ANCHOR_ID + '，副名 SHIPPED-Ldemo）‖ 活槽现主 = ' +
  ((SID.live && SID.live.coordsId) || '解不出') + ' ⇒ **不参与**这条判据（`' + BATCH_NAME + '` 记的是跑批当天住在槽里的那枚，不是今天这枚）');
/* §E506 那行基线说的是"最大格 28%（只枪压制 · long）"⇒ 锚点比的是 **long 口径的最大格**，不是 multi */
const 锚ok = Math.abs(L.multi_a - BASE_LDEMO.multi) <= 1.5 && Math.abs(L.long_a - BASE_LDEMO.long) <= 1.5 &&
  Math.abs(L.最大格long_a - BASE_LDEMO.最大格) <= 6 && L.锚_longmax === BASE_LDEMO.格;
console.log('# (a) 仪器锚点（§E506 基线那枚）：multi ' + L.multi_a + '（基线 ' + BASE_LDEMO.multi + '）‖ long ' + L.long_a + '（基线 ' + BASE_LDEMO.long +
  '）‖ long 最大格 ' + L.最大格long_a + ' 落在「' + L.锚_longmax + '」（基线 ' + BASE_LDEMO.最大格 + ' · ' + BASE_LDEMO.格 + '）‖ multi 最大格 ' + L.最大格_a + '（' + L.锚_multimax + '）⇒ ' +
  (锚ok ? '✅ 同一台仪器' : '⛔ 对不上 ⇒ 整表作废'));
if (!锚ok) process.exit(2);

/* ---- (b) 噪声地板 ---- */
const noiseFor = key => P.map(p => Math.abs(p[key + '_a'] - p[key + '_b'])).filter(v => isFinite(v)).sort((x, y) => x - y);
const NB = {}; for (const k of ['multi', 'long']) { const v = noiseFor(k); NB[k] = { p50: v[v.length >> 1], p90: v[Math.min(v.length - 1, Math.floor(0.9 * v.length))], n: v.length }; }
const rep = P.map(p => sp([p.multi_a, p.long_a], [p.multi_b, p.long_b]));
console.log('# (b) 两批同枚之差（100格/格的均值口径）：multi p50=' + NB.multi.p50 + ' p90=' + NB.multi.p90 +
  ' ‖ long p50=' + NB.long.p50 + ' p90=' + NB.long.p90 + ' ‖ n=' + NB.multi.n);
console.log('# (b) 附：两批之间的秩相关（仪器自己的复现性）中位 = ' + (rep.filter(v => isFinite(v)).sort((a, b) => a - b)[rep.length >> 1]).toFixed(3));

/* ---- (d) 分辨率 ---- */
const nS = P.length; const rr = []; const rngD = rng0();
for (let b = 0; b < 4000; b++) rr.push(Math.abs(sp([...Array(nS)].map(() => rngD()), [...Array(nS)].map(() => rngD()))));
rr.sort((a, b) => a - b);
console.log('# (d) n=' + nS + ' ‖ 双侧 5% 的 |ρ| 临界（蒙特卡洛 B=4000）≈ ' + rr[Math.floor(0.95 * rr.length)].toFixed(3) +
  ' ‖ 判据 (c) 的门槛是 0.5（写在跑前）');

/* ---- (c) 主筛查 ---- */
const DIMS = BEH.map(k => ['行为:' + k, k, 0]).concat(SCR.map(k => ['分数:' + k, k, 1]));
const tests = [];
for (const [label, k, isScore] of DIMS) {
  for (const t of [['multi', 'multi_a'], ['long', 'long_a']]) {
    const xs = [], ys = [];
    for (const p of P) { const x = (isScore ? p.分数[k] : p.行为[k]), y = p[t[1]]; if (isFinite(x) && isFinite(y)) { xs.push(x); ys.push(y); } }
    if (xs.length < 8) continue;
    tests.push({ 维: label, 口径: t[0], n: xs.length, rho: sp(xs, ys), p: mcP(xs, ys, B_, rng0()) });
  }
}
/* 同号判定：同一维两口径都要过 (c) 的三条 */
const adjAll = holm(tests.map(x => x.p));
for (let i = 0; i < tests.length; i++) tests[i].holm = adjAll[i];
const byDim = {};
for (const t of tests) (byDim[t.维] = byDim[t.维] || []).push(t);
console.log('\n===== §E576 哪一维对人席付账（目标 = 人类那一席的夺冠率，越低越好）=====');
console.log('维 | n | ρ(multi) p_holm | ρ(long) p_holm | 两口径同号 | 判');
const 清单 = [];
for (const dim in byDim) {
  const a = byDim[dim].filter(t => t.口径 === 'multi')[0], b = byDim[dim].filter(t => t.口径 === 'long')[0];
  if (!a || !b) continue;
  const same = isFinite(a.rho) && isFinite(b.rho) && Math.sign(a.rho) === Math.sign(b.rho);
  const pass = same && [a, b].every(t => Math.abs(t.rho) >= 0.5 && t.holm <= 0.05);
  const mid = Math.max(Math.abs(a.rho), Math.abs(b.rho)) >= 0.4;
  if (/^分数:/.test(dim)) console.log(dim + ' | ' + a.n + ' | ' + a.rho.toFixed(3) + ' p=' + a.holm.toFixed(3) + ' | ' + b.rho.toFixed(3) +
    ' p=' + b.holm.toFixed(3) + ' | ' + (same ? '同' : '异') + ' | 对照（(e)② 要求 ≈0，实测 |ρ|max=' + Math.max(Math.abs(a.rho), Math.abs(b.rho)).toFixed(3) +
    (Math.max(Math.abs(a.rho), Math.abs(b.rho)) >= 0.5 ? ' ⇒ ⛔ 接线可疑' : ' ⇒ ✅') + '）');
  else console.log(dim + ' | ' + a.n + ' | ' + a.rho.toFixed(3) + ' p=' + a.holm.toFixed(3) + ' | ' + b.rho.toFixed(3) + ' p=' + b.holm.toFixed(3) +
    ' | ' + (same ? '同' : '异') + ' | ' + (pass ? '入围' : mid ? '有感、未入围' : '不列'));
  if (pass) 清单.push(dim);
}
console.log('\n入围清单（判据 c 三条全过）：' + (清单.length ? 清单.join(' ‖ ') : '（空）'));

/* ---- (e) 三条正对照 ---- */
const rngC = rng0();
let 随机显著 = 0, 随机表 = [];
for (const t of ['multi_a', 'long_a']) {
  const xs = P.map(() => rngC()), ys = P.map(p => p[t]);
  const rho = sp(xs, ys), p = mcP(xs, ys, B_, rngC); 随机表.push(rho.toFixed(3) + '/p=' + p.toFixed(3));
  if (p <= 0.05) 随机显著++;
}
/* ---- (e)② 正对照亮了之后的**诊断**（写在这里是在第二粒 seed 落地之前，不是看完数再补的解释）----
 * 预登记的 (e)② 说"分数维应当 ≈0，|ρ| ≥ 0.5 ⇒ 接线可疑"。**这个前提本身可能是错的**：
 *   §E506 那 24 粒是**同一配方的续训臂**，分数带很窄（页面 42~64），那是"截断范围"下的相关；
 *   本轮抽样框按行为空间最远点铺，Hp 从 ~10 一路到 ~61 —— 范围一大，"烂包在每把尺上都烂"完全可以显出相关。
 * 所以红了先问该不该红：同一段分数带内（Hp ≥ 40，对齐 §E506 那批）重算一次。
 *   带内若回落到 ≈0 ⇒ 亮的是**框**、不是接线；带内仍 ≥0.5 ⇒ 接线真的有嫌疑，本轮判读降级为"待复跑"。
 * ⚠ 这是诊断，不是把判据改松：主表与入围清单仍按跑前的 (c)/(e) 印。 */
const 段 = P.filter(p => isFinite(p.分数.Hp) && p.分数.Hp >= 40);
const rngB = rng0();
console.log('\n----- 诊断（(e)② 亮了之后）-----');
console.log('# 全框 Hp 范围 ' + Math.min.apply(null, P.map(p => p.分数.Hp)).toFixed(1) + '~' +
  Math.max.apply(null, P.map(p => p.分数.Hp)).toFixed(1) + ' ‖ 同段（Hp ≥ 40）n=' + 段.length);
for (const k of ['H', 'Hp']) {
  const row = [];
  for (const t of ['multi_a', 'long_a']) {
    const xs = [], ys = [];
    for (const p of 段) if (isFinite(p.分数[k]) && isFinite(p[t])) { xs.push(p.分数[k]); ys.push(p[t]); }
    row.push(t.slice(0, 5) + ' ρ=' + sp(xs, ys).toFixed(3) + ' p=' + mcP(xs, ys, B_, rngB).toFixed(3) + '（n=' + xs.length + '）');
  }
  console.log('# 带内 ' + k + ' ↔ 人席：' + row.join(' ‖ '));
}
const idl = P.map(p => p.行为.dmg), per = sp(idl, P.map(p => p.行为.dmg));
/* 置换 p 函数自己的已知答案（§E572 那次"尾数写成累积分布"的教训的延续）：完美同序的 p 必须是尾数最小值。 */
const pPer = mcP(idl, P.map(p => p.行为.dmg), 2000, rng0());
console.log('# (e) ① 随机自变量列 ⇒ ' + 随机表.join(' ‖ ') + '（期望 ' + (2 * 0.05).toFixed(2) + ' 个显著/2 检验，实测 ' + 随机显著 + '）' +
  (随机显著 > 1 ? ' ⛔ 判据有洞' : ' ✅'));
console.log('# (e) ③ 自造完美（dmg 对 dmg）⇒ ρ 必须 = 1.000（实测 ' + per.toFixed(3) + '）‖ 同一列的置换 p 必须是尾数最小值（实测 ' +
  pPer.toFixed(5) + '，B=2000 ⇒ 期望 ≈0.0005）⇒ ' + (per === 1 && pPer <= 0.001 ? '✅' : '⛔ p 的尾数方向可疑，判读作废'));
process.exit(0);
