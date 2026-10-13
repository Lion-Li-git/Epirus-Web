/* breadth-probe.mjs —— §E600-B 的"广度是不是可玩性"那把尺（研究量具，不进判据）
 *
 * 用户 10-13 凌晨的要点（原话，掺席落 `44384ea`）：「弱包只是强度差但**广度不能弱**，广度是基本的可玩性」
 *   ‖「可以把启发式随机脚本塞到弱池子里面，能用更多低性价比的技能如**避雷针、双枪、贴贴天火、镜面反射**，
 *     反正这些技能进不了高强度的包」。
 *
 * 这句话里有两个可判的东西，这台一次量出来：
 *   ① **出手谱**（这个装配实际用了哪些卡、每次/局）——判"广度"；
 *   ② **机会谱**（这些卡在那些回合**本来就合法可出**）——判到底是"能出而不出"还是"根本没碰到"。
 * ②是关键的：如果某张低性价比卡连机会都很少，那"塞脚本"也变不出来；如果机会多而出手 0，
 *   那就是选择侧的洞（训练把它挤掉了），脚本席真有肉。
 *
 * 口径：与训练侧 `mirrorHealth` 同一套装配 —— **N 席全是被测对象自己**（镜像自对局），
 *   只数 `type==='action' && outcome==='ok'` 的事件（与 `usage-probe` / `aggressionProfile` 同一判据），
 *   卡名一律从 `EpirusRules.skills` 现取，**不硬编码卡名单**。
 *
 * 自检（`--self-test`，格子是手算得出来的，钉的是"计数器接对了事件"）：
 *   ① 全程只ジ（`pickFarmer`）⇒ 出手谱必须只有 ジ，其余全 0，而**机会谱必须非空**（它只是不出，不是没得出）；
 *   ② 能防就防（`pickDefend`）⇒ 防御类 > 0 而大雷/狙击必须恰好 0。
 *
 * 用法：node docs/debug/breadth-probe.mjs [--all-styles | --ids=st:aggro,...] [--packs=路径]
 *       [--games=40] [--n=5] [--mode=multi] [--out=champion-map/_breadth.tsv]
 *       node docs/debug/breadth-probe.mjs --self-test
 * 退出码：0 = 跑完 ‖ 2 = 输入不齐或自检不过
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox } from '../../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const has = k => process.argv.includes('--' + k);

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, P = W.EpirusPlay, BT = W.EpirusBots;
const SKILLS = R.skills || Object.keys(R.byKey).map(k => R.byKey[k]);
const NAME = {}; SKILLS.forEach(s => { NAME[s.key] = s.name || s.key; });
const G = Number(arg('games', 40)), N = Number(arg('n', 5)), MODE = arg('mode', 'multi');
const TARGETS = ['避雷针', '双枪射手', '贴贴', '天火', '镜面反射', '挑衅', '净化', '过载炮', '藤甲', '金刚盾', '无极变速', '激光眼', '电磁炮', '真正的落雷', '摄魂指法', '原型制御', '全息屏障', '地雷'];
const TK = SKILLS.filter(s => TARGETS.indexOf(NAME[s.key]) >= 0).map(s => s.key);
/* 目标卡名必须**全部**解得到 key：第一版自检里我按 'bigt' 写死大雷，而真 key 是 `bigT` ⇒
 *   那条断言永远不会红（读一个不存在的键 = 恒 0 = 恒过）。这类空转比不写自检更糟，因为它给人"验过了"的错觉。 */
const UNRESOLVED = TARGETS.filter(t => !SKILLS.some(s => NAME[s.key] === t));
if (UNRESOLVED.length) { console.log('⛔ 有 ' + UNRESOLVED.length + ' 张目标卡在这套规则里解不到 key：' + UNRESOLVED.join(' ‖ ') + ' ⇒ 这把尺会静默少测，停'); process.exit(2); }
const keyOfName = n => (SKILLS.find(s => NAME[s.key] === n) || {}).key;

