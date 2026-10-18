/* 护招反事实：把"送盾给谁"当成唯一变量（送盾**次数**不动 ⇒ 还是同一张网的出手节奏）
 * arm 席 = v7beadseed-82 的网（轮换席，座位均衡），其余 4 席是指名脚本。
 * 四个 arm：
 *   asis     网络自己挑（现状：实测偏向血最多的那席）
 *   churn    改挑"正在搓长招的席"（ringStreak≥1 ∨ ep≥3，取 ep 最大；排除自己）
 *   weak     改挑"血最少的席"（你原话里"快死了还在憋大招"的前半段）
 *   rand     改挑随机合法席（无差别基线）
 * 读被护者：兑现（打出 大雷/天火/聚能环 且未被作废）‖ 死在兑现前 ‖ 局终没搓完 ‖ 延迟回合
 * 读 arm 席：唯一存活率 ‖ 终局血量名次（1=最高）
 * ⚠ 这是**脚本化目标选择的可行性上界/参照**，不是"训练学到了"（用户 10-17 那条主语纠正仍然生效）。 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
/* ROOT 自解析（10-18 归仓时改）：脚本住在 <repo>/tools/ ⇒ 根就是自己的上一级；
 *   需要在别的工作树（测量 worktree）上量时给 `WT=<路径>` 覆盖，别再把某台机器的路径写死在源码里。 */
const ROOT = process.env.WT || path.resolve(fileURLToPath(import.meta.url), '../..');
const imp = (p) => import(pathToFileURL(ROOT + '/' + p).href);
const { sandbox, loadChamp, rejectUnknownFlags } = await imp('tools/audit-lib.mjs');
const { duelAssembly } = await imp('tools/v2v4-lib.mjs');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
/* 仓规（门 D218）：归仓进 `tools/` 就必须带旗标消毒层，否则"拼错的旗标静默按默认档跑完"跟着脚本一起进了仓（名单 = 下面 arg() 读的四个）。 */
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['arm', 'games', 'mode', 'seats'], 'guard-the-charger');
const W = sandbox(ROOT);
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
const ARM = arg('arm', 'asis'), MODE = arg('mode', 'multi'), G = Number(arg('games', 150));
const SPEC = String(arg('seats', 'focusfire,focusfire,focusfire,focusfire'));
const PICKS = Object.keys(B).filter(k => /^pick/.test(k));
const picks = SPEC.split(',').map(s => s.trim()).map(n => {
  const hit = PICKS.find(k => k.slice(4).toLowerCase() === n.toLowerCase());
  if (!hit) { console.error('⛔ 脚本不存在：' + n); process.exit(2); }
  return B[hit];
});
const params = loadChamp(W, 'docs/artifacts/v7beadseed-82.bak', ROOT);
if (!params) { console.error('⛔ 包读不出'); process.exit(7); }
const net = T.policyChooserN(params, 0.15);
/* 兑现集由**声明字段**推导（不写卡名清单，照 evo 的 isBigCard 口径）：数值 cost>=3 ∨ 需珠 energyNeeds；再加天火（它是贴贴链的兑现） */
const BIG = {};
for (const d of R.skills) { const c = typeof d.cost === "number" ? d.cost : 0; if (c >= 3 || (d.energyNeeds && Object.keys(d.energyNeeds).length)) BIG[d.key] = 1; }
BIG[R.SK.FIRESTORM] = 1;
let rngState = 12345;
const rnd = () => { rngState = (rngState * 1103515245 + 12345) & 0x7fffffff; return rngState / 0x7fffffff; };

