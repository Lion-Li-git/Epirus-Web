# run-a6.ps1 — 用**独立进程**跑 2.0 的对齐 dump（脱离 harness 的任务超时）
# 一份 walk 同时产出三种输入：v7 的 235 维 ‖ obs2（DS 版）‖ obs3（我这版）⇒ 编码器之间是**配对**比较
# 三个 regime：standard/5 ‖ standard/3 ‖ long/5 ⇒ 死维闸要判"样本能不能变这个输入"就有分母
$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\a6-wave3.log'
function say($t) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
say 'START (detached)'
$jobs = @(
  @{ cfg = 'standard/5'; tag = 'std5' },
  @{ cfg = 'standard/3'; tag = 'std3' },
  @{ cfg = 'long/5';     tag = 'long5' }
)
foreach ($j in $jobs) {
  $out = "scratch/a6w-$($j.tag).jsonl"
  $o2  = "scratch/a6w-$($j.tag)-obs2.jsonl"
  $o3  = "scratch/a6w-$($j.tag)-obs3.jsonl"
  say "### cfg=$($j.cfg) -> $out"
  & node tools/probe-myopia-regret.mjs --arm=A0 --envs=aggro,wall,antidef,tankline,random,mix `
    --config=$($j.cfg) --games=10 --every=2 --keep=40 --rep=6 --seed=4100 --freshrng `
    --dump=$out --dumpobs=$o2 --dumpobs3=$o3 *>> $log
  say "rc=$LASTEXITCODE tag=$($j.tag)"
}
say 'END (all configs)'
