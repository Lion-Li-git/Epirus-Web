/* B0 复现校验器 · 新批的 `off`/`strict` 两档必须逐字等于 §E647 归档的那些行
 * 为什么要一台机器来判：这句话说的是"我改的码没挪动旧形状"，是**整批重测的前提**；
 *   人眼对 36 行数字必然只看头几行（本仓反复犯的那件事：结构性可疑的读数才是判据，不是"我跑绿了"）。
 * 归档行的格式：`ROW seed=77000 mode=multi --support=0 1st=62.5% …`（pack 只在注释里 ⇒ 由文件名决定）
 * 新批行的格式：`ROW pack=<名字> seed=… mode=… gear=<off|strict|prod> 1st=…%`
 * 判法：把归档文件名映射到 pack 名（E647.txt → `v7beadseed-82.bak` ‖ E647b.txt → 按行内 `pack=` 或注释分组），
 *   只比 **off 与 strict** 两档（`prod` 是新档，没有旧数可比）；不同值 ⇒ exit 5 并把每一处不同都列出来。
 * 用法：node verify-e647-repro.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const OLD = [path.join(ROOT, 'docs/research/archive/2026-10-18-guard-the-charger/support-strength-E647.txt'),
  path.join(ROOT, 'docs/research/archive/2026-10-18-guard-the-charger/support-strength-E647b.txt')].filter(existsSync);
const NEWF = path.join(HERE, 'strength-E648.log.txt');
if (!OLD.length || !existsSync(NEWF)) { console.error('⛔ 归档或新批文件缺 ⇒ 无法校验（' + OLD.length + ' 份旧 ‖ 新 ' + existsSync(NEWF) + '）'); process.exit(2); }

/* 旧文件里 pack 只出现在注释行（`# … R-s123.js（池成员）‖ bundled-champion-3p.js …`）⇒ 按"注释里最后提到的那枚"分段不可靠，
 * 所以这里显式建表：E647.txt 全是 82；E647b.txt 按行内 `pack=` 读（它确实带）。**不许用正则猜历史文件**。 */
const oldRows = [];
for (const f of OLD) {
  const base = path.basename(f);
  for (const l of readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    if (l.indexOf('ROW ') !== 0) continue;
    const seed = Number((l.match(/seed=(\d+)/) || [])[1]);
    const mode = (l.match(/mode=(\w+)/) || [])[1];
    const k = Number((l.match(/--support=(\d)/) || [])[1]);
    const first = Number((l.match(/1st=([\d.]+)%/) || [])[1]);
    const packInLine = (l.match(/pack=(\S+)/) || [])[1];
    const pack = packInLine || (base === 'support-strength-E647.txt' ? 'v7beadseed-82.bak' : null);
    if (!pack) { console.error('⛔ ' + base + ' 有一行既没有 pack= 又不是 E647.txt ⇒ 不许猜，停下：' + l); process.exit(2); }
    if (!mode || isNaN(seed) || isNaN(k) || isNaN(first)) { console.error('⛔ 旧行解析失败：' + l); process.exit(2); }
    oldRows.push({ pack, mode, seed, k, first });
  }
}
const oldByKey = {};
for (const r of oldRows) {
  const k = r.pack + '|' + r.mode + '|' + r.seed + '|k' + r.k;
  if (oldByKey[k] !== undefined && oldByKey[k] !== r.first) { console.error('⛔ 归档自己就有两个值：' + k); process.exit(2); }
  oldByKey[k] = r.first;
}
const newRows = [];
for (const l of readFileSync(NEWF, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
  if (l.indexOf('ROW ') !== 0) continue;
  const pack = (l.match(/pack=(\S+)/) || [])[1], mode = (l.match(/mode=(\w+)/) || [])[1];
  const seed = Number((l.match(/seed=(\d+)/) || [])[1]), gear = (l.match(/gear=(\w+)/) || [])[1];
  const first = Number((l.match(/1st=([\d.]+)%/) || [])[1]);
  if (!pack || !mode || !gear || isNaN(seed) || isNaN(first)) { console.error('⛔ 新行解析失败：' + l); process.exit(2); }
  newRows.push({ pack, mode, seed, gear, first });
}
/* 驱动里的 pack 名字是简称（`R-s123`），归档里是文件名（`R-s123.js`）⇒ 显式对照表，不做后缀猜测 */
const ALIAS = { 'v7beadseed-82': 'v7beadseed-82.bak', 'R-s123': 'R-s123.js', 'bundled-champion-3p': 'bundled-champion-3p.js' };
let cmp = 0, diff = [], missing = [];
for (const r of newRows) {
  if (r.gear === 'prod') continue;
  const packOld = ALIAS[r.pack] || r.pack;
  const k = packOld + '|' + r.mode + '|' + r.seed + '|k' + (r.gear === 'off' ? 0 : 2);
  if (oldByKey[k] === undefined) { missing.push(k); continue; }
  cmp++;
  if (Math.abs(oldByKey[k] - r.first) > 1e-9) diff.push(k + ' ⇒ 归档 ' + oldByKey[k] + ' ↔ 本次 ' + r.first);
}
console.log('本次可比格 ' + cmp + ' ‖ 缺归档对照 ' + missing.length + ' ‖ 值不同 ' + diff.length);
if (diff.length) { console.error('⛔ **逐字复现失败**（下面每一格都要解释，不许"看着差不多"）：\n  ' + diff.slice(0, 20).join('\n  ')); process.exit(5); }
if (missing.length) console.log('   ⚠ 这些格在归档里找不到对照（不参与判定，但要说清为什么缺）：' + missing.slice(0, 12).join(' ‖ '));
console.log('✔ 所有 ' + cmp + ' 格逐字相同 ⇒ `off` 与 `strict` 两档都没被我的改动挪动 ⇒ "产品档 vs 关档"的差可以归给档位，不归给代码漂移');
