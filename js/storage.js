/*
  Wrapper storage locale con IndexedDB e fallback a localStorage.
  Conserva profilo utente, alimenti personalizzati, log e cache remota.
*/

const DB_NAME = 'ContaCalorieDB';
const DB_VERSION = 8; // v8: store `fridge` (inventario "Il Tuo Frigo")
const STORE_NAMES = ['userProfile', 'userFoods', 'mealEntries', 'remoteFoods', 'weightsSessions', 'cardioSessions', 'dailyWeights', 'bodyCompBaselines', 'recipes', 'dailySteps', 'activityPreferences', 'strengthSessions', 'fridge'];
// Store con record datati: ricevono un indice sul campo `data` (v7)
const DATE_INDEXED_STORES = ['mealEntries', 'cardioSessions', 'strengthSessions', 'dailySteps', 'dailyWeights'];

// Connessione IndexedDB cacheata: prima si apriva una nuova connessione a OGNI
// operazione (decine per render del dashboard). Ora si riusa la stessa.
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      _dbPromise = null;
      reject(new Error('IndexedDB non supportato'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const tx = request.transaction;
      STORE_NAMES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
      // v7: indice su `data` + normalizzazione su disco di date/data
      DATE_INDEXED_STORES.forEach(name => {
        const store = tx.objectStore(name);
        // Normalizza i record esistenti: entrambi i campi `data` e `date` valorizzati,
        // così l'indice su `data` copre anche i record salvati col solo campo `date`.
        store.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) return;
          const rec = cursor.value;
          const d = rec.data ?? rec.date;
          if (d !== undefined && (rec.data !== d || rec.date !== d)) {
            rec.data = d;
            rec.date = d;
            cursor.update(rec);
          }
          cursor.continue();
        };
        if (!store.indexNames.contains('data')) {
          store.createIndex('data', 'data', { unique: false });
        }
      });
    };
    request.onsuccess = () => {
      const db = request.result;
      // Se la connessione si chiude (es. upgrade da altra tab), invalida la cache
      db.onclose = () => { _dbPromise = null; };
      db.onversionchange = () => { db.close(); _dbPromise = null; };
      resolve(db);
    };
    request.onerror = () => {
      _dbPromise = null;
      reject(request.error);
    };
  });
  return _dbPromise;
}

async function withStore(storeName, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    try {
      const result = callback(store);
      if (result instanceof IDBRequest) {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error || new Error('Errore IDBRequest'));
      } else if (result instanceof Promise) {
        result.then(resolve).catch(reject);
      } else {
        tx.oncomplete = () => resolve(result);
      }
    } catch (error) {
      reject(error);
    }
    tx.onerror = () => reject(tx.error || new Error('Errore transazione'));
    tx.onabort = () => reject(tx.error || new Error('Transazione abortita'));
  });
}

function fallbackStorageKey(name) {
  return `ContaCalorie_${name}`;
}

/**
 * Normalizza i campi data: alcuni store usano `date` (strengthSessions, dailySteps),
 * altri `data` (weights/cardio/dailyWeights). Per robustezza i record restituiti
 * espongono SEMPRE entrambi i campi con lo stesso valore, così i consumer funzionano
 * indipendentemente da quale nome usano. Non distruttivo (nessuna migrazione su disco).
 */
function _normalizeDateFields(rec) {
  if (!rec || typeof rec !== 'object') return rec;
  const d = rec.date ?? rec.data;
  if (d !== undefined) {
    rec.date = d;
    rec.data = d;
  }
  return rec;
}

function _normalizeList(list) {
  return Array.isArray(list) ? list.map(_normalizeDateFields) : list;
}

/**
 * Query per data via indice `data` (v7). Se l'indice non esiste (DB non ancora
 * migrato) fa fallback a getAll: il chiamante filtra comunque i risultati.
 * @param {string} storeName
 * @param {string} startDate ISO yyyy-mm-dd
 * @param {string} [endDate] se omesso, match esatto su startDate
 */
