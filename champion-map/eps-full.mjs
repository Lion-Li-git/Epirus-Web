#!/usr/bin/env node
/* §E314 全量线上口径：把 coords.tsv 里 718 枚**每一枚**都在两个口径下重测一遍
 *
 * 为什么两个口径都要重测，而不是只测页面口径、旧 H 直接沿用（这是 §E312 那条教训的直接应用）：
 *   coords.tsv 的 H 是**各臂当年各自评测时**落下的，而中间这一个月里 `js/train/evo.js` 的
 *   BIGT_PUSH（p=8→12）、DRAIN_PUSH（默认开）、ε 分支、费用表都动过 ⇒ 旧 H 与新测的页面 H
 *   **可能不是同一台仪器量的**。Δε 若拿"旧 H − 新页面 H"算，就会把代码漂移混进口径差里。
 *   ⇒ 同批、同 seed、两口径成对测，才配叫 Δε；顺带把"旧 H 还复现不复现"这件事本身量出来。
 *
 * 判据（跑前写死）：
 *   (i)  复现守卫：|本次考卷 H − coords.tsv 的 H| 的分布。p50 应 ≈ 0（同 seed 同工具 ⇒ 本应逐字相同）；
 *        若 p50 > 1pt ⇒ **旧 H 已漂移**，图上所有引用旧 H 的历史读数都要挂脚注。
 *   (ii) 覆盖：718 枚里测成的枚数要 ≥ 700，否则不许换尺（缺太多 = 新尺只覆盖一片，图上会出现两种口径混画）。
 *   (iii)换尺前后**名次相关性**：Spearman(F_旧, F_新)。这是"换口径改不改结论"的全库版（§E313 只有 121 枚）。
 *
 * 用法：node champion-map/eps-full.mjs [--seed=77000] [--jobs=4]
 *   产物：champion-map/epsfull.tsv（增量写，中途可读）= id / exam / page / d / hp_old / ms
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync, copyFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const SEED = Number(arg('seed', 77000)), JOBS = Math.max(1, Number(arg('jobs', 4)));
const OUT = join(HERE, 'epsfull.tsv');

const CO = readFileSync(join(HERE, 'coords.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
const ch = Object.fromEntries(CO[0].map((h, i) => [h, i]));
const ids = CO.slice(1).map((r) => r[ch.id]).filter(Boolean);
const HOLD = {}; for (const r of CO.slice(1)) HOLD[r[ch.id]] = +r[ch.H];

/* 线上那颗盘上没有 .bak（§E308 ③ 那条仪器事实）⇒ 现造临时对照品，跑完由调用方删 */
const SHIP = join(ROOT, 'docs/artifacts/SHIPPED-Ldemo.bak');
if (!existsSync(SHIP)) {
  copyFileSync(join(ROOT, 'js/bundled-champion-3p.js'), SHIP);
  console.error('已临时造出对照品 docs/artifacts/SHIPPED-Ldemo.bak（跑完请删，留着会撞 D82）');
}
if (existsSync(OUT)) { const done = readFileSync(OUT, 'utf8').trim().split('\n').length - 1;
  console.error('⛔ ' + 'epsfull.tsv 已存在（' + done + ' 行）⇒ 先删再跑，别把两批混成一张表'); process.exit(2); }
writeFileSync(OUT, ['id', 'exam', 'page', 'd', 'hp_old', 'sec'].join('\t') + '\n', 'utf8');

function one(id, on) {
  const a = ['tools/eval-5p.mjs', '30', '5', String(SEED), 'docs/artifacts/' + id + '.bak'];
  if (on) a.push('--eps=0.2', '--eps-mode=soft');
  return new Promise((res) => {
    const t0 = Date.now();
    execFile(process.execPath, a, { cwd: ROOT, maxBuffer: 1 << 28, timeout: 300000 },
      (e, so) => res(e ? { err: String(e.message || e).slice(0, 90) } : { v: Number((String(so).match(/\[冠军\] 1st=([\d.]+)%/) || [0, 'NaN'])[1]), sec: ((Date.now() - t0) / 1000).toFixed(1) }));
  });
}
let qi = 0, done = 0, fail = 0;
async function worker() {
  while (qi < ids.length) {
    const id = ids[qi++];
    const ex = await one(id, false), pg = await one(id, true);
    done++;
    if (!isFinite(ex.v) || !isFinite(pg.v)) { fail++; console.error('  ⛔ ' + id + ' ' + (ex.err || '') + ' ' + (pg.err || '')); continue; }
    appendFileSync(OUT, [id, ex.v.toFixed(2), pg.v.toFixed(2), (ex.v - pg.v).toFixed(2), (HOLD[id] || 0).toFixed(2), pg.sec].join('\t') + '\n', 'utf8');
    if (done % 50 === 0) console.error('  … ' + done + '/' + ids.length + ' 枚（失败 ' + fail + '）');
  }
}
(async function () {
  const t0 = Date.now();
  await Promise.all(Array.from({ length: JOBS }, worker));
  console.error('完成 ' + done + ' 枚 / 失败 ' + fail + ' ‖ 用时 ' + ((Date.now() - t0) / 60000).toFixed(1) + ' 分钟（jobs=' + JOBS + '）');
  console.error('判据 (ii) 覆盖：' + (done - fail) + '/' + ids.length + (done - fail >= 700 ? ' ⇒ 够换尺' : ' ⇒ **不够换尺，别动图上的头号尺**'));
})();
