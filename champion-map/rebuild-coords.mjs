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
 * 顺序（= 现役 coords.tsv 的列序，逐列核过）：
 *   1) ruler-figs      画几何（26 列：id…z3 + 13 个行为列）
 *   2) attach-kin      搬上一版的当选键四列 + 打 kin，并把"续训现役"从 lineage 里清掉
 *   3) attach-hp       头号尺 Hp 与 Δε（--more= 把子代批与旧槽位冠军批都并进来）
 *   4) attach-path     path 列（--ruler= 必须覆盖**全部**枚，否则就是猜）
 *   5) attach-dup      dupN/dupOf（按权重身份去重，要吃 path 列）
 *
 * 用法：node champion-map/rebuild-coords.mjs [--extra=champion-map/e370-ruler.tsv]
 *                                            [--from=<上一版 coords.tsv>] [--dry]
 * ⚠ 会覆盖 champion-map/coords.tsv（先自己备份，这台不动 git）。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync, existsSync as ex } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const EXTRA = String(arg('extra', 'champion-map/e370-ruler.tsv'));
const DRY = process.argv.includes('--dry');
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const CO = join(HERE, 'coords.tsv');
const ruler = 'champion-map/ruler-all.tsv' + (EXTRA ? ',' + EXTRA : '');

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
run('attach-kin.mjs', ['--from=' + FROM], '② attach-kin 搬当选键 + 打 kin');
/* ===== §E491 第③步的 --more 原来写死两张表 ⇒ 新加的枚**天生没有 Hp/De** =====
 *   `Hp` 是图上那把头号尺（F = Hp/100 + T·S），而查看器把空 Hp 当 0 算 ⇒
 *   本轮三枚融合粒在图上排到 728/732，用户拿截图问"这个点都排到倒数去了，显然不是噪声"。
 *   实测补测：它们的线上口径 Hp = 51.8 / 52.8 / 53.0，而现役是 47.3 ⇒ **在现役之上 4.5~5.7pt**，
 *   那 728 名完全是"未测被当 0"造出来的假象。
 *   ⇒ --more 现在从 --extra 派生（`<批>-ruler.tsv` 的同名 `<批>-epsfull.tsv`），
 *     少一张就**当场停**（不许静默少测 —— 收尾那条核验也会兜住）。 */
const HPMORE = ['e328-epsfull.tsv'];
{ const missMore = [];
  for (const s of String(EXTRA).split(',').map(x => x.trim()).filter(Boolean)) {
    const base = s.replace(/^.*[\\/]/, '').replace(/-ruler\.tsv$/, '');
    if (!base) continue; const t = base + '-epsfull.tsv';
    if (HPMORE.indexOf(t) < 0) HPMORE.push(t);
    if (!ex(join(HERE, t))) missMore.push(t + '（来自 --extra 的 ' + s + '）'); }
  if (missMore.length) { console.error('⛔ 这批 ruler 表没有配对的线上口径表：' + missMore.join(' ‖ ') +
    '\n       ⇒ 这些枚会**没有 Hp**，而 Hp 是图上头号尺（空值在查看器里当 0 算 ⇒ 名次直接掉到倒数）。' +
    '\n         补测：node champion-map/eps-full.mjs --extra=<那个 extra 表> --onlyExtra --out=<上面那张表名>'); process.exit(2); } }
run('attach-hp.mjs', ['--more=' + HPMORE.join(',')], '③ attach-hp 头号尺（' + HPMORE.join(' ‖ ') + '）');
/* §E488：这一步原来把 `e370-ruler.tsv` **写死**在 --ruler 里，而不是转发 `--extra=` 的那一串
 *   ⇒ 正是本文件头注自己列的第 ② 条病（"attach-path 的 --ruler 不给全 ⇒ 没覆盖到的枚退回顶层猜路径"）：
 *   本轮加三枚融合粒时，它们的 path 变成"按 <id>.bak 猜"，attach-path 自己的守卫当场拒绝（那是对的）。
 *   改成从 EXTRA 派生（attach-path 按本目录解析，所以取 basename）。*/
run('attach-path.mjs', ['--ruler=ruler-all.tsv' + (EXTRA ? ',' + String(EXTRA).split(',').map(s => s.replace(/^.*[\\/]/, '')).join(',') : '')], '④ attach-path 真用的文件');
run('attach-dup.mjs', [], '⑤ attach-dup 权重身份去重');
/* §E489 第六步是**必需的**，原来链子里没有它 ⇒ 谁跑一遍重建，页面就**静默退回旧投影**：
 *   ① ruler-figs 只落 36 列（xt/yt/xt3/yt3/zt3 不在它名单里），投影是 proj-tsne 事后**追加**的；
 *   viewer.mjs 那边走的是 `(PROJTSNE && r.xt) ? r.xt : r.x2` 这种**逐行**退路 ⇒ 列整列没了它也不喊，
 *   只是把 920 枚全画回力导向那一版（kNN@10 保住率 0.52 → 0.08）。
 *   实测踩过：本轮加 3 枚融合粒跑完五步，用户当场看出"投影变回很早的版本、区分度很低"。 */
run('proj-tsne.mjs', [], '⑥ proj-tsne 重算投影（xt/yt/xt3/yt3/zt3）');

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
console.log('✅ 六步跑完且产物自洽（列名唯一、行宽一致、投影五列齐全）');
