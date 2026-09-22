/* 2P 移植探针（只读）：对一串 3P 血统包量 ①ε=0 vs 现 2P 冠军 H2H ②对 4 个 2P 脚本席胜率 ③G
 * 用法：node probe2p-transfer.mjs f1.bak f2.bak ...
 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
const W = sandbox();
const { EpirusState: S, EpirusPlay: Play, EpirusPolicy: P, EpirusTrainer: T, EpirusBots: Bots } = W;
const files = process.argv.slice(2);
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const src2 = readFileSync('./js/bundled-champion.js', 'utf8');
const m2 = /EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src2);
const W2 = P.unpack(JSON.parse(m2[1]), true);
function mkGame(args) { return S.createState('standard', { next: mb(args) }, 2); }
const choosers2 = (w) => (st, pid, legal) => { const aff = legal.filter(l => l.affordable); const b = aff.length ? aff : [{ key: 'ji', affordable: true }]; return T.pickChampion(st, pid, b, w, 0.15); };
const BFN = { balanced: Bots.pickBalanced, aggro: Bots.pickAggro, wall: Bots.pickWall, combocounter: Bots.pickComboCounter };
console.log('包'.padEnd(24) + 'vs2P冠军ε0(H/L/D)  vs脚本席(bal/agg/wall/cc 胜率)');
for (const f of files) {
  let params = null;
  try {
    const raw = readFileSync(f.indexOf('/') >= 0 ? f : 'docs/artifacts/' + f, 'utf8');
    const mm = /EPIRUS_CHAMPION(_3P)?\s*=\s*(\{[\s\S]*\})\s*;/.exec(raw);
    params = mm ? P.unpack(JSON.parse(mm[2]), true) : null;
  } catch (e) { console.log(f + ' LOAD-FAIL ' + e.message.slice(0, 60)); continue; }
  if (!params) { console.log(f + ' 外壳不可读/维度不符'); continue; }
  P.setRng(mb(313));
  let hw = 0, hl = 0, hd = 0;
  for (let g = 0; g < 60; g++) { const st = mkGame(90000 + g); const win = Play.autoGame(st, choosers2(params), choosers2(W2)); if (win === 'draw') hd++; else win === 0 ? hw++ : hl++; }
  for (let g = 0; g < 60; g++) { const st = mkGame(93000 + g); const win = Play.autoGame(st, choosers2(W2), choosers2(params)); if (win === 'draw') hd++; else win === 1 ? hw++ : hl++; }
  const scr = {};
  for (const [nm, fn] of Object.entries(BFN)) {
    let w = 0, d = 0;
    for (let g = 0; g < 30; g++) {
      const st = mkGame(96000 + g * 13);
      const cScript = (state, pid, legal) => fn(state, pid, legal);
      const win = (g % 2 === 0) ? Play.autoGame(st, choosers2(params), cScript) : Play.autoGame(st, cScript, choosers2(params));
      const meSeat = g % 2 === 0 ? 0 : 1;
      if (win === 'draw') d++; else if (win === meSeat) w++;
    }
    scr[nm] = Math.round(100 * (w + 0.5 * d) / 30) + '%';
  }
  console.log(('' + f).padEnd(24) + `${hw}/${hl}/${hd}`.padEnd(20) + ` bal ${scr.balanced}  agg ${scr.aggro}  wall ${scr.wall}  cc ${scr.combocounter}`);
}
