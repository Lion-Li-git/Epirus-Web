# 本轮原始证据归仓 · 2026-10-18（§E642~§E645：`v7beadseed-82` 送盾机理 + 选拔带宽）

研究日志：[../../logs/2026-10-18-beadseed82-qoder.md](../../logs/2026-10-18-beadseed82-qoder.md)（文中把本目录写作 **`归档/`**）。
本目录存在的唯一理由：这些数原先只有**结论表**在 git 里，**产出它们的脚本和原始日志在会话临时工作区**（`…/Documents/Qoder/2026-10-17/5218a833/scratch/`），
而文中引用写的是 `scratch/*.log` —— 干净克隆里既没有那个路径也没有那批脚本，等于"证据只活在本机"（`tools/evidence-rot.mjs` 那条线管的就是这件事，这次轮到自己）。

## 一、清单 → 对应哪一格

| 文件 | 产出的读数 |
|---|---|
| `tools/guard-the-charger.mjs`（在 `tools/`，可复用） | §E643 二 成对臂表（`asis/churn/churnSham/weak/rand`）‖ §E644 一（600 局复量）‖ §E644 二（`weakchurn`/`churnnoweak` 成分分解）‖ §E644 三（被护者长招落点） |
| `tools/reachability.mjs`（同上） | §E643 一 可达性表的三层分母（`W_all`/`W_proto`/`W_ge3`） |
| `tools/proto-window-control.mjs`（同上） | §E643 一 的**正对照**（构造 k=1..4 发可挡伤害打同一持原型制御席）⇒ 这台不过，后面所有"≥3 从没发生"都不许引用 |
| `gtc-batch.sh` / `gtc2-batch.sh` / `gtc3-batch.sh` / `gtc4-batch.sh` | 上面那台的 150 / 300 / 600 / 400 局四批驱动；产出 = `gtc.log.txt`、`gtc2.data.log.txt`+`gtc2.tail.log.txt`、`gtc3.log.txt`、`gtc4.log.txt` |
| `reachability-batch.sh` + `reachability.log.txt` | 六张桌形 × 150 局的可达性批 |
| `bs82-what-gifts-buy.mjs` + `bs82-gifts.txt` | §E642/§E643 的送盾逐手普查（mirror 桌 5×同包，300 局，seed0=90210） |
| `bs82-why-holo-not-proto.mjs` | §E642 的表示层分解（同价同优先的两张盾里为什么稳定选送盾） |
| `bs82-ban.sh` + `bs82-ban.log.txt` + `bs82-as-is.txt` | §E642 的配对消融（`--ban=holo` / `--ban=ji`，3 seed × 200 局）与考卷 as-is 全量输出 |
| `selband/analyze.mjs` + `selband/run.log.txt` + `selband/pool.tsv` + `selband/timing.tsv`/`timing.out.txt` | §E645 的 k 表与选拔噪声分析；**矩阵本体在 `champion-map/selband-2026-10-18.tsv`**（`matrix.tsv` 与它逐字节同数据、只差头 5 行注释 ⇒ 没另存副本） |

⚑ **为什么证据叫 `*.log.txt` 而不是 `*.log`**：`.gitignore` 第 2 行就是 `*.log`（仓里从来没有一条 `.log` 被跟踪，这不是遗漏），而这些日志**不是可重跑的**（每份是十几分钟的真对局）⇒ 与"日志皆可重生所以忽略"的前提相反。这里选**改后缀进仓**而不是 `git add -f` 顶穿忽略规则，跟的是本仓已有惯例（`bs82-as-is.txt`/`bs82-gifts.txt` 就是同类"日志当正文进仓"）。要改成别的做法，得先回答"忽略规则保护的到底是什么"。

## 二、归仓时对脚本做的四类改动（都不是"顺手重构"，每一条都对应一个复算障碍）

