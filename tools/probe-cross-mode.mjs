/* tools/probe-cross-mode.mjs —— **通吃矩阵**：一包在"模式 × 对手环境"的每一格里到底赢多少（qoder 0923 夜 · §N27）
 *
 * 起因（用户 09-22 的目标）："理想情况下应该炼一个 5 血长程能通吃其他模式" —— 而仓里**没有任何一件工具**能一次回答这句：
 *   `mirrorHealth` 只在一种模式下测 5 席（它是体检的 G 那列）；2P 考卷只测 2 人；`champ-audit` 一行一个装配。
 *   于是"通吃"一直被当成**形容词**用，不是一张表。
 * 本工具把它变成表：**同一批种子**下逐格跑，行=包、列=格，三件事一起读：**胜负 / 座位偏置 / 兑现广度**。
 *
 * 格子（列）：`2P`(standard,n=2) · `3P`/`4P`/`5P`(multi) · `长程`(long)
 * 对手环境（每个环境一张表）：
 *   `镜像`   —— 全场都用被测包（= 体检 G 那列的装配）⇒ 量"自洽打法在每种模式下走不走得通"；
 *   `脚本池` —— 其余席从固定脚本池取（与 `probe-cast-vs-land`/`aggressionProfile` 同一份 `EpirusBots`）⇒ 量"打人类套路"；
 *   `对现役` —— 其余席用**现役包**（`--ref=`，默认 `js/bundled-champion-3p.js`）⇒ 这才是"换包上去会不会更差"的那一问。
 * 配对：所有包在所有格里用**同一批种子**（`SEED0 + g*7919`）⇒ 差值可直接比，不被种子噪声污染。
 * 座位：受评席 = `g % n` 逐局轮转（不是恒 0 号座）；**极差**（该格内各席胜率最大−最小）一并印出来，
 *       因为"1st 很高但全压在 0 号座"与"1st 略低但四席都赢"是两种完全不同的包（v1.5.65 的座位偏置病）。
 *
 * ⚠️ 本工具**只是量具，不是判据**：它不写产物、不阻断任何东西，"通吃分"也**没有阈值**——
 *    要不要拿它当门、线画在哪，属于判据改动，按本仓规矩要用户裁定（见 RESEARCH-LOG §N27 末的"待裁"）。
 *
 * 用法：node tools/probe-cross-mode.mjs [包文件...] [--games=40] [--ref=js/bundled-champion-3p.js]
 *                                     [--cells=2P,3P,4P,5P,长程] [--fields=mirror,pool,vschamp] [--json]
 * 不传包 ⇒ 默认量"两槽 + 现役 3P"。文件外壳由 `js/champion-pack.js` 的 `extract` 剥（单一来源，与页面「导入冠军包」同一条路）。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const arg = function (k, d) { const h = process.argv.find(function (a) { return a.indexOf('--' + k + '=') === 0; }); return h ? h.split('=')[1] : d; };
const GAMES = Number(arg('games', 40));
const REF = arg('ref', 'js/bundled-champion-3p.js');
const SEED0 = Number(arg('seed', 20260923));
const ASJSON = process.argv.indexOf('--json') >= 0;

const sb = {
  console: { log: function () { }, warn: function () { }, error: console.error },
  Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Float64Array, Date
};
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/champion-pack.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, B = sb.window.EpirusBots;
const XP = sb.window.EpirusChampionPack;   // v1.5.141 起的**剥壳单一来源**（不在此重写第二种正则）
if (!XP || typeof XP.extract !== 'function') { console.error('⛔ 拿不到 EpirusChampionPack.extract（解析口径必须与页面导入同源）'); process.exit(2); }

/* ===== 表头：模式格 × 对手环境 ===== */
const ALL_CELLS = [
  { id: '2P', mode: 'standard', n: 2 },
  { id: '3P', mode: 'multi', n: 3 },
  { id: '4P', mode: 'multi', n: 4 },
  { id: '5P', mode: 'multi', n: 5 },
  { id: '长程', mode: 'long', n: Number(arg('long-n', 5)) }
];
const CELLS = arg('cells', ALL_CELLS.map(function (c) { return c.id; }).join(',')).split(',').map(function (id) {
  const c = ALL_CELLS.find(function (x) { return x.id === id.trim(); });
  if (!c) { console.error('⛔ 不认识的格子：' + id + '（可选 ' + ALL_CELLS.map(function (x) { return x.id; }).join(',') + '）'); process.exit(2); }
  return c;
});
const ALL_FIELDS = [{ id: 'mirror', label: '镜像（全场同一包）' }, { id: 'pool', label: '脚本池（其余席轮换固定套路）' }, { id: 'vschamp', label: '对现役（其余席 = 现役包）' },
  /* v1.5.172（§N37）：**破防栏** —— 其余 4 席全部 `pickGuardSpam`（只防御不还手）。
   * 为什么单独加一栏（实测）：`gate-drafts` 的 G5 用这一场判过今晚所有臂 ⇒ `xn15c 98% / xn17b 65~70% / xn23b 48~55% 防席夺冠`，
   * 而**现役包是 0%**、`xn14a-band2` 长程 23% —— 这是一条我从没在任何表里量过、却能一刀分开"在位水平 vs 臂产物"的轴。
   * 它量的正是用户那句话里的"适应能力"：对面不跟你打，你会不会收尾。 */
  { id: 'guardwall', label: '破防（其余席只防御不还手）' }];
