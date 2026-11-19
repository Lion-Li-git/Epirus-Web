#!/usr/bin/env node
/* train.mjs —— 2.0 (obs6) 统一训练 CLI 总入口
 *
 * 用法：
 *   node training/train.mjs --mode=pg [pg-train 旗标…]
 *   node training/train.mjs --mode=supfit [supfit-gd 旗标…]
 *   node training/train.mjs --mode=distill [supfit-gd 旗标…]
 *   node training/train.mjs --mode=fuse --a=<包A> --b=<包B> [--t=0.5] --out=<输出>
 *   node training/train.mjs --mode=v7 [位置参数/EPIRUS_* 透传]                       # 主仓恢复版（新训练用）
 *   node training/train.mjs --mode=v7 --era=<commit> [透传…]                        # era 整树委托（历史包逐位复刻专用）
 *   node training/train.mjs --mode=selftest   # 或 --selftest / selftest
 *   也可使用位置首参：node training/train.mjs pg --up=...
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const rawArgs = process.argv.slice(2);
const MODES = {
  pg: ['training/proto2/pg-train.mjs'],
  supfit: ['training/proto2/supfit-gd.mjs'],
  distill: ['training/proto2/supfit-gd.mjs'],
  fuse: ['tools/pack-fuse.mjs'],
  v7: ['training/train-3p.mjs'],
  selftest: [
    'training/proto2/selftest2.mjs',
    'training/proto2/selftest3.mjs',
    'training/proto2/browser-parity.mjs',
  ],
};

function usage() {
  console.error(
    '用法：node training/train.mjs --mode=<pg|supfit|distill|fuse|v7|selftest> [其余透传旗标]\n' +
    '  快捷：node training/train.mjs --selftest\n' +
    '  说明：pg -> training/proto2/pg-train.mjs\n' +
    '        supfit|distill -> training/proto2/supfit-gd.mjs\n' +
    '        fuse -> tools/pack-fuse.mjs\n' +
    '        v7   -> training/train-3p.mjs（旧 v7 演化线；位置参数/EPIRUS_* 透传）\n' +
    '               --era=<commit> ⇒ 在该 commit 的整树 worktree 里跑 era 的 train-3p（历史包逐位复刻专用；\n' +
    '                 v7 沙箱消费整树 js/*，主仓恢复版对不齐 era 权重流——方法论 §151，11-20 实测）\n' +
    '        selftest -> selftest2 + selftest3 + browser-parity'
  );
}

let mode = '';
let era = '';
const restArgs = [];
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (!mode && a.startsWith('--mode=')) {
    mode = a.slice('--mode='.length).trim();
    continue;
  }
  if (a.startsWith('--era=')) {
    era = a.slice('--era='.length).trim();
    continue;   /* era 只给 v7 委托用，不透传给 era 脚本（era 脚本不认识它） */
  }
  if (!mode && a === '--selftest') {
    mode = 'selftest';
    continue;
  }
  if (!mode && i === 0 && !a.startsWith('-')) {
    mode = a.trim();
    continue;
  }
  restArgs.push(a);
}

const targets = MODES[mode];
if (!targets) {
  console.error('⛔ [train] 需要合法的 --mode=<pg|supfit|distill|fuse|selftest>（收到 ' + JSON.stringify(mode) + '）');
  usage();
  process.exit(64);
}

if (mode === 'selftest') {
  const packArgObj = restArgs.find((a) => a.startsWith('--pack=') || a.startsWith('--up=') || a.startsWith('--upstream='));
  const posPack = restArgs.find((a) => !a.startsWith('-'));
  const stPack = packArgObj ? packArgObj.slice(packArgObj.indexOf('=') + 1)
    : (posPack || 'docs/artifacts/obs6-coldstart/EQ-S4-E9.bak');
  const seq = [
    ['training/proto2/selftest2.mjs', []],
    ['training/proto2/selftest3.mjs', [stPack]],
    ['training/proto2/browser-parity.mjs', ['--pack=' + stPack]],
  ];
  for (const [relScript, sArgs] of seq) {
    const fullScript = resolve(ROOT, relScript);
    const res = spawnSync(process.execPath, [fullScript, ...sArgs], { cwd: ROOT, stdio: 'inherit' });
    if (res.error) { console.error('⛔ [train] 启动 ' + relScript + ' 失败：' + res.error.message); process.exit(1); }
    if (res.status !== 0) process.exit(res.status == null ? 1 : res.status);
  }
  process.exit(0);
}

/* ===== v7-era 委托（11-20 深夜 · 方法论 §151）=====
 * 为什么要有：v7 训练的沙箱消费**整树 js/***（rules/state/resolve/play/bots/policy/evo），
 *   era 包的权重流绑在**当时的整树**上 —— 主仓只恢复 train-3p.mjs/server 三件对不齐
 *   （11-20 实测：主仓跑 Q-s47 得 band4 d24ac807 ≠ 在册 596b8fad；同命令在 15c568b2 整树一发命中）。
 * 做法：--era=<commit> ⇒ 在 <主仓父目录>/wt-v7-<commit8> 建立 detach worktree（幂等复用），
 *   era 脚本路径按 commit 时代自适应（11-11 前 = tools/train-3p.mjs，后 = training/train-3p.mjs），
 *   EPIRUS_SEEDPACK 相对路径的母本自动拷进 worktree（缺了会跑不起来），T3P_OUT/BAND_DIR 相对路径
 *   改成**主仓绝对路径**（产物落在调用者指的地方，不埋在 worktree 里），其余 env/args 原样透传。
 * 红线：这只**编排**，不另起管线——跑的就是 era 树自己的 train-3p.mjs 原件。 */
