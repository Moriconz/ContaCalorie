/*
  Wrapper storage locale con IndexedDB e fallback a localStorage.
  Conserva profilo utente, alimenti personalizzati, log e cache remota.
*/

const DB_NAME = 'ContaCalorieDB';
const DB_VERSION = 3;
const STORE_NAMES = ['userProfile', 'userFoods', 'mealEntries', 'remoteFoods', 'weightsSessions', 'cardioSessions', 'dailyWeights', 'bodyCompBaselines'];

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB non supportato'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORE_NAMES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
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
      entries.forEach(entry => store.put(entry));
    });
  } catch (error) {
    const existing = safeJsonParse(localStorage.getItem(fallbackStorageKey('mealEntries')) || '[]') || [];
    const merged = [...existing.filter(item => !entries.some(e => e.id === item.id)), ...entries];
    localStorage.setItem(fallbackStorageKey('mealEntries'), JSON.stringify(merged));
    console.warn('Storage: fallback localStorage per mealEntries');
  }
}

export async function loadMealsByDate(date) {
  try {
    const all = await withStore('mealEntries', 'readonly', store => {
      const request = store.getAll();
      request.onsuccess = () => {};
      return request;
    });
    return all.filter(entry => entry.data === date);
  } catch {
    const data = safeJsonParse(localStorage.getItem(fallbackStorageKey('mealEntries')) || '[]') || [];
    return data.filter(entry => entry.data === date);
  }
}

export async function loadAllMeals() {
  try {
    return await withStore('mealEntries', 'readonly', store => {
      const request = store.getAll();
      request.onsuccess = () => {};
      return request;
    });
  } catch {
    return safeJsonParse(localStorage.getItem(fallbackStorageKey('mealEntries')) || '[]') || [];
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

// === WEIGHTS SESSIONS (DB v2) ===

export async function saveWeightsSession(session) {
  try {
    await withStore('weightsSessions', 'readwrite', store => store.put(session));
  } catch (error) {
    console.warn('Storage: errore salvataggio weights session:', error);
  }
}

export async function loadWeightsSessions(date) {
  try {
    const all = await withStore('weightsSessions', 'readonly', store => store.getAll());
    return all.filter(s => s.data === date);
  } catch {
    return [];
  }
}

export async function loadAllWeightsSessions() {
  try {
    return await withStore('weightsSessions', 'readonly', store => store.getAll());
  } catch {
    return [];
  }
}

export async function deleteWeightsSession(id) {
  try {
    await withStore('weightsSessions', 'readwrite', store => store.delete(id));
  } catch (error) {
    console.warn('Storage: errore eliminazione weights session:', error);
  }
}

// === CARDIO SESSIONS (DB v2) ===

export async function saveCardioSession(session) {
  try {
    await withStore('cardioSessions', 'readwrite', store => store.put(session));
  } catch (error) {
    console.warn('Storage: errore salvataggio cardio session:', error);
  }
}

export async function loadCardioSessions(date) {
  try {
    const all = await withStore('cardioSessions', 'readonly', store => store.getAll());
    return all.filter(s => s.data === date);
  } catch {
    return [];
  }
}

export async function loadAllCardioSessions() {
  try {
    return await withStore('cardioSessions', 'readonly', store => store.getAll());
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
    await withStore('dailyWeights', 'readwrite', store => store.put(entry));
  } catch (error) {
    console.warn('Storage: errore salvataggio daily weight:', error);
  }
}

export async function loadDailyWeights() {
  try {
    const all = await withStore('dailyWeights', 'readonly', store => store.getAll());
    return all.sort((a, b) => new Date(a.data) - new Date(b.data));
  } catch {
    return [];
  }
}

export async function loadDailyWeightByDate(date) {
  try {
    return await withStore('dailyWeights', 'readonly', store => store.get(date));
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
