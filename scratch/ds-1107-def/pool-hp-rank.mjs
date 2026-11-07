
import { readFileSync } from 'node:fs';
const raw = readFileSync('champion-map/coords-projcols.tsv', 'utf8').replace(/^\uFEFF/, '');
const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = lines[0].split('\t');
const h = Object.fromEntries(H.map((x, i) => [x, i]));
const rows = lines.slice(1).map(l => l.split('\t'));
const byId = new Map(rows.map(r => [r[h.id], r]));
const pm = readFileSync('champion-map/pool-members.tsv', 'utf8').replace(/\r\n/g,'\n').replace(/\n+$/,'').split('\n').map(l => l.split('\t'));
const ph = Object.fromEntries(pm[0].map((x, i) => [x, i]));
const list = pm.slice(1).map(r => ({ id: r[ph.id], tier: r[ph.tier], note: (r[ph.note]||'').slice(0,40) })).filter(x => x.id);
const out = list.map(x => { const r = byId.get(x.id); return { ...x, hp: r ? +r[h.Hp] : NaN }; }).sort((a, b) => b.hp - a.hp);
console.log('池 23 枚按 Hp 排序（多人卷夺1率，页面剂量）：');
for (const x of out) console.log('  ' + String(x.hp.toFixed(1)).padStart(5) + '%  ' + x.id.padEnd(22) + (x.tier || '').padEnd(6) + (x.note || ''));
const demoted = ['D1200-s13','DSTR4-s13','GD3ALL-POPP-s17','GD3ALL-G5-8p-s41'];
const dm = out.filter(x => demoted.includes(x.id)).map(x => x.hp);
const med = out.map(x => x.hp).sort((a,b)=>a-b)[11];
console.log('\n被降带的 4 枚 Hp = ' + dm.map(v=>v.toFixed(1)).join(' / ') + '  均值 ' + (dm.reduce((a,b)=>a+b,0)/dm.length).toFixed(1) + ' ‖ 全池中位 ' + med.toFixed(1));
