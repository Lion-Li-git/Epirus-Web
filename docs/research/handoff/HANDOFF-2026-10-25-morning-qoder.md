# 交班 · 2026-10-25 早（千问夜班 → 白班/用户）

> 夜班授权：用户 2026-10-24 夜「都可以做……你直接做到明天早上九点中间不用停下来问我」＋加一条研究题：「如果贴贴开了有代价你可以考虑调整贴贴注入的权重，研究一下是否存在能促使场上出现贴贴但几乎没有代价的情况」。
> 干活的地方：**分支 `research/night-2026-10-24-qoder`，工作树 `D:/wt-qoder-1024-night`**（主工作树常驻 main）。
> 查现况（别引本文件的快照，它一定会过期）：`git -C D:/wt-qoder-1024-night log --oneline -8` ‖ `git -C D:/wt-qoder-1024-night status -sb` ‖ `git worktree list`。

## 一、已做完并验过的

1. **B5 仓库卫生**：main 已推（`b0903f73..3d40b47f`）；删了 9 条本地 + 10 条远端**已并分支**。
   判据不是"git 你抱怨我就强删"：每条都算过 `rev-list --left-right --count main...b` = `N 0`（无独有提交），被 `-d` 拒的那条用 `merge-base --is-ancestor` 证实是本地比**自己的上游**多 1 粒、而该粒已在 main ⇒ 才 `-D`。
   留下没动：`research/prior-style-2026-10-20-qoder`（`D:/wt-qoder-1020` 还占着它）‖ 7 棵 detached 测量树（LIVE-LINES 明写别动）。
2. **#55 `FIT_G_W` 方向腿进 D15**（门数 280 不变，只加腿、不抄第二份）。两次变异各咬一条，实测原文在夜班日志 §E727。
   最值钱的一条反证：**同一变异下旧恒等式门 D13 仍 1/1 绿** ⇒ 这就是那个符号病能活 14 天的机制，也是这条腿的存在理由。

## 二、等白天点的（夜班不自决）

- **并 main + 推**：分支上的东西要不要并，等点名（规矩 4）。研究分支本班已推。
- **贴贴两档要不要改出厂默认**（`LOCK_NARROW`/`CURSE_PUSH`）：等 A2 的强度配对数出来才好裁 ⇒ 数与判读在日志 §E728+。
- **冠军池加人**：用户说"新冠军如果练出来很好也可以进"——本班**只准备了判据与候选**，没有自决改 `pool-members.tsv`；真要动，走"表 + bundle 重烘 + D234 + 干净克隆复算"那一条完整链，别只手改表。

## 三、下一班想接着做时的入口

```bash
# 门禁（按改动面，别整轮）
node tools/np-test.mjs --part=train-evo        # 方向腿所在那段
node tools/np-test.mjs --group=meta            # 16 条，秒级
# 贴贴两档的机制尺（不练、只读）
node tools/probe-sticker-injection.mjs         # 用法见文件头
# G4 单格 vs 八格（贵尺 ≈100 秒/枚，便宜尺 4 秒/枚）
node tools/probe-g4-anatomy.mjs 60 <包...>
node tools/gate-drafts.mjs <包...>
# 全库扫描表 → 复算入口（path 列已补）
awk -F'\t' 'NR>1{print $NF}' champion-map/g4scan-2026-10-24.tsv | head
```

## 四、今晚的纪律提醒（写给下一个我）

- 实验产物/band 一律落**仓库外**（`Documents/Qoder/.../scratch/night/`），不然撞 D191；改正在跑的脚本 = 两实例抢一个日志，先判活再动。
- 跑生成器**不许过滤输出**（吞掉 SyntaxError 就会把判据跑在旧产物上）。
- 带时刻的写入先 `date` 或从产物 mtime 取；引时长只引同一台机器同一状态下的数。