const FIELDS = arg('fields', ALL_FIELDS.map(function (f) { return f.id; }).join(',')).split(',').map(function (id) {
  const f = ALL_FIELDS.find(function (x) { return x.id === id.trim(); });
  if (!f) { console.error('⛔ 不认识的环境：' + id); process.exit(2); }
  return f;
});

function loadPack(file) {
  const ex = XP.extract(readFileSync(file, 'utf8'));
  if (!ex || !ex.ok) { console.error('⛔ 解析失败：' + file); process.exit(2); }
  const params = P.unpack(ex.pack, true);
  if (!params) { console.error('⛔ unpack 不出参数向量：' + file); process.exit(2); }
  return { slot: ex.slot, params: params };
}
const files = process.argv.slice(2).filter(function (a) { return a.indexOf('--') !== 0; });
const list = files.length ? files : [REF, 'js/bundled-champion.js'];
const packs = list.map(function (f) { const p = loadPack(f); return { file: f, label: f.replace(/^.*[\\/]/, '').replace(/\.bak$/, '').replace(/\.js$/, ''), slot: p.slot, params: p.params }; });
const refPack = loadPack(REF);

const POOL = [B.pickAggro, B.pickBalanced, B.pickDefend, B.pickWall, B.pickFarmer, B.pickMix, B.pickBeadBurst, B.pickComboCounter, B.pickRandom];
function entropyOf(counts) {
  const ks = Object.keys(counts).filter(function (k) { return counts[k] > 0; });
  const tot = ks.reduce(function (a, k) { return a + counts[k]; }, 0);
  if (!tot) return { eff: 0, distinct: 0, tot: 0 };
  let H = 0; for (const k of ks) { const pr = counts[k] / tot; H -= pr * Math.log(pr); }
  return { eff: Math.exp(H), distinct: ks.length, tot: tot };
}

