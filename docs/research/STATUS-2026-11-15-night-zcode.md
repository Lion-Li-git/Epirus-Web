# STATUS · 2026-11-15 深夜（ZCode · 接 11-14 夜 gemini obs6 批）

> ⚠ **时钟勘误（07:31 补）**：本班 shell `date` 时区偏早 ~2.5h ⇒ 正文时间标签（02:4x/03:1x 等）比真实
> 本机时刻早同量；**真值以 `git log --date=iso-local` 为准**。门禁戳（07:31）与 pool-members addedAt
> 是对的。

> 本班主题：①**图修根**（用户令：老版本图应冻结 + D3 进图 + 开新族）②**蒸馏第五轮**（用户课程裁定
> 五臂全谱）。主账见 [FINDING-2026-11-15-night-distill-curriculum-zcode.md](FINDING-2026-11-15-night-distill-curriculum-zcode.md)。

## 一、图修根批（`78cf557e` + `2e733642`，gate-all --auto 5 道全绿）

1. **1.8 旧图冒新点**（用户报告）根因 = add-point 缺省把族名写进 registry lineage 列（违反 11-07
   「血统列不再兼记产物来源」裁定）⇒ 19 枚 2.0 新点带 lin 被页面 keep 式 `(st.batch!=='2.0' && !!d.lin)`
   钉进旧图。三修：数据清账 20 行（族名挪 fam_label）‖ add-point 缺省 lineage 留空 ‖ viewer keep 式加
   `batchOf(d)!=='2.0'` 防线 + 页检**新断言「1.8 模式零 2.0 点」**（99→100 PASS）。proj 老行坐标
   重烘前后逐位同（冻结本就成立，已验证非侥幸）。
2. **fam23 开族「2.0 obs6 v7 蒸馏（11-14）」**：D3 进图（24 读数，页检 99/0）+ E4c/E5c 挪入 +
   父边补 OBS6D3 实线（wid `3a4c893b9a286477` 手工核验）——A4-S1000→D3→E4c/E5c 蒸馏链全实线。
   fam22 标签统一回「无教师冷启动」。**今晚起的蒸馏/后训练产物一律归 fam23**（用户裁定）。
3. supfit-gd meta writer 补 teacher2/3/4 九字段 + 25 枚臂 meta + gemini mem-probe-e4 探针入库（`78cf557e`）。

## 二、蒸馏第五轮（用户五裁定：Tier0 短程保底→Tier1 环/大雷/电磁炮→Tier2 转伤/防御/摄魂；教师自由探索）

- **教师谱**：K2 唯一全谱（11 卡，long 桌 railgun4/bigT2/ring2）；CB3 摄魂+大雷道；GD16m 链式
  （ring 19%/bigT 6%/charge 经济）；GD3ALL 判负（我方夹具塌双招）；gemini 的 92 系教师确证"短包"
  （特殊键全 0）。**电磁炮=railgun、过载炮=cannon**（用户纠正，SK 表已对齐：JI CHARGE RING GUN SWORD
  TANK SNIPE GUARD REFLECT BAGUA SHIFT JINSHIELD ARMOR PROTO HOLO DRAIN RAILGUN MINI_T BIG_T ROD
  LASER_EYE TRANSFER CURSE FIRESTORM MINE TAUNT CANNON PURIFY DUAL_GUN MIRROR）。
- **五臂全景**：E6a 宽极（10 卡/G 7.88 全场最高/ring+holo 落地 6%，强度洗到 0.0251 **且 Gap +29.8
  背诵判负**）‖ E6b 同配方 D3 基座（0.0563）‖ E6c 强度优先（0.2490/9 卡/snipe 8%，Gap −26.8 干净）‖
  E6d 两段式回填（0.2751，Gap −18.3）‖ E6e 链道臂（G 破但对包 88.7%，Gap −25.9）。**无一臂同保两端**
  ——单包强且宽在现配置下是跷跷板。
- **两条定律入账**：①t2frac=t3frac 相同 ⇒ Bresnham 同穿低号饿死（E6c 事故）②**标签跟随轨迹**——
  键道教师救不了轨迹不去的状态（GD16m 在 E5c 轨迹上 8086 咨询命中 1）；链式技能要走
  「GD16m 塑轨迹 → v7blk1 回填」两段（E6d 证回填段 11× 可行）。
