/*
  Modulo di integrazione astratta per foto di piatti.
  Se l'endpoint non è configurato, restituisce un mock per sviluppo.
*/

export const PHOTO_NUTRITION_API_URL = '';

/** True se il servizio di analisi foto è configurato. */
export function isPhotoAnalysisConfigured() {
  return Boolean(PHOTO_NUTRITION_API_URL);
}

export async function analyzePhoto(imageBlob) {
  if (!PHOTO_NUTRITION_API_URL) {
    // Nessun endpoint configurato: errore esplicito invece di dati finti.
    // (Prima restituiva un mock "Pasta al pomodoro" che sembrava un risultato reale.)
    throw new Error('Analisi foto non configurata: imposta PHOTO_NUTRITION_API_URL.');
  }

  const formData = new FormData();
  formData.append('image', imageBlob, 'meal.jpg');

  const response = await fetch(PHOTO_NUTRITION_API_URL, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Errore servizio foto');
  }

  const data = await response.json();
  return {
    items: (data.items || []).map(item => ({
      name: item.name,
      estimateGrams: item.estimateGrams || item.grams || 100,
      macro: {
        kcal: item.macro?.kcal || 0,
        proteine: item.macro?.proteine || 0,
        carboidrati: item.macro?.carboidrati || 0,
        grassi: item.macro?.grassi || 0,
        zuccheri: item.macro?.zuccheri || 0,
        fibra: item.macro?.fibra || 0
      },
      imageUri: item.imageUri || ''
    }))
  };
}
