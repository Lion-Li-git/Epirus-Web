#!/usr/bin/env node
/* §E615 把**长程桌**的读数挂进 `coords.tsv` ⇒ 图上有第二张桌可选，而**头号尺 `Hp` 一字不动**。
 *
 * 为什么要这一列（10-16 午，用户看图问"Hp 为什么这么低"）：
 *   图上 `H`/`Hp`/`F` 全部量在 `eval-5p` 的**默认 `multi`（3 血短程）**，而 10-15 起训练默认是 5 人长程
 *   （包的 `meta.recipe.env.EPIRUS_TRAIN_MODE` 就写着 `long`）。同 seed 同档只换桌形重测 26 枚池成员：
 *   `Spearman(multi, long) = 0.654` ⇒ 两张桌**不是同一把尺**，`G12H1 46.3→69.8`（26 枚里 19/26→1/26）。
 *   但**不能把 `Hp` 换成 `long`**：它的所指是"玩家在默认桌上拿到的那个数"，796 行在册引用与历史文档都指着它
 *   （METHODOLOGY 那条"换尺要另起一列、不许偷走历史读数的名字"，`attach-hp.mjs` 头注第 ① 条同一件事）。
 *   ⇒ 所以：**加三列**（`Hlong` 考卷 ‖ `Hplong` 页面 ‖ `Flong = Hplong + T·S`），颜色与一维轴各多一个可选项。
 *
 * 判据（跑前写死）：
 *   ① **不许把"没量到"写成 0**（R8）：源表里没有这枚 ⇒ 写 `-`，查看器读 `-` 走"未测 = 灰"，不进色标区间。
 *   ② **配对成立的前提要自证**：源表每行必须 `examG=120` 且 `pageDose=tier:lv:regular` 且 `mode=long`
 *      —— 与在册 `Hp` 只差 `mode` 这一维；有一行不满足就 exit 2（否则这张表是混装的）。
 *   ③ `Flong` 用的 `T` 与页面当前滑轨默认值**必须是同一个**（`viewer.mjs` 的 `T` 默认），否则两根轴不同尺。
 *   ④ 覆盖报数：量到 N ‖ 没量到 M（点名前 8 枚）—— 覆盖率本身就是要给用户看的数。
 *
 * 用法：node champion-map/attach-hlong.mjs **--table=<长程桌源表>** [--target=coords-gen3-1105.tsv] [--check] [--t=0.10] [--allow-partial]
 *   11-11 起 --table 仍是源表；目标表走 --target，缺省 gen3；缺源默认保留原值（merge-only）。
 *   ⚠ `--table` 从 v1.8.27 起**必给**（原来那个缺省表不含全部枚，静默吃它就是把缺枚打回 `-`）。
 *   幂等：列已存在则**原地回写**（不重复加列）。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTable, readTable, writeTable, tableStamp } from './map-table.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const rd = f => readFileSync(join(HERE, f), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const CHECK = process.argv.includes('--check');
/* v1.8.27（用户 10-23 裁定「缺省直接关掉就行了」）：**这张缺省表已废除**。
 *   为什么不能再留缺省：缺省那张 `epsfull-long-2026-10-16.tsv` 只有 798 行（`grep -c '^t5-'` = 0），
 *   而 §E641 那 5 枚 ring 臂的读数在别的表里 ⇒ 链子按缺省跑一遍就把它们**静默写回 `-`**。
 *   这已经发生两次（v1.7.130 于 10-21 补平、10-23 的重建又抹掉），而没有任何门会红。
 *   ⇒ 现在必须显式交表；今天在册的完整表是 `epsfull-long-2026-10-23.tsv`（807 行 = 798 + 5 ring + 4 爆珠臂）。 */
