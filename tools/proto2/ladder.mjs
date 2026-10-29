#!/usr/bin/env node
/* ladder.mjs — **笨策略阶梯**：在同一套 arena（16 格 × N 局 × 同 temp）上，把"什么都不学"的几种固定打法摆成一排刻度
 * （千问 · 10-29 04:0x · §E824 V 波之后）
 *
 * 为什么今夜必须有它：V 波里 rollout 货币那五枚臂读出 **Δ夺1 +5.9 ~ +8.4pt**（五枚同号、过线），
 *   看起来像"稠密同向标签第一次兑现"。把它们的行为剖面拉出来一看：`族 d:99.5%`——**四枚不同 seed 的臂退化成同一只"只按架势"的笨蛋**
 *   （夺1 逐字节相同：26.8 / 26.8 / 26.8 / 26.6），而它们的留出 CE（2.13~2.18）**还高于平坦地板 ln n = 1.873**
 *   ⇒ 货币根本没给出梯度，涨的那 8pt 是"退化成固定一族的动作"在**这套 arena 里本来就值钱**。
 * ⇒ 所以"Δ vs 随机起点"这把尺缺一个下限锚：**得先知道一只从不学习的笨蛋能拿多少**，否则退化会被读成进步。
 *   这里摆五种：只按架势 ‖ 只开枪ジ ‖ 只蓄能 ‖ 均匀乱选合法候选 ‖ 参照包 v7（同场当上限刻度）。
 *
 * ⚠ 三条口径声明：
 *   ① 缺省走**引擎那条候选面**（`{lockTarget: cancelOtherLocal(...)}`，照 `evo.js:404` 逐字复制，因为那个函数没导出）⇒
 *      臂行与固定打法在同一把尺上，且臂行可被 `profile2` 对表。要退回旧的宽面用 `--face=wide`（只为对照，别拿去出判语）。
 *   ② `temp` 只影响 v7 那一行（其余是确定性/自带定标流），所以阶梯内可比、跨 temp 不可比。
 *   ③ 每个策略都跑**同一批局号**（`1000 + n*97 + idx + g*7919`）⇒ 分母逐字相等，不做"各自换一批桌"。
 * 用法：node tools/proto2/ladder.mjs [--games=120] [--temp=0.001] [--only=guard,ji,charge,rand,v7] [--anchors=scratch/ladder-anchor.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox, loadChamp, buildPoolSeeded, poolFingerprint, arenaGuardVerdict } from '../audit-lib.mjs';
import { install as installArch2 } from './arch2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
/* `--guard=<锚文件>` 那道 arena 可判性门**搬到这里之后**（`CELLS`/`POOL_FP`/`BIGT`/`ENGINE_FACE` 都在下面），
 *   因为它要先能把锚的新鲜度读出来才能判——判据原文在文件末尾附近。 */
const GAMES = Math.max(4, Number(arg('games', 120)) || 120);
const TEMP = Number(arg('temp', 0.001));
const ONLY = String(arg('only', 'guard,ji,charge,rand,v7')).split(',').filter(Boolean);
/* `--sweep=keys` ⇒ 把 30 个技能键**各当一条固定打法**跑一遍。
 *   动因（04:0x）：rollout 货币那批臂读出 Δ夺1 +8pt 而剖面是 `d:99.5%`——但"只按架势"这一条固定打法只有 6.8%，
 *   所以真正要问的是**"有没有哪一枚单技能固定打法本来就值 26%"**：有的话，那 8pt 就不是"标签教出来的"，是"退化成那一枚技能"。 */
const SWEEP = arg('sweep', '') === 'keys';
/* `--pack=a.bak,b.bak` ⇒ 把 2.0 的臂**放到同一把尺上**（同一个手搓候选面 + 贪心 argmax），
 *   然后报它在"30 枚单技能固定打法"里的**名次/百分位**。
 *   为什么不直接拿 profile2 的夺1来排：两把尺的候选面不同（`lockTarget:false` vs 引擎的 `lastCancelOther`），
 *   今夜在 mixprobe 上实测这一格差值 **6.8pt** ⇒ 跨口径排位次会把臂排高/排低一整格。
 *   ⇒ 臂在这里的行与固定打法**完全同口径**，可与 ladder 排序对照；与 profile2 的那一行不许混着引。 */
const PACKS = String(arg('pack', '')).split(',').map((x) => x.trim()).filter(Boolean);
/* `--anchors=<path>` ⇒ 把这条阶梯**落成锚文件**给 `profile2` 读（#146 那条"出厂列"的第二半）。
 *   为什么要有文件而不是让 profile2 自己去跑一遍阶梯：31 格 × 16 格桌 × N 局是**臂本身成本的 31 倍**，
 *   而它量的是"这把尺的刻度"，只要 arena/对手表/剂量没变就一直能用 ⇒ 一次落盘、每枚臂都免费读到名次。
 *   ⚠ 代价是锚会**过期**：所以文件里带 `poolFp + cells + games + temp + bigt`，profile2 逐条回读，
 *     对不上就只印"锚过期"、**不印名次**（宁可少一条读数，不要一条接错刻度的读数）。
 *   用法：`node tools/proto2/ladder.mjs --games=40 --sweep=keys --anchors=scratch/ladder-anchor.json` */
