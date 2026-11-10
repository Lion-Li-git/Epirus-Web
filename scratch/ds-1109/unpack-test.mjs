
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js']) vm.runInNewContext(readFileSync(f,'utf8'), sb, {filename:f});
const P = sb.window.EpirusPolicy;
for (const p of ['docs/artifacts/e507-out/Q-s47.js','docs/artifacts/night-adapt/KDG-B-Q-s13.js','docs/artifacts/night-adapt/MSB2-R1S1494663071.js']) {
  const txt = readFileSync(p,'utf8');
  const m = txt.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  const blob = m ? JSON.parse(m[1]) : JSON.parse(txt);
  const a = P.unpack(blob, true);
  console.log(p.split('/').pop() + ' v=' + blob.v + ' ⇒ unpack(legacy) ' + (a ? 'OK' : 'null') + ' ‖ check ' + JSON.stringify(P.checkPack(blob)).slice(0,120));
}
