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
 *        [--members=champion-map/pool-members.tsv] [--out=某.tsv] [--mixSeats=k]
 *        （`--mixSeats=k` 只顶 `scriptMix.seats` 这一维，`min`/`ids` 与推导仍走档位表 + `PD.scriptSeats`
 *          ⇒ 量出来的是"掺 0/1/2/3 席"这四个装配，不是四份抄出来的算法；引用它的数必须带上这句）
 *
 * ===== 主体席模式（§E630 · 10-17 定尺）：`--subject=<包|池内 id|rand>` =====
 * 上面那把量的是**池**（人类原型那一席赢不赢 ⇒ 这桌子拿它没办法吗）。加 `--subject=` 之后量的是**一枚包**：
 *   被考的那一枚坐主体席（`seat = g % N` 照常逐局轮换），另外 4 席仍按 `js/pool-draw.js` 抽 ⇒ **同一个装配，换了坐在中间的是谁**。
 * 为什么要它：在册那把考卷尺（`eps-full`→`eval-5p`，4 席固定脚本）的**历史最高分只比现役高 4.5~9.4pt**
 *   （我 10-17 复算 `coords.tsv` 798 行：long·exam 全库 max 70.1 而现役 65.6 ⇒ +7pt 那条预注册线**历史上 0 枚够得到**），
 *   于是"任何方法都推不动"这个读数里混着"分数没有量程"这一半 —— 换训练法之前得先有一把张得开的尺。
 * 池当尺的**循环**（池成员本来就是按尺筛进来的）用三件事堵死，缺一件就会把漂移读成进步：
 *   ① **每批必带一枚在册参照包同批同盐重测**（`--ref=`，默认 `docs/artifacts/eval-out/win-Ldemo.bak`，
 *      由 `_ctx.mjs:130` 的 `FIXTURE_PACK` 同一枚）⇒ 报的是**配对差**，名单变强时参照也一起掉，差才不是假的；
 *      ⚠ 参照不许用两颗活槽（R3 那条普查的原文：会换主人的指针不是夹具）。
 *   ② **名单签名钉进每一行**（sha1：池表 + tier + 去掉被考两枚后的 `id:wid` 有序表 + 席数 + 桌形 + 两侧剂量）
 *      ⇒ 签名不同的两行**不许并排读**，更不许拿它去重算 rank/带（METHODOLOGY 119/120：两把尺不许并池、进图必须单档）。
 *   ③ **被考的两枚一起从对手席里摘掉**（只摘 subject 的话，subject 臂与 ref 臂的对手名单就不同 ⇒ 那不是配对）。
 *      摘完不足 2 枚 ⇒ exit 2（四席全同是数学必然，读出来的不是强度）。
 *   ④ `--subject=` / `--ref=` 的路径**只认仓库内**（`resolve()` 把它拼在 `ROOT` 底下）。
 *      并发臂常把产物改道到仓库外 ⇒ 那会被本尺 `exit 2` 响亮拒绝而不是静默少读（10-17 实测：四格尺读因此全废一次）。
 *      要量就先把包复制进 `docs/artifacts/<临时目录>/`，**读完即删**（`D191` 查的是"未登记的重复权重"）。
 *
 * ===== §E638 榜模式（v1.7.93）：`--subject=` 收逗号列多枚 ⇒ 尺自己印"榜内名次 / gap / regret" =====
 * 为什么把它搬进尺里：10-17 那张"当选者在榜内第几名"的表是拿三个 scratch 脚本手算的 ——
 *   **能算出来 ≠ 下次还算得出来**（同一族里已经栽过"shell 循环让两格串台"那次）。
 * 口径：① 只给 1 枚 ⇒ **走老形状**（跑序、打印、机器可读 JSON 一字不变，验收线 V1 逐字节比过 20:29 的基线）；
 *       ② 多枚 ⇒ 全列一起摘出对手席 ⇒ 所有行**同一份名单、同一个签名**（不同签名的名次没有意义，文件头第②条）；
 *       ③ 参照臂**每批只跑一次**（N 枚从 2N 臂/批 降到 N+1 臂/批），跑序仍是"被考在前、参照在后"；
 *       ④ 自动追加一行**影子行**（列表第一枚再坐一次主体席，排在最后）⇒ `自证④` 永远有一对可比：
 *          **同一枚在不同位置必须逐批读出相同的差**（不靠"数据里恰好有重复"来触发 —— 那是空转不报错那一族）；
 *       ⑤ `--elected=<id|wid|序号>` 点出该臂当选者 ⇒ 额外印一行名次/gap/regret，并写进 JSON 的 `elected`。
 * ⚠ 三量的读法：**名次与 `gap`（对榜均值）可以当判据**；**`regret`（对榜首）只当描述** ——
 *    榜首是"带噪读数里取 max"，本身正向偏，拿它过线就是把仪器的极值当效应（同 §二十二 那条）。
 * ⚠ 榜模式仍然**只读**：不 promote、不写包、不碰 `pool-members.tsv`。
 * 三条自证（接错线的形状就是"表看着正常而数全是同一个"）：
 *   · `--subject=` 与 `--ref=` 同一枚 ⇒ 逐批配对差**必须恰好 0**，否则 exit 8（配对了个假的）；
 *   · `--subject=rand`（`Bots.pickRandom`）⇒ 随机席**必须明显低于**参照包，否则 exit 8（公平份额锚 20% 接反了）；
 *   · 主体席逐席计数必须轮换均匀（max−min ≤ 1）、每枚对手都上过场、`missSeat` 必须为 0 ⇒ 否则 exit 8。
 * ⚠ 这把尺自己的条款（沿用文件头 ①②）：加 `--games=` 只降仪器噪声、**加批数才升独立组成**；
 *   逐枚读数在 n(独立组成) < 200 时不许排名次。σ 用**批间标准差**，极差不是 σ。
 * `--assertDiff=<pt>`：配对差均值 < 该值 ⇒ exit 9（以后要立门直接吃这个码，不必再写一台仪器）。
 *
 * 退出码：0 ‖ 2 输入/成员不齐 ‖ 7 有成员读不出包（缺行 ≠ 量了没测出来） ‖ 8 自证不过（读数作废） ‖ 9 `--assertDiff` 不过
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sandbox, loadChamp, rejectUnknownFlags, humanPrototypes } from './audit-lib.mjs';
import { duelAssembly } from './v2v4-lib.mjs';
import { widOf } from '../champion-map/pack-id.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
rejectUnknownFlags(process.argv.slice(2),
  ['tier', 'games', 'seeds', 'modes', 'members', 'out', 'n', 'dose', 'mixSeats', 'seat', 'support',
    'subject', 'ref', 'batches', 'seedBase', 'subjectDose', 'assertDiff', 'alsoDrop', 'elected'], 'probe-pool');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const TIER = flag('tier', 'hard'), G = Number(flag('games', 60));
