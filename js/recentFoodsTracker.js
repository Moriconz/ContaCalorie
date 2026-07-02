/**
 * Tracker per alimenti usati di recente e preferiti
 * Persiste in localStorage per velocità (non IndexedDB per questo)
 */

const MAX_RECENTS = 15;
const STORAGE_KEY_RECENTS = 'recentFoods';
const STORAGE_KEY_FAVORITES = 'favoriteFoods';

export function trackFoodUsage(foodRef, grammi) {
  /**
   * Registra l'uso di un alimento.
   * foodRef: { id, source, name }
   * grammi: number
   */
  if (!foodRef || !foodRef.id) return;

  const key = `${foodRef.source}:${foodRef.id}`;
  const recents = getRecents();

  // Rimuovi se esiste già (legge il count PRIMA di rimuoverlo: dopo lo splice
  // l'indice punta a un elemento diverso, azzerando il conteggio reale)
  const idx = recents.findIndex(r => r.key === key);
  const previousCount = idx >= 0 ? recents[idx].count || 0 : 0;
  if (idx >= 0) recents.splice(idx, 1);

  // Aggiungi in testa
  recents.unshift({
    key,
    foodRef,
    grammi,
    lastUsed: new Date().toISOString(),
    count: previousCount + 1
  });

  // Taglia a MAX_RECENTS
  recents.splice(MAX_RECENTS);

  localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(recents));
}

export function getRecents() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_RECENTS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(foodRef) {
  /**
   * Aggiungi/rimuovi dai preferiti
   */
  if (!foodRef || !foodRef.id) return false;

  const key = `${foodRef.source}:${foodRef.id}`;
  const favorites = getFavorites();

  const idx = favorites.findIndex(f => f.key === key);
  if (idx >= 0) {
    favorites.splice(idx, 1);
  } else {
    favorites.unshift({ key, foodRef, addedAt: new Date().toISOString() });
  }

  localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
  return idx < 0; // true se aggiunto, false se rimosso
}

export function getFavorites() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_FAVORITES);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function isFavorite(foodRef) {
  if (!foodRef) return false;
  const key = `${foodRef.source}:${foodRef.id}`;
  return getFavorites().some(f => f.key === key);
}

export function suggestMealMomentByTime() {
  /**
   * Suggerisci il momento del pasto basato sull'ora
   */
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'colazione';
  if (hour >= 11 && hour < 15) return 'pranzo';
  if (hour >= 15 && hour < 17) return 'merenda';
  if (hour >= 17 && hour < 21) return 'cena';
  return 'spuntino';
}

export function getLastMealMoment(meals) {
  /**
   * Ritorna l'ultimo momento usato (da meals array)
   */
  if (!meals || meals.length === 0) return suggestMealMomentByTime();

  const sorted = [...meals].sort((a, b) =>
    new Date(b.createdAt || b.data) - new Date(a.createdAt || a.data)
  );

  return sorted[0]?.momento || suggestMealMomentByTime();
}
