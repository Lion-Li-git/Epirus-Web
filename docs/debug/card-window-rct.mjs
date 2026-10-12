/* card-window-rct.mjs —— 弱卡"**什么时候有用**"的分层配对随机对照（研究件，不进判据）
 *
 * 为什么总分不够用：`tools/probe-skill-marginal.mjs` 量的是"平均多打一手值多少胜率"。
 *   同一个 −3pt 可能是"低血时 +15 / 满血时 −12"摊出来的 ⇒ 用户那句"相对有用的时候"在那张表里**看不见形状**。
 *   （10-13 就有这个形状：`原型制御` 原生 −11.3±3.1 而定向垫钱 +3.0/+6.0 ‖ 几张防御卡 multi 负、long 正。）
 *
 * 做法（**配对**，不是两次独立抽样）：每一局拿同一个 seed、同一批对手跑两遍 ——
 *   A 臂 =「这张卡一合法且买得起就打」‖ B 臂 =「一次都不打，全交给冠军自己的选择」
 *   ⇒ 两遍之间只差这一件事，每对的胜负差 d = 赢−输 ∈ {−1,0,+1}；按局势分层的 Δ 因此是**因果**的，
 *     不是"它用了就赢"那种相关性（那种是选择效应：快死了才打死守 ⇒ 守与输同时发生）。
 *   局势标签取自 **B 臂**（不受处理污染）：A 臂里局势可能因为打不打而改变，拿它分层会把因果反过来。
 * 局势（全部是决策时刻可观察的事实，不用"别人这回合打了谁"这种事后信息——本引擎是同时出手，看不到）：
 *   血 1 / 2 / ≥3 ‖ 刚够钱(ep ≤ 需求) vs 宽裕 ‖ 存活人数 ‖ 回合段 ‖ 身上有无符咒 ‖ 我是不是血最厚的那个
 * 口径来源：`T.policyChooserN(params,0.15)`（与门禁/镜像同源）‖ `T.pickTargetN` 选目标（本脚本不自己拍）‖
 *   `Play.legalActions` 出来的 `affordable` 判机会 ‖ `S.computeCost` 判"刚够/宽裕" ⇒ **没有第二份引擎实现**。
 *
 * 用法：node docs/debug/card-window-rct.mjs [--cards=proto,transfer,...] [--games=1200] [--mode=multi|long]
 *        [--pack=js/bundled-champion-3p.js] [--n=5] [--out=某.tsv]
 * 退出码：0 ‖ 2 输入不齐（卡名解不到 key ⇒ 宁可红，不许悄悄少测一张）‖ 8 一局都没跑成
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, rejectUnknownFlags } from '../../tools/audit-lib.mjs';

rejectUnknownFlags(process.argv.slice(2), ['cards', 'games', 'mode', 'pack', 'n', 'out', 'seed', 'dose'], 'card-window-rct');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const h = process.argv.find(a => a.indexOf('--' + k + '=') === 0); return h ? h.slice(('--' + k + '=').length) : d; };
const G = Number(arg('games', 1200)), MODE = arg('mode', 'multi'), NP = Math.max(1, Number(arg('n', 5)));
const PACK = arg('pack', 'js/bundled-champion-3p.js'), SEED0 = Number(arg('seed', 20261013));
const CARDS = String(arg('cards', 'proto,transfer,taunt,armor,jinshield,shift,holo,firestorm,curse,cannon'))
  .split(',').map(s => s.trim()).filter(Boolean);
/* `--dose` = A 臂"有这个机会时打它的概率"。dose=1 是"一有机会就打"（极端剂量，用来量形状）；
 *   要"轻度多用值多少"就调低它 —— 注意 dose 低了注入次数就少，每格的 n 与 SE 跟着变差，别把噪声读成窗口。*/
const DOSE = Math.min(1, Math.max(0, Number(arg('dose', 1))));

