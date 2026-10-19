/* §E666 · 把 `eval-5p --dump-per` 的逐桌子落盘拆成"逐对手池"的配对差（预注册 = PREREG-2026-10-20-pool-split-qoder.md）
 * 只读 `pool-split/gv{0,1}-{77000,77001,77002}.per.txt`（35 组 × 200 局），**不重跑、不编辑 `eval-5p.mjs`**。
 * 三件必须先过的事（写在代码里，不过就退出）：
 *   ① **配对身份**：两臂的 `idx` 与 `names` 必须逐位相同（不同就是两批桌子，不许配对 ⇒ 直接停）；
 *   ② **总电平复现**：从落盘算出的每臂总 1st 率，必须与 `eval-5p` 自己 stdout 印的那行对上（对不上 ⇒ 我聚合写错）；
 *   ③ **恒等式**：对每个池 p，`在场场数 + 不在场场数 = 7000` ‖ `在场 first + 不在场 first = 总 first`。
 * 用法：node docs/research/archive/2026-10-20-night-d15-gates/pool-split-analyze.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const HERE = import.meta.dirname;
const D = p => path.join(HERE, 'pool-split', p);
const SEEDS = [77000, 77001, 77002];
const E650 = { 77000: null, 77001: [57.8, 57.8], 77002: [60.6, 55.5] };   // §E650 印过的 (关, 开)；77000 那格的关档电平我没存 stdout ⇒ 只报从落盘算出的
function load(arm, seed) {
  const f = D('gv' + arm + '-' + seed + '.per.txt');
  if (!existsSync(f)) { console.error('⛔ 落盘不在：' + f); process.exit(2); }
  const rows = [];
  for (const ln of readFileSync(f, 'utf8').split('\n')) {
    if (ln[0] === '#' || !ln.trim()) continue;
    const c = ln.split('\t');
    if (c[0] !== 'subject') continue;
    rows.push({ idx: +c[1], names: c[2], games: +c[3], first: +c[4] });
  }
  rows.sort((a, b) => a.idx - b.idx);
  return { rows, hdr: readFileSync(f, 'utf8').split('\n').filter(l => l[0] === '#').join(' ') };
}
const pct = (f, g) => (g ? (100 * f / g) : NaN);
console.log('读 6 份落盘（35 组 × 200 局 = 7,000 场/臂）‖ 只取 arm=subject');
const perSeed = {};
for (const s of SEEDS) {
  const off = load(0, s), on = load(1, s);
  /* ① 配对身份 */
  if (off.rows.length !== on.rows.length || off.rows.some((r, i) => r.idx !== on.rows[i].idx || r.names !== on.rows[i].names)) {
    console.error('⛔ seed=' + s + ' 两臂的桌子名单不逐位相同 ⇒ **不是同一批桌子**，不许配对（这不是"效应消失"，是配不上对）'); process.exit(2);
  }
  const tot = a => { const g = a.rows.reduce((x, r) => x + r.games, 0), f = a.rows.reduce((x, r) => x + r.first, 0); return { g, f, r: pct(f, g) }; };
  const tOff = tot(off), tOn = tot(on);
  /* ② 总电平：与 stdout 的那行对（能取到的话） */
  for (const [lbl, st, t] of [['关', 'gv0-' + s + '.stdout.txt', tOff], ['开', 'gv1-' + s + '.stdout.txt', tOn]]) {
    const f = D(st);
    if (existsSync(f)) {
      const m = /^\[冠军\] 1st=([\d.]+)%/m.exec(readFileSync(f, 'utf8'));
      const okk = m && Math.abs(+m[1] - t.r) < 0.05;
      console.log('② seed ' + s + ' ' + lbl + '档 落盘合计 ' + t.r.toFixed(1) + '% ‖ stdout ' + (m ? m[1] + '%' : '读不到') + (m ? ' ⇒ ' + (okk ? '✔ 对上' : '**⚠ 对不上**') : ''));
      if (m && !okk) { console.error('⛔ 聚合与工具自己印的不一致 ⇒ 停'); process.exit(2); }
    }
  }
  const d = tOn.r - tOff.r;
  console.log('   seed ' + s + ' ‖ 关 ' + tOff.r.toFixed(2) + '% (n=' + tOff.g + ') ‖ 开 ' + tOn.r.toFixed(2) + '% ‖ 配对总 Δ=' + (d >= 0 ? '+' : '') + d.toFixed(2) + 'pt' +
    (E650[s] ? ' ‖ §E650 印过 (' + E650[s][0] + ', ' + E650[s][1] + ') Δ=' + (E650[s][1] - E650[s][0]).toFixed(2) + (Math.abs(d - (E650[s][1] - E650[s][0])) < 0.05 ? ' ✔复现' : ' ⚠不等') : ' ‖ §E650 未印这一格的关档电平'));
  if (Math.abs(d) < 1e-9 && s !== 77001) console.log('   ⚑ 这一格差恒为零 ⇒ 结构零（两臂同一粒权重），**不进配对均值**');
  /* ③ 逐池拆分 */
  const pools = {};
  for (const r of off.rows) for (const p of r.names.split(',')) (pools[p] = pools[p] || { g: 0, f0: 0, f1: 0, diffs: [] });
  for (let i = 0; i < off.rows.length; i++) {
    const a = off.rows[i], b = on.rows[i];
    const perTable = (a.first / a.games - b.first / b.games) * 100;    // 每张桌子的配对差（关−开，pt）
    for (const p of a.names.split(',')) { pools[p].g += a.games; pools[p].f0 += a.first; pools[p].f1 += b.first; pools[p].diffs.push(perTable); }
  }
  for (const p of Object.keys(pools)) {
    const x = pools[p];
    const gi = tOff.g - x.g, absent0 = tOff.f - x.f0, absent1 = tOn.f - x.f1;
    if (x.g + gi !== tOff.g || Math.round(x.f0 + absent0) !== tOff.f) { console.error('⛔ 池 ' + p + ' 的恒等式不过 ⇒ 停'); process.exit(2); }
    const n = x.diffs.length, mean = x.diffs.reduce((a, v) => a + v, 0) / n;
    const sd = Math.sqrt(x.diffs.reduce((a, v) => a + (v - mean) * (v - mean), 0) / (n - 1));
    const se = sd / Math.sqrt(n);
    x.mean = mean; x.se = se; x.inRate0 = pct(x.f0, x.g); x.outRate0 = pct(absent0, gi); x.inRate1 = pct(x.f1, x.g); x.split = true;
  }
  perSeed[s] = { pools, tOff, tOn };
}
/* 判线（PREREG §三 ‖ 含 07:5x 的**符号更正**：正 = 开档掉分）：两格同号为正，且至少一格过 1.96·SE */
console.log('\n逐对手池（在场桌子的配对差 = 关 − 开，**正 = 开档在这些桌子上掉分**；单位 pt）');
const names = Object.keys(perSeed[77000].pools).sort();
const verdict = {};
const means = { };
for (const p of names) {
  const cells = SEEDS.filter(s => s !== 77001).map(s => perSeed[s].pools[p]);   // 77001 = 结构零 ⇒ 不进判据
  const line = cells.map(c => 'Δ' + (c.mean >= 0 ? '+' : '') + c.mean.toFixed(2) + '±' + (1.96 * c.se).toFixed(2)).join('  ‖  ');
  const sameLoss = cells.every(c => c.mean > 0);
  const overAny = cells.some(c => Math.abs(c.mean) >= 1.96 * c.se);
  verdict[p] = sameLoss && overAny;
  means[p] = cells.map(c => c.mean);
  console.log('  ' + p.padEnd(11) + ' 在场 ' + cells[0].g + ' 场/臂（20/35 张桌子） ‖ ' + line + ' ‖ ' +
    (verdict[p] ? '满足判线（同号掉分且过 95% 线）' : (sameLoss ? '同号但都不过线' : '不同号')));
}
/* 免费恒等式：每张桌子含 4/7 个池 ⇒ 七池均值的算术平均必须等于该格总 Δ（漏桌/重桌都会让它对不上） */
for (const [i, s] of SEEDS.filter(x => x !== 77001).entries()) {
  const arr = names.map(p => means[p][i]);
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const tot = (perSeed[s].tOn.r - perSeed[s].tOff.r) * -1;   // 关−开
  console.log('  ⚑ 自检 格' + (i + 1) + '：七池均值 ' + avg.toFixed(3) + 'pt ‖ 该格总 Δ(关−开) ' + tot.toFixed(3) + 'pt ⇒ ' +
    (Math.abs(avg - tot) < 0.02 ? '**咬合**' : '**不咬合 ⇒ 拆分有漏桌/重桌，本节作废**'));
}
const hit = names.filter(p => verdict[p]);
console.log('\n判读：满足判线的池 = ' + (hit.length === 7 ? '**七个池全部**（⇒ 不存在"某一个池"可选）' +
  (hit.length ? '：' + hit.join(' ‖ ') : '') : hit.length ? hit.join(' ‖ ') : '**无**'));
console.log('⇒ 按更正后的线，这一条的实质结果就是原线第二行想抓的那种：**掉分不挑对手池，是整张桌子上都掉**（各池之间的量级差互相落在 ±3~4.5pt 的误差带里 ⇒ 不许排座次）。');
console.log('⚑ 边界（PREREG §三.③）：以上是**条件差值**（在场桌子 vs 其它桌子本来就不同批），不是因果；有效起点仍是**一枚谱系的 3 粒 seed**。');
