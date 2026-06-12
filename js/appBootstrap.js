/**
 * App Bootstrap — Inizializzazione della PWA
 *
 * Questo modulo gestisce l'avvio dell'app:
 * 1. Inizializza IndexedDB
 * 2. Richiede storage persistente
 * 3. Registra il service worker
 * 4. Mostra la UI principale
 *
 * L'ordine è CRITICO:
 * - IndexedDB DEVE essere pronto prima di mostrare la UI
 * - Storage persistente viene richiesto in background (non blocca)
 * - Service worker viene registrato in background
 */

import { initStorage, getDbStats } from './storage.js';
import { ensurePersistentStorage, logStorageInfo } from './storage/persistence.js';

/**
 * Stato bootstrap globale
 */
const bootstrapState = {
  dbReady: false,
  swRegistered: false,
  persistenceGranted: false,
  error: null
};

/**
 * Inizializza IndexedDB
 * Questo DEVE completarsi prima di mostrare l'app
 */
async function initializeDatabase() {
  try {
    console.log('🗄️ Inizializzazione IndexedDB...');
    await initStorage();
    bootstrapState.dbReady = true;
    console.log('📊 IndexedDB:', await getDbStats());
    console.log('✅ Database pronto');
    return true;
  } catch (error) {
    bootstrapState.error = error;
    console.error('❌ Errore inizializzazione database:', error);
    return false;
  }
}

/**
 * Richiedi storage persistente
 * Eseguito in background, non blocca l'app
 */
async function requestPersistentStorage() {
  try {
    console.log('🔐 Richiesta storage persistente...');
    const granted = await ensurePersistentStorage();
    bootstrapState.persistenceGranted = granted;
    await logStorageInfo();
  } catch (error) {
    console.warn('⚠️ Errore persistenza storage:', error);
    // Non bloccare l'app se questo fallisce
  }
}

/**
 * Registra il service worker
 * Eseguito in background
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('ℹ️ Service Worker non supportato in questo browser');
    return;
  }

  try {
    console.log('⚙️ Registrazione service worker...');
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    bootstrapState.swRegistered = true;
    console.log('✅ Service Worker registrato');

    // Ascolta aggiornamenti del SW
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('📢 Nuovo service worker disponibile');
          notifyNewVersionAvailable();
        }
      });
    });

    // Check periodicamente per aggiornamenti (ogni ora)
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);
  } catch (error) {
    console.warn('⚠️ Errore registrazione service worker:', error);
    // Non bloccare l'app se questo fallisce
  }
}

/**
 * Ascolta messaggi dal service worker
 */
function listenToServiceWorkerMessages() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data.type === 'SW_UPDATED') {
      console.log('📢 Service Worker ha un aggiornamento:', event.data.message);
      notifyNewVersionAvailable();
    }
  });
}

/**
 * Mostra notifica di nuova versione disponibile
 */
function notifyNewVersionAvailable() {
  // Crea un banner in cima alla pagina
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px;
    text-align: center;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    font-weight: 500;
  `;

  const reloadBtn = document.createElement('button');
  reloadBtn.textContent = 'Ricarica per gli aggiornamenti';
  reloadBtn.style.cssText = `
    background: white;
    color: #667eea;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    margin-left: 16px;
  `;

  reloadBtn.addEventListener('click', () => {
    window.location.reload();
  });

  banner.appendChild(document.createTextNode('Una nuova versione dell\'app è disponibile. '));
  banner.appendChild(reloadBtn);

  document.body.insertBefore(banner, document.body.firstChild);

  // Log nel registro
  console.log('🔔 Banner di aggiornamento mostrato all\'utente');
}

/**
 * Banner persistente: IndexedDB non disponibile, dati in modalità limitata.
 * Mostrato quando l'app gira sul fallback localStorage (es. modalità privata):
 * i dati possono andare persi alla chiusura del browser.
 */
function showStorageWarningBanner() {
  const banner = document.createElement('div');
  banner.id = 'storage-warning-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #b45309;
    color: white;
    padding: 12px 16px;
    text-align: center;
    z-index: 9999;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  banner.textContent = '⚠️ Salvataggio limitato: il browser non consente lo storage permanente (modalità privata?). I dati potrebbero andare persi alla chiusura.';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Chiudi avviso');
  closeBtn.style.cssText = 'background:none;border:none;color:white;font-size:16px;margin-left:12px;cursor:pointer;';
  closeBtn.addEventListener('click', () => banner.remove());
  banner.appendChild(closeBtn);

  document.body.insertBefore(banner, document.body.firstChild);
}

/**
 * Mostra errore di bootstrap
 */
function showBootstrapError(error) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 32px;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    max-width: 500px;
    z-index: 9999;
  `;

  errorDiv.innerHTML = `
    <h2 style="color: #d32f2f; margin-top: 0;">Errore di inizializzazione</h2>
    <p>Questo browser non supporta lo storage offline necessario per funzionare.</p>
    <p style="color: #666; font-size: 14px;">Dettagli: ${error.message}</p>
    <p style="color: #666; font-size: 14px;">Prova con un browser moderno (Chrome, Firefox, Safari, Edge).</p>
  `;

  document.body.innerHTML = '';
  document.body.appendChild(errorDiv);
}

/**
 * Attendi che il DOM sia pronto
 */
function waitForDOM() {
  return new Promise(resolve => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve);
    } else {
      resolve();
    }
  });
}

/**
 * MAIN: Bootstrap dell'app
 * Questa funzione dovrebbe essere chiamata all'inizio di app.js
 */
export async function bootstrapApp() {
  console.log('🚀 Avvio app...');
  console.log('═'.repeat(60));

  // Aspetta il DOM
  await waitForDOM();

  // 1. CRITICO: Inizializza IndexedDB
  const dbOk = await initializeDatabase();

  if (!dbOk) {
    // storage.js ha un fallback localStorage: l'app può continuare, ma
    // l'utente DEVE sapere che i dati sono salvati in modalità limitata
    // (prima il fallimento era silenzioso o bloccava tutto).
    if (typeof localStorage === 'undefined') {
      showBootstrapError(bootstrapState.error);
      return false;
    }
    showStorageWarningBanner();
  }

  // 2. Background: Richiedi storage persistente
  requestPersistentStorage();

  // 3. Background: Registra service worker
  registerServiceWorker();

  // 4. Ascolta messaggi dal SW
  listenToServiceWorkerMessages();

  console.log('═'.repeat(60));
  console.log('✅ Bootstrap completato\n');

  return true;
}

/**
 * Fornisci accesso allo stato bootstrap per debugging
 */
export function getBootstrapState() {
  return { ...bootstrapState };
}

/**
 * Log dello stato bootstrap
 */
export function logBootstrapState() {
  console.log('📊 Bootstrap State:', bootstrapState);
}
