/* 02:33 增补分析：把四把"谁赢"的尺子放进同一张相关矩阵
 *   V1 = crowding k=1，对手 random（打乱局能力）
 *   V2 = crowding k=1，对手 balanced（打整局能力）  ← §15 的控制实验逼出来的这一维
 *   H  = head2head 正向（1 席被测 vs 4 席线上包）
 *   A  = A 卷（35 组合场）高出随机      T = targeter 场高出随机
 * 用法：先跑两次 crowding 存成两个文件，再 `node tools/l2-axis-join.mjs v1.txt v2.txt`
 */
import { readFileSync } from 'node:fs';
function parseCrowd(txt) {
  const o = {};
  for (const l of txt.split(/\r?\n/)) {
    const m = /^\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(l);
    if (!m || m[1].startsWith('包')) continue;
    o[m[1] === '线上包' ? 'bundled-champion-3p' : m[1]] = { k1: Number(m[2]), k4: Number(m[4]), idx: Number(m[5]) };
  }
  return o;
}
const V1 = parseCrowd(readFileSync(process.argv[2], 'utf8'));
const V2 = parseCrowd(readFileSync(process.argv[3], 'utf8'));
const H = {};
for (const l of readFileSync('docs/artifacts/h2h-sweep.log', 'utf8').split(/\r?\n/)) {
  const m = /^\s+(\S+)\s+\[multi\]\s+被测1席 ([\d.]+)%.*被测4席\(线上包1席打它\) ([\d.]+)%/.exec(l);
  if (m) H[m[1]] = { f: Number(m[2]), r: Number(m[3]) };
}
const W = {};
for (const l of readFileSync('docs/l2-eval-matrix-120.tsv', 'utf8').split(/\r?\n/).filter(x => x.includes('\t'))) {
  const p = l.split('\t'), nm = p[0].replace('.bak', '');
  (W[nm] = W[nm] || {})['A卷'] = Number((/1st=([\d.]+)%/.exec(p[2]) || [0, 0])[1]) - Number((/([\d.]+)%/.exec(p[4]) || [0, 0])[1]);
  (W[nm] = W[nm] || {})['TN'] = Number((/1st=([\d.]+)%/.exec(p[2]) || [0, 0])[1]) - Number((/([\d.]+)%/.exec(p[4]) || [0, 0])[1]);
}
for (const l of readFileSync('docs/l2-eval-matrix-120.tsv', 'utf8').split(/\r?\n/).filter(x => x.includes('\t'))) {
  const p = l.split('\t'), nm = p[0].replace('.bak', '');
  const v = Number((/1st=([\d.]+)%/.exec(p[2]) || [0, 0])[1]) - Number((/([\d.]+)%/.exec(p[4]) || [0, 0])[1]);
  if (W[nm]) W[nm][p[1]] = v;
}
function corr(xs, ys) {
  const n = xs.length; if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { const p = xs[i] - mx, q = ys[i] - my; a += p * q; b += p * p; c += q * q; }
  return a / Math.sqrt(b * c || 1);
}
const AX = { V1: k => V1[k].k1, V2: k => V2[k].k1, V4: k => V2[k].k4, H: k => H[k].f, HR: k => H[k].r, A: k => W[k]['A卷'], T: k => W[k].TN };
const keys = Object.keys(V1).filter(k => V2[k] && H[k] && W[k] && W[k].TN != null);
const names = Object.keys(AX);
console.log(`=== 相关矩阵（n=${keys.length} 个包，四把"谁赢"的尺子）===`);
console.log('      ' + names.map(x => x.padStart(6)).join(''));
for (const x of names) {
  console.log(x.padEnd(6) + names.map(y => corr(keys.map(AX[x]), keys.map(AX[y])).toFixed(2).padStart(6)).join(''));
}
console.log('\n=== 明细（按 V2 = 1 席打 4 balanced 从高到低）===  公平份额 20%');
console.log('  包                 V2整局  V1乱局  H正向  H反向   A卷    TN');
keys.sort((a, b) => V2[b].k1 - V2[a].k1).forEach(k => {
  console.log(`  ${k.padEnd(18)}${V2[k].k1.toFixed(1).padStart(6)} ${V1[k].k1.toFixed(1).padStart(7)} ${H[k].f.toFixed(1).padStart(6)} ${H[k].r.toFixed(1).padStart(6)} ${(W[k]['A卷'] == null ? '--' : W[k]['A卷'].toFixed(1)).padStart(6)} ${(W[k].TN == null ? '--' : W[k].TN.toFixed(1)).padStart(6)}`);
});
