/* 侵略性双场探针（v1.5.61，用户质疑 F 的考核依据后重做）。
 *
 * 旧 F（audit-lib.fieldRate）的两处结构问题：
 *   ① 场地名不副实：所谓"活跃场"只有 1 席脚本进攻者，其余 4 席是**冠军自己的副本**
 *      ⇒ 冠军主要在跟自己打，F 低更像自对局均衡，而不是"面对猛攻不还手"；
 *   ② 分子是硬编码 6 张卡名单（gun/sword/snipe/tank/railgun/drain），
 *      而数据驱动看真正带伤害的还有 bigT/dualGun ⇒ 冠军改用大雷就被算成"没进攻"。
 *
 * 本探针改为**两个对置场 + 结果型指标**：
 *   场 A（被集火）：4 席脚本猛攻 vs 1 席冠军  ⇒ 量"还手率 + 造成伤害/局 + 承受伤害/局 + 胜负"
 *   场 B（无压）  ：4 席只ジ   vs 1 席冠军  ⇒ 量"没人打它时会不会主动打"
 * 冠军座位**逐局轮换**（g % 5），避免座位相位污染；伤害归因用事件真字段 `source`（已打印确认）。
 * 分子同时报两种口径：旧白名单 / 数据驱动（`def.dmg` 存在）。
 * 用法：node tools/probe-aggr.mjs <file...> [GAMES]
 */
import { sandbox, mulberry32, loadChamp } from './audit-lib.mjs';
const W = sandbox();
const R = W.EpirusRules, S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay;
const OLD = [R.SK.GUN, R.SK.SWORD, R.SK.SNIPE, R.SK.TANK, R.SK.RAILGUN, R.SK.DRAIN];
const isDmg = function (k) { const d = R.byKey[k]; return !!(d && d.dmg && d.dmg.amt); };
const args = process.argv.slice(2);
const G = Number(args[args.length - 1]) || 40;
const files = args.filter(function (a) { return !/^\d+$/.test(a); });

function runField(params, kind, GAMES) {
  let myAtkOld = 0, myAtkNew = 0, myActs = 0, dealt = 0, taken = 0, wins = 0, draws = 0, rounds = 0, oppAtk = 0;
  for (let g = 0; g < GAMES; g++) {
    const me = g % 5;
    const st = S.createState('multi', { next: mulberry32(15000 + g) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const r = mulberry32(20000 + g);
    const scripted = (kind === 'aggr')
      ? function (state, pid, legal) {
        const a = legal.filter(function (x) { return x.affordable && OLD.indexOf(x.key) >= 0; });
        if (a.length) { const o = S.opponentsOf(state, pid); return { key: a[0].key, target: o[Math.floor(r() * o.length)] }; }
        return { key: R.SK.JI };
      }
      : function () { return { key: R.SK.JI }; };
    const champ = T.policyChooserN(params, 0.15);
    const ch = [];
    for (let i = 0; i < 5; i++) ch.push(i === me ? champ : scripted);
    Play.autoGameN(st, ch);
    rounds += st.round;
    for (const e of st.events) {
      if (e.type === 'action' && e.outcome === 'ok') {
        if (e.pid === me) {
          myActs++;
          if (OLD.indexOf(e.key) >= 0) myAtkOld++;
          if (isDmg(e.key)) myAtkNew++;
        } else if (kind === 'aggr' && OLD.indexOf(e.key) >= 0) oppAtk++;
      } else if (e.type === 'damage') {
        if (e.source === me) dealt += e.amt;
        if (e.to === me) taken += e.amt;
      }
    }
    if (st.winner === me) wins++;
    if (st.winner === 'draw' || st.winner == null) draws++;
  }
  return {
    actsPerGame: myActs / GAMES, atkOld: myActs ? myAtkOld / myActs : 0, atkNew: myActs ? myAtkNew / myActs : 0,
    dealt: dealt / GAMES, taken: taken / GAMES, winRate: wins / GAMES, drawRate: draws / GAMES,
    rounds: rounds / GAMES, oppAtkPerGame: oppAtk / GAMES
  };
}

console.log('文件'.padEnd(30) + '| 场        | 出手/局 旧进攻% 新进攻%  造成伤/局 承受伤/局 胜率  平局  回合  对手进攻/局');
for (const f of files) {
  try {
    const params = loadChamp(W, f);
    const nm = f.replace('docs/artifacts/', '').replace('js/', '');
    for (const kind of ['aggr', 'calm']) {
      const x = runField(params, kind, G);
      console.log(nm.padEnd(30) + '| ' + (kind === 'aggr' ? '被集火' : '无压  ') + '  |' +
        x.actsPerGame.toFixed(1).padStart(8) +
        (x.atkOld * 100).toFixed(0).padStart(7) + '%' +
        (x.atkNew * 100).toFixed(0).padStart(7) + '%' +
        x.dealt.toFixed(2).padStart(10) +
        x.taken.toFixed(2).padStart(10) +
        (x.winRate * 100).toFixed(0).padStart(6) + '%' +
        (x.drawRate * 100).toFixed(0).padStart(6) + '%' +
        x.rounds.toFixed(1).padStart(7) +
        x.oppAtkPerGame.toFixed(1).padStart(14));
    }
  } catch (e) { console.log(f.padEnd(30) + '| 读失败: ' + String(e && e.message || e).slice(0, 50)); }
}
