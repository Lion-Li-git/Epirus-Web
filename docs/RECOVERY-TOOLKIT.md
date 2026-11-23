# RECOVERY TOOLKIT —— 仓库清理事故的恢复工具箱（2026-11-20 深夜从夜班实战件升格）

> 背景：11-19 白班清理误删大批权重（台账 missing 668），当夜用「四 harness 会话记录挖掘 + era-correct worktree 复跑 + wid 试金」把 B 轴 7 枚缺失锚全部逐位复原（24/24）。工具从实战件升格入 `tools/`，方法全文见 [docs/research/ANCHOR-LOSS-2026-11-19.md](research/ANCHOR-LOSS-2026-11-19.md) 与 [RECIPE-BOOK-1119.md](research/RECIPE-BOOK-1119.md)。

## 1. `tools/session-mine.mjs` —— 四 harness 会话命令挖掘

历届班次跑过的原始命令散在四家 harness 的会话存储里。**复现一把包的第一步永远是从这里挖原始命令**（重构命令几乎必错：OBS6-LH6 白班 32 发全错，原文第一发即中）。

```bash
node tools/session-mine.mjs --harness=gemini            # Gemini antigravity brains（transcript_full.jsonl）
node tools/session-mine.mjs --harness=gemini --brain=5ae79190   # 指定 brain
node tools/session-mine.mjs --harness=zcode             # ZCode db.sqlite（python 直查）
node tools/session-mine.mjs --harness=dsh               # .dsh session.v4.jsonl.zstd（需 pip install zstandard）
node tools/session-mine.mjs --harness=qoder             # .qoder-cn/logs/sessions（探路模式）
node tools/session-mine.mjs --harness=gemini --context=600      # 打印首现上下文（找配置脚本时用）
```

输出落 `scratch/session-mined/<tag>.txt`（去重后命令行清单）。挖掘技巧：别拿重构命令去试，先 `grep out=<产物名>` 定位创建命令在 transcript 的位置，再取完整旗标串；注意 `--seed` 缺省值随时代变化（e2816572 起 = 20261031）。

## 2. `tools/pack-soup.mjs` —— n 路权重融合 + wid 试金

谱系里大量融合产物是 n 路 soup（`pack-fuse.mjs` 只做两路）。V3S2 六路重建用它一发命中 `669145027f8020ae`：

```bash
node tools/pack-soup.mjs \
  --recipe=v2s0=0.25:docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V2.snap0.bak,sd=0.2:docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST.bak,... \
  --target-wid=669145027f8020ae --out=docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V3S2.bak \
  --meta-ts=2026-11-15T12:47:43.513Z
```

- `--target-wid` 给了就试金：命中 exit 0，未命中 exit 2 且**不落盘**。
- 舍入约定 = ×1e6（与 pack-fuse 一致；`--noround` 是未命中路，实测 V3S2 只认舍入版）。
- `--out` 落盘时 META 按 provenance 约定改写（删假父 hotstartFrom/up、写 `soup.sources` 机器可读六路 grain——08c29d18 先例）。

## 3. `tools/anchor-recover.mjs` —— 缺失权重对账恢复

扫仓外源（隔离区/worktree/temp——**11-19 起清理只准挪仓外，AGENTS #24**），按 wid 逐位对回缺失清单：

```bash
node tools/anchor-recover.mjs                    # 报告：多少枚能对上
node tools/anchor-recover.mjs --do               # 实恢复（拷回台账原路径 + wid 复验）
node tools/anchor-recover.mjs --wids=ID=wid,... --sources=D:/x,D:/y --do   # 手工补 wid 目标
```

- 身份判定 = wid 逐位（路径/META.ts 都不算数）。
- **wid 目标 = page/lineage.tsv**（2026-11-23 起 lineage-g3 退役，2.0 wid 已并入 registry/生成表，1.8 全集仍在此表）——但 wid 只能验身份，**盘上没源就得批量重产**（11-20 实测：3525 个源文件只直接对回 3 枚）。
- 恢复后必做：`git add -f` ‖ registry sha256 同步 ‖ 台账 `missing→ok` ‖ `node tools/arena-eval.mjs`（静默 exit 0 = 接线自证绿）。
- ⚠ 新包入账走 `champion-map/pipeline/add-point.mjs`（registry 25 列契约：1.8 从 lineage.tsv 回填 16 列配置、2.0 留空）——手搓 registry 行会对不上表头被 writeTable 咬。

