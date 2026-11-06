#!/usr/bin/env bash
# 跨模式适应网格（ZCode · 11-05 凌晨）：2/3/5/8 人 × 3血(multi)/5血(long) 八格 × 60 局
# 每格抓：1st% + 关键键次数（蓄能/聚能环/真正的落雷/电磁炮/地雷/激光眼/全息屏障）
# 用法: bash scratch/night6-crossmode.sh <packPath>
set -u
cd /d/code/Epirus-Web || exit 1
P="${1:?用法: night6-crossmode.sh <pack>}"
n=$(basename "$P" .js)
OUT="scratch/night6/crossmode-$n.tsv"
[ -f "$OUT" ] && exit 0   # 已跑过
echo -e "pack\tnp\tmode\tblood\tgames\tfirst\t蓄能\t聚能环\t真正的落雷\t电磁炮\t地雷\t激光眼\t全息屏障\t局长" > "$OUT"
for np in 2 3 5 8; do
  for m in multi long; do
    if [ "$m" = "multi" ]; then b=3; else b=5; fi
    raw=$(node tools/eval-5p.mjs 60 "$np" 77000 "$P" --mode="$m" --shipbigt=0 --shipdrain=0 2>/dev/null)
    f=$(echo "$raw" | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
    row="$n	$np	$m	$b	60	${f:-NA}"
    for key in 蓄能 聚能环 真正的落雷 电磁炮 地雷 激光眼 全息屏障; do
      c=$(echo "$raw" | grep -E "^\s*$key\s" | grep -oE '[0-9.]+%' | head -1 | tr -d '%')
      row="$row	${c:-0}"
    done
    echo -e "$row" >> "$OUT"
    echo "$n ${np}P$m first=${f:-NA}"
  done
done
echo "=== crossmode $n 完成 $(date +%H:%M)" >> "$OUT"
