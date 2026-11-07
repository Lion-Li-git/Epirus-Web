/* trace-game.mjs —— §E334 把一枚包**载入对局**，逐回合打印它每一手出了什么、花多少、打谁、成没成。
 *
 * 为什么要这台仪器：图上的读数（F / Hp / charges / waste / 技能使用率）全是**聚合量**，
 *   聚合量能说"这枚不一样"，说不出"**哪里怪**"。用户点名的正是后者：
 *   「实战的意思是你自己把包载入对战一下，看看有没有明显的出招特点以及奇怪的现象」
 *   ⇒ 需要一个能让人**读一局棋**的落盘，而不是又一个百分比。
 *
 * 口径与别的仪器一致（不新造一套世界）：
 *   · 装载走 `audit-lib.loadChamp`（与 style-exam / champ-audit 同一个读取口，含历史形状退回）；
 *   · 决策走 `EpirusTrainer.policyChooserN(params, 0.15)` —— 0.15 = 页面「困难」档温度；
 *   · 每局新建 chooser（chooser 可能带状态）；
 *   · 局种子 `SEED + g*977`、座位轮换 `seat = g % 5`（与 eval-5p / style-exam 同一范式）。
 *   ⚠ 引擎的 `action` 事件只有 {pid,key,outcome}，**费用/伤害/目标不在同一行**（伤害是紧随的 `damage` 事件、
 *     珠是 `bead`、禁用是 `ban`）⇒ 这里按"本回合这一手之后发生的事"归并，别把归并当成引擎给的字段。
 *
 * 用法：node champion-map/trace-game.mjs --champ=<路径> [--games=2] [--seed=77000]
 *        [--field=champ:<路径>|脚本名]（对手场，默认 4 × 现役）[--max-round=14] [--both]
 *        `--both` = 受试与对手场各打一份，方便并排看出招构成差在哪。
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const CH = arg('champ', ''), FIELD = arg('field', 'champ:js/bundled-champion-3p.js');
const GAMES = Number(arg('games', 2)) || 2, SEED = Number(arg('seed', 77000));
const TEMP = 0.15, MAXR = Number(arg('max-round', 14));
const BOTKEYS = {}; for (const s of OPP_SPECS) BOTKEYS[s.key] = 1;
if (!CH) { console.error('用法：--champ=<路径> [--field=champ:<路径>|脚本名]'); process.exit(2); }

const W = sandbox(), R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
const STANCE = { guard: 1, reflect: 1, bagua: 1, jinshield: 1, proto: 1 };
function loadSpec(spec, label) {
  if (BOTKEYS[spec]) return { bot: spec };
  const p = spec.indexOf('champ:') === 0 ? spec.slice(6) : spec;
  const abs = p.indexOf('/') < 0 ? p : join(ROOT, p);
  if (!existsSync(abs)) { console.error('⛔ 读不到 ' + label + ' 的包：' + p); process.exit(2); }
  const pr = loadChamp(W, abs, ROOT);
  if (!pr) { console.error('⛔ ' + label + ' 不是可解的冠军包：' + p); process.exit(2); }
  return { params: pr, src: p };
}
const subj = loadSpec(CH, '受试'), opp = loadSpec(FIELD, '对手场');
function selOf(x) { return x.bot ? T.wrapBotN(B[x.bot]) : T.policyChooserN(x.params, TEMP); }
const nm = k => (R.byKey[k] ? R.byKey[k].name : k) + '(' + k + ')';
const cost = k => { const c = R.byKey[k] && R.byKey[k].cost; return c === undefined ? '?' : (c === null ? '珠' : c); };
/* ⚠ 珠技能（聚能环/大雷…）的 `cost` 在规则表里就是 **null**（它们花的是珠不是 ep），不是缺字段 ⇒
 *   直接打出来是"费null"，读的人会以为是引擎的 bug。这里显式印成"珠"。*/
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

