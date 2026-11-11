import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2, readPack2 } from '../../tools/proto2/arch2.mjs';
const raw5 = readPack2('scratch/obs4/KDO5-seed.bak');
const W2 = sandbox();
installArch2(W2, { input: 'obs3b', gen: 3, keySplit: 1, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
console.log('装1后 __arch2.L.input=' + W2.EpirusPolicy.__arch2.L.input + ' n=' + W2.EpirusPolicy.__arch2.L.n);
const A2 = installArch2(W2, { input: 'obs5', gen: 3, keySplit: 1, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
console.log('装2后 __arch2.L.input=' + W2.EpirusPolicy.__arch2.L.input + ' n=' + W2.EpirusPolicy.__arch2.L.n + '（返回值同源=' + (A2 === W2.EpirusPolicy.__arch2) + '）');
console.log('checkPack=' + JSON.stringify(W2.EpirusPolicy.checkPack(raw5)));
