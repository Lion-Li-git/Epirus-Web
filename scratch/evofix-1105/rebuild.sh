#!/usr/bin/env bash
# 演化图重建链（11-05 上午 · 千问）——**每张视图自己一套投影**（局域性），版本下拉=换页不是换滤镜
# 五步，少任何一步都会被 viewer 的新守卫当场拒绝出图（不再是静默退化）：
#   ① 合并器出并集表（xt/yt 留空、path 齐、ver 按容器、Hp 走 eps-full 同尺）
#   ② 谱系从 g3-lineage.tsv **生成**（家族 14~17、别名归一、父链点名）
#   ③ 再出并集表（这次带上生成好的谱系）+ 两张视图子集表
#   ④ 三张表各自过 proj-tsne（all / 1.8 / 2.0 各一套 fit）
#   ⑤ 各自烘一页：index.html（全部）+ index-2v-18 + index-2v-20 + index-2v-all
set -eu
cd /d/code/Epirus-Web || exit 3
mkdir -p scratch/evofix-1105
LOG=scratch/evofix-1105/rebuild.log; : > "$LOG"

echo "── ① 并集表（先出一版给谱系生成器读） $(date +%H:%M)" | tee -a "$LOG"
node scratch/night6-join-coords.mjs --only=all >> "$LOG" 2>&1

echo "── ② 生成 lineage-g3.tsv $(date +%H:%M)" | tee -a "$LOG"
node champion-map/lineage-g3-build.mjs >> "$LOG" 2>&1

echo "── ③ 三张表 $(date +%H:%M)" | tee -a "$LOG"
for V in all 18 20; do node scratch/night6-join-coords.mjs --only=$V >> "$LOG" 2>&1; done

echo "── ④ 三套投影 $(date +%H:%M)" | tee -a "$LOG"
node champion-map/proj-tsne.mjs --in=champion-map/coords-gen3-1105.tsv >> "$LOG" 2>&1
node champion-map/proj-tsne.mjs --in=champion-map/coords-view-18.tsv >> "$LOG" 2>&1
node champion-map/proj-tsne.mjs --in=champion-map/coords-view-20.tsv >> "$LOG" 2>&1

echo "── ④b 单页化挂列（11-06 夜 · ZCode）：三套投影按 id 并成一份 DATA（规范命令 bake-flags.txt 的输入） $(date +%H:%M)" | tee -a "$LOG"
node champion-map/attach-projcols.mjs >> "$LOG" 2>&1

echo "── ⑤ 烘四页（index.html = 单页版：--projcols=1 --verpages=0，版本下拉=页内换投影，旗标单源 bake-flags.txt；子集页必须带**自己那一版**的 preset） $(date +%H:%M)" | tee -a "$LOG"
node champion-map/viewer.mjs --fit=coords-projcols.tsv --preset=all --projcols=1 --verpages=0 --out=index.html >> "$LOG" 2>&1
node champion-map/viewer.mjs --fit=coords-gen3-1105.tsv --preset=all --out=index-2v-all.html >> "$LOG" 2>&1
node champion-map/viewer.mjs --fit=coords-view-18.tsv --preset=1.8 --out=index-2v-18.html >> "$LOG" 2>&1
node champion-map/viewer.mjs --fit=coords-view-20.tsv --preset=2.0 --out=index-2v-20.html >> "$LOG" 2>&1

echo "── 收尾 $(date +%H:%M)" | tee -a "$LOG"
grep -E "^⇒|投影列|版本按容器|Hp 统一|无 path|撞车|12 维不齐|家族 |父边|待进图|起点只拿到|t-SNE\(|已写" "$LOG" | tail -26
