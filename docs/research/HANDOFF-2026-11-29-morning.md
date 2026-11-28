# HANDOFF · 2026-11-29 白班

> 交接时间：2026-11-29 01:24（UTC+8）。
> 当前分支：`main`；最后提交：`dd2c98e8`（本文件与 CHANGELOG 收口提交随后产生）。
> 规则指纹：`c61298e6`；池：**35 枚 / hard 17 / soft 18**；本轮训练与 LOO **没有改池**。

## 1. 已完成

### 地图 2.0 投影修复（`50fc8f2e`）

- 根因不是旧坐标回退，而是小表 t-SNE 沿用大表学习率 180，且 0.5%/99.5% 尾部缩放被少数离群点撑开，2.0 点云被压成一条带。
- 修复：`N<600` 学习率 50；`N≤300` 使用 5%/95% 尾部缩放；大表参数不变。
- 删除 MDS 自动回退；`--method` 只认 `tsne`。
- 删除缺投影行沿用旧力导向坐标的运行时/生成侧回退，改为响亮失败。
- 2.0 二维 P10–P90 恢复为 `1.674 × 1.450`，`kNN@10=0.464`；四视图 `101 PASS / 0 FAIL`，Chrome 2.0 平面/立体/三维实测通过。

### Phase 0–4 与 Stretch

- 旋钮册：全集 **35 / 暗键 0**；4 个历史名字登记为退役项，设置时响亮拒绝。
- 全池 `selftest3`：**31 绿 / 3 红 / 1 legacy / 0 error**。红座：`MN-PG / MT-PG / T65-RINGBEAD`；legacy：`MSB11-R1S130778313`。
- 联合 LOO：`MT-PG+FC-S1` 通过注册安全门，六配置 `Δregular=+0.03/+0.70/−3.13/−0.63/−0.38/−0.13pt`，覆盖仍 28/28；但会新造 hard `miniT=JN-DR` 单载体，**不执行退役**。
- 弱包 LOO：`SOFT-RING-C3G25` 的 `2P rule +0.625pt > +0.5pt`，未过靶点门，**取消升级臂**。
- `TM-S5-a40` 小雷线：A0/A1 靶向分数 `0.794/0.898`，A1 固定 PG `0.767`，但胜率与废珠全失败，**全部淘汰**。
- 2P legacy 新 seed：`regular 26.15 / sparring 30.25 / gap 4.10pt`，未复现 1.8pt 窄阶梯；**不调池**。
- `JN-DR` 降废：四档全绿但废珠 `67.72–76.25%`、`jinshield 20–22`，**淘汰**。
- hard 备份：proto 探针 `proto0`、mine 探针 `mine0`，均淘汰；`T65-RINGBEAD / MN-PG` 仍是唯一载体。
- soft 备份：taunt 探针通过；laserEye 探针 `laserEye0` 淘汰；rod 探针首件 `selftest3` 红淘汰。
- Stretch：4 个无主超期 scratch 目录、52 文件、35,020,408 字节已整体迁到仓外隔离区并留 SHA256；`AR-TK2` 经 4P/5P 摘除监测后**保留**。

## 2. 白班首选候选

### `SOFT-TAUNT-PROBE`

- 路径：`scratch/arms/SOFT-TAUNT-PROBE.bak`
- `wid=85eb06cb92d19ac9`
- 血统：`L1B-S1200 → TN-S5(taunt@0.35) 120 步`
- `selftest3` 全绿；Stage 1 `winRate=49.50%`、并集 19、`taunt=20`、`ring=15`。
- 建议白班按完整链评估：六 seed Arena B / A-B-C → `promote --dry --support=2` → 90210/90211 人席 → 同位或新增槽位阶梯。
- 本班**未入池**；不要直接把探针通过当成准入通过。

## 3. 明确未做

- 未改冠军池、池顺序、规则引擎、规则指纹或线上 bundle。
- 未重开 `dualGun/mirror` 训练；11-28 运行时诊断仍有效，用户已明确其优先级低。
- 未对失败臂扫参、补 seed 或挑早期快照挽救。
- 未跑 `--group=engine` 整轮门禁。

## 4. 执行偏差与隔离

- 首次 LOO 把 `LOO_TARGETS=MT-PG,FC-S1` 误解析成两枚独立单摘；该批文件已移到 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-29-loo-single-repeat\`，未参与裁定。正确联合语法为 `MT-PG+FC-S1`。
- `JN-DR` Stage 1 一次批量测了四档，而预注册要求首件失败即停；首件已失败、四档也全失败，没有挑档，裁定不变。后续严格首件止损。
- scratch 清理只迁移、未物理删除；清单见 `evidence-2026-11-28-overnight-qwen/scratch-cleanup-manifest.json`。

## 5. 验证与 CI

- `gate-all --auto`：**5 道全绿**（`np/meta 16/16`、`spec 96/96`、`smoke OK`、`battle OK`、`map OK`）；这是 meta 组定向门，不是整轮认证。
- `pipeline/validate --quiet`：通过；`map-selfcheck` 四视图 **101/0**。
- `pool-add --audit`：`35 / 17+18 / bad=[] / untracked=0 / seatUnknown=0 / arenaUnknown=0`。
- `knobs --check`：全集 35 / 暗键 0。
- 远端 CI：`dd2c98e8` 与最终交接提交 `1608e0de` 的 gates 均成功；最终 run 为 [46170483500](https://github.com/Lion-Li-git/Epirus-Web/actions/runs/46170483500)，状态回执见 `evidence-2026-11-28-overnight-qwen/final-ci-status.json`。

## 6. 次日建议顺序

1. 完整评估 `SOFT-TAUNT-PROBE`，决定是否作为 soft 第二 taunt 载体或新增槽位。
2. 若仍要精简池，先解决 `MT-PG+FC-S1` 联合摘除后 hard `miniT` 单载体风险，再同批替换。
3. proto/mine 红座备份需要新的单键课程或不同绿色底座预注册；本次简单蒸馏已证明不够。
4. `AR-TK2` 高废珠但难度角色真实，保留；不要仅凭废珠率退役。
