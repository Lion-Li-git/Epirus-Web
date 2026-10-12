#!/usr/bin/env node
/* probe-pool.mjs —— **池形态的那把新尺**（§E590 · 契约见 `docs/POOL-CONTRACT.md` §5）
 *
 * 为什么不能拿旧尺直接量池：仓里每一把 5 人尺的装配都写死"1 席人 + 4 席**同一枚**包"
 *   （`probe-human-seat` 的 `duelAssembly(..., params, ...)`、`skill-report` 的 `--champ=` 单数、
 *    `usage-probe` 的镜像五席、`duel-run` 的 `field:[nm,nm,nm,nm]`）。改成逐席不同枚之后
 *   这些尺量到的不是同一个产品 ⇒ **旧尺缺省一律不动**（在册读数还要能引用），新装配另开一把。
 * 装配真源：抽签用 `js/pool-draw.js`（产品在用它、门 D234 在钉它），原型用 `audit-lib.humanPrototypes`（与旧尺同一组），
 *   对局循环用 `v2v4-lib.duelAssembly` 的 `chooserFor`/`onGame` 钩子 ⇒ **这把尺没有第二份引擎实现**。
 * v1 的定位（用户要裁的那句，我先按保守做）：**只排序 + 量 σ，不作换包判词**。
 *   依据是 §E586/§E587 的教训：一次抽样里的"稳"可能只是仪器稳，换框就翻（`waste` 那次 0.703 → −0.031）。
 * ⚠ **这把尺自己的条款**（10-12 01:5x 实测出来的，读它印的数之前先看这两句）：
 *   ① 组成只由 `slotSalt` 决定，而 `duelAssembly` 的盐是 `h32(seed0 + g×常数)` ⇒ **同 seed 的六格共用同一批组成**
 *      （实测：20 局/格 × 3 seed = 360 场里只有 **60 个不同盐 / 56 种"成员×席位"配对**）。
 *      ⇒ 想加"阵容的多样性"要**加 `--seeds=`**，加 `--games=` 只降仪器噪声、不升独立组成数（与"重复测量不是复现"同一条）。
 *   ② 正因为独立组成少，**逐枚夺冠率 + 逐枚席位分布在 n(组成) < 200 时不可用来排名次**：
 *      实测 hard 档 360 场里 `K2` 的四席分布是 54/30/84/60（期望各 57），而同一份 `pool-draw.js` 用 2 万个**新盐**跑
 *      2 万场时 (成员×席) 极差只有期望的 **5.6%** ⇒ 偏的是这把尺的抽样，不是产品里的抽签。
 *      （页面那侧每局是 `Math.random()` 新盐 ⇒ 产品是均匀的，别把尺的毛病读成产品的毛病。）
 *
 * 用法：node tools/probe-pool.mjs [--tier=hard] [--games=60] [--seeds=90210,90211] [--modes=multi,long]
 *        [--members=champion-map/pool-members.tsv] [--out=某.tsv]
 * 退出码：0 ‖ 2 输入/成员不齐 ‖ 7 有成员读不出包（缺行 ≠ 量了没测出来）
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sandbox, loadChamp, rejectUnknownFlags, humanPrototypes } from './audit-lib.mjs';
import { duelAssembly } from './v2v4-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
rejectUnknownFlags(process.argv.slice(2), ['tier', 'games', 'seeds', 'modes', 'members', 'out', 'n', 'dose'], 'probe-pool');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const TIER = flag('tier', 'hard'), G = Number(flag('games', 60));
const SEEDS = String(flag('seeds', '90210,90211')).split(',').map(Number).filter(x => !Number.isNaN(x));
const MODES = String(flag('modes', 'multi,long')).split(',').filter(Boolean);
const TABLE = flag('members', 'champion-map/pool-members.tsv');

if (SEEDS.length < 2) { console.error('⛔ 至少两枚 seed ⇒ 不然量不出批间抖动（σ），只能给一个孤零零的均值'); process.exit(2); }
const PT = join(ROOT, TABLE);
if (!existsSync(PT)) { console.error('⛔ 池真源表不在：' + TABLE + '（先跑 tools/pool-add.mjs）'); process.exit(2); }
const L = readFileSync(PT, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
for (const c of ['id', 'wid', 'path', 'tier']) if (h[c] === undefined) { console.error('⛔ 表缺列 ' + c); process.exit(2); }
const members = L.slice(1).map(l => l.split('\t')).filter(r => r[h.tier] === TIER);
if (members.length < 2) {
  console.error('⛔ tier=' + TIER + ' 只有 ' + members.length + ' 枚 ⇒ 池抽签在数学上必然"四席全同"（用户裁定不许）' +
    ' ⇒ 这一档还没成型，先别量（要量单包请用 tools/probe-human-seat.mjs）');
  process.exit(2);
}

const W = sandbox();
const PD = W.EpirusPoolDraw;
if (!PD || typeof PD.compose !== 'function') { console.error('⛔ `js/pool-draw.js` 没进 sandbox 的 CORE 名单'); process.exit(2); }
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
/* §E593b（10-12 DS）：**剂量开关** —— 用户 10-12 指令「既然用不同水平冠军池了，把随机性统一一下、可以降低一点」。
 *   量这份裁定之前先说清一件事：**这把尺原来量的是"池在 ε=0 下的强度"**（下一行 `policyChooserN(p, 0.15)`），
 *   与产品真实档位（池 × 该档剂量四元组）**不是同一个东西**。所以加这个开关，同一把尺能两种口径都量：
 *     · `--dose=zero`（默认，与历史读数逐字一致）= 池这一条轴**单独**的强度；
 *     · `--dose=table:<页档 id>`（如 `--dose=table:lv:novice`）= 从 `js/train/bots.js` 的 `DIFF_TIERS` 读那一档的
 *       剂量四元组（**不建第二份表**；`low` 有"简单/入门"两档共用，所以必须点名页档，不许我替你挑）；
 *     · `--dose=<eps:epsK:mode>`（如 `--dose=0.2:5:soft`）= 研究用的显式候选。
 *   ⚠ 两条口径都要印在头几行（读数离开口径就没法引用，§E272/第 45 条）。 */
