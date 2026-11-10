
import { readFileSync } from 'node:fs';
const rd=(f)=>readFileSync(f,'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').trim().split('\n');
const co=rd('champion-map/coords-gen3-1105.tsv').map(l=>l.split('\t'));
const H=co[0]; const iId=H.indexOf('id');
const mapIds=new Set(co.slice(1).map(r=>r[iId]).filter(Boolean));
const ex=rd('champion-map/exam4-page-1109.tsv').map(l=>l.split('\t')[0]);
const exSet=new Set(ex.slice(1));
const missing=[...mapIds].filter(i=>!exSet.has(i));
console.log('图上 '+mapIds.size+' 枚，考卷表 '+exSet.size+' 枚，缺 '+missing.length);
console.log('缺的：'+missing.join(' '));
