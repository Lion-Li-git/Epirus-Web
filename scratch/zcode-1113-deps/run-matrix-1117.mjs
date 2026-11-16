/* run-matrix-1117.mjs —— 批3：大规模训练矩阵（用户令的覆盖顺序：先过线+短技能保底 → 再 T1 → 后 T2/T3）。
 *
 * 波次（技能覆盖顺序）：
 *   MX1 = 过线+短技能保底波：底座 {EQ-S4-E9, EQ-S4-GD6ATEACH}——两枚全门+经济候选，配方全部以"promote 全过"为先。
 *   MX2 = T1 覆盖波：底座 {OBS6-UNIFIED-US1, OBS6-UNIFIED-U4}——US1 持 ring/rg9/bigT6 全四象限链，
 *         教师组合沿用 MX1 已验证的四款，回答"EQ 配方保不保得住 T1 覆盖"（长程臂禁高权重 E9 基座——记忆铁律，US1/U4 不是 E9 系）。
 *   T2/T3 层（transfer/drain、miniT/mine/laser_eye/cannon）今晚不开——等 MX1/MX2 出"全门+skE≥4"粒后再定。
 *
 * 教师组合（每底座 4 款）：EQ = S4 均衡 11 形原方 ‖ ST = 12 形（补 2:multi）+ S4 教师 ‖ GD = GD6a 经济道原方 ‖ BA = GD6a+breakAll 加权。
 * 预注册验收（每臂）：promote --dry 全门（blocked=false）∧ mixed 夹具 skE ≥ 4 ⇒ 进 Next；其余留 scratch 记负结果。
 * 电池：train(supfit-gd 1500组/180步) → promote --json blob → mixed 考卷两桌形（新表 exam4n-mixed-matrix-1117，§E597 不混 1116 表）。
 * 用法：node scratch/zcode-1113-deps/run-matrix-1117.mjs [--wave=1|2|both] [--jobs=3] [--dry]
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argvv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const argvv = argv;
const WAVE = arg('wave', 'both');
const JOBS = Math.max(1, Number(arg('jobs', '3')) || 3);
const DRY = argvv.includes('--dry');

const parseRecipe = (f) => {
  const o = {};
  for (const l of readFileSync(f, 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0) o[l.slice(0, i)] = l.slice(i + 1); }
  return o;
};
const S4 = parseRecipe('scratch/zcode-1113-deps/recipe-eq-s4.txt');
const GD = parseRecipe('scratch/zcode-1113-deps/recipe-gd6.txt');

/* 12 形（GD6 桌形）+ S4 教师混方 + 2:multi 补（镜像 2:standard 的混合比） */
const ST12 = '2:standard=pack:js/bundled-champion.js@0.55+pack:scratch/arms/EQ-S3-HYB.bak@0.45;2:long=pack:scratch/arms/EQ-S3-HYB.bak@0.50+pack:scratch/arms/EQ-E9-A1.bak@0.50;2:multi=pack:js/bundled-champion.js@0.55+pack:scratch/arms/EQ-S3-HYB.bak@0.45;3:multi=' + S4.shapeTeachers.split(';').find((s) => s.startsWith('3:multi=')).slice('3:multi='.length) + ';5:multi=' + S4.shapeTeachers.split(';').find((s) => s.startsWith('5:multi=')).slice('5:multi='.length) + ';8:multi=' + S4.shapeTeachers.split(';').find((s) => s.startsWith('8:multi=')).slice('8:multi='.length) + ';3:long=' + S4.shapeTeachers.split(';').find((s) => s.startsWith('3:long=')).slice('3:long='.length) + ';5:long=' + S4.shapeTeachers.split(';').find((s) => s.startsWith('5:long=')).slice('5:long='.length) + ';8:long=' + S4.shapeTeachers.split(';').find((s) => s.startsWith('8:long=')).slice('8:long='.length);
/* GD6a+breakAll 加权（经济教师保 0.45，breakAll 抬到 0.20） */
const GD_EM = 'pack:docs/artifacts/night-adapt/GD6a-TILT-3p.bak@0.45+pack:docs/artifacts/obs6-coldstart/EQ-S4-E9.bak@0.35+breakAll@0.20';
const BA_ST = '5:long=' + GD_EM + ';8:long=' + GD_EM;

