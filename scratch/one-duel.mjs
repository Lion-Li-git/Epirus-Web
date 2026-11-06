import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
const PACK = process.argv[2];
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer;
const raw = readPack2(PACK); const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const pv = Float64Array.from(P.unpack(raw, true));
const W2 = sandbox(); const v7 = Float64Array.from(loadChamp(W2, 'js/bundled-champion-3p.js', ''));
const ch = T.policyChooserN(pv, 0.15, 0, 1, 'soft');
const chOpp = W2.EpirusTrainer.policyChooserN(v7, 0.15, 0, 1, 'soft');
for (const mode of ['multi', 'long']) {
  const rows = [];
  for (let g = 0; g < 5; g++) { const r = T.oneGameN([ch, chOpp], 96000 + g * 977, 2, { mode }); rows.push('w=' + r.winner + ' r=' + r.rounds + ' dmg=' + r.dmg.join('/')); }
  console.log(mode + ': ' + rows.join(' | '));
}
