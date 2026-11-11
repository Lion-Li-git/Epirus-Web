import { humanPrototypes } from './audit-lib.mjs';
const B = { pickReflectSpam: () => 'reflect', pickDefend: () => 'defend', pickFarmer: () => 'ji', pickGunSpam: () => 'gun', pickDeepSaver: () => 'deep', pickHeavyFire: () => 'heavy' };
const H = humanPrototypes(B);
let bad = 0;
for (const [name, fn] of H) {
  const k = fn({}, 0, []);
  if (typeof k !== 'string' || !k) { console.error('FAIL 原型不是字符串动作：' + name + ' => ' + JSON.stringify(k)); bad++; }
}
const comp = H.filter(h => h[2] === 'deepsaver+reflect' || h[2] === 'heavyfire+reflect');
for (const [name, fn] of comp) { const k = fn({}, 0, []); if (k !== 'reflect') { console.error('FAIL 复合原型没先反弹：' + name + ' => ' + k); bad++; } }
if (bad) process.exit(1);
console.log('✅ humanPrototypes：6 个原型都是字符串动作；两个复合原型在反弹合法时先反弹');
