# `champion-map/` —— 冠军谱系图 + 数据仓（读我）

> 目的：**找数据不用翻目录**。这个目录同时装三样东西 —— ① 谱系图页面与其源码；② 谱系/体检的**表**；③ 把表补齐的脚本。
> 规矩：`_` 开头的都是临时产物（`.gitignore` 已挡），**别把它们当数据源**；入库的表一律是 `名字.tsv`。

## 一、我要找什么 → 看哪个文件

| 我想知道 | 看这个 | 说明 |
|---|---|---|
| **池里现在有哪些冠军** | `pool-members.tsv` | 列：`id wid path tier invited promoteVerdict seatKill addedAt note`。`tier` 只有 **hard / soft** 两档（§E596 起三带，池里实际两档） |
| **某枚包的送盾体检** | `holo.tsv` | 列：`id ok H rank holoPerGame holoOther giftShare overCap` ‖ **`holoOtherPrior2` = 开档 2 的口径**（页面默认，`promscan` 优先用它） |
| **某枚包能不能上槽** | `promote.tsv` | `--run-promote` 的落盘结果（`pass` / `block` + 原因） |
| **某个包打起来是什么风格** | `e588-usage-*.tsv` | **每局出手次数**：`snipe defense defenseShare holo guard reflect bigT miniT gun railgun charge ring ji atkShare rounds`；四张 = `multi/long` × `ε=0/0.2` |
| **攒 ep 的时机**（环/ジ 在什么局面用） | `usage-buckets-2026-10-20.tsv` | 按安全阶梯分三桶：`L3`=hp 最高且无人 ep≥3 ‖ `L2`=hp>1 且无人 ep≥3 ‖ `L1`=其余；每桶给环/ジ 占比。由 `behavior-profile --buckets=1` 生成 |
| **考卷/尺的读数** | `eNNN-epsfull.tsv`、`eNNN-ruler*.tsv` | 按实验编号命名，**编号 = 研究日志里的 §E 编号** |
| **对打结果** | `duel*.tsv` | `duel-run.mjs` 产出 |
| **谱系图上的坐标与各列** | `coords.tsv` | 803 行级别的宽表（含 `Hp/Hplong` 等）；**由九步链生成，别手改** |
| **重复包清单** | `dupes-manifest.tsv` | 与 `tools/dedupe-artifacts.mjs` 配套 |
| **别名** | `coords-aliases.tsv` | 同一枚包的多个文件名 → 一个 `id` |

## 二、页面（产物，不许手改）

- `index.html` —— 谱系图页面，**是产物**：改 `viewer.mjs` 后必须 `node champion-map/viewer.mjs` 重烘。
- `viewer.mjs` —— 页面源码（内含自检；`node champion-map/lint-viewer.mjs` 先绿再烘）。
- `rebuild-coords.mjs` —— **九步链**：把所有 `attach-*.mjs` 串起来重建 `coords.tsv`（漏一步就丢列，v1.7.97 那次的 `Hlong` 就是这么丢的）。

## 三、`attach-*.mjs`：每列一个脚本

| 脚本 | 补什么 |
|---|---|
| `attach-hp.mjs` | `Hp`（页面口径的夺冠率） |
| `attach-hlong.mjs` | `Hlong/Hplong/Flong/okLong/failsLong`（长程考卷） |
| `attach-sc.mjs` | `sc`（当选面打分） |
| `attach-kin.mjs` | 亲缘/父子边 |
| `attach-path.mjs` | 谱系路径 |
| `attach-dup.mjs` | 重复标记 |

## 四、命名约定

- **`_xxx.tsv` = 临时/中间产物**，gitignore 挡着，**不是数据源**（例：`_e1-arms.tsv`、`_pf-K2.tsv`）。
- **`eNNN-*.tsv` = 研究日志 §ENNN 那一段的落盘**（`docs/research/logs/` 里能按编号查到来龙去脉）。
- **`*-2026-MM-DD.tsv`** 带日期的 = 某一天的快照，**会被更新**，引用前先看 mtime。

## 五、三条使用纪律（踩过的坑）

1. **`coords.tsv` 不手改**：它由九步链生成；手改会在下次重建时被覆盖，而且会让页面显示与表不一致。
2. **`index.html` 不手改**：它是产物，改源码再重烘。
3. **口径要写清**：同一枚包在 `holo.tsv` 有两个送盾数（裸包 `holoOther` 与开档 `holoOtherPrior2`），**报告里引哪个要写明**。

## 六、常用命令

```bash
node champion-map/rebuild-coords.mjs          # 重建 coords.tsv（九步链）
node champion-map/attach-hlong.mjs --check    # 检查长程列在不在
node champion-map/viewer.mjs                  # 重烘 index.html
node tools/promote-champion.mjs <pack> --dry  # 单枚上槽体检（≈2.5 分钟）
node tools/probe-pool.mjs --subject=<pack>    # 池尺对打（默认 support=2）
node tools/behavior-profile.mjs --champion=<pack> --buckets=1   # 行为画像 + 攒 ep 时机分桶
```

> 数据在哪：**产物本体在 `docs/artifacts/`**（多数被 `.gitignore` 挡，只在本机）；这个目录只放**表与页面**。
