/* Epirus — 多种子择优训练：并行跑 N 个独立训练，实测每个冠军对 8 基准的胜率，
 * 保留平均胜率最高的（尤其保证能破墙/破防，避免"激进但输墙"的退化个体），写盘。
 * 用法：node tools/train-best.mjs [种子数=3] [每代=500] [worker数=auto]
 * 产物：js/bundled-champion.js
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { makeAsyncStep } from '../server/paralleltrain.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dest = join(root, 'js', 'bundled-champion.js');
const sb = { console, Math, JSON, Object, Array, Number, String, Error,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/evo.js','js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(join(root, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, P = sb.EpirusPolicy, B = sb.EpirusBots, R = sb.EpirusRules;

const N = Number(process.argv[2] || 3);
const GENS = Number(process.argv[3] || 500);
const workers = Number(process.argv[4]) || 0;
const stepAsync = makeAsyncStep(T, workers ? { workers: workers } : {});
console.log(`[parallel] worker 数：${stepAsync.workers}；训练 ${N} 个候选 × ${GENS} 代`);

const fname = { random: 'pickRandom', aggro: 'pickAggro', defend: 'pickDefend', balanced: 'pickBalanced', breakdef: 'pickBreakDef', wall: 'pickWall', reflectspam: 'pickReflectSpam', guardspam: 'pickGuardSpam', baguaspam: 'pickBaguaSpam', combocounter: 'pickComboCounter', mix: 'pickMix', tankline: 'pickTankLine', heavyfire: 'pickHeavyFire', guardgun: 'pickGuardGun', protowall: 'pickProtoWall', whiff: 'pickWhiff', reflectmix: 'pickReflectMix', reflecttank: 'pickReflectTank', defreflectgun: 'pickDefReflectGun' };
const NAMES = Object.keys(fname);
// 与页面“困难·冠军”一致的出招：temp 0.15、只挑可负担
function champSel(c) {
  return function (state, pid, legal) {
    const aff = legal.filter(l => l.affordable);
    const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    return P.choose(state, pid, base, c, { temp: 0.15 });
  };
}
function evalChamp(c) {
  const sel = champSel(c);
  let tot = 0; const per = {};
  for (let i = 0; i < NAMES.length; i++) {
    const nm = NAMES[i];
    const r = T.correctedWinRate(sel, B[fname[nm]], 40, 20260207 + i * 977);
    tot += r.wr; per[nm] = r.wr;
  }
  return { avg: tot / NAMES.length, per: per };
}
// 跨候选择优口径：与 evo.pickChampionByWinRate 同口径——人类式基准任一 <50% 直接不合格，合格后 min 主导
function evScore(ev) {
  let mn = 1;
  for (const k in ev.per) mn = Math.min(mn, ev.per[k]);
  let gateOk = true, gateMin = 1;
  for (const nm in ev.per) {           // 与 evo 同口径：任一基准 <50% 即不合格
    const v = ev.per[nm];
    if (v <= 0.5) gateOk = false;   // 严格 >0.5：纯平局(0.5)也不算过门
    if (v < gateMin) gateMin = v;
  }
  if (!gateOk) return gateMin * 0.4 - 1;
  return 0.5 * ev.avg + 0.5 * mn;
}

let best = null, bestTime = 0;
const cands = [];   // 多目标择优：先收集，再在胜率容差带内取最发散
// 候选 0：现有磁盘冠军（不训练，仅评估）——保证新一轮择优绝不会回归到比现有更弱的冠军
try {
  const curSrc = readFileSync(dest, 'utf8');
  const curM = curSrc.match(/window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/);
  const curObj = curM ? JSON.parse(curM[1]) : null;
  const curP = curObj ? P.unpack(curObj) : null;
  if (curP) {
    const curEv = evalChamp(curP);
    console.log(`候选 0 (现有冠军): 不训练 | avg wr=${(curEv.avg * 100).toFixed(0)}% | wall=${(curEv.per.wall * 100).toFixed(0)}% defend=${(curEv.per.defend * 100).toFixed(0)}%`);
    cands.push({ tag: '现有冠军', pack: P.pack(curP), ev: curEv, score: null, secs: 0, sc: evScore(curEv), div: T.champEntropy(curP, 0.15, 60, 31337) });
  }
} catch (e) { /* 无现有冠军则跳过 */ }
for (let k = 0; k < N; k++) {
  const t = T.makeTrainer({ popSize: 16, gamesPerOpp: 6 });
  const t0 = Date.now();
  for (let g = 0; g < GENS; g++) await stepAsync(t);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  // 先按 broad 8 基准真实胜率把关冠军（不是 shaped 分），再做整体评测——避免 shaped fitness 捧出"打伤害不赢"的激进型
  T.pickChampionByWinRate(t, 16, (t.gen + 1) * 9973);
  const ev = evalChamp(t.champion);
  console.log(`候选 ${k + 1}: ${GENS}代 ${secs}s | score=${t.bestChampScore.toFixed(3)} | avg wr=${(ev.avg * 100).toFixed(0)}% | wall=${(ev.per.wall * 100).toFixed(0)}% defend=${(ev.per.defend * 100).toFixed(0)}% | sel=${evScore(ev).toFixed(3)}`);
  { const e = T.champEntropy(t.champion, 0.15, 60, 31337);
    cands.push({ tag: '候选' + (k + 1), pack: P.pack(t.champion), ev: ev, score: t.bestChampScore, secs: secs, sc: evScore(ev), div: e });
    console.log(`    └ 有效技能数=${Math.exp(e.divNorm * Math.log(28)).toFixed(2)} (${e.distinct} 种, divNorm=${e.divNorm.toFixed(3)})`); }
  bestTime += Number(secs);
}
// ===== 多目标择优：胜率容差带内取覆盖熵最高者 =====
// 只用 argmax(胜率) 必然挑中最强也最窄的个体（实测 2.52 vs 3.25 有效技能）。
// 这里改成：先把「胜率分 ≥ 最高分 - WR_TOL」的候选圈成 band，再在 band 里取 divNorm 最大者。
const WR_TOL = 0.03;
const topSc = Math.max.apply(null, cands.map(function (c) { return c.sc; }));
const band = cands.filter(function (c) { return c.sc >= topSc - WR_TOL; });
band.sort(function (a, b) { return b.div.divNorm - a.div.divNorm; });
best = band[0];
console.log('[多目标择优] 候选=' + cands.length + '  容差带=' + band.length + '（胜率分 ≥ ' + (topSc - WR_TOL).toFixed(3) + '）');
for (const c of cands) console.log('   ' + c.tag.padEnd(8) + ' sc=' + c.sc.toFixed(3) + '  avg=' + (c.ev.avg * 100).toFixed(0) + '%  divNorm=' + c.div.divNorm.toFixed(3) + '  种类=' + c.div.distinct + (c === best ? '   ← 选中' : ''));
console.log('   实际胜率损失 = ' + ((topSc - best.sc) * 100).toFixed(1) + 'pt');
const packStr = JSON.stringify(best.pack);
if (existsSync(dest)) copyFileSync(dest, dest + '.bak');   // 覆写前留一份 .bak
const meta = { source: 'tools/train-best.mjs', seeds: N, gens: GENS, ts: new Date().toISOString(), champWr: best.ev.avg, divNorm: best.div.divNorm, distinct: best.div.distinct, wrTol: WR_TOL };
writeFileSync(dest,
  '/* Epirus 内置冠军：由 tools/train-best.mjs 生成（' + N + ' 候选择优，' + GENS + ' 代，总 ' + bestTime.toFixed(0) + 's）。不要手改。 */\n' +
  'window.EPIRUS_CHAMPION_META = ' + JSON.stringify(meta) + ';\n' +
  'window.EPIRUS_CHAMPION = ' + packStr + ';\n', 'utf8');
// cache-busting：更新 index.html 里冠军 script 的 ?v= 版本号，避免浏览器用旧缓存
try {
  const htmlPath = join(root, 'index.html');
  let html = readFileSync(htmlPath, 'utf8');
  html = html.replace(/(bundled-champion\.js\?v=)[0-9a-z]+/i, '$1' + Date.now().toString(36));
  writeFileSync(htmlPath, html, 'utf8');
} catch (e) { /* ignore */ }
console.log(`择优完成：avg wr=${(best.ev.avg * 100).toFixed(0)}% wall=${(best.ev.per.wall * 100).toFixed(0)}% defend=${(best.ev.per.defend * 100).toFixed(0)}% score=${best.score != null ? best.score.toFixed(3) : '--(现有冠军)'}`);
console.log('已写入 js/bundled-champion.js（' + packStr.length + ' 字节）');
for (const nm of NAMES) console.log('  ' + nm.padEnd(9) + (best.ev.per[nm] * 100).toFixed(0) + '%');
stepAsync.close();
process.exit(0);