- 泛化探针第三次实战拦截（mem-probe-e6，同 H 集 Gap 可比，对照 −10.9 逐位复现）。
- **promote 体检 blocker 轮换**：E6c/d 的 **G4[multi] 只枪 PASS**（E5c 挂整轮的 D-03 入池门首次清账），
  但 **G5 破防反射 ×4 FAIL**（防席夺冠 45-55%）——强度回填（v7blk1）把 D3 防御道的破防洗掉了。
  强度↔破防与宽↔强同构互斥。

## 三、提交账（本班）

| commit | 内容 |
|---|---|
| `78cf557e` | 训练侧复现账：meta 九字段 + 25 枚臂 meta + mem-probe-e4 |
| `2e733642` | 图修根：lin 泄漏三修 + fam23 开族 + D3/E4c/E5c 实线链 + PLAN 落盘 |
| `481a58e5` | E6 五臂产物 + meta（配方全落盘）+ mem-probe-e6 |
| `c22b1107` | 第五轮收口记账 + E6a 背诵判负 + blocker 轮换律 |
| `368c22f4` | 续班批一：E7 对手表轮换 / E8 全桌形矩阵 / PG 首批（pg-train 补 --arenaPool/--arenaShapes） |
| 〔终笔〕 | E9+P4-S4000 双旗进图 fam23 + FINDING 终版 + pg-train E9/P4 产物 |

## 三′、终选（03:1x）：双旗进图 fam23（100 PASS ×2 / shot 98/0 / 父边自动实线连 OBS6E5c）

| 包 | C5长 | 用卡 | G 门 | G4 | G5 | Gap | 要点 |
|---|---:|---:|---|---|---|---:|---|
| **OBS6P4-S4000** | **0.3268 全晚纪录（超 E5c）** | 8 | 6.81/6.89 ✓✓ | multi 60.7 骑线 | ×4 PASS | **−37.8 全晚最净** | PG+KL 锚+gauntlet+全矩阵 |
| **OBS6E9** | 0.2759 | **11** | **7.87/6.88** | ✓✓ | ✓✓×4 | −1.3 | 自蒸馏+攻势道+矩阵——**史上首枚强/宽/G/G4/G5/Gap 六轴同持** |

**续班三条定律**：①病根=教师风格（K2 线 Gap 全正 +14.7~+55.7 → 全线停用；v7blk1/E5c-自蒸馏线全干净）
②桌形矩阵（2-8p × 3/4/5血）真产出链式状态（CB3 键道命中 1→14994、charge 标签 34→433）但部署仍需
PG 把 charge 经济长在学生身上（P 线纪律蓄 0.025/局已现）③**同对手池，PG+锚=干净，蒸馏采集=背诵**
（P4 −37.8 vs E6a +29.8）。工具：pg-train 补 --arenaPool/--arenaShapes（roster-lib 单源，缺省逐字不变）；
mem-probe-e6 --subj CLI 化 + fork 透传修复。

## 三′′、靶向突袭批 + 池普查（04:0x）

- **池覆盖普查**（`cov-census-1115.mjs`，17 包）：**tank/big_t/transfer/drain/T3 全库 0 覆盖**、
  ring 3/17、railgun 2/17——D-02 池并集路线的洞分层清楚；T0 的坦克真空是计划外发现。
- **E11 拿下 transfer 首载体**（标签 1008/部署 4%）但 **Gap +10.0 ⇒ 自蒸馏放大律**（P9 本体 −18.8，
  P9 自蒸馏 +10.0；练过考卷的血脉不要再自蒸馏——E9 干净正因 E5c 基座本就干净）。
- **E10 两段式机制通**（GD16m 键道 1→52、charge 部署 1%）产量小；**PG10 经济原生**（charge multi
  20%）但链转化 0%；**E12 大雷专项**（bigtfocus+8p）键道命中仅 3——**链式落地 = 经济（已通）→
  键道状态（轨迹设计，未解）→ 转化（机制通）的多代工程**。

## 三′′′、三旗进池（07:3x，用户裁定"都可以进池"）——hard 9/soft 9

