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
 * 防腐烂：`--check` 重新生成并与盘上文件逐字比对，不同 ⇒ exit 1。CI 在 training.yml 里作为独立步骤跑。
 *
 * 用法：node training/knobs.mjs               # 重新生成 TRAINING-KNOBS.md（生成器就是本文件）
 *       node training/knobs.mjs --check       # 只比对，不一致 exit 1（CI 用）
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { readKeysOf, repoKnobUniverse } from './server/knob-guard.mjs';

const DOC = 'training/TRAINING-KNOBS.md';
const CHECK = process.argv.includes('--check');

/* —— 判"有没有人读"的口径（2026-11-24 夜班换的）——
 * 老口径拿一张**手维护入口名单**判，两头都错过（都是现查出来的，不是推测）：
 *   · 漏判一整族：`training/train-3p.mjs` 按 env 读 `EPIRUS_ANCHOR / BREADTH_FLOOR / GA_GATE / HALL_TRACE …`，
 *     而它被 `tools/gate-*.mjs`、`tools/gates/*.mjs` 当子进程调起 ⇒ 名单里没有它，全族被判"暗键"，
 *     照着这张表去删就会删坏现役训练器；
 *   · 反例第二枚：`EPIRUS_BATCH_MAX` 被 `tools/np-parallel.mjs` 读着，同样被判"暗键"。
 * 新口径不猜名单，**按读法扫维护面**：`process.env.X` / `process.env['X']` / `env.X` / `env['X']` / `e.<KEY>` 这类 env 别名都算读。
 *   动态读法（`env[变量]`，例如 `knob-guard.mjs` 的 `env[ESCAPE_KEY]`）看不见具体键 ⇒ 单列一档，
 *   **绝不当删除候选**；只有既无读法、也不在任何动态读取者里的键才进"暗键"。
 * ⚠ 已知偏乐观的一面：读法出现在**注释里**也算数（我没剥注释），所以这一版只会把死键错报成活的，
 *   不会把活键错报成死的——危险方向是反的那一个，被排除掉了。
 * ENTRIES 留着，但只用来给"读它的入口"那一列署名（署名是信息，不是判据）。 */
const ENTRIES = [
  { tool: 'promote-champion', file: 'tools/promote-champion.mjs' },
  { tool: 'train-3p', file: 'training/train-3p.mjs' },
  { tool: 'train', file: 'training/train.mjs' },
];
const READ_ROOTS = ['tools', 'training', 'js', 'champion-map'];
const SKIP_PATH = /(node_modules|[\\/]archive[\\/]|[\\/]\.old[\\/])/;

const scanned = [];
const walk = (dir) => {
  let es; try { es = readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of es) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) { walk(p); continue; }
    if (!ent.isFile() || !/\.(mjs|js)$/.test(ent.name) || SKIP_PATH.test(p)) continue;
    let src = ''; try { src = readFileSync(p, 'utf8'); } catch (e) { continue; }
    scanned.push({ p: p.split(sep).join('/'), src });
  }
};
for (const r of READ_ROOTS) walk(r);

