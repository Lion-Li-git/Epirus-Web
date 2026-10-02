/* 配置轴筛查（10-02 · DS · 「按配置换策略」落点的**可分辨性 + 承接体**双筛查 · 只读）
 *
 * 为什么要它：10-02 那条"经济轴"线收敛到"要靠改费用表"，而**承接体（那张脸）自己接不住条件性**
 * （§E225/§4.8）。⇒ 按提案 §5 的备选，把头号目标"在不同环境用不同策略"**换一个落点**：
 * 不挂"对手身份"（本仓原先的"环境"就是它，§E222 已关），改挂**游戏自己的配置**（血量 / 人数）。
 *
 * 本工具把 §E226 在**对手轴**上用过的同一套方法（"参照探针的名次会不会随轴变"）搬到**配置轴**上，
 * 一次回答两个问题（单自由度：同一轮里**只动配置**，对手轮换与种子带固定）：
 *   ① **轴存在性**：六枚参照探针的名次在两个配置之间会不会变？
 *      ρ ≈ 1 ⇒ 同一张考卷复印 ⇒ 配置**不是一根轴**；ρ ≈ 0 甚至为负 ⇒ **它会重排策略** ⇒ 是真轴。
 *   ② **承接体**：同一张脸（现役 3P 冠军）在配置间的**行为构成**会不会变？（零额外 rollout，只看它自己出的手）
 *
 * ⚠️ 三条口径限定（引用本工具读数前必须一起引）：
 *   · **6 枚探针 ⇒ 单条 ρ 的噪声约 ±0.45**（n=6）⇒ **不许引单条 ρ 的绝对值**；
 *     可引的是 (a) 某枚探针在配置上的**电平梯**（每格 800 局 ⇒ ±3.5pt）与 (b) ρ 的**跨对散布**。
 *   · 4 个配置是**两因子**（血量 × 人数）⇒ 只有**两对**是干净的单因子对照：
 *     `multi/5 ↔ long/5`（只动血量）与 `multi/3 ↔ multi/5`（只动人数）。其余对比不许单独归因。
 *   · `standard`(2P) **未量**（那是另一只包）；本工具量的是 3P 包在各配置下的表现。
 *   · ③ 里 `局长`/`出手` 的配置间差异很大 ⇒ "行为比率持平"**不是**"没有条件化"的严格证明；
 *     但**与 ① 指向相反**的那一列是硬读数（见 10-02 提案 §3）。
 *
 * 用法：node tools/probe-config-axis.mjs [--games=400] [--seeds=3100,9200] [--champion=js/bundled-champion-3p.js]
 */
import { sandbox, mulberry32, loadChamp } from './audit-lib.mjs';

const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const GAMES = Math.max(1, Number(flag('games', 400)) || 400);
const SEEDS = String(flag('seeds', '3100,9200')).split(',').map(Number).filter(Boolean);
const CHAMP = String(flag('champion', 'js/bundled-champion-3p.js'));
const TEMP = 0.15;

