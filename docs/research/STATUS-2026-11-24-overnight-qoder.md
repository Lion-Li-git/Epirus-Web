# STATUS · 2026-11-24 通宵班（Qoder）

> 开工：2026-11-24 23:30:44 +08:00
> 基线：`d6e67fbe`；工作树干净；`main` 未推送。
> 唯一在跑 Node 进程为 DSH `billion-context`（PID 17640），无训练/测量实例。
> 用户授权：执行原通宵计划，并追加拆分训练门与包准入门、审查全仓门禁、清理缓存、归档旧文档、压缩旧 Changelog、整理 README 与产品测正面文案。
> 原计划主线保留：P0a `smoke` 随机暴毙；P0b 2P/珠/天火蒸馏；P1 v5/baseswap 收尾与池替换**报告**；P2a 旋钮扫描与零引用脚本；P2b v7 短批与 #78。
> 红线：不物理删除；清理件保持原相对路径移到仓库外隔离目录；不改池成员；不 push；共享树不用 `gate-all --auto`；不跑整轮门禁。

## DONE

- 记录开工时钟、HEAD、工作树与进程基线。
- 确认 `selftest3` 的 C/F 红项只影响梯度训练；A/B/D/E 验证前向、部署尾与浏览器镜像。
- 现查 `tools/` 无 `selftest3` 引用，`promote-champion` / `pool-add` 未消费该门；它目前是 METHODOLOGY 的统一验收政策，不是产品工具硬门。
- 启动两项后台只读审查：全仓门禁、缓存与产品文案。
- 任务 #55 完成：`selftest3` 改为训练启动预检；`pg-train` / `supfit-gd` 对真实上游参数自动执行，冻结推理包不再消费该门。
- 双向验证：`EQ-S4-E9` 六腿全绿并进入后续参数校验；`t65` 在 `pg-train` / `supfit-gd` 均 exit 8，未写产物。
- `node --check` 与 `git diff --check` 通过；METHODOLOGY、训练 README、主 README、2P STATUS 与原通宵计划已同步新口径。

### P0a

- 原计划 P0a（任务 #61）完成：`smoke.mjs` 先验默认 3 血，再用 99 血确定性夹具跑四回合；断言改为“四回合后仍处于对局中”。
- `smoke.mjs` 连跑 **5/5 rc=0**；代表日志已升格到 `docs/research/evidence-2026-11-25/smoke-p0a-1.log`，其余重复日志仓外隔离。

### P0b

- 12 形 `2:standard@1/@3` 两粒 seed 与 `lr=5e-5/40步` 复测完成：`@3` 的 2P rule 随 seed 反向分裂；轻步组珠经济 **76.1–76.2%**，但 2P rule **51.5% / 83.6%**，无候选。
- 按计划停止扫权重/步数；产物与日志留 `scratch/2p-weighted-1124/`，原始件在 `scratch/arms/nov24-2pw12*`。

### 门禁与 P2a

