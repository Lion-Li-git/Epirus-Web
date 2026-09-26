/* ============================================================================
 * archive-classes.mjs —— "档案池 = **按权重哈希去重的等价类**" 的单一来源。
 *
 * 起因（09-26 夜班）：两条线必须量在同一批样本单位上 ——
 *   · `probe-pool-frontier.mjs`：宽 / 花珠率闭环 / G4 抗克
 *   · `probe-regime-fitness.mjs`：逐环境（19 类原型）的真适应度
 * 两边各自抄一份去重逻辑，"档案里有几粒"就永远对不上账（METHODOLOGY 62：样本单位 = 等价类，不是文件）。
 *
 * 只读：不写仓库、不改判据。
 * ==========================================================================*/
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadChamp } from './audit-lib.mjs';

export const ARCHIVE_DIR = 'docs/artifacts';

/** 逗号分隔的文件列表；空 ⇒ 整个档案目录里的 .bak（排序保证可复跑）。 */
export function listArchiveFiles(listArg) {
  const raw = (listArg || '').split(',').map(s => s.trim()).filter(Boolean);
  return raw.length ? raw
    : readdirSync(ARCHIVE_DIR).filter(f => /\.bak$/.test(f)).sort().map(f => ARCHIVE_DIR + '/' + f);
}

/** 一个 .bak 的权重指纹 + 解出来的 params。err='read' 读不到 / 'unpack' 没权重。 */
export function makeUnpacker(W) {
  return function unpackOf(file) {
    let src;
    try { src = readFileSync(file, 'utf8'); } catch (e) { return { err: 'read' }; }
    const params = loadChamp(W, file);
    if (!params) return { err: 'unpack' };
    const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src) || /EPIRUS_CHAMPION(?!_3P|_META)\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
    const packObj = m ? JSON.parse(m[1]) : null;
    const hash = packObj ? createHash('sha1').update(JSON.stringify(packObj)).digest('hex').slice(0, 12) : 'no-pack';
    const feat = packObj && packObj.f != null ? packObj.f : null;
    return { params, hash, feat, twoP: !/window\.EPIRUS_CHAMPION_3P\s*=/.test(src) };
  };
}

/**
 * files → 等价类。
 * opts: { every, limit, shard, parts, list }  —— 语义与历史一致：
 *   every/limit 先做（分片复跑用），shard/parts 后做（**多进程并行扫用**：第 i 片取 i%parts==shard）。
 */
export function collectClasses(W, files, opts) {
  const o = opts || {};
  const every = Math.max(1, Number(o.every || 1));
  const limit = Number(o.limit || 0);
  const parts = Math.max(1, Number(o.parts || 1));
  const shard = Math.max(0, Number(o.shard || 0));
  const unpackOf = makeUnpacker(W);
  const FEAT = W.EpirusPolicy.FEAT_S || (W.EpirusState && W.EpirusState.FEAT_S) || null;
  const uniq = new Map();
  const skip = { read: 0, unpack: 0, oldFeat: 0, twoP: 0 };
  for (const f of files) {
    const u = unpackOf(f);
    if (u.err === 'read') { skip.read++; continue; }
    if (u.err === 'unpack') { skip.unpack++; continue; }
    if (u.twoP) { skip.twoP++; continue; }                       // 2P 壳不是 3P 候选（09-26 曾把它混进池子）
    if (FEAT != null && u.feat != null && u.feat !== FEAT) { skip.oldFeat++; continue; }
    if (!uniq.has(u.hash)) uniq.set(u.hash, { file: f, hash: u.hash, params: u.params });
  }
  let classes = [...uniq.values()];
  if (limit > 0) classes = classes.filter((_, i) => i % every === 0).slice(0, limit);
  else if (every > 1) classes = classes.filter((_, i) => i % every === 0);
  if (parts > 1) classes = classes.filter((_, i) => i % parts === shard);
  return { classes, FEAT, counts: { files: files.length, uniq: uniq.size, skip } };
}
