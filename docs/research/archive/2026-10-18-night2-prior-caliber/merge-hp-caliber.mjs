/* §E649 · Hp 换口径的合并器（**显式、可审计**，不靠链子的隐式 --more 派生）
 * 为什么要有这一台：`rebuild-coords.mjs` 的 `HPMORE` 是从 `*-epsfull.tsv` 这类名字**派生**的，
 *   而 `epsfull-tier-2026-10-12.tsv` 不匹配那个模式 ⇒ 直接把 `--hp=` 指到我的新表上，
 *   旧表独有的那批 id（子代/额外批）就会**静默丢 Hp**——这是本仓钉过的"漏带历批尺表 ⇒ 四条自证全绿但少行"那一族。
 *   ⇒ 做法：先把"新口径主表 + 旧表补缺"合成一张，再交给链子当 `--hp=`（链子自己的 HPMORE 照旧补剩下的，行为逐字不变）。
 * 规矩：① 主表赢（同名不覆盖，与 attach-hp 的 `--more` 同一语义）；② 每张表都必须有 `page/exam/d` 三列，缺就 exit 2；
 *   ③ 输出多带一列 `hpSrc`（`prior` = 新测 ‖ `carry` = 沿用旧表）⇒ 每一行的来路写在行里，不靠文件名和人的记性。
 * 用法：node merge-hp-caliber.mjs --main=epsfull-prior2-2026-10-18.tsv --fill=epsfull-tier-2026-10-12.tsv --out=epsfull-hp-final-2026-10-19.tsv [--label=prior]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const HERE = path.dirname(fileURLToPath(import.meta.url));
/* 不认识的 `--` 必须响亮拒绝（D218 那条仓规；归档工具不在门的扫描面上，但"传了等于没传"这个病不分位置） */
const { rejectUnknownFlags } = await import(pathToFileURL(path.resolve(HERE, '../../../..') + '/tools/audit-lib.mjs').href);
rejectUnknownFlags(process.argv.slice(2), ['main', 'fill', 'out', 'label'], 'merge-hp-caliber');
const CM = path.resolve(HERE, '../../../..', 'champion-map');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const MAIN = arg('main', ''), FILL = arg('fill', ''), OUT = arg('out', ''), LABEL = arg('label', 'prior');
if (!MAIN || !FILL || !OUT) { console.error('⛔ 用法：--main=<新口径表> --fill=<旧表> --out=<合并产物> [--label=prior]'); process.exit(2); }
const rd = (f) => {
  const p = path.join(CM, f);
  if (!existsSync(p)) { console.error('⛔ 读不到 ' + p); process.exit(2); }
  const L = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
  const h = Object.fromEntries(L[0].map((x, i) => [x.trim(), i]));
  for (const c of ['id', 'page', 'exam', 'd']) if (h[c] === undefined) { console.error('⛔ ' + f + ' 缺列 `' + c + '`（表头：' + L[0].join('\t') + '）'); process.exit(2); }
  const rows = L.slice(1).filter(r => r.length > 1 && r[h.id]);
  const seen = {}; const uniq = [];
  for (const r of rows) { const id = r[h.id]; if (seen[id] !== undefined) { if (seen[id] !== r[h.page]) { console.error('⛔ ' + f + ' 同一个 id 两行且 page 不同：' + id + ' ⇒ 这张表自己就是混的'); process.exit(3); } continue; } seen[id] = r[h.page]; uniq.push(r); }
  const dup = rows.length - uniq.length;
  if (dup) console.log('   （' + f + '：' + rows.length + ' 行 → ' + uniq.length + ' 个唯一 id，重复 ' + dup + ' 行且 page 逐值相同 ⇒ 去重）');
  return { h, uniq, f };
};
const a = rd(MAIN), b = rd(FILL);
const HDR = a.uniq[0].concat(['hpSrc']).slice(0, 0);   // 表头单独取，避免上面 slice 迷惑
const head = readFileSync(path.join(CM, MAIN), 'utf8').replace(/\r\n/g, '\n').split('\n')[0].replace(/\r$/, '').split('\t').map(x => x.trim());
const out = [head.concat(['hpSrc'])];
const have = new Set();
for (const r of a.uniq) { out.push(r.concat([LABEL])); have.add(r[a.h.id]); }
let filled = 0, droppedIds = [];
for (const r of b.uniq) {
  const id = r[b.h.id];
  if (have.has(id)) continue;
  // 旧表的列数可能与新表不同（新表多了 support/pageBare 两列）⇒ 按**列名**搬，缺的补空串，位置绝不错位
  //   ⚑ 第一版这里写的是 `head.slice(0, -1)`——那是我误以为 `head` 已含 `hpSrc`（其实它是主表原始的 11 列表头）
  //     ⇒ carry 行只有 11 格、标签顶掉了 `pageBare`，行宽与表头不符。数值没脏（attach-hp 按列名读），但形状错了。
  //     现在写成 `head.map(...)` 并在下面**逐行断言行宽**（§E375 那一族"只错一行、无声无息"的机械尺）。
  const row = head.map(c => (b.h[c] === undefined ? '' : (r[b.h[c]] === undefined ? '' : r[b.h[c]])));
  out.push(row.concat(['carry']));
  filled++;
}
for (const id of have) if (!b.uniq.some(r => r[b.h.id] === id)) droppedIds.push(id);
const W = head.length + 1;
const bad = [];
out.forEach((r, i) => { if (r.length !== W) bad.push((i + 1) + ':' + r.length); });
if (bad.length) { console.error('⛔ 行宽不等于表头宽（应为 ' + W + ' 列）：' + bad.slice(0, 8).join(' ‖ ') + ' ⇒ 不写出，先修形状'); process.exit(4); }
writeFileSync(path.join(CM, OUT), out.map(r => r.join('\t')).join('\n') + '\n', 'utf8');
console.log('合并 ' + OUT + '：主表 ' + LABEL + ' ' + have.size + ' 枚 ‖ 从 ' + FILL + ' 补 ' + filled + ' 枚 ‖ 合计 ' + (have.size + filled) + ' 枚');
console.log('   主表里旧表没有的 id ' + droppedIds.length + ' 枚（这些只有新口径值，正常：它们是本轮新测的枚）');
console.log('⚑ 交给链子的用法：node champion-map/rebuild-coords.mjs --hp=' + OUT + (LABEL === 'prior' ? '' : '') + '   ‖ 长程那步用 --hlong=<long 的合并产物>');
