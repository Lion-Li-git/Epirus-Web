/* 同口径白防率校准（用户 11-09 裁：「先同口径重量再定线」）
 *
 * 为什么要新写这一份而不是复用现成探针：
 *   · `probe-wasted-play`（promote 那条防御质量栏的产地）写死 `createState('multi', …, 5)` + 攒钱者/热座装配；
 *   · `aggressionProfile`（SEL_CLEAR 的宿主）是 5 席脚本桌、`policyChooserN(params, 0.15)` 即 ε=0，
 *     且场B 四席只出 ジ ⇒ 在那张桌上**任何**包的白防率都是 100%，这条判据在那儿没有分辨力；
 *   · 实机是 8 席 · 长程 5 血 · 困难冠军档（逐席不同枚 + 人类形状替身）⇒ 只有页面那套装配能同口径。
 * 本文件只新建"对局循环"，其余全部走单一来源：
 *   剂量 = Bots.DIFF_TIERS + Bots.tierEpsAt（斜坡现读，不抄字面值）
 *   抽签 = EpirusPoolDraw.rosterFor/compose/rng（与页面同一份、同一个盐）
 *   人类替身 = tools/human-pool.mjs 的 makeMimic
 *   三档判据 = tools/defense-quality.mjs 的 classifyDefenseWindow/defenseQuality
 *   防御键集 = R.byKey 里 cat===DEFENSE && target==='self'（官方 selfGuard，不手抄名单）
 *   窗切法 = probe-wasted-play:100-109 那一份（回合 R 的窗 = [max(ev0 of R), min(ev0 of R+1))）
 *
 * 用法：node scratch/qoder-1109-defq-caliber.mjs [--games=60] [--n=8] [--mode=long] [--tier=lv:hard] [--seed=77000] [--out=<tsv>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, mulberry32, ROOT, rejectUnknownFlags } from '../tools/audit-lib.mjs';
import { loadPool, makeMimic } from '../tools/human-pool.mjs';
import { classifyDefenseWindow, defenseQuality } from '../tools/defense-quality.mjs';

rejectUnknownFlags(process.argv.slice(2), ['games', 'n', 'mode', 'tier', 'seed', 'out'], 'qoder-1109-defq-caliber');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 60)), N = Number(arg('n', 8)), MODE = arg('mode', 'long');
const SEED = Number(arg('seed', 77000)), TIERID = arg('tier', 'lv:hard');
const OUT = join(ROOT, arg('out', 'scratch/qoder-1109-defq-hard-long.tsv'));

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, Bots = W.EpirusBots;
const PD = W.EpirusPoolDraw, POOL = W.EpirusPolicy;
const L = (Bots.DIFF_TIERS || []).find(t => t.id === TIERID);
if (!L) { console.error('⛔ 档不在册：' + TIERID + '（在册 ' + (Bots.DIFF_TIERS || []).map(t => t.id).join(',') + '）'); process.exit(2); }
if (!PD || typeof PD.compose !== 'function') { console.error('⛔ js/pool-draw.js 没进 sandbox ⇒ 没有与页面同一份抽签，本测量作废'); process.exit(2); }
const isDef = (k) => { const d = R.byKey[k]; return !!(d && d.cat === R.CAT.DEFENSE && d.target === 'self'); };
const affordableFirst = (legal) => { const b = (legal || []).filter(l => l && l.affordable); return b.length ? b : [{ key: R.SK.JI, affordable: true }]; };

const PT = join(ROOT, 'champion-map/pool-members.tsv');
const PL = readFileSync(PT, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
const ph = Object.fromEntries(PL[0].split('\t').map((x, i) => [x, i]));
const ALL = [], P = {};
for (const l of PL.slice(1)) {
  const c = l.split('\t'); if (!c[ph.id]) continue;
  const src = readFileSync(join(ROOT, c[ph.path]), 'utf8');
  let m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) m = src.match(/window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/);
  const p = m ? POOL.unpack(JSON.parse(m[1]), true) : null;
  if (!p) { console.error('⛔ 池成员解不开：' + c[ph.id] + '（' + c[ph.path] + '）⇒ 不许少一席继续量'); process.exit(7); }
  P[c[ph.id]] = p; ALL.push({ id: c[ph.id], wid: c[ph.wid], tier: c[ph.tier] });
}
const roster = PD.rosterFor(ALL, L);
if (!roster.members.length) { console.error('⛔ 档 ' + TIERID + ' 的带是空的'); process.exit(2); }
const humanPool = loadPool(W, 'human');

console.log('# 同口径白防率校准 ‖ 档=' + L.id + '（' + L.name + '）剂量现读 eps=' + L.eps + ' k=' + L.epsK + ' mode=' + L.epsMode + ' ramp=' + !!L.ramp);
console.log('# 桌=' + MODE + ' · ' + N + ' 席（1 席人类形状替身 makeMimic + ' + (N - 1) + ' 席池抽）· ' + GAMES + ' 局 · seed=' + SEED);
console.log('# 池真源=' + PT + ' ‖ 该档 roster ' + roster.members.length + ' 枚（' + roster.members.map(m => m.id).join(',') + '）‖ bandW=' + JSON.stringify(roster.bandW));
console.log('# 判据=defense-quality.mjs 单一来源 ‖ 防御键集现读 R.byKey（cat=DEFENSE ∧ target=self）= ' + Object.keys(R.byKey).filter(isDef).join(','));

const agg = {};   // id -> {games, acts, def, eff, part, idle, afterHit, dmg}
let evTotal = 0, defTotal = 0, doseSum = 0, doseN = 0;
const bump = (id) => agg[id] || (agg[id] = { games: 0, acts: 0, def: 0, eff: 0, part: 0, idle: 0, afterHit: 0, dmg: 0 });

for (let g = 0; g < GAMES; g++) {
  const rng = mulberry32(SEED + g * 7919);
  const mrng = mulberry32(SEED + 555 + g * 104729);
  const st = S.createState(MODE, { next: rng }, N);
  st.slotSalt = Math.floor(rng() * 4294967296) >>> 0;
  const refSeat = g % N;
  const mimic = makeMimic(W, humanPool, 'rand', mrng);
  const comp = PD.compose(roster.members, N - 1, PD.rng(st.slotSalt >>> 0), undefined, roster.bandW);
  if (comp.allSame && N - 1 > 1) { console.error('⛔ 抽出全同（salt=' + st.slotSalt + '）⇒ 违反裁定③，本局作废'); process.exit(2); }
  const seatId = {}; let k = 0;
  const DEC = [];
  const cs = [];
  for (let pid = 0; pid < N; pid++) {
    if (pid === refSeat) { seatId[pid] = null; cs.push(mimic); continue; }
    const s = comp.seats[k++];
    if (s.kind !== 'pack') { console.error('⛔ 困难档抽出脚本席（' + s.kind + '）⇒ 与实机口径不符，本测量作废'); process.exit(2); }
    seatId[pid] = s.id;
    const params = P[s.id];
    cs.push(function (state, p, legal) {
      const e = Bots.tierEpsAt(L, state.p.length, state.round);
      doseSum += e; doseN++;
      const pick = T.pickChampion(state, p, affordableFirst(legal), params, 0.15, e, L.epsK, L.epsMode);
      if (pick && pick.key) DEC.push({ rd: state.round, pid: p, key: pick.key, ev0: state.events.length });
      return pick;
    });
  }
  for (const id of Object.values(seatId)) if (id) bump(id).games++;
  Play.autoGameN(st, cs);
  const ev = st.events || [];
  evTotal += ev.length;
  /* 窗切法照抄 probe-wasted-play:100-109 */
  const byRound = new Map();
  for (const d of DEC) { if (!byRound.has(d.rd)) byRound.set(d.rd, []); byRound.get(d.rd).push(d); }
  const rds = [...byRound.keys()].sort((a, b) => a - b);
  const winEnd = {};
  for (let i = 0; i < rds.length; i++) winEnd[rds[i]] = i + 1 < rds.length ? Math.min.apply(null, byRound.get(rds[i + 1]).map(d => d.ev0)) : ev.length;
  const startOf = (r) => Math.max.apply(null, byRound.get(r).map(d => d.ev0));
  const prevHit = {};
  for (const r of rds) {
    const w = ev.slice(startOf(r), winEnd[r]);
    for (const d of DEC.filter(x => x.rd === r)) {
      const id = seatId[d.pid]; if (!id) continue;
      const A = bump(id); A.acts++;
      const taken = w.filter(e => e.type === 'damage' && e.to === d.pid && e.source != null && e.source !== d.pid && R.byKey[e.via]).reduce((s, e) => s + e.amt, 0);
      A.dmg += taken;
      if (isDef(d.key)) {
        A.def++; defTotal++;
        if (prevHit[d.pid]) A.afterHit++;
        const kind = classifyDefenseWindow(w, R, d.pid);
        A[kind === 'eff' ? 'eff' : kind === 'part' ? 'part' : 'idle']++;
      }
      prevHit[d.pid] = taken > 0;
    }
  }
}

