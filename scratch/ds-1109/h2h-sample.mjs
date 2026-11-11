
/* 用「对 Q-s47 的 3P 双向 excess」当实机能力的锚，比较 A_v2 / A_v3 谁更贴 */
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const W = sandbox(); const T = W.EpirusTrainer;
const Q = loadChamp(W, 'docs/artifacts/e507-out/Q-s47.js');
const ids = readFileSync('champion-map/only-v3sample.tsv','utf8').replace(/\r\n/g,'\n').trim().split('\n');
const cand = [
  ['docs/artifacts/night-adapt/', '.js'],
  ['scratch/ds-1109/', '.js'],
  ['docs/artifacts/', '.bak'],
];
const find = (id) => { for (const [d,ext] of cand) { try { readFileSync(d+id+ext); return d+id+ext; } catch {} } return null; };
function playOne(pA, pB, n, dir, g) {
  const seed = 313000 + n * 100003 + g * 977 + (dir === 'A' ? 0 : 500000);
  const ch = []; for (let pid = 0; pid < n; pid++) { const pr = (pid === 0) ? (dir === 'A' ? pA : pB) : (dir === 'A' ? pB : pA); ch.push(T.policyChooserN(pr, 0.15)); }
  const r = T.oneGameN(ch, seed, n, { mode: 'multi' });
  return T.rankOf(r.state, 0, seed) === 1 ? 1 : 0;
}
const out = [];
for (const id of ids) {
  const p = find(id); if (!p) { console.error('跳过 ' + id + '（找不到包）'); continue; }
  const params = loadChamp(W, p); if (!params) { console.error('跳过 ' + id + '（装不出）'); continue; }
  const G = 24; let a = 0, b = 0;
  for (let g = 0; g < G; g++) { a += playOne(params, Q, 3, 'A', g); b += playOne(params, Q, 3, 'B', g); }
  const ex = (w) => (w / G - 1 / 3) / (1 - 1 / 3);
  out.push({ id, h2h: (ex(a) + ex(b)) / 2, aPct: 100 * a / G, bPct: 100 * b / G });
  console.error('  ' + id + ' → 3P 我方 ' + (100*a/G).toFixed(0) + '% / Q ' + (100*b/G).toFixed(0) + '%');
}
writeFileSync('champion-map/h2h-q47-sample.tsv', 'id\th2h\twrA\twrB\n' + out.map(r => [r.id, r.h2h.toFixed(4), r.aPct.toFixed(1), r.bPct.toFixed(1)].join('\t')).join('\n') + '\n');
console.log('写 champion-map/h2h-q47-sample.tsv（' + out.length + ' 枚）');
