#!/usr/bin/env node
/* exam-fb.mjs —— 第 5 个考卷格：**对「只攒钱」桌面的清场能力**（11-08 立 · 用户令）
 *
 * 为什么要有它（实测，不是推测）：
 *   2.0 线的高分是**反射墙**打出来的 —— CTRL2-Q-s7 对 4 个农民：reflect 91%、伤害 0.30/局；
 *   PASS2C-Q-s13：reflect 75%、伤害 **0.00/局**、47 回合五个人一起被终局收缩磨到 0。考卷池 28 个脚本
 *   全是会打人的 ⇒ 墙把伤害弹回去就赢；而 12 线门的场B（对面只攒钱不动时能不能收人）它们是 0.00。
 *   ⇒ 「强」和「会打」在这条线上被两种桌面分开了，考卷侧必须补一格被动桌，否则龟壳会一直拿高分。
 *
 * 判据与门**同源**：直接调 audit-lib 的 aggressionProfile（feasibilityOf 的场A/场B 就是它的输出），
 *   不再另写一份"怎么数清场"。规矩：两处各写一遍 = 训出和量出来不是一套规则（本仓栽过六次）。
 *
 * 用法：node tools/exam-fb.mjs --packs=a.js,b.bak [--games=100] [--out=x.tsv]
 *   （--games 缺省 100 = 门那一档的样本量；别拿 20 局的数当结论，G/清场在小样本下系统性偏低）
 * 退出码：0 = 跑完 ‖ 2 = 读不出包/参数
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox, loadChamp, aggressionProfile } from './audit-lib.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACKS = String(arg('packs', '')).split(',').map(s => s.trim()).filter(Boolean);
const GAMES = Number(arg('games', 100));
const OUT = arg('out', '');
if (!PACKS.length) { console.error('用法：node tools/exam-fb.mjs --packs=a.js,b.bak [--games=100] [--out=x.tsv]'); process.exit(2); }

const W = sandbox();
const rows = [];
for (const f of PACKS) {
  const params = loadChamp(W, f);
  if (!params) { console.error('⛔ 读不出包：' + f); process.exit(2); }
  const r = aggressionProfile(W, params, GAMES);
  const id = f.replace(/^.*\//, '').replace(/\.(bak|js)$/, '');
  rows.push({ id, path: f, fieldA: r.fieldA ? r.fieldA.atk : null, fieldB: r.fieldB ? r.fieldB.clearedPerGame : null,
    dealt: r.fieldA ? r.fieldA.dealtPerGame : null, winB: r.fieldB ? r.fieldB.winRate : null });
  const x = rows[rows.length - 1];
  console.log(id.padEnd(18) + ' 场A 还手 ' + (x.fieldA * 100).toFixed(1) + '%  场B 清场 ' + (x.fieldB === null ? '-' : x.fieldB.toFixed(2)) + '/局  被围殴时伤害/局 ' + (x.dealt === null ? '-' : x.dealt.toFixed(2)) + '  对农民桌胜率 ' + (x.winB === null ? '-' : (x.winB * 100).toFixed(0) + '%'));
}
if (OUT) {
  const head = ['id', 'path', 'fieldA', 'fieldB', 'dealtPerGame', 'winB'];
  writeFileSync(OUT, head.join('\t') + '\n' + rows.map(r => head.map(k => r[k] === null ? '' : r[k]).join('\t')).join('\n') + '\n');
  console.log('写 ' + OUT);
}