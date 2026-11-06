#!/usr/bin/env node
/* night6-lineage-harvest.mjs —— 纯 2.0 演化图的节点/边收割器（ZCode · 11-04 凌晨）
 *
 * 收什么：
 *   ① scratch/night3|night4|night5/*.js 的产物 meta（recipe.arm/seed/gens/games/pop + hotstartFrom）
 *   ② 手工根表（下面 ROOTS：蒸馏谱系 supfit-gd 的 parent/teacher 链，来自各 .bak.meta.json 实读）
 *   ③ 段节点：champion-map/g3-nodes-1103.tsv（HOLDOUT_SEG 存段）+ scratch/night5/bands/ 目录
 * 输出：champion-map/g3-lineage.tsv（id parent edgeKind family seed gens games src refRead refSrc note）
 *
 * 哈希→家族对照（hotstartFrom 是权重内容哈希，不是 commit；同哈希=同起点）：
 *   04907be16715c376 = GD3-ALL（GD3ALL-* 臂族起点）
 *   66bc2f92eb807f51 = L5-D4a-s13（EFFG 各粒与 L5-1200 的起点）
 *   3554dce2e90f6c38 = D-a 蒸馏底座（D-a-s13 起点）
 *   ec6eee25c35c40dd = D-a 谱系中继枚（DSTR-s13 与 D1200-s13 同起点；账面记 D-a-s13 谱系）
 *   7e52479189947539 = D 谱系另一中继（DSTR4 起点）
 *   792f3caacf064b84 = G5-8p-s41（G5DEF 精调起点）
 *   67f23c7e371fdf97 = CB-combo-v2（CB-s13 起点）
 *   12dc98cc2d37faa4 = GD3-RATION（GA-ration-* 臂起点）
 *   92eebe7bfe3400ce / 0db60b97fc251fbe = G5-n5 / GA2R 各自前代（同族近亲）
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

const HASH2FAM = {
  '04907be16715c376': 'GD3-ALL',
  '66bc2f92eb807f51': 'L5-D4a-s13',
  '3554dce2e90f6c38': 'D-a底座',
  'ec6eee25c35c40dd': 'D-a谱系中继',
  '7e52479189947539': 'D-a谱系中继2',
  '792f3caacf064b84': 'G5-8p-s41',
  '67f23c7e371fdf97': 'CB-combo-v2',
  '12dc98cc2d37faa4': 'GD3-RATION',
  '92eebe7bfe3400ce': 'GD3-ALL',
  '0db60b97fc251fbe': 'GD3-RATION',
  /* D 谱系中继（11-04 定案）：ec6eee = DSTR/DDEF/DH/D-b/D1200 五族共同起点 ⇒ 记 D-a-s13（账面叙事一致：
     §二十三「D1200 起点 D-a-s13」+ §二十六「DSTR4（D-a 谱系 400 代）」；「哈希同起点」是硬事实，
     「那枚=D-a-s13」是叙事推断未经逐字节验证——图上按账面记）。 */
  'ec6eee25c35c40dd': 'D-a-s13',
  '0519cdb4': 'D-a-s41',             /* s41 粒同构推理 */
  '7e52479189947539': 'D谱系中继2',  /* DSTR4-s13 起点：未入库中继枚 ⇒ 虚拟节点（ROOTS 补） */
  '3aaa8169': 'D谱系中继2s41',       /* DSTR4-s41 / DSTR5-s41 起点：同上 */
  '792f3caacf064b84': 'GD3ALL-G5-8p-s41',
  '0290df82': 'LE-laser-v2',
  '3489c16057e7321b': 'CB3-combo-v3',   /* CB-v3 蒸馏底座（11-04，起点 EFFG-s41） */
  '22f1014a39c219bf': 'L5-1200-s13',    /* HPG 探针臂（L5-1200 + HPSEED）的起点 */
  'f681313e': 'CB3-s13',                /* CB3L-1200（CB3-s13 续 1200 代）的起点 */
  /* KDFULL 链（DS 11-04 晚：v7 教师全模型蒸馏 → 换招+强度首过四判据） */
  '61164b09cac44d2d': 'KD-V7',          /* 头-only 蒸馏产物（KD-V7 ← L5-D4a-s13, teacher=线上v7） */
  '1529c10b509c9de8': 'KDFULL2',        /* 全模型蒸馏产物（supfit-full, KDFULL2 ← KD-V7） */
  'f760760f80b8a45b': 'KDFULLGA-s13',   /* KDFULLGA-s13（KDFULL2 + GA150） */
  'd4a7cf2cb5519439': 'KDFULL400-s13'   /* KDFULL400-s13（KDFULLGA-s13 续 400 代，四判据首过） */
};

