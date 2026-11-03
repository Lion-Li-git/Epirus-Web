/* 对账：我这批六臂的起点，是不是 DS 册子里记载的那两枚（把"文档口径"变成产物口径）。
 * 方法：用仓里那一个真源 `champion-map/pack-id.mjs::widOf` 算起点包的权重身份，
 *   再与臂自己写进 meta / 段档案的 `hotstartFrom` 比（train-3p:1915 记的就是 widOf(src)）。 */
import { readFileSync } from 'node:fs';
import { widOf } from '../champion-map/pack-id.mjs';

const grab = (p) => readFileSync(p, 'utf8');   /* widOf 吃的是**文件文本**（内部用 packArr 找 `EPIRUS_CHAMPION_3P =` 那一处） */
const want = {};
for (const [k, p] of [['L5-D4a-s13', 'scratch/ga-arms/L5-D4a-s13.js'], ['CB-s13', 'scratch/night4/CB-s13.js']]) {
  const c = grab(p);
  want[k] = c ? widOf(c) : '抠不出';
  console.log('起点包 ' + k.padEnd(12) + ' wid = ' + want[k]);
}
console.log('');
for (const arm of ['BREAD-W05-s13', 'BREAD-W05-s7', 'BREAD-W05-s41', 'CBG-s13', 'CBG-s7', 'CBG-s41']) {
  const f = 'scratch/ga-bands/' + arm + '/' + arm + '-seg1.bak';
  let hv = null;
  try { hv = JSON.parse(/EPIRUS_CHAMPION_3P_META = (\{.*?\});/.exec(readFileSync(f, 'utf8'))[1]).hotstartFrom; } catch (e) { hv = '读不出（' + e.message.slice(0, 40) + '）'; }
  const match = Object.entries(want).find(([, w]) => w === hv);
  console.log(arm.padEnd(16) + ' hotstartFrom = ' + String(hv).padEnd(18) + ' ⇒ ' + (match ? '对上 ' + match[0] : '**对不上任何已登记起点（要看 DS 原意）**'));
}
