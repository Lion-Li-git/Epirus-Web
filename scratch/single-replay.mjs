#!/usr/bin/env node
/* single-replay.mjs —— 单枚 v7 包复刻驱动（era 委托）
 * 用法：node scratch/single-replay.mjs <id> <seed> <era> <envK1=V1;envK2=V2...> <ledgerPath|-> <widTarget>
 * 例：node scratch/single-replay.mjs V2-31 31 42d7c86e "EPIRUS_SEL_KEEP=0.35" docs/artifacts/e68-out/V2-31.bak 75019bc522e9cbae
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { widOf } from '../champion-map/pack-id.mjs';

const [id, seed, era, envStr, ledgerPath, target] = process.argv.slice(2);
const LDEMO = 'D:/code/Epirus-Web/docs/artifacts/eval-out/win-Ldemo.bak';
const out = `scratch/v7-mined/bfam/${id}.js`;
const env = {
  ...process.env,
  EPIRUS_HOTSTART: '1',
  EPIRUS_SEEDPACK: LDEMO,
  EPIRUS_SEED: String(seed),
  EPIRUS_ARM: id,
  EPIRUS_T3P_OUT: out,
  EPIRUS_BAND_DIR: `scratch/v7-mined/bfam/bands/${id}`,
};
for (const kv of (envStr || '').split(';').filter(Boolean)) {
  const i = kv.indexOf('=');
  env[kv.slice(0, i)] = kv.slice(i + 1);
}
console.log(`▶ ${id}（era=${era} seed=${seed} ${envStr || '纯'}）→ 目标 ${target}`);
const res = spawnSync(process.execPath, ['training/train.mjs', '--mode=v7', '--era=' + era, '1200', '3', '8', '8'], {
  env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 45 * 60000,
});
if (existsSync(out)) {
  const w = widOf(readFileSync(out, 'utf8'));
  const hit = w === target;
  console.log(`${hit ? '✅ 命中' : '✗ 未中 ' + w}（want ${target}）`);
  if (hit && ledgerPath && ledgerPath !== '-') {
    mkdirSync(dirname(ledgerPath), { recursive: true });
    copyFileSync(out, ledgerPath);
    const p = 'docs/ARTIFACT-LOSS-1119.tsv';
    const lines = readFileSync(p, 'utf8').split('\n');
    const si = lines[0].split('\t').indexOf('state');
    let n = 0;
    for (let i2 = 1; i2 < lines.length; i2++) {
      const c = lines[i2].split('\t');
      if (c.length && c[0] === id && c[si] === 'missing') { c[si] = 'ok'; lines[i2] = c.join('\t'); n++; }
    }
    writeFileSync(p, lines.join('\n'));
    spawnSync('git', ['add', '-f', ledgerPath], { encoding: 'utf8' });
    spawnSync('git', ['add', 'docs/ARTIFACT-LOSS-1119.tsv'], { encoding: 'utf8' });
    console.log('台账翻', n, '行 + git add');
  }
} else {
  console.log('✗ 未落盘 exit=' + res.status + ' tail: ' + String((res.stdout || '') + (res.stderr || '')).slice(-200).replace(/\n/g, ' '));
  process.exit(1);
}
