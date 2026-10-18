#!/usr/bin/env node
/* rebuild-coords.mjs —— §E375：把"重画这张图"的**五步顺序**写成一台可重跑的链，而不是记在各脚本头注里的部落知识。
 *
 * 为什么要单独一台：这一列顺序原来是散着的（attach-kin 说它搬 Sc、attach-path 说它要先跑、attach-hp 说覆盖 ≥700），
 *   而**跑错顺序不会报错、只会静默换形状**。实测踩到的两种：
 *     ① attach-hp 跑在 attach-path/attach-dup 之前 ⇒ Hp/De 落在中间，跑在之后 ⇒ 落在表尾；
 *        更要命的是**重跑一次 attach-hp 就在表尾多一对 Hp/De**（连跑三次 → 36 列变 40 列、三个同名 Hp），
 *        下游按表头查列只看得见第一对 ⇒ 现在 attach-hp 自己幂等了，这台再兜一层"列名不许重复"。
 *     ② attach-path 的 --ruler 不给全 ⇒ 没覆盖到的枚退回"顶层 <id>.bak"猜路径（§E330 那个同名旧拷贝的病）。
 *
 * 顺序（§E605-A 之后共九步 + §E615 的 `attach-hlong` 第十步；列序 = 产物列序，`Sc/Scd/Scs/Sch/kin` 五列从此落在 `aliasN/aliasIds` 之后）：
 *   1) ruler-figs       画几何（26 列：id…z3 + 13 个行为列 ‖ §E605：声明了 examG 的行优先 ‖ §E605-A：面板在册的副名不许复活）
 *   2) attach-hp        头号尺 Hp 与 Δε（§E605：来源表显式点名 --table=，缺省 epsfull.tsv 会把整批换档）
 *   3) attach-path      path 列（--ruler= 必须覆盖**全部**枚，否则就是猜 ‖ §E605-A：转发第①步那批输入）
 *   4) attach-dup       dupN/dupOf（按权重身份去重，要吃 path 列）
 *   5) proj-tsne        重算投影 xt/yt/xt3/yt3/zt3（§E489：少了它页面会逐行静默退回旧力导向）
 *   6) 盖档 examG        §E605：链子里原来没有任何一步写这列 ⇒ 页内"全图只能一个档"那条会红，只能人手补跑 switch-gear
 *   7) fold-coords      折行：一行 = 一份权重（§E605 新第⑦步；尺表按折行前的名字记着，不折就会把 192 个副名复活）
 *   8) relabel-lineage  身份从解析来（§E600-A 的权威定义；以前是人手补的一手）
 *   9) attach-kin       搬上一版当选键四列 + 打 kin + 冠军对账（**挪到折行之后** —— 用户 10-14 裁 A）
 *
 * 用法：node champion-map/rebuild-coords.mjs [--extra=champion-map/e370-ruler.tsv]
 *                                            [--from=<上一版 coords.tsv>] [--dry]
 * ⚠ 会覆盖 champion-map/coords.tsv（先自己备份，这台不动 git）。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync, readdirSync, existsSync as ex } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const EXTRA = String(arg('extra', 'champion-map/e370-ruler.tsv'));
const DRY = process.argv.includes('--dry');
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const CO = join(HERE, 'coords.tsv');
/* §E605（用户 10-14 裁"五条全修"的第③条）：几何输入的缺省**把 120 档那张放在第一位**。
 *   真正的牙在 `ruler-figs.mjs` 里（"声明了 examG 的行永远优先于没声明的"，与次序无关），
 *   但缺省名单里原来根本没有 120 那张 ⇒ 按缺省跑一遍就是"整张图换成 30 档的 H"。
 *   对照实测：`ruler120-2026-10-10-all.tsv` 覆盖现面板 **794/794** 且声明 `examG=120`；`ruler-all.tsv` 只有 713 枚且**没有档列**。 */
