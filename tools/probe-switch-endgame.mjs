#!/usr/bin/env node
/* 2P / 多人残局换招探针：沿用 pool-skill-report 的 JS 定义，按模式与 alive=2 分层。 */
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, mulberry32, rejectUnknownFlags } from './audit-lib.mjs';
import { hpEpBucket, jsDiv, entropy, switchRate, nonJiSwitchRate, bucketJs } from './switch-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
rejectUnknownFlags(process.argv.slice(2), ['packs', 'games', 'seeds', 'contexts', 'opponents', 'real', 'out', 'jobs', 'temp', 'quiet', 'single'], 'probe-switch-endgame');
const PACKS = String(arg('packs', [
  'docs/artifacts/FS-G2.bak', 'docs/artifacts/RG-CN.bak',
  'scratch/arms/nov24-shapeW-fsg2-w1-s20261031.bak', 'scratch/arms/nov24-shapeW-fsg2-w2-s20261031.bak',
  'scratch/arms/nov24-shapeW-rgcn-w1-s20261031.bak', 'scratch/arms/nov24-shapeW-rgcn-w2-s20261031.bak',
].join(','))).split(',').map((s) => s.trim()).filter(Boolean);
const GAMES = Math.max(10, Number(arg('games', 40)) || 40);
const SEEDS = String(arg('seeds', '4100,21000')).split(',').map(Number).filter(Number.isFinite);
const CONTEXTS = String(arg('contexts', '2:standard,3:multi,4:multi4,5:multi,5:long,8:multi')).split(',').map((s) => {
  const m = /^(\d+):([a-z0-9]+)$/i.exec(s.trim());
  if (!m) throw new Error('context 要 n:mode：' + s);
  return { n: Number(m[1]), mode: m[2], key: m[1] + ':' + m[2] };
});
const REGIMES = String(arg('opponents', 'script,real')).split(',').filter((s) => s === 'script' || s === 'real');
const REAL = String(arg('real', 'docs/artifacts/FC-G1.bak'));
const OUT = resolve(ROOT, arg('out', 'scratch/switch-endgame-1124'));
const JOBS = Math.max(1, Math.min(Number(arg('jobs', 2)) || 2, 8));
const TEMP = Number(arg('temp', 0.15)) || 0.15;
const QUIET = process.argv.includes('--quiet');
const say = (s) => { if (!QUIET) console.log(s); };

if (jsDiv({ a: 1 }, { a: 1 }) !== 0 || jsDiv({ a: 1 }, { b: 1 }) !== 1 || entropy({ a: 1, b: 1 }) !== 1
  || switchRate(['a', 'a', 'b']) !== 0.5 || nonJiSwitchRate([['gun', 'gun']]) !== 0
  || nonJiSwitchRate([['ji', 'gun', 'ji', 'sword']]) !== 1) {
  throw new Error('switch-lib 自检失败');
}
mkdirSync(OUT, { recursive: true });
const nameOf = (p) => p.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/i, '');

function newPhase() { return { keys: {}, buckets: {}, sequences: [], acts: 0, games: 0, wins: 0, rounds: 0, hp: 0, ep: 0 }; }
function newCell() { return { mid: newPhase(), endgame: newPhase(), duel: newPhase() }; }
function addPick(cell, phase, state, pid, pick) {
  const p = cell[phase];
  const k = pick && pick.key || 'none';
  p.keys[k] = (p.keys[k] || 0) + 1;
  const bk = hpEpBucket(state, pid);
  p.buckets[bk] = p.buckets[bk] || {};
  p.buckets[bk][k] = (p.buckets[bk][k] || 0) + 1;
  p.acts++;
  p.hp += state.p[pid].hp || 0;
  p.ep += state.p[pid].ep || 0;
  if (!p._gameKeys) p._gameKeys = [];
  p._gameKeys.push(k);
}
function closeGame(p, st, seat) {
  p.rounds += st.round;
  if (st.winner === seat) p.wins++;
}

