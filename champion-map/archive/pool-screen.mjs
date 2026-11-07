#!/usr/bin/env node
/* pool-screen.mjs —— 冠军池（B 路线）第一步：把**过线包**按 `Hp` 排开、按难度分档，并在每档里挑"行为差别最大"的几枚。
 *
 * 用户 10-11 的方案与随后三条裁定（原话要点）：
 *   · 低难度 = 脚本 + 一些低 Hp 包随机参与；中等 = 中等 Hp 包；困难 = **少量高 Hp 包**（用户指定"手感好且有强度"的）；
 *     每局参与的不一样、包可重复，但**同水平的包尽量挑行为模式差别大的**。
 *   · 裁定①：**中低档没有必要非得蓄能**（"反正本来就是简单难度"）。
 *   · 裁定②：最高档的池子**不需要很多**，包括 `Ldemo`/`K2`/现役/`D4a` **以及本工具挑出来的几枚**，
 *     也**可以放一两个不蓄能的**。
 *   · 裁定③：先跑人席（那是另一台尺，不在这里）。
 *   ⇒ 于是本工具的门槛是**分档的**：`蓄能 > --chg-min` 只卡**困难档的自动成员**（点名成员越过它）；
 *     `摆架 ≤ --ns-max`（卡死病，用户实打点名）对所有**自动成员**生效；被困难档蓄能门槛挡掉的那批**单独印出来**
 *     —— 那正是裁定②里"可以放一两个不蓄能的"的候选清单。
 *
 * 口径（三处都不许自造）：
 *   · **过线** = 与 `champion-map/viewer.mjs` 同一份判定源：`feas-s1..s4.tsv` + `feas.tsv`，后写覆盖先写，
 *     只收 `ok ∈ {0,1}`；**样本量 tag 必须只有一种**（混 n 就等于同一列两把尺）。
 *   · **分数** = `coords.tsv` 的 `Hp` 列（头号尺，986/986 行有值）。
 *   · **行为维** = 与 `champion-map/seatroster.mjs` 的 `DIMS` **同一份**（10 维、刻意不含分数列）
 *     —— 启动时从它源码里抽出来**对账**，不一致就红。
 *   · **去重** = 按 `pack-id.mjs` 的 `widOf`（权重 sha1）：同一粒权重只留一枚；`Hp` 并列时按 `dupOf` 组串里
 *     排前的当名字（= `viewer.mjs` 选图上代表的同一把规则）。
 *
 * 用法：node champion-map/pool-screen.mjs [--hi=54.3] [--lo=46.9] [--n=6,10,10]
 *        [--chg-min=1] [--ns-max=0.10] [--keep=SHIPPED-Ldemo,K2,T8-s114,D4a] [--out=pool-hp.tsv]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { widOf } from './pack-id.mjs';
import { rdTable, seatKillIndex, pairHasBase, BASE_ID } from './seat-rule.mjs';   /* 人席杀刀的判据只有一份（§E590）*/

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const HI = Number(arg('hi', 54.3)), LO = Number(arg('lo', 46.9));
const NS = arg('n', '6,10,10').split(',').map(Number);
const NS_MAX = Number(arg('ns-max', 0.10));       // 摆架（卡死）门槛：对**所有自动成员**生效
const CHG_MIN = Number(arg('chg-min', 1));        // 蓄能门槛：**只**卡困难档的自动成员（裁定①）
const KEEP = (arg('keep', '') || '').split(',').map(s => s.trim()).filter(Boolean);   // 点名：越过筛选，永远进困难档
const OUT = arg('out', 'pool-hp.tsv');

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
const iId = ch.indexOf('id'), iHp = ch.indexOf('Hp'), iH = ch.indexOf('H'), iP = ch.indexOf('path');
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
const byWid = {};
for (const c of cand) { const g = byWid[c.wid] = byWid[c.wid] || []; g.push(c); }
const all = [], sameWidDiffHp = [];
const ordOf = p => { const o = p.dup.split(/\s+/).filter(Boolean); const i = o.indexOf(p.id); return i < 0 ? 1e9 : i; };
for (const w in byWid) {
  const g = byWid[w].slice().sort((a, b) => (b.Hp - a.Hp) || (ordOf(a) - ordOf(b)) || a.id.localeCompare(b.id));
  all.push(g[0]);
  if (g.length > 1 && Math.max.apply(null, g.map(x => x.Hp)) - Math.min.apply(null, g.map(x => x.Hp)) > 1e-9) sameWidDiffHp.push(g);
}
all.sort((a, b) => b.Hp - a.Hp);

