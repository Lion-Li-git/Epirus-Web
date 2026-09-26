#!/usr/bin/env node
/* ============================================================================
 * probe-floor-pricing.mjs —— 「给防御定价」能不能把那条共同的地板抬起来？（§E54 · 只读 + 内存补丁）
 *
 * 为什么要问：§E49 量出档案 863 粒**共用同一条地板** —— `gunspam`(只枪) 中位胜率 8%，而 `gunspam`
 *   **本来就在训练池里**（见过也没学会）；§E49c 又发现 G4 判它最克的那张卡写的就是「只枪(1ジ压制)」。
 *   两条独立证据指同一个洞 ⇒ 值得问一句：**这是政策类/选择的问题，还是地形的价格问题？**
 *   `js/core/rules.js` 里防御族费用 = 0 ep ⇒ "维持防御"不要预算。E23 的 `guard-cost-lib` 能把这件事
 *   在**内存里**改成可对照的三档（仓库一字不动 ⇒ `rules-fingerprint` 不变，本探针不产生换代）。
 *
 * 判读要同时看两栏，缺一栏就是不合格读数（E23 的原文纪律）：
 *   【地板】五类压制型原型上的胜率（含 `gunspam`）—— 这是本探针的问题；
 *   【代价】三类"本来就会打"的对照组胜率 + 设防手/被摘选项计数 —— 定价不是白拿的。
 * 三条自检写死在代码里：
 *   ① `off` 档必须与"从不打补丁"的沙箱**逐字相同**（否则对照不成立）；
 *   ② 空枪检测 = `dropped===0 && epTaken===0` ⇒ 那一档根本没作用，**响亮失败**；
 *   ③ 环境块名字全部来自 `regime-panel` 与 `OPP_SPECS`，取不到函数就退出（少一格就是一根空枪）。
 * ==========================================================================*/
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { HELDOUT } from './regime-panel.mjs';
import { buildGuarded, formatGuardCost } from './guard-cost-lib.mjs';
import { build } from './probe-layer-caliber.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };
rejectUnknownFlags(process.argv.slice(2), ['packs', 'modes', 'cost', 'seeds', 'games', 'gen', 'incumbent'], 'probe-floor-pricing');

const MODES = arg('modes', 'off,L1,L2').split(',').map(s => s.trim()).filter(Boolean);
const COST = Number(arg('cost', 1));
const SEEDS = Number(arg('seeds', 8)), GAMES = Number(arg('games', 12)), N = Number(arg('n', 5)), GEN = Number(arg('gen', 1200));
const INCUMBENT = arg('incumbent', 'js/bundled-champion-3p.js');
const PACKS = (arg('packs', '') || [INCUMBENT, 'docs/artifacts/v7t2-93.bak', 'docs/artifacts/v7t2-31.bak', 'docs/artifacts/v9-32.bak', 'docs/artifacts/v7blk1-91.bak'].join(','))
  .split(',').map(s => s.trim()).filter(Boolean);

/* 环境块：**地板组 = 压制型原型**；**对照组 = 大家本来都会打的**（用来读"定价的代价"） */
const FLOOR = ['gunspam', 'protomine', 'aimdef', 'strong', 'adaptive'];
const CONTROL = ['wall', 'farmer', 'breakdef'];
const fnName = {}; (OPP_SPECS || []).forEach(o => { fnName[o.name] = o.fn; });
Object.keys(HELDOUT).forEach(k => { if (!fnName[k]) fnName[k] = HELDOUT[k]; });
/* `protomine` 在池里、`promis` 是同一个函数的别名 —— 两个名字都要能用，且必须解到同一个函数 */
fnName.promis = fnName.promis || 'pickProtoMine';

