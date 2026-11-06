/* cd-visibility.mjs — "技能都可见了，为啥信息还不够"这句话的取证。
 *  量三件事，全在真局的决策点上：
 *   ① 面里现在有什么：每席 lastSkill 键身份 + 最近 4 回合键 bag（obs3b 新增）——先确认它真的非零；
 *   ② 面里缺什么：p.cooldown（被大雷 ban 掉的键，4 回合）——2.0 两张脸都没有，而 v7 打分器自己吃了它
 *      （`policy.js:242` 的 cdCount(me) 与 anyOp(cdCount)）⇒ 先量它到底常不常见，别又凭措辞下判语；
 *   ③ 真私有的是哪一维：对手的珠（elec/boom 种类）——obs3.mjs:16 记的泄漏事故就是给它编码。
 * 只读 tools/** 与 js/**，不落产物。 */
import { sandbox, loadChamp, mulberry32 } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import * as O3 from '../tools/proto2/obs3.mjs';

const PACK = process.argv[2] || 'scratch/arms/gd3b-ks-sb.bak';
const W = sandbox();
const ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
let params;
if (PACK === 'v7') {
  params = Float64Array.from(ref);          /* 线上冠军自己：它会打大雷 ⇒ 这是"ban 到底常不常见"的公平分母 */
} else {
  const raw = readPack2(PACK);
  const got = packCfgExit(raw, PACK);
  installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
  params = Float64Array.from(W.EpirusPolicy.unpack(raw, true));
}
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules;
let seed = 4242;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const DEC = 900;
const st = { decs: 0, anyOppBanned: 0, selfBanned: 0, banKeys: {}, epGe2Opp: 0, oppHasBeadBits: 0 };
let g = 0;
while (st.decs < DEC && g < 600) {
  g++;
  const s = S.createState('multi', { next: T.mulberry32(2000 + g) }, 4);
  s.slotSalt = (g * 7919) % 100000;
  const ch = T.policyChooserN(params, 0.15);
  for (let r = 0; r < 30 && !s.over; r++) {
    for (let pid = 0; pid < 4; pid++) {
      if (s.p[pid].hp <= 0) continue;
      const legal = Play.legalActions(s, pid);
      if (st.decs < DEC) {
        st.decs++;
        const me = s.p[pid];
        const opps = s.p.filter((q, i) => i !== pid && q.hp > 0);
        const cdOf = (q) => Object.keys(q.cooldown || {}).filter((k) => q.cooldown[k] > 0);
        if (cdOf(me).length) st.selfBanned++;
        const anyBan = opps.some((q) => cdOf(q).length > 0);
        if (anyBan) st.anyOppBanned++;
        for (const q of opps) for (const k of cdOf(q)) st.banKeys[k] = (st.banKeys[k] || 0) + 1;
        if (opps.some((q) => (q.ep || 0) >= 2)) st.epGe2Opp++;
        /* 对手的珠：面里根本没有这一维 ⇒ 只能用引擎真值证明"它确实非平凡" */
        if (opps.some((q) => (q.elec || 0) + (q.boom || 0) > 0)) st.oppHasBeadBits++;
      }
      const pk = ch(s, pid, legal);
      S.attemptAction(s, pid, pk.key, { target: pk.target, target2: pk.target2, bead: pk.bead });
    }
    W.EpirusResolve.resolveActions(s);
    W.EpirusResolve.endTurn(s);
  }
}

const pc = (x) => (100 * x / st.decs).toFixed(1) + '%';
console.log('# 决策点分母 ' + st.decs + '（真局 ' + g + ' 局，4 人桌，起点包 ' + PACK.replace(/^.*[\\/]/, '') + '）');
console.log('② 冷却（被大雷 ban）：**至少一个对手有键被 ban** 的决策点 ' + pc(st.anyOppBanned) + '（' + st.anyOppBanned + '）' +
  ' ‖ 自己被 ban ' + pc(st.selfBanned));
const bk = Object.entries(st.banKeys).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + '×' + v);
console.log('   被 ban 的键 Top：' + (bk.join(' ‖ ') || '（一次都没发生）'));
console.log('   ⇒ 2.0 两张脸（obs3/obs3b）里 cooldown 的列数：' +
  ['obs3', 'obs3b'].map((v) => v + '=' + O3.blocks(R, v).filter((x) => /cool|ban/i.test(x.name)).length).join(' ‖ ') +
  ' ‖ 而 v7 打分器自己吃了两列（policy.js:242 cdCount(me) 与 anyOp(cdCount)）');
console.log('③ 对手有珠（引擎真值，非平面可见）的决策点 ' + pc(st.oppHasBeadBits) + ' ‖ 对手 ep≥2 的决策点 ' + pc(st.epGe2Opp));
console.log('① 面里有的：每席 lastSkill 键身份 + 最近 4 回合键 bag（obs3b 新增 '+
  O3.blocks(R, 'obs3b').filter((x) => /lsKey/.test(x.name)).length + ' 列 lsKey ‖ ' +
  O3.blocks(R, 'obs3b').filter((x) => /bag/i.test(x.name)).length + ' 列 bag，obs3 各为 ' +
  O3.blocks(R, 'obs3').filter((x) => /lsKey/.test(x.name)).length + ' / ' +
  O3.blocks(R, 'obs3').filter((x) => /bag/i.test(x.name)).length + '）');