const W = sandbox(), S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots, R = W.EpirusRules;
const champ = loadChamp(W, CHAMP);
const params = champ && champ.params ? champ.params : champ;
const idx = {};
for (const k in R.skills) { const s = R.skills[k]; if (s && s.key) idx[s.key] = { cost: s.cost || 0, cat: s.cat, dmg: !!s.dmg }; }
const OPP = [B.pickBalanced, B.pickAggro, B.pickDefend, B.pickMix, B.pickFarmer];
const CONFIGS = [['multi', 3], ['multi', 4], ['multi', 5], ['long', 5]];
const cheapest = a => { let b = a[0]; for (const x of a) if (idx[x.key].cost < idx[b.key].cost) b = x; return b; };
const dearest = a => { let b = a[0]; for (const x of a) if (idx[x.key].cost > idx[b.key].cost) b = x; return b; };
const REFS = {
  packG: () => T.policyChooserN(params, 0),
  packT: () => T.policyChooserN(params, TEMP),
  saver: () => (st, pid, lg) => { const a = lg.filter(l => l.affordable); return a.length ? cheapest(a) : null; },
  spender: () => (st, pid, lg) => { const a = lg.filter(l => l.affordable); return a.length ? dearest(a) : null; },
  defSpam: () => (st, pid, lg) => { const a = lg.filter(l => l.affordable); const d = a.filter(x => idx[x.key].cat === R.CAT.DEFENSE); return d.length ? d[0] : (a[0] || null); },
  atkSpam: () => (st, pid, lg) => { const a = lg.filter(l => l.affordable); const k = a.filter(x => idx[x.key].cat === R.CAT.ATTACK); return k.length ? k[0] : (a[0] || null); }
};
const REFN = Object.keys(REFS);
const ROWS = {};
for (const [modeKey, n] of CONFIGS) {
  const key = modeKey + '/' + n;
  ROWS[key] = {};
  for (const refName of REFN) {
    const agg = { games: 0, win: 0, acts: 0, spend: 0, epSum: 0, epMax: 0, ji: 0, def: 0, atk: 0, ring: 0, rounds: 0, bySeed: {} };
    for (const seed of SEEDS) for (let g = 0; g < GAMES; g++) {
      const rnd = mulberry32(seed + g * 7919 + n * 131 + modeKey.length * 17);
      const st = S.createState(modeKey, { next: rnd }, n);
      st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3779b9) >>> 0;
      const own = REFS[refName]();
      const focus = (state, pid, legal) => {
        const r = own(state, pid, legal);
        if (r) {
          agg.acts++; agg.spend += idx[r.key].cost; agg.epSum += (state.p[pid].ep || 0);
          agg.epMax = Math.max(agg.epMax, state.p[pid].ep || 0);
          if (r.key === R.SK.JI) agg.ji++; else if (idx[r.key].cat === R.CAT.DEFENSE) agg.def++;
          else if (idx[r.key].cat === R.CAT.ATTACK) agg.atk++;
          if (r.key === R.SK.RING) agg.ring++;
        }
        return r;
      };
      const cs = [focus];
      for (let i = 1; i < n; i++) cs.push(OPP[(i - 1) % OPP.length]);
      Play.autoGameN(st, cs);
      agg.games++; agg.rounds += st.round;
      if (st.winner === 0) agg.win++;
      const bs = agg.bySeed[seed] = agg.bySeed[seed] || { games: 0, win: 0 };
      bs.games++; if (st.winner === 0) bs.win++;
    }
    ROWS[key][refName] = agg;
  }
  process.stdout.write('.');
}
console.log('\n');
const wr = a => 100 * a.win / Math.max(1, a.games);
const mean = x => x.reduce((a, b) => a + b, 0) / x.length;
const rank = v => v.map((x, i) => [x, i]).sort((p, q) => q[0] - p[0]).map(x => x[1]);
const spearman = (x, y) => { const n = x.length, rx = rank(x), ry = rank(y), mx = mean(rx), my = mean(ry);
  let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (rx[i] - mx) * (ry[i] - my); b += (rx[i] - mx) ** 2; c += (ry[i] - my) ** 2; }
  return b && c ? a / Math.sqrt(b * c) : NaN; };
const KEYS = CONFIGS.map(c => c[0] + '/' + c[1]);

console.log('# 配置轴筛查（参照 ' + REFN.length + ' 枚 · 每格 ' + (GAMES * SEEDS.length) + ' 局 · 冠军 = ' + CHAMP + '）');
console.log('‖ 各 mode：' + Object.keys(R.MODES).map(k => k + '(hp=' + R.MODES[k].hp + ')').join(' · '));
console.log('\n## ① 参照探针夺冠 %（每格 ' + (GAMES * SEEDS.length) + ' 局）');
console.log('| 配置 | ' + REFN.join(' | ') + ' | spread |');
console.log('|---|' + REFN.map(() => '---').join('|') + '|---|');
for (const k of KEYS) { const v = REFN.map(r => wr(ROWS[k][r])); console.log('| `' + k + '` | ' + v.map(x => x.toFixed(1)).join(' | ') + ' | ' + (Math.max(...v) - Math.min(...v)).toFixed(1) + 'pt |'); }

console.log('\n## ② 配置两两之间的名次一致性（ρ；⚠️ 6 枚探针 ⇒ 单条噪声 ±0.45，不许引绝对值）');
for (let i = 0; i < KEYS.length; i++) for (let j = i + 1; j < KEYS.length; j++) {
  const own = ((KEYS[i] === 'multi/5' && KEYS[j] === 'long/5') || (KEYS[i] === 'multi/3' && KEYS[j] === 'multi/5'));
  console.log('  `' + KEYS[i] + '` ↔ `' + KEYS[j] + '`  ρ = **' + spearman(REFN.map(r => wr(ROWS[KEYS[i]][r])), REFN.map(r => wr(ROWS[KEYS[j]][r]))).toFixed(3) + '**' + (own ? '  ← **干净单因子对照**' : ''));
}

