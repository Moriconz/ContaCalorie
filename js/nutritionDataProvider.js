/*
  Accesso a una fonte pubblica di alimenti (Open Food Facts) con normalizzazione.
  Il modulo restituisce risultati temporanei e può cache solo gli item usati.
*/

import { cacheRemoteFood, loadRemoteFoodCache } from './storage.js';

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const DETAIL_URL = 'https://world.openfoodfacts.org/api/v0/product';

function normalizeFoodItem(product) {
  const nutriments = product?.nutriments || {};
  const per100g = {
    kcal: Number(nutriments['energy-kcal_100g'] || nutriments['energy_100g'] || 0),
    proteine: Number(nutriments['proteins_100g'] || 0),
    carboidrati: Number(nutriments['carbohydrates_100g'] || 0),
    zuccheri: Number(nutriments['sugars_100g'] || 0),
    grassi: Number(nutriments['fat_100g'] || 0),
    grassi_saturi: Number(nutriments['saturated-fat_100g'] || 0),
    fibra: Number(nutriments['fiber_100g'] || 0),
    sodioMg: Number(nutriments['sodium_100g'] ? nutriments['sodium_100g'] * 1000 : nutriments['salt_100g'] ? nutriments['salt_100g'] * 1000 : 0)
  };

  return {
    id: product.id || product.code || crypto.randomUUID(),
    source: 'OPEN_FOOD_API',
    nome: product.product_name || product.product_name_en || 'Alimento sconosciuto',
    brand: Array.isArray(product.brands_tags) ? product.brands_tags[0] || '' : product.brands || '',
    porzioneBase: '100 g',
    per100g,
    tags: Array.isArray(product.labels_tags) ? product.labels_tags.slice(0, 4) : [],
    createdByUserId: null
  };
}

export async function searchFoods(query) {
  try {
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      json: '1',
      page_size: '12'
    });
    const response = await fetch(`${SEARCH_URL}?${params.toString()}`);
    if (!response.ok) throw new Error('Ricerca API fallita');
    const data = await response.json();
    return (data.products || []).map(normalizeFoodItem);
  } catch (error) {
    console.warn('NutritionDataProvider searchFoods', error);
    return [];
  }
}

export async function getFoodDetails(idEsterno) {
  try {
    const cached = await loadRemoteFoodCache(idEsterno);
    if (cached) return cached;
    const response = await fetch(`${DETAIL_URL}/${encodeURIComponent(idEsterno)}.json`);
    if (!response.ok) throw new Error('Dettaglio alimento non trovato');
    const data = await response.json();
    const item = normalizeFoodItem(data.product || {});
    await cacheRemoteFood(item);
    return item;
  } catch (error) {
    console.warn('NutritionDataProvider getFoodDetails', error);
    return null;
  }
}
