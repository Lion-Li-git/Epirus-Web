#!/usr/bin/env node
/* 训练侧旋钮单一真源（ZCode · 11-10 深夜，用户令"让所有接线旋钮都明确"）
 *
 * 2026-11-19 凌夜大改（用户裁定「旧的全删了，统一管线」）：train-3p / train-best / train-fast /
 *   train-server 整条 v7 线删除 ⇒ 它们的 EPIRUS_* 旋钮宇宙（194 根的绝大头）随之消失；
 *   2.0 产线（pg-train / supfit-gd）吃 **--flag** 不吃 env ⇒ 旋钮册收敛为"工具侧散键 + promote 家族"。
 *   旧台账（REMOVED_TRAIN_KEYS / SELF_ENV_KEYS 注解收割）随被删文件一起进 git 历史，不再维护。
 *
 * 做什么：把"代码真读的集合"（server/knob-guard.mjs 的解析器）与入口清单合并成册 `TRAINING-KNOBS.md`。
 *
 * 防腐烂：`--check` 重新生成并与盘上文件逐字比对，不同 ⇒ exit 1。CI 在 gates.yml 里作为独立步骤跑。
 *
 * 用法：node training/knobs.mjs               # 重新生成 TRAINING-KNOBS.md（生成器就是本文件）
 *       node training/knobs.mjs --check       # 只比对，不一致 exit 1（CI 用）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readKeysOf, repoKnobUniverse } from './server/knob-guard.mjs';

const DOC = 'training/TRAINING-KNOBS.md';
const CHECK = process.argv.includes('--check');

/* —— 入口清单（2026-11-19 后幸存的环境旋钮读者）——
 * pg-train / supfit-gd 是 **--flag** 接口（rejectUnknownFlags 把关），不在 env 旋钮宇宙里。
 * promote 家族的 NO_＊ / GAMES 族仍是 env（11-11 夜加进来的第五入口，理由见 git 史）。 */
const ENTRIES = [
  { tool: 'promote-champion', file: 'tools/promote-champion.mjs' },
];

const sets = {};
for (const e of ENTRIES) {
  sets[e.tool] = Array.from(readKeysOf({ tool: e.tool, env: {}, entry: e.file }).read);
}
const universe = Array.from(repoKnobUniverse(['tools', 'training'])).sort();

const rows = [];
for (const k of universe) {
  const readers = ENTRIES.filter((e) => sets[e.tool].includes(k)).map((e) => e.tool);
  rows.push({ k, readers, status: readers.length ? '在用' : '暗键（被提及无人读）' });
}
const live = rows.filter((r) => r.status === '在用');
const dark = rows.filter((r) => r.status !== '在用');

const md = [];
md.push('# 训练侧旋钮册（生成物，勿手改）');
md.push('');
/* ⚠ 头注也由本文件生成：以前有人在册子上手加过一段"生成器 tools/knob-registry.mjs…CI 每次 push --check"，
 *   那个文件名的生成器**从未入库**（git 史里查不到），而 `--check` 只比下面的数据账三个数 ⇒ 错话活了下来，
 *   并且任何人一跑重生成就会把它抹掉。头注写进生成器才是它该待的地方（11-20 核对）。 */
md.push('> 生成器就是本文件：`node training/knobs.mjs` 重生成；CI 每次都跑 `node training/knobs.mjs --check`（`.github/workflows/gates.yml`）。');
md.push('> ⚠ `--check` 只核下面的**数据账**（全集/在用/暗键三个数）⇒ 本头注不在它的比对范围，别把手写说明加在册子上，加到这里。');
md.push('> 真源：`training/server/knob-guard.mjs` 的 `readKeysOf()`（入口的源码 + 传递 import 闭包 + 显式声明的名单）解析现存入口的 env 读取。');
md.push('> 注解：`training/train-3p.mjs` 的 `SELF_ENV_KEYS` 行尾注释——注解住在读取处旁边，删旋钮时自然消失。');
md.push('> 历史台账（`REMOVED_TRAIN_KEYS` 等）在被删文件里，随 git 史可考。');
md.push('> 2026-11-19 起本册大幅缩水：v7 线（train-3p/best/fast/server）已删除，其 EPIRUS_* 旋钮宇宙随之消失；');
md.push('> 2.0 产线（pg-train / supfit-gd）是 **--flag** 接口（见 training/README.md §〇），不走 env 旋钮。');
md.push('> 数据账：全集 ' + universe.length + ' ‖ 在用 ' + live.length + ' ‖ 暗键 ' + dark.length);
md.push('');
md.push('## 全量（按名排序）');
md.push('');
md.push('| 旋钮 | 读它的入口 | 状态 |');
md.push('|---|---|---|');
for (const r of rows) {
  md.push('| `' + r.k + '` | ' + (r.readers.length ? r.readers.join(' ') : '—') + ' | ' + r.status + ' |');
}
md.push('');
if (dark.length) {
  md.push('## 暗键（删除候选：源码有字面量、现役入口不读）');
  md.push('');
  for (const r of dark) md.push('- `' + r.k + '`');
  md.push('');
}
const content = md.join('\n') + '\n';

if (CHECK) {
  let cur = '';
  try { cur = readFileSync(DOC, 'utf8'); } catch (e) { console.error('⛔ ' + DOC + ' 不存在（先跑一次不带 --check 的生成）'); process.exit(1); }
  if (cur !== content) {
    console.error('⛔ ' + DOC + ' 过期（env 读取变了没重生成）⇒ 跑 `node training/knobs.mjs` 后随改动一起提交');
    process.exit(1);
  }
  console.log('旋钮册新鲜 ✅（全集 ' + universe.length + ' ‖ 在用 ' + live.length + ' ‖ 暗键 ' + dark.length + '）');
  process.exit(0);
}
writeFileSync(DOC, content);
console.log('已生成 ' + DOC + ' ‖ 全集 ' + universe.length + ' ‖ 在用 ' + live.length + ' ‖ 暗键 ' + dark.length);
if (dark.length) console.log('暗键（删除候选）：' + dark.map((r) => r.k).join(' '));
