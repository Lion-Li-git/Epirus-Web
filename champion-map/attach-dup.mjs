/* attach-dup.mjs —— §E334 给 `coords.tsv` 补两列：`dupN`（同一份权重在面板上有几行）‖ `dupOf`（那几行的代表 id）。
 *
 * 为什么必须补（数字是实测出来的，不是猜的）：
 *   901 行按**权重身份（wid）**去重只剩 **713 个** ⇒ 285 行属于 97 组"同名不同文件、权重完全一样"的包。
 *   最刺眼的一组是 **4 行 = 现役本身**（`SHIPPED-Ldemo` ‖ `Ldemo` ‖ `C5-02-31` ‖ `C5-02-71`，
 *   wid 都是 d490dc136293cfc4）⇒ 图上"现役"被画成四枚，而且它们在 F 上占掉名次 22/23/24/25。
 *   对局仪器反过来给了这条一个自证：那三枚"别的包"打现役，配对差**恰好 0.0pt（两批种子都是）**。
 *   ⇒ 不标注的话，"901 枚候选"会被读成"901 种不同打法"，而 §E329 那句"六枚在 F 上直接赢现役"里
 *     有两枚（M05C02-151 / NCV-151）本来就是同一份权重。
 *
 * 只**加列不改行序**，并且写完立刻回读校验（§E333 那课：本仓工作树是 CRLF，末列会带裸 \r）。
 * 用法：node champion-map/attach-dup.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { widOf } from './pack-id.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const CF = join(HERE, 'coords.tsv');
const L = rd(CF).trim().split('\n'), hd = L[0].split('\t');
const iId = hd.indexOf('id'), iPath = hd.indexOf('path');
if (iId < 0) { console.error('⛔ coords.tsv 没有 id 列'); process.exit(2); }
if (iPath < 0) { console.error('⛔ 先跑 attach-path.mjs（权重身份要按**真用的那个文件**算，猜路径会把同名旧拷贝当成本体）'); process.exit(2); }
let iN = hd.indexOf('dupN'), iO = hd.indexOf('dupOf');
if (iN < 0) { hd.push('dupN'); iN = hd.length - 1; hd.push('dupOf'); iO = hd.length - 1; L[0] = hd.join('\t'); }
else iO = iN + 1;

const rows = L.slice(1).map(l => l.split('\t'));
const WID = {}, RW = new Array(rows.length); let nun = 0;
for (let i = 0; i < rows.length; i++) {
  const r = rows[i], p = join(ROOT, r[iPath]);
  let w = '';
  if (existsSync(p)) { try { w = widOf(readFileSync(p, 'utf8')) || ''; } catch (e) { w = ''; } }
  RW[i] = w;
  if (!w) { nun++; WID['\u2205#' + i] = [r[iId]]; continue; }   /* 读不出身份的各算一枚 —— 不许并成一组"都是空的" */
  (WID[w] = WID[w] || []).push(r[iId]);
}
for (let i = 0; i < rows.length; i++) {
  const r = rows[i], w = RW[i], grp = w ? (WID[w] || [r[iId]]) : [r[iId]];
  r[iN] = String(grp.length); r[iO] = grp.length > 1 ? grp.join(' ') : '';
}
const dup = Object.values(WID).filter(v => v.length > 1);
const nDupRows = dup.reduce((s, v) => s + v.length, 0);
writeFileSync(CF, [L[0]].concat(rows.map(r => r.join('\t'))).join('\r\n') + '\r\n');
{ const B = rd(CF).trim().split('\n'), bh = B[0].split('\t'), br = B.slice(1).map(l => l.split('\t'));
  const jN = bh.indexOf('dupN'), jO = bh.indexOf('dupOf');
  if (jN < 0 || jO < 0) { console.error('⛔ 回读：dup 两列没落上（表头末两列 = ' + bh.slice(-2).join('/') + '）'); process.exit(2); }
  if (br.length !== rows.length) { console.error('⛔ 回读：行数 ' + br.length + ' ≠ ' + rows.length); process.exit(2); }
  const bad = br.filter(r => !/^\d+$/.test(r[jN]) || +r[jN] < 1).length;
  if (bad) { console.error('⛔ 回读：dupN 不是正整数的有 ' + bad + ' 行'); process.exit(2); }
  const sum = br.reduce((s, r) => s + 1 / (+r[jN]), 0);
  console.log('回读守卫 ✅ ' + br.length + ' 行 ‖ 按 dupN 加权的"不同权重数" = ' + sum.toFixed(1) + '（应等于去重表 ' + Object.keys(WID).length + '）'); }
console.log('已写 ' + CF + '：' + rows.length + ' 行 ‖ 权重身份去重 = ' + Object.keys(WID).length + ' 个' +
  '（读不出 wid 的 ' + nun + ' 枚各算一个）‖ 同权重多名的组 = ' + dup.length + ' 组，覆盖 ' + nDupRows + ' 行');
for (const v of dup.sort((a, b) => b.length - a.length).slice(0, 5)) console.log('  ×' + v.length + '  ' + v.slice(0, 6).join(' ') + (v.length > 6 ? ' …' : ''));
