# 本班证据表（从 gitignore 的 `scratch/` 搬进来，白班克隆里才读得到）

原件都在 `scratch/`（`.gitignore` 里），所以下面这些是**逐字节副本**，不是第二套数：

| 文件 | 行数/字节 | sha256 前 16 | 出处 | 怎么重算 |
|---|---:|---|---|---|
| `g5-pool-1124.tsv` | 53 行 ‖ 3780 B | `93db8153402d4062` | 池 25 枚 + 线上包的 G4/G5 全员普查抽表（STATUS §4.21） | 见 STATUS 对应节里给的命令 |
| `g5-arms-grid.tsv` | 15 行 ‖ 1440 B | `970cbe4142285a4c` | 9 枚闭环臂的 G5 复现读数抽表（STATUS §4.23） | 见 STATUS 对应节里给的命令 |
| `pool-runlog-coverage-1124.tsv` | 26 行 ‖ 781 B | `2f3fa7944a793332` | 池成员在训练台账里的留痕覆盖率（STATUS §4.19） | 见 STATUS 对应节里给的命令 |
| `dose-curve-1124.tsv` | 10 行 ‖ 992 B | `a3361893eedf38b6` | 剂量×seed 的闭环曲线表（STATUS §4.24；由 scratch/dose-curve-table.mjs 现算） | 见 STATUS 对应节里给的命令 |
| `zero-chance-anatomy-1124.tsv` | 26 行 ‖ 866 B | `a677c0779394e343` | "有机会不抓手 / 机会为 0 / 分母不足"三分类逐枚底数（STATUS §4.27） | 见 STATUS 对应节里给的命令 |
| `dose-vs-defense-grid-1124.tsv` | 31 行 ‖ 5336 B | `379680f320c3a8e5` | 闭环 × 破防 合表（STATUS §4.29；由 grid-1124b.mjs 现读臂 meta + g5 日志生成，带每行出处） | 见 STATUS 对应节里给的命令 |
| `arenaB-arms-1124.tsv` | 9 行 ‖ 763 B | `a2d36139592813b4` | 六粒候选 + 两枚基座的 Arena B 轴读数与相对差（STATUS §4.33；对照尺是在册账 arenaSpread 列的 P10=21.39pt 全距地板） | 见 STATUS 对应节里给的命令 |
| `arenaB-paired-1124.tsv` | 45 行 ‖ 2512 B | `6c9720f452e53aec` | Arena B 六粒 seed 逐 seed 配对表：六臂平均差、六粒里退的粒数、符号检验 p 与臂自身全距（STATUS §4.34） | 见 STATUS 对应节里给的命令 |
| `pool-union-1124.tsv` | 15 行 ‖ 633 B | `9b407308336f1b7d` | 池级技能并集现读（在册 25 份 stage1 报告、格数>0）与六枚候选各补的键（STATUS §4.35） | 见 STATUS 对应节里给的命令 |

⚠ 搬动规矩：这些表**只能由生成脚本重算**，不许手改；每份都带 sha256 前 16 位，对不上就说明有人改过。
