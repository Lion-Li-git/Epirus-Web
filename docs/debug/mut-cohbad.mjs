/* mut-cohbad.mjs —— 给 §E596 那条页内自检 `cohBad` 造**违反态**，证明它会红（不是"跑绿了就算有牙"）
 *
 * 欠账原文（`docs/research/logs/2026-10-12-e596-three-tier.md:95`）：
 *   「把某个 hard 带成员的 `VIS` 强行置 0（它的 F 在窗内）⇒ `outN` 仍 0 而 `cohBad` 应为 1」
 *   —— 补法照它写的来。10-13 之前这一支只跑到"绿"，没人单独造过违反态。
 *
 * 为什么改副本而不是改 `champion-map/index.html`：活跃产物一个字节都不动，测完删副本就行
 *   （跑法靠 `shot.mjs --html=`，那条旗标是本笔一起加的）。
 *
 * 用法：node docs/debug/mut-cohbad.mjs            # 造副本 + 自证那一行真改了
 *       node docs/debug/mut-cohbad.mjs --clean    # 删副本
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'champion-map/index.html';
const MUT = 'docs/artifacts/cohbad-mut.html';
const ANCHOR = 'var cohBad = 0;';
const INJECT = 'for (var cxx9 = 0; cxx9 < N; cxx9++) { if (P[cxx9].pt === ANCH_TIER && inWin(P[cxx9])) { VIS[cxx9] = 0; break; } }';

if (process.argv.indexOf('--clean') >= 0) {
  if (existsSync(MUT)) rmSync(MUT);
  console.log('已删 ' + MUT); process.exit(0);
}
const html = readFileSync(SRC, 'utf8');
const n = html.split(ANCHOR).length - 1;
console.log('锚点 `' + ANCHOR + '` 在 ' + SRC + ' 里出现 ' + n + ' 次');
if (n !== 1) { console.error('⛔ 锚点不是唯一 ⇒ 这一支自检被烘了多份或改名了，变异会打到不该打的地方'); process.exit(2); }
const out = html.replace(ANCHOR, INJECT + ' ' + ANCHOR);
writeFileSync(MUT, out, 'utf8');
/* 自证：这一行**真改了**（shell 正则空转过一次，所以每次变异都要先证自己动的是那一处）*/
const back = readFileSync(MUT, 'utf8');
const hit = back.split(INJECT).length - 1;
const same = back.length - html.length;
console.log('已写 ' + MUT + ' ‖ 注入次数 ' + hit + ' ‖ 字节差 +' + same);
if (hit !== 1) { console.error('⛔ 注入没落地（副本里读不回那一行）⇒ 后面的红/绿都不算证据'); process.exit(2); }
if (back.split(ANCHOR).length - 1 !== 1) { console.error('⛔ 锚点在副本里不唯一 ⇒ 变异打偏'); process.exit(2); }
console.log('✔ 自证过：锚点唯一、注入落地、只多这一段 ⇒ 拿 shot.mjs --html=' + MUT + ' 跑，'
  + '预期那条腿从 PASS 变 FAIL 且**只有它**变。');
