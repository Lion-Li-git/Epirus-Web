# PROPOSAL — 2026-11-15 `--collectJobs=W` 轮内采集进程池（训练侧结构）

> 定位：提案，未实施。用户 2026-11-15 转述 GLM 的“单臂效率”方案；按 AGENTS 铁律（动训练脚本结构先提案）先写清楚收益、代价与验收。

## 背景

- T2-1S 的 65 分钟大头是 **空 transfer 配额 grind**：`rareOnly` 对着教师轨迹里根本不存在的键磨局；这是零代码的 `rareOnly` 密度规则要解决的，不需要进程池。
- 现有 shaped 臂：1200 组 / 400 步约 50 秒，1500 组 / 500 步约 90 秒；collection 与 400–500 步反传相比，collection 不是绝对大头。
- 所以先做**计时**：在 `collectInto` 外层加只读计时（不改进度），量 collection / train 的墙钟占比；只有 collection >50% 的臂才值得上 W>1。

## 设计（缺省 W=1 逐字不变）

1. `--collectJobs=W`（W=1..8；缺省 1）：仅对 `dagger=0` 的教师自访采集生效；DAgger 轮先不做（学生态依赖上一轮训练结果，跨 worker 同步成本高）。
2. 父进程按桌形/组号切 shard：每个 worker 拿 `shardIdx`、`idBase + shardIdx*1e6`、组配额；`A2`/教师/沙箱各自新建（只读）。
3. 每个 worker 只返回 `groups`（`tape` 用 `v8.serialize`，保留 `Float64Array`；JSON 会丢类型）；`LABEL`/`PLAY` 在 worker 内累计后合并。
4. 父进程按 shard 顺序合并，再走现有 75/25 切分与训练；不改变组内容与顺序（同 seed 下 W 只影响墙钟）。
5. 失败策略：任一 worker 非零退出/反序列化失败 ⇒ 响亮退出，不静默回 W=1。

## 风险与边界

- tape 序列化体积/CPU 可能吃掉并行收益；先量单组 tape 字节与序列化耗时。
- W 份沙箱/教师内存（每份约几十 MB）⇒ W≤4 起步，按机器内存设上限。
- `oracleDef` 钩子、rare-only 过滤必须在 worker 内完成（父进程看不到轨迹）；`LABEL` 计数只作诊断。
- 可复现性验收：同 `seed`、同 `groups`，W=1 与 W=4 合并后的 `groups` 逐字节/逐字段相同（`v8.serialize` 比较），否则拒绝。

## 验收

- 计时：collection 占比 ≥50% 的臂才有资格上 W>1。
- 正确性：W=4 与 W=1 的留出似然/同枚 top-1 逐位相同（同 seed）。
- 效率：目标 collection 墙钟 ≤ 1/W 的 60%（IPC 开销上限）；否则回退 W=1。

## 建议顺序

1. 先落 `rareOnly` 密度规则（零代码/配置层）：只对有自然轨迹密度的键开；空键道用 oracleDef 或直接不开。
2. 加 `collectInto` 计时，确认占比。
3. 若占比成立，再实现 `--collectJobs`（worker_threads 优先，repo 已有并行池先例）。
