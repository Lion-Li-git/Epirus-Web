import fs from 'node:fs';

/* §E149d：把 §E149b 的"天花板体检"套回 §E147 那张**同质环境**表上。
   §E147 报的是 `oracle − best_single`（33 个环境 · 每格 2 seed × 60 局 = 120 局 · 6 粒过闸包）。
   oracle = 每个环境上 6 个读数取 max ⇒ 天然带"取 max 的贪心"偏置，即使 6 粒包完全等价也是正的。
   零分布：对每个环境，把该环境的 6 个读数随机重新分配给包（保住格内联合分布与环境边际），
   跑**同一套** oracle/best_single 流程 ⇒ 得到"纯噪声能造出多大的假天花板"。 */
const DIR = (process.argv[2] || 'D:/code/Epirus-Web/docs/artifacts/e147-out/env/').replace(/\/?$/, '/');
const files = fs.readdirSync(DIR).filter(f => /\.tsv$/.test(f));
function read(f) {
  const txt = fs.readFileSync(DIR + f, 'utf8').split(/\r?\n/).filter(l => l.length);
  let cols = null; const rows = [];
  for (const l of txt) {
    if (l[0] === '#') { if (/^#env\t/.test(l)) cols = l.slice(1).split('\t'); continue; }
    const c = l.split('\t'); const o = {}; cols.forEach((k, i) => o[k] = c[i]); rows.push(o);
  }
  const byEnv = {};
  for (const r of rows) {
    const e = (byEnv[r.env] = byEnv[r.env] || { g: 0, f: 0, inPool: Number(r.inPool) });
    e.g += Number(r.games); e.f += Number(r.first);
  }
  return { name: f.replace(/\.tsv$/, ''), byEnv };
}
const packs = files.map(read);
const envs = Object.keys(packs[0].byEnv);
for (const p of packs) if (Object.keys(p.byEnv).length !== envs.length) { console.log('⛔ ' + p.name + ' 环境数不一致'); process.exit(5); }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function rng(seed) { let s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const rate = (p, e) => p.byEnv[e].f / p.byEnv[e].g;

function report(title, use) {
  const E = envs.filter(use);
  const orc = E.map(e => Math.max(...packs.map(p => rate(p, e))));
  const packMean = packs.map(p => mean(E.map(e => rate(p, e))));
  const bs = Math.max(...packMean);
  const grand = mean(E.flatMap(e => packs.map(p => rate(p, e))));
  const gap = mean(orc) - bs;
  /* 零分布 */
  const r = rng(31337), nulls = [];
  for (let t = 0; t < 400; t++) {
    const pm = {};
    for (const p of packs) pm[p.name] = {};
    for (const e of E) {
      const row = packs.map(p => rate(p, e));
      for (let k = row.length - 1; k > 0; k--) { const j = (r() * (k + 1)) | 0; const z = row[k]; row[k] = row[j]; row[j] = z; }
      packs.forEach((p, i) => { pm[p.name][e] = row[i]; });
    }
    const P = packs.map(p => ({ name: p.name, v: mean(E.map(e => pm[p.name][e])) }));
    const bsv = Math.max(...P.map(x => x.v));
    /* oracle 取的是"每个环境 6 个读数的 max"，对格内置换不变 ⇒ 零分布直接沿用真实 orc */
    nulls.push(mean(orc) - bsv);
  }
  nulls.sort((a, b) => a - b);
  console.log('  ' + title.padEnd(28) + '环境 ' + String(E.length).padEnd(5) +
    'oracle ' + (100 * mean(orc)).toFixed(2) + '%  best_single ' + (100 * bs).toFixed(2) + '%  池均值 ' + (100 * grand).toFixed(2) + '%');
  console.log('  ' + ''.padEnd(28) + '⇒ 实测天花板 **' + (100 * gap).toFixed(2) + 'pt** ‖ 零分布（包等价）中位 ' + (100 * nulls[200]).toFixed(2) + 'pt，p95 ' + (100 * nulls[380]).toFixed(2) + 'pt');
  console.log('  ' + ''.padEnd(28) + '⇒ 净上界 = 实测 − 零分布中位 = **' + (100 * (gap - nulls[200])).toFixed(2) + 'pt**' + (gap > nulls[380] ? '（超出 p95 ⇒ 上界是真的）' : '（落在 p95 内 ⇒ 天花板 = 取 max 的贪心）') + '；其中 best_single−池均值 = ' + (100 * (bs - grand)).toFixed(2) + 'pt 是包间的真实差距');
  /* 逐环境：谁赢、有多少环境的最优包不是那粒通才 */
  const win = {}; for (const e of E) { let b = null, bv = -Infinity; for (const p of packs) { const v = rate(p, e); if (v > bv + 1e-12) { bv = v; b = p.name; } } win[b] = (win[b] || 0) + 1; }
  console.log('  ' + ''.padEnd(28) + '逐环境最优包归属：' + Object.entries(win).sort((a, b) => b[1] - a[1]).map(e => e[0] + '×' + e[1]).join(' '));
}
console.log('# §E149d · 同质环境表的天花板体检：' + DIR + '（' + packs.length + ' 粒包 ‖ ' + envs.length + ' 个环境）');
report('全部环境', () => true);
report('仅池内环境 inPool=1', e => packs[0].byEnv[e].inPool === 1);
report('仅池外环境 inPool=0', e => packs[0].byEnv[e].inPool === 0);
