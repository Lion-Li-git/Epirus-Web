#!/usr/bin/env bash
# §E665 送盾的边际价值：**跨起点**重复（不是加局数）
#   动因：`probe-skill-marginal` 在 long 档自报"噪声地板 = 10.5pt"，而那个地板的定义是
#   `|基线臂(SEED0) − 基线臂(SEED0+7e6)|`（`tools/probe-skill-marginal.mjs:204-205`）⇒ 它量的是**换一颗种子基线自己摆多少**。
#   ⇒ 在 long 档这个摆动远大于配对 SE（≈3pt）⇒ **配对 SE 不是那条绑人的不确定性；要补的是独立起点，不是局数**。
#   本批：4 颗种子 × 两档 × 4 张防御/辅助卡，局数照 200（配对 SE 已经够小，摆动在种子那一维）。
cd /d/code/Epirus-Web || exit 3
A=docs/research/archive/2026-10-20-night-d15-gates
OUT=$A/skill-marginal-82-seeds.log.txt
: > "$OUT"
for M in multi long; do
  for S in 20260923 1111111 2222222 3333333; do
    echo "########## mode=$M seed=$S games=200 $(date '+%T')" >> "$OUT"
    node tools/probe-skill-marginal.mjs --pack=docs/artifacts/v7beadseed-82.bak --mode=$M \
      --games=200 --seed=$S --only=holo,reflect,proto,jinshield >> "$OUT" 2>&1
    echo "rc=$?" >> "$OUT"
  done
done
echo "ALLDONE $(date '+%F %T')" >> "$OUT"
