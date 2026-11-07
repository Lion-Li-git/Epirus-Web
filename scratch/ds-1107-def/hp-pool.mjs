
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/epsfull-r64-multi-1107.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
console.log('表头：', t[0].join(' / '));
const rows = t.slice(1).map(r => ({ id: r[h.id], exam: +r[h.exam], page: +r[h.page], d: +r[h.d] })).filter(r => r.id);
console.log('行数', rows.length);
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) * p)]; };
for (const k of ['exam', 'page']) {
  const a = rows.map(r => r[k]).filter(isFinite);
  console.log(k.padEnd(5), 'n=' + a.length, 'min=' + q(a, 0).toFixed(1), 'p25=' + q(a, .25).toFixed(1), 'med=' + q(a, .5).toFixed(1), 'p75=' + q(a, .75).toFixed(1), 'max=' + q(a, 1).toFixed(1));
}
console.log('\n前 12 枚（按 Hp）：');
for (const r of rows.slice().sort((a, b) => b.page - a.page).slice(0, 12)) {
  console.log('  ' + r.id.padEnd(26) + ' H=' + r.exam.toFixed(1) + '  Hp=' + r.page.toFixed(1) + '  d=' + r.d.toFixed(1));
}
const long = rd('champion-map/epsfull-r64-long-1107.tsv');
const lh = Object.fromEntries(long[0].map((x, i) => [x, i]));
const lrows = long.slice(1).map(r => ({ id: r[lh.id], page: +r[lh.page] })).filter(r => r.id && isFinite(r.page));
const la = lrows.map(r => r.page);
console.log('\n长桌（' + long[0].join('/') + '） n=' + la.length + ' min=' + q(la,0).toFixed(1) + ' med=' + q(la,.5).toFixed(1) + ' max=' + q(la,1).toFixed(1));
