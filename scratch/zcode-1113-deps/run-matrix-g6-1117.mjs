/* run-matrix-g3-1117.mjs —— gen3：T2/T3/T4 覆盖臂 + T1 线强度臂（用户令 02:0x：t1 成功但强度略低 → 接着 t2t3 乃至 t4 以及提升强度）。
 *
 * 载体考古（先考古）：T2=transfer/drain 全库 0/17，但 supfit-gd 有 `transfer` 键道脚本教师（TEACHER_KNOWN）；
 *   T3=miniT/mine/laser_eye/cannon 全 0，有 `minit/lasereye/cannon/detonate` 教师——mine 无教师，如实留洞；
 *   T1 的 big_t 全 0，有 `bigt` 教师；T4=firestorm/curse 1/17（GD16m 独苗，scratch/arms/GD16m-D1.bak）。
 * 手法（gen2 结论：配方主导）：强底座 MX1-E9-GD + shapeTeachers 键道教师混入既有 lane（权重 0.30，其余按比例缩）。
 * 预注册：promote 全门 ∧ mixed skE≥4 ∧ keys= 含目标键（T2:transfer|drain ‖ T3L:lasereye|cannon ‖ T3M:minit ‖ T1B:bigt ‖ T4:firestorm|curse ‖ STR:C≥底座）。
 * 考卷表：exam4n-mixed-matrix-1117g3-*（+keys 列）。 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const argvv = process.argv.slice(2);
const JOBS = Math.max(1, Number((argvv.find((x) => x.startsWith('--jobs=')) || '--jobs=3').split('=')[1]) || 3);
const DRY = argvv.includes('--dry');

const parseRecipe = (f) => {
  const o = {};
  for (const l of readFileSync(f, 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0) o[l.slice(0, i)] = l.slice(i + 1); }
  return o;
};
const S4 = parseRecipe('scratch/zcode-1113-deps/recipe-eq-s4.txt');
const GD = parseRecipe('scratch/zcode-1113-deps/recipe-gd6.txt');

/* lane 合并：往 lane 里插 script 教师并按 (1-w) 缩其余权重 */
const mergeLane = (lane, add, w) => {
  const parts = lane.split('+');
  const rest = parts.map((p) => { const i = p.lastIndexOf('@'); const ww = i > 0 ? +p.slice(i + 1) : 1; return p.slice(0, i > 0 ? i : undefined) + '@' + (ww * (1 - w)).toFixed(4); });
  return rest.join('+') + '+' + add + '@' + w;
};
const addLanes = (st, shapeSet, add, w) => st.split(';').map((lane) => {
  const eq = lane.indexOf('='); const shape = lane.slice(0, eq);
  return shapeSet.has(shape) ? shape + '=' + mergeLane(lane.slice(eq + 1), add, w) : lane;
}).join(';');

const BASE = 'docs/artifacts/obs6-coldstart/MX1-E9-GD.bak';
const GD16M = 'scratch/arms/GD16m-D1.bak';
const ST12 = GD.arenaShapes;

/* gen3 臂表 */
const ARMS = [
  { tag: 'MX5-GD-T4STR', base: 'docs/artifacts/obs6-coldstart/MX3-GDEQ-GD.bak', want: ['firestorm', 'curse'], g: GD.groups,
    st: addLanes(S4.shapeTeachers, new Set(['3:multi']), 'pack:scratch/arms/GD16m-D1.bak', 0.10) },
  { tag: 'MX5-GD-LE40', base: 'docs/artifacts/obs6-coldstart/MX1-E9-GD.bak', want: ['laserEye'], g: GD.groups,
    st: addLanes(S4.shapeTeachers, new Set(['3:multi', '5:multi']), 'lasereye', 0.40) },
];
let seedN = 2026112101;
for (const a of ARMS) { a.seed = String(seedN++); a.out = 'scratch/arms/' + a.tag + '.bak'; }

console.log('gen3 ' + ARMS.length + ' 臂（jobs=' + JOBS + '）：\n  ' + ARMS.map((a) => a.tag).join(' '));
if (DRY) { for (const a of ARMS) console.log('\n[' + a.tag + '] shapes=' + (a.shapes || S4.arenaShapes) + '\n  st=' + a.st); process.exit(0); }

const MX_TBL = 'champion-map/data/exam4n-mixed-matrix-1117g3';
const HEAD = ['id', 'h2', 'h3', 'h5', 'h8', 'x2', 'x3', 'x5', 'x8', 'n2', 'n3', 'n5', 'n8', 'seed', 'rounds', 'mode', 'dose', 'exam', 'pool', 'champ', 'sec', 'skU', 'skE', 'keys'];
for (const mode of ['multi', 'long']) {
  const p = MX_TBL + '-' + mode + '.tsv';
  if (!existsSync(p)) writeFileSync(p, HEAD.join('\t') + '\n', 'utf8');
}
const get = (line, k) => { const m = line.match(new RegExp('[ hnxpks]' + k + '=([^ ]+)')); return m ? m[1] : ''; };
const CHAMP_EMIT = 'MSB15R-HITMIX+GD6a-TILT+Q-s47+OBS6E9+OBS6P4-S4000x1';
const CHAMP_ARG = 'MSB15R-HITMIX,GD6a-TILT,Q-s47,OBS6E9,OBS6P4-S4000';

