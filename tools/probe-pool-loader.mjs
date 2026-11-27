import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { rejectUnknownFlags } from './audit-lib.mjs';

if (process.argv[1] && process.argv[1].endsWith('probe-pool-loader.mjs')) {
  rejectUnknownFlags(process.argv.slice(2), [], 'probe-pool-loader');
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(ROOT, 'js/pool-loader.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const widOf = pack => createHash('sha1').update(JSON.stringify(pack.a)).digest('hex').slice(0, 16);

function makeLoader(members, opts) {
  const scripts = [];
  const timeouts = [];
  const warnings = [];
  const crypto = opts && opts.noCrypto ? null : {
    subtle: {
      digest: async (_alg, data) => {
        const hex = createHash('sha1').update(Buffer.from(data)).digest('hex');
        return Uint8Array.from(hex.match(/../g).map(x => parseInt(x, 16))).buffer;
      },
    },
  };
  const w = {
    location: { protocol: 'http:' }, crypto, TextEncoder,
    console: { warn: msg => warnings.push(msg) },
    EpirusPoolPacks: {},
    EPIRUS_CHAMPION_POOL: { lazy: true, ver: 'probe', members },
  };
  const box = {
    window: w, document: {
      createElement: () => ({}),
      head: { appendChild: s => scripts.push(s) },
    },
    location: w.location, crypto, TextEncoder, console: w.console,
    setTimeout: fn => { timeouts.push(fn); return timeouts.length; },
    clearTimeout: id => { timeouts[id - 1] = null; },
  };
  box.globalThis = box;
  vm.runInNewContext(source, box, { filename: 'js/pool-loader.js' });
  return {
    loader: w.EpirusPoolLoader, scripts, timeouts, warnings,
    timeout: i => timeouts[i](),
    shard: (i, id, pack) => { w.EpirusPoolPacks[id] = pack; scripts[i].onload(); },
    fail: i => scripts[i].onerror(),
    monolith: (i, fullMembers) => {
      w.EPIRUS_CHAMPION_POOL = { members: fullMembers };
      scripts[i].onload();
    },
  };
}

const packA = { a: [1, 2, 3] };
const packB = { a: [4, 5, 6] };
const wrong = { a: [9, 9, 9] };
const memberA = { id: 'A', wid: widOf(packA), file: 'A.js' };
const memberB = { id: 'B', wid: widOf(packB), file: 'B.js' };

const race = makeLoader([memberA, memberB]);
const raceDone = race.loader.ensure(['A', 'B']);
race.fail(1);
await flush();
race.monolith(2, [
  { id: 'A', wid: memberA.wid, pack: packA },
  { id: 'B', wid: memberB.wid, pack: packB },
]);
await raceDone;
race.shard(0, 'A', wrong);
await flush();
await flush();
assert.equal(race.loader.get('A'), packA, '晚到分片不得覆盖回退整表');
assert.equal(race.loader.fellBack(), true);

const mismatch = makeLoader([memberA]);
const mismatchDone = mismatch.loader.ensure(['A']);
mismatch.shard(0, 'A', wrong);
await flush();
assert.equal(mismatch.scripts.length, 2, 'wid 不符必须触发整表回退');
mismatch.monolith(1, [{ id: 'A', wid: memberA.wid, pack: packA }]);
await mismatchDone;
assert.equal(mismatch.loader.get('A'), packA, 'wid 不符的分片不得进入注册表');
assert.equal(mismatch.loader.fellBack(), true);
assert.ok(mismatch.warnings.some(msg => String(msg).includes('wid')), 'wid 不符必须响亮说明');

const hung = makeLoader([memberA]);
const hungDone = hung.loader.ensure(['A']);
hung.timeout(0);
await flush();
hung.monolith(1, [{ id: 'A', wid: memberA.wid, pack: packA }]);
await hungDone;
assert.equal(hung.loader.get('A'), packA, '加载超时必须回退整表而不是永久 pending');
assert.equal(hung.loader.fellBack(), true);

const insecure = makeLoader([memberA], { noCrypto: true });
const insecureDone = insecure.loader.ensure(['A']);
insecure.shard(0, 'A', packA);
await insecureDone;
assert.equal(insecure.loader.get('A'), packA, '不安全 HTTP 下缺少 crypto.subtle 也必须能用纯 JS SHA-1 校验分片');

const truncated = makeLoader([memberA, memberB]);
const truncatedDone = truncated.loader.ensure(['A', 'B']);
truncated.fail(0);
truncated.fail(1);
await flush();
truncated.monolith(2, [{ id: 'A', wid: memberA.wid, pack: packA }]);
await assert.rejects(truncatedDone, /成员数量/);

const duplicated = makeLoader([memberA, memberB]);
const duplicatedDone = duplicated.loader.ensure(['A', 'B']);
duplicated.fail(0);
duplicated.fail(1);
await flush();
duplicated.monolith(2, [
  { id: 'A', wid: memberA.wid, pack: packA },
  { id: 'A', wid: memberA.wid, pack: packA },
]);
await assert.rejects(duplicatedDone, /重复 ID/);

console.log('POOL_LOADER_SELFTEST OK（晚到分片不覆盖整表；wid 不符、超时、截断与重复均触发回退；无 Web Crypto 可用）');
