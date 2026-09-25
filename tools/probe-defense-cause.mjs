/* 「碰到一个人攒钱就开始疯狂防御」—— 把这句话拆成**可判的两个问题**（09-25 凌晨 · Qoder · 只读）
 *
 * 用户 09-24 实机报的病。`probe-layer-caliber` 已经量到"设防只在产品口径下出现"（ε=0 那边是 0%），
 * 但那一句**没有回答用户真正说的因果**："是**因为**对方在攒钱吗？"以及"是不是**维持很久**？"
 *   ⇒ 现有单一真源 `fieldRate('active')` 的威胁判据是"对手席累计 ep≥5"（一个粗二值），它给出的
 *      "无威胁时设防率 ≈ 总体设防率"只是**没相关**的证据，不是**因果方向**的证据。这里把它按 ep 分桶重量。
 *
 * 装配：1 席"攒钱替身"（只会出ジ攒 ep，或在买得起时打一张攻击卡 ⇒ ep 单调涨）+ 4 席被评包。
 *   每回合记：**该回合开始时**对手席的 ep（不是决策时点之后）→ 分桶 → 数那 4 席里"设防类（`R.CAT.DEFENSE`）出手"的占比，
 *   并数**同一席连续设防的最长回合数**（"维持很久"的那半）。
 * 口径：默认产品口径（`--eps=0.2 --epsk=5 --epsmode=soft`）；`--eps=0` 可回读门禁那一侧作对照。
 *
 * 用法：node tools/probe-defense-cause.mjs [--packs=js/bundled-champion-3p.js] [--games=200] [--eps=0.2]
 */
import { readFileSync } from 'node:fs';
import { build } from './probe-layer-caliber.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
const PACKS = arg('packs', 'js/bundled-champion-3p.js,docs/artifacts/cbs1s2-band2.bak').split(',');
const GAMES = Number(arg('games', 200));
const TEMP = Number(arg('temp', 0.15)), EPS = Number(arg('eps', 0.2)), EPSK = Number(arg('epsk', 5)), EPSMODE = arg('epsmode', 'soft');
const SEED0 = Number(arg('seed', 4100));
const BMIN = Number(arg('bucket-min', 40));
/* 攒钱替身有两种，**分开读才分得清"有钱"与"有威胁"**：
 *   `hold`（默认）= 永远出ジ ⇒ ep 真会堆起来（用户看到的就是这种"一个人在攒钱"）；
 *   `spend` = 买得起攻击卡就打 ⇒ ep 永远停在 0~1（前一版量出来就是这个，所以那一版**根本没法回答因果问**）。 */
let SAVER = arg('saver', 'hold');
/* `--pair=1`：同一次调用里把 `hold` 与 `cycle` **两档都跑**，末尾输出"同回合配对表"（= 因果那一问的正式判据）。
 *   为什么要内置：09-25 的 E14 只跑了 `hold` 一档就把"倍差≥2"当体质流行率报出去，补跑 `cycle` 配对后
 *   81% 的标记不再复现（它们是"晚局龟"）⇒ 单档比值**不构成因果证据**（METHODOLOGY 64），两档得一起跑。 */
const PAIR = arg('pair', '') === '1';
const SAVES = PAIR ? ['hold', 'cycle'] : [SAVER];
const CURVES = [];
const CYCLE_AT = Number(arg('cycle-at', 4));
/* 高桶天然稀疏（攒钱替身买得起就打 ⇒ ep 很少堆到 10 以上）⇒ 桶要能**自适应合并**，否则高桶永远是 n<20 的噪声 */
const BASE_BUCKETS = [[0, 1, 'ep 0~1'], [2, 4, 'ep 2~4'], [5, 9, 'ep 5~9（大雷门槛到 9）'], [10, 1e9, 'ep ≥10']];
const BUCKETS = [];