const RULER0 = String(arg('ruler', 'champion-map/ruler120-2026-10-10-all.tsv,champion-map/ruler-all.tsv'));
const ruler = RULER0 + (EXTRA ? ',' + EXTRA : '');
/* §E605 第⑤条：头号尺 `Hp` 的来源表原来用 attach-hp 的缺省 `epsfull.tsv` ⇒ 逐张数值普查（排除面板自身的拷贝）：
 *   `epsfull-tier-2026-10-12.tsv` **page→Hp 794/794 且 d→De 794/794**（pageDose 全部 = `tier:lv:regular`）‖
 *   `epsfull120-2026-10-10.tsv` 20/794 ‖ `epsfull.tsv` 14/597 ‖ `e597-out/pool-hp2.tsv` 139/139（只盖池那批）‖ `e328-epsfull.tsv` 2/116。
 *   ⇒ 现面板的 Hp **不是两层叠的**，就是 §E597 那张按档量的表；链子按 attach-hp 的缺参跑会把 794 行整批换成最旧那一批。
 *   改法：这台显式把来源表交给第③步（`--hp=` 可覆盖），派生出来的配对表只作**补充**（attach-hp 的 --more 只填 --table 没覆盖到的枚）。 */
const HPBASE = String(arg('hp', 'epsfull-tier-2026-10-12.tsv'));

/* --from 缺省 = **git 里那一版 coords.tsv**（不是工作树那一版：工作树可能正是我马上要覆盖的目标）。
 *   attach-kin 靠它把当选键四列原样搬过来，少了它就得重跑两小时的 attach-sc。 */
let FROM = String(arg('from', ''));
if (!FROM) {
  FROM = 'docs/artifacts/e375-out/coords-from-git.tsv';
  /* §E554：这台把自己的落点**写死**在一个可能被清理掉的产物目录里，而清理是常规动作 ⇒ ENOENT 直接死在第 42 行
   *   （10-09 早上清缓存之后就撞上了）。链子必须自带它自己依赖的那一步（METHODOLOGY 106 的同族）⇒ 目录不在就先建。 */
  mkdirSync(join(ROOT, dirname(FROM)), { recursive: true });
  const txt = execFileSync('git', ['show', 'HEAD:champion-map/coords.tsv'], { cwd: ROOT, maxBuffer: 1 << 26, encoding: 'utf8' });
  writeFileSync(join(ROOT, FROM), txt.replace(/\r\n/g, '\n'));
  console.log('--from 缺省取 git HEAD 那一版 ⇒ ' + FROM + '（' + txt.trim().split('\n').length + ' 行）');
}
console.log('几何输入 ' + ruler + ' ‖ 上一版 coords.tsv = ' + FROM);
if (!existsSync(join(ROOT, FROM))) { console.error('⛔ --from 读不到：' + FROM); process.exit(2); }
if (DRY) { console.log('--dry：不跑任何一步'); process.exit(0); }

const run = (script, args, tag) => {
  const out = execFileSync('node', [join(HERE, script)].concat(args), { cwd: ROOT, maxBuffer: 1 << 26, encoding: 'utf8' });
  console.log('—— ' + tag + ' ——\n' + out.trim().split('\n').slice(-3).join('\n'));
};

/* 1) 几何。ruler-figs 除了 --coords 还固定往自己目录甩四张静态图 ⇒ 顺手挪走，别脏工作树 */
run('ruler-figs.mjs', ['--ruler=' + ruler, '--coords=champion-map/coords.tsv'], '① ruler-figs 画几何');
for (const f of ['e287-ladder.svg', 'e287-map2.svg', 'e287-map3.svg', 'e287-figs.html']) {
  const p = join(HERE, f); if (ex(p)) { mkdirSync(join(ROOT, 'docs/artifacts/e375-out'), { recursive: true });
    renameSync(p, join(ROOT, 'docs/artifacts/e375-out/rc-static-' + f)); } }
/* ===== §E491 第②步的 --more 原来写死两张表 ⇒ 新加的枚**天生没有 Hp/De** =====
 *   `Hp` 是图上那把头号尺（F = Hp/100 + T·S），而查看器把空 Hp 当 0 算 ⇒
 *   本轮三枚融合粒在图上排到 728/732，用户拿截图问"这个点都排到倒数去了，显然不是噪声"。
 *   实测补测：它们的线上口径 Hp = 51.8 / 52.8 / 53.0，而现役是 47.3 ⇒ **在现役之上 4.5~5.7pt**，
 *   那 728 名完全是"未测被当 0"造出来的假象。
 *   ⇒ --more 现在从 --extra 派生（`<批>-ruler.tsv` 的同名 `<批>-epsfull.tsv`），
 *     少一张就**当场停**（不许静默少测 —— 收尾那条核验也会兜住）。 */
