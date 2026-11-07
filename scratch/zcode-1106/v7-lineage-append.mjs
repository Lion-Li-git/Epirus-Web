/* A2：给 6 枚 V7 面臂补 lineage.tsv 行（fam=14 新家族；身份全部从包内 META 实读）
 * ZCode 11-06 夜 · PLAN §A2。wid 用在册 pack-id.mjs 的 widOfArr 现算（与 build-pool-bundle 同一支）。
 */
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { widOfArr } from '../../champion-map/pack-id.mjs';

const IDS = ['V7C-s13', 'V7M-s13', 'V7L-s13', 'V7C-s41', 'V7M-s41', 'V7L-s41'];
const co = readFileSync('champion-map/coords-gen3-1105.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const h = Object.fromEntries(co[0].map((x, i) => [x, i]));
const lin = readFileSync('champion-map/lineage.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const lh = Object.fromEntries(lin[0].split('\t').map((c, i) => [c, i]));
const have = new Set(lin.slice(1).map(l => l.split('\t')[lh.id]).filter(Boolean));

const FAM = 14;
const LABEL = '全 v7 面臂（V7C 无热启对照 ‖ V7M/V7L 热启 T8-s114 · 三桌形） ‖ 6 枚 ‖ 11-03';
const rows = [];
for (const id of IDS) {
  if (have.has(id)) { console.log('跳过（已在账）：' + id); continue; }
  const r = co.slice(1).find(x => x[h.id] === id);
  const p = r[h.path];
  if (!existsSync(p)) { console.log('⛔ 包不在：' + p); process.exit(2); }
  const t = readFileSync(p, 'utf8');
  const mm = /(?:window\.EPIRUS_CHAMPION_3P_META|window\.EPIRUS_CHAMPION_META)\s*=\s*(\{[\s\S]*?\})\s*;/.exec(t);
  if (!mm) { console.log('⛔ META 读不出：' + p); process.exit(2); }
  const j = JSON.parse(mm[1]);
  const mw = /window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/.exec(t);
  const weights = JSON.parse(mw[1]).a;
  const wid = widOfArr(weights);
  const seed = String(j.seed || id.replace(/.*-s/, ''));
  const isC = id.indexOf('V7C') === 0;
  rows.push([id, FAM, LABEL, (j.ts || '').replace(/\.\d+Z$/, 'Z'), seed, id.replace(/.*-s/, 's'),
    isC ? '' : '24d8fa30bb0c3414', isC ? '' : 'T8-s114', isC ? '' : 'T8-s114', wid, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', 'meta', '', '', ''].join('\t'));
}
if (rows.length) appendFileSync('champion-map/lineage.tsv', rows.join('\n') + '\n');
console.log('补行 ' + rows.length + ' 条（fam=' + FAM + '）');
