#!/usr/bin/env bash
# 批次 7（改设计）：开 `EPIRUS_ALLOW_HEALTH_FAIL=1`，让**每个 seed 都落盘** ⇒ 配对数 = seed 数。
# 为什么改：批次 5/6 实测出厂门槛通过率只有 ~31%（c 臂合计 9/29），而配对设计要求两臂同 seed 都过 ⇒
#   期望配对 ≈ n × 0.31 × 0.35 ≈ 0.11n ⇒ 12 个 seed 只能给 1~2 对，30 个 seed 才够 4 对 —— 太贵。
#   门槛本来是"别把窄包发出去"的**产品闸门**，不是实验的自变量；拿它当实验筛子等于随机丢样本（还引入幸存者偏，§21 caveat 2）。
# ⚠ 代价与对照：这一批的产物里会混进 G<3 的窄包 ⇒ 分析时必须把 **G 当协变量分层**（§21 已经这么做过一次），
#   并且**这批不能和批次 2 的"幸存者池"混在一张表里排名**（不同抽样分布）。
# 等批次 6 的完成标记（**不查 .training.lock**：两臂之间会短暂无锁 ⇒ 会串味）。
for i in $(seq 1 300); do
  if grep -q BATCH6_DONE docs/artifacts/l2-batch6.log 2>/dev/null; then break; fi
  sleep 20
done
sleep 15
echo "batch7: EPIRUS_ALLOW_HEALTH_FAIL=1, arms=c,f, seeds=141..152, at $(date -u +%FT%TZ)" > docs/artifacts/l2-batch7-manifest.txt
EPIRUS_ALLOW_HEALTH_FAIL=1 L2_ARMS=c,f L2_SEEDS=141,142,143,144,145,146,147,148,149,150,151,152 node tools/l2-arms.mjs > docs/artifacts/l2-batch7.log 2>&1
echo "BATCH7_DONE" >> docs/artifacts/l2-batch7.log
