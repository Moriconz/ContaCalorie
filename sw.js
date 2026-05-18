const CACHE_NAME = 'calorie-pwa-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/storage.js',
  '/js/nutritionEngine.js',
  '/js/nutritionDataProvider.js',
  '/js/photoNutrition.js',
  '/js/models.js',
  '/js/typicalValues.js',
  '/js/ui/onboarding.js',
  '/js/ui/dashboard.js',
  '/js/ui/foodSearch.js',
  '/js/ui/userFoods.js',
  '/js/ui/weekView.js',
  '/js/ui/photoAnalysis.js',
  '/js/ui/estimatedFoodForm.js',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS.map(asset => new Request(asset, { cache: 'reload' })))
    ).catch(error => {
      console.warn('Cache installation partial:', error);
    })
  );
});

self.addEventListener('activate', event => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.origin !== location.origin) return;

  const isDocument = event.request.destination === 'document';

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) {
          return isDocument ? caches.match('/index.html') : response;
        }

        const responseToCache = response.clone();
        if (isDocument) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      }).catch(() => {
        if (isDocument) return caches.match('/index.html');
        return null;
      });
    })
  );
});
