# 交给千问 · 2026-09-22 交接（DS 收尾 · 用户指派）

> 用户 09-22：「等这个跑完你就整理完停下来吧，两点前结束，后面给千问」。
> 本文只写**状态 + 待办 + 坑**；机制与读数细节在 `docs/RESEARCH-LOG-2026-09-22-ds.md` §0–§11 与 `CHANGELOG.md`。

## ★ 最高优先（用户 09-22 明确指令）：**删掉"火弱持续"这条规则** —— 它是一次**指纹换代**，必须整体做完

**用户原话**：「火弱持续这个规则删掉吧。别的你继续」。

**要删的是什么**（别删错）：删的是 `EPIRUS_FIREWEAK_PERSIST` 这个**训练侧实验开关**（以及它带的两处消费点），
**R22「藤甲火弱：一切火焰伤害 +1」本身保留** ✓。开关现状（`js/core/resolve.js`）：
- `:294  const FIREWEAK_PERSIST = (typeof process !== 'undefined' && process.env && process.env.EPIRUS_FIREWEAK_PERSIST === '1');`
- `:163  p.fireWeakNow = !!p.fireWeakNext; if (!FIREWEAK_PERSIST) p.fireWeakNext = false;   // R22`
- `:304  if (FIREWEAK_PERSIST) { p.fireWeakNext = false; p.fireWeakNow = false; }   // 兑现即消费`
**它是死开关**（浏览器与所有 vm 沙箱都没有 `process` ⇒ 恒 false ⇒ 删掉**行为零变化** ✓）—— 但**必须自己验证这一点**，别只信这句话。

**执行顺序（一步都不能跳，中间任何一步红了就停下来修，不要推半个指纹变更）**：
1. **先证明"零变化"**（删之前）：`git show HEAD:js/core/resolve.js` 取出旧文件，与当前文件分别跑同一批定种子对局
   （例如 `tools/spec-run.mjs` + 一段固定 seed 的自对局），逐局结果、伤害、回合数必须**完全一致**；
2. 删三处（上面 `:294` / `:163` / `:304`）：`:163` 改为**无条件** `p.fireWeakNext = false;`，`:294`/`:304` 整行删掉，
   并把注释改成"（原训练侧实验开关已于 v1.5.15x 删除；死键 ⇒ 删除行为零变化）"；
3. **门 D122 的声明表要跟着改** ✗：`tools/np-test.mjs` 的 `DEAD_LITERAL` 里删掉 `'js/core/resolve.js'` 一项
   （否则 D122 会红：实测清单少一个文件 ≠ 声明）；
4. **重记两个线上包**（D16 会红，必须补）：`node tools/promote-champion2p.mjs js/bundled-champion.js --dry` 先核考卷
   （**分数应逐位不变** —— 零变化证明的延伸），再走正式重记；3P 侧用 `tools/promote-champion.mjs`
   （参考它 §"记 `rulesFingerprint`"的注释路径）。**两个包的 `rulesFingerprint` 都要变成新值**；
5. 全链：`node tools/np-test.mjs`（D16 必须绿）· `node tools/spec-run.mjs` · `node tools/smoke.mjs`；
6. **记账**：CHANGELOG 单独一条（**明写"指纹换代 + 行为零变化 + 证明方法"**），并在研究日志里记下新指纹值，
   说明"**此前所有读数属于旧指纹代**"（这是本仓的规矩：指纹改动要单独立项 + 全链重测重记）。

**为什么 DS 没直接做完**：我这一轮上下文已用满，而上面 ④⑤ 要跑两次考卷重记 + 两轮门禁 ⇒ 做不完会留下
**D16 红的半成品**（`js/core/resolve.js` 是 `FINGERPRINT_FILES` 五件套之一）✗ ⇒ 按仓规**宁可不动**。

---


## 0. 一句话现状

- **仓库全绿**：`np-test 166/166` · `spec 52/52` · D8 三方 = **v1.5.153** · D82 缺 0 · 工作区干净（只剩必须未跟踪的 `docs/artifacts/rerun-done.marker`）。
- **两个正式槽位本轮一个字都没动**：3P = `v7cmin4-31` · 2P = `v7xfer44c13-2p`（c13）。
- **本轮的净产出**：N6 切片修好（v1.5.150）· 口径工具双修（v1.5.151/152：真机栏从 `rules.js` 取表、体检并报产品代理栏）· **热启动静默失败修掉（v1.5.153）** · 新门 **D116/D117/D118/D119** · 一个**过 2P 考卷门**的候选 + 一个**两场都拿得出手**的候选。

## 1. 第一件事（优先，且最容易出货）：从 `v7xn7c-31` 继续，单变量 = **场B 清场**

- `docs/artifacts/v7xn7c-31.bak`（臂 7′）现状：**2P 考卷 96.63% / 最差 65.00% / 过门 = 是** ✓
  ＋ 3P **挂两处**（⚠️ 场B 清场 0.10 < 0.3/局 **＋ G4[long]「珠爆发」63% > 60%** —— 后者是 qoder 用 `GATE4_GAMES=120` 复校出来的，我原先按 n=60 只报了一处 ✗）（座位 ✓ · **G 4.32 / G(long) 3.62** ✓ · 墙 17.15 ✓ · 场A 25% ✓）。
