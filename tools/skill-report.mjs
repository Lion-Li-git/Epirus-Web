/* Epirus AI 训练结果可视化报告
 * 用法：node tools/skill-report.mjs [人数=3] [每条件局数=6] [输出=docs/skill-report.html]
 *
 * 回答两个问题：
 *   ① 每个技能的**实际强度** —— 用「富裕经济 A/B」：每回合把 ep 补到 RICH（让所有技能都买得起），
 *      对照组=冠军自由发挥，实验组=强制只用某技能，比 1st 率差。差值为正=这招真强，为负=用了反而亏。
 *   ② AI **有没有掉进坑里** —— 把「实际使用率」和「实际强度」并排：
 *        高使用 + 负强度 = 坑（在自残）    ~0 使用 + 正强度 = 没学会的强招
 *        高使用 + 正强度 = 主力    ~0 使用 + 负强度 = 死技能
 * 产出单文件 HTML，可直接双击打开。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const N = parseInt(process.argv[2] || '3', 10);
const GAMES = parseInt(process.argv[3] || '6', 10);
const OUT = process.argv[4] || 'docs/skill-report.html';
const RICH = 6;          // 富裕经济：每回合补到 6 ep（大雷 5 也够）
const TEMP = 0.15;

const sb = {
  console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN,
  parseInt, parseFloat, Float64Array, Date, window: {},
  localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } }
};
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const file = N > 2 ? 'js/bundled-champion-3p.js' : 'js/bundled-champion.js';
const gname = N > 2 ? 'EPIRUS_CHAMPION_3P' : 'EPIRUS_CHAMPION';
vm.runInNewContext(readFileSync(file, 'utf8'), sb, { filename: file });
const W = sb.window, R = W.EpirusRules, S = W.EpirusState, T = W.EpirusTrainer, P = W.EpirusPolicy, B = W.EpirusBots;
const champ = P.unpack(W[gname]);
if (!champ) throw new Error('冠军解包失败：' + file);

const SKILLS = (R.skills || []).map(function (d) { return d.key; });
const BOTFN = ['pickRandom', 'pickBalanced', 'pickAggro', 'pickDefend', 'pickWall', 'pickAntiDef', 'pickBreakDef', 'pickMix', 'pickFarmer'];
const PAIRS = [];
for (let i = 0; i < BOTFN.length; i++) for (let j = i + 1; j < BOTFN.length; j++) PAIRS.push([BOTFN[i], BOTFN[j]]);

/* 冠军 chooser，可附带「每回合补 ep」与「强制某技能」 */
function makeSel(forceKey, rich, seat) {
  // 修正：冠军在 runCondition 里是**轮换座位**的，之前硬编码 pid===0 → seat!=0 时
  // 冠军的决策被套在对手身上、自己却由脚本驱动，测量完全错位（基线只有 10% 的主因）。
  const inner = N > 2 ? T.policyChooserN(champ, TEMP) : null;
  const fn = function (state, pid, legal) {
    if (rich && pid === seat) {
      // 只给冠军补资源（之前给所有人补 → 脚本对手远超分布变强，把基线压到 10%）
      const pl = state.p[seat];
      pl.ep = Math.max(pl.ep, RICH);
      const d = forceKey ? R.byKey[forceKey] : null;      // 珠类技能要同时补珠，否则强制也没用
      if (d && d.energyNeeds) {
        if (d.energyNeeds.elec) pl.elec = Math.max(pl.elec, 1);
        if (d.energyNeeds.boom) pl.boom = Math.max(pl.boom, 1);
      }
    }
    if (pid !== seat) {
      if (inner) return inner(state, pid, legal);
      const aff2 = legal.filter(function (l) { return l.affordable; });
      const base2 = aff2.length ? aff2 : [{ key: R.SK.JI, affordable: true }];
      return P.choose(state, pid, base2, champ, { temp: TEMP });
    }
    const aff = legal.filter(function (l) { return l.affordable; });
    let base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    if (forceKey) {
      const can = base.filter(function (l) { return l.key === forceKey; });
      if (can.length) base = can;
    }
    const k = P.choose(state, pid, base, champ, { temp: TEMP });
    if (inner) {
      const t1 = T.pickTargetN(state, pid, k);
      let t2 = null;
      if (k === R.SK.DUAL_GUN || k === R.SK.MIRROR) {
        const rest = S.opponentsOf(state, pid).filter(function (o) { return o !== t1; });
        t2 = rest.length ? rest[0] : null;
      }
      return { key: k, target: t1, target2: t2 };
    }
    return k;
  };
  return fn;
}

function runCondition(forceKey, rich, seedBase) {
  let first = 0, total = 0;
  for (const pair of PAIRS) {
    for (let g = 0; g < GAMES; g++) {
      const seat = g % N;
      const choosers = [];
      let oi = 0;
      for (let pid = 0; pid < N; pid++) {
        if (pid === seat) choosers.push(makeSel(forceKey, rich, seat));
        else { choosers.push(T.wrapBotN(B[pair[oi % pair.length]])); oi++; }
      }
      const r = T.oneGameN(choosers, seedBase + g * 977 + total, N);
      if (T.rankOf(r.state, seat) === 1) first++;
      total++;
    }
  }
  return { firstRate: first / total, games: total };
}

