# 训练侧旋钮册（生成物，勿手改）

> 生成器 `tools/knob-registry.mjs`（`--check` 模式供 CI 防腐烂）。真源有两处、各司其职：
> ① **代码读取**（server/knob-guard.mjs 解析四个入口，读集即闸真正认的集合）；
> ② **注解**（`tools/train-3p.mjs` 的 `SELF_ENV_KEYS` 行尾注释——注解住在读取处旁边，删旋钮时自然消失）。
> 改了任何一处的 env 读取 / 注解 ⇒ 跑 `node tools/knob-registry.mjs` 重生成；CI 每次 push 都会 `--check`。
> 数据账：全集 245 ‖ 在用 223 ‖ 暗键 21 ‖ 孤儿 0 ‖ 在用未登记 105 ‖ 已删除台账 1

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
| `EPIRUS_AGGR_GAMES` | train-3p train-best train-server | — | — | 在用 |  |
| `EPIRUS_ALIAS_TSV` | train-3p train-best train-fast | — | — | 在用 |  |
| `EPIRUS_ALLOW_DARK` | train-3p train-best train-fast train-server | — | — | 在用 |  |
| `EPIRUS_ALLOW_HEALTH_FAIL` | train-server | — | — | 在用 |  |
| `EPIRUS_ANCHOR` | train-3p | Y | — | 在用 |  |
| `EPIRUS_ANCHOR_TO` | train-3p | Y | — | 在用 |  |
| `EPIRUS_ARCH2` | train-3p | Y | — | 在用 | §E821（10-28 傍晚 · 千问）：2.0 架构原型 + 段感知/扁平变异算子档（默认关 ⇒ 逐字回到 v7） |
| `EPIRUS_ARM` | train-3p train-best | Y | — | 在用 |  |
| `EPIRUS_BAND_DIR` | train-3p | Y | — | 在用 |  |
| `EPIRUS_BATCH_MAX` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_BEAD_BOOM_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BEAD_SEED` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BEAD_SEED_KIND` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BEAD_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BEAD_WASTE_W` | train-3p | Y | — | 在用 |  |
| `EPIRUS_BIGCARD_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BIGT_CHAIN_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BIGT_PUSH` | train-3p | Y | — | 在用 | §E275（v1.5.334）：**部署档的 CLI 把手**（大雷默认档 / 摄魂探索软提升）；不设 ⇒ 引擎默认一字不动，设了就由引擎回读 |
| `EPIRUS_BLOCK_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_BREADTH_FATAL` | train-3p | Y | — | 在用 | DS 11-03：名人堂全塌缩时中止（默认关 ⇒ 旧行为逐字同） |
| `EPIRUS_BREADTH_FLOOR` | train-3p | Y | — | 在用 | v1.5.170：广度准入线（§N29，默认关；`SEL_LAND_GAMES` 是它共用的量具局数） |
| `EPIRUS_BREADTH_GAMES` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_BUNDLE_IN` | train-server | — | — | 在用 |  |
| `EPIRUS_BUNDLE_OUT` | train-server | — | — | 在用 |  |
| `EPIRUS_CARD_ABORT` | train-3p | Y | — | 在用 | 11-10（用户：连续一段 <4 卡就杀，不等终局）：训练期 top-1 用卡数连续 K 代低于下限 ⇒ 整臂 exit 13，不写产物 |
| `EPIRUS_CARD_ABORT_GAMES` | train-3p | Y | — | 在用 | 11-10（用户：连续一段 <4 卡就杀，不等终局）：训练期 top-1 用卡数连续 K 代低于下限 ⇒ 整臂 exit 13，不写产物 |
| `EPIRUS_CARD_MIN` | train-3p | Y | — | 在用 | 11-10（用户：连续一段 <4 卡就杀，不等终局）：训练期 top-1 用卡数连续 K 代低于下限 ⇒ 整臂 exit 13，不写产物 |
| `EPIRUS_CHARGE_GAMES` | train-3p train-best train-server | — | — | 在用 |  |
| `EPIRUS_CHARGE_MIN_EP` | train-best train-fast train-server | — | — | 在用 |  |
| `EPIRUS_CHROME` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_CLEAR_W` | train-3p train-best train-fast train-server | Y | — | 在用 |  |
| `EPIRUS_CONV_OFFENSE` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_CONV_RATIO` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_COSTLY_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_COUNTER_OPPS` | train-3p | Y | — | 在用 | v1.5.172：把 G4/G5 的判据原型放上训练桌（§N35，默认关） |
| `EPIRUS_COURSE_BOT` | train-3p | Y | — | 在用 | （ZCode · 11-06 夜）课程席坐谁：Bots 导出的函数名（缺省 pickToolKit） |
| `EPIRUS_COURSE_EVERY` | train-3p | Y | — | 在用 | （ZCode · 11-06 夜）课程席：每第 K 代 fitness 局注一席脚本对手（D-08 机制解；默认 0=关） |
| `EPIRUS_COURSE_PACK` | train-3p | — | — | 在用 |  |
| `EPIRUS_CURSE_PUSH` | train-3p | — | — | 在用 |  |
| `EPIRUS_DEBUG_CDP` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_DEFQ_GAMES` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_DEF_ADAPT_W` | train-3p | Y | — | 在用 |  |
| `EPIRUS_DEF_IDLE_W` | train-3p | Y | — | 在用 |  |
| `EPIRUS_DENSITY_GAMES` | train-3p train-best train-server | — | — | 在用 |  |
| `EPIRUS_DIV_CATW` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_DIV_FORCE_GENS` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_DIV_K` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_DIV_ROLEW` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_DIV_W` | train-3p train-best train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_DRAIN_HEAL_W` | train-3p | Y | — | 在用 |  |
| `EPIRUS_DRAIN_PUSH` | train-3p | Y | — | 在用 | §E275（v1.5.334）：**部署档的 CLI 把手**（大雷默认档 / 摄魂探索软提升）；不设 ⇒ 引擎默认一字不动，设了就由引擎回读 |
| `EPIRUS_ECON_OPPS` | train-3p | Y | — | 在用 | v1.5.325 §E236：把"会攒并且真兑现"的深经济对手放上训练桌（名字表驱动，默认关） |
| `EPIRUS_ECO_CAP` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_ECO_DIVW` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_ECO_TARGET` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_EFFSKILL_MIN` | train-3p | Y | — | 在用 | DS 11-03：有效技能数下限（非ジ份额 ≥0.5% 的键数；0=关） |
| `EPIRUS_EFFSKILL_SHARE` | train-3p | Y | — | 在用 | DS 11-03：上面那条"份额"的阈值（默认 0.005） |
| `EPIRUS_FAMILY_FIELD` | train-3p | Y | — | 在用 | §E798（10-27 夜班）：训练桌形状（k 席被测家族副本 + 其余脚本，k=3 即考卷形状）⇒ 同样带作用计数 |
| `EPIRUS_FEASIBILITY` | train-server | — | — | 在用 |  |
| `EPIRUS_FEASIBILITY_BLOCK` | train-server | — | — | 在用 |  |
| `EPIRUS_FEAS_GAMES` | train-3p train-best train-server | — | — | 在用 |  |
| `EPIRUS_FEAT_MASK` | train-server | — | — | 在用 |  |
| `EPIRUS_FIGHT_DEAL` | train-server | — | FIGHT_ENV_KEYS | 在用 |  |
| `EPIRUS_FIGHT_FIRST` | train-server | — | FIGHT_ENV_KEYS | 在用 |  |
| `EPIRUS_FIGHT_WHISTLE` | train-server | — | FIGHT_ENV_KEYS | 在用 |  |
| `EPIRUS_FITGW` | train-3p | Y | — | 在用 | 11-01 深（PREREG-MERGER §一）：指纹行加 top-3 只测不选的宽读数（默认关） |
| `EPIRUS_FIT_CAL` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_FIT_CHAMP` | train-3p | — | — | 在用 |  |
| `EPIRUS_FIT_CHAMP_EVERY` | train-3p | — | — | 在用 |  |
| `EPIRUS_FIT_G_FLOOR` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_FIT_G_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_FIT_TAIL_Q` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_FIT_TAIL_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_FOCUS_W` | train-3p | Y | — | 在用 | DS 11-08 夜：集火奖励（连续命中同一目标；默认 0 ⇒ gFit 逐字不变）   // DS 11-08 晚（用户「2.0 要全方位优于 v7」）：把 pickFarmer（只攒钱席）追加进训练桌，补「场B 清场」在 fitness 里的缺失（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_GA_BAND` | train-3p | Y | — | 在用 |  |
| `EPIRUS_GA_GATE` | train-3p | Y | — | 在用 |  |
| `EPIRUS_GA_GATE_GAMES` | train-3p | Y | — | 在用 |  |
| `EPIRUS_GUARD_GAMES` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_GUARD_HIT_W` | train-3p | Y | — | 在用 |  |
| `EPIRUS_GUARD_SEEDS` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_HALL_DEDUP` | train-3p | Y | — | 在用 | v1.7.92 §E635：名人堂按 wid 去重（同一粒权重只占一席；默认关 ⇒ 榜的形状一字不变） |
| `EPIRUS_HALL_SEED` | train-3p | Y | — | 在用 | v1.5.277 §E114：把起点补进终局重验的候选池（默认关） |
| `EPIRUS_HALL_TRACE` | train-3p | Y | — | 在用 |  |
| `EPIRUS_HALL_TRACE_OUT` | train-3p | Y | — | 在用 |  |
| `EPIRUS_HALL_TRACE_PROBE` | train-3p | Y | — | 在用 | ⤵ 11-01 深：M-1 连续下限罚（默认 0） |
| `EPIRUS_HOARD_CAP_MULT` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_HOARD_LEFTOVER` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_HOLDOUT_SEG` | train-3p | Y | — | 在用 | （ZCode · 11-03 凌晨）E3 存段：每 K 代快照当代最优粒落 band 目录（默认 0=关；只存盘不改当选） |
| `EPIRUS_HOLO2PROTO` | train-3p | Y | — | 在用 | v1.7.4（10-13 夜班 S2a）：训练期把"送盾"改写成"给自己上原型制御"（决策期档，`policy.js` 的 `setHolo2Proto`） |
| `EPIRUS_HOTSTART` | train-3p train-best | Y | — | 在用 |  |
| `EPIRUS_HPSEED` | train-3p | Y | — | 在用 | （ZCode · 11-02 深夜）残血开局课程——摄魂 (b) 线（默认 0=关；p 比例局全席对称压 HP=min(2,modeHp-1)） |
| `EPIRUS_IMIT_FRAC` | train-3p train-server | — | — | 在用 |  |
| `EPIRUS_IMIT_GENS` | train-best train-fast train-server | — | — | 在用 |  |
| `EPIRUS_IMIT_ONLY` | train-3p train-best train-fast train-server | — | — | 在用 |  |
| `EPIRUS_IMIT_OVERRIDE` | train-3p train-server | — | — | 在用 |  |
| `EPIRUS_IMIT_PLAN` | train-best train-fast train-server | — | — | 在用 |  |
| `EPIRUS_IMIT_SUBONLY` | train-3p | — | — | 在用 |  |
| `EPIRUS_IMIT_SUB_ONLY` | train-best train-fast train-server | — | — | 在用 |  |
| `EPIRUS_IMIT_TEACHER` | train-3p train-server | — | — | 在用 |  |
| `EPIRUS_INIT_ACT_K` | train-3p | — | — | 在用 |  |
| `EPIRUS_INIT_SCALE` | train-3p | Y | — | 在用 | 11-04 波 H（千问）：随机起点幅度（缺省 0.25 = 出厂） |
| `EPIRUS_INSTR` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_JSON` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_KILL_FIELD` | train-3p train-server | Y | TRAIN_ENV_KEYS | 在用 | v1.5.160：收割席注入（qoder §N13 · 用户裁定"场B 缺口走对手池"）⇒ 带**开火计数**才敢算"已下达" |
| `EPIRUS_KILL_REWARD` | train-3p | Y | — | 在用 | v1.5.194：击杀奖励规则训练（0924 夜 · 内存补丁，不动仓库引擎） |
| `EPIRUS_KR_TRANSFER` | train-3p | Y | — | 在用 | v1.5.194：击杀奖励规则训练（0924 夜 · 内存补丁，不动仓库引擎） |
| `EPIRUS_LASER_W` | train-3p train-server | — | — | 在用 |  |
| `EPIRUS_LOG_DEFAULT_OUT` | train-3p | — | — | 在用 |  |
| `EPIRUS_MIX2_EVERY` | train-3p | Y | — | 在用 | （ZCode · 11-06 夜）fitness 每第 K 局换 2 人桌——同代混桌（DS 待办 2；默认 0=关） |
| `EPIRUS_MIX8` | train-3p | Y | — | 在用 | （ZCode · 11-02 深夜）fitness 每第 K 局换 8 人桌——地雷 5P+ 高性价比（用户裁定），8P 局照常进 fit（默认 0=关） |
| `EPIRUS_MIXHP_EVERY` | train-3p | Y | — | 在用 | （ZCode · 11-06 深夜）桌形混合：每第 K 局换对偶桌形（multi↔long；3血适应，默认 0=关） |
| `EPIRUS_MUT_MODE` | train-3p | Y | — | 在用 | §E821（10-28 傍晚 · 千问）：2.0 架构原型 + 段感知/扁平变异算子档（默认关 ⇒ 逐字回到 v7） |
| `EPIRUS_NORM` | train-3p | — | — | 在用 |  |
| `EPIRUS_NO_DEFQ` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_NO_GUARD` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_NO_PROXY` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_NO_SHAPE` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_OPP_BLOCK` | train-3p | Y | — | 在用 | v1.5.279 §E124：整桌同原型（改"桌子的形状"，不改名单；默认关 ⇒ 逐字可逆） |
| `EPIRUS_OPP_HUMAN` | train-3p | Y | — | 在用 | v1.6.60：把**人类形状替身**放上训练桌（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_OPP_HUMAN_FILE` | train-3p | Y | — | 在用 | v1.6.60：把**人类形状替身**放上训练桌（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_OPP_HUMAN_SRC` | train-3p | Y | — | 在用 | v1.6.60：把**人类形状替身**放上训练桌（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_OPP_HUMAN_TGT` | train-3p | Y | — | 在用 | v1.6.60：把**人类形状替身**放上训练桌（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_OPP_N` | train-server | — | — | 在用 |  |
| `EPIRUS_OPP_SWEEP` | train-3p | Y | — | 在用 | DS 11-03：对手池每代轮齐（旧公式每代只覆盖 11 位；默认关） |
| `EPIRUS_PACK_OPP` | train-3p | — | — | 在用 |  |
| `EPIRUS_PAIRED` | train-3p | Y | — | 在用 |  |
| `EPIRUS_PASSIVE_FIELD` | — | — | — | 已删除（台账在册） |  |
| `EPIRUS_PASSIVE_OPPS` | train-3p | Y | — | 在用 | DS 11-08 夜：集火奖励（连续命中同一目标；默认 0 ⇒ gFit 逐字不变）   // DS 11-08 晚（用户「2.0 要全方位优于 v7」）：把 pickFarmer（只攒钱席）追加进训练桌，补「场B 清场」在 fitness 里的缺失（默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_POOL_OPPS` | train-3p | Y | — | 在用 | v1.7.83 §E631：把**冠军池成员**放上训练桌（枚数 + 档名驱动，默认关 ⇒ OPPS 一字不变）；11-07 ZCode：表路径可指（2P 产线 = pool-members-2p.tsv，3P 成员在 1v1 是分布外） |
| `EPIRUS_POOL_OPPS_TABLE` | train-3p | Y | — | 在用 | v1.7.83 §E631：把**冠军池成员**放上训练桌（枚数 + 档名驱动，默认关 ⇒ OPPS 一字不变）；11-07 ZCode：表路径可指（2P 产线 = pool-members-2p.tsv，3P 成员在 1v1 是分布外） |
| `EPIRUS_POOL_OPPS_TIER` | train-3p | Y | — | 在用 | v1.7.83 §E631：把**冠军池成员**放上训练桌（枚数 + 档名驱动，默认关 ⇒ OPPS 一字不变）；11-07 ZCode：表路径可指（2P 产线 = pool-members-2p.tsv，3P 成员在 1v1 是分布外） |
| `EPIRUS_POPSTAT` | train-3p | Y | — | 在用 | #46（11-03 晚）：逐代**种群统计量** JSONL（默认 0=关 ⇒ 一行不写、gen 行逐字不变） |
| `EPIRUS_POPSTAT_K` | train-3p | Y | — | 在用 | #46（11-03 晚）：逐代**种群统计量** JSONL（默认 0=关 ⇒ 一行不写、gen 行逐字不变） |
| `EPIRUS_POPSTAT_OUT` | train-3p | Y | — | 在用 | #46（11-03 晚）：逐代**种群统计量** JSONL（默认 0=关 ⇒ 一行不写、gen 行逐字不变） |
| `EPIRUS_PROXY_GAMES` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_PUBLISH` | train-3p train-fast | Y | — | 在用 |  |
| `EPIRUS_REFLECT_W` | train-3p | Y | — | 在用 |  |
| `EPIRUS_REGEN_GENS` | train-server | — | — | 在用 |  |
| `EPIRUS_REGEN_SLICE` | train-3p | — | — | 在用 |  |
| `EPIRUS_REPO` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_RING_FORCE_EPS` | train-server | — | — | 在用 |  |
| `EPIRUS_RING_FORCE_UNTIL` | train-server | — | — | 在用 |  |
| `EPIRUS_RING_OPPS` | train-3p | Y | — | 在用 | v1.5.285 §E127：把会放聚能环的对手放上训练桌（默认关；判据用现成的 probe-dead-term） |
| `EPIRUS_RING_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_S4_GAMES` | train-server | — | — | 在用 |  |
| `EPIRUS_S4_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_SEAT_GAMES` | train-3p train-best train-server | — | — | 在用 |  |
| `EPIRUS_SEED` | train-3p train-best train-fast | Y | — | 在用 |  |
| `EPIRUS_SEED0` | train-server | — | — | 在用 |  |
| `EPIRUS_SEEDPACK` | train-3p | Y | — | 在用 |  |
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
| `EPIRUS_SEL_G45` | train-3p | — | — | 在用 |  |
| `EPIRUS_SEL_G4LONG` | train-3p | — | — | 在用 |  |
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
| `EPIRUS_SEL_TWO_STAGE` | train-3p | — | — | 在用 |  |
| `EPIRUS_SEQ_KIND` | train-3p | Y | — | 在用 | v1.8.37（10-25 ZCode · §二十一）：序列奖励的**珠种档**（'elec' 缺省 = 电磁炮原义；'boom' = 蓄爆珠→激光眼） |
| `EPIRUS_SEQ_W` | train-3p | Y | — | 在用 | v1.5.229：序列奖励（"蓄能[电珠]→下一回合电磁炮"完成时 +W ep；同样只在内存里，默认 0=关） |
| `EPIRUS_SHAPE_GAMES` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_SIGMA_DECAY` | train-3p | — | — | 在用 |  |
| `EPIRUS_SIGMA_FLOOR` | train-3p | — | — | 在用 |  |
| `EPIRUS_SIGMA_STALL` | train-3p | — | — | 在用 |  |
| `EPIRUS_SNIPER_GAMES` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_STALL_ABORT` | train-3p | Y | — | 在用 |  |
| `EPIRUS_STOCK_BONUS` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_STYLE_FRAC` | train-3p | — | — | 在用 |  |
| `EPIRUS_STYLE_GAMES` | train-server | — | — | 在用 |  |
| `EPIRUS_STYLE_TABLE` | train-3p | — | — | 在用 |  |
| `EPIRUS_STYLE_W` | train-server | — | — | 在用 |  |
| `EPIRUS_SUBSIDY_EP` | train-server | — | — | 在用 |  |
| `EPIRUS_SUBSIDY_H` | train-server | — | — | 在用 |  |
| `EPIRUS_SUBSIDY_MIN` | train-server | — | — | 在用 |  |
| `EPIRUS_SUB_BEAD` | train-3p train-best train-fast train-server | Y | — | 在用 |  |
| `EPIRUS_SUB_BEAD_KIND` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_SUPPORT_PRIOR` | train-3p | — | — | 在用 |  |
| `EPIRUS_T3P_BASELINE` | train-3p | — | — | 在用 |  |
| `EPIRUS_T3P_OUT` | train-3p | — | — | 在用 |  |
| `EPIRUS_TB3P` | train-best | — | — | 在用 |  |
| `EPIRUS_TB3P_GAMES` | train-best | — | — | 在用 |  |
| `EPIRUS_TB_OUT` | train-best | — | — | 在用 |  |
| `EPIRUS_TEACHER_GATE` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_TEACHER_GATE_HP` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_TEACHER_GATE_T` | — | — | — | 暗键（被提及无人读） |  |
| `EPIRUS_TGT_W` | train-server | — | — | 在用 |  |
| `EPIRUS_TOOLKIT_OPPS` | train-3p | Y | — | 在用 | §E676（10-21 早班）：把杂货铺（计划层 P0~P7）放上训练桌（份数驱动，默认关 ⇒ OPPS 一字不变） |
| `EPIRUS_TRAIN_EPS` | train-3p | — | — | 在用 |  |
| `EPIRUS_TRAIN_EPS_K` | train-3p | — | — | 在用 |  |
| `EPIRUS_TRAIN_EPS_MODE` | train-3p | — | — | 在用 |  |
| `EPIRUS_TRAIN_MODE` | train-3p train-server | Y | TRAIN_ENV_KEYS | 在用 | v1.5.169：训练模式（§N28 · 用户"炼一个 5 血长程通吃其他模式"）⇒ 认不了就 exit 7，不许静默退回 multi |
| `EPIRUS_TRAIN_SEAT_GAMES` | train-best train-fast train-server | — | — | 在用 |  |
| `EPIRUS_TRAIN_TEMP` | train-3p | — | — | 在用 |  |
| `EPIRUS_TRIPLET` | train-3p | — | — | 在用 |  |
| `EPIRUS_TRIPLET_LOG` | train-3p | — | — | 在用 |  |
| `EPIRUS_VOID_IDEAL_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_VOID_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_WALL_BREAK_W` | train-3p | Y | — | 在用 |  |
| `EPIRUS_WALL_FILTER` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_WALL_GAMES` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_WALL_MS` | train-server | — | — | 在用 |  |
| `EPIRUS_WIDE_FINAL` | train-3p | Y | — | 在用 | 11-01 深（ZCode · PREREG-2026-11-01-WIDE-FINAL）：v4 终局同尺（默认关）   // 11-01 晚（ZCode · 千问交接 §五.3）：逐代名人堂/门槛指纹落盘（默认关 ⇒ 一条行为不变）   // 千问 §十一 C：演化期健康门槛（形状搬自 `evo.js:3952`）+ 它的测量长度 + 带内取宽的带宽 ‖ GA 臂级空转终止（`EPIRUS_STALL_ABORT` 已在 §六② 实现，名单此前漏登记） |
| `EPIRUS_WIDTH_LAND_W` | train-3p | Y | — | 在用 |  |
| `EPIRUS_WIDTH_W` | train-server | — | ECON_ENV_KEYS | 在用 |  |
| `EPIRUS_WORKERS` | train-best train-fast train-server | — | — | 在用 |  |
| `EPIRUS_WR_TOL` | train-server | — | — | 在用 |  |
| `EPIRUS_XN2G` | train-3p | Y | — | 在用 |  |
| `EPIRUS_XN2REF` | train-3p | Y | — | 在用 |  |
| `EPIRUS_XN2SCRIPTS` | train-3p | Y | — | 在用 |  |
| `EPIRUS_XN2W` | train-3p | Y | — | 在用 |  |