`pool-members.tsv` +3 行 → `build-pool-bundle.mjs` 重烘（18 枚 {hard 9, soft 9}）→ `pool-sync.mjs`
图池层同步 → 门禁 6 道全绿（D234 ① 十条腿全过；⑩a 池层同步是最后一腿）。

| 包 | tier | invited | verdict | 依据 |
|---|---|---|---|---|
| **OBS6E9** | **hard** | 0 | pass | 全门 G4✓G5✓×4 / G 7.87+6.88 / 11 卡 / Gap −1.3 |
| **OBS6P9-S4000** | **hard** | 0 | pass | 全门 ×6 / C5长 0.2956 / Gap −18.8 / charge 25% |
| **OBS6P4-S4000** | **hard** | **1** | block（仅 G4[multi] 60.7 骑线 0.7pt） | C5长 0.3268 全晚纪录 / Gap −37.8 最净——**KD-G2 invited 先例**（10-21 裁定 A 同族点名越过） |

强度带排序含义：P4-S4000 = 强度极（考卷最强席）、P9-S4000 = 全门强度席、E9 = 宽度席（11 卡全晚最宽）。
⚠ D234 ① 的坑：`docs/artifacts/` 在 .gitignore:137 里 ⇒ 池成员 .bak 必须 `git add -f`（gemini 的
E4c/E5c 同款；直接 `git add` 会静默失败——本班被门咬住后补）。

## 三⁴、分层技能学习进度盘点（07:4x · 用户问"做到什么程度了"）

| 层 | 技能 | 状态 | 载体/证据 |
|---|---|---|---|
| **T0 短程保底** | gun/sword/snipe | **✅ 已保住** | 全部 obs6 产物カ谱 gun 5-9%/sword 8-29%/snipe 2-9%（E9/P 线全程在谱）；**tank ⚠ 全库 0/17**——真空待补 |
| **T1 环/大雷/电磁炮** | ring/big_t/railgun | **🔶 经济通、键道状态未解、转化机制通** | charge 经济在学生身上长出来（P8 13%/P9s2 25%/P10 multi 20%——PG+塑形 ✓）；GD16m 键道命中随轨迹密度走（1→52→14994 次咨询）但**部署仍 0-1%**；转化=多代工程（课表 PLAN-…-tier1 §二） |
| **T2 转伤/防御/摄魂** | transfer/drain/holo/guard/reflect/bagua | **🟢 transfer 首载体落地 + 防御系健康** | transfer 1203 标签/部署 3-4%（T21/T21R，干净血统复现）；guard/reflect/bagua 在全部三旗 ✓✓；**drain ⚠ 仅 CB3 载体**（obs6 线 0）；跷跷板律：v7blk1 回填洗特殊键道 |
| **T3 小雷/地雷/激光眼/过载炮** | mini_t/mine/laser_eye/cannon | **🔴 未开垦** | 全库 0/17；canon13 的 mine/cannon 出在 8p 桌——押后到 T1 机器换键道（课表 §四） |
| **T4 贴贴/天火/挑衅** | curse/firestorm/taunt | **⏸ 已裁定押后** | 不立项（用户 11-15 裁定）；GD16m 独苗在册 |

**池覆盖缺口榜**（普查 17+17 包）：big_t/transfer(除 E11/T21R)/mini_t/laser_eye/cannon/rod **零载体**；
tank 只 CB3 系 + GD3ALL-G5-8p；**CB3-s13/s7 = 四键现成载体（池成员裁定待点名）**。

## 三⁵、T11 密度臂（08:0x · 课表 T1-1/T1-2 合并首战）：教师换任判负，快照机器立功

`v7blk1 0.55 + GD16m 0.30 放开道 + CB3 0.15 + pool 8000/groups 4000 + 8p 重桌 + 链对手 + snapEvery=1`：
- **GD16m 高份额放开道 = mega 龟化**：防御 59→68→89% 逐轮恶化、ji 24→6%、C5长 0.03-0.15——
  **T1-2 判负**（GD16m 不能当高份额教师，与 E8c 全克隆同病放大版）；蓄能 1158/坦克 76 标签齐了
  （8p 桌真出坦克态）但聚能环仍仅 2 条——**轨迹不到环 setup，换教师份额救不了**。
