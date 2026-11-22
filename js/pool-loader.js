/* pool-loader.js —— 冠军池分片的按需加载（2026-11-22）
 *
 * 背景：页面一局只抽 N−1 枚包（2P 1 枚 / 3P 2 枚 / 5P 4 枚 / 8P 7 枚），
 *   旧实现却让所有用户下载 9.6MB 的整表 bundle（gzip 4.4MB）。
 *
 * 这一层只做三件事：
 *   ① ensure(ids)：把本局抽到的几枚 js/pool-packs/<file>.js 用 script 注入（不是 fetch ⇒ file:// 也能用）；
 *   ② 本地 file:// 没有分片文件时，回退到整表 js/bundled-champion-pool.js（双击 index.html 的零构建入口）；
 *   ③ HTTP 下某个分片 404/损坏时，也只回退一次整表，并在 console 响亮说明（契约 §4：降级不许静默）。
 *
 * 不碰抽签、不碰权重：抽签仍是 js/pool-draw.js 的 compose；本层只回答"这一枚的权重在不在"。
 */
(function (global) {
  'use strict';
  var REG = global.EPIRUS_POOL_PACKS = global.EPIRUS_POOL_PACKS || {};
  var pending = {};
  var failed = {};
  var monoPromise = null;
  var fellBack = false;

  function manifest() { return global.EPIRUS_CHAMPION_POOL || null; }
  function isLazy() { return !!(manifest() && manifest().lazy === true); }
  function get(id) { return REG[id] || null; }
  function fileOf(id) {
    var ms = (manifest() && manifest().members) || [];
    for (var i = 0; i < ms.length; i++) if (ms[i].id === id) return ms[i].file || (String(id) + '.js');
    return String(id).replace(/[^A-Za-z0-9._-]/g, '_') + '.js';
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('script load failed: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadMonolith() {
    if (monoPromise) return monoPromise;
    var v = (manifest() && manifest().ver) || '';
    monoPromise = loadScript('js/bundled-champion-pool.js?v=' + encodeURIComponent(v)).then(function () {
      var full = global.EPIRUS_CHAMPION_POOL;
      if (!full || !Array.isArray(full.members)) throw new Error('整表 bundle 加载了但形状不对');
      for (var i = 0; i < full.members.length; i++) {
        var m = full.members[i];
        if (m && m.id && m.pack) REG[m.id] = m.pack;
      }
      return true;
    }).catch(function (e) {
      monoPromise = null;
      throw e;
    });
    return monoPromise;
  }
  function loadOne(id) {
    if (REG[id]) return Promise.resolve(REG[id]);
    if (failed[id]) return Promise.reject(new Error('pack 已失败: ' + id));
    if (pending[id]) return pending[id];
    var src = 'js/pool-packs/' + encodeURIComponent(fileOf(id)) + '?v=' + encodeURIComponent((manifest() && manifest().ver) || '');
    pending[id] = loadScript(src).then(function () {
      if (!REG[id]) throw new Error('分片脚本加载了但注册表里没有 ' + id);
      return REG[id];
    }).catch(function (e) {
      failed[id] = true;
      throw e;
    });
    return pending[id];
  }
  function ensure(ids) {
    ids = (ids || []).filter(Boolean);
    if (!ids.length) return Promise.resolve([]);
    if (!isLazy()) return Promise.resolve(ids.map(get));
    var missing = ids.filter(function (id) { return !REG[id]; });
    if (!missing.length) return Promise.resolve(ids.map(get));
    if (global.location && global.location.protocol === 'file:') {
      return loadMonolith().then(function () { return ids.map(get); });
    }
    return Promise.all(missing.map(loadOne)).then(function () {
      return ids.map(get);
    }).catch(function (e) {
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