/** 一次镜像装配：N 席全是同一个 chooser ⇒ 出手谱 + 机会谱 */
function probe(chooser, label, games) {
  const out = { label: label, games: games, shots: {}, opp: {}, near: {}, rounds: 0, draws: 0 };
  for (let g = 0; g < games; g++) {
    /* rng 的形状是 `{ next: fn }`（`createState` 里存的是对象，不是函数）—— 第一版传了个裸函数，
     *   只有真正调用判定的脚本（狙击/八卦）才炸出来 ⇒ 自检③替我抓到了这件事。 */
    let a = (g * 2654435761) >>> 0;
    const st = S.createState(MODE, { next: function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    } }, N);
    const choosers = [];
    for (let i = 0; i < N; i++) choosers.push(function (state, pid) {
      const legal = P.legalActions(state, pid);
      /* 机会谱只数**买得起且条件满足**的（第一版把 `affordable:false` 也数进去了 ⇒ "避雷针机会 235/局"
       *   其实是"这一回合规则上允许它、但珠不够"，读起来像"能出而不出"，全是这只尺的假账）。
       *   差 1~2 珠的那批另记一列 `near` —— 它才是"再攒两手就用得上的工具"。 */
      for (const a of legal) {
        if (!a.key) continue;
        if (a.affordable) out.opp[a.key] = (out.opp[a.key] || 0) + 1 / games;
        else if (a.loan >= 1 && a.loan <= 2) out.near[a.key] = (out.near[a.key] || 0) + 1 / games;
      }
      const pick = chooser(state, pid, legal);
      return pick;
    });
    let res;
    try { res = P.autoGameN(st, choosers); } catch (e) { console.log('⛔ ' + label + ' 第 ' + g + ' 局抛错：' + e.message); return null; }
    out.rounds += (st.round || 0) / games;
    out.draws += (res === null || res === undefined) ? 1 : 0;   /* autoGameN 返回 state.winner；null/undefined = 平局 */
    for (const ev of (st.events || [])) {
      if (ev.type !== 'action' || ev.outcome !== 'ok') continue;
      if (!ev.key) continue;
      out.shots[ev.key] = (out.shots[ev.key] || 0) + 1 / games;
    }
    const nonJi = Object.keys(out.shots).filter(k => k !== 'ji').length;
    out.distinct = nonJi;
  }
  return out;
}

/* ===== 自检 ===== */
if (has('self-test')) {
  let bad = 0;
  const a = probe(function (state, pid, legal) { const j = (legal || []).filter(x => x.key === 'ji'); return j.length ? j[0] : null; }, '只ジ', 6);
  const keysA = Object.keys(a.shots);
  if (!(keysA.length === 1 && keysA[0] === 'ji')) { console.log('✘ 自检①：只ジ 的出手谱不该有别的卡（实测 ' + keysA.join(',') + '）'); bad++; }
  if (!(Object.keys(a.opp).length > 3)) { console.log('✘ 自检①b：只ジ 的机会谱必须有卡可出（实测 ' + Object.keys(a.opp).length + ' 种 ⇒ 计数器接错了）'); bad++; }
  const K_BIGT = keyOfName('真正的落雷'), K_SNIP = keyOfName('狙击枪');
  if (!K_BIGT || !K_SNIP) { console.log('✘ 自检前提：卡名解不到 key（bigT=' + K_BIGT + ' ‖ 狙击=' + K_SNIP + '）'); bad++; }
  const b = probe(BT.pickDefend, '能防就防', 6);
  const defHas = Object.keys(b.shots).some(k => (R.byKey[k] || {}).cat === 'defense');
  if (!defHas) { console.log('✘ 自检②：能防就防必须出防御类'); bad++; }
  if (b.shots[K_BIGT] || b.shots[K_SNIP]) { console.log('✘ 自检②：pickDefend 不该出 大雷/狙击'); bad++; }
  /* ③ **正对照**：出手计数器真的能数到大雷与狙击吗？拿专门甩大雷/狙击的脚本各跑一遍。
   *    少了这一格，"某卡出手 0" 就永远分不清是"它真不出"还是"我接错了事件"（第一版就栽在这里）。 */
  const c1 = probe(BT.pickBigTFocus, '大雷专项', 8), c2 = probe(BT.pickSnipeSpam, '狙击专项', 8);
  if (!(c1 && c1.shots[K_BIGT] > 0)) { console.log('✘ 自检③：大雷专项必须数到 大雷 > 0（实测 ' + (c1 ? (c1.shots[K_BIGT] || 0) : '跑挂') + '）⇒ 出手谱接错了事件'); bad++; }
  if (!(c2 && c2.shots[K_SNIP] > 0)) { console.log('✘ 自检③：狙击专项必须数到 狙击 > 0（实测 ' + (c2 ? (c2.shots[K_SNIP] || 0) : '跑挂') + '）'); bad++; }
  console.log(bad ? '⛔ 自检 ' + bad + ' 格不过 ⇒ 这把尺接错了线，不许用它读数'
    : '✔ 自检三格过（只ジ 只有 ジ 而机会谱非空 ‖ pickDefend 出防而不出大雷/狙击 ‖ 正对照：大雷/狙击专项各数得到 >0）');
  process.exit(bad ? 2 : 0);
}