const DOSE_ARG = String(flag('dose', 'zero'));
const DOSE = (function () {
  if (DOSE_ARG === 'zero') return { eps: 0, epsK: 1, epsMode: 'soft', label: 'zero（ε=0 纯贪心 = 池轴的单独强度）' };
  if (DOSE_ARG.indexOf('table:') === 0) {
    const pid = DOSE_ARG.slice(6);
    const tiers = (B && B.DIFF_TIERS) || [];
    const t = tiers.filter(x => x && x.id === pid)[0];
    if (!t) { console.error('⛔ --dose=table:' + pid + ' 在 DIFF_TIERS 里找不到（有的是：' + tiers.map(x => x.id).join(',') + '）'); process.exit(2); }
    if (t.kind !== 'champ') { console.error('⛔ ' + pid + ' 是 `kind:' + t.kind + '` ⇒ 它不吃包，剂量对它无意义'); process.exit(2); }
    return { eps: t.eps, epsK: t.epsK, epsMode: t.epsMode, ramp: !!t.ramp, label: pid + ' 的表值 ε=' + t.eps + '/k' + t.epsK + '/' + t.epsMode + (t.ramp ? '·斜坡(本尺按起手剂量,不模拟逐回合上升)' : '') };
  }
  const m = /^([0-9.]+):([0-9]+):(soft|uniform)$/.exec(DOSE_ARG);
  if (!m) { console.error('⛔ --dose 只认 zero ‖ table:<页档id> ‖ <eps:epsK:soft|uniform>，收到 ' + DOSE_ARG); process.exit(2); }
  return { eps: Number(m[1]), epsK: Number(m[2]), epsMode: m[3], label: '显式 ε=' + m[1] + '/k' + m[2] + '/' + m[3] };
})();
const lite = members.map(r => ({ id: r[h.id], wid: r[h.wid] }));
const PARAMS = {}, CHOOSERS = {};
const bad = [];
for (const r of members) {
  let p = null;
  try { p = loadChamp(W, r[h.path]); } catch (e) { p = null; }
  if (!p) { bad.push(r[h.id] + '(' + r[h.path] + ')'); continue; }
  PARAMS[r[h.id]] = p;
  CHOOSERS[r[h.id]] = T.policyChooserN(p, 0.15, DOSE.eps, DOSE.epsK, DOSE.epsMode);
}
if (bad.length) { console.error('⛔ ' + bad.length + ' 枚读不出包：' + bad.join(' ‖ ') + ' ⇒ 按失败处理'); process.exit(7); }
const HUMAN = humanPrototypes(B);
for (const x of HUMAN) if (typeof x[1] !== 'function') { console.error('⛔ 人类原型「' + x[0] + '」不是函数'); process.exit(7); }

