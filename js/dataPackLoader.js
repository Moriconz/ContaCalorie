/**
 * Data Pack Loader — carica e ricerca alimenti nei data pack JSON
 * Supporta piatti italiani, piatti esteri, e fast food con fuzzy matching
 */

let _italianDishes = null;
let _foreignDishes = null;
let _fastFood = null;

const CONFIG = {
  levenshteinThreshold: 3,
  substringMatchWeight: 0.5,
  useSubstringFallback: true
};

/**
 * Normalizza il nome dell'alimento:
 * - minuscole
 * - NFD decomposizione e rimozione accenti
 * - trim
 */
function normalizeName(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Calcola la distanza di Levenshtein tra due stringhe (edit distance)
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array(n + 1);
  const curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr[0], prev[0]] = [curr, curr[0], prev[0]];
  }

  return prev[n];
}

/**
 * Fuzzy match: restituisce score 0-100
 * - Se il candidato contiene la query come sottostringa, score alto (80+)
 * - Altrimenti usa Levenshtein distance
 */
function fuzzyScore(query, candidate) {
  const q = normalizeName(query);
  const c = normalizeName(candidate);

  if (!q) return 100;
  if (q === c) {
    console.log(`      ⭐ Match esatto: "${query}" = "${candidate}"`);
    return 100;
  }

  // Match esatto su parole singole
  if (c.includes(q)) {
    console.log(`      ⭐ Substring match: "${query}" in "${candidate}" (85)`);
    return 85;
  }
  if (q.includes(c)) {
    console.log(`      ⭐ Reverse substring: "${candidate}" in "${query}" (80)`);
    return 80;
  }

  // Levenshtein
  const distance = levenshtein(q, c);
  const maxLen = Math.max(q.length, c.length);
  const similarityPercent = Math.max(0, 100 - (distance / maxLen) * 100);
  const score = Math.round(similarityPercent);

  if (score >= 65) {
    console.log(`      📊 Levenshtein: "${query}" vs "${candidate}" = ${score}`);
  }

  return score;
}

/**
 * Carica lazy il data pack dei piatti italiani
 */
