#!/usr/bin/env node
/* 一次性补丁：搬家（tools/train-*、server/*、tools/proto2 → training/）后的路径接线。
 * 只做字符串替换，不碰行尾（CRLF 原样）。每组替换前先数命中数，输出变更台账。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ls = (d) => execSync(`git ls-files "${d}"`, { encoding: 'utf8' }).split('\n').filter(Boolean);
const edits = [];   // { file, from, to, n }

function patch(file, pairs) {
  let s = readFileSync(file, 'utf8');
  for (const [from, to] of pairs) {
    const n = s.split(from).length - 1;
    if (n > 0) { s = s.split(from).join(to); edits.push({ file, from, to, n }); }
  }
  writeFileSync(file, s);
}

/* Group T：training/train-*.mjs —— tools 库 ../tools/、server ./server/、自指路径 training/ */
for (const f of ls('training/*.mjs')) {
  if (!/train-(3p|best|fast|selftest)\.mjs$/.test(f)) continue;
  let s = readFileSync(f, 'utf8');
  s = s.split("from './").join("from '@@TMP@/");
  s = s.split("from '@@TMP@/proto2/").join("from './proto2/");           // proto2 仍是同层
  s = s.split("from '@@TMP@/").join("from '../tools/");
  s = s.split("from '../server/").join("from './server/");
  s = s.split("'tools/train-3p.mjs'").join("'training/train-3p.mjs'");
  s = s.split("'tools/train-best.mjs'").join("'training/train-best.mjs'");
  s = s.split("'tools/train-fast.mjs'").join("'training/train-fast.mjs'");
  s = s.split("'server/train-server.mjs'").join("'training/server/train-server.mjs'");
  s = s.split("'server/train-worker.mjs'").join("'training/server/train-worker.mjs'");
  s = s.split("'server/paralleltrain.mjs'").join("'training/server/paralleltrain.mjs'");
  writeFileSync(f, s);
  edits.push({ file: f, from: '(group T)', to: '(applied)', n: 1 });
}

/* Group S：training/server/*.mjs —— tools 库 ../../tools/ */
for (const f of ls('training/server/*.mjs')) {
  patch(f, [["from '../tools/", "from '../../tools/"]]);
}

/* Group P：training/proto2/*.mjs —— audit-lib 等上跳两层；旧 self-ref 转同层；server 下跳一层 */
for (const f of ls('training/proto2/*.mjs')) {
  patch(f, [
    ["from '../audit-lib.mjs'", "from '../../tools/audit-lib.mjs'"],
    ["from '../bot-chooser-lib.mjs'", "from '../../tools/bot-chooser-lib.mjs'"],
    ["from '../tools/audit-lib.mjs'", "from '../../tools/audit-lib.mjs'"],
    ["from '../tools/proto2/", "from './"],
    ["from '../tools/v2v4-lib.mjs'", "from '../../tools/v2v4-lib.mjs'"],
    ["from '../../server/", "from '../server/"],
  ]);
}

/* Group K：tools/*.mjs（留守）—— server 上跳一档变 training/server；proto2 指到 training */
for (const f of ls('tools/*.mjs')) {
  patch(f, [
    ["from '../server/", "from '../training/server/"],
    ["from './proto2/", "from '../training/proto2/"],
    ["'server/train-server.mjs'", "'training/server/train-server.mjs'"],
    ["'server/train-worker.mjs'", "'training/server/train-worker.mjs'"],
    ["'server/paralleltrain.mjs'", "'training/server/paralleltrain.mjs'"],
    ["'server/opp-pool.mjs'", "'training/server/opp-pool.mjs'"],
    ["'server/opp-champs.mjs'", "'training/server/opp-champs.mjs'"],
  ]);
}

/* Group G：tools/gates/*.mjs —— 同上，再加 gate 内 spawn/read 的入口路径 */
for (const f of ls('tools/gates/*.mjs')) {
  patch(f, [
    ["from '../../server/", "from '../../training/server/"],
    ["'server/opp-pool.mjs'", "'training/server/opp-pool.mjs'"],
    ["'server/train-server.mjs'", "'training/server/train-server.mjs'"],
    ["'tools/train-3p.mjs'", "'training/train-3p.mjs'"],
    ["'tools/train-best.mjs'", "'training/train-best.mjs'"],
    ["'tools/train-fast.mjs'", "'training/train-fast.mjs'"],
    ["'tools/proto2/", "'training/proto2/"],
    ["'./proto2/", "'../training/proto2/"],
  ]);
}

/* Group X：training/knobs.mjs —— 生成器自身接线 */
patch('training/knobs.mjs', [
  ["from '../server/knob-guard.mjs'", "from './server/knob-guard.mjs'"],
  ["from '../server/econ-env.mjs'", "from './server/econ-env.mjs'"],
  ["from '../server/fight-env.mjs'", "from './server/fight-env.mjs'"],
  ["from '../server/train-env.mjs'", "from './server/train-env.mjs'"],
  ["const DOC = 'docs/TRAINING-KNOBS.md';", "const DOC = 'training/TRAINING-KNOBS.md';"],
  ["{ tool: 'train-3p', file: 'tools/train-3p.mjs' }", "{ tool: 'train-3p', file: 'training/train-3p.mjs' }"],
  ["{ tool: 'train-best', file: 'tools/train-best.mjs' }", "{ tool: 'train-best', file: 'training/train-best.mjs' }"],
  ["{ tool: 'train-fast', file: 'tools/train-fast.mjs' }", "{ tool: 'train-fast', file: 'training/train-fast.mjs' }"],
  ["{ tool: 'train-server', file: 'server/train-server.mjs' }", "{ tool: 'train-server', file: 'training/server/train-server.mjs' }"],
  ["selfFiles: ['server/train-worker.mjs', 'server/paralleltrain.mjs']", "selfFiles: ['training/server/train-worker.mjs', 'training/server/paralleltrain.mjs']"],
  ["repoKnobUniverse(['tools', 'server'])", "repoKnobUniverse(['tools', 'training'])"],
  ["const src3p = readFileSync('tools/train-3p.mjs', 'utf8');", "const src3p = readFileSync('training/train-3p.mjs', 'utf8');"],
]);

/* Group CMD：启动器 */
patch('training/start-train-server.cmd', [["server\\train-server.mjs", "training\\server\\train-server.mjs"], ["server/train-server.mjs", "training/server/train-server.mjs"]]);

/* Group DR：现役驱动器 */
patch('scratch/night-adapt2/msbatch2.mjs', [["['tools/train-3p.mjs'", "['training/train-3p.mjs'"]]);

for (const e of edits) console.log(`${String(e.n).padStart(3)} × ${e.file}  ${e.from.slice(0, 46)} → ${e.to.slice(0, 40)}`);
console.log('共 ' + edits.length + ' 个文件组');
