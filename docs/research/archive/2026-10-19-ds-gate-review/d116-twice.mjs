/* §E653 决定性实验：D116「行为二」那条迷你臂**自己不可重入**吗？（用它自己的 env，在隔离 worktree 里连跑两遍）
 *   背景：ship-promote.mjs:421-422 那条臂设了 EPIRUS_BAND_DIR 与 EPIRUS_ARM，**没设 EPIRUS_T3P_OUT**
 *     ⇒ 它每跑一次就覆盖一次 `docs/artifacts/train-3p-out.js`（= D162 逐字比对的门禁基线）。
 *   要判的事：单跑 D116 也红（exit=9）到底是"我改了 train-3p 的点名行"造成的，还是"第二次跑被 §E589 守卫拦下"造成的。
 *   做法：两份码各跑两遍（第一次 ⇒ 第二次），比较 exit 与 `[train-3p] 落盘：` 那行。
 *     ⇒ 若两份码都是"第一次 0 / 第二次 9"，病在**没改道 + 不可重入**，与点名行无关。
 * 用法：node d116-twice.mjs --wt=<隔离 worktree> */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { rejectUnknownFlags } = await import(new URL('../../../../tools/audit-lib.mjs', import.meta.url).href);
rejectUnknownFlags(process.argv.slice(2), ['wt'], 'd116-twice');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const WT = arg('wt', '');
if (!WT || !existsSync(path.join(WT, 'tools', 'train-3p.mjs'))) { console.error('⛔ --wt= 要指到隔离工作树'); process.exit(2); }

const NEW = readFileSync(path.join(WT, 'tools', 'train-3p.mjs'), 'utf8');           // 我改过的那份（工作树里已是新版）
const OLD = spawnSync('git', ['show', 'HEAD:tools/train-3p.mjs'], { cwd: WT, encoding: 'utf8' }).stdout;
if (!OLD) { console.error('⛔ 取不到 HEAD 那份'); process.exit(2); }
const OUT = 'docs/artifacts/train-3p-out.js';   // 默认落点（这条腿就是写的这里）

function run(scriptRel, tag) {
  const env = Object.assign({}, process.env, { EPIRUS_XN2W: '1', EPIRUS_XN2G: '2', EPIRUS_BAND_DIR: path.join(WT, '.xn2band-' + tag), EPIRUS_ARM: 'nptest-arm', EPIRUS_LOG_DEFAULT_OUT: '1' });
  const r = spawnSync(process.execPath, [scriptRel, '1', '3', '2', '2'], { cwd: WT, env: encodingEnv({ encoding: 'utf8', timeout: 300000 }) });
  const so = String(r.stdout || '') + String(r.stderr || '');
  const note = (so.match(/\[train-3p\] 落盘：[^\n]*/) || ['(没有落盘行)'])[0];
  const wd = (so.match(/\[WRITE-DEFAULT\][^\n]*/) || ['(没打 WRITE-DEFAULT)'])[0];
  console.log('  ' + tag.padEnd(22) + 'exit=' + r.status + ' ‖ 落盘：' + note.replace('[train-3p] 落盘：', '').slice(0, 74));
  console.log('  ' + ''.padEnd(22) + wd.slice(0, 110));
  return { status: r.status, wrote: /已写入/.test(so) };
}
function encodingEnv(o) { o.encoding = 'utf8'; return o; }

mkdirSync(path.join(WT, '.x'), { recursive: true });
try { rmSync(path.join(WT, OUT), { force: true }); } catch (e) { }        // 从"没有基线"开始，第一遍才是干净的
const v114 = path.join(WT, 'tools', 'train-3p-v114.mjs');
writeFileSync(v114, OLD, 'utf8');
console.log('〔v1.7.114（DS 那版，点名行在加载时）〕');
const a1 = run('tools/train-3p-v114.mjs', '旧版·第 1 遍');
const a2 = run('tools/train-3p-v114.mjs', '旧版·第 2 遍');
try { rmSync(path.join(WT, OUT), { force: true }); } catch (e) { }
console.log('\n〔v1.7.115（我改后，点名行在真落盘之后）〕');
const b1 = run('tools/train-3p.mjs', '新版·第 1 遍');
const b2 = run('tools/train-3p.mjs', '新版·第 2 遍');

console.log('\n判读：');
const same = (a1.status === b1.status) && (a2.status === b2.status);
console.log('  两版第一遍 exit ' + a1.status + '/' + b1.status + ' ‖ 第二遍 exit ' + a2.status + '/' + b2.status
  + ' ⇒ ' + (same ? '**红不来自我改的点名行**（同一处形状：旧版也这样）' : '⚠ 两版不同 ⇒ 得查我这一改'));
console.log('  ' + (a2.status !== a1.status ? '第二遍与前一遍不同 ⇒ 这条腿**不可重入**（第二次被 §E589 守卫拦下）' : '第二遍与前一遍相同 ⇒ 不可重入这条判断不成立，要看落盘行原文'));
console.log('⚑ 主语：这台不修门（tools/gates/** 归 DS），它只把"D116 行为二没改道 ⇒ 既是基线写方、又不可重入"这条钉成可复跑的实验。');
