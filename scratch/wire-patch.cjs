const fs = require('fs');
const p = 'tools/probe-cem-arm.mjs';
let s = fs.readFileSync(p, 'utf8');
if (s.includes('OPP_SPECS')) { console.log('already wired'); process.exit(0); }
const anchorImport = "import { collectFixtures, headHealth, agreeVsRandom, fmtHead, HEAD_FLAT_AGREE } from './proto2/head-health.mjs';   // 10-30 傍晚：打分有没有牙";
if (!s.includes(anchorImport)) { console.error('import anchor missing'); process.exit(1); }
s = s.replace(anchorImport, anchorImport + "\nimport { OPP_SPECS } from '../server/opp-pool.mjs';               // 考卷搬迁：产品 7 脚本的单一来源\nimport { makeAsChooser } from './bot-chooser-lib.mjs';            // 同款包装（评测同款）");
const anchorDecl = 'let V7_HEALTH_REF = null;';
if (!s.includes(anchorDecl)) { console.error('decl anchor missing'); process.exit(1); }
s = s.replace(anchorDecl, anchorDecl + '\nlet ARENA_ROSTER = null;   /* --arenaPool=product 时 = 产品 7 脚本的 chooser 表（考卷搬迁） */\nlet ARENA_SHAPES = null;   /* --arenaShapes 覆盖（缺省 = 产品两格 3:multi,5:multi） */');
const anchorCall = 'try { ARENA = createArena2(W, { refParams: ARENA_REF, temp: ARENA_TEMP, highN: ARENA_HIGH_N, stratified: ARENA_STRAT, stratCap: ARENA_STRAT_CAP, stratMix: ARENA_STRAT_MIX }); }';
if (!s.includes(anchorCall)) { console.error('call anchor missing'); process.exit(1); }
s = s.replace(anchorCall, 'try { ARENA = createArena2(W, { refParams: ARENA_REF, temp: ARENA_TEMP, highN: ARENA_HIGH_N, stratified: ARENA_STRAT, stratCap: ARENA_STRAT_CAP, stratMix: ARENA_STRAT_MIX, roster: ARENA_ROSTER || undefined, shapes: ARENA_SHAPES || undefined }); }');
fs.writeFileSync(p, s);
console.log('wired probe-cem-arm');
