
/* 补 2 枚种子节点（KD-Qg / KD-K2-l）+ 把 4 条夜班父边升级成「种子文件同权重」级（seedpack-wid）
 * 依据：子包 META.hotstartFrom 与父包 wid 逐位相同
 *   CTRL2-Q-s7/s13、ADAPT2-Q-s7 : fa28800eae6a3d7c = KD-Qg.wid ✓
 *   KD-K2                        : 9ed57f4e9a3d98e1 = KD-K2-l.wid ✓
 *   KD-K2-l                      : 61164b09cac44d2d = KD-V7.wid ✓
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';

/* 1) 包复制到 docs/artifacts/night-adapt/ */
for (const [src, dst] of [['scratch/night-adapt2/KD-Qg.bak','docs/artifacts/night-adapt/KD-Qg.bak'], ['scratch/night-adapt2/KD-K2-l.bak','docs/artifacts/night-adapt/KD-K2-l.bak']]) {
  if (!existsSync(dst)) { copyFileSync(src, dst); console.log('复制 ' + dst); }
}

const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const F = 'champion-map/coords-gen3-1105.tsv';
copyFileSync(F, F + '.bak-seeds');
const co = rd(F), H = co[0], h = Object.fromEntries(H.map((x, i) => [x, i]));
const R = {};
{ const rt = rd('scratch/ds-1108/seeds-ruler.tsv'), rh = Object.fromEntries(rt[0].map((x, i) => [x, i]));
  for (const r of rt.slice(1)) R[r[rh.id]] = Object.fromEntries(Object.keys(rh).map(k => [k, r[rh[k]]])); }

const SPEC = {
  'KD-Qg':  { path: 'docs/artifacts/night-adapt/KD-Qg.bak',   P: [0.6977, 0.2682, 0.2018, 0.1171], PL: [0.5715, 0.3829, 0.3321, 0.3257] },
  'KD-K2-l':{ path: 'docs/artifacts/night-adapt/KD-K2-l.bak', P: [0.1123, 0.2886, 0.2768, 0.1943], PL: [0.1438, 0.3571, 0.3107, 0.2971] },
};
for (const id of Object.keys(SPEC)) {
  if (co.slice(1).some(r => r[h.id] === id)) { console.log(id + ' 已在图上'); continue; }
  const s = SPEC[id], ru = R[id];
  const row = H.map(() => '');
  const set = (k, v) => { if (h[k] === undefined) throw new Error('缺列 ' + k); row[h[k]] = String(v); };
  set('id', id); set('lineage', ''); set('ver', '2.0'); set('path', s.path); set('seed', '13');
  for (const k of ['S','Geff','dmg','heavy','holo','rounds','drawRate','zeroRate','seatSpread','distinctKeys','charges','waste','noThreatStance','fieldAAtk','rwDmg']) set(k, ru[k]);
  [2,3,5,8].forEach((n, i) => { set('P'+n, s.P[i]); set('P'+n+'L', s.PL[i]); set('n'+n, [2600,1400,700,400][i]); set('n'+n+'L', [2600,1400,700,400][i]); });
  co.push(row);
  console.log(id + ' coords 行已加');
}
writeFileSync(F, co.map(x => x.join('\t')).join('\n') + '\n');

/* 2) lineage：新增 2 行 + 改 4 条父边 */
const LK = 'champion-map/lineage-g3.tsv';
copyFileSync(LK, LK + '.bak-seeds');
const lw = readFileSync(LK, 'utf8').replace(/^\uFEFF/, '');
const EOL = lw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ll = lw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const LH = ll[0].split('\t'), lh = Object.fromEntries(LH.map((x, i) => [x, i]));
const has = (id) => ll.some(l => l.split('\t')[0] === id);
const LAB = 'KD 蒸馏链（v7 教师全模型）';
const add = [
  ['KD-Qg','16',LAB,'2026-11-07T17:20:00.000Z','','s13','', '', '', widOf(readFileSync('docs/artifacts/night-adapt/KD-Qg.bak','utf8')), '', 'product'],
  ['KD-K2-l','16',LAB,'2026-11-07T23:35:19.453Z','','s13','KD-V7','KD-V7','KD-V7', widOf(readFileSync('docs/artifacts/night-adapt/KD-K2-l.bak','utf8')), 'seedpack-wid','product'],
];
for (const r of add) { if (has(r[0])) { console.log('lineage 已有 ' + r[0]); continue; } ll.push(r.join('\t')); console.log('lineage 加 ' + r[0]); }

const REPARENT = { 'CTRL2-Q-s7':'KD-Qg', 'CTRL2-Q-s13':'KD-Qg', 'ADAPT2-Q-s7':'KD-Qg', 'KD-K2':'KD-K2-l' };
for (let i = 1; i < ll.length; i++) {
  const c = ll[i].split('\t');
  const p = REPARENT[c[lh.id]];
  if (!p) continue;
  c[lh.parent] = p; c[lh.parentOf] = p; c[lh.parentName] = p; c[lh.parentSrc] = 'seedpack-wid';
  ll[i] = c.join('\t');
  console.log('改父边 ' + c[lh.id] + ' → ' + p + '（seedpack-wid）');
}
writeFileSync(LK, ll.join(EOL) + EOL);