/* 读法命中表：key → 命中的文件（相对路径） */
const READ_HITS = new Map();
const DYN_FILES = [];
for (const f of scanned) {
  const re = /(?:process\.)?env\s*\.\s*(EPIRUS_[A-Z0-9_]+)|(?:process\.)?env\s*\[\s*['"](EPIRUS_[A-Z0-9_]+)['"]\s*\]|\b(?:e|env)\s*\.\s*(EPIRUS_[A-Z0-9_]+)/g;
  let m2;
  while ((m2 = re.exec(f.src))) {
    const k = m2[1] || m2[2] || m2[3];
    if (!READ_HITS.has(k)) READ_HITS.set(k, []);
    if (!READ_HITS.get(k).includes(f.p)) READ_HITS.get(k).push(f.p);
  }
  /* 动态读取者：`env[` 后面跟的不是引号/键名，而是变量 ⇒ 这一档看不见具体键 */
  if (/process\.env\s*\[\s*(?!['"`]|EPIRUS_[A-Z0-9_]+\s*\])/.test(f.src) || /\benv\s*\[\s*(?!['"`]|EPIRUS_)[a-zA-Z_$]/.test(f.src)) DYN_FILES.push(f.p);
}
const dynMentions = new Set();
for (const p of DYN_FILES) {
  const f = scanned.find((x) => x.p === p); if (!f) continue;
  const mm = f.src.match(/EPIRUS_[A-Z0-9_]+/g) || [];
  for (const k of mm) dynMentions.add(k);
}

const sets = {};
for (const e of ENTRIES) {
  sets[e.tool] = Array.from(readKeysOf({ tool: e.tool, env: {}, entry: e.file }).read);
}
const universe = Array.from(repoKnobUniverse(['tools', 'training'])).sort();

const rows = [];
for (const k of universe) {
  const hits = READ_HITS.get(k) || [];
  const readers = ENTRIES.filter((e) => sets[e.tool].includes(k)).map((e) => e.tool);
  const status = hits.length ? '在用（读法 ' + hits.length + ' 处）' : (dynMentions.has(k) ? '仅动态提及（不删）' : '暗键（无读法）');
  rows.push({ k, readers, hits, status });
}
const live = rows.filter((r) => r.status.startsWith('在用'));
const dyn = rows.filter((r) => r.status.startsWith('仅动态提及'));
const dark = rows.filter((r) => r.status.startsWith('暗键'));

const md = [];
md.push('# 训练侧旋钮册（生成物，勿手改）');
md.push('');
/* ⚠ 头注也由本文件生成：以前有人在册子上手加过一段"生成器 tools/knob-registry.mjs…CI 每次 push --check"，
 *   那个文件名的生成器**从未入库**（git 史里查不到），而 `--check` 只比下面的数据账三个数 ⇒ 错话活了下来，
 *   并且任何人一跑重生成就会把它抹掉。头注写进生成器才是它该待的地方（11-20 核对）。 */
md.push('> 生成器就是本文件：`node training/knobs.mjs` 重生成；CI 每次都跑 `node training/knobs.mjs --check`（`.github/workflows/training.yml`）。');
md.push('> ⚠ `--check` 比的是**整篇字节**（不是只比数据账三个数——旧头注这么写，是错的：`cur !== content` 才 exit 1）。');
md.push('> 判"在用/暗键"的口径（2026-11-24 换）：**按读法扫维护面**（`tools/ training/ js/ champion-map/` 里 `process.env.X` / `env[\'X\']` / `e.<KEY>` 别名），');
md.push('> 名单模块与注释不参与判定；`env[变量]` 这种**动态读法**看不见具体键，落进"仅动态提及"档，**不是删除候选**。');
md.push('> 为什么换口径：旧口径拿手维护的入口名单判，实测两头都错过——`training/train-3p.mjs` 整族键（`EPIRUS_ANCHOR`/`BREADTH_FLOOR`/`GA_GATE`…）与 `tools/np-parallel.mjs` 读的 `EPIRUS_BATCH_MAX` 都被判成暗键，照表删就删坏现役代码。');
md.push('> 运行时那套（`training/server/knob-guard.mjs` 的 `readKeysOf()` / `detectDarkKnobs()`，按**单个入口**的 import 闭包判）没变，也不该变：那是"这个入口认不认这个键"，本册答的是"全仓还有没有人读"。');
md.push('> 注解：`training/train-3p.mjs` 的 `SELF_ENV_KEYS` 行尾注释——注解住在读取处旁边，删旋钮时自然消失。');
md.push('> 历史台账（`REMOVED_TRAIN_KEYS` 等）在被删文件里，随 git 史可考。');
md.push('> 2026-11-19 起 v7 产线（train-best/fast/server 那批）退役、其旋钮宇宙大幅缩水；⚠ 但那句"train-3p 已删除"**不成立**：');
md.push('> `training/train-3p.mjs` 仍在仓（`tools/command-checkup.mjs:22,68` 拿它当 env 读者入口跑 `detectDarkKnobs`），死掉的是 `tools/train-3p.mjs` 那条旧路径（`tools/gate-all.mjs:89` 记着）。');
md.push('> 2.0 产线（pg-train / supfit-gd）是 **--flag** 接口（见 training/README.md §〇），不走 env 旋钮。');
md.push('> 数据账：全集 ' + universe.length + ' ‖ 在用（有读法）' + live.length + ' ‖ 仅动态提及 ' + dyn.length + ' ‖ 暗键 ' + dark.length);
md.push('');
md.push('## 全量（按名排序）');
md.push('');
md.push('| 旋钮 | 读它的文件（前 3） | 署名入口 | 状态 |');
md.push('|---|---|---|---|');
for (const r of rows) {
  const who = r.hits.length ? '`' + r.hits.slice(0, 3).join('` `') + '`' + (r.hits.length > 3 ? ' +' + (r.hits.length - 3) : '') : '—';
  md.push('| `' + r.k + '` | ' + who + ' | ' + (r.readers.length ? r.readers.join(' ') : '—') + ' | ' + r.status + ' |');
}
md.push('');
if (dyn.length) {
  md.push('## 仅动态提及（**不是删除候选**：读法长成 `env[变量]`，扫不出具体键）');
  md.push('');
  for (const r of dyn) md.push('- `' + r.k + '`');
  md.push('');
}
if (dark.length) {
  md.push('## 暗键（删除候选：维护面里没有任何 `env.X` / `env[\'X\']` / `e.<KEY>` 读法）');
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
  console.log('旋钮册新鲜 ✅（全集 ' + universe.length + ' ‖ 在用（有读法）' + live.length + ' ‖ 仅动态提及 ' + dyn.length + ' ‖ 暗键 ' + dark.length + '）');
  process.exit(0);
}
writeFileSync(DOC, content);
console.log('已生成 ' + DOC + ' ‖ 全集 ' + universe.length + ' ‖ 在用（有读法）' + live.length + ' ‖ 仅动态提及 ' + dyn.length + ' ‖ 暗键 ' + dark.length);
if (dark.length) console.log('暗键（删除候选）：' + dark.map((r) => r.k).join(' '));
