
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { install as installArch2 } from '../../tools/proto2/arch2.mjs';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/evo.js']) vm.runInNewContext(readFileSync(f,'utf8'), sb, {filename:f});
const A2 = installArch2(sb.window, { mutMode: 'seg', input: 'obs5', gen: 3, keySplit: 1, seatH: 24, actH: 24, hid: 32, hid2: 24 });
console.log('装出面 ' + A2.L.input + ' ‖ Policy2 ' + (sb.window.EpirusPolicy2 ? '有' : '无'));
for (const p of ['scratch/ds-1109/G5C-100.js','docs/artifacts/e507-out/Q-s47.js','docs/artifacts/night-adapt/MSB4-R1S1928336850.js']) {
  const txt = readFileSync(p,'utf8');
  const m = txt.match(/window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/);
  const blob = JSON.parse(m[1]);
  const P2 = sb.window.EpirusPolicy2;
  const c = (blob.v === 92 && P2) ? P2.checkPack(blob, sb.window) : null;
  console.log(p.split('/').pop() + ' v' + blob.v + ' ⇒ checkPack ' + JSON.stringify(c && {ok:c.ok, reason:c.reason, got:c.got, want:c.want}));
}