const BASES = {
  1: [['E9', 'docs/artifacts/obs6-coldstart/EQ-S4-E9.bak'], ['GD', 'docs/artifacts/obs6-coldstart/EQ-S4-GD6ATEACH.bak']],
  2: [['US1', 'docs/artifacts/obs6-coldstart/OBS6-UNIFIED-US1.bak'], ['U4', 'docs/artifacts/obs6-coldstart/OBS6-UNIFIED-U4.bak']],
};
const COMBOS = {
  EQ: (r) => ({ shapes: S4.arenaShapes, st: S4.shapeTeachers, ap: S4.arenaPool }),
  ST: (r) => ({ shapes: GD.arenaShapes, st: ST12, ap: S4.arenaPool }),
  GD: (r) => ({ shapes: GD.arenaShapes, st: GD.shapeTeachers, ap: null }),
  BA: (r) => ({ shapes: GD.arenaShapes, st: BA_ST, ap: null }),
};

const arms = [];
let seedN = 2026111701;
for (const w of (WAVE === 'both' ? [1, 2] : [Number(WAVE)])) {
  for (const [bn, bp] of BASES[w]) {
    for (const cn of ['EQ', 'ST', 'GD', 'BA']) {
      const c = COMBOS[cn]();
      arms.push({
        w, bn, cn, base: bp,
        out: 'scratch/arms/MX' + w + '-' + bn + '-' + cn + '.bak',
        tag: 'mx' + w + '-' + bn.toLowerCase() + '-' + cn.toLowerCase(),
        seed: String(seedN++),
        shapes: c.shapes, st: c.st, ap: c.ap,
      });
    }
  }
}
console.log('矩阵 ' + arms.length + ' 臂（jobs=' + JOBS + '）：\n  ' + arms.map((a) => a.out.replace('scratch/arms/', '').replace('.bak', '')).join(' '));
if (DRY) process.exit(0);

const MX_TBL = 'champion-map/data/exam4n-mixed-matrix-1117';
const HEAD = ['id', 'h2', 'h3', 'h5', 'h8', 'x2', 'x3', 'x5', 'x8', 'n2', 'n3', 'n5', 'n8', 'seed', 'rounds', 'mode', 'dose', 'exam', 'pool', 'champ', 'sec', 'skU', 'skE'];
for (const mode of ['multi', 'long']) {
  const p = MX_TBL + '-' + mode + '.tsv';
  if (!existsSync(p)) writeFileSync(p, HEAD.join('\t') + '\n', 'utf8');
}

const get = (line, k) => { const m = line.match(new RegExp('[ hnxpks]' + k + '=([^ %]+)')); return m ? m[1] : ''; };
const CHAMP_EMIT = 'MSB15R-HITMIX+GD6a-TILT+Q-s47+OBS6E9+OBS6P4-S4000x1';
const CHAMP_ARG = 'MSB15R-HITMIX,GD6a-TILT,Q-s47,OBS6E9,OBS6P4-S4000';

