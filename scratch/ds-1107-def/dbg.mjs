
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { extractJsonObject } from '../../tools/audit-lib.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js',
  'js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js','js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
console.log('Epirus*:', Object.keys(sb).filter(k => /^Epirus/.test(k)).join(','));
const P = sb.EpirusPolicy;
console.log('P.unpack type', typeof P.unpack, 'P2', typeof sb.EpirusPolicy2, 'P2.unpack', sb.EpirusPolicy2 && typeof sb.EpirusPolicy2.unpack);
const src = readFileSync(join(ROOT, 'docs/artifacts/CTRL2-s13-band2.bak'), 'utf8');
const j = extractJsonObject(src, 'window.EPIRUS_CHAMPION_3P', 'window.EPIRUS_CHAMPION_3P_META');
console.log('json len', j && j.length, 'head', j && j.slice(0, 60));
const o = JSON.parse(j);
console.log('v', o.v, 'keys', Object.keys(o).join(','), 'a len', o.a && o.a.length);
const p = P.unpack(o);
console.log('unpack ->', p === null ? 'NULL' : (p && p.length));
