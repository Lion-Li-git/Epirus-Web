#!/usr/bin/env node
/* style-eval.mjs — 对着"明显风格"的纯脚本桌量现有包（DS · 2026-11-02 晚）
 * 用法：node scratch/style-eval.mjs --packs=a,b --style=gun --games=120
 * 桌：5P long，4 席全 only:<style>；量夺1、防御族出手/局、有效/白防。
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACKS = String(arg('packs', '')).split(',').map((s) => s.trim()).filter(Boolean);
const STYLE = arg('style', 'gun');
const GAMES = Math.max(40, Number(arg('games', 120)) || 120);
const N = 5, MODE = 'long', TEMP = 0.15;
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const DEF = new Set(Object.keys(R.byKey).filter((k) => R.byKey[k].cat === R.CAT.DEFENSE));

function loadPack(path) {
  const raw = (() => { try { return readPack2(path); } catch (e) { return null; } })();
  if (raw && raw.v !== 7) { const got = packCfgExit(raw, path); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); return { pp: Float64Array.from(P.unpack(raw, true)), label: 'v:' + raw.v }; }
  const c7 = loadChamp(W, path, '.'); if (!c7) { console.error('⛔ 读不出 ' + path); process.exit(7); }
  return { pp: Float64Array.from(c7), label: 'v7' };
}

for (const path of PACKS) {
  const pack = loadPack(path);
  const inner = T.policyChooserN(pack.pp, TEMP, 0, 5, 'soft');
  const A = createArena2(W, { refParams: pack.pp, temp: TEMP, stratified: false });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
  const gun = A.roster.find((e) => e.name === 'only:' + STYLE);
  if (!gun) { console.error('⛔ roster 里没有 only:' + STYLE); process.exit(7); }
  let win = 0, hands = 0, eff = 0, white = 0;
  for (let k = 0; k < GAMES; k++) {
    const inner2 = T.policyChooserN(pack.pp, TEMP, 0, 5, 'soft');
    let pending = null;
    const classify = (state) => {
      if (!pending) return;
      const win2 = (state.events || []).slice(pending.cursor);
      let block = false, hit = false;
      for (const e of win2) { if (!e || e.to !== 0) continue; if (e.type === 'blocked' || e.type === 'reflect') block = true; if (e.type === 'damage') hit = true; }
      if (pending.isDef) { hands++; if (block) eff++; else if (!hit) white++; }
      pending = null;
    };
    const focus = (state, pid, legal) => {
      classify(state);
      const pick = inner2(state, pid, legal);
      const kk = pick && (pick.key || pick);
      pending = { cursor: (state.events || []).length, isDef: DEF.has(kk) };
      return pick;
    };
    const subs = [focus, gun.sel, gun.sel, gun.sel, gun.sel];
    const r = T.oneGameN(subs, 98000 + k * 977, N, { mode: MODE });
    classify(r.state);
    if (r.winner === 0) win++;
  }
  console.log(path.split('/').pop() + ' (' + pack.label + ') vs 4×only:' + STYLE + ' ‖ 夺1 ' + (100 * win / GAMES).toFixed(1) + '% ‖ 防御 ' + (hands / GAMES).toFixed(1) + ' 手/局、有效 ' + (100 * eff / Math.max(1, hands)).toFixed(1) + '%、白防 ' + (100 * white / Math.max(1, hands)).toFixed(1) + '%');
}
