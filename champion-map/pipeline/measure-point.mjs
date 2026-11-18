#!/usr/bin/env node
/* measure-point.mjs —— 新点测量编排（2026-11-11 · add-point 的上游第一版）
 * 只做四件事：跑 A/B × multi/long 四张 exam4、跑 ruler-measure、拼 readings/display、调用 add-point。
 * 跑 feas(allLong/allMulti) + proj-tsne 整表重投影；新点不写 H5/F/rank（H5 是冻结旧尺，页面按 C·R 重算名次）。
 * 用法：
 *   node champion-map/pipeline/measure-point.mjs --pack=<权重> --id=<id> --ver=2.0 [--rounds=100]
 *     [--parent=<id>] [--reuse] [--from-staging] [--readings=<tsv>] [--display=<tsv>]
 *     [--audit] [--no-add] [--bake] [--dry] [--skip-long] [--skip-b] [--skip-feas] [--skip-proj]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { cpus } from 'node:os';
import { promisify } from 'node:util';
import { readTable, writeTable } from '../map-table.mjs';

const execFileP = promisify(execFile);
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const DRY = process.argv.includes('--dry');
const NO_ADD = process.argv.includes('--no-add');
const FROM_STAGING = process.argv.includes('--from-staging');
const REUSE = process.argv.includes('--reuse');
const BAKE = process.argv.includes('--bake');
const SKIP_LONG = process.argv.includes('--skip-long');
const SKIP_B = process.argv.includes('--skip-b');
const SKIP_FEAS = process.argv.includes('--skip-feas');
const SKIP_PROJ = process.argv.includes('--skip-proj');
const AUDIT = process.argv.includes('--audit');
const JOBS = Math.max(1, Number(arg('jobs', Math.min(10, cpus().length))) || 1);
const ROOT = resolve(process.cwd());
const HERE = join(ROOT, 'champion-map');
const PACK = resolve(arg('pack', ''));
const ID = String(arg('id', '')).trim();
const VER = String(arg('ver', '2.0')).trim();
const ROUNDS = String(arg('rounds', '100'));   /* 11-14：与全库重测口径对齐（100/77000）；旧缺省 12 是 exam-4n-full 时代的 */
const FAM = String(arg('fam', '')).trim();
const FAMLAB = String(arg('fam-label', '')).trim();
const PARENT = String(arg('parent', '')).trim();
const EXT_READINGS = arg('readings', '') ? resolve(arg('readings', '')) : '';
const EXT_DISPLAY = arg('display', '') ? resolve(arg('display', '')) : '';
if (!PACK || !ID) { console.error('⛔ 需要 --pack= 和 --id='); process.exit(2); }
if (!existsSync(PACK)) { console.error('⛔ pack 不在：' + PACK); process.exit(2); }
if (EXT_READINGS && !existsSync(EXT_READINGS)) { console.error('⛔ --readings 不在：' + EXT_READINGS); process.exit(2); }
if (EXT_DISPLAY && !existsSync(EXT_DISPLAY)) { console.error('⛔ --display 不在：' + EXT_DISPLAY); process.exit(2); }
const hasFile = (p) => existsSync(p) && statSync(p).size > 0;
const ST = join(HERE, 'staging');
if (!DRY) mkdirSync(ST, { recursive: true });
const rul = readTable(join(HERE, 'data/rulers.tsv'));
const curRuler = (axis) => {
  const r = rul.rows.find((r) => r[rul.ix.axis] === axis && r[rul.ix.status] === 'current');
  if (!r) { console.error('⛔ 没有 current ' + axis + ' 尺'); process.exit(2); }
  return String(r[rul.ix.ruler_id]);
};
/* 11-14 白班（ZCode）：尺 id 从 rulers.tsv 现役行取——旧硬编码 a-v2-page-1109/b-f2-page-1111 已冻结，
 *   add-point 对 frozen 尺拒写；换尺后这里就是唯一要跟的地方。 */
