#!/usr/bin/env node
/* obs2-from-v7.mjs — 把同一批事实**正交重编码**成 2.0 观测集的核心块（DS · 2026-10-28 夜）
 *
 * 目的：先在**同一份信息**上量"编码结构"本身值多少（去冗余/去死维/事实只写一次），
 *   与 v7 的 235 维比线性可及的部分。**这不是"加新信息"的实验**——L4 派生与事件结果类需要新 dump（下一步）。
 *
 * 输入：probe-myopia-regret 的 dump（每行 x=235, win, net）
 * 输出：同 schema，但 x 换成 2.0 核心块：
 *   L0          3：alive、N、round/上限
 *   自己        20：hp、ep、电珠、爆珠、ringStreak、cannonPhase、cd、mine、tauntA、tauntP、baguaExtra、fireWeak、chains、nightmare、vampire、revive、infinite、rodGuard、stickers、上一手类别
 *   威胁对手    12：hp、ep、持珠、刚蓄能、上一手类别、无招、ep≥2、ep≥5、mine、tauntA、fireWeak、revive
 *   L2 关系     3：他上一手指向我 / 指向自己 / 指向别人
 *   L3 动作事实 16：cost、类别、攻/防/雷、dmg、pierce×3、target enemy/self、continuous、珠电/爆、可施展
 * ⚠ 去重记录：v7 里"持珠/刚蓄能/上一手蓄能"三连只留 1 位（持珠），"agg.minHp 与最弱对手槽血量"只留对手槽。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
function arg(k, d) { const f = argv.find((a) => a.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; }
const IN = String(arg('in', '')).split(',').filter(Boolean);
const OUT = arg('out', '');
const ARM = arg('arm', '');
if (!IN.length || !OUT) { console.error('⛔ --in=a.jsonl[,b.jsonl] --out=x.jsonl'); process.exit(2); }

let rows = [];
for (const p of IN) rows = rows.concat(readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
if (ARM) rows = rows.filter((r) => r.arm === ARM);
const out = [];
for (const r of rows) {
  const x = r.x;
  const g = (i) => x[i];
  const slot0 = 63;              /* 威胁最大的对手槽 */
  const b1 = 143 + 14;           /* 该对手的 B 块（slot 1） */
  const act = x.slice(213);
  /* L0 */
  const aliveOpp = [0, 1, 2, 3].reduce((s, s2) => s + (g(slot0 + 10 * s2) > 0 ? 1 : 0), 0);
  const v = [
    aliveOpp / 4,                                                    // L0: 存活对手数（归一）
    g(53),                                                           // L0: 回合进度
    Math.min(g(54), 1),                                              // L0: ep 相对全场
    /* 自己 20 */
    g(0), g(2), g(4), g(5), g(16), g(19), g(21), g(23), g(25), g(27),
    g(33), Math.max(g(35), g(36)), g(39), g(41), g(43), g(47), g(49), g(51), g(29), g(9),
    /* 威胁对手 12 */
    g(slot0 + 1), g(slot0 + 2), g(slot0 + 3), g(slot0 + 4), g(slot0 + 6), g(slot0 + 7),
    g(slot0 + 8), g(slot0 + 9), g(b1 + 5), g(b1 + 6), g(b1 + 4), g(b1 + 10),
    /* L2 关系 3 */
    g(127), g(126), g(128),
    /* L3 动作事实 16 */
    act[2], act[3], act[4], act[5], act[6], act[7], act[8], act[9], act[11], act[12], act[13], act[14], act[15], act[1]
  ];
  out.push({ seed: r.seed, arm: r.arm, env: r.env, g: r.g, n: r.n, round: r.round, pk: r.pk, i: r.i, key: r.key, target: r.target, net: r.net, win: r.win, x: v });
}
writeFileSync(OUT, out.map((o) => JSON.stringify(o)).join('\n'));
console.log('写出 ' + OUT + '：' + out.length + ' 行 ‖ 维 ' + out[0].x.length);
