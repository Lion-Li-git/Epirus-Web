# V7 时代会话挖掘与地图配方复刻账（2026-11-20 深夜 · zcode）

> 用户令：① 千问（qoder）v7 期搞过很多训练——把相关会话提到的东西整理成单独文档（此前"qoder 0 命中"的结论**错了**：v7 期命令形态是 `EPIRUS_* 环境块 + node tools/train-3p.mjs`，不是重构后的 `node training/... --out=`，按 `--out=` 匹配的 recipe-index 全漏）；② dsh 记录同样查；③ v7 很多配方图上直接有（lineage 的 parent/seed/家族），**走现行管线 `--mode=v7` 复刻（Q-s47 先例），不拉旧 worktree**。

## 一、挖掘口径与脚本

- `scratch/mine-v7-recipes.py`（qoder projects/** + dsh sessions/**，v7 命令形态）‖ `scratch/mine-qoder-epirus.py`（qoder logs/sessions 段，EPIRUS 过滤）‖ `scratch/peek-qoder.py` / `scratch/dsh-context.py`（定点上下文）。
- qoder 的真实会话话术在 `logs/sessions/<cwd>/<uuid>/segments/*.jsonl`（99 段含 EPIRUS，10-17→11-18）；`projects/` 里 09-06/09-19/09-21 也有；**09-28~10-16 时代段已不在盘**（OVERNIGHT-2026-10-0x-qoder.md 等仓内日志是那段唯一正文）。
- dsh：`sessions/--D-code-Epirus-Web--/<uuid|session-*>/session.v4.jsonl.zstd`（27 件含 Epirus 内容，970 条命令，581 条 train-3p）。
- v7 配方形态（dsh 会话自述）：`node tools/train-3p.mjs [代=200] [人数=3] [每代局数=8] [种群=12]`，热启动 = `EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=<包>`；产物改道 = `EPIRUS_T3P_OUT`；并发批 = `EPIRUS_BAND_DIR=<目录>`（不设会撒 docs/artifacts，D191 红）。

## 二、qoder（千问）盘点：99 段 / 404 条命令 / 22 会话组

- 日期覆盖 10-17 → 11-18；`EPIRUS_TRAIN_MODE` long×9；位置参数形态 `120 3 8 8`×8 ‖ `1200 5 8 8`×6 ‖ `300 5 24 24`×5 ‖ `400 3 8 8`×5。
- SEEDPACK 家族：`g16-77001.bak`（g16→g17→g18 链）‖ `v7teach-32.bak` / `v7wall-34.bak` / `v7beadseed-82.bak`（**v7 系母本**）‖ `GD3-SWORD.bak` ‖ `js/bundled-champion-3p.js`。
- 臂名多为 smoke/仪器臂（e675- / e817smoke / e797smoke×3 / QX-XFER-SMOKE / wl-×4 / knobdark / mg2s…）——10-23 后的 qoder 以**冒烟+仪器腿**为主，正餐臂少。
- 全量命令：`scratch/v7-mined/qoder-sessions-commands.tsv`（+人读 `qoder-sessions.md`）。

## 三、dsh（DeepSeek）盘点：27 件 / 970 条命令 / 18 会话组

- `train-3p` 581 条；位置参数 `150 5 8 8`×96 ‖ `400 3 8 8`×45 ‖ `1200 3 8 8`×26 ‖ `150 5 24 8`×37。
- 命中的缺失包配方（原文出土）：
  - **B 家族批**（会话 session-7134b299，~10-01/02）：`HS="EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=docs/artifacts/eval-out/win-Lctl.bak EPIRUS_BAND_DIR=$D"`；B1=`env $HS EPIRUS_SEED=31 … EPIRUS_CONV_RATIO=1 EPIRUS_HOARD_LEFTOVER=1 node tools/train-3p.mjs 1200 3 8 8`，B2 同款 seed=71。母本 win-Lctl 在盘（wid `dfae5c38af537bb7`，≠ lineage 父 d490dc13=Ldemo——**lineage 的 parent 列与实际 SEEDPACK 有出入，复刻按会话原文走**）。
  - Lspend（`EPIRUS_CONV_RATIO=1 EPIRUS_HOARD_LEFTOVER=1 … 1200 3 8 8`）。
- 全量：`scratch/v7-mined/dsh-epirus-commands.tsv`（+`dsh-epirus.md`）。

## 四、家族账（缺失 × 图上配方可直推面）

| 家族父 wid | 代表成员 | 家族规模 | missing | 配方状态 |
|---|---|---|---|---|
| `d13d3c85`（2P 线冠军） | r61fix-31 / v11-61 | 467 | **380** | dsh/qoder 段 10-17 前无留存；RING2_HOT 通道（代码注：近期臂 hotstartFrom 全是它）——配方要靠仓内 OVERNIGHT 日志逐段翻 |
| `1d4b687d`（K2） | Q-s33~56 / T8-s110~120 / G/H-s* | 59 | 47 | §E504/§E507 批配方已知（400 3 8 8 纯续训）；Q-s33/38/51 首轮复刻**未命中**（见 §五） |
| `d490dc13`（Ldemo） | B0/B1/B2/D005/B5-05/B0L | 91 | 47 | **dsh 原文配方出土**（win-Lctl 母本+1200 代）；B1/B2 复刻在跑 |
| `e379c62c` | def-31.. | 56 | 53 | def 系 GA 臂——配方待翻 10-0x 日志 |
| `8358c7b7` | v7bead* | 32 | 21 | v7beadseed-82 在 qoder SEEDPACK 表里出现过（母本在盘？待验） |

## 五、复刻战况：**era worktree 才是逐位复刻的正解**（11-20 深夜实验定案）

**主仓 `--mode=v7` 不能用于 era 包的逐位复刻**——实验矩阵（同码同母本同参数）：

| 跑法 | Q-s47 | Q-s33 |
|---|---|---|
| 主仓 `--mode=v7`（恢复版 train-3p + 今天的主仓树） | ✗ band4=`d24ac807` ≠ 在册 `596b8fad` | ✗ band2=`e70875ad` ≠ 在册 `937d3a2d` |
| **era worktree 整树**（Temp/epirus-v7-1009 @ `15c568b2`） | （11-19 恢复即在此跑——handoff"遗留 worktree"即证据） | **✅ `937d3a2d` 逐位命中** |

- 根因：v7 训练经沙箱消费**整树 js/***（policy/evo/rules…），era 包的权重流绑在**当时的整树**上——只恢复 train-3p.mjs/server 三件不够，主仓树自 10-09 起的其它演化都进沙箱。
- 87c58dcb 的提交语（"--mode=v7 复现 Q-s47"）**只写了配方没写运行位置**——实际命中来自 Temp worktree。新训练（不需要逐位对齐历史）用 `--mode=v7` 没问题；**复刻历史包 = era worktree + wid 试金**（RECOVERY-TOOLKIT §6 原判据不变）。
- 附带：`EPIRUS_T3P_OUT` 改道被排除（两种跑法都改道）；产物落点三选一声明（exit 10）是 v1.7.114 闸，复刻跑记得带 T3P_OUT。
- band1-6 = 名人堂候选席（v1.5.150 band-save，设计上每席落盘）——守卫"自匹配 band"= 当选者恰是某席，属正常形状；产物被拒只影响落盘路径，不改判定。

| 包 | 配方 | era 树 | 结果 |
|---|---|---|---|
| **Q-s33**（seed 33，400 3 8 8，K2 母本） | ANCHOR-LOSS 反推式 | epirus-v7-1009 | **✅ `937d3a2d` 逐位命中，已落 `docs/artifacts/e507-out/Q-s33.js`** |
| Q-s38（seed 38） | 同上 | epirus-v7-1009 | （跑批中） |
| Q-s51（seed 51） | 同上 | epirus-v7-1009 | （跑批中） |
| B1（seed 31，1200 3 8 8，win-Lctl 母本+CONV_RATIO=1+HOARD_LEFTOVER=1） | **dsh 会话原文**（session-7134b299） | wt-repro-1120b @ `a793edde`（10-02 15:48） | （跑批中；主仓试跑已证未中，符合上表） |
| B2（seed 71） | dsh 原文 | wt-repro-1120b | （跑批中） |

**Q 三枚主仓未中的含义**：不是配方错，是**树错**。方法论归档：era 选取判据从"代码文件对不对"升格为"**沙箱消费的整树对不对**"（与 §二.2 代码漂移同族，但粒度是整树而非单文件）。