async function getAllByDate(storeName, startDate, endDate) {
  return withStore(storeName, 'readonly', store => {
    if (store.indexNames.contains('data')) {
      const range = endDate
        ? IDBKeyRange.bound(startDate, endDate)
        : IDBKeyRange.only(startDate);
      return store.index('data').getAll(range);
    }
    return store.getAll();
  });
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * FASE 10 - Migrazione meal entry al nuovo modello dati
 * Aggiunge campi mancanti mantenendo backwards compatibility
 */
function _migrateMealEntry(entry) {
  if (!entry) return null;

  // Determina sourceType da origin o foodRef.source
  let sourceType = entry.sourceType;
  if (!sourceType) {
    if (entry.origin === 'manual_search' || entry.foodRef?.source === 'USER_CUSTOM') {
      sourceType = 'B_PERSONALIZZATO';
    } else if (entry.origin === 'estimated' || entry.origin === 'estimate') {
      sourceType = 'D_STIMA_RAPIDA';
    } else if (entry.origin === 'recent') {
      sourceType = 'E_RECENTI';
    } else {
      sourceType = 'A_DATABASE';
    }
  }

  // Determina confidenceLevel
  let confidenceLevel = entry.confidenceLevel;
  if (confidenceLevel === undefined) {
    if (sourceType === 'D_STIMA_RAPIDA') confidenceLevel = 50;
    else if (sourceType === 'B_PERSONALIZZATO') confidenceLevel = 80;
    else if (sourceType === 'C_PASTO_COMPOSTO') confidenceLevel = 65;
    else confidenceLevel = 85; // A_DATABASE, E_RECENTI
  }

  return {
    ...entry,
    sourceType,
    confidenceLevel,
    isEstimated: entry.isEstimated || sourceType === 'D_STIMA_RAPIDA' || sourceType === 'C_PASTO_COMPOSTO',
    foodState: entry.foodState || 'prepared',
    unitaSelezionata: entry.unitaSelezionata || 'grammi',
    estimatedComponents: entry.estimatedComponents || [],
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || new Date().toISOString()
  };
}

/**
 * Elimina tutte le entry con un certo source dal DB
 * Usato per la migrazione che rimuove entry TYPICAL_ESTIMATE
 */
async function _deleteMealsBySource(sourceToDelete) {
  try {
    await withStore('mealEntries', 'readwrite', store => {
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result;
        all.forEach(entry => {
          if (entry.foodRef?.source === sourceToDelete) {
            store.delete(entry.id);
          }
        });
      };
      return request;
    });
  } catch {
    const data = safeJsonParse(localStorage.getItem(fallbackStorageKey('mealEntries')) || '[]') || [];
    const filtered = data.filter(entry => entry.foodRef?.source !== sourceToDelete);
    localStorage.setItem(fallbackStorageKey('mealEntries'), JSON.stringify(filtered));
  }
}

export async function saveUserProfile(profile) {
  try {
    await withStore('userProfile', 'readwrite', store => {
      store.put({ ...profile, id: 'current' });
    });
    localStorage.setItem(fallbackStorageKey('userProfile'), JSON.stringify(profile));
  } catch (error) {
    localStorage.setItem(fallbackStorageKey('userProfile'), JSON.stringify(profile));
    console.warn('Storage: IndexedDB non disponibile, uso fallback localStorage');
  }
}

export async function loadUserProfile() {
  try {
    return await withStore('userProfile', 'readonly', store => store.get('current'));
  } catch {
    const data = localStorage.getItem(fallbackStorageKey('userProfile'));
    return safeJsonParse(data);
  }
}

export async function saveUserFoods(userFoods) {
  try {
    await withStore('userFoods', 'readwrite', store => {
      store.clear();
      userFoods.forEach(food => store.put(food));
    });
    localStorage.setItem(fallbackStorageKey('userFoods'), JSON.stringify(userFoods));
  } catch (error) {
    localStorage.setItem(fallbackStorageKey('userFoods'), JSON.stringify(userFoods));
    console.warn('Storage: fallback localStorage per userFoods');
  }
}