/* ---------- 2b. 上槽体检（`promote.tsv`）= **另一道更严的闸**，必须接进来 ----------
 * 为什么：`feas` 的五道**不含**"送盾 ≤ 6/局"与 G4（不许被一行脚本打穿）/G5（面对只防御必须清场）那几条腿，
 *   而池成员恰恰怕的是**退化对手**（被一支脚本打穿 99% 的包放在任何档都是坏对手）。
 * 实测（本班）：池 170 枚里只有 99 枚测过，其中 **65 枚 `block`**、71 枚没测过；
 *   我按 Hp 自动挑出的 `v7l2c-82`（56.8，本档最高）是 `block`（G4/long 被打穿 99%），
 *   我推荐的"不蓄能候选" `v7beadseed-82` 也是 `block`（**送盾 17.3/局 > 6**，`--force` 也不放行）。
 *   ⇒ 教训：**"过线"有两个口径，只用 `feas` 会安静地放进退化包**。 */
const PROM = {};
const promP = join(HERE, 'promote.tsv');
if (existsSync(promP)) {
  const PL = rd(promP), ph = PL[0].split('\t');
  const pI = ph.indexOf('id'), pV = ph.indexOf('verdict'), pB = ph.indexOf('blocks'), pH = ph.indexOf('holoOther');
  for (const l of PL.slice(1)) { const c = l.split('\t'); if (!c[pI]) continue;
    PROM[c[pI]] = { v: c[pV] || '', blocks: c[pB] || '', holo: c[pH] || '' }; }
}
const VD = p => (PROM[p.id] || {}).v || 'untested';
const BLOCKS = p => (PROM[p.id] || {}).blocks || '';
const HOLO = p => (PROM[p.id] || {}).holo || '';

/* ---------- 2c. 人席杀刀（§E531「某格两批同号都比现役差 ≥20pt」）= 自动成员的第三道闸 ----------
 * 为什么必须接（§E590 · 千问）：DS 10-11 手工合并"困难档 7 枚"时正是用这条把 `e35prod807` / `win-R231` 挑掉的，
 *   但**工具当时没接它** ⇒ 谁照着 `pool-hp.tsv` 装配就把那两枚又请回桌上。这条腿补的就是这个落差。
 * 判据不在这里重写 —— 走 `champion-map/seat-rule.mjs`（`tools/pool-add.mjs` 用的是同一份，两份会分叉）。
 * ⚠ 批表里的 id 与池里的 id **不同名**（同一粒权重在表里叫 `win-Ldemo`、池里叫 `SHIPPED-Ldemo`）
 *   ⇒ 一律按 `wid` 对齐（`seatKillIndex` 内部做）。缺表/缺行 = **没量过**，不是"没踩线"。 */
const SEAT_FILES = String(arg('seat', 'pool-seat-90210.tsv,pool-seat-90211.tsv')).split(',').map(s => s.trim()).filter(Boolean);
if (SEAT_FILES.length % 2) { console.error('⛔ --seat= 要成对给（两批同号才判得出）：' + SEAT_FILES.length + ' 个'); process.exit(2); }
const SEAT = new Map(); const seatPairsUsed = []; let seatPairsNoBase = 0;
for (let i = 0; i < SEAT_FILES.length; i += 2) {
  const pair = [SEAT_FILES[i], SEAT_FILES[i + 1]];
  let tables = null;
  try { tables = pair.map(f => rdTable(f, readFileSync(join(HERE, f), 'utf8'))); }
  catch (e) { console.log('# 人席批表缺 ' + pair.join(' ‖ ') + ' ⇒ 这一对不参与判读（**缺表 ≠ 没踩线**）'); continue; }
  /* ⛔ **没有基准行的整对作废**：判据是"与现役比 ≥20pt"，表里没有现役就比不出，
   *   而第一版会把"比不出"读成"零格否决" ⇒ 送分包被当成干净的自动成员请上桌
   *   （10-11 夜 `pool-seat-ml-*.tsv` 实测：六枚里两枚真踩 4 格 / 2 格）。 */
  if (!pairHasBase(tables)) {
    seatPairsNoBase++;
    console.log('# ⛔ 批表对 ' + pair.join(' ‖ ') + ' 里没有基准行（' + BASE_ID + '，两个口径都要）⇒ **这一对判不出杀刀，整对跳过**' +
      ' ⇒ 重跑要带基准：node tools/probe-human-seat.mjs --packs=js/bundled-champion-3p.js,<成员…>');
    continue;
  }
  for (const [wid, v] of seatKillIndex(tables, rel => {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) return null;
    try { return widOf(readFileSync(abs, 'utf8')); } catch (e) { return null; }
  })) {
    const prev = SEAT.get(wid);
    if (!prev || v.kills > prev.kills) SEAT.set(wid, v);
  }
  seatPairsUsed.push(pair.join('/'));
}
const SEATK = p => { const v = SEAT.get(p.wid); return v ? v.kills : -1; };   /* -1 = 这两对表里都没这一粒 */

