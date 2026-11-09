/* 复核 scratch/real-games/analyze.mjs 的事件解析：原脚本 l.trim() 之后行首仍带 "- "，
 * 而六条事件正则都写成 /^💥/ 等 ⇒ dmg/reflect/blocked/death/mineArm/void 全部恒不匹配。
 * 本脚本只做一件事：把 "- " 剥掉再跑同一套判据，报"哪些读数会翻"。不改原脚本。 */
import { readFileSync, readdirSync } from 'node:fs';

const CN2KEY = {
  'ジ': 'ji', '防御': 'guard', '反弹': 'reflect', '八卦阵': 'bagua', '金刚盾': 'jinshield', '全息屏障': 'holo',
  '藤甲': 'armor', '原型制御': 'proto', '坦克': 'tank', '地雷': 'mine', '聚能环': 'ring', '蓄能': 'charge',
  '摄魂指法': 'drain', '真正的落雷': 'railgun', '电磁炮': 'bigT', '激光剑': 'sword', '狙击枪': 'snipe', '枪': 'gun',
  '双枪': 'dualGun', '激光眼': 'laserEye', '火风暴': 'firestorm', '炮': 'cannon', '挑衅': 'taunt', '转移': 'transfer',
  '净化': 'purify', '镜面': 'mirror', '符咒': 'curse', '缩地': 'shift', '梦魇': 'nightmare', '微型电磁炮': 'miniT',
  '大雷': 'bigT', ' rod': 'rod',
};
const DEF_KEYS = new Set(['guard', 'reflect', 'bagua', 'jinshield', 'armor', 'holo']);
const orig = JSON.parse(readFileSync('scratch/real-games/real-summary.json', 'utf8'));

const files = readdirSync('results/2.0').filter(f => f.endsWith('.txt')).sort();
const per = {};
let evCount = { dmg: 0, blocked: 0, reflect: 0, death: 0, mineArm: 0, void: 0 };
let unknownCards = new Set();

