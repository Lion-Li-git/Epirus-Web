#!/usr/bin/env node
/* exam-coop.mjs —— A 轴配合剧本集（夜6班 · 2026-11-14，用户点名两典型：「藤甲+坦克天火集火」「给攒大招的角色套盾」）
 *
 * 来源：用户对冠军配合的既有建议（DESIGN-2026-11-04-ideal-champion §命题①「可专精辅助」+ RESULTS-11-03 §四十九
 *   v7 会配合的三手：互相全息套盾 ‖ 同步蓄能→双炮齐射 ‖ 八卦联防）——A 轴对手环境按同样剧本写出来，
 *   才量得出环境适应性。**只进 A 轴**（B 轴冠军配合太随机，不作为环境——用户 11-14 澄清）。
 *
 * 设计红线：
 *   · **确定性**：不读随机流、不用模块级记忆——协议只从共享 state + 闭包捕获的队伍名单推导，同 seed 逐位可复现。
 *   · **剧本 = 整局单位**：planN 轮换的席是独立抽的，配合需要全队同剧本 ⇒ coop 局整队换装（exam-4n --coop=v3）。
 *   · **原轮保留**：rotation 局逐字不动（与 a-1109 可配对）；coop 局是**追加**，n=2 无配合（单对手没法配合）。
 *   · 集火目标一律落在**考生席**（剧本队共同的敌人，pushTarget lowhp 确定选出）；队内角色按 pattern 循环分配。
 */
import { pushTarget } from './bot-chooser-lib.mjs';

/* ---- 共享小件 ---- */
function byKey(legal) { const m = {}; for (const l of legal) m[l.key] = l; return m; }
function aff(m, k) { return m[k] && m[k].affordable; }
function aliveSubset(state, pids) { return pids.filter((i) => state.p[i] && state.p[i].hp > 0); }
function foesOf(ctx, state) { return aliveSubset(state, ctx.foes); }
function focusFoe(ctx, state) {
  const f = pushTarget(foesOf(ctx, state), state, 'lowhp');
  return f ? f.target : ctx.foes[0];
}
/* 攻击优先序（带藤甲协同的火线在前）：坦克(火伤破防转移,被藤甲+1) → 电磁炮(2电伤破防反) → 激光剑(破反弹) → 枪 */
function attackKey(m, fireFirst) {
  const order = fireFirst ? ['tank', 'railgun', 'sword', 'gun'] : ['railgun', 'sword', 'gun'];
  for (const k of order) if (aff(m, k)) return k;
  return null;
}

