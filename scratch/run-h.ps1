# run-h.ps1 — 段 D′ 第二波：**DAgger**（标签出在被评者自己走到的局面上）能不能把"模仿"换成"强度"
# 第五段的账（原件 scratch/F1..F6.log ‖ scratch/H-tie-diag.log ‖ scratch/G-temp*.log）：
#   · 稠密货币确实有梯度：F1 把留出组内 top-1 从 3.3% 推到 66.9%（CE 10.58→1.458，地板 H=0.953/ln n=3.074）；
#   · 但同一粒在 16 格 × 1920 局上：temp=0.6 与随机起点**分不开**（+0.47pt），temp→0.001 贪心执行**差 12.55pt（过线）**；
#   · 而它**在自己走出来的局面上**的读数几乎不掉（top-1 66.0% ‖ 配对序 83.7%）⇒ "分布漂移"这条解释被否证；
#   · 并列破号也被否证（我方最大集合平均 1.10 枚，v7 自己 1.61）。
# 这一波因此判的是最后一格：**再多轮 DAgger 迭代（在自己局面上继续对齐 v7）会不会买来对局强度？**
#   买得到 ⇒ 模仿路线只是没跑完；买不到 ⇒ "v7 的强度不住在组内序里"，产品目标必须回到整局货币 + 降方差，而不是再换货币。
# 预登记（跑前定死）：主判据 = profile2 的 Δ夺1(2.0−随机)，temp=0.6 与 temp=0.001 两档各读一次，SE 由工具印出；
#   |Δ| < 2×SE ⇒ 写"分不开"；两档都 ≤0 且过线 ⇒ 判"模仿路线在 2.0 当前形态下买不到强度"。
#   ⛔ 不许拿 rankfit 的 top-1/CE 当强度证据（那是"像不像 v7"，不是"赢不赢"）。
$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\h-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
$waited = 0
while ($true) {
  $done = Select-String -Path 'D:\code\Epirus-Web\scratch\f-wave.log' -Pattern '跑完' -SimpleMatch -Quiet -ErrorAction SilentlyContinue
  if ($done) { break }
  if ($waited -gt 1500) { say '守卫超时 25 分钟：直接开（墙钟标"并发"）'; break }
  Start-Sleep -Seconds 20; $waited += 20
}
say ("开跑（等 F 波用了 {0} 秒）" -f $waited)
$f1 = 'scratch/arms/202610281752-rankfit-S1-s21.bak'
$f3 = ''
Get-ChildItem 'D:\code\Epirus-Web\scratch\arms' -Filter '*rankfit-S1-s23.bak' | ForEach-Object { $f3 = 'scratch/arms/' + $_.Name }
$f4 = ''
Get-ChildItem 'D:\code\Epirus-Web\scratch\arms' -Filter '*rankfit-S1o-s21.bak' | ForEach-Object { $f4 = 'scratch/arms/' + $_.Name }
function runArm($name, $arch, $learner, $seed) {
  say ("START {0} arch={1} learner={2} seed={3}" -f $name, $arch, $learner, $seed)
  $p = "node --max-old-space-size=4096 tools/proto2/rankfit.mjs --arch=$arch --dagger=$learner --groups=1200 --pops=12 --iters=120 --elite=3 --seed=$seed"
  & cmd /c "$p > scratch\$name.log 2>&1"
  say ("END {0} rc={1}" -f $name, $LASTEXITCODE)
}
runArm 'H1-dag-S1-a' 'S1' $f1 41
runArm 'H2-dag-S1-b' 'S1' $f1 42
if ($f3 -ne '') { runArm 'H3-dag-S1-c' 'S1' $f3 43 }
if ($f4 -ne '') { runArm 'H4-dag-S1o-a' 'S1o' $f4 44 }
say '=== 段 D′ 第二波（DAgger）跑完 ==='
