/* 控制臂距离：同种子、同配置、配额未触发 ⇒ 权重是否相同？读数是否相同？ */
import fs from 'fs';
const load = (t) => JSON.parse(fs.readFileSync('scratch/arms/' + t + '.bak', 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
for (const [x, y] of [['LEX-s13', 'LEXQ-s13'], ['LEX-s17', 'LEXQ-s17']]) {
  const a = load(x).a, b = load(y).a;
  let s = 0, mx = 0, same = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; if (Math.abs(d) > mx) mx = Math.abs(d); if (d === 0) same++; }
  console.log(x + ' vs ' + y + '：维数 ' + a.length + ' 逐位相同 ' + same + ' 个 ‖ L2 差 ' + Math.sqrt(s).toFixed(4) + ' ‖ 最大差 ' + mx.toFixed(6));
}