const SEEDS = String(flag('seeds', '90210,90211')).split(',').map(Number).filter(x => !Number.isNaN(x));
const MODES = String(flag('modes', 'multi,long')).split(',').filter(Boolean);
/* v1.7.110：`--seat=<0..4>` 把被测钉在固定席（不设 = 照旧逐局轮换）。0 = 玩家席。 */
const SEATFIX = flag('seat', '') === '' ? null : Number(flag('seat', ''));
if (SEATFIX !== null && !(SEATFIX >= 0 && SEATFIX <= 4)) { console.error('⛔ --seat= 只能是 0..4（收到 `' + flag('seat', '') + '`）'); process.exit(2); }
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
/* v1.7.111：`--support=<0|1|2>` 把送盾先验带上这把尺（页面已默认开档 2 ⇒ A/B 要能在同一把尺上开关）。 */
const SUPPORT = flag('support', '');
if (SUPPORT !== '' && ['0','1','2'].indexOf(SUPPORT) < 0) { console.error('⛔ --support= 只能是 0/1/2（收到 `' + SUPPORT + '`）'); process.exit(2); }
if (SUPPORT !== '') { if (typeof W.EpirusTrainer.setSupportPrior !== 'function') { console.error('⛔ 引擎没导出 setSupportPrior'); process.exit(2); } W.EpirusTrainer.setSupportPrior(Number(SUPPORT)); }
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
/* 剂量解析抽成一个函数（**不是**为了好看）：主体席模式还要再解一份 `--subjectDose=`，
 *   在原地再写一个 if-else 就是同一件事两份实现 ⇒ 两份必然漂移（本仓的老账）。 */