const ANCHORS = arg('anchors', '');
/* `--opp=<固定打法键>` ⇒ **所有非被测席**换成同一条固定打法（DS 的 P0 第 1 条：先把"退化打法当对手"做成**刻度**，不写通过线）。
 *   为什么不新写一把尺：候选面/局号/temp/bigt 全在这一处，换一把就要再对一次口径（第 ①节那 21pt 的教训）。
 *   ⚠ 换了对手桌，v7/rand 那两个自检锚量的是**原对手表** ⇒ `--opp≠pool` 时自检只印不判（下面 SELFCHECK 那段）。 */
const OPP = String(arg('opp', 'pool'));
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules, Play = W.EpirusPlay;
/* ⚑⚑ **大雷"看得见"那一档（`evo.js:648` `BIGT_PUSH = 12`，v1.5.333 起出厂默认开着）必须在尺上关掉**：
 *   它是引擎 chooser **内部**的覆盖（命中就把这一手交给大雷），而我这里的固定打法根本不走 chooser ⇒
 *   开着它比 = "带一次免费大雷的策略 vs 不带大雷的策略"，不是同一条尺。
 *   实测这一档的价（同一枚 v7、同一批局号）见下面 `--bigt=12` 那行；臂行也一样，两档都印。 */
/* 缺省 **12 = 出厂档**（`evo.js:648` `BIGT_PUSH = 12`，v1.5.333 起默认开着）——
 *   这样臂行与 `profile2` 同口径（实测 R1：bigt=0 引擎 chooser 15.5% ‖ bigt=12 **23.8%** ‖ `profile2` 21.9%）。
 *   ⚠ 固定打法那一列**不吃这一档**（它们不走 chooser，是自己递交动作）⇒ 阶梯里"固定打法 vs 臂"是
 *     **"无注入 vs 有注入"**的不对称，方向对臂有利 ⇒ "臂只值某枚单技能那一格"这类判语只算**下界**。
 *   `--bigt=0` 用来量这一档本身的价（v7：40.2 ‖ 40.4 两档实测）。 */
const BIGT = Number(arg('bigt', 12));
if (typeof T.setBigTPush === 'function') T.setBigTPush(BIGT);
else { console.error('⛔ 引擎没有 `setBigTPush` ⇒ 无法把大雷那一档对齐，尺不许出数'); process.exit(2); }

let ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
if (!ref) { console.error('⛔ 参照包读不出'); process.exit(2); }
ref = Float64Array.from(ref);
function mulberry(sv) { let a = sv >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* ⚑ 对手表与 `profile2` **同源**（10-29 11:2x 抽进 audit-lib）：锚要把臂摆进这条阶梯排名次，
 *   两把尺各造一遍池子时，"指纹对不上"分不清是池子真变了还是哈希实现漂了 ⇒ 现在两边调同一只函数。
 *   种子 20261029 与 `profile2:52` 逐字同一；参照包也是同一份 `js/bundled-champion-3p.js`。 */
const POOL = buildPoolSeeded(T, ref, 20261029);
const POOL_FP = poolFingerprint(POOL);
const STYLES = ['breakdef', 'wall', 'tankline', 'guardgun', 'protowall', 'reflectmix', 'beadburst', 'aggro'];
const CELLS = [];
for (const n of [3, 5]) for (const nm of STYLES) { const i = POOL.findIndex((o) => o.name === nm); if (i >= 0) CELLS.push({ n, name: nm, idx: i }); }
const GUARD = R.GUARD_FAMILY || [];

/* ⚑ 候选面必须与**引擎自己那条路**同口径，否则臂与固定打法不在一把尺上（今夜实测：`lockTarget:false` 那面
 *   把 B8 从 26.8% 读成 5.7% ‖ R1 从 21.9% 读成 15.1% ⇒ 21pt / 6.8pt 的纯口径差）。
 *   比赛走的是 `evo.js:203/953` 的 `{ lockTarget: lastCancelOther(state, pid) }`，而那个函数**没导出** ⇒
 *   这里照 `js/train/evo.js:404-412` 逐字复制一份（只读 `state.events` 的 `cancel` 事件，不写任何东西）。
 * ⚠ 但**换面并没有把口径对上**（04:2x 实测，`scratch/LADDER-bigt0.log`）：R1 在这里读 15.1%（贪心）/ 15.5%（引擎 chooser），
 *   而 `profile2` 同一枚粒同一批局号读 **21.9%**；B8 更夸张——**同一台 ladder 里**贪心读 5.7% 而引擎 chooser 读 25.9%。
 *   ⇒ 大雷那一档（bigt=0/12 两档 v7 都只从 40.4 动到 40.2）与候选面都不是解释。
 *   **这一格已在第十七段闭合**（量具 `scratch/bigt-gap.mjs` ‖ 原件 `scratch/BIGT-GAP.log`）：三条行摆开之后
 *     · **B8 的 20pt = 纯破号规则**：并列集合平均 **2.97 枚**（最坏 3 ⇒ 它只有 3 个"分不开的出口"），
 *       贪心永远拿候选表里排第一的那枚（**97.8% 的出手是同一手**）读 6.3%，引擎在这 3 枚里抽样（33.5/33.0/31.9%）读 26.3%；
 *       大雷那一档对它**根本没生效过**（5443 次决策里候选表出现大雷 2 次 ⇒ 窗口/局 0.01，这枚头从不攒够 5 珠）。
 *     · **R1 的 5pt ≈ 大雷那一档**（同一条贪心加注入 +7.5pt，窗口/局 4.77、兑现率 0.083 = 理论 1/12）；它的并列集合只有 **1.03 枚** ⇒ 头是分得开的。
 *     · N1/N2 更极端：并列集合 **3.79 / 5.06 枚**（最坏 7 / 11），且贪心行与 chooser 行的**族分布整个翻转**
 *       （N1 贪心 e:83.1% ‖ chooser d:69.6%）⇒ 它的"打法"不是学出来的，是**破号规则给的**。
 *   ⇒ 由此立下本尺的条款：**臂行必须贪心与 chooser 两行一起看，并附"并列集合平均大小"**。
 *     只报 chooser 那一行会把"头分不开"读成"头会打"；只报贪心那一行会把"候选表第一位恰好是谁"读成强度。
 *     对表用 `scratch/bigt-gap.mjs --packs=… --games=…`（同一台 arena、同批局号、同对手表）。
 *   验收：换完这一面之后，臂行必须复现 `profile2` 那行（`--expect` 式对表；今夜 R1=21.9 ‖ B8=26.8 ‖ AB-pre=0.7 ‖ N2=14.1）。 */
function cancelOtherLocal(state, pid) {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) {
      return e.pids[0] === pid ? e.pids[1] : e.pids[0];
    }
  }
  return null;
}
const ENGINE_FACE = !argv.includes('--face=wide');
/* ===== 2026-10-29（DS · 强度尺修复 ‖ 千问 13:3x 补上"锚必须新鲜"那一半）：`--guard=<锚文件>` ⇒ arena 可判性门 =====
 * 判据（可失败）：任何一枚固定单技能打法的夺1 ≥ 参照包 v7 ⇒ 这套 arena 不能当强度尺（退化会被读成进步）。
 * 真锚实测：只 `reflect` **65.3% ≥ v7 40.4%**（`scratch/ladder-anchor.json`）⇒ 这道门现在**必须是红的**，这正是它的用途。
 *   （DS 原注释写 66.7%、本锚是 65.3%——我 13:4x 判它"引错了尺"，**那是我的归因错**：同一枚尺实测
 *     reflect 夺1 = 20 局/格 64.7% ‖ 40 局/格 66.6% ‖ 120 局/格 65.3% ⇒ 那个区间是**剂量**给的，不是两把尺给的。
 *     ⇒ 由此多立一条本尺条款：**rung 的读数要带 `gamesPerCell`**，跨剂量的 rung 差（此格 ±2pt）不许当判语。）
 * 读锚而不重跑：31 格 × 16 桌 × N 局 ≈ 臂成本的 31 倍，锚落一次能反复判。
 * ⚑ **新鲜度前置**（DS 的 P0 第 2 条）：锚量的是"刻度"，而刻度随 对手表 / 桌形 / 大雷档 / 候选面 / temp 变
 *   ⇒ 这五条任一条对不上就 exit 4 报"锚过期"，**不去读那条会误导人的 verdict**（与 `profile2` 同一套判据、同一个同源来源）。
 *   ⚠ 剂量不参与"过期"判定（名次与比较是尺度无关的），但会印出来：`--games=4` 那种锚的 rung 自身 SE 就有 ±5pt。
 * 退出码：0 = arena 有下限刻度 ‖ 4 = arena 失效、锚过期、或锚里缺行（缺行也算 4，不许当绿）。 */
