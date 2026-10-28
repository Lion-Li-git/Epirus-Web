#!/usr/bin/env node
/* §E820（10-28 下午）**标签分辨率到底卡在哪儿**：同一份 dump 上按前缀 2/4/8/16 条流重算分半一致率 + 并列率
 * 动因（这是被一个反直觉读数逼出来的）：§E817 判"读不出"的唯一凭据是标签分半一致率 52.8%（`--rep=4`），
 *   我据此写下"下一步是把标签做硬 —— `--rep` 线性加"。真加了（`--rep=16`）之后一致率**不升反降**
 *   （留出 43.7% ‖ 训练 45.8%）⇒ 说明"流数"根本不是这一格的杠杆，必须先看清一致率是由什么撑着的。
 * 这台尺问的就是那一件：**少流时的"一致"有多少来自并列**（两半的均值恰好相等 ⇒ 由"按下标取第一个"裁决 ⇒
 *   两半自然挑到同一个下标 ⇒ 一致率被**并列**抬高，而不是被"标签真的定了序"抬高）。
 *   并列率随流数下降得比分半一致率还快 ⇒ 那句"52.8%"是被并列抬过的数，真实分辨率更差。
 * ⚠ 口径三条（引用必带）：
 *   ① 只在**同一份 dump** 内部做前缀嵌套比较（同一批决策、同一批流编号）⇒ 跨 rep 的**绝对 regret 不可横比**
 *      （实测 `regret(net)` 17.53 @rep4 → 12.39 @rep16，方向与在册 §E200/§E202"上限里有一半是选择膨胀"同向）。
 *   ② 逐流数组残缺的行**整组跳过**（不猜、不补 0）。
 *   ③ 只读 JSONL，不改引擎、不加门、不动冠军槽。
 * 用法：node tools/probe-label-resolution.mjs --dump=<jsonl> [--prefixes=2,4,8,16]
 */
import { readFileSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['dump', 'prefixes'], 'probe-label-resolution');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const DUMP = arg('dump', '');
if (!DUMP) { console.error('⛔ 需要 --dump=<jsonl>（`tools/probe-myopia-regret.mjs` 带 dump 旗标落的那种逐候选行）'); process.exit(2); }

const rows = readFileSync(DUMP, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
const H0 = rows[0] && rows[0].winS ? rows[0].winS.length : 0;
if (!H0 || H0 < 2) { console.error('⛔ 这份 dump 没有长度 ≥2 的 winS 逐流数组 ⇒ 前缀扫做不了（先确认采集时 REP≥2）'); process.exit(2); }
const groups = new Map();
for (let i = 0; i < rows.length; i++) {
  const gk = rows[i].arm + '|' + rows[i].pk + '|' + rows[i].round;
  if (!groups.has(gk)) groups.set(gk, []);
  groups.get(gk).push(i);
}
const PRE = String(arg('prefixes', '2,4,8,16')).split(',').map(x => Math.floor(Number(x))).filter(x => x >= 2 && x <= H0);
console.log('# §E820 标签分辨率 ‖ dump ' + DUMP + ' ‖ 行 ' + rows.length + ' ‖ 组 ' + groups.size
  + ' ‖ winS 长度 ' + H0 + ' ‖ 前缀扫 ' + PRE.join('/'));
console.log('# ⚠ 只在同一份 dump 内做嵌套前缀比较 ⇒ 跨 rep 的绝对 regret 不可横比（见头部条款 ①）');
let skipped = 0;
for (const H of PRE) {
  const mid = H / 2 | 0;
  let agree = 0, n = 0, ties = 0;
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    if (idx.some(i => !rows[i].winS || rows[i].winS.length < H)) { skipped++; continue; }
    const A = idx.map(i => { let s = 0; for (let k = 0; k < mid; k++) s += rows[i].winS[k]; return s / mid; });
    const B = idx.map(i => { let s = 0; for (let k = mid; k < H; k++) s += rows[i].winS[k]; return s / (H - mid); });
    const pick = function (arr) {
      let bi = 0, bv = -1, tn = 0;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] > bv + 1e-12) { bv = arr[i]; bi = i; tn = 1; }
        else if (Math.abs(arr[i] - bv) < 1e-12) tn++;
      }
      return { bi: bi, tied: tn > 1 };
    };
    const a = pick(A), b = pick(B);
    n++;
    if (a.bi === b.bi) agree++;
    if (a.tied || b.tied) ties++;
  }
  if (!n) { console.log('  前缀 ' + H + ' ⇒ ⚠ **一组都没有**（分母 0）⇒ 这一格读不出，不是 0%'); continue; }
  console.log('  每半 ' + mid + ' 条流（总 ' + H + '）⇒ 分半一致率 **' + (agree / n * 100).toFixed(1) + '%**（' + n + ' 组）'
    + ' ‖ 至少一半里存在并列的组 **' + (ties / n * 100).toFixed(1) + '%**');
}
console.log('  随机基线（按平均候选数 1/K）≈ ' + (100 / (rows.length / groups.size)).toFixed(1) + '%');
if (skipped) console.log('  ⚠ 因 winS 残缺跳过的组：' + skipped + ' 个（不补数、不猜）');
console.log('  ⇒ 读法：一致率**随流数上升**才叫"标签在做硬"；若随流数下降、且并列率同向掉，');
console.log('    那少流时的一致是**并列被按下标裁决**抬出来的假一致 ⇒ 加 rep 不是这一格的杠杆（换标签定义或加组数才是）。');