async function measure(a) {
  /* ① promote 体检 blob */
  let promo = null;
  try {
    const { stdout } = await execFileP('node', ['tools/promote-champion.mjs', a.out, '--dry', '--games=10', '--exam-games=20', '--json'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
    const line = stdout.split('\n').filter((l) => l.startsWith('EPIRUS_JSON ')).pop();
    if (line) { promo = JSON.parse(line.slice('EPIRUS_JSON '.length)); writeFileSync('champion-map/staging/' + a.tag + '-audit.json', line.slice('EPIRUS_JSON '.length) + '\n', 'utf8'); }
  } catch (e) {
    const so = String(e.stdout || '');
    const line = so.split('\n').filter((l) => l.startsWith('EPIRUS_JSON ')).pop();
    if (line) { promo = JSON.parse(line.slice('EPIRUS_JSON '.length)); writeFileSync('champion-map/staging/' + a.tag + '-audit.json', line.slice('EPIRUS_JSON '.length) + '\n', 'utf8'); }
    else console.log('  ⛔ promote 无 JSON：' + String(e.message).slice(0, 120));
  }
  /* ② mixed 考卷两桌形 */
  const cells = {};
  for (const mode of ['multi', 'long']) {
    try {
      const { stdout } = await execFileP('node', ['tools/exam-4n.mjs', '6', '77000', a.out, '--dose=exam', '--mode=' + mode, '--exam=both', '--champ=' + CHAMP_ARG, '--champn=1'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
      const v2 = stdout.split('\n').filter((l) => l.startsWith('[冠军4N-v2]')).pop();
      if (!v2) { console.log('  ⛔ ' + mode + ' 无 v2 行'); continue; }
      const row = [a.tag, get(v2, 'h2'), get(v2, 'h3'), get(v2, 'h5'), get(v2, 'h8'), get(v2, 'x2'), get(v2, 'x3'), get(v2, 'x5'), get(v2, 'x8'),
        get(v2, 'n2'), get(v2, 'n3'), get(v2, 'n5'), get(v2, 'n8'), '77000', '6', mode, 'exam', 'both(v2)',
        (stdout.match(/ pool=([^ ]+)/) || [])[1] || '', CHAMP_EMIT, (stdout.match(/ sec=([^ ]+)/) || [])[1] || '', get(v2, 'skU'), get(v2, 'skE')];
      appendFileSync(MX_TBL + '-' + mode + '.tsv', row.join('\t') + '\n', 'utf8');
      cells[mode] = { C: ((+row[5] + +row[6] + +row[7] + +row[8]) / 4), skE: +row[22] || 0, skU: +row[21] || 0 };
    } catch (e) { console.log('  ⛔ mixed ' + mode + '：' + String(e.message).slice(0, 120)); }
  }
  const gates = promo ? (promo.blocked ? 'block×' + promo.count : 'ALL-GATE') : 'no-json';
  const ok = promo && !promo.blocked && cells.multi && cells.multi.skE >= 4 && cells.long && cells.long.skE >= 4;
  console.log('== ' + a.tag + ' ‖ ' + gates + ' ‖ C_multi=' + (cells.multi ? cells.multi.C.toFixed(4) : '—') + ' C_long=' + (cells.long ? cells.long.C.toFixed(4) : '—') + ' skE=' + (cells.multi ? cells.multi.skE + '/' + cells.long.skE : '—') + (ok ? ' ⇒ ★ 进 Next' : ''));
  return { tag: a.tag, gates, cells, ok };
}

let idx = 0;
const results = [];
async function worker() {
  while (idx < arms.length) {
    const a = arms[idx++];
    const t0 = Date.now();
    const args = ['training/proto2/supfit-gd.mjs', '--upstream=' + a.base, '--out=' + a.out, '--tag=' + a.tag,
      '--seed=' + a.seed, '--lr=' + S4.lr, '--steps=' + S4.steps, '--groups=' + GD.groups, '--objective=' + S4.objective,
      '--dagger=' + S4.dagger, '--dagtemp=' + S4.dagTemp, '--pool=' + GD.pool, '--shapeBal=' + S4.shapeBal,
      '--rolloutMode=' + S4.rolloutMode, '--classPow=' + S4.classPow, '--classCap=' + S4.classCap,
      '--teacher=pack:' + a.base, '--keySplit=' + S4.keySplit, '--arenaShapes=' + a.shapes, '--shapeTeachers=' + a.st];
    if (a.ap && a.ap !== 'null') args.push('--arenaPool=' + a.ap);
    try {
      const { stdout } = await execFileP('node', args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
      console.log('✅ train ' + a.tag + '（' + Math.round((Date.now() - t0) / 1000) + 's）‖ ' + stdout.trim().split('\n').slice(-1)[0].slice(0, 100));
      results.push(await measure(a));
    } catch (e) {
      console.error('⛔ train ' + a.tag + '：' + String(e.stdout || e.message).slice(-600));
      results.push({ tag: a.tag, gates: 'train-fail', ok: false });
    }
  }
}
await Promise.all(Array.from({ length: Math.min(JOBS, arms.length) }, worker));
const next = results.filter((r) => r.ok);
console.log('\n=== 矩阵完成：' + results.length + ' 臂 ‖ 进 Next ' + next.length + ' 枚（' + next.map((r) => r.tag).join(', ') || '无' + '） ===');
