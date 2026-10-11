#!/usr/bin/env node
/* ============================================================================
 * probe-regime-fitness.mjs —— 把"环境"变成一个可测量的轴（v1.5.251 · Qoder 09-26 夜班）
 *
 * 要回答的三个问题（今晚整条线都挂在这上面）：
 *   Q1 **现役/池子里的包，换了一个对手类型，它的真适应度掉多少？**（= 脆弱性/有没有策略性）
 *   Q2 **如果选择目标从"跨环境求平均"改成"看最差环境"，被挑出来的会不会是另一批包？**
 *        —— 直接算 mean-agg 排名 vs min-agg 排名的 Kendall τ。
 *        τ 高 ⇒ 改聚合没用（我这条建议作废）；τ 低且 min-agg 首选更"会玩" ⇒ 值得改 `evo.js` 的聚合。
 *   Q3 **一个"每个环境用不同打法"的组合，比"一招鲜最好的那一个"强多少？**
 *        = oracle 上界 `mean_r max_p fit(p,r)` − `max_p mean_r fit(p,r)`。
 *        上界小 ⇒ 条件性在这个地形里不值钱，该去改地形（防御成本），不是改训练。
 *
 * 关键做法：**不自己复算适应度** —— 直接调训练用的真源 `EpirusTrainer.scoreMemberN`，
 *   每个"环境块"= 对手池里**只放一种脚本**（这正是 regime 的定义），其余参数与训练一致。
 *   于是 `fit` / `fitNoDiv` / `firstRate` 与臂里看到的**同一个量纲**，聚合方式的比较才成立。
 *
 * 只读：不写仓库、不改判据、不动引擎。面板/线全部走参数。
 * ==========================================================================*/
import { existsSync, writeFileSync } from 'node:fs';
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
/* `--panel=archive` 用的等价类定义与 probe-pool-frontier **同一个真源**（METHODOLOGY 62） */
import { listArchiveFiles, collectClasses } from './archive-classes.mjs';
import { poolFromSpecs, heldFromNames, HELDOUT } from './regime-panel.mjs';

/* `arg` 在 audit-lib 里**没有导出**（各探针各自定义）—— 这里同样自带一个，避免改公共模块。 */
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };

const FLAGS = ['packs', 'panel', 'seeds', 'games', 'n', 'gen', 'heldout', 'pool-only', 'quiet', 'every', 'limit', 'shard', 'parts', 'json', 'seed-offset', 'incumbent'];
rejectUnknownFlags(process.argv.slice(2), FLAGS, 'probe-regime-fitness');

const SEEDS = Number(arg('seeds', 3)), GAMES = Number(arg('games', 12)), N = Number(arg('n', 5));
/* `--seed-offset` 让**第二阶段用一串没碰过的种子**复量第一批挑出来的粒。
 * 没有它，"863 里筛最好的 40 粒"这件事本身就是把噪声当信号（winner's curse），
 * 复量必须换种子流才谈得上独立（09-26 夜班 §E48 之后的分级筛设计）。 */
const SEED0 = Number(arg('seed-offset', 0));
const GEN = Number(arg('gen', 1200));                       // 后期代：退火/强迫窗口都已关，代表"收敛时的记分"
const POOL_ONLY = process.argv.includes('--pool-only');
const QUIET = process.argv.includes('--quiet');
const PANEL_NAME = arg('panel', 'core');
const LIST = arg('packs', '');
const INCUMBENT = arg('incumbent', 'js/bundled-champion-3p.js');   // 参照系：所有"不劣于现役"的判词都要它在场

