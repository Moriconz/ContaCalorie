const CACHE_NAME = 'calorie-pwa-v4';
const STATIC_ASSETS = [
  '/index.html',
  '/css/styles.css',
  '/css/theme.css',
  '/css/glassmorphism.css',
  '/css/background.css',
  '/js/app.js',
  '/js/storage.js',
  '/js/nutritionEngine.js',
  '/js/nutritionDataProvider.js',
  '/js/photoNutrition.js',
  '/js/models.js',
  '/js/typicalValues.js',
  '/js/dataPackLoader.js',
  '/js/themeManager.js',
  '/js/pwaHandler.js',
  '/js/appBootstrap.js',
  '/js/ui/onboarding.js',
  '/js/ui/dashboard.js',
  '/js/ui/foodSearch.js',
  '/js/ui/userFoods.js',
  '/js/ui/weekView.js',
  '/js/ui/photoAnalysis.js',
  '/js/ui/estimatedFoodForm.js',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('📦 Caching', STATIC_ASSETS.length, 'assets...');
      return cache.addAll(
        STATIC_ASSETS.map(asset => new Request(asset, { cache: 'reload' }))
      );
    }).catch(error => {
      console.warn('⚠️ Cache installation error:', error.message);
    })
  );
});

self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  self.clients.claim();
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('🧹 Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    })
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
          if (isDocument) return caches.match('/index.html');
          return response;
        }

        if (isDocument) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }

        return response;
      }).catch(() => {
        if (isDocument) return caches.match('/index.html');
        return null;
      });
    })
  );
});
