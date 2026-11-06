/* D82 记账生成器（第三方复核者）：把"24 小时内落盘的 .bak"自动列成 CHANGELOG 能直接粘的一段
 * 为什么需要：门禁 `D82` 只认**字面文件名**（缩写 `v7l2c-81/82/…` 会被判"查无字"，v1.5.115 那条我就栽过一次），
 *   而臂一晚上能落几十个产物 ⇒ 手工列必漏。
 * 用法：node tools/l2-bookkeep.mjs          # 打印可粘贴文本
 * 只打印，不写文件 —— 贴进 CHANGELOG 与措辞由人决定。
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(root, 'docs', 'artifacts');
const HOURS = Number(process.env.BOOK_WINDOW_H || 24);
const NOW = Date.now();
const files = readdirSync(ART).filter(f => f.endsWith('.bak')).map(f => ({ f, t: statSync(join(ART, f)).mtimeMs }))
  .filter(x => (NOW - x.t) / 3600000 <= HOURS);
const byArm = {};
for (const x of files) {
  const m = /^(v7[\w]*?)-(\d+)\.bak$/.exec(x.f);
  const arm = m ? m[1] : '(其他)';
  (byArm[arm] = byArm[arm] || []).push(m ? Number(m[2]) : 0);
}
const arms = Object.keys(byArm).sort();
console.log('// 贴进 CHANGELOG 用：24h 内落盘的产物，逐字列全（D82 只认字面名）');
for (const a of arms) {
  const seeds = byArm[a].slice().sort((x, y) => x - y);
  console.log(`\n· \`${a}\`（${seeds.length} 个）：` + seeds.map(s => '`' + a + '-' + s + '.bak`').join(' · '));
}
const names = files.map(x => x.f).sort();
console.log('\n// 逗号版（贴进 CHANGELOG 的一行里最省事）：');
console.log(names.map(f => '`' + f + '`').join(' · '));
console.log('\n合计 ' + names.length + ' 个产物 / ' + arms.length + ' 个臂');
const missing = [];
if (existsSync(join(root, 'CHANGELOG.md'))) {
  const cl = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  /* ⚠ 必须与门禁 `D82` 的判据**一字不差**：它比的是 `f.replace(/\.bak$/,'')`，
   * 即**去掉扩展名**的字干（`v7l2c-82`），不是整文件名。我第一版按整文件名找 ⇒
   * 报出"77 个查无字"的假警报（其实 ds 的 CHANGELOG 写的就是不带 .bak 的名字）。 */
  for (const f of names) if (cl.indexOf(f.replace(/\.bak$/, '')) < 0) missing.push(f);
}
console.log(missing.length ? '⚠ CHANGELOG 里还查无字 ' + missing.length + ' 个：' + missing.map(f => '`' + f + '`').join(' · ')
  : '✅ CHANGELOG 已把全部 24h 产物逐字点名（D82 应绿）');
