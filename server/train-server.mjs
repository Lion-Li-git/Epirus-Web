/* Epirus — 训练服务（Node，零依赖）：SSE 实时推送进度，训练完写 js/bundled-champion.js。
 * 启动：双击 tools/start-train-server.cmd，或 node server/train-server.mjs [端口=8787]
 * 浏览器训练页「连接远程训练」即可实时看进度；游戏仍双击 index.html 即玩。
 * 语义说明：
 *   - /train?gens=N  从当前 checkpoint 继续训练 N 代（持续训练：训练完再点一次会接着练）。
 *   - /reset         重置服务端训练器（新种子/清空服务端进度）。
 */
import http from 'node:http';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { makeAsyncStep } from './paralleltrain.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PORT = Number(process.argv[2] || 8787);

const sb = { console, Math, JSON, Object, Array, Number, String, Error,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/evo.js','js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(join(root, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, P = sb.EpirusPolicy, R = sb.EpirusRules;
const stepAsync = makeAsyncStep(T);   // 并行加速：每代把评估切到 worker 池跑多核
console.log('[parallel] 训练 worker 数：' + stepAsync.workers);

const clients = new Set();
let seeds = [];            // 多种子池：[{t, seed, done, stopReason, peakWr, stall, checked}]
let running = false;
let lastChampionPack = null;   // 最近一次择优成功的冠军包（供 /champion 拉取）

/* 从 js/bundled-champion.js 读回已保存冠军，用于服务重启后热启动持续训练。
 * 注意：bundle 现在含 meta（EPIRUS_CHAMPION_META）在前，不能再用 indexOf('=')（会拿到 meta 的等号导致 JSON.parse 失败）。 */
function loadSeed() {
  try {
    const src = readFileSync(join(root, 'js', 'bundled-champion.js'), 'utf8');
    const m = src.match(/window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!m) return null;
    return P.unpack(JSON.parse(m[1]));
  } catch (e) { return null; }
}

function sse(res, data) {
  try { res.write('data: ' + JSON.stringify(data) + '\n\n'); } catch (e) { /* client gone */ }
}
/* 更新 index.html 里冠军 script 的 ?v= 版本号（cache-busting）：冠军一变版本号就变，浏览器不再用旧缓存。 */
function bumpChampionVersion() {
  const html = join(root, 'index.html');
  try {
    let s = readFileSync(html, 'utf8');
    // 所有脚本引用统一换构建标记：冠军/引擎/UI 一起缓存失效，避免改了 js 却还在跑旧代码
    s = s.replace(/(\?v=)[0-9a-z]+/gi, '$1' + Date.now().toString(36));
    writeFileSync(html, s, 'utf8');
  } catch (e) { /* ignore */ }
}
function writeBundle(pack, meta) {
  const dest = join(root, 'js', 'bundled-champion.js');
  if (existsSync(dest)) copyFileSync(dest, dest + '.bak');   // 覆写前留一份 .bak
  writeFileSync(dest,
    '/* Epirus 内置冠军：由 server/train-server.mjs 生成（多种子择优，收尾按真实胜率）。不要手改。 */\n' +
    'window.EPIRUS_CHAMPION_META = ' + JSON.stringify(meta) + ';\n' +
    'window.EPIRUS_CHAMPION = ' + JSON.stringify(pack) + ';\n', 'utf8');
  bumpChampionVersion();
}

/* 与页面“困难·冠军”一致的出招（temp0.15，只挑可负担），对 8 基准实测平均真实胜率。 */
const BOT_NAMES = ['random', 'aggro', 'defend', 'balanced', 'breakdef', 'wall', 'reflectspam', 'guardspam', 'baguaspam', 'combocounter', 'mix', 'tankline', 'heavyfire', 'guardgun', 'protowall', 'whiff', 'reflectmix', 'reflecttank', 'defreflectgun'];
const BOT_FN = { random: 'pickRandom', aggro: 'pickAggro', defend: 'pickDefend', balanced: 'pickBalanced', breakdef: 'pickBreakDef', wall: 'pickWall', reflectspam: 'pickReflectSpam', guardspam: 'pickGuardSpam', baguaspam: 'pickBaguaSpam', combocounter: 'pickComboCounter', mix: 'pickMix', tankline: 'pickTankLine', heavyfire: 'pickHeavyFire', guardgun: 'pickGuardGun', protowall: 'pickProtoWall', whiff: 'pickWhiff', reflectmix: 'pickReflectMix', reflecttank: 'pickReflectTank', defreflectgun: 'pickDefReflectGun' };
function champRealWr(params, temp, games, seedBase) {
  const sel = function (state, pid, legal) {
    const aff = legal.filter(l => l.affordable);
    const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    return P.choose(state, pid, base, params, { temp: temp });
  };
  let tot = 0, n = 0;
  for (let i = 0; i < BOT_NAMES.length; i++) {
    const nm = BOT_NAMES[i];
    const r = T.correctedWinRate(sel, sb.EpirusBots[BOT_FN[nm]], games, seedBase + i * 977);
    tot += r.wr; n++;
  }
  return n ? tot / n : 0;
}

/* 早停判定（保守版）：只杀"明确过拟合/长期废物"的种子，绝不杀高分/当前最优种子。
 * 关键：不再用"wr<0.78 绝对阈值"（会把 baseline 高达 0.9 的高分种子因偶发噪声误杀）；
 * 只认两种明确信号，且用 60局/基线降噪，并要求连续 2 次（避免单次噪声误杀）。 */
function maybeEarlyStop(it, gens) {
  if (it.t.gen < 160 || it.t.gen % 40 !== 0) return;
  const base = (it.t.gen + 1) * 7919 + it.seed * 131;
  const wr = champRealWr(it.t.champion, 0.05, 60, base);   // 60局/基线=480局，噪声大幅下降
  it.lastWr = wr; it.checked++;
  if (wr > it.peakWr + 0.01) it.peakWr = wr;
  const alive = seeds.filter(function (x) { return x !== it && !x.done && x.t.gen >= 160 && x.lastWr != null; });
  const leaderWr = alive.length ? Math.max.apply(null, alive.map(x => x.lastWr)) : -1;
  const best = it.t.bestChampScore;
  // 明确过拟合：shaped 分很高（>0.85）但真实胜率一直很低（<0.55），差距大 → 真机退化
  const overfit = best > 0.85 && wr < 0.55;
  // 长期废物：真实胜率从没上过 0.70，且当前仍 <0.55
  const dud = it.peakWr < 0.70 && wr < 0.55;
  // 当前最优/接近 leader 的种子不杀（避免杀高种子）
  const notTop = !(alive.length && wr >= leaderWr - 0.03);
  if ((overfit || dud) && notTop) it.badStreak = (it.badStreak || 0) + 1; else it.badStreak = 0;
  if (it.badStreak >= 2 && alive.length >= 1) {
    it.done = true;
    it.stopReason = overfit ? '早停·明确过拟合(shaped高/真胜率低)' : '早停·长期废物(真胜率<0.55)';
    for (const c of clients) sse(c, { type: 'seedDone', seed: it.seed, reason: it.stopReason, gen: it.t.gen, wr });
  }
}

/* 多种子 × 多轮训练：每轮 = seeds 个独立种子跑 gens 代（轮间重新择优/重开种子，避免长跑 sigma 坍缩与冠军蝉联）。
 * 每轮结束都按真实胜率择优并与现有冠军比（绝不回退）。 */
async function runTrain(gens, opts, cfg) {
  cfg = cfg || {};
  const seedN = Math.max(1, cfg.seeds || 3);
  const rounds = Math.max(1, cfg.rounds || 1);
  const fresh = !!cfg.fresh;
  const t0 = Date.now();
  const cap = 1800000; // 30 分钟上限
  let last = null;
  let nextParents = null;   // 下一轮各种子的父代（谱系）：[{label, params}]
  for (let r = 0; r < rounds; r++) {
    const list = [];
    for (let s = 0; s < seedN; s++) {
      const t = T.makeTrainer(opts || { popSize: 14, gamesPerOpp: 5 });
      // 第一轮：fresh=清空旧冠军、随机起；非 fresh=围绕现有冠军精修。
      // 后续轮：只从上一轮保留的父代派生（谱系）——fresh 只作用于开局，不再每轮清空重来。
      let seedPack = null, parentLabel = null, parentSeed = -1;
      if (r === 0) {
        parentSeed = -1;   // 第 0 轮无父种子
        if (fresh) parentLabel = '随机';
        else { seedPack = loadSeed(); parentLabel = seedPack ? '现有冠军' : '随机'; }
      } else if (nextParents && nextParents[s]) {
        seedPack = nextParents[s].params; parentLabel = nextParents[s].label; parentSeed = nextParents[s].seedId;
      }
      if (seedPack) T.seedChampion(t, seedPack);
      list.push({ t, seed: s, parent: parentLabel, parentSeed: parentSeed, done: false, stopReason: null, peakWr: -1, stall: 0, checked: 0, lastWr: null, badStreak: 0 });
    }
    seeds = list;
    for (const c of clients) sse(c, { type: 'roundStart', round: r, rounds, seeds: seedN, gens, parents: list.map(function (it) { return { label: it.parent, seedId: it.parentSeed }; }) });
    let allDone = false;
    while (!allDone) {
      for (const it of list) {
        if (it.done) continue;
        if (it.t.gen >= gens) { it.done = true; it.stopReason = '目标代'; continue; }
        const rec = await stepAsync(it.t);                 // 每种子推 1 代（曲线同步长）
        for (const c of clients) sse(c, { type: 'gen', round: r, seed: it.seed, rec });
        maybeEarlyStop(it, gens);
        if (Date.now() - t0 > cap) { for (const c of clients) sse(c, { type: 'error', msg: '训练超时上限（30 分钟）' }); running = false; return; }
      }
      allDone = list.every(it => it.done || it.t.gen >= gens);
    }
    // 本轮收尾：每种子 pickChampionByWinRate（broad 真实胜率把关）+ 实测，选最强
    let best = null, bestWr = -1, bestSeed = -1, bestScore = null;
    const seedBase = (r + 1) * 7919 + (Date.now() % 1000);
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      T.pickChampionByWinRate(it.t, 24, seedBase + i * 9973);
      const wr = champRealWr(it.t.champion, 0.15, 100, seedBase + i * 331);   // 100局/基线，降低噪声
      it.wr = wr;
      for (const c of clients) sse(c, { type: 'seedEval', round: r, seed: it.seed, wr, gen: it.t.gen, reason: it.stopReason || '完成' });
      if (!best || wr > bestWr) { bestWr = wr; best = it.t; bestSeed = it.seed; bestScore = it.t.bestChampScore; }
    }
    const cur = loadSeed(); let curWr = -1;
    if (cur) {
      curWr = champRealWr(cur, 0.15, 100, seedBase + 999);   // 现有冠军同口径足量评估，避免噪声误判
      // 绝不回退：只有种子明显（>4个百分点击败现有冠军）才替换；否则保留现有冠军。
      // fresh（从头训练）例外：用户明确要清空旧冠军，此时直接采纳本轮最强种子，也不把旧冠军当父代。
      if (!fresh && !(bestWr > curWr + 0.04)) { best = null; bestWr = curWr; bestSeed = -1; bestScore = null; }
    }
    // 谱系：父母池 = 本轮各种子 + 现有冠军（存在且非 fresh 时），按真实胜率排序，保留前 k=ceil(sqrt(n)) 名；
    // 每名按“越靠前分得越多”分配 n 个新种子：n=3→2+1，n=4→2+2，n=5→2+2+1，n=8→3+3+2。
    const pool = list.map(function (it) { return { label: '种子' + it.seed, seedId: it.seed, wr: it.wr, params: it.t.champion }; });
    if (cur && curWr >= 0 && !fresh) pool.push({ label: '现有冠军', seedId: -1, wr: curWr, params: cur });
    pool.sort(function (a, b) { return b.wr - a.wr; });
    const keepN = Math.max(1, Math.ceil(Math.sqrt(seedN)));
    const kept = pool.slice(0, keepN);
    const baseN = Math.floor(seedN / kept.length), remN = seedN - baseN * kept.length;
    nextParents = [];
    kept.forEach(function (p, i) {
      const cnt = baseN + (i < remN ? 1 : 0);
      for (let j = 0; j < cnt; j++) nextParents.push({ label: p.label, seedId: p.seedId, params: p.params });
    });
    for (const c of clients) sse(c, { type: 'lineage', round: r + 1, parents: nextParents.map(function (p) { return { label: p.label, seedId: p.seedId }; }) });
    const finalPack = P.pack(best ? best.champion : cur);
    lastChampionPack = finalPack;
    writeBundle(finalPack, { source: 'server/train-server.mjs', seeds: seedN, gens, round: r + 1, rounds, ts: new Date().toISOString(), keptExisting: bestSeed < 0, fresh: fresh, champWr: bestWr });
    last = { best: bestScore, champWr: bestWr, bestSeed, keptExisting: bestSeed < 0 };
    for (const c of clients) sse(c, { type: 'roundDone', round: r, rounds, champWr: bestWr, bestSeed, keptExisting: bestSeed < 0 });
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  for (const c of clients) sse(c, { type: 'done', from: 0, gens, best: last.best, champWr: last.champWr, attackShare: null, secs, bestSeed: last.bestSeed, seeds: seedN, rounds, keptExisting: last.keptExisting });
  running = false;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/train') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    res.write('retry: 500\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    const gens = Math.max(1, Number(url.searchParams.get('gens') || 500));
    const pop = Math.max(6, Number(url.searchParams.get('pop') || 14));
    const gpo = Math.max(2, Number(url.searchParams.get('gpo') || 5));
    const seedsN = Math.max(1, Math.min(Number(url.searchParams.get('seeds') || 3), 8));
    const roundsN = Math.max(1, Math.min(Number(url.searchParams.get('rounds') || 1), 20));
    const fresh = url.searchParams.get('fresh') === '1';
    sse(res, { type: 'start', gens, pop, gpo, seeds: seedsN, rounds: roundsN, from: 0, fresh });
    if (!running) { running = true; runTrain(gens, { popSize: pop, gamesPerOpp: gpo }, { seeds: seedsN, rounds: roundsN, fresh }); }
    return;
  }
  if (url.pathname === '/champion') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    const gen = seeds.length ? Math.max(...seeds.map(x => x.t.gen)) : 0;
    const bestScore = seeds.length ? Math.max(...seeds.map(x => x.t.bestChampScore)) : 0;
    res.end(JSON.stringify({ has: !!lastChampionPack, gen, best: bestScore, seeds: seeds.length, champion: lastChampionPack }));
    return;
  }
  if (url.pathname === '/reset') {
    seeds = []; running = false; lastChampionPack = null;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain;charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end('Epirus train server running. 在游戏训练页点「开始训练/连接远程训练」即可实时看进度。双击 tools/start-train-server.cmd 启动。');
});

server.listen(PORT, () => console.log('Epirus train server on http://127.0.0.1:' + PORT));