console.log('§E334 载入对局 · 受试 = ' + (subj.src || subj.bot) + ' ‖ 场 = 4 × ' + (opp.src || opp.bot) +
  ' ‖ ' + GAMES + ' 局 · n5 · multi · 温度 ' + TEMP + '（页面「困难」档）· seed 基 ' + SEED);
const hist = {};                                  /* 出招构成：label → key → 次数 */
for (let g = 0; g < GAMES; g++) {
  const seat = g % 5;
  const st = S.createState('multi', { next: mulberry(SEED + g * 977) }, 5);
  const ch = []; for (let i = 0; i < 5; i++) ch.push(i === seat ? selOf(subj) : selOf(opp));
  Play.autoGameN(st, ch);
  const label = (subj.src || subj.bot);
  const H = hist[label] || (hist[label] = {});
  const lines = []; let round = -1, seen = {}, spend = {}, dealt = {}, bead = {};
  for (const e of st.events) {
    if (e.type === 'action') {
      if (seen[e.pid] !== undefined) { seen = {}; round++; } else if (round < 0) round = 0;
      seen[e.pid] = true;
      if (e.pid === seat) { H[e.key] = (H[e.key] || 0) + 1; spend[e.pid] = (spend[e.pid] || 0) + (cost(e.key) || 0); }
      lines.push('  R' + String(round).padStart(2) + ' 席' + e.pid + (e.pid === seat ? '★' : ' ') + ' ' +
        (nm(e.key) + '        ').slice(0, 20) + ' 费' + cost(e.key) + '  ' + (e.outcome || ''));
    } else if (e.type === 'damage' && round <= MAXR) {
      dealt[e.source] = (dealt[e.source] || 0) + e.amt;
      lines.push('        ↳ ' + (e.source !== undefined ? '席' + e.source : '?') + ' 的 ' + (e.via ? nm(e.via) : e.reason) +
        ' 打 席' + e.to + ' −' + e.amt);
    } else if (e.type === 'bead' && round <= MAXR) {
      bead[e.pid] = (bead[e.pid] || 0) + e.delta;
      lines.push('        ↳ 席' + e.pid + ' 得珠 ' + e.kind + ' ×' + e.delta);
    } else if (e.type === 'ban' && round <= MAXR) lines.push('        ↳ 席' + e.pid + ' 被禁 ' + e.skill + ' ' + e.turns + ' 回合（' + e.by + '）');
    else if (e.type === 'death') lines.push('        ⚑ 席' + e.pid + ' 出局：' + e.reason + '（R' + (st.round || round) + '）');
    else if (e.type === 'cancel' && round <= MAXR) lines.push('        ⚑ 相抵：席 ' + e.pids.join('/') + '（R' + e.round + '）');
  }
  console.log('\n=== 第 ' + (g + 1) + ' 局（受试坐 ' + seat + ' 号位）===');
  console.log(lines.filter(l => +((l.match(/R\s*(\d+)/) || [0, 99])[1]) <= MAXR).join('\n') +
    (lines.length > 90 ? '\n  …（R' + (MAXR + 1) + ' 之后省略；--max-round 调大）' : ''));
  console.log('  终局：胜者 = 席' + st.winner + ' ‖ 回合 = ' + st.round + ' ‖ 血量 ' +
    st.p.map((p, i) => i + (p.hp <= 0 ? '†' : ':' + p.hp + 'hp/' + p.ep + 'ep')).join(' '));
  const sp = spend[seat] || 0;
  console.log('  受试这局：造伤 ' + (dealt[seat] || 0) + ' ‖ 累计花费 ' + sp + ' ep ‖ 得珠 ' + (bead[seat] || 0));
}
console.log('\n=== 出招构成（' + GAMES + ' 局合计，受试席）===');
for (const k in hist) {
  const tot = Object.values(hist[k]).reduce((a, b) => a + b, 0);
  console.log('  ' + k + '（成交 ' + tot + ' 手）');
  console.log('    ' + Object.entries(hist[k]).sort((a, b) => b[1] - a[1]).map(([kk, n]) =>
    nm(kk) + '×' + n + (STANCE[kk] ? '[防]' : '')).join('  '));
}