/* ---- 面板：现役 + 今天各条线上被点名的包；`--panel=archive` = 整个档案按权重哈希去重 ---- */
const PANEL = {
  core: [
    'js/bundled-champion-3p.js',        // 现役
    'docs/artifacts/v7t1-31.bak',       // 池子里最抗克的那端（最克 16/15）
    'docs/artifacts/v7ds1-band4.bak',   // 最接近"三合一"的一粒（48/44 + 闭环 0.79）
    'docs/artifacts/v7teach2-31.bak',   // 示范血统，宽（5.10/5.22）但脆
    'docs/artifacts/E35-prod-814.bak',  // 今天臂产物里最宽+闭环的（场B 恒 4.00 那粒）
    'docs/artifacts/E39-ctl-911.bak',   // 今天唯一"五维不劣于现役 + 零阻断"的臂产物
    'docs/artifacts/v7blk1-91.bak',     // 宽 5.00/4.51，池子里另一头
    'docs/artifacts/v7cmin3-82.bak',    // 现役的上游（cmin3 热启动点）
  ],
};

/* ---- 环境块：定义不在这里（与 analyze-regime-scan 共用 regime-panel 这一份真源） ---- */
const W = sandbox();
const B = W.EpirusBots, T = W.EpirusTrainer;
if (!T || typeof T.scoreMemberN !== 'function') { console.error('⛔ 拿不到 scoreMemberN（真适应度）'); process.exit(2); }
let packs;
if (LIST) packs = LIST.split(',').map(s => s.trim()).filter(Boolean);
else if (PANEL_NAME === 'archive') {
  const r = collectClasses(W, listArchiveFiles(''), { every: arg('every', 1), limit: arg('limit', 0), shard: arg('shard', 0), parts: arg('parts', 1) });
  packs = r.classes.map(c => c.file);
  /* 档案 glob 只吃 docs/artifacts/*.bak ⇒ **现役不在里面**。
   * 不带上现役，"与现役相对比较"这一维就永远算不出来（09-26 一整天反复撞到的同一条门禁缺口）。 */
  if (Number(arg('shard', 0)) === 0 && !packs.some(p => /bundled-champion-3p/.test(p))) packs.push(INCUMBENT);
  console.log('# 档案等价类 · 文件 ' + r.counts.files + ' → 类 ' + r.counts.uniq +
    '（跳 2P 壳 ' + r.counts.skip.twoP + ' · 老维包 ' + r.counts.skip.oldFeat + '）→ 本片 ' + packs.length +
    ' 粒（shard ' + arg('shard', 0) + '/' + arg('parts', 1) + '，含现役 ' + INCUMBENT + '）');
} else packs = PANEL[PANEL_NAME] || [];
packs = packs.filter(existsSync);
if (!packs.length) { console.error('⛔ 面板里没有可读的文件'); process.exit(2); }
/* 环境块 = **训练池全部条目（函数引用判定）+ 额外原型（池里没有的脚本）**，见 regime-panel 顶部那段事故记录 */
const { pool: POOL_BLOCKS, byFn } = poolFromSpecs(B, OPP_SPECS);
const regimes = POOL_BLOCKS.map(p => ({ name: p.name, sel: p.sel, inPool: true }));
if (!POOL_ONLY) {
  const extraHeld = [], dupes = [];
  for (const h of heldFromNames(B, byFn, Object.keys(HELDOUT))) {
    if (h.clash) { dupes.push(h.name + '→' + h.clash); continue; }        // 同一个脚本换个名字 ≠ 新地形（会重复计权）
    extraHeld.push({ name: h.name, sel: h.sel, inPool: false });
  }
  const gotNames = new Set(extraHeld.map(r => r.name).concat(dupes.map(d => d.split('[')[0])));
  const absent = Object.keys(HELDOUT).filter(n => !gotNames.has(n));
  if (absent.length) console.error('  ⚠ 这些额外原型在 EpirusBots 上取不到函数（少一个就是一根空枪）：' + absent.join(', '));
  regimes.push(...extraHeld);
  if (dupes.length) console.log('# 提示：' + dupes.length + ' 个"额外原型"的脚本其实就在训练池里（只是名字不同）⇒ 不重复量：' + dupes.join(', '));
}
if (!regimes.length) { console.error('⛔ 一个环境都构造不出来'); process.exit(2); }

