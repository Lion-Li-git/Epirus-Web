# 训练侧旋钮册（生成物，勿手改）

> 生成器 `tools/knob-registry.mjs`（`--check` 模式供 CI 防腐烂）。真源有两处、各司其职：
> ① **代码读取**（server/knob-guard.mjs 解析四个入口，读集即闸真正认的集合）；
> ② **注解**（`tools/train-3p.mjs` 的 `SELF_ENV_KEYS` 行尾注释——注解住在读取处旁边，删旋钮时自然消失）。
> 改了任何一处的 env 读取 / 注解 ⇒ 跑 `node tools/knob-registry.mjs` 重生成；CI 每次 push 都会 `--check`。
> 数据账：全集 246 ‖ 在用 236 ‖ 暗键 9 ‖ 孤儿 0 ‖ 在用未登记 0 ‖ 已删除台账 1

## 状态速览

| 状态 | 含义 | 处置 |
|---|---|---|
| 在用 | ≥1 入口真读它 | 必须有注解；未登记的补进 SELF_ENV_KEYS |
| 暗键 | 源码里有字面量但四入口都不读 | 删除候选（先查 121 份启动器有没有在 set）|
| 孤儿 | 只在 SELF_ENV_KEYS 登记却无人读 | 注解过期，删登记或恢复实现 |
| 已删除 | REMOVED_TRAIN_KEYS 台账在册 | 重启必须走台账流程 |

## 全量（按名排序）

