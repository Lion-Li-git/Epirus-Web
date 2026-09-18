#!/usr/bin/env bash
# 等批次 3/4 的训练进程全部退出（不能只看 .training.lock：两臂之间也有一瞬无锁）⇒ 再起批次 5。
alive() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'l2-arms|ring2-run|train-server' } | Measure-Object | Select-Object -ExpandProperty Count" 2>/dev/null | tr -d '\r\n '
}
for i in $(seq 1 120); do
  n=$(alive)
  if [ "$n" = "0" ]; then break; fi
  sleep 20
done
echo "waited; node procs now: $(alive)"
L2_ARMS=c,f,s L2_SEEDS=111,112,113,114,115 node tools/l2-arms.mjs > docs/artifacts/l2-batch5.log 2>&1
echo "BATCH5_DONE" >> docs/artifacts/l2-batch5.log
