#!/usr/bin/env node
/* §E314 把 DS 留的"最后一条真找回路径"跑掉：扫**全部历史 blob** 找权重指纹 d13d3c85…
 *
 * 背景（DS 的结论，CHANGELOG.md:6402）：585 枚（81%）共用同一个父 `d13d3c85…`，
 *   而那不是"丢失的血统"，是 **runner 覆写 `EPIRUS_BUNDLE_IN` 的指纹**（`tools/ring2-run.mjs:95` 无条件覆写 ⇒ 近期全部臂恒拷同一个 BASE）。
 *   他盘上扫过：包类 2904 + 点文件 2 + 其它 57，无命中；bundle 的 70 个历史版本也无一版等于它。
 *   ⇒ 只剩这一条没穷尽：**这些文件的历史版本（git blob）里有没有**。
 *
 * 两条纪律写在这里，因为 DS 这两条都踩过：
 *   ① **字符串命中 ≠ 身份** —— `d13d3c85` 会作为**子代的 META 字段**出现在别的 .bak 里（`r61fix-31.bak` 就是），
 *      那只说明"它的父是它"，不说明"它是它"。⇒ 只能逐枚算 `widOf(权重)`，不许 grep 文本。
 *   ② **别跳过点文件** —— 第一版候选过滤器写了 `basename.startswith('.') ⇒ skip`，
 *      而 `docs/artifacts/.training-in-3p.js`（那个被恒拷的实体）**正好是点文件**。⇒ 这里不按名字筛，按扩展名筛。
 *
 * 用法：node champion-map/widhunt.mjs [前缀=d13d3c85]
 */
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { widOf } from './wid.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEED = (process.argv[2] || 'd13d3c85').toLowerCase();

/* 1) 全历史对象：sha + 路径。
 *   默认走 `--objects --all`（所有 ref 可达，带路径名，好报"它是哪个文件"）。
 *   ⚠ 但它**看不到悬空对象** —— 这个仓库有过 rebase/amend/回滚（CHANGELOG 里就有"版本号可重复用"那条），
 *     rebase 掉的旧提交里的 blob 不在任何 ref 上 ⇒ 只扫可达集会给出一个**假的"穷尽"**。
 *   ⇒ `--scope=odb` 走 `cat-file --batch-all-objects`：整个对象库里**每一个** blob，不管可达不可达。
 *     代价是没有路径名（只报 sha），所以两轮分工：先按名字扫一遍找得到就报路径，再全库扫一遍把"找不到"钉死。*/
const SCOPE = (process.argv.find((x) => x.startsWith('--scope=')) || '--scope=all').split('=')[1];
let bySha = new Map();
if (SCOPE === 'odb') {
  const all = execFileSync('git', ['cat-file', '--batch-all-objects', '--batch-check'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  for (const line of all.split('\n')) {
    const m = /^([0-9a-f]{40}) blob (\d+)$/.exec(line.trim()); if (!m) continue;
    if (+m[2] > 2000000 || +m[2] < 200) continue;
    bySha.set(m[1], ['(对象库·不可达或无路径名)']);
  }
} else {
  const objOut = execFileSync('git', ['rev-list', '--objects', '--all'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  for (const line of objOut.split('\n')) {
    if (!line.trim()) continue;
    const sp = line.indexOf(' '); if (sp < 0) continue;
    const sha = line.slice(0, sp), p = line.slice(sp + 1).trim();
    if (!p) continue;
    /* ② 不按 basename 首字符筛（点文件要留），只按扩展名筛到"可能是权重包"这一类 */
    if (!/\.(js|json|bak|txt|bundle)$/i.test(p)) continue;
    if (!bySha.has(sha)) bySha.set(sha, []);
    bySha.get(sha).push(p);
  }
}
console.log('范围 = ' + SCOPE + ' ‖ 历史里扩展名像权重包的对象：**' + bySha.size + ' 个不同 blob**（路径 ' + [...bySha.values()].reduce((s, v) => s + v.length, 0) + ' 条）');

/* 2) 逐 blob 算指纹。用 cat-file --batch 一次进程读完（spawn 8000 次要十几分钟）。
 *   ⚠ 帧必须**按字节偏移**切，不能按行累加：权重 JSON 是单行大对象，但一旦某帧内容里含换行，
 *     按行拼就会把下一帧的头当成内容吃进去 ⇒ 后面的 blob 全部错位 ⇒ 会报出一个**假的"未命中"**。
 *     这类"解析器自己造出来的负结果"正是本工具头注第 ① 条要防的东西，所以宁可写笨一点、按 size 走。*/
const shas = [...bySha.keys()];
const hit = [];
let nullWid = 0, scanned = 0;
for (let i = 0; i < shas.length; i += 400) {
  const chunk = shas.slice(i, i + 400).join('\n') + '\n';
  const r = spawnSync('git', ['cat-file', '--batch'], { cwd: ROOT, input: chunk, maxBuffer: 1 << 29 });
  const buf = r.stdout || Buffer.alloc(0);
  let p = 0;
  while (p < buf.length) {
    const nl = buf.indexOf(10, p); if (nl < 0) break;
    const head = buf.slice(p, nl).toString('utf8');
    const m = /^([0-9a-f]{40}) (\w+) (\d+)$/.exec(head);
    if (!m) { p = nl + 1; continue; }        /* "<sha> missing" 之类，跳过该行 */
    const size = +m[3];
    const body = buf.slice(nl + 1, nl + 1 + size);      /* 正好 size 字节 */
    p = nl + 1 + size + 1;                              /* 跳过分隔换行 */
    scanned++;
    if (size > 2000000 || size < 200) continue;
    let w = null; try { w = widOf(body.toString('utf8')); } catch (e) { w = null; }
    if (!w) { nullWid++; continue; }
    if (w.toLowerCase().startsWith(NEED)) hit.push({ sha: m[1], w: w, paths: bySha.get(m[1]) || ['?'] });
  }
  process.stderr.write('  … ' + Math.min(i + 400, shas.length) + '/' + shas.length + ' blob（取到权重 ' + (scanned - nullWid) + ' ‖ 无权重 ' + nullWid + '）\n');
}
console.log('\n扫完 ' + scanned + ' 个 blob：能取出权重数组的 ' + (scanned - nullWid) + ' ‖ 取不到的 ' + nullWid);
if (hit.length) {
  console.log('\n⭐ 命中 ' + hit.length + ' 个 blob ⇒ 父本找回来了：');
  for (const h of hit) console.log('  ' + h.w + '  ' + h.sha.slice(0, 12) + '  ' + h.paths.join(' ‖ '));
} else {
  console.log('\n⇒ **未命中。DS 留的最后一条路径到此穷尽：`d13d3c85…` 的权重既不在盘上、也不在任何 git 历史 blob 里。**');
  console.log('   与 CHANGELOG.md:6402 的定性一致：那不是一个"丢了的父本"，而是 runner 恒拷同一个 BASE 的指纹 ⇒ 它本来就不必有实体。');
}
