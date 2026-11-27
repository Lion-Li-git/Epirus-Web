import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { humanPrototypes, ROOT } from './audit-lib.mjs';
const B = { pickReflectSpam: () => 'reflect', pickDefend: () => 'defend', pickFarmer: () => 'ji', pickGunSpam: () => 'gun', pickAdaptive: () => 'gun', pickDeepSaver: () => 'deep', pickHeavyFire: () => 'heavy' };
const H = humanPrototypes(B);
let bad = 0;
for (const [name, fn] of H) {
  const k = fn({}, 0, []);
  if (typeof k !== 'string' || !k) { console.error('FAIL 原型不是字符串动作：' + name + ' => ' + JSON.stringify(k)); bad++; }
}
const comp = H.filter(h => h[2] === 'deepsaver+reflect' || h[2] === 'heavyfire+reflect');
for (const [name, fn] of comp) { const k = fn({}, 0, []); if (k !== 'reflect') { console.error('FAIL 复合原型没先反弹：' + name + ' => ' + k); bad++; } }
if (bad) process.exit(1);
console.log('✅ humanPrototypes：7 个原型都是字符串动作；两个复合原型在反弹合法时先反弹');

/* 伤害归因最小自检：直接执行生产文件中的记账片段，避免另抄一份判据。
 * source===to 是伤害返回来源自身（如 transfer 返回），不是该席输出。 */
{
  const pg = readFileSync(join(ROOT, 'training/proto2/pg-train.mjs'), 'utf8');
  const dmgStart = pg.indexOf("        if (DMG_W > 0 && allowPosShape && e.type === 'damage'");
  const dmgEnd = pg.indexOf('\n        }', dmgStart);
  assert.ok(dmgStart >= 0 && dmgEnd > dmgStart, 'locate pg-train dmgW block');
  const applyDmgW = new Function('e', 'seat', 'DMG_W', 'allowPosShape', 'ai', 'ds', 'shape', 'stat',
    pg.slice(dmgStart, dmgEnd + '\n        }'.length) + '\nreturn { shape: Array.from(shape), dmgAmt: stat.dmgAmt };');
  const dmgW = (e) => applyDmgW(e, 0, 2, true, 0, [{}], [0], { dmgAmt: 0 });
  assert.deepEqual(dmgW({ type: 'damage', source: 0, to: 0, target: 1, amt: 7 }),
    { shape: [0], dmgAmt: 0 }, 'dmgW excludes source===to return damage');
  assert.deepEqual(dmgW({ type: 'damage', source: 0, to: 1, target: 0, amt: 3 }),
    { shape: [4], dmgAmt: 3 }, 'dmgW uses to, not target, for outgoing damage');
  assert.deepEqual(dmgW({ type: 'damage', source: null, to: 1, amt: 3 }),
    { shape: [0], dmgAmt: 0 }, 'dmgW excludes unattributed environmental damage');

  const evo = readFileSync(join(ROOT, 'js/train/evo.js'), 'utf8');
  const rankStart = evo.indexOf('    const n = st.p.length;', evo.indexOf('function rankOf'));
  const rankEnd = evo.indexOf('    const order = [];', rankStart);
  assert.ok(rankStart >= 0 && rankEnd > rankStart, 'locate rankOf damage accumulation');
  const accumulate = new Function('st', evo.slice(rankStart, rankEnd) + '\nreturn { taken, dealt };');
  assert.deepEqual(accumulate({
    p: [{ hp: 3 }, { hp: 3 }],
    events: [
      { type: 'damage', source: 0, to: 0, amt: 7 },
      { type: 'damage', source: 0, to: 1, amt: 3 },
      { type: 'damage', source: null, to: 1, amt: 2 },
    ],
  }), { taken: [7, 5], dealt: [3, 0] }, 'rankOf dealt excludes source===to and source=null');

  const diagnostic = readFileSync(join(ROOT, 'docs/research/evidence-2026-11-26-value-coverage/transfer-outcome-diagnostic.mjs'), 'utf8');
  const takenLine = diagnostic.split('\n').find((line) => line.includes('row.damageEvents++'));
  assert.ok(takenLine, 'locate transfer diagnostic damage counter');
  const countTaken = new Function('e', 'seat', 'row', takenLine.trim());
  const row = () => ({ damageEvents: 0, tankDamage: 0 });
  const selfReturn = row();
  countTaken({ type: 'damage', source: 0, to: 0, target: 1, via: 'tank', amt: 7 }, 0, selfReturn);
  assert.deepEqual(selfReturn, { damageEvents: 1, tankDamage: 1 }, 'diagnostic counts damage actually taken via to');
  const outgoing = row();
  countTaken({ type: 'damage', source: 0, to: 1, target: 0, via: 'tank', amt: 7 }, 0, outgoing);
  assert.deepEqual(outgoing, { damageEvents: 0, tankDamage: 0 }, 'diagnostic ignores target and outgoing damage');
  console.log('damage attribution: dmgW/rankOf exclude source===to; diagnostic counts e.to===seat');
}
