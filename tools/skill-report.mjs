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

/* 位置参数：剔除 --flag（否则会被当成人数/局数/输出路径） */
const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
const FLAG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a);
  if (m) FLAG[m[1]] = m[2] === '' ? '1' : m[2];
}
const N = parseInt(ARGV[0] || '3', 10);
const GAMES = parseInt(ARGV[1] || '6', 10);
const OUT = ARGV[2] || 'docs/skill-report.html';
/* v1.4.4：--champ=<文件> 指定被测冠军（原先写死线下路径 ⇒ 没法规格对比多个版本）；
 * --json=<文件> 导出逐技能结果，供 tools/skill-report-cmp.mjs 做多版本对比。
 * ⚠️ 训练实验进行中时 js/bundled-champion-3p.js 是**中途产物**，对比务必显式传 --champ。 */
const CHAMP_FILE = FLAG.champ || '';
const JSON_OUT = FLAG.json || '';
const RICH = 10;         // v1.3.59：原为 6，导致 大雷(5)/避雷针(4) 因余额不足强制不中（命中率 11%/50%）
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
const file = CHAMP_FILE || (N > 2 ? 'js/bundled-champion-3p.js' : 'js/bundled-champion.js');
const gname = N > 2 ? 'EPIRUS_CHAMPION_3P' : 'EPIRUS_CHAMPION';
const src = readFileSync(file, 'utf8');
const metaM = src.match(/window\.EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/);
vm.runInNewContext(src, sb, { filename: file });
const W = sb.window, R = W.EpirusRules, S = W.EpirusState, T = W.EpirusTrainer, P = W.EpirusPolicy, B = W.EpirusBots;
const champ = P.unpack(W[gname]);
if (!champ) throw new Error('冠军解包失败：' + file);

const SKILLS = (R.skills || []).map(function (d) { return d.key; });
const BOTFN = ['pickRandom', 'pickBalanced', 'pickAggro', 'pickDefend', 'pickWall', 'pickAntiDef', 'pickBreakDef', 'pickMix', 'pickFarmer'];
/* v1.3.59：对手场改成 **4 个互不相同的脚本**。
 * 旧版用 2 脚本"对手对"循环填充 ⇒ N=5 时 4 个对手座位只有 2 种脚本（各重复一次），
 * 与 tools/eval-5p.mjs 修掉的是同一类缺陷；读数也对不上 eval-5p
 * （雷击之枪 20.9% vs 2.2%、激光剑 8.1% vs 26.0%）。 */
const PAIRS = [];
(function combos(start, cur) {
  if (cur.length === 4) { PAIRS.push(cur.slice()); return; }
  for (let i = start; i < BOTFN.length; i++) { cur.push(BOTFN[i]); combos(i + 1, cur); cur.pop(); }
})(0, []);

