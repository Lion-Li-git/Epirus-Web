/* Epirus 诊断：训练冠军 → 对阵混合/基准对手，落盘完整对局与退化循环检测。
 * 产物：docs/debug/champion-run.txt（首个完整对局录）+ 控制台汇总。
 * 用法：node tools/diag.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const sb = { console, Math, JSON, Object, Array, Number, String, Error,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/evo.js','js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(join(root, f), 'utf8'), sb, { filename: f });
}
const R = sb.EpirusRules, P = sb.EpirusPolicy, T = sb.EpirusTrainer, Bots = sb.EpirusBots;
const Play = sb.EpirusPlay, S = sb.EpirusState, X = sb.EpirusResolve;

/* v1.5.18（第三方复核 §5-2）：本脚本是**第 6 个训练入口**（`T.makeTrainer` 调用点之一），
 * 此前既不在 REPRO 的扫描表里、也不在 REPRO2 的名单里，而且**完全没播种** ⇒
 * 每次跑出来的诊断对局都不一样（"同一现象复现不了"就是这么来的）。
 * 与其它入口用同一套播种：policy 的 randn + 沙箱 Math。 */
const DIAG_SEED = Number(process.env.EPIRUS_SEED || 1);
if (P.setRng && T.mulberry32) P.setRng(T.mulberry32(DIAG_SEED * 7919 + 13));
__seedSandbox(sb, DIAG_SEED);
function __seedSandbox(sbox, seed) {
  if (!seed) return;
  const M = Object.create(Math);
  let s = (seed >>> 0) || 1;
  M.random = function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  sbox.Math = M;
}

const trainer = T.makeTrainer({ popSize: 16, gamesPerOpp: 6 });
for (let g = 0; g < 150; g++) T.step(trainer);
const champ = trainer.champion;

function champPick(state, pid, legal) {
  const base = legal.filter(l => l.affordable);
  const baseL = base.length ? base : [{ key: R.SK.JI, affordable: true }];
  return T.pickChampion(state, pid, baseL, champ, 0.6);   // v7：候选感知
}

// 完全复刻 ui.js 的困难难度出招：冠军采样 + 45%进攻倾向 + 连招防护
function makeHard(history) {
  return function (state, pid, legal) {
    const base = legal.filter(l => l.affordable);
    const baseL = base.length ? base : [{ key: R.SK.JI, affordable: true }];
    /* 注意：这条诊断路径是**键口径**（下面按 key 做连招/进攻倾向判断）⇒ 只取 .key，
     * 珠类型与目标丢失；要看 v7 冠军真实行为请用 champ-audit / eval-5p。 */
    const greedy = T.pickChampion(state, pid, baseL, champ, 0.6).key;
    const aff = baseL.filter(l => R.ATK_EFFECT.indexOf(l.key) >= 0);
    let chosen = greedy;
    if (R.ATK_EFFECT.indexOf(chosen) < 0 && aff.length && Math.random() < 0.45) {
      chosen = aff[Math.floor(Math.random() * aff.length)].key;
    }
    if (history.length >= 3 && history.slice(-3).every(k => k === chosen)) {
      const others = baseL.filter(l => l.key !== chosen);
      if (others.length) chosen = others[Math.floor(Math.random() * others.length)].key;
    }
    history.push(chosen); if (history.length > 8) history.shift();
    return chosen;
  };
}

function categoryOf(k){ return k ? R.byKey[k].cat : '?'; }

function analyze(opp, label, games, dumpFile) {
  const dist = { energy: 0, attack: 0, defense: 0, special: 0 };
  let choices = 0, loansP0 = 0, wins = 0, draws = 0, losses = 0;
  let maxRun = 0, curRun = 0, lastKey = null, dumpLines = [];
  let dumped = false;

  for (let g = 0; g < games; g++) {
    const st = S.createState('standard', { next: T.mulberry32(100000 + g) });
    const gameLines = [];
    let run = 0, prev = null;
    Play.autoGame(st, (state, pid, legal) => {
      const k = champPick(state, pid, legal);
      const def = R.byKey[k];
      if (def) { dist[def.cat]++; choices++; }
      if (k === prev) run++; else run = 1;
      prev = k; if (run > maxRun) maxRun = run;
      gameLines.push(`R${state.round} 你HP${state.p[0].hp} 你ジ${state.p[0].ep} 你last=${state.p[0].lastSkill||'-'} 你出=${def?def.name:k} | 电脑HP${state.p[1].hp} 电脑ジ${state.p[1].ep} 电脑last=${state.p[1].lastSkill||'-'}`);
      return k;
    }, opp);
    for (const e of st.events) if (e.type === 'loan' && e.pid === 0) loansP0++;
    if (st.winner === 0) wins++; else if (st.winner === 'draw') draws++; else losses++;
    if (!dumped && dumpFile) {
      dumpLines = ['=== 冠军 vs ' + label + ' 完整对局录（种子 ' + (100000 + g) + '）===\n' +
        '结果:' + (st.winner === 0 ? '你(冠军)胜' : st.winner === 'draw' ? '平局' : '对手胜') + ' 回合=' + st.round + '\n'];
      dumpLines = dumpLines.concat(gameLines.map((l, i) => `第${i + 1}回合: ${l}`));
      dumped = true;
    }
  }
  const share = choices ? ((dist.attack / choices) * 100).toFixed(0) : '0';
  console.log(`\n[${label}] 胜${wins} 平${draws} 负${losses} → 胜率 ${(wins / games * 100).toFixed(0)}% | 攻击占比 ${share}% | 贷款P0 ${loansP0} | 最长连招 ${maxRun}`);
  console.log('   出招类别分布:', JSON.stringify(dist), '/', choices);
  return { dumpLines };
}

const res1 = analyze(Bots.pickMix, 'mix(混合随机风格)', 120, true);
const res2 = analyze(Bots.pickBalanced, 'balanced(均衡)', 120, false);
const res3 = analyze(Bots.pickBreakDef, 'breakdef(破防)', 120, false);

const outDir = join(root, 'docs', 'debug');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'champion-run.txt'),
  'Epirus 冠军诊断\n训练 150 代 (pop16, gamesPerOpp6, 含 mix 对手)\n\n' +
  (res1.dumpLines || []).join('\n') + '\n', 'utf8');
console.log('\n已落盘完整对局录 → docs/debug/champion-run.txt');
console.log('（冠军 action 分布里 attack 占比越高越“主动进攻”；最长连招越大越接近单调循环）');
