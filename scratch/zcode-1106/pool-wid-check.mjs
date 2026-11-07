/* 池 25 枚 wid 唯一性检查（11-07 凌晨 · 跨臂权重同事件后的一致性验证） */
import { readFileSync } from 'node:fs';
import { widOfArr } from '../../champion-map/pack-id.mjs';
const pl = readFileSync('champion-map/pool-members.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const h = Object.fromEntries(pl[0].map((c, i) => [c, i]));
const wids = {};
for (const r of pl.slice(1)) {
  const id = r[h.id], p = r[h.path];
  const t = readFileSync(p, 'utf8');
  const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(t);
  const w = widOfArr(JSON.parse(m[1]).a);
  if (wids[w]) console.log('⚠ 池内 wid 撞车：' + id + ' == ' + wids[w] + ' (' + w.slice(0, 10) + ')'); else wids[w] = id;
}
console.log('池 ' + (pl.length - 1) + ' 枚 wid 唯一性检查完成，唯一 wid 数：' + Object.keys(wids).length);
