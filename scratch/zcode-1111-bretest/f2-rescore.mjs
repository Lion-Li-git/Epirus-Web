#!/usr/bin/env node
/* F2 滚动夹具重评（11-11 06:1x · 用户令"看新冠军能不能入 B 轴把 G5 线拉下来 / 重跑综合分把两个离群点拉回正常"）
 *
 * 夹具 F2 = [MSB11-R2S306293884(0.2828 反墙线), MSB10-R1S1149480262(0.2002 bagua 线), MSB8-charge(0.1383), Q-s47(反墙锚)]
 * 留一法：夹具成员打"F2 减自己"（不被自打稀释）；非成员打全 F2。
 * C_F2 = (X̄₄P + X̄₄PB_F2)/2，X̄₄P：图上包取 coords 的 P2/P3/P5/P8（page dose 批读数），
 *        新包取 triplet 台账 X4P_S（同为 page/multi/R=100/seed=77000 口径）。
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';

const F2 = ['MSB11-R2S306293884', 'MSB10-R1S1149480262', 'MSB8-charge-R1S1861674281', 'Q-s47'];
const PATHS = {
  'G5J-50': 'scratch/ds-1109/G5J-50.js', 'G5C-100': 'scratch/ds-1109/G5C-100.js', 'WSEL9-200': 'scratch/ds-1109/WSEL9-200.js',
  'CTRL2-Q-s7': 'docs/artifacts/night-adapt/CTRL2-Q-s7.js', 'KDG-B-Q-s13': 'docs/artifacts/night-adapt/KDG-B-Q-s13.js', 'FOCUS-Q-s13': 'docs/artifacts/night-adapt/FOCUS-Q-s13.js',
  'MSB11-R2S306293884': 'docs/artifacts/night-adapt/MSB11-R2S306293884.js', 'MSB10-R1S1149480262': 'docs/artifacts/night-adapt/MSB10-R1S1149480262.js',
  'MSB8-charge-R1S1861674281': 'docs/artifacts/night-adapt/MSB8-charge-R1S1861674281.js', 'MSB8-bagua-R1S88974978': 'docs/artifacts/night-adapt/MSB8-bagua-R1S88974978.js',
  'MSB6-R2S501866988': 'docs/artifacts/night-adapt/MSB6-R2S501866988.js', 'MSB9-R2S443656264': 'docs/artifacts/night-adapt/MSB9-R2S443656264.js',
};
const NS = [2, 3, 5, 8], W4 = [0.15, 0.25, 0.45, 0.15];
const x4 = (arr) => W4.reduce((s, w, i) => s + w * arr[i], 0);   /* arr = [x2,x3,x5,x8] 0 基 */

/* A 轴：图上包 = coords P2/P3/P5/P8（page dose）；新包 = triplet 台账 X4P_S 的 cells */
const A = {};
{
  const co = readFileSync('champion-map/coords-gen3-1105.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map((l) => l.split('\t'));
  const h = Object.fromEntries(co[0].map((x, i) => [x, i]));
  for (const id of Object.keys(PATHS)) {
    const r = co.find((r) => r[h.id] === id);
    if (r && r[h.P2] !== undefined && r[h.P2] !== '') A[id] = NS.map((n) => +r[h['P' + n]]);
  }
  const led = readFileSync('scratch/night-adapt2/triplet-ledger.tsv', 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  for (const id of Object.keys(PATHS)) {
    if (A[id]) continue;
    const row = led.reverse().find((r) => r.pack && r.pack.endsWith('/' + id + '.js'));
    if (row) A[id] = row.cells_S;
  }
}
for (const id of Object.keys(PATHS)) if (!A[id]) { console.error('⛔ ' + id + ' 没有 A 轴读数'); process.exit(2); }

const OUT = new URL('./f2-rescore.tsv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
if (existsSync(OUT)) { console.error('⛔ ' + OUT + ' 已存在'); process.exit(2); }
writeFileSync(OUT, ['id', 'inF2', 'x2', 'x3', 'x5', 'x8', 'X4PB_F2', 'X4P_A', 'C_F2', 'C_map'].join('\t') + '\n', 'utf8');

/* 图上 C（旧尺）取 coords 的 C2 列（multi 页面级均值） */
const co = readFileSync('champion-map/coords-gen3-1105.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map((l) => l.split('\t'));
const h = Object.fromEntries(co[0].map((x, i) => [x, i]));
const cmap = (id) => { const r = co.find((r) => r[h.id] === id); return r && r[h.C2] ? +r[h.C2] : NaN; };

function runOne(id) {
  const champ = F2.includes(id) ? F2.filter((x) => x !== id) : F2;
  return new Promise((res) => {
    execFile(process.execPath, ['tools/exam-4n.mjs', '100', '77000', PATHS[id], '--exam=B', '--dose=page', '--champ=' + champ.join(',')],
      { encoding: 'utf8', maxBuffer: 1 << 24, timeout: 300000 }, (e, so) => {
        const line = (so || '').split(/\r?\n/).find((l) => l.indexOf('[冠军4N-B]') === 0);
        if (!line) { console.error('⛔ ' + id + ' 无读数'); return res(); }
        const get = (k) => { const m = line.match(new RegExp(' ' + k + '=([-0-9.]+)')); return m ? +m[1] : NaN; };
        const cells = NS.map((n) => get('x' + n));
        const b = x4(cells), c = (x4(A[id]) + b) / 2;
        appendFileSync(OUT, [id, F2.includes(id) ? 'Y' : 'N', ...cells, b.toFixed(4), x4(A[id]).toFixed(4), c.toFixed(4), cmap(id) ?? ''].join('\t') + '\n', 'utf8');
        console.error(id.padEnd(26) + ' B_F2=' + b.toFixed(4) + '  A=' + x4(A[id]).toFixed(4) + '  ⇒ C_F2=' + c.toFixed(4) + '  (旧图 C2=' + (cmap(id) ?? '—') + ')');
        res();
      });
  });
}
const q = Object.keys(PATHS).slice();
await Promise.all(Array.from({ length: 4 }, async () => { while (q.length) await runOne(q.shift()); }));
console.error('完成 → ' + OUT);
