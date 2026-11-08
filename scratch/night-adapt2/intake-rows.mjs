/* 进图组装：3 枚 2.0 候补 → coords-gen3-1105.tsv 追加行（84 列按表头；H5 时代列与旧几何列留空，proj-tsne 填投影）
 * 读数源：intake/readings.log（exam-4n 12 跑）‖ ruler：champion-map/intake-ruler3.tsv ‖ 门：feas-multi/long.tsv ‖ ts/seed：包 META
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const RD = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const MAP = 'champion-map/coords-gen3-1105.tsv';
copyFileSync(MAP, MAP + '.bak-intake');
const co = RD(MAP);
const H = co[0];
const hIdx = Object.fromEntries(H.map((x, i) => [x, i]));

/* 读数 12 跑 */
const R = {};
const LOG_LINES = readFileSync('scratch/night-adapt2/intake/readings.log', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
for (const l of LOG_LINES) {
  const m = l.match(/^\[id=(\S+) tag=(\S+)\] \[冠军4N\].*?x2=(\S+) x3=(\S+) x5=(\S+) x8=(\S+) n2=(\S+) n3=(\S+) n5=(\S+) n8=(\S+)/);
  if (!m) continue;
  const [, id, tag, x2, x3, x5, x8, n2, n3, n5, n8] = m;
  const fam = tag[0] === 'X' ? 'X' : 'P', suf = tag[1] === 'L' ? 'L' : '';
  R[id] = R[id] || {};
  /* ⚠ 11-08 修：原写法把 **N 本身**当下标（[2,3,5,8] ⇒ 取第 2/3/5/8 个元素）⇒ P2 写的是 x5、P3 写的 x8、P5/P8 空。
   *   下标与 N 必须分开：idx 0..3 ↔ N 2/3/5/8。 */
  for (const [idx, n] of [[0, '2'], [1, '3'], [2, '5'], [3, '8']]) {
    R[id][fam + n + suf] = [x2, x3, x5, x8][idx];
    R[id]['n' + n + (tag[1] === 'L' ? 'L' : '')] = [n2, n3, n5, n8][idx];
  }
}
/* ruler（S/Geff/行为列） */
const RU = {};
{
  const t = RD('champion-map/intake-ruler3.tsv');
  const hh = Object.fromEntries(t[0].map((x, i) => [x, i]));
  for (const r of t.slice(1)) RU[r[hh.id]] = Object.fromEntries(t[0].map((x, i) => [x, r[i]]));
}
/* 门（双桌） */
const FE = {};
for (const [f, suf] of [['scratch/night-adapt2/feas-multi.tsv', 'Short'], ['scratch/night-adapt2/feas-long.tsv', 'Long']]) {
  const t = RD(f);
  const hh = Object.fromEntries(t[0].map((x, i) => [x, i]));
  for (const r of t.slice(1)) {
    FE[r[hh.id]] = FE[r[hh.id]] || {};
    FE[r[hh.id]]['ok' + suf] = r[hh.ok];
    FE[r[hh.id]]['fails' + suf] = r[hh.fails] || '';
  }
}
/* META ts/seed */
function metaOf(path) {
  const s = readFileSync(path, 'utf8');
  const ts = (s.match(/"ts":"([^"]+)"/) || [])[1] || '';
  const seed = (s.match(/"seed":(\d+)/) || [])[1] || '';
  return { ts, seed };
}

const NEW = ['CTRL2-Q-s7', 'CTRL2-Q-s13', 'ADAPT2-Q-s7'];
const dup = NEW.filter(id => co.slice(1).some(r => r[hIdx.id] === id));
if (dup.length) { console.error('⛔ 已在图上：' + dup.join(',')); process.exit(2); }

const rows = [];
for (const id of NEW) {
  const ru = RU[id], rd = R[id], fe = FE[id];
  if (!ru || !rd || !fe) { console.error('⛔ ' + id + ' 缺源 ruler=' + !!ru + ' readings=' + !!rd + ' feas=' + !!fe); process.exit(2); }
  const rel = ru.path;
  const { ts, seed } = metaOf(rel);
  const row = H.map(() => '');
  const set = (k, v) => { if (hIdx[k] === undefined) throw new Error('列不存在 ' + k); row[hIdx[k]] = String(v); };
  set('id', id); set('lineage', ''); set('seed', seed || '');
  set('S', ru.S); set('Geff', ru.Geff);
  set('dmg', ru.dmg); set('heavy', ru.heavy); set('holo', ru.holo);
  set('rounds', ru.rounds); set('drawRate', ru.drawRate); set('zeroRate', ru.zeroRate);
  set('seatSpread', ru.seatSpread); set('distinctKeys', ru.distinctKeys); set('charges', ru.charges);
  set('waste', ru.waste); set('noThreatStance', ru.noThreatStance); set('fieldAAtk', ru.fieldAAtk); set('rwDmg', ru.rwDmg);
  set('path', rel); set('examG', '');
  set('kin', '');                                  /* 来源分类待 lineage 账收录后再贴，不许猜 */
  set('okShort', fe.okShort); set('failsShort', fe.failsShort);
  set('okLong', fe.okLong); set('failsLong', fe.failsLong);
  set('ver', '2.0');
  for (const n of ['2', '3', '5', '8']) {
    for (const f of ['X', 'P']) {
      set(f + n, rd[f + n] ?? ''); set('n' + n, rd['n' + n] ?? '');
      set(f + n + 'L', rd[f + n + 'L'] ?? ''); set('n' + n + 'L', rd['n' + n + 'L'] ?? '');
    }
  }
  rows.push(row);
}
writeFileSync(MAP, co.concat(rows).map(r => r.join('\t')).join('\n') + '\n');
console.log('已追加 ' + rows.length + ' 行 ⇒ ' + MAP + '（备份 ' + MAP + '.bak-intake）‖ 各行非空列数 ' + rows.map(r => r.filter(x => x !== '').length).join('/'));
