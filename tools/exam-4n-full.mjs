#!/usr/bin/env node
/* 四格考卷批量编排（v2.0.4 · 2026-11-07）—— 仿 eps-full 的 worker/增量表/防混批守卫
 *
 * 名单 = coords.tsv 面板（path 列在册路径）+ `--extra=` 清单（arm/productRel，2.0 非面板行）
 * 每枚派一个 `tools/exam-4n.mjs` 子进程，解析 `[冠军4N]` 行，增量写 `--out=` 表。
 *
 * 用法: node tools/exam-4n-full.mjs --out=exam4-all-1107.tsv [--extra=extra-all-1107.tsv]
 *       [--only=<清单>] [--jobs=8] [--rounds=12] [--seed=77000] [--mode=multi] [--dose=exam|page]
 *       `--dose=page` 透传给子进程（页面剂量，DIFF_TIERS 的 lv:regular）；dose 进表头 ⇒ 两批不可能混成一张表。
 * 产物: id / h2 / h3 / h5 / h8 / x2 / x3 / x5 / x8 / n2 / n3 / n5 / n8 / seed / rounds / mode / sec
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rejectUnknownFlags } from './audit-lib.mjs';
import { EXAM_POOL_VERSIONS } from '../server/opp-pool.mjs';   // 考卷池版本名单的单一来源（不在这儿抄第二份）

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
rejectUnknownFlags(process.argv.slice(2), ['out', 'extra', 'only', 'jobs', 'rounds', 'seed', 'mode', 'dose', 'eps-tier', 'exam', 'champ', 'champn', 'expool'], 'exam-4n-full');

const OUT = join(ROOT, 'champion-map', arg('out', ''));
if (!arg('out', '')) { console.error('⛔ 必须 --out=<表>（四格卷读数落盘处）'); process.exit(2); }
const ROUNDS = Number(arg('rounds', 6));
if (!(Number.isInteger(ROUNDS) && ROUNDS >= 1)) { console.error('⛔ --rounds 必须是正整数'); process.exit(2); }
const SEED = Number(arg('seed', 77000));
const JOBS = Math.max(1, Number(arg('jobs', 8)));
const MODE = arg('mode', '');
const DOSE = arg('dose', 'exam');
if (DOSE !== 'exam' && DOSE !== 'page') { console.error('⛔ --dose 只认 exam/page，收到 ' + DOSE); process.exit(2); }
/* 考卷池版本（11-09 晚补）：默认 v2 ⇒ 既有批跑逐字不变；`v1` 复算 `469dfdb1` 换席前那张卷。
 *   戳由子进程印在 `[冠军4N]` 行里，父进程原样记进表 ⇒ 两版的读数混不进同一张表。 */
const EXPOOL = arg('expool', 'v2');
if (EXAM_POOL_VERSIONS.indexOf(EXPOOL) < 0) { console.error('⛔ --expool 只认 ' + EXAM_POOL_VERSIONS.join('/') + '，收到 ' + EXPOOL); process.exit(2); }
const EPS_TIER = arg('eps-tier', '');
const ONLY_FILE = arg('only', '');
const EXTRA = arg('extra', '');