const TAB = String(arg('from', arg('table', '')));
const TARGET = resolveTable(process.argv, { baseDir: HERE, defaultTable: 'coords-gen3-1105.tsv', aliases: ['target'] });
const ALLOW_PARTIAL = process.argv.includes('--allow-partial');
let _T;
try { _T = readTable(TARGET); } catch (e) { console.error('⛔ ' + e.message); process.exit(2); }
console.log('[map-table] target ' + tableStamp(_T));
if (!TAB) {
  console.error('⛔ 必须显式给 `--table=<长程桌源表>`（缺省表已按用户 10-23 的裁定关掉）。\n'
    + '   为什么不给缺省：缺省表不含全部枚 ⇒ 不给表就等于把缺枚的读数静默打回 `-`（这病 10-21 修过、10-23 又犯）。\n'
    + '   现成可用：`--table=epsfull-long-2026-10-23.tsv`（807 枚在册）‖ 自己造一张：'
    + '`node champion-map/eps-full.mjs --mode=long --only=<名单> --out=<表> --games=120 --epsTier=lv:regular`');
  process.exit(2);
}
const T = Number(arg('t', 0.10));   /* 与 `viewer.mjs` 的 T 滑轨默认值同一个（判据 ③） */
if (!isFinite(T) || T < 0) { console.error('⛔ --t 得是非负数'); process.exit(2); }

if (!existsSync(join(HERE, TAB))) { console.error('⛔ 长程桌源表不在：champion-map/' + TAB + '（先跑 eps-full --mode=long）'); process.exit(2); }
const LT = rd(TAB), lh = Object.fromEntries(LT[0].map((x, i) => [x, i]));
for (const k of ['id', 'exam', 'page']) if (lh[k] === undefined) { console.error('⛔ 源表缺列 `' + k + '`（表头：' + LT[0].join(',') + '）'); process.exit(2); }
if (lh.mode === undefined || lh.examG === undefined || lh.pageDose === undefined) {
  console.error('⛔ 源表没有 `mode`/`examG`/`pageDose` 三列 ⇒ 这张表没登记自己是哪把尺量的，不许往图上挂'); process.exit(2);
}
const HL = {}, HP2 = {}, bad = [];
for (const r of LT.slice(1)) {
  if (!r[lh.id]) continue;
  if (r[lh.mode] !== 'long' || r[lh.examG] !== '120' || r[lh.pageDose] !== 'tier:lv:regular') {
    bad.push(r[lh.id] + '(' + r[lh.mode] + '/' + r[lh.examG] + '/' + r[lh.pageDose] + ')'); continue;
  }
  HL[r[lh.id]] = Number(r[lh.exam]); HP2[r[lh.id]] = Number(r[lh.page]);
}
if (bad.length) { console.error('⛔ 源表里有 ' + bad.length + ' 行的档/桌形/剂量不是 `long/120/tier:lv:regular` ⇒ 整表拒绝：' + bad.slice(0, 6).join(' ‖ ')); process.exit(2); }

/* ===== §E616 第二件产物：**全腿长程版的过线**（`feas.mjs --allLong=1` 的分片表）=====
 *   在册那道闸是**混合桌**（G主判/座位/场A/场B = multi ‖ G2/反弹墙/密度/蓄能 = long），
 *   所以"这枚过不过线"没有单一的"长程版"，只有"把剩下 4 条腿也搬上长程之后过不过"。
 *   判据同上面那条：`legsMode` 必须是 `all-long` 开头（读错表 = 把混合桌读数当长程读数挂上去），
 *   没有这枚的长程判定就写 `-`（**不是 0、不是"没过"**）。 */