- `spec-run` 空输出/失败输出均红，真实 spec 81/81；`champion-gate --pool` 配额不足真 exit 1，强度降 L3，座位线按 n=100 p99 收紧到 21pt，`score13` 23/23。
- 训练旋钮门移到独立 `training.yml`；浏览器三档并入 required `gates`；`map-selfcheck.mjs` 成为 CI/本机共用四视图门，四视图各 100 PASS。
- `coverage-gate.mjs` 与 22 个零代码引用探针共 23 文件已仓外隔离，SHA 清单在 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-24\`。
- 旋钮扫描识别 econ 别名并排除假键：全集 185 / 在用 144 / 动态 41 / 暗键 0，`--check` 通过。

### P1 / P2b

- P1 六粒当前指纹评测完成：天火局闭环 87.3–94.3%、空爆 0，但 Arena 六粒均值全部低于基座，且不补池级新键；无替换推荐。报告 `docs/research/RESULTS-2026-11-25-p1-current-qoder.md`。
- P2b：`v7new5_005` / `v7ringB1` 已全部在账；`v7b` 两个 era 校准 wid 均 miss，跳过整批。#78 页面已改为局闭环/抓手/被盾挡三列，`TK-FS4` 显示 80% / 48% / 82%。

### 清理与文案

- 升格 `t65` 权重与 15 份 P0b/P1/P2b 证据；隔离约 313MB 缓存/旧件。真实 Arena 运行抓出 `ds-1109` 活锚后已恢复，并复核恢复 `ds-1108`、`night3–6`、`skill-report-loop/grid`。
- 归档 24 份旧 handoff + 10 份零引用旧研究文档；Changelog 压缩 8 节，D205 改读 v1.6 归档区段。
- README、index、ui.js、skill-tip、smoke、battle-test、ui-probe 与演化图背景已正面化；图谱标签改为“训练衍生”，长程显示“5血；已测 N/总数”。

### P3 余量

- 缺件队列现为 **72 枚 / 24 批，全部 T3**；`v7b` 四枚重放件可找到，但线谱表没有可比列，需查热启动件与 era 工作树。本轮无新复刻登记；分诊回执已升格到 `docs/research/evidence-2026-11-25/p3/`。11-25 追加：两份兄弟工作树的 `v7b-43..46` 虽各自字节一致，但四份彼此完全相同、wid 均为 `e379c62c…`，与台账四枚 SHA 全不符 ⇒ 判定为同一旧槽热启动件复制，拒绝升格；负证据见 `p3/v7b-sibling-worktree-check-1125.tsv`。随后在 `1499d507` era 的两份工作树中找到校准件 `v7b-37`，wid 均为台账值 `c76335f8f42135f9` ⇒ 已把重放 jobs 切到该 era。首次全批四枚均 `healthReject/wrote:false`，runner 把上一版 base 误当成品；在恢复工作树补 `EPIRUS_ALLOW_HEALTH_FAIL=1` 实验豁免（patch 留档）后四枚全部命中：`v7b-43..46` wid 分别为 `af421684ad43b368 / 2c1037230b65064c / 773f81c0e2a6f5d2 / eb0dd651d18dcdff`。文件 SHA 与历史 registry 不同，台账如实记 `sha-diff-wid-same`；丢失账现为 `missing 133`。完整 lineage 重生成被既存 `SOUP-s9-82XD4a` 缺父粒挡住，故只按生成器同式补回四行 `oppsN=12/gens=250/mode=multi`；`land-recovered --check` 1002 行零违例，规范重烘与四视图全绿。

## 收口

- 原计划 P0a/P0b/P1/P2a/P2b 与新增门禁审查、缓存清理、文档归档、文案整理、P3 分诊全部完成。
- 最终定向验证通过；未跑整轮门禁，未改池、未 push。

## NEXT

1. 原计划 P0b：2P + 珠经济 + occasional 天火蒸馏，先预检再行为验收。
2. 原计划 P1/P2：v5/baseswap 收尾、旋钮扫描、零引用脚本清单、v7 短批、#78。
3. 新增：审计产品测与训练测门禁，标明“判什么、坏了会不会红、是否重复”。
4. 新增：对 `scratch/`、`docs/`、临时输出与 registry 对账；有用产物升格，其余仓外隔离。
5. 新增：归档旧文档、压缩旧 Changelog；清理 README、产品 UI 与测试标记中的过时/否定式文案，规则 QA 辨析保留。
6. P3 低优先级余量：按丢失台账与重放队列继续剩余权重考古/逐位复刻；时间不足留接力清单。
7. 按改动面做定向验证与变异夹具，更新本日志并提交；不推送、不动池。

## 关键裁定

- 已执行：`selftest3` 红不再单独否决冻结推理包；仍禁止红包作为梯度训练起点。
- 门禁整改必须证明“该红时红”；不能靠喂字符串、删断言或放松阈值制造绿色。
- 任何删除先盘点引用与在册归属；无法确认的件保留并记录，不冒险清理。

## 验证与收口

- `spec-run` **81/81**；`champion-gate --selftest` **14/14**；`score13 --selftest` **23/23**。
- np 定向组：**meta 16/16 ‖ ship 47/47 ‖ ui 55/55 ‖ probe 83/83**；均为分组，不是整轮认证。
- 浏览器：`SUMMARY: SMOKE OK` ‖ `SUMMARY: BATTLE OK` ‖ `ui-probe` 全 PASS；四视图各 **100 PASS / 0 FAIL**。
- 训练侧：旋钮册 `185/144/41/0` 且 `--check` 通过；`selftest2` **37/37**、`selftest3` 六腿、browser-parity 全绿。
- 数据/仓库：`gate-parts-check` 167/167、`validate --strict` mismatch 0、`check-lineage` OK、`land-recovered --check` 零违例、两个 workflow YAML 可解析、`git diff --check` 通过。
- Arena 条件表并发写双进程实测均 exit 0；`t65` 红包仍正确阻止 pg/supfit 启动且不写产物。
- 规则指纹保持 `bfd49045`；冠军池、线上 bundle 与 `js/core/**` 未改。
