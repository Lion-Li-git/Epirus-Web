/* pool-profile.mjs —— 一次性对照：v7 冠军池 30 枚成员 vs 代 3 候选的**技能使用剖面**（千问 · 11-01）
 * 尺：`tools/eval-5p.mjs 12 5 77000 <pack>`（产品考卷 5P 420 局，同一档、同一 seed ⇒ 池与候选可并排）。
 * 为什么不用内部键名 grep：分布行印的是**卡面显示名**（真正的落雷 / 雷击之枪 / 狙击枪 / 八卦阵…），
 *   按内部键名筛会系统性漏读整列（11-01 第一版就这么错过 大雷 一整列）。⇒ 名字表从引擎现取。
 * 输出：scratch/poolprofile-1101.tsv（每包一行）‖ 终端打印池级汇总与两侧对照。
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { sandbox } from '../tools/audit-lib.mjs';

const W = sandbox();
const nameOf = {};
for (const s of W.EpirusRules.skills) nameOf[s.key] = s.name;
const KEYS = ['ji', 'charge', 'ring', 'railgun', 'bigT', 'miniT', 'laserEye', 'cannon', 'gun', 'snipe', 'sword',
  'transfer', 'guard', 'reflect', 'bagua', 'shift', 'jinshield', 'armor', 'proto', 'holo', 'drain', 'rod',
  'curse', 'firestorm', 'mine', 'taunt', 'purify', 'dualGun', 'mirror'];
const LONG = ['ring', 'bigT', 'railgun', 'laserEye', 'miniT', 'cannon'];
const SHORT = ['gun', 'snipe', 'sword', 'dualGun'];

function run(path) {
  let out;
  try { out = execFileSync('node', ['tools/eval-5p.mjs', '12', '5', '77000', path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { return null; }
  const grab = (re) => { const m = re.exec(out); return m ? m[1] : null; };
  const first = grab(/\[冠军\] 1st=([\d.]+)%/);
  const kinds = grab(/出手种类=(\d+)/);
  const maxEp = grab(/到达过的最高 ep=(\d+)/);
  const ep3 = grab(/ep>=3 的决策占比=([\d.]+)%/);
  const cost3 = grab(/cost>=3 出手占比=([\d.]+)%/);
  const rounds = grab(/平均回合=([\d.]+)/);
  const hp = grab(/终局血量=([\d.]+)/);
  const share = {};
  const block = /分布（前 12）:([\s\S]*?)耗时/.exec(out);
  if (block) for (const raw of block[1].split('\n')) {
    const m = /^ {2}(\S+)\s+([\d.]+)%\s+次数=(\d+)/.exec(raw);
    if (!m) continue;
    for (const k of KEYS) if (nameOf[k] === m[1]) { share[k] = Number(m[2]); break; }
  }
  return { first: Number(first), kinds: Number(kinds), maxEp, ep3, cost3, rounds: Number(rounds), hp: Number(hp), share };
}

const rows = [];
const add = (id, tier, path) => { const r = run(path); if (r) rows.push(Object.assign({ id, tier, path }, r)); else console.error('⚠ 读不出 ' + id); };

for (const line of readFileSync('champion-map/pool-members.tsv', 'utf8').split('\n').slice(1)) {
  const c = line.split('\t');
  if (c.length < 3 || !c[0]) continue;
  add(c[0], c[3], c[2]);
}
const G3 = ['GD3-RATION', 'CAP-ration-s7', 'CAP-ration-s13', 'RICH-b41-s13', 'BROAD-tkCH-s41', 'BROAD-tkCH-s7',
  'GD3-RING', 'GD3-LASER2', 'gd3b-ks-sb', 'RB2P-s13', 'GD3-BIGT3'];
for (const g of G3) add(g, 'g3', 'scratch/arms/' + g + '.bak');
add('v7（线上冠军）', 'g3', 'js/bundled-champion-3p.js');

const maxShare = (r) => Math.max(...Object.values(r.share).filter((x) => x != null), 0);
const has = (r, k) => (r.share[k] || 0) > 0;
const pct = (x) => (x == null ? '—' : x.toFixed(1) + '%');

const tsv = ['id\ttier\t1st\t种类\t最大单键\t环\t大雷\t炮\t激光眼\t小雷\t过载炮\t枪系合计\t短程合计\t最高ep\tep>=3\tcost>=3\t回合\t终局血'];
for (const r of rows) {
  const shortSum = SHORT.reduce((a, k) => a + (r.share[k] || 0), 0);
  tsv.push([r.id, r.tier, pct(r.first), r.kinds, maxShare(r).toFixed(1) + '%',
    pct(r.share.ring), pct(r.share.bigT), pct(r.share.railgun), pct(r.share.laserEye), pct(r.share.miniT), pct(r.share.cannon),
    pct(r.share.gun || 0), pct(shortSum), r.maxEp, pct(r.ep3 == null ? null : Number(r.ep3)), pct(r.cost3 == null ? null : Number(r.cost3)),
    r.rounds, r.hp].join('\t'));
}
writeFileSync('scratch/poolprofile-1101.tsv', tsv.join('\n') + '\n');

const pool = rows.filter((r) => r.tier !== 'g3'), g3 = rows.filter((r) => r.tier === 'g3');
const cov = (list, k) => list.filter((r) => has(r, k)).length;
console.log('=== 谁在用哪条线（同一把尺：产品考卷 5P 420 局 · seed 77000）===');
console.log('长程线'.padEnd(12) + 'v7 池 ' + String(pool.length) + ' 枚中' .padEnd(12) + '代 3 ' + g3.length + ' 枚中');
for (const k of LONG) console.log(('  ' + nameOf[k] + '（' + k + '）').padEnd(24) + String(cov(pool, k)).padEnd(20) + String(cov(g3, k)));
const ms = pool.map(maxShare).sort((a, b) => a - b);
const mg = g3.map(maxShare).sort((a, b) => a - b);
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
console.log('\n=== 集中度（最大单键出手占比）===');
console.log('v7 池  P10 ' + q(ms, 0.1).toFixed(1) + '% ‖ 中位 ' + q(ms, 0.5).toFixed(1) + '% ‖ P90 ' + q(ms, 0.9).toFixed(1) + '% ‖ 过 45% 上限者 ' + ms.filter((x) => x > 45).length + '/' + ms.length + ' ‖ 过 55% ' + ms.filter((x) => x > 55).length);
console.log('代 3    P10 ' + q(mg, 0.1).toFixed(1) + '% ‖ 中位 ' + q(mg, 0.5).toFixed(1) + '% ‖ P90 ' + q(mg, 0.9).toFixed(1) + '% ‖ 过 45% 上限者 ' + mg.filter((x) => x > 45).length + '/' + mg.length + ' ‖ 过 55% ' + mg.filter((x) => x > 55).length);
const kn = pool.map((r) => r.kinds).sort((a, b) => a - b), kg = g3.map((r) => r.kinds).sort((a, b) => a - b);
console.log('\n=== 出手种类 ===');
console.log('v7 池  中位 ' + q(kn, 0.5) + ' ‖ 范围 ' + kn[0] + '~' + kn[kn.length - 1]);
console.log('代 3    中位 ' + q(kg, 0.5) + ' ‖ 范围 ' + kg[0] + '~' + kg[kg.length - 1]);
const ln = pool.map((r) => LONG.filter((k) => has(r, k)).length).sort((a, b) => a - b);
const lg = g3.map((r) => LONG.filter((k) => has(r, k)).length).sort((a, b) => a - b);
console.log('\n=== 每包自己踩到几条长程线（0~6）===');
console.log('v7 池  分布 ' + ln.join(',') + ' ‖ 平均 ' + (ln.reduce((a, b) => a + b, 0) / ln.length).toFixed(2));
console.log('代 3    分布 ' + lg.join(',') + ' ‖ 平均 ' + (lg.reduce((a, b) => a + b, 0) / lg.length).toFixed(2));
console.log('\n=== 池级并集 vs 单包（这是给"下限压包还是压池"的那一格）===');
console.log('v7 池 30 枚的并集覆盖长程线 ' + LONG.filter((k) => cov(pool, k) > 0).length + '/6 ‖ 代 3 ' + g3.length + ' 枚候选的并集 ' + LONG.filter((k) => cov(g3, k) > 0).length + '/6');
for (const tier of ['hard', 'soft']) {
  const sub = pool.filter((r) => r.tier === tier);
  console.log('  ' + tier + '（' + sub.length + ' 枚）：环 ' + cov(sub, 'ring') + ' ‖ 大雷 ' + cov(sub, 'bigT') + ' ‖ 炮 ' + cov(sub, 'railgun') +
    ' ‖ 激光眼 ' + cov(sub, 'laserEye') + ' ‖ 小雷 ' + cov(sub, 'miniT') + ' ‖ 过载炮 ' + cov(sub, 'cannon') +
    ' ‖ 中位最大单键 ' + q(sub.map(maxShare).sort((a, b) => a - b), 0.5).toFixed(1) + '% ‖ 中位 1st ' + q(sub.map((r) => r.first).sort((a, b) => a - b), 0.5).toFixed(1) + '%');
}
console.log('\n[TSV] scratch/poolprofile-1101.tsv ‖ 行数 ' + rows.length);
