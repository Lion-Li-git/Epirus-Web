
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\n+$/,'').split('\n').map(l=>l.split('\t'));
const t = rd('scratch/qoder-1109-card-usage-pool20.tsv');
const H = t[0]; const iId = 0, iN = H.indexOf('distinct'), iDef = H.indexOf('defShare');
const rows = t.slice(1).filter(r=>r[0]);
const n = rows.map(r => +r[iN]).sort((a,b)=>a-b);
console.log('枚数 ' + rows.length + ' 用卡 min/中位/max = ' + n[0] + '/' + n[Math.floor(n.length/2)] + '/' + n[n.length-1]);
console.log('≥9 的：' + rows.filter(r=>+r[iN]>=9).map(r=>r[0]).join(' '));
console.log('≥8 的：' + rows.filter(r=>+r[iN]>=8).map(r=>r[0]).join(' '));
const trio = rows.filter(r => ['guard','reflect','bagua'].every(k => (+r[H.indexOf(k)]||0) >= 0.5));
console.log('三件全开：' + trio.map(r=>r[0]).join(' '));
