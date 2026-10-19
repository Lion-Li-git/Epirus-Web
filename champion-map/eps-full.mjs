#!/usr/bin/env node
/* §E314 全量线上口径：把 coords.tsv 里 718 枚**每一枚**都在两个口径下重测一遍
 *
 * 为什么两个口径都要重测，而不是只测页面口径、旧 H 直接沿用（这是 §E312 那条教训的直接应用）：
 *   coords.tsv 的 H 是**各臂当年各自评测时**落下的，而中间这一个月里 `js/train/evo.js` 的
 *   BIGT_PUSH（p=8→12）、DRAIN_PUSH（默认开）、ε 分支、费用表都动过 ⇒ 旧 H 与新测的页面 H
 *   **可能不是同一台仪器量的**。Δε 若拿"旧 H − 新页面 H"算，就会把代码漂移混进口径差里。
 *   ⇒ 同批、同 seed、两口径成对测，才配叫 Δε；顺带把"旧 H 还复现不复现"这件事本身量出来。
 *
 * 判据（跑前写死）：
 *   (i)  复现守卫：|本次考卷 H − coords.tsv 的 H| 的分布。p50 应 ≈ 0（同 seed 同工具 ⇒ 本应逐字相同）；
 *        若 p50 > 1pt ⇒ **旧 H 已漂移**，图上所有引用旧 H 的历史读数都要挂脚注。
 *   (ii) 覆盖：718 枚里测成的枚数要 ≥ 700，否则不许换尺（缺太多 = 新尺只覆盖一片，图上会出现两种口径混画）。
 *   (iii)换尺前后**名次相关性**：Spearman(F_旧, F_新)。这是"换口径改不改结论"的全库版（§E313 只有 121 枚）。
 *
 * 用法：node champion-map/eps-full.mjs [--seed=77000] [--jobs=4] [--games=120]
 *       [--epsTier=lv:regular]   页面臂的剂量取自 `DIFF_TIERS` 那一档（§E597：不给就还是老写法 ε=0.2 常数 = 今天的**简单档**）
 *       [--pageOnly=1 --examFrom=<同格式表>]   只重测页面臂，考卷列从那张表搬（成立前提见下面 `PAGE_ONLY` 的注释）
 *       [--out=<表>] [--extra=<清单>] [--onlyExtra]
 *   产物：champion-map/epsfull.tsv（增量写，中途可读）= id / exam / page / d / hp_old / ms / examG / pageDose
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync, copyFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { load as loadSlotId } from './slot-identity.mjs';   /* §E608：副名→主名的唯一翻译处（CO_PATH 按主名登记） */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const SEED = Number(arg('seed', 77000)), JOBS = Math.max(1, Number(arg('jobs', 4)));
/* §E569（10-10 晚 · 用户裁定「全部换成 120」）：`--games=` = **同一把卷子的题量档**（每组合局数），默认 30 ⇒ 老用法一字不变。
 *   为什么不是"只测页面、考卷沿用"：判据 (i) 的复现守卫要的就是**同批同 seed 成对**（§E312 那条教训），
 *   换档时两口径一起重测，`d = exam − page` 才是同档的 Δε；否则 Δε 里会混进采样量之差（实测档差中位就有 0.30pt，
 *   与 Δε 的库内中位同量级 ⇒ 混进去就是那条轴自己脏掉）。
 *   产物多带一列 `examG`（§E566「档跟着行走」的同族）：**这张表是哪一档量的，写进行里，不靠文件名和人的记性。** */
const GAMES = Number(arg('games', 30));
if (!isFinite(GAMES) || GAMES <= 0) { console.error('⛔ --games 必须是正数（每组合局数），收到 `' + arg('games', '') + '`'); process.exit(2); }
const OUT = join(HERE, arg('out', 'epsfull.tsv'));   // §E328：可另指一张表，别把两批混进 epsfull.tsv

