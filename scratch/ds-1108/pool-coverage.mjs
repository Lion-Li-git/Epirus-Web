
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const pool = rd('champion-map/pool-members.tsv');
const ph = Object.fromEntries(pool[0].map((x, i) => [x, i]));
const tiers = {};
for (const r of pool.slice(1)) if (r[ph.id]) tiers[r[ph.tier] || '(空)'] = (tiers[r[ph.tier] || '(空)'] || 0) + 1;
console.log('池表 ' + (pool.length - 1) + ' 枚：' + JSON.stringify(tiers));
const co = rd('champion-map/coords-gen3-1105.tsv');
const ch = Object.fromEntries(co[0].map((x, i) => [x, i]));
const has = (k) => ch[k] !== undefined;
console.log('coords 行数 ' + (co.length - 1) + '  列数 ' + co[0].length + '  有 okShort 列=' + has('okShort') + ' okLong=' + has('okLong'));
if (has('okShort')) {
  let both = 0, onlyS = 0, onlyL = 0, none = 0;
  for (const r of co.slice(1)) {
    const s = r[ch.okShort] !== '' , l = r[ch.okLong] !== '';
    if (s && l) both++; else if (s) onlyS++; else if (l) onlyL++; else none++;
  }
  console.log('  双桌都有读数 ' + both + ' ‖ 只有短 ' + onlyS + ' ‖ 只有长 ' + onlyL + ' ‖ 都没有 ' + none);
}
