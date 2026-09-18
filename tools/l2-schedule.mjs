/* 通宵排程器：等当前臂批跑结束 ⇒ 自动跑批次 3 ⇒ 自动跑评测矩阵 ⇒ 落一个 DONE 标记
 * 为什么要有它：会话侧不该写长等待（HANDOFF §5.1-1 的教训：把等待写进 tool call 会把整个会话拖死）。
 * 所以等待关在**本进程**里：每 30 秒看一眼 `l2-batch2.log` 的完成标记，等到了再继续。
 * 用法（后台）：node tools/l2-schedule.mjs
 */
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, existsSync, appendFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(root, 'docs', 'artifacts');
const B2 = join(ART, 'l2-batch2.log'), SCH = join(ART, 'l2-schedule.log');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = m => { const l = `[${new Date().toISOString()}] ${m}`; console.log(l); try { appendFileSync(SCH, l + '\n'); } catch (e) { } };
function run(cmd, args, env, tag) {
  say(`开跑 ${tag}：${cmd} ${args.join(' ')}`);
  const r = spawnSync(process.execPath, [cmd].concat(args), { cwd: root, env: Object.assign({}, process.env, env || {}), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024, timeout: 3 * 3600 * 1000 });
  const out = String(r.stdout || '') + String(r.stderr || '');
  appendFileSync(join(ART, `l2-${tag}.out.log`), out);
  say(`${tag} 结束 status=${r.status}${r.timedout ? '（超时被杀）' : ''}`);
  return r;
}
/* 1) 等批次 2 */
/* 单实例守卫：上一版排程器是被 `&` 起 detached 的、包装层 exit=1 ⇒ 状态未知。
 * 若它还活着，这个新实例会在**第一次心跳前**因为锁而退出，从而避免两个 ring2-run 并发
 * （它们共享 .training-in/out 暂存 ⇒ 并发会把 A 臂的包写进 B 臂的文件名，且不报错）。 */
const LOCK = join(ART, '.l2-schedule.lock');
try {
  if (existsSync(LOCK)) {
    const old = Number(readFileSync(LOCK, 'utf8').trim());
    if (old && old !== process.pid) { try { process.kill(old, 0); say('另一个排程器还活着 (pid ' + old + ') ⇒ 本实例退出'); process.exit(0); } catch (e) { say('旧锁的 pid ' + old + ' 已死，接管'); } }
  }
  writeFileSync(LOCK, String(process.pid));
} catch (e) { /* 锁失败不拦路 */ }
for (let i = 0; i < 360; i++) {
  if (i % 4 === 0) { try { writeFileSync(LOCK, String(process.pid)); } catch (e) { } }
  if (existsSync(B2) && readFileSync(B2, 'utf8').indexOf('BATCH2 COMPLETE') >= 0) break;
  await sleep(30000);
}
say('批次 2 已收尾');
/* 2) 批次 3：治龟壳的那一臂（6 个 seed） */
run('tools/l2-arms.mjs', [], { L2_ARMS: 'o,p', L2_SEEDS: '81,82,91,92,93' }, 'batch34');
/* 3) 评测矩阵：所有 v7l2* 产物 + 线上包，三考卷各 120 局（每场自带随机基线） */
run('tools/l2-eval.mjs', ['120'], {}, 'evalmatrix');
/* 4) 资源线判据（余 ep / 兑现率 / 出手每回合 / 防御预算）跑一遍全部产物 + 线上包 */
const arts = readdirSync(ART).filter(f => /^v7l2[a-z]?-\d+\.bak$/.test(f)).sort().map(f => 'docs/artifacts/' + f);
say('资源线判据要跑 ' + arts.length + ' 个产物');
run('tools/probe-leftover.mjs', ['60', 'js/bundled-champion-3p.js'].concat(arts), {}, 'leftovermatrix');
say('排程全部结束 → NIGHT_DONE');
appendFileSync(B2, 'NIGHT_DONE\n');
