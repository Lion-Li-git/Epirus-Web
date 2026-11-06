/* #143 取证：夹具复现为什么对不上（一次性诊断，不入册）*/
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';

const rows = readFileSync('scratch/N-fx-dump25.jsonl', 'utf8').split('\n').filter(Boolean).map((s) => JSON.parse(s));
const r = rows.find((x) => x.pk === 'aggro#4#6');
const W = sandbox(), P = W.EpirusPolicy, T = W.EpirusTrainer, Play = W.EpirusPlay;
let v7 = loadChamp(W, 'js/bundled-champion-3p.js', '');
v7 = Float64Array.from(v7);
const st = r.st;
st.rng = { next: () => 0.5 };
console.log('dump pid', r.pid, 'keep', r.keep, 'round', r.round, 'mode', st.modeKey);
const f = st.p[r.pid];
console.log('focus: ep=' + f.ep, 'elec=' + f.elec, 'boom=' + f.boom, 'hp=' + f.hp, 'guardNext=' + !!f.guardNext);
console.log('actions 栏:', JSON.stringify(st.actions));
console.log('dump pool:', r.pool.map((p) => p.key + '/' + p.bead + ':' + p.net.toFixed(3)).join('  '));
const legal = Play.legalActions(st, r.pid);
console.log('legal:', legal.map((l) => l.key + (l.affordable === false ? '(NO)' : '')).join(','));
const base = T.econBase(st, r.pid, legal);
console.log('econBase:', base.map((l) => l.key).join(','));
const cands = P.candidatesFor(st, r.pid, base, { lockTarget: false });
console.log('cands(' + cands.length + '):', cands.map((c) => c.key + '/' + (c.bead || '-')).join(','));
const scored = cands.map((c) => ({ c, v: P.value(st, r.pid, c.key, v7, null, c) })).sort((a, b) => b.v - a.v);
console.log('rebuilt top' + r.keep + ':', scored.slice(0, r.keep).map((x) => x.c.key + '/' + (x.c.bead || '-') + ':' + x.v.toFixed(3)).join('  '));
