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
/* ⚠ 一律先把 CRLF 归一成 LF 再按行切：本仓工作树是 CRLF（autocrlf），而 `split('\n')` 会把每行**最后一列**
 *   留成一个带裸 \r 的字符串 ⇒ 末列叫 "path\r" ⇒ `indexOf('path')` 返回 −1。
 *   实测踩过：本班第一次跑通之后 `git checkout` 兜了一圈回来，path 恰好就是末列，下游全瞎。*/
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const rts = String(arg('ruler', 'e328-ruler-s1.tsv,e328-ruler-s2.tsv,e328-ruler-s3.tsv')).split(',').filter(Boolean);
for (const f of rts) {
  const p = f.indexOf('/') < 0 ? join(HERE, f) : join(ROOT, f);
  const L = rd(p).replace(/\n+$/, '').split('\n'), hd = L[0].split('\t');
  const iId = hd.indexOf('id'), iPath = hd.indexOf('path');
  if (iId < 0 || iPath < 0) { console.error('⛔ ' + f + ' 没有 id/path 两列，这张表不能当路径来源'); process.exit(2); }
  for (const l of L.slice(1)) { const c = l.split('\t'); if (c[iId] && c[iPath] && !PATHOF[c[iId]]) PATHOF[c[iId]] = c[iPath]; }
}
console.log('路径来源 ' + rts.join(',') + ' ‖ 解出 ' + Object.keys(PATHOF).length + ' 条');

const CF = join(HERE, 'coords.tsv');
const L = rd(CF).replace(/\n+$/, '').split('\n');
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
/* 这条判据换过一次写法，理由是它的前提没了：
 *   原式「子目录路径的枚数 == kin 非空且在子目录的枚数」成立于"现测尺只喂新增那一批"的年代 ——
 *   那时候"路径带斜杠"是"这枚属于新批次"的**代理**。§E375 把 6 张尺并进在册的 ruler-all.tsv 之后，
 *   917 枚的路径**全部**来自现测尺（带斜杠），代理就失效了（实测 917 ≠ 214 会假红）。
 *   §E330 那条真正的病是"同一个 id 盘上有两份拷贝，猜路径会把旧拷贝当本体" ⇒ 判据直接钉病本身：
 *   **不许有任何一枚走回顶层 <id>.bak 的约定猜测**（SHIPPED-Ldemo 是显式特例，不算猜）。 */
const iLin = hd.indexOf('lineage');
if (nConv > 0) { console.error('⛔ 有 ' + nConv + ' 枚的路径是**猜**出来的（顶层 <id>.bak 约定），不是现测尺里量它时真用的那个文件'
  + ' ⇒ 同名旧拷贝会被当成本体（§E330）。要么把缺的枚补进 ruler-all.tsv，要么别重画这张图'); process.exit(2); }
console.log('  路径全部来自显式来源 ✅（现测尺 ' + nPath + ' 枚 + 现役特例 1 枚 ‖ 带 kin ' + nKin + ' ‖ 带 lineage '
  + rows.filter(r => !!r[iLin]).length + '）');

/* 落盘按本仓工作树的约定写 CRLF，并且**写完立刻读回来验一遍** ——
 *   第一版就是"写完当时是对的、git checkout 兜一圈回来末列变成 path\r"，只在自己那次跑里看不出来。*/
writeFileSync(CF, [L[0]].concat(rows.map(r => r.join('\t'))).join('\r\n') + '\r\n');
{ const B = rd(CF).replace(/\n+$/, '').split('\n'), bh = B[0].split('\t');
  const jI = bh.indexOf('id'), jP = bh.indexOf('path');
  if (jP < 0 || jP !== bh.length - 1) { console.error('⛔ 回读：表里找不到干净的 path 列（末列 = ' + JSON.stringify(bh[bh.length - 1]) + '）'); process.exit(2); }
  const br = B.slice(1).map(l => l.split('\t'));
  const bad = br.filter(r => !r[jP] || /\r/.test(r[jP])).length;
  if (bad || br.length !== rows.length) { console.error('⛔ 回读：' + br.length + ' 行 / 空或脏 path ' + bad + ' 枚（应为 ' + rows.length + ' / 0）'); process.exit(2); }
  console.log('回读守卫 ✅ ' + br.length + ' 行 × ' + bh.length + ' 列，path 列无脏尾'); }
console.log('已写 ' + CF + '：' + rows.length + ' 枚全部有 path ‖ 其中按现测尺贴的子目录件 ' + nSub +
  ' 枚（kin 非空的 ' + nKin + ' 枚）‖ 显式来源 ' + nPath + ' 枚 ‖ 走顶层 <id>.bak 约定 ' + nConv + ' 枚');
