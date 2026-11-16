/* pool-keys-census-1117.mjs —— 池技能覆盖普查（用户令：重新做池技能覆盖，用新跨环境口径）。
 * 对池全部成员跑 mixed 夹具考卷（rounds=6 seed=77000 5锚 both），收 keys=（用过键清单）→ 层级覆盖表。
 * 层级（D-02/cov-census 口径）：T0 基础（ji/charge/gun/sword/snipe/guard/reflect/bagua/shift/jinshield/armor/proto/holo）
 *   T1（ring/railgun/bigT）‖ T2（transfer/drain）‖ T3（miniT/mine/laserEye/cannon）‖ T4（firestorm/curse）‖ 其他（tank/rod/taunt/purify/dualGun/mirror）。 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

const CHAMP = 'MSB15R-HITMIX,GD6a-TILT,Q-s47,OBS6E9,OBS6P4-S4000';
const EMIT = 'MSB15R-HITMIX+GD6a-TILT+Q-s47+OBS6E9+OBS6P4-S4000x1';
const pool = readFileSync('champion-map/data/page/pool-members.tsv', 'utf8').replace(/\r\n/g, '\n').split('\n').map((l) => l.split('\t'));
const ph = pool[0]; const pix = Object.fromEntries(ph.map((c, i) => [c, i]));
const MEMBERS = pool.slice(1).map((r) => [r[pix.id], r[pix.path]]).filter((x) => x[0]);
const TBL = 'champion-map/data/pool-keys-census-1117.tsv';
if (!existsSync(TBL)) writeFileSync(TBL, ['id', 'tier', 'mode', 'skU', 'skE', 'keys'].join('\t') + '\n', 'utf8');
const done = new Set(readFileSync(TBL, 'utf8').split('\n').slice(1).map((l) => l.split('\t')[0] + '|' + l.split('\t')[2]).filter((x) => x !== '|'));

const get = (line, k) => { const m = line.match(new RegExp('[ hnxpks]' + k + '=([^ ]+)')); return m ? m[1] : ''; };
let idx = 0, fail = 0;
async function worker() {
  while (idx < MEMBERS.length) {
    const [id, rel] = MEMBERS[idx++];
    for (const mode of ['multi', 'long']) {
      if (done.has(id + '|' + mode)) continue;
      try {
        const { stdout } = await run('node', ['tools/exam-4n.mjs', '6', '77000', rel, '--dose=exam', '--mode=' + mode, '--exam=both', '--champ=' + CHAMP, '--champn=1'], { encoding: 'utf8', maxBuffer: 1 << 26 });
        const v2 = stdout.split('\n').filter((l) => l.startsWith('[冠军4N-v2]')).pop();
        if (!v2) throw new Error('无 v2 行');
        appendFileSync(TBL, [id, id.startsWith('MX') ? 'new' : '', mode, get(v2, 'skU'), get(v2, 'skE'), get(v2, 'keys')].join('\t') + '\n');
        console.log('✅ ' + id + ' ' + mode + ' skE=' + get(v2, 'skE'));
      } catch (e) { fail++; console.error('⛔ ' + id + '/' + mode + ': ' + String(e.message).slice(0, 90)); }
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log('=== 池 keys 普查完成（失败 ' + fail + '）===');
