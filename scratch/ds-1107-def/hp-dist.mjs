
import { readFileSync, existsSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/epsfull.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
console.log('epsfull 列：', t[0].join(' / '));
const rows = t.slice(1).map(r => ({ id: r[h.id], exam: +r[h.exam], page: +r[h.page], d: +r[h.d] })).filter(r => r.id && isFinite(r.exam));
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) * p)]; };
for (const k of ['exam', 'page']) {
  const a = rows.map(r => r[k]);
  console.log(k.padEnd(5), 'n=' + a.length, 'min=' + (q(a, 0) * 100).toFixed(1) + '%', 'p25=' + (q(a, .25) * 100).toFixed(1) + '%', 'med=' + (q(a, .5) * 100).toFixed(1) + '%', 'p75=' + (q(a, .75) * 100).toFixed(1) + '%', 'max=' + (q(a, 1) * 100).toFixed(1) + '%');
}
const top = rows.slice().sort((a, b) => b.page - a.page).slice(0, 8);
console.log('\nHp 最高的 8 枚：');
for (const r of top) console.log('  ' + r.id.padEnd(28) + ' H=' + (r.exam * 100).toFixed(1) + '%  Hp=' + (r.page * 100).toFixed(1) + '%  d=' + (r.d * 100).toFixed(1));
// 池成员
try {
  const pm = rd('champion-map/pool-members.tsv');
  const ph = Object.fromEntries(pm[0].map((x, i) => [x, i]));
  const pool = pm.slice(1).map(r => r[ph.id]).filter(Boolean);
  const byId = new Map(rows.map(r => [r.id, r]));
  console.log('\n池成员 23 枚的 Hp：');
  let n = 0, s = 0;
  for (const id of pool) { const r = byId.get(id); if (!r) { console.log('  ' + id + '  表里没有'); continue; } n++; s += r.page; }
  console.log('  有读数的 ' + n + ' 枚，均值 Hp=' + (n ? (s / n * 100).toFixed(1) : '-') + '%');
} catch (e) { console.log('pool-members 读不动:', e.message); }
