
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js',
  'js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, B = sb.EpirusBots, S = sb.EpirusState, R = sb.EpirusRules, Play = sb.EpirusPlay;
const ATK = new Set(R.ATK_EFFECT || []);
const isAtk = (k) => !!(k && ATK.has(k));
const POOL = ['pickGunSpam','pickGuardSpam','pickDeepSaver','pickHeavyFire','pickSnipeSpam','pickMix','pickAggro',
  'pickReflectTank','pickBigTFocus','pickKillSecure','pickDeadlineBurst','pickEarlyPressure','pickDualSpam','pickMirrorSpam',
  'pickAntiDef','pickBreakDef','pickComboCounter','pickRingSpam','pickTargeter','pickBalanced'];
/* 每决策记录：该 pid 本回合选了什么 + 决策时刻的公共快照（lastSkill / ep / hp / 是否 maxEp） */
const rows = [];
function run(G) {
  for (let g = 0; g < G; g++) {
    const st = S.createState('multi', { next: T.mulberry32(99000 + g) }, 5);
    const snap = {};
    const mk = (i) => (state, pid, legal) => {
      if (!snap[state.round]) {
        snap[state.round] = state.p.map((p) => ({ last: p.lastSkill, ep: p.ep, hp: p.hp }));
      }
      const k = B[POOL[(g * 5 + i) % POOL.length]](state, pid, legal);
      const key = typeof k === 'string' ? k : (k && k.key);
      const s = snap[state.round][pid];
      let mxEp = -Infinity, maxPid = -1;
      for (let j = 0; j < state.p.length; j++) if (j !== pid && state.p[j].hp > 0) { if (state.p[j].ep > mxEp) { mxEp = state.p[j].ep; maxPid = j; } }
      rows.push({ last: s.last, atk: isAtk(key) ? 1 : 0, lastWasCharge: s.last === R.SK.CHARGE ? 1 : 0, lastWasAtk: isAtk(s.last) ? 1 : 0, ep: s.ep, maxEp: mxEp });
      return k;
    };
    Play.autoGameN(st, [mk(0), mk(1), mk(2), mk(3), mk(4)]);
  }
}
run(Number(process.env.G || 600));
const rate = (f) => { const a = rows.filter(f); const n = a.length; const k = a.filter(r => r.atk).length; return { n, p: n ? k / n : 0 }; };
console.log('样本行数 ' + rows.length);
const dist = {}; for (const r of rows) { const k = String(r.last); dist[k] = (dist[k]||0)+1; }
console.log('lastSkill 分布（前 10）：', Object.entries(dist).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>k+':'+v).join('  '));
console.log('CHARGE 常量 =', R.SK.CHARGE, ' 样本里 last===CHARGE 的行数 =', rows.filter(r=>r.lastWasCharge).length);
for (const [nm, f] of [
  ['上回合=蓄能', r => r.lastWasCharge === 1],
  ['上回合=攻击招', r => r.lastWasAtk === 1],
  ['上回合=非攻击非蓄能', r => !r.lastWasCharge && !r.lastWasAtk],
  ['ep 最高者', r => r.maxEp > 0 && r.ep === r.maxEp],
  ['ep>=5', r => r.ep >= 5],
  ['ep<=1', r => r.ep <= 1],
  ['全体', () => true],
]) { const { n, p } = rate(f); console.log(('  ' + nm).padEnd(22) + 'n=' + String(n).padStart(5) + '  本回合出手是攻击招 = ' + (p * 100).toFixed(1) + '%'); }