export async function loadUserFoods() {
  try {
    return await withStore('userFoods', 'readonly', store => {
      const request = store.getAll();
      request.onsuccess = () => {}; // no-op to keep transaction alive
      return request;
    });
  } catch {
    const data = localStorage.getItem(fallbackStorageKey('userFoods')) || '[]';
    return safeJsonParse(data) || [];
  }
}

export async function saveMealEntries(entries) {
  try {
    await withStore('mealEntries', 'readwrite', store => {
      entries.forEach(entry => {
        // Applica migrazione al salvataggio
        const migratedEntry = _normalizeDateFields(_migrateMealEntry(entry));
        migratedEntry.updatedAt = new Date().toISOString();
        store.put(migratedEntry);
      });
    });
  } catch (error) {
    const existing = safeJsonParse(localStorage.getItem(fallbackStorageKey('mealEntries')) || '[]') || [];
    const migratedEntries = entries.map(e => _migrateMealEntry(e));
    const merged = [...existing.filter(item => !migratedEntries.some(e => e.id === item.id)), ...migratedEntries];
    localStorage.setItem(fallbackStorageKey('mealEntries'), JSON.stringify(merged));
    console.warn('Storage: fallback localStorage per mealEntries');
  }
}

export async function loadMealsByDate(date) {
  try {
    const all = await getAllByDate('mealEntries', date);
    return all
      .filter(entry => entry.data === date)
      .map(entry => _migrateMealEntry(entry));
  } catch {
    const data = safeJsonParse(localStorage.getItem(fallbackStorageKey('mealEntries')) || '[]') || [];
    return data
      .filter(entry => entry.data === date)
      .map(entry => _migrateMealEntry(entry));
  }
}

/**
 * Elimina una singola meal entry per id.
 * FIX: prima l'eliminazione pasto aggiornava solo lo stato in memoria
 * (saveMealEntries non rimuove nulla) → il pasto ricompariva al reload.
 */
export async function deleteMealEntry(id) {
  try {
    await withStore('mealEntries', 'readwrite', store => store.delete(id));
  } catch {
    const data = safeJsonParse(localStorage.getItem(fallbackStorageKey('mealEntries')) || '[]') || [];
    localStorage.setItem(fallbackStorageKey('mealEntries'), JSON.stringify(data.filter(e => e.id !== id)));
  }
}

export async function loadAllMeals() {
  try {
    const all = await withStore('mealEntries', 'readonly', store => {
      const request = store.getAll();
      request.onsuccess = () => {};
      return request;
    });
    const filtered = all
      .filter(entry => entry.foodRef?.source !== 'TYPICAL_ESTIMATE')
      .map(entry => _migrateMealEntry(entry));

    if (filtered.length !== all.length) {
      await _deleteMealsBySource('TYPICAL_ESTIMATE');
    }

    return filtered;
  } catch {
    const data = safeJsonParse(localStorage.getItem(fallbackStorageKey('mealEntries')) || '[]') || [];
    return data
      .filter(entry => entry.foodRef?.source !== 'TYPICAL_ESTIMATE')
      .map(entry => _migrateMealEntry(entry));
  }
}

export async function cacheRemoteFood(foodItem) {
  try {
    await withStore('remoteFoods', 'readwrite', store => store.put(foodItem));
  } catch {
    console.warn('Storage: impossibile salvare cache remoteFoods');
  }
}

export async function loadRemoteFoodCache(id) {
  try {
    return await withStore('remoteFoods', 'readonly', store => store.get(id));
  } catch {
    return null;
  }
}

export function syncToCloud() {
  return Promise.resolve({ message: 'Sync non implementato. Stub pronta per estensione futura.' });
}

// === HELPER GENERICI ===

/** Apre/verifica la connessione al DB reale (warmup all'avvio). */
export async function initStorage() {
  await openDB();
  await _migrateWeightsToStrength();
  return true;
}