/* ---- 打分 ---- */
const rows = [];
console.log('# regime-fitness · ' + packs.length + ' 包 × ' + regimes.length + ' 环境 × ' + SEEDS + ' 种子（偏移 ' + SEED0 + ' 起）× ' + GAMES + ' 局/次（gen=' + GEN + '，真源 scoreMemberN）');
let done = 0;
for (const file of packs) {
  const params = loadChamp(W, file);
  if (!params) { console.log('  ⛔ 读不出冠军：' + file); continue; }
  const label = file.replace(/^.*[\\/]/, '').replace(/\.bak$/, '');
  const per = {};
  for (const rg of regimes) {
    const acc = [];
    for (let s = 0; s < SEEDS; s++) {
      const r = T.scoreMemberN(params, [{ name: rg.name, w: 1, sel: rg.sel }], GAMES, N, GEN, SEED0 + s, 0);
      acc.push({ fit: r.fit, fitNoDiv: r.fitNoDiv, firstRate: r.firstRate, leftEp: r.avgLeftEp, maxEp: r.avgMaxEp, distinct: r.distinct, wallDmg: r.wallDmg });
    }
    const mean = k => acc.reduce((a, b) => a + b[k], 0) / acc.length;
    /* 种子数 <2 ⇒ sd 是"没量到"，不是"没有噪声"。写成 0 会让下游把噪声底当 0 除（假 0，METHODOLOGY 78）。 */
    const sd = acc.length > 1 ? Math.sqrt(acc.reduce((a, b) => a + (b.fit - mean('fit')) ** 2, 0) / (acc.length - 1)) : NaN;
    per[rg.name] = { fit: mean('fit'), noDiv: mean('fitNoDiv'), win: mean('firstRate'), sd: sd, leftEp: mean('leftEp'), distinct: mean('distinct'), heldout: !rg.inPool, inpool: !!rg.inPool };
  }
  rows.push({ label: label, file: file, per: per });
  const vals = Object.values(per);
  const mx = Math.max(...vals.map(v => v.win)), mn = Math.min(...vals.map(v => v.win));
  console.log('  ' + label.padEnd(22) + ' 平均胜率 ' + (100 * vals.reduce((a, b) => a + b.win, 0) / vals.length).toFixed(1) +
    '% · 最好环境 ' + (100 * mx).toFixed(0) + '% · 最差环境 ' + (100 * mn).toFixed(0) + '% · **极差 ' + (100 * (mx - mn)).toFixed(0) + 'pt** · 格子 fit-sd 中位 ' +
    (vals.map(v => v.sd).sort((a, b) => a - b)[Math.floor(vals.length / 2)]).toFixed(3));
  if (!QUIET) for (const rg of regimes) console.log('      ' + rg.name.padEnd(14) + (rg.inPool ? '[池内]' : '[池外]') +
    ' fit ' + per[rg.name].fit.toFixed(3) + '  胜率 ' + (100 * per[rg.name].win).toFixed(0) + '%  兑现种 ' + per[rg.name].distinct.toFixed(1) + '  余ep ' + per[rg.name].leftEp.toFixed(1));
  done++;
}
if (!done) { console.error('⛔ 一个包都没量到'); process.exit(3); }
/* `--json=<path>`：整张矩阵结构化落盘（**只写调用者给的路径，建议 /tmp**；仓库照旧一个字节不写）。
 * 为什么要它：判词若靠正则吃自己的 stdout，量具改一行印法结论就变了（METHODOLOGY 76 的同族）。 */
if (arg('json', '')) {
  try {
    writeFileSync(arg('json'), JSON.stringify({ meta: { seeds: SEEDS, seed0: SEED0, games: GAMES, n: N, gen: GEN, panel: PANEL_NAME, when: new Date().toISOString() }, rows }));
    console.log('# json → ' + arg('json'));
  } catch (e) { console.error('⛔ 写 JSON 失败：' + e.message); process.exitCode = 4; }
}

