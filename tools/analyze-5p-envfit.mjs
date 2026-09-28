#!/usr/bin/node
/* ============================================================================
 * analyze-5p-envfit.mjs —— §E142 判读：**5P 产品口径**上"按环境换包"的上界有多少
 *
 * 用法：node tools/analyze-5p-envfit.mjs --dir=docs/artifacts/e142-out
 * 只读 `probe-5p-envfit.mjs` 落下的逐环境账，一局不重跑。
 *
 * 两个"上界"必须分开读（这是 §E137"19 选 1 自带选择偏差"那条教训的直接延伸）：
 *   · **in-sample oracle**（跑前写死的主判据）：`max over 15 粒` 直接取每格最大值 ⇒ 它**天生偏高**，
 *     因为 15 个带噪声的估计取最大，选出来的往往是"这一格运气好的那粒"。
 *   · **split-half oracle**（免费的对照）：用 seed 档 0 的那一半**挑包**、用 seed 档 1 的那一半**算钱**（两个方向各算一次再平均）。
 *     这才是"如果我真拿这套矩阵去做决策，实际能兑现多少"的无偏估计。
 *   ⇒ 两者之差就是"上界里有多少是选出来的、多少是真的"。判读按**预注册的主判据（in-sample）**走，
 *     但两个数必须一起印出来，不许只报好看的那个。
 * ==========================================================================*/
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { pairedDiff } from './routing-gain-lib.mjs';

const arg = function (k, d) { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : d; };
const DIR = arg('dir', 'docs/artifacts/e142-out');
const BAR = Number(arg('bar', 2));           // 预注册那条 2pt 线（选包空间实测只有 ≈0.8pt）

if (!existsSync(DIR)) { console.error('目录不存在: ' + DIR); process.exit(2); }
const files = readdirSync(DIR).filter(f => f.endsWith('.tsv'));
if (files.length < 3) { console.error('至少要有 3 粒包的账才能算上界（实测 ' + files.length + '）'); process.exit(2); }

