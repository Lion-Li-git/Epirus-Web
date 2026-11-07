/* 验证批对比（11-07 午）：2.0 池 23 枚的新读数 vs coords 表内现值
 * 预期：同 seed/同档/同规则（R65 后）⇒ 逐位相同；任何差值都要点名。
 */
import { readFileSync } from 'node:fs';
const tsv = (p) => { const L = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').trim().split('\n'); const h = L[0].split('\t'); return L.slice(1).map(l => { const c = l.split('\t'); const o = {}; h.forEach((k, i) => o[k] = c[i]); return o; }); };
const valM = tsv('champion-map/epsfull-val-multi-1107.tsv');
const valL = tsv('champion-map/epsfull-val-long-1107.tsv');
const co = tsv('champion-map/coords-gen3-1105.tsv');
const byId = new Map(co.map(r => [r.id, r]));

function cmp(name, valRows, colExam, colPage, tColExam, tColPage) {
  let same = 0, diff = 0, noOld = 0;
  const diffs = [];
  for (const v of valRows) {
    const t = byId.get(v.id);
    if (!t) { console.log('⚠ 表里没有 ' + v.id); continue; }
    const oE = String(t[tColExam] ?? '').trim(), oP = String(t[tColPage] ?? '').trim();
    if (oE === '' && oP === '') { noOld++; continue; }
    const dE = Math.abs(+v.exam - +oE), dP = Math.abs(+v.page - +oP);
    if (dE < 1e-9 && dP < 1e-9) same++;
    else { diff++; diffs.push(`${v.id}: exam ${oE||'∅'}→${v.exam} (Δ${dE.toFixed(2)}) ‖ page ${oP||'∅'}→${v.page} (Δ${dP.toFixed(2)})`); }
  }
  console.log(`== ${name}: 逐位相同 ${same} ‖ 有差 ${diff} ‖ 表内无旧值 ${noOld}`);
  diffs.slice(0, 30).forEach(d => console.log('   ' + d));
  return { same, diff, noOld };
}
console.log('口徑：seed=77000 games=120 epsTier=lv:regular（与 R64 批同参数）');
const m = cmp('multi（H5/Hp5）', valM, 'exam', 'page', 'H5', 'Hp5');
const l = cmp('long（Hlong5/Hplong5）', valL, 'exam', 'page', 'Hlong5', 'Hplong5');
console.log('\n结论：' + (m.diff === 0 && l.diff === 0 ? '✔ 全部逐位复现 ⇒ 仪器没漂，直接开全量' : '⛔ 有差值 ⇒ 先查口径/规则再全量'));
