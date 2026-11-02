/* mine-8p-quick.cjs — 轻量地雷读数：8P 桌 ε=0 打 N 局，数各包 mine 的菜单/自选（验证用户假设：
 * 地雷 3 回合到期、5P+ 环境高性价比威慑 ⇒ 8P 训练应容易学到） */
const fs = require('fs');
const vm = require('vm');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Float64Array, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(fs.readFileSync('D:/code/Epirus-Web/' + f, 'utf8'), sb, { filename: f });
}
const W = sb.window, T = W.EpirusTrainer, P = W.EpirusPolicy, R = W.EpirusRules;
const { install, readPack2, packCfgExit } = require('D:/code/Epirus-Web/tools/proto2/arch2.mjs');

function readPack(p) {
  const src = fs.readFileSync(p, 'utf8');
  const at = src.indexOf('EPIRUS_CHAMPION_3P ');
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
/* 干预档：全关（读数口径与夜班一致） */
T.setBigTPush(0); T.setDrainPush(0); T.setCursePush(0); T.setSupportPrior(0);

function probe(label, params, N, games) {
  const oppName = process.env.OPP || 'pickMix';
  const mode = process.env.MODE || 'multi';
  const ch = T.policyChooserN(Float64Array.from(params), 0.15);
  let mineMenu = 0, mineSel = 0, nonJi = {}, rounds = 0, wins = 0, ep3 = 0, epGe3 = 0;
  for (let g = 0; g < games; g++) {
    const st = W.EpirusState.createState(mode, { next: T.mulberry32(77000 + g) }, N);
    const choosers = [];
    for (let pid = 0; pid < N; pid++) {
      choosers.push(pid === 0 ? function (state, pid, legal) {
        const mine = legal.filter(function (l) { return l.key === R.SK.MINE && l.affordable; });
        mineMenu += mine.length ? 1 : 0;
        if (state.p[pid].ep >= 3) epGe3++;
        const a = ch(state, pid, legal);
        if (a.key === R.SK.MINE) mineSel++;
        if (a.key && a.key !== R.SK.JI) nonJi[a.key] = (nonJi[a.key] || 0) + 1;
        return a;
      } : W.EpirusBots[oppName]);
    }
    W.EpirusPlay.autoGameN(st, choosers);
    rounds += st.round;
    if (st.winner === 0) wins++;
  }
  const kinds = Object.keys(nonJi).length;
  const top = Object.keys(nonJi).sort((a, b) => nonJi[b] - nonJi[a]).slice(0, 5).map((k) => k + '=' + nonJi[k]).join(' ');
  console.log(label + ' ‖ ' + N + 'P ' + mode + ' ×' + games + '（对手 ' + oppName + '）‖ mine 菜单=' + mineMenu + ' 自选=' + mineSel +
    ' ‖ 非ジ ' + kinds + ' 种（' + top + '）‖ 首席胜 ' + (100 * wins / games).toFixed(0) + '% ‖ ep≥3 决策 ' + epGe3);
}
const packs = process.argv.slice(2);
const NP = Number(process.env.NP || 8);
for (const p of packs) {
  try { probe(p.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''), readPack(p), NP, Number(process.env.GAMES || 20)); } catch (e) { console.log(p + ' ⛔ ' + e.message); }
}