const GUARD_ANCHOR = arg('guard', '');
if (GUARD_ANCHOR) {
  let anc = null;
  try { anc = JSON.parse(readFileSync(GUARD_ANCHOR, 'utf8')); } catch (e) { console.error('⛔ --guard 读不出锚文件 ' + GUARD_ANCHOR + '：' + String(e && e.message || e)); process.exit(4); }
  const cellsNow = CELLS.map((c) => c.n + ':' + c.name + ':' + c.idx).join(',');
  const stale = [];
  if (anc.poolFp !== POOL_FP) stale.push('对手表指纹：锚 ' + anc.poolFp + ' ‖ 本轮 ' + POOL_FP);
  if (anc.cells !== cellsNow) stale.push('桌形/格序：锚 ' + anc.cells + ' ‖ 本轮 ' + cellsNow);
  if (Number(anc.bigt) !== BIGT) stale.push('大雷档：锚 ' + anc.bigt + ' ‖ 本轮 ' + BIGT);
  if (anc.engineFace !== ENGINE_FACE) stale.push('候选面：锚 ' + anc.engineFace + ' ‖ 本轮 ' + ENGINE_FACE);
  if (Number(anc.temp) !== TEMP) stale.push('temp：锚 ' + anc.temp + ' ‖ 本轮 ' + TEMP + '（锚里的 v7 上限行随 temp 动）');
  if (stale.length) {
    console.error('⛔ 锚过期 ⇒ 不判 arena：' + stale.join(' ‖ ') + '\n   ⇒ 重落一次：node tools/proto2/ladder.mjs --games='
      + (anc.gamesPerCell || 120) + ' --sweep=keys --anchors=' + GUARD_ANCHOR);
    process.exit(4);
  }
  const g = arenaGuardVerdict(anc);
  if (g.level === 'unknown') { console.error('⛔ ' + g.reason); process.exit(4); }
  console.log('[arena-guard] ' + g.reason + ' ‖ 锚：' + anc.gamesPerCell + ' 局/格 × ' + anc.cellCount + ' 格 ‖ 指纹 ' + anc.poolFp + ' ‖ 生成于 ' + anc.generatedAt);
  console.log('  提示：' + (g.fail ? '⇒ 拿这套 arena 当适应度会把「只一招」读成强；先换/加列再训臂' : '⇒ 这道门是绿的，可以拿它当强度尺'));
  process.exit(g.fail ? 4 : 0);
}
function candsOf(state, pid, legal) {
  const lock = ENGINE_FACE ? cancelOtherLocal(state, pid) : false;
  return P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: lock }) || [];
}
/* 各固定打法的"选哪一枚"规则（找不到目标动作就退回ジ） */
function pickBy(pred) {
  return function (state, pid, legal) {
    const cs = candsOf(state, pid, legal);
    if (!cs.length) return { key: R.SK.JI };
    for (const c of cs) if (pred(c)) return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
    const ji = cs.filter((c) => c.key === R.SK.JI)[0] || cs[0];
    return { key: ji.key, target: ji.target == null ? null : ji.target, target2: null, bead: null };
  };
}
const POLICIES = {
  guard: { label: '只按架势', sel: pickBy((c) => GUARD.indexOf(c.key) >= 0) },
  ji: { label: '只开枪ジ', sel: pickBy((c) => c.key === R.SK.JI) },
  charge: { label: '只蓄能', sel: pickBy((c) => c.key === R.SK.CHARGE) },
  reflect: { label: '只镜面反射', sel: pickBy((c) => c.key === 'reflect') },
  armor: { label: '只装甲', sel: pickBy((c) => c.key === 'armor') },
  rand: { label: '均匀乱选', sel: null },   /* 用这一格自己的定标流抽 */
  v7: { label: '参照包 v7', sel: T.policyChooserN(ref, TEMP) },
};
/* 见文件头那条 `--opp=`：这里只做校验与取值，不改任何候选面 */
let OPP_SEL = null, OPP_LABEL = '池（8 型脚本bot）';
if (OPP !== 'pool') {
  /* `--opp=skill:<键>` ⇒ 那**一枚技能**当整桌对手（30 枚技能键都能当；只认 POLICIES 里那几枚是不够的，
   *   DS 点名的 `snipe` 就不在 POLICIES 里——这条别名让它不用再加一份固定打法表） */
  if (OPP.indexOf('skill:') === 0) {
    const sk = OPP.slice(6);
    if (!R.skills.some((x) => x.key === sk)) { console.error('⛔ --opp=skill:' + sk + ' 不是合法技能键（先看 `R.skills`）'); process.exit(2); }
    OPP_SEL = pickBy((c) => c.key === sk); OPP_LABEL = '**全 ' + sk + '**（整桌对手都只打这一枚技能）';
  } else {
    const p = POLICIES[OPP];
    if (!p || !p.sel) { console.error('⛔ --opp=' + OPP + ' 不可用（可选：pool ‖ skill:<技能键> ‖ ' + Object.keys(POLICIES).filter((k) => POLICIES[k].sel).join(',') + '）'); process.exit(2); }
    OPP_SEL = p.sel; OPP_LABEL = '**全 ' + p.label + '**（整桌对手都用这条固定打法）';
  }
}
const SHOW_CELLS = argv.includes('--cells=1');
function playCell(selFn, cell, rstream) {
  let f = 0, t2 = 0, sv = 0, rd = 0, acts = 0, cat = {};
  const CAT = {}; R.skills.forEach((s) => { CAT[s.key] = s.cat; });
  for (let g = 0; g < GAMES; g++) {
    const seat = g % cell.n;
    const choosers = [];
    for (let pid = 0; pid < cell.n; pid++) {
      if (pid !== seat) { choosers.push(OPP_SEL || POOL[(cell.idx + 1 + pid) % POOL.length].sel); continue; }
      if (rstream) choosers.push(function (st, p, legal) {
        const cs = candsOf(st, p, legal);
        if (!cs.length) return { key: R.SK.JI };
        const c = cs[Math.floor(rstream() * cs.length)];
        return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
      });
      else choosers.push(selFn);
    }
    const rm = T.oneGameN(choosers, 1000 + cell.n * 97 + cell.idx + g * 7919, cell.n, { regen: 0, mode: 'multi' });
    const st = rm.state, myHp = st.p[seat] ? Math.max(0, st.p[seat].hp) : 0;
    let ahead = 0;
    for (let i = 0; i < cell.n; i++) if (i !== seat) { const h = st.p[i] ? Math.max(0, st.p[i].hp) : 0; if (h > myHp + 1e-9 || (Math.abs(h - myHp) < 1e-9 && rm.dmg[i] > rm.dmg[seat])) ahead++; }
    if (rm.winner === seat) f++;
    if (ahead <= 1) t2++;
    if (myHp > 0) sv++;
    rd += rm.rounds || 0;
    for (const e of (st.events || [])) if (e.type === 'action' && e.pid === seat) { acts++; const k = CAT[e.key] || '?'; cat[k] = (cat[k] || 0) + 1; }
  }
  return { f, t2, sv, rd, acts, cat };
}
console.log('# 笨策略阶梯 ‖ ' + CELLS.length + ' 格 × ' + GAMES + ' 局（同批局号）‖ temp=' + TEMP + ' ‖ bigt=' + BIGT +
  ' ‖ 候选面 ' + (ENGINE_FACE ? '引擎同口径（lockTarget=lastCancelOther）' : '宽面 lockTarget:false（--face=wide，只为对照）') +
  ' ‖ 对手表 ' + (OPP === 'pool' ? '池（8 型脚本bot，定标指纹 ' + POOL_FP + '）' : OPP_LABEL + ' ⇒ 退化对手刻度，不写通过线') + '（与 `profile2` 同源）');
