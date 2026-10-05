/* §E293 可交互查看器 v2 —— 用户 10-04 六条反馈逐条落地（本版是对 §E292 v1 的整页重写）：
 *   ① 「二维的地板和点脱节了」→ 位图不再走 setTransform（v1 的矩阵按图像像素算，缩放时场和点各走各的）。
 *      现在把**同一个 map()** 作用到场网格的四个角，用 drawImage(矩形目标) 贴 ⇒ 地板和点在数学上是同一变换。
 *   ② 「三维版做的还挺好看」→ 保住（模式 = `三维势阱`），只把它抽成"有高度的那个视图"。
 *   ③ 「二维行为轴版本的点颜色就表示家族好了，底下给出图例，按家族顺序放并可以选择高亮特定点」
 *      → 二维/一维默认色 = 家族；页底一条**家族图例 = 按钮**，按成员数从多到少排；点一个就把该家族之外的点压到
 *        alpha 0.10（可多选，有"清除高亮"）。
 *   ④ 「把一维和三维行为轴也放到网页里吧，三维行为轴的就只能用点颜色表示势了」
 *      → 四个模式：`一维`（F 排序带 + H/珠价分解条，718 枚全可数、零重叠）‖ `二维行为轴` ‖
 *        `三维行为轴`（x3/y3/z3，颜色**只能**是势 F）‖ `三维势阱`（地板 = 势场、柱高 = U）。
 *   ⑤ 「做一个调整网页底色的模块，不然有时候对比度会太低了」→ 底色预设 + 取色器；setBg() 按亮度自动翻
 *      墨色/淡色（亮底 ⇒ 深字），并把 CSS 变量一起换掉（面板、图例、提示框跟着变）。
 *   ⑥ 「切换的时候会卡一下……T 滑杆点一下就卡死完全没法用」→ 根因是每次改 T 都重跑 150×150 格 × 718 点 IDW
 *      （含每格一次全排序）≈ 3 亿次运算。现在**邻域只算一次**（每套坐标轴一份，缓进 Int16Array/Float32Array），
 *      并且每格存的是 Σw、Σw·H、Σw·S 三个加数和 —— 换 T 只是"每格两次乘加"（96×96 ⇒ 约 1e5 次操作，亚毫秒级）。
 *      所有重绘经 requestAnimationFrame 合并，一帧最多画一次。
 *
 * 自包含：数据内联进 HTML、纯原生 JS + Canvas，**不引任何 CDN**（离线可开）。
 * 坐标来自 `coords.tsv`（由 `docs/artifacts/e287-out/e287-figs.mjs` 算好后拷进来）⇒ 交互页与静态图共用同一批坐标，不重算不漂移。
 * 用法：node champion-map/viewer.mjs [--out=index.html]
 *
 * §E294 追加（用户 10-04 第二轮：「旋转和缩放中心出问题了，一维也因此被裁掉了一块。
 *   二维的背景图能不能直接扩散到所有点的范围并且卡住缩放上界，不要看起来背景图很割裂」）：
 *   ⑦ **真凶是 `clear()` 里多叠的一个 dpr 变换**：全页坐标本就按设备像素算（恒等变换约定），再乘 dpr ⇒
 *      dpr=1.75 的屏幕上整个场景放大 1.75 倍绕原点偏到右下 ⇒ 旋转/缩放的视觉支点全错、一维底部被裁。
 *      **无头截图 dpr=1 恰恰看不出来** —— 这轮起截图一律带 --force-device-scale-factor=1.75 复核。
 *      缩放公式另有一处独立的错（少了画布中心项），一并修。
 *   ⑧ 势场网格从"截尾范围"改成**全体点的 min/max + 3% 边距**（视野拟合仍用截尾，两套范围分开存）⇒
 *      没有一枚点脚下悬空；缩放/平移由 clampView 卡死：k 的下界 = 场恰好铺满视口，平移区间 = 场始终盖住视口。
 *   ⑨ 三维势阱的地板从 9216 枚方片改成**整张位图一次仿射贴上**（z=0 在正交相机下就是仿射）⇒
 *      格缝抗锯齿网纹消失，还省一次排序；旋转轴心从"场的中点"改成**云团质心**（绕偏轴扫 → 绕云团转）。
 *
 * §E295 追加（用户 10-04 第三轮：「二维的底和图又错位了。底图效果不好，雾蒙蒙的；势阱版还不如旧底图，边缘割裂。
 *   把势阱版做成二维版的一个选项，点一下无缝平面/立体切换。三维渲染左键拖动、右键旋转」）：
 *   ⑩ **错位的真凶**：旧二维的矩形贴法把位图行 0（数据 y0）贴到了 y1 的屏幕位置 ⇒ **上下颠倒**。
 *      修法不是补丁而是**合并**：平面与立体共用同一台渲染器（drawMap）、同一条仿射贴图路径 ⇒ 不可能再各贴各的。
 *   ⑪ **雾蒙蒙**：位图改成**不透明**——每格把势色按覆盖度合成到底色上（4 次幂淡出，远处=纯底色），
 *      半透明牛奶晕消失；立体态的透明边割裂也一并消失（位图之外就是底色，边界在视觉上不存在）。
 *   ⑫ **无缝切换**：地图模式一个"立体"按钮 = 相机在 FLAT（正俯视，投影退化为旧二维地图）与 SOLID 之间
 *      插值 + 柱高从 0 长到 U（520ms 缓动）——不是跳页面，是同一台相机躺下/起来。
 *   ⑬ **左键平移、右键旋转**（地图立体态与三维行为轴都如此）；contextmenu 在画布上禁掉。
 *
 * §E296 追加（用户 10-04 第四轮：「切换动画立起来的同时发生了旋转，应该原地立起来；
 *   底图每个点扩散出来的势函数是扁的而不是正圆的（中间空位也很大）；二维版缺了原先的"过线"范围」）：
 *   ⑭ **原地立起**：FLAT/SOLID 改成**同一方位角**（yaw 都是 −π/2）只差俯仰 ⇒ 平面→立体只压 pitch、yaw 不动；
 *      立体→平面才把 yaw 插回正北（平面图必须北朝上）。
 *   ⑮ **势晕是扁的 + 空位大**：根因 = 场的距离在**数据空间**算，而屏幕上两轴比例尺差 ~4 倍
 *      （bx≈295 px/单位 vs byy≈74）⇒ 数据空间的圆上屏是 4:1 扁椭圆，且扁轴上淡出半径只盖 ~8px、
 *      点距 ~37px ⇒ 中间空位。修法 = 距离一律按**屏幕度量**（dx·bx, dy·byy），网格按显示跨度分配
 *      （显示空间里格子是正方形）；淡出尺度 3.5×（屏幕度量下的）最近邻中位数。
 *   ⑯ **过线范围**（§E287 判据 = e287-panel.tsv 的 ok 列，43/94）：过线包周围 1.2×nmed 的**盘并**——
 *      烘一张与场同网格的绿色 overlay（同一矩阵贴上，alpha 0.13）+ 走格边画并盘边界线（旧静态图
 *      edgesOf 的移植）；平面/立体两态都画；悬停明细里标注 过线✓/未过线。
 *
 * §E297（用户 10-04 第五轮：「势阱图的高度轴反了，变成阱底在上面能量高的反而在下面」）：
 *   ⑰ 柱高原来取 U = F_max − F ⇒ 高 F 反而贴着地板。改成**柱高 = F − F_min**（能量高的在上）。
 *   ⑱ 连带查出**地板配色也反了**：原来按 U 上色 ⇒ 低 F 那枚脚下是红、高 F 是蓝，与图例（红 = F 高）和点色全部相反
 *      （实测修前：低 F 脚下 [101,64,81] 红 / 高 F 脚下 [60,109,141] 蓝）。改成按 F 上色，三处同向。
 *   ⑲ 顺手清掉标签里自相矛盾的话：F = H + T·S 里 H=夺1率、S=广度**都是越大越好**（rank 1 = F 最高 =
 *      线上冠军那一端），所以旧文案"贴基线 = 阱底（最好）"是错的 ⇒ 图例/提示/明细一律改成显式
 *      "F 高 = 好 / F 低 = 差"，不再用阱口阱底说好坏。
 *      ⚠ 代价（留给用户裁定）：按"高度 = F"画，冠军在**峰顶**而不是阱底 —— "势阱"这个名字在这种约定下是反的；
 *        要恢复"冠军在阱底"只需把柱高翻回 F_max − F（一个常数），但那正是本轮点名"反了"的方向。
 *
 * §E298（用户 10-04 第六轮：「加一个选项可以自动选择要顶还是底；过线范围好像是沿用旧图，只有很少的点有写是否过线，
 *   要是耗时不长的话就把所有点都搞一遍做一个精度更高的过线范围」）：
 *   ⑳ **顶/底开关**（按钮"好在上 ⇅"，深链 `&dir=bottom`）：只翻高度方向，**颜色恒为 红 = F 高** ⇒ 两态下图例/点色/地板
 *      永远同向，翻的只是"把好的那头放在顶上还是放在阱底"。一维阶梯同步跟这个开关。
 *   ㉑ **过线扩到全量**：旧图吃的是包自己 META 的历史 `feasibility.ok`（面板只 94 枚有值；全表也只有 482/718，
 *      且那 482 枚**跨 6 个 opps 层**，而 §E287 实测"只换 opps 池过线率 45.7%→6.4%"= 六把尺混画）。
 *      ⇒ 新脚本 `e287-feas.mjs` **照抄 promote-champion 的调用配方**（同一个 `feasibilityOf` 单一真源、
 *        同一份 `feasPlan` 样本量 n=20/aggr40/seat100），对 718 枚现跑一遍：113 过 / 605 不过 / 0 错，7.6 分钟。
 *        自检：4 枚历史过线包全部复现 ok=1；eco-34-v7 复现"场B 清场 0.00 ⇒ 挡"（与 audit-lib 注释里点名的例子一致）。
 *      ⚠ 与包内历史记录一致率 **417/482 = 86.5%**，65 处分歧里 25 枚"历史过→现在不过"（栽在 v1.5.145 才加的
 *        G(long)<3、以及偏座判据的零分布 p 门槛）、40 枚"历史不过→现在过" ⇒ **本图画的是"按今天的闸会不会过"**，
 *        不是"当年怎么过的门"。图例里把判据来源标出来了。
 *
 * §E299~§E302（第七、八轮）过线**怎么标**这条线来回三次，结论是"别画范围"：
 *   ㉒ DS：绿区太大 ⇒ 把盘半径缩到 1.4×nmed、又建一张 6× 细网 mask 想解分辨率 ⇒ 但 `buildBitmap` 造 `FL` 时
 *      没带 `okMF/okGx/okGy` ⇒ 细网从没上过屏，屏幕上只剩粗格降采样的**方块**（用户："他搞半天全改坏了"）。
 *   ㉓ 我：换成"局部过线率场 + 插值等值线 + 阈值滑杆 + 覆盖率/纯度读数"，纯度从 53.1% 做到 88%。
 *   ㉔ 用户：「现在这个绿区还会把底图盖掉，把二维的绿区删掉吧，留着绿点就行了」⇒ **绿区/等值线/滑杆全删**，
 *      只留逐枚**绿环**（= 这枚自己过了今天那道闸）+ 悬停明细里"栽在哪条腿"。为什么不该再画回去，写在 `buildNB` 末尾。
 */
import { readFileSync as _readFs, writeFileSync, existsSync } from 'node:fs';
/* §E333 本仓工作树是 CRLF（autocrlf），而下面八处读表全是 `split('\n')` ⇒ 每行**末列**会带一个裸 \r，
 *   末列的名字就变成 "path\r" 这种查不到的键（本班 coords.tsv 的 path 列正好在末列，被 git checkout 兜一圈后就瞎了）。
 *   与其在八处各写一遍归一，不如在读文件这一步统一 ⇒ 任何新增的表都自动免疫这一族。*/
const readFileSync = (f, enc) => _readFs(f, enc || 'utf8').replace(/\r\n/g, '\n');
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
/* §E303 从 `docs/artifacts/e287-out/` 挪到仓库根的 `champion-map/`（用户：「不要放在很深的文件夹里面」）。
 *   文件名一律去掉 `e287-` 前缀；**输入表是拷进来的**：`coords.tsv` 由 `docs/artifacts/e287-out/e287-figs.mjs`
 *   算出来（它吃 `results/`〔用户私有〕+ gitignored 的臂产物 ⇒ 换机不能重算），重算后要手工拷到本目录。*/
const OUT = arg('out', 'index.html');
const CF = join(HERE, 'coords.tsv');
if (!existsSync(CF)) { console.error('⛔ 没有 ' + CF + ' ⇒ 先跑 docs/artifacts/e287-out/e287-figs.mjs，再把落盘拷成 coords.tsv'); process.exit(2); }
const t = readFileSync(CF, 'utf8').trim().split('\n'), head = t[0].split('\t');
const rows = t.slice(1).map(l => { const c = l.split('\t'); const o = {}; head.forEach((k, i) => { o[k] = c[i]; }); return o; });
if (rows.length < 50) { console.error('⛔ 坐标表只有 ' + rows.length + ' 行'); process.exit(2); }
const fitP = join(HERE, 'fit.tsv');
const fit = existsSync(fitP) ? readFileSync(fitP, 'utf8').trim().split('\n') : [];
/* 过线来源（§E298）：**优先**用现跑的同一道闸 `feas-s*.tsv`（覆盖全 718 枚、样本量统一 n=20/aggr40/seat100）；
 *   没有才退回包自己 META 里的历史 feasibility.ok（`panel.tsv` 只有 94 枚，且那 482 枚有值的还跨 6 个 opps 层
 *   ⇒ §E287 实测"只换 opps 池过线率 45.7%→6.4%"，混在一起画就是假范围）。 */
const FEAS_FILES = ['feas-s1.tsv', 'feas-s2.tsv', 'feas-s3.tsv', 'feas.tsv'].filter(f => existsSync(join(HERE, f)));
const panelP = join(HERE, 'panel.tsv');
/* §E304 家族表（`lineage.mjs` 生成）：**家族 = 训练方法/目标配置的等价类**，不是 seed。
 *   为什么必须换：coords 的 seed 列只有 14 个取值（31~36 / 81~96），它就是包名尾部那个数 = META.seed
 *   ⇒ 同一个 seed 被几十上百枚毫不相干的臂复用 ⇒ 标的是 RNG、不是血统（用户 10-05 的怀疑成立）。
 *   META.seed 其实有 84 个取值 ⇒ 连"这一列是不是 seed"都要分清楚，别把名字后缀当元数据。*/
