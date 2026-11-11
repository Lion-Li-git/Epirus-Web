#!/usr/bin/env node
/* obs5 新行进 coords-gen3-1105（11-11 夜 · 用户令"直接把新包放进去重新做投影"）
 * 行来源：ruler-obs5-1111.tsv（行为 12+ 特征 + H/S）‖ triplet 台账（P 族 cells_S/L）‖
 *         exam4-F2-page-1111.tsv（P2R 族 x2..x8 + m 族）‖ C2R=(P2+P2R)/2 现算。
 * 未测列一律空串（viewer 语义 = 缺测）。幂等：id 已在表 ⇒ 跳过。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));
const CF = 'champion-map/coords-gen3-1105.tsv';
const co = rd(CF);
const H = co[0];
const col = (name) => { let i = H.indexOf(name); if (i < 0) { H.push(name); i = H.length - 1; } return i; };

const ruler = rd('champion-map/ruler-obs5-1111.tsv');
const rh = Object.fromEntries(ruler[0].map((x, i) => [x, i]));
const led = readFileSync('scratch/night-adapt2/triplet-ledger.tsv', 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const bat = rd('champion-map/exam4-F2-page-1111.tsv');
const bh = Object.fromEntries(bat[0].map((x, i) => [x, i]));

const ids = ruler.slice(1).map((r) => r[rh.id]);
const existing = new Set(co.slice(1).map((r) => r[0]).filter(Boolean));
const NS = [2, 3, 5, 8];
let added = 0;
for (const id of ids) {
  if (existing.has(id)) { console.log('跳过（已在表）' + id); continue; }
  const rr = ruler.find((r) => r[rh.id] === id);
  const path = rr[rh.path];
  const prow = [...led].reverse().find((r) => r.pack && r.pack.endsWith('/' + id + '.js'));
  const brow = bat.find((r) => r[bh.id] === id);
  const row = new Array(H.length).fill('');
  row[0] = id;
  row[col('path')] = path;
  /* P 族（A 轴 page dose，台账 cells_S=multi / cells_L=long） */
  if (prow) { NS.forEach((n, i) => { row[col('P' + n)] = prow.cells_S[i]; row[col('P' + n + 'L')] = prow.cells_L[i]; }); }
  /* P·R 族（F2 夹具）+ m 族 + C2R */
  if (brow) {
    NS.forEach((n) => { row[col('P' + n + 'R')] = brow[bh['x' + n]]; row[col('m' + n + 'R')] = brow[bh['n' + n]]; });
    if (row[col('P2')] !== '') row[col('C2R')] = ((+row[col('P2')]) + (+row[col('P2R')])) / 2;
  }
  /* ruler 行为特征（投影 12 维 + H/S 展示列） */
  for (const k of ['H', 'Hstrict', 'Htie', 'S', 'Geff', 'dmg', 'heavy', 'holo', 'zeroRate', 'drawRate', 'rounds', 'distinctKeys', 'seatSpread', 'charges', 'waste', 'noThreatStance', 'fieldAAtk', 'fieldARounds', 'rwDmg']) {
    if (rr[rh[k]] !== undefined && rr[rh[k]] !== '') row[col(k)] = rr[rh[k]];
  }
  co.push(row);
  added++;
}
writeFileSync(CF, co.map((r) => r.join('\t')).join('\n') + '\n', 'utf8');
console.log('obs5 新行 ' + added + ' ‖ 表总行 ' + (co.length - 1) + ' ‖ 列数 ' + H.length);
