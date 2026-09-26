#!/usr/bin/env node
/* ============================================================================
 * probe-pool-frontier.mjs — 「池子前沿」量具（v1.5.249 · Qoder 09-26 下午）
 *
 * 它回答一个具体到能被裁定问完的问题：**"宽 + 珠经济闭环 + 抗克制"三样同时成立的包，
 * 在这个池子里到底有几粒？**（09-26 手工跑过：档案 881 类 → 宽 94 → 宽∩闭环里 G4 不劣于现役的 0 粒，
 * 见 `docs/RESEARCH-LOG-2026-09-26-qoder-night.md` §E42~E46）
 *
 * 三级（全部走真源量具，本工具自己不复算任何一维）：
 *   ① 宽   = `audit-lib.selfPlay` 的两模式 `effSkills`（线的单一来源 = `pick-best.COLLAPSE`… 不，线的数值在本工具参数里，
 *            默认取门禁同源：G≥3、净兑现 ≥ --land-line 默认 2.66=现役实测）
 *   ② 闭环 = `audit-lib.chargeProfile` 的 得珠 / 花珠率（默认 --bead-line 0.5、--gained-line 100）
 *   ③ 抗克 = **spawn 真源 `tools/gate-drafts.mjs`**（`GATE4_GAMES` 默认 300），解析它打进 stdout 的
 *            `G4[<名>/long|multi] … 最克「<脚本>」NN%` 标题行 —— 与 `promote-champion` 解析同一行，不另写一份算法
 *
 * 只读：一个字节都不写仓库（`--stage=1` 连子进程都不开）。样本单位 = **按权重哈希去重的等价类**（METHODOLOGY 62）。
 * ⚠️ 老维包（`FEAT_S ≠ 当前`）**只列不判**（09-26 实测：拿今天的引擎解老维包是另一种行为）。
 * ==========================================================================*/
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { sandbox, selfPlay, chargeProfile, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
/* 三条判据的**单一来源**：门 D164 对同一个模块喂合成行（判据不许在门里再抄一份） */
import { isWide, isClosed, isRobust, frontierOf } from './pool-frontier-lib.mjs';

const FLAGS = ['every', 'limit', 'games', 'land-line', 'bead-line', 'gained-line', 'packs', 'stage', 'incumbent'];
rejectUnknownFlags(process.argv.slice(2), FLAGS, 'probe-pool-frontier');
const arg = (k, d) => { const m = new RegExp('^--' + k + '=(.*)$').exec(process.argv.find(a => a.startsWith('--' + k + '=')) || ''); return m ? m[1] : d; };

const EVERY = Math.max(1, Number(arg('every', 1)));
const LIMIT = Number(arg('limit', 0));            // 0 = 不分片（全量等价类）
const GAMES = Number(arg('games', 20));
const LAND = Number(arg('land-line', 2.66));      // 净兑现线（默认 = 现役实测值）
const BEAD = Number(arg('bead-line', 0.5));       // 花珠率线
const GAINED = Number(arg('gained-line', 100));   // 得珠线（40 局口径）
const STAGE = Number(arg('stage', 2));            // 1 = 只跑①②（不起子进程，秒级）；2 = 加③抗克
const LIST = arg('packs', '');
const INCUMBENT = arg('incumbent', 'js/bundled-champion-3p.js');

/* ---------- ① + ②：档案去重 + 宽/闭环 ---------- */
const W = sandbox();
const FEAT = W.EpirusPolicy.FEAT_S || (W.EpirusState && W.EpirusState.FEAT_S) || null;
function unpackOf(file) {
  let src;
  try { src = readFileSync(file, 'utf8'); } catch (e) { return { err: 'read' }; }
  const params = loadChamp(W, file);
  if (!params) return { err: 'unpack' };
  const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src) || /EPIRUS_CHAMPION(?!_3P|_META)\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
  const packObj = m ? JSON.parse(m[1]) : null;
  const hash = packObj ? createHash('sha1').update(JSON.stringify(packObj)).digest('hex').slice(0, 12) : 'no-pack';
  const feat = packObj && packObj.f != null ? packObj.f : null;
  return { params, hash, feat, twoP: !/window\.EPIRUS_CHAMPION_3P\s*=/.test(src) };
}
function metricsOf(params) {
  const sm = selfPlay(W, params, 'multi', GAMES), sl = selfPlay(W, params, 'long', GAMES);
  const c = chargeProfile(W, params, 'long', 40);
  return { gMulti: sm.effSkills, gLong: sl.effSkills, landMulti: sm.effSkillsLand, landLong: sl.effSkillsLand,
    gained: c.gained, spentRate: c.spentRate || 0 };
}
const files = LIST ? LIST.split(',').map(s => s.trim()).filter(Boolean)
  : readdirSync('docs/artifacts').filter(f => /\.bak$/.test(f)).sort().map(f => 'docs/artifacts/' + f);
