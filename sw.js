const CACHE = 'meditrack-v9';
const FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;               // Firestore writes/RPC → straight to network
  const url = new URL(req.url);

  // Never intercept live data / auth endpoints — let the browser handle them directly.
  if (/firestore\.googleapis\.com|firebaseio\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|google-analytics\.com|googletagmanager\.com/.test(url.hostname)) return;

  // Cache-first for the app shell; runtime-cache same-origin + the Firebase SDK (gstatic)
  // so the installed PWA can still boot Firebase while offline.
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200 && (url.origin === location.origin || url.hostname === 'www.gstatic.com')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
