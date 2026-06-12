/**
 * Data Pack Loader — Ricerca alimenti nel database ufficiale CREA
 * Fonte unica: alimenti CREA (italian_foods_full.json)
 */

let _italianFoodsFull = null;

async function loadItalianFoodsFull() {
  if (_italianFoodsFull) return _italianFoodsFull;
  try {
    const response = await fetch('/data/italian_foods_full.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    _italianFoodsFull = data.foods || [];
    console.log(`📦 Caricati ${_italianFoodsFull.length} alimenti CREA`);
    return _italianFoodsFull;
  } catch (error) {
    console.warn('⚠️ Errore caricamento italian_foods_full.json:', error);
    return [];
  }
}

export function normalizeName(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen > 50) return maxLen;

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

export function strictMatch(query, candidate) {
  const q = normalizeName(query);
  const c = normalizeName(candidate);
  if (!q || !c) return false;

  // Esatto match
  if (c === q) return true;

  // Tutti i "token" della query devono essere presenti in candidate
  const queryTokens = q.split(/\s+/).filter(t => t.length > 1);
  if (queryTokens.length === 0) return false;

  // Richiedi che TUTTI i token siano presenti
  return queryTokens.every(token => c.includes(token));
}

export function fuzzyMatch(query, candidate) {
  // Prova prima con match rigoroso
  if (strictMatch(query, candidate)) return true;

  // Solo se non c'è match esatto, usa fuzzy (più tollerante)
  const q = normalizeName(query);
  const c = normalizeName(candidate);
  if (!q || !c) return false;
  if (c.includes(q) || q.includes(c)) return true;

  const maxLen = Math.max(q.length, c.length);
  const threshold = Math.ceil(maxLen * 0.3);
  return levenshtein(q, c) <= threshold;
}

export async function searchInDataPacks(foodName, grams) {
  console.log(`🔍 Ricerca CREA: "${foodName}" (${grams}g)`);

  const italianFoods = await loadItalianFoodsFull();
  for (const food of italianFoods) {
    if (fuzzyMatch(foodName, food.name_it)) {
      console.log(`✅ Trovato CREA: ${food.name_it}`);
      return {
        found: true,
        item: food,
        dataPackType: 'italian_crea',
        kcal: food.kcal_100g ? Math.round(food.kcal_100g * grams / 100) : null,
        protein: food.protein_100g ? Math.round(food.protein_100g * grams / 100 * 10) / 10 : null,
        carb: food.carb_100g ? Math.round(food.carb_100g * grams / 100 * 10) / 10 : null,
        fat: food.fat_100g ? Math.round(food.fat_100g * grams / 100 * 10) / 10 : null,
        fiber: food.fiber_100g ? Math.round(food.fiber_100g * grams / 100 * 10) / 10 : null,
        sugar: food.sugars_100g ? Math.round(food.sugars_100g * grams / 100 * 10) / 10 : null,
        source: 'CREA',
        category: food.category
      };
    }
  }

  console.log(`❌ Non trovato nel database CREA`);
  return { found: false };
}
