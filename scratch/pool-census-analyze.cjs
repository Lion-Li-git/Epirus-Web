/* pool-census-analyze.cjs — 把 pool-defense-census 的两张表读进来，回答一条：旧池里有没有"又多又准"的成员 */
const fs = require('fs');
const t = fs.readFileSync(process.argv[2] || 'scratch/pool-defense-census-120.log', 'utf8').split('\n');
const GAMES = Number(process.argv[3] || 120);
const tbl = []; let sec = '';
for (const l of t) {
  if (l.includes('考卷桌')) sec = 'exam'; else if (l.includes('训练桌')) sec = 'arms';
  if (!l.startsWith('| ') || l.includes('---') || l.includes('成员')) continue;
  const c = l.split('|').map((x) => x.trim());
  if (c.length < 11) continue;
  tbl.push({ sec, id: c[1], tier: c[2], share: parseFloat(c[3]), nonji: parseFloat(c[4]), hands: parseFloat(c[5]),
    blocks: parseFloat(c[6]), accTxt: c[8], acc: parseFloat(c[8]), win: parseFloat(c[10]) });
}
const med = (a) => { const x = a.slice().sort((p, q) => p - q); return x[Math.floor(x.length / 2)] || 0; };
for (const s of ['exam', 'arms']) {
  const r = tbl.filter((x) => x.sec === s);
  if (!r.length) continue;
  const hi = r.filter((x) => x.share >= 5);
  const both = r.filter((x) => x.share >= 5 && x.acc >= 25);
  console.log('[' + s + '] 成员 ' + r.length + ' ‖ 份额≥5% 的 ' + hi.length + ' 枚，其准确率：' +
    (hi.map((x) => x.id + ' ' + x.accTxt).join(' ‖ ') || '无') + ' ‖ 同时满足「份额≥5% ∧ 准确率≥25%」的 ' + both.length + ' 枚');
  console.log('    份额中位 ' + med(r.map((x) => x.share)).toFixed(1) + '% ‖ 用过防御的 ' + r.filter((x) => x.share > 0).length + ' 枚 ‖ 防御手数中位 ' + med(r.map((x) => x.hands)).toFixed(2) + '/局');
  const ok = r.filter((x) => x.hands * GAMES >= 40);
  console.log('    样本≥40 手的 ' + ok.length + ' 枚（份额/准确率/夺1）：' + ok.map((x) => x.id + ' ' + x.share.toFixed(1) + '%/' + x.accTxt + '/' + x.win + '%').join('  '));
}