if (mode === 'v7' && era) {
  const c8 = era.replace(/[^0-9a-f]/gi, '').slice(0, 8);
  if (!c8) { console.error('⛔ [train] --era 需要 commit 哈希（收到 ' + JSON.stringify(era) + '）'); process.exit(64); }
  /* 复用同 commit 的现存 worktree（git worktree list 按 commit 匹配），否则新建一个 */
  let wt = '';
  const lst = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (lst.status === 0) {
    const blocks = String(lst.stdout).split('\n\n');
    for (const b of blocks) {
      const lines = b.split('\n');
      const p = (lines.find((l) => l.startsWith('worktree ')) || '').slice('worktree '.length);
      const c = (lines.find((l) => l.startsWith('commit ')) || '').slice('commit '.length);
      if (p && c && c.startsWith(c8) && p.includes('wt-v7-')) { wt = p; break; }
    }
  }
  if (!wt) wt = resolve(dirname(ROOT), 'wt-v7-' + c8);
  if (!existsSync(wt)) {
    const add = spawnSync('git', ['worktree', 'add', '--detach', wt, era], { cwd: ROOT, encoding: 'utf8' });
    if (add.status !== 0) {
      console.error('⛔ [train] worktree 建立失败（' + era + ' ⇒ ' + wt + '）：\n' + (add.stderr || add.stdout || ''));
      process.exit(1);
    }
    console.log('[train] era worktree 就位：' + wt + ' @ ' + era);
  } else {
    console.log('[train] era worktree 复用：' + wt + ' @ ' + era);
  }
  /* era 脚本路径自适应（并发批的建树竞态防线：另一路正在 add 时目录已存在但检出未完 ⇒ 等它检出完再复用） */
  const eraScriptCands = ['tools/train-3p.mjs', 'training/train-3p.mjs'];
  let eraScript = '';
  for (let i = 0; i < 30; i++) {
    eraScript = eraScriptCands.find((p) => existsSync(resolve(wt, p)));
    if (eraScript) break;
    if (!existsSync(wt)) break;   /* 真没有这棵树 ⇒ 走下面的报错，不等 */
    spawnSync('cmd', ['/c', 'timeout', '/t', '2', '/nobreak'], { stdio: 'ignore' });
  }
  if (!eraScript) {
    console.error('⛔ [train] era 树里找不到 train-3p.mjs（试过 ' + eraScriptCands.join(' / ') + '）⇒ 该 commit 可能早于 v7 线，或 worktree 检出未完成');
    process.exit(2);
  }
  /* 母本同步：EPIRUS_SEEDPACK 相对路径 ⇒ 主仓有、worktree 没有 ⇒ 拷进去（保持同相对路径，recipe.env 才忠实） */
  const sp = process.env.EPIRUS_SEEDPACK;
  if (sp && !isAbsolute(sp)) {
    const inMain = resolve(ROOT, sp), inWt = resolve(wt, sp);
    if (existsSync(inMain) && !existsSync(inWt)) {
      mkdirSync(dirname(inWt), { recursive: true });
      copyFileSync(inMain, inWt);
      console.log('[train] 母本已同步进 era 树：' + sp);
    }
    if (!existsSync(inWt)) {
      console.error('⛔ [train] EPIRUS_SEEDPACK 在主仓与 era 树都不存在：' + sp);
      process.exit(2);
    }
  }
  /* 产物/带目录：相对路径 ⇒ 主仓绝对路径（落在调用者指的地方） */
  const env = { ...process.env };
  for (const k of ['EPIRUS_T3P_OUT', 'EPIRUS_BAND_DIR']) {
    if (env[k] && !isAbsolute(env[k])) env[k] = resolve(ROOT, env[k]);
  }
  console.log('[train] era 委托：node ' + eraScript + ' ' + restArgs.join(' ') + '（cwd=' + wt + '）');
  const res = spawnSync(process.execPath, [resolve(wt, eraScript), ...restArgs], {
    cwd: wt,
    env,
    stdio: 'inherit',
  });
  if (res.error) { console.error('⛔ [train] era 脚本启动失败：' + res.error.message); process.exit(1); }
  process.exit(res.status == null ? 1 : res.status);
}

for (const relScript of targets) {
  const fullScript = resolve(ROOT, relScript);
  const res = spawnSync(process.execPath, [fullScript, ...restArgs], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (res.error) {
    console.error('⛔ [train] 启动 ' + relScript + ' 失败：' + res.error.message);
    process.exit(1);
  }
  if (res.status !== 0) {
    process.exit(res.status == null ? 1 : res.status);
  }
}
