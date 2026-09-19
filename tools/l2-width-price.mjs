/* 宽度（G 有效技能数）到底贵不贵 —— §28a 那张表的生成器
 * 背景：用户提出"当初设吉布斯自由能是为了平衡强度与熵效应；既然加深 ep 对强度负影响不大，
 *   那可以略微降低强度换宽度"。这句里"降低强度"是要先量的半边 —— 新引擎下重跑就是本工具。
 * 输入（都用 env 指，默认夜里那一份）：
 *   AUDIT=docs/artifacts/audit-newengine.log   champ-audit 输出（G 列 = "5.47 (12种)"）
 *   CROWD1 / CROWD2 / MATRIX 同 l2-epdepth-axis.mjs
 * 用法：node tools/l2-width-price.mjs        （新旧引擎并排：AUDIT=... MATRIX=... 各跑一次）
 * ⚠ 单位是"包"，同臂不同 seed 不独立 ⇒ 只读方向与量级，不读显著性（§13a 的教训）。
 */
import { readFileSync, existsSync } from 'node:fs';
const CROWD1 = process.env.CROWD1 || 'docs/artifacts/crowd-random.log';
const CROWD2 = process.env.CROWD2 || 'docs/artifacts/crowd-balanced.log';
const MATRIX = process.env.MATRIX || 'docs/l2-eval-matrix-120.tsv';
const AUDIT = (process.env.AUDIT || 'docs/artifacts/audit-newengine.log').split(',');
for (const f of [CROWD1, CROWD2, MATRIX]) if (!existsSync(f)) throw new Error('缺输入：' + f);
const norm = s => (s || '').replace(/^.*\//, '').replace(/\.bak$/, '').replace('bundled-champion-3p.js', 'LIVE')
  .replace('bundled-champion-3p', 'LIVE').replace('线上包', 'LIVE');
function crowd(file, col) {
  const o = {};
  for (const l of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(l);
    if (!m || m[1].startsWith('包')) continue;
    o[norm(m[1])] = Number(m[1 + col]);
  }
  return o;
}
const V1 = crowd(CROWD1, 1), V2 = crowd(CROWD2, 1), V4 = crowd(CROWD2, 3);
const EX = {};
for (const l of readFileSync(MATRIX, 'utf8').split(/\r?\n/).filter(x => x.includes('\t'))) {
  const p = l.split('\t'), nm = norm(p[0]);
  const v = Number((/1st=([\d.]+)%/.exec(p[2]) || [0, 0])[1]) - Number((/([\d.]+)%/.exec(p[4]) || [0, 0])[1]);
  (EX[nm] = EX[nm] || {})[p[1]] = v;
}
/* G：champ-audit 的 "5.47 (12种)" 那一列（表头列名之间是单空格 ⇒ 只能按"形状"找，别按列位） */
const G = {};
for (const f of AUDIT) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const nm = /^\s*(\S+?\.bak|js\/bundled-champion-3p\.js|\S+)\s/.exec(l);
    const gm = l.split(/\s{2,}/).map(x => /^([\d.]+) \((\d+)种\)/.exec(x.trim())).find(Boolean);
    const key = norm((nm || [])[1] || '');
    if (gm && key && G[key] == null) G[key] = Number(gm[1]);
  }
}
G.LIVE = G.LIVE;   // 来自 audit 的 "js/bundled-champion-3p.js" 行（新冠军）
function corr(xs, ys) {
  const n = xs.length; if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { const p = xs[i] - mx, q = ys[i] - my; a += p * q; b += p * p; c += q * q; }
  return a / Math.sqrt(b * c || 1);
}
console.log(`输入：AUDIT=${AUDIT.join(',')}  MATRIX=${MATRIX}`);
const keys0 = Object.keys(G).filter(k => V1[k] != null && V2[k] != null && EX[k] && EX[k]['A卷'] != null);
/* WIDTH_FILTER=正则 ⇒ 只取某一批包。§13a 的教训：跨批相关可能是"世代/臂"效应而不是包级规律，
 * 所以报 r(G,·) 之前必须先在批内各看一遍（夜里的 53 个 v7l2 系与 ds 的 36 个 v7press/v7fix1/v7noteach 系不同代）。 */
const RF = process.env.WIDTH_FILTER ? new RegExp(process.env.WIDTH_FILTER) : null;
const keys = RF ? keys0.filter(k => RF.test(k)) : keys0;
console.log(`=== 宽度 G 对各轴的代价（n=${keys.length} 个包${RF ? `，WIDTH_FILTER=/${process.env.WIDTH_FILTER}/` : ''}；单位=包，同臂 seed 不独立 ⇒ 只读方向）===`);
const AX = { 'V1 打乱局': k => V1[k], 'V2 打整局': k => V2[k], 'V4 成群打整局': k => V4[k], 'A 卷': k => EX[k]['A卷'], 'targeter': k => EX[k].TN };
for (const [nm, f] of Object.entries(AX)) {
  const r = corr(keys.map(k => G[k]), keys.map(f));
  console.log(`  r(G, ${nm.padEnd(13)}) = ${r.toFixed(2)}`);
}
const band = (lo, hi) => keys.filter(k => G[k] >= lo && G[k] < hi);
const mean = (g, f) => g.length ? g.reduce((s, k) => s + f(k), 0) / g.length : NaN;
console.log('\n  分组               n    ' + Object.keys(AX).map(x => x.padStart(9)).join(''));
for (const [nm, g] of [['宽 G>=6', band(6, 99)], ['中 4<=G<6', band(4, 6)], ['窄 3<=G<4', band(3, 4)], ['最窄 G<3', band(0, 3)]])
  console.log('  ' + nm.padEnd(15) + String(g.length).padStart(4) + '   ' + Object.values(AX).map(f => (isNaN(mean(g, f)) ? '--' : mean(g, f).toFixed(1)).padStart(9)).join(''));
const lv = (k, tag) => V1[k] != null && EX[k] ? `${tag} G=${G[k]} V1=${V1[k]} V2=${V2[k]} A卷=${(EX[k]['A卷'] || 0).toFixed(1)}` : '';
console.log('  ' + (lv('LIVE', '当前线上包  ') || '（当前线上包缺数据）'));
console.log('  ' + (lv('v7new5_005-31', '上一任线上包') || '（上一任线上包缺 G：它不在 audit 输入里）'));
console.log('\n  判读：逐列看符号 —— 出现负号 ⇒ 宽度确有代价、"降强度换宽度"是可执行的交易；若全正 ⇒ 目标函数根本没为宽度付钱（不是"不愿付"，是"没有这根梯度"，见 §28a）。');
