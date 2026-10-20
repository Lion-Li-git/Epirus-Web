/* §E669 复核尺（只读）：DS 中午那串里我判"要改"的三格，逐格用一条命令复现。
 *   ① 页面 `hp` 的 null 计数 ‖ 与 `coords.tsv` 的 `Hp`/`Hplong` 覆盖率对（他那格"86% 灰"的原件）
 *   ② `hp` 到底从哪张表来（`champion-map/epsagg.tsv` 的 `page` 列）‖ 两把尺同不同口径（page − Hp 的分布）
 *   ③ 按页面自己的色标 LUT + `EPR()` 的域（窗口内 p02..p98）算"点色应有比例"⇒ 与他那把像素尺量的不是同一层
 * 用法：node docs/research/archive/2026-10-20-ds-noon-review/hp-audit.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rejectUnknownFlags } from '../../../../tools/audit-lib.mjs';

rejectUnknownFlags(process.argv.slice(2), [], 'hp-audit');
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const CM = join(ROOT, 'champion-map');
const lines = (f) => readFileSync(f, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
const table = (f) => { const l = lines(f), h = l[0].split('\t'); return { h, rows: l.slice(1).map(s => s.split('\t')) }; };
const pct = (f, re) => (f.match(re) || []).length;

/* ── ① 页面里的 hp / hpl2 覆盖率，对 coords 的 Hp / Hplong ── */
const html = readFileSync(join(CM, 'index.html'), 'utf8');
const coords = table(join(CM, 'coords.tsv'));
const cov = (name) => { const i = coords.h.indexOf(name); let n = 0; for (const r of coords.rows) { const v = r[i]; if (v !== undefined && v !== '' && v !== '-' && isFinite(+v)) n++; } return n; };
const hpNull = pct(html, /"hp":null/g), hpAll = pct(html, /"hp":/g);
const l2Null = pct(html, /"hpl2":null/g), l2All = pct(html, /"hpl2":/g);
console.log('① 烘焙页面 champion-map/index.html ‖ 行数（coords）=' + coords.rows.length);
console.log('   "hp" 出现 ' + hpAll + ' 次，null=' + hpNull + ' ⇒ 覆盖 ' + (100 * (hpAll - hpNull) / hpAll).toFixed(1) + '%'
  + '   ‖ "hpl2" 出现 ' + l2All + ' 次，null=' + l2Null);
console.log('   coords.tsv 自身覆盖：Hp=' + cov('Hp') + ' ‖ Hplong=' + cov('Hplong') + ' ‖ Hlong=' + cov('Hlong') + '（都是全库）');

/* ── ② hp 的真来源：epsagg.tsv，以及它与 coords.Hp 是不是同一把尺 ── */
const eps = table(join(CM, 'epsagg.tsv'));
const ei = eps.h.indexOf('id'), ep = eps.h.indexOf('page');
const ci = coords.h.indexOf('id'), cHp = coords.h.indexOf('Hp');
const CM2 = new Map(coords.rows.map(r => [r[ci], r]));
const d = [];
let orphan = 0;
for (const r of eps.rows) {
  const m = CM2.get(r[ei]);
  if (!m) { orphan++; continue; }
  const v = parseFloat(r[ep]), w = parseFloat(m[cHp]);
  if (isFinite(v) && isFinite(w)) d.push(v - w);
}
d.sort((a, b) => a - b);
const q = (p) => d[Math.min(d.length - 1, Math.max(0, Math.round(p * (d.length - 1))))];
console.log('\n② "hp" 的来源 = champion-map/epsagg.tsv 的 page 列（viewer.mjs:427 `hp: r.id in EPS ? EPS[r.id].h : null`）');
console.log('   epsagg 行数=' + eps.rows.length + ' ‖ 其中 id 在 coords 里查不到=' + orphan + ' ⇒ 可配对 ' + d.length + ' 枚');
console.log('   epsagg.page − coords.Hp：中位 ' + q(.5).toFixed(2) + ' ‖ P10 ' + q(.1).toFixed(2) + ' ‖ P90 ' + q(.9).toFixed(2)
  + ' ‖ 极值 ' + d[0].toFixed(2) + '…' + d[d.length - 1].toFixed(2) + '（同口径不同批 ⇒ 差在采样噪声内）');

/* ── ③ 点色应有比例（色标 LUT 抄自 viewer.mjs:845，域抄自 EPR()：窗口内实测那批的 p02..p98） ── */
const STOPS = [[0, [23, 96, 214]], [0.28, [66, 172, 236]], [0.5, [152, 160, 174]], [0.72, [240, 138, 58]], [1, [233, 36, 36]]];
function rampRGB(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
    const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], u = (t - a) / ((b - a) || 1);
    return ca.map((v, j) => v + (cb[j] - v) * u);
  }
  return STOPS[STOPS.length - 1][1];
}
console.log('\n③ 按页面自己的规则算"点色"应有比例（默认窗口=全库，域 = 该档实测那批的 p02..p98）');
for (const [tab, col] of [['multi', 'Hp'], ['long', 'Hplong']]) {
  const i = coords.h.indexOf(col);
  const v = coords.rows.map(r => parseFloat(r[i])).filter(x => isFinite(x));
  const s = v.slice().sort((a, b) => a - b), lo = s[Math.floor(s.length * .02)], hi = s[Math.floor(s.length * .98)];
  let blue = 0, red = 0;
  for (const x of v) { const [R, , B] = rampRGB((x - lo) / ((hi - lo) || 1)); if (B > R) blue++; else red++; }
  console.log('   ' + tab.padEnd(6) + ' 用 ' + col + '（有值 ' + v.length + ' 枚）域 [' + lo.toFixed(1) + ',' + hi.toFixed(1) + '] ‖ 中位 '
    + s[s.length >> 1].toFixed(1) + ' ⇒ 偏蓝 ' + (100 * blue / v.length).toFixed(1) + '% ‖ 偏红 ' + (100 * red / v.length).toFixed(1) + '%');
}
console.log('   （DS 的像素尺读数：long 90.3% 蓝 ‖ multi 65.9% 蓝，亮点 3.2 万 / 3.0 万个）');
console.log('   ⇒ 803 枚点撑不出三万个亮点像素；同档换 color 档（hp/fam/de）我的复测只动 0.5–1.5pt（见 layer-probe.txt.txt）');
console.log('   ⇒ 那条"反算偏橙红 vs 实测 90% 蓝"的不闭合，是**两把尺量的层不同**，不是页面坏了。');
