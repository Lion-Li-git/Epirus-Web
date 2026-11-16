/* run-mixed-family-1117.mjs —— SHAPEDIST/UNIFIED 家族 15 枚补齐 mixed 考卷（30 局，jobs=6 并行）。
 * 口径与 mixedfix-1116 表同：rounds=6 seed=77000 dose=exam exam=both 5锚 champ。 */
import { readFileSync, appendFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const CHAMP = 'MSB15R-HITMIX,GD6a-TILT,Q-s47,OBS6E9,OBS6P4-S4000';
const EMIT = 'MSB15R-HITMIX+GD6a-TILT+Q-s47+OBS6E9+OBS6P4-S4000x1';
const PACKS = readFileSync('scratch/ske-missing-paths.txt', 'utf8').trim().split('\n').map((p) => [p.split('/').pop().replace(/\.(bak|js)$/, ''), p]);
const get = (l, k) => { const m = l.match(new RegExp('[ hnxpks]' + k + '=([^ %]+)')); return m ? m[1] : ''; };
let idx = 0, done = 0, fail = 0;
async function worker() {
  while (idx < PACKS.length) {
    const [id, rel] = PACKS[idx++];
    for (const mode of ['multi', 'long']) {
      const tbl = 'champion-map/data/exam4n-mixedfix-1116-' + mode + '.tsv';
      if (readFileSync(tbl, 'utf8').split('\n').some((l) => l.startsWith(id + '\t'))) continue;
      try {
        const { stdout } = await run('node', ['tools/exam-4n.mjs', '6', '77000', rel, '--dose=exam', '--mode=' + mode, '--exam=both', '--champ=' + CHAMP, '--champn=1'], { encoding: 'utf8', maxBuffer: 1 << 26 });
        const v2 = stdout.split('\n').filter((l) => l.startsWith('[冠军4N-v2]')).pop();
        if (!v2) throw new Error('无 v2 行');
        const row = [id, get(v2, 'h2'), get(v2, 'h3'), get(v2, 'h5'), get(v2, 'h8'), get(v2, 'x2'), get(v2, 'x3'), get(v2, 'x5'), get(v2, 'x8'),
          get(v2, 'n2'), get(v2, 'n3'), get(v2, 'n5'), get(v2, 'n8'), '77000', '6', mode, 'exam', 'both(v2)',
          (stdout.match(/ pool=([^ ]+)/) || [])[1] || '', EMIT, (stdout.match(/ sec=([^ ]+)/) || [])[1] || '', get(v2, 'skU'), get(v2, 'skE')];
        appendFileSync(tbl, row.join('\t') + '\n');
        done++;
        console.log('✅ ' + id + ' ' + mode + ' skE=' + row[22]);
      } catch (e) { fail++; console.error('⛔ ' + id + '/' + mode + ': ' + String(e.message).slice(0, 100)); }
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log('=== 家族 mixed 补测完成：' + done + ' 局 ‖ 失败 ' + fail + ' ===');
