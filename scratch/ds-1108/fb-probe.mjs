
/* 场B 探针：1 被测席 + 4 个只攒钱脚本（farmer），数被测席的出手/伤害/击杀
 * 用法：node scratch/ds-1108/fb-probe.mjs <包> [局数]
 */
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
const W = sandbox();
const T = W.EpirusTrainer, B = W.EpirusBots, Play = W.EpirusPlay, S = W.EpirusState;
const file = process.argv[2], G = Number(process.argv[3] || 20);
const p = loadChamp(W, file);
const ch = T.policyChooserN(p, 0.15);
let acts = {}, atk = 0, dmg = 0, kills = 0, rounds = 0, games = 0;
for (let g = 0; g < G; g++) {
  const st = S.createState('multi', { next: T.mulberry32(50000 + g) }, 5);
  const seats = [ (s, pid, legal) => { const k = ch(s, pid, legal); const key = typeof k === 'string' ? k : (k && k.key); if (key) acts[key] = (acts[key] || 0) + 1; return k; },
    B.pickFarmer, B.pickFarmer, B.pickFarmer, B.pickFarmer ];
  Play.autoGameN(st, seats);
  games++; rounds += st.round;
  for (const e of st.events) if (e.type === 'damage' && e.source === 0) dmg += e.amt;
  for (const e of st.events) if (e.type === 'kill' && e.by === 0) kills++;   /* 事件名若不同则为 0，下面按血量判 */
  /* 用血量兜底数击杀：对手 HP 归零 */
  let dead = 0; for (let i = 1; i < 5; i++) if (st.p[i].hp <= 0) dead++;
  kills += dead;
}
const tot = Object.values(acts).reduce((a, b) => a + b, 0) || 1;
console.log(file.split('/').pop() + '：' + games + ' 局，平均 ' + (rounds / games).toFixed(1) + ' 回合');
console.log('  出手谱: ' + Object.entries(acts).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + (v / tot * 100).toFixed(0) + '%').join(' ‖ '));
console.log('  造成伤害 ' + dmg + '（' + (dmg / games).toFixed(2) + '/局）  对手死亡 ' + kills + '（' + (kills / games).toFixed(2) + '/局）');
