/* duel-run.mjs —— §E334 把 §E289 那台 A/B 配对决斗搬进入库，并且**按 coords.tsv 的 path 列找包**。
 *
 * 为什么要搬（旧稿住在 gitignored 的 docs/artifacts/e287-out/）：
 *   ① 它的 `packPath()` 按 `docs/artifacts/<id>.bak` 猜路径 ⇒ 正是 §E330 抓到的那个洞：
 *      同名旧拷贝在场，量出来的"那枚"可能根本不是图上的那枚（谱系图 181 枚叠在同一秒就是这么来的）。
 *   ② 它的候选表是 `e287-panel2-22.tsv`（718 枚那版），看不见 §E329 扩进来的 183 枚子代。
 *   ⇒ 现在候选与路径都读 `coords.tsv`（名单/路径/读数同表同序），并且**自检不过就红着退出**。
 *
 * 双臂（每枚候选跑两次，互为攻守）：
 *   A = style-exam(受试 = 候选, 场 = 4 × 现役) → 候选在"现役场"里的夺 1 率
 *   B = style-exam(受试 = 现役, 场 = 4 × 候选) → 现役在"候选场"里的夺 1 率
 *   读数 = A − B（>0 ⇒ **在这副桌的配对里**前者占优）。地板 = 20%（1 打 4，对称策略下各席等权）。
 *   ⚠ **这不是强度、不许读成"强 X pt"、不许跨参照传递**（`docs/METHODOLOGY.md` 第 110 条 10-08 §E495b ‖ 第 114 条 10-09 §E524/§E526）。
 *     用法头原来写的是"（>0 ⇒ 候选更强）"——那句话和 110/114 冲突，10-11 §E584 又一次实测到它不传递（预测 −3.05 ‖ 实测 +15.28 ‖ 偏差 18.3pt=3.9σ）。
 *     ⇒ 引用必须连参照一起说（"X 在现役场里 +15.3"），要排名次就两两全跑成矩阵并明写传递性；换代决策请用**可加口径**（考卷/覆盖度/人席均值/Δε）。
 *   ⚠ A 与 B 不是同一局轨迹（换受试者会换随机流消耗）⇒ 这是"同批种子 + 同座位表"的配对，不是逐局同轨迹配对。
 *   自检：现役 vs 现役 ⇒ A−B 必须**恰好 0**，不为 0 就是仪器坏了（旧稿只打印，这里直接 exit 2）。
 *
 * 用法：node champion-map/duel-run.mjs [--ids=a,b | --top=8] [--games=60] [--seed=77000] [--out=duel-e334-s77000.tsv]
 *        [--ref=<id，**默认 = 活槽现主**（问 slot-identity）> | --ref=<相对路径，如 js/bundled-champion-3p.js>] [--cand=id=相对路径,id2=相对路径2]
 *        # §E583：`--cand=` 让没进过 coords.tsv 的包（训练臂/本地实验件）上这台尺
 *        # §E588：`--ref=` 同样收路径（换代当天"现役"会换主人 ⇒ 参照必须能点名到文件），两种写法都在头行印 wid
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { widOf } from './pack-id.mjs';
import { load as loadSlotId } from './slot-identity.mjs';   /* 现役（活槽现主）只问这一处 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');   /* §E333 本仓工作树是 CRLF，末列会带裸 \r */
const GAMES = Number(arg('games', 60)) || 60;
const SEED = String(Number(arg('seed', 77000)) || 77000);
const MODE = 'multi';
/* §E607（DS 10-14）：**参照 = 活槽现主**，只问 `slot-identity`；不许写死旧名。
 * 病（实测）：这里原来是 `arg('ref', 'SHIPPED-Ldemo')`，而活槽 10-11（`2f88f09` v1.6.62）起住的是 `T8-s114`
 *   ⇒ 不带 `--ref=` 跑出来的 A−B 讲的是"对那枚退役旧冠军"，而上面第 10-11 行那句"4 × 现役"其实名不副实。
 *   （`viewer.mjs` 里也记着这条：`duel-run.mjs:37 的默认参照至今仍是 SHIPPED-Ldemo，而它 10-11 就退役了`。）
 * ⚠ 换了主语必须印出来：参照是谁、wid、以及这次是"默认值"还是"你点的"。 */
const SID = loadSlotId(ROOT);        /* 现役 + 副名翻译：这一份是唯一来源 */
const REF_DEFAULT = (function () {
  const L = SID.live;
  if (!L.coordsId) { console.error('⛔ slot-identity 解不出活槽现主 ⇒ `--ref=` 没有可用的默认值，请显式给一个'
    + '（换代当天补 slot-history.tsv 一行并重跑 slot-timeline.mjs）'); process.exit(2); }
  return L.coordsId; })();
