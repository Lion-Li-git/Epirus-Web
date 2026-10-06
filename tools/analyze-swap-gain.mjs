/* §E136 判读：阶段条件化（第 R 回合换包）的**配对**读数
 * 用法：node tools/analyze-swap-gain.mjs --dir=docs/artifacts/e136-out [--ctrl=AAA,BBB] [--swap=A2B-at5,...]
 *
 * 为什么必须配对：所有臂都在**同一批桌子**上跑（同 seed、同 `--every` 采样、同组合顺序），
 * 于是"这一桌 A 臂第 1 名几次、B 臂第 1 名几次"是可以逐桌相减的 —— 汇总百分比相减会把
 * 桌子间的方差全部算进误差里（§E137 那种未配对 SE ≈ 0.4pt 就是这么来的，偏保守但钝）。
 *
 * ⚠ 三条跑前定死的规矩（细节在 docs/research/logs/RESEARCH-LOG-2026-09-28-qoder.md §E136）：
 *   1) 配对成立的前提是"逐桌子的组合名字序列一致" ⇒ 这里**先做硬校验**，不一致就直接拒绝出读数（不是警告）。
 *   2) 主终点 = 最好的 swap 臂 − max(AAA, BBB)；两个对照都算，谁大用谁。
 *   3) **反巧合条款**：只有 `A→B` 与 `B→A` 两个方向**同时**高于两个对照，才允许判"阶段调度赚钱"；
 *      否则那份收益可能只是"晚段本来就该用更强那粒"。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
/* 配对差的算术住在 lib（与 `analyze-routing-gain.mjs` 同一把尺：那边配逐环境，这里配逐桌子） */
import { pairedDiff } from './routing-gain-lib.mjs';

const arg = (k, d) => { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : d; };
const DIR = arg('dir', 'docs/artifacts/e136-out');
const CTRL = arg('ctrl', 'AAA,BBB').split(',');
const SWAPS = arg('swap', '').split(',').filter(Boolean);
const ALPHA = Number(arg('alpha', 0.05));

if (!existsSync(DIR)) { console.error('目录不存在: ' + DIR); process.exit(2); }

/* 自动认臂：不给 --swap 名单时，把目录里所有 .tsv 都读进来，对照 = --ctrl，其余全是 swap 臂。 */
const files = readdirSync(DIR).filter(f => f.endsWith('.tsv'));
const names = SWAPS.length ? SWAPS : files.map(f => f.replace(/\.tsv$/, '')).filter(n => !CTRL.includes(n));
const ARMS = CTRL.concat(names);

/** 读一张 per-combo 落盘，返回主体席的 {seq: 组合名序列, first: [], games: []} */
function load(arm) {
  const p = DIR + '/' + arm + '.tsv';
  if (!existsSync(p)) { console.error('缺臂: ' + p); process.exit(2); }
  const seq = [], first = [], games = [], strict = [];
  let meta = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line) continue;
    /* 头部所有 `#k=v` 都要收：配对成立与否靠这些字段判，**只数组合名会把"换了 seed"当成同一批桌子**
     * （组合名由池子+`--every` 决定，与 seed 无关 ⇒ §E140 这种"两个 seed 各两臂"放一个目录时就会踩到）。 */
    if (line[0] === '#') { const m = /^#([a-z-]+)=(.*)$/.exec(line); if (m) meta[m[1]] = m[2]; continue; }
    const c = line.split('\t');
    if (c[0] !== 'subject') continue;
    seq.push(c[2]); games.push(Number(c[3])); first.push(Number(c[4])); strict.push(Number(c[5]));
  }
  return { arm: arm, seq: seq, first: first, games: games, strict: strict, meta: meta };
}

const L = {};
for (const a of ARMS) L[a] = load(a);

