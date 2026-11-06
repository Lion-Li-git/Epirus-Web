/* §E653 把静态那台列出的可疑处对回**所在门腿**（D 编号 + 近旁的 EPIRUS_ 键）
 *   为什么必须对回腿：C 方案的爆炸半径 = "违例处数"减去"有意为之的那几类"，
 *   而"有意"这件事只有腿自己的标题与 env 能说（D123/D162 是基线、PUBLISH 是发布态、`bad` 是该失败的失败）。
 * 用法：node who-owns-them.mjs [--log=<enumerate-writers 的输出>] */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const LOG = path.join(HERE, 'enumerate-writers.log.txt');
if (!existsSync(LOG)) { console.error('⛔ 先跑 enumerate-writers.mjs'); process.exit(2); }
const rows = readFileSync(LOG, 'utf8').split('\n')
  .filter(l => (l.indexOf('⛔') >= 0 || l.indexOf('走 helper') >= 0) && /\.mjs/.test(l))
  .map(l => l.trim().split(/\s+/)).filter(r => r.length >= 2 && /^\d+$/.test(r[1]));
const seen = new Set();
for (const r of rows) {
  const f = r[0], line = Number(r[1]); const key = f + ':' + line;
  if (seen.has(key)) continue; seen.add(key);
  const src = readFileSync(path.join(ROOT, 'tools', 'gates', f), 'utf8').replace(/\r\n/g, '\n').split('\n');
  let title = '', tline = 0;
  for (let i = line - 1; i >= 0; i--) {
    const m = /^[\s ]*t\(\s*['"`]([^'"`]{0,120})/.exec(src[i]);
    if (m) { title = m[1]; tline = i + 1; break; }
  }
  const win = src.slice(Math.max(0, line - 3), line + 10).join('\n');
  const keys = (win.match(/EPIRUS_[A-Z_]+/g) || []).filter((v, i, a) => a.indexOf(v) === i);
  const tag = win.indexOf('EPIRUS_PUBLISH') >= 0 ? '【发布态】'
    : (/基线|CLI_ARM_BASELINE|train-3p-out\.js/.test(win) ? '【有意写基线?】' : '');
  console.log(key + '  腿@' + tline + '「' + title.slice(0, 66) + '」' + tag
    + '\n    近旁 env 键：' + (keys.join(' ‖ ') || '(一个都没有 ⇒ 那这次调用完全继承外层环境)'));
}
console.log('\n可疑处合计 ' + seen.size + ' 处 ‖ 判读：【发布态】与【有意写基线?】不算违例，剩下的才是 C 方案要显式声明的名单。');
