/* holoprobe.mjs —— §E305：量"发货硬门槛"对全 718 枚的影响面。
 *
 * 起因：`v7beadseed-82` 在统一尺上恒为第 1（H=61.7 ‖ 线上冠军 55.4），却从未当选。
 *   跑 `promote-champion.mjs --dry` 拿到的裁决是：
 *     · 可行性五道**全过**（= 图上的绿环）‖ G4/G5 行为门**全过**
 *     · ⛔ **硬门槛未过（--force 也不放行）：全息屏障套给别人 17.3 次/局 > 6**
 *   ⇒ 图上那个"过线"绿环**不等于"可发货"**：`feasibilityOf` 里根本没有这条腿（它在 promote 侧）。
 *   本脚本把这条腿对全 718 枚量一遍，回答两个问题：
 *     ① 113 枚"过线"里有多少会被它挡掉（= 绿环与"能上槽"之间到底差多少）；
 *     ② 送盾率与 H/F 有没有相关 —— 若"考卷越高分盾越凶"，那榜首本身就是打分口径的产物。
 *
 * 口径与 promote 逐字同源：`selfPlay(W, params, 'multi', 20)` 读 `holoOtherPerGame` / `holoPerGame`，
 *   阈值 import `HOLO_GIFT_MAX`（单一真源，门 D 不许两处各写一个 6）。
 * 用法：node champion-map/holoprobe.mjs [--limit=0] [--out=holo.tsv]
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, selfPlay, HOLO_GIFT_MAX } from '../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const OUT = (() => { const o = arg('out', 'holo.tsv'); return /[\/\\]/.test(o) ? o : join(HERE, o); })();
const LIMIT = Number(arg('limit', 0));
const GAMES = Number(arg('games', 20));

/* 判定源：feas-s*.tsv 的 ok 列（现跑的同一道闸），不是包内历史 META */
const OKM = {};
for (const f of ['feas-s1.tsv', 'feas-s2.tsv', 'feas-s3.tsv']) {
  if (!existsSync(join(HERE, f))) continue;
  const L = readFileSync(join(HERE, f), 'utf8').trim().split('\n'), hd = L[0].split('\t');
  for (const l of L.slice(1)) { const c = l.split('\t'); if (c[hd.indexOf('ok')] === '0' || c[hd.indexOf('ok')] === '1') OKM[c[hd.indexOf('id')]] = +c[hd.indexOf('ok')]; }
}
if (!Object.keys(OKM).length) { console.error('⛔ 没有 feas-s*.tsv ⇒ 无法分组（先跑 feas.mjs）'); process.exit(2); }

const ct = readFileSync(join(HERE, 'coords.tsv'), 'utf8').trim().split('\n');
const hh = ct[0].split('\t');
/* §E608（千问，DS 交接件 §2 那 6 台之一）：原来这一行的 path 是**按 id 猜文件**——
 *   `id === 'SHIPPED-Ldemo' ? 'js/bundled-champion-3p.js' : 'docs/artifacts/' + id + '.bak'`。
 *   两个坏：① 那枚 10-11 就退役了，而 `bundled-champion-3p.js` 装的是**当下活槽那颗** ⇒ 量出来的全息密度会记到
 *      一枚退役枚头上（主语错了）；② 不在 `docs/artifacts/<id>.bak` 的那批（`kept/` 里、`.js` 结尾、e528-out/ 等）
 *      被下面那道 `existsSync` **静默筛掉**，样本悄悄变小而没人说。
 *   改法：path 一律读 `coords.tsv` 的 **path 列**（那是面板自己登记的来源），只有它为空才退回猜；
 *   并且把"因文件不存在被筛掉多少枚、前几枚是谁"印出来 —— 缩样不许是无声的。 */
let dropped = [];
let list = ct.slice(1).map(l => { const c = l.split('\t'); const o = {}; hh.forEach((k, i) => o[k] = c[i]); return o; })
  .map(r => {
    const guess = 'docs/artifacts/' + r.id + '.bak';
    const path = String(r.path || '').trim() || guess;
    return { id: r.id, H: +r.H, S: +r.S, rank: +r.rank, ok: OKM[r.id] === undefined ? null : OKM[r.id], path: path, guessed: !String(r.path || '').trim() };
  })
  .filter(e => { if (existsSync(join(ROOT, e.path))) return true; dropped.push(e.id + '（' + e.path + '）'); return false; });
if (dropped.length) console.log('⚠ ' + dropped.length + ' 枚因包文件不存在被筛掉（样本比面板小）：' + dropped.slice(0, 6).join(' ‖ ') + (dropped.length > 6 ? ' …' : ''));
if (list.some(e => e.guessed)) console.log('⚠ ' + list.filter(e => e.guessed).length + ' 枚的 path 列是空的 ⇒ 按 `docs/artifacts/<id>.bak` 猜的（这些行的读数别当在册口径引用）');
if (LIMIT > 0) list = list.slice(0, LIMIT);
const COLS = ['id', 'ok', 'H', 'rank', 'holoPerGame', 'holoOther', 'giftShare', 'overCap'];
if (!existsSync(OUT)) writeFileSync(OUT, COLS.join('\t') + '\n');
const done = new Set(readFileSync(OUT, 'utf8').trim().split('\n').slice(1).map(l => l.split('\t')[0]));
const todo = list.filter(e => !done.has(e.id));
console.log('硬门槛 HOLO_GIFT_MAX = ' + HOLO_GIFT_MAX + ' 次/局 ‖ 样本 selfPlay(multi,' + GAMES + ') ‖ 待量 ' + todo.length + ' / ' + list.length);
if (!todo.length && list.length) { console.error('⛔ 待量为 0 而名单非空 ⇒ 不是跑完了，是筛错了'); process.exit(2); }

const W = sandbox(); const t0 = Date.now();
todo.forEach((e, i) => {
  let sp = null, err = '';
  try { sp = selfPlay(W, loadChamp(W, e.path), 'multi', GAMES); }
  catch (x) { err = String(x.message || x).split('\n')[0].slice(0, 80); }
  const tot = sp ? Number(sp.holoPerGame || 0) : '';
  const oth = sp ? Number(sp.holoOtherPerGame || 0) : '';
  const rec = [e.id, e.ok === null ? '' : e.ok, e.H, e.rank, tot, oth,
    sp && tot > 0 ? (oth / tot).toFixed(3) : '', sp ? (oth > HOLO_GIFT_MAX ? 1 : 0) : 'ERR'];
  if (err) rec[7] = 'ERR ' + err.replace(/[\t\n]/g, ' ');
  appendFileSync(OUT, rec.join('\t') + '\n');
  if (i % 40 === 0 || i === todo.length - 1) {
    const el = (Date.now() - t0) / 1000;
    console.log('  ' + (i + 1) + '/' + todo.length + ' ‖ ' + el.toFixed(0) + 's ‖ ' + (el / (i + 1)).toFixed(2) + 's/枚 ‖ 预计还需 ' + ((todo.length - i - 1) * el / (i + 1) / 60).toFixed(1) + ' 分');
  }
});
console.log('完成 ⇒ ' + OUT);
