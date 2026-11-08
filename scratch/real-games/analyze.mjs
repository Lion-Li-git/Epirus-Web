/* 实机对局解析（results/2.0/*.txt，用户 11-08 晚 5 局）
 * 每局：你（玩家1） vs 池抽 7 枚。按席位拆：动作谱 / 防御出手 / 白防·有效·被穿透 三档 / 承伤 / 集火。
 * 白防口径（官方 09-26 裁定）：防御出手那回合没有任何人攻击他 = 白防；被攻击且掉血 = 被穿透；被攻击没掉血（挡下/弹回）= 有效。
 * 质量 = (有效 + 0.5×被穿透) / 防御手数 —— 与 tools/defense-quality.mjs 同式。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const CN2KEY = {
  'ジ': 'ji', '防御': 'guard', '反弹': 'reflect', '八卦阵': 'bagua', '金刚盾': 'jinshield', '全息屏障': 'holo',
  '藤甲': 'armor', '原型制御': 'proto', '坦克': 'tank', '地雷': 'mine', '聚能环': 'ring', '蓄能': 'charge',
  '摄魂指法': 'drain', '真正的落雷': 'railgun', '电磁炮': 'bigT', '激光剑': 'sword', '狙击枪': 'snipe', '枪': 'gun',
  '双枪': 'dualGun', '激光眼': 'laserEye', '火风暴': 'firestorm', '炮': 'cannon', '挑衅': 'taunt', '转移': 'transfer',
  '净化': 'purify', '镜面': 'mirror', '符咒': 'curse', '缩地': 'shift', '梦魇': 'nightmare', '微型电磁炮': 'miniT',
  '大雷': 'bigT', ' rod': 'rod',
};
const DEF_KEYS = new Set(['guard', 'reflect', 'bagua', 'jinshield', 'armor', 'holo']);
const ATK_HINT = /→玩家\d+/;   // 带指向的动作（攻击或 holo 护人）

const files = readdirSync('results/2.0').filter(f => f.endsWith('.txt')).sort();
const perPack = {};   // pack → 聚合
const perGame = [];
let userAgg = { acts: 0, byCard: {}, def: 0, bai: 0, eff: 0, pen: 0 };

for (const f of files) {
  const txt = readFileSync('results/2.0/' + f, 'utf8').replace(/\r/g, '');
  const lineMatch = txt.match(/对手=([^\n]+)\n/);
  const seats = {};   // pid → pack
  if (lineMatch) for (const m of lineMatch[1].matchAll(/玩家(\d)=([^ ]+)/g)) seats[+m[1]] = m[2];
  const win = (txt.match(/结果：(.+?)（共 (\d+) 回合）/) || []);
  const G = { file: f, winner: win[1] || '?', rounds: +win[2] || 0, seats, rows: [] };

  /* 逐回合切块 */
  const roundBlocks = txt.split(/第 (\d+) 回合：/);
  for (let b = 1; b < roundBlocks.length; b += 2) {
    const rnd = +roundBlocks[b], body = roundBlocks[b + 1];
    const headLine = body.split('\n')[0];
    const acts = {};
    for (const m of headLine.matchAll(/玩家(\d)=【([^】]*)】/g)) {
      const pid = +m[1], raw = m[2];
      if (raw === '已淘汰') { acts[pid] = { key: null }; continue; }
      const t = raw.match(/^(.+?)→玩家(\d+)$/);
      const cn = t ? t[1] : raw;
      acts[pid] = { key: CN2KEY[cn] || ('?' + cn), cn, target: t ? +t[2] : null };
    }
    const evs = [];
    for (const l of body.split('\n')) {
      const s = l.trim();
      let m;
      if ((m = s.match(/^💥 玩家(\d+) 受 (\d+) 点伤害（(.+?)）/))) evs.push({ t: 'dmg', to: +m[1], amt: +m[2], reason: m[3] });
      else if ((m = s.match(/^↩ 玩家(\d+) 的攻击被 玩家(\d+) 的【(.+?)】弹回/))) evs.push({ t: 'reflect', atk: +m[1], by: +m[2], via: m[3] });
      else if ((m = s.match(/^🛡 玩家(\d+) 的【(.+?)】挡下伤害/))) evs.push({ t: 'blocked', to: +m[1], via: m[2] });
      else if ((m = s.match(/^☠ 玩家(\d+) 死亡/))) evs.push({ t: 'death', pid: +m[1] });
      else if ((m = s.match(/^💣 玩家(\d+) 埋下地雷/))) evs.push({ t: 'mineArm', pid: +m[1] });
      else if ((m = s.match(/^🚫 玩家(\d+) 的技能被无效化/))) evs.push({ t: 'void', pid: +m[1] });
    }
    G.rows.push({ rnd, acts, evs });
  }

  /* 每席位统计 */
  const stat = {};   // pid → {…}
  for (const { rnd, acts, evs } of G.rows) {
    const attackedThisRound = new Set();
    for (const pid of Object.keys(acts)) {
      const a = acts[pid];
      if (a && a.target && a.key !== 'holo') attackedThisRound.add(a.target);   // holo 护人不算攻击
    }
    /* AoE 攻击（无指向）：真正的落雷/火风暴/大雷 等——从伤害侧补记（reason 映射攻击者不可得 ⇒ 只把"被这类打"记为承击） */
    const aoeVictims = new Set(evs.filter(e => e.t === 'dmg' && /落雷|火风暴|地雷/.test(e.reason)).map(e => e.to));
    for (let pid = 1; pid <= 8; pid++) {
      const a = acts[pid];
      if (!a || a.key === null) continue;
      const S = stat[pid] = stat[pid] || { pack: seats[pid] || '你', acts: 0, byCard: {}, def: 0, bai: 0, eff: 0, pen: 0, dmgTaken: 0, dmgDealt: 0, aliveRounds: 0, defAfterHit: 0, atkT: {}, onUser: 0, atkN: 0 };
      if (pid !== 1) S.aliveRounds++;   // 玩家1=人类不数存活
      S.acts++;
      S.byCard[a.key] = (S.byCard[a.key] || 0) + 1;
      const isUser = pid === 1;
      const AGG = isUser ? userAgg : (perPack[seats[pid]] = perPack[seats[pid]] || { acts: 0, byCard: {}, def: 0, bai: 0, eff: 0, pen: 0, dmgTaken: 0, deaths: 0, games: 0 });
      if (isUser) AGG.acts++; else { AGG.acts++; if (S.acts === 1) AGG.games++; }
      AGG.acts = AGG.acts; // (占位：下面统一累加)
      AGG.byCard[a.key] = (AGG.byCard[a.key] || 0) + 1;
      if (a.target && a.key !== 'holo' && a.key !== 'ring') { S.atkN++; S.atkT[a.target] = (S.atkT[a.target] || 0) + 1; if (a.target === 1 && !isUser) { S.onUser++; AGG.onUser = (AGG.onUser || 0) + 1; } }
      if (DEF_KEYS.has(a.key)) {
        if (S.prevDmg) { S.defAfterHit++; AGG.defAfterHit = (AGG.defAfterHit || 0) + 1; }
        S.def++; AGG.def++;
        const attacked = attackedThisRound.has(pid) || aoeVictims.has(pid);
        const dmgTaken = evs.filter(e => e.t === 'dmg' && e.to === pid && e.reason !== '地雷').reduce((x, e) => x + e.amt, 0);
        if (!attacked) { S.bai++; AGG.bai++; }
        else if (dmgTaken > 0) { S.pen++; AGG.pen++; }
        else { S.eff++; AGG.eff++; }
      }
      const myDmg = evs.filter(e => e.t === 'dmg' && e.to === pid).reduce((x, e) => x + e.amt, 0);
      S.dmgTaken += myDmg; S.prevDmg = myDmg > 0;
      S.dmgDealt += evs.filter(e => e.t === 'dmg' && e.reason !== '地雷' && e.reason !== '终局收缩').length > 0 ? 0 : 0;
      AGG.dmgTaken = (AGG.dmgTaken || 0) + evs.filter(e => e.t === 'dmg' && e.to === pid).reduce((x, e) => x + e.amt, 0);
    }
    /* 集火粗尺：每席位本回合伤害事件的 reason 归因不到攻击者 ⇒ 集火只在席位对（attacker action target）上算 */
  }
  /* 死亡计数 */
  for (const { evs } of G.rows) for (const e of evs) if (e.t === 'death' && seats[e.pid]) { perPack[seats[e.pid]] && (perPack[seats[e.pid]].deaths = (perPack[seats[e.pid]].deaths || 0) + 1); }
  /* 每局卡覆盖（全席位并集） */
  G.coverage = new Set();
  for (const { acts } of G.rows) for (const pid of Object.keys(acts)) { const a = acts[pid]; if (a && a.key) G.coverage.add(a.key); }
  perGame.push(G);
}