const W = sandbox(ROOT);
const S = W.EpirusState, T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
const params = loadChamp(W, PACK, ROOT);
if (!params) { console.error('⛔ 读不出被测包：' + PACK); process.exit(2); }
const bad = CARDS.filter(k => !(R.byKey || {})[k]);
if (bad.length) { console.error('⛔ 卡名解不到 key：' + bad.join(' ') + ' ⇒ 不许当成"没测到"，先改对'); process.exit(2); }
const NAME = k => (R.byKey[k] || {}).name || k;
const POOL = [B.pickAggro, B.pickBalanced, B.pickDefend, B.pickWall, B.pickFarmer,
  B.pickMix, B.pickBeadBurst, B.pickComboCounter, B.pickRandom];

function costOf(state, pid, key) {
  const c = S.computeCost(state, pid, key);
  return (c && (c.ok === true || c.ep != null)) ? (c.ep || 0) : null;
}
/* 决策时刻的局势（`pid` = 受评席）。"刚够"= 手上 ep 正好够这一手，没有余粮 */
function windows(state, pid, key) {
  const me = state.p[pid], need = costOf(state, pid, key);
  const alive = state.p.filter(q => q.hp > 0);
  const topHp = Math.max.apply(null, alive.map(q => q.hp));
  return ['血:' + (me.hp <= 1 ? '1' : me.hp === 2 ? '2' : '≥3'),
    '钱:' + (need == null ? '算不出' : me.ep <= need ? '刚够' : '宽裕'),
    '活:' + (alive.length <= 2 ? '2人' : alive.length === 3 ? '3人' : '4-5人'),
    '回合:' + (state.round <= 5 ? '1-5' : state.round <= 15 ? '6-15' : '≥16'),
    '咒:' + ((me.stickers && me.stickers.length) ? '身上有符咒' : '无符咒'),
    '位:' + (me.hp >= topHp ? '我血最厚' : '我不是最厚')];
}
/* take=1 ⇒ 一有机会就打这张卡；take=0 ⇒ 从不打。返回胜负 + B 臂遇到的局势集合 */
function playOne(key, take, seed, seat, g) {
  const bs = T.policyChooserN(params, 0.15);
  const rnd = T.mulberry32((((seed ^ 0x5bf03635) >>> 0) + (take ? 7 : 1)) >>> 0);
  const winSet = new Set(); let chances = 0, hits = 0;
  const sel = function (state, pid, legal) {
    const l = legal.find(x => x.key === key && x.affordable);
    if (l) {
      chances++;
      if (!take) for (const w of windows(state, pid, key)) winSet.add(w);
      else if (DOSE >= 1 || rnd() < DOSE) {
        hits++;
        const t = T.pickTargetN(state, pid, key);
        return t == null ? { key: key } : { key: key, target: t };
      }
    }
    return bs(state, pid, legal);
  };
  const ch = [];
  for (let pid = 0; pid < 5; pid++) ch.push(pid === seat ? sel : POOL[(g * 3 + pid) % POOL.length]);
  const r = T.oneGameN(ch, seed, 5, { mode: MODE });
  if (r.state.winner == null) return { won: 0, wins: winSet, chances: chances, hits: hits };
  return { won: r.state.winner === seat ? 1 : 0, wins: winSet, chances: chances, hits: hits };
}

