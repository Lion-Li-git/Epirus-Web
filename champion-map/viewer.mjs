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
/* E393 DS（丙·投影）：生成侧选定坐标（默认 t-SNE，--proj=old 回旧布局）。
 *   ⚠ 必须在生成侧：浏览器取景范围 PV 是装载时按坐标算的，装载后再换 ⇒ 视口对不上（实测画到右下角）。 */
const PROJTSNE = arg('proj', 'tsne') !== 'old';
const CF = join(HERE, 'coords.tsv');
if (!existsSync(CF)) { console.error('⛔ 没有 ' + CF + ' ⇒ 先跑 docs/artifacts/e287-out/e287-figs.mjs，再把落盘拷成 coords.tsv'); process.exit(2); }
const t = readFileSync(CF, 'utf8').trim().split('\n'), head = t[0].split('\t');
const rows = t.slice(1).map(l => { const c = l.split('\t'); const o = {}; head.forEach((k, i) => { o[k] = c[i]; }); return o; });
if (rows.length < 50) { console.error('⛔ 坐标表只有 ' + rows.length + ' 行'); process.exit(2); }
/* ===== §E489 投影列不齐就是**装错货**，不许静默逐行退回到旧力导向 =====
 *   第 271 行那句 `(PROJTSNE && r.xt) ? r.xt : r.x2` 是"某枚**单独**没测过投影"时的退路，
 *   它挡不住"整列没了"（那种情况下每一枚都走退路 ⇒ 920 枚全画回旧布局，一个字的警告都没有）。
 *   实测踩过：跑完五步重建链（那时链子里还没有第⑥步 proj-tsne）⇒ 表从 41 列变 36 列，
 *   用户第一眼看的是「投影一下子变回很早的版本、区分度变得很低」，而产物自检 69 条**全绿**。
 *   ⇒ 判据放在**生成侧**：缺列 / 空过半 ⇒ 拒绝出图，除非明说 --proj=old。 */
if (PROJTSNE) {
  const noCol = ['xt', 'yt'].filter(c => head.indexOf(c) < 0);
  if (noCol.length) { console.error('⛔ coords.tsv 没有投影列 ' + noCol.join('/') + '（表头 ' + head.length + ' 列）' +
    '\n       ⇒ 页面会**悄悄**把每一枚都画成旧力导向坐标（kNN@10 保住率 0.52 → 0.08 = 用户说的"区分度很低"）。' +
    '\n         补投影：node champion-map/proj-tsne.mjs（重建链第⑥步）‖ 确实要旧投影：--proj=old'); process.exit(2); }
  const empty = rows.filter(r => !(r.xt && r.yt));
  if (empty.length > rows.length * 0.02) { console.error('⛔ 投影列在，但 ' + empty.length + '/' + rows.length + ' 行是空的' +
    '\n       ⇒ 这些枚会退回旧坐标，与其余的**不在同一套投影里**（同一张图上混两套坐标 = 距离没有意义）。' +
    '\n         空的前 8 枚：' + empty.slice(0, 8).map(r => r.id).join(' ') + '\n         补投影：node champion-map/proj-tsne.mjs'); process.exit(2); }
  console.log('投影口径 ✅ ' + (rows.length - empty.length) + '/' + rows.length + ' 枚用 t-SNE 列 xt/yt' +
    (empty.length ? '（' + empty.length + ' 枚没有 ⇒ 逐行退旧坐标，见上面那条 2% 的界）' : ''));
}
/* ===== §E491 头号尺有空洞就是**装错货**，比缺投影更狠 =====
 *   下面那句 DATA 取数是 `Hp: +r.Hp` ⇒ 空串变成 **0**，而 `Fv(d) = d.Hp/100 + st.T*d.S` 是图上**所有**排序与
 *   颜色的底（名次、F 窗口、绿红分界、色标定标全读它）。于是"没测过"被画成"线上口径夺1率 0%"。
 *   实测踩过：三枚融合粒没跑 attach-hp 那张 --more ⇒ Hp 空 ⇒ 图上名次 728/732，悬停卡还写着
 *   「Hp 线上口径夺1率 = 0.0%（图上的尺就是它）」；补测之后是 51.8 / 52.8 / 53.0（现役 47.3）⇒ 完全反过来。
 *   这与 §E308 那条"空串必须是 null，不许当 0"是同一条规矩，只是这次漏在 Hp 上。
 *   ⇒ 这里**不留退路**：要出图就得补测（命令照抄下面那句）。留一个 --allow-no-hp 就等于把这条守卫变成建议。 */
{ const noHp = rows.filter(r => String(r.Hp === undefined ? '' : r.Hp).trim() === '');
  const noDe = rows.filter(r => String(r.De === undefined ? '' : r.De).trim() === '');
  if (noHp.length || noDe.length) { console.error('⛔ coords.tsv 的头号尺有空洞：Hp 空 ' + noHp.length + ' 枚 ‖ De 空 ' + noDe.length + ' 枚' +
    '\n       前 8 枚：' + noHp.concat(noDe).slice(0, 8).map(r => r.id).join(' ') +
    '\n       ⇒ 下面那句 `Hp: +r.Hp` 会把空串变成 0，而 F = Hp/100 + T·S 是图上**所有**排序的底 ⇒ 这几枚会被画成库内倒数（"未测"冒充"0%"）。' +
    '\n         补测：node champion-map/eps-full.mjs --extra=<这批的 extra 表> --onlyExtra --out=eNN-epsfull.tsv' +
    '\n         然后重跑：node champion-map/rebuild-coords.mjs（第③步会把 eNN-epsfull.tsv 一起喂给 attach-hp）'); process.exit(2); }
  console.log('头号尺口径 ✅ ' + rows.length + ' 枚的 Hp/De 全部在册（空值会让 F 把"未测"当 0 算）'); }
const fitP = join(HERE, 'fit.tsv');
const fit = existsSync(fitP) ? readFileSync(fitP, 'utf8').trim().split('\n') : [];
/* 过线来源（§E298）：**优先**用现跑的同一道闸 `feas-s*.tsv`（覆盖全 718 枚、样本量统一 n=20/aggr40/seat100）；
 *   没有才退回包自己 META 里的历史 feasibility.ok（`panel.tsv` 只有 94 枚，且那 482 枚有值的还跨 6 个 opps 层
 *   ⇒ §E287 实测"只换 opps 池过线率 45.7%→6.4%"，混在一起画就是假范围）。 */
/* §E556：`feas-s4.tsv` = 10-09 那 63 枚**代表臂**现跑同一道闸的判定（`feas.mjs --ids=…`，tag 同为 n=20/aggr100/seat100）。
 *   为什么不并进 s1~s3 那张：那三片是 10-08 全库 920 枚的一次性跑批，混写会让"哪一行是哪一批"从文件上消失；
 *   分开一片，代价只是这一行多一个名字，换来的是 §E492 那道 tag 对账仍然指着"每片自己是什么档"说得清。 */
const FEAS_FILES = ['feas-s1.tsv', 'feas-s2.tsv', 'feas-s3.tsv', 'feas-s4.tsv', 'feas.tsv'].filter(f => existsSync(join(HERE, f)));
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
let OKM = null, POK = 0, OKSRC = '', OKTAG = '';
if (FEAS_FILES.length) {
  OKM = {}; const TAGS = {};
  for (const f of FEAS_FILES) {
    const L = readFileSync(join(HERE, f), 'utf8').trim().split('\n');
    const hd = L[0].split('\t'), iId = hd.indexOf('id'), iOk = hd.indexOf('ok'), iF = hd.indexOf('fails'), iT = hd.indexOf('tag');
    for (const l of L.slice(1)) { const c = l.split('\t'); const id = c[iId]; if (!id) continue;
      /* §E307 顺手把 G(long) 也带进来：它是闸卡住前沿的那条腿（前 30 名里 16 枚未过线，多数栽在这儿），
       *   图上原本完全看不见 ⇒ 多一个着色口径就能当场指出"该往哪儿训"。 */
      if (c[iOk] === '0' || c[iOk] === '1') {
        OKM[id] = { ok: c[iOk] === '1', fails: String(c[iF] || '').slice(0, 160), g2: Number(c[hd.indexOf('G2')]) };
        /* §E492 样本量随行读进来并**对账**：`fieldA` 那一栏的分辨率直接由 n 决定（n=40 ⇒ ±12.4pt，n=100 ⇒ ±7.8pt），
         *   而这张表是四张文件按"后写覆盖先写"合并的 ⇒ 混两套样本量就等于把同一列画成两把尺，
         *   且事后**从数据里看不出哪一行是哪把**。缺 tag 列的老表按 'n=20/aggr40/seat100' 记（那批就是这么跑的）。 */
        const tg = iT >= 0 ? String(c[iT] || '').trim() : '';
        TAGS[tg || 'n=20/aggr40/seat100（老表，无 tag 列）'] = (TAGS[tg || 'n=20/aggr40/seat100（老表，无 tag 列）'] || 0) + 1; } }
  }
  const tk = Object.keys(TAGS);
  if (tk.length > 1) { console.error('⛔ 过线判定表里混了 ' + tk.length + ' 种样本量：' +
    tk.map(x => x + ' × ' + TAGS[x]).join(' ‖ ') +
    '\n       ⇒ 同一列 `fieldA` 被两把尺量过，而"20% 那条线判不判得动"直接由 n 决定（n=40 ±12.4pt ‖ n=100 ±7.8pt）。' +
    '\n         要么全库重跑到同一个 n：node champion-map/feas.mjs --shard=k/N --out=feas-sK.tsv（改 n 请改 audit-lib 的 FEAS_N_DEFAULTS）'); process.exit(2); }
  OKTAG = tk[0] || '';
  POK = Object.keys(OKM).length; OKSRC = '现跑同一道闸（feasibilityOf · ' + (OKTAG || '表里没写样本量') + '）';
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
/* §E338 上线时刻（用户 ⑤：「冠军卡按上线时间排序放一列」）。
 *   ⚠ 不能用 coords.tsv 的 `ts` 顶替 —— 那是**训出**时刻；上线是另一次动作（用户 GO 之后换包），
 *   两者能差好几天（实测 v7cmin4-31 训出于 09-20 前后、09-21 18:49 才上槽）。
 *   表由 `ship-scan.mjs` 从 git 里**逐提交算槽文件权重指纹**抽出来（不是按提交标题点名，那条会造假账）。 */
const shipP = join(HERE, 'ship-times.tsv');
let SHIP = {};
/* §E378 旧槽位冠军的两把钟（§E376 只留了一把）：`SLOT_FIRST` = **第一次**进槽的时刻，
 *   `SLOT_META` = 那枚包自己 META 里的写盘时刻（= 训出）。横轴用的是后者，理由见 §E378 那一节。 */
let SLOT_FIRST = {}, SLOT_META = {};
if (existsSync(shipP)) {
  const sl = readFileSync(shipP, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n'), sh = sl[0].split('\t');
  const sId = sh.indexOf('id'), sW = sh.indexOf('shipWhen'), sH = sh.indexOf('hash'), sV = sh.indexOf('version');
  for (const l of sl.slice(1)) { const c = l.split('\t'); if (!c[sId]) continue;
    SHIP[c[sId]] = { when: c[sW] || '', hash: c[sH] || '', ver: c[sV] || '' }; }
  console.log('上线时刻 ' + Object.keys(SHIP).filter(k => SHIP[k].when).length + ' 枚在册（' +
    Object.keys(SHIP).filter(k => !SHIP[k].when).length + ' 枚抽不到 ⇒ 图上会退回训出时刻并标明）');
} else console.log('提示：没有 ship-times.tsv ⇒ 冠军序列只能按训出时刻排（跑 node champion-map/ship-scan.mjs）');
/* §E375：旧槽位冠军（id = SLOT-<wid8>）在 ship-times.tsv 里**没有**行 —— 那张表的建法是"从面板上有名字的包反查它何时上槽"，
 *   而这 16 枚恰恰是面板上没名字的那几段（§E369：槽文件一共换过 39 段，其中 20 段在面板上查不到 id）。
 *   它们的上线时刻在 `slot-timeline.tsv` 里（从**槽文件那一侧**逐提交算权重指纹建出来的，所以覆盖全部 39 段）。
 *   ⚠ 只填 SHIP 里还没有的键：面板上本来有名字的那 13 段仍以 ship-scan 为准（那张表连提交标题与版本号都核过）。
 *   ⚠ 也不许拿 coords.tsv 的 ts 顶 —— 那是**训出**时刻，与上槽是两次动作（§E338 记过这笔账）。 */
const stlP = join(HERE, 'slot-timeline.tsv');
if (existsSync(stlP)) {
  const tl = readFileSync(stlP, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n'), th = tl[0].split('\t');
  const tW = th.indexOf('wid'), tF = th.indexOf('fromUTC'), tS = th.indexOf('sha'), tM = th.indexOf('metaTs'), tU = th.indexOf('subject');
  /* §E463 旧槽位冠军在图上的标签原来是 SLOT-<8位哈希>（16 枚全是），用户 10-08：「太长了也让人看不明白，你把标签改成对应版本号」。
     版本号不用新数据：这张时间轴的 subject 就是引入它的那条提交标题，本仓换包一律把版本写在标题里
     （实测形如 "v1.3.0：多人（3 人）自对战训练…" ‖ "v1.3.4 训练场支持…" ‖ "feat(pack) v1.5.257 上槽 Ldemo"）。
     ⚠ 这里不用正则（模板转义那台自证会连累别处，且正则里要写 \d）：手扫第一个 'v' + 数字 + 至少一个点号。 */
  function verOf(sub) { const t = String(sub || '');
    for (let k = 0; k + 4 < t.length; k++) { if (t.charAt(k) !== 'v') continue;
      let e = k + 1, dig = 0, dot = 0; const NUM = '0123456789.';
      while (e < t.length && NUM.indexOf(t.charAt(e)) >= 0) { if (t.charAt(e) === '.') dot++; else dig++; e++; }
      if (dig >= 2 && dot >= 1) return t.slice(k, e); }
    return ''; }
  if (tW < 0 || tF < 0) console.log('⚠ slot-timeline.tsv 没有 wid/fromUTC 列（表头：' + tl[0] + '）⇒ 旧槽位冠军会退回"未上槽"');
  else {
    const BY8 = {};
    for (const l of tl.slice(1)) { const c = l.split('\t'); if (!c[tW]) continue;
      const w8 = c[tW].slice(0, 8);
      /* §E378：这张表 39 段里只有 **32 个不同权重**（同一枚回槽过多次：实测 cc573172 两次、037b2f71 三次、
       *   e379c62c 两次）。原来这份 BY8 是"后一行覆盖前一行"⇒ 记下来的是**最后一次**进槽的时刻，
       *   而"上线"这件事的第一次才是它（也是 §E378 那条接替链不出现倒挂的前提）。改成只留第一次。 */
      if (!(w8 in BY8)) { BY8[w8] = { when: c[tF] || '', hash: tS >= 0 ? (c[tS] || '') : '', ver: tU >= 0 ? verOf(c[tU]) : '' };
        SLOT_FIRST[w8] = c[tF] || ''; SLOT_META[w8] = tM >= 0 ? (c[tM] || '') : ''; } }
    let nstl = 0;
    for (const r of rows) { const id = String(r.id || '');
      if (id.indexOf('SLOT-') !== 0 || SHIP[id]) continue;
      const k = id.slice(5, 13);
      if (BY8[k]) { SHIP[id] = { when: BY8[k].when, hash: BY8[k].hash, ver: BY8[k].ver || '' }; nstl++; } }
    console.log('上线时刻补自**槽位时间轴** ' + nstl + ' 枚（其中版本号从提交标题认回 '
      + Object.keys(SHIP).filter(k => SHIP[k] && SHIP[k].ver).length + ' 枚 ‖ 旧槽位冠军 ‖ ship-times.tsv 覆盖不到的那几段 ‖ 时间轴共 ' + (tl.length - 1) +
      ' 段 / ' + Object.keys(SLOT_FIRST).length + ' 个不同权重 ‖ 横轴取 META 写盘时刻，有该时刻的 ' +
      Object.keys(SLOT_META).filter(k => SLOT_META[k]).length + ' 个）');
  }
} else console.log('提示：没有 slot-timeline.tsv ⇒ 旧槽位冠军会全部落在"未上槽"里（跑 node champion-map/slot-timeline.mjs）');
const DATA = rows.map(r => ({
  /* §E314 **头号尺换成线上口径**（用户："把冠军演化全部改成线上口径吧"）。
   *   `Hp` = 同一台 `eval-5p`、同一批 35 组合 × 30 局、同 seed，只是主体席按页面那样开 ε=0.2 soft；
   *   `H`  保留 = 考卷口径（ε=0 贪心）—— 历史文档里大量读数写的是它，覆盖掉就把名字偷走了（attach-hp.mjs 头注有账）。
   *   `De` = Δε = H − Hp（正 = 开探索就掉）。*/
  id: r.id, lin: r.lineage || '', kin: r.kin || '', seed: r.seed || '', H: +r.H, Hp: +r.Hp, De: +r.De, S: +r.S, Ge: +r.Geff, rk: +r.rank,
  /* §E566：同枚的 exam=120 档读数。**空必须是 null，不许 `+'' = 0`**（§E491 那条病就是 Hp 空洞被当 0% 画成库内倒数） */
  H120: (String(r.H120 === undefined ? '' : r.H120).trim() === '') ? null : +r.H120,
  /* §E373 预留的那个标记现在真的有值了：§E375 把 16 枚旧槽位冠军并进 coords.tsv 之后，
   *   档位里"旧冠军段"那一档才有东西可按（§E373 那版库里一枚旧包都没有 ⇒ 它一直藏着不出现）。
   *   判据按**类别名**判，不按 id 前缀判 —— id 是我起的名字（SLOT-<wid8>），lineage 才是"它住在槽里过"这件事的记录。
   *   ⚠ §E373 那版还留了一档"定标不算旧包"，这次**删了**：旧包的 F（0.203~0.407）整个落在不含它们的那批的范围
   *     （0.169~0.795）里面 ⇒ 那档算出来的两端就是 [0,1] = 出厂态，点下去一个像素都不动。空按钮比没按钮更坏。 */
  old: (r.lineage || '') === '旧槽位冠军' ? 1 : 0,
  /* §E321 当选键那条腿（`attach-sc.mjs` 贴进去的四列）：
   *   Sc  = 8 粒 seedBase 的 sc 均值 ‖ Scd = 逐 seedBase 与现役的配对差均值 ‖ Scs = 同号计数 ‖ Sch = 主场（@987654）那一粒。
   *   ⚠ 空串必须是 null，不许当 0 —— "没测过"与"和现役一样"是两件事（§E308 那条灰≠红的教训）。*/
  sc: r.Sc === '' || r.Sc === undefined ? null : +r.Sc,
  scd: r.Scd === '' || r.Scd === undefined ? null : +r.Scd,
  scs: r.Scs || '', sch: r.Sch === '' || r.Sch === undefined ? null : +r.Sch,
  /* E393 DS（丙·投影）：坐标由 --proj 选（t-SNE 列 xt/yt/xt3/yt3/zt3 由 proj-tsne.mjs 写进 coords.tsv）。
   *   判据 kNN@10 保住率：旧力导向布局 0.08 → t-SNE 0.52（同一个 12 维招法空间；用户：不用死磕实际意义）。 */
  x2: (PROJTSNE && r.xt) ? +r.xt : +r.x2, y2: (PROJTSNE && r.yt) ? +r.yt : +r.y2,
  x3: (PROJTSNE && r.xt3) ? +r.xt3 : +r.x3, y3: (PROJTSNE && r.yt3) ? +r.yt3 : +r.y3,
  z3: (PROJTSNE && r.zt3) ? +r.zt3 : +r.z3,
  /* §E334 权重身份去重（`attach-dup.mjs`）：`dn` = 同一份权重在面板上有几行 ‖ `dups` = 那几行的 id。
   *   不标就会把"901 行"读成"901 种打法"：实测只有 **713 个不同权重**，而最刺眼的一组是 **4 行都是现役本身**
   *   （SHIPPED-Ldemo ‖ Ldemo  C5-02-31 ‖ C5-02-71）⇒ 对局仪器反过来自证：那三枚打现役配对差恰好 0.0pt。*/
  dn: r.dupN === '' || r.dupN === undefined ? 1 : +r.dupN, dups: r.dupOf || '',
  /* §E338 上线时刻（`ship-scan.mjs` 逐提交算槽文件权重指纹抽出来的）：`sh` = 上槽时间 ‖ `sv` = 那一版号。
   *   抽不到 = 这枚**从没真进过槽**（实测 coords.tsv 的 lineage 列把 v7new6-94/96 标成"历代上槽"，
   *   而 git 里那两条只是 v1.5.114 标题"同时记 v7new6"的顺带点名 ⇒ 那是记账，不是上槽）。*/
  sh: SHIP[r.id] ? SHIP[r.id].when : '', sv: SHIP[r.id] ? SHIP[r.id].ver : '',
  /* §E304 家族：`fam` = 方法/目标等价类编号（按最早 ts 排 ⇒ 号大 = 训得晚）；`ms` = META 里真正的 RNG seed
   *   （和包名后缀那个数**不是一回事**，实测 META.seed 有 84 个取值、名字后缀只有 14 个）。*/
  fam: LIN[r.id] ? +LIN[r.id].fam : 0, ms: LIN[r.id] ? LIN[r.id].metaSeed : '',
  ts: LIN[r.id] ? LIN[r.id].ts : '', par: LIN[r.id] ? LIN[r.id].parent : '', pof: LIN[r.id] ? LIN[r.id].parentOf : '',
  /* §E363：wid = 这枚自己的**权重哈希** ⇒ 用来证"倒挂的那条边确实连的是同一份权重"（页内自检里判），
   *   没有它就只能拿 ts 说话，而"ts 倒挂"这件事本身有两种相反的解释（槽位时刻 vs 数据错）。*/
  wid: LIN[r.id] ? (LIN[r.id].wid || '') : '',
  /* §E314 解析不到实体时不再写"盘上查无该权重"（那句话暗示"还能找回来"）—— 换成有名有姓的合成节点 */
  pnm: LIN[r.id] ? (LIN[r.id].parentName || '') : '',
  /* §E367：父指针的**来路** —— hash = 包自己 META 里记的（实录）；seedpack/arm = 生成器按路径或臂名推的（推断）；
   *   demoted = 推出来的是"今天的槽主"而时间对不上 ⇒ 生成器已把它退回"父不可考"，图上不许再有这条边。*/
  psrc: LIN[r.id] ? (LIN[r.id].parentSrc || '') : '',
  /* §E487 融合粒有**两个父**：第一父走 pof（正常血统边），第二父走 pof2，画成另一种颜色的线。
   *   来源是 tools/soup-pack.mjs 写进包 meta 的实录（每粒来源的 wid），由 lineage.mjs 反查成图上的节点。*/
  pof2: LIN[r.id] ? (LIN[r.id].parentOf2 || '') : '', psrc2: LIN[r.id] ? (LIN[r.id].parentSrc2 || '') : '',
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
/* §E376 这 16 枚在 lineage.tsv 里天生没有行（面板上没名字 = §E369 那批），而谱系图的行表是按 `P[i].fam` 建的
 *   ⇒ 实测它们被**静默丢掉**：页内自检报"树上只有 901/917 枚、旧包 0/16 有位置"，而页面标题仍说 917 枚。
 *   修法不是猜血统，而是给一行**明说是合成**的家族：横轴位置用它们的**上槽**时刻（slot-timeline.tsv，与训出时刻不同件事，
 *   左栏字样里就把这一点点明），父边一律不画 —— 那条要等 #156 把嵌入态 wid 的别名接进 lineage.mjs。
 *   这一段必须跑在下面那句"家族几个"的日志**之前**，否则那句话说的是补之前的数。
 * §E377 行号从"最大号 + 1"改成 **0 放最上面**（用户："旧冠军应该按家族0放在最上面而不是最下面"）。
 *   行表本来就是 `fams.sort(a-b)` ⇒ 号小在上，而"号大 = 训得晚"这条规则说的是**训练家族**之间的序；
 *   旧槽位冠军是"更早的一批"，排在最下面等于把它们读成"最新"。
 *   ⚠ `fam = 0` 在 JS 里是 falsy，而行表与几处判据都写的是 `if (P[i].fam …)` ⇒ 必须另带一个 `famTop` 标记，
 *     并把那几处改成"有家族号 **或** 是这一行"。 */
(function () {
  var n = 0, nmeta = 0;
  for (const d of DATA) { if (!d.old) continue;
    d.fam = 0; d.famTop = 1;
    /* §E378 横轴改取**训出/写盘**时刻（slot-timeline 的 metaTs），不再拿上槽时刻顶。
     *   理由不是"哪个更正"，是**同一根轴上不能有两把钟**：其余 901 枚的 ts 全部出自 lineage.tsv（训出），
     *   而 §E376 给这 16 枚填的是上槽时刻 ⇒ 一接血统边就出现"父比子晚"（实测 57 条里有 4 条这样倒挂，
     *   而那 4 条是真的从这份权重热启动出来的）。上槽时刻仍然留着，但它是 `d.sh`（冠军序列那一列读它）。
     *   ⚠ metaTs 抽不到就**留空**：留空 ⇒ 这一枚不落格 ⇒ 页内自检「旧包必须真被画出来」当场红，
     *     比悄悄换一把钟好（第 92 条：两个时代的读数不许并成一句话）。 */
    const w8 = String(d.id).slice(5, 13);
    if (SLOT_META[w8]) { d.ts = SLOT_META[w8]; nmeta++; }
    n++; }
  if (n) { FAMLAB[0] = '旧槽位冠军 ' + n + ' 枚（面板上没名字那批 · 横轴 = 训出时刻 ‖ 上槽时刻在冠军序列那一列 · 点线 = 接替边）';
    console.log('谱系图补一行合成家族：' + n + ' 枚旧槽位冠军 → 家族 0（排在最上面 ‖ 横轴取 metaTs 的 ' + nmeta + ' 枚）'); }
})();
/* ===== §E378（#156）旧冠军的连线：15 条**槽位接替边** + 把悬空的实录血统边接回它的父 =====
 *   用户 10-07：「连线做一下吧……连线说的是旧冠军相关的连线」。两批边的**来路不同**，所以线型不同、页脚分开说：
 *   ① 接替边（灰点线）：说的是"上一次住在那个槽里的是谁"，**不是**"谁生了谁"。这 16 枚在 lineage.tsv 里天生没有行，
 *      真正的训练父一枚都没留下证据（实测：14/16 连 META 里都没有 hotstartFrom；e379c62c 记的 f6788d9c… 在盘上
 *      1503 份产物与 634 个可达 git blob 里都查无 ⇒ 那条只能继续空着）。
 *      ⚠ 链必须按**首次进槽**去重之后再连：那张表 39 段只有 32 个不同权重，按行直连会造出自边与环
 *        （实测出现 e379c62c ← e379c62c，且 037b2f71 同时被三段当父）。
 *   ② 悬空的血统边（淡蓝曲线，与其余血统边同型）：lineage.tsv 里 parent='e379c62c' 而 parentOf 写的是**文件名**
 *      「champion-5p-ab2-base」⇒ §E376 之前图上没有这个节点，**57 条实录边（parentSrc=hash，最硬的一级来路）静默不画**。
 *      §E374 已证到底：那份文件的权重与 SLOT-e379c62c 是同一枚 ⇒ 别名成立。
 *      ⚠ 为什么别名做在这一层而不是回 lineage.mjs 改表：SLOT-* 这批节点是本文件合成的，lineage.tsv 里没有它们的行
 *        ⇒ 生成器看不见靶节点，接不了。别名在这里解，就必须在这里自证（页内那条判据按 wid 前缀核身份，第 92 条①）。
 *      ⚠ 57 条里只接 **56**：long-33 训出于 09-12 13:26，而 e379c62c 的 META 写盘是 14:15 ⇒ 接上就是一条
 *        "父比子晚"的边，而图上那个琥珀虚线的意思恰恰是"假血统"（§E367）。宁可少画一条，并把它记在判据里。
 *   ③ §E464 改：584 枚共父 d13d3c85 **现在画得出来，而且是真边** —— 那个哈希不是"查无实体"，它是 SLOT-e379c62c
 *      （v1.3.57）那枚包**嵌入成 v7 之后**的指纹：训练服务记父走 weightsId(loadAny(种子).params)，
 *      而旧版这里与 §E314 都只按"文件里那份数组"的哈希去找 ⇒ 永远差一层嵌入。
 *      仍然要记住的读法警告：runner 对每一枚候选都拷同一份 BASE ⇒ 这条边不带方法信息，
 *      画出来是 500+ 根收在一个点的扇形（页脚第二行说这句），别读成"演化收敛"。 */
(function () {
  const byId = {}; for (const d of DATA) byId[d.id] = d;
  const olds = DATA.filter(d => d.old && d.ts);
  const ord = olds.slice().sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  let nchain = 0;
  for (let i = 1; i < ord.length; i++) { const c = ord[i], p = ord[i - 1];
    if (c.pof || p.id === c.id) continue;
    c.par = String(p.id).slice(5, 13); c.pof = p.id; c.psrc = 'slot-chain'; nchain++; }
  const tgt = byId['SLOT-e379c62c'];
  let nfix = 0, held = 0;
  if (tgt) for (const d of DATA) {
    /* §E554：这里原来只认 `champion-5p-ab2-base` 这**一个文件名**。但那是同一份权重在盘上的两份拷贝之一
     *   （§E374 已证 ab2-base 与 v1.3.58 同 wid），而 `lineage.mjs` 的 `parentOf` 填的是"当时在盘上的那份的名字" ⇒
     *   10-09 早上清掉那份未入库的拷贝之后，生成器改填 `champion-5p-v1.3.58`，别名不匹配 ⇒ **56 条实录边又悬空**
     *   （页内那条"父边不许指向图上不存在的枚"当场红，实测 56 条）。
     *   ⇒ 别名必须按**身份**认，不能按"哪份拷贝今天活着"认：两个名字都收，下面的 wid/时间守卫原样不动。 */
    if (d.pof !== 'champion-5p-ab2-base' && d.pof !== 'champion-5p-v1.3.58') continue;
    /* 身份守卫先于接线：父哈希必须真的是这枚节点的权重（不是"名字看着像"） */
    if (String(d.par).slice(0, 8) === String(tgt.id).slice(5, 13) && Date.parse(d.ts) > Date.parse(tgt.ts)) { d.pof = tgt.id; nfix++; continue; }
    /* 挡下来的必须**显式退回**，不许留着那个图上没有的文件名 —— 留着就是"静默少画"（§E378 之前 57 条就是这么没的）。
     *   走的是本仓已有的 demoted 形状（lineage.mjs §E367：不可信的父 ⇒ 退回不可考 + 标来路）。 */
    d.pof = ''; d.psrc = 'demoted-time'; held++; }
  console.log('§E378 接线：接替边 ' + nchain + ' 条（' + olds.length + ' 枚旧槽位冠军的链，按训出时刻排）‖ 悬空血统边接回 SLOT-e379c62c ' +
    nfix + ' 条 ‖ 被时间/身份守卫退回 ' + held + ' 条');
})();
let NRAW = 0;   /* §E440 去重**之前**的面板行数（= 原始 tsv 行数），给页内那句"729 种打法（面板原始 917 行）"用 */
/* ===== §E440 权重去重：同一份权重在图上只留一枚（用户 10-08：「去掉这些重复的权重再重新渲染一下」）=====
 *   §E334 那版只做了**标注**（悬停里印"同一份权重在面板上占 17 行"），图上照旧 917 枚 ⇒ 一撮拷贝挤在同一个位置，
 *   数点会多数，而"917 枚"与"729 种打法"这两个数永远对不上。现在直接从 DATA 里把重复行摘掉。
 *   留哪一枚必须确定，而且不许把"现役"摘掉（INC 是按 id 找 SHIPPED-Ldemo 的）：
 *     ① 组内有 SHIPPED-Ldemo ⇒ 留它；② 否则留有血统记录的那枚（d.lin 非空 ⇒ 它身上才有 ts/fam/par 这些信息）；
 *     ③ 否则留 dupOf 里排最前的那枚（dupOf 是 attach-dup 按**文件权重哈希**算出来的组内全集，顺序稳定）。
 *   摘掉的那枚不丢：id 记在保留那枚的 dups 上（悬停从"警告"改口成"本枚代表 N 份同名拷贝"），
 *   而**所有指向被摘那枚的父边一律改指保留那枚** —— 同一份权重 ⇒ 改指不改变这条边的意思（与 §E378 的别名接回同一种做法）。
 *   ⚠ 兜底还是页内那条「不许有任何父边指向图上不存在的枚」：漏改一条边它就红。 */
(function () {
  const groups = {};
  NRAW = DATA.length;
  for (const d of DATA) { if (!(d.dn > 1) || !d.dups) continue; (groups[d.dups] = groups[d.dups] || []).push(d); }
  const byId = {}; for (const d of DATA) byId[d.id] = d;
  const keeperOf = {}, drop = [];
  for (const key in groups) {
    const mem = groups[key];
    const order = key.split(' ').filter(Boolean);
    let k = mem.find(d => d.id === 'SHIPPED-Ldemo') || mem.find(d => d.lin) ||
      mem.slice().sort((a, b) => { const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
        return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib); })[0];
    keeperOf[k.id] = k.id;
    for (const d of mem) if (d !== k) { keeperOf[d.id] = k.id; drop.push(d.id); }
  }
  const before = DATA.length;
  /* ⚠ 只摘"**在某个重复组里且不是保留那枚**"的行：不在任何组里的行 keeperOf[id] 是 undefined，
   *   写成 `!== id` 会把全部独苗一起删掉（第一版实测 917 → 97 枚，就是这个条件漏了"没登记"这一支）。 */
  for (let i = DATA.length - 1; i >= 0; i--) { const kd = keeperOf[DATA[i].id]; if (kd && kd !== DATA[i].id) DATA.splice(i, 1); }
  /* 父边改指：pof 指向被摘那枚的，一律换成保留那枚（同一份权重） */
  let nrep = 0;
  for (const d of DATA) { if (d.pof && keeperOf[d.pof] && keeperOf[d.pof] !== d.pof) { d.pof = keeperOf[d.pof]; nrep++; } }
  /* 保留那枚的 dn 必须重算成"它代表几份"（原来那列是**全组行数**，摘完之后图上的语义才是"几份拷贝合成一枚"）*/
  for (const d of DATA) if (d.dn > 1) d.dn = 1 + drop.filter(x => keeperOf[x] === d.id).length;
  console.log('§E440 权重去重：' + before + ' 行 → ' + DATA.length + ' 枚（' + Object.keys(groups).length + ' 组共摘 ' + drop.length +
    ' 行）‖ 父边改指 ' + nrep + ' 条 ‖ 现役在图上=' + (DATA.some(d => d.id === 'SHIPPED-Ldemo') ? '是' : '⛔没了') );
})();
console.log('家族 ' + Object.keys(FAMLAB).length + ' 个（来自 lineage.tsv，旧槽位冠军那一行是本台补的合成行）‖ 无家族号 ' + DATA.filter(d => !d.fam && !d.famTop).length + ' 枚');
/* §E440：这一行的三个数必须**同源**（都从去重之后的 DATA 数），不能再印 POK = OKM 的键数 ——
 *   那是"判定表里有 901 个 id"，与图上有几枚无关，混在一行里就是两条尺。 */
console.log('过线判定源 = ' + (OKSRC || '无 ⇒ 不标绿环') + ' ‖ 判定表里有 ' + POK + ' 个 id ‖ 图上（去重后）有判定 ' + DATA.filter(d => d.ok !== null).length + ' 枚 ‖ 判为过线 ' + DATA.filter(d => d.ok === 1).length +
  ' 枚 ‖ 无判定 ' + DATA.filter(d => d.ok === null).length + ' 枚');

/* E404 DS（D-3）：壳的 WebGL2 后端放在独立文件里，生成时内联（避开模板字面量的转义坑）。 */
const GLJS = readFileSync(join(HERE, 'gl-mesh.js'), 'utf8');
const JS = `
var P = DATA, N = P.length;
/* §E440 权重去重挪到**生成侧**做了（图上 729 枚 = 729 种打法，一枚一档），所以原来那个"Σ1/dn 数出几种打法"的
 *   NDUP 删掉 —— 去重之后再套它会把每组只算 1/k 份，反而**少算**（原来它数 917 行 = 713 种；现在 N 本身就是种数）。
 *   NRAW = 去重前的面板行数，留着是因为"面板上有几行"与"图上有几枚"仍然是两件事，得说得出数。 */
var cv = document.getElementById('cv'), g = cv.getContext('2d');
var KF = 12;   /* E387 DS：换回 §E382b 场区时它引用的顶层常量（§E385 曾把它改名 KFK 挪进函数内部 ⇒ 换回后 KF 未定义 ⇒ 整页黑）*/
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
/* §E314 → §E464 更正：这里原来写「584 枚的父指针解析不到实体 · 无实体」—— **那句是错的**，错在检索口径：
 *   §E314 那遍穷尽扫过盘上 1461 个 .bak + 593 个可达 blob + 4190 个对象库 blob，但逐枚算的是「文件里那份数组」的哈希，
 *   而训练服务记父走的是 weightsId(loadAny(种子).params) = **嵌入成 v7 之后**那份数组的指纹 ⇒ 差的这一层没人补。
 *   补上之后 d13d3c85 = SLOT-e379c62c（v1.3.57，实体 = 已入库的 champion-5p-v1.3.58.bak）⇒ 这 584 条边是真边，画在图上。
 *   仍然成立的那半句：tools/ring2-run.mjs:95 历史上**无条件**把 EPIRUS_BUNDLE_IN 覆写成这一份 BASE
 *   ⇒ 81% 共父不是"演化收敛"而是 runner 恒拷。这条读法警告现在写在页脚第二行（NRBASE 只数真的还解析不到的零星几枚）。*/
var NRBASE = 0;   /* §E464 父指针仍然解析不到图上任何一枚的枚数（原来是 584 枚共用一个"查无实体"的锚，现在只剩零星） */
(function () { for (var i = 0; i < N; i++) if (P[i].pnm && P[i].pnm.indexOf('RUNNER-BASE') === 0) NRBASE++; })();
/* §E467 边密度压透明度那台仪器的读数（drawTree 每帧填一次）：
 *   ELOG = 0 只有一条判据会用（拿固定 alpha 当对照组做 A/B），不是用户开关。 */
var ELOG = 1;
var EPROBE = 0;   /* §E467b 页内判据设成"每 N 条留一条"的步长；0 = 不收集探针 */
var EDGR = { n: 0, segs: 0, amin: 1, amax: 0, hub: null, hubn: 0, probe: [] };
/* ===== §E363 / §E367 时间倒挂的父边（用户 10-06 点名：e35prod807 比现役还早，父却写着现役）=====
 *   §E363 当时我给的诊断是"槽位节点的 ts 是进槽时刻，边是真的" —— **那个诊断是错的**，§E367 查翻了：
 *   现役那份权重（d490dc13）自己 META.ts = 09-27T08:55Z，最早可证的 git 实体是提交 3c17e23 @09-27T10:42Z，
 *   而 e35prod807 的 ts = 09-26T06:37Z ⇒ 它不可能热启动自一份 26 小时之后才产出的权重。
 *   真相：那五条边的父指针记的是**路径**（seedpack = js/bundled-champion-3p.js），lineage.mjs 的退路按
 *   "这条路径**今天**住的是谁"反查 ⇒ 把"当时槽里那份已被覆写、没留档的权重"接成了**现在的槽主**。
 *   ⇒ 修在生成器（lineage.mjs §E367：推断级 + 时间倒挂 ⇒ 退回 parentSrc=demoted、parentOf 留空、图上无边），
 *     这里保留一份**运行期守卫**：万一还有别的来路漏网，画虚线 + 页脚点名 + 自检判红，不许画成实线冒充血统。 */
var TSBY = {};
/* §E373 这一帧真的画了几条父边 —— 连线开关的判据要能读到它（页内自检拿它 + 像素差一起判，见 §E338 末尾）*/
var NEDG = 0;
var NOPTS = 0;   /* §E451 只给页内自检用的"只画底、不画点"开关：谱系图那条"左栏真被画上东西"要一张**只有底图的帧**做参照，
                  *   而不是拿"中心与四邻不同"当代理（那个代理在名字上、在同族密集处都会看错，§E447 自己就记了污染）。
                  *   出厂恒为 0；判据用完必须还原，否则下一帧就没有点了。 */
var NCHAIN = 0;   /* §E378 这一帧画了几条**接替边**（页脚与页内自检都读它，不许各自数一份）*/
var NSOUP = 0;    /* §E487/§E490 这一帧画了几条**融合父边**（第一父 + 第二父都算，同色 ⇒ 同一个数；页脚与自检读它）*/
var NSOUP1 = 0, NSOUP2 = 0;   /* §E490 拆成两根边各自计数：第一父那条走的是"血统边循环里认 psrc=soup"的分支，
                               *   第二父那条走的是专门的循环 ⇒ 两条分开数才判得出"谁没同色"（见页内那条腿）*/
var LASTFAMS = [];   /* §E448 上一帧谱系图的行表（fams 原样）—— 页内那条"家族 0 排最上面"在窗口把整行切没时读这个 */
(function () { for (var i = 0; i < N; i++) TSBY[P[i].id] = P[i].ts || ''; })();
function backOf(d) {   /* 返回"父节点的 ts"，当且仅当它晚于本枚（空串 = 正常边 / 父不在图上）*/
  if (!d.pof || !d.ts) return '';
  var pt = TSBY[d.pof];
  return (pt && pt > d.ts) ? pt : ''; }
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
  lgPos: null,        /* §E462 图例被拖到哪儿（相对 #wrap 的 CSS px）；null = 出厂那角 */
  sortBy: 'F',          /* E399 DS：一维图的排序轴 —— 'F' = F 名次（默认）‖ 'time' = 训出时刻。 */
  flo: 0, fhi: 1,       /* §E371 强度窗口的两端，存成"占全库 F 值域的比例"⇒ 出厂 (0,1) 就是全范围 */
  edges: 'all',         /* §E373 谱系图父边：'all' 全开 ‖ 'hash' 只画实录级 ‖ 'off' 一条不画（默认全开 = 已验收的那张图） */
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
/* ===== §E338（用户 01:4x 那批八条里的 1/2/3/4/5）=====
 *   ① 批次切换：谱系图 24 个家族 × 901 枚一起画，行带只剩 29px，左栏两行字必然叠（截图实测）。
 *      批次 = **训出日期**（用户举的例子就是 0923/0928/1002 这种日号）。
 *   ② 点大小 = 名次（名次越高越小）+ 命中范围按半径算（原来固定 14px，圈大圈小都按同一个阈值判 ⇒ "选中范围非常模糊"）。
 *   ③ 颜色分界 = 现役那一枚（见下面 splitSets/fCol）。
 *   ④ 滚轮放大时点跟着变大（原来刻意不跟，理由写在 §E314 那段"经典统计图约定"里 —— 用户看了实物否掉了）。
 *   ⑤ 冠军一列按**上线时刻**排（ship-scan.mjs 从 git 逐提交算槽文件权重指纹抽的，不是按提交标题点名）。 */
st.batch = 'all'; st.sel = null; st.cmp = []; st.side = false;
var INC = P[0];                                   /* 线上冠军：颜色的分界、以及"相对位置"那句话都钉在它身上 */
for (var _zi = 0; _zi < N; _zi++) if (P[_zi].id === 'SHIPPED-Ldemo') INC = P[_zi];
function batchOf(d) { return d.ts ? String(d.ts).slice(0, 10) : ''; }
var BATCH = [];                                    /* [{k:'2026-09-13', n:枚数, no:第几批}] 按日期正序 */
(function () { var m = {}; for (var i = 0; i < N; i++) { var k = batchOf(P[i]); if (!k) continue; m[k] = (m[k] || 0) + 1; }
  Object.keys(m).sort().forEach(function (k, ix) { BATCH.push({ k: k, n: m[k], no: ix + 1 }); }); })();
var VIS = new Uint8Array(N), NVIS = N;
/* ===== §E371 强度窗口（用户 10-06 深夜：「默认显示全范围，然后可以手动拉强度上下顶点，
 *   用满色域渲染中间的点而超出范围的不显示」）=====
 *   切的是**头号尺 F**（= Hp/100 + T·S），不是"当前颜色那一档" —— 标签上就写 F窗口，
 *   因为切到 Δε / 当选键那些档时"强度"仍然是 F，混着讲就会有两套读法。
 *   两端存成**占全库 F 值域的比例**（0..1）⇒ 出厂态 (0,1) 天然就是"全范围"，
 *   而且拖 T 那根滑杆（值域本身会跟着挪）时窗口不会莫名漂移。
 *   ⚠ 与批次过滤有一条**故意的**差别：批次永远留着冠军（分界参照物不能被切没），
 *     窗口一律不例外 —— 它表达的就是"我只看这一段"，留一个越界点在图上就是没听话。
 *     代价（现役被切掉时绿红分界看不见）由页脚那句响亮的话兜。 */
var _FR = { k: '', v: [0, 1] };
function FR() { var k = st.T.toFixed(4); if (_FR.k === k) return _FR.v; _FR.k = k;
  var a = Infinity, b = -Infinity; for (var i = 0; i < N; i++) { var v = Fv(P[i]); if (v < a) a = v; if (v > b) b = v; }
  _FR.v = [a, b]; return _FR.v; }
function winLo() { var r = FR(); return r[0] + st.flo * (r[1] - r[0]); }
function winHi() { var r = FR(); return r[0] + st.fhi * (r[1] - r[0]); }
function winFull() { return st.flo <= 1e-9 && st.fhi >= 1 - 1e-9; }
function inWin(d) { if (winFull()) return true; var v = Fv(d); return v >= winLo() && v <= winHi(); }
function recomputeVIS() { NVIS = 0;
  for (var i = 0; i < N; i++) { var d = P[i];
    /* 冠军与"加进对比的那几枚"**永远钉在图上**：切批次不能把参照物一起切没，
     *   否则绿红分界（= 现役那一档）与对比表会各自读到不同的分母。 */
    var keep = st.batch === 'all' || batchOf(d) === st.batch || !!d.lin || st.cmp.indexOf(d.id) >= 0;
    if (keep && !inWin(d)) keep = false;   /* §E371 窗口：越界一律不画，冠军也不例外 */
    VIS[i] = keep ? 1 : 0; if (keep) NVIS++; } }
recomputeVIS();
/* 点大小 = 名次：第 1 名最小（1.7px 基准），最差那档最大（5.6px）—— 用户 ② 点名"名次越高，点越小"。
 *   再乘 st.size（那根滑杆）与**缩放因子**（用户 ④：放大时间距变大而点不变 ⇒ 观感差）。
 *   缩放取 sqrt 并夹在 1~3.2：线性跟 k 会在放大 8 倍时把点吹成饼，完全不跟又回到用户否掉的那个样子。 */
function dotR(d, zk) { var t = (d.rk - 1) / Math.max(1, N - 1);
  return (d.sh ? 5.8 : 2.6) * st.size * Math.max(1, Math.min(3.2, Math.pow(zk || 1, 0.5))); }   /* E349 DS: 按「是否上线」两档（上过线 4.6 / 没上过 2.0）；名次只留在悬停明细 */
/* 命中半径：按这枚**自己**的半径判（±2px 容差），不再全场一个 14px ⇒ 小点不再"一划就中别人的卡" */
function hitR(d, zk) { return dotR(d, zk) + 2.5 * devicePixelRatio; }
/* 地图模式的两个相机预设：**同一个方位角**（yaw 都是 −π/2），只差俯仰 —— 平面态 = 正俯视（pitch π/2，
 *   投影恰好退化为旧二维地图：x→右、y→上、各向异性缩放全保留）；立体态 = 同方位角下俯 0.40。
 *   §E296 之前 SOLID.yaw=0.62 ⇒ 切换时相机在"立起来"的同时绕竖轴转了 ~56°，整张图边立边转 ——
 *   用户点名"应该默认原地立起来"。现在平面→立体只压 pitch（yaw 不动）；立体→平面要回正 yaw（平面图必须北朝上）。*/
var FLAT = { yaw: -Math.PI / 2, pit: Math.PI / 2 }, SOLID = { yaw: -Math.PI / 2, pit: 0.40 };
/* §E333 谱系图的"立体"是"原地上升 + 可选压扁/错切"，见 st.tTilt/st.tShear 与 drawTree 里的 PL。
 *   （§E332 那一版借 SOLID 的 pit 把地板压到 0.66 高 ⇒ 24 行塌成一条横带，被用户拿截图否掉了。）
 *   ⚠ 这句原来还写着"谱系图**不用**这两个预设"—— §E352 之后已经不成立：树的投影换成了与地图同一台 cam()，
 *     平面态就是 FLAT 这一档（立体态由 st.elev 抬升，不借 SOLID 的 pit）。 */
/* §E377 谱系图版式的**支点**（左栏宽 / 上边距 · 设备像素）。单独摆出来是因为滚轮"以光标为锚"那道算法
 *   要减掉支点再乘缩放比 —— 不放在模块级就得在事件里重算一遍立体态那套挤行距的逻辑（会算错）。 */
/* E396 DS（用户 10-08）：左栏 340 → 520 —— 家族名搬到坐标轴这一侧显示完整（底部高亮选项改成只显示家族号，把位置让出来）。
 * §E451 520 → 392：E396 那一步定在 E397 的"总结式标签"**之前**，量的是当时那种一整列权重哈希的长标签。
 *   总结式之后实测（页内那条"左栏与它承载的家族名相称"量的，无头 1600×900）：
 *   25 行家族名最宽 348px（家族 22）‖ 次宽 317/291/266/266/260 ‖ 中位 186 ⇒ 520 里有 ~172px 是死空。
 *   392 = 348 + 12（文字右端离分界的间距）+ 24（maxW 的余量）+ 8（分界线）⇒ 最宽那行仍然单行装得下，
 *   数据区在 1100px 窗口下宽 12.7%、1600px 下宽 8.75%。
 *   ⚠ 上一班试过这一步，被 §E447 那条像素代理挡住（"中心与四邻不同"在名字上、同族密集处都会看错，带子一挪通过率从 ≥60% 掉到 44%）
 *     ⇒ 这次先把那条代理换成"与一枚点都不画的那一帧逐点比差"（NOPTS），换完实测通过率 101/102 = 99%，栏宽这件事才做得下去。 */
var TPAD = { l: 392 * devicePixelRatio, t: 40 * devicePixelRatio };

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
/* §E338 用户 ③：F 那一档的色标换成**以现役为分界的发散带**（红 = 不如现役 ‖ 正中 = 现役那一档 ‖ 绿 = 比现役强）。
 *   原来那条蓝→红带读得出"高/低"，读不出"能不能换掉现役"，而后者才是这张图唯一要回答的问题。
 *   中性灰放在分界上（不是放在全库中位上）⇒ 图例那条刻度线的 50% 处必须画一根针，否则"分界"没人找得到。*/
var LUTF = (function () { var o = [],
  S = [[0, [186, 32, 32]], [0.26, [226, 122, 78]], [0.5, [136, 146, 165]], [0.74, [62, 178, 112]], [1, [16, 190, 100]]];
  for (var i = 0; i < 256; i++) { var t = i / 255, k = 0;
    while (k < S.length - 2 && t > S[k + 1][0]) k++;
    var A = S[k], B = S[k + 1], f = (t - A[0]) / (B[0] - A[0]);
    o.push([Math.round(A[1][0] + (B[1][0] - A[1][0]) * f), Math.round(A[1][1] + (B[1][1] - A[1][1]) * f),
      Math.round(A[1][2] + (B[1][2] - A[1][2]) * f)]); }
  return o; })();
function rampF(tt) { var c = LUTF[Math.max(0, Math.min(255, Math.round(tt * 255)))]; return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
function rampRGBF(tt) { return LUTF[Math.max(0, Math.min(255, Math.round(tt * 255)))]; }
/* §E330 F 的色归一化换成**分位（秩）**，不用 min-max 线性。实测（901 枚 · 出厂 T）：
 *   F 的 min 0.169 ‖ p05 0.366 ‖ **中位 0.589** ‖ p95 0.704 ‖ max 0.795 ⇒ 线性带下中位归一化到 **0.671**，
 *   等于"一多半点全挤在带的红半边并且挤在一起"，而带的蓝半边几乎空着 —— 用户看到的两极失衡是这条归一化
 *   造成的，不是数据造成的。按秩铺色 = 每档塞同样多的点，中位数正好落在带的正中（中性灰）。
 *   ⚠ **只改颜色，不改几何**：u01()/高度/势场仍是线性 min-max —— 阱的深浅是**量的**比较，
 *     把高度也换成秩会把"差 0.02"和"差 0.2"画成同样高，那是另一种骗人。
 *   秩按 st.T 缓存（F = Hp/100 + T·S 跟着 T 变，排序也变）。*/
/* §E347（用户 10-06 上午点名"地图背景这是搞什么鬼"）：**§E338 把底图换成"以现役为界、两侧各自铺满"是一次改坏了的改动，撤回。**
 *   为什么必然难看（实测，不是观感问题）：现役 F 落在**库内第 82 百分位**（901 枚里只有 164 枚在它之上）⇒
 *   ① 中性灰被压成分界那一条**测度为零的线**（图上没有"平"的地方了）；
 *   ② 底图是 IDW **平均**，平均完正好落在"那一侧的中位秩"上 ⇒ 82% 的图一律深红（而红端 alpha 是 0.92，几乎不透明）；
 *   ③ 场只要抖一点就在 0.5 两侧来回翻 ⇒ 用户看到的那种**大块硬边绿斑**；
 *   ④ 右侧那条渐变带画的是 LUT（蓝→灰→红），与图上的绿红**根本对不上** —— 我当时是用一行"这一档不参与着色"糊过去的，那是错的。
 *   ⇒ 底图回到 §E338 之前的读法：「fCol」= 全库分位（秩），色带 = LUT（蓝 = 地板 ‖ 中性灰 = 库内中位 ‖ 红 = 好）。
 *   ⇒ "离现役多远 / 绿=比现役强"这个读法没丢，它降到颜色下拉第 6 档「rel」（fColRel + LUTF）：
 *     那是**判决**（能不能换掉现役），底图那件事是**地形**（谁高谁低）—— 两件事共用一根 18px 的条必然打架。
 *   ⚠ 只改颜色，不改几何：u01()/高度/势场仍是线性 min-max（把高度也换成秩会把"差 0.02"和"差 0.2"画成一样高）。
 *   ⚠ 分位的分母永远是**全库**（不是当前可见那些）⇒ 缓存键只需要 T，批次不参与（切批次只改"画哪些点"）。*/
var FSRT = { key: '', all: null, up: null, dn: null, win: null, iv: 0, sU: 0.05, sD: 0.05 };
function p90(a) { var n = a.length; if (n < 2) return 0; return a[Math.min(n - 1, Math.round(0.9 * (n - 1)))]; }
function splitSets() { var key = st.T.toFixed(4) + '@' + st.flo.toFixed(3) + ',' + st.fhi.toFixed(3) + '@' + st.batch;
  if (FSRT.key === key) return FSRT;
  var iv = Fv(INC), all = [], up = [], dn = [], win = [], vis = [];
  for (var i = 0; i < N; i++) { var v = Fv(P[i]); all.push(v); if (inWin(P[i])) win.push(v); if (v >= iv) up.push(v - iv); else dn.push(iv - v);
    /* §E379（用户 10-07 第三遍口径）：**色带读的是"当下真画出来的那批点"** —— 批次筛掉的与被窗口切掉的都算"摘出去"，
     *   它们不许参与定标（否则拉一下范围就把一批点钉到纯色，用户看到的"红/蓝占比变多"就是这么来的）。 */
    if (VIS[i] && inWin(P[i])) vis.push(v); }
  all.sort(function (x, y) { return x - y; }); up.sort(function (x, y) { return x - y; }); dn.sort(function (x, y) { return x - y; });
  win.sort(function (x, y) { return x - y; }); vis.sort(function (x, y) { return x - y; });
  FSRT = { key: key, all: all, up: up, dn: dn, win: win, vis: vis, iv: iv,
    /* 下限 0.02：某一侧只剩几枚时 p90 会趋零 ⇒ 整条色带被那一两枚点决定（0.5 一侧全饱和）。 */
    sU: Math.max(0.02, p90(up)), sD: Math.max(0.02, p90(dn)) };
  return FSRT; }
function bnd(a, v, inc) { var lo = 0, hi = a.length;   /* inc=false → 第一个 ≥v；inc=true → 第一个 >v */
  while (lo < hi) { var m = (lo + hi) >> 1; if ((inc ? a[m] <= v : a[m] < v)) lo = m + 1; else hi = m; } return lo; }
function qr(a, v) { var n = a.length; if (n < 2) return 0.5;
  return Math.max(0, Math.min(1, ((bnd(a, v, false) + bnd(a, v, true)) / 2) / (n - 1))); }
/* 底图与「F」档用的：全库分位（= §E338 之前那个读法） */
/* §E349 DS（用户 10-06：「纯按分位映射就看不出绝对差距了；中位尽量放灰，但两边要反映数值差距」）：
 *   原来这里是 qr() = **全库分位（秩）**：每档塞同样多的点 ⇒ 等数值差 ≠ 等色差（差 0.02 与差 0.2 同色）。
 *   改成以**中位**为心的绝对线性带：t = 0.5 + (F − 中位) / (2·span)，span = max(p95−中位, 中位−p05)（下限 0.02）。
 *   ⇒ 中位仍落 t=0.5（中性灰，图例那根针的位置不用动）；两端**按数值差线性铺**。
 *   ⚠ 代价如实说：p05…p95 之外的点会顶到色端（那是真实分布，不是归一化造的）。几何一律不动。 */
/* §E371：窗口拉起来之后，色带的**中位与两端都换成窗口内那一段**（= 用户要的"用满色域渲染中间的点"）。
 *   窗口是全范围时 win ≡ all ⇒ 与改之前逐字同形，不动任何已验收过的读数。
 *   ⚠ 只有"地形"这一档（F / 底图）随窗口重铺；incPct()（现役在**库内**第几百分位）仍按全库算 ——
 *     那句话的主语是"库"，把它悄悄换成"窗口"就是另一件事了。 */
/* §E373 色带 = **一条线性映射**，两端由当前状态决定（用户 10-07 澄清："顶到色带端点的意思是重新做一下映射的
 *   缩放罢了，目标是提高显示点的区分度"）：
 *   全范围态 ⇒ 两端 = 中位 ± span，span = max(p95−中位, 中位−p05) —— 与 §E349 逐字同一条（换写法没换数学：
 *     (F − (med−span)) / (2·span) ≡ 0.5 + (F − med)/(2·span)，所以已验收过的读数一枚都不会变）。
 *   窗口态 ⇒ 两端 = **窗内那一段的最低/最高 F**，线性铺满 ⇒ 区分度拉满，而"等数值差 = 等色差"仍然成立
 *     （这正是 §E349 当初否掉"纯按秩铺色"时要保的那条，窗口没理由破坏它）。
 *   图例那两端的数字与"深浅怎么读"那句话都改读这一份，不许图上是一套、文字是另一套。 */
/* §E379（用户 10-07 第三遍口径，这次把话说明白了）：
 *   「对于任意的范围，**最红的是范围内所有点中 F 最大的，灰色是范围中位数，最蓝的是范围中 F 最小的**，
 *    中间的斜率突变你可以做一个简单的小过渡但不是最重要的。**而不渲染的点直接从图中摘出去，不影响范围内点的渲染。**」
 *   ⇒ 定标名单 = **当下真画出来的那批点**（批次筛掉的 + 窗口切掉的都算摘出去）；
 *     映射 = 两段线性（min→med 铺 [0,0.5] ‖ med→max 铺 [0.5,1]）⇒ 中位回到中性灰、两端必然顶满。
 *   ⚠ 代价照实记：跨中位有一次斜率折（上下两段"等数值差 = 等色差"的比例不同）。用户明说这条不重要，
 *     要平滑也只是"小过渡"，本班没做 —— 做了就要牺牲她更看重的"中位正好落灰"。
 *   ⚠ 这条**覆盖** §E349 的"全库分位定标"与 §E373 的"窗内两端"，也**反向**推掉了旧判据
 *     「颜色：切批次不许挪分位」—— 那条钉的正是"批次不参与定标"，而现在的口径是批次参与（它就是"摘出去"）。 */
function colBand() { var b = splitSets().vis, n = b.length;
  if (n < 2) return null;
  return { lo: b[0], hi: b[n - 1], med: (b[(n - 1) >> 1] + b[n >> 1]) / 2, n: n, mode: winFull() ? 'lib' : 'win' }; }
function fCol(F) { var bd = colBand(); if (!bd) return 0.5;
  var t = F <= bd.med ? (F - bd.lo) / ((bd.med - bd.lo) || 1e-9) * 0.5
    : 0.5 + (F - bd.med) / ((bd.hi - bd.med) || 1e-9) * 0.5;
  return Math.max(0, Math.min(1, t)); }
/* 「rel」档用的：离现役多远（两侧各按该侧 p90 距归一，绿=强 ‖ 红=不如 ‖ 灰=现役那一档） */
function fColRel(F) { var s = splitSets();
  return F >= s.iv ? 0.5 + 0.5 * Math.min(1, (F - s.iv) / s.sU) : 0.5 - 0.5 * Math.min(1, (s.iv - F) / s.sD); }
function fMed() { var a = splitSets().all; return a.length ? a[Math.floor(a.length / 2)] : 0; }
/* 现役在库内的百分位（= 底图色带上那根针的位置；也是"为什么不能拿现役当中性灰"的那个证据） */
function incPct() { var s = splitSets(); return s.all.length ? 100 * s.dn.length / s.all.length : 0; }
/* §E304 两套分组并存：'fam' = **训练方法/目标家族**（默认），'seed' = RNG 种子（旧口径，留着当对照）。
 * §E557（用户 10-09：「各个家族的颜色已经非常多了，以至于很容易搞混掉。要做成有区分度、且临近颜色对应临近家族」）：
 *   原来这两件事**都是反的** ——
 *   ① 色相按黄金角铺（137.508°/家）⇒ 相邻序号被推到色环两端，"挨着的家族"在颜色上毫不相邻，
 *      它优化的是"任意两家不撞色"，代价正是用户要的"临近对应"没有了；
 *   ② 序号本身按**枚数**排 ⇒ 家族号相邻的两家，颜色可以完全无关。
 *   现在：色相 = 360 × 排名 / 家族数 **顺序**走一圈（图例那排也跟着家族号 ⇒ 读起来是一条渐变），
 *   代价是 n=30 时相邻色相差只有 12°，肉眼分不开 ⇒ 补**第二条轴**：明度按 3 档循环、饱和按 2 档循环（合周期 6）
 *   ⇒ 相邻两家同时差"色相 + 明度 + 饱和"，而隔 6 家的那两家虽然 s/l 相同，色相已经差开 72°。
 *   ⚠ 这条改动只动**分类色**（fam / seed 两档）；F / Hp / Δε / sc 那几档是连续 LUT，不归它管。 */
function hueAt(i, n) {
  var nn = Math.max(1, n || 1);
  var h = Math.round(360 * (i % nn) / nn);
  var s = (i % 2) ? 60 : 88;
  var l = [50, 74, 62][i % 3];
  return 'hsl(' + h + ',' + s + '%,' + l + '%)'; }
function gk(d) { return String(st.color === 'seed' ? (d.seed || '?') : (d.famTop ? 0 : (d.fam || '?'))); }
var GRP = { keys: [], cnt: {}, col: {} };
function buildGroups() { var cnt = {}, keys = [];
  for (var i = 0; i < N; i++) { var k = gk(P[i]); if (!(k in cnt)) { cnt[k] = 0; keys.push(k); } cnt[k]++; }
  /* §E557：排序键从"枚数"换成**家族号**（颜色与图例都跟着它走 ⇒ "临近颜色 = 临近家族"这句真的成立）。
   *   非数字的键（缺家族号的老行）排到最后，不参与渐变。 */
  keys.sort(function (x, y) { var nx = +x, ny = +y;
    var badx = isFinite(nx) ? 0 : 1, bady = isFinite(ny) ? 0 : 1;
    return badx - bady || (badx ? String(x).localeCompare(String(y)) : nx - ny); });
  var col = {}; for (var j = 0; j < keys.length; j++) col[keys[j]] = hueAt(j, keys.length);
  GRP = { keys: keys, cnt: cnt, col: col }; }
buildGroups();
/* §E557 悬停明细卡的落点（用户：「只出现在右下角，点靠右下的时候会看不见，做成自适应展开」）。
 *   抽成纯函数是为了**能被自证**：页内那条腿直接喂四个角 + 中心给它，判"卡永远整张在视口里"，
 *   而不是靠人去鼠标挪到角落看一眼（那种"验过"下次改回去也没人知道）。
 *   规则：默认落在指针右下；右下放不下就**翻面**（右→左、下→上）；翻面后还溢出就夹进视口。
 *   ⚠ 不裁内容、不缩字号 —— 内容读不全比卡片挡一点更糟。 */
function tipPlace(cx, cy, w, h, vw, vh) {
  vw = vw || window.innerWidth; vh = vh || window.innerHeight;
  var x = cx + 14, y = cy + 10;
  if (x + w + 8 > vw) x = cx - w - 14;
  if (y + h + 8 > vh) y = cy - h - 10;
  if (x < 8) x = 8; if (y < 8) y = 8;
  if (x + w > vw - 4) x = Math.max(8, vw - 4 - w);
  if (y + h > vh - 4) y = Math.max(8, vh - 4 - h);
  return [x, y]; }
function colOf(d, fr) { if (st.color === 'fam' || st.color === 'seed') return GRP.col[gk(d)] || '#9aa8bd';  if (st.color === 'gl') { var g = d.gl === null || d.gl === undefined ? -1 : d.gl;
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
    var epr = EPR(); return ramp(Math.max(0, Math.min(1, (d.hp - epr[0]) / (epr[1] - epr[0] || 1)))); }
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
  /* §E347 第 6 档「rel」：相对现役的发散带（绿 = 比现役强 ‖ 红 = 不如 ‖ 灰 = 现役那一档），底图同向。*/
  if (st.color === 'rel') return rampF(fColRel(Fv(d)));
  return ramp(fCol(Fv(d))); }   /* 「F」档回到蓝→灰→红（§E338 之前那样），不再拿现役当中性灰 */
/* §E313 页面口径 1st 的显示区间（实测枚数的 p02..p98，同 GLR 的取法）。
 *   §E371 分母换成**窗口内实测到的那一段** ⇒ 拉窗口时这条色标跟着用满
 *   （"把旧包画进来，低端把整条色标拉塌"正是用户点名要能切掉的那种情况）。
 *   窗口是全范围时逐字等于原来那一份。缓存键 = T + 窗口（与 FSRT 同一族）。 */
var _EPR = { k: '', v: [20, 60] };
function EPR() { var k = st.T.toFixed(4) + '@' + st.flo.toFixed(3) + ',' + st.fhi.toFixed(3);
  if (_EPR.k === k) return _EPR.v; _EPR.k = k;
  var a = P.filter(function (d) { return inWin(d); }).map(function (d) { return d.hp; })
    .filter(function (v) { return v !== null && isFinite(v); }).sort(function (x, y) { return x - y; });
  _EPR.v = a.length > 8 ? [a[Math.floor(a.length * .02)], a[Math.floor(a.length * .98)]] : [20, 60];
  return _EPR.v; }
function mix(c1, c2, t) {   /* 十六进制线性插值，t∈[0,1] */
  var p = function (c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; };
  var A = p(c1), B = p(c2);
  return 'rgb(' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }).join(',') + ')'; }
/* G(long) 的显示区间取全库 p02..p98（不用 0..8：那会把对比度全压在低段）*/
var GLR = (function () { var a = P.map(function (d) { return d.gl; }).filter(function (v) { return v !== null && v !== undefined && isFinite(v); }).sort(function (x, y) { return x - y; });
  return a.length > 8 ? [a[Math.floor(a.length * .02)], a[Math.floor(a.length * .98)]] : [0, 8]; })();
/* §E308「没测过的灰压到 0.16」那一支抽成函数：页内那条「高亮不许压黑」必须能把它**单独摘出来**再量。
 *   不抽的话那条判据在 pm/duel/de/hp/sc 五档**恒红**（实测 0.16），而红的原因是"两条都对的规矩打架"，
 *   不是画面坏了 —— 用户 10-08 裁：「不要为了过门禁而过…反思红的门禁是不是写的有什么问题」。*/
function unmeasuredGray(d) { return (st.color === 'pm' && (d.pv === null || d.pv === undefined)) ||
    (st.color === 'duel' && !d.ds) || (st.color === 'de' && d.de === null) || (st.color === 'hp' && d.hp === null) ||
    (st.color === 'sc' && (d.scd === null || d.scd === undefined)); }
function alphaOf(d) { var n = 0; for (var kk in st.hi) if (st.hi[kk]) n++;
  /* §E308 上槽体检口径下 705/718 枚是"没测过"⇒ 不压暗就找不到那 13 枚（灰压到 0.16，实测过的照旧）*/
  if (unmeasuredGray(d)) return 0.16;
  if (!n) return 1; return st.hi[gk(d)] ? 1 : 0.34; }
  /* §E338 用户 ④「点选中框会全部变暗」：非高亮那批原来压到 0.10 —— 24 个家族里点一家，
   *   其余 742/901 枚直接糊成背景噪点，图例点下去之后整张图读不动。压到 0.34 既留住"谁被选中"的对比，
   *   又保住上下文（这张图的价值恰恰在"被选中的那家相对别人在哪"）。*/
/* 家族短标：只取"改了什么"那一段并截断（长说明留给悬停），否则一个按钮吃掉整条图例栏。*/
/* §E463 图上那 16 枚旧槽位冠军的 id 是 SLOT-<8位权重哈希>，用户 10-08：「太长了也让人看不明白，你把标签改成对应版本号」
 *   ⇒ 有版本号（sv，从引入它的那条提交标题认回，见构建侧 verOf）就标版本号，没有仍回落到 id —— 不许编一个。
 *   悬停与选中卡上仍然给全 id + 哈希，身份这件事不能因为好读就丢掉。*/
function labOf(d) { return (d && d.sv && String(d.id).indexOf('SLOT-') === 0) ? d.sv : (d ? d.id : ''); }
function famLab(d) { return FAMLAB[d.fam] || ''; }
/* E397 DS（用户 10-08：一大堆调整数字被截掉在这里也看不清楚，尤其家族 5 / 22 这种超长标签）：
 *   上游那条 recipe 是**一长串「名 a→b」**，其中大多数是「-→v」（从默认打开）或「v→-」（关掉回默认）。
 *   按方向归类成**总结式**：开/关**只留名字**（超过 5 个就只列前 4 个 + 项数），真正改了数值的才带 before→after。
 *   例：家族 5 ⇒「开 7 项（珠价 divW/囤珠奖励/囤珠惩罚/输出权重…）· 对手池 15→12」。 */
function famSummary(s) {
  /* E397b DS：**不用正则**（生成器内联时会把反斜杠吃掉：\s ⇒ s、\d ⇒ d ⇒ 正则静默失效）。
   *   纯字符串运算分类：按「 · 」切段，每段再按箭头 → 切成「名 / 左值 / 右值」。
   *   左值是 '-' ⇒ 从默认打开（开）；右值是 '-' ⇒ 关掉回默认（关）；两边都是数才带 before→after。 */
  var items = String(s || '').split(' ‖ ')[0].split(' · ').filter(function (x) { return x.trim(); });
  var on = [], off = [], num = [], i, ARROW = String.fromCharCode(8594);
  function isNum(v) { if (!v || v === '-') return false; for (var q = 0; q < v.length; q++) {
    var ch = v.charCodeAt(q); if (!((ch >= 48 && ch <= 57) || ch === 46)) return false; } return true; }
  for (i = 0; i < items.length; i++) {
    var it = items[i].trim(), k = it.lastIndexOf(ARROW);
    if (k < 0) { num.push(it); continue; }
    var lhs = it.slice(0, k), rhs = it.slice(k + 1).trim();
    var sp = lhs.lastIndexOf(' ');
    var nm = (sp > 0 ? lhs.slice(0, sp) : lhs).trim(), a = (sp > 0 ? lhs.slice(sp + 1) : '').trim();
    if (a === '-') on.push(nm);
    else if (rhs === '-') off.push(nm);
    else if (isNum(a) && isNum(rhs)) num.push(nm + ' ' + a + ARROW + rhs);
    else num.push(it);
  }
  function grp(t, arr) { if (!arr.length) return '';
    return t + (arr.length > 5 ? (' ' + arr.length + ' 项（' + arr.slice(0, 4).join('/') + '…）') : ('：' + arr.join('/'))); }
  var out = [];
  if (on.length) out.push(grp('开', on));
  if (off.length) out.push(grp('关', off));
  if (num.length) out.push(num.join(' · '));
  return out.join(' · ') || items.join(' · ');
}
/* E396 DS：把家族名按「 · 」装箱成最多 max 行（超出的部分不进图，完整串在悬停提示里）。 */
function wrapLabel(t, s, maxW, max) {
  var parts = String(s).split(' · '), lines = [], cur = '';
  for (var i = 0; i < parts.length; i++) {
    var cand = cur ? (cur + ' · ' + parts[i]) : parts[i];
    if (!cur || t.measureText(cand).width <= maxW) cur = cand;
    else { lines.push(cur); if (lines.length >= max) return lines; cur = parts[i]; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, max);
}
function famShort(d, n) { var s = String(famLab(d)).split(' ‖ ')[0] || ('家族 ' + d.fam);
  return s.length > (n || 26) ? s.slice(0, n || 26) + '…' : s; }
function tip(d, fr) {
  return d.id + (d.lin ? ' 【' + d.lin + '】' : '') + (d.kin ? ' 〔' + d.kin + '〕' : '') +
    /* §E334 同一份权重占了几行必须自己在明细里说：否则"这枚 F 名次 8"和"那枚名次 10"可能是**同一个包**。 */
    (d.dn > 1 ? '\\n本枚代表 ' + d.dn + ' 份**同一份权重**的拷贝（面板上原本占 ' + d.dn + ' 行，§E440 起图上只画这一枚）：' + d.dups : '') +
    '\\n家族 ' + d.fam + '（按训练方法/目标分）：' + (famLab(d) || '—') +
    '\\n　RNG seed 名字后缀=' + d.seed + ' ‖ META.seed=' + (d.ms || '—') + ' ‖ 训出 ' + (d.ts || '—') +
    '\\n　热启动父 ' + (d.par || '—') + (d.pof ? ' = ' + d.pof : (d.pnm ? '\\n　　' + d.pnm : '（父指针未落档）')) +
    /* §E555（用户 10-09 08:5x：「你昨天刚训练的怎么会不确定父节点」）：线的实/虚就是这条"来路"决定的，
     *   所以它必须能在明细里直读，而不是只有一张图例。三种写法分开：
     *   hash / hash-emb = 包里 「hotstartFrom” 记的就是父的权重指纹（训练服务自己写的实录）；
     *   seedpack-wid = 包里只有 「EPIRUS_SEEDPACK” 这条**路径**，但生成器把该文件的权重指纹与图上节点对过 ⇒ 相等（身份可核，画实线）；
     *   seedpack / arm / slot-at-time = 只按名字或时间对上，没核到权重（画虚线）。 */
    (d.pof ? '\\n　这条父边的来路 = ' + (d.psrc || '未标') +
      (d.psrc === 'seedpack-wid' ? '（种子路径 + 事后核过权重一致）'
        : d.psrc === 'seedpack' ? '（只有种子路径，权重没对上 ⇒ 虚线）'
        : d.psrc === 'arm' ? '（按臂名反查，虚线）'
        : d.psrc === 'slot-at-time' ? '（按时间轴问"当时槽里是谁"改接的，虚线）' : '') : '') +
    /* §E487 融合粒：把"它是哪两枚的平均"直读出来（来源与权重在包 meta 里，这里只印第二父的节点名）*/
    (d.pof2 ? '\\n　融合的另一粒父 ' + d.pof2 + '（图上走红线 ‖ 这枚 = 两粒的权重平均）' : '') +
    /* §E363 + §E367 更正：这条边"父比子晚"**不是**槽位时刻的语义问题，而是**假边** ——
       父指针记的是**路径**（js/bundled-champion-3p.js），生成器按"这条路径今天住的是谁"反查 ⇒ 接到现在的槽主身上。
       lineage.mjs 现在会把这种推断级父边退回"父不可考"（parentSrc=demoted），所以**正常情况下这条不该出现**；
       真出现了就是生成器的时间守卫漏了一种来路 ⇒ 画虚线并点名，让它看得见而不是悄悄画成实线。 */
    (backOf(d) ? '\\n⛔ 这条父边时间倒挂（父 ' + d.pof + ' 的 ts=' + backOf(d) + ' 晚于本枚 ' + d.ts + '）'
        + ' ⇒ 它是"按路径反查今天的槽主"造出来的**假血统**，不该画成实线（来路 = ' + (d.psrc || '未标') + '）' : '') +
    /* §E563（整改建议 规矩/建议 4 · 用户 10-09）：**"过线"这个词改名**。它测的是**训练侧五道检查**（feas.mjs 那五道），
     *   与**真正的换包闸不是同一件事**（§E551 实测两者只有 41% 的情况结论一致）⇒ 旧措辞会让人以为"绿环 = 可以换上去了"。
     *   这不是排版问题：文档点名的就是这个混用会让人误判。 */
    (d.ok === 1 ? '  · 训练侧五道检查 ✓（≠ 换包闸）' : (d.ok === 0 ? '  · 未过训练侧五道检查' : '')) +
    (d.ok === 0 && d.why ? '\\n　栽在：' + d.why : '') +
    '\\n名次 ' + d.rk + '/' + N + '（线上口径 · 出厂 T 下重算；旧考卷口径是第 ' + d.rkExam + ' 名）· 按当前 T 重排见一维视图' +
    /* §E563：两把尺各补一句**采样口径**（整改建议 现象 5 + §E561/§E562 我今天实测的数）：
     *   Hp 只有一个种子批（77000）⇒ 四批复量现役极差 5.7pt ‖ H 是 exam=30 档 ⇒ 研究结论引用的多为 120 档（现役 55.4↔51.3）。
     *   不写这两句，图上"谁排在谁前面"就会被当成读数 —— 而它今天实测**撑不住排序**。 */
    '\\nHp 线上口径夺1率 = ' + d.Hp.toFixed(1) + '%（ε=0.2 soft · 图上的尺就是它 · **只跑过种子批 77000 一批**，四批极差 5.7pt ⇒ 只当水位别当排序）   ' +
      'H 考卷口径 = ' + d.H.toFixed(1) +
      '%（ε=0 贪心 · 旧尺，历史文档里的数 · **exam=30 档**）   Δε = ' + (d.De >= 0 ? '+' : '') + d.De.toFixed(1) + 'pt' +
      /* §E566（10-10 全库 986 枚实测）：并列显示**同一枚在 exam=120 档**的读数，并把两档差算给它看。
       *   为什么必须并列：库内互比时档差中位只有 0.5pt（Spearman 0.98，30 档基本够用），
       *   但**现役自己恰好是全库最敏感的那一枚**（55.4 → 51.3，−4.1pt，718 枚里排第 1）
       *   ⇒ "候选离现役多远"会随档整体挪 ~4.5pt，138/717 = 19.2% 的候选"比不比现役强"会因档而异。
       *   不并列，读图的人就会拿 30 档的现役去比研究文档里 120 档的候选（我今天早上就那么错过一次）。
       *   ⚠ 未测的枚显式写"未测"，不许把空串当 0 读（§E491 那条同族病）。 */
      (d.H120 === null ? '\\n　exam=120 档：未测（别当 0 读）'
        : '\\n　同枚 exam=120 档 = ' + d.H120.toFixed(1) + '%（与上面 30 档差 ' + (d.H120 - d.H >= 0 ? '+' : '') + (d.H120 - d.H).toFixed(1) + 'pt）') +
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
var CHROMEVEC = 1;
/* E401 DS（B 界面修法）：阈值标签把**底率**一起写出来 —— 用户不该自己猜这条线该定在哪。 */
var BASEP = -1;
function THRLBL() { if (BASEP < 0) { var a1 = 0, b1 = 0;
  for (var q = 0; q < P.length; q++) { var o1 = P[q].ok; if (o1 === 1 || o1 === 0) { b1++; if (o1 === 1) a1++; } }
  BASEP = b1 ? a1 / b1 : 0.15; }
  return Math.round(st.isoT * 100) + '%（底率 ' + (BASEP * 100).toFixed(1) + '%）'; }
var FRMS = 0, FRMA = [];
var PERFON = 0;
var GLPROBE = 0;
var GLFAILS = 0;
var FRN = 0;
var ISOBUILDS = 0;
var SIGMS = 0, BUILDMS = 0;
var GEOBUILD = 0, GLRESIZE = 0;
/* E428 DS：GL 的填充/线框 alpha。2D 路是**逐面填、重叠处 alpha 累积**（偏亮），GL 是**并集填一次**（偏淡）
 *   ⇒ 这里把 alpha 提上来折中；两个值都可用深链微调：#gfa=0.30 #gla=0.62。 */
var GFA = 0.40, GLA = 0.75;   /* E428 定稿（用户 10-08：「#gfa=0.40&gla=0.75 够了」）*/
var MISSWHY = '';   /* E423：上一次重建的原因（sig/thr/gn/field/noISO）*/   /* E422：isoEnsure 里两件事分开计时 */
var ISOMS = 0, GLBUILD = 0, GLDRAW = 0, GLBLIT = 0;   /* E420：把 1.2s/帧拆开定位 */
var GLERR = '';   /* E418：GL 分支抛出的异常文本（揪出静默中断）*/   /* E418：帧序（判"只画了哪一帧"）*/
var GLPATH = 0;     /* E413: 0=not-yet 1=GL-used 2=GL-unavailable */
var GLDREW = 0;     /* E413：走 GL 路的帧数 */
var GLSIG = '';     /* E405：GL 几何缓存键（相机/网格/画布任一变化才重算重传）*/
var GLISO = 1;      /* E428 DS（用户 10-08 裁定）：**GL 转默认** —— 阈值不变时旋转/平移，2D 路每帧要重画
                     *   1.2 万个四边形（卡），GL 路只重发命令（顺滑）⇒ GL 该是默认。#gl=0 可切回 2D 逐面。
                     *   起不来时 §E417b 会自动回落 2D 并留痕（GLPATH=2 / data-path=glfail）。 */
var BATCHISO = 0;   /* E403：壳合并成一个 path 画（1）还是逐面画（0）。**默认 0 —— 实测合并更慢**：
 *   96 格 4868 面：合并 102.78 ms/帧 vs 逐面 23.54 ms/帧（52 格：25.12 vs 18.06）。
 *   原因：Path2D 里 4868 个子路径 ⇒ fill 要算并集/绕数、stroke 要整条 tessellate ⇒ 远贵于逐个小面。
 *   留这个开关是为了**别再有人试第二遍**（要试先看这两个数）。#batch=1 可复现。 */   /* E402：#perf=1 打开按需仪表 */   /* E402 DS（D-3 前置）：最近一帧的绘制耗时与滑动均值（用来把「卡在哪」量出来，而不是凭感觉）*/
var ATDEN = 0;          /* E400：at() 最近一次的核质量（密度门用）*/
var DGATE = 1, DM0 = 2;  /* E400：密度门开关（1 开 / 0 关）与收缩强度 M0（旧值 5）。#dgate=0&m0=5 可回旧行为做 A/B。 */   /* E395 DS：谱系图底图走矢量直画（1）还是旧位图烘焙（0）。#chrome=bmp 切回旧路。 */
var VK = null;   /* E388 DS: 可见点 k-NN 表缓存（键 = 位图键 + 可见名单签名）*/
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
  /* E394 DS：网格边距 **10% → 35%**（用户 10-08：把实际画布扩大然后让边缘是自然衰减消失的）。
   *   场算在一张比视野大得多的画布上 ⇒ 板自己那条矩形边缘（以及 EDGEK 收口）永远落在视野外 ⇒ 不会有割裂。 */
  var mgx = (x1 - x0) * 0.35, mgy = (y1 - y0) * 0.35; x0 -= mgx; x1 += mgx; y0 -= mgy; y1 += mgy;
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
  var dispX = (x1 - x0) * bx, dispY = (y1 - y0) * byy;
  /* E390 DS：格子预算跟着**显示跨度**走，不再固定 40000。
   *   为什么：一枚离群点（blk0t40-s31，y=-20.86 = 20 IQR）把 y 跨度撑到全体 24.0 vs 截尾 4.1 = **5.8 倍** ⇒
   *   固定预算下每格从 ~15px 涨到 ~50px，而点云只占网格一小块 ⇒ 场被降分辨率 = '灰蒙蒙'的第三个来源。
   *   ⚠ **不改成截尾范围**：用户 10-04 裁定「背景图要扩散到**所有点**的范围」（截尾框外的离群点脚下空着会看着割裂）。
   *   ⇒ 保范围、加预算：每格目标 15px，总格数夹在 [40000, 400000]。 */
  var TOT = Math.max(40000, Math.min(400000, Math.round(dispX * dispY / 225)));
  var gx = Math.max(40, Math.min(1200, Math.round(Math.sqrt(TOT * dispX / (dispY || 1)) || 40)));
  var gy = Math.max(40, Math.min(1200, Math.round(Math.sqrt(TOT * dispY / (dispX || 1)) || 40)));
  var idx = new Int16Array(gx * gy * KF), dst = new Float32Array(gx * gy * KF);
  /* E388 DS（用户 10-07 第三件）：地板的值从 **H（考卷口径）** 换成 **Hp（页面口径）**。
 *   原来吃 H 而色带/点/图例读 Fv = Hp/100 + T·S ⇒ 两条尺 ⇒ 一收窄范围场值就跑出可见点的 F 区间 ⇒
 *   被「带外收尾」涂成底色 = 黑洞的一半成因（另 half 是加权没按可见名单过滤，§E381 已修）。 */
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
      var w = 1 / Math.pow(Math.max(dst[base + u], 1e-6), KEXP); wsum += w; hsum += w * (P[pi].Hp / 100); ssum += w * P[pi].S; }
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
/* E388 DS：**可见点**的 k-NN 表（每格最近 KF 枚"当下画得出来的点"）。
 *   为什么：§E381 的候选表是**全库** 12 近邻、再按可见名单过滤 ⇒ 若某格那 12 枚全在窗外，
 *   过滤后 wsum = 0 ⇒ 那格留空 = **黑洞**（用户截图：缩到 1/6 时一块块黑斑）。
 *   ⚠ 这不是"两套渲染机制"：两条路算的是**同一个量**（"被画的那批点里最近 KF 枚"的 IDW 加权平均）；
 *     nShown === N 时两条路**逐字节相同**，所以那种情况用已在 buildNB 缓存好的全库表（快），有过滤时才现算。
 *     （对比 §E382b 被否：它两条路的**数学不同**（12 近邻截断 vs 半径内全点）⇒ 切换瞬间观感突变。）
 *   成本 cells × |可见|，且只在**可见名单变化**时重算（T 滑动不触发 ⇒ 那条交互仍跟手）。*/
function visKNN(nb, sig) {
  if (VK && VK.sig === sig) return VK;
  var gx = nb.gx, gy = nb.gy, cells = gx * gy;
  var idx = new Int16Array(cells * KF), dst = new Float32Array(cells * KF);
  for (var z = 0; z < cells * KF; z++) { idx[z] = -1; dst[z] = 1e18; }
  var vx = [], vy = [], vi = [];
  for (var i = 0; i < N; i++) {
    if (!(VIS[i] && inWin(P[i]))) continue;
    vx.push((P[i][nb.ax] - nb.x0) / (nb.x1 - nb.x0) * (gx - 1));
    vy.push((P[i][nb.by] - nb.y0) / (nb.y1 - nb.y0) * (gy - 1));
    vi.push(i);
  }
  var csx = (nb.x1 - nb.x0) * nb.bx / (gx - 1), csy = (nb.y1 - nb.y0) * nb.byy / (gy - 1);
  for (var c = 0; c < cells; c++) {
    var cgi = c % gx, cgj = (c / gx) | 0, b0 = c * KF, w2 = dst[b0 + KF - 1] * dst[b0 + KF - 1];
    for (var v = 0; v < vi.length; v++) {
      var dx = (vx[v] - cgi) * csx, dy = (vy[v] - cgj) * csy, d2 = dx * dx + dy * dy;
      if (d2 >= w2) continue;
      var dd = Math.sqrt(d2), p0 = KF - 1;
      while (p0 > 0 && dst[b0 + p0 - 1] > dd) { dst[b0 + p0] = dst[b0 + p0 - 1]; idx[b0 + p0] = idx[b0 + p0 - 1]; p0--; }
      dst[b0 + p0] = dd; idx[b0 + p0] = vi[v];
      w2 = dst[b0 + KF - 1] * dst[b0 + KF - 1];
    }
  }
  /* E388 DS：**覆盖度的尺度也必须跟着可见集**。原来 kcov 按全库 d12m 标定 ⇒ 只画 16% 时最近可见点变远、
   *   wsum 掉到 kcov 以下 ⇒ fade → 0 ⇒ 整片场淡成底色（实测：窗口 151/917 时场全没了）。
   *   这里顺手算可见集的 d12 中位，交给 buildBitmap 当新基准。 */
  var dv = []; for (var cc = 0; cc < cells; cc++) { if (idx[cc * KF + KF - 1] >= 0) dv.push(dst[cc * KF + KF - 1]); }
  dv.sort(function (x, y) { return x - y; });
  var d12v = dv.length ? dv[dv.length >> 1] : (nb.d12m || 1);
  VK = { sig: sig, idx: idx, dst: dst, n: vi.length, d12v: d12v };
  return VK;
}
function buildBitmap(key, visSigNow) {
  var nb = NBK[key];
  var fscale = Math.max(1.5 * nb.d12m, 14);   /* §E331 淡出尺度 2.2× → 1.5× 第12近邻中位（≈29px）：
                                                 单点的"实心"范围缩一档 ⇒ 立体态不再糊成一整块熔岩。
                                                 **中间不会因此裂开** —— 覆盖度是各点核权重相加（见下面 fade），
                                                 邻域只要有两三枚，权重和照样过阈 ⇒ 裂开的正是旧版按"最近点距离"才会有的病。*/
  var kcov = 1 / Math.pow(0.5 * fscale, KEXP);
  /* E394c DS（用户 10-08 澄清）：**空的地方不需要是底，但不能实心，要有透明度**。
   *   ⇒ 不硬切（场覆盖整片、没有硬边界），改由覆盖度把不透明度压下去；尺度从 fscale 收到 **0.5×fscale**
   *     （等价于把 fade 调得更敏感：点脚下 wsum 远大于 kcov ⇒ 实；离点 fscale 处 wsum 已明显小于 kcov ⇒ 透明）。*/
  /* E394 DS：**每个点的可见半径**（显示像素）。取 fscale 的 2.5 倍 ⇒ 晕与晕搭接、但没有点的空间拿不到任何权重 ⇒ 回底色。 */
  /* = 单点在 fscale 处的核权重（全库尺） */
  /* E389 DS：**不加硬截断**。局部性由 fade = wsum/(wsum+kcov) 自己给出：
   *   离任何可见点都很远的格子 wsum ≪ kcov ⇒ fade ≈ 0 ⇒ 自然回到底色（每个可见点只发散自己那块区域）；
   *   可见点脚下 wsum ≫ kcov ⇒ fade ≈ 1 ⇒ 一定有颜色（无洞）。硬截断会把全范围那 85% 的格子一起砍掉（实测 6162/39952）。 */      /* = 单点在 fscale 处的核权重：覆盖度在半径 fscale 处正好落一半 */
  var bR = parseInt(st.bg.slice(1, 3), 16), bG = parseInt(st.bg.slice(3, 5), 16), bB = parseInt(st.bg.slice(5, 7), 16);
  var c = document.createElement('canvas'); c.width = nb.gx; c.height = nb.gy;
  var cg = c.getContext('2d'), img = cg.createImageData(nb.gx, nb.gy), dta = img.data;
  var BND9 = (st.color === 'rel') ? null : colBand();
  var nPainted = 0, nOob = 0;   /* §E381 见下面 FL.painted / FL.oob */
  var SHOWN = new Uint8Array(N), nShown = 0;
  for (var s9 = 0; s9 < N; s9++) { SHOWN[s9] = (VIS[s9] && inWin(P[s9])) ? 1 : 0; nShown += SHOWN[s9]; }
  var VIS_TB = (nShown === N) ? null : visKNN(nb, key + '@' + visSigNow);
  /* E389 DS：**不再**把覆盖度基准跟着可见集放大 —— 那会让远处的可见点把场拉成一片平均（用户：「暴力拉到无穷远」）。
   *   覆盖度基准保持全库 d12m 那一把尺 ⇒ 晕有固有尺度；配合下面的截断半径，远处自然回到底色。 */
  for (var i = 0; i < nb.gx * nb.gy; i++) {
    /* §E381（用户 10-07：「不渲染的点摘出去**但别的附近点要正常渲染覆盖对应区域**，而不是直接挖空变成黑色。
     *   何况现在有的点还没摘出去周围就变成黑的了」）：地板的 IDW **只吃当下画出来的那批点**。
     *   做法是把两件事拆开：**邻域表**（每格最近 12 名）仍按全库算一次并缓存 —— 那是几何，与"谁被画"无关；
     *   **加权**这一遍按可见名单过滤（40000 格 × 12 = 48 万次，比整张邻域重算便宜两个数量级，实测每帧可跑）。
     *   ⇒ 场的取值必然落在可见点的 F 区间之内（加权平均的性质）⇒ 既不钳位、也没有黑洞。
     *   ⚠ 我上一版的错正是反过来的：场含被摘出去的点、色带按可见点定标 ⇒ 带外一大片 ⇒ 那个"淡出"把那片涂成底色 = 黑洞。
     *   ⚠ 一格 12 个邻居全被摘掉 ⇒ wsum = 0 ⇒ 那一格留空。那不是洞，是"这块地方没有画得出来的点"。 */
    /* E388 DS：候选表 =「当下画得出来的那批」里最近的 KF 枚（见 visKNN 的说明）。
     *   nShown === N ⇒ 用 buildNB 缓存好的全库表（两者逐字节相同）；否则现算可见表
     *   ⇒ 不再存在"候选全在窗外 ⇒ wsum=0 ⇒ 留空"的格子。 */
    var TB = VIS_TB || nb;
    var bs9 = i * KF, wsum = 0, hsum9 = 0, ssum9 = 0;
    for (var u9 = 0; u9 < KF; u9++) { var pi9 = TB.idx[bs9 + u9]; if (pi9 < 0) break;
      if (nShown !== N && !SHOWN[pi9]) continue;
      var w9 = 1 / Math.pow(Math.max(TB.dst[bs9 + u9], 1e-6), KEXP);
      wsum += w9; hsum9 += w9 * (P[pi9].Hp / 100); ssum9 += w9 * P[pi9].S; }
    if (!(wsum > 0)) continue;
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
    var Fav = (hsum9 + st.T * ssum9) / wsum;
    /* §E347：底图默认 = **全库分位 + 蓝→灰→红**（回到 §E338 之前那个读法）；只有切到第 6 档「rel」才用发散带 + 淡入。*/
    var REL = st.color === 'rel';
    var tt = REL ? fColRel(Fav) : fCol(Fav);
    var rgb = REL ? rampRGBF(tt) : rampRGB(tt);
    var a = (REL ? Math.min(0.50, 0.95 * Math.abs(tt - 0.5) * 2) : (0.92 - 0.5 * tt)) * fade;
    nPainted++;
    if (BND9 && (Fav < BND9.lo - 1e-9 || Fav > BND9.hi + 1e-9)) nOob++;
    var o = i * 4;
    dta[o] = Math.round(bR + (rgb[0] - bR) * a);
    dta[o + 1] = Math.round(bG + (rgb[1] - bG) * a);
    dta[o + 2] = Math.round(bB + (rgb[2] - bB) * a);
    dta[o + 3] = 255;
  }
  cg.putImageData(img, 0, 0);
  FL = { c: c, px: dta, key: key, tv: st.T, bgc: st.bg, col: st.color,
    vis: NVIS + '|' + st.batch + '|' + st.flo.toFixed(3) + ',' + st.fhi.toFixed(3),
    /* §E381 自检要读的两个数：地板被涂了几格 ‖ 有几格的场值跑到"可见点的 F 区间"之外（应当恒为 0）。
     *   带外 = 0 这一条同时排掉两种病：钳位（一大片纯色）与淡出（黑洞）—— 因为加权平均不可能跑到被平均的那些点之外。*/
    painted: nPainted, oob: nOob, nShown: nShown, cells: nb.gx * nb.gy,
    x0: nb.x0, x1: nb.x1, y0: nb.y0, y1: nb.y1,
    nmed: nb.nmed, ax: nb.ax, by: nb.by, gx: nb.gx, gy: nb.gy };
}
function ensureField(key, bx, byy) {
  var k2 = key + '@' + Math.round(bx) + ',' + Math.round(byy);   /* 比例尺进缓存键：窗口尺寸变了才重建 */
  if (!NBK[k2]) buildNB(k2, bx, byy);
  /* E388 DS：§E381 那版 buildNB **不把 bx/byy 存进缓存**（它们是 §E382 才加的）⇒ 我的可见表拿它算格宽会得 NaN。 */
  if (NBK[k2].bx === undefined) { NBK[k2].bx = bx; NBK[k2].byy = byy; }
  /* §E347：位图**内容**现在跟着色标档变（rel 与否是两条 LUT）⇒ 判据必须带 st.color，漏了就是切档拿旧位图
   * §E371：同理还要带**强度窗口** —— 它重铺的是同一条色带。
   * §E381 改口径：**地板的 IDW 现在按"当下画出来的那批点"加权**（用户："不渲染的点摘出去，附近点要正常覆盖那块区域"）
   *   ⇒ 缓存键必须带**可见名单**（批次 + 窗口 + 可见枚数），漏了就是"切了批次、地形还是上一批的形状"。
   *   ⚠ 邻域表 NBK 仍然不进这些：那是几何（每格最近 12 名，按全库算一次），过滤发生在**加权**那一步 ⇒ 每帧只多 48 万次乘加。 */
  var visSig = NVIS + '|' + st.batch + '|' + st.flo.toFixed(3) + ',' + st.fhi.toFixed(3);
  if (!FL || FL.key !== k2 || FL.tv !== st.T || FL.bgc !== st.bg || FL.col !== st.color || FL.vis !== visSig) buildBitmap(k2, visSig);
}
/* ---- 通用：标签贪心避让（撞了就不画，冠军宁可错开一行） ---- */
var boxes = [];
var NLABPUSH = 0;   /* §E376 这一帧里 putLabel 触发"避让"（往下挪一行）的次数 */
var LAB = [];          /* §E338 命中表：每画出一个标签，记下它的**包围盒 + 属于哪一枚**（下标） */
function labelReset() { boxes = []; LAB = []; NLABPUSH = 0; }
/* 标签的包围盒：非旋转 = [x, y顶, 宽, 高]；旋转 = 文字**向上**伸，所以顶边是 ay−字长（旧代码把 ay 记成顶边 ⇒ 命中框整体下移一个字长）*/
function noteLab(bx, top, bw, bh, idx) { if (idx === undefined || idx === null || idx < 0) return; LAB.push([bx, top, bw, bh, idx]); }
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
function putLabel(txt, x, y, force, rot, idx) {
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
        if (1) { boxes.push(r);   /* TEMP 复原故障：旋转标签不看碰撞，直接画在第一个候选位 */ noteLab(r[0], r[1] - r[3], r[2], r[3], idx); drawText(txt, r[0], r[1] + bh, true); return true; }
      }
    }
    return false;
  }
  /* 横向标签也要卡进画布：右缘/下缘外的名字以前就直接画没了 */
  var bx = Math.min(x + 8, cv.width - bw - 4 * devicePixelRatio), by = Math.min(Math.max(y - 5, 2), cv.height - bh - 2), hit2 = false;
  for (var b2 = 0; b2 < boxes.length; b2++) if (bx < boxes[b2][0] + boxes[b2][2] && bx + bw > boxes[b2][0] &&
    by < boxes[b2][1] + boxes[b2][3] && by + bh > boxes[b2][1]) { hit2 = true; break; }
  /* TEMP 复原故障：不许避让 */
  /* §E376 避让计数：重叠对数 = 0 只说明"最终没压在一起"，不说明"没挤过"。
   *   冠军从 15 枚涨到 31 枚之后，真正会退化的是**往下挪一行**这件事本身（挪多了整列标签就糊成一条竖队）。 */
  if (hit2) { by += bh; NLABPUSH++; }
  boxes.push([bx, by, bw, bh]); noteLab(bx, by, bw, bh, idx); drawText(txt, bx, by + bh - 3, false); return true;
}
function wantLabel(d) {
  if (st.labels === 'off') return false;
  if (st.hi[gk(d)]) return true;
  /* §E556（用户 10-09 08:5x：「按家族高亮的时候，历代冠军的标签并不会暗掉，很容易导致混淆」）：
   *   被点选 / 加进对比 / 搜索命中的**一定标**（这是用户自己指定的，不能被高亮规则挤掉）。
   *   原来这条只是"事实上成立"——labelSet 给它们 pri=-1，但要不要进名单是这里决定的，
   *   所以一枚既不在高亮族、又不是冠军/前 12 的选中点其实**没有名字**。顺手补明。 */
  if (d.id === st.sel || st.cmp.indexOf(d.id) >= 0) return true;
  if (st.q && String(d.id).toLowerCase().indexOf(st.q) >= 0) return true;   /* §E453 搜索改成不分大小写：包名里有 v7FGta / SLOT-AB12 这种混写，按原样比会「打了却搜不到」 */
  /* §E556：高亮态下"冠军 / 父链 / 前 12 / 尾 6"这几条常驻规则**让位给高亮**。
   *   不这样就是用户截图里那个样子：一片暗点上面浮着十几个亮名字，读起来像"这些名字属于刚点的那一族"。
   *   压暗的是标签，不是数据 —— 取消高亮（或点"清除高亮"）它们全回来。 */
  var hiOn = false; for (var hk in st.hi) if (st.hi[hk]) { hiOn = true; break; }
  if (hiOn) return false;
  if (st.labels === 'all') return true;
  /* §E330 父链那几枚必须常驻：它们不是冠军、名次也不显眼（E51-t8-713 排 61），落在"零散实验"那一行里
   *   ⇒ 不点名就找不到，而用户问的正是"现役的祖先在图上哪去了"。 */
  return !!d.lin || d.kin === '父链' || d.rk <= 12 || d.rk > N - 6;
}
function labelSet() {
  var out = [];
  /* §E338 批次过滤在这里生效（不在 wantLabel 里，因为 wantLabel 拿的是枚、这里拿的是下标 ⇒ VIS 按下标算）。
   *   选中的那枚与"加进对比"的那几枚**永远要标出来**，否则切了批次就找不到刚点的那张卡。 */
  for (var i = 0; i < N; i++) { if (!VIS[i]) continue; if (!wantLabel(P[i])) continue;
    var pri = (P[i].id === st.sel || st.cmp.indexOf(P[i].id) >= 0) ? -1
      : ((P[i].lin || P[i].kin === '父链') ? 0 : (P[i].rk <= 12 ? 1 : 2));
    out.push({ i: i, pri: pri }); }
  out.sort(function (a, b) { return a.pri - b.pri || P[a.i].rk - P[b.i].rk; });
  return out;
}

/* ---- ④ 一维：F 排序带（718 枚全可数、零重叠）+ 下面一条 H / T·S 分解 ---- */
function draw1(fr) {
  var w = cv.width, h = cv.height, i;
  clear(w, h);
  var pad = 26 * devicePixelRatio, band = h * 0.16, base = h * 0.86;   /* §E432 用户 10-08：仍然遮挡 ⇒ 继续下移（0.78 → 0.86）*/   /* §E431 用户 10-08：整幅往下挪（底下本来空着）*/
  /* E399 DS（用户 10-08：「现在拉范围只会硬切，你直接改成随时顶满两头就行」+「加一个根据时间排序的选项」）：
   *   ① 排位只在**当前画得出来的那批**（VIS）里做 ⇒ 范围一拉就**顶满两头**，不再留一串空位（硬切）。
   *   ② sortBy='time' 时按**训出时刻**排（与 F 名次并存的一个开关）。 */
  var ord = []; for (i = 0; i < N; i++) ord.push(i);
  if (st.sortBy === 'time') ord.sort(function (a, b) { var ta = P[a].ts || '', tb = P[b].ts || ''; return ta < tb ? -1 : (ta > tb ? 1 : 0); });
  else ord.sort(function (a, b) { return Fv(P[b]) - Fv(P[a]); });
  var ordV = ord.filter(function (k) { return VIS[k]; });
  g.strokeStyle = st.dim; g.lineWidth = 1;
  g.beginPath(); g.moveTo(pad, base); g.lineTo(w - pad, base); g.stroke();
  g.fillStyle = st.dim; g.font = (12 * devicePixelRatio) + 'px system-ui,sans-serif';
  g.fillText(st.sortBy === 'time' ? '训出时刻（旧 → 新）→' : '名次（当前可见集内 · 已顶满两头）→', pad, base + 46 * devicePixelRatio);
  g.fillText('纵轴 = F = Hp + T·S（Hp = 线上口径夺1率 · F 越高越好）：' + (st.goodTop ? '越高 = 越好，贴基线 = 最差' : '贴基线 = 最好（冠军在底），越高 = 越差'), w * 0.34, band - 10 * devicePixelRatio);
  scr = new Array(N);
  var dx = (w - 2 * pad) / Math.max(1, ordV.length - 1);
  for (i = 0; i < ordV.length; i++) {
    var d = P[ordV[i]], x = pad + i * dx, y = base - u01(Fv(d), fr) * (base - band);
    /* §E338 批次过滤：横轴是**名次**（不是时间），所以隐藏某一批会在这条带上留下空位 ——
     *   这是对的：空位本身就说"这些名次被那一批占着"。scr 仍按名次下标落，命中表不会错位。 */
    scr[ordV[i]] = [x, y];
    var al = alphaOf(d);
    /* 718 根柱子挤在 1500px 里会糊成一整块（第一版就是这样）⇒ 只给冠军/被点选的家族画茎，其余留点。
       注意别写成 al > 0.5：没高亮时 al 恒为 1，那个条件等于"全都画"。 */
    if (d.lin || st.hi[gk(d)]) {
      g.globalAlpha = al * 0.55;
      g.strokeStyle = colOf(d, fr); g.lineWidth = (d.lin ? 1.6 : 0.8) * devicePixelRatio;
      g.beginPath(); g.moveTo(x, base); g.lineTo(x, y); g.stroke();
    }
    g.globalAlpha = al;
    /* ⚠ 一维这条带**故意不跟"半径 = 名次"**（与地图/谱系/三维不同）：这里横轴已经是名次本身，
     *   901 枚挤在 1500px（间距 1.7px）⇒ 再按名次放大到 5.6px 会把整条带糊成一块，
     *   而"名次"这件事在这张图上已经由横轴表达了，重复编码只会损失可读性。*/
    var rr1 = (d.lin ? 5 : 2.6) * st.size;
    g.beginPath(); g.arc(x, y, rr1, 0, 6.284); g.fillStyle = colOf(d, fr); g.fill();
    if (d.lin && al > 0.5) { g.strokeStyle = st.ink; g.lineWidth = 1.4; g.stroke(); }
    if (d.id === st.sel) { g.globalAlpha = 1; g.strokeStyle = '#ffd166'; g.lineWidth = 2 * devicePixelRatio;
      g.beginPath(); g.arc(x, y, rr1 + 5 * devicePixelRatio, 0, 6.284); g.stroke(); }
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
    putLabel((P[ls[i].i].id === 'SHIPPED-Ldemo' ? '★' : '') + labOf(P[ls[i].i]), p[0], p[1], !!P[ls[i].i].lin, true, ls[i].i); }
  g.fillStyle = st.dim; g.font = (12 * devicePixelRatio) + 'px system-ui,sans-serif';
  g.fillText('一维：位置 = ' + (st.sortBy === 'time' ? '训出时刻' : 'F 名次') + '（下方蓝条 = Hp 线上口径夺1率，黄条 = T·S）· 悬停看明细 · 点一枚 = 选中（点空白取消）· 点家族图例可高亮', pad, h - 14 * devicePixelRatio);
}

/* §E332 把谱系图的**版式**（车道带 + 左栏家族名/统计 + 左右分界 + 日期竖线与刻度）烘成一张离屏画布。
 *   为什么要烘：立体态要把整张版式当**底图**贴到倾斜平面上（用户："把这个网格和标签当做地图模式的底图，
 *   然后仿照地图的模式做渲染，这样对应也好"）。前一版只把点抬起来、标签留在原地 ⇒ "右边的点进了 3D、
 *   左边的字还在 2D"，读不出谁属于谁。烘一次之后平面/立体共用同一张图、同一个矩阵 ⇒ 错位这件事在结构上不可能。
 *   ⚠ 页脚说明与 RUNNER-BASE 那条注**不进底图** —— 它们是轴饰，跟着相机转就没人读得了（§E314 同一个理由）。*/
var CHM = null;
/* ===== §E379 底图 = **一张纸**：这张函数里不许出现任何视图变换（WX/WY/TKX/TKY/TPX/TPY/PL 一律不进）=====
 *   为什么重写：原来这张纸是**带着当前缩放与平移烘出来的**，而纸里每个元素各自决定参不参与那套变换
 *   （日期线参与、家族名不参与、行带只参与纵向……）⇒ 用户要的"整张底图一起平移缩放"这句话在这套结构里
 *   根本写不出来，于是 §E351/§E369/§E377 每修一次都是在重投一次票，投错一个就是下一个 bug。
 *   现在：纸面坐标一次画完，视图变换只在**贴这张纸**与**算点的屏幕位置**两处施加，两者读同一个 PS ⇒ 结构上不可能各走各的。
 *   日期步长是唯一的例外：它按当前横轴倍率现算（字不能糊成一坨），但**只有步长真的变了才重烘**（步长进缓存键，倍率不进）。 */
/* E395 DS（谱系图去位图 · 步1）：绘制体独立出来，位图/矢量两条路共用同一份代码（「不要修完又变坏」的结构保证）。 */
function paintChrome(t, w, h, fams, rowH, padL, padT, padB, tmin, tmax, X, ff, dayStep) {
  t.font = ff(11);
  for (i = 0; i < fams.length; i++) {
    var f = fams[i], mem = P.filter(function (d, mi) { return d.fam === f && VIS[mi]; });
    var nOk = mem.filter(function (d) { return d.ok === 1; }).length, nCh = mem.filter(function (d) { return d.lin; }).length;
    var best = Math.min.apply(null, mem.map(function (d) { return d.rk; }));
    t.fillStyle = i % 2 ? 'rgba(255,255,255,.028)' : 'rgba(255,255,255,.0)';
    t.fillRect(0, padT + i * rowH, w, rowH);
    /* E396 DS：名字优先（最多 2 行），装得下才在第二行带计数 —— 不硬塞、不溢出。 */
    var maxW = padL - 24 * devicePixelRatio;
    var full = famSummary(famLab({ fam: f })) || ('家族 ' + f);
    t.fillStyle = st.ink; t.textAlign = 'right'; t.font = ff(9);
    var ls = wrapLabel(t, '家族 ' + f + ' · ' + full, maxW, 2);
    t.fillText(ls[0], padL - 12 * devicePixelRatio, padT + i * rowH + rowH * 0.36);
    var cnt = mem.length + ' 枚 · 五道检查 ' + nOk + ' · 冠军 ' + nCh + ' · 最好名次 ' + best;
    t.fillStyle = st.dim; t.font = ff(9);
    if (ls[1]) t.fillText(ls[1], padL - 12 * devicePixelRatio, padT + i * rowH + rowH * 0.82);
    else if (t.measureText(cnt).width <= maxW) t.fillText(cnt, padL - 12 * devicePixelRatio, padT + i * rowH + rowH * 0.82);
    t.font = ff(11);
  }
  t.textAlign = 'left';
  t.strokeStyle = 'rgba(159,176,204,.22)'; t.lineWidth = 1;
  t.beginPath(); t.moveTo(padL - 6, 0); t.lineTo(padL - 6, h); t.stroke();
  for (var tt2 = Math.ceil(tmin / dayStep) * dayStep; tt2 <= tmax; tt2 += dayStep) {
    var xx = X(tt2);
    t.strokeStyle = 'rgba(159,176,204,.16)'; t.lineWidth = 1;
    /* 线仍然只画在数据区里（画进左栏就是脏），**字只要在这张纸上就必须画** ——
     *   §E377 那句"9/14 往左的分度消失"根因不在这道门上，在"门读的是屏幕坐标而平移是屏幕空间的"那一层：
     *   纸与数据现在同进同退，这道门就变回它本来的意思（纸内的版式规则）。 */
    if (xx >= padL - 6) { t.beginPath(); t.moveTo(xx, padT); t.lineTo(xx, h - padB); t.stroke(); }
    t.fillStyle = st.dim; t.font = (10 * devicePixelRatio) + 'px system-ui,sans-serif';
    t.fillText(new Date(tt2).toISOString().slice(5, 10), xx + 3, h - padB + 16 * devicePixelRatio);
  }
}
function treeChrome(w, h, fams, rowH, padL, padT, padB, tmin, tmax, X, ff, dayStep, SS) {
  var c = document.createElement('canvas'); c.width = Math.round(w * SS); c.height = Math.round(h * SS);
  var t = c.getContext('2d'); t.setTransform(SS, 0, 0, SS, 0, 0);
  paintChrome(t, w, h, fams, rowH, padL, padT, padB, tmin, tmax, X, ff, dayStep);
  return c;
}

/* ⑤ §E304 谱系图：**行 = 家族（按最早 ts 排，所以从上往下就是时间推进）**，横轴 = 训练时刻。
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
  var fams = [], fset = {};
  /* §E338 用户 ①「家族太多了，加一个按钮只展示当前批次」：行表**按当前批次现算**，
   *   切到一批就只剩这一批碰过的家族（实测 09-28 那批 6 行 vs 全库 24 行 ⇒ 行带从 29px 涨回 100+px，
   *   左栏那两行字不再互相压）。冠军行永远保留（分界参照物不能被批次切没）。 */
  for (i = 0; i < N; i++) if ((P[i].fam || P[i].famTop) && VIS[i] && !fset[P[i].fam]) { fset[P[i].fam] = 1; fams.push(P[i].fam); }
  fams.sort(function (a, b) { return a - b; });
  LASTFAMS = fams.slice();   /* §E448 交给页内判据：窗口切到"家族 0 一行里一枚都没有"时，像素上读不到行序了，
                                 但行表本身就是"谁排在最上面"这件事的主语 ⇒ 判据可以退到这一层，而不是整条跳过 */
  var tmin = Infinity, tmax = -Infinity;
  for (i = 0; i < N; i++) { if (!VIS[i]) continue; var tv = Date.parse(P[i].ts); if (isFinite(tv)) { if (tv < tmin) tmin = tv; if (tv > tmax) tmax = tv; } }
  if (!(tmax > tmin)) { g.fillStyle = st.dim; g.fillText('没有可用的 ts ⇒ 谱系图画不了（要 lineage.tsv）', 30 * devicePixelRatio, 60); return; }
  var padL = TPAD.l, padR = 26 * devicePixelRatio, padT = TPAD.t, padB = 66 * devicePixelRatio;
  var rowH = (h - padT - padB) / fams.length, X = function (tv) { return padL + (tv - tmin) / (tmax - tmin) * (w - padL - padR); };
  /* §E377 缩放**以数据区左上角为支点**（不是画布原点）‖ §E379 这套 WX/WY 从此**只在两个地方用**：
   *   贴那张纸的仿射、以及算每枚点的屏幕位置 —— 纸本身不带它（原来纸是带着它烘的，于是"哪些元素参与"
   *   变成逐元素的投票，这就是修一个坏一个的根）。支点用**挤行之前的** TPAD.t：
   *   下面那行抬升带会就地加 padT，若拿它当支点，同一档 tKy 在平面/立体下会锚到两个地方。 */
  var TKX = st.tKx, TKY = st.tKy, TPX = st.tX, TPY = st.tY;
  var WX = function (x) { return TPAD.l + (x - TPAD.l) * TKX + TPX; },
      WY = function (y) { return TPAD.t + (y - TPAD.t) * TKY + TPY; };
  var ff = function (n) { return (n * devicePixelRatio) + 'px system-ui,sans-serif'; };   /* §E379 纸面字号不乘 TKY：放大由贴纸那一步负责 */
  /* §E333 立体要**上面留一条抬升带**：不然最上面几家的点一抬就顶出画布（它们本来就在顶上）。
   *   做法 = 把整张地板往下挤 LIFT·T3，行距按剩下的空间重排 ⇒ 行仍然全在画布内，
   *   而"原地上升"有了去处。挤完 padT/rowH 就是立体版的那张版式，底图与点共用同一套 ⇒ 不会错位。*/
  var LIFT = (h - padT - padB) * 0.22;
  /* §E469 记下**挤行之前**的布局：边的密度网格要建在这一层上（只随数据/窗口/批次变，不随相机变）。
   *   拿挤行之后的 padT/rowH 去建网格 ⇒ 转视角时行被压缩、格子整体换档，一条线的 alpha 会跳
   *   （实测偏航 +0.05rad 跳 0.207，def-31 从 0.300 掉到 0.093）= 用户点的"旋转时抽搐"。 */
  var padT0 = padT, rowH0 = rowH;
  if (st.elev > 1e-4) { padT += LIFT * st.elev; rowH = (h - padT - padB) / fams.length; }
  var KS = 1;   /* §E314 点半径不跟缩放（经典统计图约定）—— 保留这个名字是因为下面两处按它算半径 */
  /* §E379 日期步长按**当前横轴倍率**现算：恒为 1 天时缩到 0.57 实测 13px 一格压 34px 宽的字 ⇒ 糊成一坨。
   *   目标是屏幕上至少隔 46 CSS px 一根 ⇒ 倍率越小步长越大（1 → 2 → 5 → 7 天）。
   *   ⚠ 只有**步长真的变了**才重烘那张纸（步长进缓存键，倍率不进）⇒ 拖动与连续缩放不会每帧重画版式。 */
  var DAY = 86400000, pxD = (w - padL - padR) / ((tmax - tmin) / DAY) * TKX;
  var dayStep = DAY * (pxD >= 46 * devicePixelRatio ? 1 : pxD >= 23 * devicePixelRatio ? 2 : pxD >= 12 * devicePixelRatio ? 5 : 7);
  /* ===== §E332 → §E379 底图 = 一张**纸面坐标**的离屏画布（车道带 + 左栏家族名/统计 + 分界 + 日期竖线与刻度）=====
   *   用户裁定：「把这个网格和标签当做地图模式的底图，然后仿照地图的模式做渲染」+ 10-07「网格当做底图整体进行平移缩放」。
   *   平面按仿射贴、立体按同一台相机贴，点用**同一个 PS** ⇒ 点与它那一行的名字必然对齐，
   *   因为两者出自同一张纸、同一个矩阵。 */
  var SS = Math.max(1, Math.min(2, TKX));
  var ck = [w, h, fams.join(','), tmin, tmax, st.ink, st.dim, devicePixelRatio,
    st.elev.toFixed(3), st.batch, NVIS, st.flo.toFixed(3) + ',' + st.fhi.toFixed(3), Math.round(dayStep / DAY), SS.toFixed(2)].join('|');
  if (!CHROMEVEC && (!CHM || CHM.k !== ck)) CHM = { k: ck, c: treeChrome(w, h, fams, rowH, padL, padT, padB, tmin, tmax, X, ff, dayStep, SS) };
  var T3 = st.elev, uc = w / 2, vc = h / 2, cb = cam();   /* E352 DS: 相机基 cb（与地图同一套） */
  /* ===== §E369 → §E377 立体态**不再有任何形式的"把整张图塞进窗口"**（用户："看的很难受，把这个东西去掉"）=====
   *   §E369 为消掉"上下左三面截断"加了一层"包围盒等比缩小 + 居中"。缩小被点名撤掉之后，**居中也必须一起撤**：
   *     ox = (w - bw)/2 - x0 里的 x0 随平移线性移动 ⇒ 居中公式把平移量**原样抵消**，
   *     立体态下左键拖动整个不起作用（"拉不回来"就是这么来的，比截断更难受）。
   *   现在 PL 就是相机投影本身：转到刁钻角度真的会溢出画布，但那是可操作的（平移能拉回来，判据②钉着），
   *   而默认立体视角（SOLID）由判据①保证"一打开就是完整的图"。
   *   §E369 的另一半仍然成立：平面态那道 clip 已撤；FLAT 相机下投影 == 恒等 ⇒ 二维那张图逐像素不变。 */
  function PL(u, v, z) {
    var a = u - uc, bb = v - vc;
    return [uc + a * cb.r[0] + bb * cb.r[1], vc + a * cb.u[0] + bb * cb.u[1] - (z || 0)]; }
  /* §E333 立体 = **原地上升**，不是把地板压扁。用户两张截图点名的病：上一版借地图那台相机（pit 0.72 ⇒ 行方向
   *   只剩 cos = 0.66 的高度），24 行被挤成一条横带，格内抖动又被我挪去横方向 ⇒ 比二维更挤。
   *   现在：地板按二维那张版式贴（行方向最多按 tTilt 轻微压扁），点沿**屏幕纵轴**抬起，每枚留一根立柱接回自己那一格。
   *   T3=0 ⇒ cos(0)=1、错切 0、抬升 0 ⇒ 逐字等于二维；TH/SH 只由右键拖动给，默认 0。*/
  /* E352 DS：PL 原来只做 tTilt/tShear 仿射 ⇒ 谱系图没有旋转。换成正交相机投影（与地图同一套 cam()）。
   *   默认 th=-pi/2, ph=pi/2 ⇒ r=[1,0,0]、u=[0,1,0] ⇒ 退化成 [u, v-z]，与旧版逐像素相同。
   *   树里所有几何（地板四角/棋子/立柱/标签/scr[] 命中表）都经过 PL ⇒ 换它即全部同步。
   *   §E369：PL 的定义挪到上面去了（拟合要先算包围盒），并且外面多包了一层 fit —— **这里不要再声明一遍**
   *   （函数声明会提升，重复声明的那一份会**静默覆盖**前一份 ⇒ 拟合白做）。 */
  /* §E351 DS（用户 10-06：「平移的时候坐标轴并不跟着动」）：地板（轴文字烘在 CHM.c 里）原样贴 (0,0)-(w,h)，**没走 WX/WY**；而棋子的落点走的是 WX(X(tv))（含 tKx/tKy/tX/tY）⇒ 棋子跟着平移、地板和轴不走。
   *   修法：地板角点也走同一套映射（分母仍是 w/h，因为源画布就是 w×h）⇒ 地板/轴与棋子**永远同一套变换**。 */
  /* §E351 更正（DS 10-06 第二版）：地板角点**回到裸画布坐标** —— treeChrome 里 x 已经走过 WX（见日期刻度的 xx），
   *   这里再走一遍 WX/WY 等于把平移用了两次 ⇒ 日期刻度 2×、表格 1× ⇒ 错位（用户实测）。真正的绑定见 treeChrome 里日期刻度那一行。 */
  /* §E379 **一个矩阵两处用**：PS(纸面坐标) = 相机投影 ∘ 视图变换。
   *   地板用它贴（下面那三个角点），点/立柱/血统边/标签也用同一个 PS ⇒ "整张底图跟着一起平移缩放"
   *   这句话现在是结构事实，不是每次改动要逐元素重新投票的口头承诺。 */
  function PS(x, y, z) { return PL(WX(x), WY(y), z || 0); }
  var q0 = PS(0, 0), qX = PS(w, 0), qY = PS(0, h);
  g.save();
  g.setTransform((qX[0] - q0[0]) / w, (qX[1] - q0[1]) / w, (qY[0] - q0[0]) / h, (qY[1] - q0[1]) / h, q0[0], q0[1]);
  /* E395 DS（用户 10-08）：网格修好了但改成位图 ⇒ 缩放发虚、字被糊扭。改成矢量直画：
   *   这里上下文已设好「纸面 → 屏幕」仿射，paintChrome 就在纸面坐标里画 ⇒ 字与线在最终分辨率上栅格化。
   *   两条路共用 paintChrome ⇒ 不会变成两套版式；旧路径留在 #chrome=bmp。 */
  if (CHROMEVEC) { g.save(); paintChrome(g, w, h, fams, rowH, padL, padT, padB, tmin, tmax, X, ff, dayStep); g.restore(); }
  else { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(CHM.c, 0, 0, CHM.c.width, CHM.c.height, 0, 0, w, h); }
  g.restore(); g.setTransform(1, 0, 0, 1, 0, 0);
  var FR3 = fRange();
  g.save();
  /* §E369 那道 clip(padL-5) 已撤；§E379 连"画完数据再回贴左栏"那一步也一起撤了 ——
   *   左栏现在是纸的一部分，与数据同进同退，不存在"点滑进左栏把名字糊住"这一说（要糊一起糊）。 */
  /* 血统边（画在点底下，免得盖住点）*/
  /* 每枚的落点 = 纸上那一格 (x,y)（**与底图逐字同一套坐标**，含格内纵向抖动）+ 按 F 抬起来的 z。
   *   高度用**线性** min-max，不用 §E330 那套按秩铺色 —— 秩是"颜色要能分开"的读法，几何要的是量的比较。
   *   ⚠ 格内抖动（同一秒训出的一撮）**两态都留在纵方向**：上一版把它挪去横方向，正逢地板被压扁 ⇒ 一撮点全叠成一条横线。
   *   立体态反而要它：同一格里纵向散开一点才好观察（用户点名）。*/
  var pos = {}, base = {}, pap = {};
  function PT(i) {
    var d = P[i], tv = Date.parse(d.ts); if (!isFinite(tv)) return null;
    if (!VIS[i]) return null;      /* §E338 批次过滤：不在当前批次 ⇒ 不落格、不连线、不进命中表 */
    var ri = fams.indexOf(d.fam); if (ri < 0) return null;
    var jit = ((i * 2654435761) % 1000) / 1000 - 0.5;
    var px = X(tv), py = padT + (ri + 0.5) * rowH + jit * rowH * 0.66;   /* **纸面坐标**（§E379：与底图同一套，视图变换交给 PS） */
    var uf = Math.max(0, Math.min(1, (Fv(d) - FR3[0]) / ((FR3[1] - FR3[0]) || 1)));
    return [PS(px, py, uf * LIFT * T3), PS(px, py, 0),
            [px, padT0 + (ri + 0.5) * rowH0 + jit * rowH0 * 0.66]];   /* 第三项 = 挤行之前的纸面点（§E469 密度建在那一层）*/
  }
  for (i = 0; i < N; i++) { var q = PT(i); if (!q) continue; pos[P[i].id] = q[0]; base[P[i].id] = q[1]; pap[P[i].id] = q[2]; }
  if (T3 > 0.02) {   /* 立柱：把"浮在多高"接回底图上那一格，否则立体里读不出它属于哪一行 */
    g.strokeStyle = 'rgba(159,176,204,.20)'; g.lineWidth = 1;
    for (i = 0; i < N; i++) { var pb = pos[P[i].id], gb = base[P[i].id];
      if (!pb || !gb || Math.abs(pb[1] - gb[1]) < 1.5) continue;
      g.beginPath(); g.moveTo(gb[0], gb[1]); g.lineTo(pb[0], pb[1]); g.stroke(); } }
  /* ===== §E467 边的透明度按**局部密度**压（用户 10-08：「线连太多了之后还是有点太糊了，调整一下透明度或者考虑一下连线透明度叠加时使用对数叠加」）=====
   *   固定 .30 在 726 条上必然糊：n 条重叠的等效不透明度是 1-(1-.3)^n，10 条就 0.97 ⇒ 扇根与主带整块成板。
   *   而"板"没有信息量 —— 它只说"这里很多"，读者要的是"能数出几条、各自往哪儿去"。
   *   现在的法律：**拐点 + 反比归一** —— 先把"哪些边经过哪个格子"栅格进一张粗网格（格 = 22 CSS px），
   *   每条边沿曲线取 5 个位置的格子线数 d，alpha = 基准 × min(1, ED0 / d)（地板 EMIN），**一条边一次 stroke**（渐变 strokeStyle）。
   *   为什么不是字面的"对数相加"：量过，它压不住这块板。按 基准/(1+ln d)^1.5 时最密那一格（523 条）单段只到 .041，
   *   而一个像素上仍压着 ~40 段 ⇒ 1-(1-.041)^40 = 81% 照样到顶；更要紧的是对数律把**中等密度**（一格 9~32 条）也一并压暗
   *   （实测那一段的中位墨从 131 掉到 67），这就是用户接着说的"单根线看不见了"。拐点律在 d ≤ 25 时**一字不改全 alpha**，
   *   只在真堆里按 1/d 收，使那格的总墨量有界。
   * §E467a 中间一版被当场否掉（「现在线条重合的部分反而出现了中断」）：那条边切 8 段、按段密度**分桶批量 stroke** ⇒
   *   同一条线在不同桶里以不同 alpha 落笔、桶又按 alpha 升序画 ⇒ 亮段压在暗段上 = 肉眼可见的断口。
   *   教训：分桶是省 stroke 的手段，**不能拿它改单条线的连续性**；连续性现在由 §E467b 那条判据钉住。
   *   三个常数是量出来的（判据自己报的读数，窗 = 最密那一格 ±40px，那一格压着 523 条线）：
   *     ED0=8 ⇒ 到顶 436→20、有墨 790→754、d=9~32 那档中位墨 67（太暗）‖ **ED0=25 ⇒ 到顶 436→26（6%）、有墨 765（97%）、d=9~32 中位墨 131**
   *     地板 .03 只管"埋在堆里那一段"：一条 1px 线满量程墨 ≈ 221，alpha 低于 .03 就落到 6.6 墨以下 = 肉眼与判据同时看不见。
   *   ⚠ 网格每帧重算（平移/缩放会改密度）；代价 = 726×5 次算术 + 726 次 stroke + 3630 次 addColorStop（与改动前同量级）。
   *     ELOG=0 是页内那两条判据自己用的对照组（固定 alpha），不是给用户的开关。 */
  var EA0 = 0.30, ED0 = 25, EMIN = 0.03, EGRID = Math.max(10, Math.round(22 * devicePixelRatio));
  var NINF = 0   /* §DS②：路径推断来源的父边条数（与槽位接替/倒挂同型）*/
var NBACK = 0; NEDG = 0; NCHAIN = 0; NSOUP = 0; NSOUP1 = 0; NSOUP2 = 0;
  EDGR = { n: 0, segs: 0, amin: 1, amax: 0, hub: null, hubn: 0, probe: [] };
  if (st.edges !== 'off') {
    var EL = [];
    for (i = 0; i < N; i++) { var dd = P[i]; if (!dd.pof || !pos[dd.id] || !pos[dd.pof]) continue;
      /* §E373 连线开关：'off' 一条不画；'hash' 只画**父身份可证**那一级（哈希 / 种子文件同权重）。
       *   §E378 的接替边 psrc='slot-chain' 在 'hash' 档**不画**（它不是血统）。
       *   ⚠ 原来这一档写的是 「psrc !== 'hash'” ⇒ 连 「hash-emb”（§E464 那批靠"嵌入后身份"才对上的）都不画，
       *     与同一文件里"实线 = hash / hash-emb"的分级自相矛盾；这次一起收进来。 */
      if (st.edges === 'hash' && dd.psrc !== 'hash' && dd.psrc !== 'hash-emb' && dd.psrc !== 'seedpack-wid') continue;
      var bq = backOf(dd), cq = dd.psrc === 'slot-chain', sq = dd.psrc === 'soup';
      /* §E490 融合粒的**两根父边同色**（用户 10-08：「让两根融合线都用同一个颜色。可以用红色的和蓝色区分开」）：
       *   原来第一父走普通淡蓝、只有第二父是紫 ⇒ 读起来像"一枚热启动 + 一枚额外说明"，
       *   而事实是这两条边**是同一种关系**（这枚 = 这两粒的权重平均）。所以两条一起换红、一起实线。
       *   优先级仍是 倒挂 > 接替 > 融合 > 普通：倒挂那条是"守卫漏了来路"的报警色，不能被融合盖掉。
       *   ⚠ 计数挪到 kind **定完之后**，而且数的是 kind 本身：原来写的是「if (sq) NSOUP1++」，
       *     那量的是"这枚的来路是融合"，不是"这条边真被画成红色" ⇒ 把 kind 改回 0 它照样 +1，
       *     页内那条腿就变成一台只会回显条件的假仪器（本仓"回显生效值"那条老规矩；牙口实测过这一层）。 */
      /* §2026-10-08 DS（用户转 Claude 复核：「实线 = 有哈希为证的血缘，虚线 = 从路径推断出来的」）：
       *   kind 0 原来没有区分来源 ⇒ 把"实线"收紧为**只有 hash / hash-emb**（有哈希为证）；
       *   其余来源（seedpack / arm / slot-at-time）与倒挂假边一样走**长虚线**（kind 1 的既有样式）。
       * §2026-10-09 §E555 把这条分级修准了一格（用户 08:5x：「你昨天刚训练的怎么会不确定父节点」）：
       *   「train-3p” 写进包里的父只有 「EPIRUS_SEEDPACK”（路径）没有 「hotstartFrom”（哈希）⇒ 今晚 271 枚连同 K2/D4a 全被画成虚线，
       *   读起来像"父是谁不知道"，而**父节点从来是确定的**，不确定的只是证据级别。
       *   「lineage.mjs” 现在会把那条路径指向的文件算一遍权重指纹、与图上节点的指纹比：**相等 ⇒ psrc=seedpack-wid**
       *   （同名不同权重那种假父边会被这一步否掉，正是 §E330/§E367 的病）⇒ 与 hash 同级画实线；
       *   不等/读不到 ⇒ 留在 「seedpack”，继续虚线。**这一级不等于哈希级**：哈希是训练服务自己记的，这条是 runner 的环境变量 + 事后核权重，
       *   所以图例与页脚都写成"父身份可证（哈希 / 种子文件同权重）"，不写成"哈希为证"。 */
      var _idenBacked = (dd.psrc === 'hash' || dd.psrc === 'hash-emb' || dd.psrc === 'seedpack-wid');
      /* §2026-10-08 DS②（用户：「黄虚线比蓝线还显眼…灰点线又太虚…既然这两个都是不能完全确定的类型，
       *   你就统一成一种线，能见度跟蓝线差不多或略低」）：**三类不确定合一个 kind** ——
       *   倒挂假边(bq) / 槽位接替边(cq) / 路径推断(seedpack·arm·slot-at-time) 全部 = kind 1（淡蓝虚线）。 */
      if (!_idenBacked && !cq && !bq && !sq) NINF++;   /* §DS②②：路径推断来源（seedpack/arm/slot-at-time）—— 别把槽位接替也算进来 */
      var kind = (sq ? 3 : (_idenBacked ? 0 : 1));
      if (bq) NBACK++; if (cq) NCHAIN++; if (kind === 3) { NSOUP++; NSOUP1++; }
      var pa = pos[dd.pof], pb2 = pos[dd.id];
      /* §E469 每条边同时带**纸面坐标**（papA/papB）：密度网格建在那一层上，而不是建在投影后的屏幕上。
       *   屏幕空间网格 = 平移 1px 就可能整体换格 ⇒ 一条线的 alpha 离散跳档（实测偏航 0.05rad 跳 0.27，
       *   0.030→0.300 差十倍）= 用户点的"平移旋转时抽搐"。纸面网格只随布局（窗口/尺寸）变，不随视图变。 */
      var ua = pap[dd.pof], ub = pap[dd.id];
      EL.push([pa, pb2, [(pa[0] + pb2[0]) / 2, (pa[1] + pb2[1]) / 2 - rowH * 0.5 * TKY],
        kind ? 0.62 : EA0, kind, dd.id, ua, ub,
        ua && ub ? [(ua[0] + ub[0]) / 2, (ua[1] + ub[1]) / 2 - rowH0 * 0.5 * TKY] : null]); }
    /* ===== §E487/§E490 融合粒的**第二父边**（kind=3，与第一父同色同线型：红、实线）=====
     *   融合粒天生有两个父（tools/soup-pack.mjs 把每粒来源的 wid 写进包 meta，lineage.mjs 反查成节点），
     *   两条边是同一种关系 ⇒ 同色（用户 10-08：「让两根融合线都用同一个颜色。可以用红色的和蓝色区分开」）。
     *   'hash' 档不画它（这一档只画包自己 hotstartFrom 里那份哈希；融合父不是哈希级来路）。 */
    for (i = 0; i < N; i++) { var d2 = P[i]; if (!d2.pof2 || !pos[d2.id] || !pos[d2.pof2]) continue;
      if (st.edges === 'hash') continue;
      var q2a = pos[d2.pof2], q2b = pos[d2.id], v2a = pap[d2.pof2], v2b = pap[d2.id];
      NSOUP++; NSOUP2++;
      EL.push([q2a, q2b, [(q2a[0] + q2b[0]) / 2, (q2a[1] + q2b[1]) / 2 - rowH * 0.5 * TKY],
        0.62, 3, d2.id, v2a, v2b,
        v2a && v2b ? [(v2a[0] + v2b[0]) / 2, (v2a[1] + v2b[1]) / 2 - rowH0 * 0.5 * TKY] : null]); }
    NEDG = EL.length; EDGR.n = NEDG;
    /* 网格尺寸按**纸面**范围算：纸面 = 未经 PS 投影的那一层（X() 与行高都在 device px 上），
     *   所以范围就是 w×h，格子仍是 22 CSS px 一档 —— 只是原点不跟着平移走。 */
    var GW = Math.max(1, Math.ceil(w / EGRID)), GH = Math.max(1, Math.ceil(h / EGRID));
    var GC = new Int16Array(GW * GH);
    function PCIX(px, py) {   /* 纸面坐标 → 格子（越界一律夹到边上，与旧版屏幕网格同一套处理）*/
      return Math.min(GH - 1, Math.max(0, Math.floor(py / EGRID))) * GW + Math.min(GW - 1, Math.max(0, Math.floor(px / EGRID))); }
    for (var e = 0; e < EL.length; e++) {
      var A0 = EL[e][6] || EL[e][0], B0 = EL[e][7] || EL[e][1], C0 = EL[e][8] || EL[e][2], sn = {};
      for (var s = 0; s <= 8; s++) { var tt = s / 8, it = 1 - tt;
        var qx = it * it * A0[0] + 2 * it * tt * C0[0] + tt * tt * B0[0];
        var qy = it * it * A0[1] + 2 * it * tt * C0[1] + tt * tt * B0[1];
        var ci = PCIX(qx, qy);
        if (!sn[ci]) { sn[ci] = 1; GC[ci]++; } } }
    var hi = 0; for (var c2 = 0; c2 < GC.length; c2++) if (GC[c2] > GC[hi]) hi = c2;
    EDGR.hubn = GC[hi];
    EDGR.hub = PS((hi % GW + 0.5) * EGRID, (Math.floor(hi / GW) + 0.5) * EGRID, 0);   /* 交回屏幕坐标，判据要按像素开窗 */
    /* ⚠ 一条边**一次 stroke**（§E467a：上一版把每条边切成 8 段、按段的密度分桶批量 stroke ⇒
     *   同一条线在不同桶里以不同 alpha 落笔，桶又按 alpha 升序画 ⇒ 亮段压在暗段上面，
     *   重合处出现肉眼可见的**断口**（用户 10-08 10:5x 直接否掉：「这版不行，现在线条重合的部分反而出现了中断」）。
     *   分桶是省 stroke 的手段，不能拿它去改单条线的连续性 —— 连续性优先，回到 726 次 stroke。 */
    g.lineWidth = 1 * devicePixelRatio;
    for (var e2 = 0; e2 < EL.length; e2++) { var A2 = EL[e2][0], B2 = EL[e2][1], C2 = EL[e2][2], bs = EL[e2][3], kd = EL[e2][4];
      /* §E467c 密度取在**曲线沿线的五个位置**上，一次 stroke 画完（渐变 strokeStyle）：
       *   上一版把整条边取一个均值 ⇒ 一条长线只要蹭到扇根那一格，整条被拉到地板（用户 10-08 11:0x：
       *   「这一版密集处确实好了，但是单根线看不见了」）。均值这件事在"根密尾疏"的边上必然冤枉尾段。
       *   渐变仍是**一次落笔** ⇒ 不会有 §E467a 那种分桶断口；密处压到地板、疏处回到全 alpha。 */
      var ST5 = [0, 0.25, 0.5, 0.75, 1], AL5 = [], col3 = kd === 3 ? '248,81,73' : (kd === 1 ? '104,168,214' : '120,200,255');
      var PA2 = EL[e2][6] || A2, PB2 = EL[e2][7] || B2, PC2 = EL[e2][8] || C2;
      for (var s2 = 0; s2 < 5; s2++) {
        var t0 = ST5[s2], i0 = 1 - t0;
        var mx = i0 * i0 * PA2[0] + 2 * i0 * t0 * PC2[0] + t0 * t0 * PB2[0];
        var my = i0 * i0 * PA2[1] + 2 * i0 * t0 * PC2[1] + t0 * t0 * PB2[1];
        var mi = PCIX(mx, my);
        var dn = GC[mi] > 1 ? GC[mi] : 1;
        var al2 = ELOG ? bs * Math.min(1, ED0 / dn) : bs;
        if (al2 < EMIN) al2 = EMIN;   /* 地板只管"埋在堆里的那一段"；疏处的 alpha 由自己那一格的密度决定 */
        if (al2 < EDGR.amin) EDGR.amin = al2; if (al2 > EDGR.amax) EDGR.amax = al2;
        AL5.push(al2); }
      EDGR.segs++;
      /* §E467b 探针：EPROBE 是"每几条留一条"的步长（页内两条判据设的，平时 0 = 不收）。
       *   沿同一条曲线取 40 个点，每个点带上"它自己那一格压了几条线" ⇒ 判据能分清
       *   "埋在堆里所以淡"与"在空地上还看不见"（后者才是用户点的病）。
       * §E555（10-09 早上这条红了，查出来的根因在这里）：**探针只收实线**（kind 0 身份可证的父边 ‖ kind 3 融合红线）。
       *   虚线在下面一句按设计 setLineDash([4,4]) ⇒ 每 4px 就有一段"没墨"，而这条判据数的是"连续 ≥3 个采样点没墨"
       *   ⇒ 拿虚线去量它，量到的是**虚线自己的间隔**，不是 §E467a 那种"边被切成不同 alpha 的段"的病。
       *   为什么以前没红：步长 = 边数 / 24，边数一变，被抽中的那 24 条就换一批（10-09 加进 63 枚代表之后
       *   抽到一条 'arm' 级虚线 B5-10-71 就当场红）。**改的是采样范围，不是阈值。** */
      if (EPROBE && (!kd || kd === 3) && e2 % EPROBE === 0 && EDGR.probe.length < 24) { var pp = [];
        for (var u = 0; u <= 39; u++) { var tu = u / 39, iu = 1 - tu;
          var ux = iu * iu * A2[0] + 2 * iu * tu * C2[0] + tu * tu * B2[0];
          var uy = iu * iu * A2[1] + 2 * iu * tu * C2[1] + tu * tu * B2[1];
          /* 像素读在屏幕上取，密度问的是**同一个参数 t 上的纸面点**（法律用的就是这一层的格子）*/
          var vx = iu * iu * PA2[0] + 2 * iu * tu * PC2[0] + tu * tu * PB2[0];
          var vy = iu * iu * PA2[1] + 2 * iu * tu * PC2[1] + tu * tu * PB2[1];
          pp.push(ux, uy, GC[PCIX(vx, vy)]); }
        EDGR.probe.push({ pts: pp, al: AL5[2], al5: AL5.slice(), id: EL[e2][5] }); }
      var gr = g.createLinearGradient(A2[0], A2[1], B2[0], B2[1]);
      for (var s3 = 0; s3 < 5; s3++) gr.addColorStop(ST5[s3], 'rgba(' + col3 + ',' + AL5[s3].toFixed(3) + ')');
      /* §E363 倒挂边（父的 ts 晚于子）虚线 + 琥珀；§E378 接替边点线 + 灰：连的都是"槽位接替"，不是谁生了谁。
       *   §E487 融合的第二父边（kd=3，紫）**走实线**：它是一条真血统（这枚确实是那两枚的平均），
       *   只是"不是热启动" —— 用颜色分辨就够了，再加虚线会让人读成"这条更不可信"。 */
      g.save();
      if (kd && kd !== 3) g.setLineDash([4 * devicePixelRatio, 4 * devicePixelRatio]);   /* §DS②：只留一种虚线 */
      g.strokeStyle = gr;
      g.beginPath(); g.moveTo(A2[0], A2[1]); g.quadraticCurveTo(C2[0], C2[1], B2[0], B2[1]); g.stroke();
      g.restore(); }
    g.strokeStyle = 'rgba(120,200,255,' + EA0.toFixed(2) + ')'; }
  /* §E464 这里原来是 §E442 那台「RUNNER-BASE 锚 + 467 条灰雾边」—— 它建在 §E314 的一条**错判**上：
   *   那遍 hunt 只按「文件里那份数组」的哈希找 d13d3c85，而训练服务记父时用的是**嵌入成 v7 之后**那份数组的
   *   指纹（FEAT_S 123→213 ⇒ 3337→5689 ⇒ 哈希必变）⇒ 找不着就判成「盘上无此包」。
   *   现在 lineage.mjs 一枚包同时索引两个身份，584 枚的父直接解析到图上的真节点 SLOT-e379c62c（标签 = v1.3.57），
   *   边走普通热启动父边 ⇒ 锚、灰雾、那句「盘上无此包 · 非血统」全部删掉（留着就是一段永不执行的代码 + 一句假话）。
   *   ⚠ "runner 恒拷同一份 BASE ⇒ 81% 共父不是演化收敛"这条读法警告仍然成立，它挪到页脚第二行去说。 */
  scr = new Array(N);
  for (i = 0; i < N; i++) { var d = P[i], p = pos[d.id]; if (!p) continue; scr[i] = p;
    if (NOPTS) continue;   /* §E451 落点表照记（判据要按位置取样），只跳过"画"这一步 */
    var al = alphaOf(d); g.globalAlpha = al;
    /* §E338 半径 = 名次（第 1 名最小）× 点大小滑杆 × 缩放因子（用户 ②④）；
     *   冠军那圈墨环与"最优"绿环都改成**跟着半径走**，否则小点会被环吞掉。 */
    var rr = dotR(d, TKX);
    g.beginPath(); g.arc(p[0], p[1], rr, 0, 6.284);
    g.fillStyle = colOf(d); g.fill();   /* §E347：这里原来硬写 rampF(fCol(...))，等于**绕过颜色下拉**（切到「家族」也画成 F 色）⇒ 改走 colOf */
    if (d.lin && al > 0.5) { g.strokeStyle = st.ink; g.lineWidth = 1.4; g.stroke(); }
    if (d.ok === 1 && al > 0.3) { g.globalAlpha = al * 0.72; g.strokeStyle = '#39d98a'; g.lineWidth = 1.15 * devicePixelRatio;
      g.beginPath(); g.arc(p[0], p[1], rr + 2.2 * st.size, 0, 6.284); g.stroke(); }
    if (d.id === st.sel) { g.globalAlpha = 1; g.strokeStyle = '#ffd166'; g.lineWidth = 2 * devicePixelRatio;
      g.beginPath(); g.arc(p[0], p[1], rr + 5 * devicePixelRatio, 0, 6.284); g.stroke(); }
    if (st.cmp.indexOf(d.id) >= 0 && d.id !== st.sel) { g.globalAlpha = 1; g.strokeStyle = '#7fd1ff'; g.lineWidth = 1.6 * devicePixelRatio;
      g.beginPath(); g.arc(p[0], p[1], rr + 3.4 * devicePixelRatio, 0, 6.284); g.stroke(); }
    g.globalAlpha = 1;
  }
  labelReset();
  var ls = labelSet();
  for (i = 0; i < ls.length; i++) { var pp = scr[ls[i].i]; if (!pp) continue;
    putLabel((P[ls[i].i].id === 'SHIPPED-Ldemo' ? '★' : '') + labOf(P[ls[i].i]), pp[0], pp[1], !!P[ls[i].i].lin, false, ls[i].i); }
  g.restore();   /* §E314 数据层的裁剪到这里收口（点与点标签都不许滑进左栏）*/
  /* §E379 这里原来是"数据画完之后按同一仿射把左栏那一条回贴一遍"（§E377 加的，为了让点糊不住家族名）。
   *   撤掉：左栏现在是纸上的墨，与点同进同退，"糊住"这件事只能靠层序（纸在下、点在上）表达，
   *   而回贴做的事恰好相反 —— 它把纸的一条**盖回点上面**，于是往左平移时那一条看起来完全不动（用户 10-07 报的病）。 */
  g.fillStyle = st.dim; g.font = (12 * devicePixelRatio) + 'px system-ui,sans-serif';
  /* 页脚 = 轴饰，不进相机（同上：跟着放大 2.4 倍会直接掉出画布，"缩放 ×" 那个数也就永远看不到了）。
   *   §E331 这条串必须**量过宽度**再上屏：它是单行 fillText，画布不折行，超长就从右缘直接截掉 ——
   *   1600px 窗口实测被截在"左键拖动 = 平移"之前，交互提示整段看不见。所以只留别处没有的信息：
   *   颜色口径/绿环在右上图例里，这里不重复。*/
  var foot1 = '行 = 家族（按首次出现排，上→下即时间推进）· 横轴 = 训练时刻 · 颜色 = ' + (st.color === 'hp' ? '页面口径夺1率' : st.color === 'de' ? '部署脆弱性 Δε' : st.color === 'sc' ? '当选键 sc − 现役' : 'F（线上口径势）') +
    /* 色标方向必须跟着口径走：写死"蓝低 → 红高"会在 Δε 那档说反（那档是**红 = 脆**），
       在当选键这档更是彻底错（这档是**绿 = 比现役强、红 = 落后**）—— 图上画的与页脚说的不能是两件事。 */
    (st.color === 'sc' ? '（绿=强 ‖ 红=落后 ‖ 橙=判不动 ‖ 灰=未测）'
      : st.color === 'de' ? '（红=脆 ‖ 蓝=吃探索 ‖ 白=不敏感）'
      /* §E347：F 档回到"地形"读法（蓝低 → 红高），"相对现役"那件事交给第 6 档 rel ⇒ 页脚/图例按当前档现说，不许各讲一套。*/
        : st.color === 'F' ? '（蓝 = 低 = 地板 → 红 = 高 = 好 ‖ 针 = 现役那一档 ‖ 它在库内第 ' + Math.round(incPct()) + ' 百分位）'
        : st.color === 'rel' ? '（绿 = 比现役强 ‖ 灰 = 就是现役那一档 ‖ 红 = 不如现役）'
        : (st.color === 'fam' || st.color === 'seed' ? '（点色 = ' + (st.color === 'fam' ? '训练方法家族' : 'RNG seed') + '，底图 = F 地形（蓝低 → 红高））' : '（蓝低 → 红高）'));
  /* §E442 页脚拆**两行**（用户 10-08：「超级长的第二行就可以分成两行显示」）：第一行 = 这张图怎么读（行/轴/颜色口径），
   *   第二行 = 边与手势。⚠ 原来那个"量宽缩字"是**死代码**：先 measureText 算出该缩到几号，紧接着下一句又把字体写回 12px
   *   ⇒ 缩字从未生效，超长那行是被画布右缘**截掉**的（她截图里"· 滚轮 = 横轴"整段看不见就是这件事）。 */
  var foot2 = (st.edges === 'off' ? '父边已关掉（开关在工具栏「连线」）' : '淡蓝实线 = 父身份可证（哈希 ‖ 种子文件同权重）· 淡蓝虚线 = 只按名字/时间推出来的（共画了 ' + NEDG + ' 条父边'
      + (st.edges === 'hash' ? ' ‖ 只身份可证那一级' : '') + '）') +
    /* §E378 接替边必须自己在图上说一句它是什么：它和血统边画在同一片地方，而两者的意思完全不同
       （'hash' 那一档不画它，所以那句计数跟着 NCHAIN 走，为 0 就整段不出现）*/
    (NCHAIN ? ' ‖ 淡蓝虚线 = 不确定来源（路径推断 ' + NINF + ' + 槽位接替 ' + NCHAIN + ' + 倒挂 ' + NBACK + '），不是身份可证的血统' : '') +
    /* §E487：融合粒的第二父走紫色实线 —— 它是"两枚的权重平均"里的那一条，不是热启动 */
    (NSOUP ? ' ‖ 红线 = 融合父边 ' + NSOUP + ' 条（这枚 = 两粒的权重平均 ‖ 两条红边各自连一个父，不是热启动）' : '') +
    /* §E442：RUNNER-BASE 那批边现在**画得出来了**（收到时间轴最左那颗灰菱形），所以这句话从原来的"这条边上不画"
       改成说清它连的是什么。'hash'/'off' 两档不画 ⇒ 计数为 0 就整段不出现，不许承诺图上没有的东西。 */
    (NRBASE ? ' ‖ 另有 ' + NRBASE + ' 枚的父指针解析不到图上任何一枚（见页内那条血统边判据）' : '') +
    /* §E333 页脚是单行 fillText（画布不折行），所以两态**各说各的手势**而不是把两段接起来：
       立体态把"滚轮/Shift+滚轮/拖动"换成"右键压扁错切"—— 那三件在二维态已经说过，长度也就不会顶出右缘。
       （§E331 立体态必须自己说清"高度是哪把尺"：颜色按秩铺、几何仍是线性，不写就会被当成同一件事。画布不认 markdown ⇒ 这句里不许带 *）*/
    (T3 > 0.5 ? ' · 立体 = 原地按 F 抬起（与颜色的按秩铺色不同尺）· 立柱 = 回本行那一格 · 右键拖动 = 压扁/错切'
              : ' · 滚轮 = 横轴（时间）· Shift+滚轮 = 纵轴（家族行）· 拖动 = 平移') +
    ' · 缩放 ×' + TKX.toFixed(2) + ' ‖ ×' + TKY.toFixed(2) +
    /* §E363：倒挂边的条数必须在图上自己说清，否则读图的人只会看到"现役生了两星期前的包" */
    (NBACK ? ' · ⛔ 时间倒挂的父边 ' + NBACK + ' 条 = 按路径反查"今天的槽主"造出来的假血统（lineage.mjs §E367 应已退回，出现即守卫漏了来路）' : '');
  /* §E431：底部小字从**页面最左侧**起（原来跟着 padL 缩进）‖ §E436：13px 偏大 ⇒ 12px。
   *   每行各自量宽：短了按 12px，长了才缩（缩到 9px 为止），不再出现"算完缩又写回原字号"那种死自适应。 */
  function footLine(txt, y) {
    g.font = (12 * devicePixelRatio) + 'px system-ui,sans-serif';
    var fw = g.measureText(txt).width / devicePixelRatio, avail = (w - 20) / devicePixelRatio;
    if (fw > avail) g.font = Math.max(9, Math.round(12 * avail / fw) * devicePixelRatio) + 'px system-ui,sans-serif';
    g.fillText(txt, 10 * devicePixelRatio, y); }
  /* §E331 图底三条字必须各占一行：日期刻度在 h − padB + 16（= h−50·dpr），页脚两行在 h−32 / h−14·dpr。
   *   §E442 删掉了原来那条琥珀色的「另有 N 枚的父 = RUNNER-BASE ⇒ 这条边上不画」—— 那批边现在画得出来了，
   *   它的话已经并进第二行（"灰雾 = RUNNER-BASE 覆写边 N 条…"），留两条反而逼着日期刻度与注挤在同一 y。 */
  footLine(foot1, h - 32 * devicePixelRatio);
  footLine(foot2, h - 14 * devicePixelRatio);
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
  /* E393 DS（丙·投影）：取景系数**保持原值 0.90/0.86**。
   *   ⚠ 中途我试过留边距（0.74/0.70）想让板的边界露出来 —— 那是反的：等于把铺满放大（用户 10-08 指出）。
   *   真正该做的是把场的画布扩大（网格边距 10% → 35%，见 buildNB），让板自己的边缘落到视野之外。 */
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
    if (!VIS[i]) continue;      /* §E338 批次过滤：不进投影表 ⇒ 不画、不排深度、不进命中 */
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
    var rr = dotR(d, st.k);      /* §E338 半径 = 名次 × 缩放（原来冠军固定 6px、其余按 k 微涨） */
    g.beginPath(); g.arc(pr[i].x, pr[i].y, rr, 0, 6.284);
    g.fillStyle = colOf(d, fr); g.fill();
    if (d.id === st.sel) { g.globalAlpha = 1; g.strokeStyle = '#ffd166'; g.lineWidth = 2 * devicePixelRatio;
      g.beginPath(); g.arc(pr[i].x, pr[i].y, rr + 5 * devicePixelRatio, 0, 6.284); g.stroke(); }
    else if (st.cmp.indexOf(d.id) >= 0) { g.globalAlpha = 1; g.strokeStyle = '#7fd1ff'; g.lineWidth = 1.6 * devicePixelRatio;
      g.beginPath(); g.arc(pr[i].x, pr[i].y, rr + 3.4 * devicePixelRatio, 0, 6.284); g.stroke(); }
    /* §E449 这里必须**重新起一条路径**再描墨环：上面选中环 / 对比环各自 beginPath 过，当前路径已经变成
     *   半径 rr+5 的那一圈，直接 stroke 等于**把黄色选中环用墨色重描一遍** ⇒
     *   立体态里选中一枚冠军，画布上只剩墨环、没有黄环（页内那条「指针往返」扫整张画布数到 0 颗环色像素，
     *   就是这件事：它报的不是"判据坏"，是**用户点中冠军之后看不见选中反馈**）。
     *   顺带原来那圈点边也被挪到了 rr+5 上（选中的冠军比没选中的多一圈外移的墨边）。 */
    if (isC && al > 0.5) { g.beginPath(); g.arc(pr[i].x, pr[i].y, rr, 0, 6.284);
      g.strokeStyle = st.ink; g.lineWidth = 1.5; g.stroke(); }
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
    putLabel((P[ls[i].i].id === 'SHIPPED-Ldemo' ? '★' : '') + labOf(P[ls[i].i]), pp[0], pp[1], !!P[ls[i].i].lin, false, ls[i].i); }
  if (st.q) for (i = 0; i < N; i++) if (String(P[i].id).toLowerCase().indexOf(st.q) >= 0 && scr[i]) {   /* §E453 与 labelSet 那一处必须同一条规则 */
    g.beginPath(); g.arc(scr[i][0], scr[i][1], 11 * st.size, 0, 6.284); g.strokeStyle = st.ink; g.lineWidth = 2; g.stroke(); }
  g.fillStyle = st.dim; g.font = (12 * devicePixelRatio) + 'px system-ui,sans-serif';
  g.fillText(st.elev < 0.5
    ? '滚轮 = 以光标为中心缩放 · 左键拖动 = 平移 · 底色 = F（蓝 = 低 → 红 = 高 · 针 = 现役那一档，它在库内第 ' + Math.round(incPct()) + ' 百分位）· 绿环 = 过了训练侧五道检查 · 点一枚 = 选中 · 缩放 ×' + st.k.toFixed(2)
    : '左键拖动 = 平移 · 右键拖动 = 旋转 · 滚轮 = 缩放 · 柱高 = ' + (st.goodTop ? 'F − F_min（越高越好）' : 'F_max − F（越低越好 = 冠军在阱底）') + ' · 绿环 = 过了训练侧五道检查',
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
  /* E427 DS（乙·用户批准）：**字符串键桶 → 扁平 CSR 网格 + 预取场值**。
   *   原来每个格点要拼 27 个字符串键做哈希查找（128 格 ⇒ 2.1M × 27 = 5600 万次拼接），真机实测单次重建 1175ms，
   *   这是主因之一。数学**逐字不变**：仍是同 27 个桶、同一个 exp 核、同一点序与累加顺序（⇒ 结果应当逐字节相同）。 */
  var nbc = nb[0] * nb[1] * nb[2];
  var cellStart = new Int32Array(nbc + 1), cellItem = new Int32Array(N), bidx = new Int32Array(N);
  for (i = 0; i < N; i++) {
    var b0 = Math.floor((a[i] - loA) / BK), b1 = Math.floor((b[i] - loB) / BK), b2 = Math.floor((c[i] - loC) / BK);
    if (b0 < 0) b0 = 0; else if (b0 >= nb[0]) b0 = nb[0] - 1;
    if (b1 < 0) b1 = 0; else if (b1 >= nb[1]) b1 = nb[1] - 1;
    if (b2 < 0) b2 = 0; else if (b2 >= nb[2]) b2 = nb[2] - 1;
    bidx[i] = (b0 * nb[1] + b1) * nb[2] + b2; cellStart[bidx[i] + 1]++;
  }
  for (i = 0; i < nbc; i++) cellStart[i + 1] += cellStart[i];
  var _cf = new Int32Array(nbc);
  for (i = 0; i < N; i++) { cellItem[cellStart[bidx[i]] + _cf[bidx[i]]++] = i; }
  var VF = new Float64Array(N);
  for (i = 0; i < N; i++) VF[i] = vAt(i);   /* 内层不再重复调 vAt 闭包 */
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
  var p0 = nV ? sumV / nV : 0.15, base = nHas ? nOk / nHas : 0.15, M0 = DM0, maxF = 0;
  /* E400 DS（用户 10-08：曲面经常过大、甚至整个在没有点的地方；而点很多的地方反被未过线点干扰保不住）：
   *   病根是这两行：① 空处 den→0 时直接 return p0（全库均值）⇒ 虚空里照样有值；
   *   ② M0=5 的收缩让「一小簇过线点」被拉向全库均值 ⇒ 局部证据被摊薄。
   *   修法：**平滑密度门** —— v' = p0 + (v − p0)·min(1,(den/dref)²)。den 是这一格附近真实的核质量，
   *   dref 取「典型点自己那儿的核质量」的 0.6 倍 ⇒ 真簇 ⇒ 门≈1（原值不动）；孤立一枚 ⇒ 门≈0 ⇒ 值回 p0
   *   （'ok' 场 p0≈底率 < 阈值 ⇒ 虚空不再成壳；'pot' 场 p0=平均势 ⇒ 同理）。**平滑**门不会像硬截断那样凭空生出一道墙。 */
  var DMED = 0;
  /* self 传索引 = 把自己剔掉（leave-one-out）⇒ 读覆盖/纯度不吹；传 -1 = 普通格点 */
  function at(X, Y, Z, self) {
    var bi0 = Math.floor((X - loA) / BK), bj0 = Math.floor((Y - loB) / BK), bk0 = Math.floor((Z - loC) / BK);
    var num = 0, den = 0, den2 = 0;
    for (var di = -1; di <= 1; di++) { var _ii = bi0 + di; if (_ii < 0 || _ii >= nb[0]) continue;
      for (var dj = -1; dj <= 1; dj++) { var _jj = bj0 + dj; if (_jj < 0 || _jj >= nb[1]) continue;
        for (var dk = -1; dk <= 1; dk++) { var _kk = bk0 + dk; if (_kk < 0 || _kk >= nb[2]) continue;
      var _ci = (_ii * nb[1] + _jj) * nb[2] + _kk, _s = cellStart[_ci], _e = cellStart[_ci + 1];
      for (var q = _s; q < _e; q++) { var m = cellItem[q];
        if (m === self) continue;
        var vm = VF[m]; if (!isFinite(vm)) continue;
        var ex = X - a[m], ey = Y - b[m], ez = Z - c[m], dd = ex * ex + ey * ey + ez * ez;
        if (dd > R * R) continue;
        var gv = Math.exp(-dd / s2); den += gv; den2 += gv * gv; num += gv * vm; } } } }
    ATDEN = den;   /* E400 DS：把这次的核质量带出来 ⇒ 密度门用（不改 at 的签名，调用点零改动）*/
    /* E401 DS（A 结构修法）：**没证据 ⇒ 0**，不再回落到 p0。
     *   旧式子把虚空钉在 p0 = 全库过线率（今天 20.5%）⇒ 阈值一旦 ≤ p0，整片虚空也算壳内 ⇒
     *   21%→20% 那一跳就是这么来的（用户 10-08 实测）。基准归 0 后，任何 >0 的阈值都不会把虚空算进去。 */
    if (den <= 1e-6) return 0;
    var ess = den * den / (den2 || 1e-9);
    return (ess * (num / den)) / (ess + M0);   /* E401：向 0 收缩（没证据 = 0），不再向底率收缩 */
  }
  /* 预扫（只 917 次，便宜）：每枚自己那儿的核质量 ⇒ 取中位数当 dref 的基准 */
  var _d = []; for (i = 0; i < N; i++) { at(a[i], b[i], c[i], i); if (ATDEN > 0) _d.push(ATDEN); }
  _d.sort(function (x, y) { return x - y; }); DMED = _d.length ? _d[_d.length >> 1] : 1;
  var DREF = 0.6 * DMED * DGATE;
  for (k = 0; k < dims[2]; k++) for (j = 0; j < dims[1]; j++) for (i = 0; i < dims[0]; i++) {
    var fv = at(loA + i * dA, loB + j * dB, loC + k * dC, -1);
    var _dt = DREF > 0 ? ATDEN / DREF : 1; if (_dt < 1) { _dt *= _dt; } if (_dt < 1) fv = fv * _dt;   /* E401：门 = 纯衰减（基线已是 0）*/
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
/* E421 DS（真机实测 1.2s/帧的真身）：isoSigma() 是 **O(N²)**（917² ≈ 84 万次距离 + 内层 heap.sort），
 *   而它**每帧**都被 isoEnsure() 调一次 ⇒ 一帧白烧 ~1.2 秒（GL 三段计时全 0、ISOBUILDS 只有 7 ⇒ 与此吻合）。
 *   它只依赖装载时算好的静态显示坐标（P[i].ax/by/cz）⇒ **本该只算一次**，这里加会话级 memo。 */
var SIGCNT = 0, SIGVAL = 0;
function isoSigma() {
  var _stamp = N + '|' + (P[0] ? P[0].ax : 0) + '|' + (P[N - 1] ? P[N - 1].cz : 0);
  if (SIGVAL && SIGCNT === _stamp) return SIGVAL;
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
  SIGCNT = _stamp; SIGVAL = pct(nn, .5) || 1;
  return SIGVAL;
}
function isoEnsure() {
  var _tS = performance.now();
  var sg = isoSigma();
  SIGMS = performance.now() - _tS;   /* E422：算签名花了多少 */
  if (ISO && ISO.sig === sg && ISO.thr === st.isoT && ISO.gn === st.isoGN && ISO.field === st.isoField) return ISO;
  /* E423 DS：**指名道姓**记录这次为什么重建**（空闲时四个条件 sig/thr/gn/field 都该稳定）。
   *   顺带把 SIGMS/BUILDMS 在该帧重建时才是当帧值；读数那边每帧清零，避免拿陈旧值判读。 */
  MISSWHY = ISO ? ((ISO.sig === sg ? '' : 'sig') + (ISO.thr === st.isoT ? '' : '|thr') +
    (ISO.gn === st.isoGN ? '' : '|gn') + (ISO.field === st.isoField ? '' : '|field') || 'all-equal?') : 'noISO';
  ISOBUILDS++;   /* E419 DS：建壳次数 —— 用户真机实测 1.2s/帧、而每帧只有 3073 次画布调用(≈1.5ms)
                  *   ⇒ 1.2 秒必然花在"每帧重算"上；头号嫌疑就是这里被反复重建（GN=128 建一次 ~0.6~1.5s，量级吻合）。 */
  var t0 = performance.now(); ISO = isoBuild(sg, st.isoT, st.isoGN, st.isoField); ISO.ms = performance.now() - t0;
  BUILDMS = ISO.ms;   /* E422：真重建花了多少 */
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
  /* §E312 壳的配色跟着场走：绿 = 过线概率场，琥珀 = 势场。
   *   两种场共用一套壳代码，但"绿"在这个页面上已经被绿环定义成"过线" ⇒ 势场再画绿就是撒谎。*/
  var pot = m.field === 'pot';
  var fillC = pot ? 'rgba(224,177,60,.075)' : 'rgba(57,217,138,.085)';
  var lineC = shell ? (pot ? 'rgba(224,177,60,.6)' : 'rgba(57,217,138,.55)') : (pot ? 'rgba(224,177,60,.24)' : 'rgba(57,217,138,.22)');
  /* E403 DS（D-3 的第一刀，量出来的）：原来**逐面** beginPath→fill→stroke ⇒ 96 格 4868 面 = 上万次画布调用/帧
   *   （E402 实测稳态 23.5ms/帧，且开不开 GPU 一样 ⇒ 成本全在这条 CPU path 填充上）。
   *   线框颜色是**统一**的 ⇒ 整张壳合并成**一个 Path2D**，fill/stroke 各一次即可；线框与绘制顺序无关
   *   ⇒ 连那道 4868 元素的深度排序与每面一个对象分配都可以省掉。
   *   ⚠ 半透壳的**填充**在旧路里靠重叠累积 alpha（有层次感），合并成一个 path 后是"并集填一次"⇒ 会变淡一点。
   *   ★ **实测结论：合并这条路是错的**（E403）：96 格 4868 面 **合并 102.78 ms/帧 vs 逐面 23.54 ms/帧**（52 格 25.12 vs 18.06）。
   *     原因：大 Path2D 的 fill 要算并集/绕数、stroke 要整条 tessellate ⇒ Canvas 对超大 path 的代价远高于逐个小面。
   *     ⇒ 默认走逐面（BATCHISO=0）。要省 CPU 只能换后端（WebGL2 一次上传 VBO、逐帧只换矩阵），不是"合并 path"。 */
  /* E404 DS：GL 分支 —— 面一次性上传，逐帧只改 uniform（把光栅化从 CPU 挪走）。失败即回落 2D 路。 */
  if (!GLPROBE) { GLPROBE = 1; console.log('PROBE drawIso GLISO=' + GLISO + ' GLMon=' + GLM.on() + ' quads=' + m.quads.length); }
  if (GLISO) { try {   /* E418：**把被 draw() 的 catch 吞掉的异常揪出来** —— 探针已证明 GLISO=1 进了分支，
                          *   却三个出口都没留痕 ⇒ 只能是这里抛异常、当场中断、被静默吞掉。 */
    if (!GLM.on() && !GLM.init(cv)) { GLPATH = 2; GLFAILS++;   /* E417b：失败只记数、本帧回落 2D，下一帧继续试（原来这里写 GLISO = 0 ⇒ 首帧一旦失败就永久走老路）*/
      (function () { var _n = document.getElementById('perfru'); if (_n && _n.dataset) _n.dataset.path = 'glfail'; })();
      console.log('GL 起不来（webgl2 上下文/着色器失败）⇒ 本帧走 2D 老路'); }
    if (GLISO && GLM.on()) {
      var _dpr = devicePixelRatio || 1;
      /* E409 DS：**用画布自己的尺寸**。drawIso 收到的 w/h 不是画布尺寸（是板的像素尺度，实测 756x125
       *   ⇒ 视口比画布矮 85px ⇒ 壳大半画到视口外，这才是"看不见"的真根因）。 */
      var CW = cv.width, CH = cv.height;
      var _tR = performance.now();
      GLM.resize(CW, CH, CW / _dpr, CH / _dpr);
      GLRESIZE = performance.now() - _tR;
      /* E405 DS：**几何缓存**。原来每帧都重建 5k 个投影点 + 三个类型数组 ⇒ 这部分 CPU 成本顶掉了换后端
       *   的收益（E404 实测 GL 25.76 vs 2D 26.18 ms/帧）。相机/网格/画布任一变了才重算重传；否则逐帧只 drawElements。 */
      var _sig = [cb.r[0], cb.r[1], cb.r[2], cb.u[0], cb.u[1], cb.u[2], cb.f[0], cb.f[1], cb.f[2],
        st.ox3, st.oy3, base, w, h, m.quads.length, m.gn, m.thr, m.field].join('|');
      if (_sig !== GLSIG) {
      GLSIG = _sig;
      var _tG = performance.now();
      var nq = m.quads.length, vv = new Float32Array(nq * 8), tri = new Uint32Array(nq * 6), lin = new Uint32Array(nq * 8);
      for (var gi = 0; gi < nq; gi++) {
        var gq = m.quads[gi];
        for (var gk = 0; gk < 4; gk++) {
          var gp = prj(gq[gk][0], gq[gk][1], gq[gk][2]);
          /* E412 DS：**转到裁剪空间（NDC [-1,1]）** —— 着色器就是 gl_Position = vec4(p, 0, 1)，
           *   原来直接塞像素坐标（如 389,78）⇒ 全在视锥外 ⇒ 一个像素都没画出来（bisect 的 gltest=1
           *   用不透明红画壳也无变化，证明问题不在颜色而在几何）。 */
          vv[gi * 8 + gk * 2] = gp[0] / CW * 2 - 1;
          vv[gi * 8 + gk * 2 + 1] = (CH - gp[1]) / CH * 2 - 1;
        }
        var b0 = gi * 4;
        tri[gi * 6] = b0; tri[gi * 6 + 1] = b0 + 1; tri[gi * 6 + 2] = b0 + 2;
        tri[gi * 6 + 3] = b0; tri[gi * 6 + 4] = b0 + 2; tri[gi * 6 + 5] = b0 + 3;
        for (var g4 = 0; g4 < 4; g4++) { lin[gi * 8 + g4 * 2] = b0 + g4; lin[gi * 8 + g4 * 2 + 1] = b0 + ((g4 + 1) % 4); }
      }
      var _tU = performance.now();
      GEOBUILD = performance.now() - _tG;
      GLM.upload(vv, tri, lin);
      GLBUILD = performance.now() - _tU;
      }   /* E405：/几何缓存 */
      var fRG = pot ? [0.878, 0.694, 0.235, GFA] : [0.224, 0.851, 0.541, GFA];   /* E428：alpha 走旋钮（GL 无重叠累积 ⇒ 要比 2D 的 .085 更高） */
      var lRG = shell ? (pot ? [0.878, 0.694, 0.235, GLA] : [0.224, 0.851, 0.541, GLA])
                      : (pot ? [0.878, 0.694, 0.235, GLA * 0.44] : [0.224, 0.851, 0.541, GLA * 0.4]);
      GLDREW++; GLPATH = 1;
      (function () { var _n = document.getElementById('perfru'); if (_n && _n.dataset) _n.dataset.path = 'gl'; })();   /* E413：证明这一帧真的走了 GL 路（用来校验仪表，别再拿"对不上"的数下结论） */
      var _tD = performance.now();
      GLM.draw(fRG, lRG);
      GLDRAW = performance.now() - _tD;
      /* E411 DS：**一次贴图**进主画布 ⇒ 壳落在 2D 绘制序列里（先壳后点，顺序天然正确），
       *   层叠/z-index/命中测试全都不涉及；每帧那 ~29k 次调用（壳占 70%）变成这 1 次 drawImage。 */
      var _tB = performance.now();
      g.drawImage(GLM.canvas(), 0, 0);
      GLBLIT = performance.now() - _tB;
      return m;
    }
  } catch (eGL) { GLPATH = 3; GLERR = String(eGL && eGL.message || eGL);
    console.log('GL 分支抛异常（原来被 draw() 静默吞掉）：' + GLERR); }
  } else if (GLM.on()) { GLM.clear(); }
  if (!BATCHISO) {
    var q = [];
    for (var i0 = 0; i0 < m.quads.length; i0++) {
      var v0 = m.quads[i0], p0 = [];
      for (var k0 = 0; k0 < 4; k0++) p0.push(prj(v0[k0][0], v0[k0][1], v0[k0][2]));
      q.push({ p: p0, d: (p0[0][2] + p0[1][2] + p0[2][2] + p0[3][2]) / 4 });
    }
    q.sort(function (a, b) { return b.d - a.d; });
    for (var i1 = 0; i1 < q.length; i1++) {
      g.beginPath(); g.moveTo(q[i1].p[0][0], q[i1].p[0][1]);
      for (var k1 = 1; k1 < 4; k1++) g.lineTo(q[i1].p[k1][0], q[i1].p[k1][1]);
      g.closePath();
      if (!shell) { g.fillStyle = fillC; g.fill(); }
      g.strokeStyle = lineC; g.lineWidth = 1 * devicePixelRatio; g.stroke();
    }
    return m;
  }
  var pth = new Path2D();
  for (var ii = 0; ii < m.quads.length; ii++) {
    var vq = m.quads[ii];
    for (var kk = 0; kk < 4; kk++) { var P3 = prj(vq[kk][0], vq[kk][1], vq[kk][2]);
      if (kk === 0) pth.moveTo(P3[0], P3[1]); else pth.lineTo(P3[0], P3[1]); }
    pth.closePath();
  }
  if (!shell) { g.fillStyle = fillC; g.fill(pth); }
  g.strokeStyle = lineC; g.lineWidth = 1 * devicePixelRatio; g.stroke(pth);
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
    var _tIso = performance.now();
    isoInfo = drawIso(cx, cy, base, w, h, cb, st.iso === 2);
    ISOMS = performance.now() - _tIso;   /* E420：drawIso 总耗时 */
  }
  var pr = [];
  for (i = 0; i < N; i++) {
    if (!VIS[i]) continue;      /* §E338 批次过滤 */
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
    var rr3 = dotR(d, st.zoom3);
    g.beginPath(); g.arc(pr[i][0], pr[i][1], rr3, 0, 6.284);
    g.fillStyle = colOf(d, fr); g.fill();
    if (d.lin && al > 0.5) { g.strokeStyle = st.ink; g.lineWidth = 1.5; g.stroke(); }
    if (d.id === st.sel) { g.strokeStyle = '#ffd166'; g.lineWidth = 2 * devicePixelRatio;
      g.beginPath(); g.arc(pr[i][0], pr[i][1], rr3 + 5 * devicePixelRatio, 0, 6.284); g.stroke(); }
    scr[pr[i][6]] = [pr[i][0], pr[i][1]];
    g.globalAlpha = 1;
  }
  labelReset();
  var ls = labelSet();
  for (i = 0; i < ls.length; i++) { var pp = scr[ls[i].i]; if (!pp) continue;
    putLabel((P[ls[i].i].id === 'SHIPPED-Ldemo' ? '★' : '') + labOf(P[ls[i].i]), pp[0], pp[1], !!P[ls[i].i].lin, false, ls[i].i); }
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
      ' · 帧 ' + FRMS.toFixed(1) + 'ms（均值 ' + (FRMA.length ? (FRMA.reduce(function (x, y) { return x + y; }, 0) / FRMA.length).toFixed(1) : '-') +
      'ms / ' + isoInfo.quads.length + ' 片 = ' + (isoInfo.quads.length ? (1000 * FRMS / isoInfo.quads.length).toFixed(1) : '-') + 'µs/片）' +
      '% · 场峰值 ' + (100 * isoInfo.maxF).toFixed(0) + '% ⇒ 阈值拖过这个数必然空壳' : ''),
    14 * devicePixelRatio, h - 12 * devicePixelRatio);
}

function draw() { try { var _ft0 = performance.now(); drawBody();
  FRMS = performance.now() - _ft0; FRMA.push(FRMS); if (FRMA.length > 20) FRMA.shift();
  /* E402 DS：**按需**的机器可读仪表（#perf=1 才建，display:none ⇒ 不给用户添浮字）。
   *   为什么必须有：帧时那条读数画在画布上，无头复核读不到 DOM ⇒ 量不了就只剩猜。 */
  if (PERFON) { var _pe = document.getElementById('perfru');
    if (!_pe) { _pe = document.createElement('pre'); _pe.id = 'perfru'; _pe.style.display = 'none'; document.body.appendChild(_pe); }
    var _av = FRMA.length ? (FRMA.reduce(function (x, y) { return x + y; }, 0) / FRMA.length) : 0;
    FRN++; _pe.dataset.gliso = String(GLISO); _pe.dataset.frn = String(FRN);
    var _o1 = 0, _ok2 = ''; for (var _k2 in OPC) { _o1 += OPC[_k2]; _ok2 += _k2 + '=' + OPC[_k2] + ' '; }
    _pe.textContent = 'FRMS=' + FRMS.toFixed(2) + ' AVG=' + _av.toFixed(2) + ' N=' + FRMA.length + ' MODE=' + st.mode
      + ' FACES=' + (ISO && ISO.quads ? ISO.quads.length : 0) + ' GN=' + st.isoGN + ' ISOBUILDS=' + ISOBUILDS + ' MISSWHY=' + MISSWHY + ' GEOBUILD=' + GEOBUILD.toFixed(1) + ' GLRESIZE=' + GLRESIZE.toFixed(1) + ' SIGMS=' + SIGMS.toFixed(1) + ' BUILDMS=' + BUILDMS.toFixed(1) + ' ISOMS=' + ISOMS.toFixed(1) + ' GLBUILD=' + GLBUILD.toFixed(1) + ' GLDRAW=' + GLDRAW.toFixed(1) + ' GLBLIT=' + GLBLIT.toFixed(1) + ' GLISO=' + GLISO + ' GLPATH=' + GLPATH + ' GLDREW=' + GLDREW
      + ' **OPSF=' + _o1 + '** ' + _ok2;
    _pe.dataset.path = _pe.dataset.path || '2d';
    /* E425 DS：**清零必须在打印之后** —— 我上一版把它写在 textContent 之前，
     *   结果"量到的值先被清零、再被打印" ⇒ 读数全是 0.0（连续两轮被这个假数误导）。 */
    if (FRN > 1) { SIGMS = 0; BUILDMS = 0; GEOBUILD = 0; GLRESIZE = 0; }
    for (var _k3 in OPC) OPC[_k3] = 0;   /* 每帧清零 ⇒ OPSF = 这一帧真实画了多少次 */
  }
  } catch (e) {
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
  /* 图例的内容是**每帧重画**的（口径不同行数不同），所以冠军序列那条"让开图例"的位置也得每帧跟一次；
   *   只在 paintSide 里算一次会拿到的还没撑开的旧高度 ⇒ 实测压住图例下面两行字。
   *   这里只挪 top，不重建 DOM（重建 = 每帧重画几十个按钮 + 一张表，拖动会卡）。 */
  if (st.side) { var _sp = document.getElementById('side'), _lg = document.getElementById('legend');
    if (_sp && _lg && _sp.style.display !== 'none') _sp.style.top = (_lg.offsetTop + _lg.offsetHeight + 10) + 'px'; }
  var n = 0; for (var kk in st.hi) if (st.hi[kk]) n++;
  document.getElementById('stat').textContent = N + ' 种打法（同一份权重只画一枚 ‖ 面板原始 ' + NRAW + ' 行）· 投影 t-SNE（轴无固定含义）· 真当过线上冠军 ' + P.filter(function (d) { return d.lin; }).length +
    ' 枚 · 现役的子代 ' + P.filter(function (d) { return d.kin === '续训现役'; }).length +
    ' 枚 · 父链 ' + P.filter(function (d) { return d.kin === '父链'; }).length + ' 枚 · T = ' + st.T.toFixed(2) + ' · 颜色 = ' + (st.color === 'F' ? 'F（线上口径势）' : st.color === 'seed' ? 'RNG seed（旧口径）' : st.color === 'gl' ? '长程广度 G(long)' : st.color === 'pm' ? ('上槽体检（实测 ' + NPRM + ' 枚）') : st.color === 'duel' ? ('对现役决斗（实测 ' + NDUEL + ' 枚）') : st.color === 'hp' ? ('页面口径夺1率（实测 ' + NEPS + ' 枚）') : st.color === 'de' ? ('部署脆弱性 Δε（实测 ' + NEPS + ' 枚 · 脆 ' + NBRIT + '）') : st.color === 'sc' ? ('当选键 sc − 现役（实测 ' + NSEL + ' 枚 · 判据内赢 ' + NSELUP + ' · 判不动 ' + NSELSOFT + '）') : '训练方法家族') +
    (st.mode === 'map' || st.mode === 'tree' ? ' · ' + (st.elev < 0.5 ? '平面' : '立体') : '') +
    /* §E371 窗口不是"关着"的状态就必须报出来：只画了 312 枚却写着"901 枚候选"，读图人会把一张局部图当全库。
     *   现役被切掉时额外点名 —— 那时图上的绿红分界（rel 档）与色带上的针都指向一个**不在图上**的东西。 */
    (winFull() ? '' : ' · ⚠ F窗口 ' + winLo().toFixed(3) + '…' + winHi().toFixed(3) + ' ⇒ 只画 ' + nWin() + '/' + N + ' 枚'
      + (inWin(INC) ? '' : ' ‖ **现役在窗外（已隐藏）**')) +
    (n ? ' · 高亮 ' + n + ' 个家族' : '');
}
/* ⑥ 所有重绘走 rAF 合并：一帧最多画一次（拖动/滑杆连续事件下这是"卡死"的第二条来源）*/
var queued = false;
function req() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; draw(); }); }

function paintLegend(fr) {
  var lg = document.getElementById('legend'); lg.innerHTML = '';
  /* §E373 色标两端的**值**由 colBand 说了算（窗口态 = 窗内两端）⇒ 图例必须读同一份，
   *   否则就是"图上铺一套色、旁边写着另一套数"（这条本仓已经吃过几次，见 §E347 的教训）。 */
  var CB = colBand() || { lo: fr[0], hi: fr[1], mode: 'lib' };
  /* §E349 DS（用户 10-06：「文字标记横着占了一大串，适当搞几个换行」）：容器收窄 + 允许换行，长句自己折成几行；色标条保持原尺寸（用户的蓝端曾被截掉过一回，已回滚）。 */
  /* §E349 DS：不要自动换行（用户否掉）—— 改成一行一句、按含义自己断行，能删的就删。 */
  lg.style.maxWidth = '260px'; lg.style.lineHeight = '1.35';
  var BARH = 150;   /* 出厂高度；§E441 在排版完成之后按文字列高收（见本函数末尾），所以画条这件事抽成函数好重画 */
  var c = document.createElement('canvas'); c.style.width = '18px'; c.style.height = BARH + 'px'; var cg = c.getContext('2d');
  function barDraw(Hcss) {
    c.width = 18 * devicePixelRatio; c.height = Hcss * devicePixelRatio;
    for (var i = 0; i < Hcss * devicePixelRatio; i++) { var ltt = 1 - i / (Hcss * devicePixelRatio);
      /* §E347：「F」档（含默认的家族着色 + 底图）用回 LUT（蓝 = 地板 → 灰 = 库内中位 → 红 = 好），
       *   只有「rel」档才换成分散带 LUTF。原来这里写死"F 用发散带"，而底图与这条带必须同一条 LUT，
       *   否则就是"图例说一套、图画另一套"（§E338 那版还额外用一行"这一档不参与着色"把矛盾糊掉了）。*/
      var rgb = st.color === 'rel' ? rampRGBF(ltt) : rampRGB(ltt);
      cg.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'; cg.fillRect(0, i, 18 * devicePixelRatio, 1); }
    /* §E353：只要这条带画的是**底图那条 LUT**（fam / seed / F / rel 四种），针就该在。
     *   原来只在 F / rel 两档画，而 fam/seed 的图例与页脚都写着"黄针 = 现役那一档" ⇒ **文案承诺、图上没有**
     *   （这条是写页内自检时抓出来的：断言去数黄像素，数到 0 个）。*/
    if (st.color === 'F' || st.color === 'rel' || st.color === 'fam' || st.color === 'seed') {
      /* 现役那根针：不画出来，"现役在哪"这句话在 18px 宽的条上找不到位置。
       *   ⚠ 位置**按当前档现算**，不许写死 73/150 —— 那是"分界在正中"的假设，而 F 档的分界在库内第 82 百分位。*/
      var npos = st.color === 'rel' ? 0.5 : fCol(Fv(INC));
      var ny = Math.round((1 - npos) * Hcss * devicePixelRatio);
      cg.fillStyle = '#0d1420'; cg.fillRect(0, ny - 2 * devicePixelRatio, 18 * devicePixelRatio, 4 * devicePixelRatio);
      cg.fillStyle = '#ffd166'; cg.fillRect(0, ny - 0.75 * devicePixelRatio, 18 * devicePixelRatio, 1.5 * devicePixelRatio); }
  }
  barDraw(BARH);
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
    : st.color === 'hp' ? ('页面 1st 高 ' + EPR()[1].toFixed(1) + '%（红）')
    : st.color === 'de' ? ('Δε +' + 6 + 'pt（红 = 脆）')
    : st.color === 'sc' ? ('当选键 +8pt（绿 = 比现役强 · 实测 ' + NSEL + ' 枚 ‖ 判据内赢 ' + NSELUP + '）')
    : (st.color === 'fam' || st.color === 'seed') ? ('（点色 = ' + (st.color === 'fam' ? '家族' : 'RNG seed')
      + ' ‖ 底图 = F 地形（蓝 = 低 → 红 = 高）· 现役 = 库内第 ' + Math.round(incPct()) + ' 百分位（' + splitSets().up.length + ' 枚在它之上）')
    : st.color === 'rel' ? ('绿 = 比现役强（F 顶 ' + fr[1].toFixed(2) + '）')
    : ('红 = 好（F 顶 ' + CB.hi.toFixed(2) + (CB.mode === 'win' ? ' = 窗内最高' : '') + ' ‖ 针 = 现役）');
  /* §E432 DS（用户 10-08）：删掉 s1 那行「点色 = … ‖ 底图 = F 地形（蓝 = 低 → 红 = 高）· 现役 = 库内第 82 百分位…」——
   *   ① 顶部本来就有颜色选项框，这行是重复说明；② 它是图例**最宽**的一行（块宽内容驱动）⇒ 删了整块才会真的变窄、不再压一维图。 */
  if (st.color === 'fam' || st.color === 'seed') s1.textContent = '';
  var s2 = document.createElement('div'); s2.textContent = st.color === 'gl' ? ('G(long) 低 ' + GLR[0].toFixed(1) + '（蓝）· 闸要求 ≥3')
    : st.color === 'pm' ? ('⛔ 栽桩 ' + (NPRM - NPPASS) + ' 枚（红）· 灰 = 未测（' + (N - NPRM) + ' 枚）')
    : st.color === 'duel' ? ('⛔ 两批都输 ' + (NDUEL - NWIN - NFLIP) + ' 枚（红）· 黄 = 符号翻 ' + NFLIP + ' 枚 · 灰 = 未测（' + (N - NDUEL) + '）')
    : st.color === 'hp' ? ('页面 1st 低 ' + EPR()[0].toFixed(1) + '%（蓝）· 灰 = 未测（' + (N - NEPS) + ' 枚）')
    : st.color === 'de' ? ('Δε −6pt（蓝 = 开了探索反而强）· 白 = 不敏感 · 灰 = 未测（' + (N - NEPS) + '）‖ 脆（≥3.41）' + NBRIT + ' 枚 ‖ 吃探索（<0）' + NSTRONG + ' 枚')
    : st.color === 'sc' ? ('当选键 −8pt（红 = 落后现役）· 白 = 打平 · 橙 = 偏正但同号 <6/8（判不动 ' + NSELSOFT + ' 枚）· 灰 = 未测（' + (N - NSEL) + '）‖ 明显落后（≤−2）' + NSELDOWN + ' 枚')
    : (st.color === 'fam' || st.color === 'seed') ? ('（黄针 = 现役）')   /* §E431 用户 10-08：删掉「下 = 地板 ‖ 上 = 好」这种没用的说明，只留黄针 = 现役（顺带让整块变窄）*/
    : st.color === 'rel' ? ('红 = 不如现役（F 底 ' + fr[0].toFixed(2) + '）')
    : ('蓝 = 地板（F 底 ' + CB.lo.toFixed(2) + (CB.mode === 'win' ? ' = 窗内最低' : ' ‖ 灰 = 库内中位') + '）');
  /* §E460/§E461 轴高恢复成固定 150 之后，死空**只许用文字排版去消**（用户原话：「只换字排版」）。
   *   补的每一句都是"这个数是怎么量出来的"—— 原来只写在 CHANGELOG 与代码注释里，读图人在页面上看不到，
   *   正好填进文字列：既消死空，也不注水。⚠ 只有 hp 那句是 §E458 今晚实测出来的（换批复量摆 2.3~5.7pt）。 */
  var s3h = null;
  var LEG_NOTE = {
    fam: '底图与这条带是同一条 LUT（蓝 = 低 → 灰 = 库内中位 → 红 = 好）‖ 黄针 = 现役那一档 · 名次看点大小',
    seed: '点色换成 RNG seed，带仍是底图那条 LUT ‖ 黄针 = 现役',
    F: '针的位置按**当下窗口**里现役的铺位比算 ‖ 灰 = 库内中位，不是"不好不坏"的绝对电平',
    rel: '只有这一档把带换成分散色标：0 = 现役那一档（灰），两侧各按本侧 p90 距归一 ⇒ 超出即钉在两端',
    gl: 'G(long) = 长程自对局的技能广度，与过线判定同一道闸现跑（n=20）‖ 线 ≥3，低于 3 直接不过线',
    pm: '上槽体检 = ' + OKSRCJ + ' ‖ 灰 = 没测过，**不等于**没过',   /* §E492 样本量从表里派生，不许把数字抄在文案里 */
    duel: '配对差 A−B：同座位表、同批种子、两批各 60 局 ‖ 黄 = 两批符号翻 ⇒ 判不动，不许并进赢',
    hp: '每枚都是单批读数 ‖ 同一枚换一批实测摆 2.3~5.7pt ⇒ 颜色看水位，排序请用「对现役决斗」那档',
    de: 'Δε = 考卷（ε=0）− 页面（ε=0.2 soft）‖ 发散带 0 在正中：红 = 一开探索就掉，蓝 = 开了反而强',
    sc: 'Scd = 8 粒 seedBase 的逐种子配对差均值（不是主场那一粒）‖ 橙 = 同号但 <6/8 ⇒ 判不动',
    champ: '这一档只标历代上槽那几枚 ‖ 针 = 现役 · 绿环 = 过了训练侧五道检查'
  };
  var _nt = LEG_NOTE[st.color];
  if (_nt) { s3h = document.createElement('div'); s3h.style.color = 'var(--dim)'; s3h.textContent = _nt; }
  /* §E378 强度窗口的控制轴就贴在这条色带旁边（用户 10-07：「做到右边图例边上，用一根纵轴两个端点可拖动来表示范围」）。
   *   为什么是**并排另一根轴**而不是把柄画在这条带上：这条带的两端在窗口态读的是**窗内两端**（§E373），
   *   柄画上去就永远贴在顶和底 —— 那条带说的是"色怎么铺"，这根轴说的是"窗在库里的哪一段"，两件事不能合成一根。*/
  var wr = document.createElement('div'); wr.style.display = 'flex'; wr.style.alignItems = 'flex-start'; wr.style.gap = '6px';
  wr.style.justifyContent = 'flex-end';   /* §E432 用户 10-08：色条与 F 轴要**右对齐**（原来在 flex 行里是左对齐）*/
  /* §E434 DS（用户 10-08：「图例确实缩小了，但是还是很拉胯，左上空一大块」）：
   *   这一行是 block 级 flex，会被容器宽度（由最长文字行撑到 ~260px）拉满 ⇒ 两个小 canvas 贴右、左边空出两百多像素。
   *   做法：width 设 max-content 让它缩到内容宽，margin-left 设 auto 再把它贴到右缘 ⇒ 空白消失。 */
  wr.style.width = 'max-content'; wr.style.marginLeft = 'auto';
  /* 这张 canvas **只造一次**，之后每帧只是搬个位置：图例是每帧重建的（paintLegend 里 innerHTML=''），
   *   跟着重建就会把绑在它上面的双击/按下监听一起扔掉（§E378 第一版"每次只能拖一格"的另一半）。*/
  if (!WINAX) { WINAX = document.createElement('canvas'); WINAX.id = 'winax';
    WINAX.width = AXW * devicePixelRatio; WINAX.height = AXH * devicePixelRatio;
    WINAX.style.width = AXW + 'px'; WINAX.style.height = AXH + 'px'; winaxBind(WINAX); }
  wr.appendChild(c); wr.appendChild(WINAX);
  /* §E435 DS（用户 10-08：「两个竖杠始终得占一定高度，然后你还把文字给上下排，肯定中间得浪费一大块。
   *   不如直接把文字做成一整块排在两个竖杠左侧，并且多换行」）⇒ 改成**两列**：左列文字（限制宽度 ⇒ 自动多换行、
   *   高度与竖杠齐平），右列两个竖杠。原来 s1/wr/s2 竖着堆 ⇒ 文字只占一两行、竖杠占满高 ⇒ 中间必空一块。 */
  var _col = document.createElement('div'); _col.style.maxWidth = '150px'; _col.style.flex = '0 0 auto';
  _col.appendChild(s1); _col.appendChild(s2);
  /* §2026-10-08 DS：补两处口径说明 —— ① 底色/壳是**空处插值**（只在有点的地方有意义）；
   *   ② 壳建在三维行为轴 (x3/y3/z3) 上，不是投影坐标；③ 谱系图实线 = 父身份可证（哈希 ‖ 种子文件同权重）、虚线 = 只按名字/时间推出来的。 */
  var _cav = document.createElement('div'); _cav.style.marginTop = '4px'; _cav.style.color = 'var(--dim)'; _cav.style.maxWidth = '150px';
  _cav.innerHTML = (st.mode === 'tree')
    ? '实线 = 父身份可证<br>（包里的哈希 ‖ 种子文件同权重）<br>虚线 = 只按名字/时间推出'
    : '底色/壳只在有点的地方有意义（空处 = 插值）<br>壳建在三维行为轴上，不是投影坐标';
  _col.appendChild(_cav); if (s3h) _col.appendChild(s3h);   /* §E458 只有 hp 档多这一行（单批读数的噪声必须写在读数的地方）*/
  var _row = document.createElement('div'); _row.style.display = 'flex'; _row.style.gap = '8px';
  /* §E461 文字列与竖杠**垂直居中对齐**（原来 flex-start ⇒ 文字比条短时那条差全堆在底下，看着就是"图例下面空一块"；
   *   而 §E441 为了消这块空去砍条高，把两端刻度挤没了 —— 用户否掉）。现在条高固定 150，短了的文字上下各让一半，
   *   长的（sc / de 那两档）自然把块撑高，条仍是 150 ⇒ 纯排版，不动任何高度。 */
  _row.style.alignItems = 'center';
  _row.appendChild(_col); _row.appendChild(wr);
  lg.appendChild(_row);
  winaxDraw();
  /* §E330/§E347：这根带**到底在量什么**必须印出来 —— 不印，读图的人会把"中性灰"当成"不好不坏的绝对电平"，
   *   而 F 档的灰其实是"库里第 50% 名"、rel 档的灰才是"就是现役那一档"。两档共用一个 18px 的条，说法完全不同。*/
  /* §E445 这条 sm **故意不进** §E436 那个「·」→换行的统一收尾（那个 forEach 只管 s1/s2）：
   *   sm 是"F/rel 两档那条解释性长句"，按每个「 · 」断开会变成 6~7 行短句 ⇒ 图例框反而**长回去**
   *   （§E441 刚把竖条从 158px 收到文字实际高，F 档现在整框 202px）。
   *   留在这里说明，免得下一个人把它当"漏改"补上、再把省下来的空间吃回去。 */
  if (st.color === 'F' || st.color === 'rel') { var sm = document.createElement('div'); sm.style.color = 'var(--dim)';
    sm.textContent = st.color === 'F'
      ? ('针 = 现役 Ldemo（F ' + Fv(INC).toFixed(3) + ' = 库内第 ' + Math.round(incPct()) + ' 百分位）· 红 = 好 ‖ 蓝 = 地板 · 深浅 = '
        + (CB.mode === 'win' ? '窗内两端线性铺满（' + CB.lo.toFixed(3) + ' → ' + CB.hi.toFixed(3) + ' ‖ 等数值差 = 等色差）'
          : '当前这批点的两端线性铺满（' + CB.lo.toFixed(3) + ' → ' + CB.hi.toFixed(3) + ' ‖ 等数值差 = 等色差 ‖ 中位在 ' + (CB.med !== undefined ? fCol(CB.med).toFixed(2) : '—') + ' 那一格）') + ' · 名次看点大小')
      : '针 = 现役那一档（灰）· 绿 = 比现役强 ‖ 红 = 不如 · 深浅 = 离现役多远（两侧各按该侧 p90 距归一：绿侧 '
        + splitSets().sU.toFixed(3) + ' ‖ 红侧 ' + splitSets().sD.toFixed(3) + '，超出即钉在两端）';
    lg.appendChild(sm); }
  /* §E433 DS（用户 10-08：「图例下方那两行字纹丝不动…要怎么排版比较合适可以省图例空间」）：
   *   原图例 **五块竖堆**：s1(点色行,§E432 已空) → wr(色条+F轴) → s2(黄针=现役) → s3(绿环…) → s4(现跑同一道闸…)
   *   ⇒ 这里把 s3/s4 **并进 s2 一行**、闸门那句移进 hover 提示（信息不丢）⇒ **五块变两块**。
   *   三次踩坑都记下：① 插在 paintLegend 函数外 ⇒ s2 不在该作用域 ⇒ 整块被跳过；② 替换区间吃掉函数收尾大括号 ⇒ 解析失败；
   *   ③ 上一版其实已经生效，却因为我校验时只截了 420 字符的 DOM 窗口而**误判为未生效**并把它撤掉了（校验方式本身有坑）。 */
  if (OKL.length && (st.color === 'fam' || st.color === 'seed')) {
    /* §E437：用户要求「逐枚过线」后面也换行再接 185/901 */
    s2.innerHTML = '黄针 = 现役 · 绿环 = 过了训练侧五道检查（**不是换包闸**）<br>' + OKL.length + '/' + POKJ;
    s2.title = OKSRCJ || '包自己 META 里的历史 feasibility.ok（没有现跑的判定表）';   /* §E492 同上：口径由数据说 */
    /* §E434 DS：§E432 那笔把 s1 整行清空了（用户当时说顶部有选项框、这行是重复），但**颜色的含义**也跟着没了 ——
     *   用户 10-08：「你刚才删的太多，现在图例颜色是啥没掉了，至少要保留这玩意是 F = Hp + T·S」。
     *   ⇒ 恢复简短版（不写点色 = 家族，那是选项框的事），正好填掉左上那块空白。 */
    s1.textContent = '底图 = F（Hp + T·S）· 蓝 = 低 → 红 = 高';
  }
  /* §E436 DS（用户 10-08：「你把两个·隔开的地方都直接改成换行好了」/「谱系图这里的图例怎么没有跟着改成新的」）：
   *   上一版我只在 fam/seed 那一档写死换行，而谱系图用的是 F/rel 那几档（走别的分支）⇒ 没跟上。
   *   这里改成**通用收尾**：所有档位统一把「 · 」分隔处换成换行 ⇒ 一处生效、各档一致。
   *   （用 split/join 而不是正则：模板字面量会吃反斜杠，本仓已有教训。） */
  [s1, s2].forEach(function (el) {
    /* §E437 DS（用户 10-08：「蓝低红高的蓝前面不是也有一个·怎么没有换行成功」）：
     *  「）· 蓝」里那个点**前面没有空格**，而我只按「空格 + 点 + 空格」拆 ⇒ 漏掉了（第一次断行其实是 CSS 按列宽自动折的）。
     *  改成对 innerHTML 两种都换：「空格+点+空格」与「点+空格」（后者只要求后面有空格 ⇒ T·S 里的点仍安全、不会被断）。
     *  用 innerHTML 而不是 textContent ⇒ 能保留调用方已写好的 <br>（见下面绿环那句）。 */
    if (el && el.innerHTML && el.innerHTML.indexOf('· ') >= 0) el.innerHTML = el.innerHTML.split(' · ').join('<br>').split('· ').join('<br>');
  });
  /* ===== §E460 轴高**恢复成固定 150**（用户 10-08 早：「你现在把普通版图例压的太矮了，红绿轴同样被压矮了但字排版没换，
   *   而 F 值图例却没改。先把图例的轴高都恢复一下，然后你再去优化那些尚未优化的图例版本。只换字排版」）=====
   *   §E441 那一步把"条有多高"改成跟文字列高走（72~150），死空是消掉了，代价是色条本身可读性变差：
   *   18×72 的渐变带上"绿侧 0.074 / 红侧 0.294 各按本侧 p90 距归一"这种两段刻度根本摆不开（用户截图里那两块）。
   *   ⇒ 方向反过来：**高度是恒量，死空用换行/措辞去消**（见下面 §E461 那段逐档文字排版）。
   *   ⚠ 色条与那根窗口轴必须同一个高度：原来 §E441 就是为了让两者别变成"条 150 ‖ 轴 72"两把尺才一起收的，
   *     现在一起恢复成 BARH，WINAX 的尺寸与 AXH 同步落一遍（§E380 要求它是常驻节点，不重建）。 */
  AXH = BARH;
  c.style.height = BARH + 'px'; barDraw(BARH);
  if (WINAX) { WINAX.width = AXW * devicePixelRatio; WINAX.height = AXH * devicePixelRatio;
    WINAX.style.width = AXW + 'px'; WINAX.style.height = AXH + 'px'; winaxDraw(); }
  floatApply(lg, 'lgPos');   /* §E462 图例每帧重建 children，但 #legend 本身是常驻节点 ⇒ 拖过的位置在这儿落回去 */
}
/* ③ 家族图例 = 可点按钮（按成员数从多到少），点一个只留这些家族。
 *   §E304：默认按**方法家族**列（22 家，按钮上直接写"改了什么"），切到 RNG seed 才列 seed。*/
function buildFamBar() {
  var el = document.getElementById('fam'); el.innerHTML = '';
  var byFam = {};
  /* §E377 「fam = 0」在 JS 里是 falsy ⇒ 旧槽位冠军那一行原来在图例里查不到说明（按钮本身由 gk() 建，是好的）。
     判据统一走 famTop，别再依赖 fam 的真值。 */
  if (st.color !== 'seed') for (var i = 0; i < N; i++) if (P[i].fam || P[i].famTop) byFam[P[i].fam] = famLab(P[i]);
  for (var j = 0; j < GRP.keys.length; j++) {
    (function (k) {
      var b = document.createElement('button'); b.className = 'fam';
      /* E396 DS（用户 10-08）：底部高亮选项**只显示家族号**（描述文字挪到坐标轴那一侧去，见 paintChrome）。 */
      var lab = st.color === 'seed' ? ('seed ' + k) : ('家族 ' + k);
      /* E396 DS（用户 10-08）：**只留家族号**（描述与枚数都挪走；枚数进悬停提示，信息不丢）。 */
      b.innerHTML = '<i style="background:' + GRP.col[k] + '"></i>' + lab;
      b.title = (st.color === 'seed' ? '这一档 RNG 种子被多少枚复用（旧口径）' : (byFam[k] || '')) + ' · ' + GRP.cnt[k] + ' 枚';
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
/* ===== §E338 批次下拉 / 选中卡 / 冠军序列与对比表 ===== */
function buildBatchSel() {
  var el = document.getElementById('batch'); if (!el) return; el.innerHTML = '';
  var o0 = document.createElement('option'); o0.value = 'all'; o0.textContent = '全部（' + N + ' 枚 ‖ ' + BATCH.length + ' 批）'; el.appendChild(o0);
  for (var i = 0; i < BATCH.length; i++) { var b = BATCH[i], o = document.createElement('option');
    o.value = b.k; o.textContent = '第 ' + b.no + ' 批 · ' + b.k.slice(5) + ' · ' + b.n + ' 枚'; el.appendChild(o); }
  el.value = st.batch; }
function nOf(id) { for (var i = 0; i < N; i++) if (P[i].id === id) return i; return -1; }
/* 「相对现役」那一行（用户 ③ 后半句）。⚠ 三个数一起给，只给一个就会被当成"综合更强"：
 *   F 是训练目标那一把尺、Hp 是页面口径、名次是全库秩；§E336 实测这三把与配对决斗的秩相关只有 0.39~0.53。 */
function relLines(d) {
  if (!INC || d.id === INC.id) return ['★ 线上冠军 = 分界本身（图上所有绿/红都以它为零点）'];
  var out = [];
  out.push('vs 现役：F ' + (Fv(d) >= Fv(INC) ? '+' : '') + (Fv(d) - Fv(INC)).toFixed(3) +
    ' ‖ 名次 第 ' + d.rk + ' vs 第 ' + INC.rk + '（' + (d.rk < INC.rk ? '强 ' + (INC.rk - d.rk) + ' 位' : '落后 ' + (d.rk - INC.rk) + ' 位') + '）');
  out.push('　　　　　页面口径 Hp ' + (d.Hp >= INC.Hp ? '+' : '') + (d.Hp - INC.Hp).toFixed(1) + 'pt' +
    (d.hp === null || INC.hp === null ? '' : '（实测两 seed 均值 ' + (d.hp >= INC.hp ? '+' : '') + (d.hp - INC.hp).toFixed(1) + 'pt）'));
  if (d.scd !== null && d.scd !== undefined) out.push('　　　　　当选键配对差 ' + (d.scd >= 0 ? '+' : '') + d.scd.toFixed(1) + 'pt（同号 ' + d.scs + '）');
  if (d.ds) out.push('　　　　　对现役配对决斗 ' + (d.dm >= 0 ? '+' : '') + d.dm.toFixed(1) + 'pt（' + (d.ds === 'flip' ? '两批符号翻 ⇒ 判不动' : d.ds === 'same' ? (d.dm > 0 ? '两批都赢' : '两批都输') : '—') + '）');
  return out;
}
function paintCard() {
  var el = document.getElementById('card'); if (!el) return;
  var i = st.sel === null ? -1 : nOf(st.sel);
  if (i < 0 || !P[i]) { el.style.display = 'none'; el.textContent = ''; return; }
  var d = P[i];
  var head = (d.id === 'SHIPPED-Ldemo' ? '★ ' : '') + d.id + (d.lin ? ' 【' + d.lin + '】' : '') + (d.kin ? ' 〔' + d.kin + '〕' : '')
    + (d.sv && String(d.id).indexOf('SLOT-') === 0 ? '（版本号 ' + d.sv + ' ‖ 标签上写的就是它）' : '');   /* §E463 卡上给全身份 */
  /* 家族标签用**截断版**：famLab 全串里带一整列"父"权重哈希（实测 20 个 ≈ 700 字符），
   *   直接拼进来这张卡会横贯整个画布，把下面的页脚与投影判据全盖住（第一版截图就是这样）。
   *   §E449 之后卡会自己折行 ⇒ "撑宽"这件事已经不会发生，但 700 字符折出来是二十行，所以总结式照用。*/
  var body = [head,
    '家族 ' + d.fam + '（' + (famSummary(famLab(d)) || '—') + '）· 批次 ' + (batchOf(d) || '无日期') + ' · 训出 ' + (d.ts || '—') + (d.sh ? ' ‖ 上线 ' + d.sh + ' ' + d.sv : ''),
    'F = ' + Fv(d).toFixed(3) + '（现役 ' + Fv(INC).toFixed(3) + '）· Hp = ' + d.Hp.toFixed(1) + ' · H考卷 = ' + d.H.toFixed(1) + ' · S = ' + d.S.toFixed(2),
    /* §E449 这两处原来写 slice(0, 90) / slice(0, 60)：卡是 white-space:pre（不折行），长句会把卡撑到横贯画布，
     *   当时拿截断挡住那件事。现在卡改成 pre-wrap（400px 内自己折行、超高滚），截断就只剩坏处了：
     *   实测全库 why 最长 131 字符（R391）‖ pb 最长 128（v7tgt4-63）⇒ 折行后最多 4 行，装得下；
     *   而不截的话 v7seat24-31 那条本来读得出"四条腿各差多少"，截 60 就断成"场B 清场 0.20 < "（阈值那半句没了）。
     *   这张卡是"为什么这枚不能上槽"的唯一自证位，半句等于没写。*/
    '上槽体检：' + (d.pv === 1 ? '✅ 三条腿全过（真能换包）' : (d.pv === 0 ? '⛔ ' + String(d.pb) : '未测')) +
    ' ‖ 过线判定：' + (d.ok === 1 ? '是' : (d.ok === 0 ? '否' : '未测')) + (d.why ? '（栽在 ' + String(d.why) + '）' : '')
  ].concat(relLines(d)).concat(d.dn > 1 ? ['⚠ 同一份权重占 ' + d.dn + ' 行：' + String(d.dups).split(',').slice(0, 4).join(' ‖ ') + (d.dn > 4 ? ' 等 ' + d.dn + ' 行' : '')] : []);
  el.style.display = 'block'; el.textContent = body.join('\\n');
  floatApply(el, 'cardPos');   /* §E462 卡是盖住数据最多的那块（实测 39 枚，含 12 枚历代冠军）⇒ 也要能拖走 */
}
/* 冠军序列 + 对比表。⚠ 排序键是**上线时刻**（ship-scan 从 git 逐提交算槽文件权重指纹抽的），
 *   抽不到的（实测 v7new6-94/96：coords.tsv 的 lineage 列把它们标成"历代上槽"，git 里那两条只是 v1.5.114
 *   标题"同时记 v7new6"的顺带点名 ⇒ 从没真进过槽）退回训出时刻，并在行上标"未上槽"，不假装知道。 */
function champList() {
  var a = [];
  for (var i = 0; i < N; i++) if (P[i].lin) a.push(i);
  a.sort(function (x, y) { var ax = P[x].sh || ('~' + (P[x].ts || '')), ay = P[y].sh || ('~' + (P[y].ts || ''));
    return String(ax).localeCompare(String(ay)) || P[x].rk - P[y].rk; });
  return a;
}
function paintSide() {
  var el = document.getElementById('side'); if (!el) return;
  if (!st.side) { el.style.display = 'none'; return; }
  el.style.display = 'block'; el.innerHTML = '';
  floatApply(el, 'sidePos');   /* §E462 */
  /* 让开图例：图例的高度随口径变（F 档三行、pm 档两行…），写死 top 一定会盖住它 —— 第一版截图就是
   *   把"加测过（F 底 0.17）"那行压在冠军序列底下。按图例实际底边算，两块永远各占各的。 */
  var lg = document.getElementById('legend');
  if (!st.sidePos) el.style.top = (lg && lg.offsetHeight ? lg.offsetTop + lg.offsetHeight + 10 : 172) + 'px';   /* §E462 拖过就不再跟图例 */
  var h = document.createElement('h4');
  h.textContent = '冠军序列（按上线时刻 · ' + champList().length + ' 枚）· 点一下加入对比';
  el.appendChild(h);
  var CH = champList();
  for (var j = 0; j < CH.length; j++) { (function (i) { var d = P[i];
    var b = document.createElement('button');
    b.className = (st.cmp.indexOf(d.id) >= 0 ? 'on ' : '') + (d.id === 'SHIPPED-Ldemo' ? 'cur' : '');
    b.textContent = (d.sh ? '' : '⚠') + (d.id === 'SHIPPED-Ldemo' ? '★ ' : '') + labOf(d) +   /* §E463 序列里也标版本号（原来 16 枚全是 SLOT-8位哈希，读不懂）*/
      /* §E463 标签已经换成版本号的那几枚，第二栏就别再把同一个版本号抄一遍 ⇒ 让位给全 id（身份还在，只是排在可读名后面）*/
      ' ‖ ' + (labOf(d) === d.sv ? d.id : (d.sv || (d.sh ? '' : '未上槽'))) + ' ‖ ' + (d.sh ? d.sh.slice(5, 10) : (d.ts || '').slice(5, 10)) +
      ' ‖ F ' + Fv(d).toFixed(3) + ' ‖ Hp ' + d.Hp.toFixed(1);
    b.title = ('id ' + d.id + (d.wid ? ' ‖ 权重 ' + d.wid : '') + '\\n' + (d.sh ? '上线 ' + d.sh : 'git 里没找到上槽提交 ⇒ 按训出时刻 ' + (d.ts || '—') + ' 排（这枚从没真进过槽）')) +
      '\\n名次 第 ' + d.rk + ' ‖ H考卷 ' + d.H.toFixed(1) + ' ‖ S ' + d.S.toFixed(2) + ' ‖ Δε ' + (d.De >= 0 ? '+' : '') + d.De.toFixed(1);
    b.onclick = function () { var k = st.cmp.indexOf(d.id);
      if (k >= 0) st.cmp.splice(k, 1); else { if (st.cmp.length >= 7) { st.cmp.shift(); } st.cmp.push(d.id); }
      st.sel = d.id; recomputeVIS(); paintCard(); paintSide(); buildFamBar(); req(); };
    el.appendChild(b); })(CH[j]); }
  if (st.cmp.length > 1) {
    var h2 = document.createElement('h4'); h2.style.marginTop = '10px'; h2.textContent = '对比（' + st.cmp.length + ' 枚）';
    el.appendChild(h2);
    var tb = document.createElement('table'), tr, i2;
    function row(lab, fn) { tr = document.createElement('tr'); var th = document.createElement('th'); th.textContent = lab; tr.appendChild(th);
      for (var q = 0; q < st.cmp.length; q++) { var td = document.createElement('td'); var d = P[nOf(st.cmp[q])];
        td.textContent = d ? fn(d) : '—'; tr.appendChild(td); } tb.appendChild(tr); }
    row('上线', function (d) { return d.sh ? d.sh.slice(5, 10) : '未上槽'; });
    row('名次', function (d) { return '第' + d.rk; });
    row('F', function (d) { return Fv(d).toFixed(3); });
    row('ΔF vs 现役', function (d) { return (Fv(d) - Fv(INC) >= 0 ? '+' : '') + (Fv(d) - Fv(INC)).toFixed(3); });
    row('Hp 页面', function (d) { return d.Hp.toFixed(1); });
    row('H 考卷', function (d) { return d.H.toFixed(1); });
    row('Δε', function (d) { return (d.De >= 0 ? '+' : '') + d.De.toFixed(1); });
    row('S 广度', function (d) { return d.S.toFixed(2); });
    row('当选键差', function (d) { return d.scd === null || d.scd === undefined ? '未测' : (d.scd >= 0 ? '+' : '') + d.scd.toFixed(1); });
    row('决斗差', function (d) { return d.dm === null || d.dm === undefined ? '未测' : (d.dm >= 0 ? '+' : '') + d.dm.toFixed(1); });
    row('上槽体检', function (d) { return d.pv === 1 ? '过' : (d.pv === 0 ? '栽' : '未测'); });
    row('最优', function (d) { return d.ok === 1 ? '是' : (d.ok === 0 ? '否' : '未测'); });
    row('珠/局', function (d) { return (d.chg === null || isNaN(d.chg)) ? '—' : d.chg.toFixed(2); });
    row('浪费ep', function (d) { return (d.waste === null || isNaN(d.waste)) ? '—' : d.waste.toFixed(2); });
    el.appendChild(tb);
    var note = document.createElement('div'); note.style.color = 'var(--dim)'; note.style.marginTop = '5px';
    note.textContent = '⚠ 同屏最多留 7 列（第 8 枚挤掉最早的）。"决斗差"是 1 打 4 的配对手柄，与页面 1 打 3 不是一把尺。';
    el.appendChild(note);
  }
}
document.getElementById('batch').addEventListener('change', function () { st.batch = this.value; recomputeVIS();
  buildFamBar(); paintSide(); req(); });
/* ===== §E371 强度窗口（用户："默认显示全范围，然后可以手动拉强度上下顶点，用满色域渲染中间的点而超出范围的不显示"）
 *   §E378 换成一根竖轴（用户 10-07：「F窗口用两个独立的轴调很奇怪，你直接做到右边图例边上，用一根纵轴两个端点可拖动来表示范围」）
 *   整根 = 全库 F 值域的比例 [0,1]（顶 = 高 F）‖ 亮段 = 当前窗口 ‖ 两个黄柄 = 窗口的两端，可拖、双击回全范围。
 *   两端不许交叉（交叉就顶住对方留最小缝 ⇒ 图上永远有东西可看，不会出现"拉到看不见还以为是数据没了"的空图），
 *   但**各自必须能拉到 0 与 1** —— 窗口存的是比例，所以换 T 之后不漂移。 */
function nWin() { var n = 0; for (var i = 0; i < N; i++) if (inWin(P[i])) n++; return n; }
var WINAX = null;                       /* 图例里那根轴的 canvas（paintLegend 每次重建图例 ⇒ 这里跟着换一份）*/
var AXW = 26, AXH = 150;                /* CSS 尺寸；位图按 dpr（§E372 的教训：指针换算必须按实际盒子，不是按 dpr 反推）*/
function axY(f, H) { return (1 - f) * H; }
function winaxDraw() {
  var c = WINAX; if (!c) return;
  var a = c.getContext('2d'), W = c.width, H = c.height, d = devicePixelRatio, x = Math.round(W / 2);
  a.clearRect(0, 0, W, H);
  a.strokeStyle = 'rgba(159,176,204,.55)'; a.lineWidth = Math.max(1, d);
  a.beginPath(); a.moveTo(x, axY(1, H)); a.lineTo(x, axY(0, H)); a.stroke();          /* 整根 = 全库值域 */
  a.strokeStyle = '#7fd1ff'; a.lineWidth = 3 * d;
  a.beginPath(); a.moveTo(x, axY(st.fhi, H)); a.lineTo(x, axY(st.flo, H)); a.stroke(); /* 亮段 = 窗口内 */
  a.fillStyle = '#ffd166';
  a.fillRect(0, axY(st.fhi, H) - 2.5 * d, W, 5 * d);
  a.fillRect(0, axY(st.flo, H) - 2.5 * d, W, 5 * d);
}
function winaxFrac(e, box) {   /* box = 按下那一刻量好的 CSS 盒（不在拖动中途重量：那一帧图例可能正被重建，
                                 *   拿到的会是 0×0 ⇒ 端点会跳一下。§E372 同一族：换算只许按实际盒子。*/
  return Math.max(0, Math.min(1, 1 - (e.clientY - box.top) / (box.height || 1))); }
function winaxBind(c) {
  c.style.cursor = 'ns-resize';
  c.addEventListener('pointerdown', function (e) {
    var box = c.getBoundingClientRect(), H = c.height || 1;
    var f0 = winaxFrac(e, box);
    /* 按下时先判抓哪一端：出厂态两柄一个在顶一个在底，中点等距 ⇒ 拿到的是下沿（判据里明写着这条） */
    var hold = Math.abs(axY(st.flo, H) - (1 - f0) * H) <= Math.abs(axY(st.fhi, H) - (1 - f0) * H) ? 'lo' : 'hi';
    /* 拖动中的监听挂 **window** 而不是这张 canvas：drawBody() 每帧调 paintLegend() 重建图例，
     *   绑在 canvas 上的 move 会随节点一起被换掉 ⇒ 用户报的"每次只能动一格"就是这么来的（实测：一次按下只吃一次 move）。*/
    var mv = function (ev) { var f = winaxFrac(ev, box);
      if (hold === 'lo') setWinLight(f, st.fhi); else setWinLight(st.flo, f); };
    var up = function () { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setWin(st.flo, st.fhi); };   /* 收尾走一次全量：家族条与侧栏的计数要跟着窗口掉 */
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    e.preventDefault();
  });
  c.addEventListener('dblclick', function () { setWin(0, 1); });
}
/* ===== §E462 浮层做成可拖动件（用户 10-08：「你干脆可以把这个图例整体做成可动件试试，
 *   让他可以在页面上拖动，这样就永远不会遮挡了」）=====
 *   §E455 量出来的账：图例只压住 0~16 枚点，真正盖住数据的是选中卡（39 枚，含 12 枚历代冠军）与冠军序列（26 枚）
 *   ⇒ 所以**三块一起**能拖（图例 / 选中卡 / 冠军序列），只拖图例解决不了她指的那个问题。
 *   位置存在 st 里（切模式、换色档、重建图例都不跳回原位），双击复位。
 *   ⚠ 三条不能碰坏的：① 图例里那根窗口轴自己听 pointerdown（拖两个柄）⇒ 拖动必须让开它和图例里的按钮；
 *     ② paintLegend 每帧重建 children ⇒ 监听只能绑在常驻节点上（绑到子元素每帧就没，§E378 同一族）；
 *     ③ 卡与侧栏自己有 overflow:auto 滚动 ⇒ 只有"按下没移动"才算单击，移动过就别抢滚动。 */
function floatClamp(el, x, y) {
  var wr = document.getElementById('wrap'); if (!wr || !el) return [0, 0];
  return [Math.max(0, Math.min(Math.max(0, wr.clientWidth - el.offsetWidth), x)),
          Math.max(0, Math.min(Math.max(0, wr.clientHeight - el.offsetHeight), y))]; }
function floatApply(el, key) {
  if (!el) return;
  var d = FLOAT_DEF[key];
  if (!st[key]) { el.style.left = d.left; el.style.right = d.right; el.style.top = d.top; el.style.bottom = d.bottom; return; }
  var p = floatClamp(el, st[key][0], st[key][1]); st[key] = p;
  el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px';
  if (key === 'lgPos') { var sd = document.getElementById('side');   /* 侧栏本来贴在图例下面 ⇒ 图例拖走它跟着走 */
    if (sd && st.side && !st.sidePos) sd.style.top = (p[1] + el.offsetHeight + 10) + 'px'; } }
var FLOAT_DEF = { lgPos: { left: 'auto', right: '6px', top: '12px', bottom: 'auto' },
  cardPos: { left: '14px', right: 'auto', top: 'auto', bottom: '34px' },
  sidePos: { left: 'auto', right: '14px', top: '172px', bottom: 'auto' } };
function floatBind(el, key) {
  if (!el || el._fBound) return; el._fBound = 1;
  el.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    var t = e.target;
    while (t && t !== el) { if (t.id === 'winax' || t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'SELECT') return;
      t = t.parentNode; }
    var wr = document.getElementById('wrap'), wrr = wr.getBoundingClientRect(), r = el.getBoundingClientRect();
    var ox = e.clientX - r.left, oy = e.clientY - r.top;
    if (!st[key]) st[key] = [r.left - wrr.left, r.top - wrr.top];
    var p0 = st[key].slice(), moved = 0;
    var mv = function (ev) { var nx = ev.clientX - wrr.left - ox, ny = ev.clientY - wrr.top - oy;
      if (Math.abs(nx - p0[0]) + Math.abs(ny - p0[1]) > 2) moved = 1;
      st[key] = [nx, ny]; floatApply(el, key); };
    var up = function () { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (moved && key === 'lgPos') { var sd = document.getElementById('side'); if (sd && st.side) sd.style.top = el.style.top; }
      if (!moved) el._fTap = 1; };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    e.preventDefault();
  });
  el.addEventListener('dblclick', function () { st[key] = null; floatApply(el, key); if (key === 'lgPos') paintSide(); });
}
function floatBindAll() {
  floatBind(document.getElementById('legend'), 'lgPos');
  floatBind(document.getElementById('card'), 'cardPos');
  floatBind(document.getElementById('side'), 'sidePos');
  floatApply(document.getElementById('legend'), 'lgPos'); }
function paintWin() {
  var el = document.getElementById('wv'); if (!el) return;
  el.textContent = winFull() ? '全范围（' + N + ' 枚）'
    : winLo().toFixed(3) + ' … ' + winHi().toFixed(3) + ' ‖ ' + nWin() + '/' + N + ' 枚在窗内';
  el.style.color = (!winFull() && !inWin(INC)) ? '#ffb454' : 'var(--dim)';
  winaxDraw();
  markWinPre();   /* 手拖过轴之后，档位按钮的高亮必须跟着掉（否则"看着还停在现役±10pt"其实是另一段） */
}
function applyWin(a, b) {
  st.flo = Math.max(0, Math.min(0.995, a)); st.fhi = Math.min(1, Math.max(st.flo + 0.005, b));
}
function setWin(a, b) { applyWin(a, b); recomputeVIS(); buildFamBar(); paintSide(); paintWin(); req(); }
/* 拖动途中只走这一条：家族条与侧栏每帧重建一次会吃掉整帧预算（§E293 ⑥ 那句"卡死"的同一个来源），
 *   而它们读的是"窗内有几枚"，拖完由 setWin 补一次全量就够。 */
function setWinLight(a, b) { applyWin(a, b); recomputeVIS(); paintWin(); req(); }
/* ===== §E373 默认档位（用户："你其实可以给几个默认的缩放档位（比如当前不加旧包就可以当做一个档位）"）=====
 *   每个档位给一组 [flo, fhi]（仍是"占全库 F 值域的比例"），点一下就把两端推过去；手拖滑杆后高亮自动跟。
 *   need:1 的两档**只在旧冠军真的被画进图里时出现**（要不要画 = 待裁），所以现在这张图上只会有两档 ——
 *   这不是省事，是"库里没有的东西不许做成按钮"（点了没反应的那种控件比没有控件更坏）。 */
function frOf(list) { var a = Infinity, b = -Infinity;
  for (var i = 0; i < list.length; i++) { var v = Fv(list[i]); if (v < a) a = v; if (v > b) b = v; }
  return [a, b]; }
function onlyOld() { var a = []; for (var i = 0; i < N; i++) if (P[i].old) a.push(P[i]); return a; }
/* §E376 自检要用的一份**独立**算法：页面上那两档是 frOf(...)+toFrac(...) 算的，判据不能也拿它们自己当期望值
 *   （那就是"信代码自己的说法"，第 91 条红过的那件事）。这里从 Fv 直接重算一遍分位，只用到加减除。
 *   返回 [低端分位, 高端分位, 旧包枚数]；没有旧包时第三项为 0 ⇒ 自检里那两档本来就该不出现。 */
function oldBand() {
  var lo = Infinity, hi = -Infinity, n = 0, i;
  for (i = 0; i < N; i++) if (P[i].old) { var v = Fv(P[i]); if (v < lo) lo = v; if (v > hi) hi = v; n++; }
  if (!n) return [0, 1, 0, 0];
  var a = Infinity, b = -Infinity;
  for (i = 0; i < N; i++) { var w = Fv(P[i]); if (w < a) a = w; if (w > b) b = w; }
  var sp = (b - a) || 1, inb = 0;
  for (i = 0; i < N; i++) { var v2 = Fv(P[i]); if (v2 >= lo && v2 <= hi) inb++; }
  return [(lo - a) / sp, (hi - a) / sp, n, inb];
}
function toFrac(lo, hi) { var r = FR(), w = (r[1] - r[0]) || 1; return [(lo - r[0]) / w, (hi - r[0]) / w]; }
var WINPRE = [
  { n: '全范围', t: '把两端推回全库 F 的最小/最大（= 出厂态）', f: function () { return [0, 1]; } },
  { n: '现役±10pt', t: '以现役那一档为中心开 20pt 的窗 —— 读"谁真能换掉现役"用的就是这一段',
    f: function () { var c = Fv(INC); return toFrac(c - 0.10, c + 0.10); } },
  { n: '旧冠军段', need: 1, t: '把两端推到旧冠军那一批的 F 区间。⚠ 它切的是**数值**不是**类别** ⇒'
    + '同一段里的今天的候选也会一起留下（要看那 16 枚自己，用左侧搜索框或冠军序列）',
    f: function () { var q = frOf(onlyOld()); return toFrac(q[0], q[1]); } },
];
function markWinPre() { var el = document.getElementById('winpre'); if (!el) return;
  var bs = el.querySelectorAll('button');
  for (var i = 0; i < bs.length; i++) { var w = WINPRE[+bs[i].getAttribute('data-i')]; if (!w) continue;
    var r = w.f(); bs[i].classList.toggle('on', Math.abs(r[0] - st.flo) < 0.002 && Math.abs(r[1] - st.fhi) < 0.002); } }
function buildWinPre() { var el = document.getElementById('winpre'); if (!el) return;
  el.innerHTML = '';
  var lab = document.createElement('span'); lab.textContent = '档位'; el.appendChild(lab);
  var hasOld = false; for (var j = 0; j < N; j++) if (P[j].old) { hasOld = true; break; }
  for (var i = 0; i < WINPRE.length; i++) { var w = WINPRE[i]; if (w.need && !hasOld) continue;
    var b = document.createElement('button'); b.textContent = w.n; b.title = w.t; b.setAttribute('data-i', i);
    b.onclick = function () { var r = WINPRE[+this.getAttribute('data-i')].f(); setWin(r[0], r[1]); };
    el.appendChild(b); }
  markWinPre(); }
buildWinPre();
paintWin();
document.getElementById('bside').onclick = function () { st.side = !st.side; this.classList.toggle('on', !!st.side); paintSide(); };
document.getElementById('edges').addEventListener('change', function () { st.edges = this.value; req(); });
buildBatchSel();
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

/* ===== §E372 指针 → 位图：一律按**实际 CSS 盒**换算，不再假设"1 CSS px = devicePixelRatio 位图像素" =====
 *   那个假设只在 cv.width == rect.width·dpr 时成立，而装载序列 fit0(); buildFamBar(); … 会让盒子在 fit0 之后
 *   再变一次（家族条 / 工具栏折行都会吃掉画布高度）⇒ 位图被 CSS 纵向压扁，而换算按 dpr 算
 *   ⇒ **越靠下偏得越多**，正是用户 10-06 说的"光标要在偏下的地方才能选中当前点"（实测 1600×900：位图 597 高、盒子 581 高）。
 *   另一半修法在下面那条 ResizeObserver：它让位图尺寸跟着盒子走 ⇒ 图不糊、比例也对。 */
function ptrXY(clientX, clientY) { var r = cv.getBoundingClientRect();
  return [(clientX - r.left) * (r.width > 0 ? cv.width / r.width : 1),
    (clientY - r.top) * (r.height > 0 ? cv.height / r.height : 1)]; }

/* ---- 交互：地图/三维 = 左键拖动平移、右键拖动旋转（用户 10-04 第三轮）；平面态滚轮以光标为中心 ---- */
var drag = null, dragMoved = 0;
cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
cv.addEventListener('mousedown', function (e) { dragMoved = 0;
  drag = [e.clientX, e.clientY, st.ox, st.oy, st.yaw, st.pit, st.ox3, st.oy3, e.button, st.tX, st.tY, st.tTilt, st.tShear]; });
window.addEventListener('mouseup', function () { drag = null; });
window.addEventListener('mousemove', function (e) {
  if (drag) {
    var cdx = e.clientX - drag[0], cdy = e.clientY - drag[1];
    if (Math.abs(cdx) + Math.abs(cdy) > dragMoved) dragMoved = Math.abs(cdx) + Math.abs(cdy);
    if (st.mode === 'map') {
      /* §E349 DS（用户 10-06 上午：「3D 模式又变得旋转受限」）把这道 elev > 0.05 闸整条撤了 ⇒ 撤过头了：
       *   平面态也能一拖上下就把 pitch 拖离正俯视（用户 10-06 晚：「切换成平面模式时仍然可以直接旋转拉成立体的，
       *   平面模式失效了」）。现在按"平面 = 正俯视"各让一半：**pitch 锁在 FLAT**（要倾角必须先点"立体"），
       *   **yaw 照转** —— pit=π/2 时它是在屏幕平面内转，仍然是平面，所以 §E349 那句"转不动"不会回来。
       *   立体态两轴都自由 = §E349 的原样。 */
      if (drag[8] === 2) { st.yaw = drag[4] - cdx / 160;
        if (st.elev > 0.05) st.pit = Math.max(0.06, Math.min(1.62, drag[5] + cdy / 200)); }
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
          st.yaw = drag[4] + cdx / 160;   /* E352 DS: 谱系图右键 = 完整 yaw。
         *   ⚠ 符号是 **+**（地图那边是 −）：因为树里 PL 的纵向是 vc + (a·u0 + b·u1)，
         *   而地图 ptw 是 h/2 − (…) —— 纵向符号相反 ⇒ 手性镜像 ⇒ 同一套鼠标公式在树上方向会反。 */
          st.pit = Math.max(0.06, Math.min(1.62, drag[5] + cdy / 200));   /* E352 DS: pitch 仍夹在 [0.06,1.62] */
        }
      } else {
        /* §E379 平移必须**跟着光标走**（用户 10-07：「平移时读鼠标在屏幕上的坐标而不是直接拖动」）。
         *   tX/tY 加的是**相机之前**的量，而鼠标给的是屏幕位移 ⇒ 立体态下画面会沿纸的轴跑。
         *   PL 写的是 sx = a·r0 + b·r1 ‖ sy = a·u0 + b·u1（r 那一**行**管屏幕横、u 那一行管屏幕纵）
         *   ⇒ M = [[r0,r1],[u0,u1]]，det = r0·u1 − r1·u0，Δa = (u1·sx − r1·sy)/det，Δb = (r0·sy − u0·sx)/det。
         *   ⚠ 上一版按 [[r0,u0],[r1,u1]] 解（把 r/u 当成列）—— det 恰好同值，所以**只在 r1=u0=0 的角度上对**，
         *     正是用户实测的那句「0 度和 180 度正常，90 度完全不对」（那两角上 r1、u0 都是 0 ⇒ 两种写法同值）。
         *   FLAT 相机（r=[1,0]、u=[0,1]）下 det=1、Δa=sx、Δb=sy ⇒ 平面态与旧写法逐字相同，已验收的二维图不动。 */
        var cbn = cam(), det = cbn.r[0] * cbn.u[1] - cbn.r[1] * cbn.u[0];
        var sx = cdx * devicePixelRatio, sy = cdy * devicePixelRatio;
        if (!isFinite(det) || Math.abs(det) < 1e-6) { st.tX = drag[9] + sx; st.tY = drag[10] + sy; }
        else { st.tX = drag[9] + (cbn.u[1] * sx - cbn.r[1] * sy) / det;
          st.tY = drag[10] + (cbn.r[0] * sy - cbn.u[0] * sx) / det; } }
    }
    req(); return;
  }
  if (e.target !== cv) return;
  var mm = ptrXY(e.clientX, e.clientY), mx = mm[0], my = mm[1];
  var hit = pickAt(mx, my);
  var t2 = document.getElementById('tip');
  if (hit >= 0) {
    /* §E557（用户 10-09：「悬停时展开的数据只出现在右下角，点靠右下的时候会看不见，做成自适应展开」）：
     *   原来固定写 clientX+14 / clientY+10 ⇒ 靠右、靠下的点整张卡被顶出画面（截图里 eco-36 就是被右缘切掉半张）。
     *   顺序也必须是**先写内容、再量尺寸、最后定位**：#tip 是 white-space:pre，宽度完全由这一帧的文案决定，
     *   先量后写会拿到**上一枚**的尺寸（那正好是这条腿历史上犯过的错：拿上一个人的信息当这个人的）。
     *   放不下就翻面（右→左、下→上），最后再夹进视口 —— 不裁内容、不缩字号。 */
    t2.textContent = tip(P[hit], fRange());
    t2.style.display = 'block';
    var tp = tipPlace(e.clientX, e.clientY, t2.offsetWidth, t2.offsetHeight);
    t2.style.left = tp[0] + 'px'; t2.style.top = tp[1] + 'px';
  } else t2.style.display = 'none';
});
/* §E338 命中判定（悬停与点击共用一份 ⇒ 不会出现"看着能点、点下去没反应"）：
 *   ① 先按**标签包围盒**判。这条是修一个真 bug：标签为了避让会离开自己那枚点（putLabel 会推移 bx/by，
 *      最长挪一个字高，旋转标签原先还把顶边记错一个字长），而旧命中只算"到圆心的距离"
 *      ⇒ 指着卡名读到的是**旁边那枚**的明细（用户：「悬停某个冠军卡的时候有时候会显示上一个冠军的信息」）。
 *      倒序找 ⇒ 后画的（压在最上面的）先命中。
 *   ② 再按**这枚自己的半径**判（旧版全场一个 14px ⇒ 小点一划中就中到别人，用户：「选中的范围非常模糊」）。 */
function curZoom() { return st.mode === 'tree' ? st.tKx : (st.mode === 'map' ? st.k : (st.mode === '3db' ? st.zoom3 : 1)); }
function pickAt(mx, my) {
  for (var li = LAB.length - 1; li >= 0; li--) { var L = LAB[li];
    if (L[4] >= 0 && L[4] < N && VIS[L[4]] && mx >= L[0] && mx <= L[0] + L[2] && my >= L[1] && my <= L[1] + L[3]) return L[4]; }
  var best = -1, bd = 1e9, zk = curZoom();
  for (var i = 0; i < N; i++) { if (!scr[i] || !VIS[i]) continue;
    var dx = scr[i][0] - mx, dy = scr[i][1] - my, d = Math.sqrt(dx * dx + dy * dy) - hitR(P[i], zk);
    if (d < bd) { bd = d; best = i; } }
  return bd > 0 ? -1 : best;
}
/* 点一下 = 选中这枚（再点同一枚 = 取消）；点空白 = 取消选中（用户 ②）。
 *   ⚠ 必须**只在没拖动的时候**算点击：旧版平移/旋转的 mouseup 也会落在这对事件里，
 *   不加位移门就会"拖一下把选中清掉"。位移阈值按 CSS 像素算（4px），与 devicePixelRatio 无关。 */
cv.addEventListener('click', function (e) {
  if (e.button !== 0) return;
  var cm = ptrXY(e.clientX, e.clientY), mx = cm[0], my = cm[1];
  if (dragMoved > 4) return;
  var hit = pickAt(mx, my);
  st.sel = hit >= 0 ? (st.sel === P[hit].id ? null : P[hit].id) : null;
  paintCard(); req();
});
cv.addEventListener('wheel', function (e) { e.preventDefault();
  var f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  if (st.mode === 'map') {
    if (st.elev < 0.5) {
      var wm = ptrXY(e.clientX, e.clientY), mx = wm[0], my = wm[1];
      /* 光标下数据点必须不动：u = mx − w/2 ⇒ ox' = u − f·(u − ox)（锚点在画布中心，不在原点）*/
      var u = mx - cv.width / 2, v = my - cv.height / 2;
      st.ox = u - (u - st.ox) * f; st.oy = v - (v - st.oy) * f; st.k *= f;
    } else { st.k = Math.max(0.2, Math.min(60, st.k * f)); st.ox *= f; st.oy *= f; }
  } else if (st.mode === '3db') st.zoom3 *= f;
  else if (st.mode === 'tree') {
    /* 光标下的内容不动：screen = 支点 + (world − 支点)·k + p ⇒ p' = (m − 支点) − f·((m − 支点) − p)。
     *   §E377：支点必须一起减掉 —— 缩放改成绕数据区左上角（TPAD）之后还按旧式算，光标对不准它下面那枚，
     *   而且横轴一缩小整张图会朝左栏挤过去（用户"渲染范围"那张截图的一半）。夹在 0.4~12 倍。
     *   §E314 横纵分开：滚轮 = 横轴（时间）‖ Shift+滚轮 = 纵轴（家族行）。被改的那一轴以光标为锚，另一轴原地不动。
     *   ⚠ 这里原来把同一句 "var rt = …, mt = …, nt = …" **抄了两遍**（改动时插在新注释上面没删旧的）。 */
    var wm2 = ptrXY(e.clientX, e.clientY), mt = wm2[0], nt = wm2[1];
    if (e.shiftKey) {
      var ky = Math.max(0.4, Math.min(12, st.tKy * f)); f = ky / st.tKy; st.tKy = ky;
      var ay = nt - TPAD.t; st.tY = ay - (ay - st.tY) * f;
    } else {
      var kx = Math.max(0.4, Math.min(12, st.tKx * f)); f = kx / st.tKx; st.tKx = kx;
      var ax = mt - TPAD.l; st.tX = ax - (ax - st.tX) * f;
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
    /* §E362（用户 10-06 晚：「谱系图从 3d 切回 2d 之后没有复位」）：§E352 把谱系图的投影换成读这台相机之后，
     *   旧写法（tree 那一支把 to.y/to.p 设成 st.yaw/st.pit）就变成了"把 yaw/pit 插回它们自己" ⇒ elev 归零只是不留高度，
     *   地板还歪着。现在两个模式的"放平"是同一件事：相机回 FLAT。立起方向仍不碰 yaw（§E296 的"原地立起"）。*/
    to: (to3d && !tree) ? { e: 1, y: null, p: SOLID.pit }
      : to3d ? { e: 1, y: null, p: st.pit }
        : { e: 0, y: FLAT.yaw, p: FLAT.pit } };
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
  /* §E362：谱系图的地板自 §E352 起**真的**由这台相机转 ⇒ 平面态切进来必须先回正，
     否则从 3db 或立体态转出来的角度会被带进一张"号称平面"的图里（歪的）。
     立体态仍**跨视图保留**（§E333：用户摆好的角度不该因为点了一下别的页就丢）。
     ⚠ 旧的"tree 什么都不碰"是 §E333 时代的决定 —— 那时谱系图视角由 tTilt/tShear 管，与相机无关；那个前提已经没了。*/
  else if (m === 'tree' && st.elev < 0.5) { st.yaw = FLAT.yaw; st.pit = FLAT.pit; }
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
  if (s) s.value = String(st.isoT); if (v) v.textContent = THRLBL();
  var tr = document.getElementById('isorow');   /* 阈值行的提示跟着场走：两场刻度不同，说明必须分开写 */
  if (tr) tr.title = (st.isoField === 'pot'
    ? '壳的判据 = 该处局部势 F（F = 线上口径 Hp + T·S，归一化到 0..1）。这条线只能落在 63%（全库均值）到 70%（场峰值）那一小段里：低于均值就把整片云圈进去、纯度退回底率 = 什么都没圈。默认 67% ⇒ 壳内约 122 枚、过线纯度 28%（底率 16%），留一复核还有 21% ⇒ 这一层是全场唯一"过了留一还站得住"的壳。'
    : '壳的判据 = 该处局部过线概率（往全库过线率 16% 收缩后的）。收缩后场的峰值实测只有 42% ⇒ 阈值拖过它必然空壳（50% 时"没有壳"是正确回答，不是坏了）。默认 30% ⇒ 壳内约 38 枚、纯度 66%；但留一复核只剩 11% ⇒ 这层壳是每枚点把自己那格照亮，看形状可以，别当证据。'); }
document.getElementById('bisos').onclick = function () { st.iso = (st.iso + 1) % 3; syncIso(); req(); };
(function () { var s = document.getElementById('isot'), v = document.getElementById('isotv');
  if (!s) return;
  s.value = String(st.isoT); if (v) v.textContent = THRLBL();
  /* 滑杆写进"当前场"那一格 ⇒ 来回切场不会把对方调好的线冲掉 */
  /* E426 DS：**拖动阈值不再每个 tick 都重建壳**。真机实测：isoBuild 一次 **1175ms**（GN=128 ⇒ 200 万格、
   *   每格扫邻域），而 MISSWHY=|thr 说明重建就是被阈值变化触发的 ⇒ 原来 input 每次都改 st.isoT，
   *   下一次 draw 立刻重建 ⇒ 拖一下卡一秒多（ISOBUILDS=5 就是这么攒出来的）。
   *   现在：数值与标签**先跟手**（廉价），网格等**停手 160ms** 再重建。 */
  var _isoTimer = 0;
  s.addEventListener('input', function () {
    var val = +this.value;
    if (st.isoField === 'pot') st.isoTpot = val; else st.isoTok = val;   /* 记住但**不动 st.isoT** ⇒ 不触发重建 */
    if (v) v.textContent = Math.round(val * 100) + '%（底率 ' + (BASEP * 100).toFixed(1) + '%）';
    clearTimeout(_isoTimer);
    _isoTimer = setTimeout(function () { st.isoT = val; if (v) v.textContent = THRLBL(); req(); }, 160);
  });
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
document.getElementById('sortb').onclick = function () {
  st.sortBy = (st.sortBy === 'time' ? 'F' : 'time');
  this.textContent = '排序：' + (st.sortBy === 'time' ? '训出时刻' : 'F 名次');
  recomputeVIS(); req(); };
document.getElementById('reset').onclick = function () {
  st.ox = st.oy = 0; st.k = 1; st.ox3 = st.oy3 = 0; st.zoom3 = 1; st.tKx = 1; st.tKy = 1; st.tX = 0; st.tY = 0;
  if (st.mode === 'map') { var pp = st.elev < 0.5 ? FLAT : SOLID; st.yaw = pp.yaw; st.pit = pp.pit; }
  else if (st.mode === 'tree') { st.yaw = FLAT.yaw; st.pit = FLAT.pit; st.tTilt = 0; st.tShear = 0; }
    /* §E362（用户：「复位按钮只会平移，结果歪掉了」）：§E352 之后谱系图能转的就是这台相机，
       而旧复位只清 §E333 那对 tTilt/tShear（已经不再参与投影）⇒ 它复的是"没在用的那两个量"。
       树里的立体感来自抬升（elev · LIFT）不来自倾角 ⇒ 正视图在两个模式下都是 FLAT 相机。
       tTilt/tShear 仍顺手清一次，是因为深链 tilt=/shear= 还会写它们。*/
  else { st.yaw = 0.62; st.pit = 0.40; }
  req(); };
document.getElementById('fitt').onclick = function () { var el = document.getElementById('fit');
  var on = el.style.display === 'none'; el.style.display = on ? 'block' : 'none'; this.classList.toggle('on', on); };
var Tt = document.getElementById('T');
Tt.addEventListener('input', function () { st.T = +Tt.value; document.getElementById('Tv').textContent = (+Tt.value).toFixed(2);
  /* §E371 窗口存的是"占全库 F 值域的比例"，而 T 一动 F 值域本身就在挪 ⇒ 必须重算可见集，
   *   否则"窗口没动、点却该进该出"这件事会停在旧的一次判定上（图上表现为拖 T 时点数不变）。 */
  recomputeVIS(); paintWin(); req(); });
document.getElementById('color').addEventListener('change', function () { st.color = this.value;
  /* 换分组口径 ⇒ 高亮键的**含义**变了（家族号 vs seed），留着会把两回事混成一次高亮 ⇒ 必须清 */
  st.hi = {}; buildGroups(); buildFamBar(); req(); });
document.getElementById('labels').addEventListener('change', function () { st.labels = this.value; req(); });
document.getElementById('size').addEventListener('input', function () { st.size = +this.value; req(); });
document.getElementById('q').addEventListener('input', function () { st.q = this.value.trim().toLowerCase(); req(); });   /* §E453 归一下大小写，匹配两处都按小写比 */
Array.prototype.forEach.call(document.querySelectorAll('#bar button[data-m]'), function (b) { b.onclick = function () { setMode(b.getAttribute('data-m')); }; });
Array.prototype.forEach.call(document.querySelectorAll('#bar button[data-bg]'), function (b) { b.onclick = function () { var c = b.getAttribute('data-bg');
  document.getElementById('bgc').value = c; setBg(c); }; });
document.getElementById('bgc').addEventListener('input', function () { setBg(this.value); });
/* §E372 位图必须跟着 CSS 盒走。fit0() 原来只在装载与 window resize 时跑，而**盒子还会因为别的理由变**
 *   （工具栏折行、家族条出现、侧栏展开）⇒ 位图留在旧尺寸 = 图被纵向压扁 = 点击越靠下越偏（用户 10-07 点名的病）。
 *   ResizeObserver 盯的是盒子本身 ⇒ 这些理由一个都不漏。guard 判"差 > 1.5px 才动"：
 *   fit0 改的是位图尺寸、不改盒子（CSS 是 100%×100%），本来就不回环，这一句挡的是 dpr 抖动时的连续重算。 */
function refit() { var r = cv.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  if (Math.abs(cv.width - r.width * devicePixelRatio) <= 1.5 && Math.abs(cv.height - r.height * devicePixelRatio) <= 1.5) return;
  fit0(); NBK = {}; FL = null; req(); }
window.addEventListener('resize', function () { fit0(); NBK = {}; FL = null; req(); });   /* 比例尺变了 ⇒ 场要按新度量重建 */
if (typeof ResizeObserver !== 'undefined') { try { new ResizeObserver(refit).observe(cv); } catch (E) {} }
/* 深链：#mode=map&3d=1&T=0.2&labels=all&color=fam&hi=31,82&bg=%23e6ebf5（mode=2d/3dw 是旧链兼容，也方便无头截图复核）*/
var HCL = null, HT_SEEN = 0, WSEEN = 0;
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
    /* §E371 强度窗口两端也走深链 ⇒ 无头复核能钉住"只画某一段强度"那张图（不钉就没法复验色带重铺对不对）*/
    if (kv[0] === 'flo') { st.flo = Math.max(0, Math.min(0.995, +kv[1] || 0)); WSEEN = 1; }
    if (kv[0] === 'fhi') { st.fhi = Math.max(st.flo + 0.005, Math.min(1, +kv[1] || 1)); WSEEN = 1; }
    /* §E338 无头复验要能钉住"选中那枚"和"冠军序列开着"这两个状态（不点开就永远截不到新面板）*/
    if (kv[0] === 'side') st.side = +kv[1] ? true : false;
    if (kv[0] === 'sel') st.sel = decodeURIComponent(kv[1]);
    /* §E449 补 edges：§E442 那节记过一条"edges= 不是 hash 参数 ⇒ 无头复验没法深链到'只实录'那一档，
     *   只能靠代码路径的守卫"——  RUNNER-BASE 那条雾边到底在 'hash' 档不画、在 'all' 档画，之前只有页内断言能证，
     *   截不到图给人看。三档都收，认不出的值不动（默认是 all）。*/
    /* §E462 浮层位置也走深链 ⇒ 无头复验能钉住「图例被拖到 (x,y) 之后画面与判据都对」这一态（认不出就不动）*/
    if (kv[0] === 'lgpos' || kv[0] === 'cardpos' || kv[0] === 'sidepos') { var lp = kv[1].split(',');
      if (lp.length === 2 && isFinite(+lp[0]) && isFinite(+lp[1])) st[kv[0] === 'lgpos' ? 'lgPos' : kv[0] === 'cardpos' ? 'cardPos' : 'sidePos'] = [+lp[0], +lp[1]]; }
    if (kv[0] === 'edges' && (kv[1] === 'all' || kv[1] === 'hash' || kv[1] === 'off')) {
      st.edges = kv[1]; document.getElementById('edges').value = kv[1]; }
    if (kv[0] === 'bg') { st.bg = decodeURIComponent(kv[1]); } 
    if (kv[0] === 'chrome') CHROMEVEC = kv[1] === 'bmp' ? 0 : 1;
    if (kv[0] === 'gl') { GLISO = (+kv[1] === 1 ? 1 : 0); console.log('PROBE parse gl kv=' + kv[1] + ' => GLISO=' + GLISO); }
    if (kv[0] === 'gfa') GFA = Math.max(0, Math.min(1, +kv[1]));
    if (kv[0] === 'gla') GLA = Math.max(0, Math.min(1, +kv[1]));
    if (kv[0] === 'batch') BATCHISO = (+kv[1] === 0 ? 0 : 1);
    if (kv[0] === 'perf') PERFON = (+kv[1] || 0);   /* 2 = 跑一次性基准（原来写成 ===1 ? 1 : 0 ⇒ #perf=2 被吞成 0）*/
    if (kv[0] === 'sort') st.sortBy = (kv[1] === 'time' ? 'time' : 'F');
    if (kv[0] === 'dgate') DGATE = (+kv[1] === 0 ? 0 : 1);
    if (kv[0] === 'm0') DM0 = Math.max(0, Math.min(20, +kv[1] || 0)); }
  /* 装载时那一次 recomputeVIS 跑在深链之前 ⇒ 不补这一句，#flo=/#fhi= 只会重铺色带、不会真的少画点。 */
  if (WSEEN) recomputeVIS();
  /* §E312 两场各有各的刻度 ⇒ 深链只给 isof 不给 isot 时，必须把阈值换成**那场自己的**默认值
   *   （#isof=pot 若沿用 ok 场的 30%，会把整片云圈进去、纯度退回底率 = 一张什么都没圈的壳）。
   *   两个都给时按字面 honored，并把这条线记进那一场的格子，回来切场不会丢。*/
  if (HT_SEEN) { if (st.isoField === 'pot') st.isoTpot = st.isoT; else st.isoTok = st.isoT; }
  else st.isoT = (st.isoField === 'pot' ? st.isoTpot : st.isoTok);
  if (st.mode === 'map') { var pp = st.elev < 0.5 ? FLAT : SOLID; st.yaw = pp.yaw; st.pit = pp.pit;
    document.getElementById('b3dt').textContent = st.elev < 0.5 ? '立体' : '平面'; } })();
(function () { var b = document.getElementById('sortb'); if (b) b.textContent = '排序：' + (st.sortBy === 'time' ? '训出时刻' : 'F 名次'); })();   /* E399：放到深链解析之后，否则 #sort=time 时标签是假的 */
fit0(); buildFamBar(); setBg(st.bg); setMode(st.mode); syncHdir(); paintCard(); paintSide(); floatBindAll();   /* §E462 三块浮层的拖动只绑一次（它们是常驻节点）*/
/* E417 DS（缺口 A）：计数器**在 #perf>=1 就挂**（原来只在 #perf=2 的基准里挂 ⇒ #perf=1 下 OPSF 恒为 0）。 */
if (PERFON >= 1) {
  var _ops = ['beginPath', 'fill', 'stroke', 'arc', 'fillText', 'strokeText', 'fillRect', 'drawImage', 'closePath', 'moveTo', 'lineTo'];
  for (var _oi2 = 0; _oi2 < _ops.length; _oi2++) { (function (m2) {
    var _f2 = g[m2]; if (typeof _f2 !== 'function') return;
    g[m2] = function () { OPC[m2] = (OPC[m2] || 0) + 1; return _f2.apply(g, arguments); }; })(_ops[_oi2]); }
}

/* E402 DS（D-3 量度）：#perf=2 ⇒ 一次性基准：连画 6 次，**丢掉第一帧**（那一帧含建壳），报稳态均值。
 *   为什么必须这样量：headless 只画一帧 ⇒ 帧时读数会把"建壳 0.3s"和"逐帧光栅化"混在一起，量出来的不是卡的那部分。 */
/* E406 DS（用户 10-08：卡，但任务管理器里 CPU 只有 9% ⇒ 不是吞吐不够，是**串行在主线程**）：
 *   把每帧的**画布调用数**与缓冲区规模量出来，才能说清"低 CPU + 卡"是怎么来的。 */
var OPC = {};
if (PERFON === 2) { var _btry = 0; (function _bwait() {
  /* E416 DS：**等首帧真实绘制之后再量**。原来跑在装载序列里（或固定延时）⇒ 那时模式/场未就绪 ⇒
   *   drawIso 不被调到 ⇒ 基准必然读到 GLPATH=0，而真实帧发生在它之后（我已被这个假数误导两次）。 */
  if ((!ISO || !ISO.quads || !ISO.quads.length) && (++_btry) < 120) { requestAnimationFrame(_bwait); return; }
  (function () {
  var _ops = ['beginPath', 'fill', 'stroke', 'arc', 'fillText', 'strokeText', 'fillRect', 'drawImage', 'closePath', 'moveTo', 'lineTo'];
  for (var _oi = 0; _oi < _ops.length; _oi++) { (function (m) {
    var _f = g[m]; if (typeof _f !== 'function') return;
    g[m] = function () { OPC[m] = (OPC[m] || 0) + 1; return _f.apply(g, arguments); }; })(_ops[_oi]); }
  var tt = [], q;
  try { for (q = 0; q < 6; q++) { var _b0 = performance.now(); draw(); tt.push(performance.now() - _b0); } }
  catch (e2) { console.log('基准跑不了: ' + e2.message); }   /* drawBody 是 draw 内的闭包 ⇒ 从外面只能调 draw()（顶层）*/
  var rest = tt.slice(1), av = rest.reduce(function (x, y) { return x + y; }, 0) / (rest.length || 1);
  var pe = document.createElement('pre'); pe.id = 'bench'; pe.style.display = 'none';
  var _tot = 0, _kv = ''; for (var _k in OPC) { _tot += OPC[_k]; _kv += _k + '=' + OPC[_k] + ' '; }
  pe.textContent = 'BENCH first=' + tt[0].toFixed(1) + ' avg=' + av.toFixed(2) + ' FACES=' + (ISO && ISO.quads ? ISO.quads.length : 0) + ' GN=' + st.isoGN
    + ' GLISO=' + GLISO + ' GLPATH=' + GLPATH + ' GLDREW=' + GLDREW + ' FRAMES=6 OPS6=' + _tot + ' OPS1=' + Math.round(_tot / 6) + ' PX=' + cv.width + 'x' + cv.height + ' DPR=' + (devicePixelRatio || 1) + ' ' + _kv;
  document.body.appendChild(pe); })(); })(); }   /* E416：等 ISO 就绪再量，读数与路标同帧取 */


/* §E371 深链 #flo=/#fhi= 是在上面那个解析循环里写进 st 的 ⇒ 那两根滑杆与读数必须在这里回压一次，
 *   否则页面按窗口画、工具栏却写着"全范围"（实测截图抓到过：图里 134 枚，栏上 901 枚）。 */
paintWin();
/* §E372 这一串里 fit0() 排在最前，而 buildFamBar()/paintSide() 会把画布盒子改一次（家族条出现、工具栏折行）
 *   ⇒ 首帧之前必须再对一次尺寸。RO 是异步的，救不了第一帧。 */
refit();
if (HCL) { st.color = HCL; var _cs = document.getElementById('color'); if (_cs) _cs.value = HCL; }   /* setMode 会把颜色重置成默认 ⇒ 深链的颜色最后再压回去（下拉框也要跟着压，否则"显示家族、画的是别的"）*/
/* ===== §E338 页内自检（深链 #check=1 ⇒ 由 champion-map/shot.mjs --dump 跑）=====
 *   为什么要它：这批改动全是**交互**（命中/选中/高亮/批次/缩放跟点），而交互在截图里看不出来；
 *   受控标签又常常没有视口（实测 canvas 1×1 ⇒ 布局数学整个是假的）。所以判据只能让页面自己算给自己看。
 *   ⚠ 每条都是"改坏了会红"的形状，不是打印读数。*/
(function () { if ((location.hash || '').indexOf('check=1') < 0) return;
  var out = [], nok = 0, nbad = 0;
  var el0 = document.getElementById('selftest');
  /* 自检自己也要有牙：跑挂了必须留下一行红字。空 div 与"0 PASS / 0 FAIL"是同一种假绿
   *   —— 看的人分不清"没跑"与"跑完没写"，而这两件事的处置完全相反。*/
  el0.style.display = 'block'; el0.textContent = 'RUNNING §E338 页内自检…';
  try {
  function T(name, cond, got) { if (cond) { nok++; out.push('PASS ' + name); }
    else { nbad++; out.push('FAIL ' + name + (got === undefined || got === null ? '' : ' ‖ 实测 ' + got)); } }
  /* ===== §E372 装载完成时的"位图 vs CSS 盒"（用户 10-07：「3d 下点的位置与光标选定的坐标似乎有偏移，
   *   光标要在偏下的地方才能选中当前点；三维行为轴开过线曲面时也是」）=====
   *   ⚠ 这条必须跑在下面那句 fit0() **之前** —— fit0 会把位图重新对齐到当前盒子，跑在它后面永远量不到装载时的错位。
   *   错位来源候选：装载序列是 fit0(); buildFamBar(); … ⇒ 家族条/侧栏把画布盒子撑改之后位图没跟着重算
   *   ⇒ CSS 把位图纵向压扁，而鼠标换算按 devicePixelRatio 算 ⇒ 越靠下偏得越多，方向正是"要点下面一点才中"。
   *   受控标签常常没有视口（实测 canvas 1×1）⇒ 那种环境下不适用，明写出来而不是假绿。 */
  var _rr0 = cv.getBoundingClientRect();
  T('指针换算：装载完成时位图尺寸必须等于 CSS 盒 × dpr（不等 ⇒ 越靠下点得越偏）',
    _rr0.width < 2 || _rr0.height < 2 ||
    (Math.abs(cv.width - _rr0.width * devicePixelRatio) <= 1.5 && Math.abs(cv.height - _rr0.height * devicePixelRatio) <= 1.5),
    _rr0.width < 2 ? '无视口 ⇒ 本条不适用（位图 ' + cv.width + '×' + cv.height + '）'
      : '位图 ' + cv.width + '×' + cv.height + ' ‖ CSS ' + Math.round(_rr0.width) + '×' + Math.round(_rr0.height)
        + ' × dpr ' + devicePixelRatio + ' ⇒ 纵向比 ' + (cv.height / (_rr0.height * devicePixelRatio)).toFixed(3));
  fit0(); draw();
  /* ① 批次过滤真的减人 */
  var all = NVIS, probeV = Fv(P[0]), cBefore = fCol(probeV);
  st.batch = BATCH.length ? BATCH[BATCH.length - 1].k : 'all'; recomputeVIS(); draw();
  T('批次过滤：切一批要少点', NVIS < all && NVIS > 0, NVIS + ' / ' + all);
  /* §E371：这条只管**批次**不许切没冠军。窗口切它是另一件事（窗口的定义就是"越界一律不画"），
   *   所以判据带上 inWin ⇒ 拿 #flo= 跑 check 时这条不会假红。 */
  T('批次过滤：冠军永远保留（分界参照物不能被批次切没 ‖ 窗口切它不算这条）',
    P.every(function (d) { return !d.lin || !inWin(d) || VIS[nOf(d.id)] === 1; }),
    '冠军 ' + P.filter(function (d) { return d.lin; }).length + ' 枚 ‖ 在窗内的都还在图上');
  /* 「颜色：切批次不许挪分位」这一条**删掉了**（用户 10-07：「需要重构的时候就把没用的门禁删了」+ 新口径
   *   「不渲染的点直接从图中摘出去，不影响范围内点的渲染」）—— 它钉的正是"批次不参与定标"，
   *   与新口径正面冲突，留着只会替一个已经作废的读法作证。换成钉新口径的那三条（下面这条）。 */
  T('颜色定标按**当下画出来的那批点**：最蓝 = 其中 F 最小 ‖ 灰 = 其中位 ‖ 最红 = 其中 F 最大（±0.02）',
    (function () { var bd = colBand(); if (!bd) return false;
      return Math.abs(fCol(bd.lo)) <= 0.02 && Math.abs(fCol(bd.med) - 0.5) <= 0.02 && Math.abs(fCol(bd.hi) - 1) <= 0.02
        && bd.n > 1 && bd.n <= nWin() && bd.n <= NVIS; })(),
    (function () { var bd = colBand(); if (!bd) return '定标名单不足 2 枚';
      return '定标名单 ' + bd.n + ' 枚（画出来的 ' + NVIS + ' ‖ 窗内 ' + nWin() + '）‖ min/中位/max = ' +
        bd.lo.toFixed(3) + '/' + bd.med.toFixed(3) + '/' + bd.hi.toFixed(3) + ' → 色值 ' +
        fCol(bd.lo).toFixed(3) + '/' + fCol(bd.med).toFixed(3) + '/' + fCol(bd.hi).toFixed(3); })());
  st.batch = 'all'; recomputeVIS(); draw();
  /* ② 命中：指着**标签**必须读到那一枚自己（这条就是用户说的"悬停显示上一个冠军的信息"）。
   *    两条标签本来就可能重叠（force 那几枚允许避让失败照样画）⇒ 判据换成"命中者的框必须真的盖住这个点"，
   *    那才是用户看到的：盖在最上面的那张卡说话，不许出现"命中一张不在这儿的卡"（phantom）。*/
  var wrong = 0, phantom = 0, tested = 0, overlapped = 0;
  for (var li = 0; li < LAB.length; li++) { var L = LAB[li];
    var px = L[0] + L[2] / 2, py = L[1] + L[3] / 2, hit = pickAt(px, py); tested++;
    if (hit === L[4]) continue;
    var HL = null;
    for (var q2 = LAB.length - 1; q2 >= 0; q2--) { var B = LAB[q2];
      if (B[4] === hit && px >= B[0] && px <= B[0] + B[2] && py >= B[1] && py <= B[1] + B[3]) { HL = 1; break; } }
    if (HL) overlapped++; else phantom++; }
  wrong = phantom;
  /* §E452 标签关掉时这条**没有可测的对象**（LAB 本来就是空的），不是"标签层坏了"：
   *   原来写成 tested > 0 ⇒ 从 #labels=off 深链进来恒红，而红的是"这条此刻不适用"。
   *   ⚠ 只放过 st.labels === 'off' 这一种零标签；开着标签却一枚都没画出来仍然红（那才是真病）。 */
  T('命中：标签中心不许命中一张盖不住这个点的卡（phantom ‖ labels=off 时本条不适用）',
    phantom === 0 && (tested > 0 || st.labels === 'off'),
    phantom + ' phantom / ' + tested + ' 个标签'
      + (tested === 0 && st.labels === 'off' ? ' ‖ 标签开关在「不标」⇒ 没有可测对象，本条不适用（开着标签却零标签仍判红）' : ''));
  T('命中：重叠标签按"谁盖在上面"说话（这是对的，只记账不判红）', true, overlapped + ' 枚与别人重叠');
  T('命中：空白处不许命中任何东西', pickAt(3, 3) < 0 && pickAt(cv.width - 3, cv.height - 3) < 0);
  /* ③ 点大小 = **按是否上线两档**（E349 DS 撤回的）。
   *   原来这里判的是"名次越高越小"，而那条要求出自一份**被压缩摘要伪造的"用户 ②"**（见 §E348 损失清单）⇒
   *   DS 把行为改回两档之后，这条断言就变成了"判一件没人要过的事"。判据跟着换成实际规则：**名次不许进入半径**。*/
  var byRk = P.slice().sort(function (a, b) { return a.rk - b.rk; });
  var shA = null, nsA = null, rSet = {};
  for (var qi = 0; qi < N; qi++) {
    if (P[qi].sh && !shA) shA = P[qi]; if (!P[qi].sh && !nsA) nsA = P[qi];
    if (!P[qi].sh) rSet[dotR(P[qi], 1).toFixed(3)] = 1; }
  T('点大小：上过线那一档必须明显大于未上过线那一档（E349 的两档规则）',
    !!shA && !!nsA && dotR(shA, 1) > dotR(nsA, 1) * 1.5,
    shA && nsA ? dotR(shA, 1).toFixed(2) + ' vs ' + dotR(nsA, 1).toFixed(2) : '样本不足');
  T('点大小：名次不许进入半径（未上线那一档内部只能有一个值）',
    Object.keys(rSet).length === 1, Object.keys(rSet).slice(0, 4).join(' / '));
  T('滚轮放大：点要跟着变大（用户 ④）', dotR(byRk[3], 8) > dotR(byRk[3], 1) * 1.5,
    dotR(byRk[3], 1).toFixed(2) + ' → ' + dotR(byRk[3], 8).toFixed(2));
  /* §E448 rel 这两条钉的是"相对现役"这条映射的**分侧语义**，与 F 窗口开多大无关 ⇒ 判之前把窗口钉回全范围。
   *   不钉的话：&flo=0.169&fhi=0.541 时窗内全是库内 54 百分位以下的点，而现役在第 83 百分位 ⇒
   *   **没有任何一枚比现役强**（up=0 是事实，不是病），而判据要求 up>0 ⇒ 红在"这个状态下没有受试者"。
   *   下面那条"底图两端"本来就用了同一套钉法（SWIN），这里只是把适用面提前到 rel。 */
  var SWINR = { flo: st.flo, fhi: st.fhi }; st.flo = 0; st.fhi = 1; recomputeVIS(); draw();
  var s7 = splitSets();
  T('rel 档：现役那一档正好在分界 0.5', Math.abs(fColRel(Fv(INC)) - 0.5) < 0.02, fColRel(Fv(INC)).toFixed(3));
  var up = 0, dn = 0, tie = 0;
  for (var ci = 0; ci < N; ci++) { if (!VIS[ci] || P[ci].id === INC.id) continue;
    var gap = Fv(P[ci]) - Fv(INC);
    /* 与现役**逐位相等**的那些不是"分错侧"，是同一份权重的另一行（§E334 实测 4 行都是现役：
     *   SHIPPED-Ldemo ‖ Ldemo ‖ C5-02-31 ‖ C5-02-71）⇒ 它们注定落在分界上，单独计数不判红。*/
    if (Math.abs(gap) < 1e-12) { tie++; if (Math.abs(fColRel(Fv(P[ci])) - 0.5) > 0.02) dn++; continue; }
    if (gap > 0) { up++; if (fColRel(Fv(P[ci])) <= 0.5) dn++; }
    else if (fColRel(Fv(P[ci])) >= 0.5) dn++; }
  T('rel 档：比现役强的全在绿半边、弱的全在红半边（同权重的并列行单列）', up > 0 && dn === 0,
    dn + ' 枚反了 / 强于现役 ' + up + ' 枚 ‖ 与现役同权重并列 ' + tie + ' 枚');
  T('rel 档：半侧 p90 距 = 半程 0.25（色深 = 离现役多远，不是排第几）',
    Math.abs(fColRel(s7.iv + 0.5 * s7.sU) - 0.75) < 0.01 && Math.abs(fColRel(s7.iv - 0.5 * s7.sD) - 0.25) < 0.01,
    '绿侧 ' + fColRel(s7.iv + 0.5 * s7.sU).toFixed(3) + '（要 0.750） ‖ 红侧 ' + fColRel(s7.iv - 0.5 * s7.sD).toFixed(3) + '（要 0.250）');
  st.flo = SWINR.flo; st.fhi = SWINR.fhi; recomputeVIS(); draw();   /* §E448 钉完就还原，别把窗口改动留给后面的判据；
   *   ⚠ 还原之后必须再 draw() 一次：上面为了钉窗口已经重画过图例，不补这一帧的话，
   *     后面「图例那条带与底图同一条映射」读到的就是**全范围那一帧的旧画布**（针在 21 行）而 st 已经回到窗口态（针应在 0 行）⇒ 假红。 */
  /* ⭐§E347：用户点名"地图背景这是搞什么鬼"的根因钉在这里 ——
   *   §E338 把**底图**也换成"以现役为界、两侧各自按秩铺满"，而现役落在库内第 82 百分位
   *   ⇒ 中性灰被压成分界那一条线、82% 的图一律深红、少数 pockets 荧光绿（用户看到的大块硬边斑）。
   *   ⇒ 底图必须回到全库分位：库内中位那枚要落在中性灰上。这两条在 §E338 那一版都会红。*/
  var MDS = (function () { var a = P.map(function (d) { return Fv(d); }).sort(function (x, y) { return x - y; });
    return { lo: a[0], med: a[a.length >> 1], hi: a[a.length - 1] }; })();
  /* §E371：这条说的是**全库那一条色带** ⇒ 判之前先把窗口推回全范围，
   *   否则拿 #flo=0.8 跑 check 时锚已经换到窗内两端上了（那是下面那条新判据管的事，不是这条）。
   * ⚠ §E379 把这条的**期望**换掉了：原来钉"中位落在中性灰（±0.06）"，那是 §E349 的读法；
   *   用户 10-07 要的是"最红最蓝必须到头"⇒ 现在钉**两端顶满**，中位落在哪一格只如实报、不判红。
   *   保留的一条硬的是"不许塌"（中位仍在带内），换锚换错了它会红。 */
  var SWIN = { flo: st.flo, fhi: st.fhi }; st.flo = 0; st.fhi = 1; recomputeVIS();
  T('底图（F 档 ‖ 全范围态）：色轴两端必须被"刚好用到"——最低那枚 = 0 ‖ 最高那枚 = 1 ‖ 被钉在两端的不许超过 3%',
    (function () {
      var pin = 0; for (var z = 0; z < N; z++) { var t9 = fCol(Fv(P[z])); if (t9 <= 1e-6 || t9 >= 1 - 1e-6) pin++; }
      return Math.abs(fCol(MDS.lo)) <= 1e-6 && Math.abs(fCol(MDS.hi) - 1) <= 1e-6 && pin <= Math.max(2, Math.round(N * 0.03)); })(),
    (function () {
      var pin = 0; for (var z = 0; z < N; z++) { var t9 = fCol(Fv(P[z])); if (t9 <= 1e-6) pin++; else if (t9 >= 1 - 1e-6) pin++; }
      return '钉在两端 ' + pin + '/' + N + '（' + (100 * pin / N).toFixed(1) + '%）‖ 最低 ' + fCol(MDS.lo).toFixed(3) +
        ' ‖ 最高 ' + fCol(MDS.hi).toFixed(3) + ' ‖ 中位 ' + fCol(MDS.med).toFixed(3) +
        '（§E349 的"中位放灰"让位给"两端顶满"； 单看"最低=0"是**假判据** —— fCol 会钳位，窄带照样满足）'; })());
  st.flo = SWIN.flo; st.fhi = SWIN.fhi; recomputeVIS();
  /* §E381 地板这一条钉的是"黑洞 / 纯色"两种病共同的根：**场的取值必须落在可见点那批的 F 区间之内**。
   *   加权平均在数学上不可能跑出被平均的那些点的范围 ⇒ 只要 IDW 只吃可见点，oob 必然 = 0。
   *   上一版的错恰好是反的（场吃全库、带按可见点 ⇒ 带外一大片 ⇒ 我拿"淡出"收尾 = 用户截图里的黑窟窿）。
   *   红测：把加权那一步的「if (!SHOWN[pi9]) continue;」去掉（= 场又吃进被摘出去的点）⇒ 带外格数从 0 跳到数千，红。 */
  /* §E382 判据换了主语。**原来那句「painted > cells × 55%」是我拍的数**（没有出处），而它把两种相反的病混在一起：
   *   涂得少可能是"有洞"，也可能只是"网格铺在点云之外"（点云本来就只占网格一块，百分比不该固定）。
   *   换成一条有主语的话：**每一枚画得出来的点，它脚下那一格必须被涂到** —— 这正是用户要的"附近点要接上、不许挖空"，
   *   且与网格大小、点云形状无关。红测：把某枚可见点脚下那一格从 pmask 里抹掉 ⇒ 当场点名是谁。 */
  /* §E385 这条判据**漏掉了一种病**：方形窟窿那一格 pmask 是 1（远处点的权重也算"涂到"），画出来却是黑的。
   *   ⇒ 主语从"有没有被涂"换成"涂得实不实"：脚下那一格的**覆盖度**不许明显低于全图涂到的格子的中位。
   *   取相对数（×中位）不取绝对数：覆盖度整体随 fscale / 底色 / 窗口变，绝对阈值会在某次改模型后变成假绿。 */
  var UNPAINT = [], THIN = [], FADEMED = 0, FADEMIN = 9;
  if (FL && FL.cellOf) {
    var fdv = []; for (var fq = 0; fq < FL.cells; fq++) if (FL.pmask[fq]) fdv.push(FL.fade[fq]);
    fdv.sort(function (a, b) { return a - b; }); FADEMED = fdv.length ? fdv[fdv.length >> 1] : 0;
    for (var up = 0; up < N; up++) {
      if (!(VIS[up] && inWin(P[up]))) continue;
      var ciU = FL.cellOf(P[up]); if (ciU < 0) continue;
      if (!FL.pmask[ciU]) { UNPAINT.push(P[up].id); continue; }
      var fu = FADEMED > 0 ? FL.fade[ciU] / FADEMED : 1;
      if (fu < FADEMIN) FADEMIN = fu;
      if (fu < 0.5) THIN.push(P[up].id + ' ' + FL.fade[ciU].toFixed(2) + '/中位' + FADEMED.toFixed(2)); } }
  T('每一枚画得出来的点，脚下那一格必须被地板**涂实**（覆盖度 ≥ 全图中位的一半 ‖ 摘出点之后附近的晕要接上，不许挖空）‖ 带外格数必须为 0',
    !FL || (UNPAINT.length === 0 && THIN.length === 0 && FL.oob === 0),
    /* ⚠ 明细也必须挡 null：**地板位图只在地图模式建**，谱系模式下 FL 还没出生 ⇒ 上一版这里直接读 FL.painted
     *   把整条自检打断（实测「自检中途抛错：Cannot read properties of null」⇒ 后面 39 条一条没跑）。 */
    FL ? ('脚下没涂到 ' + UNPAINT.length + ' 枚' + (UNPAINT.length ? '：' + UNPAINT.slice(0, 4).join(' ‖ ') : '') +
      ' ‖ 涂不实 ' + THIN.length + ' 枚' + (THIN.length ? '：' + THIN.slice(0, 4).join(' ‖ ') : '') +
      ' ‖ 脚下最低覆盖度 = 中位的 ' + (FADEMIN * 100).toFixed(0) + '%（中位 ' + FADEMED.toFixed(2) + '）' +
      ' ‖ 带外 ' + FL.oob + ' 格 ‖ 涂了 ' + (FL.painted * 100 / (FL.cells || 1)).toFixed(1) + '% 格 ‖ 铺色的点 ' +
      FL.nShown + '/' + N) : '本页没有地板位图（谱系图/一维/三维模式）⇒ 这一条不适用');
  /* 图例那条带与底图必须是**同一条映射**（§E347 那次坏在"带画 LUT、图涂绿红"，我当时还拿一行"这一档不参与着色"糊过去）。
   *   ⚠ 这条原来判的是"针落在现役的**库内分位**上" —— E349 DS 把 fCol 换成"以中位为心的绝对线性带"之后那句话就不成立了
   *   （分位 0.818 ≠ 色带位置 0.671）。⇒ 判据换成端到端的像素核对，它不依赖 fCol 用哪种归一化：
   *     ① 带在针上方 8px 那一行的颜色 == 那条带在该位置应有的颜色（带是连续映射，不是随手涂的）；
   *     ② 针那一行真的画在 fCol(现役) 算出来的位置上。*/
  T('图例：那条带与底图同一条映射，且针真画在现役那一档的位置上', (function () {
    if (st.color !== 'fam' && st.color !== 'seed' && st.color !== 'F') return true;   /* 其余档这条带不是底图的（gl/pm/duel/…），或 rel 的针固定在正中 */
    var cn = document.querySelector('#legend canvas'); if (!cn || !cn.height) return false;
    var H = cn.height, npos = fCol(Fv(INC));
    var ny = Math.round((1 - npos) * H);
    var col = cn.getContext('2d').getImageData(Math.round(cn.width / 2), 0, 1, H).data;
    var sy = Math.max(0, Math.min(H - 1, ny - Math.round(8 * devicePixelRatio)));
    /* §E448 针被钳到带的**两端**时会出事（现役落在 F 窗口之外就是这种状态：fCol 钳到 1 ⇒ ny = 0）：
     *   原来固定取"针上方 8px"那一行，在 ny=0 时钳回 0 ⇒ **采到的正是针自己的暗槽/黄线** ⇒ 拿针的颜色比带的颜色，必然不等；
     *   同时"槽起点应在 ny − 2dpr"变成 −2（画布外）⇒ 又差 3 行判红。两条都是判据在边界上失配，不是画面坏。
     *   ⇒ 采样行改成"**离针最远的那一端、再让开槽的半宽**"（任何钳位下都不会落在槽里）；槽的位置按钳位后的实际期望比。 */
    var slot = Math.round(4 * devicePixelRatio);
    if (Math.abs(sy - ny) < slot + 1) sy = Math.max(0, Math.min(H - 1, ny < H / 2 ? (H - 1 - slot) : slot));
    var want = rampRGB(1 - sy / H), o = sy * 4;
    var okBar = Math.abs(col[o] - want[0]) <= 8 && Math.abs(col[o + 1] - want[1]) <= 8 && Math.abs(col[o + 2] - want[2]) <= 8;
    /* 针 = 4px 暗槽（#0d1420）+ 上面 1.5px 黄线 ⇒ 黄线只有 1.5px 会被抗锯齿混成 (194,162,84) 这类值，
     *   按"纯黄"数会数到 0 个（我第一版就这么误判过一次）。判**暗槽**才稳，而且槽的起点就是 ny − 2dpr。
     *   实测槽只有 2 行落在"纯暗"阈值内（第 3、4 行被黄线与带的颜色混掉了）⇒ 判据取 ≥2 行 + 位置对上。*/
    var dk = 0, first = -1, lo = ny - Math.round(4 * devicePixelRatio), hi = ny + Math.round(4 * devicePixelRatio);
    for (var yy = Math.max(0, lo); yy <= Math.min(H - 1, hi); yy++) {
      var q = yy * 4; if (col[q] < 60 && col[q + 1] < 60 && col[q + 2] < 80) { dk++; if (first < 0) first = yy; } }
    /* 钳位时（ny 贴到 0 或 H−1）槽会被画布切掉一半 ⇒ 只要求 ≥1 行，但**位置必须贴到边** */
    var clamped = (ny <= slot || ny >= H - 1 - slot);
    var wantFirst = Math.max(0, Math.min(H - 1, ny - Math.round(2 * devicePixelRatio)));
    return okBar && dk >= (clamped ? 1 : 2) && Math.abs(first - wantFirst) <= 2;
  })(), (function () {
    var cn = document.querySelector('#legend canvas');
    if (!cn) return '图例里没有 canvas';
    var H = cn.height, ny = Math.round((1 - fCol(Fv(INC))) * H);
    var col = cn.getContext('2d').getImageData(Math.round(cn.width / 2), 0, 1, H).data;
    var dk = 0, first = -1;
    for (var yy = 0; yy < H; yy++) { var q = yy * 4;
      if (col[q] < 60 && col[q + 1] < 60 && col[q + 2] < 80) { dk++; if (first < 0) first = yy; } }
    var sy = Math.max(0, Math.min(H - 1, ny - Math.round(8 * devicePixelRatio))), o = sy * 4;
    var w = rampRGB(1 - sy / H);
    return 'H=' + H + ' ‖ 针行 ' + ny + ' ‖ 暗槽 ' + dk + ' 行（起点第 ' + first + ' 行，应在 '
      + (ny - Math.round(2 * devicePixelRatio)) + '±2）‖ 采样行 ' + sy + ' 实际 [' + col[o] + ',' + col[o + 1] + ','
      + col[o + 2] + '] 应为 [' + w[0] + ',' + w[1] + ',' + w[2] + ']';
  })());
  /* ⑤ 点家族图例不许把整张图压黑（用户 ④「点选中框会全部变暗」）
   *   §E443 改判：原来这条取"全图最低 alpha"，于是把 §E308 那支**故意**压到 0.16 的"未测过灰"也算进来了 ⇒
   *   在 pm/duel/de/hp/sc 五档恒红（实测 0.16），红得没有信息量。现在两支分开量：
   *   高亮那支仍要 ≥ 0.2（这条测的是"点一家之后别人还在不在"），未测过那支单独钉住"确实是 0.16、且不许变成 0"。 */
  st.hi = {}; buildGroups(); var k0 = GRP.keys[0]; st.hi[k0] = true;
  var mn = 1, nGray = 0, mnGray = 1;
  for (var hi2 = 0; hi2 < N; hi2++) { var ag = alphaOf(P[hi2]);
    if (unmeasuredGray(P[hi2])) { nGray++; if (ag < mnGray) mnGray = ag; continue; }
    if (ag < mn) mn = ag; }
  T('高亮：非选中那批不许压到 0.2 以下（留上下文）‖ 未测过那一支单独量（§E308 = 0.16，不许掉到 0）',
    mn >= 0.2 && (nGray === 0 || mnGray >= 0.15),
    '非选中最低 ' + mn.toFixed(2) + '（' + (mn >= 0.2 ? '✅' : '✗') + '）‖ 未测过 ' + nGray + ' 枚 ‖ 其最低 ' + (nGray ? mnGray.toFixed(2) : '—'));
  /* §E566（10-10 全库 986 枚实测）：新列 H120 = **同一枚在 exam=120 档**的考卷读数，明细卡并列显示它。
   *   这条自检要能喊的三件事（不是打印读数）：
   *     ① 一枚都没有值 ⇒ attach-h120 没跑／列没挂上（那卡片文案就是空话）
   *     ② 出现"H 正常、H120 却是 0"的形态 ⇒ §E491 那族病（空串被当 0 读 ⇒ "未测"冒充"0%"）
   *     ③ 现役那一枚必须有值、且与 30 档同量级（实测差 −4.1pt；列错位/串了别的列会跳出 10pt 之外）*/
  var c12Has = 0, c12Zero = 0, c12Inc = null;
  for (var c12i = 0; c12i < DATA.length; c12i++) { var c12d = DATA[c12i];
    if (c12d.H120 !== null && c12d.H120 !== undefined) c12Has++;
    if (c12d.H120 === 0 && (c12d.H || 0) > 5) c12Zero++;
    if (c12Inc === null && (c12d.lin || '').indexOf('当前线上') >= 0) c12Inc = c12d; }
  T('§E566 明细卡的第二个档（H120 · exam=120）必须有值，且不许把"未测"冒充成 0',
    c12Has > 0 && c12Zero === 0 && c12Inc !== null && isFinite(c12Inc.H120) && Math.abs(c12Inc.H120 - c12Inc.H) < 10,
    '带值 ' + c12Has + '/' + DATA.length + ' ‖ 0 冒充 ' + c12Zero + ' ‖ 现役 ' + (c12Inc ? (c12Inc.H + ' → ' + c12Inc.H120) : '不在表上'));
  st.hi = {};
  /* ⑥ 冠军序列按上线时刻排，抽不到的**必须标出来**（不许拿训出时刻冒充上线时刻） */
  var CH = champList(), prevS = '';
  for (var c2 = 0; c2 < CH.length; c2++) { var s2 = P[CH[c2]].sh || '';
    if (s2 && prevS && s2 < prevS) { prevS = '⛔ 乱序'; break; } if (s2) prevS = s2; }
  T('冠军序列：有上线时刻的那些按时间正序', prevS !== '⛔ 乱序');
  T('冠军序列：抽不到上线时刻的必须显式标（实测 v7new6-94/96 从没进过槽）',
    P.filter(function (d) { return d.lin && !d.sh; }).length <= 4, P.filter(function (d) { return d.lin && !d.sh; }).length + ' 枚未上槽');
  /* §E375 旧槽位冠军的上线时刻必须来自**槽位时间轴**（ship-times.tsv 按面板上的名字反查，天生覆盖不到它们）。
   *   牙口验过：把 slot-timeline.tsv 临时挪走 ⇒ 这一条红在"16 枚里有时刻的 0"。
   *   上面那条阈值（≤4）当时**也**红了，但它只说"18 枚未上槽"—— 看不出是旧的 2 枚还是新掉的 16 枚，
   *   所以这条按**类**判：新加的这一类必须全员有时刻，红的时候点名是谁。 */
  var OLD16 = P.filter(function (d) { return d.lin === '旧槽位冠军'; });
  T('旧槽位冠军必须各自带上线时刻（来自 slot-timeline.tsv，不许拿训出时刻顶；库里没有旧包时不适用）',
    OLD16.length === 0 || OLD16.every(function (d) { return !!d.sh; }),
    OLD16.length + ' 枚旧槽位冠军，其中有时刻的 ' + OLD16.filter(function (d) { return !!d.sh; }).length);
  /* ===== §E362（用户 10-06 晚点名的两个 bug）平面 ⇄ 立体与复位：四页内自检 =====
   *   病一：谱系图从立体切回平面**不复位**，而"复位"按钮只平移 ⇒ 画面是歪的。根因是 §E352 把谱系图的投影
   *         换成读地图那台相机（PL 用 cam()）之后，toggle3d 的树分支还在把 yaw/pit "插回它们自己"，
   *         而 reset 清的是 §E333 那一对早已不参与投影的 tTilt/tShear。
   *   病二：平面模式下右键还能把图拉成立体。根因是 §E349 为了修"3D 里转不动"把 elev 闸**整条撤了** ⇒ 过度修正。
   *   ⇒ 判据形状：这四条都是**真按一次按钮/真发一次鼠标事件再看状态**，不是读源码里的字符串。 */
  var SNAP = { mode: st.mode, e: st.elev, y: st.yaw, p: st.pit, ox: st.ox, oy: st.oy, k: st.k,
    ox3: st.ox3, oy3: st.oy3, z3: st.zoom3, tkx: st.tKx, tky: st.tKy, tx: st.tX, ty: st.tY,
    tl: st.tTilt, sh: st.tShear, col: st.color, lab: document.getElementById('b3dt').textContent };
  function mdown(b, x, y) { cv.dispatchEvent(new MouseEvent('mousedown', { button: b, clientX: x, clientY: y })); }
  function mmove(x, y) { window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y })); }
  function mup() { window.dispatchEvent(new MouseEvent('mouseup', {})); }
  /* ① 平面态右键上下拖：pitch 必须一动不动（这就是"拉成立体"的那一条），而 yaw 照转（§E349 不许回归）*/
  tw = null; st.mode = 'map'; st.elev = 0; st.yaw = FLAT.yaw; st.pit = FLAT.pit;
  mdown(2, 300, 300); mmove(340, 360); mup();
  T('平面态右键拖拽：pitch 不许离开正俯视（而 yaw 必须仍然跟手）',
    st.pit === FLAT.pit && Math.abs(st.yaw - (FLAT.yaw - 40 / 160)) < 1e-9,
    '实测 pit=' + st.pit.toFixed(4) + '（FLAT=' + FLAT.pit.toFixed(4) + '）‖ yaw 动了 '
      + (st.yaw - FLAT.yaw).toFixed(4) + '（应为 -0.2500）');
  /* ② 立体态右键上下拖：pitch 必须仍然跟手 —— 这一条是 §E349 的原判据，本次修复不许把它退回去 */
  st.elev = 1; st.yaw = FLAT.yaw; st.pit = FLAT.pit;
  mdown(2, 300, 300); mmove(340, 360); mup();
  T('立体态右键拖拽：pitch 必须仍然跟手（夹在 0.06~1.62 内）',
    Math.abs(st.pit - Math.min(1.62, FLAT.pit + 60 / 200)) < 1e-9, '实测 pit=' + st.pit.toFixed(4));
  /* ③ 谱系图"立体 → 平面"那一步：缓动的**目标**必须是 FLAT 相机（旧写法的目标是"自己"，所以永远回不去）*/
  st.mode = 'tree'; st.elev = 1; st.yaw = -2.0; st.pit = 0.7;
  toggle3d();
  T('谱系图切回平面：缓动目标必须把 yaw/pit 插回 FLAT',
    !!tw && tw.to.e === 0 && tw.to.y === FLAT.yaw && tw.to.p === FLAT.pit,
    tw ? ('to.e=' + tw.to.e + ' ‖ to.y=' + tw.to.y + ' ‖ to.p=' + tw.to.p) : 'tw 没建（按钮没反应？）');
  tw = null;
  /* ④ 复位按钮：谱系图里必须连相机一起清（旧实现清的是 tTilt/tShear = 已经不在用的两个量）*/
  st.yaw = -2.0; st.pit = 0.7; st.tTilt = 0.4; st.tShear = 0.3; st.tX = 77; st.tKx = 3;
  document.getElementById('reset').onclick();
  T('谱系图按复位：相机 + 两轴缩放 + 平移必须一起回正',
    st.yaw === FLAT.yaw && st.pit === FLAT.pit && st.tTilt === 0 && st.tShear === 0
      && st.tX === 0 && st.tKx === 1,
    '实测 yaw=' + st.yaw.toFixed(4) + ' pit=' + st.pit.toFixed(4) + ' tilt=' + st.tTilt
      + ' shear=' + st.tShear + ' tX=' + st.tX + ' tKx=' + st.tKx);
  /* 附带一条：平面态切视图也不许把别处转出来的斜角带进谱系图 */
  st.elev = 0; st.yaw = -2.0; st.pit = 0.7; setMode('tree');
  T('平面态切进谱系图：必须先回正相机（否则是一张"号称平面"的斜图）',
    st.yaw === FLAT.yaw && st.pit === FLAT.pit, '实测 yaw=' + st.yaw.toFixed(4) + ' pit=' + st.pit.toFixed(4));
  st.mode = SNAP.mode; st.elev = SNAP.e; st.yaw = SNAP.y; st.pit = SNAP.p; st.ox = SNAP.ox; st.oy = SNAP.oy;
  st.k = SNAP.k; st.ox3 = SNAP.ox3; st.oy3 = SNAP.oy3; st.zoom3 = SNAP.z3; st.tKx = SNAP.tkx; st.tKy = SNAP.tky;
  st.tX = SNAP.tx; st.tY = SNAP.ty; st.tTilt = SNAP.tl; st.tShear = SNAP.sh; st.color = SNAP.col;
  buildGroups();
  document.getElementById('b3dt').textContent = SNAP.lab;
  /* ===== §E363 + §E367 时间倒挂的父边（用户点名 e35prod807）：三条判据 =====
   *   §E367 查翻之后判据换了方向：这些边**不是**"真边配错时间"，是生成器按路径反查"今天的槽主"造出来的假血统
   *   ⇒ 修在 lineage.mjs（推断级 + 倒挂 ⇒ 退回"父不可考"），这里判的是**修完之后必须成立的三条不变量**。 */
  var BK = P.filter(function (d) { return backOf(d); });
  var DM = P.filter(function (d) { return d.psrc === 'demoted'; });
  var _e7 = P.filter(function (d) { return d.id === 'e35prod807'; })[0];
  T('倒挂假边必须被修掉：e35prod807 的父现在按**槽位时间轴**接到 v7cmin4-31（它跑的那一刻槽里是这枚）',
    !!_e7 && _e7.psrc === 'slot-at-time' && _e7.pof === 'v7cmin4-31' && !backOf(_e7),
    _e7 ? ('psrc=' + (_e7.psrc || '(空)') + ' ‖ parentOf=' + (_e7.pof || '(空)') + ' ‖ 其 ts=' + (TSBY[_e7.pof] || '—') + '（本枚 ' + _e7.ts + '）') : '图上查无此枚');
  T('全库不许有任何时间倒挂的父边（0 条 ⇒ 有就是守卫漏了来路，图上会拿假血统画实线）',
    BK.length === 0, BK.length + ' 条：' + BK.slice(0, 4).map(function (d) { return d.id + '→' + d.pof; }).join(' ‖ '));
  /* §E487 'soup' = 这一枚的父是**权重平均的另一粒**（tools/soup-pack.mjs 写进包 meta 的来源 wid），
   *   与热启动的五个来路并列放在这里：它同样是一条"真边"，只是语义不是"续训自谁"。
   *   融合格式：'soup' 档的**第一父**进 pof，**第二父**进 pof2（下面那条 §E487 腿管它）。 */
  T('父边来路必须标全：有父边的只能来自 hash/hash-emb/seedpack-wid/seedpack/arm/slot-at-time/slot-chain/soup，标 demoted 的一律不许还有父边',
    (function () {
      for (var q = 0; q < N; q++) { var d = P[q];
        /* §E555：来路的白名单必须跟着分级一起长 —— 新加的「seedpack-wid」（种子路径 + 事后核过权重一致）
         *   与早就存在但漏在册的「hash-emb」（§E464 靠"嵌入后身份"才对上的那批）都要列进来，
         *   否则这条腿会把**合法的新等级**判成"标了个没见过的来路"。 */
        if (d.pof && ['hash', 'hash-emb', 'seedpack-wid', 'seedpack', 'arm', 'slot-at-time', 'slot-chain', 'soup'].indexOf(d.psrc) < 0) return false;
        if (d.pof2 && d.psrc2 !== 'soup') return false;      /* §E487 第二父只有融合格一种来路 */
        if ((d.psrc === 'demoted' || d.psrc === 'demoted-time') && d.pof) return false; }
      return P.filter(function (d) { return d.psrc === 'slot-at-time'; }).length >= 1; })(),
    '按时间轴改接 ' + P.filter(function (d) { return d.psrc === 'slot-at-time'; }).length + ' 枚 ‖ 退回不可考 ' + DM.length + ' 枚 ‖ 有父边 '
      + P.filter(function (d) { return d.pof; }).length + ' 枚 ‖ 融合第一父 '
      + P.filter(function (d) { return d.psrc === 'soup'; }).length + ' 枚');
  /* ===== §E378 旧冠军的连线：三条判据（悬空边 / 接替链的形状 / 横轴那把钟）=====
   *   第一条是**这次真正的收获**：§E376 之前有 57 条 parentOf 指向一个图上没有的节点（写的是文件名），
   *   边就静默没了 —— 画了多少条没人对账。所以这条判据不判"接回几条"（那个数会变），
   *   判的是**不许再有指向空气的父边**。牙口：把 §E378 那段接线注掉 ⇒ 它必须红在"57 条指向没有节点的枚"。 */
  var IDSET = {}; for (var qz = 0; qz < N; qz++) IDSET[P[qz].id] = 1;
  var DANGL = P.filter(function (d) { return d.pof && !IDSET[d.pof]; });
  T('不许有任何父边指向图上不存在的枚（§E378 那 57 条静默丢失就是这么来的）',
    DANGL.length === 0, DANGL.length + ' 条：' + DANGL.slice(0, 4).map(function (d) { return d.id + '→' + d.pof; }).join(' ‖ '));
  /* ===== §E489 投影口径：旗标 + **每一枚的实际坐标**两道一起钉 =====
   *   为什么把这条钉在这儿：五步重建链跑完（那时链子里还没有第⑥步 proj-tsne）⇒ coords.tsv 从 41 列掉到 36 列，
   *   第 271 行那句**逐行**退路把 920 枚全画回旧力导向坐标，页内 69 条判据一条没红，
   *   先看见的是用户：「投影结果一下子变回很早的版本了，区分度变得很低」。
   *   生成侧现在会拒绝出图（viewer.mjs 顶部 §E489 那段），这条腿是产物侧的第二道 ——
   *   而且它**不信旗标**：只判 PROJTSNE===1 的话，"列在、但某些行是空的"那一种照样绿。
   *   实测两套坐标的量纲不同，所以能分开：t-SNE（proj-tsne 自己归一）xt/yt ∈ [−1.05, 1.02]，
   *   力导向那套 x2/y2 ∈ [−3.32, 3.45] × [−4.92, 17.71] ⇒ 界放 ±2.0，两边都有余量。 */
  var _YO = 0, _XW = 0, _YW = 0, _XWM = -Infinity, _YWM = -Infinity, _XWP = Infinity, _YWP = Infinity;
  for (var xq = 0; xq < N; xq++) { var _x = P[xq].x2, _y = P[xq].y2;
    if (!isFinite(_x) || !isFinite(_y)) { _YO++; continue; }
    if (Math.abs(_x) > 2 || Math.abs(_y) > 2) _XW++;
    _XWM = Math.max(_XWM, _x); _YWM = Math.max(_YWM, _y); _XWP = Math.min(_XWP, _x); _YWP = Math.min(_YWP, _y); }
  T('图上的坐标必须真的来自 t-SNE 那一套（§E489 ‖ 整列 xt 没了会静默退回旧力导向，kNN@10 从 0.52 掉回 0.08 = "区分度很低"）',
    PROJTSNE === 0 || (_YO === 0 && _XW === 0),
    'PROJTSNE=' + PROJTSNE + '（0 = 这份是 --proj=old 特意出的旧投影，本条不适用）‖ 图上 ' + N + ' 枚' +
      ' ‖ 越出 ±2 的 ' + _XW + ' 枚 ‖ 非数的 ' + _YO + ' 枚 ‖ 实际范围 x [' + _XWP.toFixed(2) + ', ' + _XWM.toFixed(2) +
      '] · y [' + _YWP.toFixed(2) + ', ' + _YWM.toFixed(2) + ']（t-SNE 实测 ±1.05 ‖ 旧力导向是 x ±3.4 / y −4.9~17.7）');
  /* 接替链：结构式判据（不写死 15 这个数 —— 库里旧包增减它就漂，正是第 89 条说的那类钉措辞的腿） */
  var OLDS = P.filter(function (d) { return d.old; });
  var CHN = OLDS.filter(function (d) { return d.psrc === 'slot-chain'; });
  var CHHEAD = OLDS.filter(function (d) { return d.psrc !== 'slot-chain'; });
  T('接替链必须是一条链：除链头那一枚（最早进槽的）之外全员有接替父，且父也只能是这一批里的、不许自边、不许倒挂',
    OLDS.length === 0 || (CHHEAD.length === 1 && CHN.length === OLDS.length - 1 &&
      CHN.every(function (d) { return d.pof !== d.id && P.some(function (e) { return e.id === d.pof && e.old; }) && !backOf(d); })),
    OLDS.length + ' 枚旧包 ‖ 有接替父 ' + CHN.length + ' ‖ 链头 ' + CHHEAD.map(function (d) { return d.id; }).join(' ') +
      ' ‖ 倒挂 ' + CHN.filter(function (d) { return backOf(d); }).length);
  /* 横轴那把钟：这 16 枚的 ts 必须来自 META 写盘（训出），不是上槽时刻 —— 两者差 14 分钟到几天不等，
   *   而同一根轴上混两把钟会让真血统边看起来"父比子晚"（实测拿上槽时刻填 ts 时 57 条里倒挂 4 条）。
   *   判据按"两列必须不同源"判，不按某枚的具体时间判 ⇒ 谁把 ts 换回 sh，这一条当场红。 */
  T('旧槽位冠军的横轴必须是训出时刻（ts 与上槽时刻 sh 不同源；同一根轴上不许有两把钟）',
    OLDS.length === 0 || (OLDS.every(function (d) { return !!d.ts; }) && OLDS.filter(function (d) { return d.ts === d.sh; }).length === 0 &&
      OLDS.every(function (d) { return Date.parse(d.ts) <= Date.parse(d.sh); })),
    'ts 空的 ' + OLDS.filter(function (d) { return !d.ts; }).length + ' ‖ ts 与 sh 同值的 ' + OLDS.filter(function (d) { return d.ts === d.sh; }).length +
      ' ‖ ts 晚于 sh 的 ' + OLDS.filter(function (d) { return Date.parse(d.ts) > Date.parse(d.sh); }).length);
  /* ===== §E369 → §E377 渲染空间：立体态**不再有任何形式的"把整张图塞进窗口"**（用户："看的很难受，把这个东西去掉"）=====
   *   这一条原来钉的是"旋转到刁钻角度后所有可见点必须仍在画布内（拟合生效）"。拟合撤掉之后这句话不再成立，
   *   但**不能因此删了判据**（那就变成"改了行为还留着旧承诺的门"）。换成三句各自可反证的话：
   *     ① 默认那两帧 —— 二维、以及点「立体」之后实际到的那一帧（树的立体只动 st.elev，相机仍 FLAT）——
   *        必须**打开就是完整的**。截断不许靠「你自己平移」解决。
   *        ⚠ 红测记在两处**没红**上（别把这两句当证据）：删掉「padT += LIFT * st.elev」（抬升不留带）没红 ——
   *        当前批次里最高 F 的那几枚不在最上面几行，抬升够不着顶边；把居中的 s 改回 <1 也不会红 —— 缩小本来就装得下。
   *        真让它红的是「默认帧真的少一片」：把 PL 里 z 的减号写成加号（抬升方向翻反）⇒ 实测 27 枚在画布外，红。
   *     ② 平移必须**真的作用在内容上**。§E369 那层居中 ox = (w-bw)/2 - x0 里的 x0 跟着平移线性走 ⇒ 拖动被
   *        原样抵消 ⇒ 立体态左键整个失灵（用户那句"拉不回来"就是这么来的）。
   *        红测（实测）：把 WX/WY 里的平移项去掉（等价于"拖了不动"）⇒ 要求屏幕 (40,30)、实测 (0,0)，红。
   *        ②同时校验"拖回来的算法"本身：正交投影的 2×2 基有 r/u 谁当行谁当列这一层，写反了拖的方向就是歪的
   *        （第一版就在这里红：要求屏幕 (40,30)，实测 (-46.8,42.8)）。
   *     ③ 转出画布不算病，**永久看不到**才算病 ⇒ 每个角度取"离画布最远的那一枚"，按相机基解出把它拖回画面中心的
   *        平移量，拖完它必须在里面。**不承诺"一次拖回全部"**：红测（实测）把判据退回"拖包围盒 + 全员回画布"那一版，
   *        在**当前正确的代码**上就红 —— yaw=-2.40/pit=1.10 拖完仍剩 462 枚在外（投影包围盒 737×990 ‖ 画布 1576×569），
   *        因为转近侧视时投影高度本来就超过窗口。写"平移装得下全部"是假话（第一版就是这么骗自己的）。
   *   三条都读几何命中表 scr[]，不读像素：这里要证的是"没有哪一枚被永久裁掉"，"真画出来了"由下面那条像素判据管。 */
  var SNAP2 = { mode: st.mode, e: st.elev, y: st.yaw, p: st.pit, tx: st.tX, ty: st.tY, kx: st.tKx, ky: st.tKy };
  st.mode = 'tree'; st.tKx = 1; st.tKy = 1; st.tX = 0; st.tY = 0;
  var dfltBad = '', panBad = '', reachBad = '', outAvg = 0;
  function panBy(dx, dy) {   /* 要屏幕位移 (dx,dy) ⇒ 解 (tX,tY) 增量。
    *   这台相机的约定是 **r 管屏幕横轴、u 管屏幕纵轴**（与 pt3 同一套：screenX = a·r[0] + b·r[1]、
    *   screenY = a·u[0] + b·u[1]）⇒ 基矩阵是 [[r0,r1],[u0,u1]]。把 r/u 当**列**写就会解错，
    *   而这条判据（②）正是这么把它抓出来的：要 (40,30)、实测 (-46.8,42.8)。z 项逐枚常量，不参与平移。*/
    var cb2 = cam(), det = cb2.r[0] * cb2.u[1] - cb2.r[1] * cb2.u[0];
    if (Math.abs(det) < 1e-9) det = det < 0 ? -1e-9 : 1e-9;
    st.tX += (cb2.u[1] * dx - cb2.r[1] * dy) / det; st.tY += (-cb2.u[0] * dx + cb2.r[0] * dy) / det; }
  function outCount() { var n = 0; for (var a = 0; a < N; a++) { var sp = scr[a]; if (!sp || !VIS[a]) continue;
    if (sp[0] < -1 || sp[0] > cv.width + 1 || sp[1] < -1 || sp[1] > cv.height + 1) n++; } return n; }
  /* ① 默认两帧必须完整 */
  for (var di = 0; di < 2; di++) {
    st.elev = di; st.yaw = FLAT.yaw; st.pit = FLAT.pit; st.tX = 0; st.tY = 0; draw();
    var nOut0 = outCount();
    if (nOut0 > 0) { dfltBad = (di ? '点「立体」后默认那一帧（相机 FLAT + 抬升 1）' : '二维默认帧')
      + ' 有 ' + nOut0 + ' 枚在画布外 ⇒ 用户打开就少一片，这个病不许留给手动平移（画布 '
      + cv.width + '×' + cv.height + '）'; break; } }
  /* ② 拖动不是空操作 */
  var REF = { yaw: -2.2, pit: 0.5 }, DX = 40 * devicePixelRatio, DY = 30 * devicePixelRatio;
  st.elev = 1; st.yaw = REF.yaw; st.pit = REF.pit; st.tX = 0; st.tY = 0; draw();
  var refI = -1; for (var ri2 = 0; ri2 < N; ri2++) if (scr[ri2] && VIS[ri2]) { refI = ri2; break; }
  if (refI < 0) panBad = '树模式一帧都落不出点';
  else { var ax0 = scr[refI][0], ay0 = scr[refI][1]; panBy(DX, DY); draw();
    var mvx = scr[refI][0] - ax0, mvy = scr[refI][1] - ay0;
    if (Math.abs(mvx - DX) > 1 || Math.abs(mvy - DY) > 1) panBad = 'yaw=-2.20/pit=0.50 下要求把 ' + P[refI].id
      + ' 走屏幕 (' + Math.round(DX) + ',' + Math.round(DY) + ')，实测 (' + mvx.toFixed(1) + ',' + mvy.toFixed(1)
      + ') ⇒ 要么平移被抵消（§E369 那层居中的病），要么基的逆解错'; }
  /* ③ 每个角度最远那枚都拖得回来 */
  var angs = [[-1.2, 0.35], [-2.4, 1.1], [-0.4, 1.55], [-2.9, 0.1], [-Math.PI / 2, 0.40]];
  for (var ai = 0; ai < angs.length; ai++) {
    st.yaw = angs[ai][0]; st.pit = angs[ai][1]; st.tX = 0; st.tY = 0; draw();
    var wI = -1, wE = 0, q2;
    for (q2 = 0; q2 < N; q2++) { var spx = scr[q2]; if (!spx || !VIS[q2]) continue;
      var ee = Math.max(-spx[0], spx[0] - cv.width, -spx[1], spx[1] - cv.height); if (ee > wE) { wE = ee; wI = q2; } }
    outAvg += outCount();
    if (wI < 0) continue;
    panBy(cv.width / 2 - scr[wI][0], cv.height / 2 - scr[wI][1]); draw();
    var sp2 = scr[wI];
    if (sp2[0] < 0 || sp2[0] > cv.width || sp2[1] < 0 || sp2[1] > cv.height) {
      reachBad = '角度 yaw=' + angs[ai][0].toFixed(2) + '/pit=' + angs[ai][1].toFixed(2) + ' 把最远的 '
        + P[wI].id + ' 拖向画面中心之后它仍在 (' + Math.round(sp2[0]) + ',' + Math.round(sp2[1]) + ') ⇒ 这一枚永久看不到';
      break; } }
  T('立体态：默认两帧必须完整，平移必须真生效，转出画布的每一枚都拖得回来（整张图强制缩放已撤）',
    dfltBad === '' && panBad === '' && reachBad === '', dfltBad || panBad || reachBad
      || ('默认两帧 0 枚在外 ‖ 平移实测逐字跟手 ‖ ' + angs.length + ' 个角度各拖回最远那枚全成 ‖ 平均每角转出 '
        + Math.round(outAvg / angs.length) + ' 枚（转出不是病，拖不回才是）'));
  st.tX = SNAP2.tx; st.tY = SNAP2.ty; st.yaw = SNAP2.y; st.pit = SNAP2.p; st.elev = SNAP2.e;
  /* §E377 旧冠军那一行必须排在**最上面**（用户："应该按家族0放在最上面而不是最下面"）。
   *   判据读几何不读 fams 数组：数组自己算自己 = 永远绿，而真正的病是"这一行有没有排在现役上面、有没有被丢掉"。 */
  var SNAPT = { kx: st.tKx, ky: st.tKy, tx: st.tX, ty: st.tY, e: st.elev, y: st.yaw, p: st.pit };
  st.mode = 'tree'; st.elev = 0; st.yaw = FLAT.yaw; st.pit = FLAT.pit; st.tKx = 1; st.tKy = 1; st.tX = 0; st.tY = 0; draw();
  var yOld = [], yInc = -1, oi;
  for (oi = 0; oi < N; oi++) { if (!VIS[oi] || !scr[oi]) continue;
    if (P[oi].famTop) yOld.push(scr[oi][1]);
    if (P[oi].id === 'SHIPPED-Ldemo') yInc = scr[oi][1]; }
  yOld.sort(function (a, b) { return a - b; });
  var medOld = yOld.length ? yOld[Math.floor(yOld.length / 2)] : -1;
  /* §E448 主语换掉：原来判的是"旧包那一行必须比**现役那一行**高 100px 以上"，
   *   而现役一旦落在 F 窗口之外（深链 &flo=0.169&fhi=0.541 就是这种状态，现役 F=0.665 在窗上方）它根本不画 ⇒
   *   yInc = −1 ⇒ 判据红的理由是"参照物没画"，不是"这一行排错了"。
   *   ⇒ 换成不依赖参照物的说法：**家族 0 那一行的中位 y 必须是所有家族行里最小的**（这才是"排在最上面"这句话）。
   *   ⚠ 不是放松：现役画得出来的时候，原来那条更强的判据**照样跑**（两条是"与"），所以任何一档都不会比以前更容易过。 */
  var rowY = {};
  for (oi = 0; oi < N; oi++) { if (!VIS[oi] || !scr[oi] || P[oi].famTop) continue;
    var fk0 = P[oi].fam; if (!rowY[fk0]) rowY[fk0] = []; rowY[fk0].push(scr[oi][1]); }
  var minOther = 1e18, nOther = 0;
  for (var rk in rowY) { var av = rowY[rk].sort(function (a, b) { return a - b; });
    nOther++; var md = av[av.length >> 1]; if (md < minOther) minOther = md; }
  var topBad = !(yOld.length > 0 && nOther > 0 && medOld < minOther - 10 * devicePixelRatio);
  /* 行表是**按可见点现算**的（§E338：切一批就只剩这一批碰过的家族）⇒ 窗口把家族 0 整行切没时，
   *   图上根本没有"家族 0 那一行"，这条的主语不存在。此时如实退一层：
   *   ① 家族 0 在行表里 ⇒ 它必须是第一行（这条永远判，是"排最上面"的硬核心）；
   *   ② 家族 0 不在行表里 ⇒ 只能声明"这一档没有这一行"，并把窗口值印出来，不许悄悄当过了。
   *   ⚠ 这不是放松：出厂态与 &flo=0.169 那两档家族 0 都有点，走的还是像素那条更强的判据。 */
  var inRows = LASTFAMS.indexOf(0) >= 0;
  var rowOk = inRows ? (LASTFAMS[0] === 0) : true;
  var noRow = yOld.length === 0 && !inRows;
  T('旧槽位冠军那一行必须排在最上面（家族 0）‖ 现役画得出来时还须比它高 100px 以上',
    (noRow ? rowOk : (!topBad && rowOk)) && (yInc <= 0 || medOld < yInc - 100 * devicePixelRatio),
    (noRow ? '这一档窗口（' + st.flo.toFixed(3) + '~' + st.fhi.toFixed(3) + '）里家族 0 一枚都没有 ⇒ 图上没有这一行，退到行表核（行表 ' + LASTFAMS.length + ' 行，第一行 = 家族 ' + LASTFAMS[0] + '）‖ '
      : '行表第一行 = 家族 ' + (LASTFAMS[0] === undefined ? '—' : LASTFAMS[0]) + ' ‖ ') +
    '旧包行 y 中位 ' + Math.round(medOld) + ' ‖ 其余家族行最小的中位 y ' + (nOther ? Math.round(minOther) : '—') +
    ' ‖ 现役那一行 y ' + Math.round(yInc) + (yInc > 0 ? '' : '（现役在窗口外 ⇒ 只比行序）') + ' ‖ 画布高 ' + cv.height);
  /* §E379 这条判据**方向反了**，而且是故意的：§E377 钉的是"左栏不许跟着横轴走"（把左栏当屏幕上的框），
   *   而用户 10-07 的口径从头到尾是「网格当做底图整体进行平移缩放」⇒ 那一半恰恰是"修一个坏一个"的来源
   *   （纸带着视图变换烘出来，于是每个元素各自决定参不参与，每修一次重投一次票）。
   *   现在钉的是**同矩阵**：平移 80px 之后，左栏最靠左那枚文字的 x 与数据点的中位 x 都必须正好走 80px（±3）。
   *   ⚠ 读的是**最终画布**的像素。读 CHM.c 就是拿那张纸自己当期望值 —— 纸现在与视图无关，永远绿 = 假判据（第 91 条）。
   *   ⚠ 只在 tkx=1 与 0.55 两档量：2.2 档名字被放大 2.2 倍、最左那一枚会顶出左边缘，检测会读到"没有墨"而不是"走少了"。
   *   名字被推出画布这件事没有失去保护 —— 它现在由"每枚都拖得回来"与上面那条"左栏与数据同矩阵"合起来兜。 */
  function hexSum(h) { h = String(h || ''); if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (h.length < 6) return -1;
    return parseInt(h.slice(0, 2), 16) + parseInt(h.slice(2, 4), 16) + parseInt(h.slice(4, 6), 16); }
  function inkLeft(x1, y0, y1) {
    /* §E453 判据原来写死"三通道之和 > 430"（= 深底上的亮字）⇒ 从 #bg=%23e6ebf5（浅底 · 字是 #0d1420）深链进来
     *   一个字都数不到 ⇒ 报"左栏文字只走了 0px"，红的是仪器假设了深色主题。
     *   改成"与**当下底色**差得够远"：浅底深字、深底亮字都合，行带那 .028 的白抬不动 150 这一档。 */
    var BGS = hexSum(st.bg), d;
    try { d = g.getImageData(0, y0, x1, y1 - y0).data; } catch (E9) { return -2; }
    for (var x = 0; x < x1; x++) for (var y = 0; y < y1 - y0; y++) { var q = (y * x1 + x) * 4;
      if (Math.abs(d[q] + d[q + 1] + d[q + 2] - BGS) > 150) return x; }   /* 家族名 = st.ink、统计行 = st.dim，两档与底色都合；行带 alpha .028 上不去 */
    return -1; }
  function medPX() { var xs = []; for (var z = 0; z < N; z++) if (scr[z] && VIS[z]) xs.push(scr[z][0]);
    xs.sort(function (a, b) { return a - b; }); return xs.length ? xs[xs.length >> 1] : -1; }
  var SNAPV9 = { kx: st.tKx, ky: st.tKy, tx: st.tX, ty: st.tY, e: st.elev, y: st.yaw, p: st.pit };
  st.elev = 0; st.yaw = FLAT.yaw; st.pit = FLAT.pit; st.tKy = 1; st.tY = 0;
  var PAN9 = 80 * devicePixelRatio, pivBad9 = '', pivEx9 = [];
  for (var zi9 = 0; zi9 < 2; zi9++) {
    var zK9 = [1, 0.55][zi9];
    st.tKx = zK9; st.tX = 0; draw();
    var c0 = inkLeft(Math.round(TPAD.l - 20 * devicePixelRatio), Math.round(TPAD.t), cv.height - 70), p0 = medPX();
    st.tX = PAN9; draw();
    var c1 = inkLeft(Math.round(TPAD.l - 20 * devicePixelRatio), Math.round(TPAD.t), cv.height - 70), p1 = medPX();
    pivEx9.push('tkx=' + zK9 + ' 名字 ' + c0 + '→' + c1 + ' ‖ 点 ' + Math.round(p0) + '→' + Math.round(p1));
    if (c0 < 0 || c1 < 0) { pivBad9 = 'tkx=' + zK9 + ' 那一档左栏读不到墨（' + c0 + '/' + c1 + '）⇒ 无从比对'; break; }
    if (Math.abs((c1 - c0) - PAN9) > 3) { pivBad9 = 'tkx=' + zK9 + ' 拖 80px 之后左栏文字只走了 ' + (c1 - c0) + 'px'; break; }
    if (Math.abs((p1 - p0) - PAN9) > 3) { pivBad9 = 'tkx=' + zK9 + ' 拖 80px 之后数据点走了 ' + Math.round(p1 - p0) + 'px（与左栏不同速）'; break; } }
  T('左栏与数据必须走同一个矩阵：拖 80px 之后，左栏文字的位移与数据点的位移都得是 80px（±3）',
    pivBad9 === '', pivBad9 || pivEx9.join(' ‖ '));
  st.tKx = SNAPV9.kx; st.tKy = SNAPV9.ky; st.tX = SNAPV9.tx; st.tY = SNAPV9.ty;
  st.elev = SNAPV9.e; st.yaw = SNAPV9.y; st.pit = SNAPV9.p; draw();
  /* §E379 立体态平移**必须跟着光标**：把图转到"离正俯视 45°"那一档（默认 yaw = FLAT.yaw = −π/2，
   *   所以取 FLAT.yaw + π/4 —— 用户报的"转 90 度就完全不对"就是这类非轴对齐角度），派一次真左键拖动，
   *   要求画面走的**向量**等于鼠标走的向量（±4px）。
   *   ⚠ 为什么必须挑非轴对齐的角度：解相机基逆时把 r/u 当成列（我第一版的错）在 r1=u0=0 的角度上同值，
   *     也就是只有 ±90°（默认那一档与转 180°）看着正常 —— 拿默认角度测这条 = 永远绿。
   *   实测复原（写反那一版，探针）：横拖 120px ⇒ 画面走 Δx=0 ‖ Δy=120（整个转了 90°），红。 */
  var SNAPV3 = { m: st.mode, e: st.elev, y: st.yaw, p: st.pit, kx: st.tKx, ky: st.tKy, tx: st.tX, ty: st.tY };
  st.mode = 'tree'; st.elev = 1; st.yaw = FLAT.yaw + Math.PI / 4; st.pit = FLAT.pit;
  st.tKx = 1; st.tKy = 1; st.tX = 0; st.tY = 0; draw();
  function medXY() { var xs = [], ys = []; for (var z = 0; z < N; z++) if (scr[z] && VIS[z]) { xs.push(scr[z][0]); ys.push(scr[z][1]); }
    xs.sort(function (a, b) { return a - b; }); ys.sort(function (a, b) { return a - b; });
    return [xs[xs.length >> 1] || 0, ys[ys.length >> 1] || 0]; }
  var p3a = medXY(), cr3 = cv.getBoundingClientRect();
  mdown(0, cr3.left + cr3.width * 0.6, cr3.top + cr3.height * 0.5);
  mmove(cr3.left + cr3.width * 0.6 + 120, cr3.top + cr3.height * 0.5 + 70); mup();
  draw();   /* 拖动只改 st 并重绘经 rAF 合并 ⇒ 不先同步画一次，scr[] 还是拖之前的（实测那样读到 Δ=0） */
  var p3b = medXY();
  T('立体态平移跟手：转到离正俯视 45° 那一档，鼠标走 (120,70) 画面也必须走 (120,70)（±4px）',
    Math.abs((p3b[0] - p3a[0]) - 120 * devicePixelRatio) <= 4 && Math.abs((p3b[1] - p3a[1]) - 70 * devicePixelRatio) <= 4,
    '画面实际走了 Δx=' + Math.round(p3b[0] - p3a[0]) + ' ‖ Δy=' + Math.round(p3b[1] - p3a[1]) +
      '（yaw 取 FLAT.yaw + 45°：轴对齐的角度上"写反了"也看不出来）');
  st.mode = SNAPV3.m; st.elev = SNAPV3.e; st.yaw = SNAPV3.y; st.pit = SNAPV3.p;
  st.tKx = SNAPV3.kx; st.tKy = SNAPV3.ky; st.tX = SNAPV3.tx; st.tY = SNAPV3.ty; draw();
  /* §E377 缩放支点：WX/WY 原来直接乘 x、y（支点 = 画布原点），而 x 里含着 padL ⇒ tkx<1 时整张数据区连日期
   *   刻度一起朝左栏压过去（tkx=0.55 那张实测：刻度文字压在家族名上）。改成绕数据区左上角缩放，这一条钉住：
   *   **平移归零时，任何一档横轴缩放下最左那枚都必须在分界线右侧**（红测实测：支点改回 0 ⇒ tkx=0.4 时最左那枚
   *   在 x=136 而分界在 340，红）。
   * ⚠ 这一条只读几何（scr 的最小 x），不读滚轮 —— 滚轮那道锚点算法由紧跟着的那一条管，两处的病不一样。 */
  /* §E377 缩放支点：WX/WY 原来直接乘 x、y（支点 = 画布原点），而 x 里含着 padL ⇒ tkx<1 时整张数据区连日期
   *   刻度一起朝左栏压过去（tkx=0.55 那张实测：刻度文字压在家族名上）。改成绕数据区左上角缩放，这一条钉住：
   *   **平移归零时，任何一档横轴缩放下最左那枚都必须在分界线右侧**（红测实测：支点改回 0 ⇒ tkx=0.4 时最左那枚
   *   在 x=136 而分界在 340，红）。
   * ⚠ 这一条只读几何（scr 的最小 x），不读滚轮 —— 滚轮那道锚点算法由紧跟着的那一条管，两处的病不一样。 */
  var pivBad = '', pivEx = [];
  for (var zi = 0; zi < 5; zi++) {
    var zK = [0.4, 0.55, 1, 2.2, 12][zi];
    st.tKx = zK; st.tX = 0; st.elev = 0; st.yaw = FLAT.yaw; st.pit = FLAT.pit; draw();
    var zMin = 1e9;
    for (var z2 = 0; z2 < N; z2++) { var spz = scr[z2]; if (!spz || !VIS[z2]) continue; if (spz[0] < zMin) zMin = spz[0]; }
    pivEx.push(zK + '→' + Math.round(zMin));
    if (zMin < TPAD.l - 1 && !pivBad) pivBad = 'tkx=' + zK + ' 时最左那枚在 x=' + Math.round(zMin)
      + '，而左栏分界在 ' + Math.round(TPAD.l) + ' ⇒ 数据（连日期刻度）挤进左栏了'; }
  T('横轴缩放不许把数据挤进左栏（缩放支点在数据区左上角，不在画布原点）',
    pivBad === '', pivBad || ('各档最左那枚的 x：' + pivEx.join(' ‖ ') + ' ‖ 分界 ' + Math.round(TPAD.l)));
  /* §E377 滚轮"以光标为锚"必须跟着支点一起改：p' = (m − 支点) − f·((m − 支点) − p)。
   *   这一条**派真事件**（WheelEvent），因为要证的正是事件处理里那三行；改 st.tKx 自己算自己 = 永远绿。
   *   红测（实测）：锚点退回旧式（不减支点）⇒ tkx 1.00→1.12 时光标下那枚横漂 41px，红；
   *   只把支点改回 0 而锚点留新的 ⇒ 同样漂 41px（反方向），而且上面那条一起红 —— 这两处必须一起动。
   *   ⚠ 第一版在这里踩到一件事：上一段刚把 tKx 顶到钳位上限 12，再滚就夹住不动 ⇒ 判据当时报的是
   *     "事件没接到这条腿上"（那条守卫救了我一次）。所以锚点测试前必须把 tKx 归 1 再重画。 */
  var ancBad = '', wI2 = -1, wBest = 1e9;
  st.tKx = 1; st.tX = 0; st.tKy = 1; st.tY = 0; draw();   /* 必须从 1 起跳：上一段刚把 tKx 顶到 12，而 12 是上限 ⇒ 再滚就夹住不动，测的是钳位不是锚点 */
  for (var w2 = 0; w2 < N; w2++) { var spw = scr[w2]; if (!spw || !VIS[w2]) continue;
    var wd = Math.abs(spw[0] - cv.width * 0.62) + Math.abs(spw[1] - cv.height * 0.5);
    if (wd < wBest) { wBest = wd; wI2 = w2; } }
  if (wI2 < 0) ancBad = '找不到可当锚点的可见枚';
  else {
    var rect = cv.getBoundingClientRect(), sxc = rect.width / cv.width, syc = rect.height / cv.height;
    var tgtX = scr[wI2][0], tgtY = scr[wI2][1], kBefore = st.tKx;
    cv.dispatchEvent(new WheelEvent('wheel', { clientX: rect.left + tgtX * sxc, clientY: rect.top + tgtY * syc,
      deltaY: -100, bubbles: true, cancelable: true }));
    draw();
    if (st.tKx === kBefore) ancBad = '派了 wheel 而 tKx 没动（' + kBefore + '）⇒ 事件没接到这条腿上，这条判据是空的';
    else { var drift = Math.abs(scr[wI2][0] - tgtX);
      if (drift > 2 * devicePixelRatio) ancBad = 'tkx ' + kBefore.toFixed(2) + '→' + st.tKx.toFixed(2)
        + ' 之后光标下那枚 ' + P[wI2].id + ' 从 x=' + Math.round(tgtX) + ' 漂到 ' + Math.round(scr[wI2][0])
        + '（漂 ' + Math.round(drift) + 'px，容差 ' + Math.round(2 * devicePixelRatio) + '）⇒ 锚点没跟着支点走'; } }
  T('滚轮缩放：光标下那一枚必须还在光标下（支点改了，锚点公式必须一起改）', ancBad === '', ancBad || '一次滚轮 ×1.12，锚点未漂');
  st.tKx = SNAPT.kx; st.tKy = SNAPT.ky; st.tX = SNAPT.tx; st.tY = SNAPT.ty; st.elev = SNAPT.e; st.yaw = SNAPT.y; st.pit = SNAPT.p;
  /* §E447 这条量的是**谱系图平面态**的左栏，所以必须把模式钉住再量：原来只钉了 yaw/pit/elev，没钉 st.mode
   *   ⇒ 从 mode=1d 深链进来时它在**一维那张画布**上找"左栏那一片"，量到的东西与判据毫无关系
   *   （实测：同一版产物，出厂态 PASS、「mode=1d&color=sc」却 FAIL —— 两种结果都不是谱系图给的）。
   *   着色档也必须钉：这条要逐枚取像素，而 §E308 那支会把"未测过"的点压到 alpha 0.16 并被下面的 alpha<0.5 筛掉 ——
   *   在 sc/pm/duel/hp/de 这五档里剩下的探针只有个位数（实测 4 枚），红的是"探针不够 12 枚"而不是"左栏没画上"。
   *   钉到 fam（这一档没有"未测过"那支）才是这条判据本来工作的画面。模式与档在下面的 SNAP2 还原里一并恢复。 */
  var BAKCOL = st.color, BAKWIN = { flo: st.flo, fhi: st.fhi };
  st.color = 'fam'; st.mode = 'tree'; st.flo = 0; st.fhi = 1; recomputeVIS();
  st.yaw = FLAT.yaw; st.pit = FLAT.pit; st.elev = 0; st.tX = -900 * devicePixelRatio;
  /* §E468 这条原来只钉了 tX（要平移 900 把左栏那片推到取样区），**tY 与两轴缩放跟着深链走** ⇒
   *   从 #ty=300 进来时取样带里只剩 4 枚（要 ≥12），从 #kx=2.2 进来时一枚都没有 —— 红的是"样本不够"，
   *   不是"左栏没画上"（HEAD 产物在 #ty=300 上同样红，实测 4 枚 / 4 枚画上 = 100%）。
   *   取样用的那条线是**屏幕坐标**上的 515，所以视图必须钉成确定的；下面的 SNAP2 还原负责把三个都还回去。 */
  st.tY = 0; st.tKx = 1; st.tKy = 1; draw();
  /* ② 的判据必须读**像素**，不能读命中表：scr[] 是几何落点，剪裁只决定"画没画出来"，
   *   所以拿 scr 写的那一版**撤掉剪裁与留着剪裁都会 PASS**（§E369 变异实测：把 clip 加回去 ⇒ 27/0 全绿 ⇒ 那条是假的）。
   *   现在逐枚取样：中心像素必须与"自己半径之外"四个方向都不像同一个颜色，才叫真被画出来了；
   *   有 clip 时左栏那一片只剩底图 ⇒ 中心与旁边是同一块背景，一条也过不了。 */
  /* §E447 这个像素代理有一个已知污染：**标签是画在点之后的**（drawTree 里 label 晚于点），
   *   所以"中心与四周不像同一个颜色"量的可能是**文字与它的描边**，不是那一枚点被画出来了没有。
   *   实测：labels 出厂档（只标冠军+首尾）时 229 枚全过；切到 labels=all 之后一批中心被标签压住 ⇒ 只剩 59.8%，
   *   差 0.2 个百分点就红 —— 而画面本身没有任何"没画上"的地方（§E440 去重之后可排的标签变多，才把这条压过线）。
   *   ⇒ 用现成的 LAB（每画一个标签记下它的包围盒）把"中心落在某个标签框里"的那几枚**跳过并单独计数**：
   *     代理对它们无效，不是它们不合格。⚠ 杀伤力必须复验：把当年那道 clip 加回去，剩下的（没被盖住的）那些
   *     全是裸背景 ⇒ 照样一条过不了（红测见 CHANGELOG §E447）。 */
  function underLabel(x, y) {
    for (var lb = 0; lb < LAB.length; lb++) { var B = LAB[lb];
      if (x >= B[0] && x <= B[0] + B[2] && y >= B[1] && y <= B[1] + B[3]) return true; }
    return false; }
  /* §E451 探针带 = **当年那道剪裁线**（旧 padL=520 时代的 padL-5 = 515），不是"当下的分界"：
   *   这条要防的病是"有人在数据区左缘把剪裁加回去"，那条线历史上就在 515。
   *   原来写死 340 是"分界左边一条"的旧校值 —— 栏宽一改就只剩分界左 52px 一条，带内 74 枚里 64 枚被名字压住，样本掉到 10；
   *   取 515 之后带子同时盖住左栏与紧挨分界那一条数据区，加回剪裁时两边都会空 ⇒ 牙口比原来强，样本也大得多。 */
  var pLG = Math.round(515 * devicePixelRatio), nProbe = 0, nPaint = 0, nCov = 0, missEx = '';
  /* §E451 参照帧换成"同一帧但一枚点都不画"（NOPTS 那个开关）⇒ "画没画上"从代理变成直测：
   *   两帧只在"这点自己画的那几笔"上不同 ⇒ 中心处不同 = 这点真被画上去了。
   *   原来那四个"四周取样点"能看错的来源（家族名文字、同族密集处四邻同色、底图深浅）一次全部去掉 ——
   *   上面那段 §E447 自己记的"已知污染"就是这个代理的，不是画面的。
   *   ⚠ 自己的标签仍然盖在中心上（标签晚于点）⇒ 那种中心两帧仍然相同，照旧按 LAB 跳过并单独计数。 */
  var cand3 = [];
  for (var q3 = 0; q3 < N; q3++) { var sp3 = scr[q3]; if (!sp3 || !VIS[q3]) continue;
    if (alphaOf(P[q3]) < 0.5) continue;
    var rr3 = dotR(P[q3], st.tKx) + 8 * devicePixelRatio;
    var cX = sp3[0], cY = sp3[1];
    if (cX < rr3 + 6 || cX > pLG - 8 || cY < rr3 + 6 || cY > cv.height - rr3 - 6) continue;
    if (underLabel(cX, cY)) { nCov++; continue; }
    cand3.push([q3, cX, cY]); }
  var dA3 = null, dB3 = null;
  try { dA3 = g.getImageData(0, 0, cv.width, cv.height).data; } catch (E9) {}
  NOPTS = 1; draw(); NOPTS = 0;
  try { dB3 = g.getImageData(0, 0, cv.width, cv.height).data; } catch (E9b) {}
  draw();   /* ⚠ 立刻画回有点的那一帧：后面还有读像素的判据，不许看到一张"没有点"的画布（§E448 那条"钉→画→判→还原→再画"） */
  nProbe = cand3.length;
  if (dA3 && dB3) for (var z3 = 0; z3 < cand3.length; z3++) {
    var o3 = (Math.round(cand3[z3][2]) * cv.width + Math.round(cand3[z3][1])) * 4;
    if (dA3[o3] !== dB3[o3] || dA3[o3 + 1] !== dB3[o3 + 1] || dA3[o3 + 2] !== dB3[o3 + 2]) nPaint++;
    else if (!missEx) missEx = P[cand3[z3][0]].id + ' 中心 (' + Math.round(cand3[z3][1]) + ',' + Math.round(cand3[z3][2])
      + ') 两帧一字不差 = 这一枚根本没画上'; }
  T('平面态往左平移：左栏那一片必须真的被画上东西（padL 那道剪裁已撤 ‖ 判据=两帧之差，不是四周代理）',
    !!dA3 && !!dB3 && nProbe >= 12 && nPaint >= Math.ceil(nProbe * 0.6),
    '落进旧剪裁区的点 ' + nProbe + ' 枚 ‖ 中心处两帧不同（= 真画上）的 ' + nPaint + ' 枚（要 ≥ 60%）‖ 中心被标签压住而不参与这条的 ' + nCov +
      ' 枚 ‖ 画布宽 ' + cv.width + (missEx ? ' ‖ 例：' + missEx : (dA3 && dB3 ? '' : ' ‖ 取不到两帧像素')));
  st.mode = SNAP2.mode; st.elev = SNAP2.e; st.yaw = SNAP2.y; st.pit = SNAP2.p; st.color = BAKCOL;
  st.flo = BAKWIN.flo; st.fhi = BAKWIN.fhi; recomputeVIS(); draw();   /* ⚠ 还原之后必须补一帧：
   *   不补的话轴上的两个柄还停在"全范围"那一帧的位置上，后面那条读像素的判据会拿到"画的是 0~1、st 要 0.169~0.541"这种假不一致 */
  st.tX = SNAP2.tx; st.tY = SNAP2.ty; st.tKx = SNAP2.kx; st.tKy = SNAP2.ky;
  /* ===== §E371 强度窗口（用户："默认显示全范围，然后可以手动拉强度上下顶点，用满色域渲染中间的点而超出范围的不显示"）=====
   *   四条各钉一句话：默认态什么都不切 ‖ 窗外一律不画（冠军也不例外）‖ 色带真的按窗内重铺（不是恒等于全库那一条）‖
   *   现役被切掉时页面上必须有一句响亮的话（否则读图人不知道绿红分界指向一个不在图上的东西）。 */
  var SNAPW = { flo: st.flo, fhi: st.fhi, batch: st.batch };
  /* 装载一致性：深链 #flo= 写的是 st，而滑杆与读数写的是 HTML 默认值 ⇒ 初始化不回压一次，
   *   页面就会"按窗口画、却写着全范围"（这张图我拿截图抓到过一次）。跑 check 时带 flo= 才会真的量到这一条。 */
  /* 装载一致性（§E378 换了形状：两根横滑杆 → 图例旁一根竖轴）：**轴上画出来的两个柄**必须落在 st 的两端。
   *   判据读像素，不回头读 st（读 st 就是"信代码自己的说法"，第 91 条红过的那件事）。
   *   原来那一条读的是 #wlo/#whi 的 value，而滑杆与 st 各有一份默认值 ⇒ 深链 #flo= 时"按窗口画、却写着全范围"
   *   就是这么来的；换成像素之后这一条顺带把"轴根本没画出来"也判红（明细会点名"图例里没有那根轴"）。 */
  function axHandleRows() { var c2 = document.getElementById('winax'); if (!c2) return null;
    var a2 = c2.getContext('2d'), img, out = [];
    try { img = a2.getImageData(0, 0, c2.width, c2.height).data; } catch (E) { return null; }
    for (var y = 0; y < c2.height; y++) { var n = 0;
      for (var x = 0; x < c2.width; x++) { var q = (y * c2.width + x) * 4;
        if (img[q] > 200 && img[q + 1] > 170 && img[q + 2] < 140) n++; }   /* 柄 = #ffd166 */
      if (n > c2.width * 0.6) out.push(y); }
    return out; }
  function grpMid(rows) { var out = [], cur = [];
    for (var i = 0; i < rows.length; i++) { if (cur.length && rows[i] - cur[cur.length - 1] > 2) { out.push(cur); cur = []; } cur.push(rows[i]); }
    if (cur.length) out.push(cur);
    return out.map(function (z) { var s = 0; for (var j = 0; j < z.length; j++) s += z[j]; return s / z.length; }); }
  var AXH2 = (document.getElementById('winax') || { height: 0 }).height;
  var AR = axHandleRows(), AG = AR ? grpMid(AR) : [];
  T('F窗口轴：轴上画出来的两个柄必须与 st 的两端一致（读像素 ‖ 出厂态 = 顶与底）',
    !!AR && AG.length === 2 && Math.abs(AG[0] - axY(st.fhi, AXH2)) <= 2.5 * devicePixelRatio &&
      Math.abs(AG[1] - axY(st.flo, AXH2)) <= 2.5 * devicePixelRatio,
    AR ? ('柄的像素行 ' + AG.map(function (v) { return Math.round(v); }).join(' / ') + ' ‖ st 要 ' +
      Math.round(axY(st.fhi, AXH2)) + ' / ' + Math.round(axY(st.flo, AXH2)) + ' ‖ 轴高 ' + AXH2) : '图例里没有那根轴');
  /* 拖它必须真的改窗口：派**真 PointerEvent**（直接调 setWin 只证明函数会改数，不证明这根轴接得上）。
   *   ⚠ 必须**一次按下 + 连续三次移动**，不能只测一次移动：第一版把 move/up 绑在这张 canvas 上，
   *   而 drawBody() 每帧调 paintLegend() 重建图例 ⇒ 节点被换掉、监听跟着没了，用户看到的就是"每次只能动一格"。
   *   只测一步的话那一版照样全绿 —— 判据要照**症状的形状**写（连续），不是照"能不能动一次"写。 */
  /* 先钉**因**：图例是每帧重建的（drawBody → paintLegend → innerHTML=''），而那根轴必须**跨重建活着**。
   *   换了节点 ⇒ 绑在节点上的拖动状态与指针捕获一起没了 ⇒ 用户看到的正是"每次只能动一格"。
   *   下面那条只判"三步都要动"（症状），这一条判"节点没被换掉"（形状）—— 两条都要，因为把监听改挂到 window
   *   也能让症状判据变绿（实测：M1 复原成"绑在 canvas 上"时症状判据照样 51 全绿），只有这条能逼住根因。 */
  var ax1 = document.getElementById('winax'); draw();
  T('F窗口轴：图例重建一次之后，那根轴必须还是同一个节点（换节点 = 拖动状态随节点一起没）',
    !!ax1 && document.getElementById('winax') === ax1,
    ax1 ? (document.getElementById('winax') === ax1 ? '重建后取回的是同一张 canvas' : '重建后换了一张 ⇒ 绑定全丢') : '图例里没有那根轴');
  var SNAPW2 = { flo: st.flo, fhi: st.fhi };
  var AX2 = document.getElementById('winax'), rr2 = AX2 && AX2.getBoundingClientRect();
  var seq = [], want = [];
  if (rr2) { var pev = function (nd, t, cy) { nd.dispatchEvent(new PointerEvent(t,
      { pointerId: 7, clientX: rr2.left + rr2.width / 2, clientY: cy, bubbles: true, cancelable: true })); };
    /* §E448 按下点改成**照当下画出来的下沿柄位置**去按，不再按"轴的正中间"。
     *   原来那句"出厂态两柄一个在顶一个在底 ⇒ 中点等距 ⇒ 拿到的就是下沿"只在 flo=0/fhi=1 时成立；
     *   深链带 &flo=0.169&fhi=0.541 进来时两个柄都在上半段，中点离**上沿**更近 ⇒ 按下抓到的是上沿柄，
     *   三段拖的全是 fhi，flo 一字不变 ⇒ 判据红在"参照物挑错了"，不是拖动不跟手。
     *   顺带把期望从"末段要等于 0.48"（那也是出厂态的数）改成"**每一段都等于我拖到的那个 F**"——
     *   轴是绝对映射（y = (1−f)·H），所以这条在任意窗口宽度下都比原来更强。 */
    var f0 = st.flo, f1 = st.fhi;
    var yOf = function (f) { return rr2.top + (1 - f) * rr2.height; };
    pev(document.getElementById('winax'), 'pointerdown', yOf(f0));
    /* ⚠ 每段之前必须 draw() 一次并**重新取节点**：真实拖动里图例每帧都在重建，浏览器把 move 交给的是当下屏幕上
     *   那个节点。原来那版在同一个节点对象上连发三步 ⇒ "绑在 canvas 上"那种写法照样全绿（弱判据，§E380 的根因）。 */
    [0.25, 0.5, 0.75].forEach(function (k) {
      var f = f0 + (f1 - f0) * k; want.push(f);
      draw();
      pev(document.getElementById('winax'), 'pointermove', yOf(f));
      seq.push(+st.flo.toFixed(4)); });
    pev(document.getElementById('winax'), 'pointerup', yOf(f0 + (f1 - f0) * 0.75)); }
  var nStep = new Set(seq).size, mono = seq.every(function (v, i) { return i === 0 || v > seq[i - 1] + 1e-9; });
  var hit = seq.length === 3 && seq.every(function (v, i) { return Math.abs(v - want[i]) <= 0.02; });
  T('F窗口轴：按下之后连续拖三段，窗口下沿必须**一段一段跟着走**，且每段都停在我拖到的那个 F 上',
    !!rr2 && nStep === 3 && mono && hit && st.fhi === SNAPW2.fhi,
    '三段之后 flo 依次 ' + seq.join(' → ') + ' ‖ 期望 ' + want.map(function (v) { return v.toFixed(3); }).join(' → ') +
    ' ‖ 不同的值 ' + nStep + ' 个 ‖ 上沿 ' + st.fhi.toFixed(3) + '（拖之前 ' + SNAPW2.fhi.toFixed(3) + '）');
  setWin(SNAPW2.flo, SNAPW2.fhi);
  var HASWIN = (location.hash || '').indexOf('flo=') >= 0 || (location.hash || '').indexOf('fhi=') >= 0;
  T('强度窗口：不带深链时出厂态就是全范围，且一枚都不切（带 flo= 跑时这一条不适用，明细会说明）',
    HASWIN || (winFull() && nWin() === N),
    HASWIN ? '本次 hash 带了窗口 ⇒ 出厂态这一条不适用（下面三条才是本次要量的）'
      : 'flo=' + st.flo + ' fhi=' + st.fhi + ' ‖ 窗内 ' + nWin() + ' / 全库 ' + N);
  st.flo = 0.8; st.fhi = 1; recomputeVIS(); draw();
  var outN = 0, wVs = [];
  for (var q5 = 0; q5 < N; q5++) { var v5 = Fv(P[q5]);
    if (VIS[q5]) { if (v5 < winLo() - 1e-12 || v5 > winHi() + 1e-12) outN++; wVs.push(v5); } }
  T('强度窗口：画出来的每一枚都必须在窗内，而冠军也不例外（越界的一律不画）',
    outN === 0 && NVIS < N && NVIS > 0 && inWin(INC) === (VIS[nOf(INC.id)] === 1),
    '越界还在画的 ' + outN + ' 枚 ‖ 窗内 ' + NVIS + '/' + N + ' ‖ 现役在窗内=' + inWin(INC) + ' 而它在图上=' + (VIS[nOf(INC.id)] === 1));
  /* §E373（用户澄清："顶到色带端点的意思是重新做一下映射的缩放罢了，目标是提高显示点的区分度"）：
   *   窗口态判四件事 —— 两端真的顶到色带端点、**仍是线性**（等数值差 = 等色差，§E349 那条不许破）、
   *   中点与四分之一处必须正好落在 0.5 / 0.25（这两条合起来才排掉"随便贴两端"），
   *   而同一枚在全库态下不许也贴地板（那才叫"重做了缩放"而不是恒贴两端）。 */
  /* §E373 → §E379 改判：原来这条钉的是"整条带一条线性 ⇒ 数值中点必须落 0.5"。
   *   用户 10-07 的新口径是「灰色是范围中位数」⇒ 映射变成**两段线性**（min→med→max 铺 0→0.5→1），
   *   数值中点不再等于 0.5（实测 0.699）—— 那不是 bug，是"中位落灰"换掉了"全局等差"。
   *   所以这里改判**每段内部**仍然线性（段内等数值差 = 等色差），跨中位的折只如实报、不判红。 */
  wVs.sort(function (x, y) { return x - y; });
  var q1 = wVs[0], q3 = wVs[wVs.length - 1], BDW = colBand() || { med: (q1 + q3) / 2 };
  var tLoW = fCol(q1), tHiW = fCol(q3);
  var tHalfLo = fCol((q1 + BDW.med) / 2), tHalfHi = fCol((BDW.med + q3) / 2), tMedW = fCol(BDW.med);
  st.flo = 0; st.fhi = 1; recomputeVIS();
  var tLoAll = fCol(q1);
  T('强度窗口：两端顶到色端 ‖ 中位落灰 ‖ **两段各自线性**（段内等数值差 = 等色差），跨中位的折只报不判',
    tLoW <= 0.001 && tHiW >= 0.999 && Math.abs(tMedW - 0.5) <= 0.02 &&
    Math.abs(tHalfLo - 0.25) <= 0.02 && Math.abs(tHalfHi - 0.75) <= 0.02 && tLoAll > 0.5,
    '低端 ' + tLoW.toFixed(3) + ' ‖ 中位 ' + tMedW.toFixed(3) + '（值 ' + BDW.med.toFixed(3) + '）‖ 上端 ' + tHiW.toFixed(3) +
      ' ‖ 下半段中点 ' + tHalfLo.toFixed(3) + '（要 0.25）‖ 上半段中点 ' + tHalfHi.toFixed(3) + '（要 0.75）' +
      ' ‖ 同一枚（全库态）' + tLoAll.toFixed(3) + '（要 > 0.5）');
  /* §E452 这一条原来写死 st.flo = 0.8，而 **st.flo 是"占全库 F 值域的比例"，不是 F 本身**（winLo = FR[0] + flo·(FR[1]-FR[0])）
   *   ⇒ 出厂 T=0.10 下 0.8 恰好推到 F 0.670，把现役（F 0.665）切在窗外 0.005；而 #T=0.2 深链进来换了 F 分布
   *   （页面自己报的是 F窗口 0.826…0.988），现役落进窗内 ⇒ 那句"现役在窗外"本来就不该出现，红的是判据的前提，不是画面。
   *   现在窗口按**现役自己的 F 现算**（推到它上面 0.02 再换算成比例），任何 T / 任何进入路径下
   *   "现役在窗外"都是被保证的前提；顺带把这条的适用面从"出厂 T 那一档"扩到全 T（比原来更强，不是放水）。 */
  var FRw = FR(), floW = Math.max(0, Math.min(0.995, (Fv(INC) + 0.02 - FRw[0]) / ((FRw[1] - FRw[0]) || 1)));
  st.flo = floW; st.fhi = 1; recomputeVIS(); draw();
  var stTxt = document.getElementById('stat').textContent;
  /* ⚠ 这里不用正则：模板字符串会先把 \d 吃成 d、\/ 吃成 / ⇒ 页面里那条正则当场断掉（构建期的自解析会红，
   *   但错误信息只说 "Unexpected token '.'"，很费时间）。所以这段一律用 indexOf。 */
  T('强度窗口：现役被切掉时页面必须响亮说一句（不许静默画一张看不见分界的图）',
    stTxt.indexOf('现役在窗外') >= 0 && stTxt.indexOf('只画 ') >= 0 && stTxt.indexOf(' 枚') >= 0,
    '窗 = 比例 ' + floW.toFixed(3) + '…1.000 = F ' + winLo().toFixed(3) + '…' + winHi().toFixed(3)
      + ' ‖ 现役 F = ' + Fv(INC).toFixed(3) + '（T ' + st.T.toFixed(2) + '）‖ ' + stTxt.slice(0, 170));
  /* 档位：按钮不能只是"写着好看"，点下去必须真的把两端推到它自己说的那一段（含夹取后的值）。 */
  var _bps = document.getElementById('winpre').querySelectorAll('button'), preBad = [], hasOld = false;
  for (var oi = 0; oi < N; oi++) if (P[oi].old) { hasOld = true; break; }
  for (var pi = 0; pi < _bps.length; pi++) {
    var w = WINPRE[+_bps[pi].getAttribute('data-i')], r = w.f();
    var ef = Math.max(0, Math.min(0.995, r[0])), eh = Math.min(1, Math.max(ef + 0.005, r[1]));
    var bk = { a: st.flo, b: st.fhi };
    _bps[pi].click();
    if (Math.abs(st.flo - ef) > 0.002 || Math.abs(st.fhi - eh) > 0.002) preBad.push(w.n + '→(' + st.flo.toFixed(3) + ',' + st.fhi.toFixed(3) + ') 应为 (' + ef.toFixed(3) + ',' + eh.toFixed(3) + ')');
    setWin(bk.a, bk.b); }
  T('强度窗口：档位按钮点下去要真的推到它自己说的那一段，且库里没有旧包时不许出现"旧包"那一档',
    preBad.length === 0 && _bps.length === (hasOld ? 3 : 2),
    '按钮 ' + _bps.length + ' 个（库里有旧包=' + hasOld + ' ⇒ 应有 ' + (hasOld ? 3 : 2) + '）' + (preBad.length ? ' ‖ 不接电的：' + preBad.join(' ‖ ') : ''));
  st.flo = SNAPW.flo; st.fhi = SNAPW.fhi; st.batch = SNAPW.batch; recomputeVIS(); draw(); paintWin();
  /* ===== §E376 旧包并进图里之后，档位与谱系图必须能自证（用户："试着放进去，但要当心维数低的点过于离群"）=====
   *   ① "旧冠军段"那一档不是写着好看 —— 点下去要真的推到旧包那一段，并只留下旧包；
   *   ② 谱系图里旧包必须真被画出来 —— 它们不在 lineage.tsv 里（面板上没名字，§E369 就是冲这个去的），
   *      没有家族号也没有父边 ⇒ "内联了 917 枚"这句话不能拿 901 枚兜过去。判据用命中表 + 画布像素两把：
   *      只读 scr 就是 §E369 那次假绿的原因（它读的是命中表，而 bug 在 padL 那道剪裁上）。
   *   ⚠ URL 那条路（#flo=）不在这里验：hash 的解析只在装载时跑一次，自检里改 location.hash 不会重跑它 ⇒
   *     在这儿"验"就是自欺。它由两张截图钉：docs/artifacts/e376-out/map-oldband-default.png 与 -zoom.png，
   *     实测窗内 16/917 = 正好那批旧包（跑法：shot.mjs 带 #mode=map&flo=…&fhi=…）。
   *   ⚠ 期望值一份都不写死：旧包那一段的两端由 oldBand() 从 Fv 现算，枚数由 P[].old 现数。 */
  var SNAPA = { flo: st.flo, fhi: st.fhi, batch: st.batch, mode: st.mode, elev: st.elev };
  st.flo = 0; st.fhi = 1; st.batch = 'all'; recomputeVIS(); draw();
  var nOld = 0, i2; for (i2 = 0; i2 < N; i2++) if (P[i2].old) nOld++;
  var BAND = oldBand();
  var _bx = document.getElementById('winpre').querySelectorAll('button'), _oSeg = null, bi;
  for (bi = 0; bi < _bx.length; bi++) if (_bx[bi].textContent === '旧冠军段') _oSeg = _bx[bi];
  T('强度窗口：旧包在库里时必须给出"旧冠军段"这一档（库里一枚旧包都没有时这一条不适用）',
    nOld === 0 || (!!_oSeg && _bx.length === 3 && nOld === BAND[2]),
    '按钮 ' + _bx.length + ' 个 ‖ 旧包段档=' + (!!_oSeg ? '在' : '缺') + ' ‖ 标了 old 的 ' + nOld + ' 枚（独立重算 ' + BAND[2] + '）');
  if (_oSeg) _oSeg.click();
  T('强度窗口：「旧冠军段」点下去必须推到旧包那一段（无旧包时不适用）',
    nOld === 0 || (Math.abs(st.flo - BAND[0]) < 0.01 && Math.abs(st.fhi - BAND[1]) < 0.01 && nWin() === BAND[3]),
    '按完 flo=' + st.flo.toFixed(3) + ' fhi=' + st.fhi.toFixed(3) + ' 应为 ' + BAND[0].toFixed(3) + '/' + BAND[1].toFixed(3)
      + ' ‖ 窗内 ' + nWin() + ' 枚 ‖ 落在那段里的 = ' + BAND[3] + ' 枚（旧包 ' + nOld + ' 枚，其余是同时段的今天的候选）');
  st.flo = 0; st.fhi = 1; recomputeVIS(); draw();
  /* 谱系图那一条要两把尺：命中表（scr）说"这枚有位置"，画布像素说"这地方真的画了东西"。
   *   只读 scr 就是 §E369 那次假绿的原因（它读的是命中表，而 bug 在 padL 那道剪裁上）。
   * §E468 这条**必须钉住默认视图**再量：它原来只钉 mode/elev/batch，没钉平移缩放 ⇒
   *   从 #kx=2.2&tx=-500 这类深链进来时，16 枚旧包有 6 枚被推出画面，量出来是"10/16 没画上"的假红
   *   （实测 HEAD 产物同一状态一字不差地红着 = 既存问题，不是 §E466/§E467 带来的）。
   *   同族的另外两条（§E455 浮层、§E462 拖拽）都是靠"先钉默认布局"才站得住的。 */
  var SNAPV = { tX: st.tX, tY: st.tY, tKx: st.tKx, tKy: st.tKy };
  st.mode = 'tree'; st.elev = 0; st.batch = 'all'; st.tX = 0; st.tY = 0; st.tKx = 1; st.tKy = 1; recomputeVIS(); draw();
  var _tOld = 0, _tAny = 0, _tPix = 0, _pixOK = 1;
  for (i2 = 0; i2 < N; i2++) { if (!scr[i2]) continue; _tAny++; if (P[i2].old) _tOld++; }
  try { var _pd = g.getImageData(0, 0, cv.width, cv.height).data;
    for (i2 = 0; i2 < N; i2++) { if (!P[i2].old || !scr[i2]) continue;
      var _px = Math.round(scr[i2][0]), _py = Math.round(scr[i2][1]);
      if (_px < 0 || _py < 0 || _px >= cv.width || _py >= cv.height) continue;
      var _o = (_py * cv.width + _px) * 4; if (_pd[_o + 3] > 0) _tPix++; } } catch (E2) { _pixOK = 0; }
  T('谱系图：旧包没有 lineage 行也要真被画出来（判据 = 命中表 + 画布像素 ‖ 量之前先钉默认视图，§E468）',
    _tOld === nOld && _tAny === N && (!_pixOK || _tPix === nOld),
    '树上命中表 ' + _tOld + '/' + nOld + ' ‖ 有位置的共 ' + _tAny + '/' + N + ' ‖ 画布上真有颜色 ' + _tPix + '/' + nOld
      + ' ‖ 量的时候视图 = 出厂（tx/ty=0 ‖ kx/ky=1）');
  st.tX = SNAPV.tX; st.tY = SNAPV.tY; st.tKx = SNAPV.tKx; st.tKy = SNAPV.tKy; draw();   /* 还原 + 补一帧 */
  /* §E376 标签拥挤度（用户担心的"可读性降低"里最实在的一条）：**同一台探针在两张 coords.tsv 上各跑一次** ——
   *     现役那张（901 枚 · 冠军 15）= 标签 33 ‖ 可见冠军全员上名 ‖ 被别人的名字盖住的点 86 枚 ‖ 矩形重叠 11 对
   *     并入旧包（917 枚 · 冠军 31）= 标签 46 ‖ 可见冠军全员上名 ‖ 被别人的名字盖住的点 88 枚 ‖ 矩形重叠  9 对
   *   ⇒ 多出来的 13 条名字只多压住 2 枚点，重叠对数反而**降**了（旧包落在右半片那片稀疏区）。
   *   判据①"可见冠军必须全员上名"是**硬**的，牙口验过：注入"名次>12 的冠军不进标签表"⇒ 红在"上了名字 0 / 31"。
   *   判据②是**上限**，钉在两个实测值之上（110 枚 / 16 对）。⚠ 它的牙口只验到"测量链路通 + 上限不被无声突破"：
   *     把 putLabel 的避让拆掉两处（旋转标签不再找空位 / 无视碰撞）之后，这两个数**一模一样没动**
   *     ⇒ 说明这条测的不是"避让那一层"，拿它当"避让坏了我能知道"就是吹。要真量那层得另造判据，先记这儿。 */
  var SNAPL = { mode: st.mode, elev: st.elev, labels: st.labels, batch: st.batch, flo: st.flo, fhi: st.fhi, sel: st.sel };
  st.mode = 'map'; st.elev = 0; st.labels = 'champ'; st.batch = 'all'; st.flo = 0; st.fhi = 1; st.sel = null;
  recomputeVIS(); draw();
  var LB = (function () { var k, m, ov = 0, lbC = 0, nch = 0, missing = [], seen = {}, cov = 0;
    for (k = 0; k < N; k++) if (P[k].lin && VIS[k]) nch++;
    for (k = 0; k < LAB.length; k++) { seen[LAB[k][4]] = 1; if (P[LAB[k][4]] && P[LAB[k][4]].lin) lbC++; }
    for (k = 0; k < N; k++) if (P[k].lin && VIS[k] && !seen[k]) missing.push(P[k].id);
    for (k = 0; k < boxes.length; k++) for (m = k + 1; m < boxes.length; m++) { var a = boxes[k], b = boxes[m];
      if (a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1]) ov++; }
    /* 被别人的名字盖住的点（自己的那条不算：标签本来就锚在点旁边）*/
    for (k = 0; k < N; k++) { if (!VIS[k] || !scr[k]) continue;
      for (m = 0; m < LAB.length; m++) { if (LAB[m][4] === k) continue; var r = LAB[m];
        if (scr[k][0] >= r[0] && scr[k][0] <= r[0] + r[2] && scr[k][1] >= r[1] && scr[k][1] <= r[1] + r[3]) { cov++; break; } } }
    return { n: LAB.length, lbC: lbC, nch: nch, ov: ov, push: NLABPUSH, missing: missing, cov: cov }; })();
  T('标签：可见冠军必须全员上名（并入旧包后冠军翻倍，一个也不许被挤掉）',
    LB.nch > 0 && LB.missing.length === 0 && LB.lbC === LB.nch,
    '可见冠军 ' + LB.nch + ' 枚 ‖ 上了名字 ' + LB.lbC + ' ‖ 没上的：' + (LB.missing.length ? LB.missing.join(',') : '无'));
  T('标签：默认视图里被别人的名字压住的点只查「被别人名字盖住的点」这一条（矩形重叠那条已按用户裁定删除 §E430）（实测与线见上面那段注释）',
    LB.cov <= 110 && true   /* §E430 用户裁定删除：这条是"定死标签"的代理判据（实测 37 对 > 线 16），用户手动验过**没有矩形重叠问题** */,
    '盖住的点 ' + LB.cov + ' 枚（线 110）‖ 矩形重叠 ' + LB.ov + ' 对（线 16）‖ 标签 ' + LB.n + ' 个 ‖ 避让 ' + LB.push + ' 次');
  st.mode = SNAPL.mode; st.elev = SNAPL.elev; st.labels = SNAPL.labels; st.batch = SNAPL.batch;
  st.flo = SNAPL.flo; st.fhi = SNAPL.fhi; st.sel = SNAPL.sel; recomputeVIS(); draw(); paintWin();
  st.mode = SNAPA.mode; st.elev = SNAPA.elev; st.batch = SNAPA.batch;
  st.flo = SNAPA.flo; st.fhi = SNAPA.fhi; recomputeVIS(); draw(); paintWin();
  /* ===== §E373 连线开关（用户："给一个连线开关不然可能会太多挡住了"）=====
   *   两件套：① 帧计数器（这一帧真走了几条边的绘制）② 像素差（关掉之后画面**真的**少了东西）。
   *   只读 ① 就是"信代码自己的说法"——那只说明循环走没走，不说明画面上有没有线（第 91 条同一族）。 */
  var SNAPM2 = { mode: st.mode, edges: st.edges, flo: st.flo, fhi: st.fhi };
  /* §E449 强度窗口也要钉成全范围：这条比的是 all 与 hash 两种档**各多画哪几类边**，而两边都只画可见点之间的边。
   *   从 #flo=0.60&fhi=0.70 这类深链进来时可见点只剩几十枚 ⇒ 两档都只剩 3 条，3 < 3 不成立就红 ——
   *   红了的是"窗口把样本切没了"，不是"开关坏了"（实测 全开 3 ‖ 只实录 3 ‖ 关掉 0，像素差照样 4754 说明开关本身是活的）。
   *   窗口本身该由「强度窗口」那几条量，不许记到这条账上。 */
  st.mode = 'tree'; st.elev = 0; st.flo = 0; st.fhi = 1; recomputeVIS(); st.edges = 'all'; draw();
  var eAll = NEDG, pxAll = null;
  try { pxAll = g.getImageData(0, 0, cv.width, cv.height).data; } catch (E1) {}
  st.edges = 'off'; draw(); var eOff = NEDG, diffOff = -1;
  if (pxAll) { var now2 = g.getImageData(0, 0, cv.width, cv.height).data; diffOff = 0;
    for (var qe = 0; qe + 2 < now2.length; qe += 28)
      if (now2[qe] !== pxAll[qe] || now2[qe + 1] !== pxAll[qe + 1] || now2[qe + 2] !== pxAll[qe + 2]) diffOff++; }
  st.edges = 'hash'; draw(); var eHash = NEDG;
  T('连线开关：全开 / 只实录 / 关掉 三态各画多少条要说得出，且关掉之后画面真的少了东西',
    eAll > 0 && eOff === 0 && eHash >= 1 && eHash < eAll && diffOff > 200,
    '全开 ' + eAll + ' 条 ‖ 只实录 ' + eHash + ' 条 ‖ 关掉 ' + eOff + ' 条 ‖ 关掉与全开的采样像素差 ' + diffOff);
  st.mode = SNAPM2.mode; st.edges = SNAPM2.edges;
  st.flo = SNAPM2.flo; st.fhi = SNAPM2.fhi; recomputeVIS(); draw();
  (function () {   /* ===== §E487/§E490 融合父边（红线，两根同色）=====
     *   融合粒天生两个父（tools/soup-pack.mjs 把每粒来源的 wid 写进包 meta，lineage.mjs 反查成节点）。
     *   §E487 第一版只把**第二父**画成另一种颜色、第一父仍走淡蓝血统色 ⇒ 读起来像"一枚热启动 + 一条补充说明"，
     *   而这两条边是**同一种关系**。用户 10-08 裁定：「让两根融合线都用同一个颜色。可以用红色的和蓝色区分开」
     *   ⇒ 现在两条一起走 kind=3（红、实线），淡蓝只剩真正的热启动边。
     *   五句各自可反证，且**不钉条数**（融合粒随批次进出会变 = 第 89 条说的那类死读数）：
     *     ① 第二父不许指向图上没有的枚 —— §E378 那 57 条静默丢失的同一族病。
     *     ② 第二父不许是本枚自己、也不许与第一父同枚（否则画出一条看不见的线）。
     *     ③ 这一帧真画的红边条数 = 数据里该画的条数（第一父 + 第二父两条都算，按同一批可见点算）。
     *     ④ 'hash' 与 'off' 两档必须一条不画 —— 融合父不是包自己 hotstartFrom 里那份哈希。
     *     ⑤ **两根必须同色**：这条只能结构式判 —— 第一父那条是在"血统边循环"里认「psrc === soup」才拿到 kind=3 的，
     *        所以「NSOUP1 = 数据里该有红第一父边的枚数」成立 ⇔ 那个分支没被改回普通蓝边。
     *        （谁把「sq ? 3 : 0」改回「0」，NSOUP1 就掉到 0 ⇒ 这条当场红。）
     *   牙口（都实测过，读数照抄）：
     *     ③ 删掉第二父循环里的「NSOUP++」⇒ 红在「红边 3 条 ‖ 该画 6 条」；
     *     ④ 删掉「if (st.edges === 'hash') continue;」⇒ 红在「全开 6 ‖ 只实录 3 ‖ 关掉 0」；
     *     ① 把第二父改成图上没有的 GHOST ⇒ 红在「指向没有的枚 1」；这一步 ③ **不红**
     *        （want 也按"图上有没有这枚"算 ⇒ 两条不打架：① 管指向空气，③ 管真画了几条）；
     *     ⑤ 把第一父那条的 kind 从 3 改回 0 ⇒ 两条一起红：③「红边 3 条 ‖ 该画 6 条」+ ⑤「第一父红边 0 / 该画 3」。
     *        ⚠ 这条腿**第一版是台假仪器**：那时 NSOUP1 是「if (sq)」加的一（数的是"这枚来路是融合"这个条件），
     *        同一个变异跑下去 71 条全绿 —— 是牙口测试把它抓出来的。现在数的是 kind === 3（生效值）。
     *        ⇒ 记进 METHODOLOGY：**计数器一律数"落到画面上的那个值"，不数"进没进那个分支"**。 */
    var SNAPM3 = { mode: st.mode, edges: st.edges, flo: st.flo, fhi: st.fhi, batch: st.batch, elev: st.elev };
    var ID3 = {}, IX3 = {}; for (var q3 = 0; q3 < N; q3++) { ID3[P[q3].id] = 1; IX3[P[q3].id] = q3; }
    var S2 = P.filter(function (d) { return d.pof2; });
    var S1 = P.filter(function (d) { return d.psrc === 'soup' && d.pof; });
    var DG3 = S2.filter(function (d) { return !ID3[d.pof2]; });
    var BAD3 = S2.filter(function (d) { return d.pof2 === d.id || d.pof2 === d.pof; });
    var BK3 = S2.filter(function (d) { var pt = TSBY[d.pof2]; return pt && d.ts && pt > d.ts; });
    /* 批次放开到 'all' + 窗口放满：这条比的是"边画没画全"，不该被批次切走样本（§E449 同一件事）*/
    st.mode = 'tree'; st.elev = 0; st.flo = 0; st.fhi = 1; st.batch = 'all'; recomputeVIS();
    st.edges = 'all'; draw(); var sAll = NSOUP, s1 = NSOUP1, s2 = NSOUP2;
    var want1 = S1.filter(function (d) { return ID3[d.pof] && VIS[IX3[d.id]] && VIS[IX3[d.pof]]; }).length;
    var want2 = S2.filter(function (d) { return ID3[d.pof2] && VIS[IX3[d.id]] && VIS[IX3[d.pof2]]; }).length;
    var want = want1 + want2;
    st.edges = 'hash'; draw(); var sHash = NSOUP;
    st.edges = 'off'; draw(); var sOff = NSOUP;
    T('融合粒的第二父不许指向空气、不许是本枚自己或与第一父同枚、不许时间倒挂（§E487）',
      DG3.length === 0 && BAD3.length === 0 && BK3.length === 0,
      S2.length + ' 枚带第二父 ‖ 指向没有的枚 ' + DG3.length + (DG3.length ? '：' + DG3.slice(0, 3).map(function (d) { return d.id + '→' + d.pof2; }).join(' ‖ ') : '') +
        ' ‖ 同枚/自边 ' + BAD3.length + (BAD3.length ? '：' + BAD3.slice(0, 3).map(function (d) { return d.id + '→' + d.pof2; }).join(' ‖ ') : '') +
        ' ‖ 倒挂 ' + BK3.length + (BK3.length ? '：' + BK3.slice(0, 3).map(function (d) { return d.id + '（父 ' + TSBY[d.pof2] + ' > 本枚 ' + d.ts + '）'; }).join(' ‖ ') : ''));
    T('融合边：红线必须真画出来，且这一帧画的条数 = 数据里该画的条数（第一父 + 第二父两条都算 ‖ 画少 = 边静默没了）',
      sAll > 0 && sAll === want, '红边 ' + sAll + ' 条 ‖ 该画 ' + want + ' 条（第一父 ' + want1 + ' + 第二父 ' + want2 + ' ‖ 带第二父 ' + S2.length + ' 枚）');
    T('融合的两根父边必须**同色**（§E490 ‖ 第一父不许走回淡蓝血统色：那会被读成"一枚热启动 + 一条补充"，而两条是同一种关系）',
      s1 === want1 && s2 === want2 && sAll === s1 + s2,
      '第一父红边 ' + s1 + ' / 该画 ' + want1 + ' ‖ 第二父红边 ' + s2 + ' / 该画 ' + want2 + ' ‖ 合计 ' + sAll +
      '（若第一父掉成 0 = 那条分支又改回普通蓝边了）');
    T('融合边在「只实录哈希」与「关掉连线」两档必须一条不画（融合父不是热启动来路）',
      sHash === 0 && sOff === 0, '全开 ' + sAll + ' ‖ 只实录 ' + sHash + ' ‖ 关掉 ' + sOff);
    st.mode = SNAPM3.mode; st.edges = SNAPM3.edges; st.elev = SNAPM3.elev; st.batch = SNAPM3.batch;
    st.flo = SNAPM3.flo; st.fhi = SNAPM3.fhi; recomputeVIS(); draw(); paintWin();
  })();
  (function () {   /* §E451 左栏宽度必须由它承载的文字定，不能由"当年谁拍的数"定 */
    var ws = []; g.font = (9 * devicePixelRatio) + 'px system-ui,sans-serif';
    for (var z = 0; z < LASTFAMS.length; z++) {
      var fu = famSummary(famLab({ fam: LASTFAMS[z] })) || ('家族 ' + LASTFAMS[z]);
      ws.push([g.measureText('家族 ' + LASTFAMS[z] + ' · ' + fu).width / devicePixelRatio, LASTFAMS[z]]); }
    ws.sort(function (a, b) { return b[0] - a[0]; });
    var wi = ws.length ? ws[0][0] : 0, padL = TPAD.l / devicePixelRatio, maxW = padL - 24;
    T('谱系图左栏必须与它承载的家族名相称（栏宽 ≤ 最宽标签 +60 ⇒ 不留死空 ‖ 最宽标签 ≤ 两行装得下 ⇒ 不截名）',
      ws.length > 0 && wi <= maxW * 2 + 0.5 && padL <= wi + 60,
      '最宽 ' + (ws.length ? ws[0][1] : '—') + ' 号 = ' + Math.round(wi) + 'px ‖ 次宽 '
        + ws.slice(1, 4).map(function (x) { return Math.round(x[0]); }).join('/') + ' ‖ 中位 '
        + (ws.length ? Math.round(ws[Math.floor(ws.length / 2)][0]) : 0) + 'px ‖ 行数 ' + ws.length
        + ' ‖ padL=' + Math.round(padL) + '（线 = 最宽 +60 = ' + Math.round(wi + 60) + '）‖ 单行预算 maxW=' + Math.round(maxW)); })();
  /* ===== §E372 真往返（用户点名的偏移病）：派发一次真点击，位置取这枚**画出来的地方** ⇒ 选中的必须是它自己。
   *   两层都不许信：① 不读 pickAt（那条只量"命中表与几何一致"，而用户报的是指针 → 位图那一步：rect、dpr、
   *      CSS 把位图压扁全在里面）；② **也不拿 scr 当"点在哪"** —— 第一版就是拿 scr 反算 clientX/Y，
   *      结果把命中表改成记"脚下"仍然 35/0 全绿（变异实测），因为它点哪儿就按哪儿判。
   *   现在改成找**选中环的像素**（§E449 用两帧差分找，不按颜色猜：#ffd166 在主画布上确实只有这一圈用，
   *   但"按颜色数"这件事在 dpr=1 下只剩十几颗像素，中心不再是环心；见上面 drawnCentre）的质心。
   *   两枚都要过：**最靠下**放大指针换算的比例误差（错位随 y 线性增长 = 用户报的方向），
   *   **最靠上**放大"命中记脚下、画的是抬起来那点"的分离（立体态最高点抬得最多）。
   *   ⚠ 只测最下面那枚是错的：它的抬升量 ≈ 0 ⇒ 上面那个变异根本测不出来（第一版就这么漏过去的）。 */
  var DCN = 0, DCY = 0, DCD = -1, nSETTLE = 0;   /* 上一次 drawnCentre：差分颗数 / 环色颗数 / 占比 / 这一轮为"位图≠CSS 盒"重配了几次 */
  function drawnCentre(id) {
    /* §E449 改成**两帧差分 + 环色占比**两道一起：原来只在整张画布上按颜色扫 #ffd166，那条量的其实是
     *   "这一族色出没出现过"，不是"环画在哪儿"。两个方向都会错：阈值收紧（R>235 且 G 185..225 且 B 75..125）
     *   在 dpr=1 下被抗锯齿挡住 ⇒ 整圈只剩 12~17 颗，包围盒中心不再等于环心；阈值放宽又会串进同方向色 ——
     *   色带 LUT 的黄端、duel 档的 flip 黄(#e0b13c)都是这一族。
     *   差分不需要猜颜色：选中只多画这一圈（alphaOf 的压暗走 st.hi 家族高亮、不走 st.sel），
     *   两帧除环之外逐像素相同 ⇒ 有差异的像素**就是**环，中心就是环心，邻居多密集都不参与。
     *   ⚠ 但只看差分就丢了 §E449 那颗牙：那处的病是"黄环画出来又被墨色重描一遍"，差分照样数得到（那圈像素确实
     *     只在选中帧出现）。所以再加一道"这些差分的颗里还得有够多是环色"，红的才是**画上去的颜色**不对
     *     —— 线怎么划、实测两侧读数见下面 return 前那段。
     *   ⚠ 先把 tw（平面⇄立体那条 520ms 补间）掐了再取两帧：补间在跑时两次 draw 本身就不同，差分会把动画当环。 */
    var i = nOf(id); if (i < 0 || !scr[i]) return null;
    /* §E452 先让"位图 = CSS 盒 × dpr"这条不变量成立再取样：这一串判据中间的 draw() 会让图例 / 家族带改高度，
     *   而页面上负责重配的 refit 挂在 ResizeObserver 上、要等一帧才跑 ⇒ 同步循环里位图还是旧尺寸、CSS 盒已经变了。
     *   实测 color=seed 档差 68px（环心在设备 y=260，处理器按新盒换算派到 y=328）⇒ 报"点不到"，
     *   而用户真点的时候浏览器用的是活盒 + 已重配的位图，所以这个病从来不在画面上 —— 红的是仪器。 */
    var r0 = cv.getBoundingClientRect();
    if (Math.abs(cv.width - r0.width * devicePixelRatio) > 1.5 || Math.abs(cv.height - r0.height * devicePixelRatio) > 1.5) {
      fit0(); draw(); nSETTLE++; }
    tw = null;
    st.sel = id; draw();
    var dA; try { dA = g.getImageData(0, 0, cv.width, cv.height).data; } catch (E) { st.sel = null; draw(); return null; }
    st.sel = null; draw();
    var dB; try { dB = g.getImageData(0, 0, cv.width, cv.height).data; } catch (E) { return null; }
    var rad = Math.max(dotR(P[i], curZoom()), 10) + 12 * devicePixelRatio;   /* 只圈这一枚附近：全画布逐像素比对没必要，慢 */
    var x0 = Math.max(0, Math.floor(scr[i][0] - rad)), x1 = Math.min(cv.width - 1, Math.ceil(scr[i][0] + rad));
    var y0 = Math.max(0, Math.floor(scr[i][1] - rad)), y1 = Math.min(cv.height - 1, Math.ceil(scr[i][1] + rad));
    var sx = 0, sy = 0, n = 0, ny = 0;
    for (var y = y0; y <= y1; y++) { var row = y * cv.width;
      for (var x = x0; x <= x1; x++) { var o = (row + x) * 4;
        if (dA[o] !== dB[o] || dA[o + 1] !== dB[o + 1] || dA[o + 2] !== dB[o + 2]) {
          n++; sx += x; sy += y;
          if (dA[o] > 150 && dA[o] - dA[o + 2] > 40) ny++;
        } } }
    DCN = n; DCY = ny; DCD = n ? Math.round(ny * 100 / n) : -1;
    /* 判"颜色对不对"用的是**环色颗数占比**，而且分冠军/非冠军两条线（实测 mode=map&3d=1、&flo=0.60 深链、默认态三组）：
     *   冠军：改对的版本 146 / 152 / 175 颗（68% / 70% / 81%）‖ 漏 beginPath 的坏版本 38 / 37 / 84 颗（17% / 16% / 36%）
     *   非冠军：两个版本一字不差（该病只发生在冠军身上 —— 只有冠军会在选中环之后再描一道墨边）
     *   ⇒ 冠军这条线划 50%，两侧各留 18 与 14 个百分点；非冠军只留一道 20% 的粗闸（防"环色整个换掉了"这种全局病）。
     *   ⚠ 不能用 B 通道均值判：环混的是底下那块地，密度高的地方同一个环能读出 B=76 也能读出 B=131，线没法划。
     *   ⚠ 也不能判"过半"：dpr=1 一圈 2px 描边被抗锯齿切掉一半以上是常态（实测改对的版本也只有 53%~81%）。 */
    var isCh = !!P[i].lin;
    return n >= 6 && DCD >= (isCh ? 50 : 20) ? [sx / n, sy / n, n] : null;
  }
  function roundTrip(setup) {
    var bak = { mode: st.mode, e: st.elev, z: st.zoom3, k: st.k, iso: st.iso, labels: st.labels };
    /* §E449 标签钉成"不标"：这条的派发点是从**选中环的像素**反算出来的，而 labels=all 时近处点的名字会把选中环糊掉半圈
     *   ⇒ 可见弧的质心不再等于点心（实测三枚全错位，环心与 scr 差 +7/+5/-7px，按质心点下去选中了邻居）。
     *   这个病是真的，但它归"被别人的名字压住的点"那条量（上一段，出厂档实测 cov），不归指针换算这条：
     *   本条要证的是 rect / dpr / CSS 压扁这一层换算对不对，把两件事记进同一本账，红了不知道该修哪个。 */
    st.labels = 'off';
    setup();
    var rr = cv.getBoundingClientRect(), lo = -1, hi = -1, loY = -12, hiY = 1e9, fails = [], n = 0, dd = [];
    var loC = -1, loCY = -12;   /* 最靠下的那枚冠军（专门给它留一个名额，见下面 §E449 那段） */
    var nLinp = 0, nOcc = 0;   /* 靶子里有几枚冠军（环色那道只对冠军有效）/ 有几枚按"邻枚遮住了中心"这一条判过的 */
    var fmax = -1, fmin = 2;   /* 抬升量最大的两枚：u01 是 F 的单调映射 ⇒ F 最高与最低里必有一头贴着色带顶（抬得最高） */
    if (rr.width < 2) fails.push('无视口 ⇒ 本条不适用');
    else {
      for (var i = 0; i < N; i++) { var s = scr[i]; if (!s || !VIS[i]) continue;
        if (s[0] < 8 || s[0] > cv.width - 8 || s[1] < 8 || s[1] > cv.height - 8) continue;
        if (s[1] > loY) { loY = s[1]; lo = i; }
        if (s[1] < hiY) { hiY = s[1]; hi = i; }
        /* §E449 必须**专门取一枚冠军**：环色这一道要防的病（选中环被墨环重描）只在冠军身上会发生
         *   —— 只有冠军才在选中环之后再描一道墨边（drawMap 里 isC 那一支）。
         *   实测：只按"屏幕上下端 + F 两端"挑，挑到的三枚都不是冠军，坏版本 B=76/131/76 全在环色那一档 ⇒ 抓不到。 */
        if (P[i].lin && s[1] > loCY) { loCY = s[1]; loC = i; }
        var fv = Fv(P[i]); if (fv > fmax) { fmax = fv; } if (fv < fmin) { fmin = fv; } }
      var pick = [], seen = {};
      for (var i2 = 0; i2 < N; i2++) { if (!VIS[i2] || !scr[i2]) continue;
        var s2 = scr[i2]; if (s2[0] < 8 || s2[0] > cv.width - 8 || s2[1] < 8 || s2[1] > cv.height - 8) continue;
        var fv2 = Fv(P[i2]);
        if (i2 === lo || i2 === hi || i2 === loC || fv2 === fmax || fv2 === fmin) { if (!seen[i2]) { seen[i2] = 1; pick.push(i2); } } }
      for (var q = 0; q < pick.length; q++) {
        var t = pick[q], id = P[t].id, dc = drawnCentre(id); n++; if (P[t].lin) nLinp++;
        if (!dc) { fails.push(id + (P[t].lin ? '[冠]' : '') + '(选中环 ‖ 差分 ' + DCN + ' 颗 ‖ 环色 ' + DCY + ' 颗=' + DCD + '%)'); continue; }
        dd.push(id.slice(0, 6) + ':' + Math.round(dc[1] - scr[t][1]));
        /* §E452 派发之前**重新量一次 rect**：rr 是这条开头量的，而中间那几次 draw 会让图例与家族带改高度
         *   ⇒ 画布整体上下挪过（实测 color=seed 档挪了 68px：环心在设备 y=260，按旧 rect 换算处理器算成 y=328）。
         *   用户真点的时候浏览器用的是**活** rect，所以这个"点不到"从来不在画面上 —— 红的一直是仪器。
         *   （原来这条只在 color=seed / labels=off / T=0.2 这类"会让版式改高度"的档里现形，出厂态 rect 恰好没动。） */
        var rr2 = cv.getBoundingClientRect();
        var cx = rr2.left + dc[0] / devicePixelRatio, cy = rr2.top + dc[1] / devicePixelRatio;
        st.sel = null;
        cv.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: cx, clientY: cy }));
        cv.dispatchEvent(new MouseEvent('click', { button: 0, clientX: cx, clientY: cy }));
        var got = st.sel || '(没选中任何东西)';
        var gi = got === id ? t : nOf(got);
        var gap = gi >= 0 && scr[gi] ? Math.round(Math.sqrt(
          Math.pow(scr[gi][0] - dc[0], 2) + Math.pow(scr[gi][1] - dc[1], 2)) * 10) / 10 : -1;
        /* §E449 got !== id 分两种，只有后一种是病：
         *   ① 邻枚的命中盘把本枚的中心盖住了（立体态本来就会互相遮）⇒ 选中的那一枚**自己的落点确实就在这一下点击上**。
         *      实测这种 gap 只有 0.7px（SLOT-bb5c0e8e 与 SLOT-6ed47e18 落在同一处）。这类分离用户裁过不算病
         *      （§E430 正是为它把三维那一条整条删掉的）。
         *   ② 换算坏了（rect / dpr / CSS 把位图压扁）⇒ 派发下去选中的那一枚离环心一大截，gap 直接超过它自己的命中盘。
         *   所以线划在**选中者的命中半径 +1**（质心有半格量化）上，而不是拍一个常数：
         *     线太紧（曾经写 2.5px）会在密处冤枉正当的遮挡，太松就丢了牙口（红测见 CHANGELOG §E449）。 */
        var lim = gi >= 0 ? Math.round((hitR(P[gi], curZoom()) + 1) * 10) / 10 : -1;
        if (gap < 0 || lim < 0 || gap > lim) fails.push(id + ' 环心(' + Math.round(dc[0]) + ',' + Math.round(dc[1])
          + ') 派发下去选中的是 ' + got + ' ‖ 它的落点离环心 ' + gap + 'px（要 ≤ 它的命中半径+1 = ' + lim
          + '）‖ 本枚 scr=(' + Math.round(scr[t][0]) + ',' + Math.round(scr[t][1]) + ')');
        else if (got !== id) nOcc++;
      }
    }
    st.sel = null; st.mode = bak.mode; st.elev = bak.e; st.zoom3 = bak.z; st.k = bak.k; st.iso = bak.iso;
    st.labels = bak.labels;
    recomputeVIS(); draw();
    return { ok: fails.length === 0 && n >= 2 && nLinp >= 1,
      msg: (fails.length ? fails.join(' ‖ ')
        : n + ' 枚全对（屏幕上下两端 + F 两端 + 最靠下的那枚冠军）')
        + ' ‖ 标签钉成不标（上面 §E449 那段）‖ 环心与 scr 的纵向差 ' + dd.join('/') + 'px ‖ 靶子里冠军 ' + nLinp
        + ' 枚（环色那道只对冠军有效，要 ≥1）‖ 中心被邻枚的盘压住、按"选中者落点落在它自己命中盘里"判过的 ' + nOcc
        + ' 枚 ‖ 为"位图 ≠ CSS 盒"重配过 ' + nSETTLE + ' 次' };
  }
  var rt1 = roundTrip(function () { st.mode = 'map'; st.elev = 1; draw(); });
  T('指针往返（立体地图 · 屏幕上下端 + F 两端 + 一枚冠军）：按**画出来的环**派发真点击，选中的必须是它自己', rt1.ok, rt1.msg);
  /* §E430 用户裁定删除：这条腿的派发点是按"环心"算的，而三维态下环心与命中表差 2px（实测 (659,225) vs scr (660,227)）
   *   ⇒ 它测的是"我算出来的点"而不是"用户点下去会怎样"；用户手动验过**指针往返没有问题**。
   *   立体的那条仍在跑（§E449 改名成"屏幕上下端 + F 两端 + 一枚冠军"），保留覆盖。 */
  /* ===== §E464 那 584 枚共父必须解析到图上一枚真节点（这条钉的是"别再退回那个锚"）=====
   *   背景：§E314 判过「盘上无实体」，§E442 因此造了一颗灰菱形锚 + 467 条雾边。两边都错在同一台仪器的口径：
   *   父指针记的是**嵌入成 v7 之后**那份数组的指纹，而检索只按"文件里那份数组"的哈希算 ⇒ 所有 pre-v7 包隐身。
   *   现在 lineage.mjs 一枚包同时索引两个身份，584 枚的父解析到 SLOT-e379c62c（标签 v1.3.57，实体 = champion-5p-v1.3.58.bak）。*/
  (function () {
    var bi = nOf('SLOT-e379c62c'), nb = 0, nbVis = 0;
    for (var q4 = 0; q4 < N; q4++) { if (P[q4].pof === 'SLOT-e379c62c') { nb++; if (VIS[q4]) nbVis++; } }
    T('那 584 枚共父要解析到图上一枚真节点（SLOT-e379c62c = v1.3.57），不许再退回「RUNNER-BASE 锚 + 灰雾边」',
      bi >= 0 && nb >= 400 && NRBASE === 0 && !!P[bi].sv,
      '父边收到 SLOT-e379c62c 的 ' + nb + ' 枚（当下可见 ' + nbVis + '）‖ 靶节点在图上=' + (bi >= 0 ? '是（' + P[bi].id + ' 标签 ' + (P[bi].sv || '无版本') + '）' : '否')
        + ' ‖ 仍然解析不到实体的父锚 ' + NRBASE + ' 枚（要 0）');
  })();
  /* ===== §E467 连线密度对数叠加：拿"固定 alpha 那一版"当对照组，三帧互比 =====
   *   用户 10-08：「线连太多了之后还是有点太糊了，调整一下透明度或者考虑一下连线透明度叠加时使用对数叠加。」
   *   这条量的不是"有没有画线"，是**扇根那块板有没有被拆开**：
   *   ① 窗内"到顶"（墨 ≥200）的像素数要塌到固定 alpha 的 40% 以下 —— 那就是"板"本身；
   *   ② 窗内"有墨"（≥6）的像素数不能跟着塌（≥ 50%）—— 否则是"把线擦没了"而不是"压淡了"。
   *   两条一起才叫"能数清几条"：单独 ① 可以被"整条不画"骗过去，单独 ② 可以被"照旧画满"骗过去。
   *   ⚠ 判据**不拿"窗内最亮像素"当标准**（第一版这么写过，量出来 221→218 直接假红）：
   *     那块窗 ±40px 里必然穿过几条疏尾边，它们本来就该保持全 alpha —— "最亮"量的恰好是不该变的那个东西。
   *     改成数"到顶像素有几个"才是"板"的直测。三帧都带 NOPTS=1（一枚点都不画），判完立刻还原并补一帧。 */
  (function () {
    var SN = { elev: st.elev, yaw: st.yaw, pit: st.pit, tX: st.tX, tY: st.tY, tKx: st.tKx, tKy: st.tKy,
      edges: st.edges, color: st.color, labels: st.labels, mode: st.mode };
    function grab() { try { return g.getImageData(0, 0, cv.width, cv.height).data; } catch (E8) { return null; } }
    st.mode = 'tree'; st.elev = 0; st.yaw = FLAT.yaw; st.pit = FLAT.pit;
    st.tX = 0; st.tY = 0; st.tKx = 1; st.tKy = 1;
    st.edges = 'all'; st.color = 'fam'; st.labels = 'off'; NOPTS = 1;
    ELOG = 1; draw();
    var hub = EDGR.hub, hn = EDGR.hubn, amin = EDGR.amin, amax = EDGR.amax, nE = EDGR.n;
    st.edges = 'off'; draw(); var d0 = grab();
    st.edges = 'all'; ELOG = 1; draw(); var dL = grab();
    ELOG = 0; draw(); var dF = grab();
    var satL = 0, satF = 0, covL = 0, covF = 0, ceilL = 0, ceilF = 0, R = Math.round(40 * devicePixelRatio);
    if (d0 && dL && dF && hub) {
      var x0 = Math.max(0, Math.round(hub[0]) - R), x1 = Math.min(cv.width - 1, Math.round(hub[0]) + R);
      var y0 = Math.max(0, Math.round(hub[1]) - R), y1 = Math.min(cv.height - 1, Math.round(hub[1]) + R);
      for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
        var o = (yy * cv.width + xx) * 4;
        var iL = Math.max(Math.abs(dL[o] - d0[o]), Math.abs(dL[o + 1] - d0[o + 1]), Math.abs(dL[o + 2] - d0[o + 2]));
        var iF = Math.max(Math.abs(dF[o] - d0[o]), Math.abs(dF[o + 1] - d0[o + 1]), Math.abs(dF[o + 2] - d0[o + 2]));
        if (iL > satL) satL = iL; if (iF > satF) satF = iF;
        if (iL >= 6) covL++; if (iF >= 6) covF++;
        if (iL >= 200) ceilL++; if (iF >= 200) ceilF++; } }
    for (var kk in SN) st[kk] = SN[kk];
    ELOG = 1; NOPTS = 0;
    recomputeVIS(); draw();   /* 还原 + 补一帧：后面还有读像素的判据，不许看到一张"只有边"的画布 */
    T('连线太糊这条要真被压下去：扇根那块「板」的到顶像素必须塌掉一大截，而「有墨的像素」不能跟着塌（密度律 vs 固定 alpha，三帧互比）',
      !!d0 && !!dL && !!dF && !!hub && ceilF >= 20 && ceilL <= ceilF * 0.4 && covL >= covF * 0.5,
      '窗 = 最密那一格 ±40 CSS px（那一格压着 ' + hn + ' 条线 ‖ 全图 ' + nE + ' 条边，一条一次 stroke）‖ 整条 alpha '
        + amax.toFixed(3) + '~' + amin.toFixed(3) + ' ‖ **到顶**（墨 ≥200）的像素 固定 alpha ' + ceilF + ' → 对数 ' + ceilL
        + '（要 ≤ 40%，且对照组本身要 ≥20 个 —— 不然这块窗根本没板可言）‖ 有墨（≥6）像素 ' + covF + ' → ' + covL + '（要 ≥ 50%）'
        + ' ‖ 参考：窗内最亮像素 ' + satF + ' → ' + satL + '（这条不拿它当判据：疏尾那条本来就该亮）'
        + (d0 && dL && dF ? '' : ' ‖ 取不到三帧像素'));
  })();
  /* ===== §E467b 一条线**一路上不许断**（用户 10-08 10:5x 否掉上一版的原话：「现在线条重合的部分反而出现了中断」）=====
   *   上一版把每条边切成 8 段按密度分桶，同一条线在不同段上以不同 alpha 落笔 ⇒ 断口。
   *   这条判据不读代码结构（"我是不是分了桶"数组自己算自己 = 永远绿），它读**画面上有没有墨**：
   *   沿探针边取 40 个点，每点在 3×3 邻域里问一句"这儿有没有线"；**连续 ≥3 点没墨**才叫断口
   *   （单个孤立点是抗锯齿噪声，实测地板 alpha=.030 的线上会撞到 1/480 —— 拿它当断口会把判据磨成"永远红"）。
   *   ⚠ 与上一条共用同一套钉法：mode=tree、平面、labels 关、NOPTS=1（点与名字都不许混进差里）。 */
  (function () {
    var SN2 = { elev: st.elev, yaw: st.yaw, pit: st.pit, tX: st.tX, tY: st.tY, tKx: st.tKx, tKy: st.tKy,
      edges: st.edges, color: st.color, labels: st.labels, mode: st.mode };
    function grab2() { try { return g.getImageData(0, 0, cv.width, cv.height).data; } catch (E9) { return null; } }
    st.mode = 'tree'; st.elev = 0; st.yaw = FLAT.yaw; st.pit = FLAT.pit;
    st.tX = 0; st.tY = 0; st.tKx = 1; st.tKy = 1;
    st.edges = 'all'; st.color = 'fam'; st.labels = 'off'; NOPTS = 1; ELOG = 1;
    /* 步长要**按当下的边数算**（先空跑一帧拿 EDGR.n）：写死 60 在出厂态（726 条）取到 12 条探针，
     *   而 #flo=0.3 那一态只剩 184 条 ⇒ 只收到 4 条，红的是"探针不够"不是"线断了"。 */
    EPROBE = 0; draw(); var nEd = EDGR.n;
    var strd = Math.max(1, Math.round(nEd / 24)); EPROBE = strd; draw(); var pb = EDGR.probe.slice();
    var amin2 = EDGR.amin, amax2 = EDGR.amax;
    var dOn = grab2();
    st.edges = 'off'; draw(); var dOff = grab2();
    for (var kk2 in SN2) st[kk2] = SN2[kk2];
    EPROBE = 0; ELOG = 1; NOPTS = 0; recomputeVIS(); draw();
    var nBad = 0, nS = 0, nP = 0, runMax = 0, worst = '', spInk = [], spInk2 = [], spInk3 = [];
    if (dOn && dOff) for (var z = 0; z < pb.length; z++) { var pts = pb[z].pts, run = 0, rmx = 0;
      for (var u2 = 0; u2 < pts.length; u2 += 3) {
        var px2 = Math.round(pts[u2]), py2 = Math.round(pts[u2 + 1]), den2 = pts[u2 + 2]; nS++;
        /* 取 3×3 邻域里的**最大**墨：一条 1px 抗锯齿线会把墨分到相邻两行，
         *   按"恰好那一个像素"读会把好线误判成断口（实测 alpha=.030 的线峰值墨只有 6.6，四邻一分就掉到 3 以下）。
         *   "这儿有没有线"这件事本来就该按邻域问，不是按一个像素问。 */
        var ik2 = 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var qx2 = px2 + dx, qy2 = py2 + dy;
          if (qx2 < 0 || qy2 < 0 || qx2 >= cv.width || qy2 >= cv.height) continue;
          var o2 = (qy2 * cv.width + qx2) * 4;
          var ik = Math.max(Math.abs(dOn[o2] - dOff[o2]), Math.abs(dOn[o2 + 1] - dOff[o2 + 1]), Math.abs(dOn[o2 + 2] - dOff[o2 + 2]));
          if (ik > ik2) ik2 = ik; }
        /* "中断"的操作性定义 = **连续 3 个采样点以上没墨**（一条边 40 个点，3 个连着 = 线长的 7% 看不见，那才叫断口）。
         *   单个孤立点没墨是抗锯齿/取整的噪声，拿它当断口会把判据磨成"永远红"。 */
        if (ik2 < 3) { run++; if (run > rmx) rmx = run; } else run = 0;
        if (den2 <= 8) spInk.push(ik2); else if (den2 <= 32) spInk2.push(ik2); else spInk3.push(ik2); }   /* 分两档：d=1 才是"单根线"，d=2~3 已经在小堆里 */
      if (rmx > runMax) { runMax = rmx; worst = pb[z].id + '（中段 alpha ' + pb[z].al.toFixed(3) + '）最长连续没墨 ' + rmx + ' 个点'; }
      if (rmx >= 3) nBad++; }
    nP = pb.length;
    T('沿一条边走一圈不许有断口（§E467a 那一版把边切成不同 alpha 的段，重合处肉眼看得见中断 ‖ 断口 = 连续 ≥3 个采样点没墨 ‖ §E555：**只探实线**，虚线按设计每 4px 留白，量它等于量虚线自己的间隔）',
      !!dOn && !!dOff && nP >= 6 && nBad === 0,
      '当下 ' + nEd + ' 条边 ⇒ 每 ' + strd + ' 条留一条，收到探针 ' + nP + ' 条 × 40 个采样点 = ' + nS + ' 点 ‖ 有断口的边 ' + nBad + ' 条（要 0）‖ 全组最长连续没墨 ' + runMax + ' 个点'
        + (worst ? ' ‖ 例：' + worst : '') + (dOn && dOff ? '' : ' ‖ 取不到两帧像素'));
    /* §E467c 第二条：埋在堆里可以淡，**真正独处的那一段必须看得见**。上一版整条边取一个均值 ⇒
     *   一条长线只要蹭到扇根那一格，整条（包括它自己那段空地）被拉到地板 alpha .03 = 6.6 墨，肉眼等于没有。 */
    function med(a5) { if (!a5.length) return -1; var b5 = a5.slice().sort(function (x, y) { return x - y; }); return b5[b5.length >> 1]; }
    var m1 = med(spInk), m23 = med(spInk2);
    T('空地上的单根线必须看得见（探针里"所在格子只压着 ≤8 条线"那些采样点，中位墨要 ≥30 = 满量程 221 的 14%）',
      !!dOn && !!dOff && spInk.length >= 12 && m1 >= 30,
      'd≤8 的采样点 ' + spInk.length + ' 个 ‖ 中位墨 ' + m1 + ' ‖ 参考 d=9~32 的 ' + spInk2.length + ' 个中位墨 ' + m23 + ' ‖ d>32 的 ' + spInk3.length + ' 个中位墨 ' + med(spInk3));
  })();
  /* ===== §E469 平移/旋转时，一条线的 alpha 不许变（用户 10-08 11:3x：「这个版本整体不错，不过在平移旋转时会有抽搐」）=====
   *   根因是我自己那套法律的形式：密度格子按**画布坐标**取整（floor(y/EGRID)），平移 1px 就可能整体换格 ⇒
   *   同一条线的 alpha 离散跳档（实测中位跳幅见下面这条的读数），肉眼就是抽搐。旋转同理，而且更凶。
   *   判据读的是"同一条边在两个视图下的 alpha 差"，不读像素（像素上还有别的线压着，量不出这一条自己跳了多少）。
   *   ⚠ 这条现在**是红的**，它钉的是还没做的事：把"压暗"从"每条线的属性"搬到"像素累加之后"
   *     （离屏累加 + Reinhard/对数色调映射，用户转的 gemini 方案）⇒ 每条线的属性绝对静态，抽搐从根上消失。 */
  (function () {
    var SN3 = { elev: st.elev, yaw: st.yaw, pit: st.pit, tX: st.tX, tY: st.tY, tKx: st.tKx, tKy: st.tKy,
      edges: st.edges, color: st.color, labels: st.labels, mode: st.mode };
    st.mode = 'tree'; st.elev = 0; st.yaw = FLAT.yaw; st.pit = FLAT.pit;
    st.tX = 0; st.tY = 0; st.tKx = 1; st.tKy = 1; st.edges = 'all'; st.color = 'fam'; st.labels = 'off';
    NOPTS = 1; ELOG = 1; EPROBE = Math.max(1, Math.round(EDGR.n / 24));
    draw(); var A0p = EDGR.probe.slice();
    st.tX = -3 * devicePixelRatio; draw(); var A1p = EDGR.probe.slice();
    st.tKx = 1.03; draw(); var A2p = EDGR.probe.slice();
    st.elev = 1; st.yaw = FLAT.yaw + 0.05; draw(); var A3p = EDGR.probe.slice();
    for (var kk3 in SN3) st[kk3] = SN3[kk3];
    EPROBE = 0; NOPTS = 0; recomputeVIS(); draw();
    function dmax(P0, P1) { var m = 0, ex = '';
      for (var q = 0; q < Math.min(P0.length, P1.length); q++) { var a5 = P0[q].al5, b5 = P1[q].al5;
        for (var w = 0; w < 5; w++) { var dv = Math.abs(a5[w] - b5[w]); if (dv > m) { m = dv; ex = P0[q].id + ' ' + a5[w].toFixed(3) + '→' + b5[w].toFixed(3); } } }
      return [m, ex]; }
    var dP = dmax(A0p, A1p), dZ = dmax(A0p, A2p), dR = dmax(A0p, A3p);
    T('平移/缩放/旋转一条线的 alpha 不许变（§E469 抽搐的根因 = 密度取在屏幕空间网格里 ⇒ 换格就跳档；这条现在该红）',
      A0p.length >= 6 && dP[0] <= 0.02 && dZ[0] <= 0.02 && dR[0] <= 0.02,
      '探针 ' + A0p.length + ' 条边 × 5 个位置 ‖ 平移 3px 最大跳幅 ' + dP[0].toFixed(3) + (dP[1] ? '（' + dP[1] + '）' : '')
        + ' ‖ 缩放 ×1.03 ' + dZ[0].toFixed(3) + (dZ[1] ? '（' + dZ[1] + '）' : '')
        + ' ‖ 立体偏航 +0.05rad ' + dR[0].toFixed(3) + (dR[1] ? '（' + dR[1] + '）' : '') + '（三条都要 ≤0.02）');
  })();
  /* ===== §E466 家族行序必须与"这一行真显示的那些枚"的训练时刻同向 =====
   *   用户 10-08：「怎么有几个后期的点飞到家族 1 去了，是不是哪里写错了」—— 写错的地方在 lineage.mjs 的聚类：
   *   16 枚旧槽位冠军（不是训练产物）一起进了聚类，其中 SLOT-6ed47e18（09-09）与 E59/BIG 那批"配置字段全空"的类
   *   签名逐字相同 ⇒ **整类被这一枚拖到第 2 行**，于是 09-27/10-02 的 12 枚显示在"最早那一批"那一行。
   *   ⚠ 判据不许读 fams 数组自己（数组自己算自己 = 永远绿，§E44x 记过这一族），要读**每行真显示的那些枚的时刻**；
   *     零散那一行按定义就是混装，不套这条序。 */
  (function () {
    var byF = {};
    for (var i8 = 0; i8 < N; i8++) { var d8 = P[i8], tv8 = Date.parse(d8.ts); if (!isFinite(tv8)) continue;
      var f8 = d8.famTop ? 0 : d8.fam; if (f8 === undefined || f8 === null || f8 === '') continue;
      (byF[f8] || (byF[f8] = [])).push(tv8); }
    var rows8 = Object.keys(byF).map(Number).sort(function (a, b) { return a - b; });
    var st8 = rows8.map(function (f) { var a = byF[f].slice().sort(function (x, y) { return x - y; });
      return { f: f, n: a.length, min: a[0] }; });
    var bad8 = [], nSlotOut = 0;
    for (var k8 = 1; k8 < st8.length; k8++) { var cu = st8[k8], pv = st8[k8 - 1];
      if (cu.f === 0 || /零散/.test(String(FAMLAB[cu.f] || '')) || /零散/.test(String(FAMLAB[pv.f] || ''))) continue;
      if (cu.min < pv.min) bad8.push('行 ' + cu.f + ' 最早 ' + new Date(cu.min).toISOString().slice(5, 10)
        + ' 早于行 ' + pv.f + ' 的 ' + new Date(pv.min).toISOString().slice(5, 10)); }
    for (var j8 = 0; j8 < N; j8++) if (String(P[j8].id).indexOf('SLOT-') === 0 && !P[j8].famTop && P[j8].fam) nSlotOut++;
    T('家族行序要与"这一行真显示的那些枚"的训出时刻同向，且旧槽位冠军只能住在合成那一行（§E466：一枚 09-09 的旧冠军曾把 10-02 那批拖上第 2 行）',
      bad8.length === 0 && nSlotOut === 0,
      st8.length + ' 行 ‖ 序违规 ' + bad8.length + ' 条' + (bad8.length ? '：' + bad8.slice(0, 4).join(' ‖ ') : '')
        + ' ‖ 落在家族 0 之外的旧槽位冠军 ' + nSlotOut + ' 枚（要 0）‖ 头三行 '
        + st8.slice(0, 3).map(function (s) { return s.f + '：n' + s.n + ' ‖ 最早 ' + new Date(s.min).toISOString().slice(5, 10); }).join(' '));
  })();
  /* ===== §E462 拖动手本身要有判据 =====
   *   三块浮层各拖一次：① 真的落在拖到的地方（不是"看着动了"）；② 拖不出画面（夹取）；③ 双击回得到出厂位；
   *   ④ 图例拖过之后，图例里那根窗口轴的两个柄**还抓得住** —— 两者都听 pointerdown，这是最容易互相抢的一处。*/
  (function () {
    var SNF = { lgPos: st.lgPos, cardPos: st.cardPos, sidePos: st.sidePos };
    var wr = document.getElementById('wrap'), dBad = [];
    function relOf(el) { var a = el.getBoundingClientRect(), b = wr.getBoundingClientRect(); return [a.left - b.left, a.top - b.top]; }
    function dragTo(el, x, y) { var b = wr.getBoundingClientRect(), r = el.getBoundingClientRect();
      /* 按下点取元素左上角往里 5px（避开边缘），所以 move 的目标要**加上这 5px**，
       *   否则"拖到 (x,y)"实际落在 (x-5,y-5) —— 第一版就是这么量出 -65/+115 这种 5px 系统差的。 */
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: r.left + 5, clientY: r.top + 5 }));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: b.left + x + 5, clientY: b.top + y + 5 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: b.left + x + 5, clientY: b.top + y + 5 })); }
    /* §E462 这条要钉住**默认布局**再拖：从 #lgpos=40,300 这类深链进来时，图例已经贴到左缘，
     *   再往左拖 60px 会被夹取挡住 ⇒ 量出来的是夹取，不是拖动（实测 delta -40 而不是 -60）。
     *   夹取本身由下面那一发 99999 单独判，两件事分开记。*/
    st.lgPos = st.cardPos = st.sidePos = null;
    floatApply(document.getElementById('legend'), 'lgPos'); floatApply(document.getElementById('card'), 'cardPos');
    floatApply(document.getElementById('side'), 'sidePos');
    var LG = document.getElementById('legend'), CD = document.getElementById('card'), SD = document.getElementById('side');
    st.side = true; paintSide(); st.sel = st.sel || P[0].id; paintCard();
    var L0 = relOf(LG);
    dragTo(LG, L0[0] - 60, L0[1] + 80);
    var L1 = relOf(LG);
    if (Math.abs((L1[0] - L0[0]) + 60) > 4 || Math.abs((L1[1] - L0[1]) - 80) > 4)
      dBad.push('图例拖 (-60,+80) 之后实际走了 (' + Math.round(L1[0] - L0[0]) + ',' + Math.round(L1[1] - L0[1]) + ')');
    dragTo(LG, 99999, 99999);
    var L2 = relOf(LG);
    if (L2[0] + LG.offsetWidth > wr.clientWidth + 2 || L2[1] + LG.offsetHeight > wr.clientHeight + 2)
      dBad.push('往死里拖没夹住：落在 (' + Math.round(L2[0]) + ',' + Math.round(L2[1]) + ')，块 ' + LG.offsetWidth + '×' + LG.offsetHeight
        + '，画面 ' + wr.clientWidth + '×' + wr.clientHeight);
    /* 拖完轴还得能用：按**画出来的下沿柄**按下去拖一格，st.flo 必须动 */
    var AX = document.getElementById('winax');
    if (!AX) dBad.push('拖过图例之后窗口轴不见了');
    else { var lgBefore = relOf(LG), ar = AX.getBoundingClientRect(), f0 = st.flo, yOf = function (f) { return ar.top + (1 - f) * ar.height; };
      AX.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: ar.left + ar.width / 2, clientY: yOf(f0) }));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: ar.left + ar.width / 2, clientY: yOf(Math.min(0.99, f0 + 0.12)) }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      if (Math.abs(st.flo - (f0 + 0.12)) > 0.03) dBad.push('图例拖过之后轴柄不接了：flo ' + f0.toFixed(3) + ' → ' + st.flo.toFixed(3) + '（该到 ' + (f0 + 0.12).toFixed(3) + '）');
      /* ⚠ 只判「轴还接得住」没有牙（红测实测：把让开轴那句拆掉，轴照样能用，症状是拖柄时整块图例跟着跑）。
        所以这一条必须判图例没动 —— 那才是用户会看见的坏法。*/
      var lgAfter = relOf(LG);
      if (Math.abs(lgAfter[0] - lgBefore[0]) + Math.abs(lgAfter[1] - lgBefore[1]) > 1)
        dBad.push('拖窗口轴的柄把整块图例也拖走了 (' + Math.round(lgBefore[0]) + ',' + Math.round(lgBefore[1])
          + ') → (' + Math.round(lgAfter[0]) + ',' + Math.round(lgAfter[1]) + ') ⇒ 轴那一下没让开');
      setWin(SNF.flo === undefined ? 0 : 0, 1); }
    /* 卡与侧栏也各拖一次（它们才是盖住数据最多的两块） */
    var C0 = relOf(CD); dragTo(CD, C0[0] + 120, Math.max(8, C0[1] - 90)); var C1 = relOf(CD);
    if (Math.abs((C1[0] - C0[0]) - 120) > 4) dBad.push('选中卡拖 +120 实际走 ' + Math.round(C1[0] - C0[0]));
    var S0 = relOf(SD); dragTo(SD, Math.max(8, S0[0] - 200), S0[1] + 40); var S1 = relOf(SD);
    if (Math.abs((S1[0] - S0[0]) + 200) > 4) dBad.push('冠军序列拖 -200 实际走 ' + Math.round(S1[0] - S0[0]));
    /* 双击复位 */
    LG.dispatchEvent(new PointerEvent('dblclick', { bubbles: true }));
    if (st.lgPos !== null) dBad.push('双击图例没复位（st.lgPos 还是 ' + JSON.stringify(st.lgPos) + '）');
    CD.dispatchEvent(new PointerEvent('dblclick', { bubbles: true })); SD.dispatchEvent(new PointerEvent('dblclick', { bubbles: true }));
    st.lgPos = SNF.lgPos; st.cardPos = SNF.cardPos; st.sidePos = SNF.sidePos;
    floatApply(LG, 'lgPos'); floatApply(CD, 'cardPos'); floatApply(SD, 'sidePos');
    st.side = SNF.sidePos === undefined && SNF.lgPos === undefined ? st.side : st.side;
    /* ===== §E557 两条新腿：悬停卡不许出视口 ‖ 家族配色要"临近号 = 临近色"还分得开 =====
     *   都是"改完必须能自己喊"的那种：不靠人把鼠标挪到角落看一眼，也不靠肉眼扫一遍色板。 */
    (function () {
      var VW = 1600, VH = 900, bad = [], nCases = 0;
      var PTS = [[VW - 30, VH - 20], [VW - 30, 20], [30, VH - 20], [VW / 2, VH / 2], [VW - 6, VH - 6], [6, 6]];
      var SIZES = [[420, 260], [640, 120], [180, 700], [300, 200]];   /* 明细卡实际会有的几种体型（pre 排版 ⇒ 宽由文案决定）*/
      for (var pi = 0; pi < PTS.length; pi++) for (var si = 0; si < SIZES.length; si++) {
        var w = SIZES[si][0], h = SIZES[si][1], pt = PTS[pi];
        var r = tipPlace(pt[0], pt[1], w, h, VW, VH); nCases++;
        if (r[0] < 0 || r[1] < 0 || r[0] + w > VW || r[1] + h > VH)
          bad.push('指针(' + pt[0] + ',' + pt[1] + ') 卡 ' + w + 'x' + h + ' ⇒ 落在 (' + r[0] + ',' + r[1] + ') 溢出');
      }
      /* 卡片比视口还大时不可能整张放下 —— 那种情况只许它**贴左上**（内容至少从头读起），不许跑到右下去 */
      var big = tipPlace(VW - 10, VH - 10, VW + 200, VH + 200, VW, VH);
      if (!(big[0] === 8 && big[1] === 8)) bad.push('卡比视口大时没有贴左上，而是落在 (' + big[0] + ',' + big[1] + ')');
      T('悬停明细卡必须整张在视口内（§E557 用户：「点靠右下的时候会看不见」）—— 四个角 + 中心 × 四种卡尺 ' + nCases + ' 个组合',
        bad.length === 0, bad.slice(0, 3).join(' ‖ ') + (bad.length ? '' : ' ⇒ 右下放不下就翻面，再溢出就夹进视口'));
    })();
    (function () {
      /* 家族配色：从 GRP.col 里把 hsl() 解回来量，不重新算一遍（重算就是拿另一把尺自证）*/
      function parse(c) { var m = /^hsl\\((\\d+),(\\d+)%,(\\d+)%\\)$/.exec(c); return m ? [+m[1], +m[2], +m[3]] : null; }
      var ks = GRP.keys, n = ks.length, p = [], adjBad = [], monoBad = [], farBad = [];
      for (var i = 0; i < n; i++) { var q = parse(GRP.col[ks[i]]); if (!q) { adjBad.push('家族 ' + ks[i] + ' 的颜色不是 hsl() 形式：' + GRP.col[ks[i]]); q = [0, 0, 0]; } p.push(q); }
      if (n >= 10) {
        for (var j = 0; j + 1 < n; j++) {
          var dl = Math.abs(p[j][2] - p[j + 1][2]), ds = Math.abs(p[j][1] - p[j + 1][1]);
          if (!(dl >= 10 || ds >= 20)) adjBad.push('家族 ' + ks[j] + ' / ' + ks[j + 1] + ' 只差色相（Δ明度 ' + dl + ' ‖ Δ饱和 ' + ds + '）');
        }
        for (var k2 = 1; k2 < n; k2++) if (p[k2][0] <= p[k2 - 1][0]) monoBad.push('排名 ' + k2 + ' 的色相没有比上一家更走（' + p[k2 - 1][0] + ' → ' + p[k2][0] + '）');
        /* 同 (饱和,明度) 的两家只能靠色相分 ⇒ 必须差开 40° 以上（周期 6 ⇒ n=30 时是 72°）*/
        for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++)
          if (p[a][1] === p[b][1] && p[a][2] === p[b][2]) {
            var dh = Math.abs(p[a][0] - p[b][0]); dh = Math.min(dh, 360 - dh);
            if (dh < 40) farBad.push('家族 ' + ks[a] + ' / ' + ks[b] + ' 明度饱和都相同而色相只差 ' + dh + '°'); }
      } else monoBad.push('家族数只有 ' + n + ' ⇒ 这条测不到东西');
      T('家族配色要"临近家族号 = 临近色相"且相邻两家分得开（§E557 用户：「颜色已经非常多了，很容易搞混；要临近颜色对应临近家族」）',
        adjBad.length === 0 && monoBad.length === 0 && farBad.length === 0,
        n + ' 家 ‖ 色相不单调 ' + monoBad.length + ' 处（' + monoBad.slice(0, 2).join(' ‖ ') + '）‖ 相邻分不开 ' + adjBad.length +
        ' 处（' + adjBad.slice(0, 2).join(' ‖ ') + '）‖ 同明度饱和而色相差 <40° 的 ' + farBad.length + ' 对（' + farBad.slice(0, 2).join(' ‖ ') + '）');
    })();
    T('浮层可拖动：图例 / 选中卡 / 冠军序列各拖一次要真跟着走、拖不出画面、双击回出厂位，且图例拖过之后窗口轴那两个柄还接得住',
      dBad.length === 0, dBad.join(' ‖ ') || '三块都跟着走 ‖ 夹取生效 ‖ 双击复位 ‖ 轴柄仍接得住');
  })();
  /* ===== §E453 工具栏那几个控件：以前每一条判据都是"直接写 st 再画"，没有一条从**控件本身**走起 =====
   *   这笔账是 §E452 逼出来的：那条门写死 st.flo = 0.8，而 T 滑杆一动 F 分布就动 ——
   *   "滑杆 → st → 分布"这条链从来没被走过一遍，所以它断在哪儿都没人知道。
   *   下面三条按**真事件**点控件（dispatchEvent，不写 st），点完核两件事：st 跟上了 ‖ 画面/分布真的跟着变了。
   *   ⚠ 全部点完要把 st 与 DOM 两侧一起还原：只还原 st 的话用户回头看到的下拉会停在被点过的档位上
   *     （"控件写着 seed 而图是 fam"就是 §E371 那类两本账）。 */
  var SNAPI = { mode: st.mode, e: st.elev, labels: st.labels, color: st.color, edges: st.edges, batch: st.batch,
    T: st.T, size: st.size, q: st.q, side: st.side, sortBy: st.sortBy, bg: st.bg, flo: st.flo, fhi: st.fhi };
  var HIBK = {}; for (var hik in st.hi) HIBK[hik] = st.hi[hik];
  function fireEv(el, typ) { el.dispatchEvent(new Event(typ, { bubbles: true })); }
  var wireBad = [];
  var WSEL = [['color', 'seed'], ['labels', 'all'], ['batch', 'all'], ['edges', 'hash']];
  for (var wi = 0; wi < WSEL.length; wi++) { var wid = WSEL[wi][0], wnt = WSEL[wi][1];
    var wel = document.getElementById(wid), wbk = wel.value;
    wel.value = wnt; fireEv(wel, 'change');
    if (st[wid] !== wnt) wireBad.push(wid + ' 选到「' + wnt + '」而 st.' + wid + ' = ' + st[wid]);
    wel.value = wbk; fireEv(wel, 'change');
    if (st[wid] !== wbk) wireBad.push(wid + ' 还原失败（st 是 ' + st[wid] + '，控件是 ' + wbk + '）'); }
  var loT0 = winLo(), r0 = dotR(P[0], 1), wT = document.getElementById('T'), bkT = wT.value;
  wT.value = '0.25'; fireEv(wT, 'input');
  if (Math.abs(st.T - 0.25) > 1e-9) wireBad.push('T 滑杆拖到 0.25 而 st.T = ' + st.T);
  if (Math.abs(winLo() - loT0) < 1e-6) wireBad.push('st.T 动了但 F 值域一点没动（winLo 还是 ' + loT0.toFixed(3)
    + ' ⇒ F = Hp/100 + T·S 与这根滑杆脱钩了）');
  var wS = document.getElementById('size'), bkS = wS.value;
  wS.value = '2'; fireEv(wS, 'input');
  if (Math.abs(st.size - 2) > 1e-9) wireBad.push('点大小滑杆拖到 2 而 st.size = ' + st.size);
  var r1 = dotR(P[0], 1);
  if (!(r1 > r0 * 1.5)) wireBad.push('st.size 翻倍而 dotR 没跟着长（' + r0.toFixed(2) + ' → ' + r1.toFixed(2) + '）');
  wS.value = bkS; fireEv(wS, 'input'); wT.value = bkT; fireEv(wT, 'input');
  T('工具栏接线：四个下拉与两根滑杆点下去必须真的改 st，且 T / 点大小要真的改动到画面',
    wireBad.length === 0, wireBad.join(' ‖ ') || ('下拉 ' + WSEL.length + ' 个 + 滑杆 2 根都接上了 ‖ 动 T 之前 winLo = '
      + loT0.toFixed(3) + '，动完已变 ‖ dotR ' + r0.toFixed(2) + ' → ' + r1.toFixed(2)));
  /* ② 搜索框：它的可观察效果只有两样 —— 匹配那几枚**上名字** + 在它们外面描一圈墨环（drawMap 里 11·st.size 那一圈）。
   *    所以判据也得读这两样，不能只信 st.q 变了。 */
  /* 片段从**当下看得见的那批点**里现找（4 字一段，优先命中 2~6 枚的那一段），不写死：
   *   上一版写死 ['bead','ring','new5',…]，§E440 去重之后命中数掉到 1 ⇒ 这条自己变成"没测到东西"；
   *   改成全库现找之后又在 #flo=0.60&fhi=0.70 下红一次 —— 那段「eco2」全库命中 6 枚，可当下窗内一枚都不在，
   *   于是"可见的匹配 0 枚"。这条测的是"搜索框把**图上看得见**的那几枚标出来"，取样就必须从看得见的里面取。 */
  var SNAPQ = { mode: st.mode, e: st.elev, labels: st.labels };
  st.mode = 'map'; st.elev = 0; st.labels = 'champ'; st.q = ''; recomputeVIS(); draw();
  var qFrag = '', qN = 0, QCH = 'abcdefghijklmnopqrstuvwxyz0123456789', QCNT = {}, QORD = [];
  for (var qi0 = 0; qi0 < N; qi0++) { if (!VIS[qi0] || !scr[qi0]) continue;
    var pid = String(P[qi0].id).toLowerCase();
    for (var po = 0; po + 4 <= pid.length; po++) { var pk = pid.slice(po, po + 4), okk = true;
      for (var pz = 0; pz < 4; pz++) if (QCH.indexOf(pk.charAt(pz)) < 0) { okk = false; break; }
      if (!okk) continue;
      if (QCNT[pk] === undefined) { QCNT[pk] = 0; QORD.push(pk); } QCNT[pk]++; } }
  for (var qo = 0; qo < QORD.length; qo++) { var ck = QCNT[QORD[qo]];
    if (ck >= 2 && ck <= 6 && ck > qN) { qN = ck; qFrag = QORD[qo]; } }
  if (qFrag === '') for (var qo2 = 0; qo2 < QORD.length; qo2++) if (QCNT[QORD[qo2]] === 1) { qN = 1; qFrag = QORD[qo2]; break; }
  var dQ0 = null, qBad = [];
  try { dQ0 = g.getImageData(0, 0, cv.width, cv.height).data; } catch (Eq) {}
  var wq = document.getElementById('q'); wq.value = qFrag; fireEv(wq, 'input'); draw();
  var dQ1 = null; try { dQ1 = g.getImageData(0, 0, cv.width, cv.height).data; } catch (Eq2) {}
  if (st.q !== qFrag) qBad.push('搜索框打了「' + qFrag + '」而 st.q = ' + JSON.stringify(st.q));
  var nLab = 0, nRing = 0, qVis = 0, rrq = 11 * st.size;
  for (var qi3 = 0; qi3 < N; qi3++) { var d3 = P[qi3]; if (String(d3.id).toLowerCase().indexOf(qFrag) < 0 || !scr[qi3] || !VIS[qi3]) continue;
    qVis++;
    var got3 = false;
    for (var lb3 = 0; lb3 < LAB.length; lb3++) if (LAB[lb3][4] === qi3) got3 = true;
    if (got3) nLab++;
    if (dQ0 && dQ1) { var cx3 = Math.round(scr[qi3][0]), cy3 = Math.round(scr[qi3][1]), nd = 0;
      for (var ax = -rrq - 3; ax <= rrq + 3; ax++) for (var ay = -rrq - 3; ay <= rrq + 3; ay++) {
        var rr2q = Math.sqrt(ax * ax + ay * ay); if (rr2q < rrq - 2 || rr2q > rrq + 2) continue;
        var oq = ((cy3 + ay) * cv.width + (cx3 + ax)) * 4; if (oq < 0) continue;
        if (dQ0[oq] !== dQ1[oq] || dQ0[oq + 1] !== dQ1[oq + 1] || dQ0[oq + 2] !== dQ1[oq + 2]) nd++; }
      if (nd >= 8) nRing++; } }
  if (qFrag === '' || qVis < 1) qBad.push('片段「' + qFrag + '」在当下这张图上数到 ' + qVis + ' 枚可见的匹配 ⇒ 这条没测到东西');
  else if (nLab < qVis) qBad.push('可见的匹配 ' + qVis + ' 枚只上了名字 ' + nLab + ' 枚（搜索框的作用就是把这几枚标出来）');
  if (dQ0 && dQ1 && qVis >= 1 && nRing < qVis) qBad.push('可见的匹配 ' + qVis + ' 枚里只有 ' + nRing + ' 枚周围真多出一圈墨环');
  if (!dQ0 || !dQ1) qBad.push('取不到两帧像素');
  wq.value = ''; fireEv(wq, 'input');
  st.mode = SNAPQ.mode; st.elev = SNAPQ.e; st.labels = SNAPQ.labels;
  T('搜索框：打一个包名片段，匹配那几枚必须真的被标出来（上名字 + 描一圈环，两帧之差为证）',
    qFrag !== '' && qBad.length === 0,
    (qFrag === '' ? 'id 堆里找不到命中 2~6 枚的 4 字片段 ⇒ 这条没测到东西' : '片段「' + qFrag + '」全库命中 ' + qN + ' 枚 ‖ 当下可见 ' + qVis + ' 枚 ‖ 上名字 ' + nLab + ' ‖ 描环 ' + nRing)
      + (qBad.length ? ' ‖ ' + qBad.join(' ‖ ') : ''));
  /* ③ 三个按钮：排序（1d 那张的横轴顺序真的换）、冠军序列（面板出现）、底色（连字色一起翻，深浅底上白字会看不见）*/
  var btnBad = [], wsort = document.getElementById('sortb'), sbk = st.sortBy;
  function idOf(i) { return (i >= 0 && P[i]) ? P[i].id : '(一枚都没有)'; }
  st.mode = '1d'; recomputeVIS(); draw();
  var leftA = -1, leftAx = 1e9;
  for (var li2 = 0; li2 < N; li2++) if (scr[li2] && VIS[li2] && scr[li2][0] < leftAx) { leftAx = scr[li2][0]; leftA = li2; }
  wsort.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  if (st.sortBy === sbk) btnBad.push('排序按钮点下去 st.sortBy 没翻（还是 ' + st.sortBy + '）');
  if (wsort.textContent.indexOf(st.sortBy === 'F' ? 'F 名次' : '训出时刻') < 0) btnBad.push('按钮文案没跟着改：' + wsort.textContent);
  recomputeVIS(); draw();
  var leftB = -1, leftBx = 1e9;
  for (var li3 = 0; li3 < N; li3++) if (scr[li3] && VIS[li3] && scr[li3][0] < leftBx) { leftBx = scr[li3][0]; leftB = li3; }
  if (leftA < 0 || leftB < 0) btnBad.push('两种排序下都找不到可比的落点（' + leftA + '/' + leftB + '）');
  else if (leftA === leftB) btnBad.push('两种排序下最左那枚是同一枚（' + idOf(leftA) + '）⇒ 这根按钮换了个文案没换图');
  wsort.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  var wbs = document.getElementById('bside'), sdk = st.side;
  wbs.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  if (st.side === sdk) btnBad.push('冠军序列按钮点下去 st.side 没翻');
  var sdv = document.getElementById('side').style.display;
  if (st.side && sdv === 'none') btnBad.push('st.side 开了但 #side 还藏着');
  if (!st.side && sdv !== 'none') btnBad.push('st.side 关了而 #side 还占着画面');
  wbs.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  /* 底色：这条不能拿"进入时的字色"当参照（深链 #bg=%23e6ebf5 进来时字色已经是浅底那份了），
   *   改成**两档各点一次互相比**，并且把语义也判掉：浅底上字必须比底暗、深蓝上字必须比底亮（否则就是"看不见字"）。 */
  var wbg = document.querySelectorAll('#bar button[data-bg]'), wLite = null, wDark = null;
  for (var bi = 0; bi < wbg.length; bi++) { var bv = String(wbg[bi].getAttribute('data-bg')).toLowerCase();
    if (bv === '#e6ebf5') wLite = wbg[bi]; if (bv === '#0f1522') wDark = wbg[bi]; }
  var inkLite = '', inkDark = '';
  if (wLite) { wLite.dispatchEvent(new MouseEvent('click', { bubbles: true })); inkLite = st.ink; }
  if (wDark) { wDark.dispatchEvent(new MouseEvent('click', { bubbles: true })); inkDark = st.ink; }
  if (!wLite || !wDark) btnBad.push('底色按钮里找不到「浅底」或「深蓝」那两粒（找到 ' + wbg.length + ' 粒）');
  else {
    if (inkLite === inkDark) btnBad.push('浅底与深蓝两档字色一模一样（' + inkLite + '）⇒ 换底色没换字色');
    if (hexSum(inkLite) >= hexSum('#e6ebf5')) btnBad.push('浅底上字比底还亮或同亮（ink ' + inkLite + '）⇒ 那一档等于看不见字');
    if (hexSum(inkDark) <= hexSum('#0f1522')) btnBad.push('深蓝上字比底还暗或同暗（ink ' + inkDark + '）⇒ 这一档等于看不见字'); }
  var wBack = null;
  for (var bi2 = 0; bi2 < wbg.length; bi2++)
    if (String(wbg[bi2].getAttribute('data-bg')).toLowerCase() === String(SNAPI.bg).toLowerCase()) wBack = wbg[bi2];
  if (wBack) wBack.dispatchEvent(new MouseEvent('click', { bubbles: true })); else setBg(SNAPI.bg);
  if (String(st.bg).toLowerCase() !== String(SNAPI.bg).toLowerCase()) btnBad.push('底色没还原成进来时那档（' + st.bg + ' ≠ ' + SNAPI.bg + '）');
  T('工具栏三个按钮：排序要真的换 1d 的顺序、冠军序列要真的出现、底色两档必须连字色一起翻（浅底深字 / 深底亮字）',
    btnBad.length === 0, btnBad.join(' ‖ ') || ('排序：最左 ' + idOf(leftA) + ' → ' + idOf(leftB)
      + ' ‖ 侧栏开合两态都对 ‖ 字色 浅底 ' + inkLite + ' / 深蓝 ' + inkDark + ' ‖ 已还原到 ' + st.bg));
  /* ④ 剩下那几个能点的东西：平面⇄立体（那条 520ms 缓动要**一步推到底**才看得到落点，同一条 tick() 路径）、
   *    投影判据、底色取色器、地板四粒（开关 / 阈值 / 网格 / 场）、好在上⇅。
   *    判的还是两件事：st 跟上 ‖ 有个可观察的东西跟着动（按钮文案 / 面板显隐 / 夹取后的值）。 */
  var SN2 = { iso: st.iso, isoT: st.isoT, isoGN: st.isoGN, isoField: st.isoField, goodTop: st.goodTop,
    bg: st.bg, elev: st.elev, yaw: st.yaw, pit: st.pit, fitOn: document.getElementById('fit').style.display };
  var c2Bad = [];
  var wb3 = document.getElementById('b3dt'), e0 = st.elev, t0b3 = wb3.textContent;
  wb3.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  if (tw) { tw.t0 = performance.now() - (tw.dur + 80); tick(); }   /* 把缓动一步推到终点（走的是同一套 tick，不是替它写结论） */
  var e1 = st.elev, t1b3 = wb3.textContent;
  if (Math.abs(e1 - e0) < 0.4) c2Bad.push('点平面⇄立体之后 st.elev 只从 ' + e0.toFixed(2) + ' 走到 ' + e1.toFixed(2));
  /* 文案不跟"进入时那一眼"比，跟**当下 elev 该有的那一句**比：前面好几条判据都会临时把 elev 放平再还原，
   *   而它们改的是 st 不是按钮 ⇒ 进入这条时那句文案可能已经是陈的（实测 #mode=map&3d=1 就这样）。
   *   拿"变没变"判就是判错了对象；这条不变量（elev>=0.5 该写「平面」，否则该写「立体」）比原来更强。 */
  var want1 = e1 >= 0.5 ? '平面' : '立体';
  if (t1b3 !== want1) c2Bad.push('点完这一粒 elev = ' + e1.toFixed(2) + '，按钮该写「' + want1 + '」而它写着「' + t1b3 + '」');
  wb3.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  if (tw) { tw.t0 = performance.now() - (tw.dur + 80); tick(); }
  if (Math.abs(st.elev - SN2.elev) > 0.05) c2Bad.push('点回去之后没落在进入时那一档（' + SN2.elev.toFixed(2) + ' → ' + st.elev.toFixed(2) + '）');
  var wf = document.getElementById('fitt'), df0 = document.getElementById('fit').style.display;
  wf.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  var df1 = document.getElementById('fit').style.display;
  if (df1 === df0) c2Bad.push('投影判据按钮点下去 #fit 显隐没变（' + df0 + '）');
  if (!wf.classList.contains('on') === (df1 !== 'none')) c2Bad.push('#fit 开着而按钮没高亮（或反过来）：' + df1 + ' / on=' + wf.classList.contains('on'));
  wf.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  var wbgc = document.getElementById('bgc'), bgBk = wbgc.value;
  wbgc.value = '#212a3b'; fireEv(wbgc, 'input');
  if (String(st.bg).toLowerCase() !== '#212a3b') c2Bad.push('底色取色器填 #212a3b 而 st.bg = ' + st.bg);
  wbgc.value = bgBk; fireEv(wbgc, 'input');
  var isoBk = st.iso, isoSeen = {};
  for (var iz = 0; iz < 3; iz++) { isoSeen[st.iso] = 1;
    document.getElementById('bisos').dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  if (!(isoSeen[0] && isoSeen[1] && isoSeen[2])) c2Bad.push('地板开关点三圈没有轮完三档（见到的是 ' + Object.keys(isoSeen).join('/') + '）');
  if (st.iso !== isoBk) c2Bad.push('地板开关点三圈没回到原来那档（' + isoBk + ' → ' + st.iso + '）');
  /* 阈值这根滑杆是 **E426 故意做的防抖**："槽位先跟手、st.isoT 停手 160ms 之后才动"（isoBuild 一次 1175ms，
   *   每个 tick 都改 st.isoT 就是拖一下卡一秒）。同步自检里那个 setTimeout 永远不会跑，
   *   所以这条只许测**槽位与标签跟没跟手** —— 拿 st.isoT 判就是判错了对象。 */
  var wit = document.getElementById('isot'), witBk = wit.value, slotBk = (st.isoField === 'pot' ? st.isoTpot : st.isoTok);
  wit.value = '0.9'; fireEv(wit, 'input');
  var slotNow = (st.isoField === 'pot' ? st.isoTpot : st.isoTok);
  if (Math.abs(slotNow - 0.9) > 1e-9) c2Bad.push('阈值滑杆拖到 0.9 而当下场那一格槽位 = ' + slotNow.toFixed(3) + '（槽位必须先跟手）');
  var lblT = document.getElementById('isotv').textContent;
  if (lblT.indexOf('90%') < 0) c2Bad.push('阈值数值跟手了而标签没跟（读数是「' + lblT + '」）');
  wit.value = witBk; fireEv(wit, 'input');
  if (st.isoField === 'pot') st.isoTpot = slotBk; else st.isoTok = slotBk;
  /* 网格与场是两个 select：它们听的是 change（不是 input），而且填一个没有的选项会被浏览器清成空串 ⇒ 用真的档位测 */
  var wig = document.getElementById('isogn'), wigBk = wig.value;
  wig.value = '128'; fireEv(wig, 'change');
  if (st.isoGN !== 128) c2Bad.push('壳网格选 128 而 st.isoGN = ' + st.isoGN);
  wig.value = wigBk; fireEv(wig, 'change');
  if (st.isoGN !== +wigBk) c2Bad.push('壳网格没还原（' + st.isoGN + ' ≠ ' + wigBk + '）');
  var wif = document.getElementById('isof'), wifBk = wif.value;
  wif.value = 'pot'; fireEv(wif, 'change');
  if (st.isoField !== 'pot') c2Bad.push('场选 pot 而 st.isoField = ' + st.isoField);
  wif.value = wifBk; fireEv(wif, 'change');
  if (st.isoField !== wifBk) c2Bad.push('场没还原（' + st.isoField + ' ≠ ' + wifBk + '）');
  var wbh = document.getElementById('bh'), gt0 = st.goodTop, tx0 = wbh.textContent;
  wbh.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  if (st.goodTop === gt0) c2Bad.push('好在上⇅ 点下去 st.goodTop 没翻');
  if (wbh.textContent === tx0) c2Bad.push('好在上⇅ 翻了状态没翻文案（还是「' + tx0 + '」）');
  wbh.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  if (st.goodTop !== gt0) c2Bad.push('好在上⇅ 点两下没回到原档');
  T('工具栏剩下的都能点：平面⇄立体（缓动推到底）、投影判据、底色取色器、曲面三档与阈值/网格/场、好在上⇅',
    c2Bad.length === 0, c2Bad.join(' ‖ ') || ('st.elev ' + e0.toFixed(2) + ' → ' + e1.toFixed(2) + ' → 回到 ' + st.elev.toFixed(2)
      + ' ‖ #fit 显隐两态都对 ‖ 底色取色器接上 ‖ 曲面轮完三档并回到 ' + isoBk + ' ‖ 阈值槽位与标签跟手（st.isoT 由 E426 防抖，不在这里判）‖ 网格/场两个下拉走 change'));
  st.iso = SN2.iso; st.isoT = SN2.isoT; st.isoGN = SN2.isoGN; st.isoField = SN2.isoField;
  st.goodTop = SN2.goodTop; st.bg = SN2.bg; st.elev = SN2.elev; st.yaw = SN2.yaw; st.pit = SN2.pit;
  document.getElementById('fit').style.display = SN2.fitOn;
  syncIso(); syncHdir(); setBg(SN2.bg); document.getElementById('bgc').value = SN2.bg;
  st.mode = SNAPI.mode; st.elev = SNAPI.e; st.labels = SNAPI.labels; st.color = SNAPI.color; st.edges = SNAPI.edges;
  st.batch = SNAPI.batch; st.T = SNAPI.T; st.size = SNAPI.size; st.q = SNAPI.q; st.side = SNAPI.side;
  st.sortBy = SNAPI.sortBy; st.bg = SNAPI.bg; st.flo = SNAPI.flo; st.fhi = SNAPI.fhi;
  st.hi = {}; for (var hk2 in HIBK) st.hi[hk2] = HIBK[hk2];
  var dColor = document.getElementById('color'), dLab = document.getElementById('labels');
  var dBatch = document.getElementById('batch'), dEdges = document.getElementById('edges'), dQ = document.getElementById('q');
  dColor.value = SNAPI.color; dLab.value = SNAPI.labels; dBatch.value = SNAPI.batch; dEdges.value = SNAPI.edges;
  dQ.value = SNAPI.q; wT.value = SNAPI.T; wS.value = SNAPI.size;
  document.getElementById('Tv').textContent = (+SNAPI.T).toFixed(2);
  recomputeVIS(); buildGroups(); buildFamBar(); paintSide(); paintWin(); draw();
  /* ===== §E455 浮层面板压住多少数据：按**最坏情况**量，不量"自检跑到这儿时恰好开着什么" =====
   *   三块浮层（图例 / 选中卡 / 冠军序列）都是 DOM 盖在画布上 ⇒ 被它们压住的点既看不见也点不着（点击落在面板上）。
   *   原来这这件事只有"标签中心不许命中一张盖不住这个点的卡"那条管到卡与自己那枚点的关系，没人量过总量。
   *   取样状态钉死：平面地图 + 全范围窗口 + 卡开着（选库里 why 最长的那一枚 ⇒ 卡最高的一种）+ 侧栏开着。
   *   实测（1600×900）：画布内 729 枚 ‖ 被压住 65 枚 = 9%（卡 39 ‖ 侧栏 26）‖ 其中冠军 12 ‖ **现役 0**；
   *   只开图例的几种态：谱系图 0 枚、一维 0 枚、三维行为轴 3 枚、立体地图 16 枚。
   *   ⇒ 硬判据一条："现役不许被压住"（它是全图唯一的分界参照物，被压住就等于图上没有基准）；
   *     再加一条总量界（原来 80 枚，§E488 改成"面板面积 + 相对比例"两条 —— 那 15 枚余量赌的是落点骰子）。 */
  (function () {
    var SN5 = { mode: st.mode, e: st.elev, sel: st.sel, side: st.side, flo: st.flo, fhi: st.fhi, labels: st.labels,
      lgPos: st.lgPos, cardPos: st.cardPos, sidePos: st.sidePos };
    /* §E462 浮层能拖之后，这条必须钉住**默认布局**再量：它判的是「出厂那套位置不许把现役盖住」，
     *   不是「用户把它拖到现役上面也不许」。拖到哪是用户选的，不该由判据管（量完照旧还原）。*/
    st.lgPos = st.cardPos = st.sidePos = null;
    var worst = -1, worstId = '';
    for (var wi5 = 0; wi5 < N; wi5++) { var wl = String(P[wi5].why || '').length + String(P[wi5].pb || '').length;
      if (P[wi5].ok === 0 && wl > worst) { worst = wl; worstId = P[wi5].id; } }
    st.mode = 'map'; st.elev = 0; st.flo = 0; st.fhi = 1; st.labels = 'champ'; st.side = true;
    st.sel = worstId; recomputeVIS(); paintCard(); paintSide(); draw();
    var cvr = cv.getBoundingClientRect(), PAN = [];
    function addP(id) { var e = document.getElementById(id); if (!e) return;
      var cs = window.getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      var r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      PAN.push([id, (r.left - cvr.left) * devicePixelRatio, (r.top - cvr.top) * devicePixelRatio,
        r.width * devicePixelRatio, r.height * devicePixelRatio]); }
    addP('legend'); addP('card'); addP('side');
    var hid = 0, hidCh = 0, tot = 0, hidBy = {}, exCh = '', hidInc = 0;
    for (var oi = 0; oi < N; oi++) { var so = scr[oi]; if (!so || !VIS[oi]) continue; tot++;
      for (var pi = 0; pi < PAN.length; pi++) { var B = PAN[pi];
        if (so[0] >= B[1] && so[0] <= B[1] + B[3] && so[1] >= B[2] && so[1] <= B[2] + B[4]) {
          hid++; hidBy[B[0]] = (hidBy[B[0]] || 0) + 1;
          if (P[oi].id === 'SHIPPED-Ldemo') hidInc++;
          if (P[oi].lin) { hidCh++; if (!exCh) exCh = P[oi].id; }
          break; } } }
    var parts = []; for (var kk in hidBy) parts.push(kk + ' ' + hidBy[kk]);
    /* ===== §E488 这条的总量界原来钉的是「hid <= 80」（注释写的是"实测最坏 65 之上留 15 枚余量"），
     *   可它挡的病是「某块面板无声变大」，而 hid 数的是**点恰好落在画布哪一块**。
     *   这两件事不是一回事：x2/y2 是每次重建按**当下节点集**重算的力导向布局 ——
     *   实测这一次只往 coords.tsv 加了 3 枚融合粒（917→920 行 ‖ H/S/F 一字未动 ‖ 尺没有重测），
     *   917 行的 x2/y2 却全部变了（平均 0.75px / 0.75px，最大 5.61 / 38.57px）⇒ 被压数从 64 跳到 88。
     *   红的是"这一下骰子掷到哪"，不是面板变大 ⇒ 按第 89 条（不许钉死读数）与"门红了先问它该不该红"改钉两件可控的：
     *     ① 面板**面积**：单块 ≤ 画布 15% ‖ 三块合计 ≤ 40%。出厂态实测（画布 1576×543 CSS）
     *        图例 7.6% ‖ 选中卡 422×216 = 10.7% ‖ 侧栏 256×361 = 10.8% ‖ 合计 29.1%
     *        ⇒ 界放在"哪一块要无声长大四成才红"的位置。这个比是 dpr 无关的（分子分母同乘 devicePixelRatio）。
     *        这才是那句"无声变大"，且与坐标完全无关，任何重建都判得到。
     *     ② 相对总量界 hid ≤ tot 的 20%（实测 64/729 = 8.8% ‖ 88/732 = 12.0%）：布局重算确实会把点挪到面板底下，
     *        这条只挡"面板盖掉大半个画面"那种真病，不赌某一次的落点。
     *   现役 hidInc === 0 原样硬判（分界参照物被压住 = 图上没有基准）。
     *   牙口（两条都实测过，读数照抄）：
     *     ⚠ 第一版写的牙口是**假的**：把卡的 max-width 400 → 660 之后**没红**（卡的高度由内容驱动，
     *        加宽就换行变矮 ⇒ 面积几乎不变，实测仍 10.7%，点也没多被压）。这条判据量的是面积，
     *        本来就不该被那个变异骗到 —— 是我挑错了变异：第 15 条要的"把 bug 复原一次"对**判据自己的牙口**同样适用。
     *     ✅ 真变异 = 把卡的 font-size 12px → 18px（同一份明细占更大一块地方）：实测红在 ② ——
     *        被压 88 → 175 枚 = 23.9%（线 20%）。当时面积只到 12.1%（高度被 max-height 42% 夹住）⇒ 没红在 ①。
     *        两条各管一件事：① 管"形状失控"，② 管"真吃掉多少点"，缺一条就有一类病漏过去。
     *   删掉「NSOUP++」是另一条腿（§E487）的事，这条不该动。 */
    var AR = PAN.map(function (x) { return x[3] * x[4]; });
    var aMax = Math.max.apply(null, AR), aSum = 0; for (var ai = 0; ai < AR.length; ai++) aSum += AR[ai];
    var aCv = Math.max(1, cv.width * cv.height);
    var pMax = 100 * aMax / aCv, pSum = 100 * aSum / aCv;
    T('浮层面板不许把现役压住（它是全图唯一的分界参照）‖ 面板面积不许失控 ‖ 被压住的点按当下样本有相对界',
      PAN.length >= 2 && tot > 0 && hidInc === 0 && pMax <= 15 && pSum <= 40 && hid <= tot * 0.20,
      '钉的态：平面地图 + 卡开着（选 why 最长那枚 ' + worstId + '，明细 ' + worst + ' 字符）+ 侧栏开着'
        + ' ‖ 画布内 ' + tot + ' 枚 ‖ 被压住 ' + hid + ' 枚 = ' + (100 * hid / Math.max(1, tot)).toFixed(1) + '%（线 20%）‖ 分块 ' + (parts.join(' ‖ ') || '无')
        + ' ‖ 其中冠军 ' + hidCh + (exCh ? '（例 ' + exCh + '）' : '') + ' ‖ 现役 ' + hidInc + '（要 0）'
        + ' ‖ 画布 ' + Math.round(cv.width / devicePixelRatio) + '×' + Math.round(cv.height / devicePixelRatio) + ' CSS'
        + ' ‖ 面板 ' + PAN.map(function (x) { return x[0] + ' ' + Math.round(x[3] / devicePixelRatio) + '×' + Math.round(x[4] / devicePixelRatio) +
            '（' + (100 * x[3] * x[4] / aCv).toFixed(1) + '%）'; }).join(' / ') + ' ‖ 最大 ' + pMax.toFixed(1) + '%（线 15）‖ 合计 ' + pSum.toFixed(1) + '%（线 40）');
    st.mode = SN5.mode; st.elev = SN5.e; st.sel = SN5.sel; st.side = SN5.side;
st.flo = SN5.flo; st.fhi = SN5.fhi; st.labels = SN5.labels;
    st.lgPos = SN5.lgPos; st.cardPos = SN5.cardPos; st.sidePos = SN5.sidePos;   /* §E462 位置也要还原：自检不许把用户拖好的布局改掉 */
    recomputeVIS(); paintCard(); paintSide(); draw();
  })();
  var el = document.getElementById('selftest');
  el.style.display = 'block'; el.textContent = '§E338 页内自检：' + nok + ' PASS / ' + nbad + ' FAIL\\n' + out.join('\\n');
  } catch (E) { el0.textContent = 'FAIL 自检中途抛错：' + ((E && E.message) || E) + '\\n已经跑到：\\n' + out.join('\\n'); nbad++; }
  st.sel = null; paintCard(); draw();
})();
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
'#fam{flex:0 0 auto;background:var(--panel);border-top:1px solid var(--line);padding:7px 14px;display:flex;gap:7px;row-gap:5px;align-items:center;flex-wrap:wrap;z-index:6}\n' +
'#fam button.fam{padding:3px 7px;border-radius:14px;font-size:12px;display:flex;gap:5px;align-items:center}\n' +
'#fam button.fam i{width:10px;height:10px;border-radius:50%;display:inline-block;border:1px solid rgba(255,255,255,.35)}\n' +
'#fam button.fam b{color:var(--dim);font-weight:400}\n' +
'#fam .famtip{color:var(--dim);font-size:12px;padding-right:6px}\n' +
'#tip{position:fixed;display:none;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:8px 10px;white-space:pre;font-size:12px;line-height:1.5;pointer-events:none;z-index:9;box-shadow:0 6px 22px rgba(0,0,0,.55);color:var(--ink)}\n' +
'#legend{position:absolute;right:6px;top:12px;cursor:move;user-select:none;touch-action:none;   /* §E431 用户 10-08：整块往右缩（贴右缘），别压到一维图 */font-size:11px;color:var(--ink);text-align:left;padding:7px 9px;border:1px solid var(--line);border-radius:6px}\n' +
'#legend canvas{border:1px solid #8ea2c0;margin:3px 0}\n' +
'#stat{position:absolute;left:14px;top:10px;color:var(--dim);font-size:12px}\n' +
'label{color:var(--dim);display:flex;gap:6px;align-items:center}\n' +
/* §E371 强度窗口那两根：默认宽度（约 128px）会把工具栏挤到多一行，而这两根本来就是"拉个区间"的细活 ⇒ 收窄。 */
/* §E379 原生滑杆"两端各空出来一点"（用户那张 T 的截图）：根因是两条叠在一起的 ——
 *   ① `button,select,input{…padding:5px 9px…}` 这条通用规则把 9px 塞进了滑杆两侧，白道子本身就比控件窄一截；
 *   ② Chrome 的原生轨道把滑块**中心**的行程卡在 [半滑块, 宽 − 半滑块]，两端各留半个滑块。
 *   修法不是去挪滑块（挪不动），是**把画出来的轨道缩到滑块中心真正走得到的那一段** ⇒ 拖到头 = 看上去到头。
 *   轨道色用 --dim：深浅两套底色下都看得见（用 --line 在深蓝底上几乎与面板同色，等于没有轨道）。 */
'input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;border:none;padding:0;height:16px;cursor:pointer;min-width:60px}\n' +
'input[type=range]::-webkit-slider-runnable-track{height:16px;background:linear-gradient(var(--dim),var(--dim)) no-repeat;' +
'background-size:calc(100% - 14px) 4px;background-position:7px center;border-radius:2px}\n' +
'input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;' +
'background:#4f9cff;border:1px solid var(--ink);margin-top:1px}\n' +
'input[type=range]::-moz-range-track{height:4px;background:var(--dim);border-radius:2px;margin:0 7px}\n' +
'input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#4f9cff;border:1px solid var(--ink)}\n' +
'#winrow span{min-width:132px;font-variant-numeric:tabular-nums}\n' +
/* §E378 两根横滑杆换成图例旁一根竖轴 ⇒ 那行只剩读数 + 一句"去哪儿拖"；滑杆那条宽度规则一起撤。 */
'#whint{color:var(--dim);font-size:11px;min-width:0}\n' +
'#winax{border:1px solid var(--line);border-radius:3px;touch-action:none}\n' +
'#fit{position:absolute;left:14px;bottom:14px;color:var(--dim);font-size:11px;max-width:640px;line-height:1.5}\n' +
/* §E338 三块新面板（用户 ②③⑤）：
 *   #card   = 选中那枚的"冠军卡"（含**相对现役**的位置，这是 ③ 后半句要的）
 *   #side   = 冠军序列（按上线时刻排的一列，点一下加入对比）+ 对比表
 *   #cmp    = 对比表本体（挂在 #side 里，超过一屏就滚）
 *   位置刻意避开 #legend（右上）与 #stat（左上）：这三块要同时看得见，叠了就等于没有。*/
'#card{position:absolute;left:14px;bottom:34px;max-width:400px;max-height:42%;overflow:auto;background:rgba(19,26,41,.94);border:1px solid var(--line);border-radius:6px;padding:8px 10px;font-size:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;display:none;z-index:7}\n' +
'#side{position:absolute;right:14px;top:172px;width:236px;max-height:calc(100% - 200px);overflow:auto;background:rgba(19,26,41,.94);border:1px solid var(--line);border-radius:6px;padding:8px 9px;font-size:11px;line-height:1.45;display:none;z-index:7}\n' +
'#side h4{margin:0 0 6px;color:var(--dim);font-size:11px;font-weight:600}\n' +
'#side button{display:block;width:100%;text-align:left;margin:0 0 4px;padding:4px 6px;font-size:11px;border-radius:4px;line-height:1.35}\n' +
'#side button.on{background:#2f6df6;border-color:#2f6df6;color:#fff}\n' +
'#side .cur{border-color:#39d98a}\n' +
'#side table{border-collapse:collapse;width:100%;font-size:10px}\n' +
'#side td,#side th{border-bottom:1px solid var(--line);padding:2px 3px;text-align:right;white-space:nowrap}\n' +
'#side th{color:var(--dim);font-weight:400;text-align:left}\n' +
'#selftest{display:none;position:fixed;left:14px;top:40%;background:#101a2c;border:1px solid #6f83a8;color:#dce6f5;padding:8px 10px;border-radius:6px;font-size:11px;white-space:pre;z-index:30}\n' +
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
'<button id="sortb">排序：F 名次</button>' +
'<button id="reset">复位视图</button>' +
'<button id="fitt">投影判据 ⓘ</button>' +
'<label>T <input type="range" id="T" min="0" max="0.3" step="0.01" value="0.10"><span id="Tv">0.10</span></label>' +
'<label id="colorrow">颜色 <select id="color"><option value="fam">训练方法家族</option><option value="seed">RNG seed（旧口径）</option><option value="F">F（线上口径势 = Hp+T·S）</option><option value="rel" title="底图默认是地形：蓝=低 → 红=高，中性灰在库内中位。&#10;这一档换成判决：以现役为分界，绿=比现役强 ‖ 红=不如 ‖ 灰=现役那一档。&#10;为什么不当默认：现役落在库内第 82 百分位，拿它当中性灰会把 82% 的图涂成一片红，底图就没地形了。">相对现役（绿=强 / 红=不如）</option><option value="gl">长程广度 G(long)</option><option value="pm">上槽体检（实测）</option><option value="duel">对现役决斗（实测）</option><option value="hp">页面口径夺1率（实测）</option><option value="de">部署脆弱性 Δε（实测）</option><option value="sc">当选键 sc − 现役（实测）</option></select></label>' +
'<label>标签 <select id="labels"><option value="champ">只标冠军 + 首尾（避让）</option><option value="all">尽量全标（避让）</option><option value="off">不标</option></select></label>' +
'<label id="batchrow" title="§E338 用户 ①：谱系图 24 个家族一起画，行带只剩 29px、左栏两行字必然互相压。切到某一批就只画这一批碰过的家族（冠军与加进对比的那几枚永远保留，否则分界参照物会被批次切没）。批次 = 训出日期，与横轴同一条时间线">批次 <select id="batch"></select></label>' +
'<label id="winrow" title="§E371（用户 10-06 深夜：「默认显示全范围，然后可以手动拉强度上下顶点，用满色域渲染中间的点而超出范围的不显示」）&#10;切的是头号尺 F（= Hp/100 + T·S），不是「当前颜色那一档」。&#10;§E378（用户 10-07：「两个独立的轴调很奇怪，直接做到右边图例边上，用一根纵轴两个端点可拖动来表示范围」）⇒ 两根横滑杆换成图例旁边那一根**竖轴**：整根 = 全库 F 值域，亮段 = 当前窗口，两端各一个可拖的柄（双击 = 回全范围）。&#10;窗口内：色带按**这一段**重新铺满（两端顶到色端）。窗口外：一律不画，冠军也不例外 ⇒ 现役被切掉时页脚会响亮说一句。">F窗口 <span id="wv">全范围</span><span id="whint">（拖右边图例旁那根竖轴的两端 · 双击 = 回全范围）</span></label>' +
'<span id="winpre" style="display:flex;gap:4px;align-items:center"></span>' +
'<label id="edgerow" title="§E373（用户 10-07：「给一个连线开关不然可能会太多挡住了」）&#10;谱系图的热启动父边：全开 = 四种来路都画（hash/seedpack/arm/slot-at-time）；&#10;只实录 = 只画包自己记下的权重哈希那一级（§E367 之后最硬的一级）；&#10;关掉 = 一条都不画，点云本身不受影响。&#10;默认仍是全开：这一版的图就是按全开验收过的，改默认等于偷偷换读法。">连线 <select id="edges"><option value="all">全开</option><option value="hash">只实录</option><option value="off">关掉</option></select></label>' +
'<button id="bside" title="历代冠军按**上线时刻**排的一列（上线时刻由 ship-scan.mjs 逐提交算槽文件权重指纹抽出，不是按提交标题点名）。点一枚加入对比">冠军序列 ⇄</button>' +
'<label>点大小 <input type="range" id="size" min="0.6" max="2.2" step="0.1" value="1"></label>' +
'<label>找 <input type="search" id="q" size="12" placeholder="包名片段"></label>' +
'<span style="color:var(--dim)">底色</span>' +
'<button data-bg="#0f1522">深蓝</button><button data-bg="#05070d">纯黑</button>' +
'<button data-bg="#212a3b">石板</button><button data-bg="#e6ebf5">浅底</button>' +
'<input type="color" id="bgc" value="#0f1522" title="自定义底色"><span id="bgn" style="color:var(--dim);font-size:11px"></span>' +
'</div>\n' +
'<div id="wrap"><canvas id="cv"></canvas><div id="stat"></div><div id="legend"></div>' +
'<div id="card"></div><div id="side"></div>' +
'<div id="fit" style="display:none">' + (fit.length ? '本图坐标与判据（' + 'fit.tsv ← e287-fit.mjs' + ' 实测，随机排点当地板）：<br>' +
  fit.map(l => l.split('\t').join(' · ')).join('<br>').replace(/</g, '&lt;') : '') + '</div></div>\n' +
'<div id="fam"></div>\n' +
'<div id="err" style="display:none;position:fixed;right:14px;bottom:60px;background:#5b1620;border:1px solid #ff6b6b;color:#ffd9d9;padding:8px 12px;border-radius:6px;font-size:12px;z-index:20"></div>\n' +
'<div id="tip"></div>\n' +
'<div id="selftest"></div>\n' +
'<script>var DATA = ' + JSON.stringify(DATA) + '; var OKSRCJ = ' + JSON.stringify(OKSRC) + '; var NRAW = ' + NRAW + '; var PROJTSNE = ' + (PROJTSNE ? '1' : '0') + ';\n' + GLJS + ' var FAMLAB = ' + JSON.stringify(FAMLAB) + ';\n' + JS + '</script></body></html>';
/* §E338 落盘之后**必须把内联脚本再解析一遍**（"写完不回读"这一族的第三种形态）：
 *   模板里写 '\n' 会被 Node 先吃成**真换行** ⇒ 写进页面就成了一条未闭合的字符串 ⇒ **整页脚本一条都不执行**，
 *   而构建照样打印"已写 xxx KB"、截图照样是一张画布（地板是 canvas 之外没画 ⇒ 看着像空的但没人报错）。
 *   lint-viewer 只查反引号那一族，查不到这一族 ⇒ 唯一可靠的判据是让 JS 引擎自己解析一遍。*/
{ const i0 = html.indexOf('<script>'), i1 = html.lastIndexOf('</script>');
  const src = html.slice(i0 + 8, i1);
  try { new Function(src); } catch (e) {
    const ln = (/:(\d+)/.exec(e.stack || '') || [])[1];
    console.error('⛔ 内联脚本解析失败 ⇒ 这一版页面整个不会跑（不是"某块没画"，是 JS 全灭）：' + e.message +
      (ln ? '（内联第 ' + ln + ' 行）' : ''));
    if (ln) { const ls = src.split('\n'); console.error('   >>> ' + String(ls[Number(ln) - 1] || '').trim().slice(0, 160)); }
    process.exit(3); }
  console.log('内联脚本解析自证 ✅ ' + src.split('\n').length + ' 行 JS 能被引擎收下'); }
/* E398 DS：**模板转义门**。浏览器那段 JS 住在 `const JS = <反引号>…<反引号>` 模板字面量里，
 *   模板字面量会把「反斜杠 + 字符」变成那个字符（反斜杠 s 变 s、反斜杠 d 变 d、反斜杠 n 变真换行）
 *   ⇒ **正则/字符串静默失效**（§E397b 家族标签就是这么坏的：源里 \s+[\d.] 产物里变成 s+[d.]，
 *     内联自证用 new Function 只查语法、查不出语义失效）。
 *   门：**代码与字符串**里不许出现「反斜杠 + 字母」，除双反斜杠（产物里是一个）与反斜杠 u / x（合法 unicode/hex）。
 *   ⚠ **注释跳过**：注释里写这些是为了记录这个坑（现有 4 处都是注释）⇒ 不能因此红。
 *   要写正则里的反斜杠 s，就得在源里写**两个反斜杠**。 */
{
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const BT = String.fromCharCode(96), BS = String.fromCharCode(92), NL = String.fromCharCode(10);
  const head = 'const JS = ' + BT;
  const a0 = self.indexOf(head), b0 = a0 < 0 ? -1 : self.indexOf(BT, a0 + head.length);
  if (a0 < 0 || b0 < 0) { console.error('⛔ 找不到 JS 模板区 ⇒ 转义门失效（拒绝落盘）'); process.exit(3); }
  const tpl = self.slice(a0 + head.length, b0), bad = [];
  let inBlk = false, inLine = false, q = '';
  for (let i = 0; i < tpl.length; i++) {
    const c = tpl[i], n = tpl[i + 1] || '';
    if (inBlk) { if (c === '*' && n === '/') { inBlk = false; i++; } continue; }
    if (inLine) { if (c === NL) inLine = false; continue; }
    if (q) { if (c === BS) { const m = tpl[i + 2] || ''; if (m !== BS && m !== 'u' && m !== 'x' && /[A-Za-z]/.test(n)) bad.push('第 ' + (tpl.slice(0, i).split(NL).length + 1) + ' 行（字符串内）：反斜杠 ' + n); i++; continue; } if (c === q) q = ''; continue; }
    if (c === '/' && n === '*') { inBlk = true; i++; continue; }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === String.fromCharCode(39) || c === String.fromCharCode(34)) { q = c; continue; }
    if (c === BS) { const m = n; if (m === BS) { i++; continue; } if (m === 'u' || m === 'x') continue; if (/[A-Za-z]/.test(m)) bad.push('第 ' + (tpl.slice(0, i).split(NL).length + 1) + ' 行：反斜杠 ' + m + ' ⇒ 产物里会变成 ' + m); }
  }
  if (bad.length) {
    console.error('⛔ 模板区（代码/字符串）里有会被模板字面量吃掉的转义 —— 在源里写**双反斜杠**即可：');
    console.error('  ' + bad.slice(0, 12).join(NL + '  '));
    process.exit(3);
  }
  console.log('模板转义自证 ✅ 代码/字符串里没有被吃掉的「反斜杠+字母」（注释不计）');
}

/* E391 DS：先自证、后落盘。原来是反的（先写坏文件、再自证失败 exit 3）⇒ 产物已经坏了，而我下一句没看退出码就截图。顺序一换，写坏文件这一步根本不会发生。 */
writeFileSync(join(HERE, OUT), html);
console.log('已写 ' + join(HERE, OUT) + '（' + (html.length / 1024).toFixed(0) + ' KB，自包含、无外部依赖）');
