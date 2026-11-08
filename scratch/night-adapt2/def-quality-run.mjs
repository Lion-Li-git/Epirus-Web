/* 官方口径防御质量跑批（用户 11-08 晨："白防早有定义"）——单一来源 tools/defense-quality.mjs 的 classifyDefenseWindow
 * 三档：有效（blocked/reflect 挡下）/ 半有效（被真卡穿透）/ 白防（那回合没人朝我来）；质量分 = (有效+0.5半)/手数
 * 窗口 = 焦点席该手之后的本回合结算段（两次焦点决策之间 = 一回合，与"那一回合"同义）
 */
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { classifyDefenseWindow, defenseQuality } from '../../tools/defense-quality.mjs';

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules, Play = W.EpirusPlay, B = W.EpirusBots;
const DEF_KEYS = (R.SKILLS || R.skills || []).filter(s => s.cat === 'defense').map(s => s.key);
const SCRIPTS = ['pickGunSpam', 'pickGuardSpam', 'pickDeepSaver', 'pickHeavyFire', 'pickMix', 'pickAggro', 'pickDeadlineBurst', 'pickEarlyPressure'];

async function run(lab, f, games) {
  const p = loadChamp(W, f);
  const st3 = { eff: 0, part: 0, idle: 0 };
  let defHands = 0, totalKeys = 0;
  for (let g = 0; g < games; g++) {
    const st = S.createState('multi', { next: T.mulberry32(50000 + g) }, 5);
    const focalActs = [];
    const wrap = i => (state, pid, legal) => {
      const k = (i === 0) ? T.policyChooserN(p, 0.15)(state, pid, legal) : B[SCRIPTS[(g * 5 + i) % SCRIPTS.length]](state, pid, legal);
      if (i === 0) { const key = typeof k === 'string' ? k : (k && k.key); if (key) { focalActs.push(key); totalKeys++; } }
      return k;
    };
    Play.autoGameN(st, [wrap(0), wrap(1), wrap(2), wrap(3), wrap(4)]);
    /* 事件按焦点决策分桶（桶 = 一回合结算段）；焦点第 k 手防御 → 桶 k+1（自己决策后的本回合段） */
    const buckets = [[]];
    let bi = 0;
    for (const e of st.events) {
      if (e.type === 'action' && e.pid === 0) { bi++; buckets.push([]); continue; }
      buckets[Math.min(bi, buckets.length - 1)].push(e);
    }
    for (let k = 0; k < focalActs.length; k++) {
      if (!DEF_KEYS.includes(focalActs[k])) continue;
      defHands++;
      const cls = classifyDefenseWindow(buckets[k + 1] || [], R, 0);
      st3[cls]++;
    }
  }
  const q = defenseQuality(st3);
  const pc = x => isFinite(x) ? x.toFixed(1) + '%' : '—';
  console.log(lab.padEnd(16) + ' 防御手 ' + String(q.n).padStart(4)
    + ' ‖ 质量 ' + (isFinite(q.q) ? (100 * q.q).toFixed(1) + '%' : '—')
    + ' ‖ 有效 ' + pc(q.eff) + ' 半 ' + pc(q.part) + ' **白防 ' + pc(q.idle) + '**'
    + ' ‖ 防御占比 ' + (defHands / (totalKeys || 1) * 100).toFixed(1) + '%');
}

const G = Number(process.argv[2] || 150);
for (const [lab, f] of [
  ['K2(用户点名)', 'docs/artifacts/kept/e70-out__D02-31.bak'],
  ['Q-s47(教师)', 'docs/artifacts/e507-out/Q-s47.js'],
  ['T8-s114(现役)', 'js/bundled-champion-3p.js'],
  ['KD-Qg(种子)', 'scratch/night-adapt2/KD-Qg.bak'],
  ['CTRL2-Q-s7', 'docs/artifacts/night-adapt/CTRL2-Q-s7.js'],
  ['CTRL2-Q-s13', 'docs/artifacts/night-adapt/CTRL2-Q-s13.js'],
  ['ADAPT2-Q-s7', 'docs/artifacts/night-adapt/ADAPT2-Q-s7.js'],
]) {
  try { await run(lab, f, G); } catch (e) { console.log(lab + ' 失败: ' + e.message.slice(0, 70)); }
}
process.exit(0);