- **快照机器立功**：洗损曲线逐轮可见（snap1 9卡 0.1147 → final 6卡 0.1486/防御 89%）——"按轮选粒"
  的对冲机制可用，但这一线没有可用的粒。
- **T1 的杠杆修正**：状态密度（pool 8000/8p 重桌）✓ 是对的，教师换任 ✗——下一班主线 =
  **v7blk1 主教 + pool 8000/groups 4000 + 8p 重桌 + 链对手 + rareOnly**（课表 T1-1 原案），GD16m
  回键道教师位（≤0.20 + keys）。

## 三⁶、T12 终判与 11-15 白班复核（11:30 · 修两处静默虫 + 定位长程规划失败根因）

1. **T12（课表 T1-1 原案满配，`OBS6E6c` 起点 × `GD16m 0.20` × `CB3 0.15` × `pool 8000/groups 4000` × 8p 长桌）终判**：
   - `seg-eval`（`100/77000`）：`OBS6T12.bak`（= `snap3`）`C5短=0.1720` / **`C5长=0.2093`** / `X̄₄短=0.1527` / `X̄₄长=0.1775` / `用卡 10` / `防御 27.1%` / **`G_M/G_L=7.15/6.80 ✓✓`**；`snap1` `C5长=0.2420 / 用卡 9 / G=4.87/4.83 / 防御 67.5%`；`snap2` `C5长=0.1624 / 用卡 10 / G=7.26/6.92 / 防御 28.8%`。
   - 行为与珠账（`probe-bead-loop --games=40 --mode=long --eps=0` + `cardUsageProfile`）：`蓄能 0.37/局, 得珠 22, 花掉 0 (0.0%), 过期 17 (浪费 77.3%)`，且 **`ring/bigT/railgun` 在 `long/multi` 均 0.0%**——与预期相反，并非仅“轨迹不够长”。

2. **白班复核确诊的 2 处静默训练虫（已同笔修复）**：
   - **虫① `supfit-gd.mjs` `buildTeacherPick` 跨构 2.0 `pack:` 教师权重被静默切坏**：`policy2.js:476` 用 `p.p2` 标记 2.0 布局，而 `supfit-gd.mjs:563` 对 `loadChamp(W0, ...)` 调用了 **`Float64Array.from(...)` 剥掉 `.p2`**，随后交回仅装载 `obs6`（`16411` 参数）的 `W.EpirusTrainer`。结果 `GD16m-D1`（`obs5`, `12393`）与 `CB3-s13`（`obs3b`, `7993`）落回 v7 `policy.js` 按错误偏移切片——实测 **原生 `GD16m-D1` 5 局 `{ji:150, curse:25, firestorm:50, ring:75, bigT:25}`（`chargeProfile 30 局`: `spent=209/209, 0%` 浪费），被剥 `.p2` 后退化成 `{ji:230, gun:211, ...}`（0 ring/0 bigT）**；**原生 `CB3-s13` 被剥 `.p2` 后退化为 66% `guard/reflect/bagua` 龟壳（0 drain/0 ring/0 bigT）**。这解释了 `T12` `GD16m` `40292` 次咨询仅命中 `1` 次、以及昨夜 `E8c/T11`“GD16m 龟化”假象。**已修**：`supfit-gd.mjs` 改为保留 `.p2` 并用 `W0.EpirusTrainer.policyChooserN` 分发跨构教师（实测跨沙箱调用 4 种架构 100% 逐行为对齐，纯 `GD16m-D1` 200 组采得 `ring=27, charge=18, railgun=18, bigT=7`）。
   - **虫② `big_t / mini_t / laser_eye` 蛇形拼写静默失效**：引擎真值 `R.SK` 为 `bigT / miniT / laserEye / dualGun`；昨夜 `E6–E12 / E9 / T11 / T12 / T21` 的 `--teacher*keys` / `--rareOnly` 与普查脚本 `cov-census-1115.mjs` / `cov-census-broad.mjs` 全用 `big_t / mini_t / laser_eye`，且 `supfit-gd.mjs` 无校验导致静默越道回落、普查误报“7 键零载体”。**已修**：`supfit-gd.mjs` 对 `--teacher2/3/4keys` / `--rareOnly`、`pg-train.mjs` 对 `--shapeKey` / `--klTilt` 均补全 `R.SK` fail-fast 门（含 `big_t -> bigT` 等拼写提示，exit 2），并修正两份普查脚本键名。

