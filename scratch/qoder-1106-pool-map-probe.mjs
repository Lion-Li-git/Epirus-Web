import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { widOf } from '../champion-map/pack-id.mjs';
const root='D:/code/Epirus-Web';
const rd=(p)=>readFileSync(join(root,p),'utf8').replace(/\r\n/g,'\n').replace(/\n+$/,'').split('\n');
const c=rd('champion-map/coords-projcols.tsv'),h=c[0].split('\t'),iId=h.indexOf('id'),iPath=h.indexOf('path'),iAlias=h.indexOf('aliasIds');
const byWid={},byName=new Set();
for(const l of c.slice(1)){const a=l.split('\t');if(!a[iId])continue;byName.add(a[iId]);String(a[iAlias]||'').split(/\s+/).filter(Boolean).forEach(n=>byName.add(n));let w='';try{w=widOf(readFileSync(join(root,a[iPath]),'utf8'))}catch(e){}if(w&&!byWid[w])byWid[w]=a[iId]}
const p=rd('champion-map/pool-members.tsv'),ph=p[0].split('\t'),pi=ph.indexOf('id'),pw=ph.indexOf('wid'),pt=ph.indexOf('tier');
for(const l of p.slice(1)){const a=l.split('\t'),id=a[pi],w=a[pw];const nameHit=byName.has(id),widHit=byWid[w];console.log([id,a[pt],nameHit?'name':'NO-NAME',widHit||'NO-WID'].join('\t'))}