/* ---------- 3. 分档（门槛是分档的，见文件头）---------- */
/* 自动成员要同时过三道闸：卡死病（摆架）‖ 上槽体检 ≠ block ‖ 人席杀刀 ≠ 踩线。
 *   第三道是 §E590 补的：只前两道的版本会把 `e35prod807`/`win-R231` 这类**已被人席判死**的包挑进困难档。 */
const auto = all.filter(p => p.ns <= NS_MAX && VD(p) !== 'block' && SEATK(p) <= 0);
const hardAuto = auto.filter(p => p.Hp >= HI && p.chg > CHG_MIN);   // 困难档自动成员：另加蓄能门槛
const blockedByChg = all.filter(p => p.Hp >= HI && p.chg <= CHG_MIN);// 被困难档蓄能门槛挡掉的（裁定②的候选清单）
const blockedByProm = all.filter(p => VD(p) === 'block' && !KEEP.some(k => k === p.id));   // 被上槽体检挡掉的
const blockedBySeat = all.filter(p => SEATK(p) > 0 && !KEEP.some(k => k === p.id) && VD(p) !== 'block');   // 被人席杀刀挡掉的（不与 prom-blocked 重复计）
const seatRowsK = all.filter(p => SEATK(p) > 0);   // 踩了线的全部（含点名的）——只为把覆盖面印出来，不参与落盘去重
const mid = auto.filter(p => p.Hp >= LO && p.Hp < HI);
const low = auto.filter(p => p.Hp < LO);
const byId = {}; for (const p of all) byId[p.id] = p;
const keepP = [], keepMiss = [];
for (const id of KEEP) { if (byId[id]) keepP.push(byId[id]); else keepMiss.push(id); }
const hard = hardAuto.concat(keepP.filter(p => hardAuto.indexOf(p) < 0)).sort((a, b) => b.Hp - a.Hp);

