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
import { rejectUnknownFlags } from './audit-lib.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
rejectUnknownFlags(process.argv.slice(2), ['packs', 'games', 'every', 'limit', 'quiet', 'temp', 'eps', 'epsk', 'epsmode', 'seed', 'assembly', 'bots'], 'probe-wasted-play');
const GAMES = Number(arg('games', 60));
const TEMP = Number(arg('temp', 0.15)), EPS = Number(arg('eps', 0.2)), EPSK = Number(arg('epsk', 5)), EPSMODE = arg('epsmode', 'soft');
const SEED0 = Number(arg('seed', 5200));
const EVERY = Number(arg('every', 0)), LIMIT = Number(arg('limit', 40));
const QUIET = arg('quiet', '') === '1';
const ASM = arg('assembly', 'banker');
const BOTS = arg('bots', 'pickGunSpam,pickSnipeSpam,pickHeavyFire').split(',');
let PACKS = arg('packs', 'js/bundled-champion-3p.js,docs/artifacts/cbs1s2-band2.bak,docs/artifacts/v7seat24-31.bak,docs/artifacts/v7cmin4-82.bak,docs/artifacts/v7divK-31.bak').split(',');
if (EVERY > 0) {
  PACKS = readdirSync('docs/artifacts').filter(f => /\.bak$/.test(f)).sort()
    .filter((_, i) => i % EVERY === 0).slice(0, LIMIT).map(f => 'docs/artifacts/' + f);
}
const mul = function (a) { a >>>= 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

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
        eff = w.some(e => (e.type === 'blocked' || e.type === 'reflect') && e.to === d.pid);
        if (eff) defEff++;
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
  return {
    defN, defEff, defEmpty: defN ? 100 * (1 - defEff / defN) : NaN,
    atkN, atkEff, atkMiss: atkN ? 100 * (1 - atkEff / atkN) : NaN,
    purN, purEmpty, purEmptyRate: purN ? 100 * purEmpty / purN : NaN,
    allHands, wastedHands, voidRate: allHands ? 100 * wastedHands / (allHands + wastedHands) : NaN,
    brDefN, brDefHit, brNonN, brNonHit,
    hitIfDef: brDefN ? 100 * brDefHit / brDefN : NaN, hitIfNot: brNonN ? 100 * brNonHit / brNonN : NaN,
    keys: keys
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
  const de = rows.map(x => x.r.defEmpty).filter(isFinite).sort((a, b) => a - b);
  const am = rows.map(x => x.r.atkMiss).filter(isFinite).sort((a, b) => a - b);
  const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : NaN;
  console.log('## 汇总（n=' + rows.length + ' 粒）');
  console.log('   空挡率分布：p10 ' + q(de, .1).toFixed(1) + '% · 中位 ' + q(de, .5).toFixed(1) + '% · p90 ' + q(de, .9).toFixed(1) + '%');
  console.log('   打空率分布：p10 ' + q(am, .1).toFixed(1) + '% · 中位 ' + q(am, .5).toFixed(1) + '% · p90 ' + q(am, .9).toFixed(1) + '%');
  const worst = rows.slice().sort((a, b) => (b.r.defEmpty || 0) - (a.r.defEmpty || 0)).slice(0, 6);
  console.log('   空挡率最高的几粒：' + worst.map(x => x.nm + ' ' + (isFinite(x.r.defEmpty) ? x.r.defEmpty.toFixed(1) : '—') + '%(n=' + x.r.defN + ')').join(' · '));
}
