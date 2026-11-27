# HANDOFF · 2026-11-28 通宵班收口

> 交接时间：2026-11-28 02:03（UTC+8）。
> 当前产品：`v2.1.46`；规则指纹 `c61298e6`；池 35 枚 `hard 17 / soft 18`。
> 本班没有跑 `--group=engine` 整轮门禁，全部为定向验证。

## 1. 本班完成

### 1.1 审查修复与发布

- v2.1.44：训练服务随机令牌、Host/Origin 校验、POST-only 控制、进程树退出等待；金刚盾接入狙击干扰与地雷触发；UI `guardNext`、session 包优先级；池整表数量/ID/wid/重复校验。
- v2.1.45：`L1B-S600` 原位替换 `RING-MINIT-CONT`。
- v2.1.46：`L1B-S1200` 原位替换 `RINGB11`。
- 两次替换均恢复原抽签槽位，候选 `seatKill=0`；最终 `pool-add --audit` 为 `bad=[]`、`seatUnknown=0`。

### 1.2 基线与实验

- 35/35 Stage 1 对齐 `c61298e6 / fx-pool1126d`。
- 梯度底座：28 绿 / 4 红 / 3 legacy；红座为 `MN-PG / MT-PG / nov21-taunt-dsp0b / T65-RINGBEAD`。
- 2P rule/legacy 八 seed、5P multi/long 四 seed 全部保序。
- 受影响包 Arena 回归首 seed 三处变化在第二 seed 全部归零，未写成强度结论。
- DR-R3E Stage C A0/A1：A1 全部快照花珠绝对量仅 A0 的 13.1–19.7%，属“少蓄少废”假改善，淘汰。
- 金刚盾/全息强制使用对照全部负收益，不开 B 线训练。
- transfer：`TF-DR` 长程兑现 0–12.5%，`AR-TK2` 条件兑现更高；不开 transfer 训练。
- dualGun/mirror：全池仅 1 次有效双枪、0 次镜面；不开载体训练。

### 1.3 最终池级效果

| 版本 | 替换 | 2P rule regular/simple | 2P legacy regular/simple | 5P multi regular/simple | 5P long regular/simple |
|---|---|---:|---:|---:|---:|
| v2.1.45 | RING-MINIT-CONT → L1B-S600 | −0.11/−0.97pt | +0.04/+0.29pt | −0.40/+0.03pt | +0.50/+0.13pt |
| v2.1.46 | RINGB11 → L1B-S1200 | −0.96/−0.94pt | +0.09/+0.10pt | −0.05/+0.15pt | −0.25/−0.43pt |

产品 `seed=77000` 复核也全部保序。v2.1.46 覆盖只增不减：soft 的 bagua/curse/drain/ring/snipe 深度各 +1。

## 2. CI 状态

- v2.1.46 的 pages 与 gates 均成功。
- 用户报告的前次红 CI 是 `smoke.mjs` 的 CDP 端点启动超时；同代码后续运行成功，最新 gates 也为 success。
- 诊断提交 `aef11ee9` 的 CI 已成功；本班最后一次红 CI 确认为一次 CDP 启动超时，后续同代码运行全部通过。

## 3. 当前边界

- 不再主动改池；本班候选已用完。
- 不重开已收口的 taunt/tank/railgun/transfer 直接注入，不扫 lr/KL/seed 挽救负结果。
- `dualGun/mirror` 需要独立的载体工程，不能通过改池或脚本冒充覆盖。
- 旧指纹的 promote/seatKill/Arena B 只作历史对照，不作当前判决。

## 4. P3 工程债务清单

| 项目 | 现状证据 | 建议动作 |
|---|---|---|
| Pages 发布 archive | `.github/workflows/pages.yml` 仍 `cp -r champion-map`；`champion-map/archive` 18M，整个 champion-map 184M | 先查运行时引用，再从 `_site` 排除 archive；不要直接删仓内文件 |
| training workflow 触发面 | `.github/workflows/training.yml` 只覆盖 `training/**` 与 `tools/pack-fuse.mjs` | 补 `js/train/policy2.js`、`js/train/evo.js`、`js/core/**` 等训练自检依赖路径 |
| 旋钮 KPI | `training/knobs.mjs --check`：全集 185、在用 144、仅动态提及 41、暗键 0；目标 ≤40 | 先做引用分类与前后计数，再分批合并/删除；禁止直接物理删 |
| v7 退役残留 | `train-3p.mjs` 仍被 `training/train.mjs` 的 v7 模式及多份活文档引用 | 明确“保留复算入口”还是“整体退役”；若要退役，连文档同笔清零并挪到仓外隔离 |
| CDP 启动偶发超时 | 一次 CI 在 30s 内未等到 `/json/version`，后续通过 | 先观察复发率；若复发，再给 `cdp-boot.mjs` 加有界重试，不放宽 smoke 断言 |

## 5. DONE / DOING / NEXT

### DONE

- v2.1.44–46 已提交推送；池 35 枚 `17/18`，结构审计干净。
- Phase 0–6 与 transfer/dualGun/mirror 诊断均有结果文档和证据。
- 最终定向门、真实 Chrome `SMOKE OK` / `BATTLE OK` 通过。

### DOING

- 无训练进程、无入池操作、无后台测量在跑。

### NEXT

- 先等 `aef11ee9` CI 回执；若绿，本班可收工。
- 下一班若要继续训练，必须先提出清单外的新假设；当前没有值得直接重跑的旧配方。
- P3 债务按上表逐项提案，不在本班擅自删除或改 CI。
