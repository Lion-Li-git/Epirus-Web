/* 节点研究（用户 01:5x 令：量一次训练内多个节点，判断以后开多少代/轮）
 * Part1 强度：全部 MSB15-*-seg*.bak 走 exam-4n A+B（rounds=4 page dose）→ ck-strength.tsv
 * Part2 技能：每线代表臂的 4 节点走环境矩阵（6桌×2模式）→ ck-matrix.tsv
 * 用法：node ckpt-study.mjs part1|part2 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
const PART = process.argv[2] || 'part1';
const NS = [2, 3, 5, 8], W4 = [0.15, 0.25, 0.45, 0.15];
const F2 = ['MSB11-R2S306293884', 'MSB10-R1S1149480262', 'MSB8-charge-R1S1861674281', 'Q-s47'];
const runExam = (pack) => new Promise((res) => {
  execFile(process.execPath, ['tools/exam-4n.mjs', '4', '77000', pack, '--exam=both', '--champ=' + F2.join(','), '--dose=page'],
    { encoding: 'utf8', maxBuffer: 1 << 24, timeout: 300000 }, (e, so) => {
      const get = (tag, k) => { const line = (so || '').split(/\r?\n/).find((l) => l.indexOf(tag) === 0); const m = line && line.match(new RegExp(' ' + k + '=([-0-9.]+)')); return m ? +m[1] : NaN; };
      const cells = (tag) => NS.map((n) => get(tag, 'x' + n));
      const x4 = (arr) => W4.reduce((s, w, i) => s + w * arr[i], 0);
      const a = x4(cells('[冠军4N]')), b = x4(cells('[冠军4N-B]'));
      res({ a, b, c: (a + b) / 2 });
    });
});
if (PART === 'part1') {
  const OUT = 'scratch/zcode-1111-single-skill/ck-strength.tsv';
  if (!existsSync(OUT)) writeFileSync(OUT, 'pack\tX4A\tX4B\tC\n');
  const segs = readdirSync('docs/artifacts').filter((f) => /^MSB15-.*-seg\d\.bak$/.test(f)).sort();
  const done = new Set(readFileSync(OUT, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t')[0]));
  for (const f of segs) {
    if (done.has(f)) continue;
    const p = 'docs/artifacts/' + f;
    const t = await runExam(p);
    appendFileSync(OUT, [f, t.a.toFixed(4), t.b.toFixed(4), t.c.toFixed(4)].join('\t') + '\n');
    console.log(f.padEnd(46), 'A', t.a.toFixed(3), 'B', t.b.toFixed(3), 'C', t.c.toFixed(3));
  }
  console.log('part1 完成 → ck-strength.tsv');
}
if (PART === 'part2') {
  import('vm').then(async (vm2) => {
    const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
    sb.globalThis = sb;
    for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js'])
      vm2.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
    const W = sb.window, P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots;
    const SKJ = W.EpirusRules.SK.JI;
    const TARGET = { bigt: 'bigT', breadth: '*', curse: 'curse', elec: 'railgun', ring: 'ring', drain2: 'drain', laser: 'laserEye', soupb: '*' };
    const TABS = {
      self: null, script: [B.pickAggro, B.pickDefend, B.pickFarmer, B.pickGunSpam],
      f2: ['MSB11-R2S306293884', 'MSB10-R1S1149480262', 'MSB8-charge-R1S1861674281', 'Q-s47'].map((id) => {
        const p2 = { 'MSB11-R2S306293884': 'docs/artifacts/night-adapt/MSB11-R2S306293884.js', 'MSB10-R1S1149480262': 'docs/artifacts/night-adapt/MSB10-R1S1149480262.js', 'MSB8-charge-R1S1861674281': 'docs/artifacts/night-adapt/MSB8-charge-R1S1861674281.js', 'Q-s47': 'docs/artifacts/e507-out/Q-s47.js' }[id];
        return T.policyChooserN(P.unpack(JSON.parse(readFileSync(p2, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]), true), 0.15);
      }),
      wall: [B.pickReflectSpam, B.pickReflectSpam, B.pickReflectSpam, B.pickReflectSpam],
      farmer: [B.pickFarmer, B.pickCautiousFarmer || B.pickFarmer, B.pickFarmer, B.pickCautiousFarmer || B.pickFarmer],
      aggro: [B.pickAggro, B.pickAttack || B.pickAggro, B.pickBigTFocus || B.pickAggro, B.pickBreakDef || B.pickAggro],
    };
    const OUT = 'scratch/zcode-1111-single-skill/ck-matrix.tsv';
    if (!existsSync(OUT)) writeFileSync(OUT, 'arm\tseg\ttable\tmode\tunionN\ttargetShare\tunionKeys\n');
    const ARMS = ['bigt', 'breadth', 'curse', 'elec', 'ring', 'drain2', 'laser', 'soupb'];
    for (const arm of ARMS) {
      const segs = readdirSync('docs/artifacts').filter((f) => f.startsWith('MSB15-' + arm + '-R1') && /-seg\d\.bak$/.test(f)).sort();
      for (const f of segs) {
        const p = 'docs/artifacts/' + f;
        if (!existsSync(p)) continue;
        const seg = f.match(/-seg(\d)\.bak$/)[1];
        const params = P.unpack(JSON.parse(readFileSync(p, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]), true);
        if (!params) { console.error('不兼容 ' + f); continue; }
        const union = {};
        for (const mode of ['multi', 'long']) for (const tb of Object.keys(TABS)) {
          const counts = {};
          const games = tb === 'self' ? 1 : 2;
          for (let g = 0; g < games; g++) {
            const base = T.policyChooserN(params, 0.15);
            const wrap = (st, pid, legal) => { const r = base(st, pid, legal); const k = typeof r === 'string' ? r : r.key; counts[k] = (counts[k] || 0) + 1; return r; };
            const ch = [];
            for (let i = 0; i < 5; i++) {
              if (tb === 'self') ch.push(wrap);
              else if (i === g % 5) ch.push(wrap);
              else ch.push(TABS[tb][(g + i) % TABS[tb].length]);
            }
            T.oneGameN(ch, 9317 + g * 131 + (mode === 'long' ? 7919 : 0), 5, { mode });
          }
          const tot = Object.entries(counts).filter(([k]) => k !== SKJ).reduce((a, [k, v]) => a + v, 0);
          const keys = Object.keys(counts).filter((k) => k !== SKJ && counts[k] / (tot || 1) >= 0.01);
          const tgt = TARGET[arm] === '*' ? 0 : ((counts[TARGET[arm]] || 0) / (tot || 1));
          appendFileSync(OUT, [arm, seg, tb, mode, keys.length, (tgt * 100).toFixed(1), keys.map((k) => k + ':' + (100 * counts[k] / (tot || 1)).toFixed(0) + '%').join('|')] + '\n');
          console.log(arm.padEnd(8), 'seg' + seg, tb.padEnd(6), mode.padEnd(5), '并集', keys.length, '目标占比', (tgt * 100).toFixed(1) + '%');
        }
        console.log('--- ' + f + ' 完成');
      }
    }
    console.log('part2 完成 → ck-matrix.tsv');
  });
}
