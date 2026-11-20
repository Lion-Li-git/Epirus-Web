# COMMAND CHECKUP · 2026-11-20 深夜 · 出土训练命令今天能不能照抄（Qoder）

> 用户令：既然找到了真训练命令，就顺带看命令**之前**的会话内容有没有讲"这条是怎么设的"；做完体检落文档并修两个小问题。
> 一句话结论：**对恢复有用的老命令，今天一条都不能原样照抄**；最大障碍不是旗标，是**入口搬家**（一半只需改路径）。
> 机器可读原件：[session-records-2026-11-20/qoder-command-checkup.tsv](session-records-2026-11-20/qoder-command-checkup.tsv)（547 行）。

## 一、复现（全部在册，干净克隆可跑）

```bash
node tools/command-checkup.mjs        # 读两张在册命令表 → scratch/command-checkup/command-checkup.tsv
node tools/session-mine.mjs --harness=qoder --pattern="train-3p.mjs"   # 两层挖：遥测 77 + transcript 101 = 178 条
```

判据不手抄：暗键/死键来自生产 `training/server/knob-guard.mjs` 的 `detectDarkKnobs`，
`SELF_ENV_KEYS` 从 `training/train-3p.mjs` 源码**机械提取**（146 枚，该数组没 export），
`REMOVED_TRAIN_KEYS` 直接 import。脚本自带**进出对账**（读入行数 ≠ 出表行数就打印差值）。

## 二、判定矩阵（547 条出土命令）

| 判定 | 遥测 404 | transcript 143 | 合计 | 含义 |
|---|---:|---:|---:|---|
| NOT-TRAINER | 168 | 0 | **168** | 是 `eval-5p.mjs` 等评估器，不该进体检 |
| UNREADABLE-FRAGMENT | 40 | 35 | **75** | 会话/遥测里被切断的片段（`\| grep -E` 尾、`"$S/…"` 变量展开） |
| COPY-NEEDS-PATH-FIX | 138 | 46 | **184** | 只欠一个路径名：`tools/train-3p.mjs` → `training/train-3p.mjs` |
| COPY-FAIL-ENTRY-GONE | 28 | 37 | **65** | 入口整体不在了（`train-best`、旧 `pg-train` 路径） |
| COPY-FAIL-DARK-KEYS | 7 | 7 | **14** | 撞今天入口读不到的旋钮 ⇒ 会被 `exit 6` 拦 |
| COPY-FAIL-DEAD-KEY | 0 | 6 | **6** | 命中已删键（`EPIRUS_PASSIVE_FIELD`） |
| NEED-PREREQ | 5 | 4 | **9** | 命令完整但 `SEEDPACK` 母本已不在盘 ⇒ 要先复刻上游 |
| COPY-OK | 11 | 4 | **15** | 真能原样跑 |

按月只看训练器命令（368 条）：**9 月 46 条 + 10 月 158 条，可直接照抄 0 条**；11 月那 15 条逐条查过，
全部是 Qoder 自己 11-15/11-20 的 `QX-XFER` 冒烟臂（新入口、产物落 scratch、从未进 registry）。

## 三、四条判语

1. **照抄这条路对恢复不通**，但最便宜的一刀很机械：184 条（训练器命令的一半）只需改路径。
2. **暗键≠命令坏了，是时代错了。** 撞到的键高度集中在 v7 奖励族：
   `BEAD_BOOM_W`(6) ‖ `PASSIVE_FIELD`(6) ‖ `VOID_W`(4) ‖ `BEAD_SEED` ‖ `BIGT_CHAIN_W` ‖ `VOID_IDEAL_W` ‖ `FIT_G_W` ‖ `COSTLY_W` ‖ `WIDTH_W`
   ——都是 `01123abe`（"旋钮 194→65"）砍掉的那批。⇒ **不许为了跑通而把键名改成今天的样子**；正解仍是 era worktree
   （与 [V7-ERA-SESSION-MINING-2026-11-20.md](V7-ERA-SESSION-MINING-2026-11-20.md) §五独立吻合，本文补上它的一个前置原因）。
3. **`EPIRUS_PASSIVE_FIELD` 是双重无效**：`training/server/train-env.mjs:26` 记它 v1.5.163 整族删除且"注入从未开火"
   ⇒ 带它的 6 条命令里那面旗**当年就是噪音**，复刻时应删掉而非想办法让它生效。
4. **9 条 NEED-PREREQ 是依赖链情报**：母本随事故消失，必须排进"先复刻父件"的队列，否则跑一次红一次。

## 四、命令的"设定说明"在哪个层（这决定下一班去哪儿找）

- `logs/sessions/…/segments/*.jsonl` ＝ **生命周期遥测**：每行 keys 只有 `ts/seq/level/type/data`，
  实测前 40 个文件 1074 行里 **0 行含 text/thinking/content** ⇒ 能捞命令，**捞不到前文**。
