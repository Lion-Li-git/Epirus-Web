#!/usr/bin/node
/* ============================================================================
 * analyze-kpool-capture.mjs —— §E147 的追问：**赛前只能备 k 粒包**时，专才这条路实际吃得到多少
 *
 * 为什么要它：§E142/§E147 报的 `oracle − best_single` 是"**每个环境都恰好挑到最优那一粒**"的上界，
 * 而真实做法是"备一个 2~3 粒的小portfolio + 开局前选一粒"。⇒ 决策需要的数不是"上界多少"，
 * 而是"**池子大小 k 与吃到的份额**"的曲线：k=1 就是一招鲜（不必选人），k=|池| 才是 oracle。
 *
 * ⚠ 必须 split-half，否则会把"挑子集"的运气报成能力（§E143 的同一件事，那次 in-sample 比 split-half 高 2.27pt）：
 *   本工具的 seed 档天然是两半 —— `#seeds=0,1` 每环境两格读数 ⇒ **在档 0 上挑 k 粒子集，只在档 1 上算钱**（反向再跑一遍取平均）。
 *   所以叫 split-half，不叫"交叉验证"。
 *
 * 判据形状（跑前想清楚，别看完数再挑好看的 k）：报 k=1..|池| 全曲线 + 每档的"吃到的份额" =（k 池收益）/（oracle 收益）。
 *
 * 用法：node tools/analyze-kpool-capture.mjs --dir=docs/artifacts/e147-out/env [--metric=win] [--greedy=best-k-subset]
 *      [--self-test]  # 只跑合成夹具的手算自检（不读真产物）
 * ==========================================================================*/
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rejectUnknownFlags } from './audit-lib.mjs';
/* 配对差的算术只许有一份（门 D193/D198 的同族规矩）：与 `analyze-routing-gain` / `analyze-swap-gain` /
 *   `analyze-fitcal-ab` 共用 `routing-gain-lib.pairedDiff`（样本标准差 + 双侧 1.96）。 */
import { pairedDiff } from './routing-gain-lib.mjs';

const arg = (k, d) => { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : d; };
rejectUnknownFlags(process.argv.slice(2), ['dir', 'metric', 'self-test', 'verbose'], 'analyze-kpool-capture');
const DIR = arg('dir', '');
const SELF = process.argv.includes('--self-test');

/* ---------- 读一份逐环境账（probe-5p-envfit 的 --out 格式）---------- */
function readPack(file) {
  const txt = readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.length);
  if (txt[0] !== '#probe-5p-envfit') throw new Error(file + ' 不是 `probe-5p-envfit` 的产物（首行不是 #probe-5p-envfit）');
  const head = {}; const cells = [];
  for (const l of txt) {
    if (l[0] === '#') { const i = l.indexOf('='); if (i > 0 && !/\t/.test(l)) head[l.slice(1, i)] = l.slice(i + 1); continue; }
    const c = l.split('\t');
    cells.push({ env: c[0], seed: c[1], games: Number(c[3]), first: Number(c[4]) });
  }
  const seeds = String(head.seeds || '').split(',').filter(Boolean).map(Number);
  if (seeds.length !== 2) throw new Error(file + ' 的 `#seeds` 不是两档（实测 `' + head.seeds + '`）⇒ 没有两半就不许做 split-half');
  return { name: head.pack, cells, seeds, mix: head.mix, games: Number(head.games) };
}