3. **为什么即使修完虫，当前蒸馏+PG 仍学不出长程/花珠/重击（三层结构瓶颈，供下一班设计课表）**：
   - **短视经济陷阱（`maxEp=2`，`ep>=3` 仅 `0.0%`）**：15 局 `long` 自对局统计，`OBS6E5c`（3007 手 `maxEp=2, chg@2=15, chg@3+=0`）、`OBS6E9`（3164 手 `maxEp=3, ep>=3 0.0%, chg@2=20, chg@3+=1`）、`OBS6P9-S4000`（3336 手 `maxEp=2, chg@2=61, chg@3+=0`）全部把钱在 `ep=1–2` 用枪/剑/狙花光，`bigT/ring/railgun` **全剧合法窗口 = `0–1` 次**（对照 `GD16m-D1`：`ep>=3 22.8%, ep>=4 7.6%, ringLeg=293, bigTLeg=73`）。即使在强构造状态 `[ep6+elec1]` 下 `E5c/P9` 给 `ring=100%`，实战仍永远过不去 `ep=2` 的坎。
   - **`ep=2` 蓄能必废闭环**：`CHARGE_MIN_EP=2` 放行 `ep=2` 蓄能（耗时 1 `ep` 剩 `1 ep`，下回合 `railgun` 需 `2 ep` 必买不起）→ `probe-bead-loop` 实测 `E5c` `77/78 (98.7%)`、`E9` `28/29 (96.6%)`、`P9-S4000` `179/179 (100.0%)` 蓄能后下回合买不起炮，且 `E5c/P9` 在强构造 `[ep2+elec1]` 持有电珠+2ジ 时仍给 `charge#elec=100% / railgun=0.0%`。
   - **通道回落扼杀前置轨 + PG 零批评者盲区**：① 在 `supfit-gd` 里把高阶教师放 `--teacher2keys=charge,bigT,ring,railgun` 时，`play()`（L818）会因 `GD16m` 在低 EP 选 `ji` 蓄钱而越道回落 `v7blk1/E6c` 把钱花光，自身永远踩不到 `ep>=3`（修复 `.p2` 后跑 `--teacher=v7blk1 --teacher2=GD16m` 仍 `t2Hits=0`，而 `--teacher=GD16m` 单独采 200 组立即出 `ring=27, bigT=7, railgun=18`）；② `pg-train` 基于 `E5c`（`p(railgun)=0`）做 `temp=0.5` REINFORCE，`firePerGame=0` 令 `λf=0.05` 零触发，且无折扣 `return-to-go` + 无价值头 + 无 `beadExpire` 惩罚只把 `P9` 推向纯蓄能（`4.4 次/局`, `99.5%` 过期）。

## 四、留给下一班 / 待用户裁

1. **链式两段式**：GD16m 主教塑轨迹 → v7blk1 回填——单包 Tier1 的正路（段间快照选点待开）。
2. **池级覆盖普查**（D-02 口径）：E6a（宽度成员，但要先过 Gap 洗名册问题——需重训去背诵）/
   E6c/E6d（强度成员）/GD16m 本体——池并集可能已盖 Tier1，先普查再攻单包。
3. **E6a 背诵病根**：K2 主教路线同时洗强度+教背诵——若要它的宽度，得换"K2 教师只在非名册对手
   桌上采"或 v7blk1 主教 + K2 窄道。
4. ~~天火教学~~（用户 02:0x 纠正）：**Tier4 已裁定，不立项**——按课程序 Tier1-3 完成前不提。
5. WSEL9-200 裁决、E5c/E6c/E6d 进池裁定（invited/block）仍挂起。
6. **夜班续班令（02:0x，到 09:00）**：①环境轮换防背诵（E7 批：对手表 names: 特化族 / product /
   long 桌形三路轮换——roster-lib 单源，39 名在册对手避开探针 R 集）②不纯靠蒸馏（PG 回填、两段式、
   混合路线都开）③产物一律 fam23。
