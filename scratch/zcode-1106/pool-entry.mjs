/* E：5 枚零阻断臂入池表（champion-map/pool-members.tsv 追加行；wid 现算）
 * ZCode 11-07 凌晨 · 用户授权"好结果自由调池"。tier=hard（破墙+强度双过）。
 * promoteVerdict=pass（在册首个 pass——此前 20 枚全 block）。
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { widOfArr } from '../../champion-map/pack-id.mjs';

const IDS = ['DEF-s13', 'DEF-s15', 'DEF-s16', 'COMBO-s13', 'COMBO-s16'];
const pl = readFileSync('champion-map/pool-members.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const h = Object.fromEntries(pl[0].split('\t').map((c, i) => [c, i]));
const have = new Set(pl.slice(1).map(l => l.split('\t')[h.id]).filter(Boolean));
const rows = [];
for (const id of IDS) {
  if (have.has(id)) { console.log('跳过（已在池）：' + id); continue; }
  const p = 'docs/artifacts/2p0-pool/' + id + '.bak';
  const t = readFileSync(p, 'utf8');
  const weights = JSON.parse(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(t)[1]).a;
  const wid = widOfArr(weights);
  const arm = id.indexOf('DEF') === 0 ? 'DEF 四 credit（WALL_BREAK 1/REFLECT/GUARD_HIT/DEF_ADAPT 0.5）' : 'COMBO（POOL_OPPS=6 hard + MIXHP=4 + 四 credit）';
  rows.push([id, wid, p, 'hard', 1, 'pass', '-1', new Date().toString(),
    '11-07 凌晨 ZCode 波次臂入池（用户授权自由调池）：**promote 体检 0 阻断**（在册首个 pass 级——原 20 枚全 block）‖ 配方=' + arm +
    ' ‖ 终考卷 1st ' + (id === 'DEF-s13' ? '50.3' : id === 'DEF-s15' ? '52.6' : id === 'DEF-s16' ? '53.1' : id === 'COMBO-s13' ? '51.9' : '52.8') + '%（名人堂 5760 局）' +
    ' ‖ G5 防席夺冠 ' + (id === 'DEF-s13' ? '3/3' : id === 'DEF-s15' ? '(见 promote log)' : id === 'DEF-s16' ? '17/1' : id === 'COMBO-s13' ? '16/12' : '(见 promote log)') +
    '%（阈值 ≤25）‖ G4 最克余 ≥19pt ‖ 还手率 ≥21.8% ‖ 源=scratch/ga-arms/' + id + '.js（S15/S16 走当选 band 件）'].join('\t'));
}
if (rows.length) appendFileSync('champion-map/pool-members.tsv', rows.join('\n') + '\n');
console.log('池表追加 ' + rows.length + ' 行（hard 带 10→' + (10 + rows.length) + '）');
