/*
  Valori nutrizionali medi per 100g per categoria di alimento.

  Fonte: tabelle USDA FoodData Central, INRAN/CREA (Italia), valori standardizzati da letteratura.
  Aggiornabile facilmente per nuove categorie o correzioni.

  Struttura: { categoryKey: { kcal, proteine, carboidrati, grassi, fibra, zuccheri } }
*/

export const TYPICAL_FOOD_CATEGORIES = {
  // Frutta fresca
  banana: {
    kcal: 89, proteine: 1.1, carboidrati: 23, grassi: 0.3, fibra: 2.6, zuccheri: 12
  },
  mela: {
    kcal: 52, proteine: 0.3, carboidrati: 14, grassi: 0.2, fibra: 2.4, zuccheri: 10
  },
  pera: {
    kcal: 57, proteine: 0.4, carboidrati: 15, grassi: 0.1, fibra: 3.1, zuccheri: 9
  },
  arancia: {
    kcal: 47, proteine: 0.9, carboidrati: 12, grassi: 0.1, fibra: 2.4, zuccheri: 9
  },
  fragola: {
    kcal: 32, proteine: 0.8, carboidrati: 8, grassi: 0.3, fibra: 2.0, zuccheri: 5
  },
  uva: {
    kcal: 67, proteine: 0.7, carboidrati: 17, grassi: 0.2, fibra: 0.9, zuccheri: 16
  },
  melone: {
    kcal: 34, proteine: 0.8, carboidrati: 8, grassi: 0.2, fibra: 0.9, zuccheri: 7
  },
  cocomero: {
    kcal: 30, proteine: 0.6, carboidrati: 7.5, grassi: 0.2, fibra: 0.4, zuccheri: 6
  },
  albicocca: {
    kcal: 48, proteine: 1.4, carboidrati: 11, grassi: 0.4, fibra: 2.0, zuccheri: 9
  },
  pesca: {
    kcal: 39, proteine: 0.9, carboidrati: 10, grassi: 0.3, fibra: 1.5, zuccheri: 8
  },
  frutta_fresca_generica: {
    kcal: 50, proteine: 0.8, carboidrati: 13, grassi: 0.3, fibra: 2.0, zuccheri: 9
  },

  // Verdure
  insalata_lattuga: {
    kcal: 15, proteine: 1.2, carboidrati: 2.9, grassi: 0.2, fibra: 1.2, zuccheri: 0.6
  },
  pomodoro: {
    kcal: 18, proteine: 0.9, carboidrati: 3.9, grassi: 0.2, fibra: 1.2, zuccheri: 2.6
  },
  cetriolo: {
    kcal: 16, proteine: 0.7, carboidrati: 3.6, grassi: 0.1, fibra: 0.5, zuccheri: 1.7
  },
  carota: {
    kcal: 41, proteine: 0.9, carboidrati: 10, grassi: 0.2, fibra: 2.8, zuccheri: 4.7
  },
  zucchina: {
    kcal: 21, proteine: 1.4, carboidrati: 3.5, grassi: 0.4, fibra: 1.1, zuccheri: 1.2
  },
  broccoli: {
    kcal: 34, proteine: 2.8, carboidrati: 7, grassi: 0.4, fibra: 2.4, zuccheri: 1.7
  },
  cavolfiore: {
    kcal: 25, proteine: 1.9, carboidrati: 5, grassi: 0.3, fibra: 2.4, zuccheri: 1.9
  },
  spinaci: {
    kcal: 23, proteine: 2.7, carboidrati: 3.6, grassi: 0.4, fibra: 2.2, zuccheri: 0.4
  },
  melanzana: {
    kcal: 25, proteine: 0.98, carboidrati: 5.9, grassi: 0.2, fibra: 3.0, zuccheri: 3.5
  },
  peperone: {
    kcal: 31, proteine: 1.0, carboidrati: 6, grassi: 0.3, fibra: 2.0, zuccheri: 3
  },
  cipolla: {
    kcal: 40, proteine: 1.1, carboidrati: 9, grassi: 0.1, fibra: 1.7, zuccheri: 4.2
  },
  verdura_cotta_generica: {
    kcal: 30, proteine: 1.5, carboidrati: 5.5, grassi: 0.3, fibra: 1.8, zuccheri: 1.5
  },

  // Cereali e pane
  pane_bianco: {
    kcal: 265, proteine: 8, carboidrati: 49, grassi: 3.3, fibra: 2.7, zuccheri: 4
  },
  pane_integrale: {
    kcal: 247, proteine: 9, carboidrati: 43, grassi: 3.3, fibra: 6.8, zuccheri: 3
  },
  pane_tostato: {
    kcal: 313, proteine: 9, carboidrati: 58, grassi: 4, fibra: 3, zuccheri: 4
  },
  pasta_cotta: {
    kcal: 131, proteine: 5, carboidrati: 25, grassi: 0.3, fibra: 1.8, zuccheri: 0.6
  },
  pasta_integrale_cotta: {
    kcal: 124, proteine: 5, carboidrati: 23, grassi: 0.5, fibra: 3.6, zuccheri: 0.4
  },
  riso_cotto: {
    kcal: 130, proteine: 2.7, carboidrati: 28, grassi: 0.3, fibra: 0.4, zuccheri: 0.1
  },
  riso_integrale_cotto: {
    kcal: 111, proteine: 2.6, carboidrati: 23, grassi: 0.9, fibra: 1.8, zuccheri: 0.0
  },
  cereali_fiocchi_sec: {
    kcal: 357, proteine: 7.5, carboidrati: 70, grassi: 5, fibra: 6, zuccheri: 15
  },
  polenta_cotta: {
    kcal: 74, proteine: 1.5, carboidrati: 17, grassi: 0.3, fibra: 1.0, zuccheri: 0.0
  },

  // Proteine: carne
  pollo_petto_magro: {
    kcal: 165, proteine: 31, carboidrati: 0, grassi: 3.6, fibra: 0, zuccheri: 0
  },
  pollo_coscia: {
    kcal: 209, proteine: 26, carboidrati: 0, grassi: 11, fibra: 0, zuccheri: 0
  },
  tacchino_petto: {
    kcal: 135, proteine: 30, carboidrati: 0, grassi: 0.7, fibra: 0, zuccheri: 0
  },
  manzo_magro: {
    kcal: 250, proteine: 26, carboidrati: 0, grassi: 15, fibra: 0, zuccheri: 0
  },
  maiale_magro: {
    kcal: 242, proteine: 27, carboidrati: 0, grassi: 14, fibra: 0, zuccheri: 0
  },
  prosciutto_cotto: {
    kcal: 215, proteine: 20, carboidrati: 2, grassi: 14, fibra: 0, zuccheri: 0
  },
  mortadella: {
    kcal: 312, proteine: 12, carboidrati: 0.8, grassi: 29, fibra: 0, zuccheri: 0
  },
  carne_magra_generica: {
    kcal: 200, proteine: 28, carboidrati: 0, grassi: 10, fibra: 0, zuccheri: 0
  },

  // Proteine: pesce
  salmone: {
    kcal: 208, proteine: 20, carboidrati: 0, grassi: 13, fibra: 0, zuccheri: 0
  },
  tonno_in_scatola_olio: {
    kcal: 289, proteine: 25, carboidrati: 0, grassi: 21, fibra: 0, zuccheri: 0
  },
  merluzzo: {
    kcal: 82, proteine: 18, carboidrati: 0, grassi: 0.7, fibra: 0, zuccheri: 0
  },
  spigola: {
    kcal: 97, proteine: 19, carboidrati: 0, grassi: 2, fibra: 0, zuccheri: 0
  },
  trota: {
    kcal: 141, proteine: 20, carboidrati: 0, grassi: 6.1, fibra: 0, zuccheri: 0
  },
  pesce_bianco_generica: {
    kcal: 100, proteine: 20, carboidrati: 0, grassi: 2, fibra: 0, zuccheri: 0
  },
  pesce_grasso_generica: {
    kcal: 180, proteine: 20, carboidrati: 0, grassi: 10, fibra: 0, zuccheri: 0
  },

  // Proteine: latticini
  latte_intero: {
    kcal: 61, proteine: 3.2, carboidrati: 4.8, grassi: 3.3, fibra: 0, zuccheri: 4.8
  },
  latte_scremato: {
    kcal: 35, proteine: 3.4, carboidrati: 5, grassi: 0.1, fibra: 0, zuccheri: 5
  },
  yogurt_naturale: {
    kcal: 59, proteine: 3.5, carboidrati: 4.7, grassi: 0.4, fibra: 0, zuccheri: 4
  },
  yogurt_greco: {
    kcal: 59, proteine: 10.2, carboidrati: 3.3, grassi: 0.4, fibra: 0, zuccheri: 2
  },
  formaggio_fresco: {
    kcal: 98, proteine: 11, carboidrati: 3.6, grassi: 5, fibra: 0, zuccheri: 0.7
  },
  formaggio_duro: {
    kcal: 402, proteine: 25, carboidrati: 1.3, grassi: 33, fibra: 0, zuccheri: 0.7
  },
  ricotta: {
    kcal: 174, proteine: 12, carboidrati: 3, grassi: 13, fibra: 0, zuccheri: 0.3
  },

  // Uova
  uovo_intero: {
    kcal: 155, proteine: 13, carboidrati: 1.1, grassi: 11, fibra: 0, zuccheri: 1.1
  },
  albume_uovo: {
    kcal: 52, proteine: 11, carboidrati: 0.7, grassi: 0.2, fibra: 0, zuccheri: 0
  },

  // Legumi cotti
  lenticchie_cotte: {
    kcal: 116, proteine: 9, carboidrati: 20, grassi: 0.4, fibra: 3.8, zuccheri: 0.4
  },
  ceci_cotti: {
    kcal: 134, proteine: 8.9, carboidrati: 23, grassi: 2.1, fibra: 6.5, zuccheri: 0.4
  },
  fagioli_cotti: {
    kcal: 127, proteine: 8.7, carboidrati: 23, grassi: 0.4, fibra: 6.4, zuccheri: 0.3
  },
  piselli_cotti: {
    kcal: 84, proteine: 5.4, carboidrati: 15, grassi: 0.4, fibra: 5.7, zuccheri: 5.7
  },
  legumi_cotti_generici: {
    kcal: 120, proteine: 8.5, carboidrati: 20, grassi: 0.6, fibra: 5.5, zuccheri: 0.5
  },

  // Oli e grassi
  olio_oliva: {
    kcal: 884, proteine: 0, carboidrati: 0, grassi: 100, fibra: 0, zuccheri: 0
  },
  burro: {
    kcal: 717, proteine: 0.9, carboidrati: 0.1, grassi: 81, fibra: 0, zuccheri: 0
  },

  // Dolci e snack
  cioccolato_fondente: {
    kcal: 546, proteine: 12, carboidrati: 61, grassi: 32, fibra: 7.2, zuccheri: 24
  },
  biscotto_secco: {
    kcal: 438, proteine: 9, carboidrati: 72, grassi: 13, fibra: 2.2, zuccheri: 14
  },
  crackers: {
    kcal: 440, proteine: 9, carboidrati: 72, grassi: 14, fibra: 2.3, zuccheri: 1.5
  },
  dolce_generico: {
    kcal: 400, proteine: 5, carboidrati: 60, grassi: 16, fibra: 1, zuccheri: 40
  },

  // Zuppe e piatti
  pasta_al_pomodoro: {
    kcal: 95, proteine: 4, carboidrati: 18, grassi: 0.5, fibra: 1.5, zuccheri: 2
  },
  risotto_burro: {
    kcal: 160, proteine: 4, carboidrati: 29, grassi: 3.5, fibra: 0.5, zuccheri: 0.2
  },
  minestrone: {
    kcal: 50, proteine: 2.5, carboidrati: 9, grassi: 0.3, fibra: 2, zuccheri: 2
  },
  zuppa_generica: {
    kcal: 60, proteine: 3, carboidrati: 10, grassi: 0.5, fibra: 1.5, zuccheri: 1.5
  },
  piatto_generico: {
    kcal: 200, proteine: 12, carboidrati: 25, grassi: 6, fibra: 2, zuccheri: 3
  }
};