function parseDose(s, who) {
  if (s === 'zero') return { eps: 0, epsK: 1, epsMode: 'soft', label: 'zero（ε=0 纯贪心 = 池轴的单独强度）' };
  if (s.indexOf('table:') === 0) {
    const pid = s.slice(6);
    const tiers = (B && B.DIFF_TIERS) || [];
    const t = tiers.filter(x => x && x.id === pid)[0];
    if (!t) { console.error('⛔ ' + who + '=table:' + pid + ' 在 DIFF_TIERS 里找不到（有的是：' + tiers.map(x => x.id).join(',') + '）'); process.exit(2); }
    if (t.kind !== 'champ') { console.error('⛔ ' + pid + ' 是 `kind:' + t.kind + '` ⇒ 它不吃包，剂量对它无意义'); process.exit(2); }
    return { eps: t.eps, epsK: t.epsK, epsMode: t.epsMode, ramp: !!t.ramp, label: pid + ' 的表值 ε=' + t.eps + '/k' + t.epsK + '/' + t.epsMode + (t.ramp ? '·斜坡(本尺按起手剂量,不模拟逐回合上升)' : '') };
  }
  const m = /^([0-9.]+):([0-9]+):(soft|uniform)$/.exec(s);
  if (!m) { console.error('⛔ ' + who + ' 只认 zero ‖ table:<页档id> ‖ <eps:epsK:soft|uniform>，收到 ' + s); process.exit(2); }
  return { eps: Number(m[1]), epsK: Number(m[2]), epsMode: m[3], label: '显式 ε=' + m[1] + '/k' + m[2] + '/' + m[3] };
}
const DOSE = parseDose(DOSE_ARG, '--dose');
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
let MIX = null, SCRIPTS = {}, SEATNOTE = '';
{
  const tiers = (B && B.DIFF_TIERS) || [];
  /* `--mixSeats=k` 是给"掺几席才算简单"那道扫描用的**顶盖**：只顶 `seats`，`min`/`ids` 仍旧吃表里那一份，
   *   推导仍旧只有 `PD.scriptSeats` 一处 ⇒ 契约 §3.8（"谁都不许抄第二遍"）不破，扫出来的才是同一个装配的不同剂量。 */
  const SEATK = flag('mixSeats', '');
  let users = tiers.filter(t => t.pool === TIER && t.scriptMix);
  if (SEATK !== '') {
    if (!/^\d+$/.test(String(SEATK))) { console.error('⛔ --mixSeats= 只能是非负整数（收到 `' + SEATK + '`）'); process.exit(2); }
    const base = users[0] || tiers.find(t => t.scriptMix);
    if (!base) { console.error('⛔ --mixSeats= 要顶 `scriptMix.seats`，而全表没有任何一档声明 scriptMix ⇒ 没得顶'); process.exit(2); }
    users = [Object.assign({}, base, { scriptMix: Object.assign({}, base.scriptMix, { seats: Number(SEATK) }) })];
    SEATNOTE = ' ‖ ⚑ 本批把 seats 顶成 ' + SEATK + '（`min`/`ids` 仍取 `' + base.id + '` 那份 ⇒ 引用这行数要带这句）';
  }
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
    /* ⚠ 顶盖有可能**顶不上去**：`scriptSeats` 的天花板是 `min(AI席 − min, ids.length)` ⇒ 今天 ids 只有 2 个，
     *   要 3 席实际还是 2 席。不喊出来的话就会有人拿"2 席的数"去引用成"3 席"。
     *   （真要多席得往 `ids` 里加风格 —— "掺几席"与"掺谁"今天其实是**同一根旋钮**。） */
    if (SEATK !== '' && MIX && MIX.seats < Number(SEATK)) {
      console.error('⚠ 顶盖没顶上去：要 ' + SEATK + ' 席，`scriptSeats` 只给到 ' + MIX.seats + ' 席 ⇒ 天花板 = min(AI席 ' +
        (4 - ((users[0].scriptMix || {}).min || 1)) + ' , ids ' + (MIX.ids || []).length + ')）' +
        '**这一批量的是 ' + MIX.seats + ' 席那个装配**，不许当 ' + SEATK + ' 席引用');
    }
  }
}
/* ===== §E630 主体席模式：被考的那一枚坐中间，四席仍是池（口径见文件头） ===== */
const SUBJECT_ARG = String(flag('subject', ''));
if (SUBJECT_ARG) {
  const REF_ARG = String(flag('ref', 'docs/artifacts/eval-out/win-Ldemo.bak'));
  const BATCHES = Number(flag('batches', 0));
  const SEED_BASE = Number(flag('seedBase', 90210));
  const ASSERT_DIFF = flag('assertDiff', '') === '' ? null : Number(flag('assertDiff'));
  const SUBJ_DOSE = parseDose(String(flag('subjectDose', DOSE_ARG)), '--subjectDose');
  if (flag('n', '') !== '') { console.error('⛔ 主体席模式今天只量 5 席（1 主体 + 4 池）⇒ `--n=` 在这里还没接，别拿 2 人桌的池读数当同一条轴'); process.exit(2); }
  const ALL = L.slice(1).map(l => l.split('\t'));
  const bn = s => String(s).split(/[\\/]/).pop();
  function resolve(spec, who) {
    if (spec === 'rand') return { label: 'rand（`Bots.pickRandom` 公平份额锚）', wid: null, chooser: B.pickRandom, id: 'rand' };
    /* 既收路径，也收**池内 id**（扫池成员时逐个写路径太容易点错，而 id 是表里唯一的键） */
    const rowById = ALL.find(r => r[h.id] === spec);
    const p = rowById ? rowById[h.path] : spec;
    if (!existsSync(join(ROOT, p))) { console.error('⛔ ' + who + ' 的包不在库里：' + p + (rowById ? '（表里 id=' + spec + ' 指向它）' : '')); process.exit(2); }
    let params = null; try { params = loadChamp(W, p); } catch (e) { params = null; }
    if (!params) { console.error('⛔ ' + who + ' 解不出权重：' + p + ' ⇒ 按失败处理（不许静默退回别一枚）'); process.exit(7); }
    const wid = widOf(readFileSync(join(ROOT, p), 'utf8')) || null;
    const row = wid ? ALL.find(r => r[h.wid] === wid) : null;
    return { label: p, wid, id: row ? row[h.id] : bn(p), params,
      chooser: T.policyChooserN(params, 0.15, SUBJ_DOSE.eps, SUBJ_DOSE.epsK, SUBJ_DOSE.epsMode) };
  }
  const REF = resolve(REF_ARG, '--ref');
  /* ===== §E638（v1.7.93 · 千问 10-17 晚班）：**榜模式** —— `--subject=` 收逗号列多枚 =====
   * 动因：§二十二 那张"当选者在榜内第几名 / gap / regret"的表是我拿三个 scratch 脚本手算的 ——
   *   能算出来 ≠ 下次还算得出来（同一族里已经栽过"两格串台"）。所以把这一步搬进尺里，
   *   并且**参照臂每批只跑一次**（N 枚从 2N 臂/批 降到 N+1 臂/批）。
   * ⚠ 三条硬约束（预注册见日志 §二十五 25.2）：
   *   ① **只给 1 枚时走老形状**：跑序、打印、机器可读 JSON 一字不变（历史读数还要能引用）；
   *   ② 多枚 ⇒ 全列一起摘出对手席 ⇒ 所有行共用同一份名单与**同一个签名**（否则"名次"是两把尺排出来的）；
   *   ③ 多枚自动追加一行**影子行**（第一枚重复一次，排在末尾）⇒ `自证④` 永远有一对可比：
   *     **同一枚在不同位置必须逐批读出相同的差**。不靠"数据里恰好有重复"来触发（那是空转不报错那一族）。
   * 名次/gap 可以当判据；`regret = 榜内最大 − 该行` **只当描述**（max 取自带噪读数，本身正向偏，不许拿它过线）。 */
  const HALL = SUBJECT_ARG.split(',').map(s => s.trim()).filter(Boolean);
  const IS_HALL = HALL.length > 1;
  const SUBJECTS = HALL.map(function (s) { return resolve(s, '--subject'); });
  const SUBJ = SUBJECTS[0];   /* 老形状里那个"被考者" = 列表第一枚（单枚时就是唯一那枚，行为一字不变） */
  /* 影子行：只在榜模式开 —— 它就是"第一枚再坐一次主体席"，位置排最后 */
  const SHADOW = IS_HALL ? { arm: SUBJECTS[0], tagSuffix: '（影子行）', shadowOf: 0 } : null;
  const ARMS = SUBJECTS.concat(SHADOW ? [SHADOW.arm] : []);
  /* ③ 两枚一起摘：只摘被考者会让两臂的对手名单不同 ⇒ 那就不叫配对。
   *   `--alsoDrop=id1,id2` 是给**扫多枚**用的：把这一批要考的都先摘出去 ⇒ 所有行共用同一份名单 ⇒ 同一个签名，
   *   才谈得上并排读（不传就是各摘各的，一行一个签名，行与行不是同一把尺）。 */
  const ALSO_DROP = String(flag('alsoDrop', '')).split(',').map(s => s.trim()).filter(Boolean);
  const DROP = new Set(ARMS.map(a => a.wid).concat([REF.wid]).filter(Boolean));
  const unknown = ALSO_DROP.filter(id => !members.some(r => r[h.id] === id));
  if (unknown.length) { console.error('⛔ --alsoDrop 里有 tier=' + TIER + ' 名单认不出的 id：' + unknown.join(' ‖ ') +
    '（在册的：' + members.map(r => r[h.id]).join(' ') + '）⇒ 名字拼错不许静默少摘一枚'); process.exit(2); }
  for (const id of ALSO_DROP) { const w = members.find(r => r[h.id] === id)[h.wid]; if (w) DROP.add(w); }
  if (SUBJ.wid && members.some(r => r[h.wid] === SUBJ.wid) && ALSO_DROP.indexOf(SUBJ.id) < 0) {
    console.log('⚑ 被考者本身在 ' + TIER + ' 名单里（' + SUBJ.id + '）⇒ 已摘出对手席，所以**这一行的签名与"新包"那批不同**；' +
      '要跨枚并排读就用 `--alsoDrop=` 把要扫的都列上（同一份名单才同一把尺）');
  }
  const ROSTER = members.filter(r => !DROP.has(r[h.wid])).map(r => ({ id: r[h.id], wid: r[h.wid] }));
  if (ROSTER.length < 2) {
    console.error('⛔ 摘掉被考的两枚（' + [SUBJ.id, REF.id].join(' ‖ ') + '）之后 tier=' + TIER + ' 只剩 ' + ROSTER.length +
      ' 枚 ⇒ 四席全同在数学上必然（用户裁定不许）⇒ 这一档还没成型，先别量'); process.exit(2);
  }
  /* ② 名单签名：签名不同的两行不是同一把尺（METHODOLOGY 119/120） */
  const sigOf = mode => createHash('sha1').update(['poolruler~1', TABLE, TIER,
    ROSTER.map(m => m.id + ':' + m.wid).sort().join(','), 'aiSeats=4', 'N=5', 'mode=' + mode, 'G=' + G,
    'dose=' + DOSE.label, 'subjectDose=' + SUBJ_DOSE.label].join('|')).digest('hex').slice(0, 16);
  const SEEDS_RUN = BATCHES > 0
    ? Array.from({ length: BATCHES }, (_, i) => SEED_BASE + i * 1000003)     /* 步数 1000003：与盐里那个乘数互质，批次之间不给"复用盐"留门 */
    : SEEDS;
  if (SEEDS_RUN.length < 2) { console.error('⛔ 至少两批（--batches=≥2 或 --seeds=≥2 枚）⇒ 一批量不出 σ，只能给一个孤零零的均值'); process.exit(2); }

  console.log('# 主体席尺（1 席被考包 + 4 席按 tier=' + TIER + ' 逐席抽 · 允许重复 · 禁四席全同 · 被考两枚一起摘出对手席）');
  if (IS_HALL) console.log('# 被考 ' + SUBJECTS.length + ' 枚（**榜模式**：全列一起摘出对手席 ⇒ 所有行同一份名单、同一个签名，才谈得上并排排名次）：' +
    SUBJECTS.map(function (s) { return s.id + '(' + (s.wid || '—') + ')'; }).join(' ‖ ') +
    '  · 参照 ' + REF.label + '（id=' + REF.id + ' ‖ wid=' + (REF.wid || '—') + '）' +
    '\n#   影子行 = 第 1 枚重复坐一次主体席（排在最后）⇒ `自证④` 永远有一对可比：**同一枚在不同位置必须逐批读出相同的差**');
  else console.log('# 被考 ' + SUBJ.label + '（id=' + SUBJ.id + ' ‖ wid=' + (SUBJ.wid || '—') + '）· 参照 ' + REF.label +
    '（id=' + REF.id + ' ‖ wid=' + (REF.wid || '—') + '）');
  console.log('# 对手席剂量 ' + DOSE.label + ' ‖ 被考席剂量 ' + SUBJ_DOSE.label + '   ← 引用读数必须带上这两句');
  console.log('# 名单 ' + ROSTER.length + ' 枚（摘掉 ' + DROP.size + ' 枚）：' + ROSTER.map(m => m.id).join(' ‖ '));
  console.log('# ' + G + ' 局/批 × ' + SEEDS_RUN.length + ' 批（seedBase=' + SEED_BASE + ' 步长 1000003' +
    (BATCHES > 0 ? '' : ' ‖ 这批吃的是 --seeds= 列出来的 ' + SEEDS_RUN.length + ' 枚') + '）· 两臂同 seed 同盐 ⇒ 逐批配对\n');

  const rowsOut = [];
  const HALL_ROWS = [];      /* §E638 榜模式：每个口径一行的榜账（名次/gap/regret 的来源） */
  let HALL_LAST = null;
  let fail = null;
  for (const mode of MODES) {
    const SIG = sigOf(mode);
    const agg = { salts: new Set(), comps: new Set(), seatCnt: [0, 0, 0, 0, 0], memberG: {}, memberW: {}, allSame: 0, miss: 0, games: 0 };
    const per = { subj: [], ref: [], diff: [], subjDraw: [], refDraw: [] };
    /* 榜模式：每枚（含影子行）各自一条逐批序列 */
    const HALLPER = IS_HALL ? ARMS.map(function () { return { subj: [], diff: [], subjDraw: [] }; }) : null;
    /* 自证③（席位接线）抽成一个函数 —— 老形状与榜模式**共用同一份判据**（同一件事不许抄两遍）。
     *   每一档都印（**包括 rand 与同枚两臂**）：它证的是"席位接线"，与被考者是包还是随机席无关；
     *   门 `D234`⑥b 正是靠这一行的存在来判"自证有没有真跑"（不印 = 跳过了自证还报绿）。 */
    function selfTest3() {
      const usedN = agg.seatCnt.filter(x => x > 0).length, mxv = Math.max.apply(null, agg.seatCnt), mnv = Math.min.apply(null, agg.seatCnt);
      /* v1.7.110：--seat= 钉住固定席时，要判的是「全部落在那一席」，不是「轮换均匀」（两种断言互斥）。 */
  if (SEATFIX !== null) {
    const othersAll = agg.seatCnt.every((v, i) => (i === SEATFIX ? v >= 0 : v === 0));
    if (!othersAll || agg.seatCnt[SEATFIX % 5] <= 0) return '自证③ 不过：--seat=' + SEATFIX + ' 要求主体席固定在那一席（各席 ' + agg.seatCnt.join('/') + '）';
    console.log('   ✔ 自证③（席位接线 · 钉席模式）：主体席全部落在 ' + SEATFIX + ' 号席（各席 ' + agg.seatCnt.join('/') + '）');
    return null;
  }
  if (usedN < 5 || mxv - mnv > 1) return '自证③ 不过：主体席只出现在 ' + usedN + '/5 席（各席 ' + agg.seatCnt.join('/') +
        ' ⇒ 极差 ' + (mxv - mnv) + '）⇒ 被考的那一枚没有逐席轮换，读数里掺的是座位';
      const noShow = ROSTER.filter(m => !agg.memberG[m.id]);
      if (noShow.length) return '自证③ 不过：名单里有 ' + noShow.length + ' 枚一场没上（' + noShow.map(m => m.id).join(' ‖ ') + '）⇒ 抽签与席位的接线断了';
      if (agg.miss) return '自证③ 不过：' + agg.miss + ' 次决策没分配到成员（落回缺省包）⇒ 组成漏席';
      console.log('   ✔ 自证③（席位接线）：主体席逐席 ' + agg.seatCnt.join('/') + ' ‖ ' + ROSTER.length + ' 枚对手全部上场 ‖ 漏席 0');
      return null;
    }

    /* 一臂 = 一批（seed）× G 局。回调用局部闭包 ⇒ 两臂之间不共享状态（共享就会把上一臂的组成算到这一臂头上）。 */
    function runArm(arm, seed) {
      let curState = null, cur = null, win = 0, drawN = 0, games = 0, mismatch = 0;
      const chooserFor = function (pid, st) {
        if (st !== curState) {
          curState = st;
          const comp = PD.compose(ROSTER, 4, PD.rng((st.slotSalt >>> 0) || 1));
          cur = { comp, byPid: {}, order: 0 };
        }
        if (!(pid in cur.byPid)) cur.byPid[pid] = cur.comp.seats[cur.order++];
        const m = cur.byPid[pid];
        if (!m) { agg.miss++; return null; }
        if (m.kind === 'script') { mismatch++; return null; }
        return CHOOSERS[m.id];
      };
      const onGame = function (st, scriptedSeat) {
        games++; agg.games++;
        agg.salts.add((st.slotSalt >>> 0) || 1);
        agg.comps.add(cur.comp.seats.map(s => s.id + ':' + s.seat).join('|'));
        if (cur.comp.allSame) agg.allSame++;
        agg.seatCnt[Number(scriptedSeat)]++;
        for (const pid in cur.byPid) {
          const id = cur.byPid[pid].id;
          agg.memberG[id] = (agg.memberG[id] || 0) + 1;
          if (st.winner === Number(pid)) agg.memberW[id] = (agg.memberW[id] || 0) + 1;
        }
        if (st.winner === Number(scriptedSeat)) win++;
        else if (st.winner === 'draw') drawN++;
      };
      const r = duelAssembly({ S: S, Play: Play, T: T, R: R }, ROSTER.length ? PARAMS[ROSTER[0].id] : arm.params,
        { games: G, mode: mode, seed0: seed, scripted: arm.chooser, chooserFor: chooserFor, onGame: onGame, seatFix: SEATFIX });
      if (mismatch) { console.error('⛔ 对手席里出现了脚本席（' + mismatch + ' 次）⇒ 主体席模式不掺席，装配不是我说的那个'); process.exit(2); }
      if (games !== G) { fail = '主体席跑了 ' + games + ' 局而声明是 ' + G + ' 局 ⇒ 对局循环没跑满，读数作废'; return null; }
      /* ⚑ 第四条自证（v1.7.83 起升级成**逐位**对照）：我数到的主体席夺1率必须等于 `duelAssembly` 的未取整列 `winRate`。
       *   以前 `winPct` 取整到 1pt ⇒ 这条只能要求"取整后相等"（自带 ±0.5pt 容差，正是它第一次跑把我咬出来的：
       *   我数 12.50% 它报 13）；现在 `winPct` 是 0.1pt、`winRate` 未取整 ⇒ 断言强度提到 ±1e-9，席位接错一律作废。 */
      const rate = 100 * win / games;
      if (Math.abs(rate - r.winRate) > 1e-9) {
        fail = '主体席夺冠率自证不过（' + arm.tag + '）：我数 ' + win + '/' + games + ' = ' + rate.toFixed(4) +
          '% ‖ duelAssembly 报 winRate=' + r.winRate.toFixed(4) + '% ⇒ 席位接线错了，本批读数作废';
        return null;
      }
      return { rate: rate, drawRate: drawN / games * 100, win: win, games: games };
    }

    console.log('== 口径 ' + mode + ' ‖ 名单签名 ' + SIG + ' ==');
    for (const seed of SEEDS_RUN) {
      const rates = [];
      let broke = false;
      /* 跑序与 v1.7.92 一致：先被考（榜模式则按列表顺序 + 末尾影子行），后参照 ⇒ 参照每批只跑一次 */
      for (let ai = 0; ai < ARMS.length; ai++) {
        const a = runArm({ tag: IS_HALL ? ('subj#' + ai) : 'subj', chooser: ARMS[ai].chooser, params: ARMS[ai].params }, seed);
        if (a === null) { broke = true; break; }
        rates.push(a);
      }
      const b = runArm({ tag: 'ref', chooser: REF.chooser, params: REF.params }, seed);
      if (broke || b === null) break;
      /* index 0 = 被考者 ⇒ 单枚时下面这几行与改动前逐字同值（验收线 V1 就钉这个） */
      per.subj.push(rates[0].rate); per.ref.push(b.rate); per.diff.push(rates[0].rate - b.rate);
      per.subjDraw.push(rates[0].drawRate); per.refDraw.push(b.drawRate);
      if (IS_HALL) for (let ai = 0; ai < ARMS.length; ai++) {
        HALLPER[ai].subj.push(rates[ai].rate);
        HALLPER[ai].diff.push(rates[ai].rate - b.rate);
        HALLPER[ai].subjDraw.push(rates[ai].drawRate);
      }
    }
    if (fail) break;
    if (IS_HALL) {
      /* ===== 榜模式的报告：名次 / gap / regret（口径与判据见文件头 §E638 与日志 §二十五）===== */
      const mn = v => v.reduce((x, y) => x + y, 0) / v.length;
      const sdv = v => { const m = mn(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, v.length - 1)); };
      const rows = SUBJECTS.map(function (s, i) {
        const d = HALLPER[i].diff, m = mn(d), sD = sdv(d), se = sD / Math.sqrt(d.length);
        return { id: s.id, wid: s.wid, diff: m, sd: sD, se: se, t: se > 0 ? m / se : Infinity, subj: mn(HALLPER[i].subj), batch: d };
      });
      /* 自证④：影子行（列表第一枚再坐一次）必须与它那行**逐批**相同 ⇒ 证"位置不影响读数" */
      const sh = HALLPER[ARMS.length - 1].diff, first = rows[0].batch;
      const shDiff = sh.map((v, i) => Math.abs(v - first[i]) > 1e-12 ? 1 : 0).reduce((a, b) => a + b, 0);
      if (shDiff) { fail = '自证④ 不过：同一枚（' + SUBJECTS[0].id + '）坐在第 1 位与坐在最后（影子行）有 ' + shDiff + '/' + sh.length +
        ' 批配对差不同（最大 ' + Math.max.apply(null, sh.map((v, i) => Math.abs(v - first[i]))).toFixed(4) +
        '）⇒ 各枚的臂之间共享了状态，名次/gap/regret 全是假的，本批读数作废'; break; }
      const meanOfAll = mn(rows.map(r => r.diff));
      /* 老自证① 的榜版推广：任何一行若与参照同权重 ⇒ 它那列必须逐批恰好 0（同一份权重坐在主体席与坐在参照席应当打平） */
      for (let si = 0; si < SUBJECTS.length; si++) {
        if (!SUBJECTS[si].wid || SUBJECTS[si].wid !== REF.wid) continue;
        const nz = HALLPER[si].diff.filter(d => Math.abs(d) > 1e-9);
        if (nz.length) { fail = '自证①(榜版) 不过：第 ' + (si + 1) + ' 行与参照同权重（' + SUBJECTS[si].id + '）却有 ' + nz.length + '/' +
          HALLPER[si].diff.length + ' 批差不为 0 ⇒ 两臂没真配对'; break; }
        console.log('   ✔ 自证①(榜版)：第 ' + (si + 1) + ' 行与参照同权重 ⇒ ' + HALLPER[si].diff.length + ' 批差恰好 0');
      }
      const best = rows.reduce((a, b) => b.diff > a.diff ? b : a, rows[0]);
      const order = rows.map((r, i) => i).sort((a, b) => rows[b].diff - rows[a].diff);
      console.log('   榜（' + rows.length + ' 枚 · 同一份名单同一签名 ‖ 参照 ' + REF.id + ' 每批只跑一次）：');
      console.log('   名次 | 被考 | 夺1% | 配对差 | σ | SE | t | gap(对榜均值) | regret(对榜首,只当描述)');
      order.forEach(function (ri, k) {
        const r = rows[ri];
        console.log('   ' + String(k + 1).padStart(2) + ' | ' + r.id.padEnd(14) + ' | ' + r.subj.toFixed(2).padStart(6) +
          ' | ' + ((r.diff >= 0 ? '+' : '') + r.diff.toFixed(2)).padStart(7) + ' | ' + r.sd.toFixed(2).padStart(5) +
          ' | ' + r.se.toFixed(2).padStart(5) + ' | ' + (Number.isFinite(r.t) ? r.t.toFixed(2) : '∞').padStart(6) +
          ' | ' + ((r.diff - meanOfAll >= 0 ? '+' : '') + (r.diff - meanOfAll).toFixed(2)).padStart(7) +
          ' | ' + (best.diff - r.diff).toFixed(2).padStart(6));
      });
      console.log('   榜均值 ' + meanOfAll.toFixed(2) + 'pt ‖ 榜首 ' + best.id + ' ' + best.diff.toFixed(2) + 'pt' +
        ' ‖ 极差 ' + (best.diff - order.map(ri => rows[ri].diff).reduce((a, b) => Math.min(a, b), Infinity)).toFixed(2) + 'pt');
      console.log('   ✔ 自证④（影子行 ⇒ 位置不影响读数）：' + sh.length + ' 批逐字相同（' + SUBJECTS[0].id + ' 坐第 1 位 ‖ 坐末位）');
      console.log('   ⚑ `regret` 那列是"对榜首的差"，`max` 取自带噪读数 ⇒ **本身正向偏，只当描述、不许拿去判过线**（日志 §二十二 那条）。');
      const electRaw = String(flag('elected', ''));
      if (electRaw) {
        const ei = rows.findIndex(function (r) { return r.id === electRaw || r.wid === electRaw || String(rows.indexOf(r) + 1) === electRaw; });
        if (ei < 0) { console.error('⛔ --elected 认不出来：' + electRaw + '（榜里的 id：' + rows.map(r => r.id).join(' ‖ ') + '）⇒ 拒绝按"没点到"静默跳过'); process.exit(2); }
        const rk = order.indexOf(ei) + 1;
        console.log('   ★ 当选者 ' + rows[ei].id + ' 在榜内名次 **' + rk + '/' + rows.length + '** ‖ gap=' +
          (rows[ei].diff - meanOfAll >= 0 ? '+' : '') + (rows[ei].diff - meanOfAll).toFixed(2) + 'pt ‖ regret=' +
          (best.diff - rows[ei].diff).toFixed(2) + 'pt（描述）');
        HALL_LAST = { mode: mode, rank: rk, n: rows.length, gap: +(rows[ei].diff - meanOfAll).toFixed(2), regret: +(best.diff - rows[ei].diff).toFixed(2) };
      }
      console.log('   ⚠ 下面这行自证③是**全臂合起来**的账（榜模式里含所有被考者与参照 ⇒ 与单枚那档同一口径，只是样本更多）。');
      const s3h = selfTest3(); if (s3h) { fail = s3h; break; }
      console.log('');
      rowsOut.push({ mode: mode, sig: SIG, batch: '__mean', subj: rows[0].subj.toFixed(2), ref: mn(per.ref).toFixed(2),
        diff: rows[0].diff.toFixed(2), subjDraw: mn(HALLPER[0].subjDraw).toFixed(2), refDraw: mn(per.refDraw).toFixed(2),
        games: per.diff.length + ' 批' });
      rowsOut.push({ mode: mode, sig: SIG, batch: '__hall', subj: best.subj.toFixed(2), ref: best.id, diff: best.diff.toFixed(2),
        subjDraw: '—', refDraw: '—', games: rows.length + ' 枚' });
      HALL_ROWS.push({ mode: mode, sig: SIG, mean: +meanOfAll.toFixed(2), best: best.id, bestDiff: +best.diff.toFixed(2),
        rows: rows.map(function (r) { return { id: r.id, wid: r.wid, subj: +r.subj.toFixed(2), diff: +r.diff.toFixed(2), sd: +r.sd.toFixed(2), se: +r.se.toFixed(2) }; }) });
      if (!fail) continue;   /* 榜模式走完自己这套报告，跳过老形状那段（老形状保持一字不变） */
    }

    const mean = v => v.reduce((x, y) => x + y, 0) / v.length;
    const sd = v => { const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, v.length - 1)); };
    const mS = mean(per.subj), mR = mean(per.ref), mD = mean(per.diff), sD = sd(per.diff);
    const seD = sD / Math.sqrt(per.diff.length), tD = seD > 0 ? mD / seD : Infinity;
    console.log('   批 | 被考夺1% | 参照夺1% | 配对差 | 被考平局 | 参照平局');
    per.subj.forEach((v, i) => {
      console.log('   ' + String(i + 1).padStart(2) + ' | ' + v.toFixed(2).padStart(7) + ' | ' + per.ref[i].toFixed(2).padStart(8) +
        ' | ' + ((per.diff[i] >= 0 ? '+' : '') + per.diff[i].toFixed(2)).padStart(7) +
        ' | ' + per.subjDraw[i].toFixed(2).padStart(7) + ' | ' + per.refDraw[i].toFixed(2).padStart(7));
      rowsOut.push({ mode: mode, sig: SIG, batch: SEEDS_RUN[i], subj: v.toFixed(2), ref: per.ref[i].toFixed(2),
        diff: per.diff[i].toFixed(2), subjDraw: per.subjDraw[i].toFixed(2), refDraw: per.refDraw[i].toFixed(2), games: G });
    });
    console.log('   均值 | ' + mS.toFixed(2) + ' | ' + mR.toFixed(2) + ' | **配对差 ' + (mD >= 0 ? '+' : '') + mD.toFixed(2) + 'pt**' +
      '（σ(配对差)=' + sD.toFixed(2) + ' ‖ ' + per.diff.length + ' 批 ⇒ SE=' + seD.toFixed(2) + ' ‖ t=' + (Number.isFinite(tD) ? tD.toFixed(2) : '∞') +
      ' ‖ 判得动的下限：1σ=' + seD.toFixed(2) + ' ‖ 2σ=' + (2 * seD).toFixed(2) + 'pt）' +
      ' ‖ 平局 被考 ' + mean(per.subjDraw).toFixed(2) + '% / 参照 ' + mean(per.refDraw).toFixed(2) + '%');
    rowsOut.push({ mode: mode, sig: SIG, batch: '__mean', subj: mS.toFixed(2), ref: mR.toFixed(2), diff: mD.toFixed(2),
      subjDraw: mean(per.subjDraw).toFixed(2), refDraw: mean(per.refDraw).toFixed(2), games: per.diff.length + ' 批' });
    console.log('   ⚑ 公平份额 = ' + (100 / 5).toFixed(1) + '%（5 席）⇒ 参照包坐主体席应当高于它；低于它说明参照已经不该再当参照');
    /* 结构自证 ①：同一枚两臂 ⇒ 配对差必须逐批恰好 0 */
    if (SUBJ.wid && SUBJ.wid === REF.wid) {
      const nz = per.diff.filter(d => Math.abs(d) > 1e-9);
      if (nz.length) { fail = '自证① 不过：--subject 与 --ref 是同一枚（wid=' + SUBJ.wid + '）却有 ' + nz.length + '/' + per.diff.length + ' 批配对差不为 0 ⇒ 两臂没真配对（盐/席位/剂量有一处没共用）'; break; }
      console.log('   ✔ 自证①（同枚两臂 ⇒ 差恰好 0）：' + per.diff.length + ' 批全过');
    }
    /* 结构自证 ②：随机席必须明显低于参照包 */
    if (SUBJECT_ARG === 'rand') {
      if (!(mS < mR)) { fail = '自证② 不过：`rand` 席 ' + mS.toFixed(2) + '% 不低于参照 ' + mR.toFixed(2) + '% ⇒ 公平份额锚接反了（多半是主体席没换成随机 chooser）'; break; }
      console.log('   ✔ 自证②（公平份额锚）：随机席 ' + mS.toFixed(2) + '% < 参照 ' + mR.toFixed(2) + '%（差 ' + (mR - mS).toFixed(2) + 'pt）');
    }
    const s3 = selfTest3(); if (s3) { fail = s3; break; }
    console.log('   ⚑ 四席全同 ' + agg.allSame + ' / ' + agg.games + ' 场 ‖ 独立盐 ' + agg.salts.size + ' ‖ 独立"成员×席位"配对 ' + agg.comps.size +
      (agg.comps.size < 200 ? ' ⇒ **<200：逐枚夺冠率不许用来排名次**（文件头第②条），只能当整体读数' : ''));
    console.log('   逐枚对手夺冠率：' + ROSTER.map(m => m.id + ' ' + ((agg.memberW[m.id] || 0) / Math.max(1, agg.memberG[m.id]) * 100).toFixed(1) +
      '%(上场 ' + (agg.memberG[m.id] || 0) + ')').join(' ‖ '));
    console.log('   ⚠ 上面那行是**对手**的账，不是被考包的排名；且它随名单签名变 ⇒ 换池之后不许与旧行并排读。\n');
  }

  if (fail) { console.error('⛔ ' + fail); process.exit(8); }
  if (flag('out', '')) {
    const cols = ['mode', 'sig', 'batch', 'subj', 'ref', 'diff', 'subjDraw', 'refDraw', 'games'];
    writeFileSync(join(ROOT, flag('out')), cols.join('\t') + '\n' + rowsOut.map(r => cols.map(c => r[c]).join('\t')).join('\n') + '\n');
    console.log('✔ 已写 ' + flag('out'));
  }
  const last = rowsOut.filter(r => r.batch === '__mean');
  console.log('\n# 机器可读（给门与以后的自己核对签名与配对差用）：');
  console.log(JSON.stringify({ subject: SUBJ.id, subjectWid: SUBJ.wid, ref: REF.id, refWid: REF.wid, tier: TIER,
    roster: ROSTER.length, rosterIds: ROSTER.map(m => m.id), games: G, batches: SEEDS_RUN.length, seedBase: SEED_BASE,
    dose: DOSE.label, subjectDose: SUBJ_DOSE.label,
    perMode: last.map(r => ({ mode: r.mode, sig: r.sig, subj: +r.subj, ref: +r.ref, diff: +r.diff,
      subjDraw: +r.subjDraw, refDraw: +r.refDraw })),
    /* 榜模式才加这几个键（单枚时**一个字都不加** ⇒ 老读者/门的解析形状不变，验收线 V1） */
    ...(IS_HALL ? { hall: true, subjects: SUBJECTS.map(function (s) { return { id: s.id, wid: s.wid }; }),
      hallRows: HALL_ROWS, elected: HALL_LAST } : {}),
    assertDiff: ASSERT_DIFF }));
  if (ASSERT_DIFF !== null) {
    const worst = last.map(r => r.diff).sort((a, b) => a - b)[0];
    if (!(worst >= ASSERT_DIFF)) { console.error('⛔ --assertDiff=' + ASSERT_DIFF + ' 不过：最差那格配对差 ' + worst + 'pt'); process.exit(9); }
    console.log('✔ --assertDiff=' + ASSERT_DIFF + ' 过（最差那格 ' + worst + 'pt）');
  }
  process.exit(0);
}