const linP = join(HERE, 'lineage.tsv');
let LIN = {};
if (existsSync(linP)) {
  const ll = readFileSync(linP, 'utf8').trim().split('\n'); const lh = ll[0].split('\t');
  for (const l of ll.slice(1)) { const c = l.split('\t'); const o = {}; lh.forEach((k, i) => { o[k] = c[i]; }); LIN[o.id] = o; }
} else console.log('⚠ 没有 lineage.tsv ⇒ 家族退回按 seed 上色（跑 node champion-map/lineage.mjs 生成）');
let OKM = null, POK = 0, OKSRC = '';
if (FEAS_FILES.length) {
  OKM = {};
  for (const f of FEAS_FILES) {
    const L = readFileSync(join(HERE, f), 'utf8').trim().split('\n');
    const hd = L[0].split('\t'), iId = hd.indexOf('id'), iOk = hd.indexOf('ok'), iF = hd.indexOf('fails');
    for (const l of L.slice(1)) { const c = l.split('\t'); const id = c[iId]; if (!id) continue;
      /* §E307 顺手把 G(long) 也带进来：它是闸卡住前沿的那条腿（前 30 名里 16 枚未过线，多数栽在这儿），
       *   图上原本完全看不见 ⇒ 多一个着色口径就能当场指出"该往哪儿训"。 */
      if (c[iOk] === '0' || c[iOk] === '1') OKM[id] = { ok: c[iOk] === '1', fails: String(c[iF] || '').slice(0, 160), g2: Number(c[hd.indexOf('G2')]) }; }
  }
  POK = Object.keys(OKM).length; OKSRC = '现跑同一道闸（feasibilityOf · n=20/aggr40/seat100）';
} else if (existsSync(panelP)) {
  const pl = readFileSync(panelP, 'utf8').trim().split('\n');
  const ph = pl[0].split('\t');
  const iOk = ph.indexOf('ok'), iId = ph.indexOf('#id') >= 0 ? ph.indexOf('#id') : ph.indexOf('id');
  OKM = {};
  for (const l of pl.slice(1)) { const c = l.split('\t'); const id = (c[iId] || '').replace(/^#/, '');
    if (id) { OKM[id] = { ok: c[iOk] === '1', fails: '' }; POK++; } }
  OKSRC = '包内历史 feasibility.ok（旧面板，覆盖不全且跨层）';
}
/* §E308 上槽体检（`promote --dry` 的实测裁决，由 promscan.mjs 从日志汇总）。
 *   为什么还要这一张表：绿环那条 `feasibilityOf` 只是**五道**，而真正决定能不能换包的是另外三条腿
 *   —— G4（不许被一行脚本打穿 >60%）‖ G5（面对"只防御不还手"必须清场 ≤25%）‖ 送盾硬门槛（不可 --force）。
 *   §E305/§E307 一枚一枚数出来的结论就是：F 前沿**系统性死在这三条腿上**，而它们在图上原本完全隐形。
 *   代价：一枚 `--dry` ≈ 2.5 分钟（要跑考卷 + 行为门），所以只覆盖实测过的那几十枚 ⇒ 未测的显灰，不当"没过"。*/
const promP = join(HERE, 'promote.tsv');
let PROM = {};
if (existsSync(promP)) {
  const pr2 = readFileSync(promP, 'utf8').trim().split('\n'); const p2h = pr2[0].split('\t');
  const iId = p2h.indexOf('id'), iV = p2h.indexOf('verdict'), iB = p2h.indexOf('blocks');
  for (const l of pr2.slice(1)) { const c = l.split('\t'); if (!c[iId]) continue;
    PROM[c[iId]] = { pass: c[iV] === 'pass', b: String(c[iB] || '').slice(0, 150) }; }
  console.log('上槽体检实测 ' + Object.keys(PROM).length + ' 枚（✅ ' +
    Object.values(PROM).filter(function (x) { return x.pass; }).length + ' ‖  ' +
    Object.values(PROM).filter(function (x) { return !x.pass; }).length + '）');
} else console.log('提示：没有 promote.tsv ⇒ "上槽体检"着色口径不可用（跑 node champion-map/promscan.mjs 生成）');
/* §E310 决斗表（§E289 那台配对决斗的汇总，`duelscan.mjs` 生成）= 图上第 4 条腿："这枚打赢现役没有"。
 *   为什么非画不可：§E308 ① 我拿"考卷 H 高 5.2pt"当"更强的冠军"写进头条，被这台仪器当场推翻
 *   （v7t1-82 两批种子都输）⇒ 这个仓库里"更强"有专门的尺，图上却只有 F/H/S。
 *   口径：A−B = （我做异类时夺1率）−（现役做异类时夺1率），**两批种子同向才给颜色**，符号翻的画黄（判不动）。*/
const duelP = join(HERE, 'duel.tsv');
let DUEL = {};
if (existsSync(duelP)) {
  const dl = readFileSync(duelP, 'utf8').trim().split('\n'); const dh = dl[0].split('\t');
  const iId = dh.indexOf('id'), iM = dh.indexOf('mean'), iS = dh.indexOf('sign'), i7 = dh.indexOf('s77000'), i8 = dh.indexOf('s88000');
  for (const l of dl.slice(1)) { const c = l.split('\t'); if (!c[iId]) continue;
    DUEL[c[iId]] = { m: +c[iM], s: c[iS], a: c[i7], b: c[i8] }; }
  console.log('决斗实测 ' + Object.keys(DUEL).length + ' 枚（两批同向 ' +
    Object.values(DUEL).filter(x => x.s === 'same').length + ' ‖ 符号翻 ' +
    Object.values(DUEL).filter(x => x.s === 'flip').length + '）');
} else console.log('提示：没有 duel.tsv ⇒ "对现役决斗"着色口径不可用（跑 node champion-map/duelscan.mjs 生成）');
/* §E313 部署口径表（`eps-scan.mjs` 跑 + `epsread.mjs` 汇成 `epsagg.tsv`）= 图上第 5 条腿："页面开着 ε=0.2 soft 还值多少"。
 *   为什么这一格非补不可：图上那把头号尺 H = `eval-5p` 的**考卷口径（ε=0 贪心）**，而真页面每手有 20% 概率
 *   在短名单里软采样（§E275 才把这条口径接进工具）⇒ 两把尺一直没并排量过。
 *   实测（121 枚 × 2 eval seed × 2 口径 = 484 遍 · 50.8 万局）：两口径的**排名**几乎同构（Spearman 0.912），
 *   但**电平**不同构 —— 线上包 53.65 → 49.10（**Δε 4.55pt = 过线组第 94 百分位**），而历代冠军的 Δε 中位 2.25
 *   是非冠军 1.20 的 1.9 倍 ⇒ **当选过程在挑"最贴贪心 argmax"的包，页面恰好在扰动那个 argmax**（过拟合到评估器口径）。
 *   字段：`hp` = 页面口径夺1率 ‖ `de` = Δε（考卷 − 页面，正 = 开探索就掉）。*/
const epsP = join(HERE, 'epsagg.tsv');
let EPS = {};
if (existsSync(epsP)) {
  const el = readFileSync(epsP, 'utf8').trim().split('\n'); const eh = el[0].split('\t');
  const iId = eh.indexOf('id'), iE = eh.indexOf('exam'), iP = eh.indexOf('page'), iD = eh.indexOf('de');
  for (const l of el.slice(1)) { const c = l.split('\t'); if (!c[iId]) continue;
    EPS[c[iId]] = { h: +c[iP], e: +c[iE], d: +c[iD] }; }
  console.log('部署口径实测 ' + Object.keys(EPS).length + ' 枚（页面比考卷强的 ' +
    Object.values(EPS).filter(x => x.d < 0).length + ' ‖ Δε ≥ 3.41pt 的 ' +
    Object.values(EPS).filter(x => x.d >= 3.41).length + '）');
} else console.log('提示：没有 epsagg.tsv ⇒ "部署口径/脆弱性"着色不可用（跑 node champion-map/eps-scan.mjs && node champion-map/epsread.mjs）');
const DATA = rows.map(r => ({
  /* §E314 **头号尺换成线上口径**（用户："把冠军演化全部改成线上口径吧"）。
   *   `Hp` = 同一台 `eval-5p`、同一批 35 组合 × 30 局、同 seed，只是主体席按页面那样开 ε=0.2 soft；
   *   `H`  保留 = 考卷口径（ε=0 贪心）—— 历史文档里大量读数写的是它，覆盖掉就把名字偷走了（attach-hp.mjs 头注有账）。
   *   `De` = Δε = H − Hp（正 = 开探索就掉）。*/
  id: r.id, lin: r.lineage || '', kin: r.kin || '', seed: r.seed || '', H: +r.H, Hp: +r.Hp, De: +r.De, S: +r.S, Ge: +r.Geff, rk: +r.rank,
  /* §E321 当选键那条腿（`attach-sc.mjs` 贴进去的四列）：
   *   Sc  = 8 粒 seedBase 的 sc 均值 ‖ Scd = 逐 seedBase 与现役的配对差均值 ‖ Scs = 同号计数 ‖ Sch = 主场（@987654）那一粒。
   *   ⚠ 空串必须是 null，不许当 0 —— "没测过"与"和现役一样"是两件事（§E308 那条灰≠红的教训）。*/
  sc: r.Sc === '' || r.Sc === undefined ? null : +r.Sc,
  scd: r.Scd === '' || r.Scd === undefined ? null : +r.Scd,
  scs: r.Scs || '', sch: r.Sch === '' || r.Sch === undefined ? null : +r.Sch,
  x2: +r.x2, y2: +r.y2, x3: +r.x3, y3: +r.y3, z3: +r.z3,
  /* §E334 权重身份去重（`attach-dup.mjs`）：`dn` = 同一份权重在面板上有几行 ‖ `dups` = 那几行的 id。
   *   不标就会把"901 行"读成"901 种打法"：实测只有 **713 个不同权重**，而最刺眼的一组是 **4 行都是现役本身**
   *   （SHIPPED-Ldemo ‖ Ldemo  C5-02-31 ‖ C5-02-71）⇒ 对局仪器反过来自证：那三枚打现役配对差恰好 0.0pt。*/
  dn: r.dupN === '' || r.dupN === undefined ? 1 : +r.dupN, dups: r.dupOf || '',
  /* §E304 家族：`fam` = 方法/目标等价类编号（按最早 ts 排 ⇒ 号大 = 训得晚）；`ms` = META 里真正的 RNG seed
   *   （和包名后缀那个数**不是一回事**，实测 META.seed 有 84 个取值、名字后缀只有 14 个）。*/
  fam: LIN[r.id] ? +LIN[r.id].fam : 0, ms: LIN[r.id] ? LIN[r.id].metaSeed : '',
  ts: LIN[r.id] ? LIN[r.id].ts : '', par: LIN[r.id] ? LIN[r.id].parent : '', pof: LIN[r.id] ? LIN[r.id].parentOf : '',
  /* §E314 解析不到实体时不再写"盘上查无该权重"（那句话暗示"还能找回来"）—— 换成有名有姓的合成节点 */
  pnm: LIN[r.id] ? (LIN[r.id].parentName || '') : '',
  ok: OKM && (r.id in OKM) ? (OKM[r.id].ok ? 1 : 0) : null,
  gl: OKM && (r.id in OKM) && isFinite(OKM[r.id].g2) ? OKM[r.id].g2 : null,
  pv: r.id in PROM ? (PROM[r.id].pass ? 1 : 0) : null, pb: r.id in PROM ? PROM[r.id].b : '',
  dm: r.id in DUEL ? DUEL[r.id].m : null, ds: r.id in DUEL ? DUEL[r.id].s : '',
  da: r.id in DUEL ? DUEL[r.id].a : '', db: r.id in DUEL ? DUEL[r.id].b : '',
  /* §E313 部署口径：`hp` = 页面（ε=0.2 soft）夺1率 ‖ `de` = Δε = 考卷 − 页面（正 = 开探索就掉）*/
  hp: r.id in EPS ? EPS[r.id].h : null, he: r.id in EPS ? EPS[r.id].e : null, de: r.id in EPS ? EPS[r.id].d : null,
  why: OKM && (r.id in OKM) ? OKM[r.id].fails : '',
  dmg: +r.dmg, heavy: +r.heavy, holo: +r.holo, rounds: +r.rounds, draw: +r.drawRate, zero: +r.zeroRate,
  seat: +r.seatSpread, keys: +r.distinctKeys, chg: +r.charges, waste: +r.waste, stance: +r.noThreatStance, atk: +r.fieldAAtk, rw: +r.rwDmg
}));
const ship = DATA.find(d => d.id === 'SHIPPED-Ldemo');
console.log('内联 ' + DATA.length + ' 枚（历代冠军 ' + DATA.filter(d => d.lin).length + ' 枚 ‖ 线上 ' + (ship ? '有' : '缺') + '）');
/* 家族标签**去重**：22 条长文本 × 718 枚 = 86 KB 的重复 ⇒ 表只发一份，枚上只留编号。*/
const FAMLAB = {};
for (const r of DATA) if (r.fam && LIN[r.id]) FAMLAB[r.fam] = LIN[r.id].famLabel;
console.log('家族 ' + Object.keys(FAMLAB).length + ' 个（来自 lineage.tsv）‖ 无家族号 ' + DATA.filter(d => !d.fam).length + ' 枚');
console.log('过线判定源 = ' + (OKSRC || '无 ⇒ 不标绿环') + ' ‖ 有判定 ' + POK + ' 枚 ‖ 判为过线 ' + DATA.filter(d => d.ok === 1).length +
  ' 枚 ‖ 无判定 ' + DATA.filter(d => d.ok === null).length + ' 枚');

const JS = `
var P = DATA, N = P.length;
/* §E334 "多少枚候选"与"几种打法"是两件事：同一份权重在面板上可以占好几行（实测 901 行 = 713 个权重，
 *   其中 4 行都是现役本身）⇒ 统计条上两个数一起印，别让人把行数当打法数。*/
var NDUP = Math.round(P.reduce(function (s, d) { return s + 1 / (d.dn > 0 ? d.dn : 1); }, 0));
var cv = document.getElementById('cv'), g = cv.getContext('2d');
var KF = 12;
var KEXP = 2.5;   /* §E330 IDW 核的指数：1/d^KEXP。**淡出的覆盖度也用它**（见 buildBitmap），所以提成常数 ——
                     两处各写一份字面量时，改一处会让"晕有多远"和"核有多硬"悄悄脱钩。*/
var EDGEK = 8;    /* §E331 位图外沿收口的格数。必须**小于**网格边距折算出来的格数（边距 10% ⇒ 约 19 格），
                     否则会把点云自己的晕切掉一刀 —— 那是"为了藏边而砍数据"。*/
var OKL = [], POKJ = 0, PV = null;
(function () { var xa = [], ya = [];
  for (var i = 0; i < N; i++) { xa.push(P[i].x2); ya.push(P[i].y2); if (P[i].ok !== null && P[i].ok !== undefined) { POKJ++; if (P[i].ok) OKL.push([P[i].x2, P[i].y2]); } }
  PV = { x0: pct(xa, .005), x1: pct(xa, .995), y0: pct(ya, .005), y1: pct(ya, .995) }; })();
/* §E308 实测过上槽体检的枚数（分母只算实测过的，别把"没测"说成"没过"）*/
var NPRM = 0, NPPASS = 0;
/* §E314 谱系中心的真相要写在图上：584 枚（81%）的父指针解析不到实体，而那不是"丢了"——
 *   CHANGELOG.md:6402 已定性 = tools/ring2-run.mjs:95 无条件覆写 EPIRUS_BUNDLE_IN ⇒ 全部臂恒拷同一个 v1.3.58 BASE。
 *   今天又把它可能藏身的地方穷尽扫完（盘上 1461 个 .bak + 全历史可达 blob 593 + 整个对象库 4190，逐枚算权重指纹）⇒ 无实体。
 *   ⇒ 图上不画这条边（没有节点可画），但**必须把这句话印出来**，否则下一个人会把它读成"81% 同源 = 演化收敛"。*/
var NRBASE = 0;
(function () { for (var i = 0; i < N; i++) if (P[i].pnm && P[i].pnm.indexOf('RUNNER-BASE') === 0) NRBASE++; })();
(function () { for (var i = 0; i < N; i++) { if (P[i].pv === 1) { NPRM++; NPPASS++; } else if (P[i].pv === 0) NPRM++; } })();
/* §E310 决斗实测数（同向上的"赢"才算，符号翻的单列）*/
var NDUEL = 0, NWIN = 0, NFLIP = 0;
(function () { for (var i = 0; i < N; i++) { if (!P[i].ds) continue; NDUEL++;
  if (P[i].ds === 'flip') NFLIP++; else if (P[i].dm > 0) NWIN++; } })();
/* §E313 部署口径实测数：NEPS = 两 seed 齐的枚数；NBRIT = Δε ≥ 3.41pt 的"脆"枚数
 *   （3.41 = 线上包 Δε 4.55 的 0.75 倍，判据 (b) 跑前写死的那个"同量级"线）*/
var NEPS = 0, NBRIT = 0, NSTRONG = 0;
/* §E321 当选键那条腿的计数：NSEL = 有读数的枚数 ‖ NSELUP = 配对差 ≥ +2pt 的枚数 ‖ NSELSOFT = 同号数 < 6/8 的枚数
 *   （判据跑前定死：幅度 ≥2pt 且 ≥6/8 同号才算"在这把尺上赢现役"，§E318 的那套）*/
var NSEL = 0, NSELUP = 0, NSELSOFT = 0, NSELDOWN = 0;
(function () { for (var i = 0; i < N; i++) { if (P[i].de === null) continue; NEPS++;
  if (P[i].de >= 3.41) NBRIT++; if (P[i].de < 0) NSTRONG++; } })();
/* §E321 当选键计数：只算**有读数**的枚（留空 = 这台仪器没测过，绝不当 0）。
 *   NSELUP 用的判据与 §E318 跑前写死那条一字相同：配对差均值 ≥ +2pt 且 ≥6/8 粒 seedBase 同号。*/
(function () { for (var i = 0; i < N; i++) {
  if (P[i].scd === null || P[i].scs === 'ref') continue; NSEL++;
  var pos = parseInt(P[i].scs, 10) || 0;
  if (P[i].scd >= 2 && pos >= 6) NSELUP++;
  else if (P[i].scd > 0 && pos < 6) NSELSOFT++;
  if (P[i].scd <= -2) NSELDOWN++; } })();
var st = { mode: 'map', T: 0.10, color: 'fam', size: 1, labels: 'champ', q: '',
  iso: 0, isoT: 0.30,   /* §E306 过线曲面：0=关 1=半透壳 2=只描边；isoT = 局部占比阈值。
                            §E312 默认从 0.5 降到 0.35：实测收缩后场的峰值只有 40%，50% 是"正确地什么都不画"，
                            默认值必须落在有东西可画的那一段，否则用户第一次开壳就看到空图。*/
  isoField: 'ok',       /* §E312 'ok' = 局部过线概率 ‖ 'pot' = 势（F）归一化 —— 同一个壳引擎换场 */
  isoTok: 0.30, isoTpot: 0.67,
                        /* §E312 阈值**按场各存一份**：两场的量纲不是一回事。§E314 头号尺换成线上口径之后，
                           势场整条分布都挪了（先验 59%→63%、峰值 68%→70%）⇒ 旧默认 64% 离均值只剩 1pt，
                           壳圈进 338 枚、纯度 31%→23% = 又变成"什么都没圈"。新默认由 iso-sweep.mjs（已同步换尺）定：
                             ok 0.30 ⇒ 壳内 38 枚、纯度 66%（底率 16%）‖ 留一 27 枚里 3 枚 = 11%
                             pot 0.67 ⇒ 壳内 122 枚、纯度 28% ‖ 留一 117 枚里 25 枚 = 21%（这条规则挑出来的最高档）
                           ⇒ 反过来：**唯一"留一还站得住"的是势场那层**，过线场给的是形状、不是证据。
                           M0=5 是为了削掉边缘的孤点岛：单枚过线点最多抬到 (1+5·0.157)/6 = 0.298 < 0.30
                           ⇒ 一座壳至少要"几个过线的挤在一起"才长得出，用户看到的"只圈到边缘"那批岛就没了。*/
  ox: 0, oy: 0, k: 1, yaw: -Math.PI / 2, pit: Math.PI / 2, elev: 0, goodTop: true,
  ox3: 0, oy3: 0, zoom3: 1, hi: {}, bg: '#0f1522', ink: '#dce6f5', dim: '#9fb0cc',
  tKx: 1, tKy: 1, tX: 0, tY: 0,   /* §E312/§E314 谱系图那台相机（只影响 tree 视图；默认 1/1/0/0 = 与加相机之前逐像素相同）
                                     §E314 拆成横纵两把：滚轮管 tKx（时间），Shift+滚轮管 tKy（家族行）*/
  tTilt: 0, tShear: 0,            /* §E333 谱系图立体 = **不透视地板**的"原地上升"（用户否掉了压扁版）：
                                     tTilt = 把行方向按 cos 压扁（右键上下），tShear = 顺带一点横向错切（右键左右）。
                                     两者默认 0 ⇒ 立体态就是"同一张 2D 版式 + 点沿屏幕纵轴抬起"。*/
  isoGN: 72 };           /* §E312 壳的网格分辨率（沿最长轴的格数）：52 = 旧默认（棱面明显）‖ 72 ‖ 96 */
var DEF_COLOR = { '1d': 'fam', 'map': 'fam', '3db': 'F', 'tree': 'F' };   /* 三维行为轴与谱系图只能用颜色表示势 */
/* 地图模式的两个相机预设：**同一个方位角**（yaw 都是 −π/2），只差俯仰 —— 平面态 = 正俯视（pitch π/2，
 *   投影恰好退化为旧二维地图：x→右、y→上、各向异性缩放全保留）；立体态 = 同方位角下俯 0.40。
 *   §E296 之前 SOLID.yaw=0.62 ⇒ 切换时相机在"立起来"的同时绕竖轴转了 ~56°，整张图边立边转 ——
 *   用户点名"应该默认原地立起来"。现在平面→立体只压 pitch（yaw 不动）；立体→平面要回正 yaw（平面图必须北朝上）。*/
var FLAT = { yaw: -Math.PI / 2, pit: Math.PI / 2 }, SOLID = { yaw: -Math.PI / 2, pit: 0.40 };
/* §E333 谱系图**不用**这两个预设：它的"立体"是"原地上升 + 可选压扁/错切"，见 st.tTilt/st.tShear 与 drawTree 里的 PL。
 *   （§E332 那一版借 SOLID 的 pit 把地板压到 0.66 高 ⇒ 24 行塌成一条横带，被用户拿截图否掉了。）*/

/* §E314 势 = **线上口径**的 H + T·S（用户裁定把整张图换成玩家真正拿到的那个数）。
 *   旧写法是 d.H / 100（考卷口径 · ε=0 贪心）。两口径的**排名**同构（Spearman 0.912 / 全库 718 枚），
 *   但**电平不同构**：全库 Δε 中位只有 0.20pt，而现役是 8.10pt（第 99.6 百分位）⇒ 换尺主要改的是"谁吃亏"，
 *   不是"整体挪一挪"。考卷那个数仍在 d.H 里，悬停与 pm/duel 两种口径都还能读。*/
function Fv(d) { return d.Hp / 100 + st.T * d.S; }
/* 名次必须跟着尺重算：coords.tsv 的 rank 列是**考卷口径 + 出厂 T** 下算的，沿用就会把"第 N 名"读成旧尺。
 *   这段在装载时跑，而装载时 st.T 还没被人动过 ⇒ 它本身就是出厂 T，不再另存一份常数（§E278：注释/代码里不许复制数值）。*/
(function () { var o = DATA.map(function (d, i) { return i; }).sort(function (a, b) { return Fv(DATA[b]) - Fv(DATA[a]); });
  for (var k = 0; k < o.length; k++) { DATA[o[k]].rkExam = DATA[o[k]].rk; DATA[o[k]].rk = k + 1; } })();
function fRange() { var a = Infinity, b = -Infinity; for (var i = 0; i < N; i++) { var v = Fv(P[i]); if (v < a) a = v; if (v > b) b = v; } return [a, b]; }
/* §E297：顶/底由用户选。**只翻高度方向，不翻颜色**（颜色恒为"红 = F 高"，与点色同向）：
 *   goodTop=true  ⇒ 高度 = F（能量高的在上，冠军在峰顶）；false ⇒ 高度 = F_max − F（冠军在阱底）。*/
function u01(F, fr) { var rng = (fr[1] - fr[0]) || 1; return st.goodTop ? (F - fr[0]) / rng : (fr[1] - F) / rng; }
/* §E330 色带：**两端拉满、正中放中性灰**。旧表是青蓝 (24,150,196) → 紫灰 (131,102,126) → 红 (238,54,56)
 *   的单段线性插值，中段那个"偏紫的脏灰"正是用户点名"堆在灰色偏红、看不清"的底色之一。*/
var LUT = (function () { var o = [],
  S = [[0, [23, 96, 214]], [0.28, [66, 172, 236]], [0.5, [152, 160, 174]], [0.72, [240, 138, 58]], [1, [233, 36, 36]]];
  for (var i = 0; i < 256; i++) { var t = i / 255, k = 0;
    while (k < S.length - 2 && t > S[k + 1][0]) k++;
    var A = S[k], B = S[k + 1], f = (t - A[0]) / (B[0] - A[0]);
    o.push([Math.round(A[1][0] + (B[1][0] - A[1][0]) * f), Math.round(A[1][1] + (B[1][1] - A[1][1]) * f),
      Math.round(A[1][2] + (B[1][2] - A[1][2]) * f)]); }
  return o; })();
function rampRGB(tt) { var i = Math.max(0, Math.min(255, Math.round(tt * 255))); return LUT[i]; }
function ramp(tt) { var c = rampRGB(tt); return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
/* §E330 F 的色归一化换成**分位（秩）**，不用 min-max 线性。实测（901 枚 · 出厂 T）：
 *   F 的 min 0.169 ‖ p05 0.366 ‖ **中位 0.589** ‖ p95 0.704 ‖ max 0.795 ⇒ 线性带下中位归一化到 **0.671**，
 *   等于"一多半点全挤在带的红半边并且挤在一起"，而带的蓝半边几乎空着 —— 用户看到的两极失衡是这条归一化
 *   造成的，不是数据造成的。按秩铺色 = 每档塞同样多的点，中位数正好落在带的正中（中性灰）。
 *   ⚠ **只改颜色，不改几何**：u01()/高度/势场仍是线性 min-max —— 阱的深浅是**量的**比较，
 *     把高度也换成秩会把"差 0.02"和"差 0.2"画成同样高，那是另一种骗人。
 *   秩按 st.T 缓存（F = Hp/100 + T·S 跟着 T 变，排序也变）。*/
var FSRT = { tv: null, a: null };
function fSortedVals() { if (FSRT.tv !== st.T) { FSRT.a = P.map(function (d) { return Fv(d); }).sort(function (x, y) { return x - y; });
  FSRT.tv = st.T; } return FSRT.a; }
function bnd(a, v, inc) { var lo = 0, hi = a.length;   /* inc=false → 第一个 ≥v；inc=true → 第一个 >v */
  while (lo < hi) { var m = (lo + hi) >> 1; if ((inc ? a[m] <= v : a[m] < v)) lo = m + 1; else hi = m; } return lo; }
function fCol(F) { var a = fSortedVals(), n = a.length; if (n < 2) return 0.5;
  return Math.max(0, Math.min(1, ((bnd(a, F, false) + bnd(a, F, true)) / 2) / (n - 1))); }
function fMed() { var a = fSortedVals(); return a.length ? a[Math.floor(a.length / 2)] : 0; }
/* §E304 两套分组并存：'fam' = **训练方法/目标家族**（默认），'seed' = RNG 种子（旧口径，留着当对照）。
 *   颜色按黄金角铺 HSL ⇒ 22 个家族也不撞色，不用手写调色板（12 色那套一超过 12 家就开始重复）。*/
function hueAt(i) { return 'hsl(' + Math.round((i * 137.508) % 360) + ',' + (60 + (i % 3) * 10) + '%,' + (56 + (i % 2) * 12) + '%)'; }
function gk(d) { return String(st.color === 'seed' ? (d.seed || '?') : (d.fam || '?')); }
var GRP = { keys: [], cnt: {}, col: {} };
function buildGroups() { var cnt = {}, keys = [];
  for (var i = 0; i < N; i++) { var k = gk(P[i]); if (!(k in cnt)) { cnt[k] = 0; keys.push(k); } cnt[k]++; }
  keys.sort(function (x, y) { return cnt[y] - cnt[x] || ((+x) - (+y)); });
  var col = {}; for (var j = 0; j < keys.length; j++) col[keys[j]] = hueAt(j);
  GRP = { keys: keys, cnt: cnt, col: col }; }
buildGroups();
function colOf(d, fr) { if (st.color === 'fam' || st.color === 'seed') return GRP.col[gk(d)] || '#9aa8bd';
  if (st.color === 'gl') { var g = d.gl === null || d.gl === undefined ? -1 : d.gl;
    return g < 0 ? '#5a6478' : ramp(Math.max(0, Math.min(1, (g - GLR[0]) / (GLR[1] - GLR[0] || 1)))); }
  /* §E308 三档离色（不是渐变）：绿 = 实测能上槽，红 = 实测栽桩，灰 = 没测过（**不等于**没过）*/
  if (st.color === 'pm') { var v = d.pv; return v === 1 ? '#39d98a' : (v === 0 ? '#ff6b6b' : '#5a6478'); }
  /* §E310 第 4 条腿：对现役的配对决斗 A−B。绿 = 两批种子都赢，红 = 两批都输，黄 = 符号翻（判不动），灰 = 没测 */
  if (st.color === 'duel') { if (d.ds === 'same') return d.dm > 0 ? '#39d98a' : '#ff6b6b';
    return d.ds === 'flip' ? '#e0b13c' : '#5a6478'; }
  /* §E313 第 5 条腿：页面口径（ε=0.2 soft）的夺1率 —— 这才是玩家真正拿到的那个数。
   *   渐变沿用 ramp（与 F 同一条色标），但**分母换成实测到的那批的 p02..p98**，不用 0..100：
   *   全库页面 1st 落在 20~60%，用 0..100 会把所有点压成同一个蓝。*/
  if (st.color === 'hp') { if (d.hp === null) return '#5a6478';
    return ramp(Math.max(0, Math.min(1, (d.hp - EPR[0]) / (EPR[1] - EPR[0] || 1)))); }
  /* Δε = 考卷 − 页面：**发散色标，0 在正中**（红 = 开探索就掉 = 脆；蓝 = 开了反而强 = 吃探索）。
   *   不许用单向 ramp：单向色标会把"掉 1pt"和"掉 8pt"画成同色附近，而这条腿要读的正是符号。*/
  if (st.color === 'de') { if (d.de === null) return '#5a6478';
    var t = Math.max(-1, Math.min(1, d.de / 6)); return t >= 0 ? mix('#dce6f5', '#ff6b6b', t) : mix('#dce6f5', '#57a6ff', -t); }
  /* §E321 第 6 条腿：当选键（evalN · vs 脚本对 · 出厂 ε=0）上比现役强多少 —— 发散色标，0 在正中。
   *   读的是 Scd = 8 粒 seedBase 的**逐种子配对差**均值，不是主场那一粒（§E316：那把尺单枚就摆 5~9pt）。
   *   橙 = 同号数不到 6/8 ⇒ "方向一致但幅度判不动"，**不许并进赢**（与 duel 的黄色同一规矩）。*/
  if (st.color === 'sc') { if (d.scd === null) return '#5a6478';
    var ts = Math.max(-1, Math.min(1, d.scd / 8));
    var sc = ts >= 0 ? mix('#dce6f5', '#39d98a', ts) : mix('#dce6f5', '#ff6b6b', -ts);
    return (d.scs && d.scs.indexOf('+') > 0 && parseInt(d.scs, 10) < 6) ? '#e0b13c' : sc; }
  return ramp(fCol(Fv(d))); }
/* §E313 页面口径 1st 的显示区间（实测枚数的 p02..p98，同 GLR 的取法）*/
var EPR = (function () { var a = P.map(function (d) { return d.hp; }).filter(function (v) { return v !== null && isFinite(v); }).sort(function (x, y) { return x - y; });
  return a.length > 8 ? [a[Math.floor(a.length * .02)], a[Math.floor(a.length * .98)]] : [20, 60]; })();
function mix(c1, c2, t) {   /* 十六进制线性插值，t∈[0,1] */
  var p = function (c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; };
  var A = p(c1), B = p(c2);
  return 'rgb(' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }).join(',') + ')'; }
/* G(long) 的显示区间取全库 p02..p98（不用 0..8：那会把对比度全压在低段）*/
var GLR = (function () { var a = P.map(function (d) { return d.gl; }).filter(function (v) { return v !== null && v !== undefined && isFinite(v); }).sort(function (x, y) { return x - y; });
  return a.length > 8 ? [a[Math.floor(a.length * .02)], a[Math.floor(a.length * .98)]] : [0, 8]; })();
function alphaOf(d) { var n = 0; for (var kk in st.hi) if (st.hi[kk]) n++;
  /* §E308 上槽体检口径下 705/718 枚是"没测过"⇒ 不压暗就找不到那 13 枚（灰压到 0.16，实测过的照旧）*/
  if ((st.color === 'pm' && (d.pv === null || d.pv === undefined)) || (st.color === 'duel' && !d.ds) ||
      (st.color === 'de' && d.de === null) || (st.color === 'hp' && d.hp === null) ||
      (st.color === 'sc' && (d.scd === null || d.scd === undefined))) return 0.16;
  if (!n) return 1; return st.hi[gk(d)] ? 1 : 0.10; }
/* 家族短标：只取"改了什么"那一段并截断（长说明留给悬停），否则一个按钮吃掉整条图例栏。*/
function famLab(d) { return FAMLAB[d.fam] || ''; }
function famShort(d, n) { var s = String(famLab(d)).split(' ‖ ')[0] || ('家族 ' + d.fam);
  return s.length > (n || 26) ? s.slice(0, n || 26) + '…' : s; }
function tip(d, fr) {
  return d.id + (d.lin ? ' 【' + d.lin + '】' : '') + (d.kin ? ' 〔' + d.kin + '〕' : '') +
    /* §E334 同一份权重占了几行必须自己在明细里说：否则"这枚 F 名次 8"和"那枚名次 10"可能是**同一个包**。 */
    (d.dn > 1 ? '\\n⚠ 同一份权重在面板上占 ' + d.dn + ' 行：' + d.dups + '（它们不是几种打法，是一个包的几份拷贝）' : '') +
    '\\n家族 ' + d.fam + '（按训练方法/目标分）：' + (famLab(d) || '—') +
    '\\n　RNG seed 名字后缀=' + d.seed + ' ‖ META.seed=' + (d.ms || '—') + ' ‖ 训出 ' + (d.ts || '—') +
    '\\n　热启动父 ' + (d.par || '—') + (d.pof ? ' = ' + d.pof : (d.pnm ? '\\n　　' + d.pnm : '（父指针未落档）')) +
    (d.ok === 1 ? '  · 过线 ✓' : (d.ok === 0 ? '  · 未过线' : '')) +
    (d.ok === 0 && d.why ? '\\n　栽在：' + d.why : '') +
    '\\n名次 ' + d.rk + '/' + N + '（线上口径 · 出厂 T 下重算；旧考卷口径是第 ' + d.rkExam + ' 名）· 按当前 T 重排见一维视图' +
    '\\nHp 线上口径夺1率 = ' + d.Hp.toFixed(1) + '%（ε=0.2 soft · 图上的尺就是它）   H 考卷口径 = ' + d.H.toFixed(1) +
      '%（ε=0 贪心 · 旧尺，历史文档里的数）   Δε = ' + (d.De >= 0 ? '+' : '') + d.De.toFixed(1) + 'pt' +
      '\\n   S = ln G_eff = ' + d.S.toFixed(2) + '（G_eff ' + d.Ge.toFixed(2) + '）' +
    (d.gl === null || d.gl === undefined ? '' : '\\n长程广度 G(long) = ' + (+d.gl).toFixed(2) + (d.gl < 3 ? '  ← 低于闸要求的 3（这条腿最常卡前沿）' : '')) +
    (d.pv === null || d.pv === undefined ? '' : '\\n上槽体检（promote --dry 实测）：' + (d.pv === 1 ? '✅ 三条腿全过 —— 这枚真能换包' : '⛔ ' + d.pb)) +
    (d.ds ? '\\n对现役配对决斗 A−B = ' + d.da + ' ‖ ' + d.db + ' pt（' +
      (d.ds === 'flip' ? '两批种子符号翻 ⇒ 判不动，别引均值' : d.dm > 0 ? '两批都赢现役' : '两批都输给现役') + '）' : '') +
    /* §E313 部署口径那一行：H 是**考卷（ε=0 贪心）**的数，这一行给**页面（ε=0.2 soft）**的数 —— 玩家拿到的是后者。
     *   同时把"同包两 eval seed 极差 p50 = 1.5pt / p90 = 3.7pt"写进来，否则读者会把 1pt 的差当成差别。*/
    (d.de === null ? '' : '\\n部署口径（ε=0.2 soft · 两 eval seed 均值）= ' + d.hp.toFixed(1) + '%  vs 考卷 ' + d.he.toFixed(1) +
      '% ⇒ Δε = ' + (d.de >= 0 ? '+' : '') + d.de.toFixed(1) + 'pt（' +
      (d.de >= 3.41 ? '脆：开探索就掉，过线组第 94 百分位那一档' : d.de < 0 ? '吃探索：开了反而强' : '对探索口径不敏感') +
      '）‖ 噪声尺：同包两 seed 极差 p50 1.5 ‖ p90 3.7pt') +
    /* §E321 当选键那条腿：读的是 Scd（8 粒 seedBase 逐种子的**配对差**均值），不是主场那一粒。
     *   两个数一起印，正是因为 §E316 量到"主场值与均值可以差 2~3pt" —— 只印一个就会把读者送回抽签里。*/
    (d.scd === null ? '' : '\\n当选键 evalN（对脚本对手 · 出厂 ε=0 · 这枚 = ' + d.sc.toFixed(1) + '）：' +
      (d.id === 'SHIPPED-Ldemo' ? '★ 现役 = 参照本身' :
        '比现役 ' + (d.scd >= 0 ? '+' : '') + d.scd.toFixed(2) + 'pt ‖ 同号 ' + d.scs +
        '（' + (d.scd >= 2 && parseInt(d.scs, 10) >= 6 ? '在这把尺上赢现役' :
          d.scd > 0 ? '方向偏正但同号数不到 6/8 ⇒ 判不动' : '在这把尺上落后') + '）') +
      ' ‖ 主场那一粒(@987654) = ' + (d.sch === null ? '—' : d.sch.toFixed(1)) +
      '   ⚠ 这台仪器单枚换 seedBase 就摆 5~9pt（§E316），所以只比配对差、不比电平') +
    '\\nF = Hp + T·S = ' + Fv(d).toFixed(3) + '（线上口径）   高于地板 = F − F_min = ' + (Fv(d) - fr[0]).toFixed(3) +
    '\\n伤害/局 ' + d.dmg.toFixed(1) + ' · 重击 ' + d.heavy.toFixed(1) + ' · 盾 ' + d.holo.toFixed(1) +
    ' · 回合 ' + d.rounds.toFixed(1) + ' · 平局 ' + (d.draw * 100).toFixed(0) + '%' +
    '\\n座位极差 ' + d.seat.toFixed(0) + 'pt · 技能种类 ' + d.keys + ' · 蓄能/局 ' + d.chg.toFixed(1) +
    ' · 珠浪费 ' + (d.waste * 100).toFixed(0) + '% · 无威胁摆架势 ' + (d.stance * 100).toFixed(0) + '%';
}
function fit0() { var r = cv.getBoundingClientRect(); cv.width = Math.max(1, r.width * devicePixelRatio); cv.height = Math.max(1, r.height * devicePixelRatio); }
function pct(a, q) { var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.max(0, Math.min(b.length - 1, Math.floor(q * b.length)))]; }

/* ---- 势场：邻域缓存（每套"坐标轴 × 屏幕比例尺"一次）+ 位图（每次换 T 只重算加权和） ----
 *   §E296：距离一律按**屏幕度量**算（dx·bx, dy·byy）。数据空间的圆上屏是 ~4:1 的扁椭圆
 *   （bx≈295 px/单位 vs byy≈74），而且扁的那根轴上淡出半径只盖 ~8px、点距 ~37px ⇒ 中间大片空位。
 *   按屏幕度量 ⇒ 势晕是正圆且互相搭接。比例尺取**不含缩放**的基础值（缩放对两轴均匀，
 *   位图随仿射一起放大即可，不必重烘）；窗口尺寸变了才重建（resize 时清 NBK）。*/
var NBK = {}, FL = null;
function buildNB(key, bx, byy) {
  var ax = key.slice(0, 2), by = key.slice(2, 4);
  var xs = new Float32Array(N), ys = new Float32Array(N), xa = [], ya = [];
  for (var i = 0; i < N; i++) { xa.push(P[i][ax]); ya.push(P[i][by]); }
  /* 两套范围分开：**视野拟合用截尾**（默认视图不被离群点压扁），**势场网格用全体点的 min/max + 3% 边距**
   *   （用户 10-04：「背景图直接扩散到所有点的范围」——截尾框外的离群点脚下是空的，看着割裂）。*/
  var px0 = pct(xa, .005), px1 = pct(xa, .995), py0 = pct(ya, .005), py1 = pct(ya, .995);
  var x0 = Math.min.apply(null, xa), x1 = Math.max.apply(null, xa);
  var y0 = Math.min.apply(null, ya), y1 = Math.max.apply(null, ya);
  /* §E331 网格边距 3% → 10%：位图铺到"最外一圈点的晕**淡尽**"之外，而不是贴着点云切一刀。
   *   平面态看不出问题（晕外就是底色），立体态那块底板是一整块平行四边形 ⇒ 边缘直接割裂（用户截图）。
   *   底色 = 晕尽处的颜色 ⇒ 板的边界在视觉上不存在了。*/
  var mgx = (x1 - x0) * 0.10, mgy = (y1 - y0) * 0.10; x0 -= mgx; x1 += mgx; y0 -= mgy; y1 += mgy;
  for (i = 0; i < N; i++) { xs[i] = P[i][ax]; ys[i] = P[i][by]; }
  var nn = [], d12 = [];
  for (i = 0; i < N; i++) {
    /* 每枚点顺带维护"最近 12 名"插入表：nn[0] = 最近邻（淡出的老基准，实测只有 ~5px——
     *   家族内部挤成一撮 ⇒ 半径跟着挤成一撮，中间全是空位）；d12 = 第 12 近邻（邻域填满的尺度）。
     *   §E296 实测：nmed=5.1px 而 d12 中位=19.6px ⇒ 淡出半径改按 2.2×d12（≈43px，覆盖率 26%→50%+）、
     *   过线盘半径改按 1.6×d12（≈31px，21 格→321 格）。*/
    var heap = [];
    for (var j = 0; j < N; j++) if (j !== i) {
      var ex = (xs[i] - xs[j]) * bx, ey = (ys[i] - ys[j]) * byy, dd = Math.sqrt(ex * ex + ey * ey);
      if (heap.length < 12) { heap.push(dd); heap.sort(function (a, b) { return a - b; }); }
      else if (dd < heap[11]) { heap[11] = dd; heap.sort(function (a, b) { return a - b; }); }
    }
    nn.push(heap[0] || 1); d12.push(heap[11] || heap[0] || 1);
  }
  var nmed = pct(nn, .5) || 1, d12m = pct(d12, .5) || nmed;
  /* 网格按屏幕显示跨度分配 ⇒ 显示空间里格子是正方形（26k 格左右），势晕才不会被栅格化成扁的 */
  var dispX = (x1 - x0) * bx, dispY = (y1 - y0) * byy, TOT = 40000;   /* §E331 26000 → 40000：晕半径缩了一档，格子必须跟着密，
                                                                         否则 9px/格 上画 29px 的晕会看出台阶 */
  var gx = Math.max(40, Math.min(320, Math.round(Math.sqrt(TOT * dispX / (dispY || 1)) || 40)));
  var gy = Math.max(40, Math.min(320, Math.round(Math.sqrt(TOT * dispY / (dispX || 1)) || 40)));
  var idx = new Int16Array(gx * gy * KF), dst = new Float32Array(gx * gy * KF);
  var SW = new Float32Array(gx * gy), SH = new Float32Array(gx * gy), SS = new Float32Array(gx * gy);
  for (var gj = 0; gj < gy; gj++) for (var gi = 0; gi < gx; gi++) {
    var X = x0 + (x1 - x0) * gi / (gx - 1), Y = y0 + (y1 - y0) * gj / (gy - 1);
    var ci = gj * gx + gi, base = ci * KF;
    for (var q = 0; q < KF; q++) { idx[base + q] = -1; dst[base + q] = 1e18; }
    for (var c2 = 0; c2 < N; c2++) {
      var ex2 = (xs[c2] - X) * bx, ey2 = (ys[c2] - Y) * byy, d2 = Math.sqrt(ex2 * ex2 + ey2 * ey2);
      if (d2 < dst[base + KF - 1]) {
        var pos = KF - 1;
        while (pos > 0 && dst[base + pos - 1] > d2) { dst[base + pos] = dst[base + pos - 1]; idx[base + pos] = idx[base + pos - 1]; pos--; }
        dst[base + pos] = d2; idx[base + pos] = c2;
      }
    }
    var wsum = 0, hsum = 0, ssum = 0;
    for (var u = 0; u < KF; u++) { var pi = idx[base + u]; if (pi < 0) break;
      var w = 1 / Math.pow(Math.max(dst[base + u], 1e-6), KEXP); wsum += w; hsum += w * (P[pi].H / 100); ssum += w * P[pi].S; }
    SW[ci] = wsum; SH[ci] = hsum; SS[ci] = ssum;
  }
  /* 守卫：坐标列名取错时 pct 会**静默**返回 undefined ⇒ 距离全是 NaN ⇒ 一格邻居都没有 ⇒ 整页画空。
   *   这一版 2D 就是这么"什么都没画"的（by 拼成 '2' 而不是 'y2'）。空画布比红字坏得多 ⇒ 必须抛出来。*/
  var nz = 0; for (var zi = 0; zi < gx * gy; zi++) if (SW[zi] > 0) nz++;
  if (!(x1 > x0) || !(y1 > y0) || !(nmed > 0) || nz < gx * gy * 0.9) {
    throw new Error('坐标轴 ' + ax + '/' + by + ' 构建失败（x ' + x0 + '~' + x1 + '，y ' + y0 + '~' + y1 +
      '，有邻格 ' + nz + '/' + (gx * gy) + '）');
  }
  /* §E302 二维**不画"过线范围"**（用户裁定：绿区会把底图盖掉 ⇒ 删）。这里留一段判据说明，免得下一轮又有人来"修半径"：
   *   范围这个表示本身不成立 —— DS 实测过线点到最近未过线点的中位距离只有 6.5px，而 718 枚里 605 枚未过线，
   *   所以"过线点固定半径盘并"任何半径都是二选一的假范围（r=1.2×nmed ⇒ 圈住过线 113 + 未过线 100 = 纯度 53.1%）；
   *   我换的"局部过线率场 + 插值等值线"能把纯度做到 88%，但代价是绿区糊在底图上、且只圈到两成过线枚。
   *   ⇒ 过线只按**逐枚真值**标（drawMap 里的绿环），悬停明细给"栽在哪条腿"。*/
  NBK[key] = { idx: idx, dst: dst, SW: SW, SH: SH, SS: SS, x0: x0, x1: x1, y0: y0, y1: y1,
    px0: px0, px1: px1, py0: py0, py1: py1, nmed: nmed, d12m: d12m, ax: ax, by: by, gx: gx, gy: gy };
}
/* 每格只需 (SH + T·SS)/SW ⇒ 换 T 不碰邻域。
 * 位图**不透明**：每格把势色按覆盖度合成到底色上（远格 = 纯底色）⇒
 *   平面态没有"雾蒙蒙"的半透明晕，立体态没有透明边的割裂/接缝（位图边界之外就是底色）。*/
function buildBitmap(key) {
  var nb = NBK[key];
  var fscale = Math.max(1.5 * nb.d12m, 14);   /* §E331 淡出尺度 2.2× → 1.5× 第12近邻中位（≈29px）：
                                                 单点的"实心"范围缩一档 ⇒ 立体态不再糊成一整块熔岩。
                                                 **中间不会因此裂开** —— 覆盖度是各点核权重相加（见下面 fade），
                                                 邻域只要有两三枚，权重和照样过阈 ⇒ 裂开的正是旧版按"最近点距离"才会有的病。*/
  var kcov = 1 / Math.pow(fscale, KEXP);      /* = 单点在 fscale 处的核权重：覆盖度在半径 fscale 处正好落一半 */
  var bR = parseInt(st.bg.slice(1, 3), 16), bG = parseInt(st.bg.slice(3, 5), 16), bB = parseInt(st.bg.slice(5, 7), 16);
  var c = document.createElement('canvas'); c.width = nb.gx; c.height = nb.gy;
  var cg = c.getContext('2d'), img = cg.createImageData(nb.gx, nb.gy), dta = img.data;
  for (var i = 0; i < nb.gx * nb.gy; i++) {
    var wsum = nb.SW[i]; if (!(wsum > 0)) continue;
    /* §E331 覆盖度换成**核权重和**，不用「到最近点的距离」。旧写法 1/(1+(DM/fscale)^4) 在两枚点中间
     *   必然下凹（DM 在 Voronoi 脊线上取局部极大）⇒ 底图上那一片"凹陷的接缝"就是脊线本身，跟数据无关，
     *   是度量的形状病。SW = Σ1/d^KEXP 是各点晕的**相加**，靠近谁都不减 ⇒ 相邻晕平滑搭接。
     *   ⚠ 但 cov 永远 > 0（每格都取得到 12 个邻居）⇒ 板的**外沿**是一圈"差一点点"的颜色，
     *     平面态看不出来，立体态那块平行四边形的边就被这条 17/255 的台阶画出来了（实测 edgeDev 顶 17 ‖ 底 14 ‖ 左 13 ‖ 右 8）。
     *     所以再乘一个**贴边收口**：最外 EDGEK 格线性拉到 0 ⇒ 板的边界与底色逐像素相同，边缘不存在。
     *     10% 的网格边距（buildNB）保证这 EDGEK 格全在点云之外的空裙里，不会把晕切一刀。*/
    var gi = i % nb.gx, gj = (i / nb.gx) | 0;
    var fade = wsum / (wsum + kcov) * Math.min(1, Math.min(gi, nb.gx - 1 - gi, gj, nb.gy - 1 - gj) / EDGEK);
    /* §E297：地板色一直按 U = F_max − F 上色 ⇒ 与图例（红=阱口/蓝=阱底）和点色**全部反了**
     *   （实测最好那枚脚下是红 [101,64,81]、最差那枚脚下是蓝 [60,109,141]）。改成直接按 F 上色。*/
    var Fav = (nb.SH[i] + st.T * nb.SS[i]) / wsum;
    var tt = fCol(Fav);                            /* 红 = F 高 = 最好，蓝 = F 低 = 最差（与点色/图例同向）*/
    var rgb = rampRGB(tt);
    var a = (0.92 - 0.5 * tt) * fade;
    var o = i * 4;
    dta[o] = Math.round(bR + (rgb[0] - bR) * a);
    dta[o + 1] = Math.round(bG + (rgb[1] - bG) * a);
    dta[o + 2] = Math.round(bB + (rgb[2] - bB) * a);
    dta[o + 3] = 255;
  }
  cg.putImageData(img, 0, 0);
  FL = { c: c, px: dta, key: key, tv: st.T, bgc: st.bg, x0: nb.x0, x1: nb.x1, y0: nb.y0, y1: nb.y1,
    nmed: nb.nmed, ax: nb.ax, by: nb.by, gx: nb.gx, gy: nb.gy };
}
function ensureField(key, bx, byy) {
  var k2 = key + '@' + Math.round(bx) + ',' + Math.round(byy);   /* 比例尺进缓存键：窗口尺寸变了才重建 */
  if (!NBK[k2]) buildNB(k2, bx, byy);
  if (!FL || FL.key !== k2 || FL.tv !== st.T || FL.bgc !== st.bg) buildBitmap(k2);
}
/* ---- 通用：标签贪心避让（撞了就不画，冠军宁可错开一行） ---- */
var boxes = [];
function labelReset() { boxes = []; }
function drawText(txt, x, ybase, rot) {
  /* §E333 逐枚挑字色：底图换成按分位铺色之后，红/蓝块上盖统一字色就读不出来了（用户点名）。
   *   候选就是主题自己那两色（st.ink / st.bg）⇒ 取标签那块**底片**的平均亮度，谁对比大用谁，
   *   再补一圈**反色细描边**（halo）—— 因为一块字经常横跨"红块 + 黑底"，只挑一色还是会糊。
   *   ⚠ 必须在**变换之前**取色：getImageData 读的是设备像素，旋转时边界框是错的（那一支改用当前主题字色）。*/
  var ink = st.ink, halo = st.bg;
  if (!rot && !LUMQ.off) {
    var L = patchLum(x, ybase, g.measureText(txt).width, 13 * devicePixelRatio);
    if (L !== null) { if (L < 0.5) { ink = st.ink; halo = st.bg; } else { ink = st.bg; halo = st.ink; } }
  }
  g.fillStyle = ink; g.lineJoin = 'round'; g.lineWidth = 2.6 * devicePixelRatio; g.strokeStyle = halo;
  if (rot) { g.save(); g.translate(x, ybase); g.rotate(-Math.PI / 2);
    g.strokeText(txt, 0, 0); g.fillText(txt, 0, 0); g.restore(); return; }
  g.strokeText(txt, x, ybase); g.fillText(txt, x, ybase);
}
/* 底片平均亮度（0..1）。每帧只算一次、按 12px 网格取整缓存：拖一次 ~60 个标签 × getImageData 是看得出来的开销。*/
var LUMQ = { off: false, box: {}, frame: -1 };
function patchLum(x, y, w2, h2) {
  var bx = Math.max(0, Math.round(x / 12) * 12), by = Math.max(0, Math.round((y - h2) / 12) * 12);
  var bw = Math.max(12, Math.round(w2 / 12) * 12), bh = Math.max(12, Math.round(h2 / 12) * 12);
  if (bx + bw > cv.width || by + bh > cv.height) return null;
  var k = bx + ',' + by + ',' + bw + ',' + bh, hit = LUMQ.box[k];
  if (hit && hit.f === LUMQ.frame) return hit.v;
  var d; try { d = g.getImageData(bx, by, bw, bh).data; } catch (e) { LUMQ.off = true; return null; }
  var s = 0, n = 0;
  for (var i = 0; i < d.length; i += 4 * 5) { s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; n++; }
  var v = n ? s / n : null; LUMQ.box[k] = { f: LUMQ.frame, v: v }; return v;
}
function putLabel(txt, x, y, force, rot) {
  g.font = (11 * devicePixelRatio) + 'px system-ui,sans-serif';
  var bw = g.measureText(txt).width, bh = 13 * devicePixelRatio;
  if (rot) {
    /* 旋转标签向上伸 ⇒ 窗口偏矮时最高那几枚的名字顶出画布上沿（用户：「一维被裁掉了一块」）。
       把锚点压回画布内；压得离点太远（> 2.2× 字宽）的非冠军标签宁可不画。 */
    var ay = Math.max(y - 4, bw - bh + 2 * devicePixelRatio);
    if (ay - (y - 4) > bw * 2.2 && !force) return false;
    var cand = [[Math.max(2, x + 5), ay, bh, bw], [Math.max(2, x + 5 + bh), ay, bh, bw]];
    for (var c = 0; c < cand.length; c++) { var r = cand[c], hit = false;
      for (var b = 0; b < boxes.length; b++) if (r[0] < boxes[b][0] + boxes[b][2] && r[0] + r[2] > boxes[b][0] &&
        r[1] < boxes[b][1] + boxes[b][3] && r[1] + r[3] > boxes[b][1]) { hit = true; break; }
      if (!hit || c === cand.length - 1) {
        if (!hit || force) { boxes.push(r); drawText(txt, r[0], r[1] + bh, true); return true; }
      }
    }
    return false;
  }
  /* 横向标签也要卡进画布：右缘/下缘外的名字以前就直接画没了 */
  var bx = Math.min(x + 8, cv.width - bw - 4 * devicePixelRatio), by = Math.min(Math.max(y - 5, 2), cv.height - bh - 2), hit2 = false;
  for (var b2 = 0; b2 < boxes.length; b2++) if (bx < boxes[b2][0] + boxes[b2][2] && bx + bw > boxes[b2][0] &&
    by < boxes[b2][1] + boxes[b2][3] && by + bh > boxes[b2][1]) { hit2 = true; break; }
  if (hit2 && !force) return false;
  if (hit2) by += bh;
  boxes.push([bx, by, bw, bh]); drawText(txt, bx, by + bh - 3, false); return true;
}
function wantLabel(d) {
  if (st.labels === 'off') return false;
  if (st.hi[gk(d)]) return true;
  if (st.q && d.id.indexOf(st.q) >= 0) return true;
  if (st.labels === 'all') return true;
  /* §E330 父链那几枚必须常驻：它们不是冠军、名次也不显眼（E51-t8-713 排 61），落在"零散实验"那一行里
   *   ⇒ 不点名就找不到，而用户问的正是"现役的祖先在图上哪去了"。 */
  return !!d.lin || d.kin === '父链' || d.rk <= 12 || d.rk > N - 6;
}
function labelSet() {
  var out = [];
  for (var i = 0; i < N; i++) if (wantLabel(P[i])) out.push({ i: i, pri: (P[i].lin || P[i].kin === '父链') ? 0 : (P[i].rk <= 12 ? 1 : 2) });
  out.sort(function (a, b) { return a.pri - b.pri || P[a.i].rk - P[b.i].rk; });
  return out;
}

/* ---- ④ 一维：F 排序带（718 枚全可数、零重叠）+ 下面一条 H / T·S 分解 ---- */
function draw1(fr) {
  var w = cv.width, h = cv.height, i;
  clear(w, h);
  var pad = 26 * devicePixelRatio, band = h * 0.16, base = h * 0.70;
  var ord = []; for (i = 0; i < N; i++) ord.push(i);
  ord.sort(function (a, b) { return Fv(P[b]) - Fv(P[a]); });
  g.strokeStyle = st.dim; g.lineWidth = 1;
  g.beginPath(); g.moveTo(pad, base); g.lineTo(w - pad, base); g.stroke();
  g.fillStyle = st.dim; g.font = (12 * devicePixelRatio) + 'px system-ui,sans-serif';
  g.fillText('名次（按当前 T 重排）→', pad, base + 46 * devicePixelRatio);
  g.fillText('纵轴 = F = Hp + T·S（Hp = 线上口径夺1率 · F 越高越好）：' + (st.goodTop ? '越高 = 越好，贴基线 = 最差' : '贴基线 = 最好（冠军在底），越高 = 越差'), w * 0.34, band - 10 * devicePixelRatio);
  scr = new Array(N);
  var dx = (w - 2 * pad) / (N - 1);
  for (i = 0; i < N; i++) {
    var d = P[ord[i]], x = pad + i * dx, y = base - u01(Fv(d), fr) * (base - band);
    scr[ord[i]] = [x, y];
    var al = alphaOf(d);
    /* 718 根柱子挤在 1500px 里会糊成一整块（第一版就是这样）⇒ 只给冠军/被点选的家族画茎，其余留点。
       注意别写成 al > 0.5：没高亮时 al 恒为 1，那个条件等于"全都画"。 */
    if (d.lin || st.hi[gk(d)]) {
      g.globalAlpha = al * 0.55;
      g.strokeStyle = colOf(d, fr); g.lineWidth = (d.lin ? 1.6 : 0.8) * devicePixelRatio;
      g.beginPath(); g.moveTo(x, base); g.lineTo(x, y); g.stroke();
    }
    g.globalAlpha = al;
    g.beginPath(); g.arc(x, y, (d.lin ? 5 : 2.6) * st.size, 0, 6.284); g.fillStyle = colOf(d, fr); g.fill();
    if (d.lin && al > 0.5) { g.strokeStyle = st.ink; g.lineWidth = 1.4; g.stroke(); }
    /* 分解条：蓝 = Hp（线上口径夺1率），黄 = T·S（广度）。谁靠哪一头站在这上面一眼可见。
       §E314：必须用 Hp 而不是 H —— 纵轴位置已经是 Hp + T·S，蓝条若还画 H 就变成"位置与分解两个口径"，
       那正是本仓反复踩的"图上画一个数、旁边一行另一个口径的数"。*/
    var hh = (d.Hp / 100), ss = st.T * d.S, tot = hh + Math.abs(ss) || 1;
    var bh = 9 * devicePixelRatio;
    g.globalAlpha = al * 0.9;
    g.fillStyle = '#4c9ff5'; g.fillRect(x - dx * 0.42, base + 8 * devicePixelRatio, Math.max(1, dx * 0.84 * hh / tot), bh);
    g.fillStyle = '#f2c94c'; g.fillRect(x - dx * 0.42 + Math.max(1, dx * 0.84 * hh / tot), base + 8 * devicePixelRatio, Math.max(1, dx * 0.84 * Math.abs(ss) / tot), bh);
    g.globalAlpha = 1;
  }
  labelReset(); g.fillStyle = st.ink;
  var ls = labelSet();
  for (i = 0; i < ls.length; i++) { var p = scr[ls[i].i]; if (!p) continue;
    putLabel((P[ls[i].i].id === 'SHIPPED-Ldemo' ? '★' : '') + P[ls[i].i].id, p[0], p[1], !!P[ls[i].i].lin, true); }
  g.fillStyle = st.dim; g.font = (12 * devicePixelRatio) + 'px system-ui,sans-serif';
  g.fillText('一维：位置 = F 名次（下方蓝条 = Hp 线上口径夺1率，黄条 = T·S）· 悬停看明细 · 点家族图例可高亮', pad, h - 14 * devicePixelRatio);
}

/* §E332 把谱系图的**版式**（车道带 + 左栏家族名/统计 + 左右分界 + 日期竖线与刻度）烘成一张离屏画布。
 *   为什么要烘：立体态要把整张版式当**底图**贴到倾斜平面上（用户："把这个网格和标签当做地图模式的底图，
 *   然后仿照地图的模式做渲染，这样对应也好"）。前一版只把点抬起来、标签留在原地 ⇒ "右边的点进了 3D、
 *   左边的字还在 2D"，读不出谁属于谁。烘一次之后平面/立体共用同一张图、同一个矩阵 ⇒ 错位这件事在结构上不可能。
 *   ⚠ 页脚说明与 RUNNER-BASE 那条注**不进底图** —— 它们是轴饰，跟着相机转就没人读得了（§E314 同一个理由）。*/
var CHM = null;
function treeChrome(w, h, fams, rowH, padL, padT, padB, tmin, tmax, X, WX, WY, ff) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var t = c.getContext('2d'), i, TKY = st.tKy;
  t.font = ff(11);
  for (i = 0; i < fams.length; i++) {
    var f = fams[i], mem = P.filter(function (d) { return d.fam === f; });
    var nOk = mem.filter(function (d) { return d.ok === 1; }).length, nCh = mem.filter(function (d) { return d.lin; }).length;
    var best = Math.min.apply(null, mem.map(function (d) { return d.rk; }));
    t.fillStyle = i % 2 ? 'rgba(255,255,255,.028)' : 'rgba(255,255,255,.0)';
    /* §E314 行带 = 整幅宽、不跟横轴走；家族名/统计两行钉在左栏（只跟纵轴）*/
    t.fillRect(0, WY(padT + i * rowH), w, rowH * TKY);
    t.fillStyle = st.ink; t.textAlign = 'right';
    t.fillText(('家族 ' + f + ' · ' + famShort({ fam: f }, 15)), padL - 12 * devicePixelRatio, WY(padT + i * rowH + rowH * 0.46));
    t.fillStyle = st.dim; t.font = ff(10);
    t.fillText(mem.length + ' 枚 · 过线 ' + nOk + ' · 冠军 ' + nCh + ' · 最好名次 ' + best, padL - 12 * devicePixelRatio, WY(padT + i * rowH + rowH * 0.88));
    t.font = ff(11);
  }
  t.textAlign = 'left';
  t.strokeStyle = 'rgba(159,176,204,.22)'; t.lineWidth = 1;
  t.beginPath(); t.moveTo(padL - 6, 0); t.lineTo(padL - 6, h); t.stroke();
  var day = 86400000;
  for (var tt2 = Math.ceil(tmin / day) * day; tt2 <= tmax; tt2 += day) {
    var xx = WX(X(tt2)); t.strokeStyle = 'rgba(159,176,204,.16)'; t.lineWidth = 1;
    var gy0 = Math.max(0, WY(padT)), gy1 = Math.min(h, WY(h - padB));
    if (xx > padL - 60 && xx < w + 60 && gy1 > gy0) {
      t.beginPath(); t.moveTo(xx, gy0); t.lineTo(xx, gy1); t.stroke();
      t.fillStyle = st.dim; t.font = (10 * devicePixelRatio) + 'px system-ui,sans-serif';
      t.fillText(new Date(tt2).toISOString().slice(5, 10), xx + 3, h - padB + 16 * devicePixelRatio);
    } }
  return c;
}

/* ⑤ §E304 谱系图：**行 = 家族（按最早 ts 排，所以从上往下就是时间推进）**，横轴 = 训练时刻。
 *   为什么需要它：二维/三维那张图回答"这枚长什么样"，回答不了"哪一次方法改动把 F 抬上去了"——
 *   后者要的是 (家族 × 时间) 的排布，而且必须能看见**热启动父**这条血统边。
 *   颜色恒为 F（行已经把家族表达了，再按家族上色就是重复编码）；绿环 = 过线，墨环 = 历代冠军。
 *   ⚠ 血统边只有 133/717 枚能连上：「hotstartFrom」是**权重哈希** —— 这段注释里不能出现反引号：本文件的整段 JS
 *     注释里出现反引号会把字符串截断（第一版就是这么崩的 SyntaxError）⇒ 这段以后统一用「」而不是反引号。
 *     父往往是"当时的现役冠军"、那一枚后来被覆写没留档 ⇒ 81% 的包共用同一个查无此人的祖先 d13d3c85（这条本身就是个结论）。*/
function drawTree(fr) {
  var w = cv.width, h = cv.height, i;
  clear(w, h);
  /* §E312/§E314 谱系图相机 = **横纵分开**（用户："改成横纵轴分别缩放的版本，类似经典统计图缩放"）
   *   滚轮 = 横轴（时间）‖ Shift+滚轮 = 纵轴（家族行）‖ 各自以光标为锚。
   *   两轴独立之后，"把 22 行拉开好读"和"把某一天那批点拉开看散度"是两件事，不必再互相绑架
   *   （旧版单一 tK 下想把行拉开就会把时间轴也吹出画布，反之亦然）。
   *   ⚠ 点半径**不跟缩放**（经典统计图就是这个约定：放大是为了分开位置，不是为了把点吹大）；
   *     只有左栏家族名跟纵轴长（行高了，字不跟着长就读不出那是同一行）。*/
  var TKX = st.tKx, TKY = st.tKy, TPX = st.tX, TPY = st.tY;
  var WX = function (x) { return x * TKX + TPX; }, WY = function (y) { return y * TKY + TPY; };
  var ff = function (n) { return (n * devicePixelRatio * Math.max(0.8, Math.min(2.4, TKY))) + 'px system-ui,sans-serif'; };
  var fams = [], fset = {};
  for (i = 0; i < N; i++) if (P[i].fam && !fset[P[i].fam]) { fset[P[i].fam] = 1; fams.push(P[i].fam); }
  fams.sort(function (a, b) { return a - b; });
  var tmin = Infinity, tmax = -Infinity;
  for (i = 0; i < N; i++) { var tv = Date.parse(P[i].ts); if (isFinite(tv)) { if (tv < tmin) tmin = tv; if (tv > tmax) tmax = tv; } }
  if (!(tmax > tmin)) { g.fillStyle = st.dim; g.fillText('没有可用的 ts ⇒ 谱系图画不了（要 lineage.tsv）', 30 * devicePixelRatio, 60); return; }
  var padL = 340 * devicePixelRatio, padR = 26 * devicePixelRatio, padT = 40 * devicePixelRatio, padB = 66 * devicePixelRatio;
  var rowH = (h - padT - padB) / fams.length, X = function (tv) { return padL + (tv - tmin) / (tmax - tmin) * (w - padL - padR); };
  /* §E333 立体要**上面留一条抬升带**：不然最上面几家的点一抬就顶出画布（它们本来就在顶上）。
   *   做法 = 把整张地板往下挤 LIFT·T3，行距按剩下的空间重排 ⇒ 行仍然全在画布内，
   *   而"原地上升"有了去处。挤完 padT/rowH 就是立体版的那张版式，底图与点共用同一套 ⇒ 不会错位。*/
  var LIFT = (h - padT - padB) * 0.22;
  if (st.elev > 1e-4) { padT += LIFT * st.elev; rowH = (h - padT - padB) / fams.length; }
  var KS = 1;   /* §E314 点半径不跟缩放（经典统计图约定）—— 保留这个名字是因为下面两处按它算半径 */
  /* ===== §E332 底图 = 一张离屏画布（车道带 + 左栏家族名/统计 + 分界 + 日期竖线与刻度）=====
   *   用户裁定：「把这个网格和标签当做地图模式的底图，然后仿照地图的模式做渲染，这样对应也好」。
   *   所以立体态不再自己造一套斜切：整张版式**烘一次** ⇒ 平面按恒等贴、立体按倾斜仿射贴
   *   （与 drawMap 贴 FL.c 同一条路径），点用**同一个投影**抬起来 ⇒ 点与它那一行的名字必然对齐，
   *   因为两者出自同一张图、同一个矩阵 —— 前一版"只有右边的点进了 3D、左边标签还在原地"就是两套坐标各画各的。*/
  var ck = [w, h, TKX.toFixed(4), TKY.toFixed(4), TPX.toFixed(1), TPY.toFixed(1), fams.join(','), tmin, tmax, st.ink, st.dim, devicePixelRatio,
    st.elev.toFixed(3), st.tTilt.toFixed(3)].join('|');   /* §E333 抬升带会挤行距 ⇒ 立体度/倾角进缓存键，否则切 3D 用的还是平面那张底图 */
  if (!CHM || CHM.k !== ck) CHM = { k: ck, c: treeChrome(w, h, fams, rowH, padL, padT, padB, tmin, tmax, X, WX, WY, ff) };
  var T3 = st.elev, TH = st.tTilt * T3, SH = st.tShear * T3, uc = w / 2, vc = h / 2;
  /* §E333 立体 = **原地上升**，不是把地板压扁。用户两张截图点名的病：上一版借地图那台相机（pit 0.72 ⇒ 行方向
   *   只剩 cos = 0.66 的高度），24 行被挤成一条横带，格内抖动又被我挪去横方向 ⇒ 比二维更挤。
   *   现在：地板按二维那张版式贴（行方向最多按 tTilt 轻微压扁），点沿**屏幕纵轴**抬起，每枚留一根立柱接回自己那一格。
   *   T3=0 ⇒ cos(0)=1、错切 0、抬升 0 ⇒ 逐字等于二维；TH/SH 只由右键拖动给，默认 0。*/
  function PL(u, v, z) { return [u + (v - vc) * SH, vc + (v - vc) * Math.cos(TH) - (z || 0)]; }
  var q0 = PL(0, 0, 0), qX = PL(w, 0, 0), qY = PL(0, h, 0);
  g.save();
  g.setTransform((qX[0] - q0[0]) / w, (qX[1] - q0[1]) / w, (qY[0] - q0[0]) / h, (qY[1] - q0[1]) / h, q0[0], q0[1]);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(CHM.c, 0, 0);
  g.restore(); g.setTransform(1, 0, 0, 1, 0, 0);
  var FR3 = fRange();
  g.save();
  if (T3 < 0.02) { g.beginPath(); g.rect(padL - 5, 0, w - padL + 5, h); g.clip(); }   /* 平面态：数据层不许进左栏（立体态标签已在底图里，让点浮在上面）*/
  /* 血统边（画在点底下，免得盖住点）*/
  /* 每枚的落点 = 底图上那一格 (u,v)（**与二维逐字同一套坐标**，含格内纵向抖动）+ 按 F 抬起来的 z。
   *   高度用**线性** min-max，不用 §E330 那套按秩铺色 —— 秩是"颜色要能分开"的读法，几何要的是量的比较。
   *   ⚠ 格内抖动（同一秒训出的一撮）**两态都留在纵方向**：上一版把它挪去横方向，正逢地板被压扁 ⇒ 一撮点全叠成一条横线。
   *   立体态反而要它：同一格里纵向散开一点才好观察（用户点名）。*/
  var pos = {}, base = {};
  function PT(i) {
    var d = P[i], tv = Date.parse(d.ts); if (!isFinite(tv)) return null;
    var ri = fams.indexOf(d.fam); if (ri < 0) return null;
    var jit = ((i * 2654435761) % 1000) / 1000 - 0.5;
    var u = WX(X(tv)), v = WY(padT + (ri + 0.5) * rowH) + jit * rowH * 0.66 * TKY;
    var uf = Math.max(0, Math.min(1, (Fv(d) - FR3[0]) / ((FR3[1] - FR3[0]) || 1)));
    return [PL(u, v, uf * LIFT * T3), PL(u, v, 0)];
  }
  for (i = 0; i < N; i++) { var q = PT(i); if (!q) continue; pos[P[i].id] = q[0]; base[P[i].id] = q[1]; }
  if (T3 > 0.02) {   /* 立柱：把"浮在多高"接回底图上那一格，否则立体里读不出它属于哪一行 */
    g.strokeStyle = 'rgba(159,176,204,.20)'; g.lineWidth = 1;
    for (i = 0; i < N; i++) { var pb = pos[P[i].id], gb = base[P[i].id];
      if (!pb || !gb || Math.abs(pb[1] - gb[1]) < 1.5) continue;
      g.beginPath(); g.moveTo(gb[0], gb[1]); g.lineTo(pb[0], pb[1]); g.stroke(); } }
  g.strokeStyle = 'rgba(120,200,255,.30)'; g.lineWidth = 1 * devicePixelRatio;
  for (i = 0; i < N; i++) { var dd = P[i]; if (!dd.pof || !pos[dd.id] || !pos[dd.pof]) continue;
    var a = pos[dd.pof], b = pos[dd.id];
    g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - rowH * 0.5 * TKY, b[0], b[1]); g.stroke(); }
  scr = new Array(N);
  for (i = 0; i < N; i++) { var d = P[i], p = pos[d.id]; if (!p) continue; scr[i] = p;
    var al = alphaOf(d); g.globalAlpha = al;
    g.beginPath(); g.arc(p[0], p[1], (d.lin ? 5 : 2.8) * st.size * KS, 0, 6.284);
    g.fillStyle = ramp(fCol(Fv(d))); g.fill();
    if (d.lin && al > 0.5) { g.strokeStyle = st.ink; g.lineWidth = 1.4; g.stroke(); }
    if (d.ok === 1 && al > 0.3) { g.globalAlpha = al * 0.72; g.strokeStyle = '#39d98a'; g.lineWidth = 1.15 * devicePixelRatio;
      g.beginPath(); g.arc(p[0], p[1], ((d.lin ? 5 : 2.8) + 2.2 * st.size) * st.size * KS, 0, 6.284); g.stroke(); }
    g.globalAlpha = 1;
  }
  labelReset();
  var ls = labelSet();
  for (i = 0; i < ls.length; i++) { var pp = scr[ls[i].i]; if (!pp) continue;
    putLabel((P[ls[i].i].id === 'SHIPPED-Ldemo' ? '★' : '') + P[ls[i].i].id, pp[0], pp[1], !!P[ls[i].i].lin, false); }
  g.restore();   /* §E314 数据层的裁剪到这里收口（点与点标签都不许滑进左栏）*/
  g.fillStyle = st.dim; g.font = (12 * devicePixelRatio) + 'px system-ui,sans-serif';
  /* 页脚 = 轴饰，不进相机（同上：跟着放大 2.4 倍会直接掉出画布，"缩放 ×" 那个数也就永远看不到了）。
   *   §E331 这条串必须**量过宽度**再上屏：它是单行 fillText，画布不折行，超长就从右缘直接截掉 ——
   *   1600px 窗口实测被截在"左键拖动 = 平移"之前，交互提示整段看不见。所以只留别处没有的信息：
   *   颜色口径/绿环在右上图例里，这里不重复。*/
  var foot = '行 = 家族（按首次出现排，上→下即时间推进）· 横轴 = 训练时刻 · 颜色 = ' + (st.color === 'hp' ? '页面口径夺1率' : st.color === 'de' ? '部署脆弱性 Δε' : st.color === 'sc' ? '当选键 sc − 现役' : 'F（线上口径势）') +
    /* 色标方向必须跟着口径走：写死"蓝低 → 红高"会在 Δε 那档说反（那档是**红 = 脆**），
       在当选键这档更是彻底错（这档是**绿 = 比现役强、红 = 落后**）—— 图上画的与页脚说的不能是两件事。 */
    (st.color === 'sc' ? '（绿=强 ‖ 红=落后 ‖ 橙=判不动 ‖ 灰=未测）'
      : st.color === 'de' ? '（红=脆 ‖ 蓝=吃探索 ‖ 白=不敏感）' : '（蓝低 → 红高）') +
    ' · 淡蓝曲线 = 热启动父边' +
    /* §E333 页脚是单行 fillText（画布不折行），所以两态**各说各的手势**而不是把两段接起来：
       立体态把"滚轮/Shift+滚轮/拖动"换成"右键压扁错切"—— 那三件在二维态已经说过，长度也就不会顶出右缘。
       （§E331 立体态必须自己说清"高度是哪把尺"：颜色按秩铺、几何仍是线性，不写就会被当成同一件事。画布不认 markdown ⇒ 这句里不许带 *）*/
    (T3 > 0.5 ? ' · 立体 = 原地按 F 抬起（与颜色的按秩铺色不同尺）· 立柱 = 回本行那一格 · 右键拖动 = 压扁/错切'
              : ' · 滚轮 = 横轴（时间）· Shift+滚轮 = 纵轴（家族行）· 拖动 = 平移') +
    ' · 缩放 ×' + TKX.toFixed(2) + ' ‖ ×' + TKY.toFixed(2);
  var fw = g.measureText(foot).width / devicePixelRatio;
  if (fw > (w - padL) / devicePixelRatio - 8) g.font = Math.round(12 * devicePixelRatio * (w - padL) / devicePixelRatio / fw) + 'px system-ui,sans-serif';
  g.fillText(foot, padL, h - 14 * devicePixelRatio);
  /* §E314 那根星形中心必须自己在图上说一句"我不是血统"，否则 81% 共父会被读成"演化收敛"。
     ⚠ 只能另起一次 fillText：canvas 的 fillText **不认 \n**（第一版把它拼在同一串里 ⇒ 两段挤成一行、右缘被截，
        而且 markdown 的 ** 在画布上是原样字符）。*/
  /* §E331 图底三条字必须各占一行：日期刻度在 h − padB + 16（= h−50·dpr），这条 RUNNER-BASE 注在 h−32·dpr，
   *   页脚说明在 h−14·dpr。旧版 padB=46 ⇒ 日期与这条注**同一个 y**（h−30·dpr），两段字直接叠成一坨（用户截图）。 */
  if (NRBASE) { g.fillStyle = '#e0b13c';
    g.fillText('另有 ' + NRBASE + ' 枚（' + Math.round(NRBASE * 100 / N) + '%）的父 = RUNNER-BASE d13d3c85…（runner 恒拷 EPIRUS_BUNDLE_IN 的产物 · 不是血统）⇒ 这条边图上不画',
      padL, h - 32 * devicePixelRatio); }
}
/* 「卡住缩放上界 + 背景不要割裂」：缩放的下界 = 场恰好铺满视口（再小就露出虚空）；平移卡到"场始终盖住整个视口"。
 *   由 kmin 的定义可证两个平移区间非空，所以 clamp 不会打架。*/
function clampView(w, h, nb, bx, byy, cxp, cyp) {
  var kmin = Math.max((nb.px1 - nb.px0) / (0.90 * (nb.x1 - nb.x0)), (nb.py1 - nb.py0) / (0.86 * (nb.y1 - nb.y0)));
  if (st.k < kmin) st.k = kmin;
  if (st.k > 60) st.k = 60;
  var oxLo = w / 2 - (nb.x1 - cxp) * bx * st.k, oxHi = -w / 2 - (nb.x0 - cxp) * bx * st.k;
  var oyLo = h / 2 + (nb.y0 - cyp) * byy * st.k, oyHi = -h / 2 + (nb.y1 - cyp) * byy * st.k;
  st.ox = Math.max(oxLo, Math.min(oxHi, st.ox));
  st.oy = Math.max(oyLo, Math.min(oyHi, st.oy));
}

/* ---- ②③ 地图模式：平面（俯视）⇄ 立体（势阱）共用一台渲染器 ----
 *   elev ∈ [0,1]：0 = 纯平面地图（与旧二维逐像素同构），1 = 势阱（柱高 = F − F_min，地板 = 阱底平面）。
 *   平面态 = yaw −π/2 / pitch π/2 的相机特例 ⇒ 仿射地板退化成轴对齐贴图、立柱长 0。
 *   "无缝切换"不是跳页面：相机在 FLAT/SOLID 两个预设间插值 + 柱高从 0 长到 U（520ms 缓动）。*/
function drawMap(fr) {
  var w = cv.width, h = cv.height, i;
  clear(w, h);
  /* 视野按**截尾范围**拟合（默认视图不被离群点压扁），场位图按**全幅范围**铺 ⇒ 每枚点脚下都有地。
   *   基础比例尺（不含 st.k）先于建场算好：场的距离/淡出半径都按这套屏幕度量定义。*/
  var bx0 = w / (PV.x1 - PV.x0) * 0.90, by0 = h / (PV.y1 - PV.y0) * 0.86;
  ensureField('x2y2', bx0, by0);
  var nb = NBK[FL.key], cb = cam();
  var bx = bx0, byy = by0;
  var cxp = (nb.px0 + nb.px1) / 2, cyp = (nb.py0 + nb.py1) / 2;
  if (st.elev < 0.5) clampView(w, h, nb, bx, byy, cxp, cyp);
  var sx = bx * st.k, sy = byy * st.k;
  var zspan = (fr[1] - fr[0]) || 1;
  var zH = 0.30 * Math.max(nb.px1 - nb.px0, nb.py1 - nb.py0) * (bx + byy) / 2 * st.k;
  var voff = 0.06 * h * st.elev;
  function ptw(x, y, z01) {
    var a = (x - cxp) * sx, b = (y - cyp) * sy, c = z01 * zH;
    return [w / 2 + (a * cb.r[0] + b * cb.r[1] + c * cb.r[2]) + st.ox,
      h / 2 + voff - (a * cb.u[0] + b * cb.u[1] + c * cb.u[2]) + st.oy];
  }
  /* 地板：整张位图**一次仿射贴上**（位图行 0 = 数据 y0，与 buildNB 同约定 ⇒ p0/pX/pY 三角定矩阵）。
   *   旧二维的矩形贴法把行 0 贴到了 y1 的位置 ⇒ 上下颠倒 —— 这就是"又错位了"；两态共用这一条路径后不可能再各贴各的。*/
  var G1X = nb.gx - 1, G1Y = nb.gy - 1;
  var p0 = ptw(nb.x0, nb.y0, 0), pX = ptw(nb.x1, nb.y0, 0), pY = ptw(nb.x0, nb.y1, 0);
  g.save();
  g.setTransform((pX[0] - p0[0]) / G1X, (pX[1] - p0[1]) / G1X, (pY[0] - p0[0]) / G1Y, (pY[1] - p0[1]) / G1Y, p0[0], p0[1]);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(FL.c, -0.5, -0.5);
  g.restore(); g.setTransform(1, 0, 0, 1, 0, 0);
  var pr = [];
  for (i = 0; i < N; i++) {
    var a = (P[i].x2 - cxp) * sx, b = (P[i].y2 - cyp) * sy;
    /* §E297：柱高原来取 U = F_max − F ⇒ **阱底被顶到空中、能量高的反而贴着地板**（用户点名的高度轴反向）。
     *   地板就是 F_min 平面 ⇒ 柱高 = F − F_min：越好的包越贴地（阱底），越差顶得越高（阱口）。*/
    var c = u01(Fv(P[i]), fr) * zH;
    pr.push({ x: w / 2 + (a * cb.r[0] + b * cb.r[1] + c * cb.r[2]) + st.ox,
      y: h / 2 + voff - (a * cb.u[0] + b * cb.u[1] + c * cb.u[2]) + st.oy,
      dep: a * cb.f[0] + b * cb.f[1] + c * cb.f[2], i: i });
  }
  pr.sort(function (p, q) { return q.dep - p.dep; });
  scr = new Array(N);
  for (i = 0; i < pr.length; i++) {
    var d = P[pr[i].i], isC = !!d.lin, al = alphaOf(d);
    var foot = ptw(d.x2, d.y2, 0);
    if (st.elev > 0.02 && (isC || st.hi[gk(d)])) {
      g.globalAlpha = al * 0.6 * st.elev;
      g.strokeStyle = isC ? st.ink : st.dim; g.lineWidth = (isC ? 1.7 : 1) * devicePixelRatio;
      g.beginPath(); g.moveTo(foot[0], foot[1]); g.lineTo(pr[i].x, pr[i].y); g.stroke();
    }
    g.globalAlpha = al * (isC ? 1 : 0.82);
    var rr = (isC ? 6 : 2.9) * st.size * (isC ? 1 : Math.min(1.6, 0.7 + st.k * 0.35));
    g.beginPath(); g.arc(pr[i].x, pr[i].y, rr, 0, 6.284);
    g.fillStyle = colOf(d, fr); g.fill();
    if (isC && al > 0.5) { g.strokeStyle = st.ink; g.lineWidth = 1.5; g.stroke(); }
    /* §E302 过线**只**按逐枚真值标：绿环 = 这枚自己过了今天那道闸（113/718）。
     *   二维的"过线范围"已删（用户：绿区会把底图盖掉），为什么不该再画回去的理由写在 buildNB 末尾。*/
    if (d.ok === 1 && al > 0.3) {
      g.globalAlpha = al * 0.72; g.strokeStyle = '#39d98a'; g.lineWidth = 1.15 * devicePixelRatio;
      g.beginPath(); g.arc(pr[i].x, pr[i].y, rr + 2.2 * st.size, 0, 6.284); g.stroke(); }
    if (isC && st.elev > 0.02) { g.globalAlpha = al * st.elev;
      g.beginPath(); g.arc(foot[0], foot[1], 2.4 * st.size, 0, 6.284); g.fillStyle = st.ink; g.fill(); }
    g.globalAlpha = 1;
    scr[pr[i].i] = [pr[i].x, pr[i].y];
  }
  labelReset();
  var ls = labelSet();
  for (i = 0; i < ls.length; i++) { var pp = scr[ls[i].i]; if (!pp) continue;
    putLabel((P[ls[i].i].id === 'SHIPPED-Ldemo' ? '★' : '') + P[ls[i].i].id, pp[0], pp[1], !!P[ls[i].i].lin, false); }
  if (st.q) for (i = 0; i < N; i++) if (P[i].id.indexOf(st.q) >= 0 && scr[i]) {
    g.beginPath(); g.arc(scr[i][0], scr[i][1], 11 * st.size, 0, 6.284); g.strokeStyle = st.ink; g.lineWidth = 2; g.stroke(); }
  g.fillStyle = st.dim; g.font = (12 * devicePixelRatio) + 'px system-ui,sans-serif';
  g.fillText(st.elev < 0.5
    ? '滚轮 = 以光标为中心缩放 · 左键拖动 = 平移 · 底色 = F（蓝 = 低 = 差 → 红 = 高 = 好）· 绿环 = 该枚过线 · 缩放 ×' + st.k.toFixed(2)
    : '左键拖动 = 平移 · 右键拖动 = 旋转 · 滚轮 = 缩放 · 柱高 = ' + (st.goodTop ? 'F − F_min（越高越好）' : 'F_max − F（越低越好 = 冠军在阱底）') + ' · 绿环 = 该枚过线',
    14 * devicePixelRatio, h - 12 * devicePixelRatio);
}
/* ---- 三维投影（3db 行为轴 / 3dw 势阱 共用） ---- */
function cam() {
  var th = st.yaw, ph = st.pit;
  return { r: [-Math.sin(th), Math.cos(th), 0],
    u: [-Math.cos(th) * Math.sin(ph), -Math.sin(th) * Math.sin(ph), Math.cos(ph)],
    f: [Math.cos(th) * Math.cos(ph), Math.sin(th) * Math.cos(ph), Math.sin(ph)] };
}
function pt3(x, y, z, cx, cy, base, w, h, cb, zBase, zspan) {
  var a = x - cx, b = y - cy, c = z / zspan * zBase;
  /* 纵向偏置从 0.18h 降到 0.06h：偏置越大，旋转的视觉支点越偏下，拖起来像云团在"荡秋千" */
  return [w / 2 + (a * cb.r[0] + b * cb.r[1] + c * cb.r[2]) * base + st.ox3,
    h / 2 + 0.06 * h - (a * cb.u[0] + b * cb.u[1] + c * cb.u[2]) * base + st.oy3];
}
/* 全页统一用**恒等变换 + 设备像素坐标**（v1 的约定）：坐标全部按 cv.width/height（设备 px）算，字号单独乘 dpr。
 *   千万别在这里再叠一个 dpr 变换 —— 那一版在 dpr=1.75 的屏幕上把整个场景放大 1.75 倍绕原点偏到右下，
 *   用户看到的"旋转/缩放中心不对"和"一维被裁掉一块"都是它；而无头截图 dpr=1 恰恰看不出来。 */
function clear(w, h) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = st.bg; g.fillRect(0, 0, w, h); }

/* ===== §E306 三维行为轴里的"过线闭合曲面"（可开关）=====
 * 用户：「研究一下能否在三维行为轴的图里面整出通过连贯的一些闭合曲面圈出过线的冠军（当然要可开关，不然会挡的很严重）」
 *
 * 场：每个网格点取 **高斯加权的局部过线占比** f = Σ_{过线} G(d) / (Σ_{全体} G(d) + ε)，G(d)=exp(−d²/2σ²)。
 *   ⇒ f∈[0,1]、天生平滑，等值面 f=t 就是"这一片里过线的占多数"的边界。
 *   σ 用**显示度量**（第 12 近邻中位）⇒ 曲面在屏幕上是圆的，不会被轴的比例尺拉扁（§E296 那条教训的三维版）。
 * 抽面：**surface nets / dual contouring**，不用 marching cubes 的 256 项查表：
 *   ① 符号混合的格里，把 12 条"跨阈值"的棱按线性插值取交点、平均 ⇒ 该格一个顶点（顶点天然贴着等值面）；
 *   ② 每条网格棱的**四个相邻格**若都有顶点 ⇒ 连成一个四边形。
 *   ⇒ 出来的面**闭合、连贯、朝向连续**，且顶点数远小于 marching cubes。
 * 关键性质：网格建在 (a,b,c) 空间（= 三轴各乘自己的屏幕尺度）⇒ **与相机无关**，建一次缓存，旋转/缩放每帧只重投影。*/
function isoBuild(sig, thr, GN, field) {
  var i, j, k, a = [], b = [], c = [];
  for (i = 0; i < N; i++) { a.push(P[i].ax); b.push(P[i].by); c.push(P[i].cz); }
  var loA = Math.min.apply(null, a), hiA = Math.max.apply(null, a);
  var loB = Math.min.apply(null, b), hiB = Math.max.apply(null, b);
  var loC = Math.min.apply(null, c), hiC = Math.max.apply(null, c);
  var R = 2.6 * sig;   /* GN 由调用方给（§E312：52 是旧默认、棱面明显；72/96 磨平一档，代价是重建时间平方涨）*/
  var ext = Math.max(hiA - loA, hiB - loB, hiC - loC) + 2 * R;
  var dims = [Math.max(8, Math.round(GN * (hiA - loA + 2 * R) / ext)),
              Math.max(8, Math.round(GN * (hiB - loB + 2 * R) / ext)),
              Math.max(8, Math.round(GN * (hiC - loC + 2 * R) / ext))];
  loA -= R; hiA += R; loB -= R; hiB += R; loC -= R; hiC += R;
  var dA = (hiA - loA) / (dims[0] - 1), dB = (hiB - loB) / (dims[1] - 1), dC = (hiC - loC) / (dims[2] - 1);
  /* 粗哈希：格心 → 附近点桶，桶边 = R ⇒ 每格只扫 27 个桶（直接 718×34³ = 2800 万次 exp 会卡死）*/
  var BK = R, nb = [Math.ceil((hiA - loA) / BK) + 1, Math.ceil((hiB - loB) / BK) + 1, Math.ceil((hiC - loC) / BK) + 1];
  var buckets = {};
  for (i = 0; i < N; i++) {
    var bi = Math.floor((a[i] - loA) / BK), bj = Math.floor((b[i] - loB) / BK), bk = Math.floor((c[i] - loC) / BK);
    var key = bi + ',' + bj + ',' + bk; (buckets[key] || (buckets[key] = [])).push(i);
  }
  var F = new Float32Array(dims[0] * dims[1] * dims[2]);
  var s2 = 2 * sig * sig;
  /* §E312 场 = **往全局先验收缩的局部比值**。旧写法是裸比值 num/den ⇒
   *   稀疏区一个核里常只有一两个点，只要那点恰好过线比值就是 1.0（≥阈值）；稠密区比值被压向全局过线率 15.7%，永远够不到 50%
   *   ⇒ **旧壳恰好只在数据最稀的地方长出来**，那是纯噪声，与"圈出过线的冠军"完全相反（用户看到的"只圈到边缘"就是这个）。
   *   改法：ESS = (Σw)²/Σw² 是核里的有效样本数，场 = (ESS·p̂ + M0·p0)/(ESS + M0)，p0 = 全局先验。
   *   ⇒ 孤点过线被拉回 p0 不成壳；M0=5 时要抬到 0.30 需要核里有 ≈2 个有效样本、抬到 0.5 需要 ≈4 个 —— 那才是"一坨过线的点挤在一起"。
   * 两种场（isoField）：
   *   'ok'  ⇒ 值 = 过不过线（0/1），p0 = 全库过线率 ⇒ 壳 = "局部过线概率高"的区域；
   *   'pot' ⇒ 值 = 该枚的势 F 归一化到 0..1，p0 = 全库均值 ⇒ 壳 = "预测势高"的区域。
   *   为什么两种都要（数出自 iso-sweep.mjs，M0=5 / σ=6 近邻 / 718 枚，显示度量与页面同式）：'ok' 场收缩后**峰值只有 42%**，
   *   所以阈值 50% 时壳内 0 枚 —— "没有壳"是数据的正确回答，不是 bug。降到 30% 才有 38 枚里 25 枚过线（66%），
   *   但那一步留一复核只剩 27 枚里 3 枚（11% < 底率 16%）⇒ **这层壳是"点把自己照亮"，不是局部富集**。
   *   既然'ok'场能给的诚实信息就这么多，再给一个不会空的场：同一套壳画在**势**上，回答"该往哪片形状继续训"。
   *   势场阈值 67% ⇒ 壳内 122 枚、纯度 28%，而**留一还有 21%**（底率 15.7%）⇒ 全场唯一"过了留一复核还站得住"的壳。
   *   ⚠ §E314 换尺后这一组数全部重扫过（旧势场是 64% / 68 枚 / 31% / 23%）—— 场的定义一动，默认值就必须重定。*/
  var fr2 = fRange(), fspan = (fr2[1] - fr2[0]) || 1;
  /* 没判定的枚一律 NaN ⇒ 不进核、不进分母（旧写法 null 会被 isFinite 放进来当 0，是个静默偏置）*/
  function vAt(m) { return field === 'pot' ? (Fv(P[m]) - fr2[0]) / fspan : (P[m].ok === 1 ? 1 : (P[m].ok === 0 ? 0 : NaN)); }
  var nOk = 0, sumV = 0, nV = 0, nHas = 0;
  for (i = 0; i < N; i++) { var v0 = vAt(i);
    if (P[i].ok === 1 || P[i].ok === 0) { nHas++; if (P[i].ok === 1) nOk++; }
    if (isFinite(v0)) { nV++; sumV += v0; } }
  /* base = 全库过线率，**与场无关**：壳内纯度要跟它比才知道壳是不是白画的。
   *   'pot' 场的 p0 是"平均势"（59%），拿它当"底率"印出去会把人带沟里（截图第一版就印成 59%）。*/
  var p0 = nV ? sumV / nV : 0.15, base = nHas ? nOk / nHas : 0.15, M0 = 5, maxF = 0;
  /* self 传索引 = 把自己剔掉（leave-one-out）⇒ 读覆盖/纯度不吹；传 -1 = 普通格点 */
  function at(X, Y, Z, self) {
    var bi0 = Math.floor((X - loA) / BK), bj0 = Math.floor((Y - loB) / BK), bk0 = Math.floor((Z - loC) / BK);
    var num = 0, den = 0, den2 = 0;
    for (var di = -1; di <= 1; di++) for (var dj = -1; dj <= 1; dj++) for (var dk = -1; dk <= 1; dk++) {
      var arr = buckets[(bi0 + di) + ',' + (bj0 + dj) + ',' + (bk0 + dk)]; if (!arr) continue;
      for (var q = 0; q < arr.length; q++) { var m = arr[q];
        if (m === self) continue;
        var vm = vAt(m); if (!isFinite(vm)) continue;
        var ex = X - a[m], ey = Y - b[m], ez = Z - c[m], dd = ex * ex + ey * ey + ez * ez;
        if (dd > R * R) continue;
        var gv = Math.exp(-dd / s2); den += gv; den2 += gv * gv; num += gv * vm; } }
    if (den <= 1e-6) return p0;
    var ess = den * den / (den2 || 1e-9);
    return (ess * (num / den) + M0 * p0) / (ess + M0);
  }
  for (k = 0; k < dims[2]; k++) for (j = 0; j < dims[1]; j++) for (i = 0; i < dims[0]; i++) {
    var fv = at(loA + i * dA, loB + j * dB, loC + k * dC, -1);
    F[(k * dims[1] + j) * dims[0] + i] = fv; if (fv > maxF) maxF = fv; }
  /* 壳画得对不对，当场给数（不许只靠眼睛）：在每枚自己位置上估一次，数"被壳包住"的枚数。
   *   两遍都要：含自己 = 与画出来的壳同一口径（但循环 —— 一枚会把自己那格抬上去）；
   *   留一 = "它不是靠自己被圈进来"的读数。iso-sweep.mjs 实测这两列能差一倍（25% 档 56/109 ‖ 26/100）
   *   ⇒ 只报含自己那列，就是拿点的自我照亮冒充"局部真的富集过线枚"。*/
  var cov = 0, ins = 0, covL = 0, insL = 0;
  for (i = 0; i < N; i++) { var vi = vAt(i); if (!isFinite(vi)) continue;
    if (at(a[i], b[i], c[i], -1) >= thr) { ins++; if (P[i].ok === 1) cov++; }
    if (at(a[i], b[i], c[i], i) >= thr) { insL++; if (P[i].ok === 1) covL++; } }
  /* ① 每格一个顶点：12 条棱上"跨阈值"的交点取平均 */
  var vx = new Float32Array(F.length), vy = new Float32Array(F.length), vz = new Float32Array(F.length);
  var has = new Uint8Array(F.length);
  for (k = 0; k < dims[2] - 1; k++) for (j = 0; j < dims[1] - 1; j++) for (i = 0; i < dims[0] - 1; i++) {
    var cnt = 0, ax = 0, ay = 0, az = 0;
    for (var e = 0; e < 3; e++) for (var o1 = 0; o1 < 2; o1++) for (var o2 = 0; o2 < 2; o2++) {
      /* 12 条棱显式枚举端点格索引（在位运算里绕容易错，这里宁可直白）*/
      var A, B;
      if (e === 0) { A = [i, j + o1, k + o2]; B = [i + 1, j + o1, k + o2]; }
      else if (e === 1) { A = [i + o1, j, k + o2]; B = [i + o1, j + 1, k + o2]; }
      else { A = [i + o1, j + o2, k]; B = [i + o1, j + o2, k + 1]; }
      var fa = F[(A[2] * dims[1] + A[1]) * dims[0] + A[0]], fb = F[(B[2] * dims[1] + B[1]) * dims[0] + B[0]];
      if ((fa >= thr) === (fb >= thr)) continue;
      var u = (thr - fa) / (fb - fa || 1e-9); u = Math.max(0, Math.min(1, u));
      ax += loA + (A[0] + (B[0] - A[0]) * u) * dA; ay += loB + (A[1] + (B[1] - A[1]) * u) * dB; az += loC + (A[2] + (B[2] - A[2]) * u) * dC;
      cnt++;
    }
    if (!cnt) continue;
    var id = (k * dims[1] + j) * dims[0] + i;
    has[id] = 1; vx[id] = ax / cnt; vy[id] = ay / cnt; vz[id] = az / cnt;
  }
  /* ③ §E312 拉普拉斯松弛 2 轮：把"棱面感"磨掉（分辨率不变、壳是光的）。
   *   只动"六邻里 ≥3 个有顶点"的格 ⇒ 边界点原地不动，否则壳会被自己啃出洞。*/
  for (var pass = 0; pass < 2; pass++) {
    var nx = new Float32Array(F.length), ny = new Float32Array(F.length), nz = new Float32Array(F.length);
    for (k = 1; k < dims[2] - 1; k++) for (j = 1; j < dims[1] - 1; j++) for (i = 1; i < dims[0] - 1; i++) {
      var id3 = (k * dims[1] + j) * dims[0] + i; if (!has[id3]) continue;
      var nbid = [id3 - 1, id3 + 1, id3 - dims[0], id3 + dims[0], id3 - dims[0] * dims[1], id3 + dims[0] * dims[1]];
      var mm = 0, sx = 0, sy = 0, sz = 0;
      for (var t6 = 0; t6 < 6; t6++) if (has[nbid[t6]]) { mm++; sx += vx[nbid[t6]]; sy += vy[nbid[t6]]; sz += vz[nbid[t6]]; }
      if (mm < 3) { nx[id3] = vx[id3]; ny[id3] = vy[id3]; nz[id3] = vz[id3]; continue; }
      nx[id3] = vx[id3] + 0.5 * (sx / mm - vx[id3]); ny[id3] = vy[id3] + 0.5 * (sy / mm - vy[id3]); nz[id3] = vz[id3] + 0.5 * (sz / mm - vz[id3]);
    }
    vx = nx; vy = ny; vz = nz;
  }
  /* ② 每条网格棱的四个相邻格 → 一个四边形
   *   §E312 退化片闸：一个四边形若有任意一对角超过 2.2 倍格对角，就不是"贴着等值面的一片"，而是
   *   两块各自合理的顶点被同一条网格棱硬连起来的**桥**（实测：'ok' 场阈值 30% 时有一根细绿带从中央团
   *   一路拉到右上角的空域 —— 那里两格都刚好过线，中间却一个点都没有）。看着像"壳连着两个族群"，其实是几何假象 ⇒ 宁缺。*/
  var quads = [], qmax = 2.2 * Math.sqrt(dA * dA + dB * dB + dC * dC), qmax2 = qmax * qmax, ndrop = 0;
  for (k = 0; k < dims[2]; k++) for (j = 0; j < dims[1]; j++) for (i = 0; i < dims[0]; i++) {
    for (var ax2 = 0; ax2 < 3; ax2++) {
      var t1 = (ax2 + 1) % 3, t2 = (ax2 + 2) % 3, o = [], bad = 0;
      for (var s1 = 0; s1 < 2 && !bad; s1++) for (var s2b = 0; s2b < 2 && !bad; s2b++) {
        var q = [i, j, k];
        q[t1] += s1 - 1; q[t2] += s2b - 1;
        /* 越界 / 该格没顶点 ⇒ 这条棱不产面。用 bad 标志一次退出两层，
         *   别把 o 置 null 再 break —— 外层会继续跑，下一圈就在 null 上 push（第一版就是这么抛的）。*/
        if (q[0] < 0 || q[1] < 0 || q[2] < 0 || q[0] >= dims[0] - 1 || q[1] >= dims[1] - 1 || q[2] >= dims[2] - 1) { bad = 1; break; }
        var id2 = (q[2] * dims[1] + q[1]) * dims[0] + q[0];
        if (!has[id2]) { bad = 1; break; }
        o.push([vx[id2], vy[id2], vz[id2]]);
      }
      if (bad || o.length !== 4) continue;
      var far = 0;
      for (var u1 = 0; u1 < 4 && !far; u1++) for (var u2 = u1 + 1; u2 < 4; u2++) {
        var ux = o[u1][0] - o[u2][0], uy = o[u1][1] - o[u2][1], uz = o[u1][2] - o[u2][2];
        if (ux * ux + uy * uy + uz * uz > qmax2) far = 1; }
      if (far) { ndrop++; continue; }
      quads.push(o);
    }
  }
  return { quads: quads, dims: dims, sig: sig, thr: thr, gn: GN, field: field, nCell: F.length, nDrop: ndrop,
    cov: cov, ins: ins, covL: covL, insL: insL, p0: p0, base: base, nOk: nOk, maxF: maxF };
}
/* σ = 第 6 近邻距离的中位，**按显示度量**（三轴各自换算成同一屏幕单位之后）⇒ 曲面在屏幕上是圆的。
 *   用数据单位算就是 §E296 那个病的三维版：三轴比例尺不同 ⇒ 球被拉成椭球。
 *   §E312：从 12 近邻改成 6 近邻 —— "样本不够"这件事已经交给收缩项兜了，核就该只管"局部有多近"；
 *   核不变小的话，稠密区永远被邻居里的未过线点稀释，壳仍然只在边缘长。*/
var ISO = null;
function isoSigma() {
  var nn = [];
  for (var i = 0; i < N; i++) {
    var heap = [];
    for (var j = 0; j < N; j++) { if (j === i) continue;
      var dx = P[i].ax - P[j].ax, dy = P[i].by - P[j].by, dz = P[i].cz - P[j].cz;
      var dd = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (heap.length < 6) { heap.push(dd); heap.sort(function (a, b) { return a - b; }); }
      else if (dd < heap[5]) { heap[5] = dd; heap.sort(function (a, b) { return a - b; }); } }
    nn.push(heap[5] || heap[0] || 1);
  }
  return pct(nn, .5) || 1;
}
function isoEnsure() {
  var sg = isoSigma();
  if (ISO && ISO.sig === sg && ISO.thr === st.isoT && ISO.gn === st.isoGN && ISO.field === st.isoField) return ISO;
  var t0 = performance.now(); ISO = isoBuild(sg, st.isoT, st.isoGN, st.isoField); ISO.ms = performance.now() - t0;
  return ISO;
}
/* 画序：**先画壳、后画点** ⇒ 点永远浮在曲面上，不会被挡（用户担心的正是这个）。
 *   壳内部再按深度背面先画，看起来才是一个立体壳而不是一片绿糊。*/
function drawIso(cx, cy, base, w, h, cb, shell) {
  var m = isoEnsure(); if (!m.quads.length) return m;
  var prj = function (X, Y, Z) { var a = X - cx, b = Y - cy, c = Z;
    return [w / 2 + (a * cb.r[0] + b * cb.r[1] + c * cb.r[2]) * base + st.ox3,
      h / 2 + 0.06 * h - (a * cb.u[0] + b * cb.u[1] + c * cb.u[2]) * base + st.oy3,
      a * cb.f[0] + b * cb.f[1] + c * cb.f[2]]; };
  var q = [];
  /* §E312 壳的配色跟着场走：绿 = 过线概率场，琥珀 = 势场。
   *   两种场共用一套壳代码，但"绿"在这个页面上已经被绿环定义成"过线" ⇒ 势场再画绿就是撒谎。*/
  var pot = m.field === 'pot';
  var fillC = pot ? 'rgba(224,177,60,.075)' : 'rgba(57,217,138,.085)';
  var lineC = shell ? (pot ? 'rgba(224,177,60,.6)' : 'rgba(57,217,138,.55)') : (pot ? 'rgba(224,177,60,.24)' : 'rgba(57,217,138,.22)');
  for (var i = 0; i < m.quads.length; i++) {
    var v = m.quads[i], p = [];
    for (var k = 0; k < 4; k++) p.push(prj(v[k][0], v[k][1], v[k][2]));
    q.push({ p: p, d: (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4 });
  }
  q.sort(function (a, b) { return b.d - a.d; });
  for (i = 0; i < q.length; i++) {
    g.beginPath(); g.moveTo(q[i].p[0][0], q[i].p[0][1]);
    for (k = 1; k < 4; k++) g.lineTo(q[i].p[k][0], q[i].p[k][1]);
    g.closePath();
    if (!shell) { g.fillStyle = fillC; g.fill(); }
    g.strokeStyle = lineC;
    g.lineWidth = 1 * devicePixelRatio; g.stroke();
  }
  return m;
}
/* ④ 三维行为轴：x3/y3/z3 全是行为轴，**势只能靠点的颜色**（用户原话） */
function draw3b(fr) {
  var w = cv.width, h = cv.height, i;
  clear(w, h);
  var cb = cam(), xs = [], ys = [];
  for (i = 0; i < N; i++) { xs.push(P[i].x3); ys.push(P[i].y3); }
  /* 地板/跨度用截尾范围（不被离群点压扁）；但**旋转轴心**要跟着云团质心（中位数）走，否则拖动时云团绕偏轴扫 */
  var xl = pct(xs, .005), xh = pct(xs, .995), yl = pct(ys, .005), yh = pct(ys, .995);
  var cx = pct(xs, .5), cy = pct(ys, .5);
  var span = Math.max(xh - xl, yh - yl) || 1;
  var zs = P.map(function (d) { return d.z3; });
  var zmin = pct(zs, .005), zspan = (pct(zs, .995) - zmin) || 1;
  var base = Math.min(w * 0.86, h * 1.30) / span * st.zoom3;
  var zBase = span * 0.26;   /* 第三轴的高度只用来"看得出分层"，抬太高就变成一片森林而不是一个云团 */
  /* 线框地板（不上热图：这张图的颜色已被第三根行为轴占用，再叠势场就读不出轴了）*/
  var FN = 8, lo = xl, hi = xh;
  g.strokeStyle = 'rgba(150,170,200,.16)'; g.lineWidth = 1;
  for (i = 0; i <= FN; i++) {
    var a1 = pt3(lo + (hi - lo) * i / FN, yl, 0, cx, cy, base, w, h, cb, zBase, zspan);
    var a2 = pt3(lo + (hi - lo) * i / FN, yh, 0, cx, cy, base, w, h, cb, zBase, zspan);
    g.beginPath(); g.moveTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]); g.stroke();
    var b1 = pt3(lo, yl + (yh - yl) * i / FN, 0, cx, cy, base, w, h, cb, zBase, zspan);
    var b2 = pt3(hi, yl + (yh - yl) * i / FN, 0, cx, cy, base, w, h, cb, zBase, zspan);
    g.beginPath(); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.stroke();
  }
  /* §E306 过线闭合曲面（可开关）：先算好这个空间里的坐标，再画壳 ⇒ 后面的点全部浮在壳上，不会被挡 */
  var isoInfo = null;
  if (st.iso) {
    for (i = 0; i < N; i++) { P[i].ax = P[i].x3; P[i].by = P[i].y3; P[i].cz = (P[i].z3 - zmin) / zspan * zBase; }
    isoInfo = drawIso(cx, cy, base, w, h, cb, st.iso === 2);
  }
  var pr = [];
  for (i = 0; i < N; i++) {
    var zz = (P[i].z3 - zmin) / zspan * zBase;
    var foot = pt3(P[i].x3, P[i].y3, 0, cx, cy, base, w, h, cb, zBase, zspan);
    var e = pt3(P[i].x3, P[i].y3, P[i].z3 - zmin, cx, cy, base, w, h, cb, zBase, zspan);
    var dep = (P[i].x3 - cx) * cb.f[0] + (P[i].y3 - cy) * cb.f[1] + zz;
    pr.push([e[0], e[1], dep, foot[0], foot[1], zz, i]);
  }
  pr.sort(function (a, b) { return b[2] - a[2]; });
  scr = new Array(N);
  for (i = 0; i < pr.length; i++) {
    var d = P[pr[i][6]], al = alphaOf(d);
    /* 只给冠军/被点选家族画茎：718 根全画就是一片"头发"，第三轴反而读不出来了 */
    if (d.lin || st.hi[gk(d)]) {
      g.globalAlpha = al * 0.5;
      g.strokeStyle = st.dim; g.lineWidth = 1.2 * devicePixelRatio;
      g.beginPath(); g.moveTo(pr[i][3], pr[i][4]); g.lineTo(pr[i][0], pr[i][1]); g.stroke();
    }
    g.globalAlpha = al;
    g.beginPath(); g.arc(pr[i][0], pr[i][1], (d.lin ? 6.2 : 3.0) * st.size, 0, 6.284);
    g.fillStyle = colOf(d, fr); g.fill();
    if (d.lin && al > 0.5) { g.strokeStyle = st.ink; g.lineWidth = 1.5; g.stroke(); }
    scr[pr[i][6]] = [pr[i][0], pr[i][1]];
    g.globalAlpha = 1;
  }
  labelReset();
  var ls = labelSet();
  for (i = 0; i < ls.length; i++) { var pp = scr[ls[i].i]; if (!pp) continue;
    putLabel((P[ls[i].i].id === 'SHIPPED-Ldemo' ? '★' : '') + P[ls[i].i].id, pp[0], pp[1], !!P[ls[i].i].lin, false); }
  g.fillStyle = st.dim; g.font = (12 * devicePixelRatio) + 'px system-ui,sans-serif';
  g.fillText('三维行为轴（x3/y3/z3）· 左键拖动 = 平移 · 右键拖动 = 旋转 · 滚轮 = 缩放 · 颜色 = F（线上口径势 = Hp + T·S）⇒ 第三轴是行为不是深度' +
    /* §E312 壳好不好必须当场给数，而且**两列一起给**：含自己那列与画出来的壳同口径但循环，留一那列才是"不是靠自己被圈进来"。
     *   只报一列就会被骗（iso-sweep.mjs 实测两列差一倍）⇒ 这也回答"壳到底有没有用"：留一塌到 0 就说明这层壳是自我照亮。*/
    (isoInfo ? ' ‖ 壳[' + (isoInfo.field === 'pot' ? '势' : '过线概率') + '] 阈值 ' + Math.round(st.isoT * 100) +
      '% · 网格 ' + isoInfo.gn + ' 格/最长轴 · ' + isoInfo.quads.length + ' 片' +
      (isoInfo.nDrop ? '（另丢 ' + isoInfo.nDrop + ' 片退化桥）' : '') + ' · 建壳 ' + isoInfo.ms.toFixed(0) + 'ms（与相机无关，只建一次）' +
      ' ‖ 壳内 ' + isoInfo.ins + ' 枚（含自己 ' + isoInfo.cov + ' 枚真过线 = ' + (isoInfo.ins ? (100 * isoInfo.cov / isoInfo.ins).toFixed(0) : '—') +
      '%）‖ 留一复核 ' + isoInfo.insL + ' 枚里 ' + isoInfo.covL + ' 枚（' + (isoInfo.insL ? (100 * isoInfo.covL / isoInfo.insL).toFixed(0) : '—') +
      '%）· 全库过线率 ' + (100 * isoInfo.base).toFixed(0) + '% · 场先验 ' + (100 * isoInfo.p0).toFixed(0) +
      '% · 场峰值 ' + (100 * isoInfo.maxF).toFixed(0) + '% ⇒ 阈值拖过这个数必然空壳' : ''),
    14 * devicePixelRatio, h - 12 * devicePixelRatio);
}

function draw() { try { drawBody(); } catch (e) {
  /* 静默空跑比红字更坏（v1 的 3D 就是抛异常后画了个全空画布，看不出来）⇒ 异常必须显形 */
  var el = document.getElementById('err');
  if (el) { el.style.display = 'block'; el.textContent = '⛔ 渲染抛错：' + ((e && e.message) || e); }
  throw e; } }
var scr = [];
function drawBody() {
  /* §E333 逐枚取底片亮度的缓存按帧作废（拖一次 60 个标签 × getImageData 是看得出来的开销）；
     表本身按 400 帧清一次，免得长时间挂着越积越大。*/
  LUMQ.frame++; if (LUMQ.frame % 400 === 0) LUMQ.box = {};
  var fr = fRange();
  if (st.mode === '1d') draw1(fr); else if (st.mode === 'map') drawMap(fr); else if (st.mode === 'tree') drawTree(fr); else draw3b(fr);
  paintLegend(fr);
  var n = 0; for (var kk in st.hi) if (st.hi[kk]) n++;
  document.getElementById('stat').textContent = N + ' 枚候选（按权重身份去重 = ' + NDUP + ' 种打法）· 真当过线上冠军 ' + P.filter(function (d) { return d.lin; }).length +
    ' 枚 · 现役的子代 ' + P.filter(function (d) { return d.kin === '续训现役'; }).length +
    ' 枚 · 父链 ' + P.filter(function (d) { return d.kin === '父链'; }).length + ' 枚 · T = ' + st.T.toFixed(2) + ' · 颜色 = ' + (st.color === 'F' ? 'F（线上口径势）' : st.color === 'seed' ? 'RNG seed（旧口径）' : st.color === 'gl' ? '长程广度 G(long)' : st.color === 'pm' ? ('上槽体检（实测 ' + NPRM + ' 枚）') : st.color === 'duel' ? ('对现役决斗（实测 ' + NDUEL + ' 枚）') : st.color === 'hp' ? ('页面口径夺1率（实测 ' + NEPS + ' 枚）') : st.color === 'de' ? ('部署脆弱性 Δε（实测 ' + NEPS + ' 枚 · 脆 ' + NBRIT + '）') : st.color === 'sc' ? ('当选键 sc − 现役（实测 ' + NSEL + ' 枚 · 判据内赢 ' + NSELUP + ' · 判不动 ' + NSELSOFT + '）') : '训练方法家族') +
    (st.mode === 'map' || st.mode === 'tree' ? ' · ' + (st.elev < 0.5 ? '平面' : '立体') : '') + (n ? ' · 高亮 ' + n + ' 个家族' : '');
}
/* ⑥ 所有重绘走 rAF 合并：一帧最多画一次（拖动/滑杆连续事件下这是"卡死"的第二条来源）*/
var queued = false;
function req() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; draw(); }); }

function paintLegend(fr) {
  var lg = document.getElementById('legend'); lg.innerHTML = '';
  var c = document.createElement('canvas'); c.width = 18 * devicePixelRatio; c.height = 150 * devicePixelRatio;
  c.style.width = '18px'; c.style.height = '150px'; var cg = c.getContext('2d');
  for (var i = 0; i < 150 * devicePixelRatio; i++) { var rgb = rampRGB(1 - i / (150 * devicePixelRatio));
    cg.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'; cg.fillRect(0, i, 18 * devicePixelRatio, 1); }
  if (st.color === 'pm') { /* 三档离色 ⇒ 渐变条会骗人，这里改涂两块实心 */
    cg.fillStyle = '#39d98a'; cg.fillRect(0, 0, 18 * devicePixelRatio, 75 * devicePixelRatio);
    cg.fillStyle = '#ff6b6b'; cg.fillRect(0, 75 * devicePixelRatio, 18 * devicePixelRatio, 75 * devicePixelRatio); }
  if (st.color === 'duel') { /* 四档：绿=两批都赢 · 黄=符号翻 · 红=两批都输（灰在下方文案里说明）*/
    cg.fillStyle = '#39d98a'; cg.fillRect(0, 0, 18 * devicePixelRatio, 70 * devicePixelRatio);
    cg.fillStyle = '#e0b13c'; cg.fillRect(0, 70 * devicePixelRatio, 18 * devicePixelRatio, 20 * devicePixelRatio);
    cg.fillStyle = '#ff6b6b'; cg.fillRect(0, 90 * devicePixelRatio, 18 * devicePixelRatio, 60 * devicePixelRatio); }
  if (st.color === 'hp') { /* 页面口径是渐变，但**两端要重标**（色标区间换成实测 p02..p98，不是 F 的区间）*/
    for (var hi = 0; hi < 150 * devicePixelRatio; hi++) { var hrgb = rampRGB(1 - hi / (150 * devicePixelRatio));
      cg.fillStyle = 'rgb(' + hrgb[0] + ',' + hrgb[1] + ',' + hrgb[2] + ')'; cg.fillRect(0, hi, 18 * devicePixelRatio, 1); } }
  if (st.color === 'de') { /* Δε 用**发散**色标：白 = 0（口径不敏感），红 = 开探索就掉，蓝 = 开了反而强 */
    for (var di = 0; di < 150 * devicePixelRatio; di++) { var t = 1 - di / (150 * devicePixelRatio);   /* 顶 = +6，底 = −6 */
      cg.fillStyle = t >= 0 ? mix('#dce6f5', '#ff6b6b', t) : mix('#dce6f5', '#57a6ff', -t);
      cg.fillRect(0, di, 18 * devicePixelRatio, 1); } }
  /* §E321 当选键：绿 = 比现役强、红 = 落后、白 = 打平；**橙带 = 方向偏正但同号数不到 6/8（判不动）**，
   *   不许并进绿里（duel 那条腿的同一规矩，§E310）。色标两端 ±8pt = §E316 量到的种子极差量级。*/
  if (st.color === 'sc') {
    for (var si = 0; si < 150 * devicePixelRatio; si++) { var ts2 = 1 - si / (150 * devicePixelRatio);
      cg.fillStyle = ts2 >= 0 ? mix('#dce6f5', '#39d98a', ts2) : mix('#dce6f5', '#ff6b6b', -ts2);
      cg.fillRect(0, si, 18 * devicePixelRatio, 1); }
    cg.fillStyle = '#e0b13c'; cg.fillRect(0, 62 * devicePixelRatio, 18 * devicePixelRatio, 8 * devicePixelRatio); }
  var s1 = document.createElement('div'); s1.textContent = st.color === 'gl' ? ('G(long) 高 ' + GLR[1].toFixed(1) + '（红）')
    : st.color === 'pm' ? ('✅ 可上槽 ' + NPPASS + ' 枚（绿）')
    : st.color === 'duel' ? ('✅ 两批种子都赢现役 ' + NWIN + ' 枚（绿）')
    : st.color === 'hp' ? ('页面 1st 高 ' + EPR[1].toFixed(1) + '%（红）')
    : st.color === 'de' ? ('Δε +' + 6 + 'pt（红 = 脆）')
    : st.color === 'sc' ? ('当选键 +8pt（绿 = 比现役强 · 实测 ' + NSEL + ' 枚 ‖ 判据内赢 ' + NSELUP + '）')
    : ('F 高 ' + fr[1].toFixed(2) + (st.goodTop ? '（最好 · 顶）' : '（最好 · 地板）'));
  var s2 = document.createElement('div'); s2.textContent = st.color === 'gl' ? ('G(long) 低 ' + GLR[0].toFixed(1) + '（蓝）· 闸要求 ≥3')
    : st.color === 'pm' ? ('⛔ 栽桩 ' + (NPRM - NPPASS) + ' 枚（红）· 灰 = 未测（' + (N - NPRM) + ' 枚）')
    : st.color === 'duel' ? ('⛔ 两批都输 ' + (NDUEL - NWIN - NFLIP) + ' 枚（红）· 黄 = 符号翻 ' + NFLIP + ' 枚 · 灰 = 未测（' + (N - NDUEL) + '）')
    : st.color === 'hp' ? ('页面 1st 低 ' + EPR[0].toFixed(1) + '%（蓝）· 灰 = 未测（' + (N - NEPS) + ' 枚）')
    : st.color === 'de' ? ('Δε −6pt（蓝 = 开了探索反而强）· 白 = 不敏感 · 灰 = 未测（' + (N - NEPS) + '）‖ 脆（≥3.41）' + NBRIT + ' 枚 ‖ 吃探索（<0）' + NSTRONG + ' 枚')
    : st.color === 'sc' ? ('当选键 −8pt（红 = 落后现役）· 白 = 打平 · 橙 = 偏正但同号 <6/8（判不动 ' + NSELSOFT + ' 枚）· 灰 = 未测（' + (N - NSEL) + '）‖ 明显落后（≤−2）' + NSELDOWN + ' 枚')
    : ('F 低 ' + fr[0].toFixed(2) + (st.goodTop ? '（最差 · 地板）' : '（最差 · 顶）'));
  lg.appendChild(s1); lg.appendChild(c); lg.appendChild(s2);
  /* §E330 F 腿的色标是**按秩**铺的 ⇒ 带的正中不是 (min+max)/2 而是中位数。不印这一行，
   *   读图的人会把"中性灰"当成"不好不坏的绝对电平"，而它真正的意思是"库里第 50% 名"。*/
  if (st.color === 'F') { var sm = document.createElement('div'); sm.style.color = 'var(--dim)';
    sm.textContent = '灰 = 中位 F ' + fMed().toFixed(3) + '（按分位铺色，每档同样多的点）'; lg.appendChild(sm); }
  if (OKL.length) {
    var s3 = document.createElement('div'); s3.style.marginTop = '6px'; s3.style.color = '#39d98a';
    s3.textContent = '绿环 = 逐枚过线判定（' + OKL.length + '/' + POKJ + ' 枚）· 二维不画范围';
    var s4 = document.createElement('div'); s4.style.color = 'var(--dim)'; s4.style.maxWidth = '190px'; s4.style.lineHeight = '1.35';
    s4.textContent = '判据：' + (typeof OKSRCJ === 'string' && OKSRCJ ? OKSRCJ : '—'); lg.appendChild(s3); lg.appendChild(s4); }
}
/* ③ 家族图例 = 可点按钮（按成员数从多到少），点一个只留这些家族。
 *   §E304：默认按**方法家族**列（22 家，按钮上直接写"改了什么"），切到 RNG seed 才列 seed。*/
function buildFamBar() {
  var el = document.getElementById('fam'); el.innerHTML = '';
  var byFam = {};
  if (st.color !== 'seed') for (var i = 0; i < N; i++) if (P[i].fam) byFam[P[i].fam] = famLab(P[i]);
  for (var j = 0; j < GRP.keys.length; j++) {
    (function (k) {
      var b = document.createElement('button'); b.className = 'fam';
      var lab = st.color === 'seed' ? ('seed ' + k) : ('家族 ' + k + ' · ' + famShort({ fam: k }, 24));
      b.innerHTML = '<i style="background:' + GRP.col[k] + '"></i>' + lab + '<b>' + GRP.cnt[k] + '</b>';
      b.title = st.color === 'seed' ? '这一档 RNG 种子被多少枚复用（旧口径，只说明"哪几枚同种子"）' : (byFam[k] || '');
      b.onclick = function () { st.hi[k] = !st.hi[k]; b.classList.toggle('on', !!st.hi[k]); req(); };
      el.appendChild(b);
    })(GRP.keys[j]);
  }
  var r = document.createElement('button'); r.id = 'clearhi'; r.textContent = '清除高亮';
  r.onclick = function () { st.hi = {}; Array.prototype.forEach.call(el.querySelectorAll('.fam'), function (x) { x.classList.remove('on'); }); req(); };
  el.appendChild(r);
  var tipEl = document.createElement('span'); tipEl.className = 'famtip';
  tipEl.textContent = (st.color === 'seed' ? 'RNG seed（旧口径）' : '家族（训练方法 / 目标大改）') + ' · 点选可高亮，可多选';
  el.insertBefore(tipEl, el.firstChild);
}
/* ⑤ 底色模块：预设 + 取色器，按亮度翻墨色（亮底必须深字，否则对比度就是用户说的那个问题）*/
function lum(c) { var r = parseInt(c.slice(1, 3), 16) / 255, gg = parseInt(c.slice(3, 5), 16) / 255, b = parseInt(c.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * gg + 0.0722 * b; }
function setBg(c) {
  st.bg = c; var L = lum(c), lite = L > 0.45;
  st.ink = lite ? '#0d1420' : '#eef4ff'; st.dim = lite ? '#4a5670' : '#9fb0cc';
  var d = document.documentElement.style;
  d.setProperty('--bg', c);
  d.setProperty('--panel', lite ? '#dfe6f2' : shade(c, 8));
  d.setProperty('--btn', lite ? '#ffffff' : shade(c, 16));
  d.setProperty('--ink', lite ? '#141a26' : '#dce6f5');
  d.setProperty('--dim', lite ? '#4d5872' : '#9fb0cc');
  /* 图例浮在右上，会压住点云右缘的标签 ⇒ 给它一层与底色同系的半透明底，读得清又不假装是数据 */
  var lg = document.getElementById('legend');
  if (lg) lg.style.background = 'rgba(' + parseInt(c.slice(1, 3), 16) + ',' + parseInt(c.slice(3, 5), 16) + ',' + parseInt(c.slice(5, 7), 16) + ',.82)';
  d.setProperty('--line', lite ? '#b7c2d6' : '#33415c');
  document.getElementById('bgn').textContent = c + (lite ? '（浅底 ⇒ 深色字）' : '（深底 ⇒ 浅色字）');
  req();
}
function shade(c, amt) { var r = Math.min(255, parseInt(c.slice(1, 3), 16) + amt), gg = Math.min(255, parseInt(c.slice(3, 5), 16) + amt),
  b = Math.min(255, parseInt(c.slice(5, 7), 16) + amt); return 'rgb(' + r + ',' + gg + ',' + b + ')'; }

/* ---- 交互：地图/三维 = 左键拖动平移、右键拖动旋转（用户 10-04 第三轮）；平面态滚轮以光标为中心 ---- */
var drag = null;
cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
cv.addEventListener('mousedown', function (e) {
  drag = [e.clientX, e.clientY, st.ox, st.oy, st.yaw, st.pit, st.ox3, st.oy3, e.button, st.tX, st.tY, st.tTilt, st.tShear]; });
window.addEventListener('mouseup', function () { drag = null; });
window.addEventListener('mousemove', function (e) {
  var r = cv.getBoundingClientRect();
  if (drag) {
    var cdx = e.clientX - drag[0], cdy = e.clientY - drag[1];
    if (st.mode === 'map') {
      if (drag[8] === 2) { if (st.elev > 0.05) { st.yaw = drag[4] - cdx / 160; st.pit = Math.max(0.06, Math.min(1.62, drag[5] + cdy / 200)); } }
      else { st.ox = drag[2] + cdx * devicePixelRatio; st.oy = drag[3] + cdy * devicePixelRatio; }
    } else if (st.mode === '3db') {
      if (drag[8] === 2) { st.yaw = drag[4] - cdx / 160; st.pit = Math.max(0.06, Math.min(1.5, drag[5] + cdy / 200)); }
      else { st.ox3 = drag[6] + cdx * devicePixelRatio; st.oy3 = drag[7] + cdy * devicePixelRatio; }
    } else if (st.mode === 'tree') {
      /* §E333 立体态右键 = 转视角：**上下 = 把行方向压扁（tTilt）**、**左右 = 一点横向错切（tShear）**。
       *   刻意不做地图那套 yaw/pit 全旋转 —— 谱系图的地板是"行 × 时间"的表，转到侧面就塌成一条线（用户点名的病）。
       *   平面态右键仍然不绑：二维表没有"旋转"这个动作。*/
      if (drag[8] === 2) {
        if (st.elev > 0.05) {
          st.tTilt = Math.max(0, Math.min(1.15, drag[11] + cdy / 260));
          st.tShear = Math.max(-0.55, Math.min(0.55, drag[12] - cdx / 420));
        }
      } else { st.tX = drag[9] + cdx * devicePixelRatio; st.tY = drag[10] + cdy * devicePixelRatio; }
    }
    req(); return;
  }
  if (e.target !== cv) return;
  var mx = (e.clientX - r.left) * devicePixelRatio, my = (e.clientY - r.top) * devicePixelRatio, best = -1, bd = 1e9;
  for (var i = 0; i < N; i++) { if (!scr[i]) continue; var dx = scr[i][0] - mx, dy = scr[i][1] - my, d = Math.sqrt(dx * dx + dy * dy); if (d < bd) { bd = d; best = i; } }
  var t2 = document.getElementById('tip');
  if (bd < 14 * devicePixelRatio && best >= 0) { t2.style.display = 'block'; t2.style.left = (e.clientX + 14) + 'px'; t2.style.top = (e.clientY + 10) + 'px';
    t2.textContent = tip(P[best], fRange()); } else t2.style.display = 'none';
});
cv.addEventListener('wheel', function (e) { e.preventDefault();
  var f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  if (st.mode === 'map') {
    if (st.elev < 0.5) {
      var r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * devicePixelRatio, my = (e.clientY - r.top) * devicePixelRatio;
      /* 光标下数据点必须不动：u = mx − w/2 ⇒ ox' = u − f·(u − ox)（锚点在画布中心，不在原点）*/
      var u = mx - cv.width / 2, v = my - cv.height / 2;
      st.ox = u - (u - st.ox) * f; st.oy = v - (v - st.oy) * f; st.k *= f;
    } else { st.k = Math.max(0.2, Math.min(60, st.k * f)); st.ox *= f; st.oy *= f; }
  } else if (st.mode === '3db') st.zoom3 *= f;
  else if (st.mode === 'tree') {
    /* 光标下的内容不动：screen = world·k + p ⇒ p' = m − f·(m − p)。夹在 0.4~12 倍（再小字糊成一团，再大只剩几个点）*/
    var rt = cv.getBoundingClientRect(), mt = (e.clientX - rt.left) * devicePixelRatio, nt = (e.clientY - rt.top) * devicePixelRatio;
    /* §E314 横纵分开：滚轮 = 横轴（时间）‖ Shift+滚轮 = 纵轴（家族行）。被改的那一轴以光标为锚，另一轴原地不动。 */
    var rt = cv.getBoundingClientRect(), mt = (e.clientX - rt.left) * devicePixelRatio, nt = (e.clientY - rt.top) * devicePixelRatio;
    if (e.shiftKey) {
      var ky = Math.max(0.4, Math.min(12, st.tKy * f)); f = ky / st.tKy; st.tKy = ky;
      st.tY = nt - (nt - st.tY) * f;
    } else {
      var kx = Math.max(0.4, Math.min(12, st.tKx * f)); f = kx / st.tKx; st.tKx = kx;
      st.tX = mt - (mt - st.tX) * f;
    }
  }
  req(); }, { passive: false });
/* 平面 ⇄ 立体：同一台相机躺下/起来 + 柱高 0⇄U，520ms 缓动 —— 不是跳页面。
 *   立起方向不碰 yaw（原地立起）；放平方向才把 yaw 插回 FLAT（平面图必须北朝上）。*/
var tw = null;
function toggle3d() {
  var to3d = st.elev < 0.5, tree = st.mode === 'tree';
  /* §E333 谱系图的"立体"只动抬升（st.elev），**不借地图那台相机**：它的视角由 tTilt/tShear 管，
   *   而 yaw/pit 会把地板真的转到侧视 ⇒ 24 行塌成一条线（用户点名的病）。地图那侧维持原行为。*/
  tw = { t0: performance.now(), dur: 520, from: { e: st.elev, y: st.yaw, p: st.pit },
    to: tree ? { e: to3d ? 1 : 0, y: st.yaw, p: st.pit }
      : (to3d ? { e: 1, y: null, p: SOLID.pit } : { e: 0, y: FLAT.yaw, p: FLAT.pit }) };
  document.getElementById('b3dt').textContent = to3d ? '平面' : '立体';
  tick();
}
function tick() {
  if (!tw) return;
  var t = Math.min(1, (performance.now() - tw.t0) / tw.dur), s = t * t * (3 - 2 * t), to = tw.to;
  st.elev = tw.from.e + (to.e - tw.from.e) * s;
  if (to.y !== null) st.yaw = tw.from.y + (to.y - tw.from.y) * s;   /* 立起方向 to.y = null ⇒ yaw 原地不动 */
  st.pit = tw.from.p + (to.p - tw.from.p) * s;
  if (t >= 1) { st.elev = to.e; if (to.y !== null) st.yaw = to.y; st.pit = to.p; tw = null; }
  req();
  if (t < 1) requestAnimationFrame(tick);
}
function setMode(m) {
  st.mode = m; st.color = DEF_COLOR[m] || 'fam';
  buildGroups();   /* 分组的键随颜色口径变 ⇒ 每次换模式都要重建，否则上一口径的颜色表会串色 */
  var cs = document.getElementById('color'); if (cs) cs.value = st.color;
  Array.prototype.forEach.call(document.querySelectorAll('#bar button[data-m]'), function (b) { b.classList.toggle('on', b.getAttribute('data-m') === m); });
  document.getElementById('colorrow').style.opacity = (m === '3db' || m === 'tree') ? '0.4' : '1';
  /* §E331 谱系图共用这同一个"立体"档（st.elev）：地图是"相机躺/立 + 柱高"，谱系图是"行躺平 / 高度=F"。
   *   共用一个开关是刻意的：用户在两个视图间来回看时，"立体"不该是两个各记一份的状态（否则一边立着一边躺着）。*/
  document.getElementById('b3dt').style.display = (m === 'map' || m === 'tree') ? '' : 'none';
  document.getElementById('b3dt').title = m === 'tree' ? '同一张谱系图：点一下让每枚点沿纵轴**原地升起**到它自己的 F 高度（地板不动，右键可压扁/错切）' : '同一张底，平面/立体无缝切换';
  if (m === 'map') { var pp = st.elev < 0.5 ? FLAT : SOLID; st.yaw = pp.yaw; st.pit = pp.pit; }
  else if (m === '3db') { st.yaw = 0.62; st.pit = 0.40; }
  /* §E333 tree 不碰 yaw/pit（那是地图相机的状态，切个视图就把它改掉会两头串色）；
     它自己的视角是 tTilt/tShear，**跨视图保留**（用户摆好的角度不该因为点了一下别的页就丢）。*/
  syncIso();
  req();
}
document.getElementById('b3dt').onclick = toggle3d;
/* §E306 曲面开关：三态循环（关 → 半透壳 → 只描边）。只在三维行为轴里出现。*/
var ISO3 = ['关', '半透壳', '只描边'];
function syncIso() { var b = document.getElementById('bisos');
  b.textContent = '过线曲面：' + ISO3[st.iso]; b.classList.toggle('on', st.iso > 0);
  var on3 = (st.mode === '3db');
  b.style.display = on3 ? '' : 'none';
  /* 阈值滑杆只在"曲面开着 + 三维行为轴"时占位 ⇒ 默认状态下一行都不多挤（§E304 那次数条撑出滚动条的教训）*/
  var r = document.getElementById('isorow'); if (r) r.style.display = (on3 && st.iso > 0) ? '' : 'none';
  var rg = document.getElementById('isognrow'); if (rg) rg.style.display = (on3 && st.iso > 0) ? '' : 'none';
  var gs = document.getElementById('isogn'); if (gs) gs.value = String(st.isoGN);
  var fs2 = document.getElementById('isof'); if (fs2) fs2.value = st.isoField;
  /* 滑杆位置也由这里统一刷 ⇒ 深链 #isot= 才能既改状态又改旋钮（放在初始化 IIFE 里会早于 hash 解析 ⇒ 显示 50%、实际 25%）
     ⚠ 这段在 const JS 那段模板字符串**里面** ⇒ 注释里绝不能出现反引号，出现一次就把整段字符串截断（本仓第 2 次踩，第二次就踩在这句警告上）*/
  var s = document.getElementById('isot'), v = document.getElementById('isotv');
  if (s) s.value = String(st.isoT); if (v) v.textContent = Math.round(st.isoT * 100) + '%';
  var tr = document.getElementById('isorow');   /* 阈值行的提示跟着场走：两场刻度不同，说明必须分开写 */
  if (tr) tr.title = (st.isoField === 'pot'
    ? '壳的判据 = 该处局部势 F（F = 线上口径 Hp + T·S，归一化到 0..1）。这条线只能落在 63%（全库均值）到 70%（场峰值）那一小段里：低于均值就把整片云圈进去、纯度退回底率 = 什么都没圈。默认 67% ⇒ 壳内约 122 枚、过线纯度 28%（底率 16%），留一复核还有 21% ⇒ 这一层是全场唯一"过了留一还站得住"的壳。'
    : '壳的判据 = 该处局部过线概率（往全库过线率 16% 收缩后的）。收缩后场的峰值实测只有 42% ⇒ 阈值拖过它必然空壳（50% 时"没有壳"是正确回答，不是坏了）。默认 30% ⇒ 壳内约 38 枚、纯度 66%；但留一复核只剩 11% ⇒ 这层壳是每枚点把自己那格照亮，看形状可以，别当证据。'); }
document.getElementById('bisos').onclick = function () { st.iso = (st.iso + 1) % 3; syncIso(); req(); };
(function () { var s = document.getElementById('isot'), v = document.getElementById('isotv');
  if (!s) return;
  s.value = String(st.isoT); if (v) v.textContent = Math.round(st.isoT * 100) + '%';
  /* 滑杆写进"当前场"那一格 ⇒ 来回切场不会把对方调好的线冲掉 */
  s.addEventListener('input', function () { st.isoT = +this.value;
    if (st.isoField === 'pot') st.isoTpot = st.isoT; else st.isoTok = st.isoT;
    if (v) v.textContent = Math.round(st.isoT * 100) + '%'; req(); });
})();
(function () { var g2 = document.getElementById('isogn'), g3 = document.getElementById('isof');
  if (g2) { g2.value = String(st.isoGN);
    g2.addEventListener('change', function () { st.isoGN = +this.value; req(); }); }   /* isoEnsure 的缓存键含 gn ⇒ 自动重建 */
  if (g3) { g3.value = st.isoField;
    g3.addEventListener('change', function () { st.isoField = this.value;
      st.isoT = (st.isoField === 'pot' ? st.isoTpot : st.isoTok);   /* 换场 = 换刻度 ⇒ 阈值必须跟着换，否则新场用的是旧场的线 */
      syncIso(); req(); }); }
})();
function syncHdir() { document.getElementById('bh').textContent = st.goodTop ? '好在上 ⇅' : '好在下 ⇅'; }
document.getElementById('bh').onclick = function () { st.goodTop = !st.goodTop; syncHdir(); req(); };
document.getElementById('reset').onclick = function () {
  st.ox = st.oy = 0; st.k = 1; st.ox3 = st.oy3 = 0; st.zoom3 = 1; st.tKx = 1; st.tKy = 1; st.tX = 0; st.tY = 0;
  if (st.mode === 'map') { var pp = st.elev < 0.5 ? FLAT : SOLID; st.yaw = pp.yaw; st.pit = pp.pit; }
  else if (st.mode === 'tree') { st.tTilt = 0; st.tShear = 0; }   /* §E333 谱系图的"复位"复的是它自己那两台（两轴缩放 + 视角）*/
  else { st.yaw = 0.62; st.pit = 0.40; }
  req(); };
document.getElementById('fitt').onclick = function () { var el = document.getElementById('fit');
  var on = el.style.display === 'none'; el.style.display = on ? 'block' : 'none'; this.classList.toggle('on', on); };
var Tt = document.getElementById('T');
Tt.addEventListener('input', function () { st.T = +Tt.value; document.getElementById('Tv').textContent = (+Tt.value).toFixed(2); req(); });
document.getElementById('color').addEventListener('change', function () { st.color = this.value;
  /* 换分组口径 ⇒ 高亮键的**含义**变了（家族号 vs seed），留着会把两回事混成一次高亮 ⇒ 必须清 */
  st.hi = {}; buildGroups(); buildFamBar(); req(); });
document.getElementById('labels').addEventListener('change', function () { st.labels = this.value; req(); });
document.getElementById('size').addEventListener('input', function () { st.size = +this.value; req(); });
document.getElementById('q').addEventListener('input', function () { st.q = this.value.trim(); req(); });
Array.prototype.forEach.call(document.querySelectorAll('#bar button[data-m]'), function (b) { b.onclick = function () { setMode(b.getAttribute('data-m')); }; });
Array.prototype.forEach.call(document.querySelectorAll('#bar button[data-bg]'), function (b) { b.onclick = function () { var c = b.getAttribute('data-bg');
  document.getElementById('bgc').value = c; setBg(c); }; });
document.getElementById('bgc').addEventListener('input', function () { setBg(this.value); });
window.addEventListener('resize', function () { fit0(); NBK = {}; FL = null; req(); });   /* 比例尺变了 ⇒ 场要按新度量重建 */
/* 深链：#mode=map&3d=1&T=0.2&labels=all&color=fam&hi=31,82&bg=%23e6ebf5（mode=2d/3dw 是旧链兼容，也方便无头截图复核）*/
var HCL = null, HT_SEEN = 0;
(function () { var hs = (location.hash || '').replace(/^#/, '').split('&');
  for (var i = 0; i < hs.length; i++) { var kv = hs[i].split('='); if (kv.length !== 2) continue;
    if (kv[0] === 'mode') {
      if (kv[1] === '3dw') { st.mode = 'map'; st.elev = 1; }
      else if (kv[1] === '2d' || kv[1] === 'map') { st.mode = 'map'; st.elev = 0; }
      else if (kv[1] === '3db' || kv[1] === '1d' || kv[1] === 'tree') st.mode = kv[1];
    }
    if (kv[0] === '3d') st.elev = +kv[1] ? 1 : 0;
    if (kv[0] === 'dir') st.goodTop = kv[1] !== 'bottom';
    if (kv[0] === 'T') { st.T = +kv[1]; Tt.value = kv[1]; document.getElementById('Tv').textContent = (+kv[1]).toFixed(2); }
    if (kv[0] === 'labels') { st.labels = kv[1]; document.getElementById('labels').value = kv[1]; }
    if (kv[0] === 'color') { st.color = kv[1]; HCL = kv[1]; document.getElementById('color').value = kv[1]; }
    if (kv[0] === 'hi') { var a = kv[1].split(','); for (var j = 0; j < a.length; j++) st.hi[a[j]] = true; }
    if (kv[0] === 'iso') st.iso = Math.max(0, Math.min(2, +kv[1]));   /* §E306 无头复核要用 */
    if (kv[0] === 'isot') { st.isoT = Math.max(0.15, Math.min(0.9, +kv[1])); HT_SEEN = 1; }
    /* §E312 壳分辨率 + 谱系图相机也走深链 ⇒ 无头复核能钉住这两个状态 */
    if (kv[0] === 'isogn') st.isoGN = Math.max(24, Math.min(128, +kv[1] || 72));
    if (kv[0] === 'isof') st.isoField = (kv[1] === 'pot' ? 'pot' : 'ok');
    if (kv[0] === 'tkx') st.tKx = Math.max(0.4, Math.min(12, +kv[1] || 1));
    if (kv[0] === 'tky') st.tKy = Math.max(0.4, Math.min(12, +kv[1] || 1));
    if (kv[0] === 'tk') { st.tKx = Math.max(0.4, Math.min(12, +kv[1] || 1)); st.tKy = st.tKx; }   /* 旧深链（单轴）= 两轴一起，兼容 §E312 那批截图 */
    if (kv[0] === 'tx') st.tX = +kv[1] || 0;
    /* §E333 谱系图立体视角也走深链 ⇒ 无头复核能钉住"压扁/错切"这两档（默认 0 = 原地上升）*/
    if (kv[0] === 'tilt') st.tTilt = Math.max(0, Math.min(1.15, +kv[1] || 0));
    if (kv[0] === 'shear') st.tShear = Math.max(-0.55, Math.min(0.55, +kv[1] || 0));
    if (kv[0] === 'ty') st.tY = +kv[1] || 0;
    if (kv[0] === 'bg') { st.bg = decodeURIComponent(kv[1]); } }
  /* §E312 两场各有各的刻度 ⇒ 深链只给 isof 不给 isot 时，必须把阈值换成**那场自己的**默认值
   *   （#isof=pot 若沿用 ok 场的 30%，会把整片云圈进去、纯度退回底率 = 一张什么都没圈的壳）。
   *   两个都给时按字面 honored，并把这条线记进那一场的格子，回来切场不会丢。*/
  if (HT_SEEN) { if (st.isoField === 'pot') st.isoTpot = st.isoT; else st.isoTok = st.isoT; }
  else st.isoT = (st.isoField === 'pot' ? st.isoTpot : st.isoTok);
  if (st.mode === 'map') { var pp = st.elev < 0.5 ? FLAT : SOLID; st.yaw = pp.yaw; st.pit = pp.pit;
    document.getElementById('b3dt').textContent = st.elev < 0.5 ? '立体' : '平面'; } })();
fit0(); buildFamBar(); setBg(st.bg); setMode(st.mode); syncHdir();
if (HCL) { st.color = HCL; var _cs = document.getElementById('color'); if (_cs) _cs.value = HCL; }   /* setMode 会把颜色重置成默认 ⇒ 深链的颜色最后再压回去（下拉框也要跟着压，否则"显示家族、画的是别的"）*/
`;

const html = '<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>§E302 冠军进化查看器 · 一维 / 地图（平面⇄立体 · 过线逐枚绿环）/ 三维行为轴</title>\n' +
'<style>\n' +
':root{--bg:#0f1522;--panel:#131a29;--btn:#1b2436;--ink:#dce6f5;--dim:#9fb0cc;--line:#33415c}\n' +
'html,body{height:100%}\n' +
'body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,"Microsoft YaHei",sans-serif;font-size:13px;display:flex;flex-direction:column;overflow:hidden}\n' +
'#bar{flex:0 0 auto;background:var(--panel);border-bottom:1px solid var(--line);padding:8px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;z-index:5}\n' +
'button,select,input{background:var(--btn);color:var(--ink);border:1px solid var(--line);border-radius:5px;padding:5px 9px;font:inherit}\n' +
'button.on{background:#2f6df6;border-color:#2f6df6;color:#fff;font-weight:600}\n' +
'button:hover{border-color:#6f83a8}\n' +
'#wrap{position:relative;flex:1 1 auto;min-height:0}\n' +
'canvas#cv{width:100%;height:100%;display:block;cursor:grab}\n' +
'#fam{flex:0 0 auto;background:var(--panel);border-top:1px solid var(--line);padding:7px 14px;display:flex;gap:7px;align-items:center;overflow-x:auto;white-space:nowrap;z-index:6}\n' +
'#fam button.fam{padding:3px 7px;border-radius:14px;font-size:12px;display:flex;gap:5px;align-items:center}\n' +
'#fam button.fam i{width:10px;height:10px;border-radius:50%;display:inline-block;border:1px solid rgba(255,255,255,.35)}\n' +
'#fam button.fam b{color:var(--dim);font-weight:400}\n' +
'#fam .famtip{color:var(--dim);font-size:12px;padding-right:6px}\n' +
'#tip{position:fixed;display:none;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:8px 10px;white-space:pre;font-size:12px;line-height:1.5;pointer-events:none;z-index:9;box-shadow:0 6px 22px rgba(0,0,0,.55);color:var(--ink)}\n' +
'#legend{position:absolute;right:14px;top:12px;font-size:11px;color:var(--ink);text-align:left;padding:7px 9px;border:1px solid var(--line);border-radius:6px}\n' +
'#legend canvas{border:1px solid #8ea2c0;margin:3px 0}\n' +
'#stat{position:absolute;left:14px;top:10px;color:var(--dim);font-size:12px}\n' +
'label{color:var(--dim);display:flex;gap:6px;align-items:center}\n' +
'#fit{position:absolute;left:14px;bottom:14px;color:var(--dim);font-size:11px;max-width:640px;line-height:1.5}\n' +
'</style></head><body>\n' +
'<div id="bar">' +
'<button data-m="1d">一维（F 排序带）</button>' +
'<button data-m="map" class="on">地图（缩放/平移）</button>' +
'<button id="b3dt" title="同一张底，平面/立体无缝切换">立体</button>' +
'<button id="bh" title="翻的只有高度方向；颜色恒为 红=F高">好在上 ⇅</button>' +
'<button data-m="tree">谱系（时间 × 家族）</button>' +
'<button data-m="3db">三维行为轴</button>' +
'<button id="bisos" title="在三维行为轴里用闭合曲面圈出过线那一坨。三态：关 → 半透壳 → 只描边（壳永远画在点后面，点不会被挡）">过线曲面：关</button>' +
'<label id="isorow" style="display:none" title="壳的判据（两种场各有各的刻度，说明见右边那个下拉框）">壳阈值 <input type="range" id="isot" min="0.15" max="0.9" step="0.01" value="0.3"><span id="isotv">30%</span></label>' +
'<label id="isognrow" style="display:none" title="壳的网格分辨率：格数越多壳越圆，但重建时间按立方涨（72 格实测约 0.2~0.3 秒，96 约 0.6 秒，128 约 1.5 秒；建一次就缓存，转视角/缩放每帧只重投影 ⇒ 嫌慢可以停在中档）">壳网格 <select id="isogn"><option value="52">52（旧默认·有棱面）</option><option value="72">72</option><option value="96">96</option><option value="128">128（最圆·最慢）</option></select> 场 <select id="isof" title="同一个壳引擎、两种场，默认阈值不同（都是从 iso-sweep.mjs 那张表定的，不是看着顺眼挑的）：&#10;· 过线概率（默认 30%）⇒ 壳 = 局部过线富集区。收缩后场峰值只有 42%，所以 50% 以上正确地什么都不画。&#10;· 势 F（默认 67%）⇒ 壳 = 预测势最高的一片。这条线只能落在均值 63% 与峰值 70% 之间，用 30% 会把整片云圈进去。&#10;两列读数（含自己 / 留一）就是判这层壳能不能当证据的地方：留一塌到 16% 上下 = 每枚点把自己照亮。"><option value="ok">过线概率</option><option value="pot">势（F）</option></select></label>' +
'<button id="reset">复位视图</button>' +
'<button id="fitt">投影判据 ⓘ</button>' +
'<label>T <input type="range" id="T" min="0" max="0.3" step="0.01" value="0.10"><span id="Tv">0.10</span></label>' +
'<label id="colorrow">颜色 <select id="color"><option value="fam">训练方法家族</option><option value="seed">RNG seed（旧口径）</option><option value="F">F（线上口径势 = Hp+T·S）</option><option value="gl">长程广度 G(long)</option><option value="pm">上槽体检（实测）</option><option value="duel">对现役决斗（实测）</option><option value="hp">页面口径夺1率（实测）</option><option value="de">部署脆弱性 Δε（实测）</option><option value="sc">当选键 sc − 现役（实测）</option></select></label>' +
'<label>标签 <select id="labels"><option value="champ">只标冠军 + 首尾（避让）</option><option value="all">尽量全标（避让）</option><option value="off">不标</option></select></label>' +
'<label>点大小 <input type="range" id="size" min="0.6" max="2.2" step="0.1" value="1"></label>' +
'<label>找 <input type="search" id="q" size="12" placeholder="包名片段"></label>' +
'<span style="color:var(--dim)">底色</span>' +
'<button data-bg="#0f1522">深蓝</button><button data-bg="#05070d">纯黑</button>' +
'<button data-bg="#212a3b">石板</button><button data-bg="#e6ebf5">浅底</button>' +
'<input type="color" id="bgc" value="#0f1522" title="自定义底色"><span id="bgn" style="color:var(--dim);font-size:11px"></span>' +
'</div>\n' +
'<div id="wrap"><canvas id="cv"></canvas><div id="stat"></div><div id="legend"></div>' +
'<div id="fit" style="display:none">' + (fit.length ? '本图坐标与判据（' + 'fit.tsv ← e287-fit.mjs' + ' 实测，随机排点当地板）：<br>' +
  fit.map(l => l.split('\t').join(' · ')).join('<br>').replace(/</g, '&lt;') : '') + '</div></div>\n' +
'<div id="fam"></div>\n' +
'<div id="err" style="display:none;position:fixed;right:14px;bottom:60px;background:#5b1620;border:1px solid #ff6b6b;color:#ffd9d9;padding:8px 12px;border-radius:6px;font-size:12px;z-index:20"></div>\n' +
'<div id="tip"></div>\n' +
'<script>var DATA = ' + JSON.stringify(DATA) + '; var OKSRCJ = ' + JSON.stringify(OKSRC) + '; var FAMLAB = ' + JSON.stringify(FAMLAB) + ';\n' + JS + '</script></body></html>';
writeFileSync(join(HERE, OUT), html);
console.log('已写 ' + join(HERE, OUT) + '（' + (html.length / 1024).toFixed(0) + ' KB，自包含、无外部依赖）');
