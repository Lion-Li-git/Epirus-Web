/* run-g11-1117.mjs —— gen11：三臂 KL 锚定（gen10 的 KL 修复模式推广）。
 * ① MX7-T4-R（firestorm/curse 活但 block×1）② MX5-GD-T3L2（cannon 活但 block×1）③ laserEye@0.15 轻触（LE 强度粒试探）。
 * 预注册：全门 ∧ 目标键活。 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const S4ST = readFileSync('scratch/zcode-1113-deps/recipe-eq-s4.txt', 'utf8').match(/shapeTeachers=(.*)/)[1];
const mergeLane = (lane, add, w) => {
  const parts = lane.split('+');
  const rest = parts.map((p) => { const i = p.lastIndexOf('@'); const ww = i > 0 ? +p.slice(i + 1) : 1; return p.slice(0, i > 0 ? i : undefined) + '@' + (ww * (1 - w)).toFixed(4); });
  return rest.join('+') + '+' + add + '@' + w;
};
const addLanes = (st, shapeSet, add, w) => st.split(';').map((lane) => {
  const eq = lane.indexOf('='); const shape = lane.slice(0, eq);
  return shapeSet.has(shape) ? shape + '=' + mergeLane(lane.slice(eq + 1), add, w) : lane;
}).join(';');
const LE15_ST = addLanes(S4ST, new Set(['3:multi', '5:multi']), 'lasereye', 0.15);

const ARMS = [
  { tag: 'MX8-LE20', up: 'docs/artifacts/obs6-coldstart/MX1-E9-GD.bak', want: ['laserEye'], pre: 'supfit',
    st: addLanes(S4ST, new Set(['3:multi', '5:multi']), 'lasereye', 0.20) },
  { tag: 'MX8-LE25', up: 'docs/artifacts/obs6-coldstart/MX1-E9-GD.bak', want: ['laserEye'], pre: 'supfit',
    st: addLanes(S4ST, new Set(['3:multi', '5:multi']), 'lasereye', 0.25) },
  { tag: 'MX8-CN-M', up: 'docs/artifacts/obs6-coldstart/MX1-E9-GD.bak', want: ['cannon'], pre: 'supfit',
    st: addLanes(S4ST, new Set(['3:multi', '5:multi']), 'cannon', 0.20) },
];
const MX_TBL = 'champion-map/data/exam4n-mixed-matrix-1117g3';
const CHAMP_ARG = 'MSB15R-HITMIX,GD6a-TILT,Q-s47,OBS6E9,OBS6P4-S4000';
const CHAMP_EMIT = 'MSB15R-HITMIX+GD6a-TILT+Q-s47+OBS6E9+OBS6P4-S4000x1';
const get = (line, k) => { const m = line.match(new RegExp('[ hnxpks]' + k + '=([^ %]+)')); return m ? m[1] : ''; };

async function measure(tag, out, want) {
  let promo = null;
  try {
    const { stdout } = await execFileP('node', ['tools/promote-champion.mjs', out, '--dry', '--games=10', '--exam-games=20', '--json'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
    const line = stdout.split('\n').filter((l) => l.startsWith('EPIRUS_JSON ')).pop();
    if (line) { promo = JSON.parse(line.slice('EPIRUS_JSON '.length)); writeFileSync('champion-map/staging/' + tag.toUpperCase() + '-audit.json', line.slice('EPIRUS_JSON '.length) + '\n', 'utf8'); }
  } catch (e) {
    const line = String(e.stdout || '').split('\n').filter((l) => l.startsWith('EPIRUS_JSON ')).pop();
    if (line) { promo = JSON.parse(line.slice('EPIRUS_JSON '.length)); writeFileSync('champion-map/staging/' + tag.toUpperCase() + '-audit.json', line.slice('EPIRUS_JSON '.length) + '\n', 'utf8'); }
    else console.log('  ⛔ promote 无 JSON');
  }
  const cells = {}, keysSeen = {};
  for (const mode of ['multi', 'long']) {
    try {
      const { stdout } = await execFileP('node', ['tools/exam-4n.mjs', '6', '77000', out, '--dose=exam', '--mode=' + mode, '--exam=both', '--champ=' + CHAMP_ARG, '--champn=1'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
      const v2 = stdout.split('\n').filter((l) => l.startsWith('[冠军4N-v2]')).pop();
      const row = [tag, get(v2, 'h2'), get(v2, 'h3'), get(v2, 'h5'), get(v2, 'h8'), get(v2, 'x2'), get(v2, 'x3'), get(v2, 'x5'), get(v2, 'x8'),
        get(v2, 'n2'), get(v2, 'n3'), get(v2, 'n5'), get(v2, 'n8'), '77000', '6', mode, 'exam', 'both(v2)', '', CHAMP_EMIT, get(v2, 'sec'), get(v2, 'skU'), get(v2, 'skE'), get(v2, 'keys')];
      appendFileSync(MX_TBL + '-' + mode + '.tsv', row.join('\t') + '\n', 'utf8');
      cells[mode] = { C: ((+row[5] + +row[6] + +row[7] + +row[8]) / 4), skE: +row[22] || 0 };
      keysSeen[mode] = (row[23] || '').split(',');
    } catch (e) { console.log('  ⛔ mixed ' + mode + ': ' + String(e.message).slice(0, 100)); }
  }
  const keysAll = new Set([].concat(keysSeen.multi || [], keysSeen.long || []));
  const hit = want.filter((k) => keysAll.has(k));
  const ok = promo && !promo.blocked && cells.multi && cells.multi.skE >= 4 && hit.length > 0;
  console.log('== ' + tag + ' ‖ ' + (promo ? (promo.blocked ? 'block×' + promo.count : 'ALL-GATE') : 'no-json') + ' ‖ C多=' + (cells.multi ? cells.multi.C.toFixed(4) : '—') + ' C长=' + (cells.long ? cells.long.C.toFixed(4) : '—') + ' skE=' + (cells.multi ? cells.multi.skE + '/' + cells.long.skE : '—') + ' ‖ 键: ' + (hit.join(',') || '无') + (ok ? ' ⇒ ★' : ''));
  return { tag, ok, hit };
}

let idx = 0;
const results = [];
async function worker() {
  while (idx < ARMS.length) {
    const a = ARMS[idx++];
    if (a.pre === 'supfit') {
      /* laserEye 轻触：先 supfit 蒸馏（S4 配方 + lasereye@0.15）再 KL 锚定 */
      const outS = 'scratch/arms/' + a.tag + '-S.bak';
      try {
        await execFileP('node', ['training/proto2/supfit-gd.mjs', '--upstream=docs/artifacts/obs6-coldstart/MX1-E9-GD.bak', '--out=' + outS, '--tag=' + a.tag.toLowerCase() + '-s',
          '--seed=2026112901', '--lr=0.0004', '--steps=180', '--groups=1500', '--objective=cand', '--dagger=1', '--dagtemp=0.15', '--pool=1500',
          '--shapeBal=1', '--rolloutMode=game', '--classPow=0.35', '--classCap=5', '--teacher=pack:docs/artifacts/obs6-coldstart/MX1-E9-GD.bak', '--keySplit=0',
          '--arenaShapes=' + (readFileSync('scratch/zcode-1113-deps/recipe-eq-s4.txt', 'utf8').match(/arenaShapes=(.*)/)[1]),
          '--shapeTeachers=' + a.st,
          '--arenaPool=names:random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,heavyfire,deepsaver,guardspam,guardspam,reflectspam,reflectspam,gunfocus,earlypressure'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
        console.log('✅ supfit ' + a.tag);
      } catch (e) { console.error('⛔ supfit ' + a.tag + ': ' + String(e.stdout || e.message).slice(-300)); results.push({ tag: a.tag, ok: false }); continue; }
    }
    const out = a.pre === 'supfit' ? 'scratch/arms/' + a.tag + '-S.bak' : a.up;
    const fin = 'scratch/arms/' + a.tag + '.bak';
    try {
      const { stdout } = await execFileP('node', ['training/proto2/pg-train.mjs', '--up=' + out, '--out=' + fin, '--tag=' + a.tag.toLowerCase(),
        '--seed=2026113101', '--games=600', '--klW=0.18', '--klModes=long,standard', '--dmgW=0.02'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
      console.log('✅ train ' + a.tag);
    } catch (e) { console.error('⛔ train ' + a.tag + ': ' + String(e.stdout || e.message).slice(-400)); results.push({ tag: a.tag, ok: false }); continue; }
    results.push(await measure(a.tag, fin, a.want));
  }
}
await Promise.all(Array.from({ length: 2 }, worker));
const ok = results.filter((r) => r.ok);
console.log('=== gen11 完成：' + results.length + ' 臂 ‖ 过预注册 ' + ok.length + '（' + ok.map((r) => r.tag + '[' + r.hit.join('/') + ']').join(', ') + '） ===');
