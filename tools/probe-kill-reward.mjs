/* 击杀奖励规则实验（v1.5.193 · 只读：不改仓库里的引擎、不写产物、不换包）
 *
 * 背景：Gemini 提的防龟方向是"给击杀发奖励"。用户给了两条具体规则，要量"不同冠军的胜率会不会因此变化"：
 *   规则 1（**单点奖励**）：谁打死人回 1 ep。集火时只回给"所用技能优先级最高"的那位；
 *                          同优先级下取**开销最高**的那位；若仍并列（同 pri 同 cost 的不同角色）⇒ **都不回**。
 *   规则 2（**按伤害付**）：每个参与者按造成的伤害回等量 ep；但"技能结算时目标血量已归零"的那部分**不给**
 *                          （= overkill 不付费）。
 *
 * 归因依据（先看发射端，本仓第一规矩）：`damage{to, amt, source, via}` —— `source` 是施法者席，
 *   `via` 是卡名（地雷/天火按规则**无来源** ⇒ `source=null` ⇒ 两条规则都不付，谁也不该白拿）。
 *   "优先级"直接取卡表字段 `R.byKey[key].pri`（小雷 5 · 大雷 4 · 默认攻击 3 · 枪 2 · 狙击/净化 1），
 *   开销取 `.cost`。这条与 v1.5.37 那次"`voided.by` 是原因字符串不是 pid ⇒ 奖励无法归因"的教训同族：**能归因才谈得上奖励**。
 *
 * 实现方式：**在内存里给 `js/core/play.js` 打补丁**（`resolveActions` 之后、`endTurn` 之前插一钩子），
 *   每个规则档各起一个 vm 沙箱 ⇒ 仓库文件一字不动、线上引擎不受影响。若将来真要采纳，那是**规则换代**
 *   （指纹必换）+ 用户裁定，不是本探针的事。
 *
 * 用法：node tools/probe-kill-reward.mjs [--packs=a,b,c] [--fields=mirror,pool,guardwall]
 *        [--rules=0,1,2] [--games=120] [--mode=multi|long] [--json]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const arg = function (k, d) {
  const h = process.argv.find(function (a) { return a.indexOf('--' + k + '=') === 0; });
  return h ? h.split('=')[1] : d;
};
const GAMES = Number(arg('games', 120));
const N = Number(arg('n', 5));
const GAME_MODE = arg('mode', 'multi');
const RULES = String(arg('rules', '0,1,2')).split(',').map(Number);
const FIELDS = String(arg('fields', 'mirror,pool,guardwall')).split(',');
const PACKS = String(arg('packs', 'js/bundled-champion-3p.js,docs/artifacts/v7aim3-93.bak,docs/artifacts/v7divK-31.bak,docs/artifacts/v7cmin4-82.bak')).split(',');
const SEED0 = Number(arg('seed', 20260923));

const CORE = ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js'];

/* 补丁点：`X.resolveActions(state);` 与 `X.endTurn(state);` 之间。
 * 找不到锚点必须**抛错** —— 静默没打上补丁 = 三档跑的是同一个引擎 = 整份实验是假的（本仓"空枪"那一族）。 */
function patchPlay(txt) {
  /* ⚠️ 锚点必须容忍 CRLF：仓库里 `js/core/play.js` 在 Windows 工作区是 **CRLF**，
   *   第一版我用 `\n` 拼锚点 ⇒ 直接抛错（幸好抛了 —— 静默没打上补丁 = 三档跑的是同一个引擎 = 整份实验是假的）。 */
  const NL = txt.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const anchor = '      X.resolveActions(state);' + NL + '      X.endTurn(state);';
  if (txt.indexOf(anchor) < 0) throw new Error('play.js 的结算锚点找不到 ⇒ 补丁没打上，实验作废（别读它的输出）');
  const anchor2 = '      for (let pid = 0; pid < N; pid++) {' + NL + '        if (!picks[pid]) continue;';
  if (txt.indexOf(anchor2) < 0) throw new Error('play.js 的"行动前"锚点找不到 ⇒ 补丁没打上，实验作废');
  return txt.replace(anchor,
      '      X.resolveActions(state);' + NL + '      if (global.__KR) global.__KR.post(state);' + NL + '      X.endTurn(state);')
    .replace(anchor2, '      if (global.__KR) global.__KR.pre(state);' + NL + anchor2);
}

/* 规则实现（宿主函数，跑在沙箱之外但只碰传进来的 state）
 * ⚠️ 必须同时记**发出去几次**（`__krPaid`）：一条奖励如果在其真正想治的场里一次都没发放，
 *   那它的"胜率没变"就不是"没效果"，而是**根本没触发** —— 本仓"seam 2 / 空枪"那一族的规矩。 */