/* ---------- 主算式：贪心挑 k 粒子集（在挑的那一半上），在另一半上按"每环境取子集内最优"结算 ---------- */
function rate(cell) { return cell.games > 0 ? cell.first / cell.games : NaN; }
function indexByEnv(packs, seed) {
  const envs = []; const m = {};
  for (const p of packs) {
    for (const c of p.cells) {
      if (Number(c.seed) !== seed) continue;
      if (!m[c.env]) { m[c.env] = {}; envs.push(c.env); }
      if (c.env in m[c.env]) throw new Error(p.name + ' 的环境 ' + c.env + ' 在 seed 档 ' + seed + ' 上有两格 ⇒ 产物被重复追加，分母不是账面上那个数');
      m[c.env][p.name] = rate(c);
    }
  }
  return { envs: envs.sort(), m };
}
function greedySubset(pick, k) {
  /* 目标 = 在"挑的那一半"上最大化"每环境子集内最优"的均值；贪心 + 稳定 tie-break（按名字），不保证全局最优 ⇒ 只当**下界构造**用 */
  const chosen = [];
  const all = Object.keys(pick.m[pick.envs[0]]);
  const score = (set) => {
    let s = 0;
    for (const e of pick.envs) { let b = -Infinity; for (const p of set) if (pick.m[e][p] > b) b = pick.m[e][p]; s += b; }
    return s / pick.envs.length;
  };
  for (let step = 0; step < k; step++) {
    let best = null, bv = -Infinity;
    for (const p of all) {
      if (chosen.indexOf(p) >= 0) continue;
      const v = score(chosen.concat([p]));
      if (v > bv + 1e-12 || (Math.abs(v - bv) <= 1e-12 && best && p < best)) { bv = v; best = p; }
    }
    if (!best) break;
    chosen.push(best);
  }
  return chosen;
}
function evalOn(ev, subset) {
  let s = 0, n = 0;
  for (const e of ev.envs) {
    let b = -Infinity;
    for (const p of subset) if (typeof ev.m[e][p] === 'number' && ev.m[e][p] > b) b = ev.m[e][p];
    if (b > -Infinity) { s += b; n++; }
  }
  return { value: n ? s / n : NaN, n };
}

function run(packs, label) {
  const s0 = indexByEnv(packs, 0), s1 = indexByEnv(packs, 1);
  /* 自检 ①：两半必须是**同一批环境**（否则"上界"的两套分母不同）*/
  if (s0.envs.join('|') !== s1.envs.join('|')) throw new Error('两半的环境名单不一致（' + s0.envs.length + ' vs ' + s1.envs.length + '）⇒ 不能做 split-half');
  /* 自检 ②：每个环境在两半都必须对**同一组包**有读数 */
  const names = packs.map(p => p.name).sort().join('|');
  for (const [tag, ix] of [['档0', s0], ['档1', s1]]) {
    for (const e of ix.envs) if (Object.keys(ix.m[e]).sort().join('|') !== names) throw new Error(tag + ' 环境 ' + e + ' 的包集合与全池不同 ⇒ 有包缺读数（缺读数不许按均值蒙）');
  }
  const K = packs.length;
  const mixOf = packs[0].mix == null ? 'n−1（产物里没有 `#mix` ⇒ §E142 那批的默认构造；一致性由 analyze-5p-envfit 的"`#mix` 全目录一致才合算"管）' : packs[0].mix;
  console.log('\n### ' + label + '　池=' + K + ' 粒 ‖ 环境=' + s0.envs.length + ' ‖ 每格 ' + packs[0].games + ' 局/档 ‖ 构造 mix=' + mixOf);
  console.log('  k  挑中的子集（档0 上贪心）                                     档1结算       档0挑/档1算  ⇒  合并   吃到份额（分母=合并 oracle 差）');
  const oracle = evalOn(s1, packs.map(p => p.name)).value, base1 = evalOn(s1, greedySubset(s0, 1)).value;
  const oracle2 = evalOn(s0, packs.map(p => p.name)).value, base1b = evalOn(s0, greedySubset(s1, 1)).value;
  const gain = function (v, b) { return (v - b); };
  /* ⚠ 分母必须与分子**同构**：分子 g 是两向平均，分母也必须用两向平均的 full。
   *   第一版把单向的 gA 除以合并的 full ⇒ 吐出过 **101%** 这种不可能的数 ——
   *   与 §E131 那次 "R=2.81（两套均值比大小）" 同族，本仓为它专门立过护栏。 */
  const full = (gain(oracle, base1) + gain(oracle2, base1b)) / 2;
  for (let k = 1; k <= K; k++) {
    const subA = greedySubset(s0, k), vA = evalOn(s1, subA).value;
    const subB = greedySubset(s1, k), vB = evalOn(s0, subB).value;
    const gA = gain(vA, base1), gB = gain(vB, base1b), g = (gA + gB) / 2;
    /* 区间：**逐环境配对**（同一环境、同一结算半，k 粒子集减 k=1 子集），两向合起来当 66 个配对观测。
       ⚠ 它**不含"子集是在另一半上挑的"这层选择不确定性** ⇒ 区间偏窄，只用于"这个数量级是不是 0"，不当精确显著性用。 */
    const oneA = greedySubset(s0, 1), oneB = greedySubset(s1, 1);
    const diffs = [];
    for (const e of s1.envs) {
      let bk = -Infinity, b1 = -Infinity;
      for (const p of subA) bk = Math.max(bk, s1.m[e][p]);
      for (const p of oneA) b1 = Math.max(b1, s1.m[e][p]);
      diffs.push(bk - b1);
    }
    for (const e of s0.envs) {
      let bk = -Infinity, b1 = -Infinity;
      for (const p of subB) bk = Math.max(bk, s0.m[e][p]);
      for (const p of oneB) b1 = Math.max(b1, s0.m[e][p]);
      diffs.push(bk - b1);
    }
    const pd = pairedDiff(diffs, diffs.map(() => 0), 1.96);
    console.log('  ' + String(k).padEnd(3) + subA.join(',').slice(0, 44).padEnd(46) +
      (100 * gA).toFixed(2).padStart(7) + 'pt ' + (100 * gB).toFixed(2).padStart(7) + 'pt ⇒ **' + (100 * g).toFixed(2) + 'pt**  ' +
      (full > 0 ? (100 * g / full).toFixed(0) : '—') + '%   ±95%(逐环境配对) [' + (pd ? (100 * pd.lo).toFixed(2) : '—') + ', ' + (pd ? (100 * pd.hi).toFixed(2) : '—') + '] n=' + (pd ? pd.n : 0));
  }
  return { K: K, envN: s0.envs.length };
}

