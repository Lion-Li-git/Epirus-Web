#!/bin/bash
# 训练队列第 3 段（ZCode 11-06 晨）：R64 新规则下的注入审计 + 课程席种子批。
# 臂设计：
#   CTRL2-s13  = 裸跑对照（当前代码、无任何 env 旋钮）——R64 后的 CTRL 重制
#   NOINJ-s13  = 全部 CLI 可达注入旋钮**显式置 0** ⇒ 与 CTRL2 逐位比较：
#                相同 = "CLI 入口无隐藏注入"的实证；不同 = 有隐藏状态（发现！）
#                （IMIT/BEAD_SEED/TRAIN_SEAT_GAMES 走服务端 econ 通道，CLI 暗键侦测根本不收
#                 ⇒ CLI 臂结构性拿不到，无需也无法显式清零）
#   ALLON-s13  = CLI 可达注入全开（补贴珠/收割席/课程席/家族席）⇒ 与 CTRL2 差 = 注入在 2.0 上的增量
#   CR8-s14    = 课程席 K=8、种子 14（R64 后复跑昨晚 +5.3pt 的信号）
cd /d/code/Epirus-Web
export EPIRUS_ARCH2="S1ob:input=obs3b,gen=3,keySplit=1"
export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=scratch/ga-arms/KDFULL400-s13.js EPIRUS_TRAIN_MODE=multi
run() { # arm seed extraEnv...
  local arm=$1 seed=$2; shift 2
  echo "=== $arm start $(date +%H:%M:%S) ==="
  env "$@" EPIRUS_ARM=$arm EPIRUS_SEED=$seed EPIRUS_T3P_OUT=scratch/ga-arms/$arm.js \
    node tools/train-3p.mjs 60 5 24 8 > scratch/zcode-1106/$arm.log 2>&1
  echo "=== $arm rc=$? $(date +%H:%M:%S) ==="
}
run CTRL2-s13 13
run NOINJ-s13 13 EPIRUS_SUB_BEAD=0 EPIRUS_KILL_FIELD=0 EPIRUS_COURSE_EVERY=0 EPIRUS_MIX8=0 EPIRUS_FAMILY_FIELD=0 EPIRUS_CLEAR_W=0 EPIRUS_MIX2_EVERY=0
run ALLON-s13 13 EPIRUS_SUB_BEAD=1 EPIRUS_KILL_FIELD=0.2 EPIRUS_COURSE_EVERY=4 EPIRUS_FAMILY_FIELD=3
run CR8-s14   14 EPIRUS_COURSE_EVERY=8
echo QUEUE3-ALL-DONE
