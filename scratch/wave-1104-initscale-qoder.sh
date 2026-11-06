#!/usr/bin/env bash
# 波 H（11-04 傍晚 · 千问）：**冷启动到底缺什么** —— 把尺量出来的处方拿真臂验一遍。
#   尺的读数（`scratch/coldstart-why-1104.mjs`，两批分进程 ‖ placebo=0 ‖ 参数量自证 5689/7993）：
#     · 出生点两边一样（全零参数 = 菜单默认 ⇒ 防御族 v7 75.1% ‖ 2.0 75.4%）→ "v7 天生会打"否
#     · 随机起点 8 粒在产品温度下的**聚合**剖面：v7 防御族 sd **31.3pt** ‖ 2.0 只有 **0.9pt** ⇒ 种群是一个点 ⇒ 选择没东西可选
#     · σ 扫到 1.5（相对步长 828%）2.0 的聚合仍钉在 73~74% ⇒ **"把步子加大"不是解**
#     · 幅度剂量响应（2.0，scale 0.25/1/2/4）：聚合 sd = 0.9 / 2.7 / 18.6 / **30.0pt**（个体内种数 11.8→5.0；v7 随机起点本来就只有 3.4）
#   ⇒ 唯一便宜的处方 = **随机起点幅度**。这批准判两件事：sd 长出来之后，真臂能不能爬出壁盆（=200 局强度 / 阻断项数）。
# 形状与 `CB13` 逐字同（1200 代 × 5 人 × 8 局 × pop8、裸 GA、`EPIRUS_SEED=13`、PAIRED+OPP_SWEEP+HOLDOUT_SEG=100），
#   只差 `EPIRUS_INIT_SCALE` ⇒ 与 CB13（0.25 出厂档，4 项阻断 ‖ 200 局 11.3/10.9）按同一把上线判据配对。
set -u
REPO="D:/code/Epirus-Web"; cd "$REPO" || exit 3
OUT="$REPO/scratch/coldh-1104"; mkdir -p "$OUT"

arm() {  # $1=scale
  local K="$1" NAME="HS-$K"
  ( export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE='seg' EPIRUS_TRAIN_MODE='long'
    export EPIRUS_SEED=13 EPIRUS_OPP_SWEEP=1 EPIRUS_PAIRED=1 EPIRUS_EFFSKILL_MIN=6 EPIRUS_EFFSKILL_SHARE=0.005
    export EPIRUS_HOLDOUT_SEG=100 EPIRUS_INIT_SCALE="$K" EPIRUS_ARM="$NAME"
    export EPIRUS_BAND_DIR="$REPO/scratch/ga-bands/$NAME"
    export EPIRUS_T3P_OUT="scratch/ga-arms/$NAME.js"
    node tools/train-3p.mjs 1200 5 8 8 > "$OUT/$NAME.log" 2>&1
    echo "$NAME rc=$? $(date +%H:%M:%S)" ) &
}
for K in 2 4; do arm "$K"; done
wait

echo "=== ① 幅度自证（横幅 + meta 两处都要对得上）==="
for K in 2 4; do
  printf 'HS-%-3s ' "$K"
  grep -hoE "随机起点幅度 = [0-9.]+[^|]*|无热启动|冷启动" "$OUT/HS-$K.log" | head -2 | tr '\n' ' '
  grep -hoE '"initScale":[0-9.]+' "scratch/ga-arms/HS-$K.js" 2>/dev/null | head -1 | tr '\n' ' '
  grep -oE "1st=[0-9.]+%  top2=[0-9.]+%|冠军 [0-9]+ 种有效技能|耗时 [0-9.]+s" "$OUT/HS-$K.log" | tail -3 | tr '\n' ' '
  echo
done

echo "=== ② 上线判据 + 强度 + 键份额 $(date +%H:%M) ==="
for K in 2 4; do
  P="scratch/ga-arms/HS-$K.js"
  [ -f "$P" ] || { echo "HS-$K ⇒ 无产物（看日志尾部原因）"; continue; }
  node tools/promote-champion.mjs "$P" --dry > "scratch/promote-1104/HS-$K.txt" 2>&1
  printf 'HS-%-3s 阻断 %s ‖ ' "$K" "$(grep -oE '体检未过（[0-9]+ 项阻断条件）|自检通过' "scratch/promote-1104/HS-$K.txt" | tail -1)"
  grep -oE "G[45]\[HS-$K/(long|multi)\] (最克「[^」]*」|防席夺冠) [0-9.]+%/[0-9]+%（[^）]*）" "scratch/promote-1104/HS-$K.txt" | tr '\n' ';'
  for M in long multi; do
    v=$(node tools/eval-5p.mjs 200 5 77000 "$P" --mode=$M --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
    printf ' 强度%s=%s' "$M" "${v:-NA}"
    printf '%s\t200\t%s\n' "HS-$K" "${v:-0}" >> "scratch/night6/strength-$M-fix.tsv"
  done
  echo
done
node scratch/chain-usage-1104.mjs scratch/ga-arms/HS-2.js scratch/ga-arms/HS-4.js 2>&1 | tail -6
echo "=== 与 CB13（同形状、幅度 0.25 出厂档）并排 ==="
node scratch/morning1104-g45-gap.mjs scratch/promote-1104 2>&1 | grep -E "^HS-|^CB13|^CG13|^CA13|满足|判据（用户"
echo "WAVE_H_DONE $(date +%H:%M)"
