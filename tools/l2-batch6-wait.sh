#!/usr/bin/env bash
# 批次 6：把 f vs c 的**配对** seed 数推到能判 ±10pt 的量级（§11b 的账：~9 对）。
# 只等批次 5 的完成标记（不查 .training.lock —— 两臂之间会有一瞬无锁，那是产物串味的事故面）。
for i in $(seq 1 240); do
  if grep -q BATCH5_DONE docs/artifacts/l2-batch5.log 2>/dev/null; then break; fi
  sleep 20
done
sleep 10
L2_ARMS=c,f L2_SEEDS=121,122,123,124,125,126,127,128,129,130,131,132 node tools/l2-arms.mjs > docs/artifacts/l2-batch6.log 2>&1
echo "BATCH6_DONE" >> docs/artifacts/l2-batch6.log
