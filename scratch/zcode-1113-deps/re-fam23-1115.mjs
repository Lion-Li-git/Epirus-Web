/* 11-15 深夜（ZCode）· 图修根表手术：
 *   ① E4c/E5c 挪新族 fam23「2.0 obs6 v7 蒸馏（11-14）」+ 父边补 OBS6D3（wid 已手工核验 3a4c893b9a286477）
 *   ② fam22 标签统一为「2.0 obs6 无教师冷启动（11-14）」（原三种口径混装）
 *   ③ 全部 ver2.0 行的 lineage 列清账（11-07 裁定"血统列不兼记产物来源"——族名只住 fam_label/famLabel） */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const TS = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
const read = (f) => readFileSync(f, 'utf8');
const write = (f, s) => { copyFileSync(f, f + '.bak-refam1115-' + TS); writeFileSync(f, s, 'utf8'); };
const lines = (f) => read(f).split('\n');

/* ---- registry.tsv ---- */
const REG = 'champion-map/data/registry.tsv';
const F23 = '2.0 obs6 v7 蒸馏（11-14）', F22 = '2.0 obs6 无教师冷启动（11-14）';
const toF23 = new Set(['OBS6E4c', 'OBS6E5c']);
const keep22 = new Set(['OBS6-GA25', 'OBS6-GA200', 'OBS6-GA100M', 'OBS6-GA2PG-8K', 'OBS6-GA2PG-12K', 'OBS6A4-S1000', 'OBS6W2-S1500', 'OBS6A5-S1500']);
let nReg = 0;
const regOut = lines(REG).map((l) => {
  if (!l) return l; const c = l.split('\t'); const id = c[0];
  if (toF23.has(id)) { c[3] = '23'; c[4] = F23; c[5] = ''; nReg++; }
  else if (keep22.has(id)) { c[4] = F22; c[5] = ''; nReg++; }
  else if (c[2] === '2.0' && c[5]) { if (!c[4]) c[4] = c[5]; c[5] = ''; nReg++; }   /* 其余带族名 lineage 的 2.0 行：族名挪 fam_label（若空）后清列 */
  return c.join('\t');
});
write(REG, regOut.join('\n'));
console.log('registry: 改 ' + nReg + ' 行');

/* ---- lineage-g3.tsv ---- */
const LG = 'champion-map/data/page/lineage-g3.tsv';
const lgLines = lines(LG); const H = lgLines[0].split('\t');
const ix = Object.fromEntries(H.map((h, i) => [h, i]));
const FAM = ix.fam, FAML = ix.famLabel, PAR = ix.parent, PO = ix.parentOf, PN = ix.parentName, PS = ix.parentSrc;
let nFam = 0, nPar = 0;
const lgOut = lgLines.map((l, r) => {
  if (r === 0 || !l) return l; const c = l.split('\t'); const id = c[0];
  if (toF23.has(id)) { c[FAM] = '23'; c[FAML] = F23; c[PAR] = 'OBS6D3'; c[PO] = 'OBS6D3'; c[PN] = 'OBS6D3'; c[PS] = 'seedpack-wid'; nFam++; nPar++; }
  else if (keep22.has(id) && c[FAM] === '22' && c[FAML] !== F22) { c[FAML] = F22; nFam++; }
  return c.join('\t');
});
write(LG, lgOut.join('\n'));
console.log('lineage-g3: 族/标签 ' + nFam + ' 行 ‖ 父边 ' + nPar + ' 行');
