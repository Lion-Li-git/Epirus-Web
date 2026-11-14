/* mem-probe for Round 6 OBS6E6 candidates —— 承 mem-probe-e4.mjs（同 H 集 ⇒ Gap 跨轮可比）
 *   对照系：GD6a-TILT（obs5 控 −10.9）与 OBS6E5c（Round6b 旗舰 −24.9）。 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { duelAssembly } from '../../tools/v2v4-lib.mjs';
import { EXAM_POOL, OPP_SPECS } from '../../training/server/opp-pool.mjs';

const execFileP = promisify(execFile);
const argNum = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? Number(a.slice(k.length + 3)) : d; };
const GAMES = argNum('games', 200);
const JOBS = Math.max(1, argNum('jobs', Math.min(8, cpus().length)) || 1);
const PAIR_ONLY = process.argv.find((a) => a.startsWith('--pair=')) ? Number(process.argv.find((a) => a.startsWith('--pair=')).slice(7)) : -1;
const SEED0 = 90210;
void EXAM_POOL;

const SUBJECTS = [
  ['OBS6E6a', 'scratch/arms/OBS6E6a.bak'],
  ['OBS6E6c', 'scratch/arms/OBS6E6c.bak'],
  ['OBS6E6d', 'scratch/arms/OBS6E6d.bak'],
  ['OBS6E6e', 'scratch/arms/OBS6E6e.bak'],
  ['GD6a-TILT', 'scratch/arms/GD6a-TILT.bak'],
];
const R_NAMES = ['gunspam', 'wall', 'baguaspam', 'guardgun', 'heavyfire', 'deepsaver'];
const H_PACKS = [
  ['GD16m', 'scratch/arms/GD16m-D1.bak'],
  ['KDG-B-Q-s13', 'docs/artifacts/night-adapt/KDG-B-Q-s13.js'],
  ['MSB11-R2', 'docs/artifacts/night-adapt/MSB11-R2S306293884.js'],
  ['MSB14-railgun', 'docs/artifacts/night-adapt/MSB14-railgun-R1S175656469.js'],
  ['MSB15R-HITMIX', 'docs/artifacts/night-adapt/MSB15R-hit-mix-R1S2057836694.js'],
  ['WSEL9-200', 'scratch/ds-1109/WSEL9-200.js'],
];

const W = sandbox();
const T = W.EpirusTrainer, B = W.EpirusBots;
const R_OPS = R_NAMES.map((nm) => {
  const spec = OPP_SPECS.find((e) => e.name === nm);
  return { id: 'R:' + nm, chooser: B[spec.fn] };
});
const H_OPS = H_PACKS.map(([id, path]) => ({ id: 'H:' + id, chooser: T.policyChooserN(loadChamp(W, path), 0.15) }));
const OPS = R_OPS.concat(H_OPS);
const FLAT = [];
for (const [sid, spath] of SUBJECTS) for (const opp of OPS) FLAT.push({ sid, spath, opp });

if (PAIR_ONLY >= 0) {
  const { S, Play, R } = W;
  const { sid, spath, opp } = FLAT[PAIR_ONLY];
  const r = duelAssembly({ S, Play, T, R }, loadChamp(W, spath), { games: GAMES, mode: 'multi', seed0: SEED0, n: 2, scripted: opp.chooser });
  console.log('PAIR ' + PAIR_ONLY + ' ' + sid + ' ' + opp.id + ' ' + r.champRate.toFixed(2) + ' ' + r.winRate.toFixed(2) + ' ' + r.drawPct.toFixed(2) + ' ' + r.avgRounds.toFixed(1));
  process.exit(0);
}

console.log('mem-probe-e6 | games=' + GAMES + ' | pairs=' + FLAT.length + ' | jobs=' + JOBS);
const pairs = [];
let idx = 0, done = 0;
await Promise.all(Array.from({ length: Math.min(JOBS, FLAT.length) }, async () => {
  while (idx < FLAT.length) {
    const i = idx++;
    const { stdout } = await execFileP('node', [fileURLToPath(import.meta.url), '--games=' + GAMES, '--pair=' + i], { cwd: process.cwd(), maxBuffer: 1 << 24 });
    const line = stdout.split('\n').find((l) => l.startsWith('PAIR ' + i + ' '));
    const [, , sid, oppId, sw, ow, dw, rd] = line.split(/\s+/);
    pairs.push({ i, sid, oppId, set: oppId[0], subjWin: +sw, oppWin: +ow, draw: +dw, rounds: +rd });
    done++;
    if (done % 12 === 0 || done === FLAT.length) console.log('[' + done + '/' + FLAT.length + ']');
  }
}));
pairs.sort((a, b) => a.i - b.i);
console.log('\n=== 汇总 ===');
for (const sid of SUBJECTS.map((s) => s[0])) {
  const rows = pairs.filter((p) => p.sid === sid);
  const avg = (set) => rows.filter((x) => x.set === set).reduce((a, x) => a + x.subjWin, 0) / Math.max(1, rows.filter((x) => x.set === set).length);
  console.log(sid.padEnd(12) + ' R ' + avg('R').toFixed(1) + '% ‖ H ' + avg('H').toFixed(1) + '% ‖ Gap ' + (avg('R') - avg('H')).toFixed(1) + 'pt');
}
