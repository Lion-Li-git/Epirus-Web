/* 人类形状对手池（§E152e 的产物 → §E155/§E157/§E168 的共用单一来源）
 *
 * 为什么要单独成一个 `tools/` 模块（09-30 夜班 §E168）：这台"按经验分布抽样"的对手此前**只住在 `docs/artifacts/e155-humanpool.mjs` 里**。
 *   今晚要把"风格代价"（蓄能 / 电磁炮 / 防御占比 / 集中度）从脚本桌复量到人类形状桌，就必须让**度量**（`tools/behavior-profile.mjs` 的 `tallyPick`）
 *   与**对手**（这里）都只有一份实现；把采样器抄进新仪器 = 本仓"两份同构实现必漂移"的第六次诱惑，而且漂移正好落在我自己最关心的那几列上。
 *
 * 口径（照抄 §E155 那台仪器的原始算法，不改一个字节语义）：
 *   条件键 = `钱档(0..5)/是否富有(≥5ep)/上一手的显示名`；抽不到可负担的卡 ⇒ 最多重试 8 次后退回 `ジ`；
 *   指向 = `next`（打下一位，机械）‖ `rand`（活席里随机指）——两张形状桌的差别只在指向规则。
 * ⚠ 它是**粗模型**：来自 56 局 / ~997 个决策的人类日志，不会针对你调整 ⇒ 只当"人类这种打法"的代理，别当真人。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const HB_FILE_DEFAULT = 'docs/artifacts/human-behavior.json';

/* ---- 经验分布 → 按条件索引的采样表（键里剥掉席位：要的是"人类这种打法"，不是"1 号位那个人"） ---- */
export function loadPool(W, src, file) {
  const R = W.EpirusRules;
  const HB = JSON.parse(readFileSync(join(ROOT, file || HB_FILE_DEFAULT), 'utf8'));
  if (!HB[src]) throw new Error('human-behavior.json 里没有这一份分布：' + src + '（键有：' + Object.keys(HB).join(',') + '）');
  const BY_NAME = {}, KEY2NAME = {};
  for (const c of (R.skills || [])) { if (c && c.name) BY_NAME[c.name] = c; if (c && c.key) KEY2NAME[c.key] = c.name; }
  const POOL = {}; let tot = 0;
  for (const k in HB[src]) {
    const cond = k.replace(/^S\d+@/, '');
    POOL[cond] = POOL[cond] || {};
    for (const card in HB[src][k]) { POOL[cond][card] = (POOL[cond][card] || 0) + HB[src][k][card]; tot += HB[src][k][card]; }
  }
  const MARG = {};
  for (const c in POOL) for (const card in POOL[c]) MARG[card] = (MARG[card] || 0) + POOL[c][card];
  return { POOL, MARG, BY_NAME, KEY2NAME, tot: tot, conds: Object.keys(POOL).length, games: HB.games, src: src };
}

export function condOf(pool, state, pid) {
  const p = state.p[pid];
  return [Math.min(5, (p.ep || 0) >> 1), (p.ep || 0) >= 5 ? 1 : 0, pool.KEY2NAME[p.lastSkill] || '-'].join('/');
}
export function sampleDist(dist, rnd) {
  let tot = 0; for (const k in dist) tot += dist[k];
  if (!tot) return 'ジ';
  let x = rnd() * tot;
  for (const k in dist) { x -= dist[k]; if (x <= 0) return k; }
  return 'ジ';
}
/* 造一个"人类形状"的 chooser：签名与引擎的 chooser 一致（state, pid, legal）⇒ pick，
   随机流**由调用方注入**（两臂要面对同一串抽样 ⇒ rng 必须按 seed 造，不能用 Math.random）。 */
export function makeMimic(W, pool, tgt, rnd) {
  const R = W.EpirusRules;
  const st = { hit: 0, miss: 0 };
  const fn = function (state, pid, legal) {
    const aff = legal.filter(l => l.affordable);
    const okKey = {}; for (const l of aff) okKey[l.key] = 1;
    const dist = pool.POOL[condOf(pool, state, pid)] || pool.MARG;
    for (let tries = 0; tries < 8; tries++) {
      const card = sampleDist(dist, rnd);
      const def = pool.BY_NAME[card];
      if (def && okKey[def.key]) {
        let tg = null;
        if (tgt === 'rand') {
          const alive = [];
          for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) alive.push(i);
          tg = alive.length ? alive[Math.floor(rnd() * alive.length)] : null;
        } else {
          tg = (pid + 1) % state.p.length;
          if (!state.p[tg] || state.p[tg].hp <= 0) tg = pid;
        }
        st.hit++;
        return { key: def.key, target: (def.key === R.SK.JI || def.target === 'self' || tg == null) ? null : tg };
      }
    }
    st.miss++;
    return { key: R.SK.JI, target: null };
  };
  fn.stats = st;          /* 命中条件分布 / 8 次都抽不到而退回 ジ —— 仪器要把"这个池子到底有多吃得上条件"印出来 */
  return fn;
}

