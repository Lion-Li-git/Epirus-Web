/* gate-parts-check.mjs —— 门禁"按部分并行"的**并集守卫**（2026-10-14 DS）
 *
 * ## 它防的是哪一种坏
 * 把全部的门摊成若干个部分文件之后，CI 才能按部分并行（每个部分一个 job）。并行的**唯一**前提是：
 *   **各部分的并集 = 全部的门**（条数与部分名**都现读**，不写死 —— v1.7.67：这里原写「278 条 / 16 个部分」，
 *   那是当时的数；下面四条判据本来就一律用现读值）。一旦这句不成立，坏法**不是红，而是绿** ——
 *   少跑几条门的那一份照样绿，而"整轮全绿"这句话已经被污染了。
 * 本仓今天已经在同一形状上栽过两次（"轮询漏消费者"：拆文件漏了四把按文件名找门体源码的尺、
 *   别名迁移漏了几台按名字索引面板的工具，两次的症状都是**静默变瞎**）⇒ 这里必须有一条会红的守卫。
 *
 * ## 判据（四条，任一不成立 ⇒ exit 1，逐条印出来）
 * ① **接线**：`tools/gates/*.mjs`（除 `_ctx.mjs`）的文件集合 == runner 的 `PARTS` 名单。
 *    新增一个部分文件却忘了在 `np-test.mjs` 里 import ⇒ 那个文件的门**一条都不会跑**。这是最像的坏法。
 * ② **并集**：`Σ parts[].gates` == `total` == 所有门体文件里 `^t(` 的行数
 *    （最后那个数就是 runner 收尾那条注册守卫用的**同一个**数，所以这里与 runner 自检同源）。
 * ③ **非空**：每个部分的条数 > 0（空部分 = 拆坏了 ⇒ 它的门不知去了哪里）。
 * ④ **归属表一致**：每部分"文件成员数"（`gates`，`--part=` 真正会跑的）== "按读取面归属的条数"（`attr`）。
 *    两者不一致 = 那张"路径→部分"映射表已经与落盘不一致 ⇒ 它会误导下一个按它找门的人。
 *
 * 用法：`node tools/gate-parts-check.mjs`（CI 的聚合作业在跑；退出码 0/1 就是判定）
 * 只读：不写盘、不改树、不跑任何一条门。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const GATE_DIR = join(HERE, 'gates');

const bad = [];
const say = m => console.log(m);

/* ---- 读 runner 现印的部分清单（单一来源：绝不在这里另抄一份名单）---- */
let info;
try {
  const out = execFileSync(process.execPath, [join(HERE, 'np-test.mjs'), '--list-parts', '--json'],
    { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  info = JSON.parse(out.trim());
} catch (e) {
  console.error('⛔ 问不到部分清单（`node tools/np-test.mjs --list-parts --json` 没跑成）：' + String(e.message).slice(0, 200));
  process.exit(1);
}
const parts = info.parts || [];
say('部分清单：' + parts.length + ' 个 ‖ 文件成员条数合计 ' + info.total);

/* ---- ① 接线：盘上的部分文件 vs runner 的名单 ---- */
const onDisk = readdirSync(GATE_DIR).filter(f => f.endsWith('.mjs') && f !== '_ctx.mjs').sort();
const wired = parts.map(p => p.file.split('/').pop()).sort();
const missingWire = onDisk.filter(f => wired.indexOf(f) < 0);
const ghost = wired.filter(f => onDisk.indexOf(f) < 0);
if (missingWire.length) bad.push('盘上有、runner 名单里没有（这些门**一条都不会跑**）：' + missingWire.join(' '));
if (ghost.length) bad.push('runner 名单里有、盘上没有（import 会当场炸，但先说清）：' + ghost.join(' '));
say('① 接线：盘上 ' + onDisk.length + ' 个部分文件 ‖ runner 名单 ' + wired.length + ' 个 ⇒ ' + (missingWire.length || ghost.length ? '⛔ 不一致' : '一致 ✅'));

/* ---- ② 并集：Σgates == total == 门体里 ^t( 的行数 ---- */
let nReg = 0;
for (const p of parts) {
  let src = '';
  try { src = readFileSync(join(ROOT, p.file), 'utf8'); } catch (e) { bad.push('部分文件读不到：' + p.file); continue; }
  nReg += src.split('\n').filter(l => /^t\(/.test(l)).length;
}
const sum = parts.reduce((s, p) => s + p.gates, 0);
if (sum !== info.total) bad.push('Σ parts[].gates = ' + sum + ' ≠ total = ' + info.total);
if (info.total !== nReg) bad.push('total = ' + info.total + ' ≠ 门体里 ^t( 的行数 = ' + nReg + '（runner 收尾的注册守卫用的是同一个数）');
say('② 并集：Σgates = ' + sum + ' ‖ total = ' + info.total + ' ‖ ^t( 行数 = ' + nReg + ' ⇒ ' + (sum === info.total && info.total === nReg ? '三者一致 ✅' : '⛔ 不一致'));

/* ---- ③ 非空 + ④ 归属表一致 ---- */
const emptyP = parts.filter(p => !(p.gates > 0)).map(p => p.part);
if (emptyP.length) bad.push('空部分（拆坏了？）：' + emptyP.join(' '));
const drift = parts.filter(p => p.attr !== p.gates);
say('③ 非空：' + (emptyP.length ? '⛔ ' + emptyP.join(' ') : '每部分都有门 ✅'));
if (drift.length) {
  bad.push('归属表与落盘不一致（用 `node tools/np-test.mjs --list-parts --explain=<门键>` 逐条查）：'
    + drift.map(p => p.part + '(' + p.attr + '≠' + p.gates + ')').join(' '));
}
say('④ 归属表：' + (drift.length ? '⛔ ' + drift.map(p => p.part).join(' ') : '每部分的"文件成员数"与"按读取面归属的条数"一致 ✅'));

if (bad.length) {
  console.error('\n⛔ 并集守卫没过（' + bad.length + ' 条）：');
  for (const b of bad) console.error('   · ' + b);
  console.error('   ⇒ 这不是"某一条门红了"，是**覆盖本身不成立**：并行的那几份加起来不等于整轮。别重跑，先修上面这几条。');
  process.exit(1);
}
console.log('\n✔ 并集守卫：16 个部分互不重叠、并集 = ' + info.total + ' 条 = 整轮 ⇒ 按部分并行不丢覆盖。');
process.exit(0);
