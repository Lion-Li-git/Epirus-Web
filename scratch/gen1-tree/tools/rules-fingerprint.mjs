/* Epirus 规则指纹（v1.5.7）
 *
 * 用途：把"这份产物是在哪套规则下测出来的"变成一个**可机械校验**的字段。
 *
 * 为什么需要（千问体检 §5-2 建议 / HANDOFF §4-9 规矩）：v1.5.4 只改了 `rules.js` 里一个
 * `target` 字段，5P 线上冠军的考卷成绩就从 **38.0% 掉到 15.0%**，而当时的 CHANGELOG 还写着
 * "对现有冠军无实战影响" —— 因为**没有任何东西**能自动发现"产物与引擎错配"。
 * 同类事故此前已发生过一次（v1.3.24 的包版本）。
 *
 * 指纹 = 四个规则相关文件的 sha1 前 8 位（行尾归一化，避免 CRLF/LF 抖动误报）。
 * 规则源码一变 ⇒ 指纹变 ⇒ 记着旧指纹的成绩全部**自动变成"已过期"**：
 *   · `np-test D16` 会立刻红（逼你重测并重记）；
 *   · 工具/页面可用它显示"这份成绩是旧规则的"。
 *
 * ⚠️ 它**故意敏感**：连注释改动都会让指纹变。宁可多提醒一次，也不要再让"成绩静默过期"发生 ——
 * 重记指纹的成本是一条命令 + 一次考卷（约 1.5 分钟），而漏掉一次就是交付质量静默下降。
 *
 * 用法：
 *   node tools/rules-fingerprint.mjs            # 打印当前指纹
 *   node tools/rules-fingerprint.mjs --json     # 机器可读
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/* v1.5.15：把 `js/train/policy.js` 也纳入 —— 它是**特征定义**，改一行就会静默改变冠军的实际行为
 * （这次修"蓄能的珠类型泄漏"就是如此：特征长度没变、包还能加载，但冠军的输入变了）。
 * 只覆盖规则四件套的话，这种改动**不会**触发 D16 的"成绩已过期"警报。 */
export const FINGERPRINT_FILES = ['js/core/rules.js', 'js/core/resolve.js', 'js/core/state.js', 'js/core/play.js', 'js/train/policy.js'];

export function rulesFingerprint(rootDir) {
  const h = createHash('sha1');
  for (const f of FINGERPRINT_FILES) {
    h.update(readFileSync(join(rootDir || ROOT, f), 'utf8').replace(/\r\n/g, '\n'));
    h.update('\n');
  }
  return h.digest('hex').slice(0, 8);
}

/* 从 bundle/bak 文本里取它记的指纹（没有则 null） */
export function fingerprintOfBundle(text) {
  const m = /"rulesFingerprint"\s*:\s*"([0-9a-f]+)"/.exec(String(text || ''));
  return m ? m[1] : null;
}

if (process.argv[1] && /rules-fingerprint\.mjs$/.test(process.argv[1])) {
  const fp = rulesFingerprint();
  if (process.argv.includes('--json')) console.log(JSON.stringify({ fingerprint: fp, files: FINGERPRINT_FILES }));
  else console.log('规则指纹 = ' + fp + '   (sha1 前 8 位；覆盖 ' + FINGERPRINT_FILES.join(' ') + ')');
}