const st = { games: 0, gifts: 0, paid: 0, died: 0, never: 0, shamN: 0, shamPaid: 0, shamDied: 0, shamNever: 0, delaySum: 0, delayN: 0, soloWin: 0, hpRankSum: 0, hpRankN: 0, churnSeen: 0, rounds: 0, baseN: 0, basePaid: 0, baseDied: 0, baseNever: 0 };
let SHAM = {};
const mkGrp = () => ({ n: 0, armSoloWin: 0, xsoloWin: 0, armRankSum: 0, xRankSum: 0, bigDmg: 0, bigSelf: 0, bigRival: 0, bigOther: 0 });
const A2 = { paid: mkGrp(), unpaid: mkGrp() };
let RS = [], curSeat = 0;
const onTurn = (s2) => {
  const acts = [];
  for (let i = 0; i < s2.p.length; i++) {
    const a = s2.actions && s2.actions[i];
    acts.push({ pid: i, key: a ? a.key : null, target: a && a.target != null ? Number(a.target) : null, voided: !!(a && a.voided), hp: s2.p[i].hp, ep: s2.p[i].ep, ring: s2.p[i].ringStreak | 0 });
  }
  RS.push({ acts });
};
function churnTarget(s2, pid, mode) {
  /* 挑人规则的三种口径（用来分解用户那句"快死了**而在憋大招**"里两个成分各自的权重）：
     'churn'      正在搓长招（ringStreak≥1 ∨ ep≥3），取 ep 最大        —— 只用"憋大招"
     'weakchurn'  在搓长招 **且** hp≤1                                 —— 她的原话复合条件
     'churnnoweak' 在搓长招 **但** hp>1                                —— 只用"憋大招"、排除濒死 */
  let b = -1, be = -1;
  for (let i = 0; i < s2.p.length; i++) {
    if (i === pid || s2.p[i].hp <= 0) continue;
    const churning = (s2.p[i].ringStreak | 0) >= 1 || s2.p[i].ep >= 3;
    if (!churning) continue;
    if (mode === 'weakchurn' && s2.p[i].hp > 1) continue;
    if (mode === 'churnnoweak' && s2.p[i].hp <= 1) continue;
    if (s2.p[i].ep > be) { be = s2.p[i].ep; b = i; }
  }
  return b >= 0 ? b : null;
}
function pickTarget(s2, pid) {  const cand = [];
  for (let i = 0; i < s2.p.length; i++) if (i !== pid && s2.p[i].hp > 0) cand.push(i);
  if (!cand.length) return null;
  if (ARM === 'rand') return cand[Math.floor(rnd() * cand.length) % cand.length];
  if (ARM === 'weak') { let b = cand[0]; for (const i of cand) if (s2.p[i].hp < s2.p[b].hp) b = i; return b; }
  /* churn 族：把挑人交给 churnTarget（三种口径），取不到就按各臂自己的兜底走 */
  if (ARM === 'churn' || ARM === 'weakchurn' || ARM === 'churnnoweak' || ARM === 'churnSham' || ARM === 'churnStrict') {
    const t2 = churnTarget(s2, pid, ARM === 'weakchurn' ? 'weakchurn' : (ARM === 'churnnoweak' ? 'churnnoweak' : 'churn'));
    if (t2 != null) { st.churnSeen++; return t2; }
    if (ARM === 'churnStrict') return cand[Math.floor(rnd() * cand.length) % cand.length];
    return null;
  }
  if (ARM === 'churnStrict') return cand[Math.floor(rnd() * cand.length) % cand.length];   /* 没得挑也照样送盾（随机席）⇒ 送盾次数与 asis 对齐，只留"对象"这一个变量 */
  return null;   /* churn arm 没有可护的人 ⇒ 这一手不送盾（改攒）⇒ 送盾次数会低于 asis，读数只按各自分母引 */
}
const armChooser = function (s2, pid, legal) {
  const r = net(s2, pid, legal);
  const key = (typeof r === 'string' ? r : (r && r.key)) || null;
  if (ARM === 'nogift' && key === R.SK.HOLO) { const j0 = legal.find(l => l.key === R.SK.JI); if (j0) return { key: R.SK.JI, target: null }; }
  /* 假护臂：挑人规则与 churn 一字不差，但这一手**什么都不给**（改攒）⇒ 与 churn 构成"有没有盾"的成对对照，
     把"挑得准"（两个臂相同）与"盾本身"（唯一差别）分开 */
  if (ARM === 'churnSham' && key === R.SK.HOLO) {
    const t = churnTarget(s2, pid);
    if (t != null) SHAM[RS.length] = t;
    const j = legal.find(l => l.key === R.SK.JI);
    if (j) return { key: R.SK.JI, target: null };
  }
  if (ARM !== 'asis' && ARM !== 'nogift' && ARM !== 'churnSham' && key === R.SK.HOLO) {
    const t = pickTarget(s2, pid);
    if (t == null) { const j = legal.find(l => l.key === R.SK.JI); if (j) return { key: R.SK.JI, target: null }; }
    return { key: R.SK.HOLO, target: t };
  }
  return r;
};
/* 从第 w 回合往后追 X：先问"招搓出来没有"（同回合搓完即死算搓出来），再问死没死 */
function track(w, X) {
  for (let k = w + 1; k < RS.length; k++) {
    const ka = RS[k].acts[X];
    if (!ka) continue;
    if (ka.key && BIG[ka.key] && !ka.voided) { st.delaySum += (k - w); st.delayN++; return 'paid'; }
    if (ka.hp <= 0) return 'died';
  }
  return 'never';
}
const onGame = (s2, seat) => {
  st.games++; curSeat = seat;
  /* 逐手送盾 → 往后追被护者是否把长招搓出来 */
  for (let w = 0; w < RS.length; w++) {
    const a = RS[w].acts[seat];
    if (!a || a.key !== R.SK.HOLO || a.target == null) continue;
    st.gifts++;
    const o = track(w, a.target);
    if (o === 'paid') st.paid++; else if (o === 'died') st.died++; else st.never++;
  }
  /* 假护臂：同样挑人的那一手（没给盾）→ 用同一个 track，构成成对对照 */
  for (const w of Object.keys(SHAM)) {
    st.shamN++;
    const o = track(Number(w), SHAM[w]);
    if (o === 'paid') st.shamPaid++; else if (o === 'died') st.shamDied++; else st.shamNever++;
  }
  SHAM = {};
  /* 无盾基线（每个 arm 都算，与送盾无关）：任一席**第一次进入搓招态**（ep≥3 ∨ ring≥1）之后，
   * 是把招搓出来、还是先死、还是局终没搓完 ⇒ 她那句"显眼连招容易搞一半就死"在这套规则里的底数 */
  for (let i = 0; i < s2.p.length; i++) {
    let w0 = -1;
    for (let w = 0; w < RS.length; w++) { const a = RS[w].acts[i]; if (a && (a.ep >= 3 || (a.ring | 0) >= 1)) { w0 = w; break; } }
    if (w0 < 0) continue;
    st.baseN++;
    let o = 'never';
    for (let k = w0 + 1; k < RS.length; k++) {
      const ka = RS[k].acts[i];
      if (ka && ka.key && BIG[ka.key] && !ka.voided) { o = 'paid'; break; }
      if (ka && ka.hp <= 0) { o = 'died'; break; }
    }
    if (o === 'paid') st.basePaid++; else if (o === 'died') st.baseDied++; else st.baseNever++;
  }
  /* 路线 A 的命门：护招**成功**（被护者把招收住）的那些局里，arm 席自己是更强还是更弱？
   * 每局取"被护最多的那一席"为主语（并列取先出现的），按它是否兑现分两组统计 arm 的唯一存活率与血量名次。 */
  {
    const cnt = {};
    for (let w = 0; w < RS.length; w++) {
      const a = RS[w].acts[seat];
      if (a && a.key === R.SK.HOLO && a.target != null) cnt[a.target] = (cnt[a.target] || 0) + 1;
    }
    const ks = Object.keys(cnt);
    if (ks.length) {
      let X = Number(ks[0]);
      for (const k of ks) if (cnt[k] > cnt[X]) X = Number(k);
      let cashed = false;
      for (let w = 0; w < RS.length; w++) { const ka = RS[w].acts[X]; if (ka && ka.key && BIG[ka.key] && !ka.voided) { cashed = true; break; } }
      const grp = cashed ? 'paid' : 'unpaid';
      A2[grp].n++;
      const alive2 = []; for (let i = 0; i < s2.p.length; i++) if (s2.p[i].hp > 0) alive2.push(i);
      if (alive2.length === 1 && alive2[0] === seat) A2[grp].armSoloWin++;
      /* 归因形状的关键一格：被护者那记长招**打到了谁** —— 打到"arm 席的头号威胁"（终局血量最高且不是 X 自己）才是自利，
       * 打不到威胁（甚至打到 arm 自己）就是替全桌做慈善。 */
      const srt2 = s2.p.map((p, i) => ({ i, hp: p.hp })).filter(o => o.hp > 0 && o.i !== X).sort((a, b) => b.hp - a.hp);
      const rival = srt2.length ? srt2[0].i : -1;
      let hitX = 0, hitSelf = 0, hitRival = 0, other = 0;
      for (const e of (s2.events || [])) {
        if (e.type !== 'damage' || e.source !== X || !e.via || !BIG[e.via]) continue;
        hitX += (e.amt || 0);
        if (e.to === seat) hitSelf += (e.amt || 0);
        else if (e.to === rival) hitRival += (e.amt || 0);
        else other += (e.amt || 0);
      }
      A2[grp].bigDmg += hitX; A2[grp].bigSelf += hitSelf; A2[grp].bigRival += hitRival; A2[grp].bigOther += other;
      if (alive2.length === 1 && alive2[0] === X) A2[grp].xsoloWin++;
      const srt = s2.p.map(p => p.hp).slice().sort((x, y) => y - x);
      A2[grp].armRankSum += srt.indexOf(s2.p[seat].hp) + 1;
      A2[grp].xRankSum += srt.indexOf(s2.p[X].hp) + 1;
    }
  }
  st.rounds += RS.length;
  const alive = [];
  for (let i = 0; i < s2.p.length; i++) if (s2.p[i].hp > 0) alive.push(i);
  if (alive.length === 1 && alive[0] === seat) st.soloWin++;
  const sorted = s2.p.map(p => p.hp).slice().sort((x, y) => y - x);
  st.hpRankSum += sorted.indexOf(s2.p[seat].hp) + 1; st.hpRankN++;
  RS.length = 0;
};
duelAssembly({ S, Play, T, R }, params, { games: G, mode: MODE, seed0: 90210, n: 5, scripted: armChooser, chooserFor: (pid) => picks[(pid + 1) % picks.length], onTurn, onGame });

