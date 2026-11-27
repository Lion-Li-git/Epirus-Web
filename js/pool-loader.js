/* pool-loader.js —— 冠军池分片的按需加载（2026-11-22）
 *
 * 背景：页面一局只抽 N−1 枚包（2P 1 枚 / 3P 2 枚 / 5P 4 枚 / 8P 7 枚），
 *   旧实现却让所有用户下载 9.6MB 的整表 bundle（gzip 4.4MB）。
 *
 * 这一层只做四件事：
 *   ① ensure(ids)：把本局抽到的几枚 js/pool-packs/<file>.js 用 script 注入（不是 fetch ⇒ file:// 也能用）；
 *   ② 本地 file:// 没有分片文件时，回退到整表 js/bundled-champion-pool.js（双击 index.html 的零构建入口）；
 *   ③ HTTP 下某个分片 404/损坏时，也只回退一次整表，并在 console 响亮说明（契约 §4：降级不许静默）；
 *   ④ 按清单 wid 核对权重身份，回退后作废晚到分片，避免旧分片覆盖整表。
 *
 * 不碰抽签、不碰权重：抽签仍是 js/pool-draw.js 的 compose；本层只回答"这一枚的权重在不在"。
 */
(function (global) {
  'use strict';
  /* 不要改成 EPIRUS_ 前缀：training/knobs.mjs 会把它误扫成环境旋钮（2026-11-22 CI 红）。 */
  var REG = global.EpirusPoolPacks = global.EpirusPoolPacks || {};
  var pending = {};
  var failed = {};
  var monoPromise = null;
  var fellBack = false;
  var epoch = 0;
  var monoPacks = {};

  function manifest() { return global.EPIRUS_CHAMPION_POOL || null; }
  function isLazy() { return !!(manifest() && manifest().lazy === true); }
  function get(id) { return (fellBack && monoPacks[id]) ? monoPacks[id] : (REG[id] || null); }
  function memberOf(id) {
    var ms = (manifest() && manifest().members) || [];
    for (var i = 0; i < ms.length; i++) if (ms[i].id === id) return ms[i];
    return null;
  }
  function fileOf(id) {
    var m = memberOf(id);
    return m ? (m.file || (String(id) + '.js')) : (String(id).replace(/[^A-Za-z0-9._-]/g, '_') + '.js');
  }
  function rol32(x, n) { return (x << n) | (x >>> (32 - n)); }
  function sha1Sync(bytes) {
    var len = bytes.length, bitLen = len * 8;
    var total = ((len + 9 + 63) >> 6) << 6;
    var data = new Uint8Array(total), view = new DataView(data.buffer);
    data.set(bytes); data[len] = 0x80;
    view.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false);
    view.setUint32(total - 4, bitLen >>> 0, false);
    var h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    var w = new Uint32Array(80);
    for (var off = 0; off < total; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
      for (i = 16; i < 80; i++) w[i] = rol32(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      var a = h0, b = h1, c = h2, d = h3, e = h4;
      for (i = 0; i < 80; i++) {
        var f, k;
        if (i < 20) { f = (b & c) | ((~b) & d); k = 0x5a827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
        else { f = b ^ c ^ d; k = 0xca62c1d6; }
        var t = (rol32(a, 5) + f + e + w[i] + k) >>> 0;
        e = d; d = c; c = rol32(b, 30); b = a; a = t;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    return [h0, h1, h2, h3, h4].map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }
  function widOf(pack) {
    if (!pack || !Array.isArray(pack.a)) return Promise.reject(new Error('分片加载了但权重形状不对'));
    if (typeof global.TextEncoder !== 'function') return Promise.reject(new Error('当前浏览器缺少 TextEncoder，无法核对冠军包 wid'));
    var bytes = new global.TextEncoder().encode(JSON.stringify(pack.a));
    if (global.crypto && global.crypto.subtle) {
      return global.crypto.subtle.digest('SHA-1', bytes).then(function (buf) {
        var a = new Uint8Array(buf), hex = '';
        for (var i = 0; i < a.length; i++) hex += ('0' + a[i].toString(16)).slice(-2);
        return hex.slice(0, 16);
      });
    }
    return Promise.resolve(sha1Sync(bytes).slice(0, 16));
  }
  function restoreInvalidated(id) {
    if (monoPacks[id]) REG[id] = monoPacks[id];
    else delete REG[id];
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      var timer = setTimeout(function () { reject(new Error('script load timeout: ' + src)); }, 15000);
      s.src = src;
      s.async = false;
      s.onload = function () { clearTimeout(timer); resolve(); };
      s.onerror = function () { clearTimeout(timer); reject(new Error('script load failed: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadMonolith() {
    if (monoPromise) return monoPromise;
    var v = (manifest() && manifest().ver) || '';
    monoPromise = loadScript('js/bundled-champion-pool.js?v=' + encodeURIComponent(v)).then(function () {
      var full = global.EPIRUS_CHAMPION_POOL;
      if (!full || !Array.isArray(full.members)) throw new Error('整表 bundle 加载了但形状不对');
      return Promise.all(full.members.map(function (m) {
        if (!m || !m.id || !m.pack) throw new Error('整表 bundle 里有成员缺少 id/pack');
        var want = memberOf(m.id);
        if (!want || want.wid !== m.wid) throw new Error('整表成员与清单身份不符：' + m.id);
        return widOf(m.pack).then(function (got) {
          if (got !== m.wid) throw new Error('整表成员 wid 不符：' + m.id + '（应为 ' + m.wid + '，实得 ' + got + '）');
          return m;
        });
      })).then(function (checked) {
        monoPacks = {};
        for (var i = 0; i < checked.length; i++) {
          var m = checked[i];
          monoPacks[m.id] = m.pack;
          REG[m.id] = m.pack;
        }
        return true;
      });
    }).catch(function (e) {
      monoPromise = null;
      throw e;
    });
    return monoPromise;
  }
  function loadOne(id) {
    if (get(id)) return Promise.resolve(get(id));
    if (failed[id]) return Promise.reject(new Error('pack 已失败: ' + id));
    if (pending[id]) return pending[id];
    var myEpoch = epoch;
    var src = 'js/pool-packs/' + encodeURIComponent(fileOf(id)) + '?v=' + encodeURIComponent((manifest() && manifest().ver) || '');
    pending[id] = loadScript(src).then(function () {
      var pack = REG[id];
      if (!pack) throw new Error('分片脚本加载了但注册表里没有 ' + id);
      return widOf(pack).then(function (got) {
        if (myEpoch !== epoch) {
          restoreInvalidated(id);
          throw new Error('分片已因回退作废：' + id);
        }
        var want = memberOf(id);
        if (!want || got !== want.wid) {
          delete REG[id];
          throw new Error('分片 wid 不符：' + id + '（应为 ' + (want && want.wid) + '，实得 ' + got + '）');
        }
        return pack;
      });
    }).catch(function (e) {
      if (myEpoch !== epoch) restoreInvalidated(id);
      else delete REG[id];
      failed[id] = true;
      throw e;
    });
    return pending[id];
  }
  function ensure(ids) {
    ids = (ids || []).filter(Boolean);
    if (!ids.length) return Promise.resolve([]);
    if (!isLazy()) return Promise.resolve(ids.map(get));
    var missing = ids.filter(function (id) { return !get(id); });
    if (!missing.length) return Promise.resolve(ids.map(get));
    if (fellBack) return loadMonolith().then(function () { return ids.map(get); });
    if (global.location && global.location.protocol === 'file:') {
      return loadMonolith().then(function () { return ids.map(get); });
    }
    return Promise.all(missing.map(loadOne)).then(function () {
      return ids.map(get);
    }).catch(function (e) {
      epoch++;
      fellBack = true;
      if (global.console && console.warn) {
        console.warn('[pool-loader] 分片加载失败，回退到整表 js/bundled-champion-pool.js：' + e.message);
      }
      return loadMonolith().then(function () { return ids.map(get); });
    });
  }
  global.EpirusPoolLoader = {
    isLazy: isLazy, manifest: manifest, ensure: ensure, get: get, loadMonolith: loadMonolith,
    fellBack: function () { return fellBack; },
  };
})(typeof window !== 'undefined' ? window : globalThis);