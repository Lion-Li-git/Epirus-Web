/* §E290 换尺：**不再吃训练自报的 META**，每枚包都现量同一把尺。
 *
 * 为什么要换（用户 10-04 裁定"直接换尺吧"）：v2/v3 的 H = `meta.firstRate` 是**训练自己写进 META 的**（`evo.js:1189` 的补贴局夺 1 率），
 *   于是这张图只能画"那一层训练产物"，而**历代上槽冠军 15 枚里只有 4 枚在图上**（6 枚没有 feasibility 块、4 枚在别的 opps 层、
 *   当前线上包 Ldemo 连 `.bak` 都没了且 META 里没有 firstRate）。尺挂在产物身上 ⇒ 图没有冠军谱系。
 *
 * 新尺（三样全部现测，对任意包都有定义）：
 *   **H = 考卷夺 1 率** —— `audit-lib.exam(file, [], EXG)`，内部就是 `tools/eval-5p.mjs EXG 5 77000 <包>`
 *         ⇒ **固定种子 77000 + 同一批桌子**，所有包面对完全相同的组合（可配对、可复跑）；并报 `strict`（引擎判胜）与 `tie`（并列率）。
 *   **S = ln(G_eff)** —— `audit-lib.selfPlay(...).effSkills` = 5 座同种的镜像自对局里"非 ジ 出手的 exp(熵)"（`evo.js` 的 `mirrorHealth`，与训练门槛同源）。
 *   **坐标 = 同一批探针的行为列**（伤害/局、重击、盾、零伤害率、平局率、回合、技能种类数、座位极差、反弹墙、蓄能、珠浪费、无威胁摆架势、被集火还手…）
 *         ⇒ 坐标不再来自 `feasibility`，所以**没有 feasibility 块的老冠军也能进图**。
 * ⚠ 只有 H 走 `exam()`（它 spawn 子进程，一枚一次）；其余探针都在本进程内跑，**不另写一份"名字→函数"映射**（同 `opp-champs` 那条纪律）。
 *
 * 可续跑：`--out` 已存在的行会跳过（30 分钟级别的作业必须能断点续）。
 * 用法：node docs/artifacts/e287-out/e287-measure.mjs [--exam=120] [--self=40] [--seat=100] [--probe=40]
 *       [--set=layer|champ|all] [--ids=a,b] [--out=e287-ruler.tsv] [--limit=0]
 */
import { readdirSync, readFileSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, exam, selfPlay, fieldRate, seatSymmetry, chargeProfile, reflectWall, aggressionProfile, extractJsonObject } from '../tools/audit-lib.mjs';
   // ↑ 搬家改的这一处：原稿在 `docs/artifacts/e287-out/`，相对深度是 `../../../tools/`；本文件在 `champion-map/` ⇒ `../tools/`

const HERE = dirname(fileURLToPath(import.meta.url));
/* 这份是 §E290 那台现测尺的**入库副本**（原稿在 `docs/artifacts/e287-out/`，那里被 gitignore ⇒ 图不可复算）。
 *   搬家要改的就是这两条根：`ROOT` = 仓库根，`ART` = 产物目录。 */
const ROOT = join(HERE, '..');
const ART = join(ROOT, 'docs', 'artifacts');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const EXG = Number(arg('exam', 30)), SPG = Number(arg('self', 40)), SEAT = Number(arg('seat', 100)), PRB = Number(arg('probe', 40));
const SET = arg('set', 'all'), OUT = arg('out', 'e287-ruler.tsv'), LIMIT = Number(arg('limit', 0));
/* 分片：`--shard=1/3` ⇒ 按下标取模，三片互不重叠且**与名单顺序无关的确定性切法**（并发各写自己的 out，避免同文件交错追加）*/
const SH = String(arg('shard', '1/1')).split('/').map(Number);
const COLS = ['id', 'path', 'H', 'Hstrict', 'Htie', 'cost3', 'S', 'Geff', 'dmg', 'heavy', 'holo', 'zeroRate', 'drawRate',
  'rounds', 'distinctKeys', 'seatSpread', 'rwDmg', 'charges', 'waste', 'noThreatStance', 'fieldAAtk', 'fieldARounds',
  /* §E566（千问）：把**测量档**盖进每一行。原来这张表只有 `games`/`pop`/`n` 这些**包自己的配方字段**，
   *   而"这行的 H 是考卷几局/组合"数据里根本没有 ⇒ 30 档与 120 档的两张表拼在一起看不出来（§E562/§E563
   *   那个"档把候选与现役的差距压掉一半"的讨论， provenance 全靠日志里的一句话）。
   *   下游（rebuild-coords / eps-full / lineage / viewer）全是按**列名** `indexOf` 取数 ⇒ 末尾加列不动列序，安全。 */
  'mode', 'n', 'pop', 'games', 'oppsN', 'seed', 'ts', 'lineage', 'examG'];

