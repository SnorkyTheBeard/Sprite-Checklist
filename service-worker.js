const CACHE = 'galaxy-sprite-checklist-v38';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './published-design.js',
  './data.js',
  './app.js',
  './manifest.webmanifest',
  './fonts/comic-neue-regular.woff2',
  './fonts/comic-neue-bold.woff2',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const FAST_NETWORK_BUDGET = 700;

function preferFreshWithin(networkRequest, cachedResponse) {
  const safeNetwork = networkRequest
    .then((response) => response?.ok ? response : (cachedResponse || response))
    .catch(() => cachedResponse || Response.error());
  if (!cachedResponse) return safeNetwork;
  return Promise.race([
    safeNetwork,
    new Promise((resolve) => setTimeout(() => resolve(cachedResponse),FAST_NETWORK_BUDGET))
  ]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(CORE.map((path) => cache.add(path).catch(() => null))))
  );
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
    const cacheKey = new URL(event.request.url);
    cacheKey.search = '';
    const networkUpdate = caches.open(CACHE).then((cache) =>
      fetch(event.request,{ cache:'no-cache' }).then(async (response) => {
        if (response.ok) await cache.put(cacheKey.toString(),response.clone());
        return response;
      })
    );
    event.waitUntil(networkUpdate.catch(() => null));
    event.respondWith(
      caches.match(cacheKey.toString()).then((cached) => preferFreshWithin(networkUpdate,cached))
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    const networkUpdate = fetch(event.request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put('./index.html',response.clone());
      }
      return response;
    });
    event.waitUntil(networkUpdate.catch(() => null));
    event.respondWith(
      caches.match('./index.html').then((cached) => preferFreshWithin(networkUpdate,cached))
    );
    return;
  }

  const networkUpdate = caches.open(CACHE).then((cache) =>
    fetch(event.request).then(async (response) => {
      if (response.ok) await cache.put(event.request,response.clone());
      return response;
    })
  );
  event.waitUntil(networkUpdate.catch(() => null));
  event.respondWith(
    caches.match(event.request).then((cached) => cached || networkUpdate).catch(() => networkUpdate)
  );
});
