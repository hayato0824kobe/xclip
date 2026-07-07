// XCLIP Service Worker
const CACHE = 'xclip-v1';
const SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Supabase等のAPIは常にネットワーク（キャッシュしない）
  if (url.hostname.endsWith('supabase.co') || url.pathname.includes('/rest/v1/')) return;

  // アプリ本体: ネットワーク優先（更新をすぐ反映）、オフライン時はキャッシュ
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // CDN(フォント/leaflet等): キャッシュ優先
  if (/unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then(m => m || fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }))
    );
  }
});
