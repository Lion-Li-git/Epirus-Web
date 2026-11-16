/* run-mixed-eq5-1117.mjs —— 5 枚 EQ 元老补齐 mixed 夹具考卷（skE/复合C 入 mixedfix 表），jobs=5 并行。
 * 口径与 11-16 全库 mixed 表逐位同：rounds=6 seed=77000 dose=exam exam=both champ=MSB15R+GD6a+Q-s47+OBS6E9+OBS6P4x1。
 * 行 = exam-4n 的 [冠军4N-v2] 复合行（x* = C 轴复合值，h* = 复合胜率%）+ skU/skE。 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const CHAMP = 'MSB15R-HITMIX,GD6a-TILT,Q-s47,OBS6E9,OBS6P4-S4000';   // --champ 输入是逗号分隔；表里写的是 join('+')+'x'+n 的输出格式
const CHAMP_EMIT = 'MSB15R-HITMIX+GD6a-TILT+Q-s47+OBS6E9+OBS6P4-S4000x1';
const PACKS = [
  ['EQ-E9-A1', 'docs/artifacts/obs6-coldstart/EQ-E9-A1.bak'],
  ['EQ-S4-E9', 'docs/artifacts/obs6-coldstart/EQ-S4-E9.bak'],
  ['EQ-SPL-75_S6m1', 'docs/artifacts/obs6-coldstart/EQ-SPL-75_S6m1.bak'],
  ['EQ-G-75S6', 'docs/artifacts/obs6-coldstart/EQ-G-75S6.bak'],
  ['EQ-S5-P9', 'docs/artifacts/obs6-coldstart/EQ-S5-P9.bak'],
];
const HEAD = 'id\th2\th3\th5\th8\tx2\tx3\tx5\tx8\tn2\tn3\tn5\tn8\tseed\trounds\tmode\tdose\texam\tpool\tchamp\tsec\tskU\tskE';

const get = (line, k) => { const m = line.match(new RegExp('[ hnxpks]' + k + '=([^ %]+)')); return m ? m[1] : ''; };

async function runOne([id, rel]) {
  for (const mode of ['multi', 'long']) {
    const tbl = 'champion-map/data/exam4n-mixedfix-1116-' + mode + '.tsv';
    const txt = readFileSync(tbl, 'utf8').replace(/\r\n/g, '\n');
    if (txt.split('\n').some((l) => l.startsWith(id + '\t'))) { console.log('↷ ' + id + ' ' + mode + ' 已有'); continue; }
    try {
      const { stdout } = await execFileP('node', ['tools/exam-4n.mjs', '6', '77000', rel, '--dose=exam', '--mode=' + mode, '--exam=both', '--champ=' + CHAMP, '--champn=1'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
      const v2 = stdout.split('\n').filter((l) => l.startsWith('[冠军4N-v2]')).pop();
      if (!v2) { console.error('⛔ ' + id + '/' + mode + ' 无 v2 行'); process.exitCode = 2; continue; }
      const pool = (stdout.match(/ pool=([^ ]+)/) || [])[1] || '';
      const sec = (stdout.match(/ sec=([^ ]+)/) || [])[1] || '';
      const row = [id, get(v2, 'h2'), get(v2, 'h3'), get(v2, 'h5'), get(v2, 'h8'), get(v2, 'x2'), get(v2, 'x3'), get(v2, 'x5'), get(v2, 'x8'),
        get(v2, 'n2'), get(v2, 'n3'), get(v2, 'n5'), get(v2, 'n8'), '77000', '6', mode, 'exam', 'both(v2)', pool, CHAMP_EMIT, sec, get(v2, 'skU'), get(v2, 'skE')];
      if (row.some((c) => c === '')) { console.error('⛔ ' + id + '/' + mode + ' 行有空列: ' + JSON.stringify(row)); process.exitCode = 2; continue; }
      appendFileSync(tbl, row.join('\t') + '\n', 'utf8');
      console.log('✅ ' + id + ' ' + mode + '  C=' + ((+row[5] + +row[6] + +row[7] + +row[8]) / 4).toFixed(4) + '  skU=' + row[21] + ' skE=' + row[22]);
    } catch (e) { console.error('⛔ ' + id + '/' + mode + ' 跑挂：' + String(e.message || e).slice(0, 200)); process.exitCode = 2; }
  }
}
await Promise.all(PACKS.map(runOne));
console.log('=== EQ5 mixed 补测完成 ===');
