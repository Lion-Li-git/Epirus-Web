# run-d.ps1 — 段 C 第四波：相对步长 σ 的三档扫描 × 两种输入面（S1 吃 v7 切片 ‖ S1o 吃 obs3）
# 为什么是这一波：B1 读到 σ=0.2（旧绝对口径）在 60000 局里被 1/5 律压到 0.0001，
#   而旧口径最坏坐标一步 = 自身 init 尺度的 21.4 倍（selftest2 T12b 实测）⇒ "搜索原地"是步长口径的问题，先把它扫平。
# 预登记（跑前定死）：
#   预算 targetGames=20000 ‖ holdoutGames=2408（SE≈0.65pt/臂）‖ 当选=冻结桌 40 局/格 ‖ 配对开
#   主判据 = 固定桌 dFirst；|dFirst| < 2pt ⇒ 写"分不开"
#   次判据 = holdoutFit − 起点 fit；inLoopBest 涨而 holdoutFit 跌 ⇒ "爬坡"，不晋级
#   D2/D7 与 D5/D8 是同格两粒 seed ⇒ 只当复现检查
$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\d-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }

# 守卫：等第三波（c3）跑完再开，免得两条波在同一台机器上抢 CPU 把墙钟读数搅浑
$waited = 0
while ($true) {
  $done = Select-String -Path 'D:\code\Epirus-Web\scratch\c3-wave.log' -Pattern '跑完' -SimpleMatch -Quiet -ErrorAction SilentlyContinue
  if ($done) { break }
  if ($waited -gt 1500) { say '守卫超时 25 分钟：不等了，直接开（墙钟读数要标"并发"）'; break }
  Start-Sleep -Seconds 20; $waited += 20
}
say ("开跑（等 c3 用了 {0} 秒）" -f $waited)

function runArm($name, $arch, $sig, $adapt, $seed) {
  $env:EPIRUS_ARCH2 = $arch; $env:EPIRUS_MUT_MODE = 'seg'; $env:EPIRUS_PAIRED = '1'
  say ("START {0} arch={1} sig={2} adapt={3} seed={4}" -f $name, $arch, $sig, $adapt, $seed)
  $p = "node tools/probe-cem-arm.mjs --mode=esa --targetGames=20000 --holdoutGames=2408 --games=6 --fxGames=40 --fxSelect=1 --sigmaAdaptive=$adapt --sig=$sig --n=3 --trainMode=multi --pop=14 --elite=4 --seed=$seed"
  & cmd /c "$p > scratch\$name.log 2>&1"
  say ("END {0} rc={1}" -f $name, $LASTEXITCODE)
}
$S1v = 'S1:mutRel=1'
$S1o = 'S1:input=obs3,mutRel=1'
runArm 'D1-v7-s0.1'   $S1v 0.1 0 4001
runArm 'D2-v7-s0.4'   $S1v 0.4 0 4002
runArm 'D3-v7-s1.2'   $S1v 1.2 0 4003
runArm 'D4-o3-s0.1'   $S1o 0.1 0 4004
runArm 'D5-o3-s0.4'   $S1o 0.4 0 4005
runArm 'D6-o3-s1.2'   $S1o 1.2 0 4006
runArm 'D7-v7-s0.4-b' $S1v 0.4 0 4007
runArm 'D8-o3-s0.4-b' $S1o 0.4 0 4008
runArm 'D9-o3-s0.4-a' $S1o 0.4 1 4009
Remove-Item Env:\EPIRUS_ARCH2, Env:\EPIRUS_MUT_MODE, Env:\EPIRUS_PAIRED -ErrorAction SilentlyContinue
say '=== 段 C 第四波跑完 ==='
