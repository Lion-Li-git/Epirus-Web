#!/usr/bin/env node
/* replay-diagnose.mjs —— 把"重放出了件但 wid 不等"变成"差哪一维"（2026-11-24 · Qoder 通宵班）
 *
 * 为什么要有：v7 年代的 `.bak` **自带自述 META**（`source/n/gens/games/pop/opps/mode/styleW`）。
 *   而 `champion-map/data/page/lineage.tsv` 每行记着目标件的在册旋钮（`mode/gens/oppsN/styleW/divW…`）。
 *   ⇒ 一枚"跑错了"的产物不是垃圾，它把**当年实跑的参数**写在自己身上，与在册一比对就知道缺哪一维。
 *   11-24 实测：`v7new5_005-31` 的线谱行写 `oppsN=17`，而静机重跑出的件自报 `pop:16`（名单只有 13 个）
 *   ⇒ 这一批缺的是**对手池维度**，不是 divW/CLEAR_W 那类经济旋钮。以前只能靠再猜一轮。
 *
 * 用法：
 *   node tools/replay-diagnose.mjs --jobs=scratch/v7-mined/server-jobs-1124.tsv [--wt=/d/code]
 *   node tools/replay-diagnose.mjs --batches=v7expo,v7ringA1 --wt=/d/code
 * 只读：不改台账、不改产物、不跑对局。
 */
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { rejectUnknownFlags, extractJsonObject } from './audit-lib.mjs';

