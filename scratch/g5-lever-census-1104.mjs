/* 11-04 午后（千问）：**哪一在册读数真的跟着 G5（纯防御收场）走？**
 * 动因：G5 是全库最宽的缺口（29/31 枚被卡），而我原本打算发的波 E 想把当选 veto 压在"场B 清场"上 ⇒
 *   发臂前先量这根尺**咬不咬得动**（25 秒换一条臂的在册规矩）。量完发现它饱和、且与 G5 非单调 ⇒ 波 E 取消。
 *   这里把它推广成一次**候选杠杆普查**：所有回执里现成的读数 × G5 最坏格 ⇒ 谁值得当 lever。
 * 口径条款（照尺自己的条款读，别越界）：
 *   · G5 目标 = **关掉上线档**那一格（阈值 ≤25），两桌取严（最坏格）；只有 FAIL 才印数 ⇒
 *     过线的包（含 AK3-s7、EFFG-s41 那格 30%）**没有 G5 读数**，本普查的分母因此是"红的那批"，
 *     它判的是"在已经收不了场的包里，什么跟着收不了场"，**不判"过线与不过线之间"**。这是本尺的头号保留。
 *   · 相关 ≠ 因果；ρ 高也可能是两个都跟着第三个量（桌形/剂量）走。
 *   · 剂量不同的列（40 局 vs 200 局）不许混在同一格里比。
 * 用法：node scratch/g5-lever-census-1104.mjs [回执目录,逗号分隔]
 *       读数落 scratch/g5-lever-census-1104.tsv
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';

const DIRS = (process.argv[2] || 'scratch/night6/promote,scratch/promote-1104').split(',').filter(Boolean);
const OUT = 'scratch/g5-lever-census-1104.tsv';
const num = (t, re) => { const m = re.exec(t); return m ? Number(m[1]) : null; };

const rows = [];
const skipped = [];
const noTarget = [];   /* 回执是真的，但**没有 G5 读数**（= 那一格过了 ⇒ 目标缺失，不是解析错） */
for (const d of DIRS) {
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter(x => x.endsWith('.txt')).sort()) {
    const t = readFileSync(d + '/' + f, 'utf8');
    if (!/^== 换前体检：/.test(t)) { skipped.push(d + '/' + f); continue; }
    const name = f.replace(/\.txt$/, '');
    /* G5 关档读数只在 FAIL 时印 ⇒ 同一格会重复打两遍（在册：gate-drafts 自印两遍），取 max 无害 */
    /* ⚠ 自己踩过的坑（第一版就踩）：这条正则有三组（包名/桌名/百分数），
     *   取成 `m[2]` 抓到的是**桌名** ⇒ `Number('long')=NaN` ⇒ 整列目标都是 NaN，而 ρ 照样印出 ±0.4 的"像样"数字。
     *   分布行印出 `NaN` 是唯一能抓住它的地方 ⇒ 分布行不许省。 */
    const g5 = [...t.matchAll(/G5\[(.+?)\/(long|multi)\][^\n]*?实测防席夺冠 ([0-9.]+)%/g)].map(m => Number(m[3]));
    if (!g5.length) { noTarget.push(name); continue; }              /* 过线的包不印 G5 数 ⇒ 无目标，不是错 */
    if (g5.some(v => !isFinite(v))) { skipped.push(name + '（G5 读数非有限 ⇒ 正则抓错组？）'); continue; }                       /* 过线的包没有读数 ⇒ 不进分母（不是 0！） */
    const g5w = Math.max(...g5);
    const r = {
      name, g5w, g5n: new Set(g5).size,
      /* 经济出口 */
      clear: num(t, /场B 清场 ([0-9.]+)\/局/),
      spend: num(t, /花珠率 ([0-9.]+)%/),
      waste: num(t, /浪费率 ([0-9.]+)%/),
      charge: num(t, /蓄能 ([0-9.]+)\/局/),
      /* 输出与密度 */
      dmgSnipe: num(t, /自身伤害 ([0-9.]+)\/局/),
      actsSnipe: num(t, /出手 ([0-9.]+)\/局/),
      /* 单极化（两桌取严） */
      landMax: (() => { const m = [...t.matchAll(/(?:long|multi) ([0-9.]+)%（/g)].map(x => Number(x[1]));
        return m.length ? Math.max(...m) : null; })(),
      /* 功能角色（8 个那一栏） */
      roleCov: num(t, /覆盖 (\d)\/8 · G_role/),
      gRole: num(t, /G_role=([0-9.]+)/),
      between: num(t, /类间 ([0-9.]+)/),
      dmgShare: (() => { const m = /角色占比：[^\n]*/.exec(t); if (!m) return null;
        const d = /damage ([0-9.]+)%/.exec(m[0]); return d ? Number(d[1]) : 0; })(),
    };
    rows.push(r);
  }
}