const REF = arg('ref', REF_DEFAULT);
if (REF === REF_DEFAULT) console.log('参照（默认 = slot-identity.live）= ' + REF + '（要换参照用 `--ref=<id 或相对路径>`）');
/* §E607（DS 10-14）第二件：`--ref=` 也要收**副名**（`SHIPPED-Ldemo` 这类当年的叫法）。
 * 折行（v1.7.7）之后副名只住在 `coords.tsv` 的 `aliasIds` 列里、**不再是行 id** ⇒ 直接 `RAW.find(id===REF)`
 *   会掉进下面那道"参照枚找不到文件"（实测：旧默认 `--ref=SHIPPED-Ldemo` 当场 **exit 2**，不是跑不了，是名字不在表里了）。
 *   一律走 `slot-identity.resolve` 这一份单一来源；翻不动就原样留着，让那道 exit 2 照旧点名。
 *   ⚠ 这是今早那族"别名轮询漏消费者"的**又一台**（`ruler-measure`/`usage-probe`/`pool-sync` 当时修了，这台漏了）。 */
const refIsPath = REF.indexOf('/') >= 0 || /\.(bak|js)$/.test(REF);
const REFID = refIsPath ? REF : (SID.resolve(REF) || REF);
if (!refIsPath && REFID !== REF) console.log('参照名 `' + REF + '` 是副名 ⇒ 按指针翻成图上的主名 `' + REFID + '`');

/* ---- 候选 = coords.tsv（id ‖ path  F ‖ rank），路径**一律读表里的 path 列** ---- */
const CL = rd(join(HERE, 'coords.tsv')).trim().split('\n'), ch = CL[0].split('\t');
const iId = ch.indexOf('id'), iPath = ch.indexOf('path'), iF = ch.indexOf('F'), iR = ch.indexOf('rank');
if (iPath < 0) { console.error('⛔ coords.tsv 没有 path 列 ⇒ 先跑 node champion-map/attach-path.mjs'); process.exit(2); }
const RAW = CL.slice(1).map(l => { const c = l.split('\t');
  return { id: c[iId], path: c[iPath], F: Number(c[iF]), rank: Number(c[iR]) }; })
  .filter(r => r.id && r.path);
/* §E364 这里原来把"剔除参照枚"和"取全量"写在同一个 filter 里，而下面的 refRow 又是从这个**已剔除 REF**
 *   的列表里找 ⇒ 用法头虽然写着支持 --ref=，实际只有默认值能跑（拿 --ref=v7beadseed-82 会报
 *   "参照枚找不到文件"，而那个 .bak 明明在盘上）。⇒ 全量留一份 RAW 专门给参照枚查。 */
/* ===== §E583：`--cand=id=相对路径[,...]` —— 让**没进过 coords.tsv 的包**也能上这台尺 =====
 * 为什么要：训练臂（如 `docs/artifacts/opphuman/s302-off-h2/*.bak`）住在 gitignored 目录、有意不进谱系图 ⇒
 *   原来候选只能按 id 从 coords.tsv 查路径，这类包**根本进不了决斗**（不是不想跑，是跑不了）。
 * 只扩候选名单：档 ‖ 双臂 ‖ 自检 ‖ 输出格式都不动。
 * ⚠ 撞名直接退出（§E330 那个"同名旧拷贝"的洞：find 只回第一条，撞名就等于"量的不是那枚"）。 */
