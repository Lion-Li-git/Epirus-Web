/* gl-mesh.js —— E404 DS（D-3 本体）：**壳的 WebGL2 后端**。只画壳，其余（点/地板/标签）仍走 2D 画布。
 *
 * 为什么要换后端（E402/E403 量出来的，不是感觉）：稳态成本全在 **CPU 的 path 填充**上 ——
 *   开不开 GPU 几乎无差别（16.78↔17.40 / 23.54↔24.56 ms/帧）⇒ GPU 只合成最终位图，插不上手；
 *   而"把 4868 个面合并成一个大 Path2D"这条路**实测更慢**（102.78 vs 23.54 ms/帧）⇒ Canvas 对大 path 的代价极高。
 *   ⇒ 唯一的出路是**把光栅化交给 GPU**：面一次性上传成 VBO/IBO，逐帧只改一个 uniform。
 *
 * 设计取舍（都为了"最小、可回滚"）：
 *   · 独立文件、由生成器内联 ⇒ 不碰查看器那段模板字面量（那里 `\X` 会被吃掉，见 §E398 的门）；
 *   · **2D 正交**：投影仍在 CPU 做（查看器已有 `prj`），这里只接收**屏幕坐标**的三角形 ⇒ 不需要 4×4 矩阵、不需要深度缓冲；
 *   · 两个元素缓冲：三角形（半透填充）+ 线段（线框）⇒ 两次 drawElements，外观尽量贴近旧路；
 *   · 自己建一张**覆盖在主画布之上**的透明画布（pointer-events:none）⇒ 不干扰命中测试与交互。
 *   ⚠ 已知取舍（要看图确认）：GL 层在主画布**之上** ⇒ 壳会盖在点上面（旧路是"先画壳后画点、点浮在上面"）。
 */
var GLM = (function () {
  var cv = null, gl = null, prog = null, vbo = null, ibo = null, iboLine = null, MCV = null;
  var nIdx = 0, nLine = 0, capV = 0, ok = false, fillLoc = null, alphaU = null, DRAWN = 0, V0 = new Float32Array(2);

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.log('GL 着色器编译失败：' + gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  /* ⚠ 着色器源码里不能出现模板字面量会吃掉的反斜杠（这里本来也没有），换行一律用 fromCharCode ⇒ 不写 \n */
  var NL = String.fromCharCode(10);
  var VS = ['#version 300 es', 'in vec2 p;', 'void main() { gl_Position = vec4(p, 0.0, 1.0); }'].join(NL);
  var FS = ['#version 300 es', 'precision mediump float;', 'uniform vec4 c;', 'out vec4 o;',
    'void main() { o = c; }'].join(NL);

  function init(mainCv) {
    if (ok) return true;
    try {
      cv = document.createElement('canvas');   /* E411 DS：**离屏** —— 不进 DOM（层叠/尺寸/命中测试全都绕开），
                                                       *   画完由调用方 g.drawImage 贴进主画布。 */
      gl = cv.getContext('webgl2', { alpha: true, antialias: true, depth: false });
      if (!gl) { console.log('GL 不可用（webgl2 起不来）⇒ 回落 2D 老路'); return false; }
      var v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS);
      if (!v || !f) return false;
      prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.log('GL 链接失败：' + gl.getProgramInfoLog(prog)); return false; }
      gl.useProgram(prog);
      var al = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(al);
      alphaU = gl.getUniformLocation(prog, 'c');
      vbo = gl.createBuffer(); ibo = gl.createBuffer(); iboLine = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      ok = true;
      /* E407 DS：**一次性自述**（无头/真机都能读）：尺寸、层叠、错误码 —— 下次"不显示"就不用猜。 */
      /* E407 DS：自述挪到**第一次 draw 之后**（放在 init 里报的是 300x150 的默认尺寸，等于没说）。 */
      return true;
    } catch (e) { console.log('GL 初始化异常：' + e.message); ok = false; return false; }
  }

  /* CSS 尺寸 → 绘制缓冲（dpr）；返回是否可用 */
  /* E408 DS：**像素口径必须与查看器一致**。原来这里乘 window.devicePixelRatio，而查看器用的是它自己那个
   *   devicePixelRatio，两者不是同一个值（实测 210 → 125）⇒ 视口比几何矮 85px ⇒ 壳大半画到视口外 ⇒ "看不见"。
   *   现在：W/H 就是**缓冲区像素**（调用方给 w/h，即主画布的 cv.width/height），CSS 尺寸单独给。 */
  function resize(W, H, cssW, cssH) {
    if (!ok) return false;
    W = Math.max(1, Math.round(W)); H = Math.max(1, Math.round(H));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H);
    return true;
  }

  /* verts = 屏幕坐标（CSS px）的 Float32Array 平铺；tris/lines = 索引数组 */
  function upload(verts, tris, lines) {
    if (!ok) return false;
    if (verts.length >= 2) { V0[0] = verts[0]; V0[1] = verts[1]; }
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    if (verts.length > capV) { gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW); capV = verts.length; }
    else gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tris, gl.DYNAMIC_DRAW);
    nIdx = tris.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboLine);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lines, gl.DYNAMIC_DRAW);
    nLine = lines.length;
    return true;
  }

  /* 半透填充 + 线框；颜色用与 2D 路同一套 rgba 字符串的数值 */
  function draw(fill, line1) {
    if (!ok) return false;
    var W = cv.width, H = cv.height;
    /* 屏幕 y 向下、GL 的 y 向上 ⇒ 在顶点里就已经翻好（见查看器），这里不再翻转 */
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    /* 预乘 alpha（画布声明为预乘 ⇒ 颜色必须乘好）*/
    function pm(c4) { return [c4[0] * c4[3], c4[1] * c4[3], c4[2] * c4[3], c4[3]]; }
    if (nIdx) {
      var f4 = pm(fill); gl.uniform4f(alphaU, f4[0], f4[1], f4[2], f4[3]);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_INT, 0);
    }
    if (nLine) {
      var l4 = pm(line1); gl.uniform4f(alphaU, l4[0], l4[1], l4[2], l4[3]);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboLine);
      gl.drawElements(gl.LINES, nLine, gl.UNSIGNED_INT, 0);
    }
    if (!DRAWN) { DRAWN = 1;
      console.log('GL 离屏首帧：canvas ' + cv.width + 'x' + cv.height + ' · 视口 ' + gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight +
        ' · nIdx ' + nIdx + ' nLine ' + nLine + ' · err ' + gl.getError() + ' · 在 DOM 里=' + (cv.parentNode ? '是' : '否')); }

    return true;
  }
  function clear() { if (ok) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } }
  function hide() { if (cv) cv.style.display = 'none'; }
  function show() { if (cv) cv.style.display = ''; }
  return { init: init, resize: resize, upload: upload, draw: draw, clear: clear, show: show, hide: hide,
    on: function () { return ok; }, canvas: function () { return cv; } };
})();
