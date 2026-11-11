/* manifest 调用序追踪（配 obs3.mjs 的 DBG-TEMP 行） */
globalThis.DBGTRACE = 1;
const { sandbox } = await import('../../tools/audit-lib.mjs');
const { install: installArch2, readPack2 } = await import('../../tools/proto2/arch2.mjs');
const raw5 = readPack2('scratch/obs4/KDO5-seed.bak');
const W2 = sandbox();
installArch2(W2, { input: 'obs3b', gen: 3, keySplit: 1, seatH: 16, actH: 8, hid: 32, hid2: 24, mutMode: 'seg' });
console.log('--- 装1(obs3b) 完');
installArch2(W2, { input: 'obs5', gen: 3, keySplit: 1, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
console.log('--- 装2(obs5) 完');
console.log('checkPack=' + JSON.stringify(W2.EpirusPolicy.checkPack(raw5)));
