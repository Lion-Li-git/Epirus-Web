#!/usr/bin/env node
/* arena-noise-floor.mjs —— Arena B 轴（在册 24 锚联盟 · page 剂量）的**种子噪声地板**复算尺（11-18）
 *
 * 为什么要有这台（对应 11-16 提案 PROPOSAL-2026-11-16-frontline-ruler-into-objective-qoder.md 的第 2 步）：
 *   提案原话是"这一步不做，任何线都是拍的"。今天 B 轴已从 F5 考卷夹具换成 24 枚真包联盟，
 *   这把尺**在册了、落盘了**，但它自己的噪声地板仍然没人量过 ⇒ 任何"拿它排序/定线"都缺分母。
 *   本尺把地板量成在册读数，并且**同时是 `tools/pool-add.mjs` 第三道留痕的量具**（一份实现，两处调用，
 *   不抄第二份量具——本仓为"量具抄两遍"栽过至少四次）。
 *
 * ⚠⚠ 最大的一个坑（本班实测踩过）：`tools/arena-eval.mjs` 的 `--dose` **默认是 `exam`（ε=0）**，
 *   不是 `page`。用默认值跑再拿去比在册的 page 表，会读到 **6~59pt** 的"差"——那其实是 Δε 本身，
 *   不是噪声。所以本尺**硬编码 `--dose=page`**，且每次跑先做接线自证，对不上就直接红，不许继续算地板。
 *
 * 用法：
 *   node tools/arena-noise-floor.mjs --selfcheck
 *        只核接线：在册表里挑几枚，seed=82200 复算 rAll 与 `exam4n-arena-page-1118.tsv` 的 `arR` 比，
 *        偏差 > 0.01pt（表本身 4 位小数的舍入位）⇒ exit 2 并点名。
 *   node tools/arena-noise-floor.mjs [--packs=<id1,id2>] [--seeds=6] [--out=champion-map/data/arena-noise-floor-1118.tsv]
 *        量地板：默认包集=冠军池全体成员（`pool-members.tsv`），默认 6 粒 seedBase（82200 起步、步长 1000）。
 *        ⚠ 时长账：单枚单 seed ≈ 4s ⇒ 6 粒 ≈ 24s/枚；22 枚全池 ≈ 9 分钟（先报时长再开跑）。
 *   node tools/arena-noise-floor.mjs --json --id=<id> --pack=<path>
 *        给 pool-add.mjs 调用：印一枚的 {med,spread,values,n}，不落任何文件。
 * 退出码：0=跑完 ‖ 2=输入/口径不齐（宁可红也不许假绿）。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA = join(ROOT, 'champion-map', 'data');
const ARENA = join(HERE, 'arena-eval.mjs');
const OFFICIAL = join(DATA, 'exam4n-arena-page-1118.tsv');
const POOL = join(DATA, 'page', 'pool-members.tsv');
const SEED0 = 82200, SEED_STRIDE = 1000;
const TOL_PT = 0.01;   /* 在册表存 4 位小数 ⇒ 小于半个末位的差是舍入，不是分歧 */
/** 表头只有这一份定义（写表和追加必须同一次生成，否则 `appendFloor` 的"表头不符"会红在自己身上）。 */
const floorHead = (k) => ['pack_id', 'arenaB', 'arenaSpread', 'seeds'].concat(Array.from({ length: k }, (_, i) => 's' + (SEED0 + i * SEED_STRIDE)));

const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const has = (k) => process.argv.includes('--' + k);

/* ---------- 一份实现的第一处：跑一枚 × 一粒 seedBase，拿 rAll ---------- */
export function arenaOnce(packPath, id, seedBase) {
  const r = spawnSync('node', [ARENA, '--pack=' + packPath, '--id=' + id, '--seed=' + String(seedBase), '--dose=page'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 });
  if (r.status !== 0) return { err: 'rc=' + r.status + ' ' + String(r.stderr || '').trim().slice(0, 120) };
  let j;
  try { j = JSON.parse(String(r.stdout).trim()); } catch (e) { return { err: '输出不是 JSON：' + String(r.stdout).slice(0, 80) }; }
  if (typeof j.rAll !== 'number' || !isFinite(j.rAll)) return { err: '读不出 rAll' };
  return { rAll: j.rAll, short: j.short.r, long: j.long.r, games: j.short.games + j.long.games };
}

