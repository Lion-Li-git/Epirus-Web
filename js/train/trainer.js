/* Epirus — 训练调度 + 冠军策略存取（localStorage / 导出导入 JSON） */
(function (global) {
  'use strict';
  const P = global.EpirusPolicy;
  const Trainer = global.EpirusTrainer;
  const LS_KEY = 'epirus.champion.v3';

  const store = {
    // 最近一次“本地冠军被拒绝”的原因（供 UI 提示：版本不符/维度不符）。valid 加载后清空。
    lastInvalidReason: null,
    load: function () {
      // 1) 本地冠军（localStorage）
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          try {
            const j = JSON.parse(raw);
            const c = P.checkPack(j);
            if (c.ok) { store.lastInvalidReason = null; return P.unpack(j); }
            store.lastInvalidReason = c.reason || 'invalid';
            localStorage.removeItem(LS_KEY);   // 旧架构冠军无法用于新网络 → 清掉，避免它一直遮蔽内置冠军
          } catch (e) {
            store.lastInvalidReason = 'parse-error';
            localStorage.removeItem(LS_KEY);
          }
        }
      } catch (e) { /* ignore */ }
      // 2) 内置冠军（由 tools/train-fast.mjs / train-best.mjs 打包进 js/bundled-champion.js）
      if (typeof window !== 'undefined' && window.EPIRUS_CHAMPION) {
        try {
          const c = P.checkPack(window.EPIRUS_CHAMPION);
          if (c.ok) return P.unpack(window.EPIRUS_CHAMPION);
          store.lastInvalidReason = store.lastInvalidReason || ('builtin-' + c.reason);
        } catch (e) { return null; }
      }
      return null;
    },
    save: function (params) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(P.pack(params))); } catch (e) { /* ignore */ }
    },
    clear: function () { try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ } },
    exportJSON: function (params) { return JSON.stringify(P.pack(params), null, 1); },
    // 返回 {ok, reason?, policy?} —— UI 据此区分“版本不符/维度不符/其它损坏”
    importJSON: function (text) {
      let j;
      try { j = JSON.parse(text); } catch (e) { return { ok: false, reason: 'parse-error' }; }
      const c = P.checkPack(j);
      if (!c.ok) return { ok: false, reason: c.reason, got: c.got, want: c.want };
      return { ok: true, policy: P.unpack(j) };
    }
  };

  /* 困难难度出招：冠军（贪心）；未训练则回退 balanced 并提示 —— championChooser 已废弃（旧版未过滤“可负担”会贷款），使用 ui.js 的正确出招。 */


  /* 同步快速评测：冠军 vs 全部脚本基准 */
  function quickEval(games, seedBase) {
    const c = store.load();
    if (!c) return null;
    // 只在“可负担”技能里选：与对局/训练一致，评测绝不让冠军贷款自爆
    const champ = function (state, pid, legal) {
      const aff = legal.filter(l => l.affordable);
      const base = aff.length ? aff : [{ key: global.EpirusRules.SK.JI, affordable: true }];
      return P.choose(state, pid, base, c, { temp: 0.05 });
    };
    const res = [];
    const names = ['random', 'aggro', 'defend', 'balanced', 'breakdef', 'wall', 'reflectspam', 'guardspam', 'baguaspam', 'combocounter', 'mix', 'heavyfire', 'guardgun', 'protowall', 'whiff', 'reflectmix', 'reflecttank', 'defreflectgun'];
    const fname = { random: 'pickRandom', aggro: 'pickAggro', defend: 'pickDefend', balanced: 'pickBalanced', breakdef: 'pickBreakDef', wall: 'pickWall', reflectspam: 'pickReflectSpam', guardspam: 'pickGuardSpam', baguaspam: 'pickBaguaSpam', combocounter: 'pickComboCounter', mix: 'pickMix', tankline: 'pickTankLine', heavyfire: 'pickHeavyFire', guardgun: 'pickGuardGun', protowall: 'pickProtoWall', whiff: 'pickWhiff', reflectmix: 'pickReflectMix', reflecttank: 'pickReflectTank', defreflectgun: 'pickDefReflectGun' };
    for (const nm of names) {
      const r = Trainer.correctedWinRate(champ, global.EpirusBots[fname[nm]], games, seedBase + res.length * 977);
      res.push({ name: nm, w: r.w, d: r.d, l: r.l, wr: r.wr });
    }
    return res;
  }

  // 训练历史 → 标准长表 CSV（可直接做折线图）。
  // 列：round,global_gen,gen,seed_id,parent_seed_id,best,baseline,champAge,champChanged,sigma
  // 写入顺序严格按 [round] -> [seed_id] -> [gen]：同一种子在一轮内的所有代数在行上连续，块间不留空行。
  // parent_seed_id：第 0 轮为 -1；后续轮记录继承自上一轮的哪个种子（父代为"现有冠军"时记 -1）。
  function trainingCSV(t) {
    const hist = (t && t.history) || [];
    const rows = [['round', 'global_gen', 'gen', 'seed_id', 'parent_seed_id', 'best', 'baseline', 'champAge', 'champChanged', 'sigma']];
    if (!hist.length) return rows.map(function (r) { return r.join(','); }).join('\n');
    let maxGen = 0;
    for (const r of hist) if (r.gen > maxGen) maxGen = r.gen;
    const stride = maxGen + 1;   // 每轮代数：global_gen = round * stride + gen
    const arr = hist.slice().sort(function (a, b) {
      const ra = a.round != null ? a.round : 0, rb = b.round != null ? b.round : 0;
      if (ra !== rb) return ra - rb;
      const sa = a.seed != null ? a.seed : 0, sb = b.seed != null ? b.seed : 0;
      if (sa !== sb) return sa - sb;
      return a.gen - b.gen;
    });
    for (const r of arr) {
      const rd = r.round != null ? r.round : 0;
      const sd = r.seed != null ? r.seed : 0;
      const ps = rd === 0 ? -1 : (r.parentSeed != null ? r.parentSeed : -1);
      rows.push([
        rd,
        rd * stride + r.gen,
        r.gen,
        sd,
        ps,
        r.best != null ? r.best.toFixed(4) : '',
        r.baseline != null ? r.baseline.toFixed(4) : '',
        r.champAge != null ? r.champAge : '',
        r.champChanged ? 1 : 0,
        r.sigma != null ? r.sigma.toFixed(4) : ''
      ]);
    }
    return rows.map(function (row) { return row.join(','); }).join('\n');
  }
  // 训练结束：存 localStorage + 自动下载 CSV（文件名标明「轮数 × 每轮代数」，不再只显示最后一轮的代数）
  function saveTrainLogCSV(t) {
    const csv = trainingCSV(t);
    const hist = (t && t.history) || [];
    let maxGen = 0, maxRound = 0;
    for (const r of hist) {
      if (r.gen > maxGen) maxGen = r.gen;
      const rd = r.round != null ? r.round : 0;
      if (rd > maxRound) maxRound = rd;
    }
    const name = maxRound > 0
      ? ('epirus-train-' + (maxRound + 1) + '轮x' + (maxGen + 1) + '代.csv')
      : ('epirus-train-' + (maxGen + 1) + '代.csv');
    try { localStorage.setItem('epirus.trainLog', csv); } catch (e) { /* ignore */ }
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    } catch (e) { /* ignore */ }
  }

  /* v1.4.13：删掉死代码 `startTraining`（v1.3.56 查实零调用方；本轮再查全仓仍只有"定义 + 导出"）。
   * 它曾经误导过一次归因：把"训练在跑"算到浏览器内的它头上，而实际跑的是 server。
   * 保留 quickEval / trainingCSV / saveTrainLogCSV —— 这三个有调用方。 */
  global.EpirusChampion = { store, quickEval, trainingCSV, saveTrainLogCSV };
})(typeof window !== 'undefined' ? window : globalThis);
