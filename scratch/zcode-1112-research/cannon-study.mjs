#!/usr/bin/env node
/* 过载炮平衡研究（只读量具，不落任何默认值）：pierce:{defense,reflect} 该不该留。
 * 对照系（用户框架）：第1段 2ジ打1，同类 = 激光剑/坦克/狙击；炮的独有物 = pri3 + B2 反制 + 三阶段循环 + 第3段清 ep。
 * 格：A 架势经济表 ‖ C 墙局（pierce 开/关配对）‖ B 单卡镜像对打 ‖ E 相位价值（真实装配 5P）。
 * 用法：node scratch/zcode-1112-research/cannon-study.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const CORE = ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/policy.js', 'js/train/policy2.js', 'js/train/bots.js', 'js/train/evo.js', 'js/train/trainer.js', 'js/pool-draw.js'];

function loadSandbox(patchPierce) {
  const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
  sb.globalThis = sb;
  /* 沙箱 Math 播种（diag.mjs 同式）：policy 采样有全局随机面 ⇒ 不播则两臂不可配对 */
  const M = Object.create(Math);
  let s = (patchPierce ? 20261113 : 20261112) >>> 0 || 1;
  M.random = function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return t;
  };
  sb.Math = M;
  for (const f of CORE) {
    let txt = readFileSync(join(ROOT, f), 'utf8');
    if (patchPierce && f === 'js/core/resolve.js') {
      const hits = (txt.match(/pierce: \{ defense: true, reflect: true \}/g) || []).length;
      if (hits !== 2) throw new Error('补丁锚数量不对（实测 ' + hits + '，应为 2：CANNON 直击 + 镜面复制）');
      txt = txt.split('pierce: { defense: true, reflect: true }').join('pierce: {}');
    }
    vm.runInNewContext(txt, sb, { filename: f });
  }
  return sb.window;
}

function mulberry32(a) {
  const f = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next: f };
}

function makeCtx(sb) {
  const R = sb.EpirusRules, S = sb.EpirusState, Play = sb.EpirusPlay, B = sb.EpirusBots, T = sb.EpirusTrainer, PD = sb.EpirusPoolDraw, P = sb.EpirusPolicy;
  const cardBot = (key) => function (st, pid, legal) {
    const l = (legal || []).find(x => x.key === key && x.affordable);
    return l ? { key } : { key: R.SK.JI };
  };
  function batch(label, c0, c1, games, seed0, regen) {
    let dealt = 0, taken = 0, clears = 0, w = 0, d = 0, l = 0, rounds = 0;
    for (let g = 0; g < games; g++) {
      const st = S.createState('standard', mulberry32((seed0 + g * 7919) >>> 0), 2, { regen: regen == null ? 2 : regen });
      st.slotSalt = (seed0 + g * 7919) >>> 0;
      Play.autoGameN(st, [c0, c1], null, null);
      for (const e of st.events) {
        if (e.type === 'damage' && e.source === 0 && e.amt > 0 && e.to !== 0) dealt += e.amt;
        if (e.type === 'damage' && e.to === 0 && e.amt > 0 && e.source != null && e.source !== 0) taken += e.amt;
        if (e.type === 'ep' && e.pid !== 0 && e.delta < 0 && String(e.reason || '').includes('过载炮')) clears += -e.delta;
      }
      rounds += st.round;
      if (st.winner === 0) w++; else if (st.winner === 'draw') d++; else l++;
    }
    return { label, dealt: dealt / games, taken: taken / games, clears: clears / games, w, d, l, rounds: rounds / games, games };
  }
  return { R, S, Play, B, T, PD, P, cardBot, batch };
}

const ctxOn = makeCtx(loadSandbox(false));
const ctxOff = makeCtx(loadSandbox(true));

