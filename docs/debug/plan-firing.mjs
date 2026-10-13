/* plan-firing.mjs —— 数「杂货铺的六条计划到底触发了没有、触发成什么形状」（研究量具，不进判据）
 *
 * 为什么要有这一把尺（用户 10-13 上午）：她给的是**行为**（"连着打4-5次聚能环"‖"贴3次符咒然后连续引爆两次"‖
 *   "第3轮在0ep时对着攒最多ep的人打过载炮"），而行为不能拿"出手种类数"来验收 ——
 *   一只脚本可以每种卡各打一次、六条计划一条也没成立过。所以这台数的是**形状**：
 *     ① 最长的聚能环连击（她的"4-5 次"）；② 贴→爆组合完成数（≥3 贴之后 ≥2 次天火）；
 *     ③ 过载炮三个 phase 各打了几次（她的花费逻辑：phase1 随意 / phase2 在 1ep / phase3 在 0ep）；
 *     ④ 避雷针 / 大雷 的出手与"当时是否真有威胁"（5ep 或电珠）—— 这一格才判得出"它是按计划打的还是乱按"。
 *
 * ⚠ 只做**观察**不做**判断**：判它仍按既有两把尺（广度 = `breadth-probe` 的出手种类；强度 = `probe-pool` 的人类席夺冠率与脚本席自身夺冠率）。
 * ⚠ 计划条件不许在这台里重写一遍（那是"抄第二遍"，本仓为这件事栽过至少四次）⇒ 威胁/phase 一律**从事件与状态字段反查**，
 *   不 import 脚本的判断式。
 *
 * 自检（`--self-test`，纯函数喂合成事件表，手算得出答案）：
 *   ① 连击：RING×4 夹一发别的 ⇒ 最长连击必须是 4 而不是 5/3；
 *   ② 贴爆：贴贴×3 后天火×2 ⇒ 组合 1 次；天火×1 ⇒ 组合 0 次（"两次"是她给的数）；
 *   ③ 过载炮 phase：CANNON 第 1/2/3 次分别落进 phase 1/2/3，第 4 次回到 1；
 *   ④ 避雷针的"威胁在场"：ROD 时某对手 ep≥5 或带电珠 ⇒ 记成"按计划"；场上没人有 ⇒ 记成"乱按"。
 *
 * 用法：node docs/debug/plan-firing.mjs [--ids=st:toolkit] [--games=40] [--n=5] [--mode=multi] [--out=某.tsv]
 *       node docs/debug/plan-firing.mjs --self-test
 * 退出码：0 ‖ 2 = 自检不过 / 名单空
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, rejectUnknownFlags } from '../../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
rejectUnknownFlags(process.argv.slice(2), ['ids', 'games', 'n', 'mode', 'out', 'seed', 'self-test'], 'plan-firing');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 40)) || 40;
const N = Number(arg('n', 5));
const MODE = arg('mode', 'multi');
const IDS = String(arg('ids', 'st:toolkit')).split(',').map(s => s.trim()).filter(Boolean);

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, P = W.EpirusPlay, BT = W.EpirusBots;
const SK = R.SK;
const NAME = {}; (R.skills || Object.keys(R.byKey).map(k => R.byKey[k])).forEach(s => { NAME[s.key] = s.name || s.key; });
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SEED = Number(process.env.EPIRUS_SEED || 20261013);

/* ---------- 纯函数：从一席的事件序列里把六条形状读出来 ---------- */
/* 事件形状（由上面的观察层记下，**不 import 脚本的判断式**）：
 *   { key, threat: 那回合场上有没有 5ep/电珠的对手, live: 那一刻我贴在别人身上的活符咒数 }
 * ⚠ "贴3→爆2"的判据用**引擎自己的口径**（天火打的是 `owner===我 && age<=3` 的符咒 ⇒ 直接数"出手时活符咒≥3 的天火"），
 *   不是我另造一个"连续出手"的定义 —— 第一版就是自造了"连续"，量出来 193 次贴贴 0 次组合，
 *   而真相是脚本本来就按"活符咒数"决定引爆，中间夹一手枪并不打断她的组合。**度量与产品的语义必须同源。** */
