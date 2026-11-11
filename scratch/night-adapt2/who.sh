#!/bin/bash
# 训练在跑什么（给人和班次看）：node 进程里的 MSB 驱动器 + train-3p 臂 + 各线最新读数。
# 用法: bash scratch/night-adapt2/who.sh
cd "$(dirname "$0")/../.."
echo "=== 驱动器（msbatch2）==="
powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'msbatch2' } | ForEach-Object { if (\$_.CommandLine -match '--arm=([A-Za-z0-9-]+)') { '\$' + 'arm=' + \$Matches[1] + '  pid=' + \$_.ProcessId } }"
echo "=== 训练臂（train-3p）==="
powershell -Command "(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'train-3p' }).Count" | sed 's/^/在跑臂数: /'
echo "=== 各线最新状态（state 文件 = 最近换代冠军）==="
for f in scratch/night-adapt2/msbatch2-*state.json; do
  node -e "const s=require('./$f'); console.log('$f'.match(/msbatch2-([A-Za-z0-9-]+)-state/)[1].padEnd(14), '冠军', s.champion.split('/').pop().padEnd(30), 'C', s.champT ? s.champT.mean.toFixed(4) : '?')" 2>/dev/null
done
echo "=== 日志尾部（scratch/night-adapt2/msbatch2.log 最后 5 行）==="
tail -5 scratch/night-adapt2/msbatch2.log
