/* 中小企業診断士 過去問トレーナー - Service Worker
 * 役割: PWAのインストール要件を満たし、一度開いたページをオフラインでも表示する。
 * 方針: ネットワーク優先(最新を取りに行き、失敗したらキャッシュを返す)。
 *       単一HTMLアプリなので、トップページとアイコンをキャッシュしておけば十分。
 */
const CACHE = 'shikaku-trainer-v1';        // ← index.html を更新したらバージョンを v2, v3... と上げる
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('/index.html')))
  );
});
