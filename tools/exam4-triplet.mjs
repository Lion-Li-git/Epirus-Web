#!/usr/bin/env node
/* 三件套读数器（PLAN-2026-11-07 A4 · ZCode 深夜）：一支冠军包的四格卷标准读法
 *
 *   X̄₄P(短/长) + Δε(短/长) = P − X + 四格短板（哪格拖后腿）
 * = exam-4n 四连跑：{exam,page} × {multi,long}，R/seed 与全图批同源（默认 100/77000）。
 *
 * 用法: node tools/exam4-triplet.mjs <冠军包> [rounds=100] [seed=77000]
 * 输出一行 JSON（stdout），批量调用方自己拼表。
 */
import { sandbox, loadChamp } from './audit-lib.mjs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACK = process.argv[2];
const ROUNDS = Number(process.argv[3] || 100);
const SEED = Number(process.argv[4] || 77000);
if (!PACK) { console.error('⛔ 用法: node tools/exam4-triplet.mjs <冠军包> [rounds] [seed]'); process.exit(2); }

const W = sandbox(); loadChamp(W, PACK);   /* 先验包能装载（装载失败早死，别等四连跑跑一半） */

const NS = [2, 3, 5, 8], W4 = [0.15, 0.25, 0.45, 0.15];
const run = (dose, mode) => {
  const r = spawnSync(process.execPath, [join(HERE, 'exam-4n.mjs'), String(ROUNDS), String(SEED), PACK, '--dose=' + dose, '--mode=' + mode],
    { encoding: 'utf8', timeout: 600000 });
  const line = (r.stdout || '').split(/\r?\n/).find(l => l.indexOf('[冠军4N]') === 0);
  if (!line) { console.error('⛔ exam-4n 没吐结果（' + dose + '/' + mode + '）：' + ((r.stderr || '').slice(0, 200))); process.exit(3); }
  const get = (k) => { const m = line.match(new RegExp(' ' + k + '=(\\S+)')); return m ? +m[1] : NaN; };
  const out = {};
  for (const n of NS) out['x' + n] = get('x' + n);
  out.mode = mode; out.dose = dose;
  return out;
};

const x4 = (o) => NS.reduce((s, _, i) => s + W4[i] * o['x' + NS[i]], 0);
const P = { S: run('page', 'multi'), L: run('page', 'long') };
const X = { S: run('exam', 'multi'), L: run('exam', 'long') };
const miss = (o) => NS.filter(n => !isFinite(o['x' + n]));
const worst = (o) => NS.slice().sort((a, b) => o['x' + a] - o['x' + b]).slice(0, 2).join('/');
const d = (fam) => { const v = x4(P[fam]) - x4(X[fam]); return (v >= 0 ? '+' : '') + v.toFixed(3); };
console.log(JSON.stringify({
  pack: PACK,
  X4P_S: +x4(P.S).toFixed(4), X4P_L: +x4(P.L).toFixed(4),
  dEps_S: d('S'), dEps_L: d('L'),
  cells_S: NS.map(n => P.S['x' + n]), cells_L: NS.map(n => P.L['x' + n]),
  worst_S: worst(P.S), worst_L: worst(P.L),
  miss: miss(P.S).concat(miss(P.L), miss(X.S), miss(X.L)),
}));
