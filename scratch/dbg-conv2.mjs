import { readPack2, layout } from '../tools/proto2/arch2.mjs';
const raw = readPack2('scratch/arms/GD3-SWORD.bak');
console.log('a.len', raw.a.length);
for (const s of [27,28,29,30,31]) {
  const Lb = layout(Object.assign({}, raw.dims, { input: 'obs3b', skills: s }));
  const Lc = layout(Object.assign({}, raw.dims, { input: 'obs3c', skills: s }));
  console.log('skills', s, 'Lb', Lb.n, 'Lc', Lc.n, 'seatIn', Lb.fanIn.seatEnc, Lc.fanIn.seatEnc);
}
