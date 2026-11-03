import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, X = W.EpirusResolve, R = W.EpirusRules;
const raw = readPack2('scratch/ga-arms/L5-D4a-s13.js'); const got = packCfgExit(raw, 'x');
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const st = S.createState('long', { next: T.mulberry32(12345) }, 5);
X.startTurn(st);
const legal = W.EpirusPlay.legalActions(st, 0);
console.log('legal api:', !!legal);
let cs = null;
try { cs = P.candidatesFor(st, 0, T.econBase(st, 0, legal || []), { lockTarget: false }); } catch (e) { console.log('cs err', e.message); }
console.log('legal keys:', legal ? legal.map(l => l.key).join(',') : '(n/a)');
console.log('cs keys:', cs ? cs.map(c => c.key).join(',') : '(n/a)');
const DEF = ['guard','reflect','bagua','shift','jinshield','armor','proto','holo'];
console.log('cs has defense:', cs ? cs.filter(c => DEF.includes(c.key)).map(c=>c.key).join(',') || 'NONE' : 'n/a');