const RID_A = curRuler('A'), RID_B = curRuler('B'), RID_X = curRuler('X');
const bRow = rul.rows.find((r) => r[rul.ix.axis] === 'B' && r[rul.ix.status] === 'current');
const bShortRow = rul.rows.find((r) => r[rul.ix.axis] === 'B' && r[rul.ix.ruler_id] === 'b-f5-page-1114') || bRow;
const RID_B_SHORT = String(bShortRow[rul.ix.ruler_id]);
const F2 = bRow[rul.ix.fixture];
const F2_SHORT = bShortRow[rul.ix.fixture];
const F2ARG = F2_SHORT.replace(/x\d+$/, '').split('+').join(',');
const BP_WALLS = /bp1118/.test(RID_B) ? {
  EXTA: 'MSB11-R2S306293884,MX6-GD-TF15,MX8-TN25-KL,MSB15R-HITMIX,OBS6-LH6P',
  EXTB: 'MSB14-railgun-R1S175656469,MX3-GDEQ-GD,MX8-R6B-KL,OBS6-SHAPEDIST-V3S2,OBS6P4-S4000',
  EXTC: 'MSB11-R2S306293884,MSB14-railgun-R1S175656469,MSB15R-HITMIX,MX6-GD-TF15,OBS6-LH6P',
  EXTD: 'MSB15R-HITMIX,WSEL9-200,OBS6-LH6P,MX8-TN25-KL,MX1-GD-EQ',
  EXTE: 'DEF-s16,EQ-S4-GD6ATEACH,MX3-GDEQ-GD,MX8-TN25-KL,MX5-GD-T2STR',
} : null;
const ARENA_B = /arena/.test(RID_B);
const rel = PACK.replace(ROOT + '\\', '').replace(/\\/g, '/');
const extra = join(ST, ID + '-extra.tsv'), only = join(ST, ID + '-only.txt');
if (!DRY) {
  writeFileSync(extra, 'arm\tproductRel\n' + ID + '\t' + rel + '\n', 'utf8');
  writeFileSync(only, ID + '\n', 'utf8');
}
const runs = [];
const addRun = (tag, exam, mode, dose, args) => runs.push({ tag, exam, mode, dose, args });
/* 11-14 白班（ZCode）：考卷口径与全库重测对齐（rerun-1114 同款）——exam-4n.mjs 位置参数 100/77000，
 *   A 轴带 --coop=v3（原轮 + 配合剧本追加局），B 轴带 F5 champ 墙；eps0（dose=exam，Δε 配对半边）补跑，
 *   读数落 readings（display 无 eps0 列）。rounds 缺省 12→100。 */
const ex = (tag, mode, axis, dose, extraArgs) => {
  addRun(tag, axis, mode, dose, ['tools/exam-4n.mjs', ROUNDS, '77000', rel,
    '--dose=' + dose, '--mode=' + mode, '--exam=' + axis].concat(extraArgs || []));
};
ex('a-multi', 'multi', 'A', 'page', ['--coop=v3']);
if (!SKIP_LONG) ex('a-long', 'long', 'A', 'page', ['--coop=v3']);
if (!SKIP_B) {
  if (!ARENA_B) {
    ex('b-multi', 'multi', 'B', 'page', ['--champ=' + F2ARG, '--champn=1']);
    if (!SKIP_LONG && !BP_WALLS) ex('b-long', 'long', 'B', 'page', ['--champ=' + F2ARG, '--champn=1']);
  }
  if (!ARENA_B) ex('x-multi', 'multi', 'B', 'exam', ['--champ=' + F2ARG, '--champn=1']);
  if (!ARENA_B && !SKIP_LONG) ex('x-long', 'long', 'B', 'exam', ['--champ=' + F2ARG, '--champn=1']);
}
const featOut = join(ST, ID + '-ruler.tsv');
const RULER_ARGS = ['champion-map/ruler-measure.mjs', '--extra=' + extra.replace(HERE + '\\', '').replace(/\\/g, '/'),
  '--ids=' + ID, '--out=' + featOut.replace(HERE + '\\', '').replace(/\\/g, '/'), '--exam=120', '--self=40', '--seat=100', '--probe=40'];
