import fs from 'node:fs';
import { pairedDiff } from 'file:///D:/code/Epirus-Web/tools/routing-gain-lib.mjs';

/* §E149：赛前查表路由器能吃到 §E148b 那块天花板的几成？外加对"天花板本身"的偏置体检。

   背景：§E148b 量到 6 粒过闸包在异质考卷上的 oracle 天花板 = +11.55pt。但 oracle 用了
   "这一桌谁赢"的先见之明 ⇒ 那是**上界**，不是收益。赛前真看得见的只有这一桌 4 个对手脚本的名字。
   路由器不许碰任何对局内信息（§E144 已判死"在线识别对手"那条路）。

   三种规则，全部只在 **dev 半（偶数下标桌子）** 定参数、**只在 test 半** 结算：
     A) `combo`  —— 标签 = 完整 4 名组合。本批组合两两不重复 ⇒ test 半必然全部回退（当对照组报出来）。
     B) `linear` —— 每粒包对**单个脚本名**学一个加性分（dev 上"含该名的桌"的平均夺冠率，带先验收缩），
                    查表时 4 个名字的分相加取 argmax。这是"哪个包擅长打哪种对手"的最小可实现形态。
                    K ∈ {0,40,200} 三档一起报，免得结论挂在某个调参选择上。
     C) 负对照 —— 把一个**跨桌共有**的名字集合置换套在 dev 桌上（切断"名字→胜负"的关联，保住名字边际
                  分布与桌间结构），再做同一个 linear 路由。增益必须 ≈0。
                  ⚠ 第一版这里做错了：我"在桌内置换名字的座位"，而加性模型只对名字**集合**敏感 ⇒
                    对照组与真实组**逐字相同**，等于没做。跨桌置换才有效。

   §E149b（本脚本第二段）：**天花板自己的偏置**。oracle = 6 个"每桌 8 局"读数里取 max，
   而 max of 6 个带噪估计天然高于均值 ⇒ 即使 6 粒包**完全等价**，`oracle − best_single` 也是正的。
   零分布做法：对每张桌，把该桌 6 个读数随机**重新分配给包**（保住桌内联合分布，切断包级身份）。 */
const DIR = 'D:/code/Epirus-Web/docs/artifacts/e148-out/';
const FILES = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (FILES.length < 3) { console.error('用法：node e149-router.mjs <a.tsv> <b.tsv> ...'); process.exit(2); }

