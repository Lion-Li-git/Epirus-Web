import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, loadChamp, mulberry32 } from '../../../tools/audit-lib.mjs';
import { OPP_SPECS } from '../../../training/server/opp-pool.mjs';

const ROOT = process.cwd();
const OUT = ROOT + '/docs/research/evidence-2026-11-26-value-coverage';
const PACKS = [
  { id: 'DR-R3E', path: 'docs/artifacts/DR-R3E.bak' },
  { id: 'MX8-R6C-KL', path: 'docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak' },
  { id: 'FC-G1', path: 'docs/artifacts/FC-G1.bak' },
];
const SKILLS = ['charge', 'gun', 'sword', 'guard', 'reflect', 'bagua', 'snipe', 'curse', 'firestorm', 'holo'];
const OPPONENTS = ['gunspam', 'wall', 'heavyfire', 'balanced'];
const N = Number(process.env.A2_N || 100), R = Number(process.env.A2_R || 4), SEED_SETS = [95001, 95002], MAX_GAMES = Number(process.env.A2_MAX_GAMES || 600);
const DEAD_GAMES = Number(process.env.A2_DEAD_GAMES || 400), DEAD_R = Number(process.env.A2_DEAD_R || 4);
const POS_GAMES = Number(process.env.A2_POS_GAMES || 40);

function samplePack(W, params, targets, seedSet) {
  const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, B = W.EpirusBots;
  const base = T.policyChooserN(params, 0.15);
  const opp = OPPONENTS.map((name) => T.wrapBotN(B[OPP_SPECS.find((o) => o.name === name).fn]));
  const samples = Object.fromEntries(targets.map((k) => [k, []]));
  for (let g = 0; g < MAX_GAMES; g++) {
    const seed = (seedSet + g * 977) >>> 0;
    const st = S.createState('multi', { next: mulberry32(seed) }, 5);
    st.slotSalt = (seed * 2246822519) >>> 0;
    const seat = g % 5, seen = new Set();
    const wrapped = (state, pid, legal) => {
      const pick = base(state, pid, legal);
      const key = pick && pick.key;
      if (pid === seat && targets.includes(key) && !seen.has(key) && samples[key].length < N) {
        const snap = S.cloneState(state);
        snap.rng = null;
        samples[key].push({ state: snap, pick: { ...pick }, seat, game: g });
        seen.add(key);
      }
      return pick;
    };
    const choosers = Array.from({ length: 5 }, (_, pid) => pid === seat ? wrapped : opp[pid < seat ? pid : pid - 1]);
    Play.autoGameN(st, choosers);
    if (targets.every((k) => samples[k].length >= N)) break;
  }
  return samples;
}

function runBranch(W, params, sample, key, mode, seed) {
  const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, B = W.EpirusBots;
  const st = S.cloneState(sample.state);
  st.rng = { next: mulberry32(seed) };
  const base = T.policyChooserN(params, 0.15);
  const opp = OPPONENTS.map((name) => T.wrapBotN(B[OPP_SPECS.find((o) => o.name === name).fn]));
  let first = true;
  const wrapped = (state, pid, legal) => {
    if (first) {
      first = false;
      if (mode === 'original') return sample.pick;
      const alt = legal.filter((l) => l.key !== key);
      if (!alt.length) throw new Error('no alternative for ' + key);
      return base(state, pid, alt);
    }
    return base(state, pid, legal);
  };
  const choosers = Array.from({ length: 5 }, (_, pid) => pid === sample.seat ? wrapped : opp[pid < sample.seat ? pid : pid - 1]);
  Play.autoGameN(st, choosers);
  return 5 - T.rankOf(st, sample.seat, seed) + 1;
}

function meanSE(xs) {
  const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean, se, lo: mean - 1.96 * se, hi: mean + 1.96 * se };
}

function ranks(xs) {
  const sorted = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(xs.length);
  for (let i = 0; i < sorted.length;) {
    let j = i + 1; while (j < sorted.length && sorted[j][0] === sorted[i][0]) j++;
    const r = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) out[sorted[k][1]] = r;
    i = j;
  }
  return out;
}

function spearman(a, b) {
  const x = ranks(a), y = ranks(b), mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy);
}

const rows = [], bySeed = new Map();
for (const seedSet of SEED_SETS) {
  for (let pi = 0; pi < PACKS.length; pi++) {
    const pack = PACKS[pi], W = sandbox(ROOT), params = loadChamp(W, pack.path);
    const samples = samplePack(W, params, SKILLS, seedSet);
    for (let si = 0; si < SKILLS.length; si++) {
      const key = SKILLS[si], diffs = [];
      for (let i = 0; i < samples[key].length; i++) {
        const pair = [];
        for (let r = 0; r < R; r++) {
          const seed = (seedSet * 1000003 + pi * 100003 + si * 10007 + i * 13 + r * 2 + 1) >>> 0;
          pair.push(runBranch(W, params, samples[key][i], key, 'original', seed) - runBranch(W, params, samples[key][i], key, 'alternative', seed));
        }
        diffs.push(pair.reduce((a, b) => a + b, 0) / R);
      }
      const stat = diffs.length ? meanSE(diffs) : { n: 0, mean: null, se: null, lo: null, hi: null };
      rows.push({ pack: pack.id, skill: key, seedSet, ...stat });
      if (diffs.length) bySeed.set(pack.id + ':' + key + ':' + seedSet, stat.mean);
    }
  }
}

