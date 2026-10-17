#!/usr/bin/env node
/* support-probe.mjs —— 辅助/结盟的**选择性**与**兑现**读数（研究量具，不进判据，只读）
 *
 * 为什么另起一把（2026-10-17 夜，查档后确认只剩这两格空白）：
 *   · "打领先者 / 集火比例 / 惩罚开环靶向率 / holo 送盾量" **都在册**（`kill-instinct` ‖ `behavior-profile:128-140`
 *     ‖ `gate-drafts` G6 ‖ `champion-map/holo.tsv`）⇒ 不重造；
 *   · 空白 ①：**这一手是白给还是兑现** —— 全仓没有工具读得到"受益者这一回合真被招呼了吗"（`defense-quality` 只判"有没有人来"，不记为谁）；
 *   · 空白 ②：多方在同一回合**对齐**才触发的规则层事件（合二为一 / 聚光炮 / 反复横跳 / 铁索连环）没有按局计数。
 *   这两格恰好是用户那句"辅助应该很少发生，但出现在**场面决定**的位置上"的可观测量。
 *
 * ★ 三列必须分开报（否则"少"这个字没有含义）：
 *   **机会**（谓词成立且买得起，判在**决策时** ⇒ 事后补判就是泄漏） ‖ **出手** ‖ **兑现**（受益者当回合真被招呼），
 *   并且每个"选择性/白给率"都要配一条 **无差别点名的基线**（§对照）—— 没有基线的 88% 与 80% 都只是半个数。
 *
 * 装配真源（一条都不在这里重写）：档位 = `bots.js:DIFF_TIERS` ‖ 抽签 = `js/pool-draw.js` ‖
 *   对局循环 = `tools/v2v4-lib.mjs:duelAssembly`（`onTurn` 钩子 = §E640 新加的**默认为空**的透传）‖
 *   人类席 = `audit-lib:humanPrototypes` ‖ 剂量 = `Bots.tierEpsAt(档, 人数, 3)`。
 *   ⚠ 为什么必须要 `onTurn`：脚本席的 chooser 返回的是**裸 key**，目标由引擎 `resolveTarget` 兜底，
 *     而 `action` 事件里不带 target ⇒ 不在结算后快照 `st.actions`，"套盾给谁/藤甲贴给谁"就永远读不到
 *     （第一版就是在 DEC 里读 target，藤甲 1265 次出手只对上 2 个目标）。
 *
 * 谓词与出处见 `docs/research/SUPPORT-TAXONOMY-2026-10-17.md` §1/§4：
 *   O_holo  全息屏障（唯一 `target:'other'`）：A = 存在 j≠我 `hp_j ≤ 1` ∧（`ringStreak_j ≥ 2` ∨ `ep_j ≥ 3`）‖ B = 没有。
 *           兑现 = j 当回合真被招呼（`blocked/reflect to=j` 或 `damage to=j ∧ source≠null ∧ source≠j ∧ R.byKey[via]` 存在），
 *           口径照 `tools/defense-quality.mjs:classifyDefenseWindow`（"白防"同族病）。
 *   O_armor 藤甲：兑现按目标在 Now+Next 两回合**实际吃到的火源数**分档（0=纯亏 ‖ 1=与 1 珠的枪持平 ‖ ≥2=用户说的"+2 才赚"）。
 *           ⚠ 只能是**下界**：`damage` 事件没有属性字段（`resolve.js:316`），火只能从"via 是哪张卡 ⇒ `dmg.type`"倒推。
 *   O_xfer  转移伤害：机会 = 买得起 ∧ 本回合真有人打我；兑现 = 结算窗内出现 `transfer{from=我}`。
 *   O_ring  惩罚开环：机会 = 存在 `ringStreak ≥ 2` 的 j ∧ 我买得起任一作废手段（小雷/大雷/`ATK_EFFECT`）；读数 = 那一手打向 j 的比例。
 *           ⚠ 与在册 G6 的宽威胁定义（`ringStreak≥1 ∨ ep≥5 ∨ 刚狙击`）**不同源** ⇒ 只许并排读，不许合并成一个数。
 *   对齐    合二为一 / 聚光炮 / 反复横跳（`hidden` 事件的 name）‖ 铁索连环（`damage{via:'chain'}`）
 *           ‖ 集火 = 同回合 ≥2 席的**攻击类**出手落到同一目标（N4：两击都落地 ⇒ 没有结盟也有结盟的效果），
 *           被集火者是否**决策时**的"血最多"/"珠最多"（两把并列报，基准 = 无差别点名 1/(存活−1)）。
 *
 * ⚠ 三条不许越界：① 一切逐席对称，**人类席只是 5 席之一**，不单独当主语（用户 23:3x 纠正）；
 *   ② 脚本席（`st:toolkit`）只当正对照，不许当"训练学到了"的证据（用户 23:3x 纠正②）；
 *   ③ 本文件只出读数，不改奖励、不加门、不动引擎。
 *
 * 用法：node docs/debug/support-probe.mjs [--tiers=lv:sparring,lv:regular,lv:hard] [--games=80]
 *         [--seeds=90210,...] [--protos=reflectspam,defend,...] [--mode=multi] [--out=docs/artifacts/x.tsv]
 *       node docs/debug/support-probe.mjs --self-test
 * 退出码：0 ‖ 2 = 输入不齐 / 自检不过 ‖ 7 = 包读不出 / 漏席
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, humanPrototypes } from '../../tools/audit-lib.mjs';
import { duelAssembly } from '../../tools/v2v4-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const flag = (n, d) => { const a = process.argv.find(x => x.indexOf('--' + n + '=') === 0); return a ? a.slice(n.length + 3) : d; };
const N = 5, AI = 4;
const MODE = flag('mode', 'multi');
const G = Math.max(1, Number(flag('games', 80)) || 80);
const SEEDS = String(flag('seeds', '90210,90211,90212')).split(',').map(Number).filter(x => !Number.isNaN(x));
const TIERS = String(flag('tiers', 'lv:sparring,lv:regular,lv:hard')).split(',').filter(Boolean);
/* 逐枚底片档：`--subject=<id>` ⇒ 每局把**一席**换成被测包（其余三席照常按该档的带抽、人类席照常轮座），
 *   且每席计数只算被测那一席（集火/对齐是全场量，这一档不进）。位置按局轮换 ⇒ 座位不混进读数。 */
const SUBJ = flag('subject', '') || null;
const WANT = String(flag('protos', 'reflectspam,defend,farmer,gunspam,deepsaver+reflect,heavyfire+reflect')).split(',').map(s => s.trim()).filter(Boolean);

const W = sandbox(ROOT);
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots, PD = W.EpirusPoolDraw;
const SK = R.SK;
if (!PD || typeof PD.compose !== 'function') { console.error('⛔ js/pool-draw.js 没进 sandbox 的 CORE 名单'); process.exit(2); }

const FIRE = new Set([R.DMG.FIRE, R.DMG.FIRELIGHT]);
const NULLIFY = new Set([SK.MINI_T, SK.BIG_T].concat(R.ATK_EFFECT));   /* 能作废别人这一手的手段 */
const isAtkKey = k => { const d = R.byKey[k]; return !!d && d.target === 'enemy' && !!d.dmg; };   /* 会"招呼到某人"的出手（集火只数这些） */
const HIDDEN = { merge: '合二为一', spotlight: '聚光炮', hop: '反复横跳' };