console.log('\n## ③ 承接体：现役冠军自己的行为构成（分母 = 它全部出手）');
console.log('| 配置 | 夺冠% | 出手/局 | ジ% | 防御% | 攻击% | 聚能环% | 花费/手 | 决策时 ep 均值 | ep 峰值 | 局长 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const k of KEYS) {
  const a = ROWS[k].packT, n1 = Math.max(1, a.acts);
  console.log('| `' + k + '` | ' + wr(a).toFixed(1) + ' | ' + (a.acts / a.games).toFixed(1) + ' | ' +
    (100 * a.ji / n1).toFixed(1) + ' | ' + (100 * a.def / n1).toFixed(1) + ' | ' + (100 * a.atk / n1).toFixed(1) + ' | ' +
    (100 * a.ring / n1).toFixed(1) + ' | ' + (a.spend / n1).toFixed(2) + ' | ' + (a.epSum / n1).toFixed(2) + ' | ' + a.epMax + ' | ' + (a.rounds / a.games).toFixed(1) + ' |');
}
if (SEEDS.length >= 2) {
  const b1 = SEEDS[0], b2 = SEEDS[1];
  const rate = (kc, r, band) => { const a = ROWS[kc][r].bySeed[band]; return a ? 100 * a.win / Math.max(1, a.games) : NaN; };
  const meanOver = f => KEYS.reduce((s, kc) => s + f(kc), 0) / KEYS.length;
  let shared = null, sv = -Infinity;
  for (let i2 = 0; i2 < REFN.length; i2++) { const v = meanOver(kc => rate(kc, REFN[i2], b1)); if (v > sv) { sv = v; shared = REFN[i2]; } }
  const sharedB2 = meanOver(kc => rate(kc, shared, b2));
  const per = KEYS.map(kc => { let b = null, v = -Infinity;
    for (let i2 = 0; i2 < REFN.length; i2++) { const x = rate(kc, REFN[i2], b1); if (x > v) { v = x; b = REFN[i2]; } }
    return { k: kc, ref: b, b1: v, b2: rate(kc, b, b2) }; });
  const perB2 = per.reduce((s, x) => s + x.b2, 0) / per.length;
  const champB2 = meanOver(kc => rate(kc, 'packT', b2));
  console.log('\n## ④ **样本外**的「按配置换策略 vs 一套打天下」（band1=' + b1 + ' 选、band2=' + b2 + ' 评）');

  console.log('  ‖ 一套打天下：band1 上平均最好的是 ' + shared + '（' + sv.toFixed(1) + '%）=> band2 平均 ' + sharedB2.toFixed(1) + '%');
  console.log('  ‖ 按配置换：' + per.map(x => x.k + '->' + x.ref + '(' + x.b2.toFixed(1) + '%)').join(' · '));
  console.log('  ‖ => band2 平均 ' + perB2.toFixed(1) + '% ；冠军 packT 同口径 ' + champB2.toFixed(1) + '%');
  console.log('  ‖ => **条件性价值（探针级下界）= ' + (perB2 - sharedB2 >= 0 ? '+' : '') + (perB2 - sharedB2).toFixed(1) + 'pt** ；取该配置最好的探针相对冠军的总增益 = ' + (perB2 - champB2 >= 0 ? '+' : '') + (perB2 - champB2).toFixed(1) + 'pt');
  console.log('  ⚠ **这不是 S3 的真上界**：只在 6 枚故意笨的探针里挑，真 oracle 可能高得多 => 只读作「在这些策略之间按配置挑，值不值」。');
  console.log('  ⚠ 选/评已分离（band1 选、band2 评）=> 不含 §E200 那种「在噪声上取最大」的膨胀；但每格 ' + GAMES + ' 局 => ±7pt。');
}
console.log('\n## 复跑命令\n  node tools/probe-config-axis.mjs --games=' + GAMES + ' --seeds=' + SEEDS.join(',') + ' --champion=' + CHAMP);
console.log('rc=0');
