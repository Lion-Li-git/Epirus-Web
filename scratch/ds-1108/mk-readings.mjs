
/* 进图读数采集：对每枚包跑 4 次 exam-4n（XS/XL/PS/PL），输出 intake-rows3 认的 [id= tag=] 行 */
import { execFileSync } from 'node:child_process';
const packs = JSON.parse(process.argv[2]);   // [[id, path], ...]
const out = [];
for (const [id, p] of packs) {
  const runs = [
    ['XS', ['tools/exam-4n.mjs', '100', '77000', p, '--dose=exam']],
    ['XL', ['tools/exam-4n.mjs', '100', '77000', p, '--dose=exam', '--mode=long']],
    ['PS', ['tools/exam-4n.mjs', '100', '77000', p, '--dose=page']],
    ['PL', ['tools/exam-4n.mjs', '100', '77000', p, '--dose=page', '--mode=long']],
  ];
  for (const [tag, args] of runs) {
    const r = execFileSync('node', args, { encoding: 'utf8', maxBuffer: 1 << 24 });
    const line = r.split('\n').find(l => l.includes('[冠军4N]'));
    if (!line) { console.error('⛔ ' + id + ' ' + tag + ' 没读到一行'); process.exit(2); }
    out.push('[id=' + id + ' tag=' + tag + '] ' + line.trim());
  }
  console.log('done ' + id);
}
process.stdout.write('\n@@LOG@@\n' + out.join('\n') + '\n');
