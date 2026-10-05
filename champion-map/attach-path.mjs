/* attach-path.mjs —— §E330：给 `coords.tsv` 补一列 `path` = **量这枚时真用的那个文件**。
 *
 * 为什么要有这一列（不补的代价已经实测过两遍）：
 *   ① **同一个 id 在盘上可以有两份不同的包**。`M05-111` / `D4a` / `E20-71` 这些"续训现役"的臂产品真身在
 *      `docs/artifacts/e234-out/…`（ts = 10-02），而顶层 `docs/artifacts/<id>.bak` 另有一份同名旧拷贝
 *      （ts = 现役那颗的 09-27 08:55:34）⇒ 谱系图上 181 枚子代全叠在同一秒。
 *   ② `feas.mjs` 的名单也是按 `docs/artifacts/<id>.bak` 拼的，且**文件不存在就静默筛掉**
 *      ⇒ 那 183 枚从来没被过线闸判过（图上"无判定"）。
 *   两处都是"猜路径"，而真路径本来就落在现测尺表的 `path` 列里 ⇒ 把它搬进名单所在的那张表，
 *   让所有下游读同一列，比在每个脚本里各写一份兜底强（§E328 的 `pack-id.mjs` 就是为同样的事立的）。
 *
 * 守卫：901 枚必须**全部**拿到 path ‖ 每个 path 必须真的存在 ‖ 指到子目录的必须正好是那批新增的
 *   （`kin` 列非空的 183 枚）⇒ 对不上就红着退出，不许"少贴几枚也算跑完"。
 *
 * 用法：node champion-map/attach-path.mjs [--ruler=e328-ruler-s1.tsv,e328-ruler-s2.tsv,e328-ruler-s3.tsv]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };

const PATHOF = {};
const rts = String(arg('ruler', 'e328-ruler-s1.tsv,e328-ruler-s2.tsv,e328-ruler-s3.tsv')).split(',').filter(Boolean);
for (const f of rts) {
  const p = f.indexOf('/') < 0 ? join(HERE, f) : join(ROOT, f);
  const L = readFileSync(p, 'utf8').trim().split('\n'), hd = L[0].split('\t');
  const iId = hd.indexOf('id'), iPath = hd.indexOf('path');
  if (iId < 0 || iPath < 0) { console.error('⛔ ' + f + ' 没有 id/path 两列，这张表不能当路径来源'); process.exit(2); }
  for (const l of L.slice(1)) { const c = l.split('\t'); if (c[iId] && c[iPath] && !PATHOF[c[iId]]) PATHOF[c[iId]] = c[iPath]; }
}
console.log('路径来源 ' + rts.join(',') + ' ‖ 解出 ' + Object.keys(PATHOF).length + ' 条');

const CF = join(HERE, 'coords.tsv');
const L = readFileSync(CF, 'utf8').trim().split('\n');
const hd = L[0].split('\t');
const iId = hd.indexOf('id'), iKin = hd.indexOf('kin');
if (iId < 0) { console.error('⛔ coords.tsv 没有 id 列'); process.exit(2); }
let iP = hd.indexOf('path');
if (iP < 0) { hd.push('path'); iP = hd.length - 1; L[0] = hd.join('\t'); }

const rows = L.slice(1).map(l => l.split('\t'));
let nPath = 0, nSub = 0, nConv = 0; const miss = [], gone = [];
for (const r of rows) {
  const id = r[iId];
  /* 优先级是**有原因的**：现测尺的 path 列 = 量它时真用的文件；顶层 `<id>.bak` 只是老那批的约定位置。
   *   同一个 id 两处都有而约定赢 ⇒ 就读到旧拷贝（§E330 那 181 枚叠在同一秒就是这么来的）。 */
  const rel = id === 'SHIPPED-Ldemo' ? 'js/bundled-champion-3p.js'
    : (PATHOF[id] || ('docs/artifacts/' + id + '.bak'));
  if (PATHOF[id] || id === 'SHIPPED-Ldemo') nPath++; else nConv++;
  if (rel.indexOf('/') >= 0 && PATHOF[id]) nSub++;
  try { readFileSync(join(ROOT, rel)).length || gone.push(id + '（空文件）'); } catch (e) { gone.push(id + '（读不到）'); }
  r[iP] = rel;
}
if (gone.length) { console.error('⛔ ' + gone.length + ' 枚的 path 指不到可读文件（前 8 个：' + gone.slice(0, 8).join(' ') + '）⇒ 停'); process.exit(2); }
const nKin = rows.filter(r => r[iKin] && r[iKin] !== '-').length;
const nSubKin = rows.filter(r => (r[iKin] && r[iKin] !== '-') && r[iP].indexOf('/') >= 0).length;
if (nSub !== nSubKin) { console.error('⛔ 从现测尺拿到子目录路径的 ' + nSub + ' 枚 ≠ kin 非空且在子目录的 ' + nSubKin +
  ' 枚 ⇒ 新增那批的路径与"续训现役/父链"标记没对上，说明贴错了行'); process.exit(2); }

writeFileSync(CF, [L[0]].concat(rows.map(r => r.join('\t'))).join('\n') + '\n');
console.log('已写 ' + CF + '：' + rows.length + ' 枚全部有 path ‖ 其中按现测尺贴的子目录件 ' + nSub +
  ' 枚（kin 非空的 ' + nKin + ' 枚）‖ 显式来源 ' + nPath + ' 枚 ‖ 走顶层 <id>.bak 约定 ' + nConv + ' 枚');