/* ---- 角色（每个 = (state, pid, legal, ctx) → 键 或 {key,target}；ctx = {team, foes}） ---- */
const ROLES = {
  /* 集火手：全队每回合都打考生席（围殴桌的本体；考生被逼「被围殴还手/解集火」） */
  attacker(state, pid, legal, ctx) {
    const m = byKey(legal);
    const k = attackKey(m, false);
    if (k) return { key: k, target: focusFoe(ctx, state) };
    if (aff(m, 'charge')) return 'charge';
    return 'ji';
  },
  /* 贴藤甲手：把藤甲贴到集火目标身上（其下回合受火伤 +1 = 全队火线的放大器）。
   * 经济序：先攒（本引擎 ep 唯一收入 = 出 ji）再贴——cost-0 的 guard 会把角色锁死在 ep 0。 */
  armorapplicator(state, pid, legal, ctx) {
    const m = byKey(legal);
    if (aff(m, 'armor')) return { key: 'armor', target: focusFoe(ctx, state) };
    if (state.p[pid].ep < 2) return 'ji';
    if (aff(m, 'guard')) return 'guard';
    return 'ji';
  },
  /* 火枪手：攒到 2 ジ打坦克（火伤吃藤甲 +1，还破防御/转移），不够就先攒；随队集火 */
  firegun(state, pid, legal, ctx) {
    const m = byKey(legal);
    if (aff(m, 'tank')) return { key: 'tank', target: focusFoe(ctx, state) };
    if (state.p[pid].ep < 2) return 'ji';
    const k = attackKey(m, false);
    if (k) return { key: k, target: focusFoe(ctx, state) };
    return 'ji';
  },
  /* 天火手：有自己的活符咒就引爆（R64 的 affordable 旗现成），否则先贴符（贴给集火目标，天火全场 AoE 顺带烧别人） */
  firedetonator(state, pid, legal, ctx) {
    const m = byKey(legal);
    if (aff(m, 'firestorm')) return 'firestorm';
    if (aff(m, 'curse')) return { key: 'curse', target: focusFoe(ctx, state) };
    if (aff(m, 'charge')) return 'charge';
    return 'ji';
  },
  /* 攒大雷手：ジ 攒到 5 就「真正的落雷」砸集火目标（防御无效那 2 点电伤）；没攒够就聚能环/攒ジ */
  charger(state, pid, legal, ctx) {
    const m = byKey(legal);
    if (aff(m, 'bigT')) return { key: 'bigT', target: focusFoe(ctx, state) };
    if (aff(m, 'ring')) return 'ring';
    return 'ji';
  },
  /* 全息辅助：给「攒大招的队友」（ジ 最多 = 在憋大雷的人）套盾——用户点名的典型②；自保兜底 */
  holosupport(state, pid, legal, ctx) {
    const m = byKey(legal);
    const mates = aliveSubset(state, ctx.team.filter((i) => i !== pid));
    if (mates.length && aff(m, 'holo') && state.p[pid].ep >= 2) {
      let best = mates[0];
      for (const i of mates) {
        const a = state.p[i], b = state.p[best];
        if (a.ep > b.ep + 1e-9 || (Math.abs(a.ep - b.ep) < 1e-9 && (a.elec + a.boom) > (b.elec + b.boom))) best = i;
      }
      return { key: 'holo', target: best };
    }
    if (state.p[pid].ep < 2) return 'ji';
    if (aff(m, 'proto') || aff(m, 'guard')) return (aff(m, 'proto') ? 'proto' : 'guard');
    return 'ji';
  },
  /* 挑衅坦克：把考生钉在「必须打我」的义务上（引擎 tauntBy 信号），队友白打；先攒够 2 ジ再挑 */
  tauntank(state, pid, legal, ctx) {
    const m = byKey(legal);
    const f = pushTarget(foesOf(ctx, state), state, 'threat');
    if (aff(m, 'taunt')) return { key: 'taunt', target: f ? f.target : ctx.foes[0] };
    if (state.p[pid].ep < 2) return 'ji';
    if (aff(m, 'guard')) return 'guard';
    return 'ji';
  },
  /* 挑衅跟进手：优先打「被队友挑衅钉住的人」（pushTarget focus = tauntBy 义务名单），否则随队集火 */
  tauntfollower(state, pid, legal, ctx) {
    const m = byKey(legal);
    const watched = pushTarget(foesOf(ctx, state), state, 'focus');
    const k = attackKey(m, false);
    if (k) return { key: k, target: (watched && watched.target != null) ? watched.target : ctx.foes[0] };
    if (aff(m, 'charge')) return 'charge';
    return 'ji';
  },
};

/* ---- 剧本（队形 pattern 循环填满 N−1 席；引用既有脚本席的名字由 exam-4n 用 FN[name] 解析） ---- */
export const COOP_LINEUPS = [
  { name: 'focusfire',  label: '集火围殴（用户典型①的素集火底座）', roles: ['attacker'] },
  { name: 'armorfire',  label: '藤甲+坦克天火集火（用户典型①）',   roles: ['armorapplicator', 'firegun', 'firedetonator'] },
  { name: 'holocharger', label: '给攒大招的角色套盾（用户典型②）', roles: ['charger', 'holosupport', 'attacker'] },
  { name: 'tauntposse', label: '挑衅坦克阵',                      roles: ['tauntank', 'tauntfollower', 'tauntfollower'] },
  { name: 'reflectwall', label: '反弹八卦墙',                     seats: ['reflectspam', 'guardspam', 'protowall'] },
];

/* 每局给队伍分配角色/席：roles 按游戏序号偏移循环（座位率中性）；seats（既有脚本名）同理。
 * 返回长度 = team.length 的数组：元素 = {kind:'role', role} 或 {kind:'fn', name}。 */
export function coopSlots(lineup, teamPids, gameIdx) {
  const per = lineup.roles ? lineup.roles : lineup.seats;
  return teamPids.map((_, i) => {
    const key = per[(i + gameIdx) % per.length];
    if (lineup.roles) return { kind: 'role', role: key };
    return { kind: 'fn', name: key };
  });
}

export function lineupOf(name) {
  const l = COOP_LINEUPS.find((x) => x.name === name);
  if (!l) throw new Error('exam-coop: 不认识的剧本 `' + name + '`（在册：' + COOP_LINEUPS.map((x) => x.name).join(',') + '）');
  return l;
}

export function makeRoleChooser(role, ctx) {
  const fn = ROLES[role];
  if (!fn) throw new Error('exam-coop: 不认识的角色 `' + role + '`（在册：' + Object.keys(ROLES).join(',') + '）');
  return function (state, pid, legal) { return fn(state, pid, legal, ctx); };
}

export function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* 一张 coop 排程：games 局，每局一个剧本（洗一次牌循环推进，覆盖优先且可复现） */
export function planCoop(games, seed) {
  const rnd = mulberry32((seed >>> 0) ^ 0xC00F1A5);
  const order = COOP_LINEUPS.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const out = [];
  for (let g = 0; g < games; g++) out.push(order[g % order.length]);
  return out;
}