const uniq = new Map();
const skip = { read: 0, unpack: 0, oldFeat: 0, twoP: 0 };
for (const f of files) {
  const u = unpackOf(f);
  if (u.err === 'read') { skip.read++; continue; }
  if (u.err === 'unpack') { skip.unpack++; continue; }
  if (u.twoP) { skip.twoP++; continue; }                       // 2P 壳不是 3P 候选（09-26 曾把它混进池子）
  if (FEAT != null && u.feat != null && u.feat !== FEAT) { skip.oldFeat++; continue; }
  if (!uniq.has(u.hash)) uniq.set(u.hash, { file: f, params: u.params });
}
let classes = [...uniq.values()];
if (LIMIT > 0) classes = classes.filter((_, i) => i % EVERY === 0).slice(0, LIMIT);
else if (EVERY > 1) classes = classes.filter((_, i) => i % EVERY === 0);

console.log('# 池子前沿（' + (FEAT == null ? '?' : FEAT) + ' 维）· 文件 ' + files.length + ' → 等价类 ' + uniq.size +
  '（跳过：读不出 ' + skip.read + ' · 无权重 ' + skip.unpack + ' · 2P 壳 ' + skip.twoP + ' · 老维包 ' + skip.oldFeat + '）· 本次量 ' + classes.length + ' 类');

const rows = [];
for (const c of classes) {
  let m;
  try { m = metricsOf(c.params); } catch (e) { console.log('  ⚠ 量不出：' + c.file + ' —— ' + e.message); continue; }
  rows.push({ file: c.file, params: c.params, ...m, wide: isWide(m, LAND), closed: isClosed(m, BEAD, GAINED), robust: null });
}
/* ---------- 现役参照（同一把尺） ---------- */
const incParams = loadChamp(W, INCUMBENT);
if (!incParams) { console.error('⛔ 参照包读不出：' + INCUMBENT); process.exit(2); }
const incM = metricsOf(incParams);

