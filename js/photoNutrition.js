/*
  Modulo di integrazione astratta per foto di piatti.
  Se l'endpoint non è configurato, restituisce un mock per sviluppo.
*/

export const PHOTO_NUTRITION_API_URL = '';

export async function analyzePhoto(imageBlob) {
  if (!PHOTO_NUTRITION_API_URL) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          items: [
            {
              name: 'Pasta al pomodoro',
              estimateGrams: 220,
              macro: { kcal: 360, proteine: 12, carboidrati: 65, grassi: 7, zuccheri: 5, fibra: 4 },
              imageUri: ''
            },
            {
              name: 'Insalata mista',
              estimateGrams: 110,
              macro: { kcal: 65, proteine: 2, carboidrati: 8, grassi: 3, zuccheri: 3, fibra: 2 },
              imageUri: ''
            }
          ]
        });
      }, 850);
    });
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
