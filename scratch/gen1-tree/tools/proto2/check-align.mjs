#!/usr/bin/env node
/* check-align.mjs — 两份 dump 是否描述同一批对局/同一批决策（DS · 2026-10-28 夜）
 * 判据：按 (seed,env,g,n,round,pk,i) join，win 必须逐位相同、net 必须相同；缺键必须为 0。
 * 为什么要它：v7 与 2.0 的编码要在**同一批局**上比，否则又犯"各量各桌"的错。
 */
import { readFileSync } from 'node:fs';
const argv = process.argv.slice(2);
function arg(k, d) { const f = argv.find((a) => a.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; }
const A = arg('a', ''), B = arg('b', '');
if (!A || !B) { console.error('⛔ --a= --b='); process.exit(2); }
const load = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const key = (r) => [r.seed, r.env, r.g, r.n, r.round, r.pk, r.i].join('|');
const a = load(A), b = load(B);
const mb = new Map(); for (const r of b) mb.set(key(r), r);
let match = 0, winDiff = 0, netDiff = 0, miss = 0;
for (const r of a) { const q = mb.get(key(r)); if (!q) { miss++; continue; } match++; if (Number(r.win) !== Number(q.win)) winDiff++; if (Math.abs(Number(r.net) - Number(q.net)) > 1e-9) netDiff++; }
console.log('A 行 ' + a.length + ' ‖ B 行 ' + b.length + ' ‖ 配对 ' + match + ' ‖ 缺键 ' + miss + ' ‖ win 不同 ' + winDiff + ' ‖ net 不同 ' + netDiff);
const ok = miss === 0 && winDiff === 0 && netDiff === 0;
console.log(ok ? '✅ 同一批对局、同一批决策、同一批标签' : '⛔ 不是同一批（不许横比！）');
process.exit(ok ? 0 : 1);