/* ---------- 接线自证：复算必须等于在册表，否则后面全是废数 ---------- */
export function selfCheck(pairs) {
  const lines = readFileSync(OFFICIAL, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
  const h = {}; lines[0].split('\t').forEach((c, i) => { h[c] = i; });
  const off = new Map(lines.slice(1).map(l => { const c = l.split('\t'); return [c[h.pack_id], c]; }));
  const bad = []; let worst = 0, n = 0;
  for (const [id, path] of pairs) {
    if (!off.has(id)) { bad.push(id + '（在册 arena 表里没有这枚 ⇒ 无法自证）'); continue; }
    const got = arenaOnce(path, id, SEED0);
    if (got.err) { bad.push(id + '：' + got.err); continue; }
    n++;
    const ref = Number(off.get(id)[h.arR]);
    const dpt = Math.abs(got.rAll - ref) * 100;
    worst = Math.max(worst, dpt);
    if (dpt > TOL_PT) bad.push(id + ' 复算 ' + got.rAll.toFixed(6) + ' vs 在册 ' + ref.toFixed(6) + ' ⇒ 差 ' + dpt.toFixed(4) + 'pt');
  }
  return { worst, n, bad };
}

/* ---------- 一份实现的第二处：一枚跑 k 粒，取中位与极差 ---------- */
export function arenaFloorOf(packPath, id, k) {
  const vals = [];
  for (let i = 0; i < k; i++) {
    const g = arenaOnce(packPath, id, SEED0 + i * SEED_STRIDE);
    if (g.err) return { err: 'seed ' + (SEED0 + i * SEED_STRIDE) + ' ' + g.err };
    vals.push(g.rAll * 100);
  }
  const s = vals.slice().sort((a, b) => a - b);
  const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  /* ⚑ id 必须随行返回：appendFloor 按 rec.id 落列与去重——11-19 夜 pool-add 落的行 id 全空（本函数漏返回），
   *   结果「没量过」审计读不出它（scan 按 pack_id join 不到）⇒ 账面假空白。 */
  return { id, med: Number(med.toFixed(4)), spread: Number((s[s.length - 1] - s[0]).toFixed(4)), values: vals.map(v => Number(v.toFixed(4))), n: k };
}

/* ---------- 这张表的读者（`tools/pool-add.mjs` 用它做引用，不复制读数） ---------- */
export const FLOOR_PATH = join(DATA, 'arena-noise-floor-1118.tsv');
/** ⇒ Map<id, {med, spread, seeds, values}>；表不存在返回空 Map（调用方自己决定"没量过"怎么处置）。 */
export function readFloor(p) {
  const file = p || FLOOR_PATH;
  const out = new Map();
  if (!existsSync(file)) return out;
  const L = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
  const h = {}; L[0].split('\t').forEach((c, i) => { h[c] = i; });
  for (const l of L.slice(1)) {
    const c = l.split('\t');
    if (c[h.pack_id] === undefined) continue;
    /* ⚠ 与"当选判决窗口"比的是**批间 σ**（ddof=1），不是极差：`docs/POOL-CONTRACT.md` §5.2 明写
     *   "极差是批数越多越大的量（3 批 E[极差]≈1.69σ、20 批≈3.7σ），拿 3 批的极差当 σ 会把尺子看粗一倍"。
     *   表里存极差只是留痕（它随 `seeds` 粒数变），判读一律由逐粒值现算 σ。 */
    const vs = Object.keys(h).filter(k => /^s\d/.test(k)).map(k => Number(c[h[k]]));
    let sd = NaN;
    if (vs.length >= 2 && vs.every(isFinite)) {
      const m = vs.reduce((a, b) => a + b, 0) / vs.length;
      sd = Math.sqrt(vs.reduce((a, b) => a + (b - m) * (b - m), 0) / (vs.length - 1));
    }
    out.set(c[h.pack_id], { med: Number(c[h.arenaB]), spread: Number(c[h.arenaSpread]),
      sd: Number.isFinite(sd) ? Number(sd.toFixed(4)) : NaN, seeds: Number(c[h.seeds]), values: vs.map(String) });
  }
  return out;
}
/** 追加或就地替换一枚（同一枚重跑不许留两行 ⇒ 表会变成分叉的第二份真源）。
 *   ⚠ 剂量不符直接抛：往 6 粒的表里追加一枚只跑 4 粒的记录，会让 `arenaSpread` 这一列变成两种口径混住，
 *     而"极差"恰恰是随粒数变的（本仓 R8 那一族：同名列不同义）。 */
export function appendFloor(rec, p) {
  const file = p || FLOOR_PATH;
  let rows = [], head = null;
  if (existsSync(file)) {
    const L = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
    head = L[0].split('\t');
    rows = L.slice(1).map(l => l.split('\t')).filter(r => r[0] !== rec.id);
  }
  const want = floorHead(rec.values.length);
  if (head && head.join('\t') !== want.join('\t')) {
    throw new Error('表头与本次剂量不符（表里 ' + Math.max(0, head.length - 4) + ' 粒 vs 本次 ' + rec.n +
      ' 粒）⇒ 换 --out= 另开一张，不许混进同一列');
  }
  rows.push([rec.id, String(rec.med), String(rec.spread), String(rec.n)].concat(rec.values.map(String)));
  writeFileSync(file, [want.join('\t')].concat(rows.map(r => r.join('\t'))).join('\n') + '\n');
  return rows.length;
}

function poolPairs() {
  if (!existsSync(POOL)) { console.error('⛔ 没有 ' + POOL); process.exit(2); }
  const L = readFileSync(POOL, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
  const h = {}; L[0].split('\t').forEach((c, i) => { h[c] = i; });
  for (const c of ['id', 'path']) if (h[c] === undefined) { console.error('⛔ pool-members.tsv 缺列 ' + c); process.exit(2); }
  return L.slice(1).map(l => { const c = l.split('\t'); return [c[h.id], c[h.path]]; });
}

/* ---------- CLI ---------- */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pairs = arg('packs', '') ? arg('packs', '').split(',').map(id => {
    const hit = poolPairs().find(p => p[0] === id);
    if (!hit) { console.error('⛔ --packs 里的 ' + id + ' 不在池成员表（要测不在池里的件用 --json --pack=）'); process.exit(2); }
    return hit;
  }) : poolPairs();
  if (!pairs.length) { console.error('⛔ 包集为空'); process.exit(2); }

  if (has('json')) {
    const id = arg('id', ''), path = arg('pack', '');
    if (!id || !path) { console.error('⛔ --json 需要 --id= 和 --pack='); process.exit(2); }
    const f = arenaFloorOf(path, id, Number(arg('seeds', 6)));
    console.log(JSON.stringify(Object.assign({ id: id, pack: path }, f)));
    process.exit(f.err ? 2 : 0);
  }

  /* 先自证接线，再谈地板：顺序不能反（反了就是把口径错配报成噪声） */
  const probe = pairs.slice(0, Number(arg('selfcheck-n', 3)));
  const sc = selfCheck(probe);
  console.log('[接线自证] ' + sc.n + '/' + probe.length + ' 枚复算 vs 在册 arR ‖ 最大偏差 ' + sc.worst.toFixed(4) + 'pt（容差 ' + TOL_PT + '）');
  if (sc.bad.length || sc.n === 0) { console.error('⛔ 接线对不上 ⇒ 地板不可引用：\n   · ' + sc.bad.join('\n   · ')); process.exit(2); }
  if (has('selfcheck')) { console.log('✅ 仅自证模式，未跑地板'); process.exit(0); }

  const k = Number(arg('seeds', 6));
  const OUT = resolve(arg('out', 'champion-map/data/arena-noise-floor-1118.tsv'));
  const t0 = Date.now();
  const rows = [];
  for (const [id, path] of pairs) {
    if (!existsSync(resolve(ROOT, path))) { console.error('⛔ ' + id + ' 的权重不在盘上：' + path + '（记录腿不许写"没量过=0"，但也不许假装算过 ⇒ 整批停）'); process.exit(2); }
    const f = arenaFloorOf(path, id, k);
    if (f.err) { console.error('⛔ ' + id + ' 跑失败：' + f.err); process.exit(2); }
    rows.push([id, String(f.med), String(f.spread), String(f.n)].concat(f.values.map(String)));
    console.log('  ' + id + ' ‖ 中位 ' + f.med.toFixed(2) + ' ‖ 极差 ' + f.spread.toFixed(2) + 'pt ‖ 已用 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  const head = floorHead(k);
  writeFileSync(OUT, [head.join('\t')].concat(rows.map(r => r.join('\t'))).join('\n') + '\n');
  const sp = rows.map(r => Number(r[2])).sort((a, b) => a - b);
  console.log('✅ 已写 ' + OUT + '（' + rows.length + ' 枚 × ' + k + ' 粒 seed ‖ ' + ((Date.now() - t0) / 1000).toFixed(0) + 's）');
  console.log('   地板（极差 pt）：min ' + sp[0].toFixed(2) + ' ‖ 中位 ' + sp[Math.floor(sp.length / 2)].toFixed(2) + ' ‖ max ' + sp[sp.length - 1].toFixed(2));
}
