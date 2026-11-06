$ErrorActionPreference = 'Continue'
Set-Location D:\code\Epirus-Web
$D = 'scratch/N-fx-dump240.jsonl'
# N 波：rollout 赢率当稠密同向标签（夹具落盘版）‖ 两档同 dump、同剂量
Write-Output '===== N1 ‖ arch=S1 ‖ fromdump ====='
node tools/proto2/rankfit.mjs --arch=S1  --fromdump=$D --fxmin=150 --pops=16 --iters=120 --seed=7 --out=scratch/arms/N1-fx-S1.bak 2>&1 | Tee-Object -FilePath scratch/N1.log | Select-Object -Last 14
Write-Output "rc=$LASTEXITCODE"
Write-Output '===== N2 ‖ arch=S1o ‖ fromdump（同一份 dump）====='
node tools/proto2/rankfit.mjs --arch=S1o --fromdump=$D --fxmin=150 --pops=16 --iters=120 --seed=7 --out=scratch/arms/N2-fx-S1o.bak 2>&1 | Tee-Object -FilePath scratch/N2.log | Select-Object -Last 14
Write-Output "rc=$LASTEXITCODE"
Write-Output '===== R1 ‖ F1 配方在**修好蓄能形参错位之后**复跑（v7 蒸馏货币，不是 rollout）====='
node tools/proto2/rankfit.mjs --arch=S1 --groups=1600 --pops=16 --iters=120 --seed=7 --out=scratch/arms/R1-v7fix-S1.bak 2>&1 | Tee-Object -FilePath scratch/R1.log | Select-Object -Last 14
Write-Output "rc=$LASTEXITCODE"
