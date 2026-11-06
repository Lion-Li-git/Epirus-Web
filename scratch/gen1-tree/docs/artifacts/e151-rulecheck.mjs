import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* §E151 · "看见了，但看得见对不对" —— 给反事实配对局面配**规则可判的应然**，打成一个分数
   动机：§E150 量到出厂网络对对手状态很敏感（给一席 +4 ジ ⇒ 30.84% 的决策换 top-1 动作），
   但"敏感"不等于"对"。本节把三类反事实各写成一条**由引擎机制推出的应然**，于是得到的是分数（可当适应度第二项），不是方向感。

   三条规则（跑前定死；每条都只引用机制事实，不含我的偏好）
     R1 地雷 `mine`：机制是"被**非狙击枪**的攻击打中时，除自己外全场各受 1 点火伤" ⇒
        对手 q 布雷后，应然 = **别拿 gun/sword/tank 打 q**（改用 snipe 打它 / 换目标 / 干脆不攻击它，都算对）。
        `dualGun`/`mirror`/`transfer` 是多目标或复制 ⇒ 判"未涉及"（不硬套，免得把尺读歪）。
     R2 集火：给随机一席 −1 血（不打死）⇒ 它成了更脆的那个 ⇒ 应然 = **攻击目标往它转**；原本就在打它算"无变化"。
     R3 前摇：全场对手 ジ→0 ⇒ 电磁炮(2ジ+电)/大雷(5ジ)/激光眼(1ジ+爆) 这些**要钱的反手**当下都不可付 ⇒
        应然 = **防御类往攻击类转**（反过来往防御转算"反向"）。

   ⚠ 两条对照（没有它们，这把尺可能空转还显示"正确率低"）
     `--bot=pro`  = 按上面那张手写的"应然分"取最大 ⇒ **必须**明显高；
     `--bot=anti` = 同一张分取最小 ⇒ **必须**明显低。
     两端拉不开 ⇒ 判据没判别力（本仓"夹具缺对比度 ⇒ 新门变装饰"那一族的坑）。pro/anti 用**同一个**打分函数，只差 argmax/argmin ⇒ 反向是结构上保证的。
   placebo：同一克隆体算两次 ⇒ 必须 0 次不一致（§E150d 那两个"假 0"就是缺这类自证）。 */