/* §E600-B：这把尺必须量**产品真实装配**，所以掺脚本席的推导走 `js/pool-draw.js` 的同一份 `scriptSeats`
 *   —— 页面调它，这里也调它；两边各自写一遍就是"量具在量一个产品里没有的东西"（规矩 134 那一族）。
 *   取哪一档：`pool` 字段等于本次 `--tier=` 的那一档（今天每带只有一档；真出现多档且 mix 不一致，这里就红）。 */
let MIX = null, SCRIPTS = {};
{
  const tiers = (B && B.DIFF_TIERS) || [];
  const users = tiers.filter(t => t.pool === TIER && t.scriptMix);
  if (users.length > 1) {
    console.error('⛔ 有多档共用 tier=' + TIER + ' 且都声明了 scriptMix ⇒ 这把尺不知道该按哪一档装配（' +
      users.map(t => t.id).join(' ‖ ') + '）'); process.exit(7);
  }
  if (users.length === 1) {
    MIX = PD.scriptSeats(users[0], 4, B.STYLES || []);
    if (MIX && MIX.seats > 0) {
      SCRIPTS = {};
      for (const sid of MIX.ids) {
        const st = (B.STYLES || []).find(x => x.id === sid);
        if (!st) { console.error('⛔ scriptMix 里的风格 ' + sid + ' 不在 STYLES ⇒ 认不出就是错主'); process.exit(7); }
        SCRIPTS[sid] = T.wrapBigTPush ? T.wrapBigTPush(st.pick) : st.pick;   /* 与页面同一层包装（v1.6.3 那条裁定） */
      }
    }
  }
}
console.log('# 池形态新尺（1 席人类形状 + 4 席按 tier=' + TIER + ' 抽 · 允许重复 · 禁四席全同' +
  (MIX && MIX.seats ? ' ‖ 掺脚本席 ' + MIX.seats + ' 席：' + MIX.ids.join(' ‖ ') : ' ‖ 不掺脚本席') + '）');
console.log('# 剂量 ' + DOSE.label + (DOSE.ramp ? '' : '') + '   ← 这一行是引用读数时**必须**带上的口径（§E272/第 45 条）');
console.log('# 成员 ' + lite.length + ' 枚：' + lite.map(m => m.id).join(' ‖ '));
console.log('# ' + G + ' 局/格 × ' + SEEDS.length + ' 枚 seed（' + SEEDS.join('/') + '）· 装配实现与 `probe-human-seat` 同一份（duelAssembly）');
console.log('# 读法：印的是**人类那一席的夺冠率**（越高 = 这池子拿它没办法）；批间极差 = 这把尺自己的抖动，**没量出 σ 之前不许拿来判换不换包**\n');

