#!/usr/bin/env node
/* night6-ruler-g3.mjs —— 2.0 精选点的 12 维行为测量（ZCode · 11-05 凌晨）
 *
 * 为什么不直接跑 champion-map/ruler-measure.mjs：它的进程内测量走 audit-lib 的 v7 沙盒，
 *   loadChamp 对 v:92 包 unpack 必 null（默认布局 5225 ≠ 7993）⇒ 整行 ERR。
 * 本件 = **同一把尺的 arch2 私配沙盒版**（score13 补 policy2 的同款先例）：
 *   sandbox() 装好后 install(W, cfg)（arch2 覆盖 forwardCands/chooseCandidates），
 *   测量段逐字复刻 ruler-measure 的调用序与列名（COLS 对齐 ⇒ 合并脚本可直接拼表）。
 * 强度 H 不在此量（合并脚本从夜班 200 局大考填，口径统一）；
 * S = ln(Geff) 照旧公式（与旧行同式 ⇒ T 滑杆对 2.0 行行为一致）。
 * 用法: node scratch/night6-ruler-g3.mjs --out=scratch/night6/ruler-g3.tsv [--shard=1/3]
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { selfPlay, seatSymmetry, chargeProfile, reflectWall, aggressionProfile, fieldRate } from '../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const OUT = arg('out', 'scratch/night6/ruler-g3.tsv');
const SH = String(arg('shard', '1/1')).split('/').map(Number);
const GAMES = 60;

/* 22 枚精选 2.0 点（代表性精选：完全失败实验不进图——用户 11-05 令） */
const PICKS = [
  /* OB3S-C2-s7 裁掉（11-05 凌晨）：v=91 代 2 产物，现尺 loud 闸拒绝装载 ⇒ 2.0 图从 gen-3 可测层起步 */
  ['GD3-ALL', 'scratch/arms/GD3-ALL.bak', '根·蒸馏'],
  ['GD3-RATION', 'scratch/arms/GD3-RATION.bak', '根·蒸馏'],
  ['GD3-SWORD', 'scratch/arms/GD3-SWORD.bak', '根·蒸馏'],
  ['D4a', 'scratch/arms/CLONE-D4a.bak', '根·蒸馏'],
  ['L5-D4a-s13', 'scratch/ga-arms/L5-D4a-s13.js', 'L5谱系'],
  ['CB-combo-v2', 'scratch/night4/CB-combo-v2.bak', 'CB谱系'],
  ['D-a底座', 'scratch/night4/D-a-s41-base.bak', 'D谱系'],
  ['GD3ALL-PLAIN-s13', 'scratch/night3/GD3ALL-PLAIN-s13.js', 'GD3ALL臂族'],
  ['GD3ALL-POPP-s17', 'scratch/night3/GD3ALL-POPP-s17.js', 'GD3ALL臂族'],
  ['GD3ALL-G5-8p-s41', 'scratch/night3/GD3ALL-G5-8p-s41.js', 'GD3ALL臂族'],
  ['GD3ALL-PUSHON-s41', 'scratch/night3/GD3ALL-PUSHON-s41.js', 'GD3ALL臂族'],
  ['GD3ALL-NGA2R-s41', 'scratch/night3/GD3ALL-NGA2R-s41.js', 'GD3ALL臂族'],
  ['EFFG-s41', 'scratch/night5/EFFG-s41.js', '产线'],
  ['G5DEF-s41', 'scratch/night5/G5DEF-s41.js', '产线'],
  ['L5-1200-s13', 'scratch/night5/L5-1200-s13.js', 'L5谱系'],
  ['D1200-s13', 'scratch/night5/D1200-s13.js', 'D谱系'],
  ['D-a-s13', 'scratch/night4/D-a-s13.js', 'D谱系'],
  ['CB3-s13', 'scratch/night6/CB3-s13.js', 'CB谱系'],
  ['HPG-s7', 'scratch/night6/HPG-s7.js', '产线'],
  ['TPG-s41', 'scratch/night6/TPG-s41.js', '产线'],
  ['KDFULL400-s13', 'scratch/ga-arms/KDFULL400-s13.js', 'KD谱系'],
  /* 11-05 上午（千问）：演化图上有 4 个**父节点没进图** ⇒ 孩子只能孤立着画。
   *   补测这四枚（OB3S-C2-s7 是 v:91 代 2 产物，装载闸会拒 ⇒ 拒了就如实记 ERR，不许给假坐标）。 */
  ['KDFULLGA-s13', 'scratch/ga-arms/KDFULLGA-s13.js', 'KD谱系'],
  ['GA-ration-s41', 'scratch/ga-arms/GA-ration-s41.js', 'ration臂'],
  ['WIDEFIX-s7', 'scratch/ga-arms/WIDEFIX-s7.js', '宽度修复'],
  ['KDFULL2', 'scratch/arms/KDFULL2.bak', 'KD谱系'],
  ['KD-V7', 'scratch/arms/KD-V7.bak', 'KD谱系']
  /* OB3S-C2-s7（v:91 代 2）**故意不补**：现尺当场拒装（段表不同形），要复算得回代 2 那笔提交用当时的尺
     ⇒ 它在图上就如实是"父节点未进图（代 2 面，现尺拒装）"，不塞假坐标。 */
];

