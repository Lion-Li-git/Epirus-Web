/* 一次性探针（§E329 之后查图）：从已构建的 index.html 里读出内联 DATA，回答四件事
 *   ① 父链那枚 E51-t8-713 到底进没进 DATA、有没有 fam/ts（谱系图不画的直接原因）
 *   ② 现役的 182 支子代的 ts 是不是全挤在同一秒（用户："一堆点全重合"）
 *   ③ 颜色：F 与 Hp 两把尺的**分位数**，看"中位点"现在落在色带的哪一格（用户："红比蓝多、都堆在灰偏红"）
 *   ④ 底图 IDW 的接缝：算一下网格上"最近点距离"的分布，看凹陷是不是来自单点独占格
 * 用法：node champion-map/_probe-e330.mjs        （只读，不写任何文件）
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, 'index.html'), 'utf8');
const m = /var DATA = (\[[^\n]*\]);/.exec(src);
if (!m) { console.log('⛔ 没在 index.html 里找到单行的 var DATA = [...]'); process.exit(2); }
const D = JSON.parse(m[1]);
const q = id => D.find(d => d.id === id);
console.log('DATA ' + D.length + ' 枚 ‖ fam 空 ' + D.filter(d => !d.fam).length + ' ‖ ts 空 ' + D.filter(d => !d.ts).length);
for (const id of ['E51-t8-713', 'SHIPPED-Ldemo', 'D4a', 'M05-111', 'E20-71', 'blk1t40-s71']) {
  const d = q(id);
  console.log('  ' + id.padEnd(16) + (d ? ' fam=' + (d.fam || '(无)') + ' ts=' + (d.ts || '(无)') + ' kin=' + (d.kin || '-') + ' lin=' + (d.lin || '-') : ' ⛔ 不在 DATA'));
}
const kin = D.filter(d => d.kin === '续训现役');
const buck = {};
for (const d of kin) { const k = (d.ts || '(空)').slice(0, 16); buck[k] = (buck[k] || 0) + 1; }
const top = Object.entries(buck).sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('\n子代 ' + kin.length + ' 枚按 ts(分钟) 分桶，最挤的 8 桶：');
for (const [k, v] of top) console.log('  ' + k + '  ×' + v);
console.log('  ⇒ 不同时间戳只有 ' + Object.keys(buck).length + ' 个（182 枚 / ' + Object.keys(buck).length + ' 桶）');
const pct = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const F = D.map(d => d.Hp / 100 + 0.1 * d.S), HP = D.map(d => d.Hp);
const inc = q('SHIPPED-Ldemo');
console.log('\n颜色分位（F = Hp/100 + T·S，T=0.1）：p05 ' + pct(F, .05).toFixed(3) + ' ‖ p25 ' + pct(F, .25).toFixed(3) +
  ' ‖ **中位 ' + pct(F, .5).toFixed(3) + '** ‖ p75 ' + pct(F, .75).toFixed(3) + ' ‖ p95 ' + pct(F, .95).toFixed(3) +
  ' ‖ min ' + Math.min.apply(null, F).toFixed(3) + ' ‖ max ' + Math.max.apply(null, F).toFixed(3));
console.log('现役 F = ' + (inc.Hp / 100 + 0.1 * inc.S).toFixed(3) + ' ‖ 线性色带下中位点的归一化位置 = ' +
  ((pct(F, .5) - Math.min.apply(null, F)) / (Math.max.apply(null, F) - Math.min.apply(null, F))).toFixed(3) +
  '  ⇒ 0.5 才叫中性，越接近 1 就越红（用户看到的"堆在灰偏红"）');
console.log('页面口径 Hp 的分位：p05 ' + pct(HP, .05).toFixed(1) + ' ‖ p25 ' + pct(HP, .25).toFixed(1) + ' ‖ 中位 ' + pct(HP, .5).toFixed(1) +
  ' ‖ p75 ' + pct(HP, .75).toFixed(1) + ' ‖ p95 ' + pct(HP, .95).toFixed(1));
