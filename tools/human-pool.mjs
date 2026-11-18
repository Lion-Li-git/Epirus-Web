/* 人类形状对手池（§E152e 的产物 → §E155/§E157/§E168 的共用单一来源）
 *
 * 为什么要单独成一个 `tools/` 模块（09-30 夜班 §E168）：这台"按经验分布抽样"的对手此前**只住在 `docs/artifacts/e155-humanpool.mjs` 里**。
 *   今晚要把"风格代价"（蓄能 / 电磁炮 / 防御占比 / 集中度）从脚本桌复量到人类形状桌，就必须让**度量**（`tools/behavior-profile.mjs` 的 `tallyPick`）
 *   与**对手**（这里）都只有一份实现；把采样器抄进新仪器 = 本仓"两份同构实现必漂移"的第六次诱惑，而且漂移正好落在我自己最关心的那几列上。
 *
 * 口径（照抄 §E155 那台仪器的原始算法，不改一个字节语义）：
 *   条件键 = `钱档(0..5)/是否富有(≥5ep)/上一手的显示名`；抽不到可负担的卡 ⇒ 最多重试 8 次后退回 `ジ`；
 *   指向 = `next`（打下一位，机械）‖ `rand`（活席里随机指）——两张形状桌的差别只在指向规则。
 * ⚠ 它是**粗模型**：来自 56 局 / ~997 个决策的人类日志，不会针对你调整 ⇒ 只当"人类这种打法"的代理，别当真人。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const HB_FILE_DEFAULT = 'docs/artifacts/human-behavior.json';

/* ---- 经验分布 → 按条件索引的采样表（键里剥掉席位：要的是"人类这种打法"，不是"1 号位那个人"） ---- */
export function loadPool(W, src, file) {
  const R = W.EpirusRules;
  const HB = JSON.parse(readFileSync(join(ROOT, file || HB_FILE_DEFAULT), 'utf8'));
  if (!HB[src]) throw new Error('human-behavior.json 里没有这一份分布：' + src + '（键有：' + Object.keys(HB).join(',') + '）');
  const BY_NAME = {}, KEY2NAME = {};
  for (const c of (R.skills || [])) { if (c && c.name) BY_NAME[c.name] = c; if (c && c.key) KEY2NAME[c.key] = c.name; }
  const POOL = {}; let tot = 0;
  for (const k in HB[src]) {
    const cond = k.replace(/^S\d+@/, '');
    POOL[cond] = POOL[cond] || {};
    for (const card in HB[src][k]) { POOL[cond][card] = (POOL[cond][card] || 0) + HB[src][k][card]; tot += HB[src][k][card]; }
  }
  const MARG = {};
  for (const c in POOL) for (const card in POOL[c]) MARG[card] = (MARG[card] || 0) + POOL[c][card];
  return { POOL, MARG, BY_NAME, KEY2NAME, tot: tot, conds: Object.keys(POOL).length, games: HB.games, src: src };
}

export function condOf(pool, state, pid) {
  const p = state.p[pid];
  return [Math.min(5, (p.ep || 0) >> 1), (p.ep || 0) >= 5 ? 1 : 0, pool.KEY2NAME[p.lastSkill] || '-'].join('/');
}
export function sampleDist(dist, rnd) {
  let tot = 0; for (const k in dist) tot += dist[k];
  if (!tot) return 'ジ';
  let x = rnd() * tot;
  for (const k in dist) { x -= dist[k]; if (x <= 0) return k; }
  return 'ジ';
}
/* 造一个"人类形状"的 chooser：签名与引擎的 chooser 一致（state, pid, legal）⇒ pick，
   随机流**由调用方注入**（两臂要面对同一串抽样 ⇒ rng 必须按 seed 造，不能用 Math.random）。 */
