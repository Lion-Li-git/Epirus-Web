/* §E654 G3 的单步执行器：一次进程里只做一次 guardWrite（因为 pack-guard 的 widIndex 有进程内缓存，
 *   同进程连续调用的话后一次看到的是前一次**之前**的索引 ⇒ 那不是幂等测试，那是缓存假象）。
 * 用法：node alias-dedupe-step.mjs <临时根> <dest 相对路径> <取文的文件（绝对或相对主仓）> <why> */
import { guardWrite } from '../../../../champion-map/pack-guard.mjs';
import { readFileSync } from 'node:fs';
const [ROOT, dest, srcFile, why] = process.argv.slice(2);
process.chdir(ROOT);                     // 守卫的"在不在仓内"按 cwd 解析 dest ⇒ 必须站在临时根里跑
const g = guardWrite({ root: ROOT, dest, text: readFileSync(srcFile, 'utf8'), tool: 'alias-dedupe', why });
console.log(JSON.stringify({ dest, wrote: g.wrote, canonical: g.canonical, note: g.note }));
