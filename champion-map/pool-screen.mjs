#!/usr/bin/env node
/* pool-screen.mjs —— 冠军池（B 路线）第一步：把**过线包**按 `Hp` 排开、按难度分档，并在每档里挑"行为差别最大"的几枚。
 *
 * 用户 10-11 的方案（原话要点）：低难度 = 脚本 + 一些低 Hp 包随机参与；中等 = 中等 Hp 包；
 *   困难 = **少量高 Hp 包**（用户指定"手感好且有强度"的）；每局参与的包都不一样、包可重复，
 *   但**同水平的包尽量挑行为模式差别大的**。
 *
 * 口径（三处都不许自造）：
 *   · **过线** = 与 `champion-map/viewer.mjs` 同一份判定源：`feas-s1..s4.tsv` + `feas.tsv`，
 *     后写覆盖先写，只收 `ok ∈ {0,1}` 的行。**样本量 tag 必须只有一种**（混 n 就等于同一列两把尺）。
 *   · **分数** = `coords.tsv` 的 `Hp` 列（头号尺，986/986 行有值）。
 *   · **行为维** = 与 `champion-map/seatroster.mjs` 的 `DIMS` **同一份**（10 维、刻意不含分数列）
 *     —— 启动时从它源码里抽出来**对账**，不一致就红（本仓"两份代码分叉"栽过很多次）。
 *   · **去重** = 按 `pack-id.mjs` 的 `widOf`（权重 sha1）折一遍：同一粒权重只留一枚进池
 *     （图上的 `dupOf` 组与 千问 的 `dupes-manifest.tsv` 都在说这件事；池里放两份同权重既浪费名额又会压掉多样性）。
 *
 * 用法：node champion-map/pool-screen.mjs [--hi=54.3] [--lo=46.9] [--n=5,10,10] [--out=pool-hp.tsv]
 *   默认切点 = 过线池的 p90 / p25（高 = 顶部 10%，低 = 底部 25%，其余为中）。`--n=高,中,低` 是各档要挑几枚。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { widOf } from './pack-id.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const HI = Number(arg('hi', 54.3)), LO = Number(arg('lo', 46.9));
const NS = arg('n', '5,10,10').split(',').map(Number);
const OUT = arg('out', 'pool-hp.tsv');
/* `--clean`：只在"两件已知缺陷都没有"的那批里挑 —— 蓄能 > `--chg-min`（用户 10-11 立的约束"蓄能不能是 0"）
 *   且 无威胁摆架 ≤ `--ns-max`（用户实打点名的卡死病：`audit-lib` 的 E 口径）。默认不启用（先把全貌印出来）。 */
const CLEAN = process.argv.includes('--clean');
const CHG_MIN = Number(arg('chg-min', 1)), NS_MAX = Number(arg('ns-max', 0.10));

