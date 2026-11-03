import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

/* §E152e · 把"对手模型"这条方向的**对象**先量清楚：现役 AI 在产品里面对的是**人**，不是这 26 个脚本。
 * §E152c 的 +34.50pt 是在**脚本桌**上量的 ⇒ 它只证明"有可建模的规律"，不证明"人身上有同样的钱可赚"。
 * 本仪器做三件事（全部只读 `results/`，不写引擎、不动仓库）：
 *   ① 清点：到底有几局人类对局（DS 清单说"现有 4 局"，实际 `results/` 下远不止 ⇒ 先把样本量钉死）；
 *   ② 自重建的**自证**：从日志逐回合效果行反推每席 hp/ep，用两条独立事实校验 ——
 *      (a) `☠ 玩家N 死亡` 必须正好落在重建 hp 归零那一回合；(b) 人类/AI 不可能打出**付不起**的卡 ⇒ 违反率就是重建误差率。
 *      ⚠ 这两条不过 ⇒ 下面的"可预测性"一律不采信（先证扰动进得去 / 先证尺自己没弯，本仓老规矩）。
 *   ③ 可预测性：**同一台在线频次预测器**（先判后学）分别去预测「玩家1（人类）」与「玩家2~5（产品 AI）」的下一手，
 *      在三种条件集下报命中率 ⇒ 直接回答"该朝谁建模、人这一侧有多少规律"。
 * 席位口径：`js/ui/ui.js:636` 用 `B.state.p[0]` 判"你已被淘汰" ⇒ **导出日志里的 玩家1 = 人类**，其余是 AI。
 * ⚠ 已知偏差（`js/ui/ui.js:502` 注释原话）：人类死后自动观战那段**从不追加 transcript** ⇒ 日志只到人类死前 ⇒ 样本偏向"人类活得久的局"，
 *   且**人类死亡那一回合之后的数据不存在** ⇒ 别拿它的回合数分布说"人类倾向速战"。 */
const REPO = 'D:/code/Epirus-Web/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const ROOT = arg('root', 'results');
const OUT = arg('out', 'docs/artifacts/e152e-out');

/* ---- 卡的显示名 → {key, cat, cost}：从**引擎自己的** rules.js 里拿，绝不手抄表（"两份同构实现必漂移"） ---- */
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const R = sb.window.EpirusRules;
/* `EpirusRules` 导出的是 `skills`（数组）与 `byKey`，**没有 `CARDS`** ⇒ 从 skills 建名字表 */
const BY_NAME = {};
for (const c of (R.skills || [])) if (c && c.name) BY_NAME[c.name] = c;
if (Object.keys(BY_NAME).length < 10) { console.error('⛔ 名字表没建起来（rules.js 的导出形状变了 ⇒ 先看 `EpirusRules.skills`）'); process.exit(1); }
console.log('# §E152e 人类对局日志清点 + 可预测性 ‖ root=' + ROOT + ' ‖ 引擎卡片名 ' + Object.keys(BY_NAME).length + ' 张');

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = dir + '/' + f;
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.txt$/.test(f)) files.push(p);
  }
})(REPO + ROOT);

const ROUND_RE = /^第 (\d+) 回合：(.*)$/;
const PLAY_RE = /玩家(\d+)=【([^】]*)】/g;
const EP_RE = /🔋 玩家(\d+).*?\+1/;
const DMG_RE = /💥 玩家(\d+) 受 (\d+) 点伤害/;
const CHAIN_RE = /⚡ 玩家(\d+) 的大雷连带：玩家(\d+) 受 (\d+) 点/;
const DEAD_RE = /☠ 玩家(\d+) 死亡/;

