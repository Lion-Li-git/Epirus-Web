# 交班 · 10-19 下午（DS → 千问）

> 交接时刻 13:5x（`Get-Date` 实测）。起因：用户 13:5x 说「停下来，马上两点了，收拾好交给千问」。
> **主工作树在 `main`，工作区干净，HEAD = `0b46840`（v1.7.114）**。没有任何未提交/未推的东西。

## 一、这一班 DS 干了四件

| # | 事 | 状态 |
|---|---|---|
| 1 | **合并夜班 `qoder-1018-night2`**（60 笔，`--no-ff`）成 v1.7.113；CHANGELOG 记夜班四件事；版本三处 + `index.html` `?v=` 刷到 `mv9mdgp6` | ✅ 已推 |
| 2 | **合并后跑整轮**：16/16 部分 · **278/278**；唯一红是 `train-evo` D162 = **并发假红**（单独复跑 224.5s 绿） | ✅ |
| 3 | **并发假红第二次的真凶**：`tools/gates/train-env.mjs:64/:76` 两条一代迷你臂**设了 BAND_DIR 但没设 T3P_OUT** ⇒ 写 `docs/artifacts/train-3p-out.js`（= D123/D162 的基线）。已修 + 验证（`--part=train-env,train-evo` 并发 **4/4 + 65/65 全绿**） | ✅ 已推 v1.7.114 |
| 4 | 新增 **`EPIRUS_LOG_DEFAULT_OUT=1`** 点名器（`tools/train-3p.mjs`）：没改道又真要写默认落点时打 `[WRITE-DEFAULT] <arm> ‖ argv=…` | ✅ 已推 |

## 二、**在飞 / 未验证**（下一班请先看这节）

### 2.1 整轮带点名器的跑被我掐了 ⇒ "还有谁在写默认落点"未知

用户叫停时，`EPIRUS_LOG_DEFAULT_OUT=1 node tools/gate-par.mjs` 正在跑（job `pwsh-f9b64e3acef94970`，已 kill）。
**所以只修了已知的那两条腿，其余写方还没点名出来。** 复现命令：

```
$env:EPIRUS_LOG_DEFAULT_OUT=1; node tools/gate-par.mjs 2>&1 | Select-String "WRITE-DEFAULT"
```

把输出里每个 `[WRITE-DEFAULT]` 的 arm 名对回它所在的门腿，逐条补 `EPIRUS_T3P_OUT` 改道。

### 2.2 我造的产物，可能触发 D191④

`docs/artifacts/train-3p-out-band1.bak` / `band2.bak`（13:56）是我手跑训练时写的（**未跟踪、gitignore**）。
`band3~6` 是 10-15 的旧文件。**这两份新的可能在 D191④「未登记重复」里红** —— 我没验。检查：`node tools/np-test.mjs --only=D191`。

### 2.3 `docs/artifacts/train-3p-out.js` 已被重生成（**这是正常的**）

现在整文件 sha1 前缀 `5e6614ea`，而 D123 登记的 `CLI_ARM_BASELINE` 是 `aa743488cc` —— **不矛盾**：
D123 比的是 `wh()` 取的 **`"a":[…]` 子串哈希**，不是整文件；且它的第 1 腿本来就会用登记配方重生成这个文件。
`--only=D123` 实测 **1/1 绿**（已自愈）。

## 三、今天新踩的三个坑（都写进 CHANGELOG v1.7.114 了）

1. **`EPIRUS_T3P_OUT` 不只是「落点」**：`train-3p` 还拿它判**发布态**。我在 `gate-par` 里做「全局改道」⇒ `ship-feas` 的 D124/D125 **真红**（3P 栏被跳过）。已撤回 + 原地记坑。**正解只能逐条改道。**
2. **跟着红点清是错的方法**：v1.7.64/65 我只改了已红过的腿，`train-env` 那两条从没红过 ⇒ 一直漏。**要么全量列写方，要么用点名器。**
3. **手跑训练必须设 `EPIRUS_T3P_OUT`**：`train-3p-out.js` 不归 git 管（gitignore），写坏了没有 checkout 可退（这次靠 D123 自愈）。

## 四、DS 侧还没做的（都在 `NEXT-2026-10-19-after-merge-ds.md`）

- **B 组（等用户裁的 5 条）**：选拔带宽 3.0 vs p90 5.4 ‖ `chanceAlly` 恒 0（删还是接）‖ `HOLO_GIFT_MAX` 要不要按页面剂量重定 ‖ `SUPPORT_PRIOR` 无门覆盖（9 腿只在手跑）‖ `bandFor` 回落要不要抛。
- **C 组（我能直接开工的）**：**C1 选择键的落差读数**（§E650 已把问题定位到「产出在变干净、当选位仍最凶」）‖ C2 把 9 腿接成门 ‖ C3 门禁 ② 那 125 条分诊 ‖ C4 候选分布写进落盘回执。

## 五、给千问的三条检查（按顺序，都是快命令）

```
node tools/np-test.mjs --only=D191                              # 2.2 的产物卫生
$env:EPIRUS_LOG_DEFAULT_OUT=1; node tools/gate-par.mjs           # 2.1 点名剩余写方（≈5-17 分钟）
node tools/np-test.mjs --only=D8                                # 版本三处（应为 11/11）
```
