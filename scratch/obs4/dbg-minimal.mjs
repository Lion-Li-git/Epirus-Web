/* 最小复现：先 obs3b install 再 obs5 install，obs5 的 unpack 是否被污染 */
import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2, readPack2 } from '../../tools/proto2/arch2.mjs';
import { dims as obs3Dims } from '../../tools/proto2/obs3.mjs';
import { readFileSync } from 'node:fs';

const raw5 = readPack2('scratch/obs4/KDO5-seed.bak');

const W1 = sandbox();
console.log('① 先 obs5：obs3Dims=' + obs3Dims(W1.EpirusRules, 'obs5'));
installArch2(W1, { input: 'obs5', gen: 3, keySplit: 1, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
console.log('① unpack=' + (W1.EpirusPolicy.unpack(raw5, true) ? 'ok' : 'null'));

const W2 = sandbox();
const tchSrc = readFileSync('docs/artifacts/night-adapt/KDG-C-Q-s41.js', 'utf8');
const tchPack = JSON.parse(tchSrc.match(/EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]);
console.log('② 先 obs3b（教师）：obs3Dims(obs3b)=' + obs3Dims(W2.EpirusRules, 'obs3b'));
installArch2(W2, { input: 'obs3b', gen: 3, keySplit: 1, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
console.log('② 装完 obs3b 后再问 obs5：obs3Dims=' + obs3Dims(W2.EpirusRules, 'obs5'));
installArch2(W2, { input: 'obs5', gen: 3, keySplit: 1, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
console.log('② unpack=' + (W2.EpirusPolicy.unpack(raw5, true) ? 'ok' : 'null'));
console.log('② checkPack=' + JSON.stringify(W2.EpirusPolicy.checkPack(raw5)));
