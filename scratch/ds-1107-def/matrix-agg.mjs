
import { readFileSync } from 'node:fs';
const t = readFileSync('scratch/ds-1107-def/q-u-matrix.tsv', 'utf8').trim().split('\n').map(l => l.split('\t'));
const H = t[0];
const rows = t.slice(1).map(c => Object.fromEntries(H.map((k, i) => [k, c[i]]))).map(r => ({ ...r, N: +r.N, hp: +r.hp, exA: +r.exA, exB: +r.exB, G: +r.G }));
const p = (ex, N) => ex * (1 - 1 / N) + 1 / N;
for (const ch of ['Q-s47', 'U-s205']) {
  const mine = rows.filter(r => r.champ === ch);
  console.log('\n=== ' + ch + ' 对各池成员的均值（跨 12 格） ===');
  const byOpp = {};
  for (const r of mine) (byOpp[r.opp] = byOpp[r.opp] || []).push(r.exA);
  const arr = Object.entries(byOpp).map(([o, a]) => [o, a.reduce((s, v) => s + v, 0) / a.length, mine.find(r => r.opp === o).tier]);
  arr.sort((a, b) => b[1] - a[1]);
  console.log('  最怕的 5 个：'); for (const [o, v, tr] of arr.slice(-5).reverse()) console.log('    ' + o.padEnd(22) + (tr || '').padEnd(5) + v.toFixed(3));
  console.log('  最捏的 3 个：'); for (const [o, v, tr] of arr.slice(0, 3)) console.log('    ' + o.padEnd(22) + (tr || '').padEnd(5) + v.toFixed(3));
  /* 按 N 汇总（跨 hp） */
  console.log('  按 N：');
  for (const N of [2, 3, 5, 8]) {
    const a = mine.filter(r => r.N === N).map(r => r.exA);
    console.log('    N=' + N + '  mean=' + (a.reduce((s, v) => s + v, 0) / a.length).toFixed(3) + '  ⇒ 折合胜率 ' + (p(a.reduce((s, v) => s + v, 0) / a.length, N) * 100).toFixed(1) + '%');
  }
}
/* Q 的两个极端格 */
console.log('\n=== Q-s47 N2hp3 最差的 4 格（原始） ===');
for (const r of rows.filter(r => r.champ === 'Q-s47' && r.N === 2 && r.hp === 3).sort((a, b) => a.exA - b.exA).slice(0, 4))
  console.log('  ' + r.opp.padEnd(22) + (r.tier || '').padEnd(5) + ' a=' + r.a + '/' + r.G + ' exA=' + r.exA.toFixed(2) + '  b=' + r.b + '/' + r.G + ' exB=' + r.exB.toFixed(2));
