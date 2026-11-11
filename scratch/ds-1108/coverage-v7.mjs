
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const u = rd('scratch/ds-1108/card-usage.tsv');
const H = u[0], cards = H.slice(5);
const v7 = new Set(['Q-s47','T8-s114','U-s205']);
const rows = u.slice(1).filter(r => v7.has(r[0]));
const cov = {};
for (const r of rows) for (const k of cards) if ((+r[H.indexOf(k)] || 0) >= 0.5) cov[k] = (cov[k] || 0) + 1;
const used = Object.keys(cov);
console.log('v7 三枚并集覆盖 ' + used.length + ' 张：' + used.join(' '));
const pool = new Set(rd('champion-map/pool-members.tsv').slice(1).map(r => r[0]));
const prows = u.slice(1).filter(r => pool.has(r[0]));
const pcov = {};
for (const r of prows) for (const k of cards) if ((+r[H.indexOf(k)] || 0) >= 0.5) pcov[k] = (pcov[k] || 0) + 1;
console.log('池内已用但 v7 没用的：' + Object.keys(pcov).filter(k => !cov[k]).join(' '));
console.log('v7 用了但池内没人用的：' + Object.keys(cov).filter(k => !pcov[k]).join(' '));
