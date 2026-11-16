/* ingest-mx-winners-1117.mjs —— 批3 收口：9 枚过线 winner 走 measure-point→add-point 正式入口入图。
 *   预注册验收（全门 ∧ mixed skE≥4）实测 9/16 过；7 枚 block 臂留 scratch 记负结果不丢。
 *   winner 产物同笔落 docs/artifacts/obs6-coldstart/（tracked 真值，仓例同 EQ/US 家族）+ registry path/sha 对齐。 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
const execFileP = promisify(execFile);

const WINNERS = [
  'MX1-E9-GD', 'MX1-E9-EQ', 'MX1-GD-EQ', 'MX1-GD-ST', 'MX1-GD-GD', 'MX1-GD-BA',
  'MX2-US1-ST', 'MX2-US1-BA', 'MX2-U4-EQ',
];
for (const id of WINNERS) {
  const src = 'scratch/arms/' + id + '.bak';
  if (!existsSync(src)) { console.error('⛔ ' + id + ' 产物不在'); process.exitCode = 2; continue; }
  console.log('== ingest ' + id + ' ==');
  try {
    const { stdout } = await execFileP('node', ['champion-map/pipeline/measure-point.mjs', '--pack=' + src, '--id=' + id, '--ver=2.0', '--reuse'], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 26 });
    console.log(stdout.trim().split('\n').slice(-2).join('\n'));
  } catch (e) {
    console.error('⛔ ' + id + ' ingest 失败：\n' + String(e.stdout || e.message).slice(-1200));
    process.exitCode = 2; break;
  }
  /* winner 产物落 docs + registry 对齐 */
  const dst = 'docs/artifacts/obs6-coldstart/' + id + '.bak';
  copyFileSync(src, dst);
  const P = 'champion-map/data/registry.tsv';
  const L = readFileSync(P, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));
  const h = L[0]; const iId = h.indexOf('pack_id'), iP = h.indexOf('path'), iS = h.indexOf('sha256');
  for (let i = 1; i < L.length; i++) if (L[i][iId] === id && L[i][iP].startsWith('scratch/')) {
    L[i][iP] = dst; L[i][iS] = createHash('sha256').update(readFileSync(dst)).digest('hex');
    writeFileSync(P, L.map((r) => r.join('\t')).join('\n') + '\n');
    console.log('  registry ' + id + ' → ' + dst);
  }
}
console.log('=== winner 入图完成 ===');
