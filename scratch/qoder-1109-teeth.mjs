/* 验牙：把修好的前缀剥离退回旧写法，新加的"整批 0 事件就拒绝"自检必须 exit 2。
 * 只在副本上做，不动原件；副本会在写盘之前退出 ⇒ 不会污染 real-summary.json。 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const src = readFileSync('scratch/real-games/analyze.mjs', 'utf8');
const lines = src.split('\n');
const i = lines.findIndex(l => l.includes('const s = l.trim()'));
if (i < 0) { console.error('⛔ 锚点没找到 ⇒ 这次验牙没跑成（不是绿）'); process.exit(2); }
lines[i] = '      const s = l.trim();';
const copy = 'scratch/qoder-1109-analyze-nofix.mjs';
writeFileSync(copy, lines.join('\n'));
const r = spawnSync(process.execPath, [copy], { encoding: 'utf8' });
unlinkSync(copy);
console.log('变异体（退回旧前缀写法）exit=' + r.status);
console.log('stderr 首行: ' + String(r.stderr || '').split('\n')[0]);
console.log('stdout 是否含自检行: ' + /事件解析自检/.test(String(r.stdout || '')));
if (r.status === 2 && /恒不匹配/.test(String(r.stderr || ''))) console.log('✅ 有牙：旧写法被响亮拒绝，不会再报出"被穿透 0/被打后守 0%"');
else { console.error('⛔ 无牙：变异体没有被拒绝 ⇒ 自检是装饰'); process.exit(1); }