/* 手工根/蒸馏层（来源：scratch/arms/*.bak.meta.json 与 scratch/night4/*.bak.meta.json 实读，11-04 凌晨） */
const ROOTS = [
  { id: 'arch2随机', parent: '', edgeKind: '根', family: '根', note: 'arch2 S1ob/obs3b 随机初始化（虚拟根）' },
  { id: 'OB3S-C2-s7', parent: 'arch2随机', edgeKind: 'CEM', family: '根', note: 'cem 6000 evals pop48（obs3b 时代 10-3x）' },
  { id: 'GD3-ALL', parent: 'OB3S-C2-s7', edgeKind: '蒸馏(allround)', family: '蒸馏谱系', note: 'supfit-gd teacher=allround' },
  { id: 'GD3-RATION', parent: 'OB3S-C2-s7', edgeKind: '蒸馏(ration)', family: '蒸馏谱系', note: 'supfit-gd teacher=ration' },
  { id: 'GD3-SWORD', parent: 'GD3-RATION', edgeKind: '蒸馏(ration2)', family: '蒸馏谱系', note: 'supfit-gd teacher=ration2' },
  { id: 'D4a', parent: 'GD3-SWORD', edgeKind: '克隆精调', family: '蒸馏谱系', note: 'CLONE-D4a（clone-d4a）' },
  { id: 'GA-ration-s13', parent: 'GD3-RATION', edgeKind: 'GA', family: 'ration臂', note: '11-01 era 臂' },
  { id: 'GA-ration-s41', parent: 'GD3-RATION', edgeKind: 'GA', family: 'ration臂', note: 'CB/D-a 蒸馏的 parent' },
  { id: 'D-a底座', parent: 'GA-ration-s41', edgeKind: '蒸馏(drain/DEF先验)', family: 'D谱系', note: 'drain/laserEye/DEF 先验蒸馏（DS 11-02）' },
  { id: 'CB-combo-v2', parent: 'GA-ration-s41', edgeKind: '蒸馏(连招)', family: 'CB谱系', note: 'teacher=ration6 combo-v2' },
  { id: 'LE-laser-v2', parent: 'GA-ration-s41', edgeKind: '蒸馏(激光眼)', family: 'LE谱系', note: '激光眼破冰蒸馏（§二十七）' },
  { id: 'D谱系中继2', parent: 'D-a-s13', edgeKind: '续训中继', family: 'D谱系', note: '未入库中继枚（DSTR4-s13 起点，哈希 7e524791）' },
  { id: 'CB3-combo-v3', parent: 'EFFG-s41', edgeKind: '蒸馏(连招v3)', family: 'CB谱系', note: 'teacher=ration6，学生自访 82.8%（CB-v2 73.4%）' },
  { id: 'KD-V7', parent: 'L5-D4a-s13', edgeKind: '蒸馏(头-only,线上v7教师)', family: 'KD谱系', note: '主键47%/换招70%，强度持平（DS 11-04 晚）' },
  { id: 'KDFULL2', parent: 'KD-V7', edgeKind: '蒸馏(全模型 supfit-full)', family: 'KD谱系', note: '留出同键 78.7%/guard 0→68%/sword 94%（tape 全段梯度）' },
  { id: 'KDFULL400-s13', parent: 'KDFULLGA-s13', edgeKind: 'GA(400代)', family: 'KD谱系', note: '主键59/换招50/6种/arena 0.438-0.25 ⇒ 四判据首过；promote 唯一阻断=还手16.4' },
  { id: 'D谱系中继2s41', parent: 'D-a-s41', edgeKind: '续训中继', family: 'D谱系', note: '未入库中继枚（DSTR4-s41/DSTR5-s41 起点，哈希 3aaa8169）' },
  { id: 'L5-D4a-s13', parent: 'D4a', edgeKind: 'GA(5P long 首批)', family: 'L5谱系', note: 'DS 11-02 L5 首批 6 臂之强粒（0.438/60.0）', refRead: '60.0', refSrc: 'RESULTS-2026-11-02-L5-ds §一' },
  { id: 'L5-D4a-s7', parent: 'D4a', edgeKind: 'GA(5P long 首批)', family: 'L5谱系', note: '同批 s7', refRead: '50.0', refSrc: 'RESULTS-2026-11-02-L5-ds §一' },
  { id: 'L5-D4a-s41', parent: 'D4a', edgeKind: 'GA(5P long 首批)', family: 'L5谱系', note: '同批 s41', refRead: '47.5', refSrc: 'RESULTS-2026-11-02-L5-ds §一' }
];