/* ---- 1) 配对前提硬校验：**跑法五要素**必须相同，其次组合序列与每桌局数逐位相同 ---- */
const PAIR_KEYS = ['seed', 'games', 'pool', 'every', 'field'];   // `file`/`swap` 本来就每臂不同，不在名单里
const base = L[CTRL[0]];
for (const a of ARMS) {
  if (a === CTRL[0]) continue;
  const x = L[a];
  for (const k of PAIR_KEYS) {
    if ((base.meta[k] || '-') !== (x.meta[k] || '-')) {
      console.error('配对不成立：' + a + ' 的 `--' + k + '=' + (x.meta[k] || '—') + '）与 ' + CTRL[0] +
        ' 的 `' + (base.meta[k] || '—') + '` 不同 ⇒ **换了跑法就不是同一批桌子**（组合名相同也不够，桌子由 seed 决定），拒绝出读数');
      process.exit(2);
    }
  }
  if (x.seq.length !== base.seq.length) {
    console.error('配对不成立：' + a + ' 有 ' + x.seq.length + ' 桌，' + CTRL[0] + ' 有 ' + base.seq.length + ' 桌 ⇒ 组合数不同（--every/--pool 不一致），拒绝出读数');
    process.exit(2);
  }
  let bad = -1;
  for (let i = 0; i < x.seq.length; i++) if (x.seq[i] !== base.seq[i]) { bad = i; break; }
  if (bad >= 0) {
    console.error('配对不成立：第 ' + bad + ' 桌的组合不同（' + CTRL[0] + '=' + base.seq[bad] + ' ‖ ' + a + '=' + x.seq[bad] +
      '）⇒ 不是同一批桌子，拒绝出读数');
    process.exit(2);
  }
  for (let i = 0; i < x.games.length; i++) if (x.games[i] !== base.games[i]) {
    console.error('配对不成立：' + a + ' 第 ' + i + ' 桌打了 ' + x.games[i] + ' 局，' + CTRL[0] + ' 打了 ' + base.games[i] + ' 局');
    process.exit(2);
  }
}
const NT = base.seq.length, NG = base.games[0];
const totGames = base.games.reduce((s, g) => s + g, 0);

/* ---- 2) 汇总口径 ---- */
const agg = {};
for (const a of ARMS) {
  const x = L[a];
  const f = x.first.reduce((s, v) => s + v, 0), st = x.strict.reduce((s, v) => s + v, 0);
  const g = x.games.reduce((s, v) => s + v, 0);
  agg[a] = { first: f / g, strict: st / g, n: g };
}
const pct = (v) => (v * 100).toFixed(2) + '%';

/* ---- 3) 配对差：arm − 对照，逐桌相减（单位：百分点）。算术住在 `routing-gain-lib.pairedDiff`（单一来源）---- */
function paired(arm, ctrl) {
  const x = L[arm], y = L[ctrl];
  const a = [], b = [];
  for (let i = 0; i < x.seq.length; i++) { a.push(x.first[i] / x.games[i] * 100); b.push(y.first[i] / y.games[i] * 100); }
  const p = pairedDiff(a, b, z95);
  if (!p) { console.error('配对读数不足（n<2）：' + arm + ' vs ' + ctrl); process.exit(2); }
  /* lib 用 `m`（§E130 那一份的形状），本文件沿用 `mean` ⇒ 在这里转一次，不在别处重复算 */
  return { mean: p.m, se: p.se, lo: p.lo, hi: p.hi, sd: p.sd, n: p.n, better: p.better, worse: p.worse,
    tie: p.tie, min: p.min, max: p.max };
}
const z95 = invNorm(1 - ALPHA / 2);
/* 内部守卫：分位数/累积分布算错 ⇒ 全表区间一起错，而输出看着照样合理 —— 这是本文件唯一"错了不会响"的地方。
 * 所以无条件自测（与 --alpha 给什么无关）：Φ(0)=0.5、z_{0.975}=1.960。 */
if (Math.abs(normCdf(0) - 0.5) > 1e-6 || Math.abs(invNorm(0.975) - 1.959964) > 0.002) {
  console.error('内部自检失败：Φ(0)=' + normCdf(0).toFixed(6) + ' ‖ z_{0.975}=' + invNorm(0.975).toFixed(4) + ' ⇒ 拒绝出读数');
  process.exit(2);
}
const M = agg[CTRL[0]].first >= agg[CTRL[1]].first ? CTRL[0] : CTRL[1];
const other = M === CTRL[0] ? CTRL[1] : CTRL[0];

console.log('=== §E136 阶段条件化（第 R 回合换包）· 配对读数 ===');
console.log('桌子 = ' + NT + ' 组 × ' + NG + ' 局 = ' + totGames + ' 局/臂 ‖ **跑法已逐臂核对相同**：' +
  PAIR_KEYS.map(function (k) { return k + '=' + (base.meta[k] || '—'); }).join(' ') + '（⇒ 配对成立）');
console.log('单臂二项 ±1.96SE ≈ ' + (z95 * Math.sqrt(agg[CTRL[0]].first * (1 - agg[CTRL[0]].first) / agg[CTRL[0]].n) * 100).toFixed(2) +
  'pt ‖ **配对** SE 见下表（一般小一个量级）');
console.log('两个对照: ' + CTRL[0] + '=' + pct(agg[CTRL[0]].first) + '（严胜 ' + pct(agg[CTRL[0]].strict) + '） ‖ ' +
  CTRL[1] + '=' + pct(agg[CTRL[1]].first) + '（严胜 ' + pct(agg[CTRL[1]].strict) + '）');
const ab = paired(CTRL[0], CTRL[1]);
console.log('  A/B 两粒本身的差（配对）: ' + ab.mean.toFixed(2) + 'pt [' + ab.lo.toFixed(2) + ', ' + ab.hi.toFixed(2) + '] ' +
  (ab.lo > 0 ? '⇒ 区间不跨 0' : (ab.hi < 0 ? '⇒ 区间不跨 0（反向）' : '⇒ 跨 0，两粒分不出')));