async function loadItalianDishes() {
  if (_italianDishes) return _italianDishes;
  try {
    let url = '/data/italian_regional_dishes.json';
    // Supporta sia percorsi assoluti che relativi
    const response = await fetch(url).catch(async () => {
      // Fallback: prova percorso relativo
      return fetch('./data/italian_regional_dishes.json');
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    _italianDishes = await response.json();
    console.log('✅ Piatti italiani caricati:', _italianDishes.dishes?.length || 0, 'alimenti');
    return _italianDishes;
  } catch (error) {
    console.error('❌ Errore caricamento piatti italiani:', error);
    return { dishes: [] };
  }
}

/**
 * Carica lazy il data pack dei piatti esteri
 */
async function loadForeignDishes() {
  if (_foreignDishes) return _foreignDishes;
  try {
    let url = '/data/foreign_common_in_italy.json';
    const response = await fetch(url).catch(async () => {
      return fetch('./data/foreign_common_in_italy.json');
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    _foreignDishes = await response.json();
    console.log('✅ Piatti esteri caricati:', _foreignDishes.dishes?.length || 0, 'alimenti');
    return _foreignDishes;
  } catch (error) {
    console.error('❌ Errore caricamento piatti esteri:', error);
    return { dishes: [] };
  }
}

/**
 * Carica lazy il data pack dei fast food
 */
async function loadFastFood() {
  if (_fastFood) return _fastFood;
  try {
    let url = '/data/fast_food_chains_it.json';
    const response = await fetch(url).catch(async () => {
      return fetch('./data/fast_food_chains_it.json');
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    _fastFood = await response.json();
    const totalProducts = Object.values(_fastFood.chains || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    console.log('✅ Fast food caricati:', totalProducts, 'prodotti');
    return _fastFood;
  } catch (error) {
    console.error('❌ Errore caricamento fast food:', error);
    return { chains: {} };
  }
}

/**
 * Calcola macros dal piatto trovato, scalate ai grammi richiesti
 * Supporta sia dati per 100g che dati per porzione (fast food)
 */
function calcMacrosFromPack(item, grams) {
  // Fast food: hanno kcal per porzione intera
  if (item.kcal !== undefined && item.kcal !== null && !item.kcal_100g) {
    // Calcola per 100g basandosi su kcal totale e portionSize
    const scale = grams / (item.portionSize || 100);
    return {
      kcal: Math.round(item.kcal * scale),
      proteine: Math.round((item.protein || 0) * scale * 10) / 10,
      carboidrati: Math.round((item.carb || 0) * scale * 10) / 10,
      grassi: Math.round((item.fat || 0) * scale * 10) / 10,
      fibra: Math.round((item.fiber || 0) * scale * 10) / 10,
      zuccheri: Math.round((item.sugar || 0) * scale * 10) / 10
    };
  }

  // Piatti italiani e esteri: hanno kcal_100g
  if (item.kcal_100g && item.kcal_100g > 0) {
    const scale = grams / 100;
    return {
      kcal: Math.round(item.kcal_100g * scale),
      proteine: Math.round((item.protein_100g || 0) * scale * 10) / 10,
      carboidrati: Math.round((item.carb_100g || 0) * scale * 10) / 10,
      grassi: Math.round((item.fat_100g || 0) * scale * 10) / 10,
      fibra: Math.round((item.fiber_100g || 0) * scale * 10) / 10,
      zuccheri: Math.round((item.sugar_100g || 0) * scale * 10) / 10
    };
  }

  // Nessun dato nutrizionale disponibile
  console.warn(`⚠️ Nessun dato nutrizionale per "${item.name}"`);
  return null;
}

/**
 * Pipeline di ricerca nei data pack:
 * 1. Fast food (McDonald's, BK, KFC)
 * 2. Piatti italiani
 * 3. Piatti esteri
 *
 * Restituisce:
 * { found: true, item, dataPackType, macros, source, region, city, chain } | { found: false }
 */
export async function searchInDataPacks(foodName, grams) {
  if (!foodName || grams <= 0) {
    console.log('🔍 searchInDataPacks: input non valido');
    return { found: false };
  }

  console.log(`🔍 searchInDataPacks: cercando "${foodName}" (${grams}g)`);

  const minScoreThreshold = 65;
  let bestMatch = null;
  let bestScore = 0;
  let bestType = null;

  // 1. Cerca nei fast food
  try {
    const fastFoodData = await loadFastFood();
    console.log(`   📍 Cercando in fast food (${Object.values(fastFoodData.chains || {}).reduce((s, arr) => s + (arr?.length || 0), 0)} prodotti)`);
    for (const chain in fastFoodData.chains) {
      for (const item of fastFoodData.chains[chain]) {
        const score = fuzzyScore(foodName, item.name);
        if (score > bestScore && score >= minScoreThreshold) {
          console.log(`      ✓ Match in ${chain}: "${item.name}" (score: ${score})`);
          bestScore = score;
          bestMatch = item;
          bestType = 'fastfood';
        }
      }
    }
  } catch (error) {
    console.error('❌ Errore caricamento fast food:', error);
  }

  // Se già trovato con buon score nei fast food, non cercare altrove
  if (bestScore >= 90) {
    const macros = calcMacrosFromPack(bestMatch, grams);
    if (macros) {
      console.log(`   ✅ FOUND in fastfood: "${bestMatch.name}" (${bestMatch.chain})`);
      return {
        found: true,
        item: bestMatch,
        dataPackType: 'fastfood',
        macros,
        source: bestMatch.chain,
        chain: bestMatch.chain,
        region: null,
        city: null
      };
    }
  }

  // 2. Cerca nei piatti italiani
  try {
    const italianData = await loadItalianDishes();
    console.log(`   📍 Cercando in piatti italiani (${italianData.dishes?.length || 0} alimenti)`);
    for (const dish of (italianData.dishes || [])) {
      const score = fuzzyScore(foodName, dish.name);
      if (score > bestScore && score >= minScoreThreshold) {
        console.log(`      ✓ Match: "${dish.name}" (score: ${score})`);
        bestScore = score;
        bestMatch = dish;
        bestType = 'italian';
      }
    }
  } catch (error) {
    console.error('❌ Errore caricamento piatti italiani:', error);
  }

  // Se trovato con buon score, ritorna
  if (bestScore >= 80 && bestType === 'italian') {
    const macros = calcMacrosFromPack(bestMatch, grams);
    if (macros) {
      console.log(`   ✅ FOUND in italian: "${bestMatch.name}" (${bestMatch.region})`);
      return {
        found: true,
        item: bestMatch,
        dataPackType: 'italian',
        macros,
        source: bestMatch.source,
        region: bestMatch.region || null,
        city: bestMatch.city || null
      };
    }
  }

  // 3. Cerca nei piatti esteri
  try {
    const foreignData = await loadForeignDishes();
    console.log(`   📍 Cercando in piatti esteri (${foreignData.dishes?.length || 0} piatti)`);
    for (const dish of (foreignData.dishes || [])) {
      const score = fuzzyScore(foodName, dish.name);
      if (score > bestScore && score >= minScoreThreshold) {
        console.log(`      ✓ Match: "${dish.name}" (score: ${score})`);
        bestScore = score;
        bestMatch = dish;
        bestType = 'foreign';
      }
    }
  } catch (error) {
    console.error('❌ Errore caricamento piatti esteri:', error);
  }

  // Se trovato nei piatti esteri
  if (bestScore >= 80 && bestType === 'foreign') {
    const macros = calcMacrosFromPack(bestMatch, grams);
    if (macros) {
      console.log(`   ✅ FOUND in foreign: "${bestMatch.name}" (${bestMatch.cuisine})`);
      return {
        found: true,
        item: bestMatch,
        dataPackType: 'foreign',
        macros,
        source: 'EuroFIR',
        cuisine: bestMatch.cuisine || null,
        region: null,
        city: null
      };
    }
  }

  // Se fastfood era il migliore ma non ha macros completi, prova comunque
  if (bestType === 'fastfood') {
    const macros = calcMacrosFromPack(bestMatch, grams);
    if (macros) {
      console.log(`   ✅ FOUND in fastfood (retry): "${bestMatch.name}"`);
      return {
        found: true,
        item: bestMatch,
        dataPackType: 'fastfood',
        macros,
        source: bestMatch.chain,
        chain: bestMatch.chain,
        region: null,
        city: null
      };
    }
  }

  console.log(`   ❌ Nessun match trovato (best score: ${bestScore}/${minScoreThreshold})`);
  return { found: false };
}

/**
 * Pulisce i cache (utile per testing o refresh forzato)
 */
export function clearCaches() {
  _italianDishes = null;
  _foreignDishes = null;
  _fastFood = null;
}
