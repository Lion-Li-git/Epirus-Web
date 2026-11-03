# run-e.ps1 — 段 C/E 第五波：**热启动（蒸馏粒）**× **每评估 40 局**（两轴一起推到以前没到过的档位）
# 前四波的账（原件 scratch/A*.log scratch/B*.log scratch/D*.log）：
#   · 随机起点、6000~60000 局、σ 绝对/相对、配对开/关、当选环内/冻结桌 —— **六臂全部 ±1.2pt 内，分不开**；
#   · 接受次数只有 2~8 次/两万局 ⇒ 这套"整局结果 × 每格几局"的适应度基本给不出梯度；
#   · fit2 蒸馏出一个**非随机起点**（留出半批：top-1 49.3% ‖ 配对序 62.9% ‖ 随机基线 7.8%）。
# 这一波判的是：**是"从随机起点走不动"，还是"这货币本身没有梯度"？** 热启动若能推开 ⇒ 前者；仍推不开 ⇒ 后者，
#   那就得换适应度（监督排序 / 更长的每格局数 / 配对自对局），而不是再堆预算。
# 预登记：主判据 = 固定桌 dFirst（holdout 2408 ⇒ SE≈0.9pt）；|dFirst|<2pt 写"分不开"；
#   热启动臂与冷启动臂的 FIX_OPPS 不同（对手表由起点粒造）⇒ **只在同一家族内横比**，跨家族只比各自的 dFirst。
$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\e-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
$waited = 0
while ($true) {
  $done = Select-String -Path 'D:\code\Epirus-Web\scratch\d-wave.log' -Pattern '跑完' -SimpleMatch -Quiet -ErrorAction SilentlyContinue
  if ($done) { break }
  if ($waited -gt 1800) { say '守卫超时 30 分钟：直接开（墙钟标"并发"）'; break }
  Start-Sleep -Seconds 20; $waited += 20
}
say ("开跑（等 d 波用了 {0} 秒）" -f $waited)
function runArm($name, $arch, $start, $mode, $seed) {
  $env:EPIRUS_ARCH2 = $arch; $env:EPIRUS_MUT_MODE = 'seg'; $env:EPIRUS_PAIRED = '1'
  $st = ''
  if ($start -ne '') { $st = "--start=$start" }
  $lab = '随机'; if ($start -ne '') { $lab = $start }
  say ("START {0} arch={1} start={2} seed={3}" -f $name, $arch, $lab, $seed)
  $p = "node tools/probe-cem-arm.mjs --mode=esa --targetGames=30000 --holdoutGames=2408 --games=40 --fxGames=40 --fxSelect=1 --sig=0.3 --n=3 --trainMode=multi --pop=6 --elite=3 $st --seed=$seed"
  & cmd /c "$p > scratch\$name.log 2>&1"
  say ("END {0} rc={1}" -f $name, $LASTEXITCODE)
}
$dS1 = 'scratch/arms/202610281705-distill-S1.bak'
$dS1o = 'scratch/arms/202610281705-distill-S1o.bak'
$S1 = 'S1:mutRel=1'; $S1o = 'S1:input=obs3,mutRel=1'
runArm 'E1-hot-v7-a'  $S1  $dS1  '' 5001
runArm 'E2-hot-v7-b'  $S1  $dS1  '' 5002
runArm 'E3-hot-o3-a'  $S1o $dS1o '' 5003
runArm 'E4-hot-o3-b'  $S1o $dS1o '' 5004
runArm 'E5-cold-v7'   $S1  ''    '' 5005
runArm 'E6-cold-o3'   $S1o ''    '' 5006
Remove-Item Env:\EPIRUS_ARCH2, Env:\Epirus_MUT_MODE, Env:\EPIRUS_PAIRED -ErrorAction SilentlyContinue
say '=== 段 E 第五波跑完 ==='
