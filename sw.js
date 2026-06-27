/* 中小企業診断士 過去問トレーナー — Service Worker
 * アプリシェル(HTML/アイコン/manifest)と CDN ライブラリをキャッシュし、
 * 2回目以降の起動とオフライン表示を可能にする。
 * 内容を更新したら CACHE のバージョン文字列を上げること。
 */
const CACHE = "shindanshi-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
];

// 外部CDN(React / ReactDOM / Babel)。オフラインでも起動できるようキャッシュする。
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // アプリシェルは確実にキャッシュ
    await cache.addAll(APP_SHELL);
    // CDN は失敗してもインストールを止めない(個別にtry)
    await Promise.all(CDN.map(async (url) => {
      try { await cache.add(new Request(url, { cache: "reload" })); } catch (e) { /* ignore */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // ページ遷移(ナビゲーション)はオフライン時 index.html にフォールバック
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE);
        return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      }
    })());
    return;
  }

  // それ以外: キャッシュ優先 → ネットワーク → キャッシュへ保存
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: false });
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      // 同一オリジン or CORS可能なものはキャッシュ(opaqueも保存して再利用)
      if (fresh && (fresh.ok || fresh.type === "opaque")) {
        try { await cache.put(req, fresh.clone()); } catch (e) { /* ignore */ }
      }
      return fresh;
    } catch (e) {
      // CDN等が落ちていてもキャッシュにあれば返す
      const fallback = await cache.match(req, { ignoreVary: true });
      return fallback || Response.error();
    }
  })());
});