/* 冠军 chooser，可附带「每回合补 ep」与「强制某技能」 */
function makeSel(forceKey, rich, seat, acc, banKey) {
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
    /* v1.4.10 消融：把这一招从**主体**的候选里拿掉（脚本对手不受影响）。
     * 这是"冠军已经在用的技能"唯一能测的口径 —— mono-spam Δ 对它们会给出相反结论：
     * 实测 枪 mono Δ=−15.5pt（读作"坑/别用"）而消融 Δ_lost=+3.8pt（读作"该留着"）；
     * 雷击之枪 mono Δ=−44pt（读作"没用"）而消融 Δ_lost=−2.2pt（读作"该拿掉"，陷阱卡）。 */
    if (banKey) {
      const keep = base.filter(function (l) { return l.key !== banKey; });
      base = keep.length ? keep : [{ key: R.SK.JI, affordable: true }];
    }
    if (forceKey) {
      /* v1.3.59：记录"强制到底有没有生效"。play.js 会把 cost.ok===false（条件不满足）
       * 的技能从 legal 里剔掉，而这里只在 **legal 里已有的可负担项** 中筛 ⇒ 条件门技能
       * 永远强制不到，Δ 恒≈0，旧版据此把它判成"死技能"。没有这一列就无法分辨。 */
      if (acc) acc.tries++;
      const can = base.filter(function (l) { return l.key === forceKey; });
      if (can.length) base = can;
    }
    const k = P.choose(state, pid, base, champ, { temp: TEMP });
    if (forceKey && acc && k === forceKey) acc.hit++;
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

function runCondition(forceKey, rich, seedBase, acc, banKey) {
  let first = 0, total = 0;
  for (const pair of PAIRS) {
    for (let g = 0; g < GAMES; g++) {
      const seat = g % N;
      const choosers = [];
      let oi = 0;
      for (let pid = 0; pid < N; pid++) {
        if (pid === seat) choosers.push(makeSel(forceKey, rich, seat, acc, banKey));
        else { choosers.push(T.wrapBotN(B[pair[oi % pair.length]])); oi++; }
      }
      const r = T.oneGameN(choosers, seedBase + g * 977 + total, N);
      if (T.rankOf(r.state, seat, seedBase + g * 977 + total) === 1) first++;   // v1.3.57: 名次平局需本局种子
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
    use[a.key] = (use[a.key] || 0) + 1; dec++;          // v1.3.59：统计全部座位（原只记 pid 0）
    if (state.p[pid].ep > maxEp) maxEp = state.p[pid].ep; epSum += state.p[pid].ep;
    return a;
  };
  /* v1.3.59 两处修正：
   *  1) 原为硬编码 3 个探针 + .slice(0,N) ⇒ N=5 时后两个座位拿到 undefined chooser，
   *     autoGameN 走 normPick(null) → 一律按ジ ⇒ 环境里有两个"僵尸座位"；
   *  2) 使用率必须与强度实验在**同一个环境**里测，否则两列不可比：原为全座位冠军自对弈
   *     （turtle 局占比高），改成与 runCondition 相同的"1 冠军座位 + 4 脚本"，座位轮换。 */
  let total = 0;
  for (const pair of PAIRS) {
    for (let g = 0; g < GAMES; g++) {
      const seat = g % N;
      const choosers = []; let oi = 0;
      for (let pid = 0; pid < N; pid++) {
        if (pid === seat) choosers.push(probe);
        else { choosers.push(T.wrapBotN(B[pair[oi % pair.length]])); oi++; }
      }
      T.oneGameN(choosers, 40001 + g * 977 + total, N);
      total++;
    }
  }
  return { use: use, dec: dec, maxEp: maxEp, avgEp: epSum / dec };
}

function costOf(key) {
  const st = S.createState('multi', { next: T.mulberry32(1) }, N);
  for (let i = 0; i < N; i++) { st.p[i].ep = 99; st.p[i].elec = 3; st.p[i].boom = 3; }
  const c = S.computeCost(st, 0, key);
  return (c && c.ok) ? c.ep : null;
}

console.log('[报告] 人数=' + N + '  冠军=' + file + '  对手场=' + PAIRS.length + ' 组(每组 4 个互不相同的脚本)  每条件 ' + GAMES + ' 局/组');
const u = usage();
console.log('  使用率采样：决策=' + u.dec + '  最高ep=' + u.maxEp + '  平均ep=' + u.avgEp.toFixed(2));

console.log('  富经济基线（自由发挥）…');
const baseRich = runCondition(null, true, 555001);
console.log('    rich 基线 1st=' + (baseRich.firstRate * 100).toFixed(1) + '%');
const baseNative = runCondition(null, false, 555001);
console.log('    原生 基线 1st=' + (baseNative.firstRate * 100).toFixed(1) + '%');

const rows = [];
for (const k of SKILLS) {
  const acc = { tries: 0, hit: 0 };
  const rich = runCondition(k, true, 555001, acc);
  const delta = rich.firstRate - baseRich.firstRate;
  const nm = R.byKey[k] ? R.byKey[k].name : k;
  const cnt = u.use[k] || 0;
  const rate = u.dec ? cnt / u.dec : 0;
  rows.push({ key: k, name: nm, cost: costOf(k), use: rate, richWr: rich.firstRate, delta: delta,
    forceHit: acc.tries ? acc.hit / acc.tries : 0, tries: acc.tries });
  console.log('    ' + nm.padEnd(8) + ' 费用=' + String(costOf(k)).padStart(2) + '  使用=' + (rate * 100).toFixed(1).padStart(5) + '%  富经济1st=' + (rich.firstRate * 100).toFixed(1).padStart(5) + '%  Δ=' + (delta * 100 >= 0 ? '+' : '') + (delta * 100).toFixed(1) + 'pt  强制命中=' + ((acc.tries ? acc.hit / acc.tries : 0) * 100).toFixed(0) + '%');
}

/* ② 分类：坑 / 主力 / 没学会的强招 / 死技能 */
/* ===== v1.4.6：技能族 → "该用哪个口径" 映射（v1.4.5 补齐四个口径后的覆盖表）=====
 * 目的：报告不再把"这个口径表达不了"读成"这个技能弱"。
 * 判据优先级：**冠军已经在用 ⇒ 消融（--ban）最准**（"强制 spam 它"对已在用的技能没有意义）；
 * 否则按技能族给专用口径：珠类门 / 序列连招 / 反应条件 / 辅助防御。 */
const INSTR = {
  railgun:   '--grant=elec --inject=railgun',
  laserEye:  '--grant=boom --inject=laserEye',
  charge:    '--plan=chargeRailgun',
  ring:      '--plan=…（已用时 --ban=ring 更准）',
  curse:     '--combo=curseStorm:3',
  firestorm: '--combo=curseStorm:3',
  transfer:  '--smart=transfer:2',
  drain:     '--smart=drain:hp1 或 --mode=long --drainHp=N',
  mine:      '--field=minespam（需被触发）',
  guard:     '--field=focusme2', reflect: '--field=focusme2', armor: '--field=focusme2',
  bagua:     '--field=focusme2', jinshield: '--field=focusme2', shift: '--field=focusme2',
  proto:     '--field=tank', holo: '--field=tank',
  gun: '--inject=gun', sword: '--inject=sword', tank: '--inject=tank', snipe: '--inject=snipe',
  dualGun: '--inject=dualGun', mirror: '--inject=mirror', purify: '--inject=purify',
  cannon: '--inject=cannon', taunt: '--inject=taunt', rod: '--inject=rod',
  miniT: '--inject=miniT', bigT: '--inject=bigT'
};
/* v1.4.10：阈值从 2% 降到 1% —— `雷击之枪` 在同口径下用量只有 1.6%，恰是**陷阱卡**
 * （消融 Δ_lost=−2.2pt：拿掉反而变好）；阈值 2% 会把它挡在消融之外，而它正是最该被标出来的那类。 */
/* 反制卡的价值是**场依赖**的：实测"优先出小雷"在 4×聚能环场上 +20pt（2.5%→22.5%），
 * 而在没有环/电磁炮/大雷的场上是 −25.7pt（31.1%→5.4%）⇒ 本场读数不能当它的全部价值。 */
const NOTE = {
  miniT: '反制卡：本场无聚能环/电磁炮/大雷使用者 ⇒ 反制价值测不到（--field=ringwall 实测 +20pt）'
};
const USE_BAN = 0.01;

for (const r of rows) {
  const hi = r.use >= 0.04, pos = r.delta > 0.005, neg = r.delta < -0.005;
  /* 基础动作（费用 0）除外：强制 mono-spam 任何单一动作必然不如混合策略，
   * 那不是“坑”而是评测口径的必然结果。只有费用>0 的技能才适合读“常用却亏”。 */
  const d = R.byKey[r.key] || {};
  const isUtil = !(d.dmg && d.dmg.amt > 0);       // 无伤害 = 辅助/防御/架势
  /* 该用哪个口径（放在 continues 之前，保证每行都有） */
  r.tool = (r.use >= USE_BAN) ? ('--ban=' + r.key) : (INSTR[r.key] || '—');
  /* v1.4.11：**反制卡**必须额外标注 —— 它们的价值取决于场上有没有目标。
   * 注意这里用**追加**而不是替换：雷击之枪用量 1.6% ≥ 阈值，会被"已在用 ⇒ --ban"规则覆盖，
   * 我第一版把标注写进 INSTR 就被它吃掉了（生成出来的 HTML 里根本找不到）。 */
  if (NOTE[r.key]) r.tool += '　⚠ ' + NOTE[r.key];
  r.inUse = r.use >= USE_BAN;
  /* v1.3.59：**三件事分开**，否则"死技能"这一栏会把测量失败也算进去：
   *  1) 强制没命中（技能压根进不了 legal 或被抽不到）⇒ 这个 Δ 不能读，只能报"实验未生效"；
   *  2) 辅助/防御类：mono-spam 一个不造成伤害的技能必然不如混合策略 ⇒ Δ 结构性为负；
   *  3) 只有"能造成伤害 且 实验确实跑到了"的技能，才适合读 常用/亏损。 */
  if (r.forceHit < 0.05) { r.verdict = '实验未生效（Δ 不可读）'; continue; }
  if (r.cost === 0) { r.verdict = hi ? '基础动作（mono-spam 必然变差）' : '边缘'; continue; }
  /* 只在 Δ 为负时才归因"结构性"：辅助类的 mono-spam 通常必然更差，但若它 Δ 为正，
   * 那是真发现（v1.3.59 实测：全息屏障 +17.1pt、原型制御 +15.9pt 都是辅助类却更强），
   * 不能被这条吞掉。 */
  if (isUtil && neg) { r.verdict = '辅助/防御（Δ 结构性为负）'; continue; }
  r.verdict = hi && neg ? '坑（常用却亏）' : hi && pos ? '主力（强且常用）' : hi ? '中性常用'
    : !hi && pos ? '没学会的强招' : !hi && neg ? '死技能（弱且不用）' : '边缘';
}

/* ---- HTML ---- */
const esc = function (s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
/* ===== v1.4.10 消融臂：对"冠军已经在用"的技能再跑一次"拿掉它"的原生经济考卷（同 seed）=====
 * Δ_lost = 原生基线 − 拿掉后 ⇒ **正数 = 承重**（拿掉会掉），**负数 = 陷阱**（拿掉反而变好）。 */
console.log('  消融臂（拿掉冠军已在用的技能）…');
const inUsePre = rows.filter(function (r) { return r.use >= USE_BAN; });
for (const r of inUsePre) {
  const ban = runCondition(null, false, 555001, null, r.key);
  r.banArm = ban.firstRate;
  r.banLost = baseNative.firstRate - ban.firstRate;
  console.log('    ' + r.name + '：原生 ' + (baseNative.firstRate * 100).toFixed(1) + '% → 拿掉 ' +
    (ban.firstRate * 100).toFixed(1) + '%  Δ_lost=' + (r.banLost >= 0 ? '+' : '') + (r.banLost * 100).toFixed(1) + 'pt');
  /* 反制卡（有 NOTE）的价值是**场依赖**的 ⇒ 判定标签也标（本场），避免把"本场没目标可打"
   * 读成"这张卡是陷阱"（实测小雷：本场 −2.6pt / 环场 +20pt）。 */
  const cond = NOTE[r.key] ? '（本场）' : '';
  r.verdict = r.banLost > 0.005 ? ('承重' + cond + '（拿掉掉 ' + (r.banLost * 100).toFixed(0) + 'pt）')
    : r.banLost < -0.005 ? ('陷阱' + cond + '（拿掉反而 +' + (-r.banLost * 100).toFixed(0) + 'pt）')
    : ('中性' + cond + '（拿掉无差）');
}

const maxAbsDelta = Math.max(0.01, ...rows.map(function (r) { return Math.abs(r.delta); }));
const maxUse = Math.max(0.01, ...rows.map(function (r) { return r.use; }));
const bar = function (v, mx, color) { const w = Math.abs(v) / mx * 100; return '<div class="barwrap"><div class="bar ' + color + '" style="width:' + w.toFixed(1) + '%"></div></div>'; };
const VCOLOR = { '实验未生效（Δ 不可读）': '#6b7280', '辅助/防御（Δ 结构性为负）': '#3a4252', '坑（常用却亏）': '#e5484d', '主力（强且常用）': '#30a46c', '中性常用': '#8b8d98', '没学会的强招': '#f5a623', '死技能（弱且不用）': '#6b4fbb', '基础动作（mono-spam 必然变差）': '#3a4252', '边缘': '#555' };

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
html += '.legend{font-size:12px;color:#7c8494;margin-top:10px}code{background:#1b202b;padding:1px 5px;border-radius:3px;font-size:11px}';
html += '.cov{display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start}.cov table{margin-top:6px}.cov b{color:#9aa0b0;font-size:12px}.cov code{color:#7dd3fc}</style></head><body>';
html += '<h1>Epirus AI 训练分析报告</h1>';
html += '<div class="meta">人数 ' + N + ' 人 · 冠军 <code>' + esc(file) + '</code> · 对手场 ' + PAIRS.length + ' 组(4 个互不相同脚本) × ' + GAMES + ' 局 · 富裕经济 = 每回合补到 ' + RICH + ' ep · 游戏 ' + u.dec + ' 个决策采样</div>';

html += '<div class="cards">';
html += '<div class="card"><b>' + (Math.exp(-rows.reduce(function (a, r) { return a + (r.use > 0 ? r.use * Math.log(r.use) : 0); }, 0))).toFixed(2) + '</b><span>有效技能数 exp(H)</span></div>';
html += '<div class="card"><b>' + rows.filter(function (r) { return r.use > 0.001; }).length + '</b><span>实际用到的技能</span></div>';
html += '<div class="card"><b>' + u.maxEp + '</b><span>最高 ep（经济深度）</span></div>';
html += '<div class="card"><b>' + (baseNative.firstRate * 100).toFixed(0) + '%</b><span>原生经济 1st</span></div>';
html += '<div class="card"><b>' + (baseRich.firstRate * 100).toFixed(0) + '%</b><span>富经济 1st（上限参考）</span></div>';
html += '<div class="card"><b>' + rows.filter(function (r) { return r.forceHit >= 0.05; }).length + ' / ' + rows.length + '</b><span>Δ 本口径可量</span></div>';
html += '<div class="card"><b>' + rows.filter(function (r) { return r.use >= USE_BAN; }).length + '</b><span>冠军已在用（该用 --ban 消融）</span></div>';
html += '</div>';

/* ===== 覆盖表：把"测不了的"和"已在用的"分别列出并给出该用的命令 ===== */
const lack = rows.filter(function (r) { return r.forceHit < 0.05; });
const inUse = rows.filter(function (r) { return r.use >= USE_BAN; }).sort(function (a, b) { return b.use - a.use; });
html += '<h2>覆盖表：口径不足 / 冠军已在用 → 该用什么命令</h2>';
html += '<div class="cov"><div><b>① 本口径量不到（' + lack.length + ' 个）</b> —— Δ 不可读，不是"弱"：<table><tr><th>技能</th><th>费用</th><th>强制命中</th><th>该用命令</th></tr>';
for (const r of lack) html += '<tr><td>' + esc(r.name) + '</td><td>' + (r.cost == null ? '?' : r.cost) + '</td><td>' + (r.forceHit * 100).toFixed(0) + '%</td><td><code>' + esc(r.tool) + '</code></td></tr>';
if (!lack.length) html += '<tr><td colspan="4">（无 —— 所有技能在本口径下都量到了）</td></tr>';
html += '</table></div><div><b>② 冠军已经在用（' + inUse.length + ' 个）</b> —— 对它们"强制 spam"没有意义，应测<b>消融（拿掉）</b>：<table><tr><th>技能</th><th>实际使用率</th><th>消融 Δ_lost（已测）</th><th>该用命令</th></tr>';
for (const r of inUse) {
  const bl = (r.banLost == null) ? '—' : ((r.banLost >= 0 ? '+' : '') + (r.banLost * 100).toFixed(1) + 'pt');
  html += '<tr><td>' + esc(r.name) + '</td><td>' + (r.use * 100).toFixed(1) + '%</td><td>' + bl + '</td><td><code>' + esc(r.tool) + '</code></td></tr>';
}
if (!inUse.length) html += '<tr><td colspan="3">（无 —— 冠军几乎不用任何 ≥2% 的技能）</td></tr>';
html += '</table></div></div>';

html += '<h2>每技能：实际使用率 × 实际强度（富裕经济下强制使用的收益差）</h2>';
html += '<table><tr><th>技能</th><th>费用</th><th>实际使用率</th><th></th><th>强制命中率</th><th>强制使用的 1st</th><th>强度 Δ vs 自由发挥</th><th></th><th>消融 Δ_lost</th><th>判定</th><th>该用口径</th></tr>';
rows.sort(function (a, b) { return b.use - a.use; });
for (const r of rows) {
  html += '<tr><td>' + esc(r.name) + '</td><td>' + (r.cost == null ? '?' : r.cost) + '</td>';
  html += '<td>' + (r.use * 100).toFixed(1) + '%</td><td>' + bar(r.use, maxUse, 'pos') + '</td>';
  html += '<td>' + (r.forceHit * 100).toFixed(0) + '%</td>';
  html += '<td>' + (r.richWr * 100).toFixed(0) + '%</td>';
  html += '<td>' + (r.delta >= 0 ? '+' : '') + (r.delta * 100).toFixed(1) + 'pt</td>';
  html += '<td>' + bar(r.delta, maxAbsDelta, r.delta >= 0 ? 'pos' : 'neg') + '</td>';
  let vc = VCOLOR[r.verdict];
  if (!vc) vc = r.verdict.indexOf('承重') === 0 ? '#30a46c' : r.verdict.indexOf('陷阱') === 0 ? '#e5484d' : r.verdict.indexOf('中性') === 0 ? '#8b8d98' : '#555';
  html += '<td><span class="tag" style="background:' + vc + '">' + r.verdict + '</span></td>';
  html += '<td>' + (r.banLost == null ? '—' : ((r.banLost >= 0 ? '+' : '') + (r.banLost * 100).toFixed(1) + 'pt')) + '</td>';
  html += '<td><code' + (r.inUse ? ' style="color:#f5a623"' : '') + '>' + esc(r.tool) + '</code></td></tr>';
}
html += '</table>';
html += '<div class="legend"><b>口径说明：</b>Δ 是“强制只用这一招”对“自由发挥”的差，所以**基础动作（如 ジ）强制 spam 必然大幅为负，那不是坑**。真正有意义的是排序：Δ 越接近 0 或为正，说明这一招单独就能顶上整套混合策略。<br><br><b>怎么读：</b>左柱 = AI 实际多久用一次（原生经济）；右柱 = 强制用它时的胜率变化（富经济，绿色涨 / 红色跌）。';
html += '<br><b>红色「坑」</b>= 常用但用了反而亏 → AI 在自残，应该修训练或规则；<b>橙色「没学会的强招」</b>= 明明更强却几乎不用 → 探索/经济没铺到；';
html += '<b>绿色「主力」</b>= 又强又常用，健康；<b>紫色「死技能」</b>= 又弱又不用，设计上没被激活。';
html += '<br><b>「消融 Δ_lost」</b>：对<b>冠军已经在用</b>的技能另跑一次"拿掉它"的原生经济考卷（同 seed），'
     + 'Δ_lost = 原生基线 − 拿掉后 ⇒ <b>正数 = 承重</b>、<b>负数 = 陷阱</b>（拿掉反而变好）。'
     + '它与 mono-spam 的 Δ 是两个量：实测 <code>枪</code> mono −15.5pt（像坑）但 Δ_lost <b>+3.8pt</b>（该留着）、'
     + '<code>雷击之枪</code> mono −44pt（像没用）但 Δ_lost <b>−2.2pt</b>（陷阱卡）⇒ <b>已在用的技能要看 Δ_lost</b>。';
html += '<br><b>最后一列「该用口径」</b>：本口径量不到的技能，用这一列的命令重测'
     + '（v1.4.5 补齐了四类口径：<code>--grant</code> 开珠 / <code>--plan</code>·<code>--combo</code> 连招 / '
     + '<code>--smart</code> 条件注入 / <code>--ban</code> 消融）。橙色 = 冠军已在用 ⇒ 应测"拿掉它"，而不是"强制 spam"。';
html += '<br><b>灰色「实验未生效」</b>= 这一招**进不了 legal**（条件门/珠子类），强制根本打不出去 ⇒ Δ 不能读，'
     + '不是「死技能」；<b>深灰「辅助/防御（Δ 结构性为负）」</b>= 无伤害类技能，mono-spam 必然不如混合策略，'
     + 'Δ 天然为负、不代表它没用（若它 Δ 为正会改判「没学会的强招」）。<b>务必先看「强制命中率」再看 Δ。</b></div>';
html += '</body></html>';
writeFileSync(OUT, html, 'utf8');
if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({
    champ: file, label: file.replace(/^.*[^0-9A-Za-z_.-]/, '').replace(/[.][A-Za-z]+$/, ''),
    n: N, games: GAMES, rich: RICH, baseNative: baseNative.firstRate, baseRich: baseRich.firstRate,
    banArms: rows.filter(function (r) { return r.banLost != null; }).map(function (r) { return { name: r.name, use: r.use, banArm: r.banArm, banLost: r.banLost }; }),
    meta: metaM ? metaM[1] : '', rows: rows
  }), 'utf8');
  console.log('已写出 JSON ' + JSON_OUT);
}
console.log('\n已写出 ' + OUT + '（' + html.length + ' 字节）');
const pits = rows.filter(function (r) { return r.verdict === '坑（常用却亏）'; });
const unseen = rows.filter(function (r) { return r.verdict === '没学会的强招'; });
console.log('坑（常用却亏损）: ' + (pits.map(function (r) { return r.name + ' ' + (r.delta * 100).toFixed(1) + 'pt'; }).join(', ') || '无'));
console.log('没学会的强招  : ' + (unseen.map(function (r) { return r.name + ' +' + (r.delta * 100).toFixed(1) + 'pt'; }).join(', ') || '无'));
