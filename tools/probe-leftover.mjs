/* 判据量具（v1.5.116 · 第三方复核者）：一条命令读出"资源线"三条判据
 *   ① 终局**人均余 ep**（arm A 现值：multi 38.7 / long 86.3 —— 病灶就是它）
 *   ② **出手 / 回合**（花得出去吗）与其中 cost≥2 的占比
 *   ③ ep 直方 + 峰 ep + 环可负担点占比 + 实际打环数（顺带把 §1/§2 那两条一起复现）
 * 全部走 5 席自对局（同一策略填五席），所以 ② 是"这个包在自己造的环境里花钱的意愿"，
 * 不受对手脚本干扰；对照必须是**同 mode 同 seed 同盐**。
 * 用法：node tools/probe-leftover.mjs [GAMES=60] [包...（默认线上包）]
 *   例：node tools/probe-leftover.mjs 60 js/bundled-champion-3p.js docs/artifacts/v7l2c-31.bak
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const REPO = process.env.EPIRUS_REPO || './';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, A = R.SK;
const argv = process.argv.slice(2);
const N = Number(argv[0] && /^\d+$/.test(argv[0]) ? argv.shift() : 60);
const FILES = argv.length ? argv : ['js/bundled-champion-3p.js'];
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function load(f) {
  const src = readFileSync(REPO + f, 'utf8');
  if (f.includes('bundled')) { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src); return P.unpack(JSON.parse(m[1]), true); }
  return P.loadAny(JSON.parse(src.slice(src.indexOf('{"v":'), src.lastIndexOf('}') + 1))).params;
}
const COST = {}; for (const k in R.byKey) COST[k] = (typeof R.byKey[k].cost === 'number' ? R.byKey[k].cost : null);
console.log(`=== 资源线判据（${N} 局 5 席自对局 · 同 seed 同盐 · multi 与 long 各一遍）===`);
for (const f of FILES) {
  let params; try { params = load(f); } catch (e) { console.log(`  跳过 ${f}：${e.message}`); continue; }
  const inner = T.policyChooserN(params, 0.15);
  const nm = f.split('/').pop().replace('.bak', '').replace('bundled-champion-3p.js', '线上包');
  for (const mode of ['multi', 'long']) {
    const hist = {}; let dec = 0, ge3 = 0, ring = 0, peak = 0, left = 0, casts = 0, heavy = 0, rounds = 0, epGain = 0, epLost = 0;
    /* L2′-① 的死因量具：囤积惩罚的自变量换成**终局余款**后，惩罚只在 `leftEp > C` 才非零
     * （C = 该模式的 ep 上限：3 血 10 / 5 血 20）⇒ 必须量"终局余款越过 C"的**触发率**。
     * 实测：seed 91 开这个开关训出来的包与对照**逐位相同** ⇒ 触发率恒 0，是字面意义的空操作。 */
    const C_CAP = mode === 'long' ? 20 : 10;
    let endTot = 0, endGT = 0, endMax = 0, endSum = 0, endGE3 = 0;
    const cs = []; for (let i = 0; i < 5; i++) cs.push(function (s2, pid, lg) {
      const e = s2.p[pid].ep || 0; dec++; hist[Math.min(e, 4)] = (hist[Math.min(e, 4)] || 0) + 1;
      if (e > peak) peak = e; if (lg.some(l => l.key === A.RING && l.affordable)) ge3++;
      const r = inner(s2, pid, lg); if (r && r.key === A.RING) ring++; return r;
    });
    for (let g = 0; g < N; g++) {
      const st = S.createState(mode, { next: mb(999 + g * 977) }, 5);
      st.slotSalt = h32(999 + g * 2246822519);
      Play.autoGameN(st, cs);
      rounds += st.round;
      for (let i = 0; i < 5; i++) {
        left += st.p[i].ep || 0;
        const fe = st.p[i].ep || 0;
        endTot++; endSum += fe; if (fe > endMax) endMax = fe;
        if (fe > C_CAP) endGT++;
        if (fe >= 3) endGE3++;
        for (const e of st.events) if (e.type === 'ep' && e.pid === i) { if (e.delta > 0) epGain += e.delta; else epLost += -e.delta; }
      }
      /* 出手的**真费用**必须用 computeCost 在**当时**的状态算，但事件流里没有那个快照 ⇒
       * 这里用 def.cost 近似，并对环/过载炮/激光眼这三张"动态成本卡"单独剔除（它们 def.cost 是 null 或失真）。 */
      const DYN = new Set([A.RING, A.CANNON, A.LASER_EYE, A.JI]);
      for (const e of st.events) if (e.type === 'action' && e.outcome === 'ok') {
        casts++;
        const c = COST[e.key];
        if (!DYN.has(e.key) && c != null && c >= 2) heavy++;
      }
    }
    const spent = Math.max(0, epGain - epLost - left);
    console.log(`  ${nm.padEnd(16)} [${mode}] 余ep/人 ${(left / (N * 5)).toFixed(1)} · 出手/回合 ${(casts / rounds).toFixed(2)}（cost≥2 占 ${(100 * heavy / Math.max(1, casts)).toFixed(1)}%）`);
    console.log(`  ${''.padEnd(16)}          ep 直方 0/1/2/3/≥4 = ${[0, 1, 2, 3, 4].map(k => (100 * (hist[k] || 0) / dec).toFixed(1) + '%').join(' ')} · 峰 ep ${peak} · 环可负担 ${(100 * ge3 / dec).toFixed(2)}% · 打环 ${ring}`);
    console.log(`  ${''.padEnd(16)}          ep 账本：已获得 ${(epGain / N).toFixed(1)}/局 · 已花 ${(spent / N).toFixed(1)} · 被抢 ${(epLost / N).toFixed(1)} · 余 ${(left / N).toFixed(1)} ⇒ **兑现率 ${(100 * spent / Math.max(1, epGain)).toFixed(0)}%**`);
    console.log(`  ${''.padEnd(16)}          终局余款：人均 ${(endSum / endTot).toFixed(2)} · 最大 ${endMax} · **>C(${C_CAP}) 触发率 ${(100 * endGT / endTot).toFixed(2)}%** · ≥3 占比 ${(100 * endGE3 / endTot).toFixed(1)}%`);
  }
}