/* 名单：coords.tsv 面板 + extra（与 eps-full 同一条路径解析链：extra 映射 → 在册 path → .bak 兜底） */
const CO = readFileSync(join(ROOT, 'champion-map/coords.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
const ch = Object.fromEntries(CO[0].map((c, i) => [c, i]));
const CO_PATH = {};
const ids = [];
for (const r of CO.slice(1)) { if (!r[ch.id]) continue; ids.push(r[ch.id]); if (r[ch.path]) CO_PATH[r[ch.id]] = r[ch.path]; }
const PATHOF = {};
if (EXTRA) {
  const ep = join(ROOT, 'champion-map', EXTRA);
  if (!existsSync(ep)) { console.error('⛔ --extra= 指向的文件不存在：' + ep); process.exit(2); }
  const EL = readFileSync(ep, 'utf8').trim().split(/\r?\n/);
  const eh = EL[0].split('\t');
  const iArm = eh.indexOf('arm'), iRel = eh.indexOf('productRel');
  if (iArm < 0 || iRel < 0) { console.error('⛔ --extra 表头必须有 arm/productRel 两列'); process.exit(2); }
  for (const l of EL.slice(1)) { const c = l.split('\t'); if (!c[iArm] || !c[iRel]) continue; PATHOF[c[iArm]] = c[iRel]; if (!CO_PATH[c[iArm]]) ids.push(c[iArm]); }
}
if (ONLY_FILE) {
  const ONLY = new Set(readFileSync(join(ROOT, 'champion-map', ONLY_FILE), 'utf8').replace(/\r\n/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean));
  const before = ids.length;
  for (let i = ids.length - 1; i >= 0; i--) if (!ONLY.has(ids[i])) ids.splice(i, 1);
  console.error('--only ⇒ 名单 ' + before + ' → ' + ids.length + ' 枚');
  if (!ids.length) { console.error('⛔ --only 把名单砍空了'); process.exit(2); }
}
if (existsSync(OUT)) { console.error('⛔ ' + OUT + ' 已存在 ⇒ 先删再跑，别把两批混成一张表'); process.exit(2); }

const HDR = ['id', 'h2', 'h3', 'h5', 'h8', 'x2', 'x3', 'x5', 'x8', 'n2', 'n3', 'n5', 'n8', 'seed', 'rounds', 'mode', 'dose', 'pool', 'sec'];
writeFileSync(OUT, HDR.join('\t') + '\n', 'utf8');

function one(id) {
  const cand = [PATHOF[id], CO_PATH[id], ('docs/artifacts/' + id + '.bak')].filter(Boolean);
  let rel = cand[cand.length - 1];
  for (const c of cand) { if (existsSync(join(ROOT, c))) { rel = c; break; } }
  const a = ['tools/exam-4n.mjs', String(ROUNDS), String(SEED), rel];
  if (MODE) a.push('--mode=' + MODE);
  if (DOSE !== 'exam') a.push('--dose=' + DOSE);
  if (EXPOOL !== 'v2') a.push('--expool=' + EXPOOL);
/* 11-09：考卷 v2 两轴的透传（A=脚本桌 / B=冠军桌 / both）；不传 ⇒ v1 逐位不变 */
const EXAM_AX = arg('exam', '');
if (EXAM_AX) a.push('--exam=' + EXAM_AX);
const CHAMP_L = arg('champ', '');
if (CHAMP_L) a.push('--champ=' + CHAMP_L);
const CHAMP_N_ARG = arg('champn', '');
if (CHAMP_N_ARG) a.push('--champn=' + CHAMP_N_ARG);
  if (EPS_TIER) a.push('--eps-tier=' + EPS_TIER);
  return new Promise((res) => {
    const t0 = Date.now();
    execFile(process.execPath, a, { cwd: ROOT, maxBuffer: 1 << 26, timeout: 600000 },
      (e, so) => {
        if (e) return res({ err: String(e.message || e).slice(0, 120) });
        const m = String(so).match(/\[冠军4N\] (.*)/);
        if (!m) return res({ err: '输出没有 [冠军4N] 行: ' + String(so).slice(0, 80) });
        const kv = {};
        for (const tok of m[1].split(/\s+/)) { const p = tok.split('='); if (p.length === 2) kv[p[0]] = p[1]; }
        res({ kv, sec: ((Date.now() - t0) / 1000).toFixed(1) });
      });
  });
}
let qi = 0, done = 0, fail = 0;
async function worker() {
  while (qi < ids.length) {
    const id = ids[qi++];
    const r = await one(id);
    done++;
    if (r.err || !r.kv || r.kv.h2 === undefined) { fail++; console.error('  ⛔ ' + id + ' ' + (r.err || '缺 h2')); continue; }
    const row = [id, r.kv.h2, r.kv.h3, r.kv.h5, r.kv.h8, r.kv.x2, r.kv.x3, r.kv.x5, r.kv.x8,
      r.kv.n2, r.kv.n3, r.kv.n5, r.kv.n8, SEED, ROUNDS, MODE || 'multi(默认)', DOSE, r.kv.pool || '(没印戳)', r.sec];
    appendFileSync(OUT, row.join('\t') + '\n', 'utf8');
    if (done % 25 === 0) console.error('  … ' + done + '/' + ids.length + '（失败 ' + fail + '）');
  }
}
(async function () {
  const t0 = Date.now();
  console.error('四格考卷批量：名单 ' + ids.length + ' 枚 ‖ rounds=' + ROUNDS + ' seed=' + SEED + (MODE ? ' mode=' + MODE : ' mode=multi(默认)') + ' jobs=' + JOBS);
  await Promise.all(Array.from({ length: JOBS }, worker));
  console.error('完成 ' + done + ' / 失败 ' + fail + ' ‖ 用时 ' + ((Date.now() - t0) / 60000).toFixed(1) + ' 分钟（jobs=' + JOBS + '）⇒ ' + OUT);
  /* 行序规范化：增量追加的行序 = worker 完成序（跑两遍会不同）⇒ 收尾按 id 排序重写，让产物表自身逐位可复现 */
  if (!fail || true) {
    const NL = String.fromCharCode(10);
    const L = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
    const head = L[0], body = L.slice(1).sort((a, b) => a.split('\t')[0].localeCompare(b.split('\t')[0]));
    writeFileSync(OUT, [head].concat(body).join(NL) + NL);
    console.error('已按 id 排序规范化（' + body.length + ' 行）');
  }
})();
