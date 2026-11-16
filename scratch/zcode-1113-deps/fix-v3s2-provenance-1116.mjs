/* fix-v3s2-provenance-1116.mjs —— V3S2 出身修复成真实情况（用户令 11-16 23:0x）。
 *
 * 真实情况：V3S2 = 六路线性融合（META.recipe = {sd:0.2, v2s0:0.25, v2s1:0.15, v3as0:0.15, v3as1:0.15, v3bs1:0.1}），
 *   **没有热启动父包**。docs 份 META 被手填了假 hotstartFrom（V3a 的 wid）+ 假 up + 整分钟 ts
 *   ⇒ 图上 V3a→V3S2 的 `seedpack-wid` 实线是假的（Qoder FINDING §一.2 订正）。
 * 修法：①docs META 删假 hotstartFrom/up、ts 恢复真实融合时刻 12:47:43.513Z、写入 meta.soup.sources
 *   （六路 grain：路径/权重下标/wid/ts，按 recipe 权重降序）⇒ §E487 机制按融合画多父边；
 *   ②scratch 份同笔补 soup.sources（原始真值件也应有机器可读出处）；③registry V3S2 ts/sha256 同步真值。
 * 权重数组不动 ⇒ wid 不变 ⇒ 谱系 identity 不变。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox } from '../../tools/audit-lib.mjs';
import { widOf } from '../../champion-map/pack-id.mjs';

const W = sandbox();
const RECIPE = { v2s0: 0.25, sd: 0.2, v2s1: 0.15, v3as0: 0.15, v3as1: 0.15, v3bs1: 0.1 };   // 权重降序
const SRC = {
  v2s0: 'scratch/arms/OBS6-SHAPEDIST-V2.snap0.bak',
  sd: 'scratch/arms/OBS6-SHAPEDIST.bak',
  v2s1: 'scratch/arms/OBS6-SHAPEDIST-V2.snap1.bak',
  v3as0: 'scratch/arms/OBS6-SHAPEDIST-V3a.snap0.bak',
  v3as1: 'scratch/arms/OBS6-SHAPEDIST-V3a.snap1.bak',
  v3bs1: 'scratch/arms/OBS6-SHAPEDIST-V3b.snap1.bak',
};

const sources = [];
for (const [key, rel] of Object.entries(SRC)) {
  const txt = readFileSync(rel, 'utf8');
  const meta = JSON.parse(txt.match(/EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;\s*\n/)[1]);
  sources.push({ key, w: RECIPE[key], path: rel, wid: widOf(txt), ts: meta.ts });
}
sources.sort((a, b) => b.w - a.w);
console.log('六路来源（权重降序）：');
for (const s of sources) console.log('  ' + s.key.padEnd(6) + ' w=' + s.w.toFixed(2) + ' wid=' + s.wid.slice(0, 16) + ' ts=' + s.ts);

for (const f of ['scratch/arms/OBS6-SHAPEDIST-V3S2.bak', 'docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V3S2.bak']) {
  let txt = readFileSync(f, 'utf8');
  const mm = txt.match(/EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;\s*\n/);
  const meta = JSON.parse(mm[1]);
  delete meta.hotstartFrom;      // 假父（V3a wid 手填）——融合产物没有单一热启动父
  delete meta.up;                // 同假（docs 份手填）
  meta.ts = '2026-11-15T12:47:43.513Z';   // 真实融合时刻（scratch 份出产 ts）
  meta.soup = { recipe: RECIPE, sources };
  const out = txt.replace(/(EPIRUS_CHAMPION_3P_META\s*=\s*)\{[\s\S]*?\}(\s*;\s*\n)/, '$1' + JSON.stringify(meta) + '$2');
  writeFileSync(f, out);
  console.log('✔ ' + f + ' ‖ hotstartFrom 删 ‖ soup.sources ×' + sources.length + ' ‖ ts=12:47:43.513Z');
}
/* registry 同步：ts 真值 + sha256 重算 */
const regPath = 'champion-map/data/registry.tsv';
const { createHash } = await import('node:crypto');
const regLines = readFileSync(regPath, 'utf8').split('\n');
const h = regLines[0].split('\t');
const iId = h.indexOf('pack_id'), iTs = h.indexOf('ts'), iSha = h.indexOf('sha256');
for (let i = 1; i < regLines.length; i++) {
  const c = regLines[i].split('\t');
  if (c[iId] === 'OBS6-SHAPEDIST-V3S2') {
    c[iTs] = '2026-11-15T12:47:43.513Z';
    c[iSha] = createHash('sha256').update(readFileSync('docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V3S2.bak')).digest('hex');
    regLines[i] = c.join('\t');
    console.log('✔ registry V3S2 ts/sha256 同步');
  }
}
writeFileSync(regPath, regLines.join('\n'));
