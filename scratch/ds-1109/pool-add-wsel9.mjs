
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
const src = 'scratch/ds-1109/WSEL9-200.js', dst = 'docs/artifacts/night-adapt/WSEL9-200.js';
if (!existsSync(dst)) { copyFileSync(src, dst); console.log('复制 ' + dst); }
const P = 'champion-map/pool-members.tsv';
copyFileSync(P, P + '.bak-wsel9');
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ll = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = ll[0].split('\t'); const h = Object.fromEntries(H.map((x, i) => [x, i]));
if (ll.some(l => l.split('\t')[0] === 'WSEL9-200')) { console.log('已在池'); process.exit(0); }
const r = H.map(() => '');
const set = (k, v) => { r[h[k]] = String(v); };
set('id', 'WSEL9-200'); set('wid', widOf(readFileSync(dst, 'utf8'))); set('path', dst); set('tier', 'hard');
set('invited', '0'); set('promoteVerdict', ''); set('seatKill', '-1'); set('addedAt', new Date().toUTCString());
set('note', '11-09 午进硬带（SEL_CARDS=9 臂）：9 张卡 / 防御 29%（guard 9+reflect 3+bagua 17 三件全开）/ X̄₄ 0.325·0.333 / 场A 24.6% / 缺场B ⇒ 目前最接近「全方位」的一枚');
ll.push(r.join('\t'));
writeFileSync(P, ll.join(EOL) + EOL);
console.log('入池 WSEL9-200 → 池 ' + (ll.length - 1) + ' 枚');