export function makeMimic(W, pool, tgt, rnd) {
  const R = W.EpirusRules;
  const st = { hit: 0, miss: 0 };
  const fn = function (state, pid, legal) {
    const aff = legal.filter(l => l.affordable);
    const okKey = {}; for (const l of aff) okKey[l.key] = 1;
    const dist = pool.POOL[condOf(pool, state, pid)] || pool.MARG;
    for (let tries = 0; tries < 8; tries++) {
      const card = sampleDist(dist, rnd);
      const def = pool.BY_NAME[card];
      if (def && okKey[def.key]) {
        let tg = null;
        if (tgt === 'rand') {
          const alive = [];
          for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) alive.push(i);
          tg = alive.length ? alive[Math.floor(rnd() * alive.length)] : null;
        } else {
          tg = (pid + 1) % state.p.length;
          if (!state.p[tg] || state.p[tg].hp <= 0) tg = pid;
        }
        st.hit++;
        return { key: def.key, target: (def.key === R.SK.JI || def.target === 'self' || tg == null) ? null : tg };
      }
    }
    st.miss++;
    return { key: R.SK.JI, target: null };
  };
  fn.stats = st;          /* 命中条件分布 / 8 次都抽不到而退回 ジ —— 仪器要把"这个池子到底有多吃得上条件"印出来 */
  return fn;
}

/* 规则理解型人类替身（§2026-11-18）：结合规则真值（穿透/反弹/全息/大雷/蓄能珠/净化/过载炮相位）与
 * `results/obs6.5/*.txt` 真人对局分布（前 3 手蓄能不乱枪、ep≥3 且局面安全时开聚能环连滚、优先狙杀/落雷
 * 压制高 ep 与开环席、有珠优先兑现、残血/面对高 ep 威胁时按针对架势或避雷针设防）。
 * ⚠ 不修改 `makeMimic` 口径，门 D209 与既有读数链不受影响。 */