if (!evTotal || !defTotal) {
  console.error('⛔ 自检失败：' + GAMES + ' 局读到 ' + evTotal + ' 条事件、' + defTotal + ' 手防御 ⇒ 整列 0 不是"防得准"，是仪器没接上。本测量作废。');
  process.exit(2);
}
const rows = [];
console.log('\n包'.padEnd(16) + '局  出手  防御手  白防  有效  穿透  被打后守  白防率  质量  承伤/局');
for (const [id, A] of Object.entries(agg).sort((a, b) => b[1].def - a[1].def)) {
  const q = defenseQuality(A);
  const bai = A.def ? 100 * A.idle / A.def : NaN;
  console.log(id.padEnd(16) + String(A.games).padStart(3) + String(A.acts).padStart(6) + String(A.def).padStart(7) +
    String(A.idle).padStart(6) + String(A.eff).padStart(6) + String(A.part).padStart(6) + String(A.afterHit).padStart(8) +
    (isFinite(bai) ? bai.toFixed(1) + '%' : '—').padStart(8) + (isFinite(q.q) ? (100 * q.q).toFixed(1) + '%' : '—').padStart(7) +
    (A.dmg / Math.max(1, A.games)).toFixed(2).padStart(8));
  rows.push([id, A.games, A.acts, A.def, A.idle, A.eff, A.part, A.afterHit, isFinite(bai) ? bai.toFixed(2) : '', isFinite(q.q) ? (100 * q.q).toFixed(2) : '', (A.dmg / Math.max(1, A.games)).toFixed(3)].join('\t'));
}
const bs = Object.values(agg).filter(A => A.def > 0).map(A => 100 * A.idle / A.def).sort((a, b) => a - b);
const at = (p) => bs.length ? bs[Math.min(bs.length - 1, Math.floor(p * bs.length))] : NaN;
console.log('\n# 白防率分布（只数有防御手的 ' + bs.length + ' 枚；零防手 ' + (Object.keys(agg).length - bs.length) + ' 枚**不进分布**，不许按 0 或 100 处理）：' +
  'min=' + at(0).toFixed(1) + '% p25=' + at(0.25).toFixed(1) + '% 中位=' + at(0.5).toFixed(1) + '% p75=' + at(0.75).toFixed(1) + '% max=' + at(0.999).toFixed(1) + '%');
console.log('# 合计 ' + defTotal + ' 手防御 ‖ 事件 ' + evTotal + ' 条 ‖ 实际生效剂量均值 ε=' + (doseSum / Math.max(1, doseN)).toFixed(4) + '（' + doseN + ' 次决策；斜坡有没有落地看这一行）');
writeFileSync(OUT, ['id\tgames\tacts\tdef\tidle\teff\tpart\tafterHit\twhitePct\tqualityPct\tdmgPerGame', ...rows].join('\n') + '\n');
console.log('# 写 ' + OUT);