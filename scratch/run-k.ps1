# run-k.ps1 — 段 D′ 第三波：**修好"v7 被 2.0 接走"之后，整局货币重量一遍**
# 为什么这一波必须先跑（03:2x 确诊，原件 scratch/route-check.mjs 的输出）：
#   `shapeOf(v7)` 是 {v:7, legacy:false} ⇒ `evo.js:21` 的 LEGACY 判 false ⇒ 选择器走"现代分支" = `P.chooseCandidates/forwardCands`。
#   arch2 把这两个入口换成 2.0 实现之后，**v7 的包也按 2.0 的偏移被切着打**（3 局 v7 自对局 = 423 次 2.0 forward）。
#   ⇒ 段 C/E 那二十臂的**对手表与 holdout 对手全是被切坏的文在**，而"参照行"也一起坏（profile2 读到 25.8%，真值 40.3%）。
#   现在 arch2 加了长度守卫（`params.length !== L.n` 一律交回原实现），selftest2 新增 T14 钉住它（31 条全过）。
# 这一波只问一件事：**在同一份配方下，把对手换回真 v7，整局货币还是不给出梯度吗？**
#   对照就是段 C 第四波的 D2/D7（同 config，唯一区别是 arena 坏了）：dFirst +0.17pt / −0.25pt ‖ 接受 2 次 / 2 次（两万局）。
# 预登记：主判据 = 冻结桌"真打过父代"的次数 与 dFirst（holdout 2408 ⇒ SE≈0.9pt）。
#   接受次数明显上来（≥15 次/两万局）⇒ "货币太稀"这句要改成"arena 坏了"；仍是个位数 ⇒ 稀这条站得住。
$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\k-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
say '=== 段 D′ 第三波（arena 修好之后重跑整局货币 ‖ 20000 局/臂 ‖ 与 D2/D7 同配方）==='
function runArm($name, $seed) {
  $env:EPIRUS_ARCH2 = 'S1:mutRel=1'; $env:EPIRUS_MUT_MODE = 'seg'; $env:EPIRUS_PAIRED = '1'
  say ("START {0} seed={1}" -f $name, $seed)
  $p = "node tools/probe-cem-arm.mjs --mode=esa --targetGames=20000 --holdoutGames=2408 --games=6 --fxGames=40 --fxSelect=1 --sig=0.4 --n=3 --trainMode=multi --pop=14 --elite=4 --seed=$seed"
  & cmd /c "$p > scratch\$name.log 2>&1"
  say ("END {0} rc={1}" -f $name, $LASTEXITCODE)
}
runArm 'K1-arena-fixed-a' 7001
runArm 'K2-arena-fixed-b' 7002
runArm 'K3-arena-fixed-c' 7003
Remove-Item Env:\EPIRUS_ARCH2, Env:\Epirus_MUT_MODE, Env:\EPIRUS_PAIRED -ErrorAction SilentlyContinue
say '=== 段 D′ 第三波跑完 ==='
