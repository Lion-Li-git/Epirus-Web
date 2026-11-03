/* 只读诊断：三枚代 2 包的**权重是否真的不同**、在同一夹具上**打分是否真的不同**
   起因：game-record 落的两份 5P 记录正文逐字相同（diff=0），而包文件 md5 不同 ⇒ 要么"不同权重同一策略"，
   要么装载/记录有一条静默的错线。这里分开量：① a[] 本体 ② 同夹具 logits */
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2 } from '../tools/proto2/arch2.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;

const packs = ['GEN2-s7', 'GEN2-s11', 'GEN2-s13', 'PERN-s13'].map((n) => ({ n, raw: readPack2('scratch/arms/' + n + '.bak') }));
const hash = (a) => { let h = 2166136261 >>> 0; for (let i = 0; i < a.length; i++) { const x = Math.round(a[i] * 1e9) | 0; h = (h ^ x) >>> 0; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
console.log('=== ① 权重本体 ===');
for (const p of packs) {
  const a = p.raw.a;
  console.log('  ' + p.n.padEnd(10) + ' v=' + p.raw.v + ' ‖ n=' + a.length + ' ‖ a[] 哈希=' + hash(a) +
    ' ‖ 前 4 条=[' + a.slice(0, 4).map((x) => Number(x).toFixed(5)).join(', ') + ']');
}
const samePair = [];
for (let i = 0; i < packs.length; i++) for (let j = i + 1; j < packs.length; j++) {
  const A = packs[i].raw.a, B = packs[j].raw.a;
  let d = 0; if (A.length === B.length) for (let k = 0; k < A.length; k++) if (A[k] !== B[k]) d++;
  samePair.push(packs[i].n + '↔' + packs[j].n + ' 差 ' + d + ' 条');
}
console.log('  两两逐条比：' + samePair.join(' ‖ '));

console.log('\n=== ② 同一夹具上的 logits（代 2 档装载）===');
let seed = 4242;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const st = S.createState('multi', { next: rng }, 5);
st.rng = { next: rng };
st.round = 5;
for (let i = 0; i < 5; i++) { st.p[i].hp = ((i % 3) + 1); st.p[i].ep = 2 + i; st.p[i].lastSkill = i === 1 ? 'gun' : null; }
const cands = P.candidatesFor(st, 0, T.econBase(st, 0, Play.legalActions(st, 0)), { lockTarget: false });
console.log('  候选 ' + cands.length + ' 枚（本夹具）');
for (const p of packs) {
  if (p.raw.v !== 91) { console.log('  ' + p.n + ' 是 v=' + p.raw.v + '（代 1）⇒ 本诊断跳过它，只比代 2'); continue; }
  const cfg = Object.assign({ mutMode: 'seg' }, p.raw.dims);
  const A = installArch2(W, cfg);
  A.rngRef.r = T.mulberry32(4242);
  const params = P.unpack(p.raw);
  if (!params) { console.log('  ' + p.n + ' unpack 失败 ⇒ ' + JSON.stringify(P.checkPack(p.raw))); A.restore(); continue; }
  const f = P.forwardCands(st, 0, cands, params, { temp: 0.15 });
  const s = Array.from(f.logits).map((x) => Number(x).toFixed(3)).join(',');
  console.log('  ' + p.n.padEnd(10) + ' logits 前 8=[' + Array.from(f.logits).slice(0, 8).map((x) => Number(x).toFixed(2)).join(',') + '] ‖ argmax=' + f.argmax +
    ' ‖ 出手=' + ((cands[f.argmax] || {}).key || '?') + ' ‖ 全串哈希=' + hash(Float64Array.from(f.logits)));
  A.restore();
}