function makeKR(mode, R) {
  if (!mode) return null;
  return {
    paid: 0,
    pre: function (state) { state.__krHp = state.p.map(function (q) { return q.hp; }); state.__krMark = state.events.length; state.__krPaid = 0; },
    post: function (state) {
      if (!state.__krHp) return;
      for (let v = 0; v < state.p.length; v++) {
        if (!(state.__krHp[v] > 0) || state.p[v].hp > 0) continue;      // 本回合新死的人
        let hp = state.__krHp[v];
        const pay = [];
        for (let i = state.__krMark; i < state.events.length; i++) {
          const e = state.events[i];
          if (e.type !== 'damage' || e.to !== v || e.source == null || !(e.amt > 0)) continue;
          if (hp <= 0) { if (mode === 2) continue; }                     // 规则 2：结算时对方已归零 ⇒ 这一份不给
          const eff = Math.min(e.amt, hp);
          hp -= eff;
          pay.push({ src: e.source, key: e.via, eff: eff });
        }
        if (!pay.length) continue;                                        // 无来源（地雷/天火）⇒ 都不回
        if (mode === 1) {
          const val = function (p) { const d = R.byKey[p.key] || {}; return { pri: d.pri || 0, cost: d.cost || 0 }; };
          let best = null;
          for (const p of pay) {
            const q = val(p);
            if (!best || q.pri > best.pri || (q.pri === best.pri && q.cost > best.cost)) best = { pri: q.pri, cost: q.cost, src: p.src };
          }
          const rival = pay.some(function (p) {
            const q = val(p);
            return p.src !== best.src && q.pri === best.pri && q.cost === best.cost;
          });
          if (!rival) { state.p[best.src].ep += 1; state.__krPaid++; }
        } else if (mode === 2) {
          for (const p of pay) { if (p.eff > 0) { state.p[p.src].ep += p.eff; state.__krPaid++; } }
        }
      }
    }
  };
}

/* 每个规则档一个沙箱（补丁不同），包与场都跑在同一档里 ⇒ 单变量 */
const boxes = {};
for (const rm of RULES) {
  const files = CORE.map(function (f) { return f === 'js/core/play.js' ? patchPlay(readFileSync(f, 'utf8')) : readFileSync(f, 'utf8'); });
  const sb = {
    console: { log: function () { }, warn: function () { }, error: console.error },
    Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Float64Array, Date
  };
  sb.window = sb; sb.globalThis = sb;
  files.forEach(function (txt, i) { vm.runInNewContext(txt, sb, { filename: CORE[i] }); });
  sb.__KR = makeKR(rm, sb.window.EpirusRules);
  boxes[rm] = { sb: sb, R: sb.window.EpirusRules, T: sb.window.EpirusTrainer, P: sb.window.EpirusPolicy, B: sb.window.EpirusBots };
}

const POOL = [boxes[RULES[0]].B.pickAggro, boxes[RULES[0]].B.pickBalanced, boxes[RULES[0]].B.pickMix,
  boxes[RULES[0]].B.pickBeadBurst, boxes[RULES[0]].B.pickComboCounter];

function packName(p) { return p.replace(/^.*[\\/]/, '').replace(/\.[A-Za-z0-9]+$/, ''); }

function runOne(box, params, field, games, seedBase) {
  const T = box.T, B = box.B, R = box.R;
  let first = 0, draws = 0, rounds = 0, kills = 0, epSum = 0, maxEp = 0, paid = 0;
  const wins = [];   // 逐局胜负（同种子 ⇒ 三档之间可**配对**求差，SE 才是真 SE）
  for (let g = 0; g < games; g++) {
    const seat = g % N, seed = seedBase + g * 7919;
    const bs = T.policyChooserN(params, 0.15);
    const ch = [];
    for (let pid = 0; pid < N; pid++) {
      if (pid === seat) ch.push(function (s2, p2, lg) { return bs(s2, p2, lg); });
      else if (field === 'mirror') ch.push(function (s2, p2, lg) { return bs(s2, p2, lg); });
      else if (field === 'guardwall') ch.push(function (s2, p2, lg) { return B.pickGuardSpam(s2, p2, lg); });
      else { const bot = POOL[(g * 3 + pid) % POOL.length]; ch.push(function (s2, p2, lg) { return bot(s2, p2, lg); }); }
    }
    const r = T.oneGameN(ch, seed, N, { mode: GAME_MODE });
    const w = r.state.winner;
    const winFlag = (w !== 'draw' && w != null && w === seat) ? 1 : 0;
    if (w === 'draw' || w == null) draws++; else if (w === seat) first++;
    wins.push(winFlag);
    rounds += r.state.round;
    kills += r.state.p.filter(function (q) { return q.hp <= 0; }).length;
    paid += r.state.__krPaid || 0;
    for (const q of r.state.p) { epSum += q.ep; if (q.ep > maxEp) maxEp = q.ep; }
  }
  return { first: first / games, draws: draws / games, rounds: rounds / games, wins: wins,
    kills: kills / games, paid: paid / games, ep: epSum / (games * N), maxEp: maxEp };
}
/* 配对差与 SE（同种子逐局配对 ⇒ 比两次独立抽样灵敏得多） */
function pairedDiff(base, arm) {
  const n = Math.min(base.wins.length, arm.wins.length);
  let sm = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const d = arm.wins[i] - base.wins[i]; sm += d; s2 += d * d; }
  const mean = sm / n;
  const varr = n > 1 ? Math.max(0, (s2 - n * mean * mean) / (n - 1)) : 0;
  return { d: mean, se: n > 1 ? Math.sqrt(varr / n) : 0 };
}

