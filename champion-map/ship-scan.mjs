/* ship-scan.mjs —— 历代冠军的**上线时刻**（§E338，用户 ⑤ 要按上线时间排一列）。
 *
 * 为什么不按提交标题里点名来判（第一版就是这么写的，实测抓到假账）：
 *   v1.5.114 那条标题写「换包 v7new5_005-31 上线 …… 同时记 v7new6（v7new6-94 …… v7new6-96 …）」
 *   ⇒ 按"标题提到过"会把 v7new6-94/96 判成"上线过"，而它们从没进过槽。
 *   这正是 `wid.mjs` 头注那条纪律：**字符串命中 ≠ 身份**。
 * 正解 = 逐条提交**把槽文件的内容取出来算权重指纹**：
 *   对每个动过 `js/bundled-champion-3p.js` 的提交跑 `git show <hash>:<槽>` ⇒ `widOf()`，
 *   按时间正序走，某个 wid **第一次出现**的那条提交 = 那枚（那几枚同权重的）包真正上槽的时刻。
 * 口径：`wid` 只哈希权重数组（与 server/train-server.mjs 的 weightsId 一致）⇒ 同 wid ≠ 同行为，
 *   但"槽里放的是哪份权重"这件事它判得准。每条都留 hash，谁要核就 git show。
 * 用法：node champion-map/ship-scan.mjs        ⇒ 写 champion-map/ship-times.tsv
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { widOf } from './wid.mjs';
import * as slotIdentity from './slot-identity.mjs';   /* §E600-A：上槽名单的唯一解析处 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const SLOT = 'js/bundled-champion-3p.js';

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/* ---- 1) 冠军名单 = coords.tsv 的 lineage 列；身份 = 各自 path 的权重指纹 ---- */
/* ---- 1) 名单 = `slot-identity.mjs` 解析出的"上过槽"集合（§E600-A）----
 *   取代原来那句"`coords.tsv` 里 lineage 非空的行"。旧写法有两个实测的洞：
 *     ① **换上去的那枚可能还没被标身份** ⇒ 整段缺席。`T8-s114` 就是这样：它 10-11 17:30 起就住在槽里
 *        （`2f88f09` v1.6.62 ‖ `slot-history.tsv` 有声明行 ‖ `slot-timeline.tsv` 有那一段），
 *        但 `coords.tsv` 的 lineage 是空 ⇒ `ship-times.tsv` 停在 09-27，查看器把真现役画成"没上过线"的小点。
 *     ② wid 要**现读产物文件** ⇒ 包不在盘上就丢一枚（§E589 去重把老包搬进隔离区之后更多枚会撞上）。
 *   现在 wid 直接取 `slot-timeline.tsv` 那一段的权重指纹（从槽文件侧逐提交算出来的，不需要那份包还在盘上）。 */
const SID = slotIdentity.load();
const W2ID = {}, NOID = [];
/* 一行的粒度 = 「一枚面板上的名字 × 它那份权重」，与旧版逐 (wid,id) 一行同形。
 *   ⚠ 第一版这里只塞 `segs.coordsId`（= 同权重组的第一个名字），实测把 `v7press3-91 ‖ v7r2-35 ‖ v7wall-31`
 *   三行**改名**成了组里的另一个代表（`v7ws1-91 ‖ v7force2-35 ‖ v7teach2-31`）—— 等价于把三行删掉。
 *   ⇒ 组内每个名字都要各留一行，判据读的是名字，不是权重。 */
const GRP = {}; for (const id in SID.GROUP) GRP[id] = SID.GROUP[id];
for (const s of SID.segs) { if (!s.coordsId) continue;
  const ids = GRP[s.coordsId] || [s.coordsId];
  for (const id of ids) { const ws = (SID.byId[s.coordsId] && SID.byId[s.coordsId].wids) || [];
    for (const w of ws) { W2ID[w] = W2ID[w] || []; if (W2ID[w].indexOf(id) < 0) W2ID[w].push(id); } } }
/* 解析说"从没进过槽"、可 `lineage` 那列写着上过槽的名字 ⇒ 仍出一行、时刻留空并点名（这是漂移探测器，不是补数据）
 *   实测这一档现在装的是 `v7new6-94 ‖ v7new6-96`：它们当年就是靠"空时刻 + 显式标"进图的（查看器那条
 *   "抽不到上线时刻的必须显式标"的判据主语就是这两枚）。 */