/* ---------- 合成夹具自证（手算得出来的期望值，防止"曲线好看但算错"）---------- */
function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'kcap-'));
  const mk = function (name, rows) {
    /* 每格 100 局、first 给"拿第一的局数" ⇒ `first/games` 才是 ≤1 的夺冠率。
       （第一版夹具写成 games=10 / first=90 ⇒ 算出 9.0，自证立刻红 —— 这条红是对的：它同时暴露了我
         把"百分比"直接当"计数"写的习惯，真产物里 first 是计数、不是百分数。） */
    const t = ['#probe-5p-envfit', '#pack=' + name, '#packFile=x', '#n=5', '#mix=4', '#games=100', '#seeds=0,1',
      '#envs=' + Object.keys(rows).length, '#env\tseed\tinPool\tgames\tfirst\tstrict'].join('\n') + '\n';
    let body = '';
    for (const e in rows) body += [e, 0, 1, 100, rows[e][0], 0].join('\t') + '\n' + [e, 1, 1, 100, rows[e][1], 0].join('\t') + '\n';
    writeFileSync(join(dir, name + '.tsv'), t + body);
  };
  /* 三环境 × 三粒：A 在 e1 最强、B 在 e2 最强、C 处处平庸但比 A/B 的弱项高一点点 */
  mk('A', { e1: [90, 80], e2: [10, 20], e3: [30, 30] });
  mk('B', { e1: [10, 20], e2: [90, 80], e3: [30, 30] });
  mk('C', { e1: [50, 40], e2: [50, 40], e3: [50, 60] });
  const packs = ['A', 'B', 'C'].map(n => readPack(join(dir, n + '.tsv')));
  const s0 = indexByEnv(packs, 0), s1 = indexByEnv(packs, 1);
  /* 手算期望：在档 0 上，k=1 贪心必选 C（.50+.50+.50)/3 = .50 > A (.90+.10+.30)/3 = .433 = B ⇒ 选 C
     k=2：C+A ⇒ 每环境 max = (.90,.50,.50) = .633；k=3 ⇒ (.90,.90,.50)=.767
     在档 1 上结算（A 的 e1 档1=80 ⇒ .80）：k=1 子集 {C} ⇒ (.40,.40,.60)/3 = .4667
       k=2 子集（档0 挑的 C,A）⇒ max(.80,.40,.60)/… = (.80+.40+.60)/3 = .6000
       k=3 ⇒ (.80,.80,.60)/3 = .7333
     ⇒ 收益（相对 k=1）：k=2 = .6000-.4667 = .1333 = **13.33pt**；k=3 = .7333-.4667 = 26.67pt */
  const k1 = greedySubset(s0, 1), k2 = greedySubset(s0, 2), k3 = greedySubset(s0, 3);
  const chk = function (label, got, want) {
    const okv = Math.abs(got - want) < 1e-9;
    console.log((okv ? '  ✔ ' : '  ✘ ') + label + ' 实得 ' + got.toFixed(6) + ' 期望 ' + want.toFixed(6));
    if (!okv) process.exitCode = 7;
  };
  console.log('# 合成夹具自证（手算）');
  chk('k=1 选中 C', k1.join(',') === 'C' ? 1 : 0, 1);
  chk('k=2 子集 = C,A', k2.join(',') === 'C,A' ? 1 : 0, 1);
  chk('档1 上 k=1 结算 .4667', evalOn(s1, k1).value, (0.40 + 0.40 + 0.60) / 3);
  chk('档1 上 k=2 结算 .6000', evalOn(s1, k2).value, (0.80 + 0.40 + 0.60) / 3);
  chk('档1 上 k=3 结算 .7333', evalOn(s1, k3).value, (0.80 + 0.80 + 0.60) / 3);
  chk('k=2 相对 k=1 的收益 13.33pt', 100 * (evalOn(s1, k2).value - evalOn(s1, k1).value), 100 * ((0.80 + 0.40 + 0.60) / 3 - (0.40 + 0.40 + 0.60) / 3));
  run(packs, '合成夹具（只为自证，不是结论）');
  console.log('\n' + (process.exitCode ? '⛔ 合成夹具手算不符 ⇒ 本工具的算术不可信，真产物也不要读' : '✔ 合成夹具与手算逐位一致 ⇒ 可以继续读真产物'));
  return;
}

