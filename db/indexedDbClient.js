/**
 * IndexedDB Client — Astrazione completa per accesso al database locale
 *
 * VERSIONING E MIGRAZIONI SCHEMA:
 *
 * Version 1 (baseline):
 *   - userProfile (store)
 *   - meals (store) - log giornaliero pasti
 *   - workouts (store) - allenamenti
 *   - bodyComp (store) - composizione corporea
 *   - settings (store) - preferenze app
 *
 * Version 2 (aggiunta syncQueue):
 *   - crea nuovo store "syncQueue" per future sync con backend
 *
 * Version 3 (aggiunta indici):
 *   - aggiunge indici su date per query efficienti
 *   - aggiunge indici per filtri comuni
 *
 * PRINCIPIO: Mai droppare dati. Se uno store non esiste, crearlo.
 * Se esiste già, non toccarlo se è nel vecchio schema.
 */

const DB_NAME = 'conta-calorie-db';
const DB_VERSION = 3; // Incrementare quando schema cambia

// Store names
const STORES = {
  USER_PROFILE: 'userProfile',
  MEALS: 'meals',
  WORKOUTS: 'workouts',
  BODY_COMP: 'bodyComp',
  SETTINGS: 'settings',
  SYNC_QUEUE: 'syncQueue'
};

let _db = null;

/**
 * Inizializza il database IndexedDB
 * Gestisce automaticamente migrazioni di schema
 */
export async function initDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('❌ Errore apertura IndexedDB:', request.error);
      reject(new Error(`IndexedDB error: ${request.error.message}`));
    };

    request.onupgradeneeded = (event) => {
      console.log(`📦 Upgrade schema IndexedDB a versione ${DB_VERSION}`);
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Version 1: schema base
      if (oldVersion < 1) {
        console.log('  → Creazione store di base (v1)');
        createStoreIfNotExists(db, STORES.USER_PROFILE, { keyPath: 'id' });
        createStoreIfNotExists(db, STORES.MEALS, { keyPath: 'id' });
        createStoreIfNotExists(db, STORES.WORKOUTS, { keyPath: 'id' });
        createStoreIfNotExists(db, STORES.BODY_COMP, { keyPath: 'id' });
        createStoreIfNotExists(db, STORES.SETTINGS, { keyPath: 'key' });
      }

      // Version 2: aggiunta syncQueue
      if (oldVersion < 2) {
        console.log('  → Aggiunta store syncQueue (v2)');
        createStoreIfNotExists(db, STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
      }

      // Version 3: aggiunta indici
      if (oldVersion < 3) {
        console.log('  → Aggiunta indici per query (v3)');
        // Indice su meals per data
        if (db.objectStoreNames.contains(STORES.MEALS)) {
          const mealsStore = event.target.transaction.objectStore(STORES.MEALS);
          if (!mealsStore.indexNames.contains('date')) {
            mealsStore.createIndex('date', 'date', { unique: false });
          }
        }
        // Indice su workouts per data
        if (db.objectStoreNames.contains(STORES.WORKOUTS)) {
          const workoutsStore = event.target.transaction.objectStore(STORES.WORKOUTS);
          if (!workoutsStore.indexNames.contains('date')) {
            workoutsStore.createIndex('date', 'date', { unique: false });
          }
        }
        // Indice su bodyComp per data
        if (db.objectStoreNames.contains(STORES.BODY_COMP)) {
          const bodyStore = event.target.transaction.objectStore(STORES.BODY_COMP);
          if (!bodyStore.indexNames.contains('date')) {
            bodyStore.createIndex('date', 'date', { unique: false });
          }
        }
      }
    };

    request.onsuccess = () => {
      _db = request.result;
      console.log('✅ IndexedDB inizializzato:', DB_NAME, `v${DB_VERSION}`);

      // Ascolta aggiornamenti di schema da altre tab
      _db.onversionchange = () => {
        console.warn('⚠️ Schema del DB aggiornato in un\'altra tab, ricarica consigliata');
      };

      resolve(_db);
    };
  });
}

/**
 * Helper: crea store se non esiste già
 */
function createStoreIfNotExists(db, storeName, options) {
  if (!db.objectStoreNames.contains(storeName)) {
    db.createObjectStore(storeName, options);
    console.log(`    ✓ Store creato: ${storeName}`);
  } else {
    console.log(`    ✓ Store già esistente: ${storeName}`);
  }
}

/**
 * Ottieni il database (assicurati che initDb() sia stato chiamato prima)
 */
function getDb() {
  if (!_db) {
    throw new Error('Database non inizializzato. Chiama initDb() prima.');
  }
  return _db;
}

/**
 * Ottieni un singolo elemento da uno store
 */