console.log('  ⇒ 主终点的基线 = max(对照) = ' + M + '（' + pct(agg[M].first) + '）');

/* 只有两个对照、没有 swap 臂时（§E139 就是这种跑法：拿同一把配对尺量"A 粒 vs B 粒"），
 * 后面的 ①/②/②′ 判语讲的是"换包臂相对对照的位置" ⇒ 没有换包臂还印出来就是误导。 */
if (!names.length) {
  console.log('\n⚠ 目录里**只有两个对照、没有 swap 臂** ⇒ 只出上面那行 A/B 配对差，**不判 §E136 的 ①/②/②′**');
  process.exit(0);
}

console.log('\n| 臂 | 1st | Δ vs ' + CTRL[0] + ' [95%] | Δ vs ' + CTRL[1] + ' [95%] | 高于两个对照? |');
console.log('|---|---|---|---|---|');
const rows = [];
for (const a of names) {
  const d0 = paired(a, CTRL[0]), d1 = paired(a, CTRL[1]);
  const aboveBoth = d0.lo > 0 && d1.lo > 0;
  const belowBoth = d0.hi < 0 && d1.hi < 0;
  /* ⚠ 第四种情形必须**单列**，不许并进"分不出"：`低于强对照、高于弱对照`（区间两边都不跨 0）
   * 正是"换包 = 在两粒包之间插值"的签名。把它印成"分不出"会把一个很强的读数说成一个很弱的读数。 */
  const between = d0.hi < 0 && d1.lo > 0;
  const betweenRev = d0.lo > 0 && d1.hi < 0;
  rows.push({ arm: a, first: agg[a].first, d0: d0, d1: d1, aboveBoth: aboveBoth, belowBoth: belowBoth,
    between: between || betweenRev,
    vsMax: (a === M ? null : paired(a, M)) });
  const mark = aboveBoth ? '✅ 两个都在上'
    : (belowBoth ? '⛔ 两个都在下'
      : (between ? '◆ 夹在中间：显著**低于** ' + CTRL[0] + '、显著**高于** ' + CTRL[1]
        : (betweenRev ? '◆ 夹在中间：显著高于 ' + CTRL[0] + '、显著低于 ' + CTRL[1]
          : '— 与某个对照分不出')));
  console.log('| `' + a + '` | ' + pct(agg[a].first) + ' | ' + d0.mean.toFixed(2) + ' [' + d0.lo.toFixed(2) + ', ' + d0.hi.toFixed(2) + '] | ' +
    d1.mean.toFixed(2) + ' [' + d1.lo.toFixed(2) + ', ' + d1.hi.toFixed(2) + '] | ' + mark + ' |');
}

/* ---- 4) 主终点 + 反巧合 ---- */
const nBetween = rows.filter(r => r.between).length;
console.log('\n  ⇒ ' + nBetween + '/' + rows.length + ' 个 swap 臂**夹在两个对照之间**（对强对照的区间全负、对弱对照的区间全正）');
const best = rows.slice().sort((x, y) => (y.vsMax ? y.vsMax.mean : -1e9) - (x.vsMax ? x.vsMax.mean : -1e9))[0];
console.log('\n=== 主终点（跑前写死）：最好的 swap 臂 − max(AAA, BBB) ===');
if (best && best.vsMax) {
  const b = best.vsMax;
  console.log('  ' + best.arm + ' − ' + M + ' = **' + b.mean.toFixed(2) + 'pt** [' + b.lo.toFixed(2) + ', ' + b.hi.toFixed(2) + ']' +
    '（配对 n=' + b.n + ' 桌，SE=' + b.se.toFixed(2) + 'pt）');
  console.log('  6 个臂里最大的这一个 ⇒ 按 6 次比较的 Bonferroni 级门槛，需要 |t| > ' +
    (Math.abs(invNorm(1 - ALPHA / (2 * Math.max(1, names.length))))).toFixed(2) +
    '（本条实测 t=' + (b.mean / b.se).toFixed(2) + '）');
}

/* 反巧合：两个方向都要有"高于两个对照"的臂 */
const dirAB = rows.filter(r => /^A2B/.test(r.arm));
const dirBA = rows.filter(r => /^B2A/.test(r.arm));
const hitAB = dirAB.filter(r => r.aboveBoth), hitBA = dirBA.filter(r => r.aboveBoth);
console.log('\n=== 反巧合条款 ===');
console.log('  A→B 方向有 ' + hitAB.length + '/' + dirAB.length + ' 个回合点高于两个对照 ‖ B→A 方向 ' + hitBA.length + '/' + dirBA.length + ' 个');
const bothDirections = hitAB.length > 0 && hitBA.length > 0;
console.log('  ⇒ ' + (bothDirections
  ? '两个方向**都**出高于对照的臂 ⇒ 允许判 ① 的候选（还要看主终点区间）'
  : '两个方向不同时成立 ⇒ 按条款，这份"收益"不能算阶段调度（更可能就是"晚段该用更强那粒"）'));

