/* E29 · 「无效出手」率 —— 仓里**没有这一把尺**（09-26 夜班 · Qoder · **只读，仓库一字不动**）
 *
 * 用户报的病是行为级的："碰到攒钱的就疯狂防御并且维持很久" + "又出现了经典的空净化和空蓄能"。
 * 门禁量的是**强度**（伤害/广度/座位…），`chargeProfile` 量的是**珠的浪费**，`stanceProfile` 量的是**摆架势的占比**
 *   ⇒ **没有人量"这一手到底有没有产生效果"**。而"防御免费"（E23）只解释"为什么出得起"，不解释"为什么出了没用还一直出"。
 * 本探针给每一族出手配一个"效果证据"，量出**空手率**：
 *   · 空挡    = 这一回合摆了防御/反弹/八卦阵/金刚盾/藤甲，但整个结算窗里**没有任何一次 `blocked`/`reflect` 落到我头上**
 *   · 空净化  = `purify` 事件带的 `curses` 计数 = 0（⚠️ 该字段只数符咒：还会清地雷/挑衅/大雷禁用等，那些不算进去 ⇒ 这是**上界**）
 *   · 打空    = 攻击类出手，窗内既没有 `damage.source === 我`、也没有 `blocked.via === 这张卡`
 *   · 废手    = `action.outcome !== 'ok'`（引擎直接判这一手无效：禁用中/资源不足/未知技能…）
 * 口径：产品口径（temp 0.15 · ε=0.2 · k5 · soft）+ **攒钱者装配**（seat0 永远出 ジ ⇒ 与 §E23/§E24 同一张桌子，数字可对着读）
 *
 * 用法：node tools/probe-wasted-play.mjs [--packs=a,b] [--games=60] [--every=0] [--limit=40] [--quiet]
 */
import { readdirSync } from 'node:fs';
import { build } from './probe-layer-caliber.mjs';
import { rejectUnknownFlags, selfPlay, seatSymmetry, densityProfile } from './audit-lib.mjs';
import { classifyDefenseWindow, defenseQuality, formatQuality } from './defense-quality.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
rejectUnknownFlags(process.argv.slice(2), ['packs', 'games', 'every', 'limit', 'quiet', 'temp', 'eps', 'epsk', 'epsmode', 'seed', 'assembly', 'bots', 'correlate', 'gate-n'], 'probe-wasted-play');
const GAMES = Number(arg('games', 60));
const TEMP = Number(arg('temp', 0.15)), EPS = Number(arg('eps', 0.2)), EPSK = Number(arg('epsk', 5)), EPSMODE = arg('epsmode', 'soft');
const SEED0 = Number(arg('seed', 5200));
const EVERY = Number(arg('every', 0)), LIMIT = Number(arg('limit', 40));
const QUIET = arg('quiet', '') === '1';
const ASM = arg('assembly', 'banker');
const BOTS = arg('bots', 'pickGunSpam,pickSnipeSpam,pickHeavyFire').split(',');
/* E30：`--correlate=1` 顺手把**现有读数**（ε=0 未搬档）与"空挡率/倍差/打空率"对表 ⇒ 判"门禁那一层对防御条件性到底有没有预测力"
 *   （METHODOLOGY 63 的规矩：想立一条新栏，先测旧栏的方向，别直接开新栏。） */