const HPMORE = ['e328-epsfull.tsv'];
/* §E605 第⑥条：派生配对表名的那条 `base.replace(/-ruler\.tsv$/,'')` 只认"批名以 -ruler.tsv 结尾"这一种形状，
 *   而 METHODOLOGY 120.4「先并成一张再喂」给出的名字是 `ruler120-2026-10-10-all.tsv` ⇒ 它要的文件是
 *   `ruler120-2026-10-10-all.tsv-epsfull.tsv`（不存在，且**永远不会存在**）。
 *   改法：认两种尾巴（`-ruler.tsv` 与 `.tsv`），落空时把盘上真实存在的候选**列出来**给人挑，
 *   而不是只报一个拼出来的假名字 —— 报错里给的路径必须是他能改的东西。 */
{ const missMore = [];
  const all = existsSync(HERE) ? readdirSync(HERE).filter(x => x.endsWith('-epsfull.tsv')) : [];
  for (const s of String(EXTRA).split(',').map(x => x.trim()).filter(Boolean)) {
    const fn = s.replace(/^.*[\\/]/, '');
    const base = fn.replace(/-ruler\.tsv$/, '').replace(/\.tsv$/, '');
    if (!base) continue; const t = base + '-epsfull.tsv';
    if (HPMORE.indexOf(t) < 0 && existsSync(join(HERE, t))) HPMORE.push(t);
    else if (HPMORE.indexOf(t) < 0) missMore.push(t + '（来自 --extra 的 ' + fn + '；盘上同族候选：' + (all.slice(0, 8).join(' ') || '一张都没有') + '）'); }
  if (missMore.length) { console.error('⛔ 这批 ruler 表没有配对的线上口径表：' + missMore.join(' ‖ ') +
    '\n       ⇒ 这些枚会**没有 Hp**，而 Hp 是图上头号尺（空值在查看器里当 0 算 ⇒ 名次直接掉到倒数）。' +
    '\n         补测：node champion-map/eps-full.mjs --extra=<那个 extra 表> --onlyExtra --out=<上面那张表名>' +
    '\n         或者用 --hp=<已有那张线上口径表> 直接点名（本台的 Hp 来源缺省 = ' + HPBASE + '）。'); process.exit(2); } }
/* §E605-A（用户 10-14 裁 A）：`relabel-lineage` 与 `attach-kin` **不在这里跑了**，挪到折行之后（第⑧⑨步）。
 *   理由实测过：attach-kin 那条对账问的是"冠军枚数对不对"，而这个仓库里身份的权威定义只有一处（`slot-identity` 的解析），
 *   在**还没折完、尺表按旧名字记着**的表上做这件事永远会红 —— 昨天报 -5、插入 relabel 之后报 -4，两次都卡在同一个次序问题上。
 *   折行之后一行=一份权重，身份从解析来、对账在同一张表上做，这两步才谈得上"对得上"。
 *   代价（已如实告诉用户并得到点头）：`Sc/Scd/Scs/Sch/kin` 五列从此落在 `aliasN/aliasIds` 之后 ⇒
 *   面板的**列序**与 git 里那一版不同（读者全部按列名 indexOf 取数，语义不变；对照复现的比法因此改成"按列名逐列比"，见本文件收尾那条）。 */
run('attach-hp.mjs', ['--table=' + HPBASE, '--more=' + HPMORE.join(',')], '② attach-hp 头号尺（来源 ' + HPBASE + ' ‖ 补 ' + HPMORE.join(' ‖ ') + '）');
/* §E488：这一步原来把 `e370-ruler.tsv` **写死**在 --ruler 里，而不是转发 `--extra=` 的那一串
 *   ⇒ 正是本文件头注自己列的第 ② 条病（"attach-path 的 --ruler 不给全 ⇒ 没覆盖到的枚退回顶层猜路径"）：
 *   本轮加三枚融合粒时，它们的 path 变成"按 <id>.bak 猜"，attach-path 自己的守卫当场拒绝（那是对的）。
 *   改成从 EXTRA 派生（attach-path 按本目录解析，所以取 basename）。*/
/* §E605-A：这里原来写死 `--ruler=ruler-all.tsv`（+ EXTRA 的 basename）⇒ 换档/折行之后覆盖不全，
 *   没覆盖到的枚会退回"顶层 <id>.bak 猜路径"，而 attach-path 自己的守卫会当场拒绝（那是对的，但红的是链子的缺省，不是产品）。
 *   改成把第①步那批几何输入**原样**转发（取 basename，attach-path 按 champion-map/ 解析）。 */