/* ---- 名单 ---- */
function metaOf(file) {
  const src = readFileSync(file, 'utf8');
  const j = extractJsonObject(src, 'window.EPIRUS_CHAMPION_3P_META', null) || extractJsonObject(src, 'window.EPIRUS_CHAMPION_3P', '_META') ||
    extractJsonObject(src, 'window.EPIRUS_CHAMPION_META', null) || extractJsonObject(src, 'window.EPIRUS_CHAMPION', '_META');
  try { return j ? JSON.parse(j) : null; } catch (e) { return null; }
}
const CHAMPS = ['Ldemo', 'eco-34', 'long-33', 'v7cmin4-31', 'v7n1-93', 'v7new5_005-31', 'v7new6-94', 'v7new6-96', 'v7press-36',
  'v7press3-91', 'v7r2-35', 'v7seat24-31', 'v7tgt2-52', 'v7wall-31', 'v7wall-33'];
const want = new Map();   /* path -> {id, lineage} */
if (SET !== 'champ') {
  for (const f of readdirSync(ART).filter(x => x.endsWith('.bak'))) {
    const m = metaOf(join(ART, f));
    if (!m || m.mode !== 'multi' || m.n !== 5 || m.pop !== 16 || m.games !== 8) continue;
    want.set('docs/artifacts/' + f, { id: f.replace(/\.bak$/, ''), lineage: '' });
  }
}
if (SET !== 'layer') {
  for (const c of CHAMPS) {
    const p = 'docs/artifacts/' + c + '.bak';
    if (existsSync(join(ROOT, p))) want.set(p, { id: c, lineage: '历代上槽' });
  }
  want.set('js/bundled-champion-3p.js', { id: 'SHIPPED-Ldemo', lineage: '当前线上' });
}
/* §E328 加的一条入口：`--extra=<_e328-descendants.tsv>` 把**名单外**的臂产品也拉进来量。
 *   为什么必须加这条：上面那道筛子写死了 `mode==='multi' && n===5 && pop===16 && games===8`，
 *   而"续训现役"那 192 支臂大多是 `pop=12 / games=8` 或 `gens=400/800` 的实验档 ⇒ **整批被筛掉**，
 *   图上有 718 枚、现役的子代却有 183 支从没进过面板 —— 这不是"它们不好"，是**名单条件把它们滤没了**。
 *   表头认 `productRel`/`arm` 两列（`chain-scan.mjs --emit=` 的产物）；没有该列时按每行一个 id/路径读。 */
