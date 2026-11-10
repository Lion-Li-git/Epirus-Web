
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { install as installArch2, readPack2, layout } from '../../tools/proto2/arch2.mjs';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/evo.js']) vm.runInNewContext(readFileSync(f,'utf8'), sb, {filename:f});
const A5 = installArch2(sb.window, { mutMode: 'seg', input: 'obs5', gen: 3, keySplit: 1, seatH: 24, actH: 24, hid: 32, hid2: 24 });
console.log('主面 ' + A5.L.input + ' dof=' + A5.L.n);
for (const p of ['scratch/ds-1109/G5C-100.js','docs/artifacts/e507-out/Q-s47.js']) {
  const blob = readPack2(p);
  console.log(p.split('/').pop() + ' v=' + blob.v + ' dims.input=' + (blob.dims && blob.dims.input) + ' dims=' + (blob.dims ? JSON.stringify(blob.dims).slice(0,120) : '无'));
}