const list = [];
if (has('all-styles')) for (const st of (BT.STYLES || [])) list.push({ id: st.id, name: st.name, fn: st.pick });
String(arg('ids', '')).split(',').map(s => s.trim()).filter(Boolean).forEach(id => {
  const st = (BT.STYLES || []).find(x => x.id === id);
  if (st) list.push({ id: st.id, name: st.name, fn: st.pick });
  else { console.log('⛔ 认不出的脚本 id：' + id); process.exit(2); }
});
String(arg('packs', '')).split(',').map(s => s.trim()).filter(Boolean).forEach(p => {
  const pack = W.EpirusPolicy ? null : null;   /* 包走另一条线（本尺先量脚本席；包的出手谱已有 usage-probe） */
  if (!pack) console.log('提示：--packs= 这台暂不接（包的出手谱用 tools/usage-probe.mjs），本尺只管脚本席');
});
if (!list.length) { console.log('用法：--all-styles 或 --ids=st:aggro,...（本次没有可测对象 ⇒  exit 2）'); process.exit(2); }

/* ⚠ 表头必须按**数据列同一个序**（`TK` 是从 SKILLS 现取的 key 序，不是 `TARGETS` 那串名字序）。
 *   第一版写的是 `TARGETS.map(k => NAME[k])` —— TARGETS 里装的是**中文卡名**而不是 key，
 *   `NAME[中文]` 一律 undefined，而 `Array.join` 把 undefined 变成**空串** ⇒ 表头 18 列全空、
 *   数据列却有值：这就是 §E307 那一族"列贴错名字"，读的人只能靠猜。 */
const rows = [['target', 'name', 'distinct', 'rounds', '出手/局:全部'].concat(TK.map(k => NAME[k])).join('\t')];
if (rows[0].split('\t').length !== 5 + TK.length) { console.log('⛔ 表头列数与数据列数不一致 ⇒ 这台尺自己错列了，读数作废'); process.exit(2); }
console.log('被测脚本 ' + list.length + ' 个 ‖ 装配 = ' + N + ' 席镜像 · ' + MODE + ' · ' + G + ' 局/格');
for (const t of list) {
  const r = probe(t.fn, t.id, G);
  if (!r) continue;
  const shotStr = Object.keys(r.shots).sort((a, b) => r.shots[b] - r.shots[a]).slice(0, 5)
    .map(k => NAME[k] + ' ' + r.shots[k].toFixed(1)).join(' / ');
  const row = [t.id, t.name, r.distinct, r.rounds.toFixed(1), shotStr]
    .concat(TK.map(k => ((r.shots[k] || 0).toFixed(2) + '/' + (r.opp[k] || 0).toFixed(1))));
  rows.push(row.join('\t'));
  console.log('  ' + t.id.padEnd(16) + t.name.padEnd(10) + ' 出手种类 ' + String(r.distinct).padStart(2) +
    ' ‖ 回合 ' + r.rounds.toFixed(0).padStart(3) + ' ‖ 主流 ' + shotStr);
  const miss = TK.filter(k => !(r.shots[k]) && (r.opp[k] || 0) >= 1);
  if (miss.length) console.log('      ⚑ 买得起却一次没出（机会 ≥1/局）：' + miss.map(k => NAME[k] + ' 机会 ' + r.opp[k].toFixed(1)).join(' ‖ '));
  const nearOnly = TK.filter(k => !(r.shots[k]) && (r.near[k] || 0) >= 1);
  if (nearOnly.length) console.log('      ⚑ 只差 1~2 珠就能用而没用过：' + nearOnly.slice(0, 8).map(k => NAME[k] + ' 差手 ' + r.near[k].toFixed(1)).join(' ‖ '));
}
const OUT = arg('out', 'champion-map/_breadth.tsv');
writeFileSync(join(ROOT, OUT), rows.join('\n') + '\n', 'utf8');
console.log('✔ 已写 ' + OUT + '（每格是 出手/局 ‖ 机会/局）');