function blankAgg() {
  return {
    games: 0, decisions: 0, roundsSeen: 0, rewind: 0, orphan: 0, gapBad: 0, gapNoRound: 0, gapTail: 0, tailSample: [],
    holo: { oppA: 0, oppB: 0, fireA: 0, fireB: 0, gift: 0, eff: 0, later: 0, idle: 0, self: 0, rightTarget: 0, baseEffSum: 0, baseN: 0 },
    delay: { hoard: 0, spent: 0, never: 0, dl: [] },                    /* 攒到 ep≥3 的席次 ‖ 之后花掉 ≥3 费的 ‖ 到死/局终没花 ‖ 延迟回合数 */
    armor: { opp: 0, fire: 0, withTarget: 0, land: [0, 0, 0] },
    xfer: { opp: 0, fire: 0, landed: 0, destOther: 0 },
    ring: { opp: 0, hitJ: 0, baseSum: 0, baseN: 0 },
    align: { merge: 0, spotlight: 0, hop: 0, chain: 0, focus: 0, focusHp: 0, focusEp: 0, baseSum: 0, baseN: 0 }
  };
}

/* ===== 决策时记录（只用来算**机会**与"买得起"，不参与兑现） ===== */
function mkDec(agg) {
  const DEC = [];
  const wrap = function (inner, kindOf) {
    return function (st, pid, legal) {
      const snap = st.p.map(p => ({ hp: p.hp, ep: p.ep, ring: p.ringStreak | 0 }));
      const aff = k => legal.some(l => l.key === k && l.affordable);
      const rec = { rd: st.round, pid: Number(pid), kind: kindOf(pid), snap, aff: {}, key: null };
      for (const k of [SK.HOLO, SK.ARMOR, SK.TRANSFER, SK.MINI_T, SK.BIG_T, SK.RING]) rec.aff[k] = aff(k);
      rec.affNullify = legal.some(l => l.affordable && NULLIFY.has(l.key));
      const r = inner(st, pid, legal);
      rec.key = (typeof r === 'string' ? r : (r && r.key)) || null;
      DEC.push(rec);
      return r;
    };
  };
  return { DEC, wrap };
}

/* ===== 回合快照（`onTurn` 在 `resolveActions`+`endTurn` 之后 ⇒ 唯一能看到引擎解析出的 target 的时机） ===== */
function mkRoundRec() {
  const RS = [];
  let prevEv = 0, lastSt = null;
  const onTurn = function (st) {
    /* ⚠ **换局必须把事件偏移归零**：`duelAssembly` 每局新建一个 `st`，而这里按 `st.events.length` 切窗 ⇒
     *   不重置的话第 2 局起 `s` 停在上一局的末尾、`e` 是本局的小下标 ⇒ 窗口空转，
     *   "兑现/白给"整列会读成"全白给"（这个错是自检腿⑦⑧ 逼出来的，不是靠读数看出的）。 */
    if (st !== lastSt) { prevEv = 0; lastSt = st; }
    const evLen = (st.events || []).length;
    const acts = [];
    for (let i = 0; i < st.p.length; i++) {
      const a = st.actions ? st.actions[i] : null;
      if (a && a.key) acts.push({ pid: i, key: a.key, target: a.target != null ? Number(a.target) : null, voided: !!a.voided });
    }
    RS.push({ rd: st.round, s: prevEv, e: evLen, acts,
      snap: st.p.map(p => ({ hp: p.hp, ep: p.ep, ring: p.ringStreak | 0 })) });
    prevEv = evLen;
  };
  return { RS, onTurn };
}

/* 结算窗内"这一席真被招呼了吗"（口径照 classifyDefenseWindow：挡下到 = 有效，被真卡打到 = 半有效，没人来 = 白给） */
function addressed(ev, w, pid) {
  let blocked = false, pierced = false;
  for (let i = w.s; i < w.e; i++) {
    const e = ev[i];
    if (!e || e.to !== pid) continue;
    if (e.type === 'blocked' || e.type === 'reflect') { blocked = true; continue; }
    if (e.type === 'damage') {
      if (e.source == null || e.source === pid) continue;
      if (!e.via || !R.byKey[e.via]) continue;
      pierced = true;
    }
  }
  return blocked ? 'eff' : pierced ? 'part' : 'idle';
}
function isFireHit(e) {
  const d = R.byKey[e.via];
  if (d && d.dmg && FIRE.has(d.dmg.type)) return true;
  if (e.via === 'mine') return true;
  return /火/.test(String(e.reason || ''));
}
function fireHits(ev, w, pid) {
  let n = 0;
  for (let i = w.s; i < w.e; i++) { const e = ev[i]; if (e && e.type === 'damage' && e.to === pid && isFireHit(e)) n++; }
  return n;
}