function mergeCells(cells) {
  const out = newCell();
  for (const c of cells) for (const ph of ['mid', 'endgame', 'duel']) {
    const a = c[ph], b = out[ph];
    for (const k in a.keys) b.keys[k] = (b.keys[k] || 0) + a.keys[k];
    for (const bk in a.buckets) {
      b.buckets[bk] = b.buckets[bk] || {};
      for (const k in a.buckets[bk]) b.buckets[bk][k] = (b.buckets[bk][k] || 0) + a.buckets[bk][k];
    }
    for (const seq of a.sequences) b.sequences.push(seq);
    b.acts += a.acts; b.games += a.games; b.wins += a.wins; b.rounds += a.rounds; b.hp += a.hp; b.ep += a.ep;
  }
  return out;
}
function phaseSummary(p) {
  const transitions = p.sequences.reduce((s, seq) => s + Math.max(0, seq.length - 1), 0);
  const changes = p.sequences.reduce((s, seq) => s + Math.max(0, seq.length - 1) * (switchRate(seq) || 0), 0);
  const nonJi = {};
  for (const seq of p.sequences) for (const k of seq) {
    if (k === 'ji') continue;
    nonJi[k] = (nonJi[k] || 0) + 1;
  }
  const nonJiActs = Object.values(nonJi).reduce((a, b) => a + b, 0);
  return { acts: p.acts, games: p.games, distinct: Object.keys(p.keys).filter((k) => p.keys[k] > 0).length,
    entropy: p.acts ? entropy(p.keys) : null, switchRate: transitions ? changes / transitions : null,
    nonJiActs, nonJiEntropy: nonJiActs ? entropy(nonJi) : null,
    nonJiSwitchRate: nonJiSwitchRate(p.sequences),
    jiPct: p.acts ? 100 * (p.keys.ji || 0) / p.acts : null,
    winPct: p.games ? 100 * p.wins / p.games : null, rounds: p.games ? p.rounds / p.games : null,
    hp: p.acts ? p.hp / p.acts : null, ep: p.acts ? p.ep / p.acts : null };
}

function runPack(pack) {
  const W = sandbox(ROOT);
  const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
  const params = loadChamp(W, pack);
  if (!params) throw new Error('读不出包：' + pack);
  const realParams = REGIMES.includes('real') ? loadChamp(W, REAL) : null;
  if (REGIMES.includes('real') && !realParams) throw new Error('读不出真包对手：' + REAL);
  const chooser = T.policyChooserN(params, TEMP, 0);
  const realChooser = realParams ? T.policyChooserN(realParams, TEMP, 0) : null;
  const scripts = [B.pickBalanced, B.pickAggro, B.pickDefend, B.pickMix, B.pickFarmer];
  const byRegime = {};
  for (const regime of REGIMES) {
    byRegime[regime] = {};
    for (const ctx of CONTEXTS) {
      byRegime[regime][ctx.key] = {};
      for (const seed of SEEDS) {
        const cell = newCell();
        for (let g = 0; g < GAMES; g++) {
          if (typeof B.resetBotMem === 'function') B.resetBotMem();
          const seat = g % ctx.n;
          const gseed = seed + g * 997;
          const st = S.createState(ctx.mode, { next: mulberry32(gseed) }, ctx.n);
          st.slotSalt = (gseed * 2246822519) >>> 0;
          const cs = [];
          for (let pid = 0; pid < ctx.n; pid++) {
            if (pid === seat) {
              cs.push(function (state, id, legal) {
                const alive = state.p.filter((q) => q.hp > 0).length;
                const phase = ctx.n === 2 ? 'duel' : (alive <= 2 ? 'endgame' : 'mid');
                const got = chooser(state, id, legal);
                addPick(cell, phase, state, id, got);
                return got;
              });
            } else if (regime === 'real') cs.push(realChooser);
            else cs.push(T.wrapBotN(scripts[(pid + g) % scripts.length]));
          }
          Play.autoGameN(st, cs);
          for (const ph of ['mid', 'endgame', 'duel']) {
            const p = cell[ph];
            if (p._gameKeys && p._gameKeys.length) {
              p.sequences.push(p._gameKeys);
              p.games++;
              closeGame(p, st, seat);
            }
            p._gameKeys = null;
          }
        }
        byRegime[regime][ctx.key][seed] = cell;
      }
    }
  }
  const agg = {};
  for (const regime of REGIMES) {
    agg[regime] = {};
    for (const ctx of CONTEXTS) agg[regime][ctx.key] = mergeCells(SEEDS.map((s) => byRegime[regime][ctx.key][s]));
  }
  const comparisons = {};
  for (const regime of REGIMES) {
    const duel = agg[regime]['2:standard'];
    comparisons[regime] = { twoPvsEndgame: {}, midVsEndgame: {} };
    for (const ctx of CONTEXTS) {
      if (ctx.n <= 2) continue;
      const c = agg[regime][ctx.key];
      comparisons[regime].twoPvsEndgame[ctx.key] = bucketJs(duel.duel.buckets, c.endgame.buckets, 30);
      comparisons[regime].midVsEndgame[ctx.key] = bucketJs(c.mid.buckets, c.endgame.buckets, 30);
    }
  }
  if (REGIMES.includes('script') && REGIMES.includes('real')) {
    comparisons.scriptVsReal = {};
    for (const ctx of CONTEXTS) for (const ph of ['mid', 'endgame', 'duel']) {
      comparisons.scriptVsReal[ctx.key + ':' + ph] = bucketJs(agg.script[ctx.key][ph].buckets, agg.real[ctx.key][ph].buckets, 30);
    }
  }
  const phases = {};
  for (const regime of REGIMES) for (const ctx of CONTEXTS) {
    phases[regime + '|' + ctx.key] = {};
    for (const ph of ['mid', 'endgame', 'duel']) phases[regime + '|' + ctx.key][ph] = phaseSummary(agg[regime][ctx.key][ph]);
  }
  return { pack, name: nameOf(pack), games: GAMES, seeds: SEEDS, contexts: CONTEXTS, regimes: REGIMES, real: REAL,
    phases, comparisons, byRegime };
}

