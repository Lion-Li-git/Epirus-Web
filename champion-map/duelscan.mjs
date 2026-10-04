#!/usr/bin/env node
/* §E310 把 §E289 那台配对决斗的读数汇成一张表（图上第 4 条腿）
 *
 * 为什么要：今晚 §E308 ① 栽的那一跤就是"拿考卷分当更强的冠军"。这个仓库里"更强"有专门的仪器
 *   —— `e287-duel.mjs` 的 A−B 配对差（1 枚异类 vs 4 张同一包，两批种子，自检必须恒 0）。
 *   图上原本只有 F/H/S/行为/过线/上槽体检，**恰恰缺这一条** ⇒ 补上。
 *
 * 只收"参照 = 线上那颗 bundle"的行（`b` 里含 bundled-champion 或 SHIPPED），别的参照系不混进来。
 * 输出：champion-map/duel.tsv = id  s77000  s88000  mean  sign  se
 *   sign = same（两批同向）| flip（**符号翻 ⇒ 判不动，不许引均值**）| one（只有一批）
 * 用法：node champion-map/duelscan.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'docs', 'artifacts', 'e287-out');
if (!existsSync(OUT)) { console.error('没有 docs/artifacts/e287-out ⇒ 先跑 §E289 的决斗'); process.exit(1); }
const files = readdirSync(OUT).filter(f => /^e287-duel.*\.tsv$/.test(f));

const SEEDRE = /s(\d{5})/;
const ACC = {};                       // id -> { seed -> {diff, se} }
let rowsRead = 0, skipped = 0;
for (const f of files) {
  const seed = (f.match(SEEDRE) || [, ''])[1];
  const L = readFileSync(join(OUT, f), 'utf8').trim().split('\n');
  const hd = L[0].split('\t');
  const iA = hd.indexOf('a'), iB = hd.indexOf('b'), iD = hd.indexOf('diff_pt'), iS = hd.indexOf('approxSE');
  if (iA < 0 || iD < 0) { skipped++; continue; }
  for (const l of L.slice(1)) {
    const c = l.split('\t');
    /* 只要"打赢线上那颗"的对照：b 必须是 bundle 本身（昨天还有--ref=incumbent-forpromote 的两批，口径不同 ⇒ 不收）*/
    if (!/bundled-champion-3p/.test(c[iB] || '')) continue;
    const id = (c[iA] || '').replace(/^.*\//, '').replace(/\.bak$|\.js$/, '');
    if (!id || id === 'SHIPPED-Ldemo' || /bundled-champion/.test(id)) continue;
    rowsRead++;
    (ACC[id] = ACC[id] || {})[seed || f] = { diff: +c[iD], se: +c[iS] };
  }
}

const ids = Object.keys(ACC).sort((a, b) => {
  const m = x => { const v = Object.values(ACC[x]); return v.reduce((s, r) => s + r.diff, 0) / v.length; };
  return m(b) - m(a);
});
const out = ['id\ts77000\ts88000\tmean\tsign\tse'];
for (const id of ids) {
  const g = ACC[id];
  const a = g['77000'], b = g['88000'];
  const vs = [a, b].filter(Boolean);
  const mean = vs.reduce((s, r) => s + r.diff, 0) / vs.length;
  const se = +Math.sqrt(vs.reduce((s, r) => s + r.se * r.se, 0) / (vs.length * vs.length)).toFixed(2);
  let sign = 'one';
  if (a && b) sign = (a.diff > 0) === (b.diff > 0) ? 'same' : 'flip';
  out.push([id, a ? a.diff : '', b ? b.diff : '', mean.toFixed(2), sign, se].join('\t'));
}
writeFileSync(join(HERE, 'duel.tsv'), out.join('\n') + '\n');
console.log('读了 ' + files.length + ' 张决斗表，收 ' + rowsRead + ' 行、' + ids.length + ' 枚唯一候选（参照一律 = 线上 bundle）');
const same = out.slice(1).filter(l => l.split('\t')[4] === 'same');
const win = same.filter(l => +l.split('\t')[3] > 0);
console.log('两批种子同向：' + same.length + ' 枚（其中为正 = 打赢现役 ' + win.length + ' 枚 ‖ 为负 ' + (same.length - win.length) + ' 枚）');
for (const l of out.slice(1)) {
  const c = l.split('\t');
  if (c[4] === 'same') console.log('  ' + (c[3] > 0 ? '✅ 赢 ' : '⛔ 输 ') + c[0].padEnd(18) +
    ' A−B = ' + c[1] + ' ‖ ' + c[2] + ' pt（均值 ' + c[3] + ' ±' + c[5] + '）');
}
console.log('已写 champion-map/duel.tsv');
