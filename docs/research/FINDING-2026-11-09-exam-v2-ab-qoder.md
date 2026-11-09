# 考卷 v2 的两件后续：池版本戳 + 换席的配对 A/B（Qoder · 11-09 晚 · 用户令「那你这两个都做吧」）

> 主语是 DS 的 `RESULTS-2026-11-08-2p0-strength-vs-gate-ds.md` §十三.17–19（那三节的取证我复核过，成立）。
> 本文只做两件事：**把被改掉的参照系钉回去**，和**把"换席到底有没有用"配对量出来**。没有重复审 DS，也没有动 DS 正在编辑的那份文档。

## 一、结论先说

- 换席**确实压低了分数**：逐臂配对差（v2−v1，5 个 seed）G5C −5.4pt ‖ G5I −5.0 ‖ G5J −4.9 ‖ G5F −2.1 ‖ WSEL9 −0.6（前四枚 5/5 同号，WSEL9 3/5）。
- 换席**确实压缩了分辨力**：同一 seed 同一池的 max−min 差距，v1 均值 19.4pt → v2 均值 15.2pt；配对变化 **−4.2pt，5/5 同向，t=−5.1** ⇒ 压缩是真的，不是噪声。
- 但换席**没有换排序**：G5J > G5C 在五枚 × 五 seed 里从未动摇，Spearman ρ=1.00/0.70/0.90/0.90/1.00，所有换位都发生在第 3–5 名的相邻交换（G5I/G5F/WSEL9 互相错位）。
- ⇒ "效果不好"的准确说法是：**它移动了刻度，没有移动方向**。这与上一轮的分析一致——被刷爆的性质来自记分（`rankOf` 第一名率奖励活到最后）与表征（同时出招 ⇒ 当回合对手姿态不可知），两者都不在"桌上坐哪 28 个脚本"这一层。
- ⚑ **方法论的一条**：不配对时，"差距"这个统计量本身在同一把尺下就有 seed 间 sd **2.5–3.7pt**（v1 五 seed 读到 14.6~24.6）。所以单 seed 引用一个 4pt 的差距变化 = 读噪声；DS 的 4.4pt 与我这里的 −4.2pt 能对上，靠的是**同 seed 配对**（common random numbers），不是靠样本量。

## 二、版本戳做了什么，牙在哪里

| 文件 | 改动 |
|---|---|
| `server/opp-pool.mjs` | 新增 `EXAM_POOL_V1`（换席前那份）‖ `EXAM_POOL_VERSIONS` ‖ `examPool(version)`，**默认返回现池对象本身**（`examPool()====EXAM_POOL` 实测 true ⇒ 所有既有调用方逐字不变） |
| `tools/exam-pool.mjs` | `seatsFor(n, pool)` / `planN(n, rounds, seed, pool)` 收**可选**池参数（省略 = 现池 ⇒ `server/train-server.mjs` 等调用方不受影响） |
| `tools/exam-4n.mjs` | 新旗标 `--expool=v1\|v2`；每条读数行尾印 `pool=<版本>#<sha8> K=<席数>`（sha1 取 name:axis:minN）；认不出版本 `exit 2` |
| `tools/exam-4n-full.mjs` | 透传 `--expool`、父进程也校验、表新增 `pool` 列 ⇒ **两版读数混不进同一张表** |
| `docs/POOL-CONTRACT.md §1` | 冻结条款下面补记"11-09 被破过一次 + 处置 + 引用规则"（原文那句话没删，因为它仍是规矩） |

**四道验牙（都是实跑，不是读代码）**
1. **v1 等于换席前那份**：28 席的 `name:axis:minN` 与 `git show 469dfdb1^:server/opp-pool.mjs` 逐席深比 ⇒ YES（差异清单为空）。
2. **默认没换尺**：同一枚包同一 seed，缺省与 `--expool=v2` 输出**逐字节相同**（只有 `sec=` 差 0.1s）。
3. **决定性的一条**：`--expool=v1 --dose=page --rounds=100 seed=77000` 精确复算出 DS 在册的五枚 v1 数——G5J 57.1 ‖ G5C 53.5 ‖ G5I 41.6 ‖ G5F 35.2 ‖ WSEL9 32.5，**逐位对上** ⇒ 池重建与 X̄₄P 权重（15/25/45/15 加在 excess 上）都被历史数字本身钉住了。
4. **瞎写必须拒**：子进程 `--expool=v3` ⇒ `⛔ examPool: --expool 只认 v1/v2`；父进程 `--expool=v9` ⇒ 同样 exit 2（两处各自响亮）。