/**
 * Migrazione una-tantum: unifica il vecchio store `weightsSessions` (DB v2) nel
 * nuovo `strengthSessions` (DB v5). Esegue una sola volta (flag in localStorage),
 * preserva i dati e poi svuota lo store legacy.
 */
async function _migrateWeightsToStrength() {
  try {
    if (localStorage.getItem('weightsMigratedToStrength') === '1') return;
    const legacy = await withStore('weightsSessions', 'readonly', store => store.getAll());
    if (Array.isArray(legacy) && legacy.length) {
      for (const rec of legacy) {
        await saveStrengthSession({ ...rec, date: rec.date || rec.data });
      }
      await withStore('weightsSessions', 'readwrite', store => store.clear());
      console.log(`🔀 Migrate ${legacy.length} sessioni pesi legacy → strengthSessions`);
    }
    localStorage.setItem('weightsMigratedToStrength', '1');
  } catch (error) {
    console.warn('Migrazione weights→strength non riuscita:', error);
  }
}

/** Conteggio elementi per store del DB reale (debug/diagnostica). */
export async function getDbStats() {
  const stats = {};
  for (const name of STORE_NAMES) {
    try {
      const all = await withStore(name, 'readonly', store => store.getAll());
      stats[name] = Array.isArray(all) ? all.length : 0;
    } catch {
      stats[name] = 0;
    }
  }
  return stats;
}

/** Svuota completamente uno store del DB reale. */
export async function clearStore(storeName) {
  try {
    await withStore(storeName, 'readwrite', store => store.clear());
  } catch (error) {
    console.warn(`Storage: errore clear store ${storeName}:`, error);
  }
}

/** Tutte le sessioni pesi dettagliate (DB v5), senza filtro data. */
export async function loadAllStrengthSessions() {
  try {
    return _normalizeList(await withStore('strengthSessions', 'readonly', store => store.getAll()));
  } catch {
    return [];
  }
}

/** Tutti i record passi, senza filtro data. */
export async function loadAllDailySteps() {
  try {
    return _normalizeList(await withStore('dailySteps', 'readonly', store => store.getAll()));
  } catch {
    return [];
  }
}

// === WEIGHTS SESSIONS (DB v2) ===

// === CARDIO SESSIONS (DB v2) ===

