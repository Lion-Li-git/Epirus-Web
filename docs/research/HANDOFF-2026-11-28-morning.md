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

## 6. 06:36 续班：P3 工程债务

- Pages 发布已排除 `champion-map/archive`：干净树产物 **450 → 208 文件、61M → 43M**；仓内 archive 保留，页面无运行时引用。
- training workflow 已补齐 `tools/**`、`js/**`、`champion-map/**`（排除 archive）与自检夹具的 push/PR 触发路径；覆盖训练自检依赖，也覆盖旋钮册实际扫描的四个维护根。
- 验证：干净树 Pages 组装通过；`training/train.mjs --selftest` 的 37 条原型自证、selftest3 六腿、浏览器镜像全绿；`training/knobs.mjs --check` 通过。
- CDP 复发审计：最近 50 次 gates 有 3 次失败，均为 `/json/version` 启动超时；新增 `launchChromeReady()` 仅对该超时重启一次，`smoke`/`battle` 显式 `attempts=2`，进程退出与 spawn 错误不重试。注入首启失败验证恰好重试一次，真实 Chrome `SMOKE OK` / `BATTLE OK`。
- 本轮未改产品规则、池成员或训练判据，也未跑本地整轮门禁。

## 7. 07:04 续班：soft 候选收口

- `L1b seg1800` 与 `seg2400` 均完成当前池同 seed 四靶点快筛，无值得升级的替换点，已淘汰并留原始回执。
- `AR-TK2` 保覆盖 PG：首件血统正确但 selftest3 腿 C 红，按预注册停止。
- `FC-S1` 保天火 PG：首件全绿，天火/过载炮覆盖保住，但电珠过期 `1591→2133`，主目标反向，淘汰。
- `MX8-R6B-KL` 保覆盖 PG：首件全绿，废珠下降约 58%，但花珠仅底座 58%、railgun `26→14`、mine `1→0`，触发硬止损，淘汰。
- 本轮没有池成员变更；剩余高废珠 soft 多数 selftest3 红，不能直接续训。下一班若要继续，应做教师式保覆盖或接受覆盖代价，不再扫 PG 剂量。
- 旋钮 KPI 复核：去注释后仍有 145 个真实读法，注释-only 为 0；41 个无静态读法均为动态提及，不能删。总数降到 ≤40 需要真实 API 合并，不是扫描器修复。
- 当前 35 池废珠表已按 `fx-pool1126d / c61298e6` 重算：可读高废珠前排为 `nov21-taunt-dsp0b 98.0%`、`AR-TK2 97.3%`、`nov21-armor-tzt2d 97.1%`、`MX6-GD-TF20 96.7%`、`FC-S1 96.4%`、`OBS6E9 95.9%`；`MSB11` 的 100% 因分母仅 1 标记为不可读。
- `AR-TK2` 教师式候选（PG-DR 底 + armor/tank/transfer@0.10）首件与终点全绿、废珠 35.5%，但 armor/tank/transfer 仅 16/5/0 格，覆盖硬门失败，已收口。
- 文档口径修正：README/AGENTS/旋钮册不再声称 `knobs --check` 自动拦截无注解；生成器已退役该收割逻辑，当前只校验册子新鲜度与暗键。
- 干净树验收注记：Windows `core.autocrlf=true` 下裸 `git archive` 会把导出文件转 CRLF，令 `knobs --check` 假红；用 `git -c core.autocrlf=false archive` 按 CI LF 口径导出后，旋钮册与训练栈自检均全绿。
