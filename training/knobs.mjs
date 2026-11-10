#!/usr/bin/env node
/* 训练侧旋钮单一真源（ZCode · 11-10 深夜，用户令"让所有接线旋钮都明确"）
 *
 * 做什么：把"代码真读的集合"（server/knob-guard.mjs 的解析器，复用千问普查的入口配置，不写第二份扫描）
 *   与"人写的注解"（train-3p 的 SELF_ENV_KEYS 逐条注释——注解住在读取处旁边，单一真源）合并成册：
 *   `docs/TRAINING-KNOBS.md`。每行一个旋钮：读它的入口 ‖ 登记状态 ‖ 源码注解 ‖ 位置。
 *
 * 为什么注解从源码收割而不是另立一份表：另立一份 = 第二处要人肉同步 = 千问普查抓到的那场病
 *   （索引 118 条、代码读 158 条、漏 39 条）重演。注释跟着读取行走，删旋钮时注释自然消失。
 *
 * 防腐烂：`--check` 重新生成并与盘上文件逐字比对，不同 ⇒ exit 1。CI 在 gates.yml 里作为独立步骤跑
 *   （没有挂进 np 门体——np 部件是生成切片，徒手加部件会破"并集守卫"，见 gates.yml 头注）。
 *
 * 用法：node tools/knob-registry.mjs            # 重新生成 docs/TRAINING-KNOBS.md
 *       node tools/knob-registry.mjs --check    # 只比对，不一致 exit 1（CI 用）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readKeysOf, repoKnobUniverse, scanKeysFromSource } from './server/knob-guard.mjs';
import { ECON_ENV_KEYS } from './server/econ-env.mjs';
import { FIGHT_ENV_KEYS } from './server/fight-env.mjs';
import { TRAIN_ENV_KEYS, REMOVED_TRAIN_KEYS } from './server/train-env.mjs';

const DOC = 'training/TRAINING-KNOBS.md';
const CHECK = process.argv.includes('--check');

/* —— 五入口的读集（opt 逐条抄自各文件的 enforceKnobs 调用；与 scratch/qoder-1110-knob-census.mjs 同源，改两处要一起改）——
 * 11-11 夜：补 promote-champion（第五入口）——体检探针的 NO_＊ 与 GAMES 族旋钮真读它，
 *   此前四入口口径把它们误判成"暗键（删除候选）"——口径错了清单就危险。 */
const ENTRIES = [
  { tool: 'train-3p', file: 'training/train-3p.mjs' },
  { tool: 'train-best', file: 'training/train-best.mjs' },
  { tool: 'train-fast', file: 'training/train-fast.mjs' },
  { tool: 'train-server', file: 'training/server/train-server.mjs' },
  { tool: 'promote-champion', file: 'tools/promote-champion.mjs' },
];
const src3p = readFileSync('training/train-3p.mjs', 'utf8');
/* SELF_ENV_KEYS 数组块（含行尾注释——这就是注解的真源） */
function selfEnvBlock() {
  const a = src3p.indexOf('const SELF_ENV_KEYS = [');
  const b = src3p.indexOf('\n];', a);
  if (a < 0 || b < 0) throw new Error('找不到 SELF_ENV_KEYS 数组边界');
  return src3p.slice(a, b);
}
const block = selfEnvBlock();
const selfEnvKeys = Array.from(scanKeysFromSource(block));
/* 行级收割：'KEY1', 'KEY2',   // 注解 ⇒ { key → 注解 }（同行多键共享同一注解） */
const NOTES = new Map();
for (const line of block.split('\n')) {
  const keys = Array.from(scanKeysFromSource(line));
  const cm = line.match(/\/\/\s*(.+?)\s*$/);
  if (keys.length && cm) for (const k of keys) NOTES.set(k, cm[1]);
}
/* 三份单一来源 + 已删除台账（导出常量直接 import，比解析可信） */
const SINGLE = new Map([
  ['ECON_ENV_KEYS', ECON_ENV_KEYS], ['FIGHT_ENV_KEYS', FIGHT_ENV_KEYS], ['TRAIN_ENV_KEYS', TRAIN_ENV_KEYS],
]);
const REMOVED = new Set(Object.keys(REMOVED_TRAIN_KEYS));   /* 形态 = { 键: 删除理由 }（train-env.mjs:26） */

const sets = {};
for (const e of ENTRIES) {
  const opts = e.tool === 'train-3p'
    ? { tool: e.tool, env: {}, entry: e.file, extraReadKeys: selfEnvKeys }
    : e.tool === 'train-server'
      ? { tool: e.tool, env: {}, entry: e.file, selfFiles: ['training/server/train-worker.mjs', 'training/server/paralleltrain.mjs'],
          extraReadKeys: ECON_ENV_KEYS.concat(FIGHT_ENV_KEYS, TRAIN_ENV_KEYS) }
      : { tool: e.tool, env: {}, entry: e.file };
  sets[e.tool] = Array.from(readKeysOf(opts).read);
}
const universe = Array.from(repoKnobUniverse(['tools', 'training'])).sort();
const all = Array.from(new Set([].concat(universe, selfEnvKeys))).sort();