function parseGame(path) {
  const txt = readFileSync(path, 'utf8').split(/\r?\n/);
  const modeLine = (txt.find(l => l.startsWith('模式=')) || '');
  const mode = /多人/.test(modeLine) ? 'multi' : (/长程/.test(modeLine) ? 'long' : /2人|标准/.test(modeLine) ? 'standard' : '?');
  const rounds = [];
  for (const line of txt) {
    const m = ROUND_RE.exec(line);
    if (m) {
      const plays = {};
      let mm; PLAY_RE.lastIndex = 0;
      while ((mm = PLAY_RE.exec(m[2]))) {
        const lab = mm[2];
        if (/已淘汰/.test(lab)) { plays[Number(mm[1])] = { card: null, target: null, dead: true }; continue; }
        const parts = lab.split('→');
        plays[Number(mm[1])] = { card: parts[0].trim(), target: parts[1] ? Number((parts[1].match(/(\d+)/) || [])[1]) : null, dead: false };
      }
      rounds.push({ round: Number(m[1]), plays, eps: [], dmgs: [], chains: [], deads: [] });
      continue;
    }
    if (!rounds.length) continue;
    const cur = rounds[rounds.length - 1];
    let g = EP_RE.exec(line); if (g) { cur.eps.push(Number(g[1])); continue; }
    let d = DMG_RE.exec(line); if (d) { cur.dmgs.push([Number(d[1]), Number(d[2])]); continue; }
    let c = CHAIN_RE.exec(line); if (c) { cur.chains.push([Number(c[2]), Number(c[1]), Number(c[3])]); continue; }
    let x = DEAD_RE.exec(line); if (x) { cur.deads.push(Number(x[1])); continue; }
  }
  return { path: path.replace(REPO, ''), mode, rounds, raw: txt };
}

/* ---- 重建 + 自证 ---- */
const HP0 = { multi: 3, long: 5, standard: 3, '?': 3 };
function audit(g) {
  const nSeat = Math.max(0, ...g.rounds.flatMap(r => Object.keys(r.plays).map(Number)));
  if (!nSeat) return null;
  const hp = [], ep = [], deadRound = {};
  for (let i = 1; i <= nSeat; i++) { hp[i] = HP0[g.mode] || 3; ep[i] = 0; }
  let dmgUnmatched = 0, epViol = 0, epActs = 0, unknownCost = 0;
  for (const r of g.rounds) {
    /* 快照 = **决策时**的 ep（先快照、再扣费、再结算效果 ⇒ 顺序错了会把"这回合刚攒的钱"提前算进预算） */
    r.epSnap = {}; for (let i = 1; i <= nSeat; i++) r.epSnap[i] = ep[i];
    /* 先按"决策时的 ep"校付得起，再扣费 */
    for (const k in r.plays) {
      const i = Number(k), pl = r.plays[k];
      if (pl.dead || !pl.card) continue;
      const c = BY_NAME[pl.card]; if (!c) { unknownCost++; continue; }
      const cost = Number(c.cost); if (!isFinite(cost)) { unknownCost++; continue; }
      epActs++;
      if (ep[i] < cost) epViol++;
      ep[i] -= cost; if (ep[i] < 0) ep[i] = 0;
    }
    for (const i of r.eps) if (hp[i] > 0) ep[i] = Math.min(12, ep[i] + 1);
    for (const [i, d] of r.dmgs) if (hp[i] > 0) hp[i] -= d;
    for (const [i, , d] of r.chains) if (hp[i] > 0) hp[i] -= d;
    for (const i of r.deads) { if (hp[i] > 0) dmgUnmatched++; deadRound[i] = r.round; }
    for (const i of r.deads) hp[i] = 0;
  }
  return { nSeat, hp, ep, deadRound, dmgUnmatched, epViol, epActs, unknownCost };
}

