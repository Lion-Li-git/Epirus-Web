/* out-path.mjs —— 把 `--out=` 那一个字符串**解析成真要写的路径**这一件事，做成可单元判定的纯函数。
 *
 * 为什么要单独一份（§2026-10-09 · Claude 整改建议 规矩 1）：这一支原先只在脚本体内，
 *   于是想钉它只能对源码做正则 ⇒ 正是那份文档禁止的"门禁测文本"那一类。
 *   抽成纯函数之后，门可以**给三种输入比三个输出**（相对 / POSIX 绝对 / 盘符绝对），
 *   不启动子进程、不需要谁在跑、**在 Windows 和 ubuntu 上判的是同一件事**。
 *
 * 它管的病（CI 连红 12 笔的唯一原因，实测复原过一次）：判绝对路径原先用 Windows 盘符正则，
 *   ubuntu 上 `--out=/tmp/e497-usage-XXXX/u.tsv` 不命中 ⇒ 被当相对路径拼进仓库 ⇒ 那层目录不存在
 *   ⇒ `writeFileSync` 抛 ENOENT ⇒ 子进程 exit 1 ⇒ 门禁拿到 `got=1 want=0`。
 */
import { isAbsolute, join, normalize } from 'node:path';

/** 相对 `--out=` 落到 `ROOT/SUB` 下面（图的表本来都住在那里）；绝对路径**按原样用**，一个字符都不拼。 */
export function resolveOutPath(rawOut, ROOT, SUB) {
  const s = String(rawOut || '').trim();
  if (!s) throw new Error('--out= 是空的（宁可红，不许悄悄改成默认值）');
  if (isAbsolute(s)) return normalize(s);
  return join(ROOT, SUB, s);
}