/* ① 实际使用率（原生经济，正常对局） */
function usage() {
  const use = {}; let dec = 0, maxEp = 0, epSum = 0;
  const inner = T.policyChooserN(champ, TEMP);
  const probe = function (state, pid, legal) {
    const a = inner(state, pid, legal);
    if (pid === 0) { use[a.key] = (use[a.key] || 0) + 1; dec++; maxEp = Math.max(maxEp, state.p[0].ep); epSum += state.p[0].ep; }
    return a;
  };
  for (let g = 0; g < 120; g++) T.oneGameN([probe, probe, probe].slice(0, N), 40001 + g * 131, N);
  return { use: use, dec: dec, maxEp: maxEp, avgEp: epSum / dec };
}

function costOf(key) {
  const st = S.createState('multi', { next: T.mulberry32(1) }, N);
  for (let i = 0; i < N; i++) { st.p[i].ep = 99; st.p[i].elec = 3; st.p[i].boom = 3; }
  const c = S.computeCost(st, 0, key);
  return (c && c.ok) ? c.ep : null;
}

console.log('[报告] 人数=' + N + '  冠军=' + file + '  对手对=' + PAIRS.length + '  每条件 ' + GAMES + ' 局/对');
const u = usage();
console.log('  使用率采样：决策=' + u.dec + '  最高ep=' + u.maxEp + '  平均ep=' + u.avgEp.toFixed(2));

console.log('  富经济基线（自由发挥）…');
const baseRich = runCondition(null, true, 555001);
console.log('    rich 基线 1st=' + (baseRich.firstRate * 100).toFixed(1) + '%');
const baseNative = runCondition(null, false, 555001);
console.log('    原生 基线 1st=' + (baseNative.firstRate * 100).toFixed(1) + '%');

const rows = [];
for (const k of SKILLS) {
  const rich = runCondition(k, true, 555001);
  const delta = rich.firstRate - baseRich.firstRate;
  const nm = R.byKey[k] ? R.byKey[k].name : k;
  const cnt = u.use[k] || 0;
  const rate = u.dec ? cnt / u.dec : 0;
  rows.push({ key: k, name: nm, cost: costOf(k), use: rate, richWr: rich.firstRate, delta: delta });
  console.log('    ' + nm.padEnd(8) + ' 费用=' + String(costOf(k)).padStart(2) + '  使用=' + (rate * 100).toFixed(1).padStart(5) + '%  富经济1st=' + (rich.firstRate * 100).toFixed(1).padStart(5) + '%  Δ=' + (delta * 100 >= 0 ? '+' : '') + (delta * 100).toFixed(1) + 'pt');
}

/* ② 分类：坑 / 主力 / 没学会的强招 / 死技能 */
for (const r of rows) {
  const hi = r.use >= 0.04, pos = r.delta > 0.005, neg = r.delta < -0.005;
  /* 基础动作（费用 0）除外：强制 mono-spam 任何单一动作必然不如混合策略，
   * 那不是“坑”而是评测口径的必然结果。只有费用>0 的技能才适合读“常用却亏”。 */
  if (r.cost === 0) { r.verdict = hi ? '基础动作（mono-spam 必然变差）' : '边缘'; continue; }
  r.verdict = hi && neg ? '坑（常用却亏）' : hi && pos ? '主力（强且常用）' : hi ? '中性常用'
    : !hi && pos ? '没学会的强招' : !hi && neg ? '死技能（弱且不用）' : '边缘';
}

