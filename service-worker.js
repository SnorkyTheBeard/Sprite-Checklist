const CACHE = 'galaxy-sprite-checklist-v25';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './published-design.js',
  './published-assets/theme-body-bg-image.webp',
  './data.js',
  './app.js',
  './manifest.webmanifest',
  './fonts/comic-neue-regular.woff2',
  './fonts/comic-neue-bold.woff2',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  if (new URL(event.request.url).pathname.endsWith('/published-design.js')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cacheKey = new URL(event.request.url);
        cacheKey.search = '';
        const cached = await cache.match(cacheKey.toString());
        try {
          const response = await fetch(event.request,{ cache:'no-cache' });
          if (response.ok) cache.put(cacheKey.toString(),response.clone());
          return response;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
  );
});