const W0 = sandbox();
for (const nm of FLOOR.concat(CONTROL)) {
  if (typeof W0.EpirusBots[fnName[nm]] !== 'function') { console.error('⛔ 环境块「' + nm + '」的函数取不到（' + fnName[nm] + '）⇒ 少一格就不算对照'); process.exit(2); }
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

/** 一个 mode 一个沙箱；同一次运行内所有包共用，避免"每包重建"带来的顺序效应 */
function ctxFor(mode) {
  if (mode === 'off') return { W: W0, gc: null };
  const r = buildGuarded(build, INCUMBENT, { mode: mode, cost: COST }, { on: false });
  return { W: r.ctx.sb, gc: r.gc };
}
function score(W, packFile, names, seeds) {
  const P = loadChamp(W, packFile);
  if (!P) return null;
  const out = {};
  for (const nm of names) {
    const sel = W.EpirusBots[fnName[nm]];
    let fitSum = 0, winSum = 0, guardSum = 0, nRun = 0;
    for (let s = 0; s < seeds; s++) {
      const r = W.EpirusTrainer.scoreMemberN(P, [{ name: nm, w: 1, sel: sel }], GAMES, N, GEN, s, 0);
      fitSum += r.fit; winSum += r.firstRate; nRun++;
      if (r.guardsPerGame != null) guardSum += r.guardsPerGame;
    }
    out[nm] = { fit: fitSum / nRun, win: winSum / nRun };
  }
  return out;
}

/* ---- 自检 ①：off 档必须与不补丁逐字相同 ---- */
const selfA = score(W0, PACKS[0], ['gunspam'], 2), selfB = score(ctxFor('off').W, PACKS[0], ['gunspam'], 2);
const identical = selfA && selfB && selfA.gunspam.fit === selfB.gunspam.fit && selfA.gunspam.win === selfB.gunspam.win;
console.log('# 地形反事实 · 给防御定价 × 环境轴（内存补丁；`rules.js` 一字未动 ⇒ 指纹不变）');
console.log('# 档位 ' + MODES.join('/') + ' · cost=' + COST + ' ep · 每格 ' + SEEDS + ' 种子 × ' + GAMES + ' 局 · gen=' + GEN);
console.log('  ' + (identical ? '✅' : '⛔') + ' 自检①：off 档与不补丁沙箱逐字相同（fit ' + (selfA && selfA.gunspam.fit) + ' vs ' + (selfB && selfB.gunspam.fit) + '）');
if (!identical) { console.error('⛔ 对照组与被试组不是同一把尺 ⇒ 后面的读数全部作废'); process.exit(3); }

const rows = [];
for (const mode of MODES) {
  const c = ctxFor(mode);
  const per = {};
  for (const f of PACKS) {
    const lab = f.replace(/^.*[\\/]/, '').replace(/\.bak$/, '');
    const r = score(c.W, f, FLOOR.concat(CONTROL), SEEDS);
    if (!r) { console.error('  ⛔ 包读不出：' + f); continue; }
    per[lab] = r;
  }
  if (c.gc) {
    const st = c.gc.stat || {};
    if (!st.dropped && !st.epTaken) { console.error('  ⛔ 档 ' + mode + ' 是**空枪**（dropped=0 且 epTaken=0）⇒ 这一档没作用在任何一手上，不许把"读数没变"读成"定价无效"'); process.exitCode = 4; }
    console.log('  ℹ 档 ' + mode + ' 作用量：' + formatGuardCost(st));
  }
  rows.push({ mode: mode, per: per });
}
const byMode = {}; for (const r of rows) byMode[r.mode] = r.per;

console.log('\n## 每包：地板组（5 类压制原型）与对照组（3 类本来就会打的）的胜率随档位怎么动');
for (const lab of Object.keys(byMode[MODES[0]] || {})) {
  const line = [];
  for (const m of MODES) {
    const p = byMode[m][lab];
    const fl = FLOOR.map(n => p[n].win), ct = CONTROL.map(n => p[n].win);
    line.push(m + ' 地板 ' + (100 * mean(fl)).toFixed(0) + '%(最差 ' + (100 * Math.min(...fl)).toFixed(0) + '%) / 对照 ' + (100 * mean(ct)).toFixed(0) + '%');
  }
  console.log('   ' + lab.padEnd(22) + ' · ' + line.join('  |  '));
}
console.log('\n## 逐格明细（gunspam 是那条共同地板；`promis` = 池里的 `protomine` 同一函数）');
for (const nm of FLOOR.concat(CONTROL)) {
  const cells = [];
  for (const lab of Object.keys(byMode[MODES[0]] || {})) {
    const v = MODES.map(m => (100 * byMode[m][lab][nm].win).toFixed(0) + '%');
    cells.push(lab.slice(0, 12) + ' ' + v.join('→'));
  }
  console.log('   ' + nm.padEnd(11) + '(' + MODES.join('/') + ') ' + cells.join(' · '));
}
if (MODES.length > 1) {
  const base = MODES[0], hard = MODES[MODES.length - 1];
  console.log('\n## 一句话读数（' + base + ' → ' + hard + '，正数 = 抬起来了）');
  for (const lab of Object.keys(byMode[base] || {})) {
    const dF = mean(FLOOR.map(n => byMode[hard][lab][n].win - byMode[base][lab][n].win));
    const dC = mean(CONTROL.map(n => byMode[hard][lab][n].win - byMode[base][lab][n].win));
    const dG = Math.min(...FLOOR.map(n => byMode[hard][lab][n].win)) - Math.min(...FLOOR.map(n => byMode[base][lab][n].win));
    console.log('   ' + lab.padEnd(22) + ' 地板 ' + (100 * dF >= 0 ? '+' : '') + (100 * dF).toFixed(1) + 'pt · 最差格 ' + (100 * dG >= 0 ? '+' : '') + (100 * dG).toFixed(0) +
      'pt · 对照代价 ' + (100 * dC >= 0 ? '+' : '') + (100 * dC).toFixed(1) + 'pt');
  }
}
