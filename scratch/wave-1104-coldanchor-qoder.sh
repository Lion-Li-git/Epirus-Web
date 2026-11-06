#!/usr/bin/env bash
# 波 D（11-04 千问 · 用户命题："有好方法就试冷启动 + 长代数能不能出一个有用的包"）
# 三臂消融，全部**冷启动**（不带 HOTSTART/SEEDPACK）、同 seed=13、同预算 1200 代 × 8 局 × pop8：
#   ① CB13  裸                        ⇒ 历史形状（时长↑强度↑宽度↓ 的那条）
#   ② CG13  只开 GA_GATE=3            ⇒ 环内塑形单独有多少（DS 判过绝对线在窄起点会饿退，冷起点应当不饿）
#   ③ CA13  GA_GATE=3 + 覆盖锚(ANCHOR=3, ANCHOR_TO=widest) ⇒ 棘轮在门槛之上再加多少
# 三臂都带 HOLDOUT_SEG=100（存段，DS 已证"末代不是最优"）+ PAIRED + OPP_SWEEP + EFFSKILL_MIN=6（记录模式）。
# 判"有没有用"用同一把尺：promote --dry → scratch/morning1104-g45-gap.mjs（所有阻断项 + 最坏超限 ≤15pt）。
set -u
REPO="D:/code/Epirus-Web"; cd "$REPO" || exit 3
OUT="$REPO/scratch/coldanchor-1104"; mkdir -p "$OUT" scratch/ga-bands scratch/promote-1104
arm() {  # $1=名  $2=GA_GATE  $3=ANCHOR  $4=ANCHOR_TO
  local N="$1" G="$2" A="$3" T="$4"
  ( export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE='seg' EPIRUS_TRAIN_MODE='long'
    export EPIRUS_SEED=13 EPIRUS_ARM="$N" EPIRUS_EFFSKILL_MIN=6 EPIRUS_EFFSKILL_SHARE=0.005
    export EPIRUS_PAIRED=1 EPIRUS_OPP_SWEEP=1 EPIRUS_HOLDOUT_SEG=100
    export EPIRUS_BAND_DIR="$REPO/scratch/ga-bands/$N" EPIRUS_T3P_OUT="scratch/ga-arms/$N.js"
    unset EPIRUS_HOTSTART EPIRUS_SEEDPACK
    [ "$G" != "0" ] && export EPIRUS_GA_GATE="$G" || unset EPIRUS_GA_GATE
    [ "$A" != "0" ] && { export EPIRUS_ANCHOR="$A"; export EPIRUS_ANCHOR_TO="$T"; } || unset EPIRUS_ANCHOR EPIRUS_ANCHOR_TO
    node tools/train-3p.mjs 1200 5 8 8 > "$OUT/$N.log" 2>&1
    echo "$N rc=$? $(date +%H:%M:%S)" ) &
}
arm CB13 0 0 seed &
arm CG13 3 0 seed &
arm CA13 3 3 widest &
wait
echo "=== 三臂收尾 ==="
for N in CB13 CG13 CA13; do
  printf '%-6s ' "$N"
  grep -oE "各粒：[0-9,]+|保留 [0-9]+/[0-9]+ 粒 ‖ 冠军 [0-9]+ 种|effSkillAllNarrow|锚·最宽.*累计移动 [0-9]+ 次|门槛.*宽代 [0-9]+/[0-9]+|耗时 [0-9.]+s|已写入 [^ ]+" "$OUT/$N.log" | tail -6 | tr '\n' ' ' | cut -c1-230; echo
done
echo "=== 下一步（人工）：promote --dry 三枚 → morning1104-g45-gap.mjs 读全部阻断项"
