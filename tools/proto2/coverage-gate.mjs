/* coverage-gate.mjs — 覆盖门：把「新网络对旧版本完全覆盖」变成可跑的门（ZCode · 11-02 深夜，PLAN-2026-11-02-NIGHT §一.3/Phase 1）
 *
 * 用法: node tools/proto2/coverage-gate.mjs --packs=a.js,b.bak[,js/bundled-champion-3p.js] [--games=20] [--np=5,8]
 *
 * 量什么：每个包 × 三张探针桌（5P long 原生 ‖ 8P long ‖ 5P long 残血开局 HP=2）× ε=0：
 *   - 逐技能 菜单率/自选数/非ジ份额（防御族聚合为 DEF）
 *   - 防御质量：在册单一来源 tools/defense-quality.mjs 的 classifyDefenseWindow（有效/半/白防）——
 *     量的是「那次防御决策之后到下一次决策之间」的窗口，与白班 pool-defense-census 同一接法
 * 判带（写死于 COVERAGE_BANDS，改带 = 改这里的常数并记档，别事后挑）：
 *   主干六键（gun/sword/charge/ring/bigT/railgun）：自选 > 0
 *   防御原型：DEF 份额 ∈ [5%,15%] ∧ 有效+半 ≥ 25%（千问 §十四 验收带）
 *   地雷：8P 桌自选 ≥ 0.2/局（用户裁：5P+ 高性价比威慑卡）
 *   摄魂：残血桌自选 ≥ 0.2/局（自保回血定位）
 *   坦克/狙击：自选 > 0
 *   双枪/连招族（贴贴/藤甲/挑衅/转移/全息/镜面）：**只报不判**（用例/时机依赖，今晚不设带）
 * 池级读法：--packs 给一串 = 一个候选池 ⇒ 覆盖按**池内并集**判（v7 的多风格本来就是池给的）。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { classifyDefenseWindow } from '../defense-quality.mjs';

const ARGV = process.argv.slice(2).filter((a) => !/^--/.test(a));
const FLAG = {};
for (const a of process.argv.slice(2)) { const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a); if (m) FLAG[m[1]] = m[2] === '' ? '1' : m[2]; }
const GAMES = Number(FLAG.games || 20) || 20;
const PACKS = (FLAG.packs || 'js/bundled-champion-3p.js').split(',').map((s) => s.trim()).filter(Boolean);
const NPS = (FLAG.np || '5,8').split(',').map((x) => Number(x)).filter((x) => x >= 2);

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Float64Array, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const W = sb.window, T = W.EpirusTrainer, P = W.EpirusPolicy, R = W.EpirusRules;
const { install, packCfgExit } = await import('./arch2.mjs');
T.setBigTPush(0); T.setDrainPush(0); T.setCursePush(0); T.setSupportPrior(0);   /* 干预全关口径 */

