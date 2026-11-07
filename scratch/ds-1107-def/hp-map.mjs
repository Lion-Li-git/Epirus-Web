
import { readFileSync } from 'node:fs';
const raw = readFileSync('champion-map/coords-gen3-1105.tsv', 'utf8').replace(/^\uFEFF/, '');
const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = lines[0].split('\t');
console.log('列数', H.length, '：', H.join(' / ').slice(0, 600));
const rows = lines.slice(1).map(l => l.split('\t'));
const h = Object.fromEntries(H.map((x, i) => [x, i]));
const pm = readFileSync('champion-map/pool-members.tsv', 'utf8').replace(/\r\n/g,'\n').replace(/\n+$/,'').split('\n').map(l => l.split('\t'));
const pid = Object.fromEntries(pm[0].map((x, i) => [x, i]));
const ids = pm.slice(1).map(r => r[pid.id]).filter(Boolean);
const byId = new Map(rows.map(r => [r[h.id], r]));
console.log('\n池 23 枚在 coords-gen3-1105 里的读数（H / Hp / Hlong / Hplong）：');
let n = 0;
for (const id of ids) {
  const r = byId.get(id);
  if (!r) { console.log('  ' + id.padEnd(22) + ' 不在表里'); continue; }
  n++;
  const g = (k) => (h[k] == null || r[h[k]] === undefined || r[h[k]] === '') ? '—' : r[h[k]];
  console.log('  ' + id.padEnd(22) + ' H=' + String(g('H')).padStart(6) + ' Hp=' + String(g('Hp')).padStart(6) + ' Hlong=' + String(g('Hlong')).padStart(6) + ' Hplong=' + String(g('Hplong')).padStart(6) + ' Flong=' + String(g('Flong')).padStart(6));
}
console.log('\n命中 ' + n + '/' + ids.length);
