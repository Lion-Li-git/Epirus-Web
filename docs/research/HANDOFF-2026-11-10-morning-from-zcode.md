# 交接 · 2026-11-10 早班 ← ZCode 夜班（11-09 晚～11-10 早，分支 feat/obs4）

> 夜计划见 `PLAN-2026-11-09-night-zcode.md`；obs4/obs5 设计与证据见 `PROPOSAL-2026-11-10-obs4-zcode.md`
> （§五 第一轮臂 / §五″ 续训+三坑 / §六 obs5 设计）。本文只记**交接面**。

## 一、夜里发生了什么（时间序）

1. **OBS4-C 续训臂落地（04:0x）**：400 代+反制面只挣回 +0.02~0.03（X̄₄ −0.160/−0.165 与 −0.165/−0.180，仍深负）
   ⇒ 增量饮食救不动，坐实换聚合结构的理由。
2. **三坑坐实并修**（细节在 PROPOSAL §五″，每条有实证脚本）：
   - ① pg-lib 重放对 obs4 包静默改写（尾块换 obs3 族 hSelf/mean/mx + 头部槽嵌入冻结）⇒ KDO4 的
     "sword100/gun100" 是污染前向上的伪影。补 tapeForward4/4B、tapeForward5/5B。
   - ② obs3.mjs recentAll 缺 keys/cnt ⇒ obs4 训练侧 actsLast4/streakDef 两维**死维**（浏览器有活值）。
     腿 E 从红转绿的根因；obs3b 零回归。
   - ③ makePolicy 签名误用 → NaN → JSON null → 读回 0（全零种子包，梯度全零、KD 塌缩对 lr 不敏感）。
     arch2.pack 已加**非有限守卫**；supfit-full 已加 skip 计数。
3. **obs5 实现并验证**：obs4 的 292 特征 manifest 原样保留，聚合段换 set-transformer
   （共享 seatEnc → 活席掩码自注意力+残差 → PMA 4 seed）。参数 12,393。selftest3 六腿全绿 +
   smoke5 五腿全绿（含 svs 换序重放逐位 0 = 结构置换不变）。
4. **KDO5 种子**：修后真重放的 KD 桥 gun 100%/ji 54%/sword 0%/guard 0%（sword/guard 蒸馏否证在注意力面
   复现——交 GA 课程，不再加码桥）。
5. **OBS5 验收臂落地（03:3x）**：X̄₄ s13 −0.1486/−0.1671、s41 −0.1437/−0.1496——**配对对 OBS4-C（同种子同配方）
   双种子综合分都更好**（+0.005/+0.026），5P 格与 s41 的 2P 格改善最大；都未达线（深负仍在）。
   臂耗时 4005s（注意力前向 ~2×，GA 效率代价在册）。
6. **续训臂 OBS5-D 判定（05:2x）**：预算不敏感——s13 逐位复现 OBS5-Q-s13 同一粒权重（GA 收敛回同一吸引子，
   §E589 去重守卫拦下），s41 短程持平/长程回退 −0.014。**尺子校准**：好包在 triplet 尺上 0.4-0.53
   （KDG-C 0.529/CTRL2 0.443），OBS 族 −0.15 ⇒ 缺口 ~0.5，瓶颈改判「种子质量 / GA-注意力优化」而非特征。
7. **教师换血（06:0x）**：supfit-full 补 2.0 教师支持（装教师自己的面 + 标签走 forwardCands argmax +
   开车走 chooseCandidates——v7 的 value() 对 2.0 参数当场抛、catch 吞 0 ⇒ 教师退化成 ji 单键 spam 的教训入档）。
   顺手抓出 **obs3.mjs manifest 缓存潜伏 bug 并修**（obs4/obs5 分支早退漏 _MAN = m ⇒ 双面同进程必踩，
   潜伏自 obs4 原始实现）。教师 = KDG-C-Q-s41（0.529 全表最强）⇒ KDO5C 种子（7 键多样：sword 57%/
   snipe 100%/bigT 100%，600 步留出 29%；1200 步过冲 ⇒ 600 定档）。**OBS5-E-s13/s41 在飞（ETA ~07:05）**。
