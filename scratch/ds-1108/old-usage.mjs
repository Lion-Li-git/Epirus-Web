
import { readFileSync } from 'node:fs';
const t = readFileSync('scratch/zcode-1106/skill-report-pool-1106.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map(l => l.split('\t'));
const H = t[0];
const rows = t.slice(1).filter(r => r[0] && !/^-/.test(r[2]) );
console.log('列数 ' + H.length + ' 行数 ' + rows.length);
console.log('包：' + rows.map(r => r[0]).join(' '));
const iJi = H.indexOf('ジ使用%'), iRing = H.indexOf('聚能环使用%'), iRail = H.indexOf('电磁炮使用%'), iChg = H.indexOf('蓄能使用%');
const iSnipe = H.indexOf('狙击枪使用%'), iGun = H.indexOf('枪使用%'), iDef = H.indexOf('防御使用%'), iRef = H.indexOf('反弹使用%'), iBagua = H.indexOf('八卦阵使用%');
const iTank = H.indexOf('坦克使用%'), iLaser = H.indexOf('激光剑使用%'), iDual = H.indexOf('双枪射手使用%');
for (const r of rows) {
  const g = (i) => i >= 0 && r[i] !== undefined && r[i] !== '' ? (+r[i]).toFixed(1) : '-';
  const used = H.map((h, k) => k >= 3 && k < 32 && r[k] !== undefined && r[k] !== '' && +r[k] > 0.05).filter(Boolean).length;
  console.log((r[0] + '          ').slice(0, 14) + ' ジ' + g(iJi) + ' 环' + g(iRing) + ' 炮' + g(iRail) + ' 蓄' + g(iChg) + ' 狙' + g(iSnipe) + ' 枪' + g(iGun) + ' 防' + g(iDef) + ' 反' + g(iRef) + ' 卦' + g(iBagua) + ' 坦' + g(iTank) + ' 激光' + g(iLaser) + ' 双枪' + g(iDual) + '  用过卡数≈' + used);
}
