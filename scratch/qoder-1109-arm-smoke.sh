#!/bin/sh
# 机制臂（用户 11-09 令「继续跑一下试试」）：证明两个新当选面旋钮**真的接上线**，不是装饰。
# 四臂各 60 代 · 5 人 · games 8 · pop 8 ≈ 5 分钟/臂 ⇒ 全程约 20–25 分钟。
# 产物与 band 都改道进 scratch/qoder-1109-arms/（不落 docs/artifacts ⇒ 不触发 D191 的"未登记重复"）。
# 判据不是"臂跑成功"，而是每一步那三行必须自己说话：逐粒读数 / 改没改判 / 空转或全否要响亮。
set -u
cd "$(git rev-parse --show-toplevel)"
D=scratch/qoder-1109-arms
mkdir -p "$D/bands"
run() {
  NAME=$1; shift
  echo "================ $NAME ($(date '+%H:%M:%S')) ================"
  env "$@" EPIRUS_ARM="$NAME" EPIRUS_T3P_OUT="$D/$NAME.js" EPIRUS_BAND_DIR="$D/bands/$NAME" \
    node tools/train-3p.mjs 60 5 8 8 > "$D/$NAME.log" 2>&1
  echo "exit=$? ‖ 回执 $D/$NAME.log"
  grep -E "\[用卡地板\]|\[白防选人\]|selCardsAllDropped|selDefqNoSample|恒假|量具同代" "$D/$NAME.log" | head -12
}

# ① 基线：两条都关 ⇒ 那两段一行都不该出现（出现了就是关档没守住）
run BASE EPIRUS_SEED=13
# ② P2 该咬：现役形状里 <9 张是多数 ⇒ 期望"剔 N/M + 逐粒读数 + 改判或未改判"
run CARDS9 EPIRUS_SEED=13 EPIRUS_SEL_CARDS=9
# ③ P1 该有读数：带内逐粒白防率 + placebo 倍差 + 手数门统计
run DEFQ EPIRUS_SEED=13 EPIRUS_SEL_DEFQ=0.6 EPIRUS_SEL_DEFQ_GAMES=40
# ④ 牙：把线抬到全卡种上限之下、任何粒都够不着 ⇒ 必须走 allRejected 那条响亮支路，而不是静默换人
run CARDS29 EPIRUS_SEED=13 EPIRUS_SEL_CARDS=29
echo "================ 四臂跑完 ($(date '+%H:%M:%S')) ================"
