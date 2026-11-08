/* 进图组装 v3（参数化单包版）：node intake-rows3.mjs <id> <readings.log> <ruler.tsv> <feasMulti> <feasLong> <packPath>
 * 84 列按表头；H5 时代列与旧几何列留空；proj 列由 attach-projcols 重灌。
 * 来源约定同 intake-rows2（11-08 午后验证版）：考卷 4 跑 tags XS/XL/PS/PL ‖ ruler 单行 ‖ feas 双桌 ok/fails ‖ 包 META ts/seed。
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';

const [ID, LOGF, RULF, FEM, FEL, PACK] = process.argv.slice(2);
if (!ID || !LOGF || !RULF || !FEM || !FEL || !PACK) {
  console.error('用法: node intake-rows3.mjs <id> <readings.log> <ruler.tsv> <feasMulti.tsv> <feasLong.tsv> <packPath>'); process.exit(2);
}
const RD = f => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').filter(x => x !== '').map(l => l.split('\t'));
const MAP = 'champion-map/coords-gen3-1105.tsv';
copyFileSync(MAP, MAP + '.bak-intake');
const co = RD(MAP);
const H = co[0];
const hIdx = Object.fromEntries(H.map((x, i) => [x, i]));

const R = {};
for (const l of readFileSync(LOGF, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
  const m = l.match(/^\[id=(\S+) tag=(\S+)\] \[冠军4N\].*?x2=(\S+) x3=(\S+) x5=(\S+) x8=(\S+) n2=(\S+) n3=(\S+) n5=(\S+) n8=(\S+)/);
  if (!m) continue;
  const [, id, tag, x2, x3, x5, x8, n2, n3, n5, n8] = m;
  const fam = tag[0] === 'X' ? 'X' : 'P', suf = tag[1] === 'L' ? 'L' : '';
  R[id] = R[id] || {};
  for (const [idx, n] of [[0, '2'], [1, '3'], [2, '5'], [3, '8']]) {
    R[id][fam + n + suf] = [x2, x3, x5, x8][idx];
    R[id]['n' + n + suf] = [n2, n3, n5, n8][idx];
  }
}
const t = RD(RULF);
const hh = Object.fromEntries(t[0].map((x, i) => [x, i]));
const ru = Object.fromEntries(t[0].map((x, i) => [x, (t[1] || [])[i]]));
const FE = {};
for (const [f, suf] of [[FEM, 'Short'], [FEL, 'Long']]) {
  const ft = RD(f);
  const fh = Object.fromEntries(ft[0].map((x, i) => [x, i]));
  for (const r of ft.slice(1)) { FE[r[fh.id]] = FE[r[fh.id]] || {}; FE[r[fh.id]]['ok' + suf] = r[fh.ok]; FE[r[fh.id]]['fails' + suf] = r[fh.fails] || ''; }
}
if (!R[ID] || !ru.id || !FE[ID]) { console.error('⛔ 缺源 readings=' + !!R[ID] + ' ruler=' + !!ru.id + ' feas=' + !!FE[ID]); process.exit(2); }
if (co.slice(1).some(r => r[hIdx.id] === ID)) { console.error('⛔ 已在图上：' + ID); process.exit(2); }
if (!existsSync(PACK)) { console.error('⛔ 包不在：' + PACK); process.exit(2); }

const s = readFileSync(PACK, 'utf8');
const ts = (s.match(/"ts":"([^"]+)"/) || [])[1] || '';
const seed = (s.match(/"seed":(\d+)/) || [])[1] || '';
const row = H.map(() => '');
const set = (k, v) => { if (hIdx[k] === undefined) throw new Error('列不存在 ' + k); row[hIdx[k]] = String(v); };
set('id', ID); set('lineage', ''); set('seed', seed || '');
set('S', ru.S); set('Geff', ru.Geff);
set('dmg', ru.dmg); set('heavy', ru.heavy); set('holo', ru.holo);
set('rounds', ru.rounds); set('drawRate', ru.drawRate); set('zeroRate', ru.zeroRate);
set('seatSpread', ru.seatSpread); set('distinctKeys', ru.distinctKeys); set('charges', ru.charges);
set('waste', ru.waste); set('noThreatStance', ru.noThreatStance); set('fieldAAtk', ru.fieldAAtk); set('rwDmg', ru.rwDmg);
set('path', PACK); set('examG', '');
set('kin', '');
set('okShort', FE[ID].okShort); set('failsShort', FE[ID].failsShort);
set('okLong', FE[ID].okLong); set('failsLong', FE[ID].failsLong);
set('ver', '2.0');
for (const n of ['2', '3', '5', '8']) {
  for (const f of ['X', 'P']) {
    set(f + n, R[ID][f + n] ?? ''); set('n' + n, R[ID]['n' + n] ?? '');
    set(f + n + 'L', R[ID][f + n + 'L'] ?? ''); set('n' + n + 'L', R[ID]['n' + n + 'L'] ?? '');
  }
}
writeFileSync(MAP, co.concat([row]).map(r => r.join('\t')).join('\n') + '\n');
console.log('已追加 ' + ID + ' ⇒ ' + MAP + '（备份 ' + MAP + '.bak-intake）‖ 非空列数 ' + row.filter(x => x !== '').length + '/' + H.length);