function tallyGame(agg, st, seat, DEC, RS, kindOf, onlyPid) {
  agg.games++;
  /* `onlyPid`（逐枚底片档）：把**每席计数**限定到被测那一席（集火/对齐是全场量，这一档直接跳过）。
   *   没有这一档就只能读"四席合计"，而"哪几枚 ever 送过盾"这个问题需要分母逐枚对齐 ⇒ 加档不加口径。 */
  const decFor = onlyPid == null ? DEC : DEC.filter(d => d.pid === onlyPid);
  const actsOnly = onlyPid != null;
  /* ⚠ 两个数组**各自**判单调，不许共用游标：DEC 走到本局最后一回合，而 RS 从第 1 回合重新开始 ⇒
   *   共用一个 `prevRd` 会把每一回合都误判成"倒退"（第一版这条红 3285 次就是这么来的 —— 红的是我的检查，不是数据）。 */
  let pDec = -1, pRs = -1;
  for (const d of DEC) { if (d.rd < pDec) agg.rewind++; else pDec = d.rd; }
  for (const r of RS) { if (r.rd < pRs) agg.rewind++; else pRs = r.rd; }
  const ev = st.events || [];
  /* 腿⑨ 的现场断言，拆成**三个不同成因**（合在一起判就会把"空局"当成"接线错"）：
   *   `gapInterior` 第 2 格起 `r.s` 不等于上一格 `r.e` ⇒ 真是窗接错（换局没归零那一族），必须判死；
   *   `gapNoRound` 本局一次 `onTurn` 都没发生（0 回合）⇒ 窗口无从谈起，只登记；
 *    `gapTail` 最后一格终点 ≠ 事件总长 ⇒ 有事件落在窗外（对照实验证明 multi/long 下 400 局 0 例，所以一旦非 0 就要单独看）。 */
  {
    if (!RS.length) agg.gapNoRound++;
    else {
      let cursor = 0, interior = 0;
      if (RS[0].s !== 0) interior++;
      for (const r of RS) { if (r.s !== cursor) interior++; cursor = r.e; }
      if (interior) agg.gapBad += interior;
      if (cursor !== ev.length) { agg.gapTail++; if (agg.tailSample.length < 6) agg.tailSample.push('第 ' + st.round + ' 回合后 ' + (ev.length - cursor) + ' 条[' + ev.slice(cursor, cursor + 3).map(e => e.type + '/' + (e.reason || e.via || '')).join(',') + ']'); }
    }
  }
  const winOf = rd => { const r = RS.find(x => x.rd === rd); return r ? { s: r.s, e: r.e } : null; };
  const preOf = rd => { const d = DEC.find(x => x.rd === rd); return d ? d.snap : (RS.find(x => x.rd === rd) || {}).snap || null; };

  /* ---------- 机会（决策时）---------- */
  const ringOpp = {};
  for (const d of decFor) {
    agg.decisions++;
    const me = d.snap[d.pid];
    const others = d.snap.map((p, i) => ({ i, p })).filter(x => x.i !== d.pid && x.p.hp > 0);
    if (d.aff[SK.HOLO]) {
      const j = others.find(x => x.p.hp <= 1 && (x.p.ring >= 2 || x.p.ep >= 3));
      if (j) agg.holo.oppA++; else agg.holo.oppB++;
      if (d.key === SK.HOLO) { j ? agg.holo.fireA++ : agg.holo.fireB++; }
    }
    if (d.aff[SK.ARMOR]) agg.armor.opp++;
    /* ⚠ 这三行是"重写时丢掉、被闭合检查抓回来"的三条计数器，别再动：
     *   `armor.fire` 按**决策**计（与快照里的 `withTarget` 必须相等，腿⑥），
     *   `ringOpp` 记"这一席在这一回合有没有把开环者当合法靶"，`hitJ` 只能在回合快照里对上目标才算（腿⑧）。 */
    if (d.key === SK.ARMOR) agg.armor.fire++;
    const richIdx = others.find(x => x.p.ring >= 2);
    if (richIdx && d.affNullify) ringOpp[d.rd + '|' + d.pid] = richIdx.i;
    if (d.aff[SK.TRANSFER]) {
      const beingHit = (RS.find(x => x.rd === d.rd) || { acts: [] }).acts
        .filter(a => a.pid !== d.pid && a.target === d.pid && isAtkKey(a.key) && !a.voided).length > 0;
      if (beingHit) { agg.xfer.opp++; if (d.key === SK.TRANSFER) agg.xfer.fire++; }
    }
    if (richIdx && d.affNullify) {
      agg.ring.opp++;
      /* 基准 = 无差别点名打到 j 的概率（存活他席数）⇒ 没有这条，11% 是"惩罚"还是"顺手"没人知道 */
      agg.ring.baseSum += 1 / others.length; agg.ring.baseN++;
    }
  }

  /* ---------- 出手与兑现（回合快照，目标一律取**引擎解析出的**那一个）---------- */
  const firePlayed = {}, armorPlayed = {}, xferPlayed = {};
  for (const d of DEC) {
    if (d.key === SK.HOLO) firePlayed[d.rd + '|' + d.pid] = 1;
    if (d.key === SK.ARMOR) armorPlayed[d.rd + '|' + d.pid] = 1;
    if (d.key === SK.TRANSFER) xferPlayed[d.rd + '|' + d.pid] = 1;
  }
  for (const r of RS) {
    const w = { s: r.s, e: r.e }, next = winOf(r.rd + 1);
    const alive = r.snap.map((p, i) => ({ i, p })).filter(x => x.p.hp > 0);
    const actsFor = actsOnly ? r.acts.filter(a => a.pid === onlyPid) : r.acts;
    for (const a of actsFor) {
      const mine = firePlayed[r.rd + '|' + a.pid] || armorPlayed[r.rd + '|' + a.pid] || xferPlayed[r.rd + '|' + a.pid];
      if (!mine) continue;                     /* 出手按 DEC 计（决策时那手是什么），兑现按快照对号 */
      if (a.key === SK.HOLO && !a.voided) {
        agg.holo.gift++;
        if (a.target == null) { agg.orphan++; continue; }
        if (a.target === a.pid) { agg.holo.self++; continue; }
        /* 兑现分三档（2026-10-18 夜改的口径，改因要写着）：
         *   `eff`   = **当回合**真被招呼 ⇒ 盾挡住了那一手
         *   `later` = 当回合没人打他，但**下一回合**被招呼 ⇒ 这是**提前保护**，不是浪费
         *   `idle`  = 两回合都没人打他 ⇒ 才是真白给
         * 第一版只有两档，把"提前保护"记成了"白给"⇒ 那个 79.3% 是**口径造成的**，不是行为造成的（DONE-7 的数已被取代）。 */
        const k0 = addressed(ev, w, a.target);
        const k1 = next ? addressed(ev, next, a.target) : 'idle';
        if (k0 !== 'idle') agg.holo.eff++;
        else if (k1 !== 'idle') agg.holo.later++;
        else agg.holo.idle++;
        /* 基线：随机把盾给"别的存活席"时，那人当回合被招呼的概率 */
        const cands = alive.filter(x => x.i !== a.pid);
        const hit = cands.filter(x => addressed(ev, w, x.i) !== 'idle').length;
        if (cands.length) { agg.holo.baseEffSum += hit / cands.length; agg.holo.baseN++; }
      }
      if (a.key === SK.ARMOR && !a.voided) {
        if (a.target == null) { agg.orphan++; continue; }
        agg.armor.withTarget++;
        const n = fireHits(ev, w, a.target) + (next ? fireHits(ev, next, a.target) : 0);
        agg.armor.land[Math.min(2, n)]++;
      }
      if (a.key === SK.TRANSFER && !a.voided) {
        /* ⚠ 事件形状是 `{type:'transfer', to=**转嫁者**, from=原攻击者, dest=被转嫁到的席}`（`resolve.js:467`）
         *   ⇒ 第一版拿 `from` 当转嫁者，于是"出手 203 次、transfer 事件 0 次"这种荒唐数就出来了。 */
        for (let i = w.s; i < w.e; i++) { const e = ev[i]; if (e && e.type === 'transfer' && Number(e.to) === a.pid) { agg.xfer.landed++; if (Number(e.dest) !== a.pid) agg.xfer.destOther++; } }
      }
    }
    /* 点名正确率：A 局面里那一手 holo 有没有正好给到那个"濒死+憋大"的席
     *   ⚠ 必须走 `actsFor`（逐枚底片档只算被测那一席）—— 第一版这里用了 `r.acts` ⇒ 把别的席记功到被测席头上，
     *     出现过 SP-s30 "点名 14 / 送盾 5" 这种 >1 的荒唐比，是 batch-2 对比时才露出来的。 */
    for (const a of actsFor) {
      if (a.key !== SK.HOLO || !firePlayed[r.rd + '|' + a.pid]) continue;
      const pre = preOf(r.rd); if (!pre) continue;
      const j = pre.map((p, i) => ({ i, p })).filter(x => x.i !== a.pid && x.p.hp > 0 && x.p.hp <= 1 && (x.p.ring >= 2 || x.p.ep >= 3));
      if (j.length && a.target != null && j.some(x => x.i === a.target)) agg.holo.rightTarget++;
    }
    /* ---------- 惩罚开环的命中：必须在 `mine` 那个 early-continue **之外**数 ----------
     *   （第一版把它插在里面 ⇒ 只有"这回合恰好也打了 holo/藤甲/转移"的席才算命中 ⇒ 真正的惩罚者全被跳过，
     *    于是读出来是 0.0%（0/10781）—— 那是仪器的 0，不是 AI 的 0。自检腿⑧ 就是钉它的。） */
    for (const a of actsFor) if (isAtkKey(a.key) && !a.voided && a.target != null && ringOpp[r.rd + '|' + a.pid] === a.target) agg.ring.hitJ++;
    /* ---------- 集火（同回合 ≥2 席攻击类打同一目标；N4 两击都落地）---------- */
    if (!actsOnly) {   /* 集火与对齐是**全场**量，逐枚底片档跳过（不许把全场量记到某一枚头上） */
    const cnt = {};
    for (const a of r.acts) if (isAtkKey(a.key) && !a.voided && a.target != null) cnt[a.target] = (cnt[a.target] || 0) + 1;
    const pre = preOf(r.rd) || r.snap;
    for (const t of Object.keys(cnt)) {
      if (cnt[t] < 2) continue;
      agg.align.focus++;
      const al = pre.map((p, i) => ({ i, hp: p.hp, ep: p.ep })).filter(x => x.hp > 0);
      const mxHp = Math.max.apply(null, al.map(x => x.hp)), mxEp = Math.max.apply(null, al.map(x => x.ep));
      const who = al.find(x => x.i === Number(t));
      if (who && who.hp >= mxHp) agg.align.focusHp++;
      if (who && who.ep >= mxEp) agg.align.focusEp++;
      agg.align.baseSum += 1 / Math.max(1, al.length - 1); agg.align.baseN++;
    }
    /* ---------- 对齐事件（只数本局新增那段，防跨回合重数）---------- */
    for (let i = r.s; i < r.e; i++) {
      const e = ev[i]; if (!e) continue;
      if (e.type === 'hidden') {
        if (e.name === HIDDEN.merge) agg.align.merge++;
        else if (e.name === HIDDEN.spotlight) agg.align.spotlight++;
        else if (e.name === HIDDEN.hop) agg.align.hop++;
      } else if (e.type === 'damage' && e.via === 'chain') agg.align.chain++;
    }
    }   /* ← 收 `if (!actsOnly)`：集火与对齐是全场量，逐枚底片档不进这两列 */
    agg.roundsSeen++;
  }
  /* ---------- 攒→花延迟（长程最便宜的一个代理：忍不忍得住）----------
   * 定义：某席 `ep ≥ 3` 第一次成立的那一回合起，到它第一次打出一张**静态费用 ≥3** 的牌之间隔了几回合；
   *   到死/到局终都没打出来 ⇒ `never`。动态费用的牌（聚能环/过载炮/激光眼 `cost=null`）一律跳过 ⇒ 不抄数。
   * ⚠ 两条边界要连着引：① 用的是**结算后**快照（那才是"真的握有 3 珠"的时刻），所以延迟是**下界**；
   *   ② **能量珠不能用这个代理** —— 规则上珠只活到下一回合（`resolve.js:1292-1297`，未用即 `beadExpire`）
   *     ⇒ "蓄能→兑现"恒 ≤1 回合，量不出长程；DS 任务书里"留牌到后手"同理不成立（本作没有手牌）。 */
  {
    const hoardRd = {}, spentAt = {};
    for (const r of RS) for (let pid = 0; pid < r.snap.length; pid++) {
      if (r.snap[pid].hp <= 0) continue;
      if (hoardRd[pid] === undefined && r.snap[pid].ep >= 3) hoardRd[pid] = r.rd;
    }
    for (const r of RS) for (const a of r.acts) {
      const h = hoardRd[a.pid];
      if (h === undefined || spentAt[a.pid] !== undefined || a.voided || r.rd < h) continue;
      const d = R.byKey[a.key];
      if (d && typeof d.cost === 'number' && d.cost >= 3) spentAt[a.pid] = r.rd - h;
    }
    for (const pid of Object.keys(hoardRd)) {
      if (onlyPid != null && Number(pid) !== onlyPid) continue;
      agg.delay.hoard++;
      if (spentAt[pid] !== undefined) { agg.delay.spent++; agg.delay.dl.push(spentAt[pid]); } else agg.delay.never++;
    }
  }
  DEC.length = 0; RS.length = 0;   /* 逐局清空：不清就是每局重数前面所有局（自检腿⑤ 钉这条） */
}