const CORR = arg('correlate', '') === '1';
let PACKS = arg('packs', 'js/bundled-champion-3p.js,docs/artifacts/cbs1s2-band2.bak,docs/artifacts/v7seat24-31.bak,docs/artifacts/v7cmin4-82.bak,docs/artifacts/v7divK-31.bak').split(',');
if (EVERY > 0) {
  PACKS = readdirSync('docs/artifacts').filter(f => /\.bak$/.test(f)).sort()
    .filter((_, i) => i % EVERY === 0).slice(0, LIMIT).map(f => 'docs/artifacts/' + f);
}
const mul = function (a) { a >>>= 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/** 分位数（按升序取第 floor(p·n) 个；小样本上不叫分位数，只叫"位置统计"） */
const q = function (a, p) { const s = a.slice().filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };

console.log('# 无效出手率（产品口径 ε=' + EPS + ' k=' + EPSK + ' ' + EPSMODE + ' · temp ' + TEMP + ' · ' + GAMES + ' 局/格 · 装配 = ' +
  (ASM === 'hotseat' ? 'hotseat（seat0 攒钱 + 3 席脚本攻击手 ' + BOTS.join('/') + ' + **seat4 被评包**）' : 'banker（seat0 永远出 ジ + 其余 4 席都是被评包 ⇒ 与 §E23/§E24 同桌子，但四席同包 ⇒ 决策相关）'));
console.log('# 效果证据一律来自 `state.events`；**窗**= 本回合全部决策之后 → 下一回合第一条决策之前（决策时记 `events.length`）');
console.log('# ⚠️ 空净化的 `curses` 字段只数符咒 ⇒ 那一列是**上界**（清了地雷也算有效，但读成"空"）。蓄能的浪费另有真源：`audit-lib.chargeProfile`（本表不重复量）\n');

function run(pack) {
  const ctx = build({ on: true, pack: pack, temp: TEMP, eps: EPS, epsK: EPSK, epsMode: EPSMODE });
  if (ctx.patched !== ctx.hardwired) return { err: '口径搬运自检失败 ' + ctx.patched + '/' + ctx.hardwired };
  const sb = ctx.sb, R = sb.EpirusRules, S = sb.EpirusState, T = sb.EpirusTrainer, Play = sb.EpirusPlay, P = sb.EpirusPolicy;
  const params = P.unpack(sb.EPIRUS_CHAMPION_3P, true) || P.unpack(sb.EPIRUS_CHAMPION, true);
  if (!params) return null;
  const DEF = R.CAT.DEFENSE, ATK = R.CAT.ATTACK;
  const catOf = function (k) { const d = R.byKey[k]; return d ? d.cat : null; };
  /* ⚠️ 只有 `target:'self'` 的防御族能用"本回合有没有一次 blocked/reflect 落在我头上"当效果证据。
   *   藤甲/转移/符咒/地雷/挑衅这些是**贴到对手身上**的铺垫手，收益在**以后的回合**兑现 ⇒ 同窗判它"空手"是量具错了，
   *   所以这些卡一律不参与空手率，只印出手数（METHODOLOGY 61 的同族：别拿定义域外的判据去数效果）。 */
  const selfGuard = function (k) { const d = R.byKey[k]; return !!(d && d.cat === DEF && d.target === 'self'); };
  const delayed = function (k) { const d = R.byKey[k]; return !!(d && (d.cat !== ATK) && d.target !== 'self'); };
  const base = T.policyChooserN(params, TEMP, EPS, EPSK, EPSMODE);
  const agg = {};   // key -> {n, eff, voided}
  let defN = 0, defEff = 0, atkN = 0, atkEff = 0, purN = 0, purEmpty = 0, wastedHands = 0, allHands = 0;
  const dq = { eff: 0, part: 0, idle: 0 };   // 用户 09-26 裁定的三档（单一来源见 defense-quality.mjs）
  let brDefN = 0, brDefHit = 0, brNonN = 0, brNonHit = 0;
  const perSeat = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: mul(SEED0 + g * 7919) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    /* 决策日志：{rd, pid, key, ev0} ⇒ 回合 R 的结算窗 = [max(ev0 of R), min(ev0 of R+1)) */
    const DEC = [];
    const ch = [function () { return { key: R.SK.JI }; }];
    /* 两种装配：
     *   `banker`（默认，与 §E23/§E24 同一张桌子）= seat0 永远出 ジ + **其余 4 席都是被评包**
     *     ⇒ 优点：与"碰到一个攒钱的"那个场景一致；缺点：**四席同包 ⇒ 它们的决策高度相关**，
     *       "我防的回合没人来打我"可能只是"大家都同时在防"，不是我这席防得没道理 ⇒ 倍差只当线索。
     *   `hotseat` = seat0 攒钱 + seat1..3 是**脚本攻击手**（`EpirusBots` 里的现成 pick，单一来源）+ seat4 是被评包
     *     ⇒ 攻击与我的策略无关（脚本看不见我的权重）⇒ 这才是"来手能不能挡住"的干净读数。
     */
    if (ASM === 'hotseat') {
      const bots = BOTS.map(function (nm) {
        const f = sb.EpirusBots && sb.EpirusBots[nm];
        if (typeof f !== 'function') return null;
        return T.wrapBotN(f);
      });
      if (bots.filter(Boolean).length !== BOTS.length) return { err: '读不出脚本对手：' + BOTS.join(',') + '（EpirusBots 里没有这个 pick 函数）' };
      for (let i = 0; i < 3; i++) ch.push(bots[i]);
      ch.push(function (s2, p2, lg, econ) {
        const pick = base(s2, p2, lg, econ);
        if (pick && pick.key) { DEC.push({ rd: s2.round, pid: p2, key: pick.key, ev0: s2.events ? s2.events.length : 0 }); perSeat[p2] = (perSeat[p2] || 0) + 1; }
        return pick;
      });
    } else {
      for (let i = 1; i < 5; i++) ch.push(function (s2, p2, lg, econ) {
        const pick = base(s2, p2, lg, econ);
        if (pick && pick.key) { DEC.push({ rd: s2.round, pid: p2, key: pick.key, ev0: s2.events ? s2.events.length : 0 }); perSeat[p2] = (perSeat[p2] || 0) + 1; }
        return pick;
      });
    }
    Play.autoGameN(st, ch);
    const ev = st.events || [];
    /* 每条决策的窗尾 = 同席下一条决策的 ev0（跨席不行：结算在全部决策之后）⇒ 用"回合边界"最稳 */
    const byRound = new Map();
    for (const d of DEC) { if (!byRound.has(d.rd)) byRound.set(d.rd, []); byRound.get(d.rd).push(d); }
    const rds = [...byRound.keys()].sort((a, b) => a - b);
    const winEnd = {};
    for (let i = 0; i < rds.length; i++) {
      const nxt = i + 1 < rds.length ? Math.min.apply(null, byRound.get(rds[i + 1]).map(d => d.ev0)) : ev.length;
      winEnd[rds[i]] = nxt;
    }
    const startOf = r => Math.max.apply(null, byRound.get(r).map(d => d.ev0));
    const keyPlayed = {};   // "rd|key" -> pid  (给 `blocked.via` 找攻击者)
    for (const d of DEC) (keyPlayed[d.rd + '|' + d.key] = keyPlayed[d.rd + '|' + d.key] || []).push(d.pid);
    for (const d of DEC) {
      const cat = catOf(d.key);
      if (!cat) continue;
      allHands++;
      const w = ev.slice(startOf(d.rd), winEnd[d.rd]);
      const a = agg[d.key] || (agg[d.key] = { n: 0, eff: 0, cat: cat, name: (R.byKey[d.key] || {}).name || d.key, skip: delayed(d.key) });
      a.n++;
      let eff = false;
      if (selfGuard(d.key)) {
        defN++;
        /* 用户 09-26 裁定的三档（有效 / 被穿透=半 / 白防）走**单一来源** `defense-quality.mjs` ⇒ 探针、promote 记录栏、门三处同一把尺 */
        const kind = classifyDefenseWindow(w, R, d.pid);
        dq[kind === 'eff' ? 'eff' : kind === 'part' ? 'part' : 'idle']++;
        eff = kind !== 'idle';
        if (kind === 'eff') defEff++;
      } else if (cat === ATK) {
        atkN++;
        eff = w.some(e => (e.type === 'damage' && e.source === d.pid) ||
          ((e.type === 'blocked' || e.type === 'reflect') && e.via === d.key && (keyPlayed[d.rd + '|' + d.key] || []).indexOf(d.pid) >= 0 && e.to !== d.pid));
        if (eff) atkEff++;
      } else if (d.key === R.SK.PURIFY) {
        purN++;
        const pe = w.filter(e => e.type === 'purify' && e.pid === d.pid);
        const empty = pe.length === 0 || pe.every(e => !(e.curses > 0));
        if (empty) purEmpty++;
        eff = !empty;
      } else if (a.skip) { eff = null; }   // 铺垫/延迟手：同窗无证据 ⇒ 不判
      else { eff = w.some(e => e.source === d.pid || e.pid === d.pid || e.to === d.pid); }
      if (eff === true) a.eff++;
    }
    /* 基线率（**本探针自己的 placebo**，METHODOLOGY 63/64 同族）：
     *   "防的那一回合真的被招呼到的概率" vs "没防的回合被招呼到的概率"。
     *   若两者差不多 ⇒ "空挡率高"只是这局本来没人打我，**不是**它防得没道理；只有前者明显高，防御才是**有条件的**（而条件对了却仍空手，才是"贵免费的龟"）。 */
    const defended = new Set(), hitAny = new Set(), seats = new Set();
    for (const d of DEC) {
      seats.add(d.rd + '|' + d.pid);
      if (selfGuard(d.key)) defended.add(d.rd + '|' + d.pid);
    }
    const byRound2 = new Map();
    for (const d of DEC) { if (!byRound2.has(d.rd)) byRound2.set(d.rd, []); byRound2.get(d.rd).push(d); }
    for (const [rd, list] of byRound2.entries()) {
      const s0 = Math.max.apply(null, list.map(d => d.ev0)), s1 = winEnd[rd];
      for (let i = s0; i < s1; i++) {
        const e = ev[i];
        if ((e.type === 'damage' || e.type === 'blocked' || e.type === 'reflect') && e.to != null) hitAny.add(rd + '|' + e.to);
      }
    }
    let dn = 0, dh = 0, nn = 0, nh = 0;
    for (const key of seats) {
      const hit = hitAny.has(key);
      if (defended.has(key)) { dn++; if (hit) dh++; } else { nn++; if (hit) nh++; }
    }
    brDefN += dn; brDefHit += dh; brNonN += nn; brNonHit += nh;
    /* 废手：引擎判无效的出手（outcome !== 'ok'）⇒ **只数被评席**（hotseat 档里脚本对手的失败手不是我们要判的病） */
    const evalPid = new Set(); for (const d of DEC) evalPid.add(d.pid);
    for (const e of ev) if (e.type === 'action' && e.outcome && e.outcome !== 'ok' && evalPid.has(e.pid)) { wastedHands++; }
  }
  const keys = Object.keys(agg).map(k => ({ k: k, name: agg[k].name, cat: agg[k].cat, n: agg[k].n, eff: agg[k].eff, skip: agg[k].skip }))
    .sort((a, b) => (b.n - a.n));
  /* E30：同一粒包在**未搬档（ε=0 = 门禁口径）**下的现有读数，用来与"空挡率/倍差"对相关性 */
  const gate = {};
  if (CORR) {
    const gn = Number(arg('gate-n', 60));
    const nat = build({ on: false, pack: pack });
    const PN = nat.sb.EpirusPolicy;
    const pn = PN.unpack(nat.sb.EPIRUS_CHAMPION_3P, true) || PN.unpack(nat.sb.EPIRUS_CHAMPION, true);
    const m0 = selfPlay(nat.sb, pn, 'multi', gn);
    const dens = densityProfile(nat.sb, pn, 'long', Math.max(10, gn >> 1));
    const ss = seatSymmetry(nat.sb, pn, 'multi', gn);
    gate.gateG = m0.effSkills; gate.gateLand = m0.effSkillsLand; gate.gateKeys = m0.landedKeys;
    gate.gateRounds = m0.rounds; gate.gateDraw = 100 * m0.drawRate; gate.gateJi = dens.jiShare;
    gate.gateSpread = ss.spread;
  }
  return {
    defN, defEff, defEmpty: defN ? 100 * (1 - defEff / defN) : NaN,
    atkN, atkEff, atkMiss: atkN ? 100 * (1 - atkEff / atkN) : NaN,
    purN, purEmpty, purEmptyRate: purN ? 100 * purEmpty / purN : NaN,
    allHands, wastedHands, voidRate: allHands ? 100 * wastedHands / (allHands + wastedHands) : NaN,
    brDefN, brDefHit, brNonN, brNonHit,
    dq: dq, quality: defenseQuality(dq),
    hitIfDef: brDefN ? 100 * brDefHit / brDefN : NaN, hitIfNot: brNonN ? 100 * brNonHit / brNonN : NaN,
    gate: gate, keys: keys
  };
}