/* ---------- 4. 每档最远点贪心（全池 z 化 ⇒ 一杆尺度；种子 = 离本档均值最近的那枚，刻意不看分数）---------- */
const mu = DIMS.map((_, j) => all.reduce((s, p) => s + p.v[j], 0) / all.length);
const sg = DIMS.map((_, j) => Math.sqrt(all.reduce((s, p) => s + (p.v[j] - mu[j]) ** 2, 0) / all.length) || 1);
const zOf = p => p.v.map((x, j) => (x - mu[j]) / sg[j]);
const dist = (a, b) => Math.sqrt(a.reduce((s, x, j) => s + (x - b[j]) ** 2, 0));
function pick(tier, k, fixed) {
  const out = (fixed || []).map(p => ({ p: p, why: '点名（裁定②）', d: '', z: zOf(p) }));
  const cands = tier.filter(p => out.findIndex(x => x.p === p) < 0);
  if (cands.length && out.length < k) {
    const tz = cands.map(zOf);
    const cm = DIMS.map((_, j) => tz.reduce((s, z) => s + z[j], 0) / tz.length);
    let seed = 0, sd = Infinity;
    tz.forEach((z, i) => { const d = dist(z, cm); if (d < sd) { sd = d; seed = i; } });
    out.push({ p: cands[seed], why: '锚（离本档均值最近）', d: '', z: tz[seed] });
    const Z = out.filter(x => x.z).map(x => x.z);
    while (out.length < Math.min(k, tier.length)) {
      let best = -1, bd = -1;
      for (let i = 0; i < cands.length; i++) {
        if (out.findIndex(x => x.p === cands[i]) >= 0) continue;
        const d = Math.min.apply(null, Z.map(q => dist(tz[i], q)));
        if (d > bd) { bd = d; best = i; }
      }
      if (best < 0) break;
      out.push({ p: cands[best], why: '最远点第 ' + (out.length - 1) + ' 步', d: bd.toFixed(2), z: tz[best] }); Z.push(tz[best]);
    }
  }
  return out;
}
const extremes = z => DIMS.map((k, j) => [k, z[j]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2)
  .map(([k, v]) => k + (v > 0 ? '↑' : '↓')).join('/');
const warnOf = p => (p.ns > NS_MAX ? ' ⚠摆架' + p.ns.toFixed(3) : '') + (p.chg <= CHG_MIN ? ' ⚠蓄能' + p.chg.toFixed(2) : '') +
  (VD(p) === 'block' ? ' ⛔体检block[' + BLOCKS(p).slice(0, 30) + ']' : VD(p) === 'pass' ? ' 体检过' : '');

/* ---------- 5. 打印 + 落盘 ---------- */
console.log('# 冠军池筛选 ‖ 过线判定源 = ' + FILES.join('+') + '（tag ' + TAG + '）‖ 过线 ' + cand.length +
  ' 枚 → 按权重去重 **' + all.length + ' 枚**（折掉 ' + (cand.length - all.length) + '）');
if (sameWidDiffHp.length) console.log('  ⚠ 同权重却不同 Hp 的组 ' + sameWidDiffHp.length + '：' +
  sameWidDiffHp.map(g => g[0].wid.slice(0, 8) + '[' + g.map(x => x.id + ':' + x.Hp).join(' ') + ']').join(' ‖ '));
console.log('# 门槛：自动成员须 摆架 ≤ ' + NS_MAX + '（卡死病）**且上槽体检 ≠ block**（送盾/G4/G5 —— `feas` 五道不含这几条）' +
  '‖ 困难档自动成员另须 蓄能 > ' + CHG_MIN +
  '（裁定①：中低档不卡蓄能）‖ 点名 ' + (keepP.length ? keepP.map(p => p.id).join(',') : '（无）') + ' 越过全部门槛');
const nPass = all.filter(p => VD(p) === 'pass').length;
console.log('# 上槽体检（champion-map/promote.tsv，' + Object.keys(PROM).length + ' 枚有记录）：池里 pass ' + nPass +
  ' ‖ block ' + blockedByProm.length + '（已从自动成员出局）‖ 没测过 ' + all.filter(p => VD(p) === 'untested').length +
  ' ⇒ **没测过 ≠ 过关**，池上线前建议逐枚补 `promote --dry`（≈2.5 分钟/枚）');
if (keepMiss.length) console.log('  ⚠ 点名里有 ' + keepMiss.length + ' 个查不到（不在过线集合或 coords 里）：' + keepMiss.join(','));
/* 人席那道闸的覆盖面必须自己报出来：**没量过 ≠ 干净**（批表只覆盖量过的批次）。 */
console.log('# 人席杀刀（§E531 两批同号 ≥20pt，判据在 `seat-rule.mjs`；批表 ' + (seatPairsUsed.join(' + ') || '无') + '）：' +
  '量过 ' + all.filter(p => SEATK(p) >= 0).length + ' 枚 ‖ 踩线出局（自动成员）' + seatRowsK.length + ' 枚：' +
  (seatRowsK.map(p => p.id + '(' + SEATK(p) + '格)').join(' ‖ ') || '无') +
  ' ‖ **没量过 ' + all.filter(p => SEATK(p) < 0).length + ' 枚**（不是"干净"）' +
  (seatPairsNoBase ? ' ‖ ⛔ 另有 ' + seatPairsNoBase + ' 对表因**缺基准行**被整对作废（见上面那行）' : ''));
console.log('# 切点：高 ≥ ' + HI + ' ‖ 中 ' + LO + '~' + HI + ' ‖ 低 < ' + LO + ' ⇒ 困难 ' + hard.length +
  '（其中自动 ' + hardAuto.length + ' + 点名 ' + keepP.length + '）/ 中等 ' + mid.length + ' / 低 ' + low.length + ' 枚 ‖ 行为维 ' + DIMS.length + ' 维（与 seatroster 对账过）');
if (blockedByChg.length) console.log('# 被困难档的蓄能门槛挡掉 ' + blockedByChg.length + ' 枚（裁定②里"可以放一两个不蓄能的"就从这里点名）: ' +
  blockedByChg.slice(0, 12).map(p => p.id + ':' + p.Hp + '(蓄能' + p.chg + ')' + (p.ns > NS_MAX ? '⚠摆架' + p.ns.toFixed(2) : '') + (VD(p) === 'pass' ? ' ✔体检过' : VD(p) === 'block' ? ' ⛔体检block' : '')).join('  ') + (blockedByChg.length > 12 ? ' …' : ''));
if (blockedByProm.length) console.log('# ⛔ 被上槽体检挡掉 ' + blockedByProm.length + ' 枚（自动成员里已剔除；要点名请 `--keep=`）: ' +
  blockedByProm.slice(0, 8).map(p => p.id + ':' + p.Hp + '[' + BLOCKS(p).slice(0, 44) + ']').join('  ') + (blockedByProm.length > 8 ? ' …' : ''));

for (const t of ['hard', 'mid', 'low']) {
  const name = { hard: '困难（裁定②：少而精 = 点名 + 自动挑）', mid: '中等（不卡蓄能）', low: '低（脚本 + 低 Hp 包随机参与）' }[t];
  const arr = t === 'hard' ? hard : (t === 'mid' ? mid : low);
  if (!arr.length) { console.log('\n== ' + t + ' · ' + name + '：0 枚'); continue; }
  console.log('\n== ' + t + ' · ' + name + '（池 ' + arr.length + ' 枚，Hp ' + arr[arr.length - 1].Hp + '~' + arr[0].Hp + '）挑 ' + Math.min(NS[{ hard: 0, mid: 1, low: 2 }[t]], arr.length) + ' 枚');
  for (const x of pick(arr, NS[{ hard: 0, mid: 1, low: 2 }[t]], t === 'hard' ? keepP : [])) {
    const p = x.p;
    console.log('  ' + p.id.padEnd(20) + ' Hp ' + String(p.Hp).padEnd(6) + ' H ' + String(p.H).padEnd(6) +
      ' 显著维 ' + extremes(x.z).padEnd(18) + ' ' + x.why + (x.d ? ' d=' + x.d : '') + warnOf(p));
  }
}
const L = ['id\twid\tHp\tH\ttier\tnoThreatStance\tcharges\tdistinctKeys\tGeff\tverdict\tholoOther\tblocks\tpath'];
const row = (p, t) => [p.id, p.wid, p.Hp, p.H, t, p.ns, p.chg, p.v[4], p.v[8], VD(p), HOLO(p), BLOCKS(p).slice(0, 120), p.path].join('\t');
/* ⚠ 这几档**盖不满** `all`，每一支都必须单独落行，否则它们会在 tsv 里**静默消失**（用户要点名时连 path 都查不到）：
 *   `hard-blocked` = Hp ≥ 切点但蓄能 ≤ 门槛（裁定②"可以放一两个不蓄能的"候选）‖
 *   `prom-blocked` = 上槽体检判 block（送盾/G4/G5）—— 它们不是"没过五道"，是**没过更严的那道**，必须看得见 ‖
 *   `seat-killed`  = 人席杀刀踩线（§E531 两批同号 ≥20pt）—— §E590 补的这一档，就是为了让"被杀过"这件事在表里看得见。
 *   ⚠ 三者**会重叠**（Hp 到线 ∧ 蓄能不够 ∧ 体检 block ∧ 人席踩线）⇒ 按"更严重的那道"优先去重，否则同一枚出两行。 */
const seatRows = blockedBySeat;
const chgRows = blockedByChg.filter(p => VD(p) !== 'block' && SEATK(p) <= 0);
for (const p of hard) L.push(row(p, 'hard'));
for (const p of chgRows) L.push(row(p, 'hard-blocked'));
for (const p of mid) L.push(row(p, 'mid'));
for (const p of low) L.push(row(p, 'low'));
for (const p of blockedByProm) L.push(row(p, 'prom-blocked'));
for (const p of seatRows) L.push(row(p, 'seat-killed'));
writeFileSync(join(HERE, OUT), L.join('\n') + '\n');
console.log('\n已写 champion-map/' + OUT + '（hard ' + hard.length + ' + hard-blocked ' + chgRows.length +
  '（蓄能候选 ' + blockedByChg.length + ' 枚里已剔掉体检 block 的 ' + (blockedByChg.length - chgRows.length) + '）' +
  ' + mid ' + mid.length + ' + low ' + low.length + ' + prom-blocked ' + blockedByProm.length +
  ' + seat-killed ' + seatRows.length + ' = ' + (L.length - 1) + ' 行；漏了/多了就是有行静默消失或重复了）');
console.log('# 人席跑法：node tools/probe-human-seat.mjs --packs=' + hard.map(p => p.path).join(',') + ' --games=200 --modes=multi,long --seed=90210');