| 旋钮 | 读它的入口 | 登记 | 单一来源表 | 状态 | 注解（SELF_ENV_KEYS 行尾） |
|---|---|---|---|---|---|
| `EPIRUS_AGGRO_OPPS` | train-3p | Y | — | 在用 | DS 11-08 夜：集火奖励（连续命中同一目标；默认 0 ⇒ gFit 逐字不变）   // DS 11-08 晚（用户「2.0 要全方位优于 v7」）：把 pickFarmer（只攒钱席）追加进训练桌，补「场B 清场」在 fitness 里的缺失（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_AGGR_GAMES` | train-3p train-best train-server promote-champion | Y | — | 在用 | 体检量具局数族（audit-lib.feasPlan 单一来源；默认=在册 FEAS_N_DEFAULTS） |
| `EPIRUS_ALIAS_TSV` | train-3p train-best train-fast | Y | — | 在用 | 包别名表路径（pack-resolve 链读；门体 _ctx 有自己的缺省） |
| `EPIRUS_ALLOW_DARK` | train-3p train-best train-fast train-server promote-champion | Y | — | 在用 | 闸放行旗（=1 放行「本入口读不到的键」）；用臂必须自己补回逐键回执证据（见上 ⚑ 块） |
| `EPIRUS_ALLOW_HEALTH_FAIL` | train-3p train-server | Y | — | 在用 | 2P 服务：体检未过仍落盘（实验臂旗，默认关） |
| `EPIRUS_ANCHOR` | train-3p | Y | — | 在用 | 锚定正则 λ(v1.5.153,0=关) ‖ 锚定对象 seed/widest ‖ 臂名(产物/台账) ‖ band 产物目录(默认 docs/artifacts) ‖ 逐代清对手奖励(§N8b) ‖ 热启动开关(配 SEEDPACK) |
| `EPIRUS_ANCHOR_TO` | train-3p | Y | — | 在用 | 锚定正则 λ(v1.5.153,0=关) ‖ 锚定对象 seed/widest ‖ 臂名(产物/台账) ‖ band 产物目录(默认 docs/artifacts) ‖ 逐代清对手奖励(§N8b) ‖ 热启动开关(配 SEEDPACK) |
| `EPIRUS_ARCH2` | train-3p | Y | — | 在用 | §E821（10-28 傍晚 · 千问）：2.0 架构原型 + 段感知/扁平变异算子档（默认关 ⇒ 逐字回到 v7） |
| `EPIRUS_ARM` | train-3p train-best | Y | — | 在用 | 锚定正则 λ(v1.5.153,0=关) ‖ 锚定对象 seed/widest ‖ 臂名(产物/台账) ‖ band 产物目录(默认 docs/artifacts) ‖ 逐代清对手奖励(§N8b) ‖ 热启动开关(配 SEEDPACK) |
| `EPIRUS_BAND_DIR` | train-3p | Y | — | 在用 | 锚定正则 λ(v1.5.153,0=关) ‖ 锚定对象 seed/widest ‖ 臂名(产物/台账) ‖ band 产物目录(默认 docs/artifacts) ‖ 逐代清对手奖励(§N8b) ‖ 热启动开关(配 SEEDPACK) |
| `EPIRUS_BATCH_MAX` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_BEAD_BOOM_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BEAD_SEED` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BEAD_SEED_KIND` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BEAD_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BEAD_WASTE_W` | train-3p | Y | — | 在用 | 过期珠浪费惩罚（PREREG §二十九，数 beadExpire 事件不碰花费侧，默认关） |
| `EPIRUS_BIGCARD_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BIGT_CHAIN_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BIGT_PUSH` | train-3p | Y | — | 在用 | §E275（v1.5.334）：**部署档的 CLI 把手**（大雷默认档 / 摄魂探索软提升）；不设 ⇒ 引擎默认一字不动，设了就由引擎回读 |
| `EPIRUS_BLOCK_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BREADTH_FATAL` | train-3p | Y | — | 在用 | DS 11-03：名人堂全塌缩时中止（默认关 ⇒ 旧行为逐字同） |
| `EPIRUS_BREADTH_FLOOR` | train-3p | Y | — | 在用 | v1.5.170：广度准入线（§N29，默认关；`SEL_LAND_GAMES` 是它共用的量具局数） |
| `EPIRUS_BREADTH_GAMES` | train-3p promote-champion | Y | — | 在用 | promote 广度画像局数（long/multi 各一把，默认 20） |
| `EPIRUS_BUNDLE_IN` | train-3p train-server | Y | — | 在用 | 2P 服务：热启动源 / 产物落点（隔离模式；线上包只由 promote 写） |
| `EPIRUS_BUNDLE_OUT` | train-3p train-server | Y | — | 在用 | 2P 服务：热启动源 / 产物落点（隔离模式；线上包只由 promote 写） |
| `EPIRUS_CARD_ABORT` | train-3p | Y | — | 在用 | 11-10（用户：连续一段 <4 卡就杀，不等终局）：训练期 top-1 用卡数连续 K 代低于下限 ⇒ 整臂 exit 13，不写产物 |
| `EPIRUS_CARD_ABORT_GAMES` | train-3p | Y | — | 在用 | 11-10（用户：连续一段 <4 卡就杀，不等终局）：训练期 top-1 用卡数连续 K 代低于下限 ⇒ 整臂 exit 13，不写产物 |
| `EPIRUS_CARD_MIN` | train-3p | Y | — | 在用 | 11-10（用户：连续一段 <4 卡就杀，不等终局）：训练期 top-1 用卡数连续 K 代低于下限 ⇒ 整臂 exit 13，不写产物 |
| `EPIRUS_CHARGE_GAMES` | train-3p train-best train-server promote-champion | Y | — | 在用 | 体检量具局数族（audit-lib.feasPlan 单一来源；默认=在册 FEAS_N_DEFAULTS） |
| `EPIRUS_CHARGE_MIN_EP` | train-3p train-best train-fast train-server | Y | — | 在用 | 蓄能门槛（worker 下达，缺省 2 = v1.5.82 裁定） |
| `EPIRUS_CHROME` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_CLEAR_W` | train-3p train-best train-fast train-server | Y | — | 在用 | 锚定正则 λ(v1.5.153,0=关) ‖ 锚定对象 seed/widest ‖ 臂名(产物/台账) ‖ band 产物目录(默认 docs/artifacts) ‖ 逐代清对手奖励(§N8b) ‖ 热启动开关(配 SEEDPACK) |
| `EPIRUS_CONV_OFFENSE` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_CONV_RATIO` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_COSTLY_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_COUNTER_OPPS` | train-3p | Y | — | 在用 | v1.5.172：把 G4/G5 的判据原型放上训练桌（§N35，默认关） |
| `EPIRUS_COURSE_BOT` | train-3p | Y | — | 在用 | （ZCode · 11-06 夜）课程席坐谁：Bots 导出的函数名（缺省 pickToolKit） |
| `EPIRUS_COURSE_EVERY` | train-3p | Y | — | 在用 | （ZCode · 11-06 夜）课程席：每第 K 代 fitness 局注一席脚本对手（D-08 机制解；默认 0=关） |
| `EPIRUS_COURSE_PACK` | train-3p | Y | — | 在用 | 11-10 DS：课程席放真实包 / fitness 掺冠军桌（包路径）/ 冠军席每 k 局一席（默认 4） |
| `EPIRUS_CURSE_PUSH` | train-3p | Y | — | 在用 | 部署档把手：贴贴高 ep 软注入 / 送盾先验 0\|1\|2（本入口 CLI 默认 2） |
| `EPIRUS_DEBUG_CDP` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_DEFQ_GAMES` | train-3p promote-champion | Y | — | 在用 | promote 白防率探针：跳过旗 / 局数（默认 30；立线前只让读数可见） |
| `EPIRUS_DEF_ADAPT_W` | train-3p | Y | — | 在用 | 多血适度防御奖励（DS 11-02，默认关） |
| `EPIRUS_DEF_IDLE_W` | train-3p | Y | — | 在用 | 白防罚（DS 11-02，默认关） |
| `EPIRUS_DENSITY_GAMES` | train-3p train-best train-server promote-champion | Y | — | 在用 | 体检量具局数族（audit-lib.feasPlan 单一来源；默认=在册 FEAS_N_DEFAULTS） |
| `EPIRUS_DIV_CATW` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_DIV_FORCE_GENS` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_DIV_K` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_DIV_ROLEW` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_DIV_W` | train-3p train-best train-server promote-champion | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_DRAIN_HEAL_W` | train-3p | Y | — | 在用 | 残血摄魂奖励（DS 11-02，默认关） |
| `EPIRUS_DRAIN_PUSH` | train-3p | Y | — | 在用 | §E275（v1.5.334）：**部署档的 CLI 把手**（大雷默认档 / 摄魂探索软提升）；不设 ⇒ 引擎默认一字不动，设了就由引擎回读 |
| `EPIRUS_ECON_OPPS` | train-3p | Y | — | 在用 | v1.5.325 §E236：把"会攒并且真兑现"的深经济对手放上训练桌（名字表驱动，默认关） |
| `EPIRUS_ECO_CAP` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_ECO_DIVW` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_ECO_TARGET` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_EFFSKILL_MIN` | train-3p | Y | — | 在用 | DS 11-03：有效技能数下限（非ジ份额 ≥0.5% 的键数；0=关） |
| `EPIRUS_EFFSKILL_SHARE` | train-3p | Y | — | 在用 | DS 11-03：上面那条"份额"的阈值（默认 0.005） |
| `EPIRUS_FAMILY_FIELD` | train-3p | Y | — | 在用 | §E798（10-27 夜班）：训练桌形状（k 席被测家族副本 + 其余脚本，k=3 即考卷形状）⇒ 同样带作用计数 |
| `EPIRUS_FEASIBILITY` | train-3p train-server | Y | — | 在用 | 2P 服务：落盘前可行性体检（=0 关）/ 体检不过阻断落盘（默认关） |
| `EPIRUS_FEASIBILITY_BLOCK` | train-3p train-server | Y | — | 在用 | 2P 服务：落盘前可行性体检（=0 关）/ 体检不过阻断落盘（默认关） |
| `EPIRUS_FEAS_GAMES` | train-3p train-best train-server promote-champion | Y | — | 在用 | 体检量具局数族（audit-lib.feasPlan 单一来源；默认=在册 FEAS_N_DEFAULTS） |
| `EPIRUS_FEAT_MASK` | train-3p train-server | Y | — | 在用 | worker：特征掩码（policy.setFeatMask，训练侧砍维用） |
| `EPIRUS_FIGHT_DEAL` | train-server | — | FIGHT_ENV_KEYS | 在用 |  |
| `EPIRUS_FIGHT_FIRST` | train-server | — | FIGHT_ENV_KEYS | 在用 |  |
| `EPIRUS_FIGHT_WHISTLE` | train-server | — | FIGHT_ENV_KEYS | 在用 |  |
| `EPIRUS_FITGW` | train-3p | Y | — | 在用 | 11-01 深（PREREG-MERGER §一）：指纹行加 top-3 只测不选的宽读数（默认关） |
| `EPIRUS_FIT_CAL` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_FIT_CHAMP` | train-3p | Y | — | 在用 | 11-10 DS：课程席放真实包 / fitness 掺冠军桌（包路径）/ 冠军席每 k 局一席（默认 4） |
| `EPIRUS_FIT_CHAMP_EVERY` | train-3p | Y | — | 在用 | 11-10 DS：课程席放真实包 / fitness 掺冠军桌（包路径）/ 冠军席每 k 局一席（默认 4） |
| `EPIRUS_FIT_G_FLOOR` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_FIT_G_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_FIT_TAIL_Q` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_FIT_TAIL_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_FOCUS_W` | train-3p | Y | — | 在用 | DS 11-08 夜：集火奖励（连续命中同一目标；默认 0 ⇒ gFit 逐字不变）   // DS 11-08 晚（用户「2.0 要全方位优于 v7」）：把 pickFarmer（只攒钱席）追加进训练桌，补「场B 清场」在 fitness 里的缺失（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_GA_BAND` | train-3p | Y | — | 在用 | 每代 top-3 健康门槛(宽粒优先,饿退不杀) ‖ 门槛测量局数(默认6) ‖ 带内取宽带宽 ‖ 连续K代bestFit不进步⇒整臂终止 |
| `EPIRUS_GA_GATE` | train-3p | Y | — | 在用 | 每代 top-3 健康门槛(宽粒优先,饿退不杀) ‖ 门槛测量局数(默认6) ‖ 带内取宽带宽 ‖ 连续K代bestFit不进步⇒整臂终止 |
| `EPIRUS_GA_GATE_GAMES` | train-3p | Y | — | 在用 | 每代 top-3 健康门槛(宽粒优先,饿退不杀) ‖ 门槛测量局数(默认6) ‖ 带内取宽带宽 ‖ 连续K代bestFit不进步⇒整臂终止 |
| `EPIRUS_GUARD_GAMES` | train-3p promote-champion | Y | — | 在用 | promote 防御三件探针：跳过旗 / 局数（默认 40）/ 种子数（默认 2） |
| `EPIRUS_GUARD_HIT_W` | train-3p | Y | — | 在用 | 打龟奖励（§E816 A案，只给打在本回合摆防御目标上的伤害付钱，默认关） |
| `EPIRUS_GUARD_SEEDS` | train-3p promote-champion | Y | — | 在用 | promote 防御三件探针：跳过旗 / 局数（默认 40）/ 种子数（默认 2） |
| `EPIRUS_HALL_DEDUP` | train-3p | Y | — | 在用 | v1.7.92 §E635：名人堂按 wid 去重（同一粒权重只占一席；默认关 ⇒ 榜的形状一字不变） |
| `EPIRUS_HALL_SEED` | train-3p | Y | — | 在用 | v1.5.277 §E114：把起点补进终局重验的候选池（默认关） |
| `EPIRUS_HALL_TRACE` | train-3p | Y | — | 在用 | 名人堂逐粒追踪开关 ‖ 追踪 JSONL 落盘路径(默认 scratch/hall-trace/<臂>.jsonl) |
| `EPIRUS_HALL_TRACE_OUT` | train-3p | Y | — | 在用 | 名人堂逐粒追踪开关 ‖ 追踪 JSONL 落盘路径(默认 scratch/hall-trace/<臂>.jsonl) |
| `EPIRUS_HALL_TRACE_PROBE` | train-3p | Y | — | 在用 | ⤵ 11-01 深：M-1 连续下限罚（默认 0） |
| `EPIRUS_HOARD_CAP_MULT` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_HOARD_LEFTOVER` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_HOLDOUT_SEG` | train-3p | Y | — | 在用 | （ZCode · 11-03 凌晨）E3 存段：每 K 代快照当代最优粒落 band 目录（默认 0=关；只存盘不改当选） |
| `EPIRUS_HOLO2PROTO` | train-3p | Y | — | 在用 | v1.7.4（10-13 夜班 S2a）：训练期把"送盾"改写成"给自己上原型制御"（决策期档，`policy.js` 的 `setHolo2Proto`） |
| `EPIRUS_HOTSTART` | train-3p train-best | Y | — | 在用 | 锚定正则 λ(v1.5.153,0=关) ‖ 锚定对象 seed/widest ‖ 臂名(产物/台账) ‖ band 产物目录(默认 docs/artifacts) ‖ 逐代清对手奖励(§N8b) ‖ 热启动开关(配 SEEDPACK) |
| `EPIRUS_HPSEED` | train-3p | Y | — | 在用 | （ZCode · 11-02 深夜）残血开局课程——摄魂 (b) 线（默认 0=关；p 比例局全席对称压 HP=min(2,modeHp-1)） |
| `EPIRUS_IMIT_FRAC` | train-3p train-server | Y | — | 在用 | 示范族：教师名 / 分段计划名 / 退火窗口（占总代数比例）/ 绝对代数（服务端由 FRAC 折算） |
| `EPIRUS_IMIT_GENS` | train-3p train-best train-fast train-server | Y | — | 在用 | 示范族：教师名 / 分段计划名 / 退火窗口（占总代数比例）/ 绝对代数（服务端由 FRAC 折算） |
| `EPIRUS_IMIT_ONLY` | train-3p train-best train-fast train-server | Y | — | 在用 | 示范族：只示范单键 / 真示范覆盖 / 只示范子集（本入口拼写）/（服务端拼写）——两拼写并存是历史账 |
| `EPIRUS_IMIT_OVERRIDE` | train-3p train-server | Y | — | 在用 | 示范族：只示范单键 / 真示范覆盖 / 只示范子集（本入口拼写）/（服务端拼写）——两拼写并存是历史账 |
| `EPIRUS_IMIT_PLAN` | train-3p train-best train-fast train-server | Y | — | 在用 | 示范族：教师名 / 分段计划名 / 退火窗口（占总代数比例）/ 绝对代数（服务端由 FRAC 折算） |
| `EPIRUS_IMIT_SUBONLY` | train-3p | Y | — | 在用 | 示范族：只示范单键 / 真示范覆盖 / 只示范子集（本入口拼写）/（服务端拼写）——两拼写并存是历史账 |
| `EPIRUS_IMIT_SUB_ONLY` | train-3p train-best train-fast train-server | Y | — | 在用 | 示范族：只示范单键 / 真示范覆盖 / 只示范子集（本入口拼写）/（服务端拼写）——两拼写并存是历史账 |
| `EPIRUS_IMIT_TEACHER` | train-3p train-server | Y | — | 在用 | 示范族：教师名 / 分段计划名 / 退火窗口（占总代数比例）/ 绝对代数（服务端由 FRAC 折算） |
| `EPIRUS_INIT_ACT_K` | train-3p | Y | — | 在用 | 2.0 起点初始化的动作头振幅（arch2 缺省 1） |
| `EPIRUS_INIT_SCALE` | train-3p | Y | — | 在用 | 11-04 波 H（千问）：随机起点幅度（缺省 0.25 = 出厂） |
| `EPIRUS_INSTR` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_JSON` | train-3p promote-champion | Y | — | 在用 | promote 判据的机器可读投影行前缀（固定字面量，不是路径） |
| `EPIRUS_KILL_FIELD` | train-3p train-server | Y | TRAIN_ENV_KEYS | 在用 | v1.5.160：收割席注入（qoder §N13 · 用户裁定"场B 缺口走对手池"）⇒ 带**开火计数**才敢算"已下达" |
| `EPIRUS_KILL_REWARD` | train-3p | Y | — | 在用 | v1.5.194：击杀奖励规则训练（0924 夜 · 内存补丁，不动仓库引擎） |
| `EPIRUS_KR_TRANSFER` | train-3p | Y | — | 在用 | v1.5.194：击杀奖励规则训练（0924 夜 · 内存补丁，不动仓库引擎） |
| `EPIRUS_LASER_W` | train-3p train-server | Y | — | 在用 | 奖励权重：激光眼命中 / 威胁靶向（下达后回执不一致 ⇒ exit 7） |
| `EPIRUS_LOG_DEFAULT_OUT` | train-3p | Y | — | 在用 | 没改道的臂另追加一行到该文件（点名默认落点用，§E654） |
| `EPIRUS_MIX2_EVERY` | train-3p | Y | — | 在用 | （ZCode · 11-06 夜）fitness 每第 K 局换 2 人桌——同代混桌（DS 待办 2；默认 0=关） |
| `EPIRUS_MIX8` | train-3p | Y | — | 在用 | （ZCode · 11-02 深夜）fitness 每第 K 局换 8 人桌——地雷 5P+ 高性价比（用户裁定），8P 局照常进 fit（默认 0=关） |
| `EPIRUS_MIXHP_EVERY` | train-3p | Y | — | 在用 | （ZCode · 11-06 深夜）桌形混合：每第 K 局换对偶桌形（multi↔long；3血适应，默认 0=关） |
| `EPIRUS_MUT_MODE` | train-3p | Y | — | 在用 | §E821（10-28 傍晚 · 千问）：2.0 架构原型 + 段感知/扁平变异算子档（默认关 ⇒ 逐字回到 v7） |
| `EPIRUS_NORM` | train-3p | Y | — | 在用 | 2.0 臂：输入标准化 {mean[],std[]} JSON 路径（读不出/形状不对 ⇒ exit 7） |
| `EPIRUS_NO_DEFQ` | train-3p promote-champion | Y | — | 在用 | promote 白防率探针：跳过旗 / 局数（默认 30；立线前只让读数可见） |
| `EPIRUS_NO_GUARD` | train-3p promote-champion | Y | — | 在用 | promote 防御三件探针：跳过旗 / 局数（默认 40）/ 种子数（默认 2） |
| `EPIRUS_NO_PROXY` | train-3p promote-champion | Y | — | 在用 | promote 反弹代理探针：跳过旗（省 30s）/ 局数（默认 20；只打印不判定） |
| `EPIRUS_NO_SHAPE` | train-3p promote-champion | Y | — | 在用 | promote 形状适应度探针：跳过旗 / 局数（默认 30；只打印不判定） |
| `EPIRUS_OPP_BLOCK` | train-3p | Y | — | 在用 | v1.5.279 §E124：整桌同原型（改"桌子的形状"，不改名单；默认关 ⇒ 逐字可逆） |
| `EPIRUS_OPP_HUMAN` | train-3p | Y | — | 在用 | v1.6.60：把**人类形状替身**放上训练桌（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_OPP_HUMAN_FILE` | train-3p | Y | — | 在用 | v1.6.60：把**人类形状替身**放上训练桌（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_OPP_HUMAN_SRC` | train-3p | Y | — | 在用 | v1.6.60：把**人类形状替身**放上训练桌（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_OPP_HUMAN_TGT` | train-3p | Y | — | 在用 | v1.6.60：把**人类形状替身**放上训练桌（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_OPP_N` | train-3p train-server | Y | — | 在用 | 2P 服务：对手池名单覆盖（逗号名表，缺省 9 席；配对 A/B 用） |
| `EPIRUS_OPP_SWEEP` | train-3p | Y | — | 在用 | DS 11-03：对手池每代轮齐（旧公式每代只覆盖 11 位；默认关） |
| `EPIRUS_PACK_OPP` | train-3p | Y | — | 在用 | 2.0 臂：一枚包上训练桌当对手席（默认关；v7 模式拒收） |
| `EPIRUS_PAIRED` | train-3p | Y | — | 在用 |  |
| `EPIRUS_PASSIVE_FIELD` | — | — | — | 已删除（台账在册） |  |
| `EPIRUS_PASSIVE_OPPS` | train-3p | Y | — | 在用 | DS 11-08 夜：集火奖励（连续命中同一目标；默认 0 ⇒ gFit 逐字不变）   // DS 11-08 晚（用户「2.0 要全方位优于 v7」）：把 pickFarmer（只攒钱席）追加进训练桌，补「场B 清场」在 fitness 里的缺失（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_POOL_OPPS` | train-3p | Y | — | 在用 | v1.7.83 §E631：把**冠军池成员**放上训练桌（枚数 + 档名驱动，默认关 ⇒ OPPS 一字不变）；表路径可指名册——11-13 统一池裁定后 pool-members-2p.tsv 是**2P 训练对手名册**（旧 v7 包当 2P 陪练），不再喂页面 |
| `EPIRUS_POOL_OPPS_TABLE` | train-3p | Y | — | 在用 | v1.7.83 §E631：把**冠军池成员**放上训练桌（枚数 + 档名驱动，默认关 ⇒ OPPS 一字不变）；表路径可指名册——11-13 统一池裁定后 pool-members-2p.tsv 是**2P 训练对手名册**（旧 v7 包当 2P 陪练），不再喂页面 |
| `EPIRUS_POOL_OPPS_TIER` | train-3p | Y | — | 在用 | v1.7.83 §E631：把**冠军池成员**放上训练桌（枚数 + 档名驱动，默认关 ⇒ OPPS 一字不变）；表路径可指名册——11-13 统一池裁定后 pool-members-2p.tsv 是**2P 训练对手名册**（旧 v7 包当 2P 陪练），不再喂页面 |
| `EPIRUS_POPSTAT` | train-3p | Y | — | 在用 | #46（11-03 晚）：逐代**种群统计量** JSONL（默认 0=关 ⇒ 一行不写、gen 行逐字不变） |
| `EPIRUS_POPSTAT_K` | train-3p | Y | — | 在用 | #46（11-03 晚）：逐代**种群统计量** JSONL（默认 0=关 ⇒ 一行不写、gen 行逐字不变） |
| `EPIRUS_POPSTAT_OUT` | train-3p | Y | — | 在用 | #46（11-03 晚）：逐代**种群统计量** JSONL（默认 0=关 ⇒ 一行不写、gen 行逐字不变） |
| `EPIRUS_PROXY_GAMES` | train-3p promote-champion | Y | — | 在用 | promote 反弹代理探针：跳过旗（省 30s）/ 局数（默认 20；只打印不判定） |
| `EPIRUS_PUBLISH` | train-3p train-fast | Y | — | 在用 | 出厂写槽开关(=1 才写 js/bundled*,默认关) ‖ 种子 ‖ 热启动包 ‖ 2P切片局数(默认 GAMES/2) ‖ 2P对手集 'exam'=对产品考卷基准 |
| `EPIRUS_REFLECT_W` | train-3p | Y | — | 在用 | 真反射 credit（PREREG §二十六·4，只给 reflect 事件付钱，默认关） |
| `EPIRUS_REGEN_GENS` | train-3p train-server | Y | — | 在用 | 补贴族：补贴总代数 / 补贴率下达（本入口） |
| `EPIRUS_REGEN_SLICE` | train-3p | Y | — | 在用 | 补贴族：补贴总代数 / 补贴率下达（本入口） |
| `EPIRUS_REPO` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_RETAL_W` | train-3p | Y | — | 在用 | （ZCode · 11-14 夜6班）被围殴还手奖励（率形：还手次数/被打次数，封顶 50% 吃满；默认 0 ⇒ gFit 逐字不变）——GD6a 唯一阻断线（场A 还手 12%<20%）；「兑现进奖励」已有否证（evalSubsidyProbe −27pt）⇒ 此杆只买还手不碰兑现 |
| `EPIRUS_RING_FORCE_EPS` | train-3p train-server | Y | — | 在用 | 聚能环强探档：ε / 截止代（默认 0=关） |
| `EPIRUS_RING_FORCE_UNTIL` | train-3p train-server | Y | — | 在用 | 聚能环强探档：ε / 截止代（默认 0=关） |
| `EPIRUS_RING_OPPS` | train-3p | Y | — | 在用 | v1.5.285 §E127：把会放聚能环的对手放上训练桌（默认关；判据用现成的 probe-dead-term） |
| `EPIRUS_RING_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_S4_GAMES` | train-3p train-server | Y | — | 在用 | 2P 服务：shapeScorer 量具局数（默认 8） |
| `EPIRUS_S4_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_SEAT_GAMES` | train-3p train-best train-server promote-champion | Y | — | 在用 | 体检量具局数族（audit-lib.feasPlan 单一来源；默认=在册 FEAS_N_DEFAULTS） |
| `EPIRUS_SEED` | train-3p train-best train-fast | Y | — | 在用 | 出厂写槽开关(=1 才写 js/bundled*,默认关) ‖ 种子 ‖ 热启动包 ‖ 2P切片局数(默认 GAMES/2) ‖ 2P对手集 'exam'=对产品考卷基准 |
| `EPIRUS_SEED0` | train-3p train-server | Y | — | 在用 | 2P 服务：worker 播种根（服务端派生后下发） |
| `EPIRUS_SEEDPACK` | train-3p | Y | — | 在用 | 出厂写槽开关(=1 才写 js/bundled*,默认关) ‖ 种子 ‖ 热启动包 ‖ 2P切片局数(默认 GAMES/2) ‖ 2P对手集 'exam'=对产品考卷基准 |
| `EPIRUS_SELF_TEACHER` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_SEL_BIGT` | train-3p | Y | — | 在用 | v1.5.326 §E249：同分带内按贵卡出手选人（默认 0 ⇒ 当选者逐字不变） |
| `EPIRUS_SEL_BIGT_GAMES` | train-3p | Y | — | 在用 | v1.5.326 §E249：同分带内按贵卡出手选人（默认 0 ⇒ 当选者逐字不变） |
| `EPIRUS_SEL_BIGT_KEYS` | train-3p | Y | — | 在用 | v1.5.326 §E249：同分带内按贵卡出手选人（默认 0 ⇒ 当选者逐字不变） |
| `EPIRUS_SEL_BIGT_MODE` | train-3p | Y | — | 在用 | v1.5.326 §E249：同分带内按贵卡出手选人（默认 0 ⇒ 当选者逐字不变） |
| `EPIRUS_SEL_CARDS` | train-3p | Y | — | 在用 | 11-09 P2（用户裁定：只筛新候选、不回筛现役池）：当选面**用卡数地板 veto**，度量复用 fieldProfile 的逐卡计数（份额 ≥0.5%，与 tools/card-usage.mjs 同定义），默认 0=关 |
| `EPIRUS_SEL_CARDS_GAMES` | train-3p | Y | — | 在用 | 11-09 P2（用户裁定：只筛新候选、不回筛现役池）：当选面**用卡数地板 veto**，度量复用 fieldProfile 的逐卡计数（份额 ≥0.5%，与 tools/card-usage.mjs 同定义），默认 0=关 |
| `EPIRUS_SEL_CLEAR` | train-3p | Y | — | 在用 | §E787（10-26 夜班后追加，用户裁"加上开跑"）：当选面的**场B 清场地板**（veto，不进 fit）+ 它的测量局数（默认 40 = 官方口径） |
| `EPIRUS_SEL_CLEAR_GAMES` | train-3p | Y | — | 在用 | §E787（10-26 夜班后追加，用户裁"加上开跑"）：当选面的**场B 清场地板**（veto，不进 fit）+ 它的测量局数（默认 40 = 官方口径） |
| `EPIRUS_SEL_COUNTER` | train-3p | Y | — | 在用 | v1.5.172：把 G4/G5 的判据原型放上训练桌（§N35，默认关） |
| `EPIRUS_SEL_DEF` | train-3p | Y | — | 在用 | 11-02 千问 §A（PREREG-2026-11-02-SEL-DEF）：当选面**防御下限**排序键（默认 0=关 ⇒ 当选者逐字不变） |
| `EPIRUS_SEL_DEFQ` | train-3p | Y | — | 在用 | 11-09 P1（用户三条裁定：容差带内**排序键**不是硬地板 ‖ 防御手 n≥30 才算数、不够按"没量到"跳过 ‖ 只筛新候选不动现役池）：带内把**白防率低**的挤上当选席，默认 0=关 ⇒ 当选者逐字不变 |
| `EPIRUS_SEL_DEFQ_EPS` | train-3p | Y | — | 在用 | 11-09 P1（用户三条裁定：容差带内**排序键**不是硬地板 ‖ 防御手 n≥30 才算数、不够按"没量到"跳过 ‖ 只筛新候选不动现役池）：带内把**白防率低**的挤上当选席，默认 0=关 ⇒ 当选者逐字不变 |
| `EPIRUS_SEL_DEFQ_GAMES` | train-3p | Y | — | 在用 | 11-09 P1（用户三条裁定：容差带内**排序键**不是硬地板 ‖ 防御手 n≥30 才算数、不够按"没量到"跳过 ‖ 只筛新候选不动现役池）：带内把**白防率低**的挤上当选席，默认 0=关 ⇒ 当选者逐字不变 |
| `EPIRUS_SEL_DEFQ_MINHANDS` | train-3p | Y | — | 在用 | 11-09 P1（用户三条裁定：容差带内**排序键**不是硬地板 ‖ 防御手 n≥30 才算数、不够按"没量到"跳过 ‖ 只筛新候选不动现役池）：带内把**白防率低**的挤上当选席，默认 0=关 ⇒ 当选者逐字不变 |
| `EPIRUS_SEL_DEFQ_MINSHARE` | train-3p | Y | — | 在用 | 11-09 P1（用户三条裁定：容差带内**排序键**不是硬地板 ‖ 防御手 n≥30 才算数、不够按"没量到"跳过 ‖ 只筛新候选不动现役池）：带内把**白防率低**的挤上当选席，默认 0=关 ⇒ 当选者逐字不变 |
| `EPIRUS_SEL_DEFQ_MODE` | train-3p | Y | — | 在用 | 11-09 P1（用户三条裁定：容差带内**排序键**不是硬地板 ‖ 防御手 n≥30 才算数、不够按"没量到"跳过 ‖ 只筛新候选不动现役池）：带内把**白防率低**的挤上当选席，默认 0=关 ⇒ 当选者逐字不变 |
| `EPIRUS_SEL_DEF_GAMES` | train-3p | Y | — | 在用 | 11-02 千问 §A（PREREG-2026-11-02-SEL-DEF）：当选面**防御下限**排序键（默认 0=关 ⇒ 当选者逐字不变） |
| `EPIRUS_SEL_DEF_MIN` | train-3p | Y | — | 在用 | 11-02 千问 §A（PREREG-2026-11-02-SEL-DEF）：当选面**防御下限**排序键（默认 0=关 ⇒ 当选者逐字不变） |
| `EPIRUS_SEL_DEF_MODE` | train-3p | Y | — | 在用 | 11-02 千问 §A（PREREG-2026-11-02-SEL-DEF）：当选面**防御下限**排序键（默认 0=关 ⇒ 当选者逐字不变） |
| `EPIRUS_SEL_EVAL_SEEDS` | train-3p train-server | Y | TRAIN_ENV_KEYS | 在用 | §E322（v1.6.7）：当选键重验用几粒 seedBase 取均值（默认 4；=1 逐字回到旧行为） |
| `EPIRUS_SEL_G45` | train-3p | Y | — | 在用 | 选拔档：两段式（默认开，=0 关）/ G4/G5 最坏格否决（默认关）/ G4long 逐格否决（默认关） |
| `EPIRUS_SEL_G4LONG` | train-3p | Y | — | 在用 | 选拔档：两段式（默认开，=0 关）/ G4/G5 最坏格否决（默认关）/ G4long 逐格否决（默认关） |
| `EPIRUS_SEL_GIFT_VETO` | train-3p | Y | — | 在用 | §E650（千问）：送盾当选 veto + 它的测量长度（默认关 ⇒ `gateOk` 那一次测量也不跑） |
| `EPIRUS_SEL_GIFT_VETO_GAMES` | train-3p | Y | — | 在用 | §E650（千问）：送盾当选 veto + 它的测量长度（默认关 ⇒ `gateOk` 那一次测量也不跑） |
| `EPIRUS_SEL_GRID` | train-3p | Y | — | 在用 | 11-03 T1：当选面**按族别签名分格取最稀格**（默认 0=关 ⇒ 当选者逐字不变；单位同 SEL_DEF = 重验分分差 pt） |
| `EPIRUS_SEL_GRID_GAMES` | train-3p | Y | — | 在用 | 11-03 T1：当选面**按族别签名分格取最稀格**（默认 0=关 ⇒ 当选者逐字不变；单位同 SEL_DEF = 重验分分差 pt） |
| `EPIRUS_SEL_GRID_MODE` | train-3p | Y | — | 在用 | 11-03 T1：当选面**按族别签名分格取最稀格**（默认 0=关 ⇒ 当选者逐字不变；单位同 SEL_DEF = 重验分分差 pt） |
| `EPIRUS_SEL_KEEP` | train-3p | Y | — | 在用 | v1.5.265b/266/267：落地 / 出手 / 座位对称性三把尺（默认全关） |
| `EPIRUS_SEL_KEEP_CAL` | train-3p | Y | — | 在用 | v1.5.265b/266/267：落地 / 出手 / 座位对称性三把尺（默认全关） |
| `EPIRUS_SEL_KEEP_CAST_KEYS` | train-3p | Y | — | 在用 | v1.5.265b/266/267：落地 / 出手 / 座位对称性三把尺（默认全关） |
| `EPIRUS_SEL_KEEP_KEYS` | train-3p | Y | — | 在用 | v1.5.265b/266/267：落地 / 出手 / 座位对称性三把尺（默认全关） |
| `EPIRUS_SEL_KEEP_MODES` | train-3p | Y | — | 在用 | v1.5.265b/266/267：落地 / 出手 / 座位对称性三把尺（默认全关） |
| `EPIRUS_SEL_KEEP_PLAIN_GAMES` | train-3p | Y | — | 在用 | v1.5.265b/266/267：落地 / 出手 / 座位对称性三把尺（默认全关） |
| `EPIRUS_SEL_KEEP_SEAT` | train-3p | Y | — | 在用 | v1.5.265b/266/267：落地 / 出手 / 座位对称性三把尺（默认全关） |
| `EPIRUS_SEL_KEEP_SEAT_GAMES` | train-3p | Y | — | 在用 | v1.5.265b/266/267：落地 / 出手 / 座位对称性三把尺（默认全关） |
| `EPIRUS_SEL_KEEP_SEAT_MIN` | train-3p | Y | — | 在用 | v1.5.265b/266/267：落地 / 出手 / 座位对称性三把尺（默认全关） |
| `EPIRUS_SEL_LAND` | train-3p | Y | — | 在用 | v1.5.167：当选面兑现广度（默认关） |
| `EPIRUS_SEL_LAND_GAMES` | train-3p | Y | — | 在用 | v1.5.167：当选面兑现广度（默认关） |
| `EPIRUS_SEL_LAND_TOL` | train-3p | Y | — | 在用 | v1.5.167：当选面兑现广度（默认关） |
| `EPIRUS_SEL_POOL` | train-3p | Y | — | 在用 | v1.7.92 §E635：把池成员**也放上选拔桌**（终局重验那张表；默认关 ⇒ `ALL_PAIRS` 一字不变） |
| `EPIRUS_SEL_TWO_STAGE` | train-3p | Y | — | 在用 | 选拔档：两段式（默认开，=0 关）/ G4/G5 最坏格否决（默认关）/ G4long 逐格否决（默认关） |
| `EPIRUS_SEQ_KIND` | train-3p | Y | — | 在用 | v1.8.37（10-25 ZCode · §二十一）：序列奖励的**珠种档**（'elec' 缺省 = 电磁炮原义；'boom' = 蓄爆珠→激光眼） |
| `EPIRUS_SEQ_W` | train-3p | Y | — | 在用 | v1.5.229：序列奖励（"蓄能[电珠]→下一回合电磁炮"完成时 +W ep；同样只在内存里，默认 0=关） |
| `EPIRUS_SHAPE_GAMES` | train-3p promote-champion | Y | — | 在用 | promote 形状适应度探针：跳过旗 / 局数（默认 30；只打印不判定） |
| `EPIRUS_SIGMA_DECAY` | train-3p | Y | — | 在用 | GA σ 调度：下限（0.06）/ 衰减（0.995）/ 停滞回抬档（K 代没进步 ×1.25，默认 0=关） |
| `EPIRUS_SIGMA_FLOOR` | train-3p | Y | — | 在用 | GA σ 调度：下限（0.06）/ 衰减（0.995）/ 停滞回抬档（K 代没进步 ×1.25，默认 0=关） |
| `EPIRUS_SIGMA_STALL` | train-3p | Y | — | 在用 | GA σ 调度：下限（0.06）/ 衰减（0.995）/ 停滞回抬档（K 代没进步 ×1.25，默认 0=关） |
| `EPIRUS_SNIPER_GAMES` | train-3p promote-champion | Y | — | 在用 | promote 狙击画像局数（默认 20，long/mixed） |
| `EPIRUS_STALL_ABORT` | train-3p | Y | — | 在用 | 每代 top-3 健康门槛(宽粒优先,饿退不杀) ‖ 门槛测量局数(默认6) ‖ 带内取宽带宽 ‖ 连续K代bestFit不进步⇒整臂终止 |
| `EPIRUS_STOCK_BONUS` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_STYLE_FRAC` | train-3p | Y | — | 在用 | 风格课程：指定风格桌 / 风格席混入比例 / 风格奖励权重（服务端，默认 0.5）/ 其量具局数（默认 2） |
| `EPIRUS_STYLE_GAMES` | train-3p train-server | Y | — | 在用 | 风格课程：指定风格桌 / 风格席混入比例 / 风格奖励权重（服务端，默认 0.5）/ 其量具局数（默认 2） |
| `EPIRUS_STYLE_TABLE` | train-3p | Y | — | 在用 | 风格课程：指定风格桌 / 风格席混入比例 / 风格奖励权重（服务端，默认 0.5）/ 其量具局数（默认 2） |
| `EPIRUS_STYLE_W` | train-3p train-server | Y | — | 在用 | 风格课程：指定风格桌 / 风格席混入比例 / 风格奖励权重（服务端，默认 0.5）/ 其量具局数（默认 2） |
| `EPIRUS_SUBSIDY_EP` | train-3p train-server | Y | — | 在用 | 2P 服务：补贴局形状（每 h 局 / 从 ep 起 / 低于 min 不补） |
| `EPIRUS_SUBSIDY_H` | train-3p train-server | Y | — | 在用 | 2P 服务：补贴局形状（每 h 局 / 从 ep 起 / 低于 min 不补） |
| `EPIRUS_SUBSIDY_MIN` | train-3p train-server | Y | — | 在用 | 2P 服务：补贴局形状（每 h 局 / 从 ep 起 / 低于 min 不补） |
| `EPIRUS_SUB_BEAD` | train-3p train-best train-fast train-server | Y | — | 在用 | 模仿教师的蓄能钩子（与 EPIRUS_SUB_BEAD_KIND 一起设才进；只设珠种=钩子不进） |
| `EPIRUS_SUB_BEAD_KIND` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_SUPPORT_PRIOR` | train-3p | Y | — | 在用 | 部署档把手：贴贴高 ep 软注入 / 送盾先验 0\|1\|2（本入口 CLI 默认 2） |
| `EPIRUS_T3P_BASELINE` | train-3p | Y | — | 在用 | 产物改道 / 基线持有者声明（写默认落点要显式认领，三选一纪律见 :2363） |
| `EPIRUS_T3P_OUT` | train-3p | Y | — | 在用 | 产物改道 / 基线持有者声明（写默认落点要显式认领，三选一纪律见 :2363） |
| `EPIRUS_TB3P` | train-3p train-best | Y | — | 在用 | train-best：产物改道 / 候选跑 3P 五道体检（默认 0=关）/ 其量具局数（缺省跟随 feasPlan） |
| `EPIRUS_TB3P_GAMES` | train-3p train-best | Y | — | 在用 | train-best：产物改道 / 候选跑 3P 五道体检（默认 0=关）/ 其量具局数（缺省跟随 feasPlan） |
| `EPIRUS_TB_OUT` | train-3p train-best | Y | — | 在用 | train-best：产物改道 / 候选跑 3P 五道体检（默认 0=关）/ 其量具局数（缺省跟随 feasPlan） |
| `EPIRUS_TEACHER_GATE` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_TEACHER_GATE_HP` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_TEACHER_GATE_T` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_TGT_W` | train-3p train-server | Y | — | 在用 | 奖励权重：激光眼命中 / 威胁靶向（下达后回执不一致 ⇒ exit 7） |
| `EPIRUS_TOOLKIT_OPPS` | train-3p | Y | — | 在用 | §E676（10-21 早班）：把杂货铺（计划层 P0~P7）放上训练桌（份数驱动，默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_TRAIN_EPS` | train-3p | Y | — | 在用 | 训练执行口径（E28）：ε / εK / 模式 / 温度——缺省=产品口径，显式给=显式实验 |
| `EPIRUS_TRAIN_EPS_K` | train-3p | Y | — | 在用 | 训练执行口径（E28）：ε / εK / 模式 / 温度——缺省=产品口径，显式给=显式实验 |
| `EPIRUS_TRAIN_EPS_MODE` | train-3p | Y | — | 在用 | 训练执行口径（E28）：ε / εK / 模式 / 温度——缺省=产品口径，显式给=显式实验 |
| `EPIRUS_TRAIN_MODE` | train-3p train-server | Y | TRAIN_ENV_KEYS | 在用 | v1.5.169：训练模式（§N28 · 用户"炼一个 5 血长程通吃其他模式"）⇒ 认不了就 exit 7，不许静默退回 multi |
| `EPIRUS_TRAIN_SEAT_GAMES` | train-3p train-best train-fast train-server | Y | — | 在用 | 2P 服务：座位轮换局数（>0 才开 setSeatGames） |
| `EPIRUS_TRAIN_TEMP` | train-3p | Y | — | 在用 | 训练执行口径（E28）：ε / εK / 模式 / 温度——缺省=产品口径，显式给=显式实验 |
| `EPIRUS_TRIPLET` | train-3p | Y | — | 在用 | 落盘后 triplet 读数（spawn exam4-triplet，JSON 上 stdout）/ 台账追加路径（设了才写） |
| `EPIRUS_TRIPLET_LOG` | train-3p | Y | — | 在用 | 落盘后 triplet 读数（spawn exam4-triplet，JSON 上 stdout）/ 台账追加路径（设了才写） |
| `EPIRUS_VOID_IDEAL_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_VOID_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_WALL_BREAK_W` | train-3p | Y | — | 在用 | 破反弹墙奖励（v1.8.39，默认关） |
| `EPIRUS_WALL_FILTER` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_WALL_GAMES` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_WALL_MS` | train-3p train-server | Y | — | 在用 | 2P 服务：墙钟收敛（ms，=0 纯按代数；动它破坏同参可复现，慎重） |
| `EPIRUS_WIDE_FINAL` | train-3p | Y | — | 在用 | 11-01 深（ZCode · PREREG-2026-11-01-WIDE-FINAL）：v4 终局同尺（默认关）   // 11-01 晚（ZCode · 千问交接 §五.3）：逐代名人堂/门槛指纹落盘（默认关 ⇒ 一条行为不变）   // 千问 §十一 C：演化期健康门槛（形状搬自 `evo.js:3952`）+ 它的测量长度 + 带内取宽的带宽 ‖ GA 臂级空转终止（`EPIRUS_STALL_ABORT` 已在 §六② 实现，名单此前漏登记） |
| `EPIRUS_WIDTH_LAND_W` | train-3p | Y | — | 在用 | 落地广度奖励（v1.7.90，默认关） |
| `EPIRUS_WIDTH_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_WORKERS` | train-3p train-best train-fast train-server | Y | — | 在用 | 2P 服务并行度：worker 数（缺省 cpus-1，上限 16） |
| `EPIRUS_WR_TOL` | train-3p train-server | Y | — | 在用 | 2P 服务：冠军换代的胜率容差（默认 0.03） |
| `EPIRUS_XN2G` | train-3p | Y | — | 在用 | 出厂写槽开关(=1 才写 js/bundled*,默认关) ‖ 种子 ‖ 热启动包 ‖ 2P切片局数(默认 GAMES/2) ‖ 2P对手集 'exam'=对产品考卷基准 |
| `EPIRUS_XN2REF` | train-3p | Y | — | 在用 | 出厂写槽开关(=1 才写 js/bundled*,默认关) ‖ 种子 ‖ 热启动包 ‖ 2P切片局数(默认 GAMES/2) ‖ 2P对手集 'exam'=对产品考卷基准 |
| `EPIRUS_XN2SCRIPTS` | train-3p | Y | — | 在用 | 2P 切片并入多人脚本池(默认不并,防稀释) ‖ 2P 切片 fit 权重(0=关) |
| `EPIRUS_XN2W` | train-3p | Y | — | 在用 | 2P 切片并入多人脚本池(默认不并,防稀释) ‖ 2P 切片 fit 权重(0=关) |

## 暗键（删除候选，处置前先查启动器）

- `EPIRUS_BATCH_MAX`
- `EPIRUS_CHROME`
- `EPIRUS_DEBUG_CDP`
- `EPIRUS_INSTR`
- `EPIRUS_REPO`
- `EPIRUS_SELF_TEACHER`
- `EPIRUS_TEACHER_GATE`
- `EPIRUS_TEACHER_GATE_HP`
- `EPIRUS_TEACHER_GATE_T`