/* ---- HTML ---- */
const esc = function (s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
const maxAbsDelta = Math.max(0.01, ...rows.map(function (r) { return Math.abs(r.delta); }));
const maxUse = Math.max(0.01, ...rows.map(function (r) { return r.use; }));
const bar = function (v, mx, color) { const w = Math.abs(v) / mx * 100; return '<div class="barwrap"><div class="bar ' + color + '" style="width:' + w.toFixed(1) + '%"></div></div>'; };
const VCOLOR = { '坑（常用却亏）': '#e5484d', '主力（强且常用）': '#30a46c', '中性常用': '#8b8d98', '没学会的强招': '#f5a623', '死技能（弱且不用）': '#6b4fbb', '基础动作（mono-spam 必然变差）': '#3a4252', '边缘': '#555' };

let html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>Epirus AI 训练分析报告</title>';
html += '<style>body{background:#0d0f14;color:#dfe2ea;font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif;margin:0;padding:24px}';
html += 'h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 10px;color:#9aa0b0;font-weight:600}';
html += '.meta{color:#7c8494;font-size:12px;margin-bottom:18px}';
html += '.cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}.card{background:#161a22;border:1px solid #232936;border-radius:8px;padding:10px 14px;min-width:120px}';
html += '.card b{display:block;font-size:20px;color:#fff}.card span{font-size:11px;color:#7c8494}';
html += 'table{width:100%;border-collapse:collapse;background:#12151c;border-radius:8px;overflow:hidden}';
html += 'th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #1e2330;font-size:13px}';
html += 'th{background:#171b24;color:#9aa0b0;font-weight:600;font-size:12px}';
html += '.barwrap{background:#1b202b;border-radius:3px;height:14px;width:150px;display:inline-block;vertical-align:middle;overflow:hidden}';
html += '.bar{height:100%;border-radius:3px}.pos{background:#30a46c}.neg{background:#e5484d}';
html += '.tag{padding:2px 8px;border-radius:10px;font-size:11px;color:#0d0f14;font-weight:700}';
html += '.legend{font-size:12px;color:#7c8494;margin-top:10px}code{background:#1b202b;padding:1px 5px;border-radius:3px}</style></head><body>';
html += '<h1>Epirus AI 训练分析报告</h1>';
html += '<div class="meta">人数 ' + N + ' 人 · 冠军 <code>' + esc(file) + '</code> · 对手对 ' + PAIRS.length + ' × ' + GAMES + ' 局 · 富裕经济 = 每回合补到 ' + RICH + ' ep · 游戏 ' + u.dec + ' 个决策采样</div>';

html += '<div class="cards">';
html += '<div class="card"><b>' + (Math.exp(-rows.reduce(function (a, r) { return a + (r.use > 0 ? r.use * Math.log(r.use) : 0); }, 0))).toFixed(2) + '</b><span>有效技能数 exp(H)</span></div>';
html += '<div class="card"><b>' + rows.filter(function (r) { return r.use > 0.001; }).length + '</b><span>实际用到的技能</span></div>';
html += '<div class="card"><b>' + u.maxEp + '</b><span>最高 ep（经济深度）</span></div>';
html += '<div class="card"><b>' + (baseNative.firstRate * 100).toFixed(0) + '%</b><span>原生经济 1st</span></div>';
html += '<div class="card"><b>' + (baseRich.firstRate * 100).toFixed(0) + '%</b><span>富经济 1st（上限参考）</span></div>';
html += '</div>';

html += '<h2>每技能：实际使用率 × 实际强度（富裕经济下强制使用的收益差）</h2>';
html += '<table><tr><th>技能</th><th>费用</th><th>实际使用率</th><th></th><th>强制使用的 1st</th><th>强度 Δ vs 自由发挥</th><th></th><th>判定</th></tr>';
rows.sort(function (a, b) { return b.use - a.use; });
for (const r of rows) {
  html += '<tr><td>' + esc(r.name) + '</td><td>' + (r.cost == null ? '?' : r.cost) + '</td>';
  html += '<td>' + (r.use * 100).toFixed(1) + '%</td><td>' + bar(r.use, maxUse, 'pos') + '</td>';
  html += '<td>' + (r.richWr * 100).toFixed(0) + '%</td>';
  html += '<td>' + (r.delta >= 0 ? '+' : '') + (r.delta * 100).toFixed(1) + 'pt</td>';
  html += '<td>' + bar(r.delta, maxAbsDelta, r.delta >= 0 ? 'pos' : 'neg') + '</td>';
  html += '<td><span class="tag" style="background:' + VCOLOR[r.verdict] + '">' + r.verdict + '</span></td></tr>';
}
html += '</table>';
html += '<div class="legend"><b>口径说明：</b>Δ 是“强制只用这一招”对“自由发挥”的差，所以**基础动作（如 ジ）强制 spam 必然大幅为负，那不是坑**。真正有意义的是排序：Δ 越接近 0 或为正，说明这一招单独就能顶上整套混合策略。<br><br><b>怎么读：</b>左柱 = AI 实际多久用一次（原生经济）；右柱 = 强制用它时的胜率变化（富经济，绿色涨 / 红色跌）。';
html += '<br><b>红色「坑」</b>= 常用但用了反而亏 → AI 在自残，应该修训练或规则；<b>橙色「没学会的强招」</b>= 明明更强却几乎不用 → 探索/经济没铺到；';
html += '<b>绿色「主力」</b>= 又强又常用，健康；<b>紫色「死技能」</b>= 又弱又不用，设计上没被激活。</div>';
html += '</body></html>';
writeFileSync(OUT, html, 'utf8');
console.log('\n已写出 ' + OUT + '（' + html.length + ' 字节）');
const pits = rows.filter(function (r) { return r.verdict === '坑（常用却亏）'; });
const unseen = rows.filter(function (r) { return r.verdict === '没学会的强招'; });
console.log('坑（常用却亏损）: ' + (pits.map(function (r) { return r.name + ' ' + (r.delta * 100).toFixed(1) + 'pt'; }).join(', ') || '无'));
console.log('没学会的强招  : ' + (unseen.map(function (r) { return r.name + ' +' + (r.delta * 100).toFixed(1) + 'pt'; }).join(', ') || '无'));