if (process.argv[1] && process.argv[1].endsWith('replay-diagnose.mjs')) {
  rejectUnknownFlags(process.argv.slice(2), ['jobs', 'batches', 'wt', 'lineage', 'emit-jobs'], 'replay-diagnose');
}
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const JOBS = arg('jobs', '');
const ONLY = (arg('batches', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const WTROOT = arg('wt', 'D:/code');
const LIN = arg('lineage', 'champion-map/data/page/lineage.tsv');

const tsv = (f) => readFileSync(f, 'utf8').replace(/\r/g, '').trim().split('\n');
const lin = tsv(LIN);
const lh = Object.fromEntries(lin[0].split('\t').map((c, i) => [c, i]));
const L = new Map();
for (const l of lin.slice(1)) { const c = l.split('\t'); if (c[lh.id] && !L.has(c[lh.id])) L.set(c[lh.id], c); }

/* 待查的 (批, seed, 目标id, era候选) 清单 */
let want = [];
if (JOBS && existsSync(JOBS)) {
  const J = tsv(JOBS);
  const jh = Object.fromEntries(J[0].split('\t').map((c, i) => [c, i]));
  for (const l of J.slice(1)) {
    const c = l.split('\t');
    const b = c[jh.batch];
    if (!b || (ONLY.length && !ONLY.includes(b))) continue;
    const seeds = (c[jh.seeds] || '').split(',').filter(Boolean);
    const ids = (c[jh.ids] || '').split(',').filter(Boolean);
    const eras = (c[jh.era] || '').split(',').filter(Boolean);
    seeds.forEach((s, i) => want.push({ batch: b, seed: s, id: ids[i] || (b + '-' + s), eras, arm: c[jh.arm] || b }));
  }
} else if (ONLY.length) {
  for (const b of ONLY) for (const [id, c] of L) if (id.startsWith(b + '-')) {
    const suffix = /-(\d+)$/.exec(id);
    want.push({ batch: b, seed: c[lh.metaSeed] || (suffix ? suffix[1] : ''), id, eras: [], arm: b });
  }
}
if (!want.length) { console.log('没有要查的 (批,seed)：--jobs= 或 --batches= 给一个'); process.exit(0); }

/* 在 srv-wt-* 里找这一枚 arm-seed.bak（含 .stale-* 隔离件） */
let wtDirs = [];
try { wtDirs = readdirSync(WTROOT).filter((d) => /^srv-wt-/.test(d)).map((d) => WTROOT + '/' + d); } catch (e) { }
const findProd = (arm, seed, eras) => {
  const tries = [];
  for (const e of eras) tries.push(WTROOT + '/srv-wt-s0-' + e.slice(0, 8));
  for (const w of wtDirs) tries.push(w);
  for (const w of tries) {
    for (const suf of ['', '.stale']) {
      const p = w + '/docs/artifacts/' + arm + '-' + seed + '.bak' + (suf ? '' : '');
      if (suf) { try { const d = readdirSync(w + '/docs/artifacts').filter((f) => f.startsWith(arm + '-' + seed + '.bak.stale')); for (const f of d) { const q = w + '/docs/artifacts/' + f; if (existsSync(q)) return { p: q, stale: true }; } } catch (e) { } continue; }
      if (existsSync(p)) return { p, stale: false };
    }
  }
  return null;
};

const META_KEYS = ['n', 'gens', 'games', 'pop', 'mode', 'styleW'];
const rows = [];
let found = 0;
for (const q of want) {
  const lc = L.get(q.id);
  if (!lc) { rows.push({ id: q.id, note: '线谱表里没有这一行' }); continue; }
  const hit = findProd(q.arm, q.seed, q.eras);
  if (!hit) { rows.push({ id: q.id, note: '没找到重放产物（A/B 类：跑不起来或没落件）' }); continue; }
  found++;
  const t = readFileSync(hit.p, 'utf8');
  /* 用仓里那把单一来源的花括号配平抽取器（`extractJsonObject` 返回**平衡的 JSON 文本**，不是对象）：
   *   自己写的 `META = {…}` 非贪婪正则会停在**第一个内层 `}`**（META 里有 `feasibility:{…}`）
   *   ⇒ 35/39 枚一律"解不出来"，等于这台诊断器白造（11-24 实测）。 */
  const raw = extractJsonObject(t, 'EPIRUS_CHAMPION_3P_META');
  let meta = null;
  if (raw) { try { meta = JSON.parse(raw); } catch (e) { meta = null; } }
  if (!meta) { rows.push({ id: q.id, note: '产物里 META 解不出来（件形不同代）' }); continue; }
  const wantOppsN = lc[lh.oppsN] || '';
  const oppsList = String(meta.opps || '').split(',').filter(Boolean);
  const diffs = [];
  /* 关键守卫：线谱表里空串和 `-` 都表示**当年没记这一列**，不是"值为 `-`"。
   *   不守卫就会把 39/39 全报成"差 mode/gens"（11-24 第一版就是这么废的）——
   *   "算不出" 与 "算过且不一致" 必须是两个桶。 */
  const has = (v) => v !== undefined && v !== null && v !== '' && v !== '-';
  let blank = 0;
  if (has(lc[lh.mode])) { if (meta.mode !== lc[lh.mode]) diffs.push('mode 实跑=' + meta.mode + ' / 在册=' + lc[lh.mode]); } else blank++;
  if (has(lc[lh.gens])) { if (String(meta.gens) !== lc[lh.gens]) diffs.push('gens 实跑=' + meta.gens + ' / 在册=' + lc[lh.gens]); } else blank++;
  /* ⚠ 口径修正（11-24 夜班自我抓到）：`lineage.tsv` 的 `oppsN` 是**生成器从包内 META 烘出来的 `opps.length`**
   *   （`champion-map/lineage.mjs:157/492`），拿产物的 `pop`（GA 群体大小）去比它，是把两个不同的量当同一个 ⇒
   *   上一版因此把 8 枚报成"差对手池 pop（可改 env 救）"，而它们**名单长度本来就和在册一致**（22=22），
   *   差的是别的维度。⇒ 这里比 `oppsList.length`，`pop` 只作为附加信息印出来，不参与判定。 */
  if (has(wantOppsN)) { if (String(oppsList.length) !== wantOppsN) diffs.push('对手池 **名单长度 实跑=' + oppsList.length + ' / 在册 oppsN=' + wantOppsN + '**（产物 pop=' + meta.pop + '，pop 不参与判定）'); } else blank++;
  if (has(lc[lh.styleW])) { if (String(meta.styleW || 0) !== lc[lh.styleW]) diffs.push('styleW 实跑=' + meta.styleW + ' / 在册=' + lc[lh.styleW]); } else blank++;
  rows.push({
    id: q.id, prod: hit.p.replace(/\\/g, '/'), stale: hit.stale, pop: meta.pop, oppsLen: oppsList.length,
    gens: meta.gens, mode: meta.mode, blank,
    verdict: diffs.length ? diffs.join(' ‖ ')
      : blank >= 4 ? '线谱表这几列**全没记** ⇒ 无从判缺哪一维（要看热启动件/era 工作树，不是调 env）'
        : '可比列逐项一致仍不等 ⇒ 差异不在这些列（热启动件、era 工作树本体、或未在册的旋钮）',
  });
}
for (const r of rows) {
  if (r.note) { console.log('· ' + r.id.padEnd(18) + ' — ' + r.note); continue; }
  console.log('· ' + r.id.padEnd(18) + (r.stale ? ' [隔离件]' : '') + ' pop=' + String(r.pop).padEnd(4) + '名单=' + String(r.oppsLen).padEnd(4) +
    'gens=' + String(r.gens).padEnd(5) + 'mode=' + String(r.mode).padEnd(7) + '在册空列=' + r.blank + '/4');
  console.log('    ' + r.verdict);
}
const bucket = (r) => r.note ? r.note.replace(/\s*\d+.*$/, '')
  : /对手池/.test(r.verdict) ? '差对手池名单长度（可改 opps 名单/env 救）'
    : /mode 实跑|gens 实跑|styleW 实跑/.test(r.verdict) ? '差 mode/gens/styleW（可改参数救）'
      : /全没记/.test(r.verdict) ? '线谱表没记可比列 ⇒ 无从判（别调 env）'
        : '可比列一致仍不等 ⇒ 查热启动件/era 本体';
const agg = {};
for (const r of rows) { const k = bucket(r); agg[k] = (agg[k] || 0) + 1; }

/* ===== 批次规格：从**同批幸存者**的在盘件里读当年实际参数 =====
 * 为什么要这一段：线谱表的 `mode/gens/oppsN/styleW/divW` 是**从包内 META 烘出来的**
 *   ⇒ 包丢了，这几列就成了 `-`（11-24 实测：`v7new5_005` 的 -31/-81 两枚幸存者记着 oppsN=17，
 *   而缺件 -82/-91/-92/-93 四行全是 `-`）。所以"表里没记"从来不等"当年没参数"，
 *   而是**同一批的同胞件身上就写着**——批的定义本来就是"同配置、不同 seed"。 */
const specOf = {};
{
  const led = tsv('docs/ARTIFACT-LOSS-1119.tsv');
  const eh = Object.fromEntries(led[0].split('\t').map((c, i) => [c, i]));
  const ST = {};
  for (const l of led.slice(1)) { const c = l.split('\t'); if (c[eh.id]) ST[c[eh.id]] = { state: c[eh.state], path: c[eh.path] }; }
  const byBatch = {};
  for (const q of want) (byBatch[q.batch] = byBatch[q.batch] || []).push(q.id);
  for (const [b, ids] of Object.entries(byBatch)) {
    const sis = Object.keys(ST).filter((id) => id.startsWith(b + '-') && (ST[id].state === 'ok' || ST[id].state === 'sha-diff-wid-same'));
    let got = null, from = '';
    for (const id of sis) {
      const p = ST[id].path; if (!p || !existsSync(p)) continue;
      const raw = extractJsonObject(readFileSync(p, 'utf8'), 'EPIRUS_CHAMPION_3P_META');
      if (!raw) continue;
      let m; try { m = JSON.parse(raw); } catch (e) { continue; }
      if (m && m.opps !== undefined) { got = m; from = id; break; }
    }
    if (got) specOf[b] = { from, pop: got.pop, opps: got.opps, gens: got.gens, games: got.games, n: got.n, mode: got.mode, styleW: got.styleW };
  }
}
console.log('\n=== 从同批幸存者读到的批次规格（能直接当重放参数用）===');
for (const b of Object.keys(specOf)) {
  const s = specOf[b];
  console.log('  ' + b.padEnd(14) + ' 取自 ' + s.from.padEnd(16) + ' pop=' + s.pop + ' gens=' + s.gens + ' games=' + s.games + ' n=' + s.n + ' mode=' + s.mode + ' styleW=' + s.styleW);
  console.log('      opps=' + String(s.opps).slice(0, 150));
}
const noSpec = Object.keys(want.reduce((a, q) => (a[q.batch] = 1, a), {})).filter((b) => !specOf[b]);
if (noSpec.length) console.log('  没有幸存者可比对的批（只能回文档/会话）：' + noSpec.join(' ‖ '));

/* --emit-jobs=PATH：把规格摊成第二轮 jobs（opps 用幸存者件里的**逐字名单**，不再猜池字母） */
const EJ = arg('emit-jobs', '');
if (EJ) {
  if (!JOBS || !existsSync(JOBS)) { console.log('⛔ --emit-jobs 需要 --jobs= 提供原始行'); process.exit(2); }
  const J = tsv(JOBS);
  const jh = Object.fromEntries(J[0].split('\t').map((c, i) => [c, i]));
  const out = [J[0]];
  let n = 0;
  for (const l of J.slice(1)) {
    const c = l.split('\t');
    const b = c[jh.batch];
    const s = specOf[b];
    if (!s || !c[jh.seeds]) continue;
    c[jh.opps] = String(s.opps || '');
    c[jh.mode] = s.mode || c[jh.mode] || 'multi';
    /* 只搬**有证据的那一维**：`opps` 是幸存者件逐字写着的名单。
     *   曾经在这里顺手加过 `EPIRUS_TRAIN_GENS/GAMES/N=` 三行"看着像键名"的东西 ——
     *   宇宙扫描立刻把它们当成新旋钮，`training/knobs.mjs --check` 当场变红（11-24 实测）。
     *   正解是删掉臆造，而不是重生成册子把假键登记成在册暗键。 */
    out.push(c.join('\t')); n++;
  }
  writeFileSync(EJ, out.join('\n') + '\n');
  console.log('已写出第二轮 jobs：' + EJ + '（' + n + ' 批，opps 用幸存者件里的逐字名单）');
}
console.log('\n=== 汇总（查 ' + want.length + ' 枚，找到产物 ' + found + ' 枚）===');
for (const [k, v] of Object.entries(agg).sort((a, b) => b[1] - a[1])) console.log('  ' + String(v).padStart(3) + ' × ' + k);
console.log('读法：只有"差 X"那几类能靠改 env 重跑救；"逐项一致仍不等"要去看热启动件与 era 工作树本体，别再调经济旋钮。');