export function makeRuleHuman(W, opts, rnd) {
  const R = W.EpirusRules;
  const SK = R.SK;
  const GUARD_SET = new Set(R.GUARD_FAMILY || [SK.GUARD, SK.REFLECT, SK.BAGUA, SK.SHIFT, SK.JINSHIELD, SK.ARMOR, SK.PROTO, SK.HOLO]);
  const SOFT_GUARD = new Set([SK.GUARD, SK.BAGUA, SK.SHIFT, SK.JINSHIELD]);
  const REFLECT_SET = new Set([SK.REFLECT, SK.ARMOR]);
  const MINI_IMMUNE = new Set(R.MINI_T_IMMUNE || [SK.GUARD, SK.REFLECT, SK.PROTO]);
  const cfg = Object.assign({ ringBias: 0.78, rodBias: 0.65, chargeBias: 0.45 }, opts || {});
  const rand = typeof rnd === 'function' ? rnd : Math.random;
  const st = { hits: {}, total: 0 };
  const ret = function (key, target, target2, bead) {
    st.total++;
    st.hits[key] = (st.hits[key] || 0) + 1;
    return { key, target: target == null ? null : target, target2: target2 == null ? null : target2, bead: bead || null };
  };

  const fn = function (state, pid, legal) {
    const me = state && state.p && state.p[pid];
    if (!me) return ret(SK.JI);
    const ok = {};
    for (const l of (legal || [])) if (l && l.affordable) ok[l.key] = l;
    const aff = function (k) { return !!ok[k]; };
    const opps = [];
    for (let i = 0; i < state.p.length; i++) {
      const q = state.p[i];
      if (i !== pid && q && q.hp > 0) opps.push(q);
    }
    if (!opps.length) return ret(SK.JI);

    const threatOf = function (q) {
      let s = (q.ringStreak || 0) * 6 + (q.ep || 0) * 1.25 + ((q.elec || 0) ? 5 : 0) + ((q.boom || 0) ? 3 : 0);
      if (q.hp >= 4) s += 2;
      if (q.lastTarget === pid) s += 2;
      if ((q.stickers || []).length > 0) s += 0.5;
      return s;
    };
    const ranked = opps.slice().sort(function (a, b) {
      return (threatOf(b) + rand() * 0.35) - (threatOf(a) + rand() * 0.35);
    });
    const topThreat = ranked[0];
    const hp1 = ranked.filter(function (q) { return q.hp <= 1; });
    const hp2 = ranked.filter(function (q) { return q.hp <= 2; });
    let maxFoeEp = 0, richFoes = 0, bigTFoes = 0, elecFoes = 0, guardFoes = 0, aimedAtMe = 0;
    for (const q of opps) {
      const e = q.ep || 0;
      if (e > maxFoeEp) maxFoeEp = e;
      if (e >= 2 || (q.elec || 0) > 0 || (q.boom || 0) > 0) richFoes++;
      if (e >= 5) bigTFoes++;
      if ((q.elec || 0) > 0) elecFoes++;
      if (GUARD_SET.has(q.lastSkill)) guardFoes++;
      if (q.lastTarget === pid && (e >= 1 || (q.elec || 0) > 0)) aimedAtMe++;
    }
    const maxFoeHp = opps.reduce(function (m, q) { return Math.max(m, q.hp || 0); }, 0);
    const myStickers = (function () {
      let n = 0;
      for (const q of opps) for (const s of (q.stickers || [])) if (s && s.owner === pid) n++;
      return n;
    })();
    const disabledAny = me.cooldown && Object.keys(me.cooldown).some(function (k) { return (me.cooldown[k] || 0) > 0; });
    const cannonPhase = ((me.cannonCount || 0) % 3) + 1;

    /* ① 被挑衅时必须打合法进攻卡指向挑衅者 */
    if (me.tauntActive) {
      const taunter = (me.tauntBy && me.tauntBy.find(function (id) { return state.p[id] && state.p[id].hp > 0; })) ?? topThreat.id;
      const tObj = state.p[taunter] || topThreat;
      const order = [SK.LASER_EYE, SK.RAILGUN, SK.SNIPE, SK.TANK, SK.SWORD, SK.CANNON, SK.DRAIN, SK.GUN];
      for (const k of order) {
        if (!aff(k)) continue;
        if (k === SK.GUN && GUARD_SET.has(tObj.lastSkill)) continue;
        if (k === SK.TANK && REFLECT_SET.has(tObj.lastSkill)) continue;
        return ret(k, tObj.id);
      }
      if (aff(SK.DUAL_GUN) && ranked.length >= 2) {
        const second = ranked.find(function (q) { return q.id !== tObj.id; }) || ranked[1];
        return ret(SK.DUAL_GUN, tObj.id, second.id);
      }
    }

    /* ② 净化清负态/符咒 */
    if (aff(SK.PURIFY) && ((me.stickers || []).length >= 2 || ((me.stickers || []).length >= 1 && (me.hp <= 2 || disabledAny)))) {
      return ret(SK.PURIFY);
    }

    /* ③ 残血与斩杀机会（HP<=1 优先摄魂/穿透收人头） */
    if (hp1.length) {
      for (const t of hp1) {
        if (t.lastSkill === SK.PROTO || t.lastSkill === SK.HOLO) continue;
        if (me.hp < maxFoeHp && aff(SK.DRAIN)) return ret(SK.DRAIN, t.id);
        if (aff(SK.SNIPE) && (REFLECT_SET.has(t.lastSkill) || SOFT_GUARD.has(t.lastSkill) || (me.ep || 0) >= 3)) return ret(SK.SNIPE, t.id);
        if (aff(SK.SWORD) && !SOFT_GUARD.has(t.lastSkill) && !REFLECT_SET.has(t.lastSkill)) return ret(SK.SWORD, t.id);
        if (aff(SK.GUN) && !GUARD_SET.has(t.lastSkill)) return ret(SK.GUN, t.id);
        if (aff(SK.TANK) && !REFLECT_SET.has(t.lastSkill)) return ret(SK.TANK, t.id);
      }
    }

    /* ④ 有能量珠优先兑现（珠回合末清零，过期浪费） */
    if ((me.elec || 0) > 0 && aff(SK.RAILGUN)) {
      const t = hp2.find(function (q) { return q.lastSkill !== SK.PROTO && q.lastSkill !== SK.HOLO; })
        || ranked.find(function (q) { return q.lastSkill !== SK.PROTO && q.lastSkill !== SK.HOLO; })
        || topThreat;
      return ret(SK.RAILGUN, t.id);
    }
    if ((me.boom || 0) > 0 && aff(SK.LASER_EYE)) {
      const guarded = ranked.find(function (q) { return GUARD_SET.has(q.lastSkill); }) || topThreat;
      return ret(SK.LASER_EYE, guarded.id);
    }

    /* ⑤ 压制聚能环/大雷威胁与引爆贴符 */
    if (aff(SK.FIRESTORM) && myStickers >= 2) return ret(SK.FIRESTORM);
    if (aff(SK.BIG_T) && ((me.ringStreak || 0) === 0 || (me.ep || 0) >= 8 || hp2.length > 0)) {
      const btTarget = hp2[0] || ranked.find(function (q) { return (q.ringStreak || 0) >= 1 || (q.ep || 0) >= 3; }) || topThreat;
      return ret(SK.BIG_T, btTarget.id);
    }
    const channeller = ranked.find(function (q) { return (q.ringStreak || 0) >= 2 && !MINI_IMMUNE.has(q.lastSkill); });
    if (aff(SK.MINI_T) && channeller && (me.ep || 0) >= 5 && (me.ringStreak || 0) === 0) {
      return ret(SK.MINI_T, channeller.id);
    }

    /* ⑥ 避雷针与针对性保命（仅在残血/真被针对时防，避免无意义龟缩连防） */
    if (aff(SK.ROD) && (bigTFoes >= 1 || elecFoes >= 1) && !(me.rodTurns > 0) && me.hp <= 2 && rand() < cfg.rodBias) {
      return ret(SK.ROD);
    }
    if (me.hp <= 1 && richFoes >= 1 && (aimedAtMe >= 1 || bigTFoes >= 1 || rand() < 0.55)) {
      const defOrder = bigTFoes > 0 ? [SK.PROTO, SK.REFLECT, SK.GUARD, SK.SHIFT, SK.BAGUA]
        : [SK.PROTO, SK.REFLECT, SK.SHIFT, SK.BAGUA, SK.GUARD];
      for (const dk of defOrder) if (aff(dk)) return ret(dk);
    }
    if (me.hp <= 2 && (aimedAtMe >= 1 || bigTFoes >= 1) && (me.ringStreak || 0) === 0 && me.lastSkill !== SK.REFLECT && rand() < 0.35) {
      const defOrder2 = bigTFoes > 0 ? [SK.PROTO, SK.REFLECT, SK.GUARD] : [SK.REFLECT, SK.BAGUA];
      for (const dk of defOrder2) if (aff(dk)) return ret(dk);
    }

    /* ⑦ 真人聚能环节奏：安全时开环连滚到 5 环/12ep 封顶，开局不乱放枪，攒钱开环或蓄能 */
    if ((me.ringStreak || 0) >= 1 && (me.ringStreak || 0) < 5 && (me.ep || 0) < 12 && aff(SK.RING)) {
      return ret(SK.RING);
    }
    if ((me.ringStreak || 0) === 0 && (me.ep || 0) >= 3 && (me.ep || 0) <= 6 && me.hp >= 2 && aimedAtMe <= 1 && aff(SK.RING) && rand() < cfg.ringBias) {
      return ret(SK.RING);
    }
    if ((me.ringStreak || 0) === 0 && (me.ep || 0) < 3 && me.hp >= 2 && aimedAtMe === 0 && !hp1.length && aff(SK.JI)) {
      return ret(SK.JI);
    }

    /* ⑧ 蓄能、地雷、过载炮与常规穿透进攻（避免空 ep 乱点枪自断经济） */
    if (!(me.elec || 0) && !(me.boom || 0) && (me.ep || 0) >= 3 && aff(SK.CHARGE) && rand() < cfg.chargeBias) {
      const bead = guardFoes >= 2 ? 'boom' : 'elec';
      return ret(SK.CHARGE, null, null, bead);
    }
    if (aff(SK.MINE) && !(me.mine) && me.hp >= 3 && (me.ep || 0) >= 5 && richFoes >= 1 && rand() < 0.35) {
      return ret(SK.MINE);
    }
    if (aff(SK.CANNON) && (me.ep || 0) >= 4) {
      if (cannonPhase === 1 && !SOFT_GUARD.has(topThreat.lastSkill) && topThreat.lastSkill !== SK.PROTO) return ret(SK.CANNON, topThreat.id);
    }
    if (aff(SK.CANNON) && cannonPhase === 2 && (me.ep || 0) === 1 && topThreat.lastSkill !== SK.PROTO) return ret(SK.CANNON, topThreat.id);
    if (aff(SK.CANNON) && cannonPhase === 3 && (me.ep || 0) === 0 && me.hp > 1) {
      const rich = ranked.find(function (q) { return (q.ep || 0) >= 3 && q.lastSkill !== SK.PROTO; });
      if (rich) return ret(SK.CANNON, rich.id);
    }
    if (aff(SK.DUAL_GUN) && ranked.length >= 2) {
      const clean = ranked.filter(function (q) { return !REFLECT_SET.has(q.lastSkill) && !GUARD_SET.has(q.lastSkill); });
      if (clean.length >= 2 && (me.ep || 0) >= 4 && rand() < 0.45) return ret(SK.DUAL_GUN, clean[0].id, clean[1].id);
    }
    if (aff(SK.SNIPE) && ((topThreat.ringStreak || 0) >= 1 || REFLECT_SET.has(topThreat.lastSkill) || SOFT_GUARD.has(topThreat.lastSkill) || (me.ep || 0) >= 4)) {
      if (topThreat.lastSkill !== SK.PROTO && topThreat.lastSkill !== SK.HOLO) return ret(SK.SNIPE, topThreat.id);
    }
    if (aff(SK.SWORD) && !SOFT_GUARD.has(topThreat.lastSkill) && topThreat.lastSkill !== SK.PROTO && ((me.ep || 0) >= 4 || REFLECT_SET.has(topThreat.lastSkill))) {
      return ret(SK.SWORD, topThreat.id);
    }
    if (aff(SK.TANK) && !REFLECT_SET.has(topThreat.lastSkill) && topThreat.lastSkill !== SK.PROTO && (SOFT_GUARD.has(topThreat.lastSkill) || (me.ep || 0) >= 4)) {
      return ret(SK.TANK, topThreat.id);
    }
    if (aff(SK.GUN) && !GUARD_SET.has(topThreat.lastSkill) && ((me.ep || 0) >= 4 || (topThreat.ringStreak || 0) >= 1)) {
      return ret(SK.GUN, topThreat.id);
    }
    if (aff(SK.JI)) return ret(SK.JI);
    return ret((legal && legal[0] && legal[0].key) || SK.JI);
  };
  fn.stats = st;
  return fn;
}

