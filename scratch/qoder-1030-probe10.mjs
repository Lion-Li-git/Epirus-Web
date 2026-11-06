/* 只读探针 10：obs3 210 维的**可达性**与**频率**分开量（probe2 把两件事混了，且采样被上限压在前几局）
   ① 构造夹具：2P/3P 里逼出"挑衅义务""符咒""地雷""过载炮""聚能环""铁索" ⇒ 逐维给存在性证明
   ② 均衡扫描：每桌形若干局、每个决策都采（每决策至多 4 枚候选），按决策数封顶而非编码数封顶 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import * as O3 from '../tools/proto2/obs3.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
const M = O3.blocks(R); const D = M.length;
let seed = 31337;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function cancelOtherLocal(state, pid) {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) return e.pids[0] === pid ? e.pids[1] : e.pids[0];
  }
  return null;
}
const fixed = (key) => function (state, pid, legal) {
  const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || [];
  if (!cs.length) return { key: R.SK.JI };
  for (const c of cs) if (c.key === key) return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
  const ji = cs.filter((c) => c.key === R.SK.JI)[0]; return ji ? { key: ji.key, bead: null } : cs[0];
};

/* ---------- ① 构造夹具 ---------- */
console.log('=== ① 存在性证明（每行=一个夹具，看它把哪些维点亮）===');
const iOf = (nm) => M.findIndex((x) => x.name === nm);
const watch = ['self.tauntActive', 'rel.mustHit', 'rel.tauntsMe', 'rel.chained', 'rel.mirroredMe', 'rel.targetedMe',
  'self.stickers', 'self.stickerMaxAge', 'pool.sumStickers', 'self.mineTurns', 'self.cannonCount', 'self.ringStreak',
  'self.rodGuard', 'self.baguaExtra', 'self.fireWeakNow', 'self.nightmare', 'self.vampire', 'self.infiniteEnergy',
  'self.ownElecX', 'ownElec', 'ownBoom', 'self.nightmareX'];
function fixture(tag, n, keysBySeat, modeKey) {
  const st = S.createState(modeKey || 'multi', { next: rng }, n);
  st.rng = { next: rng };
  const lit = new Set(); let dec = 0;
  const ch = [];
  for (let pid = 0; pid < n; pid++) {
    const sel = fixed(keysBySeat[pid] || 'ji');
    ch.push((s, p, legal) => {
      const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: cancelOtherLocal(s, p) }) || [];
      const probe = cs[0] || { key: R.SK.JI };
      const v = O3.encode(W, s, p, probe);
      dec++;
      for (let i = 0; i < D; i++) if (v[i] !== 0) lit.add(M[i].name);
      return sel(s, p, legal);
    });
  }
  try { Play.autoGameN(st, ch); } catch (e) { console.log('  ' + tag + ' 抛：' + String(e.message).slice(0, 60)); return; }
  const shown = watch.filter((nm) => lit.has(nm));
  console.log('  ' + tag.padEnd(30) + ' 决策 ' + String(dec).padStart(4) + ' ‖ 点亮: ' + (shown.length ? shown.join(' ') : '（关注维一个都没亮）'));
}
fixture('1挑1被挑（3P）', 3, { 0: 'taunt', 1: 'gun', 2: 'ji' });
fixture('被挑+被打（3P）', 3, { 0: 'gun', 1: 'taunt', 2: 'gun' });
fixture('贴贴+天火（3P）', 3, { 0: 'curse', 1: 'firestorm', 2: 'gun' });
fixture('埋雷+踩（3P）', 3, { 0: 'mine', 1: 'gun', 2: 'rod' });
fixture('过载炮连开（2P）', 2, { 0: 'cannon', 1: 'ji' });
fixture('聚能环连开（2P）', 2, { 0: 'ring', 1: 'ji' });
fixture('八卦+防御（3P）', 3, { 0: 'bagua', 1: 'gun', 2: 'guard' });
fixture('蓄能+电磁炮（3P）', 3, { 0: 'charge', 1: 'railgun', 2: 'ji' });
fixture('蓄能+激光眼（3P）', 3, { 0: 'boom' ? 'charge' : 'charge', 1: 'laserEye', 2: 'ji' });
fixture('镜面反射（4P）', 4, { 0: 'mirror', 1: 'gun', 2: 'gun', 3: 'ji' });
fixture('双枪射手（4P）', 4, { 0: 'dualGun', 1: 'gun', 2: 'ji', 3: 'ji' });
fixture('摄魂对拍（3P·铁索）', 3, { 0: 'drain', 1: 'drain', 2: 'ji' }, 'long');
fixture('挑衅+反弹（3P）', 3, { 0: 'taunt', 1: 'reflect', 2: 'gun' });

/* ---------- ② 均衡频率扫描 ---------- */
console.log('\n=== ② 均衡扫描（每决策都采，按决策数封顶）===');
const shapes = [{ n: 2, m: 'multi' }, { n: 2, m: 'long' }, { n: 3, m: 'multi4' }, { n: 5, m: 'multi' }, { n: 5, m: 'long' }, { n: 8, m: 'multi' }, { n: 10, m: 'multi' }];
const forceKeys = ['ji', 'gun', 'guard', 'reflect', 'taunt', 'mine', 'curse', 'firestorm', 'cannon', 'ring', 'charge', 'railgun', 'laserEye', 'bagua', 'proto', 'holo', 'drain', 'mirror', 'dualGun', 'snipe', 'tank', 'sword', 'armor', 'shift', 'jinshield', 'rod', 'miniT', 'bigT', 'transfer', 'purify'];
const nz = new Array(D).fill(0);
let decisions = 0;
const perShape = {};
for (const shape of shapes) {
  let sd = 0;
  for (let g = 0; g < 6; g++) {
    const st = S.createState(shape.m, { next: rng }, shape.n);
    st.rng = { next: rng };
    const ch = [];
    for (let pid = 0; pid < shape.n; pid++) {
      const key = forceKeys[(g * 3 + pid * 5) % forceKeys.length];
      const sel = R.skills.some((s) => s.key === key) ? fixed(key) : fixed('ji');
      ch.push((s, p, legal) => {
        const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: cancelOtherLocal(s, p) }) || [];
        for (let k = 0; k < Math.min(4, cs.length); k++) {
          const v = O3.encode(W, s, p, cs[k]);
          for (let i = 0; i < D; i++) if (v[i] !== 0) nz[i]++;
        }
        decisions++; sd++;
        return sel(s, p, legal);
      });
    }
    try { Play.autoGameN(st, ch); } catch (e) { /* 桌形造不出某些手就跳过 */ }
  }
  perShape[shape.n + ':' + shape.m] = sd;
}
console.log('  决策总数=' + decisions + ' ‖ 按桌形：' + Object.entries(perShape).map(([k, v]) => k + '=' + v).join(' '));
const never = [], rare = [];
for (let i = 0; i < D; i++) { const r = nz[i] / decisions; if (nz[i] === 0) never.push(M[i].name); else if (r < 0.01) rare.push(M[i].name + ' ' + (100 * r).toFixed(1) + '%'); }
const byB = {};
for (const nm of never) byB[M.find((x) => x.name === nm).block] = (byB[M.find((x) => x.name === nm).block] || []).concat(nm);
console.log('  全扫描仍为 0 的维（' + never.length + '/' + D + '）：');
for (const b of Object.keys(byB)) console.log('    [' + b + '] ' + byB[b].join(' ‖ '));
console.log('  出现率 <1% 的维（' + rare.length + '）：' + rare.join(' ‖ '));