console.log('# 池形态新尺（1 席人类形状 + 4 席按 tier=' + TIER + ' 抽 · 允许重复 · 禁四席全同' +
  (MIX && MIX.seats ? ' ‖ 掺脚本席 ' + MIX.seats + ' 席：' + MIX.ids.join(' ‖ ') : ' ‖ 不掺脚本席') + '）' + SEATNOTE);
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
  /* ⚑ 机制探针（§E600-B 尾，10-13 03:3x）：`全程刷反弹` 那一格跨三带六个格子有五个是**往下**的（掺席反而让纯反射墙更难）。
   *   假设：脚本席的廉价进攻少 ⇒ **落在人类席上的进攻变少**，一面墙没什么可反弹。
   *   数得出来而不用改引擎：`damage` 事件带 `to`（受害者）‖ `reflect` 带 `by:'proto'`（人类侧反弹成功）‖ 进攻动作按 `R.byKey[key].cat === 'attack'` 分。
   *   自证：真跑过场子之后这三个数不许全是 0（接错线的形状就是"读数全 0 而表看着正常"）。 */
  const press = {};                                   /* 格名 → {dOn, dAmt, rfl, atk, rounds, games} */
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
      { /* 机制探针的账（见上面 `press` 那段）：按"人类那一席"统计落在它身上的伤害、它用**反弹卡**格挡的次数、场上 AI 的进攻动作数。
         *   ⚠ 第一版这里接过错线：`type:'reflect' && by:'proto'` 是**原型制御·转移**（resolve.js 的 `protoReflectAll`，要一回合累计 ≥3 伤才触发），
         *     不是 反弹 卡 ⇒ 每一格都数到 0.00 而表看着一切正常。反弹卡的账在 `type:'blocked' && by:'反弹'`（`:503`）。 */
        const hum = Number(scriptedSeat);
        const p = press[curCell || '(没格名)'] || (press[curCell || '(没格名)'] = { dOn: 0, dAmt: 0, blk: 0, rfl: 0, proto: 0, atk: 0, rounds: 0, games: 0 });
        for (const e of (st.events || [])) {
          if (e.type === 'damage' && Number(e.to) === hum) { p.dOn++; p.dAmt += Number(e.amt) || 0; }
          /* 反弹卡的两条去路（resolve.js 的守卫分支 `g === 'reflect'`）：
             · `type:'reflect' ‖ by:'reflect'` = **挡下并把这份伤害打回来源**（`REFLECTABLE` 的 via、且有真来源、且不是二次反弹）；
             · `type:'blocked'  ‖ by:'反弹'`   = 只挡不反击（不可反弹的 via / 无来源 / 已被反弹过的）。
             ⚠ 别把 `by:'proto'` 当成反弹卡 —— 那是**原型制御·转移**（`protoReflectAll`，一回合累计 ≥3 伤才触发）。 */
          else if (e.type === 'reflect' && e.by === 'reflect') p.rfl++;
          else if (e.type === 'reflect' && e.by === 'proto') p.proto++;
          else if (e.type === 'blocked' && Number(e.to) === hum && e.by === '反弹') p.blk++;
          else if (e.type === 'action' && e.outcome === 'ok' && Number(e.pid) !== hum &&
            ((R.byKey || {})[e.key] || {}).cat === 'attack') p.atk++;
        }
        p.rounds += Number(st.round) || 0; p.games++;
      }
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
        { games: G, mode: mode, seed0: seed, scripted: x[1], chooserFor: chooserFor, onGame: onGame, seatFix: SEATFIX });
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
  /* §E600-B（10-13）：脚本席**也上场、也被上面那个循环记了账**，但它不在 `lite` 里 ⇒ 那行永远不报它
   *   ⇒ "掺进来的脚本席自己有多强"这条是**问得出、报不出**（用户要"脚本有基础强度"，先得看得见它）。
   *   同口径（同一场、同一座位轮换）；⚠ 也受文件头第 ② 条那个"独立组成少"的折扣，不许拿来排名次。 */
  const scriptIds = Object.keys(memberGames).filter(id => !lite.some(m => m.id === id)).sort();
  if (scriptIds.length) console.log('   脚本席自身夺冠率（同口径 ‖ 人类席占的那部分不在这里）：' + scriptIds.map(id => id + ' ' +
    ((memberWins[id] || 0) / Math.max(1, memberGames[id]) * 100).toFixed(1) + '%(上场 ' + memberGames[id] + ')').join(' ‖ '));
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
  /* 机制探针的输出：每格四个数（落在人类席的伤害事件数/回合 ‖ 人类用反弹卡格挡/局 ‖ 原型制御转移/局 ‖ AI 进攻动作/回合）。
   *   两条自证：① 一格都没数到 / 每格全 0 ⇒ exit 8；② **正对照**：`全程刷反弹` 那一格整场只在反弹，
   *   它的"反弹格挡/局"如果是 0，那是计数器接错线（第一版就是这么错的），不是"墙没反弹"。 */
  const pc = Object.keys(press);
  let pz = 0;
  console.log('   ⚑ 压力账（机制探针 · 解释 `全程刷反弹` 那个反例用）：落在人类席的伤害·每回合 ‖ 反弹反击·每局 ‖ 只挡不反击·每局 ‖ 原型制御转移·每局 ‖ AI 进攻·每回合');
  for (const cn of pc) {
    const p = press[cn];
    if (!p.dOn && !p.blk && !p.rfl && !p.atk) pz++;
    console.log('      ' + cn.padEnd(15) + (p.dOn / Math.max(1, p.rounds)).toFixed(3) + ' ‖ ' +
      (p.rfl / Math.max(1, p.games)).toFixed(2) + ' ‖ ' + (p.blk / Math.max(1, p.games)).toFixed(2) + ' ‖ ' +
      (p.proto / Math.max(1, p.games)).toFixed(2) + ' ‖ ' +
      (p.atk / Math.max(1, p.rounds)).toFixed(3) +
      '（n=' + p.games + ' 局 · ' + p.rounds + ' 回合 · 人类挨到的伤害合计 ' + (p.dAmt / Math.max(1, p.games)).toFixed(2) + '/局）');
    rows.push({ mode: mode, cell: '__press:' + cn, seedVals: p.games + '局/' + p.rounds + '回合',
      mean: (p.dOn / Math.max(1, p.rounds)).toFixed(4),
      spread: '反击/局 ' + (p.rfl / Math.max(1, p.games)).toFixed(3) + ' ‖ 只挡/局 ' + (p.blk / Math.max(1, p.games)).toFixed(3) +
        ' ‖ atk/回合 ' + (p.atk / Math.max(1, p.rounds)).toFixed(4) });
  }
  if (!pc.length || pz === pc.length) {
    console.error('⛔ 压力账一个数都没数到（格子 ' + pc.length + ' 个 · 全 0 的 ' + pz + ' 个）⇒ 事件字段接错线，本批读数作废');
    process.exit(8);
  }
  const wall = press['全程刷反弹'];
  if (wall && !(wall.rfl + wall.blk > 0)) {
    console.error('⛔ 正对照失败：`全程刷反弹` 那格跑了 ' + wall.games + ' 局却数到 **0 次反弹**（反击 ' + wall.rfl + ' ‖ 只挡 ' + wall.blk + '）'
      + ' ⇒ 是这台探针接错了事件字段（不是"墙没反弹"），本批压力账作废');
    process.exit(8);
  }
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
