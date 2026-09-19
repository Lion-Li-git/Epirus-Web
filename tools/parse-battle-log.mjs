/* 读用户自己的对局记录（results/*.txt），把"体感"变成数
 * 为什么写它：夜里我全是"AI 打 AI / AI 打脚本"的装配，缺**真人打法**这一格；
 *   而用户 09-19 实盘两局（一局赢、一局输）正好是唯一的真人样本 ⇒ 别凭印象说"AI 很苟/AI 乱集火"，量它。
 * 量什么：
 *   ① 各席出手构成（ジ 占比、用过的招数种类）—— 夜里 V2 解剖的同一套口径，好横向比
 *   ② 伤害与击杀归属：AI 打真人 / AI 互殴 / 真人打 AI 各占多少
 *   ③ **集火轮**（≥3 席同时打同一目标）与 **AI 互相抵消轮**（两条 AI 线相抵）—— 用户报过"无根据的突然集火"
 *   ④ 每席每回合承伤、谁在第几回合死
 * ⚠ 只读：本工具不写 results/，也不改任何包。样本 n=2 局 ⇒ 用来说"这两局里发生了什么"，别说成概率。
 * 用法：node tools/parse-battle-log.mjs [文件...]（默认 results/ 下最新的两个 .txt）
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
let FILES = args;
if (!FILES.length) {
  const dir = 'results';
  if (!existsSync(dir)) throw new Error('没有 results/ 目录');
  FILES = readdirSync(dir).filter(f => f.endsWith('.txt')).map(f => ({ f: dir + '/' + f, t: (() => { try { return readFileSync(dir + '/' + f, 'utf8').length; } catch (e) { return 0; } })() }))
    .sort((a, b) => b.f.localeCompare(a.f)).slice(0, 2).map(x => x.f);
}

for (const file of FILES) {
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const mode = (/模式=(\S+)/.exec(raw) || [, '?'])[1];
  const result = (/结果：(.+?)(?:（|$)/.exec(raw) || [, '?'])[1].trim();
  /* 人类席位：记录里 玩家1 = "你"（结果行要么"你赢了"要么点名 AI 获胜） */
  const HUMAN = 1;
  const act = {}; const dmgBy = {}, dmgTo = {}, dmgVs = {}; const deaths = {}; const roundsRaw = [];
  let maxSeat = 0, rounds = 0, focusRounds = 0, aiCancelRounds = 0, blockRounds = 0;
  const focusDetail = [], cancelDetail = [];
  for (const l of lines) {
    let m = /^第 (\d+) 回合：(.*)$/.exec(l);
    if (m) {
      rounds++;
      const picks = {};
      for (const pm of m[2].matchAll(/玩家(\d+)=【([^】]+?)(?:→玩家(\d+))?】/g)) {
        const seat = Number(pm[1]); maxSeat = Math.max(maxSeat, seat);
        picks[seat] = { skill: pm[2].trim(), target: pm[3] ? Number(pm[3]) : null };
        const key = 'P' + seat;
        (act[key] = act[key] || {});
        act[key][pm[2].trim()] = (act[key][pm[2].trim()] || 0) + 1;
      }
      /* 集火：同一目标被 ≥3 席选为攻击目标（只数真带目标的攻击） */
      const cnt = {};
      for (const s in picks) if (picks[s].target && picks[s].skill !== '已淘汰') (cnt[picks[s].target] = cnt[picks[s].target] || []).push(Number(s));
      for (const t in cnt) if (cnt[t].length >= 3) {
        focusRounds++;
        const attackers = cnt[t];
        focusDetail.push('第' + m[1] + '回合：' + attackers.join('/') + ' 号席集火 玩家' + t + '（' + attackers.map(a => picks[a].skill).join('+') + '）' + (attackers.every(a => a !== HUMAN) ? '[全 AI]' : '[含真人]') + (Number(t) === HUMAN ? ' → **打真人**' : ' → 打 AI'));
      }
      roundsRaw.push({ n: Number(m[1]), picks });
      continue;
    }
    /* 明细行 */
    let d = /💥 玩家(\d+) 受 (\d+) 点伤害（([^）]+)）/.exec(l);
    if (d) { const to = Number(d[1]); dmgTo['P' + to] = (dmgTo['P' + to] || 0) + Number(d[2]); }
    let k = /☠ 玩家(\d+) 死亡/.exec(l); if (k) deaths['P' + k[1]] = rounds;
    if (/⚔ 双方攻击相抵/.test(l)) { aiCancelRounds++; }
    if (/🛡 玩家\d+ 的【.+】挡下/.test(l)) blockRounds++;
    if (/💚 玩家(\d+) 回复/.test(l)) { const h = RegExp.$1; }
  }
  const seats = [...Array(maxSeat).keys()].map(i => 'P' + (i + 1));
  const label = s => (s === 'P' + HUMAN ? '真人' : 'AI' + s.slice(1));
  /* 伤害归属：从"相抵/集火"之外只能靠技能名+回合对齐 ⇒ 用"谁打谁"的攻击声明近似（明细里的 💥 不带 source） */
  let humanDealt = 0, aiDealtToHuman = 0, aiDealtToAI = 0;
  for (const r of roundsRaw) {
    for (const s in r.picks) {
      const p = r.picks[s], t = p.target;
      if (!t || p.skill === '已淘汰' || /ジ|蓄能|聚能环/.test(p.skill)) continue;
      const isHumanAct = Number(s) === HUMAN, isHumanTgt = t === HUMAN;
      if (isHumanAct && !isHumanTgt) humanDealt++;
      if (!isHumanAct && isHumanTgt) aiDealtToHuman++;
      if (!isHumanAct && !isHumanTgt) aiDealtToAI++;
    }
  }
  console.log(`\n===== ${file.split('/').pop()}  ${mode}  →  ${result}（${rounds} 回合）=====`);
  console.log('  席位   出手数  ジ占比   防御族占比  用过的招数种类  前四张');
  const DEF = ['金刚盾', '防御', '反弹', '八卦阵', '无极变速', '原型制御', '全息屏障', '玄武甲'];
  for (const s of seats) {
    const a = act[s] || {}; const tot = Object.values(a).reduce((x, y) => x + y, 0);
    if (!tot) { console.log(`  ${label(s).padEnd(5)}   0`); continue; }
    const top = Object.entries(a).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => k + ' ' + (100 * v / tot).toFixed(0) + '%').join(' / ');
    const ji = (a['ジ'] || 0) / tot, def = DEF.reduce((sum, d) => sum + (a[d] || 0), 0) / tot;
    console.log(`  ${label(s).padEnd(5)}${String(tot).padStart(6)}  ${(100 * ji).toFixed(0).padStart(4)}%  ${(100 * def).toFixed(0).padStart(9)}%  ${Object.keys(a).length.toString().padStart(12)}     ${top}`);
  }
  console.log(`  攻击声明归属：真人→AI ${humanDealt} · AI→真人 ${aiDealtToHuman} · **AI→AI ${aiDealtToAI}**`);
  console.log('  承伤合计：' + seats.map(s => label(s) + ' ' + (dmgTo[s] || 0)).join(' · '));
  console.log(`  集火轮（≥3 席同目标）：${focusRounds} 次 · AI 相抵轮：${aiCancelRounds} 次 · 挡下事件轮：${blockRounds} 次`);
  for (const f of focusDetail) console.log('     · ' + f);
  const died = Object.entries(deaths).map(([k, v]) => label(k) + ' 第' + v + '回合').join(' ， ');
  console.log('  死亡：' + (died || '（无）'));
}