/* ===== A. 架势经济表 ===== */
console.log('## A. 架势经济表（1v1 · regen=2 · 150 局/格 · 造伤/局 = 落在对手身上的伤）');
console.log('卡＼架势          造伤/局(饱和于3)                    | 自受/局均  密度[伤/回合]（无防/防/反/八/原/金）');
const stances = [['无防', null], ['防御', 'guard'], ['反弹', 'reflect'], ['八卦', 'bagua'], ['原型', 'proto'], ['金刚盾', 'jinshield']];
function econRow(ctx, cn, ck) {
  const row = [cn.padEnd(12)];
  let takenAvg = 0, dens = [];
  let i = 0;
  for (const [sn, sk] of stances) {
    const opp = sk ? ctx.cardBot(ctx.R.SK[sk.toUpperCase()]) : ctx.cardBot(ctx.R.SK.JI);
    const r = ctx.batch('', ctx.cardBot(ck), opp, 150, 4100 + i * 977);
    dens.push((r.dealt / Math.max(1, r.rounds)).toFixed(2));
    row.push(r.dealt.toFixed(2).padStart(5));
    takenAvg += r.taken;
    i++;
  }
  row.push('  |  ' + (takenAvg / stances.length).toFixed(2) + '  密度[伤/回合] ' + dens.join('/'));
  console.log(row.join(''));
}
econRow(ctxOn, '炮(pierce现状)', ctxOn.R.SK.CANNON);
econRow(ctxOff, '炮(无pierce)', ctxOff.R.SK.CANNON);
econRow(ctxOn, '激光剑', ctxOn.R.SK.SWORD);
econRow(ctxOn, '坦克', ctxOn.R.SK.TANK);
econRow(ctxOn, '狙击枪', ctxOn.R.SK.SNIPE);

/* ===== C. 墙局（永不还手 ⇒ 反制不触发，纯量 pierce）===== */
console.log('\n## C. 墙局（100 局/格 · regen=2 · 同种子两臂）');
for (const [wn, bot] of [['只防御', ctxOn.B.pickDefend], ['只反弹', ctxOn.B.pickReflectSpam]]) {
  for (const [tag, ctx] of [['pierce开', ctxOn], ['pierce关', ctxOff]]) {
    const r = ctx.batch('', ctx.cardBot(ctx.R.SK.CANNON), bot, 100, 5200 + wn.length * 17);
    console.log(('炮 vs ' + wn + '（' + tag + '）').padEnd(26) + ' 胜' + String(r.w).padStart(3) + ' 平' + String(r.d).padStart(3) + ' 负' + String(r.l).padStart(3) + '  造伤/局 ' + r.dealt.toFixed(2) + '  回合 ' + r.rounds.toFixed(1));
  }
}

/* ===== B. 单卡镜像对打 ===== */
console.log('\n## B. 单卡镜像对打（150 局/格 · 两席各只出该卡 · regen=2）');
function duelRow(ctx, label, k0, k1, games, seed0) {
  const r = ctx.batch(label, ctx.cardBot(k0), ctx.cardBot(k1), games, seed0);
  console.log(label.padEnd(24) + ' 胜' + String(r.w).padStart(3) + ' 平' + String(r.d).padStart(3) + ' 负' + String(r.l).padStart(3) + '  造伤/局 ' + r.dealt.toFixed(2) + '  密度 ' + (r.dealt / Math.max(1, r.rounds)).toFixed(2) + '/回合 × ' + r.rounds.toFixed(1) + '回合  自受/局 ' + r.taken.toFixed(2) + '  清ep/局 ' + r.clears.toFixed(2));
}
for (const [en, ek] of [['激光剑', 'SWORD'], ['坦克', 'TANK'], ['狙击枪', 'SNIPE'], ['枪(反制对照)', 'GUN'], ['防御墙', 'GUARD'], ['八卦墙', 'BAGUA'], ['原型墙', 'PROTO']]) {
  duelRow(ctxOn, '炮(pierce) vs ' + en, ctxOn.R.SK.CANNON, ctxOn.R.SK[ek], 150, 6100 + en.length * 31);
  duelRow(ctxOff, '炮(无pierce) vs ' + en, ctxOff.R.SK.CANNON, ctxOff.R.SK[ek], 150, 6100 + en.length * 31);
}
duelRow(ctxOn, '对照：激光剑 vs 枪', ctxOn.R.SK.SWORD, ctxOn.R.SK.GUN, 150, 7100);
duelRow(ctxOn, '对照：坦克 vs 枪', ctxOn.R.SK.TANK, ctxOn.R.SK.GUN, 150, 7101);
duelRow(ctxOn, '对照：狙击 vs 枪', ctxOn.R.SK.SNIPE, ctxOn.R.SK.GUN, 150, 7102);