/* pack -> env -> {games, first} 以及 seed 两半 */
const D = {};
let ENVS = null, N = 0, GAMES = 0, SEEDS = null, MIX = null;
for (const f of files) {
  const txt = readFileSync(DIR + '/' + f, 'utf8');
  const pack = (/^#pack=(.*)$/m.exec(txt) || [, f.replace(/\.tsv$/, '')])[1];
  const g = Number((/^#games=(.*)$/m.exec(txt) || [, '0'])[1]);
  const seeds = (/^#seeds=(.*)$/m.exec(txt) || [, ''])[1].split(',').map(Number);
  const n = Number((/^#n=(.*)$/m.exec(txt) || [, '5'])[1]);
  /* `#mix=` 是 §E143 才加的字段 ⇒ 老产物（§E142 那批）没有它，按"满席原型 = n−1"解释，
   * 但**一批目录里混了不同 k 就必须拒**（那是两个构造，不是一个实验）。 */
  const mxRaw = (/^#mix=(.*)$/m.exec(txt) || [, ''])[1];
  const mx = mxRaw === '' ? n - 1 : Number(mxRaw);
  if (MIX !== null && mx !== MIX) { console.error('目录里混了不同构造（`--mix` ' + MIX + ' vs ' + mx + '，文件 ' + f + '）⇒ 那是两个实验，拒绝合算'); process.exit(2); }
  MIX = mx;
  if (N && n !== N) { console.error('目录里混了不同人数（' + N + ' vs ' + n + '，包 ' + pack + '）⇒ 拒绝合算'); process.exit(2); }
  if (GAMES && g !== GAMES) { console.error('目录里混了不同剂量（' + GAMES + ' vs ' + g + '，包 ' + pack + '）⇒ 拒绝合算'); process.exit(2); }
  N = n; GAMES = g;
  if (SEEDS && SEEDS.join() !== seeds.join()) { console.error('目录里混了不同 seed 档（' + SEEDS.join() + ' vs ' + seeds.join() + '）'); process.exit(2); }
  SEEDS = seeds;
  const rows = txt.split('\n').filter(l => l && l[0] !== '#' && !/^env\t/.test(l));
  const byEnv = {}, bySeed = {};
  for (const line of rows) {
    const c = line.split('\t');
    if (c.length < 6) continue;
    const env = c[0], sd = Number(c[1], 10), games = Number(c[3], 10), first = Number(c[4], 10);
    byEnv[env] = byEnv[env] || { games: 0, first: 0, inPool: c[2] === '1' };
    if (byEnv[env].inPool !== (c[2] === '1')) { console.error('环境 ' + env + ' 的池内/池外标记在同一份产物里自相矛盾 ⇒ 拒绝合算'); process.exit(2); }
    byEnv[env].games += games; byEnv[env].first += first;
    bySeed[env] = bySeed[env] || {};
    bySeed[env][sd] = games ? first / games : NaN;
    if (!byEnv[env].games) continue;
  }
  D[pack] = { rate: byEnv, half: bySeed };
  const keys = Object.keys(byEnv);
  if (ENVS === null) ENVS = keys.sort();
  else if (keys.length !== ENVS.length) { console.error('包 ' + pack + ' 的环境数(' + keys.length + ')与别的包(' + ENVS.length + ')不同 ⇒ 分母不一致，拒绝合算'); process.exit(2); }
}
const packs = Object.keys(D).sort();
for (const p of packs) for (const e of ENVS) {
  if (!D[p].rate[e] || D[p].rate[e].games === 0) { console.error('包 ' + p + ' 缺环境 ' + e + ' 的账 ⇒ 上界无从算起（一个环境都不许静默丢）'); process.exit(2); }
}
const rate = (p, e) => D[p].rate[e].first / D[p].rate[e].games;
const pt = (x) => (x * 100).toFixed(2) + '%';

/* ---- 全局一招鲜：所有环境**平均**夺冠率最高的那粒 ---- */
const mean = {};
for (const p of packs) mean[p] = ENVS.reduce((a, e) => a + rate(p, e), 0) / ENVS.length;
const bestSingle = packs.slice().sort((a, b) => mean[b] - mean[a])[0];
const rankAll = packs.slice().sort((a, b) => mean[b] - mean[a]);

/* ---- in-sample oracle ---- */
const oracleOf = (e) => { let bp = packs[0]; for (const p of packs) if (rate(p, e) > rate(bp, e)) bp = p; return bp; };
const head = ENVS.map(e => (rate(oracleOf(e), e) - rate(bestSingle, e)) * 100);
const oracleMean = ENVS.reduce((a, e) => a + rate(oracleOf(e), e), 0) / ENVS.length;
const hs = pairedDiff(head, head.map(() => 0));

/* ---- split-half oracle（两向平均）---- */
function halfOracle(pickSeed, scoreSeed) {
  const acc = [];
  for (const e of ENVS) {
    let bp = null;
    for (const p of packs) {
      const v = D[p].half[e] && D[p].half[e][pickSeed];
      if (v == null || !isFinite(v)) continue;
      if (bp === null || v > D[bp].half[e][pickSeed]) bp = p;
    }
    const chosen = (D[bp] && D[bp].half[e] && D[bp].half[e][scoreSeed]) || 0;
    const base = (D[bestSingle] && D[bestSingle].half[e] && D[bestSingle].half[e][scoreSeed]) || 0;
    acc.push((chosen - base) * 100);
  }
  return acc;
}
const halves = [halfOracle(SEEDS[0], SEEDS[1]), halfOracle(SEEDS[1], SEEDS[0])];
const splitArr = ENVS.map((e, i) => (halves[0][i] + halves[1][i]) / 2);
const ss = pairedDiff(splitArr, splitArr.map(() => 0));

/* ---- 最优包分布（"按环境换包"到底是不是伪命题）---- */
const tally = {};
for (const e of ENVS) { const p = oracleOf(e); tally[p] = (tally[p] || 0) + 1; }
const distinct = Object.keys(tally).length;

/* ---- 池内 / 池外（标记直接从解析出的账里取，**不再按文件名去重读文件**：
 *      产物文件名与 `#pack=` 不必相同，靠文件名再读一遍会在文件名不同的目录上直接崩）---- */
const inPoolOf = {};
for (const e of ENVS) inPoolOf[e] = D[packs[0]].rate[e].inPool === true;
const inE = ENVS.filter(e => inPoolOf[e]), outE = ENVS.filter(e => !inPoolOf[e]);
const sub = function (list) {
  const a = list.map(e => (rate(oracleOf(e), e) - rate(bestSingle, e)) * 100);
  const b = list.map(e => { const i = ENVS.indexOf(e); return (halves[0][i] + halves[1][i]) / 2; });
  return [pairedDiff(a, a.map(() => 0)), pairedDiff(b, b.map(() => 0))];
};
const si = sub(inE), so = sub(outE);

/* ---------- 打印 ---------- */
console.log('=== §E142：5P 产品口径的"环境 × 包"矩阵 ===');
console.log('n=' + N + ' 人局 ‖ 构造 = 每桌原型 **' + MIX + '** 席 + 随机 ' + (N - 1 - MIX) + ' 席（`#mix=` 全目录一致才敢合算） ‖ ' +
  ENVS.length + ' 个原型（池内 ' + inE.length + ' / 池外 ' + outE.length + '）‖ ' +
  packs.length + ' 粒去重包 ‖ 每格 ' + GAMES * SEEDS.length + ' 局（seed 档 ' + SEEDS.join('/') + '）‖ 合计 ' +
  (ENVS.length * packs.length * GAMES * SEEDS.length) + ' 局');
console.log('全局一招鲜 = `' + bestSingle + '`（跨 33 原型平均 ' + pt(mean[bestSingle]) + '）');
console.log('包的平均夺冠率排名：' + rankAll.map(p => '`' + p + '` ' + pt(mean[p])).join(' ‖ '));
console.log('\nin-sample oracle 平均 = ' + pt(oracleMean) + ' ‖ 上界 = **' + hs.m.toFixed(2) + 'pt [' + hs.lo.toFixed(2) + ', ' + hs.hi.toFixed(2) + ']**（按原型配对，n=' + hs.n + '）');
console.log('split-half oracle（挑包与算钱分家）= **' + ss.m.toFixed(2) + 'pt [' + ss.lo.toFixed(2) + ', ' + ss.hi.toFixed(2) + ']**' +
  ' ‖ 与 in-sample 之差 = ' + (hs.m - ss.m).toFixed(2) + 'pt（= 上界里"选出来的"那部分）');
console.log('单格噪声：每格 ' + (GAMES * SEEDS.length) + ' 局 ⇒ 单格 ±1.96SE ≈ ' +
  (1.96 * Math.sqrt(0.25 / (GAMES * SEEDS.length)) * 100).toFixed(2) +
  'pt ⇒ ' + packs.length + ' 粒取最大**必然抬高** in-sample 上界；抬高量不套公式，**用上面两行之差实测**（in-sample − split-half）');
console.log('\n33 个原型的最优包分布在 **=' + distinct + ' 粒** 上：' +
  Object.keys(tally).sort((a, b) => tally[b] - tally[a]).map(p => '`' + p + '`×' + tally[p]).join(' ‖ '));
console.log('  池内子集：in-sample ' + si[0].m.toFixed(2) + ' [' + si[0].lo.toFixed(2) + ', ' + si[0].hi.toFixed(2) + '] ‖ split-half ' + si[1].m.toFixed(2) + ' [' + si[1].lo.toFixed(2) + ', ' + si[1].hi.toFixed(2) + ']');
console.log('  池外子集：in-sample ' + so[0].m.toFixed(2) + ' [' + so[0].lo.toFixed(2) + ', ' + so[0].hi.toFixed(2) + '] ‖ split-half ' + so[1].m.toFixed(2) + ' [' + so[1].lo.toFixed(2) + ', ' + so[1].hi.toFixed(2) + ']');

console.log('\n逐原型的 in-sample 增益（pt，按大小排序，前 12）：');
const per = ENVS.map(e => ({ env: e, ins: (rate(oracleOf(e), e) - rate(bestSingle, e)) * 100,
  sp: (halves[0][ENVS.indexOf(e)] + halves[1][ENVS.indexOf(e)]) / 2, win: oracleOf(e), pool: inPoolOf[e] }))
  .sort((a, b) => b.ins - a.ins);
for (const r of per.slice(0, 12)) console.log('  ' + r.env.padEnd(16) + (r.pool ? '[池内]' : '[池外]') +
  ' in-sample +' + r.ins.toFixed(1) + ' ‖ split-half +' + r.sp.toFixed(1) + ' ‖ 最优包=`' + r.win + '`');
const zero = per.filter(r => r.ins <= 0.001).length;
console.log('  ⇒ ' + zero + '/' + ENVS.length + ' 个原型上"换包"连 in-sample 都赚不到（一招鲜就是那一格的最优）');

let verdict;
const RULE = arg('rule', '142');
if (RULE === 'off') {
  console.log('\n=== 判读：本工具**不出判语**（--rule=off）===');
  console.log('  §E143 的规则（① split-half ≥6pt / ② <2pt / ③ 2~6pt）与 §E142 的那条（按 in-sample 区间 vs 2pt）**不是同一条**，');
  console.log('  所以这一档由 §E143 预注册那一节人工对表 —— 让一份代码同时印两种判语，迟早会有人把另一条的结论读过来。');
} else {
  if (hs.lo > BAR) verdict = '① 5P 上按环境换包仍然有钱（in-sample 下界 > ' + BAR + 'pt）';
  else if (hs.hi < BAR) verdict = '② 5P 上换包买不到比选包更多的钱（in-sample 上界 < ' + BAR + 'pt）';
  else verdict = '③ 分不出（区间跨过 ' + BAR + 'pt 这条线）⇒ 照写分不出，不加剂量';
  console.log('\n=== 判读（按 §E142 第 2 节写死的规则；主判据 = in-sample，阈值 ' + BAR + 'pt）===');
  console.log('  ' + verdict);
  console.log('  ⚠ 但请同时读 split-half 那一条：它是"真拿这套矩阵去做决策能兑现多少"的无偏估计。');
}
console.log('  ⚠ 停止规则：' + packs.length + ' 粒 × ' + ENVS.length + ' 原型 × 2 seed 档已跑完就结案，不加 seed、不加包、不加局数。');
