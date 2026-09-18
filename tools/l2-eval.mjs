/* L2′ 评测矩阵（v1.5.116 · 第三方复核者）：把所有臂放在**同一批考卷**上一次跑完
 * 考卷（都是 eval-5p 的现成口径，只是场不同）：
 *   A卷    = 默认 35 组合（标准 3 血）           ⇒ 判据"A 卷不掉"
 *   TN     = `--mode=long --field=targeter`      ⇒ **今夜新发现的真弱点轴**（有判别力：0.8%~51.7%，随机基线 24%）
 *   RW     = `--mode=long --field=ringwall`      ⇒ 老考卷2（**已证明无判别力**，留着只为对照/记账）
 * 另外把 `pickRandom` 每场都跑一遍当**基线** —— 没有基线就不许引用任何一场的好坏结论（§8 的教训）。
 * 产物：docs/artifacts/l2-eval.md（人读表）+ 同名 .log（原始行）
 * 用法：node tools/l2-eval.mjs [GAMES=120] [包...（默认扫 docs/artifacts/v7l2*.bak + 线上包）]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';
const root = process.env.EPIRUS_REPO ? process.env.EPIRUS_REPO.replace(/\/$/, '') : '.';
const ART = join(root, 'docs', 'artifacts');
const GAMES = Number(process.argv[2] && /^\d+$/.test(process.argv[2]) ? process.argv[2] : 120);
const argv = process.argv.slice(2).filter((a, i) => i > 0 || !/^\d+$/.test(a));
let FILES = argv.length ? argv : ['js/bundled-champion-3p.js']
  .concat(readdirSync(ART).filter(f => /^v7l2[a-z]?-\d+\.bak$/.test(f)).sort().map(f => 'docs/artifacts/' + f));
const EXAMS = [
  ['A卷', []],
  ['TN', ['--mode=long', '--field=targeter']],
  ['RW', ['--mode=long', '--field=ringwall']],
];
function run(file, extra) {
  const out = execFileSync(process.execPath, ['tools/eval-5p.mjs', String(GAMES), '5', '88100', file].concat(extra),
    { cwd: root, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' });
  const champ = /^\[冠军\].*?1st=([\d.]+)%.*?top2=([\d.]+)%/m.exec(out);
  const rand = /^\[对照 pickRandom\].*?1st=([\d.]+)%.*?top2=([\d.]+)%/m.exec(out);
  return { first: champ ? Number(champ[1]) : NaN, top2: champ ? Number(champ[2]) : NaN,
    rFirst: rand ? Number(rand[1]) : NaN, raw: out };
}
const LOGF = join(ART, 'l2-eval.log'), MDF = join(ART, 'l2-eval.md');
writeFileSync(LOGF, `# l2-eval（eval-5p ${GAMES} 局 / 席 5 / seed 88100）\n`);
const rows = [];
for (const f of FILES) {
  const label = basename(f).replace('.bak', '');
  const r = { label: label };
  for (const [nm, extra] of EXAMS) {
    if (!existsSync(join(root, f))) { r[nm] = '缺文件'; continue; }
    const x = run(f, extra);
    r[nm] = x.first.toFixed(1) + ' / ' + x.top2.toFixed(0);
    r[nm + '_base'] = x.rFirst.toFixed(1);
    r[nm + '_head'] = x.first - x.rFirst;
    appendFileSync(LOGF, `${label}\t${nm}\t1st=${x.first}%\ttop2=${x.top2}%\t随机基线=${x.rFirst}%\t**高出基线 ${x.first - x.rFirst > 0 ? '+' : ''}${(x.first - x.rFirst).toFixed(1)}pt**\n`);
  }
  rows.push(r);
  console.log(`${label.padEnd(14)}  A卷 ${r['A卷'].padStart(10)}(基线${r['A卷_base']}%)  TN ${r['TN'].padStart(10)}(基线${r['TN_base']}% ⇒ ${r['TN_head'] > 0 ? '+' : ''}${r['TN_head'].toFixed(1)}pt)  RW ${r['RW'].padStart(10)}(基线${r['RW_base']}%)`);
}
let md = `# L2′ 评测矩阵（eval-5p ${GAMES} 局 · seed 88100 · 每场都带 pickRandom 基线）\n\n`;
md += `> TN = \`--mode=long --field=targeter\`（今夜新发现的真弱点轴）；RW = \`ringwall\`（老考卷2，**已证无判别力**，仅记账）。\n`;
md += `> **规矩**：一场的读数只有在"显著高出自己的随机基线"时才可引用（§8 的教训）。\n\n`;
md += `| 包 | A卷 1st/top2 | TN 1st/top2 | TN−随机 | RW 1st/top2 | RW−随机 |\n|---|---|---|---|---|---|\n`;
for (const r of rows) {
  md += `| \`${r.label}\` | ${r['A卷']} | ${r['TN']} | ${r['TN_head'] > 0 ? '+' : ''}${Number(r['TN_head']).toFixed(1)}pt | ${r['RW']} | ${r['RW_head'] > 0 ? '+' : ''}${Number(r['RW_head']).toFixed(1)}pt |\n`;
}
writeFileSync(MDF, md);
console.log('\n写了 ' + MDF + ' 与 ' + LOGF);
