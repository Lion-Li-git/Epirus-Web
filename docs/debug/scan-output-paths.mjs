/* scan-output-paths.mjs —— 扫"哪个工具往哪个落点写"，找 epsread 那一族**落点撞车**（一次性审计件，不进判据）
 *
 * 动因（10-13 夜班真撞上的）：`epsread.mjs`（§E313 那把旧尺：30 局 · ε=0.2 · 5 列）与 `eps2seed.mjs`
 *   （120 局 · 剂量 `tier:lv:regular` · 8 列）**写的是同一个 `champion-map/epsagg.tsv`** ⇒ 谁为了看旧判据跑一遍旧尺，
 *   查看器在用的活跃表就连列带数被旧口径覆掉，而且一声不响。靠"跑完看 `git status`"才抓到。
 *   所以把这类"多写者落点"静态扫一遍：一台仪器的产物不许 squat 另一台的活跃路径。
 *
 * 两个已知盲区（说清比假装全覆盖强）：
 *   ① 落点是**变量/拼接**时只能顺着同文件里的 `const X = '…'` 猜一层，猜不到就归进"要人看"那一栏；
 *   ② 扫的是字面路径 ⇒ `join(HERE, 'a.tsv')` 认得，`join(HERE, arg('out', d))` 只认得缺省那份。
 *
 * 用法：node docs/debug/scan-output-paths.mjs [子目录...]（默认 tools champion-map docs/debug js/train）
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIRS = process.argv.slice(2).filter(a => !a.startsWith('-'));
const WALK = (DIRS.length ? DIRS : ['tools', 'champion-map', 'docs/debug', 'js/train']);
const files = [];
for (const d of WALK) {
  const abs = join(ROOT, d);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs)) {
    if (!/\.mjs$/.test(f)) continue;
    if (statSync(join(abs, f)).isDirectory()) continue;
    files.push(d + '/' + f);
  }
}
const TRACKED = new Set(String(execFileSync('git', ['ls-files'], { cwd: ROOT })).split('\n'));
const writers = {};        // 落点 => { 工具: 'literal|derived' }
const unresolved = [];     // 落点来自变量、猜不出的一栏
for (const rel of files) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  const re = /(?:writeFileSync|appendFileSync|createWriteStream)\(\s*([^,]+),/g;
  let m;
  while ((m = re.exec(src))) {
    const arg = m[1].trim();
    let target = null, kind = 'literal';
    const lit = /['"]([^'"]+\.(?:tsv|json|html|md|js|bak|txt|csv))['"]/.exec(arg);
    if (lit) target = lit[1];
    else {
      /* 变量名 ⇒ 在同文件里找一次 `const/let VAR = …'xxx.tsv'…` */
      const vn = /^([A-Za-z_$][\w$]*)$/.exec(arg);
      if (vn) {
        const a = new RegExp('(const|let|var)\\s+' + vn[1] + '\\s*=\\s*[^;]*?[\'"]([^\'"]+\\.(?:tsv|json|html|md|js|bak|txt|csv))[\'"]', 'm').exec(src);
        if (a) { target = a[2]; kind = 'derived-from-' + vn[1]; }
      }
      if (!target) { const vs = /join\([^,]+,\s*([A-Za-z_$][\w$]*)\s*\)/.exec(arg);
        unresolved.push(rel + ' → ' + arg.slice(0, 70) + (vs ? '（变量 ' + vs[1] + '）' : '')); continue; }
    }
    target = target.replace(/^\.\//, '');
    if (!/[\\/]/.test(target)) target = 'champion-map/' + target;   /* 只给了文件名 ⇒ 多半落在脚本自己那个目录 */
    (writers[target] = writers[target] || {})[rel] = kind;
  }
}
const multi = Object.entries(writers).filter(([, w]) => Object.keys(w).length > 1);
console.log('扫了 ' + files.length + ' 个 .mjs ‖ 解析出落点 ' + Object.keys(writers).length + ' 个 ‖ 变量落点（要人看）' + unresolved.length + ' 处');
console.log('\n== 多个工具写同一个落点（epsread 那一族）：' + multi.length + ' 个 ==');
for (const [t, w] of multi) {
  const who = Object.entries(w).map(([f, k]) => f + (k === 'literal' ? '' : '[' + k + ']')).join(' ‖ ');
  console.log((TRACKED.has(t) ? '📌 入库件 ' : '（未入库）') + t + '\n    ⇐ ' + who);
}
console.log('\n== 变量/拼接出来的落点（本扫的盲区，逐条人看）==');
for (const u of unresolved) console.log('  ' + u);
console.log('\n判法：📌 入库件被两台以上写 = 必须查（一台是活跃表的话就是 epsagg 那种事故）；'
  + '未入库件（临时/产物）撞了通常无所谓，但如果其中一台是**默认落点**，那"谁覆了谁"就取决于跑的顺序 —— 也该点名。');
