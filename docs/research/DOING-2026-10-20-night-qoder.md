# DOING · 10-20 夜 → 10-21 早 09:00（千问 · 分支 `research/prior-style-2026-10-20-qoder` ‖ 工作树 `D:/wt-qoder-1020` ‖ 起点 main `537f050`）

> 防失忆用。**时刻只从 `date` / 日志收尾行 / 文件 mtime 抄**（下面每条后面那个钟都是当场抄的，不是顺着叙事估的）。
> 授权来源：用户 23:37 前「开新分支做到明天早上九点，按你自己的计划来做」+ 研究问题「不送盾的冠军资源变多了，没准能整出新的风格」。

## 一、DONE

| 时刻 | 做了什么 | 落点 |
|---|---|---|
| 23:37:31 | 建分支工作树（起点 = main 的 `537f050`，本地 main 与 origin 同点） | `git worktree list` |
| 23:41:00 | **预注册先于任何臂**提交（`3fa5494`）：主判据=剖面位移不是总分；起点 5 枚全是"真会送盾"的；两臂只差 `EPIRUS_SUPPORT_PRIOR`；multi/long 两档都报；≥3 起点同号且 0 反号才许写"稳定方向" | `docs/research/PREREG-2026-10-20-prior-style-qoder.md` |
| 23:41 | 起点名单从 `coords.tsv` 现算（`holo≥2.5/局` 且 `Geff≥3` ⇒ 全库 47 枚，取 5 枚跨强度/家族），**wid 已登记**（因为 4 枚起点是 gitignore 里的本机 `.bak`，不落 wid 明天就腐化） | `docs/research/archive/2026-10-20-prior-style/origins.tsv` |
| 23:43:52 / 23:43:54 | 第一对臂（`v7teach-32` × p0/p2）收摊 `EXIT=0` ⇒ **单价实测 ≈ 2.5–3 分钟/臂**（2 路并发） | `docs/artifacts/e675-out/teach-p{0,2}.log` |
| 23:44–23:45 | 剩下 4 个起点 × 2 臂 = 8 臂发出（4 路并发，同 seed 88010，`coldStart=false`） | `docs/artifacts/e675-out/` |
| 23:46 | 自证①过：两臂启动头逐字对照，**只差 `送盾先验 = 0 / 2` 那一行**（人数/代/种群/每代局数/池席/落点全同） | 同上两份 log 的第 1/2/5/36 行 |
| 23:47 | R1 做完：DS 的 sp20 A/B 补尺子名 + 只读副本 + 分析器，复算出他印的 multi 那档**一位不差**，并把他没印的 long 档一起吐出来 | `docs/research/archive/2026-10-20-support-prior-ab/`（README + `sp20-paired.mjs` + `sp20-paired.tsv` + `sp20-pooltxt/` × 20） |
| 23:48:21 | bead15 / beadseed 两对收摊（通知 exit 0） | `docs/artifacts/e675-out/*.log` |

## 二、第一对臂看到的信号（**单起点单 seed，不作结论，只是决定后面怎么读**）

用**既有尺** `tools/champ-audit.mjs --games=60`（条款见 `tools/audit-lib.mjs` 顶部：C 盾/局 = 全息屏障**施放**总数、5 座同一冠军；G 有效技能数 = 非ジ出手 `exp(熵)`，样本敏感 ⇒ n≥20 才许当门槛）。
两臂都用**先验关着**量（体检不 set 那个 knob ⇒ 差别纯粹是"被训成了什么"）：

| 臂 | A 考卷1st | B 伤害/局 | C 盾/局 | 回合 | G 有效技能数 |
|---|---|---|---|---|---|
| `teach-p0` | 18% | 14.2 | **0.0** | 40.4 | **3.59（11 种）** |
| `teach-p2` | 12% | 15.0 | **112.8** | 47.0 | **1.17（5 种）** |

⇒ 与"开先验就少送盾"的直觉**反向**：训练时开档 2 学出来的包，在关档体检下**施盾暴涨、广度塌到入场线（Geff≥3）以下、局长拉长**。
机理候选（**未测，别当结论**）：档 2 把"挑不到好对象就改攒"变成合法动作 ⇒ 攒盾不再被浪费惩罚 ⇒ 策略学到"无差别囤/施"，而不是"省下盾去打别的"。
**这条如果要在 5 个起点上都成立，才许写"稳定的资源转移方向"；只要出现一个反号，就降级成"判不动"。**

## 三、接下来（按顺序，做完一条勾一条）

1. 等 wall34 / lctl 两对收摊 ⇒ 对 10 份产物跑同一把尺：`champ-audit`（multi + long 两档）+ `behavior-profile`（defShare/atkShare/ringShare/jiShare/focusRate/voidShare）+ `probe-pool --subject`（multi + long，强度当**闸**不当目标）。
2. **自证④**：挑 1 臂同 seed 重跑 ⇒ 权重逐位相同（不同 ⇒ 整批配对降级为"量级看"）。
3. 出配对表 + 判定（按预注册那条口径），写进日志 **§E675** 与 `docs/research/archive/2026-10-20-prior-style/`（脚本 + 原始读数进仓，复跑不覆盖原件）。
4. R2/R4：三处过期文字 + 销 #49/#50 双头账（改注释不改判据；动 `champion-map/viewer.mjs` 的模板注释**不许出现反引号**，改完必须重烘 + `--part=ship-pool`）。
5. R3：两条待补的牙**只写方案**（`BAND_DL` 上界、train-3p 先验默认档/四道 exit 7 闸），等她裁，不实现。
6. 早上交班：`HANDOFF-2026-10-21-morning-qoder.md`（只给命令不给裸数字的部分：HEAD、CI run、`git status`）。
7. 收尾只跑改动面门禁：`--part=meta-repo` ‖ `--part=meta-lint`（引用带"不是整轮认证"）。

## 四、边界（整晚有效）

不 promote、不动线上两颗冠军槽、不碰 `js/core/**`、不新增门或腿、不开 PR、不代 DS 提交他的文件、**不推 main**（分支可以推）、不跑整轮、不把两批不同档的训练臂并排比、不并发跑两台尺。
起点与产物都落在 gitignore 的 `docs/artifacts/e675-out/` ⇒ **wid 必须进 manifest**，否则明早读数查不到原件。