/* ---- 在线频次预测器（先判后学）：三档条件集 ---- */
function condSet(kind, seat, seatHist, r, alive) {
  const last = seatHist.length ? seatHist[seatHist.length - 1].card : '-';
  const rb = r.round <= 3 ? 'a' : r.round <= 8 ? 'b' : r.round <= 15 ? 'c' : 'd';
  if (kind === 'K1') return last;                                     /* 只看上一手（= §E152b 那把地板尺） */
  if (kind === 'K2') return last + '|' + rb;                          /* + 回合档 */
  if (kind === 'K3') return last + '|' + rb + '|' + (alive <= 2 ? 'lo' : alive <= 3 ? 'mid' : 'hi');
  /* K4 = **与引擎侧 `b-seat-nb` 同一把条件**：钱档(`ep>>1` 截 5) / 是否富(ep>=5) / 上一手
     ⇒ 只有这一行能与 §E152d 的命中率并排比；K1~K3 是内部对照（条件集更弱），别跨仪器引 */
  const epv = (r.epSnap && r.epSnap[seat]) || 0;
  return 'S' + seat + '@' + [Math.min(5, epv >> 1), epv >= 5 ? 1 : 0, last].join('/');
}
function predict(table, key, dflt) {
  const m = table.get(key); if (!m) return dflt;
  let best = dflt, bv = -1;
  for (const c in m) if (m[c] > bv) { bv = m[c]; best = c; }
  return best;
}

const KINDS = ['K1', 'K2', 'K3', 'K4'];
/* 顺手把**经验分布**导成 JSON（单一真源：这份表就是上面那台解析器产的，别让下一个人再手抄一遍人类行为）
   ⇒ 下游 `e155-humanpool.mjs` 用它造"像人一样的脚本"，把 §E152d 的建模收益从脚本桌搬到"人类形状"的环境上。 */
const EMP = { human: {}, ai: {} };
const acc = {};   /* kind -> {human:{tot,hit}, ai:{tot,hit}} */
for (const k of KINDS) { acc[k] = { human: { tot: 0, hit: 0 }, ai: { tot: 0, hit: 0 } }; }
/* 表**跨局不共享**（每局独立在线学 ⇒ 与 §E152d 的 `b-ingame` 同口径；人类/AI 各一张表，避免互相污染） */
const games = [];
let unknownNames = {};
for (const f of files) {
  const g = parseGame(f);
  if (!g.rounds.length) continue;
  const a = audit(g);
  if (!a) continue;
  for (const r of g.rounds) for (const k in r.plays) {
    const pl = r.plays[k];
    if (pl.card && !BY_NAME[pl.card]) unknownNames[pl.card] = (unknownNames[pl.card] || 0) + 1;
  }
  games.push({ path: g.path, mode: g.mode, rounds: g.rounds.length, seats: a.nSeat, unmatched: a.dmgUnmatched, epViol: a.epViol, epActs: a.epActs });
  for (const kind of KINDS) {
    const tabs = { human: new Map(), ai: new Map() };
    const hist = {}; for (let i = 1; i <= a.nSeat; i++) hist[i] = [];
    for (const r of g.rounds) {
      const alive = Object.keys(r.plays).filter(k => !r.plays[k].dead).length;
      for (const k in r.plays) {
        const i = Number(k), pl = r.plays[k];
        if (pl.dead || !pl.card) { if (pl.dead) hist[i].push({ card: '†' }); continue; }
        const who = i === 1 ? 'human' : 'ai';
        const key = condSet(kind, i, hist[i], r, alive);
        const p = predict(tabs[who], who + '|' + key, 'ジ');   /* 冷启动猜"拿 1 ジ"⇒ 与日志里的显示名同一套标签 */
        acc[kind][who].tot++; if (p === pl.card) acc[kind][who].hit++;
        let m = tabs[who].get(who + '|' + key); if (!m) { m = {}; tabs[who].set(who + '|' + key, m); }
        m[pl.card] = (m[pl.card] || 0) + 1;
        if (kind === 'K4') { const e = EMP[who]; e[key] = e[key] || {}; e[key][pl.card] = (e[key][pl.card] || 0) + 1; }
        hist[i].push({ card: pl.card });
      }
    }
  }
}

/* ---- 打印 ---- */
const withHuman = games.filter(x => x.seats >= 3);
console.log('\n  日志文件 ' + files.length + ' 个 ‖ 解析成功 ' + games.length + ' ‖ ≥3 席 ' + withHuman.length +
  ' ‖ 回合合计 ' + games.reduce((s, x) => s + x.rounds, 0) + ' ‖ 模式：' +
  Object.entries(games.reduce((o, x) => (o[x.mode] = (o[x.mode] || 0) + 1, o), {})).map(([k, v]) => k + '=' + v).join(' '));
