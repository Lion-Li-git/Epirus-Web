/* §22 E1 的判定工具（批次 7 用 `EPIRUS_ALLOW_HEALTH_FAIL=1` 拿到 12 对同 seed 产物后跑这个）
 * 为什么单独做一个工具而不是手工看表：今夜我被"未配对均值"骗了三次（§11c/§13a/§14），
 *   而配对 + 符号翻转置换检验是**唯一**能在 n=12 上给出可用 p 的做法。
 * 输入（都已存在，由别的命令产出，本工具只读不算）：
 *   docs/artifacts/crowd-random.log    ← node tools/crowding.mjs 80 <包...>
 *   docs/artifacts/crowd-balanced.log  ← CROWD_OPP=balanced node tools/crowding.mjs 80 <包...>
 *   docs/artifacts/audit-*.log         ← champ-audit 的 G 列（协变量，用来分层）
 *   docs/l2-eval-matrix-120.tsv        ← 考卷口径（A 卷 / targeter）用于对照
 * 用法：node tools/l2-e1-check.mjs [臂A=arm f] [臂B=arm c]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const ART = 'docs/artifacts';
const ARMA = process.argv[2] || 'f', ARMB = process.argv[3] || 'c';
function crowd(file, col) {
  const o = {};
  if (!existsSync(file)) throw new Error('缺文件：' + file + ' ⇒ 先跑 crowding.mjs');
  for (const l of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(l);
    if (!m || m[1].startsWith('包')) continue;
    o[m[1]] = Number(m[1 + col]);
  }
  return o;
}
const V1 = crowd(ART + '/crowd-random.log', 1);        // k=1 每席（对手 random）= 打乱局
const V2 = crowd(ART + '/crowd-balanced.log', 1);      // k=1 每席（对手 balanced）= 打整局
const V4 = crowd(ART + '/crowd-balanced.log', 3);      // k=4 每席（对手 balanced）= 成群打整局
const G = {};
for (const f of readdirSync(ART).filter(x => /^audit.*\.log$/.test(x))) {
  for (const l of readFileSync(ART + '/' + f, 'utf8').split(/\r?\n/)) {
    const nm = /^(v7l2\S+?)\.bak\b/.exec(l); if (!nm) continue;
    const gm = l.split(/\s{2,}/).map(x => /^([\d.]+) \((\d+)种\)/.exec(x)).find(Boolean);
    if (gm && G[nm[1]] == null) G[nm[1]] = Number(gm[1]);
  }
}
const EX = {};
for (const l of readFileSync('docs/l2-eval-matrix-120.tsv', 'utf8').split(/\r?\n/).filter(x => x.includes('\t'))) {
  const p = l.split('\t'), nm = p[0].replace('.bak', '');
  const v = Number((/1st=([\d.]+)%/.exec(p[2]) || [0, 0])[1]) - Number((/([\d.]+)%/.exec(p[4]) || [0, 0])[1]);
  (EX[nm] = EX[nm] || {})[p[1]] = v;
}
const seedOf = n => (/-(\d+)$/.exec(n) || [])[1];
const armOf = n => (/v7l2([a-z]?)-/.exec(n) || [])[1];
const byArm = {};
for (const n of Object.keys(V2)) { const a = armOf(n), s = seedOf(n); if (a && s) ((byArm[a] = byArm[a] || {})[s] = n); }
const A = byArm[ARMA] || {}, B = byArm[ARMB] || {};
const seeds = Object.keys(A).filter(s => B[s]).sort((x, y) => Number(x) - Number(y));
console.log(`=== E1 判定：臂 ${ARMA} − 臂 ${ARMB}，**同 seed 配对** · 配对数 ${seeds.length}（${ARMA} 有 ${Object.keys(A).length}、${ARMB} 有 ${Object.keys(B).length}）===`);
if (seeds.length < 4) console.log('⚠ 配对数 <4 ⇒ 只能算方向，别报 p 值（§11b 的分辨率账）。');
function signFlip(d, iters = 200000) {
  const obs = d.reduce((a, b) => a + b, 0) / d.length;
  let seed = 20260919; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let cnt = 0;
  for (let i = 0; i < iters; i++) {
    let s = 0; for (const x of d) s += x * (rnd() < 0.5 ? 1 : -1);
    if (s / d.length >= obs - 1e-12) cnt++;
  }
  return { obs, p: (cnt + 1) / (iters + 1) };
}
for (const [label, col] of [['V2 打整局（主判据）', V2], ['V4 成群打整局', V4], ['V1 打乱局（预期为负＝代价）', V1]]) {
  const d = seeds.map(s => col[A[s]] - col[B[s]]);
  if (!d.length) continue;
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, d.length - 1));
  const sf = signFlip(d);
  const pos = d.filter(x => x > 0).length;
  console.log(`  ${label.padEnd(26)} 均值 ${mean >= 0 ? '+' : ''}${mean.toFixed(1).padStart(5)}pt · SD ${sd.toFixed(1)} · SE ${(sd / Math.sqrt(d.length)).toFixed(1)} · 同号 ${pos}/${d.length} · **符号翻转检验 p=${sf.p.toFixed(4)}**`);
  console.log(`      逐对 ${d.map(x => (x >= 0 ? '+' : '') + x.toFixed(0)).join(' ')}`);
}
/* 考卷口径的同一批配对（对照用：证明"为什么考卷读不出来"） */
for (const exam of ['A卷', 'TN']) {
  const dv = seeds.filter(s => (EX[A[s]] || {})[exam] != null && (EX[B[s]] || {})[exam] != null)
    .map(s => EX[A[s]][exam] - EX[B[s]][exam]);
  if (!dv.length) continue;
  const mean = dv.reduce((a, b) => a + b, 0) / dv.length;
  const sd = Math.sqrt(dv.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, dv.length - 1));
  console.log(`  考卷 ${exam}（n=${dv.length} 对）      均值 ${mean >= 0 ? '+' : ''}${mean.toFixed(1)}pt · SD ${sd.toFixed(1)}   ← 与上面 V2 对照：考卷的 SD 大一个量级`);
}
/* 有 G 就读一下协变量；没有就明说（不许默默跳过） */
const gMissing = seeds.filter(s => G[A[s]] == null || G[B[s]] == null);
console.log(`\n  G 协变量：${seeds.length - gMissing.length}/${seeds.length} 对可分层` +
  (gMissing.length ? ` ⇒ **先跑 champ-audit 再分层**（缺：${gMissing.slice(0, 6).join(' ')}${gMissing.length > 6 ? ' …' : ''}）` : ''));
if (!gMissing.length) {
  for (const band of [[3, 4], [4, 99]]) {
    const ss = seeds.filter(s => G[A[s]] >= band[0] && G[A[s]] < band[1] && G[B[s]] >= band[0] && G[B[s]] < band[1]);
    if (ss.length < 2) { console.log(`  G∈[${band[0]},${band[1]}) 层内配对 ${ss.length} 对 ⇒ 太少`); continue; }
    const d = ss.map(s => V2[A[s]] - V2[B[s]]);
    const mean = d.reduce((a, b) => a + b, 0) / d.length, sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, d.length - 1));
    console.log(`  G∈[${band[0]},${band[1]}) 层内（${ss.length} 对）V2 差 均值 ${mean.toFixed(1)}pt · SD ${sd.toFixed(1)} · 同号 ${d.filter(x => x > 0).length}/${ss.length}`);
  }
}
console.log('\n  判读：V2 的配对均值若 >0 且 p<0.05 ⇒ ② 在"打整局"轴上的收益成立；V1 若显著为负 ⇒ 代价在另一根轴上（不是同一根轴的噪声）。');
console.log('        两轴同号为正 / 同时为负 都要如实报，**不要只报显著的那一根**（§16：这两把尺子本身就反号）。');
