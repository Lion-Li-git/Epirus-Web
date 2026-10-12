/* proto-chance.mjs —— 「原型制御到底是**能出而不出**，还是**根本没碰到**」（R1 根因 · 10-13 晨）
 *
 * 起因（用户 10-13 晨）：「原型制御一直是高性价比技能，只是不知道为什么一直没学会，反倒跑去用全息屏障了」。
 *   先确认现象是真的：`tools/usage-probe.mjs` 加了 `proto` 一列后，困难带 9 枚 + 出厂 1P 冠军 +
 *   两支**重新训练**的 500 代臂（`EPIRUS_SEED=1 node tools/train-fast.mjs 500`）在 ε=0 与 ε=0.2 下
 *   **proto 全是 0.000/局**，而 holo 是 0~0.73/局 ⇒ "没学会"不是某一枚包的历史偶然。
 *
 * 这台要回答的是**下一步**：0 出手有两种完全不同的病 ——
 *   ① 候选里几乎没有这张卡（装配/规则问题）⇒ 训练根本没机会学；
 *   ② 机会很多却一次没选（选择侧问题）⇒ breadth-probe 对脚本席量到的正是这一类。
 * 分开数才知道该修哪一侧。
 *
 * ★ 为什么"同费用同优先级"这一对特别有意义（`js/core/rules.js:60` 与 `:65` 逐字读出来的）：
 *     原型制御 = mk(CAT.DEFENSE, cost **1**, pri **3**, target **'self'**)
 *     全息屏障 = mk(CAT.DEFENSE, cost **1**, pri **3**, target **'other'**)
 *   ⇒ 两张卡**只差 target**，当两者同时在候选里且都买得起时，选谁纯粹是网络那一条几率 ⇒
 *     这一格就是"self 防御 vs other 防御"的干净对照，不用假设别的费用差异。
 *
 * 口径：与 `usage-probe` / 训练侧 `mirrorHealth` 同一套装配（5 席全是被测包自己 · `Play.autoGameN`），
 *   出手只认 `type==='action' && outcome==='ok'` 的事件；机会 = 该次决策的 `legal` 里 `affordable` 为真。
 *
 * 自检（`--self-test`，钉的是"计数器接对了字段"，不是某枚包的读数）：
 *   造两个**强制 chooser**（各自 8 / 12 局）：
 *   ① 必选 proto ⇒ `proto 出手` 必须**恰好等于** `proto 机会`（少一次就是出手计数字段接错），`holo 出手` 必须恰好 0；
 *   ② **只在血≤1 时**必选 proto ⇒ 先证"血≤1 且 proto 买得起"这一格碰得到（①的装配里它一次也不出现，
 *      拿①验子格等于验了个空 —— 这正是"假绿"的形状），再要求子格出手 == 子格机会。
 *
 * 用法：node docs/debug/proto-chance.mjs [--ids=T8-s114,K2 | --paths=f.js] [--games=40] [--eps=0] [--mode=multi]
 *       node docs/debug/proto-chance.mjs --self-test
 * 退出码：0 = 跑完 ‖ 2 = 名单空 / 装载失败 / 自检不过
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 40)) || 40;
const EPS = Number(arg('eps', 0));
const MODE = arg('mode', 'multi');

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
const SK = R.SK;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SEED = Number(process.env.EPIRUS_SEED || 20261013);

const ok = (c) => (c ? 1 : 0);
/* 一次扫描：返回 {dec, protoOpp, holoOpp, bothOpp, pickProto, pickHolo, pickOtherInBoth, acts, games}
 * 机会/归属全部按**决策次数**计（不是按局），所以每一格都同时给"次/局"与"占该格的比例"。
 * `hp1*` 是同一批计数的**子格**（该席自己血≤1 时）—— 表 B 的分层 RCT 说 proto 只在血≤1 那一格抬到 0 附近（−3.3），
 *   所以这一格是唯一可能给它翻案的场合：若这里仍是 0，那"被埋没"就真没证据。 */