/* ---------- ③：抗克 = spawn 真源 gate-drafts，解析它自己的标题行 ---------- */
const needG4 = STAGE >= 2 ? rows.filter(r => r.wide || r.closed).concat([{ file: INCUMBENT, params: incParams }]) : [];
function runG4(list) {
  if (!list.length) return {};
  const args = list.map(r => r.file);
  const rr = spawnSync(process.execPath, ['tools/gate-drafts.mjs'].concat(args), { encoding: 'utf8', timeout: 3600000, maxBuffer: 1 << 25 });
  const out = String(rr.stdout || '');
  const g = {};
  for (const ln of out.split('\n')) {
    const m = /^\s*(PASS|FAIL)\s+G4\[(?:docs\/artifacts\/)?(.+?)\.(?:bak|js)\/(long|multi)\].*?最克「(.+?)」(\d+)%/.exec(ln);
    if (!m) continue;
    (g[m[2]] = g[m[2]] || {})[m[3]] = Number(m[5]);
    (g[m[2]] = g[m[2]] || {})[m[3] + 'S'] = m[4];
  }
  return { g, exit: rr.status };
}
let incG4 = { long: NaN, multi: NaN };
if (needG4.length) {
  const base = 'docs/artifacts/';
  const res = runG4(needG4.map(r => ({ file: r.file.indexOf('/') === 0 || existsSync(r.file) ? r.file : base + r.file })));
  for (const r of rows) {
    const key = r.file.replace(/^.*artifacts\//, '').replace(/\.bak$/, '');
    const hit = res.g && (res.g[key] || res.g[r.file.replace(/\.bak$/, '')]);
    if (hit) { r.g4 = { long: hit.long, multi: hit.multi, script: hit.longS }; r.robust = isRobust(hit, { long: 1e9, multi: 1e9 }); }
  }
  const ik = INCUMBENT.replace(/^.*\//, '').replace(/\.js$/, '');
  incG4 = (res.g && (res.g[ik] || res.g[INCUMBENT.replace(/\.js$/, '')])) || incG4;
  console.log('# gate-drafts exit=' + res.exit + '（抗克判据 = 两模式最克都 ≤ 现役）');
}
const incRef = { long: incG4.long, multi: incG4.multi };
for (const r of rows) if (r.g4) r.robust = isRobust(r.g4, Number.isFinite(incRef.long) ? incRef : { long: 60, multi: 60 });

/* ---------- 汇总 ---------- */
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
console.log('\n## 参照：现役 ' + INCUMBENT + '  G ' + incM.gMulti.toFixed(2) + '/' + incM.gLong.toFixed(2) +
  ' · 净兑现 ' + incM.landMulti.toFixed(2) + '/' + incM.landLong.toFixed(2) + ' · 得珠 ' + incM.gained +
  ' · 花珠率 ' + incM.spentRate.toFixed(3) + (Number.isFinite(incRef.long) ? ' · 最克 ' + incRef.long + '/' + incRef.multi : ' · 最克 —'));
console.log('## 判据：宽 = 两模式 G≥3 且 净兑现≥' + LAND + ' ‖ 闭环 = 花珠率≥' + BEAD + ' 且 得珠≥' + GAINED + ' ‖ 抗克 = 两模式最克 ≤ 现役');
const fr = frontierOf(rows, incRef);
console.log('\n## 前沿计数（n=' + fr.n + ' 个等价类）');
console.log('   宽 ' + fr.wide + ' · 闭环 ' + fr.closed + ' · **宽∩闭环 ' + fr.wideAndClosed + '** · **三合一(宽∩闭环∩抗克) ' + fr.three + '** · 只抗克不宽 ' + fr.robustNotWide);
console.log('   全池中位：得珠 ' + med(rows.map(r => r.gained)) + ' · 花珠率 ' + med(rows.map(r => r.spentRate)).toFixed(2) +
  ' · 花珠率恰好为 0 的 ' + rows.filter(r => r.spentRate === 0).length + ' 粒（' + (100 * rows.filter(r => r.spentRate === 0).length / Math.max(1, fr.n)).toFixed(0) + '%）');
if (STAGE >= 2) {
  const three = rows.filter(r => r.wide && r.closed && r.robust);
  if (three.length) { console.log('\n## 三合一名单：'); for (const r of three) console.log('   ★ ' + r.file + '  最克 ' + r.g4.long + '/' + r.g4.multi + '  G ' + r.gMulti.toFixed(2) + '/' + r.gLong.toFixed(2) + ' 花珠率 ' + r.spentRate.toFixed(2)); }
  const wc = rows.filter(r => r.wide && r.closed).sort((a, b) => ((a.g4 || {}).long || 999) - ((b.g4 || {}).long || 999));
  console.log('\n## 宽∩闭环 按抗克排序（最接近三合一的那几粒离现役多远）');
  for (const r of wc.slice(0, 10)) console.log('   ' + r.file.replace('docs/artifacts/', '').padEnd(30) + (r.g4 ? ' 最克 ' + String(r.g4.long).padStart(3) + '/' + String(r.g4.multi).padStart(3) + '  杀手 ' + (r.g4.script || '').slice(0, 12) : ' 最克 —') +
    '  G ' + r.gMulti.toFixed(2) + '/' + r.gLong.toFixed(2) + ' 得珠 ' + r.gained + ' 花珠率 ' + r.spentRate.toFixed(2));
}