export async function saveCardioSession(session) {
  try {
    const toSave = _normalizeDateFields({
      ...session,
      id: session.id || crypto.randomUUID(),
      createdAt: session.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await withStore('cardioSessions', 'readwrite', store => store.put(toSave));
    return toSave;
  } catch (error) {
    console.warn('Storage: errore salvataggio cardio session:', error);
  }
}

export async function loadCardioSessions(date) {
  try {
    const all = await getAllByDate('cardioSessions', date);
    return _normalizeList(all.filter(s => (s.data ?? s.date) === date));
  } catch {
    return [];
  }
}

export async function loadAllCardioSessions() {
  try {
    return _normalizeList(await withStore('cardioSessions', 'readonly', store => store.getAll()));
  } catch {
    return [];
  }
}

export async function deleteCardioSession(id) {
  try {
    await withStore('cardioSessions', 'readwrite', store => store.delete(id));
  } catch (error) {
    console.warn('Storage: errore eliminazione cardio session:', error);
  }
}

// === DAILY WEIGHTS (DB v2) ===

export async function saveDailyWeight(entry) {
  try {
    // dailyWeights è logicamente indicizzato per data: usa la data come id se mancante
    const toSave = _normalizeDateFields({ ...entry, id: entry.id || entry.data || entry.date });
    await withStore('dailyWeights', 'readwrite', store => store.put(toSave));
    return toSave;
  } catch (error) {
    console.warn('Storage: errore salvataggio daily weight:', error);
  }
}

export async function loadDailyWeights() {
  try {
    const all = await withStore('dailyWeights', 'readonly', store => store.getAll());
    return _normalizeList(all.sort((a, b) => new Date(a.data) - new Date(b.data)));
  } catch {
    return [];
  }
}

export async function loadDailyWeightByDate(date) {
  try {
    return _normalizeDateFields(await withStore('dailyWeights', 'readonly', store => store.get(date)));
  } catch {
    return null;
  }
}

// === BODY COMPOSITION BASELINES (DB v3) ===

export async function saveBodyCompBaseline(baseline) {
  try {
    await withStore('bodyCompBaselines', 'readwrite', store => store.put(baseline));
  } catch (error) {
    console.warn('Storage: errore salvataggio body comp baseline:', error);
  }
}

export async function loadBodyCompBaselines() {
  try {
    return await withStore('bodyCompBaselines', 'readonly', store => store.getAll());
  } catch {
    return [];
  }
}

export async function deleteBodyCompBaseline(dateBaseline) {
  try {
    await withStore('bodyCompBaselines', 'readwrite', store => store.delete(dateBaseline));
  } catch (error) {
    console.warn('Storage: errore eliminazione body comp baseline:', error);
  }
}

// === RECIPES (DB v4) ===

export async function saveRecipe(recipe) {
  try {
    const withTimestamp = {
      ...recipe,
      id: recipe.id || crypto.randomUUID(),
      createdAt: recipe.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await withStore('recipes', 'readwrite', store => store.put(withTimestamp));
    return withTimestamp;
  } catch (error) {
    console.warn('Storage: errore salvataggio ricetta:', error);
    throw error;
  }
}

export async function loadRecipes() {
  try {
    return await withStore('recipes', 'readonly', store => {
      const request = store.getAll();
      request.onsuccess = () => {};
      return request;
    });
  } catch {
    return [];
  }
}

export async function loadRecipeById(id) {
  try {
    return await withStore('recipes', 'readonly', store => store.get(id));
  } catch {
    return null;
  }
}

export async function updateRecipe(id, updates) {
  try {
    const existing = await withStore('recipes', 'readonly', store => store.get(id));
    if (!existing) throw new Error(`Ricetta ${id} non trovata`);

    const updated = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };
    await withStore('recipes', 'readwrite', store => store.put(updated));
    return updated;
  } catch (error) {
    console.warn('Storage: errore aggiornamento ricetta:', error);
    throw error;
  }
}

export async function deleteRecipe(id) {
  try {
    await withStore('recipes', 'readwrite', store => store.delete(id));
  } catch (error) {
    console.warn('Storage: errore eliminazione ricetta:', error);
    throw error;
  }
}

// === STRENGTH SESSIONS (DB v5 - optional detailed exercises) ===

export async function saveStrengthSession(session) {
  try {
    const sessionWithMeta = _normalizeDateFields({
      ...session,
      id: session.id || crypto.randomUUID(),
      createdAt: session.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await withStore('strengthSessions', 'readwrite', store => store.put(sessionWithMeta));
  } catch (error) {
    console.warn('Storage: errore salvataggio strength session:', error);
  }
}

export async function loadStrengthSessionsByDateRange(startDate, endDate) {
  try {
    const all = await getAllByDate('strengthSessions', startDate, endDate);
    return _normalizeList(all.filter(s => (s.date ?? s.data) >= startDate && (s.date ?? s.data) <= endDate));
  } catch {
    return [];
  }
}

export async function updateStrengthSession(id, updates) {
  try {
    const existing = await withStore('strengthSessions', 'readonly', store => store.get(id));
    if (!existing) throw new Error(`Strength session ${id} non trovata`);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await withStore('strengthSessions', 'readwrite', store => store.put(updated));
  } catch (error) {
    console.warn('Storage: errore aggiornamento strength session:', error);
  }
}

export async function deleteStrengthSession(id) {
  try {
    await withStore('strengthSessions', 'readwrite', store => store.delete(id));
  } catch (error) {
    console.warn('Storage: errore eliminazione strength session:', error);
  }
}

// === DAILY STEPS (DB v5) ===

export async function saveDailySteps(stepsRecord) {
  try {
    const record = _normalizeDateFields({
      ...stepsRecord,
      id: stepsRecord.id || stepsRecord.date || stepsRecord.data,
      updatedAt: new Date().toISOString()
    });
    await withStore('dailySteps', 'readwrite', store => store.put(record));
  } catch (error) {
    console.warn('Storage: errore salvataggio daily steps:', error);
  }
}

export async function loadDailyStepsByDate(date) {
  try {
    return _normalizeDateFields(await withStore('dailySteps', 'readonly', store => store.get(date)));
  } catch {
    return null;
  }
}

export async function loadDailyStepsByDateRange(startDate, endDate) {
  try {
    const all = await getAllByDate('dailySteps', startDate, endDate);
    return _normalizeList(all.filter(s => (s.date ?? s.data) >= startDate && (s.date ?? s.data) <= endDate).sort((a, b) => new Date(a.date ?? a.data) - new Date(b.date ?? b.data)));
  } catch {
    return [];
  }
}

export async function deleteDailySteps(date) {
  try {
    await withStore('dailySteps', 'readwrite', store => store.delete(date));
  } catch (error) {
    console.warn('Storage: errore eliminazione daily steps:', error);
  }
}

// === ACTIVITY PREFERENCES (DB v5) ===

export async function saveActivityPreferences(prefs) {
  try {
    const toSave = {
      ...prefs,
      id: 'current',
      updatedAt: new Date().toISOString()
    };
    await withStore('activityPreferences', 'readwrite', store => store.put(toSave));
  } catch (error) {
    console.warn('Storage: errore salvataggio activity preferences:', error);
  }
}

export async function loadActivityPreferences() {
  try {
    return await withStore('activityPreferences', 'readonly', store => store.get('current'));
  } catch {
    return null;
  }
}

// === ENHANCEMENTS TO EXISTING SESSIONS (DB v5) ===

export async function loadCardioSessionsByDateRange(startDate, endDate) {
  try {
    const all = await getAllByDate('cardioSessions', startDate, endDate);
    return _normalizeList(all.filter(s => (s.data ?? s.date) >= startDate && (s.data ?? s.date) <= endDate).sort((a, b) => new Date(a.data ?? a.date) - new Date(b.data ?? b.date)));
  } catch {
    return [];
  }
}

export async function updateCardioSession(id, updates) {
  try {
    const existing = await withStore('cardioSessions', 'readonly', store => store.get(id));
    if (!existing) throw new Error(`Cardio session ${id} non trovata`);
    const updated = { ...existing, ...updates };
    await withStore('cardioSessions', 'readwrite', store => store.put(updated));
  } catch (error) {
    console.warn('Storage: errore aggiornamento cardio session:', error);
  }
}

// === FRIDGE (DB v8) — inventario "Il Tuo Frigo" ===
// Schema item: { id, foodId, source, nome, quantity, unit('g'|'ml'|'pz'),
//                expiresAt(ts ms|null), per100g:{kcal,proteine,carboidrati,grassi,...} }

export async function loadFridgeItems() {
  try {
    return await withStore('fridge', 'readonly', store => {
      const request = store.getAll();
      request.onsuccess = () => {};
      return request;
    });
  } catch {
    return [];
  }
}

export async function saveFridgeItem(item) {
  const toSave = {
    ...item,
    id: item.id || crypto.randomUUID(),
    updatedAt: new Date().toISOString()
  };
  try {
    await withStore('fridge', 'readwrite', store => store.put(toSave));
  } catch (error) {
    console.warn('Storage: errore salvataggio fridge item:', error);
  }
  return toSave;
}

export async function deleteFridgeItem(id) {
  try {
    await withStore('fridge', 'readwrite', store => store.delete(id));
  } catch (error) {
    console.warn('Storage: errore eliminazione fridge item:', error);
  }
}
