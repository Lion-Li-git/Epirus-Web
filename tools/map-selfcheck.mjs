import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const modes = ['tree', '1d', '3db', 'map'];
const lines = [];
let bad = 0;
for (const mode of modes) {
  const r = spawnSync(process.execPath, ['champion-map/shot.mjs', '--hash=mode=' + mode + '&check=1', '--dump'], {
    cwd: ROOT, encoding: 'utf8', timeout: 180000,
  });
  const text = String(r.stdout || '') + String(r.stderr || '');
  const assertLine = text.replace(/\r/g, '').split('\n').filter((line) => line.startsWith('断言：')).pop() || '（没有断言总结）';
  const ok = r.status === 0 && /^断言：\d+ PASS ‖ 0 FAIL/.test(assertLine);
  lines.push('视图 mode=' + mode + ' ‖ ' + assertLine + ' ‖ exit=' + r.status + (ok ? ' ✔' : ' ✘'));
  if (!ok) {
    bad++;
    lines.push('--- mode=' + mode + ' 日志尾 25 行 ---');
    lines.push(...text.replace(/\r/g, '').split('\n').slice(-25));
  }
}
console.log(lines.join('\n'));
console.log(bad ? 'MAP SELFCHECK FAIL · ' + bad + '/' + modes.length : 'MAP SELFCHECK OK · 四视图 0 FAIL');
process.exit(bad ? 1 : 0);
