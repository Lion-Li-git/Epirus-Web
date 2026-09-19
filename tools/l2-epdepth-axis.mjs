/* 回答一个具体问题：**"ep 深度与强度无关"这条结论，是在哪根轴上测的？**
 * §10b/§12 当时用的是 A 卷 + targeter + 自对局反事实；而 §16 之后我们才知道"谁赢"有两根反号的轴
 *   （V1=打乱局 / V2=打整局 / V4=成群打整局），并且 `r(A卷,V1)=+0.71` ⇒ **A 卷基本就是 P 轴本身**。
 *   ⇒ 所以"ep 深度不载重"这句话必须补一次：把每个包的 ep 深度指标拿去和**两根轴各自**相关。
 * 用法：node tools/l2-epdepth-axis.mjs
 *   输入（都由别的命令产出，本工具只读）：docs/artifacts/leftover-all.log（`probe-leftover` 全产物）
 *   + crowd-random.log(V1) + crowd-balanced.log(V2/V4) + docs/l2-eval-matrix-120.tsv(A卷/TN)
 * ⚠ 相关的单位是"包"，同臂的 seed 之间不独立 ⇒ 只读符号与量级，别当显著性检验用（§13a 的教训）。
 */
import { readFileSync, existsSync } from 'node:fs';
const req = ['docs/artifacts/leftover-all.log', 'docs/artifacts/crowd-random.log', 'docs/artifacts/crowd-balanced.log', 'docs/l2-eval-matrix-120.tsv'];
for (const f of req) if (!existsSync(f)) throw new Error('缺输入：' + f);
/* 1) ep 深度指标（multi 那一段）：峰 ep / ep≥3 占比 / 环可负担 / 兑现率 / 终局余款 */
const EP = {};
{
  const L = readFileSync(req[0], 'utf8').split(/\r?\n/);
  let cur = null;
  for (let i = 0; i < L.length; i++) {
    const m = /^\s+(\S+)\s+\[(multi|long)\]/.exec(L[i]);
    if (m) { cur = m[2] === 'long' ? null : (m[1] === '线上包' ? 'bundled-champion-3p' : m[1]); continue; }
    if (!cur) continue;
    const peak = /峰 ep (\d+)/.exec(L[i]), aff = /环可负担 ([\d.]+)%/.exec(L[i]), h3 = /= ([\d.]+)% ([\d.]+)% ([\d.]+)% ([\d.]+)% ([\d.]+)%/.exec(L[i]);
    const conv = /兑现率 (\d+)%/.exec(L[i]), left = /终局余款：人均 ([\d.]+)/.exec(L[i]);
    const o = (EP[cur] = EP[cur] || {});
    if (peak) o.peak = Number(peak[1]);
    if (h3) o.ge3 = Number(h3[4]) + Number(h3[5]);
    if (aff) o.ringaff = Number(aff[1]);
    if (conv) o.conv = Number(conv[1]);
    if (left) o.left = Number(left[1]);
  }
}
function crowd(file, col) {
  const o = {};
  for (const l of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(l);
    if (!m || m[1].startsWith('包')) continue;
    o[m[1]] = Number(m[1 + col]);
  }
  return o;
}
const V1 = crowd(req[1], 1), V2 = crowd(req[2], 1), V4 = crowd(req[2], 3);
const EX = {};
for (const l of readFileSync(req[3], 'utf8').split(/\r?\n/).filter(x => x.includes('\t'))) {
  const p = l.split('\t'), nm = p[0].replace('.bak', '');
  const v = Number((/1st=([\d.]+)%/.exec(p[2]) || [0, 0])[1]) - Number((/([\d.]+)%/.exec(p[4]) || [0, 0])[1]);
  if (!EX[nm]) EX[nm] = {};
  if (p[1] === 'A卷') EX[nm].A = v; if (p[1] === 'TN') EX[nm].T = v;
}
function corr(xs, ys) {
  const n = xs.length; if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { const p = xs[i] - mx, q = ys[i] - my; a += p * q; b += p * p; c += q * q; }
  return a / Math.sqrt(b * c || 1);
}
const keys = Object.keys(EP).filter(k => EP[k].peak != null && V2[k] != null && (EX[k] || {}).A != null);
console.log(`=== ep 深度指标 × 各根轴（单位=包，n=${keys.length}）===`);
const AX = { V1: k => V1[k], V2: k => V2[k], V4: k => V4[k], 'A卷': k => EX[k].A, 'TN': k => EX[k].T };
const MET = { '峰 ep': 'peak', 'ep≥3 %': 'ge3', '环可负担 %': 'ringaff', '兑现率 %': 'conv', '终局余款': 'left' };
console.log('指标            ' + Object.keys(AX).map(x => String(x).padStart(8)).join(''));
for (const [mn, mk] of Object.entries(MET)) {
  console.log(mn.padEnd(14) + Object.values(AX).map(f => corr(keys.map(k => EP[k][mk]), keys.map(f)).toFixed(2).padStart(8)).join(''));
}
const rich = keys.filter(k => EP[k].peak >= 4), poor = keys.filter(k => EP[k].peak <= 2);
const mean = (g, f) => g.length ? g.reduce((s, k) => s + f(k), 0) / g.length : NaN;
console.log(`\n=== 直接按"包有没有 ep 深度"分组（峰 ep 二分）===`);
console.log(`  浅包(峰≤2) n=${poor.length}  ` + Object.entries(AX).map(([nm, f]) => `${nm} ${mean(poor, f).toFixed(1)}`).join('   '));
console.log(`  深包(峰≥4) n=${rich.length}  ` + Object.entries(AX).map(([nm, f]) => `${nm} ${mean(rich, f).toFixed(1)}`).join('   '));
console.log(`  ⇒ 深−浅：  ` + Object.entries(AX).map(([nm, f]) => `${nm} ${(mean(rich, f) - mean(poor, f)).toFixed(1)}`).join('   '));
console.log('\n  ⚠ 单位是"包"、同臂 seed 不独立 ⇒ 只读方向。真正的凭据是 §25 那个**干预**：② 把峰 ep 压到 1 的同时 V2 +7.4(p=0.012)、V1 −28.3。');