8. **B 扫+C 上图完成并已推**：B 扫双批 907/907 零失败；P·B 族挂列（P2B/P2BL，exam4-attach 后缀放宽）→
   attach-cmean.mjs 合成 C 族（907×8 全填零单侧）→ viewer F 源 'P'→'C'（图上只留综合分，P/X 留数据层与 Δε 腿）
   → 重烘（守卫复读 907 枚 C2/C2L 全在册 ✅，重烘逐字确定）→ c559e862 摘到 main（b2a2c9ff）→
   **main 7059448c→b2a2c9ff、feat/obs4→507819b8 已推**（⑩c 的 EOL 归一在门里，CRLF 工作树不假红）。

## 二、下一班的第一件事（按序）

1. **广度墙（唯一没过的门）**：MSB2 冠军链 triplet +0.2925、场A 47.8% 双过线，但**卡谱用卡 3/7/4**
   （ji+gun 占 90%+，防御 0-1%；验收线 ≥9）——四角互斥（场B/广度/场A/强度）的已知形状。
   - 下一手：轮换结构里加广度压力（WIDTH_W>0 / 广度课程席 / CARD 谱课程轮），用 `tools/card-usage.mjs`
     逐臂量，看广度-强度曲线在轮换结构下的形状（单轨迹时代 WIDTH_W 推向乱打的结论不一定迁移）。
   - ⚠ **不要急着进池**：用卡 3 vs 线 9，差得远；G5/12线也等广度上去再量。
2. **轮换 GA 已定案为生产训练结构**（等预算 10× 于单轨迹，详见 PROPOSAL §八）：
   - 驱动器 `scratch/night-adapt2/msbatch2.mjs`（2P 谱系晋升逐条移植：父母池含冠军同口径重测/
     √n 保留 2+1 分配/绝不回退 margin/种子每轮换新）
   - 续转：`node scratch/night-adapt2/msbatch2.mjs --base=<新> --start=<当前冠军> --rounds=2 --branches=3 --gens=200`
   - 种子/教师升级路径：KDG-C 教师 → 强包自举（跨面蒸馏闸要在，supfit 已支持 2.0 教师）
3. **obs4 线冻结**为对照面；记分 v3（rankOf→击杀贡献）排观测面落定之后（用户定的序）。
4. **本夜产物树**：KDO5（bundled 教师）→ KDO5C（KDG-C 教师）→ OBS5-Q/E/F（单轨迹判定链）
   → MSB2 轮换链（R1 +0.089 → R2 +0.2306 → R3 **+0.2925**）；hotstartFrom 链在包 META（wid）。

## 三、在飞与产物索引

| 项 | 位置 |
|---|---|
| obs5 设计+全部证据 | `docs/research/PROPOSAL-2026-11-10-obs4-zcode.md` §五″/§六 |
| obs5 实现 | `js/train/policy2.js`（DOF.obs5/前向）‖ `tools/proto2/arch2.mjs`（layout/前向/pack 守卫）‖ `obs3.mjs`（manifest 别名+recentAll）‖ `pg-lib.mjs`（重放/反传四函数+段按名）|
| 种子 | `scratch/obs4/KDO5.bak`（KD 产物）‖ `KDO5-seed.bak`（随机起点）|
| 验证脚本 | `scratch/obs4/smoke5.mjs`（五腿）‖ `kd-corruption-check.mjs`（坑①实证）‖ `numgrad5-probe.mjs`（梯度画像）|
| 承诺 | 做到早上九点；两臂 ~03:2x 落地、B 扫 long ~03:46 完，判定与上图都在班内 |

## 四、注意事项（给下一班的钉子）

- **policy2.js 变了但 index.html 没重烘** ⇒ feat/obs4 分支若跑 D234⑩c 会红——promote 时统一重烘（obs4 提交起如此，不是新洞）。
- `EPIRUS_COUNTER_OPPS` 环境值**不带 `cnt:` 前缀**（meta 里存的 "cnt:gunFocus" 是内部记录格式，裸名才是合法输入）——11-10 凌晨臂秒退一次的教训。
- `P.makePolicy(scale)` 只收 scale，**别把 rng 当第一参**（坑③）；要定种子走 arch2 内 rngRef（train-3p 已接管播种）。
- supfit 的 obs4/obs5 重放已修，但**历史 KD 产物（KDO4/KDG 系）的保真读数全部存疑**（都在污染前向上量过）——引用时注明。
- selftest3 腿 F 在 ADAPT2-Q-s41 上红（curse 拐点伪影，HEAD 复现=旧有，非本轮引入）；pg 臂不从该包开即可。
