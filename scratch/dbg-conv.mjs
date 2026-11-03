import { readPack2, layout } from '../tools/proto2/arch2.mjs';
const raw = readPack2('scratch/arms/GD3-SWORD.bak');
const Lb = layout(Object.assign({}, raw.dims, { input: 'obs3b' }));
const Lc = layout(Object.assign({}, raw.dims, { input: 'obs3c' }));
console.log('dims', JSON.stringify(raw.dims));
console.log('Lb.n', Lb.n, 'Lc.n', Lc.n);
console.log('Lb seg', Lb.seg.map(s => s.name + ':' + s.len).join(','));
console.log('Lc seg', Lc.seg.map(s => s.name + ':' + s.len).join(','));
console.log('seatIn', Lb.fanIn.seatEnc, Lc.fanIn.seatEnc, 'seatH', Lb.seatH);
