/* E 段标定 · 假如把"送盾刷屏"做成**选拔层 veto**（照 `rejectNarrowWinners`/`COLLAPSE_LINE` 的形状），线该画在哪、会砍到谁
 * 只读，不发臂。输入：`champion-map/holo.tsv`（裸包口径的 holo 出手/局）× `champion-map/pool-members.tsv`（现役 29 枚）× `coords.tsv`（全库 803 枚的 H）。
 * 为什么值得先算这个数：veto 的阈值必须**先有散布**才有意义（`COLLAPSE_LINE=0.60` 就是这么标定的），
 *   否则就是拍一个数然后发现"全池都被砍"或"一条都不触发"（本仓 `landedKeys<2` 那条恒真子书的教训）。
 * ⚑ 主语：这游戏里 **没有队友**（`js/core/state.js` 的 `opponentsOf` = 其余全部存活席），`holo` 是"给对手套盾"
 *   ⇒ "训练侧学会辅助"在这个规则下无定义；能被训练侧解决的是**少刷这张纯支出的牌**。
 * 用法：node docs/research/archive/2026-10-18-night2-prior-caliber/calibrate-gift-veto.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const rd = (p) => readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));

const CO = rd('champion-map/coords.tsv'), ch = Object.fromEntries(CO[0].map((h, i) => [h, i]));
const HO = rd('champion-map/holo.tsv'), hh = Object.fromEntries(HO[0].map((h, i) => [h, i]));
const PO = rd('champion-map/pool-members.tsv'), ph = Object.fromEntries(PO[0].map((h, i) => [h, i]));
for (const [name, idx, need] of [['coords', ch, ['id', 'H']], ['holo', hh, ['id', 'holoPerGame', 'holoOther']], ['pool', ph, ['id', 'tier']]]) {
  for (const c of need) if (idx[c] === undefined) { console.error('⛔ ' + name + ' 缺列 ' + c + ' ⇒ 这台标定读不到，别硬算'); process.exit(2); }
}

const poolTier = {};
for (const r of PO.slice(1)) if (r[ph.id]) poolTier[r[ph.id].trim()] = (r[ph.tier] || '').trim();
const gift = {}, other = {};
for (const r of HO.slice(1)) {
  const id = (r[hh.id] || '').trim(); if (!id) continue;
  gift[id] = Number(r[hh.holoPerGame] || 0); other[id] = Number(r[hh.holoOther] || 0);
}
const rows = [];
for (const r of CO.slice(1)) {
  const id = (r[ch.id] || '').trim(); if (!id) continue;
  if (gift[id] === undefined) continue;                 // 没测过 holo 的枚不进标定（"没登记"≠ 0）
  rows.push({ id, H: Number(r[ch.H] || 0), g: gift[id], o: other[id], tier: poolTier[id] || '' });
}
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))] : NaN; };
const gs = rows.map(r => r.g);
console.log('可标定枚数 ' + rows.length + '/803（`holo.tsv` 覆盖的那些；没登记的 ' + (803 - rows.length) + ' 枚不算进散布，免得把"没测"读成"零送盾"）');
console.log('裸包 holo 出手/局：中位 ' + q(gs, .5).toFixed(2) + ' ‖ P75 ' + q(gs, .75).toFixed(2) + ' ‖ P90 ' + q(gs, .90).toFixed(2)
  + ' ‖ P95 ' + q(gs, .95).toFixed(2) + ' ‖ P99 ' + q(gs, .99).toFixed(2) + ' ‖ max ' + Math.max.apply(null, gs).toFixed(2));
const zero = gs.filter(g => g === 0).length;
console.log('完全不打这张牌的枚数 ' + zero + '/' + rows.length + '（' + (100 * zero / rows.length).toFixed(1) + '%）');

for (const line of [2, 4, 6, 8]) {
  const cut = rows.filter(r => r.g > line);
  const inPool = cut.filter(r => r.tier);
  console.log('\n—— 若 veto 线 = 送盾 > ' + line + ' 次/局（裸包口径）：砍 ' + cut.length + ' 枚（' + (100 * cut.length / rows.length).toFixed(1) + '%）'
    + ' ‖ 其中现役池成员 ' + inPool.length + ' 枚（hard ' + inPool.filter(r => r.tier === 'hard').length + ' ‖ soft ' + inPool.filter(r => r.tier === 'soft').length + '）');
  const top = cut.sort((a, b) => b.g - a.g).slice(0, 8);
  console.log('   被砍得最狠的：' + top.map(r => r.id + ' ' + r.g.toFixed(1) + (r.tier ? '[' + r.tier + ']' : '') + ' H' + r.H.toFixed(1)).join(' ‖ '));
  const strong = cut.filter(r => r.H >= 55);
  console.log('   这些里 H ≥ 55 的 ' + strong.length + ' 枚 ⇒ 它们被砍掉会不会带走强度，要看 §E643 那条 `--ban=holo` 的消融结论，不看 H');
}
const pool = rows.filter(r => r.tier);
console.log('\n现役池 ' + pool.length + ' 枚的裸包送盾：中位 ' + q(pool.map(r => r.g), .5).toFixed(2) + ' ‖ 最大 '
  + Math.max.apply(null, pool.map(r => r.g)).toFixed(2) + ' ‖ 超 6 次/局的 ' + pool.filter(r => r.g > 6).length + ' 枚'
  + (pool.filter(r => r.g > 6).length ? '：' + pool.filter(r => r.g > 6).map(r => r.id + ' ' + r.g.toFixed(1) + '[' + r.tier + ']').join(' ‖ ') : ''));
console.log('\n⚑ 这条标定只回答"线画在哪会砍到多少枚"。它**不回答**"砍掉之后训练还推不推得动强度"——那句要臂（120 代 ≈ 80 秒/臂，配对 3 seed × 开关 = 6 臂 ≈ 8 分钟）。');