- `projects/<工作区>/<uuid>.jsonl` ＝ **完整 transcript** ⇒ 话术在这层（本晚从这里挖出 143 条真训练命令 + 其前文）。
- ⚠ 两层目录名都是**工作区**路径转义，与被操作仓库无关：本仓会话散在 `C--Users-14765-Documents-Qoder-*` 几十个目录里，
  **按仓库名去找必然找不到**——"千问从未在本仓跑过训练"那句错定性就是这么来的（已在 `session-mine.mjs` 头注改正）。
- 人核过的"设定说明"样例（09-26 那批 `v7xn*` 臂的前文）：
  `train-3p env 面闭集 + 不 import econ/fight-env ⇒ server-only 旋钮在 CLI 一律默认（xn10c 活例）`
  ——这句话**本身已过期**（今天 `train-3p` 已 import `econ-env`/`train-env`/`knob-guard` 并接上 `enforceKnobs` 响亮 `exit 6`），
  但它的存在说明：**跑之前的预注册里确实写了旗标理由**，只是只覆盖 Qoder 自己的臂，覆盖不到那 505 枚。
- 数据边界：`projects` 层 **09-28～10-16 段已不在盘**，而那正是缺件主力时段 ⇒ 那批件的"为什么"在 Qoder 侧不可得（不是没找）。

## 五、本笔修的两处

1. **`tools/session-mine.mjs --harness=qoder`**：原来只读遥测层（注释还写着"尚未有命中案例，先探路"）。
   改成两层都挖并**分层打点**（实测 178 条 = 遥测 77 + transcript 101），头注写清两层性质与工作区命名陷阱。
2. **`training/knobs.mjs` + 重生成 `TRAINING-KNOBS.md`**：册子上那段"生成器 `tools/knob-registry.mjs`（`--check` 供 CI 防腐烂）
   ‖ 注解在 `tools/train-3p.mjs`"是**手写在生成物上的**，且那个生成器文件名从未入库（git 史查不到）、路径也都过期。
   危害有两层：① 误导读者去找不存在的工具；② 生成器是整文件 `writeFileSync`，任何人一跑重生成就把这段说明抹掉。
   修法：把说明**搬进生成器**并改正路径（`training/knobs.mjs` / `training/server/knob-guard.mjs` / `training/train-3p.mjs`），
   同时在头注里写明 **`--check` 只核数据账三个数、不核头注** ⇒ 别把手写说明加在册子上。

## 六、等裁的一处矛盾（不自决）

重生成后册子的"暗键（删除候选）"清单里包含 `EPIRUS_SEL_CARDS` / `EPIRUS_SEL_DEFQ` / `EPIRUS_ARCH2` /
`EPIRUS_SEEDPACK` / `EPIRUS_T3P_OUT` 等 **146 枚**——依据是"v7 线 train-3p 已删除"。
但 `training/train-3p.mjs` **今天在盘上且真读这些键**（`readKeysOf({entry:'training/train-3p.mjs'})` 给 147 枚读集，
本晚的体检就是用它当入口）。⇒ 同一批键两把尺判词相反：册子说"删除候选"，knob-guard 说"在用"。
**影响恢复**：谁按册子去删键，就会删掉 era 复刻正需要的东西。改哪一边属判据调整，等裁。

## 七、读取端陷阱（给所有班次）

python 的 `csv` 默认把 `"` 当引号符，而命令里满是 `EPIRUS_T3P_OUT="$S/on.js"`
⇒ 本晚我第一版读数因此**静默少 66 行（12%）**，还差点把"出表 481"当成结论。
读命令表一律 `quotechar='\x00'`（或 pandas `quoting=csv.QUOTE_NONE`）。
ZCode 那三张表（404 / 970 / 358）实测行数都干净，但那是因为他们整理时剔过含反引号/占位符的行——
**被剔掉的正是本文判为 `UNREADABLE-FRAGMENT` 的那 75 条**，两把尺在这里对得上。

## 八、本晚作废的读数（留痕，别被旧对话引用）

- "50 枚缺件有命令可用" → 同行匹配造成（jsonl 一行可含整段 compaction 摘要，**同行≠同一件事**），严格化后是 3 枚，再人核后 **0 枚**。
- "COPY-OK 171 条" → 未剔评估器与残缺片段 + csv 吞行；现为 **15 条**。
- "出表 481" → 读法错误，实际 547。
- 抢救出的 3 枚完整权重（`d490dc136293cfc4` Ldemo 族 ‖ `ac6b53757ec279c3` SHIPPED-2P ‖ `24d8fa30bb0c3414` **T8-s114**）
  **都在盘上、台账 state=ok** ⇒ 权重正文残留这条思路成立，但救不到缺件（我只在会话里读过当时还活着的件）。
