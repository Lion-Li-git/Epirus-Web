import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2, readPack2 } from '../../tools/proto2/arch2.mjs';
const W2 = sandbox();
installArch2(W2, { input: 'obs3b', gen: 3, keySplit: 1, seatH: 16, actH: 8, hid: 32, hid2: 24, mutMode: 'seg' });
const tchRaw = readPack2('docs/artifacts/night-adapt/KDG-C-Q-s41.js');
console.log('装1(obs3b seatH16/actH8) n=' + W2.EpirusPolicy.__arch2.L.n + ' ‖ 教师包 a.len=' + tchRaw.a.length);
console.log('教师 unpack=' + (W2.EpirusPolicy.unpack(tchRaw, true) ? 'ok' : 'null'));
const A2 = installArch2(W2, { input: 'obs5', gen: 3, keySplit: 1, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
console.log('装2后 unpack(教师obs3b包)=' + (W2.EpirusPolicy.unpack(tchRaw, true) ? 'ok' : 'null') + '（若 ok ⇒ unpack 还是装1的）');