function scan(choose, G) {
  const t = { dec: 0, protoOpp: 0, holoOpp: 0, bothOpp: 0, pickProto: 0, pickHolo: 0, otherInBoth: 0,
    hp1Dec: 0, hp1ProtoOpp: 0, hp1PickProto: 0, hp1PickHolo: 0, acts: 0, games: 0 };
  for (let g = 0; g < G; g++) {
    const st = S.createState(MODE, { next: mulberry32(SEED + g) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const wrapped = function (state, pid, legal) {
      const pOn = legal.some(l => l.key === SK.PROTO && l.affordable);
      const hOn = legal.some(l => l.key === SK.HOLO && l.affordable);
      const low = !!(state && state.p && state.p[pid] && state.p[pid].hp <= 1);
      t.dec++; if (pOn) t.protoOpp++; if (hOn) t.holoOpp++; if (pOn && hOn) t.bothOpp++;
      if (low) { t.hp1Dec++; if (pOn) t.hp1ProtoOpp++; }
      const pick = choose(state, pid, legal);
      const key = (typeof pick === 'string') ? pick : (pick && pick.key);
      if (pOn && key === SK.PROTO) t.pickProto++;
      if (hOn && key === SK.HOLO) t.pickHolo++;
      if (pOn && hOn && key !== SK.PROTO && key !== SK.HOLO) t.otherInBoth++;
      if (low) { if (key === SK.PROTO) t.hp1PickProto++; if (key === SK.HOLO) t.hp1PickHolo++; }
      return pick;
    };
    const ch = []; for (let i = 0; i < 5; i++) ch.push(wrapped);
    Play.autoGameN(st, ch);
    t.games++;
    for (const e of st.events) if (e.type === 'action' && e.outcome === 'ok') t.acts++;
  }
  return t;
}

/* ---------- 自检：强制 chooser ⇒ 两个计数必须咬合 ---------- */
if (process.argv.includes('--self-test')) {
  const forceProto = function (state, pid, legal) {
    for (const l of legal) if (l.key === SK.PROTO && l.affordable) return SK.PROTO;
    for (const l of legal) if (l.affordable) return l.key;
    return SK.JI;
  };
  /* 子格要单独有一格控制：forceProto 之下"血≤1 且 proto 买得起"实测一次也不出现（全场都在刷盾，珠子留不到残血那一手），
   *   拿它验子格等于验了个空 ⇒ 这条改成"只在残血时刷盾"的 chooser，逼出那个共现，再要求子格出手 == 子格机会。 */
  const forceLowProto = function (state, pid, legal) {
    const low = !!(state && state.p && state.p[pid] && state.p[pid].hp <= 1);
    if (low) { for (const l of legal) if (l.key === SK.PROTO && l.affordable) return SK.PROTO; }
    for (const l of legal) { if (l.key === SK.PROTO) continue; if (l.affordable) return l.key; }
    return SK.JI;
  };
  const t = scan(forceProto, 8);
  const s = scan(forceLowProto, 12);
  let bad = [];
  if (!(t.protoOpp > 0)) bad.push('自检①：8 局里 proto 机会 = 0 ⇒ 这台根本没碰到候选，读数没有意义（要换装配而不是换阈值）');
  if (t.pickProto !== t.protoOpp) bad.push('自检①：强制选 proto 却只归属了 ' + t.pickProto + '/' + t.protoOpp + ' ⇒ 出手计数字段接错');
  if (t.pickHolo !== 0) bad.push('自检②：强制 proto 之下 holo 出手 = ' + t.pickHolo + '（必须恰好 0）⇒ key 比对接错了卡');
  if (!(s.hp1ProtoOpp > 0)) bad.push('自检③：连"只在残血刷盾"的装配都碰不到 血≤1×买得起proto 这一格（hp1Dec=' + s.hp1Dec +
    '）⇒ 子格无法自证，主读数里那一行不许印');
  if (s.hp1PickProto !== s.hp1ProtoOpp) bad.push('自检③：血≤1 子格里强制 proto 却只归属 ' + s.hp1PickProto + '/' + s.hp1ProtoOpp +
    ' ⇒ 子格的计数器接错了（主格对、子格错是两种病）');
  console.log('proto-chance 自检：主格 机会 ' + t.protoOpp + ' ‖ 归属 ' + t.pickProto + ' ‖ holo ' + t.pickHolo + ' ‖ 决策 ' + t.dec +
    '（8 局 · 必选 proto）' + (t.protoOpp === t.pickProto && t.pickHolo === 0 ? ' ✅' : ' ❌'));
  console.log('proto-chance 自检：子格 决策 ' + s.hp1Dec + ' ‖ proto 买得起 ' + s.hp1ProtoOpp + ' ‖ 归属 ' + s.hp1PickProto +
    '（12 局 · 只在血≤1 必选 proto）' + (s.hp1ProtoOpp > 0 && s.hp1PickProto === s.hp1ProtoOpp ? ' ✅' : ' ❌'));
  bad.forEach(b => console.error('  FAIL ' + b));
  process.exit(bad.length ? 2 : 0);
}

/* ---------- 名单（与 usage-probe 同一份 coords.tsv 解析） ---------- */
const CO = readFileSync(join(ROOT, 'champion-map', 'coords.tsv'), 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const h0 = Object.fromEntries(CO[0].split('\t').map((c, i) => [c, i]));
const rowsC = CO.slice(1).map(l => { const c = l.split('\t'); return { id: c[h0.id], path: c[h0.path] }; })
  .filter(e => e.id && e.path);
const IDS = String(arg('ids', 'T8-s114,K2,SHIPPED-Ldemo')).split(',').map(s => s.trim()).filter(Boolean);
const PATHS = String(arg('paths', '')).split(',').map(s => s.trim()).filter(Boolean);
let list = rowsC.filter(e => IDS.indexOf(e.id) >= 0);
if (PATHS.length) list = list.concat(PATHS.map(p => ({ id: p.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, ''), path: p })));
if (!list.length) { console.error('⛔ 名单是空的（--ids= / --paths=）'); process.exit(2); }

const per = (v, g) => (v / g).toFixed(2).padStart(7);
console.log('装配=' + MODE + ' · ε=' + EPS + ' · ' + GAMES + ' 局/枚（5 席镜像自对局 · 机会=该次决策里买得起）');
console.log('包名'.padEnd(18) + 'proto机会/局' + '  holo机会/局' + '  两者同格/局' + '  选proto' + '  选holo' + '  选别的');
let loaded = 0;
for (const e of list) {
  const p = isAbsolute(e.path) ? e.path : join(ROOT, e.path);
  if (!existsSync(p)) { console.error('  ⚠ ' + e.id + ' 文件不在 ⇒ 跳过（不许拿"读不出"当"没机会"）'); continue; }
  let params; try { params = loadChamp(W, p, ROOT); } catch (x) { console.error('  ⚠ ' + e.id + ' 读包失败：' + String(x.message || x).split('\n')[0]); continue; }
  if (!params || !params.length) { console.error('  ⚠ ' + e.id + ' 读不出参数 ⇒ 跳过'); continue; }
  const base = T.policyChooserN(params, EPS);
  const t = scan(base, GAMES); loaded++;
  const g = t.games;
  console.log(e.id.padEnd(18) + per(t.protoOpp, g) + per(t.holoOpp, g) + per(t.bothOpp, g) +
    per(t.pickProto, g) + per(t.pickHolo, g) + per(t.otherInBoth, g));
  const inBoth = t.bothOpp;
  console.log('   └ 两者同格的 ' + inBoth + ' 次里：proto ' + (inBoth ? (t.pickProto / inBoth * 100).toFixed(1) : '-') +
    '% ‖ holo ' + (inBoth ? (t.pickHolo / inBoth * 100).toFixed(1) : '-') + '% ‖ 别的 ' +
    (inBoth ? (t.otherInBoth / inBoth * 100).toFixed(1) : '-') + '%');
  console.log('   └ **血≤1 子格**（表 B 说 proto 只有这一格抬到 0 附近）：该格决策 ' + t.hp1Dec + ' 次 ‖ proto 买得起 ' +
    t.hp1ProtoOpp + ' 次 ‖ 选 proto ' + t.hp1PickProto + ' ‖ 选 holo ' + t.hp1PickHolo +
    (t.hp1ProtoOpp ? '（proto 在该格的选取率 ' + (t.hp1PickProto / t.hp1ProtoOpp * 100).toFixed(1) + '%）' : ''));
}
if (!loaded) { console.error('⛔ 一枚都没装载成功'); process.exit(2); }
console.log('\n⚠ 口径：机会按**决策次数**摊到局，与"出手/局"同分母才可比；');
console.log('   "两者同格"那一格是 self/other 的干净对照（同 cost 同 pri），但**它不判卡的价** —— 价在 §2/§4 那两把尺里。');
