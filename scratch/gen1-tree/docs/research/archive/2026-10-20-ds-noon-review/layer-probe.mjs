/* §E669 取证：DS 那句"长程档 90.3% 偏蓝"数的是**点色**还是**整页底色**？
 * 做法：同一张图换颜色档（color=hp vs color=fam），如果"偏蓝比例"几乎不动 ⇒ 那把像素尺读的不是点色层。
 * 再对照"按页面自己的 DATA 用同一条色标算出来的应有比例"（那份算法在 viewer.mjs:1004 + EPR()）。
 * 只读：只起无头 Chrome 截图，不改任何文件。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from '../2026-10-19-tree-band-grey/png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');   /* archive/<本目录> → 上四级才是仓根（这一处数错过一次：数少一级就变成 docs/，报'找不到 shot.mjs'） */
const OUT = join(HERE, 'shots');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const CASES = [
  ['long', 'hp'], ['long', 'fam'], ['multi', 'hp'], ['multi', 'fam'], ['long', 'de'], ['multi', 'de'],
];
for (const [tab, col] of CASES) {
  const f = join(OUT, tab + '-' + col + '.png');
  const r = spawnSync(process.execPath, [join(ROOT, 'champion-map', 'shot.mjs'),
    '--hash=' + 'ftab=' + tab + '&color=' + col, '--out=' + f], { cwd: ROOT, encoding: 'utf8' });
  if (!existsSync(f)) { console.error('截图没出来：' + tab + '/' + col + ' rc=' + r.status + ' ‖ ' + (r.stderr || r.stdout || '').slice(0, 200)); process.exit(2); }
}

function measure(file) {
  const img = decode(file);
  const { W, H, ch, px } = img;
  let n = 0, blue = 0, red = 0, gray = 0, dim = 0, tot = W * H;
  const hist = {};
  for (let i = 0; i < tot; i++) {
    const o = i * ch;
    const R = px[o], G = px[o + 1], B = px[o + 2], A = ch === 4 ? px[o + 3] : 255;
    if (A < 40) continue;
    const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    if (lum < 60) { dim++; continue; }            // DS 那句"滤掉暗背景后采样亮点"
    n++;
    if (B > R) blue++; else if (R > B) red++;
    if (Math.abs(R - G) < 12 && Math.abs(G - B) < 12) gray++;
    const k = [R >> 5, G >> 5, B >> 5].join(',');
    hist[k] = (hist[k] || 0) + 1;
  }
  const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, v]) => '[' + k.split(',').map(x => String((+x) * 32 + 16)).join(',') + ']×' + (100 * v / n).toFixed(1) + '%');
  return { W, H, n, dim, blue: 100 * blue / n, red: 100 * red / n, gray: 100 * gray / n, top };
}
console.log('\n=== 像素侧（亮点=亮度>60 ‖ 偏蓝=B>R ‖ 图 ' + '1600×900）===');
for (const [tab, col] of CASES) {
  const m = measure(join(OUT, tab + '-' + col + '.png'));
  console.log('  ' + tab.padEnd(6) + ' color=' + col.padEnd(4) + ' 亮点 ' + String(m.n).padStart(6) + '（暗 ' + (100 * m.dim / (m.W * m.H)).toFixed(0) + '% 被滤）'
    + ' ‖ 偏蓝 ' + m.blue.toFixed(1) + '% ‖ 偏红 ' + m.red.toFixed(1) + '% ‖ 近灰 ' + m.gray.toFixed(1)
    + '% ‖ 主色 ' + m.top.join(' '));
}
console.log('\n读法：同一档里换 color 若"偏蓝%"几乎不动 ⇒ 这把像素尺量的不是点色层（换色标没换到手）。');