1. **写死的机器路径 → 自解析 ROOT**：`guard-the-charger.mjs`/`reachability.mjs` 原来第一行就是 `const ROOT = 'D:/wt-qoder-1018'`，`bs82-*` 是 `D:/tmp-main-1018`，`selband/analyze.mjs` 默认读会话 scratch 的 `matrix.tsv` ⇒ 现在一律按脚本自身位置解析仓根，`WT=<路径>` 可覆盖到别的工作树。
2. **`.sh` 驱动里的 `cd` 与日志路径**：改成 `HERE/REPO` 自解析；复跑默认写 `*.rerun.log`，**不覆盖本目录里进仓的原始日志**。
3. **`2>&1` 收回引号外**：`gtc2-batch.sh` 旧写法是 `>> "$LOG 2>&1"` ⇒ bash 把 `2>&1` 当成文件名的一部分，真数据落在字面叫 `gtc2.log 2>&1` 的文件里、`$LOG` 只剩收尾行（进仓时两份都留：`gtc2.data.log.txt` = 真数据、`gtc2.tail.log.txt` = 只剩收尾行的那份）。
4. **`analyze.mjs` 两处判据级修改**（17:1x 复算时暴露）：
   - 删掉"组合数 >500 就抽 500 次、**无种子**"的退化分支 ⇒ 全枚举（最多 C(12,6)=924 个子集，几万次加法）。这一条直接改变了 §E645 的引用值：k=6 一致率 87.8% → **85.8%**。
   - "均值榜极差"改成在同一批枚举子集上**精确**算并加列（旧文档那一列出自一段没落盘的 400 次 MC 内联脚本）‖ 加了分母守卫：候选 0 枚或 seedBase <2 粒 ⇒ `⛔ 读不出`、exit 3（实测会把空表算成"1 粒 seedBase、NaN…NaN"静默往下走）。

## 三、复算入口（都在仓根跑；时长是本机 `date`/`time` 实测）

```bash
node tools/proto-window-control.mjs                                    # 正对照，0.14 s，4 格全 ✔
node tools/guard-the-charger.mjs --arm=churn --games=20 --seats="aggro,gunspam,focusfire,deepsaver"   # 冒烟 0.18 s（20 局只看能不能跑，不是读数）
node docs/research/archive/2026-10-18-guard-the-charger/selband/analyze.mjs   # k 表，只喂进仓那份 TSV；连跑两次逐字相同
bash docs/research/archive/2026-10-18-guard-the-charger/gtc2-batch.sh        # 真要复跑成对臂：3 臂 × 2 桌 × 300 局，先估时再发
```

## 四、边界（引用前先读）

- 本目录里 `.log`/`.txt` 的 **mtime 全是复制时刻（10-18 17:03）**，不是产出时刻；当场时刻只存在于研究日志正文与 `*.wrap.log` 里 ⇒ 别拿这里的 mtime 去复核时间线。
- 测量是在 `D:/wt-qoder-1018`（main 的 detached worktree）上做的，行为读数的并排引用规矩见 [../../LIVE-LINES.md](../../LIVE-LINES.md) 规矩④。
- `churn/churnSham/weakchurn/churnnoweak` 全是**脚本化挑人的可行性上界**，不是"训练学到了"（主语规矩，用户 10-17）。
- **被测包**：`reachability.mjs` 有 `--pack=`（缺省 `docs/artifacts/v7beadseed-82.bak`），而 **`guard-the-charger.mjs` 的包是写死在源码里的**（第 27 行 `loadChamp(..., 'docs/artifacts/v7beadseed-82.bak', ...)`，没有旗标）⇒ 想用成对臂量别的包，得先给它补 `--pack=`，别以为是旗标没生效。
- 两台的**桌形都是人造的**（5 席全脚本 / 1 网 + 4 指名脚本），比真池桌更容易长出长招 ⇒ §E644 六那条"不许当产品桌面预期收益"仍然生效。
