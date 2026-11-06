/* 容量臂判据①：2.0 候选层隐激活的等效使用维数（participation ratio，§E815 那把尺的中心化口径）
 * 样本 = arena2 mild 真局里被测包每个候选的 hid2 维隐向量（forwardCands 的 phis 输出，零引擎改动）
 * 用法：node scratch/pr-arch2.mjs <pack.bak> [更多包…] */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const PACKS = process.argv.slice(2);
if (!PACKS.length) { console.error('用法: node scratch/pr-arch2.mjs <pack.bak> …'); process.exit(2); }
function prOf(cov, K) {
  let tr = 0, tr2 = 0;
  for (let j = 0; j < K; j++) tr += cov[j * K + j];
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) { const q = cov[i * K + j]; tr2 += q * q; }
  return tr2 > 0 ? (tr * tr) / tr2 : 0;
}
for (const packPath of PACKS) {
  const W = sandbox();
  W.EpirusTrainer.setBigTPush(12);
  const ref = loadChamp(W, 'js/bundled-champion-3p.js', '');   /* 必须在 installArch2 之前读（unpack 会被覆盖） */
  const raw = JSON.parse(readFileSync(packPath, 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
  if (raw.v !== 90) { console.log(packPath + ': ⛔ 非 2.0 容器'); continue; }
  const cfg = { mutMode: 'seg', ...(raw.dims || {}) };
  if ((raw.arch || 'S1') === 'S1o') cfg.input = 'obs3';
  const A2 = installArch2(W, cfg);
  const P = W.EpirusPolicy, T = W.EpirusTrainer;
  const params = Float64Array.from(P.unpack(raw, true));
  const K = (raw.dims && raw.dims.hid2) || 24;
  const vecs = [];
  const realFC = P.forwardCands, realCC = P.chooseCandidates;
  /* 决策路径走 P.chooseCandidates（arch2 内部直调前向，包装 P.forwardCands 抓不到）⇒ 包 CC 抓输入，
   * 再手动调一次 P.forwardCands({wantPhi:1}) 取激活：前向确定性 ⇒ 与真决策用的激活逐位一致（代价 2× 前向，探针可承受） */
  P.chooseCandidates = function (state, pid, cands, params, opts2) {
    const r = realCC.call(this, state, pid, cands, params, opts2);
    try {
      const f = realFC.call(this, state, pid, cands, params, Object.assign({}, opts2 || {}, { wantPhi: 1 }));
      if (f && f.phi) for (let i = 0; i < cands.length; i++) vecs.push(Float64Array.from(f.phi.subarray(i * K, (i + 1) * K)));
    } catch (e) { /* 语义性失败（空候选等）不计样本 */ }
    return r;
  };
  const arena = createArena2(W, { refParams: ref, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
  arena.evalParams(params, { phase: 'holdout', gamesPerShape: 4, temp: 0.15 });
  P.chooseCandidates = realCC;
  const N = vecs.length;
  const mean = new Float64Array(K);
  for (const v of vecs) for (let j = 0; j < K; j++) mean[j] += v[j] / N;
  const cov = new Float64Array(K * K);
  for (const v of vecs) for (let a = 0; a < K; a++) { const da = v[a] - mean[a]; for (let b = a; b < K; b++) { const d = (v[b] - mean[b]); cov[a * K + b] += da * d / N; } }
  for (let a = 0; a < K; a++) for (let b = 0; b < a; b++) cov[a * K + b] = cov[b * K + a];
  const act = new Array(K).fill(0);
  for (const v of vecs) for (let j = 0; j < K; j++) if (v[j] > 1e-9) act[j]++;
  const usedN = act.filter((c) => c / N > 0.02).length;
  console.log(packPath.split('/').pop() + ' ‖ hid2=' + K + ' ‖ 样本 ' + N + ' 候选 ‖ 激活>2% 单元 ' + usedN + '/' + K +
    ' ‖ **等效使用维数（中心化 PR）= ' + prOf(cov, K).toFixed(2) + '/' + K + '**');
}