function analyze(seatEvents) {
  const o = { ringMax: 0, ringRuns: 0, bigT: 0, rod: 0, rodPlanned: 0, curse: 0, fire: 0,
    curseMax: 0, fireMax: 0, combos: 0, cannon: [0, 0, 0], kinds: {}, acts: 0 };
  let run = 0, cannons = 0, curseStreak = 0, fireStreak = 0, armed = false;
  for (const e of seatEvents) {
    const k = e.key; if (!k) continue;
    o.acts++; o.kinds[k] = (o.kinds[k] || 0) + 1;
    if (k === SK.RING) { run++; if (run === 1) o.ringRuns++; if (run > o.ringMax) o.ringMax = run; }
    else run = 0;
    if (k === SK.BIG_T) o.bigT++;
    if (k === SK.ROD) { o.rod++; if (e.threat) o.rodPlanned++; }
    if (k === SK.CANNON) { cannons++; const ph = ((cannons - 1) % 3) + 1; o.cannon[ph - 1]++; }
    /* 贴爆 = **时序**窗口（用户 10-13 纠正："贴贴是连续3次，未必要3枚，不然开头那个就过期了"）：
     *   连贴满 3 手 ⇒ 窗口上膛；随后连爆，**爆到第 2 发算完成一次**（"连续引爆两次"）。
     *   中间插一手别的（非 ジ）⇒ 窗口作废；ジ 不算打断（她说的"连续"是出招节奏，攒钱回合本来就该允许）。*/
    if (k === SK.CURSE) { o.curse++; curseStreak++; fireStreak = 0; if (curseStreak > o.curseMax) o.curseMax = curseStreak; if (curseStreak >= 3) armed = true; }
    else if (k === SK.FIRESTORM) {
      o.fire++;
      if (armed) { fireStreak++; if (fireStreak > o.fireMax) o.fireMax = fireStreak; if (fireStreak >= 2) { o.combos++; armed = false; fireStreak = 0; } }
      else fireStreak = 0;
    } else if (k !== SK.JI) { curseStreak = 0; fireStreak = 0; armed = false; }
  }
  o.kindCount = Object.keys(o.kinds).filter(k => k !== SK.JI).length;
  return o;
}
/* 她的"贴3次符咒然后连续引爆两次"= 连贴满 3 手的窗口之后，连爆两发 ⇒ analyze() 里直接计数（combos） */

if (process.argv.includes('--self-test')) {
  const E = (k, extra) => Object.assign({ key: k }, extra || {});
  let nok = 0, nbad = 0;
  const chk = (name, cond, got) => { if (cond) { nok++; console.log('  ok   ' + name); } else { nbad++; console.log('  FAIL ' + name + ' ‖ 实测 ' + got); } };
  const a = analyze([E(SK.RING), E(SK.RING), E(SK.RING), E(SK.GUN), E(SK.RING), E(SK.RING), E(SK.RING), E(SK.RING)]);
  chk('①最长连击=4（RING×3 ‖ 枪 ‖ RING×4）', a.ringMax === 4, a.ringMax);
  chk('①连击段数=2', a.ringRuns === 2, a.ringRuns);
  const b = analyze([E(SK.CURSE), E(SK.CURSE), E(SK.CURSE), E(SK.FIRESTORM), E(SK.FIRESTORM)]);
  chk('②连贴3 → 连爆2 ⇒ 组合 1 次', b.combos === 1 && b.curseMax === 3 && b.fireMax === 2, b.combos + '/' + b.curseMax + '/' + b.fireMax);
  const c = analyze([E(SK.CURSE), E(SK.CURSE), E(SK.CURSE), E(SK.FIRESTORM)]);
  chk('②只爆一发 ⇒ 不算完成（她给的是"两次"）', c.combos === 0, c.combos);
  const d = analyze([E(SK.CURSE), E(SK.CURSE), E(SK.FIRESTORM), E(SK.FIRESTORM)]);
  chk('②只贴两发就爆 ⇒ 窗口没上膛，不算（钉的是"连续3次"这一半）', d.combos === 0, d.combos);
  const f = analyze([E(SK.CURSE), E(SK.CURSE), E(SK.CURSE), E(SK.GUN), E(SK.FIRESTORM), E(SK.FIRESTORM)]);
  chk('②中间插一手枪 ⇒ 窗口作废，不算', f.combos === 0, f.combos);
  const h = analyze([E(SK.CURSE), E(SK.CURSE), E(SK.CURSE), E(SK.JI), E(SK.FIRESTORM), E(SK.FIRESTORM)]);
  chk('②中间是 ジ ⇒ 仍算（攒钱回合不该打断她的组合；这一格钉"别的卡"与"ジ"要分家）', h.combos === 1, h.combos);
  const i2 = analyze([E(SK.CURSE), E(SK.CURSE), E(SK.CURSE), E(SK.CURSE), E(SK.FIRESTORM), E(SK.FIRESTORM), E(SK.FIRESTORM)]);
  chk('②爆满两发就收（第三发不重复计），连贴最长=4', i2.combos === 1 && i2.curseMax === 4, i2.combos + '/' + i2.curseMax);
  const g = analyze([E(SK.CANNON), E(SK.CANNON), E(SK.CANNON), E(SK.CANNON)]);
  chk('③过载炮 phase 计数 = 2/1/1（第4次回到 phase1）',
    g.cannon[0] === 2 && g.cannon[1] === 1 && g.cannon[2] === 1, JSON.stringify(g.cannon));
  const r = analyze([E(SK.ROD, { threat: true }), E(SK.ROD, { threat: false })]);
  chk('④避雷针"按计划/乱按"分得开（2 次里 1 次有威胁）', r.rod === 2 && r.rodPlanned === 1, r.rod + '/' + r.rodPlanned);
  console.log('plan-firing 自检：' + nok + ' ok ‖ ' + nbad + ' FAIL');
  process.exit(nbad ? 2 : 0);
}

