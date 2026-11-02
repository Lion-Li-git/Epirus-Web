/* pressure-source.mjs — 数"稀有键要应对的局面，在这张桌上到底出现几次/局"（11-02 千问 · §六 K-2 判否后的下一步）
 * 用法：node scratch/pressure-source.mjs --pack=<包> --table=train|strat [--games=40] [--mode=multi|long]
 * 为什么要它：K-2 测到 15 把稀有键"进得了菜单、自选 0"。但"该不该修"要先问一件事——
 *   **对手面有没有制造过它们要应对的局面**（没人放大雷 ⇒ 避雷针/地雷就是废牌；没人把我打残 ⇒ 摄魂/全息没有理由）。
 *   在册纪律："弱点必须是目标在乎的缺口"，分母不足只许写"读不出"，不许写"它不会"。
 * 口径：焦点席 = 被测包（ε=0 纯 argmax）；每个决策点拍一张全场快照；局末再从事件流数"实际打到我身上的牌"。
 * 表里所有数都带分母（快照数 / 局数），跨桌不横比。
 */
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', ''), TABLE = arg('table', 'train'), GAMES = Math.max(5, Number(arg('games', 40)) || 40);
const MODE = arg('mode', 'multi'), N = Math.max(3, Number(arg('n', 5)) || 5), TEMP = Number(arg('temp', 0.15));
if (!PACK) { console.error('用法 --pack=<包> --table=train|strat'); process.exit(2); }

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots, R = W.EpirusRules;
const raw = readPack2(PACK);
if (!raw) { console.error('⛔ 读不出 ' + PACK); process.exit(7); }
const got = packCfgExit(raw, PACK);
const inst = installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));   // ⚠ 测量期间保持装着（代 3 权重不能用 v7 前向读）
const pp = Float64Array.from(P.unpack(raw, true));

/* 焦点席的 chooser：包一层，逐决策拍快照（只读不改 ⇒ 不碰它的选择） */
const SN = [];
const LAST = {};   /* 对手"上一手"计数字典（谓词的独立读法） */
const DEFENSE = new Set([R.SK.GUARD, R.SK.REFLECT, R.SK.BAGUA, R.SK.JINSHIELD, R.SK.ARMOR, R.SK.MIRROR].filter(Boolean));
const focus = (function () {
  const inner = T.policyChooserN(pp, TEMP, 0, 5, 'soft');
  return function (state, pid, legal) {
    const ps = state.p, me = ps[pid] || {};
    let oppEp5 = 0, oppEp3 = 0, oppGuard = 0, tauntOnMe = 0;
    for (let i = 0; i < ps.length; i++) {
      if (i === pid || !ps[i] || ps[i].dead) continue;
      if ((ps[i].ep | 0) >= 5) oppEp5++;
      if ((ps[i].ep | 0) >= 3) oppEp3++;
      /* ⚠ 11-02 更正（阳性对照抓出来的谓词错）：这里原来读 `guardNext/copiedGuard/baguaExtra`，
       *   拿 guardSpam+reflectWall 满桌的对照跑出来仍是 0.00 ⇒ 那几个字段不是"正在摆架势"。
       *   改读 `lastSkill` 是否属于防御/反弹族（同一直方图口径），并在下面打印直方图自证它真能碰到那一格。 */
      if (DEFENSE.has(ps[i].lastSkill)) oppGuard++;
      LAST[ps[i].lastSkill || '—'] = (LAST[ps[i].lastSkill || '—'] || 0) + 1;   /* 第二把读法：直接数对手上一手是什么（防"谓词读错"当成"没有"） */
    }
      /* ⚠ 11-02 更正：原来读 `me.tauntBy != null` —— 那是个**数组**（`state.js:26`，默认 `[]`），恒真 ⇒ 每快照虚报 4.00。
       *   正确谓词是 `me.tauntActive`（`resolve.js:1344` 与 tauntBy 名单同步的那颗布尔）。 */
      if (me.tauntActive === true) tauntOnMe = 1;
    SN.push({ oppEp5, oppEp3, oppGuard, tauntOnMe,
      myHp: me.hp | 0, myHpLow: (me.hp | 0) <= 1 ? 1 : 0, myBead: ((me.elec | 0) + (me.boom | 0)) > 0 ? 1 : 0,
      myMine: (me.mineArmed | 0) > 0 ? 1 : 0, myRod: (me.rodGuard | 0) > 0 ? 1 : 0, myStance: (me.guardNext ? 1 : 0) });
    return inner(state, pid, legal);
  };
})();

