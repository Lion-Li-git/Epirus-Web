
import { readFileSync } from 'node:fs';
const rd=(f)=>{const l=readFileSync(f,'utf8').replace(/\r\n/g,'\n').trim().split('\n');const H=l[0].split('\t');return Object.fromEntries(l.slice(1).map(r=>{const c=r.split('\t');const o={};H.forEach((h,i)=>o[h]=c[i]);return [c[0],o];}));};
const W={2:0.15,3:0.25,5:0.45,8:0.15};
const x4=(r)=>{if(!r)return NaN;let a=0,w=0;for(const n of [2,3,5,8]){const v=r['x'+n];if(v!==''&&v!==undefined){a+=W[n]*+v;w+=W[n];}}return w?a/w:NaN;};
const oS=rd('champion-map/exam4-page-1107.tsv'), nS=rd('champion-map/exam4-page-1109.tsv');
const oL=rd('champion-map/exam4-page-long-1107.tsv'), nL=rd('champion-map/exam4-page-long-1109.tsv');
const ids=['G5C-100','G5J-50','G5G-50','G5I-50','WSEL9-200','KDG-B-Q-s13','FOCUS-Q-s13','CLEAR-Q-s13','ADAPT2-Q-s7','KD-G2','STR-B-Q-s13','WIDE2-200'];
console.log('包'.padEnd(16)+'旧短'.padStart(8)+'新短'.padStart(8)+'Δ短'.padStart(8)+'旧长'.padStart(8)+'新长'.padStart(8)+'Δ长'.padStart(8));
for(const id of ids){const a=x4(oS[id]),b=x4(nS[id]),c=x4(oL[id]),d=x4(nL[id]);if(!isFinite(b)){console.log(id+' 缺');continue;}
 console.log(id.padEnd(16)+a.toFixed(3).padStart(8)+b.toFixed(3).padStart(8)+((b-a).toFixed(3)).padStart(8)+c.toFixed(3).padStart(8)+d.toFixed(3).padStart(8)+((d-c).toFixed(3)).padStart(8));}
/* 相关性：用「防御占比」当 X —— 只有少数包有实测，改用近似的 reflect/guard 使用率需要卡谱；这里先给 2P 变化 */
let drop=0,rise=0;for(const id of Object.keys(nS)){const a=x4(oS[id]),b=x4(nS[id]);if(!isFinite(a)||!isFinite(b))continue;if(b<a)drop++;else rise++;}
console.log('\n全库：短桌下降 '+drop+' 枚 / 上升 '+rise+' 枚');