## 4. `tools/recipe-index.mjs` —— 批量重产工作清单（缺失包 × 原始命令索引）

```bash
node tools/recipe-index.mjs            # 四 harness 全量挖 --out= 命令 → scratch/session-mined/recipe-index.tsv
```

把"哪些缺失包**已经有**原始命令"一次挖全（11-20 实战：64959 条 → 11 枚缺失包命中，dsh 4 / gemini 4 / zcode 5；**qoder 已定性**：segments 是生命周期遥测、projects/*.jsonl 是别项目对话——千问从未在本仓跑训练，0 命中是真答案）。产出 `id ⇥ harness ⇥ command`——同一包多 harness 命中全保留。下一步照 §6 复产。注意挖掘口径只认 `--out=<产物 basename>` 对台账 id：路径别名不影响，但产物改名过的（`--out=A --tag=B`）只命中 A；**"最早命令"≠"最终命令"**（EQ-E9-A1 先例：首试被弃，真配方带 `--shapeTeachers` 十一形套件——按产物落盘时刻附近的输出行回找真命令）。**11 枚可试枚 11-20 夜已全部闭环**：KD 链 4 枚逐位复产，CB-combo（era 冒烟闸）、EQ×2（教师件 BASE-U1-2L/DEF-s15-band6 零 git 零台账=非在册教师永久阻断）、UNIFIED×2+OBS6D3（上游 V3S2-MB/U2.snap0/OBS6A4.seg1000 盘上无源）阻断有因。

## 5. `tools/pool-xray.mjs` —— 池 X 光（分带维护量具）

```bash
node tools/pool-xray.mjs                # 全成员 arenaB × 覆盖一览 + 三带聚合（中位/带内覆盖并集）
node tools/pool-xray.mjs --cov-th=3     # 「跨环境会用」阈值（默认 3 格）
```

分带重切（11-19 深夜先例：hard 11 枚中位 +14.2 底 +2.3 / soft 13 枚 −21.0）用它扫描与验证；**mid 带按 D234⑬a 在册裁定必须拆空，别再建**。

## 6. 复现一把历史包的标准流程（四步）

1. `session-mine` 挖原始命令（判据：`--out=<产物名>` 的首次出现；小心白班/复现尝试的同名命令混在里面——**看 step_index/时间戳取最早**）。
2. era-correct worktree：`git worktree add D:/code/wt-<名> <当时 commit>`（旗标集随时代变化：e2816572 的 pg-train 无 `--obs`；bf303d0d 起才有 `--obs=obs6/--dmgW/--beadSpendW`；缺依赖把主仓正身拷进 worktree 同路径）。
3. 照抄原始命令跑（`--out=` 走 scratch 别名**不碰盘上原件**），`widOf` 对 lineage 在册 wid 试金。
4. 命中后：拷正身入 `docs/artifacts/` 原路径 → `git add -f` → registry sha256 同步 → 台账 `missing→ok` → `arena-eval` 自证。

## 7. `tools/command-checkup.mjs` —— 出土命令"今天能不能照抄"体检（11-20 深夜 · Qoder）

```bash
node tools/command-checkup.mjs     # 读两张在册命令表 → scratch/command-checkup/command-checkup.tsv
```

把会话里挖出的命令逐条判成 `COPY-OK / COPY-NEEDS-PATH-FIX / COPY-FAIL-ENTRY-GONE / COPY-FAIL-DARK-KEYS /
COPY-FAIL-DEAD-KEY / NEED-PREREQ / UNREADABLE-FRAGMENT / NOT-TRAINER`。判据不手抄：暗键与死键走生产
`training/server/knob-guard.mjs` 的 `detectDarkKnobs`，`SELF_ENV_KEYS` 从 `training/train-3p.mjs` 源码机械提取，
脚本自带**进出对账**（读入 ≠ 出表就打印差值）。
结论与判语见 [research/COMMAND-CHECKUP-2026-11-20.md](research/COMMAND-CHECKUP-2026-11-20.md)：
**对 505 枚缺件有用的老命令，0 条能原样照抄**，其中一半只欠一个路径名（`tools/train-3p.mjs`→`training/train-3p.mjs`）；
暗键高度集中在 v7 奖励族 ⇒ **该换 era worktree，不该改键名**。

## 8. `anchor-recover` 的源清单盲区（11-22 · Qoder）

`--sources=` 的缺省只有两个隔离区 + 4 个 `wt-repro-*`，**不含 11-20/21 为 era 重放建的 182 个 `D:/code/srv-wt-*` / `wt-*` 工作树**
——那些树里躺着历届重放的产物（`.bak` 与训练暂存槽），是"仓外源"最大的一块。把源指过去再跑：

```bash
cd /d/code && ls -d srv-wt-s0-* srv-wt-s1-* wt-* | sed 's|^|D:/code/|' | paste -sd, - > "$TEMP/srcs-dcode.txt"
cd /d/code/Epirus-Web && node tools/anchor-recover.mjs --sources="$(cat "$TEMP/srcs-dcode.txt")"
```

11-22 实测：源文件 12,977 ‖ 唯一 wid 1,276 ‖ **可恢复 5**（`%TEMP%` 下 510 个 `epirus-*` 目录另扫，0 命中）。
清单、逐枚 wid 复核与"其中一枚躺在 `.training-out-3p.js` 暂存槽里、再跑一次训练就没了"的警示见
[research/HANDOFF-2026-11-22-night-for-glm.md](research/HANDOFF-2026-11-22-night-for-glm.md) §一。
**别把这块源写进缺省**——那些树是复现过程的中间态，改名/清理都在动；要固化就先按 §24 挪进隔离区。

## 9. `tools/v7-scan-plan.mjs` —— 早期 server 缺件的复现队列（11-22 · Qoder）

吃 `page/lineage.tsv` 的 `parent`/`parentOf`/`metaSeed` + 16 列表内配方 + 台账态，输出"每批先跑 1 枚探针"的队列 TSV
（缺省落 `docs/research/v7-scan-plan.tsv`，`--out=` 可改，`--fams=` 可换族）。
存在的理由：`lineage` 此前只被当身份账（`wid`）和画图账（`fam`/`ts`）用，
而**根与 seed 一直都在表里**（fam4/5/6 的 310 枚缺件 310/310 有值）⇒ 扫描不该从"猜 env 阶梯"起步。
自带进出对账：读不到缺件行就 exit 2，不出口径不明的半张表。算法与收益排序见
[research/HANDOFF-2026-11-22-night-for-glm.md](research/HANDOFF-2026-11-22-night-for-glm.md) §二。

## 10. `tools/land-recovered.mjs` —— `anchor-recover --do` 之后的登记步（11-22 · Qoder）

**它替掉一个错说法**：11-21 通宵班交接 §三.3 让恢复件"同步更新 `registry.tsv` 的 `sha256`"——**别照做**。
在册约定是（`--check` 跑遍全表实测：状态列与哈希列零违例）：

- 字节逐位等于 `registry.sha256` ⇒ 台账 `state=ok`、第 4 列留空；
- `widOf` 逐位同但字节不同 ⇒ `state=sha-diff-wid-same`、第 4 列写**盘上实际 sha**；
- **`registry.tsv` 任何情况下都不由登记步改动**（它是当年入库字节的历史指纹）。

```bash
node tools/land-recovered.mjs --check   # 验上面三条跑遍全表（有违例 exit 1）
node tools/land-recovered.mjs           # 只报告"文件已回到原路径但仍标 missing"的待登记件
node tools/land-recovered.mjs --do --ids=v7attr-31,...   # 逐枚自证 wid 后才落盘
```

自证三件：任何一枚 wid 不过 ⇒ **整批不落盘**；写完复核行数没变；写完复核 `registry.tsv` 字节未改动。
⚠ 已知 `--check` 当前会红：`EFFG-s41` 的 lineage `wid` 与任何盘上文件都不符（608 枚可比对里唯一一处），原因与处置见
[research/HANDOFF-2026-11-22-night-for-glm.md](research/HANDOFF-2026-11-22-night-for-glm.md) §7.2 —— 那是要修的账，不是要绕的门。


