/* A2 修正：重写 6 枚 V7 面臂的 lineage 行（上一版少一列导致整体错位）。
 * 逐列按**表头名**对齐；parentSrc = 'hash'（父指针来自包内 META hotstartFrom，属"包自己记的实录"）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { widOfArr } from '../../champion-map/pack-id.mjs';

const P = 'champion-map/lineage.tsv';
const lines = readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(l => l !== '');
const H = lines[0].split('\t');
const hi = Object.fromEntries(H.map((c, i) => [c, i]));
// 摘掉昨晚误追加的 fam=14 行（少一列的旧版）
const kept = [lines[0], ...lines.slice(1).filter(l => l.split('\t')[hi.fam] !== '14')];
const co = readFileSync('champion-map/coords-gen3-1105.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const ch = Object.fromEntries(co[0].map((x, i) => [x, i]));
const FAM = 14;
const LABEL = '全 v7 面臂（V7C 无热启对照 ‖ V7M/V7L 热启 T8-s114 · 三桌形） ‖ 6 枚 ‖ 11-03';
for (const id of ['V7C-s13', 'V7M-s13', 'V7L-s13', 'V7C-s41', 'V7M-s41', 'V7L-s41']) {
  const r = co.slice(1).find(x => x[ch.id] === id);
  const p = r[ch.path];
  const t = readFileSync(p, 'utf8');
  const j = JSON.parse(/window\.EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/.exec(t)[1]);
  const weights = JSON.parse(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(t)[1]).a;
  const isC = id.indexOf('V7C') === 0;
  const d = {};
  d.id = id; d.fam = String(FAM); d.famLabel = LABEL;
  d.ts = (j.ts || '').replace(/\.\d+Z$/, 'Z');
  d.metaSeed = String(j.seed || ''); d.nameSeed = id.replace(/.*-s/, 's');
  d.parent = isC ? '' : '24d8fa30bb0c3414'; d.parentOf = isC ? '' : 'T8-s114'; d.parentName = isC ? '' : 'T8-s114';
  d.wid = widOfArr(weights);
  d.rulesFp = j.rulesFingerprint || '-';
  for (const c of ['divW','divK','divRoleW','divCatW','oppsN','stockBonus','hoardPen','dealW','firstW','whistlePen','styleW','eTarget','eCap','gens','mode','seedEmb']) d[c] = '-';
  d.parentSrc = isC ? '' : 'hash';
  kept.push(H.map(c => d[c] !== undefined ? d[c] : '').join('\t'));
}
writeFileSync(P, kept.join('\n') + '\n');
console.log('重写完成：保留 ' + (kept.length - 1) + ' 行（含新 6 行，31 列对齐）');
