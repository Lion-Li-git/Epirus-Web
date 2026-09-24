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
 * 用法：node tools/probe-kill-reward.mjs [--packs=a,b,c] [--fields=mirror,pool,guardwall] [--temp/--eps/--epsk/--epsmode]
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
const KR_TRANSFER = arg('kr-transfer', 'owner');
const OPP_PACK = arg('opp', '');   // `vs` 场的对手包（头对头：其余席 = 这只包）   // 转移伤害的功劳记给谁：owner=转移者（默认）/ source=原攻击者
const FIELDS = String(arg('fields', 'mirror,pool,guardwall')).split(',');
const PACKS = String(arg('packs', 'js/bundled-champion-3p.js,docs/artifacts/v7aim3-93.bak,docs/artifacts/v7divK-31.bak,docs/artifacts/v7cmin4-82.bak')).split(',');
const SEED0 = Number(arg('seed', 20260923));
/* v1.5.208 口径开关（§H-12 那课长在**我自己的**另一件量具上）：这里原先只有写死的 `policyChooserN(params, 0.15)`
 *   ⇒ 破龟群那三栏（1st / 归因伤害 / 终场存活）只能在 ε=0 上读，而 E5 已经证明龟型局在 ε=0 大面积拖平。
 *   默认 `temp=0.15, eps=0` ⇒ 与历史读数**逐字相同**（eps=0 时 `epsK/epsMode` 根本不参与）。 */
const TEMP = Number(arg('temp', 0.15)), EPS = Number(arg('eps', 0)), EPSK = Number(arg('epsk', 5)), EPSMODE = arg('epsmode', 'soft');

/* 规则实现：**一律走 `tools/kill-reward-lib.mjs`**（与 `train-3p` 同源）
 * —— 本仓为"同一规则写两遍"栽过六次，而这里两遍跑在不同进程、比对的是冠军产物，
 *    一旦漂移就是"训出来的冠军和量出来的冠军不是一套规则"这种最坏的错误。
 * 三条口径（用户 09-23 夜点名）也全在 lib 里：蓄能计入开销 / 地雷·天火无来源仍归因 / 转移伤害记给转移者。 */
import { patchResolve, patchPlay, makeKR } from './kill-reward-lib.mjs';

const CORE = ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js'];

/* 每个规则档一个沙箱（补丁不同），包与场都跑在同一档里 ⇒ 单变量 */
const boxes = {};
for (const rm of RULES) {
  const sb = {
    console: { log: function () { }, warn: function () { }, error: console.error },
    Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Float64Array, Date
  };
  sb.window = sb; sb.globalThis = sb;
  for (const f of CORE) {
    let txt = readFileSync(f, 'utf8');
    if (rm === 1 || rm === 2) {
      if (f === 'js/core/resolve.js') txt = patchResolve(txt);
      if (f === 'js/core/play.js') txt = patchPlay(txt);
    }
    vm.runInNewContext(txt, sb, { filename: f });
  }
  sb.__KR = makeKR(sb.window.EpirusRules, sb.window.EpirusState, rm, { transfer: KR_TRANSFER });
  boxes[rm] = { id: 'r' + rm, sb: sb, R: sb.window.EpirusRules, T: sb.window.EpirusTrainer, P: sb.window.EpirusPolicy, B: sb.window.EpirusBots };
}
const POOL = [boxes[RULES[0]].B.pickAggro, boxes[RULES[0]].B.pickBalanced, boxes[RULES[0]].B.pickMix,
  boxes[RULES[0]].B.pickBeadBurst, boxes[RULES[0]].B.pickComboCounter];

function packName(p) { return p.replace(/^.*[\\/]/, '').replace(/\.[A-Za-z0-9]+$/, ''); }

/* 广度读数（P3 的尺）：`mirrorHealth` 跑在**同一个沙箱**里 ⇒ 它量的就是这个规则世界里的兑现广度 */
const BREADTH_CACHE = {};
function breadthOf(box, params, tag) {
  /* ⚠️ 缓存键必须含**包身份**：第一版只用了场名 ⇒ 十只包全被报成同一份广度（4.44→2.66）。
   *   我发现它的方式就是"十行一模一样"——同形读数本身就是危险信号，本仓为这类事栽过不止一次。 */
  const k = tag + '|' + box.id + '|' + (params && params.__krTag ? params.__krTag : 'p');
  if (BREADTH_CACHE[k]) return BREADTH_CACHE[k];
  const mh = box.T.mirrorHealth(params, 20, N, GAME_MODE === 'long' ? 'long' : 'multi');
  BREADTH_CACHE[k] = { castG: mh.effSkills, landG: mh.effSkillsLand || 0, landKeys: mh.landedKeys || 0 };
  return BREADTH_CACHE[k];
}
/* `--opp=<包>`：其余席 = 另一只包 ⇒ 真正的**头对头**（P1/P2 要的"新冠军 vs 现役"，不是自对局） */
function oppParamsOf(box) {
  if (!OPP_PACK) return null;
  if (!box._opp) {
    const t = readFileSync(OPP_PACK, 'utf8');
    vm.runInNewContext(t, box.sb, { filename: OPP_PACK });
    const o = /EPIRUS_CHAMPION_3P\s*=/.test(t) ? box.sb.window.EPIRUS_CHAMPION_3P : box.sb.window.EPIRUS_CHAMPION;
    box._opp = box.P.unpack(o, true);
    if (!box._opp) { console.error('⛔ 对手包解不开：' + OPP_PACK); process.exit(2); }
  }
  return box._opp;
}

