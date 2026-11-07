
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js',
  'js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, B = sb.EpirusBots, S = sb.EpirusState, Play = sb.EpirusPlay, R = sb.EpirusRules, P = sb.EpirusPolicy;
P.setRng(T.mulberry32(7919 + 13));
const params = P.unpack(sb.EPIRUS_CHAMPION || null) || null;
let branch = { charged: 0, ep: 0, noMirror: 0, tooFew: 0 };
const dmg = {};
for (let g = 0; g < 200; g++) {
  const st = S.createState('multi', { next: T.mulberry32(77000 + g) }, 5);
  const mkMirror = (state, pid, legal) => {
    const bk = {}; for (const l of legal) bk[l.key] = l;
    if (!(bk[R.SK.MIRROR] && bk[R.SK.MIRROR].affordable)) { branch.noMirror++; return { key: R.SK.JI, target: null }; }
    const opps = []; for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) opps.push(i);
    if (opps.length < 2) { branch.tooFew++; return { key: R.SK.JI, target: null }; }
    let charged = 0; for (const i of opps) if (state.p[i].lastSkill === R.SK.CHARGE) charged++;
    if (charged) branch.charged++; else branch.ep++;
    return B.pickMirrorSpam(state, pid, legal);
  };
  const champ = params ? function (state, pid, legal) {
    const aff = legal.filter(l => l.affordable);
    const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    return T.pickChampion(state, pid, base, params, 0.15);
  } : B.pickGunSpam;
  const sels = [T.wrapBotN(champ), T.wrapBotN(mkMirror), T.wrapBotN(B.pickRandom), T.wrapBotN(B.pickRandom), T.wrapBotN(B.pickRandom)];
  Play.autoGameN(st, sels);
  for (const e of st.events) if (e.type === 'damage' && e.source === 1) dmg[e.via || '?'] = (dmg[e.via || '?'] || 0) + (e.amt || 0);
}
console.log('分支计数（200 局 5P，1 冠军 + 1 镜面 + 3 random）：', JSON.stringify(branch));
console.log('镜面造成的伤害按 via：', JSON.stringify(dmg), ' 合计', Object.values(dmg).reduce((a,b)=>a+b,0), '= 每局 ' + (Object.values(dmg).reduce((a,b)=>a+b,0)/200).toFixed(2));
