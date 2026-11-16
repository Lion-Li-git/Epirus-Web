/* ingest-intermediates-1117.mjs —— EQ 链三枚未注册中间代走正式入口（measure-point → add-point）。
 *   EQ-S3-E9（S4 的真实 hotstart 父）‖ BASE-E9-MB5（E9-A1 的真实 hotstart 父）‖ BASE-P9-MB5（S5-P9 同理）。
 *   顺序跑（measure-point 内部已 jobs=10 并行，三台并发会超订 18 核）。
 *   不 --bake：等 promote 家族批 + promote.tsv 回填之后统一 rebuild-map 一次。 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const JOBS = [
  ['EQ-S3-E9', 'scratch/arms/EQ-S3-E9.bak', '25'],
  ['BASE-E9-MB5', 'scratch/arms/BASE-E9-MB5.bak', '25'],
  ['BASE-P9-MB5', 'scratch/arms/BASE-P9-MB5.bak', '25'],
];
const LABEL = '2.0 obs6.5 统一单包（11-16）';
for (const [id, p, fam] of JOBS) {
  console.log('== ingest ' + id + ' ==');
  try {
    const { stdout } = await execFileP('node', ['champion-map/pipeline/measure-point.mjs', '--pack=' + p, '--id=' + id, '--ver=2.0',
      '--fam=' + fam, '--fam-label=' + LABEL, '--reuse'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
    console.log(stdout.trim().split('\n').slice(-6).join('\n'));
  } catch (e) {
    console.error('⛔ ' + id + ' ingest 失败：\n' + String(e.stdout || e.message).slice(-1500));
    process.exitCode = 2;
    break;   // add-point 失败就停，不许半 ingest 连跑下一枚
  }
}
console.log('=== 中间代入图完成 ===');
