$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\ab-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
# 单变量 A/B：与 R1 **同一枚 seed(7)、同一剂量**，只差 §E824 那处形参（蓄能在不在标签面上）。
#   目的：把"修好之后夺1 +3.49pt"这件事**归因到位**——是这条 bug 的钱，还是 seed 的钱。
#   `--allowdroplabels` 只在这条臂上开（它是"故意重现旧 bug"的对照组），并让表头印出**掉了多少枚**。
say 'START AB-pre ‖ seed=7 ‖ 蓄能形参错位还原（单变量对照）'
& cmd /c "node --max-old-space-size=4096 scratch/ab-pre/rankfit-prefix.mjs --arch=S1 --groups=1600 --pops=16 --iters=120 --seed=7 --allowdroplabels --out=scratch/arms/ABpre-v7bug-S1.bak > scratch/ABpre.log 2>&1"
say ("END AB-pre rankfit rc={0}" -f $LASTEXITCODE)
& cmd /c "node --max-old-space-size=4096 tools/proto2/profile2.mjs --pack=scratch/arms/ABpre-v7bug-S1.bak --temp=0.001 --games=120 > scratch/P-ABpre-t0.001.log 2>&1"
say ("END AB-pre profile2 rc={0}" -f $LASTEXITCODE)
say '=== A/B 跑完 ==='
