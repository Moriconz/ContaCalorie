/*
  Wrapper storage locale con IndexedDB e fallback a localStorage.
  Conserva profilo utente, alimenti personalizzati, log e cache remota.
*/

const DB_NAME = 'ContaCalorieDB';
const DB_VERSION = 5;
const STORE_NAMES = ['userProfile', 'userFoods', 'mealEntries', 'remoteFoods', 'weightsSessions', 'cardioSessions', 'dailyWeights', 'bodyCompBaselines', 'recipes', 'dailySteps', 'activityPreferences', 'strengthSessions'];

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
    const sessionWithMeta = {
      ...session,
      id: session.id || crypto.randomUUID(),
      createdAt: session.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await withStore('strengthSessions', 'readwrite', store => store.put(sessionWithMeta));
  } catch (error) {
    console.warn('Storage: errore salvataggio strength session:', error);
  }
}

export async function loadStrengthSessionsByDateRange(startDate, endDate) {
  try {
    const all = await withStore('strengthSessions', 'readonly', store => store.getAll());
    return all.filter(s => s.date >= startDate && s.date <= endDate);
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
    const record = {
      ...stepsRecord,
      id: stepsRecord.id || stepsRecord.date,
      updatedAt: new Date().toISOString()
    };
    await withStore('dailySteps', 'readwrite', store => store.put(record));
  } catch (error) {
    console.warn('Storage: errore salvataggio daily steps:', error);
  }
}

export async function loadDailyStepsByDate(date) {
  try {
    return await withStore('dailySteps', 'readonly', store => store.get(date));
  } catch {
    return null;
  }
}

export async function loadDailyStepsByDateRange(startDate, endDate) {
  try {
    const all = await withStore('dailySteps', 'readonly', store => store.getAll());
    return all.filter(s => s.date >= startDate && s.date <= endDate).sort((a, b) => new Date(a.date) - new Date(b.date));
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

export async function loadWeightsSessionsByDateRange(startDate, endDate) {
  try {
    const all = await withStore('weightsSessions', 'readonly', store => store.getAll());
    return all.filter(s => s.data >= startDate && s.data <= endDate).sort((a, b) => new Date(a.data) - new Date(b.data));
  } catch {
    return [];
  }
}

export async function updateWeightsSession(id, updates) {
  try {
    const existing = await withStore('weightsSessions', 'readonly', store => store.get(id));
    if (!existing) throw new Error(`Weights session ${id} non trovata`);
    const updated = { ...existing, ...updates };
    await withStore('weightsSessions', 'readwrite', store => store.put(updated));
  } catch (error) {
    console.warn('Storage: errore aggiornamento weights session:', error);
  }
}

export async function loadCardioSessionsByDateRange(startDate, endDate) {
  try {
    const all = await withStore('cardioSessions', 'readonly', store => store.getAll());
    return all.filter(s => s.data >= startDate && s.data <= endDate).sort((a, b) => new Date(a.data) - new Date(b.data));
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
