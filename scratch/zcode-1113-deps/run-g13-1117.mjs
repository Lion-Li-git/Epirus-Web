/* run-g10-kl-1117.mjs —— gen10：KL 锚定 PG 过门尝试。
 * MX7-GD-R6B（mine/rod/cannon 全打出，skE 16/16）block×2 —— G5[long] 防席夺冠门。
 * pg-train --klW=0.18 --klModes=long,standard：锚住长/标准桌行为（门所在的桌形），
 * 塑形只给 dmgW 轻量——看键活与门能不能共存。 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const UP = 'scratch/arms/MX5-GD-R6C.bak';
const OUT = 'scratch/arms/MX8-R6C-KL.bak';
const TAG = 'mx8-r6c-kl';
const MX_TBL = 'champion-map/data/exam4n-mixed-matrix-1117g3';
const CHAMP_ARG = 'MSB15R-HITMIX,GD6a-TILT,Q-s47,OBS6E9,OBS6P4-S4000';
const CHAMP_EMIT = 'MSB15R-HITMIX+GD6a-TILT+Q-s47+OBS6E9+OBS6P4-S4000x1';
const get = (line, k) => { const m = line.match(new RegExp('[ hnxpks]' + k + '=([^ %]+)')); return m ? m[1] : ''; };

const t0 = Date.now();
try {
  const { stdout } = await execFileP('node', ['training/proto2/pg-train.mjs', '--up=' + UP, '--out=' + OUT, '--tag=' + TAG,
    '--seed=2026112801', '--games=600', '--klW=0.18', '--klModes=long,standard', '--dmgW=0.02'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
  console.log('✅ train（' + Math.round((Date.now() - t0) / 1000) + 's）‖ ' + stdout.trim().split('\n').slice(-1)[0].slice(0, 120));
} catch (e) { console.error('⛔ train：' + String(e.stdout || e.message).slice(-600)); process.exit(2); }

/* promote */
let promo = null;
try {
  const { stdout } = await execFileP('node', ['tools/promote-champion.mjs', OUT, '--dry', '--games=10', '--exam-games=20', '--json'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
  const line = stdout.split('\n').filter((l) => l.startsWith('EPIRUS_JSON ')).pop();
  promo = JSON.parse(line.slice('EPIRUS_JSON '.length)); writeFileSync('champion-map/staging/MX8-R6C-KL-audit.json', line.slice('EPIRUS_JSON '.length) + '\n', 'utf8');
} catch (e) {
  const line = String(e.stdout || '').split('\n').filter((l) => l.startsWith('EPIRUS_JSON ')).pop();
  if (line) { promo = JSON.parse(line.slice('EPIRUS_JSON '.length)); writeFileSync('champion-map/staging/MX8-R6B-KL-audit.json', line.slice('EPIRUS_JSON '.length) + '\n', 'utf8'); }
  else console.log('  ⛔ promote 无 JSON');
}
/* mixed 考卷 */
const cells = {}, keysSeen = {};
for (const mode of ['multi', 'long']) {
  try {
    const { stdout } = await execFileP('node', ['tools/exam-4n.mjs', '6', '77000', OUT, '--dose=exam', '--mode=' + mode, '--exam=both', '--champ=' + CHAMP_ARG, '--champn=1'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
    const v2 = stdout.split('\n').filter((l) => l.startsWith('[冠军4N-v2]')).pop();
    const row = [TAG, get(v2, 'h2'), get(v2, 'h3'), get(v2, 'h5'), get(v2, 'h8'), get(v2, 'x2'), get(v2, 'x3'), get(v2, 'x5'), get(v2, 'x8'),
      get(v2, 'n2'), get(v2, 'n3'), get(v2, 'n5'), get(v2, 'n8'), '77000', '6', mode, 'exam', 'both(v2)', '', CHAMP_EMIT, get(v2, 'sec'), get(v2, 'skU'), get(v2, 'skE'), get(v2, 'keys')];
    appendFileSync(MX_TBL + '-' + mode + '.tsv', row.join('\t') + '\n', 'utf8');
    cells[mode] = { C: ((+row[5] + +row[6] + +row[7] + +row[8]) / 4), skE: +row[22] || 0 };
    keysSeen[mode] = (row[23] || '').split(',');
  } catch (e) { console.log('  ⛔ mixed ' + mode + ': ' + String(e.message).slice(0, 100)); }
}
const keysAll = new Set([].concat(keysSeen.multi || [], keysSeen.long || []));
const hit = ['armor', 'mine', 'rod', 'cannon'].filter((k) => keysAll.has(k));
console.log('== MX8-R6C-KL ‖ ' + (promo ? (promo.blocked ? 'block×' + promo.count : 'ALL-GATE') : 'no-json') + ' ‖ C多=' + (cells.multi ? cells.multi.C.toFixed(4) : '—') + ' C长=' + (cells.long ? cells.long.C.toFixed(4) : '—') + ' skE=' + (cells.multi ? cells.multi.skE + '/' + cells.long.skE : '—') + ' ‖ 键命中: ' + (hit.join(',') || '无'));