async function measure(a) {
  let promo = null;
  try {
    const { stdout } = await execFileP('node', ['tools/promote-champion.mjs', a.out, '--dry', '--games=10', '--exam-games=20', '--json'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
    const line = stdout.split('\n').filter((l) => l.startsWith('EPIRUS_JSON ')).pop();
    if (line) { promo = JSON.parse(line.slice('EPIRUS_JSON '.length)); writeFileSync('champion-map/staging/' + a.tag + '-audit.json', line.slice('EPIRUS_JSON '.length) + '\n', 'utf8'); }
  } catch (e) {
    const line = String(e.stdout || '').split('\n').filter((l) => l.startsWith('EPIRUS_JSON ')).pop();
    if (line) { promo = JSON.parse(line.slice('EPIRUS_JSON '.length)); writeFileSync('champion-map/staging/' + a.tag + '-audit.json', line.slice('EPIRUS_JSON '.length) + '\n', 'utf8'); }
    else console.log('  ⛔ promote 无 JSON：' + String(e.message).slice(0, 120));
  }
  const cells = {}, keysSeen = {};
  for (const mode of ['multi', 'long']) {
    try {
      const { stdout } = await execFileP('node', ['tools/exam-4n.mjs', '6', '77000', a.out, '--dose=exam', '--mode=' + mode, '--exam=both', '--champ=' + CHAMP_ARG, '--champn=1'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
      const v2 = stdout.split('\n').filter((l) => l.startsWith('[冠军4N-v2]')).pop();
      if (!v2) { console.log('  ⛔ ' + mode + ' 无 v2 行'); continue; }
      const row = [a.tag, get(v2, 'h2'), get(v2, 'h3'), get(v2, 'h5'), get(v2, 'h8'), get(v2, 'x2'), get(v2, 'x3'), get(v2, 'x5'), get(v2, 'x8'),
        get(v2, 'n2'), get(v2, 'n3'), get(v2, 'n5'), get(v2, 'n8'), '77000', '6', mode, 'exam', 'both(v2)',
        (stdout.match(/ pool=([^ ]+)/) || [])[1] || '', CHAMP_EMIT, (stdout.match(/ sec=([^ ]+)/) || [])[1] || '', get(v2, 'skU'), get(v2, 'skE'), get(v2, 'keys')];
      appendFileSync(MX_TBL + '-' + mode + '.tsv', row.join('\t') + '\n', 'utf8');
      cells[mode] = { C: ((+row[5] + +row[6] + +row[7] + +row[8]) / 4), skE: +row[22] || 0 };
      keysSeen[mode] = (row[23] || '').split(',');
    } catch (e) { console.log('  ⛔ mixed ' + mode + '：' + String(e.message).slice(0, 120)); }
  }
  const gates = promo ? (promo.blocked ? 'block×' + promo.count : 'ALL-GATE') : 'no-json';
  const keysAll = new Set([].concat(keysSeen.multi || [], keysSeen.long || []));
  const hit = a.want.length ? a.want.filter((k) => keysAll.has(k)) : [];
  const baseC = a.tag === 'MX4-U4-STR' ? 0.144 : null;
  const ok = promo && !promo.blocked && cells.multi && cells.multi.skE >= 4 && cells.long && cells.long.skE >= 4
    && (a.want.length ? hit.length > 0 : true)
    && (baseC !== null ? (cells.multi.C >= baseC && cells.long.C >= 0.202) : true);
  console.log('== ' + a.tag + ' ‖ ' + gates + ' ‖ C多=' + (cells.multi ? cells.multi.C.toFixed(4) : '—') + ' C长=' + (cells.long ? cells.long.C.toFixed(4) : '—') + ' skE=' + (cells.multi ? cells.multi.skE + '/' + cells.long.skE : '—') + ' ‖ 目标键命中: ' + (hit.join(',') || '无') + (ok ? ' ⇒ ★' : ''));
  return { tag: a.tag, gates, ok, hit, cells };
}

let idx = 0;
const results = [];
async function worker() {
  while (idx < ARMS.length) {
    const a = ARMS[idx++];
    const t0 = Date.now();
    const args = ['training/proto2/supfit-gd.mjs', '--upstream=' + a.base, '--out=' + a.out, '--tag=' + a.tag.toLowerCase(),
      '--seed=' + a.seed, '--lr=' + S4.lr, '--steps=' + S4.steps, '--groups=' + a.g, '--objective=' + S4.objective,
      '--dagger=' + S4.dagger, '--dagtemp=' + S4.dagTemp, '--pool=' + GD.pool, '--shapeBal=' + S4.shapeBal,
      '--rolloutMode=' + S4.rolloutMode, '--classPow=' + S4.classPow, '--classCap=' + S4.classCap,
      '--teacher=pack:' + a.base, '--keySplit=' + S4.keySplit, '--arenaShapes=' + (a.shapes || S4.arenaShapes), '--shapeTeachers=' + a.st];
    if (a.rare) args.push('--rareOnly=' + a.rare, '--rareFrac=' + a.rf);
    try {
      const { stdout } = await execFileP('node', args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
      console.log('✅ train ' + a.tag + '（' + Math.round((Date.now() - t0) / 1000) + 's）');
      results.push(await measure(a));
    } catch (e) {
      console.error('⛔ train ' + a.tag + '：' + String(e.stdout || e.message).slice(-500));
      results.push({ tag: a.tag, ok: false });
    }
  }
}
await Promise.all(Array.from({ length: Math.min(JOBS, ARMS.length) }, worker));
const ok = results.filter((r) => r.ok);
console.log('\n=== gen3 完成：' + results.length + ' 臂 ‖ 过预注册 ' + ok.length + '（' + ok.map((r) => r.tag + '[' + r.hit.join('/') + ']').join(', ') + '） ===');
