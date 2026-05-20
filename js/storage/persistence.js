/**
 * Storage Persistence — Gestione storage persistente del browser
 *
 * Implementa:
 * - navigator.storage.persist() per richiedere storage permanente
 * - navigator.storage.estimate() per quota e usage
 * - Feature detection e fallback per browser meno recenti
 */

/**
 * Richiedi storage persistente al browser
 * Su browser moderni, impedisce che i dati vengano cancellati se il storage è pieno
 */
export async function ensurePersistentStorage() {
  // Feature detection
  if (!navigator.storage || !navigator.storage.persist) {
    console.log('ℹ️ Storage persistente non supportato in questo browser');
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persist();
    if (isPersisted) {
      console.log('✅ Storage persistente garantito');
    } else {
      console.log('⚠️ Storage persistente non concesso (utente può aver rifiutato)');
    }
    return isPersisted;
  } catch (error) {
    console.warn('⚠️ Errore richiesta storage persistente:', error);
    return false;
  }
}

/**
 * Ottieni informazioni su quota e usage dello storage
 */
export async function getStorageInfo() {
  // Feature detection
  if (!navigator.storage || !navigator.storage.estimate) {
    console.log('ℹ️ Storage estimate non supportato');
    return {
      quota: null,
      usage: null,
      percentUsed: null,
      persisted: false
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const percentUsed = estimate.quota > 0
      ? Math.round((estimate.usage / estimate.quota) * 100)
      : 0;

    return {
      quota: estimate.quota,
      usage: estimate.usage,
      percentUsed,
      persisted: await navigator.storage.persisted?.() ?? false
    };
  } catch (error) {
    console.warn('⚠️ Errore lettura storage info:', error);
    return {
      quota: null,
      usage: null,
      percentUsed: null,
      persisted: false
    };
  }
}

/**
 * Log informazioni storage nel console
 */
export async function logStorageInfo() {
  const info = await getStorageInfo();

  if (!info.quota) {
    console.log('ℹ️ Storage estimate non disponibile');
    return;
  }

  const usedMB = (info.usage / 1024 / 1024).toFixed(2);
  const quotaMB = (info.quota / 1024 / 1024).toFixed(1);
  const persistedStatus = info.persisted ? '🔒 Persistente' : '⏳ Non persistente';

  console.log(`📊 Storage quota: ${usedMB} MB / ${quotaMB} MB (${info.percentUsed}% usato) [${persistedStatus}]`);
}

/**
 * Verifica se il browser supporta storage persistente
 */
export function isPersistenceSupported() {
  return !!(navigator.storage && navigator.storage.persist);
}

/**
 * Verifica se il browser supporta storage estimate
 */
export function isEstimateSupported() {
  return !!(navigator.storage && navigator.storage.estimate);
}