for (const r of runs) console.log('[measure] ' + r.tag + '：node ' + r.args.join(' '));
console.log('[measure] ruler：node ' + RULER_ARGS.join(' '));
if (DRY) { console.log('--dry：未跑任何测量'); process.exit(0); }
/* exam-4n 吐的是 `[冠军4N]` 摘要行（rerun-1114 同款抽法）——落成 staging TSV 供下面的读数拼装读 */
const EXHEAD = ['id', 'h2', 'h3', 'h5', 'h8', 'x2', 'x3', 'x5', 'x8', 'n2', 'n3', 'n5', 'n8', 'seed', 'rounds', 'mode', 'dose', 'exam', 'pool', 'champ', 'sec'];
const auditOut = join(ST, ID + '-audit.json');
const feasLongOut = join(ST, ID + '-feas-long.tsv');
const feasShortOut = join(ST, ID + '-feas-short.tsv');
const runPool = async (items, limit, fn) => {
  let idx = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i]);
    }
  }));
};
if (!FROM_STAGING) {
  const tasks = [];
  if (!EXT_READINGS) {
    for (const r of runs) {
      const out = join(ST, ID + '-' + r.tag + '.tsv');
      if (REUSE && hasFile(out)) { console.log('↷ 复用已测：' + basename(out)); continue; }
      tasks.push(async () => {
        try {
          const { stdout } = await execFileP('node', r.args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
          const line = stdout.split('\n').find((l) => l.startsWith(r.exam === 'B' ? '[冠军4N-B]' : '[冠军4N]'));
          if (!line) throw new Error('考卷摘要行缺失');
          const get = (k) => { const m = line.match(new RegExp('[ hnxpkc]' + k + '=([^ ]+)')); return m ? m[1] : ''; };
          const row = [ID, get('h2'), get('h3'), get('h5'), get('h8'), get('x2'), get('x3'), get('x5'), get('x8'),
            get('n2'), get('n3'), get('n5'), get('n8'), '77000', ROUNDS, r.mode, r.dose, r.exam, get('pool'), get('champ'), get('sec')];
          writeFileSync(out, [EXHEAD.join('\t'), row.join('\t')].join('\n') + '\n', 'utf8');
          console.log('—— ' + r.tag + ' —— ' + line.trim());
        } catch (e) {
          console.error('⛔ ' + r.tag + ' 失败：' + String(e.message || e).slice(0, 300));
          process.exit(2);
        }
      });
    }
    if (!SKIP_B && !SKIP_LONG && BP_WALLS && (!REUSE || !hasFile(join(ST, ID + '-b-long.tsv')))) {
      const bpRows = [];
      for (const [fn, champs] of Object.entries(BP_WALLS)) {
        for (const sd of ['77000', '77001']) {
          tasks.push(async () => {
            const { stdout } = await execFileP('node', ['tools/exam-4n.mjs', '6', sd, rel, '--exam=B', '--mode=long', '--champ=' + champs], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
            const line = stdout.split('\n').filter((l) => l.startsWith('[冠军4N-B]')).pop();
            if (!line) throw new Error('bp1118 无 B 行：' + fn + '/' + sd);
            const get = (k) => { const m = line.match(new RegExp('[ hnxpkc]' + k + '=([^ ]+)')); return m ? Number(m[1]) : NaN; };
            bpRows.push({ wall: fn, seed: sd, x2: get('x2'), x3: get('x3'), x5: get('x5'), x8: get('x8'), n2: get('n2'), n3: get('n3'), n5: get('n5'), n8: get('n8') });
          });
        }
      }
      /* 任务池跑完后在下方按 5 墙均值落 b-long.tsv */
      var _bpRows = bpRows;
    }
    if (!SKIP_B && ARENA_B && (!REUSE || !hasFile(join(ST, ID + '-b-multi.tsv')) || !hasFile(join(ST, ID + '-b-long.tsv')))) {
      tasks.push(async () => {
        /* 2026-11-18：Arena 分两半测——页面剂量（B 轴）+ 贪心（X 半边），同赛程同种子（176 局/包） */
        const runArena = async (dose) => {
          const { stdout } = await execFileP('node', ['tools/arena-eval.mjs', '--pack=' + rel, '--id=' + ID, '--dose=' + dose], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
          return JSON.parse(stdout.trim().split('\n').pop());
        };
        const ar = await runArena('page');
        const arX = await runArena('exam');
        for (const [tag, mode, obj, doseTag, axis, fix] of [
          ['b-multi', 'multi', ar.short, 'page', 'B', 'ARENA24-PL-1118-PAGE'],
          ['b-long', 'long', ar.long, 'page', 'B', 'ARENA24-PL-1118-PAGE'],
          ['x-multi', 'multi', arX.short, 'exam', 'x', 'ARENA24-PL-1118'],
          ['x-long', 'long', arX.long, 'exam', 'x', 'ARENA24-PL-1118'],
        ]) {
          const c = obj.cells;
          const row = [ID, '', '', '', '', c[2].x.toFixed(4), c[3].x.toFixed(4), c[5].x.toFixed(4), c[8].x.toFixed(4),
            c[2].n, c[3].n, c[5].n, c[8].n, '82200', '1', mode, doseTag, axis, 'arena24', fix, '0'];
          writeFileSync(join(ST, ID + '-' + tag + '.tsv'), [EXHEAD.join('\t'), row.join('\t')].join('\n') + '\n', 'utf8');
        }
        const metaAr = { arS: ar.short.x4.toFixed(4), arL: ar.long.x4.toFixed(4), arR: ar.rAll.toFixed(4) };
        writeFileSync(join(ST, ID + '-bp.json'), JSON.stringify(metaAr) + '\n', 'utf8');
        if (!NO_ADD) {
          for (const [arObj, suffix] of [[ar, '-page'], [arX, '']]) {
            const arFile = join(HERE, 'data/exam4n-arena' + suffix + '-1118.tsv');
            const prev = existsSync(arFile) ? readFileSync(arFile, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').filter((l) => l && !l.startsWith(ID + '\t')) : [];
            const rowLine = [ID, arObj.short.cells[2].x.toFixed(4), arObj.short.cells[3].x.toFixed(4), arObj.short.cells[5].x.toFixed(4), arObj.short.cells[8].x.toFixed(4), arObj.short.x4.toFixed(4),
              arObj.long.cells[2].x.toFixed(4), arObj.long.cells[3].x.toFixed(4), arObj.long.cells[5].x.toFixed(4), arObj.long.cells[8].x.toFixed(4), arObj.long.x4.toFixed(4),
              arObj.rAll.toFixed(4), arObj.short.r.toFixed(4), arObj.long.r.toFixed(4)].join('\t');
            writeFileSync(arFile, prev.concat([rowLine]).join('\n') + '\n', 'utf8');
          }
        }
        console.log('—— arena-b —— arS=' + metaAr.arS + ' arL=' + metaAr.arL + ' arR=' + metaAr.arR);
      });
    }
  } else console.log('↷ 复用外部 readings：' + basename(EXT_READINGS));
  if (!EXT_DISPLAY) {
    if (REUSE && hasFile(featOut)) console.log('↷ 复用已测：' + basename(featOut));
    else tasks.push(async () => {
      try {
        const { stdout } = await execFileP('node', RULER_ARGS, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
        console.log('—— ruler ——\n' + stdout.trim().split('\n').slice(-2).join('\n'));
      } catch (e) {
        console.error('⛔ ruler 失败：' + String(e.message || e).slice(0, 300));
        process.exit(2);
      }
    });
    if (!SKIP_FEAS) {
      const fIn = join(ST, ID + '-feas-input.tsv');
      let wroteFin = false;
      for (const [flag, out] of [['--allLong=1', feasLongOut], ['--allMulti=1', feasShortOut]]) {
        if (REUSE && hasFile(out)) { console.log('↷ 复用已测：' + basename(out)); continue; }
        if (!wroteFin) {
          const bg = readTable(join(HERE, 'archive/2026-11-11-legacy-data/coords-gen3-1105.tsv'));
          const row = new Array(bg.header.length).fill('');
          row[bg.ix.id] = ID; row[bg.ix.path] = rel;
          writeTable(fIn, { header: bg.header, rows: bg.rows.concat([row]) }, { backup: false });
          wroteFin = true;
        }
        tasks.push(async () => {
          await execFileP('node', [join(HERE, 'feas.mjs'), '--table=' + fIn, '--ids=' + ID, '--out=' + out, flag], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
        });
      }
    }
  } else console.log('↷ 复用外部 display：' + basename(EXT_DISPLAY));
  if (AUDIT) {
    if (REUSE && hasFile(auditOut)) console.log('↷ 复用已测：' + basename(auditOut));
    else tasks.push(async () => {
      let pr = '';
      try {
        ({ stdout: pr } = await execFileP('node', ['tools/promote-champion.mjs', rel, '--dry', '--games=10', '--exam-games=20', '--json'],
          { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }));
      } catch (e) {
        if (e && typeof e.stdout === 'string' && e.stdout.indexOf('EPIRUS_JSON ') >= 0) pr = e.stdout;
        else throw e;
      }
      const line = String(pr).split('\n').filter((x) => x.indexOf('EPIRUS_JSON ') === 0).pop();
      if (!line) { console.error('⛔ --audit：promote 没有吐 EPIRUS_JSON'); process.exit(2); }
      writeFileSync(auditOut, line.slice('EPIRUS_JSON '.length) + '\n', 'utf8');
    });
  }
  await runPool(tasks, JOBS, (fn) => fn());
  if (typeof _bpRows !== 'undefined' && _bpRows.length) {
    const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const walls = Object.keys(BP_WALLS);
    const byCell = {};
    const nSum = { 2: 0, 3: 0, 5: 0, 8: 0 };
    for (const r of _bpRows) for (const c of [2, 3, 5, 8]) nSum[c] += r['n' + c];
    for (const c of [2, 3, 5, 8]) {
      byCell['x' + c] = mean(walls.map((w) => mean(_bpRows.filter((r) => r.wall === w).map((r) => r['x' + c])))).toFixed(4);
    }
    const xbWall = {};
    for (const w of walls) {
      const wr = _bpRows.filter((r) => r.wall === w);
      xbWall['bp' + w.slice(3)] = mean(wr.map((r) => 0.15 * r.x2 + 0.25 * r.x3 + 0.45 * r.x5 + 0.15 * r.x8)).toFixed(4);
    }
    xbWall.bpM = mean(walls.map((w) => Number(xbWall['bp' + w.slice(3)]))).toFixed(4);
    const row = [ID, '', '', '', '', byCell.x2, byCell.x3, byCell.x5, byCell.x8, nSum[2], nSum[3], nSum[5], nSum[8], '77000+77001', '6', 'long', 'exam', 'B', 'v2', 'EXTA..EXTE', '0'];
    writeFileSync(join(ST, ID + '-b-long.tsv'), [EXHEAD.join('\t'), row.join('\t')].join('\n') + '\n', 'utf8');
    writeFileSync(join(ST, ID + '-bp.json'), JSON.stringify(xbWall) + '\n', 'utf8');
    if (!NO_ADD) {
      const bpFile = join(HERE, 'data/exam4n-bp-1118.tsv');
      const prev = existsSync(bpFile) ? readFileSync(bpFile, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').filter((l) => l && !l.startsWith(ID + '\t')) : [];
      const addLines = _bpRows.map((r) => [ID, r.wall, r.seed, r.x2, r.x3, r.x5, r.x8, (0.15 * r.x2 + 0.25 * r.x3 + 0.45 * r.x5 + 0.15 * r.x8).toFixed(4)].join('\t'));
      writeFileSync(bpFile, prev.concat(addLines).join('\n') + '\n', 'utf8');
    }
    console.log('—— b-long(bp1118) —— bpM=' + xbWall.bpM + ' (' + walls.map((w) => w + ':' + xbWall['bp' + w.slice(3)]).join(' ') + ')');
  }
}
const cell = [2, 3, 5, 8];
const rdFile = EXT_READINGS || join(ST, ID + '-readings.tsv');
const rd = [['ruler_id', 'cell', 'horizon', 'value', 'n']];
const vals = {};
if (EXT_READINGS) {
  const RT = readTable(EXT_READINGS);
  for (const r of RT.rows) {
    const rid = r[RT.ix.ruler_id], c = r[RT.ix.cell], hor = r[RT.ix.horizon], v = r[RT.ix.value];
    const axis = rid === RID_A ? 'a' : rid === RID_B ? 'b' : '';
    if (axis) vals[axis + c + (hor === 'short' ? '' : 'L')] = v;
  }
} else {
  for (const tag of ['a-multi', 'a-long', 'b-multi', 'b-long', 'x-multi', 'x-long']) {
    const f = join(ST, ID + '-' + tag + '.tsv');
    if (!existsSync(f)) continue;
    const t = readTable(f); const row = t.rows[0]; if (!row) continue;
    const [axis, horizon] = tag.split('-');
    for (const c of cell) {
      const x = row[t.ix['x' + c]], n = row[t.ix['n' + c]];
      if (x === undefined || x === '') continue;
      const rid = axis === 'a' ? RID_A : axis === 'b' ? ((horizon === 'multi' && BP_WALLS) ? RID_B_SHORT : RID_B) : RID_X;
      const hor = horizon === 'multi' ? 'short' : 'long';
      rd.push([rid, String(c), hor, x, n]);
      if (axis !== 'x') vals[axis + c + (horizon === 'multi' ? '' : 'L')] = x;
    }
  }
  writeFileSync(rdFile, rd.map((r) => r.join('\t')).join('\n') + '\n', 'utf8');
}
const dispHead = readTable(join(HERE, 'data/display.tsv')).header;
let D;
const setD = (c, v) => { const i = dispHead.indexOf(c); if (i >= 0 && v !== undefined && v !== null) D[i] = String(v); };
if (EXT_DISPLAY) {
  const DT = readTable(EXT_DISPLAY);
  if (DT.header.join('\t') !== dispHead.join('\t')) { console.error('⛔ --display 表头与 data/display.tsv 不一致'); process.exit(2); }
  if (DT.rows.length !== 1) { console.error('⛔ --display 必须恰好 1 行'); process.exit(2); }
  D = DT.rows[0].slice();
} else {
  D = new Array(dispHead.length).fill('');
  setD('id', ID); setD('path', rel); setD('ver', VER); setD('lineage', 'new');
  const ft = readTable(featOut); const fr = ft.rows[0];
  if (!fr) { console.error('⛔ ruler-measure 没产出 ' + ID); process.exit(2); }
  for (const c of ['S', 'Geff', 'rounds', 'dmg', 'heavy', 'holo', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'fieldAAtk', 'rwDmg']) {
    if (ft.ix[c] !== undefined) setD(c, fr[ft.ix[c]]);
  }
  for (const c of cell) {
    if (vals['a' + c] !== undefined) setD('P' + c, vals['a' + c]);
    if (vals['a' + c + 'L'] !== undefined) setD('P' + c + 'L', vals['a' + c + 'L']);
    if (vals['b' + c] !== undefined) setD('P' + c + 'R', vals['b' + c]);
    if (vals['b' + c + 'L'] !== undefined) setD('P' + c + 'RL', vals['b' + c + 'L']);
    if (vals['a' + c] !== undefined && vals['b' + c] !== undefined) setD('C' + c + 'R', (Number(vals['a' + c]) + Number(vals['b' + c])) / 2);
    if (vals['a' + c + 'L'] !== undefined && vals['b' + c + 'L'] !== undefined) setD('C' + c + 'RL', (Number(vals['a' + c + 'L']) + Number(vals['b' + c + 'L'])) / 2);
  }
  setD('examG', fr[ft.ix.examG] || '120');
  const bpJson = join(ST, ID + '-bp.json');
  if (hasFile(bpJson)) {
    const bpObj = JSON.parse(readFileSync(bpJson, 'utf8'));
    for (const [k, v] of Object.entries(bpObj)) setD(k, v);
  }
  /* 新点不写 H5/F/rank：H5 是冻结旧尺，F/rank 是旧尺出厂账；
   *   当前页面名次由 viewer 按 C·R 重算，新点没有“旧尺出厂名次”。旧 926 行保留历史值。 */
  /* feas：新点临时表 + allLong/allMulti 两次；拿 okLong/okShort */
  if (!SKIP_FEAS) {
    for (const [flag, okCol, failCol, out] of [['--allLong=1', 'okLong', 'failsLong', feasLongOut], ['--allMulti=1', 'okShort', 'failsShort', feasShortOut]]) {
      const FT = readTable(out); const rr = FT.rows.find((x) => x[FT.ix.id] === ID);
      if (rr) { setD(okCol, rr[FT.ix.ok]); setD(failCol, rr[FT.ix.fails]); }
    }
  }
}
/* 投影：把新点并入 projcols 副本，跑 proj-tsne；旧点坐标会整体重排，但只写 staging 副本。 */
if (!SKIP_PROJ) {
  const pIn = join(ST, ID + '-proj-input.tsv');
  const pj = readTable(join(HERE, 'data/display.tsv'));
  writeTable(pIn, { header: pj.header, rows: pj.rows.concat([D]) }, { backup: false });
  execFileSync('node', [join(HERE, 'proj-tsne.mjs'), '--in=' + pIn], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const PT = readTable(pIn); const pr = PT.rows.find((x) => x[PT.ix.id] === ID);
  if (pr) {
    for (const c of ['xt', 'yt', 'xt3', 'yt3', 'zt3']) setD(c, pr[PT.ix[c]]);
    setD('x2', pr[PT.ix.xt]); setD('y2', pr[PT.ix.yt]);
    setD('xt20', pr[PT.ix.xt]); setD('yt20', pr[PT.ix.yt]);
  }
}
/* 投影整表回写：proj-tsne 重排了全部坐标；把 927 行一起交给 add-point，避免新旧点混两套投影。 */
let projFile = '';
if (!SKIP_PROJ) {
  const PT = readTable(join(ST, ID + '-proj-input.tsv'));
  const prh = ['pack_id', 'xt', 'yt', 'xt3', 'yt3', 'zt3', 'xt18', 'yt18', 'xt20', 'yt20'];
  const prs = [prh];
  for (const r of PT.rows) {
    const id = r[PT.ix.id];
    if (!id) continue;
    prs.push([id, r[PT.ix.xt], r[PT.ix.yt], r[PT.ix.xt3], r[PT.ix.yt3], r[PT.ix.zt3],
      r[PT.ix.xt18], r[PT.ix.yt18], id === ID ? r[PT.ix.xt] : r[PT.ix.xt20], id === ID ? r[PT.ix.yt] : r[PT.ix.yt20]]);
  }
  projFile = join(ST, ID + '-projections.tsv');
  writeFileSync(projFile, prs.map((x) => x.join('\t')).join('\n') + '\n', 'utf8');
}
const dispFile = (EXT_DISPLAY && SKIP_PROJ) ? EXT_DISPLAY : join(ST, ID + '-display.tsv');
if (!EXT_DISPLAY || !SKIP_PROJ) writeFileSync(dispFile, [dispHead.join('\t'), D.join('\t')].join('\n') + '\n', 'utf8');
console.log('readings ' + (EXT_READINGS ? '外部' : (rd.length - 1)) + ' 条 ‖ display ' + basename(dispFile));
if (NO_ADD) { console.log('--no-add：停在 ' + rdFile); process.exit(0); }
if (AUDIT) {
  /* 自动 12 线：先把裁决写进 data/page/promote.tsv，再进 add-point --bake，保证页面 pv 着色一次带全。 */
  const J = JSON.parse(readFileSync(auditOut, 'utf8'));
  const pt = readTable(join(HERE, 'data/page/promote.tsv'));
  const row = new Array(pt.header.length).fill('');
  row[pt.ix.id] = ID; row[pt.ix.verdict] = J.blocked ? 'block' : 'pass';
  row[pt.ix.blocks] = (J.classes && J.classes.length) ? J.classes.join(',') : '—';
  writeTable(join(HERE, 'data/page/promote.tsv'), { header: pt.header, rows: pt.rows.filter((r) => r[pt.ix.id] !== ID).concat([row]), backup: false });
  console.log('audit: ' + ID + ' ⇒ ' + row[pt.ix.verdict] + ' ' + row[pt.ix.blocks]);
}
const addArgs = [join(HERE, 'pipeline/add-point.mjs'), '--id=' + ID, '--pack=' + PACK, '--ver=' + VER,
  '--readings=' + rdFile, '--display=' + dispFile, '--batch=measure-' + ID];
if (projFile) addArgs.push('--projections=' + projFile);
if (FAM) addArgs.push('--fam=' + FAM);
if (FAMLAB) addArgs.push('--fam-label=' + FAMLAB);
if (PARENT) addArgs.push('--parent=' + PARENT);
if (BAKE) addArgs.push('--bake');
const out = execFileSync('node', addArgs, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
console.log(out.trim().split('\n').slice(-6).join('\n'));