const CO = readFileSync(join(HERE, 'coords.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
const ch = Object.fromEntries(CO[0].map((h, i) => [h, i]));
const ids = CO.slice(1).map((r) => r[ch.id]).filter(Boolean);
const HOLD = {}; for (const r of CO.slice(1)) HOLD[r[ch.id]] = +r[ch.H];
/* §E328：`--extra=<_e328-extra.tsv>` 把**不在 coords 面板里**的臂产品也拉进来量页面口径
 *   （现役的 183 支子代从没进过图 ⇒ 它们没有 Hp，而 `Hp` 是图上那把头号尺，缺它就画不了）。
 *   `--out=` 同时可指，**不许把两批混进同一张表**（下面那道"已存在就 exit 2"的守卫就是为这件事建的）。
 *   ⚠ 路径必须能指到子目录（这批的产物在 `docs/artifacts/eNN-out/` 下），所以这里存的是 `id → 相对仓库根的路径`。 */
const PATHOF = {};
/* 记哪些枚没用上名单/在册的第一顺位路径（跑完点名印出来）：读数照样是真的，但"这一枚是从哪个文件量的"必须可查。 */
const FALLBACK = {};
/* §E597：coords.tsv 的 `path` 列是**在册的产物路径**（attach-path 那一步写进去的），比"猜 `<id>.bak`"可靠 ⇒ 建一张回退表。 */
const CO_PATH = {}; for (const r of CO.slice(1)) { if (r[ch.id] && r[ch.path]) CO_PATH[r[ch.id]] = r[ch.path]; }
/* `--epsTier=lv:regular` = 页面臂的剂量取自 `DIFF_TIERS` 那一档（**图上头号尺 Hp 从此跟着产品走**，不再挂在一个手抄的 0.2 上）。
 *   用户 10-12 17:4x：「调整了随机之后演化图的 Hp 也要调整了」。 */
const EPS_TIER = arg('epsTier', '');
if (EPS_TIER && !/^(lv:)?[a-z]/.test(EPS_TIER)) { console.error('⛔ --epsTier 得是 `DIFF_TIERS` 的档 id'); process.exit(2); }
/* §E615 `--mode=<multi|long>`：**桌形也是这把尺的一维**（10-16 午实测：同 seed 同档只换桌形，26 枚配对
 *   `Spearman=0.654` ⇒ 两张桌不是同一把尺；而包的 `meta.recipe.env.EPIRUS_TRAIN_MODE` 从 10-15 起普遍写着 `long`）。
 *   原来这条链**从不传 `--mode`** ⇒ 全图 `H`/`Hp` 都落在 `eval-5p` 的默认 `multi`（3 血短程）上。
 *   ⚠ 传了 `--mode` 就必须换 `--out=`：产物多带一列 `mode` 写清"这批是哪张桌量的"，两批**不许混进同一张表**
 *     （同一道守卫，理由同 §E569 的 `examG` 与 §E597 的 `pageDose` —— 档靠行走，不靠文件名和人的记性）。 */
const MODE = arg('mode', '');
if (MODE && MODE !== 'multi' && MODE !== 'long') { console.error('⛔ `--mode` 只认 `multi` / `long`（`js/core/rules.js:123` 的 MODES），收到 `' + MODE + '`'); process.exit(2); }
/* `--pageOnly=1 --examFrom=<同格式表>`：只重测页面臂，考卷列从那张表**原样搬**。
 *   成立的前提是结构性的：ε 只活在页面臂的 chooser 里，`--eps=0`（考卷臂）走的是贪心分支 ⇒ 剂量改动对考卷臂逐字无差。
 *   ⚠ 这么跑的时候 `attach-hp.mjs` 那道"本次考卷 == coords 的 H"守卫是**搬来的、不是测的** ⇒
 *     要真验仪器没漂，就另点 5~8 枚把考卷臂也跑一遍（本机 120 局 ≈ 20 秒/枚，比全库重跑便宜两个数量级）。 */
const PAGE_ONLY = process.argv.includes('--pageOnly=1');
const EXAM_FROM = String(arg('examFrom', ''));
/* §E649（用户 10-18 夜：「页面开先验 ⇒ Hp/Hplong 都要按新口径重跑，但可以筛掉不受影响的枚」）：
 *   `--support=<0|1|2>` **只加在页面臂上**，因为 `Hp` 的定义就是"玩家拿到的那个数"，而玩家那一侧现在开着档 2。
 *   硬要求 `--pageOnly=1 --examFrom=<裸包那张表>`：考卷臂（ε=0 贪心）不属于产品口径，把它也带上先验的话
 *   `d = exam − page` 就不再是 Δε 而是"Δε + 先验效应"混在一个已注册的列名里 —— 那是偷列名的语义（§E278 同族）。
 *   ⇒ 这一跑里 `exam` 与 `d` 都**从 `--examFrom` 那张表原样搬**（保持裸包口径），只有 `page` 是开档新测；
 *     另多写两列：`support`（这批是哪一档量的，档靠行走）‖ `pageBare`（搬来的裸包页面值）
 *     ⇒ **先验效应 = 同一行里的 page − pageBare**，自足、不必去比两张表。 */
const SUPPORT = arg('support', '');
if (SUPPORT !== '') {
  if (['0', '1', '2'].indexOf(SUPPORT) < 0) { console.error('⛔ `--support=` 只认 0/1/2，收到 `' + SUPPORT + '`'); process.exit(2); }
  if (!PAGE_ONLY || !EXAM_FROM) { console.error('⛔ `--support=` 必须配 `--pageOnly=1 --examFrom=<裸包表>`（否则 `d` 列会混进先验效应）'); process.exit(2); }
}
/* knobs 透传（不给就吃引擎默认 ⇒ 与产品逐字同）：`--supportpick=max --supportskip=1` 才回到 §E643/§E647 那个严档。 */
const KNOB_ARGS = [];
for (const [f, sw] of [['supportpick', '--supportpick='], ['supportskip', '--supportskip='], ['supportminep', '--supportminep=']]) {
  const v = arg(f, ''); if (v !== '') KNOB_ARGS.push(sw + v);
}
/* §E649 的筛选（用户的原话是"不送盾的冠军不会被这个规则影响"）：`--only=<清单>` 只跑名单里的枚。
 *   清单 = 每行一个 id（TSV 取第一列）。名单外的**不写行**，由 `attach-hp --more=<裸包表>` 去补值 ⇒
 *   "没测"与"测了且证明不变"分得开（这条规矩本仓踩过：缺行静默当成零）。 */
const ONLY_FILE = arg('only', '');
const ONLY = ONLY_FILE ? new Set(readFileSync(join(HERE, ONLY_FILE), 'utf8').replace(/\r\n/g, '\n').split('\n')
  .map((l) => l.split('\t')[0].trim()).filter((x) => x && !x.startsWith('#'))) : null;
if (ONLY_FILE && !ONLY.size) { console.error('⛔ `--only=` 清单读出来是空的：' + ONLY_FILE + '（空名单会跑出一张全空的表）'); process.exit(2); }
const CARRIED = {};
const CARRIED_D = {}, CARRIED_PAGE = {};
if (PAGE_ONLY) {
  if (!EXAM_FROM) { console.error('⛔ --pageOnly=1 必须给 `--examFrom=<表>`（考卷列从哪儿搬）'); process.exit(2); }
  const ef = join(HERE, EXAM_FROM);
  if (!existsSync(ef)) { console.error('⛔ --examFrom 读不到：' + ef); process.exit(2); }
  const ET = readFileSync(ef, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
  const eh2 = Object.fromEntries(ET[0].split('\t').map((x, i) => [x, i]));
  if (eh2.id === undefined || eh2.exam === undefined) { console.error('⛔ --examFrom 表头缺 id/exam：' + ET[0]); process.exit(2); }
  if (SUPPORT !== '' && (eh2.d === undefined || eh2.page === undefined)) {
    console.error('⛔ 带 `--support=` 时 `--examFrom` 表必须有 `d` 与 `page` 两列（要搬裸包的 Δε 与裸页面值），收到：' + ET[0]); process.exit(2);
  }
  for (const l of ET.slice(1)) { const c = l.split('\t'); if (!c[eh2.id]) continue;
    CARRIED[c[eh2.id]] = c[eh2.exam];
    if (eh2.d !== undefined) CARRIED_D[c[eh2.id]] = c[eh2.d];
    if (eh2.page !== undefined) CARRIED_PAGE[c[eh2.id]] = c[eh2.page]; }
  /* 名单在这里还没定稿（`--extra` 那段在后面）⇒ 缺失统计放到 `reportCarried()`，开跑前叫。 */
  reportCarried();
}
function reportCarried() {
  if (!PAGE_ONLY) return;
  const miss = ids.filter((x) => CARRIED[x] === undefined);
  console.error('--pageOnly=1 ⇒ 考卷臂不重测，从 ' + EXAM_FROM + ' 搬 ' + Object.keys(CARRIED).length + ' 枚'
    + (miss.length ? ' ‖ ⚠ 名单里有 ' + miss.length + ' 枚在那张表里没有行（会记成失败）：' + miss.slice(0, 6).join(',') : ''));
  if (miss.length === ids.length) { console.error('⛔ 一个都搬不到 ⇒ 别出全空的表'); process.exit(2); }
}
const EXTRA = arg('extra', '');
if (EXTRA) {
  const ep = join(HERE, EXTRA);
  if (!existsSync(ep)) { console.error('⛔ --extra= 指向的文件不存在：' + ep); process.exit(2); }
  const EL = readFileSync(ep, 'utf8').trim().split(/\r?\n/);
  const eh = EL[0].split('\t');
  const iArm = eh.indexOf('arm'), iRel = eh.indexOf('productRel');
  if (iArm < 0 || iRel < 0) { console.error('⛔ --extra 表头必须有 arm 与 productRel 两列（收到：' + EL[0] + '）'); process.exit(2); }
  let dupN = 0;
  for (const l of EL.slice(1)) { const c = l.split('\t'); if (!c[iArm] || !c[iRel]) continue; PATHOF[c[iArm]] = c[iRel]; ids.push(c[iArm]); }
  /* §E491 去重：这批 id **已经在 coords.tsv 里**（融合粒这轮进了图）⇒ 原来 `ids.push` 会把它们再塞一遍，
   *   于是 `--onlyExtra` 的"3 枚"实际是 6 枚，表里每个 id 两行（值一样，但白跑一倍 + 下游按行读会重复计数）。
   *   去重放在这里而不是放在写表那一步：一台仪器不该产出重复行。 */
  { const seen = {}; for (let i = ids.length - 1; i >= 0; i--) { if (seen[ids[i]]) { ids.splice(i, 1); dupN++; } else seen[ids[i]] = 1; } }
  console.error('--extra 拉进 ' + Object.keys(PATHOF).length + ' 枚（这些在 coords 里没有行 ⇒ hp_old 留 0，不参与复现守卫）' +
    (dupN ? ' ‖ 去重砍掉 ' + dupN + ' 条重复（这批已在 coords 里有行）' : ''));
  /* `--onlyExtra`：名单**只留**这批。第一版没这条，我拿 2 枚的测试表跑起来实际吃的是 718+2 的全名单
   *   （`--extra` 只加不减）⇒ 100 秒只跑到第 44 枚就被我掐了。要"只补子代"就必须能砍掉原名单。
   * ⚑ **本班（10-17 通宵）实测到这条旗标自己是静默半开的**：原来只认 `process.argv.includes('--onlyExtra')`，
   *   而我按别的旗标的习惯写成 `--onlyExtra=1` ⇒ **完全不生效**，"只跑 2 枚"变成跑整张 800 枚名单
   *   （跑到 v12-86 才被我看见 —— 白烧机器不说，产物表还是往 `--out` 指的那张增量写，看着像"我的实验表"）。
   *   修法：认裸写法与 `=1/true`；`0/false` 算关；**其余值一律 exit 2**（不许再出现"传了等于没传"）；
   *   开了但 `--extra` 没拉到任何一枚也 exit 2（那会把名单砍成空、静默跑 0 枚）。 */
  const oeRaw = process.argv.find(x => x === '--onlyExtra' || x.indexOf('--onlyExtra=') === 0);
  const oeVal = oeRaw === undefined ? '' : (oeRaw.indexOf('=') < 0 ? '1' : oeRaw.split('=')[1]);
  const ONLY_EXTRA = (function () {
    if (oeRaw === undefined || oeVal === '0' || oeVal === 'false') return false;
    if (oeVal === '1' || oeVal === 'true') return true;
    console.error('⛔ `--onlyExtra` 只认裸写法 / =1 / =true / =0 / =false，收到 `' + oeVal + '` ⇒ 拒绝启动（不许"传了等于没传"）');
    process.exit(2);
  })();
  if (ONLY_EXTRA) {
    const keep = new Set(Object.keys(PATHOF));
    if (!keep.size) { console.error('⛔ `--onlyExtra` 要求 `--extra=` 真的拉到枚数（现在 0 枚 ⇒ 名单会被砍空、静默跑 0）'); process.exit(2); }
    for (let i = ids.length - 1; i >= 0; i--) if (!keep.has(ids[i])) ids.splice(i, 1);
    console.error('--onlyExtra ⇒ 本次名单 = ' + ids.length + ' 枚（全部来自 --extra）');
  }
}

/* 线上那颗盘上没有 .bak（§E308 ③ 那条仪器事实）⇒ 现造临时对照品，跑完由调用方删。
 *   §E328：只在名单**真的含** SHIPPED-Ldemo 时才造 —— 跑 `--extra` 那批子代时不需要它，
 *   而在顶层留一个 .bak 就是要欠 D82 的账（24 小时内要么点名要么删）。
 *   ⚠ §E597 加了"没在册路径才造"这个前提：`coords.tsv` 的 `path` 列如今有 Ldemo 自己的权重
 *     （`docs/artifacts/eval-out/win-Ldemo.bak`），而这一支造的是**当下那颗活槽**（v1.6.62 起 = T8-s114）
 *     ⇒ 不加前提就会"用别人的权重出 Ldemo 的读数"（METHODOLOGY 134：活槽身份只能声明，不能按 path 猜）。 */
/* §E608（千问，DS 交接件 §2 那 6 台之一）：这一支原来整个按**副名** `SHIPPED-Ldemo` 判事，
 *   而折行之后 coords 的行 id 只剩主名 `Ldemo` ⇒ 今天 `ids.indexOf('SHIPPED-Ldemo')` 恒为 **-1**（这段是死支，
 *   所以"造出别人的权重挂退役枚名字"那个 §E597 警告的病**现在没有发作**）。但它是**潜伏**的：
 *   只要哪次名单里真出现这个旧叫法（`--extra=` 拿旧表、或有人手抄），第三道守卫 `CO_PATH['SHIPPED-Ldemo']` 就会查不到
 *   （`CO_PATH` 按主名登记）⇒ 于是把**当下活槽** `js/bundled-champion-3p.js` 复制成 `SHIPPED-Ldemo.bak`。
 *   ⇒ 一律先翻成主名再判事；名单里出现副名就说出来。造临时对照品这条路只在"主名也没有在册路径"时才走。 */
const SHIP_ALIAS = 'SHIPPED-Ldemo';
const SHIP_MAIN = (loadSlotId(ROOT).resolve(SHIP_ALIAS) || SHIP_ALIAS);
const SHIP = join(ROOT, 'docs/artifacts/' + SHIP_ALIAS + '.bak');
const shipNamed = ids.indexOf(SHIP_ALIAS) >= 0 || ids.indexOf(SHIP_MAIN) >= 0;
const shipRegistered = !!(CO_PATH[SHIP_MAIN] && existsSync(join(ROOT, CO_PATH[SHIP_MAIN])));
if (ids.indexOf(SHIP_ALIAS) >= 0 && SHIP_MAIN !== SHIP_ALIAS) {
  console.error('⚠ 名单里的 `' + SHIP_ALIAS + '` 是副名 ⇒ 按主名 `' + SHIP_MAIN + '` 的在册路径量（' +
    (CO_PATH[SHIP_MAIN] || '在册路径也没有') + '）‖ **不**造临时对照品：造出来的会是当下活槽的权重挂着退役枚的名字');
}
if (shipNamed && !existsSync(SHIP) && !shipRegistered) {
  copyFileSync(join(ROOT, 'js/bundled-champion-3p.js'), SHIP);
  console.error('已临时造出对照品 docs/artifacts/SHIPPED-Ldemo.bak（跑完请删，留着会撞 D82）');
}
if (existsSync(OUT)) { const done = readFileSync(OUT, 'utf8').trim().split('\n').length - 1;
  console.error('⛔ ' + 'epsfull.tsv 已存在（' + done + ' 行）⇒ 先删再跑，别把两批混成一张表'); process.exit(2); }
/* §E649 的筛选在**名单定稿之后**才砍（`--extra` 那段会往 ids 里加东西，先砍就漏）。 */
if (ONLY) {
  const before = ids.length;
  for (let i = ids.length - 1; i >= 0; i--) if (!ONLY.has(ids[i])) ids.splice(i, 1);
  const notInList = [];
  for (const want of ONLY) if (ids.indexOf(want) < 0) notInList.push(want);
  console.error('--only ⇒ 名单 ' + before + ' → ' + ids.length + ' 枚（名单外 ' + (before - ids.length) + ' 枚**不跑**，'
    + '由 `attach-hp --more=<裸包表>` 补值 ⇒ "没测"与"测过且证明不变"在表里分得开）'
    + (notInList.length ? ' ‖ ⚠ 清单里有 ' + notInList.length + ' 枚不在本次全名单（一行都不会写）：' + notInList.slice(0, 6).join(',') : ''));
  if (!ids.length) { console.error('⛔ `--only=` 把名单砍空了 ⇒ 别出全空的表'); process.exit(2); }
}
const HDR = ['id', 'exam', 'page', 'd', 'hp_old', 'sec', 'examG', 'pageDose', 'mode'];
if (SUPPORT !== '') HDR.push('support', 'pageBare');
writeFileSync(OUT, HDR.join('\t') + '\n', 'utf8');
if (SUPPORT !== '') console.error('⚑ 本批页面臂带先验（`--support=' + SUPPORT + (KNOB_ARGS.length ? ' ' + KNOB_ARGS.join(' ') : '') + '`）'
  + '‖ `exam`/`d` 是从 ' + EXAM_FROM + ' **搬来的裸包值**（不重测）⇒ `d` 仍是裸包 Δε，**先验效应 = 本行 `page − pageBare`**');

function one(id, on) {
  /* 路径按 `--extra` 映射 → coords 的 `path` 列 → `docs/artifacts/<id>.bak` 的顺序找**第一个真在盘上的**：
   *   §E597 实测踩到的两种病都在这条链上 ——
   *     ① 只按 `.bak` 猜 ⇒ 清过缓存的 382 枚全 ENOENT，每枚记成"失败"而表里一行不写、exit 0（§E312 同族）；
   *     ② 名单里那条路径已经掉盘、而 `path` 列还指着真件 ⇒ 拿"最后一个候选"去跑就是白失败
   *        （10-12 晚跑 seed=88000 那批时 `SHIPPED-Ldemo` 就这么 ⛔ 了一次）。
   *   ⚠ 三个候选都不在盘上时**照旧交回最后一个**让 eval-5p 报错，不许静默换一枚包来出数。 */
  const cand = [PATHOF[id], CO_PATH[id], ('docs/artifacts/' + id + '.bak')].filter(Boolean);
  let rel = cand[cand.length - 1];
  for (const c of cand) { if (existsSync(join(ROOT, c))) { rel = c; break; } }
  if (rel !== cand[0] && cand[0]) { FALLBACK[id] = cand[0]; }
  const a = ['tools/eval-5p.mjs', String(GAMES), '5', String(SEED), rel];
  /* 页面口径的剂量来源（§E597）：给 `--epsTier=<档 id>` ⇒ 剂量由产品那张表给（默认档就是玩家实际吃的那条）；
   *   不给就是老写法 `--eps=0.2 --eps-mode=soft`（v1.5.141 时代的常数剂量，如今等于**简单档**那一档）。 */
  if (on) { if (EPS_TIER) a.push('--eps-tier=' + EPS_TIER); else a.push('--eps=0.2', '--eps-mode=soft'); }
  /* §E649：先验只加在**页面臂**上（`Hp` = 玩家拿到的那个数，而玩家那一侧开着档）；考卷臂保持裸包口径。 */
  if (on && SUPPORT !== '') { a.push('--support=' + SUPPORT); for (const k of KNOB_ARGS) a.push(k); }
  /* §E615 两个臂都要带上 `--mode` —— 只给页面臂换桌形的话，`d = exam − page` 就变成"两张桌之差"而不是 Δε */
  if (MODE) a.push('--mode=' + MODE);
  return new Promise((res) => {
    const t0 = Date.now();
    execFile(process.execPath, a, { cwd: ROOT, maxBuffer: 1 << 28, timeout: 300000 },
      (e, so) => res(e ? { err: String(e.message || e).slice(0, 90) } : { v: Number((String(so).match(/\[冠军\] 1st=([\d.]+)%/) || [0, 'NaN'])[1]), sec: ((Date.now() - t0) / 1000).toFixed(1) }));
  });
}
let qi = 0, done = 0, fail = 0;
async function worker() {
  while (qi < ids.length) {
    const id = ids[qi++];
    const pg = await one(id, true);
    const ex = PAGE_ONLY ? { v: Number(CARRIED[id]), err: CARRIED[id] === undefined ? '⛔ --examFrom 那张表里没有这一枚' : '' } : await one(id, false);
    done++;
    if (!isFinite(ex.v) || !isFinite(pg.v)) { fail++; console.error('  ⛔ ' + id + ' ' + (ex.err || '') + ' ' + (pg.err || '')); continue; }
    /* 带先验时 `d` 用搬来的裸包值（**不许**现算 `exam − page`，那会把先验效应塞进一个已注册的列名）；
     *   搬不到就必须响亮失败，不许写空 —— 空 `d` 到 `attach-hp` 那里会变成 `+'' = 0`，静默把 Δε 写成 0。 */
    if (SUPPORT !== '' && (CARRIED_D[id] === undefined || CARRIED_PAGE[id] === undefined)) {
      fail++; console.error('  ⛔ ' + id + ' --examFrom 那张表里没有 d/page 两列的值 ⇒ 不写行（宁缺毋混）'); continue;
    }
    const row = [id, ex.v.toFixed(2), pg.v.toFixed(2),
      SUPPORT !== '' ? CARRIED_D[id] : (ex.v - pg.v).toFixed(2),
      (HOLD[id] || 0).toFixed(2), pg.sec, GAMES,
      EPS_TIER ? ('tier:' + EPS_TIER) : 'eps:0.2-soft', MODE || 'multi(默认)'];
    if (SUPPORT !== '') row.push(SUPPORT, String(CARRIED_PAGE[id]).trim());
    appendFileSync(OUT, row.join('\t') + '\n', 'utf8');
    if (done % 50 === 0) console.error('  … ' + done + '/' + ids.length + ' 枚（失败 ' + fail + '）');
  }
}
(async function () {
  const t0 = Date.now();
  await Promise.all(Array.from({ length: JOBS }, worker));
  console.error('完成 ' + done + ' 枚 / 失败 ' + fail + ' ‖ 用时 ' + ((Date.now() - t0) / 60000).toFixed(1) + ' 分钟（jobs=' + JOBS + '）');
  { const fb = Object.keys(FALLBACK);
    if (fb.length) console.error('⚑ 有 ' + fb.length + ' 枚没用上第一顺位路径（名单/在册路径掉盘，退到下一个候选）：'
      + fb.slice(0, 8).map(function (i) { return i + ' ← ' + FALLBACK[i]; }).join(' ‖ ')
      + (fb.length > 8 ? ' …' : '') + ' ⇒ 引用这批读数时要能说清"是从哪个文件量的"'); }
  /* 覆盖判据 (ii) 是给"全库换尺"那一跑建的（718 枚里 ≥700 才许动头号尺）。
   *   跑 `--onlyExtra` 那批子代、或用 `--only=<清单>` 局部补测时这条不适用 ⇒ 别把"183/183""4/4"读成"够换尺"，也别让它闭嘴（失败数仍然要看）。
   *   §E651 实测到 `--only=` 那一支原来会印"不够换尺，别动图上的头号尺"——可那一跑的目的就是把清单里几格换成新口径，
   *     它问的不是同一个问题（换尺资格由全库那趟撑着），所以把 `--only` 也归进"局部跑"这一支。 */
  if ((EXTRA || ONLY) && ids.length < 400) console.error('判据 (ii) 覆盖：' + (done - fail) + '/' + ids.length +
    ' ⇒ **本次是 --extra/--only 局部跑，"≥700 才许换尺"那条不适用**（图上头号尺的资格由原 epsfull.tsv 的 718 枚全量跑撑着）');
  else console.error('判据 (ii) 覆盖：' + (done - fail) + '/' + ids.length + (done - fail >= 700 ? ' ⇒ 够换尺' : ' ⇒ **不够换尺，别动图上的头号尺**'));
})();
