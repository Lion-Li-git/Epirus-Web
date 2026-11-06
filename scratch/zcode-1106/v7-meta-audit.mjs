/* A2：读 6 枚 V7 面臂的包内 META（ts/hotstartFrom/wid），给 lineage.tsv 补行（ZCode 11-06 夜） */
import { readFileSync } from 'node:fs';
const co = readFileSync('champion-map/coords-gen3-1105.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const h = Object.fromEntries(co[0].map((x, i) => [x, i]));
for (const id of ['V7C-s13', 'V7M-s13', 'V7L-s13', 'V7C-s41', 'V7M-s41', 'V7L-s41']) {
  const r = co.slice(1).find(x => x[h.id] === id);
  if (!r) { console.log(id, '不在主表'); continue; }
  const p = r[h.path];
  let ts = '', parent = '', wid = '', arm = '';
  try {
    const t = readFileSync(p, 'utf8');
    const mm = /(?:window\.EPIRUS_CHAMPION_3P_META|window\.EPIRUS_CHAMPION_META)\s*=\s*(\{[\s\S]*?\})\s*;/.exec(t);
    if (mm) { const j = JSON.parse(mm[1]); ts = j.ts || ''; parent = j.hotstartFrom || ''; arm = j.arm || ''; }
    const mw = /"wid":"([0-9a-f]+)"/.exec(t); wid = mw ? mw[1] : '';
  } catch (e) { console.log(id, '读不到', p); continue; }
  console.log([id, p, ts, parent, wid, arm].join(' | '));
}
// lineage.tsv 现有 fam 最大号与表头
const lin = readFileSync('champion-map/lineage.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
console.log('lineage.tsv 表头:', lin[0]);
let maxfam = 0;
for (const l of lin.slice(1)) { const f = parseInt(l.split('\t')[1], 10); if (isFinite(f) && f > maxfam) maxfam = f; }
console.log('现有最大 fam 号:', maxfam, '| 行数:', lin.length - 1);