const OKL = {};
{ const files = readdirSync(HERE).filter(f => /^feas-long-.*\.tsv$/.test(f));
  if (!files.length) console.log('⚠ 没找到 feas-long-*.tsv ⇒ `okLong/failsLong` 两列本轮不更新（先跑 feas.mjs --allLong=1 --shard=k/4）');
  for (const f of files) {
    const F = rd(f), fh = Object.fromEntries(F[0].map((x, i) => [x, i]));
    if (fh.ok === undefined || fh.legsMode === undefined) { console.error('⛔ ' + f + ' 缺 `ok` 或 `legsMode` 列 ⇒ 不敢挂（混合桌与长程桌会混成一列）'); process.exit(2); }
    for (const r of F.slice(1)) {
      if (!r[fh.id]) continue;
      if (!/^all-long/.test(String(r[fh.legsMode] || ''))) { console.error('⛔ ' + f + ' 里有行的 legsMode 不是 all-long：' + r[fh.id] + ' ⇒ 这张表不是全腿长程那批'); process.exit(2); }
      OKL[r[fh.id]] = { ok: r[fh.ok] === '1' ? 1 : (r[fh.ok] === '0' ? 0 : null), fails: String(r[fh.fails] || '').slice(0, 120) };
    }
  } }

const CO = [_T.header].concat(_T.rows), ch = Object.fromEntries(CO[0].map((x, i) => [x, i]));
const COLS = ['Hlong5', 'Hplong5', 'Flong5', 'okLong', 'failsLong'];   // 11-07 改名：H 系列 → H5 参照名
let idx = COLS.map(c => ch[c]);
if (idx.some(x => x === undefined)) {
  if (CHECK) { console.error('⛔ coords.tsv 还没有这三列 ⇒ 先不带 --check 跑一次'); process.exit(2); }
  const at = CO[0].length;
  CO[0] = CO[0].concat(COLS);
  for (let i = 1; i < CO.length; i++) while (CO[i].length < at) CO[i].push('');
  idx = COLS.map((c, k) => at + k);
}
let nHit = 0, nOk = 0, miss = [], okMiss = [], kept = 0, cleared = 0;
for (let i = 1; i < CO.length; i++) {
  const r = CO[i], id = r[ch.id]; if (!id) continue;
  /* 三列考卷/页面/势：没量到就保留原值（merge-only）；--allow-partial 才清成 -（**不许当 0**）*/
  if (HP2[id] === undefined) {
    if (ALLOW_PARTIAL) { for (let k = 0; k < 3; k++) r[idx[k]] = '-'; cleared++; }
    else kept++;
    miss.push(id);
  } else {
    r[idx[0]] = HL[id].toFixed(2); r[idx[1]] = HP2[id].toFixed(2);
    /* ⚠ 标度必须跟页面那根 F = Hp/100 + T·S（工具栏 F窗口 的提示语就是这个式子）逐字一致。 */
    r[idx[2]] = (HP2[id] / 100 + T * (+r[ch.S] || 0)).toFixed(4);
    nHit++;
  }
  const o = OKL[id];
  if (!o || o.ok === null) {
    if (ALLOW_PARTIAL) { r[idx[3]] = '-'; r[idx[4]] = ''; }
    okMiss.push(id);
  } else { r[idx[3]] = String(o.ok); r[idx[4]] = (o.fails || '').replace(/[\t\n]/g, ' '); nOk++; }
}
if (CHECK) {
  console.log('✔ 只核不写：考卷/页面量到 ' + nHit + ' 枚 ‖ 没量到 ' + miss.length + ' 枚（缺源保留 ' + kept + ' 行）‖ 过线(全腿长程) ' + nOk + ' 枚 ‖ 无 ' + okMiss.length + ' 枚');
  process.exitCode = nHit >= 700 ? 0 : 1;
} else {
  const w = writeTable(TARGET, { header: CO[0], rows: CO.slice(1) }, { backupTool: 'attach-hlong' });
  console.log('已写 ' + _T.name + '：五列 ' + COLS.join('/') + '（T=' + T + '）‖ 考卷/页面量到 ' + nHit + ' ‖ 没量到 ' + miss.length + '（保留 ' + kept + '）' +
    ' ‖ 过线(全腿长程) ' + nOk + ' ‖ 无 ' + okMiss.length + ' ‖ 备份 ' + (w.backup ? '有' : '无'));
  console.log('⚠ 坐标一列未动；绿环（在册 ok）也没动。');
}