const CLAIM = [];
for (const id in SID.ROW) { const lin = SID.ROW[id].lineage || '';
  if (lin !== '历代上槽' && lin !== '旧槽位冠军') continue;
  if (SID.isOnSlot(id)) continue;
  CLAIM.push(id); }
const onDisk = SID.onSlot.filter(id => { const p = (SID.ROW[id] || {}).path || ('docs/artifacts/' + id + '.bak');
  return p && existsSync(join(ROOT, p)); });
const want = Object.keys(W2ID).length;
console.log('上槽名单走解析：' + SID.onSlot.length + ' 枚 ⇒ 去重后 ' + want + ' 个权重身份 ‖ 在册路径还在盘上的 ' + onDisk.length + ' 枚' +
  (NOID.length ? ' ‖  定不了身份：' + NOID.join(' ') : ''));
if (CLAIM.length) console.log('⚠ lineage 声称上过槽、但解析在 40 段里找不到它：' + CLAIM.join(' ‖ ') + '（出一行空时刻，查看器会显式标"抽不到上线时刻"）');
if (!want) { console.error('⛔ 一个权重身份都没算出来 ⇒ 这张表只能是空的，直接红着退'); process.exit(2); }
if (!SID.live.ok) { console.error('⛔ 活槽现主解不到图上任何一行 ⇒ 换包那一笔没同步，这张表不可信'); process.exit(2); }

/* ---- 2) 逐提交取槽内容的指纹（git log 是**新→旧**，反转成正序）---- */
const log = git(['log', '--format=%ad\x1f%h\x1f%s', '--date=format:%Y-%m-%d %H:%M', '--', SLOT])
  .trim().split('\n').map(l => { const c = l.split('\x1f'); return { when: c[0], hash: c[1], subj: c.slice(2).join(' ') }; })
  .reverse();
const first = {};                                     /* wid → 第一次在槽里出现的那条提交 */
let prev = null, changes = 0;
for (const c of log) {
  let w = null;
  try { w = widOf(git(['show', c.hash + ':' + SLOT])); } catch (e) { continue; }   /* 早期提交可能还没有这个文件 */
  if (!w) continue;
  c.wid = w;
  if (w !== prev) { changes++; if (!(w in first)) first[w] = c; prev = w; }
}
console.log('扫过 ' + log.length + ' 条动过槽的提交 ⇒ 槽内容换了 ' + changes + ' 次身份');

/* ---- 3) 出表：一枚冠军一行（同 wid 的几行共用同一时刻，如实写明）---- */
const rows = [];
for (const w of Object.keys(W2ID)) {
  const c = first[w];
  for (const id of W2ID[w]) {
    rows.push({ id: id, wid: w, when: c ? c.when : '', hash: c ? c.hash : '',
      ver: c ? ((/v[0-9]+\.[0-9]+\.[0-9]+/.exec(c.subj) || [''])[0]) : '',
      share: W2ID[w].length > 1 ? '同权重 ' + W2ID[w].join('/') : '' });
  }
}
for (const id of CLAIM) rows.push({ id: id, wid: '', when: '', hash: '', ver: '',
  share: '解析在槽位时间轴里找不到它（lineage 却写着上过槽）⇒ 查看器退回训出时刻并显式标' });
rows.sort((a, b) => String(a.when || '~~~').localeCompare(String(b.when || '~~~')));
writeFileSync(join(HERE, 'ship-times.tsv'),
  'id\tshipWhen\thash\tversion\twid\t同权重几枚\n' +
  rows.map(r => [r.id, r.when, r.hash, r.ver, r.wid, r.share].join('\t')).join('\n') + '\n');
console.log('\n上线时刻（按时间正序）：');
for (const r of rows) console.log('  ' + (r.when || '(未上槽)').padEnd(17) + r.id.padEnd(16) + (r.ver || '').padEnd(10) +
  (r.share ? ' ‖ ' + r.share : ''));
const never = rows.filter(r => !r.when).map(r => r.id);
console.log('\n✔ 抽到 ' + (rows.length - never.length) + ' / ' + rows.length + (never.length ? ' ‖ 没在槽里出现过的：' + never.join(' ‖ ') + '（这本身是个结论：它不是"历代上槽"）' : ''));