/* ---- Q1/Q2/Q3 汇总 ---- */
const names = regimes.map(r => r.name);
function kendall(a, b) {
  let num = 0, den = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
    const x = a[i] - a[j], y = b[i] - b[j];
    if (x === 0 || y === 0) continue;
    den++; num += Math.sign(x) === Math.sign(y) ? 1 : -1;
  }
  return den ? num / den : NaN;
}
const byMean = rows.map(r => names.reduce((a, k) => a + r.per[k].fit, 0) / names.length);
const byMin = rows.map(r => Math.min(...names.map(k => r.per[k].fit)));
const byMeanPool = rows.map(r => regimes.filter(x => x.inPool).reduce((a, x) => a + r.per[x.name].fit, 0) / Math.max(1, regimes.filter(x => x.inPool).length));
const byMinPool = rows.map(r => Math.min(...regimes.filter(x => x.inPool).map(x => r.per[x.name].fit)));
const byMinHold = rows.map(r => Math.min(...regimes.filter(x => !x.inPool).map(x => r.per[x.name].fit)));
console.log('\n## Q2 换聚合会不会换人（Kendall τ，1.0 = 完全同一批排名 ⇒ 改聚合没用）');
console.log('   全环境 τ(mean, min) = ' + kendall(byMean, byMin).toFixed(3) +
  ' · 仅池内 τ = ' + kendall(byMeanPool, byMinPool).toFixed(3) +
  ' · 池内均值 vs 池外最差 τ = ' + kendall(byMeanPool, byMinHold).toFixed(3) + '（最后这个越低越说明"现在的目标看不见泛化"）');
const top = arr => (arr.length ? rows[arr.indexOf(Math.max(...arr))].label : '—');
console.log('   mean-agg 首选 = ' + top(byMean) + ' ‖ min-agg 首选 = ' + top(byMin) + ' ‖ 池外最差-agg 首选 = ' + top(byMinHold) +
  ' ‖ 池内最差-agg 首选 = ' + top(byMinPool));
const orMean = regimes.reduce((a, rg) => a + Math.max(...rows.map(r => r.per[rg.name].fit)), 0) / regimes.length;
const bestSingle = Math.max(...byMean);
console.log('\n## Q3 oracle 上界（"每个环境各挑当前池子里最好的那粒打法" vs "池子里最好的一粒一招鲜"）');
console.log('   best_single(mean) = ' + bestSingle.toFixed(3) + ' · oracle_switch = ' + orMean.toFixed(3) +
  ' ⇒ **headroom = ' + (orMean - bestSingle).toFixed(3) + '**（fit 量纲约 0~1.8；<0.05 视为"条件性不值钱"）');
console.log('\n## Q1 脆弱性表（胜率极差 = 同一粒包在不同环境下的表现落差；格子 fit-sd = 一个噪声单位，fit 量纲）');
for (const r of rows.slice().sort((a, b) => {
  const sp = x => { const v = names.map(k => x.per[k].win); return Math.max(...v) - Math.min(...v); };
  return sp(b) - sp(a);
})) {
  const v = names.map(k => r.per[k].win);
  const worst = names[v.indexOf(Math.min(...v))];
  console.log('   ' + r.label.padEnd(22) + ' 极差 ' + (100 * (Math.max(...v) - Math.min(...v))).toFixed(0) +
    'pt · 最差环境「' + worst + '」' + (100 * Math.min(...v)).toFixed(0) + '% · 最好「' + names[v.indexOf(Math.max(...v))] + '」' +
    (100 * Math.max(...v)).toFixed(0) + '% · 格子 fit-sd 中位 ' +
    (names.map(k => r.per[k].sd).sort((a, b) => a - b)[Math.floor(names.length / 2)]).toFixed(3));
}
