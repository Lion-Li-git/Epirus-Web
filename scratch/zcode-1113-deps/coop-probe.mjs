#!/usr/bin/env node
/* coop-probe.mjs —— 配合剧本行为探针（夜6班）：每个剧本跑若干局，统计各角色实际出手谱，
 *   钉四件事：①藤甲贴上集火目标 ②坦克/天火吃藤甲加成集火 ③盾套给攒大招的人 ④挑衅阵全员打被钉的人。
 * 用法：node scratch/zcode-1113-deps/coop-probe.mjs [--games=3] [--n=5] [--seed=77000] [--subject=<pack路径|bot:pickRandom>]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { OPP_SPECS } from '../../training/server/opp-pool.mjs';
import { makeAsChooser } from '../../tools/bot-chooser-lib.mjs';
import { COOP_LINEUPS, coopSlots, makeRoleChooser } from '../../tools/exam-coop.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 3)) || 3;
const N = Number(arg('n', 5)) || 5;
const SEED = Number(arg('seed', 77000)) || 77000;
const SUBJECT = arg('subject', 'bot:pickAggro');

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const W = sb.window, P = W.EpirusPolicy, R0 = W.EpirusRules, T = W.EpirusTrainer, Bots = W.EpirusBots;
const asChooser = makeAsChooser({ T, R: R0 });
const FN = {};
for (const o of OPP_SPECS) FN[o.name] = Bots[o.fn];

function subjectChooser() {
  if (SUBJECT.startsWith('bot:')) return asChooser(Bots[SUBJECT.slice(4)]);
  const src = readFileSync(SUBJECT, 'utf8');
  const mm = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!mm) { console.error('⛔ 考生包读不出 EPIRUS_CHAMPION_3P: ' + SUBJECT); process.exit(2); }
  return T.policyChooserN(P.unpack(JSON.parse(mm[1]), true), 0.15);
}
const SUBJ = subjectChooser();
const SK = R0.SK;

/* 统计器：按剧本聚合 角色名→{key 计数, target 正确计数, target 总数} */
for (const lineup of COOP_LINEUPS) {
  const tally = {};   // role → {keys:{}, tgt:{ok:0,n:0}}
  let games = 0, subWins = 0, roundsSum = 0;
  for (let g = 0; g < GAMES; g++) {
    const seat = g % N;                      // 考生座轮换
    const teamPids = [];
    for (let pid = 0; pid < N; pid++) if (pid !== seat) teamPids.push(pid);
    const slots = coopSlots(lineup, teamPids, g);
    const choosers = [];
    let ti = 0;
    for (let pid = 0; pid < N; pid++) {
      if (pid === seat) { choosers.push(SUBJ); continue; }
      const s = slots[ti++];
      const role = s.kind === 'fn' ? s.name : s.role;
      const base = s.kind === 'fn' ? FN[s.name] : makeRoleChooser(s.role, { team: teamPids, foes: [seat] });
      tally[role] = tally[role] || { keys: {}, tgt: { ok: 0, n: 0 } };
      choosers.push(asChooser(function (state, pid2, legal) {
        const out = base(state, pid2, legal);
        const t = tally[role];
        const k = (typeof out === 'string') ? out : out.key;
        t.keys[k] = (t.keys[k] || 0) + 1;
        if (out && typeof out === 'object' && out.target != null) {
          t.tgt.n++;
          /* 目标正确性：剧本角色的攻击/贴系目标应落在考生席（套盾除外：目标应为队友） */
          if (['armor', 'gun', 'tank', 'sword', 'railgun', 'snipe', 'curse', 'taunt', 'bigT', 'cannon'].includes(k)) { if (out.target === seat) t.tgt.ok++; }
          if (k === 'holo') { if (out.target !== seat && teamPids.includes(out.target)) t.tgt.ok++; }
        }
        return out;
      }));
    }
    const gseed = SEED + lineup.name.length * 7919 + g * 977;
    const r = T.oneGameN(choosers, gseed, N, undefined);
    games++;
    roundsSum += r.state.round;
    if (T.rankOf(r.state, seat, gseed) === 1) subWins++;
  }
  const roleLines = Object.entries(tally).map(([role, t]) => {
    const keys = Object.entries(t.keys).sort((a, b) => b[1] - a[1]).map(([k, c]) => k + '×' + c).join(' ');
    const tgt = t.tgt.n ? ('目标正确 ' + t.tgt.ok + '/' + t.tgt.n) : '';
    return '    ' + role + ': ' + keys + (tgt ? ' ‖ ' + tgt : '');
  });
  console.log('[' + lineup.name + '] ' + lineup.label + ' ‖ ' + GAMES + ' 局 ‖ 考生夺1 ' + subWins + '/' + games + ' ‖ 均回合 ' + (roundsSum / games).toFixed(1));
  roleLines.forEach((l) => console.log(l));
}
console.log('\n⚑ SK 常量抽查: holo=' + SK.HOLO + ' armor=' + SK.ARMOR + ' firestorm=' + SK.FIRESTORM + ' bigT=' + SK.BIG_T + ' tank=' + SK.TANK);
