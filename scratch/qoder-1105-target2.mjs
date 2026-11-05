/* target2 覆盖取证（Qoder · 11-05）
 * 两问：
 *  ① 改完之后，今天的行为到底变不变？（成对：同一枚包、同一串种子，arm A=evo.js@HEAD 的兜底 vs arm B=工作树的听网络）
 *  ② 如果不变，那"网络想要的第二目标"是不是本来就和兜底重合？（探针不改行为：只打分、不抽随机数，
 *     并自证——带探针跑一遍与不带探针跑一遍的动作序列必须逐手相同）
 */
import { sandbox, ROOT } from '../tools/audit-lib.mjs';
import { loadChamp } from '../tools/audit-lib.mjs';
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const T = join(ROOT, 'scratch/qoder-1105-target2-arms');
rmSync(T, { recursive: true, force: true });
for (const arm of ['A', 'B']) {
  mkdirSync(join(T, arm, 'js'), { recursive: true });
  cpSync(join(ROOT, 'js/core'), join(T, arm, 'js/core'), { recursive: true });
  cpSync(join(ROOT, 'js/train'), join(T, arm, 'js/train'), { recursive: true });
  cpSync(join(ROOT, 'js/pool-draw.js'), join(T, arm, 'js/pool-draw.js'));
}
/* A 臂 = HEAD 那份 evo.js（兜底覆盖 target2）；其余文件两臂相同 ⇒ 差别只在这一处 */
const headEvo = execSync('git show HEAD:js/train/evo.js', { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
writeFileSync(join(T, 'A', 'js', 'train', 'evo.js'), headEvo);
const same = createHash('sha1').update(readFileSync(join(T, 'B', 'js', 'train', 'evo.js'), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 8)
  !== createHash('sha1').update(headEvo.replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);
console.log('== 夹具自证 ==');
console.log('   A 臂 evo.js = HEAD ‖ B 臂 = 工作树 ‖ 两者不同=' + same + '（相同⇒补丁没落上，后面全废）');

const WA = sandbox(join(T, 'A')), WB = sandbox(join(T, 'B'));
console.log('   A 臂里 pickTarget2N 仍被无条件调用？' + (/target2: pickTarget2N\(state, pid, pick.key, shipTarget\)/.test(readFileSync(join(T, 'A', 'js', 'train', 'evo.js'), 'utf8')) ? '是（兜底）' : '否'));
console.log('   B 臂里有 honor 分支？' + (/shipT2 = pick\.target2/.test(readFileSync(join(T, 'B', 'js', 'train', 'evo.js'), 'utf8')) ? '是' : '否'));

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 120));

/* ---- ① 成对对局：行为变不变 ---- */
function traceOf(W, params, seed, n, mode) {
  const Tt = W.EpirusTrainer, Play = W.EpirusPlay, S = W.EpirusState;
  const c = Tt.policyChooserN(params, 0);
  const out = [];
  const wrap = (f) => (st, pid, legal) => { const a = f(st, pid, legal); out.push(pid + ':' + a.key + '/' + a.target + '/' + a.target2); return a; };
  const st = S.createState(mode, { next: Tt.mulberry32(seed) }, n);
  st.slotSalt = Tt.mulberry32(seed)() * 4294967296 >>> 0;
  Play.autoGameN(st, [wrap(c), wrap(c), wrap(c), wrap(c), wrap(c)].slice(0, n));
  return { trace: out, rounds: st.round, winner: st.winner, dual: out.filter((s) => /dualGun|mirror/.test(s)).length };
}
const packs = [];
const v7 = loadChamp(WB, 'js/bundled-champion-3p.js', '');
if (v7) packs.push({ id: '线上 v7(3P)', paramsB: v7, paramsA: loadChamp(WA, 'js/bundled-champion-3p.js', '') });
for (const p of [['L5-1200-s13', 'scratch/night5/bands/L51200s13/L5-1200-s13-band1.bak'], ['D1200-s13', 'scratch/night5/bands/D1200s13/D1200-s13-band1.bak'], ['D-a-s13', 'scratch/night4/bands/D-a/D-a-s13-band1.bak']]) {
  const txt = readFileSync(join(ROOT, p[1]), 'utf8');
  const o = JSON.parse(/EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(txt)[1]);
  const b = WB.EpirusPolicy.loadGame(o), a = WA.EpirusPolicy.loadGame(o);
  if (b && a) packs.push({ id: p[0] + '(2.0)', paramsB: b, paramsA: a });
  else console.log('   ⚠ ' + p[0] + ' 读不出：B=' + !!b + ' A=' + !!a);
}
console.log('\n== ① 成对对局（' + GAMES + ' 局/臂 · 5 人 multi · 同种子 · ε=0） ==');
for (const pk of packs) {
  let diffAt = -1, dualHands = 0, totActions = 0, roundsB = 0, roundsA = 0, winB = 0;
  for (let g = 0; g < GAMES; g++) {
    const seed = 77000 + g * 7;
    const A = traceOf(WA, pk.paramsA, seed, 5, 'multi');
    const B = traceOf(WB, pk.paramsB, seed, 5, 'multi');
    dualHands += B.dual; totActions += B.trace.length; roundsA += A.rounds; roundsB += B.rounds; if (B.winner === 0) winB++;
    if (diffAt < 0) { const i = A.trace.findIndex((v, k) => v !== B.trace[k]); if (i >= 0) diffAt = i; }
  }
  console.log('   ' + (pk.id + '            ').slice(0, 14) + '双枪/镜面出手 ' + dualHands + '/' + totActions + ' 手 ‖ 双臂第一处分叉 ' +
    (diffAt < 0 ? '（无分叉 ⇒ 今天零行为变化）' : '第 ' + diffAt + ' 手') + ' ‖ 均回合 A=' + (roundsA / GAMES).toFixed(1) + ' B=' + (roundsB / GAMES).toFixed(1));
}

/* ---- ② 网络想要的第二目标 vs 兜底会给的那个 ---- */
console.log('\n== ② 双枪在菜单里时，网络想要的第二目标 vs 兜底（=索引最小的存活对手） ==');
{
  const W = WB, P = W.EpirusPolicy, Tt = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules;
  const stats = { points: 0, spreadSum: 0, spreadMax: 0, agree: 0, differ: 0, byKey: {}, probeChanged: 0, noScore: 0 };
  function probe(Wx, params, mode, n, games, withProbe) {
    const seq = [];
    const c = Tt.policyChooserN(params, 0);
    const wrap = (f) => (st, pid, legal) => {
      if (withProbe && pid === 0) {
        const du = legal.filter((l) => l.key === R.SK.DUAL_GUN && l.affordable);
        if (du.length) {
          const all = P.candidatesFor(st, pid, legal, {});
          const pairs = all.filter((cd) => cd.key === R.SK.DUAL_GUN && cd.target != null && cd.target2 != null);
          if (pairs.length >= 2) {
            const sc = P.forwardCands(st, pid, pairs, params, { temp: 0.15 });
            /* v7 那台 forwardCands 只回 {probs,argmax,cand}，2.0 那台才带 logits ⇒ 两档都用可比的分数层 */
            const vs = Array.from(sc.logits || sc.probs || []);
            if (!vs.length) { stats.noScore++; return; }
            const best = pairs[vs.indexOf(Math.max(...vs))];
            const fallbackList = S.opponentsOf(st, pid).filter((o) => o !== best.target);
            const fb = fallbackList.length ? fallbackList[0] : null;
            stats.points++;
            stats.spreadSum += (Math.max(...vs) - Math.min(...vs));
            stats.spreadMax = Math.max(stats.spreadMax, Math.max(...vs) - Math.min(...vs));
            if (best.target2 === fb) stats.agree++; else stats.differ++;
            byKeyNote(best, fb, pairs.length);
          }
        }
      }
      const a = f(st, pid, legal); seq.push(pid + ':' + a.key + '/' + a.target + '/' + a.target2); return a;
    };
    const cs = []; for (let i = 0; i < n; i++) cs.push(wrap(c));
    for (let g = 0; g < games; g++) {
      const st = S.createState(mode, { next: Tt.mulberry32(5000 + g) }, n);
      for (let i = 0; i < n; i++) st.p[i].ep = 12;   // 反事实给资源：只在决策前开，测的是能力不是成绩
      st.slotSalt = (5000 + g) >>> 0;
      Play.autoGameN(st, cs);
    }
    return seq;
  }
  const seen = {};
  function byKeyNote(best, fb, npairs) {
    seen['t1=' + best.target + ' 网络要 t2=' + best.target2 + ' ‖ 兜底给 t2=' + fb] = (seen['t1=' + best.target + ' 网络要 t2=' + best.target2 + ' ‖ 兜底给 t2=' + fb] || 0) + 1;
    seen.__npairs = npairs;
  }
  for (const pk of packs) {
    const plain = probe(WB, pk.paramsB, 'multi', 5, 12, false);
    const withp = probe(WB, pk.paramsB, 'multi', 5, 12, true);
    if (plain.join('|') !== withp.join('|')) stats.probeChanged++;
    else if (stats.points === 0) { /* 无决策点也算 */ }
  }
  console.log('   采集到「双枪在菜单且可付」的决策点：' + stats.points + ' 个（' + packs.length + ' 枚包 × 12 局 × 5 人 · 反事实把 ep 抬到 12）‖ 打分空返回 ' + stats.noScore + ' 次');
  if (stats.points) {
    console.log('   成对候选个数：' + seen.__npairs + ' ‖ 各对分数跨度均值 ' + (stats.spreadSum / stats.points).toFixed(1) + ' ‖ 最大 ' + stats.spreadMax.toFixed(1) + '（>0 ⇒ 网络分得出第二目标）');
    console.log('   网络想要的第二目标 == 兜底那个：' + stats.agree + ' 次 ‖ 不同：' + stats.differ + ' 次（不同率 ' + (100 * stats.differ / Math.max(1, stats.points)).toFixed(0) + '%）');
    console.log('   样本：' + Object.entries(seen).filter(([k]) => k !== '__npairs').slice(0, 4).map(([k, v]) => k + ' ×' + v).join('  ‖  '));
  }
  console.log('   探针非侵入自证：带探针/不带探针的动作序列不同的包 ' + stats.probeChanged + '/' + packs.length + '（必须 0，否则上面全是探针造出来的）');
}