/* ---- 自证夹具（门 D209 跑它；形状照 D202/D203 的规矩：合成输入 + 手算值，不跑真引擎 ⇒ <1 秒） ---- */
export function selfTest(mulberry32) {
  const errs = [];
  const R = { SK: { JI: 'ji' }, skills: [
    { name: '枪', key: 'gun', target: 'other' }, { name: '雷', key: 'miniT', target: 'other' }, { name: 'ジ', key: 'ji' }
  ] };
  const W = { EpirusRules: R };
  const pool = { POOL: { '3/0/枪': { '枪': 3, '雷': 1 } }, MARG: { '枪': 1 }, KEY2NAME: { gun: '枪' }, BY_NAME: {
    '枪': R.skills[0], '雷': R.skills[1], 'ジ': R.skills[2] } };
  const mkState = () => ({ p: [{ hp: 5, ep: 6, lastSkill: 'gun' }, { hp: 5 }, { hp: 0 }, { hp: 5 }, { hp: 5 }] });
  const legal = [{ key: 'gun', affordable: true }, { key: 'miniT', affordable: true }, { key: 'ji', affordable: true }];
  /* 手算 1：条件键 = 钱档 3（ep 6>>1=3，上限 5）/ 富有 1（≥5）/ 上一手"枪" ⇒ 命中 POOL['3/1/枪']？
     故意写成"键不对得上"的形状，检查**回退到边际分布**这条路径。 */
  const cond = condOf(pool, { p: [{ hp: 5, ep: 6, lastSkill: 'gun' }] }, 0);
  if (cond !== '3/1/枪') errs.push('条件键算成 ' + cond + '，手算应为 3/1/枪（ep6→档3、≥5⇒富有1、上一手 gun→枪）');
  /* 手算 2：分布 {枪:3, 雷:1} ⇒ rnd=0.5 应取到"枪"（累计 3/4=0.75 > 0.5）；rnd=0.9 应取"雷" */
  if (sampleDist(pool.POOL['3/0/枪'], () => 0.5) !== '枪') errs.push('rnd=0.5 在手算分布 {枪:3,雷:1} 上应取"枪"');
  if (sampleDist(pool.POOL['3/0/枪'], () => 0.9) !== '雷') errs.push('rnd=0.9 应取"雷"（累计到 4/4）');
  if (sampleDist({}, () => 0.1) !== 'ジ') errs.push('空分布必须退回 ジ，而不是返回 undefined');
  /* 手算 3：`next` 指向 ⇒ pid=0 打 1 号位（与 rnd 无关）
     注意 cond 键是 `3/1/枪` 而表里只有 `3/0/枪` ⇒ 这一条**同时**验到"键对不上就回退边际分布"那条路（MARG = {枪:1} ⇒ 必然抽到"枪"）。 */
  const a = makeMimic(W, pool, 'next', () => 0.1)(mkState(), 0, legal);
  if (a.key !== 'gun' || a.target !== 1) errs.push('next 指向：手算应为 gun→1，实测 ' + JSON.stringify(a));
  /* 手算 4：`rand` 指向要**消耗两次** rnd（先抽卡、再指人）⇒ 用序列流 [0.1, 0.5]：
     第二次 0.5 × 活席列表 [1,3,4]（2 号位已死、不许进列表）= 1.5 ⇒ floor=1 ⇒ 席位 **3**。 */
  const seq = (function (xs) { let i = 0; return function () { const v = xs[i % xs.length]; i++; return v; }; })([0.1, 0.5]);
  const b = makeMimic(W, pool, 'rand', seq)(mkState(), 0, legal);
  if (b.key !== 'gun' || b.target !== 3) errs.push('rand 指向：活席 [1,3,4] × rnd 序列 [0.1,0.5] ⇒ 手算应取 index1 = 席位 3，实测 ' + JSON.stringify(b));
  /* 手算 5：条件键**对得上**时必须走那张表，不许偷偷走边际（这一条专门抓"键格式改错了但结果看起来还行"） */
  const pool2 = { POOL: { '3/1/枪': { '雷': 4 } }, MARG: { '枪': 1 }, KEY2NAME: { gun: '枪' },
    BY_NAME: { '枪': R.skills[0], '雷': R.skills[1], 'ジ': R.skills[2] } };
  const c = makeMimic(W, pool2, 'next', () => 0.1)(mkState(), 0, legal);
  if (c.key !== 'miniT') errs.push('条件键命中时不该回退边际分布：实测 ' + JSON.stringify(c));
  /* 反空转：如果 rnd 一次都没被调用（采样根本没跑），上面几条会全对不上 ⇒ 这里显式数一次 */
  let calls = 0;
  const counting = () => { calls++; return 0.1; };
  makeMimic(W, pool, 'next', counting)(mkState(), 0, legal);
  if (calls === 0) errs.push('mimic 一次都没调用随机流 ⇒ 夹具在空转（负对照不许空转）');
  return errs;
}
