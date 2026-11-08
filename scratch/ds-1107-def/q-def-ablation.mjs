
/* Q-s47 防御消融：把「防御类」出手替换成 ジ 或 枪，看四格卷掉多少
 * 用法：node scratch/ds-1107-def/q-def-ablation.mjs [rounds=20]
 */
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { EXAM_POOL } from '../../server/opp-pool.mjs';
import { planN } from '../../tools/exam-pool.mjs';

const W = sandbox();
const T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
const ROUNDS = Number(process.argv[2] || 20);
const pQ = loadChamp(W, 'docs/artifacts/e507-out/Q-s47.js');
const CAT = (key) => { const s = (R.skills || []).find(x => x.key === key); return s ? s.cat : null; };
const FN = {};
for (const e of EXAM_POOL) FN[e.name] = B[{ gunspam: 'pickGunSpam', gunfocus: 'pickGunFocus', aggro: 'pickAggro', earlypressure: 'pickEarlyPressure',
  guardspam: 'pickGuardSpam', wall: 'pickWall', protowall: 'pickProtoWall', baguaspam: 'pickBaguaSpam', reflectspam: 'pickReflectSpam',
  reflecttank: 'pickReflectTank', antidef: 'pickAntiDef', combocounter: 'pickComboCounter', deepsaver: 'pickDeepSaver', ringspam: 'pickRingSpam',
  beadburst: 'pickBeadBurst', heavyfire: 'pickHeavyFire', bigtfocus: 'pickBigTFocus', deadlineburst: 'pickDeadlineBurst', killsecure: 'pickKillSecure',
  mix: 'pickMix', reflectmix: 'pickReflectMix', guardgun: 'pickGuardGun', balanced: 'pickBalanced', targeter: 'pickTargeter', snipespam: 'pickSnipeSpam',
  random: 'pickRandom', mirrorspam: 'pickMirrorSpam', dualspam: 'pickDualSpam' }[e.name]];

function leader(state, pid) {
  const o = []; for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) o.push(i);
  if (!o.length) return null;
  let mx = -Infinity; for (const i of o) if (state.p[i].hp > mx) mx = state.p[i].hp;
  return o.find(i => Math.abs(state.p[i].hp - mx) < 1e-9);
}

const VAR = {
  base: null,
  ji: (k) => ({ key: R.SK.JI, target: null }),
  gun: (k, state, pid, legal) => {
    const aff = legal.filter(l => l.key === R.SK.GUN && l.affordable);
    if (aff.length) { const t = leader(state, pid); if (t != null) return { key: R.SK.GUN, target: t }; }
    return { key: R.SK.JI, target: null };
  },
};

function run(variant, n, mode) {
  const plan = planN(n, ROUNDS, 77000);
  let first = 0, defSeen = 0, defReplaced = 0, decisions = 0;
  const base = T.policyChooserN(pQ, 0.15);
  const sel = (state, pid, legal) => {
    decisions++;
    const k = base(state, pid, legal);
    const key = typeof k === 'string' ? k : (k && k.key);
    if (CAT(key) === 'defense') { defSeen++; if (VAR[variant]) { defReplaced++; return VAR[variant](k, state, pid, legal); } }
    return k;
  };
  for (let j = 0; j < plan.length; j++) {
    const seats = plan[j].seats, rot = j % (n - 1);
    const field = seats.slice(rot).concat(seats.slice(0, rot));
    const choosers = []; let oi = 0;
    for (let pid = 0; pid < n; pid++) choosers.push(pid === 0 ? sel : FN[field[oi++]]);
    const seed = 77000 + n * 1000003 + j * 977;
    const r = T.oneGameN(choosers, seed, n, { mode });
    if (T.rankOf(r.state, 0, seed) === 1) first++;
  }
  const G = plan.length, p = first / G;
  return { p, ex: (p - 1 / n) / (1 - 1 / n), G, defSeen, defReplaced, decisions };
}

const OUT = [];
for (const [hp, mode] of [[3, 'multi'], [5, 'long']]) {
  for (const n of [2, 3, 5, 8]) {
    const row = { hp, n };
    for (const v of ['base', 'ji', 'gun']) { const r = run(v, n, mode); row[v] = r; }
    OUT.push(row);
    console.log('hp' + hp + ' N=' + n + '  base=' + (row.base.p * 100).toFixed(1) + '% (ex ' + row.base.ex.toFixed(3) + ')'
      + '  ‖ 防→ジ=' + (row.ji.p * 100).toFixed(1) + '% (Δ' + ((row.ji.p - row.base.p) * 100).toFixed(1) + 'pt)'
      + '  ‖ 防→枪=' + (row.gun.p * 100).toFixed(1) + '% (Δ' + ((row.gun.p - row.base.p) * 100).toFixed(1) + 'pt)'
      + '  ‖ 防御出手占比 ' + (row.base.defSeen / row.base.decisions * 100).toFixed(0) + '%（' + row.base.defSeen + '/' + row.base.decisions + ' 决策）');
  }
}