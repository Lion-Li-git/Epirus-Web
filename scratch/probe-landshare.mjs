import { sandbox, landShareOf, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy;
for (const f of process.argv.slice(2)) {
  let pv = null;
  try { const raw = readPack2(f); if (raw && raw.v === 92) { const g = packCfgExit(raw, f); installArch2(W, Object.assign({ mutMode: 'seg' }, g.cfg)); pv = Float64Array.from(P.unpack(raw, true)); } } catch (e) {}
  if (!pv) { try { pv = Float64Array.from(loadChamp(W, f, '.')); } catch (e) { console.log(f + ' 读不出'); continue; } }
  const mh = T.mirrorHealth(pv, 20, 5, 'multi');
  const ls = landShareOf(W, mh);
  const cast = mh.castByKey || {}; const tot = Object.keys(cast).reduce((a, k) => a + (k === 'ji' ? 0 : (cast[k] || 0)), 0) || 1;
  const eff = Object.keys(cast).filter((k) => k !== 'ji' && (cast[k] || 0) / tot >= 0.005).length;
  console.log(f.split('/').pop() + ' ‖ landG=' + (mh.effSkillsLand || 0).toFixed(2) + ' ‖ maxLandShare=' + (100 * (ls.share || 0)).toFixed(0) + '%(' + ls.key + ') ‖ landedKeys=' + (mh.landedKeys || 0) + ' ‖ **有效技能数=' + eff + '**（份额≥0.5%）');
}