批量器也跑通了：`exam-4n-full --extra/--only` 把名单从 830 收到 5，表里 5 行 `pool=v1#27901ec8`（v2 是 `#fbf59889`）。

## 三、顺带查出来的两条覆盖缺口（**本次没动，等裁**）

1. **考卷这套仪器零门覆盖**：`grep -rn "exam-4n|exam-pool|EXAM_POOL" tools/gates/` = **0 命中**。桌形、席数 K、minN 过滤、X̄₄ 权重全都没有断言 ⇒ 一次静默的成分替换不会让任何东西红。这正是"尺被改了而没人知道"的入口；要补的话，最小的一条是"EXAM_POOL 的 (name,axis,minN) 序列哈希 == 在册锚"，锚值由 `--expool` 自己印出来。
2. **`tools/gates/ship-promote.mjs:314` 钉的是源码文本**：`ok(/OPP_DEFAULT = OPP_SPECS\.slice\(0, 9\)/.test(T2), '默认池仍取前 9 个 ⇒ 新增 specialist 不进默认基线')`。`469dfdb1` 把两枚新 specialist 插在 `OPP_SPECS` 的 index 2/3（而三处注释都写着"追加在**尾部**不动既有协议"）⇒ 字符串没变、门一路绿，而它要防的事恰好发生了：默认 9 席现在含 swordspam/piercemix、**不含 mix/farmer**。
   我核过影响面：训练桌不吃这个列表（`tools/train-3p.mjs:1425` 自带名单，farmer 还在原位）⇒ **今天的臂没有被扰乱**；受影响的是 `import { OPP_DEFAULT }` 的研究探针（e150\*/e152\*/trace-game/q-def-ablation）。修法是把判据从文本改成**名字集合**（断言新增 specialist 不在 `OPP_DEFAULT` 里），要不要现在补这条门等裁。

## 四、留给用户的裁定（已进 `DECISIONS.md` D-33）

单轴考卷会被激励结构刷爆这件事现在已经**量出来了**，接下来三条路只能选一条或明写组合：
- **退回 v1**（保住与 900+ 枚历史读数的可比性，代价是继续偏袒反弹）；
- **把 DS 自己的处方做完**（枪席 11→6~7、穿透席 4→8），但要知道天花板：2 费穿透卡在这套 1 费/回合经济里穿透率封顶 ~33%，而 guard 1 费挡一击 ⇒ 配平只改偏差，不改经济不对称；
- **不再让单个考卷分数当主尺**：改成 A（脚本桌）‖ B（冠军桌）双轴 + 分格读数并列引用（DS §19 已经在做这条，且我今天的 SEL_CARDS/SEL_DEFQ 走的也是"能力分开量"）。

## 五、产物与回执

`scratch/qoder-1109-exam-ab.mjs`（配对跑单）‖ `-summary.mjs`/`-summary.txt`（汇总，含标度纠错）‖ `scratch/qoder-1109-exam-ab.tsv`（50 行原始读数）‖ `scratch/qoder-1109-exam-ab.txt` / `-5seed.txt`（stdout）‖ `champion-map/extra-qoder1109-ab.tsv` + `only-qoder1109-ab.txt` + `exam4-qoder1109-ab-smoke.tsv`（批量器透传证据）。
本机**定向**门禁（不是整轮）：`--np --group=probe` ⇒ np/probe **88/88**（401.4s）· spec **63/63** · smoke OK · battle OK · map OK ⇒ 工具原话"5 道全绿，但只跑 probe 那一组，不许当认证引用"；另按 GATE-SHIFTS 对训练面的要求补跑 `--part=engine-fuzz` **13/13**。回执 `scratch/qoder-1109-gate-probe-exam.txt`。
⚠ 一开始我跑的是 `--auto`，它把这棵共享树上 **DS 未提交**的 `champion-map/viewer.mjs` 也算进分类 ⇒ 判成 engine 面、直接起整轮；那轮我杀掉换了显式分组，这条坑已写进 `docs/GATE-SHIFTS.md` 开头。