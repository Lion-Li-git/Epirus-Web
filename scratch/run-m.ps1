# run-m.ps1 — 段 D′ 第四波（任务 #142）：**Arena 已修 + 评估温度钉成贪心**，整局货币这次给出梯度了吗
# 两条各半的候选解释，到 02:4x 都还站着：
#   (H1) 货币太稀 —— 段 C/E 二十臂 + K1（arena 修好、温度照旧）都还是个位数接受 / dFirst 在噪声里；
#   (H2) 执行太糊 —— 2.0 头 logits 间距 ~0.3、v7 分差 ~50 ⇒ 同一个绝对 temp 下 2.0 打得近似掷硬币
#        （同一粒 16 格 × 1920 局：temp=0.6 读 18.1% ‖ temp=0.001 读 33.6% ‖ v7 那两条路本来就是饱和贪心）。
# 这一波就是 H2 的判决：`--playtemp=0.001`（工具会回读 trainEps().temp 自证生效），其余配方与 D2/K1 逐字相同。
# 预登记：主判据 = 两万局里"冻结桌上真打过父代"的次数 与 dFirst（holdout 2408 ⇒ SE≈0.9pt）。
#   接受次数 ≥15 或 |dFirst| > 2pt ⇒ H2 站住，"货币太稀"这句要降级为"在高熵执行下才显得稀"；
#   仍个位数且 |dFirst|<2pt ⇒ H2 被否证，稀这条站着，转去做"逐格双峰"那道题（#141 的余文）。
# ⚠ 这一档换了适应度刻度 ⇒ 只与同档臂互比，不与 K/D 批的绝对 fit 并排。
$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\m-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
$waited = 0
while ($true) {
  $done = Select-String -Path 'D:\code\Epirus-Web\scratch\k-wave.log' -Pattern '跑完' -SimpleMatch -Quiet -ErrorAction SilentlyContinue
  if ($done) { break }
  if ($waited -gt 900) { say '守卫超时 15 分钟：直接开（墙钟标"并发"）'; break }
  Start-Sleep -Seconds 15; $waited += 15
}
say ("开跑（等 K 波用了 {0} 秒）" -f $waited)
function runArm($name, $seed) {
  $env:EPIRUS_ARCH2 = 'S1:mutRel=1'; $env:EPIRUS_MUT_MODE = 'seg'; $env:EPIRUS_PAIRED = '1'
  say ("START {0} seed={1}" -f $name, $seed)
  $p = "node tools/probe-cem-arm.mjs --mode=esa --targetGames=20000 --holdoutGames=2408 --games=6 --fxGames=40 --fxSelect=1 --sig=0.4 --n=3 --trainMode=multi --pop=14 --elite=4 --playtemp=0.001 --seed=$seed"
  & cmd /c "$p > scratch\$name.log 2>&1"
  say ("END {0} rc={1}" -f $name, $LASTEXITCODE)
}
runArm 'M1-greedy-a' 8001
runArm 'M2-greedy-b' 8002
runArm 'M3-greedy-c' 8003
Remove-Item Env:\EPIRUS_ARCH2, Env:\Epirus_MUT_MODE, Env:\EPIRUS_PAIRED -ErrorAction SilentlyContinue
say '=== 段 D′ 第四波跑完 ==='