run('attach-path.mjs', ['--ruler=' + String(RULER0).split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/^.*[\\/]/, '')).concat(
  String(EXTRA).split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/^.*[\\/]/, ''))).join(',')], '③ attach-path 真用的文件');
run('attach-dup.mjs', [], '④ attach-dup 权重身份去重');
/* §E489 第六步是**必需的**，原来链子里没有它 ⇒ 谁跑一遍重建，页面就**静默退回旧投影**：
 *   ① ruler-figs 只落 36 列（xt/yt/xt3/yt3/zt3 不在它名单里），投影是 proj-tsne 事后**追加**的；
 *   viewer.mjs 那边走的是 `(PROJTSNE && r.xt) ? r.xt : r.x2` 这种**逐行**退路 ⇒ 列整列没了它也不喊，
 *   只是把 920 枚全画回力导向那一版（kNN@10 保住率 0.52 → 0.08）。
 *   实测踩过：本轮加 3 枚融合粒跑完五步，用户当场看出"投影变回很早的版本、区分度很低"。 */
run('proj-tsne.mjs', [], '⑤ proj-tsne 重算投影（xt/yt/xt3/yt3/zt3）');

/* ===== §E605 第⑥步：盖档 `examG`（原来链子里**没有任何一步**写这一列）=====
 *   病：页内有一条"每一行都必须带考卷档且全图只能一个档"（`viewer.mjs` 的 §E569 那条腿），而链子的六步里没有产出者
 *   —— `grep -l examG champion-map/*.mjs` 只有 eps-full / eps2seed / switch-gear / k8measure / ruler-measure 命中 ⇒
 *   跑完链子那一列整列空 ⇒ 页检当场红，而且只能靠人再手跑一次 `switch-gear` 遮过去（METHODOLOGY 106：链子必须自带它依赖的那一步）。
 *   现在由这台自己盖：档 = 第①步那批几何输入**声明过的唯一值**（`ruler-figs` 里同一套规则；两边不一致时第①步先停）。
 *   列次也是刻意的：`examG` 排在投影之后（= 现役面板第 42 列），这样跑完的表与 git 里那张**逐列同序**。 */
{ const L0 = rd(CO), h0 = L0[0].split('\t');
  const gears = new Set();
  for (const s of String(RULER0).split(',').map(x => x.trim()).filter(Boolean)) {
    const p = s.indexOf('/') < 0 ? join(HERE, s) : (existsSync(join(ROOT, s)) ? join(ROOT, s) : join(HERE, s));
    if (!existsSync(p)) continue; const T = rd(p), th = T[0].split('\t'); const g = th.indexOf('examG');
    if (g < 0) continue; for (const l of T.slice(1)) { const c = l.split('\t'); if (c[g] && c[g].trim()) gears.add(c[g].trim()); } }
  if (gears.size === 0) { console.error('⛔ 第⑥步盖不了档：这批几何输入**没有任何一张**声明 examG ⇒ 全图无从判断是哪种档（宁可不写，不许凭缺省猜一个数盖上去）。'); process.exit(2); }
  if (gears.size > 1) { console.error('⛔ 第⑥步盖不了档：输入里出现 ' + gears.size + ' 种档（' + [...gears].join(' ‖ ') + '）⇒ 单档规矩破了'); process.exit(2); }
  const GEARV = [...gears][0];
  const iG0 = h0.indexOf('examG');
  const body0 = L0.slice(1).map(l => l.split('\t'));
  if (iG0 >= 0) {
    const bad = body0.filter(r => String(r[iG0] || '').trim() !== GEARV).map(r => r[0]);
    if (bad.length) { console.error('⛔ 第⑥步：表里已有 examG 列，但 ' + bad.length + ' 行不是 ' + GEARV + '（前 8：' + bad.slice(0, 8).join(' ') + '）⇒ 不是单档，停'); process.exit(2); }
    console.log('⑥ 盖档：已有 examG 列且 ' + body0.length + ' 行全是 ' + GEARV + ' ⇒ 不改一个字节');
  } else {
    const eol = readFileSync(CO, 'utf8').indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    const out = [h0.concat(['examG']).join('\t')].concat(body0.map(r => r.concat([GEARV]).join('\t')));
    writeFileSync(CO, out.join(eol) + eol, 'utf8');
    console.log('⑥ 盖档 ✅ 新列 examG = ' + GEARV + ' 局/组合，写在第 ' + (h0.length + 1) + ' 列（' + body0.length + ' 行无一为空）');
  } }