/* ===== 自检：五腿，全是**手算得出来**的合成装配（不拿引擎风格当基准）=====
 * ① 只按ジ ⇒ 机会必须 >0 而辅助出手必须恰好 0（钉"没出手 ≠ 没机会"——上次普查读出 0 就是混了这两件事）
 * ② holo 优先 ⇒ 送盾 >0、送给自己必须 0（`target:'other'` 的语义没读反）、基线概率落在 (0,1]
 * ③ 五席全打 pid0 ⇒ 集火必须数得到，且 `addressed` 在那个构造场面里必须判到非 idle（**兑现计数器的正对照**）
 * ④ 闭合 ⇒ eff+idle+self = 有目标的送盾数；**藤甲"出手"与"有目标"必须相等**（第一版这里 1265 vs 2，就是裸 key 的坑）
 * ⑤ 逐局清空 ⇒ 回合号在同份记录里不许倒退；每局决策数不许超过 5 席 × 60 回合 */
function selfTest() {
  const params = loadChamp(W, join(ROOT, 'js/bundled-champion.js'), ROOT);
  if (!params) { console.error('⛔ 自检起不来：读不出 js/bundled-champion.js'); process.exit(2); }
  const kinds = {}; for (let i = 0; i < N; i++) kinds[i] = 'pack';
  const runWith = function (inner, games, seed0) {
    const agg = blankAgg();
    const { DEC, wrap } = mkDec(agg);
    const RR = mkRoundRec();
    const w = wrap(inner, pid => kinds[pid]);
    duelAssembly({ S: S, Play: Play, T: T, R: R }, params,
      { games: games, mode: 'multi', seed0: seed0, n: N, scripted: w, chooserFor: () => w, onTurn: RR.onTurn,
        onGame: (st, seat) => tallyGame(agg, st, seat, DEC, RR.RS, pid => kinds[pid]) });
    return agg;
  };
  const jiA = runWith(function () { return { key: SK.JI, target: null }; }, 24, 4242);
  const holoFirst = function (st, pid, legal) {
    const h = legal.find(l => l.key === SK.HOLO && l.affordable);
    if (h) { const opps = S.opponentsOf(st, pid); return { key: SK.HOLO, target: opps.length ? opps[0] : null }; }
    const g = legal.find(l => l.key === SK.GUN && l.affordable);
    return g ? { key: SK.GUN, target: T.pickTargetN(st, pid, SK.GUN) } : { key: SK.JI, target: null };
  };
  const hA = runWith(holoFirst, 24, 7777);
  const ag3 = runWith(function () { return { key: SK.GUN, target: 0 }; }, 24, 5151);
  const bad = [];
  if (!(jiA.holo.oppA + jiA.holo.oppB > 0)) bad.push('① 只按ジ那批 holo 机会数为 0 ⇒ 分母没建立，"没出手"就无法与"没机会"区分');
  if (jiA.holo.fireA + jiA.holo.fireB !== 0 || jiA.armor.fire !== 0 || jiA.xfer.fire !== 0)
    bad.push('① 只按ジ那批的辅助出手必须恰好 0，实测 holo ' + (jiA.holo.fireA + jiA.holo.fireB) + ' ‖ 藤甲 ' + jiA.armor.fire + ' ‖ 转移 ' + jiA.xfer.fire);
  if (jiA.decisions > jiA.games * 300) bad.push('⑤ 每局决策 ' + (jiA.decisions / jiA.games).toFixed(0) + ' > 上限 300（5 席 × 60 回合）⇒ 计数在跨局累加');
  if (jiA.rewind || hA.rewind || ag3.rewind) bad.push('⑤ 回合号倒退 ' + (jiA.rewind + hA.rewind + ag3.rewind) + ' 次 ⇒ DEC/RS 没逐局清空，三列全是重复计数');
  if (!(hA.holo.gift > 0)) bad.push('② holo 优先那批一次盾都没送出 ⇒ 送盾计数器是死的');
  if (hA.holo.self !== 0) bad.push('② 送给自己 ' + hA.holo.self + ' 次 ⇒ `target:other` 被我读反了');
  if (!(hA.holo.baseN > 0 && hA.holo.baseEffSum / hA.holo.baseN >= 0 && hA.holo.baseEffSum / hA.holo.baseN <= 1))
    bad.push('② 送盾基线概率不落在 [0,1] ⇒ "白给率"没有参照系了（实测 ' + (hA.holo.baseEffSum / Math.max(1, hA.holo.baseN)).toFixed(3) + '）');
  if (hA.orphan > 0) bad.push('④ 有 ' + hA.orphan + ' 手辅助在快照里读不到目标 ⇒ 兑现那一列的分母不全');
  if (ag3.align.focus <= 0) bad.push('③ 五席全打 pid0 却没数到集火 ⇒ 集火计数器死的');
  let nonIdle = 0;
  {   /* ③ 的正对照：构造场面里 pid0 必然被招呼，若还判 idle 就是窗口接错 */
    const agg = blankAgg();
    const { DEC, wrap } = mkDec(agg); const RR = mkRoundRec();
    const w = wrap(function () { return { key: SK.GUN, target: 0 }; }, pid => kinds[pid]);
    duelAssembly({ S: S, Play: Play, T: T, R: R }, params, { games: 8, mode: 'multi', seed0: 9090, n: N, scripted: w, chooserFor: () => w, onTurn: RR.onTurn,
      onGame: function (st, seat) {
        const ev = st.events || [];
        for (const r of RR.RS) { const c = r.acts.filter(a => a.target === 0 && isAtkKey(a.key)).length; if (c >= 2 && addressed(ev, { s: r.s, e: r.e }, 0) !== 'idle') nonIdle++; }
        tallyGame(agg, st, seat, DEC, RR.RS, pid => kinds[pid]);
      } });
  }
  if (!(nonIdle > 0)) bad.push('③ 构造场面（≥2 席同打 pid0）里 `addressed` 一次都没判到非 idle ⇒ **兑现/白给两列是仪器坏了**，正式读的 0 不许当"AI 不帮人"');
  if (ag3.align.baseN > 0) { const bs = ag3.align.baseSum / ag3.align.baseN; if (!(bs > 0 && bs <= 1)) bad.push('③ 集火基线不在 (0,1]：' + bs.toFixed(3)); }
  /* ⑥⑦⑧ 三条是给"重写时丢掉/读反的计数器"补的牙（这次都是靠闭合检查才发现的，下次必须靠断言发现）：
   *   ⑥ 藤甲：造一个会贴藤甲的合成席 ⇒ `armor.fire`（按决策）必须等于 `armor.withTarget`（按快照）且都 >0
   *   ⑦ 转移：造"pid0 攒到 2 珠就转嫁、别人攒到 1 珠就打 pid0"的场面 ⇒ `transfer` 事件必须数得到（归属读的是 `to`，不是 `from`）
   *   ⑧ 惩罚开环：造"pid0 开环、别人只在它 ring≥2 时才打它"的场面 ⇒ `ring.opp > 0` 且 `ring.hitJ > 0` */
  const armorFirst = function (st, pid, legal) {
    const a = legal.find(l => l.key === SK.ARMOR && l.affordable);
    if (a) { const opps = S.opponentsOf(st, pid); return { key: SK.ARMOR, target: opps.length ? opps[0] : null }; }
    return { key: SK.JI, target: null };
  };
  const aA = runWith(armorFirst, 24, 3131);
  if (!(aA.armor.fire > 0)) bad.push('⑥ 合成"藤甲优先"装配一次藤甲都没记到 ⇒ `armor.fire` 计数器是死的（重写时就是丢了这一行）');
  if (aA.armor.fire !== aA.armor.withTarget) bad.push('⑥ 藤甲 决策计数 ' + aA.armor.fire + ' ≠ 快照对上目标数 ' + aA.armor.withTarget + ' ⇒ 兑现那列不可引用（裸 key 与引擎兜底目标没接上）');
  /* ⚠ 夹具只留**一个**攻击者：四席同枪 ⇒ pid0 第 2 回合就死，永远攒不到 2 珠 ⇒ 机会数会是假的 0
     （第一版就这么红过一次，红的是夹具的设计，不是计数器）。 */
  const xferField = function (st, pid, legal) {
    if (pid === 0) {
      const t = legal.find(l => l.key === SK.TRANSFER && l.affordable);
      if (t) return { key: SK.TRANSFER, target: 2 };
    } else if (pid === 1) {
      const g = legal.find(l => l.key === SK.GUN && l.affordable);
      if (g) return { key: SK.GUN, target: 0 };
    }
    return { key: SK.JI, target: null };
  };
  const aX = runWith(xferField, 24, 4141);
  if (!(aX.xfer.opp > 0)) bad.push('⑦ 构造场面里"本回合有人打我"的机会一次都没建立 ⇒ 转移的分母是空的');
  if (!(aX.xfer.landed > 0)) bad.push('⑦ 构造场面（pid0 转嫁、别人打 pid0）没数到 `transfer` 事件 ⇒ 归属字段读错了（`to` 才是转嫁者，`from` 是原攻击者）');
  const ringField = function (st, pid, legal) {
    const me = st.p[pid], other = st.p[0];
    if (pid === 0) {
      const r = legal.find(l => l.key === SK.RING && l.affordable);
      if (r) return { key: SK.RING, target: null };
      return { key: SK.JI, target: null };
    }
    if (other.hp > 0 && (other.ringStreak | 0) >= 2) {
      const g = legal.find(l => l.key === SK.GUN && l.affordable);
      if (g) return { key: SK.GUN, target: 0 };
    }
    return { key: SK.JI, target: null };
  };
  const aR = runWith(ringField, 24, 6161);
  if (!(aR.ring.opp > 0)) bad.push('⑧ 构造场面（有人连开聚能环）没建立起"惩罚开环"的机会 ⇒ 分母是空的，正式读的 0% 就不能引用');
  if (!(aR.ring.hitJ > 0)) bad.push('⑧ 构造场面里那些明明打向开环者的出手没被记到 ⇒ `ring.hitJ` 计数器断了（重写时丢的就是这一行）');
  /* ⑨ 事件窗必须逐局无缝铺满：这条专门钉"换局时 `prevEv` 没归零"那个错（空窗不报错，只会把兑现读成 0） */
  /* ⑩⑪⑫ 三档兑现与延迟（2026-10-18 夜新增那一层）：
   *   ⑩ 闭合：`eff + later + idle + self == gift`（漏一档就是分母不全）
   *   ⑪ **提前保护的正对照**：造一个"奇数回合给 pid2 套盾、偶数回合打 pid2"的场 ⇒ 必须 `later > 0` 且 `eff == 0`
   *      ⇒ 没有这一腿，"later"这一档可能永远是 0（我第一版就是把 later 记进 idle，于是"白给 79%"里混着提前保护）
   *   ⑫ 延迟闭合：`spent + never == hoard` 且每个延迟 ≥0 且不超过局长 */
  if (!(hA.holo.eff + hA.holo.later + hA.holo.idle + hA.holo.self === hA.holo.gift))
    bad.push('⑩ 三档相加 ≠ 送盾数：' + hA.holo.eff + '+' + hA.holo.later + '+' + hA.holo.idle + '+' + hA.holo.self + ' vs ' + hA.holo.gift);
  const altField = function (st, pid, legal) {
    /* 角色分工（第一版没分工 ⇒ 三席同枪，pid3 第 2 回合就死、盾手又还没攒到 1 珠 ⇒ `later` 恒 0 是夹具的 0）：
     *   pid1 = 只在**奇数**回合给 pid3 套盾 ‖ pid2 = 只在**偶数**回合枪 pid3 ‖ 其余全程按ジ（保 pid3 活得够久） */
    if (pid === 1 && (st.round % 2) === 1) {
      const h = legal.find(l => l.key === SK.HOLO && l.affordable);
      if (h) return { key: SK.HOLO, target: 3 };
    } else if (pid === 2 && (st.round % 2) === 0) {
      const g = legal.find(l => l.key === SK.GUN && l.affordable);
      if (g) return { key: SK.GUN, target: 3 };
    }
    return { key: SK.JI, target: null };
  };
  const aL = runWith(altField, 40, 2727);
  if (!(aL.holo.later > 0)) bad.push('⑪ 构造场面（奇数回合套盾、下一回合才开枪）里 `later` 恒 0 ⇒ "提前保护"这一档没接上窗（下一回合的窗取错了）');
  if (aL.holo.eff > 0) bad.push('⑪ 构造场面里套盾那一回合本该没人挨打，却数到 eff ' + aL.holo.eff + ' ⇒ 窗口重叠/回合边界错');
  /* ⑫ 延迟闭合放在**只按ジ**那批上验：那批必然"攒到 ≥3 却从不花" ⇒ `never` 必须等于 `hoard`、`spent` 必须为 0
   *    （放在 aL 上验是错的：那个场里没人真攒到 3 珠，hoard=0 会让闭合断言变成空转） */
  if (!(jiA.delay.hoard > 0)) bad.push('⑫ 只按ジ那批一次都没攒到 ep≥3 ⇒ 延迟的分母是空的（这条断言就变成空转）');
  if (jiA.delay.spent !== 0) bad.push('⑫ 只按ジ那批不该有任何"花掉 ≥3 费"，实测 ' + jiA.delay.spent + ' ⇒ 花的判据接错了牌');
  if (jiA.delay.spent + jiA.delay.never !== jiA.delay.hoard)
    bad.push('⑫ 延迟闭合不过：攒到≥3 ' + jiA.delay.hoard + ' ‖ 花掉 ' + jiA.delay.spent + ' ‖ 没花 ' + jiA.delay.never);
  if (aL.delay.dl.some(x => x < 0 || x > 200)) bad.push('⑫ 有延迟值不在 [0, 局长] 内 ⇒ 回合号接错');
  const gaps = jiA.gapBad + hA.gapBad + ag3.gapBad + aA.gapBad + aX.gapBad + aR.gapBad;
  if (gaps) bad.push('⑨ 有 ' + gaps + ' 处回合窗不连续 / 起点不是 0 / 终点不等于事件总长 ⇒ **兑现与白给整列不可引用**（先修窗口，别去解释读数）');
  if (bad.length) { bad.forEach(b => console.error('✘ ' + b)); console.error('⇒ 自检不过：读数作废'); process.exit(2); }
  console.log('✔ 自检通过（① 只按ジ：机会 ' + (jiA.holo.oppA + jiA.holo.oppB) + ' >0 而辅助出手 = 0 ‖ 每局决策 ' + (jiA.decisions / jiA.games).toFixed(0) +
    ' ‖ ② 送盾 ' + hA.holo.gift + '（兑现 ' + hA.holo.eff + ' ‖ 基线 ' + (hA.holo.baseEffSum / hA.holo.baseN).toFixed(3) + ' ‖ 送自己 0）' +
    ' ‖ ③ 集火 ' + ag3.align.focus + ' ‖ ③′ 兑现窗非 idle ' + nonIdle + ' 回合' +
    ' ‖ ⑥ 藤甲 决策 ' + aA.armor.fire + ' = 快照 ' + aA.armor.withTarget + '（≥2 火源 ' + aA.armor.land[2] + '）' +
    ' ‖ ⑦ 转嫁机会 ' + aX.xfer.opp + ' 出手 ' + aX.xfer.fire + ' 事件 ' + aX.xfer.landed +
    ' ‖ ⑧ 开环机会 ' + aR.ring.opp + ' 打向开环者 ' + aR.ring.hitJ +
    ' ‖ ⑩ 三档闭合 ‖ ⑪ 提前保护 later ' + aL.holo.later + '（eff ' + aL.holo.eff + '）‖ ⑫ 延迟 ' + aL.delay.spent + '+' + aL.delay.never + '=' + aL.delay.hoard +
    ' ‖ ④⑤ 闭合与逐局清空）');
  if (process.argv.includes('--self-test')) process.exit(0);
}
selfTest();

