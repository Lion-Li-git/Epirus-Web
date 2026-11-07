
import { readFileSync, existsSync } from 'node:fs';
const pm = readFileSync('champion-map/pool-members.tsv', 'utf8').replace(/\r\n/g,'\n').replace(/\n+$/,'').split('\n').map(l => l.split('\t'));
const pid = Object.fromEntries(pm[0].map((x, i) => [x, i]));
const ids = pm.slice(1).map(r => r[pid.id]).filter(Boolean);
for (const f of ['champion-map/coords-projcols.tsv', 'champion-map/coords-view-20.tsv', 'champion-map/coords.tsv']) {
  if (!existsSync(f)) { console.log(f + ' 不存在'); continue; }
  const raw = readFileSync(f, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const H = lines[0].split('\t');
  const h = Object.fromEntries(H.map((x, i) => [x, i]));
  const rows = lines.slice(1).map(l => l.split('\t'));
  const byId = new Map(rows.map(r => [r[h.id], r]));
  const hasLong = ids.filter(id => { const r = byId.get(id); return r && h.Hlong != null && r[h.Hlong] !== '' && r[h.Hlong] != null; }).length;
  const hasHp = ids.filter(id => { const r = byId.get(id); return r && h.Hp != null && r[h.Hp] !== ''; }).length;
  console.log(f.split('/').pop().padEnd(22) + ' 行数 ' + rows.length + '  Hlong 有 ' + hasLong + '/' + ids.length + '  Hp 有 ' + hasHp + '/' + ids.length + '  列 ' + H.length);
}