console.log('# 弱卡"什么时候有用"·分层配对 RCT ‖ 包=' + PACK + ' ‖ 模式=' + MODE + ' ‖ 配对 ' + G + ' 对（每对两遍同 seed 同对手）‖ 对手线 ' + NP + '/9 ‖ A 臂剂量 dose=' + DOSE);
console.log('# A=一有机会就打这张卡 ‖ B=一次都不打 ‖ 局势标签取自 B 臂 ‖ Δ = A 臂夺冠 − B 臂夺冠（配对）\n');
const rows = []; let played = 0;
for (const key of CARDS) {
  const agg = {};   // 局势 → {n, sd, s2}
  let nAll = 0, dAll = 0, sAll2 = 0, opp = 0, hitsPer = 0, chancePer = 0;
  for (let g = 0; g < G; g++) {
    const seed = (SEED0 + g * 7919) >>> 0, seat = g % 5;
    const a = playOne(key, 1, seed, seat, g);
    const b = playOne(key, 0, seed, seat, g);
    played++;
    hitsPer += a.hits; chancePer += b.chances;
    const d = a.won - b.won;
    if (b.wins.size) { opp++; nAll++; dAll += d; sAll2 += d * d; }
    for (const w of b.wins) { const s = agg[w] || (agg[w] = { n: 0, sd: 0, s2: 0 }); s.n++; s.sd += d; s.s2 += d * d; }
  }
  const mk = (s) => { const m = s.n ? s.sd / s.n : 0;
    const se = s.n > 1 ? Math.sqrt(Math.max(0, s.s2 / s.n - m * m) / (s.n - 1)) : Infinity;
    return { m: m, se: se }; };
  const all = mk({ n: nAll, sd: dAll, s2: sAll2 });
  console.log('== ' + NAME(key) + '（`' + key + '`）‖ B 臂遇到过它的机会 ' + (chancePer / G).toFixed(2) + ' 次/局 ‖ A 臂真打 ' +
    (hitsPer / G).toFixed(2) + ' 次/局 ‖ 有对可比的局 ' + opp + '/' + G);
  console.log('   整体 Δ夺冠 ' + (all.m >= 0 ? '+' : '') + (all.m * 100).toFixed(1) + '% ±' + (all.se * 100).toFixed(1) +
    (nAll > 30 && Math.abs(all.m) > 2 * all.se ? (all.m > 0 ? '  ← 平均而言该多用' : '  ← 平均而言该少用') : ' （噪声内）'));
  const list = Object.keys(agg).map(w => ({ w: w, n: agg[w].n, r: mk(agg[w]) })).sort((x, y) => y.r.m - x.r.m);
  for (const l of list) {
    const sig = l.n > 30 && isFinite(l.r.se) && Math.abs(l.r.m) > 2 * l.r.se;
    /* 「相对整体」= 这一格的 Δ 减掉这张卡的总 Δ ⇒ 读的是"**这个窗口比平均更值 / 更亏**"。
     *   没有这一列，一张整体 −21 的卡会把"−14（其实比平均好 7pt）"读成"亏"，反过来也会把"整体噪声里的格"读成有用。
     *   SE 用两格独立的粗算（实际有共同的对，偏乐观），所以只当**排序线索**用，别当判据。*/
    const rel = l.r.m - all.m, relSe = (isFinite(l.r.se) && isFinite(all.se)) ? Math.sqrt(l.r.se * l.r.se + all.se * all.se) : NaN;
    console.log('   ' + l.w.padEnd(13) + 'n=' + String(l.n).padStart(5) + '  Δ ' + (l.r.m >= 0 ? '+' : '') +
      (l.r.m * 100).toFixed(1) + '% ±' + (isFinite(l.r.se) ? (l.r.se * 100).toFixed(1) : '?') +
      '   相对整体 ' + (rel >= 0 ? '+' : '') + (rel * 100).toFixed(1) + '±' + (isFinite(relSe) ? (relSe * 100).toFixed(0) : '?') +
      (sig ? (l.r.m > 0 ? '  ← 绝对也赢' : '  ← 绝对也亏') : (l.n <= 30 ? '（样本太少）' : '（绝对噪声内）')));
    rows.push({ card: NAME(key), key: key, win: l.w, n: l.n, d: l.r.m.toFixed(4), se: isFinite(l.r.se) ? l.r.se.toFixed(4) : '', rel: rel.toFixed(4) });
  }
  rows.push({ card: NAME(key), key: key, win: '(整体)', n: nAll, d: all.m.toFixed(4), se: isFinite(all.se) ? all.se.toFixed(4) : '' });
  console.log('');
}
if (!played) { console.error('⛔ 一局都没跑成 ⇒ 装配坏了，不许交空表'); process.exit(8); }
const OUT = arg('out', '');
if (OUT) {
  const H = ['card', 'key', 'window', 'n', 'delta', 'se', 'relVsCard'];
  writeFileSync(join(ROOT, OUT), H.join('\t') + '\n' +
    rows.map(r => [r.card, r.key, r.win, r.n, r.d, r.se, r.rel == null ? '' : r.rel].join('\t')).join('\n') + '\n', 'utf8');
  console.log('✔ 已写 ' + OUT + '（' + rows.length + ' 行）');
}