/* ===== 正式：读池真源，装配一律走产品那一份 ===== */
const PT = join(ROOT, 'champion-map/pool-members.tsv');
if (!existsSync(PT)) { console.error('⛔ 池真源表不在：' + PT); process.exit(2); }
const L0 = readFileSync(PT, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
const h0 = Object.fromEntries(L0[0].split('\t').map((x, i) => [x, i]));
for (const c of ['id', 'wid', 'path', 'tier']) if (h0[c] === undefined) { console.error('⛔ 表缺列 ' + c); process.exit(2); }
const allRows = L0.slice(1).filter(l => l.trim()).map(l => l.split('\t'));
const tiers = B.DIFF_TIERS || [];
const picked = TIERS.map(id => tiers.find(t => t && t.id === id));
const unknown = TIERS.filter((id, i) => !picked[i]);
if (unknown.length) { console.error('⛔ --tiers 里有认不出的档：' + unknown.join(',')); process.exit(2); }
const ALLP = humanPrototypes(B);
const PROTOSET = WANT.map(tag => {
  const p = ALLP.find(x => x[2] === tag || x[0] === tag);
  if (!p) { console.error('⛔ 认不出的人类原型：' + tag + '（在册：' + ALLP.map(x => x[2]).join(',') + '）'); process.exit(2); }
  return p;
});

console.log('# 辅助/结盟 选择性与兑现（' + N + ' 人桌 · ' + MODE + ' · 每格 ' + G + ' 局 × seed ' + SEEDS.length + ' 枚 × ' + PROTOSET.length + ' 人类原型）');
console.log('# 人类原型：' + PROTOSET.map(p => p[2]).join(' ‖ ') + ' ⇒ 逐席对称计数，人类席不单独当主语');
console.log('# 三列分开报：**机会**（决策时谓词成立且买得起）‖ **出手** ‖ **兑现**（受益者当回合真被招呼），并各配**无差别点名的基线**');
console.log('# O_ring 的"开环≥2"与在册 G6 的宽威胁定义不同源 ⇒ 只许并排读，不许与 G6 合并成一个数\n');

const rowsOut = [];
for (const t of picked) {
  const RR0 = PD.rosterFor(allRows.map(r => ({ id: r[h0.id], wid: r[h0.wid], tier: r[h0.tier] })), t);
  const byId = {}; for (const r of allRows) byId[r[h0.id]] = r;
  const rows = RR0.members.map(m => byId[m.id]).filter(Boolean);
  if (!rows.length) { console.log('## ' + t.id + '：该带 0 枚 ⇒ 不量（不是 0 分，是没量）\n'); continue; }
  const PARAMS = {}, CHOOSERS = {}, SCRIPTS = {}, badP = [];
  for (const r of rows) {
    let p = null; try { p = loadChamp(W, join(ROOT, r[h0.path]), ROOT); } catch (e) { p = null; }
    if (!p) { badP.push(r[h0.id]); continue; }
    PARAMS[r[h0.id]] = p;
    CHOOSERS[r[h0.id]] = T.policyChooserN(p, 0.15, B.tierEpsAt(t, N, 3), t.epsK, t.epsMode);
  }
  if (badP.length) { console.error('⛔ ' + t.id + ' 有 ' + badP.length + ' 枚读不出：' + badP.join(' ‖ ')); process.exit(7); }
  let MIX = null;
  if (t.scriptMix) {
    MIX = PD.scriptSeats(t, AI, B.STYLES || []);
    if (MIX && MIX.seats > 0) for (const sid of MIX.ids) {
      const st2 = (B.STYLES || []).find(x => x.id === sid);
      if (!st2) { console.error('⛔ scriptMix 里的 ' + sid + ' 不在 STYLES'); process.exit(7); }
      SCRIPTS[sid] = T.wrapBigTPush ? T.wrapBigTPush(st2.pick) : st2.pick;
    }
  }
  const agg = blankAgg();
  let miss = 0, allSame = 0, comps = new Set(), decByKind = { pack: 0, script: 0, human: 0 }, giftByKind = { pack: 0, script: 0 };
  let subjTurn = 0; const subjPosCnt = []; let SUBJ_ROW = null;
  if (SUBJ) {
    /* 在册检查的范围 = **整张池表**而不是本档的带：被测席是"覆盖一席"，它本来就不必来自这一档
     *   （第一版查的是 `rows`（带内名单）⇒ 困难带只有 12 枚，其余 16 枚被误判成"打错 id"） */
    SUBJ_ROW = allRows.find(r => r[h0.id] === SUBJ);
    if (!SUBJ_ROW) { console.error('⛔ --subject=' + SUBJ + ' 不在池表里 ⇒ 打错 id 就该红，不许静默换成别人'); process.exit(2); }
    if (!PARAMS[SUBJ]) {
      let ps = null; try { ps = loadChamp(W, join(ROOT, SUBJ_ROW[h0.path]), ROOT); } catch (e) { ps = null; }
      if (!ps) { console.error('⛔ 被测包读不出：' + SUBJ + '（' + SUBJ_ROW[h0.path] + '）'); process.exit(7); }
      PARAMS[SUBJ] = ps;
      CHOOSERS[SUBJ] = T.policyChooserN(ps, 0.15, B.tierEpsAt(t, N, 3), t.epsK, t.epsMode);
    }
  }
  for (const proto of PROTOSET) for (const seed of SEEDS) {
    let curState = null, cur = null;
    const { DEC, wrap } = mkDec(agg);
    const RREC = mkRoundRec();
    const chooserFor = function (pid, st) {
      if (st !== curState) {
        curState = st;
        const comp = PD.compose(rows.map(r => ({ id: r[h0.id], wid: r[h0.wid], tier: r[h0.tier] })), AI, PD.rng((st.slotSalt >>> 0) || 1), (MIX && MIX.seats) ? MIX : null, RR0.bandW);
        cur = { comp: comp, byPid: {}, kind: {}, order: 0, subjPid: null };
        if (SUBJ) {
          /* 盖席用的是**同一个 compose 之后的位置覆盖**（与产品 `scriptMix` 同一形状）⇒ 其余三席的阵容不随被测者变 */
          const src = SUBJ_ROW;
          const pos = subjTurn++ % AI;
          comp.seats[pos] = { id: SUBJ, wid: src[h0.wid], seat: pos, kind: 'pack' };
          cur.subjPos = pos;
          subjPosCnt[pos] = (subjPosCnt[pos] || 0) + 1;
        }
        comps.add(comp.seats.map(s => s.id).join('+'));
        if (comp.allSame) allSame++;
      }
      if (!(pid in cur.byPid)) {
        const idx = cur.order++;
        const m = cur.comp.seats[idx];
        cur.byPid[pid] = m;
        cur.kind[pid] = (m && m.kind === 'script') ? 'script' : 'pack';
        if (SUBJ && idx === cur.subjPos) cur.subjPid = Number(pid);
      }
      const m = cur.byPid[pid];
      if (!m) { miss++; return null; }
      const inner = m.kind === 'script' ? (SCRIPTS[m.id] || null) : CHOOSERS[m.id];
      if (!inner) { miss++; return null; }
      return wrap(inner, pid2 => cur.kind[pid2] || 'pack');
    };
    const humanWrap = wrap(proto[1], () => 'human');
    duelAssembly({ S: S, Play: Play, T: T, R: R }, PARAMS[rows[0][h0.id]],
      { games: G, mode: MODE, seed0: seed, n: N, scripted: humanWrap, chooserFor, onTurn: RREC.onTurn,
        onGame: function (st, seat) {
          if (SUBJ && cur.subjPid == null) { console.error('⛔ 被测席没落到任何 pid（盖席与席位分配接断了）⇒ 逐枚读数作废'); process.exit(2); }
          for (const d of DEC) decByKind[d.kind] = (decByKind[d.kind] || 0) + 1;
          /* 送盾的席别：脚本席那一份要单独摘出来，否则"冠军会送盾"这句是在给手写脚本记功 */
          if (!SUBJ) for (const r of RREC.RS) for (const a of r.acts) if (a.key === SK.HOLO && a.target != null) { const kk = (cur.kind[a.pid] || 'pack'); giftByKind[kk] = (giftByKind[kk] || 0) + 1; }
          tallyGame(agg, st, seat, DEC, RREC.RS, pid => cur.kind[pid] || 'pack', SUBJ ? cur.subjPid : null);
        } });
  }
  const g = Math.max(1, agg.games);
  const per = x => (x / g).toFixed(3);
  const pct = (a, b) => (b > 0 ? (100 * a / b).toFixed(1) + '%（' + a + '/' + b + '）' : '—（分母 0，不是 0%）');
  const sel = agg.holo.oppA ? 100 * agg.holo.fireA / agg.holo.oppA : 0;
  const selB = agg.holo.oppB ? 100 * agg.holo.fireB / agg.holo.oppB : 0;
  console.log('## ' + t.id + (MIX && MIX.seats ? '（掺脚本席 ' + MIX.seats + '：' + MIX.ids.join(' ‖ ') + ' ⇒ 下面混合了两类席，看"席别"那两行）' : '（**不掺脚本席 ⇒ 下面全是训练包席的**）'));
  console.log('   局 ' + agg.games + ' ‖ 回合 ' + agg.roundsSeen + ' ‖ 决策 ' + agg.decisions + '（包 ' + (decByKind.pack || 0) + ' ‖ 脚本 ' + (decByKind.script || 0) + ' ‖ 人类 ' + (decByKind.human || 0) + '）‖ 独立组成 ' + comps.size + ' ‖ 全同局 ' + allSame + ' ‖ 漏席 ' + miss);
  console.log('   ⚑ 窗口三成因：内部断裂 ' + agg.gapBad + '（>0 就判死）‖ 空局(0 回合) ' + agg.gapNoRound + ' ‖ 末格终点≠事件总长 ' + agg.gapTail + ' ‖ 倒退 ' + agg.rewind + ' ‖ 读不到目标的辅助 ' + agg.orphan +
    (agg.tailSample.length ? '\n     尾事件样本（查它是不是 `startTurn` 的副作用）：' + agg.tailSample.join(' ‖ ') : ''));
  if (miss) { console.error('⛔ 漏席 ⇒ 本档作废'); process.exit(7); }
  if (agg.gapBad) { console.error('⛔ ' + t.id + ' 有 ' + agg.gapBad + ' 处回合窗不连续 ⇒ 兑现/白给整列不可引用（自检腿⑨ 同一条，正式跑也判）'); process.exit(2); }
  if (agg.rewind) { console.error('⛔ ' + t.id + ' 回合号倒退 ' + agg.rewind + ' 次 ⇒ 记录跨局累加，本档作废'); process.exit(2); }
  if (SUBJ) {
    /* 座位均衡自证（逐枚底片档）：被测席必须每局都上场、四个位置都用过且极差 ≤1 ⇒ 否则读数里掺的是座位而不是包 */
    const used = subjPosCnt.filter(x => x > 0).length, mx = Math.max.apply(null, subjPosCnt), mn = Math.min.apply(null, subjPosCnt);
    if (used < AI || mx - mn > 1) { console.error('⛔ 被测席只落在 ' + used + '/' + AI + ' 个位置（各位置 ' + subjPosCnt.join('/') + ' ⇒ 极差 ' + (mx - mn) + '）⇒ 逐枚读数作废'); process.exit(2); }
    const selA = agg.holo.oppA ? 100 * agg.holo.fireA / agg.holo.oppA : 0, selB = agg.holo.oppB ? 100 * agg.holo.fireB / agg.holo.oppB : 0;
    console.log('   ⚑ 列序：id games 机会A 出手A 机会B 出手B 选择性pt 送盾 当回合挡住 提前保护 真白给 点名给A席 基线当回合兑现率% 攒到≥3席次 花掉≥3费 藤甲机会 藤甲出手 转移机会 转移出手 开环机会 开环命中 决策数 位置');
    console.log('   ⚑ SUBJ-ROW\t' + SUBJ + '\t' + agg.games + '\t' + agg.holo.oppA + '\t' + agg.holo.fireA + '\t' + agg.holo.oppB + '\t' + agg.holo.fireB +
      '\t' + (selA - selB).toFixed(2) + '\t' + agg.holo.gift + '\t' + agg.holo.eff + '\t' + agg.holo.later + '\t' + agg.holo.idle + '\t' + agg.holo.rightTarget +
      '\t' + (agg.holo.baseN ? (100 * agg.holo.baseEffSum / agg.holo.baseN).toFixed(1) : '0') + '\t' +
      agg.delay.hoard + '\t' + agg.delay.spent + '\t' +
      agg.armor.opp + '\t' + agg.armor.fire +
      '\t' + agg.xfer.opp + '\t' + agg.xfer.fire + '\t' + agg.ring.opp + '\t' + agg.ring.hitJ + '\t' + agg.decisions + '\t位置 ' + subjPosCnt.join('/'));
  }
  console.log('   **holo（唯一能交给别人的牌）**：机会 A（有濒死+憋大的席）' + agg.holo.oppA + ' ‖ B（没有）' + agg.holo.oppB +
    ' ‖ 出手 A ' + agg.holo.fireA + ' ‖ B ' + agg.holo.fireB + ' ⇒ **选择性 ' + sel.toFixed(2) + '% − ' + selB.toFixed(2) + '% = ' + (sel - selB).toFixed(2) + 'pt**');
  console.log('     送盾 ' + agg.holo.gift + '（' + per(agg.holo.gift) + '/局）**按席别：包 ' + (giftByKind.pack || 0) + ' ‖ 脚本 ' + (giftByKind.script || 0) + '**' +
    ' ‖ **当回合挡住 ' + agg.holo.eff + ' ‖ 提前保护（下一回合才被打）' + agg.holo.later + ' ‖ 两回合都没人打（真白给）' + agg.holo.idle + '**' +
    '（' + pct(agg.holo.idle, agg.holo.gift) + ' ‖ 无差别送盾的基线当回合兑现率 ' +
    (agg.holo.baseN ? (100 * agg.holo.baseEffSum / agg.holo.baseN).toFixed(1) + '%' : '—') + '）‖ 送给自己 ' + agg.holo.self +
    ' ‖ 点名给那个 A 席 ' + agg.holo.rightTarget + '（' + pct(agg.holo.rightTarget, agg.holo.gift) + '）');
  console.log('   **攒→花延迟（长程代理，用结算后快照 ⇒ 下界）**：攒到 ep≥3 的席次 ' + agg.delay.hoard + ' ‖ 之后打出 ≥3 费的牌 ' + agg.delay.spent +
    ' = ' + pct(agg.delay.spent, agg.delay.hoard) + ' ‖ 到死/局终没花 ' + agg.delay.never +
    (agg.delay.dl.length ? ' ‖ 延迟回合 P50 ' + agg.delay.dl.slice().sort((x, y) => x - y)[Math.floor(agg.delay.dl.length / 2)] +
    ' ‖ P90 ' + agg.delay.dl.slice().sort((x, y) => x - y)[Math.floor(agg.delay.dl.length * 0.9)] + ' ‖ 最大 ' + Math.max.apply(null, agg.delay.dl) : ''));
  console.log('   **藤甲（用户例：只有自己触发=纯亏，两个火源=+2）**：机会 ' + agg.armor.opp + ' ‖ 出手（按决策）' + agg.armor.fire +
    ' ‖ 快照里对上目标的 ' + agg.armor.withTarget + (agg.armor.withTarget !== agg.armor.fire ? ' **⇒ 不相等，兑现那列不可引用**' : '') +
    ' ‖ 兑现分档 0 火源 ' + agg.armor.land[0] + ' ‖ 1 火源 ' + agg.armor.land[1] + ' ‖ **≥2 火源 ' + agg.armor.land[2] + '**（火源数是**下界**，见文件头）');
  console.log('   **转移伤害（借刀/定向穿防）**：机会（买得起 ∧ 本回合真有人打我）' + agg.xfer.opp + ' ‖ 出手 ' + agg.xfer.fire + ' ‖ transfer 事件 ' + agg.xfer.landed + ' ‖ 落到别人 ' + agg.xfer.destOther);
  console.log('   **惩罚开环（ringStreak≥2 ∧ 买得起作废手段）**：机会 ' + agg.ring.opp + ' ‖ 那一手打向开环者 ' + agg.ring.hitJ + ' = **' + pct(agg.ring.hitJ, agg.ring.opp) +
    '** ‖ 无差别点名基线 ' + (agg.ring.baseN ? (100 * agg.ring.baseSum / agg.ring.baseN).toFixed(1) + '%' : '—') + '（在册 G6 用宽威胁定义，别混）');
  console.log('   **偶然结盟（规则层对齐事件）**：合二为一 ' + agg.align.merge + ' ‖ 聚光炮 ' + agg.align.spotlight + ' ‖ 反复横跳 ' + agg.align.hop + ' ‖ 铁索连环伤害 ' + agg.align.chain +
    '（次/局 ' + per(agg.align.merge) + ' ‖ ' + per(agg.align.spotlight) + ' ‖ ' + per(agg.align.hop) + ' ‖ ' + per(agg.align.chain) + '）');
  console.log('   **集火（≥2 席同回合打同一目标；N4 两击都落地）**：' + agg.align.focus + ' 次（' + per(agg.align.focus) + '/局）‖ 被集火者=当时血最多 ' + pct(agg.align.focusHp, agg.align.focus) +
    ' ‖ =当时珠最多 ' + pct(agg.align.focusEp, agg.align.focus) + ' ‖ 无差别点名基线 ' + (agg.align.baseN ? (100 * agg.align.baseSum / agg.align.baseN).toFixed(1) + '%' : '—') + '\n');
  if (agg.orphan) console.log('   ⚠ 有 ' + agg.orphan + ' 手辅助在回合快照里读不到目标 ⇒ 该档的兑现列只能当**下界**\n');
  rowsOut.push({ tier: t.id, games: agg.games, rounds: agg.roundsSeen, holoOppA: agg.holo.oppA, holoOppB: agg.holo.oppB, holoFireA: agg.holo.fireA, holoFireB: agg.holo.fireB,
    holoGift: agg.holo.gift, holoGiftPack: giftByKind.pack || 0, holoGiftScript: giftByKind.script || 0, holoEff: agg.holo.eff, holoLater: agg.holo.later, holoIdle: agg.holo.idle, hoard: agg.delay.hoard, hoardSpent: agg.delay.spent, hoardNever: agg.delay.never, holoBase: +(agg.holo.baseN ? agg.holo.baseEffSum / agg.holo.baseN : -1).toFixed(4), holoRight: agg.holo.rightTarget,
    armorOpp: agg.armor.opp, armorFire: agg.armor.fire, armorTargeted: agg.armor.withTarget, armor2: agg.armor.land[2],
    xferOpp: agg.xfer.opp, xferFire: agg.xfer.fire, xferLanded: agg.xfer.landed, ringOpp: agg.ring.opp, ringHit: agg.ring.hitJ, ringBase: +(agg.ring.baseN ? agg.ring.baseSum / agg.ring.baseN : -1).toFixed(4),
    merge: agg.align.merge, spotlight: agg.align.spotlight, hop: agg.align.hop, chain: agg.align.chain,
    focus: agg.align.focus, focusHp: agg.align.focusHp, focusEp: agg.align.focusEp, focusBase: +(agg.align.baseN ? agg.align.baseSum / agg.align.baseN : -1).toFixed(4), orphan: agg.orphan, rewind: agg.rewind });
}
console.log('# 机器可读：');
console.log(JSON.stringify({ mode: MODE, n: N, games: G, seeds: SEEDS, protos: PROTOSET.map(p => p[2]), rows: rowsOut }));
if (flag('out', '')) {
  const cols = Object.keys(rowsOut[0] || {});
  if (cols.length) writeFileSync(join(ROOT, flag('out')), cols.join('\t') + '\n' + rowsOut.map(r => cols.map(c => r[c]).join('\t')).join('\n') + '\n');
  console.log('# 已写 ' + flag('out'));
}