/* ===== §E605 第⑦步：折行（一行 = 一份权重）=====
 *   为什么必须进链子：喂进来的现测尺（`ruler-all` ‖ `ruler120-…`）全是**按折行前的名字**记的，
 *   所以第①步一起手就把 986 个名字全复活了（实测：产物 986 行，其中 192 行是已被折掉的副名）。
 *   不折就往下走 = 同一份权重画两个点，而这正是用户 10-14 裁掉的那件事（"同权重只算一枚"）。
 *   `--i-resolved-consumers` 在这里是**诚实的**：消费者（slot-identity ‖ viewer ‖ pool-sync ‖ ruler-measure ‖ usage-probe）本班已改成认副名指针。
 *   主名判据加了一条稳定性优先（见 fold-coords 的 §E605 那段）：已经在册的主名**不许**被重排换掉，否则每重跑一次图就换一批名字。 */
{ const e3 = execFileSync('node', [join(HERE, 'fold-coords.mjs'), '--i-resolved-consumers'], { cwd: ROOT, maxBuffer: 1 << 26, encoding: 'utf8' });
  console.log('—— ⑦ fold-coords 折行 ——\n' + e3.trim().split('\n').slice(-4).join('\n')); }

/* ===== §E605-A 第⑧步：`relabel-lineage` —— 身份**从解析来**，现在跑在折好的那张表上 =====
 *   为什么必须在折行之后：这一步的输入是"面板上的行"，而第①步复活的 192 个副名也是行 ——
 *   在折之前的表上做身份，同一份权重会有两行各自被解析点名（实测产物里 `SHIPPED-Ldemo` 拿到身份而 `Ldemo` 没有）。
 *   这个仓库对"上过槽"的权威定义只有一处：`slot-identity.mjs`（timeline 逐提交解出的权重 + history 的声明行）。
 *   它以前是**人手跑的**（在册面板就是它的产物），链子里没有 ⇒ 每次重画都要人再补一手（METHODOLOGY 106）。 */
run('relabel-lineage.mjs', ['--all-true'], '⑧ relabel-lineage 身份从解析来（折行之后）');

/* ===== §E605-A 第⑨步：`attach-kin` —— 搬上一版的当选键四列 + 打 kin + 冠军对账 =====
 *   这条对账问的是"带身份的行数 = 旧表 + 本轮新增"，它**只有在一行=一份权重的表上**才谈得上对得上，所以跟着 A 挪到这里。
 *   上一版（第②步位置）的实测：不挪 ⇒ 差值 -5；只插入 relabel 仍 -4（`SHIPPED-Ldemo ‖ eco-34-v7 ‖ v7a-35 ‖ v7n1-31 ‖ T8-s114` 五枚点名）。 */
run('attach-kin.mjs', ['--from=' + FROM], '⑨ attach-kin 搬当选键 + 打 kin + 冠军对账');

/* ===== ⑩ attach-hlong：**长程桌**那五列（§E615）=====
 * 2026-10-18 补：这条链原来**没有它** ⇒ 每次重建都把 `Hlong/Hplong/Flong/okLong/failsLong` 丢掉，
 *   页面上"长程考卷"那一维读成 null ⇒ 用户看到的是"**完全缺位**"（数据一直在 `epsfull-long-2026-10-16.tsv`，只是没挂回来）。
 * 放在最后：它按 id 匹配、列落表尾，不扰动前九步的列序；缺源表时它自己会响亮退出（"先跑 eps-full --mode=long"）。
 * ⚠ 它只写这五列、**不动坐标**，也不换绿环（换环=换判据主语，在册待裁 #47）。 */
run('attach-hlong.mjs', [], '⑩ attach-hlong 长程桌三列 + 全腿长程过线');

