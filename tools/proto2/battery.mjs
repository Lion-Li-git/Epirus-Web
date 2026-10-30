#!/usr/bin/env node
/* battery.mjs — 对 30 枚单技能固定打法的 **2P 诊断电池**（DS P0；千问 10-29 夜按 P5/E1 落地）
 *
 * 定位：**诊断，不是门**。DS 的 2P 矩阵已证几乎每枚（含 v7）都有 0% 对位 ⇒ "min ≥ X" 会恒红；
 *   这里只回答"这枚包/这条固定打法在 30 个单技能对位上的最差/平均/低分位是谁"，用来生成分层场的捕食者名单。
 * 判据：不设通过线；E1 只用 v7/drain 标定读数形状（见 docs/research/RECOMMEND-2026-10-29-NIGHT-ds.md §四）。
 *
 * 协议：n=2 · multi(hp3) · 每对 G 局（换边各半）· 同批局号（跨候选配对）· `T.oneGameN`。
 *   ⚠ 2P 单挑与 arena2 的 2–10 人平均场不是一把尺：这里读的是"对位表"，不是强度总分。
 *
 * 用法：
 *   node tools/proto2/battery.mjs --v7=1 --policy=drain --games=40 --json=scratch/BATTERY-v7-drain.json
 *   node tools/proto2/battery.mjs --pack=scratch/arms/LONG-s7.bak --games=40 --temp=0.15
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';

function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
  const G = Math.max(4, Number(arg('games', 40)) || 40);
  const TEMP = Number(arg('temp', 0.15));
  const PACK = arg('pack', '');
  const RUN_V7 = arg('v7', '') === '1';
  const POL = String(arg('policy', '')).split(',').map((x) => x.trim()).filter(Boolean);
  const OPP = String(arg('opponents', 'all'));
  const JSON_OUT = arg('json', '');
  if (!(TEMP > 0)) { console.error('⛔ --temp 要正数'); process.exit(2); }
  if (!RUN_V7 && !POL.length && !PACK) { console.error('⛔ 至少给一个被测：--v7=1 / --policy=<键> / --pack=<2.0.bak>'); process.exit(2); }

  const W = sandbox();
  const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
  const ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
  if (!ref) { console.error('⛔ 参照包读不出（对手表/固定打法需要它）'); process.exit(2); }
  const refParams = Float64Array.from(ref);
  if (typeof T.setBigTPush === 'function') T.setBigTPush(12);
  const A = createArena2(W, { refParams, temp: TEMP });
  const OPPS = OPP === 'all' ? R.skills.map((s) => s.key) : OPP.split(',').map((x) => x.trim()).filter(Boolean);
  const bad = OPPS.filter((k) => !R.skills.some((s) => s.key === k));
  if (bad.length) { console.error('⛔ --opponents 里有未知技能键：' + bad.join(',')); process.exit(2); }

  const cands = [];
  function addCand(name, sel) { cands.push({ name, sel }); }
  if (RUN_V7) addCand('v7@' + TEMP, T.policyChooserN(refParams, TEMP));
  for (const k of POL) {
    if (!R.skills.some((s) => s.key === k)) { console.error('⛔ --policy=' + k + ' 不是合法技能键'); process.exit(2); }
    addCand('only:' + k, A.fixed(k));
  }
  let packName = null;
  if (PACK) {
    let raw;
    try { raw = readPack2(PACK); }
    catch (e) { console.error('⛔ 读不到/解不开 ' + PACK + '：' + String(e && e.message || e)); process.exit(2); }
    const got = packCfgExit(raw, PACK);
    const cfg = got.cfg;
        installArch2(W, cfg);
    if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
    const pp = Float64Array.from(P.unpack(raw, true));
    if (!pp || pp.length !== P.paramCount()) { console.error('⛔ 包形状不对：' + (pp && pp.length) + ' vs ' + P.paramCount()); process.exit(7); }
    const w = A.verifyWired(pp, { temp: TEMP });
    if (!w.ok) { console.error('⛔ 2.0 接线没生效：' + JSON.stringify(w)); process.exit(7); }
    packName = PACK.replace(/^.*[\\/]/, '');
    addCand('2.0包 ' + packName + '@' + TEMP, T.policyChooserN(pp, TEMP));
  }

  function duel(sel, oppKey) {
    const opp = A.fixed(oppKey);
    let win = 0, draw = 0, loss = 0, clean = 0;
    for (let i = 0; i < G; i++) {
      const aSeat = i % 2;
      const seed = 4000000 + i * 7919 + oppKey.length * 31;
      const ch = aSeat === 0 ? [sel, opp] : [opp, sel];
      const rm = T.oneGameN(ch, seed, 2, { regen: 0, mode: 'multi' });
      if (rm.winner === 'draw') draw++;
      else if (rm.winner === aSeat) { win++; if (rm.state.p[aSeat] && rm.state.p[aSeat].hp > 0) clean++; }
      else loss++;
    }
    return { key: oppKey, win: 100 * win / G, draw: 100 * draw / G, loss: 100 * loss / G, clean: 100 * clean / G };
  }
  function p10(xs) { const a = xs.slice().sort((x, y) => x - y); return a[Math.max(0, Math.ceil(0.1 * a.length) - 1)]; }
  const pct = (x) => x.toFixed(1) + '%';
  console.log('# 2P 诊断电池 ‖ 对手 ' + OPPS.length + ' 枚单技能 ‖ ' + G + ' 局/对（换边）‖ multi/hp3 ‖ temp=' + TEMP +
    ' ‖ **诊断，不设通过线**');
  const out = { tool: 'tools/proto2/battery.mjs', games: G, temp: TEMP, opponents: OPPS, candidates: [] };
  for (const c of cands) {
    const rows = OPPS.map((k) => duel(c.sel, k));
    const wins = rows.map((r) => r.win), cleans = rows.map((r) => r.clean);
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const summary = {
      winMin: Math.min.apply(null, wins), winMean: mean(wins), winP10: p10(wins),
      cleanMin: Math.min.apply(null, cleans), cleanMean: mean(cleans), cleanP10: p10(cleans),
      under25: rows.filter((r) => r.win < 25).map((r) => r.key),
    };
    console.log('\n· ' + c.name + ' ‖ 胜率 min ' + pct(summary.winMin) + ' / mean ' + pct(summary.winMean) + ' / p10 ' + pct(summary.winP10) +
      ' ‖ 干净胜 min ' + pct(summary.cleanMin) + ' / mean ' + pct(summary.cleanMean) + ' / p10 ' + pct(summary.cleanP10));
    console.log('  对谁 <25% 胜率（' + summary.under25.length + ' 枚）：' + (summary.under25.length ? summary.under25.join(' ‖ ') : '—'));
    console.log('  逐对位（胜/平/负）：' + rows.map((r) => r.key + ' ' + r.win.toFixed(0) + '/' + r.draw.toFixed(0) + '/' + r.loss.toFixed(0)).join('  '));
    out.candidates.push({ name: c.name, rows, summary });
  }
  if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify(out, null, 1) + '\n'); console.log('\n✔ 已写 ' + JSON_OUT); }
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