function runOne(box, params, field, games, seedBase, packTag) {
  if (params && packTag) params.__krTag = packTag;   // 只当缓存身份用，不参与任何计算
  const T = box.T, B = box.B;
  let first = 0, draws = 0, rounds = 0, kills = 0, epSum = 0, maxEp = 0, paid = 0;
  /* `deal`＝受评席累计**有归因**伤害／局，`alive`＝终场时受评席**还活着**的占比。
   * 为什么必须加这两栏（v1.5.195）：破防场里 4 席不还手 ⇒ 大家一起被"终局收缩"清场（实测局长恒 47 = 收缩点 + 血量），
   * 而判胜口径是"全灭时按累计**有归因**伤害最高者胜"（`resolve.js` 的 `alive.length === 0` 分支）
   * ⇒ **1st=100% 只等价于"47 回合里至少蹭到一发"**，是**下限**判据。
   * 实测同为 100% 的包幅值差 4 倍（`co1s3` 2.17 点/局 vs `co1s8` 8.63 点/局），而只有 `alive>0` 才是"真把龟打死"。
   * ⚠️ 第一版我用"局长 < 回合上限"当"提前收场"，读出来人人 100% —— 因为游戏是**被收缩清场**结束的（47 回合），
   *    远早于上限（100）⇒ 那个判据量的不是它声称的东西。改判据：终场血量 > 0。 */
  let deal = 0, aliveEnd = 0;
  const wins = [];   // 逐局胜负（同种子 ⇒ 三档之间可**配对**求差，SE 才是真 SE）
  const oppP = field === 'vs' ? oppParamsOf(box) : null;
  if (field === 'vs' && !oppP) throw new Error('`vs` 场需要 --opp=<包>');
  for (let g = 0; g < games; g++) {
    const seat = g % N, seed = seedBase + g * 7919;
    const bs = T.policyChooserN(params, TEMP, EPS, EPSK, EPSMODE);
    const obs = oppP ? T.policyChooserN(oppP, TEMP, EPS, EPSK, EPSMODE) : null;
    const ch = [];
    for (let pid = 0; pid < N; pid++) {
      if (pid === seat) ch.push(function (s2, p2, lg) { return bs(s2, p2, lg); });
      else if (field === 'mirror') ch.push(function (s2, p2, lg) { return bs(s2, p2, lg); });
      else if (field === 'vs') ch.push(function (s2, p2, lg) { return obs(s2, p2, lg); });
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
    const dsum = new Array(N).fill(0);
    for (const e of r.state.events) {
      if (e.type === 'damage' && e.source != null && dsum[e.source] != null) dsum[e.source] += e.amt;
    }
    deal += dsum[seat];
    if (r.state.p[seat].hp > 0) aliveEnd++;
    for (const q of r.state.p) { epSum += q.ep; if (q.ep > maxEp) maxEp = q.ep; }
  }
  const br = breadthOf(box, params, field);
  return { first: first / games, draws: draws / games, rounds: rounds / games, wins: wins,
    kills: kills / games, paid: paid / games, ep: epSum / (games * N), maxEp: maxEp,
    deal: deal / games, alive: aliveEnd / games,
    castG: br.castG, landG: br.landG, landKeys: br.landKeys };
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
  console.log('  包                     规则  受评席1st   平局率    局长    击杀/局  奖励发放/局  归因伤害/局  终场存活  终局ep  最高ep   出手G→净兑现G');
  for (const p of PACKS) {
    const row = { field: field, pack: packName(p), by: {} };
    for (const rm of RULES) {
      const box = boxes[rm];
      const txt = readFileSync(p, 'utf8');
      vm.runInNewContext(txt, box.sb, { filename: p });
      const obj = /EPIRUS_CHAMPION_3P\s*=/.test(txt) ? box.sb.window.EPIRUS_CHAMPION_3P : box.sb.window.EPIRUS_CHAMPION;
      const params = box.P.unpack(obj, true);
      if (!params) { console.error('⛔ 包解不开：' + p); process.exit(2); }
      row.by[rm] = runOne(box, params, field, GAMES, SEED0, row.pack + '#' + rm);
    }
    for (const rm of RULES) {
      const v = row.by[rm];
      console.log('  ' + row.pack.slice(0, 20).padEnd(22) + String(rm).padStart(3) + '   ' +
        (100 * v.first).toFixed(1).padStart(6) + '%  ' + (100 * v.draws).toFixed(0).padStart(5) + '%  ' +
        v.rounds.toFixed(1).padStart(6) + '  ' + v.kills.toFixed(2).padStart(6) + '      ' +
        v.paid.toFixed(2).padStart(6) + '     ' + v.deal.toFixed(2).padStart(7) + '  ' +
        (100 * v.alive).toFixed(0).padStart(5) + '%   ' +
        v.ep.toFixed(2).padStart(5) + ' ' + String(v.maxEp).padStart(5) +
        '    ' + v.castG.toFixed(2) + '→' + v.landG.toFixed(2) + '(' + v.landKeys + '种)');
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
console.log('# ⚠️ 破防场的 **1st 是下限判据**（v1.5.195）：那格 4 席不还手 ⇒ 全员被"终局收缩"清场 ⇒ 判胜口径是' +
  '「累计**有归因**伤害最高者胜」（`resolve.js` 的 `alive.length === 0` 分支）⇒ 100% 只意味着"47 回合里至少蹭到一发"。' +
  '\n#   所以必须并读两栏：**归因伤害/局**＝凿墙的幅值、**终场存活**＝>0% 才是真把龟打死（不是被清场后判分赢）。' +
  '\n#   同幅读数（破防 100%）实测差 4 倍 ⇒ 只看 1st 会把"蹭一发"和"凿穿"排在同一档。');
if (process.argv.indexOf('--json') >= 0) console.log(JSON.stringify({ games: GAMES, mode: GAME_MODE, rows: res }));