let verdict;
if (best && best.vsMax && best.vsMax.lo > 0 && bothDirections) {
  verdict = '① 阶段条件化在不调用任何环境识别的前提下就赚钱（区间不跨 0 且两方向同向）';
} else if (!(best && best.vsMax && best.vsMax.lo > 0)) {
  verdict = '② 阶段调度不赚钱（最好的 swap 臂相对两个对照的配对区间跨 0 或为负）';
} else {
  verdict = '②′ 主终点为正但**反巧合条款没过** ⇒ 只能判"晚段换用更强那粒"，不能判阶段调度';
}
console.log('\n=== 判读（按 §E136 第 3 节写死的规则）===');
console.log('  ' + verdict);
console.log('  ⚠ 停止规则：8 臂跑完就结案，不加回合点（R=20/25 属扫参）、不加第三粒包。');

/* ---- 5) 描述性（**跑后加的解释，不是预注册判据**）：换包臂的读数是否只是"在两粒包之间按暴露时长插值" ----
 * 模型：一局的平均回合数 T（各臂实测几乎相等 ⇒ 用各自自己的 T），前 R-1 回用 X、之后用 Y
 *      ⇒ 预测 1st = f_X · X + (1 − f_X) · Y，f_X = (R−1)/T。
 * 为什么要印它：如果每个 swap 臂都落在两对照**之间**、且偏离插值只有零点几 pt，
 *   那"阶段调度"买到的东西就是"混用两粒包"本身，而不是"某个阶段该用某种打法" ⇒ 这才是 ② 的机制解释。 */
if (existsSync(DIR + '/' + CTRL[0] + '.txt')) {
  const avgRounds = function (arm) {
    const p = DIR + '/' + arm + '.txt';
    if (!existsSync(p)) return null;
    const m = readFileSync(p, 'utf8').match(/平均回合=([0-9.]+)/);
    return m ? Number(m[1]) : null;
  };
  const gapAB = agg[CTRL[0]].first - agg[CTRL[1]].first;
  console.log('\n=== 描述性：暴露插值模型（跑后加的，不参与判读）===');
  console.log('  对照差 = ' + (gapAB * 100).toFixed(2) + 'pt ‖ 平均回合数：' + CTRL[0] + '=' + avgRounds(CTRL[0]) + ' ‖ ' + CTRL[1] + '=' + avgRounds(CTRL[1]));
  for (const r of rows) {
    const m = r.arm.match(/^(A2B|B2A)-at(\d+)$/);
    const T = avgRounds(r.arm);
    if (!m || !T) { console.log('  `' + r.arm + '` 无法套模型（名字不合 `A2B-atR`/`B2A-atR` 或缺 `平均回合`）'); continue; }
    const R = Number(m[2]);
    const fBase = (R - 1) / T;
    const fA = r.arm[0] === 'A' ? fBase : 1 - fBase;   // A 臂：前 R-1 回用 A；B 臂：之后才用 A
    const pred = (agg[CTRL[1]].first + fA * gapAB) * 100;
    console.log('  `' + r.arm + '` 实测 ' + (r.first * 100).toFixed(2) + '% ‖ 插值预测 ' + pred.toFixed(2) +
      '% ‖ 差 ' + ((r.first * 100) - pred).toFixed(2) + 'pt（A 暴露份额 ' + (fA * 100).toFixed(0) + '%）');
  }
  const inside = rows.filter(r => r.first < Math.max(agg[CTRL[0]].first, agg[CTRL[1]].first) &&
    r.first > Math.min(agg[CTRL[0]].first, agg[CTRL[1]].first)).length;
  console.log('  ⇒ ' + inside + '/' + rows.length + ' 个 swap 臂**落在两个对照之间**（没有一个越过较好的那粒）');
}

function normCdf(x) {
  /* Abramowitz & Stegun 7.1.26 的 erf 近似（最大误差 1.5e-7）⇒ 门槛文案只要 3 位数，够用。
   * ⚠ Φ(x) = 0.5(1 + erf(x/√2)) —— **少除这一个 √2 就会把 z_{0.975} 从 1.96 算成 1.39**（自检 ② 钉这条）。 */
  const u = x / Math.SQRT2, s = u < 0 ? -1 : 1; const a = Math.abs(u);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-a * a);
  return 0.5 * (1 + s * y);
}
function invNorm(p) {
  let lo = -8, hi = 8;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (normCdf(m) < p) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