/* ---------- 0. 行为维对账 ---------- */
const DIMS = ['dmg', 'heavy', 'holo', 'rounds', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'Geff', 'seatSpread'];
const ssrc = readFileSync(join(HERE, 'seatroster.mjs'), 'utf8');
const mm = /const DIMS = \[([^\]]*)\]/.exec(ssrc);
const their = mm ? mm[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : null;
if (!their || their.join(',') !== DIMS.join(',')) {
  console.error('⛔ 行为维与 `seatroster.mjs` 的 DIMS 不一致：\n   本文件: ' + DIMS.join(',') +
    '\n   那边  : ' + (their ? their.join(',') : '(抽不出来)') +
    '\n   ⇒ 两处必须同一份，否则"行为差别大"是两个尺度上的差。');
  process.exit(2);
}

/* ---------- 1. 过线集合（与 viewer 同源）---------- */
const FILES = ['feas-s1.tsv', 'feas-s2.tsv', 'feas-s3.tsv', 'feas-s4.tsv', 'feas.tsv']
  .filter(f => existsSync(join(HERE, f)));
if (!FILES.length) { console.error('⛔ champion-map/ 下没有 feas*.tsv ⇒ 拿不到"过线"判定'); process.exit(2); }
const rd = f => readFileSync(f, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
const ok = {}, TAGS = {};
for (const f of FILES) {
  const L = rd(join(HERE, f)), hd = L[0].split('\t');
  const iId = hd.indexOf('id'), iOk = hd.indexOf('ok'), iT = hd.indexOf('tag');
  for (const l of L.slice(1)) {
    const c = l.split('\t'), id = c[iId]; if (!id) continue;
    if (c[iOk] === '0' || c[iOk] === '1') {
      ok[id] = c[iOk] === '1';
      const tg = (iT >= 0 ? String(c[iT] || '').trim() : '') || '(无 tag 列)';
      TAGS[tg] = (TAGS[tg] || 0) + 1;
    }
  }
}
const tk = Object.keys(TAGS);
if (tk.length > 1) {
  console.error('⛔ 过线判定表里混了 ' + tk.length + ' 种样本量 tag：' + tk.map(x => x + ' × ' + TAGS[x]).join(' ‖ ') +
    '\n   ⇒ 同一列被两把尺量过（n=40 ±12.4pt / n=100 ±7.8pt）⇒ 不许混着当一张表用。');
  process.exit(2);
}
const TAG = tk[0] || '';

/* ---------- 2. coords 联接 + 按 wid 去重 ---------- */
const C = rd(join(HERE, 'coords.tsv')), ch = C[0].split('\t');
const iId = ch.indexOf('id'), iHp = ch.indexOf('Hp'), iP = ch.indexOf('path'), iH = ch.indexOf('H');
const rows = C.slice(1).map(l => l.split('\t'));
const cand = [];
for (const r of rows) {
  const id = r[iId];
  if (ok[id] !== true) continue;
  const path = r[iP];
  if (!path || !existsSync(join(ROOT, path))) continue;
  const v = DIMS.map(k => Number(r[ch.indexOf(k)]));
  if (v.some(x => !isFinite(x))) continue;
  let wid = '';
  try { wid = widOf(readFileSync(join(ROOT, path), 'utf8')); } catch (e) { wid = 'ERR'; }
  cand.push({ id: id, path: path, Hp: Number(r[iHp]), H: Number(r[iH]), v: v, wid: wid,
    ns: Number(r[ch.indexOf('noThreatStance')]), chg: Number(r[ch.indexOf('charges')]),
    dup: String(r[ch.indexOf('dupOf')] || '') });
}
/* 同 wid 折一枚：留 **Hp 最高** 的那枚（同权重读数理应相同；若不同，本身就是要看出来的事） */
const byWid = {};
for (const c of cand) { const g = byWid[c.wid] = byWid[c.wid] || []; g.push(c); }
const pool = [], sameWidDiffHp = [];
/* 同 wid 折一枚：先看 Hp（同权重理应同读数），**并列时按 `dupOf` 组串里排前的那个当名字**
 *   —— 与 `viewer.mjs` 选图上代表的规则同一把（用户 10-11 明确要过这件事：孪生名 `T-s114` vs 线上名 `T8-s114`）。 */
const ordOf = p => { const o = p.dup.split(/\s+/).filter(Boolean); const i = o.indexOf(p.id); return i < 0 ? 1e9 : i; };
for (const w in byWid) {
  const g = byWid[w].slice().sort((a, b) => (b.Hp - a.Hp) || (ordOf(a) - ordOf(b)) || a.id.localeCompare(b.id));
  pool.push(g[0]);
  if (g.length > 1 && Math.max.apply(null, g.map(x => x.Hp)) - Math.min.apply(null, g.map(x => x.Hp)) > 1e-9) sameWidDiffHp.push(g);
}
pool.sort((a, b) => b.Hp - a.Hp);
const N_ALL = pool.length;
const isClean = p => p.chg > CHG_MIN && p.ns <= NS_MAX;
const dirty = pool.filter(p => !isClean(p));
if (CLEAN) { const keep = pool.filter(isClean); pool.length = 0; for (const p of keep) pool.push(p); }

/* ---------- 3. 分档 ---------- */
const tierOf = p => p.Hp >= HI ? 'hard' : (p.Hp >= LO ? 'mid' : 'low');
const T = { hard: pool.filter(p => tierOf(p) === 'hard'), mid: pool.filter(p => tierOf(p) === 'mid'), low: pool.filter(p => tierOf(p) === 'low') };

/* ---------- 4. 每档最远点贪心（全池 z 化 ⇒ 一杆尺度；种子 = 离本档均值最近的那枚，刻意不看分数高低）---------- */
const mu = DIMS.map((_, j) => pool.reduce((s, p) => s + p.v[j], 0) / pool.length);
const sg = DIMS.map((_, j) => Math.sqrt(pool.reduce((s, p) => s + (p.v[j] - mu[j]) ** 2, 0) / pool.length) || 1);
const zOf = p => p.v.map((x, j) => (x - mu[j]) / sg[j]);
const dist = (a, b) => Math.sqrt(a.reduce((s, x, j) => s + (x - b[j]) ** 2, 0));
function pick(tier, k) {
  if (!tier.length) return [];
  const tz = tier.map(p => zOf(p));
  const cm = DIMS.map((_, j) => tz.reduce((s, z) => s + z[j], 0) / tz.length);
  let seed = 0, sd = Infinity;
  tz.forEach((z, i) => { const d = dist(z, cm); if (d < sd) { sd = d; seed = i; } });
  const chosen = [tier[seed]], why = [['锚（离本档均值最近）', '']];
  const Z = [tz[seed]];
  while (chosen.length < Math.min(k, tier.length)) {
    let best = -1, bd = -1;
    for (let i = 0; i < tier.length; i++) {
      if (chosen.indexOf(tier[i]) >= 0) continue;
      const d = Math.min.apply(null, Z.map(q => dist(tz[i], q)));
      if (d > bd) { bd = d; best = i; }
    }
    if (best < 0) break;
    chosen.push(tier[best]); Z.push(tz[best]); why.push(['最远点第 ' + (chosen.length - 1) + ' 步', bd.toFixed(2)]);
  }
  return chosen.map((p, i) => ({ p: p, why: why[i][0], d: why[i][1], z: zOf(p) }));
}
const extremes = z => DIMS.map((k, j) => [k, z[j]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2)
  .map(([k, v]) => k + (v > 0 ? '↑' : '↓')).join('/');

/* ---------- 5. 打印 + 落盘 ---------- */
console.log('# 冠军池筛选 ‖ 过线判定源 = ' + FILES.join('+') + '（tag ' + TAG + '）‖ 过线 ' + cand.length +
  ' 枚 → **按权重去重 ' + N_ALL + ' 枚**（同 wid 折掉 ' + (cand.length - N_ALL) + '）' +
  (CLEAN ? ' → `--clean` 后 **' + pool.length + ' 枚**（剔掉 ' + dirty.length + ' 枚：蓄能 ≤ ' + CHG_MIN + ' 或 摆架 > ' + NS_MAX + '）' : ''));
/* 缺陷在**档内**的富集度必须印出来：全局相关 ≈ 0，但顶端那一段偏偏被"没有珠经济"的包占住
 *   —— 只看全局相关系数会得出"没有关系"的错误结论（本班实测 ρ(Hp,蓄能)=0.034 而困难档 73% 蓄能≤1）。 */
for (const t of ['hard', 'mid', 'low']) {
  const A = pool.filter(p => tierOf(p) === t);
  if (!A.length) continue;
  const a1 = A.filter(p => p.chg <= CHG_MIN).length, a2 = A.filter(p => p.ns > NS_MAX).length, a3 = A.filter(isClean).length;
  console.log('#   档内富集 ' + t.padEnd(4) + String(A.length).padStart(4) + ' 枚 ‖ 蓄能≤' + CHG_MIN + ' ' +
    String(a1).padStart(3) + ' (' + String(Math.round(100 * a1 / A.length)).padStart(3) + '%) ‖ 摆架>' + NS_MAX + ' ' +
    String(a2).padStart(3) + ' (' + String(Math.round(100 * a2 / A.length)).padStart(3) + '%) ‖ ★两者都好 ' +
    String(a3).padStart(3) + ' (' + Math.round(100 * a3 / A.length) + '%)');
}
if (sameWidDiffHp.length) console.log('  ⚠ 同权重却不同 Hp 的组 ' + sameWidDiffHp.length + '（本身是异常，逐组印）: ' +
  sameWidDiffHp.map(g => g[0].wid.slice(0, 8) + '[' + g.map(x => x.id + ':' + x.Hp).join(' ') + ']').join(' ‖ '));
console.log('# 切点：高 ≥ ' + HI + ' ‖ 中 ' + LO + '~' + HI + ' ‖ 低 < ' + LO + '（默认 = 池的 p90 / p25 ⇒ ' +
  T.hard.length + ' / ' + T.mid.length + ' / ' + T.low.length + ' 枚）‖ 行为维 ' + DIMS.length + ' 维（与 seatroster 对账过）');
const SHOW = { hard: NS[0], mid: NS[1], low: NS[2] };
for (const t of ['hard', 'mid', 'low']) {
  const name = { hard: '困难（少量高 Hp，用户指定手感+强度）', mid: '中等', low: '低（脚本 + 低 Hp 包随机参与）' }[t];
  const arr = T[t];
  if (!arr.length) { console.log('\n== ' + t + ' ' + name + '：0 枚'); continue; }
  console.log('\n== ' + t + ' · ' + name + '（' + arr.length + ' 枚，Hp ' + arr[arr.length - 1].Hp + '~' + arr[0].Hp + '）挑 ' + Math.min(SHOW[t], arr.length) + ' 枚');
  for (const x of pick(arr, SHOW[t])) {
    const p = x.p;
    const warn = (p.ns > 0.10 ? ' ⚠摆架' + p.ns.toFixed(3) : '') + (p.chg <= 1 ? ' ⚠蓄能' + p.chg.toFixed(2) : '');
    console.log('  ' + p.id.padEnd(20) + ' Hp ' + String(p.Hp).padEnd(6) + ' H ' + String(p.H).padEnd(6) +
      ' 显著维 ' + extremes(x.z).padEnd(18) + ' ' + x.why + (x.d ? ' d=' + x.d : '') + warn);
  }
}
const L = ['id\twid\tHp\tH\ttier\tnoThreatStance\tcharges\tdistinctKeys\tGeff\tpath'];
for (const p of pool) L.push([p.id, p.wid, p.Hp, p.H, tierOf(p), p.ns, p.chg, p.v[4], p.v[8], p.path].join('\t'));
writeFileSync(join(HERE, OUT), L.join('\n') + '\n');
console.log('\n已写 champion-map/' + OUT + '（' + pool.length + ' 行，按 Hp 降序）');
console.log('# 跑法：node tools/probe-human-seat.mjs --packs=' + pick(T.hard, NS[0]).map(x => x.p.path).join(',') + ' --games=200 --seed=90210');
