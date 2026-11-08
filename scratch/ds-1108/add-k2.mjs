
/* KD-K2 进图：coords 行 + lineage-g3 行（fam 16，父边挂 KD-V7——hotstart 的受体，图上在册） */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
const PACK = 'docs/artifacts/night-adapt/KD-K2.bak';
if (!existsSync(PACK)) { copyFileSync('scratch/night-adapt2/KD-K2.bak', PACK); console.log('复制包 ⇒ ' + PACK); }

const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const F = 'champion-map/coords-gen3-1105.tsv';
copyFileSync(F, F + '.bak-k2');
const co = rd(F);
const H = co[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
if (co.slice(1).some(r => r[h.id] === 'KD-K2')) { console.error('已在图上'); process.exit(2); }

const R = Object.fromEntries(rd('scratch/ds-1108/k2-ruler.tsv').slice(1).map(r => [r[0], Object.fromEntries(rd('scratch/ds-1108/k2-ruler.tsv')[0].map((k, i) => [k, r[i]]))]))['KD-K2'];
const row = H.map(() => '');
const set = (k, v) => { if (h[k] === undefined) throw new Error('列不存在 ' + k); row[h[k]] = String(v); };
set('id', 'KD-K2'); set('lineage', ''); set('ver', '2.0'); set('path', PACK); set('seed', '13');
for (const k of ['S','Geff','dmg','heavy','holo','rounds','drawRate','zeroRate','seatSpread','distinctKeys','charges','waste','noThreatStance','fieldAAtk','rwDmg']) set(k, R[k]);
set('X2', 0.6654); set('X3', 0.34); set('X5', 0.275); set('X8', 0.18);
set('X2L', 0.4723); set('X3L', 0.2468); set('X5L', 0.2071); set('X8L', 0.2857);
set('P2', 0.6292); set('P3', 0.2939); set('P5', 0.2071); set('P8', 0.2057);
set('P2L', 0.4577); set('P3L', 0.2896); set('P5L', 0.2786); set('P8L', 0.3114);
for (const n of [2, 3, 5, 8]) { set('n' + n, [2600, 1400, 700, 400][[2,3,5,8].indexOf(n)]); set('n' + n + 'L', [2600, 1400, 700, 400][[2,3,5,8].indexOf(n)]); }
co.push(row);
writeFileSync(F, co.map(x => x.join('\t')).join('\n') + '\n');
console.log('coords 行已加');

const LK = 'champion-map/lineage-g3.tsv';
copyFileSync(LK, LK + '.bak-k2');
const lw = readFileSync(LK, 'utf8').replace(/^\uFEFF/, '');
const EOL = lw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ll = lw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const LH = ll[0].split('\t');
if (!ll.some(l => l.split('\t')[0] === 'KD-K2')) {
  ll.push(['KD-K2','16','KD 蒸馏链（v7 教师全模型）','2026-11-07T23:35:20.681Z','','s13','KD-V7','KD-V7','KD-V7','9ed57f4e9a3d98e1','arm','product'].join('\t'));
  writeFileSync(LK, ll.join(EOL) + EOL);
  console.log('lineage 行已加（fam 16，父=KD-V7）');
} else console.log('lineage 已有');