function runJob(pack) {
  return new Promise((resolve, reject) => {
    const file = join(OUT, nameOf(pack) + '.json');
    const fd = openSync(file, 'w');
    const cp = spawn(process.execPath, [join('tools', 'probe-switch-endgame.mjs'), '--packs=' + pack, '--games=' + GAMES,
      '--seeds=' + SEEDS.join(','), '--contexts=' + CONTEXTS.map((c) => c.key).join(','), '--opponents=' + REGIMES.join(','),
      '--real=' + REAL, '--temp=' + TEMP, '--quiet', '--single'], { cwd: ROOT, stdio: ['ignore', fd, fd] });
    cp.on('exit', (code) => {
      closeSync(fd);
      if (code !== 0) { reject(new Error(nameOf(pack) + ' exit=' + code)); return; }
      try { resolve(JSON.parse(readFileSync(file, 'utf8'))); } catch (e) { reject(e); }
    });
  });
}

if (process.argv.includes('--single')) {
  const result = runPack(PACKS[0]);
  process.stdout.write(JSON.stringify(result, null, 2));
  process.exit(0);
}

let cursor = 0;
const results = [];
async function worker() { while (cursor < PACKS.length) { const p = PACKS[cursor++]; say('START ' + nameOf(p)); results.push(await runJob(p)); say('DONE ' + nameOf(p)); } }
Promise.all(Array.from({ length: Math.min(JOBS, PACKS.length) }, worker)).then(() => {
  results.sort((a, b) => PACKS.indexOf(a.pack) - PACKS.indexOf(b.pack));
  const rows = [];
  for (const r of results) {
    rows.push({ pack: r.name, path: r.pack,
      duelActs: r.phases['script|2:standard'].duel.acts,
      duelEntropy: r.phases['script|2:standard'].duel.entropy,
      duelSwitch: r.phases['script|2:standard'].duel.switchRate,
      duelNonJiSwitch: r.phases['script|2:standard'].duel.nonJiSwitchRate,
      end5Acts: r.phases['script|5:multi'].endgame.acts,
      end5Entropy: r.phases['script|5:multi'].endgame.entropy,
      end5Switch: r.phases['script|5:multi'].endgame.switchRate,
      end5NonJiSwitch: r.phases['script|5:multi'].endgame.nonJiSwitchRate,
      js2vs5: r.comparisons.script.twoPvsEndgame['5:multi'].js,
      jsMidEnd5: r.comparisons.script.midVsEndgame['5:multi'].js,
      js2vs5Long: r.comparisons.script.twoPvsEndgame['5:long'].js,
      jsMidEnd5Long: r.comparisons.script.midVsEndgame['5:long'].js,
      jsScriptReal5End: r.comparisons.scriptVsReal && r.comparisons.scriptVsReal['5:multi:endgame'].js });
  }
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify({ finishedAt: new Date().toISOString(), results }, null, 2));
  const head = ['pack','path','duelActs','duelEntropy','duelSwitch','duelNonJiSwitch','end5Acts','end5Entropy','end5Switch','end5NonJiSwitch','js2vs5','jsMidEnd5','js2vs5Long','jsMidEnd5Long','jsScriptReal5End'];
  writeFileSync(join(OUT, 'summary.tsv'), head.join('\t') + '\n' + rows.map((r) => head.map((k) => r[k] == null ? '' : r[k]).join('\t')).join('\n') + '\n');
  say('SWITCH_ENDGAME_DONE packs=' + results.length);
  process.exit(0);
}).catch((e) => { console.error(e && e.stack || e); process.exit(2); });