- ⇒ **跨 N 已经成立**（见日志 §11），差的是**两处**：场B 清场 + G4[long] 珠爆发（两缺口可能同根：2P 切片把包练"软"了，都吃"把人有始有终地打死"这一种能力）。下一臂请只动这一个变量：
  把"清场/收割"写进目标（形状项或对手池），或换 3P 侧对手池让"不会收割"被罚。
- 复现命令（注意 v1.5.153 起 **2P 外壳也能当种子**，不必再换槽）：
  ```
  EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=docs/artifacts/v7xn6-2p.bak EPIRUS_SEED=31 \
    EPIRUS_XN2W=1 EPIRUS_XN2G=4 EPIRUS_XN2REF=exam EPIRUS_ARM=<你的臂名> \
    node tools/train-3p.mjs 100 5 8 8
  ```
  **每臂必须确认 banner 出现 `热启动：以现有冠军为种子`**（不出现 ⇒ 本臂无效，见 §3 的坑）。

## 2. 本轮结论要点（别重做）

- **跨 N 适应度成立** ✓（臂 7′：2P 过门 + 3P 四道门）；**排练量不是越大越好** ✗（XN2G=16 的两臂都退化成"龟住拿分"）；
- **锚定 λ=3 能护住 2P** ✓（9′-band1 与种子逐位相同）但会**锁死起点** ⇒ λ 要更小或后期再加；
- **2P 的产地是 `train-best`**（fit 就是考卷）⇒ 两阶段课程：3P 训练器 + 2P 强参照切片"撬开"（70 秒）⇒ `train-best` 收口；
- **口径第一因素是装配，不是 ε**（镜像 4.30/局 vs 真桌 0.10/局 = 43 倍；ε 只值 2 倍）⇒ 门禁继续用镜像 ε=0（可比性），
  上线理由必须加报**产品代理栏**（真桌 ε=0.2，v1.5.152 已进体检，只记录不阻断）；
- **ε 分档提案已撤回**（真桌装配的证据否掉了它）；
- **验收三栏**：门禁镜像 ε=0 / 产品代理栏（真桌 ε=0.2）/ **真机栏**（`tools/log-behavior.mjs results/<目录>`，地面真值）。

## 3. 本轮踩过的坑（都是"看起来有结果、其实是白跑"类，务必避开）

1. **热启动静默失败**（v1.5.153 修掉）：`train-3p` 原来只认 `EPIRUS_CHAMPION_3P`，而 `train-best` 产的包是
   `EPIRUS_CHAMPION`（2P 外壳）⇒ 传 2P 包当种子时**静默冷启动**、白跑一整臂 ⇒ 我据此得出的"跨 N 两败/排练无效"
   两条结论**全部作废**（已在 CHANGELOG 对应条目加 ⚠️ 更正标注）。现在读不出种子会 `exit 5`。
2. **切片对手写错 ⇒ 常数切片 ⇒ 空枪**（v1.5.150 修）：对多人池打 2P 时人人 ≈0 分 ⇒ 加常数不改排序 ⇒
   产物与热启动逐字节相同。现在 `EPIRUS_XN2REF`（默认现役 2P 冠军；`=exam` 用考卷 20 基准）+ 读不出即 `exit 2`。
3. **量具抄两遍**（v1.5.151 修）：`log-behavior` 的防御类是手写正则 ⇒ 匹配不上真卡名「金刚盾」、漏 3 张、多 1 张；
   现在从 `js/core/rules.js` 取表（**同族隐患这是第四次**，请继续按"单一来源"办）。
4. **同一进程里连换槽读考卷** ⇒ `promote-champion2p` 的"槽字节变了"自检误判 + 2P 外壳包被 `_3P` 正则漏掉 ⇒
   读出一颗**假的 99.00%（其实是还原后的 c13）**。**读考卷请"一候选一次独立调用 + 每轮还原槽"**。
5. **产物必须点名**（D82）：本轮我踩了 3 次（每次都是新臂产物没写进 CHANGELOG）；夜班账用的是**短名**、
   D82 按 `*.bak` **完整文件名**匹配 ⇒ 写全名。

## 4. 交接的状态与命令

- 分支：只有 `main`（本地 5 条已并入的旧分支上一轮已删）；远端仍留 5 条 `origin/qoder*`（要不要删由用户点头）。
- 自测：`node tools/np-test.mjs`（166）· `node tools/spec-run.mjs`（52）· `node tools/smoke.mjs`。
- 换包前体检：`node tools/promote-champion.mjs <包> --dry`（含**产品代理栏**；`EPIRUS_NO_PROXY=1` 可关）。
- 2P 考卷：`node tools/promote-champion2p.mjs js/bundled-champion.js --dry`（**读槽文件** ⇒ 评候选要临时换槽并还原）。
- 2P 头对头：`node tools/probe-2p-h2h.mjs <A> <B> [局数=120]`（ε=0 · 交替先手）。
- 行为剖面：`node tools/behavior-profile.mjs --field=self,pool --gamemode=long --eps=0,0.2 --epsmode=soft --games=20`。

## 5. 仍在用户手里的事项（别自己拍）

1. **2P 槽换不换**：用户 09-22 已裁定**不换**（保 c13），`v7xn6-2p` 作可导入第三包（见 `docs/CHAMPION-CANDIDATES.md`）；
2. **跨 N 候选要不要上车**：等"场B 清场"补上再说（现在还差一道门）；
3. **冻结/分区立项**：锚定是它的最小形式（v1.5.153）；要不要往**架构级冻结**走（改训练代码）等用户点头；
4. **远端 5 条 `origin/qoder*` 分支**删不删。