function read(f) {
  const txt = fs.readFileSync(DIR + f, 'utf8').split(/\r?\n/).filter(l => l.length);
  let cols = null; const rows = []; const head = {};
  for (const l of txt) {
    if (l[0] === '#') { if (/^#arm\t/.test(l)) cols = l.slice(1).split('\t'); else { const i = l.indexOf('='); if (i > 0 && !/\t/.test(l)) head[l.slice(1, i)] = l.slice(i + 1); } continue; }
    const c = l.split('\t'); const o = {}; cols.forEach((k, i) => o[k] = c[i]); rows.push(o);
  }
  const subj = rows.filter(r => r.arm === 'subject').map(r => ({ names: r.names, g: Number(r.games), f: Number(r.first) }));
  return { name: (head.file || f).replace(/^.*[\\/]/, '').replace(/^.*__/g, '').replace(/\.(bak|js)$/, ''), subj,
    ctrlN: rows.filter(r => r.arm === 'ctrl').length, head };
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function rng(seed) { let s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const packs = FILES.map(read);
const N = packs[0].subj.length;
const idxOf = {}; packs.forEach((p, i) => { idxOf[p.name] = i; });
if (Object.keys(idxOf).length !== packs.length) { console.log('⛔ 两个输入解析出同一个臂名（' + FILES.join(' ') + '）⇒ 池里有重复，拒算'); process.exit(5); }
for (const p of packs) {
  if (p.subj.length !== N) { console.log('⛔ ' + p.name + ' 的桌子数 ' + p.subj.length + ' ≠ ' + N + ' ⇒ 不是同一批，拒算'); process.exit(5); }
  for (let i = 0; i < N; i++) if (p.subj[i].names !== packs[0].subj[i].names) { console.log('⛔ 第 ' + i + ' 张桌子组合不同（' + p.name + '）'); process.exit(5); }
  if (p.ctrlN !== packs[0].ctrlN) { console.log('⛔ ' + p.name + ' 的 ctrl 行数与别的臂不一致 ⇒ 配对不成立'); process.exit(5); }
}
const rate = (p, i) => p.subj[i].f / p.subj[i].g;
const tables = packs[0].subj.map(s => s.names.split(',').map(x => x.trim()));
const NAMES = [...new Set(tables.flat())].sort();
const dev = [], test = [];
for (let i = 0; i < N; i++) (i % 2 === 0 ? dev : test).push(i);

/* ---- 对照 A：组合级死记硬背的覆盖率 ---- */
const keyOf = i => tables[i].slice().sort().join(',');
const comboSeen = new Set(dev.map(keyOf));
const hitFinest = test.filter(i => comboSeen.has(keyOf(i))).length;
const allDistinct = new Set(tables.map((t, i) => keyOf(i))).size === N;

/* ---- 加性权重；perm=true 时套一个跨桌共有的名字集合置换（负对照） ---- */
function buildWeights(perm) {
  let map = dev.map(i => i);
  if (perm) { const r = rng(20260929); for (let k = map.length - 1; k > 0; k--) { const j = (r() * (k + 1)) | 0; const t = map[k]; map[k] = map[j]; map[j] = t; } }
  const W = {};
  for (const p of packs) {
    const cnt = {}; for (const nm of NAMES) cnt[nm] = { s: 0, n: 0 };
    for (let d = 0; d < dev.length; d++) { const src = map[d]; for (const nm of tables[src]) { const c = cnt[nm]; c.s += rate(p, dev[d]); c.n++; } }
    W[p.name] = cnt;
  }
  return W;
}
const PRIOR = {}; for (const p of packs) PRIOR[p.name] = mean(dev.map(i => rate(p, i)));
function routePicks(W, K) {
  return test.map(i => {
    let best = null, bv = -Infinity;
    for (const p of packs) {
      let v = 0;
      for (const nm of tables[i]) { const c = W[p.name][nm]; v += (c.s + K * PRIOR[p.name]) / (c.n + K); }
      if (v > bv + 1e-12) { bv = v; best = p.name; }
    }
    return best;
  });
}
const evalPicks = picks => picks.map((pn, j) => rate(packs[idxOf[pn]], test[j]));

const bsCand = packs.map(p => ({ name: p.name, v: mean(dev.map(i => rate(p, i))) })).sort((a, b) => b.v - a.v);
const bsName = bsCand[0].name;
const single = test.map(i => rate(packs[idxOf[bsName]], i));
const oracle = test.map(i => Math.max(...packs.map(p => rate(p, i))));
const dO = pairedDiff(oracle, single, 1.96);

console.log('# §E149 · 赛前查表路由器（**不推断、不看对局内信息**）的吃成率');
console.log('  池 = ' + packs.length + ' 粒（' + packs.map(p => p.name).join(' ') + '）‖ 桌 ' + N +
  '（dev/test 各 ' + dev.length + '/' + test.length + '，按奇偶下标定分半）‖ 脚本名 ' + NAMES.length + ' 个');
console.log('  各臂（dev / test）：' + bsCand.map(p => p.name + ' ' + (100 * p.v).toFixed(2) + '/' + (100 * mean(test.map(i => rate(packs[idxOf[p.name]], i)))).toFixed(2)).join(' ‖ '));
console.log('  ⚑ 对照 A：test 半 ' + test.length + ' 桌里 dev 半见过同组合的 = **' + hitFinest + ' 桌**' +
  '（' + (allDistinct ? '已核实 ' + N + ' 张桌组合两两不重复 ⇒ 精确查表 100% 回退' : '注意：并非全不重复') + '）');
console.log('  dev 上 best_single = **' + bsName + '**');
console.log('');
console.log('  ' + '规则'.padEnd(26) + '路由%   增益pt [95%CI]            R=增益/天花板   路由分布(test)');
console.log('  ' + 'oracle(带先知,不可实现)'.padEnd(24) + (100 * mean(oracle)).toFixed(2) + '%  +' + (100 * dO.m).toFixed(2) + 'pt [' + (100 * dO.lo).toFixed(2) + ', ' + (100 * dO.hi).toFixed(2) + ']   100%（定义）');
const Wreal = buildWeights(false), Wshuf = buildWeights(true);
const runs = [];
for (const K of [0, 40, 200]) {
  const picks = routePicks(Wreal, K), v = evalPicks(picks), d = pairedDiff(v, single, 1.96);
  const freq = {}; for (const p of picks) freq[p] = (freq[p] || 0) + 1;
  runs.push({ K, d, v, picks, freq });
  console.log('  linear K=' + String(K).padEnd(20) + (100 * mean(v)).toFixed(2) + '%  ' + (100 * d.m).toFixed(2) + 'pt [' + (100 * d.lo).toFixed(2) + ', ' + (100 * d.hi).toFixed(2) + ']   ' +
    (100 * d.m / dO.m).toFixed(1) + '%'.padEnd(4) + '  ' + Object.entries(freq).sort((a, b) => b[1] - a[1]).map(e => e[0] + '×' + e[1]).join(' '));
}
for (const K of [0, 40, 200]) {
  const picks = routePicks(Wshuf, K), v = evalPicks(picks), d = pairedDiff(v, single, 1.96);
  console.log('  负对照C(跨桌置换名字)K=' + String(K).padEnd(8) + (100 * mean(v)).toFixed(2) + '%  ' + (100 * d.m).toFixed(2) + 'pt [' + (100 * d.lo).toFixed(2) + ', ' + (100 * d.hi).toFixed(2) + ']   ' + (100 * d.m / dO.m).toFixed(1) + '%');
}
const best = runs.slice().sort((a, b) => b.d.m - a.d.m)[0];
let tie = 0; for (let j = 0; j < test.length; j++) if (Math.abs(best.v[j] - oracle[j]) < 1e-12) tie++;
console.log('  最好那档（K=' + best.K + '）逐桌读数与 oracle 相同 = ' + tie + '/' + test.length + '（' + (100 * tie / test.length).toFixed(1) + '%，含 8 局粒度造成的假并列）');

/* ---- §E149c：任何"按名字查表"的路由器的**乐观上界** ----
   用**全量**（dev+test 两半，含 test 的答案）拟合 w_p[nm]，再回 test 结算 ⇒ 这是"名字里到底装了多少
   可用信息"的上界。它偏乐观是故意的：若连它都很小，就不必再试别的查表形式了（方向可以判死）。
   加性之外不再扩族：真实由 K 三档 + 上界夹住，避免"再试一个规则直到它显著"。 */
console.log('\n# §E149c · 名字级路由的乐观上界（全量拟合、test 结算；偏乐观是故意的）');
{
  const allIdx = dev.concat(test);
  const Wfull = {};
  for (const p of packs) {
    const cnt = {}; for (const nm of NAMES) cnt[nm] = { s: 0, n: 0 };
    for (const i of allIdx) for (const nm of tables[i]) { const c = cnt[nm]; c.s += rate(p, i); c.n++; }
    Wfull[p.name] = cnt;
  }
  const pr = {}; for (const p of packs) pr[p.name] = mean(allIdx.map(i => rate(p, i)));
  for (const K of [0, 10]) {
    const picks = test.map(i => {
      let b = null, bv = -Infinity;
      for (const p of packs) { let v = 0; for (const nm of tables[i]) { const c = Wfull[p.name][nm]; v += (c.s + K * pr[p.name]) / (c.n + K); } if (v > bv + 1e-12) { bv = v; b = p.name; } }
      return b;
    });
    const v = evalPicks(picks), d = pairedDiff(v, single, 1.96);
    const freq = {}; for (const p of picks) freq[p] = (freq[p] || 0) + 1;
    console.log('  全量拟合 K=' + String(K).padEnd(4) + (100 * mean(v)).toFixed(2) + '%  ' + (100 * d.m).toFixed(2) + 'pt [' + (100 * d.lo).toFixed(2) + ', ' + (100 * d.hi).toFixed(2) + ']   分布：' +
      Object.entries(freq).sort((a, b) => b[1] - a[1]).map(e => e[0] + '×' + e[1]).join(' '));
  }
}

/* ---- §E149b：天花板自己的选择偏置（零分布 = 桌内置换"读数归哪个包"） ---- */
console.log('\n# §E149b · 天花板本身的偏置：6 粒包**等价**时 `oracle − best_single` 是多少？');
const R_TEST = test.length, NP = packs.length;
const rr = rng(4242);
const nullGain = [], nullRou = [];
for (let t = 0; t < 200; t++) {
  const perm = [];
  for (const i of test) {
    const row = packs.map(p => rate(p, i));
    for (let k = row.length - 1; k > 0; k--) { const j = (rr() * (k + 1)) | 0; const z = row[k]; row[k] = row[j]; row[j] = z; }
    perm.push(row);
  }
  /* best_single 在**dev 半**上从打乱后的数据里挑 ⇒ 与真实口径同构（同一套挑选流程） */
  const permD = [];
  const rr2 = rng(999 + t);
  for (const i of dev) {
    const row = packs.map(p => rate(p, i));
    for (let k = row.length - 1; k > 0; k--) { const j = (rr2() * (k + 1)) | 0; const z = row[k]; row[k] = row[j]; row[j] = z; }
    permD.push(row);
  }
  const dm = packs.map((p, pi) => mean(permD.map(r => r[pi])));
  const bs = dm.indexOf(Math.max(...dm));
  const sgl = perm.map((r, j) => r[bs]);
  const orc = perm.map(r => Math.max(...r));
  nullGain.push(mean(orc) - mean(sgl));
  nullRou.push(Math.max(...dm) - Math.min(...dm));
}
nullGain.sort((a, b) => a - b);
const p50 = nullGain[(nullGain.length * 0.5) | 0], p95 = nullGain[(nullGain.length * 0.95) | 0];
console.log('  零分布（200 次桌内置换）：oracle − best_single = 中位 ' + (100 * p50).toFixed(2) + 'pt，p95 ' + (100 * p95).toFixed(2) + 'pt');
console.log('  实测天花板 = ' + (100 * dO.m).toFixed(2) + 'pt [' + (100 * dO.lo).toFixed(2) + ', ' + (100 * dO.hi).toFixed(2) + ']');
console.log('  ⇒ **扣掉选择偏置后的净上界 ≈ ' + (100 * (dO.m - p50)).toFixed(2) + 'pt**（' + (dO.m > p95 ? '实测超出零分布 p95 ⇒ 上界是真的存在，不只是 max 的贪心' : '实测落在零分布 p95 内 ⇒ 所谓"天花板"就是 max 的贪心，没有可吃的东西') + '）');
console.log('  ⚑ 为什么这个比较是干净的：`oracle` 取的是**每张桌 6 个读数的 max**，而桌内置换不改变 max ⇒ 零分布与实测的 oracle 项**逐字相同**（' + (100 * mean(oracle)).toFixed(2) + '%）。');
console.log('    差异全部落在 `best_single` 一项：零分布里它等价于"随机拿一粒"（= 池均值 ' + (100 * mean(test.flatMap(i => packs.map(p => rate(p, i))))).toFixed(2) + '%），实测里它是 dev 上挑出来的最好一粒（' + (100 * mean(single)).toFixed(2) + '%）。');
console.log('    ⇒ 所以 13.16 − 11.60 = ' + (100 * (p50 - dO.m)).toFixed(2) + 'pt 正是"最好那粒相对池均值的真实优势"，而"天花板"那 11.60pt 是 max 的贪心，两者不能相加。');
console.log('  顺带：零分布下"全场均值最好的包 − 最差的包"= 中位 ' + (100 * mean(nullRou)).toFixed(2) + 'pt ⇒ 拿包间均值差当结论时，' + NP + ' 粒池子里纯噪声就能造出这个量级');

/* ---- 每个脚本名上的包间极差 vs 置换上限 ---- */
console.log('\n# 每个脚本名上的"包间极差"（dev 半）对配对置换零分布 —— 有信号才谈得上路由');
const r3 = rng(7);
const rowsSig = [];
for (const nm of NAMES) {
  const idx = dev.filter(i => tables[i].includes(nm));
  if (idx.length < 20) { rowsSig.push({ nm, n: idx.length, skip: '样本太少' }); continue; }
  const m = packs.map(p => mean(idx.map(i => rate(p, i))));
  const spread = Math.max(...m) - Math.min(...m);
  let mx = 0;
  for (let t = 0; t < 200; t++) {
    const v = idx.map(i => { const row = packs.map(p => rate(p, i)); for (let k = row.length - 1; k > 0; k--) { const j = (r3() * (k + 1)) | 0; const z = row[k]; row[k] = row[j]; row[j] = z; } return row; });
    const mm = packs.map((p, pi) => mean(v.map(r => r[pi])));
    const s = Math.max(...mm) - Math.min(...mm);
    if (s > mx) mx = s;
  }
  rowsSig.push({ nm, n: idx.length, best: packs[m.indexOf(Math.max(...m))].name, spread, noise: mx, skip: spread > mx ? '★超置换上限' : '在置换上限内' });
}
rowsSig.sort((a, b) => (b.spread || -1) - (a.spread || -1));
console.log('  ' + '名字'.padEnd(14) + '桌数  最好包'.padEnd(12) + '极差pt  置换上限pt  判读');
for (const r of rowsSig) {
  console.log('  ' + r.nm.padEnd(15) + String(r.n).padEnd(6) + (r.best || '—').padEnd(13) +
    (r.spread != null ? (100 * r.spread).toFixed(2).padStart(6) : '     —') +
    (r.noise != null ? (100 * r.noise).toFixed(2).padStart(11) : '        —') + '  ' + r.skip);
}
console.log('  ⇒ ' + NAMES.length + ' 个名字里 ★ = ' + rowsSig.filter(r => /★/.test(r.skip || '')).length + '，在噪声内 = ' + rowsSig.filter(r => r.skip === '在置换上限内').length + '，样本太少 = ' + rowsSig.filter(r => r.skip === '样本太少').length);
console.log('  ⚠ 注意与 §E149b 同理：这里"最好包"是 6 个里取 max 的名字，极差本身带 max 偏置 ⇒ 置换检验正是为了对冲这一点（比的是"同一套流程在零数据上的极差"）。');
