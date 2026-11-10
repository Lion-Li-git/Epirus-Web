#!/usr/bin/env node
/* project-blocks.mjs — 按 2.0 观测集的块裁剪 dump，用于逐层消融（DS · 2026-10-28 夜）
 * 用法：node tools/proto2/project-blocks.mjs --in=a.jsonl --out=b.jsonl --blocks=L0,S1.res,S1.st,S1.hist,...
 * 块名来自 tools/proto2/obs2.mjs 的 MANIFEST；顺序按 MANIFEST，不许自定。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { MANIFEST } from './obs2.mjs';

const argv = process.argv.slice(2);
function arg(k, d) { const f = argv.find((a) => a.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; }
const IN = arg('in', ''); const OUT = arg('out', '');
const BLOCKS = String(arg('blocks', '')).split(',').filter(Boolean);
if (!IN || !OUT || !BLOCKS.length) { console.error('⛔ --in= --out= --blocks=L0,S1.res,...'); process.exit(2); }
const keep = MANIFEST.filter((m) => BLOCKS.indexOf(m.block) >= 0).map((m) => m.i);
if (!keep.length) { console.error('⛔ 块名不认识：' + BLOCKS.join(',')); process.exit(2); }
const rows = readFileSync(IN, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const out = rows.map((r) => { const x = keep.map((i) => r.x[i]); return { seed: r.seed, arm: r.arm, env: r.env, g: r.g, n: r.n, round: r.round, pk: r.pk, i: r.i, key: r.key, target: r.target, net: r.net, win: r.win, x }; });
writeFileSync(OUT, out.map((o) => JSON.stringify(o)).join('\n'));
console.log('写出 ' + OUT + '：' + out.length + ' 行 ‖ 保留块 ' + BLOCKS.join(',') + ' ⇒ 维 ' + keep.length);