const tot = [];
for (const key of ONLY) {
  const pol = POLICIES[key];
  if (!pol) { console.log('  ⚠ 不认识的策略 `' + key + '`（可用：' + Object.keys(POLICIES).join(',') + '）'); continue; }
  let F = 0, T2 = 0, SV = 0, RD = 0, AC = 0, CT = {};
  for (let i = 0; i < CELLS.length; i++) {
    const rs = key === 'rand' ? mulberry(5150 + i * 7919) : null;
    const a = playCell(pol.sel, CELLS[i], rs);
    F += a.f; T2 += a.t2; SV += a.sv; RD += a.rd; AC += a.acts;
    for (const k in a.cat) CT[k] = (CT[k] || 0) + a.cat[k];
    if (SHOW_CELLS) {
      const share = (100 * ((CT.energy || 0) + (CT.attack || 0) + (CT.defense || 0) + (CT.special || 0)) / Math.max(1, a.acts));
      console.log('    · 格 ' + CELLS[i].name.padEnd(11) + ' n=' + CELLS[i].n + ' ‖ 夺1 ' + (100 * a.f / GAMES).toFixed(1) + '% ‖ 前2 '
        + (100 * a.t2 / GAMES).toFixed(1) + '% ‖ 活到终局 ' + (100 * a.sv / GAMES).toFixed(1) + '% ‖ 局长 ' + (a.rd / GAMES).toFixed(1)
        + (Number.isFinite(share) ? '' : ''));
    }
  }
  const G = CELLS.length * GAMES;
  const fam = ['energy', 'attack', 'defense', 'special'].map((k) => k[0] + ':' + (100 * (CT[k] || 0) / Math.max(1, AC)).toFixed(1) + '%').join(' ');
  console.log('  ' + pol.label.padEnd(9) + ' ‖ 局 ' + G + ' ‖ 夺1 ' + (100 * F / G).toFixed(1) + '% ‖ 前2 ' + (100 * T2 / G).toFixed(1)
    + '% ‖ 活到终局 ' + (100 * SV / G).toFixed(1) + '% ‖ 局长 ' + (RD / G).toFixed(1) + ' ‖ 出手/局 ' + (AC / G).toFixed(2) + ' ‖ 族 ' + fam);
  tot.push({ key, label: pol.label, win: 100 * F / G });
}
tot.sort((a, b) => b.win - a.win);
console.log('⇒ 阶梯（夺1 从高到低）：' + tot.map((t) => t.label + ' ' + t.win.toFixed(1) + '%').join('  ‖  '));
const lo = tot[tot.length - 1], hi = tot.filter((t) => t.key === 'v7')[0];
if (hi && lo) console.log('  ⇒ 这只尺的可用区间是 [' + lo.win.toFixed(1) + '%（' + lo.label + '） … ' + hi.win.toFixed(1) + '%（v7）]'
  + ' ‖ 任何臂落进这个带的**下半段**时，先问它是不是退化了，再问它学了什么');