const EXTRA = String(arg('cand', '')).split(',').map(s => s.trim()).filter(Boolean).map((s, i) => {
  const eq = s.indexOf('=');
  const id = eq < 0 ? '' : s.slice(0, eq);
  const path = eq < 0 ? '' : s.slice(eq + 1);
  if (!id || !path) { console.error('⛔ --cand 要写成 id=相对路径（收到 ' + s + '）'); process.exit(2); }
  if (!existsSync(join(ROOT, path))) { console.error('⛔ --cand 里这个包不在盘上：' + path); process.exit(2); }
  if (RAW.some(r => r.id === id)) { console.error('⛔ --cand 的 id 与 coords.tsv 撞名：' + id + ' ⇒ 会拿错包，换个别名'); process.exit(2); }
  return { id: id, path: path, F: NaN, rank: -1 - i };
});
const POOL = RAW.concat(EXTRA);
const ALL = POOL.filter(r => r.id !== REFID).sort((a, b) => a.rank - b.rank);
const only = String(arg('ids', '')).split(',').map(s => s.trim()).filter(Boolean);
const picked = [];
if (only.length) for (const r of ALL) if (only.indexOf(r.id) >= 0) picked.push(r);
if (EXTRA.length) for (const r of ALL) if (EXTRA.some(e => e.id === r.id)) picked.push(r);
const cands = picked.length ? picked : ALL.slice(0, Number(arg('top', 8)) || 8);
const missing = only.filter(id => !ALL.some(r => r.id === id));
if (missing.length) { console.error('⛔ --ids 里这些枚不在名单上（拼错或没进过面板）：' + missing.join(' ')); process.exit(2); }
/* ===== 参照枚：`--ref=` 既收图上的 id，也收**文件路径**（§E588）=====
 * 为什么现在要这一支：`SHIPPED-Ldemo` 这一行的 path 从 10-11 换包起指"**钉住的旧现役**"（`attach-path.mjs` 按 wid 解），
 *   而"现役"这个词在换代当天会换主人 ⇒ 想量"对**线上槽那一枚**占不占优"，就得能把活槽文件本身当参照传
 *   （`--ref=js/bundled-champion-3p.js`）。原来只有 `--cand=` 能吃路径，参照不行（§E364 那条"`--ref=` 写了跑不了"的同族）。
 * ⚠ 不管走哪条，打印与落盘都必须带 **wid**：METHODOLOGY 114 要"引用连参照一起说"，而路径会被下一次换包悄悄改掉。 */
const refRow = refIsPath
  ? { id: REF.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, ''), path: REF, F: NaN, rank: -1 }
  : RAW.find(r => r.id === REFID);
if (!refRow || !refRow.path || !existsSync(join(ROOT, refRow.path))) { console.error('⛔ 参照枚 ' + REF + ' 找不到文件'); process.exit(2); }
if (refIsPath) POOL.push(refRow);   /* 只进 POOL 给 duel() 查身份；ALL/cands 在上面已算完 ⇒ 参照不会变成候选 */
const widAt = rel => { try { return String(widOf(rd(join(ROOT, rel))) || '(解不出权重)'); } catch (e) { return '(读不到)'; } };
const REFWID = widAt(refRow.path);
const LIVEWID = existsSync(join(ROOT, 'js/bundled-champion-3p.js')) ? widAt('js/bundled-champion-3p.js') : '(盘上没有活槽)';

function exam(subject, fieldOpp, tag) {
  /* 中间产物落 gitignored 的 docs/artifacts/ 下，**不进 champion-map/**：那 28 份 .A/.B.json 是每次跑都会重写的
   *   临时件，留在图目录下会把仓库刷成一堆 1KB 噪声（本班第一版就顺手 commit 进去了）。
   *   记录只有 TSV 那一份 —— 它才是"这批决斗跑过什么"的凭证。*/
  const SCRATCH = join(ROOT, 'docs', 'artifacts', 'e334-out');
  if (!existsSync(SCRATCH)) mkdirSync(SCRATCH, { recursive: true });
  const j = join(SCRATCH, 'duel-' + tag + '.json');
  const cmd = ['tools/style-exam.mjs', subject, String(GAMES), '--n=5', '--seed=' + SEED, '--mode=' + MODE,
    '--styles=champ:' + fieldOpp, '--json=' + j];
  const r = spawnSync(process.execPath, cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) { console.error('⛔ ' + tag + ' 退出码 ' + r.status + '\n' + (r.stderr || r.stdout).split('\n').slice(-8).join('\n')); return null; }
  const o = JSON.parse(rd(j)); const row = o.rows[0];
  if (!row || row.games !== GAMES) { console.error('⛔ ' + tag + ' 落盘里没有风格场那一行（rows[0].games=' + (row && row.games) + '）'); return null; }
  return { first: row.firstRate, top2: row.top2Rate, ranks: row.ranks, games: row.games };
}
const out = [];
function duel(aId, bId, tag) {
  const pa = POOL.find(r => r.id === aId);
  const pb = POOL.find(r => r.id === bId);
  if (!pa || !pb) { console.log('⛔ 名单里查不到：' + aId + ' / ' + bId); return; }
  if (!existsSync(join(ROOT, pa.path)) || !existsSync(join(ROOT, pb.path))) { console.log('⛔ 缺包：' + pa.path + ' / ' + pb.path); return; }
  const t0 = Date.now();
  const A = exam(pa.path, pb.path, tag + '.A');       /* a 坐受试席，b 占满其余四席 */
  const B = exam(pb.path, pa.path, tag + '.B');       /* 反过来 */
  if (!A || !B) return;
  const d = 100 * (A.first - B.first);
  const se = 100 * Math.sqrt(A.first * (1 - A.first) / A.games + B.first * (1 - B.first) / B.games);
  out.push({ a: aId, b: bId, aPath: pa.path, bPath: pb.path, aFirst: 100 * A.first, bFirst: 100 * B.first,
    diff: d, se: se, aTop2: 100 * A.top2, bTop2: 100 * B.top2, aRanks: (A.ranks || []).join('/'), secs: ((Date.now() - t0) / 1000).toFixed(0) });
  console.log('  ' + aId.padEnd(16) + ' vs ' + bId.padEnd(16) + ' A=' + (100 * A.first).toFixed(1) + '% B=' + (100 * B.first).toFixed(1) +
    '% ⇒ 差 ' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' ±' + se.toFixed(1) + 'pt（' + ((Date.now() - t0) / 1000).toFixed(0) + 's）');
}
console.log('§E334 配对决斗 · 参照 = ' + REF + '（' + refRow.path + ' · wid=' + REFWID.slice(0, 8) + '）‖ 候选 ' + cands.length + ' 枚 ‖ 每场 ' + GAMES +
  ' 局 · n5 · ' + MODE + ' · seed 基 ' + SEED + ' ‖ 入口 = tools/style-exam.mjs（champ: 对手场）');