## 在用未登记（补 SELF_ENV_KEYS 的清单）

- `EPIRUS_AGGR_GAMES` ← train-3p train-best train-server
- `EPIRUS_ALIAS_TSV` ← train-3p train-best train-fast
- `EPIRUS_ALLOW_DARK` ← train-3p train-best train-fast train-server
- `EPIRUS_ALLOW_HEALTH_FAIL` ← train-server
- `EPIRUS_BEAD_BOOM_W` ← train-server
- `EPIRUS_BEAD_SEED` ← train-server
- `EPIRUS_BEAD_SEED_KIND` ← train-server
- `EPIRUS_BEAD_W` ← train-server
- `EPIRUS_BIGCARD_W` ← train-server
- `EPIRUS_BIGT_CHAIN_W` ← train-server
- `EPIRUS_BLOCK_W` ← train-server
- `EPIRUS_BUNDLE_IN` ← train-server
- `EPIRUS_BUNDLE_OUT` ← train-server
- `EPIRUS_CHARGE_GAMES` ← train-3p train-best train-server
- `EPIRUS_CHARGE_MIN_EP` ← train-best train-fast train-server
- `EPIRUS_CONV_OFFENSE` ← train-server
- `EPIRUS_CONV_RATIO` ← train-server
- `EPIRUS_COSTLY_W` ← train-server
- `EPIRUS_COURSE_PACK` ← train-3p
- `EPIRUS_CURSE_PUSH` ← train-3p
- `EPIRUS_DENSITY_GAMES` ← train-3p train-best train-server
- `EPIRUS_DIV_CATW` ← train-server
- `EPIRUS_DIV_FORCE_GENS` ← train-server
- `EPIRUS_DIV_K` ← train-server
- `EPIRUS_DIV_ROLEW` ← train-server
- `EPIRUS_DIV_W` ← train-3p train-best train-server
- `EPIRUS_ECO_CAP` ← train-server
- `EPIRUS_ECO_DIVW` ← train-server
- `EPIRUS_ECO_TARGET` ← train-server
- `EPIRUS_FEASIBILITY` ← train-server
- `EPIRUS_FEASIBILITY_BLOCK` ← train-server
- `EPIRUS_FEAS_GAMES` ← train-3p train-best train-server
- `EPIRUS_FEAT_MASK` ← train-server
- `EPIRUS_FIGHT_DEAL` ← train-server
- `EPIRUS_FIGHT_FIRST` ← train-server
- `EPIRUS_FIGHT_WHISTLE` ← train-server
- `EPIRUS_FIT_CAL` ← train-server
- `EPIRUS_FIT_CHAMP` ← train-3p
- `EPIRUS_FIT_CHAMP_EVERY` ← train-3p
- `EPIRUS_FIT_G_FLOOR` ← train-server
- `EPIRUS_FIT_G_W` ← train-server
- `EPIRUS_FIT_TAIL_Q` ← train-server
- `EPIRUS_FIT_TAIL_W` ← train-server
- `EPIRUS_HOARD_CAP_MULT` ← train-server
- `EPIRUS_HOARD_LEFTOVER` ← train-server
- `EPIRUS_IMIT_FRAC` ← train-3p train-server
- `EPIRUS_IMIT_GENS` ← train-best train-fast train-server
- `EPIRUS_IMIT_ONLY` ← train-3p train-best train-fast train-server
- `EPIRUS_IMIT_OVERRIDE` ← train-3p train-server
- `EPIRUS_IMIT_PLAN` ← train-best train-fast train-server
- `EPIRUS_IMIT_SUBONLY` ← train-3p
- `EPIRUS_IMIT_SUB_ONLY` ← train-best train-fast train-server
- `EPIRUS_IMIT_TEACHER` ← train-3p train-server
- `EPIRUS_INIT_ACT_K` ← train-3p
- `EPIRUS_LASER_W` ← train-3p train-server
- `EPIRUS_LOG_DEFAULT_OUT` ← train-3p
- `EPIRUS_NORM` ← train-3p
- `EPIRUS_OPP_N` ← train-server
- `EPIRUS_PACK_OPP` ← train-3p
- `EPIRUS_REGEN_GENS` ← train-server
- `EPIRUS_REGEN_SLICE` ← train-3p
- `EPIRUS_RING_FORCE_EPS` ← train-server
- `EPIRUS_RING_FORCE_UNTIL` ← train-server
- `EPIRUS_RING_W` ← train-server
- `EPIRUS_S4_GAMES` ← train-server
- `EPIRUS_S4_W` ← train-server
- `EPIRUS_SEAT_GAMES` ← train-3p train-best train-server
- `EPIRUS_SEED0` ← train-server
- `EPIRUS_SEL_G45` ← train-3p
- `EPIRUS_SEL_G4LONG` ← train-3p
- `EPIRUS_SEL_TWO_STAGE` ← train-3p
- `EPIRUS_SIGMA_DECAY` ← train-3p
- `EPIRUS_SIGMA_FLOOR` ← train-3p
- `EPIRUS_SIGMA_STALL` ← train-3p
- `EPIRUS_STOCK_BONUS` ← train-server
- `EPIRUS_STYLE_FRAC` ← train-3p
- `EPIRUS_STYLE_GAMES` ← train-server
- `EPIRUS_STYLE_TABLE` ← train-3p
- `EPIRUS_STYLE_W` ← train-server
- `EPIRUS_SUBSIDY_EP` ← train-server
- `EPIRUS_SUBSIDY_H` ← train-server
- `EPIRUS_SUBSIDY_MIN` ← train-server
- `EPIRUS_SUB_BEAD_KIND` ← train-server
- `EPIRUS_SUPPORT_PRIOR` ← train-3p
- `EPIRUS_T3P_BASELINE` ← train-3p
- `EPIRUS_T3P_OUT` ← train-3p
- `EPIRUS_TB3P` ← train-best
- `EPIRUS_TB3P_GAMES` ← train-best
- `EPIRUS_TB_OUT` ← train-best
- `EPIRUS_TGT_W` ← train-server
- `EPIRUS_TRAIN_EPS` ← train-3p
- `EPIRUS_TRAIN_EPS_K` ← train-3p
- `EPIRUS_TRAIN_EPS_MODE` ← train-3p
- `EPIRUS_TRAIN_SEAT_GAMES` ← train-best train-fast train-server
- `EPIRUS_TRAIN_TEMP` ← train-3p
- `EPIRUS_TRIPLET` ← train-3p
- `EPIRUS_TRIPLET_LOG` ← train-3p
- `EPIRUS_VOID_IDEAL_W` ← train-server
- `EPIRUS_VOID_W` ← train-server
- `EPIRUS_WALL_FILTER` ← train-server
- `EPIRUS_WALL_GAMES` ← train-server
- `EPIRUS_WALL_MS` ← train-server
- `EPIRUS_WIDTH_W` ← train-server
- `EPIRUS_WORKERS` ← train-best train-fast train-server
- `EPIRUS_WR_TOL` ← train-server

## 暗键（删除候选，处置前先查启动器）

- `EPIRUS_BATCH_MAX`
- `EPIRUS_BREADTH_GAMES`
- `EPIRUS_CHROME`
- `EPIRUS_DEBUG_CDP`
- `EPIRUS_DEFQ_GAMES`
- `EPIRUS_GUARD_GAMES`
- `EPIRUS_GUARD_SEEDS`
- `EPIRUS_INSTR`
- `EPIRUS_JSON`
- `EPIRUS_NO_DEFQ`
- `EPIRUS_NO_GUARD`
- `EPIRUS_NO_PROXY`
- `EPIRUS_NO_SHAPE`
- `EPIRUS_PROXY_GAMES`
- `EPIRUS_REPO`
- `EPIRUS_SELF_TEACHER`
- `EPIRUS_SHAPE_GAMES`
- `EPIRUS_SNIPER_GAMES`
- `EPIRUS_TEACHER_GATE`
- `EPIRUS_TEACHER_GATE_HP`
- `EPIRUS_TEACHER_GATE_T`