const rows = [];
for (const mode of MODES) {
  const per = {};                                   // 格 → [每枚 seed 的人类夺冠率]
  const memberGames = {}, memberWins = {};
  /* 席位账：池形态下**四席不是同一枚包**，"自对弈里座位效应会自我抵消"那句前提没了（用户 10-11 澄清：
   *   座位无偏只属于自对弈装配）。⇒ 必须把"座位本身值多少 pt"量出来，否则逐枚夺冠率里掺的是坐席不是强度。
   * 弱点剖面：`memberCell[成员][人类原型] = {n, hw}` = "**这枚在桌上时**那个原型夺冠的场次 / 总场次"
   *   —— 这是"逐席不同枚"才问得出的问题（旧装配四席同包 ⇒ 每枚的剖面就等于整体的剖面），旧尺里没有对应物。 */
  const seatGames = [0, 0, 0, 0], seatWins = [0, 0, 0, 0], memberSeat = {};
  const memberCell = {};                              /* 成员 id → 格名 → {n, hw} */
  let curCell = null;                                 /* 原型名只能由调用侧带进来（`onGame` 的钩子签名里没有它） */
  const salts = new Set(), comps = new Set();   /* 每场组成由 `slotSalt` 唯一决定 ⇒ 盐/组成只有几种在转的话，"逐枚席位分布"不是独立抽样，得先说出来 */
  let allSameGames = 0, totalGames = 0, distinctSum = 0, missSeat = 0;
  let seqSamples = null;                            // 只留第一枚 seed 的前 6 场组成（给人眼看"随机"是不是真的在换）
  for (const seed of SEEDS) {
    const games = new WeakMap();
    let curState = null, cur = null;
    const chooserFor = function (pid, st) {
      if (st !== curState) {
        curState = st;
        const comp = PD.compose(lite, 4, PD.rng((st.slotSalt >>> 0) || 1), (MIX && MIX.seats) ? MIX : null);
        cur = { comp: comp, byPid: {}, order: 0 };
        games.set(st, cur);
      }
      if (!(pid in cur.byPid)) { cur.byPid[pid] = cur.comp.seats[cur.order++]; }
      const m = cur.byPid[pid];
      if (!m) { missSeat++; return null; }           /* null 会落回 duelAssembly 自带的那颗 ⇒ 计数暴露，不静默补位 */
      if (m.kind === 'script') return SCRIPTS[m.id] || null;   /* 脚本席：与页面同一份 pick（含 wrapBigTPush 那层） */
      return CHOOSERS[m.id];
    };
    const onGame = function (st, scriptedSeat) {
      const g = games.get(st); if (!g) return;
      totalGames++;
      salts.add((st.slotSalt >>> 0) || 1);
      comps.add(g.comp.seats.map(s => s.id + ':' + s.seat).join('|'));
      if (g.comp.allSame) allSameGames++;
      distinctSum += PD.distinct(g.comp.seats);
      if (seqSamples === null) seqSamples = [];
      if (seqSamples.length < 6) seqSamples.push(g.comp.seats.map(s => s.id).join('+'));
      for (const pid in g.byPid) {
        const m = g.byPid[pid], id = m.id, s = m.seat, won = (st.winner === Number(pid));
        memberGames[id] = (memberGames[id] || 0) + 1;
        if (won) memberWins[id] = (memberWins[id] || 0) + 1;
        seatGames[s]++; if (won) seatWins[s]++;
        (memberSeat[id] = memberSeat[id] || [0, 0, 0, 0])[s]++;
        const c = ((memberCell[id] = memberCell[id] || {})[curCell] = (memberCell[id][curCell] || { n: 0, hw: 0 }));
        c.n++; if (st.winner === scriptedSeat) c.hw++;      /* 这枚在桌上时，人类那一格赢了多少场 = 它的弱点剖面 */
      }
    };
    HUMAN.forEach(function (x, i) {
      curCell = x[0];
      const r = duelAssembly({ S: S, Play: Play, T: T, R: R }, PARAMS[lite[0].id],
        { games: G, mode: mode, seed0: seed, scripted: x[1], chooserFor: chooserFor, onGame: onGame });
      (per[x[0]] = per[x[0]] || []).push(r.winPct);
    });
  }
  console.log('== 口径 ' + mode + ' ==');
  if (seqSamples && seqSamples.length) console.log('   前 ' + seqSamples.length + ' 场组成（seed=' + SEEDS[0] + '）：' + seqSamples.join(' ‖ '));
  if (missSeat) console.log('   ⛔ 有 ' + missSeat + ' 次决策没分配到成员（落回了单包）⇒ 组成漏席，本行的数不可引用');
  console.log('   格 | ' + SEEDS.join(' | ') + ' | 均值 | 批间极差');
  for (const x of HUMAN) {
    const v = per[x[0]];
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const spread = Math.max.apply(null, v) - Math.min.apply(null, v);
    console.log('   ' + (x[0] + '            ').slice(0, 14) + '| ' + v.map(a => a.toFixed(1).padStart(5)).join(' | ') +
      ' | ' + mean.toFixed(1).padStart(5) + ' | ' + spread.toFixed(1).padStart(5));
    rows.push({ mode: mode, cell: x[0], seedVals: v.join(','), mean: mean.toFixed(2), spread: spread.toFixed(2) });
  }
  console.log('   ⚑ 六格均值的批间极差 = ' + (function () {
    const all = SEEDS.map((s, i) => HUMAN.reduce((a, x) => a + per[x[0]][i], 0) / HUMAN.length);
    /* ⚠ 极差(max−min)**不是 σ**：它是"批数越多越大"的量（3 批的 E[极差]≈1.69σ、20 批≈3.7σ）
     *   ⇒ 同一把尺换批数再比极差是自欺。σ 用**批间标准差**，下面同时印出来，引用只许引 SD。 */
    const m = all.reduce((a, b) => a + b, 0) / all.length;
    const sd = Math.sqrt(all.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, all.length - 1));
    return (Math.max.apply(null, all) - Math.min.apply(null, all)).toFixed(2) + 'pt（' + all.map(a => a.toFixed(2)).join(' vs ') + '）' +
      ' ‖ **σ(单批六格均值)=' + sd.toFixed(2) + 'pt** ‖ 批均值 ' + m.toFixed(2) + ' ‖ 批数 ' + all.length +
      ' ⇒ 两池比较时"差 > "要 ≥ ' + (sd * Math.sqrt(2 / all.length)).toFixed(2) + 'pt（' + all.length + ' 批均值之差的双侧 1σ）';
  })());
  console.log('   ⚑ 四席全同的场数 = ' + allSameGames + ' / ' + totalGames + '（用户裁定不许全同 ⇒ 不为 0 就要查抽签）');
  console.log('   ⚑ 平均每场不同枚数 = ' + (distinctSum / Math.max(1, totalGames)).toFixed(2) + ' / 4');
  console.log('   逐枚夺冠率：' + lite.map(m => m.id + ' ' + ((memberWins[m.id] || 0) / Math.max(1, memberGames[m.id]) * 100).toFixed(1) + '%(上场 ' + (memberGames[m.id] || 0) + ')').join(' ‖ '));
  /* 座位效应：把"哪一席更容易赢"跨成员合并成一个数 ⇒ 它才是"逐枚夺冠率能不能并排读"的那把尺。
   *   四席的夺冠率之和必然 = P(AI 赢)（其余给人类那一席），所以**看的是极差不是绝对值**。 */
  /* 弱点剖面矩阵：行 = 成员，列 = 人类原型，格 = "这枚在桌上时该原型夺冠率"（括号里是场数）。
   *   读法只许这样用：**同一行里比较**（这枚怕哪一格），不要跨行比大小（那是夺冠率干的事）。
   *   参照行 = 整池平均（同口径），差 ≥3σ(单格) 才叫"漏"；σ(单格) 按 n 现算，不许拍一个数。 */
  const CELLS = HUMAN.map(x => x[0]);
  const colMean = {}, colN = {};
  for (const m of lite) for (const cn of CELLS) {
    const c = (memberCell[m.id] || {})[cn]; if (!c) continue;
    colMean[cn] = (colMean[cn] || 0) + c.hw; colN[cn] = (colN[cn] || 0) + c.n;
  }
  const poolRate = cn => (colN[cn] ? colMean[cn] / colN[cn] * 100 : 0);
  console.log('   弱点剖面（行内比：这枚在桌上时，该原型夺冠率 %；⚑ = 比整池平均高 ≥3σ）');
  console.log('     ' + '成员'.padEnd(15) + CELLS.map(c => c.slice(0, 5).padStart(8)).join(''));
  for (const m of lite) {
    const cells = [];
    let worst = null;
    for (const cn of CELLS) {
      const c = (memberCell[m.id] || {})[cn]; if (!c || !c.n) { cells.push('        -'); continue; }
      const r = c.hw / c.n * 100, base = poolRate(cn);
      const se = Math.max(0.5, Math.sqrt(Math.max(1e-6, base / 100 * (1 - base / 100)) / c.n) * 100);
      const flag = (r - base) >= 3 * se ? '⚑' : ' ';
      cells.push((r.toFixed(0) + '(' + c.n + ')' + flag).padStart(8));
      if (!worst || (r - base) / se > (worst.z)) worst = { cn: cn, z: (r - base) / se, r: r, base: base, se: se, n: c.n };
    }
    console.log('     ' + (m.id + '              ').slice(0, 15) + cells.join(''));
    if (worst && worst.z >= 3) console.log('        └ 最漏的一格：' + worst.cn + ' ' + worst.r.toFixed(1) + '% vs 整池 ' +
      worst.base.toFixed(1) + '%（' + worst.z.toFixed(1) + 'σ，n=' + worst.n + '）');
    rows.push({ mode: mode, cell: '__profile:' + m.id, seedVals: CELLS.map(cn => {
      const c = (memberCell[m.id] || {})[cn]; return c && c.n ? (c.hw / c.n * 100).toFixed(1) + '/' + c.n : '-'; }).join(','), mean: '', spread: '' });
  }
  const seatRate = seatGames.map((n, s) => n ? seatWins[s] / n * 100 : 0);
  const seatSpread = Math.max.apply(null, seatRate) - Math.min.apply(null, seatRate);
  console.log('   ⚑ 座位效应（AI 四席各自夺冠率，跨成员合并）：' +
    seatRate.map((r, s) => '席' + s + ' ' + r.toFixed(1) + '%(n=' + seatGames[s] + ')').join(' ‖ ') +
    ' ⇒ **极差 ' + seatSpread.toFixed(2) + 'pt**' + (seatSpread <= 3 ? '（≤3pt ⇒ 逐枚夺冠率可以并排读）' :
      '（>3pt ⇒ 逐枚夺冠率里掺的是坐席不是强度，比名次前先按席位分层）'));
  const imbal = lite.map(m => { const a = memberSeat[m.id] || [0, 0, 0, 0];
    return { id: m.id, lo: Math.min.apply(null, a), hi: Math.max.apply(null, a) }; })
    .sort((x, y) => (y.hi - y.lo) - (x.hi - x.lo))[0];
  console.log('   ⚑ 席位分布最不均的一枚：' + imbal.id + '（各席 ' + (memberSeat[imbal.id] || []).join('/') +
    ' ⇒ 高到低差 ' + (imbal.hi - imbal.lo) + ' 场）');
  console.log('   ⚑ 抽样独立性：这 ' + totalGames + ' 场里出现 ' + salts.size + ' 个 `slotSalt` ‖ ' + comps.size + ' 种"成员×席位"配对' +
    (salts.size < totalGames / 2 ? ' ⇒ **盐在复用**（组成不是逐场独立 ⇒ 逐枚席位分布/夺冠率的误差棒要比 n 之前先按"独立组成数"打折）' : ''));
  for (let s = 0; s < 4; s++) rows.push({ mode: mode, cell: '__seat' + s, seedVals: seatWins[s] + '/' + seatGames[s], mean: seatRate[s].toFixed(2), spread: s === 3 ? seatSpread.toFixed(2) : '' });
  rows.push({ mode: mode, cell: '__allSame', seedVals: allSameGames + '/' + totalGames, mean: (distinctSum / Math.max(1, totalGames)).toFixed(2), spread: '' });
}
if (flag('out', '')) {
  const cols = ['mode', 'cell', 'seedVals', 'mean', 'spread'];
  writeFileSync(join(ROOT, flag('out')), cols.join('\t') + '\n' + rows.map(r => cols.map(c => r[c]).join('\t')).join('\n') + '\n');
  console.log('\n✔ 已写 ' + flag('out'));
}
console.log('\n# 最后一行是机器可读的（给门与以后的自己核对用）：');
console.log(JSON.stringify({ tier: TIER, members: lite.length, games: G, seeds: SEEDS, modes: MODES,
  allSameGames: rows.filter(r => r.cell === '__allSame').map(r => r.seedVals),
  seatSpread: MODES.map(function (mo) { const s = rows.filter(r => r.mode === mo && r.cell === '__seat3')[0]; return s ? Number(s.spread) : null; }) }));