const un = games.reduce((s, x) => s + x.unmatched, 0), ev = games.reduce((s, x) => s + x.epViol, 0), ea = games.reduce((s, x) => s + x.epActs, 0);
console.log('  自证：死亡行与重建 hp 不同步 ' + un + ' 处 ‖ "付不起却打了" ' + ev + '/' + ea + ' = **' + (100 * ev / Math.max(1, ea)).toFixed(1) + '%**');
console.log('    ⇒ 前者应为 0（否则 hp 重建不可信）；后者是 ep 重建的误差率（日志里没有费用行，只能靠规则反推 ⇒ 不为 0 就**别用 ep 档**）');
const unKnownList = Object.entries(unknownNames).sort((a, b) => b[1] - a[1]).slice(0, 8);
if (unKnownList.length) console.log('  ⚠ 日志里出现但 `rules.js` 名字表没有的标签（这些卡的 cost/cat 拿不到 ⇒ 从条件里掉了）：' + unKnownList.map(([k, v]) => k + '(' + v + ')').join(' '));

console.log('\n  条件集            人类下一手命中        产品AI 下一手命中      差(人类−AI)');
for (const k of KINDS) {
  const h = acc[k].human, a2 = acc[k].ai;
  const hp = 100 * h.hit / Math.max(1, h.tot), ap = 100 * a2.hit / Math.max(1, a2.tot);
  console.log('  ' + k.padEnd(16) + (hp.toFixed(1) + '% (n=' + h.tot + ')').padStart(14) + (ap.toFixed(1) + '% (n=' + a2.tot + ')').padStart(20) + (hp - ap).toFixed(1).padStart(10) + 'pt');
}
console.log('\n  ⚠ **只能在仪器内部比**：这里每局只有 ~18 个人类决策可学（56 局），引擎侧那臂每桌有 10 局 × 数百度可攒 ⇒');
console.log('  命中率绝对值**不可与 §E152d 并排引**（跨仪器混引 = 我刚立的第 14 条陷阱）。可信的是同仪器内"人类席 vs 产品 AI 席"这一列差。');
console.log('  K1~K3 = 上一手 / +回合档 / +存活人数档（跨席池化）；K4 = 钱档+是否富+上一手 + **按席分开**（形状上与引擎侧 `b-seat-nb` 同构，仍不等于它的样本量与清空时机）。');
mkdirSync(REPO + OUT, { recursive: true });
writeFileSync(REPO + OUT + '/games.tsv', ['file\tmode\tseats\trounds\thpUnmatched\tepViol\tepActs'].concat(
  games.map(x => [x.path, x.mode, x.seats, x.rounds, x.unmatched, x.epViol, x.epActs].join('\t'))).join('\n') + '\n');
console.log('  逐局清单 → ' + OUT + '/games.tsv');
/* 导成**入库**的文件（`*-out/` 被 .gitignore 忽略 ⇒ 经验分布必须放在 `docs/artifacts/` 顶层，否则下一班会拿到结论却拿不到数据） */
writeFileSync(REPO + 'docs/artifacts/human-behavior.json', JSON.stringify({
  generatedBy: 'docs/artifacts/e152e-human.mjs',
  note: '键 = S<席>@<钱档 ep>>1 截 5>/<ep>=5>/<上一手显示名>；值 = {卡显示名: 次数}。席号在人类日志里 1=人类、2~5=产品 AI。'
    + ' ⚠ ep 是从效果行反推的（违反率 ' + (100 * ev / Math.max(1, ea)).toFixed(1) + '%）⇒ 钱档只当**分档**用，别当精确余额。',
  games: games.length, rounds: games.reduce((s, x) => s + x.rounds, 0),
  epViolRate: ev / Math.max(1, ea), human: EMP.human, ai: EMP.ai
}, null, 1));
console.log('  经验分布 → docs/artifacts/human-behavior.json（人类键 ' + Object.keys(EMP.human).length + ' 个 ‖ AI 键 ' + Object.keys(EMP.ai).length + ' 个）');