const out = [];
for (const fd of FIELDS) {
  const rows = [];
  for (const pk of packs) {
    const row = { field: fd.id, pack: pk.label, cells: {} };
    for (const cell of CELLS) {
      const bs = T.policyChooserN(pk.params, 0.15);
      const refBs = T.policyChooserN(refPack.params, 0.15);
      let first = 0, draws = 0, rounds = 0;
      const seatW = new Array(cell.n).fill(0), seatD = new Array(cell.n).fill(0);
      const cast = {}, land = {};
      for (let g = 0; g < GAMES; g++) {
        const seat = g % cell.n;                       // 受评席逐局轮转（去座位偏置）
        const ch = [];
        for (let pid = 0; pid < cell.n; pid++) {
          let fn;
          if (pid === seat) fn = function (s2, p2, lg) { return bs(s2, p2, lg); };
          else if (fd.id === 'mirror') fn = function (s2, p2, lg) { return bs(s2, p2, lg); };
          else if (fd.id === 'pool') { const bot = POOL[(g * 3 + pid) % POOL.length]; fn = function (s2, p2, lg) { return bot(s2, p2, lg); }; }
          else if (fd.id === 'guardwall') fn = function (s2, p2, lg) { return B.pickGuardSpam(s2, p2, lg); };
          else fn = function (s2, p2, lg) { return refBs(s2, p2, lg); };
          ch.push(fn);
        }
        const r = T.oneGameN(ch, SEED0 + g * 7919, cell.n, { mode: cell.mode });
        const w = r.state.winner;
        rounds += r.state.round;
        seatD[seat]++;
        if (w === 'draw' || w == null) draws++;
        else { seatW[seat]++; if (w === seat) first++; }
        for (const e of r.state.events) {
          /* ⚠️ 两种事件的"是谁"字段不同：`action` 带 `pid`（谁出的手），`damage` 带 `source`（血算在谁头上）
           * ⇒ 不能先按 `pid` 一刀切，否则 damage 全被丢掉（实测：那样落地恒 0）。 */
          if (e.type === 'action') {
            if (e.pid === seat && e.outcome === 'ok' && e.key && e.key !== R.SK.JI) cast[e.key] = (cast[e.key] || 0) + 1;
          } else if (e.type === 'damage' && e.source === seat && R.byKey[e.via]) {
            land[e.via] = (land[e.via] || 0) + 1;
          }
        }
      }
      /* 极差：只在**该席真当过受评席**的局里算（否则 0 胜率席是样本没分到的假短板） */
      const pr = seatW.map(function (w, i) { return seatD[i] ? 100 * w / seatD[i] : null; }).filter(function (x) { return x != null; });
      const ce = entropyOf(cast), le = entropyOf(land);
      row.cells[cell.id] = {
        first: first / GAMES, draws: draws / GAMES, hardWin: first / Math.max(1, GAMES - draws),
        rounds: rounds / GAMES, seatSpread: pr.length > 1 ? Math.max.apply(null, pr) - Math.min.apply(null, pr) : 0,
        castG: ce.eff, landG: le.eff, landKeys: le.distinct, conv: le.tot / Math.max(1, ce.tot)
      };
    }
    /* 通吃分 = 该环境下**最弱一格**的 1st（不是平均：通吃的意思就是"没有短板格"） */
    row.weakest = CELLS.reduce(function (m, c) { return row.cells[c.id].first < m.first ? { id: c.id, first: row.cells[c.id].first } : m; },
      { id: CELLS[0].id, first: row.cells[CELLS[0].id].first });
    row.minSeatSpread = CELLS.reduce(function (m, c) { return Math.max(m, row.cells[c.id].seatSpread); }, 0);
    row.minLandG = CELLS.reduce(function (m, c) { return Math.min(m, row.cells[c.id].landG); }, Infinity);
    rows.push(row);
    out.push(row);
  }
  rows.sort(function (a, b) { return b.weakest.first - a.weakest.first; });
  if (!ASJSON) {
    console.log('\n=== 环境：' + fd.label + ' · ' + GAMES + ' 局/格 · 同种子配对 · 受评席轮转 ===');
    console.log('  包'.padEnd(20) + CELLS.map(function (c) { return c.id.padEnd(19); }).join('') + '  最弱格');
    for (const r of rows) {
      let line = '  ' + r.pack.slice(0, 18).padEnd(19);
      for (const c of CELLS) {
        const x = r.cells[c.id];
        /* 平局率必须**和 1st 并排印**：镜像装配下"1st=0%"往往是"全员互灭=平局"，不是"这包不会打"
         * ⇒ 只印 1st 会把读表的人推向完全错误的结论（本工具第一版就是这么骗到自己的）。 */
        line += (' ' + (100 * x.first).toFixed(1) + '%/平' + (100 * x.draws).toFixed(0) + '%/极' + x.seatSpread.toFixed(0)).padEnd(19);
      }
      console.log(line + '  ' + r.weakest.id + ' ' + (100 * r.weakest.first).toFixed(1) + '%');
    }
    console.log('  （每格 = 1st 胜率 / 平局率 / 受评席胜率极差；`严胜` = 去掉平局后的胜率，在 --json 里）');
    console.log('  兑现广度（各格 G(出手→落地)）：');
    for (const r of rows) {
      console.log('  ' + r.pack.slice(0, 18).padEnd(19) + CELLS.map(function (c) {
        const x = r.cells[c.id]; return (c.id + ' ' + x.castG.toFixed(2) + '→' + x.landG.toFixed(2) + '(' + x.landKeys + '种,兑现' + (100 * x.conv).toFixed(0) + '%)').padEnd(23);
      }).join(''));
    }
  }
}
if (ASJSON) console.log(JSON.stringify({ games: GAMES, seed0: SEED0, ref: REF, rows: out }, null, 1));
if (!ASJSON) {
  console.log('\n读法：①**最弱格**才是"通吃"的两个字的意思（平均会被一格高分糊过去）；' +
    '②"对现役"那一栏里现役包自己必然 1st≈镜像值（它就是对手）⇒ 看**别人**在它面前是多少；' +
    '③极差大 = 这个包只在某个座位上凶，不等于强；' +
    '④`G(出手)→G(落地)` 拉开的差 = 用户说的"为刷 eff 只挑最容易测到的卡"的那部分，兑现率 <40% 就要看是不是大量出手白给。');
}
