/* 出手形状探针（**只记录不阻断** · 单一来源 `tools/play-shape.mjs`）。
 *
 * 用法: node tools/probe-play-shape.mjs --packs=a.js,b.js [--games=40] [--mode=multi|long] [--eps=0.2]
 *   · `--eps=0`（默认）= **训练/体检口径**（贪心 softmax(temp)）；`--eps=0.2 --eps-mode=soft` = **前台真桌口径**
 *     （`js/ui/ui.js:464` 用的就是 0.15/0.2/5/soft）。
 *   · 为什么两个口径都要印：用户 2026-09-27 的观察（"前台能看到它连两个环、也有电磁炮"）在 ε=0 的
 *     skill report 里读数是**聚能环 0.0% · 电磁炮 0.6%（强制命中 0%）** —— 两边都对，差的是**前台有随机性注入**。
 *     ⇒ 形状读数若只印一个口径，就会把"前台看到的"与"训练测到的"当成同一件事吵架。
 *
 * 判据地位：**只记录**。θ 与线由用户裁定；本探针不阻断任何流程。
 */
import { build } from './probe-layer-caliber.mjs';
import { rejectUnknownFlags, extractJsonObject, chargeProfile } from './audit-lib.mjs';   /* 珠账的单一来源在 audit-lib（第一版我错调了 trainer 上的同名方法 ⇒ 过期率恒 NaN） */
import { attackTargets, targetFixation, actionKeys, jiGunShape, formatShape, costlyProfile, beadRotRate, formatCostly } from './play-shape.mjs';
import { readFileSync } from 'node:fs';

/** 读包：走 `audit-lib` 的**唯一一份**花括号配平抽取器（`avoid='_META'` 必需：`_META` 写在 `_3P` 前面） */
function paramsOf(sb, file) {
  const src = readFileSync(file, 'utf8');
  const seg = extractJsonObject(src, 'EPIRUS_CHAMPION_3P', '_META') || extractJsonObject(src, 'EPIRUS_CHAMPION', '_META');
  if (!seg) throw new Error('找不到权重槽（或花括号不配平）');
  return sb.EpirusPolicy.unpack(JSON.parse(seg), true);
}

const FLAG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)=(.*)$/.exec(a);
  if (m) FLAG[m[1]] = m[2];
  else if (/^--/.test(a)) FLAG[a.slice(2)] = '1';
}
rejectUnknownFlags(process.argv.slice(2), ['packs', 'games', 'mode', 'eps', 'eps-mode'], 'probe-play-shape');
const PACKS = String(FLAG.packs || 'js/bundled-champion-3p.js').split(',').filter(Boolean);
const GAMES = Number(FLAG.games || 40);
const MODE = FLAG.mode || 'multi';
const EPS = FLAG.eps == null ? 0 : Number(FLAG.eps);
const EPS_MODE = FLAG['eps-mode'] || 'soft';

const b = build({ on: false, pack: PACKS[0] });
const sb = b.sb, T = sb.EpirusTrainer, B = sb.EpirusBots, P = sb.EpirusPolicy, R = sb.EpirusRules;
const POOL = [B.pickAggro, B.pickBalanced, B.pickMix, B.pickBeadBurst, B.pickGuardSpam];
/* 键名从**规则单一来源**取（事件里是小写：实测 `ji,gun,sword,snipe,…`）—— 别写死中文 UI 名 */
const JI = R.SK.JI, GUN = R.SK.GUN;
if (typeof JI !== 'string' || typeof GUN !== 'string') {
  console.error('⛔ 规则里取不到 JI/GUN 的键名（R.SK.JI=' + JI + ' R.SK.GUN=' + GUN + '）⇒ 拒绝静默出 0');
  process.exit(7);
}