for (const f of files) {
  const txt = readFileSync('results/2.0/' + f, 'utf8').replace(/\r/g, '');
  const seats = {};
  const lm = txt.match(/对手=([^\n]+)\n/);
  if (lm) for (const m of lm[1].matchAll(/玩家(\d)=([^ ]+)/g)) seats[+m[1]] = m[2];
  const blocks = txt.split(/第 (\d+) 回合：/);
  const rows = [];
  for (let b = 1; b < blocks.length; b += 2) {
    const body = blocks[b + 1];
    const acts = {};
    for (const m of body.split('\n')[0].matchAll(/玩家(\d)=【([^】]*)】/g)) {
      const pid = +m[1], raw = m[2];
      if (raw === '已淘汰') { acts[pid] = { key: null }; continue; }
      const t = raw.match(/^(.+?)→玩家(\d+)$/);
      const cn = t ? t[1] : raw;
      const key = CN2KEY[cn] || ('?' + cn);
      if (!CN2KEY[cn]) unknownCards.add(cn);
      acts[pid] = { key, target: t ? +t[2] : null };
    }
    const evs = [];
    for (const l of body.split('\n')) {
      const s = l.trim().replace(/^-\s*/, '');   // ← 唯一的改动
      let m;
      if ((m = s.match(/^💥 玩家(\d+) 受 (\d+) 点伤害（(.+?)）/))) { evs.push({ t: 'dmg', to: +m[1], amt: +m[2], reason: m[3] }); evCount.dmg++; }
      else if ((m = s.match(/^↩ 玩家(\d+) 的攻击被 玩家(\d+) 的【(.+?)】弹回/))) { evs.push({ t: 'reflect', atk: +m[1], by: +m[2] }); evCount.reflect++; }
      else if ((m = s.match(/^🛡 玩家(\d+) 的【(.+?)】挡下伤害/))) { evs.push({ t: 'blocked', to: +m[1], via: m[2] }); evCount.blocked++; }
      else if ((m = s.match(/^☠ 玩家(\d+) 死亡/))) { evs.push({ t: 'death', pid: +m[1] }); evCount.death++; }
      else if ((m = s.match(/^💣 玩家(\d+) 埋下地雷/))) { evs.push({ t: 'mineArm', pid: +m[1] }); evCount.mineArm++; }
      else if ((m = s.match(/^🚫 玩家(\d+) 的技能被无效化/))) { evs.push({ t: 'void', pid: +m[1] }); evCount.void++; }
    }
    rows.push({ acts, evs });
  }
  const st = {};
  for (const { acts, evs } of rows) {
    const targeted = new Set();
    for (const pid of Object.keys(acts)) { const a = acts[pid]; if (a && a.target && a.key !== 'holo') targeted.add(a.target); }
    const aoe = new Set(evs.filter(e => e.t === 'dmg' && /落雷|火风暴|地雷/.test(e.reason)).map(e => e.to));
    for (let pid = 1; pid <= 8; pid++) {
      const a = acts[pid];
      if (!a || a.key === null) continue;
      const S = st[pid] = st[pid] || { pack: pid === 1 ? '你' : (seats[pid] || '?'), def: 0, bai: 0, eff: 0, pen: 0, dmg: 0, afterHit: 0, deaths: 0, acts: 0 };
      S.acts++;
      const myDmg = evs.filter(e => e.t === 'dmg' && e.to === pid).reduce((x, e) => x + e.amt, 0);
      if (DEF_KEYS.has(a.key)) {
        if (S.prevDmg) S.afterHit++;
        S.def++;
        const attacked = targeted.has(pid) || aoe.has(pid);
        const takenExMine = evs.filter(e => e.t === 'dmg' && e.to === pid && e.reason !== '地雷').reduce((x, e) => x + e.amt, 0);
        if (!attacked) S.bai++;
        else if (takenExMine > 0) S.pen++;
        else S.eff++;
      }
      S.dmg += myDmg; S.prevDmg = myDmg > 0;
    }
    for (const e of evs) if (e.t === 'death' && st[e.pid]) st[e.pid].deaths++;
  }
  for (const S of Object.values(st)) {
    if (S.pack === '你') continue;
    const A = per[S.pack] = per[S.pack] || { def: 0, bai: 0, eff: 0, pen: 0, dmg: 0, afterHit: 0, deaths: 0, acts: 0 };
    for (const k of Object.keys(A)) A[k] += S[k];
  }
}

console.log('事件解析计数（剥掉 "- " 之后）:', JSON.stringify(evCount));
console.log('未识别卡名:', [...unknownCards].join(',') || '（无）');
console.log('\n包'.padEnd(16) + '防御手  白防  有效  穿透  被打后守  承伤  死亡   白防率(原→新)');
for (const [pk, A] of Object.entries(per).sort((a, b) => b[1].def - a[1].def)) {
  const O = orig.perPack[pk] || {};
  const r = (x, n) => n ? Math.round(100 * x / n) + '%' : '—';
  console.log(pk.padEnd(16) + String(A.def).padStart(5) + String(A.bai).padStart(6) + String(A.eff).padStart(6) +
    String(A.pen).padStart(6) + String(A.afterHit).padStart(8) + String(A.dmg).padStart(7) + String(A.deaths).padStart(6) +
    '   ' + r(O.bai || 0, O.def || 0) + ' → ' + r(A.bai, A.def));
}
const tot = Object.values(per).reduce((a, A) => ({ def: a.def + A.def, bai: a.bai + A.bai, eff: a.eff + A.eff, pen: a.pen + A.pen, afterHit: a.afterHit + A.afterHit }), { def: 0, bai: 0, eff: 0, pen: 0, afterHit: 0 });
console.log('\n合计:', JSON.stringify(tot), '‖ 原文声称 189 手防御 / 被穿透 0 / 被打后守 0%');