const DIRS = ['scratch/night3', 'scratch/night4', 'scratch/night5', 'scratch/night6'];
const rows = [];
for (const dir of DIRS) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js') || f.endsWith('.bak.js')) continue;
    const p = dir + '/' + f;
    const src = readFileSync(p, 'utf8');
    const hs = (src.match(/"hotstartFrom":"([^"]*)"/) || [])[1] || '';
    const rec = src.match(/"recipe":\{[^}]*\}/);
    let arm = '', seed = '', gens = '', games = '';
    if (rec) {
      arm = (rec[0].match(/"arm":"([^"]*)"/) || [])[1] || '';
      seed = (rec[0].match(/"seed":(\d+)/) || [])[1] || '';
      gens = (rec[0].match(/"gens":(\d+)/) || [])[1] || '';
      games = (rec[0].match(/"games":(\d+)/) || [])[1] || '';
    }
    const id = f.replace(/\.js$/, '');
    if (/^(ref-|smoke-)/.test(id)) continue;   /* 工具冒烟包不是演化节点（且 smoke- 无起点哈希会断链） */
    const hit = Object.keys(HASH2FAM).find((k) => hs === k || (k.length <= 8 && hs.indexOf(k) === 0));
    const parent = (hit && HASH2FAM[hit]) || (hs ? '未知起点(' + hs.slice(0, 8) + ')' : '');
    rows.push({ id, parent, edgeKind: 'GA(' + gens + '代×' + games + '局)', family: (arm || id).replace(/-s\d+$/, ''), seed, gens, games, src: p });
  }
}

/* 段节点（HOLDOUT_SEG 存段 = 训练中途的虚拟池成员） */
const segRows = [];
if (existsSync('champion-map/g3-nodes-1103.tsv')) {
  const lines = readFileSync('champion-map/g3-nodes-1103.tsv', 'utf8').split(/\r?\n/).filter(Boolean);
  const hdr = lines[0].split('\t');
  for (const ln of lines.slice(1)) {
    const c = ln.split('\t'); const o = {}; hdr.forEach((h, i) => (o[h] = c[i]));
    segRows.push({ id: o.id, parent: o.arm, edgeKind: '段@' + o.gen + '代', family: o.arm, seed: '', gens: o.gen, games: '', src: o.path, note: 'kinds=' + o.kinds + ' defShare=' + o.defShare + ' fit=' + o.fit });
  }
}

const out = [];
out.push(['id', 'parent', 'edgeKind', 'family', 'seed', 'gens', 'games', 'src', 'refRead', 'refSrc', 'note'].join('\t'));
for (const r of ROOTS) out.push([r.id, r.parent, r.edgeKind, r.family, '', '', '', '', r.refRead || '', r.refSrc || '', r.note || ''].join('\t'));
for (const r of rows) out.push([r.id, r.parent, r.edgeKind, r.family, r.seed, r.gens, r.games, r.src, '', '', ''].join('\t'));
for (const r of segRows) out.push([r.id, r.parent, r.edgeKind, r.family, r.seed, r.gens, r.games, r.src, '', '', r.note || ''].join('\t'));
writeFileSync('champion-map/g3-lineage.tsv', out.join('\n') + '\n');
console.log('g3-lineage.tsv: 根/蒸馏 ' + ROOTS.length + ' + 产物 ' + rows.length + ' + 段 ' + segRows.length + ' = ' + (ROOTS.length + rows.length + segRows.length) + ' 节点');
const orphan = rows.filter((r) => String(r.parent).indexOf('未知') === 0);
if (orphan.length) console.log('⚠ 未知起点（哈希认不出）：' + orphan.map((r) => r.id + '<-' + r.parent).join(' ‖ '));
