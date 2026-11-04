#!/usr/bin/env bash
# 波 E′（11-04 午后 · 千问）：把 **G5 用来判它的那一席**放上训练桌。
#   预登记在 `docs/research/PREREG-2026-11-04-G5-CLOSING-qoder.md` §十二（判据跑完不许改）。
# 与原波 E（SEL_CLEAR 场B 清场地板）的关系：**取消**。发臂前量尺发现该口径饱和在 4/局（29 枚里 11 枚并列天花板）
#   且与 G5 不同向（ρ=−0.25）⇒ 这条臂跑出来只能读成"一格没咬到/全否"，白烧机时。
# 唯一变量：AK3 三粒配方**逐字不动**，只加 `EPIRUS_COUNTER_OPPS=guardSpam`
#   （`train-3p.mjs:1343` 逐字注明 `= gate-drafts 的「只防御(不还手)」` ⇒ 就是 G5 那一格的原型）。
# 在册背景：10-24 `COUNTER_OPPS=gunFocus+SEL_COUNTER=1` 把 G4 long 86.3% FAIL 压到 39.3% PASS（买得到）
#   ‖ 10-26 DS 三臂只买到"只枪"，而"只防御"更差 75.3/80.3 ⇒ 单目标杠杆，代价在别处付。
# 主判据：产物 G5[long]/G5[multi] 防席夺冠（promote 新尺逐格数字行，n=300）对同种子 AK3 的差
#   对照 AK3：s13 44/62 ‖ s41 69/37 ‖ s7 ≤25（过线不印数 ⇒ 这一粒只能"读不出"）。
# 线：配对三粒里 ≥2 粒 G5 最坏格降 ≥10pt 且 G4 不恶于同粒 AK3 ⇒ 才判成立。
set -u
REPO="D:/code/Epirus-Web"; cd "$REPO" || exit 3
OUT="$REPO/scratch/gk-1104"; mkdir -p "$OUT"
START=scratch/night6/CB3-s13.js
[ -f "$START" ] || { echo "起点不在盘上：$START ⇒ 不起臂（宁可不跑，也别跑错起点）"; exit 4; }

arm() {  # $1=seed
  local S="$1" NAME="GK-s$S"
  ( export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE='seg' EPIRUS_TRAIN_MODE='long'
    export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK="$START" EPIRUS_SEED="$S"
    export EPIRUS_OPP_SWEEP=1 EPIRUS_PAIRED=1 EPIRUS_EFFSKILL_MIN=6 EPIRUS_EFFSKILL_SHARE=0.005
    export EPIRUS_HOLDOUT_SEG=25 EPIRUS_ANCHOR=3 EPIRUS_ARM="$NAME"
    export EPIRUS_SEL_KEEP=0.2 EPIRUS_SEL_KEEP_KEYS='charge,railgun'
    export EPIRUS_COUNTER_OPPS='guardSpam'
    export EPIRUS_BAND_DIR="$REPO/scratch/ga-bands/$NAME"
    export EPIRUS_T3P_OUT="scratch/ga-arms/$NAME.js"
    node tools/train-3p.mjs 150 5 24 8 > "$OUT/$NAME.log" 2>&1
    echo "$NAME rc=$? $(date +%H:%M:%S)" ) &
}
for S in 7 13 41; do arm "$S"; done
wait
echo "=== 上桌自证（横幅必须点名 guardSpam，否则这条臂等于没开 ⇒ 见"覆盖式接入要自证真被调用"）==="
for S in 7 13 41; do
  L="$OUT/GK-s$S.log"; [ -f "$L" ] || { echo "GK-s$S 缺日志"; continue; }
  printf 'GK-s%-3s ' "$S"
  grep -oE "counter-ops\] 判据原型已进训练桌：[^⇒]*|OPPS 从 [0-9]+ 个变 [0-9]+ 个|保留 [0-9]+/[0-9]+ 粒|冠军 [0-9]+ 种有效技能|各粒：[0-9,]+|1st=[0-9.]+%|耗时 [0-9.]+s" "$L" | tr '\n' ' ' | cut -c1-220; echo
done
ls -1 scratch/ga-arms/GK-*.js 2>/dev/null | sed 's|^|产物入库：|'
echo "GK_DONE $(date +%H:%M:%S)"
