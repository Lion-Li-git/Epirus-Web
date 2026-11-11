/* 复刻 supfit 的 Wv(教师面)+W(学生面) 双装流程，找 unpack 失败点 */
import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../../tools/proto2/arch2.mjs';
import { loadChamp } from '../../tools/audit-lib.mjs';
import { readFileSync } from 'node:fs';

const Wv = sandbox();
const refParams = Float64Array.from(loadChamp(Wv, 'js/bundled-champion-3p.js', ''));
console.log('ref v7 params=' + refParams.length);
const TEACHER = 'docs/artifacts/night-adapt/KDG-C-Q-s41.js';
const tchRawSrc = readFileSync(TEACHER, 'utf8');
const tchCfgMatch = tchRawSrc.match(/"dims":\{[^}]*"input":"(obs[345][a-z]?)"/);
if (tchCfgMatch) {
  const tchPack = JSON.parse(tchRawSrc.match(/EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]);
  console.log('教师面=' + tchPack.dims.input);
  installArch2(Wv, { input: tchPack.dims.input, gen: tchPack.dims.gen, keySplit: tchPack.dims.keySplit, seatH: tchPack.dims.seatH, actH: tchPack.dims.actH, hid: tchPack.dims.hid, hid2: tchPack.dims.hid2, skills: tchPack.skills, mutMode: 'seg' });
}
const tchParams = Float64Array.from(loadChamp(Wv, TEACHER, ''));
console.log('教师 params=' + tchParams.length);

const UP = 'scratch/obs4/KDO5-seed.bak';
const W = sandbox();
const raw = readPack2(UP);
const got = packCfgExit(raw, UP);
console.log('got.cfg=' + JSON.stringify(got.cfg).slice(0, 200));
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const P = W.EpirusPolicy;
console.log('学生 paramCount=' + P.paramCount());
const up0 = P.unpack(raw, true);
console.log('up0=' + (up0 ? up0.length : 'null'));
console.log('checkPack=', JSON.stringify(P.checkPack(raw)));
import { dims as obs3Dims2 } from '../../tools/proto2/obs3.mjs';
console.log('直接调 obs3Dims(R,obs5)=' + obs3Dims2(P_checkR, 'obs5'));
console.log('直接调 obs3Dims(R,obs3b)=' + obs3Dims2(P_checkR, 'obs3b'));
console.log('skills.len=' + P_checkR.skills.length);
var P_checkR = W.EpirusRules;
console.log('再调 obs5=' + obs3Dims2(P_checkR, 'obs5'));