/* ⚑ **两条硬自检**（新尺必须能失败，不许"跑了没红"当过）：
 *   ① `v7` 那一行要对得上"参照真值尺"（`ref-baseline.mjs` 在册 40.3% @ 16 格×120 局）⇒ 差 >2.5pt 就是 **arena 漂了**，
 *      今夜所有 `profile2` 的 Δ 读数一起作废。（这条腿的存在理由：mixprobe 第一版因候选面口径差出 6.8pt，当时没人发现。）
 *   ② `均匀乱选` 要落在 [12, 24]% 带内（各格机会水平 n=3 是 33%、n=5 是 20%，混起来应在 25% 以下；
 *      跑出这个带说明对手表或落子逻辑变了，而不是"策略变强了"）。
 * ⚠ `--selfcheck=0` 只用于"我要看形状、不想被拦"，日常别关。 */
const SELFCHECK = !argv.includes('--selfcheck=0');
/* 参照真值分两档：`bigt=12`（出厂档，走 chooser）在册 **40.3%**（`ref-baseline.mjs`）；
 * `bigt=0`（本尺缺省，与固定打法同口径）由本尺自己量出来后钉在这里 = **38.3%**（16 格×120 局，原件 scratch/LADDER-bigt0.log）。 */
/* 两档各自的锚（都是本尺 16 格×120 局实测，原件 `scratch/LADDER-bigt0.log` ‖ `scratch/LADDER-sweep.log`）：
 * bigt=12（出厂档）v7 = **40.4** ≈ `ref-baseline` 在册 40.3 ‖ bigt=0 v7 = **40.2**。 */
const V7_TRUE = BIGT === 0 ? 40.2 : 40.3, RAND_BAND = [12, 24];
if (SELFCHECK && OPP !== 'pool') {
  console.log('  ⚑ 自检跳过：`--opp=' + OPP + '` 换了对手桌 ⇒ v7/rand 那两个锚量的是**原对手表**，在这里不适用（不是"跑过了"）');
} else if (SELFCHECK) {
  const g7 = tot.filter((t) => t.key === 'v7')[0], gr = tot.filter((t) => t.key === 'rand')[0];
  const bad = [];
  if (!g7 || !gr) bad.push('两条锚有一档**没跑**（`--only` 里要同时含 `v7` 与 `rand`，否则这条自检是空的）');
  if (g7 && Math.abs(g7.win - V7_TRUE) > 2.5) bad.push('v7 行读 ' + g7.win.toFixed(1) + '% ‖ 在册参照真值 ' + V7_TRUE + '% ⇒ arena 或对手表漂了');
  if (gr && (gr.win < RAND_BAND[0] || gr.win > RAND_BAND[1])) bad.push('均匀乱选行读 ' + gr.win.toFixed(1) + '% ‖ 该落在 [' + RAND_BAND.join(',') + ']');
  if (bad.length) { console.log('⛔ 阶梯自检红：' + bad.join(' ‖ ') + '\n   ⇒ 这把尺现在的读数**不可比**，先修尺再谈臂。'); process.exit(3); }
  console.log('  ✔ 阶梯自检：v7 行 ' + (g7 ? g7.win.toFixed(1) : '—') + '%（对在册 ' + V7_TRUE + '%）‖ 均匀乱选 ' + (gr ? gr.win.toFixed(1) : '—') + '%（带 ' + RAND_BAND.join('~') + '）');
}
function runKeySweep() {
  const res = [];
  for (const sk of R.skills) {
    const sel = pickBy((c) => c.key === sk.key);
    let F = 0;
    for (let i = 0; i < CELLS.length; i++) F += playCell(sel, CELLS[i], null).f;
    res.push({ key: sk.key, cat: sk.cat, win: 100 * F / (CELLS.length * GAMES) });
  }
  res.sort((a, b) => b.win - a.win);
  return res;
}
/* 阶梯只跑**一次**：`--sweep` / `--pack` / `--anchors` 三个模式共用同一批局号与同一跑序
 *   （脚本型对手带跨局记忆，跑序变了读数会漂 1.4pt ⇒ 同一进程里跑两遍还叫"同一条阶梯"是自欺）。 */
