/**
 * Data Pack Loader — Gestione data pack alimenti con ricerca fuzzy
 * Priorità: fast food → alimenti italiani completi (CREA/BDA 516 voci) → piatti esteri
 */

let _italianFoodsFull = null;
let _foreignDishes = null;
let _fastFood = null;

async function loadItalianFoodsFull() {
  if (_italianFoodsFull) return _italianFoodsFull;
  try {
    const response = await fetch('/data/italian_foods_full.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    _italianFoodsFull = data.foods || [];
    console.log(`📦 Caricati ${_italianFoodsFull.length} alimenti italiani (CREA/BDA completo)`);
    return _italianFoodsFull;
  } catch (error) {
    console.warn('⚠️ Errore caricamento italian_foods_full.json:', error);
    return [];
  }
}

async function loadForeignDishes() {
  if (_foreignDishes) return _foreignDishes;
  try {
    const response = await fetch('/data/foreign_common_in_italy.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    _foreignDishes = data.dishes || [];
    console.log(`📦 Caricati ${_foreignDishes.length} piatti esteri`);
    return _foreignDishes;
  } catch (error) {
    console.warn('⚠️ Errore caricamento foreign_common_in_italy.json:', error);
    return [];
  }
}

async function loadFastFood() {
  if (_fastFood) return _fastFood;
  try {
    const response = await fetch('/data/fast_food_chains_it.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    _fastFood = [];
    for (const chain in data.chains || {}) {
      const items = data.chains[chain];
      if (Array.isArray(items)) {
        _fastFood.push(...items.map(item => ({ ...item, chain })));
      }
    }
    console.log(`📦 Caricati ${_fastFood.length} item fast food`);
    return _fastFood;
  } catch (error) {
    console.warn('⚠️ Errore caricamento fast_food_chains_it.json:', error);
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

export function fuzzyMatch(query, candidate) {
  const q = normalizeName(query);
  const c = normalizeName(candidate);
  if (!q || !c) return false;
  if (c === q || c.includes(q) || q.includes(c)) return true;

  const maxLen = Math.max(q.length, c.length);
  const threshold = Math.ceil(maxLen * 0.3);
  return levenshtein(q, c) <= threshold;
}

export async function searchInDataPacks(foodName, grams) {
  console.log(`🔍 Ricerca data pack: "${foodName}" (${grams}g)`);

  // 1. Fast food (priorità alta)
  const fastFood = await loadFastFood();
  for (const item of fastFood) {
    if (fuzzyMatch(foodName, item.name)) {
      console.log(`✅ Trovato FAST FOOD: ${item.chain} - ${item.name}`);
      return {
        found: true,
        item,
        dataPackType: 'fast_food',
        kcal: Math.round((item.kcal / (item.portionSize || 100)) * grams),
        protein: Math.round((item.protein / (item.portionSize || 100)) * grams * 10) / 10,
        carb: Math.round((item.carb / (item.portionSize || 100)) * grams * 10) / 10,
        fat: Math.round((item.fat / (item.portionSize || 100)) * grams * 10) / 10,
        fiber: item.fiber ? Math.round((item.fiber / (item.portionSize || 100)) * grams * 10) / 10 : 0,
        sugar: item.sugar ? Math.round((item.sugar / (item.portionSize || 100)) * grams * 10) / 10 : 0,
        source: item.chain,
        chain: item.chain
      };
    }
  }

  // 2. Alimenti italiani completi (CREA/BDA)
  const italianFoods = await loadItalianFoodsFull();
  for (const food of italianFoods) {
    if (fuzzyMatch(foodName, food.name_it)) {
      console.log(`✅ Trovato ITALIANO (CREA/BDA): ${food.name_it}`);
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
        category: food.category,
        subtype: food.subtype,
        state: food.state
      };
    }
  }

  // 3. Piatti esteri (fallback)
  const foreignDishes = await loadForeignDishes();
  for (const dish of foreignDishes) {
    if (fuzzyMatch(foodName, dish.name)) {
      console.log(`✅ Trovato ESTERO: ${dish.name} (${dish.cuisine})`);
      return {
        found: true,
        item: dish,
        dataPackType: 'foreign',
        kcal: dish.kcal_100g ? Math.round(dish.kcal_100g * grams / 100) : null,
        protein: dish.protein_100g ? Math.round(dish.protein_100g * grams / 100 * 10) / 10 : null,
        carb: dish.carb_100g ? Math.round(dish.carb_100g * grams / 100 * 10) / 10 : null,
        fat: dish.fat_100g ? Math.round(dish.fat_100g * grams / 100 * 10) / 10 : null,
        fiber: dish.fiber_100g ? Math.round(dish.fiber_100g * grams / 100 * 10) / 10 : null,
        sugar: dish.sugar_100g ? Math.round(dish.sugar_100g * grams / 100 * 10) / 10 : null,
        source: 'EuroFIR/USDA',
        cuisine: dish.cuisine
      };
    }
  }

  console.log(`❌ Non trovato nei data pack`);
  return { found: false };
}
