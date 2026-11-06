#!/usr/bin/env node
/* ref-baseline.mjs — **不装任何 2.0 档**，只按 profile2 同一套格/同一套局号，量"参照包自己"的对局基线（千问 · 10-29 02:4x）
 * 为什么要它：`profile2` 的参照行在装 S1 时夺1 25.8%、装 S1o 时 1.2%，而对手表指纹已经对得上（cc652985/20）
 *   ⇒ 差别不在考卷，在**装了档之后 v7 那条路自己变了**。这条脚本就是那把"没被覆盖"的尺：
 *   同样 16 格 × 120 局 × 同 temp，只做 v7 的 seat-0 评测。参照真值落谁那边，就说明另一边被污染。
 */
import { sandbox, loadChamp } from '../audit-lib.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Math.max(4, Number(arg('games', 120)) || 120);
const TEMP = Number(arg('temp', 0.001));
const REF = arg('ref', 'js/bundled-champion-3p.js');

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer;
let ref = loadChamp(W, REF, '');
if (!ref) { console.error('⛔ 参照包读不出'); process.exit(2); }
ref = Float64Array.from(ref);
console.log('# 参照真值尺（**没装 2.0**）‖ 包 ' + REF + ' ‖ 长度 ' + ref.length + ' ‖ P.paramCount()=' + P.paramCount() + ' ‖ temp=' + TEMP);

function mulberry(sv) { let a = sv >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function buildPoolSeeded(seedVal) { const real = Math.random; try { Math.random = mulberry(seedVal); return T.buildOpps(ref, 0.05); } finally { Math.random = real; } }
const POOL = buildPoolSeeded(20261029);
const STYLES = ['breakdef', 'wall', 'tankline', 'guardgun', 'protowall', 'reflectmix', 'beadburst', 'aggro'];
const CELLS = [];
for (const n of [3, 5]) for (const nm of STYLES) { const i = POOL.findIndex((o) => o.name === nm); if (i >= 0) CELLS.push({ n, name: nm, idx: i }); }

let first = 0, top2 = 0, survived = 0, games = 0, rounds = 0;
for (const cell of CELLS) {
  const acc = { f: 0, t2: 0, sv: 0, rd: 0 };
  for (let g = 0; g < GAMES; g++) {
    const seat = g % cell.n;
    const choosers = [];
    for (let pid = 0; pid < cell.n; pid++) choosers.push(pid === seat ? T.policyChooserN(ref, TEMP) : POOL[(cell.idx + 1 + pid) % POOL.length].sel);
    const rm = T.oneGameN(choosers, 1000 + cell.n * 97 + cell.idx + g * 7919, cell.n, { regen: 0, mode: 'multi' });
    const st = rm.state, myHp = st.p[seat] ? Math.max(0, st.p[seat].hp) : 0;
    let ahead = 0;
    for (let i = 0; i < cell.n; i++) if (i !== seat) { const h = st.p[i] ? Math.max(0, st.p[i].hp) : 0; if (h > myHp + 1e-9 || (Math.abs(h - myHp) < 1e-9 && rm.dmg[i] > rm.dmg[seat])) ahead++; }
    if (rm.winner === seat) acc.f++;
    if (ahead <= 1) acc.t2++;
    if (myHp > 0) acc.sv++;
    acc.rd += rm.rounds || 0;
    games++;
  }
  first += acc.f; top2 += acc.t2; survived += acc.sv; rounds += acc.rd;
  console.log('  格 ' + cell.name.padEnd(11) + ' n=' + cell.n + ' ‖ 夺1 ' + (100 * acc.f / GAMES).toFixed(1) + '% ‖ 前2 ' + (100 * acc.t2 / GAMES).toFixed(1) + '% ‖ 活到终局 ' + (100 * acc.sv / GAMES).toFixed(1) + '% ‖ 局长 ' + (acc.rd / GAMES).toFixed(2));
}
console.log('⇒ 参照真值 ‖ ' + CELLS.length + ' 格 × ' + GAMES + ' 局 = ' + games + ' 局 ‖ 夺1 ' + (100 * first / games).toFixed(1) + '% ‖ 前2 ' + (100 * top2 / games).toFixed(1) + '% ‖ 活到终局 ' + (100 * survived / games).toFixed(1) + '% ‖ 局长 ' + (rounds / games).toFixed(2));
