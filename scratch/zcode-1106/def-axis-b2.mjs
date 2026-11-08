/* B2 防御打穿轴（PLAN-2026-11-07 B2 · ZCode 深夜）：对 8 个防御系考卷席单独读数
 *
 * 问题："会打防御"是不是一个独立的能力轴？样本冠军只对 EXAM_POOL 里的防御系席
 *   （guardspam/wall/protowall/reflectspam/reflecttank/antidef/beadburst/deepsaver）跑四格卷排程，
 *   得"防御轴 excess"，与全库 X̄₄（P 族已挂表）对秩相关。
 * 用法: node scratch/zcode-1106/def-axis-b2.mjs [rounds=20]
 * 输出: scratch/zcode-1106/def-axis-b2.tsv
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { EXAM_POOL } from '../../server/opp-pool.mjs';
import { planN } from '../../tools/exam-pool.mjs';

const W = sandbox();
const T = W.EpirusTrainer, B = W.EpirusBots;
const ROUNDS = Number(process.argv[2] || 20);
const OUT = 'scratch/zcode-1106/def-axis-b2.tsv';

const DEF_SEATS = ['guardspam', 'wall', 'protowall', 'reflectspam', 'reflecttank', 'antidef', 'beadburst', 'deepsaver'];
const FN = {};
for (const e of EXAM_POOL) FN[e.name] = B[{ gunspam: 'pickGunSpam', gunfocus: 'pickGunFocus', aggro: 'pickAggro', earlypressure: 'pickEarlyPressure',
  guardspam: 'pickGuardSpam', wall: 'pickWall', protowall: 'pickProtoWall', baguaspam: 'pickBaguaSpam', reflectspam: 'pickReflectSpam',
  reflecttank: 'pickReflectTank', antidef: 'pickAntiDef', combocounter: 'pickComboCounter', deepsaver: 'pickDeepSaver', ringspam: 'pickRingSpam',
  beadburst: 'pickBeadBurst', heavyfire: 'pickHeavyFire', bigtfocus: 'pickBigTFocus', deadlineburst: 'pickDeadlineBurst', killsecure: 'pickKillSecure',
  mix: 'pickMix', reflectmix: 'pickReflectMix', guardgun: 'pickGuardGun', balanced: 'pickBalanced', targeter: 'pickTargeter', snipespam: 'pickSnipeSpam',
  random: 'pickRandom', mirrorspam: 'pickMirrorSpam', dualspam: 'pickDualSpam' }[e.name]];

const SAMPLE = [
  ['Q-s47', 'docs/artifacts/e507-out/Q-s47.js'], ['U-s205', 'docs/artifacts/e539-out/U-s205.js'],
  ['eco-34-v7', 'docs/artifacts/eco-34-v7.bak'], ['T-s111', 'docs/artifacts/e521-out/T-s111.js'],
  ['G-s76', 'docs/artifacts/e514-out/G-s76.js'], ['SOUP-Y-KE6k2', 'docs/artifacts/SOUP-Y-KE6k2.bak'],
  ['G-s78', 'docs/artifacts/e514-out/G-s78.js'], ['T8-s114', 'docs/artifacts/e528-out/T8-s114.js'],
  ['SOUP-Y-l65', 'docs/artifacts/SOUP-Y-l65.bak'], ['B-s64', 'docs/artifacts/e513-out/B-s64.js'],
  ['DDEF-s13', 'docs/artifacts/2p0-pool/DDEF-s13.bak'], ['DEF-s16', 'docs/artifacts/2p0-pool/DEF-s16.bak'],
  ['COMBO-s13', 'docs/artifacts/2p0-pool/COMBO-s13.bak'], ['GD3ALL-G5-s13', 'docs/artifacts/2p0-pool/GD3ALL-G5-s13.bak'],
  ['BAS-s13', 'scratch/ga-arms/BAS-s13.js'], ['G3C-s41', 'scratch/ga-arms/G3C-s41.js'],
  ['G3C-s13', 'scratch/ga-arms/G3C-s13.js'], ['GD3ALL-NGA2R-s41', 'scratch/night3/GD3ALL-NGA2R-s41.js'],
  ['LE-s13', 'docs/artifacts/2p0-pool/LE-s13.bak'], ['G-s72', 'docs/artifacts/e514-out/G-s72.js'],
];

/* 只排防御系席的均衡排程：席位循环轮转（8 席 / per 对手），种子与全图批同族 */
function planDef(n, rounds, seed) {
  const per = n - 1, K = DEF_SEATS.length, games = Math.ceil(rounds * K / per);
  const out = [];
  for (let j = 0; j < games; j++) {
    const seats = []; for (let s = 0; s < per; s++) seats.push(DEF_SEATS[(j * per + s) % K]);
    out.push({ seats });
  }
  return out;
}

function run(p, n, mode, rounds) {
  const plan = planDef(n, rounds, 77000);
  let first = 0;
  const base = T.policyChooserN(p, 0.15);
  for (let j = 0; j < plan.length; j++) {
    const seats = plan[j].seats, rot = j % (n - 1);
    const field = seats.slice(rot).concat(seats.slice(0, rot));
    const choosers = []; let oi = 0;
    for (let pid = 0; pid < n; pid++) choosers.push(pid === 0 ? base : FN[field[oi++]]);
    const seed = 77000 + n * 1000003 + j * 977;
    const r = T.oneGameN(choosers, seed, n, { mode });
    if (T.rankOf(r.state, 0, seed) === 1) first++;
  }
  const G = plan.length, pw = first / G;
  return { p: pw, ex: (pw - 1 / n) / (1 - 1 / n), G };
}

const rows = [];
const HDR = 'id\tn\tmode\tp\tex\tG';
for (const [id, path] of SAMPLE) {
  let p;
  try { p = loadChamp(W, path); } catch (e) { console.log('⛔ ' + id + ' 装载失败：' + e.message); continue; }
  for (const n of [2, 5]) for (const mode of ['multi', 'long']) {
    const r = run(p, n, mode, ROUNDS);
    rows.push([id, n, mode, (r.p * 100).toFixed(2), r.ex.toFixed(4), r.G].join('\t'));
    process.stdout.write('.');
  }
  console.log('  ' + id + ' 完成');
  writeFileSync(OUT, [HDR].concat(rows).join('\n') + '\n');
}
console.log('\n写 ' + OUT + '（' + rows.length + ' 行）');
