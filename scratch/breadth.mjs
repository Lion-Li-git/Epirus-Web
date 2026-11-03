#!/usr/bin/env node
/* breadth.mjs — 逐包技能宽度普查（DS · 11-03）
 * 5P long 20 局、ε=0；数"非ジ、份额≥0.5%"的技能种数，并列出。
 * 用法：node scratch/breadth.mjs --packs=a,b --games=20
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACKS = String(arg('packs', '')).split(',').map((s) => s.trim()).filter(Boolean);
const GAMES = Math.max(6, Number(arg('games', 20)) || 20), N = 5, MODE = arg('mode', 'long');
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
/* ⚠ 代次必须在**进循环之前**分好（11-03 实测的病）：`installArch2` 一旦装上就不摘，
 *   于是同一批里排在 v:92 之后的 v7 包会被 `loadChamp` 拒读，屏幕上只留一句"读不出"——
 *   那是**混代的顺序污染**，不是那枚包坏了（与 `pool-defense-census.mjs` 的守卫同一条理由）。 */
const versions = PACKS.map((p) => { try { const raw = readPack2(p); return raw && raw.v ? raw.v : 7; } catch (e) { return 7; } });
const n92 = versions.filter((v) => v !== 7).length, n7 = PACKS.length - n92;
if (n92 && n7) {
  console.error('⛔ 这批混了 ' + n92 + ' 枚 v:92 与 ' + n7 + ' 枚 v7 ⇒ 一台 sandbox 里量不准（arch2 装上就摘不掉）。分两次跑，别把"读不出"当成数。');
  process.exit(7);
}
const USE_ARCH2 = n92 > 0;

for (let idx = 0; idx < PACKS.length; idx++) {
  const path = PACKS[idx];
  let pv = null;
  if (USE_ARCH2 && versions[idx] !== 7) {
    try { const raw = readPack2(path); const got = packCfgExit(raw, path); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); } catch (e) { console.log(path + '：2.0 容器解不开（' + e.message.slice(0, 40) + '）'); continue; }
  }
  if (!pv) { try { pv = Float64Array.from(loadChamp(W, path, '.')); } catch (e) { console.log(path + '：读不出（' + e.message.slice(0, 40) + '）'); continue; } }
  const ch = T.policyChooserN(pv, 0.05, 0, N, 'soft');
  const A = createArena2(W, { refParams: pv, temp: 0.05, stratified: false });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
  const sel = {}; let tot = 0;
  for (let g = 0; g < GAMES; g++) {
    const subs = [ch];
    for (let pid = 1; pid < N; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
    const r = T.oneGameN(subs, 90000 + g * 977, N, { mode: MODE });
    for (const e of (r.state && r.state.events) || []) { if (e.type === 'action' && e.pid === 0 && e.outcome === 'ok' && e.key) { sel[e.key] = (sel[e.key] || 0) + 1; tot++; } }
  }
  /* 事件流里若没有 skill 事件，退化为 lastSkill 快照统计 */
  const keys = Object.entries(sel).filter(([k, v]) => k !== 'ji' && v / Math.max(1, tot) >= 0.005).sort((a, b) => b[1] - a[1]);
  console.log(path.split('/').pop() + ' ‖ 种数 ' + keys.length + ' ‖ ' + keys.map(([k, v]) => k + ' ' + (100 * v / tot).toFixed(1) + '%').join(' '));
}