if (SELF) { selfTest(); process.exit(process.exitCode || 0); }
if (!DIR || !existsSync(DIR)) { console.error('用法：--dir=<probe-5p-envfit 产物目录>（或 --self-test 跑合成夹具）'); process.exit(2); }
const files = readdirSync(DIR).filter(f => f.endsWith('.tsv'));
if (files.length < 3) { console.error('池子不足 3 粒（实测 ' + files.length + '）⇒ k 曲线没有意义'); process.exit(2); }
const packs = files.map(f => readPack(join(DIR, f)));
const mix = new Set(packs.map(p => p.mix));
if (mix.size > 1) { console.error('目录里混了多种构造 `#mix=' + Array.from(mix).join(',') + '` ⇒ 不同构造的读数不许放在一起算上界'); process.exit(2); }
console.log('# §E147 · k 粒组合的收益曲线（split-half：**档 0 挑子集、档 1 算钱**，再对称做一遍取平均）');
console.log('# 份额的分母 = oracle（每环境取全池最优）相对 k=1 的差 ⇒ 100% 意思是"这一档把上界全吃到了"');
/* 标签由目录名推，不写死：写死过一次 ⇒ 拿 15 粒的未受限目录跑，屏幕上却印"受限池（过体检闸的几粒）"
   —— 一个假的池子身份，比不印更坏。 */
run(packs, '池子来自 ' + DIR.replace(/\/$/, ''));