const REPO = 'D:/code/Epirus-Web/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = argv.filter(a => !a.startsWith('--'))[0] || 'js/bundled-champion-3p.js';
const BOT = arg('bot', '');
const TABLES = Number(arg('tables', 40));
const GAMES = Number(arg('games', 8));
const SEED = Number(arg('seed', 77000));
const { OPP_SPECS } = await import('file://' + REPO + 'server/opp-pool.mjs');
const { makeAsChooser } = await import('file://' + REPO + 'tools/bot-chooser-lib.mjs');

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Bots = W.EpirusBots, Play = W.EpirusPlay;
const asChooser = makeAsChooser({ T: T, R: R });
let params = null;
if (!BOT) {
  const mm = readFileSync(REPO + PACK, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  params = P.unpack(JSON.parse(mm[1]), true);
  if (!params) { console.error('⛔ 包不兼容 ' + JSON.stringify(P.checkPack(JSON.parse(mm[1])))); process.exit(1); }
}
const NAMES = OPP_SPECS.map(o => o.name).concat(['focusfire', 'minespam', 'cursestorm']);
const FN = {}; for (const o of OPP_SPECS) FN[o.name] = Bots[o.fn];
FN.focusfire = Bots.pickFocusFire; FN.minespam = Bots.pickMineSpam; FN.cursestorm = Bots.pickCurseStorm;
const ATK = new Set([R.SK.GUN, R.SK.SWORD, R.SK.TANK]);
const AMBIG = new Set([R.SK.DUAL_GUN, R.SK.MIRROR, R.SK.TRANSFER]);
const cat = k => (R.byKey[k] ? R.byKey[k].cat : null);
function cloneS(o) {
  if (o === null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(cloneS);
  const r = {}; for (const k of Object.keys(o)) { const v = o[k]; r[k] = (typeof v === 'function') ? v : cloneS(v); } return r;
}

/* ---- 被测席的"选择器"：策略包（argmax 网络）或 手工对照（同一个应然分取最大/最小） ---- */
function ruleScore(st, pid, c) {
  let v = 0;
  const mine = []; for (let i = 0; i < st.p.length; i++) if (i !== pid && st.p[i].hp > 0 && st.p[i].mineArmed) mine.push(i);
  const living = []; for (let i = 0; i < st.p.length; i++) if (i !== pid && st.p[i].hp > 0) living.push(i);
  const poor = living.length > 0 && living.every(i => st.p[i].ep === 0);
  let weak = living[0], strong = living[0];
  for (const i of living) { if (st.p[i].hp < st.p[weak].hp) weak = i; if (st.p[i].hp > st.p[strong].hp) strong = i; }
  if (cat(c.key) === 'attack' && ATK.has(c.key) && mine.indexOf(c.target) >= 0 && st.p[c.target].hp > 1) v -= 10;      // R1（打死的那一发不炸 ⇒ 不免罚）
  if (poor && cat(c.key) === 'defense') v -= 10;                                             // R3
  if (cat(c.key) === 'attack' && !AMBIG.has(c.key)) { if (c.target === weak) v += 5; if (c.target === strong) v -= 5; }  // R2
  return v;
}
function choose(st, pid, use, extreme) {
  const cands = P.candidatesFor(st, pid, use, { lockTarget: false });
  if (!cands || !cands.length) return null;
  let bi = 0;
  if (BOT) {
    const s = cands.map(c => ruleScore(st, pid, c));
    for (let i = 1; i < cands.length; i++) if (extreme === 'min' ? s[i] < s[bi] : s[i] > s[bi]) bi = i;
  } else {
    const f = P.forwardCands(st, pid, cands, params, { temp: 1 });
    for (let i = 1; i < f.probs.length; i++) if (f.probs[i] > f.probs[bi]) bi = i;
  }
  return { key: cands[bi].key, target: cands[bi].target == null ? -1 : cands[bi].target, ncand: cands.length };
}
const subjectPick = (st, pid, use) => choose(st, pid, use, BOT === 'anti' ? 'min' : 'max');

const J = {}, stat = k => (J[k] = J[k] || { n: 0, right: 0, wrong: 0, none: 0, na: 0 });
function judge(rule, cond, ctl, per) {
  const s = stat(rule); const v = cond(ctl, per);
  if (v === 'na') { s.na++; return; }
  s.n++; if (v === 'right') s.right++; else if (v === 'wrong') s.wrong++; else s.none++;
}
let dec = 0, pid0 = -1, placeboN = 0, placeboBad = 0, candSum = 0;
const diagR2 = {};   /* R2 的 wrong 归因桶：验证"是不是被 R1 抢走的" */
for (let t = 0; t < TABLES; t++) {
  const rr0 = T.mulberry32(SEED + t * 7919);
  const pick = []; while (pick.length < 4) { const n = NAMES[Math.floor(rr0() * NAMES.length)]; if (pick.indexOf(n) < 0) pick.push(n); }
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: T.mulberry32(SEED + t * 104729 + g) }, 5);
    if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(SEED + t * 104729 + g);
    const wrap = function (s, pid, legal) {
      if (pid0 < 0) pid0 = pid;
      if (pid !== pid0) return { key: R.SK.JI };
      dec++;
      const v7 = legal.filter(l => l.affordable);
      const use = v7.length ? v7 : [{ key: R.SK.JI, affordable: true }];
      const ctl = subjectPick(cloneS(s), pid, use);
      const pl = subjectPick(cloneS(s), pid, use);
      placeboN++; if (!ctl || !pl) return { key: R.SK.JI };
      candSum += ctl.ncand;
      if (pl.key !== ctl.key || pl.target !== ctl.target) placeboBad++;
      const living = []; for (let i = 0; i < s.p.length; i++) if (i !== pid && s.p[i].hp > 0) living.push(i);
      if (!living.length) return { key: ctl.key, target: ctl.target < 0 ? null : ctl.target };
      const cf = function (apply) { const c = cloneS(s); if (!apply(c.p)) return null; return subjectPick(c, pid, use); };
      const q1 = living[dec % living.length], q2 = living[(dec + 3) % living.length];
      const a1 = cf(p => { if (p[q1].mineArmed) return false; p[q1].mineArmed = true; return true; });
      if (a1) judge('R1 对手布雷 ⇒ 别再拿 gun/sword/tank 打它', (c, p) => {
        const hits = x => ATK.has(x.key) && x.target === q1;
        if (AMBIG.has(c.key) || AMBIG.has(p.key)) return 'na';
        /* ⚠ 第四处修订，**不是对照抓出来的，是读引擎抓出来的**：`resolve.js:394-401 mineResolveAll` 只把
           `hp > 0 && mineArmed` 的席列入爆炸 ⇒ **一发打死的布雷者不会炸**。所以"拿 gun 补掉最后一血"是正解，不该记反向。
           ⇒ 阳性对照的边界就在这儿：`pro` 是按我同一条应然写的，它只能抓"尺与应然不自洽"，**抓不出"应然本身写错"**。
              这条要交给 §E152 的引擎 1-ply 搜索参考手来兜（让引擎自己说该怎么打）。 */
        const lethal = s.p[q1].hp <= 1;                       // ATK 三类都是 1 点伤
        if (lethal && (hits(c) || hits(p))) return 'na';
        if (!hits(c) && !hits(p)) return 'none';
        if (!hits(c) && hits(p)) return 'wrong';
        if (hits(c) && !hits(p)) return 'right';
        return 'wrong';
      }, ctl, a1);
      const a2 = cf(p => { if (p[q2].hp <= 1) return false; p[q2].hp = p[q2].hp - 1; return true; });
      if (a2) judge('R2 某席 −1 血 ⇒ 目标往**扰动后最脆的那席**转', (c, p) => {
        if (cat(c.key) !== 'attack' || AMBIG.has(c.key) || AMBIG.has(p.key)) return 'na';
        /* ⚠ 第一版把这条写错了：判的是"目标有没有转向 q2"，于是**该不动的也记成反向**
           （q2 掉 1 血之后未必就是最脆的那个）。`--bot=pro` 在这条上只有 23.4% 才把这个问题暴露出来 ——
           这正是配阳性对照的理由：对照跑不高，先怀疑尺，不怀疑包。
           现在改成按**扰动后世界里的最脆集合 M**判：控制动作的目标 ∈ M ⇒ 本来就对 ⇒ 无变化。 */
        const stq = cloneS(s); stq.p[q2].hp = stq.p[q2].hp - 1;
        let mn = Infinity; const liv = [];
        for (let i = 0; i < stq.p.length; i++) if (i !== pid && stq.p[i].hp > 0) { liv.push(i); if (stq.p[i].hp < mn) mn = stq.p[i].hp; }
        const M = new Set(liv.filter(i => stq.p[i].hp === mn));
        if (!M.has(q2)) return 'na';                       /* 它还不是最脆 ⇒ 这一维不该拉动目标选择，不记分 */
        /* ⚠ 第五处修订（这次是**判据自己的**，不是打分的）：R2 不许在"这一席同时布雷中"时判反向。
           理由：R1 说"别拿 gun/sword/tank 打布雷者"，R2 说"该打最脆的那一席"，两者对同一席同时成立时**没定优先级** ⇒
           谁被判"反向"取决于我先问哪条，这是尺的问题，不是被测方的问题。
           ⇒ 处理：q2 布雷中 ⇒ 本条**不记分**（'na'），把"两条应然冲突时该怎么办"留给 §E152 的引擎搜索参考手去定。
           （`pro` 的 R2 之所以从 37.0% 跳到 100.0%，根因就在这里少了一半——所以这条必须先落到判据上，
             不能只靠我调打分表，否则包的读数里那部分污染还在。） */
        if (stq.p[q2].mineArmed) { diagR2['q2布雷中.na'] = (diagR2['q2布雷中.na'] || 0) + 1; return 'na'; }
        /* 分桶诊断（验"wrong 是不是被 R1 抢走的"）：场上有**活的布雷者(hp>1)** ⇒ pro 可能正确地绕开它 */
        let mineLive = false;
        for (const i of living) if (s.p[i].mineArmed && s.p[i].hp > 1) mineLive = true;
        const v1 = M.has(c.target) ? 'none' : (M.has(p.target) ? 'right' : 'wrong');
        const bk = (mineLive ? '有布雷者.' : '无布雷者.') + v1;
        diagR2[bk] = (diagR2[bk] || 0) + 1;
        return v1;
      }, ctl, a2);
      const a3 = cf(p => { const anyE = living.some(i => p[i].ep > 0); if (!anyE) return false; for (const i of living) p[i].ep = 0; return true; });
      if (a3) judge('R3 对手 ジ→0 ⇒ 防御往攻击转', (c, p) => {
        const cd = cat(c.key) === 'defense', pd = cat(p.key) === 'defense';
        const ca = cat(c.key) === 'attack', pa = cat(p.key) === 'attack';
        if (cd && pa) return 'right';
        if (ca && pd) return 'wrong';
        return 'none';
      }, ctl, a3);
      return { key: ctl.key, target: ctl.target < 0 ? null : ctl.target };
    };
    /* 对手四席 = 四个互不相同的脚本（产品口径）；被测席固定 seat 0 ⇒ 上面的 pid 守卫必须恒真 */
    Play.autoGameN(st, [wrap, asChooser(FN[pick[0]]), asChooser(FN[pick[1]]), asChooser(FN[pick[2]]), asChooser(FN[pick[3]])]);
  }
}
console.log('# §E151 规则可判的"改对了没有" ‖ ' + (BOT ? '手工对照 bot=' + BOT : '包=' + PACK) +
  ' ‖ 决策点=' + dec + ' ‖ 被测席 pid=' + pid0 + ' ‖ 候选数均值=' + (candSum / Math.max(1, dec)).toFixed(1) + '（必须远大于 1）');
console.log('  placebo（同一克隆体算两次）不一致 = ' + placeboBad + '/' + placeboN + (placeboBad === 0 ? ' ✅' : ' ⛔ 量具有噪声，下面全部读数作废'));
console.log('\n  规则                                    可判   正确   反向  无变化  未涉及   正确/(正确+反向)');
for (const k of Object.keys(J)) {
  const s = J[k], den = s.right + s.wrong;
  console.log('  ' + k.padEnd(38) + String(s.n).padStart(5) + String(s.right).padStart(6) + String(s.wrong).padStart(6) +
    String(s.none).padStart(7) + String(s.na).padStart(7) + '   ' + (den ? (100 * s.right / den).toFixed(1) + '%' : '—'));
}
console.log('\n  ⚠ 读法：分数只取 `正确/(正确+反向)`（"无变化"既不计功也不记账——多数决策本来就不该被这一维拉动）。');
console.log('    对照 pro/anti 用的是同一张应然分、只差 argmax/argmin ⇒ 两端拉不开就是判据写坏了，不是包的问题。');