const rows = [];
for (const f of PACKS) {
  const nm = f.replace(/^.*[\/]/, '').replace(/\.(bak|js)$/, '');
  let r = null;
  try { r = run(f); } catch (e) { r = { err: e.message }; }
  if (!r) { console.log('## ' + nm + ' — 读不出权重，跳过'); continue; }
  if (r.err) { console.log('## ' + nm + ' — ⛔ ' + r.err); continue; }
  rows.push({ nm, r });
  console.log('## ' + nm);
  console.log('   防御族(self-target) ' + r.defN + ' 手 · **空挡率 ' + (isFinite(r.defEmpty) ? r.defEmpty.toFixed(1) : '—') + '%**' +
    '   ‖   攻击族 ' + r.atkN + ' 手 · **打空率 ' + (isFinite(r.atkMiss) ? r.atkMiss.toFixed(1) : '—') + '%' +
    '   ‖   净化 ' + r.purN + ' 手 · **空净化 ' + (isFinite(r.purEmptyRate) ? r.purEmptyRate.toFixed(1) : '—') + '%（上界）**' +
    '   ‖   废手 ' + r.wastedHands + '/' + (r.allHands + r.wastedHands) + ' = ' + (isFinite(r.voidRate) ? r.voidRate.toFixed(2) : '—') + '%');
  console.log('   ' + formatQuality(r.quality));
  console.log('   placebo/基线率：防的那一回合被招呼到 ' + (isFinite(r.hitIfDef) ? r.hitIfDef.toFixed(1) : '—') + '%（n=' + r.brDefN +
    '） vs 没防的回合 ' + (isFinite(r.hitIfNot) ? r.hitIfNot.toFixed(1) : '—') + '%（n=' + r.brNonN + '） ⇒ 倍差 ' +
    (isFinite(r.hitIfDef) && isFinite(r.hitIfNot) && r.hitIfNot > 0 ? (r.hitIfDef / r.hitIfNot).toFixed(2) + '×' : '—') +
    '（≈1 ⇒ "空挡高"只是没人打我，不许读成"防得没道理"）');
  if (!QUIET) {
    console.log('   逐卡（出手 ≥' + Math.max(3, Math.round(r.allHands * 0.005)) + ' 才印；**铺垫/延迟手不判空手**）：');
    for (const k of r.keys) {
      if (k.n < Math.max(3, Math.round(r.allHands * 0.005))) continue;
      console.log('     ' + k.name.padEnd(8) + ('[' + k.cat + ']').padEnd(10) + String(k.n).padStart(6) + ' 手 · ' +
        (k.skip ? '**不判（贴到对手 / 延迟兑现，同窗里没有它的效果证据）**'
          : '有效率 ' + (100 * k.eff / k.n).toFixed(1).padStart(5) + '% · **空手 ' + (100 * (1 - k.eff / k.n)).toFixed(1) + '%**'));
    }
  }
  console.log('');
}
if (!rows.length) { console.log('⛔ 一粒都没量到 ⇒ 非零退出'); process.exit(6); }
if (rows.length > 3) {
  const de = rows.map(x => x.r.defEmpty).filter(isFinite);
  const am = rows.map(x => x.r.atkMiss).filter(isFinite);
  console.log('## 汇总（n=' + rows.length + ' 粒）');
  console.log('   空挡率分布：p10 ' + q(de, .1).toFixed(1) + '% · 中位 ' + q(de, .5).toFixed(1) + '% · p90 ' + q(de, .9).toFixed(1) + '%');
  console.log('   打空率分布：p10 ' + q(am, .1).toFixed(1) + '% · 中位 ' + q(am, .5).toFixed(1) + '% · p90 ' + q(am, .9).toFixed(1) + '%');
  const qq = rows.map(x => x.r.quality && x.r.quality.n ? 100 * x.r.quality.q : NaN).filter(isFinite);
  const idle = rows.map(x => x.r.quality && x.r.quality.n ? x.r.quality.idle : NaN).filter(isFinite);
  console.log('   防御质量分（用户裁定：(有效+0.5×被穿透)/防御手数）：p10 ' + q(qq, .1).toFixed(1) + ' · 中位 ' + q(qq, .5).toFixed(1) +
    ' · p90 ' + q(qq, .9).toFixed(1) + '   ‖ 白防率：中位 ' + q(idle, .5).toFixed(1) + '% · p90 ' + q(idle, .9).toFixed(1) + '%');
  const worst = rows.slice().sort((a, b) => (b.r.defEmpty || 0) - (a.r.defEmpty || 0)).slice(0, 6);
  console.log('   空挡率最高的几粒：' + worst.map(x => x.nm + ' ' + (isFinite(x.r.defEmpty) ? x.r.defEmpty.toFixed(1) : '—') + '%(n=' + x.r.defN + ')').join(' · '));
}

