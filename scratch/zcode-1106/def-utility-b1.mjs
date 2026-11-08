/* B1 防御族效用表（PLAN-2026-11-07 B1 · ZCode 深夜）：把 DS 的单枚消融扩成 **分类别 × N × 桌形**
 *
 * 问题：防御在团队桌承重（DS Q-s47 消融：防→枪 N≥3 −8~−15pt）、2P 长桌负资产（换进攻 +7pt）——
 *   但"哪个防御技能在哪张桌真有用"没量过。本台对样本冠军把**单个防御键**的出手替换成集气（中性），
 *   量 Δexcess ⇒ 每键 × 每桌 × 每人数的效用一格。
 * 判据（B4）链接：承重 = 掉 ≥2pt；负资产 = 替换后反而升。
 *
 * 用法: node scratch/zcode-1106/def-utility-b1.mjs [rounds=20]
 * 输出: scratch/zcode-1106/def-utility-b1.tsv（幂等追加由调用方管；本台每次整表重写 + 控制台增量）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { EXAM_POOL } from '../../server/opp-pool.mjs';
import { planN } from '../../tools/exam-pool.mjs';

const W = sandbox();
const T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
const ROUNDS = Number(process.argv[2] || 20);
const OUT = 'scratch/zcode-1106/def-utility-b1.tsv';

/* 样本：P̄₄ 前 5（页面剂量尺）+ 三个防御味的池成员（保留防御的代表）——路径来自 coords-gen3-1105 */
const SAMPLE = [
  ['Q-s47', 'docs/artifacts/e507-out/Q-s47.js'],
  ['U-s205', 'docs/artifacts/e539-out/U-s205.js'],
  ['eco-34-v7', 'docs/artifacts/eco-34-v7.bak'],
  ['T-s111', 'docs/artifacts/e521-out/T-s111.js'],
  ['G-s76', 'docs/artifacts/e514-out/G-s76.js'],
  ['DDEF-s13', 'docs/artifacts/2p0-pool/DDEF-s13.bak'],
  ['DEF-s16', 'docs/artifacts/2p0-pool/DEF-s16.bak'],
  ['COMBO-s13', 'docs/artifacts/2p0-pool/COMBO-s13.bak'],
];

const SK = R.SKILLS || R.skills || [];
const CAT = (key) => { const s = SK.find(x => x.key === key); return s ? s.cat : null; };
const DEF_KEYS = SK.filter(s => s.cat === 'defense').map(s => s.key);
console.log('[def-keys] ' + DEF_KEYS.join(' '));

/* 对手脚本（EXAM_POOL 28 席 → Bots 导出的 picker）——与 q-def-ablation 同一张表 */
const FN = {};
for (const e of EXAM_POOL) FN[e.name] = B[{ gunspam: 'pickGunSpam', gunfocus: 'pickGunFocus', aggro: 'pickAggro', earlypressure: 'pickEarlyPressure',
  guardspam: 'pickGuardSpam', wall: 'pickWall', protowall: 'pickProtoWall', baguaspam: 'pickBaguaSpam', reflectspam: 'pickReflectSpam',
  reflecttank: 'pickReflectTank', antidef: 'pickAntiDef', combocounter: 'pickComboCounter', deepsaver: 'pickDeepSaver', ringspam: 'pickRingSpam',
  beadburst: 'pickBeadBurst', heavyfire: 'pickHeavyFire', bigtfocus: 'pickBigTFocus', deadlineburst: 'pickDeadlineBurst', killsecure: 'pickKillSecure',
  mix: 'pickMix', reflectmix: 'pickReflectMix', guardgun: 'pickGuardGun', balanced: 'pickBalanced', targeter: 'pickTargeter', snipespam: 'pickSnipeSpam',
  random: 'pickRandom', mirrorspam: 'pickMirrorSpam', dualspam: 'pickDualSpam' }[e.name]];

function run(p, variantKey, n, mode, rounds) {
  const plan = planN(n, rounds, 77000);
  let first = 0, defSeen = 0, keySeen = 0, decisions = 0;
  const base = T.policyChooserN(p, 0.15);
  const sel = (state, pid, legal) => {
    decisions++;
    const k = base(state, pid, legal);
    const key = typeof k === 'string' ? k : (k && k.key);
    if (key && CAT(key) === 'defense') {
      defSeen++;
      if (key === variantKey || variantKey === '*') { keySeen++; return { key: R.SK.JI, target: null }; }   /* '*' = 全防御→集气 */
    }
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
  const G = plan.length, pw = first / G;
  return { p: pw, ex: (pw - 1 / n) / (1 - 1 / n), G, defShare: defSeen / (decisions || 1), keyShare: keySeen / (decisions || 1) };
}

/* 第一步：探每个样本实际用哪些防御键（200 局 5P 杂敌混合，只记账） */
const OPP_MIX = ['pickGunSpam', 'pickGuardSpam', 'pickDeepSaver', 'pickHeavyFire', 'pickMix', 'pickAggro', 'pickReflectSpam', 'pickWall'];
function usedDefKeys(p) {
  const S = W.EpirusState, Play = W.EpirusPlay;
  const cnt = {}; let tot = 0;
  for (let g = 0; g < 100; g++) {
    const st = S.createState('multi', { next: T.mulberry32(90000 + g) }, 5);
    const picks = [];
    const wrap = (i) => (state, pid, legal) => {
      const k = (i === 0) ? T.policyChooserN(p, 0.15)(state, pid, legal) : B[OPP_MIX[(g * 5 + i) % OPP_MIX.length]](state, pid, legal);
      if (i === 0) { const key = typeof k === 'string' ? k : (k && k.key); if (key) picks.push(key); }
      return k;
    };
    Play.autoGameN(st, [wrap(0), wrap(1), wrap(2), wrap(3), wrap(4)]);
    for (const key of picks) if (CAT(key) === 'defense') { cnt[key] = (cnt[key] || 0) + 1; tot++; }
  }
  return { cnt, tot };
}

const rows = [];
const HDR = 'id\tvariant\tn\tmode\tp\tex\tG\tdefShare\tkeyShare';
for (const [id, path] of SAMPLE) {
  if (!existsSync(path)) { console.log('⛔ ' + id + ' 文件不在：' + path); continue; }
  const p = loadChamp(W, path);
  const { cnt, tot } = usedDefKeys(p);
  const used = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 5);
  console.log('\n== ' + id + ' ==  防御出手 ' + tot + ' 次/100 局 ‖ 用的键: ' + used.map(k => k + ':' + cnt[k]).join(' ') || '(无)');
  const variants = ['base', '*'].concat(used);
  for (const v of variants) {
    for (const n of [2, 3, 5, 8]) {
      for (const mode of ['multi', 'long']) {
        const r = run(p, v === 'base' ? null : v, n, mode, ROUNDS);
        rows.push([id, v, n, mode, (r.p * 100).toFixed(2), r.ex.toFixed(4), r.G, (r.defShare * 100).toFixed(1) + '%', (r.keyShare * 100).toFixed(1) + '%'].join('\t'));
        process.stdout.write('.');
      }
    }
    console.log('  ' + id + ' v=' + v + ' 完成');
    writeFileSync(OUT, [HDR].concat(rows).join('\n') + '\n');   /* 每变体落一次盘 = 中断也有半张表 */
  }
}
console.log('\n写 ' + OUT + '（' + rows.length + ' 行）');