/* ---- 自证夹具（门 D209 跑它；形状照 D202/D203 的规矩：合成输入 + 手算值，不跑真引擎 ⇒ <1 秒） ---- */
export function selfTest(mulberry32) {
  const errs = [];
  const R = { SK: { JI: 'ji' }, skills: [
    { name: '枪', key: 'gun', target: 'other' }, { name: '雷', key: 'miniT', target: 'other' }, { name: 'ジ', key: 'ji' }
  ] };
  const W = { EpirusRules: R };
  const pool = { POOL: { '3/0/枪': { '枪': 3, '雷': 1 } }, MARG: { '枪': 1 }, KEY2NAME: { gun: '枪' }, BY_NAME: {
    '枪': R.skills[0], '雷': R.skills[1], 'ジ': R.skills[2] } };
  const mkState = () => ({ p: [{ hp: 5, ep: 6, lastSkill: 'gun' }, { hp: 5 }, { hp: 0 }, { hp: 5 }, { hp: 5 }] });
  const legal = [{ key: 'gun', affordable: true }, { key: 'miniT', affordable: true }, { key: 'ji', affordable: true }];
  /* 手算 1：条件键 = 钱档 3（ep 6>>1=3，上限 5）/ 富有 1（≥5）/ 上一手"枪" ⇒ 命中 POOL['3/1/枪']？
     故意写成"键不对得上"的形状，检查**回退到边际分布**这条路径。 */
  const cond = condOf(pool, { p: [{ hp: 5, ep: 6, lastSkill: 'gun' }] }, 0);
  if (cond !== '3/1/枪') errs.push('条件键算成 ' + cond + '，手算应为 3/1/枪（ep6→档3、≥5⇒富有1、上一手 gun→枪）');
  /* 手算 2：分布 {枪:3, 雷:1} ⇒ rnd=0.5 应取到"枪"（累计 3/4=0.75 > 0.5）；rnd=0.9 应取"雷" */
  if (sampleDist(pool.POOL['3/0/枪'], () => 0.5) !== '枪') errs.push('rnd=0.5 在手算分布 {枪:3,雷:1} 上应取"枪"');
  if (sampleDist(pool.POOL['3/0/枪'], () => 0.9) !== '雷') errs.push('rnd=0.9 应取"雷"（累计到 4/4）');
  if (sampleDist({}, () => 0.1) !== 'ジ') errs.push('空分布必须退回 ジ，而不是返回 undefined');
  /* 手算 3：`next` 指向 ⇒ pid=0 打 1 号位（与 rnd 无关）
     注意 cond 键是 `3/1/枪` 而表里只有 `3/0/枪` ⇒ 这一条**同时**验到"键对不上就回退边际分布"那条路（MARG = {枪:1} ⇒ 必然抽到"枪"）。 */
  const a = makeMimic(W, pool, 'next', () => 0.1)(mkState(), 0, legal);
  if (a.key !== 'gun' || a.target !== 1) errs.push('next 指向：手算应为 gun→1，实测 ' + JSON.stringify(a));
  /* 手算 4：`rand` 指向要**消耗两次** rnd（先抽卡、再指人）⇒ 用序列流 [0.1, 0.5]：
     第二次 0.5 × 活席列表 [1,3,4]（2 号位已死、不许进列表）= 1.5 ⇒ floor=1 ⇒ 席位 **3**。 */
  const seq = (function (xs) { let i = 0; return function () { const v = xs[i % xs.length]; i++; return v; }; })([0.1, 0.5]);
  const b = makeMimic(W, pool, 'rand', seq)(mkState(), 0, legal);
  if (b.key !== 'gun' || b.target !== 3) errs.push('rand 指向：活席 [1,3,4] × rnd 序列 [0.1,0.5] ⇒ 手算应取 index1 = 席位 3，实测 ' + JSON.stringify(b));
  /* 手算 5：条件键**对得上**时必须走那张表，不许偷偷走边际（这一条专门抓"键格式改错了但结果看起来还行"） */
  const pool2 = { POOL: { '3/1/枪': { '雷': 4 } }, MARG: { '枪': 1 }, KEY2NAME: { gun: '枪' },
    BY_NAME: { '枪': R.skills[0], '雷': R.skills[1], 'ジ': R.skills[2] } };
  const c = makeMimic(W, pool2, 'next', () => 0.1)(mkState(), 0, legal);
  if (c.key !== 'miniT') errs.push('条件键命中时不该回退边际分布：实测 ' + JSON.stringify(c));
  /* 反空转：如果 rnd 一次都没被调用（采样根本没跑），上面几条会全对不上 ⇒ 这里显式数一次 */
  let calls = 0;
  const counting = () => { calls++; return 0.1; };
  makeMimic(W, pool, 'next', counting)(mkState(), 0, legal);
  if (calls === 0) errs.push('mimic 一次都没调用随机流 ⇒ 夹具在空转（负对照不许空转）');
  return errs;
}
