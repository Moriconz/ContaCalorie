/*
  Nutrition Data Provider - Italian Database (Banca dati dei valori nutritivi)

  Accede ai dati nutrizionali dalla banca dati italiana ufficiale.
  Database con 583 alimenti italiani verificati.
*/

let foodDatabase = null;
let foodIndexByName = null;

async function loadFoodDatabase() {
  if (foodDatabase) return foodDatabase;

  try {
    const response = await fetch('/data/italian_foods_full.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    foodDatabase = data.foods || [];
    console.log(`✅ Loaded ${foodDatabase.length} Italian foods`);
    return foodDatabase;
  } catch (error) {
    console.error('Error loading food database:', error);
    return [];
  }
}

/**
 * Normalizza: minuscole + rimozione accenti + punteggiatura trattata come
 * spazio. Il DB CREA usa nomi tipo "Pollo, petto, crudo" — senza questo, lo
 * split per parole indicizzava "pollo," con la virgola attaccata, e query
 * come "petto di pollo" non trovavano mai la voce (colpiva ~64% del DB,
 * ogni nome con virgole). Il trattino è incluso per lo stesso motivo: nomi
 * brand tipo "Filet-O-Fish" non erano trovabili da query multi-parola tipo
 * "filet o fish".
 */
function normalizeWord(w) {
  return w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[,.;:()-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Stemming leggero italiano: genera le varianti singolare/plurale di una parola
 * ("mele" → {mele, mela}, "pomodori" → {pomodori, pomodoro, pomodore}).
 * Usato sia in indicizzazione che in ricerca, così "mela" trova "Mele" e viceversa.
 * Esportata (con underscore) solo per i test.
 */
export function _wordVariants(word) {
  const w = normalizeWord(word);
  const out = new Set([w]);
  if (w.length < 4) return out;

  if (w.endsWith('che')) out.add(w.slice(0, -3) + 'ca');        // banche → banca
  else if (w.endsWith('ghe')) out.add(w.slice(0, -3) + 'ga');   // alghe → alga
  else if (w.endsWith('chi')) out.add(w.slice(0, -3) + 'co');   // fichi → fico
  else if (w.endsWith('ghi')) out.add(w.slice(0, -3) + 'go');   // funghi → fungo
  else if (w.endsWith('e')) out.add(w.slice(0, -1) + 'a');      // mele → mela
  else if (w.endsWith('i')) {
    out.add(w.slice(0, -1) + 'o');                              // pomodori → pomodoro
    out.add(w.slice(0, -1) + 'e');                              // noci → noce
  } else if (w.endsWith('a')) out.add(w.slice(0, -1) + 'e');    // mela → mele
  else if (w.endsWith('o')) out.add(w.slice(0, -1) + 'i');      // pomodoro → pomodori

  return out;
}

function indexFoodUnder(key, food) {
  if (!foodIndexByName[key]) {
    foodIndexByName[key] = [];
  }
  if (!foodIndexByName[key].some(f => f.id === food.id)) {
    foodIndexByName[key].push(food);
  }
}

function buildFoodIndex() {
  if (foodIndexByName) return foodIndexByName;

  foodIndexByName = {};

  if (!foodDatabase) return foodIndexByName;

  foodDatabase.forEach(food => {
    const normalizedName = normalizeWord(food.name_it);

    // Index by exact name
    indexFoodUnder(normalizedName, food);

    // Index by single words + varianti singolare/plurale
    const words = normalizedName.split(/\s+/);
    words.forEach(word => {
      if (word.length > 1) {
        _wordVariants(word).forEach(variant => indexFoodUnder(variant, food));
      }
    });
  });

  return foodIndexByName;
}

// Normalize food item to app format
export function normalizeFoodItem(food) {
  return {
    id: food.id,
    source: food.source || 'BancaDatiNutrizionali',
    nome: food.name_it,
    porzioneBase: '100 g',
    per100g: {
      kcal: food.kcal_100g,
      proteine: food.protein_100g,
      carboidrati: food.carb_100g,
      zuccheri: 0,
      grassi: food.fat_100g,
      grassi_saturi: 0,
      fibra: food.fiber_100g || 0,
      sodioMg: 0
    },
    tags: [],
    createdByUserId: null
  };
}

// Search food database by name
export async function searchFoods(query) {
  try {
    const db = await loadFoodDatabase();
    const index = buildFoodIndex();
    const normalizedQuery = normalizeWord(query);

    if (!normalizedQuery) return [];

    const matches = new Map();

    // Exact match
    if (index[normalizedQuery]) {
      index[normalizedQuery].forEach(food => {
        matches.set(food.id, {
          score: 100,
          food
        });
      });
    }

    // Partial word matches (con varianti singolare/plurale)
    const queryWords = normalizedQuery.split(/\s+/);
    for (const word of queryWords) {
      if (word.length <= 1) continue;
      for (const variant of _wordVariants(word)) {
        if (!index[variant]) continue;
        // La forma esatta pesa più della variante stemmata
        const baseScore = variant === word ? 50 : 40;
        index[variant].forEach(food => {
          const existing = matches.get(food.id);
          const score = existing ? existing.score + 10 : baseScore;
          matches.set(food.id, { score, food });
        });
      }
    }

    // Also do substring matching
    if (matches.size < 15) {
      db.forEach(food => {
        if (!matches.has(food.id) && food.name_it.toLowerCase().includes(normalizedQuery)) {
          matches.set(food.id, {
            score: 30,
            food
          });
        }
      });
    }

    return Array.from(matches.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(({ food }) => normalizeFoodItem(food));

  } catch (error) {
    console.warn('searchFoods error:', error);
    return [];
  }
}

// Get food details by ID
export async function getFoodDetails(foodId) {
  try {
    const db = await loadFoodDatabase();

    // Find by ID
    const food = db.find(f => f.id === foodId);
    if (food) return normalizeFoodItem(food);

    // Find by name
    const byName = db.find(f => f.name_it.toLowerCase() === foodId.toLowerCase());
    if (byName) return normalizeFoodItem(byName);

    console.warn(`Food not found: ${foodId}`);
    return null;

  } catch (error) {
    console.warn('getFoodDetails error:', error);
    return null;
  }
}

// Get random foods for suggestions
export async function getRandomCreeFoods(count = 5) {
  try {
    const db = await loadFoodDatabase();
    const results = [];

    for (let i = 0; i < Math.min(count, db.length); i++) {
      const randomFood = db[Math.floor(Math.random() * db.length)];
      results.push(normalizeFoodItem(randomFood));
    }

    return results;
  } catch (error) {
    console.warn('getRandomCreeFoods error:', error);
    return [];
  }
}

// Get foods by category
export async function getCreaFoodsByCategory(category) {
  try {
    const db = await loadFoodDatabase();
    return db
      .filter(f => f.category && f.category.includes(category))
      .map(f => normalizeFoodItem(f));
  } catch (error) {
    console.warn('getCreaFoodsByCategory error:', error);
    return [];
  }
}

/**
 * Restituisce la lista grezza degli alimenti CREA (con micros, kcal_100g, portion_g).
 * Usata dall'engine micronutrienti per aggregazione e suggerimenti.
 */
export async function getAllFoods() {
  return await loadFoodDatabase();
}

/**
 * Indice id → { micros, kcal_100g } per l'aggregazione giornaliera dei micronutrienti.
 */
export async function getMicrosIndex() {
  const db = await loadFoodDatabase();
  const idx = {};
  for (const f of db) {
    if (f.micros) idx[f.id] = { micros: f.micros, kcal_100g: f.kcal_100g };
  }
  return idx;
}