let LADDER_CACHE = null;
function ladderSweep() { if (!LADDER_CACHE) LADDER_CACHE = runKeySweep(); return LADDER_CACHE; }
if (SWEEP) {
  console.log('\n# 逐技能固定打法（每枚都跑同一批 16 格 × ' + GAMES + ' 局）');
  const res = ladderSweep();
  res.forEach((r) => console.log('  ' + r.key.padEnd(10) + ' (' + r.cat[0] + ') ‖ 夺1 ' + r.win.toFixed(1) + '%'));
  console.log('⇒ 单技能阶梯（前 8）：' + res.slice(0, 8).map((r) => r.key + ' ' + r.win.toFixed(1) + '%').join('  ‖  '));
  console.log('   末 3：' + res.slice(-3).map((r) => r.key + ' ' + r.win.toFixed(1) + '%').join('  ‖  '));
  console.log('   ⚑ 用法：把某枚臂的 Δ夺1 与这条阶梯并排——**臂的读数若落在某枚单技能附近，就不能说"标签教出了强度"**，只能说"它退化成那一枚"。');
}
/* ===== 臂放进同一把尺（`--pack=a.bak,b.bak`）：贪心 argmax、同一个手搓候选面 ⇒ 与阶梯同口径 ===== */
if (PACKS.length) {
  const ladderRes = ladderSweep();          // 同一进程、同一跑序里取阶梯 ⇒ 名次可比（跑序漂 1.4pt 那条只在跨批之间才成立）
  const v7Row = tot.filter((t) => t.key === 'v7')[0];
  const randRow = tot.filter((t) => t.key === 'rand')[0];
  console.log('\n# 臂（2.0 的 .bak）放进同一把尺 ‖ 贪心 argmax ‖ 候选面与固定打法逐字相同（temp=' + TEMP + '）');
  for (const pk of PACKS) {
    let raw;
    try { raw = JSON.parse(readFileSync(pk, 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, '')); }
    catch (e) { console.log('  ⛔ 读不到/解不开 ' + pk + '：' + e.message); continue; }
    if (raw.v !== 90) { console.log('  ⛔ ' + pk + ' 不是 2.0 容器（v=' + raw.v + '）⇒ 这条模式只吃 2.0 的包'); continue; }
    const cfg = { mutMode: 'seg', ...(raw.dims || {}) };
    if ((raw.arch || 'S1') === 'S1o') cfg.input = 'obs3';
    const A = installArch2(W, cfg);
    const pp = P.unpack(raw, true);
    if (!pp || pp.length !== P.paramCount()) { console.log('  ⛔ ' + pk + ' 形状不对：' + (pp && pp.length) + ' vs ' + P.paramCount()); A.restore(); continue; }
    const head = Float64Array.from(pp);
    const sel = function (state, pid, legal) {
      const cs = candsOf(state, pid, legal);
      if (!cs.length) return { key: R.SK.JI };
      const f = P.forwardCands(state, pid, cs, head, { temp: TEMP });
      const c = (f && f.cand) || cs[0];
      return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
    };
    const rowsOf = (sel, tag) => {
    let F = 0, T2 = 0, SV = 0, RD = 0, AC = 0, CT = {};
    const CAT = {}; R.skills.forEach((s) => { CAT[s.key] = s.cat; });
    for (let i = 0; i < CELLS.length; i++) {
      const a = playCell(sel, CELLS[i], null);
      F += a.f; T2 += a.t2; SV += a.sv; RD += a.rd; AC += a.acts;
      for (const k in a.cat) CT[k] = (CT[k] || 0) + a.cat[k];
    }
    const G = CELLS.length * GAMES, win = 100 * F / G;
    return { tag, win, top2: 100 * T2 / G, sv: 100 * SV / G, rd: RD / G, ac: AC / G, fam: ['energy', 'attack', 'defense', 'special'].map((k) => k[0] + ':' + (100 * (CT[k] || 0) / Math.max(1, AC)).toFixed(1) + '%').join(' ') };
    };
    const r1 = rowsOf(sel, '贪心 argmax');
    const r2 = rowsOf(T.policyChooserN(head, TEMP), '引擎 chooser');
    for (const r of [r1, r2]) {
      const win = r.win;
      const better = ladderRes.filter((x) => x.win > win).length;
      const pct = 100 * (1 - better / (ladderRes.length + 1));
      console.log('  ' + pk.replace(/^scratch\/arms\//, '') + ' ‖ ' + (raw.arch || 'S1') + ' ‖ ' + r.tag + ' ‖ 夺1 ' + win.toFixed(1) + '% ‖ 前2 '
        + r.top2.toFixed(1) + '% ‖ 活到终局 ' + r.sv.toFixed(1) + '% ‖ 局长 ' + r.rd.toFixed(1) + ' ‖ 族 ' + r.fam);
      console.log('     ⇒ 在 30 枚单技能固定打法里排 **第 ' + (better + 1) + '/31**（百分位 ' + pct.toFixed(0) + '）‖头顶 `' + ladderRes[0].key + '` '
        + ladderRes[0].win.toFixed(1) + '% ‖ v7 参照 ' + (v7Row ? v7Row.win.toFixed(1) : '—') + '% ‖ 均匀乱选 ' + (randRow ? randRow.win.toFixed(1) : '—') + '%');
    }
    A.restore();
    /* ⭐ 第十七段那条口径的**提醒**（只打印、不阻断——差大未必坏：R1 那 7.2pt 是出厂大雷给的真东西，
     *   而 B8 那 21.1pt 是"头只有 3 个分不开的出口"。判语必须靠"并列集合大小"，不是靠差值本身） */
    const dCal = r2.win - r1.win;
    if (Math.abs(dCal) > 8) {
      console.log('     ⚑ 两口径差 **' + dCal.toFixed(1) + 'pt**（>8pt）⇒ 这一行的夺1 有相当一部分由"怎么破并列"决定，'
        + '不是由排序决定。别拿任何一行单独下判语，先跑 `node scratch/bigt-gap.mjs --packs=' + pk + ' --games=10` 读那一列并列集合大小'
        + '（‖ 出厂列：`profile2` 现在自带 ⭐ 那三行）。');
    }
  }
  console.log('   ⚠ 口径：臂行走"贪心 argmax +' + (ENGINE_FACE ? '引擎同口径候选面' : '宽候选面') + '"，'
    + '与 `profile2`（引擎自己的两级 softmax）不是同一条执行路，**必须逐枚对表**（旧宽面时实测 R1 差 6.8pt ‖ B8 差 21pt）：'
    + ' ‖ 另一条：臂的行跑在阶梯之后，而脚本型对手带**跨局记忆**（本尺没 `resetBotMem`）⇒ 同一只固定打法换个跑序实测漂 1.4pt ⇒ 名次读**格**、不读小数。');
}
/* ===== `--anchors=<path>`：把这条阶梯**落成锚文件**给 `profile2` 读 =====
 * 锚里带的每一行都是"profile2 会不会拿它排名次"的**前置条件**，不是元数据装饰：
 *   · `poolFp`/`cells` ⇒ 对手表与桌形（同源于 audit-lib，所以对得上就是真对得上）
 *   · `bigt` ⇒ 大雷那一档（出厂 12，命中时把这一手整个交给大雷 ⇒ 它是**注入**不是排序）
 *   · `temp`/`engineFace` ⇒ 采样温度与候选面
 *   · `gamesPerCell` ⇒ 剂量：锚的 rung 是"每格多少局"平均出来的，读数噪声与它相关，profile2 要按它算 SE
 * ⚠ 写入位置在**两条自检之后**：自检红时脚本已经 exit 3 ⇒ 坏尺落不出锚（这条顺序本身就是判据，别挪）。 */
if (ANCHORS) {
  const res = ladderSweep();
  const rowOf = (k) => tot.filter((t) => t.key === k)[0];
  const randRow = rowOf('rand'), v7Row = rowOf('v7');
  const anchor = {
    tool: 'tools/proto2/ladder.mjs',
    /* 本地时刻**带偏移**（不用 `toISOString()`：那串是 UTC，看日志的人会把它当本地读，差 8 小时——本仓的时刻类病就是这么来的；
     *   也不用 `toString()`：那串跟着系统语言变，中文机器上会带"中国标准时间"，跨机器对账时是噪声）。 */
    generatedAt: (function () {
      const now = new Date(), pad = (x) => String(x).padStart(2, '0');
      const off = -now.getTimezoneOffset();
      return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':'
        + pad(now.getSeconds()) + ' ' + (off >= 0 ? '+' : '-') + pad(Math.floor(Math.abs(off) / 60)) + ':' + pad(Math.abs(off) % 60);
    })(),
    gamesPerCell: GAMES, cellCount: CELLS.length, totalGames: CELLS.length * GAMES,
    temp: TEMP, bigt: BIGT, engineFace: ENGINE_FACE,
    poolFp: POOL_FP, refPack: 'js/bundled-champion-3p.js',
    cells: CELLS.map((c) => c.n + ':' + c.name + ':' + c.idx).join(','),
    rungs: res.map((r) => ({ key: r.key, cat: r.cat, win: Math.round(r.win * 1000) / 1000 })),
    randWin: randRow ? Math.round(randRow.win * 1000) / 1000 : null,
    v7Win: v7Row ? Math.round(v7Row.win * 1000) / 1000 : null,
    caliber: '阶梯 31 格都是**不走 chooser 的固定打法**（不吃大雷注入）；profile2 的臂行走引擎 chooser（吃注入）'
      + ' ⇒ 名次只算**下界**，且必须与并列集合大小一起读（第十七段那条口径）。',
  };
  if (anchor.randWin == null || anchor.v7Win == null || !res.length) {
    console.log('     ⚠ 这一份锚**缺地板/上限/阶梯其中一行**（只有 `--selfcheck=0` 或 `--only` 漏项能走到这里）⇒ profile2 照样能印名次，但"离地板多远"读不出。');
  }
  writeFileSync(ANCHORS, JSON.stringify(anchor, null, 2) + '\n');
  console.log('\n  ✔ 阶梯锚已落 **' + ANCHORS + '** ‖ ' + res.length + ' 枚单技能 ‖ 地板（均匀乱选）'
    + anchor.randWin + '% ‖ 上限（v7）' + anchor.v7Win + '% ‖ 每格 ' + GAMES + ' 局 × ' + CELLS.length
    + ' 格 ‖ bigt=' + BIGT + ' ‖ temp=' + TEMP + ' ‖ 对手表 ' + POOL_FP);
  console.log('     ⇒ 读它：`node tools/proto2/profile2.mjs --pack=…`（默认吃 ' + ANCHORS + '，剂量/指纹对不上就只印"锚过期"）');
}
