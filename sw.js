// Service worker: keeps CHROMA playable offline once it's been opened.
// Bump VERSION whenever game files change so phones pick up the new build.
const VERSION = 'chroma-v1';
const FILES = [
  './',
  'index.html',
  'style.css',
  'game.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, so updates show up straight away when online; the cache covers offline play
// (including the Google Fonts files, which are cached the first time they load).
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // revalidate our own files every time so an old copy never sticks around
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  event.respondWith(
    fetch(req, sameOrigin ? { cache: 'no-cache' } : undefined)
      .then(res => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(VERSION).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./')))
  );
});
