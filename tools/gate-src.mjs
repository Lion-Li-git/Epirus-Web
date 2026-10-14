/* gate-src.mjs —— 「门体面」的**唯一定义**（v1.7.8：278 条门从 tools/np-test.mjs 拆进 tools/gates/**）
 *
 * 为什么要有这一处：拆分之后，"门体住在哪份源码里"**不再是一个文件名**。
 *   凡按文件名定位门体源码的工具（`gate-sentinel` / `gate-audit-vacuous` / `dedupe-artifacts` /
 *   `docs/debug/sentinel-triage`）都必须问这一处要面 —— 各自再 glob 一遍就是本仓
 *   "同一份名单抄两遍"那个病（栽过至少四次）。
 *
 * ## 面是什么（三条，各有一个具体理由；缺一条就会让某把尺变瞎）
 *   ① `tools/np-test.mjs`          runner：门由它的 `t()` 注册；收尾的"注册数 vs 执行数"守卫读的就是它。
 *   ② `tools/gates/_ctx.mjs`       共享前导：**它没有门**（没有一条 `^t(` 行 ⇒ 含它 278、不含它也 278，已实测），
 *                                  但 `FIXTURE_PACK = 'docs/artifacts/eval-out/win-Ldemo.bak'` 这类
 *                                  "**门体里写死的产物路径**"住在它里面 ⇒ `dedupe-artifacts --check` 的
 *                                  "这些路径必须在 git 里"那条账**看不见它就会漏**（拆前它躺在 np-test.mjs 里，
 *                                  正好在上述工具的读取面上）⇒ 所以它**进面**。
 *   ③ `tools/gates/<部分>.mjs` ×16  278 条门体。顺序 = 各自**最小原始行号**升序 ⇒ 与拆分前的阅读顺序一致
 *                                  （凡带"第一处"语义的抽取式靠它保持同义，例如"第一处 `const SENT = {`"）。
 * ⚠ **本文件不在面里**：它没有门体、也不是被判的对象 —— "数门"这件事不该把量尺自己数进去。
 * ⚠ 只读**文本**、绝不 import 它们：import 会执行整个沙箱装载（副作用 + 数秒），而且 `_ctx.mjs` 反过来依赖本文件 ⇒ 成环。
 *
 * ## 并集文本为什么要插分隔行
 *   工具们的切片口径是"从 `^t(` 到下一个 `^t(` 之前"。若把 18 个文件首尾相接，某文件**最后一条门**的门体
 *   会一路卷进下一个文件的脚手架（实测 +37 行/文件）⇒ 门体不再等于"那一条门的源码"。
 *   所以 `gateBodyText()` 在每个文件前插一行 `BOUNDARY`（`//` 开头 ⇒ 掩码/注释过滤天然把它当注释）；
 *   工具把"下一个 `^t(` 或下一个分隔行"当门体终点，坐标改成 `文件:行号`（并集偏移对人没用）。
 *   ⚠ 坐标格式的消费者审计（v1.7.8）：全仓 `grep -n gate-sentinel` 17 处，**没有任何消费者 parse 坐标**
 *     （只有 CHANGELOG/日志/清单文档在引用**计数**；`.github/workflows/gates.yml:87` 那一步只有 `run: node tools/gate-sentinel.mjs`，
 *      既没有 `want:` 也没有 grep ⇒ **只看退出码**，而它默认 `exit 0`）⇒ 改坐标安全。
 *
 * 导出：`gateBodyFiles()` ⇐ 面的文件名单（按面的顺序）· `partFiles()` ⇐ 只有 16 个部分 ·
 *       `gateBodyText()` ⇐ 面的正文（带分隔行）· `BOUNDARY` ⇐ 分隔行前缀。
 */
import { readFileSync, readdirSync } from 'node:fs';

export const RUNNER_FILE = 'tools/np-test.mjs';
export const CTX_FILE = 'tools/gates/_ctx.mjs';
export const GATE_DIR = 'tools/gates';
/** 并集正文里的文件分隔行：`//#np-gate-file-boundary <相对路径>` */
export const BOUNDARY = '//#np-gate-file-boundary ';

/** 16 个部分文件（**只有门体**，不含 runner/_ctx），按各自最小原始行号升序。 */
export function partFiles() {
  const rows = [];
  for (const f of readdirSync(GATE_DIR)) {
    if (!/\.mjs$/.test(f) || f === '_ctx.mjs') continue;
    const p = GATE_DIR + '/' + f;
    const m = /^export const ords = \[(\d+)/m.exec(readFileSync(p, 'utf8'));
    /* ⚠ 读不出首条 ords ⇒ 响亮失败（宁可红也不许静默少数几个文件 —— 那正是这次拆分要防的形状） */
    if (!m) throw new Error('gate-src：' + p + ' 里找不到 `export const ords = [...]` ⇒ 门体面不完整，拒绝给出面');
    rows.push({ file: p, first: Number(m[1]) });
  }
  if (!rows.length) throw new Error('gate-src：' + GATE_DIR + ' 下没有任何部分文件 ⇒ 门体面是空的');
  rows.sort(function (a, b) { return a.first - b.first; });
  return rows.map(function (r) { return r.file; });
}

/** 门体面（runner → _ctx → 16 个部分，按上述顺序）。 */
export function gateBodyFiles() { return [RUNNER_FILE, CTX_FILE].concat(partFiles()); }

/** 面的正文：各文件原文之间插一行 `BOUNDARY`（工具按它切片 ⇒ 门体不跨文件）。 */
export function gateBodyText() {
  return gateBodyFiles().map(function (f) { return BOUNDARY + f + '\n' + readFileSync(f, 'utf8'); }).join('');
}