/* 收尾核验：列名不许重复、每行宽度一致、lineage/kin 两列的类必须还是那几类 */
const L = rd(CO), h = L[0].split('\t'), rows = L.slice(1).map(l => l.split('\t'));
const dup = h.filter((c, i) => h.indexOf(c) !== i);
const badW = rows.filter(r => r.length !== h.length);
console.log('\n产物 ' + rows.length + ' 行 × ' + h.length + ' 列 ‖ 列序 ' + h.join(','));
if (dup.length) { console.error('⛔ 表头有重复列名：' + dup.join(',') + ' ⇒ 下游按名字查列会拿到旧的那一列'); process.exit(2); }
if (badW.length) { console.error('⛔ ' + badW.length + ' 行宽度不等于表头 ⇒ 列错位'); process.exit(2); }
const iLin = h.indexOf('lineage'), iKin = h.indexOf('kin');
const cls = {}; rows.forEach(r => { const k = (r[iLin] || r[iKin] || '层内'); cls[k] = (cls[k] || 0) + 1; });
console.log('身份分布 ' + Object.entries(cls).map(([k, v]) => k + ' ' + v).join(' ‖ '));
/* §E489 投影五列必须在、且每行都是数：少一列或空一半，页面就会**悄悄**画成旧布局（症状见上面第⑥步那段）。
 *   这条核验放在链子的**最后**而不是第⑥步里 —— 判的是"产物能不能被下游用"，不是"某一步跑没跑"。 */
{ const miss = ['xt', 'yt', 'xt3', 'yt3', 'zt3'].filter(c => h.indexOf(c) < 0);
  if (miss.length) { console.error('⛔ 投影列缺失：' + miss.join(',') + ' ⇒ 第⑥步没跑成（viewer 会逐行退回 x2/y2 那套旧力导向坐标 ‖ kNN@10 从 0.52 掉回 0.08）'); process.exit(2); }
  const badNum = [];
  for (const c of ['xt', 'yt', 'xt3', 'yt3', 'zt3']) { const i = h.indexOf(c);
    const n = rows.filter(r => !isFinite(parseFloat(r[i]))).length; if (n) badNum.push(c + ' ' + n + ' 行不是数'); }
  if (badNum.length) { console.error('⛔ 投影列有非数：' + badNum.join(' ‖ ')); process.exit(2); }
  console.log('投影自证 ✅ xt/yt/xt3/yt3/zt3 五列齐全，' + rows.length + ' 行全是数（旧力导向那套 x2/y2 仍在表里，只是不再被页面取用）'); }
/* §E491 头号尺不许有空洞：`Hp` 空 = 查看器按 0 算 F = "线上口径夺1率 0%"，一枚没测过的包会被画成库内倒数。
 *   本轮实测踩过：三枚融合粒 Hp 空 ⇒ 名次 728/732，而补测之后是 51.8/52.8/53.0（现役 47.3）。
 *   `De`（Δε）同源同判 —— 它俩都来自 attach-hp 那一步。 */
{ const noHp = []; for (const c of ['Hp', 'De']) { const i = h.indexOf(c);
    if (i < 0) { console.error('⛔ 表里没有 ' + c + ' 列 ⇒ 第③步没跑成'); process.exit(2); }
    const n = rows.filter(r => String(r[i]).trim() === '').map(r => r[0]);
    if (n.length) noHp.push(c + ' 空 ' + n.length + ' 枚：' + n.slice(0, 8).join(' ')); }
  if (noHp.length) { console.error('⛔ 头号尺有空洞 ⇒ ' + noHp.join(' ‖ ') +
    '\n       空 Hp 在查看器里当 0 算（F = Hp/100 + T·S），那几枚会被画成库内倒数 —— 这不是"弱"，是"没测"。' +
    '\n       补测：node champion-map/eps-full.mjs --extra=<这批的 ruler 对应的 extra 表> --onlyExtra --out=<eNN-epsfull.tsv>，再重跑本链。'); process.exit(2); }
  console.log('头号尺自证 ✅ Hp/De 两列 ' + rows.length + ' 行无一为空（空值会被查看器当 0 ⇒ 名次假倒数）'); }
