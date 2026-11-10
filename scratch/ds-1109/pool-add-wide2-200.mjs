
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
const src = 'scratch/ds-1109/WIDE2-200.js', dst = 'docs/artifacts/night-adapt/WIDE2-200.js';
if (!existsSync(dst)) { copyFileSync(src, dst); console.log('复制 ' + dst); }
const P = 'champion-map/pool-members.tsv';
copyFileSync(P, P + '.bak-wide2-200');
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ll = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = ll[0].split('\t'); const h = Object.fromEntries(H.map((x, i) => [x, i]));
if (ll.some(l => l.split('\t')[0] === 'WIDE2-200')) { console.log('已在池'); process.exit(0); }
const r = H.map(() => '');
const set = (k, v) => { r[h[k]] = String(v); };
set('id', 'WIDE2-200'); set('wid', widOf(readFileSync(dst, 'utf8'))); set('path', dst); set('tier', 'soft');
set('invited', '0'); set('promoteVerdict', ''); set('seatKill', '-1'); set('addedAt', new Date().toUTCString());
set('note', '11-09 午进软带（宽包参照）：100 代延展到 200 代后 9 张卡 / 防御 26%（bagua 18%/guard 5%/holo 3%）/ X̄₄ 0.250·0.352 / 场A 20.1% / 缺场B；300 代又窄回 7 张（0.191·0.307、G 2.73 红）⇒ 200 代是这条延展线的峰值');
ll.push(r.join('\t'));
writeFileSync(P, ll.join(EOL) + EOL);
console.log('入池 WIDE2-200 → 池 ' + (ll.length - 1) + ' 枚');
