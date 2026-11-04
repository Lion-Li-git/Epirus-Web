#!/usr/bin/env node
/* face-variance.mjs — 同一批状态上，不同随机种子的"选择分布"有多不同（2.0 vs v7）
 * 目的：解释"2.0 出厂幅度下全群是同一个玩家"。用法：node scratch/face-variance.mjs
 */
import { sandbox, loadChamp, mulberry32 } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
const N = 5, MODE = 'long', G = 24, SEEDS = [1, 2, 3, 4];
function runFace(face, scale) {
  const W = sandbox();
  const P = W.EpirusPolicy, T = W.EpirusTrainer;
  if (face === '2.0') installArch2(W, { input: 'obs3b', gen: 3, keySplit: true, mutMode: 'seg' });
  const pols = SEEDS.map((s) => P.makePolicy(scale, mulberry32(1000 + s)));
  const chs = pols.map((pv) => T.policyChooserN(pv, 1e-9, 0, 1, 'soft'));
  const counts = pols.map(() => ({}));
  let decisions = 0;
  for (let g = 0; g < G; g++) {
    const seat0 = (state, pid, legal) => {
      decisions++;
      const picks = chs.map((ch) => { const a = ch(state, pid, legal); return (a && a.key) || '?'; });
      picks.forEach((k, i) => { counts[i][k] = (counts[i][k] || 0) + 1; });
      return chs[0](state, pid, legal);
    };
    const subs = [seat0];
    for (let pid = 1; pid < N; pid++) subs.push((state, p2, legal) => { const cs = W.EpirusPolicy.candidatesFor(state, p2, W.EpirusTrainer.econBase(state, p2, legal), { lockTarget: false }) || []; const j = cs.find((c) => c.key === W.EpirusRules.SK.JI); return j || cs[0] || { key: W.EpirusRules.SK.JI }; });
    T.oneGameN(subs, 7000 + g * 977, N, { mode: MODE });
  }
  const dists = counts.map((c) => { const tot = Object.values(c).reduce((a, b) => a + b, 0) || 1; const d = {}; for (const k in c) d[k] = c[k] / tot; return d; });
  const keys = new Set(); dists.forEach((d) => Object.keys(d).forEach((k) => keys.add(k)));
  let tvSum = 0, pairs = 0;
  for (let i = 0; i < dists.length; i++) for (let j = i + 1; j < dists.length; j++) { let tv = 0; for (const k of keys) tv += Math.abs((dists[i][k] || 0) - (dists[j][k] || 0)); tvSum += tv / 2; pairs++; }
  const meanDef = dists.map((d) => (d.guard || 0) + (d.reflect || 0) + (d.bagua || 0) + (d.holo || 0) + (d.shift || 0) + (d.jinshield || 0) + (d.armor || 0) + (d.proto || 0) + (d.transfer || 0));
  const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
  const top = dists.map((d) => Object.entries(d).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ':' + (100 * v).toFixed(0) + '%').join(','));
  console.log(face + ' scale=' + scale + ' ‖ 决策 ' + decisions + ' ‖ 四粒防御族 ' + meanDef.map((x) => (100 * x).toFixed(1) + '%').join('/') + ' ‖ 粒间 sd ' + (100 * sd(meanDef)).toFixed(1) + 'pt ‖ 平均 TV ' + (100 * tvSum / pairs).toFixed(1) + 'pt');
  console.log('   top3: ' + top.join(' ‖ '));
}
runFace('2.0', 0.25); runFace('2.0', 4); runFace('v7', 0.25);
