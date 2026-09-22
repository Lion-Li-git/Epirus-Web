/* tools/probe-cast-vs-land.mjs —— 出手 ≠ 落地：把"有效技能数 G"拆成**发起**与**兑现**两把尺子（qoder 0923 夜 · §N23）
 *
 * 起因（用户 09-22 的判断）：`v7cmin4-31` 的 `G_eff = 4.44`，但"他真的只用 6 个技能"；
 * 而 `G_eff = exp(出手次数的 Shannon 熵)` 只看**发起了几次**，不看**打没打上**
 * ⇒ 一张"常常出手、常常被防住/被反弹"的卡与一张"少见但每次都在掉血"的卡，在这把尺子上是**同一个熵**。
 * 本工具把三样分开量：**出手/局、落地/局、造成伤害/局**，并给出两把广度：
 *   G_eff(出手) = 现有门禁口径（`mirrorHealth.effSkills`，同参数同种子）
 *   G_eff(落地) = 用 `damage` 事件的 `via`（谁打的血）算的同样熵 ⇒ **"真兑现的技能有几种"**
 * 再按三种模式 × 两种对手环境（镜像自对局 / 脚本池）各量一遍。
 *
 * 用法：node tools/probe-cast-vs-land.mjs [--pack=js/bundled-champion-3p.js] [--games=120] [--modes=multi,long,standard] [--label=现役3P槽]
 * 只读：不写产物。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const arg = function (k, d) { const h = process.argv.find(function (a) { return a.indexOf('--' + k + '=') === 0; }); return h ? h.split('=')[1] : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const GAMES = Number(arg('games', 120));
const MODES = arg('modes', 'multi,long,standard').split(',');
const LABEL = arg('label', PACK);
const SEED0 = Number(arg('seed', 20260923));

const sb = {
  console: { log: function () { }, warn: function () { }, error: console.error },
  Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Float64Array, Date
};
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
vm.runInNewContext(readFileSync(PACK, 'utf8'), sb, { filename: PACK });
const R = sb.window.EpirusRules, T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, B = sb.window.EpirusBots;
const packObj = /window\.EPIRUS_CHAMPION_3P\s*=/.test(readFileSync(PACK, 'utf8')) ? sb.window.EPIRUS_CHAMPION_3P : sb.window.EPIRUS_CHAMPION;
const params = P.unpack(packObj, true);
if (!params) { console.error('⛔ 包解不开：' + PACK); process.exit(2); }
const POOL = [B.pickAggro, B.pickBalanced, B.pickDefend, B.pickWall, B.pickFarmer, B.pickMix, B.pickBeadBurst, B.pickComboCounter, B.pickRandom];

function entropy(counts) {
  const ks = Object.keys(counts).filter(function (k) { return counts[k] > 0; });
  const tot = ks.reduce(function (a, k) { return a + counts[k]; }, 0);
  if (!tot) return { H: 0, eff: 0, distinct: 0, tot: 0 };
  let H = 0;
  for (const k of ks) { const pr = counts[k] / tot; H -= pr * Math.log(pr); }
  return { H: H, eff: Math.exp(H), distinct: ks.length, tot: tot };
}

for (const mode of MODES) {
  const N = mode === 'standard' ? 2 : 5;
  for (const field of ['mirror', 'pool']) {
    const cast = {}, land = {}, dmgBy = {};
    let rounds = 0, first = 0;
    for (let g = 0; g < GAMES; g++) {
      const seed = SEED0 + g * 7919;
      const seat = mode === 'standard' ? 0 : (g % N);
      const bs = T.policyChooserN(params, 0.15);
      const ch = [];
      for (let pid = 0; pid < N; pid++) {
        if (pid === seat || field === 'mirror') ch.push(function (st2, p2, legal) { return bs(st2, p2, legal); });
        else { const bot = POOL[(g * 3 + pid) % POOL.length]; ch.push(function (st2, p2, legal) { return bot(st2, p2, legal); }); }
      }
      const r = T.oneGameN(ch, seed, N, { mode: mode });
      rounds += r.state.round;
      if (r.state.winner === seat) first++;
      for (const e of r.state.events) {
        if (e.type === 'action' && e.outcome === 'ok' && e.pid === seat && e.key !== R.SK.JI) cast[e.key] = (cast[e.key] || 0) + 1;
        /* 只算真卡名：`via === 'headshot'`（爆头）是**结果修饰**不是一张卡，
         * 算进去会凭空多出一个"技能"、把 G_eff(落地) 抬上去 —— 正是要避免的那类刷分。 */
        if (e.type === 'damage' && e.source === seat && R.byKey[e.via]) {
          land[e.via] = (land[e.via] || 0) + 1;
          dmgBy[e.via] = (dmgBy[e.via] || 0) + (e.amt || 0);
        }
      }
    }
    const ce = entropy(cast), le = entropy(land);
    console.log('\n=== ' + LABEL + ' · 模式=' + mode + '（n=' + N + '）· 环境=' + field +
      ' · ' + GAMES + ' 局 · 1st=' + (100 * first / GAMES).toFixed(1) + '% · 平均回合=' + (rounds / GAMES).toFixed(1));
    console.log('  G_eff(出手)=' + ce.eff.toFixed(2) + '（种类 ' + ce.distinct + '）‖ **G_eff(落地)=' + le.eff.toFixed(2) + '**（兑现种类 ' + le.distinct + '）‖ 出手:落地 = ' +
      ce.tot + ':' + le.tot + '（每张卡平均兑现率 ' + (100 * le.tot / Math.max(1, ce.tot)).toFixed(0) + '%）');
    const keys = Object.keys(cast).concat(Object.keys(land)).filter(function (v, i, a) { return a.indexOf(v) === i; });
    const rows = keys.map(function (k) {
      return { n: (R.byKey[k] || {}).name || k, c: cast[k] || 0, l: land[k] || 0, d: dmgBy[k] || 0 };
    }).sort(function (a, b) { return b.c - a.c; });
    console.log('  ' + '卡名'.padEnd(10) + '出手/局  落地/局  伤害/局  落地率');
    for (const r of rows) {
      console.log('    ' + String(r.n).padEnd(9) + (r.c / GAMES).toFixed(2).padStart(6) + '  ' + (r.l / GAMES).toFixed(2).padStart(6) +
        '  ' + (r.d / GAMES).toFixed(2).padStart(6) + '  ' + ((100 * r.l / Math.max(1, r.c)).toFixed(0) + '%').padStart(5));
    }
  }
}