const W = sandbox(ROOT), params = loadChamp(W, PACKS[0].path);
const selfSamples = samplePack(W, params, ['charge'], SEED_SETS[0]).charge.slice(0, 20);
const selfDiffs = [];
for (let i = 0; i < selfSamples.length; i++) for (let r = 0; r < 2; r++) {
  const seed = (77000 + i * 13 + r * 2 + 1) >>> 0;
  selfDiffs.push(runBranch(W, params, selfSamples[i], 'charge', 'original', seed) - runBranch(W, params, selfSamples[i], 'charge', 'original', seed));
}
const selfMax = Math.max(...selfDiffs.map(Math.abs));

const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, B = W.EpirusBots;
const deadOpp = OPPONENTS.map((name) => T.wrapBotN(B[OPP_SPECS.find((o) => o.name === name).fn]));
const deadDiffs = [];
for (let g = 0; g < DEAD_GAMES; g++) {
  const seed = (88000 + g * 977) >>> 0, st = S.createState('multi', { next: mulberry32(seed) }, 5), seat = g % 5;
  let sample = null;
  const dead = (state, pid, legal) => {
    const c = legal.find((l) => l.key === 'charge' && l.affordable);
    const pick = c || { key: 'ji', target: null, target2: null, bead: null };
    if (pid === seat && c && !sample) { const snap = S.cloneState(state); snap.rng = null; sample = { state: snap, pick: { ...pick }, seat }; }
    return pick;
  };
  Play.autoGameN(st, Array.from({ length: 5 }, (_, pid) => pid === seat ? dead : deadOpp[pid < seat ? pid : pid - 1]));
  if (!sample) continue;
  for (let r = 0; r < DEAD_R; r++) {
    const s2 = (seed + r * 2 + 1) >>> 0;
    const branch = (useCharge) => {
      const st2 = S.cloneState(sample.state);
      st2.rng = { next: mulberry32(s2) };
      let first = true;
      const champ = (state, pid, legal) => {
        if (first) { first = false; return useCharge ? sample.pick : { key: 'ji', target: null, target2: null, bead: null }; }
        return { key: 'ji', target: null, target2: null, bead: null };
      };
      Play.autoGameN(st2, Array.from({ length: 5 }, (_, pid) => pid === sample.seat ? champ : deadOpp[pid < sample.seat ? pid : pid - 1]));
      return 5 - T.rankOf(st2, sample.seat, s2) + 1;
    };
    deadDiffs.push(branch(true) - branch(false));
  }
}
const dead = meanSE(deadDiffs);

const posOpp = Array.from({ length: 4 }, () => () => ({ key: 'guard', target: null, target2: null, bead: null }));
const posDiffs = [];
for (let g = 0; g < POS_GAMES; g++) {
  const seed = (89000 + g * 977) >>> 0, st = S.createState('multi', { next: mulberry32(seed) }, 5), seat = g % 5;
  let sample = null;
  const sniper = (state, pid, legal) => {
    const sn = legal.find((l) => l.key === 'snipe' && l.affordable);
    const pick = sn || { key: 'ji', target: null, target2: null, bead: null };
    if (pid === seat && sn && !sample) { const snap = S.cloneState(state); snap.rng = null; sample = { state: snap, pick: { ...pick }, seat }; }
    return pick;
  };
  Play.autoGameN(st, Array.from({ length: 5 }, (_, pid) => pid === seat ? sniper : posOpp[pid < seat ? pid : pid - 1]));
  if (!sample) continue;
  for (let r = 0; r < 2; r++) {
    const s2 = (seed + r * 2 + 1) >>> 0;
    const branch = (useSnipe) => {
      const st2 = S.cloneState(sample.state);
      st2.rng = { next: mulberry32(s2) };
      let first = true;
      const champ = (state, pid, legal) => {
        if (first) { first = false; return useSnipe ? sample.pick : { key: 'ji', target: null, target2: null, bead: null }; }
        return { key: 'guard', target: null, target2: null, bead: null };
      };
      Play.autoGameN(st2, Array.from({ length: 5 }, (_, pid) => pid === sample.seat ? champ : posOpp[pid < sample.seat ? pid : pid - 1]));
      return 5 - T.rankOf(st2, sample.seat, s2) + 1;
    };
    posDiffs.push(branch(true) - branch(false));
  }
}
const pos = meanSE(posDiffs);

const byKey = new Map(rows.map((r) => [r.pack + ':' + r.skill + ':' + r.seedSet, r]));
const labels = [...new Set(rows.map((r) => r.pack + ':' + r.skill))].filter((k) => {
  const r0 = byKey.get(k + ':' + SEED_SETS[0]), r1 = byKey.get(k + ':' + SEED_SETS[1]);
  return r0 && r1 && r0.n >= 20 && r1.n >= 20;
});
const a = labels.map((k) => bySeed.get(k + ':' + SEED_SETS[0])), b = labels.map((k) => bySeed.get(k + ':' + SEED_SETS[1]));
const rho = labels.length >= 3 ? spearman(a, b) : null;
const header = ['pack', 'skill', 'seedSet', 'n', 'mean', 'se', 'lo', 'hi'];
writeFileSync(OUT + '/use-value-pilot.tsv', header.join('\t') + '\n' + rows.map((r) => header.map((k) => r[k]).join('\t')).join('\n') + '\n');
console.log(JSON.stringify({
  selfMaxAbs: selfMax, selfPass: selfMax === 0,
  posGunVsWall: pos, posPass: pos.lo > 0,
  deadCharge: dead, deadPass: dead.lo <= 0 && Math.abs(dead.mean) < 0.05,
  spearmanCells: labels.length, spearman: rho, stabilityPass: rho != null && rho >= 0.8
}, null, 2));
console.table(rows);
