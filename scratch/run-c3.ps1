# run-c3.ps1 — 段 C 第三波：把剂量抬到 10 倍，并把"当选的分辨率"抬到 30 局/格
# 上一波读到的事实（00:3x，原件 scratch/A*.log）：
#   · fxSelect 砍掉了棘轮（inLoopBest 0.98/1.05 → 0.765/0.794）⇒ "在选择噪声上爬坡"确实是棘轮造成的；
#   · 但 6 局的冻结桌自己就比父子差还吵 ⇒ 6000 局只接受 3~4 次改进 ⇒ 留出还是不动；
#   · fxGames=30 的烟测（900 局）里预选 3 次接受 2 次 ⇒ 分辨率一抬，接受/拒绝才变成有意义的判据。
# 预登记判据（跑前定死）：
#   主判据 = 固定桌留出 dFirst（SE≈0.9pt）；|dFirst| < 2pt ⇒ 写"分不开"
#   次判据 = holdoutFit 与起点之差；**inLoopBest 涨而 holdoutFit 跌 ⇒ 判"爬坡"，不晋级**
#   B1 与 B5 同格两粒 seed ⇒ 只当复现检查（两粒同向不算普适，在册条款）
$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\c3-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
function runArm($name, $paired, $fx, $fxg, $adapt, $mode, $seed) {
  $env:EPIRUS_ARCH2 = 'S1'; $env:EPIRUS_MUT_MODE = 'seg'
  if ($paired -eq 1) { $env:EPIRUS_PAIRED = '1' } else { Remove-Item Env:\EPIRUS_PAIRED -ErrorAction SilentlyContinue }
  say ("START {0} paired={1} fx={2} fxg={3} adapt={4} mode={5} seed={6}" -f $name, $paired, $fx, $fxg, $adapt, $mode, $seed)
  $p = "node tools/probe-cem-arm.mjs --mode=$mode --targetGames=60000 --holdoutGames=2408 --games=6 --fxGames=$fxg --fxSelect=$fx --sigmaAdaptive=$adapt --n=3 --trainMode=multi --pop=14 --elite=4 --seed=$seed"
  & cmd /c "$p > scratch\$name.log 2>&1"
  say ("END {0} rc={1}" -f $name, $LASTEXITCODE)
}
say '=== 段 C 第三波（60000 局/臂 ‖ fxGames=30 ‖ 5 臂串行）==='
runArm 'B1-fx30-adapt'   1 1 30 1 'esa' 3001
runArm 'B2-fx30-nofix-s' 1 1 30 0 'esa' 3002
runArm 'B3-fx0-adapt'    1 0 0  1 'esa' 3003
runArm 'B4-cem-60k'      1 0 0  0 'cem' 3004
runArm 'B5-fx30-adapt-b' 1 1 30 1 'esa' 3005
Remove-Item Env:\EPIRUS_ARCH2, Env:\EPIRUS_MUT_MODE, Env:\EPIRUS_PAIRED -ErrorAction SilentlyContinue
say '=== 段 C 第三波跑完 ==='