/* ---------- 跑：N 席镜像自对局（与 breadth-probe / mirrorHealth 同一套装配）---------- */
const styles = {}; (BT.STYLES || []).forEach(s => { styles[s.id] = s; });
const list = IDS.filter(id => { if (!styles[id]) { console.error('⛔ 认不出的风格 id：' + id + '（STYLES 里没有这一只 ⇒ 读数会是空的）'); return false; } return true; });
if (!list.length) { console.error('⛔ 名单空'); process.exit(2); }

console.log('装配=' + MODE + ' · ' + N + ' 席镜像 · ' + GAMES + ' 局/只（计划触发只做观察，判据仍在 breadth-probe 与 probe-pool）\n');
const rows = [];
for (const id of list) {
  const pick = styles[id].pick;
  const perSeat = []; let rounds = 0, games = 0;
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState(MODE, { next: mulberry32(SEED + g) }, N);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const seat = []; for (let i = 0; i < N; i++) seat.push([]);
    /* 威胁标记只能在**出手那一刻**记 ⇒ 包装一层：调用真 pick 之前先记下"当时场上有没有 5ep 或电珠的对手" */
    const wrapped = function (state, pid, legal) {
      const threat = (() => { for (let i = 0; i < state.p.length; i++) { if (i === pid) continue;
        if (state.p[i].hp > 0 && (state.p[i].ep >= 5 || (state.p[i].elec || 0) >= 1)) return true; } return false; })();
      const res = pick(state, pid, legal);
      const key = (typeof res === 'string') ? res : (res && res.key);
      /* 那一刻"我贴在别人身上、还活着的符咒"数（引擎天火口径：owner===我 && age<=3）*/
      let live = 0;
      for (let i = 0; i < state.p.length; i++) { if (i === pid) continue;
        const s = state.p[i].stickers || [];
        for (let k2 = 0; k2 < s.length; k2++) if (s[k2].owner === pid && s[k2].age <= 3) live++; }
      seat[pid].push({ key: key, threat: threat, live: live });
      return res;
    };
    const chs = []; for (let i = 0; i < N; i++) chs.push(wrapped);
    P.autoGameN(st, chs);
    for (let i = 0; i < N; i++) perSeat.push(seat[i]);
    games++; rounds += st.round;
  }
  const agg = { ringMax: 0, ringRuns: 0, curseMax: 0, fireMax: 0, combos: 0, bigT: 0, rod: 0, rodPlanned: 0, curse: 0, fire: 0, cannon: [0, 0, 0], kinds: new Set(), acts: 0 };
  const kindsAll = {};
  for (const evs of perSeat) {
    const a = analyze(evs);
    if (a.ringMax > agg.ringMax) agg.ringMax = a.ringMax;
    if (a.curseMax > agg.curseMax) agg.curseMax = a.curseMax;
    if (a.fireMax > agg.fireMax) agg.fireMax = a.fireMax;
    agg.ringRuns += a.ringRuns; agg.combos += a.combos;
    agg.bigT += a.bigT; agg.rod += a.rod; agg.rodPlanned += a.rodPlanned;
    agg.curse += a.curse; agg.fire += a.fire;
    for (let i = 0; i < 3; i++) agg.cannon[i] += a.cannon[i];
    agg.acts += a.acts;
    Object.keys(a.kinds).forEach(k => { kindsAll[k] = (kindsAll[k] || 0) + a.kinds[k]; if (k !== SK.JI) agg.kinds.add(k); });
  }
  const per = (v) => (v / games).toFixed(2);
  console.log(styles[id].name + '（' + id + '）· ' + games + ' 局 · 局长 ' + (rounds / games).toFixed(1) + ' 回合 ‖ 出手种类 ' + agg.kinds.size);
  console.log('  P1 聚能环：最长连击 ' + agg.ringMax + ' 手 ‖ 开环 ' + agg.ringRuns + ' 段（平均每局 ' + per(agg.ringRuns) + ' 段）');
  console.log('  P4 贴爆（时序窗口）：贴贴 ' + agg.curse + ' 次（最长连贴 ' + agg.curseMax + '）‖ 天火 ' + agg.fire +
    ' 次（最长连爆 ' + agg.fireMax + '）‖ **完成"连贴3→连爆2"组合 ' + agg.combos + ' 次**（每局 ' + per(agg.combos) + '）');
  console.log('  P6 过载炮 phase1/2/3：' + agg.cannon.join(' / ') + '（她给的花费逻辑：p1 随意 ‖ p2 在 1ep ‖ p3 在 0ep）');
  console.log('  P3 大雷 ' + agg.bigT + ' 次（每局 ' + per(agg.bigT) + '）‖ P2 避雷针 ' + agg.rod + ' 次，其中' +
    '出手那回合场上确有 5ep/电珠威胁的 ' + agg.rodPlanned + ' 次' + (agg.rod ? '（' + (agg.rodPlanned / agg.rod * 100).toFixed(0) + '%）' : ''));
  const top = Object.keys(kindsAll).sort((a, b) => kindsAll[b] - kindsAll[a]).slice(0, 12).map(k => (NAME[k] || k) + '×' + kindsAll[k]);
  console.log('  出手谱：' + top.join(' ‖ '));
  rows.push({ id: id, games: games, kinds: agg.kinds.size, ringMax: agg.ringMax, ringRuns: per(agg.ringRuns),
    curseMax: agg.curseMax, fireMax: agg.fireMax, combos: per(agg.combos), bigT: per(agg.bigT), rod: agg.rod, rodPlanned: agg.rodPlanned,
    p1: agg.cannon[0], p2: agg.cannon[1], p3: agg.cannon[2], rounds: (rounds / games).toFixed(1) });
}
const OUTP = join(ROOT, 'champion-map', arg('out', '_planfiring.tsv'));
writeFileSync(OUTP, 'id\tgames\tkinds\tringMax\tringRunsPerGame\tcurseMax\tfireMax\tcombosPerGame\tbigTPerGame\trod\trodPlanned\tcannonP1\tcannonP2\tcannonP3\trounds\n' +
  rows.map(r => [r.id, r.games, r.kinds, r.ringMax, r.ringRuns, r.curseMax, r.fireMax, r.combos, r.bigT, r.rod, r.rodPlanned, r.p1, r.p2, r.p3, r.rounds].join('\t')).join('\n') + '\n');
console.log('\n已写 ' + arg('out', '_planfiring.tsv') + '（' + rows.length + ' 行 · champion-map 下 `_*` 已被 .gitignore 挡掉，不入库）');
