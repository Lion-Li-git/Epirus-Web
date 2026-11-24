# AUDIT · 2026-11-25 全仓门禁分层与整改

> 范围：产品 CI、训练启动链、`tools/` 与 `training/` 的量具/门禁。
> 方法：运行时调用链 + 机械普查 + 真实变异/双相位验证；未跑整轮门禁。

## 已整改

| 问题 | 原形状 | 整改与验证 |
|---|---|---|
| `selftest3` 错层 | METHODOLOGY 把它列作冻结包入池前置；直接跑 pg/supfit 时实际未执行 | 改为 `pg-train` / `supfit-gd` 对真实上游参数自动预检；红包 exit 8 且不写产物，干净包进入后续参数校验。冻结包产品验收不再消费这门 |
| `spec-run` 空转 | 测试没产出总结、0 fail 时仍 exit 0 | 要求非空总结且 passed=total；真实 81/81、空输出红、失败红、1/1 绿四相位通过 |
| `champion-gate --pool` 假绿 | 配额印 ❌ 后仍 exit 0 | 任一在设配额口径不足即 exit 1；单包夹具实测 0/12 真红 |
| 强度线自相矛盾 | `strong` 挂 L1，却写“初期只当诊断” | 降 L3，只记录；`score13` 默认闸门 13→12，自测 23/23 |
| 座位阈值不随 n | n=100 仍用 30pt | 按在册零分布 p99 收紧到 21pt |
| `coverage-gate` 恒绿 | 读失败 `continue`，结尾无退出码，零代码调用 | 整体移到仓外隔离并清活引用；SHA `ec4733e99b8c3e96af35303843262decca6ef5390d01f51024ff39b84e600c0f` |
| 训练门混入产品 CI | 旋钮册 `--check` 在 required `gates` | 移到独立 `.github/workflows/training.yml`，训练面变更才触发 |
| 浏览器红而不阻断 | `browser` job `continue-on-error` | 三档并入 required `gates` 的 `needs` 与显式判定；后续步骤保留 `always()` 收齐诊断 |
| 本机/CI 图谱尺不同 | 本机只测 tree，CI 四视图 | 新增共用 `tools/map-selfcheck.mjs`；四视图各 100 PASS / 0 FAIL |
| D205 抽样区段依赖根 Changelog | 压缩旧 Changelog 后指针块导致门号密度不足 | 改读 `docs/research/archive/CHANGELOG-v1.5.320-v1.6.69-full.md` 的 v1.6 区段；D205 转绿 |
| Arena 条件表并发写 | 两进程读改写同一文件，用“最后一行”验账会撞别人 | 原子建表 + append，按本行完整内容对账；两进程实测均 exit 0 |
| 旋钮扫描漏 econ 别名 | `nv(e.EPIRUS_DIV_W)` 被误判暗键 | 识别 `e.<KEY>` 别名，排除注释假键与 `EPIRUS_INSTR` 仪器全局量；185/144/41/0，`--check` 通过 |
| smoke 随机暴毙 | 3 血随机 AI 可在四回合前打死玩家 | 默认 3 血断言保留，随后用 99 血确定性夹具跑四回合；5/5 rc=0 |

## 保留但重新分类

- `selftest2` / `selftest3` / `browser-parity` 有重叠但主语不同：形状与接线、数值梯度、浏览器镜像；保留三层。
- `L3` / `D49` / `D218` 的源码文本腿属于反静默空转/探索期安全契约；保留，未把散文当产品行为。
- `gate-sentinel` / `gate-audit-vacuous` / `gate-live-fixtures` 是审计工具，默认只报告；不计作阻断门。
- `gate-all --auto` 的“改动文件→组”与 `np-test` 的“门体引用→部分”回答不同问题；保留两份分类，不强行合并。
- `pages.yml` 只验发布健全性，保留为发布门，不冒充产品行为门。

## 清理纪律

- 所有移除代码与缓存均保留原相对路径，整体移到 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-24\`。
- 首次清理后通过真实 Arena 运行抓到 `scratch/ds-1109` 是活锚，已原路恢复；随后恢复 `ds-1108`、`night3–6`、`skill-report-loop/grid` 等证据/活输入，并留 `restored-after-reference-audit.tsv`。
- 未改 `js/core/**`，规则指纹保持 `bfd49045`；未改冠军池、未 push。
