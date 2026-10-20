/* §E671 像素侧：改完之后，画布上"未测灰"还剩多少（两档各拍一张，数点色 = #5a6478 的像素）。
 * 只读：只截图与数像素，不改任何文件。截图落 shots/（.gitignore 不收 ⇒ 结果抄进同目录的 .txt.txt）。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from '../2026-10-19-tree-band-grey/png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const OUT = join(HERE, 'shots');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const CASES = [['multi', 'hp'], ['long', 'hp'], ['multi', 'de']];
for (const [tab, col] of CASES) {
  const f = join(OUT, tab + '-' + col + '.png');
  const r = spawnSync(process.execPath, [join(ROOT, 'champion-map', 'shot.mjs'),
    '--hash=' + 'mode=map&ftab=' + tab + '&color=' + col, '--out=' + f], { cwd: ROOT, encoding: 'utf8' });
  if (!existsSync(f)) { console.error('截图没出来：' + tab + '/' + col + ' rc=' + r.status + ' ‖ ' + (r.stderr || r.stdout || '').slice(0, 200)); process.exit(2); }
}
const GRAY = [90, 100, 120];
console.log('\n=== 画布上的点色（#5a6478 = 页面自己给"这一档没读数"的那个灰）===');
for (const [tab, col] of CASES) {
  const { W, H, ch, px } = decode(join(OUT, tab + '-' + col + '.png'));
  let n = 0, gray = 0, tot = W * H;
  for (let i = 0; i < tot; i++) {
    const o = i * ch, R = px[o], G = px[o + 1], B = px[o + 2], A = ch === 4 ? px[o + 3] : 255;
    if (A < 40) continue;
    if (0.2126 * R + 0.7152 * G + 0.0722 * B < 60) continue;      /* 暗背景不算点 */
    n++;
    if (Math.abs(R - GRAY[0]) <= 6 && Math.abs(G - GRAY[1]) <= 6 && Math.abs(B - GRAY[2]) <= 6) gray++;
  }
  console.log('  ' + (tab + '/' + col).padEnd(10) + ' 亮点 ' + String(n).padStart(6) + ' ‖ 未测灰像素 ' + String(gray).padStart(6) + '（' + (100 * gray / n).toFixed(2) + '%）');
}
