/* 符咒浪费率探针（ZCode 11-06 晨，用户令：「符咒浪费率其实也可在训练出来的时候测一下，
 * 如果有未引爆就过期的符咒记录一下其浪费率」）。
 *
 * 口径（引擎现状的诚实边界）：
 *   · 符咒**引爆后仍存在**（R37：「符咒引爆后仍存在（不删）」）⇒ 每枚符咒最终都会 3 回合到期，
 *     「过期」本身不是浪费信号；**贴出去到过期一次都没被引爆**才是浪费。
 *   · 事件流没有逐枚符咒的身份（firestorm 事件只有当次枚数 n；同一枚可被多次天火重复引爆）
 *     ⇒ 逐枚"从未引燃"无法从事件流精确判定。本探针给出两个**可精确计量**的代理指标：
 *       A) **引燃覆盖** I/A：贴出 A 枚、引发 I 次引燃（含同枚重复）⇒ I/A ≈ 每枚符咒平均被引爆次数；
 *          I/A ≈ 0 = 贴了从不引（纯浪费）；≥1 = 引爆经济活着（同一枚被引爆 2 次时 I>A 属正常）。
 *       B) **空放率**：n=0 的天火出手占比（R64 后引擎层面应恒为 0 —— 本探针兼当 R64 的实测验证）。
 *   · 精确逐枚浪费率需要引擎在 sticker 上打引燃标记（resolve.js = 指纹五件套）⇒ 今天不动引擎，
 *     记为后续项（下一轮指纹换代时一并做）。
 *
 * 桌形：产品同一条路 pool compose（主体包固定坐 0 号席、其余 4 席按池抽），multi 3 血，120 局/枚。
 */
import { readFileSync } from 'node:fs';
global.window = global;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/policy.js','js/train/policy2.js','js/train/bots.js','js/train/evo.js','js/train/trainer.js','js/champion-pack.js','js/pool-draw.js','js/bundled-champion-pool.js']) {
  eval(readFileSync(f, 'utf8'));
}
const S = global.EpirusState, Play = global.EpirusPlay, P = global.EpirusPolicy, D = global.EpirusPoolDraw;
const T = global.EpirusTrainer;
const ALLMEM = global.EPIRUS_CHAMPION_POOL.members;
const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const paramCache = {};
const paramsOf = (id) => {
  if (!paramCache[id]) {
    const m = ALLMEM.find(x => x.id === id);
    if (!m) return null;
    try { paramCache[id] = P.unpack(m.pack, true); } catch (e) { paramCache[id] = null; }
  }
  return paramCache[id];
};
const tier = global.EpirusBots.DIFF_TIERS.find(t => t.id === 'lv:regular');
const GAMES = 120, N = 5;

function measure(packId, seedBase) {
  const prm = paramsOf(packId);
  if (!prm) return null;
  let attach = 0, ignite = 0, emptyCast = 0, firestormCasts = 0, curseBlock = 0, purify = 0, games = 0;
  for (let g = 0; g < GAMES; g++) {
    const seed = seedBase + g;
    const st = S.createState('multi', { next: mulberry32(seed) }, N);
    st.slotSalt = (Math.imul(seed, 2654435761)) >>> 0;
    const R = D.rosterFor(ALLMEM, tier);
    const draw = D.compose(R.members, N - 1, D.rng(st.slotSalt), null, R.bandW);
    const choosers = [];
    for (let pid = 0; pid < N; pid++) {
      if (pid === 0) { choosers.push(T.policyChooserN(prm, 0.15, 0.1, 5, 'soft')); continue; }
      const se = draw.seats[(pid - 1) % draw.seats.length];
      const id = se && se.id ? se.id : null;
      const p2 = id ? paramsOf(id) : null;
      choosers.push(p2 ? T.policyChooserN(p2, 0.15, 0.1, 5, 'soft') : ((s, q, legal) => 'ji'));
    }
    st.events = [];
    Play.autoGameN(st, choosers);
    games++;
    for (const e of st.events) {
      if (e.type === 'curse' && e.owner === 0) attach++;
      else if (e.type === 'curseBlock' && e.pid === 0) curseBlock++;      // 0 号贴被挡（架势）⇒ 贴而未附
      else if (e.type === 'firestorm' && e.pid === 0) { firestormCasts++; if (e.n > 0) ignite += e.n; else emptyCast++; }
      else if (e.type === 'purify' && e.pid === 0) purify += (e.curses || 0);
    }
  }
  return { packId, games, attach, ignite, firestormCasts, emptyCast, curseBlock, purifyCurses: purify, cover: attach ? +(ignite / attach).toFixed(2) : null, emptyRate: firestormCasts ? +(emptyCast / firestormCasts * 100).toFixed(1) + '%' : '0%' };
}

const ids = process.argv[2] ? process.argv[2].split(',') : ALLMEM.map(m => m.id);
const out = [];
for (const id of ids) { const r = measure(id, 950000); if (r) out.push(r); }
out.sort((a, b) => (b.attach) - (a.attach));
console.log('packId'.padEnd(22), '贴出', '引燃', '天火次数', '空放', '被挡', '净化', '引燃覆盖I/A');
for (const r of out) console.log(r.packId.padEnd(22), String(r.attach).padStart(3), String(r.ignite).padStart(4), String(r.firestormCasts).padStart(6), String(r.emptyCast).padStart(3), String(r.curseBlock).padStart(3), String(r.purifyCurses).padStart(3), String(r.cover));
const totA = out.reduce((s, r) => s + r.attach, 0), totI = out.reduce((s, r) => s + r.ignite, 0), totE = out.reduce((s, r) => s + r.emptyCast, 0), totC = out.reduce((s, r) => s + r.firestormCasts, 0);
console.log('合计：贴出', totA, '‖ 引燃', totI, '‖ 覆盖', (totA ? (totI / totA).toFixed(2) : '-'), '‖ 空放', totE + '/' + totC, '（R64 后应为 0）');
