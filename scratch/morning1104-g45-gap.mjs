#!/usr/bin/env node
/* morning1104-g45-gap.mjs —— 把"上线包顶多一个门没过、而且不能差很远"变成可排的表
 * 输入：scratch/night6/promote/*.txt（16-lane 全量普查的体检回执）
 * 解析：G4[路径/桌] 的「最克“X” P%」（= 最强一行脚本对该包的胜率，线 ≤60）
 *        G5[路径/桌] 的「实测防席夺冠 P%」（关档线 ≤25 ‖ 带档线 ≤40，带档只记录）
 * ⚠ 路径里本来就有斜杠（scratch/night6/HPG-s7/long）⇒ 匹配包名段必须用懒惰 `(.+?)`，
 *    用 `[^/]+` 会一个都抓不到（第一版就是这么全 `—` 的，差点把"0 门"当成结论）。
 * 条款：门按 **G4 与 G5 两条**算（每条内部取两桌最坏），因为"顶多一个门没过"说的是门不是格；
 *       桌形逐桌印，不许用最坏格抹平（在册：分层读数的自检要能碰到那一格）；`—` = 读不出 ≠ 过关。
 */
import { readdirSync, readFileSync } from 'node:fs';

const DIR = process.argv[2] || 'scratch/night6/promote';
const LINE = { G4: 60, G5: 25, G5DAI: 40 };
const rows = [];
for (const f of readdirSync(DIR).filter(x => x.endsWith('.txt')).sort()) {
  const t = readFileSync(DIR + '/' + f, 'utf8');
  const cell = {};
  const put = (k, v, who) => { if (v !== null && cell[k] === undefined) cell[k] = { v, who }; };
  /* G4 的正读数**总在场**（走 T2 那条"反制者期望损失"记录行，两桌都有 mean/中位/>50% 格数/最克）；
   * 而 ✗ 汇总行只印失败格 ⇒ 只看汇总行会把"过了没印"读成"读不出"。 */
  for (const m of t.matchAll(/G4\[(.+?)\/(long|multi)\][^\n]*?最克「([^」]+)」\s*([\d.]+)%/g)) {
    if (!m[1].includes('/')) continue;                 // 「线上包」这类参照行不收
    put('G4' + m[2], +m[4], m[3]);
  }
  for (const m of t.matchAll(/(?:^|\s)(?:[\w./-]+)\/(long|multi) mean=[\d.]+%[^\n]*?最克「([^」]+)」\s*([\d.]+)%（n=\d+）/g)) {
    put('G4' + m[1], +m[3], m[2]);                     // 期望损失行 = 过了也印的正读数（缺 ✗ 行时的兜底）
  }
  for (const m of t.matchAll(/G5(带档)?\[(.+?)\/(long|multi)\][^\n]*?实测防席夺冠\s*([\d.]+)%/g)) {
    if (!m[2].includes('/')) continue;
    put((m[1] ? 'G5dai' : 'G5') + m[3], +m[4], null);
  }
  const g = k => (cell[k] ? cell[k].v : null);
  const g4 = [g('G4long'), g('G4multi')], g5 = [g('G5long'), g('G5multi')];
  const worstOf = a => a.every(x => x === null) ? null : Math.max(...a.map(x => x === null ? -1 : x));
  const w4 = worstOf(g4), w5 = worstOf(g5);
  const fail4 = w4 !== null && w4 > LINE.G4, fail5 = w5 !== null && w5 > LINE.G5;
  const over = v => v === null ? 0 : Math.max(0, v - LINE.G4).toFixed(1);
  const over5 = w5 === null ? 0 : +Math.max(0, w5 - LINE.G5).toFixed(1);
  const who = (g('G4long') !== null && (g('G4multi') === null || g('G4long') >= g('G4multi'))) ? cell.G4long.who : cell.G4multi ? cell.G4multi.who : '';
  /* 三态：G5 关档缺值时若**带档行在**（带档两桌总在场）⇒ 读作"关档过了、汇总行没印"，不是"读不出"。
   * 连带档都没有才算读不出（没印 ≠ 过关，也没印 ≠ 没测）。 */
  const daiKnown = (g('G5dailong') !== null || g('G5damulti') !== null);
  const unread = (w4 === null ? 1 : 0) + (w5 === null && !daiKnown ? 1 : 0);
  const g5State = w5 !== null ? '值' : (daiKnown ? '过了未印' : '读不出');
  rows.push({ name: f.replace(/\.txt$/, ''), g4, g5, dai: [g('G5dailong'), g('G5damulti')],
    nFail: (fail4 ? 1 : 0) + (fail5 ? 1 : 0), over4: +over(w4), over5, worst: +Math.max(+over(w4), over5).toFixed(1), who, unread, g5State });
}
rows.sort((a, b) => a.nFail - b.nFail || a.worst - b.worst);
const p = (v, n) => (v === null || v === undefined ? '—' : String(v)).padStart(n);
console.log('包'.padEnd(20) + '  G4l  G4m   G5l  G5m | 带L  带M | 挂门 超G4 超G5 读不出  最坏克星');
for (const r of rows) console.log(r.name.padEnd(20) + p(r.g4[0], 5) + ' ' + p(r.g4[1], 5) + ' ' + p(r.g5[0], 5) + ' ' + p(r.g5[1], 5) +
  ' |' + p(r.dai[0], 4) + ' ' + p(r.dai[1], 4) + '|  ' + r.nFail + '  ' + p(r.over4, 5) + ' ' + p(r.over5, 5) + '   ' + r.unread + '    ' + (r.who || ''));
const within = rows.filter(r => r.nFail <= 1 && r.worst <= 10 && r.unread === 0);
console.log('\n== 门数口径：G4/G5 各算一条（每条取两桌最坏）‖ 线 G4 ≤' + LINE.G4 + ' ‖ G5 关档 ≤' + LINE.G5 + '（带档 ≤' + LINE.G5DAI + ' 只记录）');
console.log('== 挂 0 门：' + rows.filter(r => r.nFail === 0 && r.unread === 0).length + ' 枚 ‖ 挂 ≤1 门：' + rows.filter(r => r.nFail <= 1 && r.unread === 0).length + ' 枚 ‖ 再加"不远"(最坏超限 ≤10pt)：' + within.length + ' 枚');
console.log('   ' + (within.map(r => r.name + '(' + r.nFail + '门/' + r.worst + 'pt)').join(' ‖ ') || '空'));
console.log('== 最接近达标的三枚（按 挂门→最坏超限 排序）：' + rows.slice(0, 3).map(r => r.name + ' ' + r.nFail + '门 超' + r.worst + 'pt').join(' ‖ '));