console.log('# 击杀奖励实验 · 规则档 0=现状 / 1=单点(+1ep 给最高优先级者) / 2=按伤害付(overkill 不付)' +
  ' · 模式=' + GAME_MODE + ' · ' + GAMES + ' 局/格 · 同种子配对（三档同一批种子 ⇒ 只差规则）');
const res = [];
for (const field of FIELDS) {
  console.log('\n=== 场：' + field + ' ===');
  console.log('  包                     规则  受评席1st   平局率    局长    击杀/局  奖励发放/局  终局ep  最高ep');
  for (const p of PACKS) {
    const row = { field: field, pack: packName(p), by: {} };
    for (const rm of RULES) {
      const box = boxes[rm];
      const txt = readFileSync(p, 'utf8');
      vm.runInNewContext(txt, box.sb, { filename: p });
      const obj = /EPIRUS_CHAMPION_3P\s*=/.test(txt) ? box.sb.window.EPIRUS_CHAMPION_3P : box.sb.window.EPIRUS_CHAMPION;
      const params = box.P.unpack(obj, true);
      if (!params) { console.error('⛔ 包解不开：' + p); process.exit(2); }
      row.by[rm] = runOne(box, params, field, GAMES, SEED0);
    }
    for (const rm of RULES) {
      const v = row.by[rm];
      console.log('  ' + row.pack.slice(0, 20).padEnd(22) + String(rm).padStart(3) + '   ' +
        (100 * v.first).toFixed(1).padStart(6) + '%  ' + (100 * v.draws).toFixed(0).padStart(5) + '%  ' +
        v.rounds.toFixed(1).padStart(6) + '  ' + v.kills.toFixed(2).padStart(6) + '      ' +
        v.paid.toFixed(2).padStart(6) + '     ' + v.ep.toFixed(2).padStart(5) + ' ' + String(v.maxEp).padStart(5));
    }
    const b0 = row.by[0];
    if (b0) {
      const parts = [];
      for (const rm of RULES) {
        if (rm === 0 || !row.by[rm]) continue;
        const pd = pairedDiff(b0, row.by[rm]);
        parts.push('规则' + rm + ' ' + (100 * pd.d >= 0 ? '+' : '') + (100 * pd.d).toFixed(1) + 'pt' +
          (pd.se > 0 && Math.abs(pd.d) > 1.96 * pd.se ? '（显著 ±' + (196 * pd.se).toFixed(1) + '）' : '（噪声内 ±' + (196 * pd.se).toFixed(1) + '）'));
      }
      console.log('     Δ胜率 vs 现状（同种子配对）：' + parts.join(' · ') + ' · 局长 Δ' +
        (row.by[RULES[RULES.length - 1]] ? (row.by[RULES[RULES.length - 1]].rounds - b0.rounds >= 0 ? '+' : '') +
          (row.by[RULES[RULES.length - 1]].rounds - b0.rounds).toFixed(1) : ''));
    }
    res.push(row);
  }
}
console.log('\n# 读法：防龟成不成立看**破防场**（现状现役包在那里 0% 胜 / 100% 平）—— 但要先看"奖励发放/局"：' +
  '若那一格里奖励**一次都没发出去**，那"胜率没变"就不是"没效果"，而是**根本没触发**（本仓 seam 2 那一族）。' +
  '而"谁受益"要看各包 Δ 的方向是否一致：不一致就说明这条规则实际是在**改判据**（偏某种打法），不是修龟。');
if (process.argv.indexOf('--json') >= 0) console.log(JSON.stringify({ games: GAMES, mode: GAME_MODE, rows: res }));
