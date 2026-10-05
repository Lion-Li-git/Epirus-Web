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

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const SLOT = 'js/bundled-champion-3p.js';

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/* ---- 1) 冠军名单 = coords.tsv 的 lineage 列；身份 = 各自 path 的权重指纹 ---- */
const CL = rd(join(HERE, 'coords.tsv')).trim().split('\n'), ch = CL[0].split('\t');
const iId = ch.indexOf('id'), iLin = ch.indexOf('lineage'), iPath = ch.indexOf('path');
if (iPath < 0) { console.error('⛔ coords.tsv 没有 path 列 ⇒ 先跑 attach-path.mjs（§E330 那条同名旧拷贝的洞就靠它堵）'); process.exit(2); }
const W2ID = {}, NOID = [];
for (const l of CL.slice(1)) {
  const c = l.split('\t');
  if (!c[iId] || !c[iLin]) continue;
  const f = join(ROOT, c[iPath]);
  if (!existsSync(f)) { NOID.push(c[iId] + '(盘上无包)'); continue; }
  const w = widOf(rd(f));
  if (!w) { NOID.push(c[iId] + '(算不出 wid)'); continue; }
  (W2ID[w] = W2ID[w] || []).push(c[iId]);
}
const want = Object.keys(W2ID).length;
console.log('冠军 ' + Object.values(W2ID).reduce((s, a) => s + a.length, 0) + ' 枚 ⇒ 去重后 ' + want + ' 个权重身份' +
  (NOID.length ? ' ‖  定不了身份：' + NOID.join(' ') : ''));
if (!want) { console.error('⛔ 一个权重身份都没算出来 ⇒ 这张表只能是空的，直接红着退'); process.exit(2); }

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
for (const id of NOID) rows.push({ id: id, wid: '', when: '', hash: '', ver: '', share: '定不了身份 ⇒ 查看器退回训出时刻' });
rows.sort((a, b) => String(a.when || '~~~').localeCompare(String(b.when || '~~~')));
writeFileSync(join(HERE, 'ship-times.tsv'),
  'id\tshipWhen\thash\tversion\twid\t同权重几枚\n' +
  rows.map(r => [r.id, r.when, r.hash, r.ver, r.wid, r.share].join('\t')).join('\n') + '\n');
console.log('\n上线时刻（按时间正序）：');
for (const r of rows) console.log('  ' + (r.when || '(未上槽)').padEnd(17) + r.id.padEnd(16) + (r.ver || '').padEnd(10) +
  (r.share ? ' ‖ ' + r.share : ''));
const never = rows.filter(r => !r.when).map(r => r.id);
console.log('\n✔ 抽到 ' + (rows.length - never.length) + ' / ' + rows.length + (never.length ? ' ‖ 没在槽里出现过的：' + never.join(' ‖ ') + '（这本身是个结论：它不是"历代上槽"）' : ''));