const EXTRA = arg('extra', '');
if (EXTRA) {
  const ep = isAbsolute(EXTRA) ? EXTRA : join(HERE, EXTRA);
  if (!existsSync(ep)) { console.error('⛔ --extra= 指向的文件不存在：' + ep); process.exit(2); }
  const lines = readFileSync(ep, 'utf8').trim().split(/\r?\n/);
  const head = lines[0].split('\t');
  const iP = head.indexOf('productRel'), iA = head.indexOf('arm'), iL = head.indexOf('lineage');
  let add = 0, skipNoFile = 0, skipOnMap = 0;
  const miss = [];
  /* ⚠ 判"有没有表头"要看**那一行字符串**含不含制表符：`head` 是 split 之后的**数组**，
   *   `head.includes('\t')` 问的是"有没有哪一列正好等于制表符"，永远 false ⇒ 表头被当成一枚包送去查文件
   *   （实测：每次跑都多报一条"盘上查无 1"，数字对不上但结果没错，属于会误导人的假账）。 */
  for (const l of lines.slice(lines[0].includes('\t') ? 1 : 0)) {
    const c = l.split('\t');
    const rel = (iP >= 0 ? c[iP] : c[0]) || '';
    const id = (iA >= 0 ? c[iA] : rel.replace(/^.*\//, '').replace(/\.(bak|js)$/, '')) || '';
    if (!rel || !id) continue;
    if (want.has(rel)) { skipOnMap++; continue; }
    if (!existsSync(join(ROOT, rel))) { skipNoFile++; miss.push(rel); continue; }
    /* §E375：`lineage` 原来写死 '续训现役'（那是 §E328 拉子代那一批的身份）。
     *   现在 extra 表可以自带这一列 —— 旧槽位冠军不是现役的子代，贴错标签会把"血统"读成"续训"。 */
    want.set(rel, { id, lineage: (iL >= 0 && c[iL]) ? c[iL] : '续训现役' }); add++;
  }
  console.log('--extra 拉进 ' + add + ' 枚（名单里已有 ' + skipOnMap + ' ‖ 盘上查无 ' + skipNoFile + '）'
    + (miss.length ? '\n  ⚠ 盘上查无的是：' + miss.join(' ‖ ') : ''));
}
const only = String(arg('ids', '')).split(',').map(s => s.trim()).filter(Boolean);
let list = [...want.entries()].map(([path, v]) => ({ path, ...v }));
if (only.length) {
  const haveIds = new Set(list.map(e => e.id));
  list = list.filter(e => only.indexOf(e.id) >= 0);
  /* §E566（千问）：`--ids` 原来**只筛不报** ⇒ 打错一个 id、或那枚根本不在本档（`--set` 选的那一层）里，
   *   结果是"少测几枚却 exit 0"，而跨次比较就在比两个不对齐的面板（§E562 实测：估成本时就是这么漏的人）。
   *   本文件对"筛到空"已经有响亮失败（见下面 `待量为 0`），这里补的是**筛到不全**那一半。 */
  const missIds = only.filter(function (id) { return !haveIds.has(id); });
  if (missIds.length) {
    console.error('⛔ --ids 里有 ' + missIds.length + ' 枚在**本档**（--set=' + SET + '，面板共 ' + haveIds.size + ' 枚）找不到：' + missIds.join(' ‖ ')
      + '\n   ⇒ 不许当成"跑完了"：要么那枚不在这个面板里（层内 / 历代冠军 / --extra 各是不同来源），要么 id 打错。宁可不跑，不许拿半套名单去跟另一套比。');
    process.exit(2);
  }
}
if (LIMIT > 0) list = list.slice(0, LIMIT);

/* ---- 续跑：跳过已量过的 id ---- */
const OUTP = join(HERE, OUT);
const done = new Set(existsSync(OUTP) ? readFileSync(OUTP, 'utf8').trim().split('\n').slice(1).map(l => l.split('\t')[0]) : []);
if (!existsSync(OUTP)) writeFileSync(OUTP, COLS.join('\t') + '\n');
const todo = list.filter((e, i) => i % SH[1] === SH[0] - 1 && !done.has(e.id));
console.log('尺 = 考卷 ' + EXG + ' 局/组合（seed 77000 固定 · 35 组合 ⇒ 实际 ' + (EXG * 35) + ' 局/枚）‖ 自对局 ' + SPG + ' 局 · 座位 ' + SEAT + ' 局 · 探针 ' + PRB + ' 局 ‖ 分片 ' + SH[0] + '/' + SH[1]);
console.log('名单 ' + list.length + ' 枚（层内 ' + list.filter(e => !e.lineage).length + ' ‖ 历代冠军 ' + list.filter(e => e.lineage).length +
  '）‖ 本片 ' + todo.length + ' 枚（被分片筛掉 ' + (list.length - (done.size + todo.length)) + ' ‖ 本 out 里已量 ' + done.size + '）⇒ 追加进 ' + OUT);
/* 空跑必须响亮失败：这一版我差点把"分片下标写错 ⇒ 一枚没量但 exit 0、只留一个表头"当成跑完了发出去。 */
if (todo.length === 0 && list.length > 0) { console.error('⛔ 待量为 0（名单非空）⇒ 分片/续跑条件把全部筛掉了，这不是"跑完了"。shard=' + SH[0] + '/' + SH[1] + ' 已量=' + done.size); process.exit(2); }

const W = sandbox();
const t0 = Date.now();
todo.forEach((e, i) => {
  const rec = { id: e.id, path: e.path, lineage: e.lineage, examG: EXG };   /* §E566：档跟着行走（失败行也要有，见下面 ERR 那条 append） */
  try {
    const ex = exam(e.path, [], EXG);
    rec.H = ex.first; rec.Hstrict = ex.strict; rec.Htie = ex.tie; rec.cost3 = ex.cost3;
    const params = loadChamp(W, e.path);
    const sp = selfPlay(W, params, 'multi', SPG);
    rec.Geff = sp.effSkills; rec.S = Math.log(sp.effSkills);
    rec.dmg = sp.dmgPerGame; rec.heavy = sp.heavyPerGame; rec.holo = sp.holoPerGame;
    rec.zeroRate = sp.zeroRate; rec.drawRate = sp.drawRate; rec.rounds = sp.rounds; rec.distinctKeys = sp.distinctKeys;
    const ss = seatSymmetry(W, params, 'multi', SEAT); rec.seatSpread = ss.spread;
    const cp = chargeProfile(W, params, 'multi', PRB); rec.charges = cp.chargesPerGame; rec.waste = cp.wasteRate;
    const rw = reflectWall(W, params, 'long', PRB); rec.rwDmg = rw.dmgPerGame;
    const agg = aggressionProfile(W, params, PRB); rec.fieldAAtk = agg.fieldA.atk;
    const fp = fieldRate(W, params, 'passive', 'multi'); rec.noThreatStance = fp.noThreatStanceRate;
    const fa = fieldRate(W, params, 'active', 'multi'); rec.fieldARounds = fa.rounds;
    const m = metaOf(join(ROOT, e.path));   // 原稿这里写成一个"按 .bak/非 .bak 分支"的三元，但两支完全相同 ⇒ 直接一支
    if (m) { rec.mode = m.mode; rec.n = m.n; rec.pop = m.pop; rec.games = m.games; rec.seed = m.seed;
      rec.oppsN = String((m.feasibility && m.feasibility.opps) || m.opps || '').split(',').filter(Boolean).length; rec.ts = String(m.ts || '').slice(0, 10); }
  } catch (err) {
    rec.H = 'ERR'; rec.S = 'ERR';
    if (i < 3 || i % 50 === 0) console.log('  ⚠ ' + e.id + ' 量失败：' + String(err.message || err).split('\n')[0].slice(0, 90));
  }
  appendFileSync(OUTP, COLS.map(c => rec[c] === undefined ? '' : rec[c]).join('\t') + '\n');
  if (i % 25 === 0 || i === todo.length - 1) {
    const el = (Date.now() - t0) / 1000, per = el / (i + 1);
    console.log('  ' + (i + 1) + '/' + todo.length + ' ‖ ' + per.toFixed(2) + 's/枚 ‖ 已用 ' + el.toFixed(0) + 's ‖ 预计还需 ' +
      (per * (todo.length - i - 1) / 60).toFixed(1) + ' 分 ‖ 最新 ' + e.id + ' H=' + rec.H + ' S=' + (isFinite(rec.S) ? Number(rec.S).toFixed(2) : rec.S));
  }
});
console.log('完成 ' + todo.length + ' 枚，用时 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's ⇒ ' + OUTP);