const COLS = ['id', 'path', 'H', 'S', 'Geff', 'dmg', 'heavy', 'holo', 'zeroRate', 'drawRate',
  'rounds', 'distinctKeys', 'seatSpread', 'rwDmg', 'charges', 'waste', 'noThreatStance', 'fieldAAtk', 'fieldARounds'];

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Float64Array, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const W = sb.window, T = W.EpirusTrainer, P = W.EpirusPolicy;
const { install, packCfgExit } = await import('../tools/proto2/arch2.mjs');
T.setBigTPush(0); T.setDrainPush(0); T.setCursePush(0); T.setSupportPrior(0);

function loadG3(p) {
  const src = readFileSync(isAbsolute(p) ? p : join(ROOT, p), 'utf8');
  const at = src.indexOf('EPIRUS_CHAMPION_3P ');
  if (at < 0) throw new Error('没有 3P 外壳');
  let d = 0, inS = false, esc = false, end = -1;
  for (let k = src.indexOf('{', at); k < src.length; k++) { const c = src[k];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') { inS = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = k; break; } } }
  const raw = JSON.parse(src.slice(src.indexOf('{', at), end + 1));
  const got = packCfgExit(raw, p);
  install(W, got.cfg);
  if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
  return Float64Array.from(P.unpack(raw, true));
}

const OUTP = join(ROOT, OUT);
const done = new Set(existsSync(OUTP) ? readFileSync(OUTP, 'utf8').trim().split('\n').slice(1).map(l => l.split('\t')[0]) : []);
if (!existsSync(OUTP)) writeFileSync(OUTP, COLS.join('\t') + '\n');
const todo = PICKS.filter((e, i) => i % SH[1] === SH[0] - 1 && !done.has(e[0]));
console.log('g3 尺 ‖ 分片 ' + SH[0] + '/' + SH[1] + ' ‖ 本片 ' + todo.length + '/' + PICKS.length + ' 枚（已量 ' + done.size + '）');

const t0 = Date.now();
todo.forEach(([id, path, fam], i) => {
  const rec = { id, path };
  try {
    const params = loadG3(path);
    const sp = selfPlay(W, params, 'multi', 40);
    rec.Geff = sp.effSkills; rec.S = Math.log(Math.max(1, sp.effSkills));
    rec.dmg = sp.dmgPerGame; rec.heavy = sp.heavyPerGame; rec.holo = sp.holoPerGame;
    rec.zeroRate = sp.zeroRate; rec.drawRate = sp.drawRate; rec.rounds = sp.rounds; rec.distinctKeys = sp.distinctKeys;
    const ss = seatSymmetry(W, params, 'multi', 100); rec.seatSpread = ss.spread;
    const cp = chargeProfile(W, params, 'multi', 40); rec.charges = cp.chargesPerGame; rec.waste = cp.wasteRate;
    const rw = reflectWall(W, params, 'long', 40); rec.rwDmg = rw.dmgPerGame;
    const agg = aggressionProfile(W, params, 40); rec.fieldAAtk = agg.fieldA.atk;
    const fp = fieldRate(W, params, 'passive', 'multi'); rec.noThreatStance = fp.noThreatStanceRate;
    const fa = fieldRate(W, params, 'active', 'multi'); rec.fieldARounds = fa.rounds;
  } catch (err) {
    rec.S = 'ERR';
    console.log('  ⚠ ' + id + ' 量失败：' + String(err.message || err).split('\n')[0].slice(0, 90));
  }
  appendFileSync(OUTP, COLS.map(c => rec[c] === undefined ? '' : rec[c]).join('\t') + '\n');
  console.log('  [' + (i + 1) + '/' + todo.length + '] ' + id + ' S=' + (isFinite(rec.S) ? Number(rec.S).toFixed(2) : rec.S) + ' ‖ ' + ((Date.now() - t0) / 1000 / (i + 1)).toFixed(1) + 's/枚');
});
console.log('完成 ⇒ ' + OUTP);
