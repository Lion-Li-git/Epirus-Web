#!/usr/bin/env node
/* train.mjs —— 2.0 (obs6) 统一训练 CLI 总入口
 *
 * 用法：
 *   node training/train.mjs --mode=pg [pg-train 旗标…]
 *   node training/train.mjs --mode=supfit [supfit-gd 旗标…]
 *   node training/train.mjs --mode=distill [supfit-gd 旗标…]
 *   node training/train.mjs --mode=fuse --a=<包A> --b=<包B> [--t=0.5] --out=<输出>
 *   node training/train.mjs --mode=selftest   # 或 --selftest / selftest
 *   也可使用位置首参：node training/train.mjs pg --up=...
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
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
    '        selftest -> selftest2 + selftest3 + browser-parity'
  );
}

let mode = '';
const restArgs = [];
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (!mode && a.startsWith('--mode=')) {
    mode = a.slice('--mode='.length).trim();
    continue;
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
