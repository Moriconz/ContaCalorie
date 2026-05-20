/**
 * Persistent Storage Manager
 *
 * Implementa la richiesta di storage persistente ai browser moderni.
 * Riduce il rischio che il browser svuoti IndexedDB in caso di memoria bassa.
 *
 * API: navigator.storage.persist()
 * Documentazione: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
 *
 * Supporto browser:
 * - Chrome/Edge 55+
 * - Firefox 57+
 * - Android: dipende dal browser
 * - Safari: NON supportato (feature detection lo gestisce)
 */

/**
 * Richiedi storage persistente al browser
 * Questa funzione dovrebbe essere chiamata UNA SOLA VOLTA all'avvio dell'app
 *
 * NON è un errore se ritorna false; significa semplicemente che:
 * - L'API non esiste (Safari vecchi, browser obsoleti)
 * - L'utente non ha il sito installato come PWA
 * - Il browser non concede il permesso (policy di memoria)
 */
export async function ensurePersistentStorage() {
  try {
    // Feature detection: API disponibile?
    if (!navigator.storage || !navigator.storage.persist) {
      console.log('ℹ️ StorageManager API non disponibile in questo browser');
      return false;
    }

    // Controlla se storage è già persistente
    const alreadyPersisted = await navigator.storage.persisted();
    if (alreadyPersisted) {
      console.log('✅ Storage già persistente su questo browser');
      return true;
    }

    // Richiedi persistenza
    console.log('🔐 Richiedendo storage persistente...');
    const granted = await navigator.storage.persist();

    if (granted) {
      console.log('✅ Storage persistente concesso!');
      console.log('   IndexedDB e Cache API non saranno automaticamente svuotati');
    } else {
      console.log('ℹ️ Storage persistente non concesso dal browser');
      console.log('   (è comunque possibile, dipende da policy di memoria e quota)');
    }

    return granted;
  } catch (error) {
    console.warn('⚠️ Errore richiesta storage persistente:', error.message);
    return false;
  }
}

/**
 * Controlla lo stato attuale di persistenza
 * Utile per debugging
 */
export async function isPersistentStorageGranted() {
  try {
    if (!navigator.storage || !navigator.storage.persisted) {
      return false;
    }
    return await navigator.storage.persisted();
  } catch (error) {
    console.warn('⚠️ Errore controllo persistenza:', error.message);
    return false;
  }
}

/**
 * Ottieni informazioni su quota e usage (se disponibile)
 * API: navigator.storage.estimate()
 * Utile per monitorare quanto storage viene usato
 */
export async function getStorageInfo() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) {
      return null;
    }

    const estimate = await navigator.storage.estimate();
    return {
      quota: estimate.quota,
      usage: estimate.usage,
      percentUsed: Math.round((estimate.usage / estimate.quota) * 100)
    };
  } catch (error) {
    console.warn('⚠️ Errore lettura quota storage:', error.message);
    return null;
  }
}

/**
 * Log informazioni di storage
 */
export async function logStorageInfo() {
  const isPersistent = await isPersistentStorageGranted();
  const storageInfo = await getStorageInfo();

  console.log('📦 Storage Info:');
  console.log('   Persistent:', isPersistent ? 'YES' : 'NO');

  if (storageInfo) {
    console.log(`   Usage: ${Math.round(storageInfo.usage / 1024 / 1024)} MB / ${Math.round(storageInfo.quota / 1024 / 1024)} MB`);
    console.log(`   % Used: ${storageInfo.percentUsed}%`);

    // Avviso se quota è quasi piena
    if (storageInfo.percentUsed > 90) {
      console.warn('   ⚠️ Storage quasi pieno! Considera di liberare spazio.');
    }
  }
}