export async function getItem(storeName, key) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Salva un elemento in uno store (insert or update)
 */
export async function putItem(storeName, value) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Elimina un elemento da uno store
 */
export async function deleteItem(storeName, key) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Ottieni tutti gli elementi da uno store
 */
export async function getAllItems(storeName) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Cancella tutti gli elementi da uno store
 */
export async function clearStore(storeName) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ============ HELPER SPECIFICI PER MEALS ============

/**
 * Ottieni pasti per data
 * @param {string} date - formato YYYY-MM-DD
 */
export async function getMealsByDate(date) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.MEALS], 'readonly');
    const store = transaction.objectStore(STORES.MEALS);
    const index = store.index('date');
    const request = index.getAll(date);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Salva pasti per data
 * @param {string} date - formato YYYY-MM-DD
 * @param {Array} entries - array di meal entries
 */
export async function saveMeals(date, entries) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.MEALS], 'readwrite');
    const store = transaction.objectStore(STORES.MEALS);

    // Prima cancella pasti vecchi per questa data
    const index = store.index('date');
    const request = index.getAll(date);

    request.onsuccess = () => {
      const oldEntries = request.result;

      // Cancella i vecchi
      oldEntries.forEach(entry => store.delete(entry.id));

      // Aggiungi i nuovi
      entries.forEach(entry => {
        if (!entry.date) entry.date = date;
        store.put(entry);
      });

      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}

// ============ HELPER SPECIFICI PER WORKOUTS ============

/**
 * Ottieni allenamenti per data
 */
export async function getWorkoutsByDate(date) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.WORKOUTS], 'readonly');
    const store = transaction.objectStore(STORES.WORKOUTS);
    const index = store.index('date');
    const request = index.getAll(date);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Salva allenamento
 */
export async function saveWorkout(workout) {
  return putItem(STORES.WORKOUTS, workout);
}

// ============ HELPER SPECIFICI PER BODY COMPOSITION ============

/**
 * Ottieni baselines e storici di composizione corporea
 */
export async function getBodyCompData() {
  return getAllItems(STORES.BODY_COMP);
}

/**
 * Salva dato di composizione corporea
 */
export async function saveBodyCompData(data) {
  return putItem(STORES.BODY_COMP, data);
}

// ============ HELPER SPECIFICI PER SETTINGS ============

/**
 * Ottieni una preferenza
 */
export async function getSetting(key) {
  return getItem(STORES.SETTINGS, key);
}

/**
 * Salva una preferenza
 */
export async function setSetting(key, value) {
  return putItem(STORES.SETTINGS, { key, value });
}

/**
 * Ottieni tutte le preferenze
 */
export async function getAllSettings() {
  return getAllItems(STORES.SETTINGS);
}

// ============ HELPER PER USER PROFILE ============

/**
 * Ottieni profilo utente
 */
export async function getUserProfile() {
  return getItem(STORES.USER_PROFILE, 'main');
}

/**
 * Salva profilo utente
 */
export async function saveUserProfile(profile) {
  profile.id = 'main';
  profile.lastUpdated = new Date().toISOString();
  return putItem(STORES.USER_PROFILE, profile);
}

// ============ HELPER PER SYNC QUEUE ============

/**
 * Aggiungi un'azione alla sync queue (per future sync con backend)
 */
export async function addToSyncQueue(action) {
  action.createdAt = new Date().toISOString();
  return putItem(STORES.SYNC_QUEUE, action);
}

/**
 * Ottieni tutte le azioni non sincronizzate
 */
export async function getSyncQueue() {
  return getAllItems(STORES.SYNC_QUEUE);
}

/**
 * Rimuovi un'azione dalla sync queue (dopo sync riuscita)
 */
export async function removeFromSyncQueue(id) {
  return deleteItem(STORES.SYNC_QUEUE, id);
}

/**
 * Svuota tutta la sync queue
 */
export async function clearSyncQueue() {
  return clearStore(STORES.SYNC_QUEUE);
}

// ============ UTILITY GENERALI ============

/**
 * Ottieni statistiche del database (per debugging)
 */
export async function getDbStats() {
  const stats = {};

  for (const storeName of Object.values(STORES)) {
    try {
      const items = await getAllItems(storeName);
      stats[storeName] = items.length;
    } catch (error) {
      stats[storeName] = 0;
    }
  }

  return stats;
}

/**
 * Log statistiche a console
 */
export async function logDbStats() {
  const stats = await getDbStats();
  console.log('📊 IndexedDB Statistics:', stats);
  console.log('   Total items:', Object.values(stats).reduce((a, b) => a + b, 0));
}

export { STORES, DB_NAME, DB_VERSION };
