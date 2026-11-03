# run-c.ps1 — 段 C：在 2.0 原型 S1 上"一次只动一轴"的四臂（独立进程，串行）
# 预登记判据（跑前定死，不许事后改）：
#   主判据 = 固定桌留出的 holdoutFit / dFirst / dTop2（同一函数、同一场、同一批桌）
#   晋级线 = 起点基线之上；**inLoopBest 涨而 holdoutFit 跌 ⇒ 判"在选择噪声上爬坡"，该臂不晋级**（§E822 条款）
#   分辨力 = holdoutGames=600 ⇒ SE≈1.3pt/臂 ⇒ |dFirst| < 2pt 一律写"分不开"，不解释成谁好
#   预算货币 = 计数器数的**实际局数**与决策/候选打分次数；四臂串行 ⇒ 墙钟可比
$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\c-wave.log'
function say($t) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }

$arms = @(
  @{ name='C1-paired-g6';  paired='1'; games=6; mode='esa'; mut='seg'; seed=1101 },
  @{ name='C2-unpaired-g6'; paired=''; games=6; mode='esa'; mut='seg'; seed=1102 },
  @{ name='C3-paired-g2';  paired='1'; games=2; mode='esa'; mut='seg'; seed=1103 },
  @{ name='C4-paired-cem'; paired='1'; games=6; mode='cem'; mut='seg'; seed=1104 }
)
say '=== 段 C 四臂开跑（S1 ‖ targetGames=1200 ‖ holdoutGames=600 ‖ n=3 trainMode=multi）==='
foreach ($a in $arms) {
  $env:EPIRUS_ARCH2 = 'S1'
  $env:EPIRUS_MUT_MODE = $a.mut
  if ($a.paired -eq '1') { $env:EPIRUS_PAIRED = '1' } else { Remove-Item Env:\EPIRUS_PAIRED -ErrorAction SilentlyContinue }
  $out = "scratch/$($a.name).log"
  $pn = 'OFF'; if ($a.paired -eq '1') { $pn = 'ON' }
  say ("START {0} paired={1} games={2} mode={3} seed={4}" -f $a.name, $pn, $a.games, $a.mode, $a.seed)
  & node tools/probe-cem-arm.mjs --mode=$($a.mode) --targetGames=1200 --holdoutGames=600 --games=$($a.games) --n=3 --trainMode=multi --pop=14 --elite=4 --seed=$($a.seed) *>> $out
  $rc = $LASTEXITCODE
  say ("END {0} rc={1}" -f $a.name, $rc)
}
Remove-Item Env:\EPIRUS_ARCH2 -ErrorAction SilentlyContinue
Remove-Item Env:\EPIRUS_MUT_MODE -ErrorAction SilentlyContinue
Remove-Item Env:\EPIRUS_PAIRED -ErrorAction SilentlyContinue
say '=== 段 C 四臂跑完 ==='