/**
 * Indovina la categoria di alimento dal nome.
 * Applica pattern matching semplice normalizzando il nome e cercando parole chiave.
 *
 * @param {string} foodName - nome dell'alimento inserito dall'utente
 * @returns {{category: string, quality: 'specific'|'generic'|'fallback'}}
 */
export function guessTypicalCategoryFromName(foodName) {
  if (!foodName || typeof foodName !== 'string') {
    return { category: 'piatto_generico', quality: 'fallback' };
  }

  const normalized = foodName.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // rimuove accenti
    .trim();

  // Mapping specifico per categorie comuni
  const keywordMap = [
    // Frutta
    { keywords: ['banana'], category: 'banana', quality: 'specific' },
    { keywords: ['mela'], category: 'mela', quality: 'specific' },
    { keywords: ['pera'], category: 'pera', quality: 'specific' },
    { keywords: ['arancia', 'orange'], category: 'arancia', quality: 'specific' },
    { keywords: ['fragola', 'fragole'], category: 'fragola', quality: 'specific' },
    { keywords: ['uva'], category: 'uva', quality: 'specific' },
    { keywords: ['melone'], category: 'melone', quality: 'specific' },
    { keywords: ['cocomero', 'anguria'], category: 'cocomero', quality: 'specific' },
    { keywords: ['albicocca'], category: 'albicocca', quality: 'specific' },
    { keywords: ['pesca'], category: 'pesca', quality: 'specific' },

    // Verdure
    { keywords: ['insalata', 'lattuga'], category: 'insalata_lattuga', quality: 'specific' },
    { keywords: ['pomodoro', 'pomodori'], category: 'pomodoro', quality: 'specific' },
    { keywords: ['cetriolo'], category: 'cetriolo', quality: 'specific' },
    { keywords: ['carota', 'carote'], category: 'carota', quality: 'specific' },
    { keywords: ['zucchina', 'zucchine'], category: 'zucchina', quality: 'specific' },
    { keywords: ['broccoli', 'broccolo'], category: 'broccoli', quality: 'specific' },
    { keywords: ['cavolfiore'], category: 'cavolfiore', quality: 'specific' },
    { keywords: ['spinaci', 'spinacio'], category: 'spinaci', quality: 'specific' },
    { keywords: ['melanzana'], category: 'melanzana', quality: 'specific' },
    { keywords: ['peperone', 'peperoni'], category: 'peperone', quality: 'specific' },
    { keywords: ['cipolla', 'cipolle'], category: 'cipolla', quality: 'specific' },

    // Cereali e pane
    { keywords: ['pane', 'integrale'], category: 'pane_integrale', quality: 'specific' },
    { keywords: ['pane'], category: 'pane_bianco', quality: 'specific' },
    { keywords: ['pasta'], category: 'pasta_cotta', quality: 'specific' },
    { keywords: ['riso'], category: 'riso_cotto', quality: 'specific' },
    { keywords: ['polenta'], category: 'polenta_cotta', quality: 'specific' },

    // Carni
    { keywords: ['pollo', 'petto'], category: 'pollo_petto_magro', quality: 'specific' },
    { keywords: ['pollo'], category: 'pollo_coscia', quality: 'specific' },
    { keywords: ['tacchino'], category: 'tacchino_petto', quality: 'specific' },
    { keywords: ['manzo'], category: 'manzo_magro', quality: 'specific' },
    { keywords: ['maiale'], category: 'maiale_magro', quality: 'specific' },
    { keywords: ['prosciutto'], category: 'prosciutto_cotto', quality: 'specific' },

    // Pesce
    { keywords: ['salmone'], category: 'salmone', quality: 'specific' },
    { keywords: ['tonno'], category: 'tonno_in_scatola_olio', quality: 'specific' },
    { keywords: ['merluzzo'], category: 'merluzzo', quality: 'specific' },

    // Latticini
    { keywords: ['latte'], category: 'latte_intero', quality: 'specific' },
    { keywords: ['yogurt'], category: 'yogurt_naturale', quality: 'specific' },
    { keywords: ['formaggio', 'cheddar', 'parmigiano'], category: 'formaggio_duro', quality: 'specific' },
    { keywords: ['ricotta'], category: 'ricotta', quality: 'specific' },

    // Uova
    { keywords: ['uovo', 'uova'], category: 'uovo_intero', quality: 'specific' },

    // Legumi
    { keywords: ['lenticchia', 'lenticchie'], category: 'lenticchie_cotte', quality: 'specific' },
    { keywords: ['ceci'], category: 'ceci_cotti', quality: 'specific' },
    { keywords: ['fagioli'], category: 'fagioli_cotti', quality: 'specific' },
    { keywords: ['piselli'], category: 'piselli_cotti', quality: 'specific' },

    // Piatti
    { keywords: ['pasta', 'pomodoro'], category: 'pasta_al_pomodoro', quality: 'specific' },
    { keywords: ['risotto'], category: 'risotto_burro', quality: 'specific' },
    { keywords: ['minestrone'], category: 'minestrone', quality: 'specific' },
    { keywords: ['zuppa'], category: 'zuppa_generica', quality: 'generic' },

    // Fallback per gruppi generici
    { keywords: ['frutta'], category: 'frutta_fresca_generica', quality: 'generic' },
    { keywords: ['verdura'], category: 'verdura_cotta_generica', quality: 'generic' },
    { keywords: ['carne'], category: 'carne_magra_generica', quality: 'generic' },
    { keywords: ['pesce'], category: 'pesce_bianco_generica', quality: 'generic' }
  ];

  // Cerca i keyword nel nome normalizzato
  for (const map of keywordMap) {
    if (map.keywords.some(keyword => normalized.includes(keyword))) {
      return { category: map.category, quality: map.quality };
    }
  }

  // Fallback assoluto
  return { category: 'piatto_generico', quality: 'fallback' };
}

/**
 * Ottiene i valori tipici per una categoria.
 * @param {string} category - chiave della categoria
 * @returns {object|null} - valori per 100g o null se non trovata
 */
export function getTypicalValuesForCategory(category) {
  return TYPICAL_FOOD_CATEGORIES[category] || null;
}

/**
 * Lista tutte le categorie disponibili (per dropdown/selezione).
 * @returns {array} - array di categorie ordinate
 */
export function listAvailableCategories() {
  return Object.keys(TYPICAL_FOOD_CATEGORIES).sort();
}