const rows = [];
for (const k of all) {
  const readers = ENTRIES.filter((e) => sets[e.tool].includes(k)).map((e) => e.tool);
  const mentioned = universe.includes(k);
  const inSelf = selfEnvKeys.includes(k);
  const removed = REMOVED.has(k);
  let status;
  if (removed) status = '已删除（台账在册）';
  else if (readers.length) status = '在用';
  else if (mentioned) status = '暗键（被提及无人读）';
  else status = '孤儿（只登记未实现）';
  rows.push({ k, readers, inSelf, note: NOTES.get(k) || '', single: [...SINGLE.entries()].find(([, ks]) => ks.includes(k))?.[0] || '', status });
}
const live = rows.filter((r) => r.status === '在用');
const dark = rows.filter((r) => r.status === '暗键（被提及无人读）');
const orphan = rows.filter((r) => r.status === '孤儿（只登记未实现）');
const unreg = live.filter((r) => !r.inSelf && !r.single);   /* 11-11：有单一来源表的算有家（它们的注解住在 econ/fight/train-env） */

const md = [];
md.push('# 训练侧旋钮册（生成物，勿手改）');
md.push('');
md.push('> 生成器 `tools/knob-registry.mjs`（`--check` 模式供 CI 防腐烂）。真源有两处、各司其职：');
md.push('> ① **代码读取**（server/knob-guard.mjs 解析四个入口，读集即闸真正认的集合）；');
md.push('> ② **注解**（`tools/train-3p.mjs` 的 `SELF_ENV_KEYS` 行尾注释——注解住在读取处旁边，删旋钮时自然消失）。');
md.push('> 改了任何一处的 env 读取 / 注解 ⇒ 跑 `node tools/knob-registry.mjs` 重生成；CI 每次 push 都会 `--check`。');
md.push('> 数据账：全集 ' + universe.length + ' ‖ 在用 ' + live.length + ' ‖ 暗键 ' + dark.length + ' ‖ 孤儿 ' + orphan.length +
  ' ‖ 在用未登记 ' + unreg.length + ' ‖ 已删除台账 ' + REMOVED.size);
md.push('');
md.push('## 状态速览');
md.push('');
md.push('| 状态 | 含义 | 处置 |');
md.push('|---|---|---|');
md.push('| 在用 | ≥1 入口真读它 | 必须有注解；未登记的补进 SELF_ENV_KEYS |');
md.push('| 暗键 | 源码里有字面量但四入口都不读 | 删除候选（先查 121 份启动器有没有在 set）|');
md.push('| 孤儿 | 只在 SELF_ENV_KEYS 登记却无人读 | 注解过期，删登记或恢复实现 |');
md.push('| 已删除 | REMOVED_TRAIN_KEYS 台账在册 | 重启必须走台账流程 |');
md.push('');
md.push('## 全量（按名排序）');
md.push('');
md.push('| 旋钮 | 读它的入口 | 登记 | 单一来源表 | 状态 | 注解（SELF_ENV_KEYS 行尾） |');
md.push('|---|---|---|---|---|---|');
for (const r of rows) {
  md.push('| `' + r.k + '` | ' + (r.readers.length ? r.readers.join(' ') : '—') + ' | ' + (r.inSelf ? 'Y' : '—') +
    ' | ' + (r.single || '—') + ' | ' + r.status + ' | ' + (r.note || '').replace(/\|/g, '\\|') + ' |');
}
md.push('');
if (unreg.length) {
  md.push('## 在用未登记（补 SELF_ENV_KEYS 的清单）');
  md.push('');
  for (const r of unreg) md.push('- `' + r.k + '` ← ' + r.readers.join(' '));
  md.push('');
}
if (dark.length) {
  md.push('## 暗键（删除候选，处置前先查启动器）');
  md.push('');
  for (const r of dark) md.push('- `' + r.k + '`');
  md.push('');
}
const content = md.join('\n') + '\n';

if (CHECK) {
  let cur = '';
  try { cur = readFileSync(DOC, 'utf8'); } catch (e) { console.error('⛔ ' + DOC + ' 不存在（先跑一次不带 --check 的生成）'); process.exit(1); }
  if (cur !== content) {
    console.error('⛔ ' + DOC + ' 过期（env 读取或 SELF_ENV_KEYS 注解变了没重生成）⇒ 跑 `node tools/knob-registry.mjs` 后随改动一起提交');
    process.exit(1);
  }
  console.log('旋钮册新鲜 ✅（全集 ' + universe.length + ' ‖ 在用 ' + live.length + ' ‖ 未登记 ' + unreg.length + ' ‖ 暗键 ' + dark.length + '）');
  process.exit(0);
}
writeFileSync(DOC, content);
console.log('已生成 ' + DOC + ' ‖ 全集 ' + universe.length + ' ‖ 在用 ' + live.length + ' ‖ 暗键 ' + dark.length + ' ‖ 孤儿 ' + orphan.length + ' ‖ 在用未登记 ' + unreg.length);
if (unreg.length) console.log('在用未登记：' + unreg.map((r) => r.k).join(' '));