/* 对手表 */
const CNT = { targeter: B.pickTargeter, gunSpam: B.pickGunSpam, ringspam: B.pickRingSpam, protomine: B.pickProtoMine,
  deadlineburst: B.pickDeadlineBurst, earlypressure: B.pickEarlyPressure, heavyfire: B.pickHeavyFire, deepsaver: B.pickDeepSaver,
  guardSpam: B.pickGuardSpam, snipeSpam: B.pickSnipeSpam, reflectWall: B.pickReflectSpam };
let subs = [focus], rosterName = '';
if (TABLE === 'train') {
  /* 近似臂的训练压力面：默认 8 个点名 counter 席轮转填满其余席位；`--opp=a,b,c,d` 可点名覆盖（阳性对照必须能打到这一格） */
  const names = (arg('opp', 'targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver')).split(',').map((s) => s.trim()).filter(Boolean);
  for (const nm of names) if (typeof CNT[nm] !== 'function') { console.error('⛔ 不认的对手名 ' + nm + '（名单：' + Object.keys(CNT).join(',') + '）'); process.exit(2); }
  rosterName = names.join(',');
  for (let i = 1; i < N; i++) subs.push(CNT[names[(i - 1) % names.length]]);
} else {
  const A = createArena2(W, { refParams: pp, temp: TEMP, stratified: true, stratCap: '2', stratMix: '0.5' });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
  if (sh < 0) { console.error('⛔ 没有桌形 ' + N + ':' + MODE); process.exit(2); }
  rosterName = 'arena2 分层桌（51 项名单 · shape ' + N + ':' + MODE + '）';
  for (let pid = 1; pid < N; pid++) {
    let ri = (90000 * 7 + pid * 11 + sh * 13 + 101) % A.roster.length, e = A.roster[ri];
    while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
    subs.push(e.sel);
  }
}

const IN = {};        /* 打在我身上的牌（via）→ 事件次数 */
let inRounds = 0;
for (let k = 0; k < GAMES; k++) {
  const st = T.oneGameN(subs, 77000 + k * 977, N, { mode: MODE }).state;
  const dmg = (st.events || []).filter((e) => e.type === 'damage' && e.to === 0);
  for (const e of dmg) { const kk = e.via || e.reason || '?'; IN[kk] = (IN[kk] || 0) + 1; }
  const srcs = {}; for (const e of dmg) srcs[e.source] = 1;
  if (Object.keys(srcs).length >= 2) inRounds++;
}
const agg = {}; for (const s of SN) for (const kk of ['oppEp5', 'oppEp3', 'oppGuard', 'tauntOnMe', 'myHpLow', 'myBead', 'myMine', 'myRod', 'myStance']) agg[kk] = (agg[kk] || 0) + s[kk];
const n = SN.length;
console.log('### 压力源普查 ‖ 包=' + PACK.split('/').pop() + ' ‖ 桌=' + TABLE + ' ‖ ' + MODE + ' ‖ ' + GAMES + ' 局 ‖ 焦点席决策快照 n=' + n);
console.log('   对手名单：' + rosterName + '（⚠ train 表是按 8 个点名席循环填位，**是对训练分布的近似**，不是逐位复现某一臂）');
const per = (kk) => (agg[kk] / n).toFixed(2);
console.log('   每快照（≈每回合）平均：对手 ep≥5 的席数=' + per('oppEp5') + ' ‖ 对手 ep≥3=' + per('oppEp3') +
  ' ‖ 对手摆架势/盾=' + per('oppGuard') + ' ‖ 我被挑衅锁定=' + per('tauntOnMe'));
console.log('   我自己：血≤1 的回合占比=' + (100 * agg.myHpLow / n).toFixed(1) + '% ‖ 手里有珠的占比=' + (100 * agg.myBead / n).toFixed(1) +
  '% ‖ 已布地雷=' + (100 * agg.myMine / n).toFixed(1) + '% ‖ 已上避雷针=' + (100 * agg.myRod / n).toFixed(1) + '%');
console.log('   打到我身上的牌（伤害事件次数/局，分母 ' + GAMES + ' 局）：' +
  Object.entries(IN).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + (v / GAMES).toFixed(2)).join(' ‖ '));
console.log('   被 ≥2 个不同来源打过的局数=' + inRounds + '/' + GAMES + '（集火是否值得学挑衅/转移的分母）');
/* 谓词自证：对手的"上一手"直方图 ⇒ 若这里出现了防御/架势类键而上面 `oppGuard=0.00`，那就是**我的谓词读错**，不许读成"桌上没有" */
console.log('   对手上一手直方图（快照·席计数）：' + Object.entries(LAST).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + '×' + v).join(' ‖ '));
