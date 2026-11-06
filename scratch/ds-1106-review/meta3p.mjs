import { readFileSync } from 'node:fs';
import { extractJsonObject } from '../../tools/audit-lib.mjs';
const src = readFileSync('js/bundled-champion-3p.js','utf8');
const j = extractJsonObject(src, 'window.EPIRUS_CHAMPION_3P_META');
const m = JSON.parse(j);
console.log('keys:', Object.keys(m).join(', '));
console.log('rulesFingerprint =', m.rulesFingerprint);
console.log('shippedAs =', String(m.shippedAs||'').slice(0,300));
console.log('fingerprintRefresh =', String(m.fingerprintRefresh||'').slice(0,400));