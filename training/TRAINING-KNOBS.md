# 训练侧旋钮册（生成物，勿手改）

> 生成器就是本文件：`node training/knobs.mjs` 重生成；CI 每次都跑 `node training/knobs.mjs --check`（`.github/workflows/training.yml`）。
> ⚠ `--check` 比的是**整篇字节**（不是只比数据账三个数——旧头注这么写，是错的：`cur !== content` 才 exit 1）。
> 判"在用/暗键"的口径（2026-11-24 换）：**按读法扫维护面**（`tools/ training/ js/ champion-map/` 里 `process.env.X` / `env['X']` / `e.<KEY>` 别名），
> 名单模块与注释不参与判定；`env[变量]` 这种**动态读法**看不见具体键，落进"仅动态提及"档，**不是删除候选**。
> 为什么换口径：按全局实际读法扫维护面比手维护入口名单更稳，不靠手工白名单猜读者。
> 运行时那套（`training/server/knob-guard.mjs` 的 `readKeysOf()` / `detectDarkKnobs()`，按**单个入口**的 import 闭包判）仍保留给门禁与工具复用。
> 注解：v7 线（`train-3p.mjs`、`econ-env.mjs`、`train-env.mjs` 等）已于 2026-11-28 正式整体退役并移至仓外隔离区 `cleanup-2026-11-28`（随 git 史可考）；当前 `--check` 校验册子新鲜度与暗键。
> 2.0 产线（pg-train / supfit-gd）是 **--flag** 接口（见 training/README.md §〇），不走 env 旋钮。
> 数据账：全集 35 ‖ 在用（有读法）33 ‖ 仅动态提及 2 ‖ 暗键 0

## 全量（按名排序）

| 旋钮 | 读它的文件（前 3） | 署名入口 | 状态 |
|---|---|---|---|
| `EPIRUS_AGGR_GAMES` | `tools/audit-lib.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_ALIAS_TSV` | `tools/gates/_ctx.mjs` `champion-map/pack-guard.mjs` | — | 在用（读法 2 处） |
| `EPIRUS_ALLOW_DARK` | — | promote-champion train | 仅动态提及（不删） |
| `EPIRUS_ARCH2` | `tools/probe-cem-arm.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_BATCH_MAX` | `tools/np-parallel.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_BREADTH_GAMES` | `tools/promote-champion.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_BUNDLE_IN` | `tools/ring2-run.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_BUNDLE_OUT` | `tools/ring2-run.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_CHARGE_GAMES` | `tools/audit-lib.mjs` `tools/champ-audit.mjs` | promote-champion | 在用（读法 2 处） |
| `EPIRUS_CHROME` | `tools/cdp-boot.mjs` `tools/page-chrome.mjs` | — | 在用（读法 2 处） |
| `EPIRUS_DEBUG_CDP` | `tools/page-chrome.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_DEFQ_GAMES` | `tools/promote-champion.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_DENSITY_GAMES` | `tools/audit-lib.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_FEAS_GAMES` | `tools/audit-lib.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_GUARD_GAMES` | `tools/promote-champion.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_GUARD_SEEDS` | `tools/promote-champion.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_HOTSTART` | `champion-map/audit-parent-evidence.mjs` `champion-map/lineage.mjs` | — | 在用（读法 2 处） |
| `EPIRUS_LOG_DEFAULT_OUT` | `tools/gates/_ctx.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_MUT_MODE` | `tools/probe-cem-arm.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_NO_DEFQ` | `tools/promote-champion.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_NO_GUARD` | `tools/promote-champion.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_NO_PROXY` | `tools/promote-champion.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_NO_SHAPE` | `tools/promote-champion.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_PAIRED` | `tools/probe-cem-arm.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_PASSIVE_FIELD` | — | — | 仅动态提及（不删） |
| `EPIRUS_PROXY_GAMES` | `tools/promote-champion.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_REPO` | `tools/probe-g4-anatomy.mjs` `tools/probe-ring-ablate.mjs` | — | 在用（读法 2 处） |
| `EPIRUS_SEAT_GAMES` | `tools/audit-lib.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_SEED` | `tools/diag.mjs` `tools/promote-champion2p.mjs` | — | 在用（读法 2 处） |
| `EPIRUS_SEEDPACK` | `tools/dedupe-artifacts.mjs` `champion-map/lineage.mjs` `champion-map/pipeline/add-point.mjs` | — | 在用（读法 3 处） |
| `EPIRUS_SEL_EVAL_SEEDS` | `tools/gates/_ctx.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_SHAPE_GAMES` | `tools/promote-champion.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_SNIPER_GAMES` | `tools/promote-champion.mjs` | promote-champion | 在用（读法 1 处） |
| `EPIRUS_WALL_MS` | `training/server/wall-cap.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_WR_TOL` | `tools/gates/meta-repo.mjs` | — | 在用（读法 1 处） |

## 仅动态提及（**不是删除候选**：读法长成 `env[变量]`，扫不出具体键）

- `EPIRUS_ALLOW_DARK`
- `EPIRUS_PASSIVE_FIELD`

