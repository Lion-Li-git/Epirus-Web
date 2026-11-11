/* 总表：14 枚单技能包 × A/B 四人数读数+排名 × C2R × 旧考卷 Hp5 × 反墙落地 rwDmg，并对照冠军链 */
import { readFileSync } from 'node:fs';
const T = readFileSync('champion-map/data/build/coords-view.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map(l => l.split('\t'));
const H = T[0], ix = Object.fromEntries(H.map((x, i) => [x, i]));
const R = T.slice(1);
const g = (r, k) => r[ix[k]];
const KEY = { 'V111':'枪','v7densE-81':'枪','v7role5-81':'枪','v13-103':'剑','v14-116':'剑','v17-142':'剑','v7b-42':'剑','v9-42':'狙击','e1-teach-77003':'狙击','v7blk1-93':'蓄能','v7ctrlE-31':'蓄能','v7expo-34':'全息','v7seat24-31':'地雷','DSTR4-s13':'大雷(2.0)' };
const CHAIN = ['MSB13-R1S791820660','MSB11-R2S306293884','MSB14-railgun-R1S175656469','MSB10-R1S1149480262','Q-s47','G5C-100','G5J-50'];
const rank = (col, id, dir = 1) => {
  const vals = R.map(r => +g(r, col)).filter(Number.isFinite);
  const r0 = R.find(r => g(r, 'id') === id); if (!r0) return '';
  const me = +g(r0, col); if (!Number.isFinite(me)) return '—';
  return ((vals.filter(v => (dir ? v > me : v < me)).length + 1) + '/' + vals.length);
};
const ids = Object.keys(KEY).concat(CHAIN);
console.log(['id','技能','P2','rkP2','P2R','rkP2R','P3R','rkP3R','P5R','rkP5R','P8R','rkP8R','P5L','rkA5L','C2R','rkC2R','Hp5','rkHp5','rwDmg','fieldAAtk','noThreat'].join('\t'));
for (const id of ids) {
  const r = R.find(r => g(r, 'id') === id); if (!r) { console.log(id + '\t不在表中'); continue; }
  const skill = KEY[id] || '冠军链';
  console.log([id, skill, g(r,'P2'), rank('P2',id), g(r,'P2R'), rank('P2R',id), g(r,'P3R'), rank('P3R',id), g(r,'P5R'), rank('P5R',id), g(r,'P8R'), rank('P8R',id), g(r,'P5L'), rank('P5L',id), g(r,'C2R'), rank('C2R',id), g(r,'Hp5'), rank('Hp5',id), g(r,'rwDmg'), g(r,'fieldAAtk'), g(r,'noThreatStance')].join('\t'));
}