console.log('# 出手形状（' + MODE + ' · ' + GAMES + ' 局 · ' + (EPS ? '前台口径 eps=' + EPS + '/' + EPS_MODE : '训练口径 eps=0') + '）');
for (const pf of PACKS) {
  let params;
  try { params = paramsOf(sb, pf); }
  catch (e) { console.log('  ⛔ ' + pf + ' 读不出：' + (e && e.message)); continue; }
  if (!params || !params.length) { console.log('  ⛔ ' + pf + ' 没有权重'); continue; }
  const fxAll = [], jgAll = [], per = [];
  /* v1.5.259：昂贵层累计（大雷次数 / ≥3ep 出手 / 总出手）—— 只记录 */
  const BIG_T = R.SK.BIG_T || R.SK.BIGT || 'bigT';
  const isCostly = (k) => { const c = R.byKey && R.byKey[k]; const v = c ? (c.cost != null ? c.cost : c.ep) : 0; return Number(v) >= 3; };
  let cpBigT = 0, cpCostly = 0, cpN = 0;
  for (let g = 0; g < GAMES; g++) {
    const bs = T.policyChooserN(params, 0.15, EPS, 5, EPS_MODE);
    const ch = [];
    for (let i = 0; i < 5; i++) ch.push(i === 0 ? ((s, p, l) => bs(s, p, l)) : ((s, p, l) => POOL[(g + i) % POOL.length](s, p, l)));
    const r = T.oneGameN(ch, 4400 + g, 5, { mode: MODE });
    const ev = r.state.events;
    for (let seat = 0; seat < 5; seat++) {
      const fx = targetFixation(attackTargets(ev, seat));
      const jg = jiGunShape(actionKeys(ev, seat), JI, GUN);
      if (seat === 0) {
        fxAll.push(fx); jgAll.push(jg);
        const kk = actionKeys(ev, seat), cpp = costlyProfile(kk, BIG_T, isCostly);
        cpBigT += cpp.bigT; cpCostly += cpp.costly; cpN += cpp.n;
      }
      else per.push({ fx: fx, jg: jg });
    }
  }
  /* 汇总：把各局的计数合起来（不是取平均 —— 分母要合，否则"出手多的局"权重被压平） */
  const sumFx = { n: 0, maxRun: 0, same: 0 };
  for (const f of fxAll) { sumFx.n += f.n; if (isFinite(f.maxRun) && f.maxRun > sumFx.maxRun) sumFx.maxRun = f.maxRun; }
  const sumJg = { n: 0, alt: 0, pairs: 0, ji: 0, runSum: 0, runs: 0 };
  for (const j of jgAll) {
    if (!j.n) continue;
    sumJg.n += j.n; sumJg.ji += Math.round(j.jiShare * j.n);
    if (isFinite(j.altRate)) { sumJg.alt += j.altRate; sumJg.pairs += 1; }
    if (isFinite(j.meanJiRun)) { sumJg.runSum += j.meanJiRun; sumJg.runs += 1; }
  }
  const fx = { n: sumFx.n, maxRun: sumFx.maxRun || NaN, sameRate: sumFx.n > 1 ? (() => { let s = 0, p = 0; for (const f of fxAll) if (f.n > 1) { s += f.sameRate * (f.n - 1); p += f.n - 1; } return p ? s / p : NaN; })() : NaN };
  const jg = { n: sumJg.n, altRate: sumJg.pairs ? sumJg.alt / sumJg.pairs : NaN, meanJiRun: sumJg.runs ? sumJg.runSum / sumJg.runs : NaN, jiShare: sumJg.n ? sumJg.ji / sumJg.n : NaN };
  console.log('  ' + pf.replace(/^.*[\\/]/, '').padEnd(24) + ' 冠军席: ' + formatShape(fx, jg));
  /* v1.5.259（用户 GO"做 B"）：昂贵层只记录读数 —— 大雷出手 / ≥3ep 出手占比 / 珠过期率 */
  {
    let rot = NaN;
    try { const chp = chargeProfile(sb, params, MODE, 40); rot = beadRotRate(chp.gained, chp.expired); } catch (e) {}
    console.log('  ' + ''.padEnd(24) + ' ' + formatCostly({ n: cpN, bigT: cpBigT, bigTShare: cpN ? cpBigT / cpN : NaN, costly: cpCostly, costlyShare: cpN ? cpCostly / cpN : NaN }, rot));
  }
  /* 其它 4 席（脚本池）当参照：形状读数有没有判别力，先看它与冠军席分不分得开 */
  const oppFx = per.map(x => x.fx).filter(f => f.n);
  const oppJg = per.map(x => x.jg).filter(j => j.n);
  const om = oppFx.length ? oppFx.reduce((a, f) => a + (isFinite(f.maxRun) ? f.maxRun : 0), 0) / oppFx.length : NaN;
  const oa = oppJg.length ? oppJg.reduce((a, j) => a + (isFinite(j.altRate) ? j.altRate : 0), 0) / oppJg.length : NaN;
  console.log('  ' + ''.padEnd(24) + ' 脚本池 4 席（参照）: 平均最长连打 ' + (isFinite(om) ? om.toFixed(2) : '—') +
    ' · 平均ジ⇄枪交替 ' + (isFinite(oa) ? (100 * oa).toFixed(1) + '%' : '—'));
}