if (REFWID !== LIVEWID) console.log('  ⚠ 参照与**线上槽**（js/bundled-champion-3p.js · wid=' + LIVEWID.slice(0, 8) + '）不是同一枚 ⇒' +
  ' 这批读数的意思是"对 `' + refRow.id + '` 占优"，**不是**"对线上冠军占优"（要后者请传 `--ref=js/bundled-champion-3p.js`）');
console.log('— 仪器自检（同一枚包打自己 ⇒ 差必须恰好 0）—');
duel(refRow.id, refRow.id, 'selftest-' + SEED);   /* §E588：按 refRow.id 查，不按 `--ref=` 原样字符串（传路径时两者不同） */
if (!out.length || Math.abs(out[0].diff) > 1e-9) {
  console.error('⛔ 自检没过（A−B = ' + (out.length ? out[0].diff : '无读数') + '）⇒ 仪器坏了，这一批读数一条都不许引');
  process.exit(2); }
out.length = 0;
console.log('— 正式 —');
for (const c of cands) duel(c.id, refRow.id, 'r' + c.rank + '-' + c.id);

const wins = out.filter(o => o.diff > 0).length, sig = out.filter(o => o.diff - 1.96 * o.se > 0).length;
console.log('\n判定：' + out.length + ' 枚里 ' + wins + ' 枚 A>B（其中 ' + sig + ' 枚超出 1.96SE）‖ 配对差中位 ' +
  (out.length ? out.map(o => o.diff).sort((x, y) => x - y)[Math.floor(out.length / 2)].toFixed(1) : '-') + 'pt');
/* ⚠ 这里不下"F 有效/无效"的结论：只看"几枚赢了参照包"会骗人 —— 判剂量-反应要合两批种子并算秩相关（§E289 的同一套）。*/
const TSVOUT = arg('out', 'duel-e334-s' + SEED + '.tsv');
const P = TSVOUT.indexOf('/') >= 0 ? TSVOUT : join(HERE, TSVOUT);
/* 2026-10-11 DS 血债：默认输出名与**在册历史表**同名（`duel-e334-s77000.tsv` 那张有 12 行历史读数），
 * 而这里是**无条件 `writeFileSync`** ⇒ 跑单枚的决斗就把 12 行历史静默压成 1 行（本班实测踩到，随后从 git 恢复）。
 * 章程是"拒绝静默"：目标已存在就停，换名字，或显式 `--force`。 */
if (existsSync(P) && !process.argv.includes('--force')) {
  console.error('⛔ 输出文件已存在：' + P + '\n' +
    '   本工具默认名与在册历史表同名（如 duel-e334-s77000.tsv），覆盖会静默丢掉历史读数。\n' +
    '   ⇒ 换 `--out=<别的名字>`，或确实要覆盖再加 `--force`。');
  process.exit(2);
}
writeFileSync(P, ['a', 'b', 'aPath', 'bPath', 'aFirst%', 'bFirst%', 'diff_pt', 'approxSE', 'aTop2%', 'bTop2%', 'aRanks', 'secs'].join('\t') + '\n' +
  out.map(o => [o.a, o.b, o.aPath, o.bPath, o.aFirst.toFixed(2), o.bFirst.toFixed(2), o.diff.toFixed(2), o.se.toFixed(2),
    o.aTop2.toFixed(2), o.bTop2.toFixed(2), o.aRanks, o.secs].join('\t')).join('\n') + '\n');
console.log('已写 ' + P + '（' + out.length + ' 行）');