const pc = (a, b) => (b ? (100 * a / b).toFixed(1) + '%（' + a + '/' + b + '）' : '—（分母 0）');
console.log('## arm=' + ARM + ' ‖ 桌 [' + SPEC + '] ‖ mode=' + MODE + ' ‖ 局 ' + st.games + ' ‖ 送盾 ' + st.gifts + '（每局 ' + (st.gifts / st.games).toFixed(2) + '）');
console.log('   被护那一席：把长招搓出来 ' + pc(st.paid, st.gifts) + ' ‖ **死在搓完之前** ' + pc(st.died, st.gifts) + ' ‖ 局终没搓完 ' + pc(st.never, st.gifts) + (st.delayN ? ' ‖ 兑现延迟中位/均值 ' + (st.delaySum / st.delayN).toFixed(1) + ' 回合' : ''));
console.log('   假护对照（同样挑人、但这手不给盾）：搓出来 ' + pc(st.shamPaid, st.shamN) + ' ‖ 先死 ' + pc(st.shamDied, st.shamN) + ' ‖ 没搓完 ' + pc(st.shamNever, st.shamN) + '   ⇐ 与上一行成对 ⇒ 差值才是**盾本身**（本臂 sham=' + st.shamN + ' ‖ 实盾=' + st.gifts + '）');
console.log('   无盾基线（本局所有席，与送盾无关）：进入搓招态 ' + st.baseN + ' 人次 ‖ 搓出来 ' + pc(st.basePaid, st.baseN) + ' ‖ **先死** ' + pc(st.baseDied, st.baseN) + ' ‖ 局终没搓完 ' + pc(st.baseNever, st.baseN));
console.log('   护招**成功**那组局：n=' + A2.paid.n + ' ‖ arm 唯一存活率 ' + pc(A2.paid.armSoloWin, A2.paid.n) + ' ‖ 被护者唯一存活率 ' + pc(A2.paid.xsoloWin, A2.paid.n) + ' ‖ 终局血量名次 arm ' + (A2.paid.n ? (A2.paid.armRankSum / A2.paid.n).toFixed(2) : '—') + ' / 被护者 ' + (A2.paid.n ? (A2.paid.xRankSum / A2.paid.n).toFixed(2) : '—'));
console.log('   护招**失败**那组局：n=' + A2.unpaid.n + ' ‖ arm 唯一存活率 ' + pc(A2.unpaid.armSoloWin, A2.unpaid.n) + ' ‖ 被护者唯一存活率 ' + pc(A2.unpaid.xsoloWin, A2.unpaid.n) + ' ‖ 终局血量名次 arm ' + (A2.unpaid.n ? (A2.unpaid.armRankSum / A2.unpaid.n).toFixed(2) : '—') + ' / 被护者 ' + (A2.unpaid.n ? (A2.unpaid.xRankSum / A2.unpaid.n).toFixed(2) : '—'));
console.log('   被护者那记长招的**落点**（成功组：总 ' + A2.paid.bigDmg.toFixed(0) + ' 点）：打到 arm 自己 ' + A2.paid.bigSelf.toFixed(1) + ' ‖ 打到 arm 的头号威胁 ' + A2.paid.bigRival.toFixed(1) + ' ‖ 打到第三方 ' + A2.paid.bigOther.toFixed(1) + '   ⇐ 只有"打到威胁"那一格是自利，其余都是替全桌做慈善');
console.log('   arm 席：唯一存活率 ' + pc(st.soloWin, st.games) + ' ‖ 终局血量名次均值 ' + (st.hpRankSum / st.hpRankN).toFixed(2) + '（1=最高） ‖ churn 目标缺席而不送盾 ' + (st.gifts - st.paid - st.died - st.never === 0 ? '' : '') + st.churnSeen + ' 次被挑中');
