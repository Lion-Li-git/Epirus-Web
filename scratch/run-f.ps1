# run-f.ps1 — 段 D′ 第一波：**稠密监督排序货币**下，S1(吃 v7 切片) vs S1o(吃 obs3) 谁能被训起来
# 前四波 + 第五波的账（原件 scratch/A*.log scratch/B*.log scratch/D*.log scratch/E*.log）：
#   · 二十臂扫遍 预算/步长口径/当选面/配对开关/ES‖CEM/热启动 ⇒ |Δ夺1| ≤ 1.16pt（SE≈0.9）全分不开；
#   · 每两万局只有 2~8 次"真打过父代" ⇒ 整局货币在这个精度下几乎没有梯度；
#   · 热启动（蒸馏粒）也一样推不动 ⇒ 判"货币没有梯度"，不是"起点差"。
# 这一波按 9.3 决策规则走第三条：**换适应度**。一次评估不打一局，代价 ~2.6 局，但桌与标签全冻。
# 预登记（跑前定死）：
#   主判据 = 留出组上的 **CE 相对地板的位置**（地板 H=目标自熵，天花板 ln n）与 Δ配对序；
#   top-1 只作辅读（并列组 ~26%，一律对着 hitVal 看）；
#   判语线：留出 CE 落进 [H, H+0.35] ⇒ "结构装得下现役冠军"；落在 (H+0.35, ln n−0.35) ⇒ "装得下一部分"；
#            贴着 ln n ⇒ "这档结构在稠密货币下也没学动"。
#   ⚑ 两档**同一批标签**（rankfit 的标签冻在装档之前 + 对手表定标 + 逐组打乱 ⇒ 三条自证都在读数前面跑）
$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\f-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
say '=== 段 D′ 第一波（rankfit ‖ 2400 组 ‖ pop16 ‖ 150 代 ‖ elite4 ‖ S1/S1o 各三粒 seed）==='
$arms = @(
  @('F1-S1-s21',  'S1',  21),
  @('F2-S1-s22',  'S1',  22),
  @('F3-S1-s23',  'S1',  23),
  @('F4-S1o-s21', 'S1o', 21),
  @('F5-S1o-s22', 'S1o', 22),
  @('F6-S1o-s23', 'S1o', 23)
)
foreach ($a in $arms) {
  $name = $a[0]; $arch = $a[1]; $seed = $a[2]
  say ("START {0} arch={1} seed={2}" -f $name, $arch, $seed)
  $p = "node --max-old-space-size=4096 tools/proto2/rankfit.mjs --arch=$arch --groups=2400 --pops=16 --iters=150 --elite=4 --seed=$seed"
  & cmd /c "$p > scratch\$name.log 2>&1"
  say ("END {0} rc={1}" -f $name, $LASTEXITCODE)
}
say '=== 段 D′ 第一波跑完 ==='
