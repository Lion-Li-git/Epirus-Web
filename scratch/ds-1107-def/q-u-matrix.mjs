
/* Q-s47 / U-s205 vs 2.0 强池：冠军对冠军矩阵（N=2/3/5/8 × 3/4/5 血）
 * 口径：每个 (对手, N, 血) 跑两个方向 —— 我方 1 席 + 对手 (N−1) 席，以及反过来 ——
 *   excess = (1st − 1/N)/(1 − 1/N)；两个方向各自算，差额 = 相对强弱。
 * 用法：node scratch/ds-1107-def/q-u-matrix.mjs [--quick]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';

const W = sandbox();
const T = W.EpirusTrainer;
const QUICK = process.argv.includes('--quick');

const CH = [
  ['Q-s47', loadChamp(W, 'docs/artifacts/e507-out/Q-s47.js')],
  ['U-s205', loadChamp(W, 'docs/artifacts/e539-out/U-s205.js')],
];
const tsv = readFileSync('champion-map/pool-members.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const H = tsv[0].split('\t');
const iId = H.indexOf('id'), iPath = H.indexOf('path'), iTier = H.indexOf('tier');
const POOL = [];
for (const l of tsv.slice(1)) { const c = l.split('\t'); if (!c[iId]) continue;
  const p = loadChamp(W, c[iPath]); if (!p) { console.error('读不出 ' + c[iId]); continue; }
  POOL.push({ id: c[iId], tier: c[iTier], params: p }); }

const MODES = [[3, 'multi'], [4, 'multi4'], [5, 'long']];
const CFG = QUICK ? [{ N: 2, G: 8 }, { N: 5, G: 6 }] : [{ N: 2, G: 80 }, { N: 3, G: 48 }, { N: 5, G: 32 }, { N: 8, G: 20 }];
const T0 = Date.now();
const rows = [];

function playOne(paramsA, paramsB, n, mode, dir, g) {
  const seed = 424242 + n * 100003 + g * 977 + (dir === 'A' ? 0 : 500000);
  const ch = [];
  for (let pid = 0; pid < n; pid++) {
    const pr = (pid === 0) ? (dir === 'A' ? paramsA : paramsB) : (dir === 'A' ? paramsB : paramsA);
    ch.push(T.policyChooserN(pr, 0.15));
  }
  const r = T.oneGameN(ch, seed, n, { mode });
  return T.rankOf(r.state, 0, seed) === 1 ? 1 : 0;
}

for (const [name, pA] of CH) {
  for (const opp of POOL) {
    for (const [hp, mode] of MODES) {
      for (const { N, G } of CFG) {
        let a = 0, b = 0;
        for (let g = 0; g < G; g++) { a += playOne(pA, opp.params, N, mode, 'A', g); b += playOne(pA, opp.params, N, mode, 'B', g); }
        const ex = (w) => (w / G - 1 / N) / (1 - 1 / N);
        rows.push({ champ: name, opp: opp.id, tier: opp.tier, N, hp, mode, G, a, b, exA: ex(a), exB: ex(b) });
      }
    }
    if (!QUICK && POOL.indexOf(opp) % 6 === 5) console.error('  … ' + name + ' ' + opp.id + ' (' + ((Date.now() - T0) / 1000).toFixed(0) + 's)');
  }
}

const out = 'scratch/ds-1107-def/q-u-matrix.tsv';
writeFileSync(out, ['champ','opp','tier','N','hp','mode','G','aFirst','bFirst','exA','exB'].join('\t') + '\n'
  + rows.map(r => [r.champ, r.opp, r.tier, r.N, r.hp, r.mode, r.G, r.a, r.b, r.exA.toFixed(4), r.exB.toFixed(4)].join('\t')).join('\n') + '\n');
console.log('写 ' + out + '（' + rows.length + ' 行，' + ((Date.now() - T0) / 1000).toFixed(1) + 's）');

/* 汇总：每个 (冠军, N, 血) 对全池的均值 */
const by = {};
for (const r of rows) { const k = r.champ + '|N' + r.N + '|hp' + r.hp; (by[k] = by[k] || []).push(r); }
console.log('\n冠军  N 血  对手数  我方excess均值  中位  最差(对手)  对手侧excess均值');
for (const k of Object.keys(by).sort()) {
  const a = by[k], m = a.map(r => r.exA).sort((x, y) => x - y);
  const worst = a.slice().sort((x, y) => x.exA - y.exA)[0];
  const oppMean = a.reduce((s, r) => s + r.exB, 0) / a.length;
  console.log(k.padEnd(16) + String(a.length).padStart(4) + '  ' + (m.reduce((s, v) => s + v, 0) / m.length).toFixed(3).padStart(9)
    + '  ' + m[Math.floor(m.length / 2)].toFixed(3) + '  ' + worst.opp + '(' + worst.exA.toFixed(2) + ')  ' + oppMean.toFixed(3));
}
