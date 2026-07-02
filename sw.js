/**
 * SERVICE WORKER — Conta Calorie
 *
 * Strategia:
 * - APP_VERSION è l'UNICA costante da cambiare per pubblicare un aggiornamento.
 * - App shell (HTML/CSS/JS): stale-while-revalidate → risposta immediata dalla
 *   cache + refresh in background. Gli aggiornamenti arrivano senza dover
 *   ricordarsi di rinominare la cache (il banner "nuova versione" resta per
 *   gli update del SW stesso).
 * - Database alimenti (data/*.json): pre-cachato → la ricerca funziona offline
 *   anche al primo avvio dopo l'installazione.
 * - ignoreSearch: true → i query param di cache-busting (?t=...) non causano
 *   cache miss.
 */

const APP_VERSION = 'v27'; // v27: audit completo (2 bug critici + 13 fix medi/minori: NaN statistiche, contatore recenti, swipe-nav duplicata, ecc.)
const CACHE_NAME = `calorie-pwa-${APP_VERSION}`;

const CRITICAL_ASSETS = [
  '/index.html',
  '/css/styles.css',
  '/css/theme.css',
  '/css/mobile-optimized-2026.css',
  '/js/app.js',
  '/js/storage.js',
  '/js/appBootstrap.js',
  '/manifest.webmanifest',
  // Database alimenti CREA: indispensabile per la ricerca offline
  '/data/italian_foods_full.json',
  '/data/crea_hierarchy.json'
];

const STATIC_ASSETS = [
  '/css/components.css',
  '/css/glassmorphism.css',
  '/css/background.css',
  '/js/nutritionEngine.js',
  '/js/nutritionDataProvider.js',
  '/js/models.js',
  '/js/utils.js',
  '/js/micronutrientEngine.js',
  '/js/dataPackLoader.js',
  '/js/creaHierarchy.js',
  '/js/photoNutrition.js',
  '/js/weightLossEstimator.js',
  '/js/recentFoodsTracker.js',
  '/js/activitySyncProviders.js',
  '/js/estimationEngine.js',
  '/js/bodyCompositionModel.js',
  '/js/activityEnergyEngine.js',
  '/js/composedMealWizard.js',
  '/js/coachingRules.js',
  '/js/themeManager.js',
  '/js/bodyCompTracker.js',
  '/js/trendProjection.js',
  '/js/statisticsEngine.js',
  '/js/pwaHandler.js',
  '/js/storage/persistence.js',
  '/js/sync/backupService.js',
  '/js/ui/modal.js',
  '/js/ui/voiceInput.js',
  '/js/ui/statsView.js',
  '/js/ui/weightLoss.js',
  '/js/ui/onboarding.js',
  '/js/ui/dashboard.js',
  '/js/ui/nutritionView.js',
  '/js/ui/physicsView.js',
  '/js/ui/settings.js',
  '/js/ui/collapsible.js',
  '/js/ui/swipeNav.js',
  '/js/ui/lazyLoad.js',
  '/js/ui/estimatedFoodForm.js',
  '/js/ui/userFoods.js',
  '/js/ui/weekView.js',
  '/js/ui/photoAnalysis.js',
  '/js/ui/activities.js',
  '/js/ui/composedFoodForm.js',
  '/js/ui/foodSearch.js',
  '/js/ui/recipes.js',
  '/js/ui/fridgeView.js',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/apple-touch-icon.png'
];

const FETCH_TIMEOUT = 5000; // 5s timeout per reti 3G

function fetchWithTimeout(request, timeout = FETCH_TIMEOUT) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Fetch timeout')), timeout)
    )
  ]);
}

self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Asset critici: devono riuscire
      return cache.addAll(
        CRITICAL_ASSETS.map(asset => new Request(asset, { cache: 'reload' }))
      ).then(() => {
        // Asset statici: fallimenti tollerati
        return Promise.allSettled(
          STATIC_ASSETS.map(asset =>
            cache.add(new Request(asset, { cache: 'reload' }))
          )
        );
      });
    }).catch(error => {
      console.error('❌ SW: installazione cache critica fallita:', error);
    })
  );
});

self.addEventListener('activate', event => {
  self.clients.claim();

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
});

/**
 * Stale-while-revalidate: risponde subito dalla cache e aggiorna in background.
 * `cache: 'no-cache'` nella rivalidazione bypassa la cache HTTP del browser,
 * così gli aggiornamenti deployati arrivano entro un reload.
 */
function staleWhileRevalidate(event) {
  return caches.match(event.request, { ignoreSearch: true }).then(cached => {
    const networkUpdate = fetchWithTimeout(new Request(event.request.url, { cache: 'no-cache' }))
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request.url.split('?')[0], clone));
        }
        return response;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(networkUpdate);
      return cached;
    }
    return networkUpdate.then(response => {
      if (response) return response;
      if (event.request.destination === 'document') {
        return caches.match('/index.html', { ignoreSearch: true });
      }
      return Response.error();
    });
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const isHtml = event.request.destination === 'document';
  const isAppAsset = isHtml ||
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/data/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest';

  if (isAppAsset) {
    // App shell + dati: stale-while-revalidate (veloce E aggiornato)
    event.respondWith(staleWhileRevalidate(event));
  } else {
    // Tutto il resto: network-first con fallback cache
    event.respondWith(
      fetchWithTimeout(event.request)
        .then(response => {
          if (!response || response.status !== 200) {
            return caches.match(event.request, { ignoreSearch: true }).then(c => c || response);
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
