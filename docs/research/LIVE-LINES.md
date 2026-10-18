# 活线登记（谁在哪条线上做什么）· 单一来源

> **为什么要这张表**：2026-10-18 午后同时存在两条研究线（千问的辅助/机理线、DS 的 `feat-ring` 加维线），
> 都在同一个 `.git` 上，于是发生了三件没人察觉的事：DS 把千问的**本地**分支并进 main 并推上远端、DS 删了三条旧分支、
> 主工作树一度停在 `feat-ring` 上（**导致任何行为读数都不可引用**——同一条分支自己就把 D161/D34 跑红了）。
> 内容都没错，错在**状态没人看得见**。这张表只干这一件事。
>
> **更新纪律（两条）**：① 每班开头把自己的行改成"活/parked/已并"，动了哪条线写清；② 改状态不必进 CHANGELOG、不必升版本（这是文档面，不是判据）。
> 时刻一律从 `date` / 产物 mtime 取，不顺着叙事估钟。

## 一、现在的线（快照：`date` = 2026-10-18 14:25:59）

| 线 | 归属 | HEAD | 动的面 | 状态 | 继续做之前的入口条件 |
|---|---|---|---|---|---|
| `main` | 公共脊柱 | `9da6f3a`（v1.7.99） | — | **活** | 主工作树 `D:/code/Epirus-Web` **常驻这里**，不许切走 |
| `research/feat-ring-2026-10-18` | DS | `4d0b68c`（落后 main 3 / 领先 2） | `js/train/policy.js` 动作段 +2 维 ‖ `VER_SHAPES` 补 v7 ‖ 两个 bundle 的 `rulesFingerprint` 重记 ‖ `unpack` **严格路径**里的旧形状旁路 | **parked（DS 自判"不能当能训用"，千问同尺复跑过 D161 与 D34 两条红）** | ① 旧包嵌入链（`shapeOf→embedLegacy→loadAny→value(sh)`）当**一笔完整改动**做完；② D34/D161 复跑绿；③ 版本改用 **v1.8.0**（`v1.7.99` 已被时机闸用掉，注释里同号是两件事）；④ 新加的旁路挪进 `allowLegacy` 分支或明写"产品也接旧形状包"这条改裁定；⑤ 知道 §E642 那条——**新两维从目标算 ⇒ 对 `target:'self'` 恒零 ⇒ 不缓解动作段混叠** |
| （无）千问这边 | 千问 | 已并 main 的两笔 §E642 | 只有 `docs/research/logs/2026-10-18-beadseed82-qoder.md` | **已并**（分支与临时工作树已于 14:2x 摘除） | — |

历史遗留的**测量用**工作树（都不是活跃研究线，也**不属于本表要管的线**，别去动它们）：
`C:/Users/14765/AppData/Local/Temp/epi-base` ‖ `…/epirus-v177-ctl` ‖ `D:/tmp-ci-repro` ‖ `D:/tmp-ci-repro-A`。

## 二、规矩（这次定下来的四条，都是踩过之后写的）

1. **主工作树永远停在 `main`；谁要做实验谁自己 `git worktree add --detach <路径> main`。**
   理由：包的"行为"取决于工作树里的 `js/**`，不取决于包本身——在带形状改动的分支上量强度/出手读数，读数是那条分支的。
2. **实验 worktree 的名字要写进本表**，并且注意脚本里的绝对 ROOT。
   ⚠ 自曝一条：摘掉 `D:/tmp-main-1018` 时，`scratch/` 里三份测量脚本的 `ROOT` 仍硬编码指向它 ⇒ **重跑 §E642 那三台之前必须先把 ROOT 改成新 worktree**，否则是 ENOENT，而不是"读数变了"。
3. **版本号只在合并那一刻写**。未并的分支不许把 `v1.7.xx` 写进代码注释（`v1.7.99` 撞号就是这么来的）。
4. **不动别人的分支与工作树**；要并别人的东西先在这里/在交接件里留一行，别从本地分支直接 merge 后推远端——今天 DS 并千问的 §E642 内容是对的，但千问事前不知道，"两个人同时改 main 的历史"必须有痕迹。

## 三、查现况的命令（别引本表的快照，它一定会过期）

```bash
git worktree list
git branch --format='%(refname:short) -> %(objectname:short)'
for b in $(git branch --format='%(refname:short)'); do echo "$b $(git rev-list --left-right --count main...$b)"; done
# CI（远端 main）：
#   gh api repos/Lion-Li-git/Epirus-Web/actions/runs?per_page=3   ‖ 或 mcp__githubdirect__actions_list
```