/* ===== 输出 ===== */
console.log('===== 每局 =====');
for (const G of perGame) {
  console.log(G.file + ' ‖ 胜者=' + G.winner + ' ‖ ' + G.rounds + ' 回合 ‖ 全场卡覆盖 ' + G.coverage.size + ' 张: ' + [...G.coverage].join(','));
}
console.log('\n===== 按包聚合（跨局）=====');
console.log('包'.padEnd(14) + '局 出手 用卡 防御手  白防   有效  穿透  白防率  质量   死亡  承伤/局  卡谱(top)');
for (const [pk, S] of Object.entries(perPack).sort((a, b) => b.def - a.def)) {
  const cards = Object.keys(S.byCard).length;
  const q = S.def ? (S.eff + 0.5 * S.pen) / S.def : NaN;
  const baiR = S.def ? S.bai / S.def : NaN;
  const top = Object.entries(S.byCard).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ' ' + Math.round(100 * v / S.acts) + '%').join(' ');
  console.log(pk.padEnd(14) + String(S.games) + '  ' + String(S.acts).padStart(3) + '  ' + String(cards).padStart(2) + '  ' + String(S.def).padStart(4) + '  ' + String(S.bai).padStart(4) + '  ' + String(S.eff).padStart(4) + '  ' + String(S.pen).padStart(4) + '  ' + (isFinite(baiR) ? (100 * baiR).toFixed(0) + '%' : ' —') + '  ' + (isFinite(q) ? (100 * q).toFixed(0) + '%' : ' —') + '  ' + String(S.deaths || 0).padStart(3) + '  ' + (S.dmgTaken / Math.max(1, S.acts)).toFixed(2).padStart(6) + '  ' + top);
}
console.log('\n===== 你（玩家1）=====');
const u = userAgg;
const uq = u.def ? (u.eff + 0.5 * u.pen) / u.def : NaN;
console.log('出手 ' + u.acts + ' ‖ 用卡 ' + Object.keys(u.byCard).length + ' ‖ 防御手 ' + u.def + '（白防 ' + u.bai + ' 有效 ' + u.eff + ' 穿透 ' + u.pen + ' ‖ 白防率 ' + (u.def ? Math.round(100 * u.bai / u.def) : 0) + '% 质量 ' + (isFinite(uq) ? Math.round(100 * uq) : 0) + '%）');
console.log('你的卡谱: ' + Object.entries(u.byCard).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' '));
writeFileSync('scratch/real-games/real-summary.json', JSON.stringify({ perPack, user: u, games: perGame.map(g => ({ file: g.file, winner: g.winner, rounds: g.rounds, coverage: [...g.coverage] })) }, null, 1));
console.log('\n明细 → scratch/real-games/real-summary.json');