/* ===== E. 相位价值：真实装配 5P（2×st:toolkit 脚本席 + 3×soft 带包）===== */
console.log('\n## E. 相位价值（5P multi · 2×st:toolkit + 3×soft带包 · 60 局 · ε=0.2）');
{
  const { R, S, Play, T, B: B2, P } = ctxOn;
  const L = readFileSync(join(ROOT, 'champion-map/data/page/pool-members.tsv'), 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
  const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
  const soft = L.slice(1).map(l => { const c = l.split('\t'); return { id: c[h.id], wid: c[h.wid], path: c[h.path], tier: c[h.tier] }; }).filter(r => r.tier === 'soft');
  const tk = (B2.STYLES || []).find(x => x.id === 'st:toolkit');
  if (!tk) throw new Error('st:toolkit 不在 STYLES');
  function loadParams(row) {
    const src = readFileSync(join(ROOT, row.path), 'utf8');
    const m = /EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src) || /(?:^|\n)[\w.]*EPIRUS_CHAMPION(?!_3P|_META)\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
    if (!m) throw new Error('读不出包 ' + row.id);
    return P.unpack(JSON.parse(m[1]), true);
  }
  const packCache = new Map();
  const GAMES = 60;
  const phases = { 1: 0, 2: 0, 3: 0 };
  let cannonActs = 0, epClearAmt = 0, epClearN = 0, dmgByCannon = 0, gamesWithCannon = 0, cannonVoided = 0;
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', mulberry32((8800 + g * 7919) >>> 0), 5);
    st.slotSalt = (8800 + g * 2246822519) >>> 0;
    const choosers = [0, 1, 2].map(i => {
      const row = soft[(g + i) % soft.length];
      if (!packCache.has(row.id)) packCache.set(row.id, loadParams(row));
      return T.policyChooserN(packCache.get(row.id), { eps: 0.2 });
    });
    choosers.push(tk.pick); choosers.push(tk.pick);
    Play.autoGameN(st, choosers, null, null);
    let had = false;
    for (const e of st.events) {
      if (e.type === 'action' && e.outcome === 'ok' && e.key === R.SK.CANNON) { cannonActs++; had = true; }
      if (e.type === 'voided' && e.voids === R.SK.CANNON) cannonVoided++;
      const mReason = e.type === 'damage' && /过载炮\(第(\d)次\)/.exec(String(e.reason || ''));
      if (mReason) { phases[Number(mReason[1])] = (phases[Number(mReason[1])] || 0) + 1; if (e.source != null && e.to != null && e.amt > 0) dmgByCannon += e.amt; }
      if (e.type === 'ep' && e.delta < 0 && String(e.reason || '').includes('过载炮')) { epClearN++; epClearAmt += -e.delta; }
    }
    if (had) gamesWithCannon++;
  }
  console.log('炮成功出手 ' + cannonActs + ' 次（' + gamesWithCannon + '/' + GAMES + ' 局有炮）‖ 被反制作废 ' + cannonVoided + ' 次' +
    ' ‖ 相位分布 1段:' + phases[1] + ' 2段:' + phases[2] + ' 3段:' + phases[3] +
    ' ‖ 炮造伤合计 ' + dmgByCannon + ' ‖ 清ep ' + epClearN + ' 次共 ' + epClearAmt + ' ジ（均 ' + (epClearN ? (epClearAmt / epClearN).toFixed(1) : '0') + '/次）');
}
console.log('\n# done');