const KEYS = ['clear', 'spend', 'waste', 'charge', 'dmgSnipe', 'actsSnipe', 'landMax', 'roleCov', 'gRole', 'between', 'dmgShare'];
const rank = (a) => { const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length);
  s.forEach(([, i], p) => { r[i] = p + 1; }); return r; };
const pearson = (x, y) => { const n = x.length; if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : null; };

const lines = [];
lines.push('n=' + rows.length + ' 枚（只有 G5 报出数的包 = **红的那批**；过线者无读数 ⇒ 本表判"红包里什么跟着更红"）');
if (skipped.length) lines.push('跳过（非回执 或 G5 读数取不出）' + skipped.length + ' 个：' + skipped.join(' '));
lines.push('没进分母的真回执：' + noTarget.length + ' 枚（' + noTarget.join(' ') + '）⇒ 这些是 **G5 过了/没印数** 的包，**不许当成 G5=0 补进表**');
lines.push('G5 最坏格 分布：min ' + Math.min(...rows.map(r => r.g5w)) + ' ‖ 中位 ' +
  [...rows.map(r => r.g5w)].sort((a, b) => a - b)[Math.floor(rows.length / 2)] + ' ‖ max ' + Math.max(...rows.map(r => r.g5w)));
lines.push('');
lines.push('读数'.padEnd(12) + 'n' + '\tρ(Spearman)\tPearson\t并列最多的值/枚数\t判读');
const res = [];
for (const k of KEYS) {
  const pairs = rows.map(r => [r[k], r.g5w]).filter(([v]) => v !== null && !Number.isNaN(v));
  const n = pairs.length;
  if (n < 5) { res.push({ k, n, rho: null, pr: null, sat: null }); continue; }
  const xs = pairs.map(p => p[0]);
  const cnt = {}; for (const v of xs) cnt[v] = (cnt[v] || 0) + 1;
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  const rho = pearson(rank(xs), rank(pairs.map(p => p[1])));
  res.push({ k, n, rho, pr: pearson(xs, pairs.map(p => p[1])), sat: top[0] + '×' + top[1] });
}
res.sort((a, b) => (b.rho === null ? -99 : Math.abs(b.rho)) - (a.rho === null ? -99 : Math.abs(a.rho)));
for (const v of res) {
  const note = v.rho === null ? (v.n < 5 ? '分母不足（<5）⇒ 读不出'
      : '这一列**无方差**（' + (v.sat || '') + ' 全同值）⇒ 判不了，**别读成"没关系"**')
    : (Math.abs(v.rho) < 0.3 ? '|ρ|<0.3 ⇒ 这一列在本分母里没有可用方向'
      : (v.rho > 0 ? '正相关：这一列越高，G5 越红（**反着才是杠杆**）' : '负相关：这一列越高，G5 越不红 ⇒ 值得当杠杆候选'));
  lines.push(String(v.k).padEnd(12) + String(v.n).padStart(3) + '\t' +
    (v.rho === null ? '  —' : (v.rho >= 0 ? '+' : '') + v.rho.toFixed(3)) + '\t' +
    (v.pr === null ? '  —' : (v.pr >= 0 ? '+' : '') + v.pr.toFixed(3)) + '\t' + (v.sat || '—') + '\t' + note);
}
const out = lines.join('\n') + '\n';
console.log(out);
writeFileSync(OUT, '# 自动生成：node scratch/g5-lever-census-1104.mjs ' + DIRS.join(',') + '\n# 目标列 = G5 关档最坏格（≤25 判红）；分母 = 有 G5 读数的回执（过线者无读数 ⇒ 见文件头口径条款）\n' + out, 'utf8');
console.log('→ 读数已落 ' + OUT);