/* §E605 第④条的收尾账：`examG` 必须**在册、齐全、只有一个值** —— 这条以前没人钉，
 *   所以链子跑完把这一列整列弄丢时，只有等页面自测（读的是烘好的图）才响，晚了两步。 */
{ const iG = h.indexOf('examG');
  if (iG < 0) { console.error('⛔ 产物里没有 examG 列 ⇒ 第⑥步没跑成（页内那条"全图只能一个档"会红，而这里先停）'); process.exit(2); }
  const vals = {}, blanks = [];
  for (const r of rows) { const v = String(r[iG] || '').trim(); if (!v) { blanks.push(r[0]); continue; } vals[v] = (vals[v] || 0) + 1; }
  if (blanks.length) { console.error('⛔ examG 空 ' + blanks.length + ' 行（前 8：' + blanks.slice(0, 8).join(' ') + '）⇒ 有枚没盖到档'); process.exit(2); }
  const ks = Object.keys(vals);
  if (ks.length > 1) { console.error('⛔ 产物里有 ' + ks.length + ' 种考卷档：' + ks.map(k => k + '×' + vals[k]).join(' ‖ ') + ' ⇒ 破 METHODOLOGY §120「进图必须单档」'); process.exit(2); }
  if (h.indexOf('aliasN') < 0 || h.indexOf('aliasIds') < 0) { console.error('⛔ 产物没有 aliasN/aliasIds 两列 ⇒ 第⑧步（折行）没跑成，表里大概还留着副名行'); process.exit(2); }
  const dupId = rows.map(r => r[0]).filter((x, i, a) => a.indexOf(x) !== i);
  if (dupId.length) { console.error('⛔ 折行之后还有重复 id：' + dupId.slice(0, 8).join(' ')); process.exit(2); }
  console.log('单档与折行自证 ✅ 全图 ' + rows.length + ' 枚同一档（examG=' + ks[0] + '）‖ aliasN/aliasIds 在册 ‖ id 唯一'); }
/* §E641 新增的一条牙：**不许有行凭空消失**。
 *   起因（10-18 早班实测）：给这张图加五枚新臂时我只喂了本批的尺表 ⇒ `--extra=` 是**替换**缺省几何输入而不是追加，
 *   上一批（§E608 那四枚：`G12H1 / Z1 / Z2 / clone-79101`）的几何只存在于 `e608-ruler.tsv` 里 ⇒
 *   链子把它们**静默丢掉**，而当时那四条自证（列名唯一 / 投影齐全 / 头号尺无空洞 / 单档折行）**全绿** ——
 *   "产物自洽"不等于"没丢东西"：803 行、id 唯一、每列都有数，少掉的那 4 行不会在任何一条上响。
 *   判据写成"每一枚都要有下落"而不是"行数不许变"：折行本来就会把副名收进 `aliasIds`/`coords-aliases.tsv`，
 *   那是合法消失；既不剩行也不在副名账里 = 事故。 */
{ const oldL = rd(join(ROOT, FROM)), oldIds = oldL.slice(1).map(l => String(l).split('\t')[0]).filter(Boolean);
  const have = {};
  for (const r of rows) { have[r[0]] = 1;
    const i = h.indexOf('aliasIds'); if (i >= 0 && r[i]) String(r[i]).split(/\s+/).filter(Boolean).forEach(x => { have[x] = 1; }); }
  const af = join(HERE, 'coords-aliases.tsv');
  if (existsSync(af)) { const AL = rd(af), ah = AL[0].split('\t'), ia = ah.indexOf('aliasId');
    if (ia < 0) { console.error('⛔ coords-aliases.tsv 没有 aliasId 列 ⇒ 副名账读不了，这条守卫不能假装通过'); process.exit(2); }
    AL.slice(1).forEach(l => { const c = l.split('\t'); if (c[ia]) have[c[ia]] = 1; }); }
  const gone = oldIds.filter(x => !have[x]);
  if (gone.length) { console.error('⛔ 这一趟重建弄丢了 ' + gone.length + ' 枚（在册、既没留行也不在任何副名账里）：' + gone.slice(0, 12).join(' ') +
    '\n       最常见的原因是 `--extra=` **替换**了几何输入而没带上上一批那张尺表 ⇒ 那些枚拿不到几何就被丢掉了。' +
    '\n       修法：把它们一起喂进来，例如 --extra=champion-map/eNN-上一批-ruler.tsv,champion-map/eNN-本批-ruler.tsv' +
    '\n       （回滚用：git checkout -- champion-map/coords.tsv）'); process.exit(2); }
  console.log('行数守恒自证 ✅ 上一版 ' + oldIds.length + ' 枚每一枚都有下落（在册 ' + rows.length + ' ‖ 副名账补齐）‖ 消失 0 枚'); }
console.log('✅ 八步跑完且产物自洽（列名唯一、行宽一致、投影五列齐全、头号尺无空洞、单档、已折行、上一版每一枚都有下落）');
