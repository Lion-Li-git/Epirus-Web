import { readFileSync } from 'node:fs';

for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, 'utf8');
  const values = { hard: [], regular: [], sparring: [] };
  for (const m of text.matchAll(/困难 · 冠军\s+替身夺冠 ([\d.]+)%/g)) values.hard.push(Number(m[1]));
  for (const m of text.matchAll(/普通（默认）\s+替身夺冠 ([\d.]+)%/g)) values.regular.push(Number(m[1]));
  for (const m of text.matchAll(/简单 · 陪练\s+替身夺冠 ([\d.]+)%/g)) values.sparring.push(Number(m[1]));
  const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  console.log(JSON.stringify({ file, n: values.hard.length, hard: avg(values.hard), regular: avg(values.regular), sparring: avg(values.sparring), values }));
}
