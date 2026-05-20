/**
 * Service Worker — Conta Calorie PWA
 *
 * PRINCIPI CRITICI:
 * 1. Gestisce SOLO Cache Storage per asset (HTML, JS, CSS, immagini)
 * 2. NUNCA tocca IndexedDB — i dati utente rimangono intatti su update
 * 3. Aggiornamenti del SW avvengono in background senza perdere dati
 * 4. Notifica la pagina quando una nuova versione è disponibile
 *
 * FLUSSO DI AGGIORNAMENTO:
 * - Install: scarica nuovi asset nel cache
 * - Activate: pulisce SOLO vecchie cache (non IndexedDB)
 * - Fetch: usa cache-first per asset, network per data API
 */

const CACHE_NAME = 'calorie-pwa-v4';
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
  '/js/dataPackLoader.js',
  '/js/ui/onboarding.js',
  '/js/ui/dashboard.js',
  '/js/ui/foodSearch.js',
  '/js/ui/userFoods.js',
  '/js/ui/weekView.js',
  '/js/ui/photoAnalysis.js',
  '/js/ui/estimatedFoodForm.js',
  '/db/indexedDbClient.js',
  '/storage/persistence.js',
  '/sync/backupService.js',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/apple-touch-icon.png'
];

/**
 * Install event: scarica nuovo cache con asset aggiornati
 * Usa skipWaiting() per attivare subito il nuovo SW
 */
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log(`📦 Caching ${STATIC_ASSETS.length} asset...`);
      return cache.addAll(
        STATIC_ASSETS.map(asset => new Request(asset, { cache: 'reload' }))
      );
    }).catch(error => {
      console.warn('⚠️ Cache installation partial:', error);
      // Non è fatale se alcuni asset non si cachano
    })
  );
});

/**
 * Activate event: pulisce vecchi cache
 * IMPORTANTE: non tocca IndexedDB, lascia i dati utente intatti
 */
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  self.clients.claim();

  event.waitUntil(
    caches.keys().then(keys => {
      console.log(`🧹 Cleaning old caches: ${keys.length} found`);
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log(`   Deleting cache: ${key}`);
            return caches.delete(key);
          })
      );
    })
  );

  // Notifica tutti i client che una nuova versione è disponibile
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_UPDATED',
        message: 'Nuova versione disponibile. Ricarica per gli aggiornamenti.'
      });
    });
  });
});

/**
 * Fetch event: network-first per data API, cache-first per asset
 */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Non gestire richieste da altri origin
  if (url.origin !== location.origin) return;

  const isDocument = event.request.destination === 'document';
  const isDataRequest = url.pathname.startsWith('/data/');

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) {
          return isDocument ? caches.match('/index.html') : response;
        }

        // Casha i documenti e i data pack per accesso offline
        if (isDocument || isDataRequest) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      }).catch(() => {
        // Fallback: se offline, ritorna versione in cache se esiste
        if (isDocument) return caches.match('/index.html');
        if (isDataRequest) return caches.match(event.request);
        return null;
      });
    })
  );
});
