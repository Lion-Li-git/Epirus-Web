/* oldpacks-epsfull.mjs —— 把 §E370 的 `oldpacks.tsv` 换成 `attach-hp.mjs --more=` 吃的那张格式。
 *
 * 为什么要一台脚本而不手改一份 tsv：`oldpacks.tsv` 的键是 **wid8**（权重指纹前 8 位），
 *   而 `coords.tsv`/`attach-hp` 的键是**面板 id** —— 旧包没有面板 id，图上的 id 是我按
 *   `SLOT-<wid8>` 给的（§E375 归一：原先写成 SLOT-<16 位 wid>，表上读太宽）。
 *   这一步就是把那一次改名**写成可重跑的动作**，省得下一个人对着两份表猜"这 16 枚到底是不是同一批"。
 * 列名照 `epsfull.tsv` / `e328-epsfull.tsv`（id/exam/page/d/hp_old/sec），`attach-hp` 按表头查列不按位置。
 *   `hp_old` 留空 = 这批没有"换尺前的旧 Hp"，不是 0；`sec` 同理（§E370 那台没按枚记秒）。
 * 用法：node champion-map/oldpacks-epsfull.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const L = readFileSync(join(HERE, 'oldpacks.tsv'), 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const h = {}; L[0].split('\t').forEach((k, i) => { h[k] = i; });
for (const need of ['wid8', 'H', 'Hp', 'dEps']) if (h[need] === undefined) {
  console.error('⛔ oldpacks.tsv 没有 ' + need + ' 列（表头：' + L[0].split('\t').join('\t') + '）'); process.exit(2); }
const out = ['id\texam\tpage\td\thp_old\tsec'];
for (const l of L.slice(1)) { const c = l.split('\t');
  out.push(['SLOT-' + c[h.wid8], c[h.H], c[h.Hp], c[h.dEps], '', ''].join('\t')); }
writeFileSync(join(HERE, 'e370-epsfull.tsv'), out.join('\n') + '\n');
console.log('已写 e370-epsfull.tsv：' + (out.length - 1) + ' 枚 ‖ id = SLOT-<wid8>（与 coords.tsv 同一套名字）');