const mul = function (a) { a >>>= 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pct = function (x, n) { return (100 * x).toFixed(1) + '%（n=' + n + '）'; };
const QUIET = arg('quiet', '') === '1';   // 一粒一行，用于跨包筛（配合 `--sweep`）

const SWEEP = [];
console.log('# 「攒钱→防御」这条因果，按**对手 ep 分桶**重量（装配：1 席攒钱替身 + 4 席被评包 · ' + GAMES + ' 局 · ' +
  (EPS === 0 ? '评测口径 ε=0' : '产品口径 ε=' + EPS + ' k=' + EPSK + ' ' + EPSMODE) + ' · 只读）');
console.log('# 桶变量 = **被评席做那次决策的当下**对手手里的 ep（`state.p[0].ep` 实读，**不从事件流重建**）⇒ 这才是这只包"看得见"的钱。');
console.log('# 攒钱替身 = `' + SAVER + '`（hold=永远出ジ、钱一路堆；cycle=堆到 ' + CYCLE_AT + ' 就全花掉 ⇒ ep 绕圈）· ' +
  (EPS === 0 ? '评测口径 ε=0' : '产品口径 ε=' + EPS + ' k=' + EPSK + ' ' + EPSMODE) + '\n');
console.log('# 为什么两档要一起跑：`hold` 里 ep 与回合号是**同一条轴**（第 r 回合 ep≈r−1）⇒ 单跑它只能说"越晚越不防"，分不开"钱"与"晚"。');
console.log('# `cycle` 把 ep 压回 0~' + (CYCLE_AT - 1) + '，于是"**同一回合号、不同 ep**"的配对比较成为可能 —— 那才是因果那一问的判据。\n');

const SKIP = [];
for (const SAV of SAVES) {
  SAVER = SAV;
for (const f0 of PACKS) {
  const f = f0;
  /* `.bak` 在 `docs/artifacts/` 里**不全是冠军包**（实测有 `index-html-before-ab*.bak` 是 index.html 的备份）
   *   ⇒ 扫池子的工具必须**先认货再装载**，否则一粒非包文件会把整场筛作废（E12 第一次就跑崩在第 159 个上）。 */
  let head = '';
  try { head = readFileSync(f, 'utf8').slice(0, 4000); }
  catch (e) {
    /* ⚠️ 只吞"文件系统级"的错误（ENOENT/EISDIR/...）。03:30 的实测教训：我加这道过滤时**忘了 import `readFileSync`**，
     *   于是 ReferenceError 也被这个 catch 吃掉 ⇒ 200 粒全被判成"读不动"、SWEEP 全空、**退出码还是 0**。
     *   ⇒ 宽 catch 会把编程错误洗成"数据问题"；这里改成只认 e.code，其余一律往上抛。 */
    if (!e || !e.code) throw e;
    SKIP.push(f + '（读不动：' + e.code + '）'); continue;
  }
  if (head.indexOf('window.EPIRUS_CHAMPION') < 0) { SKIP.push(f + '（非冠军包备份）'); continue; }
  const ctx = build({ on: EPS > 0, pack: f, temp: TEMP, eps: EPS, epsK: EPSK, epsMode: EPSMODE });
  if (EPS > 0 && ctx.patched !== ctx.hardwired) { console.log('⛔ 口径搬运自检失败（' + ctx.patched + '/' + ctx.hardwired + '）'); process.exit(9); }
  const R = ctx.sb.EpirusRules, S = ctx.sb.EpirusState, T = ctx.sb.EpirusTrainer, Play = ctx.sb.EpirusPlay, P = ctx.sb.EpirusPolicy;
  const params = P.unpack(ctx.sb.EPIRUS_CHAMPION_3P, true) || P.unpack(ctx.sb.EPIRUS_CHAMPION, true);
  if (!params) { console.log('⚠️ ' + f + ' 解不出参数'); continue; }
  const bs = T.policyChooserN(params, TEMP, EPS, EPSK, EPSMODE);
  const DEF = R.CAT.DEFENSE;
  const isDef = function (key) { const d = R.byKey[key]; return !!(d && d.cat === DEF); };
  const localB = BASE_BUCKETS.slice();
  const st2 = {};   // bucket 名 -> {def, tot}
  for (const b of localB) st2[b[2]] = { def: 0, tot: 0, uDef: 0, uTot: 0, rdSum: 0, rdN: 0 };
  let maxRunAll = 0, gamesWithRun3 = 0, gamesWithRun5 = 0;
  const ALL = [];
  /* 玩家体验那一侧：这只包把"有人攒钱"的局拖成什么样（局长 / 平局率 / 那个攒钱的人赢没赢）
   *   ⇒ 病要能落到"玩家会不会遇到"才有意义，光有设防率不足以说明代价。 */
  const GAMEO = [];
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: mul(SEED0 + g * 7919) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    /* 攒钱替身三档（`--saver`）：`hold`=永远出ジ（钱一路堆，默认）；`cycle`=堆到 `--cycle-at` 才全花掉（把 ep 钉住，用来做同回合配对）；
     *   其它值＝`spend`（买得起攻击卡就打）。⚠️ 只有 `hold` 里 ep 才与回合号同轴 ⇒ 判因果必须至少跑 `hold` 与 `cycle` 两档。 */
    const ATK = [R.SK.GUN, R.SK.SWORD, R.SK.SNIPE, R.SK.TANK];
    const rr = mul(SEED0 + g * 7919 + 1);
    const REC = [];   // 本局所有"被评席决策"的快照：{rd, pid, ep0(对手**当下**的 ep), key, unhurt}
    const LASTHP = {};
    const saver = function (state, pid, legal) {
      const mine = state.p[pid];
      if (SAVER === 'hold') return { key: R.SK.JI };            // 纯攒：钱堆着不花
      if (SAVER === 'cycle' && (mine ? mine.ep || 0 : 0) < CYCLE_AT) return { key: R.SK.JI };   // 没堆够就继续攒
      const a = legal.filter(function (l) { return l.affordable && ATK.indexOf(l.key) >= 0; });
      if (!a.length) return { key: R.SK.JI };
      const o = S.opponentsOf(state, pid);
      return { key: a[0].key, target: o[Math.floor(rr() * o.length)] };
    };
    const ch = [function (s2, p2, lg) { return saver(s2, p2, lg); }];
    /* ⚠️ 口径修正（01:35 自查，D151 的第一版就是被这件事逼出来的）：**不许从事件流重建 ep**。
     * 前一版是"`ep` 事件 `delta>0` 前缀和"，那算的是"对手**历史累计挣到**过多少"——**花了不扣**，
     * 而攒钱替身买得起攻击卡时是真会花的（实测第 3 回合它手里是 0）⇒ 前一版把桶名写成了"对手 ep"是**错的**，
     * 而且顺带造出一个假象："ep 随回合单调涨 ⇒ 高桶≈晚期桶"。
     * ⇒ 现在直接在**被评席做决策的那一刻**读 `state.p[0].ep`（这才是这只包看得见的量），回合号用 `state.round`（实测单调）。 */
    for (let i = 1; i < 5; i++) ch.push(function (s2, p2, lg) {
      const pick = bs(s2, p2, lg);
      const opp = s2.p[0], me = s2.p[p2];
      /* 配对之外还要**钉住"被打过"这条混淆**：`cycle` 档的对手每几回合真会打出一发，`hold` 档从不打
       *   ⇒ 两档在同一回合号上的差，可能有一部分是"被攻击过所以防"。修法：记录该席**上次决策到现在的净掉血**，
       *   再单独印"没掉过血"子样本的设防率（那才是只随对手 ep 动的那一半）。 */
      const hpNow = me ? (me.hp || 0) : 0;
      const dHp = (LASTHP[p2] === undefined) ? 0 : (hpNow - LASTHP[p2]);
      LASTHP[p2] = hpNow;
      REC.push({ rd: s2.round, pid: p2, ep0: opp ? (opp.ep || 0) : 0, key: pick.key, unhurt: dHp >= 0 });
      return pick;
    });
    Play.autoGameN(st, ch);
    /* 按"该席在该回合的这一次决策"归桶；连续设防按 (席, 回合) 严格相邻计 */
    const runPerSeat = {};
    const lastRd = {};
    let runThisGame = 0;
    for (const d of REC) {
      const bk = localB.filter(function (b) { return d.ep0 >= b[0] && d.ep0 <= b[1]; })[0];
      if (!bk) continue;
      const cell = st2[bk[2]];
      const def = isDef(d.key);
      cell.tot++; cell.rdSum += d.rd; cell.rdN++;
      if (d.unhurt) { cell.uTot++; if (def) cell.uDef++; }
      ALL.push({ rd: d.rd, def: def, ep0: d.ep0, unhurt: d.unhurt });
      if (def) {
        cell.def++;
        const prev = lastRd[d.pid];
        runPerSeat[d.pid] = (prev !== undefined && d.rd === prev + 1) ? (runPerSeat[d.pid] || 1) + 1 : 1;
        lastRd[d.pid] = d.rd;
        if (runPerSeat[d.pid] > runThisGame) runThisGame = runPerSeat[d.pid];
      } else { runPerSeat[d.pid] = 0; lastRd[d.pid] = d.rd; }
    }
    GAMEO.push({ rounds: st.round, winner: st.winner, draw: (st.winner === 'draw' || st.winner == null) });
    if (runThisGame >= 3) gamesWithRun3++;
    if (runThisGame >= 5) gamesWithRun5++;
    if (runThisGame > maxRunAll) maxRunAll = runThisGame;
  }
  /* 合并：从最高的两桶开始往下并，直到**除最后一桶外**每桶 n≥BMIN（并完仍不足就如实报"分母不足"） */
  const byRound = {};
  for (const d of ALL) { const k = d.rd; if (!byRound[k]) byRound[k] = { def: 0, tot: 0, ep: 0, uDef: 0, uTot: 0 };
    byRound[k].tot++; byRound[k].def += d.def ? 1 : 0; byRound[k].ep += d.ep0;
    if (d.unhurt) { byRound[k].uTot++; byRound[k].uDef += d.def ? 1 : 0; } }
  CURVES.push({ pack: f0.replace(/^.*[\/]/, '').replace(/\.(bak|js)$/, ''), saver: SAVER, byRound: byRound });
  console.log('   按回合号的曲线（`--pair` 就是比这条）：' +
    Object.keys(byRound).map(Number).sort(function (a, b) { return a - b; }).slice(0, 14).map(function (r) {
      const c = byRound[r]; return 'r' + r + ' ' + (100 * c.def / c.tot).toFixed(1) + '%(ep' + (c.ep / c.tot).toFixed(1) + ')';
    }).join(' · '));
  console.log('   └ 同一曲线、但**只取"自上次决策以来没掉过血"的那些决策**（钉住"被打过"这条混淆）：' +
    Object.keys(byRound).map(Number).sort(function (a, b) { return a - b; }).slice(0, 14).map(function (r) {
      const c = byRound[r];
      return 'r' + r + ' ' + (c.uTot >= 20 ? (100 * c.uDef / c.uTot).toFixed(1) + '%' : '—') + '(n' + c.uTot + ')';
    }).join(' · '));
  const cells = localB.map(function (b) { const c = st2[b[2]] || { def: 0, tot: 0, rdSum: 0, rdN: 0 };
    return { lo: b[0], hi: b[1], parts: [b[2] + '(n=' + c.tot + ')'], def: c.def, tot: c.tot, uDef: c.uDef, uTot: c.uTot, rdSum: c.rdSum, rdN: c.rdN }; });
  /* 空桶（n=0）先丢掉再谈合并：把 n=0 并进上一桶只会造出一串读不懂的嵌套名字 */
  for (let i = cells.length - 1; i >= 1; i--) if (cells[i].tot === 0) cells.splice(i, 1);
  let merged = 0;
  while (cells.length > 2 && cells[cells.length - 1].tot < BMIN) {
    const last = cells.pop(), prev = cells[cells.length - 1];
    prev.hi = last.hi; prev.def += last.def; prev.tot += last.tot; prev.rdSum += last.rdSum; prev.rdN += last.rdN;
    prev.uDef += last.uDef; prev.uTot += last.uTot;
    prev.parts.push(last.parts.join('+'));
    prev.name = 'ep ' + prev.lo + '~' + (prev.hi >= 1e9 ? '∞' : prev.hi);
    merged++;
  }
  for (const c of cells) if (!c.name) c.name = 'ep ' + c.lo + '~' + (c.hi >= 1e9 ? '∞' : c.hi);
  console.log('## ' + f.replace(/^.*[\/]/, '').replace(/\.bak$/, '') + '（受评 4 席 · 出手事件 ' +
    cells.reduce(function (a, b) { return a + b.tot; }, 0) + ' 次' + (merged ? ' · 高桶自适应合并 ' + merged + ' 次（阈值 n≥' + BMIN + '）' : '') + '）');
  for (const b of cells) {
    const c = b;
    const nm = b.name;
    console.log('   对手 ' + (nm + (merged && c.parts && c.parts.length > 1 ? ' ⟵并入 ' + c.parts.slice(1).join('、') : '')).padEnd(24) + ' 该桶设防率 ' + (c.tot ? pct(c.def / c.tot, c.tot) : '—（n=0）').padEnd(22) +
      (c.tot < BMIN ? ' ⚠️ 该桶分母 < ' + BMIN : '') +
      '   该桶平均回合 ' + (c.rdN ? (c.rdSum / c.rdN).toFixed(1) : '—') +
      '   ｜钉住"没掉过血"的子样本 ' + (c.uTot >= 40 ? (100 * c.uDef / c.uTot).toFixed(1) + '%（n=' + c.uTot + '）' : '—（n=' + c.uTot + '，不足 40）'));
  }
  const rdArr = GAMEO.map(function (x) { return x.rounds; }).sort(function (a, b) { return a - b; });
  const drawN = GAMEO.filter(function (x) { return x.draw; }).length;
  const saverWin = GAMEO.filter(function (x) { return x.winner === 0; }).length;
  console.log('   玩家侧代价（攒钱那位=0 号席）：局长中位 ' + (rdArr.length ? rdArr[rdArr.length >> 1] : '—') +
    ' 回合（p90 ' + (rdArr.length ? rdArr[Math.floor(0.9 * rdArr.length)] : '—') + ' · 上限 47）· 平局率 ' +
    (100 * drawN / Math.max(1, GAMEO.length)).toFixed(0) + '% · 攒钱者夺冠 ' + (100 * saverWin / Math.max(1, GAMEO.length)).toFixed(1) + '%（' + GAMEO.length + ' 局）');
  console.log('   "维持很久"那半：全表最长**同一席连续设防** ' + maxRunAll + ' 回合 · 出现 ≥3 连的局 ' +
    (100 * gamesWithRun3 / GAMES).toFixed(1) + '% · ≥5 连 ' + (100 * gamesWithRun5 / GAMES).toFixed(1) + '%（' + GAMES + ' 局）');
  const hi = cells[cells.length - 1], lo = cells[0];
  const rat = function (c) { return c.tot >= 40 ? c.def / c.tot : null; };
  const rh = rat(hi), rl = rat(lo);
  if (QUIET) {
    const f1 = function (c) { return c && c.tot >= 40 ? (100 * c.def / c.tot) : NaN; };
    const r2 = f1(cells[1]), r5 = cells.filter(function (c) { return c.lo === 5; })[0], r10 = cells.filter(function (c) { return c.lo === 10; })[0];
    SWEEP.push({ pack: f.replace(/^.*\//, '').replace(/\.bak$/, ''), lo: f1(cells[0]), mid: f1(r5), hi: f1(r10),
      ratio: (isFinite(f1(cells[0])) && f1(cells[0]) > 0 && isFinite(f1(r10) - 0) ? f1(r10) / f1(cells[0]) : NaN),
      maxRun: maxRunAll, run3: 100 * gamesWithRun3 / GAMES, tot: cells.reduce(function (a, c) { return a + c.tot; }, 0),
      medRound: rdArr.length ? rdArr[rdArr.length >> 1] : 0, saverWin: 100 * saverWin / Math.max(1, GAMEO.length) });
  }
  console.log('   ⇒ 判读：' + (rh == null || rl == null
    ? '**分母不足**（高桶或低桶 n<40）⇒ 这条因果**没量到**，不是"没有因果"'
    : (rh >= 2 * Math.max(rl, 0.001) ? '高 ep 桶设防率是低桶的 ' + (rh / Math.max(rl, 1e-9)).toFixed(1) + ' 倍 ⇒ **用户说的方向成立**'
      : '高桶反而不比低桶高（' + (100 * rh).toFixed(1) + '% vs ' + (100 * rl).toFixed(1) + '%）⇒ 这条分桶**不支持**"因为对方攒钱"')));
  const rdGap = (hi.rdN && lo.rdN) ? Math.abs(hi.rdSum / hi.rdN - lo.rdSum / lo.rdN) : 1e9;
  console.log('   ⚠️ 单跑这一档**答不了因果**：本档里 ep 与回合号是同一条轴（最高桶与最低桶的平均回合差 ' + (rdGap >= 1e8 ? '—（分母不足）' : rdGap.toFixed(1)) + ' 回合）。' +
    '⇒ 判"是不是因为对方有钱"要看上面那条**按回合号的曲线**，并与另一档（`--saver=cycle`：钱被压住）在**同一回合号**上对照。');
}
}   /* ← 收 `for (const SAV of SAVES)`：两档模式下这里换档 */

if (QUIET && SKIP.length && !SWEEP.length) {
  console.log('\n## 一粒都没量到（跳过 ' + SKIP.length + ' 粒）⇒ 这不是"没有体质"，是没跑成，非零退出');
  console.log('   跳过原因：' + SKIP.slice(0, 8).join('、'));
  process.exit(6);
}
if (QUIET && SWEEP.length) {
  /* 跨包筛：**按"响应倍差"降序**（倍差 = `ep≥10` 设防率 / `ep0~1` 设防率，只看两桶分母都 ≥40 的）
   * ⇒ 倍差大 = 会因对方有钱而转防（v1.5.210 那粒候选的病）；倍差≤1 且连防短 = 无此响应 */
  SWEEP.sort(function (a, b) { return (b.ratio || 0) - (a.ratio || 0); });
  console.log('\n## 跨包筛（' + SWEEP.length + ' 粒 · ' + GAMES + ' 局/粒 · saver=' + SAVER + ' · 按"有钱→转防"倍差降序）');
  console.log('   包'.padEnd(24) + 'ep0~1'.padStart(8) + 'ep5~9'.padStart(8) + 'ep≥10'.padStart(8) + '倍差'.padStart(7) + '连防'.padStart(6) + '≥3连%'.padStart(7) + '局长'.padStart(6) + '攒钱赢%'.padStart(9) + '  备注');
  for (const r of SWEEP) {
    const num = function (x) { return isFinite(x) ? x.toFixed(1) + '%' : '—'; };   // f1 已经是百分数，别再乘 100
    console.log('   ' + r.pack.slice(0, 22).padEnd(23) + num(r.lo).padStart(8) + num(r.mid).padStart(8) + num(r.hi).padStart(8) +
      (isFinite(r.ratio) ? r.ratio.toFixed(2) : '—').padStart(7) + String(r.maxRun).padStart(6) + r.run3.toFixed(0).padStart(7) +
      String(r.medRound || 0).padStart(6) + (r.saverWin || 0).toFixed(0).padStart(8) +
      '  ' + (isFinite(r.ratio) && r.ratio >= 2 && r.hi >= 20 ? '⚠ 有钱→转防' : (isFinite(r.ratio) && r.ratio >= 1.5 ? '轻微' : '无响应')));
  }
  const bad = SWEEP.filter(function (r) { return isFinite(r.ratio) && r.ratio >= 2 && r.hi >= 20; });
  if (SKIP.length) console.log('   ⚠️ 跳过 ' + SKIP.length + ' 个非包/读不动的 .bak：' + SKIP.slice(0, 6).map(function (x) { return x.replace(/^.*[\/]/, ''); }).join('、') + (SKIP.length > 6 ? '…' : ''));
  console.log('   ⇒ ' + bad.length + '/' + SWEEP.length + ' 粒有"对手有钱→转防"的响应（倍差≥2 且高桶设防率≥20%）：' +
    (bad.length ? bad.map(function (r) { return r.pack + '(' + r.ratio.toFixed(1) + '×)'; }).join('、') : '无'));
  console.log('   ⚠️ 这张表**不是判据**：它只用来在"过门/破防"之外再筛一遍，最终换槽仍需用户裁定与 `promote --dry` 全套。');
}

/* ===== `--pair=1` 的正式输出：同回合配对表 = 因果那一问的判据（E15 · 09-25）=====
 * 为什么内置：E14 只跑 `hold` 一档，把"倍差≥2"当体质流行率报了出去；补跑 `cycle` 同回合配对后八成标记不再复现
 *   ⇒ 单档比值把"时间轴"记到了"钱"头上（METHODOLOGY 64）。所以配对必须是**一条命令**，不能靠人眼比两根曲线。*/
if (PAIR) {
  const dv = function (c) { return (c && c.tot) ? 100 * c.def / c.tot : NaN; };
  const byPack = new Map();
  for (const c of CURVES) { if (!byPack.has(c.pack)) byPack.set(c.pack, {}); byPack.get(c.pack)[c.saver] = c.byRound; }
  console.log('\n## 同回合配对（`hold`=钱一路堆 vs `cycle`=堆到 ' + CYCLE_AT + ' 就全花掉 ⇒ ep 钉在 0~' + (CYCLE_AT - 1) + '）· 同种子同局数 ⇒ 两档唯一变量是"对手手里的钱"');
  console.log('#   placebo 窗 = r1~r5（两档 ep 还没分岔，读数**必须逐字相同**，否则这副替身作废）；净效应窗 = r6~r14（每回合两侧分母都 ≥20 才算）');
  console.log('   包                       placebo   hold均%  cycle均%    Δpt    倍差   型');
  const rowsP = []; let badPlacebo = 0, missing = 0;
  for (const ent of byPack) {
    const p = ent[0], H = ent[1].hold, C = ent[1].cycle;
    if (!H || !C) { missing++; console.log('   ' + p.padEnd(24) + '⚠️ 缺档（只跑到 ' + (H ? 'hold' : 'cycle') + '）⇒ 这一粒配对不成立'); continue; }
    let same = 0, tot = 0, sH = 0, sC = 0, n = 0;
    for (let r = 1; r <= 5; r++) { const a = dv(H[r]), b = dv(C[r]); if (isFinite(a) && isFinite(b)) { tot++; if (Math.abs(a - b) < 0.15) same++; } }
    for (let r = 6; r <= 14; r++) { const x = H[r], y = C[r]; if (x && y && x.tot >= 20 && y.tot >= 20) { sH += 100 * x.def / x.tot; sC += 100 * y.def / y.tot; n++; } }
    if (!tot || !n) { console.log('   ' + p.padEnd(24) + '⚠️ 分母不足（placebo 窗 ' + tot + ' / 净效应窗 ' + n + '）⇒ 不下判定'); continue; }
    if (same !== tot) badPlacebo++;
    const mH = sH / n, mC = sC / n, dlt = mH - mC;
    rowsP.push({ p: p, same: same, tot: tot, mH: mH, mC: mC, dlt: dlt, ratio: mC > 0.05 ? mH / mC : NaN,
      type: dlt >= 15 ? (mC < 25 ? 'A 钱驱动' : 'B 钱+晚局') : 'C 回合日程为主' });
  }
  rowsP.sort(function (a, b) { return b.dlt - a.dlt; });
  for (const r of rowsP) {
    console.log('   ' + r.p.slice(0, 22).padEnd(24) + (r.same + '/' + r.tot + (r.same === r.tot ? ' ✓' : ' ⚠️')).padEnd(11) +
      r.mH.toFixed(1).padStart(7) + '  ' + r.mC.toFixed(1).padStart(8) + '  ' + ((r.dlt >= 0 ? '+' : '') + r.dlt.toFixed(1)).padStart(7) +
      '  ' + (isFinite(r.ratio) ? r.ratio.toFixed(2) : '—').padStart(6) + '   ' + r.type);
  }
  const cnt = t => rowsP.filter(r => r.type === t).length;
  console.log('   ⇒ 分型：A 钱驱动 ' + cnt('A 钱驱动') + ' · B 钱+晚局双重 ' + cnt('B 钱+晚局') + ' · C 回合日程为主 ' + cnt('C 回合日程为主') +
    '（Δ≥15pt 是**约定线**不是数据给的 ⇒ 要换门槛请用上面两列自己重算）');
  console.log('   ' + (badPlacebo || missing
    ? '⚠️ placebo 自检**没全过**：' + badPlacebo + ' 粒在两档不该分岔的回合上已不同' + (missing ? '，另有 ' + missing + ' 粒缺档' : '') + ' ⇒ 判定前先查两档的 `--seed/--games` 是否一致'
    : '✓ placebo 自检通过：' + rowsP.length + ' 粒在两档 ep 未分岔的回合上读数逐字相同'));
  console.log('   ⚠️ 只跑 `hold` 一档读出的"倍差≥2"**不能当体质流行率**：E18 实测其中约八成在配对后掉到 Δ<15pt（METHODOLOGY 64）。');
}