/* ===== E30：现有读数（ε=0 门禁口径）对"防御条件性/空挡率"有没有预测力？ =====
 * 判方向不判阈值（METHODOLOGY 63）：若某一栏已能预测倍差，就不必新立栏；若全都不能（预期如此），
 *   那"防御条件性"就是一个**新的、门禁读不到的维度** —— 但那是裁定的材料，不是我替他做的决定。 */
if (CORR && rows.length >= 20) {
  const ranks = a => {
    const idx = a.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(a.length);
    let i = 0;
    while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; }
    return r;
  };
  const rho = (x, y) => {
    const a = ranks(x), b = ranks(y), n = x.length;
    let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    let sab = 0, sa = 0, sb = 0;
    for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
    return sa && sb ? sab / Math.sqrt(sa * sb) : NaN;
  };
  const live = rows.filter(x => x.r.gate && Number.isFinite(x.r.hitIfDef) && Number.isFinite(x.r.hitIfNot) && x.r.hitIfNot > 0);
  if (live.length >= 20) {
    const ratio = live.map(x => x.r.hitIfDef / x.r.hitIfNot);
    const empty = live.map(x => x.r.defEmpty);
    const defN = live.map(x => x.r.defN);
    const cols = { '空挡率': empty, '防御手数': defN };
    for (const k of ['gateG', 'gateLand', 'gateKeys', 'gateRounds', 'gateDraw', 'gateJi', 'gateSpread']) {
      cols[k] = live.map(x => x.r.gate[k]);
    }
    console.log('\n## E30 相关性（Spearman ρ，n=' + live.length + ' 粒；"倍差"= 防的回合被招呼 vs 没防）');
    console.log('   对「倍差」的预测力：' + Object.keys(cols).filter(k => k !== '空挡率' && k !== '防御手数')
      .map(k => k + ' ρ=' + rho(cols[k], ratio).toFixed(2)).join(' · '));
    console.log('   对「空挡率」的预测力：' + Object.keys(cols).filter(k => k !== '空挡率')
      .map(k => (cols[k] === ratio ? '倍差' : k) + ' ρ=' + rho(cols[k], empty).toFixed(2)).join(' · '));
    console.log('   倍差自身分布：p10 ' + q(ratio, .1).toFixed(2) + ' · 中位 ' + q(ratio, .5).toFixed(2) + ' · p90 ' + q(ratio, .9).toFixed(2) +
      ' ⇒ >1.3 的 ' + ratio.filter(x => x > 1.3).length + ' 粒 · <0.8 的 ' + ratio.filter(x => x < 0.8).length + ' 粒');
  } else {
    console.log('\n## E30 相关性：可用配对只有 ' + live.length + ' 粒（<20）⇒ 不做相关性判定');
  }
}