function loadPackParams(p) {
  const src = readFileSync(p, 'utf8');
  const at = src.indexOf('EPIRUS_CHAMPION_3P ');
  if (at < 0) throw new Error('没有 EPIRUS_CHAMPION_3P 外壳');
  let d = 0, inS = false, esc = false, end = -1;
  for (let k = src.indexOf('{', at); k < src.length; k++) { const c = src[k];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') { inS = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = k; break; } } }
  const raw = JSON.parse(src.slice(src.indexOf('{', at), end + 1));
  if (raw.v === 7 || (raw.a && raw.v == null)) return { params: Float64Array.from(raw.a), v7: true, cfg: null };
  const got = packCfgExit(raw, p);
  install(W, got.cfg);
  if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
  return { params: Float64Array.from(P.unpack(raw, true)), v7: false, cfg: got.cfg };
}

const DEFSET = new Set(['guard', 'reflect', 'bagua', 'shift', 'jinshield', 'proto', 'armor', 'holo']);
const BANDS = {
  trunk: ['gun', 'sword', 'charge', 'ring', 'bigT', 'railgun'],
  defLo: 5, defHi: 15, defAcc: 25,
  mine8: 0.2, drainLow: 0.2,
  reportOnly: ['dualgun', 'mirror', 'curse', 'firestorm', 'taunt', 'transfer', 'mine', 'drain', 'cannon', 'tank', 'snipe', 'rod', 'purify', 'minit']
};

function probe(params, N, mode, hpStart, games) {
  const ch = T.policyChooserN(Float64Array.from(params), 0.15);
  const menu = {}, sel = {}, acts = { n: 0, def: 0, eff: 0, part: 0, idle: 0 };
  let rounds = 0, wins = 0, cursor, pend;
  for (let g = 0; g < games; g++) {
    const st = W.EpirusState.createState(mode, { next: T.mulberry32(77000 + g) }, N);
    if (hpStart) for (const q of st.p) if (q && q.hp > 0) q.hp = Math.min(hpStart, (st.mode && st.mode.hp) || 3);
    cursor = undefined; pend = null;
    const choosers = [];
    for (let pid = 0; pid < N; pid++) {
      choosers.push(pid === 0 ? function (state, pid, legal) {
        const evs = state.events || [];
        for (const l of legal) if (l && l.affordable) menu[l.key] = (menu[l.key] || 0) + 1;
        if (pend) { const c = classifyDefenseWindow(evs.slice(pend.cur), R, pid); acts[c] = (acts[c] || 0) + 1; pend = null; }
        const a = ch(state, pid, legal);
        const k = (a && typeof a === 'object') ? (a.key || '') : String(a);
        if (DEFSET.has(k)) { acts.def++; pend = { cur: evs.length }; }
        acts.n++;
        sel[k] = (sel[k] || 0) + 1;
        return a;
      } : W.EpirusBots.pickRandom);
    }
    W.EpirusPlay.autoGameN(st, choosers);
    rounds += st.round;
    if (st.winner === 0) wins++;
  }
  return { menu, sel, acts, rounds: rounds / games, wins: 100 * wins / games };
}

const rows = [];
for (const p of PACKS) {
  let pack;
  try { pack = loadPackParams(p); } catch (e) { console.log('⛔ ' + p + '：' + e.message); continue; }
  const name = p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  const native = probe(pack.params, 5, 'long', 0, GAMES);
  const w8 = NPS.includes(8) ? probe(pack.params, 8, 'long', 0, GAMES) : null;
  const low = probe(pack.params, 5, 'long', 2, GAMES);
  const tot = native.acts.n || 1;
  const defShare = 100 * (native.sel.guard || 0) / tot;   /* 防御族聚合份额 */
  let defSum = 0; for (const k of DEFSET) defSum += native.sel[k] || 0;
  const defShare2 = 100 * defSum / tot;
  const defDec = native.acts.eff + native.acts.part + native.acts.idle;
  const acc = defDec ? 100 * (native.acts.eff + native.acts.part) / defDec : null;
  rows.push({ name, native, w8, low, defShare2, acc, pack });
  console.log('== ' + name + (pack.v7 ? '（v7）' : '（gen-3）') + ' ‖ 5P long ×' + GAMES + ' ‖ 胜 ' + native.wins.toFixed(0) + '% ‖ 局长 ' + native.rounds.toFixed(1));
  console.log('   自选: ' + Object.keys(native.sel).sort((a, b) => native.sel[b] - native.sel[a]).map((k) => k + '=' + native.sel[k]).join(' '));
  console.log('   防御族份额 ' + defShare2.toFixed(1) + '% ‖ 质量判定 ' + defDec + ' 次（有效 ' + (native.acts.eff || 0) + ' 半 ' + (native.acts.part || 0) + ' 白防 ' + (native.acts.idle || 0) + '）' + (acc != null ? ' ⇒ 准确 ' + acc.toFixed(0) + '%' : ''));
  if (w8) console.log('   8P long: mine 菜单=' + (w8.menu[R.SK.MINE] || 0) + ' 自选=' + (w8.sel[R.SK.MINE] || 0) + ' ‖ dualGun 菜单=' + (w8.menu[R.SK.DUAL_GUN] || 0) + ' 自选=' + (w8.sel[R.SK.DUAL_GUN] || 0) + ' ‖ 胜 ' + w8.wins.toFixed(0) + '%');
  console.log('   残血开局: drain 自选 ' + (low.sel[R.SK.DRAIN] || 0) + ' ‖ 胜 ' + low.wins.toFixed(0) + '%');
}

/* 判带（池级并集 + 单包明细） */
console.log('\n### 覆盖门判定（池级 = --packs 并集）');
const union = {};
for (const r of rows) for (const k in r.native.sel) union[k] = (union[k] || 0) + r.native.sel[k];
const u8 = {}; for (const r of rows) if (r.w8) for (const k in r.w8.sel) u8[k] = (u8[k] || 0) + r.w8.sel[k];
const ulow = {}; for (const r of rows) for (const k in r.low.sel) ulow[k] = (ulow[k] || 0) + r.low.sel[k];
const defUnion = rows.reduce((s, r) => s + r.defShare2 * (r.native.acts.n || 1), 0) / rows.reduce((s, r) => s + (r.native.acts.n || 1), 0);
const accU = rows.filter((r) => r.acc != null);
/* 池级防御原型 = **存在性**判（v7 池也是成员制：11/30 ≥5%），不是加权均值——0% 成员多会把带内成员摊没。 */
const defMember = rows.find((r) => r.defShare2 >= BANDS.defLo && r.defShare2 <= BANDS.defHi && r.acc != null && r.acc >= BANDS.defAcc);
const defMax = rows.reduce((m, r) => Math.max(m, r.defShare2), 0);
function line(label, ok, detail) { console.log('  ' + (ok ? '✔' : '✘') + ' ' + label + ' ‖ ' + detail); }
for (const k of BANDS.trunk) line('主干 ' + k, (union[k] || 0) > 0, '自选 ' + (union[k] || 0));
const defOk = !!defMember;
line('防御原型（存在成员：份额 ' + BANDS.defLo + '-' + BANDS.defHi + '% ∧ 准确 ≥' + BANDS.defAcc + '%）', defOk,
  '最高份额 ' + defMax.toFixed(1) + '% ‖ 池加权 ' + defUnion.toFixed(1) + '% ‖ 带内成员 ' + (defMember ? defMember.name : '无') + '（准确 ' + (defMember ? defMember.acc.toFixed(0) + '%' : '—') + '）');
line('地雷（8P 自选 ≥' + BANDS.mine8 * GAMES * NPS.includes(8) + '）', (u8[R.SK.MINE] || 0) >= BANDS.mine8 * GAMES, '8P 自选 ' + (u8[R.SK.MINE] || 0));
line('摄魂（残血桌自选 ≥' + BANDS.drainLow * GAMES + '）', (ulow[R.SK.DRAIN] || 0) >= BANDS.drainLow * GAMES, '自选 ' + (ulow[R.SK.DRAIN] || 0));
for (const k of ['tank', 'snipe']) line('自发 ' + k, (union[k] || 0) > 0 || (u8[k] || 0) > 0, '5P ' + (union[k] || 0) + ' / 8P ' + (u8[k] || 0));
console.log('  － 只报不判：' + BANDS.reportOnly.map((k) => k + '=' + ((union[k] || 0) + (u8[k] || 0) + (ulow[k] || 0))).join(' '));
