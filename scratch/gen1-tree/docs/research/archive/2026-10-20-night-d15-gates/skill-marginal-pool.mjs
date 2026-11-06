/* §E665 · 把三份 `probe-skill-marginal` 日志汇成一张"跨包 × 跨档 × 跨起点"的边际表
 * 为什么单独要这一台：单次 run 的"判定"列会被**换 seed 的基线摆动**翻掉（本次实测出现过 −9.0 判"噪声内"、−6.5 判"可测"）
 *   ⇒ 所以**不采信单格判定**，改成看"几个独立起点里同号几格"（这是 §E663 之后自己踩出来的修法）。
 * 输入（同一目录）：skill-marginal-82-seeds.log.txt ‖ skill-marginal-sisters.log.txt ‖ skill-marginal-families.log.txt
 * 用法：node docs/research/archive/2026-10-20-night-d15-gates/skill-marginal-pool.mjs
 * 只读。
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const HERE = import.meta.dirname;
const FILES = [['skill-marginal-82-seeds.log.txt', 'v7beadseed-82'],   // 这份脚本没写 pack=（用缺省包），所以在这里补上归属
  ['skill-marginal-sisters.log.txt', null], ['skill-marginal-families.log.txt', null]]
  .map(([f, defPack]) => ({ path: path.join(HERE, f), defPack })).filter(x => existsSync(x.path));
const rows = [];
for (const { path: f, defPack } of FILES) {
  let cur = null;
  for (const ln of readFileSync(f, 'utf8').split('\n')) {
    let m = ln.match(/(?:pack=(\S+)\s+)?mode=(\w+)\s+seed=(\d+)/);
    if (m) { cur = { pack: m[1] || defPack || '?', mode: m[2], seed: m[3] }; continue; }
    m = ln.match(/基线1st=([\d.]+)% 噪声地板=([\d.]+)pt/);
    if (m && cur) { cur.base = +m[1]; cur.noise = +m[2]; continue; }
    m = ln.match(/^  (全息屏障|反弹)\s+\d\s+([\d.]+)\s+([\d.]+)\s+([+-][\d.]+)\s+([\d.]+)\s+([+-][\d.]+)\s+(\d+)%/);
    if (m && cur) rows.push({ pack: cur.pack, mode: cur.mode, seed: cur.seed, name: m[1],
      ch: +m[2], hit: +m[3], d: +m[4], se: +m[5], dd: +m[6], ok: +m[7], base: cur.base, noise: cur.noise });
  }
}
if (!rows.length) { console.error('⛔ 三份日志都没读到行 ⇒ 这不是"没有效应"，是**没跑成**'); process.exit(2); }
const packs = [...new Set(rows.map(r => r.pack))];
console.log('汇入 ' + rows.length + ' 格 ‖ 包 ' + packs.length + ' 枚（' + packs.join(' ‖ ') + '）‖ 每包 2 档 × 4 颗种子');
const sum = (name, mode) => {
  const rs = rows.filter(r => r.name === name && r.mode === mode);
  const byPack = {};
  for (const r of rs) (byPack[r.pack] = byPack[r.pack] || []).push(r.d);
  const neg = rs.filter(r => r.d < 0).length, pos = rs.filter(r => r.d > 0).length, zero = rs.filter(r => r.d === 0).length;
  const ddneg = rs.filter(r => r.dd < 0).length;
  const ds = rs.map(r => r.d).sort((a, b) => a - b);
  console.log('  ' + name + ' @' + mode.padEnd(6) + ' ‖ n=' + rs.length + ' 格（' + Object.keys(byPack).length + ' 枚包）' +
    ' ‖ 负 ' + neg + ' ‖ 正 ' + pos + ' ‖ 零 ' + zero + ' ‖ Δ伤害为负 ' + ddneg + '/' + rs.length +
    ' ‖ 中位 ' + ds[Math.floor(ds.length / 2)].toFixed(1) + ' ‖ 极值 ' + ds[0].toFixed(1) + '…' + ds[ds.length - 1].toFixed(1));
  return { rs, byPack };
};
for (const name of ['全息屏障', '反弹']) for (const mode of ['multi', 'long']) {
  const { byPack } = sum(name, mode);
  for (const p of Object.keys(byPack)) {
    const a = byPack[p].slice().sort((x, y) => x - y);
    console.log('      · ' + p.padEnd(15) + ' 4 起点 Δ1st = ' + byPack[p].map(x => (x >= 0 ? '+' : '') + x.toFixed(1)).join(' ') +
      ' ‖ 中位 ' + a[Math.floor(a.length / 2)].toFixed(1) + ' ‖ 全同号 = ' + (a.every(x => x <= 0) || a.every(x => x >= 0)));
  }
}
/* 判定列的反序：把"判过线的格"与"被地板压住的格"一起数出来（这条是给文案那处不一致记账用的） */
const blocked = rows.filter(r => Math.abs(r.d) > 2.8 * r.se && Math.abs(r.d) <= Math.max(r.noise * 1 || 0, 2 * r.se));
console.log('\n⚑ 判定列会被"换 seed 的基线摆动"压住的格数 = ' + blocked.length + '（|Δ| 已过 2.8·SE 却没过 max(地板, 2·SE)）' +
  ' ‖ 这些格**单次 run 会印"噪声内"**，但在跨起点的表里看得见方向');
console.log('⚑ 分母：' + packs.length + ' 枚包里 beadseed 家族占 3 枚（82/31/93 是同族姊妹 ⇒ **不是三个独立起点**）；teach/expo/wall 是另外三支。');
